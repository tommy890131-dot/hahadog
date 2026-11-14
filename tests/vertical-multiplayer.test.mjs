import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {test} from 'node:test';
const PORT=32391;
const cwd=fileURLToPath(new URL('../',import.meta.url));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,timeout=6000){const end=Date.now()+timeout;while(Date.now()<end){const result=await fn();if(result)return result;await wait(30);}throw Error('Timeout waiting for authoritative Y');}

test('real WebSocket rejects fake height, accepts grounded jump, lands and denies double-jump',async()=>{
  const child=spawn(process.execPath,['server.mjs'],{cwd,env:{...process.env,PORT:String(PORT),HOST:'127.0.0.1'},stdio:'ignore'});
  let socket;
  try{
    await until(async()=>{try{return (await (await fetch(`http://127.0.0.1:${PORT}/health`)).json()).ok;}catch{return false;}});
    socket=new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    const messages=[];
    socket.addEventListener('message',e=>messages.push(JSON.parse(e.data)));
    await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
    await until(()=>messages.find(m=>m.type==='hello'));
    socket.send(JSON.stringify({type:'create',name:'RoofTester'}));
    const joined=await until(()=>messages.find(m=>m.type==='joined'));
    socket.send(JSON.stringify({type:'start'}));
    await until(()=>messages.find(m=>m.type==='wave'));
    const id=joined.selfId;
    const getPlayer=()=>messages.filter(m=>m.type==='snapshot').at(-1)?.players.find(p=>p.id===id);
    await until(()=>getPlayer());
    socket.send(JSON.stringify({type:'jump'}));
    await until(()=>getPlayer()?.y>.12);
    // Second jump while airborne must not add a fresh impulse.
    socket.send(JSON.stringify({type:'jump'}));
    await wait(1000);
    const peak=Math.max(...messages.filter(m=>m.type==='snapshot').flatMap(m=>m.players.filter(p=>p.id===id).map(p=>p.y)));
    assert.ok(peak<1.65&&peak>1.0,`single jump should be ~1.4m, got ${peak}`);
    await until(()=>getPlayer()?.grounded===true && Math.abs(getPlayer()?.y??100)<.02);
    socket.send(JSON.stringify({type:'move',x:-3,z:-2,y:9999,yaw:0,pitch:0}));
    await wait(160);
    assert.ok(Math.abs(getPlayer().y)<.02,'server ignores fake Y supplied in move');
    assert.equal(getPlayer().grounded,true);
    console.log('PASS: jump Y replicated, no double jump, landing and spoofed Y rejected');
  }finally{
    try{socket?.close();}catch{}
    child.kill('SIGTERM');
  }
},{timeout:11000});

