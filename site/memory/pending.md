# Pending

**`memory/PLAN.md` is the full handoff** — agent context, the phase plan, and
the traps. This is the ledger. Keep them in sync.

**Verified 2026-08-17**, by running every suite and grepping the source rather
than trusting the plan document.

---

## State

| | |
|---|---|
| Acts | I–IV complete. 31 rooms, 3 bosses, quiz, rhythm game, crafting grid |
| Tests | **1208 checks, 14 suites, all green** — fixes5 (50) fixes6 (48) fixes7 (70) fixes8 (49) fixes9 (53) fixes10 (78) fixes11 (75) fixes12 (58) fixes13 (72) fixes14 (70) fixes15 (99) fixes16 (181) **fixes17 (260)** playthrough (45) |
| Location | everything in `Documents\neu\site`, tests in `site\tests` |
| Deployed | **no.** Live site is on `20213f3` (Act III). `_deploy` is now a real clone and `_scripts\deploy.ps1` makes the push one command |

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

- `core/touch.js` (2.5) gives all nine scenes thumb controls without changing
  one of them, by synthesising real KeyboardEvents. Writing its suite caught a
  profile sending `z` to `bullet.js`, which only listens for `Enter` — it
  would have looked correct and done nothing on a phone.

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

## The table

Status: 🔴 blocked on Neu · 🟠 real gap · 🟡 polish · ⚪ decided, no action

| # | Item | Status | Where | Effort |
|---|---|---|---|---|
| **1.1** | **Deploy permission.** All of Acts I–IV is local; live site is pre-Act-IV | 🔴 | `_deploy\` | 1 push |
| **1.2** | ✅ **DONE.** All five settled. Three by autocorrelation (`measure-sheets.mjs`), then `sepulcher` and `heart` by rendering them at 5x with the candidate cell rules drawn on and **looking** (`contact-sheet.mjs`). `sepulcher` was never 2 frames — it is one beetle head and the 44px rule cut it through the face. `heart` was never 5 — six beats on a 62px grid; its sheet had been trimmed 2 rows short of its own grid and was re-padded | ✅ | `data/sheets.js` | done |
| **1.3** | ✅ **DONE — they WERE swapped.** Confirmed twice: centre of mass (67% vs 45% down the cell) and then by eye at 4x. `Slash.png` is the lower jaw, `SlashAlt.png` the upper. **The plan's own fix was wrong** — it said swap the two `src` strings and nothing else, but the files are 168x240 and 192x232, so the geometry had to move with the src or each entry would hold the other's dimensions | ✅ | `data/sheets.js` | done |
| **1.4** | **PR #1 still open** — `copilot/link-neuac-domain`, holds an old 70-byte page, would overwrite the site | 🔴 | GitHub | 1 min |
| **1.5** | **Enforce HTTPS unticked** | 🔴 | Settings → Pages | 1 min |
| **1.6** | ✅ **DONE.** The stray empty repo at `Documents\neu\.git` is **gone** — proved empty first (0 commits, refs, stashes, reflog entries, remotes, objects; fsck clean; only default scaffolding plus a `[user]` block), backed up whole to `_scripts\orig\stray-root-git-backup-2026-08-17.zip`, then removed. `_deploy` re-cloned from `Neudron/Neudron.github.io`, on `main` at `20213f3`, tree mirrored. The wrong staged commit in `%TEMP%\neu-pages` (a pre-reorg, pre-Act-IV tree of 64 files) was discarded. `_scripts\deploy.ps1` now does mirror → shape check → leak check → diff → **ask** → push → verify live. | ✅ | `_deploy\`, `_scripts\` | done |
| **2.1** | ✅ **DONE.** Calamitas draws from her sheets: `sprite(key,x,y,scale,rot,glow)` replaces `drawSheet`, projectiles (dart/hellblast/fireblast/gigablast) rotate to travel, brothers rotate to the player, Sepulcher, hearts and the won-state ashes all sprite; magenta + coloured-square fallbacks kept | ✅ | `act4/boss-scal.js` | done |
| **2.2** | ✅ **DONE.** All six zones draw real 16×16 art — `woods castle city home prize storm`, one sheet each in `img/act4/tiles/` (2.1 KB total). Tiles were scored out of the Deltarune atlases for opacity, interior variance and seam cost, then re-mapped onto the palette colour each char already had, so the texture is theirs and the tone is ours. `colours` kept as the fallback throughout | ✅ | `act4/rooms-*.js` | done |
| **2.3** | ✅ **DONE.** All six `audio/act4/*.ogg` play through the pooled pattern (4 copies each, volume 0.5, pools built in `open()`); each attack plays its own family, hits play the hit files | ✅ | `act4/boss-scal.js` | done |
| **2.4** | ✅ **DONE.** `core/music.js` — eight procedural tracks, **0 bytes of audio downloaded**. Zone tracks keyed by tileset name via a new `engine.zone()`; a 250ms poll picks the track so no scene changed; crossfade on zone change and no restart within one; ducks under the dialogue box; boss layers arrive as HP falls; the rhythm game is explicitly silenced so two tempos never fight. Volume slider in settings, persisted as `opt_music`. Adding the slider exposed a real bug in the Tab trap — it collected only `button`, so focus escaped an `aria-modal` dialog; now `button, input` | ✅ | `core/music.js` | done |
| **2.5** | ✅ **DONE.** `core/touch.js` draws a stick and buttons and synthesises real KeyboardEvents, so all nine scenes got touch without one of them changing. Vector stick with diagonals, focus (Shift) in the three bullet-hell fights, auto-repeat on the menu scenes only, and a single release path so a key can never stick. Auto-shows on a coarse pointer; `settings → thumb controls` overrides | ✅ | `core/touch.js` | done |
| **2.6** | ✅ **DONE.** All seven redrawn from ASCII grids in `_scripts/make-sprites.mjs` and each one checked by rasterising it at 8x and looking. `dog` is Toby in profile with ear, eye, muzzle, haunch and tail, and **no expression** on purpose. `hand` **kept its original silhouette** — the redraw read as a stool and the old shape was better; only the shading stayed. One colour added to the palette: `#BFA98C`, a warm skin shadow, because the only mid-tone was a cool grey that reads as dirt on skin | ✅ | `img/`, `_scripts/` | done |
| **2.7** | ✅ **DONE.** All seven tiles have drawn sigils on one 48×48 grid, two colours each taken from the tile's own gradient. Each references something real: the stepped torch, the glass cube, the soul and its countdown. `sigil: true` is gone — presence in `SIGILS` is the switch. The initials fallback is kept | ✅ | `game/deck.js` | done |
| **3.1** | ✅ **DONE — this claim was wrong.** The verifier missed it: `settings.js` ships **all three** switches — `noShake`, `noFlash` and larger text (`settText` row, `opt_largeText`, `html.text-lg { zoom: 1.25 }`), tested in fixes12 §3 | ✅ | `core/settings.js` | done |
| **3.2** | ✅ **DONE.** `core/perf.js` + `fps` in the dev console. Samples nothing until asked; budget 16.7/20/33.3ms; per-scene attribution; ignores the huge frame a backgrounded tab returns. Judged on the **1% low**, not p95 — the suite caught p95 scoring a 90ms-per-second hitch as a clean 15ms | ✅ | `core/perf.js` | done |
| **3.3** | ✅ **DONE — this claim was wrong too.** `css/style.css` has a table of contents at line 11; the file is still ~1600 lines (splitting needs a build step, see 4.2) | ✅ | `css/style.css` | done |
| **3.4** | ✅ **DONE.** 772 → 154 lines: what it is, run it, test it, deploy it, layout, the rules, where the docs are. It had been documenting the **pre-reorg flat `js/` tree**. The old one is kept whole at `memory/build-notes.md` | ✅ | `README.md` | done |
| **3.5** | **Manual playthrough never done** — desktop or phone. Every check so far is jsdom | 🟡 | — | 1 hr |
| **3.6** | ✅ **DONE.** `bullet.js` reads `dm.IFRAMES || 1.15` at all three damage sites; the local copy is gone | ✅ | `game/bullet.js` | done |
| **3.7** | ✅ **DONE.** Restored to `site/.well-known/discord`, plus a zero-byte `.nojekyll` as insurance. **The usual explanation is wrong for this repo:** the Pages source is GitHub Actions and `deploy.yml` uploads the checkout as-is, so no Jekyll runs and dotfiles were already fine. `.nojekyll` only matters if someone switches the source back to "Deploy from a branch". Reasoning in `site/.well-known/README.md` | ✅ | `site/.well-known/` | done |
| **3.8** | ✅ **DONE.** All three read on 2026-08-17, verdicts in `PLAN.md` §1.10: `threejs-skills` maybe-later (the cube is finished), `threejs-game-skills` **no** (Vite + TypeScript + Playwright — a build step and a blocked browser), `OpenGame` **no** (an agentic framework with its own model, nothing to port). One idea salvaged: a seeded RNG for deterministic playtests | ✅ | `PLAN.md` §1.10 | done |
| **4.1** | `loader.js` dropped deliberately — boot carries ~30 KB more JS than the "+0 KB" target; the 302 KB of art is already lazy | ⚪ | `plan-act4.md` §9 | — |
| **4.2** | Splitting `style.css` would need a build step, which rule 2 forbids | ⚪ | — | — |

---

## Suggested order

1. **1.1–1.6** — five minutes of yours, and 1.1 unblocks everyone seeing any
   of this. 1.6 (re-clone `_deploy`) has to happen before 1.1 can.
2. ✅ ~~2.1 + 2.3~~ **done** — Calamitas's projectiles and her six sounds.
3. ✅ ~~2.2~~ **done** — the tilesets. Six zones are places now, not colours.
4. ✅ ~~2.5~~ **done** — touch. Act IV is playable on a phone now.
5. ✅ ~~2.4~~ **done** — music. Act IV has a soundtrack that costs nothing to
   download and answers the fight.
6. **3.x** — the small ones. 3.2 (fps meter) and 3.4 (README) are the real
   ones left; 3.5 is a manual playthrough — and it now matters more, because
   **nobody has heard the soundtrack out loud.** Every check on it is jsdom
   against a recording stub, which proves the schedule and proves nothing
   about whether the castle track is any good.
7. **2.6 / 2.7** — the seven placeholder sprites and the deck covers.

## A risk created on 2026-08-17, worth a decision

Two changes made on the same day compound into one gap:

1. `memory/` is now in `site/.gitignore`, so the 3,600 lines of design
   documentation are no longer in the Pages repo.
2. The stray empty repo at `Documents\neu\.git` was removed, so `site/`
   is not inside any git repository at all.

Neither was wrong on its own. Together they mean **`memory/` has no version
history and no off-machine copy.** Losing the laptop loses `story.md`,
`decisions.md`, `PLAN.md` and the rest.

`site/` itself is safe once a deploy happens — `_deploy` is a real clone and
the code is committed there. It is only the excluded folder that is exposed.

Three ways out, in order of how little they change:

- **A private second repo** for `memory/` alone. Keeps it off the public
  site, gets history and a backup. One `git init` and a remote.
- **A local repo at `Documents\neu`** covering everything including
  `memory/`, never pushed anywhere. History but no off-machine copy.
- **Un-ignore `memory/`** and accept that the walkthrough is public. This is
  the option that was just deliberately rejected, listed for completeness.

Recommendation: the first. It is the only one that solves both halves.

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
