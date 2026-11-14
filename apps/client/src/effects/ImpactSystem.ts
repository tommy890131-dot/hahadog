import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

export type ImpactKind = 'wall' | 'flesh';
export interface ImpactEvent {
  kind: ImpactKind;
  /** All coordinates and normals MUST be in world space. */
  point: THREE.Vector3;
  normal: THREE.Vector3;
  /** Decal receiver must be a STATIC, non-instanced Mesh. */
  surface?: THREE.Mesh;
}
export interface ImpactOptions {
  maxDecals?: number;
  decalLifetime?: number;
  maxBloodParticles?: number;
  maxDustParticles?: number;
}
interface Particle { position: THREE.Vector3; velocity: THREE.Vector3; life: number; }
interface Decal { mesh: THREE.Mesh; age: number; }

// Original low-resolution procedural decal masks until artist-supplied maps exist.
function decalTexture(kind: 'bullet' | 'blood'): THREE.DataTexture {
  const n = 64, bytes = new Uint8Array(n * n * 4);
  let seed = kind === 'bullet' ? 0x1234abcd : 0xabcd1279;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = (x + .5 - n / 2) / (n / 2);
    const v = (y + .5 - n / 2) / (n / 2);
    const r = Math.hypot(u, v) / (.87 + rand() * .26);
    let rgb: [number, number, number] = [12, 12, 14], opacity = 0;
    if (kind === 'bullet') {
      if (r < .17) { rgb = [9, 9, 10]; opacity = .98; }
      else if (r < .36) { rgb = [50, 48, 45]; opacity = .67 * (1 - (r - .17) / .30); }
    } else {
      if (r < .56) { rgb = [107, 7, 13]; opacity = .75; }
      else if (r < .80 && rand() > .71) { rgb = [66, 5, 9]; opacity = .36; }
    }
    const k = (y * n + x) * 4;
    bytes.set([...rgb, Math.round(opacity * 255)], k);
  }
  const t = new THREE.DataTexture(bytes, n, n, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}
function softParticleTexture(): THREE.DataTexture {
  const n = 32, bytes = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const r = Math.hypot((x + .5 - n / 2) / (n / 2), (y + .5 - n / 2) / (n / 2));
    const k = (y * n + x) * 4;
    bytes.set([255, 255, 255, Math.round(255 * Math.min(1, Math.max(0, (1 - r) * 2.8)))], k);
  }
  const t = new THREE.DataTexture(bytes, n, n, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** One draw call per kind of particle, bounded CPU/GPU allocations. */
class ParticlePool {
  private readonly particles: Particle[] = [];
  private readonly positionArray: Float32Array;
  private readonly positions: THREE.BufferAttribute;
  private readonly geometry = new THREE.BufferGeometry();
  private readonly material: THREE.PointsMaterial;
  private readonly points: THREE.Points;
  constructor(
    private readonly scene: THREE.Scene,
    sprite: THREE.Texture,
    private readonly capacity: number,
    color: number,
    size: number
  ) {
    this.positionArray = new Float32Array(capacity * 3);
    this.positions = new THREE.BufferAttribute(this.positionArray, 3).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.positions);
    this.geometry.setDrawRange(0, 0);
    this.material = new THREE.PointsMaterial({
      color, map: sprite, size, sizeAttenuation: true,
      transparent: true, opacity: .90, depthWrite: false, alphaTest: .04
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.userData.impactEffect = true;
    scene.add(this.points);
  }
  emit(origin: THREE.Vector3, outward: THREE.Vector3, count: number, speed: number): void {
    const normal = outward.clone().normalize();
    if (normal.lengthSq() < 1e-6) normal.set(0, 1, 0);
    for (let n = 0; n < count && this.particles.length < this.capacity; n++) {
      const direction = normal.clone().multiplyScalar(.8).add(new THREE.Vector3(
        (Math.random() - .5) * 1.6,
        Math.random() * 1.1,
        (Math.random() - .5) * 1.6
      )).normalize();
      this.particles.push({
        position: origin.clone(),
        velocity: direction.multiplyScalar(speed * (.45 + Math.random())),
        life: .22 + Math.random() * .49
      });
    }
  }
  update(dt: number): void {
    const delta = Math.min(Math.max(0, dt), .05);
    let i = 0;
    while (i < this.particles.length) {
      const p = this.particles[i];
      p.life -= delta;
      if (p.life <= 0) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }
      p.velocity.y -= 9.81 * delta;
      p.position.addScaledVector(p.velocity, delta);
      i++;
    }
    for (let j = 0; j < this.particles.length; j++) {
      const q = this.particles[j].position, k = j * 3;
      this.positionArray[k] = q.x;
      this.positionArray[k + 1] = q.y;
      this.positionArray[k + 2] = q.z;
    }
    this.geometry.setDrawRange(0, this.particles.length);
    if (this.particles.length > 0) this.positions.needsUpdate = true;
  }
  dispose(): void {
    this.scene.remove(this.points);
    this.particles.length = 0;
    this.geometry.dispose();
    this.material.dispose();
  }
  get count(): number { return this.particles.length; }
}

/** Client-only VFX: NEVER awards XP, money, hits, or damage. */
export class ImpactSystem {
  private readonly decals: Decal[] = [];
  private readonly bulletTexture = decalTexture('bullet');
  private readonly bloodTexture = decalTexture('blood');
  private readonly sprite = softParticleTexture();
  private readonly bulletMat = this.makeMaterial(this.bulletTexture);
  private readonly bloodMat = this.makeMaterial(this.bloodTexture);
  private readonly blood: ParticlePool;
  private readonly dust: ParticlePool;
  private readonly maxDecals: number;
  private readonly lifetime: number;
  constructor(private readonly scene: THREE.Scene, options: ImpactOptions = {}) {
    this.maxDecals = Math.max(0, Math.floor(options.maxDecals ?? 48));
    this.lifetime = Math.max(.1, options.decalLifetime ?? 28);
    this.blood = new ParticlePool(scene, this.sprite, Math.max(0, Math.floor(options.maxBloodParticles ?? 180)), 0xa21822, .105);
    this.dust = new ParticlePool(scene, this.sprite, Math.max(0, Math.floor(options.maxDustParticles ?? 100)), 0xaaa59c, .085);
  }
  private makeMaterial(map: THREE.Texture): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
      map, transparent: true, depthWrite: false,
      side: THREE.DoubleSide, alphaTest: .025,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
  }
  onHit(event: ImpactEvent): void {
    const n = event.normal.clone().normalize();
    if (event.kind === 'flesh') {
      this.blood.emit(event.point, n, 10, 2.2);
    } else {
      if (event.surface) this.placeDecal(event.surface, event.point, n, 'bullet', .12 + Math.random() * .09);
      this.dust.emit(event.point, n, 7, 1.4);
    }
  }
  addBloodStain(surface: THREE.Mesh, point: THREE.Vector3, normal = new THREE.Vector3(0, 1, 0)): void {
    this.placeDecal(surface, point, normal, 'blood', .48 + Math.random() * .36);
  }
  private placeDecal(
    surface: THREE.Mesh, point: THREE.Vector3,
    normal: THREE.Vector3, kind: 'bullet' | 'blood', size: number
  ): void {
    if (!this.maxDecals || surface instanceof THREE.InstancedMesh || surface instanceof THREE.SkinnedMesh) return;
    surface.updateWorldMatrix(true, false);
    const n = normal.clone().normalize();
    if (n.lengthSq() < 1e-6) return;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.random() * Math.PI * 2);
    const orientation = new THREE.Euler().setFromQuaternion(q.multiply(rotation));
    const geometry = new DecalGeometry(surface, point, orientation, new THREE.Vector3(size, size, .09));
    if (!geometry.getAttribute('position')?.count) { geometry.dispose(); return; }
    const mesh = new THREE.Mesh(geometry, kind === 'bullet' ? this.bulletMat : this.bloodMat);
    mesh.renderOrder = 4;
    mesh.userData.impactEffect = true;
    this.scene.add(mesh);
    this.decals.push({ mesh, age: 0 });
    while (this.decals.length > this.maxDecals) this.removeOldest();
  }
  private removeOldest(): void {
    const old = this.decals.shift();
    if (!old) return;
    this.scene.remove(old.mesh);
    old.mesh.geometry.dispose(); // Shared textures/materials are NOT owned by individual decals.
  }
  update(dt: number): void {
    const delta = Math.min(Math.max(0, dt), .05);
    this.blood.update(delta);
    this.dust.update(delta);
    for (const decal of this.decals) decal.age += delta;
    while (this.decals.length && this.decals[0].age >= this.lifetime) this.removeOldest();
  }
  get decalCount(): number { return this.decals.length; }
  get particleCount(): number { return this.blood.count + this.dust.count; }
  dispose(): void {
    while (this.decals.length) this.removeOldest();
    this.blood.dispose(); this.dust.dispose();
    this.bulletMat.dispose(); this.bloodMat.dispose();
    this.bulletTexture.dispose(); this.bloodTexture.dispose(); this.sprite.dispose();
  }
}
