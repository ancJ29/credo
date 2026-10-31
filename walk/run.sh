#!/usr/bin/env bash
# walk/run.sh: the full run of the walks, one command for every walk (docs/plans/2026-10-31-walk-steady.md).
#
#   bash walk/run.sh <walk>… [--moved <screen>,…|all] [--write] [--checks]
#
# Walks: piece-1, piece-2, operator (the table below). It takes every picture of each walk on the
# fake UI (where the walk has one), then on the stack, then on fresh stacks again, and counts raw the
# pixels that moved between the passes and against the committed base images: no threshold, no
# comparator that skips softened edges. Green means fake = stack = stack again pixel for pixel, and
# against the bases only the screens named in --moved moved.
#   --moved   the screens whose base may move (the pictures' names without language and width), or all
#   --write   after a green read only: the first stack's pictures replace the walk's bases, new ones
#             are added and retired ones removed; the machine reads git's diff and commits
#   --checks  the refusals and Playwright's listings only, then stop
#
# TIME: about 15 to 20 minutes for all three walks (a Mac with nothing else running): the fake
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
# own) | the folder of its bases | the end of a base's name after the picture's.
WALKS='
piece-1|piece-1.spec.ts|-|chromium|pass|walk/specs/piece-1.spec.ts-snapshots|-chromium-darwin
piece-2|piece-2.spec.ts|fake|full|pass|walk/specs/piece-2.spec.ts-snapshots|-full-darwin
operator|operator.spec.ts|operator-fake|operator-full|test|walk/specs/operator.spec.ts-snapshots|-operator-full-darwin
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
  args=(--project "$project" --reporter=list)
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
  local interrupted="" walks=() moved="" write="" checks_only=""
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
      -*) refuse "unknown option $1 (walks: $(walk_names | tr '\n' ' '); options: --moved --write --checks)" ;;
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
  local results="$run/results.txt" verdicts=() reds=()

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

  echo "== 1/8 checks (elapsed $(elapsed))"
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

  echo "== 2/8 the strays (elapsed $(elapsed))"
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
    stop_if_interrupted
    [ ! -e "$gate_lock" ] || finish "red: the gate lock $gate_lock appeared; the run stopped before $phase $w" 1
    echo "-- stack $4/$5: $phase, $w${pat:+, $pat} (load $(load_now); elapsed $(elapsed))"
    mkdir -p "$run/$phase/$w"
    if [ "$phase" = fake ]; then
      (cd "$tree" && CREDO_SHOTS_DIR="$run/$phase/$w" pnpm fake -- bash "$self" --inside "$phase" "$w" "$pat" "$k" 2>&1 </dev/null)
    else
      (cd "$tree" && CREDO_SHOTS_DIR="$run/$phase/$w" pnpm stack -- bash "$self" --inside "$phase" "$w" "$pat" "$k" 2>&1 </dev/null)
    fi
    echo "  exited $? after $(elapsed)"
    stop_if_interrupted
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
    fi
  }
  want_tests() { # <walk> <project column>
    list_titles "$(walk_field "$1" "$2")" | sed '/^$/d' | wc -l | tr -d ' '
  }

  echo "== 3/8 the fake's pictures (elapsed $(elapsed))"
  for walk in "${walks[@]}"; do
    if [ "$(walk_field "$walk" 3)" = - ]; then
      echo "  $walk has no fake"
      continue
    fi
    pass_of fake "$walk" "" 1 1
    read_passes fake "$walk" "$(want_tests "$walk" 3)"
  done

  local phase total_stacks done_stacks
  for phase in full-1 full-2; do
    if [ "$phase" = full-1 ]; then echo "== 4/8 the pictures on the stack (elapsed $(elapsed))"; else echo "== 5/8 the pictures on fresh stacks again (elapsed $(elapsed))"; fi
    for walk in "${walks[@]}"; do
      if [ "$(walk_field "$walk" 5)" = pass ]; then
        pass_of "$phase" "$walk" "" 1 1
      else
        total_stacks="$(patterns_of "$walk" | wc -l | tr -d ' ')"
        done_stacks=0
        while IFS= read -r pattern; do
          done_stacks=$((done_stacks + 1))
          pass_of "$phase" "$walk" "$pattern" "$done_stacks" "$total_stacks"
        done <<<"$(patterns_of "$walk")"
      fi
      read_passes "$phase" "$walk" "$(want_tests "$walk" 4)"
    done
  done

  echo "== 6/8 the raw count: every pixel that moved (elapsed $(elapsed))"
  local w out rc base suffix view opts
  for w in "${walks[@]}"; do
    if [ "$(walk_field "$w" 3)" != - ]; then
      out="$(tool compare "fake to full-1: $w" "$run/fake/$w" "$run/full-1/$w" --raw "$run/raw.txt")"
      rc=$?
      echo "$out"
      verdicts+=("$(printf '%s\n' "$out" | sed -n 1p | sed 's/^compare //'): $(printf '%s\n' "$out" | tail -1)")
      [ $rc -eq 0 ] || reds+=("fake to full-1: $w")
    fi
    out="$(tool compare "full-1 to full-2: $w" "$run/full-1/$w" "$run/full-2/$w" --raw "$run/raw.txt")"
    rc=$?
    echo "$out"
    verdicts+=("$(printf '%s\n' "$out" | sed -n 1p | sed 's/^compare //'): $(printf '%s\n' "$out" | tail -1)")
    [ $rc -eq 0 ] || reds+=("full-1 to full-2: $w")
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
    out="$(tool compare "full-1 to the bases: $w" "$run/full-1/$w" "$view" "${opts[@]}")"
    rc=$?
    echo "$out"
    verdicts+=("$(printf '%s\n' "$out" | sed -n 1p | sed 's/^compare //'): $(printf '%s\n' "$out" | tail -1)")
    [ $rc -eq 0 ] || reds+=("full-1 to the bases: $w")
  done
  stop_if_interrupted

  echo "== 7/8 the bases (elapsed $(elapsed))"
  if [ -z "$write" ]; then
    echo "  not asked (--write)"
  elif [ ${#reds[@]} -gt 0 ]; then
    echo "  not written: the read is red"
  else
    local picture written
    for w in "${walks[@]}"; do
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
    echo "  the machine reads git's diff and commits them"
  fi

  echo "== 8/8 the verdict (elapsed $(elapsed))"
  printf '  %s\n' "${verdicts[@]}"
  if [ ${#reds[@]} -eq 0 ]; then
    finish "green: ${#verdicts[@]} comparisons, every raw count as asked; results in $run" 0
  fi
  finish "red: $(printf '%s; ' "${reds[@]}")with the raw counts above; bring $log back" 1
}

main "$@" 2>&1 | tee -ai "$log"
exit "${PIPESTATUS[0]}"
