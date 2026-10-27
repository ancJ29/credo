# Open items

Numbered, never renumbered; an entry is deleted when done
([documentation](conventions/documentation.md)).

## 1. A client's server that stops reaches no one — *parked* until a review (the architecture plan, 2026-10-27)

The old app counted each 5xx in its Lambda logs and posted it to a chat channel. Before the first
client goes live, something must watch the BFF and the box; where an alert lands is the human's
(production).

## 2. The plan's assumptions are unmeasured — *parked* until a review (the architecture plan, 2026-10-27)

Its costs rest on about 1 M BFF calls, 23 GB and 100 ms of Lambda a call, per client a month, and
its box on c-storage holding in a `t4g.nano` with swap. The nano is read on the first box: its
memory and any OOM kill. The rest is read on the first client's first bill, with whether the BFF's
answers to CloudFront are billed.
