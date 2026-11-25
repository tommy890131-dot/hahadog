import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function port(){
  const s=net.createServer();
  await new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,'127.0.0.1',resolve);});
  const p=s.address().port;
  await new Promise(r=>s.close(r));return p;
}
function peer(url){
  const ws=new WebSocket(url),messages=[];
  ws.addEventListener('message',evt=>messages.push(JSON.parse(evt.data)));
  const open=new Promise((resolve,reject)=>{
    ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});
  });
  return {ws,open,messages,send:x=>ws.send(JSON.stringify(x)),
    async expect(predicate,timeout=5000){
      const end=Date.now()+timeout;
      while(Date.now()<end){const item=messages.find(predicate);if(item)return item;await sleep(25);}
      throw Error('No matching event. Latest '+JSON.stringify(messages.slice(-6)));
    }
  };
}
test('live four-player server supports host-selected subway, distinct map snapshots, collision and next chapter', {timeout:28000},async()=>{
  const bind=await port();
  const proc=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{
    ...process.env,PORT:String(bind),HOST:'127.0.0.1',NODE_ENV:'test',V311_ENABLED:'1',
    TEST_CAMPAIGN_CONTROL:'1',GAME_MAX_ROOMS:'2',GAME_MAX_ZOMBIES:'24'
  },stdio:'ignore'});
  let a,b;
  try{
    let ready=false;for(let i=0;i<150;i++){try{
      const r=await (await fetch('http://127.0.0.1:'+bind+'/health')).json();
      if(r.ok&&r.version==='3.11'){ready=true;break;}
    }catch{}await sleep(50);}
    assert.equal(ready,true,'server starts with both maps');
    a=peer('ws://127.0.0.1:'+bind+'/ws');b=peer('ws://127.0.0.1:'+bind+'/ws');
    await Promise.all([a.open,b.open]);
    await Promise.all([a.expect(m=>m.type==='hello'),b.expect(m=>m.type==='hello')]);
    a.send({type:'create',name:'隊長'});const joined=await a.expect(m=>m.type==='joined');
    b.send({type:'join',name:'隊友',code:joined.code});await b.expect(m=>m.type==='joined');
    b.send({type:'selectMap',mapId:'underground_metro'});
    await b.expect(m=>m.type==='error'&&m.message.includes('隊長'));
    a.send({type:'selectMap',mapId:'underground_metro'});
    await Promise.all([a.expect(m=>m.type==='room'&&m.mapId==='underground_metro'),
      b.expect(m=>m.type==='room'&&m.mapId==='underground_metro')]);
    a.send({type:'start'});
    await Promise.all([a.expect(m=>m.type==='campaignStart'&&m.mapId==='underground_metro'),
      b.expect(m=>m.type==='campaignStart'&&m.mapId==='underground_metro')]);
    const snapshot=await a.expect(m=>m.type==='snapshot'&&m.mapId==='underground_metro');
    assert.equal(snapshot.players.length,2);
    assert.ok(snapshot.players[0].x<-60,'actual metro team spawn');
    // Cannot activate train switch remotely from subway entry.
    a.send({type:'interactWorld',id:'metroTrain'});
    const blocked=await a.expect(m=>m.type==='environmentAction');
    assert.equal(blocked.ok,false);
    // A finished chapter can progress without dropping players or cross-map gear.
    a.send({type:'testCampaignResult',result:'won'});
    await a.expect(m=>m.type==='missionEnd'&&m.success===true&&m.mapId==='underground_metro');
    a.send({type:'nextLevel'});
    await Promise.all([a.expect(m=>m.type==='campaignStart'&&m.levelIndex===2&&m.mapId==='infected_hospital'),
      b.expect(m=>m.type==='campaignStart'&&m.levelIndex===2&&m.mapId==='infected_hospital')]);
    const hospital=await a.expect(m=>m.type==='snapshot'&&m.mapId==='infected_hospital'&&m.wave===1);
    assert.equal(hospital.players.length,2,'same team survives transition');
    assert.ok(hospital.players.every(p=>p.x<-60),'players enter hospital safehouse');
    a.send({type:'testCampaignResult',result:'won'});
    await a.expect(m=>m.type==='missionEnd'&&m.levelIndex===2&&m.success===true);
    a.send({type:'nextLevel'});
    await Promise.all([a.expect(m=>m.type==='campaignStart'&&m.levelIndex===3&&m.mapId==='doomed_harbor'),
      b.expect(m=>m.type==='campaignStart'&&m.levelIndex===3&&m.mapId==='doomed_harbor')]);
    const port=await a.expect(m=>m.type==='snapshot'&&m.mapId==='doomed_harbor'&&m.wave===1);
    assert.equal(port.players.length,2);
    assert.ok(port.players.every(p=>p.x<-60),'same team enters harbor safehouse');
  }finally{
    try{a?.ws.close();b?.ws.close();}catch{}
    proc.kill('SIGTERM');
    await Promise.race([new Promise(r=>proc.once('exit',r)),sleep(2200)]);
    if(proc.exitCode===null)proc.kill('SIGKILL');
  }
});
