import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
const out = resolve('apps/client/dist');
const index = resolve(out, 'index.html');
const missing=[];
if(!existsSync(index))missing.push('apps/client/dist/index.html');
else {
  const html=readFileSync(index,'utf8');
  if(!html.includes('DEADLINE FOUR'))missing.push('correct DEADLINE FOUR HTML title');
  if(!/\/assets\/[^"']+\.js/.test(html))missing.push('bundled Vite JavaScript');
}
for(const file of ['packages/shared/ZombieNavCache.br','server/NavigationWorker.mjs',
  'apps/client/dist/basis/basis_transcoder.wasm',
  'apps/client/dist/draco/draco_decoder.wasm',
  ...['walker','runner','brute','spitter','boss'].map(name=>'apps/client/dist/models/enemies/'+name+'.glb')]){
  if(!existsSync(resolve(file)))missing.push(file);
}
if(missing.length){console.error('[Render] Missing build artifacts:',missing);process.exit(1)}
const total = readdirSync(resolve(out,'assets')).length;
console.log(`[Render] Distribution verified: ${total} asset files and navigation worker/cache present.`);
