import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const PORT=32377;
const server=spawn(process.execPath,['server.mjs'],{cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,PORT:String(PORT),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
let serverOutput='';server.stdout.on('data',b=>serverOutput+=b);server.stderr.on('data',b=>serverOutput+=b);
const delay=(ms)=>new Promise(r=>setTimeout(r,ms));
async function waitUntil(fn,timeout=7000){const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await delay(50);}throw new Error('Timeout: '+serverOutput);}
class Client{
  constructor(){this.ws=new WebSocket(`ws://127.0.0.1:${PORT}/ws`);this.messages=[];this.ws.onmessage=e=>{this.messages.push(JSON.parse(e.data));if(this.messages.length>250)this.messages.shift();};}
  async open(){await new Promise((resolve,reject)=>{this.ws.addEventListener('open',resolve,{once:true});this.ws.addEventListener('error',reject,{once:true});});}
  send(o){this.ws.send(JSON.stringify(o));}
  async get(type,predicate=()=>true,timeout=7000){await waitUntil(()=>this.messages.some(m=>m.type===type&&predicate(m)),timeout);return this.messages.find(m=>m.type===type&&predicate(m));}
  close(){this.ws.close();}
}
const clients=[];
try{
  await waitUntil(async()=>{try{return (await (await fetch(`http://127.0.0.1:${PORT}/health`)).json()).ok;}catch{return false;}});
  for(let i=0;i<5;i++){const c=new Client();await c.open();clients.push(c);await c.get('hello');}
  const [host,...rest]=clients;host.send({type:'create',name:'Host'});
  const joined=await host.get('joined');const code=joined.code;
  assert.match(code,/^[A-Z2-9]{5}$/);
  for(let i=0;i<3;i++){rest[i].send({type:'join',code,name:`Member-${i+1}`});await rest[i].get('joined');}
  await host.get('room',m=>m.players.length===4);
  rest[3].send({type:'join',code,name:'Fifth Player'});
  const denied=await rest[3].get('error');assert.match(denied.message,/已滿/);
  host.send({type:'start'});
  const wave=await host.get('wave');assert.equal(wave.wave,1);
  const initial=await host.get('snapshot',m=>m.zombies.length>0);
  assert.equal(initial.players.length,4);assert.ok(initial.remaining>0);
  host.send({type:'move',x:999,z:999,yaw:0,pitch:0});
  await delay(200);
  const latest=host.messages.filter(m=>m.type==='snapshot').at(-1);
  assert.ok(Math.abs(latest.players.find(p=>p.name==='Host').x)<90);
  host.send({type:'shoot'});
  const shot=await host.get('shot',m=>m.by===joined.selfId);assert.ok(shot.from&&shot.to);
  await host.get('snapshot',m=>m.players.some(p=>p.id===joined.selfId&&p.ammo===14));
  host.send({type:'reload'});
  await host.get('snapshot',m=>m.players.some(p=>p.id===joined.selfId&&p.ammo===15),3500);
  host.close();
  await rest[0].get('room',m=>m.hostId!==joined.selfId&&m.players.length===3);
  const health=await (await fetch(`http://127.0.0.1:${PORT}/health`)).json();assert.equal(health.ok,true);
  console.log('PASS: 建立房間、4人連線、拒絕第5人、開局、殭屍波次、位置驗證、射擊、換彈、隊長轉移、健康檢查');
}finally{for(const c of clients)try{c.close();}catch{}server.kill('SIGTERM');}

