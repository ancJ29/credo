# The reader takes a token

**Decided** 2026-08-17, the reader open. **Amended** 2026-10-16: closed by a
read token, on the owner's yes that a browser reads the client's log.

The two feeds read with a token the client's system mints on the keyed
listener, `POST /api/read-tokens {clientId}`, and hands its browser. The token
reads one tenant for an hour, and the feeds take the tenant from it alone: a
`clientId` in the query names nothing (`TestAFeedReadsTheTokensTenantAlone`).
The browser never holds the key, and a token neither writes nor mints.

**Why closed.** Open, any `clientId` was readable by whoever reached the
hostname, and a client env's hostname is public the day its certificate is
issued, through the transparency logs. *Rejected:* a static key on a door a
browser calls, shipped in every bundle; a BFF's token, with no BFF on a
client's box; the reader left open.

**An HMAC, not a session.** HMAC-SHA256 over the tenant and the expiry, under a
key derived from `ACTIVITY_WRITE_KEY`: the box keeps no state, and the service
key signs nothing a browser holds. **Price:** no revocation. A leaked token
reads its tenant until its hour ends; the only earlier end is a new key, which
ends every token, and the client's writes until its system holds the key. The
client's system mints at least hourly.

**CORS allows every origin, on GET with `authorization`.** A browser never
sends a bearer token by itself, so a named origin guards nothing the token does
not, and client UIs sit on domains no list keeps up with. A preflight answers
before the gate, since a browser sends it without a credential, and a 401
carries CORS, so a browser sees its spent token refused and mints again.
*Rejected:* CORS in Caddy, which would put the app's wire contract in `ops/`
(principle 4).

**No rate limit.** The reader shares the box's CPU and disk with the writer,
so a flood is an availability problem. A read without a token costs one HMAC,
with one an indexed query, and stock Caddy has no limiter. *Rejected:* a
limiter in the binary, acting only after Caddy has paid for TLS, at a number
never measured against a caller. **Trigger:** the owner's direction of
2026-10-16, reads about 500 a minute and writes limited too, when a block takes
it; or a flood that was measured.
