# Ultraplan — 124 improvements (tracked execution state)

Grounding: Core Web Vitals 2026 checklists, game-juice trauma model +
intention matrix, WCAG 2.2 criteria. Executed in waves by the agent team;
every batch passes verifier + reviewer before commit. Progress is marked
[ ] → [x] here so state survives compaction.

Legend: P0 critical · P1 high · P2 medium · P3 polish/skip-ok
Roles: B=builder · V=verifier · R=reviewer · O=orchestrator · Sc=scout

## A — Performance / Core Web Vitals
- [ ] A1 (P0,B) preload Determination Mono woff2 crossorigin
- [ ] A2 (P1,B) font-display audit; optional for body faces
- [ ] A3 (P1,B) fallback metric overrides vs Pixelify Sans
- [ ] A4 (P0,O) identify LCP element; fetchpriority/preload it
- [ ] A5 (P0,O) width/height on all <img>
- [ ] A6 (P1,O) loading=lazy below-fold imgs
- [ ] A7 (P2,O) decoding=async decorative imgs
- [ ] A8 (P2,B) split critical CSS + deferred rest (no build step)
- [ ] A9 (P1,O) prune unused preconnect origins
- [ ] A10 (P2,B) boot long-task audit >50ms slicing
- [ ] A11 (P2,B) passive listener audit
- [ ] A12 (P3,V) HTTP/3 verification measurement
- [ ] A13 (P1,B) gzipped budgets top-5 JS in fixes17
- [ ] A14 (P1,V) post-fix CWV re-measure into ledger

## B — Game feel / juice
- [ ] B1 (P1,B) hit-stop/shake/particle tier audit vs preset table
- [ ] B2 (P2,B) directional shake bias along impact vector
- [ ] B3 (P2,B) camera kick on gunfire/landings
- [ ] B4 (P1,B) ±5-10% pitch variance pooled sfx
- [ ] B5 (P3,B) layered one-shots boss hits (transient/body/tail)
- [ ] B6 (P2,B) damage-number pops w/ drift (SC fight)
- [ ] B7 (P2,B) rising charge-loop sound polt telegraph
- [ ] B8 (P2,B) phase-change music stingers
- [ ] B9 (P1,B) settings toggles: hit-stop + particles
- [ ] B10 (P3,B) squash-stretch walk landings
- [ ] B11 (P3,B) standard UI hover/press tone pair
- [ ] B12 (P2,B) low-HP heartbeat cue bullet room

## C — Accessibility / WCAG 2.2
- [ ] C1 (P0,Sc/V) axe scan baseline; fix criticals
- [ ] C2 (P0,B) focus-visible ≥3:1 everywhere
- [ ] C3 (P2,B) forced-colors pass
- [ ] C4 (P3,B) prefers-contrast support
- [ ] C5 (P1,B) target-size ≥24px audit incl tpad
- [ ] C6 (P2,B) drag-alternative codified test (sword throw)
- [ ] C7 (P1,B) one-interaction global mute anywhere
- [ ] C8 (P1,B) quiz relaxed-timer toggle
- [ ] C9 (P1,B) dialogue aria-live mirror
- [ ] C10 (P2,B) bullet HP/score live region
- [ ] C11 (P2,V) overlay focus-trap audit incl tbox/tpad
- [ ] C12 (P3,V) lang attribute audit

## D — PWA / install
- [ ] D1 (P1,B) 512 maskable icon
- [ ] D2 (P3,B) manifest shortcuts
- [ ] D3 (P2,B) display_override fullscreen eval
- [ ] D4 (P2,B) theme-color media variants
- [ ] D5 (P1,O) themed /404.html
- [ ] D6 (P2,B) beforeinstallprompt button
- [ ] D7 (P3,B) apple-touch 152/167 variants
- [ ] D8 (P2,B) manifest id+scope verify

## E — SEO / discovery
- [ ] E1 (P2,O) llms.txt
- [ ] E2 (P3,O) humans.txt
- [ ] E3 (P2,O) twitter:image:alt
- [ ] E4 (P3,O) og:locale
- [ ] E5 (P2,O) robots max-image-preview:large
- [ ] E6 (P2,O) sitemap lastmod protocol doc
- [ ] E7 (P3,U) GSC verification meta (user account)
- [ ] E8 (P3,V) description/title length tune

## F — Architecture / code quality
- [ ] F1 (P0,B) engine.js:406 const→var
- [ ] F2 (P2,B) danmaku shard cache key +time-bucket
- [ ] F3 (P2,B) music voice reap off-rAF
- [ ] F4 (P1,B) later() scene-scoped timer helper + migrate W5/W6-class sites
- [ ] F5 (P1,B) persist opt_charge at charge/dock
- [ ] F6 (P2,B) shopStep from save flags
- [ ] F7 (P0,B) ES5 regex gate in run-all
- [ ] F8 (P2,B) dead-code prune inventory
- [ ] F9 (P3,B) listener-count drift detector
- [ ] F10 (P2,V) load-order doc vs index.html assert
- [ ] F11 (P3,O) TILE/REACH cross-ref comment contract
- [ ] F12 (P1,B) duplicate var-declaration detector

## G — Testing infra
- [ ] G1 (P2,V) suite timing regression tracker
- [ ] G2 (P1,V) coverage matrix behavioral-vs-grep
- [ ] G3 (P2,V) CDP probe env-opt-in suite
- [ ] G4 (P3,B) screenshot pixel-diff smoke
- [ ] G5 (P2,B) fuzz: random keys no-NaN harness
- [ ] G6 (P1,B) save-migration fixtures
- [ ] G7 (P1,B) contrast assertions from CSS vars
- [ ] G8 (P2,B) budgets css≤100KB img≤400KB
- [ ] G9 (P2,B) seeded RNG util
- [ ] G10 (P3,V) runner 2-worker parallelization

## H — Tooling / DevX
- [ ] H1 (P2,O) newfix.mjs scaffold
- [ ] H2 (P1,O) pre-commit hook gate
- [ ] H3 (P1,O) staging-list single source file
- [ ] H4 (P3,O) changelog generator
- [ ] H5 (P2,O) neu-docs sixth agent
- [ ] H6 (P3,O) log digest formatter
- [ ] H7 (P3,O) README badge script
- [ ] H8 (P3,O) _deploy rebuild drill doc

## I — Security / trust
- [ ] I1 (P1,B) SRI on jsDelivr three.js importmap
- [ ] I2 (P2,O) referrer meta explicit
- [ ] I3 (P1,O) rel=noopener external links
- [ ] I4 (P3,B) report-only CSP eval
- [ ] I5 (P2,O) footer privacy/trust line
- [ ] I6 (P2,O) AI-crawler allows in robots

## J — Content / design polish
- [ ] J1 (P3,O) ::selection theming
- [ ] J2 (P3,O) themed scrollbar
- [ ] J3 (P2,B) favicon prefers-color-scheme variant
- [ ] J4 (P3,B) print stylesheet easter egg
- [ ] J5 (P2,B) in-tone error overlay
- [ ] J6 (P3,V) konami-code audit
- [ ] J7 (P1,O) public footer credits/attribution
- [ ] J8 (P2,V) dialogue proofread vs story.md

## K — Mobile deep-pass
- [ ] K1 (P2,B) portrait-fight hint overlay
- [ ] K2 (P3,B) navigator.vibrate hits behind noShake
- [ ] K3 (P1,V) installed-PWA standalone CDP check
- [ ] K4 (P3,B) saveData lighter boot
- [ ] K5 (P2,V) tpad thumb-overlap audit
- [ ] K6 (P2,U+O) real-device matrix doc + manual protocol

## L — Audio / music
- [ ] L1 (P1,B) sfx loudness normalization
- [ ] L2 (P1,B) M-key global mute persisted
- [ ] L3 (P2,B) duck attack/release ramp
- [ ] L4 (P3,B) zone ambience one-shots
- [ ] L5 (P3,V) equal-power crossfade audit
- [ ] L6 (P2,V) loop-seam/dead-air check

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
