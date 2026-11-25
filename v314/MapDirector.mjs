/**
 * One budgeted, deterministic-ish server-owned encounter scheduler per room.
 * Groups spawn by physically declared map entrances; no client request ever
 * sets number, kind, gate or position. Active cap and 80ms spawn throttle
 * prevent a simultaneous event from saturating the Render free instance.
 */
import {METRO_MAP} from '../v313/MetroMap.mjs';
import {getFacility} from './FacilityMaps.mjs';
const metroGates=[
 {id:'west_tunnel',label:'西側隧道',x:-55,z:15,types:['walker','runner','climber']},
 {id:'east_tunnel',label:'東側隧道',x:58,z:15,types:['runner','screamer','walker']},
 {id:'maintenance',label:'維修走廊',x:54,z:-14,types:['brute','spitter','walker']},
 {id:'ticket_hall',label:'售票大廳',x:-12,z:15,types:['walker','spitter','runner']}
];
const cityGates=[
 {id:'north_road',label:'北側街道',x:0,z:-65,types:['walker','runner','brute']},
 {id:'east_roofs',label:'東側樓房',x:64,z:14,types:['climber','runner','walker']},
 {id:'south_road',label:'南側街道',x:-23,z:65,types:['walker','spitter','runner']},
 {id:'west_factory',label:'西側工廠',x:-66,z:-22,types:['brute','screamer','walker']}
];
export function entrancesFor(mapId){
 return mapId==='underground_metro'?metroGates:
   getFacility(mapId)?.directorEntrances??cityGates;
}
export function createMapDirector(mapId,seed=1,now=0){
 return {mapId,seed:Math.trunc(seed)>>>0,gateCursor:0,
  lastGate:null,nextAmbientAt:now+25_000,groups:[],nextGroupId:1,
  lastPressure:0,lastDispatchAt:0};
}
function chooseGate(state,hint){
 const gates=entrancesFor(state.mapId);
 if(hint){const requested=gates.find(g=>g.id===hint);if(requested)return requested;}
 // Avoid repeating the last entrance whenever there are other options.
 const allowed=gates.filter(g=>g.id!==state.lastGate);
 const idx=(state.seed+state.gateCursor++*17)%(allowed.length||1);
 const selected=allowed[idx]??gates[0];
 state.lastGate=selected.id;return selected;
}
export function queueMapHorde(state,{count=10,gate=null,now=0,cause='ambient',pressure=0}={}){
 const n=Math.max(0,Math.min(32,Math.trunc(count)));
 if(!n)return null;
 const entrance=chooseGate(state,gate);
 const group={
   id:state.nextGroupId++,cause,gate:entrance.id,label:entrance.label,
   x:entrance.x,z:entrance.z,kinds:entrance.types.slice(),remaining:n,
   total:n,queuedAt:now,nextAt:now
 };
 state.groups.push(group);
 if(state.groups.length>12)state.groups.splice(0,state.groups.length-12);
 state.lastPressure=Math.max(0,Math.min(100,pressure));
 return group;
}
export function nextMapSpawn(state,{now,activeCount,maxActive=30,pressure=0}){
 if(!Number.isFinite(now)||activeCount>=maxActive||now-state.lastDispatchAt<95)return null;
 const group=state.groups.find(g=>g.remaining>0&&now>=g.nextAt);
 if(!group)return null;
 const index=group.total-group.remaining;
 const kind=group.kinds[(index+state.seed)%group.kinds.length];
 // Keep the exact spawn gate, with bounded offsets validated by caller.
 const theta=(index*2.39996+state.seed%17)*1;
 const radius=1+(index%4)*.8;
 group.remaining--;group.nextAt=now+Math.round(180+Math.max(0,100-pressure)*1.3);
 state.lastDispatchAt=now;
 state.groups=state.groups.filter(g=>g.remaining>0);
 return {kind,gate:group.gate,x:group.x+Math.cos(theta)*radius,
   z:group.z+Math.sin(theta)*radius,cause:group.cause};
}
export function advanceMapDirector(state,{now,pressure=0,activeCount=0,phase='playing'}={}){
 if(phase!=='playing'||!Number.isFinite(now)||now<state.nextAmbientAt)return null;
 // Injured squads get relief; high-pressure battles don't stack events.
 if(pressure>78||activeCount>22||state.groups.length>2){
   state.nextAmbientAt=now+12_000;return null;
 }
 state.nextAmbientAt=now+35_000+(state.seed%15000);
 const amount=pressure<25?7:pressure<52?9:12;
 return queueMapHorde(state,{count:amount,now,cause:'director',pressure});
}
export function publicMapDirector(state){
 return {mapId:state.mapId,activeGroups:state.groups.length,
  nextGate:entrancesFor(state.mapId)[state.gateCursor%entrancesFor(state.mapId).length]?.id,
  pressure:state.lastPressure};
}
