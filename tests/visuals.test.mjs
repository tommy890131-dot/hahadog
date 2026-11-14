import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const base = path.resolve(import.meta.dirname, '..');
const read = p => fs.readFileSync(path.join(base, p), 'utf8');

test('bundled original RGBE night HDRI is a valid 192x96 HDR header', () => {
  const buf = fs.readFileSync(path.join(base, 'apps/client/public/assets/hdri/overcast_night.hdr'));
  assert.ok(buf.byteLength > 50000);
  const header = buf.subarray(0,200).toString('ascii');
  assert.match(header, /^#\?RADIANCE/);
  assert.match(header, /FORMAT=32-bit_rle_rgbe/);
  assert.match(header, /-Y 96 \+X 192/);
});

test('visual effects are driven by server shot messages, not by client kill claims', () => {
  const game = read('apps/client/src/main.ts');
  const bridge = read('apps/client/src/effects/ShotImpactBridge.ts');
  assert.match(game, /shotFx\.onServerShot\(event\)/);
  assert.match(bridge, /event\.type !== 'shot'/);
  assert.match(bridge, /event\.hit === true/);
  assert.match(bridge, /intersectObjects\(this\.world\.blockers, false\)/);
  assert.match(bridge, /addBloodStain/);
  const server = read('server.mjs');
  assert.match(server, /type:'shot',by:p\.id/);
});

test('impact VFX use bounded pools, shared decals, and dispose geometry', () => {
  const impact = read('apps/client/src/effects/ImpactSystem.ts');
  assert.match(impact, /maxDecals \?\? 48/);
  assert.match(impact, /maxBloodParticles \?\? 180/);
  assert.match(impact, /maxDustParticles \?\? 100/);
  assert.match(impact, /DecalGeometry\(/);
  assert.match(impact, /old\.mesh\.geometry\.dispose\(\)/);
  assert.match(impact, /surface instanceof THREE\.InstancedMesh/);
});

test('ACES + sRGB + HDRI and KTX2/Basis fallback are wired', () => {
  const render = read('apps/client/src/core/RendererSetup.ts');
  assert.match(render, /ACESFilmicToneMapping/);
  assert.match(render, /SRGBColorSpace/);
  assert.match(render, /RGBELoader/);
  assert.match(render, /PMREMGenerator/);
  assert.match(read('apps/client/src/main.ts'), /configurePhotorealRenderer/);
  assert.match(read('apps/client/src/assets/AssetManager.ts'), /KTX2Loader/);
  assert.match(read('scripts/copy-draco.mjs'), /basis_transcoder\.wasm/);
});

test('weapon metallic parts share micro-scratch roughness response',()=>{
  assert.match(read('apps/client/src/game/WeaponViewmodel.ts'),/enhanceGunMetal/);
  assert.match(read('apps/client/src/game/MetalDetail.ts'),/roughnessMap = getScratchMap/);
  assert.match(read('apps/client/src/game/MetalDetail.ts'),/envMapIntensity/);
});
