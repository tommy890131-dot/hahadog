# V3.11 CI report
Source commit: 25a150909bbd48c3ee5b9d60b00c9889bce692ea
Rules: failure
TypeScript/Vite: success
Existing game regression: success

## Build output (tail)
~~~

> deadline-four-v3-9-tactical-shop@3.9.2 build
> npm run build -w @deadline/client


> @deadline/client@3.9.2 build
> tsc --noEmit && vite build

[36mvite v7.3.8 [32mbuilding client environment for production...[36m[39m
transforming...
[32m✓[39m 71 modules transformed.
rendering chunks...
computing gzip size...
[2mdist/[22m[32mindex.html                 [39m[1m[2m    0.44 kB[22m[1m[22m[2m │ gzip:   0.33 kB[22m
[2mdist/[22m[2massets/[22m[35mindex-pdsy-Sx9.css  [39m[1m[2m   26.06 kB[22m[1m[22m[2m │ gzip:   7.11 kB[22m
[2mdist/[22m[2massets/[22m[36mindex-CcoaObFJ.js   [39m[1m[33m1,744.50 kB[39m[22m[2m │ gzip: 292.13 kB[22m
[33m
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.[39m
[32m✓ built in 2.01s[39m
~~~
## Gameplay rules (tail)
~~~
  ...
# Subtest: train power/alert/launch are server-authoritative, staged, rate-limited, and spawn hordes
not ok 61 - train power/alert/launch are server-authoritative, staged, rate-limited, and spawn hordes
  ---
  duration_ms: 1.547349
  type: 'test'
  location: '/home/runner/work/hahadog/hahadog/v311/v313-campaign.test.mjs:44:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    
    undefined !== 18
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 18
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/runner/work/hahadog/hahadog/v311/v313-campaign.test.mjs:51:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: train boarding requires objectives, 25-sec arrival, and complete team assembly
# Subtest: both crowd and rig renderers respect identical server facing without 180-degree offsets
ok 72 - both crowd and rig renderers respect identical server facing without 180-degree offsets
  ---
  duration_ms: 0.473103
  type: 'test'
  ...
1..72
# tests 72
# suites 0
# pass 71
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 4707.796083
~~~
## Regression test output (tail)
~~~
ok 64 - spatial hash creates local separation, but zombies on other floors do not repel
  ---
  duration_ms: 0.335837
  type: 'test'
  ...
# Subtest: server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
ok 65 - server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
  ---
  duration_ms: 0.635736
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
# duration_ms 6417.297597
~~~
