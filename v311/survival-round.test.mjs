import test from "node:test";
import assert from "node:assert/strict";
import {
  createRound, enterPlayer, setPlayerState, completeObjective,
  stepRound, computeThreat, chooseEvent, ROUND_PHASE, MISSION_TYPES
} from "./survival-round.mjs";

test("mission selection is seeded and repeatable", () => {
  assert.equal(createRound({seed:42}).mission, createRound({seed:42}).mission);
  assert.ok(MISSION_TYPES.includes(createRound({seed:42}).mission));
});
test("prep cannot be skipped by objective completion", () => {
  const round = createRound({now:100,prepMs:1000});
  enterPlayer(round,"a");
  assert.equal(completeObjective(round),false);
  assert.equal(stepRound(round,1099),ROUND_PHASE.PREP);
  assert.equal(stepRound(round,1100),ROUND_PHASE.OBJECTIVES);
});
test("extraction requires completed objective and every surviving squad member", () => {
  const round = createRound({prepMs:0,extractionMs:5000});
  enterPlayer(round,"a"); enterPlayer(round,"b");
  stepRound(round,0);
  assert.equal(completeObjective(round),true);
  assert.equal(stepRound(round,1),ROUND_PHASE.EXTRACTION);
  setPlayerState(round,"a",{inZone:true});
  assert.equal(stepRound(round,2),ROUND_PHASE.EXTRACTION);
  setPlayerState(round,"b",{inZone:true});
  assert.equal(stepRound(round,3),ROUND_PHASE.WON);
});
test("dead team loses and extraction expiration loses", () => {
  const a=createRound({prepMs:0,extractionMs:1000});
  enterPlayer(a,"p");stepRound(a,0);completeObjective(a);stepRound(a,1);
  assert.equal(stepRound(a,1001),ROUND_PHASE.LOST);
  const b=createRound({prepMs:0});enterPlayer(b,"p");
  setPlayerState(b,"p",{alive:false});
  assert.equal(stepRound(b,0),ROUND_PHASE.LOST);
});
test("server caps players at four", () => {
  const r=createRound();
  for(let i=0;i<4;i++) assert.equal(enterPlayer(r,String(i)),true);
  assert.equal(enterPlayer(r,"extra"),false);
});
test("director obeys hard active-enemy cap and prioritizes relief for weak squads", () => {
  const aggressive=computeThreat({healthRatio:1,ammoRatio:1,progress:1,noise:1,activeEnemies:20,cap:24});
  const weak=computeThreat({healthRatio:0,ammoRatio:0,progress:1,noise:1,activeEnemies:20,cap:24});
  assert.ok(aggressive.spawnBudget<=4);
  assert.ok(weak.intensity < aggressive.intensity);
  assert.equal(computeThreat({activeEnemies:24}).spawnBudget,0);
});
test("events respect cooldown and deterministic seed", () => {
  assert.equal(chooseEvent({cooldownReady:false}),null);
  assert.equal(chooseEvent({seed:5,threat:0.75}),chooseEvent({seed:5,threat:0.75}));
});
test("invalid numeric values rejected",()=>{
  assert.throws(()=>createRound({seed:Infinity}),TypeError);
  assert.throws(()=>computeThreat({cap:0}),RangeError);
});
