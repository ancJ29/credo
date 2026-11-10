# Part D of the operator console: a client's root password, set anew, recap, 2026-11-03

## At a glance

[The plan](../plans/2026-11-01-console-root-password.md), steps 1 to 9 are done on `console-root-password`. An
operator can now give a client's root a new password from the clients list; nothing else ships to ridge but code, $0 a
month. Left to the human: op-5's look, the push (step 10) and ridge (step 11).

| Who | Does | Sees |
| --- | --- | --- |
| the operator | New root password on a client's row, types the client's code, a password twice or none, a fresh passkey touch | a made password once to copy, or "set" for a typed one |
| the client's root | their next step | signed out; the old password refused, the new one in |

## What shipped

- The route `POST /api/operator/clients/:code/root-password` (`bff/src/routes/root-password.ts`) writes the root's sign-in
  record alone, with a new hash and generation, so every session of that root ends at its next call. The write was
  lifted out of piece 2's person route into `bff/src/records/staff-records.ts`, and both routes call it.
- The page and its four screens (form, rule refused, made, failed), in vi and en, on the fake first; the touch of the
  operator's own passkey in the same act (call 5 and Decide 50).
- The walk `operator-root-password`: 24 new bases, and op-5's sentence moved (6 bases), committed as `5f73869`.

## Rejected, and the price

- A copy of the write in D's route: a second home for the code that ends sessions. Cost: one lift and piece 2's tests.
- The first password's generator: 16 characters that break the typed rule. `madePassword()` is used instead.
- Piece 2's reply, which echoes a typed password; a new reply holds the made one alone.
- A dialog on the list: a scene cannot open it by path. Cost: one more page.
- Not recorded: which operator set it (row 8, accepted until operator levels).

## Evidence

- Step 4: the human's yes in vi on the four screens, 12:01 +07. Step 5: the route's 17 cases, red once with the
  touch removed; live read `live1.log`, `== exit 0`. Step 6: Opus, no High and no Medium.
- Step 7: `main` taken in clean (`a729d94`); whole `pnpm check` `== exit 0`
  (`20261103-console-root-password-step4-gate2.log`).
- Step 8: run 1 green in 4m14s (6 of 6, 24 new, 6 moved), run 2 green in 4m18s with every count 0
  (`20261103-1201-d-full-run.log`).

## What remains the human's

- **op-5's moved sentence:** not yet looked at; it gates the push alone. The en versions of the four screens were not
  asked again.
- **Three Lows, deferred as open items 61 to 63:** a timeout may hide a landed write while the message says nothing
  changed (`bff/src/routes/root-password.ts#L50`); the touch is tied to the act, not to the client
  (`bff/src/routes/operator-auth.ts#L375`); no page test for the BFF refusing the touch with a 403
  (`ui/src/RootPasswordPage.tsx#L61`).
- **Step 10, the push,** when the human calls for it; **step 11, ridge:** reset the root of the client whose first
  password went through a chat, and answer "would you reset a client's root this way?".
- Row 9's five stay the human's when a client signs (a forced change, telling the root, a limit on wrong passwords,
  a client's own stack, other users' passwords).
