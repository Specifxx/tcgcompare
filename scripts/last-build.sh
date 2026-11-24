#!/usr/bin/env bash
# Prints "<sha> <commit epoch>" of the newest commit on HEAD that Vercel finished building for production (its GitHub commit
# status "Deployment has completed"; a [deploy] commit the build gate skipped says "Canceled by Ignored Build Step"), or nothing.
# The build gate (scripts/vercel-ignore-build.sh) measures its 12 hours from that commit's own time. Needs GH_TOKEN and REPO,
# and enough history checked out (fetch-depth 150). Used by freshness.yml and refresh-prices.yml (owner's UX review, 2026-11-23).
set -uo pipefail
for sha in $(git log -60 --format=%H -F -i --grep='[deploy]' HEAD); do
  d=$(gh api "repos/$REPO/commits/$sha/statuses" --jq '[.[] | select(.context == "Vercel")][0].description // ""' 2>/dev/null || true)
  case "$d" in *"Deployment has completed"*) echo "$sha $(git show -s --format=%ct "$sha")"; exit 0 ;; esac
done
exit 0
