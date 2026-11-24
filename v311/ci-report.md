# V3.11 CI report
Source commit: ec07dcda29033082fc6a25057de789d181cd0446
Rules: failure
TypeScript/Vite: failure
Existing game regression: success

## Build output (tail)
~~~

> deadline-four-v3-9-tactical-shop@3.9.2 build
> npm run build -w @deadline/client


> @deadline/client@3.9.2 build
> tsc --noEmit && vite build

src/player/FirstPersonController.ts(4,33): error TS7016: Could not find a declaration file for module '../../../../v313/MetroMap.mjs'. '/home/runner/work/hahadog/hahadog/v313/MetroMap.mjs' implicitly has an 'any' type.
src/world/BlackoutWorldVisuals.ts(3,41): error TS7016: Could not find a declaration file for module '../../../../v313/MetroEvents.mjs'. '/home/runner/work/hahadog/hahadog/v313/MetroEvents.mjs' implicitly has an 'any' type.
src/world/BlackoutWorldVisuals.ts(61,26): error TS18046: 'p' is of type 'unknown'.
src/world/BlackoutWorldVisuals.ts(61,30): error TS18046: 'p' is of type 'unknown'.
src/world/BlackoutWorldVisuals.ts(61,34): error TS18046: 'p' is of type 'unknown'.
src/world/BlackoutWorldVisuals.ts(75,46): error TS18046: 'p' is of type 'unknown'.
src/world/BlackoutWorldVisuals.ts(75,75): error TS18046: 'p' is of type 'unknown'.
src/world/MapMini.ts(3,27): error TS7016: Could not find a declaration file for module '../../../../v313/MetroMap.mjs'. '/home/runner/work/hahadog/hahadog/v313/MetroMap.mjs' implicitly has an 'any' type.
src/world/MetroScene.ts(2,27): error TS7016: Could not find a declaration file for module '../../../../v313/MetroMap.mjs'. '/home/runner/work/hahadog/hahadog/v313/MetroMap.mjs' implicitly has an 'any' type.
src/world/World.ts(6,50): error TS7016: Could not find a declaration file for module '../../../../v313/MetroMap.mjs'. '/home/runner/work/hahadog/hahadog/v313/MetroMap.mjs' implicitly has an 'any' type.
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
# Subtest: remote player muzzle originates at forward barrel-offset, not at player eyes
not ok 35 - remote player muzzle originates at forward barrel-offset, not at player eyes
  ---
  duration_ms: 5.862466
  type: 'test'
  location: '/home/runner/work/hahadog/hahadog/v311/scope-muzzle.test.mjs:38:1'
  failureType: 'testCodeFailure'
  error: |-
    The input did not match the regular expression /for\(const box of collisionBoxes\)wallDistance=Math\.min\(wallDistance,rayBox\(visualFrom,heading,box\)\)/. Input:
    
    "import http from 'node:http';\n" +
      "import {createRound,enterPlayer,setPlayerState,completeObjective,stepRound,computeThreat} from './v311/survival-round.mjs';\n" +
      'import {createBlackoutProtocol,advanceBlackoutProtocol,triggerBlackout,interactWithWorld,\n' +
      "  publicEnvironment,inSelectedExtractionZone,ROUTES} from './v312/BlackoutProtocol.mjs';\n" +
      "import {CLASSES,LEVELS} from './v311/gameplay-catalog.mjs';\n" +
      "import {classShotModifiers,validClass} from './v311/ClassCombatRules.mjs';\n" +
      'import {METRO_MAP,METRO_MAP_ID,metroCanOccupy,metroMoveHorizontal,metroStepVertical,\n' +
      "  metroCollisionBoxes,metroFlowField,metroPursue,metroRouteDirection} from './v313/MetroMap.mjs';\n" +
      'import {createMetroEvents,metroInteract,metroPublicEnvironment,\n' +
      "  metroExtractionZone,METRO_EXITS} from './v313/MetroEvents.mjs';\n" +
      'import {ROOM_IDLE_MS,SOCKET_PING_INTERVAL_MS,SOCKET_PONG_TIMEOUT_MS,\n' +
      "  pruneRoomRegistry,handshakeCapacity} from './v312/RoomCapacity.mjs';\n" +
      "import {stageAt,allowedCampaignAction,nextStageIndex,LAST_LEVEL} from './v311/campaign-flow.mjs';\n" +
      "import {SPECIALS,DEFENSES,RARITIES,chooseSpecial,bossPhase,lootRarity,validPlacement,claimLoot,canTurretShoot,nextEvent} from './v311/GameplaySystems.mjs';\n" +
      "import fs from 'node:fs';\n" +
      "import path from 'node:path';\n" +
--
  ...
# Subtest: client renders live blackout, supplies F interactions and draws alternate extraction markers
not ok 57 - client renders live blackout, supplies F interactions and draws alternate extraction markers
  ---
  duration_ms: 3.822324
  type: 'test'
  location: '/home/runner/work/hahadog/hahadog/v311/v312-blackout.test.mjs:94:1'
  failureType: 'testCodeFailure'
  error: |-
    The input did not match the regular expression /environment:V311&&room\.protocol\?publicEnvironment/. Input:
    
    "import http from 'node:http';\n" +
      "import {createRound,enterPlayer,setPlayerState,completeObjective,stepRound,computeThreat} from './v311/survival-round.mjs';\n" +
      'import {createBlackoutProtocol,advanceBlackoutProtocol,triggerBlackout,interactWithWorld,\n' +
      "  publicEnvironment,inSelectedExtractionZone,ROUTES} from './v312/BlackoutProtocol.mjs';\n" +
      "import {CLASSES,LEVELS} from './v311/gameplay-catalog.mjs';\n" +
      "import {classShotModifiers,validClass} from './v311/ClassCombatRules.mjs';\n" +
      'import {METRO_MAP,METRO_MAP_ID,metroCanOccupy,metroMoveHorizontal,metroStepVertical,\n' +
      "  metroCollisionBoxes,metroFlowField,metroPursue,metroRouteDirection} from './v313/MetroMap.mjs';\n" +
      'import {createMetroEvents,metroInteract,metroPublicEnvironment,\n' +
      "  metroExtractionZone,METRO_EXITS} from './v313/MetroEvents.mjs';\n" +
      'import {ROOM_IDLE_MS,SOCKET_PING_INTERVAL_MS,SOCKET_PONG_TIMEOUT_MS,\n' +
      "  pruneRoomRegistry,handshakeCapacity} from './v312/RoomCapacity.mjs';\n" +
      "import {stageAt,allowedCampaignAction,nextStageIndex,LAST_LEVEL} from './v311/campaign-flow.mjs';\n" +
      "import {SPECIALS,DEFENSES,RARITIES,chooseSpecial,bossPhase,lootRarity,validPlacement,claimLoot,canTurretShoot,nextEvent} from './v311/GameplaySystems.mjs';\n" +
      "import fs from 'node:fs';\n" +
      "import path from 'node:path';\n" +
--
  ...
# Subtest: train power/alert/launch are server-authoritative, staged, rate-limited, and spawn hordes
not ok 61 - train power/alert/launch are server-authoritative, staged, rate-limited, and spawn hordes
  ---
  duration_ms: 1.72564
  type: 'test'
  location: '/home/runner/work/hahadog/hahadog/v311/v313-campaign.test.mjs:44:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    + actual - expected
    
    + undefined
    - 'power_restored'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 'power_restored'
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/runner/work/hahadog/hahadog/v311/v313-campaign.test.mjs:48:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
# Subtest: both crowd and rig renderers respect identical server facing without 180-degree offsets
ok 72 - both crowd and rig renderers respect identical server facing without 180-degree offsets
  ---
  duration_ms: 0.452844
  type: 'test'
  ...
1..72
# tests 72
# suites 0
# pass 69
# fail 3
# cancelled 0
# skipped 0
# todo 0
# duration_ms 4740.344075
~~~
## Regression test output (tail)
~~~
ok 64 - spatial hash creates local separation, but zombies on other floors do not repel
  ---
  duration_ms: 0.352428
  type: 'test'
  ...
# Subtest: server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
ok 65 - server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
  ---
  duration_ms: 0.645043
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
# duration_ms 6686.69713
~~~
