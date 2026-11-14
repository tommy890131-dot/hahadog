import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function freePort(){
  const listener=net.createServer();
  await new Promise((resolve,reject)=>{listener.once('error',reject);listener.listen(0,'127.0.0.1',resolve);});
  const port=listener.address().port;
  await new Promise(resolve=>listener.close(resolve));
  return port;
}
test('V3.11 real WebSocket room supports class, mission, and authoritative defense request', {timeout:20000},async()=>{
  const port=await freePort();
  const proc=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',V311_ENABLED:'1',NODE_ENV:'test'},stdio:'ignore'});
  const messages=[];let ws;
  const wait=async fn=>{
    const deadline=Date.now()+7000;
    while(Date.now()<deadline){
      const item=messages.find(fn);if(item)return item;
      await pause(30);
    }
    throw new Error('Timed out: '+JSON.stringify(messages.slice(-12)));
  };
  try{
    let ok=false;
    for(let i=0;i<100;i++){
      try{
        const result=await (await fetch('http://127.0.0.1:'+port+'/health')).json();
        if(result.ok&&result.version==='3.11'){ok=true;break;}
      }catch{}
      await pause(40);
    }
    assert.equal(ok,true,'V3.11 server should be healthy');
    ws=new WebSocket('ws://127.0.0.1:'+port+'/ws');
    ws.addEventListener('message',e=>messages.push(JSON.parse(e.data)));
    await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
    await wait(m=>m.type==='hello');
    ws.send(JSON.stringify({type:'create',name:'V311 Tester'}));
    const joined=await wait(m=>m.type==='joined');
    assert.ok(joined.code);
    ws.send(JSON.stringify({type:'selectClass',classId:'engineer'}));
    const selected=await wait(m=>m.type==='room'&&m.players?.[0]?.classId==='engineer');
    assert.equal(selected.players[0].classId,'engineer');
    ws.send(JSON.stringify({type:'start'}));
    const mission=await wait(m=>m.type==='mission');
    assert.equal(mission.levelId,'lost_district');
    assert.equal(mission.goal,12);
    await wait(m=>m.type==='wave');
    ws.send(JSON.stringify({type:'buildDefense',kind:'barricade'}));
    const build=await wait(m=>m.type==='defenseBuilt'||m.type==='actionResult');
    assert.equal(build.type,'defenseBuilt','Build rejected: '+build.message);
    const shot=await wait(m=>m.type==='snapshot'&&m.defenses?.length>0);
    assert.equal(shot.defenses[0].kind,'barricade');
    ws.send(JSON.stringify({type:'collectLoot',id:-12345}));
    ws.send(JSON.stringify({type:'skill'}));
    const skill=await wait(m=>m.type==='skillUsed');
    assert.equal(skill.classId,'engineer');
  }finally{
    try{ws?.close();}catch{}
    proc.kill('SIGTERM');
    await Promise.race([new Promise(resolve=>proc.once('exit',resolve)),pause(3500)]);
    if(proc.exitCode===null)proc.kill('SIGKILL');
  }
});
