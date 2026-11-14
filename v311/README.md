# DEADLINE FOUR V3.11 — isolated development track

Base: V3.9.2 live commit e74fa66011fa6efe3d8ce6bc6f0d74d72539d5d8.
Production `main` and Render deployment are intentionally untouched.

## Phase 0 and phase 1 foundation
- `survival-round.mjs`: dependency-free authoritative mission/extraction state transitions; deterministic mission selection; maximum 4 participants.
- Director calculations: hard limit 24 active enemies per room including specials/Boss; return per-tick spawn budget; low-resource squad relief.
- `survival-round.test.mjs`: node:test cases for transitions, mission selection, extraction, limits, cooldowns, and invalid inputs.
- Local verification command: `node --test v311/survival-round.test.mjs`.

## Important integration boundary
These files are currently isolated. Nothing imports them in the existing V3.9.2 server or client. Deploying this branch alone will NOT enable missions, boss fights or UI. The existing source is archived under `.payload` and is unpacked during Render build. Extract it into a normal source tree and then integrate explicitly with the WebSocket room lifecycle, authoritative player IDs, game clock and combat state.

## Integration contract
1. Room owns one round instance. The host/server supplies trusted player positions and health; never trust a client-submitted `inZone` flag.
2. Send phase, mission, objective progress, extraction timer and last event to clients as read-only snapshots.
3. Authoritative validation: quest objectives, loot awards, damage, skills and defense placement happen server-side.
4. Per-room 24 active enemy slots INCLUDE Boss/specials. Never exceed 2 rooms on Render Free without a separate scale test.
5. Event cooldown, anti-farming reward caps, reconnect policy and spectator handling require tests before enabling.
6. Support manual QA: four browsers, multi-floor shooting, ramp-to-rooftop, win/loss, disconnect/reconnect, and resource usage. Target 60 FPS is aspirational, not measured.

## Release gates
- Existing 69 tests unchanged and passing.
- New tests pass.
- 4-player browser soak and WebSocket consistency validated.
- Server CPU/memory, FPS and p95 latency measured.
- Only then enable the feature behind a flag on staging; production stays at V3.9.2 until separately approved.
