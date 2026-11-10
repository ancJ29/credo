# Code

> **Decided** 2026-11-09, from the whole-code-base structure review of 2026-11-08. **This is the
> machine's own house style, and it needs no approval from the human:** how the code here is written
> is the machine's decision, and this file binds every session that adds or changes code. It names
> the one way only where the repo already holds two ways of doing one job, and the file to copy where
> it already holds the shape. It also says, for a reader who has to find something fast, **where
> each kind of file already lives and which one file decides each part's behaviour**
> ([where a new thing goes](#where-a-new-thing-goes)).
>
> **This file answers "where does this code live, and what do I open or copy".**
> [`architecture.md`](../architecture.md) **answers "how is this system put together"** — the
> request path, the data, how it reaches a machine, how it is checked — **and is not restated
> here.** The decisions
> that are the human's — what the system should be, rather than how it is written — are in
> [a client's own difference, a screen's behaviour, and server
> data](../memo/divergence-and-caching.md). This file holds the rules as they stand; their history is
> in `git log`.
> **Last amended** 2026-11-09, from the directory structure the human approved (piece 100): the claim
> that every TypeScript package is one undivided directory of files retired, and C17 minted for how a
> package decides its own directories.

## At a glance

**A decision has one home, and the rule is held by the code that does the work, not by whoever
reads the diff.** The review's cost sat in one habit: a decision written out by hand in several
places, nothing failing when a copy is missed.

| The next change | The one way | Copy | [Marks](#how-to-read-a-rule) |
| --- | --- | --- | --- |
| reaching the back end, or storage | one object, handed down, never imported into a screen | `ui/src/api.ts`, `bff/src/server.ts#L11` | next copy · reader |
| a name, a bound, a width, a status's meaning | one exported declaration, imported | `shared/` | next copy · reader |
| a new route | its own module: resolve, authorise, parse, then storage | `bff/src/routes/staff.ts`'s `app.put(employeeRoutes.one(':id')` | next copy · reader |
| a second kind of record | a parameter on the one body | `ui/src/pages/client/ListPage.tsx`'s `ListPage` | next copy · reader |
| a refused save | the message on the field | `ui/src/parts/ProductForm.tsx`'s `ProductForm` | next copy · reader |
| a client's own difference | config; else that client's own page, on the human's call | `shared/src/fields.ts` | next copy · reader |
| reading server data | `useLoad` and `<Loaded>`: no cache, no store | `ui/src/page.ts`'s `useLoad` | holds · reader |

- **One decision, one home**, and the best home is one the working code appends to
  ([one home](#one-home-for-one-decision)).
- **Where two patterns compete the winner is named**, and the loser is not copied again
  ([the winner](#the-winner-named)).
- **One mechanism is held by a check; five more rules are counted by `pnpm counts`, which shows drift and stops nothing; the rest are held by a reader**
  ([how to read a rule](#how-to-read-a-rule)).
- **Where a client's difference lands, and no cache for server data, are the human's decisions**,
  with what a yes commits to, in [that memo](../memo/divergence-and-caching.md).
- **The one file to open for a part, and where each new file goes**
  ([where a new thing goes](#where-a-new-thing-goes)).

## How to read a rule

| Mark | What it says |
| --- | --- |
| `holds` | the code already follows this everywhere the rule reaches |
| `next copy` | it does not. The rule binds the next file written and fixes none of the existing ones: no piece is asked to go back, and the counter-examples named below stay as they are until a piece touches them for its own reason |
| `check` | following the rule makes a check: a command in [the gate](../../CLAUDE.md#the-gate) goes red on a breach |
| `reader` | nothing goes red. A reviewer reading the diff is the guard, and for C1, C4, C5, C6 and C7 `pnpm counts` also shows the drift without stopping it |

Seventeen rules stand in the sections below, and the glance table above is a view of them, marked the
same way. **Each carries an id, `C1` to `C17`, in the order the sections hold them, minted once and
never renumbered or reused**, the discipline [`open-items.md`](../open-items.md) keeps for its items:
a table that reports on the rules is read against the ids, and a rule that is retired leaves its id
unused. **How much of the code follows C1, C4, C5, C6 and C7 is read by running `pnpm counts`, never
typed into this file:** it prints each count with its blind spot beside it, never reds, and ends with
the table of the living documents' citations. **Two of the seventeen carry the mark `check`, and one mechanism holds them**: the registration function that appends a
route's pattern to the list a test reads (`services/c-storage/internal/server/server.go#L51-L54`, held by
`TestEveryRegisteredRouteIsListed`), written before the review. C15 names it as a shape to copy and C2
makes it a rule, `next copy`, so nothing fails anywhere but that one place. **The other fifteen carry the
mark `reader`; five of them are also counted**. Making them checks is what the structure review's own open item exists to do, one check at a time
([open item 160](../open-items.md)).

## Where a new thing goes

**Nothing in this section is a new rule.** It states where the code already puts each kind of file
and which file decides each part, and every row links the rule that binds it. For how the system is
put together, read [`architecture.md`](../architecture.md); this section answers only where the
code lives.

**The shape of a package:** which directories a package has is that package's own decision, made by
[the shape of a package](#the-shape-of-a-package) and written in that package's own `CLAUDE.md`, so a
reader asking where a file goes opens the guideline of the package it goes in — this section does not
hold a layout for all of them. Go is divided by internal package instead (`services/c-storage/internal`), one
package to a thing in the running system. A file is named for the thing it serves, never for its
layer, and a screen's test sits beside it as `<Name>Page.test.tsx`.

### The one file to open, by part

| The part | What decides it | Next, if that was not enough |
| --- | --- | --- |
| which app an address gets | `ui/src/App.tsx#L31-L34`; the operator's door is the test at `#L28-L29` | `ui/src/ClientApp.tsx`, `ui/src/OperatorApp.tsx` |
| what is on screen before any data, and when the service does not answer | `ui/src/frame/Boot.tsx`'s `Boot` | the verdict is `ui/src/ClientApp.tsx#L79`, at `#L99` for the failing case |
| what one page shows while loading or after a failed load | `ui/src/frame/Loaded.tsx`'s `Loaded` | `ui/src/page.ts`'s `useLoad`, the state it draws |
| what every screen is handed | `ui/src/page.ts#L6` (`PageProps`) | built at `ui/src/ClientApp.tsx`; see [the winner](#the-winner-named)'s third row before assuming it |
| the words a screen shows | `ui/src/i18n/en.ts#L2`, whose shape `vi.ts` must match (`ui/src/i18n/en.ts`'s `en`) | — |
| a list of customers or of products | `ui/src/listSheet.ts#L29` (`LISTS`), drawn by `ui/src/pages/client/ListPage.tsx`'s `ListPage` | `bff/src/routes/lists.ts` serves both |
| the day an order is filed under | `ui/src/day.ts#L29` — the browser's calendar day, not the server's clock | — |
| whether a call is allowed | `bff/src/app.ts#L188-L192` (`mustCan`); the note at `#L184` is why the UI is never the guard | who the caller is, `#L157` (`signedIn`); the booleans, `shared/src/permissions.ts#L48`; the catalogue, `#L9` |
| what a failure becomes on the wire | `bff/src/errors.ts#L19` (`replyFor`) | a 400 that names its field, `#L35-L41` |
| a person's sign-in | `bff/src/app.ts#L251` | the refusal and why it names nothing, `#L261-L264` |
| which records exist, and under which key | `shared/src/records.ts#L7` (`recordKeys`), the layout's one home | — |
| how the back end reaches storage, and how long it waits | `shared/src/c-storage.ts#L24` (5 s), the signal, `AbortSignal.timeout(timeoutMs)` | `bff/src/server.ts#L11` builds the one client |
| what c-storage will answer | `services/c-storage/internal/server/server.go#L51-L54`, which registers a route and appends its pattern to the list a test reads | `services/c-storage/internal/` by package |
| what `pnpm stack`, `pnpm fake` and `pnpm demo` do | `scripts/src/cli.ts`, which drives `withStack`, `withFake` and `startDemo` (imported from `./fake`, `./demo/apply` and `./stack`) | `scripts/src/stack.ts`, `fake.ts` |
| which commands must be green | [the gate](../../CLAUDE.md#the-gate) | [QA](qa.md)'s rule 6 for which of them a step runs |
| what the human runs against ridge | [`ops/README.md`](../../ops/README.md) | each script's log in `logs/` in the credo root |

### Where a new file goes

| A new … | Where it goes | Copy | The rule |
| --- | --- | --- | --- |
| screen | `ui/src/pages/client/<Name>Page.tsx`, or `pages/operator/` for the operator's console, or `pages/` itself for one both apps mount, with `<Name>Page.test.tsx` beside it | `ui/src/pages/client/ListPage.tsx`'s `ListPage` for a list of a second kind | the seven places it touches, [before a new screen](#before-a-new-screen) |
| word a screen shows | both dictionaries, `ui/src/i18n/en.ts` and `vi.ts` | — | [before a new screen](#before-a-new-screen) |
| BFF route | its own module, `bff/src/routes/<area>.ts`, with `bff/src/routes/<area>.route.test.ts` beside it — 15 such test files stand there, and 6 more at the top, beside the `bff/src/app.ts` that declares their routes inline | `bff/src/routes/staff.ts`'s `app.put(employeeRoutes.one(':id')` for the order: resolve, authorise, parse, then storage | [the winner](#the-winner-named), and its rule for `staff.ts` and `orders.ts` |
| read or write of a record kind | a module of its own, never the route closure | `bff/src/records/staff-records.ts`'s `readEmployee` | [the winner](#the-winner-named)'s second row |
| name, bound, status meaning or wire shape | `shared/src/<area>.ts`, re-exported from `shared/src/index.ts` — 17 lines, one an area, and `demo` deliberately absent from it | `shared/src/records.ts`, `shared/src/permissions.ts` | [one home](#one-home-for-one-decision) |
| c-storage route | `services/c-storage/internal/server/`, registered through the function that appends its pattern | `services/c-storage/internal/server/server.go#L51-L54` | [the patterns to copy](#the-patterns-to-copy) |
| local command | `scripts/src/<name>.ts` holding the work, with a `<name>-main.ts` of wiring only — `fake-main.ts` is four lines | `scripts/src/fake-main.ts` with `fake.ts` | [the patterns to copy](#the-patterns-to-copy), entry points hold no logic |
| walk | `walk/specs/<name>.spec.ts`, its name in the walk table at `walk/run.sh`'s `WALKS`, its base images in `<name>.spec.ts-snapshots/` beside it | an existing spec | [before a new screen](#before-a-new-screen) |
| screen on the walks page | `visual/src/` | `visual/src/walks.ts` | [before a new screen](#before-a-new-screen) |
| ops script or template | `ops/`, its steps added to the runbook in `ops/README.md` | its siblings in `ops/` | [the gate](../../CLAUDE.md#the-gate)'s rows 3 to 5 are what an `ops/` change needs |

### Where a reader still has to follow a chain

Named because a structure can be disciplined and still be slow to read under pressure, and because
the 2026-11-08 review measured the first and not the second. These are not rules and nothing here
asks for a fix.

- **A 403 takes four hops to explain.** `bff/src/app.ts#L188-L192` asks one boolean; the caller is
  built by `signedIn` at `#L157`, whose view comes from `viewOf` at `#L121`, which resolves the
  booleans through `shared/src/permissions.ts#L48` over the layers `#L36` returns. And the data
  that decided it — the tenant's setup and the person's own layer — is in two records, not in any
  file a reader can open.
- **How a screen gets its data cannot be read off the screen.** The one way is handed down in
  `PageProps` (`ui/src/page.ts#L6`), and [the winner](#the-winner-named)'s third row records how
  many screens import the client directly instead. Until that is one way, a reader opens the
  particular screen's imports first.
- **Two routes do not use the one error path**, so a wrong reply shape is not always explained by
  `bff/src/errors.ts`; [the winner](#the-winner-named)'s fourth row names both.

## One home for one decision

**C1 · A name, a bound, a width, a status's meaning or a path derivation is declared once and
imported; no file reads another file's source text to check that two copies agree.**
`[next copy · reader]` *Why:* a
missed copy fails nothing — `walk/run.sh#L296` still hands out `CREDO_OPERATOR_PASSWORD`, a name
dropped when the operator console replaced it with `CREDO_OPERATOR_LINK`, and a wrong name reads as
`undefined` and fails at some later assertion in another file.

The review's worst instances, as the shape to recognise, each since given the one home named at the
end of its clause: eleven environment names minted in `scripts/src/cli.ts` (ten of them in one block,
`CREDO_COPIES` apart) and read as string literals in twelve `walk/specs/*.spec.ts` (now `STACK_ENV` in
`shared/src/env.ts`); the retry bound as four constants all `3` (in `bff/src/records/staff-records.ts`,
`bff/src/records/operators.ts`, `bff/src/routes/orders.ts` and `bff/src/calling/sessions.ts`), so whoever found one believed
they had found the bound (now `ATTEMPTS` in `shared/src/c-storage.ts`); what a 403 means re-decided in
five screens (`ui/src/pages/client/AddRecordPage.tsx`'s `AddRecordPage`, `ui/src/pages/client/RecordPage.tsx`'s `RecordPage`,
`ui/src/pages/client/RecordPage.tsx`'s `RecordPage`, `ui/src/pages/client/PersonPage.tsx`'s `PersonPage`, and
`ui/src/pages/client/SettingsPage.tsx`'s `SettingsPage`, which re-implemented the helper rather than calling it)
(now `isForbidden` in `ui/src/page.ts`); "list under a prefix, refuse a truncated answer, parse each
one" written four times (in `bff/src/records/clients.ts`, `bff/src/routes/lists.ts`, `bff/src/routes/orders.ts` and
`bff/src/routes/staff.ts`, the last three as a local function each) while `bff/src/routes/orders.ts` already held the
general version (now `every` in `bff/src/records/records.ts`'s `recordTools`); and the three screen widths
declared four times (in `visual/src/walks.ts`, `walk/support.ts`, `ui/src/mock/MockPage.tsx` and
`ui/src/mock/Frame.tsx`), held level only by a regex in `visual/src/walks.test.ts` that read one of
them as source text, so a reformat broke the check and a fifth copy would not have tripped it (now
`WIDTHS` in `shared/src/widths.ts`).

**C2 · Where the one home can be a list the working code appends to, make it one**, so a missed edit is
a red and not a green — the model is the registration in [the patterns to
copy](#the-patterns-to-copy). `[next copy · check]` The one place the shape exists is held by a
test; everywhere else nothing fails.

**C3 · Parameterise a second kind rather than copy its screens.** `[next copy · reader]`
`ui/src/pages/client/RecordPage.tsx`'s `RecordPage` and `ui/src/pages/client/RecordPage.tsx`'s `RecordPage` are the same page shell
written twice, 89 lines and 97, and their add screens the same again, 58 lines and 56
(`ui/src/pages/client/AddRecordPage.tsx`'s `AddRecordPage`, `ui/src/pages/client/AddRecordPage.tsx`'s `AddRecordPage`); a third kind pays it a
third time, and changing how a conflict is offered is an edit in two files nothing makes you find.
*Why:* the lists already prove the cheaper shape — `bff/src/routes/lists.ts` serves both from one 165-line
body registered twice (`bff/src/routes/lists.ts`'s `registerListRoutes`) and `ui/src/pages/client/ListPage.tsx`'s `ListPage` draws both from one table.

## The winner, named

**Where two patterns do one job, the one below is the one to write; the other is not copied
again.** *Why:* the next piece copies whichever it meets first, so import order is currently making
design decisions — and for the first row the human's principle decides it outright: "don't make
user surprise or confuse", and two behaviours in one app is itself the surprise. Every row is
`[next copy · reader]`: each is the minority shape today, and nothing goes red when the other is
written again.

| The job | The one way | Copy | How much of the code follows it, and what the 2026-11-08 review found |
| --- | --- | --- | --- |
| C4 · a form reports a refusal | per field against the shared schema, the message on the field; one alert above the card only for a whole-form refusal | `ui/src/parts/ProductForm.tsx`'s `ProductForm` | `pnpm counts` (C4: a named list of the forms); the other shapes are a `tried` flag and a guard clause with one alert (`ui/src/pages/client/OwnPasswordPage.tsx`'s `change`) |
| C5 · storage is reached in the back end | a record kind's reads and writes in a module of its own, never in the route closure | `bff/src/records/staff-records.ts`'s `readEmployee` | `pnpm counts` (C5: the calls made in a file that registers routes, against those made in a module) |
| C6 · a screen gets its data | handed down in `PageProps`, never the API client imported into the screen | `ui/src/page.ts#L6`, built at `ui/src/ClientApp.tsx#L249` | `pnpm counts` (C6) |
| C7 · an error becomes a response | thrown, and the one handler writes the reply | `bff/src/app.ts#L92` | two routes write it themselves (`bff/src/app.ts#L226-L228`, `bff/src/routes/operator-auth.ts`'s `registerOperatorAuth`), and the conflict reply has four spellings while `shared/src/wire.ts#L151` declares the schema all of them mean to meet |
| C8 · a command dispatches and fails | one dispatch with one catch, the exit codes stated once | — | `scripts/src/ridge.ts`'s `runRidge` is a seven-arm chain under one catch that turns a new failure into exit 1; `scripts/src/walks.ts`'s `walksCommand` is three arms each with its own catch and prefix. `scripts/src/cli.ts` is outside this rule: its three commands are a lifecycle, not a verb table |

**C9 · A handler's steps run in this order — resolve the caller, authorise, parse the body, then touch
storage** (`bff/src/routes/staff.ts`'s `app.put(employeeRoutes.one(':id')`). `[holds · reader]` *Why:* every route registration keeps it
(`pnpm counts` counts them under C7) and nothing holds them to it, so a route that parses before it authorises passes every check in the
repo.

**C10 · The next route added to `bff/src/routes/staff.ts` or `bff/src/routes/orders.ts` goes in its own module**, as the
five smaller modules already do. `[next copy · reader]` *Why:* those two are single closures of 629
and 453 lines (`bff/src/routes/staff.ts`'s `registerStaffRoutes` and `bff/src/routes/orders.ts`'s `registerOrderRoutes`, each to the end of its file), 42 and 40
branches as the 2026-11-08 review counted them, and nobody can judge either in one read.

## The patterns to copy

Naming the model is the rule; these are the shapes a new piece follows rather than inventing a
second one. Each row is `[holds · reader]` — the shape is what the code does today, and nothing goes
red when a new file invents a second one — except the last, which is `[holds · check]`.

| The shape | Where it is |
| --- | --- |
| C11 · one object makes every call to the back end, taking `fetch` as a parameter; storage is reached only through the client declared once and built once | `ui/src/api.ts`, `shared/src/c-storage.ts`'s `createCStorageClient`, `bff/src/server.ts#L11` (no `fetch` anywhere in `bff/src`) |
| C12 · a contract declared once and passed down, never resolved by hand per caller | `ui/src/page.ts#L6`; authorisation at `bff/src/app.ts#L157-L188`; loading and failure drawn by `ui/src/frame/Loaded.tsx`'s `Loaded` |
| C13 · entry points hold wiring and no logic | `scripts/src/*-main.ts` (4–23 lines each), `services/c-storage/cmd/server/main.go` (35 lines, the process in `internal/lifecycle`) |
| C14 · one body serving every kind, the kind as data | `LISTS` in `ui/src/listSheet.ts#L29`, drawn by `ui/src/pages/client/ListPage.tsx`'s `ListPage`, served by `bff/src/routes/lists.ts` |
| C15 · **a rule held by code rather than by a reviewer**: the function that registers a route also appends its pattern to a list, and a test fails when one is added without an entry | `services/c-storage/internal/server/server.go#L51-L54`, held by `TestEveryRegisteredRouteIsListed` (`services/c-storage/internal/server/server_test.go#L106`) |

## Where a client's difference lands

The tiers, the ladder and the commercial gate are the human's decision, and they live in
[the memo](../memo/divergence-and-caching.md#1-where-a-clients-difference-lands) with what a yes
commits to. What binds a session writing code is the glance table's row: config, else that client's
own page, never a knob on a shared body.

## Server data and client state

The no-cache stance, the two homes for client state and the three conditions that may end it are
the human's decision, and they live in
[the memo](../memo/divergence-and-caching.md#3-server-data-and-client-state). What binds a session
writing code is the glance table's row: `useLoad` and `<Loaded>`, no cache and no store, and no
`fetch` in a component.

## Before a new screen

**C16 · Work the list of places one screen touches, because at least seven exist and nothing lists
them:** the page, the fake (`ui/src/fake.ts`), its route in the app shell, both dictionaries, its
test, a walk scene and a base image before the visual report can show it. `[next copy · reader]`
*Why:* a screen that reaches the walks page without its scene and base is a screen the human cannot
judge, and the project is about to add screens faster than it has.

## The shape of a package

**C17 · A package divides by what its files are — a screen, a part, the frame, a route module, a
record's reads and writes — never by their layer, and a directory earns its name only where
"everything in here is a ___" finishes in a word the product itself uses.** `[next copy · reader]`
So there is no `utils/`, no `constants/` and no `helpers/`: **a directory whose name the product does
not use is not a directory**, and the files that would have filled it stay where they are. **The
directory set is each package's own**, read off what that package's files are and **written in that
package's own `CLAUDE.md`; no package copies another's folders because the two are the same kind of
thing** — the two back ends read for this rule share no directory set, and neither one's is a subset
of the other's, so the kind of a package predicts nothing about its folders. **Where no sentence
finishes, the package stays flat, and flat is the answer rather than the absence of one:**
`shared/src` and `visual/src` are flat because every file in them is already named for the thing it
serves. **A test sits beside its subject, and beside the app where the subject is the app.**

**A further level inside a directory is added on a count of this code base, never by imitation of
another layout.** A folder per feature or module under the screens was measured and refused: the
modules it would need cannot be built, because one list screen and one import screen each serve both
kinds of record (`ui/src/pages/client/ListPage.tsx`'s `ListPage` and `ui/src/pages/client/ListImportPage.tsx`'s
`ListImportPage`, both taking `kind`), and 13 of the UI's test files today have no same-named source
at all, covering a flow or a whole app rather than one screen, so several would have no module
to sit in. So meeting that shape in another repository is not a precedent here.
**A package being reorganised writes its directory set into its own `CLAUDE.md` in the same change as
the move, never before** — a guideline naming a folder that does not exist yet is wrong for as long
as the move takes — as `ui/CLAUDE.md` does, written in the change that moved `ui`; `bff` names no set yet.

*Why:* nothing in the gate reads a directory, so a layer folder, a copied folder set and a package
whose `CLAUDE.md` names none of its folders all pass green; the mark is `reader` because the reader
of the diff is the only guard there is. **What would make it a `check` is a per-package tree
generated beside `pnpm counts`** — one line a directory, the package's own sentence for it written by
hand and its file and line counts generated, with the gate regenerating the tree and diffing it so a
stale one goes red. **That is not built**, and until it is a generated tree is the worse answer: a
reader trusts it and it lies with nothing red anywhere.
