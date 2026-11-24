// DEADLINE FOUR V3.11: authoritative, four-stage campaign progression.
// Stages share the existing city geometry for now, but vary missions,
// zombie intensity and boss difficulty. Client cannot assign a level.
import {LEVELS} from './gameplay-catalog.mjs';
export const STAGE_RULES=Object.freeze([
  Object.freeze({goal:12,bossAt:8,bossHp:1550,extraEnemies:0,extractionMs:90000,
    objective:'清除感染者並修復撤離通訊'}),
  Object.freeze({goal:16,bossAt:10,bossHp:1900,extraEnemies:8,extractionMs:85000,
    objective:'恢復月台電力、啟動列車並抵擋隧道感染者'}),
  Object.freeze({goal:20,bossAt:12,bossHp:2400,extraEnemies:14,extractionMs:80000,
    objective:'守住工業設施並擊敗重甲異變體'}),
  Object.freeze({goal:24,bossAt:15,bossHp:3000,extraEnemies:20,extractionMs:75000,
    objective:'突破最後封鎖，擊敗終極變異體'}),
]);
export const LAST_LEVEL=LEVELS.length-1;
if(STAGE_RULES.length!==LEVELS.length)throw new Error('Campaign stage count mismatch');

export function stageAt(index){
  if(!Number.isSafeInteger(index)||index<0||index>=LEVELS.length)throw new RangeError('Invalid stage');
  return Object.freeze({...LEVELS[index],...STAGE_RULES[index],index});
}
export function allowedCampaignAction({phase,result,index,action,isHost}){
  if(!isHost)return false;
  if(action==='start')return phase==='lobby';
  if(phase!=='ended')return false;
  if(action==='retryLevel')return result==='lost';
  if(action==='nextLevel')return result==='won'&&Number.isInteger(index)&&index<LAST_LEVEL;
  if(action==='restartCampaign')return result==='won'&&index===LAST_LEVEL;
  return false;
}
export function nextStageIndex(index,action){
  if(action==='restartCampaign')return 0;
  if(action==='nextLevel'&&index<LAST_LEVEL)return index+1;
  return index;
}
