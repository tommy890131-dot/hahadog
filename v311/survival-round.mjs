// DEADLINE FOUR V3.11 - deterministic server-side survival round core.
// Dependency-free and deliberately not wired into production until integration tests pass.
export const MISSION_TYPES = Object.freeze(["restore_power", "recover_supplies", "activate_radio"]);
export const ROUND_PHASE = Object.freeze({
  PREP: "prep", OBJECTIVES: "objectives", EXTRACTION: "extraction", WON: "won", LOST: "lost",
});
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const assertFinite = (n, key) => {
  if (!Number.isFinite(n)) throw new TypeError(`${key} must be finite`);
  return n;
};
export function createRound({ seed = 1, now = 0, prepMs = 45000, extractionMs = 90000 } = {}) {
  assertFinite(seed, "seed"); assertFinite(now, "now");
  if (!Number.isInteger(prepMs) || prepMs < 0 || !Number.isInteger(extractionMs) || extractionMs <= 0) {
    throw new RangeError("invalid round durations");
  }
  const mission = MISSION_TYPES[(Math.trunc(seed) >>> 0) % MISSION_TYPES.length];
  return {
    seed: Math.trunc(seed) >>> 0,
    mission, phase: ROUND_PHASE.PREP,
    createdAt: now, prepEndsAt: now + prepMs, extractionMs,
    objectiveComplete: false, extractionEndsAt: null,
    extractionZone: "roof", players: {},
  };
}
export function enterPlayer(round, playerId) {
  if (!playerId || typeof playerId !== "string") throw new TypeError("invalid playerId");
  if (Object.keys(round.players).length >= 4 && !round.players[playerId]) return false;
  if (!round.players[playerId]) round.players[playerId] = { alive: true, inZone: false };
  return true;
}
export function setPlayerState(round, playerId, { alive, inZone } = {}) {
  const player = round.players[playerId];
  if (!player) return false;
  if (typeof alive === "boolean") player.alive = alive;
  if (typeof inZone === "boolean") player.inZone = inZone;
  return true;
}
export function completeObjective(round) {
  if (round.phase !== ROUND_PHASE.OBJECTIVES) return false;
  round.objectiveComplete = true;
  return true;
}
export function stepRound(round, now) {
  assertFinite(now, "now");
  if (round.phase === ROUND_PHASE.WON || round.phase === ROUND_PHASE.LOST) return round.phase;
  if (round.phase === ROUND_PHASE.PREP && now >= round.prepEndsAt) round.phase = ROUND_PHASE.OBJECTIVES;
  const players = Object.values(round.players);
  if (players.length && players.every(p => !p.alive)) {
    round.phase = ROUND_PHASE.LOST;
    return round.phase;
  }
  if (round.phase === ROUND_PHASE.OBJECTIVES && round.objectiveComplete) {
    round.phase = ROUND_PHASE.EXTRACTION;
    round.extractionEndsAt = now + round.extractionMs;
  }
  if (round.phase === ROUND_PHASE.EXTRACTION) {
    // The server decides who is present and alive; clients cannot submit a victory.
    if (players.length > 0 && players.some(p => p.alive) &&
        players.every(p => !p.alive || p.inZone)) round.phase = ROUND_PHASE.WON;
    else if (now >= round.extractionEndsAt) round.phase = ROUND_PHASE.LOST;
  }
  return round.phase;
}
export function computeThreat({ healthRatio = 1, ammoRatio = 1, progress = 0, noise = 0, activeEnemies = 0, cap = 24 } = {}) {
  for (const [key, value] of Object.entries({healthRatio, ammoRatio, progress, noise, activeEnemies, cap})) {
    assertFinite(value, key);
  }
  if (cap <= 0) throw new RangeError("cap must be positive");
  // Give low-resource squads a break; progress and loud play add pressure.
  const vulnerability = (1 - clamp(healthRatio, 0, 1)) * 0.25
    + (1 - clamp(ammoRatio, 0, 1)) * 0.2;
  const intensity = clamp(0.12 + clamp(progress,0,1) * 0.38
    + clamp(noise,0,1) * 0.32 - vulnerability, 0.05, 0.9);
  const budget = Math.max(0, Math.min(Math.floor(cap), Math.floor(cap * intensity) - Math.floor(activeEnemies)));
  return { intensity, spawnBudget: budget, maxActiveEnemies: Math.floor(cap) };
}
export function chooseEvent({ seed = 1, threat = 0.25, cooldownReady = true } = {}) {
  if (!cooldownReady) return null;
  assertFinite(seed, "seed"); assertFinite(threat, "threat");
  const events = threat > 0.6 ? ["horde", "blackout", "supply_drop"] : ["supply_drop", "fog", "radio_signal"];
  return events[(Math.trunc(seed) >>> 0) % events.length];
}
