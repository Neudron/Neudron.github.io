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
    k0: '#1A1020', k1: '#4A2A4A', k2: '#A8506A', k3: '#E89060', k4: '#F8C890'
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
  function isFloor(ch) { return ch === '.' || ch === ',' || ch === '='; }

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
    var ch = tk(room, x, y);
    if (isPath(ch)) return C.e4;
    return sandTone(room, x, y) ? C.sd3 : C.sd4;
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
  /* an earth bank. Top face, lip, strata front, drips. */
  function wallTile(g, room, x, y, px, py) {
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
  }

  /* ── the dusk sky and the cliff around the room ─────────────────── */
  function drawSky(g, ox, oy, cw, station) {
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
    var x, y, ch2, px, py, i, k, es, e, n, fl;
    drawSky(g, ox, oy, cw, station);
    drawCliff(g, ox, oy, cw, ch, station, rw, rh);
    for (y = 0; y < room.h; y++) {
      for (x = 0; x < room.w; x++) {
        ch2 = tk(room, x, y);
        px = ox + x * T; py = oy + y * T;
        if (station) { stationTile(g, room, x, y, px, py, ch2 === '#'); continue; }
        if (ch2 === '#') wallTile(g, room, x, y, px, py);
        else if (isPath(ch2)) pathTile(g, room, x, y, px, py);
        else sandTile(g, room, x, y, px, py);
      }
    }
    if (!station) {
      /* dithered seams, tufts and the contact shadow of the bank */
      for (y = 0; y < room.h; y++) for (x = 0; x < room.w; x++) {
        ch2 = tk(room, x, y);
        if (!isFloor(ch2)) continue;
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
    var x0 = ax - Math.round(pw * 0.3), w = Math.round(pw * 1.9);
    g.save();
    g.globalCompositeOperation = 'destination-over';
    g.fillStyle = '#000000';
    g.globalAlpha = 0.25;
    g.fillRect(x0 + 6, ay - 1, w - 10, 1);
    g.fillRect(x0, ay, w, 1);
    g.fillRect(x0 + 10, ay + 1, w - 24, 1);
    g.globalAlpha = 0.3;
    g.fillRect(ax - Math.round(pw * 0.25), ay - 1, Math.round(pw * 0.5), 2);
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
  var PROPS = {
    acacia: [48, 40, pAcacia], hut: [44, 38, pHut], well: [38, 32, pWell], baobab: [40, 52, pBaobab],
    kraal: [64, 16, pKraal], stall: [40, 38, pStall], mound: [30, 30, pMound], stool: [26, 16, pStool]
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
      A().flame(g, d.sx, d.sy - 4 * S, S, 1, d.now || 0, (e.x * 3 + e.y) | 0);
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
      g.fillStyle = '#F4E2A8';
      for (i = 0; i < 12; i++) {
        wy = 14 + Math.round(hs(i, 1, 700) * (rh - 28)) + (hold ? 0 : (Math.floor(t / 500 + i) & 1));
        p0 = (i * 53 + t * 0.02) % 320;
        kk0 = Math.floor((vl - p0) / 320);
        kk1 = Math.floor((vr - p0) / 320);
        for (k = kk0; k <= kk1; k++) {
          wx = Math.round(p0 + k * 320);
          if (wx < vl || wx >= vr) continue;
          g.fillRect(ox + wx * S, oy + wy * S, S, S);
        }
      }
    }
  });

  NEU.savannaLook = { bake: bake, paints: paints, T: T, MX: MX, MY: MY, props: PROPS, propSprite: propSprite };
})();
