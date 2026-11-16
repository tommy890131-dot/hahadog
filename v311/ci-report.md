# V3.11 CI report
Source commit: add2fe61292eb68dbd50d0db4b32d3b0b5733010
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
[32m✓ built in 1.64s[39m
~~~
## Gameplay rules (tail)
~~~
# Subtest: M249 and PKM have extra viewmodel firing motion and gun flash
ok 32 - M249 and PKM have extra viewmodel firing motion and gun flash
  ---
  duration_ms: 0.151668
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
# duration_ms 4293.17811
~~~
## Regression test output (tail)
~~~
  ...
# Subtest: eight zombies separate into a moving group while navigating a roof ramp
not ok 62 - eight zombies separate into a moving group while navigating a roof ramp
  ---
  duration_ms: 131.313476
  type: 'test'
  location: '/home/runner/work/hahadog/hahadog/tests/zombie-navigation.test.mjs:74:1'
  failureType: 'testCodeFailure'
  error: |-
    The expression evaluated to a falsy value:
    
      assert.ok(canOccupyAt(z.x,z.z,z.y,.36))
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (file:///home/runner/work/hahadog/hahadog/tests/zombie-navigation.test.mjs:83:14)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: navigation targets can be updated when a player moves to a different floor
ok 64 - spatial hash creates local separation, but zombies on other floors do not repel
  ---
  duration_ms: 0.285918
  type: 'test'
  ...
# Subtest: server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
ok 65 - server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
  ---
  duration_ms: 0.528012
  type: 'test'
  ...
1..65
# tests 69
# suites 0
# pass 68
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 5911.515966
~~~
