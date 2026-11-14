import * as THREE from 'three';
import type { ZombieRecord } from '../network/Multiplayer';
import type { WeaponCategory } from '../game/WeaponCatalog';

type AudioKey = 'pistol'|'smg'|'rifle'|'lmg'|'zombie'|'special'|'hit'|'headshot'|'heartbeat';

const URLS: Record<AudioKey,string> = {
  pistol:'/assets/audio/weapons/pistol.wav',
  smg:'/assets/audio/weapons/smg.wav',
  rifle:'/assets/audio/weapons/rifle.wav',
  lmg:'/assets/audio/weapons/lmg.wav',
  zombie:'/assets/audio/infected/zombie-roar.wav',
  special:'/assets/audio/infected/special-spawn.wav',
  hit:'/assets/audio/ui/hitmarker.wav',
  headshot:'/assets/audio/ui/headshot.wav',
  heartbeat:'/assets/audio/ui/heartbeat.wav'
};

type LocalVoice = { source: THREE.Audio; send: GainNode };
type EnemyVoice = {
  anchor: THREE.Object3D;
  source: THREE.PositionalAudio;
  cooldownUntil: number;
  kind: ZombieRecord['kind'];
};

/**
 * Single camera listener. Enemy sounds are attached to lightweight world anchors;
 * the actual undead are rendered via InstancedMesh and cannot host per-instance audio.
 * All sounds are optional: if a WAV fails, the game continues silently.
 */
export class SoundManager {
  readonly listener: THREE.AudioListener;
  private readonly loader = new THREE.AudioLoader();
  private readonly buffers = new Map<AudioKey, AudioBuffer>();
  private readonly local: LocalVoice[] = [];
  private readonly remote: THREE.PositionalAudio[] = [];
  private readonly enemies = new Map<number,EnemyVoice>();
  private readonly observed = new Set<number>();
  private readonly reverb: ConvolverNode;
  private readonly heartbeat: THREE.Audio;
  private readonly camera: THREE.Camera;
  private readonly scene: THREE.Scene;
  private disposed = false;
  private latestEnemyUpdate = 0;
  private voiceCursor = 0;
  private enabled = false;
  private readonly maxLocalVoices = 18;
  private readonly maxRemoteVoices = 12;
  private readonly maxEnemyVoices = 12;

  constructor(camera:THREE.Camera,scene:THREE.Scene){
    this.camera=camera;this.scene=scene;
    this.listener=new THREE.AudioListener();
    camera.add(this.listener);
    const context=this.listener.context;
    this.reverb=context.createConvolver();
    this.reverb.buffer=this.makeImpulse(context,0.32);
    this.reverb.connect(this.listener.getInput());
    this.heartbeat=new THREE.Audio(this.listener);
    this.heartbeat.setLoop(true);
    this.heartbeat.setVolume(.22);
  }

  private makeImpulse(ctx:AudioContext,seconds:number):AudioBuffer{
    const frames=Math.floor(ctx.sampleRate*seconds);
    const buffer=ctx.createBuffer(2,frames,ctx.sampleRate);
    for(let c=0;c<2;c++){
      const data=buffer.getChannelData(c);
      for(let i=0;i<frames;i++){
        const time=i/frames;
        data[i]=(Math.random()*2-1)*Math.pow(1-time,2.4)*.27;
      }
    }
    return buffer;
  }

  async preload():Promise<void>{
    await Promise.all((Object.entries(URLS) as [AudioKey,string][]).map(async([key,url])=>{
      try {
        const data=await this.loader.loadAsync(url);
        if(this.disposed)return;
        this.buffers.set(key,data);
        if(key==='heartbeat')this.heartbeat.setBuffer(data);
      } catch(err) { console.warn('[Sound] missing',url,err); }
    }));
  }

  /** Must run from a click / pointer-lock user gesture on browsers. */
  async unlock():Promise<boolean>{
    if(this.disposed)return false;
    try {
      await this.listener.context.resume();
      this.enabled=this.listener.context.state==='running';
    } catch {this.enabled=false;}
    return this.enabled;
  }

  private canPlay():boolean{
    return !this.disposed&&this.enabled&&this.listener.context.state==='running';
  }

  private getLocal():LocalVoice|null{
    const idle=this.local.find(v=>!v.source.isPlaying);
    if(idle)return idle;
    if(this.local.length>=this.maxLocalVoices)return null;
    const source=new THREE.Audio(this.listener);
    const send=this.listener.context.createGain();
    send.gain.value=0;
    source.getOutput().connect(send);
    send.connect(this.reverb);
    const voice={source,send};this.local.push(voice);return voice;
  }

  private playLocal(key:AudioKey,volume:number,wet=0):boolean{
    if(!this.canPlay())return false;
    const buffer=this.buffers.get(key),voice=this.getLocal();
    if(!buffer||!voice)return false;
    voice.source.setBuffer(buffer);
    voice.source.setLoop(false);
    voice.source.setVolume(volume);
    voice.send.gain.value=THREE.MathUtils.clamp(wet,0,.32);
    voice.source.play();
    return true;
  }

  playWeaponShot(category:WeaponCategory,indoor=false):boolean{
    const key:AudioKey=category==='ar'?'rifle':category;
    return this.playLocal(key,{pistol:.42,smg:.40,ar:.48,lmg:.55}[category],indoor ? 0.22 : 0.01);
  }

  playHitmarker(headshot=false):boolean{
    return this.playLocal(headshot?'headshot':'hit',headshot?.44:.27);
  }

  /** Spatial sound for squadmate gunfire. Requires the authoritative shot's position. */
  playRemoteGunshot(category:WeaponCategory,point:THREE.Vector3):boolean{
    if(!this.canPlay())return false;
    const key:AudioKey=category==='ar'?'rifle':category;
    const buffer=this.buffers.get(key);
    if(!buffer||this.camera.position.distanceToSquared(point)>80*80)return false;
    let voice=this.remote.find(v=>!v.isPlaying);
    if(!voice){
      if(this.remote.length>=this.maxRemoteVoices)return false;
      voice=new THREE.PositionalAudio(this.listener);
      voice.setDistanceModel('linear');voice.setRefDistance(4);
      voice.setMaxDistance(80);voice.setRolloffFactor(1);
      this.scene.add(voice);this.remote.push(voice);
    }
    voice.position.copy(point);
    voice.updateMatrixWorld(true);
    voice.setBuffer(buffer);voice.setLoop(false);
    voice.setVolume(.70);voice.play();return true;
  }

  /** Called on snapshots; spatial sources track only nearby audible infected. */
  updateEnemies(zombies:ZombieRecord[],position:THREE.Vector3,now=performance.now()):void{
    if(!this.canPlay()||now-this.latestEnemyUpdate<400)return;
    this.latestEnemyUpdate=now;
    const alive=new Set(zombies.map(z=>z.id));
    for(const id of this.enemies.keys())if(!alive.has(id))this.removeEnemy(id);
    for(const id of this.observed)if(!alive.has(id))this.observed.delete(id);
    const nearby=zombies.filter(z=>(z.x-position.x)**2+(z.z-position.z)**2<55*55)
      .sort((a,b)=>(a.x-position.x)**2+(a.z-position.z)**2-(b.x-position.x)**2-(b.z-position.z)**2)
      .slice(0,this.maxEnemyVoices);
    const allowed=new Set(nearby.map(z=>z.id));
    for(const id of this.enemies.keys())if(!allowed.has(id))this.removeEnemy(id);
    for(const z of nearby){
      const special=z.kind!=='walker';
      let entry=this.enemies.get(z.id);
      const first=!this.observed.has(z.id);
      this.observed.add(z.id);
      if(!entry){
        const anchor=new THREE.Object3D();
        anchor.position.set(z.x,(z.y??0)+1.45,z.z);
        const source=new THREE.PositionalAudio(this.listener);
        source.setDistanceModel('linear');source.setRefDistance(special?5:3);
        source.setMaxDistance(special?55:35);source.setRolloffFactor(1);
        anchor.add(source);this.scene.add(anchor);
        entry={anchor,source,kind:z.kind,cooldownUntil:now+Math.random()*1000};
        this.enemies.set(z.id,entry);
      }
      entry.anchor.position.set(z.x,(z.y??0)+1.45,z.z);
      entry.kind=z.kind;
      if(first && special){
        if(this.voiceCursor++%3===0)this.playEnemy(entry,'special',.85);
        entry.cooldownUntil=now+4500;
      } else if(now>=entry.cooldownUntil && !entry.source.isPlaying){
        if((this.voiceCursor++%3)===0)this.playEnemy(entry,special?'special':'zombie',special ? 0.67 : 0.42);
        entry.cooldownUntil=now+4300+(z.id%5)*1000;
      }
    }
  }

  private playEnemy(entry:EnemyVoice,key:'zombie'|'special',volume:number):void{
    const buffer=this.buffers.get(key);
    if(!buffer||entry.source.isPlaying)return;
    entry.source.setBuffer(buffer);entry.source.setLoop(false);
    entry.source.setVolume(volume);entry.source.play();
  }

  private removeEnemy(id:number):void{
    const entry=this.enemies.get(id);if(!entry)return;
    if(entry.source.isPlaying)entry.source.stop();
    entry.source.disconnect();this.scene.remove(entry.anchor);
    this.enemies.delete(id);
  }

  setCriticalHeartbeat(critical:boolean):void{
    if(!critical){if(this.heartbeat.isPlaying)this.heartbeat.stop();return;}
    if(this.canPlay()&&this.buffers.has('heartbeat')&&!this.heartbeat.isPlaying){
      this.heartbeat.play();
    }
  }

  setMasterVolume(value:number):void{
    this.listener.setMasterVolume(THREE.MathUtils.clamp(value,0,1));
  }

  dispose():void{
    if(this.disposed)return;
    this.setCriticalHeartbeat(false);
    for(const id of [...this.enemies.keys()])this.removeEnemy(id);
    for(const v of this.local){
      if(v.source.isPlaying)v.source.stop();
      v.source.disconnect();v.send.disconnect();
    }
    for(const v of this.remote){if(v.isPlaying)v.stop();v.disconnect();this.scene.remove(v);}
    this.heartbeat.disconnect();this.reverb.disconnect();
    this.listener.parent?.remove(this.listener);
    this.local.length=0;this.remote.length=0;this.buffers.clear();
    this.disposed=true;
  }
}
