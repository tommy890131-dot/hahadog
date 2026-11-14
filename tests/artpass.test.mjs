import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const ids = ['p9','magnum','uzi','mp5','m4','ak47','m249','pkm'];

const readGLB = (id) => {
  const bytes = fs.readFileSync(path.join(root, `apps/client/public/assets/weapons/${id}.glb`));
  assert.equal(bytes.toString('ascii',0,4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.byteLength);
  const len = bytes.readUInt32LE(12);
  assert.equal(bytes.toString('ascii',16,20), 'JSON');
  return JSON.parse(bytes.subarray(20,20+len).toString('utf8'));
};

test('eight distinct real glTF 2.0 weapons with dozens of detailed pieces and PBR materials', () => {
  const counts = [];
  for (const id of ids) {
    const glb = readGLB(id);
    assert.ok(glb.meshes?.length >= 35, `${id} not detailed enough`);
    assert.ok(glb.materials?.length >= 4, `${id} missing PBR materials`);
    assert.equal(glb.asset.version,'2.0');
    counts.push(glb.meshes.length);
  }
  assert.ok(new Set(counts).size >= 5, 'all gun silhouettes appear to have same detail pattern');
});

test('original PBR urban textures include albedo, tangent normals, and roughness', () => {
  for (const kind of ['asphalt','concrete','brick','metal']) {
    for (const channel of ['albedo','normal','roughness']) {
      const f=path.join(root,`apps/client/public/assets/materials/${kind}_${channel}.jpg`);
      assert.ok(fs.statSync(f).size>1000,`missing ${kind} ${channel}`);
      const head=fs.readFileSync(f).subarray(0,3);
      assert.equal(head[0],0xff);assert.equal(head[1],0xd8);assert.equal(head[2],0xff);
    }
  }
});

test('art pass keeps shared map and combat/economy protocol unchanged', () => {
  const cfg=JSON.parse(fs.readFileSync(path.join(root,'packages/shared/WeaponConfig.json'),'utf8'));
  const map=JSON.parse(fs.readFileSync(path.join(root,'packages/shared/MapLayout.json'),'utf8'));
  assert.equal(Object.keys(cfg).length,8);
  assert.equal(map.halfSize,90);
  const scene=fs.readFileSync(path.join(root,'apps/client/src/world/World.ts'),'utf8');
  assert.match(scene,/addCityDetails/);
  assert.match(scene,/facadeMaterial/);
});
