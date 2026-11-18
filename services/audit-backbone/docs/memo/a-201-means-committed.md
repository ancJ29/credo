# A 201 means committed, not queued

**Decided** 2026-08-31. **Amended** 2026-10-04 (trimmed; the linger knob
removed) and 2026-11-18 (the writer goroutine and its group commit removed).

`Store.Append` writes a request's entries in one transaction and does not
return until it has committed; only then does the 201 name their ids.

**Rejected: answer from a queue and flush on a timer.**
`POST /api/activities` commits a request whole and returns its ids, and a
caller left without them replays the batch. A duplicate entry is a visible artefact. A gap
cannot be told apart from an event that never happened. Naming ids that are
still in memory turns every crash into exactly that gap, and the caller can
never learn of it.

**Rejected since 2026-11-18: one writer goroutine with group commit.** Until
then every write went through a single goroutine that gathered the callers
waiting on it into one transaction, a savepoint each, to share the fsync. No
measured load ever asked for that, and it made every new write a queued unit,
gave the shutdown an order of its own, and set this service apart from
c-storage. Each write is now a plain transaction that begins `IMMEDIATE` on
the writer's one connection, so concurrent writes queue in Go's pool rather
than race for the lock past `busy_timeout` (`TestAppendsAtOnceAllLand`), and a
request's entries still commit whole or not at all.

**Accepted:** if the box goes down, what was in flight is lost: the requests
not yet answered, which their callers replay.
