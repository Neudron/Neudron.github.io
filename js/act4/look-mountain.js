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

  /* ── mtest_reference only: "Shattered Meridian" ──────────────────────────
     An ice observatory torn open onto a star-lit abyss. One thin irregular
     broken rim half-swallowed by a jagged ridge; cold slab facets and stone
     remnants frame an open corridor; amber lives only at the exit. Everything
     is baked at viewport size and drawn screen-relative, so it survives any
     room dimensions/path the gameplay pass chooses. */
  var BW = 768, BH = 416;            /* baked vista exceeds the largest view area (642x362) */
  var RCX = 454, RCY = 122, RR = 116; /* occultation rim: offset, irregular, never concentric */
  var TW = [[120, 70], [330, 54], [600, 92]];
  var REF_ICE = { ink: '#08161F', dark: '#2E5A6C', mid: '#BFE6F0', light: '#EAF8FF', tip: '#FFFFFF' };
  function isRef(level) { return !!(level && level.id === 'mtest_reference'); }

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

  /* flat polygon + soft radial light, both baked once */
  function poly(g, pts, col) {
    var i;
    g.fillStyle = col; g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath(); g.fill();
  }
  function refGlow(g, x, y, r, hex, a) {
    var gr, h, p;
    if (!g.createRadialGradient) return;
    h = hex.charAt(0) === '#' ? hex.substr(1) : hex;
    p = parseInt(h.substr(0, 2), 16) + ',' + parseInt(h.substr(2, 2), 16) + ',' + parseInt(h.substr(4, 2), 16);
    gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(' + p + ',1)');
    gr.addColorStop(1, 'rgba(' + p + ',0)');
    g.globalAlpha = a; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.globalAlpha = 1;
  }

  /* The torn aperture: one thin broken rim, radius warped by angle, chunked
     into pixel steps and interrupted by gaps. Never a set of concentric bands. */
  function paintRim(g) {
    var x, y, dx, dy, d, ang, rr, th, seg, i, px, py;
    for (y = RCY - RR - 26; y <= RCY + RR + 26; y += 2) {
      for (x = RCX - RR - 26; x <= RCX + RR + 26; x += 2) {
        dx = x - RCX; dy = y - RCY; d = Math.sqrt(dx * dx + dy * dy);
        if (d < RR - 30 || d > RR + 30) continue;
        ang = Math.atan2(dy, dx);
        rr = RR + 9 * Math.sin(ang * 3 + 0.6) + 6 * Math.sin(ang * 5 - 1.1) + (hs(x >> 2, y >> 2, 91) - 0.5) * 7;
        th = 3 + ((hs(x >> 3, y >> 3, 92) * 3) | 0);
        if (Math.abs(d - rr) > th) continue;
        seg = ((((ang + Math.PI) / (2 * Math.PI)) * 9) | 0);
        if (hs(seg, 0, 93) < 0.24) continue;
        F(g, d < rr ? '#EAF8FF' : (d < rr + 2 ? '#9FE8FF' : '#5E86B8'), x, y, 2, 2);
      }
    }
    for (i = 0; i < 10; i++) {
      ang = -Math.PI + (i / 10) * Math.PI * 2;
      rr = RR + 9 * Math.sin(ang * 3 + 0.6) + 6 * Math.sin(ang * 5 - 1.1);
      px = Math.round(RCX + Math.cos(ang) * rr); py = Math.round(RCY + Math.sin(ang) * rr);
      if (hs(i, 0, 94) < 0.5) F(g, '#FFFFFF', px, py, 2, 2);
    }
  }

  /* Two jagged horizons, drawn after the rim so they occlude its lower arc. */
  function paintFarRidges(g) {
    var far = [[60, 150, 46], [230, 170, 62], [420, 140, 40], [600, 160, 54], [760, 150, 44]];
    var main = [[40, 120, 34], [190, 150, 72], [340, 110, 44], [500, 160, 84], [660, 130, 52], [780, 120, 40]];
    var spire = [[118, 214], [318, 232], [566, 206], [706, 226]];
    var x, y, k, d, hh, h, top, prev = 0, s;
    for (x = 0; x < BW; x += 2) {
      h = 0;
      for (k = 0; k < far.length; k++) { d = Math.abs(x - far[k][0]); if (d > far[k][1]) continue; hh = far[k][2] * (1 - d / far[k][1]); if (hh > h) h = hh; }
      top = 246 - Math.round(h / 4) * 4;
      F(g, '#121E34', x, top, 2, BH - top); F(g, '#223450', x, top, 2, Math.min(8, h));
    }
    prev = 0;
    for (x = 0; x < BW; x += 2) {
      h = 0;
      for (k = 0; k < main.length; k++) { d = Math.abs(x - main[k][0]); if (d > main[k][1]) continue; hh = main[k][2] * (1 - d / main[k][1]); if (hh > h) h = hh; }
      h = Math.max(6, Math.round((h + ((hs(x >> 3, 0, 95) * 10) | 0) - 4) / 2) * 2);
      top = 296 - h;
      F(g, '#0B1526', x, top, 2, BH - top);
      if (h > prev) { F(g, '#3A5C74', x, top, 2, 3); F(g, '#6E9BB0', x, top, 2, 1); }
      else F(g, '#1A2B40', x, top, 2, 3);
      if (h > 70 && hs(x >> 2, 1, 96) < 0.35) { s = 2 + ((hs(x >> 1, 2, 97) * 4) | 0); F(g, '#9FC4D4', x, top, 2, s); F(g, '#D6EAF2', x, top, 2, 1); }
      prev = h;
    }
    for (k = 0; k < spire.length; k++) {
      x = spire[k][0]; y = spire[k][1];
      poly(g, [x - 6, 296, x, y, x + 7, 296], '#0A1322');
      poly(g, [x, y, x + 2, y + 9, x - 2, y + 9], '#4A7186');
      F(g, '#A8D0DE', x, y, 1, 6);
    }
  }

  /* Deepest layer: abyss, sparse stars, the broken rim, distant ridges. */
  function refDeep() {
    var o = canvasOf(BW, BH), g = o.g;
    var sky = ['#05060D', '#070915', '#0A0E1E', '#0D1326', '#10192E', '#0D162A', '#0A1222', '#070C18'];
    var k, x, i, sx, sy, band = 52;
    for (k = 0; k < 8; k++) F(g, sky[k], 0, k * band, BW, band + 1);
    for (k = 1; k < 8; k++) for (x = 0; x < BW; x += 2) {
      F(g, sky[k - 1], x + (k & 1), k * band, 1, 1);
      F(g, sky[k], x + (k & 1), k * band - 1, 1, 1);
      F(g, sky[k], x + ((k + 1) & 1), k * band + 1, 1, 1);
      F(g, sky[k - 1], x + ((k + 1) & 1), k * band - 2, 1, 1);
    }
    refGlow(g, 250, 150, 190, '#1B1B3A', 0.30);
    refGlow(g, 560, 96, 160, '#0E2E38', 0.26);
    refGlow(g, 430, 300, 210, '#10263A', 0.30);
    for (i = 0; i < 86; i++) {
      sx = (hs(i, 1, 71) * BW) | 0; sy = (hs(i, 2, 72) * (BH * 0.78)) | 0;
      if (i % 11 === 0) {
        F(g, '#FFFFFF', sx, sy, 2, 2);
        F(g, '#DCEBFF', sx - 1, sy, 1, 1); F(g, '#DCEBFF', sx + 2, sy, 1, 1);
        F(g, '#DCEBFF', sx, sy - 1, 1, 1); F(g, '#DCEBFF', sx, sy + 2, 1, 1);
      } else F(g, i % 3 ? '#6E82AE' : '#B9CFF0', sx, sy, 1, 1);
    }
    for (i = 0; i < 40; i++) {
      sx = (120 + hs(i, 3, 73) * 430) | 0; sy = (60 + hs(i, 4, 74) * 150 + hs(i, 5, 75) * 40) | 0;
      F(g, i % 4 ? '#7E93BE' : '#CFE2FF', sx, sy, 1, 1);
    }
    refGlow(g, RCX, RCY, RR + 44, '#4E7EC0', 0.15);
    refGlow(g, RCX, RCY, RR + 16, '#9FE8FF', 0.11);
    paintRim(g);
    paintFarRidges(g);
    return o.cv;
  }

  /* Mid depth: shattered observatory masonry, floating debris, cold bounce. */
  function refStruct() {
    var o = canvasOf(BW, BH), g = o.g, x, y, k;
    poly(g, [300, 96, 372, 88, 380, 100, 306, 110], '#1B2A3C');
    poly(g, [300, 96, 372, 88, 374, 92, 302, 100], '#46617C');
    F(g, '#7FB6C6', 302, 100, 70, 1);
    for (x = 312; x < 374; x += 14) F(g, '#0C1524', x, 100, 1, 8);
    poly(g, [498, 80, 540, 72, 546, 84, 520, 92, 504, 90], '#1B2A3C');
    poly(g, [498, 80, 540, 72, 542, 76, 500, 84], '#46617C');
    /* left leaning tower stub */
    poly(g, [34, 300, 40, 176, 92, 168, 104, 300], '#141F30');
    poly(g, [40, 176, 52, 160, 60, 174, 72, 152, 82, 170, 92, 168], '#141F30');
    poly(g, [40, 176, 92, 168, 90, 180, 42, 188], '#3A546E');
    F(g, '#070E1A', 60, 206, 6, 22); F(g, '#2E7E88', 62, 209, 2, 15); F(g, '#6FE0D8', 63, 211, 1, 10);
    for (y = 200; y < 296; y += 16) { F(g, '#0B1422', 40, y, 64, 1); F(g, '#22344A', 40, y + 1, 64, 1); }
    F(g, '#1E5A64', 96, 232, 8, 64); F(g, '#2E8C92', 100, 250, 4, 46);
    /* right buttress with a broken arch springing toward the corridor */
    poly(g, [700, 300, 690, 150, 730, 142, 752, 300], '#141F30');
    poly(g, [690, 150, 730, 142, 728, 154, 692, 162], '#3A546E');
    poly(g, [700, 158, 654, 150, 650, 162, 702, 172], '#182538');
    poly(g, [700, 158, 654, 150, 656, 154, 700, 162], '#46617C');
    for (k = 0; k < 4; k++) F(g, '#9FC4D4', 652 + k * 5, 162, 1, 5 + (k % 2) * 4);
    F(g, '#1E5A64', 690, 236, 7, 60); F(g, '#2E8C92', 692, 252, 4, 42);
    /* dangling chain + drifting chunks silhouetted against the rim */
    for (k = 0; k < 8; k++) F(g, '#2E4258', 372, 112 + k * 5, 2, 3);
    F(g, '#4E6E86', 371, 150, 4, 3);
    poly(g, [404, 150, 418, 144, 424, 154, 412, 160], '#16243A');
    poly(g, [404, 150, 418, 144, 419, 148, 406, 154], '#46617C');
    poly(g, [452, 178, 462, 172, 468, 180, 458, 186], '#16243A');
    poly(g, [452, 178, 462, 172, 463, 175, 454, 181], '#3E5E74');
    return o.cv;
  }

  /* Near depth: asymmetric cold-slab cliffs, icicles and cyan bounce. The
     middle stays empty so the real route stays legible at any viewport size. */
  function refFrame() {
    var o = canvasOf(BW, BH), g = o.g, k, x;
    poly(g, [0, BH, 0, 52, 30, 40, 62, 64, 88, 54, 104, 96, 84, 134, 98, 176, 72, 220, 82, 266, 54, 306, 64, 356, 36, BH], '#0A1522');
    poly(g, [0, 52, 30, 40, 62, 64, 40, 92, 0, 104], '#3E7184');
    poly(g, [30, 40, 62, 64, 88, 54, 104, 96, 70, 108, 40, 92], '#8FCAD8');
    poly(g, [62, 64, 88, 54, 104, 96, 84, 134, 70, 108], '#BFE6F0');
    poly(g, [0, 104, 40, 92, 70, 108, 50, 160, 0, 176], '#2E5A6C');
    poly(g, [70, 108, 84, 134, 98, 176, 72, 220, 50, 160], '#5E9BAB');
    poly(g, [84, 134, 98, 176, 72, 220, 60, 182], '#BFE6F0');
    poly(g, [0, 176, 50, 160, 72, 220, 40, 262, 0, 280], '#1E3E50');
    poly(g, [72, 220, 82, 266, 54, 306, 40, 262], '#3E7184');
    poly(g, [0, 280, 40, 262, 54, 306, 30, 350, 0, 366], '#2E5A6C');
    poly(g, [54, 306, 64, 356, 36, BH, 20, 352], '#3E7184');
    F(g, '#EAF8FF', 30, 40, 32, 1); F(g, '#EAF8FF', 88, 54, 16, 1);
    F(g, '#123044', 40, 92, 1, 30); F(g, '#123044', 72, 220, 1, 28);
    for (k = 0; k < 5; k++) { x = 8 + k * 14; F(g, '#CFEAF2', x, 104 + (k % 2) * 6, 1, 8 + (k % 3) * 5); F(g, '#8FCAD8', x + 1, 104 + (k % 2) * 6, 1, 5); }
    /* right cliff: narrower, more slate than ice */
    poly(g, [BW, 84, BW - 40, 70, BW - 64, 96, BW - 30, 124, BW, 138], '#5E9BAB');
    poly(g, [BW - 64, 96, BW - 52, 140, BW - 72, 180, BW - 30, 124], '#3E7184');
    poly(g, [BW, 138, BW - 30, 124, BW - 72, 180, BW - 40, 214, BW, 226], '#2E5A6C');
    poly(g, [BW - 72, 180, BW - 58, 226, BW - 76, 268, BW - 40, 214], '#3E7184');
    poly(g, [BW, 226, BW - 40, 214, BW - 76, 268, BW - 48, 310, BW, 326], '#1E3E50');
    poly(g, [BW - 76, 268, BW - 54, 312, BW - 66, 360, BW - 40, 300], '#3E7184');
    poly(g, [BW, 326, BW - 48, 310, BW - 66, 360, BW - 40, BH, BW, BH], '#2E5A6C');
    F(g, '#CFEAF2', BW - 40, 70, 40, 1);
    for (k = 0; k < 4; k++) { x = BW - 22 - k * 12; F(g, '#CFEAF2', x, 140 + (k % 2) * 5, 1, 7 + (k % 3) * 4); }
    /* colored bounce light: cyan welling up from the abyss and cliff bases */
    for (k = 0; k < 5; k++) { g.globalAlpha = 0.03 + k * 0.012; F(g, '#3FD8E0', 0, BH - 8 - k * 12, BW, 12); }
    g.globalAlpha = 1;
    refGlow(g, 92, 190, 70, '#3FD8E0', 0.12);
    refGlow(g, 60, 310, 80, '#3FD8E0', 0.10);
    refGlow(g, BW - 70, 200, 70, '#3FD8E0', 0.10);
    refGlow(g, BW - 60, 320, 80, '#3FD8E0', 0.09);
    return o.cv;
  }
  /* Amber astrolabe: the only warm light in the room, found at the exit. */
  function refFinish() {
    var o = canvasOf(24, 42), g = o.g;
    refGlow(g, 12, 26, 20, '#FFB45A', 0.34);
    poly(g, [4, 42, 6, 12, 18, 12, 20, 42], '#101A2A');
    poly(g, [6, 12, 18, 12, 16, 8, 8, 8], '#2E4058');
    F(g, '#5A4A2E', 10, 8, 4, 10);
    poly(g, [7, 18, 12, 12, 17, 18, 12, 26], '#C85A18');
    poly(g, [9, 18, 12, 14, 15, 18, 12, 23], '#FFB45A');
    F(g, '#FFE0A0', 11, 16, 2, 4);
    F(g, '#0B1422', 6, 12, 12, 2); F(g, '#EAF8FF', 8, 11, 8, 1);
    return o.cv;
  }
  function refExit(level) {
    var es = level && level.entities, i, e;
    if (!es) return null;
    for (i = 0; i < es.length; i++) { e = es[i]; if (e && e.t === 'exit') return e; }
    return null;
  }
  /* Flatten the three depth layers into one viewport-sized canvas. Scaling is
     non-uniform by design: a slightly oval torn rim reads more irregular, and
     the whole composition stays visible on any view size (the raw 768x416 bake
     would push the right cliff off a 640-wide view). Cached per view size. */
  function refScene(w, h) {
    var key = 'refScene:' + w + 'x' + h, o, g;
    if (cache[key]) return cache[key];
    o = canvasOf(w, h); g = o.g;
    g.save(); g.setTransform(w / 768, 0, 0, h / 416, 0, 0);
    g.drawImage(layer('refDeep', refDeep), 0, 0);
    g.drawImage(layer('refStruct', refStruct), 0, 0);
    g.drawImage(layer('refFrame', refFrame), 0, 0);
    g.restore();
    cache[key] = o.cv;
    return o.cv;
  }
  /* Vista is baked at viewport size and pinned to the view; no world constants,
     so any new room dimensions/path still get the same composed picture. The
     single amber marker tracks the exit entity in world space. */
  function refBackdrop(c, camX, camY, level, now, a) {
    var vw = a.x1 - a.x0 + 8, vh = a.y1 - a.y0 + 8;
    var ox = (a.x0 - 4) | 0, oy = (a.y0 - 4) | 0, ex = refExit(level), k, sx, sy;
    c.drawImage(refScene(vw, vh), ox, oy);
    if (!reducedNow()) for (k = 0; k < TW.length; k++) if ((((now / 900) | 0) % 6) === k) {
      F(c, '#FFFFFF', ((TW[k][0] / 768) * vw + a.x0) | 0, ((TW[k][1] / 416) * vh + a.y0) | 0, 2, 2);
    }
    if (ex) {
      sx = ex.x * 16 + 8 - camX; sy = ex.y * 16 - camY;
      if (sx > a.x0 - 64 && sx < a.x1 + 64) {
        P.glow(c, sx, sy - 12, 42, '#FFB45A', reducedNow() ? 0.16 : 0.20);
        c.drawImage(layer('refFinish', refFinish), (sx - 12) | 0, (sy - 42) | 0);
      }
    }
  }

  function backdrop(c, camX, camY, level, now, a) {
    if (isRef(level)) return refBackdrop(c, camX, camY, level, now, a);
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
  function mine(level) { return level && level.tileset === 'mountain' && /^m(?:\d|test_)/.test(level.id); }
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
  /* A tuft marks a secret climb. It is never a hole: the ground stays solid
     under it, so the eye reads "look up" rather than "danger". */
  function grassTuft(g, px, py) {
    F(g, '#1A2832', px + 2, py + 13, 12, 2);
    F(g, '#4A7A66', px + 4, py + 8, 1, 6); F(g, '#4A7A66', px + 8, py + 6, 1, 8); F(g, '#4A7A66', px + 12, py + 9, 1, 5);
    F(g, '#6D9A78', px + 3, py + 8, 1, 3); F(g, '#6D9A78', px + 7, py + 5, 1, 4); F(g, '#6D9A78', px + 11, py + 8, 1, 3);
    F(g, '#D7E4EA', px + 2, py + 12, 3, 1); F(g, '#D7E4EA', px + 11, py + 12, 3, 1);
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
  /* Cold one-way slab for the observatory room: bright top, ice-blue body,
     cyan bounce underneath. Plain mountain rooms keep the wooden plank. */
  function refPlatform(g, px, py) {
    F(g, '#F4FCFF', px, py, 16, 1); F(g, '#BFE6F0', px, py + 1, 16, 2);
    F(g, '#5E9BAB', px, py + 3, 16, 3); F(g, '#2E5A6C', px, py + 6, 16, 1);
    F(g, '#8FCAD8', px + 2, py + 4, 1, 2); F(g, '#8FCAD8', px + 12, py + 4, 1, 2);
    F(g, '#3FD8E0', px, py + 7, 16, 1);
    g.globalAlpha = 0.14; F(g, '#3FD8E0', px, py + 8, 16, 4); g.globalAlpha = 1;
  }
  function paintTiles(g, level) {
    var y, x, row, ch, px, py, ref = isRef(level);
    for (y = 0; y < level.h; y++) {
      row = level.grid[y] || '';
      for (x = 0; x < level.w; x++) {
        ch = x < row.length ? row.charAt(x) : '.';
        px = x * 16; py = y * 16;
        if (ch === '.' || ch === ' ') continue;
        if (ch === '#') granite(g, level, x, y);
        else if (ch === 'x') crackedBlock(g, px, py);
        else if (ch === '=') { if (ref) refPlatform(g, px, py); else plank(g, level, px, py); }
        else if (ch === '^' || ch === 'v' || ch === '<' || ch === '>') P.spike(g, px, py, ch, ref ? REF_ICE : ICE);
        else if (ch === 'l') lantern(g, px, py);
        else if (ch === 'f') flagPole(g, px, py);
        else if (ch === '`') grassTuft(g, px, py);
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
      /* Same deterministic physical gust that pushes the airborne hero; ambient drift remains visible while calm. */
      f.x += ((8 + (n % 3) * 6) + (P.wind ? P.wind().x * 0.45 : 0)) * sec;
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
