# V3.11 CI report
Source commit: 48a750da1454886ffd01855a9d2523b532252fe8
Rules: success
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
# Subtest: both crowd and rig renderers respect identical server facing without 180-degree offsets
ok 88 - both crowd and rig renderers respect identical server facing without 180-degree offsets
  ---
  duration_ms: 0.521614
  type: 'test'
  ...
1..88
# tests 88
# suites 0
# pass 88
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 4781.532291
~~~
## Regression test output (tail)
~~~
ok 64 - spatial hash creates local separation, but zombies on other floors do not repel
  ---
  duration_ms: 0.356486
  type: 'test'
  ...
# Subtest: server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
ok 65 - server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
  ---
  duration_ms: 0.732458
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
# duration_ms 6588.8648
~~~
