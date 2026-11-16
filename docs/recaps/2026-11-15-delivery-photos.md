# Delivery photos kept on R2, recap, 2026-11-15

Written before the landing on `pre-merge`; the ridge lines were filled once they ran, on 2026-11-15 and 2026-11-16. R2's own words: [the step 2 recap](2026-11-14-delivery-photos.md).

| A delivery's photo | Before | Now |
| --- | --- | --- |
| lives | in the company's records, on the box | in a private R2 bucket; the record holds its name |
| sent | with the delivered mark | first: ask, send, then deliver |
| never arrived | a broken picture | "the photo did not arrive" |

## What happened

The back end signs a five-minute address after its own checks and never touches R2; a stand-in serves the stack and the walks. With no photo store no driver can deliver, so the environment check is red. Your look at the new line was yes.

The review (Opus) said fix first. High: the signer put a blank line between a PUT's signed headers, so R2 would have refused every upload (`60c6f559`). Two Mediums, fixed in `87be838c`: no photo store left every check green, and a key passed through here-strings. Three more Mediums, in the two one-offs outside git, the reviewer fixed in place. Lows: items 481, 482, 486 `[DEFERRED]`, 480 `[OPEN]`; the plan's cross-origin act and case 13 corrected. Opus reread `11b4c817..87be838c` and said may merge; items 487 and 488 are deferred.

## On ridge

- Ridge's acts: the bucket, made for ridge alone, and its cross-origin rule; the key script, red on two runs (a log path, then a read-back), fixed, the box's file written; the probe, red once on the preflight, then green, its fifth check skipped since the stack named no domain.
- The push, ridge's deploy, then your own photo from a phone, yes: GitHub's run went red once on a test shard and green on its rerun, the deploy done; the photo from your phone showed on the office's request.
- The act run was red on one step's own 2-minute limit, not on the scripts, and was not rerun; the whole check on `pre-merge` was green.

## Evidence

- Commits `9bcce0e1` to `87be838c` on `delivery-photos`, from `34dd2770`.
- Your two walk runs ended green, 9 comparisons each; the only new screen was `orders-15-photo-missing`, 6 pictures.
- `docs/products.md`: the My deliveries row; the whole check was green and `main` holds it.
