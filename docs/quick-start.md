# Quick start: your own copy of the app

This page is for a new developer who has done the [first-time setup](first-time-setup.md). After it you can start your own copy of credo on your machine with an invented company in it, look at what is running, stop it, and clear it away.

The copy is the whole app on this computer. It has three parts: the storage that keeps the records ([c-storage](partners/words.md#c-storage)), the server that holds every rule ([BFF](partners/words.md#bff)), and the screens you open in a browser. It keeps running after the command returns, so you can close the terminal.

You can do six things. Each is a block to copy, with a line under it saying what you will see:

1. Bring it up.
2. Put a demo company of your own in it.
3. See what is running.
4. Stop it and keep everything.
5. Read what was recorded about one record.
6. Take it all away, data included.

Every block finds the project's folder by itself, so you can paste it from any folder of your copy of the project.

## 1. Bring it up

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && pnpm local up
```

It starts with a line saying it is building, how long that may take and until what time of day. Then it prints a line saying "still working" every 30 seconds. At the end it prints four things, one per line:

```text
the address to open
the demo company's sign-in link
the password for the user: root
the link the invited operator uses to make a first passkey
```

A [passkey](partners/words.md#passkey) is a sign-in without a password. You get your prompt back and everything stays running.

**This one prints a password, so never pipe it into a log or a file.**

If something is up already it changes nothing, says so, and tells you to look at what is up (step 3).
If another program holds one of the ports, it names the port and changes nothing.

## 2. Put a demo company in it

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && pnpm local seed acme
```

`acme` is a name you choose, not a fixed one. Start it with a lowercase letter. Use lowercase
letters, digits and hyphens, three to thirty-two characters, and end it with a letter or a digit. Put a
company name after the code if you want one; without it the code is the name.

It prints the new company's sign-in link, the password for its `root`, and then one line per person
in it with that person's own password. A code that is already a company here is refused, and nothing
is changed.

**This one prints passwords too, so never pipe it into a log or a file.** They are printed here.
Nothing stores them where you can read them again, so keep what you see if you want to sign in as
those people later.

## 3. See what is running

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && pnpm local status
```

It prints one line for each of the six parts. The audit service, which records who changed what, has two. Each line says `up` or `DOWN` and on which port.
When the storage is answering, it also prints a count of the companies in it.

If nothing has been brought up it says so in one line. If you stopped it, it says it is stopped, since what time and that the data is kept. It also says which command resumes it and which deletes it.

## 4. Stop it, keeping everything

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && pnpm local stop
```

It ends each part, one line each, then reads back that each is gone, that the six ports are free and
that the data and the build are kept. Its last line says the copy is stopped and its data kept.
Running step 1 again resumes it. It rebuilds nothing, keeps every company and every record, and says
so in its first line. If what it kept is no longer complete, it says that and builds a new copy
instead.

A resumed copy reprints the `root` password and the operator's link. That link works once only
and expires a day after it was made, so it may already be spent. The demo company's other people
have their own passwords, and no command prints those; only a company you seed yourself (step 2)
prints its people's, once.

## 5. Read what was recorded about one record

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && pnpm local activity acme 0b9f6c1e-7d52-4a3e-9c41-2f8d5e6a7b10
```

Every change a person makes is recorded: who made it, when and what changed. This block prints the record of one thing, newest first, one line each. A line starts with the time and the name of the person, then says what was done. These are the three marks you will see:

```text
new                      the record was made
changed: <field names>   the record was changed; the names of the fields, never their values
refused                  the change was refused
```

A record with a name also shows the name before and after. A password, a photo or a sign-in code shows only that it was changed.

It takes two things: the company's code (`acme` above) and the id of the thing. The record of changes can be asked only about one thing at a time. Where to find the id:

- A customer, a product, a person on the staff list, an order or a delivery: the last part of the
  address in your browser while its page is open. A person's password, code, photo, email and sign-in
  code are all under that person's id.
- A driver's closed day: the driver's id, the last part of the address of the page of that driver's
  day.
- The company's settings: the word `config`. The staff setup: the word `setup`.
- What an operator does to a company (making it, deleting it, setting its root password) is filed
  under the company's own id, which no page here shows, so this command cannot read those yet.
- A person's own password change has no id to ask about, so this command cannot read it yet.

Entries are kept for 180 days. It prints no key.

## 6. Take it all away, data included

```sh
cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/main" && pnpm local down
```

It ends each part, deletes the data and the build, and then reads everything back and tells you what
it found. If a part will not end, it removes nothing and says so. Its last line is one of two:

```text
down: everything is cleared
down: NOT cleared:   followed by each thing still there: a process still running, a held port, a folder that would not go
```

If it finds parts of the copy running but has lost track of them, it also prints the one `kill` command to end them. Run that,
then run this block again.

## Two things worth knowing

A run of the pictures refuses to start while this copy is up. It stops with a line saying another run of the app's is going and to wait for it. Stop the copy (step 4) or take it down (step 6) first.

Your copy uses six ports. Stop it, or take it down, if something else of yours wants one of them.

| Port | What it is |
| --- | --- |
| 3180 | The app you open |
| 3181 | The storage |
| 3182 | The server |
| 3183 | A door that makes a throwaway company on request |
| 3184 and 3185 | The record of changes |
