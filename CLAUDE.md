# credo
Stack: TypeScript on Node 26, one pnpm 12 workspace; c-storage in Go 1.26 · Gate: six commands, the whole list in [the gate](#the-gate) · Ship: c-storage and the app (the BFF and the UI, once the stack holds layer four) to ridge by GitHub Actions on a push to `main` or a press of `ci` on `main`; stacks in hand-written CloudFormation YAML, by the human's change sets, never CDK

The new credo app: the same UI and a similar concept, rebuilt as UI → one BFF → c-storage.

## The gate

Six commands cover this repository, and this is the whole list; which of them a step runs is
[QA](docs/conventions/qa.md#the-rules)'s rule 6. Each is run from the repository root unless its row
says otherwise.

| # | Command | What it covers | In CI |
| --- | --- | --- | --- |
| 1 | `pnpm check` | typecheck, eslint, prettier, every TypeScript package's tests at 100 %, knip, all through `ops/gate.sh` (`package.json`'s `scripts.check`) | `.github/workflows/ci.yml`'s step `name: pnpm check` |
| 2 | `make check`, in `services/c-storage/` | gofmt, `go vet`, the race tests at 100 % through `services/c-storage/scripts/cover.sh`, and the box's arm64 cross-compile (`services/c-storage/Makefile`) | `ci.yml#L69` |
| 3 | `shellcheck -x ops/*.sh walk/*.sh services/c-storage/scripts/*.sh` | every tracked `.sh`: `ops/`, `walk/run.sh` and `services/c-storage/scripts/` | `ci.yml`'s `ShellCheck 0.11.0` step, ShellCheck 0.11.0 |
| 4 | `cfn-lint ops/network.yml ops/github.yml ops/env.yml` | the three CloudFormation templates | `ci.yml#L198-L203`, cfn-lint 1.46.0 |
| 5 | `bash ops/test.sh` | the `ops` guards and the workflows' own shape; needs Ruby, Node and `pnpm install` | `ci.yml#L206` |
| 6 | `bash scripts/e2e.sh`, in `services/c-storage/` | the assembled server on a real socket against the Bruno collection; needs the Bruno CLI | `ci.yml#L97` |

A piece's own check at a commit is its package's `pnpm --filter @credo/<pkg> check` plus row 1's
citation test run alone, `pnpm --filter @credo/scripts exec vitest run src/citations.test.ts`, about
one second; for a change to `.md` files only that test is the whole check
([QA](docs/conventions/qa.md#the-whole-check-on-pre-merge)).

Rows 3 to 5 are what an `ops/` change needs, and `ops/README.md`'s "the ops job" runs them as the
operator's recipe. **Two checkers run only in CI**: row 6, which no local command invokes, and the
Lambda bundle's assertion under Node 24 — `bff/src/bundle.test.ts#L39` reads `BUNDLE_NODE`, which
only the `app` job sets (`ci.yml#L130-L136`), so locally that one assertion is skipped while row 1
otherwise runs whole.

## Non-obvious facts

- **Read [collaboration](docs/conventions/collaboration.md) before working here,
  [documentation](docs/conventions/documentation.md) before writing any doc, `CLAUDE.md` or
  comment, or committing any path, [code](docs/conventions/code.md) before adding or changing any
  code, and
  [QA](docs/conventions/qa.md) before writing any test or
  feature plan, and before running any check on this machine or writing its log.**
  **And for the big picture, read [`docs/architecture.md`](docs/architecture.md)'s `## At a glance`
  and `## One request, end to end` — two short sections which are the whole system — then
  `## What each part is for` and `## What is never there` for your piece's part and what it must not
  break. That part's own `CLAUDE.md` holds its internals; where a thing lives is
  [`docs/architecture-detail.md`](docs/architecture-detail.md)'s `## The codemap`, and that page's
  other sections only as your piece needs them, and that page whole only when the piece crosses a
  layer.**
- **Every session in a piece's worktree runs [the session skill](.claude/skills/session/SKILL.md)**:
  the plan read first, one step, its tick and its evidence in the recap, then the stop.
- **One bare repo, many worktrees**, all under `$ROOT_DIR`, the folder that holds `.bare`. `main`
  is the trunk and only receives fast-forwards, from `pre-merge`, to a commit its whole check has
  passed; `pre-merge` receives each finished piece's merge, and each piece works on its own branch,
  started from `pre-merge`'s tip, in its own worktree ([QA](docs/conventions/qa.md#the-whole-check-on-pre-merge)).
  The worktrees share one stash stack, so never run a bare `git stash`. The `orchestrator` branch
  holds the orchestrator's board. It never takes `main` in, and reaches `main` only as one squash
  merge, when the human says.
- **Records link by the server-minted id**, with a code snapshot beside it for the reader. A code
  is a label the client may change.
- **Recover, never bypass, a concurrency token.** Keep every token; on a false conflict re-read
  and retry a bounded number of times; a genuine conflict on the record still surfaces.
- **A field added to a contract whose halves deploy apart** gets a default at the client's wire
  boundary in the same commit.
- **`pnpm check` needs Go and loopback ports:** the BFF's route tests build the real c-storage with
  `go build` and run it per test file (`bff/tests/`), so the product's own client meets the real
  server. In the agent's sandbox set `GOPROXY=off GOFLAGS=-mod=mod`. One helper, `bff/tests/build.ts`,
  builds c-storage for the route tests and for `pnpm stack` alike, and sets `GOCACHE` under the temp
  folder when none is set.
- **`pnpm demo -- <command>` is `pnpm stack` with the demo seed's copies on it**
  ([the plan](docs/plans/2026-10-29-demo-seed.md)). Every copy of `scripts/src/demo/mapping.ts` (or one
  partner's, by `CREDO_DEMO_PARTNER=p1`) is made by the operator's create, filled as of four days ago
  and run three days to yesterday. The command gets `CREDO_URL`, the operator's two variables and
  `CREDO_COPIES` (JSON: each copy's code, partner, scenario, company, `rootName` and `rootPassword`);
  without one, the links and the root passwords are printed once.
- **Wire-contract code goes into the shared package, extended generically, not into a new
  standalone package per service.** The one shared package is `shared/`
  ([the app frame](docs/plans/2026-10-27-app-frame.md#the-stack)).
- **`pnpm stack -- <command>` is one invocation: up, the command, down.** The sandbox cannot signal a
  process an earlier command started. The command gets `CREDO_URL`, `CREDO_CLIENT_CODE` (the demo
  client's), `CREDO_ROOT_NAME`, `CREDO_ROOT_PASSWORD`, `CREDO_OPERATOR_NAME`
  (the data set's active operator),
  `CREDO_OPERATOR_HANDLE` (the data set's active operator's session, kept on the device in place of a
  sign-in, so no ceremony stamps today on the passkeys the list shows), `CREDO_OPERATOR_PASSKEY` (JSON: the
  first of those passkeys as a walk can touch it, `{ id, privateKey, userHandle }`, a pair minted per stack and
  never committed or printed), `CREDO_OPERATOR_LINK` (the
  invited operator's one-time join link, at `http://localhost:<port>`, since a
  passkey is bound to a name and no IP address has one), `CREDO_PEOPLE` (JSON: each data-set
  person's code to a first password), `CREDO_SEED_URL` (a `POST` makes another client from the data set, the one door a walk has to a client
  of its own) and `CREDO_AUDIT` (JSON: the audit service's two addresses and key, and c-storage's, for
  `pnpm local activity <client code> <record id>`; never printed); the stack, never the BFF, holds c-storage's super-admin key and registers
  the BFF's service (a 409 is read by status, then the key is checked)
  ([the app frame](docs/plans/2026-10-27-app-frame.md#the-frame)).
- **An order's day is the page's, never the BFF's clock** (`localToday()` in `ui/src/day.ts`): the fake
  build and a walks-page scene are given the data set's `DEMO_TODAY`, and the walk fixes the browser's
  clock at it, so no picture holds the day it was taken on
  ([the plan](docs/plans/2026-10-31-orders-delivery.md#what-it-holds)).
- **A client's own data goes in `extra`, never in a new typed field,** unless the BFF or c-storage must
  trust it; `extraSchema` in `shared/` is the one bound ([extra](docs/memo/extra.md)).
- **`pnpm fake -- <command>` serves the UI alone over invented data: no BFF, no c-storage.** It builds
  the UI with `vite build --mode fake`, the one build that holds `?fake`, the fake `Api`
  (`ui/src/fake.ts`) and the data set (`@credo/shared/demo`, a subpath never in the package's index);
  the bundle `pnpm stack` and ridge serve holds none of them. The command gets `CREDO_URL` and
  `CREDO_CLIENT_CODE`; without one, it prints the address to open (`/?fake`, optionally
  `&cue=<call>:<403|409|503>` to make that call fail once; the tab keeps the switch, so a reload stays
  on the fake) and waits for Ctrl-C
  ([the employee list](docs/plans/2026-10-29-employee-list.md#the-fake)).
- **The walk spec (`walk/`) needs a browser, so it runs in the human's terminal, never in the
  agent's sandbox,** where Chromium cannot start. `pnpm check` typechecks and lints it and does not
  run it; its base images are made by the human's run, once a piece, on one Mac
  ([the visual report](docs/plans/2026-10-28-visual-report.md#where-it-runs)). **One command runs any
  walk: `bash walk/run.sh <walk>… [--moved <screen>,…|all] [--write]`**: fake, stack and stack again
  (the walks in three lanes at once; the full run's second pass is a byte compare of the first),
  then every moved pixel counted raw (no tolerance) between them and against the bases
  ([the plan](docs/plans/2026-10-31-walk-steady.md#the-script)).
- **`pnpm report` builds the walks page in the sandbox, no browser,** into the credo root's `walks/`
  (one folder a build, never committed). The screens are drawn on jsdom through a Vite server's
  module loader, since the app's CSS modules and TSX do not import in plain Node; the page itself is
  bundled as a production build whatever `NODE_ENV` the process has, or it ships the development
  JSX transform with every source path in it
  ([the visual report](docs/plans/2026-10-28-visual-report.md#where-it-runs)).
