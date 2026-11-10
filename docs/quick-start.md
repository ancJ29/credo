# Quick start: your own copy of the app

The whole app on this Mac — the storage, the server and the screens — with one demo company already
in it. It stays up after the command returns, so you can close the terminal and keep using it.

Six things you can do. Copy a block, paste it, read the line under it. Every block finds the
project's folder by itself, so you can paste it from any folder inside a checkout of this project.
It needs Node 26, pnpm 12 and Go.

## Once, the first time

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && pnpm install
```

You will see pnpm fetch and link the packages, ending in a summary of what it installed.

## 1. Bring it up

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && pnpm local up
```

It opens with a line saying it is building and how long it may take and until what time of day,
then a line "still working" every 30 seconds. At the end it prints four things: the address to open,
the demo company's sign-in link, the password for the user `root`, and the link the invited operator
uses to make their first passkey. You get your prompt back and everything stays running.

**This one prints a password, so never pipe it into a log or a file.**

If something is up already it changes nothing, says so, and tells you to look at what is up (step 3).
If another program holds one of the ports, it names the port and changes nothing.

## 2. Put a demo company in it

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && pnpm local seed acme
```

`acme` is a name you choose, not a fixed one: start it with a lowercase letter and use lowercase
letters, digits and hyphens, three to thirty-two characters, ending in a letter or a digit. Put a
company name after the code if you want one; without it the code is the name.

It prints the new company's sign-in link, the password for its `root`, and then one line per person
in it with that person's own password. A code that is already a company here is refused, and nothing
is changed.

**This one prints passwords too, so never pipe it into a log or a file.** They are printed here and
nothing stores them where you can read them again, so keep what you see if you want to sign in as
those people later.

## 3. See what is running

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && pnpm local status
```

One line for each of the six parts (the audit service, which records who changed what, has two), each saying `up` or `DOWN` and on which port, and, when the
storage is answering, a count of the companies in it. If nothing has been brought up it says so in
one line. If you stopped it, it says it is stopped, since what time, that the data is kept, and
which command resumes it and which deletes it.

## 4. Stop it, keeping everything

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && pnpm local stop
```

It ends each part, one line each, then reads back that each is gone, that the six ports are free and
that the data and the build are kept. Its last line says the copy is stopped and its data kept.
Running step 1 again resumes it: it rebuilds nothing, keeps every company and every record, and says
so in its first line; if what it kept is no longer complete, it says that and builds a new copy
instead.

A resumed copy reprints the `root` password and the operator's link, but that link works once only
and expires a day after it was made, so it may already be spent. The demo company's other people
have their own passwords, and no command prints those; only a company you seed yourself (step 2)
prints its people's, once.

## 5. Read what was recorded about one record

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && pnpm local activity acme 0b9f6c1e-7d52-4a3e-9c41-2f8d5e6a7b10
```

Every change a person makes is recorded: who made it, when, and what the record was before and after.
This prints the record of one thing, newest first, one line each: the time, the person, what was done,
and for a customer its name before and after. It takes two things, the company's code (`acme` above) and
the record's id (the long made-up one above, which you replace with your own), because the record of
changes can be asked only about one record at a time. The id is the last part of the address in your
browser while that record's page is open. Entries are kept for 180 days. It prints no key.

## 6. Take it all away, data included

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && pnpm local down
```

It ends each part, deletes the data and the build, and then reads everything back and tells you what
it found. If a part will not end, it removes nothing and says so. Its last line is either
`down: everything is cleared`, or `down: NOT cleared:` followed by each thing still there — a
process still running, a held port, a folder that would not go. If it finds parts of the copy
running but has lost track of them, it also prints the one `kill` command to end them; run that,
then run this block again.

## Two things worth knowing

A run of the pictures refuses to start while this copy is up — it stops with a line saying another
run of the app's is going and to wait for it — so stop it (step 4) or take it down (step 6) first.

The six ports it uses are 3180 for the app you open, 3181 for the storage, 3182 for the server,
3183 for a door that makes a throwaway company on request, and 3184 and 3185 for the record of
changes, in case something else of yours wants one of them.
