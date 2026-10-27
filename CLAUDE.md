# credo
Stack: not chosen yet · Gate: none yet · Ship: none yet

The new credo app: the same UI and a similar concept, rebuilt as UI → one BFF → c-storage.

## Non-obvious facts

- **Read [collaboration](docs/conventions/collaboration.md) before working here, and
  [documentation](docs/conventions/documentation.md) before writing any doc, `CLAUDE.md` or
  comment, or committing any path.**
- **One bare repo, many worktrees**, all under `$ROOT_DIR`, the folder that holds `.bare`. `main`
  is the trunk and only receives merges; each piece works on its own branch in its own worktree.
  The worktrees share one stash stack, so never run a bare `git stash`. The `orchestrator` branch
  holds the orchestrator's board and never merges with `main`.
