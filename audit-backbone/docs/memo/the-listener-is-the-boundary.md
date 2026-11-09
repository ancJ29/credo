# The listener is the boundary

**Decided** 2026-08-31. **Amended** 2026-10-04 (trimmed; ported to opus with
one key, `/health` on both listeners, loopback binding); 2026-10-16 (a gate on
each mux, the read token on the open one).

A reader a browser calls and a keyed writer share one process, so "a browser's
token cannot write" has to be a fact about the code. It is made structural,
not conditional: two muxes on two ports, and a keyed route is unreachable from
the open port because it is not registered there. A routing bug on the open
side cannot reach the writer or the mint.
`TestNoKeyedRouteIsReachableOnTheOpenListener` sends each keyed route to the
open handler *with the key and a token*, so a 404 cannot be a gate passing by
accident. `TestEveryRegisteredRouteIsListed` fails when a pattern is
registered that the test's route lists do not name, so a new route cannot
escape the boundary tests.

**Rejected: one mux, with the open routes exempted from the gate by path.**
The exemption is a condition that can evaluate the wrong way. A registration
on the wrong mux is one visible line.

**Rejected: one process per door.** It would keep full isolation, for no
reader who asked for it. **The price:** reader and writer share a process and a
database file. What the compiler still checks is that `activity.Reader` has
no write method, and the open mux is handed only a Reader. **Trigger to
revisit:** a second team, or a deployer who is not trusted, touching the box.

**One gate in front of each whole mux, the 404 fallback included:** the key on
the keyed, the read token on the open. Without it, an unknown path answers 404
where a real one answers 401. That pair is a route oracle: a caller with no
credential could map the surface by comparing status codes. A per-route check looks correct one route at a time.
Only the assembled listener shows the leak, and `scripts/smoke.sh` is what
found it.

**No 405 anywhere.** A 405 confirms that a path exists, and a read token sits
in the browser of everyone on the client's staff, people the key is kept from.
The catch-all also suppresses net/http's own 405, so a wrong verb on a real
route reads as 404. That cost is priced and accepted.

**`/health` on both listeners, two fields.** After a ship, `opus/ops/verify`
reads `buildVersion` on every hostname in the app's row, so the door callers
use is the door verified. It is the one answer before either gate, and only
for GET; the open listener's preflight is the other. The platform once had a health
body that leaked its environment. The answer is a test that pins the body to
`status` and `buildVersion`, not leaving the route out.
*Rejected:* verify reading the unit's journal. That is a second kind of
verdict for one app, and verify would stop reading what callers see.

**Both listeners bind 127.0.0.1.** Caddy on the same box is the one public
door, with one hostname per listener. *Rejected:* binding every interface and
trusting the box's firewall, which this binary cannot check.
`TestListenersBindLoopbackOnly`.
