# Milestone 2 of the app's layout: the legacy frame in the app

## At a glance

Every signed-in person, in the client app and the console, works in the old app's frame. On a PC (768 and wider):
the header painted 135° from the brand's shade 7 to 9, a side menu 250 wide painted 180° from 9 to 8, white text, hidden
by a button. On a phone: the same header and a 64-pixel bar at the foot, the first four pages and More, a page of the
rest. No palette picker (milestone 3), no white variant (4), no record, no BFF route; the hidden menu's 60-pixel icon
strip is a client's option, built in milestone 4 beside the white variants.

The cheapest path is what `main` holds: one `Shell` for both apps (`ui/src/Shell.tsx#L52-L56`) on Mantine's `AppShell`;
the legacy gradient (`ui/src/theme.ts#L65-L67`); each person's menu (`ui/src/nav.ts#L90-L91`); the mock as the look.
**Price:** $0 a month; about 52 machine minutes and a 70-minute full run.

## The slice

`Shell` rebuilt to the mock; both apps call it as today, so every signed-in screen moves at once. Kept from the mock
(`ui/frame-mock/`): the header (brand, the console's badge, the PC's toggle, the language as its own button, the user);
the side menu with the active page washed in white at 16 % and a notch; the phone bar of the first four pages in the
menu's order, then More, icons only, each named, the active one on shade 1; **More** at `/more` and `/operator/more`
(the other pages, the person's links, sign-out); dark keeps the coloured header and menu.

Decided here:

- **The brand:** the company's name as today (`shared/src/config.ts#L7`; the console's, `ui/src/brand.ts#L14`) beside a
  stand-in logo at 36, Tabler's `IconBrandAdobe`, not the stored one. A client's own logo waits for a client's ask.
- **The font is already Noto Sans** (`ui/src/theme.ts#L11`): no package.
- **The toggle's state is kept on the device** (`ui/src/device.ts#L40`), shown at first, named by its act ("Hide the
  menu", "Show the menu"); piece-1's "Menu" clicks go.
- **`5-language-menu` is shot from the header's button** (`walk/specs/piece-1.spec.ts#L156-L160`).
- **One new screen, `lists-9-more`:** the root's More in `admin-lists`.
- **No build line at the menu's foot:** it would move every base at every commit.

## The case table

| # | The case | Held by |
| --- | --- | --- |
| 1 | From 768 up, header 135° from brand 7 to 9, menu 250 wide 180° from 9 to 8, white text, light and dark | unit, ui; the walk |
| 2 | The PC's toggle hides and shows the menu, named by its act, `aria-expanded`, kept on the device | unit, ui |
| 3 | Below 768, no side menu: the bar's first four pages in the menu's order and More, each named; the open page, or More, marked | unit, ui; the walk |
| 4 | More lists the other pages, then the person's links and sign-out; four pages or fewer, only those | unit, ui; `lists-9-more` |
| 5 | The language is a header button over the company's languages, the current marked; one language, none | unit, ui; `5-language-menu` |
| 6 | One navigation named "Menu" a width (`walk/specs/piece-2.spec.ts#L458`); the active page washed, with its notch | unit, ui; the walks |
| 7 | The console wears the same frame, its badge and five sections; its More holds activity, passkeys, sign-out | unit, ui; the operator walks |
| 8 | The fake's scenes equal the spec's and the walks page's; fake = stack = stack again | visual; the walk |
| 9 | The ten screens outside the frame do not move: `1-sign-in`, `2-sign-in-refused`, `6-service-down`, `9-unknown-company`, `op-1-sign-in`, `pk-1-join`, `pk-3-not-given`, `pk-4-no-operator`, `pk-5-link-dead`, `sv-5-unavailable`. `phone-2-code-used` moves, with the titles' 700 (`ui/src/theme.ts#L108`, `ui/src/QrLanding.tsx#L24`) | the full run's raw count |
| 10 | The header shows the company's name (the console's, Credo) beside the stand-in logo, never the stored one | unit, ui; the walk |

## Steps

- [x] **1. This plan.** 🤖 Opus, 9 minutes . Done when: committed, about 1,000 words.
- [x] **2. The frame on the fake.** 🤖 Sonnet, about 27 minutes : `Shell`, More,
  its paths and words, `lists-9-more`. Done when: rows 1 to 7 and 10 red once with the old `Shell`; ui and visual at
  100 %, lint clean; `pnpm report` builds 107 screens.
  *Done, see the recap.*
- [x] **3. The gate.** 🤖 Sonnet, about 11 minutes : `main` taken in if moved; the whole
  `pnpm check` under the lock, `== exit 0`.
  *Done, see the recap.*
- [x] **4. One review.** 🤖 Opus, about 4 minutes : the bar for each kind of person, a page opened by
  its address on a phone. Done when: each finding is tagged here.
  *Done, see the recap.* One Low, `[FIXED]` here: row 9.
- [x] **5. The full run** (👤 2), about 70 minutes ; 🤖 reads each log whole. Done when:
  run 1 green, its `raw.txt` naming none of row 9's screens; run 2 every count 0; about 582 bases committed (97 screens,
  `lists-9-more` among them, six pictures each).
  *Done, see the recap.*
- [x] **6. The recap.** 🤖 Sonnet, about 1 minute . Done when: committed, under 400 words, a client's own
  logo an open item; the squash.

Total: about 122 minutes, 52 the machine's.

## The human's points

👤 **1. The look, after step 2.** On the walks page, open `office-orders` at 1280, then `driver-deliveries` at 390,
then `lists-9-more`: do the header and menu read as the old app on a PC, the bar on a phone? A yes clears the push; a no becomes a case, fixed before step 5.

👤 **2. The full run, step 5.** Two runs in the human's terminal, about 35 minutes each, nothing else testing: all 11 walks
with `--moved all --write`, then plain. Green starts the recap; a red names each moved screen, and the machine finds
why before any base is kept.
