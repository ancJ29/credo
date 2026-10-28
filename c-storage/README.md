# c-storage

c-storage keeps small JSON records for the BFF, each under its own service. It is one Go binary
with one SQLite file and one listener, on one address (loopback unless `LISTEN_ADDR` says otherwise), with five routes. Why it is built
so is in [the memo](../docs/memo/c-storage.md).

## Try it in 10 minutes

You need Go 1.26 (the `toolchain` line in `go.mod` fetches it) and Bruno CLI 4.2.0 (`npm install -g @usebruno/cli@4.2.0`, then `bru --version`).

**The whole check, one command**, from this directory. It builds the server, starts it on a fresh
database, runs the [Bruno collection](bruno) against it, checks the process's exits (a bad
configuration, a port already taken, SIGTERM) and stops it. This is what the `e2e` job in CI runs.
It exits non-zero if any request or assertion fails, if a request file did not run, pass and
assert, if the port is already taken, or if an exit is wrong.

It also writes an HTML report a reviewer can read without the code: in the credo root's `logs/`
folder as `c-storage-e2e-report.html` (set `E2E_REPORT` to put it elsewhere), and it prints the
path. Open it with `open <path>`. In CI it is the `c-storage-e2e-report` artifact of the run, kept
14 days, failed runs included. It carries no key, and the script fails if it finds one.

```bash
bash scripts/e2e.sh
```

**By hand, to debug.** Start the server on a fresh database:

```bash
dir=$(mktemp -d)
go build -o "$dir/c-storage" ./cmd/server
PORT=3181 DB_PATH="$dir/records.db" \
  INTERNAL_ACCESS_KEY=dev-internal-access-key X_SUPER_ADMIN_KEY=dev-super-admin-key \
  "$dir/c-storage"
```

Then open the collection in the Bruno app: + → Open Collection → this directory's `bruno` folder →
pick the `local` environment (top right) → send a request or run the folder. Stop the server with
Ctrl-C. Start the next try with a new `mktemp -d`: the collection registers its service on its first
request, and a second run against the same file answers 409 there.

The collection's keys are loopback development keys, not secrets; `bruno/environments/`
git-ignores any other environment.
