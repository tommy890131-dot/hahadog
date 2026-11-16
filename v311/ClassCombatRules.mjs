import {CLASSES} from './gameplay-catalog.mjs';

export const classNames=Object.freeze({
  assault:'突擊兵',medic:'醫療兵',engineer:'工程兵',recon:'偵察兵'
});
export function validClass(classId){return typeof classId==='string'&&Object.hasOwn(CLASSES,classId);}
export function classSkillActive(player,now){
  return validClass(player.classId)&&Number.isFinite(player.skillUntil)&&player.skillUntil>now;
}
export function classShotModifiers(player,now){
  const active=classSkillActive(player,now);
  if(!active)return {damage:1,spread:1,cadence:1,headshot:1};
  if(player.classId==='assault')return {damage:1.2,spread:.85,cadence:.8,headshot:1};
  if(player.classId==='recon')return {damage:1.1,spread:.55,cadence:1,headshot:2};
  return {damage:1,spread:1,cadence:1,headshot:1};
}
