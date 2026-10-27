# credo
Stack: TypeScript on Node 26, one pnpm 12 workspace; c-storage in Go 1.25 · Gate: pnpm check; make check in c-storage/ · Ship: none yet

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
