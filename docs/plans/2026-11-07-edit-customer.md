# Editing a customer on its page

## At a glance

The office opens a customer from the Customers list and corrects its name, phone, address or note there, instead of
going back to the old app. The page is the one built on 11-05 (`ui/src/CustomerPage.tsx`), its values made editable.
**This is the new app's first write,** so the shape settled here is the one the product and order pages copy.

The cheapest safe path is the person's page, copied: a record read with the version it was read at, a save sent back
over that version, a 409 carrying the record as it is now — `bff/src/staff.ts#L417-L460` and
`ui/src/PersonPage.tsx#L634-L663` hold it already, down to the orange notice and its reload button, and the walk
holds the recipe for a genuine conflict on the stack (`walk/specs/piece-2.spec.ts#L173-L191`). **Price:** no new
infrastructure, $0 a month; about 110 machine minutes and one 17-minute picture run. The page also stops reading
every customer to show one.

## The slice

- **The wire**, in `shared/src/lists.ts` beside the employee's (`shared/src/staff.ts#L62-L101`):
  `customerDocSchema` (`{ customer, version }`) and `saveCustomerRequestSchema` (`{ version, name, extra }`).
- **Two routes, customers only** (`bff/src/lists.ts`): `GET /api/customers/:id` answers the record with its tag, for
  whoever may see orders, as the list is (`#L96`); `PUT /api/customers/:id` saves over that version. Products get
  neither until their own milestone.
- **The page**: the same cards, their values in editable inputs, one Save, and the person's page's three notices —
  saved, the save failed, someone else saved first.
- **The fake** gains both calls with a version a customer and the `saveCustomer:409` and `:503` cues, as the
  employee's has (`ui/src/fake.ts#L533-L537`).

Decided here:

- **Editable: the name, the phone, the address, the note. The code is not** — changing a code re-runs the list's
  uniqueness rule, which for a person is its own route (`changeCode`); *trigger:* the office asking to re-code a
  customer.
- **Validation:** the name required, trimmed, at most 200 characters (`nameSchema`); the three texts free and
  trimmed, an emptied one removing its own key from `extra` (`mergeExtra`, as the person's save does); `extra` stays
  bounded at 8 KB (`shared/src/extra.ts#L34`). *Why these four:* they are what the page already shows.
- **A false conflict is recovered, never bypassed:** a `moved` tag is re-read once, and if the stored record already
  holds exactly what was asked, our own write landed and the save counts as saved; anything else is a genuine
  conflict, answered 409 with the record as it is now.
- **`orders.canEdit` gates the save** — no new permission: that catalogue entry already gates making and saving an
  order, and `orders.canView` already reads this list (👤 2).
- **The note card is drawn for whoever may edit, empty or not** — else a note could never be added; a reader who may
  not edit still sees it only when it has text. Item 105's one rule gains no seventh copy: the page's condition
  becomes `editable || note`.
- **A missing customer is `null`, not an error** (`api.getCustomer`), so an unknown id keeps the page's "not in the
  list" notice instead of the loader's red.

## The case table

| # | The case | Held by |
| --- | --- | --- |
| 1 | A name, phone, address and note saved over the version read are stored, and the answer carries the record and its new version | BFF route, `bff/src/lists.route.test.ts`; red first |
| 2 | A save over a version that moved writes nothing and answers 409 with the customer as it is now | BFF route; red first |
| 3 | A save whose write landed and whose answer was lost counts as saved, not as a conflict | BFF route; red first |
| 4 | Whoever may see orders but not edit them cannot save: 403, and nothing written | BFF route; red first |
| 5 | A save carrying a code, or an unknown field, is refused and writes nothing | BFF route; red first |
| 6 | An emptied field removes its key from `extra`; a key the form never shows survives a save | unit, `ui/src/CustomerPage.test.tsx`; red first |
| 7 | An empty name is refused on the page, and no call is made | unit, same file; red first |
| 8 | Someone else saving first shows the notice and its reload, and keeps what was typed | unit, same file; red first |
| 9 | Whoever may not edit sees the values and no Save button | unit, same file; red first |
| 10 | The cards are still `DetailCard` (`grep -c withBorder ui/src/CustomerPage.tsx` is 0); every new word reads in both languages | the grep; `visual/src/words.test.tsx` |

## What moves

"Customers and products from Excel": screens **10** and **11** move — their fields are editable now and 11 draws an
empty note card — and two are **appended as 14 and 15**, never inserted, or the thirteen ids renumber and lose their
yeses. 14 is a save that landed, 15 someone else saving first. **4 screens, 24 pictures** (vi and en at 390, 768,
1280). Each new screen needs its scene in `visual/src/walks.ts`, its opening in `walk/specs/lists.spec.ts` and its
first heading in `visual/src/words.test.tsx`; screen 15 is cued on the fake lane and genuinely conflicted on the
stack lane, as the staff walk's screen 10 is.

**Beside it:** line 65 also appends to `docs/open-items.md`; the second to merge takes `main` at step 5 and keeps
both sides. Nothing else of this piece is shared.

## Steps

- [ ] **1. This plan.** 🤖 Opus, 25 minutes. Done when: committed, about 1,000 words or under, no local path.
- [ ] **2. The form on invented data, the cheap end to end.** 🤖 Sonnet, about 35 minutes: the two wire schemas, the
  fake's two calls with a version a customer, the page's form and three notices, the words in both dictionaries, the
  two scenes, the spec's two screens. The look comes off this build, so a no costs no server work. Done when: rows 6
  to 10 each red once, then green; `pnpm --filter @credo/shared check`,
  `--filter @credo/ui check` and `--filter @credo/visual check` green at 100 %; `pnpm fake` serves the page;
  `pnpm report` builds, and against `main`'s build exactly screens 10, 11, 14 and 15 differ.
- [ ] **3. The look** (👤 1, 👤 2); the machine goes straight on to step 4 and does not wait for it.
- [ ] **4. The route against the real c-storage.** 🤖 Sonnet, about 30 minutes: the two routes and the
  false-conflict re-read; nothing of the page changes, since step 2 bound it to the wire, not to a route still
  moving. Done when: rows 1 to 5 each red once, then green (`bff/tests/` builds the real c-storage per file);
  `pnpm --filter @credo/bff check` green at 100 %.
- [ ] **5. The gates.** 🤖 Sonnet, about 12 minutes: `main` taken in, then the whole `pnpm check` once under the
  lock, `== exit 0`. **The one place the whole gate runs:** `walk/` and `visual/` typecheck against this piece's
  changes in `ui/` and `shared/`, so no single package's gate can clear it.
- [ ] **6. One review.** 🤖 Opus, about 6 minutes, not the build's model. Done when: each finding tagged here.
- [ ] **7. The picture run** (👤 3): one command, about 17 minutes. Done when: run 1 green, its `raw.txt` naming the
  four screens alone; run 2 every count 0; 24 bases committed.
- [ ] **8. The recap.** 🤖 Sonnet, about 2 minutes. Done when: committed, under 400 words, the products row true.

About 110 machine minutes. Opens nothing; closes nothing — item 105 stays open, one copy lighter than it would be.

## The human's points

👤 **1. The look, after step 2.** On the walks page, open "Customers and products from Excel". Screen 10, a customer
with a note: the same two columns as yesterday, but each value now in a box you can type in, with a Save under them.
Screen 11, a customer with no note: an empty note card to write one into. Screen 14, a save that landed: a green
notice. Screen 15: someone else saved first — an orange notice and a button to see what they saved, with what you
typed still in the boxes. A yes holds; a no becomes a case, fixed before step 7.

👤 **2. Who may correct a customer, at the same look.** The Save button appears for anyone who may take and edit
orders — the office's order-takers — because they already read this list. **Recommendation: yes, keep it there.**
It needs no new permission and no setting to turn on. A no means a permission of its own for the customer list, which
costs the staff setup a new switch and every person's page a new line, and that becomes its own milestone.

👤 **3. The picture run, step 7.** One command in your terminal, about 17 minutes, nothing else testing: the four
screens' base pictures written, then a second run compared byte for byte. Green starts the recap. A red names each
moved screen, and the machine finds why before any base is kept.
