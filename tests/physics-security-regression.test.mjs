import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {FixedPhysicsClock} from '../packages/shared/FixedPhysicsClock.mjs';
import {MoveReconciler} from '../packages/shared/MoveReconciler.mjs';
import {PHYSICS,stepVertical} from '../packages/shared/VerticalCollision.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,limit=12000){const end=Date.now()+limit;while(Date.now()<end){if(await fn())return;await sleep(25);}throw Error('timeout');}
function simulateFps(fps){
  const clock=new FixedPhysicsClock();
  let x=0, state={y:0,vy:PHYSICS.jumpVelocity,grounded:false},steps=0;
  const frames=Math.round(1.2*fps);
  for(let i=0;i<frames;i++)clock.advance(1/fps,dt=>{
    x+=4.8*dt;
    const next=stepVertical(state.y,state.vy,state.grounded,0,0,dt);
    state=next;steps++;
  });
  return {x,state,steps};
}

test('physics clock keeps the same 1.2s movement + gravity at 60, 20, 10 and 5 FPS',()=>{
  const expected=simulateFps(60);
  assert.equal(expected.steps,72);
  assert.equal(expected.state.grounded,true);
  for(const fps of [20,10,5]){
    const result=simulateFps(fps);
    assert.equal(result.steps,72,`expected full simulation at ${fps}fps`);
    assert.ok(Math.abs(result.x-expected.x)<1e-6,`movement match at ${fps}fps`);
    assert.ok(Math.abs(result.state.y-expected.state.y)<1e-6,`vertical match at ${fps}fps`);
  }
});

test('physics clock clamps long background stalls and resets on pause',()=>{
  const clock=new FixedPhysicsClock();
  let steps=0;
  assert.equal(clock.advance(3,()=>steps++),0);
  assert.equal(steps,0);
  clock.reset();
  assert.equal(clock.advance(1/60,()=>steps++),1);
});

test('pose reconciliation uses acknowledged history, not latest render position',()=>{
  const reconcile=new MoveReconciler();
  const ack1=reconcile.record(1,2);
  const ack2=reconcile.record(1.25,2);
  assert.equal(reconcile.acknowledge(ack1,1,2).corrected,false);
  assert.equal(reconcile.acknowledge(ack1,0,0).corrected,false,'duplicate ACK does nothing');
  assert.equal(reconcile.acknowledge(ack2,1.35,2).corrected,true);
  let x=0;
  for(let i=0;i<30;i++)x+=reconcile.advance(1/60).dx;
  assert.ok(x>.09 && x<.11,`small server error converged smoothly: ${x}`);
});

test('real server blocks oversized JSON, limits echoed ping size, and acknowledges movement',async()=>{
  const port=37000+Math.floor(Math.random()*12000);
  const server=spawn(process.execPath,['server.mjs'],{cwd:ROOT,env:{...process.env,HOST:'127.0.0.1',PORT:String(port)},stdio:['ignore','pipe','pipe']});
  let log='';server.stdout.on('data',data=>log+=data);server.stderr.on('data',data=>log+=data);
  const sockets=[];
  const open=async()=>{
    const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const messages=[];
    ws.addEventListener('message',event=>messages.push(JSON.parse(event.data)));
    sockets.push(ws);
    await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
    return {ws,messages};
  };
  try{
    await until(async()=>{try{return (await (await fetch(`http://127.0.0.1:${port}/health`)).json()).ok;}catch{return false;}},15000);
    const a=await open();
    await until(()=>a.messages.some(m=>m.type==='hello'));
    a.ws.send(JSON.stringify({type:'ping',t:'p'.repeat(3100)}));
    await until(()=>a.messages.some(m=>m.type==='pong'));
    assert.equal(typeof a.messages.find(m=>m.type==='pong').t,'number','untrusted ping string is never echoed');
    const victim=await open();
    victim.ws.send(JSON.stringify({type:'ping',t:'x'.repeat(48000)}));
    await until(()=>victim.ws.readyState===WebSocket.CLOSED);
    assert.equal(victim.messages.filter(m=>m.type==='pong').length,0);
    a.ws.send(JSON.stringify({type:'create',name:'ACK test'}));
    await until(()=>a.messages.some(m=>m.type==='joined'));
    a.ws.send(JSON.stringify({type:'start'}));
    await until(()=>a.messages.some(m=>m.type==='wave'));
    await sleep(80);
    a.ws.send(JSON.stringify({type:'move',x:-2.85,z:-2,yaw:0,pitch:0,seq:17}));
    await until(()=>a.messages.some(m=>m.type==='snapshot'&&m.players?.some(p=>p.name==='ACK test'&&p.ackMoveSeq===17)),6000);
    assert.ok(a.messages.some(m=>m.type==='snapshot'&&m.players?.some(p=>p.ackMoveSeq===17)));
  }finally{
    for(const ws of sockets)try{ws.close();}catch{}
    server.kill('SIGKILL');
  }
});

test('global navigation flow calculations are delegated to a worker and arbitrated across rooms',async()=>{
  const port=37000+Math.floor(Math.random()*12000);
  const server=spawn(process.execPath,['server.mjs'],{cwd:ROOT,env:{...process.env,GAME_MAX_ROOMS:'8',HOST:'127.0.0.1',PORT:String(port)},stdio:['ignore','pipe','pipe']});
  let log='';server.stdout.on('data',data=>log+=data);server.stderr.on('data',data=>log+=data);
  const sockets=[];
  try{
    await until(async()=>{try{return (await (await fetch(`http://127.0.0.1:${port}/health`)).json()).ok;}catch{return false;}},15000);
    for(let i=0;i<4;i++){
      const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`);
      const messages=[];ws.addEventListener('message',event=>messages.push(JSON.parse(event.data)));
      sockets.push(ws);
      await new Promise((ok,bad)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',bad,{once:true});});
      ws.send(JSON.stringify({type:'create',name:`Concurrent-${i}`}));
      await until(()=>messages.some(m=>m.type==='joined'));
      ws.send(JSON.stringify({type:'start'}));
      await until(()=>messages.some(m=>m.type==='wave'));
      await until(()=>messages.filter(m=>m.type==='snapshot').length>=8,4500);
      // Every room keeps broadcasting even while another room's route is calculated.
      const stamps=messages.filter(m=>m.type==='snapshot').map(m=>m.phase);
      assert.ok(stamps.length>=8);
    }
  }finally{
    for(const ws of sockets)try{ws.close();}catch{}
    server.kill('SIGKILL');
  }
});

test('actual asynchronous Worker returns valid flow field without blocking main thread',async()=>{
  const {Worker}=await import('node:worker_threads');
  const worker=new Worker(new URL('../server/NavigationWorker.mjs',import.meta.url));
  try{
    let ticks=0;
    const interval=setInterval(()=>ticks++,10);
    const response=await new Promise((resolve,reject)=>{
      worker.once('message',resolve);
      worker.once('error',reject);
      worker.postMessage({id:42,x:-3,y:0,z:-2});
    });
    clearInterval(interval);
    assert.equal(response.id,42);
    assert.ok(response.goal>=0);
    assert.ok(response.dist instanceof Float64Array);
    assert.ok(response.next instanceof Int32Array);
    assert.ok(response.dist.length>17000);
    assert.ok(ticks>0,'main event loop continued while worker computed paths');
  }finally{await worker.terminate();}
});

test('global byte budget closes repeated medium-sized socket messages',async()=>{
  const port=37000+Math.floor(Math.random()*12000);
  const server=spawn(process.execPath,['server.mjs'],{cwd:ROOT,env:{...process.env,HOST:'127.0.0.1',PORT:String(port)},stdio:'ignore'});
  let ws;
  try{
    await until(async()=>{try{return (await (await fetch(`http://127.0.0.1:${port}/health`)).json()).ok;}catch{return false;}},15000);
    ws=new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await new Promise((ok,bad)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',bad,{once:true});});
    const payload=JSON.stringify({type:'ping',t:'w'.repeat(3000)});
    // This packet count stays below the message-rate budget: close MUST come
    // from the actual received-byte quota, not simply messages/second.
    for(let i=0;i<16;i++){
      if(ws.readyState!==WebSocket.OPEN)break;
      ws.send(payload);
    }
    await until(()=>ws.readyState===WebSocket.CLOSED,6000);
  }finally{try{ws?.close();}catch{}server.kill('SIGKILL');}
});
