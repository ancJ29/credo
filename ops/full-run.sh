#!/bin/bash
# ops/full-run.sh --worktree <dir> --branch <branch> --walks <w1,w2,…> [--moved <screen,…|all>] [--subject <commit subject>]
#   [--stem <log name>] [--node <vX.Y.Z>] [--lock <path>] [--check]
# The one body of a piece's FULL RUN, in the human's terminal on the Mac: two runs of `walk/run.sh` in the piece's worktree.
# Each piece's one-off only calls this with its parameters (milestones D, B1, B2 each had a copy of this body).
#   1. bash walk/run.sh <walks> [--moved <screens>] --write    writes the new and moved bases
#   2. bash walk/run.sh <walks> --bytes <run 1's folder>       run 1's pictures against the committed bases, byte for
#                                                              byte, every count 0 (starts only if run 1 ended
#                                                              "== verdict: green" and "== done"); no second browser run
# Between them it makes ONE local commit of the base pictures alone (only walk/specs/*-snapshots/*.png; anything
# else in the tree is a stop), since walk/run.sh refuses a dirty tree. A run 1 that moved no base commits nothing
# and goes on. Nothing is pushed.
#
# Parameters:
#   --worktree <dir>   the piece's worktree (the walks run there)
#   --branch <name>    the branch it must be on
#   --walks <list>     the walks, comma separated, as walk/run.sh names them (e.g. operator,passkeys,team)
#   --moved <list|all> the screens whose base may move (walk/run.sh's --moved, run 1 only); default none
#   --subject <text>   the bases commit's subject (default "test(walk): the bases of <walks>")
#   --stem <name>      the log's name, logs/<YYYYMMDD-HHMM>-<stem>.log (default full-run)
#   --node <vX.Y.Z>    the Node it needs, from nvm's folder (default v26.12.1)
#   --lock <path>      the gate lock it refuses on, never takes (default <credo root>/.gate-lock)
#   --check            run the refusals and show the plan, then stop: nothing is run, committed or written
#
# REFUSES (exit 2, "== refused: <why>", written to the log too) before acting: a bad or missing parameter; the
# worktree is not one; HEAD is not on the branch; the tree is not clean; the gate lock is there (its owner is named);
# no such Node from nvm. It does NOT take the lock: walk/run.sh refuses a run while the lock exists and stops one when
# it appears, so holding it would refuse every walk. Nothing else may test on this Mac while it runs.
# WHAT IT CHANGES: the base images in the worktree's walk/specs/*-snapshots (run 1) and one local commit of them; the
#   logs in <credo root>/logs; the walks' pictures in <credo root>/walks/run-*.
# LOGS: logs/<stamp>-<stem>.log holds this script's lines; each run's text as it printed is beside it as
#   logs/<stamp>-<stem>-run-<n>.out; walk/run.sh writes a full log of its own per run (named in the log).
# Exit: 0 green, 1 red (the run and its failure named), 2 refused, 130 interrupted.
# TIME: run 1 is the walks' own, 6 to 35 minutes; run 2 is seconds. Steps print "== n/4" with the elapsed time.
# Look for at the end: "== verdict: green", "== done", exit 0.
set -uo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
root=$(dirname "$(git -C "$REPO_DIR" rev-parse --path-format=absolute --git-common-dir)")
logdir="${OPS_LOG_DIR:-$root/logs}"

TREE='' BRANCH='' WALKS='' MOVED='' SUBJECT='' STEM=full-run WANT_NODE=v26.12.1 LOCK="$root/.gate-lock" CHECK=no perr=''
while [ $# -gt 0 ]; do
  case "$1" in
    --check)
      CHECK=yes
      shift
      ;;
    --worktree | --branch | --walks | --moved | --subject | --stem | --node | --lock)
      if [ $# -lt 2 ]; then
        perr="$1 needs a value"
        break
      fi
      case "$1" in
        --worktree) TREE=$2 ;;
        --branch) BRANCH=$2 ;;
        --walks) WALKS=$2 ;;
        --moved) MOVED=$2 ;;
        --subject) SUBJECT=$2 ;;
        --stem) STEM=$2 ;;
        --node) WANT_NODE=$2 ;;
        --lock) LOCK=$2 ;;
      esac
      shift 2
      ;;
    *)
      perr="unknown parameter $1 (see the top of ops/full-run.sh)"
      break
      ;;
  esac
done
case "$STEM" in '' | *[!A-Za-z0-9._-]*) STEM=full-run perr="--stem has characters a file name should not" ;; esac

unset FULL_TREE LOG_DIR FAKE_RUN_DIR CREDO_SHOTS_DIR CREDO_FAKE_DIR CREDO_REFERENCE_DIR PLAYWRIGHT_BROWSERS_PATH RUN_DIR

NODE_BIN="${NVM_DIR:-$HOME/.nvm}/versions/node/$WANT_NODE/bin"
if [ -x "$NODE_BIN/node" ]; then
  PATH="$NODE_BIN:$PATH"
  export PATH
fi

TOTAL=4
began="$(date +%s)"
n=0
elapsed() {
  local s=$(($(date +%s) - began))
  printf '%dm%02ds' $((s / 60)) $((s % 60))
}
step() {
  n=$((n + 1))
  echo "== $n/$TOTAL $1 (elapsed $(elapsed))"
}
refuse() {
  echo "== refused: $1"
  exit 2
}
red() {
  echo "== verdict: red: $1"
  echo "== done at $(date '+%H:%M:%S') (elapsed $(elapsed)); bring $LOG and the walk logs back"
  exit 1
}

# One run: its text to <out> as printed, indented "  | " into this log. The run's own log is the
# newest logs/*-walk-<walks>.log made since the run began.
walk_run() { # <n> <args…>
  local k="$1" out="$logdir/$STAMPED-run-$1.out" mark own
  shift
  mark="$logdir/.$STAMPED-mark-$k"
  : >"$mark"
  (cd "$TREE" && bash walk/run.sh "$@") 2>&1 | tee -i "$out" | (
    trap '' INT
    exec awk '{ print "  | " $0; fflush() }'
  )
  local rc="${PIPESTATUS[0]}"
  own="$(find "$logdir" -maxdepth 1 -name "*-walk-$WALKDASH.log" -newer "$mark" 2>/dev/null | sort | tail -1)"
  rm -f "$mark"
  echo "  run $k: exit $rc; walk/run.sh's own full log: ${own:-not found}; its text: $out"
  return "$rc"
}

ended_green() { # <out>
  grep -q '^== verdict: green' "$1" && grep -q '^== done' "$1"
}

main() {
  trap 'echo "== interrupted at $(elapsed)"; exit 130' INT TERM HUP
  echo "== $0 — $(date '+%Y-%m-%d %H:%M:%S %z')"

  step "the refusals"
  local branch dirty node_now owner
  [ -z "$perr" ] || refuse "$perr"
  [ -n "$TREE" ] || refuse "--worktree is required"
  [ -n "$BRANCH" ] || refuse "--branch is required"
  [ -n "$WALKS" ] || refuse "--walks is required"
  case "$WALKS" in *[!A-Za-z0-9,-]* | ,* | *, | *,,*) refuse "--walks is a comma separated list of walk names" ;; esac
  case "$MOVED" in *[!A-Za-z0-9,_-]*) refuse "--moved is a comma separated list of screens, or all" ;; esac
  [ -d "$TREE/.git" ] || [ -f "$TREE/.git" ] || refuse "$TREE is not a worktree"
  [ -f "$TREE/walk/run.sh" ] || refuse "$TREE has no walk/run.sh"
  branch="$(git -C "$TREE" rev-parse --abbrev-ref HEAD 2>&1)" || refuse "cannot read the worktree's branch: $branch"
  [ "$branch" = "$BRANCH" ] || refuse "the worktree is on '$branch', not '$BRANCH'"
  dirty="$(git -C "$TREE" status --porcelain 2>&1)" || refuse "git status failed: $dirty"
  [ -z "$dirty" ] || refuse "the tree is not clean: $(printf '%s\n' "$dirty" | head -5 | tr '\n' ';')"
  if [ -e "$LOCK" ]; then
    owner="$(cat "$LOCK/owner" 2>/dev/null || cat "$LOCK" 2>/dev/null || echo unreadable)"
    refuse "the gate lock $LOCK is held (owner: $(printf '%s' "$owner" | tr '\n' ' ')); wait for it"
  fi
  node_now="$(node --version 2>&1)"
  [ "$node_now" = "$WANT_NODE" ] || refuse "node is '$node_now', expected $WANT_NODE from nvm"
  [ "$(command -v node)" = "$NODE_BIN/node" ] || refuse "node is $(command -v node), not nvm's $NODE_BIN/node"
  echo "  $BRANCH at $(git -C "$TREE" rev-parse --short HEAD), clean; node $node_now from nvm; no gate lock"

  local walks="${WALKS//,/ }" wargs=() run1=()
  # shellcheck disable=SC2206  # the walk names hold no glob or space
  wargs=($walks)
  run1=("${wargs[@]}")
  [ -z "$MOVED" ] || run1+=(--moved "$MOVED")
  run1+=(--write)
  local subject="${SUBJECT:-test(walk): the bases of $walks}"
  if [ "$CHECK" = yes ]; then
    echo "== check only: nothing run, committed or written. It would run, in $TREE:"
    echo "  run 1: bash walk/run.sh ${run1[*]}"
    echo "  then commit only walk/specs/*-snapshots/*.png as: $subject (none, if run 1 moved no base)"
    echo "  run 2: bash walk/run.sh ${wargs[*]} --bytes <run 1's folder>   (every count 0)"
    echo "== verdict: check only"
    echo "== done at $(date '+%H:%M:%S')"
    return 0
  fi

  step "run 1 of 2: ${run1[*]} (the walks' own time)"
  walk_run 1 "${run1[@]}"
  local rc1=$?
  ended_green "$logdir/$STAMPED-run-1.out" || red "run 1 (exit $rc1) did not end '== verdict: green' and '== done'; run 2 not started; nothing to commit:
$(grep -E '^(== verdict|== refused|  (moved|red|unreadable|new|base with no picture))' "$logdir/$STAMPED-run-1.out" | head -40 | sed 's/^/    /')"
  echo "  run 1 green; the bases it wrote:"
  grep -E '^compare |bases written' "$logdir/$STAMPED-run-1.out" | sed 's/^/    /'
  # walk/run.sh refuses a dirty tree, so run 2 needs the bases committed: only walk/specs snapshot pictures.
  git -C "$TREE" add -A -- walk/specs || red "git add failed"
  local stray
  stray="$(git -C "$TREE" status --porcelain | grep -v -E '^[AMD]  walk/specs/[^/]+-snapshots/[^/]+\.png$')"
  [ -z "$stray" ] || red "the tree holds more than base pictures after run 1; nothing committed:
$(printf '%s\n' "$stray" | head -10 | sed 's/^/    /')"
  if git -C "$TREE" diff --cached --quiet; then
    echo "  run 1 moved no base: nothing to commit; at $(git -C "$TREE" log --oneline -1)"
  else
    git -C "$TREE" commit -q -m "$subject" || red "git commit failed (the bases stay staged; if gpg-agent did not start, run gpgconf --launch gpg-agent and commit them, then run walk/run.sh ${wargs[*]} --bytes <run 1's folder> yourself)"
    echo "  committed for run 2: $(git -C "$TREE" log --oneline -1)"
  fi
  local run1dir
  run1dir="$(sed -n 's/^  pictures and results in //p' "$logdir/$STAMPED-run-1.out" | tail -1)"
  [ -n "$run1dir" ] && [ -d "$run1dir" ] || red "run 1's folder could not be read from its line 'pictures and results in' (${run1dir:-no such line}); run 2 not started"

  step "run 2 of 2: ${wargs[*]} --bytes $run1dir, every count 0 (seconds)"
  walk_run 2 "${wargs[@]}" --bytes "$run1dir"
  local rc2=$?
  ended_green "$logdir/$STAMPED-run-2.out" || red "run 2 (exit $rc2) did not end '== verdict: green' and '== done':
$(grep -E '^(== verdict|== refused|  (moved|red|unreadable|new|base with no picture))' "$logdir/$STAMPED-run-2.out" | head -40 | sed 's/^/    /')"
  local bad
  bad="$(grep '^compare ' "$logdir/$STAMPED-run-2.out" | grep -v -E ', 0 moved, 0 new, 0 without a counterpart, 0 unreadable$')"
  [ -z "$bad" ] || red "run 2: a count is not 0:
$(printf '%s\n' "$bad" | sed 's/^/    /')"

  step "the verdict"
  echo "  the commit on $BRANCH: $(git -C "$TREE" log --oneline -1)"
  echo "== verdict: green: run 1 wrote the bases (moved: ${MOVED:-none}), run 2 read every count 0"
  echo "== done at $(date '+%H:%M:%S') (elapsed $(elapsed))"
}

STAMPED="$(date +%Y%m%d-%H%M)-$STEM"
WALKDASH="${WALKS//,/-}"
LOG="$logdir/$STAMPED.log"
mkdir -p "$logdir" 2>/dev/null || {
  echo "== refused: cannot make the logs folder"
  exit 2
}
main "$@" 2>&1 | tee -ai "$LOG"
exit "${PIPESTATUS[0]}"
