# Every terminal script safe on production, or refusing it, recap, 2026-11-12

Written before the landing on `pre-merge`. Production does not exist yet.

| A script run on... | Before | Now |
| --- | --- | --- |
| ridge | as it was | as it was |
| any other name (taken as production) | nine scripts could act | each says its answer first |

## What happened

Every script that reaches an environment says first what it does on a real one. Four refuse: the crash drill (new), the tunnel, the seed and the root password. Four work as they are: the stack, the release, the app and the operator. The check only reads there: no key off the box, no test collection, no test client. `--reads-only` gives ridge the same run. A test fails a new script that calls neither helper. Production is every name not listed as invented, today all but ridge. The runbook gained "On production".

## What was rejected

A tag marking real data (it fails open) and refusing the check on production (it needs one after each deploy).

## Still yours

- Your look: the list of scripts and what each answers on production, in `ops/README.md`. Answered yes.
- The `act` run and your push. GitHub's runs on the landing push, the push and the button, both ended green with every job clean; each deploy's check ended green and deleted its own client. The whole check on the same commit had ended green before the push. `act` ran that commit first and ended green: every enabled job succeeded on both events, with no deploy started, and its logs read whole showed no failed job.
- On ridge, `bash ops/check.sh ridge --reads-only` should end `== green`. Run and read whole: it ended green, with no failure, the collection and the client skipped as reads-only says, and no key in its log.
- Production's check shows no save; item 333 words "proved on ridge first" as the production lane's rule.

## Evidence

- Base `1467a9f0`; steps `34d1e4d8`, `40baaf1c`, `2dbb0175`; fix pass `a32f27ba`.
- Each step's gates (ShellCheck, `ops/test.sh`, the citation test) ended green, and again after the fix pass.
- Review on another model: two Medium, fixed. M1: the read-only check pulled the BFF's two keys into the shell; one query now returns names and non-secret values only. M2: two documents still said the check made a client. Eight Lows: L1, L5, L8 fixed; L2, L3, L4, L6, L7 are items 322, 323, 324, 332, 333. Its reread says it may land; one more finding, item 341.
- `docs/products.md`: the `ops/` stack scripts row says four refuse and the check only reads.
