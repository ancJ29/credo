# credo
Stack: TypeScript on Node 26, one pnpm 12 workspace; c-storage in Go 1.26 · Gate: pnpm check; make check in c-storage/ · Ship: none yet

The new credo app: the same UI and a similar concept, rebuilt as UI → one BFF → c-storage.

## Non-obvious facts

- **Read [collaboration](docs/conventions/collaboration.md) before working here,
  [documentation](docs/conventions/documentation.md) before writing any doc, `CLAUDE.md` or
  comment, or committing any path, and [QA](docs/conventions/qa.md) before writing any test or
  feature plan.**
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
  server. In the agent's sandbox set `GOPROXY=off GOFLAGS=-mod=mod`; the helper sets `GOCACHE` under
  the temp folder when none is set.
- **Wire-contract code goes into the shared package, extended generically, not into a new
  standalone package per service.** The one shared package is `shared/`
  ([the app frame](docs/plans/2026-10-27-app-frame.md#the-stack)).
- **`pnpm stack -- <command>` is one invocation: up, the command, down.** The sandbox cannot signal a
  process an earlier command started. The command gets `CREDO_URL`, `CREDO_ROOT_NAME` and
  `CREDO_ROOT_PASSWORD`; the stack, never the BFF, holds c-storage's super-admin key and registers
  the BFF's service (a 409 is read by status, then the key is checked)
  ([the app frame](docs/plans/2026-10-27-app-frame.md#the-frame)).
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
