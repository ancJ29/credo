# The gallery as a workbench, at its own address on ridge

## At a glance

What it is for, in the human's words of 2026-11-17 10:3x: "on the gallery, plz help me with this - add
storybook-like layout, current one is hard to check - have a dedicated route for that page, on this
path <url>/48b74d079/gallery". The human said yes at 10:45 to that morning's mock (the orchestrator's
`worktrees/mocks/2026-11-17-gallery-workbench/index.html`): the parts down one side by level, one
part at a time with its states side by side, a "Show" switch between all states and one.

The cheapest safe path is a route of the app already deployed, not a second page: ridge already
serves every dotless address as the app's page, so no hosting changes. The gallery leaves
`gallery.html` for that address, in a chunk only its visitor downloads. It is the design system's
landing 4, brought forward by the human's ask and drawn as the mock, without its search. The price:
about 72 machine minutes, the human's push, and one look on ridge.

## The slice

One slice, walkable when the plan ends: on ridge, `<a ridge address>/48b74d079/gallery` opens the
workbench with no sign-in; a part in the list opens at its own address,
`/48b74d079/gallery/organisms/door-card`, with its group, its name, its one-line description, its
props and its states; the switch shows its states one at a time; the same page reads on a phone.

The first step is that address end to end on the fake, with today's gallery drawn there unchanged;
the second turns it into the workbench. Nothing of the BFF or c-storage is touched: the page reads
no record and calls no API.

## How the page is served, measured

- **Ridge answers the address with the app already.** The distribution's viewer-request function
  serves any path whose last segment has no dot as `/index.html` (`ops/env.yml#L692-L711`,
  `UiRewrite`), and `ops/test.sh#L333-L340` runs that code on `/settings/brand`, a two-segment page
  path, getting `/index.html`. `/48b74d079/gallery` and `/48b74d079/gallery/atoms/field-label` are
  the same shape. A file keeps its own path, so a chunk under `/assets/` is served as itself. The
  UI's files reach the bucket with each push to `main` that touches `ui/**`
  (`.github/workflows/ci.yml#L15`, `#L761`, `#L821`), `index.html` last and read again at every
  visit (`ops/app.sh#L144-L150`).
- **The local fronts do the same.** The fake's and the stack's front answer any path that names no
  file with the app's page (`scripts/src/running/front.ts#L96-L113`), and Vite's dev server falls back
  to `index.html` for a page path.
- **The app picks its door from the address.** `ui/src/App.tsx#L32-L38`'s `isOperatorPath` sends
  `/operator` and what is below it to the console and every other address to `ClientApp`, which reads
  a company's settings before anything; `ui/src/App.test.tsx`'s "sends any other path to the first
  page" holds that today `/48b74d079/gallery` lands on a client's first page.
- **The entry is past its warning limit already.** A build of `pre-merge` at `a0514569`, made for
  this plan into a scratch folder, wrote an entry of 1,010.91 kB (297.55 kB gzipped) and printed
  Vite's "larger than 1000 kB" warning; `ui/vite.config.ts#L16` sets that limit, and
  `docs/memo/ui.md#L136-L148` still reads 997.05 kB, with the warning as its trigger. Filed as open
  item 555; this piece adds to it nothing but the address test.
- **The gallery today** is `ui/gallery.html` loading `ui/src/design-system/main.tsx#L6`, which
  draws `ui/src/design-system/Gallery.tsx`'s `Gallery`: `Values` (`#L157-L171`), `Mantines`
  (`#L173-L207`) and `LEVELS` (`#L91-L155`), every part drawn at once down one column. The app's build
  reads `index.html` alone (`ui/vite.config.ts#L14`), so the gallery is in no bundle and runs only on
  the human's machine.

## Decided for the page

Each line is the machine's decision, vetoed on sight.

- **A route of the app's router, drawn lazily.** `App` tests the address before `isOperatorPath`:
  exactly `/48b74d079/gallery`, or below `/48b74d079/gallery/`, draws `Gallery` through
  `React.lazy`, in a `Suspense` around that branch alone; a near miss (`/48b74d079`,
  `/48b74d079/galleryx`) stays the client's app, as `/operators` does. The gallery's code, its
  samples and its words become a chunk of their own, so a client's phone downloads none of it, and
  the warning of item 555 does not grow. *Rejected:* a second entry served at the address. The
  rewrite would have to map that path to `/gallery.html`: a change to `ops/env.yml`'s function and
  `ops/test.sh`'s rows, applied to ridge by the human's own stack run, for no gain. *Rejected:* the
  gallery in the entry, as `ui/vite.config.ts#L15`'s "no route is split off until a page is heavy"
  would have it: that rule was written under the limit the entry has now passed.
- **`ui/gallery.html` and `ui/src/design-system/main.tsx` go**, with the entry's test
  (`Gallery.test.tsx#L76-L85`): one page, one address, locally too (`pnpm exec vite --open
  /48b74d079/gallery` in `ui/`, or `pnpm fake`'s address with that path).
- **The list kept by hand, held by the files.** The table of parts moves from `LEVELS` to
  `ui/src/design-system/entries.tsx`, as landing 4 decided
  (`docs/plans/2026-11-12-design-system.md#L130-L148`): each entry its group, its name, its
  description, its props and its states, each state named. The side list, its groups and their
  counts are drawn from that table. The test's glob (`Gallery.test.tsx#L6-L8`) stays the guard:
  every component file of the three folders has its entry in its level's group. Each entry's
  description and props are written as the mock shows them, which are each component's own doc
  comment and props (`ui/src/components/atoms/BackLink.tsx#L4-L5`, and alike in all eleven), and
  the test reads each file as text to hold them equal. *Rejected:* the list built from the files in
  the page: a file gives a name, not a sample's props, and a stories file beside each part is
  Storybook's shape, rejected on 2026-11-16.
- **`ui/src/parts/` stays out.** A part there is a piece a screen is built from
  (`ui/CLAUDE.md#L39-L40`), not one of the design system's; the mock lists `components/` and the
  two foundations alone.
- **The three states the mock adds are kept**: the door heading with its title only, the logo tile
  with no logo (it draws nothing, so the state's box says "draws nothing"), the page header with its
  title only. Each is allowed by the part's own props (`DoorHeading`'s `subtitle?`, `LogoTile`'s
  `logo?`, `PageHeader`'s `actions?`). The mock's "not in today's gallery" tag and its closing note
  are the mock's own and are not drawn.
- **Addresses, as landing 4 named them**: `/48b74d079/gallery/<level>/<part>` in lower case with
  hyphens (`foundations/values`, `atoms/field-label`). The bare address opens the first part,
  `Values`; an address that names no part says so beside the list and draws no part (landing 4's
  case 17). The list's rows are the router's links, the open one marked current. The mock opened on
  the door card to show a part of two states; the first part is what a workbench opens on.
- **The switch** shows only on a part of two states or more, two joined buttons as the mock: "All
  states side by side" and "One state at a time", the second adding a row of the states' names. It
  goes back to all states when another part opens.
- **The frame is the mock's**: a header in the brand's gradient with "Design system", "Every part,
  one at a time" and the address; a list 250 px wide; the part's group above its name. It is drawn
  with Mantine and one `ui/src/design-system/Gallery.module.css`, reading the theme's variables; the
  design system's folder is outside the colour check (`ui/src/design-system/literals.test.ts#L14`).
  Light whatever the device asks, as today.
- **At phone width**, below Mantine's `sm`, the app's own phone switch (`ui/src/frame/Shell.tsx#L133`),
  for the mock's 760 px: the list sits above the part, at most a third of the screen tall, scrolling
  on its own; a state wider than the screen scrolls inside its own box, and the page never scrolls
  sideways.
- **Not listed by search engines**: the page renders `<meta name="robots" content="noindex">` and
  its title, "Credo: the design system's gallery", which React 19 (`pnpm-workspace.yaml#L52`) moves
  into the head.
- **No search**, which landing 4 kept for past 15 parts: the mock draws none, and the list holds 13.

## What the code says of the three decisions given

The orchestrator's three, carried and checked:

1. **No sign-in, the segment its only gate**: holds. The test of the address comes before
   `ClientApp`'s boot, and the gallery imports no API (case 1). The segment is what it is:
   `48b74d079` is in the entry script that every visitor of every ridge address downloads, as
      `/operator/clients` is (`docs/memo/ui.md#L139`). It keeps the page from someone guessing
   addresses, not from someone
   reading the script. The page holds samples only, so the plan keeps it.
2. **Not listed**: holds for a crawler that runs the page's script. Every address is served the
   app's one `index.html`, with no tag of its own, so the `noindex` exists only once the script runs;
   a crawler that runs none sees an empty page with nothing to list. A header for that path alone
   needs a response-headers policy in `ops/env.yml` and the human's stack run, not taken here; a
   `robots.txt` line would publish the segment.
3. **Samples only**: holds. The samples are the gallery's own: "Công ty TNHH Acme", a triangle drawn
   in the file, "0901 234 567", "A shop".

## The cases

| # | The case: one behaviour, one sentence | Held by |
| --- | --- | --- |
| 1 | `/48b74d079/gallery` draws the gallery, asks no one to sign in and makes no call to the API | `ui/src/App.test.tsx`, over an API whose every call is counted |
| 2 | A near miss, `/48b74d079` or `/48b74d079/galleryx`, is the client's app | the same |
| 3 | The page asks search engines not to list it and carries its title | `ui/src/design-system/Gallery.test.tsx` |
| 4 | The list holds the groups Foundations, Atoms, Molecules and Organisms in that order, each with its count, every component file of the three folders under its level | the same, with its glob |
| 5 | A part's address opens that part alone: its group, its name, its description, its props, and its states side by side, each under its name | the same, on `MemoryRouter` |
| 6 | The bare address opens the first part, and the list marks it current | the same |
| 7 | An address that names no part says so beside the list and draws no part | the same |
| 8 | Each component's description and props in the list's table are its file's doc comment and props | the same, each file read as text |
| 9 | On a part of two states or more, "One state at a time" shows one state and a row to pick another; a part of one state shows no switch; another part opens on all states | the same |
| 10 | The door heading, the logo tile and the page header each draw the state the mock adds | the same |
| 11 | The gradient and default buttons, the divider worded "hoặc", the door card's two states, the values and Mantine's controls are each drawn, under their parts | the same, today's cases moved to the parts |
| 12 | No picture of the old app is drawn, and the page is light whatever the device asks | the same, today's cases |
| 13 | The gallery is a chunk of its own: the entry grows by under 2 kB and holds none of its samples | step 1's build, measured |
| 14 | No other address changes | `ui/src/App.test.tsx`'s cases unchanged; `pnpm --filter @credo/visual check` exits 0 |

Case 14's visual check is there because the walks page bundles the app (`ui/src/scene.ts#L7`), in one
file (`visual/src/capture.ts#L71`), where the gallery's chunk is folded in. The phone layout is held
by the human's look: no test here measures a layout, and the picture run cannot take the gallery
(open item 515).

## The steps

Each step's check is `pnpm --filter @credo/ui check` and the citation test,
`pnpm --filter @credo/scripts exec vitest run src/citations.test.ts`; each case is seen red once, its
line changed and put back, the receipt in the tick. Sizes are the runs log's rows of the same shape,
the sign-in parts' landing of 2026-11-16 (piece 147), through the same gallery and gate: a step of
gallery pages 10 and 14 minutes, three parts at once 20; its review 8, its fix pass 22 (and piece
148's 12), its recap 11 (and 9), its look marker 3.

- [x] **1. The address, end to end, on the fake.** `App`'s gallery branch, lazy (cases 1, 2, 14);
      the title and the `noindex` (case 3); `ui/gallery.html`, `ui/src/design-system/main.tsx` and
      the entry's test removed. The prose this makes false, in the same commit, or the citation
      test stops: `docs/memo/ui-code.md#L12`, `#L32`, `#L43` and `#L65` (three `main.tsx` become
      two), `docs/memo/ui.md`'s door diagram (`#L17-L19`) and its bundle section (`#L127-L148`: a
      route is now split off), `ui/CLAUDE.md#L44`, and `ui/vite.config.ts#L15`'s comment. _Done
      when:_ both checks and `pnpm --filter @credo/visual check` exit 0; `pnpm --filter @credo/ui
      build` and `build:fake` exit 0, the entry within 2 kB of 1,010.91 kB, and `grep -l 'Mantine,
      in the theme'` over each build's `assets/*.js` naming one file that is not the entry; and in
      one invocation, `pnpm fake` started, `curl -sf` of its `/48b74d079/gallery` holding
      `<div id="root">`, then stopped. **14 min.**
      _Ticked 2026-11-17:_ cases 1, 2 and 3 each red once and put back (the branch disabled, `startsWith`
      without its slash, the `robots` tag deleted; case 1's "no call" half has no red of its own). The
      ui check, the citation test and the visual check exit 0; `build` and `build:fake` exit 0, the
      entry 1,011.41 kB (+0.50), `Mantine, in the theme` only in `Gallery-*.js` of each build; `pnpm
      fake`'s `/48b74d079/gallery` held `<div id="root">`.
- [x] **2. The workbench.** `entries.tsx` from `LEVELS`, `Values` and `Mantines` as the Foundations;
      the frame, the list, the part, the switch, the phone width, the three states; `Gallery` reads
      the part from `useLocation`. Cases 4 to 12, each red once (a component left out, a count off by
      one, every part drawn at once, the bare address drawing none, an unknown address drawing the
      first part, a description changed, the switch on a one-state part, a state dropped for cases 10
      and 11, dark forced for 12). _Done when:_ both checks exit 0 with the nine red receipts in the
      tick, and `git diff --name-only pre-merge...HEAD -- ui walk visual | grep -vcE
      '^ui/(src/(design-system/|App\.)|CLAUDE\.md|gallery\.html)'` counts 0. **20 min.**
      _Ticked 2026-11-17:_ `entries.tsx` (the table, the two foundations, the three added states) and
      the frame in `Gallery.tsx` with `Gallery.module.css`; cases 4 to 12 each red once and put back, ten
      mutations on the worktree copy: a component left out (4, 8), the count one over (4), every part
      at once (5, 6, 8, 9, 10, 11), the bare address drawing none (6, 11), an unknown address drawing
      the first part (7), a description changed (8), the switch on a one-state part (9), a state
      dropped from the page header (9, 10) and from the Mantine part (11), dark forced (12). The
      path count reads 1, `ui/vite.config.ts`, which step 1 changed for its comment and the
      pattern does not name.
- [ ] **3. Review.** Another model than the builder's reads steps 1 and 2 against this page. _Done
      when:_ the review is written, each finding with its line. **8 min.**
- [ ] **4. One fix pass.** Each finding fixed, rejected or deferred with its reason; `pre-merge`
      taken in. _Done when:_ both checks exit 0 after the fixes. **17 min.**
- [ ] **5. Recap and the records.** The recap; `docs/products.md#L62`'s row (runs local and ridge,
      opened at the address) and a card under "Check a piece on ridge"; one line at the design
      system's landing 4 (`docs/plans/2026-11-12-design-system.md#L130`) saying this plan built it;
      open item 515's first obstacle (the fronts answering `/gallery.html` with the app) struck.
      _Done when:_ the citation test exits 0 and the branch lands on `pre-merge`. **10 min.**
- [ ] **6. Ridge and your look.** `main` fast-forwarded after the whole check, your push, the
      deploy job green, then point 1; the answer marked in the recap, the plan and the products row.
      _Done when:_ the job's `ops/app.sh ridge` step reads `shipped <sha>`, and the marker is
      committed. **3 min, and your push and look.**

About 72 machine minutes; the landing and the whole check are the orchestrator's.

## Keeping every test and walk green

- **No screen of the app changes**: the new branch sits in front of `isOperatorPath`, and its
  `Suspense` wraps the gallery alone, so every other address draws as before; `App.test.tsx`'s cases
  are kept as they stand (case 14).
- **No walk picture is asked again**: the gallery's stylesheet holds its own classes and no rule on
  `body` or a Mantine class, so the walks page's screen versions, which are the markup and the rules
  that match it, stay.
- **Knip**: the removed entry was reached through its test; `Gallery` is now reached
  through `App`.

## The human's points

1. **The gallery on ridge (step 6).** On your PC and your phone, open
   `<a ridge address>/48b74d079/gallery`: the parts down the left by level, one part at a time with
   its states side by side, "Show" for one state at a time; on the phone, the list above the part.
   Does it read as the mock you said yes to? A yes closes the piece; a no names what differs, and
   step 2 reopens.

## Not in this piece, and named rather than dropped

- **The search** of landing 4, when the parts pass 15.
- **A picture of each part in the picture run** (open item 515): three of its four obstacles stand.
- **The entry past 1,000 kB** (open item 555), the app's own and older than this piece.
- **Storybook itself**, still rejected for a dependency to keep: the page takes its layout, not its
  machinery.
