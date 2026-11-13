import { readFileSync, existsSync } from 'node:fs';
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
