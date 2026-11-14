import {test} from 'node:test';
import assert from 'node:assert/strict';
import map from '../packages/shared/MapLayout.json' with {type:'json'};
import {VERTICAL_LAYOUT as L,canOccupyAt,moveHorizontal} from '../packages/shared/VerticalCollision.mjs';
import {navigation} from '../packages/shared/ZombieNavigation.mjs';
const legacy=new Set(['b0_0','b0_2','b3_1','b3_3']);
test('all buildings have an enterable front door and open shooting apertures on every storey',()=>{
 for(const b of map.buildings.filter(b=>b.role!=='CAR')){
  const front=b.z+b.d/2;
  const p=moveHorizontal(b.x,front+1,0,0,-2,true);
  assert.ok(p.z<front-.8,b.id+' entrance');
  for(const y of L.levelsById[b.id].slice(0,-1)){
   const n=Math.floor(b.w/3.2),x=b.x-b.w/2+b.w/n/2,z=b.z-b.d/2;
   const obstructed=L.boxes.some(p=>p.solid&&Math.abs(x-p.x)<p.w/2&&Math.abs(z-p.z)<p.d/2&&y+1.7>p.y-p.h/2&&y+1.7<p.y+p.h/2);
   assert.equal(obstructed,false,b.id+' window '+y);
  }
 }
});
test('every new exterior switchback can be walked from street to roof without teleporting',()=>{
 for(const b of map.buildings.filter(b=>b.role!=='CAR'&&!legacy.has(b.id))){
  const ramps=L.ramps.filter(r=>r.buildingId===b.id&&r.kind==='ramp');
  let p={x:(ramps[0].xMin+ramps[0].xMax)/2,z:ramps[0].zMax,feet:0};
  for(const r of ramps){
   const end=r.yMin>r.yMax?r.zMin:r.zMax;
   p=moveHorizontal(p.x,p.z,p.feet,(r.xMin+r.xMax)/2-p.x,0,true);
   p=moveHorizontal(p.x,p.z,p.feet,0,end-p.z,true);
   assert.ok(Math.abs(p.feet-Math.max(r.yMin,r.yMax))<.05,b.id+' ramp '+JSON.stringify(p));
   assert.ok(canOccupyAt(p.x,p.z,p.feet));
   const room=moveHorizontal(p.x,p.z,p.feet,b.x-p.x,0,true);
   assert.ok(Math.abs(room.x-b.x)<.1,b.id+' landing entry '+p.feet);
  }
 }
});
test('navigation connects the street to every new storey',()=>{
 for(const b of map.buildings.filter(b=>b.role!=='CAR'&&!legacy.has(b.id))){
  for(const y of L.levelsById[b.id].slice(1)){
   const target={x:b.x,y,z:b.z};
   const path=navigation.path({x:1.5,z:1.5,y:0},target);
   const last=path.at(-1);
   assert.ok(last&&Math.hypot(last.x-target.x,last.z-target.z)<1&&Math.abs(last.y-y)<.2,b.id+' unreachable '+y);
  }
 }
});
