import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import net from 'node:net';
const root=fileURLToPath(new URL('../',import.meta.url));
const get=(p)=>readFileSync(join(root,p),'utf8');
function findPort(){return new Promise((resolve,reject)=>{
  const socket=net.createServer();socket.once('error',reject);
  socket.listen(0,'127.0.0.1',()=>{const port=socket.address().port;socket.close(()=>resolve(port));});
});}
async function awaitHealth(port){
  for(let i=0;i<100;i++){
    try {const r=await fetch(`http://127.0.0.1:${port}/health`);if(r.ok)return await r.json();}catch{}
    await new Promise(r=>setTimeout(r,80));
  }
  throw Error('Server did not start');
}
test('Render Blueprint uses one free Singapore Web Service and validates output',()=>{
  const y=get('render.yaml');
  for(const required of ['type: web','runtime: node','region: singapore','plan: free','buildCommand: bash scripts/render-build.sh','startCommand: npm start','healthCheckPath: /health'])assert.ok(y.includes(required),required);
  assert.ok(!y.includes('repo:'),'Blueprint must use its containing repository');
  const build=get('scripts/render-build.sh');
  assert.match(build,/NODE_ENV=test npm test/);
  assert.match(build,/npm run build:nav/);
  assert.match(build,/npm run build/);
  assert.match(build,/verify-render-dist\.mjs/);
  const src=get('apps/client/src/network/Multiplayer.ts');
  assert.match(src,/location\.protocol==='https:'\?'wss':'ws'/);
  assert.match(src,/\/ws`/);
});
test('Render capacity environment limits rooms, zombies and connections without changing defaults',async()=>{
  const port=await findPort();
  const child=spawn(process.execPath,['server.mjs'],{cwd:root,
    env:{...process.env,NODE_ENV:'test',HOST:'127.0.0.1',PORT:String(port),
      GAME_MAX_ROOMS:'2',GAME_MAX_ZOMBIES:'24',GAME_MAX_CONNECTIONS:'12'},stdio:'ignore'});
  try {
    const h=await awaitHealth(port);
    assert.equal(h.version,'3.9.2');
    assert.equal(h.maxRooms,2);
    assert.equal(h.maxZombies,24);
    assert.equal(h.maxConnections,12);
  } finally {child.kill('SIGTERM');}
});
