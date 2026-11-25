# V3.11 CI report
Source commit: 55bc31ca7e4887374849dc7fb8a7e29043320e1d
Rules: failure
TypeScript/Vite: failure
Existing game regression: success

## Build output (tail)
~~~

> deadline-four-v3-9-tactical-shop@3.9.2 build
> npm run build -w @deadline/client


> @deadline/client@3.9.2 build
> tsc --noEmit && vite build

src/main.ts(24,1): error TS6133: 'FACILITY_MAPS' is declared but its value is never read.
src/world/FacilityScene.ts(5,6): error TS6196: 'FacilityData' is declared but never used.
src/world/FacilityScene.ts(15,19): error TS6133: 'owned' is declared but its value is never read.
src/world/FacilityScene.ts(16,31): error TS6138: Property 'scene' is declared but its value is never read.
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
# Subtest: client renders live blackout, supplies F interactions and draws alternate extraction markers
not ok 57 - client renders live blackout, supplies F interactions and draws alternate extraction markers
  ---
  duration_ms: 4.620499
  type: 'test'
  location: '/home/runner/work/hahadog/hahadog/v311/v312-blackout.test.mjs:94:1'
  failureType: 'testCodeFailure'
  error: |-
    The input did not match the regular expression /environment:V311&&room\.protocol[\s\S]{0,130}publicEnvironment\(room\.protocol,now\)/. Input:
    
    "import http from 'node:http';\n" +
      "import {createRound,enterPlayer,setPlayerState,completeObjective,stepRound,computeThreat} from './v311/survival-round.mjs';\n" +
      'import {createBlackoutProtocol,advanceBlackoutProtocol,triggerBlackout,interactWithWorld,\n' +
      "  publicEnvironment,inSelectedExtractionZone,ROUTES} from './v312/BlackoutProtocol.mjs';\n" +
      "import {CLASSES,LEVELS} from './v311/gameplay-catalog.mjs';\n" +
      "import {classShotModifiers,validClass} from './v311/ClassCombatRules.mjs';\n" +
      'import {getFacility,isFacility,facilityCanOccupy,facilityMoveHorizontal,\n' +
      '  facilityStepVertical,facilityCollisionBoxes,facilityFlowField,\n' +
      "  facilityRouteDirection,facilityPursue} from './v314/FacilityMaps.mjs';\n" +
      'import {createFacilityEvents,facilityInteract,facilityPublicEnvironment,\n' +
      "  facilityExtractionZone} from './v314/FacilityEvents.mjs';\n" +
      "import {createMapDirector,queueMapHorde,advanceMapDirector,nextMapSpawn} from './v314/MapDirector.mjs';\n" +
      'import {METRO_MAP,METRO_MAP_ID,metroCanOccupy,metroMoveHorizontal,metroStepVertical,\n' +
      "  metroCollisionBoxes,metroFlowField,metroPursue,metroRouteDirection} from './v313/MetroMap.mjs';\n" +
      'import {createMetroEvents,metroInteract,metroPublicEnvironment,\n' +
      "  metroExtractionZone,METRO_EXITS} from './v313/MetroEvents.mjs';\n" +
--
  ...
# Subtest: two maps share multiplayer room protocol but render distinct scenes and level transitions
not ok 63 - two maps share multiplayer room protocol but render distinct scenes and level transitions
  ---
  duration_ms: 3.850447
  type: 'test'
  location: '/home/runner/work/hahadog/hahadog/v311/v313-campaign.test.mjs:74:1'
  failureType: 'testCodeFailure'
  error: |-
    The input did not match the regular expression /room\.mapId=V311&&room\.levelIndex===1\?METRO_MAP_ID:'city'/. Input:
    
    "import http from 'node:http';\n" +
      "import {createRound,enterPlayer,setPlayerState,completeObjective,stepRound,computeThreat} from './v311/survival-round.mjs';\n" +
      'import {createBlackoutProtocol,advanceBlackoutProtocol,triggerBlackout,interactWithWorld,\n' +
      "  publicEnvironment,inSelectedExtractionZone,ROUTES} from './v312/BlackoutProtocol.mjs';\n" +
      "import {CLASSES,LEVELS} from './v311/gameplay-catalog.mjs';\n" +
      "import {classShotModifiers,validClass} from './v311/ClassCombatRules.mjs';\n" +
      'import {getFacility,isFacility,facilityCanOccupy,facilityMoveHorizontal,\n' +
      '  facilityStepVertical,facilityCollisionBoxes,facilityFlowField,\n' +
      "  facilityRouteDirection,facilityPursue} from './v314/FacilityMaps.mjs';\n" +
      'import {createFacilityEvents,facilityInteract,facilityPublicEnvironment,\n' +
      "  facilityExtractionZone} from './v314/FacilityEvents.mjs';\n" +
      "import {createMapDirector,queueMapHorde,advanceMapDirector,nextMapSpawn} from './v314/MapDirector.mjs';\n" +
      'import {METRO_MAP,METRO_MAP_ID,metroCanOccupy,metroMoveHorizontal,metroStepVertical,\n' +
      "  metroCollisionBoxes,metroFlowField,metroPursue,metroRouteDirection} from './v313/MetroMap.mjs';\n" +
      'import {createMetroEvents,metroInteract,metroPublicEnvironment,\n' +
      "  metroExtractionZone,METRO_EXITS} from './v313/MetroEvents.mjs';\n" +
--
  ...
# Subtest: live four-player server supports host-selected subway, distinct map snapshots, collision and next chapter
not ok 64 - live four-player server supports host-selected subway, distinct map snapshots, collision and next chapter
  ---
  duration_ms: 5672.118664
  type: 'test'
  location: '/home/runner/work/hahadog/hahadog/v311/v313-metro-integration.test.mjs:27:1'
  failureType: 'testCodeFailure'
  error: 'No matching event. Latest [{"type":"snapshot","phase":"playing","wave":1,"remaining":61,"shopRemainingMs":0,"players":[{"id":"4466a748","name":"隊長","x":-66,"z":-10,"y":0,"vy":0,"grounded":true,"yaw":0,"pitch":0,"ackMoveSeq":0,"hp":100,"maxHp":100,"armor":0,"level":1,"xp":0,"nextXp":150,"money":600,"kills":0,"weaponId":"p9","primary":null,"secondary":"p9","owned":["p9"],"ammo":15,"reserve":9999,"classId":"assault","weaponLevel":0,"downed":false,"reloading":false,"inSafehouse":true},{"id":"1531bbf2","name":"隊友","x":-62,"z":-10,"y":0,"vy":0,"grounded":true,"yaw":0,"pitch":0,"ackMoveSeq":0,"hp":100,"maxHp":100,"armor":0,"level":1,"xp":0,"nextXp":150,"money":600,"kills":0,"weaponId":"p9","primary":null,"secondary":"p9","owned":["p9"],"ammo":15,"reserve":9999,"classId":"assault","weaponLevel":0,"downed":false,"reloading":false,"inSafehouse":true}],"zombies":[{"id":2,"x":68.00492454616851,"y":0,"z":49.52430896310796,"hp":90,"maxHp":90,"kind":"walker","step":48.89604446304655,"facing":0.0032306633070509376,"moving":true,"attacking":false},{"id":3,"x":28.032644425381942,"y":0,"z":-59.492988267364034,"hp":110,"maxHp":110,"kind":"spitter","step":35.680160585775646,"facing":3.11973097837416,"moving":true,"attacking":false}],"defenses":[],"loot":[],"bossPhase":0,"environment":{"powerOnline":false,"blackoutRemainingMs":0,"relayReady":false,"selectedRoute":null,"routes":[{"id":"ambulance","label":"急診救護車","x":66,"y":0,"z":-4,"radius":6,"requires":"generator","ready":false},{"id":"helipad","label":"院區直升機","x":61,"y":0,"z":62,"radius":7,"requires":"relay","ready":false}],"devices":[{"id":"hospitalGenerator","label":"備用電力系統","x":-23,"y":0,"z":-27,"range":3.5,"kind":"generator","active":true},{"id":"hospitalIsolation","label":"隔離病房解鎖","x":19,"y":0,"z":-26,"range":3.5,"kind":"seal","active":true},{"id":"hospitalSiren","label":"急診緊急廣播","x":-8,"y":0,"z":25,"range":3.5,"kind":"alarm","active":true},{"id":"hospitalRadio","label":"直升機通訊台","x":59,"y":0,"z":45,"range":3.5,"kind":"relay","active":true}]},"mapId":"infected_hospital"},{"type":"snapshot","phase":"playing","wave":1,"remaining":61,"shopRemainingMs":0,"players":[{"id":"4466a748","name":"隊長","x":-66,"z":-10,"y":0,"vy":0,"grounded":true,"yaw":0,"pitch":0,"ackMoveSeq":0,"hp":100,"maxHp":100,"armor":0,"level":1,"xp":0,"nextXp":150,"money":600,"kills":0,"weaponId":"p9","primary":null,"secondary":"p9","owned":["p9"],"ammo":15,"reserve":9999,"classId":"assault","weaponLevel":0,"downed":false,"reloading":false,"inSafehouse":true},{"id":"1531bbf2","name":"隊友","x":-62,"z":-10,"y":0,"vy":0,"grounded":true,"yaw":0,"pitch":0,"ackMoveSeq":0,"hp":100,"maxHp":100,"armor":0,"level":1,"xp":0,"nextXp":150,"money":600,"kills":0,"weaponId":"p9","primary":null,"secondary":"p9","owned":["p9"],"ammo":15,"reserve":9999,"classId":"assault","weaponLevel":0,"downed":false,"reloading":false,"inSafehouse":true}],"zombies":[{"id":2,"x":68.00398765543922,"y":0,"z":49.23431047649854,"hp":90,"maxHp":90,"kind":"walker","step":50.2010444630465,"facing":0.0032306633070509376,"moving":true,"attacking":false},{"id":3,"x":28.027616640595255,"y":0,"z":-59.26304322745202,"hp":110,"maxHp":110,"kind":"spitter","step":36.715160585775614,"facing":3.11973097837416,"moving":true,"attacking":false}],"defenses":[],"loot":[],"bossPhase":0,"environment":{"powerOnline":false,"blackoutRemainingMs":0,"relayReady":false,"selectedRoute":null,"routes":[{"id":"ambulance","label":"急診救護車","x":66,"y":0,"z":-4,"radius":6,"requires":"generator","ready":false},{"id":"helipad","label":"院區直升機","x":61,"y":0,"z":62,"radius":7,"requires":"relay","ready":false}],"devices":[{"id":"hospitalGenerator","label":"備用電力系統","x":-23,"y":0,"z":-27,"range":3.5,"kind":"generator","active":true},{"id":"hospitalIsolation","label":"隔離病房解鎖","x":19,"y":0,"z":-26,"range":3.5,"kind":"seal","active":true},{"id":"hospitalSiren","label":"急診緊急廣播","x":-8,"y":0,"z":25,"range":3.5,"kind":"alarm","active":true},{"id":"hospitalRadio","label":"直升機通訊台","x":59,"y":0,"z":45,"range":3.5,"kind":"relay","active":true}]},"mapId":"infected_hospital"},{"type":"snapshot","phase":"playing","wave":1,"remaining":61,"shopRemainingMs":0,"players":[{"id":"4466a748","name":"隊長","x":-66,"z":-10,"y":0,"vy":0,"grounded":true,"yaw":0,"pitch":0,"ackMoveSeq":0,"hp":100,"maxHp":100,"armor":0,"level":1,"xp":0,"nextXp":150,"money":600,"kills":0,"weaponId":"p9","primary":null,"secondary":"p9","owned":["p9"],"ammo":15,"reserve":9999,"classId":"assault","weaponLevel":0,"downed":false,"reloading":false,"inSafehouse":true},{"id":"1531bbf2","name":"隊友","x":-62,"z":-10,"y":0,"vy":0,"grounded":true,"yaw":0,"pitch":0,"ackMoveSeq":0,"hp":100,"maxHp":100,"armor":0,"level":1,"xp":0,"nextXp":150,"money":600,"kills":0,"weaponId":"p9","primary":null,"secondary":"p9","owned":["p9"],"ammo":15,"reserve":9999,"classId":"assault","weaponLevel":0,"downed":false,"reloading":false,"inSafehouse":true}],"zombies":[{"id":2,"x":68.00305076470993,"y":0,"z":48.94431198988912,"hp":90,"maxHp":90,"kind":"walker","step":51.50604446304645,"facing":0.0032306633070509376,"moving":true,"attacking":false},{"id":3,"x":28.022588855808568,"y":0,"z":-59.03309818754001,"hp":110,"maxHp":110,"kind":"spitter","step":37.75016058577558,"facing":3.11973097837416,"moving":true,"attacking":false}],"defenses":[],"loot":[],"bossPhase":0,"environment":{"powerOnline":false,"blackoutRemainingMs":0,"relayReady":false,"selectedRoute":null,"routes":[{"id":"ambulance","label":"急診救護車","x":66,"y":0,"z":-4,"radius":6,"requires":"generator","ready":false},{"id":"helipad","label":"院區直升機","x":61,"y":0,"z":62,"radius":7,"requires":"relay","ready":false}],"devices":[{"id":"hospitalGenerator","label":"備用電力系統","x":-23,"y":0,"z":-27,"range":3.5,"kind":"generator","active":true},{"id":"hospitalIsolation","label":"隔離病房解鎖","x":19,"y":0,"z":-26,"range":3.5,"kind":"seal","active":true},{"id":"hospitalSiren","label":"急診緊急廣播","x":-8,"y":0,"z":25,"range":3.5,"kind":"alarm","active":true},{"id":"hospitalRadio","label":"直升機通訊台","x":59,"y":0,"z":45,"range":3.5,"kind":"relay","active":true}]},"mapId":"infected_hospital"},{"type":"snapshot","phase":"playing","wave":1,"remaining":61,"shopRemainingMs":0,"players":[{"id":"4466a748","name":"隊長","x":-66,"z":-10,"y":0,"vy":0,"grounded":true,"yaw":0,"pitch":0,"ackMoveSeq":0,"hp":100,"maxHp":100,"armor":0,"level":1,"xp":0,"nextXp":150,"money":600,"kills":0,"weaponId":"p9","primary":null,"secondary":"p9","owned":["p9"],"ammo":15,"reserve":9999,"classId":"assault","weaponLevel":0,"downed":false,"reloading":false,"inSafehouse":true},{"id":"1531bbf2","name":"隊友","x":-62,"z":-10,"y":0,"vy":0,"grounded":true,"yaw":0,"pitch":0,"ackMoveSeq":0,"hp":100,"maxHp":100,"armor":0,"level":1,"xp":0,"nextXp":150,"money":600,"kills":0,"weaponId":"p9","primary":null,"secondary":"p9","owned":["p9"],"ammo":15,"reserve":9999,"classId":"assault","weaponLevel":0,"downed":false,"reloading":false,"inSafehouse":true}],"zombies":[{"id":2,"x":68.00275027981091,"y":0,"z":48.654312145563615,"hp":90,"maxHp":90,"kind":"walker","step":52.8110444630464,"facing":0.0010361550095934803,"moving":true,"attacking":false},{"id":3,"x":28.019283850753002,"y":0,"z":-58.80312838874335,"hp":110,"maxHp":110,"kind":"spitter","step":38.78516058577556,"facing":3.134713358788784,"moving":true,"attacking":false}],"defenses":[],"loot":[],"bossPhase":0,"environment":{"powerOnline":false,"blackoutRemainingMs":0,"relayReady":false,"selectedRoute":null,"routes":[{"id":"ambulance","label":"急診救護車","x":66,"y":0,"z":-4,"radius":6,"requires":"generator","ready":false},{"id":"helipad","label":"院區直升機","x":61,"y":0,"z":62,"radius":7,"requires":"relay","ready":false}],"devices":[{"id":"hospitalGenerator","label":"備用電力系統","x":-23,"y":0,"z":-27,"range":3.5,"kind":"generator","active":true},{"id":"hospitalIsolation","label":"隔離病房解鎖","x":19,"y":0,"z":-26,"range":3.5,"kind":"seal","active":true},{"id":"hospitalSiren","label":"急診緊急廣播","x":-8,"y":0,"z":25,"range":3.5,"kind":"alarm","active":true},{"id":"hospitalRadio","label":"直升機通訊台","x":59,"y":0,"z":45,"range":3.5,"kind":"relay","active":true}]},"mapId":"infected_hospital"},{"type":"snapshot","phase":"playing","wave":1,"remaining":61,"shopRemainingMs":0,"players":[{"id":"4466a748","name":"隊長","x":-66,"z":-10,"y":0,"vy":0,"grounded":true,"yaw":0,"pitch":0,"ackMoveSeq":0,"hp":100,"maxHp":100,"armor":0,"level":1,"xp":0,"nextXp":150,"money":600,"kills":0,"weaponId":"p9","primary":null,"secondary":"p9","owned":["p9"],"ammo":15,"reserve":9999,"classId":"assault","weaponLevel":0,"downed":false,"reloading":false,"inSafehouse":true},{"id":"1531bbf2","name":"隊友","x":-62,"z":-10,"y":0,"vy":0,"grounded":true,"yaw":0,"pitch":0,"ackMoveSeq":0,"hp":100,"maxHp":100,"armor":0,"level":1,"xp":0,"nextXp":150,"money":600,"kills":0,"weaponId":"p9","primary":null,"secondary":"p9","owned":["p9"],"ammo":15,"reserve":9999,"classId":"assault","weaponLevel":0,"downed":false,"reloading":false,"inSafehouse":true}],"zombies":[{"id":2,"x":68.0024497949119,"y":0,"z":48.36431230123811,"hp":90,"maxHp":90,"kind":"walker","step":54.11604446304635,"facing":0.0010361550095934803,"moving":true,"attacking":false},{"id":3,"x":28.01770162542856,"y":0,"z":-58.573133831062044,"hp":110,"maxHp":110,"kind":"spitter","step":39.82016058577554,"facing":3.134713358788784,"moving":true,"attacking":false}],"defenses":[],"loot":[],"bossPhase":0,"environment":{"powerOnline":false,"blackoutRemainingMs":0,"relayReady":false,"selectedRoute":null,"routes":[{"id":"ambulance","label":"急診救護車","x":66,"y":0,"z":-4,"radius":6,"requires":"generator","ready":false},{"id":"helipad","label":"院區直升機","x":61,"y":0,"z":62,"radius":7,"requires":"relay","ready":false}],"devices":[{"id":"hospitalGenerator","label":"備用電力系統","x":-23,"y":0,"z":-27,"range":3.5,"kind":"generator","active":true},{"id":"hospitalIsolation","label":"隔離病房解鎖","x":19,"y":0,"z":-26,"range":3.5,"kind":"seal","active":true},{"id":"hospitalSiren","label":"急診緊急廣播","x":-8,"y":0,"z":25,"range":3.5,"kind":"alarm","active":true},{"id":"hospitalRadio","label":"直升機通訊台","x":59,"'... 2095 more characters
  code: 'ERR_TEST_FAILURE'
  stack: |-
    Object.expect (file:///home/runner/work/hahadog/hahadog/v311/v313-metro-integration.test.mjs:23:13)
    runNextTicks (node:internal/process/task_queues:64:5)
    listOnTimeout (node:internal/timers:547:9)
    process.processTimers (node:internal/timers:521:7)
    async Promise.all (index 0)
    async TestContext.<anonymous> (file:///home/runner/work/hahadog/hahadog/v311/v313-metro-integration.test.mjs:64:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
  ...
# Subtest: infected_hospital has valid spawn, named entrances, safehouse, two safe exits and collision
ok 65 - infected_hospital has valid spawn, named entrances, safehouse, two safe exits and collision
  ---
  duration_ms: 1.845755
  type: 'test'
  ...
# Subtest: infected_hospital movement cannot penetrate room walls or the outer map limits
--
  ...
# Subtest: doomed_harbor has valid spawn, named entrances, safehouse, two safe exits and collision
not ok 68 - doomed_harbor has valid spawn, named entrances, safehouse, two safe exits and collision
  ---
  duration_ms: 4.208007
  type: 'test'
  location: '/home/runner/work/hahadog/hahadog/v311/v314-maps-director.test.mjs:14:2'
  failureType: 'testCodeFailure'
  error: |-
    The expression evaluated to a falsy value:
    
      assert.ok(facilityCollisionBoxes(mapId).length>20)
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (file:///home/runner/work/hahadog/hahadog/v311/v314-maps-director.test.mjs:25:11)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
--
  ...
# Subtest: AI director chooses map-specific entrances, distinct infected compositions and honors caps
not ok 73 - AI director chooses map-specific entrances, distinct infected compositions and honors caps
  ---
  duration_ms: 1.493255
  type: 'test'
  location: '/home/runner/work/hahadog/hahadog/v311/v314-maps-director.test.mjs:77:1'
  failureType: 'testCodeFailure'
  error: |-
    The expression evaluated to a falsy value:
    
      assert.ok(next)
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: ~
  operator: '=='
  stack: |-
    TestContext.<anonymous> (file:///home/runner/work/hahadog/hahadog/v311/v314-maps-director.test.mjs:93:9)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: both crowd and rig renderers respect identical server facing without 180-degree offsets
ok 83 - both crowd and rig renderers respect identical server facing without 180-degree offsets
  ---
  duration_ms: 0.4486
  type: 'test'
  ...
1..83
# tests 83
# suites 0
# pass 78
# fail 5
# cancelled 0
# skipped 0
# todo 0
# duration_ms 8910.321124
~~~
## Regression test output (tail)
~~~
ok 64 - spatial hash creates local separation, but zombies on other floors do not repel
  ---
  duration_ms: 0.359001
  type: 'test'
  ...
# Subtest: server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
ok 65 - server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
  ---
  duration_ms: 0.63614
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
# duration_ms 6428.72924
~~~
