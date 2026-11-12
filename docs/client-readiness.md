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
>
> **Read "a client's stack" below as the first stack that holds a real tenant's data.** The page was
> written when each client was to have a stack of its own; since 2026-11-11 the shape intended for
> production, and not built, pools tenants on boxes in one stack per environment
> ([how a call finds its tenant's box](architecture-detail.md#how-a-call-finds-its-tenants-box)).
> The page was not re-read against that shape.

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
[`clients-delete.route.test.ts#L248`](../bff/src/routes/clients-delete.route.test.ts#L248) and
[`operator-root-password.route.test.ts#L245`](../bff/src/routes/operator-root-password.route.test.ts#L245).

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

What the item did not say is what the box's disk did. As of `0f7d69c1` (`main` before the piece) the root volume holding that file
carried `DeleteOnTermination: true`, with no `DeletionPolicy` and no snapshot (the device is now at
[`ops/env.yml#L122-L128`](../ops/env.yml#L122)). So anything that terminated or replaced the instance took every
record with it, permanently: a stack delete, or an image or instance-type change taken with `--take Box`. The
advice printed on a stack left in `ROLLBACK_COMPLETE`, "delete the stack" (`ops/lib.sh#L294` at `0f7d69c1`),
looked like a third way, but it never was one: that status exists only after a failed creation, so such a stack
never held records.

As of `main` after the backup-policy piece, **the template** says `Box` carries `DeletionPolicy: RetainExceptOnCreate` and
`UpdateReplacePolicy: Retain`, and the disk `DeleteOnTermination: false`, so a stack
delete and a replacement would leave the box and a termination would leave the disk. That is true of
the template and of ridge, where it was applied on 2026-11-08 at 17:10 and read off the running box
afterwards (the same instance, launched 2026-10-28, its root device `Keep: false`, no unattached
volume; the project's logs folder, `logs/20261108-1715-ridge-box-fence-receipt.log`), and a
client's stack made from `main` takes it at creation. Nothing else changed: there is still no copy of any client's
records, and no one has read a kept disk ([open item 6](open-items.md)). The change set
was run on ridge as `ops/stack.sh env ridge --plan` on 2026-11-08 at 16:44 and the guard refused it
(`Modify Box` at `replacement=Conditional`, the property's class, not a verdict; the reason is in
[the memo](plans/2026-11-08-backup-policy-conditional-memo.md)); it was then re-run with `--take Box`
at 17:10, ended `== exit 0`, and the box was not replaced (`logs/2026-11-08-171042-stack-ridge.log`).

One thing stands in front of it, and it is a good one: a change set that removes or replaces any
resource is refused by default and must be named by logical id to proceed
([`ops/unsafe-changes.jq#L7-L9`](../ops/unsafe-changes.jq#L7), the guard step in
[`ops/stack.sh`](../ops/stack.sh)). Before the backup-policy piece its comment said why — "a replaced box
deletes its disk and the database with it" — and it now says the box is kept on a replacement but the new
one comes up with an empty database (`#L4-L6`). On 2026-11-08 at 16:44 that guard refused the
backup-policy change set on ridge, which it was built to do; passing it took `--take Box` at 17:10
([the memo](plans/2026-11-08-backup-policy-conditional-memo.md) has the reasoning), and behind the guard there is only the
fence's kept box.

### The tree guard: every deployed path is compared

Every script that acts under an AWS session first refuses unless the tree here is as reviewed:
`main_synced` in [`ops/lib.sh`](../ops/lib.sh) calls `ops_match_main`, which compares every path
`ci.yml`'s push trigger deploys on, read from the base's own `ci.yml`, plus the root `.gitignore`,
with `origin/main` by hand or with the checked-out commit in the deploy job. That covers
`scripts/`, which `ridge_cli` runs, so an uncommitted edit there is refused before any act. This
was open item 130, fixed in the tree guard ([its recap](recaps/2026-11-07-tree-guard.md)); the
first read of this page found the guard comparing `ops/` alone.

What the guard does not cover is the environment a script is given, which the next section does.

### A client's stack is operable, with its limits

Each script that reaches an environment says its answer first, by `refuse_real` or `real_ok` in
[`ops/lib.sh`](../ops/lib.sh), and the list is one page, [`ops/README.md`](../ops/README.md#on-production).
Production is every environment not listed in `INVENTED_ENVS` there (today `ridge` alone), so a
client's stack, whatever it is called, meets the rules below.

- **Works as it is:** `stack.sh` (a change set shown first, a removal or replacement refused
  unless named), `release.sh` and `app.sh` (main's commits alone, never backwards) and
  `operator.sh` (production's first operator comes from it).
- **Only reads:** `check.sh`. On a client's stack it copies no key off the box, writes no Bruno
  file, runs no collection and makes no test client; it keeps every AWS read, the box's facts,
  `/health`, layer four's reads and the six reads through the app's address that need no client.
  A save is proved by ridge's full check on the same commit first. This closed open item 131.
- **Refuse:** `drill.sh` (it kills the store and reboots the box; ridge's drill proves the same
  template and unit), `tunnel.sh`, `seed.sh` and `root-password.sh`, each in its own words.
- **Not done:** **a client's root password still cannot be set from a terminal.** The only path
  is the console's own route, which needs a live operator session and a fresh passkey touch
  (`bff/src/routes/root-password.ts`). If that client's BFF is broken, there is no way to set
  one. Open item 132 keeps this alone: it is a missing tool, not a missing guard.

### Two logs record a call, both on ridge, and nothing slows a guess

The API in front of the BFF answers anyone, which the template states in its own words: one
catch-all route, one stage, 10 requests a second with bursts of 50, "The API's own address
answers anyone; the throttle bounds what that costs"
([`ops/env.yml#L251`](../ops/env.yml#L251), the stage at
[`#L275-L286`](../ops/env.yml#L275)). That the address is reachable is recorded, with its history,
as [open item 121](open-items.md): nobody decided it, it followed from the Region not offering
Lambda function URLs, and it is parked until a client signs. Read "answers anyone" as *reachable*,
not *unauthenticated* — a call arriving that way still meets the client header, the session and the
permission check.

What is worth adding to that item is the cost of the half of it nobody parked. Nothing slows a
guess at a password: the sign-in routes and one's own password route answer every try, and on ridge
the stage's throttle is the only brake ([open item 28](open-items.md), which the owner already
placed before a client's own stack). **Two trails record a call, and they are not the same age.**
*The older one has been there all along:* the function writes a line per request to
`/aws/lambda/credo-${Env}-bff`, because `bff/src/lambda-main.ts#L3` passes only `process.env`, `bff/src/lambda.ts#L10` defaults
`options` to an empty object and hands it on (`#L12`), so `bff/src/server.ts`'s `logger = true` stands and `app.ts#L86` builds Fastify with it, and the function's
`LoggingConfig` names that group ([`ops/env.yml#L232-L233`](../ops/env.yml#L232)). An earlier
version of this page said a guessing run would leave no trace at all; that was wrong when it was
written. What this page has not verified is what a Fastify request line holds (read as: a method,
a path and an answer, not checked here) or whether the adapter gives Fastify a remote address at
all; that would need a run. What is settled, in the direction of no: Fastify is built with no
`trustProxy` (none in `bff/src`), so the function's trail cannot recover the end user's address
from a forwarded header, and neither trail is known to hold it for a call through the distribution. *The newer one is in the template and on ridge:* the stage's access log, one
JSON line a call with the time, the address of whoever opened the connection, the path and the answer, into
`/aws/apigateway/credo-${Env}` for 14 days (`ApiLogs`, [`ops/env.yml#L176-L181`](../ops/env.yml#L176),
[`#L284-L286`](../ops/env.yml#L284)). **Measured, 2026-11-08 18:11 on ridge: for a call through the
distribution the line recorded one public address, outside AWS's published ranges (the
orchestrating session's check of that date, not re-run) and consistent with the caller's own, not an
edge node.** It was written here as CloudFront's, on the reading that the field is the immediate TCP
connection and the template makes the API a CloudFront origin (`ops/env.yml#L388`); that was
reasoning and the run disagrees with it. Why is not established (item 157). It is live on ridge: the change set ran green there on 2026-11-08 at 17:10 (the project's logs folder, `logs/2026-11-08-171042-stack-ridge.log`), and three lines were read back from the log group at 18:12, each with all ten fields of the stage's format (`logs/20261108-1809-ridge-access-log-read.log`). With nothing watching the
server ([open item 1](open-items.md)), **a guessing run against a real client would leave lines
in the function's log that someone could read afterwards, and nobody is told to read them.
Requests the stage's throttle refuses are answered 429 by API Gateway and never reach the function,
so they leave nothing in the function's log and appear only in the stage's log, which is what this
piece adds and what is now on ridge.** The
sign-in limit and the watching are each accepted on their own; together they mean the record
exists and a person has to think to look. Neither trail says whose records were read, since the
client's code is in a header the stage's format cannot name ([open item 152](open-items.md)). The same is true of a read taken the other way: a person with the AWS
session can reach the box and the file, and nothing but the box's own journal says they did.

### Two touches bound to the operator, not to the client

The irreversible acts are well guarded at the door. Deleting a client needs a live operator session,
the client's code typed, and a fresh touch of the operator's own passkey, with every check made
before any write ([`bff/src/routes/clients-delete.ts#L43-L52`](../bff/src/routes/clients-delete.ts#L43)).

The touch, though, is bound to the operator and the act and **not to the client**: `confirmed` opens
the token with the operator's id as its only subject
([`bff/src/routes/operator-auth.ts#L266-L275`](../bff/src/routes/operator-auth.ts#L266),
[`challenge.ts#L42-L48`](../bff/src/calling/challenge.ts#L42)). So an unspent token minted on one client's
row would open on another client's route inside its five minutes.
[Open item 62](open-items.md) records exactly this shape for the root-password route; the delete is
the heavier act and is now named there too.

One thing behind that door is worth knowing even though it is intended. The first write removes the
index, and from that moment the client is out of the list and every session of it is refused; the
sweep then removes at most 200 records a press
([`bff/src/records/clients.ts#L112-L174`](../bff/src/records/clients.ts#L112)), and a press after the index is gone
resumes on the session alone, no touch needed
([`clients-delete.ts#L32-L33`](../bff/src/routes/clients-delete.ts#L32)). **If nobody presses again, the
records stay in the file for good, reachable by nothing.** `listClients` reads the index prefix
alone ([`clients.ts#L93-L94`](../bff/src/records/clients.ts#L93)), and nothing anywhere reads the deletion
record to list an unfinished deletion — its only two readers are inside `clients.ts` itself
([`#L67`](../bff/src/records/clients.ts#L67), [`#L145`](../bff/src/records/clients.ts#L145)). So "deleted whole" is
true of the door and not necessarily of the data. Open item 133.

### No rotation path for any of the four keys

The keys are made well. c-storage's internal key and super-admin key are 32 bytes from the kernel,
written root-only, and **a release never rewrites the file** — a release that found them changed
refuses (the step "the keys, made once" in [`ops/release.sh`](../ops/release.sh) and
`keys_unchanged` in [`ops/lib.sh`](../ops/lib.sh)). The BFF's own service code and access key are made
once the same way (the `bff.env` step of [`ops/app.sh`](../ops/app.sh)): "present, left as it is."

The consequence is that **nothing in `ops/` rotates any of the four.** There is no script, and the
two the BFF needs sit in the function's environment as plain variables
(`ops/app.sh` writes them through its `bff-env.json`), so anyone in the account who can read a function's
configuration reads them — the comment above `fn=$(aws lambda get-function-configuration` in `ops/check.sh`
says so, and the check reads only the fields it needs (`BFF_FN_QUERY` in `ops/lib.sh`), never the keys. Rotating by hand means editing the box's file, re-pushing the function's environment,
and re-registering the service; the order is not written down anywhere. Open item 134.

Masking itself is thorough: every run remembers each secret and searches its own log for it at the
end ([`ops/lib.sh#L118-L139`](../ops/lib.sh#L118)). Two known weaknesses in *how* it searches are
already recorded as [open item 50](open-items.md) — the keys reach `grep`'s argument list
([`#L122`](../ops/lib.sh#L122)) and the here-strings that read the box's key files
([`#L497-L498`](../ops/lib.sh#L497), [`#L702-L703`](../ops/lib.sh#L702)) are written to a temp file
by the Mac's bash 3.2.

### The deploy, and the only route back

The gate is four jobs and the deploy needs all four
(`.github/workflows/ci.yml`'s `deploy` job, its `needs`). The `app` job's cap was what
skipped two deploys, and its comment now says so: "25, not 15 … The cap was skipping deploys, not
catching a hang" (`.github/workflows/ci.yml`'s `app` job, the comment above its `timeout-minutes`).

A half-finished deploy leaves a client on a mixed version and **nothing rolls back**: the way back
is a revert pushed to main (the comment above the renames in [`ops/release.sh`](../ops/release.sh)). c-storage ships first
and only its renames are atomic (the one `box` command that follows that comment), so a failure before them
leaves the box running what it ran and a failure after leaves the new binary installed. The BFF's
description and environment are written *before* its code
(the `update-function-configuration` and `update-function-code` calls in [`ops/app.sh`](../ops/app.sh)), which is [open item 29](open-items.md): a stop
between the two leaves the new commit's name on old code, and the seed's own precondition then
passes against a BFF a commit behind (`fn_commit` in [`ops/seed.sh`](../ops/seed.sh)). The UI is safer
than it looks — assets go first and `index.html` last
(the step "the UI's files, index.html last" in [`ops/app.sh`](../ops/app.sh)) and the deploy role cannot delete from the bucket
([`ops/env.yml#L425-L428`](../ops/env.yml#L425)) — so a stop leaves the old app whole.

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
2. **The tree guard widened: done.** `ops_match_main` covers every deployed path, `scripts/`
   included (open item 130, fixed).
3. **A client-stack mode, or a refusal, on `check.sh` and `drill.sh`: done.** The check only reads
   there and the drill refuses (open item 131, closed). What remains is a terminal path to a
   client's root password (open item 132): hours, and a missing tool.
4. **The sign-in limit (item 28).** The owner's to place; a short piece. Without it the stage's
   throttle is the only brake on a guess. *The access log that used to share this entry is split
   off:* it is the machine's, written into the template and awaiting the change set on ridge
   (`docs/plans/2026-11-08-access-log.md`), and it is the readable half of item 121. With the
   function's own request lines it is what turns "nothing bad has happened" into something a
   person can check.
5. **The two touches bound to the client's code, and an unfinished deletion readable somewhere an
   operator can see it.** A small piece.
6. **A signed origin, a key or a WAF in front of the API (item 121).** Last of the six: it buys a
   wall, while the five above buy recoverability, which is what "a real client" actually asks for.

### What this half verified first-hand, and what it did not

- **Read whole, first-hand:** `docs/open-items.md` (all 129 items), `docs/architecture.md`,
  `docs/products.md`, `ops/lib.sh`, `ops/check.sh`, `ops/release.sh`, `ops/app.sh`, `ops/seed.sh`,
  `ops/tunnel.sh`, `ops/root-password.sh`, `ops/operator.sh`, `ops/unsafe-changes.jq`,
  `.github/workflows/ci.yml`, `bff/src/routes/operator-auth.ts`, `bff/src/calling/challenge.ts`,
  `bff/src/records/clients.ts`, `bff/src/routes/clients-delete.ts`, `bff/src/routes/root-password.ts`,
  `scripts/src/ridge-main.ts`.
- **Read in part, at the lines cited and their neighbourhood:** `bff/src/app.ts` (the tenant and
  permission section), `shared/src/records.ts` (the key layout), `scripts/src/ridge.ts` (the
  command dispatch), `ops/env.yml` (the box, the API stage, the distribution, the deploy role),
  `ops/network.yml` (its resource list), `ops/stack.sh` (its header and the change-set steps),
  `ops/drill.sh` (its header), `services/c-storage/internal/auth/auth.go`.
- **Established by search rather than by reading the file:** that no record key is built outside
  `shared/src/records.ts` in product code; that only `tunnel.sh`, `root-password.sh` and `seed.sh`
  test the environment name; that only `seed.sh` and `root-password.sh` check the tree against
  `HEAD`; that nothing but `clients.ts` reads the client-deletion record; that every client-facing
  route carries the tenant guard. Each of those is a negative proved by a search over the whole
  tree, which is weaker than reading every file and stronger than an assumption — a file added
  after this page was written would not be in it.
- **Not read:** `ops/test.sh` (about 2,500 lines, the guards themselves), the rest of `services/c-storage/`'s
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

**The answer is no as well, and for a different reason than the other half's.** The product's spine
is real: one whole job runs from a telephone call to a photographed delivery and a driver's cash
settled, and it runs in two languages on a phone. What is missing is the ordinary day around that
spine. A clerk could not add a customer until 11-08 (now fixed), a confirmed order cannot be corrected, no price can be
set on a line, nothing older than a week can be found, and there is no report of any kind. Two to
three pieces of work stand between this and a first real client.

### A correction, first, because the wrong version has been said twice

**The order page's save route against real storage does exist.** It is
[`bff/src/routes/orders.ts#L280`](../bff/src/routes/orders.ts#L280), called from
[`ui/src/pages/client/OrderPage.tsx`](../ui/src/pages/client/OrderPage.tsx)'s `save`, and it has a screen of its own for the
conflict — `orders-8-conflict` in [`visual/src/walks.ts`](../visual/src/walks.ts), which drives the
fake with the cue `saveOrder:409`. Anyone told that the order page's write is unbuilt was told
wrong, and the reader who repeated it had been told it twice.

**The real gap is one line further down, and it is narrower and sharper.** The save refuses
anything that is not a draft: `found.order.state !== 'draft'` answers 409 with the order as it now
is ([`bff/src/routes/orders.ts#L290`](../bff/src/routes/orders.ts#L290)). So a draft is fully editable — customer,
lines, quantities — and a **confirmed** order is not editable at all. The only remedy is Cancel,
which also cancels the delivery request ([`#L356`](../bff/src/routes/orders.ts#L356)), and then making the
order again under a new number.

A second correction, to this reader's own first pass: the Import button on the customers and
products lists is **not** shown to someone who cannot use it. It is drawn only for the root
([`ui/src/pages/client/ListPage.tsx`](../ui/src/pages/client/ListPage.tsx)'s `ListPage`). That is tidier than reported and it makes
the gap below worse, not better: a clerk sees no way in at all, not even a refused one.

### Three whole jobs that work end to end

Not features — jobs a client's person could finish on a Monday.

1. **An order can be taken, priced, confirmed to a named driver and a day, delivered with a photo,
   and the delivery proved to the office.** Created at
   [`bff/src/routes/orders.ts#L253`](../bff/src/routes/orders.ts#L253), a draft corrected at
   [`#L280`](../bff/src/routes/orders.ts#L280), confirmed or sent again at
   [`#L353-L354`](../bff/src/routes/orders.ts#L353), delivered by the driver with a photo at
   [`#L467`](../bff/src/routes/orders.ts#L467), and that photo read back by the office at
   [`#L421`](../bff/src/routes/orders.ts#L421). The screens exist for the wrong turns as well as the right
   ones — `orders-1` to `orders-12` and `driver-1` to `driver-6` in
   [`visual/src/walks.ts`](../visual/src/walks.ts) — which is what makes it a job and not a demo.
2. **A driver's day can be settled against the cash handed in and closed for good.**
   [`bff/src/routes/reconciliations.ts`](../bff/src/routes/reconciliations.ts), screens `reconcile-1` to
   `reconcile-8`.
3. **A company can be set up and staffed.** Departments, positions, people added one at a time or
   from Excel, photos, per-person rights, a person switched off when they leave and back on when
   they return, their own password, and the company's name, colour and three frame switches. The
   menu that governs it is [`ui/src/nav.ts#L27-L85`](../ui/src/nav.ts#L27); the screens are
   `admin-setup`, `setup-1` and `staff-1` to `staff-23`.

All of it is in Vietnamese and English on phone, tablet and PC, and a signed-in session lasts seven
days sliding ([`bff/src/calling/sessions.ts#L13`](../bff/src/calling/sessions.ts#L13)), so a driver signs in about
once a week rather than every morning.

### What a real business would hit in its first week

In the order they would meet it, not in order of how hard each is.

1. **Fixed 2026-11-08 (open item 135, [recap](recaps/2026-11-08-add-records.md)): a clerk with `orders.canEdit` now adds either from the list's Add button; the import is still the root's alone. As the page found it:** a clerk could not add a customer or a product. The only way a record enters either list
   is the Excel import, and the import is the root's alone:
   [`bff/src/routes/lists.ts#L141`](../bff/src/routes/lists.ts#L141) calls `mustBeRoot`, and
   [`ui/src/ClientApp.tsx#L393`](../ui/src/ClientApp.tsx#L393) says so in its own comment — "Only
   the root imports (case-table row 22): no permission allows it." There is no Add on either list
   page, and the Import button is drawn for the root only
   ([`ui/src/pages/client/ListPage.tsx`](../ui/src/pages/client/ListPage.tsx)'s `ListPage`), so a clerk sees no path whatsoever.
   **Day one:** a new customer telephones, and the order cannot be taken until the owner signs in
   and builds a spreadsheet. This was the one gap that blocked the first order.
2. **A confirmed order cannot be corrected** — the correction above, and the second thing a real
   office asks for, because a customer changes the quantity after the order is confirmed.
3. **No price can be set on an order.** A line is a product id and a quantity, and the price always
   comes from the product list — the schema says it in its own words, "never a price or a total"
   ([`shared/src/orders.ts#L130-L146`](../shared/src/orders.ts#L130)). So no discount, no
   customer-specific price, no delivery fee and no VAT line. The total must also be at least 1
   ([`#L108`](../shared/src/orders.ts#L108)), so a free replacement delivery cannot be recorded at
   all. This is a deliberate shape — it is what keeps a tampered total out of the store — and it
   becomes a gap the day a client sells at agreed prices rather than list prices. Open item 136.
4. **Nothing older than seven days can be found.** The orders route answers at most seven days
   ([`shared/src/orders.ts#L23`](../shared/src/orders.ts#L23),
   [`bff/src/routes/orders.ts#L218-L226`](../bff/src/routes/orders.ts#L218)), and the page's only way back is an
   "Earlier" button that adds one more week and re-reads every week again
   ([`ui/src/pages/client/OrdersPage.tsx`](../ui/src/pages/client/OrdersPage.tsx)'s `readWeeks` and
   `OrdersPage`, whose "Earlier" button adds the week). There is no search by number or by customer, no filter
   by state and no date to open at. Finding last month's order means pressing Earlier five times
   and reading a table.
5. **No report of any kind.** Eight pages, and not one of them is a total, a day's takings or a
   customer's history ([`ui/src/nav.ts#L27-L85`](../ui/src/nav.ts#L27)).
6. **Nothing sends email or SMS.** A search across `bff/src`, `ui/src`, `shared/src`, `ops` and
   `.github` for any mail or SMS sender returns nothing. "Sign in by email" means only that the
   email address may be typed where the code goes, against the same password
   ([`bff/src/app.ts#L251-L268`](../bff/src/app.ts#L251)). So there is no forgotten-password path
   for a staff member — the root types them a new one by hand — and **none at all for the root**:
   only an operator can set it, from our console.
7. **The app wears Adobe's logo on every page.** A client uploads its logo in Settings and sees it
   on the sign-in door ([`ui/src/pages/SignIn.tsx`](../ui/src/pages/SignIn.tsx)'s `SignInFrame`, which draws the client's logo), and then every page
   inside draws Tabler's `IconBrandAdobe`, hard-coded
   ([`ui/src/frame/Shell.tsx`](../ui/src/frame/Shell.tsx)'s `Shell`, which draws the `IconBrandAdobe` icon). Already
   [open items 76 and 103](open-items.md); it is listed here because it is the first thing the
   client sees and the cheapest thing on this page to fix.
8. **No stock and no goods receipts.** A product carries a flag saying its stock is kept
   ([`shared/src/lists.ts#L31`](../shared/src/lists.ts#L31)) and there is nothing behind the flag,
   which [`products.md`](products.md) states plainly.

### What exists but is thin — the deferred items that would bite a paying client

`docs/open-items.md` is the right index for this, and most of its deferred entries are untidiness
that no client would ever meet. These are the ones that would reach a real business, and why. **None
of them is new; what is new is saying which ones cost a client money or a record.**

- **[Item 36](open-items.md), finding 5 — the money on the screen disagreed with the money to
  collect. Fixed on 2026-11-07** by the edit-an-order piece, and re-read in the code on 2026-11-08:
  a saved draft is drawn at its saved prices and a moved line is marked
  ([`ui/src/pages/client/OrderPage.tsx`](../ui/src/pages/client/OrderPage.tsx)'s `FormFields`), so the page's total and the
  request's agree. Kept here only so nobody fixes it twice.
- **[Item 41](open-items.md), finding 2 — two closes of one driver's day cannot overwrite each
  other's cash, and a test now holds it.** The close writes with a precondition
  ([`bff/src/routes/reconciliations.ts#L41`](../bff/src/routes/reconciliations.ts#L41) passes `null`, which
  c-storage sends as `if-none-match: *`); it was always there, but nothing held it: removing it left
  all fourteen tests green. A rival-close case (2026-11-08) now goes red without it.
- **[Item 41](open-items.md), finding 7 — a cash close recorded against the root instead of the
  person who closed it. Fixed on 2026-11-08.** It was a race only: the closer's staff record had to
  go between the sign-in and the close. The closer is now read before anything is written, and a
  person who is gone is refused with nothing cancelled and nothing stored.
- **[Item 41](open-items.md), finding 5 — a close that stops part way** leaves the page showing
  requests it has already cancelled, and the retry's words blame a delivery that never happened.
  The person is standing at the cash desk when they read it.
- **[Items 36 and 39](open-items.md), findings 3 and 2 — a cancel racing a delivery leaves a
  cancelled order beside a delivered request with a photo**
  ([`bff/src/routes/orders.ts#L341-L347`](../bff/src/routes/orders.ts#L341),
  [`#L362-L365`](../bff/src/routes/orders.ts#L362)). Goods left the yard and the books say cancelled. It
  needs two people acting in the same seconds, which a busy office supplies.
- **[Item 39](open-items.md), finding 4 — the driver's phone says "Not sent" for a delivery that
  did land** ([`bff/src/routes/orders.ts#L473-L483`](../bff/src/routes/orders.ts#L473)), so the driver
  photographs it a second time while the office already reads it delivered.
- **[Item 61](open-items.md) — the root's new password door can lie.** If c-storage saves but its
  answer misses the five-second timeout, the page says the password is as it was, while the root has
  been signed out and now holds the new one
  ([`bff/src/routes/root-password.ts#L50`](../bff/src/routes/root-password.ts#L50)). The item's own trigger is
  "the first client's root" — which is the day a client signs.
- **[Item 62](open-items.md) — an operator's passkey touch is not bound to the client**, so a touch
  minted on one client's row opens another client's route inside its five minutes. The other half of
  this page widened the item to the delete as well; on the product side it means the root password
  of the wrong company can be reset by an operator working quickly in two tabs.
- **The reds that are not defects.** [Items 56, 112, 113 and 114](open-items.md): `ui` and `visual`
  tests time out under load in files a change never touched. The gate can read red with nothing
  wrong, which means every receipt about the product takes longer to trust — and, as the other half
  says, the only route to a fix for a client runs through that gate.

What flatters the product in a demo, specifically: the demo data has one note-bearing customer and
one without ([open item 100](open-items.md)), seven days of orders is exactly what the demo shows,
and every price in the demo is stable for the length of a presentation — so findings 5 above and the
seven-day list are invisible in every walk and every screenshot taken so far.

### What is there only for us, and whether it could reach a client

**This is the good news in this half, and it is good news because it is held by tests rather than by
care.**

- **The fake server and its invented company are compiled out of the deployed bundle, and a test
  proves it.** [`ui/src/main.tsx#L14-L16`](../ui/src/main.tsx#L14) gates the fake on a build mode
  that is a constant, so the bundler drops it; and
  [`scripts/src/fake.test.ts#L42-L58`](../scripts/src/fake.test.ts#L42) builds *both* bundles in one
  test and asserts the served one holds none of `fake.session`, `Minh Phát`, `fake-credential` or
  `demo-join-link` — the fake's own handle, the invented company's name, the fake authenticator's
  credential and the invited operator's link. [`ops/app.sh`](../ops/app.sh) uploads
  `dist/app` (its `ui=` assignments); the fake builds to `dist/fake`, a folder of its own.
- **The demo seed cannot run anywhere but ridge, and the refusal carries its reason.**
  [`ops/seed.sh`](../ops/seed.sh)'s `refuse_real` — "seed.sh seeds ridge alone: a client's stack must never
  receive demo data". It also makes no client and no password, which its header says in its own
  words.
- **No seeded root password exists anywhere.** A new client's root gets a freshly minted random
  password, shown once ([`bff/src/records/clients.ts#L70-L83`](../bff/src/records/clients.ts#L70)). The demo copies'
  passwords are typed by hand into `ops/root-password.sh` and never printed.
- **The BFF carries no test switch and no demo mode.** Its whole environment is c-storage's four
  variables and the app's origin, every one required
  ([`bff/src/env.ts#L4-L26`](../bff/src/env.ts#L4)).
- **The local stack's unauthenticated seed door** ([open item 18](open-items.md)) lives in the
  `scripts` package, which is not deployed; the deployed BFF is bundled from `bff/src/lambda-main.ts`.

So **a real client's stack would carry no demo clients, no demo orders and no seeded password.** One
thing does reach a deployment, and the other half of this page files it: the deploy check makes a
real client in the stack it checks and deletes it on the way out, but only on ridge: on a
client's own stack the check makes no client (`ops/check.sh` takes its reads-only branch there, the
step "through the app's address, as a partner reaches it"), so nothing is written into the client's
records. On ridge a failed delete leaves the client listed behind a `WARN` nothing reads (the next
deploy's sweep clears it once it is two hours old; [open item 159](open-items.md)).

### What must be true before a real client's data goes in

In the order a client would meet the lack, with rough sizes. Nothing here is a plan — each is the
shape of the piece, not its steps.

1. **Done 2026-11-08: add a customer and a product from the page, under the orders right.** One form each over the
   add path the import already uses; it was the only thing on this list that blocked
   the very first order. Open item 135, closed.
2. **Done 2026-11-08: the money defects.** Item 36 finding 5 had been fixed the day before; item 41
   finding 2's precondition was already in the code and is now held by a test; item 41 finding 7
   is fixed. Only item 41 finding 5's page-side reload remains, deliberately.
3. **Correcting a confirmed order** — a decision about what "correct" means when a driver already
   holds the request, then about a day. Today it is Cancel and re-make under a new number
   ([`bff/src/routes/orders.ts#L290`](../bff/src/routes/orders.ts#L290), [`#L356`](../bff/src/routes/orders.ts#L356)).
4. **The client's own logo in the header** ([items 76 and 103](open-items.md)). An hour, and it is
   the first thing the client sees every time they sign in.
5. **Finding an order: a search by number or customer, and a day to open at.** Half a day to a day
   for the page; a span longer than a few weeks needs an index, which [item 35](open-items.md)
   already notes. Open item 137.
6. **A password a staff member can be given back without the owner guessing, and the root-password
   door that lies** ([item 61](open-items.md)). Half a day. Open item 139 holds the wider lack: no
   mail or message leaves this system at all.
7. **One report** — a day's or a customer's totals. About a day. A real business asks in its first
   week, but it can run a month without it, which is why it is last. Open item 138.

Not on this list because they belong to the other half: a client's own stack, the backup, the API's
open address, deploys and recovery. One of that half's items is worth naming here because a product
reader will reach for it — the sign-in's missing limit on wrong passwords
([item 28](open-items.md)) — and its own parking note says "before the first client's own stack",
which is now.

### What this half verified first-hand, and what it did not

- **Read whole, first-hand:** `docs/open-items.md` (all 129 items as they stood at `760d434f`, plus
  130 to 134 as the other half filed them), `docs/products.md`, `ui/src/nav.ts`,
  `shared/src/permissions.ts`, `shared/src/lists.ts`, `bff/src/env.ts`, `ui/src/pages/client/OrdersPage.tsx`,
  `ops/seed.sh`'s guard section, this week's recaps in `docs/recaps/` by their headings and the two
  edit recaps in full.
- **Read in part, at the lines cited and their neighbourhood:** `bff/src/routes/orders.ts` (the list,
  create, save, confirm and cancel routes and the deliver route's result handling),
  `bff/src/routes/lists.ts` (the four routes and their permission calls), `bff/src/app.ts` (the sign-in and
  QR routes), `bff/src/records/clients.ts` (the client's creation), `bff/src/calling/sessions.ts` (the lifetimes),
  `shared/src/orders.ts` (the schemas), `shared/src/signins.ts`, `ui/src/pages/client/OrderPage.tsx`,
  `ui/src/ClientApp.tsx` (its route table), `ui/src/pages/client/ListPage.tsx`, `ui/src/frame/Shell.tsx`,
  `ui/src/pages/SignIn.tsx`, `ui/src/pages/client/PersonPage.tsx` (its side panel and archive actions),
  `ui/src/parts/Settings.tsx` (the logo chooser), `ui/src/main.tsx`, `scripts/src/fake.test.ts`,
  `ops/check.sh` (the client it makes), `visual/src/walks.ts` (its screen list, by id).
- **Established by search rather than by reading the file:** that nothing in the product sends mail
  or an SMS; that no route adds a customer or a product outside the root's import; that the BFF
  holds no environment switch that weakens a behaviour; that no page in the menu is a report. Each
  is a negative proved by a search over the whole tree — weaker than reading every file, stronger
  than an assumption, and a file added after this page was written would not be in it.
- **Not read:** `services/c-storage/`, all of `ops/` except the lines cited, every test file except
  `scripts/src/fake.test.ts` and the two tests cited by line, the walk specs themselves, and the
  Vietnamese and English word files. **No test, gate, walk or server was run for this half** — every
  claim here is read from the code, so what a person would actually *see* on a screen is asserted
  only where a walk's screen name or a cited test stands behind it. In particular this half did not
  run the app, so nothing here is evidence about speed, about how a page reads on a real phone, or
  about any defect that only a browser shows.
- **Where a document and the code disagreed:** three places, all corrected in the same change as
  this page. `products.md` said 10 Playwright walks where `walk/specs/` holds 12 and its own next
  row says twelve. Its known-gap list still said the console cannot add or remove operators, while
  rows B1 and B2 of the same page say both are in `main`. And
  [`recaps/2026-11-07-edit-customer.md`](recaps/2026-11-07-edit-customer.md) called the customer
  save "the first write anywhere in the new app", which was not true the day it was written — staff
  and settings had written since 10-28 and 10-30, and the orders' own save already used the shape
  that recap says the customer page invented.
