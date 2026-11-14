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
| `services/c-storage/` | six HTTP routes over one SQLite file, in Go, with no framework and no router library | all data. Its file is copied to a bucket within a second, a copy not yet run on an environment |
| `services/audit-backbone/` | a second Go service, in this repository and called by the back end for every change a person makes (locally; shipped by the release, not yet run on ridge) | the history of every change, once it runs on ridge ([the activity log](activity-log.md)) |
| `scripts/` | the local lanes — `pnpm stack`, `pnpm fake`, `pnpm demo` — and the steps the ops scripts hand to the product's own code | any way to run or seed anything locally, and the BFF's route tests |
| `visual/` | the walks page: the app's own screens drawn without a browser | the one artefact a non-coder judges a screen from |
| `walk/` | the browser walks: one spec a walk, every screen counted pixel by pixel | the end-to-end check |
| `ops/` | three hand-written CloudFormation templates and the shell scripts; every AWS call in the repository is made here | every way to a machine |

Six of the nine are in the pnpm workspace ([`pnpm-workspace.yaml`](../pnpm-workspace.yaml));
`services/c-storage/`, `services/audit-backbone/` and `ops/` are deliberately outside it. Two shapes are easy to miss:
the BFF is **one app with two entries**, not two back ends (`bff/src/server.ts`'s `buildBff` is
shared and only the listener differs), and the UI is **one bundle with two apps in it** — the
operator console is not a separate deployment, only the path it is opened at (`ui/src/App.tsx`'s
`isOperatorPath`).

## The data

**Where it lives.** One SQLite file per box, and one box per deployment on ridge (the back end reaches more, one per
group of tenants, and the local stack runs two:
[how a call finds its tenant's box](#how-a-call-finds-its-tenants-box)), at the path the box's systemd unit names
(`ops/c-storage.service`'s `DB_PATH`), served by a unit that restarts the process whenever it stops
(`ops/c-storage.service`'s `Restart=always`), opened in WAL with
`_txlock=immediate` ([`services/c-storage/internal/sqlitedb/open.go#L33`](../services/c-storage/internal/sqlitedb/open.go#L33)).
The whole schema is two `STRICT` tables — `services(code, hashed_access_key)` and
`records(service_code, key, data)` — in
[`services/c-storage/internal/store/schema.sql#L4`](../services/c-storage/internal/store/schema.sql#L4). There are no
timestamps, no indexes beyond the primary keys and no migration chain: the schema is applied only
to a file with no tables, stamped `user_version = 1`, and a file at any other version stops the
process at start-up ([`open.go#L56`](../services/c-storage/internal/sqlitedb/open.go#L56)).

**What a tenant is — and where it is not.** A client is a tenant, its records sit under its minted
id, the key layout has one home, and **c-storage has no concept of a tenant at all**, so separation
is a string prefix the BFF builds and the store does not enforce. Those are promises a caller meets,
and they live in
[the BFF's memo](memo/bff.md#the-tenant-prefix-is-this-packages-alone-and-the-store-does-not-enforce-it),
with what is tested, what is held by review alone, and which routes resolve a code themselves.

What a session reads here instead is where key design does real work — a person's photo and a delivery's photo
deliberately sit outside their list's prefix so a list read never drags them in
([`records.ts#L47`](../shared/src/records.ts#L47), [`#L65`](../shared/src/records.ts#L65)), and
orders and deliveries are keyed by day so a day's list stays one page, a page being at most 1,000
records or about 4 MiB ([`order` in `shared/src/records.ts`](../shared/src/records.ts),
[`MaxList` in `services/c-storage/internal/store/store.go`](../services/c-storage/internal/store/store.go)).

**How a record is written safely.** The version token is a `tag`: the hex SHA-256 of the record's
stored text, computed fresh on every read and stored nowhere
([the store](../services/c-storage/internal/store/store.go), its tag function). A writer sends it back as `If-Match`
(or `If-None-Match: *` to claim a key that must not exist); c-storage compares inside the write's
own transaction and answers **412** if the record moved
([`Store.write` in `services/c-storage/internal/store/store.go`](../services/c-storage/internal/store/store.go),
[the `store.ErrMoved` case in `services/c-storage/internal/server/handlers.go`](../services/c-storage/internal/server/handlers.go)). A precondition
it cannot parse is a 400, never ignored — but a request sending *no* precondition overwrites
whatever is there, so the guard holds only where the BFF sends the tag.

What the BFF then **does** with a 412 is its own, and is a promise: the bound it retries under, the
re-read that lets a write whose answer was lost count as saved, the condition that compare rests on,
and the four write paths that each recover differently with no shared helper. All of it is
[the BFF's memo](memo/bff.md#a-write-over-a-moved-record-is-tried-three-times) — read it, and then
the route you are changing, rather than assume `lists.ts`.

## Who may do what

**Two doors, two session kinds, one store** — and what each of them promises is
[the BFF's memo](memo/bff.md): how long [a session](memo/bff.md#a-session-lasts-a-week-and-an-operators-an-hour-unused)
lasts on each side, what [a 401 means against a 403](memo/bff.md#a-401-ends-the-session-a-403-ends-only-the-act),
that [the permission layers](memo/bff.md#the-permission-layers-are-read-on-every-call) are read on
every call, and that [the operator's door](memo/bff.md#the-operators-door-resolves-no-company-and-reads-no-permission)
resolves no company and reads no permission at all. The menu's side of the same question — that a
page the person may not open is never drawn and makes no call, and that the menu is only as fresh as
the last time the app read who the person is — is
[the UI's memo](memo/ui.md#a-screen-never-guards-so-a-page-the-person-may-not-open-is-never-drawn).

The parts of this that a session reads while changing the code, and that are not a promise, follow.

**What was measured about the actor, which the memo's claim rests on.** That no record says who
changed it is [the BFF's memo](memo/bff.md#no-record-says-who-changed-it); the measurement behind it
is here. There is no `request.user` anywhere in `bff/src/` (zero hits, against `request.tenantId`,
which hits in `app.ts`, `lists.ts` and `orders.ts`). Measured over the
BFF's **39 deliberate write sites: 11 have the identity in scope at the write and 28 do not**, and
the two that write customers and products — the highest-value history there is — carry no actor at
all. That half of the gap is in no open item ([the docs index](README.md)).

**Keys, and who holds which.** c-storage has three: `x-internal-access-key`, which gates every
route but `/health` including the 404 fallback, so an unknown path answers 401 exactly like a real
one; a per-service `x-access-key`, stored only as a SHA-256 and compared in constant time; and
`x-super-admin-key`, whose sole power is creating a service
([`services/c-storage/internal/auth/auth.go#L17`](../services/c-storage/internal/auth/auth.go#L17),
[`Server.Handler` in `services/c-storage/internal/server/server.go`](../services/c-storage/internal/server/server.go),
[`Store.Admits` in `services/c-storage/internal/store/store.go`](../services/c-storage/internal/store/store.go)). **The BFF never holds
the super-admin key** — registration is the stack's own step, done once
([`readEnv` in `bff/src/env.ts`](../bff/src/env.ts),
[`Connection` in `scripts/src/register.ts`](../scripts/src/register.ts)). The rule, in `env.ts`'s own
words, is that the variables the BFF reads are "the only ones it is given": as a listener that is
eight — `PORT`, `HOST`, the four for c-storage, `APP_ORIGIN` and `FRONT_DOOR_KEYS`, all supplied by the local stack
([`envSchema` in `bff/src/env.ts`](../bff/src/env.ts),
[the environment `scripts/src/stack.ts` hands the back end](../scripts/src/stack.ts)) — and as a Lambda six, the same set
without the listener's two, since API Gateway is the listener
([`readLambdaEnv` in `bff/src/env.ts`](../bff/src/env.ts)). The optional audit pair is on top of both.

## How a call finds its tenant's box

> **Built today** is cited by file and symbol. The pooled shape the human gave on 2026-11-10 and
> 2026-11-11, priced in two research pages kept outside this repository, is built in the back end,
> the operator's form and the local stack; what stays **intended, not built** is a box added to
> ridge by one command and the move of a company between boxes, and its lines cite only the code
> they would change.

### Built today: one stack, one box on ridge, every tenant in it

- **The stacks.** Three templates make three kinds of stack, and only `ops/stack.sh` makes them
  (`network | github | env <name>`): the network under every environment (`ops/stack.sh`'s
  `NETWORK_STACK`), the account's one GitHub provider (`ops/stack.sh`'s `GITHUB_STACK`), and one
  stack per environment from `ops/env.yml`. That last holds 21 resources: the box and its door, the
  back end's door and its rule into the box (`ops/env.yml`'s `BoxFromBff`), the function, its role
  and two log groups, the HTTP API with its integration, route, stage and permission, the bucket of
  screens with its access and policy, the page-path rewrite, the distribution, the deploy role, and
  the subnet with its route.
- **The box.** One (`ops/env.yml`'s `Box`), whose type, disk size and image are template
  parameters it alone reads, kept by the stack on replacement and on deletion
  (`UpdateReplacePolicy: Retain`, `DeletionPolicy: RetainExceptOnCreate`), its address an output
  (`ops/env.yml`'s `BoxAddress`).
- **The back end knows the home box, and the others it is handed.** Its environment holds one
  storage address and its keys (`bff/src/env.ts`'s `storageShape`), set at each deploy from the keys
  file read off the box (`ops/lib.sh`'s `read_keys`, run by `ops/app.sh`), and one more setting,
  `STORAGE_BOXES`, the other boxes by name with their address and keys. Absent, there is the home
  box alone, which is all ridge has; the local stack hands a second box, `b2`
  (`scripts/src/stack.ts`'s `STACK_BOXES`). A malformed value is refused at start, naming the variable.
- **The routing table is the tenant index.** One record a tenant, `client.<code>` to `{id, name,
  madeAt, box}` (`shared/src/records.ts`'s `recordKeys` and `storedClientSchema`), written last, on
  the home box, by `bff/src/records/clients.ts`'s `createClient` from the operator's form, which
  sends a code, a name and, when it is not the home box, the box
  (`shared/src/wire.ts`'s `createClientRequestSchema`). A line with no box is on the home box, so
  every company made before reads as it did. The operator's own records sit in the home box, under
  `operator.` keys in the same `recordKeys`.
- **Every client call reads it, uncached.** `bff/src/app.ts`'s `resolveTenant` reads the code from
  the header `shared/src/wire.ts`'s `CLIENT_HEADER` names, then the index record, on every call.
  Nothing in `bff/src` caches it: a search of its non-test files for `cache` and `new Map` finds two
  `cache-control: no-store` replies and one `Map` local to one handler in
  `bff/src/routes/orders.ts`, against a control that hits: `getRecord`, twice in `bff/src/app.ts`.
  The line's box then picks the company's client: `resolveTenant` makes it over the box the line
  names, and a line naming a box the back end was not handed is a 503, the log naming the box and
  no key. No memory is kept: the read costs a call under two cents a company a month, and without
  one a later move's mark is seen by the very next call.
- **The code comes from the screens, never from the address.** `ui/src/ClientApp.tsx`'s
  `linkedCode` reads the link's `?client-code=` (made by `shared/src/wire.ts`'s `clientLinkPath`),
  and `ui/src/ClientApp.tsx`'s `boot` falls back to the code the device keeps. The distribution
  forwards every viewer header to the back end but `Host` (the comment above `ops/env.yml`'s
  `Distribution`), so the back end could not read the address if it tried, and it serves
  CloudFront's own name and certificate (`ops/env.yml`'s `CloudFrontDefaultCertificate`).
- **What a screen reads of its tenant** is the tenant's settings record (`shared/src/config.ts`'s
  `TenantConfig`), through the back end, before sign-in (`boot`). No config file exists for a screen
  to read.
- **The operator sees each box.** One route answers every box the back end holds, the home box
  first, with the companies counted from the lines and the free disk from c-storage's status call
  (`shared/src/wire.ts`'s `boxesReplySchema`, `shared/src/c-storage.ts`'s `CStorageClient`); a box
  that does not answer is shown so and the others still, and the add-company form lists them when
  there is more than one. No number of companies a box is written anywhere.
- **The box reads nothing per tenant.** c-storage starts on five values
  (`services/c-storage/internal/config/config.go`'s `Load`), and its Go code has no word for a
  tenant: zero lines say `tenant`, one says `client` and names a caller that hung up, against 38
  that say `service`. It knows its callers as services, each with a key.
- **The audit store has one write key** (`services/audit-backbone/internal/config/config.go`'s
  `Load` reads `ACTIVITY_WRITE_KEY`), and the tenant is named in each entry's body, so the one key
  writes as any tenant.
- **The first bound a shared back end meets is a setting:** the HTTP API's stage, at 10 calls a
  second with bursts of 50 (`ops/env.yml`'s `ApiStage`).

### Pooled on boxes in the same one stack: what is built, and what is not

- **The groups.** The operator puts each tenant on a box when adding it, seeing each box's free disk
  and companies, and the code holds no grouping rule and no number. The disk is the first limit, at
  about 300 MB a year a tenant at the human's figures (under 10,000 calls and 500 records a
  day each): that figure leaves out the delivery photos, which today are records on the box
  (`shared/src/records.ts`'s `deliveryPhoto`) and which the human means to keep in Cloudflare R2, a
  piece not opened. A premium tenant is a group of one. The operator's own records, the tenant list
  among them, stay on the first box, the home box: a box of their own would be a fixed charge that
  buys nothing yet, since every call still reads the list first.
- **The record.** Built: `storedClientSchema` gains the tenant's box, and never a key. **Not built:**
  a mark that the tenant is moving, which would answer every call of it 503 while the copy runs, and
  the audit store's own box. The box's check that it holds the company is an absence, not a read:
  sessions, people and the root exist only on the company's own box, so a wrong line meets a refusal;
  only a delete would harm, so the delete route (`bff/src/routes/clients-delete.ts`) first reads the
  company's settings on the named box, and answers 409, removing nothing, when there are none.
- **The boxes and their keys.** Built: the keys stay in the back end's environment
  (`STORAGE_BOXES`), and the operator's list is the boxes that environment holds. **Not built:** the
  list from the stack's outputs at each deploy; a stack's box is added by the human's command in a
  step not yet taken. By an estimate the keys of about twenty boxes fit under the function's 4 KB
  limit; past that the keys go to a secret store, and the record
  still holds none.
- **One stack per environment, every box in it.** Not built. The network and the GitHub provider
  stay apart, since one is under every environment and the other is one per account. The plan is a
  loop in `ops/env.yml` over a list of added boxes, each the home box's block under its own names, so
  that a change set names each box it would restart. Adding a tenant is the operator's form and no
  stack update; adding a box will be one `ops/stack.sh env <name>`. *What flips it to a small stack
  a box:* real tenants' data is live and reading a change set is no longer assurance enough that a
  back-end change cannot restart a pooled box, or someone other than the human must be able to
  change some boxes and not others.
- **The address.** Not built. `<tenant-code>.<credo-domain>` on the one distribution, through one free
  ACM certificate for `*.<credo-domain>` in `us-east-1` and one wildcard DNS name; the screens read the
  code from the address instead of the link, and `CLIENT_HEADER` still carries it to the back end.
  The operator keeps one name of its own, because every passkey is checked against it
  (`bff/src/env.ts`'s `originShape`), and a few codes are kept back from tenants. The domain is a
  setting.
- **A tenant whose contract needs its keys or its code apart** takes a stack of its own from
  `ops/env.yml` as it is, and the rest stay pooled.
- **The address.** `<tenant-code>.<credo-domain>` on the one distribution, through one free ACM
  certificate for `*.<credo-domain>` in `us-east-1` and one wildcard DNS name; the screens read the
  code from the address instead of the link, and `CLIENT_HEADER` still carries it to the back end.
  The operator keeps one name of its own, because every passkey is checked against it
  (`bff/src/env.ts`'s `originShape`), and a few codes are kept back from tenants. The domain is a
  setting.
- **The audit store** is routed by the same record, one store a group, the fit being the group's
  own box beside storage, which is still the nano's unmeasured memory
  ([the activity log](activity-log.md#where-it-runs-open-and-cheap-to-leave-open)).
- **Rejected:** a cache service for the lookup, which would be a hop of the same kind as the read
  it saves, from about $6 a month; a Caddy server for the addresses, about $8 a month fixed, with a
  public address, a network that has no way out, and either a key to the DNS zone on the box or a
  certificate per name; a config file in the bucket, which anyone can read, or in the build, which
  is public.
- **The price, which is the human's call and comes with the shape:** the one back end holds every
  box's key, which guards narrow and only a tenant's own stack removes; on a shared box the back end's check is
  the only wall between its tenants, one box down stops them all, and a restore rolls them all
  back. Pooling saves about $3.70 a tenant a month at the human's early guess of twenty a box, a figure nothing in the code holds.

## How it reaches a machine

| Lane | How | What it is for |
| --- | --- | --- |
| Local | `pnpm stack` builds c-storage with `go build` and the UI with Vite, then runs both behind the local front; `pnpm stack -- <command>` is one invocation, up-command-down, because the sandbox cannot signal a process an earlier command started ([`scripts/src/stack.ts`](../scripts/src/stack.ts), [`CLAUDE.md`](../CLAUDE.md)) | the real stack, data gone on Ctrl-C |
| Local, no server | `pnpm fake` — the UI alone over invented data, the one build that holds `?fake` and the fake `Api`; the bundle that deploys contains none of it ([`ui/src/main.tsx#L10`](../ui/src/main.tsx#L10)) | a screen's look before its back end exists |
| ridge | the shared pre-production environment, and the only deployed one | others check a piece without the code |
| production | **not built.** Intended as one more stack from `ops/env.yml`, every group's box in it ([how a call finds its tenant's box](#how-a-call-finds-its-tenants-box)), with a stack of a tenant's own only where a contract needs its keys apart. `ops/env.yml` is parameterised by `Env` and ridge is one instance of it; several scripts hard-refuse any environment but ridge (`ops/seed.sh`'s `seeds ridge alone`) | — |

**Stack shape is the human's; code is CI's.** Only [`ops/stack.sh`](../ops/stack.sh) touches
CloudFormation, and only through change sets — `create-change-set`, print every change, then
`execute-change-set` (`#L204`, `#L242`) — run by a human from a terminal, never by CI (`#L8`). A
change set that removes or replaces anything is **refused by default** and needs the human to name
the logical id, because a replaced box deletes its disk and the database with it
([`ops/unsafe-changes.jq#L5`](../ops/unsafe-changes.jq#L5), the `unsafe=$(jq` line of [`ops/stack.sh`](../ops/stack.sh)).
Templates are read from `origin/main`, not the working copy (`#L140`). There is no CDK, SAM or
Terraform anywhere.

**What CI does.** [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) holds twelve jobs: five
gate jobs that run on every push and pull request — `check` (`make check` in c-storage), `audit` (the activity log's `make check`),
`e2e` (its Bruno collection against the built binary), `app` (waits on six package jobs, `app-bff` to `app-walk`, each one package's `pnpm check`) and
`ops` (ShellCheck at a pinned SHA-256 plus cfn-lint over the three templates) — and then,
on a push to `main` or a press of `ci` on `main` only, `deploy` in the `ridge` GitHub environment. That job ships **code, never stack
shape** (`ci.yml`'s comment "Releases only: a template change stays the human's change set"): c-storage's arm64 binary to the box over an Instance Connect tunnel
([`ops/release.sh`](../ops/release.sh)), the BFF bundle to the one Lambda and the UI files to the one
bucket ([`ops/app.sh`](../ops/app.sh)), then [`ops/check.sh`](../ops/check.sh) verifies it. All
third-party code builds *before* the AWS role is assumed (`ci.yml`'s comment "The app's builds and installs run third-party code"), and the role itself is narrow
to the point of naming the one function and the one instance
(`ops/env.yml`'s `DeployRole`). Two other workflows:
[`seed.yml`](../.github/workflows/seed.yml) brings ridge's demo copies up to yesterday when somebody runs it (it has no schedule), and
[`walks.yml`](../.github/workflows/walks.yml) deploys the walks page to Cloudflare Pages behind
Access — the only deploy target that is not AWS.

One hazard the split creates: a change set that updates the `Bff` resource can restore its inline
503 stub and empty environment, so the human re-runs the latest deploy afterwards
(`ops/env.yml`'s `Bff`, [`ops/README.md`](../ops/README.md)).

## How it is checked

Four things, and a newcomer meeting the third without warning will not know what it is. The rules
behind them are [QA](conventions/qa.md) and the whole list of gate commands is
[`CLAUDE.md`](../CLAUDE.md#the-gate); this is only what each *is*.

1. **The gate.** `pnpm check` is one command with five steps — typecheck, ESLint, Prettier,
   every package's tests at 100 % statement coverage, and knip for unused code
   ([`package.json`](../package.json)). A gate reported without naming its five steps has not been
   reported ([QA rule 6](conventions/qa.md)). **Each Go service has a gate of its own: `make check`,
   run from inside the package** — c-storage's (`services/c-storage/CLAUDE.md`'s `Gate: make check`),
   cross-compiling for the box's `arm64` so a dependency quietly needing cgo fails here rather than
   at ship time ([`services/c-storage/Makefile`](../services/c-storage/Makefile)); audit-backbone's is the same shape,
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
  Gateway HTTP API ([`ops/env.yml`](../ops/env.yml), `Distribution`); function URLs are not offered in the
  Region. The body hash is gone from the codebase. The plan carries an amendment note at `#L137`
  but its own table still says otherwise.
- **"Only CloudFront calls the back end"** (`#L41`). The HTTP API's own address answered anyone,
  and a request throttle, not a signature, bounded the cost (`ops/env.yml`'s `ApiStage`); it was the one
  property of the day-one design given up without anyone deciding to — it followed from the Region's limit
  when function URLs turned out not to be offered there. It is regained since 2026-11-13: CloudFront sends a
  secret key as `x-front-door-key` on every call it passes on, and the back end's first hook
  (`bff/src/server.ts`'s `buildBff`) refuses any call without it, so the address answers a 403 to everyone
  but the front door. [Open item 121](open-items.md) is closed by it, and
  [`ops/keys.sh`](../ops/keys.sh) replaces the key with no call refused. Two logs record a call, and they are not
  the same age. The function has written a line per request to its own group all along: nothing in
  `bff/src/lambda-main.ts#L3` turns the logger off, so the `logger = true` default of `bff/src/server.ts`'s `buildBff` stands
  (`app.ts#L86`), and the function's `LoggingConfig` names that group
  (`ops/env.yml`'s `Bff`). The stage's own access log, `ApiLogs` and `ApiStage`'s `AccessLogSettings`
  (both in `ops/env.yml`), is in the template
  and runs on a stack only once the change set for it has been applied. Neither names the client
  whose records were read ([open item 152](open-items.md)).
- **"A name under our domain per client, in Cloudflare, with an ACM certificate in `us-east-1`"**.
  There is no Route53, ACM or custom domain anywhere in the repository; the distribution uses
  CloudFront's own certificate and name (`ops/env.yml`'s `CloudFrontDefaultCertificate`). The
  pooled shape keeps a name a tenant but, as intended and not built, puts every one under one wildcard
  certificate on the one distribution, rather than a certificate and a stack a client
  ([how a call finds its tenant's box](#how-a-call-finds-its-tenants-box)).
- **"One stack per client"**, the human's answer of 2026-10-27, recorded in the plan, to its
  question "One stack per client, or one shared". The human's own pooled shape of 2026-11-10 and
  2026-11-11 replaces it:
  one stack per environment, its tenants pooled on boxes, and a tenant's own stack kept for a
  contract that needs its keys apart. Its boxes are built in the back end and the local stack and
  not added to ridge, so today's one box per environment is still the whole of what runs there.
- **"Left behind from the old app, until something calls it: … audit-backbone"**
  (`docs/plans/2026-10-27-architecture.md`'s `Left behind from the old app`, its decision 7). Half of
  that went wrong on 2026-11-09: the service is in this repository, with its own gate
  ([its recap](recaps/2026-11-09-audit-backbone-move.md)). The other half has gone too: the back end
  calls it for every change a person makes, in the local copy ([the activity log](activity-log.md)), and the rest of that decision's list (credo-sso, the upload, Caddy, the
  `x-origin-key`) is unchanged.
- **"Nothing is built before a client signs"** and **"no code holds it yet"**.
  ridge is built and deploys on every push to `main`. What is still unbuilt is production: in the
  pooled shape one more environment's stack holding many tenants, not a stack for each client.

**Not in that list: the nightly backup, which became a continuous copy.** The first plan's diagram showed a
nightly copy to S3 under a put-only role on the box, none of it built, deferred to a signed client
([open item 6](open-items.md)). The continuous-copy piece replaced it: Litestream copies each save to the
environment's own bucket through an S3 gateway door, the box's role may put, get and list under its own
path and holds no delete, and the records sit on a disk of their own (`ops/env.yml`'s `CopyBucket`,
`BoxRole` and `RecordsVolume`). **It is built and guarded on written input, and no environment has run it
yet**, so until the human's changes and the drill have run, a deployment's one SQLite file is still the only
copy that has been proved readable. The restore runs on the box under its own role, which is why the role
reads; the first plan's "may only put" was dropped for that reason.

## Where these pages' facts came from

**Written** 2026-11-07, **rearranged 2026-11-09** so that a person can read the first screen and a
session can read on for the detail it needs, and **split in two on 2026-11-10**: the system on
[`architecture.md`](architecture.md), the detail and the page-about-page material here.
**Amended 2026-11-11** with where a tenant's records live and
[how a call finds its tenant's box](#how-a-call-finds-its-tenants-box): what is built today, cited,
and the pooled shape the human gave, marked on both pages with what is built and what is not.

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
`services/c-storage/internal/server/server.go`'s `func Build(`. The two dashed boxes are drawn from
no deployment: the activity log is built and not on ridge, and the further boxes are the pooled
shape, built in the back end and the local stack and not on ridge.

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
  `services/c-storage/` and all of `ops/` and `.github/workflows/`. Every claim this page makes about those
  files was then checked directly against the file — the resource types in both templates, the
  CloudFront behaviours, the Lambda's stub and runtime, the absence of a gateway endpoint and an
  instance role, the change-set calls and their guard, the "never by CI" line, the two CI comments,
  the seed's refusal, the systemd unit's `DB_PATH`, and `services/c-storage/CLAUDE.md`'s gate line. **What
  was not checked a second time is everything this page does not cite:** in particular all of
  `services/c-storage/`'s Go sources beyond the lines quoted here, [`ops/test.sh`](../ops/test.sh) (about
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
  `ui/src/pages/client/RecordPage.tsx`'s save, `ui/src/api.ts`'s `send` and `saveCustomer`, `bff/src/app.ts`'s
  `resolveTenant` and `mustCan`, `bff/src/routes/lists.ts`'s customer `PUT` whole, `shared/src/records.ts`'s
  key layout, `shared/src/c-storage.ts`'s `putRecord`, and
  `services/c-storage/internal/store/store.go`'s `func (s *Store) Put(` and `Tag`. **Step 5 of
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
- **For the 2026-11-11 amendment** ([how a call finds its tenant's box](#how-a-call-finds-its-tenants-box)
  and its pair, [where a tenant's records live](architecture.md#where-a-tenants-records-live)), read
  first-hand at the trunk's `c52658ba`: `ops/env.yml`'s header, parameters, `Box`, `ApiStage`,
  `Distribution` and outputs, its 21 resources counted by name; `ops/stack.sh`'s header and stack
  names; `ops/lib.sh`'s `read_keys` and the key step of `ops/app.sh`; `bff/src/env.ts` whole;
  `bff/src/app.ts`'s `resolveTenant` and the operator's add route; `shared/src/records.ts`'s key
  layout and index schema; `shared/src/wire.ts`'s header, link and add request;
  `ui/src/ClientApp.tsx`'s `linkedCode` and `boot`; both services' `config.go`. **Established by
  search with a control that hits**, so a file added later is not in them: no cache in `bff/src`'s
  non-test files, and no word for a tenant in c-storage's Go. **The pooled-shape rewrite of
  2026-11-14** was written from the built code (`bff/src/app.ts`'s `resolveTenant`,
  `bff/src/env.ts`'s `storageShape`, `bff/src/routes/clients-delete.ts`, `shared/src/records.ts`'s
  `storedClientSchema`, `scripts/src/stack.ts`), not from the plan alone. **Not read for it:**
  `ops/network.yml` and `ops/github.yml`, whose resources are not counted here; the rest of
  `ops/app.sh` and `ops/lib.sh`. **The intended part rests on two research pages kept outside this
  repository**, whose AWS quotations and prices (the $6, $8 and $3.70 a month, the 4 KB
  environment, the twenty boxes) are taken from them and were not re-read against AWS for this
  page; the twenty boxes are their own estimate.
- **A caution from this page's own review**, worth knowing when you rely on it: of 52 citations
  checked, 50 held — and every claim that was wrong was a *count or a summary with no line
  attached* ("ten specs", "five variables", a script characterised without being opened), never a
  cited line. Trust a sentence here in proportion to the specificity of what follows it. **And a
  line citation's line is never checked at all** ([open item 203](open-items.md)): five of this
  page's own, in the diagram's sources, named unrelated lines and were replaced by named resources
  in the 2026-11-09 rearrangement.
- **Not checked at all:** anything live. Nothing was run for this page beyond this repository's own
  citation check and `pnpm counts`, both of which read committed files and nothing live (for the
  2026-11-11 amendment, the citation check inside the `scripts` package's gate), and no
  AWS or Cloudflare state was queried — so what *actually* exists in the account today is outside
  what this page can say.
