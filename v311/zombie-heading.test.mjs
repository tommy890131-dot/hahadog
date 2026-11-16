import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {headingForModelForwardMinusZ,advanceZombie,directPursuitPossible} from '../packages/shared/ZombieNavigation.mjs';

const rotatedForward=(yaw)=>({x:-Math.sin(yaw),z:-Math.cos(yaw)});
test('H17 and Tyrant forward heading matches all four cardinal travel directions',()=>{
  for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0],[1,1],[-2,3]]){
    const yaw=headingForModelForwardMinusZ(dx,dz);
    const actual=rotatedForward(yaw);
    const mag=Math.hypot(dx,dz);
    assert.ok(Math.abs(actual.x-dx/mag)<1e-10,JSON.stringify({dx,dz,yaw,actual}));
    assert.ok(Math.abs(actual.z-dz/mag)<1e-10,JSON.stringify({dx,dz,yaw,actual}));
  }
});
test('authoritative chasing produces a heading aligned with physical approach rather than backwards',()=>{
  for(const [x,z,dx,dz] of [[4,5,0,-1],[4,5,1,0],[4,5,0,1],[4,5,-1,0]]){
    const zombie={id:2,x,z,y:0,vy:0,grounded:true,vx:0,vz:0,kind:'walker',speed:2.8,step:0};
    const target={id:'player',x:x+dx*4,z:z+dz*4,y:0};
    if(!directPursuitPossible(zombie,target))continue; // spatial fixtures can include a building
    const before={x:zombie.x,z:zombie.z};
    advanceZombie(zombie,target,null,[],.05,500);
    const moved={x:zombie.x-before.x,z:zombie.z-before.z};
    const distance=Math.hypot(moved.x,moved.z);
    assert.ok(distance>.005,'expected physical pursuit movement');
    const front=rotatedForward(zombie.facing);
    assert.ok((front.x*moved.x+front.z*moved.z)/distance>.999,
      'model looks away from its movement '+JSON.stringify({moved,front}));
  }
});
test('both crowd and rig renderers respect identical server facing without 180-degree offsets',()=>{
  const crowd=fs.readFileSync(new URL('../apps/client/src/world/ZombieCrowd.ts',import.meta.url),'utf8');
  const rig=fs.readFileSync(new URL('../apps/client/src/world/RiggedZombie.ts',import.meta.url),'utf8');
  assert.match(crowd,/this\.dummy\.rotation\.set\(lean,zombie\.facing,/);
  assert.match(rig,/this\.mesh\.rotation\.y=p\.facing/);
});
