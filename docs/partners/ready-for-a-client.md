---
source: docs/client-readiness.md
---

# Can we take a real client yet?

This page is for you, the product owner, when a client asks to start. After it you know today's answer, what stands in the way, and which gaps would cost a client time or records.

## The answer today: not yet

The core job works from start to finish. An order is taken, priced and confirmed to a driver and a day. The driver delivers it with a photo, and the office settles the driver's cash. It runs in Vietnamese and English on a phone, a tablet and a computer.

What is missing is the ordinary day around that job, and a safe place for a real client's records. Nothing runs in production yet, which means no client has a live system of their own.

## What a client's office would miss first

We list these in the order a client would meet them. Each costs the client time, not records.

- **Correcting a confirmed order.** A customer often changes a quantity after we confirm. Today the order can only be cancelled and made again under a new number, and the cancel also cancels the driver's request. We must decide what "correct" means once a driver holds the request.
- **The client's own logo.** The client sees its logo at the sign-in door, then a stand-in logo on every page inside. It is the first thing a client sees, and it is about an hour of work.
- **Finding an older order.** The list reaches back seven days, with no search by number or customer. Last month's order means pressing "Earlier" five times. This is half a day to a day of work.
- **A forgotten password.** Nothing sends email or text. The company's main user types a staff member's new password by hand, and only we can reset the main user's own, in the [operator console](words.md#operator-console).
- **Prices set by hand.** Every line takes the product list's price, so there is no discount, delivery fee or free replacement. It matters the day a client sells at agreed prices. The choice is ours.
- **One report.** No page shows a day's or a customer's totals. A client can run a month without one, so it comes last, at about a day of work.
- **Stock.** Only an in-stock switch exists, with nothing behind it.

Already fixed on 8 November: a clerk can now add a customer or a product from the list.

## What could hurt a real client's records

- **Backup.** Every save is copied to a separate store. On 13 November, on [ridge](words.md#ridge), a restored copy held a save made before a restart. It has not run on a real client's data, and a restore onto an added machine ran only on stand-ins. Losing the one copy cannot be undone, so this comes first.
- **Clients kept apart.** Tests prove a call reaches only the client it names. The rule that builds every record's address is kept by habit and review, with no automatic check, so one careless line could mix clients.
- **A stopped server.** Nobody is told when a client's server stops. An alert waits for a signed client.
- **A touch that fits any client.** An operator's [passkey](words.md#passkey) touch is tied to the operator, not to the client. A touch made on one client's row could open another's within five minutes, and reset the wrong company's main password, or delete the wrong company, which is the heavier act.
- **A deletion left half done.** Deleting a client removes it from the list at once, then its records in rounds of 200. If nobody presses again, the rest stays in the file, reachable by nothing.
- **Guessing passwords.** Six wrong passwords make a name wait 30 seconds, doubling to 15 minutes. One guesser trying many names meets only a general limit.

## What we could not confirm

The page this one comes from was written on 7 November for an older plan, and was corrected on 18 and 19 November, but has not been read again against the shape of shared machines. These points rest on it alone, so treat them as unconfirmed.

- **Where a client lives.** It assumed each client has its own set of machines. Since 11 November we plan to share machines among clients, and that is built. What the source says about running, checking and recovering "a client's own machines" is unconfirmed for the new shape.
- **A bad release.** It says nothing rolls back, and the only way back is sending the old version again, through checks that can fail with nothing broken. The checks have since been split and their limits changed, so this is unconfirmed.
- **How long each fix takes.** The hours and days are one reader's guess on 7 November, and "two to three pieces of work" came from the same read.

## What we would do first

Our order, from the source: the backup on a real client's data, then correcting a confirmed order, the logo, finding an order, passwords and one report. Ask us before you promise a client a start date.
