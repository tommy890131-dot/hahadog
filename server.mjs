import http from 'node:http';
import {createRound,enterPlayer,setPlayerState,completeObjective,stepRound,computeThreat} from './v311/survival-round.mjs';
import {createBlackoutProtocol,advanceBlackoutProtocol,triggerBlackout,interactWithWorld,
  publicEnvironment,inSelectedExtractionZone,ROUTES} from './v312/BlackoutProtocol.mjs';
import {CLASSES,LEVELS} from './v311/gameplay-catalog.mjs';
import {classShotModifiers,validClass} from './v311/ClassCombatRules.mjs';
import {getFacility,isFacility,facilityCanOccupy,facilityMoveHorizontal,
  facilityStepVertical,facilityCollisionBoxes,facilityFlowField,
  facilityRouteDirection,facilityPursue} from './v314/FacilityMaps.mjs';
import {createFacilityEvents,facilityInteract,facilityPublicEnvironment,
  facilityExtractionZone} from './v314/FacilityEvents.mjs';
import {createMapDirector,queueMapHorde,advanceMapDirector,nextMapSpawn} from './v314/MapDirector.mjs';
import {METRO_MAP,METRO_MAP_ID,metroCanOccupy,metroMoveHorizontal,metroStepVertical,
  metroCollisionBoxes,metroFlowField,metroPursue,metroRouteDirection} from './v313/MetroMap.mjs';
import {createMetroEvents,metroInteract,metroPublicEnvironment,
  metroExtractionZone,METRO_EXITS} from './v313/MetroEvents.mjs';
import {ROOM_IDLE_MS,SOCKET_PING_INTERVAL_MS,SOCKET_PONG_TIMEOUT_MS,
  pruneRoomRegistry,handshakeCapacity} from './v312/RoomCapacity.mjs';
import {stageAt,allowedCampaignAction,nextStageIndex,LAST_LEVEL} from './v311/campaign-flow.mjs';
import {SPECIALS,DEFENSES,RARITIES,chooseSpecial,bossPhase,lootRarity,validPlacement,claimLoot,canTurretShoot,nextEvent} from './v311/GameplaySystems.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { splitArmorDamage, gainExperience } from './packages/shared/EconomyRules.mjs';
import { VERTICAL_LAYOUT, PHYSICS, canOccupyAt, moveHorizontal, stepVertical } from './packages/shared/VerticalCollision.mjs';
import { navigation, buildZombieBuckets, advanceZombie, directPursuitPossible } from './packages/shared/ZombieNavigation.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const WEAPONS = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/shared/WeaponConfig.json'), 'utf8'));
const MAP = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/shared/MapLayout.json'), 'utf8'));
const SHOP = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/shared/ShopRules.json'), 'utf8'));
const INTERMISSION_MS = process.env.NODE_ENV === 'test' && process.env.TEST_INTERMISSION_MS ? Number(process.env.TEST_INTERMISSION_MS) : SHOP.intermissionMs;
const TEST_EMPTY_WAVES = process.env.NODE_ENV === 'test' && process.env.TEST_EMPTY_WAVES === '1';
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const TICK_MS = 50;
const V311 = process.env.V311_ENABLED === '1';
const MAX_ZOMBIES = Math.max(8, Math.min(96, Number(process.env.GAME_MAX_ZOMBIES) || 96));
const WORLD_LIMIT = MAP.halfSize;
const MAX_ROOMS = Math.max(1, Math.min(100, Number(process.env.GAME_MAX_ROOMS) || 100));
const MAX_TOTAL_CONNECTIONS = Math.max(4, Math.min(256, Number(process.env.GAME_MAX_CONNECTIONS) || 256));
const MAX_IP_CONNECTIONS = Math.max(4,Math.min(256,Number(process.env.WS_IP_LIMIT)||64));
const MAX_MESSAGES_PER_SECOND = 90;
const MAX_JSON_BYTES = 4096;
const MAX_INBOUND_BURST = 32768;
const MAX_INBOUND_BYTES_PER_SECOND = 16384;
const WS_ALLOWED_ORIGINS = new Set((process.env.WS_ALLOWED_ORIGINS || '')
  .split(',').map(x=>x.trim().toLowerCase()).filter(Boolean));
const connectionCounts = new Map();
const handshakeRates = new Map();
function connectionAddress(req){
  // X-Forwarded-For is only trusted when explicitly enabled behind a trusted proxy.
  if(process.env.TRUST_PROXY === '1') {
    const forwarded = req.headers['x-forwarded-for'];
    if(typeof forwarded === 'string' && forwarded.trim())return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}
function acceptOrigin(req){
  const raw=req.headers.origin;
  // Non-browser test clients may omit Origin; they still face IP + packet quotas.
  if(raw === undefined)return true;
  if(typeof raw !== 'string')return false;
  try {
    const origin = new URL(raw);
    if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)return false;
    const host=String(req.headers.host||'').toLowerCase();
    return (origin.host.toLowerCase()===host) || WS_ALLOWED_ORIGINS.has(origin.origin.toLowerCase());
  } catch{return false;}
}
function allowHandshake(address,now){
  const rate=handshakeRates.get(address)||{since:now,count:0};
  if(now-rate.since>10_000){rate.since=now;rate.count=0;}
  rate.count++;
  handshakeRates.set(address,rate);
  // Avoid growing the map forever under address rotation.
  if(handshakeRates.size>2048){
    for(const [ip,v] of handshakeRates)if(now-v.since>10_000)handshakeRates.delete(ip);
    while(handshakeRates.size>4096)handshakeRates.delete(handshakeRates.keys().next().value);
  }
  return rate.count<=40;
}

const rooms = new Map();
const peers = new Set();
let nextZombieId = 1;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const finite = n => typeof n === 'number' && Number.isFinite(n);
const rnd = (a, b) => a + Math.random() * (b - a);
const distance2 = (a, b) => Math.hypot(a.x-b.x, a.z-b.z);
const codeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const safe = p =>{
  const base=isFacility(p.mapId)?getFacility(p.mapId).safehouse:
    p.mapId===METRO_MAP_ID?METRO_MAP.safehouse:MAP.safehouse;
  return Math.hypot(p.x-base.x,p.z-base.z)<=base.radius;
};
// Same static 3-D walls/floors/roof as the browser. The server never trusts client Y.
const collisionBoxes=VERTICAL_LAYOUT.boxes.filter(b=>b.solid).map(b=>({
  minX:b.x-b.w/2,maxX:b.x+b.w/2,
  minY:b.y-b.h/2,maxY:b.y+b.h/2,
  minZ:b.z-b.d/2,maxZ:b.z+b.d/2
}));
const metroBoxes=metroCollisionBoxes();
const hospitalBoxes=facilityCollisionBoxes('infected_hospital');
const harborBoxes=facilityCollisionBoxes('doomed_harbor');
const isMetro=room=>V311&&room?.mapId===METRO_MAP_ID;
const isFacilityRoom=room=>V311&&isFacility(room?.mapId);
const isFlatMap=room=>isMetro(room)||isFacilityRoom(room);
const mapDataForRoom=room=>isFacilityRoom(room)?getFacility(room.mapId):
  isMetro(room)?METRO_MAP:MAP;
const roomBoxes=room=>isFacilityRoom(room)?
  (room.mapId==='infected_hospital'?hospitalBoxes:harborBoxes):
  isMetro(room)?metroBoxes:collisionBoxes;
function canOccupy(x,z,r=.4,room=null){
  return isFacilityRoom(room)?facilityCanOccupy(room.mapId,x,z,0,r):
    isMetro(room)?metroCanOccupy(x,z,0,r):canOccupyAt(x,z,0,r);
}
function moveRoomPlayer(room,x,z,y,dx,dz,grounded){
  return isFacilityRoom(room)?facilityMoveHorizontal(room.mapId,x,z,y,dx,dz,grounded):
    isMetro(room)?metroMoveHorizontal(x,z,y,dx,dz,grounded):
      moveHorizontal(x,z,y,dx,dz,grounded);
}
function verticalRoomPlayer(room,y,vy,grounded,x,z,dt){
  return isFacilityRoom(room)?facilityStepVertical(y,vy,grounded,x,z,dt):
    isMetro(room)?metroStepVertical(y,vy,grounded,x,z,dt):
      stepVertical(y,vy,grounded,x,z,dt);
}
function publicRoomEnvironment(room,now){
  return isFacilityRoom(room)?facilityPublicEnvironment(room.protocol,now):
    isMetro(room)?metroPublicEnvironment(room.protocol,now):
      publicEnvironment(room.protocol,now);
}
function makeCode(){for(let k=0;k<200;k++){
  const code=Array.from(crypto.randomBytes(5),b=>codeAlphabet[b%codeAlphabet.length]).join('');
  if(!rooms.has(code))return code;
}return null;}
function weapon(id){return typeof id==='string' && Object.hasOwn(WEAPONS,id)?WEAPONS[id]:null;}
function freshAmmo(id){const w=WEAPONS[id];return {ammo:w.magazine,reserve:w.reserve};}
function createPlayer(peer,name,slot){
  const starts=[[-3,-2],[3,-2],[-3,3],[3,3]];const [x,z]=starts[slot]||[0,0];
  return {id:peer.id,name:String(name||'倖存者').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,16)||'倖存者',
    x,z,y:0,vy:0,grounded:true,lastJump:0,yaw:0,pitch:0,hp:100,maxHp:100,armor:0,level:1,xp:0,money:600,kills:0,
    owned:['p9'],primary:null,secondary:'p9',weaponId:'p9',inventory:{p9:freshAmmo('p9')},
    classId:'assault',skillNextAt:0,skillUntil:0,aiming:false,weaponLevel:0,
    downed:false,reloadUntil:0,lastShot:0,nextShotAt:0,lastMove:0,lastMoveSeq:0,moveCredit:0.35,lastShove:0,txn:new Map()};
}
function activeAmmo(p){return p.inventory[p.weaponId];}
function publicPlayer(p){const a=activeAmmo(p);return {id:p.id,name:p.name,x:p.x,z:p.z,y:p.y,vy:p.vy,grounded:p.grounded,yaw:p.yaw,pitch:p.pitch,ackMoveSeq:p.lastMoveSeq,
  hp:p.hp,maxHp:p.maxHp,armor:p.armor,level:p.level,xp:p.xp,nextXp:p.level>=50?0:p.level*150,money:p.money,kills:p.kills,
  weaponId:p.weaponId,primary:p.primary,secondary:p.secondary,owned:p.owned,ammo:a.ammo,reserve:a.reserve,classId:p.classId,weaponLevel:p.weaponLevel??0,
  downed:p.downed,reloading:p.reloadUntil>Date.now(),inSafehouse:safe(p)};}
function send(peer,msg){peer?.send(msg);}
function announce(room,obj){for(const peer of room.players.keys())send(peer,obj);}
function lobbyInfo(room){return {type:'room',code:room.code,hostId:room.hostId,
  phase:room.phase,wave:room.wave,players:[...room.players.values()].map(publicPlayer),
  levelIndex:room.levelIndex??0,mapId:room.mapId??'city',result:room.lastResult??null};}
function syncLobby(room){announce(room,lobbyInfo(room));}
function joinRoom(peer,code,name){
  if(peer.room){send(peer,{type:'error',message:'你已加入房間'});return;}
  const room=rooms.get(code);if(!room){send(peer,{type:'error',message:'找不到房間'});return;}
  if(room.players.size>=4){send(peer,{type:'error',message:'房間已滿（最多 4 人）'});return;}
  if(room.phase!=='lobby'){send(peer,{type:'error',message:'房間已開始遊戲'});return;}
  const p=createPlayer(peer,name,room.players.size);room.players.set(peer,p);peer.room=room;
  send(peer,{...lobbyInfo(room),type:'joined',selfId:peer.id});syncLobby(room);
}
function startWave(room){
  room.phase='playing';room.wave++;
  room.pending=TEST_EMPTY_WAVES?0:Math.min(135,24+room.wave*9+room.players.size*7+(V311?stageAt(room.levelIndex??0).extraEnemies:0));
  room.zombies=[];room.nextSpawnAt=Date.now();room.nextWaveAt=0;room.directorPhase='buildup';
  room.navUpdateAt=0;room.fields=new Map();room.navCursor=0;
  announce(room,{type:'wave',wave:room.wave,message:`第 ${room.wave} 波：城市屍潮來襲`});
}
function startIntermission(room,now){
  // This is authoritative: the 30-second shopping interval is zombie-free for all clients.
  room.phase='intermission';room.pending=0;room.zombies=[];room.nextWaveAt=now+INTERMISSION_MS;
  room.directorPhase='relax';room.fields.clear();room.revive.clear();
  for(const p of room.players.values()){
    if(p.downed){p.downed=false;p.hp=Math.min(p.maxHp,40);p.vy=0;p.grounded=true;}
    else p.hp=clamp(p.hp+20,0,p.maxHp);
    p.reloadUntil=0;
    for(const [id,a] of Object.entries(p.inventory))
      if(WEAPONS[id].category!=='pistol')a.reserve=Math.min(WEAPONS[id].reserve,a.reserve+WEAPONS[id].magazine*2);
  }
  announce(room,{type:'intermission',wave:room.wave,nextWave:room.wave+1,remainingMs:INTERMISSION_MS,
    message:`第 ${room.wave} 波已清除！30 秒安全採購時間，殭屍暫停出現`});
}
function snapshot(room,now){
  room.lastSnapshot=now;
  announce(room,{type:'snapshot',phase:room.phase,wave:room.wave,remaining:room.pending+room.zombies.length,
    shopRemainingMs:room.phase==='intermission'?Math.max(0,room.nextWaveAt-now):0,
    players:[...room.players.values()].map(publicPlayer),
    zombies:room.zombies.map(z=>({id:z.id,x:z.x,y:z.y,z:z.z,hp:z.hp,maxHp:z.maxHp??z.hp,kind:z.kind,step:z.step,facing:z.facing,moving:z.moving===true,attacking:Date.now()-(z.lastAttackAt??0)<420})),
    defenses:V311?room.defenses??[]:[],loot:V311?room.loot??[]:[],
    bossPhase:V311?(room.zombies.find(z=>z.kind==='boss')?.bossPhase??0):0,
    environment:V311&&room.protocol?publicRoomEnvironment(room,now):undefined,
    mapId:room.mapId??'city'});
}
function startMatch(room,{preserveCampaign=false}={}){
  const freshRun=room.phase==='ended';
  room.runId=(room.runId??0)+1;
  room.lastResult=null;
  room.fields.clear();room.revive.clear();room.damageTimes=[];
  room.pressure=0;room.lastSnapshot=0;room.navCursor=0;room.lastDirectorAt=0;
  room.wave=0;room.phase='lobby';room.zombies=[];room.pending=0;
  room.mapId=V311?(['city',METRO_MAP_ID,'infected_hospital','doomed_harbor'][room.levelIndex]??'city'):'city';
  let i=0;for(const p of room.players.values()){
    const starts=isFlatMap(room)?mapDataForRoom(room).starts:[[-3,-2],[3,-2],[-3,3],[3,3]],s=starts[i++];
    if(freshRun&&!preserveCampaign)Object.assign(p,{maxHp:100,armor:0,level:1,xp:0,money:600,kills:0,
      owned:['p9'],primary:null,secondary:'p9',weaponId:'p9',inventory:{p9:freshAmmo('p9')},weaponLevel:0,txn:new Map()});
    Object.assign(p,{mapId:room.mapId,x:s[0],z:s[1],y:0,vy:0,grounded:true,lastJump:0,hp:p.maxHp,downed:false,reloadUntil:0,lastShot:0,nextShotAt:0,lastMove:Date.now(),lastMoveSeq:0,moveCredit:.35,lastShove:0,navGoal:-1,navAt:0,aiming:false,skillNextAt:0,skillUntil:0});
    for(const id of Object.keys(p.inventory))p.inventory[id]=freshAmmo(id);
  }
  if(V311){
    const stage=stageAt(room.levelIndex??0);
    room.survival=createRound({seed:Date.now(),now:Date.now(),prepMs:0,extractionMs:stage.extractionMs});
    room.survival.extractionZone='multi_route';
    room.protocol=isFacilityRoom(room)
      ?createFacilityEvents(room.mapId,Date.now(),Date.now())
      :isMetro(room)?createMetroEvents(Date.now())
      :createBlackoutProtocol({seed:Date.now()+Math.floor(Math.random()*1000000),now:Date.now()});
    room.mapDirector=createMapDirector(room.mapId,Date.now(),Date.now());
    room.missionKills=0;
    room.defenses=[];room.loot=[];room.bossSpawned=false;room.nextExtraEventAt=Date.now()+45000;room.nextItemId=1;
    for(const p of room.players.values())enterPlayer(room.survival,p.id);
    stepRound(room.survival,Date.now());
    announce(room,{type:'campaignStart',levelIndex:room.levelIndex,levelId:stage.id,
      levelLabel:isFlatMap(room)?mapDataForRoom(room).label??mapDataForRoom(room).title:stage.label,
      mapId:room.mapId,goal:stage.goal,objective:isFacilityRoom(room)?(room.mapId==='infected_hospital'
          ?'恢復醫院供電、解除隔離門、抵擋病房屍潮並撤離'
          :'啟動港口配電、貨櫃起重機與救援通訊，防守直到撤離'):
        isMetro(room)?'恢復電力，啟動列車，擊退變異者並安全撤離':stage.objective,
      environment:publicRoomEnvironment(room,Date.now())});
    announce(room,{type:'mission',mission:room.survival.mission,levelIndex:room.levelIndex,levelId:stage.id,levelLabel:stage.label,goal:stage.goal,objective:stage.objective,progress:0,missionPhase:'objectives'});
  }
  startWave(room);
}
function rewardKill(room,player,z,headshot){
  if(z.rewarded)return;z.rewarded=true;
  const special=z.kind==='brute',runner=z.kind==='runner';
  const money=(special?100:runner?45:35)+(headshot?15:0);
  const xp=(special?120:runner?70:50)+(headshot?25:0);
  const oldLevel=player.level;
  player.money=Math.min(1_000_000_000,player.money+money);
  const progress=gainExperience(player.level,player.xp,xp);
  player.level=progress.level;player.xp=progress.xp;player.kills++;
  if(V311&&room.survival){
    if(room.loot.length<10&&(z.kind==='boss'||Math.random()<.26)){
      const rarity=lootRarity(Math.random());
      const item={id:room.nextItemId++,x:z.x,y:z.y,z:z.z,rarity,claimed:false};
      room.loot.push(item);
      announce(room,{type:'lootSpawn',item});
    }
  }
  if(V311&&room.survival?.phase==='objectives'){
    room.missionKills=(room.missionKills||0)+1;
    if(room.missionKills>=stageAt(room.levelIndex).goal && room.bossSpawned && !room.zombies.some(z=>z.kind==='boss'&&z.hp>0)){
      completeObjective(room.survival);
      room.protocol.objectiveComplete=true;
      stepRound(room.survival,Date.now());
      announce(room,{type:'mission',mission:room.survival.mission,levelIndex:room.levelIndex,levelId:LEVELS[room.levelIndex].id,
        levelLabel:isFlatMap(room)?mapDataForRoom(room).label??mapDataForRoom(room).title:LEVELS[room.levelIndex].label,
        goal:stageAt(room.levelIndex).goal,progress:stageAt(room.levelIndex).goal,missionPhase:'extraction',
        environment:publicRoomEnvironment(room,Date.now()),
        message:'任務完成！選擇地圖上兩條撤離路線之一，按 F 發出撤離信號後全隊集合'});
    }else announce(room,{type:'missionProgress',levelIndex:room.levelIndex,progress:Math.min(room.missionKills,stageAt(room.levelIndex).goal),goal:stageAt(room.levelIndex).goal});
  }
  player.maxHp+=progress.levelUps*5;
  player.hp=Math.min(player.maxHp,player.hp+progress.levelUps*5);
  send([...room.players.keys()].find(k=>room.players.get(k)===player),{
    type:'reward',money,xp,level:player.level,levelUps:player.level-oldLevel,headshot,zombieKind:z.kind,weaponId:player.weaponId});
}
function currentReloadMs(p){return Math.round(WEAPONS[p.weaponId].reloadMs*(1-Math.min(.2,(p.level-1)*.02)));}
function applyReload(p,now){
  if(!p.reloadUntil||now<p.reloadUntil)return;
  const w=WEAPONS[p.weaponId],a=activeAmmo(p);
  const count=w.category==='pistol' ? w.magazine-a.ammo : Math.min(w.magazine-a.ammo,a.reserve);
  a.ammo+=count;
  if(w.category!=='pistol')a.reserve-=count;
  p.reloadUntil=0;
}
function buy(room,p,sku,txn){
  if(typeof txn!=='string'||!/^[\w-]{8,64}$/.test(txn)){return {ok:false,reason:'無效交易編號'};}
  if(p.txn.has(txn))return p.txn.get(txn);
  let result={ok:false,reason:'商品不存在'};
  if(p.downed||room.phase==='ended'){result={ok:false,reason:'目前無法購買'};}
  else if(room.phase!=='intermission'&&!safe(p)){result={ok:false,reason:'戰鬥期間須回到中央安全屋才可購買'};}
  else if(sku==='armor'){
    const missing=Math.max(0,100-p.armor),cost=Math.ceil(missing*SHOP.armorPricePerPoint);
    if(!missing)result={ok:false,reason:'護甲已滿'};
    else if(p.money<cost)result={ok:false,reason:`護甲需 $${cost}，金錢不足`};
    else{p.money-=cost;p.armor=100;result={ok:true,cost,sku};}
  }else if(sku==='medkit'){
    const heal=Math.min(SHOP.medkitHeal,Math.max(0,p.maxHp-p.hp));
    if(!heal)result={ok:false,reason:'生命值已滿'};
    else if(p.money<SHOP.medkitCost)result={ok:false,reason:'醫療包金錢不足'};
    else{p.money-=SHOP.medkitCost;p.hp+=heal;result={ok:true,cost:SHOP.medkitCost,sku};}
  }else if(sku==='ammo'){
    const w=WEAPONS[p.weaponId],a=activeAmmo(p);
    if(w.category==='pistol')result={ok:false,reason:'手槍擁有無限備彈'};
    else if(a.reserve>=w.reserve)result={ok:false,reason:'備彈已滿'};
    else if(p.money<SHOP.ammoCost)result={ok:false,reason:'彈藥包金錢不足'};
    else{p.money-=SHOP.ammoCost;a.reserve=w.reserve;result={ok:true,cost:SHOP.ammoCost,sku};}
  }else{
    const w=weapon(sku);
    if(w){
      if(p.owned.includes(sku))result={ok:false,reason:'已擁有，請使用「裝備」'};
      else if(p.money<w.price)result={ok:false,reason:`需要 $${w.price}，金錢不足`};
      else{p.money-=w.price;p.owned.push(sku);p.inventory[sku]=freshAmmo(sku);
        if(w.category==='pistol')p.secondary=sku;else p.primary=sku;
        p.weaponId=sku;p.reloadUntil=0;result={ok:true,cost:w.price,sku};}
    }
  }
  p.txn.set(txn,result);if(p.txn.size>128)p.txn.delete(p.txn.keys().next().value);
  return result;
}
function equip(p,id){
  const w=weapon(id);if(!w||!p.owned.includes(id))return {ok:false,reason:'你沒有這把槍'};
  if(p.downed)return {ok:false,reason:'倒地時無法切換武器'};
  // Re-equipping the current weapon must not cancel a reload or reset fire cadence.
  if(p.weaponId===id)return {ok:true,sku:id};
  p.weaponId=id;p.reloadUntil=0;
  return {ok:true,sku:id};
}
function hurt(room,p,amount){
  if(p.downed)return;
  const result=splitArmorDamage(p.hp,p.armor,amount);
  const {armorDamage,hpDamage}=result;
  p.armor=result.armor;p.hp=result.hp;
  room.damageTimes.push(Date.now());announce(room,{type:'damage',target:p.id,amount:hpDamage,armorDamage});
  if(p.hp===0){p.downed=true;p.reloadUntil=0;announce(room,{type:'downed',target:p.id});}
}
function rayBox(from,dir,box){
  let low=0,high=125;
  for(const [axis,min,max] of [['x',box.minX,box.maxX],['y',box.minY,box.maxY],['z',box.minZ,box.maxZ]]){
    const v=dir[axis],f=from[axis];
    if(Math.abs(v)<1e-8){if(f<min||f>max)return Infinity;continue;}
    const a=(min-f)/v,b=(max-f)/v;
    low=Math.max(low,Math.min(a,b));high=Math.min(high,Math.max(a,b));
    if(low>high)return Infinity;
  }
  return low;
}
function raySphere(from,dir,center,r){
  const ox=center.x-from.x,oy=center.y-from.y,oz=center.z-from.z;
  const dot=ox*dir.x+oy*dir.y+oz*dir.z;
  if(dot<0)return Infinity;
  const diff=ox*ox+oy*oy+oz*oz-dot*dot;
  if(diff>r*r)return Infinity;
  return Math.max(0,dot-Math.sqrt(Math.max(0,r*r-diff)));
}
function shoot(room,p,now,shotId){
  // Visual barrel origin is derived on the server for remote teammates.
  // Damage/hit tests below continue to use the authoritative camera ray.
  const scopedShotId=Number.isSafeInteger(shotId)&&shotId>=0&&shotId<1e9?shotId:undefined;
  const w=WEAPONS[p.weaponId],a=activeAmmo(p);
  if(p.downed||room.phase!=='playing'||p.reloadUntil||now<(p.nextShotAt||0)||a.ammo<=0)return;
  const buffs=V311?classShotModifiers(p,now):{damage:1,spread:1,cadence:1,headshot:1};
  a.ammo--;p.lastShot=now;p.nextShotAt=now+60000/w.rpm*buffs.cadence;
  const spread=w.spread*(V311&&p.aiming?.35:1)*buffs.spread*Math.PI/180;
  const yaw=p.yaw+rnd(-spread,spread),pitch=p.pitch+rnd(-spread*.7,spread*.7);
  const dir={x:Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)};
  const from={x:p.x,y:p.y+1.52,z:p.z};let wallAt=115;
  const visualFrom={
    x:from.x+Math.cos(yaw)*.38+dir.x*1.05,
    y:from.y-.29+dir.y*1.05,
    z:from.z+Math.sin(yaw)*.38+dir.z*1.05
  };
  for(const b of roomBoxes(room))wallAt=Math.min(wallAt,rayBox(from,dir,b));
  const hits=[];
  for(const z of room.zombies){
    const head=raySphere(from,dir,{x:z.x,y:z.y+(z.kind==='boss'?3:z.kind==='brute'||z.kind==='juggernaut'?1.85:1.55),z:z.z},
      z.kind==='boss'?.55:z.kind==='brute'||z.kind==='juggernaut'?.31:.245);
    const body=raySphere(from,dir,{x:z.x,y:z.y+(z.kind==='boss'?2.1:z.kind==='brute'||z.kind==='juggernaut'?1.12:1.04),z:z.z},
      z.kind==='boss'?1.4:z.kind==='brute'||z.kind==='juggernaut'?.79:.51);
    const t=Math.min(head,body);
    if(Number.isFinite(t)&&t<wallAt && t<110)hits.push({z,t,headshot:head<=body});
  }
  hits.sort((a,b)=>a.t-b.t);
  let hit=false,killed=false,headshot=false;
  for(const entry of hits.slice(0,w.penetration)){
    const z=entry.z;if(z.hp<=0)continue;
    hit=true;headshot ||=entry.headshot;
    const t=clamp((entry.t-w.falloffStart)/(w.falloffEnd-w.falloffStart),0,1);
    const dmg=Math.round(w.damage*(1+(p.weaponLevel||0)*.12)*(1-t*(1-w.minFactor))*buffs.damage*(entry.headshot?(V311&&p.weaponId==='sniper'?2.5:1.65)*buffs.headshot:1));
    z.hp-=dmg;z.knockX+=dir.x*w.knockback;z.knockZ+=dir.z*w.knockback;
    if(z.hp<=0){rewardKill(room,p,z,entry.headshot);killed=true;}
  }
  if(killed)room.zombies=room.zombies.filter(z=>z.hp>0);
  const maxDistance=hits.length?Math.min(wallAt,hits[0].t):wallAt;
  const to={x:from.x+dir.x*maxDistance,y:from.y+dir.y*maxDistance,z:from.z+dir.z*maxDistance};
  const offset={x:to.x-visualFrom.x,y:to.y-visualFrom.y,z:to.z-visualFrom.z};
  const visualDistance=Math.hypot(offset.x,offset.y,offset.z);
  let visualTo=to;
  if(visualDistance>.001){
    const heading={x:offset.x/visualDistance,y:offset.y/visualDistance,z:offset.z/visualDistance};
    let wallDistance=visualDistance;
    for(const box of roomBoxes(room))wallDistance=Math.min(wallDistance,rayBox(visualFrom,heading,box));
    if(Number.isFinite(wallDistance)&&wallDistance<visualDistance-.05)
      visualTo={x:visualFrom.x+heading.x*Math.max(0,wallDistance-.03),
        y:visualFrom.y+heading.y*Math.max(0,wallDistance-.03),
        z:visualFrom.z+heading.z*Math.max(0,wallDistance-.03)};
  }
  announce(room,{type:'shot',by:p.id,shotId:scopedShotId,weaponId:p.weaponId,
    from,to,visualFrom,visualTo,hit,killed,headshot,enemyId:hits[0]?.z.id??null});
}
function spawnZombie(room,directorSpawn=null){
  let pos=null;
  for(let attempt=0;attempt<45;attempt++){
    const spawnPoints=mapDataForRoom(room).spawns;
    const base=directorSpawn??spawnPoints[Math.floor(rnd(0,spawnPoints.length))];
    const spread=directorSpawn?1.25:isFlatMap(room)?3.0:8;
    const x=base.x+rnd(-spread,spread),z=base.z+rnd(-spread,spread);
    if(canOccupy(x,z,.65,room)&&[...room.players.values()].every(p=>distance2(p,{x,z})>16)){pos={x,z};break;}
  }
  if(!pos)return;
  const n=Math.random(),brute=n<Math.min(.025+room.wave*.009,.11),runner=!brute&&n<.22;
  const kind=directorSpawn?.kind??(V311&&Math.random()<.27?
    chooseSpecial(Math.floor(Math.random()*100),room.wave):brute?'brute':runner?'runner':'walker');
  const special=SPECIALS[kind];
  const hp=special?.hp??(brute?180:runner?65:90);
  room.zombies.push({id:nextZombieId++,x:pos.x,y:0,vy:0,grounded:true,z:pos.z,kind,hp,maxHp:hp,
    speed:special?.speed??((brute?1.9:runner?4.4:2.8)+Math.min(room.wave*.1,.8)),attackAt:0,abilityAt:0,step:rnd(0,8),
    facing:0,knockX:0,knockZ:0,vx:0,vz:0,stuckFor:0,nextStumble:0,stumbleUntil:0,rewarded:false});
}
/**
 * Authoritative multi-floor navigation: each player gets a 3D flow field.
 * Each zombie picks the reachable player with the shortest navigation cost,
 * then adds slight organic steering and spatial-hash crowd separation.
 */
// Global fair scheduling: only one expensive navigation request is in-flight
// across *all* rooms, computed in a worker thread off the game loop.
let navWorker = null;
let navWorkerBusy = false;
let navWorkerFailed = false;
let navJob = null;
let navJobCounter = 0;
let navRoomCursor = 0;
try {
  navWorker = new Worker(new URL('./server/NavigationWorker.mjs', import.meta.url));
  navWorker.on('message', reply => {
    const job = navJob;
    if (!job || reply.id !== job.id) return;
    navJob = null;
    navWorkerBusy = false;
    if (reply.error) { console.warn('[NavigationWorker]', reply.error); navWorkerFailed = true; return; }
    const room = rooms.get(job.code);
    if (!room || room !== job.room || room.phase !== 'playing' || room.wave !== job.wave || room.runId !== job.runId) return;
    const p = [...room.players.values()].find(player => player.id === job.playerId);
    if (!p || p.downed || navigation.closest(p.x, p.z, p.y) !== reply.goal) return;
    room.fields.set(p.id, { goal: reply.goal, dist: reply.dist, next: reply.next });
    p.navGoal = reply.goal;
    p.navAt = Date.now();
  });
  navWorker.on('error', error => {
    console.warn('[NavigationWorker] unavailable; using limited synchronous fallback', error);
    navWorkerFailed = true;
    navWorkerBusy = false;
    navJob = null;
  });
  navWorker.on('exit', code => {
    if (code !== 0) console.warn('[NavigationWorker] exited:', code);
    navWorkerFailed = true; navWorkerBusy = false; navJob = null;
  });
} catch (error) {
  navWorkerFailed = true;
  console.warn('[NavigationWorker] creation failed:', error);
}
function scheduleNavigation(now) {
  if (navWorkerBusy) return;
  const candidates = [...rooms.values()].filter(room => !isFlatMap(room) && room.phase === 'playing' && room.zombies.length);
  if (!candidates.length) return;
  const start = (navRoomCursor++ % candidates.length);
  for (let i = 0; i < candidates.length; i++) {
    const room = candidates[(start + i) % candidates.length];
    const living = [...room.players.values()].filter(p => !p.downed);
    for (let n = 0; n < living.length; n++) {
      const p = living[room.navCursor++ % living.length];
      const goal = navigation.closest(p.x, p.z, p.y);
      if (room.fields.has(p.id) && (goal === p.navGoal || now - (p.navAt || 0) < 250)) continue;
      if (navWorkerFailed) {
        // Fallback is globally bounded to ONE synchronous computation per tick.
        room.fields.set(p.id, navigation.routeTo(p));
        p.navGoal = goal; p.navAt = now;
        return;
      }
      const id = ++navJobCounter;
      navWorkerBusy = true;
      navJob = { id, code: room.code, room, wave: room.wave, runId:room.runId,playerId: p.id };
      try { navWorker.postMessage({ id, x: p.x, y: p.y, z: p.z }); }
      catch (error) {
        console.warn('[NavigationWorker] request failed', error);
        navWorkerFailed = true; navWorkerBusy = false; navJob = null;
      }
      return;
    }
  }
}

function chooseTarget(room,z,living){
  if(isFlatMap(room)){
    let target=null,score=Infinity;
    for(const p of living){
      const field=room.fields.get(p.id);
      const v=isFacilityRoom(room)?facilityRouteDirection(room.mapId,z,p,field):
        metroRouteDirection(z,p,field);
      if(Math.hypot(v.dx,v.dz)<.001&&distance2(z,p)>2.5)continue;
      const dist=distance2(z,p);
      if(dist<score){score=dist;target=p;}
    }
    return target;
  }
  const cell=navigation.closest(z.x,z.z,z.y);
  let chosen=null,best=Infinity;
  for(const p of living){
    const route=room.fields.get(p.id);
    const navCost=cell>=0?route?.dist[cell]:Infinity;
    if(!Number.isFinite(navCost))continue;
    const cost=navCost + Math.hypot(p.x-z.x,p.z-z.z)*.035;
    if(cost<best){best=cost;chosen=p;}
  }
  if(chosen)return chosen;
  // Don't freeze enemies while a navigation worker result is pending.
  let nearest=null,nearestDistance=Infinity;
  for(const p of living){
    const dist=distance2(z,p);
    if(dist<nearestDistance&&directPursuitPossible(z,p,10)&&clearZombieSight(z,p,room)){
      nearest=p;nearestDistance=dist;
    }
  }
  return nearest;
}
function clearZombieSight(z,p,room){
  const ax={x:z.x,y:z.y+1.2,z:z.z};
  const dx=p.x-z.x,dy=(p.y+1.0)-ax.y,dz=p.z-z.z;
  const d=Math.hypot(dx,dy,dz);
  if(d<.001)return true;
  const dir={x:dx/d,y:dy/d,z:dz/d};
  return !roomBoxes(room).some(b=>rayBox(ax,dir,b)<d-.35);
}
function pursue(room,z,target,dt,now,nearby){
  const field=room.fields.get(target.id);
  if(isFacilityRoom(room)){facilityPursue(room.mapId,z,target,field,dt);return;}
  if(isMetro(room)){metroPursue(z,target,field,dt);return;}
  if(!field&&!directPursuitPossible(z,target))return;
  advanceZombie(z,target,field,nearby,dt,now,z.knockX,z.knockZ);
  z.knockX*=.77;z.knockZ*=.77;
}
function onMessage(peer,msg){
  if(!msg||typeof msg!=='object'||Array.isArray(msg))return;
  const now=Date.now();
  if(peer.room&&msg.type!=='ping'&&msg.type!=='pong')peer.room.lastActivityAt=now;
  if(msg.type==='ping'){send(peer,{type:'pong',t:finite(msg.t)?msg.t:now});return;}
  if(msg.type==='create'){
    if(peer.room)return;
    pruneRoomRegistry(rooms,now,expireRoom);
    if(rooms.size>=MAX_ROOMS){
      send(peer,{type:'error',message:'目前所有遊戲房間都在使用中，請稍後重試或加入朋友的房間'});
      return;
    }
    const code=makeCode();if(!code)return;
    const room={code,players:new Map(),hostId:peer.id,phase:'lobby',wave:0,zombies:[],pending:0,levelIndex:0,lastResult:null,
      createdAt:now,lastActivityAt:now,mapId:'city',
      nextSpawnAt:0,nextWaveAt:0,lastSnapshot:0,damageTimes:[],lastDirectorAt:0,
      navCursor:0,pressure:0,directorPhase:'buildup',relaxUntil:0,navUpdateAt:0,fields:new Map(),revive:new Map()};
    rooms.set(code,room);joinRoom(peer,code,msg.name);return;
  }
  if(msg.type==='join'){joinRoom(peer,String(msg.code||'').trim().toUpperCase().slice(0,5),msg.name);return;}
  const room=peer.room,p=room?.players.get(peer);if(!p)return;
  if(msg.type==='start'){
    if(peer.id!==room.hostId){send(peer,{type:'error',message:'只有隊長能開始遊戲'});return;}
    if(room.phase==='lobby'||(!V311&&room.phase==='ended'))startMatch(room);
    return;
  }
  if(V311&&process.env.NODE_ENV==='test'&&process.env.TEST_CAMPAIGN_CONTROL==='1'&&msg.type==='testCampaignResult'){
    if(peer.id===room.hostId&&room.phase==='playing'&&['won','lost'].includes(msg.result))finishCampaign(room,msg.result);
    return;
  }
  if(V311&&msg.type==='selectMap'&&room.phase==='lobby'){
    if(peer.id!==room.hostId){send(peer,{type:'error',message:'只有隊長能選擇地圖'});return;}
    const choices=['city',METRO_MAP_ID,'infected_hospital','doomed_harbor'];
    if(typeof msg.mapId!=='string'||!choices.includes(msg.mapId))return;
    room.levelIndex=choices.indexOf(msg.mapId);room.mapId=msg.mapId;
    syncLobby(room);return;
  }
  if(V311&&['retryLevel','nextLevel','restartCampaign'].includes(msg.type)){
    const action=msg.type;
    if(!allowedCampaignAction({phase:room.phase,result:room.lastResult,index:room.levelIndex,action,isHost:peer.id===room.hostId})){
      send(peer,{type:'error',message:'操作無效：請確認隊長及關卡結算狀態'});return;
    }
    const preserveCampaign=action==='nextLevel';
    room.levelIndex=nextStageIndex(room.levelIndex,action);
    startMatch(room,{preserveCampaign});return;
  }
  if(V311&&msg.type==='selectClass'&&room.phase==='lobby'&&validClass(msg.classId)){
    p.classId=msg.classId;syncLobby(room);return;
  }
  if(V311&&msg.type==='interactWorld'){
    const input={player:p,id:msg.id,now,phase:room.phase,downed:p.downed};
    const outcome=isFacilityRoom(room)?facilityInteract(room.protocol,input):
      isMetro(room)?metroInteract(room.protocol,input):
      interactWithWorld(room.protocol,input);
    send(peer,{type:'environmentAction',ok:outcome.ok,message:outcome.message,action:outcome.action});
    if(outcome.ok){
      if(isFlatMap(room)&&outcome.horde){
        const group=queueMapHorde(room.mapDirector,{count:outcome.horde,
          gate:outcome.gate??null,now,cause:'environment',pressure:room.pressure});
        if(group)announce(room,{type:'hordeWarning',mapId:room.mapId,
          gate:group.gate,label:group.label,count:group.total,
          message:outcome.message});
      }
      if(outcome.action==='alarm'&&!isFlatMap(room)){
        room.pending=Math.min(135,room.pending+8);
        if(room.loot.length<10){
          const item={id:room.nextItemId++,x:-24,y:0,z:0,rarity:'rare',claimed:false};
          room.loot.push(item);announce(room,{type:'lootSpawn',item});
        }
      }
      announce(room,{type:'environmentState',environment:publicRoomEnvironment(room,now),
        message:outcome.message,by:p.id,action:outcome.action});
    }
    return;
  }
  if(V311&&msg.type==='aim'&&typeof msg.active==='boolean'){
    p.aiming=msg.active&&room.phase==='playing'&&!p.downed;return;
  }
  if(V311&&msg.type==='skill'&&room.phase==='playing'&&!p.downed&&now>=p.skillNextAt){
    p.skillNextAt=now+CLASSES[p.classId].cooldownMs;
    if(p.classId==='medic'){
      for(const teammate of room.players.values())if(!teammate.downed&&distance2(p,teammate)<8&&Math.abs(p.y-teammate.y)<2)
        teammate.hp=Math.min(teammate.maxHp,teammate.hp+35);
    }else if(p.classId==='engineer')p.armor=Math.min(100,p.armor+35);
    else p.skillUntil=now+10000;
    announce(room,{type:'skillUsed',by:p.id,classId:p.classId});return;
  }
  if(V311&&msg.type==='buildDefense'&&room.phase==='playing'&&!p.downed){
    const kind=msg.kind;
    const position={x:p.x+Math.sin(p.yaw)*2.6,y:p.y,z:p.z-Math.cos(p.yaw)*2.6};
    const validation=validPlacement({player:p,position,existing:room.defenses,kind,credits:p.money,
      solidAt:pos=>!canOccupy(pos.x,pos.z,.65,room)});
    if(!validation.ok){send(peer,{type:'actionResult',message:'無法建造：'+validation.reason});return;}
    p.money-=validation.cost;
    const d={id:room.nextItemId++,kind,x:position.x,y:position.y,z:position.z,hp:DEFENSES[kind].hp,maxHp:DEFENSES[kind].hp,nextShotAt:0};
    room.defenses.push(d);announce(room,{type:'defenseBuilt',defense:d,by:p.id});return;
  }
  if(V311&&msg.type==='repairDefense'&&room.phase==='playing'&&!p.downed){
    const d=room.defenses.find(d=>d.id===msg.id);
    if(!d||distance2(d,p)>3||Math.abs(d.y-p.y)>1.5||p.money<80||d.hp>=d.maxHp)return;
    p.money-=80;d.hp=Math.min(d.maxHp,d.hp+90);announce(room,{type:'defenseRepaired',id:d.id,hp:d.hp});return;
  }
  if(V311&&msg.type==='collectLoot'&&room.phase==='playing'&&!p.downed){
    const item=room.loot.find(x=>x.id===msg.id);
    if(!claimLoot({player:p,item}))return;
    item.claimed=true;p.money+=RARITIES[item.rarity].credits;
    if(item.rarity==='rare'||item.rarity==='legendary')p.weaponLevel=Math.min(3,(p.weaponLevel||0)+(item.rarity==='legendary'?2:1));
    if(item.rarity==='legendary'&&!p.owned.includes('sniper_rifle')){
      p.owned.push('sniper_rifle');p.inventory.sniper_rifle=freshAmmo('sniper_rifle');p.primary='sniper_rifle';
    }
    room.loot=room.loot.filter(x=>!x.claimed);
    announce(room,{type:'lootCollected',id:item.id,rarity:item.rarity,by:p.id,credits:RARITIES[item.rarity].credits,
      upgradeLevel:p.weaponLevel,unlockedSniper:item.rarity==='legendary'});
    return;
  }
  if(msg.type==='move'&&room.phase==='playing'&&!p.downed){
    if(![msg.x,msg.z,msg.yaw,msg.pitch].every(finite))return;
    const elapsed=now-p.lastMove;
    // A cumulative movement budget allows network jitter but gives NO free distance per packet.
    // Fast packet spam and repeated 35ms packets cannot increase average speed.
    if(elapsed>=30){
      const maxSpeed=7.5*(1-WEAPONS[p.weaponId].speedPenalty);
      p.moveCredit=Math.min(maxSpeed*.17,(p.moveCredit||0)+maxSpeed*clamp(elapsed/1000,0,.17));
      const dx=msg.x-p.x,dz=msg.z-p.z,requested=Math.hypot(dx,dz);
      if(requested<=p.moveCredit+1e-6){
        const moved=moveRoomPlayer(room,p.x,p.z,p.y,dx,dz,p.grounded);
        p.moveCredit=Math.max(0,p.moveCredit-Math.hypot(moved.x-p.x,moved.z-p.z));
        p.x=moved.x;p.z=moved.z;
        if(p.grounded)p.y=moved.feet;
      }
      p.lastMove=now;
      if(Number.isSafeInteger(msg.seq) && msg.seq > p.lastMoveSeq && msg.seq < 2_000_000_000) p.lastMoveSeq=msg.seq;
    }
    // msg.y is intentionally ignored; vertical authority remains on the server.
    p.yaw=((msg.yaw%(2*Math.PI))+2*Math.PI)%(2*Math.PI);
    p.pitch=clamp(msg.pitch,-1.38,1.38);return;
  }
  if(msg.type==='jump'&&room.phase==='playing'&&!p.downed){
    if(p.grounded && now-p.lastJump>400){
      p.vy=PHYSICS.jumpVelocity;p.grounded=false;p.lastJump=now;
    }
    return;
  }
  if(msg.type==='shoot'){shoot(room,p,now,msg.shotId);return;}
  if(msg.type==='reload'&&!p.downed&&room.phase==='playing'&&!p.reloadUntil){
    const w=WEAPONS[p.weaponId],a=activeAmmo(p);
    if(a.ammo<w.magazine && (a.reserve>0||w.category==='pistol')){
      p.reloadUntil=now+currentReloadMs(p);
      announce(room,{type:'reload',by:p.id,weaponId:p.weaponId,reloadMs:currentReloadMs(p)});
    }
    return;
  }
  if(msg.type==='shove'&&room.phase==='playing'&&!p.downed&&now-p.lastShove>=650){
    p.lastShove=now;let hits=0;
    const fx=Math.sin(p.yaw),fz=-Math.cos(p.yaw);
    for(const z of [...room.zombies]){
      const dx=z.x-p.x,dz=z.z-p.z,dist=Math.hypot(dx,dz);
      if(dist<.001||dist>2||Math.abs(z.y-p.y)>1.25||(dx*fx+dz*fz)/dist<Math.cos(Math.PI/6))continue;
      const from={x:p.x,y:p.y+1.15,z:p.z},dir={x:dx/dist,y:0,z:dz/dist};
      if(roomBoxes(room).some(b=>rayBox(from,dir,b)<dist))continue;
      z.knockX+=(dx/dist)*7;z.knockZ+=(dz/dist)*7;z.hp-=10;hits++;
      if(z.hp<=0)rewardKill(room,p,z,false);
    }
    room.zombies=room.zombies.filter(z=>z.hp>0);
    announce(room,{type:'shove',by:p.id,hits});return;
  }
  if(msg.type==='buy'||msg.type==='equip'){
    const result=msg.type==='buy'?buy(room,p,msg.sku,msg.txn):equip(p,msg.weaponId);
    send(peer,{type:'shopResult',action:msg.type,sku:msg.type==='buy'?msg.sku:msg.weaponId,...result});
    if(result.ok && room.phase==='lobby')syncLobby(room);
    return;
  }
  if(msg.type==='revive'&&msg.holding===true&&!p.downed&&room.phase==='playing'){
    const target=[...room.players.values()].find(t=>t!==p&&t.downed&&distance2(t,p)<2.6&&Math.abs(t.y-p.y)<1.65);
    if(!target){room.revive.delete(p.id);return;}
    const prev=room.revive.get(p.id);
    const progress=prev&&prev.target===target.id&&now-prev.lastBeat<350?
      {...prev,lastBeat:now}:{target:target.id,started:now,lastBeat:now};
    room.revive.set(p.id,progress);
    if(now-progress.started>=2000){target.downed=false;target.hp=40;target.reloadUntil=0;
      room.revive.delete(p.id);announce(room,{type:'revived',by:p.id,target:target.id});}
    return;
  }
}
function expireRoom(room){
  if(!rooms.has(room.code))return;
  for(const peer of [...room.players.keys()]){
    send(peer,{type:'error',message:'房間長時間沒有遊戲活動，已自動釋放。請重新建立房間'});
    peer.close();
  }
  if(rooms.get(room.code)===room)rooms.delete(room.code);
}
function onClose(peer){
  peers.delete(peer);const room=peer.room;if(!room)return;
  room.players.delete(peer);room.revive.delete(peer.id);if(V311&&room.survival)delete room.survival.players[peer.id];peer.room=null;
  if(room.players.size===0){rooms.delete(room.code);return;}
  if(room.hostId===peer.id)room.hostId=room.players.values().next().value.id;
  syncLobby(room);
  if(room.phase==='playing'&&[...room.players.values()].every(p=>p.downed)){
    room.phase='ended';room.lastResult='lost';announce(room,{type:'gameOver',result:'lost',levelIndex:room.levelIndex??0,wave:room.wave});syncLobby(room);}
}
function finishCampaign(room,result){
  if(room.phase==='ended')return;
  const won=result==='won';
  room.phase='ended';room.lastResult=won?'won':'lost';
  room.pending=0;room.zombies=[];room.damageTimes=[];room.fields.clear();room.revive.clear();
  announce(room,{type:'missionEnd',success:won,result:room.lastResult,levelIndex:room.levelIndex,
    mapId:room.mapId,
    levelLabel:isFlatMap(room)?mapDataForRoom(room).label??mapDataForRoom(room).title:
      LEVELS[room.levelIndex].label,hasNextLevel:room.levelIndex<LAST_LEVEL,
    routeId:won?room.protocol?.selectedRoute:null,
    message:won&&room.protocol?.selectedRoute
      ?'小隊成功由「'+(isMetro(room)
        ?METRO_EXITS[room.protocol.selectedRoute]?.label
        :ROUTES[room.protocol.selectedRoute]?.label)+'」撤離！'
      :won?'小隊成功撤離！':'撤離任務失敗'});
  syncLobby(room);
}
function tick(){
  const now=Date.now();
  for(const room of rooms.values()){
    if(room.phase==='intermission'){
      if(now>=room.nextWaveAt)startWave(room);
      else{if(now-room.lastSnapshot>=100)snapshot(room,now);continue;}
    }
    if(room.phase!=='playing')continue;
    if(V311&&room.survival){
      const environmentChange=isFlatMap(room)?null:advanceBlackoutProtocol(room.protocol,now);
      if(environmentChange){
        const label=environmentChange==='blackout'?'全城突然停電！前往備用發電機修復':'城市備用電源自動恢復';
        announce(room,{type:'environmentState',environment:publicEnvironment(room.protocol,now),
          action:environmentChange,message:label});
      }
      for(const p of room.players.values())
        setPlayerState(room.survival,p.id,{
          alive:!p.downed&&p.hp>0,inZone:isFacilityRoom(room)?
            facilityExtractionZone(room.protocol,p):
            isMetro(room)?metroExtractionZone(room.protocol,p,now):
            inSelectedExtractionZone(room.protocol,p)
        });
      const result=stepRound(room.survival,now);
      if(result==='won'||result==='lost'){
        finishCampaign(room,result);continue;
      }
    }
    const players=[...room.players.values()],living=players.filter(p=>!p.downed);
    for(const p of players){
      applyReload(p,now);
      if(!p.downed){
        const result=verticalRoomPlayer(room,p.y,p.vy,p.grounded,p.x,p.z,TICK_MS/1000);
        p.y=result.y;p.vy=result.vy;p.grounded=result.grounded;
      }
    }
    if(room.pending>0 && now>=room.nextSpawnAt&&room.zombies.length<MAX_ZOMBIES&&(!V311||computeThreat({activeEnemies:room.zombies.length,cap:Math.min(MAX_ZOMBIES,24),progress:Math.min(1,(room.missionKills||0)/12)}).spawnBudget>0)&&room.directorPhase!=='relax'){
      spawnZombie(room);room.pending--;room.nextSpawnAt=now+Math.max(95,200-room.wave*8);
    }
    if(V311&&room.survival){
      if(!room.bossSpawned&&room.missionKills>=stageAt(room.levelIndex).bossAt&&room.zombies.length<Math.min(MAX_ZOMBIES,24)){
        const source=mapDataForRoom(room).spawns.find(point=>
          canOccupy(point.x,point.z,.65,room)&&[...room.players.values()].every(p=>distance2(point,p)>16));
        if(source){
          const z={id:nextZombieId++,x:source.x,y:0,vy:0,grounded:true,z:source.z,kind:'boss',hp:stageAt(room.levelIndex).bossHp,maxHp:stageAt(room.levelIndex).bossHp,
            speed:SPECIALS.boss.speed,attackAt:0,abilityAt:0,step:0,facing:0,knockX:0,knockZ:0,vx:0,vz:0,stuckFor:0,nextStumble:0,stumbleUntil:0,rewarded:false,bossPhase:1};
          room.zombies.push(z);room.bossSpawned=true;announce(room,{type:'bossAppeared',levelIndex:room.levelIndex,message:LEVELS[room.levelIndex].label+'：變異巨獸出現！'});
        }
      }
      for(const d of room.defenses){
        if(d.kind!=='turret')continue;
        const z=room.zombies.find(z=>canTurretShoot(d,z,now)&&clearZombieSight({x:d.x,y:d.y,z:d.z},z,room));
        if(!z)continue;
        d.nextShotAt=now+DEFENSES.turret.intervalMs;
        z.hp-=DEFENSES.turret.damage;
        announce(room,{type:'turretShot',defenseId:d.id,enemyId:z.id,
          from:{x:d.x,y:d.y+.72,z:d.z},
          to:{x:z.x,y:z.y+(z.kind==='boss'?2.1:1.25),z:z.z}});
        if(z.hp<=0){z.hp=0;const owner=[...room.players.values()][0];if(owner)rewardKill(room,owner,z,false);}
      }
      room.zombies=room.zombies.filter(z=>z.hp>0);
      if(now>=room.nextExtraEventAt){
        room.nextExtraEventAt=now+45000;
        const event=nextEvent(Math.floor(Math.random()*100),room.pressure/100);
        if(event==='horde'){
          if(isFlatMap(room)){
            const group=queueMapHorde(room.mapDirector,{count:12,now,cause:'random',pressure:room.pressure});
            if(group)announce(room,{type:'hordeWarning',gate:group.gate,label:group.label,count:group.total});
          }else room.pending=Math.min(135,room.pending+12);
        }
        if(event==='blackout'&&!isFlatMap(room)&&triggerBlackout(room.protocol,now)){
          announce(room,{type:'environmentState',environment:publicEnvironment(room.protocol,now),
            action:'blackout',message:'隨機停電！城市照明中斷，使用 F 啟動備用發電機'});
        }
        if(event==='supply_drop'){
          const p=living[0];if(p&&room.loot.length<10){
            const item={id:room.nextItemId++,x:p.x+3,y:p.y,z:p.z,rarity:lootRarity(Math.random()),claimed:false};
            room.loot.push(item);
          }
        }
        announce(room,{type:'randomEvent',event,message:{horde:'新一波屍潮逼近',blackout:'全城停電！',supply_drop:'空投補給已抵達',fog:'濃霧來襲',radio_signal:'收到神秘求救信號'}[event]});
      }
    }
    if(isFlatMap(room)&&now-(room.lastMetroFlowAt||0)>1400){
      room.lastMetroFlowAt=now;
      for(const p of living)room.fields.set(p.id,isFacilityRoom(room)?
        facilityFlowField(room.mapId,p):metroFlowField(p));
    }
    if(room.mapDirector){
      const warning=advanceMapDirector(room.mapDirector,{now,pressure:room.pressure,
        activeCount:room.zombies.length,phase:room.phase});
      if(warning)announce(room,{type:'hordeWarning',mapId:room.mapId,
        gate:warning.gate,label:warning.label,count:warning.total,
        message:'偵測到感染者從'+warning.label+'進入，請全隊戒備！'});
      if(room.zombies.length<Math.min(MAX_ZOMBIES,30)&&room.directorPhase!=='relax'){
        const upcoming=nextMapSpawn(room.mapDirector,{now,activeCount:room.zombies.length,
          maxActive:Math.min(MAX_ZOMBIES,30),pressure:room.pressure});
        if(upcoming)spawnZombie(room,upcoming);
      }
    }
    const zombieBuckets=buildZombieBuckets(room.zombies);
    for(const z of room.zombies){
      if(!living.length)break;
      if(V311&&z.kind==='boss'){
        z.bossPhase=bossPhase(z.hp,z.maxHp);
        z.speed=SPECIALS.boss.speed+(z.bossPhase-1)*.45;
      }
      const target=chooseTarget(room,z,living);
      if(!target)continue;
      if(V311&&z.kind!=='boss'){
        const wall=room.defenses.find(d=>d.kind==='barricade'&&Math.abs(d.y-z.y)<1.6&&distance2(d,z)<1.7);
        if(wall){
          if(now>z.attackAt){
            z.attackAt=now+900;
            wall.hp=Math.max(0,wall.hp-(SPECIALS[z.kind]?.damage??12));
            announce(room,{type:'defenseDamaged',id:wall.id,hp:wall.hp});
          }
          continue;
        }
      }
      const xzDist=distance2(z,target),heightDiff=Math.abs(z.y-target.y);
      const canAttack=xzDist<1.35 && heightDiff<1.15 && clearZombieSight(z,target,room);
      if(!canAttack)pursue(room,z,target,TICK_MS/1000,now,zombieBuckets.near(z));
      else if(now>z.attackAt){z.attackAt=now+1100;z.lastAttackAt=now;
        hurt(room,target,SPECIALS[z.kind]?.damage??(z.kind==='brute'?22:z.kind==='runner'?14:10));}
      if(V311&&(z.kind==='spitter'||z.kind==='screamer'||z.kind==='boss')&&now>=z.abilityAt){
        const spec=SPECIALS[z.kind];z.abilityAt=now+spec.intervalMs;
        if(z.kind==='screamer')room.pending=Math.min(135,room.pending+4);
        if(z.kind==='spitter'&&xzDist<14&&heightDiff<3&&clearZombieSight(z,target,room))hurt(room,target,spec.damage);
        if(z.kind==='boss'&&xzDist<8&&heightDiff<2&&clearZombieSight(z,target,room))hurt(room,target,spec.damage);
        announce(room,{type:'specialAttack',kind:z.kind,id:z.id});
      }
      if(V311&&z.kind==='juggernaut'&&xzDist<2.3&&heightDiff<1.4&&now>=z.abilityAt){
        z.abilityAt=now+3500;
        const d=room.defenses.find(d=>distance2(d,z)<3);
        if(d)d.hp=Math.max(0,d.hp-100);
      }
    }
    if(now-room.lastDirectorAt>=2000){
      room.lastDirectorAt=now;
      room.damageTimes=room.damageTimes.filter(t=>now-t<20000);
      const avg=players.reduce((s,p)=>s+p.hp/p.maxHp,0)/Math.max(1,players.length);
      room.pressure=Math.round(70*(1-avg)+30*Math.min(1,room.damageTimes.length/Math.max(1,players.length*3)));
      if(room.pressure>80&&room.directorPhase!=='relax'){
        room.directorPhase='relax';room.relaxUntil=now+12000;
      }else if(room.directorPhase==='relax'&&now>=room.relaxUntil&&room.pressure<55){room.directorPhase='buildup';}
      else if(room.directorPhase!=='relax'&&room.zombies.length>=32){room.directorPhase='peak';}
      announce(room,{type:'director',pressure:room.pressure,directorPhase:room.directorPhase});
    }
    if(players.length && players.every(p=>p.downed)){
      room.phase='ended';room.lastResult='lost';announce(room,{type:'gameOver',result:'lost',levelIndex:room.levelIndex??0,wave:room.wave});syncLobby(room);continue;
    }
    if(V311)room.defenses=room.defenses.filter(d=>d.hp>0);
    if(V311&&room.survival?.phase==='extraction'&&room.pending===0&&room.zombies.length===0){
      if(now-room.lastSnapshot>=100)snapshot(room,now);
      continue;
    }
    if(room.pending===0&&room.zombies.length===0){
      if(V311&&room.survival?.phase==='objectives'){startWave(room);snapshot(room,now);continue;}
      startIntermission(room,now);
      snapshot(room,now);
      continue;
    }
    if(now-room.lastSnapshot>=100)snapshot(room,now);
  }
  scheduleNavigation(now);
}
setInterval(tick,TICK_MS);
// Periodically release disconnected browsers and completely inactive rooms.
const capacitySweep=setInterval(()=>{
  const now=Date.now();
  for(const peer of [...peers])peer.ping();
  pruneRoomRegistry(rooms,now,expireRoom);
},SOCKET_PING_INTERVAL_MS);
capacitySweep.unref();

// WebSocket transport remains compatible with the deployed V1 room protocol.
// Small dependency-free WebSocket RFC 6455 implementation. Browser frames are masked.
class Peer {
  constructor(socket,address){this.socket=socket;this.address=address;this.id=crypto.randomUUID().slice(0,8);this.buffer=Buffer.alloc(0);this.room=null;this.closed=false;
    this.lastPongAt=Date.now();this.lastPingAt=0;
    this.messageTokens=120;this.lastTokenAt=Date.now();
    this.byteTokens=MAX_INBOUND_BURST;this.lastByteAt=Date.now();
    socket.on('data', chunk=>this.receive(chunk));socket.on('error',()=>this.close());socket.on('close',()=>this.close());
  }
  send(obj){if(this.closed || this.socket.destroyed || this.socket.writableLength>256_000)return;
    this.frame(1,Buffer.from(JSON.stringify(obj)));
  }
  frame(op,payload){if(this.closed||this.socket.destroyed)return;let head;
    if(payload.length<126){head=Buffer.from([0x80|op,payload.length]);}
    else if(payload.length<65536){head=Buffer.alloc(4);head[0]=0x80|op;head[1]=126;head.writeUInt16BE(payload.length,2);}
    else{head=Buffer.alloc(10);head[0]=0x80|op;head[1]=127;head.writeBigUInt64BE(BigInt(payload.length),2);}
    this.socket.write(Buffer.concat([head,payload]));
  }
  receive(chunk){
    if(this.closed)return;
    const nowBytes=Date.now();
    this.byteTokens=Math.min(MAX_INBOUND_BURST,this.byteTokens+
      Math.max(0,nowBytes-this.lastByteAt)*MAX_INBOUND_BYTES_PER_SECOND/1000);
    this.lastByteAt=nowBytes;
    if(chunk.length>this.byteTokens){this.close();return;}
    this.byteTokens-=chunk.length;
    this.buffer=Buffer.concat([this.buffer,chunk]);
    if(this.buffer.length>131072){this.close();return;}
    while(this.buffer.length>=2){
      const b0=this.buffer[0],b1=this.buffer[1],opcode=b0&15,masked=!!(b1&0x80);
      if(!(b0&0x80)||!masked){this.close();return;}
      let len=b1&127,off=2;
      if(len===126){if(this.buffer.length<4)return;len=this.buffer.readUInt16BE(2);off=4;}
      else if(len===127){if(this.buffer.length<10)return;const n=this.buffer.readBigUInt64BE(2);if(n>65536n){this.close();return;}len=Number(n);off=10;}
      if((opcode===1 && len>MAX_JSON_BYTES) || (opcode===9 && len>125) || len>65536){this.close();return;}
      if(this.buffer.length<off+4+len)return;
      const mask=this.buffer.subarray(off,off+4);off+=4;
      const payload=Buffer.from(this.buffer.subarray(off,off+len));this.buffer=this.buffer.subarray(off+len);
      for(let i=0;i<payload.length;i++)payload[i]^=mask[i%4];
      if(opcode===8){this.close();return;}
      if(opcode===9){this.frame(10,payload);continue;}
      if(opcode===10){this.lastPongAt=Date.now();continue;}
      if(opcode!==1){this.close();return;}
      const now=Date.now();
      this.messageTokens=Math.min(120,this.messageTokens+Math.max(0,now-this.lastTokenAt)*MAX_MESSAGES_PER_SECOND/1000);
      this.lastTokenAt=now;
      if(this.messageTokens<1){this.close();return;}
      this.messageTokens-=1;
      try{onMessage(this,JSON.parse(payload.toString('utf8')));}catch{}
    }
  }
  ping(){
    if(this.closed)return;
    const now=Date.now();
    if(now-this.lastPongAt>SOCKET_PONG_TIMEOUT_MS){this.close();return;}
    if(now-this.lastPingAt>=SOCKET_PING_INTERVAL_MS){
      this.lastPingAt=now;
      this.frame(9,Buffer.from('df-alive'));
    }
  }
  close(){if(this.closed)return;this.closed=true;onClose(this);
    const count=connectionCounts.get(this.address)||0;
    if(count<=1)connectionCounts.delete(this.address);else connectionCounts.set(this.address,count-1);
    this.socket.destroy();}
}
const DIST=path.join(ROOT,'apps/client/dist');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json',
  '.glb':'model/gltf-binary','.wasm':'application/wasm','.png':'image/png',
  '.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp',
  '.wav':'audio/wav','.ktx2':'image/ktx2','.hdr':'image/vnd.radiance','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  let url;
  try {url=new URL(req.url||'/','http://localhost');}
  catch{res.writeHead(400);res.end();return;}
  if(url.pathname==='/health'){
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify({ok:true,app:'deadline-four-v3-9-2-physics-ws-navigation',version:V311?'3.11':'3.9.2',contentVersion:V311?'3.14':'3.9.2',mapSize:180,weaponCount:Object.keys(WEAPONS).length,
      rooms:rooms.size,connections:peers.size,activePlayers:[...rooms.values()].reduce((n,room)=>n+room.players.size,0),
      maxRooms:MAX_ROOMS,maxZombies:MAX_ZOMBIES,maxConnections:MAX_TOTAL_CONNECTIONS,
      websocketHeartbeatMs:SOCKET_PING_INTERVAL_MS,roomIdleLobbyMs:ROOM_IDLE_MS.lobby}));return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){
    res.writeHead(405);res.end();return;
  }
  let pathname;
  try{pathname=decodeURIComponent(url.pathname);}catch{res.writeHead(400);res.end();return;}
  let full=path.resolve(DIST,`.${pathname}`);
  if(!full.startsWith(DIST+path.sep) && full!==DIST){res.writeHead(403);res.end();return;}
  if(pathname==='/' || !path.extname(pathname))full=path.join(DIST,'index.html');
  fs.readFile(full,(err,data)=>{
    if(err){res.writeHead(404);res.end('File not found');return;}
    res.writeHead(200,{'content-type':MIME[path.extname(full)]||'application/octet-stream',
      'cache-control':full.includes('/assets/')?'public, max-age=31536000, immutable':'no-cache',
      'x-content-type-options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:data);
  });
});
server.on('upgrade',(req,socket)=>{
  const key=req.headers['sec-websocket-key'];
  const address=connectionAddress(req);
  const capacity=handshakeCapacity(peers.size,connectionCounts.get(address)||0,
    address,MAX_TOTAL_CONNECTIONS,MAX_IP_CONNECTIONS);
  if(capacity){
    console.warn('[Capacity] WebSocket capacity reached:',capacity,'active=',peers.size);
    socket.end('HTTP/1.1 503 Service Unavailable\r\nRetry-After: 5\r\nConnection: close\r\n\r\n');
    return;
  }
  if(!acceptOrigin(req)||!allowHandshake(address,Date.now())){
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;
  }
  if(req.url!=='/ws' || req.headers.upgrade?.toLowerCase()!=='websocket' || typeof key!=='string' || !/^[A-Za-z0-9+/]{22}==$/.test(key)){
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');socket.destroy();return;
  }
  const accept=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
  const peer=new Peer(socket,address);peers.add(peer);
  connectionCounts.set(address,(connectionCounts.get(address)||0)+1);
  send(peer,{type:'hello',id:peer.id,version:V311?'3.11-survival':'3.9.2-physics-ws-worker'});
});
// Do not mark a Render deployment healthy when the Vite distribution is absent.
if (process.env.NODE_ENV === 'production' && !fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('[Startup] Vite distribution is missing: run the Render build command before starting.');
  process.exit(1);
}
server.listen(PORT,HOST,()=>console.log(`DEADLINE FOUR running at http://localhost:${PORT}`));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
