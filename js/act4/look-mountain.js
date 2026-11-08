/* look-mountain.js — the mountain: layered sky, ranges, clouds, pines, granite tiles, snow (vz-plat).
   Every layer is baked once into a canvas. Per frame: 8 sky fills, a handful of drawImage calls, the stars and the flakes. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var P = NEU.plat;
  if (!P || !P._kinds || !P.spr) return;
  var EX = 160, INK = '#12081E';
  var SKY = ['#0E1B2A', '#13263A', '#1B3A4B', '#24506A', '#3D6E8C', '#5A8AA4', '#87A8B8', '#B8CCD6'];
  var STARS = [[22, 14], [64, 40], [110, 20], [160, 62], [214, 12], [262, 48], [318, 26], [372, 70], [430, 18], [486, 52], [548, 30], [600, 66]];
  var CLOUDS = [
    [[80, 150, 26, 8], [108, 144, 22, 9], [136, 152, 24, 7]],
    [[280, 112, 30, 9], [312, 104, 24, 10], [344, 114, 26, 8]],
    [[480, 168, 24, 7], [506, 162, 20, 8], [532, 170, 22, 6]]
  ];
  var ICE = { ink: '#1A2832', dark: '#8AA0AA', mid: '#D7E4EA', light: '#F4F8FA', tip: '#FFFFFF' };
  var flakes = [], cache = {}, i;
  for (i = 0; i < 28; i++) flakes.push({ x: (i * 53) % 768, y: (i * 37) % 320, v: 18 + (i % 5) * 8 });

  function reducedNow() { return P.reduced(); }
  function hs(x, y, z) { return P.hash(x, y, z); }
  function vnoise(x, period, spacing, seed) {
    var n = period / spacing, k = Math.floor(x / spacing), f = x / spacing - k, a = hs(k % n, 0, seed), b = hs((k + 1) % n, 0, seed);
    f = f * f * (3 - 2 * f);
    return a + (b - a) * f;
  }
  function canvasOf(w, h) {
    var cv = P.mk(w, h), g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    return { cv: cv, g: g };
  }
  function F(g, col, x, y, w, h) { if (w > 0 && h > 0) { g.fillStyle = col; g.fillRect(x, y, w, h); } }

  /* ── baked layers ─────────────────────────────────────────────────── */
  function seams() {
    var o = canvasOf(640, 360), g = o.g, k, x, y;
    for (k = 1; k < 8; k++) {
      y = k * 45;
      for (x = 0; x < 640; x += 2) {
        F(g, SKY[k - 1], x + (k & 1), y, 1, 1);
        F(g, SKY[k], x + (k & 1), y - 1, 1, 1);
        F(g, SKY[k], x + ((k + 1) & 1), y + 1, 1, 1);
        F(g, SKY[k - 1], x + ((k + 1) & 1), y - 2, 1, 1);
      }
    }
    return o.cv;
  }
  function farRange() {
    var o = canvasOf(640, 360 + EX), g = o.g, x, h, prev = 0, top, snow, base = 210, lit;
    for (x = 0; x < 640; x += 2) {
      h = 34 + 54 * vnoise(x, 640, 80, 1) + 18 * vnoise(x, 640, 20, 2);
      h = Math.round(h / 2) * 2; top = base - h;
      F(g, '#2A4258', x, top, 2, 360 + EX - top);
      lit = h > prev;
      F(g, lit ? '#3A5670' : '#233A4E', x, top, 2, 12);
      if (h > 74) {
        snow = Math.min(10, 4 + ((h - 74) >> 1));
        F(g, '#E6EEF2', x, top, 2, snow); F(g, '#B8CCD6', x, top + snow, 2, 1);
        if (lit) F(g, '#FFFFFF', x, top, 2, 1);
      }
      prev = h;
    }
    return o.cv;
  }
  function midRange() {
    var PERIOD = 960, C = [170, 480, 800], HW = [210, 240, 220], HT = [150, 188, 164], base = 262;
    var o = canvasOf(PERIOD, 360 + EX), g = o.g, x, k, d, h, hh, top, left, depth, lim, jag, snowEnd, outs = [];
    for (x = 0; x < PERIOD; x += 2) {
      h = 0; left = false; hh = 0;
      for (k = 0; k < 3; k++) {
        d = Math.abs(x - C[k]); if (d > PERIOD / 2) d = PERIOD - d;
        hh = HT[k] * Math.max(0, 1 - d / HW[k]);
        hh += hh > 0 ? 10 * vnoise(x, PERIOD, 24, 7 + k) : 0;
        if (hh > h) { h = hh; left = ((x - C[k] + PERIOD) % PERIOD) > PERIOD / 2; }
      }
      h = Math.round(h / 2) * 2; if (h <= 0) continue;
      top = base - h;
      F(g, '#1A2832', x, top, 2, 360 + EX - top);
      depth = hs(x >> 3, 0, 11) < 0.3 ? 4 : 18;
      if (left) F(g, '#314858', x, top, 2, depth);
      else F(g, '#10181F', x, top, 2, depth + 4);
      lim = base - HT[1] * 0.6;
      jag = ((hs(x >> 2, 0, 12) * 4) | 0) * 2;
      snowEnd = lim + jag;
      if (top < snowEnd) {
        F(g, left ? '#EEF3F6' : '#D5DEE4', x, top, 2, snowEnd - top - 3);
        F(g, left ? '#D5DEE4' : '#B8CCD6', x, snowEnd - 3, 2, 3);
        if (left && top < snowEnd - 6) F(g, '#FFFFFF', x, top, 2, 1);
      } else if (hs(x >> 1, 3, 13) < 0.02) outs.push(x, top);
    }
    for (k = 0; k < outs.length; k += 2) { F(g, '#10181F', outs[k], outs[k + 1] + 8, 4, 3); F(g, '#314858', outs[k], outs[k + 1] + 8, 4, 1); }
    return o.cv;
  }
  function clouds() {
    var o = canvasOf(640, 220), g = o.g, k, j, b;
    function pass(dy, shrink, col) {
      for (k = 0; k < CLOUDS.length; k++) for (j = 0; j < CLOUDS[k].length; j++) {
        b = CLOUDS[k][j];
        P.ell(g, 0, 0, b[0], b[1] + dy, b[2] - shrink, b[3] - shrink, col);
      }
    }
    pass(3, 0, '#87A8B8'); pass(0, 1, '#B8CCD6'); pass(-3, 4, '#E6EEF2');
    return o.cv;
  }
  function pines() {
    var o = canvasOf(640, 360 + EX), g = o.g, x, h, k, hw, y, base = 252, n;
    for (x = 0; x < 640; x += 2) {
      h = 6 + Math.round(vnoise(x, 640, 40, 21) * 8);
      F(g, '#0E1820', x, base - h + 12, 2, 360 + EX - base);
    }
    for (n = 0; n < 24; n++) {
      x = Math.round(n * 26.7 + hs(n, 1, 22) * 12 + 4); h = 42 + ((hs(n, 2, 23) * 18) | 0);
      y = base - h + 8;
      F(g, '#0A1218', x - 1, base + 4, 2, 6);
      for (k = 0; k < 5; k++) {
        hw = 2 + k * 3 + (k > 0 ? 1 : 0);
        F(g, '#0E1820', x - hw + 2, y + k * (h / 5 | 0) + 0, hw * 2 - 4, 1);
        F(g, '#0E1820', x - hw + 1, y + k * (h / 5 | 0) + 1, hw * 2 - 2, 1);
        F(g, '#0E1820', x - hw, y + k * (h / 5 | 0) + 2, hw * 2, (h / 5 | 0) + 2);
        F(g, '#1A2832', x - hw, y + k * (h / 5 | 0) + 2, 2, (h / 5 | 0) + 1);
        F(g, '#E6EEF2', x - hw, y + k * (h / 5 | 0) + 2, 2, 1);
        F(g, '#E6EEF2', x + hw - 2, y + k * (h / 5 | 0) + 2, 2, 1);
      }
      F(g, '#E6EEF2', x - 1, y - 1, 2, 2);
    }
    F(g, '#0A1218', 0, base + 40, 640, 40); F(g, '#070C10', 0, base + 80, 640, 360 + EX - base - 80);
    return o.cv;
  }
  function layer(name, fn) { return cache[name] || (cache[name] = fn()); }

  /* ── hooks ────────────────────────────────────────────────────────── */
  function drawLoop(c, cv, w, par, camX, a, y) {
    var x = -P.mod(camX * par, w) + Math.floor(a.x0 / w) * w - w;
    for (; x < a.x1; x += w) c.drawImage(cv, x | 0, y);
  }
  function highWisps() {
    var o = canvasOf(640, 80), g = o.g, k, j, b;
    var W = [[[60, 52, 22, 5], [84, 48, 18, 6]], [[300, 40, 24, 5], [326, 36, 18, 6]], [[520, 58, 20, 4], [542, 54, 16, 5]]];
    for (k = 0; k < W.length; k++) for (j = 0; j < W[k].length; j++) {
      b = W[k][j];
      P.ell(g, 0, 0, b[0], b[1], b[2], b[3], '#5A8AA4');
      P.ell(g, 0, 0, b[0], b[1] - 2, b[2] - 4, b[3] - 2, '#87A8B8');
    }
    return o.cv;
  }
  function backdrop(c, camX, camY, level, now, a) {
    var k, w = a.x1 - a.x0, dim = reducedNow() ? -1 : ((now / 700) | 0) % STARS.length, drift = reducedNow() ? 0 : now * 0.004;
    for (k = 0; k < 8; k++) {
      c.fillStyle = SKY[k];
      c.fillRect(a.x0, k === 0 ? a.y0 : k * 45, w, k === 0 ? 45 - a.y0 : k === 7 ? a.y1 - 315 : 45);
    }
    drawLoop(c, layer('seams', seams), 640, 0, 0, a, 0);
    for (k = 0; k < STARS.length; k++) P.fr(c, STARS[k][0], STARS[k][1], 1, 1, k === dim ? '#87A8B8' : '#E6EEF2');
    drawLoop(c, layer('wisps', highWisps), 640, 0.25, camX + drift, a, 0);
    drawLoop(c, layer('far', farRange), 640, 0.15, camX, a, 0);
    drawLoop(c, layer('mid', midRange), 960, 0.35, camX, a, 0);
    drawLoop(c, layer('clouds', clouds), 640, 0.5, camX + drift * 2, a, 0);
    drawLoop(c, layer('pines', pines), 640, 0.8, camX, a, 0);
  }
  function foreground(c, camX, camY, level, now, a) {
    var k, f, near, x, y;
    c.fillStyle = '#F4F7FA';
    for (k = 0; k < flakes.length; k++) {
      f = flakes[k]; near = k & 1;
      x = P.mod(f.x - camX * (near ? 1.2 : 0.6), 700) + a.x0 - 30;
      y = P.mod(f.y - camY * 0.15, 400) - 20;
      c.fillRect(x | 0, y | 0, near ? 2 : 1, near ? 2 : 1);
    }
  }
  function mine(level) { return level && level.tileset === 'mountain' && /^m\d/.test(level.id); }
  function chainHook(name, fn) {
    var prev = P[name];
    P[name] = function (c, camX, camY, level, now, a) {
      if (mine(level)) return fn(c, camX, camY, level, now, a);
      if (prev) return prev(c, camX, camY, level, now, a);
    };
  }
  chainHook('backdrop', backdrop); chainHook('foreground', foreground); chainHook('live', lamps);
  var prevSkin = P.skin;
  P.skin = function (level) {
    if (mine(level)) return { key: 'mtn', ink: INK, deep: '#2A3440', base: '#3E4C59', light: '#6D7B88', rim: '#9AAAB8' };
    return prevSkin ? prevSkin(level) : null;
  };

  /* ── tiles ────────────────────────────────────────────────────────── */
  function solid(level, x, y) {
    if (x < 0 || x >= level.w || y >= level.h) return true;
    if (y < 0) return false;
    var ch = (level.grid[y] || '').charAt(x);
    return ch === '#' || ch === 'x';
  }
  function granite(g, level, x, y) {
    var px = x * 16, py = y * 16, up = !solid(level, x, y - 1), left = !solid(level, x - 1, y), right = !solid(level, x + 1, y), down = !solid(level, x, y + 1);
    var inside = !(up || left || right || down), base = inside ? '#34414D' : '#3E4C59', k, o, w, yy, h;
    F(g, base, px, py, 16, 16);
    for (k = 0; k < 3; k++) {
      yy = 3 + k * 5 + ((hs(x, y * 3 + k, 31) * 3) | 0); o = (hs(x, y + k, 32) * 6) | 0; w = 6 + ((hs(x, y + k, 33) * 8) | 0);
      F(g, '#2A3440', px + o, py + yy, Math.min(w, 16 - o), 1);
      F(g, '#4E5C69', px + o + 1, py + yy + 1, Math.min(w - 2, 15 - o), 1);
    }
    if (hs(x, y, 34) < 0.5) { F(g, '#6D7B88', px + 3 + ((hs(x, y, 35) * 8) | 0), py + 6, 2, 1); }
    if (left) F(g, '#6D7B88', px, py, 1, 16);
    if (right) F(g, '#2A3440', px + 15, py, 1, 16);
    if (down) { F(g, '#34414D', px, py + 14, 16, 1); F(g, '#2A3440', px, py + 15, 16, 1); }
    if (up) {
      F(g, '#FFFFFF', px, py, 16, 1); F(g, '#E8EEF2', px, py + 1, 16, 2); F(g, '#B7C4CE', px, py + 3, 16, 1); F(g, '#9AAAB8', px, py + 4, 16, 1);
      for (k = 0; k < 16; k++) if (hs(px + k, py, 36) < 0.25) { h = 1 + ((hs(px + k, py, 37) * 3) | 0); F(g, '#E8EEF2', px + k, py + 4, 1, h); F(g, '#B7C4CE', px + k, py + 4 + h, 1, 1); }
    }
  }
  function crackedBlock(g, px, py) {
    F(g, INK, px, py, 16, 16); F(g, '#6A3E55', px + 1, py + 1, 14, 14);
    F(g, '#C48AA0', px + 1, py + 1, 14, 1); F(g, '#C48AA0', px + 1, py + 1, 1, 14);
    F(g, '#4A2A3C', px + 14, py + 2, 1, 13); F(g, '#4A2A3C', px + 2, py + 14, 13, 1);
    F(g, '#1A1218', px + 7, py + 2, 2, 5); F(g, '#1A1218', px + 5, py + 7, 3, 2); F(g, '#1A1218', px + 8, py + 8, 3, 2); F(g, '#1A1218', px + 6, py + 10, 2, 4); F(g, '#1A1218', px + 10, py + 10, 2, 3);
  }
  function plank(g, level, px, py) {
    F(g, '#FFFFFF', px, py, 16, 1); F(g, '#E8EEF2', px, py + 1, 16, 1);
    F(g, '#B08050', px, py + 2, 16, 1); F(g, '#8A6040', px, py + 3, 16, 3); F(g, '#5A3E28', px, py + 6, 16, 1);
    F(g, '#5A3E28', px + 5, py + 3, 1, 3); F(g, '#5A3E28', px + 11, py + 3, 1, 3);
    F(g, '#12081E', px + 2, py + 4, 1, 1); F(g, '#12081E', px + 13, py + 4, 1, 1);
    F(g, '#5A3E28', px + 1, py + 7, 2, 4); F(g, '#5A3E28', px + 13, py + 7, 2, 4); F(g, '#8A6040', px + 1, py + 7, 1, 4);
  }
  /* lamp post: a 3-tile iron post with a caged lantern, standing on the tile below; the flame, halo and light pool are live (lamps).
     t = the lantern's base line. Everything is cell-relative, so it paints above its own cell (the sky is empty there). */
  function lantern(g, px, py) {
    var t = py - 6, y;
    /* post, collar and plinth */
    F(g, INK, px + 6, t, 4, py + 13 - t); F(g, '#4A4A5A', px + 7, t, 2, py + 13 - t); F(g, '#8A8A9A', px + 7, t, 1, py + 13 - t); F(g, '#2A2A36', px + 8, t, 1, py + 13 - t);
    F(g, INK, px + 5, py + 4, 6, 3); F(g, '#5A5A6A', px + 6, py + 5, 4, 1); F(g, '#8A8A9A', px + 6, py + 4, 4, 1);
    F(g, INK, px + 3, py + 11, 10, 5); F(g, '#2A2A36', px + 4, py + 12, 8, 4); F(g, '#5A5A6A', px + 4, py + 12, 8, 1); F(g, '#8A8A9A', px + 4, py + 12, 3, 1);
    F(g, '#F4F8FA', px + 5, py + 11, 6, 1); F(g, '#E8EEF2', px + 4, py + 15, 8, 1);
    /* base plate, then the cage: amber glass in four stepped bands, iron bars over it */
    F(g, INK, px + 2, t - 2, 12, 3); F(g, '#5A5A6A', px + 3, t - 1, 10, 1); F(g, '#2A2A36', px + 3, t, 10, 1); F(g, '#8A8A9A', px + 3, t - 1, 4, 1);
    F(g, INK, px + 3, t - 18, 10, 16);
    F(g, '#7A2A10', px + 4, t - 17, 8, 14); F(g, '#C85A18', px + 4, t - 16, 8, 12);
    F(g, '#F8A030', px + 5, t - 15, 6, 10); F(g, '#FFD070', px + 6, t - 13, 4, 7); F(g, '#FFF2C4', px + 7, t - 11, 2, 4);
    F(g, '#2A2A36', px + 4, t - 17, 8, 1); F(g, '#2A2A36', px + 4, t - 4, 8, 1);
    F(g, '#3A3A48', px + 5, t - 17, 1, 14); F(g, '#3A3A48', px + 10, t - 17, 1, 14);
    /* peaked cap and finial */
    F(g, INK, px + 1, t - 20, 14, 3); F(g, '#3A3A48', px + 2, t - 19, 12, 1); F(g, '#8A8A9A', px + 2, t - 19, 5, 1); F(g, '#F4F8FA', px + 3, t - 20, 10, 1);
    F(g, INK, px + 3, t - 23, 10, 3); F(g, '#5A5A6A', px + 4, t - 22, 8, 1); F(g, '#F4F8FA', px + 4, t - 23, 8, 1);
    F(g, INK, px + 5, t - 26, 6, 3); F(g, '#3A3A48', px + 6, t - 25, 4, 1); F(g, '#F4F8FA', px + 6, t - 26, 4, 1);
    F(g, INK, px + 7, t - 29, 2, 3); F(g, '#C8A040', px + 7, t - 28, 2, 1);
    /* hanging icicles under the base plate catch the light */
    for (y = 0; y < 3; y++) F(g, '#E8EEF2', px + 3 + y * 4, t + 1, 1, 2 - (y & 1));
  }
  /* trail banner: baked pole, iron arm and finial; the cloth is live so it can flutter (flag) */
  function flagPole(g, px, py) {
    F(g, INK, px + 6, py - 36, 4, 52); F(g, '#4A4A5A', px + 7, py - 36, 2, 52); F(g, '#8A8A9A', px + 7, py - 36, 1, 52);
    F(g, INK, px + 5, py - 40, 6, 5); F(g, '#C8A040', px + 6, py - 39, 4, 3); F(g, '#FFE080', px + 6, py - 39, 2, 1);
    F(g, INK, px + 8, py - 34, 19, 3); F(g, '#8A6040', px + 9, py - 33, 17, 1); F(g, '#5C4030', px + 9, py - 32, 17, 1);
    F(g, INK, px + 3, py + 12, 10, 4); F(g, '#2A2A36', px + 4, py + 13, 8, 3); F(g, '#5A5A6A', px + 4, py + 13, 8, 1);
    F(g, '#F4F8FA', px + 5, py + 12, 6, 1); F(g, '#E8EEF2', px + 4, py + 15, 8, 1);
  }
  var HEIGHTS = [20, 20, 20, 19, 18, 17, 16, 15];
  var propCache = { id: null, lamps: [], flags: [] };
  function props(level) {
    var y, x, ch, row;
    if (propCache.id === level.id) return propCache;
    propCache = { id: level.id, lamps: [], flags: [] };
    for (y = 0; y < level.h; y++) {
      row = level.grid[y] || '';
      for (x = 0; x < level.w; x++) {
        ch = row.charAt(x);
        if (ch === 'l') propCache.lamps.push(x * 16 + 8, y * 16 - 14, y * 16 + 16);
        else if (ch === 'f') propCache.flags.push(x * 16, y * 16);
      }
    }
    return propCache;
  }
  /* the lit focal points: halo and snow light pool for each lamp, flickering core, fluttering banner cloth */
  function lamps(c, camX, camY, level, now, a) {
    var pr = props(level), i, k, sx, sy, fy, px, py, f, dy, h, still = reducedNow();
    f = still ? 0 : ((now / 130) | 0) % 3;
    for (i = 0; i < pr.lamps.length; i += 3) {
      sx = (pr.lamps[i] - camX) | 0; sy = (pr.lamps[i + 1] - camY) | 0; fy = (pr.lamps[i + 2] - camY) | 0;
      if (sx < a.x0 - 112 || sx > a.x1 + 112) continue;
      P.glow(c, sx, sy, 104, '#F8A030', 0.10);
      P.glow(c, sx, sy, 60, '#F8A030', 0.16);
      P.glow(c, sx, sy, 28, '#FFD070', 0.26);
      c.fillStyle = '#F8A030';
      c.globalAlpha = 0.14; c.fillRect(sx - 44, fy - 4, 88, 1); c.fillRect(sx - 56, fy - 1, 112, 1);
      c.globalAlpha = 0.22; c.fillRect(sx - 30, fy - 2, 60, 1); c.fillRect(sx - 18, fy - 3, 36, 1);
      c.globalAlpha = 1;
      c.fillStyle = '#FFF2C4'; c.fillRect(sx - 1, sy - 3 - (f & 1), 2, 4 + (f === 2 ? 1 : 0));
      c.fillStyle = '#FFFFFF'; c.fillRect(sx, sy - 1 - (f & 1), 1, 2);
    }
    for (i = 0; i < pr.flags.length; i += 2) {
      px = (pr.flags[i] - camX) | 0; py = (pr.flags[i + 1] - camY) | 0;
      if (px < a.x0 - 48 || px > a.x1 + 48) continue;
      for (k = 0; k < 8; k++) {
        dy = still ? 0 : Math.round(Math.sin(now / 240 + k * 0.9) * (0.4 + k * 0.28));
        h = HEIGHTS[k];
        c.fillStyle = '#7A1C38'; c.fillRect(px + 10 + k * 2, py - 31 + dy, 2, h);
        c.fillStyle = '#B8304C'; c.fillRect(px + 10 + k * 2, py - 30 + dy, 2, h - 2);
        c.fillStyle = '#E8607A'; c.fillRect(px + 10 + k * 2, py - 31 + dy, 2, 1);
        if (k === 3 || k === 4) { c.fillStyle = '#FFE080'; c.fillRect(px + 10 + k * 2, py - 25 + dy, 2, 3); c.fillRect(px + 10 + k * 2, py - 20 + dy, 2, 1); }
      }
    }
  }
  function paintTiles(g, level) {
    var y, x, row, ch, px, py;
    for (y = 0; y < level.h; y++) {
      row = level.grid[y] || '';
      for (x = 0; x < level.w; x++) {
        ch = x < row.length ? row.charAt(x) : '.';
        px = x * 16; py = y * 16;
        if (ch === '.' || ch === ' ') continue;
        if (ch === '#') granite(g, level, x, y);
        else if (ch === 'x') crackedBlock(g, px, py);
        else if (ch === '=') plank(g, level, px, py);
        else if (ch === '^' || ch === 'v' || ch === '<' || ch === '>') P.spike(g, px, py, ch, ICE);
        else if (ch === 'l') lantern(g, px, py);
        else if (ch === 'f') flagPole(g, px, py);
        else F(g, '#FF00FF', px, py, 16, 16);
      }
    }
  }
  P.painters.push(function (g, level) {
    if (!mine(level)) return false;
    paintTiles(g, level);
    return true;
  });

  function stepWind(dt) {
    var sec = typeof dt === 'number' ? dt : 0, n, f;
    if (sec > 2) sec = sec / 1000;
    if (sec > 0.05) sec = 0.05;
    if (reducedNow() || sec <= 0) return;
    for (n = 0; n < flakes.length; n++) {
      f = flakes[n];
      f.y += f.v * sec;
      f.x += (8 + (n % 3) * 6) * sec;
      if (f.y > 420) f.y = 0;
      if (f.x > 820) f.x = 0;
    }
  }

  /* m0 bakes right after boot, not on the first climb */
  setTimeout(function () { P.prebake('m0'); }, 0);

  NEU.mountainLook = {
    tileset: 'mountain',
    paint: function (level, g) {
      var cv, c = g;
      if (!c) { cv = P.mk(Math.max(1, level.w) * 16, Math.max(1, level.h) * 16); c = cv.getContext('2d'); }
      if (c) paintTiles(c, level);
    },
    parallax: backdrop,
    snow: foreground,
    stepWind: stepWind,
    flakes: flakes,
    sky: SKY
  };
})();
