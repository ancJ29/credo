# Start here

> An index, written 2026-11-09. **It holds no fact of its own**: every line points at the file that
> does, and each file and line named below was opened and read before it was written here. It is
> for whoever has to act — the human with a client waiting and no preparation, and a fresh session
> of the machine alike, as [`architecture.md`](architecture.md) is.
>
> **The two sections below are for the two things that have to be answered under pressure: a
> client asking for data to be put back, and a bug report that needs a first read.** The catalogue
> of the documents is after them, and the order to read them is last.

## "An operator changed this wrongly — put it back"

**Read this before promising anything: the old value cannot be recovered from the system.** Every
record is one key holding its current value ([`shared/src/records.ts#L7`](../shared/src/records.ts#L7)),
so a save overwrites. No record carries who wrote it or what it held before — searched for
`changedBy`, `updatedBy`, a revision and a history across `shared/src`, `bff/src` and
`services/c-storage/internal`, and there is none — and there is no copy of any client's records to restore
from: [open item 6](open-items.md) says so in its own words, "There is no copy of any client's
records."

What **can** be established in the first minutes:

| The question | Where |
| --- | --- |
| Which call touched which record, when, and whether it succeeded | the door's access log — its path names the record id on a detail route ([`ops/env.yml#L295-L297`](../ops/env.yml#L295); see [the logs](#where-the-system-answers-faster-than-any-file)) |
| What the record holds now | the key it sits under, [`shared/src/records.ts#L7`](../shared/src/records.ts#L7) |
| Whether the write was refused rather than applied | the status in the same log line; a refused save carries the field that failed, [`bff/src/errors.ts#L35-L41`](../bff/src/errors.ts#L35) |

What cannot be established at all, and is the honest answer to the client: **which person made the
change**, because the log's ten fields hold no identity and no body
([`ops/env.yml#L297`](../ops/env.yml#L297)), and **what the value was before**. A correction can
only be made forward, from what the client themselves knows it should be.

The recorded part of this gap is [open item 6](open-items.md), the nightly backup and its restore,
waiting on a signed client. **The other half — that nothing records who changed a record — is in
no open item**, which is worth knowing when this is priced.

## A bug is reported and you have fifteen minutes

**Ask what was on the screen and what it said, before opening any file.** The app's own words
already name the cause in two of the cases below, and the door's log answers "did the call even
reach us" faster than reading anything.

| What is reported | What decides it | Open |
| --- | --- | --- |
| A number on a screen is wrong — an order's total | the price is the product's price **now**, the amount is price times quantity, the total their sum | [`shared/src/orders.ts#L177`](../shared/src/orders.ts#L177) (`priceLines`) |
| A number is wrong — a driver's amount to collect | that driver's delivered requests of the day, summed in one place | [`shared/src/reconciliations.ts#L62`](../shared/src/reconciliations.ts#L62) (`driverDay`) |
| An order is under the wrong day | the day is the browser's calendar day, never the server's clock | [`ui/src/day.ts#L29`](../ui/src/day.ts#L29) |
| "I cannot do X" — a 403 | one check on the server, and the UI's display is never the guard; what the person holds is three layers in order, department, position, their own | [`bff/src/app.ts#L188-L192`](../bff/src/app.ts#L188), the note at [`#L184`](../bff/src/app.ts#L184); resolved by [`shared/src/permissions.ts#L48`](../shared/src/permissions.ts#L48), the order at [`#L36`](../shared/src/permissions.ts#L36), the catalogue at [`#L9`](../shared/src/permissions.ts#L9) |
| "Wrong name or password" and they are sure it is right | **nothing will tell you which part was wrong.** One answer covers an unknown name, a wrong password and a person who has left, deliberately | [`bff/src/app.ts#L261-L264`](../bff/src/app.ts#L261), the route from [`#L251`](../bff/src/app.ts#L251). The log shows the attempt and its 401, and no file holds the reason |
| A save was refused and the form points at a field | the 400 carries `details`, naming the field and what failed — **the screen has already told you the cause** | [`bff/src/errors.ts#L35-L41`](../bff/src/errors.ts#L35) |
| "The service is unavailable", or one page will not load | the app's own words say which: a failed boot offers a retry, and on the operator's console names the hop that failed; a single page's failed load is a different message | [`ui/src/frame/Boot.tsx`](../ui/src/frame/Boot.tsx)'s `Boot` with its hop words `HOP_WORDS`, decided by [`ui/src/ClientApp.tsx#L79`](../ui/src/ClientApp.tsx#L79) at [`#L99`](../ui/src/ClientApp.tsx#L99); one page's is [`ui/src/frame/Loaded.tsx`](../ui/src/frame/Loaded.tsx)'s `Loaded` |
| A call answered 503 and said nothing more | on purpose: every c-storage failure becomes one blank `Service unavailable`, because only a 401 may sign anyone out | [`bff/src/errors.ts#L23-L24`](../bff/src/errors.ts#L23). The BFF's own log holds a line only from 500 up ([`bff/src/app.ts#L94`](../bff/src/app.ts#L94)), so **which** call it was comes from the door's log |
| "It was slow", or a call hung then failed | the BFF waits 5 s for c-storage and the function is cut at 10 s; the door refuses over 10 calls a second, bursts of 50 | [`shared/src/c-storage.ts#L24`](../shared/src/c-storage.ts#L24), the signal at [`#L55`](../shared/src/c-storage.ts#L55); [`ops/env.yml#L241`](../ops/env.yml#L241) and [`#L293-L294`](../ops/env.yml#L293) |
| Nothing in the app explains it | the one file that decides each part of the system, by part | [the one file to open, by part](conventions/code.md#the-one-file-to-open-by-part) |

## Where the system answers faster than any file

- **The door's access log**, `/aws/apigateway/credo-<env>`: one JSON line a call — path, route,
  status, `latencyMs`, the integration error ([`ops/env.yml#L187-L191`](../ops/env.yml#L187), the
  format at [`#L295-L297`](../ops/env.yml#L295)). It is the only record of a 400, a 401 or a 403,
  and the only per-request latency kept anywhere.
- **The BFF's own log**, `/aws/lambda/credo-<env>-bff`
  ([`ops/env.yml#L180-L183`](../ops/env.yml#L180)), which holds a line only where the status was
  500 or more ([`bff/src/app.ts#L94`](../bff/src/app.ts#L94)). Both groups keep 14 days
  ([`#L184`](../ops/env.yml#L184), [`#L191`](../ops/env.yml#L191)).
- **An ops script's refusal and its log.** A refusal states its own cause and its remedy
  (`rolled_back_refusal` in [`ops/lib.sh`](../ops/lib.sh) is the shape), and every script's log is in `logs/`
  in the credo root, ending on `== exit <n>` ([`ops/README.md`](../ops/README.md)). The machine
  reads the log; nothing needs pasting.
- **Nothing shows a trend.** CloudFront keeps no access log and neither template configures
  tracing, an alarm, a metric filter or a dashboard — searched in
  [`ops/env.yml`](../ops/env.yml) and [`ops/network.yml`](../ops/network.yml). A server that
  stops therefore reaches no one, which is recorded and waiting on a signed client
  ([open item 1](open-items.md)).

## The documents, and what each answers

| Page | It answers | For |
| --- | --- | --- |
| [`README.md`](../README.md) | what credo is, and three ways to run it on this machine | anyone |
| [`CLAUDE.md`](../CLAUDE.md) | what a session must know before it touches anything: the gate's six commands, and the facts the code does not show | the machine |
| [`docs/architecture.md`](architecture.md) | **how the system is put together** — one sentence, the diagram, one request walked end to end, the nine parts and what each one is for, and what is never there. Opened by anyone who has just arrived and wants the whole system | both |
| [`docs/architecture-detail.md`](architecture-detail.md) | the detail behind that page: the codemap of where each thing lives, the data, who may do what, how it reaches a machine, how it is checked, and where these two pages' facts came from. Opened by whoever is about to change the code | the machine |
| [`docs/activity-log.md`](activity-log.md) | the activity log, **built in the back end and not yet on ridge**: what `services/audit-backbone/` is, the path an entry takes, the two prerequisites, what is guaranteed and what cannot be | the machine |
| [`docs/products.md`](products.md) | what each part does for whom, and how far each has got | the human |
| [`docs/client-readiness.md`](client-readiness.md) | can we take a real client: what would happen to their data and access, and what the office cannot do yet | the human |
| [`conventions/code.md`](conventions/code.md) | **where new code goes, what to copy, and the one file to open first for a part of the system** | the machine, then the human |
| [`conventions/collaboration.md`](conventions/collaboration.md) | who decides what, and how a piece is handed over | both |
| [`conventions/documentation.md`](conventions/documentation.md) | what a document may hold, and where each fact lives | the machine |
| [`conventions/qa.md`](conventions/qa.md) | what must be checked, and what a gate is | the machine |
| [`docs/memo/`](memo) | **how a part behaves — the promises a caller can be surprised by, one section a claim**: [`bff.md`](memo/bff.md), [`ui.md`](memo/ui.md), [`c-storage.md`](memo/c-storage.md). Beside them, one argument a file: a client's own data in `extra`, the three decisions that are the human's, and one red diagnosed | both |
| [`docs/open-items.md`](open-items.md) | everything still to do, numbered and never renumbered — read it before calling anything missing | both |
| [`docs/plans/`](plans), [`docs/recaps/`](recaps) | a piece's one page before it is built, and its half page with the evidence after | both |
| [`ops/README.md`](../ops/README.md) | the runbook: the order and the commands for the network, a stack, a release, a drill, and [what a push to `main` runs](../ops/README.md#the-deploy-job) | the human, with the machine reading the logs |
| [`services/c-storage/README.md`](../services/c-storage/README.md) | the Go service alone, and its whole check in one command | both |

## The order to read them

1. [`README.md`](../README.md), and run `pnpm stack` — the whole app on this machine, which is
   faster than reading about it.
2. [`architecture.md`](architecture.md) — how it is put together, every claim naming its file;
   [`architecture-detail.md`](architecture-detail.md) when the piece in hand needs the detail.
3. [`conventions/code.md`](conventions/code.md) — where a new thing goes, and the first file to
   open for each part.
4. [`conventions/qa.md`](conventions/qa.md) and [`CLAUDE.md`](../CLAUDE.md) before running or
   changing anything; the rest when a question asks for it.

## What this page did not read

Every file and line in the tables above was opened at the commit that added this page. **Six
claims are negatives, established by searching rather than by reading, so a file added later
would not be in them**: that no record carries who wrote it or what it held before (searched
across `shared/src`, `bff/src` and `services/c-storage/internal`); that no open item records that gap;
that nothing records which part of a sign-in was wrong; that the BFF's log holds no line below
500; that CloudFront keeps no access log; and that neither template configures tracing, an alarm,
a metric filter or a dashboard. The catalogue's one-line descriptions come from each page's own
opening and headings, not from a full read of `open-items.md`, `client-readiness.md` or the plans
and recaps.
