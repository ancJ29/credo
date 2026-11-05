# Line 58's milestone 2: switched off when they leave, back on when they return

## At a glance

A partner's office staff switch a person off when they leave and back on when they return; that person signs in as
before. Today the new app's archive is final — the page says "no one is brought back"
(`ui/src/i18n/en.ts#L433-L434`) — where the legacy's flag goes both ways: off deletes the login, on re-creates it with
the recorded password (the old repo's `employee.controller.ts#L224-L262`, quoted in the cut).

The cheapest path is the mirror of what `main` holds: the archive route writes the flag over the version read, under
`staff.canDelete` (`bff/src/staff.ts#L467-L479`), every call then refuses a person who left (`bff/src/app.ts#L136`),
and their sign-in record, password and code stay untouched (`bff/src/staff.ts#L510-L511`). Back on is one more write
route with `archived: false`: no field, no migration, nothing to re-create. **Price:** $0 a month; about 76 machine
minutes and a 16-minute full run.

## The slice

One: the root switches a person off and back on from the person's page, on the fake and through the stack.

- **The panel.** `ArchivePanel` (`ui/src/PersonPage.tsx#L217-L252`) keeps its shape and gains its mirror, drawn for a
  person who left where today all is hidden (`#L547`), same confirm-then-do check, same `staff.canDelete`.
- **The route.** `employeeRoutes.restore` beside `archive` (`shared/src/wire.ts#L36-L42`), body `{ version }` as the
  archive's (`shared/src/staff.ts#L125`). *Rejected:* one route taking `archived: boolean`: that body is a strict
  object, and halves deployed apart would need a default at the wire boundary (`CLAUDE.md#L23`) for no gain.
- **The sleeping phone.** A session is keyed by its own id (`bff/src/sessions.ts#L29-L35`), lives 7 days (`#L13`) and
  cannot be reached from the person's record; while they are off only the archived check refuses it, so switched back
  on a handle from before would wake. **The switch off therefore mints a fresh `generation` on the sign-in record**,
  the value every call compares (`bff/src/app.ts#L161`): the write `setSignInPassword` already makes for a password
  (`bff/src/staff-records.ts#L81-L87`), the password hash left as it is, so the old password still works and back on
  needs none. Someone with no password yet has no record to write, answered already (`#L80`), and no session.
- **The words.** The legacy's lock and unlock, as decided: `person.archive` and `person.archived` reworded
  (`ui/src/i18n/en.ts#L432-L438`, `ui/src/i18n/vi.ts#L431-L437`: the record and code kept, the person can come back),
  a `person.restore*` set added. *Rejected:* renaming the keys, which moves the walk's scene
  (`visual/src/walks.ts#L803`), the words proof (`visual/src/words.test.tsx#L180-L181`) and the spec
  (`walk/specs/piece-2.spec.ts#L300-L306`) while the stored flag keeps the name `archive`.

**Open items.** 89 closes: nothing reads `person.signIn`, now at `ui/src/i18n/en.ts#L414` and `vi.ts#L415`; both lines
go while the files are open. 90 and 92 to 95 are carried, none triggered here; 91 too, its fix belonging inside `at()`
(`walk/support.ts`), not in one spec.

## The case table

| # | The case | Held by |
| --- | --- | --- |
| 1 | Switched back on, a person's page is a working person's again: no Left badge, the actions back | unit, `ui/src/StaffPages.test.tsx` |
| 2 | The switch back on is offered only on a person who left, and only to someone allowed to archive | unit, same |
| 3 | A switch back on the BFF refuses says so, and the page stays as it was | unit, same |
| 4 | Both panels read in Vietnamese and in English | unit, same |
| 5 | The fake switches back on, moves the version, and conflicts on a stale one | unit, `ui/src/fake.test.tsx` |
| 6 | The route writes `archived: false` over the version read and answers the person as stored | BFF, `bff/src/employees.route.test.ts` |
| 7 | A stale version is a 409 carrying the person as stored | BFF, same |
| 8 | Without `staff.canDelete` it is a 403 and nothing is written | BFF, same |
| 9 | A session issued before the switch off is still a 401 after the switch back on | BFF, same |
| 10 | Switched off and back on, the person signs in with the password they had | BFF, `bff/src/sign-ins.route.test.ts` |
| 11 | Someone with no password yet is switched off and back on all the same | BFF, same |
| 12 | No screen outside the eleven moves | the full run's `raw.txt` |

## What moves

The panel is drawn on every person's page the admin opens, so its new words move all ten person screens of "Take on
staff: their records, sign-ins and import" (`visual/src/walks.ts#L764-L955`: 4, 5, 6, 7, 10, 11, 13, 15, 17, 18), not
screen 7 alone as the cut reads; with the new one, **11 screens, 66 pictures.** No screen of "Look up and add staff,
as allowed" shows a person's page (`#L1018-L1080`), and only `walk/specs/piece-2.spec.ts` opens it. The new screen is
appended, id and number 23, after `staff-22-no-name` (`#L996`): `EMP-0008`, the data set's person who left
(`shared/src/demo.ts#L311-L320`), the unlock pressed and confirmed by name (`with`, `visual/src/steps.ts#L46`).
*Rejected:* inserting it as 8, which renumbers fifteen screens and renames ninety bases. **Shared with milestone 3:**
`ui/src/i18n/`, `ui/src/PersonPage.tsx`, `visual/src/walks.ts`, `walk/specs/piece-2.spec.ts`; the second to merge
takes `main` and keeps both sides.

## Steps

- [ ] **1. This plan.** 🤖 Opus, 7 minutes (the kind's last five: 6, 8, 7, 9, 6). Done when: committed, no local path.
- [ ] **2. Off and back on, on the fake.** 🤖 Sonnet, about 27 minutes (milestone 1's step 2,
  `docs/plans/2026-11-04-staff-cards.md#L76`): the mirror panel, the fake's restore, the words, screen 23. Done when:
  rows 1 to 5 each red once then green; ui and visual at 100 %, lint clean; `pnpm report` builds, and against `main`'s
  build exactly the eleven screens' versions differ.
- [ ] **3. The look** (👤 1 and 2); the machine goes on.
- [ ] **4. The route, and the sessions ended at the switch off.** 🤖 Sonnet, about 25 minutes (D's shape, one write
  route, here with a second record written). Done when: rows 6 to 11 each red once then green; bff at 100 %.
- [ ] **5. The gate.** 🤖 Sonnet, about 11 minutes (`docs/plans/2026-11-04-staff-cards.md#L89`): `main` taken in, the
  whole `pnpm check` under the lock, `== exit 0`.
- [ ] **6. One review.** 🤖 a model other than the author's, about 5 minutes (`#L95`): each finding tagged in the recap.
- [ ] **7. The full run** (👤 3): about 16 minutes. Done when: run 1 green, its `raw.txt` naming the eleven alone; run
  2 every count 0; 66 bases committed.
- [ ] **8. The recap.** 🤖 Sonnet, about 1 minute (`#L101`): committed, under 400 words, item 89 closed, the products
  row true.

## The human's points

👤 **1. The words, after step 2.** On the walks page, "Take on staff" screen 7: the side column says lock where it
said archive, and the check still asks before their sign-in stops. The legacy called it lock and unlock; the new app
called it archive, which sounds final and no longer is. A yes keeps both words; a no names the words you want, and
nothing but the words changes.

👤 **2. The new screen, after step 2.** Screen 23, the page of someone who left, switched back on: the Left badge
gone, their code, password, email and QR where they were, nothing of the record lost. This is what a partner's office
staff do when someone comes back next season. A yes holds; a no becomes a case, fixed before step 7.

👤 **3. The full run, step 7.** One command in your terminal, about 16 minutes, nothing else testing: 66 pictures for
the eleven screens, then a byte compare. Ten are the person's page, re-asked because the panel's new words sit on each
of them. Green starts the recap; a red names every moved screen, and the machine finds why before a base is kept.
