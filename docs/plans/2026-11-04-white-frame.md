# Milestone 4 of the app's layout: a white header, a white menu, the menu's icons

## At a glance

The client's root turns on, in Settings, a white header, a white menu, or the hidden menu's 60-pixel strip of
icons: three switches, each off until on. Every screen of that client follows; no other client's moves. These are the old
app's "light" variants and icon option (old repo's `workspace/uis/base/src/components/app/PCAppLayout.tsx#L114-L116`,
`#L142`); the partners' companies may use them (line 54). The strip is the human's ask
(`docs/recaps/2026-11-03-legacy-frame.md#L19`).

The cheapest path: the mock's white values and strip (`ui/frame-mock/index.html#L63`, `#L90`,
`#L106`), and the one settings record and route (`bff/src/app.ts#L213-L230`). **Price:** $0 a month; about 108
machine minutes and one full run; the full flow, as a client's stored settings change.

## The slice

**The wire changes once:** `whiteHeader`, `whiteMenu` and `menuIcons` beside `colour`, each `.default(false)` in
`tenantConfigSchema` (`shared/src/config.ts#L58-L69`), through which the BFF reads the stored record
(`bff/src/app.ts#L194-L197`) and the UI the reply (`ui/src/api.ts#L273`, `#L298`): a record stored before reads all
off (`CLAUDE.md#L23`). Typed, never `extra` (`docs/memo/extra.md#L44-L45`). c-storage is unchanged; the route keeps
its one write and its right, `settings.canEdit` (`bff/src/app.ts#L220`); a new client starts all off
(`bff/src/clients.ts#L30-L39`).

Decided here:

- **The switches** sit below the colour field (`ui/src/Settings.tsx#L206`): "White header", "White menu", "Show the
  menu's icons when it is hidden" ("Đầu trang màu trắng", "Menu màu trắng", "Hiện biểu tượng của menu khi ẩn").
- **The old app's colours** (`PCAppLayout.tsx#L198-L218`), from the theme's greys, the legacy's own
  (`ui/src/theme.ts#L15-L26`): ground 0, text 8, icons 7, edge 2; the open page on brand shade 0, text 9, mark 7.
  In dark, the dark surface, as the mock (`ui/frame-mock/frame.js#L132-L138`). In `ui/src/frame.module.css`;
  `theme.ts` unchanged.
- **Contrast:** text 14.1:1, icons 9.9:1, the open page's text 4.54:1 (autumn) to 9.97:1 (steel). Its mark falls
  under 3:1 for terracotta, autumn, olive and coin (2.72 to 2.99), the old app's own: kept, as the text names the
  page, and logged.
- **Off moves nothing:** all off, `Shell`'s markup is unchanged and the new rules match only an attribute set when
  on, since a version hashes the markup and its matching rules (`visual/src/capture.ts#L232`, `#L262`). The console
  passes none (`ui/src/OperatorPage.tsx#L25`); the client's app, its settings' (`ui/src/ClientApp.tsx#L268`).
- **The strip is a PC's**, 60 wide (`PCAppLayout.tsx#L47`, `#L167`), each icon named; off, the menu hides whole as
  today (`ui/src/Shell.tsx#L207`).
- **The walk** turns the switches on where screens 1 to 9 keep the coloured frame, in its own language.
- **Hazard no gate catches:** a tab opened before the deploy reads its own save as failed once, the reply read
  strictly (as `docs/open-items.md#L343-L344`); a reload ends it.

## The case table

| # | The case | Held by |
| --- | --- | --- |
| 1 | A record without the three reads all three off | route, `config.route.test.ts` |
| 2 | A save with any one on reads back so, each apart | route |
| 3 | A switch that is no boolean is refused, 400, the record kept | route |
| 4 | Whom `settings.canEdit` does not allow is refused, 403, the switches kept | route |
| 5 | A client the console makes starts all off | route, `tenants.route.test.ts` |
| 6 | Settings shows the three, vi and en, off when never set; the save sends them | unit, `Settings.test.tsx` |
| 7 | A white header or menu: ground 0, text 8, icons 7, edge 2; the open page on brand 0, text 9, mark 7 | unit, `Shell.test.tsx` |
| 8 | Icons on, the hidden PC menu leaves a 60-wide strip, each named; off, it hides whole | unit |
| 9 | In dark, a white header or menu takes the dark surface | unit |
| 10 | Off moves nothing: every version but row 11's equals `main`'s | visual, `pnpm report` |
| 11 | Only eight screens move: `admin-setup`'s 3, 4, 5, 7, 8 (the form, `walk/specs/piece-1.spec.ts#L104-L156`), `office-5-settings` (`walk/specs/piece-2.spec.ts#L480-L487`), the new 10 and 11 | the full run |

Rows 1 to 5, the business rows, are each seen red first: before the field exists, or with the default's line changed.

## Steps

- [ ] **1. This plan.** 🤖 Opus, 9 minutes (this kind: 6 to 9). Done when: committed, `wc -w` about 1,000.
- [ ] **2. The frame on the fake.** 🤖 Sonnet, about 23 minutes (milestone 2's step 2, a `Shell` change): fields,
  switches, white frame, strip, the mock's scenes, two screens, the walk. Done when: rows 6 to 9 red once; ui and
  visual at 100 %, lint clean; `pnpm report` builds 109 screens, row 10 compared.
- [ ] **3. The stack.** 🤖 Sonnet, about 40 minutes (D's 103 for a route less the palettes' 63): rows 1 to 5,
  `startingConfig`. Done when: each row seen red; bff at 100 %.
- [ ] **4. The gate.** 🤖 Sonnet, about 11 minutes: `main` taken in if moved; the whole `pnpm check` under the lock,
  `== exit 0`.
- [ ] **5. One review.** 🤖 Opus, about 5 minutes: the default, the markup when off, the strip by keyboard. Done when:
  each finding tagged here.
- [ ] **6. The full run** (👤 2), about 19 minutes (the palettes' 17 plus 2): `ops/full-run.sh`, `--moved` naming row
  11's eight. Done when: run 1 green, naming only those; run 2 every count 0; 48 pictures committed.
- [ ] **7. The recap.** 🤖 Sonnet, about 1 minute. Done when: committed, item 75 closed, the Settings row of
  `docs/products.md` true.

## Shared with line 58's two pieces

`staff-cards` and `staff-list` also change `ui/src/i18n/en.ts`, `vi.ts`, `visual/src/walks.ts` (theirs
`admin-staff`, this piece `admin-setup`, `#L270-L372`), `docs/open-items.md` and `docs/products.md`. This piece
rewrites `office-5-settings`'s six bases, beside theirs in `walk/specs/piece-2.spec.ts-snapshots/`. Only `staff-list`
changes `ui/src/theme.ts`. The second to merge takes `main` in before its gate, both sides of each conflict kept.

## The human's points

👤 **1. The look, after step 2.** On the walks page, "Set up the company: its name, colour and languages", screen 3,
"Settings: name, logo, colour, languages": three switches below the colour field, all off. New screen 10, "Saved:
the header and the menu in white": the name, buttons and menu dark on white, the open page in terracotta. New screen
11, "The menu hidden to its icons": on a PC, a strip of icons. Asked again for the switches on the form: 4, 5, 7, 8
and "Look up and add staff, as allowed" 5. Work goes on past the look: a yes clears the push; a no becomes a case,
fixed on the fake before step 6.

👤 **2. The full run, step 6.** Two runs in the human's terminal by one command, nothing else testing. Green starts
the recap; a red names each moved screen, and the machine finds why before any base is kept.
