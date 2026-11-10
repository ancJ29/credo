# bff
Stack: Fastify on Node, one app built for a listener and for Lambda · Gate: `pnpm check` from the root, which runs this package's typecheck, lint and tests at 100 % · Ship: the Lambda bundle, arm64, in the VPC

The one back end of the UI: it resolves the company, who is calling and what they may do, then
reads or writes records in c-storage. It holds no state of its own.

## What belongs here, and what does not

- **A route, its authorisation and the reads and writes of a record kind** belong here. Whether
  someone may do a thing is decided here, on every call, and the UI's display is never the guard.
- **A name, bound, status meaning or wire shape belongs in `shared/`**, imported, never declared
  here a second time.
- **A client's own difference is not coded here:** data a client owns goes in `extra`, which this
  package stores untouched ([the memo](../docs/memo/extra.md)).
- **Storage is reached only through the client `bff/src/server.ts`'s `buildBff` makes;** there is
  no `fetch` anywhere in `bff/src`, and a route never builds its own.

## The directories of `bff/src`

Each finishes "everything in here is a ___", by [`code.md`](../docs/conventions/code.md)'s C17; a
directory not on this list is not a directory, and a file with no sentence stays at the top. There
is no `index.ts` in any of them, and no directory for configuration, connections or middleware: each
was measured and has one file or two.

- **`routes/`**: one kind of record's routes and the authorisation of them, a `register*Routes`
  function `buildApp` registers (`bff/src/routes/staff.ts`'s `registerStaffRoutes`), with the
  test of each beside it.
- **`records/`**: the reads and writes of a record kind, with no route in it
  (`bff/src/records/staff-records.ts`).
- **`calling/`**: how the back end knows who is calling and lets them prove it: the session, the
  challenge, the password, the constant-time compare (`bff/src/calling/sessions.ts`).
- **The top level**: the app, how it is run and how it is shipped, which the package's published entries,
  its coverage exclusions and `knip.json` name by exact path (`bff/src/app.ts`'s `buildApp`,
  `bff/src/main.ts`), and `bff/src/errors.ts`, which belongs to no one group.

A test sits beside its subject, and beside the app where the subject is the app: the route tests of
the routes `buildApp` declares inline stay at the top (`bff/src/auth.route.test.ts`).

## The file to copy

- **A route module:** `bff/src/routes/staff.ts`'s `registerStaffRoutes` for the order, registered from
  `bff/src/app.ts`'s `buildApp` with the same `deps`.
- **A record kind's reads and writes:** `bff/src/records/staff-records.ts`, one function per read, a record
  that does not parse thrown as a fault.
- **A route's test:** `bff/src/routes/employees.route.test.ts`, which starts c-storage with
  `bff/tests/c-storage.ts`'s `startCStorage` and signs in through `bff/tests/staff.ts`'s
  `staffTenant`.
- **An answer the caller reads:** `bff/src/errors.ts`'s `HttpError`, thrown, and `parse` for a body.

## This package's own rules

None minted: [code](../docs/conventions/code.md) governs this package, and a reviewer invokes it
by these headings.

- **The winner, named**: a handler that touches storage inline, writes its own error reply or
  runs its steps out of order, and a new route added to `staff.ts` or `orders.ts`.
- **One home for one decision**: a bound, a name or a "list under a prefix" written out again.
- **The patterns to copy**: storage reached any way but the one client.
- **Where a client's difference lands**: a route that branches for one company.

## Non-obvious facts

- **Only a 401 signs the UI out, so an outage is never one:** any c-storage failure is 503, what
  no route expected is 500 with nothing of its cause, and a c-storage 400 is this package's own bug
  (`bff/src/errors.ts`'s `replyFor`).
- **The company is resolved first, and that authenticates no one:** `buildApp`'s `resolveTenant`
  runs before the body is read and before any session.
- **A record that does not parse is a 500 naming its kind and never its key,** and a person is
  never skipped (`bff/src/records/staff-records.ts`'s header comment).
- **A branch reached only by a race is covered by a test that forces the interleaving,** never by
  a second racing request or a coverage hint, which pass locally and fail on a loaded runner
  ([the memo](../docs/memo/2026-11-07-deploy-gate-red.md#red-a-bff-coverage-at-bffsrcroutesoperator-authts326-11-06)).
- **The `*-main.ts` entries and `main.ts` hold wiring only and are outside the coverage count;**
  the logic they call is tested in `server.test.ts`, `lambda.test.ts` and `bundle.test.ts`
  (`bff/vitest.config.ts`). A new entry with logic in it is uncounted and unchecked.

## Where the rest is

- The big picture: [`architecture.md`](../docs/architecture.md#at-a-glance).
- The cross-package rules: [`code.md`](../docs/conventions/code.md).
- The sibling to copy: [`ui/CLAUDE.md`](../ui/CLAUDE.md), the other half of the same wire.
