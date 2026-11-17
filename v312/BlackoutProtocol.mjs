/**
 * DEADLINE FOUR V3.12 BLACKOUT PROTOCOL (first playable vertical slice)
 * Pure server-owned state machine: the client may request an interaction, but
 * it cannot invent coordinates, trigger an outage, or declare an escape.
 */
export const DEVICES=Object.freeze({
  generator:Object.freeze({id:'generator',label:'備用發電機',x:0,y:0,z:-24,range:3.2}),
  relay:Object.freeze({id:'relay',label:'地下通訊繼電器',x:0,y:0,z:24,range:3.2}),
  alarm:Object.freeze({id:'alarm',label:'誘餌警報器',x:-24,y:0,z:0,range:3.2}),
});
export const ROUTES=Object.freeze({
  van:Object.freeze({id:'van',label:'西側裝甲車',x:-70,y:0,z:0,radius:5,requires:'none'}),
  convoy:Object.freeze({id:'convoy',label:'東側醫療車隊',x:70,y:0,z:0,radius:5,requires:'power'}),
  tunnel:Object.freeze({id:'tunnel',label:'南側地下通道',x:0,y:0,z:70,radius:5,requires:'relay'}),
});
const finite=Number.isFinite;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const result=(ok,message,action=null)=>({ok,message,action});
export function createBlackoutProtocol({seed=1,now=0}={}){
  if(!finite(seed)||!finite(now))throw TypeError('invalid protocol seed or time');
  const n=Math.trunc(seed)>>>0;
  return {
    seed:n,powerOnline:true,blackoutEndsAt:0,nextBlackoutAt:now+45000+(n%26000),
    relayReady:false,alarmReadyAt:0,selectedRoute:null,
    routes:['van',n%2===0?'convoy':'tunnel'],
    lastInteractionAt:new Map(),
  };
}
export function triggerBlackout(p,now,durationMs=35000){
  if(!finite(now)||!Number.isInteger(durationMs)||durationMs<=0)return false;
  if(!p.powerOnline)return false;
  p.powerOnline=false;p.blackoutEndsAt=now+durationMs;
  p.nextBlackoutAt=now+105000;
  return true;
}
export function advanceBlackoutProtocol(p,now){
  if(!finite(now))return null;
  if(p.powerOnline&&now>=p.nextBlackoutAt){
    triggerBlackout(p,now);return 'blackout';
  }
  if(!p.powerOnline&&now>=p.blackoutEndsAt){
    p.powerOnline=true;p.blackoutEndsAt=0;
    p.nextBlackoutAt=Math.max(p.nextBlackoutAt,now+55000);
    return 'power_restored';
  }
  return null;
}
export function routeReady(p,id){
  const route=ROUTES[id];
  if(!route||!p.routes.includes(id))return false;
  return route.requires==='none'||
    (route.requires==='power'&&p.powerOnline)||
    (route.requires==='relay'&&p.relayReady);
}
/** Only server-provided player coordinates may reach this function. */
export function interactWithWorld(p,{player,id,now,phase='playing',downed=false}){
  if(phase!=='playing'||downed||!player||!finite(now))return result(false,'目前無法操作');
  if(typeof id!=='string'||id.length>32)return result(false,'找不到互動機關');
  const entry=DEVICES[id]??ROUTES[id];
  if(!entry||!finite(player.x)||!finite(player.z)||!finite(player.y))return result(false,'找不到互動機關');
  const max=entry.range??entry.radius;
  if(distance(entry,player)>max||Math.abs(entry.y-player.y)>1.7)
    return result(false,'距離太遠，請靠近機關');
  const last=p.lastInteractionAt.get(player.id)??-Infinity;
  if(now-last<600)return result(false,'操作過於頻繁');
  p.lastInteractionAt.set(player.id,now);
  if(id==='generator'){
    if(p.powerOnline)return result(false,'城市目前供電正常');
    p.powerOnline=true;p.blackoutEndsAt=0;p.nextBlackoutAt=now+90000;
    return result(true,'備用發電機已啟動，城市電力恢復','power_restored');
  }
  if(id==='relay'){
    if(p.relayReady)return result(false,'通訊繼電器已完成連線');
    p.relayReady=true;return result(true,'地下通道通訊已接通','relay_online');
  }
  if(id==='alarm'){
    if(now<p.alarmReadyAt)return result(false,'警報器仍在冷卻中');
    p.alarmReadyAt=now+60000;
    return result(true,'誘餌警報已啟動！屍潮將抵達，同時出現補給','alarm');
  }
  if(!p.routes.includes(id))return result(false,'這條路線本回合沒有開放');
  if(p.selectedRoute!==null&&p.selectedRoute!==id)
    return result(false,'小隊已選擇另一條撤離路線');
  if(p.selectedRoute===id)return result(false,'撤離訊號已發出，等待隊友會合');
  if(!p.objectiveComplete)return result(false,'需先完成本關目標才能撤離');
  if(!routeReady(p,id))return result(false,'撤離路線尚未解鎖，請恢復供電或接通通訊');
  p.selectedRoute=id;return result(true,`已選擇「${ROUTES[id].label}」！請所有生還隊員集合`,'route_selected');
}
export function inSelectedExtractionZone(p,player){
  const route=ROUTES[p.selectedRoute];
  return !!route&&routeReady(p,route.id)&&!!player&&finite(player.x)&&finite(player.z)&&
    finite(player.y)&&Math.abs(route.y-player.y)<1.7&&distance(route,player)<=route.radius;
}
export function publicEnvironment(p,now=0){
  return {
    powerOnline:p.powerOnline,
    blackoutRemainingMs:p.powerOnline?0:Math.max(0,p.blackoutEndsAt-now),
    relayReady:p.relayReady,
    selectedRoute:p.selectedRoute,
    routes:p.routes.map(id=>({...ROUTES[id],ready:routeReady(p,id)})),
    devices:Object.values(DEVICES).map(d=>({id:d.id,label:d.label,x:d.x,y:d.y,z:d.z,range:d.range,
      active:d.id==='generator'?!p.powerOnline:d.id==='relay'?!p.relayReady:now>=p.alarmReadyAt})),
  };
}
