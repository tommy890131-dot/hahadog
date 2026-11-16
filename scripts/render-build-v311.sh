#!/usr/bin/env bash
set -euo pipefail
printf '[V3.11] Node %s, npm %s\n' "$(node --version)" "$(npm --version)"
# Render staging build: keep full 69-regression suite in GitHub Actions CI,
# but never hang the website build on a long-running worker regression.
npm install --include=dev --workspaces --no-audit --no-fund
node scripts/copy-draco.mjs
node scripts/generate-sfx.mjs
node scripts/restore-enemy-assets.mjs
node scripts/restore-player-assets.mjs
npm run build:nav
node --check server.mjs
NODE_ENV=test timeout 90s node --test v311/*.test.mjs
npm run build
node scripts/verify-render-dist.mjs
test -s apps/client/dist/index.html
echo '[V3.11] Staging build + gameplay tests complete'
