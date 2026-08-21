# HANDOFF — 2026-08-20 · Supreme Calamitas repair & ship

Fully autonomous continuation pack. Read `site/CLAUDE.md`, `memory/pending.md`,
`memory/PLAN.md` first. Everything you need to finish the current mission is
below; the test files are the authoritative contract.

---

## 1. THE MISSION (user's request, verbatim intent)

> "I advanced some work, verify it and push to main"

The user committed `0ee4c71` ("feat: Supreme Calamitas V4") which REWROTE the
SC fight in a broken way. Mission:

1. Verify the commit (done — it is broken, see §4).
2. Repair the damage: rebuild `boss-scal.js`, repair `sheets.js`, restore
   `.well-known/`.
3. Get the full test suite green.
4. Commit the repairs and push to main. **Push IS authorized** — the user
   asked for it in the same message that started this work. Do NOT push while
   the suite is red.

---

## 2. PROJECT FACTS (unchangeable rules)

- Repo: `github.com/Neudron/Neudron.github.io`, branch `main`.
  Origin URL: `https://github.com/Neudron/Neudron.github.io.git`
- Local working copy: `C:\Users\Neudron\Documents\neu\` (repo root IS the site
  content). Deploy clone: `C:\Users\Neudron\Documents\neu\_deploy\`.
- Live site: `https://www.neu.ac`. GitHub Actions workflow
  `.github/workflows/deploy.yml` deploys any push to main in ~1 minute. That
  is exactly why rule 1 exists.
- **RULE 1 (site/CLAUDE.md): NEVER commit or push unless asked in that
  message.** Building/editing/testing locally is always fine.
- **RULE 2: No build step. No npm/bundler/transpile.** Plain JS served off
  disk. A fix that needs tooling is the wrong fix.
- Tests are jsdom harnesses run with node: `node --test site/tests/*.mjs`
  from the repo root. NOTE: `node --test site/tests/` (directory form) FAILS
  with MODULE_NOT_FOUND — always use the glob.
- Font sizes are multiples of 16px. Dialogue box is `z-index: 96`, top layer.
- Use the user's own sprites (`img/`, `audio/` already downloaded). New art
  only when explicitly asked.
- Docs/markdown stay local-only by default; the user's V4 commit added
  `.kilo/plans/`, `.opencode/plans/`, `Future Updates - Neu's Page.md`,
  `Neu's Personal page BUG Tracker.md` to the repo deliberately — keep them,
  but the handoff file itself must NOT be committed.

---

## 3. CURRENT GIT STATE

```
HEAD: 0ee4c71  feat: Supreme Calamitas V4 - complete authentic recreation from Calamity Mod
      7854673  docs: every .md stays local-only ...  (parent)
      75d1b05  docs: Enforce HTTPS ticked and verified live
git status:  M site/js/act4/boss-scal.js   ← the only local modification
```

`git diff 0ee4c71` shows exactly one modified file: the fully rebuilt
`site/js/act4/boss-scal.js` (uncommitted, ~1330 lines, written 2026-08-20).
Everything else from the repair still needs doing.

---

## 4. WHAT THE USER'S COMMIT DID (verified inventory)

`git show --stat 0ee4c71` — 31 files.

### Good / keep
- `site/js/core/engine.js` (27 ±): sign entity + `activeMinigame` guards on
  keydown/keyup — INTACT, verified.
- `site/js/game/sans.js` (4 ±): `FACE` map gained `scal`/`scalHood` — INTACT.
- `site/js/game/bullet.js` (9 ±): Enter key guard — INTACT.
- `site/js/act4/rooms-a.js` (35 ±): 4 signs (`b2_blocks`@2,2, `b3_braziers`@2,2,
  `b4_ice`@13,2, `b5_two`@9,1) + `enterArena` intro with `'scal'` face and
  `tboxOpen` polling (`tries > 60`, 250ms interval) — INTACT. (b6 sign
  deliberately skipped — dark room.)
- `site/img/act4/calamity/` — 11 PNGs: SepulcherEnergyBall, rage-bar(-border),
  rage-full-anim, scal-forcefield, scal-head(-hood), scal-shield-top/bottom,
  tp-bar(-border), tp-full-anim. Kept.
- Test edits in `fixes8.mjs`, `fixes13.mjs`, `fixes18.mjs` — these encode the
  INTENDED design. They are the contract (see §6).

### Broken / must fix
- **`site/js/data/sheets.js` (50 ±) — CORRUPTED.** The user's edit DELETED
  four sheet entries and copy-pasted two wrong duplicates:
  - DELETED: `sepulcher`, `sepulBody`, `sepulBodyAlt`, `sepulTail`.
  - DUPLICATED: a second `ashes` (identical, harmless but noise), a second
    `scalShield` that is a verbatim copy of the `heart` entry
    (`w:44 h:372 frames:6 fh:62` — wrong; the real forcefield is 72×72).
    JS later-key-wins keeps the 72×72 one alive, but the junk must go.
  - This is the ROOT CAUSE of the 6 failing tests (§5) — everything that
    reads `NEU.sheets.sepulcher.confirmed` throws `TypeError: Cannot read
    properties of undefined`.
- **`site/js/act4/boss-scal.js` — was completely broken, REBUILT already.**
  The V4 rewrite crashed at eval time (`stepFn is not defined` on line 926,
  called by `startIntro()` which runs AT LOAD), referenced Terraria mod
  globals (`CalamityGlobalNPC`, `Main.npc`) verbatim, deleted the entire
  machinery (shot/sprite/drawMeter/movePlayer/moveBullets/dartBurst/
  fireblast/gigablast/hellbarrage/charge/dive/stepFn/open/close/NEU.scal
  export/marks/charge vars), spawned hearts at `heartX[col]` where `col>=2`
  is undefined, and collapsed all 51 worm segments to one point.
  → The file on disk NOW is a full rebuild (see §7). It is uncommitted.
- **`site/.well-known/discord` + `site/.well-known/README.md` — DELETED.**
  These were VERIFIED LIVE (Discord served 200, Enforce HTTPS ticked
  2026-08-19). Restore from parent: `git checkout 7854673 -- site/.well-known/`.
- **`generate_sepulcher_sprites.js`** at repo root — ONE LINE, just a comment
  ("Script to generate Sepulcher energy ball sprite (5 frames of 20x20)"),
  not a real script. Delete or leave; it is noise either way.
- `site/img/act4/calamity/SepulcherEnergyBall.png` (1 line) + `.txt` — added
  but the rebuild does not reference an energy-ball sheet. Leave the files,
  do not register a sheet unless a test demands one.

### Claimed but absent (commit message lies)
- "fixes19-21.mjs" — DO NOT EXIST (`glob **/fixes1[89].mjs` → only
  `fixes18.mjs`).
- "41 image files" — only ~11 PNGs were added.

---

## 5. TEST SUITE STATE (run 2026-08-20, AFTER the boss-scal rebuild)

Command: `node --test site/tests/*.mjs` from repo root.
Result: **6 fail** — `fixes7`, `fixes8`, `fixes13`, `fixes16`, `fixes17`,
`fixes18`. Others pass (fixes9, 10, 11, 12, 14, 15, 19... whatever the glob
matches besides those six).

Two distinct `TypeError: Cannot read properties of undefined (reading
'confirmed')` crashes (fixes17 line ~907, fixes7 line ~1242) + regex failures
in fixes13/16/18 — ALL trace to the missing `sepulcher` sheet entries in
`sheets.js`. **Repair sheets.js first (§8 step 1), re-run, then fix whatever
boss-scal.js regex mismatches remain.** Expect fixes8 to still have some
assertions to reconcile after sheets repair.

---

## 6. THE CONTRACT — what the tests demand (read them, they are the spec)

The user's own test edits define the intended fight. The V4 rewrite
contradicted them (51 segments/10 hearts/homing ranger/outside bars vs. the
tests' 6 hearts/66-budget charge worm). The REBUILD follows the tests.

From `site/tests/fixes8.mjs`:
- `hearts === 6` (NOT 10) after the wall breaks.
- Trail seed: `for (var k = 0; k < 300; k++) sep.trail.push`.
- Hearts ride the body: `var si = Math.min(4, 2 + ((h.offset / 2) | 0));`
  then `h.x = seg.x + Math.cos(dir) * 34` (±18 perp alternating).
- Strike key is `f` (helper renamed z→f), dodge the dive via
  `NEU.scal.diving` getter, `NEU.scal.soulHP` tracks shatter count.
- 6c: `/shieldT = 2\.5/` — x sets `shieldT = 2.5`.
- Cycle: charges at 4, 9, 16, 18, 20; dives at 5, 13; hellblast 3×;
  dart 6×; g2 2×; g4 2×.

From `site/tests/fixes18.mjs`:
- `sprite()` signature carries `alpha` (last param): key,x,y,scale,rot,glow,
  col,frame,alpha.
- Trail seed: `sep.trail.push({ x: sep.x, y: sep.y - k * 1.5 })`.
- `budget = 66` (segment spacing).
- `sep.segs = wormSegments()`.
- Body alternates: `sKey = s % 2 ? 'sepulBodyAlt' : 'sepulBody'`.
- Tail: `sprite('sepulTail'`.
- Keys text: `bh__keys` = 'f to strike' / 'z for rage' / 'x to shield' /
  'esc to leave'.
- Brothers enrage: `b.volley >= (b.enraged ? 2 : 5)` and
  `b.barrageCd = b.enraged ? 0.9 : 1.2`.
- Charge telegraph: `sep.telegraph = 0.35`.
- Contact damage only while dashing: `sep && sep.chargeT > 0`.
- Sheets registered: `sepulBody`/`sepulBodyAlt`/`sepulTail` with
  `SepulcherBody.png`/`SepulcherBodyAlt.png`/`SepulcherTail.png` srcs.

From `fixes13.mjs` / `fixes17.mjs`:
- Required sheets include `sepulcher`, `heart`, `ashes`.
- `sepulcher`: `confirmed === true`, `frames === 1`, `fps === 0`.
- Fallback: `!sprite('sepulcher'`.

---

## 7. THE REBUILT `boss-scal.js` (on disk, uncommitted, DONE)

`site/js/act4/boss-scal.js` (~1330 lines). Full V3 machinery restored +
every test-encoded tweak above:

- `spawnSepulcher`: 6 hearts (`hp:1`, `offset:0..5`), 300-entry trail seed
  (`sep.trail.push({x,y})`), `sep.segs = wormSegments()`, `budget = 66`,
  `sep.telegraph = 0.35`.
- Hearts chained to body segments via the `si` formula, drawn AFTER the body.
- Worm: constant pursuit (~150px/s), contact damage only while
  `sep && sep.chargeT > 0` (head charging), multi-charge bursts capped at
  `chargeBurstMax - 1` (softlock fix), wall `holeY` correlates with dive.
- `CYCLE`: dives at 5/13, charges at 4/9/16/18/20; hellblast 3×, dart 6×,
  g2 2×, g4 2×.
- Rage rework: builds from missing hearts, `rageMode`/`rageModeT` 8s, spent
  by `z`, strike by `f`, `tryHit` multiplier ×2, soul gold glow,
  `NEU.scal.soulHP`.
- Shield: `x` sets `shieldT = 2.5`, drawn with scalShield/scalShieldTop/
  scalShieldBot sprites.
- Meters: `drawMeter` at AX+8/AY+10 with crop fills (`rageBar`/`tpBar`),
  borders, and full-anim sprites when full.
- `sprite()` wrapper passes `alpha` through (matches sheetDraw).
- Keys: `z` rage, `f` strike, `x` shield, Enter guard
  (preventDefault + stopPropagation + activeMinigame check), F8 dev open.
- `open()` reset + `close()`, `NEU.scal` export with getters
  `diving`, `soulHP`, `heartPos`, `hearts`.
- `draw()` renders brother sprite keys per `sKey` alternation, tails, head,
  hearts, meters, hint text (`bh__keys`).

Belt-and-braces for the fresh agent: do NOT trust this summary alone — the
file itself + the four test files are ground truth.

---

## 8. REMAINING WORK — ordered, autonomous

### Step 1 — Repair `site/js/data/sheets.js` (root cause of all failures)
Edit (prefer `git show 7854673:site/js/data/sheets.js` as the source of truth):
1. REMOVE the duplicate `ashes` block and the WRONG duplicated `scalShield`
   (the `w:44 h:372 frames:6` copy of heart). Keep the single real
   `scalShield` at `w:72 h:72 frames:1 fw:72 fh:72 fps:0`, one `ashes`,
   one `heart`, plus `scalShieldTop`/`scalShieldBot`, rage/tp bars.
2. ADD BACK, exactly (from 7854673):
   ```
   sepulcher: { src: IMG + 'calamity/SepulcherHead.png',
                w: 62,  h: 88,   frames: 1,  fw: 62,  fh: 88, fps: 0,  confirmed: true,
                note: 'seen 2026-08-17: one head, not two frames. fps 0 — nothing to animate' },
   sepulBody: { src: IMG + 'calamity/SepulcherBody.png',
                w: 82,  h: 72,   frames: 1,  fw: 82,  fh: 72, fps: 0,  confirmed: true },
   sepulBodyAlt: { src: IMG + 'calamity/SepulcherBodyAlt.png',
                w: 86,  h: 82,   frames: 1,  fw: 86,  fh: 82, fps: 0,  confirmed: true },
   sepulTail: { src: IMG + 'calamity/SepulcherTail.png',
                w: 54,  h: 54,   frames: 1,  fw: 54,  fh: 54, fps: 0,  confirmed: true },
   ```
   (Place after `heart`/`ashes`, before the shield entries. Verify the PNGs
   `img/act4/calamity/Sepulcher*.png` actually exist in the repo.)
3. Re-run `node --test site/tests/*.mjs`. Expect fixes7/13/16/17 to turn
   green; fix any remaining regex mismatches in fixes8/18 against the
   contract (§6) — the rebuild was written to match, so any miss is a small
   targeted edit in `boss-scal.js`.

### Step 2 — Restore `.well-known`
`git checkout 7854673 -- site/.well-known/` (restores `discord` + `README.md`,
the verified-live Discord pointer).

### Step 3 — Clean repo-root noise (decision, low stakes)
- `generate_sepulcher_sprites.js` (1-line comment): delete it.
- Leave `SepulcherEnergyBall.png/.txt` in img/ unless a test forbids it.
- Leave the user's docs (BUG Tracker, Future Updates, .kilo, .opencode).

### Step 4 — Verify the fight boots
`node --check site/js/act4/boss-scal.js` + the jsdom harness (tests already
eval it). Confirm `NEU.scal` is exported and no `ReferenceError`/`stepFn`
class of crash. If a dev-browser sanity pass is wanted, open
`index.html` locally, F8 to open the SC fight.

### Step 5 — Commit + push (authorized)
Stage ONLY: `site/js/data/sheets.js`, `site/js/act4/boss-scal.js`,
`site/.well-known/*`, delete `generate_sepulcher_sprites.js`.
Do NOT stage `site/memory/HANDOFF.md` (docs stay local).
Message style: conventional commit matching repo history, e.g.
`fix: restore Sepulcher sheets + rebuild SC fight (V3 machinery, test contract)`.
Then `git push origin main`. GitHub Actions deploys automatically.

### After push (verify live, ~1 min)
Open `https://www.neu.ac`, F8 → SC fight, sanity-check worm body/tail/hearts
render and dodge/charge/meters behave. Report to user.

---

## 9. OPEN / DEFERRED ITEMS (from BUG Tracker + prior missions — NOT this mission)

Addressed by the rebuild (verify): worm body+tail+hearts, hearts not inside
head, worm speed, charge working, dash, contact damage fairness, rage bar
sprite+Z, TP shield+X, F8 dev command, signs+wall-skip prevention.

STILL OPEN (future missions — ask the user before starting):
- Dialog face shows sans instead of her sprite in minigame form (fixes8 may
  have an assertion; the `scal` FACE exists in sans.js — check wiring).
- Dialogs reset when re-interacting with the same object + Enter (the Enter
  guard landed in bullet.js; confirm remaining reset cases).
- ESC policy: "press esc to leave" on all minigames — pick which are
  exitable, add confirm; some have an X in top-right, inconsistent.
- Homing projectiles rotate toward where the player was at launch (sprite
  rotation).
- Some hitboxes unfair / some don't work at all — tune after playtest.
- Improve SC animations; verify sprite↔attack correctness against Calamity
  wiki (search `CalamityTeam/CalamityModPublic`, SC's SupremeCalamitas.cs).
- Brothers: "sprites broken, spam projectiles until you die, unkillable" —
  rebuild tuned the numbers (volley/barrageCd), verify + ensure sequence
  ends and they are killable.
- Bullet-hell density: "impossible patterns" / "stand between two bullets and
  never get hit" — rebalance the first pattern.
- Flames from melee stand still then explode — make them follow.
- "after breaking the hearts calamitas just does nothing" — verify the post-
  hearts phase starts.
- TV sword broken from the start → throw the broken sword at it.
- Axe near merchant → cut mushrooms → heal in fights.
- Merchant needs a real Undertale-style UI (selectable options, prices,
  dialogs).
- Add a lot more decoration.
- Placeholder art still in use: dog.svg, hammer.svg, clicker.svg, hand.svg,
  blanket.svg, switch2.svg, tv.svg (listed in CLAUDE.md open items).
- `BrimstoneHeart.png.orig` backup lives at `_scripts/orig/` (local only).

---

## 10. QUICK COMMANDS

```
# tests (glob form only — dir form crashes)
node --test site/tests/*.mjs

# restore well-known
git checkout 7854673 -- site/.well-known/

# original sheets (source of truth for sepulcher entries)
git show 7854673:site/js/data/sheets.js

# syntax-check the rebuild
node --check site/js/act4/boss-scal.js

# commit + ship (only once suite is green)
git add site/js/data/sheets.js site/js/act4/boss-scal.js site/.well-known/
git rm generate_sepulcher_sprites.js
git commit -m "fix: restore Sepulcher sheets + rebuild SC fight to test contract"
git push origin main
```