import * as THREE from 'three';

type Surface = 'asphalt' | 'concrete' | 'brick' | 'metal';
type Channel = 'albedo' | 'normal' | 'roughness';

/**
 * All buildings share actual Texture and MeshStandardMaterial instances.
 * The repeat factor is part of the texture cache key: setting repeat on a
 * shared Texture without a key would alter another building's UV tiling.
 */
const materialCache = new Map<string, THREE.MeshStandardMaterial>();
const textureCache = new Map<string, THREE.Texture>();
const loader = new THREE.TextureLoader();
const pending: Promise<void>[] = [];
const failed = new Set<string>();
let generation = 0;
let targetAnisotropy = 4;

const PARAMS: Record<Surface, { roughness: number; metalness: number; normal: number; env: number }> = {
  asphalt:  { roughness: .96, metalness: 0,   normal: .72, env: .38 },
  brick:    { roughness: .95, metalness: 0,   normal: .91, env: .32 },
  concrete: { roughness: .94, metalness: 0,   normal: .82, env: .33 },
  metal:    { roughness: .78, metalness: .73, normal: .66, env: .92 }
};

function texture(type: Surface, channel: Channel, repeat: number): THREE.Texture {
  const key = `${type}/${channel}/${repeat}`;
  const existing = textureCache.get(key);
  if (existing) return existing;
  const url = `/assets/materials/${type}_${channel}.jpg`;
  const epoch = generation;
  // A neutral, valid map keeps missing normal/roughness files from producing
  // black surfaces. It is explicitly reported as degraded, never as loaded art.
  const fallback = document.createElement('canvas');
  fallback.width = fallback.height = 1;
  const context = fallback.getContext('2d')!;
  context.fillStyle = channel === 'normal' ? '#8080ff' : channel === 'roughness' ? '#ffffff' : '#808080';
  context.fillRect(0,0,1,1);
  let complete!: () => void;
  pending.push(new Promise<void>(resolve => { complete = resolve; }));
  const map = loader.load(url, loaded => {
    if (epoch !== generation) loaded.dispose();
    complete();
  }, undefined, error => {
    if (epoch === generation) {
      failed.add(url);
      console.warn(`[PBR] Missing ${key}; neutral fallback active`, error);
    }
    complete();
  });
  map.image = fallback;
  map.needsUpdate = true;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeat, repeat);
  map.anisotropy = targetAnisotropy;
  map.colorSpace = channel === 'albedo' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  textureCache.set(key, map);
  return map;
}

/** Call after World and CityDetails have requested their material variants. */
export async function surfaceMaterialsReady(): Promise<readonly string[]> {
  await Promise.all(pending);
  return [...failed];
}

/** Configure texture filtering once after WebGLRenderer has been created. */
export function configureSurfaceMaterialQuality(renderer: THREE.WebGLRenderer): void {
  const supported = renderer.capabilities.getMaxAnisotropy();
  targetAnisotropy = Math.max(1, Math.min(8, supported));
  for (const map of textureCache.values()) {
    map.anisotropy = targetAnisotropy;
    map.needsUpdate = true;
  }
}

export function surfaceMaterial(type: Surface, repeat = 2): THREE.MeshStandardMaterial {
  const key = `${type}:${repeat}`;
  const existing = materialCache.get(key);
  if (existing) return existing;
  const p = PARAMS[type];
  const material = new THREE.MeshStandardMaterial({
    name: `PBR ${type} tiled ${repeat}`,
    color: 0xffffff,
    map: texture(type, 'albedo', repeat),
    normalMap: texture(type, 'normal', repeat),
    normalScale: new THREE.Vector2(p.normal, p.normal),
    roughnessMap: texture(type, 'roughness', repeat),
    roughness: p.roughness,
    metalness: p.metalness,
    envMapIntensity: p.env
  });
  materialCache.set(key, material);
  return material;
}

export function facadeMaterial(role: string): THREE.MeshStandardMaterial {
  // Clinics/hotels/shops are concrete; factories use corrugated metal.
  // The old fallback erroneously made every unrecognized building metallic.
  switch (role) {
    case 'APARTMENTS': return surfaceMaterial('brick', 2);
    case 'FACTORY': return surfaceMaterial('metal', 2);
    case 'WAREHOUSE': return surfaceMaterial('concrete', 2);
    default: return surfaceMaterial('concrete', 2);
  }
}

/** Only call after the world has been fully destroyed (not on weapon swap). */
export function disposeSharedSurfaceMaterials(): void {
  generation++;
  for (const material of materialCache.values()) material.dispose();
  for (const tex of textureCache.values()) tex.dispose();
  materialCache.clear();
  textureCache.clear();
  pending.length = 0;
  failed.clear();
}
