# What credo has on hand

The products credo has, in five groups, read from `main` at `f6f5043`. A row's state reads in
`main`, on a branch, not started, or data on ridge.

Ridge runs what `main` held at its last push. None runs in production: no client has a stack of
its own yet. Ridge is the shared pre-production environment.

The page stays true at each piece's recap: the recap's commit adds or changes the piece's row here
([documentation](conventions/documentation.md#where-progress-lives-three-files-one-job-each)), never
on a calendar.

## 1. The app (UI, then BFF, then c-storage); a client's people

All pages exist in Vietnamese and English, on phone, tablet and PC. The menu shows a person only the
pages their permissions allow ([`ui/src/nav.ts#L27`](../ui/src/nav.ts#L27)).

| Product | What it does, for whom | Runs | State | Open or start | Recap or plan |
| --- | --- | --- | --- | --- | --- |
| Sign-in, own password | Staff sign in by code, email or QR code and change their own password. | local, ridge | in `main` | `pnpm stack` prints the root's sign-in once | [`recaps/2026-10-30-employee-list.md`](recaps/2026-10-30-employee-list.md) |
| Sign-in screens in the app's look | The ten sign-in doors wear the app's coloured header and grey ground; the three join screens also carry the VI / EN switch, kept on the device. | local, ridge | in `main` (the join switch 11-07: look yes) | the walks page, the nine sign-in doors | [`recaps/2026-11-05-signin-look.md`](recaps/2026-11-05-signin-look.md), [`recaps/2026-11-07-join-language.md`](recaps/2026-11-07-join-language.md) |
| Staff and setup | The root keeps departments, positions, people (add, edit, switch off when they leave and back on when they return, import from Excel), photos and what each may do. A person's page and the add page wear the old app's cards: two columns on a PC, one on a phone. The staff list shows an Active or Inactive chip, a Status choice and, on a phone, a card a person. A company that keeps them switches on a start date, a birth date and an address in the staff setup, and the person's page and the add page show them. | local, ridge | in `main` (the cards and the list 11-04: look yes, full run green; the three fields 11-05: look yes on the person's page and the add page, full run green; switching a person off and back on 11-05: look yes, full run green) | menu: Staff, Staff setup | [`recaps/2026-10-30-employee-list.md`](recaps/2026-10-30-employee-list.md), [`recaps/2026-11-04-staff-cards.md`](recaps/2026-11-04-staff-cards.md), [`recaps/2026-11-04-staff-list.md`](recaps/2026-11-04-staff-list.md), [`recaps/2026-11-05-staff-fields.md`](recaps/2026-11-05-staff-fields.md), [`recaps/2026-11-05-staff-off-on.md`](recaps/2026-11-05-staff-off-on.md) |
| The legacy frame | Everyone signed in works in the old app's frame: a coloured header and a hideable side menu on a PC, a header and a foot bar of four pages and More on a phone; the console wears it too. | local | in `main`, its look answered yes | any signed-in screen; `/more` on a phone | [`recaps/2026-11-03-legacy-frame.md`](recaps/2026-11-03-legacy-frame.md) |
| Settings | Whoever may edit settings changes the company's name and logo (logo under 200 KB), and its colour: one of the old app's nine palettes by name, or any colour typed; three switches, off until on, turn the header white, the menu white, and the hidden menu to a strip of icons. | local, ridge | in `main` (the nine palettes 11-04; the white header, white menu and hidden menu's icon strip 11-05: look yes, full run green) | menu: Settings | [`recaps/2026-10-28-app-frame.md`](recaps/2026-10-28-app-frame.md), [`recaps/2026-11-04-palettes.md`](recaps/2026-11-04-palettes.md), [`recaps/2026-11-05-white-frame.md`](recaps/2026-11-05-white-frame.md) |
| Customers and Products | The root reads each list from an Excel template (vi or en), sees every row checked, then adds. A customer's or a product's name opens a page in the old app's cards: two columns on a PC, one on a phone, one full-width column when there is no note. The product's page shows code, name, unit, price and stock, and the note when it has one; whoever may take and edit orders corrects all but the code there, with the same conflict notice. Whoever may take and edit orders also adds a customer or a product from the list's Add button; the product's stock switch starts on, as a blank cell in an import reads. The customer's page is editable by whoever may take and edit orders: the name, phone, address and note are corrected there and saved, and if someone else saved first the page says so, shows what they saved and keeps what was typed; the code is not editable. | local, ridge | in `main` (the customer's page 11-05: look yes, full run green; the product's page 11-06: look yes, full run green; the customer's editing 11-07: look yes, full run green; the product's editing 11-07: look yes on all four screens, full run green; the adds 11-08: look yes on the four screens and again on the stock switch's screen, full run green) | menu: Customers, Products | [`recaps/2026-10-31-customers-products.md`](recaps/2026-10-31-customers-products.md), [`recaps/2026-11-05-customer-cards.md`](recaps/2026-11-05-customer-cards.md), [`recaps/2026-11-06-products-cards.md`](recaps/2026-11-06-products-cards.md), [`recaps/2026-11-07-edit-customer.md`](recaps/2026-11-07-edit-customer.md), [`recaps/2026-11-07-edit-product.md`](recaps/2026-11-07-edit-product.md), [`recaps/2026-11-08-add-records.md`](recaps/2026-11-08-add-records.md) |
| Orders and Delivery requests | Office people make a priced order, confirm it with a driver and a day, and see a day's requests by driver. The order's page reads in the same two columns of cards as the other detail pages (full run green). An order that is still a draft is corrected on its page, its customer and lines; the draft shows the prices it was agreed at, marks a line whose price has moved, and a save reprices it, so the page's total and the driver's cannot differ. | local, ridge | in `main` (the order's editing 11-07: look yes on all three screens, full run green) | menu: Orders, Delivery requests | [`recaps/2026-11-01-orders-delivery.md`](recaps/2026-11-01-orders-delivery.md), [`recaps/2026-11-06-orders-cards.md`](recaps/2026-11-06-orders-cards.md), [`recaps/2026-11-07-edit-order.md`](recaps/2026-11-07-edit-order.md) |
| My deliveries (driver's phone) | A driver scans a QR code, sees today's requests, calls the customer and sends Delivered with a photo; the order becomes Fulfilled. | local, ridge | in `main` | menu: My deliveries (drivers only) | [`recaps/2026-11-01-driver-phone.md`](recaps/2026-11-01-driver-phone.md) |
| Đối soát | The office settles a driver's day against the cash handed in, sees the gap, then closes the day for good. A day closes once, so a second close cannot overwrite the first's cash, and it is recorded against the person who closed it; a person whose record goes mid-close is refused with nothing changed. | local, ridge | in `main` (the money fixes 11-08: no screen moved at all, full run green - a null proof, so there was no new screen to look at) | Delivery requests, a driver's group | [`recaps/2026-11-01-driver-reconcile.md`](recaps/2026-11-01-driver-reconcile.md), [`recaps/2026-11-08-money-defects.md`](recaps/2026-11-08-money-defects.md) |

Not built: stock beyond a flag and goods receipts
([`recaps/2026-11-02-road-to-1104.md`](recaps/2026-11-02-road-to-1104.md)).

## 2. The operator console (`/operator`, for the people who run credo)

| Product | What it does, for whom | Runs | State | Open or start | Recap or plan |
| --- | --- | --- | --- | --- | --- |
| Frame and Clients | An operator lists every client (newest first), adds one and copies its sign-in link. | local, ridge | in `main` | `/operator`, section Clients | [`recaps/2026-10-30-operator-dashboard.md`](recaps/2026-10-30-operator-dashboard.md) |
| A, passkeys | An operator signs in by passkey, joins by a one-time link and keeps their own passkeys (Chrome only; Safari parked). | local, ridge | in `main` | `/operator`; link from `ops/operator.sh ridge` | [`plans/2026-10-29-operator-console.md`](plans/2026-10-29-operator-console.md) |
| B1, operators | An operator lists the operators and adds one by a name; the join link is shown once. | local | in `main`, its look answered yes | `/operator/operators` | [`recaps/2026-11-03-console-operators.md`](recaps/2026-11-03-console-operators.md) |
| B2, a lost passkey and delete | An operator gives another a new link for a lost passkey, shown once after a touch, and deletes another after a page and a touch, never oneself. | local | in `main` | Operators page, a row's "New link" and "Delete" | [`recaps/2026-11-03-console-operators-b2.md`](recaps/2026-11-03-console-operators-b2.md) |
| C, services status | Shows the app, the BFF and c-storage: answering or not, builds and times, refreshed each minute. | local, ridge | in `main` | `/operator/services` | [`plans/2026-10-29-operator-console.md`](plans/2026-10-29-operator-console.md) |
| D, a client's root password | An operator sets a client's root password anew from the Clients list, confirmed by typing the client's code and a passkey touch; the root's sessions end. | local, ridge | in `main`, every look answered yes | Clients row, "New root password" | [`recaps/2026-11-03-console-root-password.md`](recaps/2026-11-03-console-root-password.md) |
| E, delete a client | An operator deletes a client from the Clients list, on a red page that names the company, asks for its code typed and a passkey touch; irreversible. The first press takes the client's one door, so it leaves the list and every session of it is refused at once; its records then go in presses of 200, and a deletion left unfinished is shown nowhere (open item 133). | local | in `main`, its looks answered yes | Clients row, "Delete" | [`recaps/2026-11-05-client-delete.md`](recaps/2026-11-05-client-delete.md) |

Usage and costs, and Activity, are menu entries with an empty "coming soon" page
([`ui/src/operatorNav.ts#L17-L18`](../ui/src/operatorNav.ts#L17-L18)).

## 3. The walk and the walks page (how the human confirms UI)

| Product | What it does, for whom | Runs | State | Open or start | Recap or plan |
| --- | --- | --- | --- | --- | --- |
| The walk specs | 12 Playwright walks (`walk/specs/`) take every screen in vi and en on three widths, on the fake and on a real stack, and compare pixels raw. | local | in `main` | `walk/specs/*.spec.ts` | [`recaps/2026-10-31-walk-steady.md`](recaps/2026-10-31-walk-steady.md) |
| `walk/run.sh` | One command runs any walk, green only when fake, stack and stack again match pixel for pixel; it needs the human's own terminal. Many walks run in three lanes at once. It keeps a claim on its browser and says in one line if the browser is removed mid-run. | local | in `main` | `bash walk/run.sh <walk> [--moved <screen>] [--write] [--serial]` | [`recaps/2026-10-31-walk-steady.md`](recaps/2026-10-31-walk-steady.md), [`recaps/2026-11-07-browser-guard.md`](recaps/2026-11-07-browser-guard.md) |
| `ops/full-run.sh` (the full run) | Runs all twelve walks in three lanes (run 1 writes each walk's bases on its own reads, under a lock of its own, and the verdict names what moved), then run 2 as a byte compare of run 1's pictures against the bases; green only when every count is 0. 16 minutes in the adoption run, about 70 the serial way. | local | in `main` | `bash ops/full-run.sh` in the human's terminal | [`recaps/2026-11-04-full-run-speed.md`](recaps/2026-11-04-full-run-speed.md), [`recaps/2026-11-06-walk-machinery.md`](recaps/2026-11-06-walk-machinery.md) |
| `pnpm report` (the walks page build) | Builds the walks page: 100 screens in two languages, each shown full window, answered yes or no in one key (Yes to all per walk), with a memo on a No. | local | in `main` | `pnpm report`, open the built file from disk | [`recaps/2026-11-03-walks-page.md`](recaps/2026-11-03-walks-page.md) |
| The deployed walks page | The same page for partners (`p1`, `p2`), behind a sign-in by emailed code; `walks.yml` redeploys it on a push to `main` that touches it. | the walks page's hosting (Cloudflare Pages) | in `main` | the page by name, "walks"; `ops/walks-preview.sh` for a private preview | [`recaps/2026-10-29-walks-share.md`](recaps/2026-10-29-walks-share.md) |

The human uses the page as the confirmation form: answers are kept in the browser under the name
typed, and the pasted block is what the machine reads; a No becomes a case
([`plans/2026-11-02-walks-page.md`](plans/2026-11-02-walks-page.md)).

## 4. The demo set

| Product | What it does, for whom | Runs | State | Open or start | Recap or plan |
| --- | --- | --- | --- | --- | --- |
| `pnpm stack` | The whole app on one machine (c-storage, BFF, UI) with a demo company; it goes down on Ctrl-C and takes the data with it. | local | in `main` | `pnpm stack` | [`README.md`](../README.md) |
| `pnpm local` | The app on one Mac that stays up after the command returns: `up` leaves c-storage, the BFF and the front standing on fixed ports (front 3180, c-storage 3181) and prints the demo company's link and the root's password; `status` reads each part; `seed <code> [<name>]` makes another company with the demo set's records; `down` stops it, deletes its data and reads back that nothing is left. | local | on a branch | `pnpm local up` | [`plans/2026-11-10-local-env.md`](plans/2026-11-10-local-env.md) |
| `pnpm fake` | The UI alone over invented data, no server: open the address with `?fake`, sign in as `root` with any password. | local | in `main` | `pnpm fake` | [`README.md`](../README.md) |
| `pnpm mock` | Every screen state of the first piece as one page. | local | in `main` | `pnpm mock` | [`README.md`](../README.md) |
| `pnpm demo` | The same stack plus a demo copy per partner, filled as of four days ago and run forward; each copy's link and root password print once. | local | in `main` | `pnpm demo` | [`recaps/2026-11-01-demo-seed.md`](recaps/2026-11-01-demo-seed.md) |
| `pnpm demo-files` | Eight Excel files (10 rows each, one code already there, one refused) for the presenter's import step, written outside git. | local | in `main` | `pnpm demo-files` | [`recaps/2026-10-31-customers-products.md`](recaps/2026-10-31-customers-products.md) |
| The seed, on demand (`seed.yml`, `ops/seed.sh`) | Brings every demo copy on ridge up to yesterday, at most 2 days a copy a run, when somebody runs it (no schedule since 2026-11-08, so ridge's data is as fresh as the last run, and a run asked once a week cannot keep up: it takes off two days while seven go by); a closed driver day is skipped. | ridge | in `main` | `seed.yml` (or `ops/seed.sh ridge` by hand) | [`recaps/2026-11-02-seed-demo-safe.md`](recaps/2026-11-02-seed-demo-safe.md), [`recaps/2026-11-08-seed-timeout.md`](recaps/2026-11-08-seed-timeout.md) |
| Ridge's demo copies | Two invented companies (S1 building materials, S2 drinks) with three copies each; the `-1` copy is `p1`'s, the `-2` copy is `p2`'s, the `-3` copy the human's. | ridge | data on ridge | the copy's link; root password by `ops/root-password.sh ridge <code>` | [`recaps/2026-11-01-demo-seed.md`](recaps/2026-11-01-demo-seed.md) |

## 5. The machinery around them

| Product | What it does, for whom | Runs | State | Open or start | Recap or plan |
| --- | --- | --- | --- | --- | --- |
| The gate | One check: types, lint, format, tests at 100 percent, unused code; the BFF's tests build the real c-storage, so Go is needed. | local, CI | in `main` | `pnpm check`, and five more ([the gate](../CLAUDE.md#the-gate)) | [`CLAUDE.md`](../CLAUDE.md#the-gate) |
| CI and ridge's deploy (`ci.yml`) | On a push to `main`: the checks, then c-storage's release, the BFF and UI shipped, and ridge checked. | CI, ridge | in `main` | push to `main` | [`recaps/2026-10-28-ridge-app.md`](recaps/2026-10-28-ridge-app.md) |
| c-storage and its Bruno check | The key-value service behind the BFF; 25 requests prove its routes and refusals. | local, ridge | in `main` | `services/c-storage/scripts/e2e.sh` | [`recaps/2026-10-28-c-storage.md`](recaps/2026-10-28-c-storage.md) |
| `ops/` stack scripts | Make the network, GitHub's provider and an environment by change sets; release, app and check scripts, and the crash drill. Run against ridge, which is the only environment there is — but only three of the nine refuse another environment name (`tunnel.sh`, `root-password.sh`, `seed.sh`); the other six would act on a client's stack as readily (open items 131 and 132). | ridge | in `main` | `ops/README.md` (table "At a glance") | [`plans/2026-10-28-ridge.md`](plans/2026-10-28-ridge.md) |
| `ops/tunnel.sh ridge` | Opens ridge's c-storage on the Mac for Bruno or curl, for up to an hour. | ridge | in `main` | `ops/tunnel.sh ridge` | [`recaps/2026-10-28-ridge-tunnel.md`](recaps/2026-10-28-ridge-tunnel.md) |
| `ops/operator.sh`, `ops/root-password.sh` | Make the operator with a one-time join link; set a demo copy's root password, typed once and never shown. | ridge | in `main` | `ops/operator.sh ridge`; `ops/root-password.sh ridge <code>` | [`recaps/2026-11-02-ridge-root-password.md`](recaps/2026-11-02-ridge-root-password.md) |
| `ops/legacy-capture.sh` | Signs in to the legacy app as its root and pictures the screens a file names, on a PC and a phone, opening only and never saving; for whoever compares the legacy with the new app. | the human's terminal only | on `legacy-capture`; run green 11-04 | `bash ops/legacy-capture.sh` (asks for the address, name and password) | [`recaps/2026-11-04-legacy-capture.md`](recaps/2026-11-04-legacy-capture.md) |
| API access log | Every call to a client's API leaves one line in a 14-day log group (time, address, path, answer); a guard refuses a template that loses it. The address, measured once: three calls through the distribution on ridge (2026-11-08, 18:11) left three lines with one address, a public one outside AWS's published ranges and consistent with the caller's own, not an edge node; why is not established (item 157). Throttled calls (429) appear here only. | ridge (applied) | in `main` and live on ridge: the change set ran green there on 2026-11-08 at 17:10 (the project's logs folder, `logs/2026-11-08-171042-stack-ridge.log`, exit 0), and three lines were read back from the log group at 18:12, each carrying all ten fields of the stage's format (the project's logs folder, `logs/20261108-1809-ridge-access-log-read.log`) | `/aws/apigateway/credo-ridge` | [`recaps/2026-11-08-access-log.md`](recaps/2026-11-08-access-log.md) |

## Known gaps

The numbers are [open items](open-items.md).

1. No limit on wrong passwords at the sign-in or at one's own password (open item 28), parked until
   before a client's own stack.
2. Nothing watches the server or sends an alert when it stops (open item 1), and the nightly backup
   and its restore are not built (item 6); both wait for a signed client.
3. A client's own production stack (item 4) and the public address in front of ridge's c-storage
   (item 13) are not built.
4. The console's passkeys are tested in Chrome only, and adding one in Safari may be refused
   (item 30). Adding and removing operators is built and in `main` (rows B1 and B2 above).
5. Two UI tests fail now and then under a heavily loaded machine (item 56), so the gate can read red
   without a defect.
