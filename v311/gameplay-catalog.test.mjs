import test from "node:test";
import assert from "node:assert/strict";
import { CLASSES, LEVELS, WEAPONS, validateClassSelection, getLevel } from "./gameplay-catalog.mjs";
test("four complementary professions defined",()=>{
 assert.deepEqual(Object.keys(CLASSES),["assault","medic","engineer","recon"]);
 for(const v of Object.values(CLASSES)){ assert.ok(v.cooldownMs>0); assert.ok(v.primary.length>0); }
});
test("sniper is recon primary and scope supports 4x 8x",()=>{
 assert.equal(validateClassSelection("recon","sniper_rifle"),true);
 assert.equal(validateClassSelection("medic","sniper_rifle"),false);
 assert.deepEqual(WEAPONS.sniper_rifle.zoomSteps,[4,8]);
 assert.ok(WEAPONS.sniper_rifle.headshotMultiplier>1);
});
test("all four levels have objectives and extraction zones",()=>{
 assert.equal(LEVELS.length,4);
 for(const level of LEVELS){
  assert.ok(level.objectives.length>0);
  assert.ok(level.extraction);
  assert.equal(getLevel(level.id)?.id,level.id);
 }
 assert.equal(getLevel("does_not_exist"),null);
});
