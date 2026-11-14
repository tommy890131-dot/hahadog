import { crosshairTargetSpread, easeToward, isCriticalHealth } from './CombatFeedbackMath';

/** HUD-only visual feedback. No combat/XP authority on the client. */
export class CombatFeedbackUI {
  private spread = 0;
  private recoil = 0;
  private hitRemain = 0;
  private hitDuration = 0.19;
  private active = false;
  private critical = false;
  private readonly root: HTMLElement;
  private readonly hitmark: HTMLElement;
  private readonly vignette: HTMLElement;
  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.root = document.getElementById('crosshair')!;
    this.hitmark = document.getElementById('hitmarker')!;
    this.vignette = document.getElementById('critical-vignette')!;
    this.canvas = canvas;
    this.setActive(false);
  }

  setActive(active: boolean): void {
    this.active = active;
    this.root.classList.toggle('hidden', !active);
    if (!active) {
      this.hitRemain = 0;
      this.hitmark.classList.remove('active', 'gold');
      this.setHealth(100, 100, 0, false);
    }
  }

  onShot(recoilScale = 1): void {
    this.recoil = Math.min(25, this.recoil + 5 + Math.max(0, recoilScale) * 4.5);
  }

  /** Call ONLY after a server-authoritative shot indicates a confirmed hit. */
  onConfirmedHit(headshot = false): void {
    if (!this.active) return;
    this.hitDuration = headshot ? 0.27 : 0.19;
    this.hitRemain = this.hitDuration;
    this.hitmark.classList.add('active');
    this.hitmark.classList.toggle('gold', headshot);
  }

  setHealth(hp: number, maxHp: number, armor: number, playing: boolean): boolean {
    const next = this.active && playing && isCriticalHealth(hp, maxHp, armor);
    if (next !== this.critical) {
      this.critical = next;
      this.vignette.classList.toggle('active', next);
      this.canvas.classList.toggle('low-health-grading', next);
    }
    return next;
  }

  update(dt: number, moving: boolean, sprinting: boolean): void {
    if (!this.active) return;
    const delta = Math.max(0, Math.min(dt, 0.06));
    this.recoil = Math.max(0, this.recoil - delta * 21);
    const target = crosshairTargetSpread(moving, sprinting, this.recoil);
    this.spread = easeToward(this.spread, target, delta, 15);
    this.root.style.setProperty('--crosshair-spread', `${this.spread.toFixed(2)}px`);

    if (this.hitRemain > 0) {
      this.hitRemain = Math.max(0, this.hitRemain - delta);
      this.hitmark.style.opacity = String(Math.min(1, this.hitRemain / 0.085));
      if (this.hitRemain <= 0) this.hitmark.classList.remove('active', 'gold');
    }
  }

  dispose(): void {
    this.setActive(false);
    this.root.style.removeProperty('--crosshair-spread');
  }
}
