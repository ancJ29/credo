# The legacy capture helper, recap, 2026-11-04

## At a glance

`ops/legacy-capture.sh` signs in to the legacy app as its root, in the human's terminal, and pictures
each screen a file names, on a PC and a phone. It only opens, never saves. It was built for line 57's
comparison and difference page, whose answers then opened line 58. Left to the human: the merge's push.

## What shipped

- The script, its Playwright part and the screens file for the employee feature (`679cab4`). The
  address is on the command line only; the root's name and password are typed at a prompt and reach
  Node on a pipe, never logged.
- After the credential review (`50a2146`): the legacy sends every call as one POST in an envelope, so
  a route reads the envelope and lets through only GET, HEAD and four read routes; the rest are aborted
  and listed as `blocked`; service workers are blocked. Four Mediums fixed.
- The legacy's tunnel seed stays out of git: `--tunnel-seed-from <file>`, read at run time
  (`835584f`).

## Rejected, and the price

- Three sign-in fixes, each a different stop: the form's own submit (`09d4891`), fields found by type
  (`e1e753f`), and waiting for the form to be drawn (`39b05f2`). Cost: three runs of the human's terminal.
- Pictures in git: no, they show a client's real people. Cost: they live outside the repo.

## Evidence

- The human's run, 11-04 12:51, green: nine pictures on PC and a phone, and one write blocked (the
  legacy's permission-mismatch POST on opening a screen):
  `logs/20261104-1251-legacy-employees-capture.log`.
- A history grep for the tunnel seed found 0.
- No review Lows are written down in the branch, so no open items were added.
