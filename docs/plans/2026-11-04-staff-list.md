# Milestone 4 of the employees match: the staff list as the old app's

## At a glance

The partners' staff see at a glance who is active, and use the list on a phone. Each person on the staff list carries
a chip, **Active** or **Inactive**; a **Status** choice (Active, the default as today; Inactive; All) replaces the
"Show people who left" box; under 768 (`sm`, where the frame turns to a phone, `ui/src/Shell.tsx#L115-L116`) one card
a person: name, code, department, position, phone, chip.

"Inactive" is today's archive: `archived: true`, written once by the archive route (`bff/src/staff.ts#L467-L479`),
refused at sign-in (`bff/src/app.ts#L136`); no way back until milestone 2.
The list holds what the filter needs: the BFF sends everyone, people who left too (`bff/src/staff.ts#L174-L190`), each
with `archived` (`shared/src/staff.ts#L54`), and the page narrows in the browser (`ui/src/staffFilter.ts#L79-L80`).
Screens only: no route, no field, no wire.

**Price:** $0 a month; about 48 machine minutes and a 17-minute full run.

## The slice

`StaffListPage` and `staffFilter` changed in place (`ui/src/StaffListPage.tsx#L162-L237`, `ui/src/staffFilter.ts#L12-L50`),
then the words, two scenes and the spec. Decided here:

- **The chip:** a filled `Badge` in the theme's primary, `brand` at shade 7 (`ui/src/theme.ts#L101-L102`), as the old
  app's `primary.7` (its `ActiveBadge.tsx#L10-L11`); Inactive `gray`, as today's Left badge (`ui/src/StaffListPage.tsx#L220`). In the table, a column
  of its own, last, as the old app's.
- **The words, the old app's:** the chip "Hoạt động" or "Ngừng"; the choice "Trạng thái": "Hoạt động", "Ngừng hoạt
  động", "Tất cả"; English Status: Active, Inactive, All. `staff.showLeft` goes; `staff.left` stays on the person's
  page (`ui/src/PersonPage.tsx#L369`), milestone 1's file, for milestone 2 to reword.
- **The choice:** a `NativeSelect`, first in the filters' grid (`ui/src/StaffListPage.tsx#L162-L182`). The address
  writes `status=inactive` or `status=all`; Active is the bare address (`ui/src/staffFilter.ts#L38-L39`); an old link's
  `left=1` meant everyone, so it reads as All (decided at the review, the machine's). The old app opens on All (its `EmployeeListPage.tsx#L48`); the cut kept today's Active.
- **Cards and table both in the markup,** one shown by width (`hiddenFrom`/`visibleFrom="sm"`), as the frame's phone
  bar (`ui/src/Shell.tsx#L230`): a screen's version is read from its markup (`visual/src/capture.ts#L260`), and the
  spec's `personNamed` clicks the visible name link at any width (`walk/specs/piece-2.spec.ts#L203-L206`). *Hazard:*
  jsdom draws both; the ui tests scope to one.
- **The card:** the cut's six; the company's own list fields stay in the table, search still finding them
  (`ui/src/staffFilter.ts#L64-L74`).
- **Screen 8 opens at `/staff?status=inactive`,** scene and spec alike (the spec appends `fake`,
  `walk/specs/piece-2.spec.ts#L85`): a `choose` step matches one literal option text (`visual/src/steps.ts#L162-L165`),
  and these differ by language. Its sentence: "Inactive: people who left, by the status choice"; screen 1's ends
  ", status" (`visual/src/walks.ts#L708-L716`).

## The moved screens

Five screens, 30 pictures (two languages at 390, 768, 1280): "Take on staff" 1, 8, 14; "Look up and add staff, as
allowed" 1; and **"Sign in by a QR code" 1**, which lands a data-set person on the list (`visual/src/walks.ts#L1092-L1098`,
`visual/src/words.test.tsx#L209`). The spec shoots the list only there (`walk/specs/piece-2.spec.ts#L249`, `#L315`,
`#L382`, `#L459`, `#L520`); other screens pass through it to a person's page. **Office 4 does not move,** against the
cut: it shows the "nothing yet" notice (`ui/src/ClientApp.tsx#L390-L392`, `visual/src/words.test.tsx#L202`).

## The case table

| # | The case | Held by |
| --- | --- | --- |
| 1 | Each person in the list carries a chip: Active, filled in the brand's shade 7, or Inactive, gray | unit, ui |
| 2 | The list opens on Active: people who left hidden, the address bare | unit, `staffFilter.test.ts`; ui |
| 3 | Inactive shows only people who left, All everyone, in code order; chosen in the list | unit, ui |
| 4 | The status is kept in the address and read back, with search, department, position and choices; an unknown value reads as Active, an old `left=1` as All | unit, `staffFilter.test.ts` |
| 5 | Under 768 one card a person: the name a link to their page, code, department, position, phone, chip; a missing value leaves no empty line; from 768 the table | unit, ui; the walk |
| 6 | Inactive with nobody who left says no one matches | unit, ui |
| 7 | The fake's scenes equal the spec's and the walks page's; fake = stack = stack again | visual; the walk |
| 8 | No screen moves but the five | the full run's raw count |

Red first: the business rows 1, 2, 3 and 5, each once against today's page.

## Steps

- [x] **1. This plan.** 🤖 Opus, 9 minutes. Done when: committed, about 1,000 words.
- [x] **2. The list on the fake.** 🤖 Sonnet, about 18 minutes. Done when: rows 1, 2, 3, 5 red once; ui and visual at
  100 %, lint clean; `pnpm report` builds. Done 2026-11-04: rows 1, 2, 3, 5 red once against today's page, then
  green; ui 701 tests and visual 191 at 100 %; typecheck, eslint, prettier, knip clean; `pnpm report` built, 107
  screens, 214 captures. Fix pass after the human's look (PC no, the filters): the search and every select on one line from
  768, the search growing, each select compact, names kept as accessible names (shown above only under 768); ui 702
  tests at 100 %, the new row test red once, screens moved still the five. Second fix pass (five filters
  on one line at 1280, each select's "all" naming what it filters): at 1280 the content is 998 wide, the four
  selects 620, the gaps 64 and the search's 200 minimum come to 884; `pnpm check` `== exit 0` at `b976465`, ui 702
  tests at 100 %, screens moved still the five. Review fix pass (`a7fd011`, `3bb5813`): card lines keyed by field, a
  field's name lowered by its first letter and not when an acronym, an old `left=1` read as All, the table link's Back
  tested; `pnpm check` `== exit 0` (a first run red on one uncovered branch, fixed by `3bb5813`), ui 705 tests at 100 %.
- [x] **3. The gate.** 🤖 Sonnet, about 11 minutes: `main` taken in if moved. Done when: `pnpm check` under the lock
  `== exit 0`. Done 2026-11-04 at `122161e`: `pnpm check` `== exit 0`
  on the second whole run (the first, at load 47 from other agents' runs, timed out two ui tests, one in
  `SignIns.test.tsx`, one in `StaffSetupPage.test.tsx`, 5-second limits; a rerun at load below 8 is green, named a rerun); shared
  151, bff 524, ui 701, visual 191, scripts 277 tests, each at 100 %.
- [ ] **4. One review.** 🤖 Opus, about 5 minutes. Done when: each finding is tagged here.
- [ ] **5. The full run** (👤 2), about 17 minutes, plus 2 for its one-off and 2 for its log: `ops/full-run.sh`,
  `--moved` the five. Done when: run 1 green, its raw counts naming only the five; run 2 all 0; 30 bases committed.
- [ ] **6. The recap.** 🤖 Sonnet, about 1 minute. Done when: committed, its products row true.

Total: about 65 minutes, 48 the machine's: what the palettes' steps took on 11-04, a UI-only piece of this size.

## Beside it

- **Milestone 1** (`staff-cards`): both touch `ui/src/i18n/en.ts` and `vi.ts` (here the `staff` block),
  `ui/src/StaffPages.test.tsx` (here its list tests, `#L20-L51`), `visual/src/walks.ts` (here `admin-staff` 1 and 8),
  `walk/specs/piece-2.spec.ts` (here `#L308-L315`) and the bases folder, no screen in common. The second to merge
  reruns its gate on `main`.
- **Line 54's palettes:** only `ui/src/i18n/` in common (its `settings` block); the chip takes the primary from
  `ui/src/theme.ts`, which it changes. Step 2 takes `main` first if it has merged.

## The human's points

👤 **1. The look, after step 2.** On the walks page, the walk "Take on staff: their records, sign-ins and import",
screen 1, "The staff list: name, code, department, position, phone, status", at phone (390), then PC (1280). On the
PC, a Status column of chips and a Status choice where the "Show people who left" box was; on the phone, a card a
person instead of a table scrolling sideways. Does it read as the old app's list? A yes clears step 5; a no becomes a
case, fixed before the full run.

👤 **2. The full run, step 5.** One command in the human's terminal, about 17 minutes. Green starts the recap; a red
names each moved screen, and the machine finds why before any base is kept.
