# V3.11 CI report
Source commit: 50eaed2b219e58de3f99240b265e560fb1933007
Rules: failure
TypeScript/Vite: failure
Existing game regression: success

## Build output (tail)
~~~

> deadline-four-v3-9-tactical-shop@3.9.2 build
> npm run build -w @deadline/client


> @deadline/client@3.9.2 build
> tsc --noEmit && vite build

src/world/ArchitecturalRealism.ts(12,6): error TS6196: 'MeterBox' is declared but never used.
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
not ok 71 - AAA-style environment modeling uses GPU-instanced parts instead of thousands of individual meshes
  location: '/home/runner/work/hahadog/hahadog/v311/v314-environment-art.test.mjs:8:1'
  failureType: 'testCodeFailure'
  error: |-
  expected:
  actual: |-
# Subtest: both crowd and rig renderers respect identical server facing without 180-degree offsets
ok 94 - both crowd and rig renderers respect identical server facing without 180-degree offsets
  ---
  duration_ms: 0.339265
  type: 'test'
  ...
1..94
# tests 94
# suites 0
# pass 93
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 4483.468656
~~~
## Regression test output (tail)
~~~
ok 64 - spatial hash creates local separation, but zombies on other floors do not repel
  ---
  duration_ms: 0.304984
  type: 'test'
  ...
# Subtest: server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
ok 65 - server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
  ---
  duration_ms: 0.5441
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
# duration_ms 5851.457123
~~~
