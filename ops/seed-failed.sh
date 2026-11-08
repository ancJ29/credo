#!/usr/bin/env bash
# ops/seed-failed.sh
# Tells the human that the nightly seed failed: opens ONE issue, or adds a comment to the one already
# open, so a week of red nights is one thread and not seven. Run by seed.yml's last job, when the
# seed job did not succeed; it needs gh, GH_TOKEN (the job's own, issues: write) and GH_REPO, and
# RUN_URL (the address of the failed run). It touches no environment and holds no AWS key.
set -euo pipefail

: "${RUN_URL:?the address of the failed run}"
TITLE="The nightly seed of ridge failed"
BODY="The scheduled seed did not finish. Run: $RUN_URL

The seed keeps the progress it made (it moves a day at a time), so the next night goes on from there; a red night that repeats needs a person. The log's last lines say which copy and why."

open=$(gh issue list --state open --search "\"$TITLE\" in:title" --json number --jq '.[0].number // empty')
if [ -n "$open" ]; then
  gh issue comment "$open" --body "Failed again. Run: $RUN_URL"
  echo "commented on issue $open"
else
  gh issue create --title "$TITLE" --body "$BODY"
  echo "opened an issue"
fi
