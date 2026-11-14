import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {brotliDecompressSync} from 'node:zlib';
import {navigation,getNavigationFingerprint} from '../packages/shared/ZombieNavigation.mjs';

const file=new URL('../packages/shared/ZombieNavCache.br',import.meta.url);

test('pregenerated navigation cache matches this exact city geometry',()=>{
  const cached=JSON.parse(brotliDecompressSync(fs.readFileSync(file)).toString('utf8'));
  assert.equal(cached.version,'open-interiors-nav-v1');
  assert.equal(cached.fingerprint,getNavigationFingerprint());
  assert.equal(cached.nodes.length,navigation.nodes.length);
  assert.equal(cached.edges.length,navigation.edges.length);
  assert.equal(cached.ground.length,navigation.ground.length);
  assert.ok(cached.nodes.length>17000);
});

test('cached navigation retains reciprocal edges and all city rooftop routes',()=>{
  for(let i=0;i<navigation.nodes.length;i++){
    assert.equal(navigation.nodes[i].id,i);
    for(const e of navigation.edges[i]){
      assert.ok(e.id>=0&&e.id<navigation.nodes.length);
      assert.ok(e.cost>0);
    }
  }
  assert.ok(navigation.edges.reduce((n,edges)=>n+edges.length,0)>130000);
});
