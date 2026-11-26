# A company's own sign-up, recap, 2026-11-26

You asked for the sign-in campaign's fifth milestone: a company signs itself up, root and all, and starts once a credo operator approves it. It lands with milestones 3 and 4.

```mermaid
flowchart LR
  a["answer"] --> b["gallery"] --> c["fake"] --> d["BFF"] --> e["walk"] --> f["landing, looks"]
```

## What the piece gives you

- Your answer, operator approval, is a row in `docs/decisions.md`: the app sends no mail.
- `/sign-up`, reached from the unknown-company page, takes the company's name and address, the requester's name and phone, and the root's password, kept as its hash alone. The address then says it is waiting, and its root cannot sign in.
- At most 20 requests wait; an address held, taken or waiting is a 409.
- Clients gains "Waiting for approval". Approve makes the company with the chosen password at once; Refuse frees the address after a question, for a signed-in operator only.
- Not in it: mail, an expiry, a link on a company's card.

## What was proved

- Each business row was seen red on the old code, then green. The doors' walk gains four scenes and the operator's three. The count before the write is not atomic, so a burst can pass 20; the stage's throttle bounds it.
- Your four walk runs of 26 November ended green, the last at 07:50 with 0 moved between its two passes; the first three each stopped on a walk slip, the starred labels and the sent address's port this piece's, fixed in `8a25fe7f` and `715d1e34`. Bases: `487e5cfc`, `d658045b`.

## How it closed

- Your answer: yes, 25 November. Point 1, the gallery: yes.
- The landing on `pre-merge`, the whole check and the review: The three milestones landed together on `pre-merge` on 26 November. The whole check went red twice that morning (a package never installed there, then the dev scripts' tests stalling on a loaded machine), green on its third run and again after the fix pass. The review found eight blocks, four in the screens, four in the docs, all fixed in one pass; `main` moved to that landing.
- Point 2, the walks page, and ridge after the push: Your answers, 26 November: the ridge look "Tested and all ok", the walks page's 44 screens "YES for all". You pushed `main` to ridge the same day.
