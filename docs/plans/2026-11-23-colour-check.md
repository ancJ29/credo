# The screens' colour names moved to their tones, a check against a new one, the empty Rules group gone

## At a glance

What it is for: the 22 November design review's findings 2 and 4, so every colour on the app's
screens comes from the design system's four meanings and a coder who writes `c="red"` on a screen
is stopped by a check, not by a review; and the gallery stops showing a Rules folder with nothing
in it. Who sees it: the staff, unchanged but for one chip on the operator's services page; a coder
reading the gallery. The cheapest path: `TONES` already names each meaning's colour
(`ui/src/design-system/tokens.ts#L67`) and the gallery's import page already draws a row's result
through it (`ui/src/design-system/Pages.tsx#L723`, `#L727`); `literals.test.ts` already refuses
three other literals in screens. The price: about 17 machine minutes in three steps, one landing on
`ui`'s and `visual`'s gates, one services walk in your terminal for six pictures of one screen, no
review of its own, two looks.

## The slice

One slice, walkable when it ends: the screens draw each colour by its meaning, a check refuses a
palette's name in a screen, and the gallery lists six groups. Stage 1 is each step's own move;
stage 2, `ui`'s and `visual`'s gates with the pinned styles file read; stage 3, your two looks;
stage 4, ridge after the push that carries it, where the gallery and the services page ship.

**Not in it:** `dimmed` (45 uses, no meaning, item 651's); moving the services page's chips onto
the `Tag` part (item 651's count holds them); a confirmed order's orange (finding 3, set aside at
piece 234).

## The brief, checked

Recounted at `c1a1ab92`, over the screens with no tests (the design system, its parts and the mock
left out), in bash:

```bash
N='(?:dark|gray|red|pink|grape|violet|indigo|blue|cyan|teal|green|lime|yellow|orange|brand|white|black)'
S=(-- 'ui/src/*.ts' 'ui/src/*.tsx' 'ui/src/*.css' ':!ui/src/design-system' ':!ui/src/mock' ':!ui/src/components' ':!*.test.*')
P="\b(?:c|color|bg)\s*(?:=|:)\s*(?:[\"'\x60]|\{[^}]*?[\"'\x60])$N\b|--mantine-color-$N\b"
git grep -nP "$P" "${S[@]}"
```

- **Ten lines in five files, not nine.** The nine the read named hold at the same lines:
  `ui/src/pages/client/ImportPage.tsx#L210`, `#L273`, `#L276`;
  `ui/src/pages/client/ListImportPage.tsx#L210`, `#L278`, `#L281`;
  `ui/src/parts/Settings.tsx#L147`; `ui/src/parts/PermissionEditor.tsx#L66`;
  `ui/src/pages/operator/ServicesPage.tsx#L186` (`color="yellow"`). The tenth is
  `ServicesPage.tsx#L175`, a condition choosing `'green'`, `'red'` or `'gray'` for a part's state,
  there since 2026-11-01 (`git blame -L 175,175`): the read grepped attributes only, so a braced
  condition passed it. Twelve names in all.
- **Neither piece did them.** The parts and the pages pieces left all ten untouched; the gallery's
  own import and settings pages draw the right forms already (`Pages.tsx#L723-L729`, `#L907-L910`).
- **The parts' own looks are two**, which the check allows by leaving `ui/src/components/` out:
  `ui/src/components/molecules/SectionTitle.tsx#L11` (`color="gray"`) and
  `ui/src/components/atoms/Tag.tsx#L13` (its `'brand'` meaning): the same `git grep -nP "$P"` over
  `-- 'ui/src/components' ':!*.test.*'` reads 2.
- **One moved line moves a picture, not none.** `red`, `green`, `orange` and `gray` are `TONES`' own
  values, so nine lines draw the same. Yellow is no meaning: the guideline already says "a yellow has
  no meaning and becomes warning" (`ui/src/design-system/guideline.ts#L381`), and piece 222 moved
  the same screen's message from yellow to warning on that line. The "differs" chip turns orange on
  `operator-services` `sv-2-two-builds`, which draws it (`walk/specs/operator-services.spec.ts#L61`):
  `grep -c '^operator-services/sv-2-two-builds ' visual/src/resolved.pinned.txt` reads 10 (one a
  colour) and `git ls-files 'walk/specs/operator-services.spec.ts-snapshots/sv-2-*' | wc -l` 6.
- **Item 662 closes here.** The logo refusal is the one hand-written alert in a screen
  (`git grep -nP 'role="alert"' "${S[@]}"` reads 1, `Settings.tsx#L147`); drawn through
  `FormMessage` as an error, as the gallery's settings page draws it, it stays spoken as an alert
  (`ui/src/components/molecules/FormMessage.tsx#L20`), so the five finders in
  `ui/src/parts/Settings.test.tsx` hold. No walk draws it: `git grep -cE 'logo-too-large|logo-not-image'
  -- visual/src walk/specs` finds nothing (over `ui/src/mock` it finds 5), so no picture moves; only
  `pnpm mock`'s two logo states change.
- **The Rules group is a word nothing else reads.** `GROUPS` holds seven
  (`ui/src/design-system/entries.tsx#L250-L258`), no entry is in Rules, and the gallery draws every
  group (`ui/src/design-system/Gallery.tsx#L356`). Deleting the word, rather than hiding empty
  groups, removes a group no part can join today: a hidden group is code that hides nothing else, and
  Rules back is one word. Three lines say Rules is there:
  `ui/src/design-system/Gallery.test.tsx#L89-L103`, `guideline.ts#L194` and `docs/products.md#L129`. **No walk reads the gallery** (`git grep -n -i gallery -- visual walk
  scripts` finds nothing), so step 3 runs `ui`'s gate alone.
- **The stale prose this makes false:** the tones note's "about 130 uses" (`guideline.ts#L381`),
  `TONES`' comment "The screens still write the names today" (`tokens.ts#L65`), and item 651's
  "about 130 times" (`docs/open-items.md#L2198`). The 130 was gone before this piece: most went
  with piece 222's messages and buttons.

## The check

A new describe in `ui/src/design-system/literals.test.ts`, "The colour names", beside "The shades"
(`#L35-L50`), whose rule (`guideline.ts#L233`) already names this file as its holder. It reads every
`.css`, `.ts` and `.tsx` under `ui/src` but the design system, the mock, `components/` and the tests,
and refuses `P` above: `c`, `color` or `bg`, set by `=` or `:`, to a quoted palette name or to a
braced expression holding one, and a palette's Mantine variable. Mantine's fourteen palettes,
`brand`, `white` and `black` are the names. It passes `c={TONES.danger}`, `color={TONES[tone]}`,
`c="dimmed"`, `{...TYPE.caption}`, an avatar's `color="initials"` and Shell's class key
`head(classes.brand, 'brand')`. A second case lists those forms each way, as case 13's does
(`#L70-L90`). Why there and not `guideline.test.ts`: that file holds which parts a screen draws; a
colour's name is a literal, as a shade or a weight is.

## The steps

- [x] **1. The logo's refusal through `FormMessage`, closing item 662.** `Settings.tsx#L147` becomes
  `<FormMessage kind="error">`; `Settings.test.tsx#L162-L175` also asks that the alert is the
  message part's (`.mantine-Alert-root`). Case 3. _Done when:_ case 3 seen red with the line put
  back, `pnpm --filter @credo/ui check` and `pnpm --filter @credo/visual check` exit 0,
  `git diff --exit-code visual/src/resolved.pinned.txt` exits 0, `git grep -nP 'role="alert"'
  "${S[@]}"` reads 0, item 662 marked `[FIXED]`. **5 min**, a first run of this shape. Done 2026-11-23 09:26: case 3 red on the `Text` line (1 failed, exit 1), green with the part; `ui` and `visual` checks exit 0; pinned diff exit 0; the alert grep reads 0; item 662 `[FIXED]`.
- [ ] **2. The nine lines to their tones, and the check.** Cases 1 and 2 written first, case 1 seen
  red by the nine real lines. Each line names its meaning through `TONES`: the import pages'
  `danger` and `success` as the gallery's import page does; `PermissionEditor`'s `warning`; the
  services state's three through a `TONE` table beside `STATE` (`ServicesPage.tsx#L28-L32`), and
  "differs" `warning`. The guideline's rule `#L233` gains the names, the tones note `#L381` keeps
  only `dimmed` as "not yet" (item 651), `TONES`' comment `#L62-L66` says the check holds it, and
  item 651 gains an update line. Then `RESOLVED_WRITE=1` rewrites the pinned file and its diff
  is read. _Done when:_ case 1 seen
  red once more by a planted `c="red"` in `ImportPage.tsx`, then reverted; `git grep -nP "$P"
  "${S[@]}"` reads 0; `git diff --stat visual/src/resolved.pinned.txt` reads 10 lines changed, each
  `operator-services/sv-2-two-builds`; both gates and the citation test exit 0. **8 min**, the shape
  of piece 222's step 18 (five sites moved under a case refusing them in screens, 8 minutes).
- [ ] **3. The Rules group out.** `'Rules'` deleted from `GROUPS`; the heading test reads six and
  asks that every group listed holds an entry (case 4); `guideline.ts#L194` loses "The Rules group
  stays empty."; `docs/products.md#L129` lists six and drops "(Rules is empty for now)". _Done when:_
  case 4 seen red with `'Rules'` put back, `pnpm --filter @credo/ui check` and the citation test exit
  0. **4 min**, the shape of piece 232's step 2 (one guarded change to the gallery, 4 minutes).

**Order:** step 1 first, so step 2's red is nine lines, not ten, and no line is edited twice; step 3
is independent and last, as it touches the gallery alone.

## The case table

| # | Case | Test | Seen red by |
| --- | --- | --- | --- |
| 1 | No screen names a colour by a palette's name or variable; the design system, its parts and the mock may | `literals.test.ts`, new | the nine lines before their move; a planted `c="red"` |
| 2 | The pattern refuses an attribute, a braced condition, a style key and a palette variable, and passes a tone, `dimmed`, a class key and `initials` | `literals.test.ts`, new | each form flipped |
| 3 | The logo's refusal is an error message, spoken as an alert, in its words | `Settings.test.tsx#L162-L175`, tightened | the line put back to `Text` |
| 4 | Every group the gallery lists holds an entry, six in order | `Gallery.test.tsx#L89-L103`, edited | `'Rules'` put back |
| 5 | Nine moved lines move no resolved style; the yellow moves one screen on all ten colours | `visual/src/resolved.test.ts`, the pinned file | the pinned diff, read |

## The landing

One landing after step 3: `ui`'s and `visual`'s gates and the citation test on the branch, no whole
check (no other package reads these lines). Then the services walk alone, in your terminal:
`bash walk/run.sh services --moved sv-2-two-builds --write`, green with only that screen's six
pictures moved; the machine reads git's diff (six PNGs) and commits. No review of its own: the
change meets a screen, so it joins the review before `main` of the push that carries it (QA rule 5).

## Your points

1. **The services page's two builds, on the walks page.** When one part runs a different build, the
   small "differs" chip beside it was yellow, a colour the design system gives no meaning. It turns
   orange, the warning colour, like the "two builds" message above it. The walks page asks that
   screen again. A yes keeps it; a no makes the chip gray, the information colour, and runs that walk
   again.
2. **The gallery without its empty folder, on ridge once the push carries it.** The list on the left
   reads Start here, Foundations, Pages, Atoms, Molecules and Organisms; the Rules folder that showed
   0 is gone, and the charter's rules are still under Start here. A yes closes the piece; a no brings
   Rules back holding one entry that points to the charter's rules.
