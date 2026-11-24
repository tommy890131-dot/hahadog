import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const main=source('apps/client/src/main.ts');
const view=source('apps/client/src/game/WeaponViewmodel.ts');
const server=source('server.mjs');
const aim=source('v311/aim-controller.ts');
const styles=source('apps/client/src/style.css');
test('sniper scope is a real reticle overlay only during scoped ADS, with live 4x and 8x indicator',()=>{
  assert.match(main,/id="sniper-scope"/);
  assert.match(main,/class="scope-reticle"/);
  assert.match(main,/selectedId==='sniper_rifle'&&ads\.aiming/);
  assert.match(main,/sniperScope\.classList\.toggle\('active',scoped\)/);
  assert.match(main,/sniperScope\.classList\.toggle\('zoom-8'/);
  assert.match(main,/weapon\.setScoped\(scoped\)/);
  assert.match(styles,/\.sniper-scope\.active/);
  assert.match(styles,/\.scope-cross-v/);
  assert.match(aim,/scopeZooms:\[4,8\]/);
});
test('local visual muzzle is the real weapon flash socket with all camera transforms',()=>{
  assert.match(view,/getMuzzleWorldPosition\(/);
  assert.match(view,/this\.muzzleFlash\.updateWorldMatrix\(true, false\)/);
  assert.match(view,/this\.muzzleFlash\.getWorldPosition\(target\)/);
  assert.match(main,/weapon\.getMuzzleWorldPosition\(\)/);
  assert.match(main,/pendingMuzzles\.set\(id/);
  assert.match(main,/shotId:id/);
});
test('weapon tracers only spawn after server confirms shot and are occlusion-clipped',()=>{
  assert.match(server,/const scopedShotId=Number\.isSafeInteger\(shotId\)/);
  assert.match(server,/type:'shot',by:p\.id,shotId:scopedShotId/);
  assert.match(server,/visualFrom,visualTo,hit,killed,headshot/);
  assert.match(main,/if\(event\.type==='shot'\)\{/);
  assert.match(main,/fireVisualTracer\(event\)/);
  assert.match(main,/shotRaycaster\.intersectObjects\(world\.blockers,false\)/);
  assert.match(main,/tracers\.spawn\(from,to,'gun'\)/);
});
test('remote player muzzle originates at forward barrel-offset, not at player eyes',()=>{
  assert.match(server,/x:from\.x\+Math\.cos\(yaw\)\*\.38\+dir\.x\*1\.05/);
  assert.match(server,/y:from\.y-\.29\+dir\.y\*1\.05/);
  assert.match(server,/z:from\.z\+Math\.sin\(yaw\)\*\.38\+dir\.z\*1\.05/);
  assert.match(server,/for\(const box of roomBoxes\(room\)\)wallDistance=Math\.min\(wallDistance,rayBox\(visualFrom,heading,box\)\)/);
});
