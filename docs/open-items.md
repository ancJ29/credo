# Open items

Numbered, never renumbered; an entry is deleted when done
([documentation](conventions/documentation.md)).

## 1. A client's server that stops reaches no one — the machine proposes, the human places the alert; waits for a signed client (the architecture plan, 2026-10-27)

The old app counted each 5xx in its Lambda logs and posted it to a chat channel. Before the first
client goes live, something must watch the BFF and the box; the machine proposes what watches,
and where an alert lands is the human's (production).

## 2. The plan's assumptions are unmeasured — *parked* until a review (the architecture plan, 2026-10-27)

Its costs rest on about 1 M BFF calls, 23 GB and 100 ms of Lambda a call, per client a month, and
its box on c-storage holding in a `t4g.nano` with swap. The nano is read on the first box: its
memory and any OOM kill. The rest is read on the first client's first bill, with whether the BFF's
answers to CloudFront are billed.

## 3. The demo's language — *parked* until the first feature's plan (the big picture, 2026-10-27)

The 11-04 screenshots and video come from the demo, and the old app's screens came in English
and Vietnamese. Which one the demo shows, or both, is the human's call, at the first feature's
plan, since it decides each walk's words.

## 4. The network's and a client's YAML templates — the machine writes, the human runs; waits for a signed client (the architecture plan, 2026-10-27)

Hand-written CloudFormation, shipped through change sets, in Malaysia: the shared network (one VPC
with no internet gateway, its S3 gateway endpoint, its Instance Connect Endpoint) and a client's
stack (subnet, function, box, buckets, distribution), with the ACM certificate requested in
`us-east-1` and the client's name in Cloudflare.

## 5. The arm64 builds and how each release lands — the machine; waits for a signed client (the architecture plan, 2026-10-27)

c-storage's Go binary for arm64, sent to its box over the Instance Connect tunnel and run under
systemd; the BFF's function for arm64, its zip shipped through the template.

## 6. The nightly backup's restore — the machine writes it, the human runs it; waits for a signed client (the architecture plan, 2026-10-27)

The box's role may only put, so it cannot restore itself: the restore runs from the human's
terminal under the human's AWS session, reads a version from S3, and sends it to the box over the
Instance Connect tunnel.

## 7. The first box needs c-storage's listener on its private address, not loopback — the machine; waits for a signed client (the app frame plan, 2026-10-27)

c-storage binds `127.0.0.1` only (`Listen` in `c-storage/internal/server/server.go`,
`TestListenBindsLoopbackOnly`). The architecture puts the BFF in a Lambda that calls the box's
private address ([the architecture](plans/2026-10-27-architecture.md)), which a loopback listener
never answers. Before the first box: the bind address becomes configuration (the private address,
never every interface), with its test, alongside open item 5's arm64 build. The local stack keeps
loopback.
