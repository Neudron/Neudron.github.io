/* look-savanna.js — dusk savanna: sand dunes, packed earth, earth banks,
   acacia / baobab / huts against a goth-purple sky.
   Rooms stay data in rooms-s.js. This file only draws them.
   savannafloor bakes a whole room ONCE (with a margin of sky and cliff
   around it) and blits only the visible crop each frame.
   savannaprop stands in it (every prop is a cached sprite with an ink
   outline and a long dusk shadow). savannafx is world-space dusk grade,
   heat haze and wind; under reduced motion it holds still. An unknown
   prop is a magenta box. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var KK = NEU.engineKinds;
  if (!KK) return;

  var T = 16, MX = 6, MY = 4;
  var INK = '#12081E';
  var paints = {};
  var C = {
    sd0: '#6A4A20', sd1: '#8A6430', sd2: '#B08440', sd3: '#C89A4A', sd4: '#E2B84A', sd5: '#F0D48A',
    e0: '#4A2A14', e1: '#6A3A1C', e2: '#8A4A24', e3: '#A85E2C', e4: '#C47A32', e5: '#D8925A',
    g0: '#3A3A14', g1: '#5A5A1E', g2: '#7A7A2A', g3: '#A89A3A', g4: '#C8B44A', g5: '#E6D27A',
    b0: '#2A1A0C', b1: '#3A2410', b2: '#5C3A18', b3: '#8A5A28', b4: '#A87038', b5: '#C8904A',
    k0: '#1A1020', k1: '#4A2A4A', k2: '#A8506A', k3: '#E89060', k4: '#F8C890',
    /* golden-hour ground materials. stepped, never an alpha gradient */
    r0: '#5A2A12', r1: '#8A3A18', r2: '#B05424', r3: '#D07634', r4: '#E89850',
    m0: '#3A3A2A', m1: '#5A5640', m2: '#7A7454', m3: '#9A9068', m4: '#B8AE84',
    s0: '#3A3428', s1: '#5A5240', s2: '#7A7058', s3: '#9A8E70', s4: '#B8AC8C',
    dg0: '#6A4A18', dg1: '#8A6A2A', dg2: '#A8853A', dg3: '#C8A34A',
    sun: '#FFD9A0'
  };

  function A() { return NEU.roomArt; }
  function L() { return NEU.engineLook; }
  function still() { var l = L(); return !l || !!l.reduced; }
  function roomOf(d) {
    if (d && d.room && d.room.grid) return d.room;
    return (d && d.api && d.api.room) || null;
  }
  function mk(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, w | 0);
    c.height = Math.max(1, h | 0);
    return c;
  }
  function hs(x, y, s) {
    var h = (x * 374761393 + y * 668265263 + (s || 0) * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function rc(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  /* value noise over `per` px, 0..amp, integer */
  function wave(px, seed, per, amp) {
    var i = Math.floor(px / per), f = (px - i * per) / per;
    var a = hs(i, 0, seed), b = hs(i + 1, 0, seed);
    return Math.round((a + (b - a) * (f * f * (3 - 2 * f))) * amp);
  }
  function tk(room, x, y) {
    if (x < 0 || y < 0 || y >= room.h) return ' ';
    var r = room.grid[y];
    if (!r || x >= r.length) return ' ';
    return r.charAt(x);
  }
  function isPath(ch) { return ch === ',' || ch === '='; }
  function isFloor(ch) { return ch === '.' || ch === ',' || ch === '=' || ch === 'd' || ch === 'r' || ch === 'm' || ch === 's'; }
  /* room.sites is authored in rooms-s.js. One lookup per baked tile. */
  function siteAt(room, x, y) {
    var z = (room && room.sites) || [], i, s;
    for (i = 0; i < z.length; i++) {
      s = z[i];
      if (x >= s.x0 && x < s.x0 + s.w && y >= s.y0 && y < s.y0 + s.h) return s;
    }
    return null;
  }

  /* ── bake helpers ─────────────────────────────────────────────── */
  /* 2px checker cells along one edge of a tile: the dither between two tones */
  function dither(g, px, py, dir, col, depth) {
    var i, r;
    g.fillStyle = col;
    for (r = 0; r < depth; r++) {
      for (i = 0; i < 8; i++) {
        if (((i + r) & 1) !== 0) continue;
        if (dir === 0) g.fillRect(px + i * 2, py + r * 2, 2, 2);
        else if (dir === 1) g.fillRect(px + T - 2 - r * 2, py + i * 2, 2, 2);
        else if (dir === 2) g.fillRect(px + i * 2, py + T - 2 - r * 2, 2, 2);
        else g.fillRect(px + r * 2, py + i * 2, 2, 2);
      }
    }
  }
  function tuft(g, x, y, k) {
    var h = 4 + (k > 0.5 ? 2 : 0);
    rc(g, x, y + 5, 5, 1, C.g0);
    rc(g, x + 2, y + 6 - h, 1, h, C.g2);
    rc(g, x, y + 3, 1, 3, C.g1);
    rc(g, x + 4, y + 2, 1, 4, C.g1);
    rc(g, x + 1, y + 4, 1, 1, C.g2);
    rc(g, x + 3, y + 3, 1, 2, C.g3);
    rc(g, x + 2, y + 6 - h, 1, 1, C.g5);
    rc(g, x, y + 3, 1, 1, C.g3);
    rc(g, x + 4, y + 2, 1, 1, C.g4);
  }
  function sandTone(room, x, y) {
    return hs(x, y, 7) < 0.14 ? 1 : 0;
  }
  function baseOf(room, x, y) {
    var ch = tk(room, x, y), s = siteAt(room, x, y), m = s ? s.mat : 'd';
    if (isPath(ch)) return C.e4;
    if (m === 'r') return C.r2;
    if (m === 'm') return C.m2;
    if (m === 's') return C.s2;
    if (m === 'd') return C.dg1;
    return sandTone(room, x, y) ? C.sd3 : C.sd4;
  }
  /* painted colour of a neighbouring FLOOR tile, read from its tile char;
     null for a wall or void. dryGrassTile dithers its edges against this. */
  function matOf(room, x, y) {
    var ch = tk(room, x, y);
    if (isPath(ch)) return C.e4;
    if (ch === 'r') return C.r2;
    if (ch === 'm') return C.m2;
    if (ch === 's') return C.s2;
    if (ch === 'd') return C.dg1;
    if (ch === '.') return sandTone(room, x, y) ? C.sd3 : C.sd4;
    return null;
  }

  function sandTile(g, room, x, y, px, py) {
    var tone = sandTone(room, x, y), i, n, yy, xx, col, k;
    rc(g, px, py, T, T, tone ? C.sd3 : C.sd4);
    n = 2 + (hs(x, y, 1) < 0.5 ? 1 : 0);
    col = tone ? C.sd2 : C.sd3;
    for (i = 0; i < n; i++) {
      yy = 2 + ((hs(x, y, 10 + i) * 11) | 0);
      xx = (hs(x, y, 20 + i) * 4) | 0;
      rc(g, px + xx, py + yy, 4, 1, col);
      rc(g, px + xx + 4, py + yy + 1, 4, 1, col);
      rc(g, px + xx + 8, py + yy, 4, 1, col);
      if (!tone) rc(g, px + xx + 1, py + yy - 1, 3, 1, C.sd5);
    }
    for (i = 0; i < 3; i++) {
      k = hs(x, y, 40 + i);
      if (k < 0.07) rc(g, px + ((hs(x, y, 50 + i) * 15) | 0), py + ((hs(x, y, 60 + i) * 15) | 0), 1, 1, C.sd5);
      else if (k < 0.14) rc(g, px + ((hs(x, y, 50 + i) * 15) | 0), py + ((hs(x, y, 60 + i) * 15) | 0), 1, 1, tone ? C.sd1 : C.sd2);
    }
  }
  function pathTile(g, room, x, y, px, py) {
    var hz = isPath(tk(room, x - 1, y)) || isPath(tk(room, x + 1, y));
    var vt = isPath(tk(room, x, y - 1)) || isPath(tk(room, x, y + 1));
    var i, bx, by;
    rc(g, px, py, T, T, C.e4);
    for (i = 0; i < 3; i++) {
      if (hs(x, y, 70 + i) < 0.6) rc(g, px + ((hs(x, y, 80 + i) * 11) | 0), py + ((hs(x, y, 90 + i) * 14) | 0), 4, 2, C.e3);
    }
    if (hz || !vt) {
      rc(g, px, py + 4, T, 2, C.e2); rc(g, px, py + 10, T, 2, C.e2);
      for (i = 0; i < 8; i++) if (((x + i) % 3) === 0) { rc(g, px + i * 2, py + 6, 1, 1, C.e5); rc(g, px + i * 2, py + 12, 1, 1, C.e5); }
    } else {
      rc(g, px + 4, py, 2, T, C.e2); rc(g, px + 10, py, 2, T, C.e2);
      for (i = 0; i < 8; i++) if (((y + i) % 3) === 0) { rc(g, px + 6, py + i * 2, 1, 1, C.e5); rc(g, px + 12, py + i * 2, 1, 1, C.e5); }
    }
    for (i = 0; i < 3; i++) {
      if (hs(x, y, 100 + i) < 0.45) {
        bx = px + ((hs(x, y, 110 + i) * 13) | 0); by = py + ((hs(x, y, 120 + i) * 14) | 0);
        rc(g, bx, by, 2, 1, C.e1); rc(g, bx, by - 1, 1, 1, C.e5);
      }
    }
  }
  function speckle(g, room, x, y, px, py, a, b, n, seed) {
    var i, k;
    for (i = 0; i < n; i++) {
      k = hs(x, y, seed + i);
      rc(g, px + ((hs(x, y, seed + 20 + i) * 15) | 0),
         py + ((hs(x, y, seed + 40 + i) * 15) | 0),
         1 + (k > 0.82 ? 1 : 0), 1, k < 0.5 ? a : b);
    }
  }
  /* dry grass over packed earth: two grass tones, a stone and a footprint
     every few tiles. Never one flat fill. */
  function dryGrassTile(g, room, x, y, px, py) {
    var tone = hs(x, y, 900) < 0.3, i, fx, fy, nx, ny, col;
    rc(g, px, py, T, T, tone ? C.dg0 : C.dg1);
    for (i = 0; i < 3; i++) rc(g,
      px + ((hs(x, y, 910 + i) * 12) | 0), py + ((hs(x, y, 920 + i) * 12) | 0),
      3 + ((hs(x, y, 930 + i) * 3) | 0), 1, i & 1 ? C.dg2 : C.dg3);
    if ((x + y) % 2 === 0) tuft(g, px + 2 + ((hs(x, y, 940) * 7) | 0), py + 7, hs(x, y, 941));
    if (hs(x, y, 950) < 0.22) {
      fx = px + ((hs(x, y, 951) * 11) | 0); fy = py + ((hs(x, y, 952) * 11) | 0);
      rc(g, fx, fy, 3, 2, C.s2); rc(g, fx, fy, 2, 1, C.s3);
    }
    if ((x * 3 + y) % 5 === 0) {
      fx = px + ((hs(x, y, 960) * 10) | 0); fy = py + ((hs(x, y, 961) * 10) | 0);
      rc(g, fx, fy, 2, 1, C.e0); rc(g, fx + 3, fy + 1, 2, 1, C.e0);
    }
    speckle(g, room, x, y, px, py, C.g0, C.g3, 3, 970);
    /* ragged seam: dither the two-tile band where this patch meets another
       floor material. Paint only — tile data, spawns and collision untouched. */
    for (i = 0; i < 4; i++) {
      nx = i === 1 ? 1 : i === 3 ? -1 : 0;
      ny = i === 2 ? 1 : i === 0 ? -1 : 0;
      col = matOf(room, x + nx, y + ny);
      if (col === C.dg1) {
        col = matOf(room, x + nx * 2, y + ny * 2);
        if (col && col !== C.dg1) dither(g, px, py, i, col, 2);
      } else if (col) {
        dither(g, px, py, i, col, 4);
      }
    }
  }
  /* red laterite: stepped patches, hairline cracks, warm east-facing rim */
  function lateriteTile(g, room, x, y, px, py) {
    var tone = hs(x, y, 1000) < 0.42, i, fx, fy;
    rc(g, px, py, T, T, tone ? C.r1 : C.r2);
    for (i = 0; i < 3; i++) {
      fx = px + ((hs(x, y, 1010 + i) * 11) | 0); fy = py + ((hs(x, y, 1020 + i) * 12) | 0);
      rc(g, fx, fy, 4, 2, i === 1 ? C.r3 : C.r0);
      if (i === 1) rc(g, fx, fy, 3, 1, C.r4);
    }
    if ((x + y) % 3 === 0) {
      fx = px + ((hs(x, y, 1030) * 11) | 0); fy = py + ((hs(x, y, 1031) * 11) | 0);
      rc(g, fx, fy, 5, 1, C.r0); rc(g, fx + 4, fy + 1, 1, 2, C.r0);
    }
    if (hs(x, y, 1040) < 0.2) tuft(g, px + 4, py + 8, hs(x, y, 1041));
    speckle(g, room, x, y, px, py, C.r0, C.r3, 4, 1050);
  }
  /* cracked mud near the waterhole: stepped panels, dark seams, reeds */
  function mudTile(g, room, x, y, px, py) {
    var tone = hs(x, y, 1100) < 0.35, i, fx, fy;
    rc(g, px, py, T, T, tone ? C.m1 : C.m2);
    rc(g, px + 2, py + 2, 6, 5, C.m3);
    rc(g, px + 9, py + 8, 5, 5, tone ? C.m3 : C.m1);
    rc(g, px + 2, py + 2, 5, 1, C.m4);
    for (i = 0; i < 3; i++) {
      fx = px + ((hs(x, y, 1110 + i) * 13) | 0); fy = py + ((hs(x, y, 1120 + i) * 13) | 0);
      rc(g, fx, fy, 1 + ((hs(x, y, 1130 + i) * 4) | 0), 1, C.m0);
    }
    if ((x + y) % 3 === 0) tuft(g, px + 3 + ((hs(x, y, 1140) * 6) | 0), py + 7, hs(x, y, 1141));
    if ((x * 2 + y) % 7 === 0) {
      fx = px + ((hs(x, y, 1150) * 10) | 0); fy = py + ((hs(x, y, 1151) * 10) | 0);
      rc(g, fx, fy, 2, 1, C.m0); rc(g, fx + 3, fy + 1, 2, 1, C.m0);
    }
    speckle(g, room, x, y, px, py, C.m0, C.m4, 3, 1160);
  }
  /* stone at the station: 8px flags with grout, warm low-light highlight */
  function stoneTile(g, room, x, y, px, py) {
    var sx, sy, a;
    for (sy = 0; sy < 2; sy++) for (sx = 0; sx < 2; sx++) {
      a = (x + sx + y + sy + ((hs(x * 2 + sx, y * 2 + sy, 1200) * 3) | 0)) & 1;
      rc(g, px + sx * 8, py + sy * 8, 8, 8, a ? C.s1 : C.s2);
      rc(g, px + sx * 8, py + sy * 8 + 7, 8, 1, C.s0);
      rc(g, px + sx * 8 + 7, py + sy * 8, 1, 8, C.s0);
      rc(g, px + sx * 8, py + sy * 8, 7, 1, C.s3);
      if (hs(x * 2 + sx, y * 2 + sy, 1210) < 0.3)
        rc(g, px + sx * 8 + 2, py + sy * 8 + 3, 2, 1, C.s4);
    }
  }
  /* Natural edges. Same solid tile, different silhouette: rock strata,
     thorn tangles, a dry-river bank, tall grass, or the kraal's one fence. */
  function edgeOverlay(g, px, py, edge, x, y) {
    var i, fx, fy;
    if (edge === 'rock') {
      for (i = 0; i < 3; i++) {
        fx = px + ((hs(x, y, 1300 + i) * 10) | 0); fy = py + ((hs(x, y, 1310 + i) * 11) | 0);
        rc(g, fx, fy, 6, 3, C.s1); rc(g, fx, fy, 5, 1, C.s3); rc(g, fx + 1, fy + 2, 4, 1, C.s0);
      }
      rc(g, px + 2, py + 12, 12, 1, C.s2);
    } else if (edge === 'thorn') {
      for (i = 0; i < 5; i++) {
        fx = px + 2 + ((hs(x, y, 1320 + i) * 12) | 0); fy = py + 4 + ((hs(x, y, 1330 + i) * 9) | 0);
        rc(g, fx, fy, 4, 1, C.g0); rc(g, fx + 1, fy - 2, 1, 3, C.g1); rc(g, fx + 3, fy - 1, 1, 2, C.g0);
      }
      rc(g, px + 6, py + 1, 1, 4, C.b0);
    } else if (edge === 'grass') {
      for (i = 0; i < 3; i++) tuft(g, px + 1 + i * 5, py + 6 + ((hs(x, y, 1340 + i) * 3) | 0), hs(x, y, 1350 + i));
    } else if (edge === 'fence') {
      rc(g, px + 2, py + 2, 2, 12, C.b3); rc(g, px + 2, py + 2, 1, 12, C.b5);
      rc(g, px + 9, py + 2, 2, 12, C.b2); rc(g, px + 9, py + 2, 1, 12, C.b4);
      rc(g, px, py + 5, 16, 2, C.b4); rc(g, px, py + 5, 16, 1, C.b5);
      rc(g, px, py + 11, 16, 2, C.b3);
    }
  }
  /* an earth bank. Top face, lip, strata front, drips. */
  function wallTile(g, room, x, y, px, py, edge) {
    var openS = isFloor(tk(room, x, y + 1)), openE = isFloor(tk(room, x + 1, y)), openW = isFloor(tk(room, x - 1, y));
    var topN = tk(room, x, y - 1) !== '#';
    var th = openS ? 6 : T, i, k, cx;
    rc(g, px, py, T, th, C.b4);
    for (i = 0; i < 5; i++) {
      k = hs(x, y, 130 + i);
      rc(g, px + ((hs(x, y, 140 + i) * 13) | 0), py + ((k * (th - 2)) | 0), 3, 1, k < 0.5 ? C.b3 : C.b5);
    }
    for (i = 0; i < 3; i++) rc(g, px + ((hs(x, y, 150 + i) * 14) | 0), py + 2 + ((hs(x, y, 160 + i) * (th - 4)) | 0), 1, 1, C.b2);
    if (topN) {
      rc(g, px, py, T, 2, C.b5);
      for (i = 0; i < 4; i++) rc(g, px + ((hs(x, y, 170 + i) * 14) | 0), py + 1, 2, 1, C.b4);
    }
    if (openS) {
      rc(g, px, py + 6, T, T - 6, C.b2);
      rc(g, px, py + 6, T, 1, C.b3);
      rc(g, px, py + 10, T, 1, C.b1);
      rc(g, px, py + 14, T, 1, C.b1);
      rc(g, px, py + 15, T, 1, C.b0);
      for (i = 0; i < 4; i++) {
        k = hs(x, y, 180 + i);
        rc(g, px + ((hs(x, y, 190 + i) * 12) | 0), py + 7 + ((k * 7) | 0), 3, 1, k < 0.5 ? C.b1 : C.b3);
      }
      for (i = 0; i < 3; i++) {
        cx = px + ((hs(x, y, 200 + i) * 15) | 0);
        rc(g, cx, py + 7, 1, 3 + ((hs(x, y, 210 + i) * 5) | 0), C.b0);
      }
      rc(g, px, py + 6, 1, 9, C.b3);
    }
    if (openE) {
      rc(g, px + 12, py, 4, openS ? T : T, C.b2);
      rc(g, px + 12, py, 1, T, C.b3);
      rc(g, px + 15, py, 1, T, C.b0);
      for (i = 0; i < 3; i++) rc(g, px + 12, py + 3 + i * 5, 4, 1, C.b1);
    }
    if (openW && !openS) rc(g, px, py, 2, T, C.b5);
    if (isFloor(tk(room, x, y - 1)) && !openS) {
      rc(g, px, py + T - 2, T, 2, C.b3);
      rc(g, px, py + T - 1, T, 1, C.b2);
    }
    if (edge) edgeOverlay(g, px, py, edge, x, y);
  }
  /* station: tiled floor and wall, 8x8 tiles with grout */
  function stationTile(g, room, x, y, px, py, wall) {
    var a, b, sx, sy, base, hl = wall ? ['#3A2A1C', '#4A3624'] : ['#3A2A1C', '#4A3624'];
    for (sy = 0; sy < 2; sy++) for (sx = 0; sx < 2; sx++) {
      a = (x * 2 + sx + y * 2 + sy + ((hs(x * 2 + sx, y * 2 + sy, 3) * 3) | 0)) & 1;
      base = hl[a];
      rc(g, px + sx * 8, py + sy * 8, 8, 8, base);
      rc(g, px + sx * 8, py + sy * 8 + 7, 8, 1, '#2A1A0C');
      rc(g, px + sx * 8 + 7, py + sy * 8, 1, 8, '#2A1A0C');
      rc(g, px + sx * 8, py + sy * 8, 7, 1, wall ? '#5A4030' : '#4A3624');
      if (hs(x * 2 + sx, y * 2 + sy, 9) < 0.3) rc(g, px + sx * 8 + 2 + ((hs(x, y, sx + 4) * 3) | 0), py + sy * 8 + 3, 2, 1, '#5A4030');
    }
    if (wall && isFloor(tk(room, x, y + 1))) { rc(g, px, py + 14, T, 2, '#1A1410'); }
  }

  var FONT = {
    S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
    O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#']
  };
  var SNAIL = [
    '....####....',
    '..##....##..',
    '.#..####..#.',
    '.#.#....#.#.',
    '.#.#.##.#.#.',
    '.#.#..#.#.#.',
    '.#..###..#..',
    '..##....##.#',
    '####....####'
  ];
  function glyphs(g, str, x, y, col) {
    var i, r, c, f;
    for (i = 0; i < str.length; i++) {
      f = FONT[str.charAt(i)];
      for (r = 0; r < 7; r++) for (c = 0; c < 5; c++) if (f[r].charAt(c) === '#') rc(g, x + i * 6 + c, y + r, 1, 1, col);
    }
  }
  function stationDecor(g, ox, oy) {
    var bx = ox + 7 * T + 4, by = oy + 1, i, r, c;
    /* hanging sign board */
    rc(g, bx + 6, by, 1, 2, '#12081E'); rc(g, bx + 38, by, 1, 2, '#12081E');
    rc(g, bx, by + 2, 46, 12, '#12081E');
    rc(g, bx + 1, by + 3, 44, 10, '#3A2414');
    rc(g, bx + 1, by + 3, 44, 1, '#5A3418');
    rc(g, bx + 1, by + 12, 44, 1, '#2A1A0C');
    glyphs(g, 'STATION', bx + 2, by + 5, '#2A1A0C');
    glyphs(g, 'STATION', bx + 2 + 0, by + 4, '#C8A040');
    /* snail emblem */
    for (r = 0; r < SNAIL.length; r++) for (c = 0; c < 12; c++) if (SNAIL[r].charAt(c) === '#') rc(g, ox + 2 * T + 2 + c, oy + 3 + r, 1, 1, '#C47A32');
    for (c = 0; c < 4; c++) rc(g, ox + 2 * T + 2 + 10, oy + 3 + 5 - (c > 1 ? 1 : 0), 1, 1, '#C47A32');
    /* bench */
    var bn = ox + 8 * T - 4, bb = oy + 3 * T + 4;
    rc(g, bn, bb + 8, 36, 3, 'rgba(0,0,0,0)');
    rc(g, bn + 2, bb, 32, 3, '#8A5A28');
    rc(g, bn + 2, bb, 32, 1, '#A87038');
    rc(g, bn + 2, bb + 3, 32, 2, '#5C3A18');
    rc(g, bn + 4, bb + 5, 3, 6, '#3A2410'); rc(g, bn + 29, bb + 5, 3, 6, '#3A2410');
    rc(g, bn + 4, bb + 5, 1, 6, '#5C3A18');
    g.globalAlpha = 0.25; rc(g, bn + 6, bb + 11, 36, 2, '#000000'); g.globalAlpha = 1;
    /* one continuous rail line across the platform: sleepers first, then
       the two steel rails on top, so it reads in a single glance */
    var rx, rw, ry = oy + 6 * T + 8;
    for (rx = 0; rx < 11 * T; rx += 12) {
      rc(g, ox + rx, ry, 8, 14, '#3A2410');
      rc(g, ox + rx, ry, 8, 1, '#6A4A20');
    }
    /* short spans: the bake gate rejects single fillRects wider than 64px */
    for (rx = 0; rx < 11 * T; rx += 48) {
      rw = Math.min(48, 11 * T - rx);
      rc(g, ox + rx, ry + 2, rw, 2, '#141014');
      rc(g, ox + rx, ry + 2, rw, 1, '#9A8E70');
      rc(g, ox + rx, ry + 10, rw, 2, '#141014');
      rc(g, ox + rx, ry + 10, rw, 1, '#9A8E70');
    }
    for (rx = 0; rx < 11 * T; rx += 24) rc(g, ox + rx + 4, ry + 3, 1, 1, '#12081E');
  }

  /* ── the dusk sky and the cliff around the room ─────────────────── */
  /* How many village roofs the horizon has earned by world column x.
     Pure function of the landmark data in rooms-s.js: no clock, so it
     holds still under reduced motion. */
  function horizonHeight(room, x) {
    var marks = (room && room.landmarks) || [], i, n = 0;
    for (i = 0; i < marks.length; i++) if (x >= marks[i].x) n++;
    return n;
  }
  function drawSky(g, ox, oy, cw, station, room) {
    var cols = cw / T, cx, px, y0, i, k, h0 = oy - 14, bands, b, yy, sx, wf, wn;
    if (station) { rc(g, 0, 0, cw, oy, INK); return; }
    bands = [[C.k0, 0], [C.k1, h0 - 35], [C.k2, h0 - 23], [C.k3, h0 - 11], [C.k4, h0 - 1]];
    for (cx = 0; cx < cols; cx++) {
      px = cx * T;
      for (b = 0; b < bands.length; b++) {
        yy = bands[b][1];
        rc(g, px, yy < 0 ? 0 : yy, T, (b + 1 < bands.length ? bands[b + 1][1] : h0) - (yy < 0 ? 0 : yy), bands[b][0]);
        if (b > 0) for (i = 0; i < 4; i++) {
          rc(g, px + i * 4 + ((i & 1) * 2), yy, 2, 2, bands[b - 1][0]);
          rc(g, px + i * 4 + (((i + 1) & 1) * 2), yy + 2, 2, 2, bands[b][0]);
        }
      }
      for (i = 0; i < 2; i++) if (hs(cx, i, 300) < 0.22) rc(g, px + ((hs(cx, i, 310) * 15) | 0), 2 + ((hs(cx, i, 320) * (h0 - 40 > 4 ? h0 - 40 : 4)) | 0), 1, 1, C.sd5);
    }
    /* far dunes: plum, sun-rimmed, with ink trees on the crest */
    for (sx = 0; sx < cw / 4; sx++) {
      px = sx * 4;
      wf = wave(px, 11, 40, 5) - 2;
      rc(g, px, h0 - 3 + wf, 4, oy - (h0 - 3 + wf), C.k1);
      rc(g, px, h0 - 3 + wf, 4, 1, C.k2);
      wn = wave(px, 23, 28, 5);
      rc(g, px, oy - 9 + wn, 4, 9 - wn, '#3A1E3A');
      rc(g, px, oy - 9 + wn, 4, 1, C.k1);
    }
    for (cx = 0; cx < cols; cx++) {
      if (hs(cx, 5, 330) < 0.22) {
        px = cx * T + 4; y0 = h0 - 3 + wave(px, 11, 40, 5) - 2;
        rc(g, px + 3, y0 - 5, 1, 5, INK);
        rc(g, px, y0 - 8, 8, 2, INK); rc(g, px + 2, y0 - 9, 4, 1, INK);
      }
    }
    /* the village silhouette grows at each sand-path landmark: one more
       roof band past every mark, back-to-front over the far dunes */
    var marks = (room && room.landmarks) || [], mi, bx, span, hh, i, yy, bw;
    for (mi = 0; mi < marks.length; mi++) {
      bx = ox + marks[mi].x * T;
      if (bx >= cw) break;
      span = mi + 1 < marks.length ? (marks[mi + 1].x - marks[mi].x) * T : cw - bx;
      if (span > cw - bx) span = cw - bx;
      hh = 3 + (mi + 1) * 2;
      for (i = 0; i < span; i += 12) {
        yy = h0 - 3 - hh - ((hs(i + marks[mi].x, mi, 840) * 3) | 0);
        bw = 8 + ((hs(i + marks[mi].x, mi, 850) * 5) | 0);
        rc(g, bx + i, yy, bw, Math.max(1, oy - yy), C.k1);
        rc(g, bx + i - 1, yy - 1, bw + 2, 1, C.k2);
      }
    }
    /* bank ridge running off to the sides, above the cliff */
    for (sx = 0; sx < cw / 4; sx++) {
      px = sx * 4; wn = wave(px, 37, 24, 4);
      rc(g, px, oy - 4 + wn, 4, 4 - wn, C.b0);
    }
  }
  function drawCliff(g, ox, oy, cw, ch, station, rw, rh) {
    var cols = cw / T, cx, y, row, r, k, px, py, dx, dy, dist, lum, tones = [C.b0, C.b0, C.b1, C.b2];
    if (station) { rc(g, 0, oy, cw, ch - oy, INK); return; }
    for (cx = 0; cx < cols; cx++) {
      px = cx * T; y = oy; row = 0;
      dx = Math.max(0, ox - px - T, px - (ox + rw - 1)) / T;
      while (y < ch) {
        r = 3 + ((hs(cx >> 1, row, 400) * 3) | 0);
        dy = Math.max(0, y - (oy + rh)) / T;
        dist = Math.max(dx, dy);
        k = hs(cx, row, 410);
        lum = Math.floor(k * 2.4 + 1.5 - dist * 0.32);
        rc(g, px, y, T, r, tones[lum < 0 ? 0 : lum > 3 ? 3 : lum]);
        if (lum > 1 && hs(cx, row, 420) < 0.4) rc(g, px + ((hs(cx, row, 430) * 11) | 0), y, 4, 1, tones[lum - 1]);
        y += r; row++;
      }
      rc(g, px, oy, T, 2, dx > 3 ? C.b2 : C.b3);
      rc(g, px, oy + 2, T, 1, dx > 3 ? C.b1 : C.b2);
      for (y = 0; y < 3; y++) {
        py = oy + 6 + ((hs(cx, y, 440) * ((ch - oy) - 12)) | 0);
        rc(g, px + ((hs(cx, y, 450) * 14) | 0), py, 1, 4 + ((hs(cx, y, 460) * 5) | 0), dx > 3 ? INK : C.b0);
      }
    }
  }

  /* The merged village keeps one station interior as a zone, not a second
     room: the tileset is still savanna, so the bake asks per cell. */
  function inStation(room, x, y) {
    var z = room.stationZones || [], i, s;
    for (i = 0; i < z.length; i++) {
      s = z[i];
      if (x >= s.x0 && x <= s.x1 && y >= s.y0 && y <= s.y1) return true;
    }
    return false;
  }
  function bake(room) {
    var hit = paints[room.id];
    if (hit) return hit;
    var ox = MX * T, oy = MY * T, rw = room.w * T, rh = room.h * T;
    var cw = rw + 2 * ox, ch = rh + 2 * oy;
    var cv = mk(cw, ch);
    var g = cv.getContext && cv.getContext('2d');
    var station = room.tileset === 'station';
    paints[room.id] = cv;
    cv.vz = { ox: ox, oy: oy };
    if (!g) return cv;
    g.imageSmoothingEnabled = false;
    var x, y, ch2, px, py, i, i2, k, es, e, n, fl, site;
    drawSky(g, ox, oy, cw, station, room);
    drawCliff(g, ox, oy, cw, ch, station, rw, rh);
    for (y = 0; y < room.h; y++) {
      for (x = 0; x < room.w; x++) {
        ch2 = tk(room, x, y);
        px = ox + x * T; py = oy + y * T;
        site = siteAt(room, x, y);
        if (station || inStation(room, x, y)) { stationTile(g, room, x, y, px, py, ch2 === '#'); continue; }
        if (ch2 === '#') wallTile(g, room, x, y, px, py, site ? site.edge : 'bank');
        else if (isPath(ch2)) pathTile(g, room, x, y, px, py);
        else if (ch2 === 'd') dryGrassTile(g, room, x, y, px, py);
        else if (ch2 === 'r') lateriteTile(g, room, x, y, px, py);
        else if (ch2 === 'm') mudTile(g, room, x, y, px, py);
        else if (ch2 === 's') stoneTile(g, room, x, y, px, py);
        else sandTile(g, room, x, y, px, py);
      }
    }
    if (!station) {
      /* dithered seams, tufts and the contact shadow of the bank */
      for (y = 0; y < room.h; y++) for (x = 0; x < room.w; x++) {
        ch2 = tk(room, x, y);
        if (!isFloor(ch2) || inStation(room, x, y)) continue;
        px = ox + x * T; py = oy + y * T;
        fl = baseOf(room, x, y);
        for (i = 0; i < 4; i++) {
          n = tk(room, x + (i === 1 ? 1 : i === 3 ? -1 : 0), y + (i === 2 ? 1 : i === 0 ? -1 : 0));
          if (!isFloor(n)) continue;
          k = baseOf(room, x + (i === 1 ? 1 : i === 3 ? -1 : 0), y + (i === 2 ? 1 : i === 0 ? -1 : 0));
          if (k !== fl) dither(g, px, py, i, k, isPath(n) !== isPath(ch2) ? 2 : 1);
        }
        if (!isPath(ch2) && hs(x, y, 500) < 0.08 && (tk(room, x, y - 1) === '#' || tk(room, x - 1, y) === '#' || tk(room, x + 1, y) === '#' || tk(room, x, y + 1) === '#'))
          tuft(g, px + 2 + ((hs(x, y, 510) * 8) | 0), py + 6 + ((hs(x, y, 520) * 6) | 0), hs(x, y, 530));
        if (tk(room, x, y - 1) === '#') {
          g.fillStyle = '#000000';
          g.globalAlpha = 0.32; g.fillRect(px, py, T, 2);
          g.globalAlpha = 0.2; g.fillRect(px, py + 2, T, 2);
          g.globalAlpha = 0.1; g.fillRect(px, py + 4, T, 2);
          g.globalAlpha = 1;
        }
        if (tk(room, x - 1, y) === '#') {
          g.fillStyle = '#000000';
          g.globalAlpha = 0.26; g.fillRect(px, py, 2, T);
          g.globalAlpha = 0.14; g.fillRect(px + 2, py, 2, T);
          g.globalAlpha = 1;
        }
      }
      es = room.entities || [];
      for (i = 0; i < es.length; i++) {
        e = es[i];
        if (!e || e.t !== 'savannaprop') continue;
        px = ox + e.x * T + 8; py = oy + (e.y + 1) * T;
        tuft(g, px - 22, py - 6, hs(e.x, e.y, 540));
        tuft(g, px + 18, py - 5, hs(e.x, e.y, 550));
        if (hs(e.x, e.y, 560) < 0.7) tuft(g, px + 4, py - 1, hs(e.x, e.y, 570));
      }
    } else {
      stationDecor(g, ox, oy);
    }
    if (!station && room.stationZones) {
      /* the merged village carries one station interior, not a second room:
         its sign, bench and rail line must be drawn in the same bake */
      for (i = 0; i < room.stationZones.length; i++) {
        k = room.stationZones[i];
        stationDecor(g, ox + k.x0 * T, oy + k.y0 * T);
      }
    }
    if (!station) {
      /* Golden hour. Low sun in the west: three stepped warm bands, then
         the two light sources baked into the floor (pool and fire). */
      g.fillStyle = C.sun;
      for (x = 0; x < room.w; x++) {
        k = 1 - x / room.w;
        g.globalAlpha = k > 0.66 ? 0.06 : k > 0.33 ? 0.04 : 0.02;
        g.fillRect(ox + x * T, oy, T, rh);
      }
      g.globalAlpha = 1;
      es = room.sites || [];
      for (i = 0; i < es.length; i++) {
        if (!es[i].light) continue;
        k = es[i].light.r;
        px = ox + es[i].light.x * T + 8; py = oy + es[i].light.y * T + 8;
        g.fillStyle = es[i].light.col;
        /* short spans: the bake gate rejects fillRects wider than 64px */
        g.globalAlpha = 0.16;
        for (x = -k / 2; x < k / 2; x += 48) {
          i2 = Math.min(48, k / 2 - x);
          g.fillRect(px + x, py - k / 4, i2, k / 2);
        }
        g.globalAlpha = 0.12;
        for (x = -k / 3; x < k / 3; x += 48) {
          i2 = Math.min(48, k / 3 - x);
          g.fillRect(px + x, py - k / 6, i2, k / 3);
        }
        g.globalAlpha = 0.10; g.fillRect(px - k / 6, py - k / 8, k / 3, k / 4);
      }
      g.globalAlpha = 1;
    }
    /* the dusk wash on the top of the room: stepped, never a gradient */
    g.fillStyle = C.k3;
    for (x = 0; x < room.w; x++) {
      g.globalAlpha = 0.10; g.fillRect(ox + x * T, oy, T, 10);
      g.globalAlpha = 0.06; g.fillRect(ox + x * T, oy + 10, T, 12);
    }
    g.globalAlpha = 1;
    return cv;
  }

  /* blit only what the screen can see */
  KK.kind('savannafloor', {
    interactive: function () { return false; },
    floor: true,
    draw: function (g, e, d) {
      var room = roomOf(d);
      if (!room || !room.grid) return;
      var cv = bake(room), S = d.S || 1;
      var vz = cv.vz || { ox: MX * T, oy: MY * T };
      var dx = Math.round(d.sx - (e.x + 0.5) * T * S - vz.ox * S);
      var dy = Math.round(d.sy - (e.y + 1) * T * S - vz.oy * S);
      var W = (g.canvas && g.canvas.width) || 4096, H = (g.canvas && g.canvas.height) || 4096;
      var x0 = Math.max(0, Math.floor(-dx / S)), y0 = Math.max(0, Math.floor(-dy / S));
      var x1 = Math.min(cv.width, Math.ceil((W - dx) / S)), y1 = Math.min(cv.height, Math.ceil((H - dy) / S));
      if (x1 <= x0 || y1 <= y0) return;
      var sm = g.imageSmoothingEnabled;
      g.imageSmoothingEnabled = false;
      g.drawImage(cv, x0, y0, x1 - x0, y1 - y0, dx + x0 * S, dy + y0 * S, (x1 - x0) * S, (y1 - y0) * S);
      g.imageSmoothingEnabled = sm;
    }
  });

  /* ── props: each one a cached sprite, ink outline, long shadow ───── */
  function outline(g, w, h) {
    var d, o = [], x, y, i;
    try { d = g.getImageData(0, 0, w, h).data; } catch (err) { return; }
    function a(px, py) { return px >= 0 && py >= 0 && px < w && py < h && d[(py * w + px) * 4 + 3] > 40; }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      if (!a(x, y) && (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1))) o.push(x, y);
    }
    g.fillStyle = INK;
    for (i = 0; i < o.length; i += 2) g.fillRect(o[i], o[i + 1], 1, 1);
  }
  function castShadow(g, ax, ay, pw) {
    /* Long shadow east: the low sun is behind the west edge of the frame. */
    var x0 = ax - Math.round(pw * 0.28), w = Math.round(pw * 2.6);
    g.save();
    g.globalCompositeOperation = 'destination-over';
    g.fillStyle = '#000000';
    g.globalAlpha = 0.30; g.fillRect(ax - Math.round(pw * 0.25), ay - 1, Math.round(pw * 0.6), 2);
    g.globalAlpha = 0.24; g.fillRect(x0, ay, Math.round(w * 0.55), 1);
    g.globalAlpha = 0.18; g.fillRect(x0 + 6, ay + 1, Math.round(w * 0.72), 1);
    g.globalAlpha = 0.12; g.fillRect(x0 + 14, ay + 2, w - 18, 1);
    g.globalAlpha = 0.07; g.fillRect(x0 + 26, ay + 3, Math.max(1, w - 34), 1);
    g.restore();
  }
  function ln(R, x0, y0, x1, y1, c, t) {
    var dx = x1 - x0, dy = y1 - y0, n = Math.max(Math.abs(dx), Math.abs(dy)), i;
    for (i = 0; i <= n; i++) R(Math.round(x0 + dx * i / (n || 1)), Math.round(y0 + dy * i / (n || 1)), t, t, c);
  }
  function blobs(R, list, c) { var i; for (i = 0; i < list.length; i++) A().blob(R, list[i][0], list[i][1], list[i][2], list[i][3], c); }
  function leaves(R, x0, x1, y0, y1, n, c, seed) {
    var i;
    for (i = 0; i < n; i++) R(x0 + ((hs(i, seed, 600) * (x1 - x0)) | 0), y0 + ((hs(i, seed, 610) * (y1 - y0)) | 0), 2, 1, c);
  }

  function pAcacia(R, g) {
    var x, i;
    R(-5, -2, 10, 2, '#3A2410'); R(-4, -3, 8, 1, '#5C3A18');
    for (i = 3; i < 15; i++) {
      R(-3, -i, 1, 1, '#7A4E24'); R(-2, -i, 3, 1, '#5C3A18'); R(1, -i, 2, 1, '#3A2410');
    }
    ln(R, -1, -13, -13, -26, '#3A2410', 3); ln(R, -2, -13, -13, -27, '#7A4E24', 1);
    ln(R, 0, -13, 11, -27, '#3A2410', 3); ln(R, -1, -14, 10, -28, '#5C3A18', 1);
    ln(R, 1, -9, 8, -15, '#3A2410', 2);
    blobs(R, [[-15, -23, 9, 3], [0, -22, 14, 4], [15, -23, 9, 3]], '#2A3A14');
    blobs(R, [[-13, -26, 9, 3], [2, -26, 13, 3], [15, -26, 8, 3]], '#4A5A1E');
    blobs(R, [[-9, -31, 9, 2], [6, -31, 11, 2]], '#A89A3A');
    blobs(R, [[-9, -30, 9, 3], [6, -30, 11, 3]], '#6A7A2A');
    leaves(R, -20, 18, -34, -27, 14, '#A89A3A', 1);
    leaves(R, -22, 20, -29, -23, 12, '#6A7A2A', 2);
    leaves(R, -20, 20, -25, -20, 12, '#1E2A0E', 3);
    R(-22, -21, 5, 1, '#1E2A0E'); R(10, -21, 7, 1, '#1E2A0E');
    g.clearRect(R.ax - 6, R.ay - 29, 3, 1); g.clearRect(R.ax + 8, R.ay - 30, 2, 1); g.clearRect(R.ax - 17, R.ay - 25, 2, 1); g.clearRect(R.ax + 3, R.ay - 25, 3, 1);
  }
  function pHut(R) {
    var i, hw, row, c;
    R(-14, -16, 28, 16, '#A86828');
    R(-14, -16, 10, 16, '#C88A48');
    R(6, -16, 8, 16, '#7A4A1C');
    R(-14, -2, 28, 2, '#7A4A1C');
    for (i = 0; i < 8; i++) R(-12 + ((hs(i, 1, 620) * 24) | 0), -14 + ((hs(i, 2, 620) * 12) | 0), 2, 1, i & 1 ? '#C88A48' : '#7A4A1C');
    R(-14, -16, 28, 2, '#4A2A14');
    R(-4, -12, 8, 12, '#2A1A0C');
    R(-4, -12, 8, 1, '#1A1008');
    R(-3, -11, 6, 7, '#8A2E2E'); R(-3, -11, 2, 7, '#B04040'); R(1, -11, 2, 7, '#5A1A1A');
    R(-3, -5, 6, 1, '#5A1A1A'); R(-4, -12, 8, 1, '#3A2410');
    for (i = 0; i < 20; i++) {
      hw = Math.round(22 * (1 - i / 20)) + 1;
      row = -15 - i;
      c = i < 3 ? '#6A4A20' : '#A07A3A';
      R(-hw, row, hw * 2, 1, c);
      R(-hw, row, Math.max(1, Math.round(hw * 0.7)), 1, i < 3 ? '#8A6430' : '#D0A85A');
      if (i % 4 === 3) R(-hw + 1, row, hw * 2 - 2, 1, '#6A4A20');
      R(-hw, row, 1, 1, '#F0D48A');
    }
    for (i = 0; i < 22; i++) R(-18 + ((hs(i, 3, 630) * 30) | 0), -33 + ((hs(i, 4, 630) * 18) | 0), 1, 3, i & 1 ? '#F0D48A' : '#6A4A20');
    R(-1, -36, 2, 3, '#6A4A20');
  }
  function pWell(R) {
    var i;
    A().blob(R, 0, -9, 17, 6, '#5A524A');
    A().blob(R, 0, -10, 14, 4, '#1A3A4A');
    R(-5, -11, 3, 1, '#6A9AAA'); R(-6, -10, 1, 1, '#6A9AAA');
    R(-17, -8, 34, 9, '#7A7268');
    R(-17, -8, 34, 1, '#A09888');
    R(-17, 0, 34, 1, '#5A524A');
    for (i = 0; i < 5; i++) { R(-17 + i * 8, -7, 1, 4, '#5A524A'); R(-13 + i * 8, -3, 1, 3, '#5A524A'); }
    R(-17, -8, 5, 9, '#A09888'); R(-17, -7, 1, 8, '#A09888');
    R(12, -7, 5, 8, '#5A524A');
    R(-15, -29, 3, 22, '#8A5A28'); R(-15, -29, 1, 22, '#A87038'); R(-13, -29, 1, 22, '#5C3A18');
    R(12, -29, 3, 22, '#8A5A28'); R(12, -29, 1, 22, '#A87038'); R(14, -29, 1, 22, '#5C3A18');
    R(-17, -31, 34, 3, '#8A5A28'); R(-17, -31, 34, 1, '#A87038'); R(-17, -28, 34, 1, '#3A2410');
    R(-1, -27, 1, 9, '#C8B898'); R(-3, -18, 6, 5, '#5C3A18'); R(-3, -18, 6, 1, '#8A5A28'); R(-2, -13, 4, 1, '#3A2410');
    R(8, -30, 5, 2, '#5C3A18'); R(13, -30, 1, 5, '#3A2410');
  }
  function pBaobab(R) {
    var i, hw;
    for (i = 0; i < 31; i++) {
      hw = 13 + (i < 5 ? 5 - i : 0) - (i > 24 ? Math.round((i - 24) / 2) : 0);
      R(-hw, -i, hw * 2, 1, '#5A4A3A');
      R(-hw, -i, Math.max(2, Math.round(hw * 0.55)), 1, '#9A8A70');
      R(-hw + Math.round(hw * 0.55), -i, Math.round(hw * 0.45), 1, '#7A6A54');
    }
    for (i = 0; i < 9; i++) R(-10 + i * 3 + ((hs(i, 7, 640) * 2) | 0), -28 + ((hs(i, 8, 640) * 6) | 0), 1, 8 + ((hs(i, 9, 640) * 14) | 0), '#3A2E22');
    for (i = 0; i < 6; i++) R(-9 + ((hs(i, 1, 650) * 16) | 0), -(4 + ((hs(i, 2, 650) * 22) | 0)), 2, 1, '#B8A888');
    R(-15, -2, 5, 2, '#7A6A54'); R(10, -2, 5, 2, '#5A4A3A'); R(-18, -1, 6, 1, '#9A8A70'); R(12, -1, 6, 1, '#5A4A3A');
    ln(R, -8, -29, -18, -40, '#7A6A54', 5); ln(R, -3, -30, -6, -45, '#7A6A54', 5);
    ln(R, 3, -30, 7, -44, '#5A4A3A', 5); ln(R, 8, -29, 18, -39, '#5A4A3A', 5);
    blobs(R, [[-18, -43, 8, 3], [-6, -48, 8, 3], [8, -47, 8, 3], [19, -42, 8, 3]], '#2A3A14');
    blobs(R, [[-18, -45, 7, 2], [-6, -50, 7, 2], [8, -49, 7, 2], [19, -44, 7, 2]], '#4A5A1E');
    leaves(R, -25, 26, -52, -42, 12, '#A89A3A', 5);
  }
  function pKraal(R) {
    var i, h, x;
    for (i = 0; i < 16; i++) {
      x = -32 + i * 4;
      h = 12 + ((hs(i, 2, 660) * 3) | 0) - 1;
      R(x, -h, 2, h, '#8A5A28'); R(x + 2, -h, 2, h, '#5C3A18');
      R(x, -h - 1, 2, 1, '#8A5A28'); R(x + 2, -h - 1, 1, 1, '#5C3A18');
      R(x, -h, 1, h, '#A87038');
    }
    R(-32, -8, 64, 1, '#3A2410'); R(-32, -3, 64, 1, '#3A2410');
    R(-32, -9, 64, 1, '#7A5A38');
    for (i = 0; i < 16; i += 2) R(-32 + i * 4, -8, 2, 1, '#A07A3A');
  }
  function cowrie(R, cx, cy, c) { /* small pots, shared by the stall */
    A().blob(R, cx, cy, c, c - 1, '#6A3A1C');
    A().blob(R, cx - 1, cy - 1, c - 1, c - 2, '#A85E2C');
    R(cx - 2, cy - c + 1, 2, 1, '#D8925A');
    R(cx - c + 1, cy - c - 1, 2 * c - 2, 1, '#8A4A24');
  }
  function pStall(R) {
    var i, c;
    R(-18, -30, 36, 16, '#2A1A0C');
    R(-14, -28, 10, 10, '#5C3A18'); R(-14, -28, 10, 1, '#8A5A28'); R(4, -28, 8, 12, '#3A2410');
    R(-17, -34, 2, 34, '#5C3A18'); R(-17, -34, 1, 34, '#8A5A28'); R(15, -34, 2, 34, '#3A2410');
    for (i = 0; i < 10; i++) {
      c = i & 1 ? '#E8DCC0' : '#C4323A';
      R(-20 + i * 4, -36, 4, 8, c);
      R(-20 + i * 4, -36, 4, 1, i & 1 ? '#FFFFFF' : '#E85A5A');
      R(-20 + i * 4, -28, 4, 2, i & 1 ? '#C8B898' : '#8A1E26');
      R(-20 + i * 4 + 1, -26, 2, 1, i & 1 ? '#A89878' : '#8A1E26');
    }
    R(-20, -36, 40, 1, '#8A1E26');
    R(-19, -14, 38, 3, '#A87038'); R(-19, -14, 38, 1, '#C8904A'); R(-19, -11, 38, 4, '#5C3A18'); R(-19, -8, 38, 1, '#3A2410');
    R(-17, -7, 3, 7, '#3A2410'); R(14, -7, 3, 7, '#3A2410');
    cowrie(R, -12, -17, 3); cowrie(R, -4, -18, 4); cowrie(R, 3, -16, 2);
    R(9, -22, 8, 8, '#8A4A24'); R(9, -22, 8, 1, '#E8DCC0'); R(10, -23, 6, 1, '#C8B898'); R(9, -20, 8, 1, '#3A2410'); R(9, -16, 8, 1, '#3A2410'); R(9, -22, 2, 8, '#A85E2C');
    R(-18, -16, 1, 1, '#E85A5A'); R(-16, -16, 1, 1, '#8AB0FF'); R(-14, -15, 1, 1, '#FFE35A');
  }
  function pMound(R) {
    var i, hw, y;
    for (i = 0; i < 26; i++) {
      hw = Math.round(13 * Math.pow(1 - i / 26, 0.8)) + 1 + ((hs(i, 1, 670) * 2) | 0);
      R(-hw, -i, hw * 2, 1, '#8A4A24');
      R(-hw, -i, Math.max(1, Math.round(hw * 0.5)), 1, '#A85E2C');
      R(hw - Math.max(2, Math.round(hw * 0.35)), -i, Math.max(2, Math.round(hw * 0.35)), 1, '#6A3A1C');
    }
    for (i = 0; i < 6; i++) { y = -2 - i * 4; R(-8 + ((hs(i, 2, 680) * 14) | 0), y, 3, 1, '#4A2A14'); R(-6 + ((hs(i, 3, 680) * 12) | 0), y - 1, 2, 1, '#D8925A'); }
    for (i = 0; i < 9; i++) R(-7 + ((hs(i, 4, 680) * 14) | 0), -2 - ((hs(i, 5, 680) * 20) | 0), 1, 2, '#4A2A14');
    R(-2, -27, 4, 2, '#A85E2C'); R(0, -28, 2, 1, '#D8925A');
  }
  function pStool(R) {
    R(-12, -9, 12, 3, '#8A5A28'); R(-12, -9, 12, 1, '#A87038'); R(-12, -6, 12, 1, '#3A2410');
    R(-11, -5, 2, 5, '#5C3A18'); R(-4, -5, 2, 5, '#3A2410'); R(-11, -5, 1, 5, '#8A5A28');
    R(2, -14, 10, 13, '#8A4A24'); R(2, -14, 3, 13, '#A85E2C'); R(9, -14, 3, 13, '#6A3A1C');
    R(2, -15, 10, 3, '#E8DCC0'); R(2, -15, 10, 1, '#FFFFFF'); R(2, -13, 10, 1, '#A89878');
    R(2, -10, 10, 1, '#3A2410'); R(3, -9, 2, 1, '#3A2410'); R(6, -8, 2, 1, '#3A2410'); R(9, -9, 2, 1, '#3A2410'); R(2, -2, 10, 1, '#3A2410');
  }
  /* The five sand-path landmarks. Back-to-front, sparse silhouettes: the
     same horizon stack the sky already uses, stepped into the walk. */
  function pDeadTree(R) {
    var i;
    R(-3, -48, 6, 48, '#3A2410'); R(-2, -48, 2, 48, '#7A4E24');
    for (i = 0; i < 11; i++) R(-4 + (i & 1), -46 + i * 4, 8 - (i & 1) * 2, 1, '#5C3A18');
    ln(R, -2, -40, -22, -52, '#3A2410', 3); ln(R, -2, -40, -20, -51, '#7A4E24', 1);
    ln(R, 2, -44, 20, -56, '#3A2410', 3); ln(R, 2, -44, 18, -55, '#7A4E24', 1);
    ln(R, 0, -33, -12, -43, '#3A2410', 2); ln(R, 1, -28, 14, -37, '#3A2410', 2);
    for (i = 0; i < 7; i++) R(-14 + i * 5 + ((hs(i, 2, 810) * 3) | 0), -3, 3, 2, '#E8DCC0');
    R(-15, -6, 4, 3, '#C8B898'); R(9, -5, 3, 2, '#C8B898');
  }
  function pBrokenSign(R) {
    R(-3, -34, 5, 34, '#5C3A18'); R(-2, -34, 2, 34, '#8A5A28');
    R(-20, -40, 40, 3, '#6A3A1C'); R(-20, -40, 40, 1, '#A87038');
    R(-20, -37, 14, 3, '#6A3A1C'); R(-6, -37, 1, 3, '#3A2410');
    R(8, -37, 12, 3, '#6A3A1C'); R(19, -41, 2, 5, '#3A2410');
    R(-17, -32, 12, 1, '#C8904A'); R(9, -32, 8, 1, '#C8904A');
    ln(R, 2, -34, 7, -28, '#3A2410', 2);
  }
  function pRustCar(R) {
    var i;
    R(-26, -20, 52, 14, '#6A2A10'); R(-26, -20, 52, 2, '#A85E2C');
    R(-16, -31, 30, 12, '#8A3A14'); R(-14, -30, 12, 10, '#3A2A34');
    R(0, -30, 12, 10, '#3A2A34'); R(-14, -30, 1, 10, '#C8904A'); R(0, -30, 1, 10, '#C8904A');
    R(-26, -12, 52, 3, '#3A1A0C'); R(-20, -9, 8, 6, '#2A1810'); R(12, -9, 8, 6, '#2A1810');
    for (i = 0; i < 9; i++) R(-24 + i * 6 + ((hs(i, 3, 820) * 2) | 0), -18 + ((hs(i, 4, 820) * 6) | 0), 3, 1, '#D8925A');
    ln(R, -24, -20, -30, -24, '#3A1A0C', 2);
  }
  function pDuneCrest(R) {
    var i, hw;
    for (i = 0; i < 30; i++) {
      hw = Math.round(36 * Math.pow(1 - i / 30, 0.7)) + 1;
      R(-hw, -i, hw * 2, 1, i < 12 ? C.sd2 : C.sd3);
      R(hw - 6, -i, 4, 1, C.sd5);
    }
    for (i = 0; i < 5; i++) {
      R(20 + i * 5, -12 - i * 2, 4, 1, C.sd5);
      R(24 + i * 5, -13 - i * 2, 2, 1, '#F4E2A8');
    }
    for (i = 0; i < 6; i++) R(-30 + i * 11, -2, 3, 1, C.g2);
  }
  function pRoofs(R) {
    var i, x, h;
    for (i = 0; i < 5; i++) {
      x = -40 + i * 18; h = 12 + ((hs(i, 5, 830) * 12) | 0);
      R(x, -h, 16, h, '#5C3A18'); R(x, -h - 1, 16, 1, '#8A5A28');
      R(x + 2, -h + 3, 4, 4, '#D8925A'); R(x + 10, -h + 3, 4, 4, '#D8925A');
      R(x - 2, -h - 2, 20, 1, '#3A2410');
    }
  }
  /* ── the village landmarks. Each one reads as a silhouette at a glance. */
  function pGateposts(R) {
    var i, x;
    for (i = 0; i < 2; i++) {
      x = i ? 16 : -18;
      R(x, -36, 8, 36, '#7A4A1C'); R(x, -36, 2, 36, '#A87038');
      R(x + 6, -36, 2, 36, '#3A2410'); R(x - 2, -38, 12, 3, '#5C3A18');
      R(x - 2, -38, 10, 1, '#C8904A');
      R(x + 2, -33, 1, 1, '#C4323A'); R(x + 4, -31, 1, 1, '#8AB0FF'); R(x + 1, -28, 1, 1, '#FFE35A');
      R(x + 5, -26, 1, 1, '#E8DCC0'); R(x + 2, -24, 1, 1, '#C4323A');
    }
    R(-18, -38, 42, 2, '#8A5A28'); R(-18, -38, 40, 1, '#C8904A');
    for (x = -14; x < 22; x += 3) {
      R(x, -36, 1, 4 + ((hs(x, 1, 1400) * 4) | 0), '#5C3A18');
      R(x, -34, 1, 1, ((x / 3) & 1) ? '#C4323A' : '#FFE35A');
    }
  }
  function pMarket(R) {
    var i, x, y, cols = ['#C4323A', '#8AB0FF', '#FFE35A'];
    for (i = 0; i < 3; i++) {
      x = -28 + i * 19;
      R(x + 1, -30, 3, 30, '#5C3A18'); R(x + 14, -30, 3, 30, '#3A2410');
      for (y = 0; y < 7; y++) R(x + y - 3, -36 + y, 22 - y * 2, 2, cols[i]);
      R(x - 4, -29, 26, 2, cols[i]); R(x - 4, -29, 26, 1, '#E8DCC0');
      R(x, -27, 18, 12, '#2A1A0C'); R(x + 1, -26, 16, 9, '#5C3A18');
      R(x + 2, -25, 5, 6, '#C8904A'); R(x + 9, -24, 4, 5, '#A85E2C');
      R(x + 2, -14, 6, 5, '#8A4A24'); R(x + 10, -14, 6, 5, '#A86828');
    }
    for (i = 0; i < 6; i++) R(-26 + i * 10, -7, 5, 4, i & 1 ? '#8A5A28' : '#5C3A18');
  }
  function pFireRing(R) {
    var i, a;
    for (i = 0; i < 9; i++) {
      a = i / 9 * 6.2832;
      R(Math.round(Math.cos(a) * 13) - 2, Math.round(Math.sin(a) * 5) - 2, 4, 3, i & 1 ? C.s2 : C.s1);
    }
    A().blob(R, 0, -3, 9, 3, '#1A0E08'); A().blob(R, 0, -4, 6, 2, '#8A3A10');
    A().blob(R, 0, -6, 4, 4, '#E85A1A'); A().blob(R, -1, -7, 2, 3, '#FFD34A');
    R(-11, -18, 3, 16, '#3A2410'); R(8, -18, 3, 16, '#3A2410');
    A().blob(R, 0, -19, 11, 5, '#3A2410'); A().blob(R, 0, -20, 9, 3, '#8A5A28');
    R(-1, -24, 2, 4, '#A87038');
    for (i = 0; i < 5; i++) R(-8 + i * 4, -29 - ((hs(i, 1, 1410) * 4) | 0), 2, 2, '#5A524A');
  }
  function pWaterhole(R) {
    var i, a, x;
    A().blob(R, 0, -8, 24, 8, '#4A3A22'); A().blob(R, 0, -8, 21, 6, C.m1);
    A().blob(R, 0, -9, 19, 5, '#1A3A4A'); A().blob(R, -3, -10, 12, 2, '#2E5A6A');
    R(-16, -11, 8, 1, '#8FD0D8'); R(4, -9, 6, 1, '#8FD0D8');
    for (i = 0; i < 10; i++) {
      a = i / 10 * 6.2832;
      R(Math.round(Math.cos(a) * 26) - 2, Math.round(Math.sin(a) * 9), 4, 1, i & 1 ? C.m3 : C.m0);
    }
    for (i = 0; i < 9; i++) {
      x = i ? (-24 + i * 6) : -20;
      R(x, -16 - ((hs(i, 1, 1420) * 3) | 0), 1, 12, C.g1);
      R(x - 1, -17, 1, 4, C.g3);
    }
    for (i = 0; i < 4; i++) R(-12 + i * 8, -2, 3, 1, C.m0);
  }
  function pLoom(R) {
    var i;
    R(-14, -32, 3, 32, '#5C3A18'); R(11, -32, 3, 32, '#3A2410');
    R(-16, -33, 30, 3, '#8A5A28'); R(-16, -33, 28, 1, '#C8904A');
    for (i = 0; i < 9; i++) R(-12 + i * 3, -29, 1, 20, i & 1 ? '#C4323A' : '#FFE35A');
    for (i = 0; i < 5; i++) R(-14, -27 + i * 5, 27, 1, i & 1 ? '#E8DCC0' : '#8A1E26');
    R(-10, -9, 20, 6, '#5C3A18'); R(-10, -9, 20, 1, '#C8904A');
    for (i = 0; i < 7; i++) R(-8 + i * 3, -7, 2, 2, ['#C4323A', '#8AB0FF', '#FFE35A'][i % 3]);
    R(13, -14, 8, 10, '#8A4A24'); R(14, -15, 6, 2, '#C8904A');
  }
  function pMidden(R) {
    var i, x;
    for (i = 0; i < 16; i++) {
      x = -19 + ((hs(i, 1, 1430) * 36) | 0);
      A().blob(R, x, -2 - ((hs(i, 2, 1430) * 6) | 0), 4, 2, i & 1 ? '#E8DCC0' : '#A89878');
    }
    A().blob(R, 0, -10, 12, 5, '#8A7A58'); A().blob(R, 0, -11, 10, 3, '#C8B898');
    R(-1, -14, 3, 10, '#3A2410'); R(-2, -15, 5, 2, '#5C3A18');
    for (i = 0; i < 5; i++) {
      R(-2 + i * 4, -16 - ((hs(i, 3, 1440) * 3) | 0), 1, 5, '#8A5A28');
      R(-3 + i * 4, -18, 3, 2, i & 1 ? '#C4323A' : '#FFE35A');
    }
  }
  function pPaintedWall(R) {
    var i, x;
    R(-26, -30, 52, 30, '#8A5A28'); R(-26, -30, 52, 2, '#C8904A');
    R(-26, -2, 52, 2, '#3A2410');
    for (i = 0; i < 9; i++) {
      x = -22 + i * 5;
      R(x, -26, 3, 8, i % 3 === 0 ? '#C4323A' : '#E8DCC0');
      R(x + 1, -27, 2, 2, '#3A2410');
      R(x, -16, 3, 3, i & 1 ? '#B05424' : '#F0D48A');
    }
    R(-26, -11, 52, 1, '#3A2410');
    for (i = 0; i < 6; i++) R(-24 + i * 9, -8, 5, 2, i & 1 ? '#E8DCC0' : '#B05424');
    R(-8, -18, 16, 16, '#5C3A18'); R(-6, -16, 12, 12, '#2A1A0C');
  }
  function pStair(R) {
    var i, hw;
    for (i = 0; i < 22; i++) {
      hw = Math.round(15 * Math.pow(1 - i / 22, 0.75)) + 1;
      R(-hw, -i, hw * 2, 1, i < 6 ? C.r3 : C.r2);
      R(-hw, -i, 3, 1, C.r4);
      if (i % 4 === 3) R(-hw + 3, -i, hw * 2 - 3, 1, C.r0);
    }
    R(-3, -23, 6, 2, C.r4); R(-1, -24, 2, 1, C.sun);
    for (i = 0; i < 5; i++) R(-12 + i * 5, -2, 2, 2, C.r0);
  }
  function pWindPoles(R) {
    var i, x;
    for (i = 0; i < 3; i++) {
      x = -18 + i * 18;
      R(x, -40 - (i === 1 ? 4 : 0), 3, 40 + (i === 1 ? 4 : 0), '#5C3A18');
      R(x, -40, 1, 40, '#A87038'); R(x + 2, -40, 1, 40, '#3A2410');
      R(x - 10, -38, 22, 2, '#8A5A28');
      R(x - 16, -36, 14, 3, i === 1 ? '#C4323A' : '#E8DCC0');
      R(x - 16, -36, 14, 1, '#FFFFFF');
      R(x + 2, -32, 12, 2, i === 2 ? '#8AB0FF' : '#FFE35A');
    }
    R(-22, -2, 44, 2, C.b2);
  }
  var PROPS = {
    acacia: [48, 40, pAcacia], hut: [44, 38, pHut], well: [38, 32, pWell], baobab: [40, 52, pBaobab],
    kraal: [64, 16, pKraal], stall: [40, 38, pStall], mound: [30, 30, pMound], stool: [26, 16, pStool],
    deadtree: [50, 58, pDeadTree], brokensign: [44, 42, pBrokenSign], rustcar: [64, 34, pRustCar],
    dunecrest: [84, 32, pDuneCrest], roofs: [100, 34, pRoofs],
    /* the thirteen village landmarks, all palette-drawn here */
    gateposts: [40, 40, pGateposts], market: [64, 42, pMarket], firering: [40, 28, pFireRing],
    waterhole: [52, 24, pWaterhole], loom: [38, 36, pLoom], midden: [44, 30, pMidden],
    paintedwall: [64, 40, pPaintedWall], stair: [44, 36, pStair], windpoles: [52, 44, pWindPoles]
  };
  var spr = {};
  function propSprite(v) {
    var p = PROPS[v], pw, ph, ax, ay, W, H;
    if (!p || !A()) return null;
    if (spr[v]) return spr[v];
    pw = p[0]; ph = p[1];
    ax = Math.ceil(pw * 0.75) + 4; ay = ph + 5; W = ax + pw * 2 + 4; H = ay + 5;
    spr[v] = A().sprite('vzs:' + v, W, H, ax, ay, function (R, g) {
      p[2](R, g);
      outline(g, W, H);
      castShadow(g, ax, ay, pw);
    });
    return spr[v];
  }

  KK.kind('savannaprop', {
    interactive: function () { return false; },
    width: function () { return 16; },
    reach: function (e) {
      var p = PROPS[e.v];
      /* castShadow starts left of the anchor and stretches past the sprite. */
      return p ? Math.round(p[0] * 1.9) - Math.round(p[0] * 0.3) : 0;
    },
    draw: function (g, e, d) {
      var s = propSprite(e.v);
      if (s) { A().blit(g, s, d); return; }
      var S = d.S || 1;
      g.fillStyle = '#FF00FF';
      g.fillRect(d.sx - 8 * S, d.sy - 16 * S, 16 * S, 16 * S);
    }
  });

  /* ── station lantern: chain, frame, a real flame, a pool of light ── */
  function lanternSprite() {
    if (!A()) return null;
    return A().sprite('vzs:lantern', 16, 26, 8, 24, function (R, g) {
      R(0, -22, 1, 8, '#12081E');
      R(-3, -14, 7, 2, '#3A2414'); R(-3, -3, 7, 2, '#3A2414');
      R(-3, -12, 1, 9, '#5A3418'); R(3, -12, 1, 9, '#2A1A0C');
      R(-2, -12, 5, 9, '#6A2A10');
      R(-1, -15, 3, 1, '#5A3418');
      outline(g, 16, 26);
    });
  }
  KK.kind('stationlamp', {
    interactive: function () { return false; },
    width: function () { return 8; },
    draw: function (g, e, d) {
      var S = d.S || 1, s = lanternSprite(), L2 = L();
      if (s) A().blit(g, s, d, 0, 0);
      if (L2 && L2.glow) L2.glow(g, d.sx, d.sy - 8 * S, 14 * S, '#E89060', 0.24);
      if (A() && A().flame) A().flame(g, d.sx, d.sy - 4 * S, S, 1, d.now || 0, (e.x * 3 + e.y) | 0);
    },
    light: function () { return { r: 54, col: '#E89060', glow: 0.22, a: 0.9 }; }
  });

  /* ── world-space dusk fx: heat haze + wind. Nothing is pinned to the screen. */
  KK.kind('savannafx', {
    interactive: function () { return false; },
    draw: function (g, e, d) {
      var room = roomOf(d);
      if (!room) return;
      var S = d.S || 1, hold = still(), t = hold ? 0 : (d.now || 0);
      var ox = Math.round(d.sx - (e.x + 0.5) * T * S), oy = Math.round(d.sy - (e.y + 1) * T * S);
      var rw = room.w * T, rh = room.h * T;
      var W = (g.canvas && g.canvas.width) || 1280;
      var vl = Math.max(0, -ox / S), vr = Math.min(rw, (W - ox) / S);
      var step = Math.floor(t / 400), i, k, wx, wy, p0, kk0, kk1;
      if (vr <= vl || room.tileset === 'station') return;
      g.globalAlpha = 0.08;
      g.fillStyle = C.sd5;
      for (i = 0; i < 3; i++) {
        wy = Math.round(rh * 0.28) + i * 7 + 8;
        p0 = (i * 13 + step) % 44;
        for (k = Math.floor((vl - p0) / 44) - 1; k * 44 + p0 < vr; k++) {
          wx = k * 44 + p0;
          if (wx + 28 < vl || wx > vr) continue;
          g.fillRect(ox + Math.round(Math.max(wx, vl)) * S, oy + wy * S, Math.round(Math.min(wx + 28, vr) - Math.max(wx, vl)) * S, S);
        }
      }
      g.globalAlpha = 1;
      /* stepped heat shimmer over the grass: 3 palette steps, no blur */
      g.fillStyle = C.e5; g.globalAlpha = 0.07;
      for (i = 0; i < 3; i++) {
        wy = Math.round(rh * 0.45) + i * 5;
        p0 = (i * 19 + step) % 52;
        for (k = Math.floor((vl - p0) / 52) - 1; k * 52 + p0 < vr; k++) {
          wx = k * 52 + p0;
          if (wx + 20 < vl || wx > vr) continue;
          g.fillRect(ox + Math.round(Math.max(wx, vl)) * S, oy + wy * S,
            Math.round(Math.min(wx + 20, vr) - Math.max(wx, vl)) * S, S);
        }
      }
      g.globalAlpha = 1;
      /* ambient life, tied to the sim clock (d.now). Reduced motion holds
         every pose at t=0: no bird flap, no sway, no crossing dust devil. */
      var sites = room.sites || [], px, py, fl, dr, bx, by, bird, x, z, seed;
      var flip = hold ? 0 : (Math.floor(t / 400) & 1);  /* 2.5 Hz, under 3 Hz */
      for (z = 0; z < sites.length; z++) {
        if (!sites[z].amb || !roomAreaVisible(room, sites[z], vl, vr)) continue;
        seed = z * 37;
        if (sites[z].amb === 'birds') {
          for (i = 0; i < 3; i++) {
            bird = Math.floor(t / 900 + i * 3) % 12;
            bx = sites[z].x0 * T + 8 + ((hs(i, z, 1500) * sites[z].w * T) | 0);
            by = sites[z].y0 * T - 18 - i * 6 - bird * 2;
            if (bx < vl || bx > vr) continue;
            fl = flip && !hold;
            rc(g, ox + bx * S, oy + by * S, S, S, '#12081E');
            rc(g, ox + (bx - 2) * S, oy + (by - (fl ? 1 : 0)) * S, 2 * S, S, '#12081E');
            rc(g, ox + (bx + 1) * S, oy + (by - (fl ? 1 : 0)) * S, 2 * S, S, '#12081E');
          }
        } else if (sites[z].amb === 'smoke') {
          for (i = 0; i < 4; i++) {
            dr = hold ? 0 : (Math.floor(t / 700 + i) & 3);
            px = sites[z].x0 * T + sites[z].w * T / 2 + (dr - 1) * 2;
            py = sites[z].y0 * T + sites[z].h * T / 2 - 22 - i * 5;
            rc(g, ox + px * S, oy + py * S, 2 * S, 2 * S, i & 1 ? '#5A524A' : '#7A7268');
          }
        } else if (sites[z].amb === 'devil') {
          dr = hold ? 0 : (Math.floor(t / 2600) % 9);
          px = sites[z].x0 * T + 8 + dr * T;
          py = sites[z].y0 * T + sites[z].h * T - 12;
          if (px >= vl && px <= vr) {
            g.globalAlpha = 0.5;
            rc(g, ox + px * S, oy + py * S, 5 * S, 12 * S, C.sd3);
            rc(g, ox + (px + 1) * S, oy + (py - 3) * S, 3 * S, 4 * S, C.sd4);
            g.globalAlpha = 1;
          }
        }
      }
    }
  });
  function roomAreaVisible(room, site, vl, vr) {
    return site.x0 * T < vr && (site.x0 + site.w) * T > vl;
  }

  NEU.savannaLook = { bake: bake, paints: paints, T: T, MX: MX, MY: MY, props: PROPS,
    propSprite: propSprite, horizonHeight: horizonHeight };
})();
