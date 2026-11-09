# ui
Stack: React with Mantine, Vite, Vitest on jsdom · Gate: `pnpm check` from the root, which runs this package's typecheck, lint and tests at 100 % · Ship: the files in S3 behind CloudFront

Everything a browser draws: the client app and the operator console, one bundle chosen by address.
Its only door to the back end is the object `ui/src/api.ts`'s `createApi` makes.

## What belongs here, and what does not

- **A screen, the words it shows, and the fake that lets it be walked** belong here. Which app a
  new screen belongs to is decided by its address: `ui/src/App.tsx`'s `isOperatorPath` sends
  `/operator` to `ui/src/OperatorApp.tsx`, every other address to `ui/src/ClientApp.tsx`, and a screen
  is mounted in the one file that serves its address. What both apps import is common, and the
  repo records it nowhere but in those two files' imports
  ([open item 166](../docs/open-items.md)).
- **A name, bound, width or wire shape belongs in `shared/`**, not declared here.
- **A rule the server must hold belongs in `bff/`;** a screen never guards.
- **`ui/frame-mock/` and `ui/signin-mock/` are static looks, outside lint,** not product code.

## The file to copy

- **A screen:** `ui/src/ListPage.tsx`'s `ListPage`, which takes `PageProps`, reads through `useLoad`
  and draws through `Loaded`; for a form, `ui/src/ProductPage.tsx`'s `ProductForm`.
- **A call to the back end:** a method on `createApi`, with its twin in `ui/src/fake.ts`'s
  `createFakeApi`, which must answer the same shape.
- **A screen's test:** `ui/src/ListPage.test.tsx`, which opens the whole app through
  `ui/tests/open.tsx`'s `openApp` and walks a person's story.
- **A word:** both dictionaries, `ui/src/i18n/en.ts` first; `vi.ts` takes its shape from it.

## This package's own rules

None minted: [code](../docs/conventions/code.md) governs this package, and a reviewer invokes it
by these headings.

- **Before a new screen**: any new screen, for the places it touches beyond its own file.
- **Server data and client state**: a screen that reads, keeps or re-reads server data.
- **The winner, named**: a form reporting a refusal; a screen reaching its data other than by
  `PageProps`.
- **One home for one decision**: a second kind of an existing screen, or a name or status meaning
  written out again.
- **The patterns to copy**: a new call to the back end, or any `fetch` in a component.
- **Where a client's difference lands**: a screen that differs for one company
  ([the memo](../docs/memo/divergence-and-caching.md#1-where-a-clients-difference-lands)).

## Non-obvious facts

- **`useLoad` reads again only when its `deps` change; the caller names them**, because `load` is
  new every render and the lint rule is switched off at that line (`ui/src/page.ts`'s `useLoad`).
  A missing dependency shows a stale page and fails nothing.
- **A page never answers a 401 or 403 itself:** `ui/src/page.ts`'s `refusal` signs the person out
  or has the app read who they are again, and the page shows its failure.
- **The operator's door is drawn outside the client's boot,** which asks a company's settings
  first; an operator belongs to no company (`ui/src/App.tsx`'s `App`).
- **The two `main.tsx` entries are outside the 100 %,** held by tests elsewhere
  (`ui/vitest.config.ts`'s comment); logic put in one is unchecked.
- **A typing test fails under load:** use `userEvent.setup({ delay: null })`, and paste where
  keystrokes are not the subject ([open item 27](../docs/open-items.md)).
- **The icon strip's tip is held by a test that reads `ui/src/frameLook.module.css` as text,**
  since jsdom has no computed styles; a reformat of that file breaks it
  ([open item 95](../docs/open-items.md)).

## Where the rest is

- The big picture: [`architecture.md`](../docs/architecture.md#at-a-glance).
- The cross-package rules: [`code.md`](../docs/conventions/code.md).
- The sibling to copy: [`bff/CLAUDE.md`](../bff/CLAUDE.md), the other half of the same wire.
