import * as THREE from 'three';
import {AimController,AIM_WEAPONS} from '../../../v311/aim-controller';
import {BattleExtras} from './game/BattleExtras';
import {BulletTracers} from './effects/BulletTracers';
import { createPostProcessing } from './core/PostProcessing';
import { AssetManager } from './assets/AssetManager';
import { configurePhotorealRenderer } from './core/RendererSetup';
import { AdaptiveRenderer } from './core/AdaptiveRenderer';
import type { QualityMode } from './core/FrameBudget';
import { ImpactSystem } from './effects/ImpactSystem';
import { ShotImpactBridge } from './effects/ShotImpactBridge';
import { SoundManager } from './audio/SoundManager';
import { CombatFeedbackUI } from './ui/CombatFeedbackUI';
import { WeaponViewmodel } from './game/WeaponViewmodel';
import {WEAPONS,isWeaponId,toTuning,type WeaponId} from './game/WeaponCatalog';
import { FirstPersonController } from './player/FirstPersonController';
import { World } from './world/World';
import {BlackoutWorldVisuals} from './world/BlackoutWorldVisuals';
import { configureSurfaceMaterialQuality, surfaceMaterialsReady } from './world/SurfaceMaterials';
import { ZombieCrowd } from './world/ZombieCrowd';
import { Teammates } from './world/Teammates';
import { MapMini } from './world/MapMini';
import { ShopUI } from './shop/ShopUI';
import { Multiplayer,type ServerEvent,type PlayerRecord,type EnvironmentState } from './network/Multiplayer';
import { FixedPhysicsClock } from '../../../packages/shared/FixedPhysicsClock.mjs';
import { MoveReconciler } from '../../../packages/shared/MoveReconciler.mjs';
import './style.css';

const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`
<div id="overlay"><div class="panel">
  <div class="eyebrow">DEADLINE FOUR · V3.11 · SURVIVAL</div>
  <h1>末日防線 <span>V3.11</span></h1>
  <p class="desc">FOUR SURVIVORS · ONE LAST NIGHT</p>
  <div class="loading-track"><div id="loading-bar"></div></div>
  <div id="loading-text">初始化夜間城市…</div><p id="connection" class="status">伺服器連線中</p>
  <section id="main-menu"><input id="nickname" maxlength="16" placeholder="倖存者名稱" value="倖存者" />
    <div class="menu-buttons"><button id="create">建立四人合作房間</button></div>
    <div class="join-row"><input id="room-code" maxlength="5" placeholder="輸入五碼房號"/><button id="join">加入小隊</button></div></section>
  <section id="lobby" class="hidden"><div class="eyebrow">SQUAD ASSEMBLY</div>
    <h2 id="code">-----</h2><div id="roster"></div>
    <button id="start-wave">隊長開始戰鬥</button><p class="hint">四位隊友使用同一網址，輸入房號即可合作。</p></section>
  <section id="battle-entry" class="hidden"><h2>城市已遭感染</h2>
    <button id="enter">進入末日城市 · 鎖定滑鼠</button><p class="hint">每波結束有 30 秒的全隊安全採購期。</p></section>
  <section id="game-over" class="hidden" aria-label="關卡結算">
    <h2 id="result-title">任務結算</h2>
    <p id="last-wave"></p>
    <p id="campaign-progress"></p>
    <div class="campaign-actions">
      <button id="retry" type="button" class="hidden">重新挑戰本關</button>
      <button id="next-level" type="button" class="hidden">進入下一關</button>
      <button id="restart-campaign" type="button" class="hidden">重新開始戰役</button>
    </div>
    <p id="campaign-waiting" class="hidden">等待隊長選擇下一步…</p>
  </section>
  <button id="settings-toggle" type="button" aria-expanded="false" aria-controls="settings-panel">設定與遊戲說明</button>
  <section id="settings-panel" class="hidden" aria-label="遊戲設定">
    <h2>遊戲設定</h2>
    <label class="mouse-sensitivity" for="mouse-sensitivity">滑鼠視角靈敏度 <output id="mouse-sensitivity-value">45%</output>
    <input id="mouse-sensitivity" type="range" min="15" max="100" step="5" value="45" aria-label="調整滑鼠靈敏度" />
  </label>
    <details class="game-guide"><summary>遊戲說明 / 操作方式</summary>
      <dl>
        <dt>移動及視角</dt><dd>W A S D 移動、滑鼠轉向、Space 跳躍、Shift 衝刺</dd>
        <dt>戰鬥及裝備</dt><dd>左鍵開火、右鍵瞄準、狙擊槍開鏡時滾輪切換 4×／8×、R 換彈、1／2 換武器、V 推擊</dd>
        <dt>合作與職業</dt><dd>Q 職業技能、E 救援隊友、Tab 查看小隊完整戰績</dd>
        <dt>防禦與搜刮</dt><dd>G 部署機槍塔、H 部署路障、T 修理設施、F 搜刮物資、B 開啟商店</dd>
        <dt>畫質及暫停</dt><dd>F8 畫質模式、Esc 解除滑鼠鎖定並顯示選單</dd>
      </dl>
    </details>
  </section>
  <p id="notice" class="status"></p>
  <div id="asset-label" class="status"></div>
</div></div>
<div id="hud" class="hidden"><div class="hud-title">DEADLINE FOUR <small>V3.11 · SURVIVAL / COOP</small></div>
  <div id="mission">WAVE 01</div><div id="squad"></div><div id="feedback">小隊整備中</div><div id="performance"></div></div>
<div id="player-hud" class="hidden"><div class="currency"><span id="money">$600</span><span id="level">LV 1</span></div>
  <div class="stat-label">護甲 <span id="armor-value">0 / 100</span></div><div class="stat-track armor-track"><div id="armor-fill"></div></div>
  <div class="stat-label">生命 <span id="hp-value">100 / 100</span></div><div class="stat-track hp-track"><div id="hp-fill"></div></div>
  <div class="stat-label">經驗值 <span id="xp-value">0 / 150 XP</span></div><div class="stat-track xp-track"><div id="xp-fill"></div></div>
  <div id="stats-tip">擊殺殭屍取得金錢 · 每波結束享有 30 秒安全補給</div></div>
<div id="intermission-banner" class="hidden"><span>屍潮已清除 · 下一波倒數</span><strong id="intermission-countdown">00:30</strong><button id="shop-reopen" type="button">開啟商店</button></div>
<div id="crosshair" aria-hidden="true"><span class="arm top"></span><span class="arm right"></span><span class="arm bottom"></span><span class="arm left"></span><span class="reticle-dot"></span><span id="hitmarker">×</span></div>
<div id="sniper-scope" class="sniper-scope" aria-hidden="true">
  <div class="scope-lens">
    <div class="scope-reticle">
      <div class="scope-cross-v"></div><div class="scope-cross-h"></div>
      <div class="scope-center-dot"></div>
      <div class="scope-range range-left"></div><div class="scope-range range-right"></div>
      <div class="scope-range range-lower"></div>
    </div>
    <div class="scope-magnification"><span id="scope-zoom">4×</span></div>
  </div>
</div>
<div id="critical-vignette" aria-hidden="true"></div>
<section id="scoreboard" class="hidden" aria-label="小隊戰績"><h2>小隊戰績 · SQUAD STATUS</h2><table><thead><tr><th>玩家</th><th>LV</th><th>武器</th><th>HP / 護甲</th><th>金錢</th><th>擊殺</th></tr></thead><tbody id="scoreboard-rows"></tbody></table><p>放開 TAB 關閉</p></section>
<div id="weapon-hud" class="hidden"><div id="weapon-name" class="weapon-name">P9 戰術手槍</div>
  <div id="ammo">15 <span>/ ∞</span></div><div id="mode">IDLE</div></div>
<div id="minimap-wrap" class="hidden"><canvas id="minimap"></canvas><div>城市 180 × 180m · 31 棟開放建築 · 室內樓層與屋頂斜坡</div></div>
<div id="rescue" class="hidden">附近有倒地隊友需要救援</div><div id="downed" class="hidden">你已倒地 · 等待隊友救援</div>
<div id="footer" class="hidden"></div>`;

const get=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const overlay=get<HTMLDivElement>('overlay'),hud=get<HTMLDivElement>('hud'),weaponHud=get<HTMLDivElement>('weapon-hud');
const playerHud=get<HTMLDivElement>('player-hud'),mapWrap=get<HTMLDivElement>('minimap-wrap');
const menu=get<HTMLElement>('main-menu'),lobby=get<HTMLElement>('lobby');
const settingsPanel=get<HTMLElement>('settings-panel'),settingsToggle=get<HTMLButtonElement>('settings-toggle');
const sniperScope=get<HTMLElement>('sniper-scope');
settingsToggle.onclick=()=>{
  const open=settingsPanel.classList.contains('hidden');
  visible(settingsPanel,open);
  settingsToggle.setAttribute('aria-expanded',String(open));
};
const battleEntry=get<HTMLElement>('battle-entry'),gameOver=get<HTMLElement>('game-over');
const visible=(e:HTMLElement,show:boolean)=>e.classList.toggle('hidden',!show);
let feedbackDeadline=0;
function alertMessage(msg:string){get<HTMLElement>('feedback').textContent=msg;get<HTMLElement>('notice').textContent=msg;feedbackDeadline=performance.now()+2700;}
function menuMode(mode:'menu'|'lobby'|'battle'|'over'){
  visible(overlay,true);visible(menu,mode==='menu');visible(lobby,mode==='lobby');
  visible(battleEntry,mode==='battle');visible(gameOver,mode==='over');
  const fighting=mode==='battle'||mode==='over';
  for(const el of [hud,weaponHud,playerHud,mapWrap])visible(el,fighting);
  if(mode!=='battle'){combatUI.setActive(false);sound.setCriticalHeartbeat(false);visible(scoreboard,false);}
}

const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.08,220);scene.add(camera);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setSize(innerWidth,innerHeight);
app.prepend(renderer.domElement);
renderer.domElement.classList.add('game-canvas');
configureSurfaceMaterialQuality(renderer);
const world=new World(scene),controller=new FirstPersonController(camera,renderer.domElement,world);
const blackoutWorld=new BlackoutWorldVisuals(scene);
let currentEnvironment:EnvironmentState|null=null;
let objectivePhase:'objectives'|'extraction'='objectives';
const environmentStatus=document.createElement('div');
environmentStatus.id='blackout-status';
environmentStatus.style.cssText='position:fixed;top:145px;right:24px;z-index:5;max-width:300px;color:#e4f5fa;background:#07151acb;border:1px solid #56868d;padding:10px 12px;font:600 12px/1.6 sans-serif;pointer-events:none;display:none;white-space:pre-line';
document.body.append(environmentStatus);
const environmentPrompt=document.createElement('div');
environmentPrompt.id='environment-prompt';
environmentPrompt.style.cssText='position:fixed;bottom:165px;left:50%;transform:translateX(-50%);z-index:6;background:#0b2026de;color:#e8ffef;border:1px solid #76cab5;border-radius:5px;padding:8px 16px;font:700 13px sans-serif;pointer-events:none;display:none';
document.body.append(environmentPrompt);
function updateEnvironment(environment:EnvironmentState|null):void{
  currentEnvironment=environment;
  blackoutWorld.setState(environment);
  if(!environment){environmentStatus.style.display='none';environmentPrompt.style.display='none';return;}
  environmentStatus.style.display='block';
  const selected=environment.routes.find(x=>x.id===environment.selectedRoute);
  const routes=environment.routes.map(r=>
    (r.id===selected?.id?'◆ ':'◇ ')+r.label+(r.ready?' ✓':' [待解鎖]')).join(' / ');
  environmentStatus.textContent=(environment.powerOnline?'● 城市電力：正常':'● 全城停電：啟動發電機')+
    '\n撤離路線：'+routes+
    '\n'+(selected?'已選路線：'+selected.label:'完成任務後選擇撤離點，靠近按 F');
}
const aim=new AimController(AIM_WEAPONS.assault_rifle);
let aimHeld=false;
const missionOverlay=document.createElement('aside');
missionOverlay.style.cssText='position:fixed;top:265px;right:26px;z-index:20;background:#07141bd9;border:1px solid #63a6ad;padding:13px 18px;color:#eaf9ff;font:600 15px sans-serif;max-width:320px;pointer-events:none;display:none';
document.body.append(missionOverlay);
const classPicker=document.createElement('div');
classPicker.style.cssText='margin:12px 0;color:#e5faff';
classPicker.innerHTML='<label for="v311-class">職業：</label><select id="v311-class"><option value="assault">突擊兵｜火力壓制</option><option value="medic">醫療兵｜戰地急救</option><option value="engineer">工程兵｜防禦補強</option><option value="recon">偵察兵｜弱點標記</option></select>';
get<HTMLElement>('lobby').append(classPicker);
get<HTMLSelectElement>('v311-class').onchange=event=>network.send({type:'selectClass',classId:(event.target as HTMLSelectElement).value});
const sensitivitySlider=get<HTMLInputElement>('mouse-sensitivity');
const sensitivityOutput=get<HTMLOutputElement>('mouse-sensitivity-value');
let savedSensitivity=45;
try { savedSensitivity=Number(localStorage.getItem('df-mouse-sensitivity')||45); } catch {}
sensitivitySlider.value=String(Math.max(15,Math.min(100,Number.isFinite(savedSensitivity)?savedSensitivity:45)));
const updateSensitivity=()=>{
  const pct=Number(sensitivitySlider.value);
  controller.setLookSensitivity(pct/100*(aimHeld?.5:1));
  sensitivityOutput.textContent=`${pct}%`;
  try { localStorage.setItem('df-mouse-sensitivity',String(pct)); } catch {}
};
sensitivitySlider.addEventListener('input',updateSensitivity);
updateSensitivity();
void surfaceMaterialsReady().then(missing=>{
  if(missing.length) console.warn('[Visuals] Degraded PBR assets:',missing);
  else console.info('[Visuals] All requested PBR maps ready');
});
const sound=new SoundManager(camera,scene);
void sound.preload();
const combatUI=new CombatFeedbackUI(renderer.domElement);
const scoreboard=get<HTMLElement>('scoreboard');
const indoorRay=new THREE.Raycaster();
indoorRay.far=9;
function isIndoors(){
  indoorRay.set(camera.position,new THREE.Vector3(0,1,0));
  return indoorRay.intersectObjects(world.blockers,false).some(hit=>hit.distance>.15);
}
const visuals=configurePhotorealRenderer(renderer,scene);
void visuals.ready.then(ok=>{ if(ok)console.info("[Visuals] Night HDR environment ready"); });
const impacts=new ImpactSystem(scene,{maxDecals:48,decalLifetime:28,maxBloodParticles:180,maxDustParticles:100});
const shotFx=new ShotImpactBridge(world,impacts,camera);
const tracers=new BulletTracers(scene);
const crowd=new ZombieCrowd(scene),teammates=new Teammates(scene);
const battleExtras=new BattleExtras(scene);
const interactionHUD=document.createElement('div');
interactionHUD.style.cssText='position:fixed;bottom:100px;right:20px;color:#eafff8;background:#051d25b8;padding:10px 14px;border:1px solid #407e83;z-index:20;font:600 13px sans-serif;pointer-events:none';
interactionHUD.textContent='';interactionHUD.style.display='none';
document.body.append(interactionHUD);
const flashlight=new THREE.SpotLight(0xd8eaff,22,43,Math.PI/7,.48,1.8);
flashlight.position.set(.15,-.18,-.12);flashlight.castShadow=true;
flashlight.shadow.mapSize.set(512,512);flashlight.shadow.bias=-.001;
flashlight.target.position.set(0,-.5,-12);camera.add(flashlight,flashlight.target);
const post=createPostProcessing(renderer,scene,camera);
const composer=post.composer;
const adaptive=new AdaptiveRenderer(renderer,composer,post.bloom,world.moonLight,flashlight,post.fxaa,post.grain);
renderer.info.autoReset=false; // record draw calls from all EffectComposer passes
const minimap=new MapMini(get<HTMLCanvasElement>('minimap'));
const assets=new AssetManager((value,label)=>{
  get<HTMLElement>('loading-bar').style.width=`${value}%`;
  get<HTMLElement>('loading-text').textContent=`${value}% · ${label}`;
});
assets.enableCompressedTextures(renderer);
let selectedId:WeaponId='p9',modelLevel=1;
const weaponAsset=await assets.loadWeapon(toTuning(selectedId).modelPath);
let weapon:WeaponViewmodel;
weapon=new WeaponViewmodel(camera,weaponAsset,()=>updateAmmo(),{tuning:toTuning(selectedId),serverAuthoritative:true});
get<HTMLElement>('asset-label').textContent=weaponAsset.isPlaceholder?
  '目前使用幾何備用武器；稍後可換成 GLB':'已載入精細 GLB 武器 · 動畫由 Viewmodel 狀態機驅動';
let desiredSwitch:WeaponId|null=null,requestToken=0;
let shotCounter=0;
const pendingMuzzles=new Map<number,{point:{x:number;y:number;z:number};at:number}>();
const shotRaycaster=new THREE.Raycaster();
const shotVecFrom=new THREE.Vector3(),shotVecTo=new THREE.Vector3(),shotVector=new THREE.Vector3();
function fireVisualTracer(event:ServerEvent):void{
  if(!event.to||!event.from)return;
  const own=event.by===network.session.selfId;
  let from=event.visualFrom??event.from;
  if(own&&typeof event.shotId==='number'){
    const pending=pendingMuzzles.get(event.shotId);
    if(pending){from=pending.point;pendingMuzzles.delete(event.shotId);}
  }
  // Keep the authoritative server-corrected impact point and optionally
  // clip the true local muzzle-to-target segment at nearer static geometry.
  let to=event.visualTo??event.to;
  if(own){
    shotVecFrom.set(from.x,from.y,from.z);
    shotVecTo.set(event.to.x,event.to.y,event.to.z);
    shotVector.subVectors(shotVecTo,shotVecFrom);
    const total=shotVector.length();
    if(total>.04&&total<125){
      shotRaycaster.set(shotVecFrom,shotVector.divideScalar(total));
      shotRaycaster.near=0.035;
      shotRaycaster.far=total;
      const wall=shotRaycaster.intersectObjects(world.blockers,false)[0];
      if(wall&&wall.distance<total-.06){
        const cutoff=Math.max(.02,wall.distance-.03);
        to={x:from.x+shotVector.x*cutoff,
            y:from.y+shotVector.y*cutoff,z:from.z+shotVector.z*cutoff};
      }else to=event.to;
    }
  }
  tracers.spawn(from,to,'gun');
}
async function swapWeapon(id:WeaponId,level:number,ammo:number,reserve:number):Promise<void>{
  if(desiredSwitch===id)return;
  desiredSwitch=id;
  aim.equip(id==='sniper_rifle'?AIM_WEAPONS.sniper_rifle:AIM_WEAPONS.assault_rifle);
  const token=++requestToken;
  const asset=await assets.loadWeapon(toTuning(id,level).modelPath);
  if(token!==requestToken)return;
  const next=new WeaponViewmodel(camera,asset,()=>updateAmmo(),{tuning:toTuning(id,level),serverAuthoritative:true});
  next.resetFromServer(ammo,reserve);
  weapon.dispose();weapon=next;selectedId=id;modelLevel=level;desiredSwitch=null;pendingMuzzles.clear();
  updateAmmo();
}
function updateAmmo(){
  if(!weapon)return;
  const spec=WEAPONS[selectedId];
  get<HTMLElement>('weapon-name').textContent=spec.name;
  get<HTMLElement>('ammo').innerHTML=`${weapon.state.ammo} <span>/ ${spec.category==='pistol'?'∞':weapon.state.reserve}</span>`;
  get<HTMLElement>('mode').textContent=weapon.state.mode.toUpperCase();
}
let localKills=0,downed=false,lastHudSnapshot=0;
let shopRemainingUntil=0,lastShopDisplay=-1;
const network=new Multiplayer();
const physicsClock = new FixedPhysicsClock();
const moveReconciler = new MoveReconciler();
window.addEventListener('blur',()=>physicsClock.reset());
document.addEventListener('visibilitychange',()=>{if(document.hidden)physicsClock.reset();});
network.onStatus=text=>get<HTMLElement>('connection').textContent=text;
function self():PlayerRecord|null{return network.session.players.find(p=>p.id===network.session.selfId)??null;}
const shop=new ShopUI(sku=>network.send({type:'buy',sku,txn:crypto.randomUUID()}),
  weaponId=>network.send({type:'equip',weaponId}),()=>{
    if(network.session.phase==='lobby'){menuMode('lobby');return;}
    if(network.session.phase==='intermission'){visible(overlay,false);return;}
    if(network.session.phase==='playing'){
      // Closing is a user gesture, so browsers may grant pointer-lock immediately.
      controller.controls.lock();
      if(!controller.controls.isLocked)menuMode('battle');
    }
  });
function drawLobby(){
  get<HTMLElement>('code').textContent=network.session.code;
  const p=network.session.players;
  const labels:Record<PlayerRecord['classId'],string>={assault:'突擊兵',medic:'醫療兵',engineer:'工程兵',recon:'偵察兵'};
  get<HTMLElement>('roster').textContent=p.map((s,i)=>`${i+1}. ${s.name} [${labels[s.classId]||'突擊兵'}]${s.id===network.session.hostId?' ★ 隊長':''}`).join('　｜　');
  const own=p.find(entry=>entry.id===network.session.selfId);
  if(own)get<HTMLSelectElement>('v311-class').value=own.classId;
  const isHost=network.session.hostId===network.session.selfId;
  visible(get<HTMLElement>('start-wave'),isHost);
  if(network.session.phase==='ended')renderCampaignResult();
}
function renderCampaignResult():void{
  const session=network.session;
  const isHost=session.hostId===session.selfId;
  const won=session.result==='won';
  const completed=won&&session.levelIndex>=3;
  const retry=get<HTMLButtonElement>('retry');
  const next=get<HTMLButtonElement>('next-level');
  const restart=get<HTMLButtonElement>('restart-campaign');
  visible(retry,isHost&&!won);
  visible(next,isHost&&won&&!completed);
  visible(restart,isHost&&completed);
  visible(get<HTMLElement>('campaign-waiting'),!isHost);
  get<HTMLElement>('result-title').textContent=won?'關卡通關成功！':'任務失敗';
  get<HTMLElement>('campaign-progress').textContent=won&&!completed
    ?'下一關：'+(['失聯街區','廢棄醫院','工業封鎖區','最後防線'][session.levelIndex+1]||'下一階段')
    :completed?'四個關卡已完成！':session.levelLabel+' · 可重新挑戰';
}
function enterBattle(){
  if(network.session.phase!=='playing')return;
  menuMode('battle');
  const p=self();
  if(p){physicsClock.reset();moveReconciler.reset();controller.teleport(p.x,p.z,p.y??0);
    if(isWeaponId(p.weaponId)&&p.weaponId!==selectedId)void swapWeapon(p.weaponId,p.level,p.ammo,p.reserve);
    else weapon.resetFromServer(p.ammo,p.reserve);
  }
}
function updateScoreboard(){
  const rows=get<HTMLTableSectionElement>('scoreboard-rows');
  rows.replaceChildren();
  for(const player of network.session.players){
    const tr=document.createElement('tr');
    const weaponName=isWeaponId(player.weaponId)?WEAPONS[player.weaponId].name:player.weaponId;
    for(const field of [player.name,`LV ${player.level}`,weaponName,`${Math.round(player.hp)} / ${Math.round(player.armor)}`,`$${player.money.toLocaleString()}`,String(player.kills)]){
      const td=document.createElement('td');td.textContent=field;tr.append(td);
    }
    if(player.id===network.session.selfId)tr.classList.add('self');
    if(player.downed)tr.classList.add('incapacitated');
    rows.append(tr);
  }
}
function renderSquad(players:PlayerRecord[],selfId:string):void{
  const fragment=document.createDocumentFragment();
  for(let i=0;i<4;i++){
    const p=players[i],card=document.createElement('div');
    card.className='squad-member'+(p?.downed?' incapacitated':'')+(p?.id===selfId?' self':'');
    const header=document.createElement('div');header.className='squad-line';
    const name=document.createElement('strong');name.textContent=p?(p.id===selfId?'● ':'')+p.name:'等待隊友 '+(i+1);
    const kills=document.createElement('span');kills.className='squad-kills';kills.textContent=p?'擊殺 '+p.kills:'—';
    header.append(name,kills);
    const health=document.createElement('div');health.className='squad-hp';
    const fill=document.createElement('div');fill.className='squad-hp-fill';
    fill.style.width=p&&!p.downed?Math.max(0,Math.min(100,p.hp/Math.max(1,p.maxHp)*100))+'%':'0%';
    health.append(fill);
    const status=document.createElement('span');status.className='squad-status';
    status.textContent=p?(p.downed?'倒地':Math.ceil(p.hp)+' / '+p.maxHp+' HP'):'尚未加入';
    card.append(header,health,status);fragment.append(card);
  }
  get<HTMLElement>('squad').replaceChildren(fragment);
}
function renderHUD(){
  const s=network.session,p=self();
  get<HTMLElement>('mission').textContent=s.phase==='intermission'
    ? `WAVE ${String(s.wave).padStart(2,'0')} COMPLETE · 安全採購期`
    : `WAVE ${String(s.wave).padStart(2,'0')} · ${s.remaining} 隻待清除`;
  renderSquad(s.players,s.selfId);
  const close=s.players.some(v=>v.id!==s.selfId&&v.downed&&Math.hypot(v.x-camera.position.x,v.z-camera.position.z)<2.6);
  visible(get<HTMLElement>('rescue'),!downed&&s.phase==='playing'&&close);
  visible(get<HTMLElement>('downed'),downed);
  if(p){
    get<HTMLElement>('money').textContent=`$${p.money.toLocaleString()}`;
    get<HTMLElement>('level').textContent=`LV ${p.level}`;
    get<HTMLElement>('armor-value').textContent=`${Math.round(p.armor)} / 100`;
    get<HTMLElement>('hp-value').textContent=`${Math.round(p.hp)} / ${p.maxHp}`;
    get<HTMLElement>('xp-value').textContent=p.nextXp?`${p.xp} / ${p.nextXp} XP`:'MAX LEVEL';
    get<HTMLElement>('armor-fill').style.width=`${Math.max(0,p.armor)}%`;
    get<HTMLElement>('hp-fill').style.width=`${Math.max(0,100*p.hp/p.maxHp)}%`;
    get<HTMLElement>('xp-fill').style.width=`${p.nextXp?Math.max(0,100*p.xp/p.nextXp):100}%`;
    get<HTMLElement>('stats-tip').textContent=s.phase==='intermission'?'✓ 30 秒安全採購期：任何位置都可以補給':p.inSafehouse?'✓ 位於安全屋，按 B 可購物':'返回中央安全屋才能購買武器與護甲';
    shop.setContext(s.phase,s.shopRemainingMs);
    shop.update(p);
    const critical=combatUI.setHealth(p.hp,p.maxHp,p.armor,network.session.phase==='playing'&&controller.controls.isLocked);
    sound.setCriticalHeartbeat(critical);
  }
  updateScoreboard();
  updateAmmo();
}
network.onEvent=(event:ServerEvent)=>{
  if(event.type==='error'){alertMessage(event.message||'操作失敗');return;}
  if(event.type==='campaignStart'){
    objectivePhase='objectives';
    updateEnvironment(event.environment??null);
    missionOverlay.style.display='none';
    battleExtras.update([],[]);
    get<HTMLElement>('feedback').textContent='';
    get<HTMLElement>('last-wave').textContent='';
    get<HTMLElement>('result-title').textContent='任務結算';
    visible(get<HTMLElement>('intermission-banner'),false);
    downed=false;primaryHeld=false;lastHudSnapshot=0;
    alertMessage('第 '+((event.levelIndex??0)+1)+' 關：'+(event.levelLabel||'新關卡')+' · '+(event.objective||''));
    return;
  }
  if(event.type==='mission'){
    missionOverlay.style.display='block';
    objectivePhase=event.missionPhase==='extraction'?'extraction':'objectives';
    if(event.environment)updateEnvironment(event.environment);
    missionOverlay.dataset.phase=event.missionPhase||'objectives';
    missionOverlay.textContent=event.missionPhase==='extraction'
      ?(event.levelLabel||network.session.levelLabel)+'：可選擇撤離點，靠近按 F 啟動並集合'
      :(event.levelLabel||network.session.levelLabel)+'｜擊殺感染者 '+(event.progress||0)+'/'+(event.goal||12);
    if(event.message)alertMessage(event.message);
    return;
  }
  if(event.type==='missionProgress'){
    if(missionOverlay.dataset.phase!=='extraction')
      missionOverlay.textContent=network.session.levelLabel+'｜擊殺感染者 '+(event.progress||0)+'/'+(event.goal||12);
    return;
  }
  if(event.type==='missionEnd'){
    primaryHeld=false;downed=false;
    shop.close(true);visible(get<HTMLElement>('intermission-banner'),false);
    controller.controls.unlock();menuMode('over');
    get<HTMLElement>('last-wave').textContent=event.message||'任務結算';
    missionOverlay.style.display='none';updateEnvironment(null);renderCampaignResult();return;
  }
  if(event.type==='environmentState'){
    if(event.environment)updateEnvironment(event.environment);
    if(event.message)alertMessage(event.message);
    return;
  }
  if(event.type==='environmentAction'){
    if(event.message)alertMessage(event.message);
    return;
  }
  if(event.type==='skillUsed'){if(event.by===network.session.selfId)alertMessage('職業技能已啟動');return;}
  if(event.type==='bossAppeared'||event.type==='randomEvent'||event.type==='actionResult'){
    alertMessage(event.message||'戰場狀態更新');return;
  }
  if(event.type==='lootCollected'&&event.by===network.session.selfId){
    alertMessage(`搜刮成功：${event.rarity??'common'} +${event.credits??0}`);return;
  }
  if(event.type==='defenseBuilt'&&event.by===network.session.selfId){alertMessage('防禦設施已部署');return;}
  if(event.type==='specialAttack'&&event.kind==='screamer'){alertMessage('尖叫者召集屍潮！');return;}
  if(event.type==='joined'){menuMode('lobby');drawLobby();shop.setContext('lobby',0);shop.update(self());return;}
  if(event.type==='room'){drawLobby();shop.update(self());return;}
  if(event.type==='disconnected'){
    combatUI.setActive(false);sound.setCriticalHeartbeat(false);
    downed=false;shop.close(true);updateEnvironment(null);visible(get<HTMLElement>('intermission-banner'),false);controller.controls.unlock();menuMode('menu');alertMessage('與伺服器斷線，正在重新連線');return;
  }
  if(event.type==='wave'){
    shopRemainingUntil=0;lastShopDisplay=-1;
    visible(get<HTMLElement>('intermission-banner'),false);
    if(shop.isOpen)shop.close(true);
    shop.setContext('playing',0);
    if(!controller.controls.isLocked)enterBattle();
    alertMessage(event.message||'屍潮來襲');return;
  }
  if(event.type==='intermission'){
    primaryHeld=false;shopRemainingUntil=performance.now()+(event.remainingMs??30000);lastShopDisplay=-1;
    shop.setContext('intermission',event.remainingMs??30000);
    controller.controls.unlock();combatUI.setActive(false);sound.setCriticalHeartbeat(false);
    visible(overlay,false);visible(get<HTMLElement>('intermission-banner'),true);
    for(const el of [hud,weaponHud,playerHud,mapWrap])visible(el,true);
    shop.open(self());renderHUD();
    alertMessage(event.message||'屍潮清除！30 秒安全購物時間');return;
  }
  if(event.type==='waveClear')return;
  if(event.type==='snapshot'){
    if(event.environment)updateEnvironment(event.environment);
    if(network.session.phase==='intermission'){shopRemainingUntil=performance.now()+(event.shopRemainingMs??0);}
    crowd.receive(network.session.zombies);teammates.receive(network.session.players,network.session.selfId);
    battleExtras.update(event.defenses??[],event.loot??[]);
    const boss=network.session.zombies.find(z=>z.kind==='boss');
    interactionHUD.style.display=boss?'block':'none';
    interactionHUD.textContent=boss?'BOSS · '+Math.ceil(boss.hp)+' / '+Math.ceil(boss.maxHp??1550)+' HP':'';
    if(controller.controls.isLocked)sound.updateEnemies(network.session.zombies,camera.position);
    const p=self();
    if(p){
      localKills=p.kills;downed=p.downed;
      // Compare server authority with the EXACT client pose it acknowledged.
      // Never chase the current camera toward a 100ms-old snapshot.
      const correction=moveReconciler.acknowledge(p.ackMoveSeq,p.x,p.z);
      if(correction.snap){
        camera.position.x=p.x;
        camera.position.z=p.z;
      }
      controller.reconcileServerHeight(p.y??0,p.grounded??true,p.vy??0);
      if(isWeaponId(p.weaponId)){
        if(p.weaponId!==selectedId || (p.level!==modelLevel && weapon.state.mode!=='Reload')){
          void swapWeapon(p.weaponId,p.level,p.ammo,p.reserve);
        }else weapon.syncServerAmmo({ammo:p.ammo,reserve:p.reserve,reloading:p.reloading});
        controller.speedMultiplier=1-WEAPONS[p.weaponId].speedPenalty;
      }
    }
    if(performance.now()-lastHudSnapshot>100){
      renderHUD();lastHudSnapshot=performance.now();
    }
    return;
  }
  if(event.type==='reward'){
    const bonus=event.levelUps?` · 升級 LV ${event.level}！`:'';
    alertMessage(`擊殺獎勵 +$${event.money} · +${event.xp} XP${bonus}`);return;
  }
  if(event.type==='shopResult'){
    const itemName=event.sku==='armor'?'防彈背心':event.sku==='medkit'?'急救補給':event.sku==='ammo'?'彈藥補充':WEAPONS[event.sku as WeaponId]?.name||'商品';
    alertMessage(event.ok?`${event.action==='equip'?'已裝備':'購買成功'}：${itemName}`:`商店：${event.reason||'購買失敗'}`);
    return;
  }
  if(event.type==='turretShot'&&typeof event.defenseId==='number'&&event.from&&event.to){
    battleExtras.onTurretShot(event.defenseId,event.from,event.to);
    tracers.spawn(event.from,event.to,'turret');return;
  }
  if(event.type==='shot'){
    shotFx.onServerShot(event);
    fireVisualTracer(event);
    if(event.by===network.session.selfId&&event.hit){
      combatUI.onConfirmedHit(event.headshot===true);
      sound.playHitmarker(event.headshot===true);
    } else if(event.by!==network.session.selfId&&event.from&&isWeaponId(event.weaponId)) {
      sound.playRemoteGunshot(WEAPONS[event.weaponId].category,new THREE.Vector3(event.from.x,event.from.y,event.from.z));
    }
    if(event.by===network.session.selfId&&event.hit&&event.killed){
      alertMessage(event.headshot?'爆頭擊殺！':'擊殺感染者！');
    }
    return;
  }
  if(event.type==='damage'&&event.target===network.session.selfId)alertMessage('受到殭屍攻擊！護甲會優先吸收傷害');
  if(event.type==='downed'&&event.target===network.session.selfId){downed=true;alertMessage('你已倒地！等待隊友救援');}
  if(event.type==='revived'&&event.target===network.session.selfId){downed=false;alertMessage('隊友已將你救起');}
  if(event.type==='gameOver'){
    primaryHeld=false;
    combatUI.setActive(false);sound.setCriticalHeartbeat(false);
    shop.close(true);visible(get<HTMLElement>('intermission-banner'),false);
    controller.controls.unlock();menuMode('over');
    get<HTMLElement>('last-wave').textContent='小隊於第 '+(event.wave||1)+' 波遭到殲滅 · 擊殺 '+localKills;
    missionOverlay.style.display='none';drawLobby();renderCampaignResult();
  }
};
get<HTMLButtonElement>('create').onclick=()=>{void sound.unlock();network.create(get<HTMLInputElement>('nickname').value.trim()||'倖存者');};
get<HTMLButtonElement>('join').onclick=()=>{void sound.unlock();network.join(get<HTMLInputElement>('room-code').value.trim().toUpperCase(),get<HTMLInputElement>('nickname').value.trim()||'倖存者');};
get<HTMLButtonElement>('start-wave').onclick=()=>network.start();
get<HTMLButtonElement>('retry').onclick=()=>network.retryLevel();
get<HTMLButtonElement>('next-level').onclick=()=>network.nextLevel();
get<HTMLButtonElement>('restart-campaign').onclick=()=>network.restartCampaign();
get<HTMLButtonElement>('shop-reopen').onclick=()=>{
  if(network.session.phase==='intermission'){shop.open(self());visible(overlay,false);}
};
get<HTMLButtonElement>('enter').onclick=()=>{void sound.unlock();controller.controls.lock();};
controller.controls.addEventListener('lock',()=>{
  if(network.session.phase==='playing'){
    void sound.unlock();combatUI.setActive(true);visible(overlay,false);
    for(const el of [hud,weaponHud,playerHud,mapWrap])visible(el,true);
    renderHUD();
  }
});
controller.controls.addEventListener('unlock',()=>{
  primaryHeld=false;combatUI.setActive(false);sound.setCriticalHeartbeat(false);visible(scoreboard,false);
  if(network.session.phase==='playing'&&!shop.isOpen)menuMode('battle');
});
function sendPose(){
  const direction=new THREE.Vector3();camera.getWorldDirection(direction);
  const seq=moveReconciler.record(camera.position.x,camera.position.z);
  network.move(camera.position.x,camera.position.z,Math.atan2(direction.x,-direction.z),Math.asin(THREE.MathUtils.clamp(direction.y,-1,1)),seq);
}
let lastSend=0,lastShove=0,primaryHeld=false,emptyWarningAt=0;
function tryFire(){
  if(!controller.controls.isLocked||network.session.phase!=='playing'||downed||shop.isOpen||desiredSwitch)return;
  if(weapon.fire()){
    combatUI.onShot(WEAPONS[selectedId].recoil);
    sound.playWeaponShot(WEAPONS[selectedId].category,isIndoors());
    sendPose();
    const id=++shotCounter;
    const muzzle=weapon.getMuzzleWorldPosition();
    pendingMuzzles.set(id,{point:{x:muzzle.x,y:muzzle.y,z:muzzle.z},at:performance.now()});
    if(pendingMuzzles.size>24)pendingMuzzles.delete(pendingMuzzles.keys().next().value!);
    network.send({type:'shoot',shotId:id});updateAmmo();
  }else if(weapon.state.ammo<=0&&performance.now()-emptyWarningAt>1000){
    emptyWarningAt=performance.now();alertMessage('彈匣已空，按 R 換彈');
  }
}
renderer.domElement.addEventListener('mousedown',event=>{
  if(!controller.controls.isLocked||network.session.phase!=='playing'||downed||shop.isOpen)return;
  if(event.button===0){primaryHeld=true;tryFire();}
  else if(event.button===2){
    aimHeld=true;aim.setRightButtonHeld(true);network.send({type:'aim',active:true});
    updateSensitivity();
  }
});
window.addEventListener('mouseup',event=>{
  if(event.button===0)primaryHeld=false;
  if(event.button===2){aimHeld=false;aim.setRightButtonHeld(false);network.send({type:'aim',active:false});updateSensitivity();}
});
window.addEventListener('blur',()=>{primaryHeld=false;aimHeld=false;aim.setRightButtonHeld(false);updateSensitivity();});
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('wheel',event=>{
  if(aimHeld&&selectedId==='sniper_rifle'&&controller.controls.isLocked){
    event.preventDefault();
    if(aim.cycleScope(event.deltaY>0?1:-1))alertMessage('狙擊鏡倍率已切換');
  }
},{passive:false});
window.addEventListener('keydown',event=>{
  if(event.code==='KeyQ'&&!event.repeat&&network.session.phase==='playing'){network.send({type:'skill'});return;}
  if(['KeyG','KeyH','KeyF','KeyT'].includes(event.code)&&!event.repeat&&network.session.phase==='playing'&&controller.controls.isLocked&&!downed&&!shop.isOpen){
    if(event.code==='KeyG'||event.code==='KeyH')network.send({type:'buildDefense',kind:event.code==='KeyG'?'turret':'barricade'});
    if(event.code==='KeyF'){
      const near=blackoutWorld.getNearest(camera.position.x,controller.footY,camera.position.z,objectivePhase);
      if(near){network.send({type:'interactWorld',id:near.id});return;}
      const item=battleExtras.nearestLoot(camera.position.x,controller.footY,camera.position.z);
      if(item)network.send({type:'collectLoot',id:item.id});
      else alertMessage('附近沒有可以搜刮的物資');
    }
    if(event.code==='KeyT'){
      const d=battleExtras.nearestDamagedDefense(camera.position.x,controller.footY,camera.position.z);
      if(d)network.send({type:'repairDefense',id:d.id});
      else alertMessage('附近沒有可維修的防禦設施');
    }
    return;
  }
  if(event.code==='KeyV'&&!event.repeat&&network.session.phase==='playing'&&performance.now()-lastShove>650){
    lastShove=performance.now();sendPose();network.send({type:'shove'});return;
  }
  if(event.code==='F8'&&!event.repeat){
    event.preventDefault();
    const modes:QualityMode[]=['auto','high','balanced','performance'];
    adaptive.setMode(modes[(modes.indexOf(adaptive.budget.mode)+1)%modes.length]);
    alertMessage(`畫質模式：${adaptive.modeLabel}`);
    return;
  }
  if(event.code==='Tab'&&['playing','intermission'].includes(network.session.phase)){
    event.preventDefault();
    if(!event.repeat){updateScoreboard();visible(scoreboard,true);}
    return;
  }
  if(event.repeat)return;
  if(event.code==='KeyB'&&['lobby','playing','intermission'].includes(network.session.phase)){
    if(shop.isOpen)shop.close();
    else{shop.open(self());if(controller.controls.isLocked)controller.controls.unlock();visible(overlay,false);}
    return;
  }
  if(shop.isOpen)return;
  if((event.code==='Digit1'||event.code==='Digit2')&&network.session.phase==='playing'){
    const p=self(),id=event.code==='Digit1'?p?.secondary:p?.primary;
    if(id)network.send({type:'equip',weaponId:id});return;
  }
  if(event.code==='KeyR'&&controller.controls.isLocked&&!downed&&weapon.reload()){
    network.send({type:'reload'});alertMessage('正在更換彈匣…');
  }
});
// Dispatch jumps at keydown instead of waiting for the next render frame:
// at 5 FPS that otherwise delays the authoritative jump by up to 200 ms.
window.addEventListener('keydown',event=>{
  if(event.code==='Space'&&!event.repeat&&controller.controls.isLocked&&controller.consumeJump()){
    network.send({type:'jump'});
  }
});
window.addEventListener('keyup',event=>{if(event.code==='Tab'){event.preventDefault();visible(scoreboard,false);}});
const pressed=new Set<string>();
window.addEventListener('keydown',e=>pressed.add(e.code));
window.addEventListener('keyup',e=>pressed.delete(e.code));
window.addEventListener('blur',()=>pressed.clear());
const clock=new THREE.Clock();let lastPerfUI=0,lastRevive=0,lastMap=0;
function frame(){
  requestAnimationFrame(frame);
  const wallDelta=clock.getDelta();
  const dt=Math.min(wallDelta,.05),now=performance.now();
  aim.setSprinting(controller.sprinting);
  const ads=aim.update(dt);
  if(Math.abs(camera.fov-ads.fov)>.02){camera.fov=ads.fov;camera.updateProjectionMatrix();}
  const scoped=selectedId==='sniper_rifle'&&ads.aiming&&network.session.phase==='playing'
    &&controller.controls.isLocked&&!downed&&!shop.isOpen;
  sniperScope.classList.toggle('active',scoped);
  sniperScope.classList.toggle('zoom-8',scoped&&ads.zoom>=8);
  get<HTMLElement>('scope-zoom').textContent=ads.zoom+'×';
  get<HTMLElement>('crosshair').style.visibility=scoped?'hidden':'visible';
  weapon.setScoped(scoped);
  if(network.session.phase==='intermission'){
    const remaining=Math.max(0,shopRemainingUntil-now);
    shop.setRemaining(remaining);
    const seconds=Math.ceil(remaining/1000);
    if(seconds!==lastShopDisplay){lastShopDisplay=seconds;get<HTMLElement>('intermission-countdown').textContent=`00:${String(seconds).padStart(2,'0')}`;}
  }
  if(network.session.phase==='playing'&&controller.controls.isLocked&&!downed&&!shop.isOpen){
    // Fixed 60 Hz movement/vertical physics independent of rendering FPS.
    physicsClock.advance(wallDelta,step=>controller.update(step));
    // Smooth only acknowledged server errors, not the snapshot's stale pose.
    const correction=moveReconciler.advance(wallDelta);
    if(correction.dx || correction.dz){
      const resolved=world.movePlayer(camera.position.x,camera.position.z,controller.footY,correction.dx,correction.dz,controller.isGrounded);
      camera.position.x=resolved.x;camera.position.z=resolved.z;
    }
    if(controller.consumeJump())network.send({type:'jump'});
    if(now-lastSend>=50){sendPose();lastSend=now;}
    if(primaryHeld&&WEAPONS[selectedId].automatic)tryFire();
    if(pressed.has('KeyE')&&now-lastRevive>=100){network.send({type:'revive',holding:true});lastRevive=now;}
  }
  if(network.session.phase!=='playing'||!controller.controls.isLocked||downed||shop.isOpen)physicsClock.reset();
  const [dx,dy]=controller.consumeLook();weapon.update(dt,dx,dy,controller.moving);
  blackoutWorld.render(dt);
  const canUseWorld=network.session.phase==='playing'&&controller.controls.isLocked&&!downed&&!shop.isOpen;
  const nearbyWorld=canUseWorld
    ?blackoutWorld.getNearest(camera.position.x,controller.footY,camera.position.z,objectivePhase)
    :null;
  environmentPrompt.style.display=nearbyWorld?'block':'none';
  if(nearbyWorld)environmentPrompt.textContent='F 操作：'+nearbyWorld.label+
    (nearbyWorld.ready?'':'（需先解鎖）');
  combatUI.update(dt,controller.moving,controller.sprinting);
  world.updateShadowFocus(camera.position);
  crowd.render(dt,camera,adaptive.detailDistance,adaptive.visibleDistance);teammates.render(dt);
  battleExtras.animate(dt);tracers.update(dt);impacts.update(dt);
  if(pendingMuzzles.size)for(const [id,pending] of pendingMuzzles)
    if(now-pending.at>1200)pendingMuzzles.delete(id);
  renderer.info.reset();
  composer.render(dt);
  adaptive.sample(wallDelta*1000,network.session.phase==='playing'&&controller.controls.isLocked&&!document.hidden);
  if(now-lastPerfUI>=800){
    lastPerfUI=now;
    get<HTMLElement>('performance').textContent=`${adaptive.budget.fps||'--'} FPS · ${adaptive.modeLabel} · ${crowd.detailedCount} 近 / ${crowd.distantCount} 遠 · ${renderer.info.render.calls} DRAWS · ${impacts.decalCount} DECALS`;
  }
  if(now-lastMap>180&&network.session.phase==='playing'){
    lastMap=now;const dir=new THREE.Vector3();camera.getWorldDirection(dir);
    minimap.draw(camera.position.x,camera.position.z,Math.atan2(dir.x,-dir.z),network.session.zombies);
  }
  if(feedbackDeadline&&now>feedbackDeadline){get<HTMLElement>('feedback').textContent='生存 · 擊殺 · 成長 · 團隊合作';get<HTMLElement>('notice').textContent='';feedbackDeadline=0;}
}
frame();
window.addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  adaptive.resize();
});

window.addEventListener('pagehide',event=>{
  // A persisted page resumes from BFCache; keep its GPU/audio resources alive.
  if(event.persisted)return;
  sound.dispose();combatUI.dispose();impacts.dispose();tracers.dispose();battleExtras.dispose();teammates.dispose();blackoutWorld.dispose();visuals.dispose();post.dispose();assets.dispose();
});
