# credo
Stack: TypeScript on Node 26, one pnpm 12 workspace; c-storage in Go 1.26 · Gate: pnpm check; make check in c-storage/ · Ship: c-storage and the app (the BFF and the UI, once the stack holds layer four) to ridge by GitHub Actions on a push to `main`; stacks in hand-written CloudFormation YAML, by the human's change sets, never CDK

The new credo app: the same UI and a similar concept, rebuilt as UI → one BFF → c-storage.

## Non-obvious facts

- **Read [collaboration](docs/conventions/collaboration.md) before working here,
  [documentation](docs/conventions/documentation.md) before writing any doc, `CLAUDE.md` or
  comment, or committing any path, and [QA](docs/conventions/qa.md) before writing any test or
  feature plan.**
- **Every session in a piece's worktree runs [the session skill](.claude/skills/session/SKILL.md)**:
  the plan read first, one step, the tick with its evidence, then the stop.
- **One bare repo, many worktrees**, all under `$ROOT_DIR`, the folder that holds `.bare`. `main`
  is the trunk and only receives merges; each piece works on its own branch in its own worktree.
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
  client's), `CREDO_ROOT_NAME`, `CREDO_ROOT_PASSWORD`, `CREDO_OPERATOR_NAME`,
  `CREDO_OPERATOR_PASSWORD`, `CREDO_PEOPLE` (JSON: each data-set person's code to a first password) and
  `CREDO_SEED_URL` (a `POST` makes another client from the data set, the one door a walk has to a client
  of its own); the stack, never the BFF, holds c-storage's super-admin key and registers
  the BFF's service (a 409 is read by status, then the key is checked)
  ([the app frame](docs/plans/2026-10-27-app-frame.md#the-frame)).
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
  ([the visual report](docs/plans/2026-10-28-visual-report.md#where-it-runs)).
- **`pnpm report` builds the walks page in the sandbox, no browser,** into the credo root's `walks/`
  (one folder a build, never committed). The screens are drawn on jsdom through a Vite server's
  module loader, since the app's CSS modules and TSX do not import in plain Node; the page itself is
  bundled as a production build whatever `NODE_ENV` the process has, or it ships the development
  JSX transform with every source path in it
  ([the visual report](docs/plans/2026-10-28-visual-report.md#where-it-runs)).
