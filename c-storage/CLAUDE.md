# c-storage
Stack: Go 1.25, modernc.org/sqlite · Gate: make check · Ship: none yet

Key-value records for the BFF, each under its own service: one Go binary, one SQLite file, one
listener. Five routes, each with a caller in [the app frame](../docs/plans/2026-10-27-app-frame.md).

## Non-obvious facts

- **`make check` is the whole gate; `pnpm check` never reaches this directory.** Format, vet, race
  tests at 100 % of statements outside `cmd/server` (`scripts/cover.sh` names each line no test runs
  and why the entry point is left out), and the cross-compile for the box (linux/arm64, `t4g.nano`),
  so a dependency that quietly needs cgo fails here.
- **The internal key gates the whole mux, unknown paths included;** only `GET /health` answers
  before it, and nothing answers 405 (`TestUnknownPathsRevealNothingWithoutTheInternalKey`,
  `TestThisServiceNeverAnswers405`). A 404 beside a 401, or a 405, would let a caller map the
  surface. Register a route through `s.handle`: `TestEveryRegisteredRouteIsListed` fails on one
  missing from `everyRoute`.
- **Keys are compared exactly, in constant time**, never by a short digest: a digest one byte wide
  lets one random key in 256 through. A service's access key is stored as its SHA-256, so a copy of
  the file holds no key and a lost key cannot be read back. Registering a code twice is a 409 and
  nothing changes or removes a service: a lost key is a new service code.
- **No record is public.** Every record route needs the service's access key, and a missing key, a
  wrong one and an unknown service all answer 403. A public read is a new decision with its own
  route, never a flag on a record.
- **A record's tag is the SHA-256 of its stored text, and a write may name it.** `If-Match: <tag>` or
  `If-None-Match: *` makes a push or remove 412 where the record moved, checked in the write's
  transaction. A precondition it cannot read, or on a write that cannot honour one (register), is
  refused 400, never ignored, or a conditional write would run unconditional
  (`TestNoWriteIgnoresAPrecondition`). The tag is of text, not of parsed data, which a re-encoding
  never reproduces.
- **Every transaction begins IMMEDIATE** (`_txlock=immediate`), and `busy_timeout` serialises
  concurrent writers. A read-modify-write outside a transaction loses writes
  (`TestOfWritesNamingNoRecordOneLands`, `TestEveryTransactionTakesTheWriteLockAtBegin`).
- **`schema.sql` applies only to a new file.** Opening stamps `user_version` 1 and refuses any other
  version, or a file at 0 that already has tables (`TestOpenRefusesWhatItCannotUse`). Editing the
  schema alone changes no existing database, so a schema change needs a version bump and a step
  that carries a version-1 file to it. *Rejected:* a chain of numbered migrations: untested code on
  the path to a new file, until a database holds data in an earlier shape.
- **The listener binds loopback only** (`TestListenBindsLoopbackOnly`). The architecture's box is
  reached on its private address, so the first box needs this changed
  ([open item 7](../docs/open-items.md)).
- **`c-storage.db` is the only copy** of what was written since its last backup; the backup is not
  this service's ([open item 6](../docs/open-items.md)).
- **Tests bind loopback ports** (`internal/lifecycle`'s run the process on real sockets, because the
  shutdown order is only visible there). In the agent's sandbox: set `GOCACHE` under `$TMPDIR`, and
  `GOPROXY=off GOFLAGS=-mod=mod` where the module cache holds everything; `/usr/bin/make` may print
  `couldn't create cache file … xcrun_db` and run anyway.
