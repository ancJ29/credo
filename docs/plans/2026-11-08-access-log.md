# The API stage's access log

## At a glance

The one API stage in front of the BFF records nothing it serves: `ops/env.yml#L244` says so in its
own words, "No access log. The API's own address answers anyone". This piece gives that stage a log
group and an access-log format, so that a call to a client's back end leaves a line naming when it
came, from what address (the immediate connection's: the caller's own for a call straight to the API, CloudFront's for one through the distribution), over what path and what it was answered — and gives that property a guard
that reddens if a later change takes it away. It is the readable half of
[open item 121](../open-items.md), and the log half of the fourth thing
[client readiness](../client-readiness.md) asks for before real client data goes in, where it
is called "nearly free". The cheapest safe path is the one the template already uses for the
function's own logs (`BffLogs`, `ops/env.yml#L169-L174`): one more `AWS::Logs::LogGroup` at the same
14 days, one property on the stage, and the guards' existing JSON read of the template
(`ops/test.sh#L213`) to hold it. **No screen**, so no walk and no base pictures; the human's look is
the log's own lines.

## The slice

In: the group, the stage's `AccessLogSettings`, the guard that proves a stage without them is
refused, the prose this makes false, and the human's change set on ridge with one read of the lines.
It is walkable at the end: a request through ridge's edge, then a line in the group.

Out, deliberately: **the wall** — a signed origin, an API key or a WAF — which is the other half of
item 121, last of readiness' six (`docs/client-readiness.md#L248-L249`), and which the item itself
declines to design until the conditions are known. Out too: **the sign-in limit**, item 28, the
other half of readiness' fourth, which its own item leaves to the owner. And out: **tying a line to
the client whose records were read.** The client's code arrives in a header, and an HTTP API's
access-log format can only name `$context` variables, so the header cannot go in the line. What the
line does carry is the path, and the detail routes put the record's minted id in the path
(`/api/employees/<id>`, `bff/src/employees.route.test.ts#L1285`), so "which record, when, from
where" is answered for those routes and the client is not. Joining the stage's line to the BFF's own
request line — which already exists, see below — is its own piece, filed as a new open item in
step 3. The split falls there because the stage's log is readable the moment the change set runs,
while every other half needs a decision or a second log to be worth anything.

**It cannot fail loudly, and that is accepted.** API Gateway delivers an access-log line out of
band; if CloudWatch Logs is slow or refuses, the request is still served and the line is lost with
no signal. The alternative — recording an access on the request's own path before answering — would
put a log write between a reader and their records and could fail the read, which is worse for a
log whose whole purpose is to be read afterwards. The piece accepts the loss and leans on there
being **two independent trails**: the BFF's Fastify logger is on in the deployed function
(`bff/src/lambda-main.ts#L3` passes no options, so `server.ts#L9`'s `logger = true` stands and
`app.ts#L86` builds Fastify with it), so `/aws/lambda/credo-${Env}-bff` already holds a line per
request. A silent gap in one is visible against the other.

## The cases

| # | The case: one behaviour, one sentence | Held by |
| --- | --- | --- |
| 1 | The stage sends its access log to this environment's own group, in a format holding the time, the address of whoever opened the connection, the path, the route and the answer | `ops/test.sh`, `api_log_guard` under `passes` |
| 2 | A stage with no `AccessLogSettings` is refused | `ops/test.sh`, `refuses` on `mut` |
| 3 | A destination that is not this environment's own group is refused | `ops/test.sh`, `refuses` on `mut` |
| 4 | A format that drops the connection's address, the time, the path or the answer is refused | `ops/test.sh`, `refuses` on `mut` |
| 5 | The group is the API's own, not the function's, and keeps 14 days | `ops/test.sh`, `check` on `.Resources.ApiLogs` |
| 6 | The template still reads as JSON in long form, and cfn-lint is silent on it | `ops/test.sh#L214`; CI's `ops` job |
| 7 | No committed file outside `docs/plans/` and `docs/recaps/` still says the API has no access log | `grep -c` reads 0 |
| 8 | A call through ridge's edge leaves one line naming when, which connection (CloudFront's, through the edge), what path and what answer | the human's read, point 2 |

## The steps

- [x] **1. The group and the stage's settings.** `ApiLogs`, an `AWS::Logs::LogGroup` named
  `/aws/apigateway/credo-${Env}` with `RetentionInDays: 14`, beside `BffLogs` and on its pattern
  (`ops/env.yml#L169-L174`); then `AccessLogSettings` on `ApiStage` (`ops/env.yml#L267-L275`), its
  `DestinationArn` the group's `Arn` and its `Format` one JSON object of `$context.requestId`,
  `requestTime`, `identity.sourceIp`, `httpMethod`, `path`, `routeKey`, `status`, `responseLatency`,
  `identity.userAgent` and `integration.error`. The group is declared, not assumed: API Gateway
  requires it to exist and imposes no name prefix. *Done when:* a new `check` in `ops/test.sh`'s
  template section reads `.Resources.ApiStage.Properties.AccessLogSettings` out of the `tojson` read
  at `ops/test.sh#L213` and matches, and `bash ops/test.sh` ends `0 not ok`. *Size:* 6 minutes.
  *Done 2026-11-08 13:06:* `ApiLogs` and `ApiStage`'s `AccessLogSettings` in `ops/env.yml`; two new `check`s in
  `ops/test.sh` (the stage's settings whole, and `ApiLogs`' name and 14 days); `ApiLogs` added to
  `ops/testdata/changeset-app.json`, which the layer-four change-set rows pin to the template's resource list.
  `ops/test.sh` has no `not ok` line: it ends `ops/test.sh: all checks passed`, exit 0
  (`logs/ops-test-83-step1-20261108-125647.log`). Red-first, each one mutation of `ops/env.yml` and a `cmp`-verified
  restore: the destination moved to `BffLogs`, the settings replaced by a comment naming them, and the caller cut
  from the format; each reddened the new check alone.
- [x] **2. The guard that reddens.** `api_log_guard`, on `bff_keys_guard`'s shape
  (`ops/test.sh#L305`): `must` for the destination being `ApiLogs` and for each of the five
  field groups of case 1 being in the format. `passes` on the real template, and `refuses` on three
  `mut` programs — the settings deleted, the destination moved to `BffLogs`, and the format with the
  caller cut. *Done when:* `bash ops/test.sh` shows the one pass and the three refusals and ends
  `0 not ok`; the run's check count is four higher than before. *Size:* 6 minutes.
  *Done 2026-11-08 13:16:* `api_log_guard` in `ops/test.sh` beside `bff_keys_guard`, on its shape (`must` over the
  parsed template, the format read with `fromjson`, never grepped): the stage has settings, the destination is
  `ApiLogs`, the format is a JSON object, and each of time, caller, path, route and answer is in it. One `passes` and
  three `refuses` (settings deleted, destination moved to `BffLogs`, caller cut). `ops/test.sh` prints no `0 not ok`:
  it ends `ops/test.sh: all checks passed`, exit 0, 533 ok lines, four more than step 1's
  (`logs/ops-test-83-step2-clean-20261108-131020.log`). Mutations of `ops/env.yml`, each run, red, restored and
  `cmp`-verified (`logs/ops-test-83-step2-mutations-20261108-131535.log`): the settings deleted with a comment naming
  `AccessLogSettings`, `DestinationArn`, `ApiLogs` and `$context` variables (guard and step 1's check red); the
  destination moved to `BffLogs`; the settings removed; and step 1's open gap closed, `ApiLogs` kept 30 days (its
  check red).
- [x] **3. The prose this makes false.** `ops/env.yml#L243-L244`'s comment; `docs/architecture.md#L287-L289`;
  `docs/client-readiness.md#L134-L152`, whose heading and whose "would leave no trace anyone could
  read afterwards" are both now wrong — the first because the stage logs, the second because the
  Lambda group already held a line per request when that page was written; its readiness list at
  `#L243-L245`, where the log half is done and the sign-in limit is not; and item 121
  (`docs/open-items.md#L781-L783`), rewritten down to the wall half alone, which stays the human's
  and stays parked. One new open item: the stage's line and the BFF's line are not joined, so no
  line names the client whose records were read. *Done when:*
  `grep -rn "no access log" ops docs --include="*.yml" --include="*.md" -i | grep -v "docs/plans/\|docs/recaps/"`
  reads 0 lines. *Size:* 6 minutes.
  *Done 2026-11-08 13:19:* the passages were found by their text, not the plan's lines, which had moved. `ops/env.yml#L250-L252` (the comment, two lines now, names `ApiLogs` and `BffLogs`);
  `docs/architecture.md#L287-L303` (the throttle citation moved to `ops/env.yml#L250-L252`, and a sentence on the two logs: the function's, on all along, and the stage's, in the template awaiting the change set);
  `docs/client-readiness.md#L134-L172` (heading, the quoted comment and its citation, and the bold sentence replaced by the two trails, each marked old or new and what is unverified) and its list's fourth entry (the sign-in limit alone, item 28; the log noted as split off);
  `docs/open-items.md#L781-L785` (item 121 now *partly closed*, readable half done and not yet on ridge, the wall left parked) and a new item 152 at the file's end (the record-level join, Low). The grep reads 0 lines; `glance.sh --check` passes. Documents only, no test run.
- [ ] **4. The local gate, whole.** *Done when:* `bash ops/test.sh` exits 0 and ends `ops/test.sh: all checks passed` (it prints no `0 not ok`), and
  `shellcheck -x ops/*.sh walk/*.sh` is clean; both tee'd into the root's `logs/`. cfn-lint needs
  pip and the network and is not run here — CI's `ops` job
  (`.github/workflows/ci.yml#L198-L203`) is its verdict on the push, as the tree guard's recap
  records. *Size:* 6 minutes.
- [ ] **5. The review, another model.** Read-only, against this plan's cases: that the format names
  nothing secret, that the guard fails for the right reason, and that no claim in the rewritten
  prose is stronger than the code. *Done when:* every finding is fixed, rejected or deferred with
  its reason, and `bash ops/test.sh` ends `0 not ok` after the last fix. *Size:* 7 minutes.
- [ ] **6. The recap and the products row.** `docs/recaps/2026-11-08-access-log.md` and its row in
  `docs/products.md`. *Done when:* both committed. *Size:* 2 minutes.

Machine total: about 33 minutes.

## The human's points

**1. The change set on ridge, after step 4.** A template change never rides a deploy; it is the
human's change set. Run `ops/stack.sh env ridge --plan` and read the changes — one log group added,
one stage modified, nothing else — then `ops/stack.sh env ridge`. A yes starts ridge recording every
call to its API. A no leaves the template change sitting in `main` with ridge unchanged, which
breaks nothing. If the change set fails on permissions, that is the first cause to look at: AWS lists
eight permissions for turning HTTP API logging on, and the identity executing the change set needs
all of them: `logs:CreateLogDelivery`, `logs:PutResourcePolicy`, `logs:UpdateLogDelivery`,
`logs:DeleteLogDelivery`, `logs:CreateLogGroup`, `logs:DescribeResourcePolicies`,
`logs:GetLogDelivery` and `logs:ListLogDeliveries`. **A second cause to look at:** the template gives
`DestinationArn: !GetAtt ApiLogs.Arn`, which returns an ARN ending in `:*`, and whether
`AccessLogSettings.DestinationArn` accepts that suffix is not documented either way, so nothing
local can settle it; the change set is what answers. If it is refused for that, the fallback is one
edit, replacing the value with
`!Sub arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/apigateway/credo-${Env}`.

**2. The lines themselves, after the change set.** There is no screen in this piece, so this is the
look that stands in for one. The deploy check already makes a client and signs in through the edge
on every run, so lines will be there; read the newest few of
`/aws/apigateway/credo-ridge` in the console. The address in a line is that of whoever opened the connection: the caller's own for a call
straight to the API's address (the item-121 case the log was built for), CloudFront's for a call
through the distribution, which is what the UI's and the deploy check's calls are, so those lines
show an edge node and not the caller. The question is whether a person who is not a programmer can
answer "when, over what path, and what did it answer" from one line, and "from whom" only for a call
straight to the API. A
yes closes the readable half of item 121. A no reopens step 1 to change the format's fields, which
is one property and another change set.
