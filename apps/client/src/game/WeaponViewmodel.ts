import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import type { WeaponAsset } from '../assets/AssetManager';
import { enhanceGunMetal } from './MetalDetail';
import {
  WeaponState, V2_RIFLE,
  type AmmoSnapshot, type WeaponMode, type WeaponTuning
} from './WeaponState';

/**
 * All movement layers are camera-local:
 * camera -> socket -> sway -> recoil -> animationRoot -> skinned GLB.
 * This prevents root-motion keyframes from overwriting mouse sway or recoil.
 */
export interface ViewmodelOptions {
  tuning?: Readonly<WeaponTuning>;
  serverAuthoritative?: boolean;
}

const vTrack = (times: number[], values: number[]) =>
  new THREE.VectorKeyframeTrack('.position', times, values);

/** Fallback clips animate the root wrapper even if the GLB has no skeleton. */
function proceduralClip(mode: WeaponMode): THREE.AnimationClip {
  if (mode === 'Idle') {
    return new THREE.AnimationClip('Idle', 1.2, [
      vTrack([0, 0.6, 1.2], [0, 0, 0, 0, 0.006, 0, 0, 0, 0])
    ]);
  }
  if (mode === 'Fire') {
    return new THREE.AnimationClip('Fire', 0.125, [
      vTrack([0, 0.035, 0.125], [0, 0, 0, 0, 0.008, 0.065, 0, 0, 0])
    ]);
  }

  const eulers = [
    [0, 0, 0], [-0.48, 0.04, -0.30], [-0.53, 0.04, -0.35], [0, 0, 0]
  ] as const;
  const rotations = eulers.flatMap(([x, y, z]) => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
    return [q.x, q.y, q.z, q.w];
  });
  return new THREE.AnimationClip('Reload', 1, [
    vTrack([0, 0.20, 0.65, 1], [
      0, 0, 0, 0.02, -0.18, 0.10, 0.02, -0.20, 0.11, 0, 0, 0
    ]),
    new THREE.QuaternionKeyframeTrack('.quaternion', [0, 0.20, 0.65, 1], rotations)
  ]);
}

function findClip(clips: THREE.AnimationClip[], mode: WeaponMode): THREE.AnimationClip | null {
  const labels: Record<WeaponMode, string[]> = {
    Idle: ['idle', 'stand', 'rest'],
    Fire: ['fire', 'shoot', 'shot'],
    Reload: ['reload', 'magazine', 'magchange']
  };
  const wanted = labels[mode];
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return clips.find(c => wanted.includes(clean(c.name))) ??
    clips.find(c => wanted.some(key => clean(c.name).endsWith(key))) ?? null;
}

export class WeaponViewmodel {
  readonly state: WeaponState;
  readonly socket = new THREE.Group();
  readonly usesPlaceholder: boolean;

  private swayRig = new THREE.Group();
  private recoilRig = new THREE.Group();
  private animationRoot = new THREE.Group();
  private modelInstance: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private actions: Record<WeaponMode, THREE.AnimationAction>;
  private activeAction: THREE.AnimationAction | null = null;
  private onHudChange: () => void;
  private muzzleLight: THREE.PointLight;
  private muzzleFlash: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private seconds = 0;
  private recoil = 0;
  private recoilSide = 0;
  private flashRemain = 0;
  private disposed = false;

  constructor(
    private readonly camera: THREE.Camera,
    asset: WeaponAsset,
    onHudChange: () => void,
    options: ViewmodelOptions = {}
  ) {
    const tuning = options.tuning ?? V2_RIFLE;
    this.state = new WeaponState(tuning, options.serverAuthoritative ?? false);
    this.onHudChange = onHudChange;
    this.usesPlaceholder = asset.isPlaceholder;

    this.socket.position.set(0.40, -0.36, -0.68);
    this.socket.rotation.y = -0.06;
    this.camera.add(this.socket);
    this.socket.add(this.swayRig);
    this.swayRig.add(this.recoilRig);
    this.recoilRig.add(this.animationRoot);

    // Rig-safe clone: correct Skeleton and SkinnedMesh bone bindings.
    this.modelInstance = SkeletonUtils.clone(asset.model);
    this.animationRoot.add(this.modelInstance);
    this.modelInstance.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.frustumCulled = false;
        obj.castShadow = false;
        obj.receiveShadow = false;
        obj.renderOrder = 9999;
        const overlayMaterial = (mat: THREE.Material) => {
          const cloned = mat.clone();
          cloned.depthTest = false;
          cloned.depthWrite = false;
          return enhanceGunMetal(cloned);
        };
        obj.material = Array.isArray(obj.material)
          ? obj.material.map(overlayMaterial)
          : overlayMaterial(obj.material);
      }
    });

    this.muzzleLight = new THREE.PointLight(0xffa54b, 0, 3.5);
    this.muzzleLight.position.set(0, 0.015, -0.80);
    this.recoilRig.add(this.muzzleLight);

    this.muzzleFlash = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 6),
      new THREE.MeshBasicMaterial({
        color: 0xffd083, transparent: true, opacity: 0,
        depthTest: false, depthWrite: false
      })
    );
    this.muzzleFlash.position.set(0, 0.015, -0.90);
    this.muzzleFlash.renderOrder = 10000;
    this.recoilRig.add(this.muzzleFlash);

    this.mixer = new THREE.AnimationMixer(this.animationRoot);
    const actionFor = (mode: WeaponMode) =>
      this.mixer.clipAction(findClip(asset.animations, mode) ?? proceduralClip(mode));

    this.actions = {
      Idle: actionFor('Idle'),
      Fire: actionFor('Fire'),
      Reload: actionFor('Reload')
    };
    this.actions.Idle.setLoop(THREE.LoopRepeat, Infinity);
    this.actions.Fire.setLoop(THREE.LoopOnce, 1);
    this.actions.Reload.setLoop(THREE.LoopOnce, 1);
    // Keep the final reload pose until authoritative ammo arrives.
    this.actions.Reload.clampWhenFinished = true;

    this.mixer.addEventListener('finished', this.onFinished);
    this.play('Idle');
    this.onHudChange();
  }

  private onFinished = (event: { action: THREE.AnimationAction }): void => {
    if (this.disposed) return;
    if (event.action === this.actions.Fire && this.state.finish('Fire')) {
      this.play('Idle');
    } else if (event.action === this.actions.Reload) {
      if (this.state.finish('Reload')) this.play('Idle');
      // Otherwise wait for authoritative reload completion; keep the weapon locked.
    }
    this.onHudChange();
  };

  private play(mode: WeaponMode): void {
    const next = this.actions[mode];
    if (this.activeAction && this.activeAction !== next) {
      this.activeAction.fadeOut(mode === 'Fire' ? 0.025 : 0.075);
    }
    // Restarting a Fire action is allowed even if its previous shot is still playing.
    if (this.activeAction === next) next.stop();
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);
    if (mode === 'Reload') next.setDuration(this.state.tuning.reloadMs / 1000);
    next.fadeIn(mode === 'Fire' ? 0.025 : 0.075).play();
    this.activeAction = next;
  }

  /** Visual shot is immediate; server still decides ammo consumption and hits. */
  fire(nowMs = performance.now()): boolean {
    if (!this.state.startFire(nowMs)) return false;
    this.play('Fire');
    this.recoil = Math.min(0.25, this.recoil + this.state.tuning.recoilKick);
    this.recoilSide += Math.sin(nowMs * 0.013) * 0.009;
    this.flashRemain = 0.060;
    this.onHudChange();
    return true;
  }

  reload(nowMs = performance.now()): boolean {
    if (!this.state.startReload(nowMs)) return false;
    this.play('Reload');
    this.onHudChange();
    return true;
  }

  /** Call from the existing V2 WebSocket snapshot event. */
  syncServerAmmo(snapshot: AmmoSnapshot, nowMs = performance.now()): void {
    const previous = this.state.mode;
    this.state.syncServerAmmo(snapshot, nowMs);
    if (previous === 'Reload' && this.state.mode === 'Idle') this.play('Idle');
    this.onHudChange();
  }

  resetFromServer(ammo: number, reserve: number): void {
    this.state.resetFromServer(ammo, reserve);
    this.play('Idle');
    this.onHudChange();
  }

  update(dt: number, lookDX: number, lookDY: number, moving: boolean): void {
    if (this.disposed) return;
    const step = THREE.MathUtils.clamp(dt, 0, 0.05);
    this.seconds += step;
    this.mixer.update(step);

    if (this.state.updateTimeout(performance.now())) {
      this.play('Idle');
      this.onHudChange();
    }

    const alpha = 1 - Math.exp(-11 * step);
    const swayYaw = THREE.MathUtils.clamp(-lookDX * 0.0014, -0.065, 0.065);
    const swayPitch = THREE.MathUtils.clamp(-lookDY * 0.0010, -0.06, 0.06);
    this.swayRig.rotation.y += (swayYaw - this.swayRig.rotation.y) * alpha;
    this.swayRig.rotation.x += (swayPitch - this.swayRig.rotation.x) * alpha;
    const bob = moving ? Math.sin(this.seconds * 11) * 0.010 : 0;
    const horizontalBob = moving ? Math.cos(this.seconds * 5.5) * 0.006 : 0;
    this.swayRig.position.y += (bob - this.swayRig.position.y) * alpha;
    this.swayRig.position.x += (horizontalBob - this.swayRig.position.x) * alpha;

    this.recoil = THREE.MathUtils.damp(this.recoil, 0, 10, step);
    this.recoilSide = THREE.MathUtils.damp(this.recoilSide, 0, 12, step);
    this.recoilRig.position.z = this.recoil;
    this.recoilRig.rotation.x = -this.recoil * 0.95;
    this.recoilRig.rotation.y = this.recoilSide;

    this.flashRemain = Math.max(0, this.flashRemain - step);
    const glow = this.flashRemain / 0.060;
    this.muzzleLight.intensity = glow * 12;
    this.muzzleFlash.material.opacity = glow * 0.85;
    this.muzzleFlash.scale.setScalar(0.6 + glow * 0.75);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer.removeEventListener('finished', this.onFinished);
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.animationRoot);
    this.camera.remove(this.socket);
    this.modelInstance.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach(mat => mat.dispose());
        // SkeletonUtils.clone shares GLB geometry; only procedural geometry is owned here.
        if (this.usesPlaceholder) obj.geometry.dispose();
      }
    });
    this.muzzleFlash.geometry.dispose();
    this.muzzleFlash.material.dispose();
  }
}
