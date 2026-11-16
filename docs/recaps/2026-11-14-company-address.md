# Each company's own address, recap, 2026-11-14

Written before the landing on `pre-merge`; the ridge lines were filled once they ran, on 2026-11-16.

| Who opens what | Before | Now |
| --- | --- | --- |
| a company's people | `https://<CloudFront's name>/login?client-code=acme` | `https://acme.<ridge's domain>/login`, once the stack names a domain |
| the operator | CloudFront's name, `/operator` | `https://operator.<domain>/operator` |
| the clients page | a link with the code in it | each company's own address |

## What happened

The stack takes two settings, `Domain` and `CertificateArn`, both empty by default, so the template changes nothing until they are set. The screens read the company from the address; the back end is unchanged. `operator` and `www` are kept back from companies. The environment check reads a fresh company a second time through its own address and says "skipped" where the stack names no domain.

The review (Opus) said fix first for one Medium: the check's two passes printed the same words, so a red could not say which address failed. Fixed in `58a24141`, each pass under its own header; the reread said may merge. Ten Lows are items 472 to 476, `[DEFERRED]`; the four living line citations in them are now file and symbol.

## On ridge

- Your look at ridge, yes: the first demo copy opened at its own address with its own sign-in page, and the console's list showed the same address.
- Your acts, each green: the certificate was requested and issued; both DNS records answered public DNS; the stack run changed the distribution alone, with no removal and no replacement; the app deploy and ridge's own check, 8 of 8 lines through the company's address, passed. The push of 2026-11-15 ran GitHub's checks green and its deploy.
- The whole check on `pre-merge` was red once, from the machine's load slowing three visual scenes, and green on a quiet rerun; `main` then took the same commit.

## Evidence

- Commits `54194568` to `58a24141` on `company-address`, from `313b9516`.
- The ops gate after step 4 and after the fix: ShellCheck and cfn-lint printed nothing, and `ops/test.sh` ended "all checks passed".
- The package gates for shared, ui, bff and scripts each ended `== exit 0` at steps 2 and 3.
- `docs/products.md`: the Clients row of the operator console extended; state open until it is in `main`.
