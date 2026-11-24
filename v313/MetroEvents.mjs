/**
 * Shared authoritative V3.13 metro train-evacuation event loop.
 * F can only operate powered control rooms or alert devices in interaction range.
 * Reinforcements are limited by server queue, not client-supplied spawn counts.
 */
export const METRO_DEVICES=Object.freeze({
  metroPower:{id:'metroPower',label:'月台供電開關',x:-32,y:0,z:-19,range:3.4},
  metroAlarm:{id:'metroAlarm',label:'車站緊急警報',x:-10,y:0,z:-22,range:3.4},
  metroTrain:{id:'metroTrain',label:'列車啟動控制台',x:54,y:0,z:-16,range:3.4},
});
export const METRO_EXITS=Object.freeze({
  train:{id:'train',label:'北側緊急列車',x:67,y:0,z:-16,radius:6,requires:'power'},
  safehouse:{id:'safehouse',label:'西側安全屋出口',x:-69,y:0,z:-14,radius:7,requires:'none'}
});
const within=(p,t,r)=>Number.isFinite(p.x)&&Number.isFinite(p.z)&&Number.isFinite(p.y)&&
  Math.abs(p.y-(t.y||0))<1.7&&Math.hypot(p.x-t.x,p.z-t.z)<r;
export function createMetroEvents(seed=1){
  return {seed:Math.trunc(seed)>>>0,powerOnline:false,relayReady:false,
    alarmReadyAt:0,trainReady:false,trainStartsAt:0,trainArrivesAt:0,
    selectedRoute:null,objectiveComplete:false,lastInteractionAt:new Map(),
    routes:['train','safehouse']};
}
export function metroRouteReady(state,id,now){
  if(id==='safehouse')return true;
  return id==='train'&&state.powerOnline&&state.trainReady&&now>=state.trainArrivesAt;
}
export function metroInteract(state,{player,id,now,phase,downed}){
  if(phase!=='playing'||downed||!player||typeof id!=='string'||!Number.isFinite(now))return {ok:false,message:'目前無法操作'};
  const t=Object.hasOwn(METRO_DEVICES,id)?METRO_DEVICES[id]:
    Object.hasOwn(METRO_EXITS,id)?METRO_EXITS[id]:null;
  if(!t)return {ok:false,message:'找不到車站機關'};
  if(!within(player,t,t.range??t.radius))return {ok:false,message:'距離機關太遠'};
  const last=state.lastInteractionAt.get(player.id)??-Infinity;
  if(now-last<600)return {ok:false,message:'請稍候再次操作'};
  state.lastInteractionAt.set(player.id,now);
  if(id==='metroPower'){
    if(state.powerOnline)return {ok:false,message:'月台已經恢復供電'};
    state.powerOnline=true;
    return {ok:true,action:'power_restored',horde:10,message:'車站電力恢復！供電異響吸引了一批感染者'};
  }
  if(id==='metroAlarm'){
    if(now<state.alarmReadyAt)return {ok:false,message:'緊急警報器冷卻中'};
    state.alarmReadyAt=now+75_000;
    return {ok:true,action:'alarm',horde:18,message:'緊急警報啟動！感染者從隧道襲來'};
  }
  if(id==='metroTrain'){
    if(!state.powerOnline)return {ok:false,message:'先恢復月台電力'};
    if(state.trainReady)return {ok:false,message:'列車已收到啟動訊號'};
    state.trainReady=true;state.trainStartsAt=now;state.trainArrivesAt=now+25_000;
    return {ok:true,action:'train_started',horde:24,message:'列車啟動！25秒後抵達，請守住車站月台'};
  }
  if(!state.objectiveComplete)return {ok:false,message:'需先完成當前殭屍目標'};
  if(state.selectedRoute&&state.selectedRoute!==id)return {ok:false,message:'撤離路線已選定'};
  if(!metroRouteReady(state,id,now))return {ok:false,message:'列車尚未到站，請繼續防守'};
  if(state.selectedRoute===id)return {ok:false,message:'撤離路線已選定，全隊集合'};
  state.selectedRoute=id;
  return {ok:true,action:'route_selected',horde:0,message:'撤離路線「'+METRO_EXITS[id].label+'」已選定，全隊集合'};
}
export function metroExtractionZone(state,p,now){
  const r=METRO_EXITS[state?.selectedRoute];
  return !!r&&metroRouteReady(state,r.id,now)&&!!p&&within(p,r,r.radius);
}
export function metroPublicEnvironment(state,now){
  return {powerOnline:state.powerOnline,blackoutRemainingMs:0,relayReady:state.trainReady,
    selectedRoute:state.selectedRoute,
    routes:state.routes.map(id=>({...METRO_EXITS[id],ready:metroRouteReady(state,id,now)})),
    devices:Object.values(METRO_DEVICES).map(t=>({...t,active:t.id==='metroPower'?!state.powerOnline:
      t.id==='metroTrain'?!state.trainReady:now>=state.alarmReadyAt}))
  };
}
