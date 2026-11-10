# Performance policy — baseline first

Recorded constraints: 60 Hz fixed simulation, 16 unit cells, variable presentation refresh, lazy-loaded game bundle and production `dist/` allowlist. The current `verify-dist` enforces game chunk <=1.5 MiB and shell chunk <=400 KiB (raw bundle sizes).

Capture on low-end mobile and desktop: median/p95/p99 frame time, dropped frames, draw time, active RAF loops, layout/reflows, memory, GC spikes, texture upload and scene switch duration. Include crack/dungeon, which had a prior loading/performance complaint.

Do not invent achieved 240fps. Target smooth 120/144/240Hz rendering *when hardware supports it* while fixed 60Hz logic stays deterministic. Profile with tools and retained traces; choose caching, culling, atlases, offscreen rendering or frame interpolation based on evidence, not aesthetic preference.

Regression gate: no new background continuous game processing while portfolio is idle; no visual-effects layer masking hazards; no new heavyweight renderer without compared frame-time measurements and stable controls.
