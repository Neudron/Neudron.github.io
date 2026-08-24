/* scal-worm.js — the Sepulcher, as a self-contained stage prop.
   ───────────────────────────────────────────────────────────────────
   The mod's worm deals NO contact damage (SepulcherHead.cs sets
   NPC.damage = 0) — it is scenery she hides behind. So this module
   owns ONLY movement, the trail, the act machine, its darts and the
   drawing. Nothing here touches the player's hearts: the fight drives
   tick()/tickDarts() and decides what the callbacks mean. Integration
   lives in boss-scal.js; this file never reaches into it.

   THE TRAIL IS DISTANCE-GATED, NOT VELOCITY-GATED. The old worm's
   beads separated on every dash because samples were only recorded
   while the head was slow. Here any 4px of travel leaves a sample,
   dash or drift, and segments are walked out along the recorded path
   by arc length — consecutive sample to consecutive sample — so the
   chain cannot chord-jump, stretch or gap.                        */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};

  /* ── tuning ────────────────────────────────────────────────────── */
  var SEG_COUNT   = 21;    // 20 body beads + 1 tail
  var SEG_SPACING = 34;    // px of trail arc between beads
  var SEG_SCALE   = 0.55;  // body art is ~72-82px tall; overlap wanted
  var TRAIL_STEP  = 4;     // min head travel per recorded sample
  var TRAIL_MAX   = 400;

  var CHASE_SPEED  = 150;  // px/s toward the orbit point
  var ORBIT_R      = 90;
  var WITHDRAW_SPD = 320;  // sprint to the launch edge during telegraph
  var DASH_SPEED   = 420;
  var COIL_SPEED   = 300;

  var COIL_TURN = 2.2;                 // rad/s
  var COIL_R0   = 220, COIL_R1 = 40;   // spiral radius shrinks 220 -> 40
  var COIL_T    = 8;
  var COIL_HARD = 9;                   // absolute exit ceiling

  var DASH_SWEEPS = 3;                 // left edge, right edge, left edge
  var DASH_HARD   = 12;                // absolute ceiling on the dash step
  var EDGE_INSET  = 30;

  var DART_SPEED = 180, DART_ACC = 120, DART_CAP = 300, DART_R = 4;
  var DART_EVERY = 0.3;   /* spectacle, not a wall — one volley per
                             third-second keeps the spray dodgeable */
  var GRAZE_R = 28, HIT_PAD = 8, CULL = 48;

  /* the repeating routine. dash carries no t — it ends on arrival. */
  var SCRIPT = [
    { act: 'chase',     t: 6   },
    { act: 'telegraph', t: 0.5 },
    { act: 'dash'              },
    { act: 'recover',   t: 0.8 },
    { act: 'chase',     t: 6   },
    { act: 'coil',      t: 8   }
  ];

  var HALF_PI = Math.PI / 2;

  /* ── state ─────────────────────────────────────────────────────── */
  var ctx = null;
  var AX = 0, AY = 0, AW = 640, AH = 480;
  var targetFn = null;
  var plX = 0, plY = 0;

  var spawned = false;
  var head = { x: 0, y: 0, vx: 0, vy: 0 };
  var trail = [];          // oldest .. newest (newest hugs the head)
  var beads = [];          // rebuilt each tick: [{x, y, rot}] x 21
  var darts = [];

  var stepIdx = 0, stepT = 0, actName = '';
  var orbitAng = 0.7;

  var sweepIdx = 0;                        // which crossing we're on
  var dashFrom = { x: 0, y: 0 }, dashTo = { x: 0, y: 0 };
  var dashDirX = 1, dashDirY = 0;
  var dashElapsed = 0, dartCd = 0, dartSide = 1;
  var dashNear = false, dashFired = false; // per-dash-step latches

  var coilAng = 0, coilElapsed = 0;

  /* ── helpers ───────────────────────────────────────────────────── */
  function dist(ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function tgt() {
    var p = targetFn ? targetFn() : null;
    if (!p || typeof p.x !== 'number' || typeof p.y !== 'number')
      p = { x: AX + AW / 2, y: AY + AH / 2 };
    return p;
  }

  /* one blitter call site, mirroring boss-scal's local sprite() */
  function sprite(key, x, y, scale, rot, frame, now) {
    if (!NEU.sheetDraw || !ctx) return false;
    return NEU.sheetDraw(ctx, key, x, y, {
      scale: scale, rot: rot, frame: frame, now: now
    });
  }
  function rect(x, y, r, col) {
    ctx.fillStyle = col;
    ctx.fillRect((x - r) | 0, (y - r) | 0, r * 2, r * 2);
  }

  /* ── act machine ───────────────────────────────────────────────── */
  function enterStep(i) {
    stepIdx = i % SCRIPT.length;
    var st = SCRIPT[stepIdx];
    actName = st.act;
    stepT = st.t || 0;
    if (actName === 'telegraph') {
      sweepIdx = 0;
      dashNear = false;
      dashFired = false;
      dashElapsed = 0;
      dartCd = 0;
    } else if (actName === 'coil') {
      var p = tgt();
      coilAng = Math.atan2(head.y - p.y, head.x - p.x);
      coilElapsed = 0;
    }
  }

  /* aim a crossing: start at the alternating edge (or wherever the
     head actually is when the dash begins), pass through the target,
     run past the far wall so every sweep fully crosses. */
  function planSweep(fromHead) {
    var p = tgt();
    var fx = ((sweepIdx % 2) === 0) ? AX + EDGE_INSET : AX + AW - EDGE_INSET;
    var fy = clamp(p.y, AY + EDGE_INSET, AY + AH - EDGE_INSET);
    if (fromHead) { fx = head.x; fy = head.y; }
    dashFrom.x = fx;
    dashFrom.y = fy;
    var dx = clamp(p.x, AX + 20, AX + AW - 20) - fx;
    var dy = clamp(p.y, AY + 20, AY + AH - 20) - fy;
    var L = Math.sqrt(dx * dx + dy * dy) || 1;
    var ext = AW + 140;
    dashDirX = dx / L;
    dashDirY = dy / L;
    dashTo.x = fx + dashDirX * ext;
    dashTo.y = fy + dashDirY * ext;
  }

  function steer(gx, gy, speed, k) {
    var dx = gx - head.x, dy = gy - head.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    var wx = 0, wy = 0;
    if (d > 0.001) { wx = dx / d * speed; wy = dy / d * speed; }
    head.vx += (wx - head.vx) * k;
    head.vy += (wy - head.vy) * k;
  }
  function integrate(dt) {
    head.x = clamp(head.x + head.vx * dt, AX + 10, AX + AW - 10);
    head.y = clamp(head.y + head.vy * dt, AY + 10, AY + AH - 10);
  }

  function land() {
    var lx = clamp(dashTo.x, AX + 8, AX + AW - 8);
    var ly = clamp(dashTo.y, AY + 8, AY + AH - 8);
    if (NEU.juice) {
      NEU.juice.hit('large');
      NEU.juice.burst(lx, ly, 18, '#FF6B4A');
    }
  }

  /* while dashing every 4th bead throws a dart out sideways, the
     whole volley alternating sides, throttled to one window per
     DART_EVERY seconds. Perpendicular to the chain is the bead's own
     rot axis. */
  function emitDarts(dt) {
    dartCd -= dt;
    if (dartCd > 0) return;
    dartCd = DART_EVERY;
    dartSide = -dartSide;
    for (var i = 3; i < SEG_COUNT - 1; i += 4) {
      var b = beads[i];
      if (!b) continue;
      var ang = b.rot + (dartSide > 0 ? 0 : Math.PI);
      darts.push({
        x: b.x, y: b.y,
        vx: Math.cos(ang) * DART_SPEED,
        vy: Math.sin(ang) * DART_SPEED,
        r: DART_R
      });
    }
  }

  /* ── trail + segments ──────────────────────────────────────────── */
  function recordTrail() {
    var n = trail.length;
    if (!n) { trail.push({ x: head.x, y: head.y }); return; }
    var lt = trail[n - 1];
    var dx = head.x - lt.x, dy = head.y - lt.y;
    if (dx * dx + dy * dy >= TRAIL_STEP * TRAIL_STEP) {
      trail.push({ x: head.x, y: head.y });
      if (trail.length > TRAIL_MAX) trail.shift();
    }
  }

  /* walk the trail newest -> oldest, consecutive sample to
     consecutive sample, dropping a bead every 34px of arc. */
  function rebuildBeads() {
    beads.length = 0;
    var hx = head.x, hy = head.y;
    var px = hx, py = hy;
    var acc = 0, need = SEG_SPACING, k = 0, i;
    for (i = trail.length - 2; i >= 0 && k < SEG_COUNT; i--) {
      var sx = trail[i].x, sy = trail[i].y;
      var dx = px - sx, dy = py - sy;
      var d = Math.sqrt(dx * dx + dy * dy);
      while (acc + d >= need && k < SEG_COUNT) {
        var t = d > 1e-6 ? (need - acc) / d : 0;
        beads.push({ x: px - dx * t, y: py - dy * t, rot: 0 });
        k++;
        need += SEG_SPACING;
      }
      acc += d;
      px = sx;
      py = sy;
    }
    /* trail shorter than the chain (only possible pre-seed): extend
       dead straight so it still renders whole */
    while (k < SEG_COUNT) {
      var ref = k ? beads[k - 1] : { x: hx, y: hy };
      var ex = ref.x - hx, ey = ref.y - hy;
      var el = Math.sqrt(ex * ex + ey * ey) || 1;
      beads.push({ x: ref.x + ex / el * SEG_SPACING,
                   y: ref.y + ey / el * SEG_SPACING, rot: 0 });
      k++;
    }
    for (i = 0; i < beads.length; i++) {
      var prev = i ? beads[i - 1] : head;
      beads[i].rot = Math.atan2(prev.y - beads[i].y,
                                prev.x - beads[i].x) + HALF_PI;
    }
  }

  function seedTrail(x, y) {
    trail.length = 0;
    for (var d = SEG_COUNT * SEG_SPACING; d > 0; d -= TRAIL_STEP)
      trail.push({ x: x - d, y: y });
    trail.push({ x: x, y: y });
  }

  /* ── main tick ─────────────────────────────────────────────────── */
  function tick(dt) {
    if (!spawned || !(dt > 0)) return;
    dt = Math.min(dt, 0.05);
    var st = SCRIPT[stepIdx];
    var p;

    if (st.act === 'chase') {
      orbitAng += dt * 1.5;
      p = tgt();
      steer(p.x + Math.cos(orbitAng) * ORBIT_R,
            p.y + Math.sin(orbitAng) * ORBIT_R,
            CHASE_SPEED, Math.min(1, dt * 2));
      integrate(dt);
      stepT -= dt;
      if (stepT <= 0) enterStep(stepIdx + 1);

    } else if (st.act === 'telegraph') {
      /* re-aim every frame so the red line tracks her, and sprint
         for the edge the crossing will start from */
      planSweep(false);
      steer(dashFrom.x, dashFrom.y, WITHDRAW_SPD, Math.min(1, dt * 6));
      dashFrom.x = head.x;               // the line hangs off her
      dashFrom.y = head.y;
      integrate(dt);
      stepT -= dt;
      if (stepT <= 0) {
        enterStep(stepIdx + 1);
        planSweep(true);                 // freeze from where she is
      }

    } else if (st.act === 'dash') {
      dashElapsed += dt;
      if (dashElapsed > DASH_HARD) {
        enterStep(stepIdx + 1);          // hard ceiling, no soft-lock
      } else {
        head.vx = dashDirX * DASH_SPEED;
        head.vy = dashDirY * DASH_SPEED;
        integrate(dt);
        emitDarts(dt);
        if (!dashNear && dist(head.x, head.y, plX, plY) <= 40)
          dashNear = true;
        var pinned = head.x <= AX + 10.5 || head.x >= AX + AW - 10.5 ||
                     head.y <= AY + 10.5 || head.y >= AY + AH - 10.5;
        var passed = (dashTo.x - head.x) * dashDirX +
                     (dashTo.y - head.y) * dashDirY <= 0;
        if (pinned || passed) {
          land();
          sweepIdx++;
          if (sweepIdx >= DASH_SWEEPS) enterStep(stepIdx + 1);
          else planSweep(true);
        }
      }

    } else if (st.act === 'recover') {
      head.vx *= Math.max(0, 1 - dt * 4);
      head.vy *= Math.max(0, 1 - dt * 4);
      integrate(dt);
      /* the just-finished dash passed near the player: bark once */
      if (dashNear && !dashFired) {
        dashFired = true;
        if (NEU.juice) {
          NEU.juice.hit('small');
          NEU.juice.burst(head.x, head.y, 8, '#B8E6FF');
        }
      }
      stepT -= dt;
      if (stepT <= 0) enterStep(stepIdx + 1);

    } else { /* coil */
      coilElapsed += dt;
      p = tgt();
      var frac = clamp(coilElapsed / COIL_T, 0, 1);
      var r = COIL_R0 + (COIL_R1 - COIL_R0) * frac;
      coilAng += dt * COIL_TURN;
      steer(p.x + Math.cos(coilAng) * r,
            p.y + Math.sin(coilAng) * r, COIL_SPEED, Math.min(1, dt * 6));
      integrate(dt);
      stepT -= dt;
      /* HARD timer exit — this step cannot hold her hostage */
      if (stepT <= 0 || coilElapsed > COIL_HARD) enterStep(stepIdx + 1);
    }

    recordTrail();
    rebuildBeads();
  }

  /* ── darts ─────────────────────────────────────────────────────── */
  function tickDarts(dt, soulX, soulY, grazeCb, hitCb) {
    if (!(dt > 0)) return;
    for (var i = darts.length - 1; i >= 0; i--) {
      var d = darts[i];
      var sp = Math.sqrt(d.vx * d.vx + d.vy * d.vy);
      if (sp > 0 && sp < DART_CAP) {
        var ns = Math.min(DART_CAP, sp + DART_ACC * dt) / sp;
        d.vx *= ns;
        d.vy *= ns;
      }
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      var ds = dist(d.x, d.y, soulX, soulY);
      if (ds <= d.r + HIT_PAD) {
        darts.splice(i, 1);
        if (hitCb) hitCb(d);
        continue;
      }
      if (ds <= GRAZE_R) {
        /* continuous window like the bullet mover's graze rule — the
           meter should feed the same way whichever hostile body a
           shot grazes; no once-per-dart latch */
        if (grazeCb) grazeCb(d);
      }
      if (d.x < AX - CULL || d.x > AX + AW + CULL ||
          d.y < AY - CULL || d.y > AY + AH + CULL) darts.splice(i, 1);
    }
  }

  /* ── drawing ───────────────────────────────────────────────────── */
  function arms(b, ci, now) {
    var side = (ci % 2) ? -1 : 1;
    var pa = b.rot + side * HALF_PI;     // out from the spine
    var c = Math.cos(pa), s = Math.sin(pa);
    var a1x = b.x + c * 8,  a1y = b.y + s * 8;
    var a2x = b.x + c * 22, a2y = b.y + s * 22;
    var a3x = b.x + c * 36, a3y = b.y + s * 36;
    if (!sprite('sepulArm', a1x, a1y, SEG_SCALE, pa, 0, now))
      rect(a1x, a1y, 6, '#3A2140');
    if (!sprite('sepulForearm', a2x, a2y, SEG_SCALE, pa, 0, now))
      rect(a2x, a2y, 6, '#3A2140');
    if (!sprite('sepulHand', a3x, a3y, SEG_SCALE, pa, 0, now))
      rect(a3x, a3y, 5, '#4A2C50');
  }

  function draw(now) {
    if (!ctx || !spawned) return;
    var i, b, key, frame, d;

    /* the crossing line — telegraph promise and the dash itself */
    if (actName === 'telegraph' || actName === 'dash') {
      ctx.strokeStyle = 'rgba(255,34,34,0.38)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(dashFrom.x, dashFrom.y);
      ctx.lineTo(dashTo.x, dashTo.y);
      ctx.stroke();
    }

    /* tail -> head so nearer-head plates overlap the ones behind */
    for (i = beads.length - 1; i >= 0; i--) {
      b = beads[i];
      if (i === beads.length - 1) {      // last bead is the tail
        if (!sprite('sepulTail', b.x, b.y, SEG_SCALE, b.rot, 0, now))
          rect(b.x, b.y, 10, '#2A1830');
        continue;
      }
      if (i % 4 === 3) {
        key = 'sepulBodyAlt';
        frame = 0;
      } else {
        key = (i % 2) ? 'sepulHeart' : 'sepulBody';
        frame = (((now * 0.008) | 0) % 5 + 5) % 5;
      }
      if (!sprite(key, b.x, b.y, SEG_SCALE, b.rot, frame, now))
        rect(b.x, b.y, 12, '#3A2140');
      if (i % 4 === 3) arms(b, (i - 3) / 4, now);
    }

    /* telegraph: additive pulse sweeping head -> tail */
    if (actName === 'telegraph') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (i = 0; i < beads.length; i++) {
        b = beads[i];
        var a = Math.sin(now * 0.006 - i * 0.45);
        if (a <= 0) continue;
        ctx.globalAlpha = a * 0.35;
        ctx.fillStyle = '#FF2222';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 16, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    for (i = 0; i < darts.length; i++) {
      d = darts[i];
      if (!sprite('dart', d.x, d.y, 0.5, Math.atan2(d.vy, d.vx), 0, now))
        rect(d.x, d.y, d.r, '#E4C46A');
    }

    var hrot = Math.atan2(head.vy, head.vx) + HALF_PI;
    if (!sprite('sepulcher', head.x, head.y, SEG_SCALE + 0.08, hrot, 0, now))
      rect(head.x, head.y, 14, '#3A2140');
  }

  /* ── lifecycle ─────────────────────────────────────────────────── */
  function spawn(x, y) {
    head.x = x;
    head.y = y;
    head.vx = 0;
    head.vy = 0;
    darts.length = 0;
    orbitAng = 0.7;                      // fixed: deterministic open
    seedTrail(x, y);
    sweepIdx = 0;
    dashNear = false;
    dashFired = false;
    dartCd = 0;
    enterStep(0);
    rebuildBeads();
    spawned = true;
  }

  function setArena(ax, ay, aw, ah) {
    if (isFinite(ax)) AX = ax;
    if (isFinite(ay)) AY = ay;
    if (isFinite(aw) && aw > 0) AW = aw;
    if (isFinite(ah) && ah > 0) AH = ah;
    head.x = clamp(head.x, AX + 10, AX + AW - 10);
    head.y = clamp(head.y, AY + 10, AY + AH - 10);
  }

  NEU.scalWorm = {
    init: function (opts) {
      opts = opts || {};
      ctx = opts.ctx || null;
      setArena(opts.AX, opts.AY, opts.AW, opts.AH);
      targetFn = typeof opts.target === 'function' ? opts.target : null;
      plX = AX + AW / 2;
      plY = AY + AH / 2;
      spawned = false;
      trail = [];
      beads = [];
      darts = [];
      stepIdx = 0;
      stepT = SCRIPT[0].t || 0;
      actName = '';
      return true;
    },
    setArena: setArena,
    setPlayer: function (x, y) { plX = x; plY = y; },
    spawn: spawn,
    tick: tick,
    tickDarts: tickDarts,
    draw: draw,
    segs: function () {
      var out = [], i;
      for (i = 0; i < beads.length; i++)
        out.push({ x: beads[i].x, y: beads[i].y, rot: beads[i].rot });
      return out;
    },
    trail: function () {   // debug/integration view of the recorded path
      var out = [], i;
      for (i = 0; i < trail.length; i++)
        out.push({ x: trail[i].x, y: trail[i].y });
      return out;
    },
    head: function () {
      return { x: head.x, y: head.y, vx: head.vx, vy: head.vy };
    },
    /* live hostile darts — the fight exposes them so dodge logic and
       debug overlays see what the body is spraying */
    darts: function () {
      var out = [], i;
      for (i = 0; i < darts.length; i++)
        out.push({ x: darts[i].x, y: darts[i].y, vx: darts[i].vx, vy: darts[i].vy, r: darts[i].r });
      return out;
    },
    /* busy = mid-set-piece. coil counts: she is unmistakably occupied */
    busy: function () {
      return spawned && actName !== '' &&
             actName !== 'chase' && actName !== 'recover';
    },
    act: function () { return spawned ? actName : ''; }
  };
})();
