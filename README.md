# Credo - Single Platform for SME Orders and Deliveries

Credo is a web app that runs the daily orders and deliveries of small and medium businesses, from the
office that takes an order to the driver who delivers it. One system serves many client companies at
once, each seeing only its own people and records. Each company makes the app its own through
settings, such as its name, logo, colours and the staff details it keeps, rather than through code
written for it.

## Get started

New to the project? Begin with [first-time setup](docs/first-time-setup.md): the tools to install,
the code and its packages, and the app brought up once on your own machine. After that, the table
below names the page for each next question, from how the system is built to where to look when
something goes wrong.

| Page | Includes |
| --- | --- |
| [`docs/architecture.md`](docs/architecture.md) | the system at a glance · one request end to end · what each part is for · where a tenant's records live · what is never there |
| [`docs/quick-start.md`](docs/quick-start.md) | bring your copy up · add a demo company · see what runs · stop it · read a record's changes · take it away |
| [`docs/products.md`](docs/products.md) | the app · the operator console · the walk · the demo set · the tooling · checking a piece on ridge · known gaps |
| [`docs/README.md`](docs/README.md) | putting a changed record back · a bug's first fifteen minutes · the logs · every document · the order to read them |
| [`docs/operator-guide.md`](docs/operator-guide.md) | once, the first time · everyday · a change to ship · a client · operators · ridge down and back · something wrong · restore · more boxes |
| [`docs/open-items.md`](docs/open-items.md) | everything still to do, numbered |
| [`CLAUDE.md`](CLAUDE.md) | for coding sessions · the gate's seven checks · the facts the code does not show |

## What each folder is

Each folder at the root is part of the app that ships, the tooling around it, or its tests.

| Folder | Kind | What it is |
| --- | --- | --- |
| [`ui/`](ui) | app | the browser (ships) |
| [`bff/`](bff) | app | the UI's one back end (ships) |
| [`services/`](services) | app | the Go services (ship) |
| [`shared/`](shared) | app | the wire contract |
| [`ops/`](ops) | tooling | ridge, the hosting account, the gate |
| [`scripts/`](scripts) | tooling | the machine's own commands |
| [`.github/`](.github) | tooling | the CI workflows |
| [`.claude/`](.claude) | tooling | the coding sessions' skills |
| [`walk/`](walk) | tests | the browser walks |
| [`visual/`](visual) | tests | the walks page |
| [`docs/`](docs) | pages | the conventions, memos, plans and recaps |

## Where to look

A question on the left, the page that answers it on the right: each kind of note and fact has the
one home named here, and every other page points to it
([the rule](docs/conventions/documentation.md#one-fact-one-home)). A home outside `main` (the
orchestrator branch, the sessions' own worktree; the kit's rules every project shares; a session's
memory) is named with where it is, since no link on `main` reaches it.

| You want to know | Open |
| --- | --- |
| how to deploy a change | [docs/operator-guide.md, "Deploy a change"](docs/operator-guide.md#deploy-a-change) |
| how sign-in works | [docs/architecture.md, "One request, end to end"](docs/architecture.md#one-request-end-to-end) |
| how to read a partner's returned words in | [docs/operator-guide.md, "Read a partner's returned words in"](docs/operator-guide.md#read-a-partners-returned-words-in) |
| what is still to do | [docs/open-items.md](docs/open-items.md) |
| what you, the human, have to do now, and the command for each | worktrees/glance.md and worktrees/next-actions.md on the orchestrator branch; a command an operator repeats is in [docs/operator-guide.md](docs/operator-guide.md) |
| where one piece stands now | its own file, worktrees/pieces/ on the orchestrator branch; every board page is drawn from it |
| what a run cost in minutes and size | worktrees/runs.tsv on the orchestrator branch, one row a run |
| how sessions work, a rule that holds in every project | the kit's rules.md, outside this repository; credo's own rules are in [docs/conventions/collaboration.md](docs/conventions/collaboration.md), and a session's memory points to them and holds neither |
| how a part is built, a fact about the architecture | [docs/architecture-detail.md](docs/architecture-detail.md); [docs/architecture.md](docs/architecture.md) summarises it |
| how code is written here | [docs/conventions/code.md](docs/conventions/code.md) |
| what a partner may read | [docs/partners/](docs/partners/README.md) |
| what is being built now, and in what order | [docs/products.md, "Next, in order"](docs/products.md#next-in-order) |
| what we decided, and why | [docs/decisions.md](docs/decisions.md), newest first |
| what runs on ridge now | [docs/products.md](docs/products.md), its first lines |
| what the machine has learned, by kind of task | worktrees/skills/ on the orchestrator branch, a folder for each kind of task with its SKILL.md |
| these pages in one site, for partners | [site/CLAUDE.md](site/CLAUDE.md); `.github/workflows/docs.yml` builds it on a change and publishes it from `main` |
| every place credo keeps what it knows | [docs/README.md, "The documents, and what each answers"](docs/README.md#the-documents-and-what-each-answers) |
