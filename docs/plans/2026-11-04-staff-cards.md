# Line 58's milestone 1: the person's page in the old app's cards

## At a glance

The partners' staff find a person's details where the old app put them. On a PC the person's page takes the legacy's
two columns of cards, 7 to 5 from `md` (in the old repo,
`workspace/uis/c-mngt/src/pages/employees/EmployeeDetailPage.tsx#L48-L62`); on a tablet and a phone, one column. Its
first card names what the person signs in with: their code, no invented name. The add page takes the same cards in one
column, as the legacy's form (`…/employees/SingleEmployeeForm.tsx#L166-L173`). Screens only: no route, no field.

The cheapest path is what `main` holds: today's page is one column of bordered blocks (`ui/src/PersonPage.tsx#L362-L538`),
each panel a card in all but name (`#L87-L89`, `ui/src/PhotoPanel.tsx#L65-L67`, `ui/src/SignInPanels.tsx#L57-L59`);
two fields a row, Settings' grid (`ui/src/Settings.tsx#L129`). **Price:** $0 a month; about 55 machine minutes and a
17-minute full run.

## The shared frame

The two columns reach every detail page in the end (the human, 11-04 14:51), so the frame is one file,
`ui/src/DetailCards.tsx`, used here by the person's page and the add page only:

- `DetailColumns({ main, side })`: Mantine's `Grid`, 7 and 5 from `md` (992), one column below, `main` first.
- `DetailCard({ title, children })`: the bordered block, its title and its stack; the six panels' one home.
- `FieldPair({ children })`: two fields a row from `sm` (768), one below, as the legacy (`SingleEmployeeForm.tsx#L173`).

**A later page takes it as is:** its fields in `DetailCard`s and `FieldPair`s, identity as `main`, actions and the
danger zone as `side`; nothing added to the frame.

## The slice

- **The person's page.** Above the columns, as today: name, code, the Left badge, Back, the alerts (`#L364-L403`).
  `main`, one form: **Basic information** (name and sign-in name; department and position; today's sign-in sentence,
  `ui/src/i18n/en.ts#L385-L387`, `#L428`, moved from its own block, `ui/src/PersonPage.tsx#L499-L510`, which goes),
  **Contacts** (both phones), **Note** (the note, the company's own fields), **Permissions** (the root), then Save.
  `side`: photo, password, code, email, QR, archive last.
- **The add page.** The same three cards, then Add (`ui/src/AddPersonPage.tsx#L156-L228`); the added view one card
  (`#L102-L117`).

Decided here:

- **The sign-in name is the code,** read-only, the email beside it when allowed and given; shown to whoever sees the
  page, as today (`ui/src/PersonPage.tsx#L499`), not to the root alone as the legacy (`…/detail/EmployeeInfoCards.tsx#L121-L138`).
- **A phone shows `main` first.** *Rejected:* the legacy's actions first (`EmployeeDetailPage.tsx#L39-L46`); here they
  are forms, not one-tap buttons.
- **The walk's sentences stay** (`visual/src/walks.ts#L724`, `#L747`): each still says what its screen shows.

## The case table

| # | The case | Held by |
| --- | --- | --- |
| 1 | The first card names what the person signs in with: the code; the email too when allowed and given; with no password yet, that they cannot sign in yet | unit, `ui/src/StaffPages.test.tsx#L349`, `#L381`; red first |
| 2 | Every field and action of today's page stays, for the same people; Save sends all the details in one press | `StaffPages.test.tsx#L345-L654`, `StaffRecord.test.tsx`, unchanged, green |
| 3 | From 992 the person's page is two columns, 7 to 5; below, one column, details first | the walk |
| 4 | Fields two a row from 768, one below, on both pages | the walk |
| 5 | The add page and the added view wear the same cards, one column | the walk |
| 6 | Every card on both pages is `DetailCard` | `grep -c 'Paper withBorder'` 0 in the two pages and two panel files |
| 7 | The card titles read in Vietnamese and English | unit, `StaffPages.test.tsx#L662` |
| 8 | No screen outside the 16 moves | the full run's `raw.txt` |

## What moves

"Take on staff: their records, sign-ins and import" (`visual/src/walks.ts#L703`): person screens 4, 5, 6, 7, 10, 11,
13, 15, 17, 18; add screens 2, 3, 9, 12, 16; "Look up and add staff, as allowed" (`#L991`) screen 2. **16 screens, 96
pictures.** Of every spec, only `walk/specs/piece-2.spec.ts` opens the two pages (`#L252-L469`).

## Shared with the pieces beside it

- **Milestone 4, the list:** `ui/src/i18n/en.ts`, `vi.ts` (`person.*`, `addPerson.*` against `staff.*`) and
  `ui/src/StaffPages.test.tsx` (the person-page block, `#L345`, against the list's, `#L20`). The second to merge
  takes `main` and keeps both sides.
- **Line 54's palettes:** `ui/src/i18n/` alone; step 4 takes them in.

## Steps

- [ ] **1. This plan.** 🤖 Opus, 9 minutes. Done when: committed, about 1,000 words, no local path.
- [x] **2. The cards on the fake.** 🤖 Sonnet, about 27 minutes, the frame's (`docs/plans/2026-11-03-legacy-frame.md#L52`):
  the frame, both pages, the panels on `DetailCard`, the words. Done when: row 1 red once with the sentence left in its
  old block; rows 2 and 7 green; row 6's grep 0; ui at 100 %, lint clean; `pnpm report` builds, and against `main`'s
  build exactly the 16 screens' versions differ.
  Evidence (2026-11-04, 15:15 to 15:35): row 1 red first (the sentence in its old block: no card named Basic
  information), then green; rows 2 and 7 green (StaffPages, StaffRecord, SignIns: 97 tests); row 6's grep 0; ui 698
  tests and visual 191 tests at 100 %; typecheck, eslint, prettier and knip clean; `pnpm report` builds, and against
  `main`'s build exactly the 16 screens' versions differ (person 4, 5, 6, 7, 10, 11, 13, 15, 17, 18; add 2, 3, 9,
  12, 16; staff-lookup 2). Also moved: two proof lines in `visual/src/words.test.tsx` (`form:` and `main:` become
  `region:`, the cards being sections) and one by-name lookup in `walk/specs/piece-2.spec.ts` made exact, since the
  new "Sign-in name" field holds the name "Tên"/"Name" as a substring.
- [ ] **3. The look** (👤 1); the machine goes on.
- [x] **4. The gate.** 🤖 Sonnet, about 11 minutes (`…/2026-11-03-legacy-frame.md#L56`): `main` taken in; the whole
  `pnpm check` under the lock, `== exit 0`.
  Evidence (2026-11-04, 15:53): `main` still `2414b18`, already in. The whole `pnpm check` at `5b51454` under the lock,
  `== exit 0`; every package at 100 %: shared 151 tests, bff 524, ui 698, visual 191, scripts 277. A first run at load
  11 to 14 failed three ui tests on the 5-second timeout (item 56's flakes: SignIns, StaffRecord, StaffSetupPage);
  the rerun at load 7.8 was green, named a rerun and not a pass of the first.
- [ ] **5. One review.** 🤖 Opus, about 5 minutes (`#L59`). Done when: each finding tagged here.
- [ ] **6. The full run** (👤 2): the one-off about 2 minutes, the run about 17
  (`docs/recaps/2026-11-04-full-run-speed.md#L28`). Done when: run 1 green, its `raw.txt` naming the 16 alone; run 2
  every count 0; 96 bases committed.
- [ ] **7. The recap.** 🤖 Sonnet, about 1 minute (`…/2026-11-03-legacy-frame.md#L66`). Done when: committed, under
  400 words, the products row.

Total: about 72 minutes, 55 the machine's; the cut's ~105 holds the relays and the look.

## The human's points

👤 **1. The look, after step 2.** On the walks page, open "Take on staff: their records, sign-ins and import", screen 4,
"A person's page: details, note, how they sign in", on PC: two columns of cards as in the old app, the code named as
the sign-in name in the first card; then on phone, the same cards in one column. Then screen 2, "Adding a person: name,
code, phone, department, position, note": the same cards. A yes holds; a no becomes a case, fixed before step 6.

👤 **2. The full run, step 6.** One command in your terminal, about 17 minutes, nothing else testing: the 16 screens'
bases written, then a byte compare. Green starts the recap; a red names each moved screen, and the machine finds why
before any base is kept.
