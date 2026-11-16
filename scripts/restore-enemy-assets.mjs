// Restore verified original GLB binary assets from text-only GitHub transport.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const directory='apps/client/public/models/enemies';
const hashes={
  walker:'c23eeca2bc6a3cb924f525c3f86d9dcb1238e034d064e6709ed564c701903226',
  runner:'30b52e51cb327f3be4d3556a6e632d800e1f0f18464f1d1b948b12fc002eb181',
  brute:'ef5a187d7c98161442d76d43d293484b18e6292a89916713707e58fb6941abb9',
  spitter:'09e96c5b2f37d66f40af5d91d4b4dc31ce94b674817876590d80825dbda592ab',
  boss:'69f8a4b01068071faa65d0d44be6cce5648218f1217696f2a4083b8565c14243',
  'walker-rig':'6c6839e151d7ad35a7f3cc55afd9fec784dc196f7c4affa828e3315e072cf1dd',
  'runner-rig':'9845d2eee2046ff68dc9ac35c85ebcf9cf8cd6f331b9adf2783aa78b1dd8cb09',
  'brute-rig':'873fbdba880d9d5861302521355153580ca4c897120032e55e553ae79d1d7a29',
  'spitter-rig':'3b9b9e6121af5b835f123176e68648c254e98426cb94cd0ddd2a1c9347f84599'
};
let total=0;
for(const [type,expected] of Object.entries(hashes)){
  const encoded=fs.readFileSync(path.join(directory,type+'.glb.b64.txt'),'utf8').replace(/\s+/g,'');
  const data=Buffer.from(encoded,'base64');
  if(data.toString('ascii',0,4)!=='glTF'||data.readUInt32LE(8)!==data.length)throw Error('Invalid GLB '+type);
  const actual=crypto.createHash('sha256').update(data).digest('hex');
  if(actual!==expected)throw Error('GLB integrity mismatch: '+type);
  fs.writeFileSync(path.join(directory,type+'.glb'),data);
  total+=data.length;
  console.log('[Enemies] verified '+type+'.glb '+data.length+' bytes');
}
console.log('[Enemies] loaded original H17/Tyrant assets: '+total+' bytes');
