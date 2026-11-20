---
source: docs/operator-guide.md
---

# What the operator does in the operator console

This page is for the operator, the person who adds clients and keeps credo running for them. Today the operator is us, the owner. After it you can do each task below in the console, with no typed commands, and you know what you should see when it worked.

## Open the console

The [operator console](words.md#operator-console) is a separate area of credo for the people who run it, with its own menu. You sign in with a [passkey](words.md#passkey): your fingerprint, your face or your device's PIN, and no password. You press "Sign in with passkey".

A new operator cannot sign in until another operator sends an invite link. The link works once, so open it on the device you will use and press "Create passkey".

The menu holds five entries. "Clients", "Operators" and "Service status" work. "Usage & costs" and "Activity log" open an empty page that says "Coming soon".

Every change below except adding a client asks for your passkey again, so only a person who holds a passkey can make it.

## A client is a company that uses credo

### Add a client

You do this when a new company starts. It gives the company its own address in credo.

1. Open "Clients" and press "Add client".
2. Type the client code, a short name for the company. It has 3 to 32 lowercase letters, numbers or hyphens, and it cannot be changed later. Then type the company name.
3. If credo runs on more than one server, choose the server the company lives on. The list shows each server's free space and how many companies it holds.
4. Press "Create client".

You should see "Client created successfully", the company's sign-in link and its first password. The password is shown once. Copy both and send them to the client by your own channel. The console has no way to send them.

### Give a client a new password

You do this when the client's main user is locked out.

1. Open "Clients" and press "New root password" on the company's row.
2. Type the client code to confirm. Leave the password blank and the console makes a safe one.
3. Press "Update root password" and give your passkey.

You should see "New root password generated". It is shown once, and everyone signed in as that user is signed out. Send it to the client.

### Move a client to another server

You do this to make room for more companies on a server. The company pauses for a short while and its people lose nothing.

1. Open "Clients" and press "Migrate to another server" on the company's row.
2. Choose the target server and press "Start migration".
3. Keep the page open while it counts down and copies.

During the move the company's workspace is paused, and its records stay safe. If a step fails, the page offers "Continue" or "Abort migration". Abort puts the company back on its first server.

### Delete a client

This cannot be undone. All the company's people, orders, deliveries and photos go.

1. Open "Clients" and press "Delete" on the company's row.
2. Type the client code to confirm, then press "Delete client and all data" and give your passkey.
3. Keep the page open while it counts the records left.

You should see "Client and all data have been completely removed." If it stops half way, reload the page. Once the company is gone from the list, the page shows "Resume deletion"; press it to finish.

## Operators are the people who run credo

### Add an operator

1. Open "Operators" and press "Add operator".
2. Type the person's name, which must be new, and press "Create operator invite".
3. Send the one-time link you are shown to that person. It cannot be shown again.

### Give an operator a new link after a lost passkey

You do this when someone loses the device that held their passkey.

1. Open "Operators" and press "Generate new link" on their row.
2. Send the new link. Their old links stop working, and their old passkeys are reset when they join again.

Your own row has no such button. If you lose your own passkey, another operator does this for you. The very first operator has no one else, so we do it from a terminal.

### Remove an operator

Open "Operators" and press "Remove" on their row. You cannot remove your own row.

## See whether credo answers

Open "Service status". It shows three parts, the web application, the service behind it and the storage, each as "Healthy", "Unresponsive" or "Unreachable". It says whether all three run the same version. It refreshes by itself every minute, and "Refresh status" checks now.

Healthy for all three means credo is up. If the storage is not healthy, sign-in and saving stop for everyone, so tell us at once.

## What is not in the console

Some tasks still need a terminal: taking the shared test copy down and bringing it back, checking it, refilling the demo copies and putting records back from a backup. We do them today. Ask us, and the operator guide lists each one.
