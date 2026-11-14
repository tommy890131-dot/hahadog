import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import map from '../packages/shared/MapLayout.json' with {type:'json'};
import { canOccupyAt,moveHorizontal } from '../packages/shared/VerticalCollision.mjs';
import {navigation,routeWaypoints,advanceZombie,buildZombieBuckets,steerZombie} from '../packages/shared/ZombieNavigation.mjs';

const byId=id=>map.buildings.find(b=>b.id===id);
const near=(p,q,limit=.7)=>Math.hypot(p.x-q.x,p.z-q.z)<limit&&Math.abs(p.y-q.y)<.75;
const spawn=(id,x=1.5,z=1.5)=>({id,x,z,y:0,vy:0,grounded:true,vx:0,vz:0,kind:'walker',speed:3,step:0});

/** Uses the EXACT chase routine used by server.mjs, without rendering. */
function simulate(start,target,limit=2500){
  const zombie=spawn(123,start.x,start.z),field=navigation.routeTo(target);
  let maxY=0,arrived=false;
  for(let i=0;i<limit;i++){
    advanceZombie(zombie,target,field,[],.05,i*50);
    maxY=Math.max(maxY,zombie.y);
    assert.ok(canOccupyAt(zombie.x,zombie.z,zombie.y,.36),`collision: ${JSON.stringify(zombie)}`);
    if(near(zombie,target,1.5)){arrived=true;break;}
  }
  return {arrived,maxY,zombie};
}

test('navigation graph includes 3-D paths to every tactical 2F and rooftop',()=>{
  assert.ok(navigation.nodes.length>=4000 && navigation.nodes.length<60000);
  for(const id of ['b0_0','b0_2','b3_1','b3_3']){
    const b=byId(id);
    for(const level of [3.25,7.25]){
      const target={id:'target',x:b.x,y:level,z:b.z};
      const path=navigation.path({x:1.5,y:0,z:1.5},target);
      assert.ok(path.length>10,`${id} ${level}: disconnected`);
      assert.ok(near(path.at(-1),target,.3));
      assert.ok(path.some(p=>p.tag.startsWith('ramp:')),`${id} no ramp route`);
      for(let i=1;i<path.length;i++){
        assert.ok(navigation.canTraverse(path[i-1],path[i]) && navigation.canTraverse(path[i],path[i-1]),
          `${id} ${level}: illegal nav edge ${path[i-1].id}->${path[i].id}`);
      }
    }
  }
});

test('shortest path never jumps sideways between ramp flights before the switchback landing',()=>{
  const b=byId('b3_3');const path=navigation.path({x:1.5,y:0,z:1.5},{x:b.x,y:7.25,z:b.z});
  const rampNodes=path.filter(x=>x.tag.startsWith('ramp:'));
  for(let i=1;i<rampNodes.length;i++){
    const a=rampNodes[i-1],next=rampNodes[i];
    if(a.tag!==next.tag && Math.abs(a.x-next.x)>.9){
      assert.ok(Math.abs(a.y-3.25)<.09,`premature ramp transfer from y=${a.y}`);
      assert.ok(Math.abs(next.y-3.25)<.4,`premature ramp landing y=${next.y}`);
    }
  }
});

test('authoritative zombie physical chase reaches 2F and roof, not just an abstract graph',()=>{
  const target2={id:'p2',x:23,y:3.25,z:22};
  const targetRoof={id:'roof',x:23,y:7.25,z:22};
  for(const target of [target2,targetRoof]){
    const result=simulate({x:1.5,z:1.5},target);
    assert.ok(result.arrived,`zombie unable to climb to ${target.y}m: ${JSON.stringify(result.zombie)}`);
    assert.ok(result.maxY>=target.y-.75);
  }
});


test('real kinematic pursuit reaches all four tactical rooftops without clipping into slabs',()=>{
  for(const id of ['b0_0','b0_2','b3_1','b3_3']){
    const b=byId(id),target={id,x:b.x,y:7.25,z:b.z};
    const result=simulate({x:1.5,z:1.5},target,2000);
    assert.ok(result.arrived,`${id} never reaches roof: ${JSON.stringify(result.zombie)}`);
  }
});

test('eight zombies separate into a moving group while navigating a roof ramp',()=>{
  const target={id:'roof',x:23,y:7.25,z:22},field=navigation.routeTo(target);
  const zombies=Array.from({length:8},(_,i)=>({...spawn(i+11,1.5+(i%4)*.57,1.5+Math.floor(i/4)*.78),speed:2.8}));
  const reached=new Set();let separationSamples=0;
  for(let i=0;i<1800&&reached.size<8;i++){
    const buckets=buildZombieBuckets(zombies);
    for(const z of zombies){
      if(reached.has(z.id))continue;
      advanceZombie(z,target,field,buckets.near(z),.05,i*50);
      assert.ok(canOccupyAt(z.x,z.z,z.y,.36));
      if(near(z,target,1.7))reached.add(z.id);
    }
    if(i%60===0){
      const distinct=new Set(zombies.map(z=>`${z.x.toFixed(1)}:${z.z.toFixed(1)}:${z.y.toFixed(1)}`));
      if(distinct.size>=6)separationSamples++;
    }
  }
  assert.equal(reached.size,8,'the whole separated horde should reach the rooftop');
  assert.ok(separationSamples>=4,'the group should not stack into one point');
});

test('navigation targets can be updated when a player moves to a different floor',()=>{
  const z=spawn(22),t1={id:'same-player',x:23,y:0,z:22};
  advanceZombie(z,t1,navigation.routeTo(t1),[],.05,0);
  const first=z.routeGoal;
  const t2={id:'same-player',x:23,y:7.25,z:22};
  advanceZombie(z,t2,navigation.routeTo(t2),[],.05,50);
  assert.notEqual(z.routeGoal,first);
  assert.equal(z.routeGoalY,7.25);
  assert.ok(z.route.some(n=>n.tag.startsWith('ramp:')));
});

test('spatial hash creates local separation, but zombies on other floors do not repel',()=>{
  const z=spawn(1,10,10),left=spawn(2,9.4,10.02),up={...spawn(3,10,10),y:7.25};
  const buckets=buildZombieBuckets([z,left,up]);
  assert.ok(buckets.near(z).includes(left));
  const steered=steerZombie(z,{x:0,z:-1,ramp:false},buckets.near(z),.05,1000);
  assert.ok(steered.x>0,`separation should move away from left neighbor: ${steered.x}`);
  assert.ok(Math.hypot(steered.x,steered.z)>.99);
  const isolated=spawn(1,10,10);
  const noSameFloor=steerZombie(isolated,{x:0,z:-1,ramp:false},[up],.05,1000);
  const alone=steerZombie(spawn(1,10,10),{x:0,z:-1,ramp:false},[],.05,1000);
  assert.ok(Math.abs(noSameFloor.x-alone.x)<1e-6);
});

test('server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y',()=>{
  const server=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
  const crowd=fs.readFileSync(new URL('../apps/client/src/world/ZombieCrowd.ts',import.meta.url),'utf8');
  const sound=fs.readFileSync(new URL('../apps/client/src/audio/SoundManager.ts',import.meta.url),'utf8');
  assert.match(server,/navigation\.routeTo/);
  assert.match(server,/z\.y\+\(z\.kind/);
  assert.match(server,/Math\.abs\(z\.y-target\.y\)/);
  assert.match(server,/id:z\.id,x:z\.x,y:z\.y/);
  assert.match(crowd,/z\.y=THREE\.MathUtils\.lerp/);
  assert.match(sound,/z\.y\?\?0/);
});
