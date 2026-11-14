import * as THREE from 'three';

/** One small shared roughness texture for original glTF metal parts.
 * GLTF materials with their own roughness maps take priority. */
let scratchRoughness: THREE.DataTexture | null = null;
function getScratchMap(): THREE.DataTexture {
  if (scratchRoughness) return scratchRoughness;
  const n = 128, data = new Uint8Array(n * n * 4);
  let seed = 0x7e314b2a;
  const next = () => {seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296;};
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const noise = next();
    const ridge = ((x + Math.floor(y * .43)) % 31) <= 1;
    const scratch = ridge && next() > .38;
    const g = Math.min(255, Math.max(90, Math.round(207 + (noise - .5) * 34 + (scratch ? 34 : 0))));
    const i = (y * n + x) * 4;
    data[i] = 255; data[i + 1] = g; data[i + 2] = 255; data[i + 3] = 255;
  }
  scratchRoughness = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  scratchRoughness.colorSpace = THREE.NoColorSpace;
  scratchRoughness.wrapS = scratchRoughness.wrapT = THREE.RepeatWrapping;
  scratchRoughness.magFilter = THREE.LinearFilter;
  scratchRoughness.minFilter = THREE.LinearMipmapLinearFilter;
  scratchRoughness.generateMipmaps = true;
  scratchRoughness.needsUpdate = true;
  return scratchRoughness;
}

export function enhanceGunMetal(material: THREE.Material): THREE.Material {
  if (!(material instanceof THREE.MeshStandardMaterial)) return material;
  material.envMapIntensity = material.metalness >= .55 ? 1.05 : .5;
  if (material.metalness >= .55 && !material.roughnessMap) {
    material.roughness = THREE.MathUtils.clamp(material.roughness, .40, .67);
    material.roughnessMap = getScratchMap();
    material.needsUpdate = true;
  }
  return material;
}
