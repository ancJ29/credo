# The records' copy check reads a listing of any size, recap, 2026-11-16

## What happened

The deploy's check died at its fifth step, the records' copy: its own tool, `jq`, refused one argument ("Argument list too long", exit 126), because the bucket's listing was passed whole as one argument and Linux allows one argument 128 KiB. Ridge itself answered on the new code; the check could not read the copy. Litestream's retention is off (`ops/litestream.yml#L9-L10`), so the listing grows until the bucket's own seven-day expiry, and the check outgrew its tool.

## What changed

`copy_problems` in `ops/lib.sh#L718` now sends the listing to `jq` on stdin and reads it with `input`. One new row in `ops/test.sh` builds a listing past 1 MiB and expects it read, and sound.

## What was rejected

Nothing was weighed against the stdin read. Two Lows from the second model's read are deferred: items 521 and 522.

## What remains the human's

The push, so the deploy's check runs on ridge. Its steps 5 to 8 (the copy, the copy's lag, the API collection, layer four, the address reads) have not run since the red and are read again from that run.

## Evidence

- Base `54440edb`; fix `f16c89b7`, then `pre-merge` taken in.
- No look is open on this piece.
- Not checked: the deploy's check on ridge with the fix; the real bucket's object count.
