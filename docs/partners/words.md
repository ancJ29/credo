# Words we use

This page is for anyone who meets a word on another page and does not know it. After it you can say what the word means in a sentence. Each word has its own heading, and other pages link to it.

## bases

The saved pictures of each screen that a new run of a [walk](#walk) is compared with. A run passes only when nothing differs from them.

## BFF

The middle server between the screens and the storage. It works out which company and which person is calling, and what they may do, before anything is read or saved.

## box

One machine that holds companies. An [operator](#operator) picks the box a new company lives on, from a list that shows each box's free disk and how many companies it holds.

## c-storage

The storage service, the part that keeps the records. It only keeps what it is handed, and the meaning of each record belongs to the [BFF](#bff).

## CI

The checks that GitHub runs by itself after each push. Its list of runs is in GitHub's Actions list.

## CloudFront

The front door of an environment. A browser asks it for a screen and it serves the screens' files. It passes every call for data on to the back end and never keeps a copy of those.

## demo copy

An invented company that a partner uses to try credo. Each partner has a copy of their own, and we have one too.

## gate

One package's check, or every package's: the one check that must pass before work is accepted. It covers types, style, tests at 100 percent and unused code. The [whole check](#whole-check) is the gate of the six TypeScript packages together.

## Litestream

The tool that copies each change to the records into a bucket within about a second. The copies are kept for seven days, so the records can be put back.

## main

The version of the code we have checked and rely on. It moves only to a version that has already been checked.

## operator

The person who runs credo for clients. An operator adds a client and copies its sign-in link, or moves a company to another machine.

## operator console

The part of the app for the people who run credo. It is opened at its own address, and it is not a second deployment.

## passkey

What an operator signs in with. An operator makes the first one by opening a one-time link, which works once and expires after a day. A passkey is tied to the app's address for good. A lost one is replaced by a new link, which replaces every passkey that operator held.

## pre-merge

The place where a finished piece waits while the [whole check](#whole-check) runs on it. Only a piece that has passed its checks there is added to [main](#main).

## production

The live system a client really uses. Nothing runs in production yet, so no client has a live system of their own.

## recap

A short page written when a piece of work has passed its check. It says what shipped, what was turned down and why, and what is left for us to decide.

## ridge

Our shared test copy: one machine where people who do not code check a piece before anyone relies on it.

## stack

Everything one environment is made of, made and removed together. It holds the [box](#box), the back end's function, the screens' storage and the door in front of them.

## tenant

One client's company, as the back end sees it. Every tenant of an environment shares the one back end and its box. Its records are kept under its own id, and it is opened at its own address, its code followed by the credo domain.

## walk

One person's day through the screens, drawn so that we can answer yes or no on each screen. A walk is how we confirm a screen looks right.

## walks page

The page that shows every screen of every [walk](#walk), in two languages. We answer yes or no on each screen, and write a note on a no.

## whole check

The [gate](#gate) of the six TypeScript packages, run together on [pre-merge](#pre-merge). It runs there only where a change can break more than its package, and once before the day's push, when nothing else holds the machine.

## worktree

A folder on a developer's machine that holds one version of the code. The project keeps one folder for each version, with [main](#main) first.
