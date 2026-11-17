# V3.11 CI report
Source commit: a2afc8aa238e9ded77a123cb4c8b3ddbad2cbdd5
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
[32m✓[39m 68 modules transformed.
rendering chunks...
computing gzip size...
[2mdist/[22m[32mindex.html                 [39m[1m[2m    0.44 kB[22m[1m[22m[2m │ gzip:   0.33 kB[22m
[2mdist/[22m[2massets/[22m[35mindex-pdsy-Sx9.css  [39m[1m[2m   26.06 kB[22m[1m[22m[2m │ gzip:   7.11 kB[22m
[2mdist/[22m[2massets/[22m[36mindex-nmCkAE-o.js   [39m[1m[33m1,736.32 kB[39m[22m[2m │ gzip: 289.18 kB[22m
[33m
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.[39m
[32m✓ built in 2.43s[39m
~~~
## Gameplay rules (tail)
~~~
  ...
# Subtest: two players sync loss/retry, victory/next, final restart and reject non-host commands
not ok 10 - two players sync loss/retry, victory/next, final restart and reject non-host commands
  ---
  duration_ms: 6242.121125
  type: 'test'
  location: '/home/runner/work/hahadog/hahadog/v311/campaign-integration.test.mjs:44:1'
  failureType: 'testCodeFailure'
  error: |-
    server ready
    
    false !== true
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/runner/work/hahadog/hahadog/v311/campaign-integration.test.mjs:57:12)
    async Test.run (node:internal/test_runner/test:1054:7)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
  ...
# Subtest: enemies actively approach a visible same-floor player without a navigation field
ok 11 - enemies actively approach a visible same-floor player without a navigation field
  ---
  duration_ms: 17.671772
--
  ...
# Subtest: V3.11 real WebSocket room supports class, mission, and authoritative defense request
not ok 44 - V3.11 real WebSocket room supports class, mission, and authoritative defense request
  ---
  duration_ms: 4191.898768
  type: 'test'
  location: '/home/runner/work/hahadog/hahadog/v311/v311-integration.test.mjs:14:1'
  failureType: 'testCodeFailure'
  error: |-
    V3.11 server should be healthy
    
    false !== true
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (file:///home/runner/work/hahadog/hahadog/v311/v311-integration.test.mjs:35:12)
    async Test.run (node:internal/test_runner/test:1054:7)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
  ...
# Subtest: all eight original music tracks exist, valid nonempty WAVE and distinct
ok 45 - all eight original music tracks exist, valid nonempty WAVE and distinct
  ---
  duration_ms: 7.607314
# Subtest: both crowd and rig renderers respect identical server facing without 180-degree offsets
ok 66 - both crowd and rig renderers respect identical server facing without 180-degree offsets
  ---
  duration_ms: 0.411267
  type: 'test'
  ...
1..66
# tests 66
# suites 0
# pass 64
# fail 2
# cancelled 0
# skipped 0
# todo 0
# duration_ms 8291.879041
~~~
## Regression test output (tail)
~~~
ok 64 - spatial hash creates local separation, but zombies on other floors do not repel
  ---
  duration_ms: 0.289715
  type: 'test'
  ...
# Subtest: server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
ok 65 - server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
  ---
  duration_ms: 0.528953
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
# duration_ms 5814.871201
~~~
