# DEADLINE FOUR V3.9.2 — Render deployment

Four-player 3D cooperative zombie shooter, Three.js + TypeScript + Node.js + WebSocket.

## Source packaging

The full **123-file source tree** is preserved in a SHA-256-verified Brotli archive under `.payload/part001.b64` through `.payload/part022.b64`. This packaging is needed for safe transfer through the connected GitHub API without direct git push access. `bootstrap.mjs` restores source files into the Render build directory and verifies SHA-256 before extraction. The extracted tree includes the TypeScript source, building layout, assets, server, tests, and Render build scripts. For ordinary maintenance, prefer committing the unpacked tree to the repository in a follow-up change.

## Render service configuration

- Plan: Free; region: Singapore
- Build: `node bootstrap.mjs && bash scripts/render-build.sh`
- Start: `npm start`
- Health: `/health`
- Free-tier limits: up to 2 rooms; up to 24 active zombies per room; 4 players per room

The build installs npm dependencies, validates 69 automated Node tests, builds Vite, and validates output. The original Railway deployment is untouched.

## Current limitations

Free Render service sleeps when idle. Rooms reset on instance restart. High-load zombie pathfinding may need profiling. Browser multiplayer gameplay needs live validation after Render build succeeds.
