# V3.11 CI report
Source commit: fc8f2b1065d69df1900b5f4a2e9ff024afea862a
Rules: success
TypeScript/Vite: success
Existing game regression: cancelled

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
[2mdist/[22m[2massets/[22m[36mindex-D92i80Jn.js   [39m[1m[33m1,693.34 kB[39m[22m[2m │ gzip: 274.98 kB[22m
[33m
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.[39m
[32m✓ built in 1.55s[39m
~~~
## Gameplay rules (tail)
~~~
# Subtest: V3.11 real WebSocket room supports class, mission, and authoritative defense request
ok 18 - V3.11 real WebSocket room supports class, mission, and authoritative defense request
  ---
  duration_ms: 695.915219
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
# duration_ms 4363.370818
~~~
## Regression test output (tail)
~~~
ok 64 - spatial hash creates local separation, but zombies on other floors do not repel
  ---
  duration_ms: 0.26686
  type: 'test'
  ...
# Subtest: server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
ok 65 - server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
  ---
  duration_ms: 0.495954
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
# duration_ms 5818.739776
~~~
