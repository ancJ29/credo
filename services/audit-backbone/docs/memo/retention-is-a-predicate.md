# Retention is a predicate, not a dropped file

**Decided** 2026-08-31. **Amended** 2026-10-04 (trimmed; the interval and the
window became constants).

Retention is `DELETE … WHERE expires_at < ?`, run on the writer goroutine in
bounded batches, so a year of expired rows cannot hold the write transaction
while live traffic queues behind it. `expires_at` counts from `createdAt`, the
caller's action time, never from insert time, so a backdated backfill does
not buy itself a fresh window
(`TestBackdatedEntryKeepsInsertOrderButExpiresEarlier`).

**Rejected: one database file per month, where retention means deleting the
file.** It is cheaper, but it measures retention from insert time and loses
the property above. It can be reopened: the log is append-only, so monthly
files would work once a measured file size asks for them.

**The hazard: this sweep IS retention.** No TTL service stands behind it and
there is no file to drop. A sweep that stops running is a store that grows
forever while every test stays green. It runs at start-up, so a box that was
down over a boundary catches up at once, and then every hour. The interval and
the 180 days are constants, because no environment ever set either one.
