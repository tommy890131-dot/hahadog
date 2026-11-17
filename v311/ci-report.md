# V3.11 CI report
Source commit: da0d05d63fdce7558b82a859701af09d9c4ec4f0
Rules: failure
TypeScript/Vite: failure
Existing game regression: success

## Build output (tail)
~~~

> deadline-four-v3-9-tactical-shop@3.9.2 build
> npm run build -w @deadline/client


> @deadline/client@3.9.2 build
> tsc --noEmit && vite build

src/world/BlackoutWorldVisuals.ts(2,32): error TS6196: 'WorldDevice' is declared but never used.
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
ok 55 - both crowd and rig renderers respect identical server facing without 180-degree offsets
  ---
  duration_ms: 0.547062
  type: 'test'
  ...
1..55
# tests 55
# suites 0
# pass 54
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 4689.992125
~~~
## Regression test output (tail)
~~~
ok 64 - spatial hash creates local separation, but zombies on other floors do not repel
  ---
  duration_ms: 0.335557
  type: 'test'
  ...
# Subtest: server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
ok 65 - server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
  ---
  duration_ms: 0.642261
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
# duration_ms 6471.914991
~~~
