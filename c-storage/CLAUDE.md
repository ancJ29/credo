# c-storage
Stack: Go 1.26, modernc.org/sqlite · Gate: make check · Ship: none yet

Key-value records for the BFF, each under its own service: one Go binary, one SQLite file, one
listener. Six routes, each with a caller in [the app frame](../docs/plans/2026-10-27-app-frame.md) or
[the employee list](../docs/plans/2026-10-29-employee-list.md#the-records).
Why it is built so: [the memo](../docs/memo/c-storage.md), one section per decision or hazard.

## Non-obvious facts

- **`make check` is the whole gate; `pnpm check` never reaches this directory.** Format, vet, race
  tests at 100 % of statements outside `cmd/server` (`scripts/cover.sh` names each line no test runs
  and why the entry point is left out), and the cross-compile for the box (linux/arm64, `t4g.nano`),
  so a dependency that quietly needs cgo fails here.
- **The internal key gates every path, unknown ones included; only `GET /health` answers before
  it, and nothing answers 405.** Register a route through `s.handle`, or
  `TestEveryRegisteredRouteIsListed` cannot see it
  ([why](../docs/memo/c-storage.md#the-internal-key-gates-every-path)).
- **No record is public:** each record route needs its service's access key
  ([why](../docs/memo/c-storage.md#no-record-is-public)).
- **Keys are compared whole, in constant time; an access key is stored only as its SHA-256**
  ([why](../docs/memo/c-storage.md#keys-are-compared-exactly-and-stored-hashed)).
- **A write naming a tag or no record answers 412 where the record moved, and a precondition it
  cannot honour 400, never ignored;** a caller keeps the tag a read returned, never computes one
  ([why](../docs/memo/c-storage.md#a-write-on-a-moved-record-is-refused)).
- **Every transaction begins IMMEDIATE,** a read wrapped in one included
  ([why](../docs/memo/c-storage.md#one-writer-at-a-time)).
- **`schema.sql` applies only to a new file:** a schema change needs the version raised and a step
  that carries a version-1 file to it
  ([why](../docs/memo/c-storage.md#the-schema-version-is-checked-at-open)).
- **The listener binds one address:** `LISTEN_ADDR`, a single IP and never an unspecified one,
  loopback when unset; on ridge the box's private address
  ([why](../docs/memo/c-storage.md#the-listener-binds-one-address)).
- **The database file is the only copy since its last backup;** a live copy goes through SQLite's
  own backup, never a plain file copy ([why](../docs/memo/c-storage.md#the-file-is-the-only-copy)).
- **Tests bind loopback ports** (`internal/lifecycle`'s run the process on real sockets, because the
  shutdown order is only visible there). In the agent's sandbox: set `GOCACHE` under `$TMPDIR`, and
  `GOPROXY=off GOFLAGS=-mod=mod` where the module cache holds everything; `/usr/bin/make` may print
  `couldn't create cache file … xcrun_db` and run anyway.
- **`make check` never runs the Bruno collection; the `e2e` job in CI does, through
  `scripts/e2e.sh`.** A route or answer that changes updates its request in `bruno/` in the same
  commit, and `bash scripts/e2e.sh` from here is the check (needs Bruno CLI 4.2.0). `make check`
  does hold that every route has a request outside `03-the-boundary`, none reaches a route the
  service lacks, and every request has a tests script, because `bru` exits 0 for a request that
  asserts nothing (`internal/server/collection_test.go`). `e2e.sh` also holds that every request
  file ran, passed and asserted (`bru` exits 0 for a file it cannot parse), that the HTML report
  carries no key, and the entry point's three outcomes (a bad configuration exits 1, a port
  already taken exits 1, SIGTERM exits 0), which is why `scripts/cover.sh` leaves `cmd/server` out
  as `elsewhere`. See the [README](README.md).
- **The Bruno collection and the e2e job are the human's call,** not a request that fell out of
  "nothing enters unless called": on 10-27 he asked for a collection ("bruno is simple and help
  human a lot when need debug"), then for c-storage verified end to end in GitHub Actions, as the
  QA proof of how a service is delivered with confidence. Nobody deletes them as unconsumed.