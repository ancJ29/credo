# The ui tests find a screen's words by their key

## At a glance

p1's returned words file changed 611 English and 565 Vietnamese words of the 759 keys, and the ui
check on its branch went red: 457 tests in 51 of 89 files. Every one is a test that names a word by
its text; no key went and no placeholder was lost. This piece turns those tests to read the word
from the dictionary the screen draws from, `DICTIONARIES[language]`, as four green test files
already do, so any returned file lands with the ui and visual checks green, whatever English it
changes. p1's words for eight failure messages now say an act failed where the app only knows it
may have: those eight stay pinned, as one rule on the words, and are the human's one point. No
helper is built: test files only, and one line in `ui/CLAUDE.md`. The price: about 166 machine
minutes in seven build steps, and one yes or no.

## The slice

One slice: the tests of the `ui` package and `visual`'s scene test. It is walkable when the plan
ends. With p1's two word files swapped in for a moment, every ui and visual test is green except
the one rule on the eight words. Then the words branch takes `pre-merge` in, and its ui check runs
again: red only on that rule until the human answers, green after. No screen, no word and no
product line changes, so no walk's base picture moves. That is this piece's null proof.

## What the reds are, measured

Read off the ui check's run on the words branch at 15:00 on 2026-11-17 ("Failed Tests 457", and
"51 failed | 38 passed (89)" test files), against `git diff af8971af^ af8971af`, which touches
`ui/src/i18n/en.ts` and `vi.ts` alone.

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
  - **One break that reads wrong.** Of the 23 English words that said "may", p1's file keeps 2.
    Eight of the lost ones are failures whose outcome the app cannot know (the service may have
    acted before it failed), and p1 lost the hedge in both languages in all eight:
    `operator.deleteClientFailed`, `team.failed`, `team.linkFailed`, `team.deleteFailed`,
    `import.failed`, `import.failedPart`, `lists.failed` and `lists.failedPart`
    (`ui/src/i18n/en.ts#L146`, `#L209`, `#L231`, `#L238`, `#L629`, `#L631`, `#L687`, `#L689`). For
    example, "The operator may not have been added" became "Operator could not be added". And
    `import.failed` no longer warns that adding the file again adds a second person for each row with
    no code. Five tests pin these words today, as typed fragments:
    `ui/src/pages/operator/AddOperatorPage.test.tsx#L121-L122`, `ui/src/pages/operator/DeleteOperatorPage.test.tsx#L65`,
    `ui/src/pages/operator/OperatorLinkPage.test.tsx#L110-L111`, `ui/src/pages/client/ImportPage.test.tsx#L386` and
    `ui/src/pages/client/ListImportPage.test.tsx#L212`.
- **Beyond the ui check.** `visual/src/scene.test.tsx` draws the real app and finds its words
  typed: "Staff" (`#L25`) is now "Staff directory", and "could not be loaded" (`#L85`) is gone.
  p1's branch never ran the visual check, so its reds would first show at the next whole check on
  `pre-merge`. This piece takes it.
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
since `Dictionary` (`ui/src/i18n/en.ts#L925`) makes a key gone a typecheck red. **So no helper is
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
  (`ui/src/parts/SessionEnded.test.tsx#L16-L18`) and every `toContain` of a fragment. The screen
  shows its word, and the wording is the partners'. The five hedge pins above become one rule in
  `ui/src/i18n/i18n.test.ts`: the eight keys' words say the act may have happened, in English
  (`may` or `might`) and in Vietnamese (`có thể`). That is the meaning, not the phrase, beside the
  file's rule that no Vietnamese word stays English (`#L31`).

## The cases

| # | The case | Held by |
| --- | --- | --- |
| 1 | Every ui test that finds a word on a screen reads it from the dictionary of the language drawn, its placeholders filled as the screen fills them | the 51 files, by batch |
| 2 | Each door says its keys' words, in order, in both languages, and nothing else | `ui/src/i18n/words.test.tsx` |
| 3 | The screens inside the frame keep their markup, whatever their words | `ui/src/frame/frameKept.test.tsx` |
| 4 | A key with no word shows as itself and is named; a sentence ending beside another word is not a key | `ui/src/pages/client/StaffPages.test.tsx` |
| 5 | A staff or list file made from the template's own words is read back, in either language and in the forms a person types | `ui/src/importSheet.test.ts`, `ui/src/listSheet.test.ts` |
| 6 | A failure whose outcome the app cannot know says the act may have happened, in both languages, for each of the eight keys | `ui/src/i18n/i18n.test.ts` |
| 7 | A scene on the walks page finds the app's words by key | `visual/src/scene.test.tsx` |
| 8 | With p1's word files swapped in, every ui and visual test is green but case 6 | each step's p1 run, then the words branch's own check |

Each case is seen red once. For cases 1 to 5 and 7, one key in the batch's component is changed to
another and put back, so the converted test still fails when the screen stops showing its word. A
test that adapts to the change holds nothing. Case 6 is red on p1's words already. Case 8 is the
proof that the tests follow the dictionary: p1 changed 77 % of the words. The 38 files left
unchanged were green on p1's words already, so the steps' p1 runs cover the whole suite between
them.

## The steps

Each step's gate is `pnpm --filter @credo/ui check` and the citation test,
`pnpm --filter @credo/scripts exec vitest run src/citations.test.ts`, each by its own exit code.
`pnpm --filter @credo/visual check` is added where a step touches `visual/`. Each step also has a
**p1 run**. A copy of the two word files is taken first. Then `git show af8971af:ui/src/i18n/en.ts`
and `vi.ts` are written over them, the step's files are run by
`pnpm --filter @credo/ui exec vitest run <files>`, and the copies are put back before the gate, so
the gate reads the committed tree. The candidate keys for each line come from a scan of its
literals against both dictionaries, a script in the builder's scratch folder, never committed.

**Sizes.** No row of this shape exists. `glance.sh --size build` gives a code step 17 minutes
(the median of its last three: 15, 30, 17), so the sample and each batch are 17 until the sample's
own minutes resize the batches. The convention says a step transcribed from a settled design runs
at a fifth or less. The review is 13, the median of the last three whole reviews (16, 8, 13). The
fix pass is 17, a code step. The recap is 7, the last one. The landing and the rerun are 5 each,
about five minutes a step on a first run.

- [ ] **1. The sample: `ui/src/parts/Settings.test.tsx`.** 61 lines, 19 reds. It holds every kind:
      a role and a name, a label, an alert's `toBe`, a fragment, a word with a placeholder to fill
      (`settings.logoTooLarge`'s `{{max}}`) and both languages. The pattern above is applied as written, and any change to it is written back into
      this plan in the same commit. _Done when:_ its p1 run exits 0; both checks exit 0; one key
      mutated in `ui/src/parts/Settings.tsx` reddens the file, then is put back. **17 min.**
- [ ] **2. The words and the frame.** `i18n/words.test.tsx`, `i18n/i18n.test.ts` with case 6,
      `frame/frameKept.test.tsx` and its snapshot, `frame/Shell.test.tsx`,
      `frame/OperatorPage.test.tsx`, `frame/Boot.test.tsx`: about 120 lines. _Done when:_ the p1 run
      reds only case 6, naming the eight keys in each language; the new snapshot equals the old one
      under the `·` replacement, by `diff` of the two run through one `sed`; both checks exit 0.
      **17 min.**
- [ ] **3. The operator's pages and the parts.** The 17 red files under `pages/operator/`,
      `parts/NewClient`, `NewClientBoxes`, `SessionEnded`, `ClientMade`, and `OperatorApp.test.tsx`:
      about 245 lines in 22 files. The hedge pins in three of them give way to case 6. _Done when:_
      the p1 run exits 0; both checks exit 0. **17 min.**
- [ ] **4. The doors, the sheets, the fake and the walks page.** `App`, `pages/SignIns`, `SignIn`,
      `MorePage`, `fake`, `scene`, `importSheet`, `listSheet`, `importDemo`, and
      `visual/src/scene.test.tsx`: about 285 lines. _Done when:_ the p1 run exits 0, with the
      visual file run under `pnpm --filter @credo/visual exec vitest run`; the three checks exit 0.
      **17 min.**
- [ ] **5. The staff pages.** `StaffPages`, `StaffRecord`, `StaffSetupPage` under `pages/client/`:
      about 510 lines, the detector of case 4 among them. _Done when:_ the p1 run exits 0; both checks
      exit 0. **17 min.**
- [ ] **6. The lists and the orders.** `ListPage`, `OrdersPages`: about 375 lines. _Done when:_ as
      step 5. **17 min.**
- [ ] **7. The rest of the client's pages.** `MyDeliveries`, `Reconcile`,
      `DeliveriesPages`, `ListImportPage`, `ImportPage`, `Access`, `UnknownClient`, `SettingsPage`:
      about 285 lines, two of them hedge pins. Item 549 is marked fixed, and `ui/CLAUDE.md#L82` gains
      the test's half: a word a test finds is `DICTIONARIES[language]`'s, never typed. _Done when:_
      the p1 run exits 0; both checks exit 0. **17 min.**
- [ ] **8. The review, on another model.** It reads the diff against the case table. For each
      converted test, it asks whether that key is the one the component reads. **13 min.** Then the
      fix pass, by its own gate (**17 min**), and the recap (**7 min**).
- [ ] **9. The landing on `pre-merge`, then the words branch.** The orchestrator lands the piece
      (**5 min**). The words branch then takes `pre-merge` in and its ui check runs again: red on
      case 6 alone until the human's point is answered (**5 min**).

**Total: about 166 minutes.** The seven build steps are 119, and the rest is the review, the fix
pass, the recap and the two landings.

## How the words branch lands

The words branch, `words-p1-1117-1459` at `af8971af`, changes only the two word files, so taking
`pre-merge` in after this piece meets no conflict. `ops/words-in.sh` and its section of
`ops/test.sh` stay as they are. **Decided:** the orchestrator lands it by `bash ops/words-in.sh
--land words-p1-1117-1459` if the words paste's step 2 is on `pre-merge` by then, since `--land`
takes `pre-merge` in and checks again (the words paste's plan, its cases 22 and 23). Otherwise it lands by hand,
in that script's own order: the take-in, the ui check, the citation test, then `git merge --no-ff`.
`--land` refuses a branch whose diff against `pre-merge` holds any file but the word files. If it
reads that diff before the take-in, two-dot, this piece's test files show in it, so the hand
landing is the fallback, not a fault. The script runs only the ui check, and the visual scene test
is proven by step 4's p1 run, so the next whole check on `pre-merge` sees no new red.

## What still catches a word missing or wrong

Once the tests read the dictionary the screen reads, a test no longer checks the wording. That is by
design, since the wording is the partners'. These remain:
- **A key gone or added:** the typecheck (`Dictionary`, `ui/src/i18n/en.ts#L925`, and every
  `words.a.b` a test reads), and the words tool's refusal of a key not in the sent file.
- **A placeholder lost:** the words tool refuses the whole file (`scripts/src/words.ts#L100`).
- **A key shown raw:** case 4. i18next shows a missing key as the key.
- **A Vietnamese word left in English:** `ui/src/i18n/i18n.test.ts#L31`.
- **A failure that claims more than the app knows:** case 6, for the eight keys.
- **A word that reads wrong on its screen:** a reading, not a test. The words tool shows every change
  before its question. The walks page asks again every screen whose markup moved, in either language
  (`versionOf`, `visual/src/capture.ts#L260`).
- **Not caught:** a new test that types a word, until the next return that changes that word. Its
  guard is the `ui/CLAUDE.md` line of step 7. A mechanical check is item 573, parked until a return
  reddens on such a test.

## The human's points

1. **p1's eight failure words (after step 9).** For adding or deleting an operator, a join link,
   deleting a client and importing, p1's words say the act failed where the app only knows it may
   have, so a second import could add people twice. The orchestrator shows the eight beside the
   old ones. Yes: "may" goes back in, in p1's style (recommended). No: they land as written, and
   case 6 goes.

## Not in this piece, and named rather than dropped

- **Item 571.** A staff or list file made from a template downloaded before a words change has the
  old headings, and it fails as "no Name column" after the change. Parked until the first real
  client, or a partner who meets it.
- **Item 572.** The words file goes out with no note on the eight words whose meaning a case needs,
  so a partner cannot see why they read as they do. Parked until the next file sent.
- **Item 573.** No mechanical check stops a new ui test from typing a word. Parked until a return
  reddens on one.
