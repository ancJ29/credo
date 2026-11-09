# visual
Stack: Vite's module loader, jsdom, Vitest · Gate: `pnpm check` from the root, which runs this package's typecheck and tests at 100 % (`visual/vitest.config.ts`'s `thresholds`) · Ship: none; `pnpm report` writes one page into the credo root's `walks/`

The walks page: every screen of every walk, drawn from the app on the fake in both languages, as one
file a non-coder opens and answers yes or no. No browser, no picture.

## What belongs here, and what does not

- **A screen on the page** belongs here: its scene, sentence and question, in `visual/src/walks.ts`.
- **The screen's own test belongs in `ui`, its walk belongs in `walk`.** The base image is `walk`'s;
  this package holds none and meets it only through the screen's `id`.
- **The fake data and the `cue` a scene names belong in `ui` and `shared`.**

## The file to copy

- **A walk:** the entry with `id: 'operator-delete-client'` in `WALKS`, four screens, each a scene.
- **A step:** a `Step`, named by a key of the app's dictionaries.
- **A question in Vietnamese:** a line of `visual/site/questions-vi.json`, keyed by the English text.
- **A walk's test:** `walks.test.ts`'s "puts the client delete walk last".

## This package's own rules

What a screen owes is [Before a new screen](../docs/conventions/code.md#before-a-new-screen); these
say what each checks. Marks: [How to read a rule](../docs/conventions/code.md#how-to-read-a-rule).

- **VI1 · holds · check:** a new screen is a `scene` (`path`, who, `cue`, `steps`); `mock` is piece 1's
  eleven screens and no later walk takes one.
- **VI2 · holds · check:** a screen's `id` is the name its spec gives `at('…')`, the two lists equal
  ("names every screen of every walk as the walk specs do").
- **VI3 · holds · check:** a screen has its `sentence` in both languages and one `question` whose
  Vietnamese is in `questions-vi.json` ("holds a Vietnamese question for every question"). A failure is `path: 'wrong'`.
- **VI4 · holds · check:** a step names a dictionary key, never the words; a cell's own words from the
  data are `text: true` ("names each step of a scene by words both languages’ dictionaries hold"). A
  screen about what loads after a press ends on a `see`.
- **VI5 · next copy · reader:** a scene opens as its spec opens the screen (who, `cue`, address).
  Some walks have a test reading the spec for it ("opens each passkeys scene as the passkeys spec
  opens it"), some do not; a new walk gets its own.
- **VI6 · holds · reader:** a new walk goes at the end of `WALKS` and into "The walk spec’s screens
  equal the walks page’s list" by hand, which indexes `WALKS` by position.
- **VI7 · holds · check:** a screen's markup is the same in two builds of one commit, or every
  version moves: the day is `DEMO_TODAY`, generated ids pass `steadied` ("Two builds of one commit").

## Non-obvious facts

- **The page counts no pixel.** A screen's `versionOf` hashes its markup in both languages and the
  style rules that match it; a moved version marks the answer "changed" and asks again
  (`visual/site/page.ts`'s `statusOf`). A pixel moved in `walk` asks nobody here.
- **This suite reads `walk`'s source as text** (`walks.test.ts`'s `specFiles`): a reformat of a spec,
  or a renamed `at`, reds this package with no behaviour changed.
- **A step waits for the page to stand still** (`runSteps`); a late-drawing screen with no `see`
  step is captured half-built, on a loaded machine only.

## Where the rest is

- The big picture: [`architecture.md`](../docs/architecture.md#at-a-glance).
- The cross-package rules: [`code.md`](../docs/conventions/code.md).
- The sibling to copy: [`walk/CLAUDE.md`](../walk/CLAUDE.md), the browser half of the same screens.
