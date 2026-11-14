// DEADLINE FOUR V3.11 — server-authoritative combat extras.
// Pure calculations; callers supply authoritative positions and deterministic seeds.
export const SPECIALS=Object.freeze({
  screamer:{hp:85,speed:3.0,damage:7,intervalMs:9000},
  spitter:{hp:110,speed:2.3,damage:12,intervalMs:5000},
  climber:{hp:75,speed:4.6,damage:12,intervalMs:0},
  juggernaut:{hp:330,speed:1.45,damage:27,intervalMs:0},
  boss:{hp:1550,speed:1.7,damage:34,intervalMs:6000},
});
export const DEFENSES=Object.freeze({
  barricade:{cost:250,hp:220,range:0,damage:0,intervalMs:0},
  turret:{cost:700,hp:140,range:19,damage:22,intervalMs:450},
});
export const RARITIES=Object.freeze({
  common:{chance:0.70,credits:90},
  uncommon:{chance:0.22,credits:220},
  rare:{chance:0.07,credits:480},
  legendary:{chance:0.01,credits:1000},
});
const clamp=(x,low,high)=>Math.min(high,Math.max(low,x));
export function distance(a,b){return Math.hypot(a.x-b.x,a.z-b.z,a.y-b.y);}
export function chooseSpecial(seed,level=1){
  const n=(Math.trunc(seed)>>>0)%100;
  if(level>=3&&n<7)return 'juggernaut';
  if(n<24)return 'screamer';
  if(n<48)return 'spitter';
  if(n<72)return 'climber';
  return 'walker';
}
export function bossPhase(remaining,max=1550){
  if(!Number.isFinite(remaining)||!Number.isFinite(max)||max<=0)throw new RangeError('boss health');
  const ratio=clamp(remaining/max,0,1);
  return ratio>.66?1:ratio>.33?2:3;
}
export function lootRarity(roll){
  if(!Number.isFinite(roll)||roll<0||roll>=1)throw new RangeError('loot roll');
  if(roll<.01)return 'legendary';
  if(roll<.08)return 'rare';
  if(roll<.30)return 'uncommon';
  return 'common';
}
export function validPlacement({player,position,existing=[],kind,credits,solidAt,maxItems=8}){
  const spec=DEFENSES[kind];
  if(!spec)return {ok:false,reason:'unknown defense'};
  if(!Number.isFinite(credits)||credits<spec.cost)return {ok:false,reason:'insufficient credits'};
  if(!position||![position.x,position.z,position.y].every(Number.isFinite))
    return {ok:false,reason:'invalid position'};
  if(distance(player,position)>5||Math.abs(position.y-player.y)>1.1)
    return {ok:false,reason:'too far'};
  if(existing.length>=maxItems)return {ok:false,reason:'defense limit'};
  if(existing.some(d=>distance(d,position)<2.5))return {ok:false,reason:'overlapping defense'};
  if(solidAt(position))return {ok:false,reason:'blocked position'};
  return {ok:true,reason:'ok',cost:spec.cost};
}
export function claimLoot({player,item,range=2.5}){
  if(!item||item.claimed)return false;
  return distance(player,item)<=range;
}
export function canTurretShoot(defense,zombie,now){
  return defense.kind==='turret'&&defense.hp>0&&zombie.hp>0
    &&distance(defense,zombie)<=DEFENSES.turret.range&&now>=(defense.nextShotAt||0);
}
export function nextEvent(seed,threat){
  const high=['horde','blackout','supply_drop'];
  const low=['supply_drop','fog','radio_signal'];
  return (threat>=.55?high:low)[(Math.trunc(seed)>>>0)%3];
}
