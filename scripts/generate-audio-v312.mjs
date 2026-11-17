/**
 * V3.12 BLACKOUT PROTOCOL — Original procedural soundtrack and full event SFX.
 * All waveforms are created for DEADLINE FOUR, with no sampled commercial music,
 * third-party samples, external downloads, or licensing dependencies.
 * Mono 22.05 kHz PCM keeps the free Render build / client download affordable.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT='apps/client/public/assets/audio';
const RATE=22050;
const TAU=Math.PI*2;
const clamp=(x,a=-1,b=1)=>Math.max(a,Math.min(b,x));
const env=(t,d,a=.004,r=.18)=>Math.min(1,t/a)*Math.min(1,(d-t)/r);
const hz=n=>440*Math.pow(2,(n-69)/12);
function hash(s){let n=2166136261;for(const c of s){n=Math.imul(n^c.charCodeAt(0),16777619);}return n>>>0;}
function makeNoise(seed){let s=seed||1;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return ((s>>>0)/0xffffffff)*2-1;};}
function write(name,duration,synth,{overwrite=false,level=.67}={}){
  const file=path.join(ROOT,name+'.wav');
  if(!overwrite&&fs.existsSync(file))return;
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const count=Math.floor(duration*RATE);
  const raw=new Float32Array(count),n=makeNoise(hash(name));
  let peak=1e-9;
  for(let i=0;i<count;i++){
    const t=i/RATE;
    const v=clamp(synth(t,duration,n,i),-3,3);
    raw[i]=Number.isFinite(v)?v:0;peak=Math.max(peak,Math.abs(raw[i]));
  }
  const wav=Buffer.alloc(44+count*2);
  wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);
  wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);
  wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);
  wav.writeUInt32LE(RATE,24);wav.writeUInt32LE(RATE*2,28);
  wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);
  wav.write('data',36);wav.writeUInt32LE(count*2,40);
  const normalize=level/Math.max(.6,peak);
  for(let i=0;i<count;i++)wav.writeInt16LE(Math.round(clamp(raw[i]*normalize)*32767),44+i*2);
  fs.writeFileSync(file,wav);
}
function oneShot(name,duration,{bass=75,noise=.4,metal=.2,tone=.4,drop=160,thump=.0,attack=.002,decay=13,tail=.19}={}){
  let low=0,veryLow=0;
  write(name,duration,(t,d,n)=>{
    const w=n();low=low*.94+w*.06;veryLow=veryLow*.989+w*.011;
    const amp=Math.min(1,t/attack)*Math.exp(-t*decay)*Math.min(1,(d-t)/tail);
    const f=bass*Math.exp(-t*drop*.012)+bass*.25;
    const phase=TAU*(bass*t+drop*t*t*.08);
    const ring=Math.sin(phase)+.24*Math.sin(phase*2.4)+.11*Math.sin(phase*4.6);
    const rumble=Math.sin(TAU*f*t)*Math.exp(-t*20);
    return (ring*tone+w*noise*Math.exp(-t*31)+low*metal+veryLow*.3+rumble*thump)*amp;
  });
}
function monster(name,duration,{pitch=85,terror=.4,breath=.5,growl=.65}={}){
  let low=0;
  write('infected/'+name,duration,(t,d,n)=>{
    const r=n();low=.972*low+.028*r;
    const throat=Math.sin(TAU*(pitch*t+Math.sin(t*13)*5*t))+.38*Math.sin(TAU*pitch*.51*t);
    const howl=Math.sin(TAU*(pitch*2.5*t+150*t*t*.07));
    return env(t,d,.08,.28)*(throat*growl+howl*terror+low*breath+
      Math.sin(t*47)*.10*Math.sin(TAU*pitch*.32*t));
  });
}
for(const [name,d,opt] of [
 ['weapons/sniper',.92,{bass:61,noise:.7,metal:.32,tone:.8,drop:290,thump:.8,decay:7}],
 ['weapons/shotgun',.63,{bass:74,noise:1.05,metal:.3,tone:.35,drop:270,thump:.7,decay:9}],
 ['weapons/reload-mag',.48,{bass:290,noise:.20,metal:.48,tone:.3,drop:185,decay:16}],
 ['weapons/reload-bolt',.34,{bass:360,noise:.18,metal:.48,tone:.55,drop:20,decay:18}],
 ['weapons/empty',.13,{bass:700,noise:.08,metal:.33,tone:.36,drop:320,decay:30}],
 ['weapons/switch',.23,{bass:200,noise:.08,metal:.42,tone:.22,drop:90,decay:20}],
 ['weapons/ads',.18,{bass:410,noise:.03,metal:.19,tone:.2,drop:125,decay:24}],
 ['player/step-concrete',.22,{bass:76,noise:.31,metal:.19,tone:.08,decay:23}],
 ['player/step-metal',.29,{bass:260,noise:.25,metal:.42,tone:.15,decay:19}],
 ['player/step-wet',.27,{bass:100,noise:.45,metal:.18,tone:.08,decay:20}],
 ['player/jump',.36,{bass:130,noise:.26,metal:.12,tone:.23,drop:-170,decay:12}],
 ['player/land',.47,{bass:77,noise:.55,metal:.15,tone:.1,decay:12,thump:.52}],
 ['player/shove',.33,{bass:150,noise:.7,metal:.22,tone:.3,decay:13}],
 ['player/hit',.48,{bass:47,noise:.6,metal:.13,tone:.4,decay:9}],
 ['player/armor',.36,{bass:400,noise:.17,metal:.5,tone:.2,decay:11}],
 ['player/heal',.63,{bass:380,noise:.08,metal:.16,tone:.7,drop:-55,decay:4}],
 ['player/revive',.78,{bass:430,noise:.09,metal:.21,tone:.76,drop:-100,decay:3}],
 ['player/downed',.82,{bass:53,noise:.7,metal:.18,tone:.32,decay:4,thump:.8}],
 ['ui/click',.09,{bass:650,noise:.05,metal:.18,tone:.5,decay:28}],
 ['ui/purchase',.44,{bass:540,noise:.06,metal:.12,tone:.9,drop:-145,decay:7}],
 ['ui/loot',.51,{bass:740,noise:.06,metal:.19,tone:.64,drop:-90,decay:6}],
 ['ui/skill',.55,{bass:260,noise:.08,metal:.24,tone:.66,drop:-180,decay:5}],
 ['ui/objective',.85,{bass:410,noise:.08,metal:.28,tone:.75,drop:-85,decay:4}],
 ['ui/failure',1.5,{bass:67,noise:.11,metal:.29,tone:.7,drop:-25,decay:1.9}],
 ['world/blackout',2.3,{bass:44,noise:.44,metal:.38,tone:.42,drop:40,decay:1.7,thump:.9}],
 ['world/generator',2.1,{bass:95,noise:.35,metal:.32,tone:.35,drop:-38,decay:2.0,thump:.5}],
 ['world/power-restore',1.35,{bass:230,noise:.12,metal:.28,tone:.65,drop:-70,decay:2.9}],
 ['world/relay',.76,{bass:680,noise:.12,metal:.33,tone:.56,drop:-12,decay:5}],
 ['world/alarm',2.6,{bass:480,noise:.09,metal:.12,tone:.80,drop:25,decay:.70}],
 ['world/evac-van',1.8,{bass:69,noise:.25,metal:.13,tone:.40,drop:-24,decay:1.7}],
 ['world/evac-convoy',1.8,{bass:84,noise:.22,metal:.24,tone:.40,drop:-15,decay:1.7}],
 ['world/evac-tunnel',2.1,{bass:125,noise:.13,metal:.6,tone:.35,drop:16,decay:2.0}],
 ['world/extraction',1.9,{bass:560,noise:.13,metal:.25,tone:.55,drop:-15,decay:1.65}],
 ['world/horde',2.0,{bass:55,noise:.4,metal:.1,tone:.75,drop:-35,decay:1.8}],
 ['world/boss-intro',2.3,{bass:38,noise:.3,metal:.21,tone:.7,drop:25,decay:1.45,thump:.66}],
 ['world/success',2.4,{bass:330,noise:.04,metal:.13,tone:.92,drop:-25,decay:1.1}],
 ['world/radio-click',.17,{bass:810,noise:.27,metal:.21,tone:.39,decay:20}],
 ] )oneShot(name,d,opt);
for(const [name,d,opt] of [
 ['walker',1.2,{pitch:70,terror:.1,breath:.5,growl:.7}],
 ['runner',.89,{pitch:135,terror:.5,breath:.72,growl:.4}],
 ['brute',1.75,{pitch:41,terror:.08,breath:.5,growl:.9}],
 ['spitter',1.25,{pitch:180,terror:.8,breath:.48,growl:.3}],
 ['screamer',2.0,{pitch:290,terror:1.0,breath:.7,growl:.18}],
 ['climber',.95,{pitch:116,terror:.53,breath:.61,growl:.4}],
 ['juggernaut',1.9,{pitch:34,terror:.1,breath:.75,growl:.95}],
 ['boss',2.5,{pitch:28,terror:.22,breath:.77,growl:1.05}],
 ['attack',.58,{pitch:112,terror:.42,breath:.38,growl:.57}],
 ['death',.88,{pitch:90,terror:.24,breath:.6,growl:.48}],
])monster(name,d,opt);
// Ambient beds are seamless short loops. Noise moves slowly to mask repetition.
function atmosphere(name,seconds,{wind=.3,hum=.2,rain=0,sirens=0}={}){
  let low=0,mid=0;
  write('ambience/'+name,seconds,(t,d,n)=>{
    const r=n();low=low*.997+r*.003;mid=mid*.97+r*.03;
    const gust=.35+.65*(Math.sin(TAU*t/13)**2);
    const at=Math.min(1,t/.18,(d-t)/.18);
    return at*(low*wind*gust+mid*rain*.65+
      hum*(Math.sin(TAU*47*t)*.4+Math.sin(TAU*92*t)*.2)+
      sirens*Math.sin(TAU*(342+21*Math.sin(t*.52))*t)*.24);
  },{level:.45});
}
atmosphere('city-night',12,{wind:.56,hum:.19,sirens:.065});
atmosphere('blackout-wind',12,{wind:.78,hum:.08,rain:.05});
atmosphere('extraction-zone',12,{wind:.35,hum:.22,sirens:.22});
atmosphere('indoor-hum',10,{wind:.07,hum:.41});
/** 4-bar original minor-key adaptive score; all loops are harmonically related. */
function score(name,{bpm=86,root=38,mood='explore',intensity=.4}={}){
 const beat=60/bpm,beats=16,duration=beat*beats;
 const chord=[root,root+3,root+7,root+10];
 const riff=[0,2,1,3,0,1,2,-1,0,3,2,1,0,1,0,-1];
 let filtered=0;
 write('music/'+name,duration,(t,d,n)=>{
   const phase=t/beat,index=Math.floor(phase),fraction=phase-index;
   const half=Math.floor(t/(beat*.5)),sub=t/(beat*.5)-half;
   const r=n();filtered=filtered*.985+r*.015;
   const smooth=Math.min(1,t/.18,(d-t)/.18);
   const drone=Math.sin(TAU*hz(root-12)*t)*.31+
     Math.sin(TAU*hz(root)*t)*.09+
     Math.sin(TAU*hz(root+7)*t)*.10;
   const chordTone=chord.reduce((x,note,i)=>x+Math.sin(TAU*hz(note)*t+.22*i)*(.035+.003*i),0);
   const note=riff[index%riff.length],pitch=note<0?root+12:root+12+([0,3,5,7][note]??0);
   const pluck=Math.sin(TAU*hz(pitch)*t)*Math.exp(-fraction*(mood==='blackout'?8:6))*.18;
   const kick=Math.sin(TAU*(53-19*fraction)*fraction*beat)*Math.exp(-fraction*20)*.50*(index%4===0?1:.42);
   const snare=(r*.52+filtered*.6)*Math.exp(-fraction*18)*(index%4===2?1:0);
   const hat=r*Math.exp(-sub*35)*(half%2===0?.19:.07);
   const heartbeat=Math.sin(TAU*65*fraction*beat)*Math.exp(-fraction*26)*.18;
   let music=0;
   if(mood==='menu')music=drone*.54+chordTone*.44+pluck*.22+filtered*.07;
   if(mood==='explore')music=drone*.42+chordTone*.30+pluck*.32+filtered*.08;
   if(mood==='combat')music=drone*.54+chordTone*.2+pluck*.4+kick*.5+snare*.34+hat*.18;
   if(mood==='boss')music=drone*.83+chordTone*.25+pluck*.27+kick*.84+snare*.44+hat*.21+filtered*.15;
   if(mood==='blackout')music=drone*.73+filtered*.2+chordTone*.08+heartbeat*.42+pluck*.10;
   if(mood==='extraction')music=drone*.56+chordTone*.25+pluck*.5+kick*.68+snare*.33+hat*.24;
   if(mood==='victory')music=chordTone*.85+pluck*.40+drone*.18;
   if(mood==='defeat')music=drone*.69+chordTone*.34+filtered*.21;
   return music*intensity*smooth;
 },{level:.52});
}
score('menu',{bpm:84,root:40,mood:'menu',intensity:.40});
score('explore',{bpm:84,root:40,mood:'explore',intensity:.45});
score('combat',{bpm:112,root:40,mood:'combat',intensity:.70});
score('boss',{bpm:128,root:36,mood:'boss',intensity:.75});
score('blackout',{bpm:70,root:38,mood:'blackout',intensity:.62});
score('extraction',{bpm:122,root:40,mood:'extraction',intensity:.66});
score('victory',{bpm:75,root:40,mood:'victory',intensity:.48});
score('defeat',{bpm:64,root:38,mood:'defeat',intensity:.42});
console.log('[V3.12 Audio] 8 original music stems, 4 ambience beds, 47 authored event sounds verified/generated');
