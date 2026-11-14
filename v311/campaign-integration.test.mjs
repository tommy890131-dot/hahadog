import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const nextPort=async()=>{
  const listener=net.createServer();
  await new Promise((resolve,reject)=>listener.once('error',reject).listen(0,'127.0.0.1',resolve));
  const port=listener.address().port;
  await new Promise(resolve=>listener.close(resolve));
  return port;
};
function client(url){
  const ws=new WebSocket(url),events=[],pending=[];
  ws.addEventListener('message',event=>{
    const message=JSON.parse(event.data);
    events.push(message);
    for(let i=pending.length-1;i>=0;i--)if(pending[i].matches(message)){
      const p=pending.splice(i,1)[0];clearTimeout(p.timer);p.resolve(message);
    }
  });
  const opened=new Promise((resolve,reject)=>{
    ws.addEventListener('open',resolve,{once:true});
    ws.addEventListener('error',reject,{once:true});
  });
  return {
    ws,events,opened,
    send(message){ws.send(JSON.stringify(message));},
    async receive(matches,timeout=6000){
      const match=events.find(matches);
      if(match)return match;
      return new Promise((resolve,reject)=>{
        const item={matches,resolve,timer:setTimeout(()=>{
          pending.splice(pending.indexOf(item),1);
          reject(new Error('Timed out waiting for event, recent: '+JSON.stringify(events.slice(-8))));
        },timeout)};
        pending.push(item);
      });
    },
    clear(){events.length=0;}
  };
}
test('two players sync loss/retry, victory/next, final restart and reject non-host commands', {timeout:25000},async()=>{
  const port=await nextPort();
  const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),
    env:{...process.env,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'test',V311_ENABLED:'1',
      TEST_CAMPAIGN_CONTROL:'1',GAME_MAX_ROOMS:'2',GAME_MAX_ZOMBIES:'24'},stdio:'ignore'});
  let a,b;
  try{
    let ready=false;
    for(let i=0;i<120;i++){
      try{const r=await (await fetch('http://127.0.0.1:'+port+'/health')).json();if(r.version==='3.11'){ready=true;break;}}
      catch{}
      await wait(50);
    }
    assert.equal(ready,true,'server ready');
    a=client('ws://127.0.0.1:'+port+'/ws');
    b=client('ws://127.0.0.1:'+port+'/ws');
    await Promise.all([a.opened,b.opened]);
    await Promise.all([a.receive(m=>m.type==='hello'),b.receive(m=>m.type==='hello')]);
    a.send({type:'create',name:'房主'});
    const joined=await a.receive(m=>m.type==='joined');
    b.send({type:'join',name:'隊友',code:joined.code});
    await b.receive(m=>m.type==='joined');
    a.clear();b.clear();
    a.send({type:'start'});
    await Promise.all([a.receive(m=>m.type==='campaignStart'&&m.levelIndex===0),
      b.receive(m=>m.type==='campaignStart'&&m.levelIndex===0)]);
    await Promise.all([a.receive(m=>m.type==='wave'),b.receive(m=>m.type==='wave')]);
    b.clear();
    b.send({type:'nextLevel'});
    await b.receive(m=>m.type==='error');
    a.clear();b.clear();
    a.send({type:'testCampaignResult',result:'lost'});
    await Promise.all([a.receive(m=>m.type==='missionEnd'&&m.result==='lost'),
      b.receive(m=>m.type==='missionEnd'&&m.result==='lost')]);
    a.clear();b.clear();
    b.send({type:'retryLevel'});
    await b.receive(m=>m.type==='error');
    a.send({type:'retryLevel'});
    await Promise.all([a.receive(m=>m.type==='campaignStart'&&m.levelIndex===0),
      b.receive(m=>m.type==='campaignStart'&&m.levelIndex===0)]);
    for(let level=0;level<4;level++){
      await Promise.all([a.receive(m=>m.type==='wave'),b.receive(m=>m.type==='wave')]);
      a.clear();b.clear();
      a.send({type:'testCampaignResult',result:'won'});
      const [resultA,resultB]=await Promise.all([
        a.receive(m=>m.type==='missionEnd'&&m.result==='won'),
        b.receive(m=>m.type==='missionEnd'&&m.result==='won')
      ]);
      assert.equal(resultA.levelIndex,level);
      assert.equal(resultB.levelIndex,level);
      a.clear();b.clear();
      if(level<3){
        a.send({type:'nextLevel'});
        const [stageA,stageB]=await Promise.all([
          a.receive(m=>m.type==='campaignStart'&&m.levelIndex===level+1),
          b.receive(m=>m.type==='campaignStart'&&m.levelIndex===level+1)
        ]);
        assert.ok(stageA.goal>12);
        assert.equal(stageA.levelId,stageB.levelId);
      }else{
        a.send({type:'nextLevel'});
        await a.receive(m=>m.type==='error');
        a.send({type:'restartCampaign'});
        await Promise.all([a.receive(m=>m.type==='campaignStart'&&m.levelIndex===0),
          b.receive(m=>m.type==='campaignStart'&&m.levelIndex===0)]);
      }
    }
  }finally{
    try{a?.ws.close();b?.ws.close();}catch{}
    child.kill('SIGTERM');
    await Promise.race([new Promise(resolve=>child.once('exit',resolve)),wait(2000)]);
    if(child.exitCode===null)child.kill('SIGKILL');
  }
});
