import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { isCriticalHealth, crosshairTargetSpread, easeToward }
  from '../apps/client/src/ui/CombatFeedbackMath.ts';

const base=path.resolve(import.meta.dirname,'..');
const read=p=>readFileSync(path.join(base,p),'utf8');

test('critical state strictly requires no armor and <25% of maximum hp',()=>{
  assert.equal(isCriticalHealth(24.9,100,0),true);
  assert.equal(isCriticalHealth(25,100,0),false);
  assert.equal(isCriticalHealth(10,100,1),false);
  assert.equal(isCriticalHealth(0,100,0),false);
  assert.equal(isCriticalHealth(50,200,0),false);
  assert.equal(isCriticalHealth(45,200,0),true);
  assert.equal(isCriticalHealth(80,0,0),false);
});

test('crosshair expands while moving and firing, then eases inward',()=>{
  assert.equal(crosshairTargetSpread(false,false,0),0);
  assert.ok(crosshairTargetSpread(true,true,0)>crosshairTargetSpread(true,false,0));
  assert.ok(crosshairTargetSpread(false,false,8)>0);
  const expanded=easeToward(0,crosshairTargetSpread(true,true,12),.1);
  assert.ok(expanded>0);
  assert.ok(easeToward(expanded,0,.1)<expanded);
  assert.ok(crosshairTargetSpread(true,true,100)<=30);
});

test('nine original WAVs are valid mono PCM sound files',()=>{
  const items=['weapons/pistol.wav','weapons/smg.wav','weapons/rifle.wav','weapons/lmg.wav',
    'infected/zombie-roar.wav','infected/special-spawn.wav','ui/hitmarker.wav',
    'ui/headshot.wav','ui/heartbeat.wav'];
  for(const item of items){
    const pathname=path.join(base,'apps/client/public/assets/audio',item);
    assert.ok(statSync(pathname).size>3000,`${item} missing audio`);
    const header=readFileSync(pathname).subarray(0,44);
    assert.equal(header.toString('ascii',0,4),'RIFF');
    assert.equal(header.toString('ascii',8,12),'WAVE');
    assert.equal(header.readUInt16LE(22),1,'expected mono audio');
  }
});

test('3D enemy and remote player audio uses shared AudioListener and bounded voices',()=>{
  const s=read('apps/client/src/audio/SoundManager.ts');
  assert.match(s,/new THREE\.AudioListener\(/);
  assert.match(s,/new THREE\.PositionalAudio\(/);
  assert.match(s,/maxEnemyVoices = 12/);
  assert.match(s,/maxRemoteVoices = 12/);
  assert.match(s,/createConvolver\(/);
  assert.match(s,/updateEnemies\(/);
  assert.match(s,/setCriticalHeartbeat\(/);
});

test('game main listens to server shot validation for red/gold hit feedback',()=>{
  const src=read('apps/client/src/main.ts');
  assert.match(src,/event\.by===network\.session\.selfId&&event\.hit/);
  assert.match(src,/combatUI\.onConfirmedHit\(event\.headshot===true\)/);
  assert.match(src,/sound\.playHitmarker\(event\.headshot===true\)/);
  assert.match(src,/sound\.playWeaponShot\(WEAPONS\[selectedId\]\.category,isIndoors\(\)\)/);
  assert.match(src,/sound\.updateEnemies\(network\.session\.zombies,camera\.position\)/);
  assert.match(src,/event\.code==='Tab'/);
  assert.match(src,/combatUI\.setHealth\(p\.hp,p\.maxHp,p\.armor/);
});
