/* fightbox.js — the morphing soul arena, ported from the verified mechanics
   of Soulbound Turn Battle 2.0.29 (Pixelcite, MIT). ES5, one IIFE on NEU.
   See TURNBATTLE-JAR-ANALYSIS.md §2.2-2.3 for the bytecode evidence and
   THIRD-PARTY-NOTICES.md for the licence. No input listener lives here:
   NEU.keys stays the only input authority and callers own the motion gate. */

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
    CULL_R: 170
  };
  var SHAPES = ['RECT', 'CIRCLE', 'HEX', 'TRI', 'DIAMOND', 'OCT', 'TRAP', 'TRI_DOWN', 'HEX_FLAT'];
  var N = K.POINTS, TAU = Math.PI * 2, HALF_PI = Math.PI / 2;

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
    var best = 0.5, n = csV.length, i, ax, ay, ex, ey, den, u, s;
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
      tick: 0
    };
    f.setRect = function (w, h) { f.w = w; f.h = h; return f; };
    f.setShape = function (a, b, m) { f.a = a | 0; f.b = b | 0; f.m = m || 0; return f; };
    f.setAngle = function (r) { f.ang = r || 0; return f; };
    f.centre = function (x, y) { f.cx = x; f.cy = y; return f; };
    f.rebuild = function () { return buildPoly(f.cx, f.cy, f.w, f.h, f.ang, f.a, f.b, f.m, f.poly); };
    f.inside = function (x, y) { return inside(x, y, f.poly); };
    f.clampPoint = function (x, y, r) { return clampPoint(x, y, r === undefined ? K.SOUL_HALF : r, f.poly); };
    f.clampSoul = function () { var p = clampPoint(f.soul.x, f.soul.y, K.SOUL_HALF, f.poly); f.soul.x = p.x; f.soul.y = p.y; return f; };
    f.hit = function () { f.soul.iframe = K.IFRAME; return f; };
    f.step = function (input) {
      var sp = input && input.focus ? K.SNEAK : K.SPEED;
      f.tick++;
      if (input) {
        if (input.left) f.soul.x -= sp;
        if (input.right) f.soul.x += sp;
        if (input.up) f.soul.y -= sp;
        if (input.down) f.soul.y += sp;
      }
      f.rebuild(); f.clampSoul();
      if (f.soul.iframe > 0) f.soul.iframe--;
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
