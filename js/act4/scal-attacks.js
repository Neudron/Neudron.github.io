/* scal-attacks.js — Supreme Calamitas' attack machine.
   Attack patterns ported from InfernumMode (InfernumTeam, @399342f, MIT).
   Source: InfernumMode-cs/Content/BehaviorOverrides/BossAIs/SupremeCalamitas/
   SupremeCalamitasBehaviorOverride.cs. Each attack names the lines it ports.

   Units: Terraria px and frames at 60 fps, converted here. K = arena width
   / 2000, so D(d) = d * K is a Terraria distance in arena px and
   V(v) = v * 60 * K is a Terraria px/frame speed in arena px/second.

   boss-scal.js owns the body, the player, the HP and the drawing. This file
   owns what she does: the cycles, the phase gates, the specials it starts
   and waits on, and the desperation substates. The machine ticks once per
   60 Hz frame, from boss-scal's update, and only while she is free to act.
   Every bullet goes through the adapter's shot(), so the shared cap holds.

   ceiling: enraged (soul outside the arena) cannot happen in this arena, so
   every enraged branch is absent. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var TAU = Math.PI * 2, TF = 1 / 60;

  var A = null;            /* the adapter boss-scal.js hands in with attach() */
  var G = null;            /* per-fight state, see fresh() */
  var cur = null;          /* the running attack: { name, fn, st } */
  var acc = 0, K = 0.35;   /* frame accumulator; arena px per Terraria px */
  var ATK = {};

  function D(d) { return d * K; }
  function V(v) { return v * 60 * K; }
  /* the pattern stream: Math.random until start() gives each fight its own seeded one */
  var RNG = Math.random;
  function rnd(a, b) { return a + RNG() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = (RNG() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function aim() { return Math.atan2(A.py - A.by, A.px - A.bx); }
  /* the playable box: the arena, or the shrunken one in the final all-out */
  function bounds() {
    var b = G && G.box;
    return b ? { x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h }
             : { x0: A.AX, y0: A.AY, x1: A.AX + A.AW, y1: A.AY + A.AH };
  }
  function hx(x) { var b = bounds(); return clamp(x, b.x0 + 12, b.x1 - 12); }
  function hy(y) { var b = bounds(); return clamp(y, b.y0 + 24, b.y1 - 24); }
  function segDist(px, py, x0, y0, x1, y1) {
    var dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy;
    var u = L2 ? clamp(((px - x0) * dx + (py - y0) * dy) / L2, 0, 1) : 0;
    return Math.hypot(px - (x0 + dx * u), py - (y0 + dy * u));
  }
  /* where the soul is when a body at (x, y) flying sp px/s gets there, from its velocity */
  function predict(x, y, sp) {
    var T = 0, qx = A.px, qy = A.py;
    for (var k = 0; k < 2; k++) {
      T = Math.hypot(qx - x, qy - y) / sp;
      qx = A.px + A.pvx * T; qy = A.py + A.pvy * T;
    }
    return { x: qx, y: qy };
  }
  /* n darts in a fan from her toward the soul, spread +-spread rad */
  function fan(n, spread, sp) {
    var base = aim();
    for (var j = 0; j < n; j++) {
      var da = base + lerp(-spread, spread, n > 1 ? j / (n - 1) : 0.5);
      A.shot(A.bx, A.by, Math.cos(da) * sp, Math.sin(da) * sp, 0, { tag: 'brim', fuse: 6 });
    }
  }
  /* the laser's segment this frame (a sweeping one moves from sw[0] to sw[1]) */
  function laserSeg(l) {
    var x = l.x, u;
    if (l.sw) { u = clamp((G.fr - l.at) / (l.end - l.at), 0, 1); x = lerp(l.sw[0], l.sw[1], u); }
    return arenaSeg({ x0: x, y0: l.y, x1: x + Math.cos(l.a) * l.len, y1: l.y + Math.sin(l.a) * l.len });
  }
  /* the part of a segment inside the fight arena (Liang-Barsky), or null.
     Beams stop at the walls: what a beam draws and hits stays in the box. */
  function arenaSeg(s) {
    var dx = s.x1 - s.x0, dy = s.y1 - s.y0, t0 = 0, t1 = 1, i, p, q, r;
    var P = [-dx, dx, -dy, dy], Q = [s.x0 - A.AX, A.AX + A.AW - s.x0, s.y0 - A.AY, A.AY + A.AH - s.y0];
    for (i = 0; i < 4; i++) {
      p = P[i]; q = Q[i];
      if (p === 0) { if (q < 0) return null; continue; }
      r = q / p;
      if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
      else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
    return { x0: s.x0 + dx * t0, y0: s.y0 + dy * t0, x1: s.x0 + dx * t1, y1: s.y0 + dy * t1 };
  }
  /* the soul state the Gravity section asks for; the soul module owns the physics */
  function soulMode(m) { if (NEU.scalSoul && NEU.scalSoul.setMode) NEU.scalSoul.setMode(m); }
  /* ease her toward (x, y); k is the share of the gap closed this frame */
  function move(x, y, k) {
    A.setBoss(A.bx + (hx(x) - A.bx) * k, A.by + (hy(y) - A.by) * k);
  }
  function beamLen() { return Math.hypot(A.AW, A.AH) * 1.2; }
  /* run fn n frames from now, on the attack clock */
  function later(n, fn) { G.ev.push({ f: G.fr + n, fn: fn }); }
  /* n darts on a full ring from (x, y) at sp arena px/s, first one at a0 */
  function ring(x, y, n, sp, a0, tag) {
    A.boom(x, y);                 /* every ring is a DemonicExplosion */
    for (var i = 0; i < n; i++) {
      var a = a0 + i * TAU / n;
      A.shot(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0, { tag: tag || 'burst' });
    }
  }
  /* A DemonicBomb: flies (vx, vy), drag 0.99 per frame (DemonicBomb.cs:57),
     fuses fuseF frames (DemonicBomb timeLeft), then bursts into n darts at
     sp (DemonicExplosion). */
  function bomb(x, y, vx, vy, fuseF, n, sp) {
    return A.shot(x, y, vx, vy, 2, { fuse: fuseF / 60, acc: Math.pow(0.99, 60), tag: 'bomb',
      onEnd: function (b) { ring(b.x, b.y, n, sp, 0, 'burst'); } });
  }

  /* ── the WotG kit (summons, shadow demon, berserk, transition, the
     specials). One palette, ramped telegraphs, cached twin flares with
     afterimages, a shake budget, cue throttling, a blackout overlay.
     NamelessDeity refs: TelegraphedScreenSlice.cs:21,167-171 (ramp, derived
     telegraph time), LightDagger.cs:89-92,173-178 (speed clamp, afterimages),
     ArcingStarburst.cs:155-156 (twin flare), TelegraphedPortalLaserbeam.cs:87
     (shake budget). Every colour below indexes BRIM. */
  var BRIM = ['#1a0000', '#5a0000', '#c0140a', '#ff3a1a', '#ff9a4a', '#fff0d0'];
  var BRIM_RGB = [[26, 0, 0], [90, 0, 0], [192, 20, 10], [255, 58, 26], [255, 154, 74], [255, 240, 208]];
  /* palettes for the shared beam look (NEU.scalBeam.draw). brim is hers and
     draws exactly as before (no extras, plus her ray sprites); soul is the
     player's BRIMSTONE: soul red into white, same shape language, plus the
     WotG extras (downscaled glow, scrolling streaks, impact sparks). */
  var BEAM_PAL = {
    brim: { rgb: BRIM_RGB, fx: false },
    soul: { rgb: [[24, 0, 8], [120, 0, 24], [214, 16, 40], [255, 40, 64], [255, 168, 180], [255, 255, 255]], fx: true }
  };
  function fx() {
    return G.fx || (G.fx = { warn: [], mine: [], dark: 0, darkTo: 0, shk: 0, cue: {}, loud: false, grad: {}, gn: 0 });
  }
  /* dark red -> near white as t goes 0 -> 1 (pow .6), as 'r,g,b' */
  function rampRGB(t) {
    var u = 2 + 3 * Math.pow(clamp(t, 0, 1), 0.6), i = Math.min(4, u | 0), k = u - i, a = BRIM_RGB[i], b = BRIM_RGB[i + 1];
    return ((a[0] + (b[0] - a[0]) * k) | 0) + ',' + ((a[1] + (b[1] - a[1]) * k) | 0) + ',' + ((a[2] + (b[2] - a[2]) * k) | 0);
  }
  /* telegraph length: every telegraph is 24-30 f (60 fps), whatever pace the attack asks for */
  function teleT(T) { return clamp(T, 24, 30); }
  /* a warning: a line (a = angle) or a ring (r = radius) that ramps up to its hit frame */
  function warn(o) { o.life = clamp(o.life || 24, 24, 30); o.at = G.fr; fx().warn.push(o); return o; }
  /* a safe gap (cyan, dashed, no fill): len across the wall, full depth of the
     arena. horiz: the gap runs along x (a top or bottom wall), else along y. */
  function gapMark(x, y, horiz, len, life) {
    return warn({ kind: 'rect', safe: true, life: life || 24,
      x: horiz ? x - len / 2 : A.AX, y: horiz ? A.AY : y - len / 2,
      w: horiz ? len : A.AW, h: horiz ? A.AH : len });
  }
  /* a bullet that starts slow and reaches sp (floor .45, cap sp): read, then go */
  function shotRamp(x, y, a, sp, k, o) {
    o = o || {};
    o.acc = o.acc || 4; o.vmax = sp;
    var b = A.shot(x, y, Math.cos(a) * sp * 0.45, Math.sin(a) * sp * 0.45, k, o);
    if (b) fx().mine.push(b);
    return b;
  }
  function ringRamp(x, y, n, sp, a0, gapAt, gapN) {
    A.boom(x, y);
    for (var i = 0; i < n; i++) {
      if (gapN && ((i - gapAt) % n + n) % n < gapN) continue;
      shotRamp(x, y, a0 + i * TAU / n, sp, 0, { tag: 'burst', fuse: 6 });
    }
  }
  /* a shake with a budget: one kick per 8 f, none while a louder beat owns the screen */
  function kick(tier, loud) {
    var F = fx();
    if (F.loud && !loud) return;
    if (G.fr - F.shk < 8) return;
    F.shk = G.fr;
    A.shake(tier);
  }
  /* a sound with a 50 ms floor per name (TelegraphedScreenSlice MaxInstances=1) */
  function cue(name) {
    var F = fx(), now = Date.now();
    if (F.loud && name !== 'maelstrom') return;
    if (now - (F.cue[name] || 0) < 50) return;
    F.cue[name] = now;
    if (name === 'chime') { if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick(); }
    else A.sfx(name);
  }
  /* one flare, cached at first use: BRIM[5] core through BRIM[3] to nothing */
  /* one cached flare canvas per palette (p.fl); brim's stops are the old ones */
  function flareImg(p) {
    p = p || BEAM_PAL.brim;
    if (p.fl !== undefined) return p.fl;
    p.fl = false;
    try {
      var c = document.createElement('canvas'); c.width = c.height = 64;
      var x = c.getContext && c.getContext('2d');
      if (!x || !x.createRadialGradient) return p.fl;
      var r = p.rgb, g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgb(' + r[5].join() + ')'); g.addColorStop(0.18, 'rgb(' + r[4].join() + ')');
      g.addColorStop(0.45, 'rgba(' + r[3].join() + ',0.55)'); g.addColorStop(1, 'rgba(' + r[1].join() + ',0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      p.fl = c;
    } catch (e) { p.fl = false; }
    return p.fl;
  }
  /* two counter-rotating blits of the cached flare, stretched along travel */
  function twinFlare(ctx, x, y, s, rot, a, p) {
    var im = flareImg(p);
    if (!im) return;
    ctx.globalAlpha = a;
    for (var i = 0; i < 2; i++) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(i ? -rot : rot);
      ctx.drawImage(im, -s * 1.3, -s * 0.55, s * 2.6, s * 1.1);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  /* drawn first in draw(): the blackout, then the ramped warnings, then the
     tracked bullets' bloom and 6-tap afterimages (offset -v * i * 0.56 f) */
  function drawFx(ctx) {
    var F = G.fx, i, w, t, fade, op = ctx.globalCompositeOperation, L = beamLen(), c, s, m, sp, rot, n, wk, wn;
    if (!F) return;
    F.dark += (F.darkTo - F.dark) * 0.08;
    if (F.dark > 0.01) {
      ctx.fillStyle = 'rgba(0,0,0,' + F.dark.toFixed(2) + ')';
      ctx.fillRect(A.AX, A.AY, A.AW, A.AH);
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    /* compacted in place: the same survivors in the same order as filter(),
       with no new array every frame */
    for (wk = 0, wn = 0; wk < F.warn.length; wk++) if (G.fr - F.warn[wk].at < F.warn[wk].life) F.warn[wn++] = F.warn[wk];
    F.warn.length = wn;
    for (i = 0; i < F.warn.length; i++) {
      w = F.warn[i];
      t = clamp((G.fr - w.at) / Math.max(1, w.life), 0, 1);
      /* Keep the exact attack shape readable, then let it disappear
         before impact. The old ramp only brightened until the hit. */
      fade = clamp((1 - t) / 0.22, 0, 1) * clamp(t / 0.14, 0, 1);
      c = rampRGB(0.45 + 0.55 * t);
      if (w.kind === 'rect') {
        /* a telegraphed box: fill .2, 2 px edge */
        ctx.globalAlpha = fade;
        if (w.safe) {
          /* safe gap: cyan dashed outline, never filled (cyan = safe, red = hurt) */
          ctx.setLineDash([8, 6]); ctx.strokeStyle = '#5FF2FF'; ctx.lineWidth = 2;
          ctx.strokeRect(w.x, w.y, w.w, w.h); ctx.setLineDash([]); ctx.globalAlpha = 1;
          continue;
        }
        ctx.fillStyle = 'rgba(' + c + ',' + (w.fillA || 0.2) + ')'; ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.strokeStyle = 'rgba(' + c + ',.85)'; ctx.lineWidth = w.lw || 2; ctx.strokeRect(w.x, w.y, w.w, w.h);
        ctx.globalAlpha = 1;
        continue;
      }
      if (w.kind === 'fan') {
        /* a sector from a0 to a1 at radius r, filled .16, with its two edge lines */
        ctx.globalAlpha = fade;
        if (w.safe) { ctx.setLineDash([8, 6]); ctx.strokeStyle = '#5FF2FF'; }
        else { ctx.fillStyle = 'rgba(' + c + ',.16)'; ctx.strokeStyle = 'rgba(' + c + ',.85)'; }
        if (!w.safe) { ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.arc(w.x, w.y, w.r, w.a0, w.a1); ctx.closePath(); ctx.fill(); }
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(w.x, w.y); ctx.lineTo(w.x + Math.cos(w.a0) * w.r, w.y + Math.sin(w.a0) * w.r);
        ctx.moveTo(w.x, w.y); ctx.lineTo(w.x + Math.cos(w.a1) * w.r, w.y + Math.sin(w.a1) * w.r);
        ctx.stroke(); ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        continue;
      }
      if (w.r !== undefined) {
        /* a ring closes from 1.6x onto its burst radius as it ramps; rFill shows the final radius */
        ctx.globalAlpha = fade;
        if (w.rFill) { ctx.fillStyle = 'rgba(' + c + ',.15)'; ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, TAU); ctx.fill(); }
        ctx.strokeStyle = 'rgba(' + c + ',' + Math.max(0.5, 0.25 + 0.75 * t).toFixed(2) + ')';
        ctx.lineWidth = Math.max(2, (w.w || 2) * t * 2);
        ctx.beginPath(); ctx.arc(w.x, w.y, w.r * (1.6 - 0.6 * t), 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }
      var ex = w.x + Math.cos(w.a) * (w.len || L), ey = w.y + Math.sin(w.a) * (w.len || L);
      /* the gradient depends only on the line and its quantised ramp, so it is
         built once per (line, 1/16 step) and reused, not made per line per frame */
      var tq = Math.round(t * 16) / 16, fq = Math.round(fade * 16) / 16, gk = w.x + ',' + w.y + ',' + ex + ',' + ey + ',' + tq + ',' + fq, gr = F.grad[gk];
      if (!gr && ctx.createLinearGradient) {
        if (F.gn >= 256) { F.grad = {}; F.gn = 0; }
        gr = F.grad[gk] = ctx.createLinearGradient(w.x, w.y, ex, ey); F.gn++;
        gr.addColorStop(0, 'rgba(' + rampRGB(0.45 + 0.55 * tq) + ',' + ((0.3 + 0.7 * tq) * fq).toFixed(2) + ')');
        gr.addColorStop(1, 'rgba(' + rampRGB(0.45 + 0.55 * tq) + ',' + (0.85 * fq).toFixed(2) + ')');
      }
      /* core width never collapses to 0 as t does; bw draws the real hitbox band under it */
      var core = Math.max(3, (w.w || 2) * (1.2 + 1.8 * t));
      if (w.bw) {
        ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.a);
        ctx.fillStyle = 'rgba(' + c + ',' + (0.18 * fade).toFixed(3) + ')';
        ctx.fillRect(0, -w.bw, w.len || L, 2 * w.bw);
        ctx.restore();
      }
      /* contrast under-stroke (source-over) so the core reads on the red wash */
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(0,0,0,' + (0.55 * fade).toFixed(2) + ')';
      ctx.lineWidth = core + 4;
      ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = gr || 'rgba(' + c + ',' + (t * fade).toFixed(2) + ')';
      ctx.lineWidth = core;
      ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.lineTo(ex, ey); ctx.stroke();
    }
    /* the desperation stage card: 30 f, alpha 0 -> 1 -> 0, spaced caps, black stroke */
    if (F.title && G.fr - F.title.at < 30) {
      t = (G.fr - F.title.at) / 30;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = t < 0.5 ? t * 2 : (1 - t) * 2;
      ctx.font = '32px monospace'; ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = '#000';
      ctx.strokeText(F.title.text.split('').join(' '), A.AX + A.AW / 2, A.AY + A.AH * 0.35);
      ctx.fillStyle = '#FFE0C0';
      ctx.fillText(F.title.text.split('').join(' '), A.AX + A.AW / 2, A.AY + A.AH * 0.35);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'lighter';
    }
    for (wk = 0, wn = 0; wk < F.mine.length; wk++) {
      m = F.mine[wk];
      if (m.fuse > 0 && m.x > A.AX - 40 && m.x < A.AX + A.AW + 40 && m.y > A.AY - 40 && m.y < A.AY + A.AH + 40) F.mine[wn++] = m;
    }
    F.mine.length = wn;
    if (F.mine.length > 240) F.mine.splice(0, F.mine.length - 240);
    /* LOD: past 80 mines the afterimages go (the bloom stays); otherwise 3 at most */
    n = F.mine.length > 80 ? 0 : (rm() ? 2 : 3);
    for (i = 0; i < F.mine.length; i++) {
      m = F.mine[i];
      sp = Math.hypot(m.vx, m.vy);
      rot = Math.atan2(m.vy, m.vx);
      s = m.k === 2 || m.k === 3 || m.k === 5 ? 22 : 12;
      /* demon skulls (k 5) get a 2 px ember outline so they read on #2a0008 (3:1+) */
      if (m.k === 5) { ctx.strokeStyle = '#FFB070'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(m.x, m.y, 14, 0, TAU); ctx.stroke(); }
      for (var j = n; j >= 1; j--) {
        twinFlare(ctx, m.x - m.vx * j * 0.56 / 60 * 2, m.y - m.vy * j * 0.56 / 60 * 2, s * (1 - j / (n + 2)), rot, 0.4 * (1 - j / (n + 1)));
      }
      twinFlare(ctx, m.x, m.y, s * (1 + Math.min(1, sp / 400) * 0.3), rot + G.fr * 0.05, 0.9);
    }
    ctx.globalCompositeOperation = op;
    ctx.lineCap = 'butt'; ctx.lineWidth = 1;
  }
  function rm() { return !!(NEU.juice && NEU.juice.reduced); }

  /* ── beams, eyes, cross: shared bits (WotG pass) ──────────────────
     anyActive: the one query an attack makes against what else is up
     (TelegraphedScreenSlice.cs:96-98 thins its slice under the laser). */
  function anyActive(k) {
    if (k === 'combo') return G.thin;
    if (G.beam) return true;
    for (var i = 0; i < G.lasers.length; i++) if (G.fr >= G.lasers[i].at) return true;
    return false;
  }
  /* embers: a pool of at most 64, life 20-40 f, colour BRIM[3..5]
     (LightSlashTelegraph.cs:103-106). Positions are analytic from the
     birth frame, so nothing ticks them. Math.random, not RNG: the look
     must not move the pattern stream. */
  function sparks(x, y, n, a, spread, sp, r0) {
    var F = fx(), P = F.parts || (F.parts = []), q, i;
    if (rm()) n = Math.ceil(n / 3);
    for (i = 0; i < n; i++) {
      if (P.length >= 64) P.shift();
      q = a + (Math.random() - 0.5) * spread;
      var v = sp * (0.6 + Math.random() * 0.6), r = r0 || 0;
      P.push({ x: x + Math.cos(q) * r, y: y + Math.sin(q) * r, vx: Math.cos(q) * v, vy: Math.sin(q) * v,
               at: G.fr, life: 20 + ((Math.random() * 21) | 0), c: 3 + ((Math.random() * 3) | 0) });
    }
  }
  function drawSparks(ctx) {
    var P = G.fx && G.fx.parts, i, p, u, d, op = ctx.globalCompositeOperation;
    if (!P || !P.length) return;
    ctx.globalCompositeOperation = 'lighter';
    for (i = P.length - 1; i >= 0; i--) {
      p = P[i]; u = (G.fr - p.at) / p.life;
      if (u >= 1 || u < 0) { P.splice(i, 1); continue; }
      d = (1 - Math.pow(0.95, G.fr - p.at)) / 0.05 / 60;   /* drag .95/f */
      ctx.globalAlpha = 1 - u;
      ctx.fillStyle = BRIM[p.c];
      ctx.fillRect((p.x + p.vx * d) | 0, (p.y + p.vy * d) | 0, 2, 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = op;
  }
  /* where a ray from (x, y) at angle a leaves the arena */
  function rayTip(x, y, a) {
    var c = Math.cos(a), s = Math.sin(a), t = 1e9;
    if (c > 1e-6) t = Math.min(t, (A.AX + A.AW - x) / c);
    if (c < -1e-6) t = Math.min(t, (A.AX - x) / c);
    if (s > 1e-6) t = Math.min(t, (A.AY + A.AH - y) / s);
    if (s < -1e-6) t = Math.min(t, (A.AY - y) / s);
    t = Math.max(0, Math.min(t, beamLen()));
    return { x: x + c * t, y: y + s * t };
  }
  /* the bomb's rest point: drag .99 per frame for fuse frames */
  function restAt(x, y, a, v, fuseF) {
    var d = v / 60 * (1 - Math.pow(0.99, fuseF)) / 0.01;
    return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d };
  }
  /* the gap-toward-the-soul ring that closes a beam attack: a ring warning
     first, then a ramped ring with three shots missing on her line to the
     soul, a hitstop and embers (the peak beat) */
  function finale(n, sp) {
    var a = aim();
    ringRamp(A.bx, A.by, n, sp, a, n - 1, 3);
    kick('medium'); cue('giga-hit');
    sparks(A.bx, A.by, 24, 0, TAU, 220);
  }
  /* anyActive (TelegraphedScreenSlice.cs:96-98): a beam, bolts, lasers, rifts
     or the worm on screen. Attacks thin themselves when this is true. */
  function busy() {
    return !!(G.beam || G.lasers.length || G.bolts.length || G.rend.length || G.hexes.length ||
              (NEU.scalWorm && NEU.scalWorm.busy && NEU.scalWorm.busy()));
  }
  /* the handoff: what this attack fired fuses out within 20 f, so the next
     one starts on a clean field (wotg.md #1, the 84 f gap after daggers) */
  function settle() {
    var m = fx().mine;
    for (var i = 0; i < m.length; i++) if (m[i].fuse > 1 / 3) m[i].fuse = 1 / 3;
  }
  /* a big beat: owns the screen (lesser cues and kicks go quiet), dims it */
  function loud(on, dark) { var F = fx(); F.loud = on; F.darkTo = on ? (dark || 0.5) : 0; }

  /* ── the attacks ──────────────────────────────────────────────────
     Each takes its state `st` (st.f is the frame into this attack, st.n a
     counter, st.side a side, st.p scratch) and returns true when it ends. */

  /* SupremeCalamitas.cs:726-799. She hovers 820 px to one side of the soul.
     Two volleys, in f 60-240 and f 300-480. Fire rate 7 f (5 at phase 1+,
     4 berserk). Soul speed 8.5, fan lerp(-0.67, 0.67) by shot number mod 3,
     plus +-0.25 rad.
     verb: stream. dodge: weave between the fan's three lanes.
     WotG pass: each volley's lanes ramp in first (warn, teleT of the rate)
     with a chime and ride her hands; souls ramp 0.45 -> full with flares;
     volley 2 fires one frame faster (floor 3) and ends on a 20-ring (peak,
     hitstop). busy() or a combo halves the rate.
     exit: she is to one side, high; the soul is wherever it weaved. */
  /* a warning that rides her hands until it fires */
  function pinTo(ws) { for (var i = 0; ws && i < ws.length; i++) { ws[i].x = A.bx; ws[i].y = A.by; } }
  /* a DemonicBomb whose burst ramps, throws embers and kicks */
  function bombR(x, y, vx, vy, fuseF, n, sp) {
    return tracked(A.shot(x, y, vx, vy, 2, { fuse: fuseF / 60, acc: Math.pow(0.99, 60), tag: 'bomb',
      onEnd: function (b) { ringRamp(b.x, b.y, n, sp, RNG() * TAU); sparks(b.x, b.y, 8, 0, TAU, 160); kick('small'); } }));
  }
  function tracked(b) { if (b) fx().mine.push(b); return b; }
  ATK.HorizontalDarkSoulRelease = function (st) {
    var f = st.f, k, T, a0, v2;
    if (f === 0) { st.side = A.bx < A.px ? -1 : 1; st.ox = A.bx; st.oy = A.by; }
    move(A.px + st.side * D(820), A.AY + A.AH * 0.2, 0.08);
    var on = (f >= 60 && f < 240) ? 60 : (f >= 300 && f < 480) ? 300 : -1;
    var rate = G.berserk ? 4 : (G.lvl >= 1 ? 5 : 7);
    v2 = f >= 280;
    if (v2) rate = Math.max(3, rate - 1);
    if (busy() || G.thin) rate *= 2;
    a0 = st.side < 0 ? 0 : Math.PI;
    T = Math.max(24, teleT(rate * 4));
    if (f === 60 - T || f === 300 - T) {
      st.p.w = [];
      /* from the fixed origin captured at f0: the boss is faded out while these show */
      for (k = 0; k < 3; k++) st.p.w.push(warn({ x: st.ox, y: st.oy, a: a0 + lerp(-0.67, 0.67, k / 2), life: T, w: 3, len: D(1500) }));
      cue('chime'); kick('small');
    }
    if (on >= 0 && (f - on) % rate === 0) {
      var a = a0 + lerp(-0.67, 0.67, (st.n++ % 3) / 2) + rnd(-0.25, 0.25);
      shotRamp(A.bx, A.by, a, V(8.5), 0, { tag: 'soul', fuse: 6 });
    }
    if (f === 479) {
      ringRamp(A.bx, A.by, 20, V(6), aim());
      kick('medium'); cue('fireblast'); sparks(A.bx, A.by, 20, 0, TAU, 200);
    }
    return f >= 480;
  };

  /* SupremeCalamitas.cs:803-935 (CondemnationFanBurst). Two fans. Each: a
     chargeup of 120 f (155 at phase 1+), then a 52 f fan window that fires an
     arrow every 2 f (26 per fan). Arrow speed 11.25 (14.75 phase 1+, 19.5
     phase 3+). Spread 2.94 rad (2.72 phase 1+, 3.03 berserk), aim locked at
     the fan start +-0.07 rad. Phase 1+ also drops six darts on a ring 650 px
     out at the chargeup, drifting in at 0.4 of their offset over the fan.
     Rest 48 f between fans.
     ceiling: arrows do not accelerate x1.025 per frame; they are capped at
     the phase speed, because the source reaches about 7x in its 80 f life.
     verb: sweep. dodge: get behind the sweep (the side it starts on, once
     the first arrows pass) or outrun its far edge.
     WotG pass: the sweep's two edges ramp in (warn, teleT of the fan) with
     a chime; arrows ramp 0.45 -> cap with flares; fan 2 sweeps back the
     other way 15 % faster and its last arrow is the peak (hitstop, embers).
     busy() or a combo fires every 4 f, not 2.
     exit: she is above the soul; the soul is on the side the sweep ended. */
  ATK.CondemnationFanBurst = function (st) {
    var f = st.f, L = G.lvl;
    var chg = L >= 1 ? 155 : 120, fan = 52, rest = 48, len = chg + fan + rest;
    if (f >= 2 * len - rest - 1) return true;
    var i = Math.floor(f / len), lf = f - i * len, T = teleT(fan / 2);
    var spread = G.berserk ? 3.03 : (L >= 1 ? 2.72 : 2.94);
    move(A.px, A.AY + A.AH * 0.2, 0.1);
    if (lf === 0) {
      st.aim = aim() + rnd(-0.07, 0.07);
      st.dir = i ? -st.dir : (RNG() < 0.5 ? -1 : 1);
    }
    if (lf === chg - T) {
      /* one sector over the arc the arrows sweep (aim +- spread/2, whichever way dir runs) */
      st.p.w = [warn({ x: A.bx, y: A.by, kind: 'fan', a0: st.aim - spread / 2, a1: st.aim + spread / 2, r: D(1500), life: T })];
      cue('chime');
    }
    if (lf < chg) pinTo(st.p.w);
    if (lf === chg) kick('small');
    if (i === 1 && lf === chg + fan - 2) { kick('medium'); cue('fireblast'); sparks(A.bx, A.by, 18, 0, TAU, 200); }
    if (lf === chg && L >= 1) {
      for (var k = 0; k < 6; k++) {
        var q = k * TAU / 6, ox = Math.cos(q) * D(650), oy = Math.sin(q) * D(650);
        A.shot(A.px + ox, A.py + oy, -ox / fan * 0.4 * 60, -oy / fan * 0.4 * 60, 0,
               { tag: 'brim', fuse: fan / 60 + 2 });
      }
    }
    if (lf >= chg && lf < chg + fan && (lf - chg) % ((busy() || G.thin) ? 4 : 2) === 0) {
      var t = (lf - chg) / fan;
      var sp = V(L >= 3 ? 19.5 : L >= 1 ? 14.75 : 11.25) * (i ? 1.15 : 1);
      var cap = V(24);
      var ang = st.aim + st.dir * spread * (t - 0.5);
      /* fuse 80 f plus the ramp's lost ground (about 18 f at full speed) */
      shotRamp(A.bx, A.by, ang, Math.min(sp, cap), 0, { tag: 'brim', look: 'arrow', fuse: 98 / 60 });
    }
    return false;
  };

  /* SupremeCalamitas.cs:973-1092 (ExplosiveCharges). She hovers 500 px to
     one side and 270 px above the soul while the shield laughs. Then six
     dashes (five in berserk) every 45 f (41 at phase 1+). Each dash drops a
     DemonicBomb that detonates 120 f later (102 at phase 3+, -45 berserk).
     Every third dash also fires a gigablast at half the bomb speed, with
     +-0.4 rad. Dash speed 43 (47.5 phase 1+, +3.5 phase 3+, +9.5 berserk).
     ceiling: the bomb drag is applied per second; the explosion is 14 darts,
     not the DemonicExplosion radius.
     verb: ram. dodge: sidestep the locked line, then leave the bomb's ring.
     WotG pass: every dash is a line that tracks the soul, then locks 6 f
     before she goes (warn, teleT of half the dash) with a chime; each
     dash comes 2 f sooner than the last (floor chT - 8); bombs burst in
     ramped rings with embers; the gigablast dash is the hitstop beat.
     busy() drops the gigablasts.
     exit: she ends wherever the last dash took her; bombs still fusing. */
  ATK.ExplosiveCharges = function (st) {
    var f = st.f, L = G.lvl, B = G.berserk, p = st.p;
    var delay = 132, chT = L >= 1 ? 41 : 45, n = B ? 5 : 6, Tw = Math.max(24, teleT(chT / 2));
    var spd = V((L >= 1 ? 47.5 : 43) + (L >= 3 ? 3.5 : 0) + (B ? 9.5 : 0));
    var bombSp = V(L >= 1 ? 15 : 20);
    var fuse = (L >= 3 ? 102 : 120) - (B ? 45 : 0);
    if (f === 0) { st.side = A.bx < A.px ? -1 : 1; p.c = 0; p.t0 = delay; p.end = 1e9; }
    if (f >= p.end) return true;
    if (f < delay) {
      A.anim('charge_telegraph'); A.willCharge(true);
      move(A.px + st.side * D(500), A.py - D(270), 0.06);
    }
    if (p.c < n && f === p.t0 - Tw) {
      p.w = warn({ x: A.bx, y: A.by, a: aim(), life: Tw, w: 5, len: D(1600) });
      /* the bomb's landing ring, shown at the dash start: the predicted spot
         (drag ignored, half the free flight) and the burst's first-second reach */
      var la = aim(), ld = bombSp * (fuse / 60) * 0.5;
      warn({ x: A.bx + Math.cos(la) * ld, y: A.by + Math.sin(la) * ld, r: V(6), rFill: true, w: 3, life: 24 });
      cue('chime');
    }
    if (p.w && f < p.t0) { p.w.x = A.bx; p.w.y = A.by; if (p.t0 - f > 6) p.w.a = aim(); }
    if (f === p.t0 && p.c < n) {
      A.willCharge(false); A.anim('charging');
      var a = p.w ? p.w.a : aim(), c = p.c++;
      p.w = null;
      st.dx = Math.cos(a); st.dy = Math.sin(a);
      bombR(A.bx, A.by, Math.cos(a) * bombSp, Math.sin(a) * bombSp, fuse, 14, V(6));
      kick('small');
      if (c % 3 === 2 && !busy()) {
        var ga = a + rnd(-0.4, 0.4);
        tracked(A.shot(A.bx, A.by, Math.cos(ga) * bombSp * 0.5, Math.sin(ga) * bombSp * 0.5, 2,
               { tag: 'gig', fuse: 1.5 }));
        cue('giga'); kick('medium');
      }
      var iv = Math.max(chT - 8, chT - c * 2);
      p.t0 = f + iv;
      if (p.c >= n) p.end = f + chT;
    }
    if (f >= delay) {
      A.setBoss(hx(A.bx + st.dx * spd * TF), hy(A.by + st.dy * spd * TF));
    }
    return false;
  };

  /* SupremeCalamitas.cs:1094-1205 (HellblastBarrage). She hovers 700 px beside
     the soul, with a vertical bob of 330 (+20 phase 1+, +50 phase 3+, +50
     berserk, period 56 f) once firing starts. Fires in f 105-465: a
     hellblast every 12 f (14 base, 11 berserk), flying horizontally at 15.
     Every fifth hellblast is swapped for seven darts at +-0.45 rad, speed
     8.4 (+1.36 phase 1+, +2.5 phase 3+).
     ceiling: the endOfAttackShootBlock (90 f) and its explosion are not drawn. */
  ATK.HellblastBarrage = function (st) {
    var f = st.f, L = G.lvl, B = G.berserk;
    if (f === 0) { st.side = A.px < A.AX + A.AW / 2 ? 1 : -1; A.sfx('hellblast'); }
    /* the stream's lane shows teleT(60) f before the first hellblast fires */
    if (f === 105 - teleT(60)) {
      /* the lane is locked at the warn frame: the stream fires that way even if the soul crosses */
      st.dir = A.px < A.bx ? -1 : 1;
      warn({ x: A.bx, y: A.by, a: st.dir < 0 ? Math.PI : 0, life: teleT(60), w: 4, len: D(1500), bw: D(14) });
      cue('chime');
    }
    var amp = 330 + (L >= 1 ? 20 : 0) + (L >= 3 ? 50 : 0) + (B ? 50 : 0);
    var bob = f >= 105 ? Math.sin((f - 105) * TAU / 56) * D(amp) : 0;
    /* in a combo the partner places her; this one only fires */
    if (!G.thin) move(A.px + st.side * D(700), A.AY + A.AH / 2 + bob, 0.2);
    if (f < 105 || f >= 465) return f >= 555;
    var iv = ((L >= 1 ? 12 : 14) - (B ? 3 : 0)) * (G.thin ? 2 : 1);
    if ((f - 105) % iv !== 0) return false;
    A.shot(A.bx, A.by, st.dir * V(15), 0, 3, { tag: 'hell', fuse: 6 });
    if (++st.n % 5 === 0 && !G.thin) {
      var base = aim(), dsp = V(8.4 + (L >= 3 ? 2.5 : L >= 1 ? 1.36 : 0));
      for (var j = 0; j < 7; j++) {
        var da = base + lerp(-0.45, 0.45, j / 6);
        A.shot(A.bx, A.by, Math.cos(da) * dsp, Math.sin(da) * dsp, 0, { tag: 'brim', fuse: 6 });
      }
    }
    return false;
  };

  /* SupremeCalamitas.cs:1212-1355 (DarkMagicBombWalls). The soul is the
     centre. Every 20 f from f 135 to 465 (16 at phase 3+), three dark flames
     (five at phase 3+) fly in from a ring 1000 px out, accelerating x1.019 a
     frame (AcceleratingDarkMagicFlame.cs:26-39). Bomb waves: 13 telegraph
     points, one every 7 f, within 900 px (1050 at phase 3+) of the soul, each
     dropping a bomb 45 f later that fuses 135-185 f (DemonicTelegraphLine
     OnKill). Each telegraph is a red line through the drop point, along
     the line from her (DemonicTelegraphLine.PreDraw). ceiling: the flame
     ring is clipped to the arena. */
  ATK.DarkMagicBombWalls = function (st) {
    var f = st.f, L = G.lvl;
    move(A.AX + A.AW / 2, A.AY + A.AH * 0.15, 0.05);
    var cad = L >= 3 ? 16 : 20;
    if (f >= 111 && f < 441 && (f - 111) % cad === 0)
      warn({ x: A.px, y: A.py, r: 40, w: 2, life: 24 });
    if (f >= 135 && f < 465 && (f - 135) % cad === 0) {
      var n = L >= 3 ? 5 : 3, a0 = rnd(0, TAU);
      for (var k = 0; k < n; k++) {
        var q = a0 + k * TAU / n;
        var x = clamp(A.px + Math.cos(q) * D(1000), A.AX, A.AX + A.AW);
        var y = clamp(A.py + Math.sin(q) * D(1000), A.AY, A.AY + A.AH);
        A.shot(x, y, -Math.cos(q) * V(2.7), -Math.sin(q) * V(2.7), 5,
               { tag: 'flame', acc: Math.pow(1.019, 60), vmax: V(12), fuse: 5 });
      }
    }
    var local = f - 135;
    if (local >= 0 && local < 3 * 167 && local % 167 < 91 && (local % 167) % 7 === 0) {
      var off = D(L >= 3 ? 1050 : 900);
      var tx = hx(A.px + rnd(-off, off)), ty = hy(A.py + rnd(-off, off));
      G.tele.push({ x: tx, y: ty, a: Math.atan2(ty - A.by, tx - A.bx), at: G.fr, life: 30, bw: 24,
        len: Math.hypot(tx - A.bx, ty - A.by) + 40 });
      warn({ x: tx, y: ty, r: 30, w: 3, rFill: true, life: 30 });
      later(45, (function (bx, by) {
        return function () { bomb(bx, by, 0, 0, rnd(135, 185), 12, V(6)); };
      }(tx, ty)));
    }
    return f >= 555;
  };

  /* SupremeCalamitas.cs:1358-1450 (FireLaserSpin). She hovers, casts the orb
     at f 165 and rises at f 200. The orb's laser sweeps one full turn over
     f 245-565. Gigablasts from f 235 (gap 75 f, 57 at phase 3+), speed 10.5
     (11.75 phase 3+), aimed at the soul.
     dodge: run ahead of the sweep; on the toll, turn round with it.
     WotG pass. The beam lights 0.9 rad behind the soul (in the sweep's
     sense), shown teleT(36) f ahead by a ramped line (TelegraphedScreenSlice
     .cs:167-171). Its turn rate ramps from 0 to a cap (LightDagger.cs:89-92
     speed clamp) over each half. At f 405 it stops, tolls (ring warning,
     chime) and runs back the other way (ClockConstellation.cs:66
     TimeIsReversed). Each gigablast's aim locks under a warning line first,
     and the gap shrinks 6 f a shot to a floor of 45 (SwordConstellation
     .cs:114). The peak at f 565: a ring of 14 with its gap on the soul,
     a hitstop. In a combo (anyActive) the beam is 0.6 wide.
     entry: soul anywhere. exit: soul near her, still; the ring's gap faces
     it, so the next attack starts on a soul that has just stepped in.
     ceiling: BrimstoneFlameOrb's laser internals are not in the notes, so the
     laser is a plain swept beam. */
  ATK.FireLaserSpin = function (st) {
    var f = st.f, L = G.lvl, T = teleT(36), om, tg, gc;
    move(A.AX + A.AW / 2, A.AY + A.AH * (f < 200 ? 0.4 : 0.1), 0.04);
    if (f === 165) A.anim('casting');
    if (f === 245 - T) {
      st.dir = RNG() < 0.5 ? -1 : 1; st.ang = aim() - st.dir * 0.9; st.om = 0;
      st.p.w = warn({ x: A.bx, y: A.by, a: st.ang, life: T, w: 6 }); cue('chime');
      st.p.next = 240;   /* the mod's 235, five frames late so its aim line shows the full 24 f */
    }
    if (st.p.w && f < 245) { st.p.w.x = A.bx; st.p.w.y = A.by; }
    /* f 405 and f 490 tolls (ClockConstellation.cs, rubric 5): she stops, a
       ring of nine ramped shots bursts with a three-gap on the soul, then
       the spin runs back the other way */
    if (f === 405 || f === 490) {
      st.dir = -st.dir; st.om = 0;
      ringRamp(A.bx, A.by, 9, V(7), aim(), 8, 3);
      cue('chime'); kick('small');
    }
    if (f >= 245 && f < 565) {
      om = 0.024 * (L >= 3 ? 1.15 : 1);
      st.om = Math.min(om, st.om + om / 40);
      if (f > 245) st.ang += st.dir * st.om;
      if (f === 245) { st.on = G.fr; kick('small'); cue('giga'); }
      G.beam = { x: A.bx, y: A.by, a: st.ang, len: beamLen(), on: st.on, w: anyActive('combo') ? 0.6 : 1 };
      if (f % 3 === 0) { var tp = rayTip(A.bx, A.by, st.ang); sparks(tp.x, tp.y, 2, st.ang + Math.PI, 1.6, 160); }
    }
    gc = Math.max(45, (L >= 3 ? 57 : 75) - 6 * st.n) * (G.thin ? 2 : 1);
    tg = 24;
    if (st.p.next && f === st.p.next - tg) {
      st.p.ga = aim();
      warn({ x: A.bx, y: A.by, a: st.p.ga, life: tg, w: 3, len: 260 });
    }
    if (st.p.next && f === st.p.next && f < 565) {
      shotRamp(A.bx, A.by, st.p.ga, V(L >= 3 ? 11.75 : 10.5), 2, { tag: 'gig', fuse: 2.4 });
      cue('giga'); st.n++; st.p.next = f + gc;
    }
    if (f === 541) warn({ x: A.bx, y: A.by, r: 40, life: 24, w: 3 });
    if (f === 565) { G.beam = null; finale(14, V(7)); }
    return f >= 640;
  };

  /* SupremeCalamitas.cs:1607-1767 (BrimstoneJewelBeam). She teleports to 600
     px beside the soul and charges for 142 f. Then a beam for 360 f sweeps
     1.25 turns (x1.3 at phase 2+), starting half a sweep behind the soul.
     Darts (speed 16) aimed at the soul, a bomb every 60 f (50 at phase 2+),
     fused 120 f.
     dodge: lead the sweep round her; weave the darts, which leave her slow.
     WotG pass. Embers fall in on her through the charge; the beam's first
     line is shown teleT(36) f before it lights. Its turn rate ramps up over
     60 f, then holds. The dart gap shrinks a frame each 90 f (10 -> 6, 8 -> 4
     at phase 2+). Darts ramp from 0.45 speed. Each bomb shows a closing ring
     where it will stop. Her beam lights with a hitstop; it ends on the
     gap-ring finale.
     entry: soul anywhere (she places herself). exit: soul still, beside her.
     ceiling: the suicide-bomber rituals every 85 f are not spawned, and the
     source's 3330 px beam is clipped to the arena diagonal. */
  ATK.BrimstoneJewelBeam = function (st) {
    var f = st.f, P2 = G.lvl >= 2, T = teleT(36), spin = TAU * 1.25 * (P2 ? 1.3 : 1), a, r, om;
    if (f === 0) {
      st.side = RNG() < 0.5 ? -1 : 1;
      A.boom(A.bx, A.by);
      A.setBoss(hx(A.px + st.side * D(600)), hy(A.py));
      sparks(A.bx, A.by, 16, 0, TAU, 200);
    }
    if (f < 142) {
      A.anim('charge_telegraph');
      if (f % 6 === 0) sparks(A.bx, A.by, 3, RNG() * TAU, 0.6, -120, 70);
      if (f === 142 - T) {
        st.a0 = aim() - spin / 2; st.ang = st.a0; st.om = 0;
        warn({ x: A.bx, y: A.by, a: st.a0, life: T, w: 6 }); cue('chime');
      }
      return false;
    }
    var lf = f - 142;
    if (lf === 0) { st.on = G.fr; A.sfx('giga'); kick('medium'); }
    A.anim('casting');
    om = spin / 330;
    st.om = Math.min(om, st.om + om / 60);
    if (lf > 0) st.ang += st.om;
    G.beam = { x: A.bx, y: A.by, a: st.ang, len: beamLen(), on: st.on, w: 1 };
    if (lf % 3 === 0) { var tp = rayTip(A.bx, A.by, st.ang); sparks(tp.x, tp.y, 2, st.ang + Math.PI, 1.6, 160); }
    a = aim();
    if (lf % Math.max(P2 ? 4 : 6, (P2 ? 8 : 10) - ((lf / 90) | 0)) === 0) {
      shotRamp(A.bx, A.by, a, V(16), 0, { tag: 'brim', fuse: 6 });
    }
    if (lf % (P2 ? 50 : 60) === 0 && lf < 330) {
      bomb(A.bx, A.by, Math.cos(a) * V(12), Math.sin(a) * V(12), 120, 12, V(6));
      r = restAt(A.bx, A.by, a, V(12), 120);
      warn({ x: r.x, y: r.y, r: 30, life: 120, w: 2 });
    }
    if (lf === 360) { G.beam = null; finale(12, V(6.5)); }
    return lf >= 400;
  };

  /* SupremeCalamitas.cs:1488-1606 (SummonSuicideBomberDemons). She hovers 600
     px to one side and 300 px above the soul. Eight demons (six before phase
     1) are summoned every 6 f on a 225 px ring. Each waits 45 f, then homes
     at speed 7 and bursts into ten darts on the soul or when its fuse runs
     out. Darts every 32 f (27 at phase 1+) while the soul is 320 px away:
     five (seven at phase 1+) at speed 7.5, spread +-0.45 rad. The side flips
     every six volleys. ends at f 675 (687 at phase 1+).
     ceiling: the demon's chase speed is a guess (the notes do not read
     SuicideBomberDemonHostile.cs); the ritual circle is not drawn.
     WotG pass. verb: hunt. dodge: keep crossing the demons' paths; every
     burst ring opens a two-dart gap on the side facing the soul, so a demon
     that pops beside you leaves a lane out. telegraph: each summon point
     rings in 24 f before its demon steps out; each fan shows its locked aim
     line for at least 24 f. speed: demons ramp 0 -> 7 (V .25/f),
     darts ramp .45 -> 1 (LightDagger.cs:89-92). escalation: the cadence
     drops 1 f a volley (floor 16), a dart is added every second volley (cap
     9); peak: at the end every demon left detonates, 4 f apart. busy: two
     fewer darts. entry: any. exit: soul mid-box and moving, field settled. */
  function demonBurst(b) {
    ringRamp(b.x, b.y, 10, V(6), 0, Math.round(Math.atan2(A.py - b.y, A.px - b.x) / (TAU / 10) - 0.5), 2);
    kick('small');
  }
  ATK.SummonSuicideBomberDemons = function (st) {
    var f = st.f, L = G.lvl, nd = L >= 1 ? 8 : 6, end = L >= 1 ? 687 : 675, i;
    if (f === 0) { st.side = A.bx < A.px ? -1 : 1; st.next = 45; st.p.demons = []; }
    move(A.px + st.side * D(600), A.py - D(300), 0.1);
    if (f % 6 === 0 && f < 6 * nd) {
      var q = (f / 6) * TAU / nd;
      (function (sx, sy) {
        warn({ x: sx, y: sy, r: 20, w: 2, life: 24 });
        later(24, function () {
          var d = A.shot(sx, sy, 0, 0, 3, { tag: 'demon', fuse: 7, prox: 12, onEnd: demonBurst });
          if (d) {
            /* the blast ring rides on its demon until the fuse runs out */
            d.ring = warn({ x: sx, y: sy, r: V(6), rFill: true, w: 3, life: 24 });
            st.p.demons.push({ b: d, t: G.fr, v: 0 }); fx().mine.push(d);
          }
        });
      })(A.bx + Math.cos(q) * D(225), A.by + Math.sin(q) * D(225));
      if (f === 0) cue('chime');
    }
    var list = st.p.demons;
    for (i = 0; i < list.length; i++) {
      var m = list[i], b = m.b;
      /* the ring re-arms every 24 f (warn caps life at 30) and ends with its fuse */
      if (b.ring) { b.ring.x = b.x; b.ring.y = b.y; if (G.fr - b.ring.at >= 24) b.ring.at = G.fr; if (b.fuse <= 0) b.ring.life = 0; }
      if (b.fuse <= 0 || G.fr - m.t < 45) continue;
      m.v = Math.min(m.v + V(0.25), V(7));
      var ha = Math.atan2(A.py - b.y, A.px - b.x);
      b.vx = Math.cos(ha) * m.v; b.vy = Math.sin(ha) * m.v;
    }
    st.p.demons = list.filter(function (m) { return m.b.fuse > 0; });
    /* aimed at the soul at any range, aim locked when the line shows */
    if (f === st.next && f < end - 30) {
      var rate = Math.max(24, (L >= 1 ? 27 : 32) - st.vol), T = Math.max(24, Math.min(rate - 4, teleT(rate)));
      var n = Math.min(9, (L >= 1 ? 7 : 5) + (st.vol >> 1)) - (busy() ? 2 : 0), base = aim(), ox = A.bx, oy = A.by;
      st.next += rate;
      warn({ x: ox, y: oy, kind: 'fan', a0: base - 0.45, a1: base + 0.45, r: D(1500), w: 4, life: T });
      later(T, function () {
        for (var j = 0; j < n; j++) shotRamp(ox, oy, base + lerp(-0.45, 0.45, j / (n - 1)), V(7.5), 0, { tag: 'brim', fuse: 6 });
      });
      if (++st.vol % 6 === 0) {
        st.side = -st.side;
        A.setBoss(hx(A.px + st.side * D(600)), hy(A.py - D(300)));
        A.boom(A.bx, A.by);
      }
    }
    if (f === end) {
      for (i = 0; i < st.p.demons.length; i++) st.p.demons[i].b.fuse = (i * 4 + 1) / 60;
      kick('medium');
    }
    if (f === end + 40) settle();
    return f >= end + 50;
  };

  /* SupremeCalamitas.cs:1451-1487 (BecomeBerserk). She stands at the soul for
     95 f, then teleports 450 px above it and berserk turns on. The next attack
     is one of the three berserk picks (see cycleNext). A ring of twelve darts
     marks the teleport (DemonicExplosion, MaxRadius 500).
     ceiling: the source's slowdown (velocity x0.95) is not applied.
     WotG pass. verb: snap. dodge: step out radially between the darts of
     ring 1, then again for ring 2 (turned half a step, so it fills ring
     1's gaps: sideways does not work, out does). telegraph: the arena dims
     over the 95 f wind-up while a ring closes on her landing spot; the spot
     follows the soul until f 75, then locks. escalation: ring 2 is faster
     (V 13 vs 10); the snap is the peak (large kick: hit-stop, one flash).
     Owns the screen (loud). entry: any. exit: she is 450 px above the soul,
     rings outbound, dim lifting; a berserk pick follows. */
  ATK.BecomeBerserk = function (st) {
    var f = st.f, w = st.p.w;
    if (f === 0) {
      loud(true, 0.25); cue('chime'); A.anim('charge_telegraph');
      w = st.p.w = warn({ x: 0, y: 0, r: 60, w: 4, rFill: true, life: 96 });
    }
    if (f < 75) { w.x = hx(A.px); w.y = hy(A.py - D(450)); }
    if (f === 95) {
      G.berserk = true;
      A.setBoss(w.x, w.y);
      A.anim('idle');
      ringRamp(A.bx, A.by, 12, V(10), 0);
      kick(rm() ? 'medium' : 'large', true);
      A.sfx('maelstrom');
      later(14, function () { ringRamp(A.bx, A.by, 12, V(13), TAU / 24); });
      later(40, function () { loud(false); });
    }
    return f >= 96;
  };

  /* SupremeCalamitas.cs:1774-1812 (SummonShadowDemon). The phase-one gate. The
     shadow demon arrives at f 170 (SupremeCalamitas.cs:1789-1800).
     ceiling: the ShadowDemon NPC and its black screen are not drawn; its two
     attacks run from the cycle instead, and its arrival is a dart ring here.
     WotG pass. verb: arrive. dodge: keep distance through the dim, step out
     radially through ring 1 (8) and ring 2 (12, turned half a step), then
     sidestep the 5-fan off its locked line. telegraph: the arena dims from
     f 0 (the demon's black screen, to 0.55), a ring closes on her from f
     140, the fan's aim line ramps 24 f. escalation: 8 -> 12 -> fan, 20-24 f
     apart, each faster. Owns the screen (loud) until the fan. entry: she is
     idle, soul anywhere. exit: the dim lifts at the fan, f 224. */
  ATK.SummonShadowDemon = function (st) {
    if (st.f === 0) { A.anim('idle'); loud(true, 0.55); }
    if (st.f === 140) { warn({ x: A.bx, y: A.by, r: 96, w: 4, rFill: true, life: 30 }); cue('chime'); }
    if (st.f === 170) {
      ringRamp(A.bx, A.by, 8, V(8), 0);
      A.sfx('fireblast');
      kick('medium', true);
      later(20, function () { ringRamp(A.bx, A.by, 12, V(9), TAU / 24); });
      later(30, function () {
        var a = aim(), x = A.bx, y = A.by;
        warn({ x: x, y: y, a: a, w: 2, life: 24 });
        later(24, function () {
          for (var j = -2; j <= 2; j++) shotRamp(x, y, a + j * 0.225, 170, 0, { tag: 'brim', fuse: 6 });
          loud(false);
        });
      });
      return true;
    }
    return false;
  };

  /* ShadowDemon.cs:152-155 (ReleaseExplodingShadowBlasts, PARTIAL in the
     notes). Eight shadow flames out from her, each fused 32 f (ShadowFlameBlast
     Lifetime, ShadowFlameBlast.cs:12) into a twelve-dart ring.
     ceiling: the cadence is the notes' best reading, not verified line by line.
     WotG pass. verb: bloom. dodge: stand between two warning rings (each
     marks where a flame bursts), then weave out while the burst darts are
     still slow. telegraph: every burst point rings in for the flame's 32 f
     flight. escalation: two waves; wave 2 is turned half a step, faster,
     12 darts a ring not 10 (the peak). busy (beam, bolts, worm set-piece):
     wave 2 is dropped. entry: any. exit: field settled at f 170. */
  function shadowWave(sp, a0, rn, rsp) {
    for (var i = 0; i < 8; i++) {
      var a = a0 + i * TAU / 8, vx = Math.cos(a) * sp, vy = Math.sin(a) * sp;
      warn({ x: A.bx + vx * 32 / 60, y: A.by + vy * 32 / 60, r: rsp, rFill: true, w: 3, life: 32 });
      var b = A.shot(A.bx, A.by, vx, vy, 5, { tag: 'shadow', fuse: 32 / 60,
        onEnd: function (b) { ringRamp(b.x, b.y, rn, rsp, a0); kick('small'); } });
      if (b) fx().mine.push(b);
    }
    cue('chime');
  }
  ATK.ShadowDemon_ReleaseExplodingShadowBlasts = function (st) {
    if (st.f === 0) shadowWave(V(10), 0, 10, V(6));
    if (st.f === 60 && !busy()) shadowWave(V(11), TAU / 16, 12, V(7));
    if (st.f === 160) settle();
    return st.f >= 170;
  };

  /* ShadowDemon.cs:152-155 (ShadowGigablastsAndCharges, PARTIAL in the notes).
     Three gigablasts aimed at the soul, every 20 f, then a 30 f dash through
     her line of aim.
     ceiling: the demon's own timings are not verified against source.
     WotG pass. verb: charge. dodge: sidestep each blast's locked line, then
     step off the wide dash lane. Every blast shows its line for at least
     24 f; the dash lane warns for 30 f. The last shot lands before the dash.
     escalation: blasts 26/20 f apart, each
     15 % faster; the dash is the peak (medium kick, afterimages). busy:
     blasts 20 % slower. entry: any. exit: she is across the box, settled. */
  ATK.ShadowDemon_ShadowGigablastsAndCharges = function (st) {
    var f = st.f, i;
    for (i = 0; i < 3; i++) if (f === [0, 26, 46][i]) (function (i) {
      var a = aim(), x = A.bx, y = A.by, T = Math.max(24, teleT(26 - 6 * i)), sp = V(9.4) * (1 + 0.15 * i) * (busy() ? 0.8 : 1);
      warn({ x: x, y: y, a: a, w: 3, bw: i === 0 ? 24 : 16, life: T });
      if (!i) cue('chime');
      later(T, function () {
        shotRamp(x, y, a, sp, 2, { tag: 'gig', fuse: 1.6 });
        A.sfx('giga'); kick('small');
      });
    })(i);
    if (f === 84) {
      var b = aim(); st.dx = Math.cos(b); st.dy = Math.sin(b);
      warn({ x: A.bx, y: A.by, a: b, w: 8, bw: 24, len: V(30) * 0.5 + 20, life: 30 });
    }
    if (f === 114) { kick('medium'); A.sfx('fireblast'); }
    if (f >= 114 && f < 144) {
      A.setBoss(hx(A.bx + st.dx * V(30) * TF), hy(A.by + st.dy * V(30) * TF));
      if (f % 4 === 0) G.after.push({ x: A.bx, y: A.by, at: G.fr });
    }
    if (f === 158) settle();
    return f >= 168;
  };

  /* SupremeCalamitas.cs:2047-2129 (PhaseTransition). She clears the field,
     drops a ring of sixteen darts 600 px out, teleports 450 px above the soul,
     and waits 105 f. The next attack is the head of G.queue, set by the gate:
     a pending lightning first, then shadow demon, brothers, seekers or desperation.
     WotG pass. verb: reset. dodge: ring 1 (16) opens a 3-dart gap toward
     the soul: hold under her and drift into it; ring 2 (20, turned half a
     step) asks for one radial step. telegraph: blackout to 0.6
     (MomentOfCreation.cs:145-146) and a ring closing on her for 36 f.
     escalation: 16 then 20 darts, V 12 then 14; ring 2 is the peak (large
     kick: hit-stop). Owns the screen (loud). entry: any (the gate cut the
     last attack; the field is cleared). exit: dim lifts at f 90, soul
     below her, rings outbound; the queue's attack starts at f 105. */
  ATK.PhaseTransition = function (st) {
    if (st.f === 0) {
      A.clearAll();
      A.setBoss(hx(A.px), hy(A.py - D(450)));
      G.berserk = false;
      A.anim('idle');
      loud(true, 0.6);
      warn({ x: A.bx, y: A.by, r: 48, w: 3, life: 36 });
      kick('medium', true);
      A.sfx('maelstrom');
    }
    if (st.f === 36) {
      ringRamp(A.bx, A.by, 16, V(12), 0, Math.round(aim() / (TAU / 16) - 1), 3);
      kick('medium', true);
    }
    if (st.f === 64) { ringRamp(A.bx, A.by, 20, V(14), TAU / 40); kick('large', true); }
    if (st.f === 90) loud(false);
    return st.f >= 105;
  };

  /* Arena Shrink (the final all-out). Over 1200 f the playable box closes 15%
     on each side (G.box, which the walls and her position follow; the soul is
     not clamped to it). Every edge throws a row of ten flames inward at 95
     px/s, every 36 f falling to every 12 f by the end, with a two-flame gap
     that walks along each wall. No telegraphs: the gap is read from the flames
     themselves. Dodge: stay off the edge the walls are coming from. */
  ATK.ArenaShrinkFlameWalls = function (st) {
    var f = st.f, D_ = 1200, s = Math.min(1, f / D_) * 0.15, i, e, t, gp, cad, x, y, vx, vy, b, n = 10, fs = 95;
    var wx = A.AW * s, wy = A.AH * s;
    G.box = { x: A.AX + wx, y: A.AY + wy, w: A.AW - 2 * wx, h: A.AH - 2 * wy };
    b = G.box;
    move(A.AX + A.AW / 2, A.AY + A.AH / 2, 0.04);
    cad = Math.round(36 - 24 * Math.min(1, f / D_));
    if (f % cad === 0) {
      gp = (f / cad) | 0;
      for (e = 0; e < 4; e++) for (i = 0; i < n; i++) {
        if ((((i - gp) % n) + n) % n < 2) continue;
        t = (i + 0.5) / n;
        if (e === 0) { x = b.x + t * b.w; y = b.y; vx = 0; vy = fs; }
        else if (e === 1) { x = b.x + t * b.w; y = b.y + b.h; vx = 0; vy = -fs; }
        else if (e === 2) { x = b.x; y = b.y + t * b.h; vx = fs; vy = 0; }
        else { x = b.x + b.w; y = b.y + t * b.h; vx = -fs; vy = 0; }
        A.shot(x, y, vx, vy, 0, { tag: 'brim', fuse: 7 });
      }
    }
    return f >= D_;
  };

  /* Desperation, the chain. Brimstone Lightning (sub 0, so it is the forced
     first attack), the port's flame pillars, Calamitous Rend with six cuts,
     the bomb bullet hell, Gravity of Ruin in the blue soul (with the low
     ceiling), the dart walls, the rapid teleports, then the final all-out
     that shrinks the arena and thickens the walls.
     Each step runs its own attack on its own state; G.desp.stage names the step
     for the music and the visuals. She is invulnerable through the chain and
     wins when the final all-out ends. */
  var DESP = ['BrimstoneLightning', 'FlamePillars', 'CalamitousRend', 'BombBulletHell', 'GravityOfRuin',
              'DartWallRain', 'RapidTeleports', 'ArenaShrinkFlameWalls'];
  /* the look's four stages (boss-scal despLevel): each restored substate
     rides the stage of the step before it */
  var DESP_STAGE = ['lightning', 'lightning', 'rend', 'rend', 'gravity', 'gravity', 'gravity', 'final'];
  function titleCard(name) {
    fx().title = { at: G.fr, text: name.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase() };
    cue('chime');
  }
  ATK.DesperationPhase = function (st) {
    if (st.f === 0) {
      A.invuln(true); G.sub = 0; G.desp = G.desp || { stage: '' }; G.desp.stage = DESP_STAGE[0];
      st.p.s = newSt();
      G.hist.push({ name: DESP[0], lvl: G.lvl, f: G.fr });
      titleCard(DESP[0]);
    }
    if (ATK[DESP[G.sub]](st.p.s)) {
      if (DESP[G.sub] === 'GravityOfRuin') blueOff();
      if (G.sub === DESP.length - 1) { A.win(); return true; }
      G.sub++; st.p.s = newSt();
      G.desp.stage = DESP_STAGE[G.sub];
      G.hist.push({ name: DESP[G.sub], lvl: G.lvl, f: G.fr });
      titleCard(DESP[G.sub]);
    } else st.p.s.f++;
    return false;
  };
  /* Specials: the Sepulcher, the brothers and the seekers are bodies that
     boss-scal.js runs. The attack starts one and waits until it is done. */
  /* While the worm is up she is not parked. She orbits the soul at 140-260 px:
     the angular speed is 0.6-1.5 rad/s and reverses every 1.2-3 s; the radius
     drifts toward a new target in the band every 1.5-3 s; every 5-7 s she
     telegraphs a reposition (a 0.5 s flicker) and jumps to a new bearing. The
     worm chases her, so its body sweeps round the soul. Every 2.5 s she throws a
     five-dart fan at the soul, telegraphed by a red line for 0.5 s. */
  function wormOrbit(st) {
    var o = st.p.orb, f = st.f - 271;
    if (!o) o = st.p.orb = { ang: aim() + Math.PI, w: 0.9, rev: 2, r: 200, rr: 200, rt: 2, jump: 6, tele: 0, next: 0, sg: 1 };
    o.rev -= TF;
    if (o.rev <= 0) { o.w = o.sg * rnd(0.6, 1.5); o.sg = -o.sg; o.rev = rnd(1.2, 3); }
    o.rt -= TF;
    if (o.rt <= 0) { o.rr = rnd(140, 260); o.rt = rnd(1.5, 3); }
    o.r += (o.rr - o.r) * Math.min(1, TF * 1.2);
    o.jump -= TF;
    if (o.jump <= 0 && !o.tele) {
      o.next = o.ang + o.sg * rnd(1.2, 2.4);
      o.tele = 30; o.jump = rnd(5, 7);
      A.anim('charge_telegraph');
      G.tele.push({ x: A.px, y: A.py, a: o.next, at: G.fr, life: 30 });
    }
    if (o.tele && --o.tele === 0) { o.ang = o.next; A.anim('idle'); }
    o.ang += o.w * TF;
    A.setBoss(hx(A.px + Math.cos(o.ang) * o.r), hy(A.py + Math.sin(o.ang) * o.r));
    if (f % 150 === 60) {
      var a = aim();
      G.tele.push({ x: A.bx, y: A.by, a: a, at: G.fr, life: 30 });
      later(36, function () { fan(5, 0.3, 150); });
    }
  }
  ATK.SummonSepulcher = function (st) {
    /* the opening lead-in: she is quiet for 270 f (SupremeCalamitas.cs:341) */
    if (st.f === 240) warn({ x: A.bx, y: A.by, r: 60, w: 2, life: 30 });
    if (st.f === 270) A.special('worm');
    if (st.f > 270) wormOrbit(st);
    return st.f > 270 && A.specialDone('worm');
  };
  ATK.SummonBrothers = function (st) {
    /* ponytail: the ring marks the summon the frame it spawns; a lead-in
       before the spawn breaks fixes45/47/51 (brothers up within 2 frames). */
    if (st.f === 0) { warn({ x: A.bx, y: A.by, r: 50, w: 2, life: 24 }); A.special('brothers'); }
    return st.f > 0 && A.specialDone('brothers');
  };
  ATK.SummonSeekers = function (st) {
    if (st.f === 0) A.special('seekers');
    return st.f > 0 && A.specialDone('seekers');
  };

  /* ── the new attacks ─────────────────────────────────────────────────
     Infernum (SupremeCalamitas/) and WotG (Avatar/, NamelessDeity/) ports,
     adapted to bullets and to the sheets that already exist: darts,
     gigablasts, hellblasts and demon skulls. Each one names its telegraph
     and the dodge it asks for. Lines and bolts they draw are in G.tele, G.bolts,
     G.lasers, G.hexes, G.rend and G.lanes, which draw() reads. */

  /* Brimstone Lightning: a radial bolt storm. Three waves, one every 90 f. Wave
     w throws 12 + 6w bolts from her, two of them left out as a gap; the gap
     walks on a third of the bolt count each wave. Each bolt telegraphs for 36 f
     as a thin fork, then strikes for 15 f. Dodge: stand in a gap, or move
     while the forks show. */
  function boltSegs(x, y, a, L) {
    var segs = [], px = x, py = y, n = 8, step = L / n, i, pa, nx, ny, fa;
    for (i = 0; i < n; i++) {
      pa = a + (RNG() - 0.5) * 0.25;
      nx = px + Math.cos(pa) * step; ny = py + Math.sin(pa) * step;
      segs.push({ x0: px, y0: py, x1: nx, y1: ny });
      if (i === 2 || i === 5) {
        fa = pa + (RNG() < 0.5 ? -1 : 1) * (0.5 + RNG() * 0.3);
        segs.push({ x0: px, y0: py, x1: px + Math.cos(fa) * step * 1.4, y1: py + Math.sin(fa) * step * 1.4 });
      }
      px = nx; py = ny;
    }
    return segs.map(arenaSeg).filter(function (s) { return s; });
  }
  ATK.BrimstoneLightning = function (st) {
    var f = st.f, w, n, g, i, a, nw = G.lvl >= 1 ? 4 : 3, as;
    move(A.AX + A.AW / 2, A.AY + A.AH / 2, 0.05);
    if (f === 0) st.p.a0 = RNG() * TAU;
    if (f < nw * 90 && f % 90 === 0) {
      w = f / 90; n = 16 + 6 * w; g = Math.floor(w * n / 3) % n;
      A.anim('casting'); A.sfx('hellblast');
      for (i = 0; i < n; i++) {
        if ((i - g + n) % n < 2) continue;
        a = st.p.a0 + i * TAU / n + (w % 2 ? Math.PI / n : 0);
        G.bolts.push({ x: A.bx, y: A.by, a: a, end: G.fr + 51, at: G.fr + TIMING.BrimstoneLightning.tele,
                       segs: boltSegs(A.bx, A.by, a, Math.hypot(A.AW, A.AH) * 0.8) });
        warn({ x: A.bx, y: A.by, a: a, len: beamLen(), w: 2, bw: 6, life: teleT(TIMING.BrimstoneLightning.tele) });
      }
      /* and one fork on the soul, unless it already stands in the gap */
      as = aim();
      if (Math.abs(((as - (st.p.a0 + (g + 0.5) * TAU / n + (w % 2 ? Math.PI / n : 0)) + 3 * Math.PI) % TAU) - Math.PI) > 1.5 * TAU / n) {
        G.bolts.push({ x: A.bx, y: A.by, a: as, end: G.fr + 51, at: G.fr + TIMING.BrimstoneLightning.tele,
                       segs: boltSegs(A.bx, A.by, as, Math.hypot(A.AW, A.AH) * 0.8) });
      }
    }
    if (f % 90 === TIMING.BrimstoneLightning.tele && f < nw * 90) { G.lightPh++; A.shake('medium'); }
    return f >= nw * 90 - 30;
  };

  /* Hex Collapse: brimstone circles open round the arena, three waves at
     f 0, 70 and 140 of three circles (four from phase 3), one of each
     wave centred on the soul. Each shrinks over 2.5 s, then bursts into a
     ring of fourteen darts, and a second ring (turned half a step,
     faster) follows 10 f later. Dodge: leave the circle under you, then
     step between the rings. A combo thins it to two circles and one ring. */
  ATK.HexCollapse = function (st) {
    var f = st.f, k, h, n = G.thin ? 2 : (G.lvl >= 2 ? 4 : 3);
    if (f === 0 || f === 70 || f === 140) {
      for (k = 0; k < n; k++) {
        h = k === 0 ? { x: hx(A.px), y: hy(A.py) }
                    : { x: hx(A.AX + A.AW * (0.12 + 0.76 * RNG())), y: hy(A.AY + A.AH * (0.12 + 0.76 * RNG())) };
        h.at = G.fr; h.life = 150;
        G.hexes.push(h);
        later(150, (function (c) {
          return function () {
            var a0 = RNG() * TAU;
            ringRamp(c.x, c.y, G.thin ? 6 : 14, V(7), a0);
            if (!G.thin) later(10, function () { ringRamp(c.x, c.y, 14, V(8.5), a0 + TAU / 28); });
            kick('small');
          };
        }(h)));
      }
      cue('chime');
    }
    return f >= 310;
  };

  /* Predictive Charge: the telegraph aims where the soul will be when she gets
     there, from the soul's real velocity (predict()). The line holds 40 f with
     the aim fixed at the last frame. Then she charges at 900 px/s, leaving an
     afterimage every 4 f and two wake darts every 6 f, and stops with a ring. */
  ATK.PredictiveCharge = function (st) {
    var f = st.f - (st.p.f0 || 0), k, dx, dy, L, s, pa, p, T = st.p.f0 ? 26 : 40;
    if (f === 0) { st.p.tl = { x: A.bx, y: A.by, a: 0, at: G.fr, life: Math.min(30, T), bw: 24 }; G.tele.push(st.p.tl); }
    if (f < T) {
      A.anim('charge_telegraph'); A.willCharge(true);
      p = predict(A.bx, A.by, 900);
      st.p.tl.x = A.bx; st.p.tl.y = A.by; st.p.tl.a = Math.atan2(p.y - A.by, p.x - A.bx);
      st.p.tl.len = Math.hypot(p.x - A.bx, p.y - A.by) + 40;
      st.p.tx = p.x; st.p.ty = p.y;
      return false;
    }
    if (f === T) { A.willCharge(false); A.anim('charging'); }
    k = f - T;
    dx = st.p.tx - A.bx; dy = st.p.ty - A.by; L = Math.hypot(dx, dy); pa = Math.atan2(dy, dx);
    if (L <= 15 || k >= 60) {
      ringRamp(A.bx, A.by, 12, V(8), aim() + TAU / 24); A.anim('idle'); kick('small');
      /* a chain: two charges (three from phase 3), each re-aimed */
      st.p.c = (st.p.c || 0) + 1;
      if (st.p.c < (G.lvl >= 2 ? 3 : 2)) { st.p.f0 = st.f + 1; return false; }
      return true;
    }
    s = 15 / L;
    if (k % 4 === 0) G.after.push({ x: A.bx, y: A.by, at: G.fr });
    if (k % 6 === 0) {
      A.shot(A.bx, A.by, Math.cos(pa + Math.PI / 2) * 160, Math.sin(pa + Math.PI / 2) * 160, 0, { tag: 'brim', fuse: 5 });
      A.shot(A.bx, A.by, Math.cos(pa - Math.PI / 2) * 160, Math.sin(pa - Math.PI / 2) * 160, 0, { tag: 'brim', fuse: 5 });
    }
    A.setBoss(hx(A.bx + dx * s), hy(A.by + dy * s));
    if (Math.hypot(A.px - A.bx, A.py - A.by) < 24) A.hit();
    return false;
  };

  /* Converging Skulls (Infernum's spiral). She hovers at the arena centre. From
     f 30 to 210 two skulls leave every 6 f (12 f thinned) on an arm that unwinds
     inward: the arm's radius falls 330 -> 40 px and its angle turns 0.22 rad a
     step, and each skull drifts at 80 px/s toward the centre. Dodge: the
     spiral has gaps that open as it closes; move with the arm. */
  ATK.ConvergingSkulls = function (st) {
    var f = st.f, cx = A.AX + A.AW / 2, cy = A.AY + A.AH / 2, cad = G.thin ? 12 : 6, k, r, q, x, y, ia;
    var arms = !G.thin && G.lvl >= 2 ? 3 : 2, dr = 110 + 10 * Math.min(G.lvl, 3);
    move(cx, cy, 0.06);
    if (f === 0) {
      warn({ x: cx, y: cy, r: 180, w: 3, life: 30 });
      /* the arms' start headings, and the first gap between them (safe, cyan) */
      for (k = 0; k < arms; k++) warn({ x: cx, y: cy, a: k * TAU / arms, w: 2, len: 330, life: 30 });
      warn({ kind: 'fan', safe: true, x: cx, y: cy, r: 330, a0: TAU / (2 * arms) - 0.12, a1: TAU / (2 * arms) + 0.12, life: 30 });
    }
    if (f >= 30 && f < 210 && (f - 30) % cad === 0) {
      r = Math.max(40, 330 - (f - 30) * 1.6);
      /* the open gap: midway between arm 0 and arm 1, safe-marked as a fan */
      var gap = (f - 30) * 0.22 + TAU / (2 * arms);
      warn({ kind: 'fan', safe: true, x: cx, y: cy, r: r, a0: gap - 0.12, a1: gap + 0.12, life: 24 });
      G.convGapX = clamp(cx + (A.AY - cy) * Math.cos(gap) / (Math.abs(Math.sin(gap)) < 0.2 ? 0.2 : Math.sin(gap)), A.AX, A.AX + A.AW);
      for (k = 0; k < arms; k++) {
        q = (f - 30) * 0.22 + k * TAU / arms;
        x = clamp(cx + Math.cos(q) * r, A.AX, A.AX + A.AW); y = clamp(cy + Math.sin(q) * r, A.AY, A.AY + A.AH);
        ia = Math.atan2(cy - y, cx - x);
        if (k === 0) warn({ x: x, y: y, r: 12, w: 2, life: 24 });
        A.shot(x, y, Math.cos(ia) * dr, Math.sin(ia) * dr, 0, { tag: 'demon', fuse: 8 });
      }
    }
    /* the arm has run in: a final readable burst at the converge point with
       a three-gap on the soul, not the last bullets silently fusing out */
    if (f === 210) {
      ringRamp(cx, cy, 9, V(7), aim(), 8, 3);
      kick('medium'); cue('fireblast'); sparks(cx, cy, 20, 0, TAU, 200);
    }
    if (f >= 240) G.convGapX = undefined;
    return f >= 240;
  };

  /* Brimstone Rain (a falling screen with safe lanes). Ten lanes across
     the top. Every 80 f two adjacent lanes are picked safe (one from phase
     3, out of a combo) and shown for 32 f (G.lanes). Then brimstone falls
     down the other lanes every 8 f (16 thinned) at 240 px/s until the
     cycle ends. The safe lanes always move at least two lanes from the
     last ones, so the soul has to cross. Four cycles. */
  ATK.BrimstoneRain = function (st) {
    var f = st.f, L = 10, lw = A.AW / L, c = f % 80, i, x, cad = G.thin ? 16 : 8;
    var w = !G.thin && G.lvl >= 2 ? 1 : 2, s0;
    if (c === 0) {
      s0 = st.p.safe;
      do { st.p.safe = (RNG() * (L - w + 1)) | 0; } while (s0 !== undefined && Math.abs(st.p.safe - s0) < 2);
      G.lanes = { s: st.p.safe, n: w, at: G.fr, life: 80 };
      cue('chime');
    }
    /* a combo's converging gap (ComboSkullRain): no falling lane may sit within 40 px of it */
    var nearGap = function (x) { return G.convGapX !== undefined && Math.abs(x - G.convGapX) < 40; };
    if (c >= 8 && (c - 8) % cad === 0) {
      for (i = 0; i < L; i++) {
        if (i >= st.p.safe && i < st.p.safe + w) continue;
        if (nearGap(A.AX + (i + 0.5) * lw)) continue;
        warn({ x: A.AX + (i + 0.5) * lw, y: A.AY, a: Math.PI / 2, len: A.AH, w: 2, life: 24 });
      }
    }
    if (c >= 32 && (c - 32) % cad === 0) {
      for (i = 0; i < L; i++) {
        if (i >= st.p.safe && i < st.p.safe + w) continue;
        x = A.AX + (i + 0.5) * lw + ((c >> 3) % 2 ? -lw * 0.25 : lw * 0.25);
        if (nearGap(x)) continue;
        A.shot(x, A.AY - 10, 0, 240, 0, { tag: 'brim', fuse: 3 });
      }
    }
    return f >= 320;
  };

  /* Gigablast Cross (WotG's rotating arms, as Infernum's gigablasts). From
     her, four arms (five from phase 3) of gigablasts every 24 f (40 f
     thinned), the cross turning 0.018 rad a frame and running back the
     other way from f 210, so the gap you rode closes on you. Every 48 f a
     locked 3-fan of darts goes at the soul. Dodge: ride between the arms,
     turn with them at the toll. */
  function crossAng(f) { return f < 210 ? f * 0.018 : 210 * 0.018 - (f - 210) * 0.018; }
  ATK.GigablastCross = function (st) {
    var f = st.f, cad = G.thin ? 40 : 24, k, a, Tw, arms = !G.thin && G.lvl >= 2 ? 5 : 4;
    move(A.AX + A.AW / 2, A.AY + A.AH / 2, 0.05);
    /* each volley's arms show their angles teleT(cad) f ahead */
    Tw = teleT(cad);
    if (f % cad === 0 && f + cad < 420) {
      for (k = 0; k < arms; k++) {
        warn({ x: A.bx, y: A.by, a: crossAng(f + cad) + k * TAU / arms, life: Tw, w: 3, len: 330 });
      }
      if (f === 0) cue('chime');
    }
    if (f === 192) { warn({ x: A.bx, y: A.by, r: 40, w: 3, life: 24 }); cue('chime'); kick('small'); }
    if (f >= cad && f % cad === 0 && f < 420) {
      for (k = 0; k < arms; k++) {
        a = crossAng(f) + k * TAU / arms;
        A.shot(A.bx, A.by, Math.cos(a) * 165, Math.sin(a) * 165, 2, { tag: 'gig', fuse: 2.5 });
      }
      if (f % 48 === 0) A.sfx('giga');
    }
    if (!G.thin && f % 48 === 20 && f < 400) {
      var ga = aim(), x = A.bx, y = A.by;
      warn({ x: x, y: y, a: ga, w: 2, len: 220, life: 24 });
      later(24, function () { for (var j = -1; j <= 1; j++) shotRamp(x, y, ga + j * 0.14, 230, 0, { tag: 'brim', fuse: 4 }); });
    }
    return f >= 420;
  };

  /* Eye Lock (Calamitas' eyes, WotG's lock-on). Three eyes open along the
     top of the arena and lock in turn, 45 f apart; from phase 3 they go
     round twice. Each tracks the soul for 50 f with a thin lock line, then
     fires a 40 f beam along the angle it held, and throws a 3-fan at the
     soul as it lights. Locks overlap, so the next line is tracking while
     the last beam burns. Dodge: the lock line shows where the beam goes. */
  ATK.EyeLockBeams = function (st) {
    var f = st.f, k, e, n = !G.thin && G.lvl >= 2 ? 6 : 3;
    if (f === 0) {
      st.p.eyes = [];
      for (k = 0; k < 3; k++) st.p.eyes.push({ x: A.AX + A.AW * (0.2 + 0.3 * k), y: A.AY + 14, lock: 20 + k * 45, l: null });
    }
    for (k = 0; k < n; k++) {
      e = st.p.eyes[k % 3];
      if (G.thin && k === 1) continue;     /* in a combo: the middle eye stays shut */
      var lk = 20 + k * 45;
      if (f === lk) {
        e.lock = lk;
        e.l = { x: e.x, y: e.y, a: 0, len: beamLen(), at: G.fr + 50, end: G.fr + 90, tele: true };
        G.lasers.push(e.l);
      }
      if (f >= lk && f < lk + 50) e.l.a = Math.atan2(A.py - e.y, A.px - e.x);
      if (f === lk + 50 && !G.thin) {
        var a = Math.atan2(A.py - e.y, A.px - e.x);
        for (var j = -1; j <= 1; j++) shotRamp(e.x, e.y, a + j * 0.22, 210, 0, { tag: 'brim', fuse: 4 });
        kick('small');
      }
    }
    return f >= 20 + (n - 1) * 45 + 100;
  };

  /* ArcingEyeStarbursts (WotG's ArcingEyeStarburst.cs, rubric 4). Three eyes
     open along the top as in EyeLockBeams. Each shows a warn ring for
     teleT(70) f, then fires 27 starburst shots on an arc of 6.91 rad (just
     over a full turn, so the arms overlap) over 70 f: ramped 0.45 -> cap, so
     the arms wind into a near-ring that stays dodgeable while it grows.
     One eye every 70 f; the middle eye stays shut in a combo. Dodge: step
     under an eye as its ring closes, then move with the arc it throws. */
  ATK.ArcingEyeStarbursts = function (st) {
    var f = st.f, k, i, j, e, N = 27, T = 70, tap = 6.91;
    if (f === 0) {
      st.p.eyes = [];
      for (k = 0; k < 3; k++) st.p.eyes.push({ x: A.AX + A.AW * (0.2 + 0.3 * k), y: A.AY + 14, at: 60 + k * T });
    }
    for (k = 0; k < 3; k++) {
      e = st.p.eyes[k];
      if (G.thin && k === 1) continue;
      if (f === e.at - teleT(T)) {
        warn({ x: e.x, y: e.y, r: 34, life: teleT(T), w: 3, rFill: true });
        /* the arc's opening heading and where its arms sit a quarter, half and three quarters round */
        for (i = 0; i < 4; i++) warn({ x: e.x, y: e.y, a: (i * 7 * tap / N) + (k - 1) * 0.9, life: teleT(T), w: 2, len: D(420) });
      }
      if (f === e.at) {
        A.sfx('fireblast'); kick('small');
        for (i = 0; i < N; i++) {
          (function (index, k0, ex, ey) {
            later(Math.round(index * T / N), function () {
              shotRamp(ex, ey, index * tap / N + (k0 - 1) * 0.9, V(24), 0, { tag: 'burst', fuse: 6 });
            });
          })(i, k, e.x, e.y);
        }
      }
    }
    return f >= 410;
  };

  /* Darkness with Light Slashes (WotG's DarknessWithLightSlashes.cs,
     rubric 6). The arena dims to 9 % (loud owns the dark) and six slash
     volleys sweep it, one every 90 f. Each volley is four or five lanes 64
     px apart, one of them on the soul's height when the warning shows; the
     lanes show 30 f ahead, then 130 px bands of light travel the full box
     in 70 f, alternating direction. Dodge: pick a dark gap between two
     lanes; standing still is always a lane. */
  ATK.DarknessLightSlashes = function (st) {
    var f = st.f, i, dir, y0, k, n;
    move(A.AX + A.AW / 2, A.AY + A.AH * 0.2, 0.05);
    if (f === 0) { loud(true, 0.09); A.anim('casting'); }
    for (i = 0; i < 6; i++) {
      if (f !== 60 + i * 90) continue;
      dir = i % 2;
      y0 = A.py - 64 * ((RNG() * 3) | 0);
      n = G.lvl >= 2 ? 5 : 4;
      for (k = 0; k < n; k++) {
        var y = y0 + k * 64;
        if (y < A.AY + 6 || y > A.AY + A.AH - 6) continue;
        /* bw 8: the band is the 14 px the light actually hurts in, not a 130 px lane that looks unsafe */
        warn({ x: dir ? A.AX + A.AW : A.AX, y: y, a: dir ? Math.PI : 0, life: 30, w: 4, len: A.AW, bw: 8 });
        (function (d, ly) {
          later(30, function () {
            G.lasers.push({ x: d ? A.AX + A.AW : A.AX, y: ly, a: 0, len: 130, at: G.fr, end: G.fr + 70,
                            sw: d ? [A.AX + A.AW, A.AX - 130] : [A.AX - 130, A.AX + A.AW] });
          });
        })(dir, y);
      }
      cue('chime');
    }
    if (f >= 60 + 6 * 90 + 30) { loud(false); return true; }
    return false;
  };

  /* Calamitous Rend (the screen cut, a WotG reality tear). She tears the arena
     with n slashes (4 in phase 3, 5 in the desperation), one every 90 f. Each
     telegraphs for 30 f, a line growing out from the middle (G.rend, phase
     'tele'). Then the rift opens for 30 f: a 12 px band that hurts, throwing
     darts out perpendicular to the cut, both ways. The slashes alternate between
     two diagonals, so they lattice the arena. The last one passes through where
     the soul stands when it is drawn. Dodge: sit in a cell the rift misses. */
  ATK.CalamitousRend = function (st) {
    var f = st.f, n = G.lvl >= 4 ? 6 : 5, k, ang, cx, cy, L, on;
    if (f % 72 === 0 && f / 72 < n) {
      k = f / 72;
      /* every second cut, and the last, runs through the soul */
      on = k % 2 === 1 || k === n - 1;
      ang = (k % 2 ? -0.5 : 0.5) + (RNG() - 0.5) * 0.12;
      cx = on ? A.px : A.AX + A.AW * (0.2 + 0.6 * ((k * 0.37) % 1));
      cy = on ? A.py : A.AY + A.AH * (0.25 + 0.5 * RNG());
      L = Math.hypot(A.AW, A.AH);
      G.rend.push({ x1: cx - Math.cos(ang) * L, y1: cy - Math.sin(ang) * L,
                    x2: cx + Math.cos(ang) * L, y2: cy + Math.sin(ang) * L,
                    cx: cx, cy: cy, ang: ang, t: 0, phase: 'tele' });
    }
    return f >= (n - 1) * 72 + 84;
  };
  /* Judgement Cut (WotG's JudgementCut: shape and timing only). Straight light
     lines cross the arena at spread angles, JC.lines[L] of them, each drawn as
     a CalamitousRend telegraph (G.rend, phase 'tele'). Line k appears
     JC.stagger f after line 0; its own 30 f telegraph then turns the same
     segment into a slash for 30 f (the rift band, no darts). Volley 2 (phase 2+)
     comes 96 f after the first. Line 0 of a volley runs through the soul where
     it stood at the volley's start. Dodge: a gap between the lines. */
  var JC = { lines: [6, 7, 8, 9, 10], stagger: [3, 3, 3, 3, 2] };
  /* line k of volley v through (cx, cy), angle spread over pi by n lines */
  function jcLine(k, n, v, sx, sy) {
    var W = A.AW, H = A.AH, cx = sx, cy = sy, u, w, a, ca, sa, L2 = Math.hypot(W, H);
    if (k) {
      u = k * 0.618 + 0.1 * v; w = k * 0.382 + 0.37 * v;
      cx = A.AX + W * (0.12 + 0.76 * (u - Math.floor(u)));
      cy = A.AY + H * (0.12 + 0.76 * (w - Math.floor(w)));
    }
    a = 0.2 + 0.4 * v + k * Math.PI / n;
    ca = Math.cos(a); sa = Math.sin(a);
    return { x1: cx - ca * L2, y1: cy - sa * L2, x2: cx + ca * L2, y2: cy + sa * L2,
             cx: cx, cy: cy, ang: a, t: 0, phase: 'tele', jc: 1 };
  }
  ATK.JudgementCut = function (st) {
    var L = Math.min(G.lvl, 4), n = JC.lines[L], s = JC.stagger[L], vols = G.lvl >= 2 ? 2 : 1, f = st.f, v, d, k;
    move(A.AX + A.AW / 2, A.AY + A.AH * 0.2, 0.05);
    if (f === 0) A.anim('casting');
    v = (f / 96) | 0; d = f - 96 * v;
    if (v < vols && d % s === 0 && d / s < n) {
      k = d / s;
      if (k === 0) { st.p.x = A.px; st.p.y = A.py; }
      var seg = jcLine(k, n, v, st.p.x, st.p.y);
      G.rend.push(seg);
      /* one warn per slash: the same segment, shown ahead with the rift's half-width */
      warn({ x: seg.x1, y: seg.y1, a: Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1),
             len: Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1), w: 3, bw: D(20), life: 24 });
    }
    return f >= 96 * (vols - 1) + s * (n - 1) + 61;
  };
  /* a Judgement Cut lands: its beat, at most three a second (20 f apart) */
  function jcHit() {
    if (G.fr - (G.jcHit || -99) < 20) return;
    G.jcHit = G.fr;
    A.sfx('giga-hit'); A.shake('medium');
  }

  /* the cuts' clock, once per step: telegraph, then rift, then gone */
  function rendTick() {
    var i, r, u, p, sa, ca;
    for (i = G.rend.length - 1; i >= 0; i--) {
      r = G.rend[i];
      r.t++;
      if (r.phase === 'tele') {
        /* the approaching chime: ticks closing in, 16 -> 8 f apart */
        if ((r.t === 16 || r.t === 24) && NEU.sfx && NEU.sfx.tick) NEU.sfx.tick();
        if (r.t >= 30) {
          r.phase = 'rift'; r.t = 0;
          if (r.jc) jcHit(); else { A.sfx('giga-hit'); A.shake('medium'); }
        }
        continue;
      }
      if (r.t % 4 === 0 && !r.jc) {
        u = (RNG() - 0.5) * Math.hypot(A.AW, A.AH) * 0.8;
        p = { x: r.cx + Math.cos(r.ang) * u, y: r.cy + Math.sin(r.ang) * u };
        sa = Math.sin(r.ang); ca = Math.cos(r.ang);
        if (p.x >= A.AX && p.x <= A.AX + A.AW && p.y >= A.AY && p.y <= A.AY + A.AH) {
          A.shot(p.x, p.y, -sa * 185, ca * 185, 0, { tag: 'brim', fuse: 4 });
          A.shot(p.x, p.y, sa * 185, -ca * 185, 0, { tag: 'brim', fuse: 4 });
        }
      }
      if (r.t >= 30) G.rend.splice(i, 1);
    }
  }

  /* ── the blue soul ─────────────────────────────────────────────────
     Gravity (core/danmaku.js move): the soul falls at GRAV 900 px/s2 and
     Up jumps at 330 px/s, only from the floor or a ledge; letting go
     early cuts the climb to 132 px/s. So a held jump peaks 60.5 px over
     the floor and lasts 0.73 s; a one-frame tap still peaks about 15 px.
     The soul's centre on the floor sits EDGE (7 px) over the box bottom,
     its hit radius is 3.2.
     Everything here is a rect that hurts (G.bones), so the heights are
     exact:
       low bone, H px tall from the floor: clear when h > H - 3.8
       high bone, hangs to G px off the floor: hits when h > G - 10.2
       ceiling, C px off the floor: hits when h > C - 10.2
       lava: hits when h < 8 over its span
     Proofs, with the numbers used below:
       low 30: a full jump is over 26.2 px for 0.55 s; the bone and the
         soul overlap for (12 + 6.4) / 420 = 0.044 s. A low pair 16 f apart
         is cleared by one jump (0.27 + 0.044 < 0.55).
       tall 42: over 38.2 px for 0.41 s; one bone only.
       Every jump is centred on its bone 22 f after take-off (the parabola
         is symmetric) and lands 22 f after it, so two jumps need 44 f
         between their bones: single lows are 50 f or more apart, pairs
         16 f.
       high 26: hits above 15.8 px. On the floor you are 0, so stay down.
         A high bone comes 44 f after a low one (you have landed), and a
         low one 28 f after a high one (take-off is 22 f before it).
       ceiling 50 with low bones 16: the window is 12.2 < h < 39.8. A hop
         held 1-6 frames peaks 15-40 px: a short hop, not a jump.
       ledges are 45 px up (a held jump reaches 60.5) and the top one is
         45 px over those.
     Every bone shows for 24 f on its edge before it moves (chevrons on
     the floor, the colour of what it asks: brimstone = jump, pale blue =
     stay down). A wave comes from one side only, and the next waits for
     the last to leave, so a jump and a stay-down never meet at once. */
  function floorH() { return A.AY + A.AH - 7 - A.py; }
  function bone(kind, side, at, sp, H) {
    var x0 = side > 0 ? A.AX - 8 : A.AX + A.AW + 8, bot = A.AY + A.AH, b;
    b = { kind: kind, x0: x0, x: x0, vx: side > 0 ? sp : -sp, at: at, end: at + Math.ceil((A.AW + 24) / sp * 60),
          w: 6, side: side, y0: 0, y1: bot };
    if (kind === 'high') { b.y0 = A.AY; b.y1 = bot - (H || 26); b.w = 7; }
    else b.y0 = bot - (H || 30);
    G.bones.push(b);
    return b;
  }
  /* a fixed column of fire (a geyser at a landing spot, a pillar) */
  function column(x, half, top, at, life, kind) {
    var b = { kind: kind || 'geyser', x0: x, x: x, vx: 0, at: at, end: at + life, w: half,
              y0: top, y1: A.AY + A.AH, side: 0 };
    G.bones.push(b);
    return b;
  }
  /* one wave from one side: items [kind, frames after the last]; returns
     the frame the last bone has left the box */
  var WAVES = [
    [['low', 0], ['low', 50], ['high', 44], ['low', 28], ['low', 16]],
    [['high', 0], ['low', 28], ['tall', 52], ['high', 44], ['low', 28], ['low', 16]],
    [['low', 0], ['low', 16], ['high', 44], ['high', 22], ['low', 28], ['tall', 52], ['low', 52]],
    [['tall', 0], ['high', 44], ['low', 28], ['low', 16], ['low', 50], ['high', 44], ['tall', 28]]
  ];
  function wave(k, side, sp) {
    var w = WAVES[k % WAVES.length], t = G.fr + 24, i, b, last = G.fr;
    for (i = 0; i < w.length; i++) {
      t += w[i][1];
      b = bone(w[i][0] === 'tall' ? 'low' : w[i][0], side, t, sp, w[i][0] === 'tall' ? 42 : w[i][0] === 'low' ? 30 : 26);
      if (w[i][0] === 'tall') b.tall = true;
      last = b.end;
    }
    cue('chime');
    return last;
  }
  /* while the soul is in the air, a ring marks where it will land and a
     geyser climbs there 24 f later: keep moving through the landing */
  function landingGeyser() {
    var h = floorH(), t, x;
    if (h < 6) return false;
    /* time to fall from h with vy ~ -pvy (down positive): solve h = v t + 450 t2 */
    var v = A.pvy;
    t = (-v + Math.sqrt(Math.max(0, v * v + 1800 * h))) / 900;
    x = hx(A.px + A.pvx * t);
    warn({ x: x, y: A.AY + A.AH - 8, r: 14, w: 2, life: 24 });
    column(x, 8, A.AY + A.AH - 64, G.fr + 24, 24);
    return true;
  }
  function blueOn() {
    soulMode('blue');
    A.sfx('maelstrom'); kick('medium');
  }
  /* three ledges, 45 px up (two) and 90 px (one): only while the floor
     burns, never with bones about, so a jump under one never lands you
     on it in the path of a pale bone */
  function ledges() {
    if (NEU.scalSoul) NEU.scalSoul.platforms = [
      { x: A.AX + A.AW * 0.12, y: A.AY + A.AH - 45, w: A.AW * 0.16 },
      { x: A.AX + A.AW * 0.72, y: A.AY + A.AH - 45, w: A.AW * 0.16 },
      { x: A.AX + A.AW * 0.42, y: A.AY + A.AH - 90, w: A.AW * 0.16 }];
  }
  function blueOff() {
    soulMode('red');
    if (NEU.scalSoul) NEU.scalSoul.platforms = null;
  }
  /* lava: the floor between x0 and x1 turns to brimstone, 40 f of glow,
     then 70 f live. Ledges stand over it. */
  function lava(x0, x1, life) {
    G.lava.push({ x0: x0, x1: x1, at: G.fr + 40, end: G.fr + 40 + (life || 70), t0: G.fr });
  }

  /* Gravity of Ruin (the blue section). The soul turns blue. 1: a bone
     wave (one side, jump the brimstone, stay under the pale ones),
     landing geysers from phase 3. 2: three ledges rise and the floor burns
     twice: first leaving one 96 px gap, then all of it, so the ledges are
     the way out; aimed 3-fans fall on you while it burns. 3 (phase 3+ and
     the desperation): the ceiling drops to 50 px and low bones run under
     it both ways in turn: short hops only. The soul goes back to red. */
  ATK.GravityOfRuin = function (st) {
    var f = st.f, L = G.lvl, p = st.p, sp = 400 + 20 * Math.min(L, 4), gx, i, a;
    if (f === 0) {
      blueOn(); p.side = A.px < A.AX + A.AW / 2 ? 1 : -1;
      p.sec = 0; p.t = 60; p.k = (RNG() * WAVES.length) | 0;
    }
    move(A.AX + A.AW / 2, A.AY + A.AH * 0.2, 0.08);
    if (p.sec === 0 && f === p.t) { p.t = wave(p.k, p.side, sp) - G.fr + f + 8; p.sec = 1; }
    if (p.sec === 1 && L >= 2 && f % 40 === 0) landingGeyser();
    if (p.sec === 1 && f >= p.t) { p.sec = 2; p.t = f; }
    if (p.sec === 2) {
      var r = f - p.t;
      if (r === 0) {
        gx = A.AX + 40 + RNG() * (A.AW - 176);
        ledges();
        lava(A.AX, gx, 70); lava(gx + 96, A.AX + A.AW, 70);
        cue('chime');
      }
      if (r === 130) { lava(A.AX, A.AX + A.AW, 80); cue('chime'); kick('small'); }
      if ((r >= 16 && r < 86) || (r >= 146 && r < 226)) {
        if ((r - 16) % 26 === 0) {
          a = aim();
          warn({ x: A.bx, y: A.by, a: a, w: 2, life: 24 });
          (function (x, y, a0) {
            later(24, function () {
              for (var j = -1; j <= 1; j++) shotRamp(x, y, a0 + j * 0.16, 230 + 20 * L, 0, { tag: 'brim', fuse: 4 });
            });
          })(A.bx, A.by, a);
        }
      }
      if (r >= 262) { p.sec = L >= 2 ? 3 : 9; p.t = f; }
    }
    if (p.sec === 3) {
      var c = f - p.t;
      if (c === 0) {
        if (NEU.scalSoul) NEU.scalSoul.platforms = null;
        G.ceil = { C: 50, at: G.fr + 36, end: G.fr + 36 + 250, t0: G.fr };
        cue('chime'); kick('small');
      }
      if (c === 40 || c === 140) {
        var sd = c === 40 ? p.side : -p.side, t0 = G.fr + 24, s2 = 330;
        for (i = 0; i < 4; i++) bone('low', sd, t0 + i * 32, s2, 16);
        cue('chime');
      }
      if (c >= 290) { p.sec = 9; p.t = f; }
    }
    if (p.sec === 9 && f - p.t >= 20 && !G.bones.length) { blueOff(); return true; }
    return false;
  };

  /* Gravity Bone Rush (the shorter blue attack, phase 2+). Three bone
     waves from alternating sides, each faster than the last; a landing
     geyser every 34 f the soul is up, and from phase 3 her darts rain on
     the floor between waves. */
  ATK.GravityBoneRush = function (st) {
    var f = st.f, L = G.lvl, p = st.p, i;
    if (f === 0) { blueOn(); p.side = A.px < A.AX + A.AW / 2 ? 1 : -1; p.n = 0; p.t = 50; p.k = (RNG() * WAVES.length) | 0; }
    move(A.AX + A.AW / 2, A.AY + A.AH * 0.18, 0.08);
    if (p.n < 3 && f === p.t) {
      p.t = wave(p.k + p.n, p.side, 380 + 30 * p.n + 15 * Math.min(L, 3)) - G.fr + f + 10;
      p.side = -p.side; p.n++;
      /* geysers from L0: three, four at L1, five at L2+ */
      var nG = L >= 2 ? 5 : L === 1 ? 4 : 3;
      for (i = 0; i < nG; i++) (function (x) {
        warn({ x: x, y: A.AY + 8, a: Math.PI / 2, w: 4, bw: 10, len: A.AH, life: 26 });
        later(26, function () { A.shot(x, A.AY + 4, 0, 300, 0, { tag: 'brim', fuse: 3 }); });
      })(A.AX + A.AW * (0.1 + 0.2 * i) + (RNG() - 0.5) * 30);
    }
    /* geysers stop at the last wave: one every 34 f would keep the bones (and the end check) alive forever */
    if (f % 34 === 17 && p.n > 0 && f < p.t) landingGeyser();
    if (p.n >= 3 && f >= p.t && !G.bones.length) { blueOff(); return true; }
    return false;
  };

  /* ── restored: the V5 fight's attacks (902cf05~1 boss-scal.js) ────────
     The fight before the Infernum port had its own cycle: dart bursts,
     homing fireblasts and gigablasts, the side hellbarrage, the twin
     charge, the five wall bullet hells and the flame-skull waves. They are
     back as attacks of their own, dressed in the WotG kit. */

  /* V5 dartBurst. She hovers 170 px over the soul; four bursts (five at
     phase 2+) 20 f apart, each an 8-dart fan at the soul with one dart
     missing. The hole walks between bursts and the fan's gap in pixels is
     capped, so standing in a gap does not last. Three sets. */
  ATK.DartBurstFans = function (st) {
    var f = st.f, L = G.lvl, nb = L >= 1 ? 5 : 4, set = 30 + nb * 20 + 30, s = Math.floor(f / set), lf = f - s * set, k;
    move(A.px, A.py - 170, 0.1);
    if (s >= 3) return true;
    if (lf === 6) { warn({ x: A.bx, y: A.by, r: 30, w: 2, life: 24 }); cue('chime'); }
    /* 24 f ahead of each burst (burst k fires at 30 + 20k): its fan and the aim line through it */
    if (lf >= 6 && lf < 6 + nb * 20 && (lf - 6) % 20 === 0) {
      k = (lf - 6) / 20;
      var n = 8 + (L >= 2 ? 2 : 0), dist = Math.max(60, Math.hypot(A.px - A.bx, A.py - A.by));
      var base = aim() + (k % 3 - 1) * 0.18, rot = Math.min(0.35, 12 * (n - 1) / (2 * dist));
      var hole = (k * 3 + s * 2) % n;
      st.dart = { n: n, base: base, rot: rot, hole: hole, sp: 180 + 35 * L };
      warn({ x: A.bx, y: A.by, kind: 'fan', a0: base - rot, a1: base + rot, r: dist, life: 24 });
      warn({ x: A.bx, y: A.by, a: base, len: dist, life: 24, w: 2, bw: D(14) });
    }
    if (lf >= 30 && lf < 30 + nb * 20 && (lf - 30) % 20 === 0) {
      var d = st.dart;
      for (var j = 0; j < d.n; j++) {
        if (j === d.hole) continue;
        shotRamp(A.bx, A.by, d.base + (j / (d.n - 1) * 2 - 1) * d.rot, d.sp, 0, { tag: 'brim', fuse: 4 });
      }
      A.anim('charging'); kick('small');
    }
    return false;
  };

  /* V5 fireblast / gigablast: homing brimstone that bursts when it comes
     within 78 px (224 Terraria px) of the soul, or when its fuse is out.
     Inertia 30 f, home speed 190 px/s (230 phase 2+). Three fireblasts,
     45 f apart (four at phase 2+), each a 12-ring; from phase 3 two
     gigablasts follow, slower, each a 16-ring. A ring shows on her hands
     before each cast. */
  function homers(st) {
    var l = st.p.home || [], i, m, b, a, sp;
    for (i = 0; i < l.length; i++) {
      m = l[i]; b = m.b;
      if (b.fuse <= 0) continue;
      a = Math.atan2(A.py - b.y, A.px - b.x); sp = m.sp;
      b.vx = (b.vx * (m.in - 1) + Math.cos(a) * sp) / m.in;
      b.vy = (b.vy * (m.in - 1) + Math.sin(a) * sp) / m.in;
      if (Math.hypot(A.px - b.x, A.py - b.y) < 78) b.fuse = 0.001;
    }
    st.p.home = l.filter(function (m) { return m.b.fuse > 0; });
  }
  function homer(st, giga, sp) {
    var a = aim();
    var b = A.shot(A.bx, A.by, Math.cos(a) * 60, Math.sin(a) * 60, giga ? 2 : 1, { tag: giga ? 'gig' : 'flame', fuse: 3,
      onEnd: function (q) { ringRamp(q.x, q.y, giga ? 16 : 12, giga ? 150 : 170, RNG() * TAU); sparks(q.x, q.y, 10, 0, TAU, 160); kick('small'); } });
    if (b) { tracked(b); (st.p.home = st.p.home || []).push({ b: b, sp: sp, in: giga ? 40 : 30 }); }
    A.sfx(giga ? 'giga' : 'fireblast'); A.anim(giga ? 'casting' : 'charging');
  }
  ATK.FireblastVolley = function (st) {
    var f = st.f, L = G.lvl, n = L >= 1 ? 4 : 3, g = L >= 2 ? 2 : 0, i;
    move(A.px + (st.side || 1) * 220, A.AY + A.AH * 0.22, 0.06);
    if (f === 0) st.side = A.bx < A.px ? -1 : 1;
    for (i = 0; i < n + g; i++) {
      var at = 30 + i * 45 + (i >= n ? 30 : 0);
      if (f === at - 24) {
        warn({ x: A.bx, y: A.by, r: i >= n ? 40 : 26, w: 2, life: 24 });
        warn({ x: A.bx, y: A.by, kind: 'fan', a0: aim() - 0.3, a1: aim() + 0.3, r: beamLen() * 0.25, life: 24 });
        warn({ x: A.bx, y: A.by, a: aim(), len: beamLen() * 0.25, w: 2, bw: D(14), life: 24 });
      }
      if (f === at) homer(st, i >= n, i >= n ? 150 : (L >= 1 ? 230 : 190));
    }
    homers(st);
    var end = 30 + (n + g) * 45 + (g ? 30 : 0) + 150;
    if (f === end - 10) settle();
    return f >= end;
  };

  /* V5 hellbarrage. Hellblasts from the arena's edge at the soul's
     height, every 20 f (16 at phase 2+), each lane locked and shown 18 f
     ahead. They cross at 220 px/s (+25 a phase). The side flips every
     six; every fourth is a pair 36 px either side of the lane, so a small
     step is not enough. 320 f. */
  ATK.SideHellbarrage = function (st) {
    var f = st.f, L = G.lvl, iv = L >= 2 ? 16 : 20, sp = 220 + 25 * Math.min(L, 3);
    if (f === 0) { st.side = A.px < A.AX + A.AW / 2 ? 1 : -1; A.sfx('hellblast'); st.n = 0; }
    move(st.side > 0 ? A.AX + 40 : A.AX + A.AW - 40, A.py, 0.08);
    A.anim('hellblast');
    if (f >= 20 && f < 320 && (f - 20) % iv === 0) {
      var y = hy(A.py + (RNG() - 0.5) * 24), side = st.side, x = side > 0 ? A.AX + 2 : A.AX + A.AW - 2, n = st.n++;
      var ys = n % 4 === 3 ? [y - 36, y + 36] : [y];
      for (var j = 0; j < ys.length; j++) warn({ kind: 'rect', x: A.AX, y: ys[j] - 8, w: A.AW, h: 16, life: 24 });
      later(24, function () {
        for (var q = 0; q < ys.length; q++) A.shot(x, ys[q], side * sp, 0, 3, { tag: 'hell', fuse: 5 });
      });
      if (st.n % 6 === 0) { st.side = -st.side; A.boom(A.bx, A.by); }
    }
    return f >= 360;
  };

  /* V5 charge. Two dashes (three at phase 3+): a 30 f wind-up for the
     first and 18 f for the rest, the line tracking the soul until 6 f
     before she goes; 420 px/s for 33 f. Touching her mid-dash hurts. Each
     dash ends in a 10-ring with a two-dart gap toward the soul. */
  ATK.TwinCharge = function (st) {
    var f = st.f, p = st.p, n = G.lvl >= 2 ? 3 : 2;
    if (f === 0) { p.c = 0; p.t = 30; p.w = warn({ x: A.bx, y: A.by, a: aim(), w: 6, bw: 24, len: 420 * 33 / 60 + 40, life: 30 }); A.willCharge(true); cue('chime'); }
    if (p.c >= n) return f >= p.t;
    if (f < p.t) {
      A.anim('charge_telegraph');
      if (p.w) { p.w.x = A.bx; p.w.y = A.by; if (p.t - f > 6) p.w.a = aim(); }
      return false;
    }
    /* p.ang, not p.a: st.p.a / st.p.b are a combo's sub-states (combo(), drawEyes), and a number there crashed every drawn frame */
    if (f === p.t) { p.ang = p.w ? p.w.a : aim(); A.willCharge(false); A.anim('charging'); kick('small'); A.sfx('fireblast'); }
    var k = f - p.t;
    if (k < 33) {
      A.setBoss(hx(A.bx + Math.cos(p.ang) * 7), hy(A.by + Math.sin(p.ang) * 7));
      if (k % 4 === 0) G.after.push({ x: A.bx, y: A.by, at: G.fr });
      if (Math.hypot(A.px - A.bx, A.py - A.by) < 26) A.hit();
      return false;
    }
    ringRamp(A.bx, A.by, 10, 190, aim(), 9, 2);
    p.c++;
    if (p.c < n) { p.t = f + 24; p.w = warn({ x: A.bx, y: A.by, a: aim(), w: 6, bw: 24, len: 420 * 33 / 60 + 40, life: 24 }); }
    else p.t = f + 30;
    return false;
  };

  /* V5 startWall / wallLine: the five wall bullet hells. Three beats 81 f
     apart; each beat fires its walls 14 f apart: a line of 22 darts from
     an edge at 230 px/s with one 108 px hole. Two horizontal walls in one
     beat share the hole's height, so one strip goes through both. The
     hell is the phase's: 1 at phase 1, up to 4 (with flame skulls) at
     phase 4. Each wall shows on its edge 22 f ahead, hole and all. */
  var WALL_BEATS = [
    [['d', 'r', 'l'], ['l', 'r'], ['d', 'l', 'r']],
    [['u'], ['r'], ['l', 'r']],
    [['d'], ['l'], ['l', 'r']],
    [['u'], ['r'], ['l', 'r']],
    [['d'], ['l', 'r'], ['d', 'l', 'r']]
  ];
  function wallLine(d, hole) {
    var i, p, x, y, sp = 230 + 15 * Math.min(G.lvl, 3), vert = d === 'd' || d === 'u';
    for (i = 0; i < 22; i++) {
      p = i / 21;
      if (vert) {
        x = A.AX + p * A.AW;
        if (Math.abs(x - hole) < 54) continue;
        A.shot(x, d === 'd' ? A.AY - 6 : A.AY + A.AH + 6, 0, d === 'd' ? sp : -sp, 0, { tag: 'brim', fuse: 4 });
      } else {
        y = A.AY + p * A.AH;
        if (Math.abs(y - hole) < 48) continue;
        A.shot(d === 'r' ? A.AX - 6 : A.AX + A.AW + 6, y, d === 'r' ? sp : -sp, 0, 0, { tag: 'brim', fuse: 4 });
      }
    }
  }
  function wallWarn(d, hole) {
    var vert = d === 'd' || d === 'u', T = 24, e;
    /* the whole sweep lane, faint, then the two edge lines and the safe gap */
    warn({ kind: 'rect', x: A.AX, y: A.AY, w: A.AW, h: A.AH, fillA: 0.12, life: T });
    if (vert) {
      e = d === 'd' ? A.AY + 3 : A.AY + A.AH - 3;
      warn({ x: A.AX, y: e, a: 0, w: 3, len: Math.max(0, hole - 54 - A.AX), life: T });
      warn({ x: A.AX + A.AW, y: e, a: Math.PI, w: 3, len: Math.max(0, A.AX + A.AW - hole - 54), life: T });
      gapMark(hole, A.AY + A.AH / 2, true, 108, T);
    } else {
      e = d === 'r' ? A.AX + 3 : A.AX + A.AW - 3;
      warn({ x: e, y: A.AY, a: Math.PI / 2, w: 3, len: Math.max(0, hole - 48 - A.AY), life: T });
      warn({ x: e, y: A.AY + A.AH, a: -Math.PI / 2, w: 3, len: Math.max(0, A.AY + A.AH - hole - 48), life: T });
      gapMark(A.AX + A.AW / 2, hole, false, 96, T);
    }
  }
  ATK.BrimstoneWalls = function (st) {
    var f = st.f, v = WALL_BEATS[Math.min(G.lvl + 1, 4)], b, i;
    move(A.AX + A.AW / 2, A.AY + A.AH * 0.12, 0.05);
    if (f === 0) { A.sfx('maelstrom'); kick('small'); }
    for (b = 0; b < 3; b++) {
      if (f !== 20 + b * 81) continue;
      var dirs = v[b], hy0 = A.AY + 70 + RNG() * (A.AH - 140);
      for (i = 0; i < dirs.length; i++) (function (d, k) {
        var hole = (d === 'l' || d === 'r') ? hy0 : A.AX + 60 + RNG() * (A.AW - 120);
        later(k * 14, function () { wallWarn(d, hole); cue('chime'); });
        later(k * 14 + 26, function () { wallLine(d, hole); });
      })(dirs[i], i);
      if (G.lvl >= 3) later(30, (function (left) { return function () { skullRow(st, left, 5); }; })(b % 2 === 0));
    }
    skulls(st);
    return f >= 20 + 3 * 81 + (G.lvl >= 3 ? 200 : 90);
  };

  /* V5 skullWave: five flame skulls cross the box in a row, each bobbing
     on its own phase (vy = 90 cos(3.2 t + 0.6 i)). Three rows from
     alternating sides 70 f apart (four at phase 3+), and between rows she
     throws a locked 5-fan. */
  function skullRow(st, fromLeft, n) {
    var l = st.p.sk = st.p.sk || [], i, y, b;
    for (i = 0; i < n; i++) {
      y = A.AY + 50 + i * (A.AH - 100) / (n - 1);
      b = A.shot(fromLeft ? A.AX - 10 : A.AX + A.AW + 10, y, (fromLeft ? 1 : -1) * (150 + 15 * Math.min(G.lvl, 3)), 0, 5,
                 { tag: 'demon', fuse: 6 });
      if (b) { l.push({ b: b, ph: i * 0.6, t: 0 }); fx().mine.push(b); }
    }
    A.sfx('hellblast');
  }
  function skulls(st) {
    var l = st.p.sk || [], i, m;
    for (i = 0; i < l.length; i++) { m = l[i]; m.t += TF; m.b.vy = Math.cos(m.t * 3.2 + m.ph) * 90; }
    st.p.sk = l.filter(function (m) { return m.b.fuse > 0; });
  }
  ATK.SkullWave = function (st) {
    var f = st.f, n = G.lvl >= 2 ? 4 : 3, k;
    move(A.AX + A.AW / 2, A.AY + A.AH * 0.15, 0.05);
    for (k = 0; k < n; k++) {
      if (f === (k === 0 ? 0 : 20 + k * 70 - 24)) {
        var fl = k % 2 === 0;
        for (var i = 0; i < 5; i++) warn({ x: fl ? A.AX + 24 : A.AX + A.AW - 24, y: A.AY + 50 + i * (A.AH - 100) / 4, r: 16, rFill: true, w: 2, life: 24 });
        cue('chime');
      }
      if (f === (k === 0 ? 24 : 20 + k * 70)) skullRow(st, k % 2 === 0, 5);
      if (f === 20 + k * 70 + 36) {
        var a = aim(), x = A.bx, y = A.by;
        warn({ x: x, y: y, a: a, w: 2, life: 24 });
        later(24, function () { for (var j = -2; j <= 2; j++) shotRamp(x, y, a + j * 0.2, 220, 0, { tag: 'brim', fuse: 5 }); });
      }
    }
    skulls(st);
    return f >= 20 + n * 70 + 220;
  };

  /* ── restored: the desperation substates of the Infernum port
     (872c0a1~1), each an attack of its own again, and the desperation
     chain runs them between the new steps. ───────────────────────── */

  /* 0: flame pillars. A strip telegraphs for 60 f, then is live for 105 f,
     and hurts the soul while it stands in it. Strips step 300 Terraria px
     across the arena every 16 f. Lost souls every 18 f from her, straight
     up, +-0.73 rad, speed 8-17 (RedirectingLostSoulProj, timeLeft 230),
     that turn down onto the soul after 40 f. */
  ATK.FlamePillars = function (st) {
    var s = st.f, p = st.p, len = G.lvl >= 4 ? 600 : 480;
    move(A.AX + A.AW / 2, A.AY + 30, 0.05);
    if (s < len - 165 && s % 16 === 0) {
      var k = p.k || 0;
      column(A.AX + 20 + ((k * D(300)) % (A.AW - 40)), 16, A.AY, G.fr + 60, 105, 'pillar');
      p.k = k + 1;
    }
    if (s < len - 60 && s % 18 === 0) {
      var sp = V(rnd(8, 17)), la = -Math.PI / 2 + rnd(-0.73, 0.73);
      warn({ x: A.bx, y: A.by, a: la, w: 2, life: 24 });
      (function (ox, oy, ca, cs) {
        later(24, function () {
          var b = A.shot(ox, oy, ca * sp, cs * sp, 0, { tag: 'soul', fuse: 230 / 60 });
          if (b) { tracked(b); (p.ls = p.ls || []).push({ b: b, t: 0 }); }
        });
      })(A.bx, A.by, Math.cos(la), Math.sin(la));
    }
    var l = p.ls || [];
    for (var i = 0; i < l.length; i++) {
      var m = l[i];
      /* the turn comes at 40 f, or at once when the soul nears the top edge:
         SCAL hovers near that edge here, so the rise must not leave the arena */
      if (!m.r && (++m.t === 40 || m.b.y < A.AY + 16)) {
        m.r = true;
        var a = Math.atan2(A.py - m.b.y, A.px - m.b.x), v = Math.hypot(m.b.vx, m.b.vy);
        m.b.vx = Math.cos(a) * v; m.b.vy = Math.sin(a) * v;
      }
    }
    p.ls = l.filter(function (m) { return m.b.fuse > 0 && !m.r; });
    return s >= len;
  };

  /* 1: bomb bullet hell. She teleports to the arena centre. Bombs in
     bursts of four (plus shape, then X shape on odd bursts); the countdown
     is 120 f, then 120 - 6n, floor 56. Darts every 56 f from f 28: seven
     forward and seven reverse, spread +-0.79 rad at 8.4. */
  ATK.BombBulletHell = function (st) {
    var s = st.f, p = st.p, len = 480;
    if (s === 0) { A.boom(A.bx, A.by); A.setBoss(A.AX + A.AW / 2, A.AY + A.AH / 2); p.cd = 90; p.bc = 0; A.sfx('maelstrom'); }
    p.cd--;
    if (p.cd === 24) warn({ x: A.bx, y: A.by, r: 36, w: 2, life: 24 });
    if (p.cd <= 0 && s < len - 60) {
      p.bc++;
      var off = p.bc % 2 ? Math.PI / 4 : 0;
      for (var i = 0; i < 4; i++) bombR(A.bx, A.by, Math.cos(i * Math.PI / 2 + off) * V(16),
                                        Math.sin(i * Math.PI / 2 + off) * V(16), 60, 16, V(6));
      p.cd = Math.max(56, 120 - 6 * p.bc);
      kick('small');
    }
    /* each volley's two fans (forward and reverse, aim locked) show 24 f ahead */
    if (s >= 60 && s < len - 30 && (s - 28 + 24) % 56 === 0) {
      p.da = aim();
      warn({ kind: 'fan', x: A.bx, y: A.by, a0: p.da - 0.79, a1: p.da + 0.79, r: D(900), life: 24 });
      warn({ kind: 'fan', x: A.bx, y: A.by, a0: p.da + Math.PI - 0.79, a1: p.da + Math.PI + 0.79, r: D(900), life: 24 });
    }
    if (s >= 84 && s < len - 30 && (s - 28) % 56 === 0) {
      for (var j = 0; j < 7; j++) {
        var d = lerp(-0.79, 0.79, j / 6);
        shotRamp(A.bx, A.by, p.da + d, V(8.4), 0, { tag: 'brim', fuse: 6 });
        shotRamp(A.bx, A.by, p.da + Math.PI + d, V(8.4), 0, { tag: 'brim', fuse: 6 });
      }
    }
    return s >= len;
  };

  /* 2: dart walls. Every 60 f a wall of darts falls from the top: 420
     Terraria px wide with a 42 px gap in the middle, walls 840 px apart
     and alternating offset (BrimstoneBarrageOld, velocity (0, 5)).
     Gigablasts aimed at the soul every 75 f, minus 4 per shot, floor 34. */
  ATK.DartWallRain = function (st) {
    var s = st.f, p = st.p, len = 600;
    move(A.AX + A.AW / 2, A.AY + 30, 0.05);
    if (s === 0) { p.gcd = 75; p.gnext = 75; p.wn = 0; p.wallBase = A.AX - D(840); }
    if (s < len - 60 && s % 60 === 0) {
      p.wallBase = A.AX + ((p.wn % 2) ? D(420) : 0) - D(840);
      for (var x0 = p.wallBase; x0 < A.AX + A.AW; x0 += D(840)) {
        var sx = Math.max(A.AX, x0), sx2 = Math.min(A.AX + A.AW, x0 + D(420));
        if (sx2 > sx) {
          warn({ kind: 'rect', x: sx, y: A.AY, w: sx2 - sx, h: A.AH, life: 24 });
          gapMark(x0 + D(210), A.AY + A.AH / 2, true, 2 * D(21), 24);
        }
      }
    }
    if (s < len - 60 && s >= 24 && (s - 24) % 60 === 0) {
      var base = p.wallBase;
      p.wn++;
      for (var x0 = base; x0 < A.AX + A.AW; x0 += D(840)) {
        for (var x = x0; x < x0 + D(420); x += 12) {
          if (x < A.AX || x > A.AX + A.AW || Math.abs(x - (x0 + D(210))) < D(21)) continue;
          A.shot(x, A.AY + 2, 0, V(5), 0, { tag: 'brim', fuse: 8 });
        }
      }
    }
    if (s >= p.gnext && s < len - 40) {
      var a = aim();
      shotRamp(A.bx, A.by, a, V(9.4), 2, { tag: 'gig', fuse: 2 });
      cue('giga');
      p.gcd = Math.max(34, p.gcd - 4);
      p.gnext = s + p.gcd;
    }
    return s >= len;
  };

  /* 3: rapid teleports. Each lands 180-455 Terraria px from the soul and
     drops a ten-dart ring. Countdown 38 f, down by 2 per teleport, floor
     4 (6 here, so a ring can still be read), twenty teleports. Each
     landing spot rings in first. */
  ATK.RapidTeleports = function (st) {
    var s = st.f, p = st.p;
    if (s === 0) { p.tc = 38; p.nt = 38; p.count = 0; p.next = null; }
    if (p.count < 20 && !p.next && s >= p.nt - 24) {
      var a = rnd(0, TAU), d = D(rnd(180, 455));
      p.next = { x: hx(A.px + Math.cos(a) * d), y: hy(A.py + Math.sin(a) * d) };
      /* the ten-dart ring's 0.4 s reach, and a line to where the boss lands */
      warn({ x: p.next.x, y: p.next.y, r: V(8) * 0.4, rFill: true, w: 3, life: 24 });
      warn({ x: A.bx, y: A.by, a: Math.atan2(p.next.y - A.by, p.next.x - A.bx), len: Math.hypot(p.next.x - A.bx, p.next.y - A.by), w: 2, bw: 0, life: 24 });
    }
    if (p.next && s >= p.nt && p.count < 20) {
      A.boom(A.bx, A.by);
      A.setBoss(p.next.x, p.next.y); p.next = null;
      ringRamp(A.bx, A.by, 10, V(8), RNG() * TAU);
      kick('small');
      p.tc = Math.max(24, p.tc - 2);
      p.nt = s + p.tc;
      p.count++;
      if (p.count === 20) p.end = s + 60;
    }
    return p.count >= 20 && s >= p.end;
  };

  /* The Infernum port's first FireLaserSpin (872c0a1~1), before the WotG
     pass gave it the reversing tolls: she casts the orb at f 165, rises at
     f 200, and its laser sweeps one full turn at a steady rate over f
     245-565, aimed at the soul when it lights. Gigablasts every 75 f from
     f 235 (57 at phase 3+). The beam's first line shows 36 f ahead. */
  ATK.FireLaserSpinClassic = function (st) {
    var f = st.f, L = G.lvl;
    move(A.AX + A.AW / 2, A.AY + A.AH * (f < 200 ? 0.4 : 0.1), 0.04);
    if (f === 165) A.anim('casting');
    if (f === 209) { st.a1 = aim(); st.p.w = warn({ x: A.bx, y: A.by, a: st.a1, w: 6, life: 36 }); cue('chime'); }
    if (st.p.w && f < 245) { st.p.w.x = A.bx; st.p.w.y = A.by; }
    if (f === 245) { st.on = G.fr; kick('small'); cue('giga'); }
    if (f >= 245 && f < 565) {
      G.beam = { x: A.bx, y: A.by, a: st.a1 + TAU * (f - 245) / 320 * (L >= 3 ? 1.15 : 1), len: beamLen(), on: st.on, w: 1 };
      if (f % 3 === 0) { var tp = rayTip(A.bx, A.by, G.beam.a); sparks(tp.x, tp.y, 2, G.beam.a + Math.PI, 1.6, 160); }
    }
    var gc = L >= 3 ? 57 : 75;
    if (f >= 211 && f < 541 && (f - 211) % gc === 0) {
      var sp = V(L >= 3 ? 11.75 : 10.5), ga = aim();
      warn({ x: A.bx, y: A.by, a: ga, w: 3, len: 260, life: 24 });
      later(24, function () { shotRamp(A.bx, A.by, ga, sp, 2, { tag: 'gig', fuse: 2.4 }); cue('giga'); });
    }
    if (f === 565) { G.beam = null; finale(12, V(7)); }
    return f >= 620;
  };

  /* A scripted combo: two attacks run together, each on its own state, with
     G.thin set so the bodies that thin their cadence do. Each one moves her
     only if the other does not, so the pair never fights over her. */
  function combo(a, b) {
    return function (st) {
      if (st.f === 0) { st.p.a = newSt(); st.p.b = newSt(); st.p.da = false; st.p.db = false; G.thin = true; }
      if (!st.p.da) { st.p.da = ATK[a](st.p.a); st.p.a.f++; }
      if (!st.p.db) { st.p.db = ATK[b](st.p.b); st.p.b.f++; }
      if (st.p.da && st.p.db) { G.thin = false; return true; }
      return false;
    };
  }
  function newSt() { return { f: 0, n: 0, sf: 0, side: 1, vol: 0, p: {} }; }
  ATK.ComboSkullRain = combo('ConvergingSkulls', 'BrimstoneRain');
  ATK.ComboEyeHex = combo('EyeLockBeams', 'HexCollapse');
  /* the spin's beam sweeps while hellblasts cross it; both at half cadence */
  ATK.ComboLaserHell = combo('FireLaserSpin', 'HellblastBarrage');

  /* PortalLaserbeams (WotG's PerpendicularPortalLaserbeams: shape and timing
     only). Each dash cycle: her reposition dash to a third of the arena, then
     portals open along the dash path PORTAL.every[L] f apart, and each fires a
     beam perpendicular to the dash from its edge. Beams are telegraphed for the
     attack's tele, then live for beamLife f. Dodge: stand between two beams. */
  var PORTAL = { count: [3, 4, 5, 5, 6], every: [18, 15, 12, 12, 10], beamLife: [40, 44, 48, 48, 52],
                 bothWays: [0, 0, 1, 1, 1], dashes: [1, 2, 2, 2, 3] };
  var PORTAL_DASH = 12;   /* f of the reposition dash itself */
  /* her dash to a third of the arena at her hover height. The path is
     telegraphed as a warn line from where she stands, then she slides along it
     in PORTAL_DASH f, leaving afterimages. p keeps the path for the portals. */
  function repositionDash(p, c, lf) {
    var TL = TIMING.PortalLaserbeams.tele;
    if (lf === 0) {
      p.x0 = A.bx; p.y0 = A.by;
      p.x1 = hx(A.AX + A.AW * (c % 2 ? 1 / 6 : 5 / 6)); p.y1 = hy(A.by);
      p.ang = Math.atan2(p.y1 - p.y0, p.x1 - p.x0);
      warn({ x: p.x0, y: p.y0, a: p.ang, len: Math.hypot(p.x1 - p.x0, p.y1 - p.y0), w: 2, life: TL });
    }
    if (lf >= TL && lf < TL + PORTAL_DASH) {
      var u = (lf - TL + 1) / PORTAL_DASH;
      A.setBoss(p.x0 + (p.x1 - p.x0) * u, p.y0 + (p.y1 - p.y0) * u);
      if ((lf - TL) % 2 === 0) G.after.push({ x: A.bx, y: A.by, at: G.fr });
    }
  }
  ATK.PortalLaserbeams = function (st) {
    var L = Math.min(G.lvl, 4), P = PORTAL, n = P.count[L], every = P.every[L], life = P.beamLife[L];
    var TL = TIMING.PortalLaserbeams.tele, PR = D(40), cyc = TL + PORTAL_DASH + (n - 1) * every + TL + life;
    var c = Math.floor(st.f / cyc), lf = st.f - c * cyc, p = st.p, k, i, j, px, py, a, dirs;
    repositionDash(p, c, lf);
    /* portal i opens once the dash is done, every[L] f after the one before */
    k = lf - TL - PORTAL_DASH;
    if (k >= 0 && k % every === 0 && k / every < n) {
      i = k / every;
      px = p.x0 + (p.x1 - p.x0) * (i + 1) / (n + 1);
      py = p.y0 + (p.y1 - p.y0) * (i + 1) / (n + 1);
      warn({ x: px, y: py, r: PR, w: 3, rFill: true, life: TL });
      a = p.ang + Math.PI / 2;
      dirs = P.bothWays[L] ? [a, a + Math.PI] : [i % 2 ? a + Math.PI : a];
      for (j = 0; j < dirs.length; j++) {
        G.lasers.push({ x: px + Math.cos(dirs[j]) * PR, y: py + Math.sin(dirs[j]) * PR, a: dirs[j],
                        len: beamLen(), at: G.fr + TL, end: G.fr + TL + life });
      }
    }
    return st.f + 1 >= P.dashes[L] * cyc;
  };

  /* ── the cycles (SupremeCalamitas.cs:188-241, in source order) ──────── */
  /* The pools, one per phase (phase 3 and 4 share the third). Each attack is
     one entry, and each pool holds BrimstoneLightning, so every phase has it
     in its bag. Each pool keeps the new attacks and has the old ones back:
     the V5 fight's (dart bursts, fireblasts, the side hellbarrage, the twin
     charge, the wall bullet hells, the skull waves), the port's own
     desperation substates (pillars, the bomb hell, the dart walls, the
     teleports) and the first FireLaserSpin.
     A bag is the whole pool shuffled and drawn to the end: no attack comes
     round again until every other one in the phase has run (see cycleNext). */
  var POOL = [
    ['HorizontalDarkSoulRelease', 'CondemnationFanBurst', 'ExplosiveCharges', 'SummonSuicideBomberDemons',
     'BrimstoneLightning', 'HexCollapse', 'PredictiveCharge', 'ComboSkullRain',
     'DartBurstFans', 'SideHellbarrage', 'TwinCharge', 'BrimstoneWalls'],
    ['CondemnationFanBurst', 'ShadowDemon_ReleaseExplodingShadowBlasts', 'HellblastBarrage', 'BrimstoneJewelBeam',
     'ExplosiveCharges', 'HorizontalDarkSoulRelease', 'SummonSuicideBomberDemons', 'BrimstoneLightning',
     'ConvergingSkulls', 'EyeLockBeams', 'ArcingEyeStarbursts', 'ComboEyeHex', 'BrimstoneRain', 'PredictiveCharge', 'GravityOfRuin',
     'FireblastVolley', 'SkullWave', 'DartWallRain', 'FlamePillars', 'GravityBoneRush', 'BrimstoneWalls', 'JudgementCut', 'PortalLaserbeams'],
    ['ShadowDemon_ShadowGigablastsAndCharges', 'FireLaserSpin', 'DarkMagicBombWalls', 'CondemnationFanBurst',
     'BrimstoneJewelBeam', 'ExplosiveCharges', 'BecomeBerserk', 'BrimstoneLightning', 'GigablastCross',
     'PredictiveCharge', 'CalamitousRend', 'DarknessLightSlashes', 'ComboSkullRain', 'ComboEyeHex', 'ComboLaserHell',
     'FireLaserSpinClassic', 'BombBulletHell', 'RapidTeleports', 'HellblastBarrage', 'ShadowDemon_ReleaseExplodingShadowBlasts',
     'GravityOfRuin', 'GravityBoneRush', 'FireblastVolley', 'SkullWave', 'BrimstoneWalls', 'TwinCharge', 'JudgementCut', 'PortalLaserbeams']
  ];
  /* SelectNextAttack after BecomeBerserk: one of these three, uniformly */
  var BERSERK_PICK = ['CondemnationFanBurst', 'ExplosiveCharges', 'HellblastBarrage'];
  /* PhaseTransition's next attack, by the phase she has just entered */
  var AFTER_PT = { 1: 'SummonShadowDemon', 2: 'SummonBrothers', 3: 'SummonSeekers', 4: 'DesperationPhase' };
  /* the phase gates: the HP share at which each phase starts */
  var GATE = [0.75, 0.45, 0.25, 0];
  /* TIMING: per attack, tele = its telegraph lead in frames (24-30 at 60 fps,
     asserted by fixes73 over a simulated fight); big = a signature pattern
     that earns the long gap. Gaps: GAP f between attacks, GAP_BIG after big. */
  var GAP = 72, GAP_BIG = 210;
  var TIMING = {
    HorizontalDarkSoulRelease: { tele: 30 }, CondemnationFanBurst: { tele: 30 }, ExplosiveCharges: { tele: 30 },
    SummonSuicideBomberDemons: { tele: 30, big: 1 }, BrimstoneLightning: { tele: 30 }, HexCollapse: { tele: 30 },
    PredictiveCharge: { tele: 30 }, ComboSkullRain: { tele: 30, big: 1 }, DartBurstFans: { tele: 24 },
    SideHellbarrage: { tele: 24 }, TwinCharge: { tele: 24 }, BrimstoneWalls: { tele: 24 },
    ShadowDemon_ReleaseExplodingShadowBlasts: { tele: 30 }, HellblastBarrage: { tele: 30 }, BrimstoneJewelBeam: { tele: 30 },
    ConvergingSkulls: { tele: 24 }, EyeLockBeams: { tele: 30 }, ArcingEyeStarbursts: { tele: 30 },
    ComboEyeHex: { tele: 30, big: 1 }, BrimstoneRain: { tele: 24 }, GravityOfRuin: { tele: 30, big: 1 },
    FireblastVolley: { tele: 24 }, SkullWave: { tele: 24 }, DartWallRain: { tele: 30, big: 1 },
    FlamePillars: { tele: 30 }, GravityBoneRush: { tele: 30 }, ShadowDemon_ShadowGigablastsAndCharges: { tele: 30 },
    FireLaserSpin: { tele: 30 }, DarkMagicBombWalls: { tele: 30 }, GigablastCross: { tele: 24 },
    CalamitousRend: { tele: 30, big: 1 }, DarknessLightSlashes: { tele: 30 }, ComboLaserHell: { tele: 30, big: 1 },
    JudgementCut: { tele: 30, big: 1 }, PortalLaserbeams: { tele: 30 },
    FireLaserSpinClassic: { tele: 30 }, BombBulletHell: { tele: 30, big: 1 }, RapidTeleports: { tele: 24 },
    BecomeBerserk: { tele: 30 }, SummonShadowDemon: { tele: 30 }, SummonBrothers: { tele: 30 },
    SummonSeekers: { tele: 30 }, SummonSepulcher: { tele: 30 }, PhaseTransition: { tele: 30 }, DesperationPhase: { tele: 30 }
  };
  /* attacks that hold her invulnerable while they run */
  var INVULN = { PhaseTransition: 1, DesperationPhase: 1, SummonSepulcher: 1, SummonBrothers: 1, SummonSeekers: 1 };

  /* A fresh bag for this phase: the whole pool, shuffled. The bag is
     drawn from the end: if that would open on the attack just finished,
     the first pick swaps with another one, so no attack runs twice in a
     row across a refill either. */
  function refill() {
    G.bag = shuffle(POOL[Math.min(G.lvl, 2)].slice());
    var n = G.bag.length - 1;
    if (n > 0 && G.bag[n] === G.last) {
      var j = (RNG() * n) | 0, t = G.bag[j];
      G.bag[j] = G.bag[n]; G.bag[n] = t;
    }
  }
  /* No repeats until the bag is empty. The berserk pick (SelectNextAttack
     after BecomeBerserk) draws from the bag as well: one of the three
     that is still in it, or the next in the bag when none of them is. An
     attack started any other way (a gate's queued lightning, a force)
     comes out of the bag in begin(). */
  function cycleNext() {
    if (!G.bag || !G.bag.length) refill();
    if (G.last === 'BecomeBerserk') {
      var c = [], i;
      for (i = 0; i < G.bag.length; i++) if (BERSERK_PICK.indexOf(G.bag[i]) >= 0) c.push(i);
      if (c.length) return G.bag.splice(c[(RNG() * c.length) | 0], 1)[0];
    }
    return G.bag.pop();
  }

  /* the phase change: next level, its queue (a lightning first if the phase had none). Returns the name to begin. */
  function gateNow() {
    var pend = G.lightPh === 0;
    G.lvl++;
    G.lightPh = 0;
    A.level(G.lvl);
    refill();
    if (G.lvl === 4) { G.desp = { stage: '' }; A.setHP(1); G.queue = [AFTER_PT[4]]; }
    else G.queue = (pend ? ['BrimstoneLightning'] : []).concat([AFTER_PT[G.lvl]]);
    return 'PhaseTransition';
  }

  function fresh() {
    return { fr: 0, ev: [], last: '', queue: [], bag: null, lvl: 0, lightPh: 0, berserk: false,
             beam: null, sub: -1, desp: null, tele: [], rend: [], bolts: [], lasers: [],
             hexes: [], after: [], lanes: null, box: null, thin: false, hist: [],
             bones: [], lava: [], ceil: null, pendN: 0, wait: 0 };
  }

  function begin(name) {
    if (name === 'PhaseTransition') {
      /* a transition clears what the last phase left running: the beam, the
         hazards and every timer still queued (bomb fuses, rings, lunges) */
      G.beam = null; G.ev = []; G.tele = []; G.rend = []; G.bolts = []; G.lasers = [];
      G.hexes = []; G.after = []; G.lanes = null; G.box = null; G.thin = false;
      if (G.fx) { G.fx.warn = []; G.fx.mine = []; G.fx.loud = false; }
    }
    /* every attack starts with nothing owning the screen: a beam or a
       blackout left by an attack that was cut short (a gate, a force, a
       death) must not carry into the next one */
    G.beam = null;
    if (G.fx) { G.fx.loud = false; G.fx.darkTo = 0; }
    /* a blue section cut short (a gate, a force) does not leak into the
       next: the soul goes red and its bones, lava and ceiling go with it */
    if (NEU.scalSoul && (NEU.scalSoul.platforms || (NEU.scalSoul.mode && NEU.scalSoul.mode() === 'blue'))) {
      NEU.scalSoul.platforms = null; soulMode('red');
    }
    G.bones = []; G.lava = []; G.ceil = null;
    /* an attack of this phase's pool that starts outside the draw (a
       queued lightning, a force) is spent from the bag all the same */
    if (G.bag) { var bi = G.bag.indexOf(name); if (bi >= 0) G.bag.splice(bi, 1); }
    /* a combo that was cut short (a gate, a force) must not leave its thinning on */
    G.thin = false;
    cur = { name: name, fn: ATK[name], st: newSt() };
    A.invuln(!!INVULN[name]);
    if (name === 'DesperationPhase') G.sub = 0;
    G.hist.push({ name: name, lvl: G.lvl, f: G.fr });
  }

  /* the breathing room after an attack: GAP f, or GAP_BIG after a big one */
  function finish() {
    G.last = cur.name;
    G.hist[G.hist.length - 1].end = G.fr;
    cur = null;
    G.beam = null;
    if (A.over()) { G.wait = Infinity; return; }
    G.wait = TIMING[G.last] && TIMING[G.last].big ? GAP_BIG : GAP;
  }
  /* the next attack after the gap. A phase gate that landed while an attack
     ran (G.pendN) starts its transition here, never in the middle of one. */
  function launch() {
    var name;
    if (G.pendN > 0) { G.pendN--; name = gateNow(); }
    else name = G.queue.length ? G.queue.shift() : cycleNext();
    begin(name);
  }

  /* a hazard that holds the soul hurts her: the beam, the lasers, the bolts in
     their strike, the rend rifts. The hit itself is boss-scal's (shield,
     i-frames, dash). */
  function hurtCheck() {
    var b = G.beam, i, k, s, bo, r, h = A.AY + A.AH - 7 - A.py;
    /* Arena Shrink: the playable box is the only safe ground. Standing
       outside it drains HP until death (i-frames gate the pace). */
    A.box = null;
    if (G.box && cur && (cur.name === 'ArenaShrinkFlameWalls' ||
        (cur.name === 'DesperationPhase' && G.desp && G.desp.stage === 'final'))) {
      var bx_ = G.box;
      var inside = (A.px >= bx_.x + 4 && A.px <= bx_.x + bx_.w - 4 &&
                    A.py >= bx_.y + 4 && A.py <= bx_.y + bx_.h - 4);
      if (!inside) { A.hit(); A.box = bx_; }
    }
    for (i = 0; i < G.bones.length; i++) {
      bo = G.bones[i];
      if (G.fr < bo.at) continue;
      if (Math.abs(A.px - bo.x) < bo.w + 3.2 && A.py > bo.y0 - 3.2 && A.py < bo.y1 + 3.2) { A.hit(); break; }
    }
    for (i = 0; i < G.lava.length; i++) {
      r = G.lava[i];
      if (G.fr >= r.at && h < 8 && A.px > r.x0 && A.px < r.x1) { A.hit(); break; }
    }
    if (G.ceil && G.fr >= G.ceil.at && h > G.ceil.C - 10.2) A.hit();
    if (b) {
      var dx = A.px - b.x, dy = A.py - b.y, c = Math.cos(b.a), sn = Math.sin(b.a);
      var along = dx * c + dy * sn, across = Math.abs(dx * sn - dy * c);
      if (along > 0 && along < b.len && across < 6 * (b.w || 1)) A.hit();
    }
    for (i = 0; i < G.bolts.length; i++) {
      bo = G.bolts[i];
      if (G.fr < bo.at) continue;
      for (k = 0; k < bo.segs.length; k++) {
        s = bo.segs[k];
        if (segDist(A.px, A.py, s.x0, s.y0, s.x1, s.y1) < 7) { A.hit(); break; }
      }
    }
    for (i = 0; i < G.lasers.length; i++) {
      if (G.fr < G.lasers[i].at) continue;
      s = laserSeg(G.lasers[i]);
      if (s && segDist(A.px, A.py, s.x0, s.y0, s.x1, s.y1) < 7 && !(A.dashI && A.dashI() > 0)) A.hit();
    }
    for (i = 0; i < G.rend.length; i++) {
      r = G.rend[i];
      if (r.phase === 'rift' &&
          Math.abs((A.px - r.cx) * Math.sin(r.ang) - (A.py - r.cy) * Math.cos(r.ang)) < 12) A.hit();
    }
  }

  /* same survivors in the same order as .filter(), without a new array and
     closure every 60 Hz step */
  function keepLive(list, fr) { for (var i = 0, n = 0; i < list.length; i++) if (fr - list[i].at < list[i].life) list[n++] = list[i]; list.length = n; }
  function keepBefore(list, fr) { for (var i = 0, n = 0; i < list.length; i++) if (fr < list[i].end) list[n++] = list[i]; list.length = n; }
  function keepYoung(list, fr, age) { for (var i = 0, n = 0; i < list.length; i++) if (fr - list[i].at < age) list[n++] = list[i]; list.length = n; }
  function step() {
    G.fr++;
    var due = [], keep = [], i, fr = G.fr;
    for (i = 0; i < G.ev.length; i++) (G.ev[i].f <= fr ? due : keep).push(G.ev[i]);
    G.ev = keep;
    keepLive(G.tele, fr);
    keepLive(G.hexes, fr);
    keepYoung(G.after, fr, 24);
    keepBefore(G.bolts, fr);
    keepBefore(G.lasers, fr);
    if (G.lanes && fr - G.lanes.at >= G.lanes.life) G.lanes = null;
    keepBefore(G.bones, fr);
    for (i = 0; i < G.bones.length; i++) if (fr >= G.bones[i].at) G.bones[i].x = G.bones[i].x0 + G.bones[i].vx * (fr - G.bones[i].at) / 60;
    keepBefore(G.lava, fr);
    if (G.ceil && fr >= G.ceil.end) G.ceil = null;
    for (i = 0; i < due.length; i++) due[i].fn();
    rendTick();
    hurtCheck();
    if (!cur) {
      if (G.wait-- > 0) return;
      launch();
    }
    var fin = cur.fn(cur.st);
    cur.st.f++;
    if (fin) finish();
  }

  NEU.scalAtk = {
    /* boss-scal.js hands over its adapter once, at load */
    attach: function (adapter) { A = adapter; },
    warn: function (o) { return G ? warn(o) : o; },
    /* the fight begins: the lead-in, which is the Sepulcher's 270 f delay */
    start: function () {
      G = fresh(); acc = 0; K = A.AW / 2000;
      RNG = NEU.rand.seeded((Math.random() * 4294967296) >>> 0);
      begin('SummonSepulcher');
    },
    /* the fight is closed */
    reset: function () {
      G = null; cur = null; acc = 0; RNG = Math.random;
      if (NEU.scalSoul) NEU.scalSoul.platforms = null;
    },
    /* per frame: whole 60 Hz frames of the attack clock (at most four) */
    tick: function (dt) {
      if (!G) return;
      K = A.AW / 2000;
      acc += dt;
      var n = 0;
      while (acc >= TF && n < 4) { acc -= TF; n++; step(); }
      if (n === 4) acc = 0;
    },
    /* the HP gates. Each one she passes starts the phase's transition; the
       transition's next attack comes from AFTER_PT. At 0 HP, after the
       seekers, the desperation phase starts instead of a win. */
    gate: function (pct) {
      if (!G) return;   /* no fight (reset ran, a shot still in flight) */
      var k = G.lvl + G.pendN;
      if (G.desp || k >= 4 || pct > GATE[k]) return;
      G.pendN++;
    },
    /* dev `skip`: the phase a starting HP share belongs to. Every gate at or
       above it is passed; a share of 2 % or less is the desperation (the
       real one runs at 1 HP, which no other phase reaches). */
    levelFor: function (frac) {
      var n = 0;
      while (n < 3 && frac <= GATE[n]) n++;
      return frac > 0 && frac <= 0.02 ? 4 : n;
    },
    /* dev `skip`: jump straight to phase n, with no transition and none of
       the summons in between (no worm, shadow demon, brothers or seekers
       replay). The lead-in is dropped too: phase n's first attack starts now. */
    setLevel: function (n) {
      if (!G) return;
      G.lvl = n; G.lightPh = 0; G.queue = []; refill();
      A.level(n);
      if (n === 4) { G.desp = { stage: '' }; A.setHP(1); G.queue = ['DesperationPhase']; }
      begin(G.queue.length ? G.queue.shift() : cycleNext());
    },
    /* the debug hook (NEU.scal.force) and the tests: run one attack now */
    force: function (name) {
      if (!G) G = fresh();
      K = A.AW / 2000; acc = 0;
      if (!ATK[name]) return false;
      /* the desperation writes G.desp.stage: give it the phase it runs in */
      if (name === 'DesperationPhase' && !G.desp) { G.lvl = 4; G.desp = { stage: '' }; }
      begin(name);
      return true;
    },
    level: function () { return G ? G.lvl : 0; },
    sub: function () { return G ? G.sub : -1; },
    attack: function () { return cur ? cur.name : ''; },
    last: function () { return G ? G.last : ''; },
    names: function () { return Object.keys(ATK); },
    /* the attack pools, for the tests and the notes */
    pools: POOL,
    /* the test hooks: every attack the machine started, with its phase and
       frame (debug.history), and the lightning strikes in this phase */
    debug: {
      get history() { return G ? G.hist : []; },
      get lightning() { return G ? G.lightPh : 0; },
      /* the live warnings (line, ring), for fixes73: each has its life in frames */
      get warns() { return G && G.fx ? G.fx.warn : []; },
      get darkTo() { return G && G.fx ? G.fx.darkTo : 0; },
      /* the combo's converging gap column (ComboSkullRain), for fixes106 */
      get convGap() { return G ? G.convGapX : undefined; }
    },
    /* the new bodies, for draw and the tests */
    beam: function () { return G ? G.beam : null; },
    teles: function () { return G ? G.tele : []; },
    rend: function () { return G ? G.rend : []; },
    bolts: function () { return G ? G.bolts : []; },
    lasers: function () { return G ? G.lasers : []; },
    /* the beams' segments as they are drawn and hit, for the tests */
    laserSegs: function () { return G ? G.lasers.map(laserSeg).filter(function (s) { return s; }) : []; },
    hexes: function () { return G ? G.hexes : []; },
    lanes: function () { return G ? G.lanes : null; },
    /* the blue section's hazards and the bag, for the tests */
    bones: function () { return G ? G.bones : []; },
    lava: function () { return G ? G.lava : []; },
    ceil: function () { return G ? G.ceil : null; },
    bag: function () { return G && G.bag ? G.bag.slice() : []; },
    box: function () { return G ? G.box : null; },
    /* the full fight arena (test-only read): desperation bullets stay inside it */
    arena: function () { return A ? { x: A.AX, y: A.AY, w: A.AW, h: A.AH } : null; },
    afterimages: function () { return G ? G.after : []; },
    pending: function () { return G ? G.ev.length : 0; },
    stage: function () { return G && G.desp ? G.desp.stage : ''; },
    /* the desperation chain and the final all-out keep every bullet disc in
       the fight box: clamp it in, and say whether it had to move (it ends then).
       A bullet born in those attacks keeps the rule after they end. */
    rim: function (b) {
      if (!b.arena) {
        if (!G || !(G.desp && G.desp.stage || cur && cur.name === 'ArenaShrinkFlameWalls')) return false;
        b.arena = true;
      }
      var x = clamp(b.x, A.AX + b.r, A.AX + A.AW - b.r), y = clamp(b.y, A.AY + b.r, A.AY + A.AH - b.r), m = x !== b.x || y !== b.y;
      b.x = x; b.y = y; return m;
    },
    /* V: the newest open rift (for the view split), or null */
    rift: function () { return liveRift(); },
    frame: function () { return G ? G.fr : 0; },
    berserk: function () { return G ? G.berserk : false; },
    /* the WotG kit for the bodies boss-scal and the set-pieces run: one
       palette, ramped warnings, ramped shots, the shake budget, cues */
    kit: {
      BRIM: BRIM, rampRGB: rampRGB, twinFlare: twinFlare, teleT: teleT,
      warn: function (o) { return G ? warn(o) : o; },
      shotRamp: function (x, y, a, sp, k, o) { return G ? shotRamp(x, y, a, sp, k, o) : null; },
      ringRamp: function (x, y, n, sp, a0, gapAt, gapN) { if (G) ringRamp(x, y, n, sp, a0, gapAt, gapN); },
      kick: function (tier, l) { if (G) kick(tier, l); },
      cue: function (n) { if (G) cue(n); },
      later: function (n, fn) { if (G) later(n, fn); },
      loud: function (on, d) { if (G) loud(on, d); },
      settle: function () { if (G) settle(); }
    },
    /* drawn over the field, under the bullets: the telegraphs, the
       beams, the new hazards */
    draw: function (ctx) {
      if (!G) return;
      var i, t, L = beamLen();
      /* lines and the beam stop at the forcefield */
      ctx.save();
      /* a throw between save and restore used to leave the arena clip on the
         context for the rest of the fight (the TwinCharge crash) */
      try {
        ctx.beginPath(); ctx.rect(A.AX, A.AY, A.AW, A.AH); ctx.clip();
        drawFx(ctx);
        /* DemonicTelegraphLine.PreDraw: Color.Red, width lerp(0.3, 3) over
           a 0-1-0 bump, opacity three times the bump, capped at 1 */
        for (i = 0; i < G.tele.length; i++) {
          t = G.tele[i];
          var k = Math.sin(Math.PI * (G.fr - t.at) / t.life), c = Math.cos(t.a), sn = Math.sin(t.a);
          var tw = Math.max(3, t.bw ? t.bw * 2 * 0.35 : 3), tg = Math.round(lerp(0x6A, 0xE0, k)), tb = Math.round(lerp(0x50, 0xC0, k));
          /* the hit band (2 bw wide) is filled under the line, to the line's own length */
          if (t.bw) {
            ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.a);
            ctx.fillStyle = 'rgba(255,60,40,' + (0.18 * k).toFixed(3) + ')';
            ctx.fillRect(0, -t.bw, t.len || L, 2 * t.bw);
            ctx.restore();
          }
          line(ctx, t.x - c * L, t.y - sn * L, t.x + c * L, t.y + sn * L, 'rgba(0,0,0,.6)', tw + 4);
          line(ctx, t.x - c * L, t.y - sn * L, t.x + c * L, t.y + sn * L,
               'rgb(255,' + tg + ',' + tb + ')', tw);
        }
        if (G.beam) beam(ctx, G.beam);
        drawNew(ctx);
        drawEyes(ctx);
        drawSparks(ctx);
      } finally { ctx.restore(); }
    }
  };

  /* The look of the new bodies (track V). Everything hot is stacked
     additively ('lighter'): a wide dim brimstone stroke, a narrower hot
     one, a white core, the Calamity way of faking bloom. Telegraphs stay
     plain red hairlines on purpose, so the dodge reads before the glow. */
  var SCARS = [];
  function glowLine(ctx, x0, y0, x1, y1, k, core) {
    line(ctx, x0, y0, x1, y1, 'rgba(150,16,24,' + (0.35 * k).toFixed(2) + ')', core * 5);
    line(ctx, x0, y0, x1, y1, 'rgba(255,70,36,' + (0.5 * k).toFixed(2) + ')', core * 2.6);
    line(ctx, x0, y0, x1, y1, 'rgba(255,190,140,' + (0.85 * k).toFixed(2) + ')', core * 1.2);
    line(ctx, x0, y0, x1, y1, 'rgba(255,255,255,' + (0.9 * k).toFixed(2) + ')', Math.max(1, core * 0.45));
  }
  /* glowSegs over a whole bolt, layer by layer: four strokeStyle sets per
     bolt, one stroke per segment per layer. Kept per-segment so the
     compositing order (and thus pixels) is identical to the original. */
  function glowSegs(ctx, segs, k, core) {
    var cols = ['rgba(150,16,24,' + (0.35 * k).toFixed(2) + ')', 'rgba(255,70,36,' + (0.5 * k).toFixed(2) + ')',
                'rgba(255,190,140,' + (0.85 * k).toFixed(2) + ')', 'rgba(255,255,255,' + (0.9 * k).toFixed(2) + ')'];
    var ws = [core * 5, core * 2.6, core * 1.2, Math.max(1, core * 0.45)], l, j, sg;
    for (l = 0; l < 4; l++) {
      ctx.strokeStyle = cols[l]; ctx.lineWidth = ws[l];
      for (j = 0; j < segs.length; j++) { sg = segs[j]; ctx.beginPath(); ctx.moveTo(sg.x0, sg.y0); ctx.lineTo(sg.x1, sg.y1); ctx.stroke(); }
    }
  }
  function glowAt(ctx, x, y, r, col, a) {
    if (NEU.danmaku && NEU.danmaku.glow) NEU.danmaku.glow(ctx, x, y, r, col, a);
  }
  function drawNew(ctx) {
    var i, j, h, bo, l, r, u, sg, k, half, ca, sa, op = ctx.globalCompositeOperation;
    var desp = !!G.desp;
    ctx.lineCap = 'round';
    /* the shrinking box: dead ground outside it, a flame wall on its edge */
    if (G.box) {
      var bb = G.box, wa;
      ctx.fillStyle = 'rgba(40,0,6,0.72)';
      ctx.fillRect(A.AX, A.AY, A.AW, bb.y - A.AY);
      ctx.fillRect(A.AX, bb.y + bb.h, A.AW, A.AY + A.AH - bb.y - bb.h);
      ctx.fillRect(A.AX, bb.y, bb.x - A.AX, bb.h);
      ctx.fillRect(bb.x + bb.w, bb.y, A.AX + A.AW - bb.x - bb.w, bb.h);
      ctx.globalCompositeOperation = 'lighter';
      wa = 'rgba(255,60,30,' + (0.3 + 0.1 * Math.sin(G.fr * 0.21)).toFixed(2) + ')';
      line(ctx, bb.x, bb.y, bb.x + bb.w, bb.y, wa, 12);
      line(ctx, bb.x, bb.y + bb.h, bb.x + bb.w, bb.y + bb.h, wa, 12);
      line(ctx, bb.x, bb.y, bb.x, bb.y + bb.h, wa, 12);
      line(ctx, bb.x + bb.w, bb.y, bb.x + bb.w, bb.y + bb.h, wa, 12);
      ctx.globalCompositeOperation = op;
      ctx.strokeStyle = '#FFB070'; ctx.lineWidth = 2;
      ctx.strokeRect(bb.x | 0, bb.y | 0, bb.w | 0, bb.h | 0);
    }
    drawBlue(ctx);
    /* hex collapse: a filled warning disc that brightens as it closes */
    for (i = 0; i < G.hexes.length; i++) {
      h = G.hexes[i];
      u = Math.min(1, (G.fr - h.at) / h.life);
      var hr = Math.max(2, 80 * (1 - u));
      ctx.fillStyle = 'rgba(255,40,30,' + (0.06 + 0.18 * u).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(h.x, h.y, hr, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,90,40,0.5)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(h.x, h.y, hr, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = op;
      ctx.strokeStyle = '#FFD0A0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(h.x, h.y, hr, 0, TAU); ctx.stroke();
      if (u > 0.8) glowAt(ctx, h.x, h.y, 28, '#FF6A3A', (u - 0.8) * 4);
    }
    if (G.lanes) {
      var lw = A.AW / 10, ln = G.lanes;
      ctx.fillStyle = 'rgba(120,255,160,' + (G.fr - ln.at < 40 ? 0.22 : 0.08).toFixed(2) + ')';
      ctx.fillRect(A.AX + ln.s * lw, A.AY, lw * (ln.n || 2), A.AH);
      ctx.fillStyle = 'rgba(160,255,190,0.7)';
      ctx.fillRect((A.AX + ln.s * lw) | 0, A.AY, 2, A.AH);
      ctx.fillRect((A.AX + (ln.s + (ln.n || 2)) * lw - 2) | 0, A.AY, 2, A.AH);
    }
    /* Brimstone Lightning. Telegraph: the fork's path as a dim red
       hairline that firms up over its 36 f. Strike: the forks in four
       additive layers, an impact bloom where each one ends, a bloom at
       her hands. */
    for (i = 0; i < G.bolts.length; i++) {
      bo = G.bolts[i];
      if (G.fr < bo.at) {
        k = 1 - (bo.at - G.fr) / 36;
        var tcol = 'rgba(255,40,40,' + (0.25 + 0.5 * k).toFixed(2) + ')';
        for (j = 0; j < bo.segs.length; j++) {
          sg = bo.segs[j];
          line(ctx, sg.x0, sg.y0, sg.x1, sg.y1, 'rgba(0,0,0,0.45)', 5);
          line(ctx, sg.x0, sg.y0, sg.x1, sg.y1, tcol, 3);
        }
        continue;
      }
      k = Math.max(0, 1 - (G.fr - bo.at) / 15);
      ctx.globalCompositeOperation = 'lighter';
      glowSegs(ctx, bo.segs, 0.4 + 0.6 * k, 3);
      ctx.globalCompositeOperation = op;
      sg = bo.segs[bo.segs.length - 1];
      if (sg && k > 0.5) glowAt(ctx, sg.x1, sg.y1, 26, '#FFD0A0', k);
      if (i === 0) glowAt(ctx, bo.x, bo.y, 64, desp ? '#FFFFFF' : '#FF6A3A', 0.6 * k);
    }
    for (i = 0; i < G.lasers.length; i++) {
      l = G.lasers[i];
      sg = laserSeg(l);
      if (!sg) continue;
      if (G.fr < l.at) {
        /* the shape it will hit: the 14 px hurt band, then a 3 px core on a dark edge */
        k = clamp(1 - (l.at - G.fr) / 30, 0, 1);
        line(ctx, sg.x0, sg.y0, sg.x1, sg.y1, 'rgba(255,60,40,' + (0.2 + 0.16 * k).toFixed(2) + ')', 14);
        line(ctx, sg.x0, sg.y0, sg.x1, sg.y1, 'rgba(0,0,0,0.5)', 7);
        line(ctx, sg.x0, sg.y0, sg.x1, sg.y1, 'rgba(255,' + (90 + (150 * k | 0)) + ',70,' + (0.8 + 0.2 * Math.sin(G.fr * 0.3)).toFixed(2) + ')', 3);
      } else {
        ctx.globalCompositeOperation = 'lighter';
        glowLine(ctx, sg.x0, sg.y0, sg.x1, sg.y1, 1, 4);
        ctx.globalCompositeOperation = op;
      }
    }
    /* Calamitous Rend. Telegraph: a hairline that flickers slowly (2 Hz)
       and thickens 1 -> 3 px while it grows; the chime is in rendTick.
       Cut: the white-hot rift (its 12 px core is the hurt band), a
       brimstone bloom either side, embers thrown off it. Afterwards a
       dark scar lingers 2 s, harmless and dim so it never reads as a
       live line. The view split is boss-scal's (NEU.scal splitOffset). */
    for (i = SCARS.length - 1; i >= 0; i--) {
      r = SCARS[i];
      u = (G.fr - r.at) / 120;
      if (u >= 1 || G.fr < r.at - 40) { SCARS.splice(i, 1); continue; }
      if (u < 0) continue;
      line(ctx, r.x1, r.y1, r.x2, r.y2, 'rgba(90,10,16,' + (0.55 * (1 - u)).toFixed(2) + ')', 3);
      line(ctx, r.x1, r.y1, r.x2, r.y2, 'rgba(255,120,60,' + (0.25 * (1 - u)).toFixed(2) + ')', 1);
    }
    for (i = 0; i < G.rend.length; i++) {
      r = G.rend[i];
      ca = Math.cos(r.ang); sa = Math.sin(r.ang);
      if (r.phase === 'tele') {
        var g = Math.min(1, r.t / 54);
        half = Math.hypot(A.AW, A.AH) * g;
        k = 0.55 + 0.35 * Math.sin(r.t * 0.21);
        /* the cut's real hurt band (12 px each side), then a core that reads on the red wash */
        line(ctx, r.cx - ca * half, r.cy - sa * half, r.cx + ca * half, r.cy + sa * half,
             'rgba(255,48,64,' + (0.10 + 0.12 * g).toFixed(2) + ')', 24);
        line(ctx, r.cx - ca * half, r.cy - sa * half, r.cx + ca * half, r.cy + sa * half,
             'rgba(0,0,0,0.5)', 7 + Math.round(3 * g));
        line(ctx, r.cx - ca * half, r.cy - sa * half, r.cx + ca * half, r.cy + sa * half,
             'rgba(255,48,64,' + k.toFixed(2) + ')', 3 + Math.round(3 * g));
        line(ctx, r.cx - ca * half, r.cy - sa * half, r.cx + ca * half, r.cy + sa * half,
             'rgba(255,230,230,' + (0.6 * g).toFixed(2) + ')', 2);
        continue;
      }
      if (!r.scar) {
        r.scar = true;
        SCARS.push({ x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2, at: G.fr + 30 });
      }
      k = Math.max(0.35, 1 - r.t / 30);
      ctx.globalCompositeOperation = 'lighter';
      line(ctx, r.x1, r.y1, r.x2, r.y2, 'rgba(160,16,24,' + (0.45 * k).toFixed(2) + ')', 40);
      line(ctx, r.x1, r.y1, r.x2, r.y2, 'rgba(255,70,30,' + (0.6 * k).toFixed(2) + ')', 22);
      line(ctx, r.x1, r.y1, r.x2, r.y2, 'rgba(255,200,150,' + (0.9 * k).toFixed(2) + ')', 12);
      line(ctx, r.x1, r.y1, r.x2, r.y2, '#FFFFFF', 5);
      /* embers: fixed seeds along the cut, thrown out and up with t */
      ctx.fillStyle = 'rgba(255,170,80,' + k.toFixed(2) + ')';
      for (j = 0; j < 28; j++) {
        var s = ((j * 0.618) % 1 - 0.5) * Math.hypot(A.AW, A.AH);
        var d = (4 + r.t * (1.2 + (j % 5) * 0.5)) * (j % 2 ? 1 : -1);
        ctx.fillRect((r.cx + ca * s - sa * d) | 0, (r.cy + sa * s + ca * d - r.t * 0.4) | 0, 2 + (j % 2), 2 + (j % 2));
      }
      ctx.globalCompositeOperation = op;
    }
    /* afterimages: her silhouette in brimstone, smeared behind a charge */
    for (i = 0; i < G.after.length; i++) {
      var af = G.after[i];
      k = 1 - (G.fr - af.at) / 24;
      if (k > 0) glowAt(ctx, af.x, af.y, 30, '#FF3A2A', 0.45 * k);
    }
    ctx.lineCap = 'butt';
  }
  /* The blue section and the fire columns. Ledges: a dark slab with a
     pale-blue top edge. Lava: the floor glows and blinks through its 40 f
     warning, then burns (a hot band, a white crust line, bubbles). The
     ceiling: a dim band whose edge firms up, then a brimstone slab with a
     white-hot underside. Bones: Undertale's, in her palette — brimstone
     for the ones you jump, pale blue for the ones you stay under. Each one
     waits on its edge for 24 f with chevrons pointing in, then crosses.
     Columns (geysers, pillars) rise as a glowing shaft. */
  var ICE = [[40, 70, 120], [90, 160, 230], [143, 216, 255], [235, 248, 255]];
  function iceRGB(t) {
    var u = 3 * clamp(t, 0, 1), i = Math.min(2, u | 0), k = u - i, a = ICE[i], b = ICE[i + 1];
    return ((a[0] + (b[0] - a[0]) * k) | 0) + ',' + ((a[1] + (b[1] - a[1]) * k) | 0) + ',' + ((a[2] + (b[2] - a[2]) * k) | 0);
  }
  function boneRect(ctx, x, y0, y1, w, rgb, a, knobs) {
    var op = ctx.globalCompositeOperation, h = Math.max(1, y1 - y0) | 0, xi = Math.round(x);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(' + rgb + ',' + (0.16 * a).toFixed(2) + ')'; ctx.fillRect(xi - w - 6, y0 | 0, 2 * w + 12, h);
    ctx.fillStyle = 'rgba(' + rgb + ',' + (0.35 * a).toFixed(2) + ')'; ctx.fillRect(xi - w - 2, y0 | 0, 2 * w + 4, h);
    ctx.globalCompositeOperation = op;
    ctx.fillStyle = 'rgba(' + rgb + ',' + a.toFixed(2) + ')'; ctx.fillRect(xi - w, y0 | 0, 2 * w, h);
    ctx.fillStyle = 'rgba(255,250,240,' + (0.9 * a).toFixed(2) + ')'; ctx.fillRect(xi - 1, y0 | 0, 2, h);
    if (knobs & 1) { ctx.fillStyle = 'rgba(' + rgb + ',' + a.toFixed(2) + ')'; ctx.fillRect(xi - w - 3, y0 | 0, 2 * w + 6, 5); ctx.fillStyle = 'rgba(255,250,240,' + (0.8 * a).toFixed(2) + ')'; ctx.fillRect(xi - w - 1, (y0 | 0) + 1, 2 * w + 2, 2); }
    if (knobs & 2) { ctx.fillStyle = 'rgba(' + rgb + ',' + a.toFixed(2) + ')'; ctx.fillRect(xi - w - 3, (y1 | 0) - 5, 2 * w + 6, 5); ctx.fillStyle = 'rgba(255,250,240,' + (0.8 * a).toFixed(2) + ')'; ctx.fillRect(xi - w - 1, (y1 | 0) - 4, 2 * w + 2, 2); }
  }
  function drawBlue(ctx) {
    var i, b, t, rgb, u, op = ctx.globalCompositeOperation, bot = A.AY + A.AH, pl = NEU.scalSoul && NEU.scalSoul.platforms;
    var blue = NEU.scalSoul && NEU.scalSoul.mode && NEU.scalSoul.mode() === 'blue';
    if (blue) {
      /* the floor the soul stands on: a pale line and a faint gradient up */
      ctx.fillStyle = 'rgba(60,107,255,0.10)'; ctx.fillRect(A.AX, bot - 24, A.AW, 24);
      ctx.fillStyle = 'rgba(60,107,255,0.06)'; ctx.fillRect(A.AX, bot - 48, A.AW, 24);
      ctx.fillStyle = 'rgba(143,216,255,0.55)'; ctx.fillRect(A.AX, bot - 2, A.AW, 2);
    }
    for (i = 0; pl && i < pl.length; i++) {
      b = pl[i];
      ctx.fillStyle = 'rgba(10,14,30,0.92)'; ctx.fillRect(b.x | 0, b.y | 0, b.w | 0, 8);
      ctx.fillStyle = '#8FD8FF'; ctx.fillRect(b.x | 0, b.y | 0, b.w | 0, 2);
      ctx.fillStyle = 'rgba(143,216,255,0.35)'; ctx.fillRect((b.x | 0), (b.y | 0) + 8, 2, 6); ctx.fillRect((b.x + b.w - 2) | 0, (b.y | 0) + 8, 2, 6);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(90,160,230,0.18)'; ctx.fillRect((b.x | 0) - 2, (b.y | 0) - 4, (b.w | 0) + 4, 4);
      ctx.globalCompositeOperation = op;
    }
    for (i = 0; i < G.lava.length; i++) {
      b = G.lava[i];
      if (G.fr < b.at) {
        t = 1 - (b.at - G.fr) / 40;
        u = (G.fr >> 3) % 2 ? 1 : 0.6;
        ctx.fillStyle = 'rgba(' + rampRGB(t * 0.7) + ',' + ((0.25 + 0.5 * t) * u).toFixed(2) + ')';
        ctx.fillRect(b.x0 | 0, bot - 6, (b.x1 - b.x0) | 0, 6);
        if (G.fr % 4 === 0) sparks(b.x0 + Math.random() * (b.x1 - b.x0), bot - 4, 1, -Math.PI / 2, 0.6, 90);
        continue;
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,58,26,0.22)'; ctx.fillRect(b.x0 | 0, bot - 30, (b.x1 - b.x0) | 0, 30);
      ctx.fillStyle = 'rgba(255,58,26,0.30)'; ctx.fillRect(b.x0 | 0, bot - 18, (b.x1 - b.x0) | 0, 18);
      ctx.globalCompositeOperation = op;
      ctx.fillStyle = '#5A0000'; ctx.fillRect(b.x0 | 0, bot - 12, (b.x1 - b.x0) | 0, 12);
      ctx.fillStyle = '#C0140A'; ctx.fillRect(b.x0 | 0, bot - 12, (b.x1 - b.x0) | 0, 7);
      ctx.fillStyle = '#FF9A4A'; ctx.fillRect(b.x0 | 0, bot - 12, (b.x1 - b.x0) | 0, 2);
      ctx.fillStyle = '#FFF0D0';
      for (var q = b.x0 + ((G.fr * 3) % 24); q < b.x1; q += 24) ctx.fillRect(q | 0, bot - 11 - ((Math.sin(q * 0.3 + G.fr * 0.2) * 2) | 0), 2, 2);
    }
    if (G.ceil) {
      var c = G.ceil, y = bot - c.C;
      if (G.fr < c.at) {
        t = 1 - (c.at - G.fr) / 36;
        ctx.fillStyle = 'rgba(90,0,0,' + (0.25 * t).toFixed(2) + ')'; ctx.fillRect(A.AX, A.AY, A.AW, y - A.AY);
        ctx.fillStyle = 'rgba(' + rampRGB(t) + ',' + (0.4 + 0.6 * t).toFixed(2) + ')';
        for (var dx = A.AX; dx < A.AX + A.AW; dx += 16) ctx.fillRect(dx | 0, (y - 2) | 0, 10, 2);
      } else {
        ctx.fillStyle = 'rgba(40,0,6,0.78)'; ctx.fillRect(A.AX, A.AY, A.AW, y - A.AY);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,58,26,0.30)'; ctx.fillRect(A.AX, (y - 10) | 0, A.AW, 10);
        ctx.fillStyle = 'rgba(255,154,74,0.35)'; ctx.fillRect(A.AX, (y - 4) | 0, A.AW, 4);
        ctx.globalCompositeOperation = op;
        ctx.fillStyle = '#FFF0D0'; ctx.fillRect(A.AX, (y - 2) | 0, A.AW, 2);
        ctx.fillStyle = '#FF9A4A';
        for (var dq = A.AX + ((G.fr * 2) % 40); dq < A.AX + A.AW; dq += 40) ctx.fillRect(dq | 0, (y + (G.fr + dq) % 12) | 0, 2, 3);
      }
    }
    for (i = 0; i < G.bones.length; i++) {
      b = G.bones[i];
      var hi = b.kind === 'high', col = b.kind === 'geyser' || b.kind === 'pillar';
      if (G.fr < b.at) {
        if (b.at - G.fr > (col ? 60 : 24)) continue;
        t = 1 - (b.at - G.fr) / (col ? 60 : 24);
        if (col) {
          ctx.fillStyle = 'rgba(' + rampRGB(t * 0.8) + ',' + (0.22 + 0.4 * t).toFixed(2) + ')';
          ctx.fillRect((b.x - b.w) | 0, b.y0 | 0, (2 * b.w) | 0, (b.y1 - b.y0) | 0);
          ctx.fillStyle = 'rgba(' + rampRGB(t) + ',' + (0.55 + 0.4 * t).toFixed(2) + ')';
          ctx.fillRect((b.x - b.w) | 0, b.y0 | 0, 2, (b.y1 - b.y0) | 0); ctx.fillRect((b.x + b.w - 2) | 0, b.y0 | 0, 2, (b.y1 - b.y0) | 0);
          continue;
        }
        rgb = hi ? iceRGB(t) : rampRGB(t);
        var ex = b.side > 0 ? A.AX + 8 : A.AX + A.AW - 8, cy = hi ? b.y1 + 12 : b.y0 - 14, k;
        boneRect(ctx, ex, b.y0, b.y1, b.w, rgb, 0.25 + 0.35 * t, hi ? 2 : 1);
        ctx.fillStyle = 'rgba(' + rgb + ',' + (((G.fr >> 2) % 2 ? 1 : 0.5) * (0.4 + 0.6 * t)).toFixed(2) + ')';
        for (k = 0; k < 3; k++) {
          var cx = ex + b.side * (18 + k * 12);
          /* a chevron pointing the way it will run, 3 px strokes */
          for (var cj = -2; cj <= 2; cj++) ctx.fillRect((cx - b.side * 3 * Math.abs(cj)) | 0, (cy + cj * 3) | 0, 3, 3);
        }
        continue;
      }
      if (col) {
        u = Math.min(1, (G.fr - b.at) / 6) * Math.min(1, (b.end - G.fr) / 8);
        var top = b.y1 - (b.y1 - b.y0) * Math.min(1, (G.fr - b.at) / 5);
        boneRect(ctx, b.x + ((G.fr % 4) < 2 ? 0 : 1), top, b.y1, b.w - 2 + ((G.fr >> 1) % 2), b.kind === 'pillar' ? '255,58,26' : '255,154,74', 0.85 * u, 0);
        /* licks of flame rising inside the shaft: dark seams and bright tongues, so it is fire, not a flat bar */
        var sc = rm() ? 0 : (G.fr * 3) % 16, ty;
        for (ty = (b.y1 | 0) - 32 + sc; ty > top; ty -= 16) {
          ctx.fillStyle = 'rgba(70,6,2,' + (0.45 * u).toFixed(2) + ')'; ctx.fillRect((b.x - b.w + 2) | 0, ty, 3, 8);
          ctx.fillRect((b.x + b.w - 5) | 0, ty + 8, 3, 8);
          ctx.fillStyle = 'rgba(255,214,120,' + (0.7 * u).toFixed(2) + ')'; ctx.fillRect((b.x - 5) | 0, ty + 3, 3, 9); ctx.fillRect((b.x + 3) | 0, ty + 11, 3, 7);
        }
        continue;
      }
      boneRect(ctx, b.x, b.y0, b.y1, b.w, hi ? '143,216,255' : '255,154,74', 1, hi ? 2 : 1);
    }
  }
  /* the three EyeLock / ArcingEyeStarbursts eyes: each attack keeps them in
     its st.p.eyes; a combo keeps them on a sub-state (st.p.a / st.p.b).
     Only a combo does that: any other attack's p.a / p.b is skipped.
     Shut until their open time, then a socket that heats up; hot through
     the lock beam, dark again after. Red palette only, additive core. */
  function drawEyes(ctx) {
    if (!cur) return;
    var s = cur.st, sets = [], i, k, e, t, op;
    if (s.p.eyes) sets.push(s.p.eyes);
    if (s.p.a && s.p.a.p && s.p.a.p.eyes) sets.push(s.p.a.p.eyes);
    if (s.p.b && s.p.b.p && s.p.b.p.eyes) sets.push(s.p.b.p.eyes);
    if (!sets.length) return;
    op = ctx.globalCompositeOperation;
    for (i = 0; i < sets.length; i++) for (k = 0; k < sets[i].length; k++) {
      e = sets[i][k];
      if (G.thin && k === 1) continue;   /* the combo keeps the middle eye shut */
      /* EyeLockBeams' timeline: shut until the lock frame, ramping over its
         60 f track, hot through the beam, shut after. The arcing eyes only
         have their wave's `at`: a 60 f warm-up, lit through the burst. */
      if (e.l) t = G.fr < e.lock ? 0 : (G.fr < e.l.at ? (G.fr - e.lock) / 60 : (G.fr < e.l.end ? 1 : 0));
      else t = e.at ? clamp(1 - (e.at - G.fr) / 60, 0, 1) : 0;
      if (t <= 0) {
        ctx.fillStyle = 'rgba(26,0,0,0.85)';
        ctx.beginPath(); ctx.arc(e.x, e.y, 8, 0, TAU); ctx.fill();
        line(ctx, e.x - 5, e.y, e.x + 5, e.y, 'rgba(90,0,0,0.6)', 2);
        continue;
      }
      ctx.fillStyle = 'rgba(90,0,0,0.95)';
      ctx.beginPath(); ctx.arc(e.x, e.y, 8, 0, TAU); ctx.fill();
      var r = 3 + 3.5 * clamp(t, 0, 1);
      ctx.fillStyle = 'rgba(255,58,26,' + (0.35 + 0.6 * t).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x, e.y, r * 0.5, 0, TAU);
      ctx.fillStyle = 'rgba(255,240,208,' + (0.45 + 0.5 * t).toFixed(2) + ')';
      ctx.fill();
    }
    ctx.globalCompositeOperation = op;
  }
  function liveRift() {
    for (var i = G ? G.rend.length - 1 : -1; i >= 0; i--)
      if (G.rend[i].phase === 'rift') return G.rend[i];
    return null;
  }

  function line(ctx, x0, y0, x1, y1, col, w) {
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }

  /* The BrimstoneLaserbeam, WotG pass. Four additive layers, each a
     gradient brightest at the source that fades to a quarter at the far
     end (TelegraphedPortalLaserbeam.cs:95-96 taper): a wide rgb[1]
     back-glow, rgb[3], rgb[4], an rgb[5] core (LightSlashTelegraph.cs
     :146-157 dark-under-bright). The width eases in over 16 f
     and overshoots ~20 % before it settles (LightSlashTelegraph.cs:123-124).
     Twin flares at the source and where it meets the wall; brim then tiles
     BrimstoneRayMid down it. w scales it and the hurt band.

     NEU.scalBeam.draw is the ONE beam look, hers and the soul's:
       phase 'charge' t 0-1: a thin telegraph that grows out from the
         source (eased square over the first quarter) and widens
       phase 'fire'   t 0-1: the 16 f width ramp (1 = settled)
       phase 'fade'   t 0-1: shrinks and dims to nothing
     Gradients live in the beam's own frame (0,0)-(len,0), cached per
     palette/layer/len, so a steady beam builds none per frame. Under
     reduced motion an fx palette is steady: no scroll, no wobble, no spin,
     no sparks. Nothing here flashes the screen. */
  function beamGrad(ctx, p, i, a, len) {
    var C = p.g || (p.g = { n: 0 }), k = i + ':' + a + ':' + len, g = C[k], rgb;
    if (g) return g;
    rgb = p.rgb[i].join();
    if (!ctx.createLinearGradient) return 'rgba(' + rgb + ',' + a + ')';
    if (C.n >= 64) { C = p.g = { n: 0 }; }
    g = C[k] = ctx.createLinearGradient(0, 0, len, 0); C.n++;
    g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(1, 'rgba(' + rgb + ',' + (a * 0.25).toFixed(2) + ')');
    return g;
  }
  /* the downscaled glow: a 4x16 canvas, soft across the beam, stretched up
     along it (wotg-visuals §7: heavy glow at low res, upscaled) */
  function glowImg(p) {
    if (p.gc !== undefined) return p.gc;
    p.gc = false;
    try {
      var c = document.createElement('canvas'); c.width = 4; c.height = 16;
      var x = c.getContext && c.getContext('2d'), y;
      if (!x) return p.gc;
      for (y = 0; y < 16; y++) {
        x.fillStyle = 'rgba(' + p.rgb[3].join() + ',' + (0.55 * Math.pow(Math.sin((y + 0.5) / 16 * Math.PI), 2)).toFixed(2) + ')';
        x.fillRect(0, y, 4, 1);
      }
      p.gc = c;
    } catch (e) { p.gc = false; }
    return p.gc;
  }
  function drawBeam(ctx, x0, y0, ang, len, w, t, phase, pal) {
    var p = BEAM_PAL[pal] || BEAM_PAL.brim, op = ctx.globalCompositeOperation, calm = rm();
    var clk = p.fx && !calm && typeof performance !== 'undefined' ? performance.now() / 1000 : 0;
    var fr = G ? G.fr : 0, tp = rayTip(x0, y0, ang), i, s, k = 1, D = len, im;
    len = len | 0;
    if (p.fx) D = Math.min(len, Math.hypot(tp.x - x0, tp.y - y0));
    ctx.save();
    ctx.translate(x0, y0); ctx.rotate(ang);
    ctx.lineCap = 'butt';
    ctx.globalCompositeOperation = 'lighter';
    if (phase === 'charge') {
      var e = Math.min(1, t / 0.25);
      ctx.globalAlpha = 0.9 * Math.min(1, t / 0.08);
      line(ctx, 0, 0, D * e * e, 0, beamGrad(ctx, p, 4, 0.9, len), Math.max(1, (1 + 3 * t) * w));
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      twinFlare(ctx, x0, y0, (8 + 16 * t) * w + 4, clk * 3, 0.6 * t, p);
      ctx.globalCompositeOperation = op; ctx.globalAlpha = 1;
      ctx.lineCap = 'butt'; ctx.lineWidth = 1;
      return;
    }
    var u = phase === 'fade' ? 1 : t;
    if (phase === 'fade') k = 1 - clamp(t, 0, 1);
    s = (Math.sin(Math.pow(u, 1.3) * Math.PI / 2) + 0.3 * Math.sin(u * Math.PI)) * w * k;
    if (clk) s *= 1 + 0.05 * Math.sin(clk * 14);          /* ~2.2 Hz width breath */
    ctx.globalAlpha = k;
    if (p.fx && (im = glowImg(p))) ctx.drawImage(im, 0, -40 * s, D, 80 * s);
    line(ctx, 0, 0, D, 0, beamGrad(ctx, p, 1, 0.7, len), 46 * s);
    line(ctx, 0, 0, D, 0, beamGrad(ctx, p, 3, 0.5, len), 22 * s);
    line(ctx, 0, 0, D, 0, beamGrad(ctx, p, 4, 0.7, len), 10 * s);
    line(ctx, 0, 0, D, 0, beamGrad(ctx, p, 5, 0.95, len), Math.max(1, 4 * s));
    if (p.fx && s > 0.15 && D > 1) {
      /* streaks scrolling out along the length (static under reduced motion) */
      ctx.fillStyle = p.st || (p.st = 'rgba(' + p.rgb[5].join() + ',0.5)');
      for (i = 0; i < 9; i++) ctx.fillRect(((i * 137 + clk * 540) % D) | 0, (((i * 5) % 9 - 4) * s * 1.6) | 0, 22, 2);
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1;
    if (p.fx) {
      var ex = x0 + Math.cos(ang) * D, ey = y0 + Math.sin(ang) * D;
      twinFlare(ctx, x0, y0, (34 * s + 6), clk * 3.6, 0.9 * k, p);
      twinFlare(ctx, ex, ey, (40 * s + 8), -clk * 4.8, 0.95 * k, p);   /* impact bloom */
      if (clk && s > 0.15) {
        ctx.fillStyle = p.sp || (p.sp = 'rgb(' + p.rgb[4].join() + ')');
        for (i = 0; i < 8; i++) {
          var q = ang + Math.PI + ((i * 0.37 + clk * 2.1) % 1) * 1.8 - 0.9, d = (clk * 70 + i * 11) % 26;
          ctx.fillRect((ex + Math.cos(q) * d) | 0, (ey + Math.sin(q) * d) | 0, 2, 2);
        }
      }
      ctx.globalAlpha = 1;
    } else {
      twinFlare(ctx, x0, y0, 34 * s + 6, fr * 0.06, 0.9);
      twinFlare(ctx, tp.x, tp.y, 20 * s + 4, -fr * 0.08, 0.8);
    }
    ctx.globalCompositeOperation = op;
    var mid = !p.fx && NEU.sheetReady && NEU.sheetReady(NEU.sheets.scalRay);
    var end = mid && NEU.sheetReady(NEU.sheets.scalRayEnd);
    if (mid && s > 0.3) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, s / w);
      ctx.translate(x0 | 0, y0 | 0); ctx.rotate(ang - Math.PI / 2);
      for (var y = 0; y < len; y += 15) ctx.drawImage(mid, 0, 0, 26, 30, -6 * w, y, 13 * w, 15);
      if (end) ctx.drawImage(end, 0, 0, 26, 22, -6 * w, len, 13 * w, 11);
      ctx.restore();
    }
    ctx.lineCap = 'butt'; ctx.lineWidth = 1;
  }
  NEU.scalBeam = { draw: drawBeam };
  function beam(ctx, b) {
    drawBeam(ctx, b.x, b.y, b.a, b.len, b.w || 1, b.on === undefined ? 1 : clamp((G.fr - b.on) / 16, 0, 1), 'fire', 'brim');
  }
}());
