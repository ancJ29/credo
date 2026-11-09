# Code

> **Decided** 2026-11-09, from the whole-code-base structure review of 2026-11-08. **This is the
> machine's own house style, and it needs no approval from the human:** how the code here is written
> is the machine's decision, and this file binds every session that adds or changes code. It names
> the one way only where the repo already holds two ways of doing one job, and the file to copy where
> it already holds the shape; it does not inventory what the code does consistently. The decisions
> that are the human's — what the system should be, rather than how it is written — are in
> [a client's own difference, a screen's behaviour, and server
> data](../memo/divergence-and-caching.md). This file holds the rules as they stand; their history is
> in `git log`.
> **Last amended** 2026-11-09, from the human's reading of this file: the three decisions that are
> theirs split out to that memo, and every rule here marked for whether the code already holds it
> and for what holds it.

## At a glance

**A decision has one home, and the rule is held by the code that does the work, not by whoever
reads the diff.** The review's cost sat in one habit: a decision written out by hand in several
places, nothing failing when a copy is missed.

| The next change | The one way | Copy | [Marks](#how-to-read-a-rule) |
| --- | --- | --- | --- |
| reaching the back end, or storage | one object, handed down, never imported into a screen | `ui/src/api.ts`, `bff/src/server.ts#L11` | next copy · reader |
| a name, a bound, a width, a status's meaning | one exported declaration, imported | `shared/` | next copy · reader |
| a new route | its own module: resolve, authorise, parse, then storage | `bff/src/staff.ts#L417` | next copy · reader |
| a second kind of record | a parameter on the one body | `ui/src/ListPage.tsx#L14` | next copy · reader |
| a refused save | the message on the field | `ui/src/ProductPage.tsx#L180-L198` | next copy · reader |
| a client's own difference | config; else that client's own page, on the human's call | `shared/src/fields.ts` | next copy · reader |
| reading server data | `useLoad` and `<Loaded>`: no cache, no store | `ui/src/page.ts#L31` | holds · reader |

- **One decision, one home**, and the best home is one the working code appends to
  ([one home](#one-home-for-one-decision)).
- **Where two patterns compete the winner is named**, and the loser is not copied again
  ([the winner](#the-winner-named)).
- **One rule here is held by a check, and every other by a reader**
  ([how to read a rule](#how-to-read-a-rule)).
- **Where a client's difference lands, and no cache for server data, are the human's decisions**,
  with what a yes commits to, in [that memo](../memo/divergence-and-caching.md).

## How to read a rule

| Mark | What it says |
| --- | --- |
| `holds` | the code already follows this everywhere the rule reaches |
| `next copy` | it does not. The rule binds the next file written and fixes none of the existing ones: no piece is asked to go back, and the counter-examples named below stay as they are until a piece touches them for its own reason |
| `check` | following the rule makes a check: a command in [the gate](../../CLAUDE.md#the-gate) goes red on a breach |
| `reader` | nothing goes red; a reviewer reading the diff is the only guard |

Sixteen rules stand in the sections below, and the glance table above is a view of them, marked the
same way. **One of the sixteen is held by a check**: the registration function that appends a
route's pattern to the list a test reads (`c-storage/internal/server/server.go#L51-L54`, held by
`TestEveryRegisteredRouteIsListed`), and it was written before the review. It is named twice below —
as the rule [one home](#one-home-for-one-decision) states and as the shape [the patterns to
copy](#the-patterns-to-copy) names — and it is one mechanism in one file. **The other fifteen are
`reader`**, which is what the structure review's own open item exists to change, one check at a time
([open item 159](../open-items.md)).

## One home for one decision

**A name, a bound, a width, a status's meaning or a path derivation is declared once and
imported; no file reads another file's source text to check that two copies agree.**
`[next copy · reader]` *Why:* a
missed copy fails nothing — `walk/run.sh#L296` still hands out `CREDO_OPERATOR_PASSWORD`, a name
dropped when the operator console replaced it with `CREDO_OPERATOR_LINK`, and a wrong name reads as
`undefined` and fails at some later assertion in another file.

The review's worst instances, as the shape to recognise: eleven environment names minted in
`scripts/src/cli.ts` (ten of them at `#L132-L141`, `CREDO_COPIES` at `#L210`) and read as string
literals in twelve `walk/specs/*.spec.ts`; the
retry bound as four constants all `3` (`bff/src/staff-records.ts#L58`, `operators.ts#L21`,
`orders.ts#L48`, `sessions.ts#L27`), so whoever finds one believes they have found the bound; what a
403 means re-decided in six screens (`ui/src/AddCustomerPage.tsx#L41`, `CustomerPage.tsx#L49`,
`ProductPage.tsx#L69`, `PersonPage.tsx#L660`, and `SettingsPage.tsx#L32`, which re-implements the
helper rather than calling it); "list under a prefix, refuse a truncated answer, parse each one"
written four times (`bff/src/clients.ts#L95`, `lists.ts#L105`, `orders.ts#L68`, `staff.ts#L179`)
while `bff/src/orders.ts#L66` is already the general version; and the three screen widths declared
four times (`visual/src/walks.ts#L26`, `walk/support.ts#L9`, `ui/src/mock/MockPage.tsx#L16`,
`ui/src/mock/Frame.tsx#L8`), held level only by a regex in `visual/src/walks.test.ts` that reads one
of them as source text, so a reformat breaks the check and a fifth copy would not trip it.

**Where the one home can be a list the working code appends to, make it one**, so a missed edit is
a red and not a green — the model is the registration in [the patterns to
copy](#the-patterns-to-copy). `[next copy · check]` The one place the shape exists is held by a
test; everywhere else nothing fails.

**Parameterise a second kind rather than copy its screens.** `[next copy · reader]`
`ui/src/CustomerPage.tsx#L23-L111` and `ui/src/ProductPage.tsx#L43-L139` are the same page shell
written twice, 89 lines and 97, and their add screens the same again, 58 lines and 56
(`AddCustomerPage.tsx#L21-L78`, `AddProductPage.tsx#L24-L79`); a third kind pays it a
third time, and changing how a conflict is offered is an edit in two files nothing makes you find.
*Why:* the lists already prove the cheaper shape — `bff/src/lists.ts` serves both from one 169-line
body registered twice (`#L94-L262`) and `ui/src/ListPage.tsx#L14` draws both from one table.

## The winner, named

**Where two patterns do one job, the one below is the one to write; the other is not copied
again.** *Why:* the next piece copies whichever it meets first, so import order is currently making
design decisions — and for the first row the human's principle decides it outright: "don't make
user surprise or confuse", and two behaviours in one app is itself the surprise. Every row is
`[next copy · reader]`: each is the minority shape today, and nothing goes red when the other is
written again.

| The job | The one way | Copy | What the 2026-11-08 review counted |
| --- | --- | --- | --- |
| a form reports a refusal | per field against the shared schema, the message on the field; one alert above the card only for a whole-form refusal | `ui/src/ProductPage.tsx#L180-L198` | 6 of 13 forms draw a field error, 3 use a `tried` flag, 10 use a guard clause and one alert (`ui/src/OwnPasswordPage.tsx#L26-L52`) |
| storage is reached in the back end | a record kind's reads and writes in a module of its own, never in the route closure | `bff/src/staff-records.ts#L22` | 34 of 98 calls, against 64 inline in `staff.ts`, `orders.ts`, `lists.ts`, `reconciliations.ts` |
| a screen gets its data | handed down in `PageProps`, never the API client imported into the screen | `ui/src/page.ts#L6`, built at `ui/src/ClientApp.tsx#L249` | 24 of 62 screens import it directly, 38 take what they need; re-counted 2026-11-09, still 24 of 62 |
| an error becomes a response | thrown, and the one handler writes the reply | `bff/src/app.ts#L92` | two routes write it themselves (`bff/src/app.ts#L226-L228`, `operator-auth.ts#L435`), and the conflict reply has four spellings while `shared/src/wire.ts#L151` declares the schema all of them mean to meet |
| a command dispatches and fails | one dispatch with one catch, the exit codes stated once | — | `scripts/src/ridge.ts#L51-L205` is a seven-arm chain under one catch that turns a new failure into exit 1; `walks.ts#L160-L193` is three arms each with its own catch and prefix. `scripts/src/cli.ts` is outside this rule: its three commands are a lifecycle, not a verb table |

**A handler's steps run in this order — resolve the caller, authorise, parse the body, then touch
storage** (`bff/src/staff.ts#L417`). `[holds · reader]` *Why:* all 63 route registrations keep it
and nothing holds them to it, so a route that parses before it authorises passes every check in the
repo.

**The next route added to `bff/src/staff.ts` or `bff/src/orders.ts` goes in its own module**, as the
five smaller modules already do. `[next copy · reader]` *Why:* those two are single closures of 629
and 453 lines (`bff/src/staff.ts#L106`, `bff/src/orders.ts#L95` to the end of each file), 42 and 40
branches as the 2026-11-08 review counted them, and nobody can judge either in one read.

## The patterns to copy

Naming the model is the rule; these are the shapes a new piece follows rather than inventing a
second one. Each row is `[holds · reader]` — the shape is what the code does today, and nothing goes
red when a new file invents a second one — except the last, which is `[holds · check]`.

| The shape | Where it is |
| --- | --- |
| one object makes every call to the back end, taking `fetch` as a parameter; storage is reached only through the client declared once and built once | `ui/src/api.ts`, `shared/src/c-storage.ts#L86`, `bff/src/server.ts#L11` (no `fetch` anywhere in `bff/src`) |
| a contract declared once and passed down, never resolved by hand per caller | `ui/src/page.ts#L6`; authorisation at `bff/src/app.ts#L157-L188`; loading and failure drawn by `ui/src/Loaded.tsx#L12` |
| entry points hold wiring and no logic | `scripts/src/*-main.ts` (4–23 lines each), `c-storage/cmd/server/main.go` (35 lines, the process in `internal/lifecycle`) |
| one body serving every kind, the kind as data | `LISTS` in `ui/src/listSheet.ts#L29`, drawn by `ui/src/ListPage.tsx#L14-L19`, served by `bff/src/lists.ts` |
| **a rule held by code rather than by a reviewer**: the function that registers a route also appends its pattern to a list, and a test fails when one is added without an entry | `c-storage/internal/server/server.go#L51-L54`, held by `TestEveryRegisteredRouteIsListed` (`c-storage/internal/server/server_test.go#L106`) |

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

**Work the list of places one screen touches, because at least seven exist and nothing lists
them:** the page, the fake (`ui/src/fake.ts`), its route in the app shell, both dictionaries, its
test, a walk scene and a base image before the visual report can show it. `[next copy · reader]`
*Why:* a screen that reaches the walks page without its scene and base is a screen the human cannot
judge, and the project is about to add screens faster than it has.
