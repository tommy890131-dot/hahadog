import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { brotliDecompressSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const EXPECTED_SHA256 = '13c46ade3174f60eccfab99cd76a5dfd7a140faa8597f5c78feda8ec8f355451';
const PARTS = 22;
const chunks = Array.from({ length: PARTS }, (_, i) =>
  readFileSync(resolve(`.payload/part${String(i + 1).padStart(3, '0')}.b64`), 'utf8').trim()
);
const compressed = Buffer.from(chunks.join(''), 'base64');
const actualSha256 = createHash('sha256').update(compressed).digest('hex');
if (actualSha256 !== EXPECTED_SHA256) throw new Error(`Source archive checksum mismatch: ${actualSha256}`);
const sourceTar = brotliDecompressSync(compressed);
console.log(`[DEADLINE FOUR] Extracting verified V3.9.2 source (${compressed.length} compressed bytes)`);
execFileSync('tar', ['-xf', '-', '-C', process.cwd()], { input: sourceTar, stdio: ['pipe', 'inherit', 'inherit'] });
for (const file of ['server.mjs', 'package.json', 'scripts/render-build.sh', 'apps/client/src/main.ts']) {
  if (!existsSync(resolve(file))) throw new Error(`Incomplete source archive: ${file}`);
}
console.log('[DEADLINE FOUR] Source restored; starting full Render build.');

// The Render service caps production at 2 rooms. The 4-room stress test
// requires a larger test-only cap on its own child server, not a global override.
const concurrencyTestPath = resolve('tests/physics-security-regression.test.mjs');
const suite = readFileSync(concurrencyTestPath, 'utf8');
const testMarker = "test('global navigation flow calculations are delegated to a worker and arbitrated across rooms',async()=>{";
const markerIndex = suite.indexOf(testMarker);
if (markerIndex < 0) throw new Error('Cannot find multi-room integration test');
const section = suite.slice(markerIndex);
const childEnv = "env:{...process.env,HOST:'127.0.0.1',PORT:String(port)}";
if (!section.includes(childEnv)) throw new Error('Cannot find stress test child-server environment');
writeFileSync(concurrencyTestPath, suite.slice(0,markerIndex) +
  section.replace(childEnv, "env:{...process.env,GAME_MAX_ROOMS:'8',HOST:'127.0.0.1',PORT:String(port)}"));
console.log('[DEADLINE FOUR] Four-room stress test uses room cap 8; production remains capped at 2.');
