# Milestone 2 of the app's layout: the legacy frame in the app

## At a glance

Every signed-in person, in the client app and the console, works in the old app's frame. On a PC (768 and wider):
the header painted 135° from the brand's shade 7 to 9, a side menu 250 wide painted 180° from 9 to 8, white text, hidden
by a button. On a phone: the same header and a 64-pixel bar at the foot, the first four pages and More, a page of the
rest. No palette picker (milestone 3), no white variant (4), no record, no BFF route.

The cheapest path is what `main` holds: one `Shell` for both apps (`ui/src/Shell.tsx#L52-L56`,
`ui/src/OperatorPage.tsx#L22-L31`) on Mantine's `AppShell` (a navbar and a footer per width); the legacy gradient
(`ui/src/theme.ts#L65-L67`); each person's menu (`ui/src/nav.ts#L90-L91`); the mock, `ui/frame-mock/`, as the look.
**Price:** $0 a month; about 52 machine minutes and a 70-minute full run in the human's terminal. **Next:** milestone 3's plan, during step 5.

## The slice

`Shell` rebuilt to the mock; both apps call it as today, so every signed-in screen moves at once. Kept from the mock:

- **Header:** the logo at 36 (`ui/src/Shell.tsx#L68`), the console's badge, the PC's toggle, an X or the menu's icon
  (`ui/frame-mock/frame.js#L167-L171`); on the right the language as its own button, out of the user's menu
  (`frame.js#L173-L174`; today `ui/src/Shell.tsx#L87-L101`), then the user.
- **Side menu:** the active page washed in white at 16 %, a notch at its right edge (`ui/frame-mock/index.html#L95`,
  `#L98`).
- **Phone bar:** the first four of the person's pages in the menu's order, then More, icons only, each named
  (`frame.js#L203-L215`); the active one on shade 1 (`index.html#L108`). The root's: orders, deliveries, settings,
  staff (`ui/src/nav.ts#L27-L85`, `shared/src/permissions.ts#L65`); the console's: clients to usage.
- **More** at `/more` and `/operator/more`, a path in each app's router: the other pages, then the person's own links
  (password; the console's passkeys, `ui/src/OperatorPage.tsx#L30`) and sign-out (`frame.js#L231-L239`).
- **Dark** keeps the coloured header and menu (`frame.js#L154-L155`); the walks take light
  (`walk/playwright.config.ts#L25`).

Decided here:

- **The toggle's state is kept on the device**, beside the language (`ui/src/device.ts#L40`), shown at first.
  *Rejected:* the person's record, a record change.
- **The toggle is named by its act** ("Hide the menu", "Show the menu"): piece-1's walk clicks a visible "Menu" button
  before Settings (`walk/specs/piece-1.spec.ts#L100-L101`), which would hide a PC's menu. Those lines go.
- **`5-language-menu` is shot from the header's button** (`walk/specs/piece-1.spec.ts#L156-L160`,
  `ui/src/mock/screens.tsx#L162`); its question already fits (`visual/src/walks.ts#L325`).
- **One new screen, `lists-9-more`:** the root's More in `admin-lists`.
- **No build line at the menu's foot** (`frame.js#L200`): a commit in every picture moves every base at every commit.

## The case table

| # | The case | Held by |
| --- | --- | --- |
| 1 | From 768 up, header 135° from brand 7 to 9, menu 250 wide 180° from 9 to 8, white text, light and dark | unit, ui; the walk |
| 2 | The PC's toggle hides and shows the menu, named by its act, `aria-expanded`, kept on the device | unit, ui |
| 3 | Below 768, no side menu: the bar's first four pages in the menu's order and More, each named; the open page, or More, marked | unit, ui; the walk |
| 4 | More lists the other pages, then the person's links and sign-out; four pages or fewer, only those | unit, ui; `lists-9-more` |
| 5 | The language is a header button over the company's languages, the current marked; one language, none | unit, ui; `5-language-menu` |
| 6 | One navigation named "Menu" a width, as walks find it (`walk/specs/piece-2.spec.ts#L458`); the active page washed, with its notch | unit, ui; the walks |
| 7 | The console wears the same frame, its badge and five sections; its More holds activity, passkeys, sign-out | unit, ui; the operator walks |
| 8 | The fake's scenes equal the spec's and the walks page's; fake = stack = stack again, vi and en, three widths | visual; the walk |
| 9 | The nine screens outside the frame do not move: `1-sign-in`, `2-sign-in-refused`, `6-service-down`, `9-unknown-company`, `op-1-sign-in`, `pk-1-join`, `pk-4-no-operator`, `pk-5-link-dead`, `phone-2-code-used` | the full run's raw count |

## Steps

- [x] **1. This plan.** 🤖 Opus, 9 minutes (this kind: 12, 8, 9, 9, 7). Done when: committed, `wc -w` about 1,000, the
  path grep empty.
- [ ] **2. The frame on the fake.** 🤖 Sonnet, about 27 minutes (B1's page on the fake 26, B2's 27): `Shell`, More,
  the words, both apps' More path, `lists-9-more` in the spec, the walks page and the mock screens. Done when: rows 1
  to 7 red once with the old `Shell`; ui and visual at 100 %, lint clean; `pnpm report` builds 107 screens (106
  before), each at 390 with the bar. Then 👤 1, while step 3 goes on.
- [ ] **3. The gate.** 🤖 Sonnet, about 11 minutes (B1's 10, B2's 12): `main` taken in if moved; the whole
  `pnpm check` under the lock, `== exit 0`.
- [ ] **4. One review.** 🤖 Opus, about 4 minutes (B1's and B2's): the bar for each kind of person, a page opened by
  its address on a phone. Done when: each finding `[FIXED]`, `[REJECTED]` or `[DEFERRED]` here.
- [ ] **5. The full run** (👤 2), about 70 minutes: B1's 114 pictures took 6m16s, so 642 take about 35 a run; 🤖 reads
  each log whole. Done when: run 1 green, its `raw.txt` naming none of row 9's
  screens; run 2 every count 0; about 588 bases committed (97 moved screens and the new one, six pictures each).
- [ ] **6. The recap.** 🤖 Sonnet, about 1 minute (B1's and B2's). Done when: committed, under 400 words; the squash.

Total: about 122 minutes, 52 of them the machine's.

## The human's points

👤 **1. The look, after step 2.** On the walks page, open `office-orders` at 1280, then `driver-deliveries` at 390,
then `lists-9-more`: do the coloured header and menu read as the old app on a PC, and the bar at the foot as the old
app on a phone? The other screens are asked again as you visit them; only an open no holds the merge
(`docs/conventions/qa.md#L128-L129`). A yes clears the push; a no becomes a case, fixed before step 5.

👤 **2. The full run, step 5.** Two commands in the human's terminal, about 35 minutes each, nothing else testing:
`bash walk/run.sh` with all 11 walks (`walk/run.sh#L39-L49`) and `--moved all --write`, then without the two flags.
Run 1 writes about 588 bases. Green starts the recap; a red names each moved screen, and the machine finds why before
any base is kept.
