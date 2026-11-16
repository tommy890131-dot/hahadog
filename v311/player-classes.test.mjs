import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CLASSES} from './gameplay-catalog.mjs';
import {classShotModifiers,classSkillActive,classNames,validClass} from './ClassCombatRules.mjs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('all four independently selectable classes exist on authoritative server',()=>{
 assert.deepEqual(Object.keys(CLASSES),['assault','medic','engineer','recon']);
 for(const id of Object.keys(classNames))assert.ok(validClass(id));
 assert.equal(validClass('__proto__'),false);
 assert.equal(validClass('invalid'),false);
 const server=read('server.mjs');
 assert.match(server,/msg\.type==='selectClass'&&room\.phase==='lobby'&&validClass\(msg\.classId\)/);
 assert.match(server,/classId:p\.classId/);
 assert.match(server,/msg\.type==='skill'/);
});
test('assault Q increases firing damage and rate during 10-second active skill',()=>{
 const p={classId:'assault',skillUntil:15000};
 assert.ok(classSkillActive(p,12000));
 assert.deepEqual(classShotModifiers(p,12000),{damage:1.2,spread:.85,cadence:.8,headshot:1});
 assert.deepEqual(classShotModifiers(p,15000),{damage:1,spread:1,cadence:1,headshot:1});
});
test('recon Q boosts marksmanship and headshots rather than empty status effect',()=>{
 const p={classId:'recon',skillUntil:15000};
 assert.deepEqual(classShotModifiers(p,14000),{damage:1.1,spread:.55,cadence:1,headshot:2});
 const server=read('server.mjs');
 assert.match(server,/const buffs=V311\?classShotModifiers\(p,now\)/);
 assert.match(server,/\*buffs\.damage/);
 assert.match(server,/\*buffs\.headshot/);
});
test('medic and engineer retain server-authoritative healing and armor actions',()=>{
 const server=read('server.mjs');
 assert.match(server,/if\(p\.classId==='medic'\)/);
 assert.match(server,/teammate\.hp=Math\.min\(teammate\.maxHp,teammate\.hp\+35\)/);
 assert.match(server,/p\.classId==='engineer'\)p\.armor=Math\.min\(100,p\.armor\+35\)/);
});
test('four original class models are loaded in the multiplayer avatar renderer',()=>{
 const r=read('apps/client/src/world/Teammates.ts');
 for(const id of ['assault','medic','engineer','recon']){
  assert.match(r,new RegExp(id+"'"));
  assert.ok(fs.existsSync(new URL('../apps/client/public/models/players/'+id+'.glb',import.meta.url)),id+' GLB missing');
 }
 assert.match(r,/mergeGeometries\(segments,false\)/);
 assert.match(r,/new THREE\.Mesh\(template\.geometry,template\.material\)/);
 assert.match(r,/this\.loader\.loadAsync\('\/models\/players\//);
 assert.match(r,/remote\.kind!==kind/);
 assert.match(read('apps/client/src/network/Multiplayer.ts'),/classId:'assault'\|'medic'\|'engineer'\|'recon'/);
});
