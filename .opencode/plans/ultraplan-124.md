# Ultraplan — 124 improvements (tracked execution state)

Grounding: Core Web Vitals 2026 checklists, game-juice trauma model +
intention matrix, WCAG 2.2 criteria. Executed in waves by the agent team;
every batch passes verifier + reviewer before commit. Progress is marked
[ ] → [x] here so state survives compaction.

Legend: P0 critical · P1 high · P2 medium · P3 polish/skip-ok
Roles: B=builder · V=verifier · R=reviewer · O=orchestrator · Sc=scout

## A — Performance / Core Web Vitals
- [x] A1 (P0,B) preload Determination Mono woff2 crossorigin — 3e20703
- [ ] A2 (P1,B) font-display audit; optional for body faces
- [ ] A3 (P1,B) fallback metric overrides vs Pixelify Sans
- [ ] A4 (P0,O) identify LCP element; fetchpriority/preload it
- [x] A5 (P0,O) width/height on all <img> — 3e20703
- [ ] A6 (P1,O) loading=lazy below-fold imgs
- [x] A7 (P2,O) decoding=async decorative imgs — 3e20703
- [ ] A8 (P2,B) split critical CSS + deferred rest (no build step)
- [ ] A9 (P1,O) prune unused preconnect origins
- [ ] A10 (P2,B) boot long-task audit >50ms slicing
- [x] A11 (P2,B) passive listener audit — B1
- [ ] A12 (P3,V) HTTP/3 verification measurement
- [x] A13 (P1,B) gzipped budgets top-5 JS in fixes17 — B1
- [ ] A14 (P1,V) post-fix CWV re-measure into ledger

## B — Game feel / juice
- [x] B1 (P1,B) hit-stop/shake/particle tier audit vs preset table — B1
- [ ] B2 (P2,B) directional shake bias along impact vector
- [x] B3 (P2,B) camera kick on gunfire/landings — engine v2
- [ ] B4 (P1,B) ±5-10% pitch variance pooled sfx
- [ ] B5 (P3,B) layered one-shots boss hits (transient/body/tail)
- [ ] B6 (P2,B) damage-number pops w/ drift (SC fight)
- [ ] B7 (P2,B) rising charge-loop sound polt telegraph
- [ ] B8 (P2,B) phase-change music stingers
- [x] B9 (P1,B) settings toggles: hit-stop + particles — 673f872
- [x] B10 (P3,B) squash-stretch walk landings — engine v2
- [ ] B11 (P3,B) standard UI hover/press tone pair
- [ ] B12 (P2,B) low-HP heartbeat cue bullet room

## C — Accessibility / WCAG 2.2
- [ ] C1 (P0,Sc/V) axe scan baseline; fix criticals
- [x] C2 (P0,B) focus-visible ≥3:1 everywhere — 4be0442
- [x] C3 (P2,B) forced-colors pass — 4be0442
- [x] C4 (P3,B) prefers-contrast support — 4be0442
- [ ] C5 (P1,B) target-size ≥24px audit incl tpad
- [ ] C6 (P2,B) drag-alternative codified test (sword throw)
- [x] C7 (P1,B) one-interaction global mute anywhere — B1
- [ ] C8 (P1,B) quiz relaxed-timer toggle
- [ ] C9 (P1,B) dialogue aria-live mirror
- [ ] C10 (P2,B) bullet HP/score live region
- [ ] C11 (P2,V) overlay focus-trap audit incl tbox/tpad — partial: confirmExit is an alertdialog with focus + Tab trap; shop/panel not trapped
- [ ] C12 (P3,V) lang attribute audit

## D — PWA / install
- [ ] D1 (P1,B) 512 maskable icon
- [ ] D2 (P3,B) manifest shortcuts
- [ ] D3 (P2,B) display_override fullscreen eval
- [ ] D4 (P2,B) theme-color media variants
- [x] D5 (P1,O) themed /404.html — 3e20703
- [ ] D6 (P2,B) beforeinstallprompt button
- [ ] D7 (P3,B) apple-touch 152/167 variants
- [ ] D8 (P2,B) manifest id+scope verify

## E — SEO / discovery
- [x] E1 (P2,O) llms.txt — 3e20703
- [x] E2 (P3,O) humans.txt — 3e20703
- [x] E3 (P2,O) twitter:image:alt — 3e20703
- [x] E4 (P3,O) og:locale — 3e20703
- [x] E5 (P2,O) robots max-image-preview:large — 3e20703
- [ ] E6 (P2,O) sitemap lastmod protocol doc
- [ ] E7 (P3,U) GSC verification meta (user account)
- [ ] E8 (P3,V) description/title length tune

## F — Architecture / code quality
- [x] F1 (P0,B) engine.js:406 const→var — this commit
- [ ] F2 (P2,B) danmaku shard cache key +time-bucket
- [x] F3 (P2,B) music voice reap off-rAF — B1
- [ ] F4 (P1,B) later() scene-scoped timer helper + migrate W5/W6-class sites — partial: engine api.later for rooms; sans.js sites not migrated
- [ ] F5 (P1,B) persist opt_charge at charge/dock
- [ ] F6 (P2,B) shopStep from save flags
- [x] F7 (P0,B) ES5 regex gate in run-all — B1
- [ ] F8 (P2,B) dead-code prune inventory
- [x] F9 (P3,B) listener-count drift detector — B1
- [x] F10 (P2,V) load-order doc vs index.html assert — B1
- [x] F11 (P3,O) TILE/REACH cross-ref comment contract — engine v2
- [x] F12 (P1,B) duplicate var-declaration detector — B1

## G — Testing infra
- [x] G1 (P2,V) suite timing regression tracker — B1
- [x] G2 (P1,V) coverage matrix behavioral-vs-grep — B1
- [ ] G3 (P2,V) CDP probe env-opt-in suite
- [ ] G4 (P3,B) screenshot pixel-diff smoke
- [x] G5 (P2,B) fuzz: random keys no-NaN harness — B1
- [x] G6 (P1,B) save-migration fixtures — B1
- [x] G7 (P1,B) contrast assertions from CSS vars — B1
- [x] G8 (P2,B) budgets css≤100KB img≤400KB — B1
- [x] G9 (P2,B) seeded RNG util — B1
- [x] G10 (P3,V) runner 2-worker parallelization — B1

## H — Tooling / DevX
- [x] H1 (P2,O) newfix.mjs scaffold — B1
- [ ] H2 (P1,O) pre-commit hook gate
- [x] H3 (P1,O) staging-list single source file — B1
- [ ] H4 (P3,O) changelog generator
- [ ] H5 (P2,O) neu-docs sixth agent
- [ ] H6 (P3,O) log digest formatter
- [ ] H7 (P3,O) README badge script
- [ ] H8 (P3,O) _deploy rebuild drill doc

## I — Security / trust
- [ ] I1 (P1,B) SRI on jsDelivr three.js importmap
- [x] I2 (P2,O) referrer meta explicit — 3e20703
- [ ] I3 (P1,O) rel=noopener external links
- [ ] I4 (P3,B) report-only CSP eval
- [ ] I5 (P2,O) footer privacy/trust line
- [x] I6 (P2,O) AI-crawler allows in robots — 3e20703

## J — Content / design polish
- [x] J1 (P3,O) ::selection theming — 4be0442
- [x] J2 (P3,O) themed scrollbar — 4be0442
- [ ] J3 (P2,B) favicon prefers-color-scheme variant
- [ ] J4 (P3,B) print stylesheet easter egg
- [ ] J5 (P2,B) in-tone error overlay
- [ ] J6 (P3,V) konami-code audit
- [x] J7 (P1,O) public footer credits/attribution — 3e20703
- [ ] J8 (P2,V) dialogue proofread vs story.md

## K — Mobile deep-pass
- [ ] K1 (P2,B) portrait-fight hint overlay
- [ ] K2 (P3,B) navigator.vibrate hits behind noShake
- [ ] K3 (P1,V) installed-PWA standalone CDP check
- [ ] K4 (P3,B) saveData lighter boot
- [ ] K5 (P2,V) tpad thumb-overlap audit — partial: rooms frame around the pad; fight reserve unchanged
- [ ] K6 (P2,U+O) real-device matrix doc + manual protocol

## L — Audio / music
- [ ] L1 (P1,B) sfx loudness normalization
- [x] L2 (P1,B) M-key global mute persisted — B1
- [x] L3 (P2,B) duck attack/release ramp — B1
- [ ] L4 (P3,B) zone ambience one-shots — partial: per-zone visual atmosphere; no audio one-shots yet
- [ ] L5 (P3,V) equal-power crossfade audit
- [x] L6 (P2,V) loop-seam/dead-air check — B1

## M — Process / docs
- [ ] M1 (P3,O) decisions template
- [ ] M2 (P3,O) ADR numbering
- [ ] M3 (P2,O) AGENTS.md worked example
- [ ] M4 (P2,O) sprite provenance autogen
- [ ] M5 (P2,O) quarterly dep-review task
- [ ] M6 (P3,O) _deploy rebuild drill
- [ ] M7 (P1,O) incident playbook
- [ ] M8 (P2,O) memory retention policy
- [ ] M9 (P3,O) README badge script
- [ ] M10 (P2,O) public ROADMAP split
