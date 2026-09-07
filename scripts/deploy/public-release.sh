#!/usr/bin/env bash
# Run after review from a frozen branch. Stage and promote do not change DNS or SQL.
set -euo pipefail
mode="${1:-stage}"
[[ "$mode" == stage || "$mode" == promote ]] || { echo 'Use stage or promote.' >&2; exit 1; }
revision="$(git rev-parse HEAD)"
node scripts/deploy/validate-public.mjs
node --input-type=module -e 'import fs from "node:fs";const r=JSON.parse(fs.readFileSync("dist/solo/release.json"));if(r.commit!==process.argv[1])throw Error("Rebuild the frozen release before staging.")' "$revision"
# Handoff appends from other agents do not change the frozen runtime. Every
# delivered source file still must be committed; report unexpected changes.
git diff --exit-code -- site src public scripts/build-release.mjs vite.config.js package.json package-lock.json
if [[ "$mode" == stage ]]; then
  ssh staragent "mkdir -p /opt/staragent/public-releases/$revision/solo /opt/staragent/public-releases/$revision/site"
  rsync -az dist/solo/ "staragent:/opt/staragent/public-releases/$revision/solo/"
  rsync -az site/ "staragent:/opt/staragent/public-releases/$revision/site/"
  printf 'Staged %s. Validate assets and the Caddy configuration before promotion.\n' "$revision"
else
  ssh staragent "test -f /opt/staragent/public-releases/$revision/solo/index.html && test -f /opt/staragent/public-releases/$revision/site/index.html && ln -sfn /opt/staragent/public-releases/$revision /opt/staragent/public-current.next && mv -Tf /opt/staragent/public-current.next /opt/staragent/public-current"
  printf 'Promoted %s. Verify all public HTTPS hosts.\n' "$revision"
fi
