# V3.11 CI report
Source commit: 4bffebfcf1625438de0f88269dbe633ec085a1bd
Rules: success
TypeScript/Vite: failure
Existing game regression: success

## Build output (tail)
~~~

> deadline-four-v3-9-tactical-shop@3.9.2 build
> npm run build -w @deadline/client


> @deadline/client@3.9.2 build
> tsc --noEmit && vite build

src/game/WeaponViewmodel.ts(87,20): error TS6133: 'muzzleWorld' is declared but its value is never read.
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
ok 44 - both crowd and rig renderers respect identical server facing without 180-degree offsets
  ---
  duration_ms: 0.440604
  type: 'test'
  ...
1..44
# tests 44
# suites 0
# pass 44
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 4571.519026
~~~
## Regression test output (tail)
~~~
ok 64 - spatial hash creates local separation, but zombies on other floors do not repel
  ---
  duration_ms: 0.318284
  type: 'test'
  ...
# Subtest: server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
ok 65 - server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
  ---
  duration_ms: 0.54151
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
# duration_ms 6020.861415
~~~
