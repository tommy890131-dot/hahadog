# V3.11 CI report
Source commit: 87766ad29a399a585709a66cc2a3880c6d0267a1
Rules: success
TypeScript/Vite: success
Existing game regression: failure

## Build output (tail)
~~~

> deadline-four-v3-9-tactical-shop@3.9.2 build
> npm run build -w @deadline/client


> @deadline/client@3.9.2 build
> tsc --noEmit && vite build

[36mvite v7.3.8 [32mbuilding client environment for production...[36m[39m
transforming...
[32m✓[39m 65 modules transformed.
rendering chunks...
computing gzip size...
[2mdist/[22m[32mindex.html                 [39m[1m[2m    0.44 kB[22m[1m[22m[2m │ gzip:   0.33 kB[22m
[2mdist/[22m[2massets/[22m[35mindex-Da5hZzWd.css  [39m[1m[2m   24.02 kB[22m[1m[22m[2m │ gzip:   6.52 kB[22m
[2mdist/[22m[2massets/[22m[36mindex-DOT6lfZT.js   [39m[1m[33m1,704.92 kB[39m[22m[2m │ gzip: 278.38 kB[22m
[33m
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.[39m
[32m✓ built in 1.44s[39m
~~~
## Gameplay rules (tail)
~~~
# Subtest: M249 and PKM have extra viewmodel firing motion and gun flash
ok 32 - M249 and PKM have extra viewmodel firing motion and gun flash
  ---
  duration_ms: 0.135051
  type: 'test'
  ...
1..32
# tests 32
# suites 0
# pass 32
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 4184.530343
~~~
## Regression test output (tail)
~~~
  ...
# Subtest: FPS settings are wired into the active composer and visual-only zombie LOD
not ok 28 - FPS settings are wired into the active composer and visual-only zombie LOD
  ---
  duration_ms: 2.465263
  type: 'test'
  location: '/home/runner/work/hahadog/hahadog/tests/performance-budget.test.mjs:51:1'
  failureType: 'testCodeFailure'
  error: |-
    The input did not match the regular expression /this\.distantBody\.setMatrixAt/. Input:
    
    "import * as THREE from 'three';\n" +
      "import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';\n" +
      "import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';\n" +
      "import type {ZombieRecord} from '../network/Multiplayer';\n" +
      '\n' +
      'type Track = ZombieRecord & {tx:number;ty:number;tz:number;tf:number};\n' +
      "type Family='walker'|'runner'|'brute'|'spitter'|'boss';\n" +
      "const FAMILIES:readonly Family[]=['walker','runner','brute','spitter','boss'] as const;\n" +
      'const HEIGHT:Record<Family,number>={walker:1.84,runner:1.94,brute:2.7,spitter:2.25,boss:3.41};\n' +
      'const TINT:Record<string,number>={\n' +
      '  walker:0xffffff,runner:0xffeeec,brute:0xf3e6d8,spitter:0xe4ffe4,\n' +
      '  screamer:0xffcfaf,climber:0xd7e4ff,juggernaut:0xd6c1a9,boss:0xffffff\n' +
      '};\n' +
      'const FAMILY_OF:Record<string,Family>={\n' +
      "  walker:'walker',runner:'runner',brute:'brute',spitter:'spitter',\n" +
      "  screamer:'spitter',climber:'runner',juggernaut:'brute',boss:'boss'\n" +
      '};\n' +
--
  ...
# Subtest: server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
not ok 65 - server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
  ---
  duration_ms: 1.724255
  type: 'test'
  location: '/home/runner/work/hahadog/hahadog/tests/zombie-navigation.test.mjs:119:1'
  failureType: 'testCodeFailure'
  error: |-
    The input did not match the regular expression /z\.y=THREE\.MathUtils\.lerp/. Input:
    
    "import * as THREE from 'three';\n" +
      "import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';\n" +
      "import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';\n" +
      "import type {ZombieRecord} from '../network/Multiplayer';\n" +
      '\n' +
      'type Track = ZombieRecord & {tx:number;ty:number;tz:number;tf:number};\n' +
      "type Family='walker'|'runner'|'brute'|'spitter'|'boss';\n" +
      "const FAMILIES:readonly Family[]=['walker','runner','brute','spitter','boss'] as const;\n" +
      'const HEIGHT:Record<Family,number>={walker:1.84,runner:1.94,brute:2.7,spitter:2.25,boss:3.41};\n' +
      'const TINT:Record<string,number>={\n' +
      '  walker:0xffffff,runner:0xffeeec,brute:0xf3e6d8,spitter:0xe4ffe4,\n' +
      '  screamer:0xffcfaf,climber:0xd7e4ff,juggernaut:0xd6c1a9,boss:0xffffff\n' +
      '};\n' +
      'const FAMILY_OF:Record<string,Family>={\n' +
      "  walker:'walker',runner:'runner',brute:'brute',spitter:'spitter',\n" +
      "  screamer:'spitter',climber:'runner',juggernaut:'brute',boss:'boss'\n" +
      '};\n' +
    
  operator: 'match'
  stack: |-
    TestContext.<anonymous> (file:///home/runner/work/hahadog/hahadog/tests/zombie-navigation.test.mjs:127:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
1..65
# tests 69
# suites 0
# pass 67
# fail 2
# cancelled 0
# skipped 0
# todo 0
# duration_ms 5891.661611
~~~
