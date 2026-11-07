# Client readiness

> **Written** 2026-11-07, from a read of `main` at `760d434f`, re-checked against `ca8d1d0d`: no
> file cited below moved between the two. It answers one question — **can we say we are ready for a
> real client?** — in two halves. **Operations and safety** is what would happen to a real client's
> data and access, and what could not be recovered. **The product** is what the office can and
> cannot do. Every structural claim names the file that makes it true, so any sentence here can be
> followed to the code; what was not read first-hand is named at the end of each half. The pair to
> read beside it is [`architecture.md`](architecture.md), which says how the parts fit, and
> [`products.md`](products.md), which says what each part does for whom. Where a document and the
> code disagreed, the code was taken and the disagreement is written out.

## Operations and safety

**The answer is no, and the gap is not in the product.** The product's isolation holds. What is
missing is that a client's own stack cannot be operated or recovered, and the one copy of a
client's data can be destroyed by an ordinary change with nothing to restore from.

### The isolation holds, and it is enforced

This is the part that is better than it needs to be, and it is worth reading before the rest.

Every client-facing route runs `resolveTenant` before the body is read and before any session: the
client's code comes from a header, the one index record gives the minted id, and a code that is
malformed or unknown stops the call at a 400 or a 404 ([`bff/src/app.ts#L100-L107`](../bff/src/app.ts#L100)).
Every key is then built from that id through the layout's one home,
[`shared/src/records.ts#L25-L72`](../shared/src/records.ts#L25), and a tenant's sessions are its own
records, so a handle minted under one id names no session under another
([`app.ts#L88-L89`](../bff/src/app.ts#L88)). A search of the whole product for a record key built
by hand outside `records.ts` finds none — only test files assert the strings.

The honest caveat, which a newcomer must not get wrong: **c-storage has no idea what a tenant is.**
Its only isolation unit is the *service*, and the BFF is a single service holding every client
([`app.ts#L69`](../bff/src/app.ts#L69), [`architecture.md`](architecture.md)). Separation is a
string-prefix convention the BFF alone keeps, and c-storage would serve one client's record to
another client's request if the BFF built the wrong key. **No lint rule and no test forces a key
through `records.ts`** — the one-home property is held by convention and review, not by the gate.
What *is* held by tests is the behaviour at the route level: "serves the call of the client the code
names, and no other" ([`bff/src/tenants.route.test.ts#L96`](../bff/src/tenants.route.test.ts#L96)),
and "reaches one client only" in both
[`clients-delete.route.test.ts#L248`](../bff/src/clients-delete.route.test.ts#L248) and
[`operator-root-password.route.test.ts#L245`](../bff/src/operator-root-password.route.test.ts#L245).

So: correct today, proved at the routes, and structurally one careless key away. That is a
reasonable position for the product and a reason to keep the review habit, not a reason to wait.

### The one copy of the data, and the disk that goes with the box

This is the risk that cannot be recovered from, and it is larger than the item that records it.

A deployment's data is one SQLite file on one box
([`ops/c-storage.service#L20`](../ops/c-storage.service#L20)), and there is no backup: the nightly
copy and its restore are designed and deferred to a signed client, on the stated reasoning that
ridge holds no real records ([open item 6](open-items.md)). That is a documented deferral, not
something lost — the S3 gateway endpoint and the box's put-only role were named the same day and
simply do not exist yet ([`ops/env.yml#L93`](../ops/env.yml#L93) says "no instance role").

What the item does not say is what the box's disk does. The root volume holding that file carries
`DeleteOnTermination: true`, with no `DeletionPolicy` and no snapshot
([`ops/env.yml#L111-L117`](../ops/env.yml#L111)). So anything that terminates or replaces the
instance takes every record with it, permanently: a stack delete, an image or instance-type change
taken with `--take Box`, or the advice printed on a stack left in `ROLLBACK_COMPLETE` — "delete the
stack" ([`ops/lib.sh#L276`](../ops/lib.sh#L276)), which names no environment and would be read the
same way on a client's stack as on a fresh one.

One thing stands in front of it, and it is a good one: a change set that removes or replaces any
resource is refused by default and must be named by logical id to proceed
([`ops/unsafe-changes.jq#L6-L8`](../ops/unsafe-changes.jq#L6), the guard step in
[`ops/stack.sh`](../ops/stack.sh)). The refusal says in its own words why — "a replaced box deletes
its disk and the database with it". That guard is one `--take` away from being passed, and behind it
there is nothing.

### The tree guard: `ops/` alone is compared

Every script that acts under an AWS session first refuses unless `ops/` here is as reviewed —
equal to `origin/main`'s by hand, or to the checked-out commit in the deploy job
([`ops/lib.sh#L185-L198`](../ops/lib.sh#L185)). The comment above it says why: "so a script that
acts under the human's AWS session is always a reviewed one."

**It compares `ops/` and nothing else.** But several of those scripts run the product's own code
from the working copy: `ridge_cli` runs `scripts/src/ridge-main.ts` out of `scripts/`
([`ops/lib.sh#L612-L618`](../ops/lib.sh#L612)), and that package holds the client-delete command.
In `main` the command is safe — `untenant` refuses any code that is not the deploy check's own,
`check-<date>t<time>z` ([`scripts/src/ridge.ts#L126-L134`](../scripts/src/ridge.ts#L126)), and says
in its own comment that it has none of the console's gates. The gap is that nothing proves the
`scripts/` on disk is that `main`.

Two scripts close it for themselves, with a clean-tree check beside the `ops/` one:
[`ops/seed.sh#L41`](../ops/seed.sh#L41) and
[`ops/root-password.sh#L89`](../ops/root-password.sh#L89) both refuse a tree that differs from
`HEAD`, because "the write would run code /health cannot name". **Three do not:**
[`ops/check.sh`](../ops/check.sh) (which calls `untenant` from its cleanup, on every exit path
including a refusal — `#L36-L47` through [`ops/lib.sh#L106`](../ops/lib.sh#L106)),
[`ops/app.sh`](../ops/app.sh) and [`ops/operator.sh`](../ops/operator.sh). So an uncommitted edit
under `scripts/`, or a worktree sitting on a branch, runs against whatever environment the script
is given, with the box's keys, and nothing refuses it. Open item 130.

### A client's stack is deployable, not operable

Two scripts refuse any environment but ridge and both say plainly that the refusal stands in for a
guard that does not exist yet. [`ops/tunnel.sh#L35-L36`](../ops/tunnel.sh#L35): "tunnel.sh holds
ridge alone for now: another stack's admin keys would land on this disk, and the collection would
write test records into it." [`ops/root-password.sh#L79`](../ops/root-password.sh#L79): "a client's
own stack is the console's, never this." A third refuses for a different reason —
[`ops/seed.sh#L36`](../ops/seed.sh#L36), "a client's stack must never receive demo data."

**The other six take any environment name.** `stack.sh`, `release.sh`, `app.sh`, `check.sh`,
`drill.sh` and `operator.sh` carry no such test. What that means today, on a client's stack:

- **Could be done.** The stack made and changed by change set ([`ops/stack.sh`](../ops/stack.sh)),
  c-storage released ([`ops/release.sh`](../ops/release.sh)), the BFF and the UI shipped
  ([`ops/app.sh`](../ops/app.sh)), the deploy check run ([`ops/check.sh`](../ops/check.sh)), the
  crash drill run — which kills c-storage and reboots the box
  ([`ops/drill.sh#L4-L7`](../ops/drill.sh#L4)) — and the operator made with a one-time join link,
  `--replace` being the documented way back from lost passkeys
  ([`ops/operator.sh#L6-L7`](../ops/operator.sh#L6)).
- **Could not be done.** A tunnel opened to look at the data with Bruno or curl, and demo data
  seeded, both refused by name. And **a client's root password cannot be set from a terminal at
  all**: the only path is the console's own route, which needs a live operator session and a fresh
  passkey touch ([`bff/src/root-password.ts#L41-L48`](../bff/src/root-password.ts#L41)). If that
  client's BFF is broken, there is no way to set one.

And `tunnel.sh`'s refusal is defeated by a script the deploy job itself runs. `ops/check.sh` opens
its own connection to the box on any environment ([`#L80`](../ops/check.sh#L80)), reads the box's
keys ([`#L114`](../ops/check.sh#L114)) and writes **the internal access key and the super-admin
key** into a file on the operator's own machine ([`#L120`](../ops/check.sh#L120) through
[`ops/lib.sh#L530-L552`](../ops/lib.sh#L530)) — exactly the two things `tunnel.sh#L36` refuses to do
for a client's stack. The file is 0600, git-ignored and removed at the run's end
([`ops/lib.sh#L107`](../ops/lib.sh#L107)), which is careful, and it is still the admin key of a
client's store on a laptop. The same script makes a client and signs in through the edge on every
run ([`#L165-L171`](../ops/check.sh#L165)), and each Bruno run leaves a service row behind
([`#L164`](../ops/check.sh#L164)). Open items 131 and 132.

### No access log, and nothing slows a guess

The API in front of the BFF answers anyone, which the template states in its own words: one
catch-all route, one stage, 10 requests a second with bursts of 50, "**No access log.** The API's
own address answers anyone; the throttle bounds what that costs"
([`ops/env.yml#L244`](../ops/env.yml#L244), the stage at
[`#L271-L275`](../ops/env.yml#L271)). That the address is reachable is recorded, with its history,
as [open item 121](open-items.md): nobody decided it, it followed from the Region not offering
Lambda function URLs, and it is parked until a client signs. Read "answers anyone" as *reachable*,
not *unauthenticated* — a call arriving that way still meets the client header, the session and the
permission check.

What is worth adding to that item is the cost of the half of it nobody parked. Nothing slows a
guess at a password: the sign-in routes and one's own password route answer every try, and on ridge
the stage's throttle is the only brake ([open item 28](open-items.md), which the owner already
placed before a client's own stack). With no access log and nothing watching the server
([open item 1](open-items.md)), **a guessing run against a real client would leave no trace anyone
could read afterwards.** The two items are each accepted on their own; together they mean there is
no record of who knocked. The same is true of a read taken the other way: a person with the AWS
session can reach the box and the file, and nothing but the box's own journal says they did.

### Two touches bound to the operator, not to the client

The irreversible acts are well guarded at the door. Deleting a client needs a live operator session,
the client's code typed, and a fresh touch of the operator's own passkey, with every check made
before any write ([`bff/src/clients-delete.ts#L43-L52`](../bff/src/clients-delete.ts#L43)).

The touch, though, is bound to the operator and the act and **not to the client**: `confirmed` opens
the token with the operator's id as its only subject
([`bff/src/operator-auth.ts#L266-L275`](../bff/src/operator-auth.ts#L266),
[`challenge.ts#L42-L48`](../bff/src/challenge.ts#L42)). So an unspent token minted on one client's
row would open on another client's route inside its five minutes.
[Open item 62](open-items.md) records exactly this shape for the root-password route; the delete is
the heavier act and is now named there too.

One thing behind that door is worth knowing even though it is intended. The first write removes the
index, and from that moment the client is out of the list and every session of it is refused; the
sweep then removes at most 200 records a press
([`bff/src/clients.ts#L112-L174`](../bff/src/clients.ts#L112)), and a press after the index is gone
resumes on the session alone, no touch needed
([`clients-delete.ts#L32-L33`](../bff/src/clients-delete.ts#L32)). **If nobody presses again, the
records stay in the file for good, reachable by nothing.** `listClients` reads the index prefix
alone ([`clients.ts#L93-L94`](../bff/src/clients.ts#L93)), and nothing anywhere reads the deletion
record to list an unfinished deletion — its only two readers are inside `clients.ts` itself
([`#L67`](../bff/src/clients.ts#L67), [`#L145`](../bff/src/clients.ts#L145)). So "deleted whole" is
true of the door and not necessarily of the data. Open item 133.

### No rotation path for any of the four keys

The keys are made well. c-storage's internal key and super-admin key are 32 bytes from the kernel,
written root-only, and **a release never rewrites the file** — a release that found them changed
refuses ([`ops/release.sh#L91-L109`](../ops/release.sh#L91),
[`ops/lib.sh#L487-L490`](../ops/lib.sh#L487)). The BFF's own service code and access key are made
once the same way ([`ops/app.sh#L99-L114`](../ops/app.sh#L99)): "present, left as it is."

The consequence is that **nothing in `ops/` rotates any of the four.** There is no script, and the
two the BFF needs sit in the function's environment as plain variables
([`ops/app.sh#L131-L137`](../ops/app.sh#L131)), so anyone in the account who can read a function's
configuration reads them — `ops/check.sh#L140` says so in its own comment while taking care not to
print them. Rotating by hand means editing the box's file, re-pushing the function's environment,
and re-registering the service; the order is not written down anywhere. Open item 134.

Masking itself is thorough: every run remembers each secret and searches its own log for it at the
end ([`ops/lib.sh#L118-L139`](../ops/lib.sh#L118)). Two known weaknesses in *how* it searches are
already recorded as [open item 50](open-items.md) — the keys reach `grep`'s argument list
([`#L122`](../ops/lib.sh#L122)) and the here-strings that read the box's key files
([`#L497-L498`](../ops/lib.sh#L497), [`#L702-L703`](../ops/lib.sh#L702)) are written to a temp file
by the Mac's bash 3.2.

### The deploy, and the only route back

The gate is four jobs and the deploy needs all four
([`.github/workflows/ci.yml#L216`](../.github/workflows/ci.yml#L216)). The `app` job's cap was what
skipped two deploys, and its comment now says so: "25, not 15 … The cap was skipping deploys, not
catching a hang" ([`#L117-L119`](../.github/workflows/ci.yml#L117)).

A half-finished deploy leaves a client on a mixed version and **nothing rolls back**: the way back
is a revert pushed to main ([`ops/release.sh#L116`](../ops/release.sh#L116)). c-storage ships first
and only its renames are atomic ([`#L117-L121`](../ops/release.sh#L117)), so a failure before them
leaves the box running what it ran and a failure after leaves the new binary installed. The BFF's
description and environment are written *before* its code
([`ops/app.sh#L135-L143`](../ops/app.sh#L135)), which is [open item 29](open-items.md): a stop
between the two leaves the new commit's name on old code, and the seed's own precondition then
passes against a BFF a commit behind ([`ops/seed.sh#L75-L76`](../ops/seed.sh#L75)). The UI is safer
than it looks — assets go first and `index.html` last
([`ops/app.sh#L152-L155`](../ops/app.sh#L152)) and the deploy role cannot delete from the bucket
([`ops/env.yml#L414-L417`](../ops/env.yml#L414)) — so a stop leaves the old app whole.

The sharper point for a client is the other direction. **The only route to a fix runs through a
gate that is known to go red under load with nothing broken**: items 27, 56, 112, 113 and 114 are
all open and all recurring. A client could sit on a bad version while a clean tree fails its gate
twice. That is not a new defect to file; it is what those five items cost once someone outside is
waiting.

### What must be true before a real client's data goes in

In order of risk, with rough sizes. Nothing here is a plan — each is the shape of the piece, not
its steps.

1. **A backup and a restore, and a deletion policy on the box's volume.** The one thing that cannot
   be recovered from. It is a network template change, an environment template change, a timer on
   the box and a restore script with its guards, and it ends in a human-run change set: a day's
   piece, not an afternoon.
2. **The tree guard widened.** Either `ops_match_main` covers `scripts/` as well, or `check.sh`,
   `app.sh` and `operator.sh` gain the clean-tree check `seed.sh` and `root-password.sh` already
   have: hours, and it is the only thing between an uncommitted edit and a real client's records.
3. **A client-stack mode, or a refusal, on `check.sh` and `drill.sh`, and a terminal path to a
   client's root password.** Hours each. Without them a client's stack is deployable but not
   operable, and one deploy check puts its admin key on a laptop.
4. **The sign-in limit (item 28) together with an access log on the one API stage.** A short piece,
   and the log half is nearly free. It is what turns "nothing bad has happened" into something a
   person can check.
5. **The two touches bound to the client's code, and an unfinished deletion readable somewhere an
   operator can see it.** A small piece.
6. **A signed origin, a key or a WAF in front of the API (item 121).** Last of the six: it buys a
   wall, while the five above buy recoverability, which is what "a real client" actually asks for.

### What this half verified first-hand, and what it did not

- **Read whole, first-hand:** `docs/open-items.md` (all 129 items), `docs/architecture.md`,
  `docs/products.md`, `ops/lib.sh`, `ops/check.sh`, `ops/release.sh`, `ops/app.sh`, `ops/seed.sh`,
  `ops/tunnel.sh`, `ops/root-password.sh`, `ops/operator.sh`, `ops/unsafe-changes.jq`,
  `.github/workflows/ci.yml`, `bff/src/operator-auth.ts`, `bff/src/challenge.ts`,
  `bff/src/clients.ts`, `bff/src/clients-delete.ts`, `bff/src/root-password.ts`,
  `scripts/src/ridge-main.ts`.
- **Read in part, at the lines cited and their neighbourhood:** `bff/src/app.ts` (the tenant and
  permission section), `shared/src/records.ts` (the key layout), `scripts/src/ridge.ts` (the
  command dispatch), `ops/env.yml` (the box, the API stage, the distribution, the deploy role),
  `ops/network.yml` (its resource list), `ops/stack.sh` (its header and the change-set steps),
  `ops/drill.sh` (its header), `c-storage/internal/auth/auth.go`.
- **Established by search rather than by reading the file:** that no record key is built outside
  `shared/src/records.ts` in product code; that only `tunnel.sh`, `root-password.sh` and `seed.sh`
  test the environment name; that only `seed.sh` and `root-password.sh` check the tree against
  `HEAD`; that nothing but `clients.ts` reads the client-deletion record; that every client-facing
  route carries the tenant guard. Each of those is a negative proved by a search over the whole
  tree, which is weaker than reading every file and stronger than an assumption — a file added
  after this page was written would not be in it.
- **Not read:** `ops/test.sh` (about 2,500 lines, the guards themselves), the rest of `c-storage/`'s
  Go sources, every test file except where a test is cited by line, all of `ui/src/`, and the
  Bruno collection. No test or gate was run for this page and no AWS or Cloudflare state was
  queried, so **what actually exists in the account today is outside what this half can say** — in
  particular whether the account holds snapshots, a budget alarm or any guardrail not expressed in
  the templates.
- **Where a document and the code disagreed:** `docs/products.md`'s client-delete row said "and
  everything it owns", which holds only if every press completes, and its `ops/` row listed the
  scripts as running on ridge without saying that only three of the nine refuse another
  environment. Both are corrected in `products.md` in the same change as this page. No claim in
  `architecture.md` was found to contradict the code.

## The product — what the office can and cannot do

> **Placeholder, to be written by the reader who looked at the product half.** Append below this
> line; nothing above it is yours to move. Keep the same habits: every structural claim with its
> `path#Lnn`, and a short statement at the end of what you read first-hand and what you did not.
