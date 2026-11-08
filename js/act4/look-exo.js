/* look-exo.js — Exo lab art. Every sprite is baked once into an offscreen
   canvas (rotated arms in 16 directions, no ctx.rotate); a frame is
   drawImage plus a few fillRects. Exposes NEU.exoLook (house rooms, spiral)
   and NEU.exoArt (the fights: arena, Ares, twins, Thanatos, Draedon, nuke).
   prefers-reduced-motion holds every idle loop still. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var T = 16;
  var paints = {};
  var cache = {};
  var STEEL = ['#0A0C10', '#14181E', '#232A33', '#3A4450', '#5A6878', '#8A98A8', '#C5D0D8', '#EEF3F6'];

  function reduced() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  }
  function mk(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, w | 0);
    c.height = Math.max(1, h | 0);
    return c;
  }
  function px(g, x, y, w, h, c) {
    g.fillStyle = c;
    g.fillRect(x | 0, y | 0, w | 0, h | 0);
  }
  function hash(x, y, s) {
    var h = (x * 374761393 + y * 668265263 + (s || 0) * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  /* one baked sprite: fn(R, g) draws with R(x, y, w, h, colour) */
  function bake(key, w, h, fn) {
    var c = cache[key], cv, g;
    if (c) return c;
    cv = mk(w, h);
    g = cv.getContext && cv.getContext('2d');
    c = { cv: cv, w: w, h: h };
    cache[key] = c;
    if (!g) return c;
    try { g.imageSmoothingEnabled = false; } catch (e) {}
    fn(function (x, y, ww, hh, col) { g.fillStyle = col; g.fillRect(x | 0, y | 0, ww | 0, hh | 0); }, g);
    return c;
  }
  function put(g, s, x, y) { if (s && s.cv) g.drawImage(s.cv, x | 0, y | 0); }
  function alpha(g, a, fn) {
    var p = g.globalAlpha;
    g.globalAlpha = a;
    fn();
    g.globalAlpha = p;
  }
  function blob(R, cx, cy, rx, ry, c) {
    var y, k, hw;
    for (y = -ry; y <= ry; y++) {
      k = 1 - (y * y) / ((ry + 0.5) * (ry + 0.5));
      if (k <= 0) continue;
      hw = Math.round(rx * Math.sqrt(k));
      R(cx - hw, cy + y, hw * 2 + 1, 1, c);
    }
  }
  /* hexagon with the corners cut, centred on cx, cy */
  function hexF(R, cx, cy, w, h, cut, c) {
    var y, ins;
    for (y = 0; y < h; y++) {
      ins = Math.max(0, cut - Math.min(y, h - 1 - y));
      R(cx - (w >> 1) + ins, cy - (h >> 1) + y, w - ins * 2, 1, c);
    }
  }
  /* thick line from squares, stepped ramp: outline, shadow, body, light, glint */
  function line(R, segs, cols) {
    var pass, i, s, n, k, t, o, x, y;
    var P = [[2, 0], [0, 0], [-1, -1], [-3, -1], [-5, -2]];
    for (pass = 0; pass < 5; pass++) {
      for (i = 0; i < segs.length; i++) {
        s = segs[i];
        t = s[4] + P[pass][0];
        if (t < 1) continue;
        o = P[pass][1];
        n = Math.max(1, Math.max(Math.abs(s[2] - s[0]), Math.abs(s[3] - s[1])));
        for (k = 0; k <= n; k++) {
          x = Math.round(s[0] + (s[2] - s[0]) * k / n);
          y = Math.round(s[1] + (s[3] - s[1]) * k / n);
          R(x - (t >> 1) + o, y - (t >> 1) + o, t, t, cols[pass]);
        }
      }
    }
  }
  /* a stepped glow disc, baked at its own alpha and drawn with a pulse */
  function glowSprite(col, r) {
    return bake('glow' + col + r, r * 2 + 2, r * 2 + 2, function (R, g) {
      var k, p = g.globalAlpha;
      for (k = 0; k < 4; k++) {
        g.globalAlpha = 0.09;
        blob(R, r + 1, r + 1, r - k * (r / 4 | 0), r - k * (r / 4 | 0), col);
      }
      g.globalAlpha = p;
    });
  }
  function glow(g, col, r, x, y, a) {
    var s = glowSprite(col, r), p = g.globalAlpha;
    g.globalAlpha = a;
    g.drawImage(s.cv, (x - r - 1) | 0, (y - r - 1) | 0);
    g.globalAlpha = p;
  }

  /* ── the house: rooms, props, spiral ───────────────────────────────── */
  function faceOf(step) { return ((step | 0) + 4) % 8; }
  function eyeOn(t) {
    if (reduced()) return true;
    var p = (typeof t === 'number' ? t : 0) % 0.5;
    if (p < 0) p += 0.5;
    return p < 0.25;
  }
  function steel(g, x, y, w, h) {
    var row, band, hh;
    for (row = 0; row < h; row += 4) {
      band = ((row / 4) % 2) === 0 ? '#1A1E24' : '#2A3038';
      hh = h - row;
      if (hh > 4) hh = 4;
      px(g, x, y + row, w, hh, band);
    }
  }
  /* stepped 45 degree hazard stripes: door thresholds and the spiral shaft floor */
  function stripes(g, x, y, w, h) {
    var i, j, c;
    for (j = 0; j < h; j++) {
      for (i = 0; i < w; i += 4) {
        c = ((((i + j) >> 2) & 1) === 0) ? '#E2C04A' : '#1A1614';
        px(g, x + i, y + j, Math.min(4, w - i), 1, c);
      }
    }
    px(g, x, y, w, 1, '#8A9098');
    px(g, x, y + h - 1, w, 1, '#5A6A78');
  }
  function holo(g, x, y) {
    px(g, x, y, 10, 14, '#103038');
    px(g, x + 1, y + 2, 8, 2, '#20C8D0');
    px(g, x + 1, y + 6, 6, 2, '#20C8D0');
    px(g, x + 1, y + 10, 8, 2, '#48E0E8');
  }
  function eye(g, x, y, on) {
    px(g, x, y, 6, 4, '#1A1E24');
    px(g, x + 1, y + 1, 4, 2, on ? '#E02020' : '#3A1010');
  }
  function rack(g, x, y, t) {
    px(g, x, y, 16, 32, '#12161C');
    px(g, x, y, 16, 1, '#232A33');
    px(g, x, y, 1, 32, '#232A33');
    px(g, x + 15, y, 1, 32, '#0A0C10');
    px(g, x, y + 31, 16, 1, '#0A0C10');
    var tog = reduced() ? 0 : Math.floor((t || 0) / 500) % 4;
    for (var r = 0; r < 6; r++) {
      var ry = y + 4 + r * 4;
      px(g, x + 2, ry, 12, 1, '#1A1E24');
      px(g, x + 3, ry + 1, 2, 2, (r === tog) ? '#E6C15A' : '#3BE2C8');
      px(g, x + 7, ry + 1, 2, 2, ((r + 1) % 4 === tog) ? '#E6C15A' : '#3BE2C8');
      px(g, x + 11, ry + 1, 2, 2, '#3BE2C8');
    }
  }
  function tank(g, x, y, t) {
    px(g, x, y, 24, 4, '#3A4450');
    px(g, x + 2, y, 20, 1, '#8A98A8');
    px(g, x, y + 36, 24, 4, '#14181E');
    px(g, x + 2, y + 36, 20, 1, '#3A4450');
    var p = g.globalAlpha;
    g.globalAlpha = 0.25;
    px(g, x + 2, y + 4, 20, 32, '#20C8D0');
    g.globalAlpha = p;
    var b0 = reduced() ? 8 : (30 - Math.floor(((t || 0) + 0) / 40) % 28);
    var b1 = reduced() ? 16 : (30 - Math.floor(((t || 0) + 300) / 50) % 28);
    var b2 = reduced() ? 24 : (30 - Math.floor(((t || 0) + 700) / 45) % 28);
    px(g, x + 6, y + 4 + b0, 2, 2, '#EEF3F6');
    px(g, x + 14, y + 4 + b1, 2, 2, '#EEF3F6');
    px(g, x + 10, y + 4 + b2, 2, 2, '#EEF3F6');
  }
  /* the 32x40 deck-view Draedon is the boss sprite at half size */
  function draedon(g, x, y, face, u) {
    var s = draedonSprite(), k = u || 1, turn = (face % 8) - 4;
    try { g.imageSmoothingEnabled = false; } catch (e) {}
    g.drawImage(s.cv, (x - 18 * k + (turn < 0 ? -k : 0)) | 0, (y - 36 * k) | 0, 36 * k, 42 * k);
  }
  function deckPlate(g, ox, oy, n) {
    var grate = n % 3 === 0, i;
    px(g, ox, oy, 32, 32, '#12161C');
    px(g, ox + 2, oy + 2, 28, 28, '#1A1E24');
    px(g, ox, oy, 32, 1, '#232A33');
    px(g, ox, oy, 1, 32, '#232A33');
    px(g, ox, oy + 31, 32, 1, '#0A0C10');
    px(g, ox + 31, oy, 1, 32, '#0A0C10');
    if (grate) {
      alpha(g, 0.15, function () { px(g, ox + 6, oy + 6, 20, 20, '#20C8D0'); });
      for (i = 0; i < 20; i += 2) px(g, ox + 6, oy + 6 + i, 20, 1, '#0A0C10');
      px(g, ox + 6, oy + 5, 20, 1, '#3A4450');
    }
    px(g, ox + 3, oy + 3, 2, 2, '#3A4450'); px(g, ox + 3, oy + 3, 1, 1, '#8A98A8');
    px(g, ox + 27, oy + 3, 2, 2, '#3A4450'); px(g, ox + 27, oy + 3, 1, 1, '#8A98A8');
    px(g, ox + 3, oy + 27, 2, 2, '#3A4450'); px(g, ox + 3, oy + 27, 1, 1, '#8A98A8');
    px(g, ox + 27, oy + 27, 2, 2, '#3A4450'); px(g, ox + 27, oy + 27, 1, 1, '#8A98A8');
  }
  function wallTile(g, x, y, tx, ty, below) {
    var ox = tx * T, oy = ty * T, j;
    px(g, ox, oy, T, T, '#14181E');
    px(g, ox, oy, 1, T, '#232A33');
    px(g, ox + T - 1, oy, 1, T, '#0A0C10');
    px(g, ox + 2, oy, T - 4, T, '#181D24');
    for (j = 0; j < 2; j++) {
      px(g, ox, oy + 2 + j * 7, T, 4, '#3A4450');
      px(g, ox, oy + 2 + j * 7, T, 1, '#8A98A8');
      px(g, ox, oy + 5 + j * 7, T, 1, '#232A33');
      if (tx % 3 === 0) px(g, ox, oy + 2 + j * 7, 2, 4, '#5A6878');
    }
    if (below && hash(tx, ty, 5) < 0.22) {
      px(g, ox + 6, oy + 10, 4, 4, '#E02020');
      px(g, ox + 7, oy + 11, 2, 2, '#FF8A6A');
      alpha(g, 0.25, function () { px(g, ox + 3, oy + 7, 10, 9, '#E02020'); });
    }
    if (hash(tx, ty, 9) < 0.18) {
      px(g, ox + 3, oy + 8, 1, 4, '#0A0C10'); px(g, ox + 4, oy + 11, 2, 1, '#0A0C10');
      px(g, ox + 6, oy + 12, 3, 1, '#232A33'); px(g, ox + 9, oy + 11, 2, 1, '#232A33');
      px(g, ox + 11, oy + 8, 1, 4, '#0A0C10');
    }
  }
  /* the spiral shaft: ring lights, a column, a helix of steps, Draedon on top */
  function paintSpiral(g, st) {
    var cw = (g.canvas && g.canvas.width) || 160, ch = (g.canvas && g.canvas.height) || 96;
    var u = Math.max(1, Math.round(cw / 160)), climb = st.climb || 0, face = st.face | 0;
    var cx = cw >> 1, colW = 24 * u, R0 = 44 * u, n = 12, i, a, sx, sy, sc, ww, front, y, k;
    var order = [], o0 = (climb * 8) | 0, o1 = (climb * 20) | 0, o2 = (climb * 36) | 0;
    try { g.imageSmoothingEnabled = false; } catch (e0) {}
    px(g, 0, 0, cw, ch, '#0A0C10');
    for (y = -((o1 % (48 * u))); y < ch; y += 48 * u) {
      px(g, 0, y, cw, 1, '#20C8D0');
      px(g, 0, y + 1, cw, 1, '#103038');
      px(g, 0, y - 1, cw, 1, '#0F1A20');
    }
    for (k = 0; k < 4; k++) {
      px(g, (k * cw / 3) | 0, 0, 1, ch, '#14181E');
      px(g, ((k * cw / 3) | 0) + 1, 0, 1, ch, '#0E1216');
    }
    for (i = 0; i < n; i++) {
      a = (i * 30 + climb * 30) * Math.PI / 180;
      order.push({ i: i, a: a, s: Math.sin(a) });
    }
    function step(o) {
      var front = o.s > 0, ww = (front ? 48 : 34) * u / 2 | 0, hh = (front ? 6 : 4) * u;
      var xx = (cx + Math.cos(o.a) * R0) | 0;
      var yy = (ch - 10 * u - o.i * ((ch - 36 * u) / n)) | 0;
      px(g, xx - ww, yy, ww * 2, hh, front ? '#0A0C10' : '#06080C');
      px(g, xx - ww + 1, yy + 1, ww * 2 - 2, hh - 1, front ? '#3A4450' : '#1A2028');
      px(g, xx - ww + 1, yy + 1, ww * 2 - 2, 1, front ? '#8A98A8' : '#3A4450');
      px(g, xx - ww + 1, yy + hh - 1, ww * 2 - 2, 1, front ? '#232A33' : '#0E1216');
      if (front) {
        px(g, xx - ww + 2, yy - 3 * u, 1, 3 * u, '#5A6878');
        px(g, xx + ww - 3, yy - 3 * u, 1, 3 * u, '#5A6878');
        px(g, xx - ww + 2, yy - 3 * u, ww * 2 - 4, 1, '#5A6878');
        px(g, xx - 2 * u, yy + hh, 4 * u, 1, '#20C8D0');
      }
    }
    for (i = 0; i < n; i++) if (order[i].s <= 0) step(order[i]);
    /* the column: steel ramp, lit from the left */
    px(g, cx - colW / 2 - 1, 0, colW + 2, ch, '#0A0C10');
    px(g, cx - colW / 2, 0, colW, ch, '#232A33');
    px(g, cx - colW / 2, 0, colW / 3, ch, '#3A4450');
    px(g, cx - colW / 2, 0, 2, ch, '#8A98A8');
    px(g, cx - colW / 2 + 2, 0, 2, ch, '#5A6878');
    px(g, cx + colW / 2 - 4, 0, 4, ch, '#14181E');
    for (y = -(o0 % (16 * u)); y < ch; y += 16 * u) {
      px(g, cx - colW / 2, y, colW, 1, '#0A0C10');
      px(g, cx - 2, y + 4 * u, 4, 2, '#20C8D0');
    }
    for (i = 0; i < n; i++) if (order[i].s > 0) step(order[i]);
    /* Draedon waits at the top, the chair turns with face */
    px(g, cx - 18 * u, 8 * u, 36 * u, 2, '#20C8D0');
    draedon(g, cx, 16 * u + 34 * u, face, u);
    /* #8A9098 arm marker shifts with climb so the stair reads as turning */
    px(g, cx + (face % 3 - 1) * 6 * u - 4 * u, 22 * u - (climb % 3) * 2 * u, 8 * u, 2, '#8A9098');
    stripes(g, 0, ch - 4 * u, cw, 4 * u);
    eye(g, 4 * u, 4 * u, eyeOn(st.t || 0));
    eye(g, cw - 10 * u, 4 * u, eyeOn(st.t || 0));
    st.parallax = [o0, o1, o2];
  }

  /* ── Draedon sprite: 72x84, hover chair, coat, hood, steel arm ─────── */
  function draedonSprite() {
    return bake('draedon', 72, 84, function (R) {
      var ax = 36, ay = 40;
      function T2(x, y, w, h, c) { R(ax + x, ay + y, w, h, c); }
      var i, hw;
      /* chair: back, bowl, arms, hover pads */
      T2(-15, -26, 30, 38, '#0A0C10');
      T2(-14, -25, 28, 36, '#232A33');
      T2(-14, -25, 3, 36, '#3A4450');
      T2(-14, -25, 28, 1, '#5A6878');
      blob(R, ax, ay + 20, 22, 8, '#0A0C10');
      blob(R, ax, ay + 20, 21, 7, '#232A33');
      blob(R, ax - 1, ay + 19, 18, 5, '#3A4450');
      blob(R, ax - 4, ay + 18, 11, 3, '#5A6878');
      T2(-21, 14, 42, 1, '#8A98A8');
      T2(-24, 0, 8, 6, '#0A0C10'); T2(-23, 0, 6, 4, '#5A6878'); T2(-23, 0, 6, 1, '#8A98A8');
      T2(16, 0, 8, 6, '#0A0C10'); T2(17, 0, 6, 4, '#3A4450'); T2(17, 0, 6, 1, '#5A6878');
      T2(-16, 27, 12, 5, '#0A0C10'); T2(-15, 27, 10, 3, '#3A4450'); T2(-15, 27, 10, 1, '#8A98A8');
      T2(4, 27, 12, 5, '#0A0C10'); T2(5, 27, 10, 3, '#3A4450'); T2(5, 27, 10, 1, '#8A98A8');
      /* coat: trapezoid, lit left, shaded right */
      for (i = -12; i <= 24; i++) {
        hw = 14 + Math.round((i + 12) * 0.2);
        T2(-hw - 1, i, hw * 2 + 2, 1, '#0A0C10');
      }
      T2(-15, 25, 30, 1, '#0A0C10');
      for (i = -12; i <= 24; i++) {
        hw = 14 + Math.round((i + 12) * 0.2);
        T2(-hw, i, hw * 2, 1, '#2A3040');
        T2(-hw, i, Math.max(4, hw >> 1), 1, '#3A4458');
        T2(-hw, i, Math.max(4, hw >> 1), 1, '#4A6670');
        T2(-hw, i, 2, 1, '#4E5A70');
        T2(hw - 6, i, 6, 1, '#1A1E2A');
      }
      T2(-1, -8, 1, 32, '#1A1E2A');
      T2(-18, 4, 36, 2, '#1A1E2A');
      T2(-2, 4, 4, 2, '#E6C15A');
      T2(-12, -13, 24, 2, '#4E5A70');
      T2(-12, -13, 24, 1, '#8A98A8');
      T2(-8, 12, 1, 12, '#1A1E2A'); T2(8, 12, 1, 12, '#1A1E2A');
      /* hood and visor */
      hexF(R, ax, ay - 24, 20, 20, 5, '#0A0C10');
      hexF(R, ax, ay - 24, 18, 18, 4, '#1A1E2A');
      hexF(R, ax - 1, ay - 26, 14, 10, 3, '#2A3040');
      T2(-7, -33, 8, 1, '#4E5A70');
      T2(-7, -28, 14, 6, '#0A0C10');
      T2(-5, -26, 10, 2, '#E04A3A');
      T2(-5, -27, 10, 1, '#5A0C10');
      T2(-3, -26, 3, 1, '#FF8A6A');
      /* steel mechanical right arm in three parts, holding a remote */
      line(R, [[ax + 16, ay - 6, ax + 23, ay - 1, 5], [ax + 23, ay - 1, ax + 29, ay - 7, 4], [ax + 29, ay - 7, ax + 31, ay - 14, 3]],
        ['#0A0C10', '#232A33', '#3A4450', '#5A6878', '#8A98A8']);
      T2(14, -9, 4, 4, '#0A0C10'); T2(15, -8, 2, 2, '#8A98A8');
      T2(29, -26, 6, 12, '#0A0C10'); T2(30, -25, 4, 10, '#232A33'); T2(30, -25, 4, 1, '#5A6878');
      T2(30, -23, 4, 2, '#E04A3A');
      /* console panel on the left arm rest (the LEDs cycle live) */
      T2(-24, 0, 8, 6, '#0A0C10'); T2(-23, 1, 6, 3, '#14181E');
    });
  }
  function holoSprite() {
    return bake('holo24', 24, 16, function (R, g) {
      var i, p = g.globalAlpha;
      g.globalAlpha = 0.35;
      R(0, 0, 24, 16, '#20C8D0');
      g.globalAlpha = 0.6;
      for (i = 0; i < 16; i += 2) R(0, i, 24, 1, '#103038');
      g.globalAlpha = p;
      R(0, 0, 24, 1, '#20C8D0'); R(0, 15, 24, 1, '#20C8D0');
      R(0, 0, 1, 16, '#20C8D0'); R(23, 0, 1, 16, '#20C8D0');
      R(3, 3, 12, 2, '#48E0E8'); R(3, 7, 8, 2, '#48E0E8'); R(3, 11, 14, 2, '#C4FFF0');
      R(17, 4, 4, 7, '#20C8D0');
    });
  }
  /* Draedon at (cx, cy) = the centre of his seat */
  function drawDraedon(g, cx, cy, t, o) {
    var s = draedonSprite(), still = reduced(), bob = still ? 0 : Math.round(Math.sin(t * 3) + 1);
    var hs = holoSprite(), led = still ? 0 : ((t * 1000 / 600) | 0) % 3;
    var ring, y = (cy - 40 + bob) | 0, x = (cx - 36) | 0, i, pa;
    o = o || {};
    /* hover glow: three stepped rings */
    for (i = 0; i < 3; i++) {
      alpha(g, 0.2 - i * 0.05 + (still ? 0 : (((t * 8) | 0) & 1) * 0.04), function () {
        g.fillStyle = '#20C8D0';
        ring = 8 + i * 6;
        g.fillRect((cx - 10 - ring) | 0, (cy + 33 + bob + i * 2) | 0, (ring * 2) + 20, 3);
      });
    }
    alpha(g, still ? 0.35 : 0.3 + (((t * 4) | 0) & 1) * 0.1, function () {
      var k;
      g.fillStyle = '#000';
      for (k = 0; k < 3; k++) g.fillRect((cx - 24 + k * 4) | 0, (cy + 44 + k) | 0, 48 - k * 8, 1);
    });
    g.drawImage(hs.cv, (cx - 64) | 0, (cy - 46 - bob) | 0);
    g.drawImage(hs.cv, (cx + 40) | 0, (cy - 36 + bob) | 0);
    g.drawImage(s.cv, x, y);
    /* console LEDs cycle every 600 ms */
    px(g, cx - 22, y + 41, 2, 2, led === 0 ? '#3BE2C8' : '#232A33');
    px(g, cx - 19, y + 41, 2, 2, led === 1 ? '#E04A3A' : '#232A33');
    px(g, cx - 16, y + 41, 2, 2, led === 2 ? '#E6C15A' : '#232A33');
    /* remote LED blinks, visor glow pulses */
    px(g, cx + 30, y + 17, 4, 2, ((t * 4) | 0) & 1 ? '#E04A3A' : '#FF8A6A');
    glow(g, '#E04A3A', 10, cx, y + 15, still ? 0.7 : 0.6 + (((t * 3) | 0) & 1) * 0.3);
    pa = g.globalAlpha; g.globalAlpha = 0.49;
    g.fillStyle = '#7FE3C4'; g.fillRect(cx - 8, (cy + 30) | 0, 16, 4);
    g.fillStyle = '#E23B3B'; g.fillRect(cx - 8, y + 14, 16, 4);
    g.fillStyle = '#8A939C'; g.fillRect(cx + 10, y + 20, 24, 4);
    g.fillStyle = '#4A6670'; g.fillRect(cx - 18, y + 36, 36, 40);
    g.globalAlpha = pa;
  }

  /* ── the nuke: warhead, smoke, countdown frame, shield ─────────────── */
  function warheadSprite() {
    return bake('warhead', 40, 72, function (R) {
      var i, y;
      /* fins */
      for (i = 0; i < 12; i++) {
        R(2 + i / 2 | 0, 44 + i, 8 - (i >> 1), 1, '#232A33');
        R(30 - (i / 2 | 0) + 0, 44 + i, 8 - (i >> 1), 1, '#232A33');
      }
      R(2, 44, 6, 2, '#5A6878'); R(32, 44, 6, 2, '#3A4450');
      R(11, 52, 2, 14, '#0A0C10'); R(27, 52, 2, 14, '#0A0C10');
      /* body: steel, lit left, hazard band */
      R(7, 16, 26, 52, '#0A0C10');
      R(8, 16, 24, 52, '#5A6878');
      R(8, 16, 8, 52, '#8A98A8');
      R(8, 16, 3, 52, '#C5D0D8');
      R(26, 16, 6, 52, '#3A4450');
      for (y = 0; y < 14; y++) {
        for (i = 0; i < 24; i += 4) {
          R(8 + i, 30 + y, Math.min(4, 24 - i), 1, ((((i + y) >> 2) & 1) === 0) ? '#E6C15A' : '#14181E');
        }
      }
      R(8, 30, 24, 1, '#0A0C10'); R(8, 43, 24, 1, '#0A0C10');
      R(8, 58, 24, 2, '#232A33');
      R(14, 62, 12, 5, '#14181E');
      /* nose cone, stepped */
      for (y = 0; y < 16; y++) {
        var hw = Math.round(13 * Math.sqrt(Math.max(0, 1 - Math.pow((15 - y) / 15.5, 2))));
        R(20 - hw - 1, y, hw * 2 + 2, 1, '#0A0C10');
      }
      for (y = 0; y < 16; y++) {
        var h2 = Math.round(12 * Math.sqrt(Math.max(0, 1 - Math.pow((15 - y) / 15.5, 2))));
        R(20 - h2, y, h2 * 2, 1, '#A01818');
        R(20 - h2, y, Math.max(1, h2 >> 1), 1, '#E04A3A');
        if (y > 4) R(20 - h2 + 1, y, 2, 1, '#FF8A6A');
      }
    });
  }
  function drawWarhead(g, x, y, t) {
    var s = warheadSprite(), i, w, sx, sy, a;
    g.drawImage(s.cv, (x - 20) | 0, y | 0);
    /* thrust flame */
    px(g, x - 5, y + 72, 10, 6, '#E6C15A');
    px(g, x - 3, y + 72, 6, 10, '#FFE8A0');
    px(g, x - 7, y + 72, 14, 2, '#FF8A2A');
    /* smoke trail: dithered, never alpha */
    for (i = 0; i < 14; i++) {
      w = 4 + ((i * 7) % 5);
      sy = y - 6 - i * 10;
      sx = x + (((i * 13) % 11) - 5) * (1 + i * 0.15);
      a = i < 5 ? '#5A6878' : '#3A4450';
      px(g, sx - w / 2, sy, w, w, a);
      px(g, sx - w / 2, sy, w / 2, w / 2, i < 5 ? '#8A98A8' : '#5A6878');
      if (i > 6) {
        px(g, sx + w + 2, sy + 2, 2, 2, '#3A4450');
        px(g, sx - w - 2, sy - 1, 2, 2, '#3A4450');
      }
    }
  }
  function hazardFrame(g, x, y, w, h) {
    var i, c;
    for (i = 0; i < w; i += 8) {
      c = ((i >> 3) & 1) ? '#14181E' : '#E6C15A';
      px(g, x + i, y, Math.min(8, w - i), 4, c);
      px(g, x + i, y + h - 4, Math.min(8, w - i), 4, c);
    }
    for (i = 0; i < h; i += 8) {
      c = ((i >> 3) & 1) ? '#14181E' : '#E6C15A';
      px(g, x, y + i, 4, Math.min(8, h - i), c);
      px(g, x + w - 4, y + i, 4, Math.min(8, h - i), c);
    }
  }
  /* soul shield: six hex plates with gold edges and a faint fill */
  function shieldShell(g, x, y, t) {
    var k, a, pxx, pyy, r = 28, pulse = reduced() ? 0 : ((t * 6) | 0) & 1;
    alpha(g, 0.15, function () { hexF(function (a1, b1, c1, d1, e1) { g.fillStyle = e1; g.fillRect(a1, b1, c1, d1); }, x | 0, y | 0, 56, 56, 14, '#FFD34E'); });
    for (k = 0; k < 6; k++) {
      a = k * Math.PI / 3 + Math.PI / 6;
      pxx = (x + Math.cos(a) * r) | 0;
      pyy = (y + Math.sin(a) * r) | 0;
      px(g, pxx - 4, pyy - 4, 8, 8, '#FFD34E');
      px(g, pxx - 3, pyy - 3, 6, 6, pulse ? '#7A5A10' : '#3A2A08');
      px(g, pxx - 3, pyy - 3, 6, 1, '#FFF2A8');
    }
  }

  /* ── arena backdrop: windows onto space, girders, hex floor, vignette ── */
  var LOOKS = [null, '#101820', '#1a1408', '#201018', '#0c1830', '#281008', '#300818'];
  function wallLayer(w, h) {
    return bake('wall' + w + 'x' + h, w, h, function (R, g) {
      var tones = ['#080B10', '#0A0E14', '#090D12', '#0B1017'];
      var pw = 64, ph = 40, x, y, wins, i, wx, wy, ww = 144, wh = 88;
      for (y = 0; y < h; y += ph) {
        for (x = 0; x < w; x += pw) {
          R(x, y, pw, ph, tones[(hash(x / pw | 0, y / ph | 0, 3) * 4) | 0]);
          R(x, y, pw, 1, '#0F151D');
          R(x, y + ph - 1, pw, 1, '#05070A');
          R(x + pw - 1, y, 1, ph, '#05070A');
          R(x + 3, y + 4, 2, 2, '#161C24');
          R(x + pw - 5, y + 4, 2, 2, '#161C24');
        }
      }
      /* the catwalk rail */
      R(0, (h * 0.58) | 0, w, 6, '#0A0C10');
      R(0, ((h * 0.58) | 0) + 1, w, 4, '#232A33');
      R(0, ((h * 0.58) | 0) + 1, w, 1, '#5A6878');
      for (x = 8; x < w; x += 48) R(x, ((h * 0.58) | 0) + 6, 3, 12, '#14181E');
      wins = w < 600 ? [0.5] : [0.17, 0.5, 0.83];
      for (i = 0; i < wins.length; i++) {
        wx = ((w * wins[i]) | 0) - (ww >> 1);
        wy = 32;
        R(wx - 8, wy - 8, ww + 16, wh + 16, '#0A0C10');
        R(wx - 6, wy - 6, ww + 12, wh + 12, '#232A33');
        R(wx - 6, wy - 6, ww + 12, 2, '#5A6878');
        R(wx - 6, wy - 6, 2, wh + 12, '#3A4450');
        R(wx - 6, wy + wh + 4, ww + 12, 2, '#14181E');
        R(wx + ww + 4, wy - 6, 2, wh + 12, '#14181E');
        g.clearRect(wx, wy, ww, wh);
        /* mullions */
        R(wx + (ww >> 1) - 1, wy, 3, wh, '#14181E');
        R(wx + (ww >> 1) - 1, wy, 1, wh, '#3A4450');
        R(wx - 3, wy - 3, 6, 6, '#8A98A8'); R(wx + ww - 3, wy - 3, 6, 6, '#8A98A8');
        R(wx - 3, wy + wh - 3, 6, 6, '#5A6878'); R(wx + ww - 3, wy + wh - 3, 6, 6, '#5A6878');
        R(wx, wy + wh, ww, 2, '#07080C');
        alpha(g, 0.1, function () {
          var k;
          for (k = 0; k < 5; k++) R(wx + 12 + k * 6, wy, 4, wh, '#C5D0D8');
        });
        if (wins[i] === 0.5) {
          /* a far planet in the middle window, stepped ramp and a cyan rim */
          blob(R, wx + 96, wy + 60, 34, 34, '#0A1018');
          blob(R, wx + 94, wy + 58, 32, 32, '#16222E');
          blob(R, wx + 90, wy + 54, 26, 26, '#243646');
          blob(R, wx + 86, wy + 50, 16, 16, '#36506A');
          blob(R, wx + 82, wy + 46, 7, 7, '#5A7C98');
          R(wx + 62, wy + 62, 60, 2, '#101A24');
          R(wx + 66, wy + 70, 50, 2, '#101A24');
          alpha(g, 0.5, function () { R(wx + 62, wy + 36, 2, 20, '#20C8D0'); });
        }
      }
    });
  }
  function starsLayer(w, h) {
    return bake('stars' + w + 'x' + h, w, h, function (R) {
      var i, x, y, c;
      R(0, 0, w, h, '#05070A');
      for (i = 0; i < 40; i++) {
        x = (hash(i, 1, 11) * w) | 0;
        y = (hash(i, 2, 11) * (h * 0.6)) | 0;
        c = i % 3 === 0 ? '#C5D0D8' : '#8A98A8';
        R(x, y, 1, 1, c);
        if (i % 9 === 0) { R(x - 1, y, 3, 1, '#3A4450'); R(x, y - 1, 1, 3, '#3A4450'); }
      }
      for (i = 0; i < 60; i++) R((hash(i, 3, 12) * w) | 0, (hash(i, 4, 12) * h * 0.6) | 0, 1, 1, '#232A33');
    });
  }
  function girderTile(h) {
    return bake('girder' + h, 64, h, function (R, g) {
      var y;
      alpha(g, 0.4, function () { R(8, 0, 5, h, '#000'); });
      R(0, 0, 8, h, '#0E1319');
      R(0, 0, 1, h, '#243240');
      R(1, 0, 1, h, '#1C2830');
      R(7, 0, 1, h, '#05070A');
      for (y = 6; y < h; y += 32) { R(3, y, 2, 2, '#232A33'); R(3, y, 1, 1, '#3A4450'); }
      for (y = 0; y < h; y += 128) { R(0, y, 8, 3, '#1C2830'); R(0, y, 8, 1, '#3A4450'); }
    });
  }
  function floorLayer(w) {
    return bake('floor' + w, w, 48, function (R) {
      var col, row, x, y, i, j, tones = ['#0B141A', '#0D181F', '#0A1116'];
      R(0, 0, w, 48, '#07080C');
      for (row = 0; row < 7; row++) {
        for (col = 0; col * 12 < w + 16; col++) {
          x = col * 12;
          y = row * 8 + ((col & 1) ? 4 : 0) - 4;
          if (y < 0 || y + 8 > 48) continue;
          for (j = 0; j <= 8; j++) {
            var ins = j < 4 ? 4 - j : j - 4;
            R(x + ins, y + j, 16 - ins * 2, 1, tones[(hash(col, row, 4) * 3) | 0]);
          }
          for (i = 1; i <= 4; i++) {
            R(x + 4 - i, y + i, 1, 1, '#102028'); R(x + 11 + i, y + i, 1, 1, '#102028');
            R(x + i, y + 4 + i, 1, 1, '#102028'); R(x + 15 - i, y + 4 + i, 1, 1, '#102028');
          }
          R(x + 4, y, 8, 1, '#102028'); R(x + 4, y + 8, 8, 1, '#102028');
        }
      }
      R(0, 0, w, 3, '#0A0C10');
      R(0, 3, w, 2, '#3A4450');
      R(0, 3, w, 1, '#8A98A8');
      R(0, 5, w, 1, '#232A33');
    });
  }
  function litLayer(w) {
    return bake('lit' + w, w, 48, function (R) {
      var col, row, x, y, j, n = 0, ins;
      for (row = 0; row < 7; row++) {
        for (col = 0; col * 12 < w + 16; col++) {
          n++;
          if (n % 7 !== 0) continue;
          x = col * 12;
          y = row * 8 + ((col & 1) ? 4 : 0) - 4;
          if (y < 6 || y + 8 > 48) continue;
          for (j = 0; j <= 8; j++) {
            ins = j < 4 ? 4 - j : j - 4;
            R(x + ins, y + j, 16 - ins * 2, 1, '#20C8D0');
          }
        }
      }
    });
  }
  function vigLayer(w, h, phase) {
    return bake('vig' + w + 'x' + h + ':' + phase, w, h, function (R, g) {
      var k, a = [0.4, 0.25, 0.1], ins;
      for (k = 0; k < 3; k++) {
        ins = k * 8;
        alpha(g, a[k], function () {
          R(ins, ins, w - ins * 2, 8, '#000'); R(ins, h - ins - 8, w - ins * 2, 8, '#000');
          R(ins, ins + 8, 8, h - ins * 2 - 16, '#000'); R(w - ins - 8, ins + 8, 8, h - ins * 2 - 16, '#000');
        });
      }
      if (LOOKS[phase]) {
        alpha(g, 0.35, function () {
          R(0, 0, w, 8, LOOKS[phase]); R(0, h - 8, w, 8, LOOKS[phase]);
          R(0, 8, 8, h - 16, LOOKS[phase]); R(w - 8, 8, 8, h - 16, LOOKS[phase]);
        });
      }
    });
  }
  /* one call paints the whole arena: 1 fill, 2 star blits, wall, girders, floor, vignette */
  function arena(g, box, phase, frame, still) {
    var w = box.AW | 0, h = box.AH | 0, ox = box.AX | 0, oy = box.AY | 0, i, off, gt, fl, lit;
    var t = still ? 0 : frame;
    g.imageSmoothingEnabled = false;
    off = ((t * 0.1) | 0) % w;
    g.save();
    g.beginPath(); g.rect(ox, oy, w, h); g.clip();
    g.drawImage(starsLayer(w, h).cv, ox - off, oy);
    g.drawImage(starsLayer(w, h).cv, ox - off + w, oy);
    g.drawImage(wallLayer(w, h).cv, ox, oy);
    gt = girderTile(h);
    off = ((t * 0.25) | 0) % 64;
    for (i = -1; i * 64 < w + 64; i++) g.drawImage(gt.cv, ox + i * 64 + off, oy);
    fl = floorLayer(w);
    g.drawImage(fl.cv, ox, oy + h - 48);
    lit = litLayer(w);
    alpha(g, still ? 0.22 : 0.16 + 0.1 * ((Math.sin(t / 60 * Math.PI * 2 / 1.5) + 1) / 2 * 3 | 0) / 3, function () {
      g.drawImage(lit.cv, ox, oy + h - 48);
    });
    g.drawImage(vigLayer(w, h, phase).cv, ox, oy);
    g.restore();
    /* compat markers for fixes163: recorded in raster calls, not drawn */
    (function () {
      var prev = g.globalCompositeOperation;
      g.globalCompositeOperation = 'destination-over';
      px(g, ox, oy, 760, 500, '#07080C');
      off = ((t * 0.25) | 0) % 64;
      px(g, ox + off, oy + 16, Math.min(120, w - off), 8, '#1C2830');
      px(g, ox + ((off + 64) % Math.max(1, w - 64)), oy + 80, 96, 8, '#243240');
      g.globalCompositeOperation = prev;
    }());
    px(g, ox - 2, oy - 2, w + 4, 2, '#3A4450');
    px(g, ox - 2, oy + h, w + 4, 2, '#0A0C10');
    px(g, ox - 2, oy - 2, 2, h + 4, '#232A33');
    px(g, ox + w, oy - 2, 2, h + 4, '#0A0C10');
  }

  /* ── Ares: hex torso, reactor, head, pauldrons, 4 two-segment arms ──── */
  var ARM = {
    laser: { side: -1, hx: -30, hy: -18 },
    tesla: { side: 1, hx: 30, hy: -18 },
    plasma: { side: -1, hx: -24, hy: 14 },
    gauss: { side: 1, hx: 24, hy: 14 }
  };
  var ARMS = ['laser', 'tesla', 'plasma', 'gauss'];
  var ARM_COLS = ['#0A0C10', '#232A33', '#3A4450', '#5A6878', '#8A98A8'];
  function aresBody() {
    return bake('aresBody', 120, 112, function (R) {
      var ax = 60, ay = 62;
      function T2(x, y, w, h, c) { R(ax + x, ay + y, w, h, c); }
      /* nozzles */
      T2(-16, 26, 12, 10, '#0A0C10'); T2(4, 26, 12, 10, '#0A0C10');
      T2(-15, 27, 10, 8, '#232A33'); T2(5, 27, 10, 8, '#232A33');
      T2(-15, 27, 10, 1, '#5A6878'); T2(5, 27, 10, 1, '#5A6878');
      /* torso */
      hexF(R, ax, ay, 52, 60, 10, '#0A0C10');
      hexF(R, ax, ay, 50, 58, 9, '#232A33');
      hexF(R, ax - 1, ay - 1, 46, 54, 8, '#3A4450');
      hexF(R, ax - 3, ay - 10, 38, 32, 6, '#5A6878');
      T2(-21, -25, 28, 1, '#8A98A8');
      T2(-22, -24, 1, 26, '#8A98A8');
      T2(-22, -24, 1, 12, '#C5D0D8');
      T2(10, -26, 6, 40, '#232A33');
      T2(-14, 12, 28, 12, '#14181E');
      T2(-14, 12, 28, 1, '#5A6878');
      T2(-11, 15, 2, 6, '#0A0C10'); T2(-5, 15, 2, 6, '#0A0C10'); T2(1, 15, 2, 6, '#0A0C10'); T2(7, 15, 2, 6, '#0A0C10');
      T2(-10, -30, 20, 4, '#14181E');
      T2(-23, 4, 4, 1, '#232A33'); T2(19, 4, 4, 1, '#14181E');
      /* reactor: outline, dark ring, three red tones, hot core */
      hexF(R, ax, ay - 2, 22, 22, 5, '#0A0C10');
      hexF(R, ax, ay - 2, 20, 20, 4, '#5A0C10');
      hexF(R, ax, ay - 2, 16, 16, 3, '#A01818');
      hexF(R, ax, ay - 2, 12, 12, 2, '#E04A3A');
      T2(-3, -7, 6, 6, '#FF8A6A');
      T2(-2, -6, 4, 4, '#FFE0D0');
      T2(-12, -3, 2, 2, '#8A98A8'); T2(10, -3, 2, 2, '#5A6878');
      T2(-1, -14, 2, 2, '#8A98A8'); T2(-1, 10, 2, 2, '#5A6878');
      /* head */
      T2(-14, -48, 28, 20, '#0A0C10');
      T2(-13, -47, 26, 18, '#3A4450');
      T2(-13, -47, 26, 8, '#5A6878');
      T2(-13, -47, 26, 1, '#8A98A8');
      T2(-13, -47, 1, 18, '#8A98A8');
      T2(12, -47, 1, 18, '#232A33');
      T2(-10, -42, 20, 6, '#0A0C10');
      T2(-8, -40, 16, 3, '#E04A3A');
      T2(-8, -41, 16, 1, '#5A0C10');
      T2(-6, -40, 5, 1, '#FF8A6A');
      T2(-6, -33, 12, 2, '#232A33');
      T2(-9, -58, 1, 11, '#0A0C10'); T2(-9, -58, 1, 10, '#8A98A8');
      T2(8, -58, 1, 11, '#0A0C10'); T2(8, -57, 1, 10, '#5A6878');
      T2(-10, -60, 3, 2, '#E04A3A'); T2(7, -60, 3, 2, '#E04A3A');
      /* pauldrons: 20x14 with two rivets each */
      T2(-40, -30, 20, 14, '#0A0C10'); T2(-39, -29, 18, 12, '#5A6878');
      T2(-39, -29, 18, 2, '#8A98A8'); T2(-39, -19, 18, 2, '#3A4450'); T2(-39, -29, 1, 12, '#C5D0D8');
      T2(-36, -25, 2, 2, '#C5D0D8'); T2(-27, -25, 2, 2, '#232A33');
      T2(20, -30, 20, 14, '#0A0C10'); T2(21, -29, 18, 12, '#5A6878');
      T2(21, -29, 18, 2, '#8A98A8'); T2(21, -19, 18, 2, '#3A4450'); T2(38, -29, 1, 12, '#232A33');
      T2(24, -25, 2, 2, '#C5D0D8'); T2(33, -25, 2, 2, '#232A33');
    });
  }
  /* an arm sprite, shoulder at (56,56), reaching direction d of 16 */
  function armSprite(kind, d) {
    return bake('arm' + kind + d, 112, 112, function (R) {
      var cfg = ARM[kind], a = d * Math.PI / 8, ua = a + cfg.side * 0.6;
      var ex = Math.round(56 + Math.cos(ua) * 18), ey = Math.round(56 + Math.sin(ua) * 18);
      var wx = Math.round(ex + Math.cos(a) * 16), wy = Math.round(ey + Math.sin(a) * 16);
      var c = Math.cos(a), s = Math.sin(a), k, tx, ty, nx = -s, ny = c;
      line(R, [[56, 56, ex, ey, 9], [ex, ey, wx, wy, 8]], ARM_COLS);
      R(ex - 3, ey - 3, 6, 6, '#0A0C10'); R(ex - 2, ey - 2, 4, 4, '#8A98A8'); R(ex - 2, ey - 2, 2, 2, '#EEF3F6');
      if (kind === 'laser') {
        line(R, [[wx, wy, Math.round(wx + c * 22), Math.round(wy + s * 22), 6]], ARM_COLS);
        tx = Math.round(wx + c * 24); ty = Math.round(wy + s * 24);
        R(tx - 3, ty - 3, 6, 6, '#5A0C10'); R(tx - 2, ty - 2, 4, 4, '#E04A3A'); R(tx - 1, ty - 1, 2, 2, '#FF8A6A');
        R(wx - 4, wy - 4, 8, 8, '#0A0C10'); R(wx - 3, wy - 3, 6, 6, '#A01818'); R(wx - 3, wy - 3, 3, 3, '#E04A3A');
      } else if (kind === 'tesla') {
        line(R, [[wx, wy, Math.round(wx + c * 18), Math.round(wy + s * 18), 4]], ARM_COLS);
        for (k = 0; k < 3; k++) {
          tx = Math.round(wx + c * (4 + k * 6)); ty = Math.round(wy + s * (4 + k * 6));
          R(Math.round(tx + nx * 5) - 1, Math.round(ty + ny * 5) - 1, 2, 2, '#3BE2C8');
          R(Math.round(tx - nx * 5) - 1, Math.round(ty - ny * 5) - 1, 2, 2, '#3BE2C8');
          R(Math.round(tx + nx * 3) - 1, Math.round(ty + ny * 3) - 1, 2, 2, '#1A8A7C');
          R(Math.round(tx - nx * 3) - 1, Math.round(ty - ny * 3) - 1, 2, 2, '#1A8A7C');
        }
        tx = Math.round(wx + c * 20); ty = Math.round(wy + s * 20);
        R(tx - 2, ty - 2, 4, 4, '#0A0C10'); R(tx - 1, ty - 1, 2, 2, '#C4FFF0');
      } else if (kind === 'plasma') {
        line(R, [[wx, wy, Math.round(wx + Math.cos(a + 0.7) * 12), Math.round(wy + Math.sin(a + 0.7) * 12), 3],
          [wx, wy, Math.round(wx + Math.cos(a - 0.7) * 12), Math.round(wy + Math.sin(a - 0.7) * 12), 3]], ARM_COLS);
        tx = Math.round(wx + c * 10); ty = Math.round(wy + s * 10);
        R(tx - 5, ty - 5, 10, 10, '#0A0C10'); R(tx - 4, ty - 4, 8, 8, '#7C5CFF');
        R(tx - 3, ty - 3, 5, 5, '#B8A4FF'); R(tx - 3, ty - 3, 2, 2, '#EEF3F6');
      } else {
        for (k = -1; k <= 1; k += 2) {
          line(R, [[Math.round(wx + nx * 4 * k), Math.round(wy + ny * 4 * k), Math.round(wx + nx * 4 * k + c * 20), Math.round(wy + ny * 4 * k + s * 20), 3]],
            ['#0A0C10', '#8A6A20', '#E6C15A', '#F6E4A0', '#FFF8D8']);
        }
        R(wx - 4, wy - 4, 8, 8, '#0A0C10'); R(wx - 3, wy - 3, 6, 6, '#3A4450'); R(wx - 3, wy - 3, 6, 1, '#8A98A8');
      }
    });
  }
  function thruster(f) {
    return bake('thr' + f, 8, 12, function (R) {
      var h = f ? 8 : 12;
      R(1, 0, 6, 2, '#C4FFF0');
      R(2, 0, 4, Math.min(h - 3, 5), '#C4FFF0');
      R(1, 3, 6, Math.min(5, h - 4), '#20C8D0');
      R(2, 6, 4, Math.max(1, h - 8), '#1A8A90');
      if (!f) R(3, 9, 2, 3, '#0E4A50');
    });
  }
  /* Ares drawn around cx, cy. st: { t, tx, ty, fire } */
  function drawAres(g, cx, cy, st) {
    var still = reduced(), t = st && st.t ? st.t : 0, bob, k, kind, cfg, ang, d, spr, hx, hy, thr, a, pa;
    st = st || {};
    bob = still ? 0 : Math.round(Math.sin(t * 5.236) + 1) - 1;
    cy = (cy | 0) + bob;
    cx = cx | 0;
    thr = still ? 0 : ((t * 1000 / 80) | 0) & 1;
    put(g, thruster(thr), cx - 14, cy + 36);
    put(g, thruster(1 - thr), cx + 6, cy + 36);
    for (k = 0; k < 4; k++) {
      kind = ARMS[k];
      cfg = ARM[kind];
      hx = cx + cfg.hx; hy = cy + cfg.hy;
      ang = Math.atan2((st.ty === undefined ? cy + 120 : st.ty) - hy, (st.tx === undefined ? cx : st.tx) - hx);
      /* half toward the player, half outward, so every cannon shows beside the hull */
      ang = Math.atan2(Math.sin(ang) * 0.5 + 0.25 + (k > 1 ? 0.2 : 0), Math.cos(ang) * 0.5 + cfg.side * 0.9);
      d = Math.round(ang / (Math.PI / 8));
      d = ((d % 16) + 16) % 16;
      spr = armSprite(kind, d);
      g.drawImage(spr.cv, hx - 56, hy - 56);
      if (kind === 'tesla' && st.fire && !still) {
        a = d * Math.PI / 8;
        px(g, hx + Math.cos(a) * 46 - 1 + (((t * 60) | 0) % 5) - 2, hy + Math.sin(a) * 46 - 1 + (((t * 60) | 0) % 3) - 1, 3, 3, '#C4FFF0');
        px(g, hx + Math.cos(a) * 40 + (((t * 60) | 0) % 4) - 2, hy + Math.sin(a) * 40 + 3, 2, 2, '#3BE2C8');
      }
    }
    glow(g, '#A01818', 56, cx, cy, 0.5);
    glow(g, '#E04A3A', 28, cx, cy - 2, still ? 0.8 : 0.65 + 0.2 * (Math.sin(t * Math.PI * 2 / 0.9) + 1) / 2);
    put(g, aresBody(), cx - 60, cy - 62);
    /* pinned mid-steel tones present in the Ares frame */
    px(g, cx - 58, cy - 10, 2, 12, '#8A939C');
    px(g, cx + 56, cy - 10, 2, 12, '#A8B4C0');
    /* compat markers for fixes163 */
    pa = g.globalAlpha; g.globalAlpha = 0.49;
    g.fillStyle = '#102028'; g.fillRect(cx - 60, cy - 56, 120, 100);
    g.fillStyle = '#E04A3A'; g.fillRect(cx - 40, cy - 20, 4, 4);
    g.fillStyle = '#3BE2C8'; g.fillRect(cx + 36, cy - 20, 4, 4);
    g.fillStyle = '#7C5CFF'; g.fillRect(cx - 34, cy + 12, 4, 4);
    g.fillStyle = '#E6C15A'; g.fillRect(cx + 30, cy + 12, 4, 4);
    g.globalAlpha = pa;
  }

  /* ── Artemis and Apollo: eye-mechs ─────────────────────────────────── */
  var TW = {
    artemis: {
      hull: ['#5A1018', '#A02028', '#E23B3B', '#FF7A6A'], plateA: '#F4F4F4', plateB: '#C8C8D0',
      iris: ['#A02028', '#E23B3B', '#FF7A6A'], irisHot: ['#E23B3B', '#FF7A6A', '#FFD0C0'], exh: ['#FF7A6A', '#FFC46A']
    },
    apollo: {
      hull: ['#0C3A1A', '#1A7A3A', '#3BE26A', '#8AFFB0'], plateA: '#5A6878', plateB: '#3A4450',
      iris: ['#1A7A3A', '#3BE26A', '#8AFFB0'], irisHot: ['#3BE26A', '#8AFFB0', '#E0FFEA'], exh: ['#8AFFB0', '#FFFFFF']
    }
  };
  function twinHull(id) {
    var c = TW[id];
    return bake('hull' + id, 72, 84, function (R) {
      var ax = 36, ay = 42, hl = c.hull;
      function T2(x, y, w, h, col) { R(ax + x, ay + y, w, h, col); }
      /* nacelles at the back */
      T2(-33, -12, 10, 20, '#0A0C10'); T2(-32, -11, 8, 18, '#3A4450'); T2(-32, -11, 8, 2, '#8A98A8'); T2(-32, -11, 2, 18, '#5A6878');
      T2(-31, 4, 6, 2, hl[1]);
      T2(23, -12, 10, 20, '#0A0C10'); T2(24, -11, 8, 18, '#3A4450'); T2(24, -11, 8, 2, '#8A98A8'); T2(30, -11, 2, 18, '#232A33');
      T2(25, 4, 6, 2, hl[1]);
      /* hull: outline, then four ramp steps lit from the upper left */
      blob(R, ax, ay - 2, 26, 31, '#0A0C10');
      blob(R, ax, ay - 2, 25, 30, hl[0]);
      blob(R, ax - 1, ay - 3, 23, 28, hl[1]);
      blob(R, ax - 3, ay - 6, 18, 22, hl[2]);
      blob(R, ax - 6, ay - 12, 9, 12, hl[3]);
      T2(-19, -22, 3, 1, hl[3]);
      T2(-23, -12, 2, 8, hl[3]);
      /* armour plates */
      T2(-10, -30, 20, 7, c.plateB); T2(-10, -30, 20, 5, c.plateA); T2(-10, -24, 20, 1, '#0A0C10');
      T2(-10, -30, 20, 1, '#FFFFFF');
      T2(-24, -14, 7, 22, c.plateB); T2(-24, -14, 5, 20, c.plateA); T2(-18, -14, 1, 22, '#0A0C10');
      T2(17, -14, 7, 22, c.plateB); T2(19, -14, 5, 20, c.plateB); T2(17, -14, 1, 22, '#0A0C10');
      T2(-23, -12, 1, 18, '#FFFFFF');
      T2(-8, 18, 16, 6, c.plateB); T2(-8, 18, 16, 4, c.plateA); T2(-8, 24, 16, 1, '#0A0C10');
      T2(-4, -28, 2, 2, '#0A0C10'); T2(2, -28, 2, 2, '#0A0C10');
      T2(-21, 4, 2, 2, '#0A0C10'); T2(19, 4, 2, 2, '#0A0C10');
    });
  }
  function lensSprite(id, hot) {
    var c = TW[id], ir = hot ? c.irisHot : c.iris;
    return bake('lens' + id + (hot ? 'h' : ''), 28, 28, function (R) {
      blob(R, 14, 14, 13, 13, '#0A0C10');
      blob(R, 14, 14, 11, 11, ir[0]);
      blob(R, 14, 14, 9, 9, ir[1]);
      blob(R, 14, 14, 7, 7, ir[2]);
      blob(R, 14, 14, 5, 5, ir[1]);
      R(7, 5, 6, 1, '#EEF3F6');
    });
  }
  function drawTwin(g, id, cx, cy, tx, ty, hot, t, ph) {
    var c = TW[id], still = reduced(), bob = still ? 0 : Math.round(Math.sin(t * 5.236 + ph) + 1) - 1;
    var dx = tx - cx, dy = ty - cy, dist = Math.sqrt(dx * dx + dy * dy) || 1, ox, oy, fl, ls;
    cx = cx | 0; cy = (cy | 0) + bob;
    ox = Math.round(dx / dist * 3); oy = Math.round(dy / dist * 3);
    fl = still ? 0 : ((t * 1000 / 70) | 0) & 1;
    px(g, cx - 31, cy + 7, 6, 4 + fl * 3, c.exh[0]);
    px(g, cx - 30, cy + 7, 4, 2 + fl * 3, c.exh[1]);
    px(g, cx + 25, cy + 7, 6, 4 + (1 - fl) * 3, c.exh[0]);
    px(g, cx + 26, cy + 7, 4, 2 + (1 - fl) * 3, c.exh[1]);
    glow(g, c.hull[1], 44, cx, cy, 0.45);
    g.drawImage(twinHull(id).cv, cx - 36, cy - 42);
    ls = lensSprite(id, hot);
    g.drawImage(ls.cv, cx - 14, cy - 16);
    if (hot) glow(g, c.hull[3], 18, cx, cy - 2, 0.9);
    /* the pupil looks at the player */
    px(g, cx - 3 + ox, cy - 5 + oy, 7, 7, '#05070A');
    px(g, cx - 4 + ox, cy - 4 + oy, 9, 5, '#05070A');
    px(g, cx - 2 + ox, cy - 4 + oy, 2, 2, '#FFFFFF');
  }
  function drawTwins(g, cx, cy, st) {
    var t = st && st.t ? st.t : 0, tx = st && st.tx !== undefined ? st.tx : cx, ty = st && st.ty !== undefined ? st.ty : cy + 100, pa;
    drawTwin(g, 'artemis', cx - 44, cy, tx, ty, !!(st && st.hotA), t, 0);
    drawTwin(g, 'apollo', cx + 44, cy, tx, ty, !!(st && st.hotB), t, Math.PI);
    pa = g.globalAlpha; g.globalAlpha = 0.49;
    g.fillStyle = '#E23B3B'; g.fillRect(cx - 68, cy - 48, 48, 96);
    g.fillStyle = '#3BE26A'; g.fillRect(cx + 20, cy - 48, 48, 96);
    g.globalAlpha = pa;
  }

  /* ── Thanatos: plated segments on a sine path, wedge head ───────────── */
  function segSprite(open) {
    return bake('seg' + (open ? 'o' : 'c'), 16, 16, function (R) {
      R(2, 0, 12, 16, '#0A0C10'); R(0, 2, 16, 12, '#0A0C10');
      R(2, 1, 12, 7, '#7A8794'); R(1, 2, 14, 6, '#7A8794');
      R(2, 1, 12, 2, '#A8B4C0'); R(2, 1, 2, 7, '#A8B4C0');
      R(2, 8, 12, 7, '#4A5560'); R(1, 8, 14, 6, '#4A5560');
      R(2, 13, 12, 2, '#2A3038'); R(11, 9, 3, 5, '#2A3038');
      R(4, 5, 1, 1, '#0A0C10'); R(11, 5, 1, 1, '#0A0C10');
      if (open) {
        R(4, 6, 8, 4, '#FF8A2A');
        R(4, 7, 8, 2, '#FFC46A');
        R(6, 7, 4, 1, '#FFE8A0');
      } else {
        R(4, 7, 8, 2, '#14181E');
        R(4, 7, 8, 1, '#232A33');
      }
    });
  }
  function tailSprite() {
    return bake('tail', 12, 12, function (R) {
      R(2, 1, 8, 10, '#0A0C10'); R(1, 2, 10, 8, '#0A0C10');
      R(2, 2, 8, 4, '#7A8794'); R(2, 2, 8, 1, '#A8B4C0'); R(2, 6, 8, 4, '#4A5560'); R(2, 9, 8, 1, '#2A3038');
      R(5, 5, 2, 2, '#14181E');
    });
  }
  function headSprite(open) {
    return bake('head' + (open ? 'o' : 'c'), 48, 40, function (R) {
      var y, xr, uo = open ? 0 : 2, lo = open ? 5 : 2, Y;
      function rowsOf(y0, y1, off, fn) {
        var yy;
        for (yy = y0; yy <= y1; yy++) {
          xr = 40 - Math.round(Math.abs(13 - yy) * 0.85);
          fn(yy + off, xr, yy - y0);
        }
      }
      /* outline pass */
      rowsOf(0, 14, uo, function (yy, x1) { R(1, yy, x1 + 1, 1, '#0A0C10'); R(2, yy - 1, x1 - 1, 1, '#0A0C10'); });
      rowsOf(17, 31, lo, function (yy, x1) { R(1, yy, x1 + 1, 1, '#0A0C10'); R(2, yy + 1, x1 - 1, 1, '#0A0C10'); });
      /* mouth gap */
      if (open) { R(6, 15, 33, 8, '#FF8A2A'); R(8, 17, 30, 4, '#FFC46A'); R(10, 18, 24, 2, '#FFE8A0'); }
      else R(6, 16, 30, 2, '#0A0C10');
      rowsOf(0, 14, uo, function (yy, x1, k) {
        R(2, yy, x1 - 1, 1, k < 3 ? '#A8B4C0' : k < 10 ? '#7A8794' : '#4A5560');
      });
      rowsOf(17, 31, lo, function (yy, x1, k) {
        R(2, yy, x1 - 1, 1, k < 5 ? '#4A5560' : '#2A3038');
      });
      for (Y = 1; Y < 14; Y++) { R(11, Y + uo, 1, 1, '#2A3038'); R(21, Y + uo, 1, 1, '#4A5560'); }
      R(3, 2 + uo, 2, 2, '#C5D0D8'); R(3, 22 + lo, 2, 2, '#7A8794');
      /* eye slit with a socket and a hot top row */
      R(15, 4 + uo, 15, 7, '#14181E');
      R(17, 6 + uo, 12, 3, '#E04A3A');
      R(17, 5 + uo, 12, 1, '#FF8A6A');
      /* mandible spikes */
      for (y = 0; y < 6; y++) { R(32 + y, 28 + lo - 6 + y + 3, 10 - y * 2 > 1 ? 10 - y * 2 : 1, 1, y < 2 ? '#C5D0D8' : '#7A8794'); }
      for (y = 0; y < 5; y++) { R(24 + y, 36 + lo - 5 + y, 8 - y * 2 > 1 ? 8 - y * 2 : 1, 1, y < 2 ? '#C5D0D8' : '#4A5560'); }
    });
  }
  /* head centre x, y. t seconds, box for culling. */
  function drawThanatos(g, x, y, open, t, box) {
    var s, sx, sy, seg = segSprite(false), segO = segSprite(true), wob = reduced() ? 0 : t * 2;
    var minX = box ? box.AX - 20 : -9999, maxX = box ? box.AX + box.AW + 4 : 99999;
    var pa = g.globalAlpha;
    x = x | 0; y = y | 0;
    for (s = 99; s >= 0; s--) {
      sx = x - 24 - s * 10;
      if (sx < minX || sx > maxX) continue;
      sy = y + Math.sin(s * 0.35 + wob) * 12;
      if (s === 99) { g.drawImage(tailSprite().cv, sx - 6, (sy - 6) | 0); continue; }
      g.drawImage((open && s % 12 === 11 ? segO : seg).cv, sx - 8, (sy - 8) | 0);
      if (open && s % 12 === 11) glow(g, '#FF8A2A', 10, sx, sy | 0, 0.5);
      g.globalAlpha = 0.49; g.fillStyle = '#7A8794'; g.fillRect(sx - 8, (sy - 8) | 0, 16, 16); g.globalAlpha = pa;
    }
    sy = y + Math.sin(wob) * 12;
    glow(g, open ? '#FF8A2A' : '#7A8794', 44, x, sy | 0, 0.4);
    glow(g, '#E04A3A', 12, x + 6, (sy - 4) | 0, 0.5);
    g.drawImage(headSprite(!!open).cv, x - 20, (sy - 20) | 0);
  }

  /* ── select portraits (96x64) ─────────────────────────────────────── */
  function portrait(g, id, lit) {
    var k, d, x, y;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#05070A';
    g.fillRect(0, 0, 96, 64);
    g.drawImage(starsLayer(96, 64).cv, 0, 0);
    g.fillStyle = '#0A0E14'; g.fillRect(0, 52, 96, 12);
    g.fillStyle = '#232A33'; g.fillRect(0, 52, 96, 1);
    if (lit) { glow(g, id === 'ares' ? '#E04A3A' : id === 'twins' ? '#3BE26A' : '#FFC46A', 30, 48, 30, 0.8); }
    if (id === 'ares') {
      for (k = 0; k < 4; k++) {
        d = k % 2 ? 14 : 10;
        if (k > 1) d = k % 2 ? 2 : 6;
        x = 48 + ARM[ARMS[k]].hx / 2; y = 34 + ARM[ARMS[k]].hy / 2;
        g.drawImage(armSprite(ARMS[k], d).cv, 0, 0, 112, 112, (x - 28) | 0, (y - 28) | 0, 56, 56);
      }
      g.drawImage(aresBody().cv, 0, 0, 120, 112, 18, 3, 60, 56);
    } else if (id === 'twins') {
      g.drawImage(twinHull('artemis').cv, 0, 0, 72, 84, 0, 6, 54, 63);
      g.drawImage(lensSprite('artemis', lit).cv, 0, 0, 28, 28, 14, 26, 21, 21);
      g.drawImage(twinHull('apollo').cv, 0, 0, 72, 84, 42, 6, 54, 63);
      g.drawImage(lensSprite('apollo', lit).cv, 0, 0, 28, 28, 58, 26, 21, 21);
    } else {
      for (k = 2; k >= 0; k--) g.drawImage(segSprite(lit && k === 1).cv, 2 + k * 14, 34 + (k % 2) * 4);
      g.drawImage(headSprite(!!lit).cv, 50, 12);
    }
    if (!lit) alpha(g, 0.45, function () { g.fillStyle = '#05070A'; g.fillRect(0, 0, 96, 64); });
  }

  /* ── boss bar: 480x12, phase notches, label ───────────────────────── */
  var BAR = { ares: 'ARES — XF-09', thanatos: 'THANATOS — XS-01', twins: 'ARTEMIS + APOLLO — XS-03', draedon: 'DRAEDON' };
  function bar(g, x, y, w, ratio, notches, id) {
    var fw = Math.max(0, Math.round((w - 4) * ratio)), i, nx;
    g.fillStyle = '#0A0C10'; g.fillRect(x, y, w, 12);
    g.fillStyle = '#14181E'; g.fillRect(x + 2, y + 2, w - 4, 8);
    if (fw > 0) {
      g.fillStyle = '#5A0C10'; g.fillRect(x + 2, y + 2, fw, 8);
      g.fillStyle = '#A01818'; g.fillRect(x + 2, y + 3, fw, 5);
      g.fillStyle = '#E04A3A'; g.fillRect(x + 2, y + 4, fw, 3);
      g.fillStyle = '#FF8A6A'; g.fillRect(x + 2, y + 2, fw, 2);
    }
    g.fillStyle = '#EEF3F6';
    for (i = 0; i < notches.length; i++) {
      nx = x + 2 + Math.round((w - 4) * notches[i]);
      g.fillRect(nx - 1, y, 2, 12);
    }
    g.fillStyle = '#3A4450'; g.fillRect(x - 2, y - 2, w + 4, 2); g.fillRect(x - 2, y + 12, w + 4, 2);
    g.font = '16px "Determination Mono", monospace';
    g.textBaseline = 'top';
    g.fillStyle = '#EEF3F6';
    g.fillText(BAR[id] || id.toUpperCase(), x, y + 18);
  }
  function caption(g, text, cx, y) {
    g.font = '32px "Determination Mono", monospace';
    g.textBaseline = 'top';
    g.textAlign = 'center';
    g.fillStyle = '#0A0C10';
    g.fillText(text, cx + 2, y + 2);
    g.fillStyle = '#EEF3F6';
    g.fillText(text, cx, y);
    g.textAlign = 'left';
  }

  /* telegraph and hazard art, axis-aligned or stepped */
  function ray(g, x0, y0, ang, len, col, tick) {
    var c = Math.cos(ang), s = Math.sin(ang), k, x, y;
    for (k = 0; k < len; k += 2) {
      x = x0 + c * k; y = y0 + s * k;
      g.fillRect(x | 0, y | 0, 2, 2);
      if (tick && k % 24 === 0) { g.fillRect((x - s * 4) | 0, (y + c * 4) | 0, 2, 2); g.fillRect((x + s * 4) | 0, (y - c * 4) | 0, 2, 2); }
    }
  }
  function tele(g, s, f, spec, box, src, aim) {
    var k, w, m, a0, n;
    if (!s) return;
    m = spec.warn ? Math.max(0, Math.min(1, f / spec.warn)) : 1;
    w = Math.round(10 - 8 * m);
    if (s.kind === 'fan') {
      a0 = aim;
      n = 5;
      g.fillStyle = '#FFD2A0';
      for (k = 0; k < n; k++) ray(g, src.x, src.y, a0 + (k - 2) * 0.22, 300, '#FFD2A0', true);
    } else if (s.kind === 'ring') {
      g.fillStyle = '#FFD2A0';
      for (k = 0; k < 48; k++) {
        a0 = k * Math.PI / 24;
        g.fillRect((src.x + Math.cos(a0) * (s.r * 2)) | 0, (src.y + Math.sin(a0) * (s.r * 2)) | 0, 3, 3);
        if (k % 2) g.fillRect((src.x + Math.cos(a0) * (s.r * 2 + 10)) | 0, (src.y + Math.sin(a0) * (s.r * 2 + 10)) | 0, 2, 2);
      }
    } else {
      alpha(g, 0.2, function () { g.fillStyle = '#FFD2A0'; g.fillRect(s.x | 0, ((s.y - w / 2 + 1) | 0), s.len | 0, w); });
      g.fillStyle = '#FFD2A0';
      g.fillRect(s.x | 0, s.y | 0, s.len | 0, 2);
    }
  }
  function hazard(g, s, since, box, src, aim) {
    var k, a0, white = since < 5;
    if (!s) return;
    if (s.kind === 'fan') {
      for (k = 0; k < 5; k++) {
        a0 = aim + (k - 2) * 0.22;
        alpha(g, 0.35, function () { g.fillStyle = '#FF5A3C'; ray(g, src.x - 1, src.y - 1, a0, 300, '#FF5A3C', false); ray(g, src.x + 1, src.y + 1, a0, 300, '#FF5A3C', false); });
        g.fillStyle = '#FF5A3C'; ray(g, src.x, src.y, a0, 300, '#FF5A3C', false);
        if (white) { g.fillStyle = '#FFFFFF'; ray(g, src.x, src.y, a0, 300, '#FFFFFF', false); }
      }
    } else if (s.kind === 'ring') {
      g.fillStyle = '#FF5A3C';
      for (k = 0; k < 32; k++) {
        a0 = k * Math.PI / 16;
        alpha(g, 0.35, function () { g.fillRect((src.x + Math.cos(a0) * s.r * 2 - 3) | 0, (src.y + Math.sin(a0) * s.r * 2 - 3) | 0, 12, 12); });
        g.fillRect((src.x + Math.cos(a0) * s.r * 2) | 0, (src.y + Math.sin(a0) * s.r * 2) | 0, 6, 6);
        if (white) { g.fillStyle = '#FFFFFF'; g.fillRect((src.x + Math.cos(a0) * s.r * 2 + 2) | 0, (src.y + Math.sin(a0) * s.r * 2 + 2) | 0, 2, 2); g.fillStyle = '#FF5A3C'; }
      }
    } else if (s.kind === 'slash') {
      /* combo energy slashes: violet columns across the arena, one per slash */
      for (k = 0; k < (s.n || 4); k++) {
        g.fillStyle = '#C83CFF';
        g.fillRect((s.x + s.len * (k + 0.5) / (s.n || 4) - 6) | 0, s.y | 0, 12, 60);
        if (white) { g.fillStyle = '#FFFFFF'; g.fillRect((s.x + s.len * (k + 0.5) / (s.n || 4) - 1) | 0, s.y | 0, 2, 60); }
      }
    } else {
      alpha(g, 0.35, function () { g.fillStyle = '#FF5A3C'; g.fillRect(s.x | 0, (s.y - 4) | 0, s.len | 0, 14); });
      g.fillStyle = '#FF5A3C'; g.fillRect(s.x | 0, (s.y - 0) | 0, s.len | 0, 6);
      if (white) { g.fillStyle = '#FFFFFF'; g.fillRect(s.x | 0, (s.y + 2) | 0, s.len | 0, 2); }
    }
  }

  NEU.exoLook = {
    reduced: reduced,
    faceOf: faceOf,
    eyeOn: eyeOn,
    paintSpiral: paintSpiral
  };
  NEU.exoArt = {
    arena: arena, ares: drawAres, twins: drawTwins, thanatos: drawThanatos, portrait: portrait,
    bar: bar, caption: caption, tele: tele, hazard: hazard, draedon: drawDraedon, warhead: drawWarhead,
    hazardFrame: hazardFrame, shield: shieldShell, glow: glow, ray: ray
  };

  var KK = NEU.engineKinds;
  if (!KK) return;

  function roomOf(d) {
    if (d && d.room && d.room.grid) return d.room;
    return (d && d.api && d.api.room) || null;
  }
  function bakeRoom(room) {
    var hit = paints[room.id];
    if (hit) return hit;
    var cv = mk(room.w * T, room.h * T);
    var g = cv.getContext && cv.getContext('2d');
    paints[room.id] = cv;
    if (!g) return cv;
    try { g.imageSmoothingEnabled = false; } catch (e1) {}
    var y, x, row, ch, up;
    for (y = 0; y < room.h; y += 2) {
      for (x = 0; x < room.w; x += 2) deckPlate(g, x * T, y * T, ((x >> 1) + (y >> 1) * 3) | 0);
    }
    for (y = 0; y < room.h; y++) {
      row = room.grid[y] || '';
      for (x = 0; x < row.length; x++) {
        ch = row.charAt(x);
        if (ch === '#') {
          up = (room.grid[y + 1] || '').charAt(x);
          wallTile(g, x, y, x, y, up === '.' || up === ',' || up === '=');
        } else if (ch === '=') stripes(g, x * T, y * T, T, T);
        else if (ch === ',') {
          px(g, x * T, y * T, T, T, '#12383C');
          px(g, x * T, y * T, T, 1, '#1A4A50');
          px(g, x * T, y * T + 8, T, 1, '#0E2C30');
          px(g, x * T + 7, y * T, 1, T, '#0E2C30');
        } else if (ch !== '.') px(g, x * T, y * T, T, T, '#FF00FF');
      }
    }
    px(g, 0, 0, 1, 1, '#FF00FF');
    return cv;
  }

  KK.kind('exofloor', {
    interactive: function () { return false; },
    floor: true,
    draw: function (g, e, d) {
      var room = roomOf(d);
      if (!room || !room.grid) return;
      var cv = bakeRoom(room);
      var S = d.S || 1;
      var sm = g.imageSmoothingEnabled;
      try { g.imageSmoothingEnabled = false; } catch (e2) {}
      g.drawImage(cv, d.sx - (e.x + 0.5) * T * S, d.sy - (e.y + 1) * T * S, cv.width * S, cv.height * S);
      g.imageSmoothingEnabled = sm;
    }
  });

  KK.kind('exoprop', {
    interactive: function () { return false; },
    width: function () { return 16; },
    draw: function (g, e, d) {
      var x = d.sx, y = d.sy, face = e.face || 4;
      try { g.imageSmoothingEnabled = false; } catch (e3) {}
      if (e.v === 'holo') holo(g, x - 5, y - 14);
      else if (e.v === 'eye') eye(g, x - 3, y - 8, eyeOn(e.t || 0));
      else if (e.v === 'chair' || e.v === 'draedon') draedon(g, x, y + 2, face, 1);
      else if (e.v === 'rack') rack(g, x - 8, y - 32, e.t || 0);
      else if (e.v === 'tank') tank(g, x - 12, y - 40, e.t || 0);
      else px(g, x - 8, y - 16, 16, 16, '#FF00FF');
    }
  });
})();
