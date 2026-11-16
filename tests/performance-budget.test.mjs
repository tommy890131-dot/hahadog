import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FrameBudget, QUALITY_SETTINGS } from '../apps/client/src/core/FrameBudget.ts';

function feed(b,dt,seconds,eligible=true){
  let changed=0;
  for(let i=0;i<Math.ceil(seconds*1000/dt);i++)if(b.sample(dt,eligible))changed++;
  return changed;
}
test('sustained low FPS triggers progressive reductions in GPU workload',()=>{
  const b=new FrameBudget();
  assert.equal(b.tier,'high');
  feed(b,40,8);
  assert.equal(b.tier,'balanced');
  feed(b,40,8);
  assert.equal(b.tier,'performance');
  assert.ok(QUALITY_SETTINGS.performance.dprLimit<QUALITY_SETTINGS.high.dprLimit);
  assert.equal(QUALITY_SETTINGS.performance.bloom,false);
  assert.equal(QUALITY_SETTINGS.performance.moonShadow,0);
});
test('sustained healthy FPS can recover image quality but not thrash',()=>{
  const b=new FrameBudget();
  b.setMode('performance');
  b.setMode('auto');
  feed(b,1000/60,13);
  assert.equal(b.tier,'balanced');
  feed(b,1000/60,13);
  assert.equal(b.tier,'high');
  feed(b,40,1);
  assert.equal(b.tier,'high');
});
test('manual F8 modes override sampling and restore auto when selected',()=>{
  const b=new FrameBudget();
  b.setMode('high');feed(b,55,15);
  assert.equal(b.tier,'high');
  b.setMode('performance');
  assert.equal(b.tier,'performance');
  assert.equal(b.mode,'performance');
  b.setMode('auto');
  assert.equal(b.mode,'auto');
});
test('paused/hidden tab does not falsely reduce settings',()=>{
  const b=new FrameBudget();
  feed(b,75,14,false);
  assert.equal(b.tier,'high');
  assert.equal(b.fps,0);
  feed(b,250,14);
  assert.equal(b.tier,'high'); // 250ms is a tab-throttle or stall and intentionally ignored.
});
test('FPS settings are wired into the active composer and visual-only zombie LOD',()=>{
  const root=new URL('../apps/client/src/',import.meta.url);
  const main=fs.readFileSync(new URL('main.ts',root),'utf8');
  const adaptive=fs.readFileSync(new URL('core/AdaptiveRenderer.ts',root),'utf8');
  const crowd=fs.readFileSync(new URL('world/ZombieCrowd.ts',root),'utf8');
  assert.match(main,/adaptive\.sample/);
  assert.match(main,/crowd\.render\(dt,camera,adaptive\.detailDistance,adaptive\.visibleDistance\)/);
  assert.match(main,/F8/);
  assert.match(adaptive,/composer\.setPixelRatio\(dpr\)/);
  assert.match(adaptive,/this\.bloom\.enabled = quality\.bloom/);
  assert.match(crowd,/this\.frustum\.intersectsSphere/);
  assert.match(crowd,/batch\.mesh\.setMatrixAt/);
  assert.match(crowd,/new THREE\.InstancedMesh/);
  assert.match(crowd,/distance>detailSq/);
});
