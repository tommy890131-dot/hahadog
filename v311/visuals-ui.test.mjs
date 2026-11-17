import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const main=source('apps/client/src/main.ts');
const server=source('server.mjs');
const extras=source('apps/client/src/game/BattleExtras.ts');
const tracers=source('apps/client/src/effects/BulletTracers.ts');
const viewmodel=source('apps/client/src/game/WeaponViewmodel.ts');

test('four-slot squad shows each player health, kill count and status',()=>{
  assert.match(main,/for\(let i=0;i<4;i\+\+\)/);
  assert.match(main,/p\.kills/);
  assert.match(main,/p\.hp\/Math\.max\(1,p\.maxHp\)/);
  assert.match(main,/renderSquad\(s\.players,s\.selfId\)/);
  assert.match(main,/squad-member/);
});
test('controls are moved into settings guide, footer hidden, never duplicated on persistent overlay',()=>{
  assert.match(main,/id="settings-toggle"/);
  assert.match(main,/id="settings-panel" class="hidden"/);
  assert.match(main,/<details class="game-guide">/);
  assert.match(main,/id="footer" class="hidden"/);
  assert.doesNotMatch(main,/interactionHUD\.textContent=.[^;]*機槍塔/);
});
test('server turrets broadcast authoritative world-space shot vectors',()=>{
  assert.match(server,/type:'turretShot',defenseId:d\.id,enemyId:z\.id/);
  assert.match(server,/from:\{x:d\.x,y:d\.y\+\.72,z:d\.z\}/);
  assert.match(server,/to:\{x:z\.x,y:z\.y/);
});
test('turrets animate visible yaw, recoil and muzzle flash from server events',()=>{
  assert.match(extras,/onTurretShot\(/);
  assert.match(extras,/turret\.head\.rotation\.y=turret\.facing/);
  assert.match(extras,/turret\.barrel\.position\.z/);
  assert.match(extras,/turret\.flash\.visible/);
  assert.match(main,/battleExtras\.animate\(dt\)/);
});
test('all player and machine-gun bullets use a pooled moving tracer system',()=>{
  assert.match(main,/fireVisualTracer\(event\)/);
  assert.match(main,/tracers\.spawn\(from,to,'gun'\)/);
  assert.match(main,/tracers\.spawn\(event\.from,event\.to,'turret'\)/);
  assert.match(tracers,/private readonly max=36/);
  assert.match(tracers,/new THREE\.InstancedMesh/);
  assert.match(tracers,/shot\.age\/shot\.travel/);
  assert.match(main,/tracers\.update\(dt\)/);
  assert.match(main,/tracers\.dispose\(\)/);
});
test('M249 and PKM have extra viewmodel firing motion and gun flash',()=>{
  assert.match(viewmodel,/tuning\.id==='m249'\|\|tuning\.id==='pkm'/);
  assert.match(viewmodel,/this\.machineGunPulse=1/);
  assert.match(viewmodel,/this\.recoilRig\.rotation\.z/);
  assert.match(viewmodel,/this\.muzzleFlash\.scale/);
});
