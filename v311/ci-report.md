# V3.11 CI report
Source commit: 2dd10fb18a76f63609bb054d538630c7c3f74b46
Rules: failure
TypeScript/Vite: failure
Existing game regression: success

## Build output (tail)
~~~

> deadline-four-v3-9-tactical-shop@3.9.2 build
> npm run build -w @deadline/client


> @deadline/client@3.9.2 build
> tsc --noEmit && vite build

src/main.ts(212,7): error TS2322: Type 'number' is not assignable to type '36 | 85 | 42 | 80'.
src/main.ts(625,21): error TS2345: Argument of type '"lmg"' is not assignable to parameter of type 'GameSfx'.
npm error Lifecycle script `build` failed with error:
npm error code 2
npm error path /home/runner/work/hahadog/hahadog/apps/client
npm error workspace @deadline/client@3.9.2
npm error location /home/runner/work/hahadog/hahadog/apps/client
npm error command failed
npm error command sh -c tsc --noEmit && vite build
~~~
## Gameplay rules (tail)
~~~
  ...
# Subtest: gun, reload, footsteps, world controls, and player interaction SFX exist
not ok 43 - gun, reload, footsteps, world controls, and player interaction SFX exist
  ---
  duration_ms: 1.970489
  type: 'test'
  location: '/home/runner/work/hahadog/hahadog/v311/v312-audio.test.mjs:32:1'
  failureType: 'testCodeFailure'
  error: 'weapons/empty too short'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    wav (file:///home/runner/work/hahadog/hahadog/v311/v312-audio.test.mjs:14:10)
    TestContext.<anonymous> (file:///home/runner/work/hahadog/hahadog/v311/v312-audio.test.mjs:39:78)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: live game integrates voice, captions, ducked adaptive music, music/voice settings
not ok 44 - live game integrates voice, captions, ducked adaptive music, music/voice settings
  ---
  duration_ms: 1.678498
  type: 'test'
  location: '/home/runner/work/hahadog/hahadog/v311/v312-audio.test.mjs:41:1'
  failureType: 'testCodeFailure'
  error: |-
    The input did not match the regular expression /sound\.playSfx\('stepMetal'/. Input:
    
    "import * as THREE from 'three';\n" +
      "import {AimController,AIM_WEAPONS} from '../../../v311/aim-controller';\n" +
      "import {BattleExtras} from './game/BattleExtras';\n" +
      "import {BulletTracers} from './effects/BulletTracers';\n" +
      "import { createPostProcessing } from './core/PostProcessing';\n" +
      "import { AssetManager } from './assets/AssetManager';\n" +
      "import { configurePhotorealRenderer } from './core/RendererSetup';\n" +
      "import { AdaptiveRenderer } from './core/AdaptiveRenderer';\n" +
      "import type { QualityMode } from './core/FrameBudget';\n" +
      "import { ImpactSystem } from './effects/ImpactSystem';\n" +
      "import { ShotImpactBridge } from './effects/ShotImpactBridge';\n" +
      "import { SoundManager } from './audio/SoundManager';\n" +
      "import { CinematicAudio,type MusicMood } from './audio/CinematicAudio';\n" +
      "import { CombatFeedbackUI } from './ui/CombatFeedbackUI';\n" +
      "import { WeaponViewmodel } from './game/WeaponViewmodel';\n" +
      "import {WEAPONS,isWeaponId,toTuning,type WeaponId} from './game/WeaponCatalog';\n" +
# Subtest: both crowd and rig renderers respect identical server facing without 180-degree offsets
ok 61 - both crowd and rig renderers respect identical server facing without 180-degree offsets
  ---
  duration_ms: 0.436224
  type: 'test'
  ...
1..61
# tests 61
# suites 0
# pass 59
# fail 2
# cancelled 0
# skipped 0
# todo 0
# duration_ms 4449.30887
~~~
## Regression test output (tail)
~~~
ok 64 - spatial hash creates local separation, but zombies on other floors do not repel
  ---
  duration_ms: 0.332251
  type: 'test'
  ...
# Subtest: server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
ok 65 - server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
  ---
  duration_ms: 0.557683
  type: 'test'
  ...
1..65
# tests 69
# suites 0
# pass 69
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 5816.005284
~~~
