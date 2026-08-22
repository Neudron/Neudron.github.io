/* boss-polt.js — what is through the crack.
   ───────────────────────────────────────────────────────────────────
   Three phases, four grappling hooks, and a clone. Taken from the
   Calamity behaviour, not invented.

   WHY IT LOOKS 3D BUT PLAYS FLAT:
   The body, the hooks and the chains are drawn with perspective and
   depth-sorted, so it reads as a thing in a room. The MOVEMENT stays
   on a plane and the camera never rotates. A free 3D camera makes a
   bullet pattern unreadable — the same reason the survival room is
   full-screen instead of in the panel — and a boss you cannot read is
   not hard, it is arbitrary.

   The projectiles are billboarded flat sprites at integer positions so
   they stay pixel-crisp, which is the whole visual language of the
   site. A soft anti-aliased 3D particle here would look like it came
   from a different website.

   PHASES (from the wiki):
     P1 — alternates slow+6 shots / fast+6 blasts; glows red, lines up
          diagonally, charges once.            → 50%
     P2 — hooks DETACH and fire independently through walls; faster;
          spreads of 7 potent shots; charges twice.   → 20%
     P3 — summons a clone; hooks re-chain and slow; spread of 8 every
          7s (10 if the clone is dead); clone mirrors and charges in
          tandem up to 3x, or 4x and faster if it is dead.           */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};

  var wrap = document.getElementById('polt');
  if (!wrap) { NEU.polt = { open: function () {} }; return; }
  var cv = document.getElementById('poltCanvas');
  var ctx = cv && cv.getContext ? cv.getContext('2d') : null;
  if (!ctx) { NEU.polt = { open: function () {} }; return; }
  var msg = document.getElementById('poltMsg');

  var dm = NEU.danmaku || {};
  var COL = { bone: '#EDE7DE', soul: '#E23B55', dim: '#8A8598',
              ecto: '#7FE3C4', ectoHi: '#C4FFF0', red: '#E04A6B', void_: '#04060A' };

  var PLAYER_R = (dm.soul && dm.soul.R) || 3.2, SPEED = dm.SPEED || 250,
      FOCUS = dm.FOCUS || 110, IFRAMES = dm.IFRAMES || 1.1, MAXHP = 6;

  var running = false, last = 0, t = 0, dying = 0;
  var AX = 0, AY = 0, AW = 0, AH = 0;
  var px = 0, py = 0, keys = {}, hp = MAXHP, inv = 0;
  var bullets = [], hooks = [], phase = 1, bossHP = 30, bossMax = 30;
  var bx = 0, by = 0, bz = 0, charging = 0, glow = 0, nextFire = 0, nextCharge = 0;
  var chargeTimer = 0;                   /* the 900ms telegraph delay — cleared on close so a
                                            quit+reopen inside the window can't fire it into the new fight */
  var clone = null, mode = 'fight';
  var line = '', lineT = 0;

  function say(s) { line = s; lineT = performance.now(); }

  function layout() {
    var dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = (innerWidth * dpr) | 0; cv.height = (innerHeight * dpr) | 0;
    cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    var ar = dm.arena ? dm.arena(innerWidth, innerHeight, 760, 500, 20) : null;
    if (ar) {
      AW = ar.AW; AH = ar.AH; AX = ar.AX; AY = ar.AY;
    } else {
      AW = Math.min(760, innerWidth - 60);
      AH = Math.min(500, innerHeight - 180);
      AX = ((innerWidth - AW) / 2) | 0;
      AY = ((innerHeight - AH) / 2 + 20) | 0;
    }
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

  /* Depth is a scalar, not a matrix. Everything sits on one plane and
     `z` only scales and offsets — enough for parallax and sorting,
     none of the cost or the readability problems of real 3D. */
  function proj(x, y, z) {
    var k = 1 / (1 + z * 0.0016);
    return { x: AX + AW / 2 + (x - AX - AW / 2) * k,
             y: AY + AH / 2 + (y - AY - AH / 2) * k - z * 0.10,
             k: k };
  }

  function shot(x, y, vx, vy, r, c, kind) {
    if (dm.shot) {
      var s = dm.shot(bullets, x, y, vx, vy, r, c, kind, 700);
      if (s) s.z = 0;
      return;
    }
    if (bullets.length > 700) return;
    bullets.push({ x: x, y: y, z: 0, vx: vx, vy: vy, r: r, c: c, k: kind || 0, age: 0 });
  }

  function spread(n, sp, col, r) {
    var a0 = Math.atan2(py - by, px - bx);
    for (var i = 0; i < n; i++) {
      var a = a0 + (i - (n - 1) / 2) * 0.20;
      shot(bx, by, Math.cos(a) * sp, Math.sin(a) * sp, r, col, phase >= 2 ? 1 : 0);
    }
  }

  function resetHooks() {
    hooks = [];
    for (var i = 0; i < 4; i++) {
      hooks.push({ a: i * Math.PI / 2, r: 120, x: bx, y: by, t: Math.random() * 2,
                   free: false });
    }
  }

  function stepFn(nowMs) {
    if (!running) { if (dying) deathStep(nowMs); return; }
    requestAnimationFrame(stepFn);
    var dt = Math.min(0.033, (nowMs - last) / 1000); last = nowMs;
    if (NEU.juice && NEU.juice.frozen()) { draw(nowMs); return; }
    t += dt;
    if (inv > 0) inv -= dt;

    /* player */
    var vx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    var vy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (vx && vy) { vx *= 0.7071; vy *= 0.7071; }
    var sp = keys.focus ? FOCUS : SPEED;
    px = Math.min(Math.max(px + vx * sp * dt, AX + 8), AX + AW - 8);
    py = Math.min(Math.max(py + vy * sp * dt, AY + 8), AY + AH - 8);

    /* him — Plantera-like chase, faster each phase */
    var chase = [0, 1.0, 1.7, 2.6][phase];
    if (charging > 0) {
      charging -= dt;
      bx += cvx * dt; by += cvy * dt;
    } else {
      bx += (px - bx) * Math.min(1, dt * chase * 0.9);
      by += (py - by) * Math.min(1, dt * chase * 0.9);
      bz = Math.sin(t * 0.8) * 60;
    }
    bx = Math.min(Math.max(bx, AX + 20), AX + AW - 20);
    by = Math.min(Math.max(by, AY + 20), AY + AH - 20);

    /* hooks. attached in P1 and P3, free and shooting in P2 */
    for (var i = 0; i < hooks.length; i++) {
      var hk = hooks[i];
      hk.a += dt * (hk.free ? 0.5 : 1.1);
      var tgt = hk.free
        ? { x: AX + AW / 2 + Math.cos(hk.a) * (AW * 0.36),
            y: AY + AH / 2 + Math.sin(hk.a) * (AH * 0.36) }
        : { x: bx + Math.cos(hk.a) * hk.r, y: by + Math.sin(hk.a) * hk.r };
      hk.x += (tgt.x - hk.x) * Math.min(1, dt * 3);
      hk.y += (tgt.y - hk.y) * Math.min(1, dt * 3);
      if (hk.free) {
        hk.t -= dt;
        if (hk.t <= 0) {
          hk.t = 1.5;
          var a = Math.atan2(py - hk.y, px - hk.x);
          shot(hk.x, hk.y, Math.cos(a) * 180, Math.sin(a) * 180, 4, COL.ecto, 0);
        }
      }
    }

    /* the clone mirrors him across the arena centre */
    if (clone) {
      clone.x = AX + AW - (bx - AX);
      clone.y = AY + AH - (by - AY);
      clone.t -= dt;
      if (clone.t <= 0) {
        clone.t = 2.4;
        var ca = Math.atan2(py - clone.y, px - clone.x);
        for (var q = -1; q <= 1; q++)
          shot(clone.x, clone.y, Math.cos(ca + q * 0.18) * 200,
               Math.sin(ca + q * 0.18) * 200, 4, COL.red, 0);
      }
    }

    /* his own cadence */
    nextFire -= dt;
    if (nextFire <= 0 && charging <= 0) {
      if (phase === 1) { spread(6, 150, COL.ecto, 4); nextFire = 1.5; }
      else if (phase === 2) { spread(7, 190, COL.ectoHi, 4); nextFire = 1.15; }
      else { spread(clone ? 8 : 10, 210, COL.red, 5); nextFire = phase === 3 ? 7 : 2; }
    }
    nextCharge -= dt;
    if (nextCharge <= 0 && charging <= 0) {
      glow = 0.9;
      nextCharge = [0, 5.5, 4.2, 3.4][phase];
      chargeTimer = setTimeout(doCharge, 900);
    }
    if (glow > 0) glow -= dt;

    moveBullets(dt);
    draw(nowMs);
  }

  var cvx = 0, cvy = 0;
  function doCharge() {
    if (!running) return;
    var a = Math.atan2(py - by, px - bx);
    cvx = Math.cos(a) * 520; cvy = Math.sin(a) * 520;
    charging = 0.5;
    glow = 0;
  }

  function moveBullets(dt) {
    var keep = [];
    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i];
      b.age += dt;
      /* Expert-mode behaviour: shots turn back toward you once, after
         travelling a way. It is the difference between a spread you
         sidestep and a spread you have to keep watching. */
      if (b.k === 1 && b.age > 0.9 && !b.turned) {
        b.turned = true;
        var a = Math.atan2(py - b.y, px - b.x), s = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(a) * s; b.vy = Math.sin(a) * s;
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < AX - 50 || b.x > AX + AW + 50 || b.y < AY - 50 || b.y > AY + AH + 50) continue;
      keep.push(b);
      if (inv <= 0) {
        var dx = b.x - px, dy = b.y - py, rr = b.r + PLAYER_R;
        if (dx * dx + dy * dy < rr * rr) {
          hp--; inv = IFRAMES;
          if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
          if (NEU.juice) { NEU.juice.hit('medium'); NEU.juice.burst(px, py, 10, COL.soul); }
          if (hp <= 0) { startDeath(); return; }
        }
      }
    }
    bullets = keep;
    /* contact damage while charging */
    if (charging > 0 && inv <= 0 && Math.hypot(px - bx, py - by) < 26) {
      hp--; inv = IFRAMES;
      if (hp <= 0) startDeath();
    }
  }

  function tryHit() {
    /* The clone check has to come before the boss-range guard: the
       clone mirrors the boss across the arena, so when you are close
       enough to hit it the boss is on the far side — a range guard
       against the boss would make the copy indestructible. */
    if (clone && Math.hypot(px - clone.x, py - clone.y) < 30) {
      clone = null;
      say("* the copy comes apart. the original notices.");
      return;
    }
    if (Math.hypot(px - bx, py - by) > 40) return;
    bossHP--;
    if (NEU.sfx && NEU.sfx.whoosh) NEU.sfx.whoosh();
    if (NEU.juice) { NEU.juice.hit('small'); NEU.juice.burst(bx, by, 7, COL.ectoHi); }
    var pct = bossHP / bossMax;
    if (bossHP <= 0) { win(); return; }
    if (pct <= 0.20 && phase < 3) {
      phase = 3;
      hooks.forEach(function (h) { h.free = false; });
      clone = { x: bx, y: by, t: 2 };
      say("* it makes another one of itself.");
    } else if (pct <= 0.50 && phase < 2) {
      phase = 2;
      hooks.forEach(function (h) { h.free = true; });
      say("* the hooks let go.");
    }
  }

  function win() {
    running = false; mode = 'won'; bullets = [];
    if (NEU.juice) { NEU.juice.hit('huge', { colour: '#7FE3C4' });
                     NEU.juice.burst(bx, by, 60, COL.ecto, 260); }
    if (NEU.save) NEU.save.flag('polt_dead', 1);
    if (NEU.quest) NEU.quest.mark('a4_polt');
    if (msg) {
      msg.hidden = false;
      msg.innerHTML = '<b>it stops.</b><br>' +
        'it picks you up by a tooth, considers you, and throws you<br>' +
        'back through the hole you came in by.<br><small>esc</small>';
    }
    draw(performance.now());
  }

  function startDeath() {
    running = false; dying = performance.now();
    if (dm.resetDeath) dm.resetDeath();
    if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
    requestAnimationFrame(deathStep);
  }

  function deathStep(nowMs) {
    var ms = nowMs - dying;
    ctx.fillStyle = COL.void_; ctx.fillRect(0, 0, innerWidth, innerHeight);
    frame();
    var playing = dm.death ? dm.death(ctx, px, py, ms, COL.soul) : (ms <= 1700);
    if (!playing) {
      dying = 0;
      if (msg) { msg.hidden = false;
        msg.innerHTML = '<b>it waits.</b><br>enter to try again &middot; esc to leave'; }
      return;
    }
    requestAnimationFrame(deathStep);
  }

  /* ── the real art ───────────────────────────────────────────────
     Three files, identical geometry: body, glowmask, second glowmask.
     Stacked — body normal, glows ADDITIVE — which is how the phase
     changes read without a single new sprite. Missing art draws
     magenta rather than nothing; a silently absent sprite gets
     mistaken for a logic bug and costs an hour. */
  /* One blitter for the whole site, in data/sheets.js. The local copy
     this replaces was the third of three identical image caches. */
  function drawSheet(key, x, y, scale, glowKeys, rot) {
    if (!NEU.sheetDraw) return false;
    return NEU.sheetDraw(ctx, key, x, y, {
      scale: scale, glowKeys: glowKeys, rot: rot, now: performance.now()
    });
  }

  function frame() {
    ctx.fillStyle = '#070A14'; ctx.fillRect(AX, AY, AW, AH);
    ctx.fillStyle = COL.bone;
    ctx.fillRect(AX - 3, AY - 3, AW + 6, 3); ctx.fillRect(AX - 3, AY + AH, AW + 6, 3);
    ctx.fillRect(AX - 3, AY, 3, AH); ctx.fillRect(AX + AW, AY, 3, AH);
  }

  function draw(nowMs) {
    ctx.fillStyle = COL.void_; ctx.fillRect(0, 0, innerWidth, innerHeight);
    var shook = NEU.juice ? NEU.juice.begin(ctx, innerWidth, innerHeight) : false;
    frame();

    /* chains first, behind everything */
    if (phase !== 2) {
      /* Real chain links, not a translucent line. The header of this
         file has always said the chains are drawn; PolterghastChain.png
         has been sitting in the manifest unreferenced the whole time.
         Links are stepped along the tether and rotated to face it, with
         the old stroke kept as the fallback so a missing file degrades
         to the previous look instead of to nothing. */
      var link = NEU.sheets && NEU.sheets.chain;
      var haveLink = !!(NEU.sheetReady && NEU.sheetReady(link));
      if (!haveLink) { ctx.strokeStyle = 'rgba(127,227,196,.28)'; ctx.lineWidth = 2; }
      for (var i = 0; i < hooks.length; i++) {
        var p1 = proj(bx, by, bz), p2 = proj(hooks[i].x, hooks[i].y, 0);
        if (!haveLink) {
          ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
          continue;
        }
        var dx2 = p2.x - p1.x, dy2 = p2.y - p1.y;
        var len = Math.hypot(dx2, dy2);
        var ang = Math.atan2(dy2, dx2) - Math.PI / 2;   // art points up
        var step = link.fh * 0.7;                        // overlap so it reads solid
        var n = Math.max(1, Math.min(24, (len / step) | 0));
        for (var s2 = 1; s2 <= n; s2++) {
          var t2 = s2 / (n + 1);
          drawSheet('chain', p1.x + dx2 * t2, p1.y + dy2 * t2, 0.7, null, ang);
        }
      }
    }

    /* depth sort: him, the clone, four hooks */
    var things = [{ x: bx, y: by, z: bz, kind: 'body' }];
    if (clone) things.push({ x: clone.x, y: clone.y, z: 20, kind: 'clone' });
    hooks.forEach(function (h) { things.push({ x: h.x, y: h.y, z: 0, kind: 'hook' }); });
    things.sort(function (a, b) { return a.z - b.z; });

    things.forEach(function (o) {
      var p = proj(o.x, o.y, o.z);
      var s = Math.max(0.5, p.k);
      if (o.kind === 'hook') {
        if (!drawSheet('hook', p.x, p.y, s * 0.5)) {
          ctx.fillStyle = COL.ecto;
          ctx.fillRect((p.x - 9 * s) | 0, (p.y - 9 * s) | 0, (18 * s) | 0, (18 * s) | 0);
        }
        return;
      }
      /* Phase drives which glowmask stacks on. P1 body only, P2 adds
         the first glow, P3 both — so escalation is visible before the
         health bar is. The clone is the same body tinted red by an
         extra pass, because it IS the same body. */
      var glows = phase >= 3 ? ['polterG1', 'polterG2'] : phase >= 2 ? ['polterG1'] : null;
      var w = 44 * s, h = 44 * s;
      var drew = drawSheet('polter', p.x, p.y, s * 0.42, glows);
      if (o.kind === 'clone' && drew) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = COL.red;
        ctx.fillRect((p.x - 22 * s) | 0, (p.y - 22 * s) | 0, (44 * s) | 0, (44 * s) | 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      /* glowing red = it is about to charge. announced, always. This
         has to sit OUTSIDE the fallback branch: with the sheets
         loaded, drew is true and a glow nested in the fallback would
         never render — the charge would come without the telegraph. */
      if (o.kind === 'body' && glow > 0) {
        ctx.globalAlpha = Math.min(1, glow);
        ctx.fillStyle = COL.red;
        ctx.fillRect((p.x - w / 2 - 4) | 0, (p.y - h / 2 - 4) | 0, (w + 8) | 0, (h + 8) | 0);
        ctx.globalAlpha = 1;
      }
      if (drew) return;
      ctx.fillStyle = o.kind === 'clone' ? '#5A2A3E' : '#1E3A44';
      ctx.fillRect((p.x - w / 2) | 0, (p.y - h / 2) | 0, w | 0, h | 0);
      ctx.fillStyle = o.kind === 'clone' ? COL.red : COL.ecto;
      ctx.fillRect((p.x - w / 2 + 4) | 0, (p.y - h / 2 + 4) | 0, (w - 8) | 0, (h - 8) | 0);
    });

    for (var b = 0; b < bullets.length; b++) {
      var bl = bullets[b], sz = (bl.r * 2) | 0;
      /* Potent shots in later phases; the plain ones in P1. Falls back
         to a square, which is what the whole fight was until now. */
      var key = bl.k === 1 ? 'potentShot' : 'pShot';
      /* Rotated to face the way it is travelling, like the dart in the
         other fight — a spiked shot drawn straight reads as a blob. */
      if (!drawSheet(key, bl.x, bl.y, 1, null, Math.atan2(bl.vy, bl.vx))) {
        ctx.fillStyle = bl.c;
        ctx.fillRect((bl.x - bl.r) | 0, (bl.y - bl.r) | 0, sz, sz);
      }
    }

    if (mode !== 'won' && dm.soul && dm.soul.draw)
      dm.soul.draw(ctx, px, py, inv, COL.soul);

    var bw = 300, bx2 = ((innerWidth - bw) / 2) | 0, by2 = AY - 40;
    ctx.fillStyle = '#152028'; ctx.fillRect(bx2, by2, bw, 8);
    ctx.fillStyle = COL.ecto; ctx.fillRect(bx2, by2, (bw * Math.max(0, bossHP / bossMax)) | 0, 8);
    ctx.fillStyle = COL.bone;
    ctx.font = '16px "Determination Mono","Pixelify Sans",monospace';
    ctx.textBaseline = 'top'; ctx.textAlign = 'center';
    ctx.fillText('polterghast — phase ' + phase, innerWidth / 2, by2 - 20);
    ctx.textAlign = 'left';
    ctx.fillText('HP ' + Math.max(0, hp) + '/' + MAXHP, AX, AY + AH + 12);
    ctx.fillStyle = COL.dim;
    ctx.fillText('shift to focus  ·  z to strike  ·  red means it is about to move',
                 AX + 120, AY + AH + 12);
    if (NEU.juice) NEU.juice.drawParts(ctx, 1 / 60);
    if (NEU.juice) NEU.juice.end(ctx, shook);
    if (NEU.juice) NEU.juice.overlay(ctx, innerWidth, innerHeight);

    if (line && nowMs - lineT < 5000) {
      ctx.fillStyle = COL.bone;
      ctx.font = '16px "Undertale Sans","Comic Sans MS",cursive';
      ctx.fillText(line, AX, AY + AH + 38);
    }
  }

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
    if (wrap.hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (NEU.engine && NEU.engine.confirmExit) {
        NEU.engine.confirmExit('Polterghast', close);
      } else { close(); }
      return;
    }
    if (!running && !dying && e.key === 'Enter') { e.preventDefault(); open(); return; }
    if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); tryHit(); return; }
    var n = keyName(e); if (n) { keys[n] = true; e.preventDefault(); }
  });
  addEventListener('keyup', function (e) {
    var n = keyName(e); if (n) keys[n] = false;
  });

  function open() {
    wrap.hidden = false;
    NEU.activeMinigame = 'polt';        /* the room underneath must not move or take Escape */
    document.body.classList.add('is-playing');
    if (NEU.quest) NEU.quest.lock(true);
    if (msg) msg.hidden = true;
    layout();
    t = 0; hp = MAXHP; inv = 0; bullets = []; keys = {}; dying = 0;
    bossMax = 30; bossHP = bossMax; phase = 1; clone = null; mode = 'fight';
    px = AX + AW / 2; py = AY + AH - 70;
    bx = AX + AW / 2; by = AY + 80; bz = 0;
    charging = 0; glow = 0; nextFire = 1.4; nextCharge = 5;
    resetHooks();
    say('* something in the wall has been listening the whole time.');
    running = true; last = performance.now();
    requestAnimationFrame(stepFn);
  }
  function close() {
    running = false; dying = 0;
    if (chargeTimer) { clearTimeout(chargeTimer); chargeTimer = 0; }
    if (NEU.activeMinigame === 'polt') NEU.activeMinigame = null;
    wrap.hidden = true;
    document.body.classList.remove('is-playing');
    if (NEU.quest) NEU.quest.lock(false);
    if (NEU.save && NEU.save.flagged('polt_dead') && NEU.act4 && NEU.act4.ending) {
      NEU.act4.ending();
    } else if (NEU.crack && NEU.crack.reset) {
      /* Left without killing him: put the crack back so the finale
         is still reachable. A permanent "opened" crack is a save
         that can never finish the game. */
      NEU.crack.reset();
    }
  }

  var q = document.getElementById('poltQuit');
  if (q) q.addEventListener('click', function () {
    /* same path as ESC: a confirmed exit, since the fight is on the line */
    if (NEU.engine && NEU.engine.confirmExit) NEU.engine.confirmExit('Polterghast', close);
    else close();
  });

  NEU.polt = { open: open, close: close,
               get running() { return running; },
               get phase() { return phase; },
               get hp() { return bossHP; },
               get clone() { return !!clone; },
               get hooks() { return hooks.length; } };
})();
