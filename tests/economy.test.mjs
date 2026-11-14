import {fileURLToPath} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {splitArmorDamage,gainExperience} from '../packages/shared/EconomyRules.mjs';
const weapons=JSON.parse(fs.readFileSync(new URL('../packages/shared/WeaponConfig.json',import.meta.url),'utf8'));
const map=JSON.parse(fs.readFileSync(new URL('../packages/shared/MapLayout.json',import.meta.url),'utf8'));

test('exactly eight weapons across the four classes and shared world is enlarged',()=>{
  assert.equal(Object.keys(weapons).length,8);
  assert.deepEqual(new Set(Object.values(weapons).map(w=>w.category)),new Set(['pistol','smg','ar','lmg']));
  assert.equal(map.halfSize,90);assert.ok(map.buildings.length>=40);
  assert.equal(weapons.m4.penetration,2);assert.ok(weapons.m249.magazine>=100);
  assert.equal(weapons.p9.reserve,9999);
});

test('armor absorption 60/40 and spillover correctly applies to HP',()=>{
  assert.deepEqual(splitArmorDamage(100,100,30),{hp:88,armor:82,hpDamage:12,armorDamage:18});
  assert.deepEqual(splitArmorDamage(100,10,30),{hp:80,armor:0,hpDamage:20,armorDamage:10});
  assert.deepEqual(splitArmorDamage(100,0,30),{hp:70,armor:0,hpDamage:30,armorDamage:0});
});

test('level threshold follows level * 150, including multi-level rewards',()=>{
  assert.deepEqual(gainExperience(1,0,200),{level:2,xp:50,levelUps:1});
  assert.deepEqual(gainExperience(1,0,900),{level:4,xp:0,levelUps:3});
  assert.deepEqual(gainExperience(50,0,500),{level:50,xp:0,levelUps:0});
});

test('real WebSocket shop enforces safehouse, available money and idempotent transactions',async()=>{
  const port=32732;
  const server=spawn(process.execPath,['server.mjs'],{cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},stdio:'ignore'});
  let socket;
  const messages=[];
  async function waitFor(predicate,timeout=5500){
    const end=Date.now()+timeout;
    while(Date.now()<end){const found=messages.find(predicate);if(found)return found;await new Promise(r=>setTimeout(r,35));}
    throw new Error(`Timeout; received: ${JSON.stringify(messages.slice(-8))}`);
  }
  try{
    let healthy=false;
    for(let i=0;i<60;i++){try{healthy=(await (await fetch(`http://127.0.0.1:${port}/health`)).json()).ok;if(healthy)break;}catch{}await new Promise(r=>setTimeout(r,50));}
    assert.equal(healthy,true);
    socket=new WebSocket(`ws://127.0.0.1:${port}/ws`);
    socket.onmessage=e=>messages.push(JSON.parse(e.data));
    await new Promise((ok,bad)=>{socket.addEventListener('open',ok,{once:true});socket.addEventListener('error',bad,{once:true});});
    await waitFor(m=>m.type==='hello');
    socket.send(JSON.stringify({type:'create',name:'Economy Tester'}));
    const joined=await waitFor(m=>m.type==='joined');
    assert.equal(joined.players[0].money,600);assert.equal(joined.players[0].weaponId,'p9');
    socket.send(JSON.stringify({type:'buy',sku:'armor',txn:'test_armor_001'}));
    await waitFor(m=>m.type==='shopResult'&&m.sku==='armor'&&m.ok===true);
    const updated=await waitFor(m=>m.type==='room'&&m.players?.[0]?.armor===100);
    assert.equal(updated.players[0].money,200);
    socket.send(JSON.stringify({type:'buy',sku:'armor',txn:'test_armor_001'}));
    await waitFor(m=>m.type==='shopResult'&&m.sku==='armor'&&m.ok===true&&m.action==='buy');
    socket.send(JSON.stringify({type:'buy',sku:'magnum',txn:'test_magnum_01'}));
    await waitFor(m=>m.type==='shopResult'&&m.ok===false&&/不足/.test(m.reason));
    socket.send(JSON.stringify({type:'start'}));
    await waitFor(m=>m.type==='wave');
    const snap=await waitFor(m=>m.type==='snapshot'&&m.players?.[0]?.armor===100);
    assert.equal(snap.players[0].money,200,'lobby purchases preserved into first wave');
  } finally{socket?.close();server.kill('SIGTERM');}
});

