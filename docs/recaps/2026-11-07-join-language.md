# A language switch on the join screens, recap, 2026-11-07

## What is now true

A new person opening a join link sees a VI / EN switch in the coloured header, in all three states: the link opened, the link dead, the service unavailable. The language chosen there survives the join: the dashboard it lands on speaks it, and so does the next visit. The unit rows in `ui/src/JoinPage.test.tsx` prove it: the press changes the words with one fetch, the device keeps `vi` and the dashboard heading reads "Khách hàng", and a device already on `vi` opens the page in it. No dictionary word was added.

## The screens

Yes on all six passkey screens, answered 2026-11-07. The two new ones, the join link opened and the link dead, are at versions `16a9c9edb046` and `01d513556913`; the other four answered yes on unchanged versions. The picture shows the switch only; its boxes are inert in a capture, so the press is held by the rows above.

## Decided, rejected, deferred

- **Corrected:** a test in `ui/src/SignIn.test.tsx` pinned the absence of this switch, and the plan's file list missed it. The gate caught it; it now asserts the switch is there.
- **Corrected:** merging `main` conflicted in `visual/site/questions-vi.json`, which is keyed by the English question. It was resolved by making its keys follow the merged `walks.ts`.
- **Review, Medium, fixed:** the look's hand-off text promised a press the picture cannot show.
- **Review, Low, kept:** the shared question still says the pressed language is kept on the device.

## Evidence

- **The whole test step never passed in one invocation.** One 120-second timeout in `scripts/src/demo/apply.test.ts`, a file this piece cannot reach; that package was green on its rerun (305 tests). Typecheck, eslint, prettier and knip were green.
- The report was built from the merged tree: 122 screens, and against `main` exactly the two join screens moved.
- The picture run is the human's step 6.
