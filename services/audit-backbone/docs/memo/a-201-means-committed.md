# A 201 means committed, not queued

**Decided** 2026-08-31. **Amended** 2026-10-04 (trimmed; the linger knob
removed).

Every write goes through one goroutine, and `batch.Writer.Do` does not return
until the transaction that carries it has committed.

**Rejected: answer from the queue and flush on a timer.**
`POST /api/activities` commits a request whole and returns its ids, and a
caller left without them replays the batch. A duplicate entry is a visible artefact. A gap
cannot be told apart from an event that never happened. Naming ids that are
still in memory turns every crash into exactly that gap, and the caller can
never learn of it.

**Why there is no flush interval at all.** Once the handler waits, the batch
forms on its own: work queues up during the previous commit. Under load the
fsync is shared as an interval would share it, and under no load the latency
is one commit. *Rejected:* a linger setting, since no measured load ever asked
for one.

**The hazard: units in one transaction share a fate.** Each unit runs inside
its own `SAVEPOINT`, so one caller's bad row rolls back only to its own mark.
`TestOneFailingUnitDoesNotFailItsBatchMates` queues all three units before the
writer starts. If the units committed one at a time, the test would pass
without ever using a savepoint.

**Accepted:** if the box goes down, what was in flight is lost. That is one
commit's worth, not one interval's.
