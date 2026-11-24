/**
 * DEADLINE FOUR V3.11 data contracts (not yet connected to the archived V3.9.2 game).
 * Each mission objective is validated on the authoritative server; clients only render.
 */
export const CLASSES = Object.freeze({
  assault: { label: "突擊兵", primary: ["assault_rifle","shotgun"], skill: "suppressive_fire", cooldownMs: 45000 },
  medic: { label: "醫療兵", primary: ["smg"], skill: "combat_revive", cooldownMs: 60000 },
  engineer: { label: "工程兵", primary: ["carbine","shotgun"], skill: "rapid_build", cooldownMs: 50000 },
  recon: { label: "偵察兵", primary: ["sniper_rifle"], skill: "weakpoint_mark", cooldownMs: 40000 },
});
export const LEVELS = Object.freeze([
  {id:"lost_district",label:"失聯街區",objectives:["supply_1","supply_2","supply_3","radio_repair"], extraction:"roof", boss:null},
  {id:"abandoned_hospital",label:"地下捷運・斷線終點站",objectives:["restore_platform_power","activate_train","repel_horde"],extraction:"armored_train",boss:"tunnel_mutant"},
  {id:"industrial_lockdown",label:"工業封鎖區",objectives:["generator_repair","fortify_factory"],extraction:"loading_dock",boss:"armored_brute"},
  {id:"last_stand",label:"最後防線",objectives:["enter_bunker","recover_code","defeat_boss"],extraction:"helipad",boss:"alpha_mutant"},
]);
export const WEAPONS = Object.freeze({
  sniper_rifle: {
    type: "sniper", displayName:"精準狙擊槍",
    magazine:5, reloadMs:2600, fireIntervalMs:1200,
    zoomSteps:[4,8], headshotMultiplier:2.5,
    // Actual weapon damage / server hit validation must be adapted to current combat rules.
  }
});
export function validateClassSelection(classId, weaponId) {
  return Object.hasOwn(CLASSES,classId) && CLASSES[classId].primary.includes(weaponId);
}
export function getLevel(levelId) {
  return LEVELS.find(level=>level.id===levelId) ?? null;
}
