/**
 * DEADLINE FOUR V3.11 - client-side ADS controller.
 * Integration module: call update(dt) from game render loop, use state to drive
 * actual camera FOV and aim sensitivity. No game input bindings are changed until integrated.
 */
export type AimWeapon = {
  id: string;
  type: "pistol" | "smg" | "rifle" | "shotgun" | "sniper";
  hipFov: number;
  adsFov: number;
  aimSpeed: number;
  scopeZooms?: readonly number[];
};
export type AimSnapshot = {
  aiming: boolean;
  fov: number;
  sensitivityMultiplier: number;
  scopeIndex: number;
  zoom: number;
};
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
export class AimController {
  private weapon: AimWeapon;
  private aiming = false;
  private sprinting = false;
  private fov: number;
  private scopeIndex = 0;
  private held = false;
  constructor(weapon: AimWeapon) {
    this.weapon = weapon;
    this.fov = weapon.hipFov;
  }
  equip(weapon: AimWeapon): void {
    this.weapon = weapon;
    this.scopeIndex = 0;
    this.held = false;
    this.aiming = false;
  }
  setRightButtonHeld(held: boolean): void {
    this.held = held;
    this.aiming = held && !this.sprinting;
  }
  setSprinting(sprinting: boolean): void {
    this.sprinting = sprinting;
    this.aiming = this.held && !sprinting;
  }
  cycleScope(direction: number): boolean {
    if (!this.aiming || this.weapon.type !== "sniper") return false;
    const n = this.weapon.scopeZooms?.length ?? 0;
    if (n === 0) return false;
    this.scopeIndex = (this.scopeIndex + (direction > 0 ? 1 : -1) + n) % n;
    return true;
  }
  update(deltaSeconds: number): AimSnapshot {
    const dt = clamp(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 0.05);
    const zoom = this.weapon.type === "sniper"
      ? this.weapon.scopeZooms?.[this.scopeIndex] ?? 4
      : 1;
    const target = this.aiming && this.weapon.type === "sniper"
      ? 2 * Math.atan(Math.tan(this.weapon.hipFov * Math.PI / 360) / zoom) * 180 / Math.PI
      : this.aiming ? this.weapon.adsFov : this.weapon.hipFov;
    this.fov += (target - this.fov) * (1 - Math.exp(-this.weapon.aimSpeed * dt));
    return {
      aiming: this.aiming, fov: this.fov,
      sensitivityMultiplier: this.aiming ? (this.weapon.type === "sniper" ? 0.3 / zoom : 0.58) : 1,
      scopeIndex: this.scopeIndex, zoom,
    };
  }
  /**
   * Attach only to the actual game canvas, not document: preserve native right
   * click everywhere else. Dispose on level reload to prevent duplicate listeners.
   */
  attach(canvas: HTMLElement, onState?: (s: AimSnapshot) => void): () => void {
    const mouseDown = (e: MouseEvent) => {
      if (e.button === 2) { this.setRightButtonHeld(true); onState?.(this.update(0)); }
    };
    const mouseUp = (e: MouseEvent) => {
      if (e.button === 2) { this.setRightButtonHeld(false); onState?.(this.update(0)); }
    };
    const contextMenu = (e: MouseEvent) => { e.preventDefault(); };
    const blur = () => { this.setRightButtonHeld(false); };
    const wheel = (e: WheelEvent) => {
      if (this.cycleScope(e.deltaY > 0 ? 1 : -1)) e.preventDefault();
    };
    canvas.addEventListener("mousedown", mouseDown);
    window.addEventListener("mouseup", mouseUp);
    canvas.addEventListener("contextmenu", contextMenu);
    canvas.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("blur", blur);
    return () => {
      canvas.removeEventListener("mousedown", mouseDown);
      window.removeEventListener("mouseup", mouseUp);
      canvas.removeEventListener("contextmenu", contextMenu);
      canvas.removeEventListener("wheel", wheel);
      window.removeEventListener("blur", blur);
      this.setRightButtonHeld(false);
    };
  }
}
export const AIM_WEAPONS: Record<string, AimWeapon> = {
  assault_rifle: {id:"assault_rifle", type:"rifle", hipFov:75, adsFov:52, aimSpeed:13},
  smg: {id:"smg", type:"smg", hipFov:75, adsFov:55, aimSpeed:16},
  sniper_rifle: {id:"sniper_rifle", type:"sniper", hipFov:75, adsFov:30, aimSpeed:9, scopeZooms:[4,8]},
};
