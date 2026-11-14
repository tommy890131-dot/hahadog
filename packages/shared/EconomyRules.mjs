/** Pure server-side economy rules, intentionally independent of browser/graphics. */
export function splitArmorDamage(hp,armor,damage){
  if(![hp,armor,damage].every(Number.isFinite)||damage<0)throw new Error('Invalid damage inputs');
  const armorDamage=Math.min(Math.max(0,armor),Math.round(damage*.6*100)/100);
  const hpDamage=Math.round((damage-armorDamage)*100)/100;
  return {hp:Math.max(0,Math.round((hp-hpDamage)*100)/100),
    armor:Math.max(0,Math.round((armor-armorDamage)*100)/100),hpDamage,armorDamage};
}
export function gainExperience(level,xp,bonus,maxLevel=50){
  if(!Number.isInteger(level)||level<1||!Number.isFinite(xp)||!Number.isFinite(bonus)||bonus<0)throw new Error('Invalid experience');
  let remaining=xp+bonus,nextLevel=Math.min(maxLevel,level),gained=0;
  while(nextLevel<maxLevel&&remaining>=nextLevel*150){remaining-=nextLevel*150;nextLevel++;gained++;}
  return {level:nextLevel,xp:nextLevel>=maxLevel?0:remaining,levelUps:gained};
}
