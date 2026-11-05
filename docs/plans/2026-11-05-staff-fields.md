# Line 58's milestone 3: the start date, the birth date and the address

## At a glance

A company that keeps them switches each on in the staff setup; the root then fills them on the person's page. The
legacy keeps all three and the partners' offices use them, so this closes that gap. The legacy puts the two dates in
one row and the address below (`workspace/uis/c-mngt/src/pages/employees/detail/EmployeeInfoCards.tsx#L153-L168`, in
the old repo); the new pages already have that shape from milestone 1: `FieldPair` for a row, a full-width field under
it (`ui/src/DetailCards.tsx#L29-L36`). No route, no migration, no import change — three booleans in the setup's schema
(`shared/src/fields.ts#L56-L63`) and three values in `extra` (`CLAUDE.md#L57`), which the BFF stores untouched
(`shared/src/extra.ts#L3-L5`).

The cheapest path is the one the app already walks: the switches follow the second phone and the photo exactly
(`ui/src/StaffFieldsEditor.tsx#L133-L147`, `ui/src/PersonPage.tsx#L323`, `#L458-L467`,
`ui/src/AddPersonPage.tsx#L69-L72`, `#L206-L213`), and the date check is the company's own date field's
(`shared/src/fields.ts#L102-L105`). **Price:** $0 a month; about 50 machine minutes and a 17-minute full run.

## The slice

- **The setup.** Three checkboxes under the two in the person's-fields group (`ui/src/StaffFieldsEditor.tsx#L133-L147`).
- **The person's page.** In the Basic information card (`ui/src/PersonPage.tsx#L401-L448`): a second `FieldPair` with
  the start date and the birth date, then the address full width below it. Each shows only while its switch is on, and
  is read-only when the viewer may not edit, as every field there (`#L404-L408`).
- **The add page.** The same three in its Basic information card (`ui/src/AddPersonPage.tsx#L157-L197`); the "added"
  view stays one card (`#L95-L135`).
- **The save** sends them inside `extra`, each only while its switch is on, over the stored bag, so a switch turned off
  keeps what was stored (`ui/src/PersonPage.tsx#L330-L337`).

Decided here:

- **Three `z.boolean().optional()`,** as the email and the QR switch (`shared/src/fields.ts#L59-L62`), the off default
  filled at the UI's boundary (`shared/src/staff.ts#L157`), which is what `CLAUDE.md#L23` asks of a field whose halves
  deploy apart. An older UI that sends `fields` without them turns them off, as it does the email and the QR today
  (`shared/src/staff.ts#L189-L198`): no new hazard, and one that omits `fields` whole keeps them.
- **`startDate`, `birthDate` and `address` join the reserved keys** (`shared/src/fields.ts#L11`): otherwise a company's
  own field could take the key and write over the value.
- **The dates are the own date field's check,** `YYYY-MM-DD` and a real day: the lines at
  `shared/src/fields.ts#L102-L105` become one exported day check that `fieldValueIsValid` and the two pages share, and
  a refused date is said at its field, as an own date is (`ui/src/ownFields.tsx#L82`, `#L106-L116`). Both are
  `type="date"` inputs (`#L109`).
- **The address is one line of text with no bound of its own,** as the note (`ui/src/PersonPage.tsx#L469-L475`):
  `extra`'s 8 KB is the one bound (`shared/src/extra.ts#L5`). *Rejected:* the own text field's 500
  (`shared/src/fields.ts#L95`) — a second bound in a second home for the same kind of value.
- **The data set switches the three on and fills them** (`shared/src/demo.ts#L209`, the people `#L262-L300`), so the
  fake and the stack show the same pixels: the stack is seeded from that data set (`scripts/src/generator.ts#L127`,
  `#L172`) and green means fake = stack (`walk/run.sh#L8-L11`). Its own field "Start date" is relabelled to a contract
  date (`shared/src/demo.ts#L153-L154`), the key `started` kept, so no picture shows two start dates and no test moves
  with a key. The demo copies' setup follows (`scripts/src/demo/scenarios.ts#L149`, `#L171`); their people's values
  stay the root's to fill.
- **Import unchanged** (the human named only `.xlsx`): its columns are listed by hand from the switches
  (`ui/src/importSheet.ts#L30-L42`), so nothing joins the template, and the import screens show no own column
  (`ui/src/ImportPage.tsx#L263-L271`).
- **Item 89 closes here:** `person.signIn` goes from `ui/src/i18n/en.ts#L414` and `ui/src/i18n/vi.ts#L415`, the two
  files this piece touches anyway.

## The case table

| # | The case | Held by |
| --- | --- | --- |
| 1 | With the three switched on, the person's page shows the start and birth dates in one row and the address below; each switched off, its field is absent | unit, `ui/src/StaffPages.test.tsx`; red first |
| 2 | The add page shows the same three, and Add sends them in `extra` under `startDate`, `birthDate`, `address` | unit, `StaffPages.test.tsx` |
| 3 | A date that is not a real `YYYY-MM-DD` day is refused at its field and nothing is sent | unit, `shared/src/fields.test.ts` and `StaffPages.test.tsx` |
| 4 | A value stored while a switch was on survives a save made while it is off | unit, `StaffPages.test.tsx` |
| 5 | A company's own field may not take the key `startDate`, `birthDate` or `address` | unit, `shared/src/fields.test.ts` |
| 6 | A setup saved before the three existed reads as off | unit, `shared/src/staff.test.ts` (`staffConfig`) |
| 7 | The setup page switches each on and off and saves it, and the route keeps all three over a round trip | unit, `ui/src/StaffSetupPage.test.tsx`; route, `bff/src/staff-setup.route.test.ts#L171-L177` |
| 8 | The three read in Vietnamese and English on all three pages | unit, `StaffPages.test.tsx`, `StaffSetupPage.test.tsx` |
| 9 | No screen outside the 22 moves | the full run's `raw.txt` |

## What moves

**22 screens, up to 132 pictures** (vi and en at 390, 768, 1280). "The staff setup: departments and positions" 1 and
2 — **1 too, against the cut**: the shot is the whole page (`walk/support.ts#L54-L55`) and the switches are on it
(`visual/src/walks.ts#L697-L717`). "Take on staff": person 4, 5, 6, 7, 10, 11, 13, 15, 17, 18; add 2, 9, 12, 16 —
**not 3**, the added view being one unchanged card. "Look up and add staff, as allowed" 2, the add page. The
relabelled own column moves the five list screens milestone 4 named — "Take on staff" 1, 8, 14, "Look up and add
staff" 1, "Sign in by a QR code" 1 (`docs/plans/2026-11-04-staff-list.md#L45-L49`) — at 768 and 1280 only: the phone
cards carry no own field (`ui/src/StaffListPage.tsx#L239-L267`). Of every spec, only `walk/specs/piece-2.spec.ts`
opens these pages (`#L232-L244`, `#L252-L469`).

## Shared with the piece beside it

Milestone 2 (off and back on) edits `ui/src/PersonPage.tsx`, `ui/src/i18n/en.ts`, `vi.ts` and
`ui/src/StaffPages.test.tsx` as well; the second to merge takes `main` and keeps both sides. **Item 90 stays open:**
this milestone adds no detail page and no side panel, and its fix is in the frame milestone 2 also draws
(`ui/src/DetailCards.tsx#L12`). Items 92 and 93 stay: the phone card and the filter selects are untouched, the
filters taking choice fields alone (`ui/src/StaffListPage.tsx#L212`).

## Steps

- [ ] **1. This plan.** 🤖 Opus, 9 minutes. Done when: committed, about 1,000 words, no local path.
- [x] **2. The three fields on the fake.** 🤖 Sonnet, about 27 minutes (milestone 1's step 2,
  `docs/plans/2026-11-04-staff-cards.md#L76`): the schema and the reserved keys, the shared day check, the setup's
  switches, both pages, the words, the data set, item 89's two lines. Done when: row 1 red once with the fields drawn
  unconditionally, then green; rows 2 to 8 green; shared, ui and scripts at 100 %, lint and knip clean; `pnpm report`
  builds and, against `main`'s build, exactly the 22 screens' versions differ.
  Done 2026-11-05 10:35 to 10:55 (about 20 minutes): row 1's off cases red once with the fields drawn unconditionally
  (five cases red), then green; rows 2 to 8 green, row 3's refused day with the date input made a text input in the
  test, as jsdom never keeps a day that is not one; shared 152 tests, ui 726, scripts 277 and visual 191 at 100 %
  (the scripts' first run missed one branch of `processes.ts` at load 11 to 20 and passed on the rerun); typecheck,
  eslint, prettier and knip clean; `pnpm report` built 109 screens, 218 captures, and against `main`'s build exactly
  22 screens' versions differ, the 22 named above. The own field "Start date" is "Contract date" (vi "Ngày ký hợp
  đồng") in the data set and the demo copies; the three keys are reserved; the shared `dayIsValid` serves the own date
  field and both pages; the BFF route test's round trip holds the three, not run here (the gate's).
- [ ] **3. The look** (👤 1); the machine goes on.
- [x] **4. The gate.** 🤖 Sonnet, about 11 minutes (`#L89`): `main` taken in, the whole `pnpm check` under the lock,
  `== exit 0`.
  Done 2026-11-05 10:58 to 11:04 (6 minutes, 40 seconds of them waiting for the lock): `main` was at the branch point, so
  nothing came in; the whole `pnpm check` under the lock, log `gate-20261105-1057.log`, last line `== exit 0`.
  Review fix pass 2026-11-05: the three keys bind a write only (`customFieldsWriteSchema`, used by the save request and the setup editor), so a stored setup holding an own field keyed `address` still parses; the person's own three values are spread after the company's own fields, so they win over a field sharing a key. Each half red once, then green; items 96 and 97 deferred. Re-check: the whole `pnpm check`, log `gate2-20261105-1114.log`, last line `== exit 0` (5 of its 10 minutes waiting for the lock).
- [ ] **5. One review.** 🤖 another model, about 5 minutes. Done when: each finding fixed, rejected or deferred here.
- [ ] **6. The full run** (👤 2): the one-off about 2 minutes, the run about 17
  (`docs/recaps/2026-11-04-full-run-speed.md#L28`). Done when: run 1 green and its `raw.txt` naming the 22 alone;
  run 2 every count 0; the moved bases committed.
- [ ] **7. The recap.** 🤖 Sonnet, about 1 minute. Done when: committed, under 400 words, the products row true.

Total: about 72 minutes, 50 the machine's; the cut's ~90 holds the relays and the look.

## The human's points

👤 **1. The look, after step 2.** On the walks page, open "The staff setup: departments and positions", screen 2, "The
person's fields: the switches, the company's own fields, the code numbering": three new switches — a start date, a
birth date, an address — beside the second phone and the photo. Then "Take on staff: their records, sign-ins and
import", screen 4, "A person's page", on PC: the two dates in one row and the address below them, in the first card,
as the old app had them; then on phone, the same three one under the other. A yes holds; a no becomes a case, fixed
before step 6.

👤 **2. The full run, step 6.** One command in your terminal, about 17 minutes, nothing else testing: the 22 screens'
bases written, then a byte compare. Green starts the recap; a red names each moved screen, and the machine finds why
before any base is kept. At a tablet width the list's filters still wrap (item 93, known).
