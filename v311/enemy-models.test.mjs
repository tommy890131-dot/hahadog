import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const types=['walker','runner','brute','spitter','boss'];
const root=new URL('../apps/client/public/models/enemies/',import.meta.url);
function glb(name){
  const filepath=new URL(name+'.glb',root);
  assert.ok(existsSync(filepath),'Missing original GLB '+name);
  const buffer=readFileSync(filepath);
  assert.equal(buffer.subarray(0,4).toString('ascii'),'glTF');
  assert.equal(buffer.readUInt32LE(8),buffer.byteLength);
  assert.equal(buffer.readUInt32LE(16),0x4E4F534A);
  return JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)).toString('utf8'));
}
test('all four original H17 crowd models and the Tyrant boss GLB are restored and valid',()=>{
  for(const type of types){
    const asset=glb(type);
    assert.equal(asset.asset.version,'2.0');
    assert.ok(asset.meshes.length>=1);
    assert.ok(asset.nodes.length>=1);
    assert.equal(asset.animations?.length??0,0,'Asset is a static original; no fabricated skeleton animation');
  }
});
test('H17 CrowdStatic uses one merged low-poly mesh with original per-vertex colors',()=>{
  for(const type of types.slice(0,4)){
    const a=glb(type);
    assert.equal(a.meshes.length,1);
    assert.equal(a.skins?.length??0,0);
    const p=a.meshes[0].primitives[0];
    assert.ok(p.attributes.POSITION>=0);
    assert.ok(p.attributes.COLOR_0>=0);
  }
});
test('Tyrant boss original model retains unique parts before runtime GPU merge',()=>{
  const asset=glb('boss');
  assert.ok(asset.meshes.length>100);
});
test('client maps all infection archetypes to existing H17 models, including special infections and Boss',()=>{
  const source=readFileSync(new URL('../apps/client/src/world/ZombieCrowd.ts',import.meta.url),'utf8');
  for(const type of ['walker','runner','brute','spitter','screamer','climber','juggernaut','boss'])
    assert.match(source,new RegExp(type+':'));
  assert.match(source,/GLTFLoader/);
  assert.match(source,/mergeGeometries/);
  assert.match(source,/new THREE\.InstancedMesh/);
  assert.match(source,/assetsReady/);
});
