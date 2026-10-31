/* look-city.js — the look of the city and of New Home (rooms-d.js).
   ───────────────────────────────────────────────────────────────────
   The rooms are data in rooms-d.js. This file is everything that makes
   them read as PLACES rather than tile grids, the same way summon.js
   dresses b8_arena:

     cityfloor   one per room, floor paint under everything: the whole
                 room — facades, pavements, the road, the canal, the
                 wallpaper, the floorboards, the moonlight — painted
                 once into an offscreen canvas at one pixel per world
                 unit and blitted scaled each frame (exactly how the
                 engine blits its own baked tile layer). The tile grid
                 underneath is collision and the no-art fallback only.
                 A handful of small animated overlays ride on top:
                 neon, puddle rings, steam, a clock, dust in the light.
     cityprop    everything that stands and sorts with the player:
                 street lamps, the stall (two halves, so the merchant
                 stands between his shelves and his counter), the bus
                 shelter, benches, the cat, bins, a dumpster, the dry
                 fountain, trees, the chalk circle, clocks, a coat
                 stand. Each one is baked ONCE into a 1x sprite and
                 blitted; only its few moving pixels are drawn live.
                 A prop with `run` or `lines` is pressable and talks
                 exactly like an npc (it borrows the npc kind's fire,
                 so line-resume and the textbox guard are the same).

   PERFORMANCE: nothing here allocates, builds a gradient or blurs per
   frame. Static art is baked once (scale-independent: the blit does
   the scaling, nearest-neighbour); per frame is one drawImage per room
   and per prop plus a few dozen integer fillRects.

   Reduced motion: every overlay holds its rest frame — the neon stays
   lit, nothing drips, swings, drifts or flickers.                     */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var KK = NEU.engineKinds;
  if (!KK) return;

  var T = 16, PAD = 40;

  function LK() { return NEU.engineLook; }
  function still() { var l = LK(); return !!(l && l.reduced); }
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function has(i) { return !!(NEU.save && NEU.save.has && NEU.save.has(i)); }
  function flagged(f) { return !!(NEU.save && NEU.save.flagged && NEU.save.flagged(f)); }

  /* ── the bake ──────────────────────────────────────────────────────
     key -> { c: canvas, w, h, ax, ay } at 1 px per world unit. `ax/ay`
     is the anchor: the feet point for a prop, world (0,0) for a room.
     A canvas-less environment (the jsdom harness) caches null and
     every draw becomes a no-op. */
  var cache = {};
  function painter(g, dx, dy) {
    function P(x, y, w, h, col) {
      g.fillStyle = col;
      g.fillRect(Math.round(x) + dx, Math.round(y) + dy, Math.round(w), Math.round(h));
    }
    P.a = function (a) { g.globalAlpha = a; };
    return P;
  }
  function bake(key, w, h, ax, ay, paint) {
    if (cache.hasOwnProperty(key)) return cache[key];
    var c = null, g = null;
    try {
      c = document.createElement('canvas');
      c.width = w; c.height = h;
      g = c.getContext && c.getContext('2d');
    } catch (err) { g = null; }
    if (!g) { cache[key] = null; return null; }
    paint(painter(g, ax, ay));
    g.globalAlpha = 1;
    cache[key] = { c: c, w: w, h: h, ax: ax, ay: ay };
    return cache[key];
  }
  /* sprites are painted in coordinates RELATIVE TO THEIR ANCHOR, so a
     lamp's foot is (0,0) and its head is at negative y */
  function blit(g, s, x, y, S) {
    if (!s) return;
    var sm = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = false;
    g.drawImage(s.c, Math.round(x - s.ax * S), Math.round(y - s.ay * S), s.w * S, s.h * S);
    g.imageSmoothingEnabled = sm;
  }

  /* per-frame world-unit rects, no closure per frame */
  var QG = null, QX = 0, QY = 0, QS = 3;
  function qset(g, ox, oy, S) { QG = g; QX = ox; QY = oy; QS = S; }
  function Q(x, y, w, h, col) {
    QG.fillStyle = col;
    QG.fillRect(QX + Math.round(x) * QS, QY + Math.round(y) * QS, Math.round(w) * QS, Math.round(h) * QS);
  }

  /* ── paint kit ───────────────────────────────────────────────────── */
  function fillEll(P, cx, cy, rx, ry, col) {
    for (var y = -ry; y <= ry; y++) {
      var k = 1 - (y * y) / ((ry + 0.5) * (ry + 0.5));
      if (k <= 0) continue;
      var hw = Math.round(rx * Math.sqrt(k));
      P(cx - hw, cy + y, hw * 2, 1, col);
    }
  }
  /* a stepped pool of light: three nested ellipses, each adding `a` */
  function pool(P, cx, cy, rx, ry, col, a) {
    P.a(a); fillEll(P, cx, cy, rx, ry, col);
    fillEll(P, cx, cy, Math.round(rx * 0.68), Math.round(ry * 0.68), col);
    fillEll(P, cx, cy, Math.round(rx * 0.38), Math.round(ry * 0.38), col);
    P.a(1);
  }
  function bricks(P, x, y, w, h, pal, seed) {
    P(x, y, w, h, pal.m);
    for (var r = 0; r * 4 < h; r++) {
      var off = (r & 1) ? 4 : 0;
      for (var c = -1; c * 8 < w; c++) {
        var bx = x + c * 8 + off, by = y + r * 4, bw = 7, bh = 3;
        var x0 = Math.max(bx, x), x1 = Math.min(bx + bw, x + w);
        var y1 = Math.min(by + bh, y + h);
        if (x1 <= x0 || y1 <= by) continue;
        var k = hash(seed + r * 131 + c * 17);
        P(x0, by, x1 - x0, y1 - by, k < 0.16 ? pal.d : k > 0.86 ? pal.l : pal.b);
        if (k > 0.86) P(x0, by, x1 - x0, 1, pal.l);
      }
    }
  }
  function cornice(P, x, y, w, col, hi, lo) {
    P(x, y, w, 4, col); P(x, y, w, 1, hi); P(x, y + 4, w, 2, lo);
    for (var i = 0; i < w; i += 6) P(x + i, y + 4, 3, 1, col);
  }
  /* a window: frame, glass, cross, sill. kind: dark | warm | low | tv | cool */
  function win(P, x, y, w, h, kind, seed) {
    var glass = { dark: '#0D0F1C', warm: '#D89A48', low: '#6A4630', tv: '#3A5E9A', cool: '#2E3A58' }[kind] || '#0D0F1C';
    P(x - 1, y - 1, w + 2, h + 2, '#07070C');
    P(x, y, w, h, glass);
    if (kind === 'warm') {
      P(x, y, w, 2, '#F2C070');
      P(x + 1, y + h - 3, w - 2, 2, '#B87A38');
      /* curtains, and sometimes someone's plant */
      P(x, y, 2, h, '#7A3A3A'); P(x + w - 2, y, 2, h, '#7A3A3A');
      if (hash(seed) > 0.5) { P(x + 3, y + h - 5, 3, 3, '#2A3A24'); P(x + 4, y + h - 7, 1, 2, '#3A5A30'); }
    } else if (kind === 'low') {
      P(x, y, w, 1, '#8A5A38');
    } else if (kind === 'dark') {
      P(x + 1, y + 1, 2, 1, '#2A2E44'); P(x + 1, y + 2, 1, 1, '#2A2E44');
    }
    P(x + (w >> 1), y, 1, h, '#07070C');
    P(x, y + (h >> 1), w, 1, '#07070C');
    P(x - 2, y + h + 1, w + 4, 2, '#3C3A4A'); P(x - 2, y + h + 1, w + 4, 1, '#55526A');
  }
  function slabs(P, x, y, w, h, seed) {
    P(x, y, w, h, '#232331');
    for (var j = 0; j < h; j += 16) for (var i = 0; i < w; i += 16) {
      var k = hash(seed + i * 3 + j * 7);
      var c = k < 0.2 ? '#1F1F2C' : k > 0.82 ? '#292938' : '#242433';
      P(x + i, y + j, 15, 15, c);
      P(x + i, y + j, 15, 1, '#2C2C3C');
      P(x + i + 15, y + j, 1, 16, '#16161F'); P(x + i, y + j + 15, 16, 1, '#16161F');
      if (k > 0.9) { P(x + i + 4, y + j + 6, 5, 1, '#16161F'); P(x + i + 8, y + j + 7, 3, 1, '#16161F'); }
      if (k < 0.07) { P(x + i + 9, y + j + 9, 2, 2, '#1A1A24'); }
    }
  }
  function asphalt(P, x, y, w, h, seed) {
    P(x, y, w, h, '#15141C');
    for (var j = 0; j < h; j += 2) for (var i = 0; i < w; i += 3) {
      var k = hash(seed + i * 13 + j * 101);
      if (k > 0.86) P(x + i, y + j, 1, 1, '#1E1D28');
      else if (k < 0.08) P(x + i, y + j, 1, 1, '#0F0E15');
    }
  }
  /* a puddle with a stepped rim and, optionally, a coloured reflection */
  function puddle(P, cx, cy, rx, ry, refl) {
    fillEll(P, cx, cy + 1, rx + 1, ry, '#0C0C14');
    fillEll(P, cx, cy, rx, ry, '#101830');
    fillEll(P, cx, cy, rx - 2, Math.max(1, ry - 1), '#0C1226');
    P(cx - rx + 3, cy - ry, rx, 1, '#2E3E62');
    if (refl) {
      P.a(0.35); P(cx - 2, cy - ry + 1, 4, ry * 2 - 1, refl);
      P.a(0.6); P(cx - 1, cy - ry + 1, 2, Math.max(1, ry * 2 - 2), refl);
      P.a(0.3); P(cx + 2, cy, 2, 1, refl); P(cx - 4, cy - 1, 2, 1, refl); P.a(1);
    }
  }
  /* a wet-road streak under a light: stepped dashes fading downward */
  function streak(P, x, y0, y1, col) {
    for (var y = y0; y < y1; y += 2) {
      var k = 1 - (y - y0) / (y1 - y0);
      if (hash(x * 7 + y) < 0.3) continue;
      P.a(0.05 + 0.13 * k);
      var hw = (hash(x + y * 3) * 3) | 0, sh = Math.round((hash(y + x) - 0.5) * 2);
      P(x - hw + sh, y, hw * 2 + 1, 1, col);
    }
    P.a(1);
  }

  /* ── city palettes ───────────────────────────────────────────────── */
  var PLUM = { m: '#120E17', b: '#2A1E2B', d: '#211824', l: '#352638' };
  var SLATE = { m: '#0E111C', b: '#1E2536', d: '#191F2E', l: '#28304A' };
  var UMBER = { m: '#140F0D', b: '#2C221E', d: '#241B18', l: '#382C26' };
  var SOOT = { m: '#0C0C12', b: '#1B1A24', d: '#16151E', l: '#24232F' };

  function sideWall(P, x, y, h, inner) {
    P(x, y, 16, h, '#100F17');
    for (var j = 0; j < h; j += 8) P(x + 2, y + j, 12, 1, '#16151F');
    P(inner > 0 ? x + 15 : x, y, 1, h, '#2C2A3A');
  }
  /* the near (south) wall seen from above: a stone parapet with a rail */
  function parapet(P, x, y, w) {
    P(x, y, w, 16, '#1A1924');
    for (var i = 0; i < w; i += 16) {
      P(x + i, y + 2, 15, 9, hash(i + 7) > 0.5 ? '#2E2C3A' : '#2A2836');
      P(x + i, y + 2, 15, 1, '#3E3C4E');
      P(x + i + 15, y + 2, 1, 9, '#141320');
    }
    P(x, y, w, 2, '#0E0D14');
    P(x, y + 11, w, 5, '#121119');
    for (i = 4; i < w; i += 8) { P(x + i, y - 3, 1, 5, '#0A0910'); P(x + i, y - 3, 1, 1, '#4A4858'); }
    P(x, y - 4, w, 1, '#0A0910'); P(x, y - 5, w, 1, '#3A3848');
  }

  /* ═══ D1 — the street with the stall ══════════════════════════════ */
  var D1_LAMPS = [[3, 4], [15, 4], [23, 4], [7, 10]];
  function paintD1(P) {
    var W = 416, i, x;
    /* rooftops into the dark above the room */
    bricks(P, 0, -12, 128, 60, PLUM, 11);
    cornice(P, 0, -12, 128, '#3A2C3A', '#544258', '#0C0910');
    P(18, -26, 10, 14, '#1A1420'); P(18, -26, 10, 2, '#3A2C3A'); P(20, -30, 2, 4, '#120E16');
    P(92, -22, 6, 10, '#1A1420'); P(91, -23, 8, 2, '#3A2C3A');
    bricks(P, 128, -4, 80, 52, SLATE, 23);
    cornice(P, 128, -4, 80, '#2C3448', '#46506A', '#0A0C14');
    bricks(P, 208, -16, 144, 64, UMBER, 37);
    cornice(P, 208, -16, 144, '#3A302A', '#56483E', '#0E0A08');
    /* a water tower on C's roof, black against the black */
    P(300, -38, 26, 16, '#0E0C10'); P(302, -40, 22, 2, '#1A1618'); P(304, -22, 2, 6, '#0E0C10'); P(318, -22, 2, 6, '#0E0C10');
    for (i = 0; i < 26; i += 4) P(300 + i, -36, 1, 12, '#16131A');
    bricks(P, 352, -26, 64, 74, SOOT, 53);
    cornice(P, 352, -26, 64, '#24232F', '#3A384A', '#08080C');
    P(398, -38, 1, 12, '#2A2836'); P(394, -34, 9, 1, '#2A2836'); P(396, -30, 5, 1, '#2A2836');
    /* party walls between the buildings */
    P(127, -12, 2, 60, '#0A080E'); P(207, -16, 2, 64, '#0A080E'); P(351, -26, 2, 74, '#08080C');

    /* A — upper windows; a rolled-down shutter; the painted-door wall */
    win(P, 10, 2, 14, 14, 'warm', 1); win(P, 38, 2, 14, 14, 'dark', 2);
    win(P, 66, 2, 14, 14, 'dark', 3); win(P, 96, 2, 14, 14, 'low', 4);
    P(12, 22, 70, 6, '#0C0A10'); P(13, 23, 68, 4, '#2A2230');
    for (i = 0; i < 9; i++) P(16 + i * 7, 24, 4, 2, i === 4 ? '#5A4A60' : '#3A3044');
    P(14, 28, 66, 20, '#0C0A10');
    for (i = 0; i < 18; i += 2) { P(15, 29 + i, 64, 1, '#34323F'); P(15, 30 + i, 64, 1, '#262532'); }
    /* graffiti on the shutter: a lilac heart, a teal scrawl */
    P.a(0.85);
    P(26, 34, 3, 2, '#B892FF'); P(31, 34, 3, 2, '#B892FF'); P(25, 36, 10, 2, '#B892FF'); P(27, 38, 6, 2, '#B892FF'); P(29, 40, 2, 1, '#B892FF');
    P(44, 36, 8, 1, '#4AB8A8'); P(51, 35, 6, 1, '#4AB8A8'); P(56, 37, 9, 1, '#4AB8A8'); P(64, 34, 1, 5, '#4AB8A8');
    P.a(1);
    /* the painted door: a door-shaped chalk-lilac outline with stars */
    P.a(0.7);
    P(93, 24, 22, 1, '#C8A8FF'); P(93, 24, 1, 24, '#C8A8FF'); P(114, 24, 1, 24, '#C8A8FF');
    P(88, 28, 1, 3, '#C8A8FF'); P(87, 29, 3, 1, '#C8A8FF');
    P(118, 33, 1, 3, '#C8A8FF'); P(117, 34, 3, 1, '#C8A8FF');
    P(116, 22, 1, 1, '#C8A8FF'); P(90, 40, 1, 1, '#C8A8FF');
    P.a(1);

    /* B — the stall's building: a window box, the neon sign (off state) */
    win(P, 146, 2, 36, 12, 'low', 5);
    P(144, 15, 40, 3, '#3A2A24'); for (i = 0; i < 9; i++) P(146 + i * 4, 13, 3, 2, i & 1 ? '#7A3A5A' : '#3A6A3A');
    neonPaint(P, false);

    /* C — the cafe, closed: big window, teal awning, upper flats */
    win(P, 222, 2, 14, 14, 'warm', 6); win(P, 254, 2, 14, 14, 'tv', 7);
    win(P, 286, 2, 14, 14, 'dark', 8); win(P, 318, 2, 14, 14, 'warm', 9);
    P(216, 20, 72, 6, '#1C3A3A');
    for (i = 0; i < 72; i += 8) { P(216 + i, 20, 4, 6, '#2E5E58'); P(216 + i, 26, 4, 2, '#2E5E58'); P(220 + i, 26, 4, 1, '#1C3A3A'); }
    P(216, 20, 72, 1, '#4A8A80');
    P(218, 29, 62, 18, '#07070C'); P(219, 30, 60, 16, '#3A2618');
    P(219, 30, 60, 3, '#5A3A20');
    /* stacked chairs, upside down on tables */
    for (i = 0; i < 4; i++) { x = 224 + i * 14; P(x, 40, 9, 2, '#1A100A'); P(x + 1, 42, 1, 4, '#1A100A'); P(x + 7, 42, 1, 4, '#1A100A'); P(x + 1, 35, 1, 5, '#1A100A'); P(x + 7, 35, 1, 5, '#1A100A'); }
    P(248, 30, 1, 16, '#07070C');
    P(284, 28, 14, 20, '#07070C'); P(285, 29, 12, 19, '#1E1A1E'); P(294, 38, 2, 2, '#C8A04A');
    P(300, 24, 50, 4, '#0E0B0A');
    P(304, 25, 3, 2, '#8A7A6A'); P(310, 25, 2, 2, '#8A7A6A'); P(316, 25, 4, 2, '#8A7A6A'); P(324, 25, 2, 2, '#8A7A6A');

    /* D — the tall narrow tenement and its fire escape */
    win(P, 360, -18, 10, 12, 'dark', 10); win(P, 392, -18, 10, 12, 'warm', 11);
    win(P, 360, 4, 10, 12, 'cool', 12); win(P, 392, 4, 10, 12, 'warm', 13);
    /* the cat in the lit window, sitting */
    P(395, 9, 4, 4, '#07070C'); P(395, 8, 1, 1, '#07070C'); P(398, 8, 1, 1, '#07070C'); P(399, 12, 2, 1, '#07070C');
    for (i = 0; i < 2; i++) {
      var fy = -4 + i * 22;
      P(356, fy, 56, 2, '#08080C'); P(356, fy - 6, 56, 1, '#2A2836');
      for (x = 356; x < 412; x += 4) P(x, fy - 6, 1, 6, '#1A1922');
    }
    P(404, -4, 1, 22, '#2A2836'); P(408, -4, 1, 22, '#2A2836');
    for (i = -2; i < 18; i += 3) P(404, i, 5, 1, '#2A2836');
    P(362, 28, 36, 20, '#07070C'); P(364, 30, 14, 18, '#1A1822'); P(366, 32, 10, 6, '#2A2840'); P(375, 40, 2, 2, '#8A7A6A');
    P(382, 32, 12, 6, '#0E0E16'); P(383, 33, 2, 1, '#E8E0D0'); P(386, 33, 4, 1, '#8A8598');
    /* street numbers */
    P(366, 26, 1, 3, '#C8A04A'); P(368, 26, 2, 1, '#C8A04A'); P(369, 27, 1, 2, '#C8A04A');

    /* side walls and the parapet over the canal */
    sideWall(P, 0, 48, 144, 1); sideWall(P, 400, 48, 144, -1);
    P(0, 48, 16, 2, '#07070C'); P(400, 48, 16, 2, '#07070C');

    /* the north pavement */
    slabs(P, 16, 48, 384, 46, 3);
    /* kerb: a lit top edge, a dark face dropping to the road */
    P(16, 92, 384, 2, '#3E3C50'); P(16, 94, 384, 1, '#2C2A3A'); P(16, 95, 384, 3, '#0A0A10');
    /* the road */
    asphalt(P, 16, 98, 384, 44, 5);
    /* gutters */
    P(16, 98, 384, 1, '#0C0C12'); P(16, 140, 384, 2, '#0C0C12');
    for (x = 40; x < 400; x += 96) { P(x, 139, 8, 3, '#07070A'); for (i = 0; i < 8; i += 2) P(x + i, 140, 1, 2, '#2A2A36'); }
    /* centre line, worn */
    for (x = 20; x < 396; x += 24) { if (x > 214 && x < 262) continue; P(x, 119, 12, 2, hash(x) > 0.25 ? '#6A6452' : '#3E3A30'); }
    /* the crossing */
    for (i = 0; i < 7; i++) {
      P(222, 101 + i * 6, 36, 3, '#45434F');
      if (hash(i + 40) > 0.5) P(228 + ((hash(i) * 20) | 0), 101 + i * 6, 5, 3, '#2E2C38');
    }
    /* the manhole, steaming (overlay) */
    fillEll(P, 88, 121, 8, 5, '#0A0A10'); fillEll(P, 88, 120, 7, 4, '#2A2834');
    for (i = -5; i <= 5; i += 2) P(88 + i, 118, 1, 5, '#16151E');
    P(82, 117, 12, 1, '#3A3846');
    /* the south pavement */
    P(16, 142, 384, 2, '#3E3C50'); P(16, 144, 384, 1, '#2C2A3A');
    slabs(P, 16, 145, 384, 47, 9);
    /* tree pit with a sapling's shadow, cracks, a dropped flyer */
    P(296, 170, 8, 5, '#C8C0B0'); P(297, 171, 6, 1, '#8A8598'); P(297, 173, 4, 1, '#8A8598');
    /* the parapet and the canal below it */
    parapet(P, 0, 192, W);
    P(0, 208, W, 40, '#06080F');
    for (i = 0; i < 40; i++) {
      var wx = (hash(i * 3) * W) | 0, wy = 211 + ((hash(i * 5) * 26) | 0);
      P(wx, wy, 3 + ((hash(i) * 6) | 0), 1, '#121A30');
    }
    /* wet light: pools under lamps, streaks on the road, puddles */
    for (i = 0; i < D1_LAMPS.length; i++) {
      var lx = D1_LAMPS[i][0] * 16 + 8, ly = (D1_LAMPS[i][1] + 1) * 16;
      pool(P, lx, ly - 2, 30, 13, '#FFB45E', 0.07);
      streak(P, lx, D1_LAMPS[i][1] < 6 ? 100 : 228, D1_LAMPS[i][1] < 6 ? 140 : 246, '#FFC878');
    }
    pool(P, 168, 98, 44, 10, '#FFB45E', 0.06);
    streak(P, 168, 100, 140, '#FF8AD8');
    streak(P, 120, 210, 246, '#FF8AD8');
    puddle(P, 172, 133, 9, 3, '#FF8AD8');
    puddle(P, 332, 104, 7, 2, '#FFC878');
    puddle(P, 40, 160, 6, 2, null);
    puddle(P, 120, 126, 5, 2, null);
  }

  /* the neon crescent and star above the stall */
  var NEON = null;
  function neonPts() {
    if (NEON) return NEON;
    NEON = [];
    var cx = 166, cy = 22, x, y;
    for (y = -9; y <= 9; y++) for (x = -9; x <= 9; x++) {
      var d0 = Math.sqrt(x * x + y * y), dx = x - 3, dy = y + 2, d1 = Math.sqrt(dx * dx + dy * dy);
      if ((Math.abs(d0 - 7) < 0.55 && d1 >= 5.5) || (Math.abs(d1 - 5.5) < 0.55 && d0 <= 7)) NEON.push([cx + x, cy + y]);
    }
    var star = [[180, 14], [180, 15], [180, 16], [179, 15], [181, 15], [178, 15], [182, 15], [180, 13], [180, 17]];
    for (x = 0; x < star.length; x++) NEON.push(star[x]);
    return NEON;
  }
  function neonPaint(P, on) {
    var pts = neonPts(), i;
    P(160, 26, 1, 4, '#2A2836'); P(176, 26, 1, 4, '#2A2836');
    for (i = 0; i < pts.length; i++) P(pts[i][0], pts[i][1], 1, 1, on ? '#FFC8F0' : '#4A2242');
  }
  function neonOn() {
    return bake('neon-on', 40, 34, 0, 0, function (P) {
      var pts = neonPts(), i;
      P.a(0.18);
      for (i = 0; i < pts.length; i++) P(pts[i][0] - 157, pts[i][1] - 6, 3, 3, '#FF6BD6');
      P.a(1);
      for (i = 0; i < pts.length; i++) P(pts[i][0] - 156, pts[i][1] - 5, 1, 1, '#FFD0F2');
    });
  }

  /* ═══ D2 — the alley ═══════════════════════════════════════════════ */
  function paintD2(P) {
    var W = 320, i, x;
    bricks(P, 0, -20, 168, 68, UMBER, 71);
    bricks(P, 168, -10, 152, 58, SOOT, 79);
    P(167, -20, 2, 68, '#08070A');
    cornice(P, 0, -20, 168, '#2A221E', '#3E342C', '#0A0806');
    cornice(P, 168, -10, 152, '#1E1D27', '#302E3C', '#08080C');
    /* back windows, mostly dark, one with a grille */
    win(P, 14, -10, 12, 12, 'dark', 1); win(P, 46, -10, 12, 12, 'low', 2);
    win(P, 110, -10, 12, 12, 'dark', 3); win(P, 196, -2, 12, 12, 'dark', 4); win(P, 276, -2, 12, 12, 'cool', 5);
    for (i = 0; i < 4; i++) P(197 + i * 3, -2, 1, 12, '#3A3846');
    /* the fire escape, zig-zagging down the left building */
    for (i = 0; i < 2; i++) {
      var fy = 4 + i * 20;
      P(8, fy, 72, 2, '#07070A'); P(8, fy - 7, 72, 1, '#2E2C38');
      for (x = 8; x < 80; x += 4) P(x, fy - 7, 1, 7, '#1C1B24');
    }
    for (i = 0; i < 14; i++) P(30 + i * 2, 6 + i, 3, 1, '#2E2C38');
    /* laundry on the escape: three shirts and a sock */
    P(12, -4, 60, 1, '#4A4858');
    P(16, -3, 8, 7, '#5A4A6A'); P(15, -3, 10, 2, '#5A4A6A');
    P(30, -3, 7, 9, '#6A4A4A'); P(44, -3, 9, 6, '#4A5A6A'); P(43, -3, 11, 2, '#4A5A6A'); P(60, -3, 3, 6, '#C8C0B0'); P(60, 2, 5, 2, '#C8C0B0');
    /* NEU in spray paint, crossed out, and NEU again, worse */
    graffiti(P, false);
    /* AC unit dripping onto the ground (overlay drop) */
    P(248, 18, 26, 14, '#07070A'); P(249, 19, 24, 12, '#3A3E4A'); P(249, 19, 24, 2, '#545A6A');
    for (i = 0; i < 5; i++) P(252 + i * 4, 22, 2, 8, '#262A34');
    P(261, 32, 1, 3, '#2A3A5A');
    /* the back door and its bare bulb */
    P(214, 18, 22, 30, '#07070A'); P(216, 20, 18, 28, '#2A2026'); P(217, 21, 16, 26, '#3A2C30');
    P(218, 24, 12, 1, '#2A2026'); P(218, 36, 12, 1, '#2A2026'); P(230, 33, 2, 2, '#8A7A5A');
    P(224, 10, 2, 5, '#1A1A22'); P(223, 15, 4, 3, '#FFE6A8'); P(224, 16, 2, 1, '#FFFFFF');
    pool(P, 225, 22, 26, 18, '#FFD890', 0.06);
    /* drainpipe */
    P(160, -20, 4, 68, '#1A1A22'); P(161, -20, 1, 68, '#2E2E3A'); P(158, 10, 8, 2, '#121218'); P(158, 34, 8, 2, '#121218');
    P(159, 44, 6, 4, '#1A1A22');

    /* walls left and right, the near wall below */
    sideWall(P, 0, 48, 96, 1); sideWall(P, 304, 48, 96, -1);
    P(16, 48, 16, 0, '#000');
    /* the alley floor: old setts, wet, with a gutter down the middle */
    P(16, 48, 288, 96, '#16151D');
    for (var j = 48; j < 144; j += 5) for (i = 16; i < 304; i += 7) {
      var k = hash(i * 7 + j * 13 + 3), off = ((j / 5) & 1) ? 3 : 0;
      P(i + off, j, 6, 4, k < 0.25 ? '#1A1922' : k > 0.8 ? '#221F2A' : '#1D1C26');
      if (k > 0.94) P(i + off + 1, j, 4, 1, '#2A2834');
    }
    P(16, 103, 288, 2, '#0C0C12'); P(16, 102, 288, 1, '#22212C');
    /* contact shadow under the back walls */
    P.a(0.5); P(16, 48, 288, 5, '#050508'); P.a(0.25); P(16, 53, 288, 3, '#050508'); P.a(1);
    /* puddle under the AC, a stain, the steam grate */
    puddle(P, 262, 58, 9, 3, '#FFE6A8');
    puddle(P, 120, 128, 12, 3, '#B892FF');
    puddle(P, 40, 112, 6, 2, null);
    P(140, 82, 16, 12, '#07070A');
    for (i = 0; i < 16; i += 3) P(140 + i, 83, 2, 10, '#2A2834');
    P(140, 82, 16, 1, '#3A3848');
    /* a bootprint trail, and weeds where the wall meets the ground */
    for (i = 0; i < 6; i++) { P.a(0.6); P(40 + i * 22, 92 + (i & 1) * 5, 3, 2, '#0E0D14'); P.a(1); }
    for (i = 0; i < 12; i++) { x = 20 + ((hash(i * 9) * 280) | 0); P(x, 140, 1, 3, '#2E4A36'); P(x + 2, 141, 1, 2, '#3E5E46'); }
    /* the near wall */
    P(0, 144, W, 18, '#100F16');
    for (i = 0; i < W; i += 16) { P(i, 146, 15, 7, hash(i + 3) > 0.5 ? '#24222E' : '#201E2A'); P(i, 146, 15, 1, '#32303E'); }
    P(0, 144, W, 2, '#07070A');
    for (i = 0; i < W; i += 10) P(i + ((hash(i) * 6) | 0), 153, 1, 3, '#2E4A36');
    /* chain-link on the near wall */
    for (i = 0; i < W; i += 4) { P(i, 140, 1, 1, '#3A3846'); P(i + 2, 139, 1, 1, '#3A3846'); }
    P(0, 138, W, 1, '#2A2836');
  }
  function graffiti(P, glow) {
    var c1 = glow ? '#E8D8FF' : '#6A4A9A', c2 = glow ? '#9AF2E4' : '#2E6A64';
    /* N E U, 5-px tall, chunky */
    var L = ['10001', '11001', '10101', '10011', '10001'], Em = ['11111', '10000', '11110', '10000', '11111'], U = ['10001', '10001', '10001', '10001', '01110'];
    var gl = [L, Em, U], gi, r, c, ox = 104, oy = 22;
    for (gi = 0; gi < 3; gi++) for (r = 0; r < 5; r++) for (c = 0; c < 5; c++)
      if (gl[gi][r].charAt(c) === '1') P(ox + gi * 12 + c * 2, oy + r * 2, 2, 2, c1);
    /* the cross-out */
    for (c = 0; c < 34; c++) P(ox - 2 + c, oy + 4 + ((c / 6) | 0) % 2, 1, 1, '#9A2A3A');
    /* again, worse: lower, wobbling, teal */
    for (gi = 0; gi < 3; gi++) for (r = 0; r < 5; r++) for (c = 0; c < 5; c++)
      if (gl[gi][r].charAt(c) === '1') P(ox + 4 + gi * 11 + c * 2 + ((r + gi) & 1), oy + 13 + r + ((gi * 3 + c) % 3 === 0 ? 1 : 0), 2, 1, c2);
  }
  function graffitiGlow() {
    return bake('graffiti-glow', 60, 40, -96, -18, function (P) {
      P.a(0.16);
      P(-4, -2, 52, 16, '#B892FF');
      P.a(1);
      graffiti(P, true);
    });
  }

  /* ═══ D3 — the square ═════════════════════════════════════════════ */
  var D3_LAMPS = [[3, 3], [21, 3], [3, 11], [21, 11]];
  function paintD3(P) {
    var W = 400, i, x, j;
    /* north: the old hall, a clock in its gable */
    bricks(P, 0, -8, 136, 56, SLATE, 91);
    bricks(P, 264, -8, 136, 56, SLATE, 97);
    cornice(P, 0, -8, 136, '#2C3448', '#46506A', '#0A0C14');
    cornice(P, 264, -8, 136, '#2C3448', '#46506A', '#0A0C14');
    /* the tower */
    P(136, -36, 128, 84, '#1C1A26');
    bricks(P, 140, -30, 120, 78, { m: '#12111A', b: '#262434', d: '#201E2C', l: '#302E40' }, 101);
    P(136, -36, 128, 4, '#3C3A4E'); P(136, -36, 128, 1, '#56546A');
    P(136, -32, 4, 80, '#2E2C3C'); P(260, -32, 4, 80, '#2E2C3C');
    /* clock face (hands live in the overlay) */
    /* the gable: a stepped pediment over the clock */
    for (i = 0; i < 10; i++) P(160 + i * 4, -26 + (9 - i) * 2 + 4, 80 - i * 8, 2, i & 1 ? '#2E2C3C' : '#3A384A');
    fillEll(P, 200, 4, 15, 15, '#0A0910');
    fillEll(P, 200, 4, 14, 14, '#5A5468');
    fillEll(P, 200, 4, 13, 13, '#2A2632');
    fillEll(P, 200, 4, 12, 12, '#D8D0BC');
    fillEll(P, 200, 5, 11, 11, '#CFC6B0');
    for (i = 0; i < 12; i++) {
      var a = i / 12 * Math.PI * 2;
      P(200 + Math.round(Math.cos(a) * 10), 4 + Math.round(Math.sin(a) * 10), 1, i % 3 ? 1 : 2, '#2A2632');
    }
    /* the hall's doors, shut, and banners */
    P(180, 24, 40, 24, '#07070C'); P(182, 26, 36, 22, '#2A2030');
    P(184, 22, 32, 2, '#07070C'); P(186, 20, 28, 2, '#07070C');
    P(199, 24, 2, 24, '#14101A');
    for (j = 30; j < 48; j += 6) { P(185, j, 12, 1, '#3A2E40'); P(203, j, 12, 1, '#3A2E40'); }
    P(195, 36, 2, 2, '#C8A04A'); P(203, 36, 2, 2, '#C8A04A');
    P(176, 46, 48, 2, '#3E3C4E'); P(172, 47, 56, 1, '#2A2836');
    P(150, 6, 10, 26, '#5A2440'); P(150, 6, 10, 2, '#7A3458'); P(152, 30, 6, 4, '#5A2440'); P(154, 12, 2, 10, '#C8A04A');
    P(240, 6, 10, 26, '#5A2440'); P(240, 6, 10, 2, '#7A3458'); P(242, 30, 6, 4, '#5A2440'); P(244, 12, 2, 10, '#C8A04A');
    /* windows either side */
    for (i = 0; i < 4; i++) {
      win(P, 12 + i * 32, 4, 12, 16, i === 1 ? 'warm' : 'dark', 30 + i);
      win(P, 276 + i * 32, 4, 12, 16, i === 2 ? 'warm' : 'dark', 40 + i);
    }
    for (i = 0; i < 3; i++) {
      P(20 + i * 40, 30, 20, 18, '#07070C'); P(22 + i * 40, 32, 16, 16, '#1A1A26');
      P(284 + i * 40, 30, 20, 18, '#07070C'); P(286 + i * 40, 32, 16, 16, '#1A1A26');
    }
    /* walls: the west (a gate in it), the east is the edge: a balustrade */
    sideWall(P, 0, 48, 160, 1);
    /* the plaza: big pale flags in a radial-ish pattern */
    P(16, 48, 368, 160, '#22212C');
    for (j = 48; j < 208; j += 12) for (i = 16; i < 384; i += 16) {
      var off = ((j / 12) & 1) ? 8 : 0, k = hash(i * 3 + j * 11 + 5);
      P(i + off - 8, j, 15, 11, k < 0.2 ? '#1E1D28' : k > 0.85 ? '#2A2836' : '#24232F');
      P(i + off - 8, j, 15, 1, '#2C2B38');
    }
    /* the ring of darker setts around the fountain, and the spokes */
    for (i = 0; i < 4; i++) {
      var rr = 58 + i * 2;
      P.a(0.6 - i * 0.12);
      for (j = 0; j < 220; j++) {
        var an = j / 220 * Math.PI * 2;
        P(200 + Math.round(Math.cos(an) * rr), 116 + Math.round(Math.sin(an) * rr * 0.62), 2, 1, '#16151E');
      }
    }
    P.a(1);
    for (i = 0; i < 4; i++) {
      var sx = i < 2 ? 200 : (i === 2 ? 40 : 360), sy = i === 0 ? 50 : (i === 1 ? 152 : 116);
      if (i < 2) for (j = 0; j < 36; j += 3) P(sx - 1, sy + (i ? j : j), 2, 2, '#1A1924');
      else for (j = 0; j < 90; j += 4) P(i === 2 ? 40 + j : 270 + j, 116, 2, 1, '#1A1924');
    }
    P(16, 48, 368, 1, '#07070C');
    P.a(0.5); P(16, 48, 368, 5, '#050508'); P.a(1);
    /* leaves blown into the corners */
    for (i = 0; i < 30; i++) {
      x = 20 + ((hash(i * 7 + 1) * 360) | 0); j = 52 + ((hash(i * 11 + 2) * 150) | 0);
      if (Math.abs(x - 200) < 56 && Math.abs(j - 116) < 40) continue;
      P(x, j, 2, 1, i % 3 ? '#5A3A2A' : '#7A5A2E');
    }
    /* the east edge: a balustrade over the drop, the rest of the city far below */
    P(384, 48, 16, 160, '#16151E');
    P(384, 48, 3, 160, '#3E3C4E'); P(384, 48, 1, 160, '#56546A');
    for (j = 52; j < 206; j += 8) { P(388, j, 6, 6, '#2E2C3A'); P(388, j, 6, 1, '#4A485A'); P(389, j + 5, 4, 2, '#0C0C12'); }
    P(394, 48, 2, 160, '#2A2836');
    P(400, -8, 40, 240, '#04050A');
    for (i = 0; i < 26; i++) {
      x = 404 + ((hash(i * 13 + 4) * 32) | 0); j = 60 + ((hash(i * 17 + 9) * 150) | 0);
      P(x, j, 1, 1, i % 4 ? '#3A3A5A' : '#8A7A50');
    }
    /* south: a low hedge on a stone kerb */
    P(0, 208, W, 16, '#121119');
    P(0, 206, 384, 4, '#3A3848'); P(0, 206, 384, 1, '#4E4C5E');
    for (i = 0; i < 384; i += 6) { P(i, 196 + ((hash(i) * 3) | 0), 7, 11, '#1C2E24'); P(i + 1, 197 + ((hash(i + 1) * 3) | 0), 3, 2, '#2E4A36'); }
    P(0, 205, 384, 1, '#0E1610');
    /* light on the stones */
    for (i = 0; i < D3_LAMPS.length; i++) pool(P, D3_LAMPS[i][0] * 16 + 8, (D3_LAMPS[i][1] + 1) * 16 - 2, 34, 15, '#FFB45E', 0.07);
    pool(P, 200, 128, 70, 34, '#9FB8FF', 0.03);
    /* the chalk circle: drawn by someone in a hurry */
    chalk(P);
  }
  var CHALK = { x: 200, y: 188 };
  function chalk(P) {
    var cx = CHALK.x, cy = CHALK.y, i;
    P.a(0.75);
    for (i = 0; i < 64; i++) {
      if (i > 54 && i < 58) continue;              /* where it was not closed */
      var a = i / 64 * Math.PI * 2, r = 17 + (hash(i) > 0.8 ? 1 : 0);
      P(cx + Math.round(Math.cos(a) * r), cy + Math.round(Math.sin(a) * r * 0.55), 1, 1, '#D8D0E0');
    }
    for (i = 0; i < 40; i++) {
      var b = i / 40 * Math.PI * 2;
      P(cx + Math.round(Math.cos(b) * 12), cy + Math.round(Math.sin(b) * 12 * 0.55), 1, 1, '#B8B0C8');
    }
    /* a crude potion, the circle's request */
    P(cx - 1, cy - 4, 3, 1, '#D8D0E0'); P(cx - 1, cy - 3, 1, 2, '#D8D0E0'); P(cx + 1, cy - 3, 1, 2, '#D8D0E0');
    P(cx - 3, cy - 1, 1, 3, '#D8D0E0'); P(cx + 3, cy - 1, 1, 3, '#D8D0E0'); P(cx - 2, cy + 2, 5, 1, '#D8D0E0'); P(cx - 2, cy - 1, 1, 1, '#D8D0E0'); P(cx + 2, cy - 1, 1, 1, '#D8D0E0');
    /* hurried arrows pointing in */
    P(cx - 26, cy, 5, 1, '#C8C0D8'); P(cx - 23, cy - 1, 1, 1, '#C8C0D8'); P(cx - 23, cy + 1, 1, 1, '#C8C0D8');
    P(cx + 22, cy, 5, 1, '#C8C0D8'); P(cx + 23, cy - 1, 1, 1, '#C8C0D8'); P(cx + 23, cy + 1, 1, 1, '#C8C0D8');
    /* the chalk itself, dropped */
    P(cx + 30, cy + 6, 3, 1, '#E8E0F0');
    P.a(1);
  }

  /* ═══ E — New Home ═════════════════════════════════════════════════
     The same corridor three times. What differs is small and wrong:
     the moon changes phase between rooms that are seconds apart, the
     wallpaper's motif shifts and, in the third, the motif has eyes. */
  var HOME = {
    paper: '#25252B', paper2: '#2B2B32', motif: '#303038', rail: '#3A3A42', railHi: '#4A4A54',
    wains: '#1C1C21', wainsHi: '#26262C', skirt: '#121215', floor: '#24221F', floorLo: '#1C1A18', floorHi: '#2C2A26',
    moon: '#A8B8E0', frame: '#3A3A42'
  };
  function homeWall(P, W, variant, gold) {
    var i, j, x;
    /* crown, paper, rail, wainscot, skirting — and the ceiling's shadow */
    P(0, -26, W, 4, '#2E2E36'); P(0, -26, W, 1, '#42424C'); P(0, -22, W, 2, '#141418');
    P(0, -20, W, 38, HOME.paper);
    for (j = -18; j < 16; j += 8) for (x = (((j + 18) / 8) & 1) ? 4 : 0; x < W; x += 8) {
      var mx = x + (variant === 2 ? 2 : 0), my = j;
      if (variant === 3 && hash(x * 3 + j) > 0.55) {
        /* a closed eye, then another */
        P(mx + 1, my + 3, 3, 1, HOME.motif); P(mx, my + 2, 1, 1, HOME.motif); P(mx + 4, my + 2, 1, 1, HOME.motif);
        P(mx + 1, my + 4, 1, 1, HOME.motif); P(mx + 3, my + 4, 1, 1, HOME.motif);
      } else {
        P(mx + 2, my, 1, 1, HOME.motif); P(mx + 1, my + 1, 3, 1, HOME.motif); P(mx + 2, my + 2, 1, 1, HOME.motif);
      }
    }
    P(0, 16, W, 2, HOME.rail); P(0, 16, W, 1, HOME.railHi);
    P(0, 18, W, 12, HOME.wains);
    for (x = 4; x < W; x += 24) { P(x, 20, 18, 8, HOME.wainsHi); P(x + 1, 21, 16, 6, HOME.wains); }
    P(0, 29, W, 3, HOME.skirt); P(0, 29, W, 1, '#2A2A30');
    if (gold) { P.a(0.08); P(0, -20, W, 50, '#FFC86A'); P.a(1); }
  }
  function homeFloor(P, W, y0, y1, seed) {
    P(16, y0, W - 32, y1 - y0, HOME.floor);
    for (var j = y0; j < y1; j += 4) {
      var off = (hash(j * 3 + seed) * 40) | 0;
      for (var x = 16 - off; x < W - 16; x += 40) {
        var k = hash(x + j * 7 + seed);
        var c = k < 0.3 ? HOME.floorLo : k > 0.8 ? HOME.floorHi : HOME.floor;
        var a0 = Math.max(16, x), a1 = Math.min(W - 16, x + 39);
        if (a1 > a0) P(a0, j, a1 - a0, 3, c);
        if (x + 39 < W - 16 && x + 39 >= 16) P(x + 39, j, 1, 3, '#141210');
      }
      P(16, j + 3, W - 32, 1, '#161412');
    }
    /* shadow under the wall */
    P.a(0.55); P(16, y0, W - 32, 4, '#060606'); P.a(0.25); P(16, y0 + 4, W - 32, 3, '#060606'); P.a(1);
  }
  /* a tall window with the moon in it, and the shaft it throws */
  function homeWindow(P, x, phase) {
    P(x - 3, -18, 38, 38, '#121216'); P(x - 2, -17, 36, 36, HOME.frame); P(x - 2, -17, 36, 1, '#55555F');
    P(x, -15, 32, 32, '#1A2236');
    P(x, -15, 32, 10, '#141A2C'); P(x, -5, 32, 10, '#1A2236'); P(x, 5, 32, 12, '#222C44');
    /* the moon: phase 0 crescent, 1 half, 2 full */
    fillEll(P, x + 22, -6, 4, 4, '#D8E0F0');
    if (phase === 0) fillEll(P, x + 20, -7, 4, 4, '#141A2C');
    if (phase === 1) P(x + 18, -10, 4, 9, '#141A2C');
    P(x + 15, -15, 2, 32, '#121216'); P(x, 1, 32, 2, '#121216');
    /* curtains */
    P(x - 6, -20, 7, 42, '#34343C'); P(x - 5, -20, 1, 42, '#3E3E48'); P(x - 3, -20, 1, 42, '#2A2A30');
    P(x + 31, -20, 7, 42, '#34343C'); P(x + 34, -20, 1, 42, '#3E3E48'); P(x + 36, -20, 1, 42, '#2A2A30');
    P(x - 8, -22, 48, 2, '#1A1A1E');
    /* sill and radiator */
    P(x - 4, 19, 40, 2, '#3E3E48');
    P(x + 2, 22, 28, 8, '#1A1A1E'); for (var i = 0; i < 7; i++) P(x + 3 + i * 4, 22, 2, 8, '#2E2E36');
  }
  function shaft(P, x, y0, y1, w, col, a) {
    /* a slanted band from the window down across the boards */
    for (var y = y0; y < y1; y += 2) {
      var k = (y - y0) / (y1 - y0), dx = Math.round(k * 26);
      P.a(a * (1 - k * 0.6)); P(x + dx, y, w, 2, col);
      P.a(a * 0.6 * (1 - k * 0.6)); P(x + dx + 4, y, w - 8, 2, col);
    }
    P.a(1);
  }
  function homeDoor(P, x) {
    P(x - 2, -8, 20, 40, '#121216'); P(x - 1, -7, 18, 39, '#3A3A42'); P(x - 1, -7, 18, 1, '#4E4E58');
    P(x + 1, -5, 14, 37, '#2A2A30');
    P(x + 3, -3, 10, 12, '#24242A'); P(x + 3, 12, 10, 16, '#24242A');
    P(x + 3, -3, 10, 1, '#323238'); P(x + 3, 12, 10, 1, '#323238');
    P(x + 12, 12, 2, 2, '#8A8478');
  }
  function sconce(P, x) {
    P(x - 1, 2, 3, 6, '#2E2E36'); P(x - 3, -2, 7, 4, '#C8C0B0'); P(x - 2, -3, 5, 1, '#E0D8C8'); P(x - 3, 2, 7, 1, '#8A8478');
    pool(P, x, 2, 16, 14, '#E8E0D0', 0.04);
  }
  function homeSides(P, W) {
    sideWall(P, 0, 32, 80, 1); sideWall(P, W - 16, 32, 80, -1);
  }
  /* the near side: a banister over the stairwell */
  function banister(P, W) {
    P(0, 112, W, 20, '#0C0C0E');
    P(0, 112, W, 4, '#3A3A42'); P(0, 112, W, 1, '#52525C'); P(0, 116, W, 1, '#141418');
    for (var x = 6; x < W; x += 10) { P(x, 117, 3, 10, '#2A2A30'); P(x, 117, 1, 10, '#3A3A42'); }
    P(0, 127, W, 3, '#2E2E36');
  }
  function paintHall(P, variant) {
    var W = 384, i;
    homeWall(P, W, variant, false);
    homeWindow(P, 64, variant - 1);
    homeWindow(P, 288, variant - 1);
    homeDoor(P, 128); homeDoor(P, 240);
    sconce(P, 104); sconce(P, 168); sconce(P, 228);
    /* the odd one out on the wall, per room */
    if (variant === 1) {
      /* an empty frame on its nail: brighter paper where a picture was */
      P(188, -12, 24, 20, '#2E2E36'); P(186, -14, 28, 2, '#55505A'); P(186, 6, 28, 2, '#55505A');
      P(186, -14, 2, 22, '#55505A'); P(212, -14, 2, 22, '#55505A');
      P(188, -12, 24, 18, HOME.paper2);
      P(199, -20, 2, 2, '#8A8478'); P(193, -18, 7, 1, '#3A3A42'); P(201, -18, 7, 1, '#3A3A42');
      /* shelf with a few books */
      P(26, -2, 26, 2, '#3A3A42'); P(28, -10, 3, 8, '#4A4A54'); P(31, -9, 2, 7, '#3A3A46'); P(34, -11, 3, 9, '#525260'); P(40, -6, 8, 4, '#2E2E36');
    } else if (variant === 2) {
      /* the same shelf, one book fewer, and a clock-shaped pale patch */
      P(26, -2, 26, 2, '#3A3A42'); P(28, -10, 3, 8, '#4A4A54'); P(34, -11, 3, 9, '#525260'); P(40, -6, 8, 4, '#2E2E36');
      P(196, -14, 8, 8, HOME.paper2);
    } else {
      /* the door you do not have a key for: heavier, darker, a cold line of light under it */
      P(186, -12, 28, 44, '#0A0A0C'); P(188, -10, 24, 42, '#1A1A1E');
      for (i = 0; i < 24; i += 4) P(188 + i, -10, 1, 42, '#141418');
      P(196, 8, 8, 8, '#2A2A30'); P(199, 10, 2, 3, '#07070A'); P(199, 13, 1, 2, '#07070A');
      P(188, 31, 24, 1, '#8A9AC0');
      P.a(0.12); P(186, 32, 28, 5, '#8A9AC0'); P(190, 37, 20, 3, '#8A9AC0'); P.a(1);
      /* no shelf: just the screw holes where one was */
      P(30, -2, 1, 1, '#141418'); P(48, -2, 1, 1, '#141418');
    }
    homeSides(P, W);
    homeFloor(P, W, 32, 112, variant * 7);
    /* the runner along the corridor */
    P(40, 66, 304, 28, '#2A2A2E'); P(42, 68, 300, 24, '#323236');
    P(42, 70, 300, 1, '#3E3E44'); P(42, 89, 300, 1, '#3E3E44');
    for (i = 46; i < 340; i += 8) { P(i, 78, 3, 3, '#2A2A2E'); }
    for (i = 40; i < 344; i += 2) { P(i, 65, 1, 1, '#3A3A40'); P(i, 94, 1, 1, '#3A3A40'); }
    /* moon on the boards */
    shaft(P, 64, 32, 96, 32, HOME.moon, variant === 3 ? 0.12 : 0.09);
    shaft(P, 288, 32, 96, 32, HOME.moon, 0.09);
    banister(P, W);
  }
  function paintE4(P) {
    var W = 384, i;
    homeWall(P, W, 1, true);
    /* frames on the wall, gold, each holding a little of the room's light */
    var F = [112, 176, 240];
    for (i = 0; i < F.length; i++) {
      var x = F[i];
      P(x - 1, -13, 26, 22, '#3A2A10'); P(x, -12, 24, 20, '#C8A04A'); P(x, -12, 24, 1, '#F2D27A');
      P(x + 2, -10, 20, 16, i === 1 ? '#3A2E24' : '#2A2620');
      if (i === 0) { fillEll(P, x + 12, -2, 5, 5, '#5A4630'); P(x + 10, -4, 1, 1, '#14100A'); P(x + 13, -4, 1, 1, '#14100A'); }
      if (i === 1) { P(x + 4, 0, 16, 6, '#3A4A2E'); fillEll(P, x + 16, -5, 3, 3, '#F2D27A'); }
      if (i === 2) { P(x + 6, -6, 3, 12, '#5A4630'); P(x + 14, -4, 3, 10, '#5A4630'); P(x + 6, -8, 3, 2, '#E8DCC8'); P(x + 14, -6, 3, 2, '#E8DCC8'); }
    }
    homeSides(P, W);
    homeFloor(P, W, 32, 112, 4);
    /* the carpet: the one warm thing */
    P(78, 46, 228, 52, '#2A140E');
    P(80, 48, 224, 48, '#6A2A20'); P(80, 48, 224, 2, '#8A3A2A'); P(80, 94, 224, 2, '#4A1A14');
    P(84, 52, 216, 40, '#7A3426'); P(86, 54, 212, 36, '#6A2A20');
    for (i = 0; i < 216; i += 12) { P(88 + i, 56, 4, 4, '#C8904A'); P(90 + i, 82, 4, 4, '#C8904A'); }
    for (i = 100; i < 290; i += 28) {
      P(i, 71, 8, 2, '#A8603A'); P(i + 2, 69, 4, 6, '#A8603A'); P(i + 3, 67, 2, 10, '#A8603A');
      P(i + 3, 71, 2, 2, '#E8B868');
    }
    P(86, 60, 212, 1, '#8A3A2A'); P(86, 83, 212, 1, '#8A3A2A');
    for (i = 80; i < 304; i += 3) { P(i, 45, 1, 2, '#C8904A'); P(i, 97, 1, 2, '#C8904A'); }
    /* golden light from nowhere in particular: shafts falling through the wall */
    for (i = 0; i < 4; i++) shaft(P, 70 + i * 72, 18, 108, 30, '#FFC86A', 0.12);
    pool(P, 312, 78, 40, 22, '#FFD890', 0.05);
    banister(P, W);
  }

  var ROOMS = {
    d1_street: { w: 26, h: 13, paint: paintD1 },
    d2_alley: { w: 20, h: 10, paint: paintD2 },
    d3_square: { w: 25, h: 14, paint: paintD3 },
    e1_hall: { w: 24, h: 8, paint: function (P) { paintHall(P, 1); } },
    e2_hall: { w: 24, h: 8, paint: function (P) { paintHall(P, 2); } },
    e3_hall: { w: 24, h: 8, paint: function (P) { paintHall(P, 3); } },
    e4_corridor: { w: 24, h: 8, paint: paintE4 }
  };
  function roomArt(id) {
    var r = ROOMS[id];
    if (!r) return null;
    return bake('room:' + id, r.w * T + PAD * 2, r.h * T + PAD * 2, PAD, PAD, r.paint);
  }

  /* ── room overlays: the few pixels that move ───────────────────── */
  var DRIFT = [];
  for (var di = 0; di < 16; di++) DRIFT.push([hash(di * 3 + 1), hash(di * 7 + 2), hash(di * 11 + 3)]);

  function ripple(cx, cy, now, period, ph) {
    var t = ((now / period + ph) % 1), r = 1 + Math.round(t * 5);
    QG.globalAlpha = 0.6 * (1 - t);
    Q(cx - r, cy, 1, 1, '#6A7AA8'); Q(cx + r, cy, 1, 1, '#6A7AA8');
    Q(cx - 1, cy - Math.ceil(r / 2), 2, 1, '#6A7AA8'); Q(cx - 1, cy + Math.ceil(r / 2), 2, 1, '#6A7AA8');
    QG.globalAlpha = 1;
  }
  function steam(cx, cy, now, n) {
    for (var i = 0; i < n; i++) {
      var t = ((now / 2600 + i / n) % 1), y = cy - t * 26, x = cx + Math.round(Math.sin(t * 6 + i) * 4);
      QG.globalAlpha = 0.22 * (1 - t);
      Q(x - 3 - (t * 3 | 0), y, 6 + (t * 6 | 0), 3, '#8A8EA8');
    }
    QG.globalAlpha = 1;
  }
  function hand(cx, cy, ang, len, col) {
    for (var i = 1; i <= len; i++) Q(cx + Math.round(Math.cos(ang) * i), cy + Math.round(Math.sin(ang) * i), 1, 1, col);
  }
  function motes(now, x0, y0, w, h, col, up) {
    for (var i = 0; i < DRIFT.length; i++) {
      var r = DRIFT[i], t = ((now / (9000 + r[2] * 5000)) + r[0]) % 1;
      var x = x0 + r[1] * w + Math.sin(now / 1700 + i) * 4, y = up ? y0 + h - t * h : y0 + t * h;
      QG.globalAlpha = 0.5 * Math.sin(t * Math.PI);
      Q(x, y, 1, 1, col);
    }
    QG.globalAlpha = 1;
  }

  var ANIM = {
    d1_street: function (g, now, S, ox, oy) {
      var mv = !still();
      /* the neon: lit, with one short stutter every few seconds */
      var off = mv && ((now % 6400) < 140 || ((now + 900) % 11300) < 90);
      if (!off) blit(g, neonOn(), ox + 156 * S, oy + 5 * S, S);
      /* the TV upstairs at C */
      if (mv) { var tv = ((now / 520) | 0) % 4; Q(255, 3, 12, 6, tv === 1 ? '#5A86C8' : tv === 3 ? '#2E4A7A' : '#46689E'); }
      if (!mv) return;
      steam(88, 116, now, 4);
      ripple(172, 133, now, 1300, 0); ripple(332, 104, now, 1700, 0.4);
      ripple(40, 160, now, 1500, 0.7); ripple(120, 126, now, 1900, 0.2);
      /* the canal moves */
      for (var i = 0; i < 6; i++) {
        var x = ((hash(i) * 416 + now / (60 + i * 9)) % 430) - 8;
        QG.globalAlpha = 0.5; Q(x, 212 + i * 4, 6, 1, '#2A3A62');
      }
      QG.globalAlpha = 1;
    },
    d2_alley: function (g, now, S, ox, oy) {
      var mv = !still();
      /* the graffiti hums: a slow breathe, never a strobe */
      g.globalAlpha = mv ? 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(now / 1400)) : 1;
      blit(g, graffitiGlow(), ox + 0, oy + 0, S);
      g.globalAlpha = 1;
      if (!mv) return;
      /* the drip */
      var t = (now % 1700) / 1700;
      if (t < 0.5) Q(261, 35 + Math.round(t * 2 * 21), 1, 2, '#8AA8E0');
      else ripple(262, 58, now, 1700, 0.5);
      steam(148, 86, now, 5);
      ripple(120, 128, now, 2100, 0.3);
    },
    d3_square: function (g, now, S) {
      /* the clock keeps the real time; the one thing in the city that is right */
      var d = new Date(), m = d.getMinutes() + d.getSeconds() / 60, h = (d.getHours() % 12) + m / 60;
      hand(200, 4, h / 12 * Math.PI * 2 - Math.PI / 2, 6, '#1A1620');
      hand(200, 4, m / 60 * Math.PI * 2 - Math.PI / 2, 9, '#1A1620');
      Q(200, 4, 1, 1, '#C8A04A');
      /* the chalk circle wakes when you are carrying what it wants */
      if (has('recall')) {
        var k = still() ? 1 : 0.5 + 0.5 * Math.sin(now / 600);
        QG.globalAlpha = 0.25 + 0.5 * k;
        for (var i = 0; i < 32; i++) {
          if (i > 27 && i < 30) continue;
          var a = i / 32 * Math.PI * 2;
          Q(CHALK.x + Math.round(Math.cos(a) * 17), CHALK.y + Math.round(Math.sin(a) * 9), 1, 1, '#D9B8FF');
        }
        QG.globalAlpha = 1;
      }
      if (still()) return;
      /* the city far below the balustrade, twinkling slowly */
      for (var j = 0; j < 6; j++) {
        var on = ((now / 1300 + j * 0.37) % 1) < 0.5;
        if (on) Q(406 + ((hash(j * 5) * 28) | 0), 70 + ((hash(j * 9) * 130) | 0), 1, 1, '#FFD890');
      }
      /* a leaf crossing the square */
      var lt = (now % 14000) / 14000;
      if (lt < 0.4) Q(20 + lt / 0.4 * 360, 160 + Math.sin(lt * 30) * 6, 2, 1, '#7A5A2E');
    },
    hall: function (g, now, S, ox, oy, id) {
      var v = id === 'e2_hall' ? 2 : id === 'e3_hall' ? 3 : 1;
      if (still()) return;
      motes(now, 64, 30, 60, 60, '#C8D0E8', false);
      if (v === 3) {
        /* the line of light under the locked door breathes, very slowly */
        QG.globalAlpha = 0.3 + 0.3 * Math.sin(now / 2300);
        Q(188, 31, 24, 1, '#C8D4F0');
        QG.globalAlpha = 1;
      }
    },
    e4_corridor: function (g, now) {
      if (still()) return;
      motes(now, 60, 20, 280, 90, '#FFE2A0', true);
      motes(now + 5000, 90, 30, 240, 70, '#FFD27A', true);
    }
  };
  ANIM.e1_hall = ANIM.e2_hall = ANIM.e3_hall = ANIM.hall;

  KK.kind('cityfloor', {
    interactive: function () { return false; },
    floor: true,
    draw: function (g, e, d) {
      var S = d.S, ox = d.sx - (e.x + 0.5) * T * S, oy = d.sy - (e.y + 1) * T * S;
      var art = roomArt(e.v);
      if (!art) return;
      /* only the part of the painting that is on screen: the margins
         around a room are mostly off it, and this is a full-screen blit */
      var x0 = ox - art.ax * S, y0 = oy - art.ay * S;
      var c0 = Math.max(0, Math.floor(-x0 / S)), r0 = Math.max(0, Math.floor(-y0 / S));
      var c1 = Math.min(art.w, Math.ceil((innerWidth - x0) / S)), r1 = Math.min(art.h, Math.ceil((innerHeight - y0) / S));
      if (c1 > c0 && r1 > r0) {
        var sm = g.imageSmoothingEnabled;
        g.imageSmoothingEnabled = false;
        g.drawImage(art.c, c0, r0, c1 - c0, r1 - r0, x0 + c0 * S, y0 + r0 * S, (c1 - c0) * S, (r1 - r0) * S);
        g.imageSmoothingEnabled = sm;
      }
      var an = ANIM[e.v];
      if (an) { qset(g, ox, oy, S); an(g, d.now, S, ox, oy, e.v); }
    }
  });

  /* ═══ props ═══════════════════════════════════════════════════════
     Each is { w, h, ax, ay, paint(P), anim(e, now), light(e, d) }.
     Paint coordinates are relative to the feet point (0,0). */
  function lampPaint(P) {
    P(-4, -2, 9, 2, '#0A0910'); P(-3, -4, 7, 2, '#2A2836');
    P(-1, -36, 3, 33, '#0A0910'); P(0, -36, 1, 33, '#3A3848');
    P(-2, -12, 5, 2, '#1A1922');
    /* arm and lantern */
    P(-5, -38, 11, 2, '#0A0910'); P(-4, -38, 9, 1, '#3A3848');
    P(-4, -46, 9, 8, '#0A0910'); P(-3, -45, 7, 6, '#FFD890'); P(-2, -44, 5, 4, '#FFF0C8');
    P(-3, -45, 1, 6, '#C89A50'); P(3, -45, 1, 6, '#C89A50');
    P(-5, -48, 11, 2, '#0A0910'); P(-3, -50, 7, 2, '#2A2836'); P(0, -52, 1, 2, '#2A2836');
    fillEll(P, 0, -1, 6, 2, '#000000');
  }
  var PROPS = {
    lamp: { w: 16, h: 56, ax: 8, ay: 54, paint: function (P) { P.a(0.4); fillEll(P, 0, -1, 6, 2, '#000000'); P.a(1); lampPaint(P); },
            light: function () { return { r: 48, col: '#FFC870', glow: 0.2 }; } },

    /* the stall, back half: shelves of junk against building B */
    stallback: { w: 84, h: 44, ax: 42, ay: 40, paint: function (P) {
      P(-40, -38, 80, 38, '#120C0A');
      P(-38, -36, 76, 36, '#3A2618'); P(-38, -36, 76, 2, '#5A3C24');
      for (var s = 0; s < 3; s++) {
        var y = -26 + s * 10;
        P(-38, y, 76, 2, '#6A4A2C'); P(-38, y + 2, 76, 1, '#1A100A');
      }
      /* the junk: a bent nail, half a map, jars, a chair leg, a watch, a sock, a tiny stall */
      P(-34, -30, 1, 4, '#8A8A9A'); P(-33, -30, 2, 1, '#8A8A9A');
      P(-28, -33, 8, 7, '#C8B88A'); P(-24, -33, 4, 7, '#A8986A'); P(-27, -31, 3, 1, '#6A5A3A');
      P(-16, -32, 5, 6, '#3A5A4A'); P(-16, -33, 5, 1, '#8A8A9A'); P(-15, -30, 3, 2, '#6A9A7A');
      P(-8, -31, 5, 5, '#5A3A5A'); P(-8, -32, 5, 1, '#8A8A9A');
      P(4, -30, 10, 2, '#6A4A2C'); P(12, -31, 2, 4, '#6A4A2C');
      P(20, -31, 5, 5, '#C8A04A'); P(21, -30, 3, 3, '#E8E0C8'); P(22, -30, 1, 2, '#1A1418');
      P(28, -32, 3, 5, '#C8C0D0'); P(28, -28, 5, 2, '#C8C0D0');
      P(-34, -21, 8, 5, '#4A3A2A'); P(-35, -22, 10, 2, '#7A3A3A'); P(-33, -20, 2, 2, '#C8A04A');
      P(-22, -20, 6, 4, '#8A5A3A'); P(-12, -21, 3, 5, '#4A6A8A'); P(-8, -21, 3, 5, '#6A4A8A');
      /* the recall potion's slot (its glow is live) */
      P(2, -22, 7, 6, '#1A1422'); P(4, -24, 3, 2, '#8A8A9A');
      P(14, -21, 12, 5, '#2A2A36'); P(15, -20, 10, 1, '#8A8598');
      P(-34, -11, 18, 5, '#2A1E16'); P(-30, -10, 3, 3, '#C8A04A'); P(-24, -10, 3, 3, '#8A8A9A');
      P(-10, -11, 14, 5, '#3A2A1E'); P(8, -11, 6, 5, '#5A3A5A'); P(20, -11, 14, 5, '#2A3A2A');
      /* hanging: garlic, a lantern hook */
      P(32, -36, 1, 6, '#8A7A5A'); P(30, -30, 5, 4, '#D8D0B8');
      P.a(0.45); P(-40, -2, 80, 4, '#000000'); P.a(1);
    }, anim: function (e, now) {
      /* the one lit thing on the shelf */
      if (has('recall')) return;
      var k = still() ? 1 : 0.6 + 0.4 * Math.sin(now / 450);
      QG.globalAlpha = 0.3 * k; Q(1, -25, 9, 9, '#B892FF'); QG.globalAlpha = 1;
      Q(3, -21, 5, 4, '#B892FF'); Q(4, -20, 3, 2, '#E8D8FF'); Q(4, -23, 3, 2, '#C8C0D0');
    } },

    /* the stall, front half: the counter and the awning over it */
    stallfront: { w: 92, h: 76, ax: 46, ay: 72, paint: function (P) {
      var i;
      /* poles */
      P(-40, -56, 2, 56, '#1A120C'); P(38, -56, 2, 56, '#1A120C');
      /* the counter */
      P(-41, -15, 82, 15, '#120C0A');
      P(-40, -14, 80, 3, '#8A5A36'); P(-40, -14, 80, 1, '#B07A48');
      P(-40, -11, 80, 11, '#4A2E1E');
      for (i = -36; i < 40; i += 10) P(i, -11, 1, 11, '#3A2416');
      /* a cloth over the front, wine, with a fringe */
      P(-30, -11, 44, 7, '#5A1E2E'); P(-30, -11, 44, 1, '#7A2E40');
      for (i = -30; i < 14; i += 2) P(i, -4, 1, 2, '#5A1E2E');
      /* the till and the price board */
      P(-12, -20, 12, 6, '#0E0A08'); P(-11, -19, 10, 5, '#B08A3A'); P(-10, -19, 8, 1, '#E0C070'); P(-9, -17, 2, 1, '#3A2A10'); P(-5, -17, 2, 1, '#3A2A10');
      P(-38, -26, 14, 13, '#0E0A08'); P(-37, -25, 12, 11, '#1E2420');
      P(-35, -23, 6, 1, '#C8C8C0'); P(-35, -21, 8, 1, '#C8C8C0'); P(-35, -19, 5, 1, '#C8C8C0'); P(-28, -19, 2, 1, '#E4C46A'); P(-35, -17, 7, 1, '#C8C8C0');
      /* the awning: striped, sloping toward you, a scalloped valance */
      for (var y = -66; y < -54; y++) {
        var k = (y + 66) / 12, hw = Math.round(36 + k * 8);
        for (var x = -hw; x < hw; x += 1) {
          var band = (((x + hw) / (hw * 2) * 10) | 0) & 1;
          P(x, y, 1, 1, band ? '#E8DCC8' : '#8A2E3E');
        }
      }
      P(-44, -66, 88, 1, '#120C0A');
      for (i = -44; i < 44; i += 8) {
        var b2 = ((i + 44) / 8) & 1;
        P(i, -54, 8, 3, b2 ? '#C8BCA8' : '#6A2232');
        P(i + 1, -51, 6, 1, b2 ? '#C8BCA8' : '#6A2232'); P(i + 2, -50, 4, 1, b2 ? '#C8BCA8' : '#6A2232');
      }
      P(-44, -55, 88, 1, '#3A1A20');
      /* the string of bulbs (lit live) */
      for (i = 0; i < 11; i++) { var bx = -40 + i * 8; P(bx, -49 + ((i & 1) ? 1 : 0), 1, 1, '#2A2018'); }
      /* a paper lantern hanging at the right */
      P(30, -50, 1, 4, '#2A2018'); P(27, -46, 7, 8, '#C8602A'); P(28, -45, 5, 6, '#FF9A4A'); P(27, -46, 7, 1, '#2A1008'); P(27, -39, 7, 1, '#2A1008');
      P.a(0.4); P(-42, 0, 84, 3, '#000000'); P.a(1);
    }, anim: function (e, now) {
      for (var i = 0; i < 11; i++) {
        var on = still() ? 1 : 0.5 + 0.5 * Math.sin(now / 700 + i * 1.7);
        Q(-40 + i * 8, -48 + ((i & 1) ? 1 : 0), 1, 2, on > 0.35 ? (i % 3 ? '#FFE2A0' : '#FF9AC8') : '#6A5A40');
      }
    }, light: function () { return { r: 58, col: '#FFB45E', glow: 0.24, flicker: true }; } },

    /* the bus shelter: glass, a lit advert, a bench inside */
    shelter: { w: 52, h: 46, ax: 26, ay: 30, paint: function (P) {
      /* roof */
      P(-25, -42, 50, 4, '#0A0A10'); P(-24, -42, 48, 1, '#4A5060'); P(-24, -41, 48, 2, '#2A2E3A');
      /* back panel glass */
      P(-24, -38, 48, 36, '#0A0A10');
      P(-23, -37, 46, 34, '#1A2638');
      P.a(0.5); P(-21, -35, 2, 30, '#5A7A9A'); P(-6, -35, 1, 30, '#5A7A9A'); P.a(1);
      /* the advert, lit (a cat food advert; the cat on it is smug) */
      P(4, -36, 18, 26, '#0A0A10'); P(5, -35, 16, 24, '#CFE4F2');
      P(6, -34, 14, 8, '#7FB8D8'); P(9, -30, 6, 4, '#1A1A22'); P(9, -31, 1, 1, '#1A1A22'); P(14, -31, 1, 1, '#1A1A22'); P(10, -29, 1, 1, '#E8E070'); P(13, -29, 1, 1, '#E8E070');
      P(7, -23, 12, 2, '#3A4A7A'); P(7, -19, 8, 1, '#5A6A8A'); P(7, -17, 10, 1, '#5A6A8A');
      /* frame posts */
      P(-25, -38, 2, 38, '#2A2E3A'); P(23, -38, 2, 38, '#2A2E3A'); P(-1, -38, 2, 36, '#2A2E3A');
      /* the bench inside */
      P(-20, -10, 22, 3, '#4A505E'); P(-20, -10, 22, 1, '#6A7080'); P(-18, -7, 2, 7, '#1A1E28'); P(-2, -7, 2, 7, '#1A1E28');
      P.a(0.35); P(-25, 0, 50, 4, '#000000'); P.a(1);
    } },
    busstop: { w: 16, h: 52, ax: 8, ay: 50, paint: function (P) {
      P.a(0.4); fillEll(P, 0, -1, 5, 2, '#000000'); P.a(1);
      P(-1, -40, 2, 40, '#0A0A10'); P(0, -40, 1, 40, '#5A6070');
      fillEll(P, 0, -42, 6, 6, '#0A0A10'); fillEll(P, 0, -42, 5, 5, '#2E6AB8'); fillEll(P, 0, -42, 3, 3, '#E8ECF2');
      P(-1, -44, 2, 4, '#2E6AB8');
      P(-5, -32, 10, 12, '#0A0A10'); P(-4, -31, 8, 10, '#D8D0C0');
      /* the timetable: a drawing of a bus, carefully coloured in */
      P(-3, -29, 6, 3, '#E4C46A'); P(-3, -26, 1, 1, '#1A1A22'); P(2, -26, 1, 1, '#1A1A22'); P(-2, -28, 1, 1, '#7FB8D8'); P(0, -28, 1, 1, '#7FB8D8');
      P(-3, -24, 6, 1, '#8A8598'); P(-3, -22, 4, 1, '#8A8598');
    } },
    bench: { w: 52, h: 26, ax: 26, ay: 22, paint: function (P) {
      P.a(0.4); P(-23, -1, 46, 3, '#000000'); P.a(1);
      P(-22, -14, 44, 2, '#0A0806'); P(-21, -14, 42, 1, '#7A5236');
      P(-22, -11, 44, 2, '#0A0806'); P(-21, -11, 42, 1, '#6A4A30');
      P(-22, -7, 44, 4, '#0A0806'); P(-21, -7, 42, 2, '#8A6038'); P(-21, -5, 42, 1, '#5A3A22');
      P(-20, -14, 2, 14, '#1A1A22'); P(18, -14, 2, 14, '#1A1A22'); P(-20, -14, 1, 14, '#3A3A48'); P(18, -14, 1, 14, '#3A3A48');
    } },
    /* the cat, asleep on the bench — and it is the same cat in the alley */
    cat: { w: 20, h: 14, ax: 10, ay: 12, paint: function (P) {
      P(-5, -8, 10, 4, '#07070A'); P(-6, -7, 12, 3, '#07070A'); P(-4, -9, 7, 1, '#07070A');
      P(3, -10, 4, 3, '#07070A'); P(3, -11, 1, 1, '#07070A'); P(6, -11, 1, 1, '#07070A');
      P(-4, -9, 5, 1, '#1E1A26');
      P(4, -9, 1, 1, '#2A2632'); P(6, -9, 1, 1, '#2A2632');
    }, anim: function (e, now) {
      /* the tail flicks, now and then; breathing, always */
      var flick = !still() && (now % 5200) < 400;
      Q(-8, flick ? -9 : -6, 3, 1, '#07070A'); Q(-9, flick ? -10 : -5, 1, 1, '#07070A');
      var br = still() ? 0 : ((now / 900) | 0) & 1;
      Q(-4, -9 - br, 6, 1, '#07070A');
      if (e.awake) { var bl = !still() && (now % 4100) < 140; Q(4, -9, 1, 1, bl ? '#07070A' : '#E8E070'); Q(6, -9, 1, 1, bl ? '#07070A' : '#E8E070'); }
    } },
    planter: { w: 20, h: 26, ax: 10, ay: 22, paint: function (P) {
      P.a(0.4); fillEll(P, 0, -1, 8, 2, '#000000'); P.a(1);
      P(-7, -9, 14, 9, '#0A0910'); P(-6, -8, 12, 7, '#3A3848'); P(-6, -8, 12, 1, '#55526A');
      fillEll(P, 0, -13, 8, 6, '#0E1A12'); fillEll(P, 0, -14, 7, 5, '#1E3A26');
      P(-4, -17, 3, 2, '#2E5A36'); P(1, -15, 3, 2, '#2E5A36'); P(-2, -12, 2, 1, '#2E5A36');
      P(-3, -16, 1, 1, '#C85A8A'); P(3, -13, 1, 1, '#C85A8A'); P(0, -18, 1, 1, '#E8E070');
    } },
    bin: { w: 14, h: 22, ax: 7, ay: 18, paint: function (P) {
      P.a(0.4); fillEll(P, 0, -1, 6, 2, '#000000'); P.a(1);
      P(-5, -14, 10, 14, '#0A0A10'); P(-4, -13, 8, 12, '#2E3442');
      for (var i = -3; i < 4; i += 2) P(i, -12, 1, 10, '#222834');
      P(-6, -16, 12, 3, '#0A0A10'); P(-5, -16, 10, 1, '#5A6070');
      P(-2, -18, 3, 2, '#C8C0B0'); P(1, -17, 2, 1, '#6A8A5A');
    } },
    hydrant: { w: 12, h: 16, ax: 6, ay: 14, paint: function (P) {
      P.a(0.4); fillEll(P, 0, -1, 4, 1, '#000000'); P.a(1);
      P(-3, -10, 6, 10, '#3A0E14'); P(-2, -10, 4, 10, '#9A2A2A'); P(-1, -10, 1, 10, '#C84A3A');
      P(-4, -7, 8, 2, '#7A1E22'); P(-3, -12, 6, 2, '#7A1E22'); P(-1, -13, 2, 1, '#C84A3A');
      P(-4, -2, 8, 2, '#3A0E14');
    } },
    axe: { w: 1, h: 1, ax: 0, ay: 0, paint: function () {}, sheet: 'axe', lift: 14 },

    /* ── the alley ── */
    dumpster: { w: 36, h: 32, ax: 8, ay: 28, paint: function (P) {
      P.a(0.45); P(-8, -1, 32, 3, '#000000'); P.a(1);
      P(-8, -22, 32, 22, '#0A0C0A');
      P(-7, -21, 30, 20, '#2A4A36'); P(-7, -21, 30, 1, '#3E6A4E');
      for (var i = -5; i < 22; i += 6) P(i, -18, 1, 15, '#1E3628');
      P(-8, -26, 32, 5, '#0A0C0A'); P(-7, -26, 30, 3, '#3A5A44'); P(-7, -26, 30, 1, '#5A8A66');
      P(-2, -14, 10, 4, '#C8C0A8'); P(-1, -13, 8, 1, '#7A2A2A');
      P(2, -10, 4, 2, '#B892FF');
      P(-9, -3, 3, 3, '#07070A'); P(21, -3, 3, 3, '#07070A');
    } },
    crates: { w: 20, h: 30, ax: 10, ay: 26, paint: function (P) {
      P.a(0.4); P(-9, -1, 18, 3, '#000000'); P.a(1);
      function crate(x, y, s) {
        P(x, y, s, s, '#1A100A'); P(x + 1, y + 1, s - 2, s - 2, '#6A4A2E'); P(x + 1, y + 1, s - 2, 1, '#8A6A42');
        for (var i = 2; i < s - 2; i++) P(x + i, y + i, 1, 1, '#4A3220');
        P(x + 1, y + (s >> 1), s - 2, 1, '#4A3220');
      }
      crate(-8, -14, 16); crate(-6, -25, 12);
    } },
    pallets: { w: 22, h: 24, ax: 11, ay: 20, paint: function (P) {
      P.a(0.4); P(-10, -1, 20, 3, '#000000'); P.a(1);
      for (var i = 0; i < 4; i++) { P(-9, -4 - i * 4, 18, 3, '#1A120A'); P(-8, -4 - i * 4, 16, 2, i & 1 ? '#7A5A38' : '#6A4A2E'); }
      P(-9, -18, 18, 1, '#8A6A42');
    } },
    bags: { w: 52, h: 22, ax: 24, ay: 18, paint: function (P) {
      P.a(0.4); P(-24, -1, 48, 3, '#000000'); P.a(1);
      var B = [[-20, 9], [-8, 11], [6, 10], [16, 8]];
      for (var i = 0; i < B.length; i++) {
        var x = B[i][0], r = B[i][1] >> 1;
        fillEll(P, x + r, -r - 1, r + 1, r, '#07070A');
        fillEll(P, x + r, -r - 1, r, r - 1, '#1A1A22');
        P(x + r - 2, -r * 2 + 1, 3, 1, '#3A3A4A'); P(x + r, -r * 2 - 1, 1, 2, '#07070A');
      }
      P(-2, -6, 6, 4, '#C8A04A'); P(-1, -5, 4, 1, '#8A5A2A');
    } },
    barrel: { w: 16, h: 22, ax: 8, ay: 18, paint: function (P) {
      P.a(0.4); fillEll(P, 0, -1, 7, 2, '#000000'); P.a(1);
      P(-6, -14, 12, 14, '#0A0A10'); P(-5, -13, 10, 12, '#3A2A3A'); P(-5, -10, 10, 1, '#1A141A'); P(-5, -4, 10, 1, '#1A141A');
      fillEll(P, 0, -14, 6, 2, '#0A0A10'); fillEll(P, 0, -14, 5, 1, '#2A2028');
      P(-3, -9, 2, 4, '#5A4A5A');
    } },
    bulb: { w: 1, h: 1, ax: 0, ay: 0, paint: function () {},
            light: function () { return { r: 54, col: '#FFD890', glow: 0.24, flicker: true }; } },
    neonglow: { w: 1, h: 1, ax: 0, ay: 0, paint: function () {},
            light: function () { return { r: 46, col: '#B892FF', glow: 0.16 }; } },
    neonpink: { w: 1, h: 1, ax: 0, ay: 0, paint: function () {},
            light: function () { return { r: 40, col: '#FF6BD6', glow: 0.14 }; } },
    none: { w: 1, h: 1, ax: 0, ay: 0, paint: function () {} },

    /* ── the square ── */
    fountain: { w: 96, h: 104, ax: 48, ay: 72, paint: function (P) {
      var i;
      /* the basin: stepped stone ellipses, dry, leaves in the bottom */
      fillEll(P, 0, -32, 42, 27, '#07070C');
      fillEll(P, 0, -33, 41, 26, '#4A4658');
      fillEll(P, 0, -34, 39, 24, '#5E5A70');
      fillEll(P, 0, -35, 35, 21, '#2A2834');
      fillEll(P, 0, -34, 34, 19, '#1E1C26');
      /* where the water used to stand: a tide line, moss, a crack */
      fillEll(P, 0, -31, 30, 14, '#22202A');
      for (i = 0; i < 70; i++) {
        var ta = i / 70 * Math.PI * 2;
        P(Math.round(Math.cos(ta) * 30), -31 + Math.round(Math.sin(ta) * 14), 1, 1, i % 4 ? '#3A3846' : '#2E4A36');
      }
      for (i = 0; i < 10; i++) P(18 + i, -38 + ((i * 7) % 3) + (i >> 1), 1, 1, '#0E0D14');
      for (i = 0; i < 18; i++) P(-26 + ((hash(i * 3) * 52) | 0), -44 + ((hash(i * 7) * 22) | 0), 2, 1, i % 3 ? '#4A3424' : '#6A4A2A');
      /* the upper bowl, on the pedestal, also dry */
      fillEll(P, 0, -50, 13, 5, '#07070C'); fillEll(P, 0, -51, 12, 4, '#5E5A70'); fillEll(P, 0, -51, 10, 3, '#2A2834');
      P(-12, -49, 25, 1, '#3E3A50');
      /* the lip's highlight and its near face */
      for (i = -40; i <= 40; i++) {
        var k = 1 - (i * i) / (41 * 41), yy = Math.round(26 * Math.sqrt(Math.max(0, k)));
        P(i, -33 + yy, 1, 4, '#33303E');
        P(i, -33 + yy, 1, 1, '#6A667C');
      }
      /* the pedestal and the statue: a figure with a raised fist, very sure */
      P(-8, -42, 16, 10, '#07070C'); P(-7, -42, 14, 9, '#4E4A60'); P(-7, -42, 14, 1, '#6E6A84');
      P(-5, -46, 10, 4, '#3E3A50'); P(-5, -46, 10, 1, '#5E5A74');
      P(-4, -64, 8, 18, '#07070C'); P(-3, -63, 6, 17, '#5A566E'); P(-3, -63, 2, 17, '#6E6A86');
      P(-2, -70, 5, 6, '#07070C'); P(-1, -69, 3, 4, '#6E6A86');
      P(2, -76, 3, 12, '#07070C'); P(3, -75, 1, 10, '#6E6A86'); P(2, -79, 4, 4, '#07070C'); P(3, -78, 2, 2, '#7E7A96');
      P(-6, -60, 3, 8, '#07070C'); P(-5, -59, 1, 6, '#5A566E');
      P(-3, -48, 2, 2, '#07070C'); P(1, -48, 2, 2, '#07070C');
      /* a plaque on the near face */
      P(-6, -12, 12, 5, '#07070C'); P(-5, -11, 10, 3, '#8A7A4A'); P(-4, -10, 8, 1, '#C8A04A');
      /* a single coin, which is the whole of the wishing */
      P(12, -40, 2, 1, '#C8A04A');
    }, light: function () { return null; } },
    tree: { w: 44, h: 66, ax: 22, ay: 62, paint: function (P) {
      P.a(0.45); fillEll(P, 0, -1, 12, 3, '#000000'); P.a(1);
      P(-8, -8, 16, 8, '#07070C'); P(-7, -7, 14, 6, '#3A3848'); P(-7, -7, 14, 1, '#56546A');
      P(-1, -26, 3, 19, '#1A120E'); P(0, -26, 1, 19, '#3A2A20'); P(-4, -30, 2, 6, '#1A120E'); P(3, -32, 2, 7, '#1A120E');
      fillEll(P, 0, -36, 18, 14, '#0A120E');
      fillEll(P, -7, -40, 10, 9, '#0A120E'); fillEll(P, 8, -42, 9, 8, '#0A120E');
      fillEll(P, 0, -36, 17, 13, '#182A20');
      fillEll(P, -7, -40, 9, 8, '#1E3426'); fillEll(P, 8, -42, 8, 7, '#1E3426');
      fillEll(P, -5, -43, 7, 5, '#26422E'); fillEll(P, 7, -46, 5, 3, '#2A4A34'); fillEll(P, 2, -33, 8, 5, '#22392A');
      for (var i = 0; i < 22; i++) P(-15 + ((hash(i * 5) * 30) | 0), -50 + ((hash(i * 9) * 24) | 0), 2, 1, i % 5 ? '#3A6446' : '#6A4A2A');
      P.a(0.5); fillEll(P, 2, -27, 14, 4, '#07070C'); P.a(1);
      P(-1, -26, 3, 19, '#1A120E'); P(0, -26, 1, 19, '#3A2A20');
    } },
    birdsign: { w: 18, h: 30, ax: 9, ay: 26, paint: function (P) {
      P.a(0.4); fillEll(P, 0, -1, 4, 1, '#000000'); P.a(1);
      P(-1, -16, 2, 16, '#1A1A22'); P(0, -16, 1, 16, '#4A4A5A');
      P(-7, -24, 14, 10, '#0A0A10'); P(-6, -23, 12, 8, '#E8E0D0');
      /* a bird with a line through it */
      P(-3, -20, 4, 2, '#3A3A4A'); P(1, -21, 2, 1, '#3A3A4A'); P(-4, -21, 1, 1, '#3A3A4A');
      for (var i = 0; i < 8; i++) P(-4 + i, -22 + ((i * 6 / 8) | 0), 1, 1, '#C2405F');
    } },
    chalk: { w: 1, h: 1, ax: 0, ay: 0, paint: function () {},
             light: function () { return (has('recall') && !flagged('used_recall')) ? { r: 32, col: '#B892FF', glow: 0.2 } : null; } },

    /* ── New Home ── */
    gclock: { w: 20, h: 56, ax: 10, ay: 52, paint: function (P) {
      P.a(0.4); P(-8, -1, 16, 3, '#000000'); P.a(1);
      P(-7, -48, 14, 48, '#0A0A0C'); P(-6, -47, 12, 46, '#2E2E36'); P(-6, -47, 1, 46, '#3E3E48');
      P(-8, -50, 16, 4, '#0A0A0C'); P(-7, -50, 14, 2, '#3A3A42');
      fillEll(P, 0, -40, 5, 5, '#0A0A0C'); fillEll(P, 0, -40, 4, 4, '#C8C2B4');
      P(-4, -32, 8, 26, '#141418'); P(-3, -31, 6, 24, '#1A1A20');
      P(-7, -4, 14, 4, '#22222A');
    }, anim: function (e, now) {
      var v = e.n || 1, mv = !still(), a;
      /* the face: e1 says ten past three; e2 runs backwards; e3 has no hands */
      if (v === 1) { hand(0, -40, 3 / 12 * Math.PI * 2 - Math.PI / 2 + 0.05, 2, '#1A1A20'); hand(0, -40, 10 / 60 * Math.PI * 2 - Math.PI / 2, 3, '#1A1A20'); }
      if (v === 2) { a = mv ? -now / 4000 : 0; hand(0, -40, a - Math.PI / 2, 3, '#1A1A20'); hand(0, -40, a / 12 + 1.2, 2, '#1A1A20'); }
      /* the pendulum */
      var sw = mv ? Math.round(Math.sin(now / 520) * 2) : 0;
      Q(0, -30, 1, 14, '#6A6A74'); Q(-1 + sw, -17, 3, 3, '#8A8478'); Q(sw, -16, 1, 1, '#B8B0A0');
    } },
    coatstand: { w: 16, h: 44, ax: 8, ay: 40, paint: function (P) {
      P.a(0.4); fillEll(P, 0, -1, 5, 1, '#000000'); P.a(1);
      P(-4, -2, 8, 2, '#1A1A1E'); P(-1, -36, 2, 34, '#2A2A30'); P(0, -36, 1, 34, '#3E3E48');
      P(-4, -36, 8, 1, '#3E3E48'); P(-4, -37, 1, 2, '#3E3E48'); P(3, -37, 1, 2, '#3E3E48');
      /* one coat, grey, longer than it should be */
      P(-5, -34, 6, 20, '#3A3A42'); P(-5, -34, 6, 1, '#4E4E58'); P(-4, -14, 4, 3, '#3A3A42'); P(-2, -30, 1, 14, '#2A2A30');
      P(2, -33, 3, 4, '#2E2E36');
    } },
    vasetable: { w: 24, h: 36, ax: 12, ay: 32, paint: function (P) {
      P.a(0.4); P(-10, -1, 20, 3, '#000000'); P.a(1);
      P(-10, -14, 20, 3, '#0A0A0C'); P(-9, -14, 18, 2, '#3E3E48'); P(-9, -14, 18, 1, '#52525C');
      P(-8, -11, 2, 11, '#22222A'); P(6, -11, 2, 11, '#22222A');
      /* the vase, put back together: the glaze has seams */
      P(-4, -26, 8, 12, '#0A0A0C'); P(-3, -25, 6, 10, '#6A7088'); P(-2, -27, 4, 2, '#0A0A0C'); P(-1, -27, 2, 1, '#6A7088');
      P(-3, -25, 1, 10, '#8A90A8');
      P(-2, -22, 1, 1, '#2A2A30'); P(-1, -21, 1, 1, '#2A2A30'); P(0, -21, 2, 1, '#2A2A30'); P(2, -19, 1, 1, '#2A2A30');
      P(1, -24, 1, 3, '#C8C0B0');
    }, anim: function () {
      /* the new crack, once the television is breakable */
      if (flagged('tv_breakable')) { Q(-1, -18, 1, 1, '#0A0A0C'); Q(0, -17, 1, 2, '#0A0A0C'); Q(-1, -15, 1, 1, '#0A0A0C'); }
    } },
    chair: { w: 16, h: 30, ax: 8, ay: 26, paint: function (P) {
      P.a(0.4); P(-6, -1, 12, 2, '#000000'); P.a(1);
      P(-5, -22, 10, 3, '#0A0A0C'); P(-4, -22, 8, 2, '#3A3A42');
      P(-5, -19, 2, 19, '#2A2A30'); P(3, -19, 2, 19, '#2A2A30');
      P(-5, -10, 10, 3, '#0A0A0C'); P(-4, -10, 8, 2, '#4A4A54');
      P(-4, -7, 1, 7, '#22222A'); P(3, -7, 1, 7, '#22222A');
      P(-3, -17, 6, 1, '#2A2A30'); P(-3, -14, 6, 1, '#2A2A30');
    } },
    pot: { w: 18, h: 30, ax: 9, ay: 26, paint: function (P) {
      P.a(0.4); fillEll(P, 0, -1, 6, 1, '#000000'); P.a(1);
      P(-5, -9, 10, 9, '#0A0A0C'); P(-4, -8, 8, 7, '#3A3A42'); P(-5, -9, 10, 2, '#4A4A54');
      P(-1, -16, 1, 7, '#2A3A2E'); P(-5, -20, 4, 6, '#2A3A2E'); P(1, -22, 4, 8, '#2A3A2E'); P(-3, -24, 3, 6, '#34463A');
      P(-4, -19, 2, 1, '#3E5244'); P(2, -21, 2, 1, '#3E5244');
    } },
    sconce: { w: 1, h: 1, ax: 0, ay: 0, paint: function () {},
              light: function (e, d) {
                if (e.flick && !still()) {
                  /* e3's sconce: a slow brown-out, then back — about once every five seconds */
                  var t = (d && d.now ? d.now : 0) % 5200;
                  if (t < 260) return { r: 16, col: '#E0DCD0', glow: 0.04 };
                }
                return { r: 34, col: '#E0DCD0', glow: 0.08 };
              } },
    moon: { w: 1, h: 1, ax: 0, ay: 0, paint: function () {},
            light: function () { return { r: 40, col: '#A8B8E0', glow: 0.1 }; } },
    goldlight: { w: 1, h: 1, ax: 0, ay: 0, paint: function () {},
            light: function () { return { r: 62, col: '#FFC86A', glow: 0.16 }; } }
  };

  function sprite(e) {
    var p = PROPS[e.v];
    if (!p) return null;
    return bake('prop:' + e.v, p.w + 2, p.h + 2, p.ax + 1, p.ay + 1, p.paint);
  }

  KK.kind('cityprop', {
    interactive: function (e) { return typeof e.run === 'function' || !!e.lines; },
    fire: function (e, sys) {
      if (typeof e.run === 'function') { e.run(sys.api); return; }
      /* lines talk exactly like an npc: same resume, same textbox guard */
      var N = KK.all && KK.all.npc;
      if (e.lines && N && N.fire) N.fire(e, sys);
    },
    draw: function (g, e, d) {
      var p = PROPS[e.v];
      if (!p) {
        /* missing art is LOUD */
        g.fillStyle = '#FF00A0'; g.fillRect(d.sx - 4 * d.S, d.sy - 8 * d.S, 8 * d.S, 8 * d.S);
        return;
      }
      if (p.sheet) {
        var sh = NEU.sheets && NEU.sheets[p.sheet];
        if (sh && NEU.sheetDraw) {
          var lift = p.lift * d.S;
          NEU.sheetDraw(g, p.sheet, d.sx, d.sy - lift, { scale: Math.max(1, Math.round(d.S / 3)), anchor: 'feet', now: d.now });
          /* a glint that runs along the blade every few seconds */
          if (!still() && (d.now % 3600) < 300) {
            var k = (d.now % 3600) / 300;
            g.fillStyle = '#FFFFFF';
            g.fillRect(d.sx + Math.round((-6 + k * 12) * d.S), d.sy - lift - Math.round((9 + k * 2) * d.S), d.S, d.S);
          }
        }
        return;
      }
      /* e.dx / e.dy (world units) seat a prop off its cell: the cat on the lid */
      var X = d.sx + (e.dx || 0) * d.S, Y = d.sy - (e.dy || 0) * d.S;
      var s = sprite(e);
      if (s) blit(g, s, X, Y, d.S);
      if (p.anim) { qset(g, X, Y, d.S); p.anim(e, d.now); }
    },
    width: function () { return 0; },
    light: function (e, d) { var p = PROPS[e.v]; return p && p.light ? p.light(e, d) : null; }
  });

  NEU.lookCity = { rooms: ROOMS, props: PROPS, roomArt: roomArt, _cache: cache };
})();
