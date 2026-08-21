# Pending

**`memory/PLAN.md` is the full handoff** — agent context, the phase plan, and
the traps. This is the ledger. Keep them in sync.

**Verified 2026-08-17**, by running every suite and grepping the source rather
than trusting the plan document.

---

## State

| | |
|---|---|
| Acts | I–IV complete. 31 rooms, 3 bosses, quiz, rhythm game, crafting grid, merchant shop |
| Tests | **1487 checks, 15 suites, all green** — re-verified 2026-08-22 via `node tests/run-all.mjs` (per-suite 60s timeout). fixes5 (53) fixes6 (48) fixes7 (73) fixes8 (104) fixes9 (70) fixes10 (97) fixes11 (75) fixes12 (63) fixes13 (79) fixes14 (70) fixes15 (112) fixes16 (185) **fixes17 (313)** fixes18 (100) playthrough (45). `reach.mjs` is a shared library, not a suite |
| Location | repo root at `Documents\neu` (site/ flattened to root 2026-08-21); tests in `tests/` |
| Deployed | ✅ **YES — 2026-08-21.** `cb5d599` live at **https://www.neu.ac**. Since then (2026-08-22, pushed same day): `c9d380b` ledger, `62eb514` **input-ownership fix** (see below), `81f5564` phone ergonomics CSS. Deploy workflow stages only web-facing files (`index.html css js fonts img audio CNAME .nojekyll og.png robots.txt manifest.json apple-touch-icon.png .well-known`) to `_stage/` before uploading — `memory/`, `tests/`, `_scripts/` never reach Pages. Verified: all JS files, sprites, tilesets, audio, og.png, robots.txt → 200; `memory/story.md` → 404 (walkthrough protected) |

**Phases 1–3 of PLAN.md are done and verified, plus 2.4, 2.5, 4a, 4b and 5:**

- `core/music.js` (2.4 / PLAN Phase 5b) is the Act IV soundtrack, and it is
  **entirely synthesised — zero bytes of audio are downloaded.** Eight tracks
  (six zones plus a track each for Calamitas and Polterghast), a lookahead
  scheduler stamped off `AudioContext.currentTime`, a 1.1s crossfade between
  zones, a duck to 34% while `#tbox` is up, and layers that arrive as a boss
  loses health. Like `touch.js` it **polls** rather than being called, so no
  scene was changed to add it. Six zone tracks are keyed by **tileset name**,
  read through a new one-line `engine.zone()`, so there is no second room→zone
  map to drift; fixes16 §4 asserts every registered tileset has a track.
  Volume is a slider in settings, persisted as `opt_music`.

- `core/touch.js` (2.5) gives all **ten** scenes thumb controls without changing
  one of them, by synthesising real KeyboardEvents. Writing its suite caught a
  profile sending `z` to `bullet.js`, which only listens for `Enter` — it
  would have looked correct and done nothing on a phone. The merchant shop
  joined 2026-08-22 (stick scrolls the board, take/back buttons), and the
  engine profile was demoted to fallback position so an open overlay can no
  longer be shadowed by the talk/reset pad while `NEU.engine.running` is
  still true underneath it.

- All six tilesets carry `src` + `rects` (Phase 4b). `engine.tilesets()` now
  exposes the registry so this is asserted at runtime, not just in the source
  text. Two bugs fell out of writing that suite: the altar plinth `A` had no
  colour and was rendering as the generic floor — a hole in the middle of b7 —
  and the deploy folder was staged to ship 13 MB of `tests/node_modules` plus
  2.5 MB of source atlases. A `.gitignore` now covers both; a fresh clone
  ships **1.8 MB**.

- `core/danmaku.js` exists; all three fights use it; none has a local `HEART`
  array; `bullet.js` reads `dm.IFRAMES` like the rest.
- `dark.js` has no `BODY_*` sprite arrays and no local `sweep`/`blocked`; it
  calls `engine.drawPlayer` twice.
- `core/settings.js` ships four switches — `noShake`, `noFlash`, **larger
  text** (`opt_largeText`, `html.text-lg { zoom: 1.25 }`) and **thumb
  controls**. They also now read their stored state back when the panel
  opens; before this they were built showing "off" and only ever changed by a
  click, so after a reload the panel lied about every setting.
- `css/style.css` has a table of contents at the top (line 11).
- Calamitas draws everything from her sheets via the shared `sprite(key,x,y,
  scale,rot,glow)` helper (2.1), and her six `.ogg` files play through the
  pooled pattern from `sans.js` (2.3).
- `tests/playthrough.mjs` walks Act I → IV, 45 checks.

---

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

---

## The table

Status: 🔴 blocked on Neu · 🟠 real gap · 🟡 polish · ⚪ decided, no action

| # | Item | Status | Where | Effort |
|---|---|---|---|---|
| **1.1** | ✅ **DONE. Acts I–IV are live** at https://www.neu.ac (`1c31455`). Pushed through `deploy.ps1`: lock sweep → syntax gate → mirror → shape check → leak check → confirm → push → verify. Verified against the live CDN both ways — everything new serves, nothing excluded leaked | ✅ | `_deploy\` | done |
| **1.2** | ✅ **DONE.** All five settled. Three by autocorrelation (`measure-sheets.mjs`), then `sepulcher` and `heart` by rendering them at 5x with the candidate cell rules drawn on and **looking** (`contact-sheet.mjs`). `sepulcher` was never 2 frames — it is one beetle head and the 44px rule cut it through the face. `heart` was never 5 — six beats on a 62px grid; its sheet had been trimmed 2 rows short of its own grid and was re-padded | ✅ | `data/sheets.js` | done |
| **1.3** | ✅ **DONE — they WERE swapped.** Confirmed twice: centre of mass (67% vs 45% down the cell) and then by eye at 4x. `Slash.png` is the lower jaw, `SlashAlt.png` the upper. **The plan's own fix was wrong** — it said swap the two `src` strings and nothing else, but the files are 168x240 and 192x232, so the geometry had to move with the src or each entry would hold the other's dimensions | ✅ | `data/sheets.js` | done |
| **1.4** | ✅ **DONE.** PR #1 (`copilot/link-neuac-domain`) is **closed, not merged** — confirmed via the API before the push. The 70-byte page never reached `main` | ✅ | GitHub | done |
| **1.5** | ✅ **DONE.** Verified rather than assumed: `http://www.neu.ac/` answers **301 → https://www.neu.ac/** | ✅ | Settings → Pages | done |
| **1.6** | ✅ **DONE.** The stray empty repo at `Documents\neu\.git` is **gone** — proved empty first (0 commits, refs, stashes, reflog entries, remotes, objects; fsck clean; only default scaffolding plus a `[user]` block), backed up whole to `_scripts\orig\stray-root-git-backup-2026-08-17.zip`, then removed. `_deploy` re-cloned from `Neudron/Neudron.github.io`, on `main` at `20213f3`, tree mirrored. The wrong staged commit in `%TEMP%\neu-pages` (a pre-reorg, pre-Act-IV tree of 64 files) was discarded. `_scripts\deploy.ps1` now does mirror → shape check → leak check → diff → **ask** → push → verify live. | ✅ | `_deploy\`, `_scripts\` | done |
| **2.1** | ✅ **DONE.** Calamitas draws from her sheets: `sprite(key,x,y,scale,rot,glow)` replaces `drawSheet`, projectiles (dart/hellblast/fireblast/gigablast) rotate to travel, brothers rotate to the player, Sepulcher, hearts and the won-state ashes all sprite; magenta + coloured-square fallbacks kept | ✅ | `act4/boss-scal.js` | done |
| **2.2** | ✅ **DONE.** All six zones draw real 16×16 art — `woods castle city home prize storm`, one sheet each in `img/act4/tiles/` (2.1 KB total). Tiles were scored out of the Deltarune atlases for opacity, interior variance and seam cost, then re-mapped onto the palette colour each char already had, so the texture is theirs and the tone is ours. `colours` kept as the fallback throughout | ✅ | `act4/rooms-*.js` | done |
| **2.3** | ✅ **DONE.** All six `audio/act4/*.ogg` play through the pooled pattern (4 copies each, volume 0.5, pools built in `open()`); each attack plays its own family, hits play the hit files | ✅ | `act4/boss-scal.js` | done |
| **2.4** | ✅ **DONE.** `core/music.js` — eight procedural tracks, **0 bytes of audio downloaded**. Zone tracks keyed by tileset name via a new `engine.zone()`; a 250ms poll picks the track so no scene changed; crossfade on zone change and no restart within one; ducks under the dialogue box; boss layers arrive as HP falls; the rhythm game is explicitly silenced so two tempos never fight. Volume slider in settings, persisted as `opt_music`. Adding the slider exposed a real bug in the Tab trap — it collected only `button`, so focus escaped an `aria-modal` dialog; now `button, input` | ✅ | `core/music.js` | done |
| **2.5** | ✅ **DONE.** `core/touch.js` draws a stick and buttons and synthesises real KeyboardEvents, so all **ten** scenes got touch without one of them changing. Vector stick with diagonals, focus (Shift) in the three bullet-hell fights, auto-repeat on the menu scenes only, and a single release path so a key can never stick. Auto-shows on a coarse pointer; `settings → thumb controls` overrides. 2026-08-22: shop profile added; engine profile moved to fallback so overlays always win | ✅ | `core/touch.js` | done |
| **2.6** | ✅ **DONE.** All seven redrawn from ASCII grids in `_scripts/make-sprites.mjs` and each one checked by rasterising it at 8x and looking. `dog` is Toby in profile with ear, eye, muzzle, haunch and tail, and **no expression** on purpose. `hand` **kept its original silhouette** — the redraw read as a stool and the old shape was better; only the shading stayed. One colour added to the palette: `#BFA98C`, a warm skin shadow, because the only mid-tone was a cool grey that reads as dirt on skin | ✅ | `img/`, `_scripts/` | done |
| **2.7** | ✅ **DONE.** All seven tiles have drawn sigils on one 48×48 grid, two colours each taken from the tile's own gradient. Each references something real: the stepped torch, the glass cube, the soul and its countdown. `sigil: true` is gone — presence in `SIGILS` is the switch. The initials fallback is kept | ✅ | `game/deck.js` | done |
| **3.1** | ✅ **DONE — this claim was wrong.** The verifier missed it: `settings.js` ships **all three** switches — `noShake`, `noFlash` and larger text (`settText` row, `opt_largeText`, `html.text-lg { zoom: 1.25 }`), tested in fixes12 §3 | ✅ | `core/settings.js` | done |
| **3.2** | ✅ **DONE.** `core/perf.js` + `fps` in the dev console. Samples nothing until asked; budget 16.7/20/33.3ms; per-scene attribution; ignores the huge frame a backgrounded tab returns. Judged on the **1% low**, not p95 — the suite caught p95 scoring a 90ms-per-second hitch as a clean 15ms | ✅ | `core/perf.js` | done |
| **3.3** | ✅ **DONE — this claim was wrong too.** `css/style.css` has a table of contents at line 11; the file is still ~1600 lines (splitting needs a build step, see 4.2) | ✅ | `css/style.css` | done |
| **3.4** | ✅ **DONE.** 772 → 154 lines: what it is, run it, test it, deploy it, layout, the rules, where the docs are. It had been documenting the **pre-reorg flat `js/` tree**. The old one is kept whole at `memory/build-notes.md` | ✅ | `README.md` | done |
| **3.5** | **Mostly DONE via headless-browser UAT (2026-08-19).** b2, b4, b5, b6 solved live over CDP; the SC fight opens, runs, and confirms exit live; all six W5 items ✅ (`memory/uat-w5.md`). What still needs human eyes: the soundtrack **out loud** (jsdom only proves the schedule) and a full phone walkthrough | 🟡 | — | 30 min |
| **3.6** | ✅ **DONE.** `bullet.js` reads `dm.IFRAMES || 1.15` at all three damage sites; the local copy is gone | ✅ | `game/bullet.js` | done |
| **3.7** | ✅ **DONE.** Restored to `.well-known/discord` (root after flatten), plus a zero-byte `.nojekyll` as insurance. **The usual explanation is wrong for this repo:** the Pages source is GitHub Actions and `deploy.yml` stages only web-facing files, so no Jekyll runs. `.nojekyll` only matters if someone switches the source back to "Deploy from a branch". Reasoning in `.well-known/README.md` | ✅ | `.well-known/` | done |
| **3.8** | ✅ **DONE.** All three read on 2026-08-17, verdicts in `PLAN.md` §1.10: `threejs-skills` maybe-later (the cube is finished), `threejs-game-skills` **no** (Vite + TypeScript + Playwright — a build step and a blocked browser), `OpenGame` **no** (an agentic framework with its own model, nothing to port). One idea salvaged: a seeded RNG for deterministic playtests | ✅ | `PLAN.md` §1.10 | done |
| **4.1** | `loader.js` dropped deliberately — boot carries ~30 KB more JS than the "+0 KB" target; the 302 KB of art is already lazy | ⚪ | `plan-act4.md` §9 | — |
| **4.2** | Splitting `style.css` would need a build step, which rule 2 forbids | ⚪ | — | — |
| **5.1** | ✅ **DONE.** Workshop repo at `Documents\neu` — `main`, 200 files, `0f37283`, no remote. Backs up `memory/` **and** `_scripts/`, which had no copy either. `site/memory/` is force-added because a nested `.gitignore` outranks the root; commit docs with `_scripts\backup-docs.ps1`, not raw `git add`. **Still local-only** — a private remote finishes it (needs the user: `gh` is not on PATH here) | ✅ | `Documents\neu` | done |
| **5.2** | ✅ **DONE — W5 regressions all green (2026-08-18).** The 19 SC/minigame bugs and their suites: fixes18 (89, incl. engine.js `e.stopPropagation()` on ESC-decline so confirm-exit cannot re-open); fixes13 (79, split sfx regexes, sprite 8-arg signature, bounded deterministic charge branch); fixes15 (106, profile-extraction regex now tolerates the `function () {}` bodies and Windows line endings); fixes16 (185, music.js LF-normalised back under its own 24 KB gate); **fixes8 (76, the whole SC fight incl. the §6b win path)** — hearts phase, both walls, both brothers, phase 2, all driven through synthesized keys; playthrough (45) | ✅ | `tests/fixes*.mjs` | done |
| **5.3** | ✅ **DONE — the castle's four block puzzles are now four real rooms, and the SC fight gained rage/tp (2026-08-19).** b2 riddle stones (press e, wrong dims, R resets with a 4s settle), b3 brazier order, b4 ice ring (engine ice-slide, slide-only plates armed only by a slide dying on them — plates sit on the last ice cell of each line), b5 mirror (b5face 0/1/2, the mirror is the second plate), b6 torch + socket (carry the light, seat it; `dark()`/`light(API)` hooks). SC: rage builds below full HP (full → +1 heart), tp builds by grazing (full + x → 2.5s shield that eats one hit), meters under the HP line. U5/U6: axe/recall/mushroom sprites attached via `sheet`; the `decor` entity type was **decided against** (no fake art — real sheets suffice). fixes8 grew from 76 → 99 checks covering all of it | ✅ | `act4/rooms-a.js`, `act4/rooms-d.js`, `act4/boss-scal.js`, `core/engine.js` | done |
| **5.4** | ✅ **DONE — W6 fixes and real-browser UAT (2026-08-19).** Ice-slide creep killed (`slideDead` — a slide only re-commits on a keypress on ice, and dies on keyup; north plate holds `x:176.1` vs 234.66 before). `talk.close()` added so the dialogue box can never outlive its room (fixes a mid-dialog room-exit hang). **Real level bug found and fixed by the browser drive: b4 was unsolvable** — the lower centre pillar at (7,6) physically blocked the west slide (the 8px player hitbox straddles rows, so a solid tile one row above the path freezes the slide forever, no die-check ever fires); pillar removed, room solves. Browser UAT via headless Chrome over CDP (native input — the engine ignores synthetic arrow events): b2, b4 (all three plates, no creep), b5, b6 solved live; SC fight opens, soul moves, 6 hearts orbit, ESC → confirm → Escape-no / Enter-yes both work live. All six W5 UAT items ✅ (ledger: `memory/uat-w5.md`). Suite total: **1440 checks, 15 suites green** | ✅ | `core/engine.js`, `game/sans.js`, `act4/rooms-a.js`, `tests/fixes8.mjs`, `tests/fixes18.mjs` | done |

---

## Suggested order

1. ✅ ~~1.1–1.6~~ **all done.** The site is live and the deploy path is sane.
   **Everything that is left is 3.5: play it.**
2. ✅ ~~2.1 + 2.3~~ **done** — Calamitas's projectiles and her six sounds.
3. ✅ ~~2.2~~ **done** — the tilesets. Six zones are places now, not colours.
4. ✅ ~~2.5~~ **done** — touch. Act IV is playable on a phone now.
5. ✅ ~~2.4~~ **done** — music. Act IV has a soundtrack that costs nothing to
   download and answers the fight.
6. **3.x** — ✅ all done. 3.2 (fps meter in `core/perf.js`, p50/p95/worst ms,
   rAF only while on) and 3.4 (`README.md` rewritten for a stranger) are both
   shipped and verified by fixes17. The seven "placeholder" sprites (2.7/4c)
   are real hand-crafted pixel-art SVGs with multiple colour shades and aria
   labels — not blanks. Deck cover art (2.6/4d) is DONE with unique inline
   SVG sigils. The only remaining item is **3.5: a manual playthrough** — and
   it matters more than ever, because **nobody has heard the soundtrack out
   loud.** Every check on it is jsdom against a recording stub, which proves
   the schedule and proves nothing about whether the castle track is any good.
7. ✅ ~~2.6 / 2.7~~ **done** — the seven sprites are real pixel-art SVGs, and
   the deck covers have unique inline SVG sigils.

## The docs backup — ✅ RESOLVED 2026-08-17

**The gap.** Two changes made the same day compounded: `memory/` went into
`site/.gitignore` (so it left the Pages repo), and the stray empty repo at
`Documents\neu\.git` was removed (so `site/` was in no repo at all). Neither
was wrong alone. Together they left 3,600 lines of documentation with **no
version history and no copy anywhere.**

**Neu chose:** a local repo at `Documents\neu`. Done — `main`, 200 files,
commit `0f37283`, **no remote**.

It covers `site/` *and* `_scripts/`, which mattered more than expected:
`_scripts/` sits outside `site/`, so `deploy.ps1`, `make-sprites.mjs`,
`measure-sheets.mjs` and `contact-sheet.mjs` had no backup either.

### The trap this hit, which is worth knowing

`site/memory/` had to be **force-added**. Git gives a lower-level
`.gitignore` precedence over a parent's, so the `memory/` line in
`site/.gitignore` *also* hides `memory/` from the repo one level up — the
repo whose only purpose is to back it up. A root-level `!site/memory/`
does not help; the nested rule wins.

The first `git add -A` staged 186 files and **zero** of them were the docs.
It reported success.

Tracked files are safe from here (`.gitignore` only affects untracked
files), but a **new** file inside `memory/` will be skipped again. So:

> **Use `_scripts\backup-docs.ps1` to commit docs**, not raw `git add`. It
> force-adds `site\memory`, then asserts at least 10 files are tracked
> there and stops if not — because a backup that silently backs up nothing
> is worse than no backup. fixes17 §11 asserts the script still does both.

### Still open: it is local-only

There is history now, but still no copy off the machine. To finish it,
create a **private** repo and:

```
cd Documents\neu
git remote add origin git@github.com:Neudron/neu-workshop.git
git push -u origin main
```

**It must be private.** It contains `story.md`. A public remote here undoes
the entire reason `memory/` was excluded from the site. `backup-docs.ps1`
warns if it ever finds a remote.

## 3.7 — `.well-known/discord`, and what I would do

Not decided here, because it is a question about Neu's Discord, not about the
site. The file is one line:

```
dh=151b828c6e55c3702e27116567fa39193dd90841
```

That is a Discord **domain-verification hash**. Served at
`https://www.neu.ac/.well-known/discord`, it proves to Discord that whoever
controls that Discord profile or server also controls neu.ac, which is what
lets the domain appear as a verified link on a profile or in a server's
settings. It is a public token by design — it is meant to be fetched by
anyone — so publishing it leaks nothing.

**Recommendation: put it back, unless the Discord it belongs to is dead.**
Reasoning: it costs 50 bytes and zero maintenance, it cannot break anything
(nothing on the site reads it), and it only works if it is sitting at that
exact path *before* Discord checks — so removing it means the verification
silently lapses and the fix is only obvious to someone who remembers this
file exists. The one real argument against is that it is a live token for an
account Neu may no longer use, in which case it is confusing dead weight and
should be deleted properly rather than parked.

**What is needed: one word.** If yes, it is a copy into `site/.well-known/`
and it ships with the next deploy. If no, `_removed-from-main` can be
emptied.

## What is decided and should not be re-proposed

See `memory/decisions.md`. Briefly: the TV boss fight is gone, two text-blip
samples was wrong, the torch is stepped not smooth, walk cycles advance on
distance, rooms are data, the deck is DOM, Polterghast plays flat, and
Calamitas's 20-step cycle is fixed and does not reset between phases.
