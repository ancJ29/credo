---
partner_page: docs/partners/what-credo-has.md
---

# What credo has on hand

**What runs on ridge.** Ridge runs what `main` held at the last push whose `ci` run deployed it, and a push to `main`
that touches code deploys onto it; the commit is named by that run, the last green `ci` run on `main` in GitHub's
Actions list, and nowhere on this page. The docs site and the walks page run on their own addresses, each deployed by
its own workflow (`docs.yml`, `walks.yml`). A row's "Runs" column says where a product runs and its "State" says
whether that run was read. Nothing runs in production: no client has a stack of its own yet. Ridge is the shared
pre-production environment, one box.

The products credo has, in five groups. A row's state reads in `main`, on a branch, not started, or data on ridge.

The page stays true at each piece's recap: the recap's commit adds or changes the piece's row here
([documentation](conventions/documentation.md#where-progress-lives-three-files-one-job-each)), never
on a calendar.

To check a piece on ridge without reading code, open the section
[Check a piece on ridge, without code](#check-a-piece-on-ridge-without-code) below and read the piece's card.

## 1. The app (UI, then BFF, then c-storage); a client's people

All pages exist in Vietnamese and English, on phone, tablet and PC. The menu shows a person only the
pages their permissions allow ([`ui/src/nav.ts#L27`](../ui/src/nav.ts#L27)).

| Product | What it does, for whom | Runs | State | Open or start | Recap or plan |
| --- | --- | --- | --- | --- | --- |
| Sign-in, own password | Staff sign in by code, email or QR code and change their own password. | local, ridge | in `main` | `pnpm stack` prints the root's sign-in once | [`recaps/2026-10-30-employee-list.md`](recaps/2026-10-30-employee-list.md) |
| Sign-in screens in the app's look | The ten sign-in doors wear the app's coloured header and grey ground; the three join screens also carry the VI / EN switch, kept on the device. | local, ridge | in `main` (the join switch 11-07: look yes) | the walks page, the nine sign-in doors | [`recaps/2026-11-05-signin-look.md`](recaps/2026-11-05-signin-look.md), [`recaps/2026-11-07-join-language.md`](recaps/2026-11-07-join-language.md) |
| Staff and setup | The root keeps departments, positions, people (add, edit, switch off when they leave and back on when they return, import from Excel), photos and what each may do. A person's page and the add page wear the old app's cards: two columns on a PC, one on a phone. The staff list shows an Active or Inactive chip, a Status choice and, on a phone, a card a person. A company that keeps them switches on a start date, a birth date and an address in the staff setup, and the person's page and the add page show them. | local, ridge | in `main` (the cards and the list 11-04: look yes, full run green; the three fields 11-05: look yes on the person's page and the add page, full run green; switching a person off and back on 11-05: look yes, full run green) | menu: Staff, Staff setup | [`recaps/2026-10-30-employee-list.md`](recaps/2026-10-30-employee-list.md), [`recaps/2026-11-04-staff-cards.md`](recaps/2026-11-04-staff-cards.md), [`recaps/2026-11-04-staff-list.md`](recaps/2026-11-04-staff-list.md), [`recaps/2026-11-05-staff-fields.md`](recaps/2026-11-05-staff-fields.md), [`recaps/2026-11-05-staff-off-on.md`](recaps/2026-11-05-staff-off-on.md) |
| The legacy frame | Everyone signed in works in the old app's frame: a coloured header and a hideable side menu on a PC, a header and a foot bar of four pages and More on a phone; the console wears it too. | local | in `main`, its look answered yes | any signed-in screen; `/more` on a phone | [`recaps/2026-11-03-legacy-frame.md`](recaps/2026-11-03-legacy-frame.md) |
| Settings | Whoever may edit settings changes the company's name and logo (logo under 200 KB), and its colour: one of six palettes by name, or any colour typed, the text on it white or dark by one rule, whichever reads at 4.5:1; three switches, off until on, turn the header white, the menu white, and the hidden menu to a strip of icons. | local, ridge | in `main` (the palettes 11-04, six of them since 11-20; the white header, white menu and hidden menu's icon strip 11-05: look yes, full run green) | menu: Settings | [`recaps/2026-10-28-app-frame.md`](recaps/2026-10-28-app-frame.md), [`recaps/2026-11-04-palettes.md`](recaps/2026-11-04-palettes.md), [`recaps/2026-11-05-white-frame.md`](recaps/2026-11-05-white-frame.md) |
| Customers and Products | The root reads each list from an Excel template (vi or en), sees every row checked, then adds. A customer's or a product's name opens a page in the old app's cards: two columns on a PC, one on a phone, one full-width column when there is no note. The product's page shows code, name, unit, price and stock, and the note when it has one; whoever may take and edit orders corrects all but the code there, with the same conflict notice. Whoever may take and edit orders also adds a customer or a product from the list's Add button; the product's stock switch starts on, as a blank cell in an import reads. The customer's page is editable by whoever may take and edit orders: the name, phone, address and note are corrected there and saved, and if someone else saved first the page says so, shows what they saved and keeps what was typed; the code is not editable. | local, ridge | in `main` (the customer's page 11-05: look yes, full run green; the product's page 11-06: look yes, full run green; the customer's editing 11-07: look yes, full run green; the product's editing 11-07: look yes on all four screens, full run green; the adds 11-08: look yes on the four screens and again on the stock switch's screen, full run green; the one body for the four screens 11-10: no screen moved, picture run green) | menu: Customers, Products | [`recaps/2026-10-31-customers-products.md`](recaps/2026-10-31-customers-products.md), [`recaps/2026-11-05-customer-cards.md`](recaps/2026-11-05-customer-cards.md), [`recaps/2026-11-06-products-cards.md`](recaps/2026-11-06-products-cards.md), [`recaps/2026-11-07-edit-customer.md`](recaps/2026-11-07-edit-customer.md), [`recaps/2026-11-07-edit-product.md`](recaps/2026-11-07-edit-product.md), [`recaps/2026-11-08-add-records.md`](recaps/2026-11-08-add-records.md), [`recaps/2026-11-10-ui-shape.md`](recaps/2026-11-10-ui-shape.md) |
| Orders and Delivery requests | Office people make a priced order, confirm it with a driver and a day, and see a day's requests by driver. The order's page reads in the same two columns of cards as the other detail pages (full run green). An order that is still a draft is corrected on its page, its customer and lines; the draft shows the prices it was agreed at, marks a line whose price has moved, and a save reprices it, so the page's total and the driver's cannot differ. | local, ridge | in `main` (the order's editing 11-07: look yes on all three screens, full run green) | menu: Orders, Delivery requests | [`recaps/2026-11-01-orders-delivery.md`](recaps/2026-11-01-orders-delivery.md), [`recaps/2026-11-06-orders-cards.md`](recaps/2026-11-06-orders-cards.md), [`recaps/2026-11-07-edit-order.md`](recaps/2026-11-07-edit-order.md) |
| My deliveries (driver's phone) | A driver scans a QR code, sees today's requests, calls the customer and sends Delivered with a photo, which goes to the photo store (R2) before the order becomes Fulfilled; the office opens the delivery and sees it, or reads that it did not arrive. | local, ridge | in `main`; on ridge 11-15, your photo from a phone showed on the office's request | menu: My deliveries (drivers only); [the check on ridge, step by step](partners/what-credo-has.md#example-the-delivery-photo) | [`recaps/2026-11-01-driver-phone.md`](recaps/2026-11-01-driver-phone.md), [`recaps/2026-11-15-delivery-photos.md`](recaps/2026-11-15-delivery-photos.md) |
| Đối soát | The office settles a driver's day against the cash handed in, sees the gap, then closes the day for good. A day closes once, so a second close cannot overwrite the first's cash, and it is recorded against the person who closed it; a person whose record goes mid-close is refused with nothing changed. | local, ridge | in `main` (the money fixes 11-08: no screen moved at all, full run green - a null proof, so there was no new screen to look at) | Delivery requests, a driver's group | [`recaps/2026-11-01-driver-reconcile.md`](recaps/2026-11-01-driver-reconcile.md), [`recaps/2026-11-08-money-defects.md`](recaps/2026-11-08-money-defects.md) |

Not built: stock beyond a flag and goods receipts
([`recaps/2026-11-02-road-to-1104.md`](recaps/2026-11-02-road-to-1104.md)).

## 2. The operator console (`/operator`, for the people who run credo)

| Product | What it does, for whom | Runs | State | Open or start | Recap or plan |
| --- | --- | --- | --- | --- | --- |
| Frame and Clients | An operator lists every client (newest first), adds one and copies its sign-in link; once the stack names a domain, the link is the company's own address, `https://<code>.<domain>/login`. | local, ridge | in `main`; the own address on ridge 11-14: your look yes, the first demo copy opened at its own address with its own sign-in page | `/operator`, section Clients | [`recaps/2026-10-30-operator-dashboard.md`](recaps/2026-10-30-operator-dashboard.md), [`recaps/2026-11-14-company-address.md`](recaps/2026-11-14-company-address.md) |
| A, passkeys | An operator signs in by passkey, joins by a one-time link and keeps their own passkeys (Chrome only; Safari parked). | local, ridge | in `main` | `/operator`; link from `ops/operator.sh ridge` | [`plans/2026-10-29-operator-console.md`](plans/2026-10-29-operator-console.md) |
| B1, operators | An operator lists the operators and adds one by a name; the join link is shown once. | local | in `main`, its look answered yes | `/operator/operators` | [`recaps/2026-11-03-console-operators.md`](recaps/2026-11-03-console-operators.md) |
| B2, a lost passkey and delete | An operator gives another a new link for a lost passkey, shown once after a touch, and deletes another after a page and a touch, never oneself. | local | in `main` | Operators page, a row's "New link" and "Delete" | [`recaps/2026-11-03-console-operators-b2.md`](recaps/2026-11-03-console-operators-b2.md) |
| C, services status | Shows the app, the BFF and c-storage: answering or not, builds and times, refreshed each minute. | local, ridge | in `main` | `/operator/services` | [`plans/2026-10-29-operator-console.md`](plans/2026-10-29-operator-console.md) |
| D, a client's root password | An operator sets a client's root password anew from the Clients list, confirmed by typing the client's code and a passkey touch; the root's sessions end. | local, ridge | in `main`, every look answered yes | Clients row, "New root password" | [`recaps/2026-11-03-console-root-password.md`](recaps/2026-11-03-console-root-password.md) |
| E, delete a client | An operator deletes a client from the Clients list, on a red page that names the company, asks for its code typed and a passkey touch; irreversible. The first press takes the client's one door, so it leaves the list and every session of it is refused at once; its records then go in presses of 200, and a deletion left unfinished is shown nowhere (open item 133). | local, ridge | in `main`, its looks answered yes; on ridge 11-12, in your walk, a test company was added, its root and one person signed in, one order made, and that company deleted alone | Clients row, "Delete" | [`recaps/2026-11-05-client-delete.md`](recaps/2026-11-05-client-delete.md) |
| F, a company's box | An operator picks the box a new company lives on from a list showing each box's free disk and how many companies it holds; the company's line names the box and its people notice nothing. An operator adds a box to an environment by command, and release, app and check go over each box. | local, ridge | in `main`; on ridge 2026-11-16 a second box was added, both boxes released and checked (the home box's check red on its own list only, fixed since), and the box removed again, so ridge holds one box | `pnpm stack` (two boxes), `/operator`, Clients, add a client; `ops/stack.sh env ridge --more-boxes b2` (`ops/README.md`, "Adding a box") | [`recaps/2026-11-14-pooled-shape-first-landing.md`](recaps/2026-11-14-pooled-shape-first-landing.md), [`recaps/2026-11-14-pooled-shape-second-landing.md`](recaps/2026-11-14-pooled-shape-second-landing.md), [`plans/2026-11-11-pooled-shape.md`](plans/2026-11-11-pooled-shape.md) |
| G, move a company | An operator moves a company to another box from the Clients list, after a page and a passkey touch; its people are told to try again only while it moves, and a stop before the switch puts it back whole. The list shows each company's box. | local, ridge | in `main`; on ridge 2026-11-17 a company was moved to a second box, the look answered yes and both boxes read green after, then the second box was removed again, so ridge holds one box | Clients row, "Move to another box", shown when the back end holds more than one box | [`recaps/2026-11-16-shape-move.md`](recaps/2026-11-16-shape-move.md), [`plans/2026-11-16-shape-move.md`](plans/2026-11-16-shape-move.md) |

Usage and costs, and Activity, are menu entries with an empty "coming soon" page
([`ui/src/operatorNav.ts#L17-L18`](../ui/src/operatorNav.ts#L17-L18)).

## 3. The walk and the walks page (how the human confirms UI)

| Product | What it does, for whom | Runs | State | Open or start | Recap or plan |
| --- | --- | --- | --- | --- | --- |
| The walk specs | 12 Playwright walks (`walk/specs/`) take every screen in vi and en on three widths, on the fake and on a real stack, and compare pixels raw. | local | in `main` | `walk/specs/*.spec.ts` | [`recaps/2026-10-31-walk-steady.md`](recaps/2026-10-31-walk-steady.md) |
| `walk/run.sh` | One command runs any walk, green only when fake, stack and stack again match pixel for pixel; it needs the human's own terminal. Many walks run in three lanes at once. It keeps a claim on its browser and says in one line if the browser is removed mid-run. | local | in `main` | `bash walk/run.sh <walk> [--moved <screen>] [--write] [--serial]` | [`recaps/2026-10-31-walk-steady.md`](recaps/2026-10-31-walk-steady.md), [`recaps/2026-11-07-browser-guard.md`](recaps/2026-11-07-browser-guard.md) |
| `ops/full-run.sh` (the full run) | Runs all twelve walks in three lanes (run 1 writes each walk's bases on its own reads, under a lock of its own, and the verdict names what moved), then run 2 as a byte compare of run 1's pictures against the bases; green only when every count is 0. 16 minutes in the adoption run, about 70 the serial way. | local | in `main` | `bash ops/full-run.sh` in the human's terminal | [`recaps/2026-11-04-full-run-speed.md`](recaps/2026-11-04-full-run-speed.md), [`recaps/2026-11-06-walk-machinery.md`](recaps/2026-11-06-walk-machinery.md) |
| `pnpm report` (the walks page build) | Builds the walks page: 100 screens in two languages, each shown full window, answered yes or no in one key (Yes to all per walk), with a memo on a No. | local | in `main` | `pnpm report`, open the built file from disk | [`recaps/2026-11-03-walks-page.md`](recaps/2026-11-03-walks-page.md) |
| The deployed walks page | The same page for partners (`p1`, `p2`), open by its link, with no sign-in; `walks.yml` redeploys it on a push to `main` that touches it. | the walks page's hosting (Cloudflare Pages) | in `main` | the page by name, "walks"; `ops/walks-preview.sh` for a preview | [`recaps/2026-10-29-walks-share.md`](recaps/2026-10-29-walks-share.md) |
| The design system's gallery | A page of our own, no Storybook: the legacy app's colours, type and spacing read from the theme, Mantine's button and field in it, then eleven sample components in three levels (atoms, molecules, organisms), each in its states. A lint rule keeps a level importing only from below; no screen of the app changed. The gallery's list hides and folds by group and kind, its parts can be drawn in six colour themes (the gallery's alone), and its "On the brand" entry shows the text the rule picks on each of those six and on two typed colours, and the links on white, before and after, each with its ratio; it opens on "Start here", the design guideline's charter (your goal, what credo is, where a coder looks, ten rules); "Values" gives each colour role, text style, gap, width, icon size, corner, shadow and format its use, and draws it; each part's entry says when to use it, when not and what instead; "Pages" draws the page base, the frame and then one page from parts only, with a contract on every part's entry; "Rules" stays an empty group; it is laid out as layout B. | local and ridge | landing 1 of 3 of the design guideline's skeleton (the charter and every value with its use), in `main` (the review before `main` done), no screen moved, your look at point 1 yes; landing 2 of 3 (the contracts of FormMessage, PageState, ActionButton and StatusBadge, drawn in their entries, no screen moved), your look at point 2 yes; landing 3 of 3 (the Pages group and the contracts of the other parts, no screen moved), your look at point 3 yes; for a computer only, a phone or a tablet getting the not-found screen at its address (the human's decision of 2026-11-19, in `main`); landing 2 of 3 (one home for the colours, light only): no picture moved, your run green; in `main`: five sign-in parts added, eleven in all, your look yes; landing 3 (the legacy's values on the cards, headers, menu and dialog) in `main`: 728 of 786 pictures moved, your first picture run green, your second run green with every picture the same and no base written, your look at the walks page open; in `main`: the gallery at its own address, the parts in a list, one part at a time, your look on ridge, on a computer and a phone, yes 2026-11-17 | `/48b74d079/gallery` at the app's address, on ridge or locally; in `ui/`, `pnpm exec vite --open /48b74d079/gallery` (Ctrl-C ends it) | [`recaps/2026-11-16-design-system-skeleton.md`](recaps/2026-11-16-design-system-skeleton.md), [`recaps/2026-11-17-gallery-workbench.md`](recaps/2026-11-17-gallery-workbench.md), [`recaps/2026-11-19-gallery-side-list.md`](recaps/2026-11-19-gallery-side-list.md), [`recaps/2026-11-19-gallery-desktop-only.md`](recaps/2026-11-19-gallery-desktop-only.md), [`recaps/2026-11-20-design-fixes.md`](recaps/2026-11-20-design-fixes.md), [`recaps/2026-11-21-design-skeleton.md`](recaps/2026-11-21-design-skeleton.md), [`plans/2026-11-12-design-system.md`](plans/2026-11-12-design-system.md), [`plans/2026-11-21-design-skeleton.md`](plans/2026-11-21-design-skeleton.md) |

The human uses the page as the confirmation form: answers are kept in the browser under the name
typed, and the pasted block is what the machine reads; a No becomes a case
([`plans/2026-11-02-walks-page.md`](plans/2026-11-02-walks-page.md)).

## 4. The demo set

| Product | What it does, for whom | Runs | State | Open or start | Recap or plan |
| --- | --- | --- | --- | --- | --- |
| `pnpm stack` | The whole app on one machine (c-storage, BFF, UI) with a demo company; it goes down on Ctrl-C and takes the data with it. | local | in `main` | `pnpm stack` | [`README.md`](../README.md) |
| `pnpm local` | The app on one Mac that stays up after the command returns: `up` leaves c-storage, the BFF and the front standing on fixed ports (front 3180, c-storage 3181) and prints the demo company's link and the root's password; `status` reads each part; `seed <code> [<name>]` makes another company with the demo set's records; `stop` turns it off and keeps its data, which the next `up` resumes; `down` stops it, deletes its data and reads back that nothing is left; `up` also starts the audit service (ports 3184 and 3185), and `activity <code> <record id>` prints one record's history, newest first: when, who, what was done and the names of the fields changed. | local | in `main` | `pnpm local up`, then [`quick-start.md`](quick-start.md) | [`recaps/2026-11-10-local-env.md`](recaps/2026-11-10-local-env.md), [`recaps/2026-11-10-audit-bff.md`](recaps/2026-11-10-audit-bff.md) |
| `pnpm fake` | The UI alone over invented data, no server: open the address with `?fake`, sign in as `root` with any password. | local | in `main` | `pnpm fake` | [`README.md`](../README.md) |
| `pnpm mock` | Every screen state of the first piece as one page. | local | in `main` | `pnpm mock` | [`README.md`](../README.md) |
| `pnpm demo` | The same stack plus a demo copy per partner, filled as of four days ago and run forward; each copy's link and root password print once. | local | in `main` | `pnpm demo` | [`recaps/2026-11-01-demo-seed.md`](recaps/2026-11-01-demo-seed.md) |
| `pnpm demo-files` | Eight Excel files (10 rows each, one code already there, one refused) for the presenter's import step, written outside git. | local | in `main` | `pnpm demo-files` | [`recaps/2026-10-31-customers-products.md`](recaps/2026-10-31-customers-products.md) |
| `pnpm words` | `out` writes the app's 756 words, English and Vietnamese, to one spreadsheet file a partner can open and change; `in` reads the returned file against the one sent, shows each change and writes the ones you answer y to into the two word files. | local | in `main`, both looks yes; the one-paste return (`ops/words-in.sh`) too | `pnpm words out <file>`; `pnpm words in <sent> <returned>`; the whole round trip with a partner, by one paste, in [`ops/README.md`](../ops/README.md#a-partners-returned-words) | [`recaps/2026-11-16-words-csv.md`](recaps/2026-11-16-words-csv.md), [`plans/2026-11-17-words-paste.md`](plans/2026-11-17-words-paste.md) |
| The seed, on demand (`seed.yml`, `ops/seed.sh`) | Brings every demo copy on ridge up to yesterday, at most 2 days a copy a run, when somebody runs it (no schedule since 2026-11-08, so ridge's data is as fresh as the last run, and a run asked once a week cannot keep up: it takes off two days while seven go by); a closed driver day is skipped. | ridge | in `main` | `seed.yml` (or `ops/seed.sh ridge` by hand), after `ops/demo-remake.sh ridge` has made the copies | [`recaps/2026-11-02-seed-demo-safe.md`](recaps/2026-11-02-seed-demo-safe.md), [`recaps/2026-11-08-seed-timeout.md`](recaps/2026-11-08-seed-timeout.md) |
| Ridge's demo copies | Two invented companies (S1 building materials, S2 drinks) with three copies each; the `-1` copy is `p1`'s, the `-2` copy is `p2`'s, the `-3` copy the human's. | ridge | made by `ops/demo-remake.sh ridge` (about 2.6 hours, one password a partner); gone with the old ridge's disk; in `main`, the remake fills the six on this Mac and copies each to ridge whole on one tunnel, aimed at about 10 minutes, with `--go-on` copying again only what differs after a stop (0.8 minutes between two stores on this Mac, 2.3 minutes on ridge) | `ops/demo-remake.sh ridge`; the copy's link; a root password later by `ops/root-password.sh ridge <code>` | [`recaps/2026-11-01-demo-seed.md`](recaps/2026-11-01-demo-seed.md), [`recaps/2026-11-13-long-runs.md`](recaps/2026-11-13-long-runs.md) |

## 5. The machinery around them

| Product | What it does, for whom | Runs | State | Open or start | Recap or plan |
| --- | --- | --- | --- | --- | --- |
| The gate | One check: types, lint, format, tests at 100 percent, unused code; the BFF's tests build the real c-storage, so Go is needed. | local, CI | in `main` | `pnpm check`, and five more ([the gate](../CLAUDE.md#the-gate)) | [`CLAUDE.md`](../CLAUDE.md#the-gate) |
| CI and ridge's deploy (`ci.yml`) | On a push to `main`, or a press of **Run workflow** on `main`: the checks, then c-storage's release, the BFF and UI shipped, and ridge checked. | CI, ridge | in `main` | push to `main`, or the press | [`recaps/2026-10-28-ridge-app.md`](recaps/2026-10-28-ridge-app.md), [`recaps/2026-11-12-ridge-by-script.md`](recaps/2026-11-12-ridge-by-script.md) |
| The docs site (`site/`) | The pages of the docs map (`docs/partners/map.md`, the site's first page) in one site, for partners and readers who do not code; a page not on the map is not published. Open by its link, kept out of search engines. `docs.yml` builds it on every push that changes a page it shows and, on `main`, publishes it to its own Cloudflare Pages project. | local, CI, its Pages project | in `main` and live on its own address: `docs.yml` publishes it on a push that changes a page it shows, the address answers and is kept out of search engines | `pnpm --filter @credo/site start`; on `main`, its project's name in the secret `CLOUDFLARE_PAGES_DOCS_PROJECT` of the environment `walks` | [`site/CLAUDE.md`](../site/CLAUDE.md) |
| c-storage and its Bruno check | The key-value service behind the BFF; 25 requests prove its routes and refusals. | local, ridge | in `main` | `services/c-storage/scripts/e2e.sh` | [`recaps/2026-10-28-c-storage.md`](recaps/2026-10-28-c-storage.md) |
| `ops/` stack scripts | Make the network, GitHub's provider and an environment by change sets; release, app and check scripts, and the crash drill. Run against ridge, which is the only environment there is — but only four refuse another environment name (`drill.sh`, `tunnel.sh`, `root-password.sh`, `seed.sh`); the check only reads there and the other four act as their table says (`ops/README.md`, "On production"). | ridge | in `main` | `ops/README.md` (table "At a glance") | [`plans/2026-10-28-ridge.md`](plans/2026-10-28-ridge.md), [`recaps/2026-11-12-safe-scripts.md`](recaps/2026-11-12-safe-scripts.md) |
| `ops/tunnel.sh ridge` | Opens ridge's c-storage on the Mac for Bruno or curl, for up to an hour. | ridge | in `main` | `ops/tunnel.sh ridge` | [`recaps/2026-10-28-ridge-tunnel.md`](recaps/2026-10-28-ridge-tunnel.md) |
| `ops/operator.sh`, `ops/root-password.sh` | Make the operator with a one-time join link; set a demo copy's root password, typed once and never shown. | ridge | in `main` | `ops/operator.sh ridge`; `ops/root-password.sh ridge <code>` | [`recaps/2026-11-02-ridge-root-password.md`](recaps/2026-11-02-ridge-root-password.md) |
| `ops/destroy.sh`, `ops/remake.sh` | Take ridge down: switch the two workflows off, ask for the name typed, delete the box, its disk and the stack, and read each back as gone (it refuses a stack that is not this repository's). Bring it back: make the stack, release, ship the app, run the check, switch the workflows on; a red stops it there, workflows off. Both refuse any name but ridge. | ridge | in `main`; the third run on ridge ended 0, destroy and remake each read back (the recap's "What the rehearsal showed") | `ops/destroy.sh ridge`, then `ops/remake.sh ridge`, then `ops/operator.sh ridge`, then `ops/demo-remake.sh ridge` for the six copies | [`recaps/2026-11-12-ridge-cycle.md`](recaps/2026-11-12-ridge-cycle.md), [`plans/2026-11-12-ridge-cycle.md`](plans/2026-11-12-ridge-cycle.md) |
| `ops/restore.sh`, the copy in `ops/check.sh`, `ops/drill.sh` row 17 | The records sit on a disk of their own and Litestream copies each change to a bucket within about a second, kept seven days; the check says whether the newest copy is fresh and the disk has room; the restore puts the records back on the box, into a new file by default, or onto a blank disk; the drill restores and finds a save made before. | ridge | in `main`; on ridge the stack runs, the release and the drill ran green, the drill's restore of the newest copy holding a code (the recap's "On ridge") | `ops/restore.sh ridge`; `ops/check.sh ridge` | [`recaps/2026-11-12-continuous-copy.md`](recaps/2026-11-12-continuous-copy.md) |
| One company's records copied, a long list in pages | The store answers a list in pages and the back end reads them all, so a company past 1,000 records still sees a whole list. The operator copies one company's records to another store and compares them, and puts one demo copy back from the continuous copy while the others keep their later changes. | local, ridge | in `main`; on ridge the first restore of one demo copy ended green, the others left as they were (the recap's "Still yours") | `ops/company-restore.sh ridge <code>` | [`recaps/2026-11-13-store-pages-copy.md`](recaps/2026-11-13-store-pages-copy.md) |
| `ops/legacy-capture.sh` | Signs in to the legacy app as its root and pictures the screens a file names, on a PC and a phone, opening only and never saving; for whoever compares the legacy with the new app. | the human's terminal only | in `main`; run green 11-04 | `bash ops/legacy-capture.sh` (asks for the address, name and password) | [`recaps/2026-11-04-legacy-capture.md`](recaps/2026-11-04-legacy-capture.md) |
| API access log | Every call to a client's API leaves one line in a 14-day log group (time, address, path, answer); a guard refuses a template that loses it. The address, measured once: three calls through the distribution on ridge (2026-11-08, 18:11) left three lines with one address, a public one outside AWS's published ranges and consistent with the caller's own, not an edge node; why is not established (item 157). Throttled calls (429) appear here only. | ridge (applied) | in `main` and live on ridge: the change set ran green there on 2026-11-08 at 17:10 (the project's logs folder, `logs/2026-11-08-171042-stack-ridge.log`, exit 0), and three lines were read back from the log group at 18:12, each carrying all ten fields of the stage's format (the project's logs folder, `logs/20261108-1809-ridge-access-log-read.log`) | `/aws/apigateway/credo-ridge` | [`recaps/2026-11-08-access-log.md`](recaps/2026-11-08-access-log.md) |
| Front door keys (`ops/keys.sh`) | The back end answers only the front door: a call to its own address without the door's key is refused with 403, and one script replaces a key (`front-door`, `internal`, `admin` or `service`) and reads the old one back refused. | ridge | in `main` and live on ridge: the check after all four key runs green on 2026-11-13, the old keys refused and the new ones answered | `ops/keys.sh ridge front-door` | [`recaps/2026-11-13-front-door-keys.md`](recaps/2026-11-13-front-door-keys.md) |
| The activity log (`services/audit-backbone/`) | Every change a person makes through the back end leaves an entry in the log's own store; one writer takes the writes and the feeds read beside it. No screen shows entries yet; `pnpm local activity` prints one record's. Its design is [`activity-log.md`](activity-log.md). | local, ridge | in `main` and live on ridge: the release installs it beside c-storage and `ops/check.sh` found a customer's entry on the box (2026-11-13); the one writer deployed with the push of 2026-11-18 | `pnpm local activity`; `ops/check.sh ridge` | [`recaps/2026-11-13-activity-log.md`](recaps/2026-11-13-activity-log.md), [`recaps/2026-11-09-audit-backbone-move.md`](recaps/2026-11-09-audit-backbone-move.md) |
| The watch (four alarms, a topic, Slack) | Four alarms on an environment (the app's calls failing, the back end's errors, the back end refusing work, the box failing its check), each alarm and its return to normal sent to one topic, which AWS's Slack app carries into one channel when the stack is given the two Slack IDs; for the human. | ridge (applied) | in `main` and live on ridge: applied there on 2026-11-13, and one alarm forced there, its alarm and its return to normal each reaching the channel | the Slack steps, then `ops/stack.sh env ridge` ([the watch](../ops/README.md#the-watch)) | [`recaps/2026-11-12-slack-alarm.md`](recaps/2026-11-12-slack-alarm.md) |

## Check a piece on ridge, without code

Ridge is where a person who reads no code checks a piece before anyone relies on it. Each piece that
changes what ships has a card here: what to open, at most six steps, what one should see, and one
question.

- **Who can check:** anyone holding a demo copy's link and its root password. The `-1` copies are
  `p1`'s, the `-2` copies `p2`'s and the `-3` copies the human's. The human sends a partner their link
  and password by their own channel, as [the operator guide](operator-guide.md#remake-the-six-demo-copies) asks of the remake.
- **The receipt:** within two hours of the check, the human runs one command in their own terminal
  that prints the card's calls from ridge's access log: time, method, path and answer, never an
  address or a browser's name.

For partners, the plain version, with the delivery photos' card, is [What credo has today](partners/what-credo-has.md#check-a-piece-yourself-without-code).

### The gallery's card

Open the app's ridge address with `/48b74d079/gallery` after it. No sign-in. You need a PC, and a phone or a tablet for step 6.

1. On the PC, the gallery opens on "Start here": your goal, what credo is, where a coder looks first, and that a gap is asked, then written as a rule. Read the list down the left: Start here, Foundations, Rules, Pages, Atoms, Molecules and Organisms, each with its count (Rules is empty for now).
2. Press "Values" under Foundations: every colour, text style, gap, width, icon size and corner has a line saying what it is for. Then press a part, such as "Door card"; its "Use when" and "Don’t use when" lines are under its description on the right. Its states appear side by side in the middle; its name, description and props are in the right-hand column.
3. In that column, under "Show", press "One at a time" and pick another state from the list that appears under it.
4. Press Atoms, then "ActionButton" and "StatusBadge", Molecules, then "FormMessage", and Organisms, then "PageState": the right-hand column has "Takes from a screen" and "Decides itself", and a part to come says so. Does each read as the one way, with nothing left for a screen to choose?
5. Press Pages, then "The page base": the frame (header, menu, phone bar, page), then one page drawn from parts only. Press each part under Pages and, in the other levels, any part: every right-hand column has "Takes from a screen" and "Decides itself". Is this the base a new page is built from, with no style chosen in the page?
6. Open the same address on a phone or a tablet.

You should see, on the phone or the tablet, the not-found screen ("Không tìm thấy không gian làm việc"), not the gallery.

**Question: could a coder pick each colour, style, gap, width, icon size and corner from these pages without asking, and is the phone or tablet turned away?** Say yes or no; with a no, name the line, or the step number where it went wrong.

### The messages' card (landing 2 of the screens on the parts; the saved line, begun)

Open the app's ridge address and sign in as a person who may edit settings. You need a PC.

1. Press "Settings" in the menu.
2. Press the save button at the foot of the form, with or without a change.
3. Read the line that appears at the top of the form, above the cards.

You should see a green line, spanning the width of the form, saying the settings were saved. A save that fails, or is refused, shows the same line in red.

**Question: is the saved line green, as wide as the form, and easy to read?** Say yes or no; with a no, name the line.

## Next, in order

What comes next, in the order the human's page on the orchestrator branch lists it (the evening's session refreshes this list from it):

1. The working rules are trimmed on a schedule, once their pages pass their word limit, rather than when
   someone happens to notice.
2. Pinning the test browser's version gets a home the index can find; today only one recap records it. It
   waits for the check of the documents' citations, which touches the same pages.
3. CI's runs on this machine, the wait for the test lock and CI's cache are each brought under 15 minutes.
   It waits behind this week's milestones.
4. The scripts that picture the legacy app's screens, parked for now.
5. The parked open items, taken up again.

Open items a newcomer can take first, each small:

- [Item 63](open-items.md): one page test for the root-password page when the BFF refuses (403), copied
  from its 503 test. Safe: a test on the fake alone, no credential and no rule to decide.
- [Item 58](open-items.md): the walks page's two builds run one after the other, so `NODE_ENV` comes back
  as it was. Safe: build code on this machine alone, nothing deployed and nothing to decide.
- [Item 475](open-items.md): a doc comment moved back above its function, a test's label and a stale
  comment reworded. Safe: words in comments and a label, no behaviour changes.

This section is refreshed at each evening's push.

## Known gaps

The numbers are [open items](open-items.md).

1. Six wrong passwords at the sign-in or at one's own password make that name wait, 30 seconds
   doubling to 15 minutes, and a right one is refused during the wait. It is counted per name, not
   per address, so one guesser trying many names meets only the door's throttle, and each invented
   name leaves a small record (open item 256).
2. Four alarms are written in `ops/env.yml` and have run on ridge: the Slack steps were done, the stack
   was updated with the two IDs, and a forced alarm reached the channel, with its return to normal
   ([the watch](../ops/README.md#the-watch), open item 1); the continuous copy of the records and its
   restore have run on ridge, and the drill's restore read back (item 6).
3. A client's own production stack (item 4) and the public address in front of ridge's c-storage
   (item 13) are not built.
4. The console's passkeys are tested in Chrome only, and adding one in Safari may be refused
   (item 30). Adding and removing operators is built and in `main` (rows B1 and B2 above).
5. Two UI tests fail now and then under a heavily loaded machine (item 56), so the gate can read red
   without a defect.
