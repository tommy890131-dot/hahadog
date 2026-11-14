# V3.11 CI report
Source commit: d79e7548bc9a9d875b0c0b2804a90654a75dd7c9
Rules: failure
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
[2mdist/[22m[32mindex.html                 [39m[1m[2m    0.44 kB[22m[1m[22m[2m │ gzip:   0.34 kB[22m
[2mdist/[22m[2massets/[22m[35mindex-C7_PBWhh.css  [39m[1m[2m   23.51 kB[22m[1m[22m[2m │ gzip:   6.40 kB[22m
[2mdist/[22m[2massets/[22m[36mindex-8jCLABdq.js   [39m[1m[33m1,698.54 kB[39m[22m[2m │ gzip: 276.72 kB[22m
[33m
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.[39m
[32m✓ built in 1.54s[39m
~~~
## Gameplay rules (tail)
~~~
# Subtest: M249 and PKM have extra viewmodel firing motion and gun flash
ok 24 - M249 and PKM have extra viewmodel firing motion and gun flash
  ---
  duration_ms: 0.12106
  type: 'test'
  ...
1..24
# tests 24
# suites 0
# pass 23
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 4080.984081
~~~
## Regression test output (tail)
~~~
  ...
# Subtest: Render Blueprint uses one free Singapore Web Service and validates output
not ok 36 - Render Blueprint uses one free Singapore Web Service and validates output
  ---
  duration_ms: 0.99544
  type: 'test'
  location: '/home/runner/work/hahadog/hahadog/tests/render-deploy.test.mjs:21:1'
  failureType: 'testCodeFailure'
  error: 'buildCommand: bash scripts/render-build.sh'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (file:///home/runner/work/hahadog/hahadog/tests/render-deploy.test.mjs:23:193)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.start (node:internal/test_runner/test:944:17)
    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)
  ...
# Subtest: Render capacity environment limits rooms, zombies and connections without changing defaults
ok 37 - Render capacity environment limits rooms, zombies and connections without changing defaults
  ---
  duration_ms: 297.92669
  type: 'test'
  ...
# Subtest: server security and movement integrations
ok 64 - spatial hash creates local separation, but zombies on other floors do not repel
  ---
  duration_ms: 0.263452
  type: 'test'
  ...
# Subtest: server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
ok 65 - server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
  ---
  duration_ms: 0.511801
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
# duration_ms 5975.757325
~~~
