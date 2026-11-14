import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'node_modules/three/examples/jsm/libs/draco');
const target = resolve(root, 'apps/client/public/draco');
if (!existsSync(source)) {
  console.warn('[DRACO] No three decoder found at', source);
  // Keep going: an older/custom three installation might still have Basis assets.
}
if (existsSync(source)) {
  mkdirSync(target, { recursive: true });
  for (const filename of ['draco_decoder.js', 'draco_wasm_wrapper.js', 'draco_decoder.wasm']) {
    if (existsSync(resolve(source, filename))) cpSync(resolve(source, filename), resolve(target, filename));
  }
  console.log('[DRACO] Decoder assets copied into public/draco');
}
const basisSource = resolve(root, 'node_modules/three/examples/jsm/libs/basis');
const basisTarget = resolve(root, 'apps/client/public/basis');
if (existsSync(basisSource)) {
  mkdirSync(basisTarget, { recursive: true });
  for (const filename of ['basis_transcoder.js', 'basis_transcoder.wasm']) {
    if (existsSync(resolve(basisSource, filename))) cpSync(resolve(basisSource, filename), resolve(basisTarget, filename));
  }
  console.log('[KTX2] Basis transcoder copied into public/basis');
}

