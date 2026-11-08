# The API stage's access log, recap, 2026-11-08

## What the template now holds

The API in front of the back end has a 14-day log group and, on its stage, a setting that writes one JSON line a call: time, address, path, answer. A guard in `ops/test.sh` (`api_log_guard`) refuses a template that has lost them, and it was proved against its own false green: the settings replaced by a comment naming every keyword stayed red, because the guard reads the parsed template and never greps it (`ops-test-83-step2-mutations-20261108-131535.log`). **This is in the template, not running: nothing is on ridge until the human applies the change set.**

## The page was wrong, and so was this piece

`docs/client-readiness.md` ranked this work on the claim that a guessing run "would leave no trace anyone could read afterwards". **That was false when written:** the deployed function has logged a line per request all along. So the stage's log is a second, independent trail, not the first.

Then **this piece over-claimed in its turn, and a review caught it.** The review reasoned that the line's address is the immediate connection's and the API sits behind CloudFront, so a call through the distribution would record a CDN node. **That was reasoning, and the run overturned it:** on ridge, 2026-11-08 at 18:11, three calls through the distribution left three lines with one and the same address, a public one outside AWS's published ranges (the orchestrating session's check of that date, not re-run) and consistent with the caller's own, not an edge node. Why is not established; the field is documented as the immediate connection's, so the measurement and the plain reading disagree, and item 157 holds the open question. That the format takes only its own variables, and that the function's log cannot recover a viewer's address, still stand as a reading of the code, unmeasured. A request the stage throttles is answered 429 and never reaches the function, so it appears only in the stage's log: the traffic the page calls the only brake on a guess.

## Limits

- A refused delivery loses a line silently and nothing reddens. Recording on the request's own path could fail a customer's read, so the loss was accepted on purpose.
- cfn-lint has not run locally; CI's `ops` job is its verdict.
- Whether the group's ARN (ending `:*`) is accepted as the destination is documented neither way; the change set answers it.

## Still open

- **Item 121 is only partly closed:** the readable half is in the template; the wall (a signed origin, a key or a WAF) stays open and parked as the human's.
- Filed here, all Low: 152 (no line names the client or the end user), 153 (the route field is always `$default`), 154 (three caller-controlled values go in unescaped), 155 (the guard holds five of ten fields).
- **The human's two points are ahead: the change set has not been applied, and its lines have not been read.**

## Evidence

- Whole check green on `82a9234b`: `access-log-step4-whole-20261108-140928.log`, last line `== exit 0`.
- Review (another model): may merge with one change, the address claim; fixed in `82a9234b`, which also filed 153 to 155.
