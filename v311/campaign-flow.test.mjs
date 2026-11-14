import test from 'node:test';
import assert from 'node:assert/strict';
import {STAGE_RULES,stageAt,allowedCampaignAction,nextStageIndex,LAST_LEVEL} from './campaign-flow.mjs';

test('four chapters progress with increasing objective count and boss difficulty',()=>{
 assert.equal(STAGE_RULES.length,4);
 assert.deepEqual([0,1,2,3].map(i=>stageAt(i).id),[
  'lost_district','abandoned_hospital','industrial_lockdown','last_stand']);
 assert.deepEqual([0,1,2,3].map(i=>stageAt(i).goal),[12,16,20,24]);
 assert.ok(stageAt(3).bossHp>stageAt(0).bossHp);
 assert.throws(()=>stageAt(-1),RangeError);
 assert.throws(()=>stageAt(4),RangeError);
});
test('only host can retry failed chapter',()=>{
 for(const index of [0,1,2,3]){
  assert.equal(allowedCampaignAction({phase:'ended',result:'lost',index,action:'retryLevel',isHost:true}),true);
  assert.equal(nextStageIndex(index,'retryLevel'),index);
  assert.equal(allowedCampaignAction({phase:'ended',result:'lost',index,action:'nextLevel',isHost:true}),false);
  assert.equal(allowedCampaignAction({phase:'playing',result:'lost',index,action:'retryLevel',isHost:true}),false);
  assert.equal(allowedCampaignAction({phase:'ended',result:'lost',index,action:'retryLevel',isHost:false}),false);
 }
});
test('winning unlocks next chapter through stage 4; final win restarts campaign',()=>{
 for(let i=0;i<LAST_LEVEL;i++){
  assert.equal(allowedCampaignAction({phase:'ended',result:'won',index:i,action:'nextLevel',isHost:true}),true);
  assert.equal(nextStageIndex(i,'nextLevel'),i+1);
  assert.equal(allowedCampaignAction({phase:'ended',result:'won',index:i,action:'retryLevel',isHost:true}),false);
  assert.equal(allowedCampaignAction({phase:'ended',result:'won',index:i,action:'nextLevel',isHost:false}),false);
 }
 assert.equal(allowedCampaignAction({phase:'ended',result:'won',index:LAST_LEVEL,action:'nextLevel',isHost:true}),false);
 assert.equal(allowedCampaignAction({phase:'ended',result:'won',index:LAST_LEVEL,action:'restartCampaign',isHost:true}),true);
 assert.equal(nextStageIndex(LAST_LEVEL,'restartCampaign'),0);
});
