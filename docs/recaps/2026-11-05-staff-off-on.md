# Recap: switching a person off and back on

**What a partner can now do.** The office switches a person off when they leave and back on when they return, and that
person signs in with the password they had. The words are the legacy's lock and unlock; the permission for both reads "Lock and unlock a person".

**The guarantee.** A phone signed in before the switch off cannot wake when the person comes back: the switch off mints
a fresh sign-in generation and leaves the password alone. The review found a hole: if the switch off's second write
failed, the office was told "they were not locked" and the old phone lived on. The switch back on mints a generation
again, which closed it.

**Commits, in order.**
- `1c5e247` the plan.
- `c952b13` the switch back on, on the fake; screen 23.
- `ee9dbdd` the restore route, and sessions ended at the switch off.
- `56b934d` the gate green.
- `1dec1ce` the restore ends sessions again; the permission reads lock and unlock.
- `e7d8206` the setup page's tests read the new permission name.
- `ad4e18f`, `97dcd11` `main` taken in; tests read the lock words.
- `b3cb7ac` the bases, fourteen screens.

**Checks that held.**
- The whole `pnpm check`, green: `check-20261105-1120.log`, `== exit 0`.
- The owed red: with the restore's own `endSessions` call removed, the mended-lock case and the session case fail.
- One review on Opus: "merge-able as it stands", no High.
- The human's full run, `20261105-1317-staff-off-on-full-run.log`: green in 14m58s. `piece-2` read 198 pictures, 78
  moved, 6 new; every other walk 0. 78 is thirteen screens that had pictures, at six bases each; 6 is the new
  screen, which had none. Run 2: every count 0.

**The human's look.** Yes on 11-05 at 11:34 and 11:33 on `admin-staff/staff-7-archive` (the side column reading Lock)
and `admin-staff/staff-23-back-on` (someone who left, switched back on). The nine other person screens wearing the same
panel's same words were not put to them: this session decided that one panel's words, seen twice, need no nine repeats.

**Fourteen screens, not the twelve the plan named.** The two staff-setup screens joined when the permission was
reworded. Decided before the run command was written, so it cost nothing.

**Open items.** 90 and 92 to 95 stay as they are; nothing closes here. Item 89 was closed by milestone 3's merge.
