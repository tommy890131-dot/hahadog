import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const SHOP = JSON.parse(fs.readFileSync(new URL('../packages/shared/ShopRules.json',import.meta.url),'utf8'));
const source = fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const shopUI = fs.readFileSync(new URL('../apps/client/src/shop/ShopUI.ts',import.meta.url),'utf8');
const client = fs.readFileSync(new URL('../apps/client/src/main.ts',import.meta.url),'utf8');
const network = fs.readFileSync(new URL('../apps/client/src/network/Multiplayer.ts',import.meta.url),'utf8');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('default intermission is exactly 30 seconds and client is server-authoritative', () => {
  assert.equal(SHOP.intermissionMs,30_000);
  assert.match(source,/room\.phase='intermission'/);
  assert.match(source,/nextWaveAt=now\+INTERMISSION_MS/);
  assert.match(source,/if\(room\.phase==='intermission'\)/);
  assert.match(network,/this\.session\.phase='intermission'/);
  assert.match(client,/if\(event\.type==='intermission'\)/);
  assert.match(client,/shop\.open\(self\(\)\)/);
  assert.match(shopUI,/setAttribute\('aria-label', '武器補給商店'\)/);
  assert.match(shopUI,/data-shop-time/);
  assert.match(shopUI,/data-shop-progress/);
});

test('real server suspends spawning during intermission, allows purchases and starts next wave on deadline', async () => {
  const port = 32941;
  const server = spawn(process.execPath, ['server.mjs'], {
    cwd: root,
    env: { ...process.env, NODE_ENV:'test', TEST_EMPTY_WAVES:'1', TEST_INTERMISSION_MS:'2200', HOST:'127.0.0.1', PORT:String(port) },
    stdio: ['ignore','pipe','pipe']
  });
  let stderr = '';
  server.stderr.on('data', d => stderr += d);
  const messages = [];
  let ws;
  async function until(predicate, timeout=6000) {
    const end = Date.now()+timeout;
    while (Date.now()<end) {
      const found = messages.find(predicate);
      if (found) return found;
      await sleep(30);
    }
    throw new Error('Timed out waiting for server event: '+stderr+'\n'+JSON.stringify(messages.slice(-8)));
  }
  try {
    for (let i=0;i<100;i++) {
      try { if((await (await fetch(`http://127.0.0.1:${port}/health`)).json()).ok) break; }
      catch {} await sleep(40);
    }
    ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    ws.onmessage = event => messages.push(JSON.parse(event.data));
    await new Promise((ok,fail)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',fail,{once:true});});
    await until(m => m.type==='hello');
    ws.send(JSON.stringify({type:'create',name:'Intermission QA'}));
    await until(m => m.type==='joined');
    ws.send(JSON.stringify({type:'start'}));
    await until(m => m.type==='wave'&&m.wave===1);
    const breakStart = await until(m => m.type==='intermission'&&m.wave===1);
    assert.equal(breakStart.remainingMs,2200);
    assert.equal(breakStart.nextWave,2);
    const snap = await until(m => m.type==='snapshot'&&m.phase==='intermission');
    assert.equal(snap.zombies.length,0);
    assert.equal(snap.remaining,0);
    assert.ok(snap.shopRemainingMs>0&&snap.shopRemainingMs<=2200);
    ws.send(JSON.stringify({type:'buy',sku:'armor',txn:'intermission-armor-01'}));
    const purchase = await until(m => m.type==='shopResult'&&m.sku==='armor');
    assert.equal(purchase.ok,true);
    assert.equal(purchase.cost,400);
    ws.send(JSON.stringify({type:'buy',sku:'medkit',txn:'intermission-heal-01'}));
    const full = await until(m => m.type==='shopResult'&&m.sku==='medkit');
    assert.equal(full.ok,false);
    assert.match(full.reason,/已滿/);
    await sleep(400);
    assert.equal(messages.filter(m=>m.type==='snapshot'&&m.phase==='intermission').some(m=>m.zombies.length>0),false);
    const next = await until(m=>m.type==='wave'&&m.wave===2,5000);
    assert.equal(next.wave,2);
    const snapshot2 = await until(m=>m.type==='snapshot'&&m.phase==='intermission'&&m.wave===2);
    assert.equal(snapshot2.zombies.length,0);
  } finally {
    ws?.close();server.kill('SIGTERM');
  }
});
