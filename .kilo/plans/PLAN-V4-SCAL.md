# V4 Supreme Calamitas Fight — PLAN.md

**Based on**: SPEC-V4-SCAL.md (CalamityTeam/CalamityModPublic@fecf24ed source analysis)

---

## Phase 1: Data & Assets (Foundation)

### 1.1 Add Sheet Entries (`site/js/data/sheets.js`)
Add 13 new sheet definitions for worm segments, hearts, bars, animations.

### 1.2 Download/Place Sprites (`site/img/act4/calamity/`)
Need 13+ PNGs. Since Calamity assets are proprietary, create minimal pixel-art placeholders matching dimensions:
- SepulcherHead: 62×64
- SepulcherBody: 48×48 (2 variants)
- SepulcherEnergyBall: 20×20 × 5 frames
- SepulcherArm: ~30×30
- SepulcherTail: 20×20
- BrimstoneHeart: 24×24 × 6 frames
- RageBar/TPBar: 80×36 fill
- RageBorder/TPBorder: 104×52 frame
- RageAnim/TPAnim: 80×36 × 6+ frames

---

## Phase 2: Worm (Sepulcher) Rewrite

### 2.1 Data Structures (`boss-scal.js`)
```javascript
// Sepulcher head
sep = {
  x, y, vx, vy, rotation, alpha, segments: [], arms: [], trail: [],
  chargeT: 0, chargeCooldown: 0, targetSC: true
}

// Segment: { x, y, rotation, type: 'body'|'energy'|'tail', index, altTexture: bool }
// Arm: { segmentIndex, side: -1|1, rotationOffset, length: 12 }
// Heart tether: { heartIndex, segmentIndex, endpoint: {x,y} }
```

### 2.2 Spawning (`spawnSepulcher`)
- Create head at arena bottom center
- Generate 51 segments in order: body, energyBall, body, energyBall... + arms every 4th body + tail
- Initialize trail with 450px straight line
- Spawn 10 BrimstoneHearts in upper corners with ChainHeartIndex 0–9

### 2.3 Movement (`wormTick(dt)`)
- Head pursues SC (bx, by) with Calamity acceleration logic:
  - `sepMaxSpeed = 150` (game px/s, scaled from Terraria 20)
  - `sepAcceleration = 1.3` (scaled from 0.175)
  - Clamp velocity between 0.7× and 1.3× maxSpeed
  - Rotate to velocity: `rotation = atan2(vy, vx) + PI/2`
- Segments follow: each positions at fixed distance behind ahead segment
  - Body: 52px, EnergyBall: 34px
  - Rotation = angle to ahead segment + PI/2
- Arms: Fixed to parent segment, rotationOffset increments by PI/6 per pair
- Trail records head position while moving (max 300 points)

### 2.4 Charge Attack
- When `distance(head, SC) < 150` and `chargeCooldown <= 0`:
  - Fire 30-projectile ring (BrimstoneBarrage, speed 150px/s)
  - Play sound + bloom particles
  - `chargeCooldown = 2.5s`

### 2.5 Energy Ball Attacks (Optional but Authentic)
- Each energyBall fires 4-projectile ring every 15s (900 frames) when SC not shielded
- Commented in source but adds authenticity

### 2.6 Death Condition
- Worm dies when all 10 hearts destroyed
- Or in "zenith" mode: DR drops, becomes killable directly (skip for V4)

### 2.7 Drawing (`drawWorm()`)
- Draw trail tail → body segments → energy balls → arms → head
- Body: alternate texture every 2 segments (use `index % 4 < 2`)
- EnergyBall: animate 5 frames at 10fps
- Head: use `rotation` for sprite rotation
- Alpha fade-in: segments fade in over ~6 frames when head alpha < 128

---

## Phase 3: Brimstone Hearts

### 3.1 Data Structure
```javascript
hearts = [{
  index: 0-9,           // ChainHeartIndex = destruction order
  x, y,                 // Fixed position in upper arena corners
  hp: 15000,            // Scaled for minigame (e.g., 3 hits)
  maxHp: 15000,
  alpha: 255,           // Fade in over 10s invuln
  invulnTimer: 10,      // Seconds
  chainEndpoints: [],   // 2-3 Vector2 points to worm segments
  tendrilPoints: []     // Interpolated for rendering
}]
```

### 3.2 Spawning Positions
- 5 hearts top-left area, 5 top-right area
- X: `AX + 80` to `AX + AW/2 - 80` (left), `AX + AW/2 + 80` to `AX + AW - 80` (right)
- Y: `AY + 60` to `AY + 140` (upper portion)
- Staggered vertically

### 3.3 Tendril Rendering
- For each heart, maintain `chainEndpoints` = positions of worm segments it tethers to
- In source: each heart connects to multiple segments (ChainEndpoints list)
- Simplified: Each heart tethers to 1–2 worm segments (e.g., segment index = heartIndex * 5)
- Draw as quadratic bezier: heart → midpoint → segment
- Width: 4px at heart, tapering to 1px, pulsing (sin(time*2.6 + index*1.3)^16)
- Color: DarkRed(0.7) → Red lerp with smoothstep pulse

### 3.4 Destruction Order
- Player must break hearts in ChainHeartIndex order (0→9)
- Visual indicator: Number badge (1–10) or color hue shift (0°→360°)
- Hitting wrong heart: No damage, flash feedback
- On correct hit: Damage applied, tendril destruction effects (blood particles along curve)

### 3.5 Invulnerability
- First 10 seconds: `alpha` fades 255→0, hearts invulnerable
- After: Fully visible, vulnerable

---

## Phase 4: Supreme Calamitas Attack Cycle

### 4.1 Phase State Machine
```javascript
phase = 1 | 2 | 3 | 4 | 5  // Maps to ai[0] 0,1,2,3,3
attackState = 'idle' | 'normal' | 'charge' | 'bulletHell' | 'brothers' | 'acceptance'
attackIndex = 0  // Position in fixed cycle
```

### 4.2 Fixed Attack Cycle (from source)
```javascript
// Phase 1 (100-75%): ai[0]=0
//   ai[1]=0: normal (300f) → ai[1]=2: charge (70f) → ai[1]=3: hell (480f) → ai[1]=4: normal (300f)
// Phase 2 (75-40%): ai[0]=1
//   Same pattern, faster (240f/70f/300f/240f)
// Phase 3 (40-20%): ai[0]=2
//   Third bullet hell at 60%
// Phase 4 (20-8%): ai[0]=3 → brothers
// Phase 5 (8-1%): ai[0]=3 → 2nd worm (no hearts)
// Phase 6 (1-0%): acceptance
```

### 4.3 Bullet Hell Implementation
- 5 bullet hells, each 15s (900 frames at 60fps → scale to 15s real time)
- Projectiles from screen edges toward player position
- Pattern per hell (from source):
  - Hell 1: Vertical (top) → Horizontal (L/R) → All three
  - Hell 2: Fireblasts from top → right → top
  - Hell 3-5: Increasing density, mixed types

### 4.4 Normal Attacks (ai[1] = 0 or 4)
Weighted random per attack tick:
- Fireblast (homing, pause, burst 12) — 40%
- Gigablast (larger, steer, burst 28) — 30%
- Barrage (ring 30 accelerating) — 30%
- Phase 2+: Faster intervals, more projectiles

### 4.5 Charge → Ranger Attack Replacement
**Replace `charge()` with `rangerShot()`:**
```javascript
function rangerShot() {
  // Telegraph: shield appears, rotates to player (0.5s)
  rangerTelegraph = 0.5;
  rangerState = 'telegraph';
  scalAnimState = 'casting';
  
  // After telegraph: fire homing projectile
  // Projectile: large, homes with inertia, pauses at 170px for 0.55s, bursts 16 darts
}
```

### 4.6 Brothers Phase (20% HP)
- Spawn Cataclysm (left) and Catastrophe (right)
- SC invulnerable, teleports to center
- Brothers: 8 HP each, attack patterns from source
- On one death: survivor enrages (faster, more projectiles)
- Both dead: SC vulnerable, phase 5

### 4.7 Second Worm (8% HP)
- Same as first but NO hearts
- SC remains vulnerable
- Worm cannot be killed normally (99.9999% DR)
- Fight continues until SC 1%

---

## Phase 5: Rage/TP Bars Reposition & Animation

### 5.1 New Position
```javascript
const BAR_X = AX - 100;  // Left of arena
const BAR_Y_RAGE = AY + 20;
const BAR_Y_TP = AY + 20 + 46;
const BAR_W = 80, BAR_H = 36;
```

### 5.2 Draw Function (`drawMeter`)
- Fill: `ctx.drawImage(barSheet, 0, 0, fw, fh, x, y, fw, fh)` where `fw = w * ratio`
- Border: `sprite(borderKey, x + w/2 + 12, y + h/2, 1, 0)`
- Full glow: if `ratio >= 1`, `sprite(animKey, x + w/2 + 12, y + h/2, 1, 0)`
- Label: Icon + text to right of border

### 5.3 Rage Mechanics (Unchanged)
- Builds when `hp < MAXHP`: `rage += dt / 20`
- Z activates: `rageMode = 1, rageModeT = 8, rage = 0`
- Doubles all strike damage for 8s

### 5.4 TP Mechanics (Unchanged)
- Builds on graze: `tp += dt * 0.4` when bullet within 26px
- X activates: `shieldT = 3` (3s barrier, blocks one hit)

---

## Phase 6: Integration & Polish

### 6.1 Hit Detection Updates
- Worm segments: No contact damage (damage = 0)
- Worm head: No contact damage
- Hearts: Only damageable in order, 18px radius
- SC: Vulnerable only when not in bullet hell, not shielded, no worm alive

### 6.2 Visual Polish
- SC shield/forcefield: Proper lerp animations
- Worm charge telegraph: Red ring expanding at head
- Heart tendril destruction: Blood particles along curve
- Bar full animation: Looping sprite overlay

### 6.3 Performance
- Worm segments: Max 52, update positions in single loop
- Hearts: 10 static + tendril math
- Bullets: Existing pool (900 limit)
- Target: 60fps on mid hardware

---

## Phase 7: Testing

### 7.1 Unit Tests (New `fixes19.mjs`, `fixes20.mjs`)
- Worm segment count = 51, positions follow head
- Worm charges at SC every ~2.5s, fires 30 projectiles
- Hearts spawn 10, correct positions, tendrils render
- Heart destruction order enforced
- 5 bullet hells trigger at correct HP%
- Ranger attack replaces charge, fires homing + burst
- Rage/TP bars at correct position, animate correctly
- Brothers spawn at 20%, 2nd worm at 8%

### 7.2 Integration Tests
- Full fight playthrough (fresh save)
- No softlocks, all phases transition
- Performance: 60fps sustained

---

## File Changes Summary

| File | Change Type |
|------|-------------|
| `site/js/data/sheets.js` | Add 13 sheet entries |
| `site/js/act4/boss-scal.js` | Major rewrite (worm, hearts, attacks, bars) |
| `site/img/act4/calamity/*.png` | 13 new placeholder sprites |
| `site/tests/fixes19.mjs` | New: worm mechanics |
| `site/tests/fixes20.mjs` | New: hearts + attack cycle |
| `site/tests/fixes8.mjs` | Update: brother enrage dodge |
| `site/tests/fixes18.mjs` | Update: heart mechanics |

---

## Timeline Estimate

| Phase | Estimate |
|-------|----------|
| 1: Sheets + Sprites | 30 min |
| 2: Worm Rewrite | 90 min |
| 3: Hearts | 60 min |
| 4: Attack Cycle | 90 min |
| 5: Bars | 30 min |
| 6: Integration | 60 min |
| 7: Testing | 60 min |
| **Total** | **~7 hours** |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Worm 51 segments lag | Update positions in single loop, skip draw if offscreen |
| Heart tendril math expensive | Precompute bezier points, update only when worm moves |
| Attack cycle desync | Use single `attackTimer` + phase gates, not independent timers |
| Sprite missing | Fallback to colored rects with correct dimensions |
| Bar sheets missing | Generate procedural fallback in `drawMeter` |