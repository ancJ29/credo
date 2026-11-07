#!/usr/bin/env bash
# walk/run.sh: the full run of the walks, one command for every walk (docs/plans/2026-10-31-walk-steady.md).
#
#   bash walk/run.sh <walk>… [--moved <screen>,…|all] [--write] [--checks] [--serial]
#   bash walk/run.sh <walk>… --bytes <a run's folder>
#
# Walks: piece-1, piece-2, admin-lists, office-orders, driver-deliveries, office-reconcile, operator, passkeys, services, root-password, team, delete-client (the table below). It takes every picture of each walk on the
# fake UI (where the walk has one), then on the stack, then on fresh stacks again, and counts raw the
# pixels that moved between the passes and against the committed base images: no threshold, no
# comparator that skips softened edges. Green means fake = stack = stack again pixel for pixel, and
# against the bases only the screens named in --moved moved.
#   --moved   the screens whose base may move (the pictures' names without language and width), or all
#   --write   after a green read only: the first stack's pictures replace the walk's bases, new ones
#             are added and retired ones removed; the machine reads git's diff and commits
#   --checks  the refusals and Playwright's listings only, then stop
#   --serial  one lane, the walks one after the other as before; the default runs the walks' lanes (the table's
#             last column) at once, each on stacks of its own, its lines prefixed "[lane n]"
#   --bytes   no browser, no stack: each walk's full-1 pictures in a finished run's folder (the line "pictures and
#             results in" of run 1) against the committed bases, byte for byte; any byte off, or a name on one
#             side only, is red. Alone: not with --write, --moved or --checks.
#
# TIME: about 15 to 20 minutes for the first three walks (a Mac with nothing else running): the fake
# passes about 2 minutes, a pass of the stacks about 6 (the operator's 18 stacks 2½, piece 2's 2½,
# piece 1's ½). A line "== n/8" prints with the time elapsed and the load; "-- stack k/K" within a pass.
# Run it in YOUR terminal, on the Mac: it opens a browser (headless Chromium). Nothing else may test on
# this Mac while it runs: it refuses on a busy Mac, and a loaded Mac moves pixels.
#
# WHAT YOU SHOULD SEE AT THE END: "== verdict: green" and "== done", exit 0. A red names every
# comparison that moved and its raw count. Exit 1 red, 2 refused before acting (a line "== refused:"),
# 130 on Ctrl-C (the verdict is still logged). The log is $ROOT_DIR/logs/<date>-walk-<walks>.log; the
# pictures, results.txt (each pass's exit and tests passed) and raw.txt (each moved picture: pixels,
# largest shade, box) are in $ROOT_DIR/walks/run-<date>-<sha>/.
#
# WHAT IT CHANGES: the folders above and the log; with --write, the walks' base images (uncommitted);
# walk/test-results and walk/playwright-report (git-ignored). Strays first: a process of credo's whose
# parent is 1 (left by a killed stack) is stopped, named; one with a live parent is someone's run, and
# the script refuses. The worktree and $ROOT_DIR come from git, never from the environment.

set -uo pipefail

# One line a walk: name | spec | its fake project (- for none) | its full project | a stack per pass
# or per test (the operator's walk makes a client by a fixed code, so each test has a stack of its
# own) | the folder of its bases | the end of a base's name after the picture's | its lane (the memo's
# measured split: piece 2; the office and driver walks; the others).
WALKS='
piece-1|piece-1.spec.ts|-|chromium|pass|walk/specs/piece-1.spec.ts-snapshots|-chromium-darwin|3
piece-2|piece-2.spec.ts|fake|full|pass|walk/specs/piece-2.spec.ts-snapshots|-full-darwin|1
admin-lists|lists.spec.ts|lists-fake|lists-full|pass|walk/specs/lists.spec.ts-snapshots|-lists-full-darwin|2
office-orders|orders.spec.ts|orders-fake|orders-full|pass|walk/specs/orders.spec.ts-snapshots|-orders-full-darwin|2
driver-deliveries|driver.spec.ts|driver-fake|driver-full|pass|walk/specs/driver.spec.ts-snapshots|-driver-full-darwin|2
office-reconcile|reconcile.spec.ts|reconcile-fake|reconcile-full|pass|walk/specs/reconcile.spec.ts-snapshots|-reconcile-full-darwin|2
operator|operator.spec.ts|operator-fake|operator-full|test|walk/specs/operator.spec.ts-snapshots|-operator-full-darwin|3
passkeys|operator-passkeys.spec.ts|passkeys-fake|passkeys-full|test|walk/specs/operator-passkeys.spec.ts-snapshots|-passkeys-full-darwin|3
services|operator-services.spec.ts|services-fake|services-full|pass|walk/specs/operator-services.spec.ts-snapshots|-services-full-darwin|3
root-password|operator-root-password.spec.ts|root-password-fake|root-password-full|test|walk/specs/operator-root-password.spec.ts-snapshots|-root-password-full-darwin|3
team|operator-team.spec.ts|team-fake|team-full|test|walk/specs/operator-team.spec.ts-snapshots|-team-full-darwin|3
delete-client|operator-delete-client.spec.ts|delete-client-fake|delete-client-full|test|walk/specs/operator-delete-client.spec.ts-snapshots|-delete-client-full-darwin|3
'
walk_field() { # <walk> <column>
  printf '%s\n' "$WALKS" | awk -F'|' -v w="$1" -v c="$2" '$1 == w { print $c }'
}
walk_names() { printf '%s\n' "$WALKS" | awk -F'|' 'NF > 1 { print $1 }'; }

self="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
tree="$(cd "$(dirname "$self")/.." && git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "== refused: $self is not inside a git worktree"
  exit 2
}
# $ROOT_DIR is the folder that holds .bare: the parent of the repository's common git folder.
common="$(git -C "$tree" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" || {
  echo "== refused: cannot read the repository's git folder from $tree"
  exit 2
}
root="$(dirname "$common")"
want_node="v26.12.1"
want_playwright="1.64"
max_load=12
gate_lock="$root/.gate-lock"
began="$(date +%s)"
# nvm loads lazily in the human's zsh, so a bash script finds Homebrew's older node: nvm's own folder
# for the wanted node goes first on PATH, exported so the stack and the walk inherit it.
node_bin="${NVM_DIR:-$HOME/.nvm}/versions/node/$want_node/bin"
if [ -x "$node_bin/node" ]; then
  PATH="$node_bin:$PATH"
  export PATH
fi
# Nothing the walk or the stack reads comes from outside (the --inside part below is this script's
# own, started with the folders it needs).
if [ "${1:-}" != "--inside" ]; then
  unset CREDO_SHOTS_DIR CREDO_FAKE_DIR CREDO_REFERENCE_DIR PLAYWRIGHT_BROWSERS_PATH RUN_DIR
fi

elapsed() {
  local s=$(($(date +%s) - began))
  printf '%dm%02ds' $((s / 60)) $((s % 60))
}
load_now() { uptime | sed -n 's/.*load averages*: *\([0-9][0-9.,]*\).*/\1/p' | tr ',' '.'; }
# One line before each comparison, as pass_of stamps a pass: the lines either side give its own time.
compare_stamp() { echo "-- compare $1 (load $(load_now); elapsed $(elapsed))"; }
plain() { sed $'s/\x1b\\[[0-9;]*m//g'; }
# The raw count and the strays' choice are TypeScript under the gate (scripts/src/walks.ts).
tool() { (cd "$tree/scripts" && node --import tsx src/walks-main.ts "$@"); }
# A title as a regular expression that matches itself, for Playwright's -g.
regex_escape() {
  # shellcheck disable=SC2016 # the sed program holds literal characters, nothing to expand
  sed 's#[][\.*^$()+?{}|/]#\\&#g'
}
walk_pw() { pnpm --filter @credo/walk exec playwright "$@"; }

# Inside a stack or the fake: one pass of one walk, run by `pnpm stack -- bash <this file> --inside
# <phase> <walk> <pattern> <k>` (phase fake, full-1 or full-2). The pictures go to CREDO_SHOTS_DIR; the
# pass's exit and tests passed go to $RUN_DIR/results.txt, and this part always ends 0: whether a pass
# is red is the outer part's to say.
if [ "${1:-}" = "--inside" ]; then
  [ -n "${RUN_DIR:-}" ] && [ -n "${CREDO_SHOTS_DIR:-}" ] || {
    echo "--inside is for this script's own stack only"
    exit 97
  }
  phase="${2:-}" walk="${3:-}" pattern="${4:-}" k="${5:-0}"
  case "$phase" in fake) project="$(walk_field "$walk" 3)" ;; *) project="$(walk_field "$walk" 4)" ;; esac
  [ -n "$project" ] && [ "$project" != - ] || exit 97
  cd "$tree" || exit 97
  trap 'echo "-- interrupted (elapsed $(elapsed))"; exit 130' INT TERM HUP
  out="$RUN_DIR/out/$phase-$walk-$k.out"
  # Playwright's own output folder, one a pass, so lanes at once do not empty each other's.
  args=(--project "$project" --reporter=list --output "$RUN_DIR/pw/$phase-$walk-$k")
  [ -z "$pattern" ] || args+=(-g "$pattern")
  walk_pw test "${args[@]}" 2>&1 </dev/null | tee "$out"
  rc="${PIPESTATUS[0]}"
  echo "$phase $walk $k $rc $(plain <"$out" | awk '/^[[:space:]]+[0-9]+ passed/ { p += $1 } END { print p + 0 }')" >>"$RUN_DIR/results.txt"
  exit 0
fi

# The log's name from the walks named; the log is appended to, every line `tee -ai`'d (-i: a Ctrl-C
# reaches the script and its children but not the tee, so the verdict lands).
names=""
for arg in "$@"; do
  case "$arg" in -*) ;; *) walk_names | grep -qx "$arg" && names="$names-$arg" ;; esac
done
logdir="$root/logs"
mkdir -p "$logdir" 2>/dev/null
log="$logdir/$(date '+%Y%m%d-%H%M')-walk${names:--none}.log"

main() {
  local interrupted="" walks=() moved="" write="" checks_only="" bytes_from="" serial=""
  trap 'interrupted="at $(elapsed)"' INT TERM HUP
  refuse() {
    echo "== refused: $1"
    exit 2
  }
  echo "== walk/run.sh $* — $(date '+%Y-%m-%d %H:%M:%S %z')"
  while [ $# -gt 0 ]; do
    case "$1" in
      --moved)
        [ $# -ge 2 ] && [ "${2#-}" = "$2" ] || refuse "--moved needs a list of screens or all"
        moved="$2"
        shift
        ;;
      --write) write=yes ;;
      --checks) checks_only=yes ;;
      --serial) serial=yes ;;
      --bytes)
        [ $# -ge 2 ] && [ "${2#-}" = "$2" ] || refuse "--bytes needs a run's folder"
        bytes_from="$2"
        shift
        ;;
      -*) refuse "unknown option $1 (walks: $(walk_names | tr '\n' ' '); options: --moved --write --checks --serial)" ;;
      *)
        walk_names | grep -qx "$1" || refuse "unknown walk '$1' (walks: $(walk_names | tr '\n' ' '))"
        walks+=("$1")
        ;;
    esac
    shift
  done
  [ ${#walks[@]} -gt 0 ] || refuse "no walk named (walks: $(walk_names | tr '\n' ' '))"

  local sha
  sha="$(git -C "$tree" rev-parse --short HEAD 2>/dev/null)" || refuse "cannot read the worktree's commit"
  local run
  run="$root/walks/run-$(date '+%Y-%m-%d-%H%M%S')-$sha"
  local results="$run/results.txt" verdicts=() reds=() red_walks=" "

  finish() { # <verdict> <exit>
    echo "== verdict: $1"
    echo "== done at $(date '+%H:%M:%S') (elapsed $(elapsed))"
    exit "$2"
  }
  stop_if_interrupted() {
    [ -z "$interrupted" ] || {
      local left
      left="$(ps -axo pid=,ppid=,command= 2>/dev/null | tool strays "$root" "$me" 2>/dev/null | tr '\n' ';')"
      [ -n "$left" ] && left="left running: $left" || left="nothing of credo's is left running"
      finish "red: interrupted $interrupted; $left; what ran is in $run" 130
    }
  }

  if [ -n "$bytes_from" ]; then
    [ -z "$write$moved$checks_only$serial" ] || refuse "--bytes stands alone: not with --write, --moved, --checks or --serial"
    # Run 2 of a full run: files only, so no browser, no stack, no load check.
    echo "== 1/2 checks (elapsed $(elapsed))"
    local dirty_b tool_name walk
    dirty_b="$(git -C "$tree" status --porcelain 2>&1)" || refuse "git status failed: $dirty_b"
    [ -z "$dirty_b" ] || refuse "the worktree is not clean: $(printf '%s\n' "$dirty_b" | head -5 | tr '\n' ';')"
    [ -d "$bytes_from" ] || refuse "$bytes_from is not a folder"
    for tool_name in node git; do
      command -v "$tool_name" >/dev/null 2>&1 || refuse "$tool_name is not installed"
    done
    [ "$(node --version 2>&1)" = "$want_node" ] || refuse "node is '$(node --version 2>&1)', expected $want_node from $node_bin"
    for walk in "${walks[@]}"; do
      ls "$bytes_from/full-1/$walk"/*.png >/dev/null 2>&1 || refuse "no pictures of $walk in $bytes_from/full-1/$walk"
    done
    echo "  $(git -C "$tree" rev-parse --abbrev-ref HEAD) at $sha, clean; reading $bytes_from"
    mkdir -p "$run" || finish "red: cannot make $run" 1
    echo "  views of the bases in $run"
    echo "== 2/2 the bytes of run 1's pictures against the bases (elapsed $(elapsed))"
    local bw bsuffix bview bbase bout brc
    for bw in "${walks[@]}"; do
      bsuffix="$(walk_field "$bw" 7)"
      bview="$run/bytes/$bw"
      mkdir -p "$bview"
      for bbase in "$tree/$(walk_field "$bw" 6)"/*.png; do
        [ -e "$bbase" ] || continue
        cp "$bbase" "$bview/$(basename "$bbase" "$bsuffix.png").png"
      done
      compare_stamp "run 1 to the bases: $bw"
      bout="$(tool compare "run 1 to the bases: $bw" "$bytes_from/full-1/$bw" "$bview" --bytes)"
      brc=$?
      echo "$bout"
      verdicts+=("$(printf '%s\n' "$bout" | sed -n 1p | sed 's/^compare //'): $(printf '%s\n' "$bout" | tail -1)")
      [ $brc -eq 0 ] || reds+=("bytes: $bw")
    done
    [ ${#reds[@]} -eq 0 ] || finish "red: $(printf '%s; ' "${reds[@]}")(bytes, against $bytes_from)" 1
    finish "green: ${#verdicts[@]} byte comparisons, every count 0" 0
  fi

  echo "== 1/6 checks (elapsed $(elapsed))"
  local tool_name
  for tool_name in pnpm node git awk ps uptime; do
    command -v "$tool_name" >/dev/null 2>&1 || refuse "$tool_name is not installed"
  done
  local node_now want_pnpm pnpm_now
  node_now="$(node --version 2>&1)"
  [ "$node_now" = "$want_node" ] || refuse "node is '$node_now' ($(command -v node)), expected $want_node from $node_bin"
  want_pnpm="$(sed -n 's/.*"packageManager": *"pnpm@\([^"+]*\).*/\1/p' "$tree/package.json" 2>/dev/null | head -1)"
  pnpm_now="$(cd "$tree" && pnpm --version 2>&1 | tail -1)"
  [ -n "$want_pnpm" ] && [ "$pnpm_now" = "$want_pnpm" ] || refuse "pnpm is '$pnpm_now', the repo's packageManager wants '${want_pnpm:-unread}'"
  local dirty
  dirty="$(git -C "$tree" status --porcelain 2>&1)" || refuse "git status failed: $dirty"
  [ -z "$dirty" ] || refuse "the worktree is not clean: $(printf '%s\n' "$dirty" | head -5 | tr '\n' ';')"
  git -C "$tree" rev-parse -q --verify MERGE_HEAD >/dev/null 2>&1 && refuse "a merge is going in the worktree"
  git -C "$tree" merge-base --is-ancestor main HEAD 2>/dev/null || refuse "main is not merged into $(git -C "$tree" rev-parse --abbrev-ref HEAD): the walks must run on main's code"
  [ -d "$tree/node_modules" ] || refuse "no node_modules in $tree: run pnpm install --offline --frozen-lockfile there first"
  [ ! -e "$gate_lock" ] || refuse "the gate lock $gate_lock is there: a gate is running; wait for it"
  local load
  load="$(load_now)"
  [ -n "$load" ] || refuse "the Mac's load could not be read from uptime"
  awk -v l="$load" -v m="$max_load" 'BEGIN { exit !(l <= m) }' || refuse "the Mac's one-minute load is $load, above $max_load: wait until it is quiet"
  local pw_version
  pw_version="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$tree/walk/node_modules/@playwright/test/package.json" 2>/dev/null | head -1)"
  case "$pw_version" in
    "$want_playwright".*) ;;
    *) refuse "Playwright is '${pw_version:-unread}', expected $want_playwright.x" ;;
  esac
  local chromium_path chromium_rev shell_dir install_hint
  chromium_path="$(cd "$tree/walk" && node --input-type=module -e "import { chromium } from '@playwright/test'; console.log(chromium.executablePath())" 2>/dev/null | tail -1)"
  install_hint="run once: pnpm --filter @credo/walk exec playwright install chromium"
  [ -n "$chromium_path" ] && [ -e "$chromium_path" ] || refuse "Playwright's Chromium is not installed (${chromium_path:-no path read}): $install_hint"
  chromium_rev="$(printf '%s' "$chromium_path" | sed -n 's#.*/chromium-\([0-9][0-9]*\)/.*#\1#p')"
  shell_dir="$(dirname "$(printf '%s' "$chromium_path" | sed 's#/chromium-[0-9][0-9]*/.*#/x#')")/chromium_headless_shell-$chromium_rev"
  [ -n "$chromium_rev" ] && [ -d "$shell_dir" ] || refuse "Playwright's headless shell is not installed (looked for ${shell_dir:-none}): $install_hint"
  # The browser read above must still be there at each pass: an install by another project here can
  # delete it mid-run. Sets browser_what to what is missing; returns 0 when something is.
  browser_what=""
  browser_gone() {
    browser_what=""
    [ -e "$chromium_path" ] || browser_what="the executable $chromium_path"
    [ -d "$shell_dir" ] || browser_what="${browser_what:+$browser_what and }the headless shell folder $shell_dir"
    [ -n "$browser_what" ]
  }
  # An install by another project deletes every browser no claim names, and a claim naming this
  # worktree dies with it: the trunk's install holds the claim. Written once if absent (a terminal
  # that can write the browser folder), checked every run.
  local claim_line
  claim_line="$(git -C "$tree" worktree list --porcelain 2>/dev/null | tool claim "$(dirname "$shell_dir")" "$chromium_rev")" ||
    refuse "$claim_line; from a terminal that can write the browser folder, once: bash $self --checks"
  echo "  $claim_line"
  echo "  node $node_now, pnpm $pnpm_now, Playwright $pw_version, Chromium r$chromium_rev; load $load (at most $max_load); no gate lock; $(git -C "$tree" rev-parse --abbrev-ref HEAD) at $sha, clean, main in"

  # Playwright's own listing of each walk's projects (placeholders for what the specs read when they
  # load; no browser needed). A stack a test: each test's title is a pattern that must match 1.
  local listing_env=(CREDO_URL=http://127.0.0.1:1 CREDO_SEED_URL=http://127.0.0.1:1 CREDO_CLIENT_CODE=x CREDO_ROOT_NAME=x CREDO_ROOT_PASSWORD=x CREDO_OPERATOR_NAME=x CREDO_OPERATOR_PASSWORD=x CREDO_SHOTS_DIR=/nonexistent)
  list_titles() { # <project> [-g pattern]: one line a test, "describe test"
    local project="$1"
    shift
    (cd "$tree/walk" && env "${listing_env[@]}" pnpm exec playwright test --list --project "$project" "$@" 2>&1 </dev/null | plain |
      awk -F' › ' '/^[[:space:]]*\[/ { print $(NF - 1) " " $NF }')
  }
  local walk project titles n pattern
  for walk in "${walks[@]}"; do
    for project in "$(walk_field "$walk" 3)" "$(walk_field "$walk" 4)"; do
      [ "$project" != - ] || continue
      titles="$(list_titles "$project")"
      n="$(printf '%s\n' "$titles" | sed '/^$/d' | wc -l | tr -d ' ')"
      [ "$n" -gt 0 ] || refuse "Playwright lists no test for project $project ($walk)"
      echo "  $walk: $project lists $n tests"
      if [ "$project" = "$(walk_field "$walk" 4)" ] && [ "$(walk_field "$walk" 5)" = test ]; then
        while IFS= read -r title; do
          pattern="$(printf '%s' "$title" | regex_escape)"
          [ "$(list_titles "$project" -g "$pattern" | sed '/^$/d' | wc -l | tr -d ' ')" = 1 ] || refuse "the pattern for '$title' does not match exactly 1 test"
        done <<<"$titles"
      fi
    done
  done

  # Nothing else of credo's running. A strays' choice from the process list: the leftovers of a
  # killed run (parent 1) are stopped below; a run with a live parent is someone's, and this refuses.
  local listing found kind pid cmd strays=() busy=() me
  # macOS's bash 3.2 has no $BASHPID: the pid of this shell is the parent of a `sh` it starts.
  me="$(sh -c 'echo $PPID')"
  listing="$(ps -axo pid=,ppid=,command= 2>&1)" || refuse "the process list could not be read (ps: $(printf '%s' "$listing" | tr '\n' ' '))"
  found="$(printf '%s\n' "$listing" | tool strays "$root" "$me")" || refuse "the process list is not readable: $found"
  while read -r kind pid cmd; do
    case "$kind" in
      stray) strays+=("$pid") && echo "  stray $pid: $cmd" ;;
      busy) busy+=("$pid") && echo "  busy $pid: $cmd" ;;
    esac
  done <<<"$found"
  [ ${#busy[@]} -eq 0 ] || refuse "another walk, stack or fake of credo's is running (pids ${busy[*]}): wait for it"
  [ -z "$checks_only" ] || finish "checks only: nothing was run (${#strays[@]} strays would be stopped)" 0

  echo "== 2/6 the strays (elapsed $(elapsed))"
  if [ ${#strays[@]} -eq 0 ]; then
    echo "  none"
  else
    for pid in "${strays[@]}"; do kill -TERM "$pid" 2>/dev/null; done
    local waited=0
    while [ $waited -lt 5 ]; do
      sleep 1
      waited=$((waited + 1))
      local alive=""
      for pid in "${strays[@]}"; do kill -0 "$pid" 2>/dev/null && alive="$alive $pid"; done
      [ -n "$alive" ] || break
    done
    for pid in "${strays[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then
        kill -KILL "$pid" 2>/dev/null
        echo "  stopped $pid (KILL after 5 s)"
      else
        echo "  stopped $pid (TERM)"
      fi
    done
  fi
  stop_if_interrupted

  mkdir -p "$run/out" || finish "red: cannot make $run" 1
  : >"$results"
  : >"$run/raw.txt"
  echo "  pictures and results in $run"
  export RUN_DIR="$run"

  # One stack (or the fake) for one pass: the exit and the tests passed are read from results.txt.
  local k=0
  pass_of() { # <phase> <walk> <pattern> <how many> <of>
    local phase="$1" w="$2" pat="$3"
    k=$((k + 1))
    [ ! -e "$gate_lock" ] || {
      echo "  the gate lock $gate_lock appeared; the lane stopped before $phase $w"
      return 3
    }
    ! browser_gone || {
      echo "  the browser is gone; the lane stopped before $phase $w"
      return 5
    }
    echo "-- stack $4/$5: $phase, $w${pat:+, $pat} (load $(load_now); elapsed $(elapsed))"
    mkdir -p "$run/$phase/$w"
    if [ "$phase" = fake ]; then
      (cd "$tree" && CREDO_SHOTS_DIR="$run/$phase/$w" pnpm fake -- bash "$self" --inside "$phase" "$w" "$pat" "$k" 2>&1 </dev/null)
    else
      # The services walk's UI is built with the build its fake shows (shared/src/demo.ts), so the page
      # names one build on the stack as it does on the fake.
      local stamp=()
      if [ "$w" = services ]; then
        local demo_build
        demo_build="$(sed -n "/^export const DEMO_SERVICES/,/^};/s/^  build: '\([0-9a-f]*\)',\$/\1/p" "$tree/shared/src/demo.ts")"
        [ -n "$demo_build" ] || {
          echo "  the fake's build could not be read from shared/src/demo.ts"
          return 4
        }
        stamp=(CREDO_BUILD="$demo_build")
      fi
      (cd "$tree" && env ${stamp[@]+"${stamp[@]}"} CREDO_SHOTS_DIR="$run/$phase/$w" pnpm stack -- bash "$self" --inside "$phase" "$w" "$pat" "$k" 2>&1 </dev/null)
    fi
    echo "  exited $? after $(elapsed)"
  }
  patterns_of() { # <walk>: one regex a line, one test each
    list_titles "$(walk_field "$1" 4)" | sed '/^$/d' | regex_escape
  }
  # Every pass of a phase for a walk must have exited 0 with all its tests passed.
  read_passes() { # <phase> <walk> <expected tests>
    local phase="$1" w="$2" want="$3" got bad
    got="$(awk -v p="$phase" -v w="$w" '$1 == p && $2 == w { n += $5 } END { print n + 0 }' "$results")"
    bad="$(awk -v p="$phase" -v w="$w" '$1 == p && $2 == w && $4 != 0 { print "pass " $3 " exit " $4 }' "$results" | tr '\n' ';')"
    echo "  $phase $w: $got of $want tests passed${bad:+; $bad}"
    if [ "$got" != "$want" ] || [ -n "$bad" ]; then
      reds+=("$phase $w took $got of $want tests${bad:+ ($bad)}")
      red_walks+="$w "
    fi
  }
  want_tests() { # <walk> <project column>
    list_titles "$(walk_field "$1" "$2")" | sed '/^$/d' | wc -l | tr -d ' '
  }

  # One lane: its walks' passes in today's order (the fakes, then the two stack phases), each on a
  # stack of its own. It runs in a subshell, so what it reads back (results.txt) is read after the join.
  lane_run() { # <walk>…
    local lw phase total_stacks done_stacks pattern
    for lw in "$@"; do
      if [ "$(walk_field "$lw" 3)" = - ]; then
        echo "  $lw has no fake"
        continue
      fi
      pass_of fake "$lw" "" 1 1 || return $?
    done
    for phase in full-1 full-2; do
      for lw in "$@"; do
        if [ "$(walk_field "$lw" 5)" = pass ]; then
          pass_of "$phase" "$lw" "" 1 1 || return $?
        else
          total_stacks="$(patterns_of "$lw" | wc -l | tr -d ' ')"
          done_stacks=0
          while IFS= read -r pattern; do
            done_stacks=$((done_stacks + 1))
            pass_of "$phase" "$lw" "$pattern" "$done_stacks" "$total_stacks" || return $?
          done <<<"$(patterns_of "$lw")"
        fi
      done
    done
  }

  # The lanes: the table's last column, or one lane for --serial; only those the walks name, in order.
  local lane_ids=() lane_walks=() lane_pgids=() li lane_of found
  for walk in "${walks[@]}"; do
    lane_of=1
    [ -n "$serial" ] || lane_of="$(walk_field "$walk" 8)"
    found=-1
    for ((li = 0; li < ${#lane_ids[@]}; li++)); do
      [ "${lane_ids[li]}" != "$lane_of" ] || found=$li
    done
    if [ "$found" -ge 0 ]; then
      lane_walks[found]="${lane_walks[found]} $walk"
    else
      lane_ids+=("$lane_of")
      lane_walks+=("$walk")
    fi
  done
  echo "== 3/6 the passes: ${#lane_ids[@]} lane(s) at once (elapsed $(elapsed))"
  # Job control gives each lane a process group of its own, so a signal from the terminal reaches this
  # script alone and this script stops the lanes (TERM to every group), whatever stopped the run.
  set -m
  for ((li = 0; li < ${#lane_ids[@]}; li++)); do
    echo "  lane ${lane_ids[$li]}: ${lane_walks[$li]}"
    {
      # shellcheck disable=SC2086  # the walk names hold no glob or space
      lane_run ${lane_walks[$li]}
      echo $? >"$run/lane-${lane_ids[$li]}.rc"
    } 2>&1 | {
      # the prefixer ignores TERM: it ends at the end of the lane's output, so a stopped lane's last lines land
      trap '' TERM
      exec awk -v p="$([ ${#lane_ids[@]} -gt 1 ] && echo "[lane ${lane_ids[$li]}] ")" '{ print p $0; fflush() }'
    } &
    jobs -p >"$run/jobs.txt"
    lane_pgids+=("$(tail -1 "$run/jobs.txt")")
  done
  stop_lanes() { # <signal>
    local g
    for g in "${lane_pgids[@]}"; do kill -s "$1" -- "-$g" 2>/dev/null; done
  }
  # Wait for every lane, its whole process group (a stack that holds the first TERM too; kill -0 on a group
  # answers 1 once all of it is gone and reaped). A signal to this script, or the gate lock appearing, stops
  # them all; one that will not stop in 10 seconds is killed. A lane's red pass stops nobody: the others finish.
  local alive g stopping="" lock_hit="" waited=0
  while :; do
    alive=""
    for g in "${lane_pgids[@]}"; do kill -0 -- "-$g" 2>/dev/null && alive=yes; done
    [ -n "$alive" ] || break
    if [ -z "$stopping" ]; then
      if [ -n "$interrupted" ]; then
        stopping=yes
      elif [ -e "$gate_lock" ]; then
        stopping=yes
        lock_hit=yes
      fi
      [ -z "$stopping" ] || stop_lanes TERM
    else
      waited=$((waited + 1))
      [ "$waited" -lt 10 ] || stop_lanes KILL
    fi
    sleep 1
  done
  wait 2>/dev/null
  set +m
  stop_if_interrupted
  [ -z "$lock_hit" ] || finish "red: the gate lock $gate_lock appeared; every lane was stopped; what ran is in $run" 1
  local lrc browser_lost=""
  for ((li = 0; li < ${#lane_ids[@]}; li++)); do
    lrc="$(cat "$run/lane-${lane_ids[$li]}.rc" 2>/dev/null || echo unread)"
    case "$lrc" in
      0) ;;
      3) finish "red: the gate lock $gate_lock appeared; lane ${lane_ids[$li]} stopped" 1 ;;
      *)
        [ "$lrc" != 5 ] || browser_lost=yes
        reds+=("lane ${lane_ids[$li]} ended with $lrc")
        # a lane that died may have read a walk of it as green when it was not: none of its walks is written
        red_walks+="${lane_walks[$li]} "
        ;;
    esac
  done
  # A browser taken during the run (a lane stopped on it, or one gone since the last pass) is said
  # once, before any count, so the reds below read as what they are and not as moved pixels.
  if [ -n "$browser_lost" ] || browser_gone; then
    [ -n "$browser_what" ] || browser_gone || browser_what="the browser read at the start"
    echo "  the browser was removed during the run: $browser_what (Chromium r$chromium_rev) is gone, so a pass without its pictures is this and not moved pixels; something deleted it, most often another project's Playwright install. Restore it: $install_hint"
    reds=("the browser was removed during the run: $browser_what" ${reds[@]+"${reds[@]}"})
  fi
  for walk in "${walks[@]}"; do
    [ "$(walk_field "$walk" 3)" = - ] || read_passes fake "$walk" "$(want_tests "$walk" 3)"
    read_passes full-1 "$walk" "$(want_tests "$walk" 4)"
    read_passes full-2 "$walk" "$(want_tests "$walk" 4)"
  done

  echo "== 4/6 the raw count: every pixel that moved (elapsed $(elapsed))"
  local w out rc base suffix view opts
  for w in "${walks[@]}"; do
    if [ "$(walk_field "$w" 3)" != - ]; then
      compare_stamp "fake to full-1: $w"
      out="$(tool compare "fake to full-1: $w" "$run/fake/$w" "$run/full-1/$w" --raw "$run/raw.txt")"
      rc=$?
      echo "$out"
      verdicts+=("$(printf '%s\n' "$out" | sed -n 1p | sed 's/^compare //'): $(printf '%s\n' "$out" | tail -1)")
      [ $rc -eq 0 ] || {
        reds+=("fake to full-1: $w")
        red_walks+="$w "
      }
    fi
    compare_stamp "full-1 to full-2: $w"
    out="$(tool compare "full-1 to full-2: $w" "$run/full-1/$w" "$run/full-2/$w" --raw "$run/raw.txt")"
    rc=$?
    echo "$out"
    verdicts+=("$(printf '%s\n' "$out" | sed -n 1p | sed 's/^compare //'): $(printf '%s\n' "$out" | tail -1)")
    [ $rc -eq 0 ] || {
      reds+=("full-1 to full-2: $w")
      red_walks+="$w "
    }
    # The bases under the pictures' names: a base's own name carries the platform and the project.
    suffix="$(walk_field "$w" 7)"
    view="$run/bases/$w"
    mkdir -p "$view"
    for base in "$tree/$(walk_field "$w" 6)"/*.png; do
      [ -e "$base" ] || continue
      cp "$base" "$view/$(basename "$base" "$suffix.png").png"
    done
    opts=(--bases --raw "$run/raw.txt")
    [ -z "$moved" ] || opts+=(--moved "$moved")
    [ -z "$write" ] || opts+=(--allow-retired)
    compare_stamp "full-1 to the bases: $w"
    out="$(tool compare "full-1 to the bases: $w" "$run/full-1/$w" "$view" "${opts[@]}")"
    rc=$?
    echo "$out"
    verdicts+=("$(printf '%s\n' "$out" | sed -n 1p | sed 's/^compare //'): $(printf '%s\n' "$out" | tail -1)")
    [ $rc -eq 0 ] || {
      reds+=("full-1 to the bases: $w")
      red_walks+="$w "
    }
  done
  stop_if_interrupted

  echo "== 5/6 the bases (elapsed $(elapsed))"
  if [ -z "$write" ]; then
    echo "  not asked (--write)"
  else
    # Each walk's bases are written on its own reads: a walk red in its own passes or comparisons, or in a
    # lane that ended red, keeps its bases as they were. The run's exit stays red whatever was written.
    local picture written
    for w in "${walks[@]}"; do
      case "$red_walks" in
        *" $w "*)
          echo "  $w: not written: the read is red"
          continue
          ;;
      esac
      suffix="$(walk_field "$w" 7)"
      rm -f "$tree/$(walk_field "$w" 6)"/*.png
      mkdir -p "$tree/$(walk_field "$w" 6)"
      written=0
      for picture in "$run/full-1/$w"/*.png; do
        cp "$picture" "$tree/$(walk_field "$w" 6)/$(basename "$picture" .png)$suffix.png"
        written=$((written + 1))
      done
      echo "  $w: $written bases written"
    done
    echo "  the machine reads git's diff and commits them (none, if the run ends red)"
  fi

  echo "== 6/6 the verdict (elapsed $(elapsed))"
  printf '  %s\n' "${verdicts[@]}"
  if [ ${#reds[@]} -eq 0 ]; then
    finish "green: ${#verdicts[@]} comparisons, every raw count as asked; results in $run" 0
  fi
  finish "red: $(printf '%s; ' "${reds[@]}")with the raw counts above; bring $log back" 1
}

main "$@" 2>&1 | tee -ai "$log"
exit "${PIPESTATUS[0]}"
