import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
const out = resolve('apps/client/dist');
const index = resolve(out, 'index.html');
const missing=[];
if(!existsSync(index))missing.push('apps/client/dist/index.html');
else {
  const html=readFileSync(index,'utf8');
  if(!html.includes('DEADLINE FOUR'))missing.push('correct DEADLINE FOUR HTML title');
  if(!/\/assets\/[^"']+\.js/.test(html))missing.push('bundled Vite JavaScript');
}
for(const file of ['packages/shared/ZombieNavCache.br','server/NavigationWorker.mjs',
  'apps/client/dist/basis/basis_transcoder.wasm',
  'apps/client/dist/draco/draco_decoder.wasm',
  ...['walker','runner','brute','spitter','boss'].map(name=>'apps/client/dist/models/enemies/'+name+'.glb'),
  ...['walker','runner','brute','spitter'].map(name=>'apps/client/dist/models/enemies/'+name+'-rig.glb'),
  ...['assault','medic','engineer','recon'].map(name=>'apps/client/dist/models/players/'+name+'.glb'),
  ...['menu','explore','combat','boss','blackout','extraction','victory','defeat']
    .map(name=>'apps/client/dist/assets/audio/music/'+name+'.wav'),
  ...['city-night','blackout-wind','extraction-zone','indoor-hum']
    .map(name=>'apps/client/dist/assets/audio/ambience/'+name+'.wav'),
  ...['sniper','shotgun','reload-mag','reload-bolt','empty','switch','ads']
    .map(name=>'apps/client/dist/assets/audio/weapons/'+name+'.wav'),
  ...['walker','runner','brute','spitter','screamer','climber','juggernaut','boss','attack','death']
    .map(name=>'apps/client/dist/assets/audio/infected/'+name+'.wav'),
  ...['step-concrete','step-metal','step-wet','jump','land','shove','hit','armor','heal','revive','downed']
    .map(name=>'apps/client/dist/assets/audio/player/'+name+'.wav'),
  ...['blackout','generator','power-restore','relay','alarm','evac-van','evac-convoy','evac-tunnel','extraction','horde','boss-intro','success','radio-click']
    .map(name=>'apps/client/dist/assets/audio/world/'+name+'.wav')]){
  if(!existsSync(resolve(file)))missing.push(file);
}
if(missing.length){console.error('[Render] Missing build artifacts:',missing);process.exit(1)}
const total = readdirSync(resolve(out,'assets')).length;
console.log(`[Render] Distribution verified: ${total} asset files and navigation worker/cache present.`);
