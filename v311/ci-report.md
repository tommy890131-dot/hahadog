# V3.11 CI report
Source commit: e0205c78f9d06c8eed4ac69bb376791231d7b819
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
[32m✓[39m 76 modules transformed.
rendering chunks...
computing gzip size...
[2mdist/[22m[32mindex.html                 [39m[1m[2m    0.44 kB[22m[1m[22m[2m │ gzip:   0.34 kB[22m
[2mdist/[22m[2massets/[22m[35mindex-pdsy-Sx9.css  [39m[1m[2m   26.06 kB[22m[1m[22m[2m │ gzip:   7.11 kB[22m
[2mdist/[22m[2massets/[22m[36mindex-BZVrQ8Tu.js   [39m[1m[33m1,780.05 kB[39m[22m[2m │ gzip: 305.03 kB[22m
[33m
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.[39m
[32m✓ built in 1.98s[39m
~~~
## Gameplay rules (tail)
~~~
# Subtest: both crowd and rig renderers respect identical server facing without 180-degree offsets
ok 94 - both crowd and rig renderers respect identical server facing without 180-degree offsets
  ---
  duration_ms: 0.374514
  type: 'test'
  ...
1..94
# tests 94
# suites 0
# pass 94
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 4556.231732
~~~
## Regression test output (tail)
~~~
ok 64 - spatial hash creates local separation, but zombies on other floors do not repel
  ---
  duration_ms: 0.30513
  type: 'test'
  ...
# Subtest: server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
ok 65 - server includes zombie y in authoritative hitboxes, chase and snapshot; client interpolates y
  ---
  duration_ms: 0.538151
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
# duration_ms 6024.315718
~~~
