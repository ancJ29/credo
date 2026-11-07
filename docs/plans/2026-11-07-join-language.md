# A language switch on the join screens

## At a glance

Someone opening a credo join link reads the page in whatever language the device happened to choose
and cannot change it, while every other door in the app carries a language switch. This piece gives
the join page that same switch — the small later change the walks page has promised since 11-05 and
that open item 101 names down to its fix (`docs/open-items.md#L675`).

**The cheapest safe path is already written, and needs no new word, no new screen and no new call.**
`SignInFrame` draws the switch whenever its caller offers more than one language
(`ui/src/SignIn.tsx#L85-L105`), and `JoinPage` already sits in that frame (`ui/src/JoinPage.tsx#L73`)
but hands it nothing. What is missing is a language state in `Joining`, which fixes the language from
the device once and holds no handler (`ui/src/OperatorApp.tsx#L52-L63`) — while `Console` beside it
holds exactly that state and handler already (`#L78`, `#L149-L152`), as `ClientApp` does. **Price:**
about ten lines copied from the console, no infrastructure, $0 a month; 50 machine minutes and one
picture run in the human's terminal.

**The one thing open.** Whether a partner asked for this, or whether it is built so a partner can be
shown it and asked, is the human's, and is in front of them already. This plan is the smaller version
either way. If a partner turns out to have asked for something specific — a third language, the
language carried in the link itself, a switch on the client's own doors — that is its own plan, and
nothing here is undone.

## The slice

- **`Joining`** holds the chosen language in state, starting where it starts today
  (`device.language() ?? BEFORE_CONFIG.language`), with a `chooseLanguage` that calls
  `device.setLanguage`: the console's four lines, copied.
- **`JoinPage`** takes `languages` and `onLanguage`, as `OperatorSignIn` and `QrLanding` do, and
  passes them to `SignInFrame`. `Joining` gives it `LANGUAGES`, both, as the operator's sign-in beside
  it does (`ui/src/OperatorApp.tsx#L159-L164`).
- **Nothing else.** No dictionary key is added: the switch's own words are `LANGUAGE_NAMES` and
  `user.language`, in both dictionaries already.

Decided here:

- **Where it sits and what it looks like:** the top right of the page's own coloured header, a
  white-outlined pair of small boxes reading `VI` and `EN`, the one being read filled a shade
  lighter. Not a new shape — it is the control the other doors draw, proved at 390, 768 and 1280 on
  the seven walked doors that carry it.
- **The choice persists on the device, under `credo.language`** (`ui/src/device.ts#L40-L41`), through
  the same `device.setLanguage` the signed-in header calls. This is the point of the piece, not a
  detail of it: the join lands on the dashboard (`ui/src/JoinPage.tsx#L21`) and `Console` reads
  `device.language()` as it mounts (`#L78`), so a language picked on the join screen is still there
  one click later and on the next visit. A switch that forgot would be worse than none.
- **All three join states carry it** — the link opened, the link dead, the service unavailable — since
  the switch is in the shared frame, above the state.

## The case table

| # | The case: one behaviour, one sentence | Held by |
| --- | --- | --- |
| 1 | The join page's header draws the switch, with both languages offered | unit, `ui/src/JoinPage.test.tsx`; red first |
| 2 | Pressing a language on the join page changes the words shown, and nothing else of the page | unit, same file; red first |
| 3 | The language pressed on the join page is kept on the device, and the dashboard it lands on speaks it | unit, same file; red first |
| 4 | A device that already chose a language opens the join page in it, that language marked on the switch | unit, same file |
| 5 | The dead link and the service unavailable draw the same switch as the link opened | unit, same file; red first |
| 6 | No word is added to either dictionary: `git diff --stat -- ui/src/i18n` is empty | the diff |
| 7 | The doors' question has its Vietnamese, and no screen is added, inserted or renumbered | `pnpm report`; `git diff -- walk/specs \| grep -c "at('"` prints 0 |
| 8 | Exactly the two join screens' versions move; the other seven doors' are unchanged | the two `walks.json`, against `main`'s build |

## What moves

The walk is **"Sign in with a passkey, and keep one's passkeys"** (`operator-passkeys`), six screens
today, numbered 1 to 6. Two of them are join screens, and both change. **Nothing is added and
nothing renumbers**, so the walk still holds six and the other four keep their yeses:

- **1 — "A join link opened: whose it is, who made it, and the button to make a passkey"**: gains the
  switch at the right of its header.
- **5 — "A link used, too old or replaced"**: the same.

Their sentences stay as they read: the switch belongs to the frame, and the doors' shared question
names it. **12 pictures** (vi and en at 390, 768 and 1280). Each screen is already captured in both
languages, so those twelve show the switch in both of its positions, and no screen is added to show
it pressed — row 2 holds the press. The third join state, the service unavailable, has no walk
picture today and gains none here: it draws the same frame, and row 5 holds it.

The doors' shared question (`visual/src/walks.ts#L289`) says today that the join screens carry no
switch, which stops being true: its second sentence is rewritten to say that every door carries the
switch and that the choice is kept on the device, with its Vietnamese in
`visual/site/questions-vi.json`, keyed by the English text and without which the build stops. A
question is no part of a screen's version (`visual/src/capture.ts#L260-L265`), so the other seven
doors re-ask nothing.

**What must not move:** nothing else on the join screens, and no other screen in any walk; the walk's
own comparison decides it, at step 6. **Beside it:** item 101 closes here and is this lane's alone,
and `docs/open-items.md` is the one file the live pieces share, so whichever merges second takes
`main` in and keeps both sides.

## Steps

- [x] **1. This plan.** 🤖 Opus, 15 min. *Done when:* committed, no local path.
      *Done 11-07:* committed at the branch's first commit; the plan carries no local path.
- [x] **2. The switch on the join page, the cheap end to end on the fake.** 🤖 Sonnet, 15 min: the
      state and handler in `Joining`, the two props through `JoinPage`, the six unit rows. *Done
      when:* rows 1, 2, 3 and 5 each red once from their own assertion, then green; row 6's diff
      empty; the gate over `ui`, all five steps named and run — typecheck, eslint, prettier,
      `pnpm --filter @credo/ui test` at 100 %, knip — `== exit 0` in a log read whole.
      *Done 11-07:* rows 1, 2, 3, 5 red once each with the source reverted, then green; row 4 held
      (green both ways, today's behaviour); row 6's diff empty; the five steps ran, ui 796 tests,
      `== exit 0`. One existing test in `ui/src/SignIn.test.tsx` asserted the join page had no switch
      and now asserts it has one.
- [x] **3. The walks page and the walk's two assertions.** 🤖 Sonnet, 8 min: the doors' question and
      its Vietnamese, and the switch asserted before the shot on the spec's screens 1 and 5
      (`walk/specs/operator-passkeys.spec.ts#L74-L86`, `#L109-L112`). *Done when:* `pnpm report` ends
      green; `git diff -- walk/specs | grep -c "at('"` prints 0; the built `walks.json` differs from
      `main`'s in exactly the two join screens' versions and the doors' question (row 8); the gate
      over `visual` and `walk`, all five steps named, `== exit 0`.
      *Done 11-07:* question and its Vietnamese rewritten; the switch asserted before the shot on
      screens 1 and 5; typecheck of both, eslint, prettier, knip and `pnpm report` (120 screens)
      exit 0; `visual` tests 100 % exit 0 on the rerun (first run: two timeouts in `admin-staff`,
      load). Row 8's comparison against `main`'s build and the `walk` run itself are held to step 5.
- [ ] **4. The look** (👤 1). The machine goes straight on to step 5 and does not wait for it.
- [~] **5. The gates and one review.** 🤖 Sonnet, then Opus, 10 min: `main` taken in, then the whole
      `pnpm check` once under the shared lock. *Done when:* `== exit 0` in the log, and every review
      finding tagged `[FIXED]`, `[REJECTED]` or `[DEFERRED]`.
      *Gates done 11-07 (review still to come):* `main` (afcda360) taken in; the one conflict, `visual/site/questions-vi.json`, resolved by the rule that its keys equal the merged `walks.ts`'s questions; typecheck, eslint, prettier, knip exit 0, `pnpm -r run test` red once on a 120 s timeout in `scripts/src/demo/apply.test.ts` row 21 (a file this piece never touched), green on its rerun (305 tests); report built from the committed tree, 122 screens; against `main`'s build exactly `pk-1-join` and `pk-5-link-dead` moved version, and the doors' shared question differs on its nine screens (row 8 holds).
- [ ] **6. The picture run** (👤 2), the human's terminal, about 17 minutes.
- [ ] **7. The recap.** 🤖 Sonnet, 2 min. *Done when:* committed, under 400 words, item 101 deleted,
      the products row true.

50 machine minutes. Closes item 101; opens nothing. Ridge takes it on the push to `main`, the human's
act and no step here.

## The human's points

👤 **1. The look, after step 3.** On the walks page, open "Sign in with a passkey, and keep one's
passkeys". Screen 1 is a join link opened, screen 5 a link that is dead; each now carries a small
`VI` / `EN` pair at the right of the coloured header, the language you are reading filled in. Pressing
the other one changes the page's words where you stand, and the choice follows you onto the dashboard
and into your next visit. Everything below the header is as it was. A yes holds until that header
changes again; a no becomes a case in the table and is fixed before step 6.

👤 **2. The picture run, step 6.** One command in your terminal, about 17 minutes, nothing else
testing on the machine: the passkeys walk and the other walks holding a door, run twice. Green means
exactly screens 1 and 5 moved and every other screen in every walk counted 0 moved pixels — the proof
that nothing else on the join screens shifted — and then the twelve new bases are written and
committed. A red names each screen that moved, and the machine finds why before any base is kept.
