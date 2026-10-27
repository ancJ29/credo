# c-storage
Stack: Go 1.25, modernc.org/sqlite · Gate: make check · Ship: none yet

Key-value records for the BFF, each under its own service: one Go binary, one SQLite file, one
listener. Five routes, each with a caller in [the app frame](../docs/plans/2026-10-27-app-frame.md).
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
- **The listener binds loopback only;** the first box needs its private address
  ([open item 7](../docs/open-items.md), [why](../docs/memo/c-storage.md#loopback-only-for-now)).
- **The database file is the only copy since its last backup;** a live copy goes through SQLite's
  own backup, never a plain file copy ([why](../docs/memo/c-storage.md#the-file-is-the-only-copy)).
- **Tests bind loopback ports** (`internal/lifecycle`'s run the process on real sockets, because the
  shutdown order is only visible there). In the agent's sandbox: set `GOCACHE` under `$TMPDIR`, and
  `GOPROXY=off GOFLAGS=-mod=mod` where the module cache holds everything; `/usr/bin/make` may print
  `couldn't create cache file … xcrun_db` and run anyway.
