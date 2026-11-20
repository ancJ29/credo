# First-time setup

This page is for someone new to the code, on a machine with nothing of credo on it. After it you have the tools, the code and its packages, and you have seen the app run once.

You do this once. Each step after the first is a block to copy and paste, with what you will see under it.

## 1. Install the tools

| Tool | Version | What needs it |
| --- | --- | --- |
| Node | 26 | Everything written in TypeScript: the app, its scripts and its checks |
| pnpm | 12 | The packages, and every command of the project |
| Go | 1.26 | The two services: the storage and the activity log |
| ShellCheck, cfn-lint and Ruby | 0.11.0, 1.46.0, any | Only a change to the scripts that run the machines. [The gate](partners/words.md#gate), the check that must pass before work is accepted, says which of its steps use them |

Each exact version is written in the project itself:

```text
Node   the file .node-version, at the project's top
pnpm   the packageManager line of package.json
Go     the toolchain line of services/c-storage/go.mod
```

Working on [ridge](partners/words.md#ridge), our shared test copy, needs a few more tools. [The operator guide](operator-guide.md#what-the-terminal-needs) lists them.

## 2. Get the code

The project is one bare repository, a copy with no files checked out, and beside it a [worktree](partners/words.md#worktree) for each branch: a folder that holds one branch. The branch [main](partners/words.md#main), which holds only checked code, comes first. Run this from the folder that should hold it. Put the repository's address from GitHub in place of the address marker:

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

Bring your own copy of the app up with [step 1 of the quick start](quick-start.md#1-bring-it-up). It ends by printing the address to open and a sign-in for its demo company. After that, the quick start is the page for running that copy day to day.
