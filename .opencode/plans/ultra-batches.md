# Ultraplan — batch work orders (synthesis of Wave A, 2026-10-23)

Wave A: three read-only Haiku scouts audited the ~100 open items in
`ultraplan-124.md` (full tables kept in the session scratchpad). This file is
the ONE work order per AGENTS.md: what gets built, by whom, in which files,
and how it is proven. Builders are Haiku 5.5. Each builder runs in its own git
worktree, does not commit, and hands back an uncommitted diff. The
orchestrator applies that diff, runs the gate, reviews it and commits it.

## Global rules for every builder
- ES5 in `js/`: `var`/`function` only. No arrows, `let`/`const`, template
  literals, classes, `?.`, or spread. No build step. Tests (`tests/*.mjs`)
  may use modern JS.
- Font sizes are multiples of 16px. Any motion respects
  `prefers-reduced-motion`. New feedback respects the `noShake`, `noFlash`,
  reduce-hit-stop and reduce-particles switches.
- Never touch: `memory/ .github/ manifest.json robots.txt sitemap.xml og.png
  CNAME fonts/ AGENTS.md`.
- TDD. Write the new suite first with the standard jsdom harness (copy
  `boot()` from `tests/fixes21.mjs`, including the `<noscript>` strip) and
  watch it fail. Then implement. Then run your suite plus every existing
  suite named in your order, plus `node --check` on each touched js file.
- New suites use the numbers assigned below so parallel builders never
  collide.

## Wave B1 — parallel, disjoint files

| Order | Items | Files | New suite |
|---|---|---|---|
| **W1a runner** | F7 ES5 gate · F12 duplicate top-level `var`/`function` detector · G10 2-worker pool · G1 timing history with a WARN at >2× median | `tests/run-all.mjs` | (none; self-test by planting a violation in a temp copy) |
| **W1b suites I** | G6 save-migration fixtures · G7 contrast from CSS tokens · G8 budgets (css ≤100 KiB, each img ≤400 KB) + A13 gzip budgets for the top-5 JS + total · H3 interim stage-list ⇄ disk equality | `tests/fixes23.mjs` (G6), `tests/fixtures/save-v1.json`, `tests/fixes24.mjs` (G7), `tests/fixes25.mjs` (G8, A13, H3) | 23, 24, 25 |
| **W1c suites II** | F10 load-order fixture · B1 hit/burst tier audit with an allowlist · L6 per-bar pad density · G9 seeded `Math.random` for the harness + G5 key fuzz (no NaN, no window error) · F9 listener drift · H1 `newfix.mjs` · G2 coverage matrix script | `tests/fixes26.mjs` (F10), `tests/fixes27.mjs` (B1, L6), `tests/lib/seed.mjs`, `tests/fixes28.mjs` (G5), `tests/fixes29.mjs` (F9), `tests/newfix.mjs`, `tests/coverage-matrix.mjs` | 26–29 |
| **W2a audio** | L2+C7 `m` mute, persisted as `opt_mute`, plus a mute button in `.ctl` · L3 duck 0.12 s attack / 0.5 s release · F3 voice reap on the audio clock · A11 passive `touchstart` · L5 equal-power crossfade **only if music.js stays < 24 KiB** | `js/core/music.js`, `js/core/settings.js` (keydown only), `index.html` (`.ctl` button), `css/style.css` (that button) | 30 |
| **W2b juice** | B2 directional shake bias · K2 `navigator.vibrate` on large/huge behind noShake | `js/core/juice.js` | 31 |
| **W2c sfx** | B4 boss .ogg pitch scatter · B7 polt rising telegraph `NEU.sfx.rise` · B8 phase stingers `NEU.sfx.stinger` · B12 low-HP heartbeat `NEU.sfx.heart` | `js/game/sans.js` (sfx section only), `js/act4/boss-scal.js` (`sfxPlay` + phase-2 line only), `js/act4/boss-polt.js`, `js/game/bullet.js` (heartbeat only) | 32 |

## Wave B2 — after B1 is merged

| Order | Items | Files | Suite |
|---|---|---|---|
| **W3 a11y/page** | C5 `.crack` 24px hit area · C8 relaxed quiz timer switch (`opt_relaxedQuiz`, 24s; update fixes12's switch count to 7) · C9 `#tbox` screen-reader mirror · C10 bullet live region · A6 lazy imgs (contact + hidden overlays only, checked against `drawImage` users) · A9 jsDelivr preconnect · I5 privacy line · J4 print stylesheet | `css/style.css`, `js/core/settings.js`, `js/act4/quiz.js`, `index.html`, `js/game/sans.js` (tbox only), `js/game/bullet.js` (live region only), `tests/fixes12.mjs` | 33 |
| **W4 fixes** | F2 shard cache reset · F5 persist console charge (`opt_charge`) · F6 `shop_seen` flag · F8 delete `seedDebris`/`renderWorks` if truly dead · M4(1) dangling citation in sheets.js · K1 portrait-fight hint · K5 pad-aware fight reserve | `js/core/danmaku.js`, `js/game/bullet.js`, `js/game/sans.js` (dock only), `js/act4/rooms-d.js`, `js/game/dark.js`, `js/page/main.js`, `js/data/sheets.js`, `js/core/touch.js`, `css/style.css`, `js/act4/boss-scal.js` (reserve only) | 34 |
| **W5 proofread** | J8: read-only sweep of dialogue vs `memory/story.md` → typo list with file:line. The orchestrator applies typo fixes only | none | — |

## Orchestrator (not delegated)
- **Manifest and icons:** D1 512 maskable icon, D8 manifest `id`/`scope`.
- **Network-facing:** I1 SRI hashes on the importmap; A2 `font-display`
  in `fonts/`.
- **Docs:** E6 lastmod rule; F10 correction of `memory/architecture.md`.
- **Tooling:** H2 `.githooks/pre-commit`; H4 changelog; H5 neu-docs agent;
  H7 badges.
- **Process:** M1/M2 decisions template + ADR numbering; M3 worked
  example; M7 incident playbook; M8 retention policy; M4(2) provenance
  generator.
- **Measurements:** C1 axe baseline (Chromium is at `/opt/pw-browsers`);
  A10 long tasks; A14 lab CWV.

## Folded into engine v2 (`engine-v2.md`)
F1 (already fixed) · F4 `api.later` · F11 · B3 · B10 · L4 · K5 for rooms ·
C11 focus handling in `confirmExit`.

## Not doing now
- **Needs you:**
  - an account or token: E7;
  - a real device or a live deploy: A12, A14 (field), K3, K6;
  - copy or taste calls: E8, B5, B11, L1, D3, K4;
  - scheduled tasks or what's public: M5, M10, H8/M6.
- **Skipped:** A8, D2, D7, J3, J6, I4, H6, G4, A3 (no fontTools), A4
  (font licence).
- **Duplicates:** M9 = H7, M6 = H8.
