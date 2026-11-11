# What a part promises, recap, 2026-11-10

Piece 105. Written after the piece reached `main` (`54297d90`), not before its squash.

## What happened

On 2026-11-10 the human asked whether each sub-service should have a memo of its own on how it behaves, and then fixed the shape: "plz keep this as a rule when new services comming - docs/memo/bff.md, docs/memo/ui.md". Two of the four parts already had such pages (c-storage's, with sections titled as claims, and the audit backbone's four short ones), which settled the form. The piece wrote the two that were missing, then the rule.

- **`docs/memo/bff.md`**: 13 claims, each a section titled as its promise ("A 401 ends the session; a 403 ends only the act", "A write over a moved record is tried three times").
- **`docs/memo/ui.md`**: 11 claims in the same form.
- **The rule**, one paragraph in `docs/conventions/documentation.md`, naming three homes against each other: a part's `CLAUDE.md` says what belongs in it, `docs/architecture.md` says what it is for, the memo says how it behaves. A claim lands in exactly one; where it would fit two it belongs to the memo.

## What it cost

- **The claims moved rather than being copied.** `docs/architecture-detail.md` fell from 4,574 to 3,995 words, read with `wc -w` on the commit and its parent. Its two headings stayed, so the links into them still resolve; the measurement behind the actor gap stayed, being evidence rather than a promise.
- **The memos join the citation check's living set** (`scripts/src/citations.ts`'s `LIVING`), one entry each, so a page gone from the tree is named rather than passing as an empty set. The undated memos beside them hold one decision each and stay outside.
- **Rejected**: the behaviour in the part's `CLAUDE.md`. A session about to write code reads that file; a promise is read by whoever calls the part, a different reader at a different moment. Also rejected, on the human's correction: `bff-architecture.md`, because a second naming scheme for one kind of page is the two-homes fault.

## What the piece found

- **Two behaviours stated nowhere before.** A 401 signs a client's person out of the device but only asks an operator for the passkey again, so what a reader learns from one app is wrong for the other. And the operator console ships inside the one bundle every client downloads, with the build's warning limit set so nothing warns.
- **A dangling heading anchor in `bff/CLAUDE.md`**, which no gate reads, found by a hand grep over the repository's anchors and fixed. The citation check reads files and symbols, not anchors, which is the gap piece 103's recap already recorded.

## What remains the human's

Whether the heading-anchor check should be built.

No `docs/products.md` row: the memos are pages for callers and sessions, nothing a user or partner opens.

## Evidence

- Commit `54297d90`; section counts read from the `##` headings of each memo, less the three framing sections (`At a glance`, `Where the rest is`, `What this memo did not read`).
- The board's and the commit message's bundle size and anchor total were not re-measured here, so neither is quoted.
