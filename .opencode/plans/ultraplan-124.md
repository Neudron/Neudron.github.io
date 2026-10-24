# Ultraplan — 124 improvements (tracked execution state)

Grounding: Core Web Vitals 2026 checklists, game-juice trauma model +
intention matrix, WCAG 2.2 criteria. Executed in waves by the agent team;
every batch passes verifier + reviewer before commit. Progress is marked
[ ] → [x] here so state survives compaction.

Legend: P0 critical · P1 high · P2 medium · P3 polish/skip-ok
Roles: B=builder · V=verifier · R=reviewer · O=orchestrator · Sc=scout

## A — Performance / Core Web Vitals
- [x] A1 (P0,B) preload Determination Mono woff2 crossorigin — 3e20703
- [x] A2 (P1,B) font-display audit; optional for body faces — orch
- [x] A3 (P1,B) fallback metric overrides vs Pixelify Sans — orch: local Courier/Arial faces sized to the real metrics (fontTools); Chromium: 1439.7 vs 1440 px and 1117.9 vs 1118 px, same line box; fixes39
- [x] A4 (P0,O) identify LCP element; fetchpriority/preload it — orch: the LCP is the boot mark (text, lab 80–168ms); its face is already preloaded (index.html:30); there is no LCP image to prioritise
- [x] A5 (P0,O) width/height on all <img> — 3e20703
- [x] A6 (P1,O) loading=lazy below-fold imgs — B2 W3
- [x] A7 (P2,O) decoding=async decorative imgs — 3e20703
- [x] A8 (P2,B) split critical CSS + deferred rest (no build step) — won't do: lab LCP is already 80–168 ms, and a hand-split with no build step would duplicate rules nothing keeps in sync
- [x] A9 (P1,O) prune unused preconnect origins — B2 W3
- [x] A10 (P2,B) boot long-task audit >50ms slicing — orch: attributed to WebGL; compileAsync; real-GPU measure open
- [x] A11 (P2,B) passive listener audit — B1
- [ ] A12 (P3,V) HTTP/3 verification measurement
- [x] A13 (P1,B) gzipped budgets top-5 JS in fixes17 — B1
- [x] A14 (P1,V) post-fix CWV re-measure into ledger — orch: lab only (LCP ≤168ms, CLS 0); field needs deploy

## B — Game feel / juice
- [x] B1 (P1,B) hit-stop/shake/particle tier audit vs preset table — B1
- [x] B2 (P2,B) directional shake bias along impact vector — W2b; bullet soul hit leans along the bullet
- [x] B3 (P2,B) camera kick on gunfire/landings — engine v2
- [x] B4 (P1,B) ±5-10% pitch variance pooled sfx — W2c (Calamitas pool ±5%; blips already had it)
- [ ] B5 (P3,B) layered one-shots boss hits (transient/body/tail)
- [ ] B6 (P2,B) damage-number pops w/ drift (SC fight)
- [x] B7 (P2,B) rising charge-loop sound polt telegraph — W2c
- [x] B8 (P2,B) phase-change music stingers — W2c (polt 2/3, Calamitas 2)
- [x] B9 (P1,B) settings toggles: hit-stop + particles — 673f872
- [x] B10 (P3,B) squash-stretch walk landings — engine v2
- [ ] B11 (P3,B) standard UI hover/press tone pair
- [x] B12 (P2,B) low-HP heartbeat cue bullet room — W2c

## C — Accessibility / WCAG 2.2
- [x] C1 (P0,Sc/V) axe scan baseline; fix criticals — orch: axe 0 violations
- [x] C2 (P0,B) focus-visible ≥3:1 everywhere — 4be0442
- [x] C3 (P2,B) forced-colors pass — 4be0442
- [x] C4 (P3,B) prefers-contrast support — 4be0442
- [ ] C5 (P1,B) target-size ≥24px audit incl tpad — open: .crack's clip-path also clips a ::before hit area; needs the paint moved to ::after
- [ ] C6 (P2,B) drag-alternative codified test (sword throw)
- [x] C7 (P1,B) one-interaction global mute anywhere — B1
- [x] C8 (P1,B) quiz relaxed-timer toggle — B2 W3
- [x] C9 (P1,B) dialogue aria-live mirror — B2 W3
- [x] C10 (P2,B) bullet HP/score live region — B2 W3
- [ ] C11 (P2,V) overlay focus-trap audit incl tbox/tpad — partial: confirmExit is an alertdialog with focus + Tab trap; shop/panel not trapped
- [x] C12 (P3,V) lang attribute audit — orch: `<html lang="en">`, no other-language passage in the page or the scripts

## D — PWA / install
- [x] D1 (P1,B) 512 maskable icon — orch
- [x] D2 (P3,B) manifest shortcuts — won't do: the installed app is one page; its sections are a scroll away, so a long-press menu adds nothing
- [ ] D3 (P2,B) display_override fullscreen eval
- [x] D4 (P2,B) theme-color media variants — orch: not applicable, the page has one scheme (no prefers-color-scheme anywhere); one theme-color is right
- [x] D5 (P1,O) themed /404.html — 3e20703
- [ ] D6 (P2,B) beforeinstallprompt button
- [x] D7 (P3,B) apple-touch 152/167 variants — won't do: iOS scales the single 180 px apple-touch-icon.png; 152/167 are legacy iPad sizes
- [x] D8 (P2,B) manifest id+scope verify — orch

## E — SEO / discovery
- [x] E1 (P2,O) llms.txt — 3e20703
- [x] E2 (P3,O) humans.txt — 3e20703
- [x] E3 (P2,O) twitter:image:alt — 3e20703
- [x] E4 (P3,O) og:locale — 3e20703
- [x] E5 (P2,O) robots max-image-preview:large — 3e20703
- [x] E6 (P2,O) sitemap lastmod protocol doc — orch
- [ ] E7 (P3,U) GSC verification meta (user account)
- [ ] E8 (P3,V) description/title length tune — measured: title "neu" (3 chars), description 37 chars, both well under the 60/160 limits; lengthening them is copy in your voice. Needs you

## F — Architecture / code quality
- [x] F1 (P0,B) engine.js:406 const→var — this commit
- [x] F2 (P2,B) danmaku shard cache key +time-bucket — W4 (cache dropped inside the 420ms held heart)
- [x] F3 (P2,B) music voice reap off-rAF — B1
- [ ] F4 (P1,B) later() scene-scoped timer helper + migrate W5/W6-class sites — partial: engine api.later for rooms; sans.js sites not migrated
- [x] F5 (P1,B) persist opt_charge at charge/dock — W4, flag renamed console_charge (opt_ is the settings namespace)
- [x] F6 (P2,B) shopStep from save flags — W4 (shop_seen)
- [x] F7 (P0,B) ES5 regex gate in run-all — B1
- [x] F8 (P2,B) dead-code prune inventory — W4: both candidates are live (dark.js seedDebris, main.js renderWorks); nothing to prune
- [x] F9 (P3,B) listener-count drift detector — B1
- [x] F10 (P2,V) load-order doc vs index.html assert — B1
- [x] F11 (P3,O) TILE/REACH cross-ref comment contract — engine v2
- [x] F12 (P1,B) duplicate var-declaration detector — B1

## G — Testing infra
- [x] G1 (P2,V) suite timing regression tracker — B1
- [x] G2 (P1,V) coverage matrix behavioral-vs-grep — B1
- [ ] G3 (P2,V) CDP probe env-opt-in suite
- [x] G4 (P3,B) screenshot pixel-diff smoke — won't do: the page animates end to end (stars, WebGL glass, room weather), so a pixel diff needs a frozen-frame mode the page does not have; playtest screenshots are reviewed by eye
- [x] G5 (P2,B) fuzz: random keys no-NaN harness — B1
- [x] G6 (P1,B) save-migration fixtures — B1
- [x] G7 (P1,B) contrast assertions from CSS vars — B1
- [x] G8 (P2,B) budgets css≤100KB img≤400KB — B1
- [x] G9 (P2,B) seeded RNG util — B1
- [x] G10 (P3,V) runner 2-worker parallelization — B1

## H — Tooling / DevX
- [x] H1 (P2,O) newfix.mjs scaffold — B1
- [x] H2 (P1,O) pre-commit hook gate — orch
- [x] H3 (P1,O) staging-list single source file — B1
- [x] H4 (P3,O) changelog generator — orch
- [x] H5 (P2,O) neu-docs sixth agent — orch
- [x] H6 (P3,O) log digest formatter — won't do: `.opencode/log/` is git-ignored and local by design (M8); the ledger that matters is memory/pending.md
- [x] H7 (P3,O) README badge script — orch
- [ ] H8 (P3,O) _deploy rebuild drill doc

## I — Security / trust
- [x] I1 (P1,B) SRI on jsDelivr three.js importmap — orch, verified both ways
- [x] I2 (P2,O) referrer meta explicit — 3e20703
- [x] I3 (P1,O) rel=noopener external links — orch: verified; the one static external link has rel="me noopener", main.js gives every script-made external link target=_blank + rel=noopener
- [x] I4 (P3,B) report-only CSP eval — orch: not possible here; Content-Security-Policy-Report-Only is header-only (a <meta> cannot carry it) and GitHub Pages sets no custom headers. An enforcing <meta> CSP is a separate call
- [x] I5 (P2,O) footer privacy/trust line — B2 W3
- [x] I6 (P2,O) AI-crawler allows in robots — 3e20703

## J — Content / design polish
- [x] J1 (P3,O) ::selection theming — 4be0442
- [x] J2 (P3,O) themed scrollbar — 4be0442
- [x] J3 (P2,B) favicon prefers-color-scheme variant — won't do: the inline SVG favicon carries its own dark plate (#08080B) and bone glyph, so it reads on light and dark tab strips alike
- [x] J4 (P3,B) print stylesheet easter egg — B2 W3
- [ ] J5 (P2,B) in-tone error overlay
- [x] J6 (P3,V) konami-code audit — orch: there is no Konami code; the one cheat is bullet.js's digit buffer "69420" (last five digits, only while a run is live, reset by begin(), no effect in endless). Digits only, so it never collides with movement, Esc, e or m
- [x] J7 (P1,O) public footer credits/attribution — 3e20703
- [x] J8 (P2,V) dialogue proofread vs story.md — W5 + orch

## K — Mobile deep-pass
- [x] K1 (P2,B) portrait-fight hint overlay — W4
- [x] K2 (P3,B) navigator.vibrate hits behind noShake — W2b
- [ ] K3 (P1,V) installed-PWA standalone CDP check
- [ ] K4 (P3,B) saveData lighter boot
- [ ] K5 (P2,V) tpad thumb-overlap audit — partial: rooms frame around the pad; fight reserve unchanged
- [ ] K6 (P2,U+O) real-device matrix doc + manual protocol

## L — Audio / music
- [ ] L1 (P1,B) sfx loudness normalization
- [x] L2 (P1,B) M-key global mute persisted — B1
- [x] L3 (P2,B) duck attack/release ramp — B1
- [ ] L4 (P3,B) zone ambience one-shots — partial: per-zone visual atmosphere; no audio one-shots yet. Needs you: sound-design taste, with B5/B11/L1
- [x] L5 (P3,V) equal-power crossfade audit — orch: zone crossfades are linear ramps over 1.1 s (music.js ramp()), about a 3 dB dip mid-fade on uncorrelated tracks; an equal-power curve (setValueCurveAtTime) needs ~200 B and music.js has 157 B left under its 24 KiB gate, so it is not changed
- [x] L6 (P2,V) loop-seam/dead-air check — B1

## M — Process / docs
- [x] M1 (P3,O) decisions template — orch
- [x] M2 (P3,O) ADR numbering — orch
- [x] M3 (P2,O) AGENTS.md worked example — orch
- [x] M4 (P2,O) sprite provenance autogen — orch
- [ ] M5 (P2,O) quarterly dep-review task
- [ ] M6 (P3,O) _deploy rebuild drill
- [x] M7 (P1,O) incident playbook — orch
- [x] M8 (P2,O) memory retention policy — orch
- [x] M9 (P3,O) README badge script — duplicate of H7 (`_scripts/badges.mjs`)
- [ ] M10 (P2,O) public ROADMAP split
