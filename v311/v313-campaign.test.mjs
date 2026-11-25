import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {METRO_MAP,METRO_BOXES,metroCanOccupy,metroMoveHorizontal,
  metroCollisionBoxes,metroFlowField,metroPursue,metroRouteDirection} from '../v313/MetroMap.mjs';
import {createMetroEvents,metroInteract,metroPublicEnvironment,
  metroExtractionZone,metroRouteReady,METRO_DEVICES} from '../v313/MetroEvents.mjs';
import {stageAt} from './campaign-flow.mjs';
const source=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const player=(x,z,id='P1')=>({id,x,z,y:0});
const use=(state,p,id,now=1000)=>metroInteract(state,{player:p,id,now,phase:'playing',downed:false});
test('metro is a separate navigable map with station platform, train and accessible spawn/controls',()=>{
  assert.equal(METRO_MAP.id,'underground_metro');
  assert.equal(METRO_MAP.starts.length,4);
  assert.ok(METRO_BOXES.some(b=>b.role==='train'));
  assert.ok(METRO_BOXES.some(b=>b.role==='column'));
  for(const [x,z] of METRO_MAP.starts)assert.equal(metroCanOccupy(x,z,0,.36),true,'spawn '+x+','+z);
  for(const p of METRO_MAP.spawns)assert.equal(metroCanOccupy(p.x,p.z,0,.36),true,'zombie spawn');
  for(const p of Object.values(METRO_DEVICES))
    assert.equal(metroCanOccupy(p.x,p.z,0,.36),true,p.id);
  assert.equal(metroCanOccupy(19,2),false,'standing inside train forbidden');
  assert.equal(metroCanOccupy(0,90),false,'station edge forbidden');
});
test('metro movement cannot cross train walls or exterior borders but can walk in corridors',()=>{
  const x=metroMoveHorizontal(0,-4,0,25,7,true);
  assert.ok(x.z<1.5,'train blocks direct penetration');
  const border=metroMoveHorizontal(78,-14,0,10,0,true);
  assert.ok(border.x<80,'outer station wall blocks');
  const allowed=metroMoveHorizontal(-69,-14,0,4,0,true);
  assert.ok(allowed.x>-69,'player moves along platform');
  assert.ok(metroCollisionBoxes().length>8);
});
test('metro chasing moves toward real player position and does not run backwards',()=>{
  const z={x:-56,y:0,z:13,grounded:true,speed:3,step:0,facing:0};
  const p=player(-45,13);
  const field=metroFlowField(p);
  const oldX=z.x,oldZ=z.z;
  for(let i=0;i<18;i++)metroPursue(z,p,field,.05);
  assert.ok(z.x>oldX+.3,'zombie moved toward player');
  assert.ok(Math.abs(z.z-oldZ)<.9);
  const forward={x:-Math.sin(z.facing),z:-Math.cos(z.facing)};
  assert.ok(forward.x>.6,'model looks where running');
});
test('train power/alert/launch are server-authoritative, staged, rate-limited, and spawn hordes',()=>{
  const state=createMetroEvents(3);
  assert.equal(metroRouteReady(state,'train',0),false);
  assert.equal(use(state,player(54,-16),'metroTrain').ok,false,'power prerequisite');
  assert.equal(use(state,player(-32,-19),'metroPower',1700).action,'power_restored');
  assert.equal(use(state,player(-32,-19),'metroPower',1200).ok,false,'duplicate');
  const alert=use(state,player(-10,-22),'metroAlarm',2400);
  assert.equal(alert.horde,18);
  assert.equal(use(state,player(-10,-22),'metroAlarm',2600).ok,false,'cooldown');
  const train=use(state,player(54,-16),'metroTrain',3200);
  assert.equal(train.action,'train_started');assert.equal(train.horde,24);
  assert.equal(metroRouteReady(state,'train',28000),false);
  assert.equal(metroRouteReady(state,'train',28200),true);
  assert.equal(use(state,player(0,0),'metroPower',35000).ok,false,'remote spoof');
  assert.equal(metroInteract(state,{player:player(54,-16),id:'metroTrain',now:36000,phase:'lobby'}).ok,false);
});
test('train boarding requires objectives, 25-sec arrival, and complete team assembly',()=>{
  const state=createMetroEvents();
  assert.equal(use(state,player(-69,-14),'safehouse',5000).ok,false,'objective required');
  state.objectiveComplete=true;
  assert.equal(use(state,player(-69,-14),'safehouse',5600).action,'route_selected');
  assert.equal(metroExtractionZone(state,player(-69,-14),5601),true);
  assert.equal(metroExtractionZone(state,player(65,-16),5601),false);
  const trainState=createMetroEvents();
  trainState.objectiveComplete=true;trainState.powerOnline=true;
  use(trainState,player(54,-16),'metroTrain',6000);
  assert.equal(use(trainState,player(67,-16),'train',8000).ok,false,'train cannot depart early');
  assert.equal(use(trainState,player(67,-16),'train',31001).action,'route_selected');
  assert.equal(metroExtractionZone(trainState,player(67,-16),31001),true);
});
test('two maps share multiplayer room protocol but render distinct scenes and level transitions',()=>{
  const server=source('server.mjs');
  const main=source('apps/client/src/main.ts');
  const world=source('apps/client/src/world/World.ts');
  const mini=source('apps/client/src/world/MapMini.ts');
  assert.match(server,/room\.mapId=V311\?\(\['city',METRO_MAP_ID,'infected_hospital','doomed_harbor'\]/);
  assert.match(server,/msg\.type==='selectMap'/);
  assert.match(server,/moveRoomPlayer\(room,p\.x,p\.z,p\.y,dx,dz,p\.grounded\)/);
  assert.match(server,/metroExtractionZone\(room\.protocol,p,now\)/);
  assert.match(server,/metroFlowField\(p\)/);
  assert.match(main,/world\.setChapter\(mapId\)/);
  assert.match(main,/network\.selectMap\(mapSelect\.value/);
  assert.match(world,/new MetroScene\(scene\)/);
  assert.match(world,/metroCanOccupy\(x,z,feet,r\)/);
  assert.match(mini,/METRO_BOXES/);
  assert.equal(stageAt(1).index,1);
});
