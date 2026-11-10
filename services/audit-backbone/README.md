# audit-backbone

audit-backbone keeps an activity log: who did what to which record, and when.
A client's own system writes the entries; the client's web page reads them
back, by person or by record, with a token the system gives it for an hour.

Where it sits: the client's system → audit-backbone → one SQLite file, and the
client's browser reads it through a second door of its own. No credo piece
calls it yet. [credo's chart](../../README.md) shows both calls and what each
carries.

## Try it in 10 minutes

You need Go 1.25, `curl`, and Bruno, the API client that holds the requests:
the app, 3.0 or later, from [usebruno.com](https://www.usebruno.com/downloads),
or its CLI, `npm install -g --ignore-scripts @usebruno/cli@4.2.0`.

**1. Start it** from this folder, on a new database:

```sh
./scripts/dev-up.sh --fresh
```

It builds, starts in the background and prints its two doors: port 3190 for
the client's system, behind a key, and 3191 for the browser, behind a token.
`curl 127.0.0.1:3191/health` answers `{"status":"OK",…}`.

**2. Write two entries and read them back**, four requests in order. In the
app: **+** (top left) → **Open Collection** → this folder's `bruno/` →
**Open**; pick the `local` environment (top right); then send the four under
*Activities*: *Log Activities*, *Mint a Read Token*, *Get Activities by Actor*
and *Get Activities by Target*. The first writes two entries, as the client's
system would; the second gets the token a browser holds; the last two read
with it, everything that person did, then everything about that record. With
the CLI:

```sh
cd bruno && bru run 01-activities --env local
```

**3. Stop it**, and drop the database:

```sh
./scripts/dev-down.sh --purge
```

The two doors are two **listeners**: the keyed one writes and mints tokens; the
open one only reads, one tenant's entries per token.

## Next, by task

| You want | Read |
| --- | --- |
| every request and refusal, on both listeners | [`bruno/`](bruno/), one request per route and per refusal; its root, [`opencollection.yml`](bruno/opencollection.yml), the overview |
| what it holds | [`internal/activity/model.go`](internal/activity/model.go), then the SQL in [`store.go`](internal/activity/store.go) |
| how it is secured | [the listener is the boundary](docs/memo/the-listener-is-the-boundary.md), then [`internal/server/server.go`](internal/server/server.go) |
| where a change goes | [`CLAUDE.md`](CLAUDE.md): the rules a new route must follow. A route is its handler in `internal/activity/handler.go`, its registration in `internal/server`, its request in `bruno/`, its line in the route-list test |

## Before you change it

```bash
make check                    # the gate: format, vet, race tests at 100 % coverage, the box's build
./scripts/smoke.sh            # the real binary on two ports, every rule, kill -9, its exits
make dist BUILD_COMMIT=<sha>  # dist/credo-audit-backbone for the box; its /health answers <sha>
```

On a server, `PORT` is the keyed listener's port and `OPEN_PORT` the open
one's; `ACTIVITY_WRITE_KEY` is the keyed listener's key, `DB_PATH` the SQLite
file, and `LOG_LEVEL` is `info` unless set. Any mistake in them stops it at
start-up. No ship path builds or verifies it in this repository yet.

## Why it is built this way

For whoever maintains it: [why the listener is the boundary](docs/memo/the-listener-is-the-boundary.md),
[why the reader takes a token, and what it costs](docs/memo/the-reader-takes-a-token.md),
[why a 201 means committed](docs/memo/a-201-means-committed.md), and
[how old rows go](docs/memo/retention-is-a-predicate.md). [`CLAUDE.md`](CLAUDE.md)
holds the rules a new route must follow and the sandbox's traps.
