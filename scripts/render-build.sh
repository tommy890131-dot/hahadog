#!/usr/bin/env bash
set -euo pipefail
# Preview-only Render build. Keep the 69 regression tests in GitHub CI.
if [[ "${V311_ENABLED:-0}" == "1" ]]; then
  exec bash scripts/render-build-v311.sh
fi
printf '\n[Render] Node %s, npm %s\n' "$(node --version)" "$(npm --version)"
# Native Render Node runtime: install packages only during BUILD, not on startup.
npm install --include=dev --workspaces --no-audit --no-fund
node scripts/copy-draco.mjs
node scripts/generate-sfx.mjs
npm run build:nav
NODE_ENV=test npm test
NODE_ENV=test node --test v311/*.test.mjs
npm run build
node scripts/verify-render-dist.mjs
printf '[Render] Build and tests complete\n'
