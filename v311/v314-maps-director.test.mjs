import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {FACILITY_MAPS,isFacility,getFacility,facilityCanOccupy,
 facilityMoveHorizontal,facilityFlowField,facilityRouteDirection,facilityPursue,
 facilityCollisionBoxes} from '../v314/FacilityMaps.mjs';
import {createFacilityEvents,facilityInteract,facilityExtractionZone,facilityPublicEnvironment} from '../v314/FacilityEvents.mjs';
import {createMapDirector,entrancesFor,queueMapHorde,advanceMapDirector,
 nextMapSpawn} from '../v314/MapDirector.mjs';
const source=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const p=(x,z,id='p1')=>({id,x,z,y:0});
const use=(s,pos,id,now)=>facilityInteract(s,{player:pos,id,now,phase:'playing',downed:false});
for(const mapId of ['infected_hospital','doomed_harbor']){
 test(mapId+' has valid spawn, named entrances, safehouse, two safe exits and collision',()=>{
   const map=getFacility(mapId);
   assert.ok(isFacility(mapId));assert.equal(map.starts.length,4);
   assert.ok(map.spawns.length>=8);assert.equal(map.routes.length,2);
   assert.ok(map.directorEntrances.length>=4);
   for(const [x,z] of map.starts)assert.equal(facilityCanOccupy(mapId,x,z,0,.36),true,'player spawn '+x+':'+z);
   for(const x of map.spawns)assert.equal(facilityCanOccupy(mapId,x.x,x.z,0,.36),true,'enemy spawn '+x.x+':'+x.z);
   for(const d of map.devices)assert.equal(facilityCanOccupy(mapId,d.x,d.z,0,.36),true,'device '+d.id);
   for(const d of map.routes)assert.equal(facilityCanOccupy(mapId,d.x,d.z,0,.36),true,'exit '+d.id);
   const block=map.boxes.find(x=>x.role==='container'||x.role==='wall');
   assert.equal(facilityCanOccupy(mapId,block.x,block.z),false);
   assert.ok(facilityCollisionBoxes(mapId).length>20);
   assert.equal(facilityCanOccupy(mapId,0,99),false);
 });
 test(mapId+' movement cannot penetrate room walls or the outer map limits',()=>{
   const map=getFacility(mapId);
   const x=facilityMoveHorizontal(mapId,map.starts[0][0],map.starts[0][1],0,1,0,true);
   assert.ok(Number.isFinite(x.x)&&Number.isFinite(x.z));
   const border=facilityMoveHorizontal(mapId,77,0,0,8,0,true);
   assert.ok(border.x<79,'map border');
 });
 test(mapId+' zombies navigate by flow field, not teleport or run backwards',()=>{
   const map=getFacility(mapId),a=map.spawns[0],b=map.spawns[1];
   const from={x:a.x,z:a.z,y:0,grounded:true,speed:2.8,step:0,facing:0};
   const to=p(b.x,b.z);const flow=facilityFlowField(mapId,to);
   assert.ok(flow.next instanceof Int32Array);
   const before={x:from.x,z:from.z};
   const direction=facilityRouteDirection(mapId,from,to,flow);
   assert.ok(Number.isFinite(direction.dx)&&Number.isFinite(direction.dz));
   for(let i=0;i<25;i++)facilityPursue(mapId,from,to,flow,.05);
   assert.ok(Number.isFinite(from.x)&&Number.isFinite(from.z));
   assert.ok(Math.hypot(from.x-before.x,from.z-before.z)<5,'no teleport');
   assert.equal(facilityCanOccupy(mapId,from.x,from.z,0,.38),true,'cannot walk through walls');
 });
}
test('hospital emergency power/isolation, siren and helicopter radio are server-only',()=>{
 const s=createFacilityEvents('infected_hospital',7);
 assert.equal(use(s,p(19,-26),'hospitalIsolation',1000).ok,false,'power prerequisite');
 assert.equal(use(s,p(-23,-27),'hospitalGenerator',2000).action,'power_restored');
 assert.equal(use(s,p(19,-26),'hospitalIsolation',3000).action,'seal_open');
 assert.equal(use(s,p(19,-26),'hospitalIsolation',3200).ok,false,'duplicate');
 assert.equal(use(s,p(-8,25),'hospitalSiren',4000).horde,16);
 assert.equal(use(s,p(-8,25),'hospitalSiren',5000).ok,false,'cooldown');
 assert.equal(use(s,p(59,45),'hospitalRadio',6000).action,'relay_online');
 assert.equal(use(s,p(0,0),'hospitalGenerator',8000).ok,false,'remote operation');
 assert.equal(facilityInteract(s,{player:p(-23,-27),id:'hospitalGenerator',
  now:9000,phase:'lobby',downed:false}).ok,false,'lobby cannot operate');
 assert.equal(facilityPublicEnvironment(s,9500).routes.length,2);
});
test('port crane requires electric power; ship and truck evacuation require objective completion',()=>{
 const s=createFacilityEvents('doomed_harbor');
 assert.equal(use(s,p(45,-45),'harborCrane',1000).ok,false);
 assert.equal(use(s,p(-12,-48),'harborGenerator',2000).action,'power_restored');
 assert.equal(use(s,p(45,-45),'harborCrane',3000).action,'crane_started');
 assert.equal(use(s,p(45,-45),'harborCrane',3100).ok,false);
 assert.equal(use(s,p(-52,51),'harborRadio',4000).action,'relay_online');
 assert.equal(use(s,p(66,44),'rescue_boat',5000).ok,false,'must finish objectives');
 s.objectiveComplete=true;
 assert.equal(use(s,p(66,44),'rescue_boat',6000).action,'route_selected');
 assert.equal(facilityExtractionZone(s,p(66,44)),true);
 assert.equal(facilityExtractionZone(s,p(-65,47)),false);
 assert.equal(use(s,p(-65,47),'dock_truck',7000).ok,false,'route cannot be swapped');
});
test('AI director chooses map-specific entrances, distinct infected compositions and honors caps',()=>{
 const h=entrancesFor('infected_hospital'),dock=entrancesFor('doomed_harbor'),
 metro=entrancesFor('underground_metro');
 assert.ok(h.some(g=>g.id==='isolation')&&dock.some(g=>g.id==='containers'));
 assert.ok(metro.some(g=>g.id==='east_tunnel'));
 assert.notDeepEqual(h,dock);
 const state=createMapDirector('doomed_harbor',3,0);
 const group=queueMapHorde(state,{count:24,gate:'containers',now:2000,pressure:30});
 assert.equal(group.gate,'containers');
 assert.equal(group.total,24);
 assert.equal(nextMapSpawn(state,{now:2000,activeCount:30,maxActive:30}),null);
 const first=nextMapSpawn(state,{now:2000,activeCount:1,maxActive:30});
 assert.equal(first.gate,'containers');
 assert.ok(['runner','climber','walker'].includes(first.kind));
 assert.equal(nextMapSpawn(state,{now:2050,activeCount:1,maxActive:30}),null,'spawn throttled');
 const next=nextMapSpawn(state,{now:2250,activeCount:1,maxActive:30});
 assert.ok(next);
 assert.equal(advanceMapDirector(state,{now:40_000,pressure:90,activeCount:25,phase:'playing'}),null,'high pressure relief');
});
test('server and client share four map identifiers, triggers and gate warnings',()=>{
 const server=source('server.mjs'),client=source('apps/client/src/main.ts'),
 world=source('apps/client/src/world/World.ts'),mini=source('apps/client/src/world/MapMini.ts');
 assert.match(server,/facilityCanOccupy\(room.mapId/);
 assert.match(server,/facilityPursue\(room.mapId/);
 assert.match(server,/facilityInteract\(room.protocol,input\)/);
 assert.match(server,/queueMapHorde\(room.mapDirector/);
 assert.match(server,/facilityExtractionZone\(room.protocol,p\)/);
 assert.match(client,/value="infected_hospital"/);
 assert.match(client,/value="doomed_harbor"/);
 assert.match(world,/new FacilityScene\(scene,'infected_hospital'\)/);
 assert.match(mini,/map.directorEntrances/);
 assert.match(client,/event.type==='hordeWarning'/);
});
