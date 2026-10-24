# Pending — archived 2026-08

Closed dated sections moved out of `memory/pending.md` under the M8
retention rule (`memory/workflow.md`). Shipped and verified; nothing open.

## 2026-08-22 — input ownership + phone ergonomics

Two real bugs found by a jsdom probe that opened an overlay while the room
was still running and pressed Escape:

- **Escape bleed-through.** The engine's keydown yields only to
  `NEU.activeMinigame`, which `bullet.js` and `boss-scal.js` set — but shop,
  rhythm, craft and polt never did. One Escape reached both handlers: the
  room left underneath while the overlay asked "leave?". Declining stranded
  you in a dead room (rhythm's decline path), and craft's self-heal
  (`engine.enter` on close) had been papering over the same hole.
  **Fix:** all four now claim `NEU.activeMinigame` on open and release it on
  close, guarded so they only ever clear their own claim. fixes18 §17b pins
  all six claims.
- **shop.close() crashed every time.** It called `NEU.engine.busy(false)`,
  but `busy()` exists only on the rooms-only API object, not on public
  `NEU.engine`. Uncaught TypeError on every Escape/quit — masked, because
  `wrap.hidden = true` runs first. Line removed; nothing ever set busy(true).
- **Phone:** shop touch profile; `.tpad` spends `env(safe-area-inset-*)`
  (the meta viewport already asks for cover); `.eng` gains `100svh`; the
  fight quit button meets Apple's 44px target.
- **Runner:** `tests/run-all.mjs` — every suite with a hard 60s kill.
  fixes5 (~28s) and fixes18 (~30s) are legitimately slow jsdom boots and
  kept tripping short shell timeouts.

Later the same day, against goal "fully mobile + re-gather sprites":

- **Mobile verified on a real rendering engine**, not just jsdom:
  `_scripts/cdp-mobile.mjs` drives headless Chrome at 390×844 dpr3 with
  touch + coarse-pointer emulation over raw CDP (opensteer needs AF_UNIX,
  which Windows lacks). Results: thumb pad claims `engine`, switches to
  `shop` when the stall opens, engine survives beneath it; a real
  touch-event tap selects a shop row and produces its quip; board fits,
  rows are 46px tall; craft cells shrink to 98px; zero runtime errors.
  CSS fixes that came out of the audit: craft cells fluid
  (`min(104px, (100vw−96px)/3)` — 3×104px was wider than a 320px phone),
  `button { touch-action: manipulation }` so rapid taps never fire
  double-tap zoom, `.tpad` spends `env(safe-area-inset-*)`, `.eng`
  gained `100svh`.
- **Sprites re-gathered from source.** 47 verbatim textures from
  `CalamityTeam/CalamityModPublic @ 1.4.4` into gitignored
  `_sources/calamity/` (reproducible: `_scripts/fetch-sprite-sources.ps1`),
  then `_scripts/verify-sprites.mjs` decoded both sides and compared
  pixels: **37/37 shipped Calamity sprites are faithful** — 36 byte-exact,
  `BrimstoneHeart.png` equal after transparent-border trim, **zero
  mismatches**. The three TP files have no upstream: tp-bar is a recolor
  of RageBar (identical alpha mask); the 10-frame border and full-anim
  are Polterghast-styled wiki originals. Provenance written into
  `memory/assets.md`.
- **SEO surface shipped:** self-canonical + `WebSite` JSON-LD +
  `sitemap.xml` + robots `Sitemap:` line, all three URLs agreeing;
  fixes17 asserts agreement, parseability, staging, and live files.
- **Agent team stood up** (`AGENTS.md` is the contract): five workers in
  `.opencode/agents/` pinned to the same free model — scout/researcher
  (read-only, dispatched through the background-agents plugin's
  `delegate()` so results persist across compaction), builder (writes,
  plain `edit: allow` after glob-form permissions proved broken on
  Windows), verifier (bash allowlist), reviewer (binary SHIP/REJECT on a
  seven-item checklist; REJECT requires executable evidence or it is
  overruled). opencode-notify delivers Windows Toasts. Plugin sources were
  line-reviewed before install.
- **Pilot B shipped through the full pipeline** (builder → verifier →
  reviewer SHIP): the audio-unlock gate no longer latches — gestures retry
  `resume()` while suspended, `pointerup`/`touchend` join the capture pair
  as spec-guaranteed triggers, `navigator.audioSession.type='playback'`
  beats the iOS silent switch where supported, and backgrounding re-unlocks
  on visibilitychange. fixes16 §2b pins all of it (TDD: written RED first).
  A comment-only trim keeps music.js inside its 24 KB budget (24,460 B).
- **Scout wave + six-defect sweep shipped.** Two parallel scouts audited
  every module; 12 findings, 6 confirmed against source after
  orchestrator verification, fixed and gated (fixes18 §19 pins them):
  engine double-rAF on mid-room re-enter, settings is-playing strip,
  settings/dev Escape bleed-through into live rooms, boss-scal charge
  softlock on retry, polt stale charge timer across reopen, rhythm phase
  timer duplicating charts. Reviewer SHIP on both waves.
- **Wave C — full coverage reached, six more shipped** (71bf4c9): two
  further scouts closed the unread halves (sans/bullet/dark/deck and
  act4 rooms/craft/shop + page). Verified + fixed: endless-blackout
  story-chain leak, bullet ghost death loop, BL_HALF dead tuning revert,
  stacked loops from chip-spam opens, inert restored portal (Polterghast
  now re-summonable unless dead) + per-knock AudioContext leak, craft
  take() double-fire. fixes18 §20 (129 checks). Every js/ module has now
  been scouted at least once.
- **Wave D — cross-session softlock killed** (804394d): follow-up
  verification found the sleep→Switch→charge→dock chain living only in
  module vars — ANY refresh after "let them rest" booted an empty dock
  with no Switch while objectives said "dock it", and Act IV resumes
  solely through that dock's deck. Boot now re-arms the chain from its
  quest marks; an undocked console returns empty so the blaster
  re-earns charge. Also: reload mid-trip re-arms is-trip visuals
  (e6f6c3d). fixes18 §20 → 131 checks.
