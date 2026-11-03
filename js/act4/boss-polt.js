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

  /* one look per phase (index = phase): the field and rim shift so the
     escalation reads from the arena before the health bar */
  var PHASE_LOOK = [null,
    { field: '#070A14', rim: COL.bone },
    { field: '#061418', rim: COL.ecto },
    { field: '#14070E', rim: COL.red }];
  var VULN_COL = '#FFC46A';            /* same gold as her VULNERABLE banner */

  var PLAYER_R = (dm.soul && dm.soul.R) || 3.2, IFRAMES = dm.IFRAMES || 1.1, MAXHP = 6;
  /* the shared fight feel: dash, adrenaline, rage, numbers, the HUD */
  var F = dm.fight(0, 0);

  var running = false, last = 0, t = 0, dying = 0;
  var AX = 0, AY = 0, AW = 0, AH = 0;
  var px = 0, py = 0, keys = {}, hp = MAXHP, inv = 0;
  var bullets = [], hooks = [], phase = 1, bossHP = 30, bossMax = 30;
  var bx = 0, by = 0, bz = 0, charging = 0, glow = 0, nextFire = 0, nextCharge = 0;
  var TELE = 24 / 60;                    /* hook telegraph: 24 frames before a hook can hit */
  /* game-clock state: every timer here is advanced by the update loop, so a
     pause or a death holds it and open()/close() wipe it */
  var warnAt = 0, chargePath = null, vuln = 0, sig = 0, sigDone = false, sigRing = 0, sigSpin = 0;
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
                   free: false, warn: false });
    }
  }

  function stepFn(nowMs) {
    if (!running) { if (dying) deathStep(nowMs); return; }
    requestAnimationFrame(stepFn);
    /* the pace cap (perf.js): `last` advances on drawn frames only,
       so dt covers the skipped vsyncs */
    if (NEU.perf && !NEU.perf.paced(nowMs)) return;
    var dt = Math.min(0.033, (nowMs - last) / 1000); last = nowMs;
    if (NEU.juice && NEU.juice.frozen()) { draw(nowMs); return; }
    t += dt;
    if (inv > 0) inv -= dt;

    /* player; rage builds inside ~300px of his 40px strike reach */
    F.x = px; F.y = py;
    dm.move(F, keys, dt, { AX: AX, AY: AY, AW: AW, AH: AH });
    px = F.x; py = F.y;
    dm.tick(F, dt, 1 - Math.min(1, Math.max(0, Math.hypot(px - bx, py - by) - 40) / 260));

    /* him — Plantera-like chase, faster each phase */
    var chase = [0, 1.0, 1.7, 2.6][phase];
    if (charging > 0) {
      charging -= dt;
      bx += cvx * dt; by += cvy * dt;
      if (charging <= 0) { vuln = 1; chargePath = null; }   /* the punish window opens */
    } else {
      if (!warnAt) {                     /* a warning holds still: the drawn path is the real one */
        bx += (px - bx) * Math.min(1, dt * chase * 0.9);
        by += (py - by) * Math.min(1, dt * chase * 0.9);
      }
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
      hk.warn = false;
      if (hk.free) {
        hk.t -= dt;
        hk.warn = hk.t > 0 && hk.t <= TELE;   /* the aim shows for 24 frames before it fires */
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
      if (t < 6) say('* red means it is about to move.');   /* the first charge explains itself */
      nextCharge = [0, 5.5, 4.2, 3.4][phase];
      /* the telegraph has a sound as well as a glow: a tone that climbs
         for the 900 ms it takes to fire. The charge stops it (doCharge),
         and so does leaving the fight (close), so it outlives neither. */
      stopRise();
      riseStop = NEU.sfx && NEU.sfx.rise ? NEU.sfx.rise(900) : null;
      warnAt = t + 0.9;                   /* game clock: a pause or a death holds it */
      lockCharge();
    }
    if (warnAt && t >= warnAt) { warnAt = 0; doCharge(); }
    if (glow > 0) glow -= dt;
    if (vuln > 0) vuln -= dt;
    if (sig > 0) {
      sig -= dt; sigRing -= dt;
      if (sigRing <= 0) {
        sigRing = 1.2; sigSpin += 0.26;
        for (var k = 0; k < 12; k++) {
          var sa2 = sigSpin + k * Math.PI / 6;
          shot(bx, by, Math.cos(sa2) * 170, Math.sin(sa2) * 170, 5, COL.red, 1);
        }
      }
      if (sig <= 0) { sig = 0; sigDone = true; say('* it holds on. one more.'); }
    }

    moveBullets(dt * dm.slow(F));
    draw(nowMs);
  }

  /* The telegraph's rising tone (sans.js sfx.rise). It is held here so
     the charge that fires it can stop it, and so can close(). stop() is
     safe to call twice, so a stale handle costs nothing. */
  var riseStop = null;
  function stopRise() {
    if (riseStop) { riseStop(); riseStop = null; }
  }
  var cvx = 0, cvy = 0;
  /* the direction is read at WARN time and drawn as chargePath, so the
     telegraph is the real path. The boss holds still while it warns. */
  function lockCharge() {
    var a = Math.atan2(py - by, px - bx), ca = Math.cos(a), sa = Math.sin(a);
    cvx = ca * 520; cvy = sa * 520;
    chargePath = { x0: bx, y0: by, x1: bx + ca * 260, y1: by + sa * 260, t: warnAt };
  }
  function doCharge() {
    stopRise();                          /* the charge fires: the telegraph's tone ends with it */
    if (!running) return;
    charging = 0.5;
    glow = 0;
  }

  /* the signature at 1 HP: the kill is held until this has been survived */
  function startSig() {
    sig = 4; sigRing = 0; sigSpin = 0;
    say('* it makes one last thing of itself.');
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
      var dx = b.x - px, dy = b.y - py, rr = b.r + PLAYER_R;
      if (dx * dx + dy * dy < rr * rr && hurt(b.vx, b.vy)) return;
    }
    bullets = keep;
    /* contact damage while charging */
    if (charging > 0 && Math.hypot(px - bx, py - by) < 26) hurt(cvx, cvy);
  }

  /* One damage path; a dash or the i-frames pass through. True = dead. */
  function hurt(dx, dy) {
    if (inv > 0 || F.dashI > 0 || (NEU.cheat && NEU.cheat.god)) return false;   /* dev `god` (dev.js) */
    hp--; inv = IFRAMES;
    dm.hurt(F, px, py - 12);
    if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
    if (NEU.juice) { NEU.juice.hit('medium', { dx: dx, dy: dy }); NEU.juice.burst(px, py, 10, COL.soul); }
    if (hp <= 0) { startDeath(); return true; }
    return false;
  }

  var STRIKE_CD = 0.18, lastHit = -1;   /* game seconds between strikes */
  function tryHit() {
    if (!running || t - lastHit < STRIKE_CD) return;
    lastHit = t;
    /* The clone check has to come before the boss-range guard: the
       clone mirrors the boss across the arena, so when you are close
       enough to hit it the boss is on the far side — a range guard
       against the boss would make the copy indestructible. */
    if (clone && Math.hypot(px - clone.x, py - clone.y) < 30) {
      clone = null;
      say("* the copy comes apart. the original notices.");
      return;
    }
    if (sig > 0) { say('* not yet.'); return; }
    if (Math.hypot(px - bx, py - by) > 40) return;
    var dmg = dm.mul(F) * (vuln > 0 ? 2 : 1);
    bossHP -= dmg;
    dm.bossHit(F, bx, by, dmg);
    if (NEU.sfx && NEU.sfx.whoosh) NEU.sfx.whoosh();
    if (NEU.juice) { NEU.juice.hit('small', { dx: bx - px, dy: by - py }); NEU.juice.burst(bx, by, 7, COL.ectoHi); }
    if (bossHP <= 0 && sigDone) { win(); return; }
    /* the killing blow leaves him at 1 HP; the kill lands after the signature */
    var killing = bossHP <= 0;
    if (killing) bossHP = 1;
    var pct = bossHP / bossMax;
    if (pct <= 0.20 && phase < 3) {
      phase = 3;
      hooks.forEach(function (h) { h.free = false; });
      clone = { x: bx, y: by, t: 2 };
      say("* it makes another one of itself.");
      if (NEU.sfx && NEU.sfx.stinger) NEU.sfx.stinger(3);
      if (NEU.music && NEU.music.bossPhase) NEU.music.bossPhase('polt', phase);
    } else if (pct <= 0.50 && phase < 2) {
      phase = 2;
      hooks.forEach(function (h) { h.free = true; h.t = 1.5; });
      say("* the hooks let go.");
      if (NEU.sfx && NEU.sfx.stinger) NEU.sfx.stinger(2);
      if (NEU.music && NEU.music.bossPhase) NEU.music.bossPhase('polt', phase);
    }
    if (killing) startSig();
  }

  function win() {
    running = false; mode = 'won'; bullets = [];
    if (NEU.music && NEU.music.bossPhase) NEU.music.bossPhase('polt', -1);
    if (NEU.juice) { NEU.juice.hit('huge', { colour: '#7FE3C4' });
                     NEU.juice.burst(bx, by, 60, COL.ecto, 260); }
    if (NEU.save) NEU.save.flag('polt_dead', 1);
    if (NEU.quest) NEU.quest.mark('a4_polt');
    draw(performance.now());
    /* the shatter plays AFTER the save, so a tab closed mid-beat keeps
       the kill. Seen once, it is skippable. */
    var seen = !!(NEU.save && NEU.save.flagged && NEU.save.flagged('polt_shatter'));
    if (NEU.save) NEU.save.flag('polt_shatter', 1);
    function after() {
      if (wrap.hidden) return;
      if (msg) {
        msg.hidden = false;
        msg.innerHTML = '<b>it stops.</b><br>' +
          'it picks you up by a tooth, considers you, and throws you<br>' +
          'back through the hole you came in by.<br><small>esc</small>';
      }
      draw(performance.now());
    }
    if (NEU.juice && NEU.juice.shatter) {
      var dpr = cv.width / innerWidth;
      NEU.juice.shatter({ canvas: cv, x: bx * dpr, y: by * dpr, skippable: seen, onDone: after });
    } else after();
  }

  function startDeath() {
    running = false; dying = performance.now();
    if (dm.resetDeath) dm.resetDeath();
    if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
    requestAnimationFrame(deathStep);
  }

  function deathStep(nowMs) {
    /* the pace cap (perf.js) — skip must re-queue or the death loop dies */
    if (NEU.perf && !NEU.perf.paced(nowMs)) { requestAnimationFrame(deathStep); return; }
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
    var look = PHASE_LOOK[phase] || PHASE_LOOK[1];
    ctx.fillStyle = look.field; ctx.fillRect(AX, AY, AW, AH);
    ctx.fillStyle = look.rim;
    ctx.fillRect(AX - 3, AY - 3, AW + 6, 3); ctx.fillRect(AX - 3, AY + AH, AW + 6, 3);
    ctx.fillRect(AX - 3, AY, 3, AH); ctx.fillRect(AX + AW, AY, 3, AH);
  }

  /* a free hook about to fire: red corner brackets and a dotted aim at
     you. Static, so it reads the same under reduced motion. */
  function drawHookWarn(x, y) {
    var r = 14, L = 6, x0 = (x - r) | 0, y0 = (y - r) | 0, x1 = (x + r) | 0, y1 = (y + r) | 0;
    ctx.fillStyle = COL.red;
    ctx.fillRect(x0, y0, L, 2); ctx.fillRect(x0, y0, 2, L);
    ctx.fillRect(x1 - L, y0, L, 2); ctx.fillRect(x1 - 2, y0, 2, L);
    ctx.fillRect(x0, y1 - 2, L, 2); ctx.fillRect(x0, y1 - L, 2, L);
    ctx.fillRect(x1 - L, y1 - 2, L, 2); ctx.fillRect(x1 - 2, y1 - L, 2, L);
    var dx = px - x, dy = py - y, d = Math.hypot(dx, dy) || 1;
    for (var j = 2; j <= 8; j++)
      ctx.fillRect((x + dx / d * j * 12 - 1) | 0, (y + dy / d * j * 12 - 1) | 0, 2, 2);
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

    /* the locked charge path: the real line he will take, fading in as
       the warning runs out (game clock, so a pause holds it) */
    if (chargePath && warnAt) {
      var cp = chargePath, ramp = 1 - Math.max(0, warnAt - t) / 0.9;
      ctx.globalAlpha = 0.25 + 0.6 * ramp;
      ctx.fillStyle = COL.red;
      for (var j = 0; j <= 20; j++) {
        var u = j / 20;
        ctx.fillRect((cp.x0 + (cp.x1 - cp.x0) * u - 2) | 0, (cp.y0 + (cp.y1 - cp.y0) * u - 2) | 0, 4, 4);
      }
      ctx.globalAlpha = 1;
    }

    /* depth sort: him, the clone, four hooks */
    var things = [{ x: bx, y: by, z: bz, kind: 'body' }];
    if (clone) things.push({ x: clone.x, y: clone.y, z: 20, kind: 'clone' });
    hooks.forEach(function (h) { things.push({ x: h.x, y: h.y, z: 0, kind: 'hook', warn: h.warn }); });
    things.sort(function (a, b) { return a.z - b.z; });

    things.forEach(function (o) {
      var p = proj(o.x, o.y, o.z);
      var s = Math.max(0.5, p.k);
      if (o.kind === 'hook') {
        if (!drawSheet('hook', p.x, p.y, s * 0.5)) {
          ctx.fillStyle = COL.ecto;
          ctx.fillRect((p.x - 9 * s) | 0, (p.y - 9 * s) | 0, (18 * s) | 0, (18 * s) | 0);
        }
        if (o.warn) drawHookWarn(p.x, p.y);
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
      /* the punish window: a gold frame round him, static */
      if (o.kind === 'body' && vuln > 0 && mode !== 'won') {
        ctx.fillStyle = VULN_COL;
        var vx0 = (p.x - w / 2 - 6) | 0, vy0 = (p.y - h / 2 - 6) | 0, vw = (w + 12) | 0, vh = (h + 12) | 0;
        ctx.fillRect(vx0, vy0, vw, 2); ctx.fillRect(vx0, vy0 + vh - 2, vw, 2);
        ctx.fillRect(vx0, vy0, 2, vh); ctx.fillRect(vx0 + vw - 2, vy0, 2, vh);
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
      dm.glow(ctx, bl.x, bl.y, bl.r * 4, bl.c, 0.45);
      /* Rotated to face the way it is travelling, like the dart in the
         other fight — a spiked shot drawn straight reads as a blob. */
      if (!drawSheet(key, bl.x, bl.y, 1, null, Math.atan2(bl.vy, bl.vx))) {
        ctx.fillStyle = bl.c;
        ctx.fillRect((bl.x - bl.r) | 0, (bl.y - bl.r) | 0, sz, sz);
      }
    }

    var bp = proj(bx, by, bz);
    dm.drawFlash(ctx, F, bp.x, bp.y, 48);
    if (mode !== 'won') dm.drawFX(ctx, F, inv);
    if (NEU.juice) NEU.juice.drawParts(ctx, 1 / 60);
    if (NEU.juice) NEU.juice.end(ctx, shook);
    if (NEU.juice) NEU.juice.overlay(ctx, innerWidth, innerHeight);

    dm.hud(ctx, F, { w: innerWidth, h: innerHeight, AY: AY, AH: AH, name: 'polterghast',
                     hp: bossHP, max: bossMax, ticks: [0.5, 0.2],
                     php: hp, pmax: MAXHP, phase: phase });

    /* the label sits outside the shake, on a dark plate (AA) */
    if (vuln > 0 && mode !== 'won') {
      ctx.font = '32px "Determination Mono","Pixelify Sans",monospace';
      var lw = ctx.measureText('VULNERABLE').width || 200;
      var lx = (AX + AW / 2 - lw / 2) | 0, ly = AY + 48;
      ctx.globalAlpha = 0.85; ctx.fillStyle = '#000000';
      ctx.fillRect(lx - 8, ly - 32, (lw + 16) | 0, 44);
      ctx.globalAlpha = 1; ctx.fillStyle = VULN_COL;
      ctx.fillText('VULNERABLE', lx, ly);
    }

    if (line && nowMs - lineT < 5000) {
      ctx.fillStyle = COL.bone;
      ctx.font = '16px "Undertale Sans","Comic Sans MS",cursive';
      ctx.fillText(line, AX, AY + AH + 80);
    }
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
    /* The win screen is over: z there must not reopen the fight and
       hand the kill out a second time. */
    if (!running && !dying && mode !== 'won' && (e.key === 'Enter' || e.key === 'z' || e.key === 'Z')) { e.preventDefault(); open(); return; }
    /* z (or Enter) strikes before the soul looks at the key; x dashes.
       A held key's auto-repeat is not a strike. */
    if (e.key === 'z' || e.key === 'Z' || (e.key === 'Enter' && running)) { e.preventDefault(); if (!e.repeat) tryHit(); return; }
    if (running && dm.key(F, e)) { e.preventDefault(); return; }
    var n = dm.keyName(e); if (n) { keys[n] = true; e.preventDefault(); }
  });
  addEventListener('keyup', function (e) {
    var n = dm.keyName(e); if (n) keys[n] = false;
  });
  /* A key let go outside the tab never sends keyup, so a Shift released
     there would leave the soul slow. Losing focus drops every held key. */
  addEventListener('blur', function () { keys = {}; });

  function open() {
    wrap.hidden = false;
    NEU.activeMinigame = 'polt';        /* the room underneath must not move or take Escape */
    document.body.classList.add('is-playing');
    if (NEU.quest) NEU.quest.lock(true);
    if (msg) msg.hidden = true;
    layout();
    t = 0; lastHit = -1; hp = MAXHP; inv = 0; bullets = []; keys = {}; dying = 0;
    bossMax = 30; bossHP = bossMax; phase = 1; clone = null; mode = 'fight';
    px = AX + AW / 2; py = AY + AH - 70;
    F = dm.fight(px, py);
    bx = AX + AW / 2; by = AY + 80; bz = 0;
    charging = 0; glow = 0; nextFire = 1.4; nextCharge = 5;
    warnAt = 0; chargePath = null; vuln = 0; sig = 0; sigDone = false;
    resetHooks();
    if (NEU.music && NEU.music.bossPhase) NEU.music.bossPhase('polt', 1);
    say('* something in the wall has been listening the whole time.');
    running = true; last = performance.now();
    requestAnimationFrame(stepFn);
  }
  function close() {
    running = false; dying = 0;
    warnAt = 0; charging = 0; vuln = 0; sig = 0; chargePath = null;
    stopRise();
    if (NEU.music && NEU.music.bossPhase) NEU.music.bossPhase('polt', -1);
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
               get hooks() { return hooks.length; },
               /* what a renderer draws: the locked charge path, the punish window,
                  the signature, and each hook's telegraph */
               get state() {
                 return { vulnerable: vuln > 0, chargePath: chargePath, sig: sig > 0,
                          hooks: hooks.map(function (h) { return { x: h.x, y: h.y, warn: !!h.warn }; }) };
               },
               /* the shared feel state (core/danmaku.js), for tests */
               get feel() { return F; } };
})();
