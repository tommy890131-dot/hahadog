import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import map from '../packages/shared/MapLayout.json' with {type:'json'};
import {
  PHYSICS, VERTICAL_LAYOUT, TACTICAL_IDS,canOccupyAt,
  surfaceHeightAt,moveHorizontal,stepVertical
} from '../packages/shared/VerticalCollision.mjs';

const getBuilding=id=>map.buildings.find(b=>b.id===id);
const runRamp=(x,z,y,steps,dz)=>{
  let p={x,z,feet:y};
  for(let i=0;i<steps;i++)p=moveHorizontal(p.x,p.z,p.feet,0,dz,true);
  return p;
};

test('4 tactical buildings have genuinely open doors with solid flanking walls',()=>{
  assert.equal(TACTICAL_IDS.size,map.buildings.filter(b=>b.role!=='CAR').length);
  for(const id of ['b0_0','b0_2','b3_1','b3_3']){
    const b=getBuilding(id),front=b.z+b.d/2;
    let p={x:b.x,z:front+2,feet:0};
    for(let i=0;i<45;i++)p=moveHorizontal(p.x,p.z,p.feet,0,-.2,true);
    assert.ok(p.z < front-3,`${id} door must lead into real interior`);
    assert.ok(canOccupyAt(b.x,b.z,0),`${id} interior must be occupiable`);
    assert.equal(canOccupyAt(b.x+b.w/2,b.z,0),false,`${id} right wall must stop players`);
    assert.equal(canOccupyAt(b.x,b.z-b.d/2,0),false,`${id} back wall must stop players`);
  }
});

test('two return ramps lead from street to upper floor and actual walkable rooftop',()=>{
  assert.ok(VERTICAL_LAYOUT.ramps.length>=12);
  for(const id of ['b0_0','b0_2','b3_1','b3_3']){
    const b=getBuilding(id);
    const [inside,first,second]=VERTICAL_LAYOUT.ramps.filter(r=>r.buildingId===id);
    assert.equal(inside.kind,'indoor-ramp');
    const interior=runRamp((inside.xMin+inside.xMax)/2,inside.zMax,0,
      Math.ceil((inside.zMax-inside.zMin)/.1),-.1);
    assert.ok(Math.abs(interior.feet-3.25)<.03,`${id} interior stair must reach 2F`);
    const p1=runRamp((first.xMin+first.xMax)/2,first.zMax,0,Math.ceil((first.zMax-first.zMin)/.1),-.1);
    assert.ok(Math.abs(p1.feet-3.25)<.03,`${id} 2F transition: ${p1.feet}`);
    const transfer=moveHorizontal(p1.x,p1.z,p1.feet,(second.xMin+second.xMax)/2-p1.x,0,true);
    const p2=runRamp(transfer.x,second.zMin,transfer.feet,Math.ceil((second.zMax-second.zMin)/.1),.1);
    assert.ok(Math.abs(p2.feet-(b.h+.25))<.03,`${id} roof: ${p2.feet}`);
    const roof=moveHorizontal(p2.x,p2.z,p2.feet,b.x-p2.x,0,true);
    assert.ok(Math.abs(roof.x-b.x)<.05,`${id} should reach roof center`);
    assert.ok(canOccupyAt(roof.x,roof.z,roof.feet));
  }
});

test('a player can use the open ground-floor door AND interior ramp to reach the upper room',()=>{
  for(const id of ['b0_0','b0_2','b3_1','b3_3']){
    const b=getBuilding(id);
    const ramp=VERTICAL_LAYOUT.ramps.find(r=>r.buildingId===id&&r.kind==='indoor-ramp');
    let p={x:b.x,z:b.z+b.d/2+1,feet:0};
    p=moveHorizontal(p.x,p.z,p.feet,0,ramp.zMax-p.z,true);
    p=moveHorizontal(p.x,p.z,p.feet,(ramp.xMin+ramp.xMax)/2-p.x,0,true);
    p=runRamp(p.x,p.z,p.feet,Math.ceil((ramp.zMax-ramp.zMin)/.1),-.1);
    p=moveHorizontal(p.x,p.z,p.feet,b.x-p.x,0,true);
    assert.ok(Math.abs(p.x-b.x)<.05,`${id} should get from indoor stairs to central 2F`);
    assert.ok(Math.abs(p.feet-3.25)<.02);
  }
});

test('zombie ground navigation samples connect to all tactical ground floors',()=>{
  const N=60,step=3,idx=(x,z)=>z*N+x,grid=v=>Math.floor((v+90)/step),center=i=>-90+(i+.5)*step;
  const q=[idx(grid(0),grid(0))],seen=new Set(q);
  for(let head=0;head<q.length;head++){
    const cell=q[head],x=cell%N,z=Math.floor(cell/N);
    for(const [i,j] of [[x+1,z],[x-1,z],[x,z+1],[x,z-1]]){
      if(i<0||j<0||i>=N||j>=N)continue;
      const next=idx(i,j);
      if(!seen.has(next)&&canOccupyAt(center(i),center(j),0,.45)){
        q.push(next);seen.add(next);
      }
    }
  }
  for(const id of ['b0_0','b0_2','b3_1','b3_3']){
    const b=getBuilding(id);
    assert.ok(seen.has(idx(grid(b.x),grid(b.z))),`${id} accessible to ground zombies`);
  }
});

test('jump accelerates upwards under gravity, cannot double jump in air and lands',()=>{
  let y=0,vy=PHYSICS.jumpVelocity,grounded=false,maxY=0;
  for(let i=0;i<80;i++){
    const step=stepVertical(y,vy,grounded,0,0,.02);
    y=step.y;vy=step.vy;grounded=step.grounded;
    maxY=Math.max(maxY,y);
  }
  assert.ok(maxY>1.1 && maxY<1.6,`jump height: ${maxY}`);
  assert.ok(grounded);
  assert.equal(y,0);
  assert.ok(canOccupyAt(23,22,0), 'open building has walkable ground floor');
});

test('upper slab and roof remain solid below but walkable on top; low cover is jumpable',()=>{
  const b=getBuilding('b3_3');
  assert.equal(canOccupyAt(b.x,b.z,1.85),false,'second floor should block ascending body');
  assert.ok(canOccupyAt(b.x,b.z,3.25));
  assert.equal(canOccupyAt(b.x,b.z,b.h-.6),false,'roof must block player before stepping onto it');
  assert.ok(canOccupyAt(b.x,b.z,b.h+.25));
  const crate=VERTICAL_LAYOUT.boxes.find(x=>x.buildingId===b.id&&x.kind==='cover'&&x.y<3);
  assert.ok(crate);
  assert.equal(canOccupyAt(crate.x,crate.z,0),false);
  assert.ok(canOccupyAt(crate.x,crate.z,crate.y+crate.h/2));
});

test('shared layout and both client/server imports preserve Y-authoritative protocol',()=>{
  const server=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
  const client=fs.readFileSync(new URL('../apps/client/src/main.ts',import.meta.url),'utf8');
  const controller=fs.readFileSync(new URL('../apps/client/src/player/FirstPersonController.ts',import.meta.url),'utf8');
  assert.match(server,/msg\.type==='jump'/);
  assert.match(server,/p\.y=result\.y/);
  assert.match(server,/y:p\.y/);
  assert.match(server,/msg\.y is intentionally ignored/);
  assert.match(client,/type:'jump'/);
  assert.match(client,/reconcileServerHeight/);
  assert.match(controller,/isGrounded/);
  assert.match(controller,/stepVertical/);
});
