/** Pure HUD rules shared with lightweight Node tests. */
export function isCriticalHealth(hp: number, maxHp: number, armor: number): boolean {
  return Number.isFinite(hp) && Number.isFinite(maxHp) && maxHp > 0 &&
    Number.isFinite(armor) && armor <= 0 && hp > 0 && hp / maxHp < 0.25;
}

export function crosshairTargetSpread(
  moving: boolean, sprinting: boolean, weaponRecoil: number
): number {
  const motion = moving ? (sprinting ? 16 : 9) : 0;
  return Math.max(0, Math.min(30, motion + Math.max(0, weaponRecoil)));
}

export function easeToward(current: number, target: number, dt: number, response = 13): number {
  return current + (target - current) * (1 - Math.exp(-response * Math.max(0, dt)));
}
