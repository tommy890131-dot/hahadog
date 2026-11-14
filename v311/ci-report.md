# V3.11 CI report
Source commit: c952f7db139254554327580d0fd532964cf24d0e
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
[32m✓[39m 64 modules transformed.
rendering chunks...
computing gzip size...
[2mdist/[22m[32mindex.html                 [39m[1m[2m    0.44 kB[22m[1m[22m[2m │ gzip:   0.33 kB[22m
[2mdist/[22m[2massets/[22m[35mindex-Cft-fPrK.css  [39m[1m[2m   21.35 kB[22m[1m[22m[2m │ gzip:   5.89 kB[22m
[2mdist/[22m[2massets/[22m[36mindex-BGpDBDn7.js   [39m[1m[33m1,694.47 kB[39m[22m[2m │ gzip: 275.35 kB[22m
[33m
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.[39m
[32m✓ built in 1.58s[39m
~~~
## Gameplay rules (tail)
~~~
# Subtest: V3.11 real WebSocket room supports class, mission, and authoritative defense request
ok 18 - V3.11 real WebSocket room supports class, mission, and authoritative defense request
  ---
  duration_ms: 417.739887
  type: 'test'
  ...
1..18
# tests 18
# suites 0
# pass 18
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 3994.606833
~~~
## Regression test output (tail)
~~~
  ...
# Subtest: Render Blueprint uses one free Singapore Web Service and validates output
not ok 36 - Render Blueprint uses one free Singapore Web Service and validates output
  ---
  duration_ms: 1.372383
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
  duration_ms: 309.757959
  type: 'test'
  ...
# Subtest: server security and movement integrations
ok 64 - spatial hash creates local separation, but zombies on other floors do not repel
  ---
  duration_ms: 0.304969
  type: 'test'
  ...
# Subtest: server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
ok 65 - server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
  ---
  duration_ms: 0.51885
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
# duration_ms 6033.526431
~~~
