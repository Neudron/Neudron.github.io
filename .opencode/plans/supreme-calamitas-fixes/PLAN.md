# Phase: Supreme Calamitas & Minigame Fixes

## Objective
Fix all 12 reported issues with Supreme Calamitas boss fight and minigame UX.

---

## Issues & Fixes

### 1. Supreme Calamitas Sprite Missing in Minigame Form
**Files**: `site/js/act4/boss-scal.js:512`, `site/js/data/sheets.js:55-60`
**Root Cause**: `sprite()` calls use default `col: 0` but sheets have `cols: 2`. Intro uses `scalHood` (col 0), fight uses `scal` (col 0). Column 1 contains "turned away" poses never used.
**Fix**: Add explicit `col` parameter to `sprite()` calls for directional poses. Use col 0 for front-facing, col 1 for side/back poses during melee/dash.

---

### 2. Dialog Resets on Repeated E Interaction
**Files**: `site/js/core/engine.js:369-422`, `site/js/game/sans.js:395-449`
**Root Cause**: `fire()` in engine.js doesn't track interaction state per entity. Pressing E re-triggers `fire()` → `say()` → resets dialog queue.
**Fix**: 
- Add `interacted` timestamp to entities in `engine.js`
- Track `lastInteractedEntity` globally
- If same entity within 500ms, don't reset dialog queue
- Add per-entity cooldown before allowing re-interaction

---

### 3. Worm/Hellblast Attack Broken (Free Attack)
**Files**: `site/js/act4/boss-scal.js:184-197`, `moveBullets:361-401`
**Root Cause**: `hellbarrage()` creates projectiles with `k: 3` from screen edges. Homing logic only applies to `k: 1` (fireblast) and `k: 2` (gigablast). Hellblasts only accelerate horizontally (`b.vx *= 1 + dt * 1.6`) but don't home.
**Fix**: 
- Add homing behavior to hellblasts during initial 0.5s after spawn
- Store `targetX/targetY` at spawn time (player position when fired)
- Home toward stored target, not current player position
- After homing phase, continue straight (current behavior)

---

### 4. Homing Attack Sprite Rotation Wrong
**Files**: `site/js/act4/boss-scal.js:532-543`, `moveBullets:366-382`
**Root Cause**: Fireblast/gigablast rotation uses `Math.atan2(b.vy, b.vx)` (current velocity). During homing, velocity changes toward player, so sprite rotates mid-flight. Should rotate to **launch angle**.
**Fix**: 
- Store `launchAngle` on projectile creation (angle to player at fire time)
- Use `launchAngle` for sprite rotation during homing phase (`b.fuse > 0`)
- Switch to velocity-based rotation only after fuse expires (ring burst)

---

### 5. Unfair/Non-Working Hitboxes
**Files**: `site/js/act4/boss-scal.js:388-398`, `site/js/game/bullet.js:299-308`
**Root Cause**: 
- Boss fight: collision uses `PLAYER_R = 3.2` but sprite drawn at scale 2 (visual ~60px, hitbox ~6px)
- Bullet hell: same issue, blaster beams use `BL_HALF = 17` vs visual
- Brothers: hitbox radius 22 vs sprite scale 0.35/0.4 (visual mismatch)
**Fix**: 
- Standardize hitbox radii: player `PLAYER_R = 6` (matches scale 2 soul sprite)
- Boss hitbox: 34 (current) → 40 (matches scale 2 sprite ~80px tall)
- Brothers: radius 22 → 28 (matches scale 0.35-0.4 sprites)
- Blaster beam: `BL_HALF = 17` → 24 (matches visual beam width)
- Add debug hitbox visualization (F3 toggle)

---

### 6. ESC-to-Leave → Confirmation Dialog
**Files**: All minigames (`boss-scal.js:635`, `bullet.js:619`, `rhythm.js:274`, `quiz.js:291`, `boss-polt.js:465`)
**Root Cause**: All minigames immediately close on Escape key.
**Fix**: 
- Create `NEU.confirmExit(minigameName, onConfirm)` utility in `engine.js` or new `ui.js`
- On Escape: show centered confirmation overlay ("Leave [name]? Enter=Yes, Escape=No")
- Only exit on confirmed Enter press
- Boss fights: ESC only works from pause state, not mid-fight
- Configurable per-minigame: `exitable: true/false` in minigame config

---

### 7. Improve Supreme Calamitas Animations
**Files**: `site/js/data/sheets.js:55-60`, `site/js/act4/boss-scal.js:520`
**Root Cause**: Sheets use `fps: 12` time-based animation. No per-attack states (idle, charge, dash, melee, cast). Phase 2 glow additive but doesn't change animation.
**Fix**: 
- Define animation states in sheet metadata:
  - `idle`: frames 0-3, fps 4
  - `charge`: frames 4-7, fps 8 (telegraph)
  - `dash`: frames 8-11, fps 16 (fast)
  - `melee`: frames 12-16, fps 12 (windup+active+recovery)
  - `cast`: frames 17-20, fps 10 (spellcast)
- Use `frame` parameter in `sprite()` calls based on attack state
- Phase 2: add subtle animation speed increase (1.15x)

---

### 8. Dash/Charge Attack Broken
**Files**: `site/js/act4/boss-scal.js:199-204`, `fightTick:305-312`
**Root Cause**: `charge()` sets `bxv/byv` and `chargeT = 0.55`. In `fightTick`, charge movement only applies while `chargeT > 0`. But `stepT` continues counting down during charge. Next attack can queue before charge finishes.
**Fix**: 
- Set `stepT = chargeT` so next attack waits for charge to complete
- Add `chargeCooldown = 2.0` after charge ends
- Ensure contact damage during charge (already in `moveBullets:241-244`)
- Add charge telegraph: glow red 0.5s before dash (already has `glow` variable)

---

### 9. Add Melee Attacks
**Files**: `site/js/act4/boss-scal.js:53`, `site/js/data/sheets.js:55-60`
**Root Cause**: `CYCLE` array only has: `d` (dart), `h` (hellbarrage), `g2/g4` (gigablast), `c` (charge). No melee entry. Sprite sheets have 21 frames × 2 cols for melee poses.
**Fix**: 
- Add `'m'` (melee) entries to CYCLE array (e.g., after every 2-3 ranged attacks)
- Implement `melee()` function:
  - Telegraph: flash white 0.4s, play sound
  - Windup: 0.3s (frame 12-14)
  - Active: 0.2s (frame 15-16, hitbox at bx/by radius 40)
  - Recovery: 0.3s (frame 17-18)
- Use column 1 of `scal` sheet for melee (side/turned poses)
- Melee only triggers when player within 80px

---

### 10. Enter Key Glitch → 20s Minigame on Death
**Files**: `site/js/act4/boss-scal.js:636`, `site/js/game/bullet.js:622`, `deathStep`
**Root Cause**: Both `boss-scal.js` and `bullet.js` listen for `Enter` keydown globally. When dying in boss fight (`dying > 0`), `boss-scal.js` ignores Enter but `bullet.js` doesn't check `NEU.scal.active`.
**Fix**: 
- Add global `NEU.activeMinigame` tracker (string: 'scal', 'bullet', 'rhythm', 'quiz', 'polt')
- In each minigame's `open()`: `NEU.activeMinigame = 'name'`
- In each minigame's `close()`: `NEU.activeMinigame = null`
- In keydown handlers: `if (NEU.activeMinigame !== 'myName') return;`
- Or simpler: check `NEU.scal.active` / `NEU.bullet.running` in bullet.js

---

### 11. Brother Attacks Broken
**Files**: `site/js/act4/boss-scal.js:262-270`, `brothersTick:338-359`, `tryHit:425-435`
**Root Cause**: 
- Brothers spawn with `hp: 8` but `tryHit` only damages when `mode === 'brothers'`
- `brothersTick` fires projectiles every 1.15s indefinitely
- When `bros.length === 0`, transitions to phase 2 — but brothers never removed!
- `tryHit` splices brother on `hp <= 0` but `brothersTick` doesn't check `hp`
- Sprite keys: verify `slashTop`/`slashBot` match sheets.js
**Fix**: 
- In `brothersTick`: check `b.hp <= 0` and `splice` dead brothers
- Add max 3 projectiles per brother per attack cycle
- Verify sprite keys: `slashTop` = `SupremeCatastropheSlashAlt` (top jaw), `slashBot` = `SupremeCatastropheSlash` (bottom jaw) — matches sheets.js fix
- Add death animation (scale down + fade) before removal
- Limit total brother projectiles to 20

---

## Implementation Order

### Phase 1: Critical Gameplay (3-4 hrs)
1. Fix worm/hellblast homing (#3)
2. Fix homing sprite rotation (#4)
3. Fix dash/charge attack (#8)
4. Fix Enter key glitch (#10)
5. Fix brother attacks (#11)

### Phase 2: Visual/Animation (2-3 hrs)
6. Fix Supreme Calamitas sprite (#1)
7. Improve animations (#7)
8. Add melee attacks (#9)

### Phase 3: UX/Polish (2 hrs)
9. Fix dialog reset (#2)
10. Fix hitboxes (#5)
11. Add ESC confirmation (#6)

---

## Testing Checklist

- [ ] Supreme Calamitas sprite renders correctly in all phases
- [ ] Dialog doesn't reset on repeated E press
- [ ] Hellblasts home toward player then continue straight
- [ ] Fireblast/gigablast sprites rotate at launch angle
- [ ] Hitboxes feel fair (no invisible walls, no phantom hits)
- [ ] ESC shows confirmation dialog in all minigames
- [ ] Animations play correctly for each attack state
- [ ] Charge/dash works with telegraph and contact damage
- [ ] Melee attacks trigger at close range with proper hitbox
- [ ] Death in boss fight doesn't trigger bullet hell Enter handler
- [ ] Brothers die after 8 hits, stop spamming projectiles
- [ ] Brother sprites render correctly (slashTop/slashBot)

---

## Files to Modify

| File | Changes |
|------|---------|
| `site/js/act4/boss-scal.js` | Core fixes for #1,3,4,7,8,9,11 |
| `site/js/data/sheets.js` | Animation metadata for #7 |
| `site/js/core/engine.js` | Dialog fix #2, ESC confirmation #6 |
| `site/js/game/bullet.js` | Enter key fix #10, hitbox fix #5 |
| `site/js/act4/rhythm.js` | ESC confirmation #6 |
| `site/js/act4/quiz.js` | ESC confirmation #6 |
| `site/js/act4/boss-polt.js` | ESC confirmation #6, hitbox fix #5 |

---

## Notes

- All fixes maintain backward compatibility with save files
- No new assets required (sprites already in sheets.js)
- Debug hitbox toggle (F3) for development only
- Brother sprite verification: use dev console `sheet slashTop` to confirm