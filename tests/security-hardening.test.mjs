import {test} from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const PORT=35000+Math.floor(Math.random()*15000);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=10000){const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await sleep(25);}throw Error('timeout');}
const server=spawn(process.execPath,['server.mjs'],{cwd:ROOT,env:{...process.env,PORT:String(PORT),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
let log='';server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);
const clients=[];
class Client {
  constructor(){this.messages=[];this.ws=new WebSocket(`ws://127.0.0.1:${PORT}/ws`);clients.push(this);this.ws.onmessage=e=>this.messages.push(JSON.parse(e.data));}
  async open(){await new Promise((ok,bad)=>{this.ws.addEventListener('open',ok,{once:true});this.ws.addEventListener('error',bad,{once:true});});}
  send(v){this.ws.send(JSON.stringify(v));}
  async take(type,predicate=()=>true,ms=3500){await until(()=>this.messages.some(x=>x.type===type&&predicate(x)),ms);return this.messages.find(x=>x.type===type&&predicate(x));}
  close(){this.ws.close();}
}
async function requestUpgrade(origin){return await new Promise((resolve,reject)=>{
  const sock=net.createConnection({port:PORT,host:'127.0.0.1'});
  const timeout=setTimeout(()=>{sock.destroy();reject(Error('Handshake timeout'));},2500);
  sock.on('connect',()=>sock.write(`GET /ws HTTP/1.1\r\nHost: 127.0.0.1:${PORT}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\nOrigin: ${origin}\r\n\r\n`));
  sock.on('data',data=>{clearTimeout(timeout);sock.destroy();resolve(data.toString().split('\r\n')[0]);});
  sock.on('error',reject);
 });}
test('server security and movement integrations', async t=>{
try {
 await until(async()=>{try{return (await (await fetch(`http://127.0.0.1:${PORT}/health`)).json()).ok;}catch{return false;}});
 await t.test('rejects cross-origin WebSocket, accepts same-origin and native clients',async()=>{
   assert.match(await requestUpgrade('https://malicious.example'),/^HTTP\/1\.1 403/);
   assert.match(await requestUpgrade(`http://127.0.0.1:${PORT}`),/^HTTP\/1\.1 101/);
 });
 await t.test('equipping same weapon cannot bypass server fire cadence',async()=>{
   const c=new Client();await c.open();await c.take('hello');c.send({type:'create',name:'Cadence'});
   await c.take('joined');c.send({type:'start'});await c.take('wave');
   c.send({type:'shoot'});await c.take('shot');
   const n1=c.messages.filter(x=>x.type==='shot').length;
   c.send({type:'equip',weaponId:'p9'});await c.take('shopResult',x=>x.action==='equip');
   c.send({type:'shoot'});await sleep(65);
   assert.equal(c.messages.filter(x=>x.type==='shot').length,n1,'server rejected rapid re-equip shot');
   await sleep(100);c.send({type:'shoot'});await until(()=>c.messages.filter(x=>x.type==='shot').length>n1,2000);
   c.close();
 });
 await t.test('movement budget prohibits sustained client-driven speedhack',async()=>{
   const c=new Client();await c.open();await c.take('hello');c.send({type:'create',name:'SpeedTest'});
   await c.take('joined');c.send({type:'start'});await c.take('wave');
   const start=Date.now();let x=-3;
   for(let i=0;i<18;i++){
     x+=.64;c.send({type:'move',x,z:-2,yaw:0,pitch:0});await sleep(42);
   }
   await sleep(180);
   const snaps=c.messages.filter(x=>x.type==='snapshot');
   const player=snaps.at(-1)?.players.find(p=>p.name==='SpeedTest');
   assert.ok(player, 'authoritative player snapshot exists');
   const elapsed=(Date.now()-start)/1000;
   assert.ok(player.x+3<=7.5*(elapsed+.18)+.01,`server did not allow over-speed (${player.x+3} over ${elapsed}s)`);
   c.close();
 });
 await t.test('client correction and minimap use stable yaw and tunable sensitivity',()=>{
   const mini=fs.readFileSync(new URL('../apps/client/src/world/MapMini.ts',import.meta.url),'utf8');
   const ctl=fs.readFileSync(new URL('../apps/client/src/player/FirstPersonController.ts',import.meta.url),'utf8');
   const main=fs.readFileSync(new URL('../apps/client/src/main.ts',import.meta.url),'utf8');
   assert.match(mini,/ctx\.rotate\(yaw\)/);
   assert.match(ctl,/setLookSensitivity\(/);
   assert.match(ctl,/velocityXZ/);
   assert.match(main,/mouse-sensitivity/);
 });
}finally{
 for(const c of clients)try{c.close();}catch{}
 server.kill('SIGKILL');
}
});
