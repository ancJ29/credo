# Open items

Numbered, never renumbered; an entry is deleted when done
([documentation](conventions/documentation.md)).

## 1. A client's box that stops reaches no one — *parked* until a review (the architecture plan, 2026-10-27)

The old app counted each 5xx in its Lambda logs and posted it to a chat channel. With the BFF on the
box, something must watch the box and the BFF before the first client goes live; where an alert
lands is the human's (production).

## 2. The traffic assumption and the nano's memory are unmeasured — *parked* until a review (the architecture plan, 2026-10-27)

The plan's costs rest on about 1 M BFF calls and 23 GB a client a month, and its box on a Node BFF
and c-storage holding in a `t4g.nano` with swap. The nano is read first, on the first box: its
memory and any OOM kill; a micro if it does not hold. The traffic is read in the first client's
first month, on CloudFront's usage report.
