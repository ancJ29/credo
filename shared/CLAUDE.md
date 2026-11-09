# shared
Stack: TypeScript, `zod` its only dependency · Gate: `pnpm check` from the repository root · Ship: none, a workspace package

What the halves of a call agree on, kept once: the wire contract between the UI and the BFF, the
BFF's client for c-storage, the record layout, the bounds both sides check. It is a destination:
[the code convention](../docs/conventions/code.md) says what goes in; this file says what earns a place
and where it lands. The package's tests run at 100 % of statements, branches, functions and lines
(`vitest.config.ts`'s `thresholds`), so an export without a case fails the gate.

## What belongs here, and what does not

- **SH1. A thing is here when a second package reads it** (the UI echoes what the BFF enforces; scripts, walk and visual
  count). Until then it stays with its one reader. Two standing exceptions are named by
  [the app frame](../docs/plans/2026-10-27-app-frame.md#the-stack): the c-storage client, and the body hash. `sha256Hex`
  has the BFF alone as a reader today, a leftover; it is no precedent for a new single-reader file.
- **SH2. How the BFF talks to storage lives in `c-storage.ts`, beside `DEFAULT_TIMEOUT_MS` and `ATTEMPTS`,** whoever reads it:
  how long a call waits, how often a moved record is tried again.
- **SH3. Nothing here is a sentence a person reads.** A refusal's text is a short phrase of what was expected
  (`'a code'`); the words a screen shows are the UI's dictionaries. A client's own difference is not here
  either (config, else that client's page).
- **SH4. Nothing here needs a runtime beyond the web's:** no `node:` import, no framework, no clock, no
  randomness. A day arrives as text (`daySchema`), `fetch` as a parameter (`createCStorageClient`).
  Only test files import `node:`.

## The file to copy

A new area is `shared/src/<area>.ts` with `<area>.test.ts` beside it, one line added to `index.ts`.
Copy `lists.ts` for a shape and its bounds: `customerSchema` and the type `Customer` from it.

## This package's own rules

- **SH5. A schema of ours is `z.strictObject`**. `z.object` or `z.looseObject` only where
  another party owns the shape: `recordReplySchema` (c-storage's answers), `ceremonyOptionsSchema` (WebAuthn).
  `bffErrorSchema` is ours and loose, the one slip; the next file does not copy it.
- **SH6. Names:** `<thing>Schema` with its type beside it, from `z.infer` (`z.output` where the schema has
  a default); a bound is `UPPER_SNAKE`; a check is `<thing>IsValid` (`photoIsValid`, `employeeCodeIsValid`).
  `isHexColour` is the one other spelling; the next check takes the suffix.
- **SH7. Imports run one way.** An area imports areas beneath it and nothing imports it back; the
  bottom ones import no area (`recordKeys`' file, `PERMISSIONS`' file). Nothing imports `demo`, which is data
  and reached by `@credo/shared/demo` alone. A new area imports the existing ones and none imports it.

## Non-obvious facts

- **`extraInputSchema` checks the input as it came; `extraSchema` only adds the default `{}`:** a request
  uses the first, a stored record the second
  ([why](../docs/memo/extra.md#the-rules)).
- **`c-storage.bruno.test.ts` reads `c-storage/bruno/`:** a request changed there turns the client red here
  ([why](../docs/plans/2026-10-27-app-frame.md#the-frame)).
- **A strict schema refuses a key it does not know,** so a field added to a contract whose halves deploy
  apart needs its default at the wire boundary in the same commit
  ([why](../CLAUDE.md#non-obvious-facts)).

## Where the rest is

- The big picture: [`docs/architecture.md`](../docs/architecture.md#at-a-glance).
- The cross-package rules: [`docs/conventions/code.md`](../docs/conventions/code.md).
- The sibling to copy: [`bff/CLAUDE.md`](../bff/CLAUDE.md), TypeScript like this package and the heaviest reader of
  what it declares; its section 2 is the other side of SH1.
