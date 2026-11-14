# Each company opens at its own address on ridge

**Measured against the brief: its premise holds.** "Its own address" is one web address a company
on the one distribution, as the final architecture's part on the screens draws it (its network part
says nothing of addresses), and the routing by company already exists: the back end finds the
company by the code each call carries. Four corrections follow under
[what was measured](#what-was-measured).

## At a glance

| Who opens what | Today | After this piece |
| --- | --- | --- |
| a company's people | `https://<CloudFront's name>/login?client-code=acme` | `https://acme.<ridge's domain>/login` |
| the operator | `https://<CloudFront's name>/operator` | `https://operator.<ridge's domain>/operator` |
| the clients page shows | the link with the code in it | each company's own address |

A person opens their company's address. The screens read the company from the address and send its
code with every call, as they already do with the code from a link; the back end does not change.
The operator works at one address of their own, because a passkey is bound to the address it was
made at, and the operator's clients page hands out each company's address. What is added: the names
and one certificate on the distribution, the domain a setting of the stack and never in git; the
screens reading the address; the link maker; two codes kept back from companies; and the environment
check walking a company's own address. **Price:** $0 a month, about 85 of the machine's minutes, and
your acts: the domain, the certificate, two DNS records, one stack run, two pushes and a passkey.

## What was measured

- **The back end routes by company today and needs nothing.** `bff/src/app.ts#L160-L166`'s
  `resolveTenant` reads the code from the `x-client-code` header (`shared/src/wire.ts#L83`) and its
  index record on every client call; the screens take the code from the link
  (`ui/src/ClientApp.tsx#L73-L76`, `linkedCode`) or the device (`#L82`). The distribution forwards
  every viewer header but `Host` (`ops/env.yml#L377-L381`), so the back end cannot read the address,
  and under this piece it never needs to.
- **The passkey's address is a setting, not the request's host.** The final page says
  `registerOperatorAuth` takes it from the address's host; it takes it from `APP_ORIGIN`
  (`bff/src/routes/operator-auth.ts#L77`, and `bff/src/app.ts#L79-L81`: "never the request's host"),
  which `ops/app.sh#L130-L131` sets from the stack's `AppAddress` output (`ops/env.yml#L569-L570`).
  So moving that output to the operator's name moves the passkeys, `ops/operator.sh#L54-L57`'s join
  link and `ops/check.sh#L144`'s verdict with it, and no code changes.
- **Ridge holds no operator today** (`docs/recaps/2026-11-12-ridge-reup.md`, "no demo copy and no
  operator until the next ridge milestone"), so no passkey has to be replaced unless that milestone
  makes the operator before this piece's stack run; then `ops/operator.sh ridge --replace`.
- **The certificate cannot be in the stack.** CloudFront takes certificates from `us-east-1` alone,
  and every stack here is made in `ap-southeast-5` (`ops/lib.sh#L11`). It is yours, made once by
  command, and its identifier reaches the stack as a value, as the domain does.
- **The walks page is served at a three-part name** on Cloudflare Pages
  (`.github/workflows/walks.yml#L1`), and every operator page builds a company's link from its own
  address (`ui/src/pages/operator/AddClientPage.tsx#L31`, `ClientsPage.tsx#L51`). So the app must
  never read the browser's address by default, and the link maker must change in the screens, not
  only in the back end.

## The slice

One slice, walkable on ridge when the plan ends: you open `https://<a company's code>.<ridge's
domain>/login` and the sign-in wears that company's name; its root signs in; the operator opens
`https://operator.<ridge's domain>/operator`, signs in with a passkey made there, and the clients
page gives each company's own address. The environment check reads the same through a fresh check
company's own address on every deploy. A company's address works the moment the company is made,
since the DNS name and the certificate are wildcards: no record a company.

Not here: production's own domain (the production lane's, which takes the two settings this piece
adds); a redirect from `/operator` at a company's address (item 291); anything per box, since the
address carries the code and the pooled shape finds the box from the code's record.

## How each part is decided

- **The domain and the certificate are two settings of the stack, `Domain` and `CertificateArn`,
  both empty by default.** Empty, the distribution is exactly today's (CloudFront's own name and
  certificate), so the template lands and deploys with no effect until you set them. Set, the
  distribution answers `*.<Domain>` under that certificate (SNI only, TLS 1.2 of 2021), `AppAddress`
  becomes `https://operator.<Domain>`, and two new outputs give the domain and CloudFront's own name,
  the second for your DNS record. `ops/stack.sh` takes both from `CREDO_DOMAIN` and
  `CREDO_CERTIFICATE_ARN` on the run that sets them, keeps them on every other run (as
  `ops/stack.sh#L183-L195` keeps `Repository`), and refuses one without the other or a certificate
  outside `us-east-1`. `app_load` masks the domain with the other addresses
  (`ops/lib.sh#L717-L722`), so GitHub's public logs never show it. No resource is added: ridge's 21
  hold. *Rejected:* a certificate resource in a second stack in `us-east-1`, one more stack and
  Region for one thing you make in one command, whose DNS check waits on your hand in any case.
- **The address rule has one home, `shared/src/wire.ts`, beside `clientLinkPath` (`#L191`).** A
  name of three parts or more names the company of its first part, when that part is a company code
  (`shared/src/records.ts#L77`: a letter first, so an IP address never is) and is not kept back, and
  the name is not CloudFront's own. Anything else names none: `localhost`, an IP, the operator's
  name. It needs no domain, so the domain is written nowhere in the code. **On a company's address
  the address wins over a link and the device; elsewhere the link, then the device, as today.**
- **The address reaches the app from `ui/src/main.tsx#L39` alone, as a property.** Drawn without it,
  as every test and the walks page draw it, the app reads the link alone, so no picture and no test
  moves. *Rejected:* reading `window.location` inside the app, which would read the walks page's own
  name as a company and show the unknown-company screen in every scene.
- **The link maker** in the same file: from the operator's own address it gives
  `https://<code>.<the rest of the name>/login`; from any other (`localhost`, CloudFront's name) it
  gives today's `<address>/login?client-code=<code>`. The two operator pages and the local seed's
  printed line (`scripts/src/local.ts#L445`) call it; the back end's `link` path is unchanged. The
  operator's join links (`AddOperatorPage`, `OperatorLinkPage`) already sit on the operator's address
  and do not change.
- **Two codes are kept back, `operator` and `www`,** refused as taken in
  `bff/src/records/clients.ts#L56-L68`'s `createClient`, the one function the form, `ridge_cli
  tenant`, the generator and the demo seed all make a company through, so the form shows its
  existing "that code is taken" with no screen change.
- **The check walks a company's own address.** Where the stack names a domain, `ops/check.sh`'s
  fresh check company (`#L174-L180`) is read a second time through `https://<its code>.<Domain>`, by
  the same `edge_reads` (`ops/lib.sh#L859`); where it names none, the step says "skipped" by name.

## The cases

| # | The case: one behaviour, one sentence | Held by |
| --- | --- | --- |
| 1 | With no domain set, the distribution keeps CloudFront's own name and certificate and names no other | `ops/test.sh` |
| 2 | With a domain, it answers `*.<Domain>` under the given certificate, SNI only, at TLS 1.2 of 2021 | `ops/test.sh` |
| 3 | The app's address is `https://operator.<Domain>` with a domain and CloudFront's name without, and the template's label is the shared one | `ops/test.sh` |
| 4 | The stack run takes the two settings together, keeps them on an update, and refuses one alone or a certificate outside `us-east-1` | `ops/test.sh` |
| 5 | The domain is masked wherever the stack's outputs are read | `ops/test.sh` |
| 6 | A name of three parts names the company of its first; a shorter name, an IP, a kept-back code and CloudFront's own name name none | `shared/src/wire.test.ts` |
| 7 | On a company's address the app opens that company, whatever the link or the device holds, and the device keeps it | `ui/src/App.test.tsx` |
| 8 | Where the address names none, the link and then the device decide, as today | `ui/src/App.test.tsx` |
| 9 | Drawn with no address given, the app reads the link alone | `ui/src/App.test.tsx` |
| 10 | From the operator's address, the add and list pages give a company's own address; from any other, today's link | `wire.test.ts`, `AddClientPage.test.tsx`, `ClientsPage.test.tsx` |
| 11 | A kept-back code is refused as taken, by the form's route and by a script's create, and nothing is written | `bff/src/operator.route.test.ts`, `scripts/src/ridge.test.ts` |
| 12 | The local seed prints the company's own address when its origin is the operator's | `scripts/src/local.test.ts` |
| 13 | The check reads a fresh company's page, settings and sign-in through its own address, and says "skipped" where the stack names no domain | `ops/test.sh` |

## The steps

Sizes are the runs log's for the same shape: a template change with its guards 8 to 14 minutes, an
`ops/` script change 5 to 7, a shared function or a screen's change with its tests about 5 a part,
a review with its fix pass about 20, a recap 3 to 8. "The ops gate" is `CLAUDE.md`'s rows 3 to 5
(ShellCheck, cfn-lint, `bash ops/test.sh`); a package's gate is `pnpm --filter @credo/<pkg> check`,
plus the citation test at each commit. Steps 1 to 4 are the cheap build and the hardened one at
once: every case is a unit test or a template guard written beside its few lines, and the end to end
is ridge's check at step 7, which needs your acts.

**Why the stack's half comes first and lands alone.** `ops/stack.sh` reads the template from
`origin/main` (`ops/stack.sh#L141`), and your certificate and stack run are the long wait of this
piece; empty by default, the template's change is inert on ridge, so it can reach `main` at once
and your acts start while steps 2 to 6 are built. Those land together after your stack run, so the
deploy of their push sets the function's address to the operator's name and walks a company's own
address in the same run.

- [x] **1. The stack's half.** `ops/env.yml`: the two settings, the condition, the distribution's
  names and certificate under it, `AppAddress` and the two outputs, the comment above
  `Distribution`; `ops/stack.sh`: the settings taken, kept, refused; `ops/lib.sh`'s `app_load`: the
  mask; `ops/app.sh#L130`'s comment ("CloudFront's name, kept for good") made true. Cases 1 to 5.
  *Done when:* the ops gate's three commands exit 0, each new guard seen red once. Lands on
  `pre-merge` alone. **About 20 min**: the template and guards about 13, `stack.sh` about 7.
  *Done 2026-11-12 (commit 54194568):* `bash ops/test.sh` exit 0 on the final tree; ShellCheck (CI's form) exit 0;
  `cfn-lint ops/network.yml ops/github.yml ops/env.yml` exit 0 and `cfn-lint ops/env.yml --regions ap-southeast-5` exit 0.
  Each case seen red by one mutation, reverted, tree compared equal: 1 (a name kept under no domain), 2 (`vip` for
  `sni-only`), 3 (the app's address left as CloudFront's under a domain), 4 (the together-refusal removed from
  `stack.sh`), 5 (the domain's mask removed from `app_load`). Cases 2 and 3 were run alone, since one guard dies on
  the first fault and hides the next. Case 4 runs locally on the stand-in `aws`; no stack was touched. One fix in the
  writing pass: the stand-in's `describe-stacks` line lost a closing brace, which turned every stack run red (exit 5).
  cfn-lint's W1030 is ignored on `Distribution` (`ops/env.yml`) because the empty default fails the certificate's
  pattern, though the branch that reads it runs only when `Domain` is set and a Rule sets the two together.
- [x] **2. The screens read the address.** The rule and the link maker in `shared/src/wire.ts`;
  `App.tsx`'s property passed to `ClientApp.tsx`, whose `linkedCode` becomes address-first;
  `main.tsx` passes `location.hostname`; the two operator pages call the link maker, the add page
  keeping the code it sent;
  `ui/src/parts/ClientMade.tsx#L7`'s comment. Cases 6 to 10. *Done when:* `pnpm --filter
  @credo/shared check` and `pnpm --filter @credo/ui check` each end `== exit 0`, each case red once,
  and no file under `walk/` or `visual/` changes (`git diff --stat`). **About 12 min.**
  *Done 2026-11-14:* `pnpm --filter @credo/shared check` and `pnpm --filter @credo/ui check` each `== exit 0`
  (typecheck, eslint, prettier, tests at 100 %, knip all 0); `git diff --stat -- walk visual` empty. Each case seen red
  by one mutation, reverted, files compared equal: 6 (the kept-back check removed from `companyOfAddress`), 7 (the link
  read before the address), 8 (the first part taken from any name), 9 (a default address given to the app), 10 (the
  operator's branch of `clientAddress` made unreachable; its `startsWith` clause alone changes no test, since the
  three-part test also holds for the sample name). The address reaches `ClientApp` as the property `address`, passed
  by `main.tsx` only outside the fake build.
- [x] **3. The kept codes and the scripts' link.** `createClient`'s refusal; `local.ts#L445` through
  the link maker. Cases 11 and 12. *Done when:* `pnpm --filter @credo/bff check` and `pnpm --filter
  @credo/scripts check` each end `== exit 0`, each case red once. **About 8 min.**
  *Done 2026-11-14:* `pnpm --filter @credo/bff check` and `pnpm --filter @credo/scripts check` each `== exit 0`. Each case
  seen red by one mutation, reverted, files compared equal: 11 (the refusal removed from `createClient`: the route's test
  and the script's test both red), 12 (`local.ts`'s printed line back to the query form).
- [x] **4. The check through a company's own address.** `ops/check.sh`'s second `edge_reads` and
  its skip. Case 13. *Done when:* the ops gate's three commands exit 0, the case red once. **About
  7 min.**
  *Done 2026-11-14:* the ops gate's three commands exit 0 on the tree (ShellCheck, cfn-lint, `bash ops/test.sh`).
  The second read is `edge_reads_client` alone, not `edge_reads`: the six open reads' relying-party read compares the
  options' host with the base's, and a company's address is not the operator's host, so it would be red by design; it
  adds no customer (the log's one entry stays one). `CHECK_OWN_BASE` stands in for the company's address in the
  stand-in cases, whose edge has no name. The stand-in edge's sign-out is now undone by a new sign-in. Case 13 seen red
  by one mutation, reverted, file compared equal: the domain's condition made `false` (the second read vanished).
- [ ] **5. The review.** Another model reads the code, the tests and this table (QA's rule 5): one
  review, one fix pass, each finding tagged. *Done when:* every finding is tagged and each touched
  package's gate ends `== exit 0` after the fix pass. **About 20 min.**
- [ ] **6. The prose it makes false, and the recap.** `docs/architecture-detail.md`'s "The code comes
  from the screens, never from the address" and its intended "The address", `docs/architecture.md`'s
  "The address" line, `docs/memo/ui.md`'s price of a device's link (a company's address keeps its
  own device storage), open item 4's address sentence, `ops/README.md`'s stack run with the two
  settings and the certificate's commands; the recap and its `docs/products.md` row. *Done when:* the
  citation test passes alone and `git grep -nE '/Users/|~/'` finds nothing new. **About 10 min.**
- [ ] **7. Ridge, stage 4.** 👤 Your acts, in [the order below](#your-acts-in-order); 🤖 one one-off
  for the operator's link and the reads, and each log read whole. *Done when:* `ops/check.sh ridge`
  ends `== green` with the lines under "the check's company, through its own address:" ok, and your look is answered. **About 8 min**
  of the machine's.

Summed: about 85 minutes of the machine's.

## Your acts, in order

Each value in angle brackets is yours and goes into no committed file.

1. **The domain.** Recommended: `ridge.<your domain>`, so production can later take `*.<your
   domain>` on its own distribution without a clash.
2. **The certificate**, after step 1's plan is read: `aws acm request-certificate --region us-east-1
   --domain-name '*.<ridge's domain>' --validation-method DNS`; its validation record goes into
   Cloudflare as DNS only (no proxy); then `aws acm wait certificate-validated`.
3. **Your push** of `main` once step 1 is in it.
4. `CREDO_DOMAIN=<ridge's domain> CREDO_CERTIFICATE_ARN=<the certificate> bash ops/stack.sh env
   ridge --plan`: you will see one `Modify` of `Distribution`, nothing removed or replaced; then the
   same without `--plan`, ending on its verdict and printing CloudFront's own name.
5. **The wildcard record** in Cloudflare: `*.<the first part of ridge's domain>` to CloudFront's own
   name, DNS only.
6. **Your push** once steps 2 to 6 are in `main`: its deploy sets the operator's address and walks a
   company's.
7. **The operator's passkey**, from the one-off's link, opened at the operator's new address.

## The human's points

1. **At step 7: does a company open at its own address?** You open a ridge company's address, such
   as `https://<its code>.<ridge's domain>/login`, and see its sign-in in its name and colour; then
   the operator's address, where the clients page shows that same address for each company. It
   matters because this is the address a client's people will bookmark. A yes closes the milestone;
   a no reopens it at the screen that was wrong.

That is the one point: nothing here changes a screen's look, which the null proof of step 2 holds.

## Where it meets the other lanes

By the final page's order of work, these land before this piece and it takes `pre-merge` in before
each of its steps: the continuous copy, the activity log on ridge, the watch, and the door and the
keys. **The door and the keys' plan changes the same `Distribution`** (its back-end origin's
header and a parameter) and the same lines of `ops/stack.sh`'s environment case, `ops/lib.sh`,
`ops/check.sh`, `ops/test.sh` and `ops/README.md`; the continuous copy's and the watch's touch
`ops/env.yml`, `ops/stack.sh`, `ops/check.sh`, `ops/lib.sh` and `ops/test.sh` too. The one-company
storage client changes `createClient` first; the password wait changes `ui/src/ClientApp.tsx` in
another function. After this piece: the pooled shape (`createClient`, `shared/src/wire.ts`'s create
request, `ops/env.yml`) and production, which inherits the two settings. Open items in reach stay
with the lane that claims them (item 121, the API's own address, is the door's).

## The four stages

1. The cheap build: steps 1 to 4, each package's tests and the template's guards.
2. Verified locally: each step's gate, and the null proof that no walk or picture file moves.
3. A visual a non-coder judges: the at-a-glance table, then the look at step 7.
4. Ridge: step 7, the check through a company's own address and your look.
