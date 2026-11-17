import * as THREE from 'three';

export type MusicMood='menu'|'explore'|'combat'|'boss'|'blackout'|'extraction'|'victory'|'defeat';
export type RadioCue=
  'missionStart'|'wave'|'waveClear'|'boss'|'blackout'|'powerRestored'|
  'generator'|'relay'|'alarm'|'extraction'|'van'|'convoy'|'tunnel'|
  'success'|'failure'|'downed'|'revived'|'lowHealth'|'supply'|'skill';
const SCRIPT:Record<RadioCue,string>={
  missionStart:'這裡是指揮中心。小隊注意，任務開始。保持隊形，清除感染者。',
  wave:'注意！大量感染者正在接近，所有人準備迎戰！',
  waveClear:'區域暫時安全。趁現在補充彈藥和護甲。',
  boss:'偵測到大型變異體！集中火力，注意它的攻擊範圍！',
  blackout:'警告！城市電網斷線！立刻打開手電筒，尋找備用發電機。',
  powerRestored:'備用電力恢復。照明系統重新啟動。',
  generator:'發電機啟動成功，城市照明恢復正常。',
  relay:'通訊繼電器連線成功。地下撤離通道已解鎖。',
  alarm:'警報器已啟動！感染者即將抵達，注意防守！',
  extraction:'撤離路線開放！全隊向撤離點移動，注意集合！',
  van:'裝甲車收到撤離信號，全隊立刻前往西側集合！',
  convoy:'醫療車隊正在東側待命！請立刻集合！',
  tunnel:'地下通道入口已開放！所有倖存者向南方撤離！',
  success:'任務成功！確認小隊所有倖存者已安全撤離。',
  failure:'指揮中心失去小隊訊號。行動失敗。',
  downed:'隊員倒地！附近隊友立即實施救援！',
  revived:'受傷隊員已恢復行動能力。',
  lowHealth:'警告！生命徵象偏低，請立即治療。',
  supply:'補給物資已抵達，請派人回收。',
  skill:'特殊職業能力已啟動。'
};

type LoopSource={voice:THREE.Audio;key:string|null;volume:number};
const MUSIC:readonly MusicMood[]=['menu','explore','combat','boss','blackout','extraction','victory','defeat'];
const BEDS=['city-night','blackout-wind','extraction-zone','indoor-hum'] as const;
type Bed=typeof BEDS[number];

/**
 * A single listener-compatible adaptive score: max two simultaneous music
 * voices for crossfades, plus one ambience loop. Web Speech API does the
 * localized radio dialogue; subtitles remain usable when no TTS voice exists.
 */
export class CinematicAudio {
  private readonly loader=new THREE.AudioLoader();
  private readonly buffers=new Map<string,AudioBuffer>();
  private readonly tracks:[LoopSource,LoopSource];
  private readonly ambience:LoopSource;
  private mood:MusicMood='menu';
  private bed:Bed='city-night';
  private initialized=false;
  private disposed=false;
  private musicVolume=.36;
  private ambienceVolume=.42;
  private radioVolume=.85;
  private voiceEnabled=true;
  private readonly caption:HTMLElement;
  private captionEndsAt=0;
  private speaking=false;
  private voiceUntil=0;
  private lastCue:RadioCue|null=null;
  private lastCueAt=-Infinity;
  constructor(private readonly listener:THREE.AudioListener){
    const make=():LoopSource=>{
      const voice=new THREE.Audio(listener);
      voice.setLoop(true);voice.setVolume(0);
      return {voice,key:null,volume:0};
    };
    this.tracks=[make(),make()];
    this.ambience=make();
    this.caption=document.createElement('div');
    this.caption.id='radio-captions';
    this.caption.setAttribute('role','status');
    this.caption.style.cssText='position:fixed;bottom:19%;left:50%;transform:translateX(-50%);width:min(650px,88vw);text-align:center;z-index:17;color:#f4ecca;background:#111b20dd;border:1px solid #718e85;border-radius:7px;padding:7px 14px;font:600 16px/1.65 sans-serif;text-shadow:0 1px 3px #000;pointer-events:none;display:none';
    document.body.append(this.caption);
  }
  async preload():Promise<void>{
    const urls=[
      ...MUSIC.map(k=>['music/'+k,'/assets/audio/music/'+k+'.wav'] as const),
      ...BEDS.map(k=>['bed/'+k,'/assets/audio/ambience/'+k+'.wav'] as const)
    ];
    await Promise.all(urls.map(async([key,url])=>{
      try{
        const buffer=await this.loader.loadAsync(url);
        if(!this.disposed)this.buffers.set(key,buffer);
      }catch(err){console.warn('[CinematicAudio] missing',url,err);}
    }));
    if(this.initialized)this.setMood(this.mood,true);
  }
  unlock():void{
    if(this.disposed)return;
    this.initialized=true;
    this.startMusic(this.mood);
    this.startAmbient(this.bed);
  }
  private startMusic(mood:MusicMood):void{
    const key='music/'+mood;
    if(this.tracks.some(x=>x.key===key&&x.voice.isPlaying))return;
    const buffer=this.buffers.get(key);
    if(!buffer)return;
    const track=this.tracks.find(x=>!x.voice.isPlaying)||this.tracks.reduce((a,b)=>a.volume<b.volume?a:b);
    if(track.voice.isPlaying)track.voice.stop();
    track.key=key;track.voice.setBuffer(buffer);
    track.voice.setLoop(true);track.voice.setVolume(0);track.volume=0;
    if(this.listener.context.state==='running')track.voice.play();
  }
  private startAmbient(bed:Bed):void{
    const key='bed/'+bed;
    if(this.ambience.key===key&&this.ambience.voice.isPlaying)return;
    const buffer=this.buffers.get(key);
    if(!buffer)return;
    if(this.ambience.voice.isPlaying)this.ambience.voice.stop();
    this.ambience.key=key;this.ambience.voice.setBuffer(buffer);
    this.ambience.voice.setLoop(true);this.ambience.voice.setVolume(0);
    this.ambience.volume=0;
    if(this.listener.context.state==='running')this.ambience.voice.play();
  }
  setMood(mood:MusicMood,force=false):void{
    if(!force&&mood===this.mood)return;
    this.mood=mood;
    if(this.initialized)this.startMusic(mood);
  }
  setEnvironment(powerOnline:boolean,extraction=false,indoor=false):void{
    const bed:Bed=extraction?'extraction-zone':!powerOnline?'blackout-wind':indoor?'indoor-hum':'city-night';
    if(this.bed!==bed){this.bed=bed;if(this.initialized)this.startAmbient(bed);}
  }
  setMusicVolume(v:number):void{this.musicVolume=THREE.MathUtils.clamp(v,0,1);}
  setAmbienceVolume(v:number):void{this.ambienceVolume=THREE.MathUtils.clamp(v,0,1);}
  setRadioVolume(v:number):void{this.radioVolume=THREE.MathUtils.clamp(v,0,1);}
  setVoiceEnabled(v:boolean):void{this.voiceEnabled=v;if(!v&&this.speaking)this.stopVoice();}
  private stopVoice():void{
    if(typeof speechSynthesis!=='undefined')speechSynthesis.cancel();
    this.speaking=false;
  }
  say(cue:RadioCue,priority=false):void{
    if(this.disposed)return;
    const now=performance.now();
    if(!priority&&this.lastCue===cue&&now-this.lastCueAt<9000)return;
    this.lastCue=cue;this.lastCueAt=now;
    const words=SCRIPT[cue];
    this.caption.textContent='[指揮中心／無線電] '+words;
    this.caption.style.display='block';
    this.captionEndsAt=now+Math.max(3500,Math.min(10500,words.length*185));
    if(!this.initialized||!this.voiceEnabled||this.radioVolume<.01||typeof speechSynthesis==='undefined')return;
    if(this.speaking&&!priority)return;
    if(this.speaking)this.stopVoice();
    const utterance=new SpeechSynthesisUtterance(words);
    const voices=speechSynthesis.getVoices();
    const voice=voices.find(v=>v.lang.toLowerCase()==='zh-tw')||
      voices.find(v=>v.lang.toLowerCase().startsWith('zh'))||null;
    if(voice)utterance.voice=voice;
    utterance.lang=voice?.lang??'zh-TW';
    utterance.rate=.93;utterance.pitch=.75;utterance.volume=this.radioVolume;
    utterance.onend=()=>{this.speaking=false;};
    utterance.onerror=()=>{this.speaking=false;};
    this.speaking=true;this.voiceUntil=now+Math.max(4000,words.length*220);
    try{speechSynthesis.speak(utterance);}catch{this.speaking=false;}
  }
  update(dt:number):void{
    const delta=Math.max(0,Math.min(.05,dt)),now=performance.now();
    if(now>this.captionEndsAt&&this.caption.style.display!=='none')this.caption.style.display='none';
    if(this.speaking&&now>this.voiceUntil){this.speaking=false;}
    if(!this.initialized||this.listener.context.state!=='running')return;
    const voiceDuck=this.speaking?.33:1;
    for(const track of this.tracks){
      if(!track.key)continue;
      const wanted=track.key==='music/'+this.mood?this.musicVolume*voiceDuck:0;
      track.volume=THREE.MathUtils.damp(track.volume,wanted,wanted>track.volume?3.3:4.0,delta);
      track.voice.setVolume(track.volume);
      if(track.volume<.002&&wanted===0&&track.voice.isPlaying){track.voice.stop();track.key=null;}
    }
    const wantedBed=this.ambienceVolume*voiceDuck;
    this.ambience.volume=THREE.MathUtils.damp(this.ambience.volume,wantedBed,2.7,delta);
    if(this.ambience.voice.isPlaying)this.ambience.voice.setVolume(this.ambience.volume);
  }
  dispose():void{
    this.disposed=true;this.stopVoice();
    for(const track of [...this.tracks,this.ambience]){
      if(track.voice.isPlaying)track.voice.stop();
      track.voice.disconnect();
    }
    this.caption.remove();this.buffers.clear();
  }
}
