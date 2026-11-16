import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {advanceZombie,directPursuitPossible,navigation,buildZombieBuckets} from '../packages/shared/ZombieNavigation.mjs';
import {canOccupyAt} from '../packages/shared/VerticalCollision.mjs';
const spawn=(id,x,z)=>({id,x,z,y:0,vy:0,grounded:true,vx:0,vz:0,kind:'walker',speed:2.8,step:0});
test('enemies actively approach a visible same-floor player without a navigation field',()=>{
  const p={id:'player',x:5,z:6,y:0},z=spawn(1,5,12);
  assert.ok(directPursuitPossible(z,p));
  const start=Math.hypot(z.x-p.x,z.z-p.z);
  let movingFrames=0;
  for(let i=0;i<50;i++){
    advanceZombie(z,p,null,[],.05,i*50);
    if(z.moving)movingFrames++;
  }
  assert.ok(Math.hypot(z.x-p.x,z.z-p.z)<start-4,'failed to approach the player in 2.5 seconds');
  assert.ok(canOccupyAt(z.x,z.z,z.y,.36),'chase crossed a collider');
  assert.ok(movingFrames>=10,'zombie never animated a meaningful approach');
});
test('direct pursuit produces progress instead of repeatedly circling the same waypoint',()=>{
  const p={id:'player',x:6,z:6,y:0},z=spawn(22,6,9.4);
  let decreases=0;
  for(let i=0;i<20;i++){
    const before=Math.hypot(z.x-p.x,z.z-p.z);
    advanceZombie(z,p,navigation.routeTo(p),[],.05,i*50);
    if(Math.hypot(z.x-p.x,z.z-p.z)<before-.005)decreases++;
  }
  assert.ok(decreases>=17,'enemy repeatedly orbited nearby target');
});
test('narrow ramps still use route waypoints and lead to rooftop without jumping across floors',()=>{
  const p={id:'roof',x:23,y:7.25,z:22};
  const f=navigation.routeTo(p),z=spawn(7,1.5,1.5);
  let reached=false;
  for(let i=0;i<1900;i++){
    advanceZombie(z,p,f,[],.05,i*50);
    assert.ok(canOccupyAt(z.x,z.z,z.y,.36),`invalid ramp movement at step ${i}`);
    if(Math.hypot(z.x-p.x,z.z-p.z)<1.5&&Math.abs(z.y-p.y)<.65){reached=true;break;}
  }
  assert.ok(reached,'rooftop navigation stalled');
});
test('original art has per-part source rigs and an eleven-bone runtime skinning system',()=>{
  const source=fs.readFileSync(new URL('../apps/client/src/world/RiggedZombie.ts',import.meta.url),'utf8');
  const crowd=fs.readFileSync(new URL('../apps/client/src/world/ZombieCrowd.ts',import.meta.url),'utf8');
  for(const type of ['walker','runner','brute','spitter'])
    assert.ok(fs.existsSync(new URL(`../apps/client/public/models/enemies/${type}-rig.glb`,import.meta.url)));
  assert.match(source,/new THREE\.Skeleton/);
  assert.match(source,/new THREE\.SkinnedMesh/);
  assert.match(source,/setAttribute\('skinWeight'/);
  assert.match(source,/b\.legL\.rotation\.x=stride/);
  assert.match(source,/b\.armL\.rotation\.x=/);
  assert.match(crowd,/MAX_RIGGED=12/);
  assert.match(crowd,/rig\.update\(zombie,step\)/);
});
