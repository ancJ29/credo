#!/bin/bash
# ops/words-in.sh <returned file> <label>   |   ops/words-in.sh --land <branch>
# Reads a partner's returned words file into the app and lands it on pre-merge, you answering only the import's own y.
# Run from the credo root's project folder, in any worktree holding this script. <label> is p and a number (p1).
#
# What it does, in order:
#   1 refusals (each "== refused: <why>", exit 2, nothing made): a missing or extra value, a label that is not p and a
#     number, a returned file that cannot be read, no <credo root>/words-sent/<label>.csv (the file you sent that
#     partner; its path and time are printed), no terminal to answer on, no pre-merge worktree, a branch or folder of
#     the new name already there.
#   2 a branch words-<label>-<MMDD>-<HHMM> from pre-merge's tip, as <credo root>/wip-<branch>, installed offline.
#   3 pnpm words in <sent copy> <returned file> there: every change shown, then its question, which you answer.
#   4 only when the answer was y: the two word files (ui/src/i18n/en.ts, vi.ts) and nothing else are committed.
#   5 the ui package's whole check (waits at most 10 minutes for the machine's gate lock) and the citation test,
#     each run whatever the other did.
#   6 pre-merge is taken in when it moved past the branch's base and merge-tree is clean, and the checks run again.
#   7 the landing: the gate lock taken for it (5 minutes at most, a line every 30 seconds naming the holder), then
#     git merge --no-ff in pre-merge's worktree; the worktree removed, the branch deleted.
#   --land <branch>: lands a kept words-p<n>-... branch (steps 5 to 7 only); refused unless its worktree is clean, it
#     changes the two word files alone against pre-merge, and pre-merge does not hold it yet.
# Exit: 0 landed, or nothing to land; 1 stopped after the worktree was made; 2 refused. A stop after the commit keeps the
#   branch and its worktree, named. Log: <credo root>/logs/<date>-<time>-words-in-all.log, ending == exit <n>.
# What it changes: the branch and worktree it makes (removed on a landing or a stop before the commit), pre-merge when
#   it lands, the logs folder. main's worktree is only read.
# Set for a test only: OPS_TEST_NO_TTY=1 (the answer comes from a pipe), GATE_LOCK and GATE_RUN_LOCK (other lock
#   folders), OPS_LOG_DIR, WORDS_LAND_WAIT (300) and WORDS_LAND_POLL (30) in seconds.
set -uo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

root=$(dirname "$(git -C "$REPO_DIR" rev-parse --path-format=absolute --git-common-dir)")
LOCK=${GATE_LOCK:-$root/.gate-lock}
RUN_LOCK=${GATE_RUN_LOCK:-$root/.full-run-lock}
LAND_WAIT=${WORDS_LAND_WAIT:-300}
LAND_POLL=${WORDS_LAND_POLL:-30}
HELD=no
BRANCH=''
WT=''

log_start words-in
say() { echo "== $*"; }
refuse() {
  echo "== refused: $1"
  exit 2
}

# clock_at <seconds from now>: the clock time then, read by date (BSD or GNU)
clock_at() {
  local at=$(($(date +%s) + $1))
  date -r "$at" '+%H:%M' 2>/dev/null || date -d "@$at" '+%H:%M'
}

# cleanup_extra: lib.sh's on_exit calls it on every way out. Removes the lock only if this run made it.
cleanup_extra() {
  if [ "$HELD" = yes ]; then
    rm -f "$LOCK/owner"
    rmdir "$LOCK"
    HELD=no
    echo "lock $LOCK released $(date '+%H:%M:%S')"
  fi
}

# drop_made: a stop before the commit removes the worktree and branch this run made, and only those
drop_made() {
  if [ -n "$WT" ] && [ -d "$WT" ]; then git -C "$REPO_DIR" worktree remove --force "$WT" || true; fi
  if [ -n "$BRANCH" ]; then git -C "$REPO_DIR" branch -D "$BRANCH" >/dev/null 2>&1 || true; fi
  WT='' BRANCH=''
}

# kept <why>: a stop after the commit; the branch and worktree stay, named
kept() {
  say "verdict: stopped, $1"
  if [ "${2:-}" = again ]; then
    echo "the branch $BRANCH is kept in $WT; to land it again, paste: cd $REPO_DIR && bash $OPS_DIR/words-in.sh --land $BRANCH"
  else
    echo "the branch $BRANCH is kept in $WT; a session takes it from here"
  fi
  say "done"
  exit 1
}

# checks <wait seconds>: the ui check and the citation test, each by its own exit
checks() {
  local ui cite
  NOTRUN=no
  echo "the ui check waits at most $1 s for the machine's lock, until $(clock_at "$1"); not run reads as 'not run', never red"
  # stdout is the log's pipe (terminal and log, line by line); fd 3 is the terminal alone. pipefail keeps pnpm's exit.
  (cd "$WT" && GATE_WAIT_MAX=$1 pnpm --filter @credo/ui check 2>&1 | tee "$WORK/ui.out")
  ui=$?
  (cd "$WT" && pnpm --filter @credo/scripts exec vitest run src/citations.test.ts 2>&1)
  cite=$?
  echo "the ui check exit $ui, the citation test exit $cite"
  [ "$ui" = 0 ] && [ "$cite" = 0 ] && return 0
  if [ "$ui" != 0 ]; then
    if grep -q 'gave up after' "$WORK/ui.out"; then
      echo "the ui check did not run: it gave up waiting for the machine's lock; that is not red"
      [ "$cite" = 0 ] && NOTRUN=yes
    else
      echo "the ui check is red; a red there may be a changed English word (open item 549), which a session fixes"
    fi
  fi
  [ "$cite" = 0 ] || echo "the citation test is red"
  return 1
}

# finish: steps 5 to 7, on the branch and worktree in BRANCH and WT (a run of this script made them, or --land found them)
finish() {
  say "5 the checks"
  checks 600 || { [ "$NOTRUN" = yes ] && kept "the ui check did not run, nothing landed" again; kept "a check is not green, nothing landed"; }

  say "6 pre-merge"
  pm_tip=$(git -C "$pm" rev-parse HEAD)
  if ! git -C "$WT" merge-base --is-ancestor "$pm_tip" HEAD; then
    echo "pre-merge moved past the branch's base"
    git -C "$WT" merge-tree --write-tree HEAD "$pm_tip" >/dev/null 2>&1 || kept "taking pre-merge in conflicts"
    git -C "$WT" merge -q --no-edit "$pm_tip" || kept "taking pre-merge in failed"
    checks 300 || { [ "$NOTRUN" = yes ] && kept "the ui check did not run after taking pre-merge in, nothing landed" again; kept "a check is not green after taking pre-merge in, nothing landed"; }
  fi

  say "7 the landing"
  [ -z "$(git -C "$pm" status --porcelain)" ] || kept "pre-merge's worktree is not clean, nothing landed" again
  start=$(date +%s)
  echo "the landing waits at most $LAND_WAIT s for the gate lock and any full run, until $(clock_at "$LAND_WAIT")"
  while :; do
    if [ -e "$RUN_LOCK" ]; then
      echo "waiting: a full run holds $RUN_LOCK: $(cat "$RUN_LOCK/owner" 2>/dev/null || echo owner unknown) ($(date '+%H:%M:%S'))"
    elif mkdir "$LOCK" 2>/dev/null; then
      HELD=yes
      printf 'pid=%s log=%s started=%s\n' "$$" "$LOG" "$(date '+%Y-%m-%d %H:%M:%S')" >"$LOCK/owner"
      echo "lock $LOCK taken $(date '+%H:%M:%S')"
      break
    else
      echo "waiting: lock $LOCK is held by: $(cat "$LOCK/owner" 2>/dev/null || echo owner unknown) ($(date '+%H:%M:%S'))"
    fi
    [ $(($(date +%s) - start)) -lt "$LAND_WAIT" ] || kept "the locks were still held after $LAND_WAIT s, nothing landed" again
    sleep "$LAND_POLL"
  done
  [ "$(git -C "$pm" rev-parse HEAD)" = "$pm_tip" ] || kept "pre-merge moved again, nothing landed" again
  git -C "$pm" merge-tree --write-tree HEAD "$BRANCH" >/dev/null 2>&1 || kept "the landing would conflict, nothing landed"
  if ! git -C "$pm" merge --no-ff --no-edit "$BRANCH"; then
    git -C "$pm" merge --abort 2>/dev/null || true
    kept "the merge on pre-merge failed, nothing landed" again
  fi
  echo "landed: pre-merge is now $(git -C "$pm" rev-parse --short HEAD)"
  cleanup_extra
  git -C "$REPO_DIR" worktree remove "$WT" || echo "could not remove $WT, it is kept"
  git -C "$pm" branch -d "$BRANCH" >/dev/null 2>&1 || echo "could not delete $BRANCH: pre-merge does not hold all its commits, so it is kept"
  say "verdict: landed $label's returned words on pre-merge"
  say "done"
  exit 0
}

# land_refusals <branch>: --land's own refusals; sets BRANCH, WT and label
land_refusals() {
  local b=$1 files
  say "1 refusals"
  [[ $b =~ ^words-p[0-9]+-.+ ]] || refuse "the branch '$b' is not a words-p<n>-... branch; nothing is landed"
  git -C "$REPO_DIR" show-ref --verify --quiet "refs/heads/$b" || refuse "no branch $b"
  WT=$(git -C "$REPO_DIR" worktree list --porcelain | awk -v b="refs/heads/$b" '/^worktree /{w=substr($0,10)} $0=="branch " b{print w}')
  [ -n "$WT" ] || refuse "the branch $b has no worktree; a session takes it"
  [ -z "$(git -C "$WT" status --porcelain)" ] || refuse "the worktree $WT is not clean; a session takes it"
  pm=$(git -C "$REPO_DIR" worktree list --porcelain | awk '/^worktree /{w=substr($0,10)} $0=="branch refs/heads/pre-merge"{print w}')
  [ -n "$pm" ] || refuse "no worktree of pre-merge was found"
  ! git -C "$REPO_DIR" merge-base --is-ancestor "$b" pre-merge || refuse "pre-merge already holds $b; nothing to land"
  files=$(git -C "$REPO_DIR" diff --name-only "pre-merge...$b" | grep -vxE 'ui/src/i18n/(en|vi)\.ts' || true)
  [ -z "$files" ] || refuse "the branch $b changes more than the two word files: $(printf '%s' "$files" | tr '\n' ' '); a session takes it"
  BRANCH=$b
  label=${b#words-}
  label=${label%%-*}
}

USAGE="usage: ops/words-in.sh <returned file> <label>   or   ops/words-in.sh --land <branch>"
LAND=no
if [ $# -eq 2 ] && [ "$1" = --land ]; then
  LAND=yes
elif [ $# -ne 2 ] || [[ $1 == -* ]]; then
  refuse "$USAGE"
fi
if [ "$LAND" = yes ]; then
  land_refusals "$2"
  finish
fi
returned=$1
label=$2
say "1 refusals"
[[ $label =~ ^p[0-9]+$ ]] || refuse "the label '$label' is not p and a number (p1); a name is never typed here"
err=$(cat -- "$returned" 2>&1 >/dev/null) || refuse "cannot read the returned file $returned: $err"
sent=$root/words-sent/$label.csv
[ -f "$sent" ] || refuse "no $sent: the file you sent $label is kept there; made by: pnpm words out $sent"
sent_at=$(stat -f '%Sm' -t '%Y-%m-%d %H:%M' "$sent" 2>/dev/null || stat -c '%y' "$sent" | cut -c1-16)
echo "the file you sent $label: $sent, written $sent_at"
[ -t 0 ] || [ "${OPS_TEST_NO_TTY:-}" = 1 ] || refuse "needs a terminal to answer the import's question on"
pm=$(git -C "$REPO_DIR" worktree list --porcelain | awk '/^worktree /{w=substr($0,10)} $0=="branch refs/heads/pre-merge"{print w}')
[ -n "$pm" ] || refuse "no worktree of pre-merge was found"
case $returned in /*) ;; *) returned=$PWD/$returned ;; esac
BRANCH_NEW=words-$label-$(date +%m%d-%H%M)
WT_NEW=$root/wip-$BRANCH_NEW
if git -C "$REPO_DIR" show-ref --verify --quiet "refs/heads/$BRANCH_NEW" || [ -e "$WT_NEW" ]; then
  refuse "the branch or folder $BRANCH_NEW already exists; nothing was made or removed"
fi

say "2 the worktree"
git -C "$REPO_DIR" worktree add -q -b "$BRANCH_NEW" "$WT_NEW" pre-merge || die "cannot make $WT_NEW"
BRANCH=$BRANCH_NEW
WT=$WT_NEW
echo "made $WT on $BRANCH from pre-merge $(git -C "$pm" rev-parse --short HEAD)"
(cd "$WT" && pnpm install --offline --frozen-lockfile)
rc=$?
if [ "$rc" != 0 ]; then
  drop_made
  say "verdict: the offline install failed (exit $rc), nothing kept"
  say "done"
  exit 1
fi

say "3 the import"
(cd "$WT" && pnpm words in "$sent" "$returned" 2>&1 | tee "$WORK/import.out")
rc=${PIPESTATUS[0]}
if [ "$rc" != 0 ]; then
  drop_made
  if grep -q 'did not read back' "$WORK/import.out"; then
    say "verdict: the import's read-back failed (exit $rc), a tool fault, nothing written, nothing kept"
  else
    say "verdict: the import refused the file (exit $rc), nothing written, nothing kept"
  fi
  say "done"
  exit 1
fi
changed=$(git -C "$WT" status --porcelain)
if [ -z "$changed" ]; then
  drop_made
  say "verdict: nothing written, nothing to land"
  say "done"
  exit 0
fi
only=$(printf '%s\n' "$changed" | awk '{print $2}' | grep -vxE 'ui/src/i18n/(en|vi)\.ts' || true)
if [ -n "$only" ]; then
  echo "a file beyond the two word files changed: $(printf '%s' "$only" | tr '\n' ' ')"
  echo "nothing committed; the worktree $WT is kept for a session"
  say "verdict: stopped before the commit"
  say "done"
  exit 1
fi

say "4 the commit"
count=$(sed -n 's/^\([0-9][0-9]*\) changes,.*/\1/p' "$WORK/import.out" | tail -n 1)
[[ $count =~ ^[0-9]+$ ]] || count=0
paths=()
for f in ui/src/i18n/en.ts ui/src/i18n/vi.ts; do
  if [ -n "$(git -C "$WT" status --porcelain -- "$f")" ]; then paths+=("$f"); fi
done
git -C "$WT" add -- "${paths[@]}" || kept "git add failed"
git -C "$WT" commit -q -m "feat(ui): $label's returned words read in, $count changes" || kept "the commit failed"
echo "committed $(git -C "$WT" rev-parse --short HEAD): ${paths[*]}"
finish
