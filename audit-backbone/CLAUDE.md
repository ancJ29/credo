# audit-backbone
Stack: Go 1.25 · Gate: make check · Ship: none yet · Lifecycle: active

The activity log: one Go binary, one SQLite file, a keyed writer and a
token-gated reader on two loopback ports. Repo-wide rules: [`CLAUDE.md`](../CLAUDE.md).

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
  Do not collapse them into `*activity.Store` in `server.Domains`: that split
  is what the compiler checks about the boundary.
- **`batch.Writer.Do` blocks until the commit.** Never make it asynchronous:
  the 201 names committed ids
  ([a-201-means-committed](docs/memo/a-201-means-committed.md)).
- **The retention sweep IS retention.** A sweep that stops is a store that
  grows forever with every test green
  ([retention-is-a-predicate](docs/memo/retention-is-a-predicate.md)).
- **`activities.db` is backed up by ops, not by this service:** nightly on an
  EC2 box, restored by script; no backup job for it exists in this repository yet.
  Between nights it is the only copy of what was written since.
- **The `#` rule in `validateID` stays while the DynamoDB service still
  answers.** An input that one service accepts and the other rejects is a
  caller that breaks when it is repointed. Delete the rule when that service
  is torn down.
- **The ULID is minted from insert time, and retention runs from
  `createdAt`.** Both are deliberate, and both are pinned by
  `TestBackdatedEntryKeepsInsertOrderButExpiresEarlier`.
- **`bruno/environments/local.yml` and `scripts/dev-up.sh` share a
  development key**, so `bru run --env local` works on a fresh clone. Change
  one and change the other. Every other environment file is git-ignored, but a
  client env's, whose key is a Bruno secret.
- **`scripts/smoke.sh` and `dev-up.sh` build through `make dist` for the host.**
  That way the flags that ship are the flags tested. They run a built binary
  rather than `go run`, because `go run`'s child keeps the port after a kill.
  `dev-down.sh` also clears 3190 and 3191 of whatever else holds them.
- **Tests bind loopback ports:** `TestListenersBindLoopbackOnly`, and
  `internal/lifecycle`'s, which run the process on real sockets because the
  shutdown order is only visible there.

## Documentation

Read [`documentation.md`](../docs/conventions/documentation.md)
before editing docs, comments, or this file. The index is
[`docs/README.md`](docs/README.md).
