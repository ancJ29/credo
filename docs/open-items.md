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

## 6. The nightly backup and its restore — the machine writes it, the human runs it; waits for a signed client (the architecture plan, 2026-10-27)

The box's role may only put, so it cannot restore itself: the restore runs from the human's
terminal under the human's AWS session, reads a version from S3, and sends it to the box over the
Instance Connect tunnel.

The backup's copy goes through SQLite's own backup (`VACUUM INTO`, or the shell's `.backup`), or
is taken with the service stopped: a plain tarball taken mid-write can miss saves or hold a torn
file ([the c-storage memo](memo/c-storage.md#the-file-is-the-only-copy)).

## 7. The first box needs c-storage's listener on its private address, not loopback — the machine; waits for a signed client (the app frame plan, 2026-10-27)

c-storage binds `127.0.0.1` only (`Listen` in `c-storage/internal/server/server.go`,
`TestListenBindsLoopbackOnly`). The architecture puts the BFF in a Lambda that calls the box's
private address ([the architecture](plans/2026-10-27-architecture.md)), which a loopback listener
never answers. Before the first box: the bind address becomes configuration (the private address,
never every interface), with its test, alongside open item 5's arm64 build. The local stack keeps
loopback.

## 8. Two places start c-storage — the machine; *parked* until a third caller (the app frame plan, step 6, 2026-10-28)

`bff/tests/c-storage.ts` (the route tests) and `scripts/src/processes.ts` with `scripts/src/stack.ts`
(`pnpm stack`) each build and start the real c-storage on a free port, with the same keys and the
same health wait. They differ in what they need: the tests retry a port taken between the probe
and the bind and stop at the process's exit; the stack logs to a file and reports a child that
exited. A shared helper would make `bff` or `scripts` depend on the other for test code. Join them
when a third caller appears, in a package both already depend on.

## 9. A free port can be taken before the child binds it — the machine; *parked* until it bites (the app frame plan, step 6, 2026-10-28)

`pnpm stack` asks for a free port, then starts c-storage and the BFF on it. Another process taking
the port in between makes the child exit, and the stack stops naming the child and the end of its
log; running it again is the remedy. The route tests retry on another port. *Trigger:* a second
`pnpm stack` failing this way, when it retries too.

## 10. Two places inline a Vite build into one HTML file — the machine; *parked* until a third caller (the visual report plan, step 4, 2026-10-28)

`ui/vite.mock.config.ts` (a plugin, for `pnpm mock`) and `visual/src/build.ts` (`onePage`, for
`pnpm report`) each fold Vite's script and styles into the one HTML file a browser opens from
`file://`, with the same two patterns. They differ in where they run: the plugin inside the
bundle's own write, `onePage` on the in-memory output so it can add the report's data. A shared
helper would make `visual` depend on `ui`'s config, or `ui` on `visual`. Join them when a third
page needs it, in a package both already depend on, or when Vite changes the tags it emits and the
two patterns must be fixed twice.
