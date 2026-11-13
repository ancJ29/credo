# Two script tests that no longer need a normal user, recap, 2026-11-12

Written before the landing on `pre-merge`.

## What happened

Act runs the checks in a container that runs as root, and root ignores a folder's permission bits. Two tests in the `scripts` package made their write fail by taking a folder's rights away, so under act the write went through and both tests were red. On GitHub's runner, which is not root, they passed.

Both now make the write fail in a way root cannot skip:

- **Taking an environment down.** The test refuses the one removal of the environment's folder through a stand-in for the file removal, so down still has to end red and report the folder as still there.
- **Claiming a browser folder.** A plain file stands where the folder must be made, so the creation fails the same way for any user and the wrapped error line is still the one pinned.

With that, act can read clean before a push.

## What was rejected

Skipping the two tests when run as root: it would hide the very lines they pin. The price of the chosen way: neither test stages the real cause any more (a folder this terminal cannot write; a folder removed part-way), though the code reads only the error's message and code, so the same branches are pinned.

## Still yours

- Run act once this lands; that run has not happened, and it is the real proof for root.
- No look of this piece is open.

## Evidence

- Base `1467a9f0`; one commit, `6995dba7`, which changes two test files and nothing else.
- The `scripts` package's gate ended green on the builder's tree.
- The review, on a model other than the author's, found no High and no Medium and says it may land. [FIXED] none. [DEFERRED] one Low: the claim's draft cleanup is pinned by no case before or after this change, filed as item 342.
- The review ruled out a leak of the removal stand-in into other cases and found no other test relying on a denied write.
- `docs/products.md`: no row changes, the piece is test-only and no partner or operator can do anything new.
