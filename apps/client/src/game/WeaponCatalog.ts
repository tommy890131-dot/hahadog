import rawWeapons from '../../../../packages/shared/WeaponConfig.json';

export type WeaponCategory='pistol'|'smg'|'ar'|'lmg';
export type WeaponId=keyof typeof rawWeapons;
export type WeaponSpec={
  name:string;category:WeaponCategory;price:number;damage:number;rpm:number;
  magazine:number;reserve:number;recoil:number;reloadMs:number;penetration:number;
  speedPenalty:number;spread:number;falloffStart:number;falloffEnd:number;
  minFactor:number;knockback:number;automatic:boolean;
};
export const WEAPONS=rawWeapons as Record<WeaponId,WeaponSpec>;
export const WEAPON_IDS=Object.keys(WEAPONS) as WeaponId[];
export const isWeaponId=(id:unknown):id is WeaponId=>
  typeof id==='string' && Object.prototype.hasOwnProperty.call(WEAPONS,id);
export const effectiveReloadMs=(w:WeaponSpec,level:number)=>
  Math.round(w.reloadMs*(1-Math.min(.2,Math.max(0,level-1)*.02)));
export const toTuning=(id:WeaponId,level=1)=>{
  const w=WEAPONS[id];
  return {
    id,modelPath:`/assets/weapons/${id}.glb`,magazineSize:w.magazine,
    initialReserve:w.reserve,shotIntervalMs:60000/w.rpm,
    reloadMs:effectiveReloadMs(w,level),recoilKick:.06+w.recoil*.12,
    automatic:w.automatic,unlimitedReserve:w.category==='pistol'
  };
};
