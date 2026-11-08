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
          diagonally, charges once.            → 65%
     P2 — hooks DETACH and fire independently through walls; faster;
          spreads of 7 potent shots; charges twice.   → 35%
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
  var REDUCE_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var PLAYER_R = (dm.soul && dm.soul.R) || 3.2, IFRAMES = dm.IFRAMES || 1.1, MAXHP = 6;
  /* the shared fight feel: dash, adrenaline, rage, numbers, the HUD */
  var F = dm.fight(0, 0);

  var running = false, last = 0, t = 0, dying = 0;
  var AX = 0, AY = 0, AW = 0, AH = 0;
  var px = 0, py = 0, keys = {}, hp = MAXHP, inv = 0;
  var bullets = [], hooks = [], legs = [], attackWarns = [], attackFrameAcc = 0, kit = null, bossTarget = { kind: 'boss' }, cloneTarget = { kind: 'clone' }, phase = 1, bossHP = 900, bossMax = 900;
  var bx = 0, by = 0, bz = 0, charging = 0, glow = 0, nextFire = 0, nextCharge = 0;
  var TELE = 24 / 60;                    /* hook telegraph: 24 frames before a hook can hit */
  /* game-clock state: every timer here is advanced by the update loop, so a
     pause or a death holds it and open()/close() wipe it */
  var warnAt = 0, chargePath = null, vuln = 0, sig = 0, sigDone = false, sigRing = 0, sigSpin = 0;
  var phaseFlash = 0, phaseFlashes = 0, flashedPhase = 0;
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
    /* the kit HUD (tab 18 + box 48, 24 under the arena) must clear the
       controls hint row, which starts about 44px above the window floor */
    var over = AY + AH + 72 - (innerHeight - 44);
    if (over > 0) AH = Math.max(300, AH - over) | 0;
    arenaCache = {};
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

  function attachAttacks() {
    if (!NEU.poltAtk) return;
    NEU.poltAtk.attach({
      warn: function (shape) { attackWarns.push({ shape: shape, age: 0, life: 24 / 60 }); },
      hit: function (shape, name, speed) {
        var i, n = shape.count, a, gapAt = Math.floor(n / 2), col = name === 'DesperationAttack' || phase === 3 ? COL.red : COL.ectoHi;
        for (i = 0; i < n; i++) {
          if (shape.gap && ((i - gapAt + n) % n) < shape.gap) continue;
          if (shape.kind === 'ring') {
            a = shape.a + i * Math.PI * 2 / n;
            shot(shape.x + Math.cos(a) * shape.r, shape.y + Math.sin(a) * shape.r,
              Math.cos(a) * speed, Math.sin(a) * speed, 4, col, 1);
          } else {
            a = shape.a + (shape.kind !== 'fan' || n === 1 ? 0 : (i / (n - 1) - 0.5) * shape.spread);
            shot(shape.x, shape.y, Math.cos(a) * speed, Math.sin(a) * speed, 4, col, 1);
          }
        }
        if (name === 'CloneSplit' && !clone) clone = { x: bx, y: by, t: 2.4 };
      }
    });
  }
  function tickAttacks(dt) {
    if (!NEU.poltAtk) return;
    attackFrameAcc += dt;
    while (attackFrameAcc >= 1 / 60) {
      attackFrameAcc -= 1 / 60;
      if (NEU.poltAtk.step({ x: bx, y: by, tx: px, ty: py, ax: AX, ay: AY, aw: AW, ah: AH })) {
        sig = 0; sigDone = true; say('* it holds on. one more.');
      }
    }
    for (var i = attackWarns.length - 1; i >= 0; i--) {
      attackWarns[i].age += dt;
      if (attackWarns[i].age >= attackWarns[i].life) attackWarns.splice(i, 1);
    }
  }

  function resetHooks() {
    hooks = [];
    for (var i = 0; i < 4; i++) {
      hooks.push({ a: i * Math.PI / 2, r: 120, x: bx, y: by, t: 0,
                   free: false, warn: false });
    }
  }

  function resetLegs() {
    legs = [];
    for (var i = 0; i < 4; i++) {
      var a = Math.PI * 2 * i / 4 + Math.PI / 4;
      var p = legEdgePoint(a);
      legs.push({ a: a, foot: p, planted: true, step: 0 });
    }
  }

  function legEdgePoint(a) {
    var dx = Math.cos(a), dy = Math.sin(a), cx = AX + AW / 2, cy = AY + AH / 2;
    var tx = Math.abs(dx) < 0.001 ? Infinity : (dx > 0 ? AX + AW - 12 - cx : AX + 12 - cx) / dx;
    var ty = Math.abs(dy) < 0.001 ? Infinity : (dy > 0 ? AY + AH - 12 - cy : AY + 12 - cy) / dy;
    var d = Math.min(Math.abs(tx), Math.abs(ty));
    return { x: cx + dx * d, y: cy + dy * d };
  }

  function solveLeg(leg) {
    /* hip anchored to the ghost body: the sprite is 90x150 at s=1, so the
       mechanical root sits ~40px below centre rather than in empty space */
    var hx = bx + Math.cos(leg.a) * 30, hy = by + 40 + Math.sin(leg.a) * 34;
    var dx = leg.foot.x - hx, dy = leg.foot.y - hy, d = Math.sqrt(dx * dx + dy * dy);
    var l1 = Math.max(70, d * 0.52), l2 = Math.max(70, d * 0.52);
    var reach = Math.max(1, Math.min(l1 + l2 - 1, d));
    var along = (l1 * l1 - l2 * l2 + reach * reach) / (2 * reach);
    var side = Math.sqrt(Math.max(0, l1 * l1 - along * along));
    var ux = dx / (d || 1), uy = dy / (d || 1);
    return { hx: hx, hy: hy, kx: hx + ux * along - uy * side,
      ky: hy + uy * along + ux * side, fx: leg.foot.x, fy: leg.foot.y };
  }

  function stepLegs() {
    if (REDUCE_MOTION) return;
    for (var i = 0; i < legs.length; i++) {
      var leg = legs[i], reach = Math.hypot(leg.foot.x - bx, leg.foot.y - by);
      leg.step = Math.max(0, leg.step - 1 / 60);
      if (reach > Math.min(AW, AH) * 0.46 && leg.step <= 0) {
        leg.foot = legEdgePoint(leg.a + Math.atan2(by - (AY + AH / 2), bx - (AX + AW / 2)) * 0.12);
        leg.planted = false; leg.step = 0.22;
      }
      if (leg.step <= 0) leg.planted = true;
    }
  }

  function drawLegs() {
    ctx.lineCap = 'square'; ctx.lineJoin = 'miter';
    var i, p, pts = [];
    for (i = 0; i < legs.length; i++) pts.push(solveLeg(legs[i]));
    /* three passes: ink, steel, rim light, so a limb reads as a lit bar */
    var W = [11, 7, 2], C = ['#0A0E14', '#2B3440', '#6A7A8C'], k, o;
    for (k = 0; k < 3; k++) {
      ctx.lineWidth = W[k]; ctx.strokeStyle = C[k]; o = k === 2 ? -2 : 0;
      for (i = 0; i < pts.length; i++) {
        p = pts[i];
        ctx.beginPath(); ctx.moveTo(p.hx | 0, (p.hy + o) | 0); ctx.lineTo(p.kx | 0, (p.ky + o) | 0);
        ctx.lineTo(p.fx | 0, (p.fy + o) | 0); ctx.stroke();
      }
    }
    for (i = 0; i < pts.length; i++) {
      p = pts[i];
      ctx.fillStyle = '#0A0E14'; ctx.fillRect((p.kx - 8) | 0, (p.ky - 8) | 0, 16, 16);
      ctx.fillStyle = '#2B6A80'; ctx.fillRect((p.kx - 6) | 0, (p.ky - 6) | 0, 12, 12);
      ctx.fillStyle = '#7FE3FF'; ctx.fillRect((p.kx - 4) | 0, (p.ky - 4) | 0, 8, 8);
      ctx.fillStyle = '#E0FAFF'; ctx.fillRect((p.kx - 4) | 0, (p.ky - 4) | 0, 3, 3);
      /* the foot: a shadow, then the claw */
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect((p.fx - 9) | 0, (p.fy + 3) | 0, 18, 5);
      ctx.fillStyle = '#0A0E14'; ctx.fillRect((p.fx - 7) | 0, (p.fy - 7) | 0, 14, 14);
      ctx.fillStyle = legs[i].planted ? '#7FE3FF' : '#C4FFF0'; ctx.fillRect((p.fx - 5) | 0, (p.fy - 5) | 0, 10, 10);
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect((p.fx - 5) | 0, (p.fy - 5) | 0, 4, 4);
    }
  }

  function stepFn(nowMs) {
    if (!running) { if (dying) deathStep(nowMs); return; }
    /* legacy loop when the kernel is absent; the kernel tick owns the frame otherwise */
    if (!NEU.kernel) requestAnimationFrame(stepFn);
    if (NEU.perf && !NEU.perf.paced(nowMs)) return;
    /* the pace cap (perf.js): `last` advances on drawn frames only,
       so dt covers the skipped vsyncs */
    var dt = Math.min(0.033, (nowMs - last) / 1000); last = nowMs;
    if (NEU.juice && NEU.juice.frozen()) { draw(nowMs); return; }
    t += dt;
    if (inv > 0) inv -= dt;

    /* player; rage builds inside ~300px of his 40px strike reach */
    F.x = px; F.y = py;
    dm.move(F, keys, dt, { AX: AX, AY: AY, AW: AW, AH: AH });
    px = F.x; py = F.y;
    dm.tick(F, dt, 1 - Math.min(1, Math.max(0, Math.hypot(px - bx, py - by) - 40) / 260));
    if (kit) kit.tick(dt);
    tickAttacks(dt);

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
    stepLegs();

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
    if (phaseFlash > 0) phaseFlash = Math.max(0, phaseFlash - dt);
    /* the attack record owns the signature's hitboxes, so this timer
       does not throw a second, untelegraphed ring */
    if (sig > 0 && !NEU.poltAtk) {
      sig -= dt; sigRing -= dt;
      if (sigRing <= 0) {
        sigRing = 1.2; sigSpin += 0.26;
        for (var k = 0; k < 12; k++) {
          var sa2 = sigSpin + k * Math.PI / 6;
          shot(bx, by, Math.cos(sa2) * 170, Math.sin(sa2) * 170, 5, COL.red, 1);
        }
      }
      if (sig <= 0) { sig = 0; sigDone = true; say('* it holds on. one more.'); }
    } else if (sig > 0) {
      sig -= dt;
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
    sig = 6; sigRing = 0; sigSpin = 0;
    if (NEU.poltAtk) NEU.poltAtk.signature();
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
  function hurtRaw(dx, dy) {
    if (inv > 0 || F.dashI > 0 || (NEU.cheat && NEU.cheat.god)) return false;   /* dev `god` (dev.js) */
    hp--; inv = IFRAMES;
    dm.hurt(F, px, py - 12);
    if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
    if (NEU.juice) { NEU.juice.hit('medium', { dx: dx, dy: dy }); NEU.juice.burst(px, py, 10, COL.soul); }
    if (hp <= 0) { startDeath(); return true; }
    return false;
  }
  function hurt(dx, dy) {
    if (kit && kit.hit(1)) return false;
    return hurtRaw(dx, dy);
  }

  var STRIKE_CD = 0.18, lastHit = -1;   /* game seconds between strikes */
  function tryHit(target, amount) {
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
    if (target && target.kind === 'clone' && clone) {
      clone = null;
      say("* the copy comes apart. the original notices.");
      return;
    }
    if (sig > 0) { say('* not yet.'); return; }
    if (target ? target.kind !== 'boss' : Math.hypot(px - bx, py - by) > 40) return;
    /* Six blade damage is normalized to one boss point: 900 HP at the
       kit's 0.3 s cadence is 270 s of clean hits; movement and dodging put
       real runs near the requested 4–6 minute window. */
    var dmg = dm.mul(F) * (amount || 1) * (vuln > 0 ? 2 : 1);
    bossHP -= dmg;
    dm.bossHit(F, bx, by, dmg);
    if (NEU.sfx && NEU.sfx.hit) NEU.sfx.hit();
    if (NEU.juice) { NEU.juice.hit('small', { dx: bx - px, dy: by - py }); NEU.juice.burst(bx, by, 7, COL.ectoHi); }
    if (bossHP <= 0 && sigDone) { win(); return; }
    /* the killing blow leaves him at 1 HP; the kill lands after the signature */
    var killing = bossHP <= 0;
    if (killing) bossHP = 1;
    var pct = bossHP / bossMax;
      if (pct <= 0.35 && phase < 3) {
      phase = 3;
      pulsePhase();
      if (NEU.poltAtk) NEU.poltAtk.phase(phase);
      hooks.forEach(function (h) { h.free = false; });
      clone = { x: bx, y: by, t: 2 };
      say("* it makes another one of itself.");
      if (NEU.sfx && NEU.sfx.stinger) NEU.sfx.stinger(3);
      if (NEU.music && NEU.music.bossPhase) NEU.music.bossPhase('polt', phase);
    } else if (pct <= 0.65 && phase < 2) {
      phase = 2;
      pulsePhase();
      if (NEU.poltAtk) NEU.poltAtk.phase(phase);
      hooks.forEach(function (h) { h.free = true; h.t = 1.5; });
      say("* the hooks let go.");
      if (NEU.sfx && NEU.sfx.stinger) NEU.sfx.stinger(2);
      if (NEU.music && NEU.music.bossPhase) NEU.music.bossPhase('polt', phase);
    }
    if (killing) startSig();
  }

  function ensureTvCss() {
    if (document.getElementById('tvRestoredCss')) return;
    var s = document.createElement('style');
    s.id = 'tvRestoredCss';
    s.textContent = [
      '#tvRestored{position:fixed;top:0;left:0;right:0;bottom:0;z-index:95;display:flex;',
      'align-items:center;justify-content:center;background:#000;overflow:hidden;}',
      '#tvRestored .tvRestored__title{position:relative;z-index:2;color:#fff;letter-spacing:2px;',
      'font-family:"Determination Sans",monospace;font-size:96px;}',
      '#tvRestored .tvRestored__sheen{position:absolute;top:0;bottom:0;width:96px;left:-96px;',
      'background:linear-gradient(90deg,rgba(0,0,0,0),#F4F6FA,rgba(0,0,0,0));',
      'animation:tvSheen 2.4s steps(6) 1;}',
      '#tvRestored .tvRestored__sheen.is-still{animation:none;left:30%;opacity:.45;}',
      '#tvRestored .tvRestored__flash{position:absolute;top:0;left:0;right:0;bottom:0;background:#fff;',
      'opacity:0;animation:tvFlash .4s steps(2) 1;}',
      '@keyframes tvSheen{from{left:-96px}to{left:100%}}',
      '@keyframes tvFlash{0%{opacity:.7}100%{opacity:0}}',
      '@media (prefers-reduced-motion: reduce){',
      '#tvRestored .tvRestored__sheen{animation:none;left:30%;opacity:.45}',
      '#tvRestored .tvRestored__flash{animation:none;display:none}}'
    ].join('');
    document.head.appendChild(s);
  }
  /* Full-screen title. One flash (0.4 s, a single iteration — under 3 Hz)
     and one chrome sweep. Z or 2.5 s removes it. Reduced motion keeps a
     still highlight and skips the flash. Sits under the text box (96). */
  function showTvCard() {
    ensureTvCss();
    var old = document.getElementById('tvRestored');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var card = document.createElement('div');
    card.id = 'tvRestored';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'THE TV IS RESTORED');
    var sheen = document.createElement('div');
    sheen.className = 'tvRestored__sheen' + (REDUCE_MOTION ? ' is-still' : '');
    sheen.setAttribute('aria-hidden', 'true');
    card.appendChild(sheen);
    if (!REDUCE_MOTION) {
      var flash = document.createElement('div');
      flash.className = 'tvRestored__flash';
      flash.setAttribute('aria-hidden', 'true');
      card.appendChild(flash);
    }
    var title = document.createElement('div');
    title.className = 'tvRestored__title';
    title.style.fontFamily = '"Determination Sans", monospace';
    title.style.fontSize = '96px';
    title.textContent = 'THE TV IS RESTORED';
    card.appendChild(title);
    document.body.appendChild(card);
    var removed = false;
    function removeCard() {
      if (removed) return;
      removed = true;
      removeEventListener('keydown', onZ);
      if (card.parentNode) card.parentNode.removeChild(card);
    }
    function onZ(e) {
      if (e.key === 'Enter' || e.key === 'z' || e.key === 'Z') { e.preventDefault(); removeCard(); }
    }
    addEventListener('keydown', onZ);
    /* a boot that loaded the kernel after DOMContentLoaded never started the loop */
    if (NEU.kernel && !NEU.kernel.rafId && NEU.kernel.start) NEU.kernel.start();
    if (NEU.kernel && NEU.kernel.after) NEU.kernel.after(2500, removeCard);
  }

  function win() {
    running = false; mode = 'won'; bullets = [];
    if (NEU.music && NEU.music.bossPhase) NEU.music.bossPhase('polt', -1);
    if (NEU.juice) { NEU.juice.hit('huge', { colour: '#7FE3C4' });
                     NEU.juice.burst(bx, by, 60, COL.ecto, 260); }
    if (NEU.save) NEU.save.flag('polt_dead', 1);
    if (NEU.save) NEU.save.flag('tv_restored', 1);
    if (NEU.restoreTV) NEU.restoreTV();
    showTvCard();
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
  }

  function deathStep(nowMs) {
    if (NEU.perf && !NEU.perf.paced(nowMs)) { requestAnimationFrame(deathStep); return; }
    var ms = nowMs - dying;
    ctx.fillStyle = COL.void_; ctx.fillRect(0, 0, innerWidth, innerHeight);
    frame();
    var playing = dm.death ? dm.death(ctx, px, py, ms, COL.soul) : (ms <= 1700);
    if (playing && ms < 900 && NEU.fxBurst) NEU.fxBurst(ctx, 'fxGigBoomV', px, py, ms / 900, 2.2);
    if (!playing) {
      dying = 0;
      if (msg) { msg.hidden = false;
        msg.innerHTML = '<b>it waits.</b><br>enter to try again &middot; esc to leave'; }
      return;
    }
    if (!NEU.kernel) requestAnimationFrame(deathStep);
  }

  /* ── the real art ───────────────────────────────────────────────
     Three files, identical geometry: body, glowmask, second glowmask.
     Stacked — body normal, glows ADDITIVE — which is how the phase
     changes read without a single new sprite. Missing art draws
     magenta rather than nothing; a silently absent sprite gets
     mistaken for a logic bug and costs an hour. */
  /* One blitter for the whole site, in data/sheets.js. The local copy
     this replaces was the third of three identical image caches. */
  function drawSheet(key, x, y, scale, glowKeys, rot, frame) {
    if (!NEU.sheetDraw) return false;
    return NEU.sheetDraw(ctx, key, x, y, {
      scale: scale, glowKeys: glowKeys, rot: rot, frame: frame, now: performance.now()
    });
  }

  /* one white frame per phase (0.4 s, under 3 Hz). Reduced motion
     keeps the palette change and skips the flash. */
  function pulsePhase() {
    if (flashedPhase === phase) return;
    flashedPhase = phase;
    if (REDUCE_MOTION) return;
    phaseFlash = 0.4;
    phaseFlashes += 1;
  }

  /* ── the bottom chamber ─────────────────────────────────────────
     Baked once per phase and size into an offscreen canvas; a frame is
     one drawImage plus the live fog, drips and torches. Ramps are 5 steps,
     light from the upper left: a bright top-left bevel, a dark
     bottom-right one, mortar in the darkest tone. */
  var arenaCache = {}, tints = {};
  var RAMPS = {
    1: { w: ['#0B1024', '#141C3A', '#24325C', '#2B3A67', '#3E5490'], lip: '#6A82C4',
         fl: ['#1A2A6A', '#3E6AD0', '#8AB4FF', '#E0F0FF'], lt: '#3E6AD0' },
    2: { w: ['#0B1024', '#141C3A', '#24325C', '#2B3A67', '#3E5490'], lip: '#7FE3C4',
         fl: ['#0A4020', '#2FA06A', '#7FE3C4', '#E0FFF4'], lt: '#7FE3C4' },
    3: { w: ['#12061A', '#1E0A1E', '#4A1848', '#602050', '#8A2A6A'], lip: '#C0508C',
         fl: ['#5A0A1E', '#C02A4A', '#FF7A8A', '#FFE0E0'], lt: '#E04A6B' }
  };
  function hsh(x, y, s) {
    var h = (x * 374761393 + y * 668265263 + (s || 0) * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function mkc(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
    return c;
  }
  /* a stepped pixel ellipse, 2px rows */
  function ell(g, cx, cy, rx, ry, col, a) {
    g.globalAlpha = a; g.fillStyle = col;
    for (var y = -ry; y < ry; y += 2) {
      var k = 1 - ((y + 1) * (y + 1)) / (ry * ry), hw = k > 0 ? Math.round(rx * Math.sqrt(k)) : 0;
      if (hw > 0) g.fillRect((cx - hw) | 0, (cy + y) | 0, hw * 2, 2);
    }
    g.globalAlpha = 1;
  }
  function bakeArena(ph) {
    var W = AW | 0, H = AH | 0, c = mkc(W, H), g = c.getContext && c.getContext('2d');
    if (!g) return null;
    g.imageSmoothingEnabled = false;
    var P = RAMPS[ph] || RAMPS[1], w = P.w, FLOOR = H - 44, x, y, row, k, h, tone;
    function R(x0, y0, ww, hh, col) { g.fillStyle = col; g.fillRect(x0, y0, ww, hh); }
    function A(x0, y0, ww, hh, col, a) { g.globalAlpha = a; g.fillStyle = col; g.fillRect(x0, y0, ww, hh); g.globalAlpha = 1; }
    R(0, 0, W, H, w[2]);
    /* running-bond bricks 32x16, mortar darkest, tone by hash */
    for (row = 0, y = 0; y < FLOOR; y += 16, row++) {
      for (x = (row & 1) ? -16 : 0; x < W; x += 32) {
        h = hsh(x, row, ph); tone = h < 0.3 ? 1 : h < 0.62 ? 2 : 3;
        R(x, y, 32, 16, w[0]);
        R(x + 1, y + 1, 30, 14, w[tone]);
        R(x + 1, y + 1, 30, 2, w[tone + 1]); R(x + 1, y + 1, 2, 14, w[tone + 1]);
        R(x + 1, y + 13, 30, 2, w[tone - 1]); R(x + 29, y + 1, 2, 14, w[tone - 1]);
        if (h > 0.95) { R(x + 9 + ((h * 997) & 7), y + 4, 2, 5, w[tone - 1]); R(x + 11 + ((h * 997) & 7), y + 9, 2, 3, w[tone - 1]); }
      }
    }
    /* a soft light pool behind where the boss hangs: the focal point */
    ell(g, W >> 1, (H * 0.38) | 0, 220, 130, P.lt, 0.035);
    ell(g, W >> 1, (H * 0.38) | 0, 150, 90, P.lt, 0.04);
    ell(g, W >> 1, (H * 0.38) | 0, 80, 50, P.lt, 0.05);
    /* wall falls into shadow toward the edges: 6 stepped bands per side */
    for (k = 0; k < 6; k++) {
      var d = (6 - k) * 16;
      A(0, 0, W, d, '#000000', 0.08); A(0, FLOOR - d, W, d, '#000000', 0.08);
      A(0, 0, d, FLOOR, '#000000', 0.08); A(W - d, 0, d, FLOOR, '#000000', 0.08);
    }
    /* two pillars, a quarter in from each side */
    for (k = 1; k <= 3; k += 2) {
      var px = ((W * k / 4) | 0) - 12;
      A(px + 24, 0, 12, FLOOR, '#000000', 0.22); A(px + 36, 0, 8, FLOOR, '#000000', 0.12);
      R(px, 0, 24, FLOOR, w[1]); R(px, 0, 4, FLOOR, w[4]); R(px + 4, 0, 10, FLOOR, w[3]);
      R(px + 14, 0, 6, FLOOR, w[2]); R(px + 20, 0, 4, FLOOR, w[0]);
      for (y = 48; y < FLOOR - 24; y += 64) { R(px - 2, y, 28, 5, w[3]); R(px - 2, y, 28, 2, w[4]); R(px - 2, y + 5, 28, 2, w[0]); }
      R(px - 4, 0, 32, 14, w[3]); R(px - 4, 0, 32, 3, w[4]); R(px - 4, 14, 32, 4, w[0]);
      R(px - 4, FLOOR - 14, 32, 14, w[3]); R(px - 4, FLOOR - 14, 32, 3, w[4]); R(px + 24, FLOOR - 14, 4, 14, w[0]);
      /* the iron sconce the flame sits on, and the light it throws */
      var sy = (H * 0.30) | 0;
      ell(g, px + 12, sy - 12, 76, 56, P.lt, 0.05); ell(g, px + 12, sy - 12, 46, 34, P.lt, 0.05);
      R(px + 4, sy, 16, 6, '#0A0E14'); R(px + 6, sy - 8, 12, 8, '#2A2A34'); R(px + 6, sy - 8, 12, 2, '#5A5A6A');
    }
    /* the floor: flagstones, a lit lip, and the wall's contact shadow */
    R(0, FLOOR, W, H - FLOOR, w[1]);
    for (x = 0; x < W; x += 64) {
      tone = hsh(x, 9, ph) < 0.5 ? 1 : 2;
      R(x, FLOOR + 6, 64, 16, w[tone]); R(x, FLOOR + 22, 64, H - FLOOR - 22, w[tone === 1 ? 2 : 1]);
      R(x, FLOOR + 6, 64, 2, w[3]); R(x, FLOOR + 22, 64, 2, w[3]);
      R(x, FLOOR + 6, 2, H - FLOOR - 6, w[0]); R(x + 62, FLOOR + 6, 2, H - FLOOR - 6, w[0]);
    }
    R(0, FLOOR + 22, W, 2, w[0]);
    R(0, FLOOR, W, 6, w[4]); R(0, FLOOR, W, 2, P.lip); R(0, FLOOR + 6, W, 2, w[0]);
    A(0, FLOOR - 8, W, 8, '#000000', 0.18); A(0, FLOOR - 4, W, 4, '#000000', 0.18);
    A(0, H - 10, W, 10, '#000000', 0.2);
    /* inner shadow under the rim */
    A(0, 0, W, 1, '#000000', 0.4); A(0, H - 1, W, 1, '#000000', 0.4);
    A(0, 0, 1, H, '#000000', 0.4); A(W - 1, 0, 1, H, '#000000', 0.4);
    return c;
  }
  function arenaImg() {
    var key = phase + ':' + (AW | 0) + 'x' + (AH | 0);
    if (!(key in arenaCache)) arenaCache[key] = bakeArena(phase);
    return arenaCache[key];
  }

  /* the live layer: torch flames, P2 ecto fog and wisps, P3 blood drips.
     Rects only; every motion is a pure function of the game clock `t`,
     so a pause holds it, and reduced motion freezes it at t = 0. */
  function liveArena() {
    var tt = REDUCE_MOTION ? 0 : t, W = AW | 0, H = AH | 0, i, x, a, y;
    var P = RAMPS[phase] || RAMPS[1], RA = NEU.roomArt;
    if (RA && RA.flame) {
      for (i = 1; i <= 3; i += 2) {
        var fx = AX + ((W * i / 4) | 0), fy = AY + ((H * 0.30) | 0) - 8;
        RA.flame(ctx, fx, fy, 1, 3, performance.now(), i, P.fl);
      }
    }
    if (phase === 2) {
      var fogBase = '#158039', fogTop = '#7FE3C4';
      ctx.fillStyle = fogBase; ctx.globalAlpha = 0.22;
      for (x = 0; x < W; x += 64) {
        y = H - 18 - (((Math.sin((x + tt * 8) * 0.03) + 1) * 4) | 0);
        ctx.fillRect(AX + x, AY + y, Math.min(64, W - x), H - y);
      }
      ctx.fillStyle = fogTop;
      for (var band = 0; band < 2; band++) {
        ctx.globalAlpha = band ? 0.06 : 0.10;
        var base = H - (band ? 40 : 72), amp = band ? 5 : 8;
        for (x = 0; x < W; x += 16) {
          y = base + Math.round(Math.sin((x + tt * 8 * (band ? -1 : 1)) * 0.022 + band * 2) * amp);
          ctx.fillRect(AX + x, AY + y, Math.min(16, W - x), H - y);
        }
      }
      ctx.fillStyle = '#C4FFF0';
      for (i = 0; i < 12; i++) {
        var rise = (tt * 20 + hsh(i, 1, 7) * 96) % 96;
        ctx.globalAlpha = 0.5 * (1 - rise / 96);
        ctx.fillRect(AX + ((hsh(i, 2, 7) * (W - 8)) | 0), AY + H - 12 - rise, 2, 6);
      }
      ctx.globalAlpha = 1;
    } else if (phase === 3) {
      for (i = 0; i < 9; i++) {
        var len = 6 + ((((tt / 0.4) | 0) + i * 5) % 9);
        x = AX + 24 + ((hsh(i, 3, 9) * (W - 48)) | 0);
        ctx.fillStyle = '#8C2F4A'; ctx.fillRect(x, AY, 2, len);
        ctx.fillStyle = '#C0507A'; ctx.fillRect(x - 1, AY + len, 4, 2);
      }
    }
  }
  function frame() {
    var look = PHASE_LOOK[phase] || PHASE_LOOK[1], a = arenaImg();
    /* the phase field is always painted; the baked wall sits on top of it */
    ctx.fillStyle = look.field; ctx.fillRect(AX | 0, AY | 0, AW | 0, AH | 0);
    if (a) ctx.drawImage(a, AX | 0, AY | 0);
    ctx.fillStyle = look.rim;
    ctx.fillRect(AX - 3, AY - 3, AW + 6, 3); ctx.fillRect(AX - 3, AY + AH, AW + 6, 3);
    ctx.fillRect(AX - 3, AY, 3, AH); ctx.fillRect(AX + AW, AY, 3, AH);
  }

  /* baked tint of one sheet frame: the silhouette flooded with a colour
     (source-atop keeps the alpha), cached per frame and colour. The clone
     is red, the punish window gold, the charge warning red. */
  function tinted(key, fr, col, al) {
    var sh = NEU.sheets && NEU.sheets[key], im = NEU.sheetReady && NEU.sheetReady(sh);
    if (!im) return null;
    var k = key + fr + col + al, c = tints[k];
    if (c) return c;
    c = mkc(sh.fw, sh.fh);
    var g = c.getContext && c.getContext('2d');
    if (!g) return null;
    g.imageSmoothingEnabled = false;
    g.drawImage(im, 0, fr * sh.fh, sh.fw, sh.fh, 0, 0, sh.fw, sh.fh);
    g.globalCompositeOperation = 'source-atop'; g.globalAlpha = al; g.fillStyle = col;
    g.fillRect(0, 0, sh.fw, sh.fh);
    tints[k] = c;
    return c;
  }
  function putTint(c, x, y, s, dx, dy) {
    if (!c) return;
    var w = (c.width * s) | 0, h = (c.height * s) | 0;
    ctx.drawImage(c, Math.round(x) - (w >> 1) + (dx || 0), Math.round(y) - (h >> 1) + (dy || 0), w, h);
  }
  var OFS = [[-2, 0], [2, 0], [0, -2], [0, 2]];
  function outline(c, x, y, s) { for (var i = 0; i < 4; i++) putTint(c, x, y, s, OFS[i][0], OFS[i][1]); }

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
    liveArena();

    /* chains first, behind everything */
    drawLegs();
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
        var p1 = proj(bx, by + 40, bz), p2 = proj(hooks[i].x, hooks[i].y, 0);
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
    for (var awi = 0; awi < attackWarns.length; awi++) {
      var ash = attackWarns[awi].shape, ap = REDUCE_MOTION ? 1 : (NEU.poltAtk && NEU.poltAtk.bump
        ? NEU.poltAtk.bump(attackWarns[awi].age / attackWarns[awi].life, 0, 0.08, 0.27, 0.75)
        : 1 - attackWarns[awi].age / attackWarns[awi].life);
      ctx.globalAlpha = Math.max(0, ap);
      ctx.fillStyle = phase === 3 ? COL.red : COL.ectoHi;
      var lines = ash.lines && ash.lines.length ? ash.lines : [{ x: ash.x, y: ash.y, a: ash.a, len: ash.len || 200 }];
      for (var li = 0; li < lines.length; li++) {
        var ln = lines[li], x1 = ln.x + Math.cos(ln.a) * ln.len, y1 = ln.y + Math.sin(ln.a) * ln.len;
        var dots = Math.max(2, Math.min(24, (ln.len / 32) | 0));
        for (var s = 0; s <= dots; s++) {
          var u = s / dots;
          ctx.fillRect((ln.x + (x1 - ln.x) * u - 1) | 0, (ln.y + (y1 - ln.y) * u - 1) | 0, 2, 2);
        }
        ctx.fillRect((ln.x - 2) | 0, (ln.y - 2) | 0, 4, 4);
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
        if (!drawSheet('hook', Math.round(p.x), Math.round(p.y), s * 0.8, null, 0, REDUCE_MOTION ? 0 : undefined)) {
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
      var w = 90 * s, h = 150 * s, bxp = Math.round(p.x), byp = Math.round(p.y);
      var fr = REDUCE_MOTION ? 0 : ((nowMs / 100) | 0) % 12;
      var isBody = o.kind === 'body';
      /* a shadow on the floor under him, then a halo behind him */
      if (isBody) {
        var gy = AY + AH - 30, sh = 1 - Math.min(0.5, Math.abs(gy - byp) / 600);
        ctx.fillStyle = '#000000'; ctx.globalAlpha = 0.16;
        ctx.fillRect(bxp - ((34 * sh) | 0), gy - 2, (68 * sh) | 0, 8);
        ctx.fillRect(bxp - ((22 * sh) | 0), gy, (44 * sh) | 0, 4);
        ctx.globalAlpha = 1;
      }
      if (dm.glow) dm.glow(ctx, bxp, byp, o.kind === 'clone' ? 84 : 96, o.kind === 'clone' ? COL.red : COL.ecto, phase >= 2 ? 0.34 : 0.26);
      /* the punish window: a 2px gold outline of the sprite itself */
      if (isBody && vuln > 0 && mode !== 'won') outline(tinted('polter', fr, VULN_COL, 1), bxp, byp, s);
      /* about to charge: the same silhouette in red, fading out */
      if (o.kind === 'body' && glow > 0) {
        ctx.globalAlpha = Math.min(1, glow);
        outline(tinted('polter', fr, COL.red, 1), bxp, byp, s);
        ctx.globalAlpha = 1;
      }
      var drew = drawSheet('polter', bxp, byp, s * 1.0, glows, 0, fr);
      /* the clone is the same body, flooded red by a baked copy */
      if (o.kind === 'clone' && drew) putTint(tinted('polter', fr, COL.red, 0.5), bxp, byp, s);
      if (drew) return;
      ctx.fillStyle = o.kind === 'clone' ? '#5A2A3E' : '#1E3A44';
      ctx.fillRect((p.x - w / 4) | 0, (p.y - h / 4) | 0, (w / 2) | 0, (h / 2) | 0);
      ctx.fillStyle = o.kind === 'clone' ? COL.red : COL.ecto;
      ctx.fillRect((p.x - w / 4 + 4) | 0, (p.y - h / 4 + 4) | 0, (w / 2 - 8) | 0, (h / 2 - 8) | 0);
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

    if (kit) kit.draw(ctx);
    dm.hud(ctx, F, { w: innerWidth, h: innerHeight, AY: AY, AH: AH, name: 'polterghast',
                     hp: bossHP, max: bossMax, ticks: [0.5, 0.2],
                     php: hp, pmax: MAXHP, phase: phase });

    /* the label sits outside the shake and outside the arena: on the
       boss-bar row, right-aligned under the bar, on a dark plate (AA) */
    if (mode !== 'won' && (running || vuln > 0)) {
      var isV = vuln > 0, lt = isV ? 'VULNERABLE' : 'INVULNERABLE';
      var lbw = dm.barW ? dm.barW(innerWidth) : 480, lbx = ((innerWidth - lbw) / 2) | 0;
      /* 32px: the punish window is the one moment to read at a glance */
      ctx.font = '32px "Determination Mono","Pixelify Sans",monospace';
      ctx.textBaseline = 'top'; ctx.textAlign = 'right';
      var lw = ctx.measureText(lt).width || 160;
      ctx.globalAlpha = 0.85; ctx.fillStyle = '#000000';
      ctx.fillRect((lbx + lbw - lw - 8) | 0, 50, (lw + 16) | 0, 40);
      ctx.globalAlpha = 1; ctx.fillStyle = isV ? VULN_COL : COL.dim;
      ctx.fillText(lt, lbx + lbw, 57, innerWidth);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }

    if (phaseFlash > 0 && !REDUCE_MOTION) {
      ctx.globalAlpha = Math.min(0.7, phaseFlash / 0.4);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, innerWidth, innerHeight);
      ctx.globalAlpha = 1;
    }

    if (line && nowMs - lineT < 5000) {
      var ty = (AY - 16) | 0;
      var hudTop = Math.min(AY + AH + 24, innerHeight - 52) | 0;
      if (ty + 16 > hudTop) ty = (hudTop - 16) | 0;
      if (ty < 32) ty = 32;
      ctx.fillStyle = COL.bone;
      ctx.font = '16px "Undertale Sans","Comic Sans MS",cursive';
      ctx.textBaseline = 'top';
      ctx.fillText(line, AX, ty, Math.min(AW, innerWidth));
      ctx.textBaseline = 'alphabetic';
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
    if (running && kit && (e.key === 'z' || e.key === 'Z' || e.key === 'c' || e.key === 'C')) {
      e.preventDefault(); if (!e.repeat) kit.keydown(e.key); return;
    }
    if (running && kit && kit.stripOpen && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Up' || e.key === 'Down')) {
      e.preventDefault(); kit.keydown(e.key); return;
    }
    if ((e.key === 'Enter' || e.key === 'z' || e.key === 'Z') && running) { e.preventDefault(); if (!e.repeat) tryHit(); return; }
    if (running && dm.key(F, e)) { e.preventDefault(); return; }
    var n = dm.keyName(e); if (n) { keys[n] = true; e.preventDefault(); }
  });
  addEventListener('keyup', function (e) {
    if (kit && running) kit.keyup(e.key);
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
    t = 0; lastHit = -1; hp = MAXHP; inv = 0; bullets = []; attackWarns = []; attackFrameAcc = 0; keys = {}; dying = 0;
    bossMax = 900; bossHP = bossMax; phase = 1; clone = null; mode = 'fight';
    phaseFlash = 0; phaseFlashes = 0; flashedPhase = 0;
    px = AX + AW / 2; py = AY + AH - 70;
    F = dm.fight(px, py);
    kit = NEU.kit ? NEU.kit.create({ F: F, box: { AX: AX, AY: AY, AW: AW, AH: AH }, adapter: {
      targets: function () {
        bossTarget.x = bx; bossTarget.y = by; bossTarget.r = 22;
        var out = [bossTarget];
        if (clone) { cloneTarget.x = clone.x; cloneTarget.y = clone.y; cloneTarget.r = 22; out.push(cloneTarget); }
        return out;
      },
      damage: function (target, n) { tryHit(target, Math.max(1, Math.round(n / 6))); },
      hurtPlayer: function (n) { hurtRaw(0, 0); }
    } }) : null;
    bx = AX + AW / 2; by = AY + 80; bz = 0;
    charging = 0; glow = 0; nextFire = 1.4; nextCharge = 5;
    warnAt = 0; chargePath = null; vuln = 0; sig = 0; sigDone = false;
    resetHooks();
    resetLegs();
    attachAttacks();
    if (NEU.poltAtk) NEU.poltAtk.start(phase, false);
    pulsePhase();
    if (NEU.music && NEU.music.bossPhase) NEU.music.bossPhase('polt', 1);
    say('* something in the wall has been listening the whole time.');
    running = true; last = performance.now();
    if (!NEU.kernel) requestAnimationFrame(stepFn);
    if (NEU.kernel) NEU.kernel.push('polt');
  }
  function close() {
    running = false; dying = 0;
    if (NEU.kernel && NEU.kernel.current() === 'polt') NEU.kernel.pop();
    warnAt = 0; charging = 0; vuln = 0; sig = 0; chargePath = null;
    stopRise();
    if (NEU.poltAtk) NEU.poltAtk.reset();
    if (NEU.music && NEU.music.bossPhase) NEU.music.bossPhase('polt', -1);
    if (NEU.activeMinigame === 'polt') NEU.activeMinigame = null;
    wrap.hidden = true;
    document.body.classList.remove('is-playing');
    if (NEU.quest) NEU.quest.lock(false);
    if (!(NEU.save && NEU.save.flagged('polt_dead')) && NEU.crack && NEU.crack.reset) {
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

  if (NEU.kernel) NEU.kernel.register('polt', {
    tick: function (dt) { stepFn(performance.now()); },
    open: open, close: close,
    running: function () { return running || !!dying; }
  });

  NEU.polt = { open: open, close: close, win: win,
               get running() { return running; },
               get phase() { return phase; },
               get hp() { return bossHP; },
               get clone() { return !!clone; },
               get hooks() { return hooks.length; },
               /* what a renderer draws: the locked charge path, the punish window,
                  the signature, and each hook's telegraph */
               get state() {
                 return { vulnerable: vuln > 0, chargePath: chargePath, sig: sig > 0,
                          attack: NEU.poltAtk ? NEU.poltAtk.current() : null,
                          flashes: phaseFlashes, warns: attackWarns.length, shots: bullets.length,
                          hooks: hooks.map(function (h) { return { x: h.x, y: h.y, warn: !!h.warn }; }) };
               },
               /* the shared feel state (core/danmaku.js), for tests */
               get feel() { return F; } };
})();
