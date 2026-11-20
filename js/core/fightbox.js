/*! fightbox.js — the morphing soul arena, ported from the verified mechanics
   of Soulbound Turn Battle 2.0.29 (Pixelcite, MIT). ES5, one IIFE on NEU.
   No input listener lives here: NEU.keys stays the only input authority and
   callers own the motion gate.

   This is an independent port for the neu site. Pixelcite did not author,
   review, sponsor or endorse it. Only this file's re-implemented mechanics
   are covered by the notice below; no art or audio from the original jar was
   copied, and this notice does not cover any other asset on the site.

   Original licence (LICENSE_turnbattle), reproduced verbatim:

   MIT License

   Copyright (c) 2024

   Permission is hereby granted, free of charge, to any person obtaining a copy
   of this software and associated documentation files (the "Software"), to deal
   in the Software without restriction, including without limitation the rights
   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   copies of the Software, and to permit persons to whom the Software is
   furnished to do so, subject to the following conditions:

   The above copyright notice and this permission notice shall be included in all
   copies or substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   SOFTWARE. */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};

  var K = {
    BOX_W: 160, BOX_H: 120, BORDER: 3,
    BOX_ANIM_SPEED: 28,                 /* px per tick toward the target size */
    SOUL_SIZE: 9, SOUL_HALF: 4.5,
    SPEED: 3.6, SNEAK: 1.8,             /* px per tick; sneak is the focus speed */
    IFRAME: 22, WARN: 20, INSET: 6,
    POINTS: 72, PASSES: 6, TOL: 0.5,
    GRAZE_R: 14.4,                      /* kept for callers that graze the soul */
    CULL_R: 170, CULL_K: 0.75,
    RETREAT_BOX: 10, RETREAT_FX: 20,    /* ticks: box shrink, then retreat FX to 20 */
    SPAWN_BOX: 10, SPAWN_FX: 12,
    RETURN_TRAVEL: 4.6666665, RETURN_TICKS: 12.333333,
    GRAZE_RING: 5,                      /* ticks the graze ring shows */
    DMG_RISE: 12, DMG_SHOW: 40, SHAKE: 4  /* damage number: rises 12, gone at 40 */
  };
  var SHAPES = ['RECT', 'CIRCLE', 'HEX', 'TRI', 'DIAMOND', 'OCT', 'TRAP', 'TRI_DOWN', 'HEX_FLAT'];
  var N = K.POINTS, TAU = Math.PI * 2, HALF_PI = Math.PI / 2;

  /* Reduced motion cuts every ease, morph and tween to its end frame. */
  function reduced() {
    var m = NEU.motion, s = NEU.settings;
    return !!((m && m.reduced && m.reduced()) || (s && s.reduced));
  }
  function toward(v, t, d) { return v < t ? Math.min(t, v + d) : Math.max(t, v - d); }

  /* Unit corners, half-extent 0.5. The circle has no corners; rayHit then
     falls back to 0.5, which the 72-point sampler turns into an ellipse. */
  function corners(shape) {
    var hexR = 0.5 * Math.sqrt(3) / 2, c = [], i;
    if (shape === 0) return [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
    if (shape === 1) return [];
    if (shape === 2) { for (i = 0; i < 6; i++) c.push([hexR * Math.cos(-HALF_PI + i * Math.PI / 3), hexR * Math.sin(-HALF_PI + i * Math.PI / 3)]); return c; }
    if (shape === 3) return [[0, -0.5], [0.5, 0.5], [-0.5, 0.5]];
    if (shape === 4) return [[0, -0.5], [0.5, 0], [0, 0.5], [-0.5, 0]];
    if (shape === 5) { for (i = 0; i < 8; i++) c.push([0.5 * Math.cos(-HALF_PI + i * Math.PI / 4), 0.5 * Math.sin(-HALF_PI + i * Math.PI / 4)]); return c; }
    if (shape === 6) return [[-0.25, -0.5], [0, -0.5], [0.25, -0.5], [0.5, 0.5], [0, 0.5], [-0.5, 0.5]];
    if (shape === 7) return [[-0.25, -0.5], [0.25, -0.5], [0, 0.5]];
    for (i = 0; i < 6; i++) c.push([hexR * Math.cos(i * Math.PI / 3), hexR * Math.sin(i * Math.PI / 3)]);
    return c;
  }

  /* Ray from the centre at (cs,sn) to the nearest polygon edge. Convex,
     origin-centred shapes only; 0.5 is the circle/no-hit fallback. */
  function rayHit(csV, cs, sn) {
    var best = csV.length ? Infinity : 0.5, n = csV.length, i, ax, ay, ex, ey, den, u, s;
    for (i = 0; i < n; i++) {
      ax = csV[i][0]; ay = csV[i][1];
      ex = csV[(i + 1) % n][0] - ax; ey = csV[(i + 1) % n][1] - ay;
      den = ex * sn - ey * cs;
      if (den > -1e-9 && den < 1e-9) continue;
      u = (ay * cs - ax * sn) / den;
      s = (ay * ex - ax * ey) / den;
      if (s > 0 && u >= 0 && u <= 1 && s < best) best = s;
    }
    return best;
  }

  /* One table per shape: 72 x/y pairs sampled at 5 degree steps. */
  var UNIT = [];
  (function buildUnits() {
    for (var sh = 0; sh < SHAPES.length; sh++) {
      var csV = corners(sh), pts = new Float32Array(N * 2);
      for (var i = 0; i < N; i++) {
        var a = -HALF_PI + i * TAU / N, cs = Math.cos(a), sn = Math.sin(a), r = rayHit(csV, cs, sn);
        pts[2 * i] = cs * r; pts[2 * i + 1] = sn * r;
      }
      UNIT.push(pts);
    }
  })();

  /* Winding sign of a polygon, so the half-plane test works whether the
     sampled points came out clockwise or anticlockwise. */
  function orient(poly) {
    var area = 0, i, j;
    for (i = 0, j = N - 1; i < N; j = i++) {
      area += poly[2 * j] * poly[2 * i + 1] - poly[2 * i] * poly[2 * j + 1];
    }
    return area < 0 ? -1 : 1;
  }

  /* World outline: centre + rotated, scaled unit morph. a/b are shape ids,
     m in [0,1] is the linear per-point interpolation factor. */
  function buildPoly(cx, cy, w, h, ang, a, b, m, out) {
    out = out || new Float32Array(N * 2);
    var A = UNIT[a] || UNIT[0], B = UNIT[b] || UNIT[0], co = Math.cos(ang || 0), si = Math.sin(ang || 0);
    m = m || 0;
    for (var i = 0; i < N; i++) {
      var lx = A[2 * i] + (B[2 * i] - A[2 * i]) * m;
      var ly = A[2 * i + 1] + (B[2 * i + 1] - A[2 * i + 1]) * m;
      var wx = lx * w, wy = ly * h;
      out[2 * i] = cx + wx * co - wy * si;
      out[2 * i + 1] = cy + wx * si + wy * co;
    }
    return out;
  }

  /* Convex half-plane test. Inside means no edge puts the point more than
     TOL px outside its inward half-plane. */
  function inside(px, py, poly) {
    var o = orient(poly), i, j, ax, ay, ex, ey;
    for (i = 0, j = N - 1; i < N; j = i++) {
      ax = poly[2 * j]; ay = poly[2 * j + 1];
      ex = poly[2 * i] - ax; ey = poly[2 * i + 1] - ay;
      if ((ex * (py - ay) - ey * (px - ax)) * o < -K.TOL) return false;
    }
    return true;
  }

  /* Push the point to at least `radius` inside every edge, six relaxation
     passes like ReplicaBox.clampPoint; still outside -> box centre. */
  function clampPoint(px, py, radius, poly) {
    var o = orient(poly), pass, i, j, ax, ay, ex, ey, len, d, push, moved, cx = 0, cy = 0;
    for (i = 0; i < N; i++) { cx += poly[2 * i]; cy += poly[2 * i + 1]; }
    cx /= N; cy /= N;
    radius = radius === undefined ? K.SOUL_HALF : radius;
    for (pass = 0; pass < K.PASSES; pass++) {
      moved = false;
      for (i = 0, j = N - 1; i < N; j = i++) {
        ax = poly[2 * j]; ay = poly[2 * j + 1];
        ex = poly[2 * i] - ax; ey = poly[2 * i + 1] - ay;
        len = Math.sqrt(ex * ex + ey * ey) || 1;
        d = (ex * (py - ay) - ey * (px - ax)) * o / len;   /* inward distance */
        if (d < radius) {
          push = radius - d;
          px += o * (-ey / len) * push;
          py += o * (ex / len) * push;
          moved = true;
        }
      }
      if (!moved) break;
    }
    if (!inside(px, py, poly)) return { x: cx, y: cy };
    return { x: px, y: py };
  }

  /* One fight-local box with a soul and its i-frame clock. Callers drive
     the clock and (optionally) feed input from NEU.keys; this module never
     reads the keyboard itself. */
  function make(o) {
    o = o || {};
    var f = {
      cx: 0, cy: 0, w: o.w || K.BOX_W, h: o.h || K.BOX_H, ang: 0,
      a: 0, b: 0, m: 0,
      poly: new Float32Array(N * 2),
      soul: { x: 0, y: 0, iframe: 0 },
      tick: 0,
      tw: o.w || K.BOX_W, th: o.h || K.BOX_H,   /* ease target size */
      rt: -1, sp: -1,                           /* retreat / spawn tick, -1 idle */
      mdur: 0, mt: 0, ring: 0, placed: false,
      back: null,                               /* soul return tween */
      warns: [], due: [], dmgs: []
    };
    f.setRect = function (w, h) { f.w = f.tw = w; f.h = f.th = h; return f; };
    f.setShape = function (a, b, m) { f.a = a | 0; f.b = b | 0; f.m = m || 0; f.mdur = 0; return f; };
    f.setAngle = function (r) { f.ang = r || 0; return f; };
    /* Moving the centre carries the soul by the same delta (ReplicaBox.apply);
       the first placement carries nothing. */
    f.centre = function (x, y) {
      if (f.placed) { f.soul.x += x - f.cx; f.soul.y += y - f.cy; }
      f.cx = x; f.cy = y; f.placed = true;
      return f;
    };
    /* Box size eases toward the target at BOX_ANIM_SPEED px per tick. */
    f.ease = function (w, h) {
      f.tw = w; f.th = h;
      if (reduced()) { f.w = w; f.h = h; }
      return f;
    };
    f.retreat = function () { f.rt = 0; f.sp = -1; return f.ease(0, 0); };
    f.spawn = function (w, h) {
      f.w = f.h = 0; f.sp = 0; f.rt = -1;
      return f.ease(w, h);
    };
    f.retreating = function () { return f.rt >= 0 && f.rt < K.RETREAT_BOX; };
    f.retreatFx = function () { return f.rt >= K.RETREAT_BOX; };
    f.spawning = function () { return f.sp >= 0 && f.sp < K.SPAWN_BOX; };
    f.spawnFx = function () { return f.sp >= 0; };
    /* Live morph: m runs 0 -> 1 linearly over ticks. Starting one mid-morph
       restarts from the nearer shape (a pop of at most half the morph). */
    f.morph = function (b, ticks) {
      b = b | 0;
      var from = f.m >= 0.5 ? f.b : f.a;
      if (from === b && f.m === 0) return f;
      if (reduced() || !(ticks > 0)) return f.setShape(b, b, 0);
      f.a = from; f.b = b; f.m = 0; f.mt = 0; f.mdur = ticks;
      return f;
    };
    f.morphing = function () { return f.mdur > 0; };
    /* The heart flies to its anchor over RETURN_TICKS (linear tween). */
    f.recall = function (x, y) {
      if (reduced()) { f.soul.x = x; f.soul.y = y; f.back = null; return f; }
      f.back = { fx: f.soul.x, fy: f.soul.y, ax: x, ay: y, t: 0 };
      return f;
    };
    f.returning = function () { return !!f.back; };
    /* Out-of-box spawn telegraph. A point outside the INSET-shrunk target rect
       queues a WARN-tick warning and returns true; the caller then spawns it
       only when f.take() hands it back. Inside returns false: spawn now. */
    f.warn = function (x, y, data) {
      var hw = f.tw / 2 - K.INSET, hh = f.th / 2 - K.INSET;
      if (x > f.cx - hw && x < f.cx + hw && y > f.cy - hh && y < f.cy + hh) return false;
      f.warns.push({ x: x, y: y, t: K.WARN, data: data });
      return true;
    };
    f.take = function () { var d = f.due; f.due = []; return d; };
    /* A bullet this far from the box centre is spent. */
    f.gone = function (b) {
      var dx = b.x - f.cx, dy = b.y - f.cy, r = Math.max(f.w, f.h) * K.CULL_K + K.CULL_R;
      return dx * dx + dy * dy > r * r;
    };
    /* Graze: within GRAZE_R of the soul centre, once per bullet. */
    f.graze = function (b) {
      if (!b || b.grazed) return false;
      var dx = b.x - f.soul.x, dy = b.y - f.soul.y;
      if (dx * dx + dy * dy > K.GRAZE_R * K.GRAZE_R) return false;
      b.grazed = true; f.ring = K.GRAZE_RING;
      return true;
    };
    f.dmg = function (x, y, n) { f.dmgs.push({ x: x, y: y, n: n, t: 0 }); return f; };
    /* Graze ring and damage numbers. Reduced motion: ring does not shrink,
       numbers do not rise or shake (they still fade out). */
    f.draw = function (ctx) {
      var i, d, still = reduced(), r, dx, dy, al;
      ctx.save();
      if (f.ring > 0) {
        r = still ? K.GRAZE_R : K.GRAZE_R * (0.6 + 0.4 * f.ring / K.GRAZE_RING);
        ctx.globalAlpha = f.ring / K.GRAZE_RING;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(f.soul.x, f.soul.y, r, 0, TAU); ctx.stroke();
      }
      ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#ff4040';
      for (i = 0; i < f.dmgs.length; i++) {
        d = f.dmgs[i];
        dy = still ? K.DMG_RISE : Math.min(d.t, K.DMG_RISE);
        dx = still || d.t >= K.DMG_RISE ? 0 : ((d.t & 1) ? 1 : -1) * K.SHAKE * (1 - d.t / K.DMG_RISE);
        al = d.t < K.DMG_RISE ? 1 : 1 - (d.t - K.DMG_RISE) / (K.DMG_SHOW - K.DMG_RISE);
        ctx.globalAlpha = al;
        ctx.fillText(String(d.n), d.x + dx, d.y - dy);
      }
      ctx.restore();
      return f;
    };
    f.rebuild = function () { return buildPoly(f.cx, f.cy, f.w, f.h, f.ang, f.a, f.b, f.m, f.poly); };
    f.inside = function (x, y) { return inside(x, y, f.poly); };
    f.clampPoint = function (x, y, r) { return clampPoint(x, y, r === undefined ? K.SOUL_HALF : r, f.poly); };
    f.clampSoul = function () { var p = clampPoint(f.soul.x, f.soul.y, K.SOUL_HALF, f.poly); f.soul.x = p.x; f.soul.y = p.y; return f; };
    f.hit = function () { f.soul.iframe = K.IFRAME; return f; };
    f.step = function (input) {
      var sp = input && input.focus ? K.SNEAK : K.SPEED, i, w, bk, p, bs;
      f.tick++;
      bs = f.rate || K.BOX_ANIM_SPEED;      /* f.rate: an arena wider than the jar's box scales the speed, not the easing */
      f.w = toward(f.w, f.tw, bs);
      f.h = toward(f.h, f.th, bs);
      if (f.rt >= 0 && ++f.rt >= K.RETREAT_FX) f.rt = -1;
      if (f.sp >= 0 && ++f.sp >= K.SPAWN_FX) f.sp = -1;
      if (f.mdur > 0) {
        f.m = ++f.mt / f.mdur;               /* integer count: m hits 1 exactly */
        if (f.mt >= f.mdur) { f.a = f.b; f.m = 0; f.mdur = 0; }
      }
      bk = f.back;
      if (bk) {
        bk.t++;
        p = Math.min(1, bk.t / K.RETURN_TICKS);
        f.soul.x = bk.fx + (bk.ax - bk.fx) * p; f.soul.y = bk.fy + (bk.ay - bk.fy) * p;
        if (bk.t >= K.RETURN_TICKS) f.back = null;
        input = null;                       /* the heart is in flight */
      }
      if (input) {
        if (input.left) f.soul.x -= sp;
        if (input.right) f.soul.x += sp;
        if (input.up) f.soul.y -= sp;
        if (input.down) f.soul.y += sp;
      }
      f.rebuild(); f.clampSoul();
      if (f.soul.iframe > 0) f.soul.iframe--;
      if (f.ring > 0) f.ring--;
      for (i = f.warns.length - 1; i >= 0; i--) {
        w = f.warns[i];
        if (--w.t <= 0) { f.warns.splice(i, 1); f.due.unshift(w); }
      }
      for (i = f.dmgs.length - 1; i >= 0; i--) if (++f.dmgs[i].t >= K.DMG_SHOW) f.dmgs.splice(i, 1);
      return f;
    };
    f.rebuild();
    return f;
  }

  NEU.fightbox = {
    K: K, SHAPES: SHAPES, N: N, unit: UNIT,
    corners: corners, rayHit: rayHit, orient: orient,
    buildPoly: buildPoly, inside: inside, clampPoint: clampPoint, make: make
  };
})();
