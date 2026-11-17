import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const base=new URL('../apps/client/public/assets/audio/',import.meta.url);
const wav=(name)=>{
  const file=fs.readFileSync(new URL(name+'.wav',base));
  assert.equal(file.toString('ascii',0,4),'RIFF',name);
  assert.equal(file.toString('ascii',8,12),'WAVE',name);
  assert.equal(file.readUInt32LE(4),file.length-8,name);
  assert.equal(file.readUInt16LE(22),1,name);
  assert.equal(file.readUInt32LE(24),22050,name);
  assert.ok(file.length>6000,name+' too short');
  let nonzero=false;
  for(let i=44;i<file.length;i+=1200)if(file.readInt16LE(i))nonzero=true;
  assert.ok(nonzero,name+' unexpectedly silent');
  return crypto.createHash('sha256').update(file).digest('hex');
};
test('all eight original music tracks exist, valid nonempty WAVE and distinct',()=>{
  const names=['menu','explore','combat','boss','blackout','extraction','victory','defeat'];
  const digests=names.map(s=>wav('music/'+s));
  assert.equal(new Set(digests).size,8,'music tracks should sound distinct');
});
test('all four dynamic ambience beds are available for room/power/extraction',()=>{
  for(const kind of ['city-night','blackout-wind','extraction-zone','indoor-hum'])wav('ambience/'+kind);
});
test('all creature families have authored spatial roar SFX',()=>{
  for(const kind of ['walker','runner','brute','spitter','screamer','climber','juggernaut','boss','attack','death'])
    wav('infected/'+kind);
});
test('gun, reload, footsteps, world controls, and player interaction SFX exist',()=>{
  const groups={
    weapons:['pistol','smg','rifle','lmg','sniper','shotgun','reload-mag','reload-bolt','empty','switch','ads'],
    player:['step-concrete','step-metal','step-wet','jump','land','shove','hit','armor','heal','revive','downed'],
    world:['blackout','generator','power-restore','relay','alarm','evac-van','evac-convoy','evac-tunnel','extraction','horde','boss-intro','success','radio-click'],
    ui:['click','purchase','loot','skill','objective','failure','hitmarker','headshot','heartbeat']
  };
  for(const [folder,names] of Object.entries(groups))for(const name of names)wav(folder+'/'+name);
});
test('live game integrates voice, captions, ducked adaptive music, music/voice settings',()=>{
  const main=read('apps/client/src/main.ts');
  const audio=read('apps/client/src/audio/CinematicAudio.ts');
  assert.match(main,/new CinematicAudio\(sound.listener\)/);
  assert.match(main,/soundtrack\.update\(dt\)/);
  assert.match(main,/soundtrack\.say\('blackout'/);
  assert.match(main,/soundtrack\.say\('boss'/);
  assert.match(main,/soundtrack\.say\('extraction'/);
  assert.match(main,/sound\.playSfx\('reloadMag'/);
  assert.match(main,/sound\.playSfx\('stepMetal'/);
  assert.match(main,/audio-master/);
  assert.match(main,/audio-music/);
  assert.match(main,/audio-sfx/);
  assert.match(main,/audio-ambient/);
  assert.match(main,/audio-radio-enabled/);
  assert.match(audio,/new SpeechSynthesisUtterance\(words\)/);
  assert.match(audio,/zh-TW/);
  assert.match(audio,/this\.caption\.textContent/);
  assert.match(audio,/this\.speaking \? 0\.33 : 1/);
  assert.match(audio,/type MusicMood='menu'\|'explore'\|'combat'\|'boss'\|'blackout'\|'extraction'\|'victory'\|'defeat'/);
});
test('the existing sound manager reuses a single listener, bounds spatial voices and throttles zombie noises',()=>{
  const manager=read('apps/client/src/audio/SoundManager.ts');
  assert.match(manager,/maxLocalVoices = 18/);
  assert.match(manager,/maxRemoteVoices = 12/);
  assert.match(manager,/maxEnemyVoices = 12/);
  assert.match(manager,/now-this\.latestEnemyUpdate<400/);
  assert.match(manager,/playSfx\(key:GameSfx/);
  assert.match(manager,/playEnemy\(entry,z\.kind/);
});
