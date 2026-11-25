import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const arch=read('apps/client/src/world/ArchitectureRefinement.ts');
const pbr=read('apps/client/src/world/ArchitecturalPBR.ts');
const kit=read('apps/client/src/world/EnvironmentDetailKit.ts');
const city=read('apps/client/src/world/World.ts');
const metro=read('apps/client/src/world/MetroScene.ts');
const facility=read('apps/client/src/world/FacilityScene.ts');

test('architectural microdetail uses deterministic albedo/normal/roughness texture set, no external downloads',()=>{
 assert.match(pbr,/export function architecturalPbr\(/);
 assert.match(pbr,/const size=128/);
 assert.match(pbr,/createImageData\(size,size\)/);
 assert.match(pbr,/Math\.imul/);
 assert.match(pbr,/new THREE\.CanvasTexture\(c\)/);
 assert.match(pbr,/normalMap:toTexture\(normal,false\)/);
 assert.match(pbr,/roughnessMap:toTexture\(rough,false\)/);
 assert.doesNotMatch(pbr,/fetch\(|https?:\/\//);
});
test('instanced architectural materials share PBR maps, have proper normals and dispose GPU resources',()=>{
 assert.match(kit,/architecturalPbr\(name,color,roughness\)/);
 assert.match(kit,/normalMap:maps\?\.normalMap\?\?null/);
 assert.match(kit,/roughnessMap:maps\?\.roughnessMap\?\?null/);
 assert.match(kit,/normalScale:new THREE\.Vector2\(\.52,\.52\)/);
 assert.match(kit,/this\.textures\.push\(maps\.map,maps\.normalMap,maps\.roughnessMap\)/);
 assert.match(kit,/this\.textures\)t\.dispose\(\)/);
 assert.match(kit,/new THREE\.InstancedMesh\(this\.shape\(type\),this\.material\(name\),parts\.length\)/);
});
test('metro models physical surface panel joints, overhead cable trays, real train door details and columns',()=>{
 assert.match(arch,/function refineMetroArchitecture\(/);
 for(const t of ['Precast columns','Reinforced steel cross-members','The train nose','raised emergency signage','service cable trays']){
   assert.ok(arch.toLowerCase().includes(t.toLowerCase()),t);
 }
 assert.match(kit,/refineMetroArchitecture\(kit\)/);
 assert.match(metro,/detailMetro\(this\.group\)/);
});
test('hospital architectural detail includes partition sections, door frame structure, medical heads and sprinkler ceiling',()=>{
 assert.match(arch,/function refineHospitalArchitecture\(/);
 for(const t of ['door frame','bed-side medical','surgical','sprinkler','impact-resistant']){
   assert.ok(arch.toLowerCase().includes(t.toLowerCase()),t);
 }
 assert.match(kit,/refineHospitalArchitecture\(kit\)/);
 assert.match(facility,/detailHospital\(this\.group\)/);
});
test('harbor has container weathering, actual crane bracing, quay rails and rescue signage',()=>{
 assert.match(arch,/function refineHarborArchitecture\(/);
 for(const t of ['Container castings','cargo handling','quay edge','steel','rescue']){
   assert.ok(arch.toLowerCase().includes(t.toLowerCase()),t);
 }
 assert.match(kit,/refineHarborArchitecture\(kit\)/);
 assert.match(facility,/detailHarbor\(this\.group\)/);
});
test('city retains open tactical apertures, original collision geometry and pooled structural facade detail',()=>{
 assert.match(arch,/function refineCityArchitecture\(/);
 assert.match(arch,/TACTICAL_IDS\.has\(b\.id\)/);
 assert.match(arch,/if\(!tactical\)/);
 assert.match(city,/refineCityArchitecture\(refinement,layout\.buildings\)/);
 assert.match(city,/this\.cityDetailKit\?\.dispose\(\)/);
 assert.match(arch,/do not fill actual tactical apertures/i);
 assert.doesNotMatch(arch,/registerCollider|this\.blockers|\.solid\s*=|collisionBoxes\s*=/);
});
