# An alarm on ridge reaches the Slack channel, recap, 2026-11-12

Written before the landing on `pre-merge`. Nothing is applied to ridge yet.

## What happened

`ops/env.yml` gains four alarms (the app's calls failing, the back end's errors, the back end refusing work, the box failing its check), one topic they send to, and AWS's Slack app as the channel behind it. The two Slack IDs are parameters, `none` by default, in no committed file; without them the stack still makes the topic and the alarms. `ops/stack.sh` takes them from the environment, refuses one without the other, and keeps the stack's own on an update. The runbook gained "The watch". Two hand-offs outside git run the stack and force one alarm; guards in `ops/test.sh` pin each alarm.

## What was rejected

A token in the back end (it needs a fixed-charge NAT gateway), a function of our own posting a webhook, and email.

## Still yours

- Your Slack clicks, then the stack run with `--plan` first. <!-- FILL: the plan read and the stack run's verdict in words -->
- The forced alarm: each alarm's metric exists, and the alarm and its return to normal each run their action. <!-- FILL: the forced alarm's verdict in words -->
- Your look: does the first message tell you, without opening anything else, that ridge's app calls were failing and when? A yes closes the piece; a no reopens the alarms' descriptions. <!-- FILL: the look's answer; strike this line when it comes -->

## Evidence

- Base `ff42f0a1`; steps `1413e539`, `6bfbcc8e`, `f0c35fdf`, `db500d30`; fix `2866b35b`; citations `d4b94199`; `pre-merge` taken in at `c21ab975`.
- Each step's gates (ShellCheck, `ops/test.sh`, the citation test) ended green. After the take-in, ShellCheck, the citation test and the whole `ops/test.sh` ended green.
- Review on another model: three Medium, fixed. M1: moved line citations. M2, M3: the force script's verdicts on a missing metric and a failed alarm. Lows: fixed, or items 365 to 368. Its reread says it may land with named changes: 13 citations still wrong, finished in `d4b94199`, docs only, with no reread after it. Items 372 and 373 are deferred.
- Not yet known: ridge's change set, the metrics' names there, AWS's wording for a successful action (item 367).
- `docs/products.md`: the watch row now says "in `main`", not applied.
