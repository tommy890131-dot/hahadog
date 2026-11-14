/** Original royalty-free synthesized placeholder audio. Used when WAV assets are absent. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../apps/client/public/assets/audio');
const RATE = 22050;
let seed = 64731;
const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967295*2-1;};
const clamp=v=>Math.max(-1,Math.min(1,v));
function writeWav(name, seconds, fn){
  const filepath=path.join(ROOT,name);
  if(fs.existsSync(filepath))return;
  fs.mkdirSync(path.dirname(filepath),{recursive:true});
  const frames=Math.floor(seconds*RATE),pcm=Buffer.alloc(frames*2),data=[];
  for(let i=0;i<frames;i++)data.push(fn(i/RATE,i));
  const peak=Math.max(1,...[...data].filter((_,i)=>i%103===0).map(x=>Math.abs(x)));
  for(let i=0;i<frames;i++)pcm.writeInt16LE(Math.round(clamp(data[i]/peak*.8)*32767),i*2);
  const h=Buffer.alloc(44);
  h.write('RIFF',0);h.writeUInt32LE(36+pcm.length,4);h.write('WAVEfmt ',8);
  h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);
  h.writeUInt32LE(RATE,24);h.writeUInt32LE(RATE*2,28);
  h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);
  h.write('data',36);h.writeUInt32LE(pcm.length,40);
  fs.writeFileSync(filepath,Buffer.concat([h,pcm]));
}
function weapon(name,len,f,crack){
  let filtered=0;
  writeWav(`weapons/${name}.wav`,len,t=>{
    const n=noise();filtered=filtered*.82+n*.18;
    const envelope=Math.exp(-t*20);
    return (n*crack*.37*Math.exp(-t*43)+filtered*.4*Math.exp(-t*13)+
      Math.sin(2*Math.PI*(f*t+110*t*t))*.52*envelope)*(Math.min(1,t*420));
  });
}
weapon('pistol',.25,75,.65);
weapon('smg',.20,72,.8);
weapon('rifle',.36,55,1.2);
weapon('lmg',.40,48,1.4);
function roar(name,len,special){
  let filtered=0;
  writeWav(`infected/${name}.wav`,len,t=>{
    filtered=filtered*.975+noise()*.025;
    const env=Math.min(1,t*9)*Math.min(1,(len-t)*4);
    const mod=Math.sin(t*33)*13;
    const bass=.40*Math.sin(2*Math.PI*(70*t+mod*.05))+.25*Math.sin(2*Math.PI*36*t);
    const shriek=special ? .24*Math.sin(2*Math.PI*(205*t+125*t*t)) : .08*Math.sin(2*Math.PI*139*t);
    return (bass+filtered*.85+shriek)*env;
  });
}
roar('zombie-roar',1,false);
roar('special-spawn',1.5,true);
function ding(name,duration,partials){
  writeWav(`ui/${name}.wav`,duration,t=>partials.reduce((sum,[freq,vol,i])=>
    sum+Math.sin(2*Math.PI*freq*t)*vol*Math.exp(-t*(20-i*4)),0)*Math.min(1,t*900));
}
ding('hitmarker',.12,[[750,.7,0],[1080,.22,1]]);
ding('headshot',.37,[[1175,.4,0],[1700,.35,1],[2350,.23,2]]);
writeWav('ui/heartbeat.wav',1,t=>{
  let y=0;
  for(const [at,a] of [[.12,1],[.34,.68]]){
    if(t>=at){const dt=t-at;y+=a*Math.sin(2*Math.PI*56*dt)*Math.exp(-dt*36);}
  }
  return y+noise()*.003;
});
console.log('[Audio] Synthesized missing sound assets, ready for Vite.');
