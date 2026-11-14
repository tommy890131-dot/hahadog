/**
 * V3 Step 1: weapon animation state + local responsiveness.
 * Multiplayer damage, ammo and reload completion still belong to the server.
 */
export type WeaponMode = 'Idle' | 'Fire' | 'Reload';

export interface WeaponTuning {
  id: string;
  modelPath: string;
  magazineSize: number;
  initialReserve: number;
  shotIntervalMs: number;
  reloadMs: number;
  recoilKick: number;
  automatic: boolean;
  unlimitedReserve?: boolean;
}

/** Must match V2 server.mjs until WeaponAuthority is added in Step 2. */
export const V2_RIFLE: Readonly<WeaponTuning> = {
  id: 'v2_rifle',
  modelPath: '/assets/weapons/viewmodel.glb',
  magazineSize: 30,
  initialReserve: 180,
  shotIntervalMs: 135,
  reloadMs: 1550,
  recoilKick: 0.095,
  automatic: true
};

export interface AmmoSnapshot {
  ammo: number;
  reserve: number;
  reloading: boolean;
}

const boundedInt = (n: number, max: number) =>
  Number.isFinite(n) ? Math.max(0, Math.min(max, Math.floor(n))) : 0;

export class WeaponState {
  mode: WeaponMode = 'Idle';
  ammo: number;
  reserve: number;
  readonly magazineSize: number;
  readonly tuning: Readonly<WeaponTuning>;
  readonly serverAuthoritative: boolean;
  private nextShotAt = 0;
  private reloadStartedAt = 0;
  private reloadStartAmmo = 0;
  private reloadStartReserve = 0;
  private reloadAnimationDone = false;
  private reloadServerObserved = false;
  private reloadServerConfirmed = false;
  private reloadServerAmmo: AmmoSnapshot | null = null;
  private latestServerAmmo: AmmoSnapshot | null = null;

  constructor(
    tuning: Readonly<WeaponTuning> = V2_RIFLE,
    /** Set true for V2 multiplayer: animation alone cannot grant ammo. */
    serverAuthoritative = false
  ) {
    this.tuning = tuning;
    this.serverAuthoritative = serverAuthoritative;
    this.magazineSize = tuning.magazineSize;
    this.ammo = tuning.magazineSize;
    this.reserve = tuning.initialReserve;
  }

  startFire(nowMs = performance.now()): boolean {
    if (this.mode === 'Reload' || this.ammo <= 0 || nowMs < this.nextShotAt) {
      return false;
    }
    this.ammo--;
    this.mode = 'Fire';
    this.nextShotAt = nowMs + this.tuning.shotIntervalMs;
    return true;
  }

  startReload(nowMs = performance.now()): boolean {
    if (this.mode === 'Reload' ||
      this.ammo >= this.magazineSize || this.reserve <= 0) {
      return false;
    }
    this.mode = 'Reload';
    this.reloadStartedAt = nowMs;
    this.reloadStartAmmo = this.ammo;
    this.reloadStartReserve = this.reserve;
    this.reloadAnimationDone = false;
    this.reloadServerObserved = false;
    this.reloadServerConfirmed = false;
    this.reloadServerAmmo = null;
    return true;
  }

  /** Called ONLY by AnimationMixer's matching `finished` event. */
  finish(ended: 'Fire' | 'Reload'): boolean {
    if (this.mode !== ended) return false;
    if (ended === 'Fire') {
      this.mode = 'Idle';
      return true;
    }

    this.reloadAnimationDone = true;
    if (this.serverAuthoritative) return this.tryFinishAuthoritativeReload();

    const amount = Math.min(this.magazineSize - this.ammo, this.reserve);
    this.ammo += amount;
    this.reserve -= amount;
    this.mode = 'Idle';
    return true;
  }

  /**
   * Use V2 `snapshot.players[].{ammo,reserve,reloading}`.
   * Server's updated ammo is not exposed to the weapon until the animation ends.
   */
  syncServerAmmo(snapshot: AmmoSnapshot, nowMs = performance.now()): boolean {
    if (!Number.isFinite(snapshot.ammo) || !Number.isFinite(snapshot.reserve) ||
      typeof snapshot.reloading !== 'boolean') return false;

    const incoming: AmmoSnapshot = {
      ammo: boundedInt(snapshot.ammo, this.magazineSize),
      reserve: boundedInt(snapshot.reserve, 100_000),
      reloading: snapshot.reloading
    };
    this.latestServerAmmo = incoming;

    if (this.mode !== 'Reload') {
      // Avoid abruptly correcting the magazine during a Fire animation.
      if (this.mode === 'Idle') {
        this.ammo = incoming.ammo;
        this.reserve = incoming.reserve;
        return true;
      }
      return false;
    }

    if (incoming.reloading) this.reloadServerObserved = true;

    // Server increments magazine and decrements reserve only after its own
    // reload deadline. This is a stronger signal than the animation ending.
    const ammoReplenished = incoming.ammo > this.reloadStartAmmo &&
      (incoming.reserve < this.reloadStartReserve ||
        (this.tuning.unlimitedReserve && incoming.reserve === this.reloadStartReserve)) && !incoming.reloading;
    if (ammoReplenished &&
      (this.reloadServerObserved || nowMs - this.reloadStartedAt >= this.tuning.reloadMs * 0.75)) {
      this.reloadServerConfirmed = true;
      this.reloadServerAmmo = incoming;
    }
    return this.tryFinishAuthoritativeReload();
  }

  private tryFinishAuthoritativeReload(): boolean {
    if (!this.reloadAnimationDone || !this.reloadServerConfirmed || !this.reloadServerAmmo) {
      return false;
    }
    this.ammo = this.reloadServerAmmo.ammo;
    this.reserve = this.reloadServerAmmo.reserve;
    this.mode = 'Idle';
    return true;
  }

  /** Cancel a rejected/disconnected reload rather than locking the weapon forever. */
  cancelReload(): boolean {
    if (this.mode !== 'Reload') return false;
    this.mode = 'Idle';
    if (this.latestServerAmmo) {
      this.ammo = this.latestServerAmmo.ammo;
      this.reserve = this.latestServerAmmo.reserve;
    }
    return true;
  }

  /** Call each frame in network play; returns true if recovery was required. */
  updateTimeout(nowMs = performance.now()): boolean {
    if (this.mode !== 'Reload' || !this.serverAuthoritative) return false;
    if (nowMs - this.reloadStartedAt <= Math.max(4000, this.tuning.reloadMs * 2.5)) {
      return false;
    }
    return this.cancelReload();
  }

  resetFromServer(ammo: number, reserve: number): void {
    this.mode = 'Idle';
    this.nextShotAt = 0;
    this.ammo = boundedInt(ammo, this.magazineSize);
    this.reserve = boundedInt(reserve, 100_000);
    this.latestServerAmmo = { ammo: this.ammo, reserve: this.reserve, reloading: false };
  }
}
