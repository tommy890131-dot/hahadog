#!/usr/bin/env bash
set -euo pipefail
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
