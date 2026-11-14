/** Regenerate whenever the open-interiors layout is changed. */
import fs from 'node:fs';
import {brotliCompressSync,constants} from 'node:zlib';
process.env.DEADLINE_REBUILD_NAV_CACHE='1';
const {navigation,getNavigationFingerprint}=await import('../packages/shared/ZombieNavigation.mjs');
const file=new URL('../packages/shared/ZombieNavCache.br',import.meta.url);
const data={version:'open-interiors-nav-v1',fingerprint:getNavigationFingerprint(),
  nodes:navigation.nodes,edges:navigation.edges,ground:[...navigation.ground]};
const compressed=brotliCompressSync(Buffer.from(JSON.stringify(data)),
  {params:{[constants.BROTLI_PARAM_QUALITY]:7}});
fs.writeFileSync(file,compressed);
console.log(`[ZombieNavigation] Cached ${data.nodes.length} nodes, ${data.edges.reduce((sum,x)=>sum+x.length,0)} edges (${compressed.length} bytes)`);
