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

  /* Her cycle. c = charge, d = dart bursts, h = hellblast barrage,
     g2/g4 = two or four gigablasts. Twenty steps, exactly as in the
     game, including the fact that charges are unevenly spaced. */
  var CYCLE = ['d','h','g2','c','g2','h','d','c','d','h','g4','h','c','d','g4','c','d','c','d','c'];

  var running = false, last = 0, t = 0;
  var px = 0, py = 0, keys = {}, hp = MAXHP, inv = 0;
  /* U1/U2: your two resources. Rage builds while you are missing
     hearts and spends itself as one recovered heart. TP builds by
     grazing bullets and spends itself as a barrier that takes one
     hit. Both are the fight rewarding you for doing what the fight
     already asked you to do. */
  var rage = 0, tp = 0, shieldT = 0;
  var AX = 0, AY = 0, AW = 0, AH = 0;
  var bullets = [], step_ = 0, stepT = 0, phase = 1;
  var bossHP = 1, bossMax = 1, invuln = false;
  var mode = 'intro';        // intro | fight | wall | brothers | dead | won
  var wallT = 0, wallN = 0, walls = [];
  var hearts = [], sep = null, bros = [];
  var line = '', lineT = 0;
  var bx = 0, by = 0;        // her position
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
    /* Eight darts with even gaps, aimed down the screen from above
       her. The GAPS are the attack — a solid wall would be a wall.
       The mod fires 3-4 bursts per attack (~20 frames apart), with the
       gap moving between bursts, so a position that is safe standing
       still is never safe standing still twice. */
    scalAnimState = 'casting';
    var bursts = 3 + (Math.random() * 2 | 0);
    for (var b = 0; b < bursts; b++) {
      later(function (k) {
        return function () {
          if (!running) return;
          var n = 8, span = AW * 0.9, x0 = AX + AW / 2 - span / 2;
          /* one slot is deliberately left out, and it walks across the
             line each burst (deterministic, so the dodge is learnable) */
          var hole = Math.floor(span / n * 1.5 * k) % n;
          for (var i = 0; i < n; i++) {
            if (i === hole) continue;
            shot(x0 + (i + 0.5) * (span / n), by + 20, 0, 150 + phase * 30, 4, COL.brim);
          }
        };
      }(b), b * 340);
    }
  }

  function fireblast() {
    /* Homes to player continuously, bursts into 12 darts within 150px (real: 224 Terraria px).
       Source: inertia 100, homeSpeed 9 (13 revenge), rotation = vel + PI/2. */
    sfxPlay('fireblast');
    scalAnimState = 'casting';
    var b = { x: bx, y: by + 20, vx: 0, vy: 0, r: 8, c: COL.brimHi, k: 1, age: 0, burst: false };
    bullets.push(b);
  }

  function gigablast(n) {
    sfxPlay('giga');
    scalAnimState = 'gigablast';
    for (var i = 0; i < n; i++) {
      later(function () {
        if (!running) return;
        bullets.push({ x: bx, y: by + 20, vx: 0, vy: 0, r: 12, c: COL.dark,
                       k: 2, age: 0, burst: false });
      }, i * 520);
    }
  }

  function hellbarrage() {
    /* From beside you, horizontally, accelerating. */
    sfxPlay('hellblast');
    scalAnimState = 'hellblast';
    var left = px < AX + AW / 2;
    var x = left ? AX - 20 : AX + AW + 20;
    for (var i = 0; i < 7; i++) {
      later(function (k) {
        return function () {
          if (!running) return;
          shot(x, py + (k - 3) * 26, (left ? 1 : -1) * 90, 0, 5, COL.brim, 3);
        };
      }(i), i * 90);
    }
  }

  function charge() {
    var a = Math.atan2(py - by, px - bx);
    bxv = Math.cos(a) * 420; byv = Math.sin(a) * 420;
    chargeT = 0.55;
    chargeTelegraph = 0.5; // telegraph time before dash
    scalAnimState = 'charge_telegraph';
    scalAnimFrame = 0;
    scalAnimTimer = 0;
  }
  var bxv = 0, byv = 0, chargeT = 0, chargeTelegraph = 0, chargeBurst = 0, chargeBurstMax = 0, chargeGap = 0;
  var scalAnimState = 'idle', scalAnimFrame = 0, scalAnimTimer = 0, scalAnimPrevState = 'idle';

  /* ── the interludes ─────────────────────────────────────────────*/
  function startWall(n) {
    mode = 'wall'; wallT = 0; wallN = n; walls = []; bullets = [];
    clearSched();
    invuln = true;
    sfxPlay('maelstrom');
    say(n === 0 ? "* the room fills up."
      : n === 1 ? "* it fills up faster."
                : "* and again, with something heavier.");
  }

  function wallTick(dt) {
    wallT += dt;
    var beat = Math.floor(wallT / 1.35);
    if (beat > walls.length - 1 && beat < 3) {
      walls.push(beat);
      /* down / right / left, then left+right, then down+left+right —
         the order the game uses, so anyone who knows it is rewarded.
         Was dirs[wallN]: every beat fired the first wall's triple. */
      var dirs = [['d','r','l'], ['u','r'], ['d','l','r']][beat] || ['d'];
      dirs.forEach(function (d, i) { later(function () { wallLine(d); }, i * 240); });
    }
    if (wallT > 4.6) {
      bullets = []; invuln = false;
      if (wallN === 0) spawnSepulcher(); else { mode = 'fight'; say(''); }
    }
  }

  function wallLine(d) {
    if (!running) return;
    var gap = 60 + Math.random() * (AW - 160);
    for (var i = 0; i < 22; i++) {
      var p = i / 21;
      if (d === 'd' || d === 'u') {
        var x = AX + p * AW;
        if (Math.abs(x - (AX + gap)) < 54) continue;
        shot(x, d === 'd' ? AY - 20 : AY + AH + 20, 0, (d === 'd' ? 1 : -1) * 210, 5, COL.brim);
      } else {
        var y = AY + p * AH;
        if (Math.abs(y - (AY + gap * AH / AW)) < 48) continue;
        shot(d === 'r' ? AX - 20 : AX + AW + 20, y, (d === 'r' ? 1 : -1) * 210, 0, 5, COL.brim);
      }
    }
  }

  function spawnSepulcher() {
    mode = 'fight'; invuln = true;
    sep = { x: AX + AW / 2, y: AY + AH - 40, vx: 0, vy: 0, t: 0, attackCd: 0,
            trail: [], segs: [], chargeT: 0, telegraph: 0, cd: 0.6 };
    /* an initial straight body so the worm has segments before it moves */
    for (var k = 0; k < 60; k++) sep.trail.push({ x: sep.x, y: sep.y - k * 1.5 });
    hearts = [];
    for (var i = 0; i < 6; i++) {
      hearts.push({ hp: 1, offset: i });
    }
    say("* she is behind it. kill the hearts.");
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
    /* Hit-stop: hold the frame, keep rendering. Skipping the render
       too would read as a dropped frame rather than a held one. */
    if (NEU.juice && NEU.juice.frozen()) { draw(now); return; }
t += dt;

    /* Rage: missing hearts fill it, a full bar pays one heart back.
       The bar is the deal, so the heal is announced the same way the
       rest of her lines are. */
    if (hp < MAXHP && !dying) {
      rage += dt / 20;              /* ~20s of missing a heart */
      if (rage >= 1) {
        rage = 0;
        hp = Math.min(MAXHP, hp + 1);
        say('* the bloom tops up. one heart back.');
      }
    }
    if (shieldT > 0) shieldT -= dt;

    if (mode !== 'intro' && mode !== 'won') movePlayer(dt);
    if (inv > 0) inv -= dt;

    if (mode === 'intro') { if (t > 2.6) startWall(0); }
    else if (mode === 'wall') wallTick(dt);
    else if (mode === 'brothers') brothersTick(dt);
    else if (mode === 'fight') fightTick(dt);

    moveBullets(dt);
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

  /* Walk the trail placing a segment every 26px, so the body keeps
     constant spacing whether the worm is creeping or dashing. */
  function wormSegments() {
    if (!sep) return [];
    var segs = [];
    var prev = { x: sep.x, y: sep.y }, budget = 26;
    for (var i = 0; i < sep.trail.length && segs.length < 6; i++) {
      var p = sep.trail[i];
      budget -= Math.hypot(p.x - prev.x, p.y - prev.y);
      if (budget <= 0) { segs.push(p); prev = p; budget = 26; }
    }
    return segs;
  }

  function fightTick(dt) {
    /* Contact damage: she hurts on touch only while telegraphing or
       dashing; the sepulcher hurts only while it is charging at you.
       (Wiki: SC "only deals contact damage while charging".) */
    if (inv <= 0) {
      var touching = false;
      if ((chargeTelegraph > 0 || chargeT > 0) &&
          Math.hypot(px - bx, py - by) < 34) touching = true;
      if (sep && sep.chargeT > 0) {
        if (Math.hypot(px - sep.x, py - sep.y) < 30) touching = true;
        for (var s = 0; s < sep.segs.length && !touching; s++)
          if (Math.hypot(px - sep.segs[s].x, py - sep.segs[s].y) < 26) touching = true;
      }
      if (touching && hitPlayer()) return;
    }
    /* she hovers above you unless charging */
    if (chargeTelegraph > 0) {
      chargeTelegraph -= dt;
      scalAnimState = 'charge_telegraph';
      /* Telegraph: glow red, slight shake */
      if (NEU.juice && chargeTelegraph < 0.1) NEU.juice.hit('small');
    } else if (chargeT > 0) {
      chargeT -= dt; bx += bxv * dt; by += byv * dt;
      bx = Math.min(Math.max(bx, AX), AX + AW);
      by = Math.min(Math.max(by, AY - 30), AY + AH);
      scalAnimState = 'charging';
      /* Multi-charge burst: after dash ends, queue next if any left */
      if (chargeT <= 0 && chargeBurst < chargeBurstMax - 1) {
        chargeBurst++;
        chargeGap = 0.45; // gap between dashes
        var a = Math.atan2(py - by, px - bx);
        bxv = Math.cos(a) * 420; byv = Math.sin(a) * 420;
        chargeT = 0.55;
        chargeTelegraph = 0.3; // shorter telegraph for subsequent dashes
      }
    } else if (chargeGap > 0) {
      chargeGap -= dt;
      scalAnimState = 'charge_recovery';
    } else {
      bx += ((px) - bx) * Math.min(1, dt * 1.8);
      by += ((AY - 24) - by) * Math.min(1, dt * 2.2);
      /* Idle or casting based on attack */
      if (stepT < 0.3) {
        scalAnimState = 'casting';
      } else {
        scalAnimState = phase === 2 ? 'idle_fast' : 'idle';
      }
    }

    if (sep) {
      sep.t += dt;
      if (sep.attackCd > 0) sep.attackCd -= dt;

      /* Trail of past positions — the body follows it. Only record while
         actually moving, so the worm keeps its stretched-out body through
         its cooldown instead of collapsing into the head. */
      if (Math.hypot(sep.vx, sep.vy) > 1 || sep.chargeT > 0) {
        sep.trail.unshift({ x: sep.x, y: sep.y });
        if (sep.trail.length > 260) sep.trail.pop();
      }

      /* Charge cycle: telegraph, dash, cooldown (real AI: sepMaxSpeed=20,
         acceleration 0.175 — a lunge, not a drift. The old gentle chase
         made the worm barely faster than the player.) */
      if (sep.telegraph > 0) {
        sep.telegraph -= dt;
        if (sep.telegraph <= 0) {
          var a2 = Math.atan2(py - sep.y, px - sep.x);
          sep.vx = Math.cos(a2) * 340; sep.vy = Math.sin(a2) * 340;
          sep.chargeT = 0.55;
          if (NEU.juice) NEU.juice.hit('small');
        }
      } else if (sep.chargeT > 0) {
        sep.chargeT -= dt;
        sep.x += sep.vx * dt; sep.y += sep.vy * dt;
        sep.x = Math.min(Math.max(sep.x, AX + 40), AX + AW - 40);
        sep.y = Math.min(Math.max(sep.y, AY + 40), AY + AH - 40);
        if (sep.chargeT <= 0) { sep.cd = 0.55; sep.vx = 0; sep.vy = 0; }
      } else if (sep.cd > 0) {
        sep.cd -= dt;
      } else {
        sep.telegraph = 0.35;
      }

      /* Body segments along the trail (drawn by draw()) */
      sep.segs = wormSegments();

      /* Proximity ring burst (real: within 110 Terraria px ≈ 150 game px, 30 darts, cd 150 frames = 2.5s).
         Burst speed ~150 px/s. */
      var dist = Math.hypot(px - sep.x, py - sep.y) || 1;
      if (sep.attackCd <= 0 && dist < 150) {
        sep.attackCd = 2.5;
        sfxPlay('giga-hit');
        for (var q = 0; q < 30; q++) {
          var ang = q * Math.PI * 2 / 30;
          shot(sep.x, sep.y, Math.cos(ang) * 150, Math.sin(ang) * 150, 3, COL.brim, 4);
        }
        if (NEU.juice) NEU.juice.burst(sep.x, sep.y, 12, COL.brimHi, 1.2);
      }

      /* Hearts follow the worm body (energy balls embedded every 2nd segment),
         orbiting a body segment rather than the head. */
      for (var i = 0; i < hearts.length; i++) {
        var h = hearts[i];
        var hang = sep.t * 1.2 + h.offset * 1.1;
        var hrad = 24;
        var anchor = sep.segs[Math.min(2, sep.segs.length - 1)] || sep;
        h.x = anchor.x + Math.cos(hang) * hrad;
        h.y = anchor.y + Math.sin(hang) * hrad;
      }

      if (!hearts.length) {
        sep = null; invuln = false;
        say("* she steps out from behind it.");
        /* pause before she resumes the cycle — the interlude should land */
        stepT = 1.2;
      }
      return;
    }

    /* Charge burst handling: don't advance cycle until burst complete */
    if (chargeBurstMax > 0) {
      if (chargeBurst >= chargeBurstMax && chargeT <= 0 && chargeGap <= 0) {
        chargeBurstMax = 0; // burst complete, allow next attack
      } else {
        return; // wait for burst to finish
      }
    }

    stepT -= dt;
    if (stepT > 0) return;
    var k = CYCLE[step_ % CYCLE.length];
    step_++;
    var fast = phase === 2 ? 0.62 : 1;
    if (k === 'd') {
      /* Some bursts randomly become a blast. THE ONLY RANDOMNESS. */
      var r = Math.random();
      if (r < 0.18) fireblast();
      else if (r < 0.28) gigablast(1);
      else dartBurst();
      stepT = 0.72 * fast;
    } else if (k === 'h') { hellbarrage(); stepT = 1.5 * fast; }
    else if (k === 'g2')  { gigablast(2); stepT = 1.5 * fast; }
    else if (k === 'g4')  { gigablast(phase === 2 ? 3 : 4); stepT = 2.2 * fast; }
    else if (k === 'c') {
      /* Multi-charge burst: real SC does 2 or 4 consecutive dashes.
         Cycle positions (0-indexed): 3,7,12,15,17,19.
         Phase 1: 4,2,2,4,2,2. Phase 2: half (2,1,1,2,1,1). */
      var chargeIdx = 0;
      if (step_ - 1 === 3) chargeIdx = 0;       // 1st charge: 4 (p1) / 2 (p2)
      else if (step_ - 1 === 7) chargeIdx = 1;  // 2nd: 2 / 1
      else if (step_ - 1 === 12) chargeIdx = 2; // 3rd: 2 / 1
      else if (step_ - 1 === 15) chargeIdx = 3; // 4th: 4 / 2
      else if (step_ - 1 === 17) chargeIdx = 4; // 5th: 2 / 1
      else if (step_ - 1 === 19) chargeIdx = 5; // 6th: 2 / 1
      var p1Bursts = [4,2,2,4,2,2];
      var p2Bursts = [2,1,1,2,1,1];
      chargeBurstMax = phase === 2 ? p2Bursts[chargeIdx] : p1Bursts[chargeIdx];
      chargeBurst = 0;
      chargeGap = 0;
      charge();
      stepT = 0.55 + 0.5; // telegraph + first dash
    }
  }

  function brothersTick(dt) {
    /* Both alive: 25% DR (handled in tryHit). Fire in barrages with
       pauses — every 0.83s (50 frames) while active, then a hold while
       they swap sides. Every 7th volley = big attack. When one dies,
       the survivor enrages: faster volleys, shorter pauses. */
    for (var i = 0; i < bros.length; i++) {
      var b = bros[i];
      if (b.hp <= 0) continue; // dead, will be cleaned up below

      var interval = b.enraged ? 0.55 : 0.83; // enraged = faster
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
        if (b.volley >= (b.enraged ? 3 : 5)) {
          b.volley = 0;
          b.barrageCd = b.enraged ? 0.8 : 1.2;
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
            var spread = b.enraged ? 0.2 : 0.16;
            var count = b.enraged ? 5 : 3;
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

  function moveBullets(dt) {
    var keep = [];
    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i];
      b.age += dt;
      if (b.k === 1 || b.k === 2) {
        /* Distance-triggered burst (real: fireblast 224px, gigablast 224px).
           Game scale: burst at ~150px. Fireblast homes with inertia, then
           PAUSES and explodes — the game holds it a beat before the burst,
           which is what makes it dodgeable; gigablast preserves speed. */
        if (!b.burst) {
          var dx = px - b.x, dy = py - b.y;
          var dist = Math.hypot(dx, dy) || 1;
          var reach = b.k === 1 ? 170 : 150;
          if (b.k === 1 && b.pauseT === undefined && (dist < reach || b.age > 3.5)) {
            b.pauseT = 0.55 + Math.random() * 0.25;
          }
          if (b.pauseT) {
            b.pauseT -= dt;
            if (b.pauseT <= 0) {
              b.burst = true;
              var nn = 12;
              sfxPlay('fireblast-hit');
              for (var qq = 0; qq < nn; qq++) {
                var aq = qq * Math.PI * 2 / nn;
                shot(b.x, b.y, Math.cos(aq) * 130, Math.sin(aq) * 130, 3, COL.brim, 4);
              }
              if (NEU.juice) NEU.juice.burst(b.x, b.y, 10, COL.brim, 1.2);
              continue;
            }
            b.vx = 0; b.vy = 0;
          } else if (b.k === 1) {
            /* Fireblast: inertia 100, homeSpeed ~140 */
            var sp = 140;
            b.vx += (dx / dist * sp - b.vx) * dt * 2.4;
            b.vy += (dy / dist * sp - b.vy) * dt * 2.4;
          } else {
            /* Gigablast: preserve speed, steer toward player (vel*24 + dir)/25 */
            var sp = Math.hypot(b.vx, b.vy) || 130;
            var tx = dx / dist * sp, ty = dy / dist * sp;
            b.vx = (b.vx * 24 + tx) / 25;
            b.vy = (b.vy * 24 + ty) / 25;
          }
          /* Proximity burst */
          if (dist < 150 && b.k === 2) {
            b.burst = true;
            var n = 28;
            sfxPlay('giga-hit');
            for (var q = 0; q < n; q++) {
              var ang = q * Math.PI * 2 / n;
              shot(b.x, b.y, Math.cos(ang) * 130, Math.sin(ang) * 130, 3, COL.brim, 4);
            }
            if (NEU.juice) NEU.juice.burst(b.x, b.y, 10, COL.brimHi, 1.2);
            continue; // parent projectile dies after burst
          }
        } else {
          continue; // already burst, don't keep
        }
      }
      if (b.k === 3) { b.vx *= 1 + dt * 1.6; }   // hellblasts accelerate
      if (b.k === 4) { b.vx *= 1 + dt * 0.5; b.vy *= 1 + dt * 0.5; } // ring darts accelerate (BrimstoneBarrage ~1.01x)
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < AX - 60 || b.x > AX + AW + 60 || b.y < AY - 60 || b.y > AY + AH + 60) continue;
      keep.push(b);
      if (inv <= 0 && mode !== 'won') {
        var dx = b.x - px, dy = b.y - py, rr = b.r + PLAYER_R;
        /* Graze: a bullet within 26px of the soul feeds TP, whether
           it hits or not. Same rule as the hit check — a near miss is
           still contact with the pattern, and the pattern pays for
           that. */
        if (dx * dx + dy * dy < (b.r + 26) * (b.r + 26))
          tp = Math.min(1, tp + dt * 0.4);
        if (dx * dx + dy * dy < rr * rr && hitPlayer()) return;
      }
    }
    bullets = keep;
  }

  /* ── hitting her ────────────────────────────────────────────────
     You do not have a weapon. You have the soul, and touching her
     while she is vulnerable is the attack — which is why the charge
     is dangerous and also the opening. */
  function tryHit() {
    /* The interludes are not shielded — they are the strike target
       while she is invincible. The sepulcher's hearts shatter one at
       a time; a brother takes eight hits. Before the fix, nothing in
       the fight could damage either, so she stayed invincible forever
       and the fight could not be won. */
    if (sep) {
      for (var i = 0; i < hearts.length; i++) {
        if (Math.hypot(px - hearts[i].x, py - hearts[i].y) < 18) {
          var hx = hearts[i].x, hy = hearts[i].y;
          hearts.splice(i, 1);
          if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
          if (NEU.juice) { NEU.juice.hit('small'); NEU.juice.burst(hx, hy, 8, COL.brimHi); }
          return;
        }
      }
      return;
    }
    if (mode === 'brothers') {
      for (var j = 0; j < bros.length; j++) {
        if (Math.hypot(px - bros[j].x, py - bros[j].y) < 28) {
          var b = bros[j];
          /* 25% DR while both brothers alive */
          var dmg = (bros.length === 2) ? 0.75 : 1;
          b.dmgAccum = (b.dmgAccum || 0) + dmg;
          if (b.dmgAccum >= 1) {
            var hits = Math.floor(b.dmgAccum);
            b.hp -= hits;
            b.dmgAccum -= hits;
          }
          if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
          if (NEU.juice) { NEU.juice.hit('small'); NEU.juice.burst(b.x, b.y, 8, COL.brimHi); }
          /* Death handled in brothersTick */
          return;
        }
      }
      return;
    }
    if (invuln || mode !== 'fight') return;
    if (Math.hypot(px - bx, py - by) > 40) return;
    bossHP -= 1;
    if (NEU.sfx && NEU.sfx.whoosh) NEU.sfx.whoosh();
    /* Landing one is SMALL — it happens often, and shaking hard on
       every strike would drown out the phase transitions. */
    if (NEU.juice) { NEU.juice.hit('small'); NEU.juice.burst(bx, by, 7, COL.brimHi); }
    var pct = bossHP / bossMax;
    if (pct <= 0)              { win(); }
    else if (pct <= 0.25 && !flagged(3)) { mark(3); startBrothers(); }
    else if (pct <= 0.50 && !flagged(2)) { mark(2); startWall(2); }
    else if (pct <= 0.75 && !flagged(1)) { mark(1); startWall(1); }
  }
  var marks = {};
  function flagged(n) { return !!marks[n]; }
  function mark(n) { marks[n] = true; }

  function win() {
    mode = 'won'; running = false; bullets = [];
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
      scalAnimTimer += 1/60;
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
      charge_telegraph:{ t: 0, fps: 6 },
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

    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i], sz = (b.r * 2) | 0;
      /* k picks the sheet; everything else is a brimstone dart. */
      var key = b.k === 1 ? 'fireblast' : b.k === 2 ? 'gigablast'
              : b.k === 3 ? 'hellblast' : 'dart';
      var sc = b.k === 1 ? 0.65 : b.k === 2 ? 0.75
            : b.k === 3 ? 0.5 : 0.55;
      /* Source: fireblast/gigablast/dart are vertical sprites → rotation = atan2(vy,vx) + PI/2.
         hellblast is horizontal → rotation = atan2(vy,vx). */
      var brot = (b.k === 1 || b.k === 2 || b.k === 4)
        ? Math.atan2(b.vy, b.vx) + Math.PI / 2
        : Math.atan2(b.vy, b.vx);
      if (!sprite(key, b.x, b.y, sc, brot)) {
        ctx.fillStyle = b.c;
        ctx.fillRect((b.x - b.r) | 0, (b.y - b.r) | 0, sz, sz);
        if (b.k === 2) { ctx.fillStyle = COL.brimHi; ctx.fillRect((b.x - 3) | 0, (b.y - 3) | 0, 6, 6); }
      }
    }
    for (var q = 0; q < hearts.length; q++) {
      var hx = hearts[q].x, hy = hearts[q].y;
      if (!sprite('heart', hx, hy, 0.45, 0)) {
        ctx.fillStyle = '#C2405F';
        ctx.fillRect((hx - 7) | 0, (hy - 7) | 0, 14, 14);
      }
    }
    if (sep) {
      var srot = Math.atan2(sep.vy, sep.vx) + Math.PI / 2;
      /* body and tail follow the trail the head left behind */
      for (var s = 0; s < sep.segs.length; s++) {
        var sp = sep.segs[s];
        var sKey = s % 2 ? 'sepulBodyAlt' : 'sepulBody';
        if (!sprite(sKey, sp.x, sp.y, 0.8, srot)) {
          ctx.fillStyle = '#3A2140';
          ctx.fillRect((sp.x - 12) | 0, (sp.y - 12) | 0, 24, 24);
        }
      }
      if (sep.trail.length) {
        var tail = sep.trail[sep.trail.length - 1];
        if (!sprite('sepulTail', tail.x, tail.y, 0.9, srot)) {
          ctx.fillStyle = '#2A1830';
          ctx.fillRect((tail.x - 8) | 0, (tail.y - 8) | 0, 16, 16);
        }
      }
      if (!sprite('sepulcher', sep.x, sep.y, 1.1, srot)) {
        ctx.fillStyle = '#3A2140';
        ctx.fillRect((sep.x - 18) | 0, (sep.y - 18) | 0, 36, 36);
      }
      /* telegraph glow — the wind-up ring before it charges */
      if (sep.telegraph > 0) {
        ctx.strokeStyle = 'rgba(255,74,42,0.65)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sep.x, sep.y, 20 + (0.35 - sep.telegraph) * 26, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }
    for (var r = 0; r < bros.length; r++) {
      var br = bros[r], rot = Math.atan2(py - br.y, px - br.x);
      var bKey = br.kind === 'fist' ? 'fist' : 'slashTop';
      var bSc  = br.kind === 'fist' ? 0.4 : 0.35;
      if (!sprite(bKey, br.x, br.y, bSc, rot)) {
        ctx.fillStyle = br.kind === 'fist' ? COL.brimHi : COL.brim;
        ctx.fillRect((br.x - 14) | 0, (br.y - 14) | 0, 28, 28);
      }
    }

    if (mode !== 'won' && dm.soul && dm.soul.draw)
      dm.soul.draw(ctx, px, py, inv, COL.soul);

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
    ctx.fillText('shift to focus  ·  z near her to strike', AX + 120, AY + AH + 12);

    /* U1/U2 meters, under the HP line: tp left, rage right, both
       full-bright when they are spendable. The labels sit at the same
       baseline as the HP text because this row is "yours". */
    var bY = AY + AH + 30;
    ctx.fillStyle = '#22222E'; ctx.fillRect(AX, bY, 96, 5);
    ctx.fillStyle = shieldT > 0 ? '#B8E6FF' : (tp >= 1 ? '#7BE38A' : '#4A4560');
    ctx.fillRect(AX, bY, (96 * tp) | 0, 5);
    ctx.fillStyle = COL.dim;
    ctx.fillText('tp', AX + 102, bY - 4);
    ctx.fillStyle = '#22222E'; ctx.fillRect(AX + 128, bY, 96, 5);
    ctx.fillStyle = rage >= 1 ? '#E4C46A' : '#4A4560';
    ctx.fillRect(AX + 128, bY, (96 * rage) | 0, 5);
    ctx.fillStyle = COL.dim;
    ctx.fillText('rage', AX + 230, bY - 4);

    if (NEU.juice) NEU.juice.drawParts(ctx, 1 / 60);
    if (NEU.juice) NEU.juice.end(ctx, shook);
    if (NEU.juice) NEU.juice.overlay(ctx, w, h);

    if (line && now - lineT < 5200) {
      ctx.fillStyle = COL.bone;
      ctx.font = '16px "Undertale Sans","Comic Sans MS",cursive';
      ctx.fillText(line, AX, AY + AH + 40);
    }

    /* F3 hitbox debug */
    if (showHitboxes) {
      ctx.strokeStyle = '#00FF00'; ctx.lineWidth = 1;
      /* player */
      ctx.beginPath(); ctx.arc(px, py, PLAYER_R, 0, Math.PI * 2); ctx.stroke();
      /* SC */
      if (mode === 'fight' && !invuln) {
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
      if (sep) {
        ctx.beginPath(); ctx.arc(sep.x, sep.y, 30, 0, Math.PI * 2); ctx.stroke();
      }
      /* brothers */
      for (var r = 0; r < bros.length; r++) {
        var br = bros[r];
        ctx.beginPath(); ctx.arc(br.x, br.y, 28, 0, Math.PI * 2); ctx.stroke();
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
  function sprite(key, x, y, scale, rot, glow, col, frame) {
    if (!NEU.sheetDraw) return false;
    return NEU.sheetDraw(ctx, key, x, y, {
      scale: scale, rot: rot, glow: glow, col: col, frame: frame,
      now: performance.now()
    });
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
    if (!running && !dying && e.key === 'Enter') { open(); return; }
    if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); tryHit(); return; }
    if (e.key === 'x' || e.key === 'X') {
      /* U2: the barrier. Full tp spends itself as one held hit. */
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
    if (wrap.hidden) return;
    var n = keyName(e); if (n) keys[n] = false;
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
      keysEl.innerHTML = 'arrows / wasd &nbsp;&middot;&nbsp; shift to focus &nbsp;&middot;&nbsp; z to strike &nbsp;&middot;&nbsp; x to shield &nbsp;&middot;&nbsp; esc to leave';
    }
    layout();
    t = 0; hp = MAXHP; inv = 0; bullets = []; keys = {}; marks = {};
    rage = 0; tp = 0; shieldT = 0;
    bossMax = 24; bossHP = bossMax; phase = 1; step_ = 0; stepT = 1.2;
    hearts = []; sep = null; bros = []; invuln = true; dying = 0;
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
    NEU.activeMinigame = null;
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
               get tp() { return tp; },
               get shieldT() { return shieldT; },
               get bx() { return bx; },
               get by() { return by; },
               get charging() { return chargeTelegraph > 0 || chargeT > 0; },
               get wormBusy() { return !!sep && (sep.telegraph > 0 || sep.chargeT > 0); },
               get wormPos() { return sep ? { x: sep.x, y: sep.y } : null; },
               get wormVel() { return sep ? { x: sep.vx, y: sep.vy } : null; },
               get heartPos() { return hearts.map(function (h) { return { x: h.x, y: h.y }; }); },
               get broPos() { return bros.map(function (b) { return { x: b.x, y: b.y }; }); },
               get bullets() { return bullets.map(function (b) { return { x: b.x, y: b.y, vx: b.vx, vy: b.vy }; }); },
               cycle: CYCLE };
})();
