/**
 * V3.14 facility world state. Never accepts arbitrary client positions,
 * level progression or spawn counts. Server owns all activation and timers.
 */
import {getFacility} from './FacilityMaps.mjs';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function createFacilityEvents(mapId,seed=1,now=0){
 const map=getFacility(mapId);if(!map)throw new RangeError('Unknown facility');
 return {mapId,seed:Math.trunc(seed)>>>0,powerOnline:false,relayReady:false,
  alarmReadyAt:0,objectiveComplete:false,selectedRoute:null,routes:map.routes.map(x=>x.id),
  machineReady:false,startedAt:now,activationAt:0,lastInteractionAt:new Map(),
  eventCount:0};
}
export function facilityRouteReady(s,id){
 const r=getFacility(s?.mapId)?.routes.find(x=>x.id===id);
 if(!r)return false;
 return r.requires==='generator'?s.powerOnline:
   r.requires==='relay'?s.relayReady:false;
}
export function facilityInteract(s,{player,id,now,phase,downed}){
 if(phase!=='playing'||downed||!player||!Number.isFinite(now)||
    typeof id!=='string'||id.length>38)return {ok:false,message:'目前無法操作'};
 const map=getFacility(s?.mapId);
 const d=map?.devices.find(x=>x.id===id);
 const r=map?.routes.find(x=>x.id===id);
 const target=d??r;
 if(!target||![player.x,player.y,player.z].every(Number.isFinite))
  return {ok:false,message:'找不到機關'};
 if(distance(player,target)>(target.range??target.radius)||
    Math.abs(player.y-target.y)>1.7)return {ok:false,message:'距離太遠，請靠近機關'};
 const last=s.lastInteractionAt.get(player.id)??-Infinity;
 if(now-last<650)return {ok:false,message:'操作間隔過短'};
 s.lastInteractionAt.set(player.id,now);
 if(d){
   switch(d.kind){
     case 'generator':
       if(s.powerOnline)return {ok:false,message:'備用電力已啟動'};
       s.powerOnline=true;s.eventCount++;
       return {ok:true,action:'power_restored',horde:10,gate:'power',
         message:map.theme==='hospital'?'醫院備用電源恢復，病房感染者受到吸引！':'碼頭配電站啟動，港區照明恢復！'};
     case 'seal':
       if(!s.powerOnline)return {ok:false,message:'需先恢復電力才能解除隔離門'};
       if(s.machineReady)return {ok:false,message:'隔離門已解除'};
       s.machineReady=true;s.eventCount++;
       return {ok:true,action:'seal_open',horde:19,gate:'isolation',
         message:'隔離病房門解鎖！感染者正從病房走廊湧出！'};
     case 'crane':
       if(!s.powerOnline)return {ok:false,message:'需先啟動貨櫃場配電站'};
       if(s.machineReady)return {ok:false,message:'起重機已完成啟動'};
       s.machineReady=true;s.eventCount++;
       return {ok:true,action:'crane_started',horde:21,gate:'containers',
         message:'起重機搬移貨櫃！巨響引來貨櫃區感染者！'};
     case 'alarm':
       if(now<s.alarmReadyAt)return {ok:false,message:'警報控制器冷卻中'};
       s.alarmReadyAt=now+75_000;s.eventCount++;
       return {ok:true,action:'alarm',horde:16,
         gate:map.theme==='hospital'?'ward':'pier',
         message:map.theme==='hospital'?'醫院緊急廣播響起！病房屍潮正在集結！':'港口汽笛警報響起！碼頭屍潮正在靠近！'};
     case 'relay':
       if(s.relayReady)return {ok:false,message:'通訊系統已連接'};
       s.relayReady=true;s.eventCount++;
       return {ok:true,action:'relay_online',horde:8,
         gate:map.theme==='hospital'?'elevator':'quay',
         message:map.theme==='hospital'?'院區直升機通訊已接通！':'海上救援通訊已接通！'};
     default:return {ok:false,message:'無法操作此機關'};
   }
 }
 if(!s.objectiveComplete)return {ok:false,message:'必須完成本關目標才能撤離'};
 if(!facilityRouteReady(s,id))return {ok:false,message:'撤離設施尚未啟動'};
 if(s.selectedRoute&&s.selectedRoute!==id)return {ok:false,message:'小隊已選擇其他撤離路線'};
 if(s.selectedRoute===id)return {ok:false,message:'撤離訊號已送出，請全隊集合'};
 s.selectedRoute=id;
 return {ok:true,action:'route_selected',horde:0,message:'撤離路線「'+r.label+'」已選定，全員前往集合'};
}
export function facilityExtractionZone(s,player){
 const route=getFacility(s?.mapId)?.routes.find(r=>r.id===s.selectedRoute);
 return !!route&&facilityRouteReady(s,route.id)&&!!player&&
   [player.x,player.y,player.z].every(Number.isFinite)&&
   Math.abs(player.y-route.y)<1.7&&distance(player,route)<=route.radius;
}
export function facilityPublicEnvironment(s,now=0){
 const map=getFacility(s?.mapId);
 return {powerOnline:s.powerOnline,blackoutRemainingMs:0,relayReady:s.relayReady,
   selectedRoute:s.selectedRoute,
   routes:map.routes.map(r=>({...r,ready:facilityRouteReady(s,r.id)})),
   devices:map.devices.map(d=>({...d,active:d.kind==='generator'?!s.powerOnline:
     d.kind==='relay'?!s.relayReady:d.kind==='alarm'?now>=s.alarmReadyAt:!s.machineReady}))};
}
