# The ui tests find a screen's words by their key

> **Amended** 2026-11-17, after step 1, for three decisions of the human's: the partner's
> words are taken into this branch and land with the tests ("import the new translation from
> partner on this branch, test and fix the test code"); the eight failure words land as p1 wrote
> them ("plz trust the text from the partner"); and the walk's pictures are retaken ("fix visual
> too"). The batches are resized from the sample's minutes.

## At a glance

p1's returned words file changed 611 English and 565 Vietnamese words of the 759 keys, and the ui
check on its branch went red: 457 tests in 51 of 89 files. Every one is a test that names a word by
its text; no key went and no placeholder was lost. This branch takes p1's words in, and turns those
tests to read each word from the dictionary the screen draws from, `DICTIONARIES[language]`, as four
green test files already do. The code is the source of truth, so the next returned file reddens
nothing, whatever English it changes. The visual scene test is fixed the same way, and the human's
one walk run retakes the pictures p1's words move. No helper is built: test files only, the walk's
base pictures, and one line in `ui/CLAUDE.md`. The price: about 306 machine minutes, about 75 of
them waiting for the machine's test lock, and one walk run in the human's terminal.

## The slice

One slice: p1's words, with the tests of the `ui` package and `visual`'s scene test that read them.
It is walkable when the plan ends: on p1's words, the ui and visual checks are green, and the walk
is green against bases retaken on them. **The first version's null proof no longer holds.** It said
no screen and no word changed, so no base picture moved. Now p1's words are on this branch, and every
screen that shows a changed word moves. Those pictures are retaken by the human's walk run (step 5),
and the walks page asks again each screen whose markup moved.

## What the reds are, measured

Read off the ui check's run on the words branch at 15:00 on 2026-11-17 ("Failed Tests 457", and
"51 failed | 38 passed (89)" test files), against `git diff af8971af^ af8971af`, which touches
`ui/src/i18n/en.ts` and `vi.ts` alone. That commit is merged into this branch.

- **By the first error of each red:** 231 find no element by role and name, 108 no label, 37 no
  text, 2 no option. 71 compare a text with a typed word (`toBe`, `toContain`, `toEqual` of a
  heading row). 6 are staff files whose typed headings no longer match (`ui/src/importSheet.ts#L48`
  reads a heading as the dictionary's word, so `#L202` fails the file "no-name"). 2 are snapshots of
  markup that holds words. All 457 are a typed word.
- **Real breaks.** Comparing both dictionaries before and after, key by key: no key gone or added,
  and no placeholder lost. Two keys now say `{{name}}` once where they said it twice, in both
  languages, which the words tool allows, since it compares the distinct set (`scripts/src/words.ts#L100`).
  - **Two reds of their own kind.** The missing-key detector in `ui/src/pages/client/StaffPages.test.tsx#L1094-L1096`
    reads `permissions.Name` as a key shown raw. p1's word for `setup.departmentHint` ends in
    "permissions.", and the next cell's "Name" follows it with no space between. The doors' pin
    (`ui/src/i18n/words.test.tsx#L11`, its test at `#L130`) holds every word as it stood before the
    frame was redrawn.
  - **Eight words that drop a hedge, kept as written.** Of the 23 English words that said "may",
    p1's file keeps 2. Eight are failures whose outcome the app cannot know: `operator.deleteClientFailed`,
    `team.failed`, `team.linkFailed`, `team.deleteFailed`, `import.failed`, `import.failedPart`,
    `lists.failed` and `lists.failedPart`. In all eight, p1 wrote that the act failed, in both
    languages. **The human decided they land as written.** The five tests that pinned their wording
    (`ui/src/pages/operator/AddOperatorPage.test.tsx#L121-L122`,
    `ui/src/pages/operator/DeleteOperatorPage.test.tsx#L65`,
    `ui/src/pages/operator/OperatorLinkPage.test.tsx#L110-L111`,
    `ui/src/pages/client/ImportPage.test.tsx#L386`, `ui/src/pages/client/ListImportPage.test.tsx#L212`)
    read the word by its key instead.
- **Beyond the ui check.** `visual/src/scene.test.tsx` draws the real app and finds its words
  typed: "Staff" (`#L25`) is now "Staff directory", and "could not be loaded" (`#L85`) is gone.
  p1's branch never ran the visual check. This piece takes it.
- **The item's count moved.** Item 549 counted 384 queries by a capitalised literal in 29 files.
  Its own predicate, `git grep` today, matches 1,483 lines in 70 files, names of people included.
  The measure this plan uses is a scan of each literal in the 51 red files against both
  dictionaries: about 1,870 lines hold a literal equal to a word, or inside one. That is an upper
  bound, since a name that equals a word and a loose regex are counted in it. The 11 green files
  whose literals match a word pass them to a part as props, or as data of their own, so they stay.

## What exists, and the one pattern

`DICTIONARIES` (`ui/src/i18n/index.ts#L15`) is the screen's own source. `@credo/ui/words` exports
it (`ui/package.json#L45`) to `walk/`, `visual/` and `scripts/`. All 12 walk specs import it, and
their typed literals are data (names, codes), so the premise holds. 25 ui test files import it
already, and four are wholly green on p1's words. Nothing gives a test a word by a key string except
`createI18n(language).t(key)` (`ui/src/i18n/i18n.test.ts#L40-L41`). The typed object path is better,
since `Dictionary` (`ui/src/i18n/en.ts#L891`) makes a key gone a typecheck red. **So no helper is
built.**

**The pattern, from `ui/src/pages/operator/OperatorWalk.test.tsx`:**
- `const words = DICTIONARIES[language]` under the file's language, or `describe.each(['en', 'vi'])`
  (`#L14`).
- A word is found by its key: `{ name: words.nav.clients }` (`#L20`), and a message by
  `toBe(words.common.loadFailed)` (`#L38`), never by a fragment of it.
- A placeholder is filled as the screen fills it:
  `words.passkey.joinFor.replace('{{name}}', DEMO_INVITED_NAME)`
  (`ui/src/pages/operator/PasskeyWalk.test.tsx#L34`).
- A name, a code or a number stays typed: it is data, not a word.
- A label that carries a star (a required field) is found by `new RegExp` of its dictionary word,
  escaped, as the old tests forgave it with a regex; an exact string finds nothing (sample,
  `ui/src/parts/Settings.test.tsx`, `labelled`). A language's own name is `LANGUAGE_NAMES[language]`
  (`ui/src/i18n/index.ts`), never typed. A name found by a regex stays a query that must also be
  seen to find something, since `queryBy...` null passes on a label that exact text misses.
- Where two keys hold the same text, the key is the one the component reads. Its source decides,
  and p1's words prove the choice: 65 English and 72 Vietnamese texts were held by two keys or
  more, and p1 parted 34 and 40 of them.

**The special cases, settled once:**
- **The doors' pin** becomes each door's list of keys, in order. It still fails on a word missing,
  added or moved.
- **`frameKept`'s markup** (`ui/src/frame/frameKept.test.tsx#L9`) replaces every text node and
  every `aria-label`, `placeholder`, `title` and `alt` value by `·` before its three snapshots. The
  snapshot then keeps the markup, not the words. It is written again once, and its diff is the old
  snapshot with the same replacement, nothing else.
- **The missing-key detector** matches only the dictionary's real keys, flattened from `DICTIONARIES.en`.
- **The staff and list files** are made from `headingOf` and the lists' column words. The variations
  a reader must forgive (no accents, capitals, a star) are applied to that word, never typed.
- **The pins on a word's own wording** go: the three on the session-ended word
  (`ui/src/parts/SessionEnded.test.tsx#L16-L18`), the five hedge pins above, and every `toContain`
  of a fragment. The screen shows its word, and the wording is the partners'. The rule that no
  Vietnamese word stays English (`ui/src/i18n/i18n.test.ts#L31`) stays as it is.

## The cases

| # | The case | Held by |
| --- | --- | --- |
| 1 | Every ui test that finds a word on a screen reads it from the dictionary of the language drawn, its placeholders filled as the screen fills them | the 51 files, by batch |
| 2 | Each door says its keys' words, in order, in both languages, and nothing else | `ui/src/i18n/words.test.tsx` |
| 3 | The screens inside the frame keep their markup, whatever their words | `ui/src/frame/frameKept.test.tsx` |
| 4 | A key with no word shows as itself and is named; a sentence ending beside another word is not a key | `ui/src/pages/client/StaffPages.test.tsx` |
| 5 | A staff or list file made from the template's own words is read back, in either language and in the forms a person types | `ui/src/importSheet.test.ts`, `ui/src/listSheet.test.ts` |
| 6 | A scene on the walks page finds the app's words by key | `visual/src/scene.test.tsx` |
| 7 | On p1's words, every ui and visual test is green | step 4's whole checks |
| 8 | On p1's words, every walk is green against its bases, retaken once | the human's walk run, step 5 |

Each case is seen red once. For cases 1 to 6, one key in the batch's component is changed to
another and put back, so the converted test still fails when the screen stops showing its word. A
test that adapts to the change holds nothing. Case 7 is the proof that the tests follow the
dictionary, since p1 changed 77 % of the words. It was red at 457 before the first batch.

## The steps

**Each batch's check.** This branch holds p1's words, so the whole ui check is red until the last
batch lands. A batch before the last cannot be read by it. **Decided:** batches 2 and 3 are read by
their own files' run, `pnpm --filter @credo/ui exec vitest run <its files>`, by the package's
`pnpm --filter @credo/ui typecheck`, and by `pnpm exec prettier --check <its files>`, each at exit
0. They commit on those checks, because the whole check is red by design until then. The last
batch, step 4, is read by `pnpm --filter @credo/ui check`, `pnpm --filter @credo/visual check` and
the citation test, `pnpm --filter @credo/scripts exec vitest run src/citations.test.ts`, each by its
own exit code. That gate covers the whole committed tree. Each batch's test runs wait for the
machine's test lock first. The candidate keys for each line come from a scan of its literals
against both dictionaries, a script in the builder's scratch folder, never committed.

**Sizes.** Measured from the sample: about 3 to 8 minutes of work on its 61 lines, about 11 lines a
minute at the middle, and about 25 minutes waiting for the machine's test lock, which other pieces'
whole `ops/test.sh` runs held. **Decided: three batches, not six.** Each batch pays one lock wait,
so fewer batches wait less. Three, not two: the three staff files alone are about 510 lines, and one
session reading those files with the lists' and the orders' pages would be past what one context
holds. A batch's size is its lines at the sample's rate, plus one lock wait of 25. At 3 or 8 minutes
for 61 lines, the three batches' work runs from about 90 to 240 minutes. The review is 13, the
median of the last three whole reviews (16, 8, 13). The fix pass is 17, a code step. The walk run
is 18: the last run of all twelve walks took 18 minutes 26 seconds, on 2026-11-16. The bases'
commit after it is 5, a first run. The recap is 7, the last one, and the landing is 5.

- [x] **1. The sample: `ui/src/parts/Settings.test.tsx`.** 61 lines, 19 reds. It holds every kind:
      a role and a name, a label, an alert's `toBe`, a fragment, a word with a placeholder to fill
      (`settings.logoTooLarge`'s `{{max}}`) and both languages. The pattern above is applied as
      written, and any change to it is written back into this plan in the same commit. _Done when:_
      its p1 run exits 0; both checks exit 0; one key mutated in `ui/src/parts/Settings.tsx`
      reddens the file, then is put back. **17 min.**
      _Done:_ the p1 run exited 0 (21 tests), both checks exited 0 on the committed tree, and the
      key `settings.name` in `Settings.tsx` changed to `settings.title` reddened the file and was put back.
- [x] **2. The words, the frame, the operator, the doors and the sheets.** This batch covers about
      650 lines in 39 files:
      - `i18n/words.test.tsx` and `i18n/i18n.test.ts`
      - `frame/frameKept.test.tsx` and its snapshot, `frame/Shell.test.tsx`, `OperatorPage.test.tsx`
        and `Boot.test.tsx`
      - the 17 red files under `pages/operator/`, and `OperatorApp.test.tsx`
      - `parts/NewClient`, `NewClientBoxes`, `SessionEnded` and `ClientMade`
      - `App`, `pages/SignIns`, `SignIn`, `MorePage`, `fake`, `scene`, `importSheet`, `listSheet`
        and `importDemo`
      - `visual/src/scene.test.tsx`

      _Done when:_ the batch's checks above exit 0, with the visual file run by
      `pnpm --filter @credo/visual exec vitest run src/scene.test.tsx`. The new snapshot equals the
      old one under the `·` replacement, by `diff` of the two run through one `sed`. One key is
      mutated and seen to redden the file it holds, then put back. **84 min:** 59 of work, 25 of lock.
      _Done:_ the 37 ui files' run exited 0 (432 tests) and `pnpm --filter @credo/ui typecheck`,
      `pnpm --filter @credo/visual exec vitest run src/scene.test.tsx` (7 tests) and
      `pnpm exec prettier --check` on the batch's files each exited 0, on the tree as committed;
      the new snapshot equals the old one under the `·` sed, `diff` empty; the key
      `operator.soon` in `SoonPage.tsx` changed to `operator.badge` reddened `SoonPage.test.tsx`
      and was put back. The whole ui check stays red until step 4, by the plan's decision. One
      word in the pattern written back: a placeholder word is filled as the screen fills it by
      `.replace('{{name}}', …)`, and a name found by `getByText` over a word that shares its
      element with a button (a conflict alert) is read by `toContain` of the dictionary word.
- [x] **3. The staff pages.** `StaffPages`, `StaffRecord` and `StaffSetupPage` under `pages/client/`:
      about 510 lines, the detector of case 4 among them. _Done when:_ the batch's checks exit 0,
      and one mutation is seen red, then put back. **71 min:** 46 of work, 25 of lock.
      _Done:_ the three files' run exited 0 (106 tests), and `pnpm --filter @credo/ui typecheck` and
      `pnpm exec prettier --check` on them each exited 0, on the tree as committed; the key
      `setup.save` in `StaffSetupPage.tsx` changed to `setup.saved` reddened `StaffSetupPage.test.tsx`
      (7 of 11) and was put back. The whole ui check stays red until step 4, by the plan's decision.
      The detector of case 4 (`StaffPages.test.tsx`, "Every new screen reads fully") now matches
      only the dictionary's own keys, flattened from `DICTIONARIES.en`. Two things written back: a
      label found by a star-forgiving regex is `starting(word)`, a `^`-anchored escape of the
      dictionary word (kept as the old `/^Name/` anchored), and where two keys held one text the
      page decided: the person's page reads `fields.*` for its start date, birth date and address
      (not `setup.field*`), the list reads `staff.*`, the add page `addPerson.*`. Every `toContain`
      of a fragment became the whole dictionary word, none was dropped.
- [x] **4. The lists, the orders and the rest of the client's pages, and the whole checks.** This
      batch covers about 660 lines in 10 files: `ListPage`, `OrdersPages`, `MyDeliveries`,
      `Reconcile`, `DeliveriesPages`, `ListImportPage`, `ImportPage`, `Access`, `UnknownClient` and
      `SettingsPage`. Item 549 is marked fixed. `ui/CLAUDE.md#L82`
      gains the test's half: a word a test finds is `DICTIONARIES[language]`'s, never typed.
      _Done when:_ one mutation is seen red, then put back, and `pnpm --filter @credo/ui check`,
      `pnpm --filter @credo/visual check` and the citation test each exit 0. That is case 7.
      **86 min:** 59 of work, 25 of lock, 2 for the two checks.
      _Done:_ the ten files were converted in three commits; item 549 is marked fixed and
      `ui/CLAUDE.md` says a word a test finds is `DICTIONARIES[language]`'s, never typed. The key
      `unknownClient.title` in `UnknownClient.tsx` changed to `unknownClient.text` reddened
      `UnknownClient.test.tsx` (1 of 2) and was put back, `git diff` empty. On the tree as committed,
      `pnpm --filter @credo/ui check` exited 0, `pnpm --filter @credo/visual check` exited 0 and
      the citation test exited 0, each by its log's `== exit` line. The first visual run was red in
      one test, `words.test.tsx` "a step that finds nothing stops the build": its expected message
      ended `”.` after a dictionary word that already ends in a period, so the closing full stop of
      the test's own template was dropped; the visual check and the citation test were then rerun
      green. The slow reds of the earlier whole run were the load, not the change: none came back at
      a load of 2 to 5.
- [ ] **5. The walk's pictures, retaken: the human's run.** The orchestrator hands the human one
      command, run from this worktree in the human's terminal while the review reads:
      `bash walk/run.sh piece-1 piece-2 admin-lists office-orders driver-deliveries office-reconcile operator passkeys services root-password team delete-client --moved all --write`.
      Its usage is in `walk/run.sh#L4`, `--moved` and `--write` at `#L12-L14`. The bases live in each
      walk's `walk/specs/<spec>-snapshots` folder (`walk/run.sh#L46-L57`), and `--write` replaces
      them only after a green run (`walk/CLAUDE.md#L65`). What the human will see: `== verdict:
      green` and `== done`, exit 0. Then the machine reads git's diff of the bases, every moved one
      a screen p1's words touch, and commits them. _Done when:_ the run's log ends green with exit
      0; `git status --short` shows only files under `walk/specs/*-snapshots/`, and they are
      committed. **18 min** for the run, **5** for the commit.
- [ ] **6. The review, on another model.** It reads the diff against the case table. For each
      converted test, it asks whether that key is the one the component reads. **13 min.** Then the
      fix pass, by step 4's checks (**17 min**), and the recap (**7 min**).
- [ ] **7. The landing on `pre-merge`.** The orchestrator lands this branch, p1's words with it.
      `ops/words-in.sh` and its section of `ops/test.sh` stay as they are, and `--land` is not used.
      The words branch, `words-p1-1117-1459`, is untouched here. Once `pre-merge` holds its commit,
      what becomes of it and its worktree is the orchestrator's. **5 min.**

**Total: about 306 minutes.** Step 1 took 17. The three batches are 241, 75 of that lock waits.
The walk run and its commit are 23, the review, fix pass and recap 37, and the landing 5. The
walk run and the review run side by side, so the day's span is about 18 shorter.

## What still catches a word missing or wrong

Once the tests read the dictionary the screen reads, a test no longer checks the wording. That is by
design: the wording is the partners', and the human trusts it. These remain:
- **A key gone or added:** the typecheck (`Dictionary`, `ui/src/i18n/en.ts#L891`, and every
  `words.a.b` a test reads), and the words tool's refusal of a key not in the sent file.
- **A placeholder lost:** the words tool refuses the whole file (`scripts/src/words.ts#L100`).
- **A key shown raw:** case 4. i18next shows a missing key as the key.
- **A Vietnamese word left in English:** `ui/src/i18n/i18n.test.ts#L31`.
- **A word that reads wrong on its screen:** a reading, not a test. The words tool shows every change
  before its question. The walks page asks again every screen whose markup moved, in either language
  (`versionOf`, `visual/src/capture.ts#L260`).
- **Not caught:** a new test that types a word, until the next return that changes that word. Its
  guard is the `ui/CLAUDE.md` line of step 4. A mechanical check is item 573, parked until a return
  reddens on such a test.

## The human's points

None is asked. The eight failure words were the first version's point, and the human answered it:
they land as p1 wrote them. The human's one act is step 5's walk run. The walks page then asks again
each screen p1's words moved, as rule 7 does for any change. That is a look, not a gate: the
landing does not wait for it.

## Not in this piece, and named rather than dropped

- **Item 571.** A staff or list file made from a template downloaded before a words change has the
  old headings, and it fails as "no Name column" after the change. Parked until the first real
  client, or a partner who meets it.
- **Item 572,** closed as moot with this amendment. It asked for a note on the eight words whose
  meaning a case needed, and the human said to trust the partner's text.
- **Item 573.** No mechanical check stops a new ui test from typing a word. Parked until a return
  reddens on one.
