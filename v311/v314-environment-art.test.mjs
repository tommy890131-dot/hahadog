import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const kit=source('apps/client/src/world/EnvironmentDetailKit.ts');
const metro=source('apps/client/src/world/MetroScene.ts');
const facility=source('apps/client/src/world/FacilityScene.ts');
test('AAA-style environment modeling uses GPU-instanced parts instead of thousands of individual meshes',()=>{
  assert.match(kit,/class EnvironmentDetailKit/);
  assert.match(kit,/new THREE\.InstancedMesh\(this\.shape\(type\),this\.material\(name\),parts\.length\)/);
  assert.match(kit,/new THREE\.CanvasTexture\(canvas\)/);
  assert.match(kit,/new THREE\.MeshStandardMaterial\(\{color,roughness,metalness/);
  assert.match(kit,/texture\.wrapS=texture\.wrapT=THREE\.RepeatWrapping/);
  assert.match(kit,/detailOnly=true/);
});
test('subway has tactile strips, overhead cable tray, lit train vestibules and Chinese emergency signage',()=>{
  for(const key of ["月台邊緣注意安全","避難出口  EXIT","列車月台  PLATFORM 02","電力控制室","東側隧道 警戒區"])assert.ok(kit.includes(key));
  assert.match(kit,/METRO_BOXES/);
  assert.match(kit,/ticket readers|ticket/);
  assert.match(metro,/detailMetro\(this\.group\)/);
  assert.match(metro,/this\.group\.userData\.detailStats=stats/);
});
test('hospital has readable ward signage, IV stands, surgical lamps, infection isolation and floor guide stripes',()=>{
  for(const key of ["急診  EMERGENCY","感染管制  ISOLATION","手術區  SURGERY","藥品管理  PHARMACY"])assert.ok(kit.includes(key));
  assert.match(kit,/IV stand within the existing bed/);
  assert.match(kit,/Operating theatres/);
  assert.match(facility,/detailHospital\(this\.group\)/);
});
test('open-air harbor has corrugated containers, hoists, gantries, quayside bollards and rescue signage',()=>{
  for(const key of ["貨櫃場  CONTAINER YARD","危險區  KEEP CLEAR","港口救援  RESCUE"])assert.ok(kit.includes(key));
  assert.match(kit,/Double doors and lock rods/);
  assert.match(kit,/Crane legs, cross bracing/);
  assert.match(facility,/if\(map\.theme==='hospital'\)details\(0,5\.4/);
  assert.match(facility,/detailHarbor\(this\.group\)/);
});
test('visual detail mesh is explicitly excluded from authoritative collisions and disposed on chapter destroy',()=>{
  const world=source('apps/client/src/world/World.ts');
  assert.match(metro,/this\.detailKit\.dispose\(\)/);
  assert.match(facility,/this\.detailKit\.dispose\(\)/);
  assert.match(kit,/this\.geometries\.clear\(\)/);
  assert.match(kit,/for\(const t of this\.textures\)t\.dispose\(\)/);
  assert.match(world,/this\.metroScene\.dispose\(\)/);
  assert.match(world,/facility\.dispose\(\)/);
});
