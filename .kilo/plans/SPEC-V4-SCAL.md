# V4 Supreme Calamitas Fight — SPEC.md

**Source of truth**: CalamityTeam/CalamityModPublic@fecf24ed (1.4.4 branch)
- `NPCs/SupremeCalamitas/SupremeCalamitas.cs`
- `NPCs/SupremeCalamitas/SepulcherHead.cs`
- `NPCs/SupremeCalamitas/SepulcherBody.cs`
- `NPCs/SupremeCalamitas/SepulcherBodyEnergyBall.cs`
- `NPCs/SupremeCalamitas/SepulcherTail.cs`
- `NPCs/SupremeCalamitas/BrimstoneHeart.cs`

---

## 1. WORM (SEPULCHER) — COMPLETE REWRITE

### 1.1 Segment Composition (51–52 total)
| Index Range | Type | Count | Spacing | Notes |
|-------------|------|-------|---------|-------|
| 0 | Head | 1 | — | SepulcherHead, targets SC, charges at 110px |
| 1,3,5… (odd < 51) | EnergyBall | ~25 | 34px | SepulcherBodyEnergyBall, animated (5 frames), **fires 4-projectile ring every 900 frames** (commented in source but should work) |
| 2,4,6… (even < 51) | Body | ~25 | 52px | SepulcherBody, alternates texture / AltTexture every 2 segments |
| 3,7,11… (i≥3, i%4==0) | Arm (pair) | ~12 pairs | — | SepulcherArm, attached to body segments, rotationalOffset += π/6 each pair |
| 51 (or 52) | Tail | 1 | — | SepulcherTail, 20×20 |

**Key constants from source:**
- `minLength = 51`, `maxLength = 52`
- Body spacing: `52f` (SepulcherBody line: `offsetToAheadSegment.SafeNormalize(...) * 52f`)
- EnergyBall spacing: `34f` (SepulcherBodyEnergyBall line: `* 34f`)
- Head charge trigger distance: `110` (Terraria pixels ≈ 150 game px)
- Head charge cooldown: `150` frames (2.5s at 60fps)
- Head charge ring: `30` projectiles, `BrimstoneBarrage`, speed `15f` (passed as ai[1]=3f)
- Head movement: `sepMaxSpeed = 20`, `sepAcceleration = 0.175` (+ attack bonus)
- **Rotation**: `NPC.rotation = Atan2(velocity.Y, velocity.X) + PiOver2` (sprites are upright, rotated in code)

### 1.2 Worm Behavior
- **Target**: Supreme Calamitas (SCal), NOT the player directly
- **Movement**: Smooth pursuit of SCal with acceleration/clamping logic (see SepulcherHead.AI lines 130–200)
- **Charge**: When within 110px of SCal and AttackCooldown ≤ 0 → fires 30-projectile ring, plays sound/particles, resets cooldown to 150
- **Death**: Dies when all BrimstoneHearts dead (or in zenith mode, DR drops to 40% and becomes chaseable)
- **No contact damage** (NPC.damage = 0 on all segments)

### 1.3 Visuals (Critical Fixes)
- **Head rotation**: Must use `velocity.ToRotation() + PiOver2`
- **Body rotation**: `offsetToAheadSegment.ToRotation() + PiOver2`
- **EnergyBall rotation**: Same as body, but animates (5 frames, `frameCounter/5 + whoAmI % 5`)
- **Body texture alternation**: `localAI[3] / 2 % 2 == 0 ? AltTexture : MainTexture` (every 2 segments)
- **Alpha fade-in**: Segments fade in when `AheadSegment.alpha < 128` (42 alpha per frame)

---

## 2. BRIMSTONE HEARTS — STATIONARY IN ARENA CORNERS

### 2.1 Spawning (from SupremeCalamitas.DoHeartsSpawningCastAnimation)
- **Count**: 10 hearts
- **Position**: Upper corners of arena (spawnX/spawnX2, spawnY area)
- **ChainHeartIndex** (`ai[0]`): 0–9, determines which worm segment they tether to
- **ChainEndpoints**: List of Vector2 — tendril connection points to worm segments

### 2.2 Behavior
- **Stationary**: Do not follow worm. Position fixed in arena corners.
- **Tendrils**: Rendered as primitive trails from heart to `ChainEndpoints[i]` (worm segment positions)
- **Invincibility**: 10 seconds after spawn (wiki: "Brimstone Hearts are now invincible for 10 seconds after spawning")
- **HP**: 15,000 base (scales with BossHealthBoost, revenge/death mode)
- **Damage reduction**: Piercing projectiles deal reduced damage (12% less per hit, minimum 20% after 8 hits)
- **Must be destroyed in order**: ChainHeartIndex 0→9 (or spatial order: left-to-right, top-to-bottom)
- **On death**: Spawns blood particles along tendril, drops heart pickup 25% chance if player low HP

### 2.3 Visual Indicators for Order
- **ChainHeartIndex** = spawn order (0 = first to break)
- **UI indicator**: Number badge (1–10) or color gradient (red→orange→yellow) on each heart
- **Tendril color**: DarkRed→Red pulse (see `PrimitiveColorFunction` in BrimstoneHeart.cs)
- **Tendril width**: Thick at heart (4px), tapers to 1px at worm, pulses (see `PrimitiveWidthFunction`)

---

## 3. SUPREME CALAMITAS ATTACK CYCLE

### 3.1 Phase Structure (NPC.ai[0] = phase)
| Phase | ai[0] | Health Range | Description |
|-------|-------|--------------|-------------|
| 1 | 0 | 100% → 75% | First attack cycle |
| 2 | 1 | 75% → 40% | Second attack cycle (faster) |
| 3 | 2 | 40% → 20% | Third attack cycle |
| 4 | 3 | 20% → 8% | Brothers phase (Cataclysm + Catastrophe) |
| 5 | 3 | 8% → 1% | Second Sepulcher + final attacks |
| 6 | 3 | 1% → 0% | Acceptance phase (death animation) |

### 3.2 Attack State Machine (NPC.ai[1] = attack type)
| ai[1] | Attack | Duration (frames) | Phase 1 | Phase 2+ |
|-------|--------|-------------------|---------|----------|
| 0 | Normal attacks (fireblast/gigablast/barrage mix) | 300 / 240 | ✓ | ✓ |
| 2 | **Charge/Dash** (with shield) | 70 | ✓ | ✓ |
| 3 | Bullet Hell (hellblasts from edges) | 480 / 300 | ✓ | ✓ |
| 4 | Normal attacks (fireblast/gigablast/barrage mix) | 300 / 240 | ✓ | ✓ |

### 3.3 Bullet Hells (bulletHellCounter2 gates)
| Hell | Counter Range | Duration | Key Projectiles |
|------|---------------|----------|-----------------|
| 1st | 0–900 | 15s | BrimstoneHellblast2 (vertical/horizontal) |
| 2nd | 900–1800 | 15s | + Fireblasts from top/right |
| 3rd | 1800–2700 | 15s | At 60% HP (startThirdAttack) |
| 4th | 2700–3600 | 15s | At 40% HP (halfLife) |
| 5th | 3600–4500 | 15s | At 10% HP (startFifthAttack) |

### 3.4 Normal Attack Pattern (ai[1] == 0 or 4)
**Phase 1 (ai[0]==0)**: Every ~60–120 frames, pick one:
- **Fireblast** (SCalBrimstoneFireblast): Homes to player, pauses at ~170px, bursts into 12 darts
- **Gigablast** (SCalBrimstoneGigablast): Larger, preserves speed, steers toward player, bursts at 150px into 28 darts
- **Barrage** (BrimstoneBarrage): Ring of 30 accelerating darts from SC position

**Phase 2+ (ai[0]>=1)**: Faster, more projectiles, different mix

### 3.5 Charge Attack (ai[1] == 2)
- **Telegraph**: Shield appears, rotates to face player (shieldRotation lerps to player angle)
- **Dash**: 70 frames, high velocity toward player
- **Shield**: Forcefield shrinks to 0.45x, shieldOpacity → 1
- **Post-dash**: Shield fades, forcefield regrows

### 3.6 Brothers Phase (20% HP, secondStage)
- Spawns **SupremeCataclysm** (fist/melee) and **SupremeCatastrophe** (slash/ranged)
- SC teleports to center, becomes invincible until both brothers dead
- Brothers have 8 HP each, enrage when one dies (faster attacks)
- Cataclysm: Fist attacks, predictive lunges
- Catastrophe: Slash projectiles, big attack = 3 predictive slashes

### 3.7 Second Sepulcher (8% HP, gettingTired)
- Same as first but **no hearts** (cannot be killed normally)
- SC remains vulnerable during this phase

---

## 4. RAGE / TP BARS — REPOSITION & ANIMATION FIX

### 4.1 Current Issues
- Bars drawn at `AX + 8, AY + 10` (inside arena top-left)
- Fill animation uses static crop, no animated "full" overlay
- Labels just text "rage"/"tp" — no icon

### 4.2 Correct Position (Outside Arena)
```
Arena: [AX, AY] to [AX+AW, AY+AH]
Bars:  Left of arena, vertical stack
  Rage:  x = AX - 100, y = AY + 20, w = 80, h = 36
  TP:    x = AX - 100, y = AY + 20 + 46, w = 80, h = 36
```
- Outside the fight square, fully visible
- Border sprite frames the bar
- Full animation sprite plays when ratio >= 1

### 4.3 Animation Requirements
- **Fill**: Cropped width of `rageBar`/`tpBar` sheet by `ratio * width`
- **Border**: `rageBorder`/`tpBorder` sprite centered at bar center + offset
- **Full glow**: `rageAnim`/`tpAnim` sprite plays over bar when full (looped)
- **Label**: Icon + text to right of border (not overlapping)

### 4.4 Sheet Keys (from sheets.js)
- `rageBar`, `rageBorder`, `rageAnim`
- `tpBar`, `tpBorder`, `tpAnim`

---

## 5. MELEE CHARGE → HOMING RANGER ATTACK

### 5.1 Current (V3)
- `charge()` → telegraph 0.5s → dash 0.55s at 420px/s toward player
- Contact damage during dash
- Wake of 3 darts on end

### 5.2 Target (Calamity-style Fireblast/Gigablast hybrid)
- **Name**: "Photon Ripper" or "Brimstone Snipe"
- **Behavior**:
  1. Telegraph: SC glows, shield appears (same as charge telegraph)
  2. Fire 1 large homing projectile (Fireblast-style: inertia 100, homeSpeed ~140)
  3. Projectile pauses at ~170px from player for 0.55s (dodge window)
  4. Bursts into 12–16 fast darts in ring
  5. Cooldown: ~3–4s between shots
- **Visual**: Uses `fireblast`/`gigablast` sprite, scaled larger
- **Sound**: `BrimstoneBigShotSound` (big shoot) + `BrimstoneShotSound`

---

## 6. SPRITE / SHEET REQUIREMENTS

### 6.1 New Sheets Needed (add to sheets.js)
| Key | Source Path | Frames | Description |
|-----|-------------|--------|-------------|
| `sepulcherHead` | `img/act4/calamity/SepulcherHead.png` | 1 | Head sprite |
| `sepulcherBody` | `img/act4/calamity/SepulcherBody.png` | 1 | Main body |
| `sepulcherBodyAlt` | `img/act4/calamity/SepulcherBodyAlt.png` | 1 | Alt body (every 2nd) |
| `sepulcherEnergyBall` | `img/act4/calamity/SepulcherEnergyBall.png` | 5 | Animated energy ball |
| `sepulcherArm` | `img/act4/calamity/SepulcherArm.png` | 1 | Arm segment |
| `sepulcherTail` | `img/act4/calamity/SepulcherTail.png` | 1 | Tail |
| `brimstoneHeart` | `img/act4/calamity/BrimstoneHeart.png` | 6 | Heart animation |
| `rageBar` | `img/act4/calamity/RageBar.png` | 1 | Horizontal fill |
| `rageBorder` | `img/act4/calamity/RageBorder.png` | 1 | Border frame |
| `rageAnim` | `img/act4/calamity/RageAnim.png` | 6+ | Full animation |
| `tpBar` | `img/act4/calamity/TPBar.png` | 1 | Horizontal fill |
| `tpBorder` | `img/act4/calamity/TPBorder.png` | 1 | Border frame |
| `tpAnim` | `img/act4/calamity/TPAnim.png` | 6+ | Full animation |

### 6.2 Existing Sheets (verify in sheets.js)
- `scal` (21×2 frames, mapped via BANDS)
- `scalHood` (intro)
- `scalShield`, `scalShieldTop`, `scalShieldBot`
- `fireblast`, `gigablast`, `hellblast`, `dart`
- `heart` (for hearts — replace with `brimstoneHeart`)
- `fist`, `slashTop` (brothers)

---

## 7. INTEGRATION POINTS

### 7.1 Files to Modify
- `site/js/act4/boss-scal.js` — Main fight logic (rewrite worm, hearts, attacks, bars)
- `site/js/data/sheets.js` — Add new sheet entries
- `site/img/act4/calamity/` — Add 13+ new PNG assets (download from Calamity repo or recreate)

### 7.2 Files to Reference (Read-Only)
- `site/js/core/engine.js` — `activeMinigame` guard, sign system
- `site/js/game/sans.js` — FACE map for SC dialogue
- `site/js/game/bullet.js` — Projectile system (dm.shot)
- `site/tests/fixes*.mjs` — Update tests for new mechanics

---

## 8. ACCEPTANCE CRITERIA (UAT)

1. **Worm**: 51+ segments visible, smooth pursuit of SC, charges at SC every ~2.5s firing 30-dart ring, proper rotation on all segments, alternating body textures, animated energy balls
2. **Hearts**: 10 stationary in upper arena corners, tendrils connect to worm segments, break in order 1→10 with visible indicator, 10s invuln on spawn
3. **SC Attacks**: 5 bullet hells at correct HP thresholds, normal attack cycle (fireblast/gigablast/barrage), charge with shield telegraph, brothers at 20%, 2nd worm at 8%
4. **Bars**: Rage/TP left of arena, animated fill + border + full-glow, labels with icons
5. **Ranger Attack**: Replaces charge, fires homing projectile with pause+burst, dodgeable
6. **Tests**: All existing fixes* tests pass + new tests for worm/hearts/attacks
7. **Performance**: 60fps with 51-segment worm + 10 hearts + projectiles

---

## 9. OUT OF SCOPE (V5+)
- Supreme Cataclysm/Catastrophe custom sprites (use fist/slashTop placeholders)
- Acceptance phase (1% HP) unique mechanics
- Zenith/Death mode difficulty scaling
- Cirrus variant
- Full sprite parity (use colored rectangles as fallback)