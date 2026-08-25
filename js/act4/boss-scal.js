/* boss-scal.js — Supreme Witch, Calamitas.
   ───────────────────────────────────────────────────────────────────
   The thing that was making the noise.

   HER CYCLE IS FIXED AND THAT IS THE DESIGN. Twenty steps, in order,
   and it does not reset when she changes phase. The only randomness in
   the whole fight is which dart bursts get swapped for a fireblast or
   a gigablast. That is taken straight from the game and it is the
   single most important thing to preserve: a fixed cycle is what makes
   a wall of projectiles learnable instead of unfair. Randomise it and
   you have made it easier to write and impossible to master.

   WHAT MAKES IT FUN HERE:

   1. YOU ALREADY KNOW HOW TO PLAY. Same soul, same i-frames, same
      shift-to-focus as the room behind the cube. The fight is new; the
      controls are two hours old.

   2. THE INTERLUDES ARE REST, NOT DIFFICULTY. Each bullet-hell wall is
      survivable by standing still in the right gap. They exist to mark
      the phase boundaries so you can feel progress in a fight whose
      health bar you are too busy to look at.

   3. SHE IS INVINCIBLE AT PREDICTABLE TIMES, AND SAYS SO. Damage that
      does nothing with no explanation is the most demoralising thing a
      boss can do.

   4. FIVE HP, AND DYING COSTS YOU THE FIGHT, NOT THE HOUR. The save
      point is on the other side of one door.                        */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};

  var wrap = document.getElementById('bh');          // reuses the room's canvas
  var cv   = document.getElementById('bhCanvas');
  if (!wrap || !cv) { NEU.scal = { open: function () {} }; return; }
  var ctx = cv.getContext ? cv.getContext('2d') : null;
  if (!ctx) { NEU.scal = { open: function () {} }; return; }
  var msg = document.getElementById('bhMsg');

  var dm = NEU.danmaku || {};
  var COL = { bone: '#EDE7DE', soul: '#E23B55', dim: '#8A8598', void_: '#08080B',
              brim: '#FF4A2A', brimHi: '#FFC46A', dark: '#8C2F4A' };

  var PLAYER_R = (dm.soul && dm.soul.R) || 6, SPEED = dm.SPEED || 250,
      FOCUS = dm.FOCUS || 108, IFRAMES = dm.IFRAMES || 1.1;
  var MAXHP = 5;

  /* Fair hitboxes: every enemy projectile's collision radius, derived
     from the REAL Terraria hitbox each `.cs` declares (sheets.js's
     `hitRadius`), converted through the same 150/224 Terraria-to-site
     ratio the burst-proximity trigger already uses, with a light 0.85
     inset kept for forgiveness. These used to be hand-picked constants
     with no tie to the drawn art at all, and drifted in both
     directions — hellblast drew 27x22 on screen with a hit radius of 5
     (a ratio of 2.2, meaning a dart could visibly pass through the
     soul with no hit), gigablast the same at 1.6x. Real numbers now
     replace every guess. Falls back to the old hand-picked constants
     only if sheets.js failed to load. */
  var HB = {
    dart:      (NEU.hitRadius && NEU.hitRadius('dart', 0.85))      || 4,
    hellblast: (NEU.hitRadius && NEU.hitRadius('hellblast', 0.85)) || 5,
    fireblast: (NEU.hitRadius && NEU.hitRadius('fireblast', 0.85)) || 8,
    gigablast: (NEU.hitRadius && NEU.hitRadius('gigablast', 0.85)) || 12,
    /* the brothers' STRIKE reach (the player's own hit check against
       them), from their real 120x120 Terraria hitbox — both
       SupremeCataclysm.cs and SupremeCatastrophe.cs declare it. This one
       needs to grow, not shrink: they used to draw as their own 50x22 /
       67x20 thrown-attack sprites (see the brother body-sprite fix
       below) with a 28px reach that was already too small for THAT art;
       now that they draw their real ~80px body, 28px would only let a
       strike land near their exact centre. No inset — a full-inset
       generous reach on the PLAYER's own attack is a fairness feature,
       matching how Calamitas's own 40px strike reach already works. */
    broReach:  (NEU.hitRadius && NEU.hitRadius('cataclysm', 1))    || 28
  };

  /* Her cycle — SupremeCalamitas.cs:2093-2175, all TWENTY-FOUR cases,
     not the 20 this file used to carry. Its `phase` values map straight
     onto these step codes:
       0 shots above -> 'd'   1 charge      -> 'c'
       3 hellblasts  -> 'h'   4 fireblasts  -> 'f'
     Fireblast gets six slots of its own here. It used to exist only as
     an 18% random substitution inside 'd', which made the rarest thing
     in the fight out of one of its six scheduled attacks.
     WILL_CHARGE is the source's willCharge flag (:582): the step BEFORE
     each charge, during which she raises her forcefield. True at 2, 7,
     13, 17 — and 3, 8, 14, 18 are all 'c'. */
  var CYCLE = ['d','h','f','c','c','f','h','d','c','d','h','f',
               'f','h','c','d','f','f','c','c','d','c','d','c'];
  var WILL_CHARGE = { 2: 1, 7: 1, 13: 1, 17: 1 };
  /* The wiki names gigablast volleys of 4 and 2 among the fireblast
     slots; the rest fire a homing fireblast. */
  var GIGA_AT = { 11: 4, 12: 4, 16: 2, 17: 2 };

  var running = false, last = 0, t = 0, lastDt = 1 / 60;
  var px = 0, py = 0, keys = {}, hp = MAXHP, inv = 0;
  /* U1/U2: your two resources. Rage builds while you are missing
     hearts and is SPENT by z — a full bar buys eight seconds of
     doubled strikes. TP builds by grazing bullets and spends itself
     as a barrier that takes one hit (x). Both are the fight rewarding
     you for doing what the fight already asked you to do. */
  var rage = 0, tp = 0, shieldT = 0;
  var rageMode = 0, rageModeT = 0;
  /* Full-bar flourish timers: 0 starts the one-shot animation, >=1
     means it has finished playing (or was never triggered). */
  var rageAnimT = 9, tpAnimT = 9, rageFullPrev = 0, tpFullPrev = 0;
  /* What the meters DRAW. A bar that snaps to its value reads as a
     counter; one that sweeps toward it reads as charging, which is the
     whole point of RipperUI's presentation. */
  var rageShown = 0, tpShown = 0, grazeT = 0;
  /* RipperUI.cs:24-27 — rage is 10 frames at a 6-frame delay, adrenaline
     10 at a 5-frame delay. This file used to run both off one 1.0s
     window, so tp's flourish was 20% too slow. */
  var RAGE_ANIM_S = 10 * 6 / 60, TP_ANIM_S = 10 * 5 / 60;
  var AX = 0, AY = 0, AW = 0, AH = 0;
  var bullets = [], step_ = 0, stepT = 0, phase = 1;
  var bossHP = 1, bossMax = 1, invuln = false;
  var mode = 'intro';        // intro | fight | wall | brothers | dead | won
  var wallT = 0, wallN = 0, walls = [];
  var hearts = [], sep = null, bros = [];
  /* scal-worm.js delegation flag: true between open()'s init and
     close()'s reset, so init runs once per fight, not once per frame. */
  var scalWormReady = false;
  /* scal-seekers.js delegation flag — same once-per-fight contract as
     scalWormReady: init in open(), reset here-in-close(). */
  var seekersReady = false;
  /* The player's own homing shots (V5 phase 2). Deliberately NOT
     `bullets` — NEU.scal.bullets feeds the test dodge AI, and mixing
     friendly fire into it would teach the bot to dodge its own gun. */
  var myShots = [], charging = false, chargeF = 0, shotCd = 0;
  var line = '', lineT = 0;
  var bx = 0, by = 0;        // her position
  var orbA = Math.PI * 1.5;
  var dying = 0;
  var showHitboxes = false;  // F3 toggle
  /* Attack timers outlive the attack that scheduled them — a gigablast
     that is mid-spread when she phases out would keep dropping bullets
     into the wall interlude. Track them so a phase transition can kill
     the stragglers. */
  var sched = [];
  function later(fn, ms) { var id = setTimeout(fn, ms); sched.push(id); return id; }
  function clearSched() {
    for (var i = 0; i < sched.length; i++) clearTimeout(sched[i]);
    sched = [];
  }

  /* ── her voice ──────────────────────────────────────────────────
     Six real Calamity .ogg files, one per attack family. The pooled
     pattern from sans.js: four copies of the SAME file, because one
     element cuts itself off and different files read as a flam.
     Pools are built in open() so the first attack never waits. */
  var SFX = null, sfxI = 0;
  function preloadSfx() {
    SFX = {};
    var names = ['hellblast', 'fireblast', 'fireblast-hit', 'giga', 'giga-hit', 'maelstrom'];
    for (var n = 0; n < names.length; n++) {
      var pool = [];
      try {
        for (var i = 0; i < 4; i++) {
          var a = new Audio('audio/act4/' + names[n] + '.ogg');
          a.preload = 'auto'; a.volume = 0.5;
          pool.push(a);
        }
      } catch (e) { pool = []; }
      SFX[names[n]] = pool;
    }
  }
  function sfxPlay(name) {
    var pool = SFX && SFX[name];
    if (!pool || !pool.length) return;
    var a = pool[sfxI++ % pool.length];
    try {
      a.currentTime = 0;
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  function say(s) { line = s; lineT = performance.now(); }

  function layout() {
    var dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = (innerWidth * dpr) | 0; cv.height = (innerHeight * dpr) | 0;
    cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    var ar = dm.arena ? dm.arena(innerWidth, innerHeight, 700, 460, 24) : null;
    if (ar) {
      AW = ar.AW; AH = ar.AH; AX = ar.AX; AY = ar.AY;
    } else {
      AW = Math.min(700, innerWidth - 60);
      AH = Math.min(460, innerHeight - 190);
      AX = ((innerWidth - AW) / 2) | 0;
      AY = ((innerHeight - AH) / 2 + 24) | 0;
    }
    px = Math.min(Math.max(px, AX + 12), AX + AW - 12);
    py = Math.min(Math.max(py, AY + 12), AY + AH - 12);
    meterRects = meterSlots(AX, AY, AW, AH);
    /* keep the worm's arena in step with resizes */
    if (NEU.scalWorm && scalWormReady) NEU.scalWorm.setArena(AX, AY, AW, AH);
    if (NEU.scalSeekers && seekersReady) NEU.scalSeekers.setArena(AX, AY, AW, AH);
  }

  /* The meters live OUTSIDE the fight box: a left gutter column when
     the viewport leaves room (AX >= 118), otherwise a horizontal row
     under the HP line. Pure so tests can probe both branches. */
  var meterRects = [];
  function meterSlots(ax, ay, aw, ah) {
    if (ax >= 118) {
      return [{ x: ax - 100, y: ay + 20, w: 80, h: 36 },
              { x: ax - 100, y: ay + 66, w: 80, h: 36 }];
    }
    return [{ x: ax, y: ay + ah + 30, w: 80, h: 36 },
            { x: ax + 160, y: ay + ah + 30, w: 80, h: 36 }];
  }
  addEventListener('resize', function () { if (running) layout(); });

  function stamp(rows, cx, cy, s, col) {
    if (dm.soul && dm.soul.stamp) {
      dm.soul.stamp(ctx, rows, cx, cy, s, col);
      return;
    }
    var h = rows.length, w = rows[0].length;
    var x0 = (cx - w * s / 2) | 0, y0 = (cy - h * s / 2) | 0;
    ctx.fillStyle = col;
    for (var r = 0; r < h; r++) for (var c = 0; c < w; c++)
      if (rows[r][c] === '#') ctx.fillRect(x0 + c * s, y0 + r * s, s, s);
  }

  function shot(x, y, vx, vy, r, c, kind) {
    if (dm.shot) {
      dm.shot(bullets, x, y, vx, vy, r, c, kind, 900);
      return;
    }
    if (bullets.length > 900) return;
    bullets.push({ x: x, y: y, vx: vx, vy: vy, r: r, c: c, k: kind || 0, age: 0 });
  }

  /* ── her attacks ────────────────────────────────────────────────*/
  function dartBurst() {
    /* BrimstoneBarrage from above. Source: SupremeCalamitas.cs ai[1]==0:
       SCal hovers 550px above the player (here: by, near the top), and
       fires 8 darts in a ±20° spread toward the player every ~90 frames.
       A burst may be randomly replaced by a fireblast or gigablast —
       that randomness is the ONLY randomness in the cycle. The mod fires
       3-4 bursts per attack slot, ~20 frames apart. */
    /* SupremeCalamitas.cs ai[1]==0: FrameType = FasterUpwardDraft — the
       SAME band the dash uses (confirmed in-file), not Casting. She
       hovers 550 Terraria px above the player during this attack. */
    scalAnimState = 'charging';
    var bursts = 3 + (Math.random() * 2 | 0);
    var span = AW * 0.7;
    for (var b = 0; b < bursts; b++) {
      later(function (k) {
        return function () {
          if (!running) return;
          /* 8 darts, ±20° (ToRadians(20) — confirmed exact in
             SupremeCalamitas.cs, numProj 8). The gap walks
             deterministically between bursts so a player who found the
             safe spot in burst 1 has to move for burst 2. */
          var n = 8, rot = 0.35;
          var hole = Math.floor(span / n * 1.5 * k) % n;
          var baseA = Math.atan2(py - by, px - bx);
          /* Per-burst sweep: offset the aim by up to ±0.18 rad so the
             wall does not always land on the player's current spot. */
          var sweep = (k % 3 - 1) * 0.18;
          /* The source's fixed ±20° fan only stays dodgeable because SCal
             hovers a constant 550 Terraria px away — that keeps the gap
             between darts small no matter where the player stands. This
             arena is smaller and she tracks the player's X, so the same
             fixed ANGLE opens a gap that grows with distance: past ~260px
             the darts are >26px apart, wider than a bullet-plus-soul
             (10px), and a player who finds that gap can stand in it
             through the whole burst. Cap the SPREAD IN PIXELS instead of
             radians — same 8-dart fan, same hole, same sweep, but the
             angle shrinks at range so neighbouring darts never open more
             than a dodgeable gap. */
          var dist = Math.max(60, Math.hypot(px - bx, py - by));
          var maxGapPx = (4 + PLAYER_R) * 2 * 0.85;
          var rotCapped = Math.min(rot, maxGapPx * (n - 1) / (2 * dist));
          for (var j = 0; j < n; j++) {
            if (j === hole) continue;
            var t = n === 1 ? 0 : j / (n - 1);
            var a = baseA + sweep + (t * 2 - 1) * rotCapped;
            var sp = 150 + phase * 30;
            shot(bx, by + 20, Math.cos(a) * sp, Math.sin(a) * sp, HB.dart, COL.brim, 0);
          }
        };
      }(b), b * 340);
    }
  }

  function fireblast() {
    /* Homes to player continuously, bursts into 12 darts within 150px (real: 224 Terraria px).
       Source: inertia 100, homeSpeed 9 (13 revenge), rotation = vel + PI/2.
       Spawns with vx/vy both 0 (inertia 100 means velocity barely moves
       for its first ~100 frames), so seed `rot` toward the player at
       spawn — moveBullets only updates it once real velocity exists,
       which used to leave atan2(0,0) picking a fixed, wrong angle for
       the whole homing wind-up and again for the entire burst pause. */
    sfxPlay('fireblast');
    scalAnimState = 'casting';
    var sy = by + 20;
    var b = { x: bx, y: sy, vx: 0, vy: 0, r: HB.fireblast, c: COL.brimHi, k: 1, age: 0, burst: false,
              rot: Math.atan2(py - sy, px - bx) + Math.PI / 2 };
    bullets.push(b);
  }

  function gigablast(n) {
    sfxPlay('giga');
    scalAnimState = 'gigablast';
    for (var i = 0; i < n; i++) {
      later(function () {
        if (!running) return;
        var sy = by + 20;
        bullets.push({ x: bx, y: sy, vx: 0, vy: 0, r: HB.gigablast, c: COL.dark,
                       k: 2, age: 0, burst: false,
                       rot: Math.atan2(py - sy, px - bx) + Math.PI / 2 });
      }, i * 520);
    }
  }

  function hellbarrage() {
    /* From beside the player, horizontally. Source: SupremeCalamitas.cs
       ai[1]==3: SCal moves to 600px left or right of the player at the
       same Y (confirmed, line ~2399-2411), then fires a
       BrimstoneHellblast at the player every 20 frames (NPC.ai[3] >= 20,
       confirmed line ~2453). FrameType = OutwardHandCast (confirmed).
       Real cadence is one shot per 20 frames (0.333s) for up to 480
       frames (8s) — this fight compresses every cycle step into a
       fraction of that, so the interval is kept source-accurate and the
       COUNT is what's scaled down, to fit the step's own stepT budget
       (see fightTick's 'h' branch) instead of an invented flat 7.

       THE BUG THIS REPLACES: the loop below used to read
         later(function () { return function () { ... }; }, i * 90)
       — an extra `return function () {...}` with no invoking `(i)`,
       identical in shape to dartBurst's factory EXCEPT dartBurst ends
       `}(b)`. setTimeout called the outer wrapper, which returned the
       real handler and threw the return value away: the wrapper's body
       — the only place a hellblast was ever pushed — never ran. Proven
       by direct reproduction: 7 scheduled calls, 0 bullets fired. 'h' is
       4 of her 20 cycle steps, so this was 20% of the fight silently
       idle the entire time, under a test (fixes13.mjs) that only
       checked the string `sfxPlay('hellblast')` appears in the file. */
    sfxPlay('hellblast');
    scalAnimState = 'hellblast';
    var left = px < AX + AW / 2;
    var x = left ? AX - 20 : AX + AW + 20;
    var interval = 0.333;                    /* 20 frames at 60fps, confirmed exact */
    var count = Math.max(3, Math.round((1.5 * (phase === 2 ? 0.62 : 1)) / interval));
    for (var i = 0; i < count; i++) {
      later(function (k) {
        return function () {
          if (!running) return;
          /* Purely horizontal, per source ("shoots the Hellblasts
             horizontally"); the spawn Y tracks the player's position
             at the moment each shot fires. */
          shot(x, py + (Math.random() - 0.5) * 40, (left ? 1 : -1) * 90, 0, HB.hellblast, COL.brim, 3);
        };
      }(i), i * interval * 1000);
    }
  }

  function charge() {
    var a = Math.atan2(py - by, px - bx);
    bxv = Math.cos(a) * 420; byv = Math.sin(a) * 420;
    chargeT = 0.55;
    chargeTelegraph = 0.5; // telegraph time before dash
    teleJuiced = false;
    scalAnimState = 'charge_telegraph';
    scalAnimFrame = 0;
    scalAnimTimer = 0;
  }
  var bxv = 0, byv = 0, chargeT = 0, chargeTelegraph = 0, chargeBurst = 0, chargeBurstMax = 0, chargeGap = 0;
  /* SupremeCalamitas.cs:582 — true during the attack BEFORE a charge, so
     her forcefield goes up as a telegraph. Set from WILL_CHARGE. */
  var willCharge = false;
  /* one-shot latch so the telegraph's juice fires once per wind-up,
     not every frame of its tail */
  var teleJuiced = false;
  var scalAnimState = 'idle', scalAnimFrame = 0, scalAnimTimer = 0, scalAnimPrevState = 'idle';

  /* ── the interludes ─────────────────────────────────────────────*/
  /* The five bullet hells, each with its OWN direction sequence
     (official wiki). wallTick used to index this by BEAT alone —
     `[['d','r','l'], ['u','r'], ['d','l','r']][beat]` — so every wall
     fired the identical three beats and the interludes read as one
     repeated attack. */
  var WALL_BEATS = [
    [['d','r','l'], ['l','r'],   ['d','l','r']],   /* 0 — spawn */
    [['u'],         ['r'],       ['l','r']],       /* 1 — 75% */
    [['d'],         ['l'],       ['l','r']],       /* 2 — 50% */
    [['u'],         ['r'],       ['l','r']],       /* 3 — 28% */
    [['d'],         ['l','r'],   ['d','l','r']]    /* 4 — 12%, + skulls */
  ];

  function startWall(n) {
    mode = 'wall'; wallT = 0; wallN = n; walls = []; bullets = [];
    clearSched();
    invuln = true;
    sfxPlay('maelstrom');
    say(n === 0 ? "* the room fills up."
      : n === 1 ? "* it fills up faster."
      : n === 2 ? "* and again, with something heavier."
      : n === 3 ? "* she is not slowing down."
                : "* the last one. it is all of them at once.");
  }

  function wallTick(dt) {
    wallT += dt;
    var beat = Math.floor(wallT / 1.35);
    if (beat > walls.length - 1 && beat < 3) {
      walls.push(beat);
      /* down / right / left, then left+right, then down+left+right —
         the order the game uses, so anyone who knows it is rewarded.
         Beats 0 and 2 fire two horizontal walls at once; their holes
         share ONE y so the two walls leave a single passable strip.
         Independent random holes made the first attack a coin flip:
         the walls reach you at the same instant, and surviving needed
         both holes to overlap. */
      var dirs = (WALL_BEATS[wallN] || WALL_BEATS[0])[beat] || ['d'];
      var holeY = (beat === 0 || beat === 2) ? (AY + 70 + Math.random() * (AH - 140)) : null;
      dirs.forEach(function (d, i) { later(function () { wallLine(d, holeY); }, i * 240); });
      /* Wall 4 is the fifth bullet hell: it adds Brimstone Flame Skulls
         on top of the dart rows (wiki). */
      if (wallN === 4) later(function (bt) {
        return function () { if (running) skullWave(bt % 2 === 0); };
      }(beat), 500);
    }
    if (wallT > 4.6) {
      bullets = []; invuln = false;
      if (wallN === 0) spawnSepulcher(); else { mode = 'fight'; say(''); }
    }
  }

  function wallLine(d, holeY) {
    if (!running) return;
    var gap = 60 + Math.random() * (AW - 160);
    for (var i = 0; i < 22; i++) {
      var p = i / 21;
      if (d === 'd' || d === 'u') {
        var x = AX + p * AW;
        if (Math.abs(x - (AX + gap)) < 54) continue;
        shot(x, d === 'd' ? AY - 20 : AY + AH + 20, 0, (d === 'd' ? 1 : -1) * 210, 6, COL.brim);
      } else {
        var y = AY + p * AH;
        var gy = (holeY !== null && holeY !== undefined) ? holeY : (AY + gap * AH / AW);
        if (Math.abs(y - gy) < 48) continue;
        shot(d === 'r' ? AX - 20 : AX + AW + 20, y, (d === 'r' ? 1 : -1) * 210, 0, 6, COL.brim);
      }
    }
  }

  /* Brimstone Flame Skulls — the fifth bullet hell's addition (wiki):
     skulls that cross the arena in a horizontal wave. No new art:
     BrimstoneHellblast2.png IS a skull, so this is a motion change and
     the draw switch below routes k5 to the same sheet as k3. */
  function skullWave(fromLeft) {
    if (!running) return;
    for (var i = 0; i < 5; i++) {
      var y = AY + 60 + i * (AH - 120) / 4;
      bullets.push({ x: fromLeft ? AX - 20 : AX + AW + 20, y: y,
                     vx: (fromLeft ? 1 : -1) * 150, vy: 0,
                     r: HB.hellblast, c: COL.brim, k: 5, age: 0,
                     baseY: y, phase_: i * 0.6 });
    }
  }

  function spawnSepulcher() {
    mode = 'fight'; invuln = true;
    /* Position marker only — movement, trail, act machine and darts
       all live in js/act4/scal-worm.js now. Everything else reads `sep`
       for truthiness alone (resolveTarget, moveMyShots, fightTick,
       draw's layer gate). */
    sep = { x: AX + AW / 2, y: AY + AH - 40 };
    if (NEU.scalWorm && scalWormReady) NEU.scalWorm.spawn(sep.x, sep.y);
    /* Ten immobile hearts in the two upper corners — SepulcherHead.cs and
       BrimstoneHeart.cs, read directly: NPC.damage = 0 on the head (it
       hurts nothing on touch) and the mod spawns ten hearts fixed at the
       arena's upper corners, not attached to the worm's body at all.
       They used to ride the body in a chain, which meant reaching one
       put the soul inside the head's own (invented, non-source) contact
       zone — you had to trade a hit to break a heart. Fixed corner
       positions make every heart reachable for free, same as the source. */
    hearts = [];
    for (var i = 0; i < 10; i++) {
      var left = i < 5, idx = i % 5;
      hearts.push({
        /* Three bolts each. The heart pool IS the length of the worm
           phase — the Sepulcher's own 6-step SCRIPT (scal-worm.js:49-56)
           runs about 25s a lap, and one-shot hearts ended the phase
           before a single lap finished. */
        hp: 3,
        x: (left ? AX + 44 : AX + AW - 44) + (idx % 2 ? (left ? 18 : -18) : 0),
        y: AY + 46 + idx * 28
      });
    }
    say(flagged(7) ? "* she goes back behind it. again."
                   : "* she is behind it. kill the hearts.");
  }

  /* ── the ring ───────────────────────────────────────────────────
     20% health: ten Supreme Soul Seekers on a rotating ring, and she is
     invulnerable until the last one dies (official wiki; the module in
     scal-seekers.js holds the source cites). She parks at arena centre
     for it — fightTick returns above her hover/orbit chain while ringOn,
     so nothing moves bx/by until the last seeker dies — which is what
     the source does anyway (she is immobile here), and her resting
     position (by = AY - 24) is ABOVE the frame, where a ring would not
     fit. */
  var ringOn = false;
  function startSeekers() {
    if (!NEU.scalSeekers) return;         /* module absent: skip the phase */
    ringOn = true; invuln = true; bullets = [];
    clearSched();
    bx = AX + AW / 2; by = AY + AH * 0.34;
    NEU.scalSeekers.spawn();
    sfxPlay('maelstrom');
    say("* she puts ten eyes between you and her.");
  }

  /* ── the brothers ───────────────────────────────────────────────*/
  function startBrothers() {
    mode = 'brothers'; invuln = true; bullets = [];
    clearSched();
    bros = [
      { side: -1, x: AX + 60, y: AY + AH / 2, hp: 8, t: 0, kind: 'slash', attackCount: 0, enraged: false, volley: 0, barrageCd: 0 },
      { side:  1, x: AX + AW - 60, y: AY + AH / 2, hp: 8, t: 0, kind: 'fist', attackCount: 0, enraged: false, volley: 0, barrageCd: 0 }
    ];
    say("* she calls her brothers. she does not fight while they do.");
  }

  /* ── loop ───────────────────────────────────────────────────────*/
  function stepFn(now) {
    if (!running) { if (dying) deathStep(now); return; }
    requestAnimationFrame(stepFn);
    var dt = Math.min(0.033, (now - last) / 1000); last = now;
    lastDt = dt;
    /* Hit-stop: hold the frame, keep rendering. Skipping the render
       too would read as a dropped frame rather than a held one. */
    if (NEU.juice && NEU.juice.frozen()) { draw(now); return; }
    t += dt;

    /* Rage: PROXIMITY fills the bar (RipperUI's rage is earned by
       staying in the fight, so fastest point-blank ~10s, slowest at
       max range ~50s). A full bar is spent by z (activateRage) — it no
       longer spends itself, because a resource that fires without the
       player's say-so is a timer, not a choice. */
    if (!dying && (mode === 'fight' || mode === 'wall' || mode === 'brothers')) {
      var rd = Math.hypot(px - bx, py - by);
      var near = 1 - Math.min(1, rd / 420);
      /* Calamity wiki: the Rage Meter fills by proximity, bosses triple
         the rate, and a full bar takes 30s. 0.0333/s base x3 at
         point-blank = 10s close, 30s far. It does NOT drain here — a
         ratchet, by design decision, unlike the mod's 3.33%/s bleed. */
      rage = Math.min(1, rage + dt * 0.0333 * (1 + 2 * near));
    }
    if (rageModeT > 0) {
      rageModeT -= dt;
      if (rageModeT <= 0) { rageMode = 0; say('* the rage burns out. it wants to be earned again.'); }
    }
    if (shieldT > 0) shieldT -= dt;
    /* Charging the shot: f held accumulates power over ~0.9s (capped),
       released by keyup → tryHit(). shotCd keeps taps from machine-
       gunning bolts. */
    if (charging) chargeF = Math.min(1, chargeF + dt);
    if (shotCd > 0) shotCd -= dt;
    /* Full-bar flourish plays ONCE per fill (RipperUI.cs plays its
       animation with a fixed frame delay and stops — it is a flourish,
       not a screensaver). */
    if (rage >= 1) {
      if (rageFullPrev < 1) rageAnimT = 0;
      if (rageAnimT < RAGE_ANIM_S) rageAnimT += dt;
    }
    rageFullPrev = rage;
    if (tp >= 1) {
      if (tpFullPrev < 1) tpAnimT = 0;
      if (tpAnimT < TP_ANIM_S) tpAnimT += dt;
    }
    tpFullPrev = tp;
    /* The sweep. Six per second converges in about half a second —
       fast enough to feel responsive, slow enough to read as charging. */
    var ease = Math.min(1, dt * 6);
    rageShown += (rage - rageShown) * ease;
    tpShown   += (tp   - tpShown)   * ease;

    if (mode !== 'intro' && mode !== 'won') movePlayer(dt);
    if (inv > 0) inv -= dt;

    if (mode === 'intro') { if (t > 2.6) startWall(0); }
    else if (mode === 'wall') wallTick(dt);
    else if (mode === 'brothers') brothersTick(dt);
    else if (mode === 'fight') fightTick(dt);

    moveBullets(dt);
    moveMyShots(dt);
    draw(now);
  }

  function movePlayer(dt) {
    var vx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    var vy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (vx && vy) { vx *= 0.7071; vy *= 0.7071; }
    var sp = keys.focus ? FOCUS : SPEED;
    px = Math.min(Math.max(px + vx * sp * dt, AX + 7), AX + AW - 7);
    py = Math.min(Math.max(py + vy * sp * dt, AY + 7), AY + AH - 7);
  }

  function fightTick(dt) {
    /* Contact damage: she hurts on touch only while telegraphing or
       dashing; the dive sweep hurts while she is crossing. The
       sepulcher hurts only while its head is charging at you —
       its body segments never do (the mod zeroes body damage), so
       standing in the body to break a heart costs nothing. */
    if (inv <= 0) {
      /* Sepulcher deals no contact damage — SepulcherHead.cs:45 sets
         NPC.damage = 0 outright, confirmed directly in the source. It
         used to hurt on touch while charging, which meant reaching a
         heart (all of which used to ride its body) required trading a
         hit to get there. The rewrite below moves the hearts off the
         worm entirely, but this stays removed either way: it was never
         source-accurate. */
      var touching = false;
      if ((chargeTelegraph > 0 || chargeT > 0) &&
          Math.hypot(px - bx, py - by) < 34) touching = true;
      if (touching && hitPlayer()) return;
    }

    if (ringOn && NEU.scalSeekers) {
      /* She holds still; the ring is the attack. This block sits ABOVE
         the hover/charge chain on purpose: her idle branch orbits the
         player, so letting that run first would drag her (and the ring,
         which re-centres on her every tick) around the arena instead of
         holding the park point startSeekers chose. Both callbacks are
         the SAME ones the worm uses (the sep block below), so graze
         feeds tp under moveBullets' rule and a hit routes through
         hitPlayer with the shield and i-frames behaving identically. */
      NEU.scalSeekers.setPlayer(px, py);
      NEU.scalSeekers.tick(dt);
      NEU.scalSeekers.tickDarts(dt, px, py,
        function () { feedGraze(dt, true); },
        function () { if (inv <= 0 && mode !== 'won') hitPlayer(); });
      if (!NEU.scalSeekers.alive()) {
        ringOn = false; invuln = false;
        say("* the eyes go out. she is exposed again.");
        /* pause before she resumes the cycle — same interlude beat the
           worm exit uses */
        stepT = 1.2;
      }
      return;
    }

    /* she hovers above you unless charging */
    if (chargeTelegraph > 0) {
      chargeTelegraph -= dt;
      scalAnimState = 'charge_telegraph';
      /* Telegraph: glow red, one small shake as the dash commits */
      if (NEU.juice && !teleJuiced && chargeTelegraph < 0.1) {
        teleJuiced = true;
        NEU.juice.hit('small');
      }
    } else if (chargeT > 0) {
      chargeT -= dt; bx += bxv * dt; by += byv * dt;
      bx = Math.min(Math.max(bx, AX), AX + AW);
      by = Math.min(Math.max(by, AY + 30), AY + AH - 30);
      scalAnimState = 'charging';
      /* Multi-charge burst: after dash ends, queue next if any left */
      if (chargeT <= 0 && chargeBurst < chargeBurstMax - 1) {
        chargeBurst++;
        chargeGap = 0.45; // gap between dashes
        var a = Math.atan2(py - by, px - bx);
        bxv = Math.cos(a) * 420; byv = Math.sin(a) * 420;
        chargeT = 0.55;
        chargeTelegraph = 0.3; // shorter telegraph for subsequent dashes
        teleJuiced = false;
      }
    } else if (chargeGap > 0) {
      chargeGap -= dt;
      scalAnimState = 'charge_recovery';
    } else {
      orbA += dt * 0.8;
      var orbR = 125 + 15 * Math.sin(t * 0.6);
      var cxp = Math.min(Math.max(px, AX + orbR + 20), AX + AW - orbR - 20);
      var cyp = Math.min(Math.max(py, AY + orbR + 20), AY + AH - orbR - 20);
      bx += ((cxp + Math.cos(orbA) * orbR) - bx) * Math.min(1, dt * 4);
      by += ((cyp + Math.sin(orbA) * orbR) - by) * Math.min(1, dt * 4);
      /* Idle or casting based on attack */
      if (stepT < 0.3) {
        scalAnimState = 'casting';
      } else {
        scalAnimState = phase === 2 ? 'idle_fast' : 'idle';
      }
    }

    if (sep) {
      /* Delegated worm: js/act4/scal-worm.js owns movement, the trail,
         the act machine, its darts and their drawing. This fight only
         drives it and decides what its callbacks mean. Its body deals
         NO contact damage (SepulcherHead.cs sets NPC.damage = 0) — the
         darts are its only threat, and both callbacks route through the
         SAME paths as hostile bullets: graze feeds tp under moveBullets'
         rule (cap included), a hit calls hitPlayer so shield / i-frames
         / death behave identically to a dart-bullet contact. */
      if (NEU.scalWorm) {
        NEU.scalWorm.setPlayer(px, py);
        NEU.scalWorm.tick(dt);
        NEU.scalWorm.tickDarts(dt, px, py,
          function () { feedGraze(dt, true); },
          function () { if (inv <= 0 && mode !== 'won') hitPlayer(); });
      }

      if (!hearts.length) {
        sep = null; invuln = false;
        say("* she steps out from behind it.");
        /* pause before she resumes the cycle — the interlude should land */
        stepT = 1.2;
      }
      return;
    }

    /* Charge burst handling: don't advance cycle until burst complete.
       The end condition is chargeBurst >= chargeBurstMax - 1: the last
       dash leaves the counter one short of the max, and demanding a
       full max here made every multi-charge softlock the fight. */
    if (chargeBurstMax > 0) {
      if (chargeBurst >= chargeBurstMax - 1 && chargeT <= 0 && chargeGap <= 0) {
        chargeBurstMax = 0; // burst complete, allow next attack
      } else {
        return; // wait for burst to finish
      }
    }

    stepT -= dt;
    if (stepT > 0) return;
    var posInCycle = step_ % CYCLE.length;
    var k = CYCLE[posInCycle];
    step_++;
    willCharge = !!WILL_CHARGE[posInCycle];
    var fast = phase === 2 ? 0.62 : 1;
    if (k === 'd') {
      /* Some bursts randomly become a blast. THE ONLY RANDOMNESS. */
      var r = Math.random();
      if (r < 0.18) fireblast();
      else if (r < 0.28) gigablast(1);
      else dartBurst();
      stepT = 0.72 * fast;
    } else if (k === 'h') { hellbarrage(); stepT = 1.5 * fast; }
    else if (k === 'f') {
      /* Source phase 4: she crosses to 750 Terraria px beside the player
         and lobs blasts. The wiki names gigablast volleys of 4 and 2 at
         four of these six slots; the other two are homing fireblasts. */
      var g = GIGA_AT[posInCycle];
      if (g) { gigablast(phase === 2 ? g - 1 : g); stepT = (g > 2 ? 2.2 : 1.5) * fast; }
      else   { fireblast(); stepT = 1.5 * fast; }
    }
    else if (k === 'c') {
      /* SupremeCalamitas.cs:2373 — willChargeAgain = ai[3] + 1 < 2, i.e.
         EXACTLY two dashes per charge entry. The wiki's "4 charges" are
         two ADJACENT 'c' entries (indices 3+4 and 18+19), not a per-slot
         table. This replaces a posInCycle -> p1Bursts lookup that matched
         six hardcoded positions of the old 20-step cycle. */
      chargeBurstMax = phase === 2 ? 1 : 2;
      chargeBurst = 0;
      chargeGap = 0;
      charge();
      stepT = 0.55 + 0.5; // telegraph + first dash
    }
    /* CYCLE has no 'm' — the charge dash is her only melee, matching the
       source, which has no dive attack at all. A dead 'm' branch used to
       sit here for a swept-dive that no cycle entry could ever reach. */
  }

  function brothersTick(dt) {
    /* Both alive: 25% DR (handled in tryHit). Fire in barrages with
       pauses — every 0.83s (50 frames) while active, then a hold while
       they swap sides. Every 7th volley = big attack. When one dies,
       the survivor enrages: faster volleys, shorter pauses. */
    for (var i = 0; i < bros.length; i++) {
      var b = bros[i];
      if (b.hp <= 0) continue; // dead, will be cleaned up below

      var interval = b.enraged ? 0.7 : 0.83; // enraged = faster
      b.t -= dt;
      b.y += Math.sin(t * 1.6 + i) * 22 * dt;
      if (b.barrageCd > 0) {
        b.barrageCd -= dt;
        if (b.barrageCd <= 0) {
          b.side *= -1;
          b.x = b.side < 0 ? AX + 60 : AX + AW - 60;
          if (NEU.juice) NEU.juice.hit('small');
        }
      }
      if (b.t <= 0 && b.barrageCd <= 0) {
        b.t = interval;
        b.attackCount++;
        b.volley = (b.volley || 0) + 1;
        if (b.volley >= (b.enraged ? 2 : 5)) {
          b.volley = 0;
          b.barrageCd = b.enraged ? 0.9 : 1.2;
        }
        var isBigAttack = (b.attackCount % 7 === 0);
        var a = Math.atan2(py - b.y, px - b.x);

        if (isBigAttack) {
          /* Big attack every 7th: fist = 2 fists, slash = predictive lunge (3 slashes ahead) */
          if (b.kind === 'fist') {
            /* Two fists from opposite sides */
            for (var s = -1; s <= 1; s += 2) {
              var aa = a + s * 0.25;
              shot(b.x, b.y, Math.cos(aa) * 280, Math.sin(aa) * 280, 7, COL.brimHi);
            }
          } else {
            /* Slash: predictive lunge - aim ahead of player */
            var pvx = 0, pvy = 0; // could track player velocity
            var predX = px + pvx * 0.5, predY = py + pvy * 0.5;
            var aa = Math.atan2(predY - b.y, predX - b.x);
            for (var j = -1; j <= 1; j++)
              shot(b.x, b.y, Math.cos(aa + j * 0.12) * 340, Math.sin(aa + j * 0.12) * 340, 5, COL.brim);
          }
        } else {
          /* Normal attack */
          if (b.kind === 'fist') {
            shot(b.x, b.y, Math.cos(a) * 240, Math.sin(a) * 240, 7, COL.brimHi);
          } else {
            var spread = b.enraged ? 0.1 : 0.16;
            var count = b.enraged ? 1 : 3;
            var start = -(count - 1) / 2;
            for (var j = 0; j < count; j++)
              shot(b.x, b.y, Math.cos(a + (start + j) * spread) * 300, Math.sin(a + (start + j) * spread) * 300, 5, COL.brim);
          }
        }
      }
    }

    /* Remove dead brothers */
    for (var i = bros.length - 1; i >= 0; i--) {
      if (bros[i].hp <= 0) {
        var dead = bros.splice(i, 1)[0];
        if (NEU.juice) NEU.juice.burst(dead.x, dead.y, 15, dead.kind === 'fist' ? COL.brimHi : COL.brim, 1.5);
        /* Survivor enrages */
        if (bros.length === 1) {
          bros[0].enraged = true;
          say(dead.kind === 'fist' ? "* the swordsman falls. the mage rages." : "* the mage falls. the swordsman rages.");
        }
      }
    }

    if (!bros.length) {
      invuln = false; phase = 2; mode = 'fight';
      stepT = 1.0; /* the laugh is the interlude; let it land */
      say("* she laughs. that is the first noise she has made.");
      later(function () { if (running) say("* now she is trying."); }, 2200);
    }
  }

  /* One damage source for bullets and contact alike. A standing
     barrier eats the hit instead of you — one hit, then it is gone,
     and it does not hand you invulnerability for free. */
  function hitPlayer() {
    if (shieldT > 0) {
      shieldT = 0;
      inv = IFRAMES;
      if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
      if (NEU.juice) { NEU.juice.hit('small'); NEU.juice.burst(px, py, 12, '#B8E6FF'); }
      return false;
    }
    hp--; inv = IFRAMES;
    if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
    /* Taking a hit is a MEDIUM event. The player needs to feel it
       without the screen becoming unreadable mid-pattern. */
    if (NEU.juice) { NEU.juice.hit('medium'); NEU.juice.burst(px, py, 10, COL.soul); }
    if (hp <= 0) { startDeath(); return true; }
    return false;
  }

  /* Deltarune's rule, from the wiki: "More TP is earned as the SOUL
     continues to graze bullets for longer." This used to be a flat
     `tp += dt * 0.4` written out TWICE — once in moveBullets and once in
     the worm's graze callback — which is two copies of a rule free to
     drift apart. One funnel; every hostile body calls it. */
  function feedGraze(dt, grazing) {
    if (!grazing) { grazeT = 0; return; }
    grazeT += dt;
    tp = Math.min(1, tp + dt * (0.25 + 0.35 * Math.min(1, grazeT / 1.5)));
  }

  function moveBullets(dt) {
    var keep = [];
    var grazedThisFrame = false;
    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i];
      b.age += dt;
      if (b.k === 1 || b.k === 2) {
        /* Distance-triggered burst. Source: SCalBrimstoneFireblast.cs and
           SCalBrimstoneGigablast.cs. Both burst when within 224px of the
           player (14 Terraria blocks) OR when timeLeft runs out. On burst:
           the projectile sets timeLeft=60, multiplies velocity *= 0.9 each
           frame (decelerating), fades out, then OnKill splits into a ring
           of BrimstoneBarrage darts. Fireblast → 8 darts (normal mode),
           gigablast → 20 darts (normal mode). The pause-then-explode is
           the mechanic that makes them dodgeable. Game scale: 224 Terraria
           px ≈ 150 game px. */
        if (!b.burst) {
          var dx = px - b.x, dy = py - b.y;
          var dist = Math.hypot(dx, dy) || 1;
          var reach = 150; /* 224px in Terraria ≈ 150 game px */
          /* Fireblast pauses when it closes to range; gigablast bursts on
             proximity. Both also time out after 4s. The pause is a full
             stop, not a decelerate — the mod's velocity *= 0.9/frame reads
             as the projectile slowing, which is worse than holding still
             because a drifting burst point shifts the ring under you. */
          if (b.k === 1) {
            if (b.pauseT === undefined && (dist < reach || b.age > 4))
              b.pauseT = 0.55 + Math.random() * 0.25;
            if (b.pauseT) {
              b.pauseT -= dt;
              b.vx = 0; b.vy = 0;
              if (b.pauseT <= 0) {
                b.burst = true;
                var nn = 8;
                sfxPlay('fireblast-hit');
                for (var qq = 0; qq < nn; qq++) {
                  var aq = qq * Math.PI * 2 / nn;
                  shot(b.x, b.y, Math.cos(aq) * 130, Math.sin(aq) * 130, HB.dart, COL.brim, 4);
                }
                if (NEU.juice) NEU.juice.burst(b.x, b.y, 10, COL.brim, 1.2);
                continue;
              }
            } else {
              /* Fireblast homing: inertia=100, homeSpeed=9 (mod normal mode).
                 velocity = (velocity * (inertia-1) + dir * homeSpeed) / inertia
                 Scaled to game px/s: homeSpeed 9 Terraria ≈ 140 game px/s. */
              var sp = 140;
              b.vx = (b.vx * 99 + dx / dist * sp) / 100;
              b.vy = (b.vy * 99 + dy / dist * sp) / 100;
            }
          } else if (b.k === 2) {
            /* Gigablast: homes like the fireblast but bursts into 20
               darts (wiki normal mode) on proximity or after 4s.
               The burst ring is larger than the fireblast's 8, so
               it covers more of the arena and demands real movement. */
            if (b.pauseT === undefined && (dist < reach || b.age > 4))
              b.pauseT = 0.55 + Math.random() * 0.25;
            if (b.pauseT) {
              b.pauseT -= dt;
              b.vx = 0; b.vy = 0;
              if (b.pauseT <= 0) {
                b.burst = true;
                var gn = 20;
                sfxPlay('giga-hit');
                for (var qq = 0; qq < gn; qq++) {
                  var aq = qq * Math.PI * 2 / gn;
                  shot(b.x, b.y, Math.cos(aq) * 140, Math.sin(aq) * 140, HB.dart, COL.brim, 4);
                }
                if (NEU.juice) NEU.juice.burst(b.x, b.y, 14, COL.brimHi, 1.4);
                continue;
              }
            } else {
              var sp = 140;
              b.vx = (b.vx * 99 + dx / dist * sp) / 100;
              b.vy = (b.vy * 99 + dy / dist * sp) / 100;
            }
          } else {
            /* Far gigablast: preserve speed, steer toward player.
               velocity = (velocity * 24 + playerDir * speed) / 25 */
            var sp = Math.hypot(b.vx, b.vy) || 130;
            var tx = dx / dist * sp, ty = dy / dist * sp;
            b.vx = (b.vx * 24 + tx) / 25;
            b.vy = (b.vy * 24 + ty) / 25;
          }
        } else {
          continue; /* already burst, don't keep */
        }
      }
      /* Acceleration per the C# source, converted from per-frame to per-second:
         BrimstoneHellblast2: velocity *= 1.002/frame → 1.002^60 ≈ 1.127x/s.
         BrimstoneBarrage: velocity *= 1.01/frame → 1.01^60 ≈ 1.82x/s. */
      if (b.k === 3) { b.vx *= 1 + dt * 0.12; }   // hellblasts — gentle accel
      if (b.k === 4) { var am = 1 + dt * 0.6; b.vx *= am; b.vy *= am; } // ring darts — BrimstoneBarrage 1.01x/frame
      /* k5 flame skull: constant horizontal travel, sinusoidal vy. Set
         the VELOCITY rather than y directly, so the graze/hit checks and
         the facing rotation below all see real motion. */
      if (b.k === 5) b.vy = Math.cos(b.age * 3.2 + b.phase_) * 90;
      /* Facing tracks REAL travel, not a per-frame recompute of
         atan2(vy,vx) — fireblast/gigablast spawn at vx:vy:0 and are
         re-zeroed for their burst pause (above), so atan2(0,0) locked
         the sprite to a single fixed angle at launch and again through
         every pause. Below the epsilon the bullet just keeps facing
         whichever way it was already drawn. */
      var spd2 = b.vx * b.vx + b.vy * b.vy;
      if (spd2 > 4) {
        b.rot = (b.k === 1 || b.k === 2 || b.k === 4)
          ? Math.atan2(b.vy, b.vx) + Math.PI / 2
          : Math.atan2(b.vy, b.vx);
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < AX - 60 || b.x > AX + AW + 60 || b.y < AY - 60 || b.y > AY + AH + 60) continue;
      keep.push(b);
      if (inv <= 0 && mode !== 'won') {
        var dx = b.x - px, dy = b.y - py, rr = b.r + PLAYER_R;
        /* Graze: a bullet within 26px of the soul feeds TP, whether
           it hits or not. Same rule as the hit check — a near miss is
           still contact with the pattern, and the pattern pays for
           that. */
        if (dx * dx + dy * dy < (b.r + 26) * (b.r + 26)) grazedThisFrame = true;
        if (dx * dx + dy * dy < rr * rr && hitPlayer()) return;
      }
    }
    feedGraze(dt, grazedThisFrame);
    bullets = keep;
  }

  /* ── hitting her ────────────────────────────────────────────────
     You DO have a weapon now (V5 phase 2): hold f to charge, release
     to fire a homing shot. A tap is a weak bolt; a full ~0.9s charge
     is an orb that bursts into eight darts on impact. The soul still
     shatters hearts on touch? No — everything goes through the gun
     now, which is what makes the brothers beatable and melee-vs-strike-
     ring geometry problem moot. */

  function startCharge() {
    if (charging || dying || mode === 'intro' || mode === 'won') return;
    charging = true; chargeF = 0;
  }

  /* Target selection mirrors the old tryHit branch order exactly:
     the ring while it stands, hearts while the sepulcher stands, then
     the brothers, then her. */
  function resolveTarget() {
    if (ringOn && NEU.scalSeekers && NEU.scalSeekers.alive()) {
      var ss = NEU.scalSeekers.seekers(), bs = null, bsd = Infinity;
      for (var s = 0; s < ss.length; s++) {
        var sd = Math.hypot(px - ss[s].x, py - ss[s].y);
        if (sd < bsd) { bsd = sd; bs = ss[s]; }
      }
      if (bs) return { x: bs.x, y: bs.y };
    }
    if (sep && hearts.length) {
      var bh = null, bd = Infinity;
      for (var i = 0; i < hearts.length; i++) {
        var d = Math.hypot(px - hearts[i].x, py - hearts[i].y);
        if (d < bd) { bd = d; bh = hearts[i]; }
      }
      if (bh) return { x: bh.x, y: bh.y };
    }
    if (mode === 'brothers' && bros.length) {
      var bb = null, bdd = Infinity;
      for (var j = 0; j < bros.length; j++) {
        var dd = Math.hypot(px - bros[j].x, py - bros[j].y);
        if (dd < bdd) { bdd = dd; bb = bros[j]; }
      }
      if (bb) return { x: bb.x, y: bb.y };
    }
    if (mode === 'fight' && !invuln) return { x: bx, y: by };
    return null;
  }

  /* keyup: release the charge as a homing shot. */
  function tryHit() {
    if (!charging) return;
    charging = false;
    var power = Math.min(1, chargeF / 0.9);
    chargeF = 0;
    if (shotCd > 0 || dying || mode === 'intro' || mode === 'won') return;
    shotCd = 0.3;
    var tg = resolveTarget();
    var ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    var iy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    var ang = tg ? Math.atan2(tg.y - py, tg.x - px)
                 : ((ix || iy) ? Math.atan2(iy, ix) : -Math.PI / 2);
    var heavy = power >= 0.35;
    var sp = heavy ? 300 : 260;
    myShots.push({ x: px, y: py, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
                   r: heavy ? 12 : 5, k: heavy ? 'orb' : 'bolt', age: 0 });
    if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick();
  }

  /* An orb that lands bursts into eight darts — each one homes too,
     so the burst total is deterministic against a stationary target. */
  function burstShots(x, y) {
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4;
      myShots.push({ x: x, y: y, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220,
                     r: 4, k: 'burst', age: 0 });
    }
  }

  function moveMyShots(dt) {
    for (var i = myShots.length - 1; i >= 0; i--) {
      var s = myShots[i];
      s.age += dt;
      var dead = s.age > (s.k === 'burst' ? 1.2 : 4);
      /* dt-correct version of moveBullets' speed-preserving steering
         kernel: rotate velocity toward the target without changing its
         magnitude, so homing curves instead of snapping. */
      if (!dead) {
        var tg = resolveTarget();
        if (tg) {
          var dx = tg.x - s.x, dy = tg.y - s.y;
          var dist = Math.hypot(dx, dy);
          if (dist > 0.001) {
            var sp = Math.hypot(s.vx, s.vy) || 260;
            var k = Math.min(1, dt * 6);
            s.vx += (dx / dist * sp - s.vx) * k;
            s.vy += (dy / dist * sp - s.vy) * k;
          }
        }
        s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.x < AX - 40 || s.x > AX + AW + 40 ||
            s.y < AY - 80 || s.y > AY + AH + 60) dead = true;
      }
      /* Collisions mirror the old tryHit gating: whatever the melee
         could touch, the shot can reach. The ring branch comes first:
         while she is invulnerable behind the seekers, every shot that
         touches one kills it (orbs burst into their eight darts right
         there — how the phase is played through). */
      if (!dead) {
        if (ringOn && NEU.scalSeekers) {
          if (NEU.scalSeekers.hit(s.x, s.y, s.r)) {
            if (s.k === 'orb') burstShots(s.x, s.y);
            dead = true;
          }
        } else if (sep) {
          for (var q = 0; q < hearts.length; q++) {
            if (Math.hypot(hearts[q].x - s.x, hearts[q].y - s.y) < 18 + s.r) {
              damageTarget('heart', hearts[q], 1);
              if (s.k === 'orb') burstShots(s.x, s.y);
              dead = true; break;
            }
          }
        } else if (mode === 'brothers') {
          for (var w = 0; w < bros.length; w++) {
            if (Math.hypot(bros[w].x - s.x, bros[w].y - s.y) < HB.broReach + s.r) {
              damageTarget('bro', bros[w], 1);
              if (s.k === 'orb') burstShots(s.x, s.y);
              dead = true; break;
            }
          }
        } else if (mode === 'fight' && !invuln &&
                   Math.hypot(bx - s.x, by - s.y) < 40 + s.r) {
          damageTarget('her', null, 1);
          if (s.k === 'orb') burstShots(s.x, s.y);
          dead = true;
        }
      }
      if (dead) myShots.splice(i, 1);
    }
  }

  /* One damage funnel for all three target kinds; the phase ladder
     moved here with it. The old ladder tested 50% twice — wall(2) and
     the brothers both hung off `pct <= 0.50`, so the second wall fired
     and the brothers never arrived. Now: wall at 75%, wall at 50%,
     brothers at 35%. */
  function damageTarget(kind, ref, amount) {
    var eff = amount * (rageMode ? 2 : 1);
    if (kind === 'heart') {
      var hi = hearts.indexOf(ref);
      if (hi < 0) return;
      ref.hp -= eff;
      if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
      if (NEU.juice) { NEU.juice.hit('small'); NEU.juice.burst(ref.x, ref.y, 4, COL.brimHi); }
      if (ref.hp > 0) return;              /* cracked, not broken */
      var hx = ref.x, hy = ref.y;
      hearts.splice(hi, 1);
      if (NEU.juice) NEU.juice.burst(hx, hy, 8, COL.brimHi);
      return;
    }
    if (kind === 'bro') {
      if (bros.indexOf(ref) < 0) return;
      /* 25% DR while both brothers alive */
      var dmg = (bros.length === 2 ? 0.75 : 1) * eff;
      ref.dmgAccum = (ref.dmgAccum || 0) + dmg;
      if (ref.dmgAccum >= 1) {
        var hits = Math.floor(ref.dmgAccum);
        ref.hp -= hits;
        ref.dmgAccum -= hits;
      }
      if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
      if (NEU.juice) { NEU.juice.hit('small'); NEU.juice.burst(ref.x, ref.y, 8, COL.brimHi); }
      /* Death handled in brothersTick */
      return;
    }
    if (invuln || mode !== 'fight') return;
    bossHP -= eff;
    if (NEU.sfx && NEU.sfx.whoosh) NEU.sfx.whoosh();
    /* Landing one is SMALL — it happens often, and shaking hard on
       every strike would drown out the phase transitions. */
    if (NEU.juice) { NEU.juice.hit('small'); NEU.juice.burst(bx, by, 7, COL.brimHi); }
    var pct = bossHP / bossMax;
    if (pct <= 0)              { win(); }
    else if (pct <= 0.75 && !flagged(1)) { mark(1); startWall(1); }
    else if (pct <= 0.50 && !flagged(2)) { mark(2); startWall(2); }
    else if (pct <= 0.35 && !flagged(3)) { mark(3); startBrothers(); }
    else if (pct <= 0.28 && !flagged(4)) { mark(4); startWall(3); }
    /* 20%: the Supreme Soul Seeker ring (official wiki; scal-seekers.js
       holds the source cites for spawn and AI). She is invulnerable
       behind it until the last seeker dies. */
    else if (pct <= 0.20 && !flagged(5)) { mark(5); startSeekers(); }
    else if (pct <= 0.12 && !flagged(6)) { mark(6); startWall(4); }
    /* The wiki is explicit: below 10% she summons Sepulcher and ten
       Brimstone Hearts again and is invulnerable until they die.
       spawnSepulcher() already resets hearts/sep/invuln and re-spawns
       the worm module (scal-worm.js spawn() re-seeds its whole state),
       and fightTick's existing exit tears it down unchanged. */
    else if (pct <= 0.08 && !flagged(7)) { mark(7); spawnSepulcher(); }
  }
  var marks = {};
  function flagged(n) { return !!marks[n]; }
  function mark(n) { marks[n] = true; }

  function win() {
    mode = 'won'; running = false; bullets = [];
    /* the ring cannot outlive her: drop it so nothing ticks or draws
       into the victory lap */
    if (NEU.scalSeekers) NEU.scalSeekers.clear();
    ringOn = false;
    clearSched();
    if (NEU.juice) { NEU.juice.hit('huge', { colour: '#FF6B4A' });
                     NEU.juice.burst(bx, by, 60, COL.brim, 260); }
    if (NEU.save) { NEU.save.give('ashes'); NEU.save.flag('scal_dead', 1); }
    if (NEU.quest) NEU.quest.mark('a4_scal');
    if (msg) {
      msg.hidden = false;
      msg.innerHTML = '<b>she sits back down.</b><br>' +
        '"the small one was me. obviously."<br>' +
        'she leaves you a handful of ash.<br>' +
        '<small>esc to leave</small>';
    }
    draw(performance.now());
  }

  function startDeath() {
    running = false; dying = performance.now();
    clearSched();
    if (dm.resetDeath) dm.resetDeath();
    if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
    requestAnimationFrame(deathStep);
  }

  function deathStep(now) {
    var ms = now - dying;
    ctx.fillStyle = COL.void_; ctx.fillRect(0, 0, innerWidth, innerHeight);
    frame();
    var playing = dm.death ? dm.death(ctx, px, py, ms, COL.soul) : (ms <= 1700);
    if (!playing) {
      dying = 0;
      if (msg) { msg.hidden = false;
        msg.innerHTML = '<b>she waits.</b><br>enter to try again &middot; esc to leave'; }
      return;
    }
    requestAnimationFrame(deathStep);
  }

  /* ── draw ───────────────────────────────────────────────────────*/
  function frame() {
    ctx.fillStyle = '#12080C'; ctx.fillRect(AX, AY, AW, AH);
    ctx.fillStyle = COL.bone;
    ctx.fillRect(AX - 3, AY - 3, AW + 6, 3); ctx.fillRect(AX - 3, AY + AH, AW + 6, 3);
    ctx.fillRect(AX - 3, AY, 3, AH); ctx.fillRect(AX + AW, AY, 3, AH);
  }

  function draw(now) {
    var w = innerWidth, h = innerHeight;
    ctx.fillStyle = COL.void_; ctx.fillRect(0, 0, w, h);
    /* Everything between begin/end is shaken as one image. The draw
       code below has no idea it is happening, which is what keeps the
       shake off the simulation. */
    var shook = NEU.juice ? NEU.juice.begin(ctx, w, h) : false;
    frame();

    /* Frame mapping from the mod source (SupremeCalamitas.cs): the
       sheet is 21 rows x 2 columns and frame.Y = frameCounter(0-5) +
       FrameType*6, so each FrameType is a 6-frame band that wraps
       into column 1 when it crosses row 20. Bands:
         0 UpwardDraft (idle)         — col 0 rows 0-5
         1 FasterUpwardDraft (dash)   — col 0 rows 6-11
         2 Casting                    — col 0 rows 12-17
         3 BlastCast (gigablast)      — col 0 rows 18-20, col 1 rows 0-2
         4 BlastPunchCast (P2 giga)   — col 1 rows 3-8
         5 OutwardHandCast (hellblast)— col 1 rows 9-14
         6 PunchHandCast (P2 hell)    — col 1 rows 15-20
       The old mapping here was invented from the row count alone and
       showed the wrong poses for every state. */
    function getScalAnim() {
      if (scalAnimState !== scalAnimPrevState) {
        scalAnimTimer = 0;
        scalAnimPrevState = scalAnimState;
      }
      /* Was a fixed 1/60 regardless of real frame time, so animation
         speed silently drifted with the display's actual refresh rate
         instead of following the simulation's own dt. */
      scalAnimTimer += lastDt;
      var st = scalAnimState;
      if (st === 'gigablast' && phase === 2) st = 'gigablast_p2';
      if (st === 'hellblast' && phase === 2) st = 'hellblast_p2';
      var b = BANDS[st] || BANDS.idle;
      var c = b.rev
        ? 5 - Math.floor(scalAnimTimer * b.fps) % 6
        : Math.floor(scalAnimTimer * b.fps) % 6;
      var fy = b.t * 6 + c;             // frame.Y, 0-41
      return { frame: fy % 21, col: (fy / 21) | 0 };
    }
    var BANDS = {
      idle:            { t: 0, fps: 4 },
      idle_fast:       { t: 1, fps: 6 },
      /* SupremeCalamitas.cs: the whole charging state — telegraph
         through dash — is one continuous FrameType.FasterUpwardDraft
         (confirmed in-file), band 1, the same band the dash itself
         uses. The telegraph used to sit on band 0 (idle), so the
         wind-up before every dash showed her standing still — the
         tracker's "melee attack sprites aren't used" for the half of
         the charge a player actually has time to read. Same band as
         `charging`, slower fps so the wind-up still reads as distinct
         from the dash it leads into. */
      charge_telegraph:{ t: 1, fps: 8 },
      charging:        { t: 1, fps: 16 },
      charge_recovery: { t: 1, fps: 8, rev: true },
      casting:         { t: 2, fps: 10 },
      gigablast:       { t: 3, fps: 10 },
      gigablast_p2:    { t: 4, fps: 10 },
      hellblast:       { t: 5, fps: 10 },
      hellblast_p2:    { t: 6, fps: 10 }
    };

    /* her */
    if (mode !== 'won') {
      var bodyKey = mode === 'intro' ? 'scalHood' : 'scal';
      var anim = (mode === 'intro') ? { frame: 0, col: 0 } : getScalAnim();
      if (!sprite(bodyKey, bx, by, 2, 0, phase === 2, anim.col, anim.frame)) {
        ctx.fillStyle = '#FF00A0';
        ctx.fillRect((bx - 20) | 0, (by - 26) | 0, 40, 52);
      }
    } else {
      /* the drop. she is done; the sheet stays. */
      if (!sprite('ashes', bx, by + 34, 1, 0)) {
        ctx.fillStyle = COL.brim;
        ctx.fillRect((bx - 10) | 0, (by + 20) | 0, 20, 20);
      }
    }

    /* her telegraph — the wind-up ring before a charge */
    if (chargeTelegraph > 0 && mode === 'fight') {
      ctx.strokeStyle = 'rgba(255,74,42,0.65)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(bx, by, 34 + (0.5 - chargeTelegraph) * 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    /* her shield. The mod summons the forcefield bubble and the two
       arcs around the charge telegraph; here it also marks the whole
       "she cannot be touched" state — walls, brothers, the worm. */
    if ((invuln || willCharge || chargeTelegraph > 0 || chargeT > 0) && mode !== 'intro') {
      var shk = Math.sin(now / 160) * 3;
      sprite('scalShield', bx, by, 1.35, 0, false, 0, 0, 0.55);
      sprite('scalShieldTop', bx, by - 6 + shk, 1.15, 0);
      sprite('scalShieldBot', bx, by + 30 - shk, 1.15, 0);
    }

    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i], sz = (b.r * 2) | 0;
      /* k picks the sheet; everything else is a brimstone dart. */
      var key = b.k === 1 ? 'fireblast' : b.k === 2 ? 'gigablast'
              : (b.k === 3 || b.k === 5) ? 'hellblast' : 'dart';
      var sc = b.k === 1 ? 0.65 : b.k === 2 ? 0.75
            : (b.k === 3 || b.k === 5) ? 0.5 : 0.55;
      /* b.rot tracks real travel (set in moveBullets, seeded at spawn
         for k1/k2) — NOT a live atan2(vy,vx) here, which used to lock
         to a single angle for every homing blast's entire wind-up and
         burst pause, since both spawn and pause at vx:vy:0. */
      var brot = b.rot || 0;
      if (!sprite(key, b.x, b.y, sc, brot)) {
        ctx.fillStyle = b.c;
        ctx.fillRect((b.x - b.r) | 0, (b.y - b.r) | 0, sz, sz);
        if (b.k === 2) { ctx.fillStyle = COL.brimHi; ctx.fillRect((b.x - 3) | 0, (b.y - 3) | 0, 6, 6); }
      }
    }
    /* The player's homing shots (V5 phase 2). */
    for (var ms = 0; ms < myShots.length; ms++) {
      var s = myShots[ms];
      var sang = Math.atan2(s.vy, s.vx);
      if (s.k === 'orb') {
        var osc = 1 + 0.15 * Math.sin(now / 90);
        if (!sprite('gigablast', s.x, s.y, osc, sang, true)) {
          ctx.fillStyle = '#B48CFF';
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        var ssc = s.k === 'burst' ? 0.35 : 0.5;
        if (!sprite('dart', s.x, s.y, ssc, sang)) {
          ctx.fillStyle = '#E4C46A';
          ctx.fillRect((s.x - s.r) | 0, (s.y - s.r) | 0, s.r * 2, s.r * 2);
        }
      }
    }
    if (sep && NEU.scalWorm) {
      /* The worm draws itself — segments, arms, tail, head, the dash
         telegraph line and ITS OWN DARTS (scal-worm.js draw() renders
         every dart it spawns). Same layer slot as the old inline
         renderer: in front of the bullets, behind the hearts below. */
      NEU.scalWorm.draw(now);
    }
    /* the ring draws itself — darts, then seekers with their glow
       stacked, same layer slot as the worm: in front of bullets,
       behind the hearts below */
    if (ringOn && NEU.scalSeekers) NEU.scalSeekers.draw(now);
    /* hearts ride ON the body — drawn after it, so the six of them
       read against the worm instead of disappearing under it. */
    for (var q = 0; q < hearts.length; q++) {
      var hx = hearts[q].x, hy = hearts[q].y;
      if (!sprite('heart', hx, hy, 0.45, 0)) {
        ctx.fillStyle = '#C2405F';
        ctx.fillRect((hx - 7) | 0, (hy - 7) | 0, 14, 14);
      }
    }
    /* Their BODIES, not their thrown attacks. This used to draw
       'fist'/'slashTop' — SupremeCataclysmFist.png and
       SupremeCatastropheSlashAlt.png, the projectiles each brother
       THROWS — because SupremeCataclysm.png / SupremeCatastrophe.png
       (their real NPC art, both confirmed 636x1872/9 rows and
       800x1840/8 rows in the mod's own .cs) were never copied into the
       manifest at all. Their real thrown-attack sprites stay in the
       manifest under cataclysmFist/catastropheSlash for the projectile
       switch below, correctly used there. Glow masks stack the same way
       Polterghast's already do (glowKeys, additive). */
    for (var r = 0; r < bros.length; r++) {
      var br = bros[r], rot = Math.atan2(py - br.y, px - br.x);
      var bKey = br.kind === 'fist' ? 'cataclysm' : 'catastrophe';
      var bGlow = br.kind === 'fist' ? ['cataclysmGlow'] : ['catastropheGlow'];
      var bSh = NEU.sheets[bKey];
      var bSc = bSh ? 80 / bSh.fw : 0.4;
      if (!sprite(bKey, br.x, br.y, bSc, rot, false, undefined, undefined, undefined, bGlow)) {
        ctx.fillStyle = br.kind === 'fist' ? COL.brimHi : COL.brim;
        ctx.fillRect((br.x - 14) | 0, (br.y - 14) | 0, 28, 28);
      }
    }

    if (mode !== 'won' && dm.soul && dm.soul.draw)
      dm.soul.draw(ctx, px, py, inv, COL.soul);

    /* rage: the soul burns gold while it is up */
    if (rageMode > 0) {
      ctx.fillStyle = 'rgba(228,196,106,0.35)';
      ctx.beginPath();
      ctx.arc(px, py, 14 + Math.sin(now / 80) * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    /* U2: the barrier ring, drawn over the soul so the shield reads
       as worn by her rather than painted on the arena. */
    if (shieldT > 0) {
      ctx.strokeStyle = 'rgba(184,230,255,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py, 16 + Math.sin(now / 90) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    /* her bar. It DOES move — that is the difference between this
       fight and the one on the television, and the contrast only
       lands because that one refused to. */
    /* Her bar clears her sprite rather than cutting across it. She
       hovers centred on AY-24 and is 120 tall at scale 2, so she owns
       AY-84 upward; the bar used to sit at AY-44, straight through her
       chest. Moving HER instead would change the fight: the player is
       clamped to AY+7 and a strike needs to be within 34, so her
       resting height is load-bearing. Floored at 40 so a short viewport
       keeps the bar on screen. */
    var bw = 260, bx2 = ((w - bw) / 2) | 0, by2 = Math.max(40, AY - 128);
    ctx.fillStyle = '#22222E'; ctx.fillRect(bx2, by2, bw, 8);
    ctx.fillStyle = invuln ? '#4A4560' : COL.dark;
    ctx.fillRect(bx2, by2, (bw * Math.max(0, bossHP / bossMax)) | 0, 8);
    ctx.fillStyle = COL.bone;
    ctx.font = '16px "Determination Mono","Pixelify Sans",monospace';
    ctx.textBaseline = 'top'; ctx.textAlign = 'center';
    ctx.fillText(invuln ? 'calamitas — shielded' : 'calamitas', w / 2, by2 - 20);
    ctx.textAlign = 'left';

    ctx.fillStyle = COL.bone;
    ctx.fillText('HP ' + Math.max(0, hp) + '/' + MAXHP, AX, AY + AH + 12);
    ctx.fillStyle = COL.dim;
    ctx.fillText('shift to focus  ·  f near her to strike', AX + 120, AY + AH + 12);

    if (NEU.juice) NEU.juice.drawParts(ctx, 1 / 60);
    if (NEU.juice) NEU.juice.end(ctx, shook);
    if (NEU.juice) NEU.juice.overlay(ctx, w, h);

    /* U1/U2 meters — OUTSIDE the box (gutter or row-below per
       layout()), drawn after juice.end so screen shake never moves
       them. Rage on top, TP below it. */
    var mR = meterRects[0], mT = meterRects[1];
    if (mR && mT) {
      drawMeter('rage', rageShown, mR.x, mR.y, mR.w, mR.h, rageMode > 0);
      drawMeter('tp',   tpShown,   mT.x, mT.y, mT.w, mT.h, shieldT > 0);
    }

    var dialY = AY + AH + 40;
    if (AX < 118) dialY = AY + AH + 76;   /* clear the row-below meters */
    if (line && now - lineT < 5200) {
      ctx.fillStyle = COL.bone;
      ctx.font = '16px "Undertale Sans","Comic Sans MS",cursive';
      ctx.fillText(line, AX, dialY);
    }

    /* F3 hitbox debug */
    if (showHitboxes) {
      ctx.strokeStyle = '#00FF00'; ctx.lineWidth = 1;
      /* player */
      ctx.beginPath(); ctx.arc(px, py, PLAYER_R, 0, Math.PI * 2); ctx.stroke();
      /* SC */
      if (mode === 'fight' && !invuln) {
        ctx.strokeStyle = '#FF4444';
        ctx.beginPath(); ctx.arc(bx, by, 34, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#00FF00';
        ctx.beginPath(); ctx.arc(bx, by, 40, 0, Math.PI * 2); ctx.stroke();
      }
      /* bullets */
      for (var i = 0; i < bullets.length; i++) {
        var b = bullets[i];
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
      }
      /* hearts */
      for (var q = 0; q < hearts.length; q++) {
        var h = hearts[q];
        ctx.beginPath(); ctx.arc(h.x, h.y, 18, 0, Math.PI * 2); ctx.stroke();
      }
      /* sepulcher */
      if (sep && NEU.scalWorm) {
        var wh = NEU.scalWorm.head();
        ctx.beginPath(); ctx.arc(wh.x, wh.y, 30, 0, Math.PI * 2); ctx.stroke();
      }
      /* brothers */
      for (var r = 0; r < bros.length; r++) {
        var br = bros[r];
        ctx.beginPath(); ctx.arc(br.x, br.y, HB.broReach, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  /* ── the real art ────────────────────────────────────────────────
     Every sheet is keyed in data/sheets.js. Her body gets a magenta
     fallback (a silently absent sprite gets mistaken for a logic bug
     and costs an hour); her projectiles keep their coloured squares
     so a missing file degrades to the old look rather than to a
     blob. Projectiles rotate to face travel — the sheets are drawn
     upright and Terraria spins them in code. */
  /* One blitter for the whole site, in data/sheets.js — see the note
     there. The local copy this replaces pinned source x at 0, which is
     why her two-column sheet drew as two overlapping women. */
  function sprite(key, x, y, scale, rot, glow, col, frame, alpha, glowKeys) {
    if (!NEU.sheetDraw) return false;
    return NEU.sheetDraw(ctx, key, x, y, {
      scale: scale, rot: rot, glow: glow, col: col, frame: frame,
      alpha: alpha, glowKeys: glowKeys,
      now: performance.now()
    });
  }

  /* The rage / tp meters, in the mod's own style: an empty track under
     everything so the level reads before the art loads, the fill sheet
     cropped IN WIDTH by the filled ratio (that is how
     UI/Rippers/RipperUI.cs draws it), a border whose tp strip is
     itself a fill animation — its cell tracks the VALUE, not the
     clock — and the full-bar flourish playing exactly once per fill.
     Labels sit to the right of the border. */
  function drawMeter(key, ratio, x, y, w, h, active) {
    var fill = key === 'rage' ? 'rageBar' : 'tpBar';
    var border = key === 'rage' ? 'rageBorder' : 'tpBorder';
    var anim = key === 'rage' ? 'rageAnim' : 'tpAnim';
    var animT = key === 'rage' ? rageAnimT : tpAnimT;
    var animS = key === 'rage' ? RAGE_ANIM_S : TP_ANIM_S;
    /* RipperUI.GetShakeOffset() — the meter shakes while its mode is
       active. This is the METER's own shake: these are drawn after
       juice.end precisely so screen shake never moves them, and this
       must not leak back into that. */
    var meterShake = active ? 1 : 0;
    if (meterShake) {
      x += (Math.random() * 2 - 1) * meterShake;
      y += (Math.random() * 2 - 1) * meterShake;
    }
    ratio = Math.min(1, Math.max(0, ratio));
    /* empty track first */
    ctx.fillStyle = '#22222E'; ctx.fillRect(x, y, w, h);
    var sh = NEU.sheets && NEU.sheets[fill];
    var im = NEU.sheetReady ? NEU.sheetReady(sh) : null;
    if (im && sh) {
      var fw = w * ratio;
      if (fw > 0) ctx.drawImage(im, 0, 0, fw, sh.fh, x, y, fw, h);
    } else {
      ctx.fillStyle = key === 'rage' ? '#E4C46A' : '#7BE38A';
      if (ratio > 0) ctx.fillRect(x, y, w * ratio, h);
    }
    var bsh = NEU.sheets && NEU.sheets[border];
    var frames = bsh ? (bsh.frames || 1) : 1;
    var bFrame = key === 'tp' ? Math.round(ratio * (frames - 1)) : 0;
    if (!sprite(border, x + w / 2, y + h / 2, 1, 0, false, null, bFrame)) {
      ctx.fillStyle = '#4A4560'; ctx.strokeStyle = '#22222E';
      ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
    }
    /* one-shot flourish: only while its timer is still running */
    if (animT < animS) {
      var ash = NEU.sheets && NEU.sheets[anim];
      var frames = (ash && ash.frames) || 10;
      var af = Math.min(frames - 1, (animT / animS * frames) | 0);
      if (!sprite(anim, x + w / 2, y + h / 2, 1, 0, false, null, af)) {
        ctx.fillStyle = 'rgba(228,196,106,0.25)';
        ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
      }
    }
    ctx.fillStyle = COL.dim;
    ctx.font = '16px "Determination Mono","Pixelify Sans",monospace';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(key, x + w + 12, y + h / 2);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  }

  /* ── input ──────────────────────────────────────────────────────*/
  function keyName(e) {
    var k = e.key;
    if (k === 'ArrowLeft'  || k === 'a' || k === 'A') return 'left';
    if (k === 'ArrowRight' || k === 'd' || k === 'D') return 'right';
    if (k === 'ArrowUp'    || k === 'w' || k === 'W') return 'up';
    if (k === 'ArrowDown'  || k === 's' || k === 'S') return 'down';
    if (k === 'Shift') return 'focus';
    return null;
  }
  addEventListener('keydown', function (e) {
    if (wrap.hidden || !NEU.scal.active || NEU.activeMinigame !== 'scal') return;
    if (e.key === 'F3') { showHitboxes = !showHitboxes; return; }
    if (e.key === 'Escape') {
      /* ESC works through the whole fight now. Leaving mid-fight costs
         the run, so that is the confirmed exit; the win and death
         screens are over and close clean. */
      if (mode === 'won' || dying) { close(); return; }
      if (NEU.engine && NEU.engine.confirmExit) {
        NEU.engine.confirmExit('Supreme Calamitas', close);
      } else { close(); }
      return;
    }
    if (!running && !dying && e.key === 'Enter') {
      /* The document-level retry of the bullet minigame used to hear
         this too and restarted its own timer over the death screen. */
      e.preventDefault(); e.stopPropagation();
      open(); return;
    }
    if (e.key === 'z' || e.key === 'Z') {
      /* U1: rage. A full bar buys eight seconds of doubled strikes —
         and only that. z never strikes; f is the strike key. */
      e.preventDefault();
      if (rageMode > 0) { say('* the rage is still burning.'); return; }
      if (rage < 1) { say('* the rage wants a full bar. miss hearts to fill it.'); return; }
      rage = 0; rageMode = 1; rageModeT = 8;
      sfxPlay('giga-hit');
      if (NEU.juice) NEU.juice.burst(px, py, 14, '#E4C46A', 1.2);
      say('* rage. everything strikes twice.');
      return;
    }
    /* f is still the strike key — but striking is now charge-and-
       release: keydown starts the charge (guarded against OS repeat
       autofire), keyup releases it as tryHit(). */
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); if (!e.repeat) startCharge(); return; }
    if (e.key === 'x' || e.key === 'X') {
      /* U2: the barrier. Full tp spends itself as one held hit. */
      e.preventDefault();
      if (shieldT > 0) { say('* the barrier is already up.'); return; }
      if (tp < 1) { say('* the barrier wants full tp. graze to fill it.'); return; }
      tp = 0; shieldT = 2.5;
      if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick();
      say('* the barrier blooms. it will take one hit.');
      return;
    }
    var n = keyName(e); if (n) { keys[n] = true; e.preventDefault(); }
  });
  addEventListener('keyup', function (e) {
    /* Same three-condition guard as keydown — the old one checked only
       wrap.hidden, so a release could fire while another minigame held
       the input lock. */
    if (wrap.hidden || !NEU.scal.active || NEU.activeMinigame !== 'scal') return;
    var n = keyName(e); if (n) keys[n] = false;
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); tryHit(); return; }
  });

  /* ── open / close ───────────────────────────────────────────────*/
  var active = false;
  var keysOrig = null;
  function open() {
    active = true;
    NEU.activeMinigame = 'scal';
    wrap.hidden = false;
    document.body.classList.add('is-playing');
    if (NEU.quest) NEU.quest.lock(true);
    if (msg) msg.hidden = true;
    /* This wrapper's hint belongs to the bullet minigame ("survive 20s")
       and she shares the wrapper with it — say what this fight does. */
    var keysEl = document.querySelector('#bh .bh__keys');
    if (keysEl) {
      if (keysOrig === null) keysOrig = keysEl.innerHTML;
      keysEl.innerHTML = 'arrows / wasd &nbsp;&middot;&nbsp; shift to focus &nbsp;&middot;&nbsp; f to strike &nbsp;&middot;&nbsp; hold f to charge &nbsp;&middot;&nbsp; z for rage &nbsp;&middot;&nbsp; x to shield &nbsp;&middot;&nbsp; esc to leave';
    }
    layout();
    t = 0; hp = MAXHP; inv = 0; bullets = []; keys = {}; marks = {};
    rage = 0; tp = 0; shieldT = 0;
    rageMode = 0; rageModeT = 0;
    rageAnimT = 9; tpAnimT = 9; rageFullPrev = 0; tpFullPrev = 0;
    rageShown = 0; tpShown = 0; grazeT = 0;
    myShots = []; charging = false; chargeF = 0; shotCd = 0;
    /* charge state too — dying mid multi-charge used to carry a live
       telegraph/dash into the retry and softlock her at the early-return */
    chargeT = 0; chargeTelegraph = 0; chargeBurst = 0; chargeBurstMax = 0; chargeGap = 0;
    willCharge = false;
    teleJuiced = false;
    orbA = Math.PI * 1.5;
    /* x10 (2026-08-24). A charged orb deals 9 — one on impact plus eight
       burst darts that spawn AT the impact point and all land the next
       frame — so 24 HP was three orbs, about three seconds, and at most
       3 of her 24 cycle steps ever played. 240 is ~27 orbs: a 70-90s
       fight and roughly one full lap of the cycle. Every phase gate in
       damageTarget is a FRACTION of bossMax, so they rescale for free,
       and core/music.js takes hpMax from the first reading per fight. */
    bossMax = 240; bossHP = bossMax; phase = 1; step_ = 0; stepT = 1.2;
    hearts = []; sep = null; bros = []; invuln = true; dying = 0;
    ringOn = false;
    /* Hand the Sepulcher module its canvas + arena once per fight;
       close() clears the flag so a reopened fight re-inits fresh. The
       target closure reads bx/by live — she is what the worm charges. */
    if (NEU.scalWorm && !scalWormReady) {
      NEU.scalWorm.init({ ctx: ctx, AX: AX, AY: AY, AW: AW, AH: AH,
                          target: function () { return { x: bx, y: by }; } });
      scalWormReady = true;
    }
    /* Same once-per-fight handoff for the ring module; close() clears
       the flag so a reopened fight re-inits fresh. The target closure
       reads bx/by live — startSeekers parks her at arena centre and
       the ring spins around THAT. */
    if (NEU.scalSeekers && !seekersReady) {
      NEU.scalSeekers.init({ ctx: ctx, AX: AX, AY: AY, AW: AW, AH: AH,
                             target: function () { return { x: bx, y: by }; } });
      seekersReady = true;
    }
    preloadSfx();
    mode = 'intro';
    px = AX + AW / 2; py = AY + AH - 60;
    bx = AX + AW / 2; by = AY - 24;
    say('* the small one was not small.');
    running = true; last = performance.now();
    requestAnimationFrame(stepFn);
  }
  function close() {
    active = false; running = false; dying = 0;
    clearSched();
    scalWormReady = false;
    seekersReady = false;
    /* Guarded, like every other minigame's close() — an unconditional
       clear here could null out a DIFFERENT minigame's lock if close()
       ever ran after something else had already claimed the input lock
       (e.g. a quit racing an open elsewhere). */
    if (NEU.activeMinigame === 'scal') NEU.activeMinigame = null;
    wrap.hidden = true;
    document.body.classList.remove('is-playing');
    if (NEU.quest) NEU.quest.lock(false);
    /* her fight borrowed the bullet minigame's hint; give it back */
    if (keysOrig !== null) {
      var keysEl = document.querySelector('#bh .bh__keys');
      if (keysEl) keysEl.innerHTML = keysOrig;
      keysOrig = null;
    }
    /* Back to the room you came from, win or lose. */
    if (NEU.engine) NEU.engine.enter(NEU.save && NEU.save.flagged('scal_dead') ? 'b7_altar' : 'b8_arena',
                                     NEU.save && NEU.save.flagged('scal_dead') ? 'north' : 'west');
  }

  /* The quit button is the bullet minigame's, shared with this fight —
     route it like the keyboard ESC instead of letting the other game's
     handler run against a fight it knows nothing about. */
  var bhQuitBtn = document.getElementById('bhQuit');
  if (bhQuitBtn) bhQuitBtn.addEventListener('click', function () {
    if (!active || NEU.activeMinigame !== 'scal') return;
    if (mode === 'won' || dying) { close(); return; }
    if (NEU.engine && NEU.engine.confirmExit) {
      NEU.engine.confirmExit('Supreme Calamitas', close);
    } else { close(); }
  });

  /* F8 opens the fight from anywhere — a dev command for testing the
     fight without re-walking the castle. */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'F8' && NEU.scal && !NEU.scal.active) {
      e.preventDefault();
      if (NEU.engine) NEU.engine.enter('b8_arena', 'west');
      open();
    }
  });

  NEU.scal = { open: open, close: close,
               get running() { return running; },
               get active() { return active; },
               get hp() { return bossHP; },
               get phase() { return phase; },
               get mode() { return mode; },
               get hearts() { return hearts.length; },
               get bros() { return bros.length; },
               /* live positions for the win-path test: it walks the
                  soul, and she and the worm move with the fight */
               get px() { return px; },
               get py() { return py; },
               get soulHP() { return hp; },
               get rage() { return rage; },
               /* test-only read (same class as wormSegs/wormAct): the
                  fixes8 drive refuses to fire during a doubling window
                  so its ladder taps stay exactly one point */
               get rageMode() { return rageMode; },
               get tp() { return tp; },
               get rageShown() { return rageShown; },
               get tpShown() { return tpShown; },
               get shieldT() { return shieldT; },
               get bx() { return bx; },
               get by() { return by; },
               get charging() { return chargeTelegraph > 0 || chargeT > 0; },
               get wormBusy() { return NEU.scalWorm ? NEU.scalWorm.busy() : false; },
               get wormPos() { return sep && NEU.scalWorm ? NEU.scalWorm.head() : null; },
               get wormVel() {
                 var wh = sep && NEU.scalWorm ? NEU.scalWorm.head() : null;
                 return wh ? { vx: wh.vx, vy: wh.vy } : null;
               },
                get wormSegs() { return NEU.scalWorm ? NEU.scalWorm.segs() : []; },
                get wormAct() { return NEU.scalWorm ? NEU.scalWorm.act() : ''; },
                get wormDarts() { return NEU.scalWorm ? NEU.scalWorm.darts() : []; },
               get heartPos() { return hearts.map(function (h) { return { x: h.x, y: h.y }; }); },
               get seekers() { return NEU.scalSeekers ? NEU.scalSeekers.alive() : 0; },
               get seekerPos() { return NEU.scalSeekers ? NEU.scalSeekers.seekers() : []; },
               get seekerDarts() { return NEU.scalSeekers ? NEU.scalSeekers.darts() : []; },
               get broPos() { return bros.map(function (b) { return { x: b.x, y: b.y }; }); },
                get bullets() { return bullets.map(function (b) { return { x: b.x, y: b.y, vx: b.vx, vy: b.vy }; }); },
                get meters() { return meterRects.map(function (m) { return { x: m.x, y: m.y, w: m.w, h: m.h }; }); },
                get myShots() { return myShots.map(function (s) { return { x: s.x, y: s.y, vx: s.vx, vy: s.vy, k: s.k }; }); },
                meterSlots: meterSlots,
                cycle: CYCLE };
})();