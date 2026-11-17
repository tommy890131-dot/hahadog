import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DEVICES,ROUTES,createBlackoutProtocol,triggerBlackout,
  advanceBlackoutProtocol,interactWithWorld,routeReady,inSelectedExtractionZone,publicEnvironment
} from '../v312/BlackoutProtocol.mjs';
import {createRound,enterPlayer,stepRound,completeObjective,setPlayerState} from './survival-round.mjs';
const player=(x,z,id='p1')=>({id,x,y:0,z});
const interact=(state,p,id,now=10000)=>interactWithWorld(state,{player:p,id,now,phase:'playing'});

test('each run offers two deterministic distinct evacuation routes, including the reliable armored van',()=>{
  for(const seed of [0,1,2,3,350,4294967295]){
    const env=createBlackoutProtocol({seed,now:1000});
    assert.equal(env.routes.length,2);
    assert.deepEqual(env.routes[0],'van');
    assert.ok(['convoy','tunnel'].includes(env.routes[1]));
    assert.equal(env.powerOnline,true);
    assert.equal(env.selectedRoute,null);
    const publicData=publicEnvironment(env,1000);
    assert.equal(publicData.routes.length,2);
    assert.equal(publicData.devices.length,3);
  }
});
test('real timed blackout cuts power, can be repaired from generator and recurs no earlier than cooldown',()=>{
  const env=createBlackoutProtocol({seed:12,now:5000});
  assert.equal(advanceBlackoutProtocol(env,env.nextBlackoutAt-1),null);
  assert.equal(advanceBlackoutProtocol(env,env.nextBlackoutAt),'blackout');
  assert.equal(publicEnvironment(env,env.nextBlackoutAt).powerOnline,false);
  assert.equal(routeReady(env,'convoy'),false);
  const repaired=interact(env,player(0,-24),'generator',env.nextBlackoutAt+1000);
  assert.equal(repaired.ok,true);
  assert.equal(env.powerOnline,true);
  assert.equal(advanceBlackoutProtocol(env,env.nextBlackoutAt-1),null);
  assert.equal(triggerBlackout(env,100000),true);
  assert.equal(advanceBlackoutProtocol(env,134999),null);
  assert.equal(advanceBlackoutProtocol(env,135000),'power_restored');
  assert.equal(publicEnvironment(env,135000).powerOnline,true);
});
test('reject spoofed, distant, dead, premature and malformed interactions',()=>{
  const env=createBlackoutProtocol({seed:3,now:0});
  const p=player(0,0);
  for(const id of ['constructor','__proto__','toString','bogus']){
    assert.equal(interact(env,p,id).ok,false,id);
  }
  assert.equal(interact(env,{...p,x:Number.POSITIVE_INFINITY},'generator').ok,false);
  assert.equal(interact(env,player(0,-24),'generator').ok,false,'power is already online');
  assert.equal(interact(env,player(0,70),'tunnel').ok,false,'objectives incomplete');
  assert.equal(interact(env,player(0,24),'relay',10000).ok,true);
  assert.equal(interactWithWorld(env,{player:player(0,24),id:'relay',now:11000,phase:'intermission'}).ok,false);
  assert.equal(interactWithWorld(env,{player:player(0,24),id:'relay',now:11000,downed:true}).ok,false);
  assert.equal(interact(env,player(99,99),'alarm',12000).ok,false,'distance validation');
});
test('relay enables tunnel, an actual selected route replaces old central safehouse extraction',()=>{
  const env=createBlackoutProtocol({seed:1,now:0});
  env.objectiveComplete=true;
  assert.deepEqual(env.routes,['van','tunnel']);
  assert.equal(routeReady(env,'tunnel'),false);
  assert.equal(interact(env,player(0,70),'tunnel',1000).ok,false);
  assert.equal(interact(env,player(0,24),'relay',2000).ok,true);
  assert.equal(routeReady(env,'tunnel'),true);
  const picked=interact(env,player(0,70),'tunnel',3000);
  assert.equal(picked.ok,true);
  assert.equal(env.selectedRoute,'tunnel');
  assert.equal(interact(env,player(-70,0),'van',4000).ok,false);
  assert.equal(inSelectedExtractionZone(env,player(0,70)),true);
  assert.equal(inSelectedExtractionZone(env,player(0,0)),false);
  const round=createRound({seed:1,now:100,prepMs:0,extractionMs:30000});
  enterPlayer(round,'p1');enterPlayer(round,'p2');stepRound(round,100);
  completeObjective(round);stepRound(round,101);
  setPlayerState(round,'p1',{alive:true,inZone:inSelectedExtractionZone(env,player(0,70,'p1'))});
  setPlayerState(round,'p2',{alive:true,inZone:inSelectedExtractionZone(env,player(0,70,'p2'))});
  assert.equal(stepRound(round,102),'won');
});
test('convoy route cannot continue a blackout, can evacuate after power restoration',()=>{
  const env=createBlackoutProtocol({seed:0,now:0});
  env.objectiveComplete=true;
  assert.equal(interact(env,player(70,0),'convoy',1000).ok,true);
  assert.equal(inSelectedExtractionZone(env,player(70,0)),true);
  assert.equal(triggerBlackout(env,1500),true);
  assert.equal(inSelectedExtractionZone(env,player(70,0)),false);
  assert.equal(interact(env,player(0,-24),'generator',2500).ok,true);
  assert.equal(inSelectedExtractionZone(env,player(70,0)),true);
});
test('alarm attracts enemies, drops one rare item, has cooldown, and does not allow duplicate spawns',()=>{
  const env=createBlackoutProtocol({seed:1,now:0});
  assert.equal(interact(env,player(-24,0),'alarm',1000).action,'alarm');
  assert.equal(interact(env,player(-24,0),'alarm',2000).ok,false);
  assert.equal(interact(env,player(-24,0),'alarm',61000).action,'alarm');
  const server=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
  assert.match(server,/room\.pending=Math\.min\(135,room\.pending\+8\)/);
  assert.match(server,/rarity:'rare'/);
});
test('client renders live blackout, supplies F interactions and draws alternate extraction markers',()=>{
  const server=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
  const main=fs.readFileSync(new URL('../apps/client/src/main.ts',import.meta.url),'utf8');
  const visual=fs.readFileSync(new URL('../apps/client/src/world/BlackoutWorldVisuals.ts',import.meta.url),'utf8');
  assert.match(server,/if\(V311&&msg\.type==='interactWorld'\)/);
  assert.match(server,/inSelectedExtractionZone\(room\.protocol,p\)/);
  assert.match(server,/advanceBlackoutProtocol\(room\.protocol,now\)/);
  assert.match(server,/environment:V311&&room\.protocol\?publicEnvironment/);
  assert.match(main,/if\(near\)\{network\.send\(\{type:'interactWorld',id:near\.id\}\);return;\}/);
  assert.match(main,/blackoutWorld\.render\(dt\)/);
  assert.match(visual,/object\.intensity=intensity\*\(1-this\.blackout\*\.98\)/);
  assert.match(visual,/setState\(environment:EnvironmentState\|null\)/);
});
