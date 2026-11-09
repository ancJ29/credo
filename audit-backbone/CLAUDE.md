# audit-backbone
Stack: Go 1.25 · Gate: make check · Ship: none yet

The activity log: one Go binary, one SQLite file, a keyed writer and a
token-gated reader on two loopback ports. Repo-wide rules: [`CLAUDE.md`](../CLAUDE.md).

## What belongs here, and what does not

Nine internal packages, each one job: `activity` (the audit-log domain: wire shape, store, handlers),
`auth` (the write key and the read token), `batch` (the single writer every write goes through),
`config` (the environment, once, at start-up), `httpx` (JSON replies and the error-to-status
mapping), `lifecycle` (the process: both listeners, the sweep, the shutdown order), `reqlog` (one log
line a request), `server` (the two listeners and their gates), `sqlitedb` (opening the database).
`cmd/server` is wiring. What an entry means, who the system writing it is, and who reads it are the
callers' and are not decided here; a route or a field belongs only with a caller that needs it.

## The file to copy

- **A package:** `audit-backbone/internal/auth/auth.go` and its `auth_test.go`: a package comment
  stating its one job, a constructor that takes the clock (`New`), and tests beside it that drive the
  clock rather than wait.
- **A route:** register it through `func (l *listener) HandleFunc(` in
  `audit-backbone/internal/server/server.go`, with a row in `everyRoute` or `everyOpenRoute` in
  `audit-backbone/internal/server/server_test.go` and a request in `bruno/`.

## This package's own rules

Marks: [How to read a rule](../docs/conventions/code.md#how-to-read-a-rule). Five rules, each
sourced from the code as it stands; the first copy of this package carried no ids, so these are
minted here, once, and never renumbered.

- **AB1 · holds · check:** format, vet, race tests at 100 % of statements outside `cmd/server`, and the
  box's cross-compile are the gate (`audit-backbone/Makefile`, `audit-backbone/scripts/cover.sh`).
- **AB2 · holds · check:** a route is registered through `func (l *listener) HandleFunc(`
  (`audit-backbone/internal/server/server.go`), held by `TestEveryRegisteredRouteIsListed`.
- **AB3 · holds · reader:** every write goes through `func (w *Writer) Do(`
  (`audit-backbone/internal/batch/writer.go`); `Store.Sweep` and the insert in
  `audit-backbone/internal/activity/store.go` are its only callers.
- **AB4 · holds · reader:** the database driver is imported only by `sqlitedb`
  (`Open` in `audit-backbone/internal/sqlitedb/open.go`), the environment is read only by `config`
  (`Load` in `audit-backbone/internal/config/config.go`), and `cmd/server` adds only logging,
  signals and exit codes.
- **AB5 · holds · reader:** an error the caller can act on gets a message and everything else a
  generic one, because a SQLite error text names files on disk (`Internal` in
  `audit-backbone/internal/httpx/httpx.go`).

## Non-obvious facts

- **`make check` is the whole gate; `pnpm check` never reaches this
  directory.** It has no `package.json`. The cross-compile for the box is in the gate, because a dependency that
  quietly needs cgo would otherwise show up only at ship time.
- **The gate holds 100 % of statements outside `cmd/server`**
  (`scripts/cover.sh`), and names each line no test runs. `main.go` keeps
  only wiring, and `scripts/smoke.sh` reads back each path it keeps. A
  package needs no test file of its own, since every test binary measures every
  package; each binary's own percentage is therefore meaningless, and the merge
  is the verdict.
- **Go 1.25 is `modernc.org/sqlite`'s floor**, and that pure-Go driver is what
  lets the binary build static with `CGO_ENABLED=0`.
- **In the agent's sandbox:** set `GOCACHE` under `$TMPDIR`, because
  `~/Library/Caches/go-build` is not writable there. `/usr/bin/make` prints
  `couldn't create cache file … xcrun_db` and runs anyway.
- **The security boundary is which mux a route is registered on**
  ([the-listener-is-the-boundary](docs/memo/the-listener-is-the-boundary.md)).
  Register through the `listener`'s `HandleFunc` and never on `l.mux` directly.
  `TestEveryRegisteredRouteIsListed` reads the recorded patterns, so a route
  added without an entry in `everyRoute` or `everyOpenRoute` fails the gate.
- **One gate covers each whole mux, unknown paths included:** the key on the
  keyed, the read token on the open. Only `GET /health`, and on the open
  listener a preflight, answer before it. A 404 for an unknown path beside a
  401 for a real one would be a route oracle.
- **No read token can be revoked alone.** A new `ACTIVITY_WRITE_KEY` ends
  every token, and the client's writes until its system holds the new key
  ([the-reader-takes-a-token](docs/memo/the-reader-takes-a-token.md)).
- **This service answers no 405, and that is load-bearing.** The catch-all
  fallback suppresses net/http's own 405 (`TestThisServiceNeverAnswers405`).
- **`activity.Reader` and `Writer` are separate interfaces over one store.**
  Do not collapse them into `Store` (`audit-backbone/internal/activity/store.go`) in `Domains`
  (`audit-backbone/internal/server/server.go`): that split is what the compiler checks about the
  boundary.
- **`batch.Writer.Do` blocks until the commit.** Never make it asynchronous:
  the 201 names committed ids
  ([a-201-means-committed](docs/memo/a-201-means-committed.md)).
- **The retention sweep IS retention.** A sweep that stops is a store that
  grows forever with every test green
  ([retention-is-a-predicate](docs/memo/retention-is-a-predicate.md)).
- **Nothing in this repository backs up `activities.db`:** no backup, restore or drill exists for
  it, so what the file holds is the only copy.
- **The `#` rule in `validateID` stays, and its reason is historical.** It came in with the service,
  from a store that has no counterpart in this repository, and what will call this service here is
  not decided yet. Keep the rule until it is.
- **The ULID is minted from insert time, and retention runs from
  `createdAt`.** Both are deliberate, and both are pinned by
  `TestBackdatedEntryKeepsInsertOrderButExpiresEarlier`.
- **`bruno/environments/local.yml` and `scripts/dev-up.sh` share a
  development key**, so `bru run --env local` works on a fresh clone. Change
  one and change the other. This package carries only that local
  environment; an environment for anything deployed is not in this repository, on purpose, and
  the folder's `.gitignore` keeps any other environment file out.
- **`scripts/smoke.sh` and `dev-up.sh` build through `make dist` for the host.**
  That way the flags that ship are the flags tested. They run a built binary
  rather than `go run`, because `go run`'s child keeps the port after a kill.
  `dev-down.sh` also clears 3190 and 3191 of whatever else holds them.
- **Tests bind loopback ports:** `TestListenersBindLoopbackOnly`, and
  `internal/lifecycle`'s, which run the process on real sockets because the
  shutdown order is only visible there.

## Where the rest is

**Nothing in this repository calls this package yet, and how it integrates is undecided.** The BFF
does not reach it, `ops/` ships nothing of it, and the CI workflow has no job for it (c-storage's
`make check` job is the model). `pnpm check` does not run it: the root `.prettierignore` and
`knip.json` leave it out, as they do `c-storage/`.

[The big picture](../docs/architecture.md#at-a-glance), [the cross-package rules](../docs/conventions/code.md),
and [documentation](../docs/conventions/documentation.md), read before editing docs, comments or
this file. The package's own index is [`docs/README.md`](docs/README.md). Sibling to copy: `c-storage`,
the other Go package.
