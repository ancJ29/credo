# Delivery photos kept on R2, recap, 2026-11-15

Written before the landing on `pre-merge`. R2's own words: [the step 2 recap](2026-11-14-delivery-photos.md).

| A delivery's photo | Before | Now |
| --- | --- | --- |
| lives | in the company's records, on the box | in a private R2 bucket; the record holds its name |
| sent | with the delivered mark | first: ask, send, then deliver |
| never arrived | a broken picture | "the photo did not arrive" |

## What happened

The back end signs a five-minute address after its own checks and never touches R2; a stand-in serves the stack and the walks. With no photo store no driver can deliver, so the environment check is red. Your look at the new line was yes.

The review (Opus) said fix first. High: the signer put a blank line between a PUT's signed headers, so R2 would have refused every upload (`60c6f559`). Two Mediums, fixed in `87be838c`: no photo store left every check green, and a key passed through here-strings. Three more Mediums, in the two one-offs outside git, the reviewer fixed in place. Lows: items 481, 482, 486 `[DEFERRED]`, 480 `[OPEN]`; the plan's cross-origin act and case 13's row corrected. <!-- FILL: the fix pass's reread, its verdict -->

## Still yours

- Ridge's acts: the bucket, its cross-origin rule, its key, the box's file, the probe. <!-- FILL: each act's result, not yet run -->
- The push, ridge's deploy, then your own photo from a phone. <!-- FILL: your answer, yes or no -->
- The act run and the whole check on `pre-merge`. <!-- FILL: each verdict, not yet known -->

## Evidence

- Commits `9bcce0e1` to `87be838c` on `delivery-photos`, from `34dd2770`.
- Your two walk runs ended green, 9 comparisons each; the only new screen was `orders-15-photo-missing`, 6 pictures.
- `docs/products.md`: the My deliveries row; state open until in `main`.
