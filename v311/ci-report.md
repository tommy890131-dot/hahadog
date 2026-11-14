# V3.11 CI report
Source commit: 4b1da530cd66aea68c22cfac367325c6c40626fb
Rules: success
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
[32m✓[39m 65 modules transformed.
rendering chunks...
computing gzip size...
[2mdist/[22m[32mindex.html                 [39m[1m[2m    0.44 kB[22m[1m[22m[2m │ gzip:   0.34 kB[22m
[2mdist/[22m[2massets/[22m[35mindex-C7_PBWhh.css  [39m[1m[2m   23.51 kB[22m[1m[22m[2m │ gzip:   6.40 kB[22m
[2mdist/[22m[2massets/[22m[36mindex-DchOqOEM.js   [39m[1m[33m1,699.26 kB[39m[22m[2m │ gzip: 276.90 kB[22m
[33m
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.[39m
[32m✓ built in 1.30s[39m
~~~
## Gameplay rules (tail)
~~~
# Subtest: M249 and PKM have extra viewmodel firing motion and gun flash
ok 24 - M249 and PKM have extra viewmodel firing motion and gun flash
  ---
  duration_ms: 0.096507
  type: 'test'
  ...
1..24
# tests 24
# suites 0
# pass 24
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 4069.599209
~~~
## Regression test output (tail)
~~~
ok 64 - spatial hash creates local separation, but zombies on other floors do not repel
  ---
  duration_ms: 0.269357
  type: 'test'
  ...
# Subtest: server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
ok 65 - server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
  ---
  duration_ms: 0.480135
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
# duration_ms 5660.689803
~~~
