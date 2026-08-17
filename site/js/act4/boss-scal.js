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

  var PLAYER_R = (dm.soul && dm.soul.R) || 3.2, SPEED = dm.SPEED || 250,
      FOCUS = dm.FOCUS || 108, IFRAMES = dm.IFRAMES || 1.1;
  var MAXHP = 5;

  /* Her cycle. c = charge, d = dart bursts, h = hellblast barrage,
     g2/g4 = two or four gigablasts. Twenty steps, exactly as in the
     game, including the fact that charges are unevenly spaced. */
  var CYCLE = ['d','h','g2','c','g2','h','d','c','d','h','g4','h','c','d','g4','c','d','c','d','c'];

  var running = false, last = 0, t = 0;
  var px = 0, py = 0, keys = {}, hp = MAXHP, inv = 0;
  var AX = 0, AY = 0, AW = 0, AH = 0;
  var bullets = [], step_ = 0, stepT = 0, phase = 1;
  var bossHP = 1, bossMax = 1, invuln = false;
  var mode = 'intro';        // intro | fight | wall | brothers | dead | won
  var wallT = 0, wallN = 0, walls = [];
  var hearts = [], sep = null, bros = [];
  var line = '', lineT = 0;
  var bx = 0, by = 0;        // her position
  var dying = 0;
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
       her. The GAPS are the attack — a solid wall would be a wall. */
    var n = 8, span = AW * 0.9, x0 = AX + AW / 2 - span / 2;
    for (var i = 0; i < n; i++) {
      /* one slot is deliberately left out, and it moves each burst */
      if (i === (Math.random() * n) | 0) continue;
      shot(x0 + (i + 0.5) * (span / n), by + 20, 0, 150 + phase * 30, 4, COL.brim);
    }
  }

  function fireblast() {
    /* Homes, then bursts into a ring. Slow enough to run from, which
       is the point — it forces you to move while everything else is
       trying to make you stand still. */
    sfxPlay('fireblast');
    var b = { x: bx, y: by + 20, vx: 0, vy: 0, r: 8, c: COL.brimHi, k: 1, age: 0, fuse: 1.6 };
    bullets.push(b);
  }

  function gigablast(n) {
    sfxPlay('giga');
    for (var i = 0; i < n; i++) {
      later(function () {
        if (!running) return;
        bullets.push({ x: bx, y: by + 20, vx: 0, vy: 0, r: 12, c: COL.dark,
                       k: 2, age: 0, fuse: 2.1 });
      }, i * 520);
    }
  }

  function hellbarrage() {
    /* From beside you, horizontally, accelerating. */
    sfxPlay('hellblast');
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
  }
  var bxv = 0, byv = 0, chargeT = 0;

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
         the order the game uses, so anyone who knows it is rewarded. */
      var dirs = [['d','r','l'], ['u','r'], ['d','l','r']][wallN] || ['d'];
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
    sep = { x: AX + AW / 2, y: AY + AH - 40, t: 0 };
    hearts = [];
    for (var i = 0; i < 6; i++) {
      hearts.push({ x: AX + 40 + (i % 3) * 40 + (i > 2 ? AW - 200 : 0),
                    y: AY + 34 + ((i / 3) | 0) * 34, hp: 1 });
    }
    say("* she is behind it. kill the hearts.");
  }

  /* ── the brothers ───────────────────────────────────────────────*/
  function startBrothers() {
    mode = 'brothers'; invuln = true; bullets = [];
    clearSched();
    bros = [
      { side: -1, x: AX + 60, y: AY + AH / 2, hp: 8, t: 0, kind: 'slash' },
      { side:  1, x: AX + AW - 60, y: AY + AH / 2, hp: 8, t: 0, kind: 'fist' }
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

  function fightTick(dt) {
    /* she hovers above you unless charging */
    if (chargeT > 0) {
      chargeT -= dt; bx += bxv * dt; by += byv * dt;
      bx = Math.min(Math.max(bx, AX), AX + AW);
      by = Math.min(Math.max(by, AY - 30), AY + AH);
    } else {
      bx += ((px) - bx) * Math.min(1, dt * 1.8);
      by += ((AY - 24) - by) * Math.min(1, dt * 2.2);
    }

    if (sep) {
      sep.t += dt;
      if (!hearts.length) { sep = null; invuln = false; say("* she steps out from behind it."); }
      return;
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
    else if (k === 'c')   { charge(); stepT = 1.0 * fast; }
  }

  function brothersTick(dt) {
    for (var i = 0; i < bros.length; i++) {
      var b = bros[i];
      b.t -= dt;
      b.y += Math.sin(t * 1.6 + i) * 22 * dt;
      if (b.t <= 0) {
        b.t = 1.15;
        var a = Math.atan2(py - b.y, px - b.x);
        if (b.kind === 'fist') {
          shot(b.x, b.y, Math.cos(a) * 240, Math.sin(a) * 240, 7, COL.brimHi);
        } else {
          for (var j = -1; j <= 1; j++)
            shot(b.x, b.y, Math.cos(a + j * 0.16) * 300, Math.sin(a + j * 0.16) * 300, 5, COL.brim);
        }
      }
    }
    if (!bros.length) {
      invuln = false; phase = 2; mode = 'fight';
      say("* she laughs. that is the first noise she has made.");
      later(function () { if (running) say("* now she is trying."); }, 2200);
    }
  }

  function moveBullets(dt) {
    var keep = [];
    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i];
      b.age += dt;
      if (b.k === 1 || b.k === 2) {
        /* homing until the fuse, then a ring */
        b.fuse -= dt;
        if (b.fuse > 0.35) {
          var a = Math.atan2(py - b.y, px - b.x);
          var sp = b.k === 2 ? 90 : 140;
          b.vx += (Math.cos(a) * sp - b.vx) * dt * 2.4;
          b.vy += (Math.sin(a) * sp - b.vy) * dt * 2.4;
        } else if (b.fuse <= 0) {
          var n = b.k === 2 ? 22 : 10;
          sfxPlay(b.k === 2 ? 'giga-hit' : 'fireblast-hit');
          for (var q = 0; q < n; q++) {
            var ang = q * Math.PI * 2 / n;
            shot(b.x, b.y, Math.cos(ang) * 130, Math.sin(ang) * 130, 3, COL.brim);
          }
          continue;
        }
      }
      if (b.k === 3) { b.vx *= 1 + dt * 1.6; }   // hellblasts accelerate
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < AX - 60 || b.x > AX + AW + 60 || b.y < AY - 60 || b.y > AY + AH + 60) continue;
      keep.push(b);
      if (inv <= 0 && mode !== 'won') {
        var dx = b.x - px, dy = b.y - py, rr = b.r + PLAYER_R;
        if (dx * dx + dy * dy < rr * rr) {
          hp--; inv = IFRAMES;
          if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
          /* Taking a hit is a MEDIUM event. The player needs to feel it
             without the screen becoming unreadable mid-pattern. */
          if (NEU.juice) { NEU.juice.hit('medium'); NEU.juice.burst(px, py, 10, COL.soul); }
          if (hp <= 0) { startDeath(); return; }
        }
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
        if (Math.hypot(px - hearts[i].x, py - hearts[i].y) < 16) {
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
        if (Math.hypot(px - bros[j].x, py - bros[j].y) < 22) {
          bros[j].hp--;
          if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
          if (NEU.juice) { NEU.juice.hit('small'); NEU.juice.burst(bros[j].x, bros[j].y, 8, COL.brimHi); }
          if (bros[j].hp <= 0) bros.splice(j, 1);
          return;
        }
      }
      return;
    }
    if (invuln || mode !== 'fight') return;
    if (Math.hypot(px - bx, py - by) > 34) return;
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

    /* her */
    if (mode !== 'won') {
      var bodyKey = mode === 'intro' ? 'scalHood' : 'scal';
      /* Column 0 is the front-facing pose set — she looks at you, and
         frames 12 and 16 are the casting flare. Column 1 is the same
         woman turned away, which is the wrong read for a boss you are
         fighting. Scale 2 because that is the pixel size the rest of
         this layer draws at (the soul is stamped at 2 in danmaku.js);
         at scale 1 she was 60px of fine detail in a 700px arena and
         read as a smudge rather than as a sprite. */
      if (!sprite(bodyKey, bx, by, 2, 0, phase === 2, 0)) {
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

    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i], sz = (b.r * 2) | 0;
      /* k picks the sheet; everything else is a brimstone dart. */
      var key = b.k === 1 ? 'fireblast' : b.k === 2 ? 'gigablast'
              : b.k === 3 ? 'hellblast' : 'dart';
      var sc = b.k === 1 ? 0.65 : b.k === 2 ? 0.75
            : b.k === 3 ? 0.5 : 0.55;
      if (!sprite(key, b.x, b.y, sc, Math.atan2(b.vy, b.vx))) {
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
    if (sep && !sprite('sepulcher', sep.x, sep.y, 1.1, 0)) {
      ctx.fillStyle = '#3A2140';
      ctx.fillRect((sep.x - 18) | 0, (sep.y - 18) | 0, 36, 36);
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

    if (NEU.juice) NEU.juice.drawParts(ctx, 1 / 60);
    if (NEU.juice) NEU.juice.end(ctx, shook);
    if (NEU.juice) NEU.juice.overlay(ctx, w, h);

    if (line && now - lineT < 5200) {
      ctx.fillStyle = COL.bone;
      ctx.font = '16px "Undertale Sans","Comic Sans MS",cursive';
      ctx.fillText(line, AX, AY + AH + 40);
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
  function sprite(key, x, y, scale, rot, glow, col) {
    if (!NEU.sheetDraw) return false;
    return NEU.sheetDraw(ctx, key, x, y, {
      scale: scale, rot: rot, glow: glow, col: col,
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
    if (wrap.hidden || !NEU.scal.active) return;
    if (e.key === 'Escape') { close(); return; }
    if (!running && !dying && e.key === 'Enter') { open(); return; }
    if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); tryHit(); return; }
    var n = keyName(e); if (n) { keys[n] = true; e.preventDefault(); }
  });
  addEventListener('keyup', function (e) {
    if (wrap.hidden) return;
    var n = keyName(e); if (n) keys[n] = false;
  });

  /* ── open / close ───────────────────────────────────────────────*/
  var active = false;
  function open() {
    active = true;
    wrap.hidden = false;
    document.body.classList.add('is-playing');
    if (NEU.quest) NEU.quest.lock(true);
    if (msg) msg.hidden = true;
    layout();
    t = 0; hp = MAXHP; inv = 0; bullets = []; keys = {}; marks = {};
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
    wrap.hidden = true;
    document.body.classList.remove('is-playing');
    if (NEU.quest) NEU.quest.lock(false);
    /* Back to the room you came from, win or lose. */
    if (NEU.engine) NEU.engine.enter(NEU.save && NEU.save.flagged('scal_dead') ? 'b7_altar' : 'b8_arena',
                                     NEU.save && NEU.save.flagged('scal_dead') ? 'north' : 'west');
  }

  NEU.scal = { open: open, close: close,
               get running() { return running; },
               get active() { return active; },
               get hp() { return bossHP; },
               get phase() { return phase; },
               get mode() { return mode; },
               get hearts() { return hearts.length; },
               get bros() { return bros.length; },
               cycle: CYCLE };
})();
