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
