# An alarm on ridge reaches the Slack channel, one alarm forced and read back

## At a glance

Today nothing watches ridge and nobody is told when it stops (`docs/products.md#L94`). This piece
gives ridge four alarms on what AWS already measures for free: the app's calls failing, the back
end's own errors, the back end refusing work under load, and the box failing its health check. Each
alarm, and its return to normal, goes to one topic, and AWS's own Slack app carries the topic into
your channel. **No hook and no secret**: you authorise your Slack workspace in AWS's console once,
and the stack is given two plain IDs. Nothing new runs on the box, the network keeps no way out, and
no fixed-charge part is added: four alarms are about 40 cents a month. One alarm is then forced on
ridge, and its message is what you judge. The shape is the earlier remake's design, never run
there, here read back for the first time.

## The slice

One slice, walkable when it ends: on ridge, an alarm forced into its alarm state puts a message in
your channel, and its return to normal puts a second one; the four alarms read back as watching
ridge's own API, function and box. **The four stages:** stage 2 is the template, the script change
and their guards, checked here (rows 3 to 5 of the gate); stage 3 is your look at the channel; stage
4 is ridge. **The gap is stage 1:** no run end to end exists off ridge, because AWS's alarms, topic
and Slack app have no local stand-in, so the first end-to-end run is ridge's, which holds no real
records and costs nothing to get wrong.

**What the two premises found, on disk.**

- **"Nothing posts an alarm to Slack" is false in both of the old repository's trees.** The legacy
  app (`workspace/`) posts to Slack itself, from inside its back end, through Slack's Web API with a
  bot token: `workspace/shared/connectors/src/__internal__/slack/index.ts#L13`, its settings
  `SLACK_TOKEN` and `SLACK_CHANNEL` (`workspace/bffs/credo-sme/src/configs/env.ts#L77-L81`), sent
  on a call to no route (`workspace/bffs/base/src/app/plugins/not-found-alert.ts#L142`) and on a
  permission mismatch. The earlier remake (`opus/`) designed this piece's exact path, alarms to a
  topic to AWS's Slack app with the two IDs as parameters (`opus/ops/apps/credo/stack.yml#L28-L35`,
  `#L151-L176`), and never read it back (`opus/docs/open-items.md#L207-L211`). Nothing in this
  repository's stacks posts anywhere: the only alarm-shaped line is a test's invented topic
  (`ops/test.sh#L522`).
- **"Its hook handed to the stack as a secret" is not the cheapest path.** AWS's Slack app is
  authorised in AWS's console; the stack then takes a workspace ID and a channel ID, identifiers and
  not credentials: AWS's page has you copy the first from its console and the second off a channel's
  link (AWS, "AWS::Chatbot::SlackChannelConfiguration", read 2026-11-11). They stay out of every
  committed file all the same, as the channel's name does.

**Rejected, with their price.** The legacy's way, a token in the back end: the function sits in a
network with no way out (`ops/network.yml#L32`), so reaching Slack needs a NAT gateway, a fixed
monthly charge your rule keeps out, plus a secret to replace; and an alerter inside the function
cannot report the function or the box being down. A function of our own that posts a webhook: code,
a secret and its replacement, for what AWS's app does at no code. Email: free, and your answer was a
Slack channel. **Flips to the webhook function** if AWS's app cannot be added to your workspace, or
refuses a topic in ap-southeast-5 (cfn-lint 1.59.0 here lists the resource type in that Region,
against a control it refuses there; delivery is first seen at the forced alarm).

**Not in this slice, named so it is not pulled in:**

- **The scheduled check a box**, the final page's small function that fails when the continuous copy
  lags or the disk is low. It reads the continuous copy's `GET /api/status` (that plan's step 4) and
  the bucket's newest copy (its step 2), neither built yet, so it is this lane's **second plan**,
  after the copy lands, and it consumes this piece's topic `Alerts`.
- **A monthly spend alarm** on the account: a billing alarm, not ridge's; the final page left it
  unpriced. **The alarms read by `ops/check.sh`**: the deploy role would need a CloudWatch right,
  for a fact the forced alarm's script already reads.
- **Production's alarms**: production is one more stack from `ops/env.yml`, so it gets the same four
  when it is made, into the same channel unless you say otherwise.

## The case table

| # | The case | Held by |
| --- | --- | --- |
| 1 | Each of the four alarms sends its alarm and its return to normal to the one topic, and nowhere else | `ops/test.sh`, the parsed template |
| 2 | The calls-failing alarm reads this stack's own API and stage (`5xx`, one in five minutes; no calls is not a failure) | `ops/test.sh` |
| 3 | The errors and the refusals alarms read this stack's own function | `ops/test.sh` |
| 4 | The box alarm reads this stack's own box, and a box that reports nothing for three minutes counts as down | `ops/test.sh` |
| 5 | With no Slack IDs the stack still makes the topic and the four alarms, and no channel and no channel role | `ops/test.sh` |
| 6 | The channel's role grants nothing, and its guardrail is not AWS's default, AdministratorAccess | `ops/test.sh` |
| 7 | The template holds no Slack ID: both are parameters defaulting to `none`, and a channel's typed name is refused by the ID's pattern | `ops/test.sh` |
| 8 | One ID without the other is refused before any change set (the remake's recap: one alone made a channel AWS refused mid-creation, `opus/docs/recaps/2026-10-24-launch-code-review-4g-4h.md#L24`) | `ops/test.sh`, the lib function |
| 9 | An update keeps the stack's IDs when none are given, takes new ones when given, and `none` on a stack that holds none | `ops/test.sh`, the lib function |
| 10 | Each alarm's description says in plain words which environment and what failed | `ops/test.sh` |
| 11 | The layer-four change-set test still holds once the template gains resources | `ops/test.sh` |
| 12 | ridge's change set adds this piece's resources and modifies and replaces nothing | the stack's log, read whole |
| 13 | Each alarm's metric exists on ridge under its exact name and dimensions | the forced alarm's log |
| 14 | A forced alarm runs its action, and its return to normal runs its own | the forced alarm's log |
| 15 | The message reaches your channel and reads as ridge's calls failing | your look |

Row 13 is the guard on the one silent failure: an alarm whose metric name or dimension is wrong reads
"normal" forever, since no data counts as no failure. A Lambda that was never refused may have no
refusals metric published at all; the log names that, and it is not a red.

## The steps

Sizes are the same shape's rows in the runs log: a template-and-guard step 10 and a guard step 8
(the backup-fence and access-log pieces), a script branch 5, a one-off 1 to 7 (median 2), a review
of an `ops/` change 6 to 27 (median 14), a fix pass 2 to 23 (median 6), a recap 1 to 8 (median 3), a
log read 1 to 2. 👤 is your act.

- [x] **1. The template**, `ops/env.yml`: the two parameters (default `none`, patterns from AWS's own
  and stricter), the condition, the topic `Alerts`, the channel's role with no policy, the channel
  with its guardrail and error logging, the four alarms with plain descriptions, and one printed
  output `Watch` ("alarms reach Slack", or "alarms reach no one: no Slack channel"). AWS's own words
  read first, by the `fetch` kind's rule: the HTTP API's `5xx` metric and its two dimensions, the
  function's `Errors` and `Throttles`, the box's `StatusCheckFailed`, and the managed deny-all
  guardrail's name; each cited in a comment beside its alarm. *Done when:* `cfn-lint ops/network.yml
  ops/github.yml ops/env.yml` and `cfn-lint --regions ap-southeast-5 ops/env.yml` each at exit 0.
  **10, plus 5 for the reads.**
  *Done, 2026-11-12:* the AWS pages for the HTTP API's `5xx` with its `ApiId, Stage` dimensions, the
  function's `Errors`, `Throttles` and `FunctionName`, the box's `StatusCheckFailed` and `InstanceId`,
  the channel's `GuardrailPolicies` default and `AWSDenyAll` were read and hold, each quoted in a
  comment beside its alarm. `cfn-lint ops/network.yml ops/github.yml ops/env.yml` ended at exit 0, and
  the Region run ended at exit 0 written `cfn-lint ops/env.yml --regions ap-southeast-5` (with the
  flag first it swallows the file name and exits 32, a parse fault, not the template).
- [ ] **2. The guards**, `ops/test.sh`, beside the template's other guards (`must` and `mut`,
  `ops/test.sh#L240-L247`): rows 1 to 7 and 10, each seen red once on a template broken one way; and
  row 11: `adds_and_one_modify` (`ops/test.sh#L508-L524`) reads every resource the template gains as
  layer four's, so this piece pins layer four's own list there if it lands first, and if another lane
  landed that change first it adds nothing. *Done when:* `bash ops/test.sh` at exit 0 with each new
  `refuses` line printed, and `shellcheck -x ops/*.sh walk/*.sh services/c-storage/scripts/*.sh` at
  exit 0. **8.**
- [ ] **3. The two IDs in `ops/stack.sh`**: one function in `ops/lib.sh` copied from
  `subject_param_plan`'s shape (`ops/lib.sh#L374-L380`), reading `CREDO_SLACK_WORKSPACE_ID` and
  `CREDO_SLACK_CHANNEL_ID` from the environment, refusing one without the other, keeping the stack's
  values on an update; called from the `env` branch on both paths (`ops/stack.sh#L162-L196`), and
  `Watch` named in `OUTPUTS_PRINTED` (`ops/lib.sh#L246`). *Done when:* `bash ops/test.sh` at exit 0,
  rows 8 and 9 each red once; shellcheck as in step 2. **5.**
- [ ] **4. The runbook and the prose it makes false**: `ops/README.md` gains "The watch" and its row
  in the table at its top: your Slack steps below, word for word; the stack run; the forced alarm; a
  workspace ID changed later replaces the channel's configuration, so that run takes `--take
  AlertsChannel`, which holds nothing to lose. `docs/products.md#L94` and open item 1
  (`docs/open-items.md#L13-L17`), whose "the old app counted each 5xx in its Lambda logs" matches
  neither tree, rewritten from what is built. *Done when:* the citation test at exit 0. **5.**
- [ ] **5. Your two hand-offs**, one-offs in the credo root's `one-off/`, outside git, each tee'd to
  `logs/`. `<stamp>-watch-stack.sh [--plan]` asks for the two IDs at a prompt, checks their shape,
  and runs `ops/stack.sh env ridge` with them; it calls the script and copies none of it. `<stamp>-
  watch-force.sh` reads the four alarms and that each one's actions are the topic (compared, never
  printed: the topic's name holds the account's id), lists each alarm's metric (row 13), forces the
  calls-failing alarm with `aws cloudwatch set-alarm-state`, then waits for its action in the
  alarm's history and for its return at the next five-minute evaluation (row 14), printing before it
  waits how long and until what clock time, then a line every 30 seconds; it ends with the topic's
  delivered and failed counts. *Done when:* `bash -n` and `shellcheck` at exit 0 for both. **2 and
  2.**
- [ ] **6. One review**, on a model other than the author's, of steps 1 to 5 with the case table.
  *Done when:* a verdict line, each finding with its line. **14.**
- [ ] **7. The fix pass.** *Done when:* each finding fixed, rejected or deferred with its reason, and
  the checks of steps 1 to 3 again over the final tree, `pre-merge` taken in. **6.**
- [ ] **8. The recap**, before the piece lands on `pre-merge`, with rows 12 to 15 marked not yet
  known. *Done when:* committed, the citation test at exit 0. **3.**

**Your acts, after the piece is in `main`.** Each is read by the machine from its log, a read of 1
to 2 minutes.

- [ ] **9. 👤 Your channel, at any time before step 10.** From AWS's page, read 2026-11-11
  ("Tutorial: Get started with Slack"):
  1. In Slack, make a **private** channel: the alarms are yours, and the workspace may hold the
     partners who post their answers there. Name it as you like.
  2. In Slack's left pane choose **Automations** (or **More**, then **Automations**), **Browse Apps
     Directory**, find **Amazon Q Developer in chat applications**, choose **Add**.
  3. In the channel, type `/invite @Amazon Q`, then choose **Invite Them**.
  4. In AWS's console, open **Amazon Q Developer in chat applications**; under **Configure a chat
     client** choose **Slack**, then **Configure**. Slack's authorisation page opens: pick your
     workspace at the top right, choose **Allow**. You will see the **Workspace details** page.
  5. Copy the workspace ID from **Workspace details**, and the channel ID from Slack (right-click the
     channel, **Copy Link**: the ID is the end of the link). Make no channel configuration in the
     console; the stack makes it.

  *Done when:* step 11 makes the channel's configuration: CloudFormation refuses one whose workspace
  is not authorised, so that log is this step's check.
- [ ] **10. 👤 Your push of `main`, then the stack hand-off with `--plan`**, your point 1. Every
  `ops/` script refuses a tree that differs from `origin/main`. *Done when:* the log names the
  template at `origin/main`, lists this piece's seven `Add` lines among any others, modifies and
  replaces nothing, and prints the parameters with both IDs (your local log only).
- [ ] **11. 👤 The stack hand-off without `--plan`.** *Done when:* the log ends `== exit 0`, the guard
  passed, and the outputs read `Watch = alarms reach Slack` (row 12).
- [ ] **12. 👤 The forced alarm.** *Done when:* its log reads rows 13 and 14 and ends `== exit 0`;
  the recap's markers filled. **3.**
- [ ] **13. 👤 Your look**, your point 2.

About **60 machine minutes** for steps 1 to 8, and about 10 to read your logs and fill the recap.

## The order, and what it waits on

- **Steps 1 to 8 wait on nothing**: they change files and read nothing live.
- **Steps 10 to 12 wait on ridge being back**, by `docs/plans/2026-11-09-ridge-reup.md` on
  `ridge-reup`, and consume from it: its step 1, a `credo-ridge` stack made from `main`'s templates
  holding the `Api`, `ApiStage`, `Bff` and `Box` the alarms name; its step 2, c-storage released and
  the app shipped, so the API answers; its step 3, the environment check's traffic, which publishes
  the API's metrics that row 13 lists. Ridge's plan changes no `ops/` file (its scripts are
  hand-offs outside git), so no file waits on it; it does change `docs/products.md`, another line.
- **Files another lane will touch.** The continuous copy changes `ops/env.yml`, `ops/test.sh`,
  `ops/lib.sh`, `ops/README.md` and `docs/products.md`; the front door's key likely `ops/env.yml` and
  `ops/test.sh`. Whichever lands second takes `pre-merge` in before its checks. The likeliest meeting
  points are the template's `Outputs`, `OUTPUTS_PRINTED` and `adds_and_one_modify`'s list (open item
  261). **The front door's key replacement script consumes nothing from this lane**: the Slack path
  holds no key. **The continuous copy's free-disk reading** is consumed by this lane's second plan,
  not by this one.

## Your points

1. **At step 10, ridge's change before it happens.** You will read the plan's lines: a topic, four
   alarms, a channel and its role added, nothing changed or removed. It matters because this is a
   change to ridge's stack, which only you make. A yes runs step 11; a no stops the piece at that
   line and the template is fixed first.
2. **At step 13, the message in your channel.** After the forced alarm you will see two messages,
   the alarm and its return to normal about five minutes later. **Does the first one tell you, without
   opening anything else, that ridge's app calls were failing and when?** A yes closes the piece; a no
   reopens step 1's descriptions with your words, and the force is run again.

## Hazards no gate catches

- **A forced alarm proves the path from alarm to channel, not the metric under it.** Row 13 shows
  each metric exists; that a real failure fires its alarm is first seen at ridge's first real
  failure. A box rebooted by the drill for more than three minutes sends a true message.
- **What is not read:** the price of AWS's Slack app and of the topic's deliveries to it, and the
  message's exact look before step 13.
