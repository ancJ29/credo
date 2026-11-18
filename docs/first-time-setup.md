# First-time setup

What you do once on a new machine, before anything else: install the tools, get the code, install
its packages, then bring the app up once to see that it works. Each step after the first is a block
to copy and paste, with what you will see under it.

## 1. Install the tools

| Tool | Version | What needs it |
| --- | --- | --- |
| Node | 26 (`.node-version` names the exact one) | everything written in TypeScript: the app, its scripts and its checks |
| pnpm | 12 (`package.json`'s `packageManager` names the exact one) | the packages, and every `pnpm` command |
| Go | 1.26 (`services/c-storage/go.mod`'s `toolchain`) | the two services: the storage and the activity log |
| ShellCheck, cfn-lint and Ruby | 0.11.0, 1.46.0, any | only a change to `ops/`, rows 3 to 5 of [the gate](../CLAUDE.md#the-gate) |

Working on ridge needs a few more, which [the operator guide](operator-guide.md#what-the-terminal-needs) lists.

## 2. Get the code

The project is one bare repository with a folder for each branch beside it, `main` first. From the
folder that should hold it, with the repository's address from GitHub in place of `<address>`:

```sh
mkdir credo && cd credo && git clone --bare <address> .bare && git --git-dir=.bare config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*' && git --git-dir=.bare fetch origin && git --git-dir=.bare worktree add main main
```

You will see git copy the repository, then `Preparing worktree (checking out 'main')`.

## 3. Install the packages

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && pnpm install
```

You will see pnpm fetch and link the packages, ending in a summary of what it installed.

## 4. See it work

Bring your own copy of the app up: [step 1 of the quick start](quick-start.md#1-bring-it-up). It ends
by printing the address to open and a sign-in for its demo company. The quick start is then the page
for running that copy from day to day.
