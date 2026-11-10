# How credo is built: the detail

> **This page is for a session, or an engineer, already inside the code and about to change
> something.** What the system is and how one request travels it is
> [`architecture.md`](architecture.md), which is read first and on its own.

Every section here answers a question a session has while changing something, and **carries the
file behind each claim**, so any sentence can be followed to the code. The root
[`CLAUDE.md`](../CLAUDE.md) asks a session for [`architecture.md`](architecture.md) and the one
section of this page that its piece touches; this page whole only when a piece crosses a layer.

## The codemap

Nine parts, and this is where to look for the thing that does X. **One line each on purpose: each
part's own internals — what belongs in it, the file to copy, its own rules — are in that part's own
`CLAUDE.md`, and are not restated here.** The last column is the point of the list: a part is only
understood once you know what stops without it. What each part is *for*, which is what a reader
needs before touching any of it, is on
[`architecture.md`](architecture.md#what-each-part-is-for).

| Part | The thing it does | Gone, this breaks |
| --- | --- | --- |
| `ui/` | every screen a person sees: the client app and the operator console, one bundle split by address | everything anyone sees, and the walks and the visual report with it |
| `bff/` | one Fastify app behind two entries, holding every rule: who is calling, what they may do, what a record's key is | every rule. c-storage enforces none of them |
| `shared/` | what the two halves agree on: the wire contract, the record layout, the permission catalogue, the bounds | the halves drift apart in silence |
| `c-storage/` | six HTTP routes over one SQLite file, in Go, with no framework and no router library | all data. Its file is the only copy |
| `audit-backbone/` | a second Go service, in this repository and called by nothing | nothing today ([the activity log](activity-log.md)) |
| `scripts/` | the local lanes — `pnpm stack`, `pnpm fake`, `pnpm demo` — and the steps the ops scripts hand to the product's own code | any way to run or seed anything locally, and the BFF's route tests |
| `visual/` | the walks page: the app's own screens drawn without a browser | the one artefact a non-coder judges a screen from |
| `walk/` | the browser walks: one spec a walk, every screen counted pixel by pixel | the end-to-end check |
| `ops/` | three hand-written CloudFormation templates and the shell scripts; every AWS call in the repository is made here | every way to a machine |

Six of the nine are in the pnpm workspace ([`pnpm-workspace.yaml`](../pnpm-workspace.yaml));
`c-storage/`, `audit-backbone/` and `ops/` are deliberately outside it. Two shapes are easy to miss:
the BFF is **one app with two entries**, not two back ends (`bff/src/server.ts`'s `buildBff` is
shared and only the listener differs), and the UI is **one bundle with two apps in it** — the
operator console is not a separate deployment, only the path it is opened at (`ui/src/App.tsx`'s
`isOperatorPath`).

## The data

**Where it lives.** One SQLite file per deployment, at the path the box's systemd unit names
(`ops/c-storage.service`'s `DB_PATH`), served by a unit that restarts the process whenever it stops
(`ops/c-storage.service`'s `Restart=always`), opened in WAL with
`_txlock=immediate` ([`c-storage/internal/sqlitedb/open.go#L33`](../c-storage/internal/sqlitedb/open.go#L33)).
The whole schema is two `STRICT` tables — `services(code, hashed_access_key)` and
`records(service_code, key, data)` — in
[`c-storage/internal/store/schema.sql#L4`](../c-storage/internal/store/schema.sql#L4). There are no
timestamps, no indexes beyond the primary keys and no migration chain: the schema is applied only
to a file with no tables, stamped `user_version = 1`, and a file at any other version stops the
process at start-up ([`open.go#L56`](../c-storage/internal/sqlitedb/open.go#L56)).

**What a tenant is — and where it is not.** A client is a tenant. Its records sit under its minted
id, and its human-readable code reaches that id through one index record; the layout has one home,
[`shared/src/records.ts#L7`](../shared/src/records.ts#L7), so no other file builds a key. Every
client-facing route runs `resolveTenant` first, which reads the code from a header, finds the index
record and sets `request.tenantId` — it *scopes and never authenticates*
([`bff/src/app.ts#L98`](../bff/src/app.ts#L98)).

The part a newcomer must not get wrong: **c-storage has no concept of a tenant at all.** Its only
isolation unit is the *service*, and the BFF is a single service holding every tenant
([`bff/src/app.ts#L69`](../bff/src/app.ts#L69)). Tenant separation is a string-prefix convention
held entirely by the BFF; c-storage would serve one tenant's key to another tenant's request if the
BFF built the wrong key. This is a deliberate design, not an oversight: `records.ts` says in its
own opening lines that it is the layout's one home, "so no other file builds a key"
([`shared/src/records.ts#L3`](../shared/src/records.ts#L3)). **Isolation itself is tested, at the
route level** — "serves the call of the client the code names, and no other"
([`bff/src/tenants.route.test.ts#L96`](../bff/src/tenants.route.test.ts#L96)), and "reaches one
client only" in both
[`clients-delete.route.test.ts#L248`](../bff/src/routes/clients-delete.route.test.ts#L248) and
[`operator-root-password.route.test.ts#L245`](../bff/src/routes/operator-root-password.route.test.ts#L245).
What is narrower than it looks is the *structural* guard: **no lint rule and no test forces every
key through `records.ts`**, so the one-home property is held by convention and review rather than
by the gate. No hand-built key exists outside that file today.

One home holds for the key *layout*, not for resolving a tenant: `resolveTenant` covers the
client-facing routes, while the operator's routes resolve a code to an id themselves
([`bff/src/routes/root-password.ts#L44`](../bff/src/routes/root-password.ts#L44), and `bff/src/records/clients.ts`).
Key design does real work here — a person's photo and a delivery's photo
deliberately sit outside their list's prefix so a list read never drags them in
([`records.ts#L47`](../shared/src/records.ts#L47), [`#L65`](../shared/src/records.ts#L65)), and
orders and deliveries are keyed by day because a prefix read answers at most 1,000 records
([`records.ts#L41`](../shared/src/records.ts#L41),
[`c-storage/internal/store/store.go#L132`](../c-storage/internal/store/store.go#L132)).

**How a record is written safely.** The version token is a `tag`: the hex SHA-256 of the record's
stored text, computed fresh on every read and stored nowhere
([`store.go#L54`](../c-storage/internal/store/store.go#L54)). A writer sends it back as `If-Match`
(or `If-None-Match: *` to claim a key that must not exist); c-storage compares inside the write's
own transaction and answers **412** if the record moved
([`store.go#L68`](../c-storage/internal/store/store.go#L68),
[`c-storage/internal/server/handlers.go#L132`](../c-storage/internal/server/handlers.go#L132)). A precondition
it cannot parse is a 400, never ignored — but a request sending *no* precondition overwrites
whatever is there, so the guard holds only where the BFF sends the tag.

The BFF's client turns 412 into the value `'moved'` rather than an error
([`shared/src/c-storage.ts#L133`](../shared/src/c-storage.ts#L133)), and **each route decides for
itself — there is no single shared recovery.** The fullest version, settled on 2026-11-07, is in
[`bff/src/routes/lists.ts#L176`](../bff/src/routes/lists.ts#L176): read the record for its tag, write over that
version, and on either a lost answer or a `moved` outcome **re-read once** — a record that already
holds exactly what was asked is our own write having landed, and counts as saved; anything else is
a genuine conflict, answered 409 with the record as it is now. The version is never skipped, which
is the project's standing rule: recover, never bypass, a concurrency token
([`CLAUDE.md`](../CLAUDE.md)).

That identity compare is load-bearing and conditional, and the comment at
[`bff/src/routes/lists.ts#L192`](../bff/src/routes/lists.ts#L192) is the one home of what it assumes: it holds
only while the record has no mutable field other than the ones being written. The day a
`changeCode`, an `archived` flag or an order's status joins a record saved this way, another
writer's record could pass as our own save. Read that comment before copying this pattern.

The other routes do not share it. [`bff/src/routes/reconciliations.ts#L37`](../bff/src/routes/reconciliations.ts#L37)
recovers a lost answer in its own narrower way — it claims the key with `If-None-Match` and, if the
write throws, re-reads and compares to tell its own landed write from another close already there —
while the staff setup's save answers 409 at once on a `moved`
([`bff/src/routes/staff.ts#L171`](../bff/src/routes/staff.ts#L171)) and the staff numbering instead **retries a
bounded number of times** and fails 503 if the record moved on every attempt
([`bff/src/routes/staff.ts#L264`](../bff/src/routes/staff.ts#L264)). Four writers, four behaviours — all of them
keeping the token, which is the rule; none of them a shared helper. Read the route you are changing
rather than assume `lists.ts`.

## Who may do what

**Two doors, two session kinds, one store.**

A client's person signs in with a code and a password; a root-given email and a 15-minute QR code
are second sign-in names for the same records
([`shared/src/signins.ts#L64`](../shared/src/signins.ts#L64)). Sessions are a handle the device
keeps: only the SHA-256 of its secret is stored, beside the device it was issued to and the
sign-in record's `generation` at issue, so giving a password invalidates every older session
([`shared/src/records.ts#L185`](../shared/src/records.ts#L185)). They slide over seven days
([`bff/src/calling/sessions.ts#L13`](../bff/src/calling/sessions.ts#L13)).

An **operator** — the people who run credo — signs in at `/operator` by passkey only, joining
through a one-time link, with `@simplewebauthn` on both sides. Every ceremony is checked against
`APP_ORIGIN`, the address the operator opens, **never the request's host**
([`bff/src/env.ts#L13`](../bff/src/env.ts#L13),
[`bff/src/routes/operator-auth.ts#L57`](../bff/src/routes/operator-auth.ts#L57)); spent challenges are kept so an
answer cannot be replayed, and an account's `generation` moves when a new-passkey link replaces the
keys held, refusing the sessions issued before it
([`shared/src/records.ts#L131`](../shared/src/records.ts#L131)). An operator session is capped at 12
hours from issue ([`bff/src/calling/sessions.ts#L18`](../bff/src/calling/sessions.ts#L18)). Sensitive acts ask for a
fresh passkey touch rather than trusting the session
([`shared/src/wire.ts#L322`](../shared/src/wire.ts#L322)).

**Permissions.** Eight named permissions, catalogued once
([`shared/src/permissions.ts#L9`](../shared/src/permissions.ts#L9)), resolved in three sparse layers
— department, then position, then the person's own, each winning where it names a permission; the
root holds no layer and may do everything
([`permissions.ts#L36`](../shared/src/permissions.ts#L36),
[`#L48`](../shared/src/permissions.ts#L48)). The layers are read on **every** call, so a change by
the root holds at the person's next step, and a set that cannot be read answers 503 rather than a
partial one ([`bff/src/app.ts#L116`](../bff/src/app.ts#L116)). The menu asks the same question to
decide what it shows, and says so in its own comment: it is a view of the guard, never the guard
([`ui/src/nav.ts#L24`](../ui/src/nav.ts#L24), checked server-side at
[`bff/src/app.ts#L184`](../bff/src/app.ts#L184)).

**And nobody is recorded as the actor.** The identity is resolved and then consumed: `signedIn` in
`bff/src/app.ts` returns who is calling and `mustCan` in `bff/src/app.ts` asks one boolean of it,
and neither binds it to the request — there is no `request.user` anywhere in `bff/src/` (zero hits,
against `request.tenantId`, which hits in `app.ts`, `lists.ts` and `orders.ts`). Measured over the
BFF's **39 deliberate write sites: 11 have the identity in scope at the write and 28 do not**, and
the two that write customers and products — the highest-value history there is — carry no actor at
all. **Nothing in this repository records who changed a record**, and that half of the gap is in no
open item ([the docs index](README.md)).

**Keys, and who holds which.** c-storage has three: `x-internal-access-key`, which gates every
route but `/health` including the 404 fallback, so an unknown path answers 401 exactly like a real
one; a per-service `x-access-key`, stored only as a SHA-256 and compared in constant time; and
`x-super-admin-key`, whose sole power is creating a service
([`c-storage/internal/auth/auth.go#L17`](../c-storage/internal/auth/auth.go#L17),
[`c-storage/internal/server/server.go#L59`](../c-storage/internal/server/server.go#L59),
[`c-storage/internal/store/store.go#L93`](../c-storage/internal/store/store.go#L93)). **The BFF never holds
the super-admin key** — registration is the stack's own step, done once
([`bff/src/env.ts#L39`](../bff/src/env.ts#L39),
[`scripts/src/register.ts#L10`](../scripts/src/register.ts#L10)). The rule, in `env.ts`'s own
words, is that the variables the BFF reads are "the only ones it is given": as a listener that is
seven — `PORT`, `HOST`, the four for c-storage and `APP_ORIGIN`, all supplied by the local stack
([`bff/src/env.ts#L21`](../bff/src/env.ts#L21),
[`scripts/src/stack.ts#L79`](../scripts/src/stack.ts#L79)) — and as a Lambda five, the same set
without the listener's two, since API Gateway is the listener
([`bff/src/env.ts#L48`](../bff/src/env.ts#L48)).

## How it reaches a machine

| Lane | How | What it is for |
| --- | --- | --- |
| Local | `pnpm stack` builds c-storage with `go build` and the UI with Vite, then runs both behind the local front; `pnpm stack -- <command>` is one invocation, up-command-down, because the sandbox cannot signal a process an earlier command started ([`scripts/src/stack.ts`](../scripts/src/stack.ts), [`CLAUDE.md`](../CLAUDE.md)) | the real stack, data gone on Ctrl-C |
| Local, no server | `pnpm fake` — the UI alone over invented data, the one build that holds `?fake` and the fake `Api`; the bundle that deploys contains none of it ([`ui/src/main.tsx#L10`](../ui/src/main.tsx#L10)) | a screen's look before its back end exists |
| ridge | the shared pre-production environment, and the only deployed one | others check a piece without the code |
| a client's own stack | **not built.** `ops/env.yml` is parameterised by `Env` and ridge is one instance of it; several scripts hard-refuse any environment but ridge ([`ops/seed.sh#L36`](../ops/seed.sh#L36)) | — |

**Stack shape is the human's; code is CI's.** Only [`ops/stack.sh`](../ops/stack.sh) touches
CloudFormation, and only through change sets — `create-change-set`, print every change, then
`execute-change-set` (`#L204`, `#L242`) — run by a human from a terminal, never by CI (`#L8`). A
change set that removes or replaces anything is **refused by default** and needs the human to name
the logical id, because a replaced box deletes its disk and the database with it
([`ops/unsafe-changes.jq#L5`](../ops/unsafe-changes.jq#L5), [`ops/stack.sh#L225`](../ops/stack.sh#L225)).
Templates are read from `origin/main`, not the working copy (`#L140`). There is no CDK, SAM or
Terraform anywhere.

**What CI does.** [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) holds five jobs: four
check jobs that run on every push and pull request — `check` (`make check` in c-storage, `#L56`),
`e2e` (its Bruno collection against the built binary, `#L73`), `app` (`pnpm check`, `#L115`) and
`ops` (ShellCheck at a pinned SHA-256 plus cfn-lint over the three templates, `#L153`) — and then,
on a push to `main` only, `deploy` (`#L215`) in the `ridge` GitHub environment. That job ships **code, never stack
shape** (`#L212`): c-storage's arm64 binary to the box over an Instance Connect tunnel
([`ops/release.sh`](../ops/release.sh)), the BFF bundle to the one Lambda and the UI files to the one
bucket ([`ops/app.sh`](../ops/app.sh)), then [`ops/check.sh`](../ops/check.sh) verifies it. All
third-party code builds *before* the AWS role is assumed (`#L254`), and the role itself is narrow
to the point of naming the one function and the one instance
([`ops/env.yml#L444`](../ops/env.yml#L444)). Two other workflows:
[`seed.yml`](../.github/workflows/seed.yml) brings ridge's demo copies up to yesterday when somebody runs it (it has no schedule), and
[`walks.yml`](../.github/workflows/walks.yml) deploys the walks page to Cloudflare Pages behind
Access — the only deploy target that is not AWS.

One hazard the split creates: a change set that updates the `Bff` resource can restore its inline
503 stub and empty environment, so the human re-runs the latest deploy afterwards
([`ops/env.yml#L218`](../ops/env.yml#L218), [`ops/README.md`](../ops/README.md)).

## How it is checked

Four things, and a newcomer meeting the third without warning will not know what it is. The rules
behind them are [QA](conventions/qa.md) and the whole list of gate commands is
[`CLAUDE.md`](../CLAUDE.md#the-gate); this is only what each *is*.

1. **The gate.** `pnpm check` is one command with five steps — typecheck, ESLint, Prettier,
   every package's tests at 100 % statement coverage, and knip for unused code
   ([`package.json`](../package.json)). A gate reported without naming its five steps has not been
   reported ([QA rule 6](conventions/qa.md)). **Each Go service has a gate of its own: `make check`,
   run from inside the package** — c-storage's (`c-storage/CLAUDE.md`'s `Gate: make check`),
   cross-compiling for the box's `arm64` so a dependency quietly needing cgo fails here rather than
   at ship time ([`c-storage/Makefile`](../c-storage/Makefile)); audit-backbone's is the same shape,
   and the detail of it is [the activity log](activity-log.md)'s.
   **`pnpm check` reaches neither**: neither package has a
   `package.json`, and the root's two ignore lists name both, so the root formatter and the
   unused-code step do not claim files a Go gate owns ([`.prettierignore`](../.prettierignore),
   [`knip.json`](../knip.json)). Those two lines are all the root knows about either package, and
   nothing makes a newcomer add them for the next one: that is
   [open item 200](open-items.md). Note that `pnpm check` needs Go and
   loopback ports: the BFF's route tests build the real c-storage and run it per test file, so the
   product's own client meets the real server ([`bff/tests/`](../bff/tests)).
2. **The walks.** Twelve Playwright specs take every screen in Vietnamese and English at three widths,
   first on the fake UI, then on a real stack, then on fresh stacks again, and count **every moved
   pixel raw — no threshold, no tolerance** against base images committed beside each spec. Green
   means fake = stack = stack again, and nothing moved against the bases except the screens named
   in `--moved` ([`walk/run.sh#L7`](../walk/run.sh#L7)). It needs a real browser, so it runs in a
   terminal and never in the agent's sandbox, where Chromium cannot start; `pnpm check` only
   typechecks and lints it. Bases are rewritten with `--write`, by a human's run, once a piece.
   [`ops/full-run.sh`](../ops/full-run.sh) is **a piece's** full run, not every walk: two
   `walk/run.sh` invocations over the walk list it is given — the first with `--write`, which takes
   the pictures and writes the new and moved bases, the second a `--bytes` compare of those
   pictures against the committed bases with no browser at all — and one local commit of the base
   pictures alone between them, since `walk/run.sh` refuses a dirty tree. Nothing is pushed
   ([`ops/full-run.sh#L4`](../ops/full-run.sh#L4)).
3. **The visual report.** `pnpm report` builds the walks page without a browser at all, drawing the
   app's own components on jsdom ([`visual/run.mjs`](../visual/run.mjs)). It is the artefact a
   non-coder judges: each screen asked yes or no, a no becoming a case. The deployed copy is behind
   a sign-in for partners.
4. **ridge.** The last stage: others check a piece in the shared environment without reading code.

A note for anyone reporting a check on this page: [`.prettierignore`](../.prettierignore) excludes
`*.md`, so Prettier inspects nothing here and a green from it means nothing.

## What the day-one plan now gets wrong

[`plans/2026-10-27-architecture.md`](plans/2026-10-27-architecture.md) is still worth reading for
its costs and its rejected alternatives. These parts of it are no longer true, and will mislead:

- **"CloudFront → the BFF's function URL, signed by origin access control", and the API client
  hashing each write into `x-amz-content-sha256`** (its `#L74`, `#L130`, the body hash at `#L133`).
  CloudFront reaches an API
  Gateway HTTP API ([`ops/env.yml#L388`](../ops/env.yml#L388)); function URLs are not offered in the
  Region. The body hash is gone from the codebase. The plan carries an amendment note at `#L137`
  but its own table still says otherwise.
- **"Only CloudFront calls the back end"** (`#L41`). The HTTP API's own address answers anyone; a
  request throttle, not a signature, is what bounds the cost
  ([`ops/env.yml#L250-L252`](../ops/env.yml#L250)). Read "answers anyone" as *reachable*, not as
  *unauthenticated*: a call arriving that way still meets the BFF's own checks — the client header,
  the session, the permission — so what was lost is the network wall in front of them, not the
  wall itself. It is the one property of the day-one design that
  was given up without anyone deciding to — it followed from the Region's limit when function URLs
  turned out not to be offered there — and until 2026-11-07 that template comment was the only
  place it was written down. It is now [open item 121](open-items.md), parked for the human until a
  client signs or real client data reaches a deployment. Two logs record a call, and they are not
  the same age. The function has written a line per request to its own group all along: nothing in
  `bff/src/lambda-main.ts#L3` turns the logger off, so `server.ts#L9`'s default stands
  (`app.ts#L86`), and the function's `LoggingConfig` names that group
  ([`ops/env.yml#L232-L233`](../ops/env.yml#L232)). The stage's own access log, `ApiLogs`
  ([`#L176-L181`](../ops/env.yml#L176), [`#L284-L286`](../ops/env.yml#L284)), is in the template
  and runs on a stack only once the change set for it has been applied. Neither names the client
  whose records were read ([open item 152](open-items.md)).
- **"A name under our domain per client, in Cloudflare, with an ACM certificate in `us-east-1`"**
  (`#L181`). There is no Route53, ACM or custom domain anywhere in the repository; the distribution
  uses CloudFront's own certificate and name
  ([`ops/env.yml#L380`](../ops/env.yml#L380)).
- **"Left behind from the old app, until something calls it: … audit-backbone"**
  (`docs/plans/2026-10-27-architecture.md`'s `Left behind from the old app`, its decision 7). Half of
  that is now wrong: the service is in this repository, with its own gate, as of 2026-11-09
  ([its recap](recaps/2026-11-09-audit-backbone-move.md)). The other half still holds — **nothing
  calls it** — and the rest of that decision's list (credo-sso, the upload, Caddy, the
  `x-origin-key`) is unchanged.
- **"Nothing is built before a client signs"** and **"no code holds it yet"** (`#L5`, `#L68`).
  ridge is built and deploys on every push to `main`. What is still unbuilt is a *client's* stack.

**Not in that list: the nightly backup.** The plan's diagram shows a nightly copy to S3 through an
S3 gateway endpoint, under a put-only role on the box (`#L28`, `#L76`, `#L97`), and none of those
three resources exists — but that is a **deliberate deferral the project recorded the same day**,
not something lost. [Open item 6](open-items.md) gates the backup and its restore on a signed
client, on the reasoning that ridge, the first box, holds no real data, and it says plainly that
"the S3 gateway endpoint and the box's put-only role come with it". So the right reading is: the
backup is designed and postponed, and until a client signs, **the one SQLite file is the only copy
of a deployment's data** — which is a known, accepted position for an environment holding only demo
data, and the thing to build first for one that does not.

One inconsistency inside that to be aware of when it *is* built: item 6's own first line says "the
box's role may only put, so it cannot restore itself", in the present tense, while
[`ops/env.yml#L93`](../ops/env.yml#L93) says "no instance role". The item describes the design; the
template describes the machine. When the backup is built, item 6's description of the role is what
has to be built — not a description of what is already there.

## Where these pages' facts came from

**Written** 2026-11-07, **rearranged 2026-11-09** so that a person can read the first screen and a
session can read on for the detail it needs, and **split in two on 2026-11-10**: the system on
[`architecture.md`](architecture.md), the detail and the page-about-page material here.

**Nothing was shortened when this page was rearranged** ([open item 202](open-items.md)): the detail
moved to the page beside the code it describes — each part's own `CLAUDE.md` for that part's
internals, and [`docs/activity-log.md`](activity-log.md) for the activity log, a page of decisions
about work not yet started. The first-day plan,
[`plans/2026-10-27-architecture.md`](plans/2026-10-27-architecture.md), keeps the cost reasoning and
the rejected alternatives and is stale on several facts — see
[what the day-one plan gets wrong](#what-the-day-one-plan-now-gets-wrong). What was not read for
this page is named at [the end](#what-this-page-did-not-read).

**The diagram on [`architecture.md`](architecture.md) is drawn from**
[`ops/env.yml`](../ops/env.yml) (`ops/env.yml`'s `Distribution`, `Api`, `Bff` and `Box`),
`bff/src/lambda.ts`, `shared/src/c-storage.ts`'s `createCStorageClient` and
`c-storage/internal/server/server.go`'s `func Build(`. The dashed part is drawn from no code.

## What this page did not read

Stated plainly, for both pages, so the next reader knows which parts to trust.

- **Read closely and first-hand:** `pnpm-workspace.yaml`, the root and per-package `package.json`
  files, `CLAUDE.md`, `bff/src/app.ts` (the first ~220 lines), `bff/src/env.ts`, `server.ts`,
  `lambda.ts`, `main.ts`, `bff/src/routes/lists.ts`, `shared/src/records.ts`, `permissions.ts`,
  `c-storage.ts`, `index.ts`, `wire.ts` (the routes and headers), `signins.ts` (the first ~70
  lines), `ui/src/main.tsx`, `App.tsx`, `visual/run.mjs`, `walk/run.sh`'s header and walk table,
  `scripts/src/stack.ts` (the first ~90 lines), `front.ts`'s header, `docs/products.md`,
  `docs/conventions/documentation.md`, `docs/conventions/qa.md`'s headings, the day-one plan whole,
  `docs/open-items.md`'s item 6, and the parts of `ops/env.yml` and `ops/network.yml` cited above.
  The rest of `docs/open-items.md` — over 1,300 lines — was searched, not read.
- **Read on this page's behalf by two other agents, not line by line by its author:** all of
  `c-storage/` and all of `ops/` and `.github/workflows/`. Every claim this page makes about those
  files was then checked directly against the file — the resource types in both templates, the
  CloudFront behaviours, the Lambda's stub and runtime, the absence of a gateway endpoint and an
  instance role, the change-set calls and their guard, the "never by CI" line, the two CI comments,
  the seed's refusal, the systemd unit's `DB_PATH`, and `c-storage/CLAUDE.md`'s gate line. **What
  was not checked a second time is everything this page does not cite:** in particular all of
  `c-storage/`'s Go sources beyond the lines quoted here, [`ops/test.sh`](../ops/test.sh) (about
  2,500 lines), `ops/lib.sh` whole, and the bodies of `check.sh`, `drill.sh`, `release.sh` and
  `pages-preview.sh`. The c-storage section in particular rests on one agent's reading of the Go
  code plus the cited lines, not on a full reading of it by this page's author.
- `scripts/src/ridge.ts` and `scripts/src/register.ts` were read only at the lines cited.
- **Barely opened or not at all:** most of `ui/src/` beyond the two entry files — about 80
  components, their routing and their data flow are summarised here from `products.md` and file
  names, not from reading them. `bff/src/app.ts` past line 220 and the other route modules
  (`orders.ts`, `staff.ts`, `operators.ts`, `reconciliations.ts`, `clients-delete.ts`) were not
  read beyond the write paths cited above; `lists.ts` was read whole. **No test file in any
  language was read**, so any sentence here about what is or is not tested comes from a reviewer's
  reading, not this page's — the first draft claimed cross-tenant key building was untested, and a
  reviewer disproved it from three route tests now cited above. `shared/src/demo.ts`,
  `scripts/src/demo/` and the seeding path were read only through `CLAUDE.md` and `products.md`.
- **The write-site counts in [who may do what](#who-may-do-what) are relayed, not re-derived** — the
  39 deliberate write sites, the 11 with the actor in scope and the 28 without come from an earlier
  costing of that question that is **not in this repository**. The one negative re-checked directly
  here is `request.user`: zero hits in `bff/src/`, against a control that hits.
- **For the 2026-11-09 rearrangement** (the one sentence, the diagram, the walk, the codemap and the
  absences) the walk was traced first-hand through the files it names, in order:
  `ui/src/pages/client/CustomerPage.tsx`'s save, `ui/src/api.ts`'s `send` and `saveCustomer`, `bff/src/app.ts`'s
  `resolveTenant` and `mustCan`, `bff/src/routes/lists.ts`'s customer `PUT` whole, `shared/src/records.ts`'s
  key layout, `shared/src/c-storage.ts`'s `putRecord`, and
  `c-storage/internal/store/store.go`'s `func (s *Store) Put(` and `Tag`. **Step 5 of
  [the request walk](architecture.md#one-request-end-to-end) is the one step not re-read for the
  walk:** it is restated from this page's own
  [who may do what](#who-may-do-what), where it was written first-hand. **Every absence in
  [what is never there](architecture.md#what-is-never-there) was established by search with a
  control that hits**,
  so a file added later would not be in it: `fetch` in `bff/src`, `node:` in `shared`, `request.user`
  in `bff/src`, a layer-named directory in any tracked path, and a NAT or internet gateway in
  `ops/network.yml`. **The evidence those rows used to carry, taken off that page on 2026-11-10 to
  keep it at one altitude, is this:** no non-test file in `bff/src` holds the word `fetch`; one test
  file in `shared/` names `node:` and no other file does; the layer-named directory search ran over
  every tracked path; and the coverage thresholds are declared per package (`ui/vitest.config.ts`'s
  `thresholds`, and the same line in the other four). The nine parts' one-line descriptions were read off each part's own `CLAUDE.md`,
  and nothing of their internals was re-derived here.
- **A caution from this page's own review**, worth knowing when you rely on it: of 52 citations
  checked, 50 held — and every claim that was wrong was a *count or a summary with no line
  attached* ("ten specs", "five variables", a script characterised without being opened), never a
  cited line. Trust a sentence here in proportion to the specificity of what follows it. **And a
  line citation's line is never checked at all** ([open item 203](open-items.md)): five of this
  page's own, in the diagram's sources, named unrelated lines and were replaced by named resources
  in the 2026-11-09 rearrangement.
- **Not checked at all:** anything live. Nothing was run for this page beyond this repository's own
  citation check and `pnpm counts`, both of which read committed files and nothing live, and no
  AWS or Cloudflare state was queried — so what *actually* exists in the account today is outside
  what this page can say.
