import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const read = path => fs.readFileSync(root + '/' + path, 'utf8');

test('V3.5 uses ACES exposure 1.2, RGBELoader and prefiltered HDRI', () => {
  const s = read('apps/client/src/core/RendererSetup.ts');
  assert.match(s, /renderer\.toneMappingExposure = 1\.20/);
  assert.match(s, /renderer\.outputColorSpace = THREE\.SRGBColorSpace/);
  assert.match(s, /renderer\.shadowMap\.type = THREE\.PCFSoftShadowMap/);
  assert.match(s, /new RGBELoader\(\)\.loadAsync/);
  assert.match(s, /pmrem\.fromEquirectangular/);
  assert.match(s, /scene\.environment = pmremTarget\.texture/);
});

test('directional moon shadow is 2048, PCF filtered and follows player', () => {
  const w = read('apps/client/src/world/World.ts');
  const m = read('apps/client/src/main.ts');
  assert.match(w, /moon\.castShadow=true/);
  assert.match(w, /moon\.shadow\.mapSize\.set\(2048,2048\)/);
  assert.match(w, /moon\.shadow\.camera\.left=-44/);
  assert.match(w, /moon\.shadow\.normalBias=0\.028/);
  assert.match(w, /updateShadowFocus\(player: THREE\.Vector3\)/);
  assert.match(m, /world\.updateShadowFocus\(camera\.position\)/);
  assert.match(w, /ground\.receiveShadow=true/);
});

test('all 12 PBR surface maps now have 512px resolution and correct mapping', () => {
  const s = read('apps/client/src/world/SurfaceMaterials.ts');
  assert.match(s, /map: texture\(type, 'albedo', repeat\)/);
  assert.match(s, /normalMap: texture\(type, 'normal', repeat\)/);
  assert.match(s, /roughnessMap: texture\(type, 'roughness', repeat\)/);
  assert.match(s, /channel === 'albedo' \? THREE\.SRGBColorSpace : THREE\.NoColorSpace/);
  assert.match(s, /const textureCache = new Map/);
  for(const type of ['asphalt','concrete','brick','metal']){
    for(const channel of ['albedo','normal','roughness']){
      const bytes = fs.readFileSync(root + `/apps/client/public/assets/materials/${type}_${channel}.jpg`);
      assert.equal(bytes[0],0xff);
      // A 512px smooth roughness image can compress to <9KB; verify JPEG
      // frame dimensions instead of incorrectly assuming a minimum byte count.
      let width = 0, height = 0;
      for (let i = 2; i + 9 < bytes.length;) {
        if (bytes[i] !== 0xff) { i++; continue; }
        const marker = bytes[i + 1];
        if (marker === 0xd9 || marker === 0xda) break;
        if (marker === 0xff || marker === 0x00) { i++; continue; }
        const length = bytes.readUInt16BE(i + 2);
        if (length < 2) break;
        if ([0xc0,0xc1,0xc2,0xc3].includes(marker)) {
          height = bytes.readUInt16BE(i + 5);
          width = bytes.readUInt16BE(i + 7);
          break;
        }
        i += length + 2;
      }
      assert.equal(width, 512, `${type}_${channel} JPEG width`);
      assert.equal(height, 512, `${type}_${channel} JPEG height`);
    }
  }
});
