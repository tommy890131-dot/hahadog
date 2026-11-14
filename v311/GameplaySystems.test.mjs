import test from 'node:test';
import assert from 'node:assert/strict';
import {SPECIALS,DEFENSES,bossPhase,chooseSpecial,lootRarity,validPlacement,claimLoot,canTurretShoot,nextEvent} from './GameplaySystems.mjs';
test('all specials and boss have bounded values and boss gets stronger in phases',()=>{
 assert.deepEqual(Object.keys(SPECIALS),['screamer','spitter','climber','juggernaut','boss']);
 assert.equal(bossPhase(1500),1);assert.equal(bossPhase(800),2);assert.equal(bossPhase(100),3);
 assert.throws(()=>bossPhase(1,0),RangeError);
 for(const x of Object.values(SPECIALS))assert.ok(x.hp>0&&x.speed>0);
});
test('special selection uses a reproducible seeded roll',()=>{
 assert.equal(chooseSpecial(1),chooseSpecial(1));
 assert.equal(chooseSpecial(4,3),'juggernaut');
 assert.equal(chooseSpecial(4,1),'screamer');
});
test('loot rarities and rolls are complete, deterministic and validated',()=>{
 assert.equal(lootRarity(0),'legendary');
 assert.equal(lootRarity(.04),'rare');
 assert.equal(lootRarity(.15),'uncommon');
 assert.equal(lootRarity(.9),'common');
 assert.throws(()=>lootRarity(1),RangeError);
});
test('placement rejects client spoofed distance, overlapping, cost and solid walls',()=>{
 const player={x:0,y:0,z:0},position={x:2,y:0,z:0};
 const valid={player,position,existing:[],credits:1000,kind:'turret',solidAt:()=>false};
 assert.deepEqual(validPlacement(valid),{ok:true,reason:'ok',cost:DEFENSES.turret.cost});
 assert.equal(validPlacement({...valid,credits:1}).ok,false);
 assert.equal(validPlacement({...valid,position:{x:99,y:0,z:0}}).ok,false);
 assert.equal(validPlacement({...valid,existing:[{x:2,y:0,z:0}]}).ok,false);
 assert.equal(validPlacement({...valid,solidAt:()=>true}).ok,false);
 assert.equal(validPlacement({...valid,existing:Array(8).fill({x:90,y:0,z:0})}).ok,false);
});
test('loot claiming is proximity and ownership gated, turrets respect cooldown',()=>{
 const p={x:0,y:0,z:0},drop={x:2,y:0,z:0,claimed:false};
 assert.equal(claimLoot({player:p,item:drop}),true);
 assert.equal(claimLoot({player:p,item:{...drop,x:4}}),false);
 assert.equal(claimLoot({player:p,item:{...drop,claimed:true}}),false);
 const turret={x:0,y:0,z:0,hp:50,kind:'turret',nextShotAt:100};
 assert.equal(canTurretShoot(turret,{x:5,y:0,z:0,hp:50},150),true);
 assert.equal(canTurretShoot(turret,{x:5,y:0,z:0,hp:50},90),false);
});
test('director events depend on threat and seeded roll',()=>{
 assert.equal(nextEvent(1,.1),'fog');
 assert.equal(nextEvent(1,.9),'blackout');
});
