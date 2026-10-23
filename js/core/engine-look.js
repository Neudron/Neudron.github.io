/* engine-look.js — what the rooms look like.
   ───────────────────────────────────────────────────────────────────
   engine.js decides where things are; this file decides what they look
   like. It owns no state about the game — give it a room, a camera and
   a scale and it draws. Everything here is a pure function of those, so
   the sim never waits on art and a missing canvas feature degrades to
   "less pretty", never to "broken".

   The four decisions this file rests on:

   1. VALUE BEFORE HUE. The tileset palettes are this site's own tokens,
      and they are right about hue and wrong about value: floor, wall and
      the lit path sat within a few percent of each other's lightness, so
      the rooms' own rule ("lit ground is walkable") was invisible. Every
      material keeps its tileset's hue and saturation and is re-mapped
      onto a fixed lightness ladder: wall cap darkest, floor, wall face,
      path brightest. Hue is identity; value is readability.

   2. THREE-QUARTER WALLS FROM THE GRID, NO NEW ART. A solid cell with
      open floor below it shows its FACE (lit from above, mortar or bark
      by zone); a solid cell with solid below is a CAP. The floor under a
      face gets a contact shadow. That single rule turns a pattern of
      squares into a place with walls you can see the front of.

   3. THE STATIC WORLD IS BAKED ONCE. Tiles never change, so a room is
      drawn once into an offscreen canvas at one pixel per world unit and
      blitted per frame. Only things that move — ice shimmer, entities,
      weather, light — are drawn every frame.

   4. LIGHT HAS HARD EDGES. The old dark room used a stepped falloff on
      purpose: every pixel on this site has a hard edge and a smooth
      gradient reads as a different program. The lightmap keeps that —
      four bands per light, rendered at quarter resolution and scaled up
      without smoothing, so the bands come out as pixel steps.

   All of it is ES5 and none of it needs a real canvas to run: under the
   test harness every draw is a no-op proxy, and nothing here reads back
   pixels.                                                             */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};

  var reduced = false;
  try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ── colour ──────────────────────────────────────────────────────── */
  function hex2rgb(h) {
    h = String(h || '#000').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgb2hex(r, g, b) {
    function c(v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }
    return '#' + c(r) + c(g) + c(b);
  }
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, s = 0, l = (mx + mn) / 2;
    if (mx !== mn) {
      var d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function hsl2hex(h, s, l) {
    function f(p, q, t) {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    var r, g, b;
    if (!s) { r = g = b = l; }
    else {
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
      r = f(p, q, h + 1 / 3); g = f(p, q, h); b = f(p, q, h - 1 / 3);
    }
    return rgb2hex(r * 255, g * 255, b * 255);
  }
  /* Keep the hue, set the lightness, lift saturation a touch so a very
     dark source colour does not come out grey once it is brighter. */
  function relight(hex, L, satMul) {
    var c = hex2rgb(hex), hsl = rgb2hsl(c[0], c[1], c[2]);
    return hsl2hex(hsl[0], Math.min(1, hsl[1] * (satMul || 1.15)), L);
  }
  function mix(a, b, t) {
    var x = hex2rgb(a), y = hex2rgb(b);
    return rgb2hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
  }
  function shade(hex, k) {             /* k > 1 lighter, k < 1 darker */
    var c = hex2rgb(hex);
    return rgb2hex(c[0] * k, c[1] * k, c[2] * k);
  }
  function rgba(hex, a) {
    var c = hex2rgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  /* Stable per-cell noise. The same cell always gets the same crack. */
  function hash(x, y, s) {
    var h = (x * 374761393 + y * 668265263 + (s || 0) * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /* ── zones ───────────────────────────────────────────────────────────
     Keyed by TILESET name, the same key music.js uses, so there is one
     source of truth for "which zone is this". `floor` is the texture
     style; `ambient` is how much light the room has without any lamp;
     `weather` names an atmosphere below. */
  var ZONES = {
    woods:  { floor: 'grass',   ambient: 0.66, night: '#04060C', weather: 'woods',   warm: '#FFE2A0' },
    castle: { floor: 'flag',    ambient: 0.74, night: '#06040C', weather: 'dust',    warm: '#FFC873' },
    city:   { floor: 'cobble',  ambient: 0.78, night: '#04050C', weather: 'drizzle', warm: '#FFB45E' },
    home:   { floor: 'plank',   ambient: 0.86, night: '#050506', weather: 'dust',    warm: '#F3D2A8' },
    prize:  { floor: 'checker', ambient: 0.84, night: '#06040D', weather: 'sparkle', warm: '#D9B8FF' },
    storm:  { floor: 'wet',     ambient: 0.62, night: '#02030B', weather: 'storm',   warm: '#BFD3FF' }
  };
  var DEFAULT_ZONE = { floor: 'flag', ambient: 0.8, night: '#05050A', weather: null, warm: '#FFE2A0' };
  function zone(name) { return ZONES[name] || DEFAULT_ZONE; }

  /* What each tile character IS, independent of its colour. Solid
     characters come from the tileset; these are the walkable specials. */
  function material(ch, ts) {
    var solid = !ts || ts.solid.indexOf(ch) >= 0;
    if (solid) {
      if (ch === '~') return 'foliage';
      if (ch === '|') return 'pillar';
      if (ch === '+') return 'frame';
      return 'wall';
    }
    if (ch === ',') return 'path';
    if (ch === 'i') return 'ice';
    if (ch === '_') return 'carpet';
    if (ch === '=') return 'floor2';
    if (ch === 'A') return 'plinth';
    if (ch === 'M') return 'mosaic';
    if (ch === 'P') return 'pad';
    return 'floor';
  }

  /* The lightness ladder (decision 1). */
  var LADDER = { cap: 0.075, face: 0.205, faceLo: 0.125, floor: 0.165, floor2: 0.195,
                 path: 0.28, carpet: 0.24, plinth: 0.36, mosaic: 0.25, pad: 0.12,
                 ice: 0.42, foliage: 0.13 };

  /* Resolve every colour a room needs once, per tileset. */
  var palCache = {};
  function palette(tsName, ts) {
    if (palCache[tsName]) return palCache[tsName];
    var c = (ts && ts.colours) || {};
    var base = c['.'] || '#141420', wall = c['#'] || '#16141e';
    var p = {
      cap: relight(wall, LADDER.cap, 1.0),
      capRim: relight(wall, LADDER.cap + 0.09, 1.1),
      face: relight(wall, LADDER.face, 1.0),
      faceLo: relight(wall, LADDER.faceLo, 1.0),
      faceLine: relight(wall, LADDER.faceLo - 0.05, 1.0),
      faceLip: relight(wall, LADDER.face + 0.08, 1.05),
      floor: relight(base, LADDER.floor),
      floor2: relight(c['='] || base, LADDER.floor2),
      floorHi: relight(base, LADDER.floor + 0.035),
      floorLo: relight(base, LADDER.floor - 0.035),
      shadow: relight(base, 0.07, 0.9),
      path: mix(relight(c[','] || base, LADDER.path, 1.3), zone(tsName).warm, 0.3),
      pathHi: mix(relight(c[','] || base, LADDER.path + 0.06, 1.3), zone(tsName).warm, 0.4),
      carpet: relight(c._ || '#3A2140', LADDER.carpet, 1.2),
      carpetHi: relight(c._ || '#3A2140', LADDER.carpet + 0.07, 1.2),
      plinth: relight(c.A || '#6A5C74', LADDER.plinth),
      plinthLo: relight(c.A || '#6A5C74', LADDER.plinth - 0.12),
      mosaic: relight(c.M || '#4A4560', LADDER.mosaic, 1.2),
      pad: relight(c.P || '#221D33', LADDER.pad),
      ice: relight(c.i || '#2E3D52', LADDER.ice, 1.25),
      iceHi: relight(c.i || '#2E3D52', LADDER.ice + 0.18, 1.25),
      leaf: relight(c['~'] || wall, LADDER.foliage, 1.35),
      leafHi: relight(c['~'] || wall, LADDER.foliage + 0.05, 1.3),
      leafLo: relight(c['~'] || wall, LADDER.foliage - 0.06, 1.2),
      pillar: relight(c['|'] || wall, LADDER.face + 0.02),
      pillarHi: relight(c['|'] || wall, LADDER.face + 0.12),
      frame: relight(c['+'] || wall, LADDER.face + 0.04, 1.2),
      frameHi: relight(c['+'] || wall, LADDER.face + 0.14, 1.2)
    };
    palCache[tsName] = p;
    return p;
  }

  /* ── the bake (decision 2 + 3) ───────────────────────────────────── */
  var T = 16;

  function mkCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
    return c;
  }

  /* g: 2d context of a canvas at 1px per world unit. */
  function bakeRoom(room, ts, tsName) {
    var W = room.w * T, H = room.h * T;
    var cv = mkCanvas(W, H);
    var g = cv.getContext && cv.getContext('2d');
    if (!g) return null;
    var z = zone(tsName), p = palette(tsName, ts);
    function at(x, y) {
      if (x < 0 || y < 0 || y >= room.h) return '#';
      var r = room.grid[y];
      return x >= r.length ? '#' : r[x];
    }
    function solid(x, y) { return !ts || ts.solid.indexOf(at(x, y)) >= 0; }
    function rect(c, x, y, w, h) { g.fillStyle = c; g.fillRect(x, y, w, h); }

    var x, y;
    /* pass 1: floors (under everything, so a face can overhang them) */
    for (y = 0; y < room.h; y++) for (x = 0; x < room.w; x++) {
      if (solid(x, y)) continue;
      floorCell(g, rect, p, z, material(at(x, y), ts), x, y, at);
    }
    /* pass 2: contact shadows on floors under walls / beside walls */
    for (y = 0; y < room.h; y++) for (x = 0; x < room.w; x++) {
      if (solid(x, y)) continue;
      var px0 = x * T, py0 = y * T;
      if (solid(x, y - 1)) { g.globalAlpha = 0.55; rect(p.shadow, px0, py0, T, 4); g.globalAlpha = 0.3; rect(p.shadow, px0, py0 + 4, T, 2); g.globalAlpha = 1; }
      if (solid(x - 1, y)) { g.globalAlpha = 0.35; rect(p.shadow, px0, py0, 2, T); g.globalAlpha = 1; }
      if (solid(x + 1, y)) { g.globalAlpha = 0.35; rect(p.shadow, px0 + T - 2, py0, 2, T); g.globalAlpha = 1; }
    }
    /* pass 3: walls — caps and faces */
    for (y = 0; y < room.h; y++) for (x = 0; x < room.w; x++) {
      if (!solid(x, y)) continue;
      wallCell(g, rect, p, z, material(at(x, y), ts), x, y, solid);
    }
    return cv;
  }

  function floorCell(g, rect, p, z, mat, x, y, at) {
    var X = x * T, Y = y * T, i, h = hash(x, y, 1);
    if (mat === 'path') {
      rect(p.path, X, Y, T, T);
      for (i = 0; i < 5; i++) {
        var hx = (hash(x, y, 10 + i) * 14) | 0, hy = (hash(x, y, 20 + i) * 14) | 0;
        rect(i % 2 ? p.pathHi : shade(p.path, 0.86), X + hx, Y + hy, 2, 1);
      }
      /* soft edge where the path meets plain ground — the path reads as
         a worn line, not a pasted rectangle */
      if (at(x, y - 1) !== ',') { g.globalAlpha = 0.35; rect(p.floor, X, Y, T, 1); g.globalAlpha = 1; }
      if (at(x, y + 1) !== ',') { g.globalAlpha = 0.35; rect(p.floor, X, Y + T - 1, T, 1); g.globalAlpha = 1; }
      return;
    }
    if (mat === 'ice') {
      rect(p.ice, X, Y, T, T);
      rect(p.iceHi, X + 2, Y + 3, 5, 1); rect(p.iceHi, X + 9, Y + 10, 4, 1);
      g.globalAlpha = 0.25; rect('#ffffff', X, Y, T, 1); g.globalAlpha = 1;
      return;
    }
    if (mat === 'carpet') {
      rect(p.carpet, X, Y, T, T);
      rect(p.carpetHi, X, Y + 1, T, 1); rect(p.carpetHi, X, Y + T - 2, T, 1);
      if (((x + y) & 1) === 0) { rect(p.carpetHi, X + 7, Y + 7, 2, 2); }
      return;
    }
    if (mat === 'plinth') {
      rect(p.plinth, X, Y, T, T);
      rect(p.plinthLo, X, Y + T - 3, T, 3);
      g.globalAlpha = 0.3; rect('#ffffff', X, Y, T, 1); g.globalAlpha = 1;
      return;
    }
    if (mat === 'mosaic') {
      rect(p.mosaic, X, Y, T, T);
      for (i = 0; i < 4; i++) rect(shade(p.mosaic, 0.8 + hash(x, y, 30 + i) * 0.4), X + (i & 1) * 8 + 1, Y + (i >> 1) * 8 + 1, 6, 6);
      return;
    }
    if (mat === 'pad') { rect(p.pad, X, Y, T, T); rect(shade(p.pad, 0.7), X + 1, Y + 1, T - 2, T - 2); return; }

    var base = mat === 'floor2' ? p.floor2 : p.floor;
    rect(base, X, Y, T, T);
    var hi = shade(base, 1.14), lo = shade(base, 0.86);
    switch (z.floor) {
      case 'grass':
        for (i = 0; i < 7; i++) {
          var gx = (hash(x, y, 40 + i) * 15) | 0, gy = (hash(x, y, 50 + i) * 14) | 0;
          rect(i < 4 ? lo : hi, X + gx, Y + gy, 1, 2);
        }
        if (h > 0.78) { rect(hi, X + 5, Y + 9, 1, 3); rect(hi, X + 7, Y + 8, 1, 4); rect(hi, X + 9, Y + 10, 1, 2); }
        break;
      case 'flag': case 'wet':
        /* four flagstones a cell, each its own shade, 1px mortar */
        for (i = 0; i < 4; i++) {
          var sx = X + (i & 1) * 8, sy = Y + (i >> 1) * 8;
          rect(shade(base, 0.9 + hash(x, y, 60 + i) * 0.22), sx, sy, 8, 8);
          rect(lo, sx, sy + 7, 8, 1); rect(lo, sx + 7, sy, 1, 8);
          rect(hi, sx, sy, 7, 1);
        }
        if (z.floor === 'wet' && h > 0.7) { g.globalAlpha = 0.5; rect('#9FB8FF', X + 3, Y + 11, 6, 1); rect('#9FB8FF', X + 5, Y + 12, 4, 1); g.globalAlpha = 1; }
        if (h < 0.12) { rect(lo, X + 3, Y + 4, 4, 1); rect(lo, X + 6, Y + 5, 2, 1); }
        break;
      case 'cobble':
        for (i = 0; i < 8; i++) {
          var row = i >> 1, off = (row & 1) ? 4 : 0;
          var cx = X + ((i & 1) * 8 + off) % 16, cy = Y + row * 4;
          rect(shade(base, 0.88 + hash(x, y, 70 + i) * 0.26), cx, cy, 7, 3);
          rect(lo, cx, cy + 3, 8, 1);
        }
        break;
      case 'plank':
        for (i = 0; i < 4; i++) {
          rect(shade(base, 0.92 + hash(x, y, 80 + i) * 0.16), X, Y + i * 4, T, 3);
          rect(lo, X, Y + i * 4 + 3, T, 1);
          var seam = (hash(x, y, 90 + i) * 16) | 0;
          rect(lo, X + seam, Y + i * 4, 1, 3);
        }
        if (h > 0.85) rect(shade(base, 0.7), X + 6, Y + 5, 2, 1);
        break;
      case 'checker':
        for (i = 0; i < 4; i++) {
          var kx = X + (i & 1) * 8, ky = Y + (i >> 1) * 8;
          rect(((i + x + y) & 1) ? hi : base, kx, ky, 8, 8);
        }
        rect(lo, X, Y + T - 1, T, 1); rect(lo, X + T - 1, Y, 1, T);
        break;
      default:
        for (i = 0; i < 4; i++) rect(i & 1 ? hi : lo, X + ((hash(x, y, 100 + i) * 15) | 0), Y + ((hash(x, y, 110 + i) * 15) | 0), 1, 1);
    }
  }

  function wallCell(g, rect, p, z, mat, x, y, solid) {
    var X = x * T, Y = y * T;
    var open = !solid(x, y + 1);            /* a face shows */
    var capH = open ? 6 : T;
    var capCol = mat === 'foliage' ? p.leafLo : p.cap;
    rect(capCol, X, Y, T, capH);
    /* rim on the cap wherever it meets open floor — the edge the eye
       uses to read where a wall ends */
    var rim = mat === 'foliage' ? p.leaf : p.capRim;
    if (!solid(x, y - 1)) rect(rim, X, Y, T, 1);
    if (!solid(x - 1, y)) rect(rim, X, Y, 1, capH);
    if (!solid(x + 1, y)) rect(rim, X + T - 1, Y, 1, capH);
    if (mat === 'foliage') {
      /* canopy: a few soft clumps over the cap, one highlight each — a
         hedge, not static */
      for (var i = 0; i < 3; i++) {
        var lx = (hash(x, y, 120 + i) * 10) | 0, ly = (hash(x, y, 130 + i) * (capH > 6 ? capH - 5 : 1)) | 0;
        rect(p.leaf, X + lx, Y + ly, 6, 4);
        rect(p.leafHi, X + lx + 1, Y + ly, 3, 1);
      }
    }
    if (!open) return;
    var fy = Y + capH, fh = T - capH;
    if (mat === 'foliage') {
      rect(p.leaf, X, fy, T, fh);
      for (var j = 0; j < 5; j++) rect(p.leafLo, X + ((hash(x, y, 140 + j) * 15) | 0), fy + 2 + ((hash(x, y, 150 + j) * (fh - 3)) | 0), 1, 3);
      for (var k = 0; k < 4; k++) rect(p.leafHi, X + k * 4 + ((hash(x, y, 160 + k) * 3) | 0), fy, 2, 1);
      /* hanging fringe over the floor */
      rect(p.leafLo, X + 2, Y + T, 2, 1); rect(p.leafLo, X + 9, Y + T, 3, 1);
      return;
    }
    if (mat === 'pillar') {
      rect(p.pillar, X + 2, fy, T - 4, fh);
      rect(p.pillarHi, X + 4, fy, 2, fh);
      rect(p.faceLine, X + 2, fy + fh - 2, T - 4, 2);
      rect(p.faceLo, X, fy, 2, fh); rect(p.faceLo, X + T - 2, fy, 2, fh);
      return;
    }
    if (mat === 'frame') {
      rect(p.frame, X, fy, T, fh);
      rect(p.frameHi, X + 1, fy, T - 2, 1);
      rect(shade(p.frame, 0.7), X + 3, fy + 2, T - 6, fh - 2);
      return;
    }
    /* stone/brick/plaster face, lit from above: a lip, a gradient of two
       bands, and the zone's coursing */
    rect(p.faceLip, X, fy, T, 1);
    rect(p.face, X, fy + 1, T, (fh / 2) | 0);
    rect(p.faceLo, X, fy + 1 + ((fh / 2) | 0), T, fh - 1 - ((fh / 2) | 0));
    var style = z.floor;
    if (style === 'grass') {
      /* bark: vertical grain */
      for (var b = 0; b < 4; b++) rect(p.faceLine, X + 1 + b * 4 + ((hash(x, y, 170 + b) * 2) | 0), fy + 1, 1, fh - 1);
    } else if (style === 'plank') {
      rect(p.faceLine, X, fy + 4, T, 1);
      rect(p.faceLine, X + ((hash(x, y, 180) * 12) | 0) + 2, fy + 1, 1, 3);
    } else {
      /* coursed masonry, offset every other course */
      rect(p.faceLine, X, fy + 4, T, 1); rect(p.faceLine, X, fy + 8, T, 1);
      var off = (x & 1) ? 4 : 0;
      rect(p.faceLine, X + 4 + off, fy + 1, 1, 3); rect(p.faceLine, X + 12 - off, fy + 5, 1, 3);
    }
  }

  /* ── animated tiles ──────────────────────────────────────────────── */
  function drawAnimated(ctx, room, ts, tsName, camX, camY, S, now, v) {
    if (reduced) return;
    var p = palette(tsName, ts);
    var x0 = Math.max(0, Math.floor(camX / T)), y0 = Math.max(0, Math.floor(camY / T));
    var x1 = Math.min(room.w - 1, Math.ceil((camX + v.w) / T)), y1 = Math.min(room.h - 1, Math.ceil((camY + v.h) / T));
    var t = now / 1000;
    for (var y = y0; y <= y1; y++) {
      var r = room.grid[y];
      for (var x = x0; x <= x1; x++) {
        if (r[x] !== 'i') continue;
        /* a glint that sweeps diagonally across the ice */
        var ph = ((t * 0.6 + (x + y) * 0.17) % 1.6);
        if (ph > 1) continue;
        var gx = (ph * 18) | 0;
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = p.iceHi;
        ctx.fillRect(Math.round((x * T + gx - camX) * S), Math.round((y * T + 2 - camY) * S), S, (T - 4) * S);
        ctx.globalAlpha = 1;
      }
    }
  }

  /* ── sprites ─────────────────────────────────────────────────────────
     The project's pixel-art primitive: ASCII rows plus a palette, drawn
     at the world scale so a sprite pixel and a tile pixel are the same
     size on screen. Anchored at the feet. */
  function stamp(ctx, rows, pal, cx, cy, s, opts) {
    var h = rows.length, w = rows[0].length;
    var flip = opts && opts.flip, dy = (opts && opts.dy) || 0, sq = opts && opts.squash;
    var x0 = Math.round(cx - w * s / 2), y0 = Math.round(cy - h * s) + dy * s;
    for (var r = 0; r < h; r++) {
      var row = rows[r];
      for (var c = 0; c < w; c++) {
        var ch = row[flip ? w - 1 - c : c];
        if (ch === '.' || !pal[ch]) continue;
        ctx.fillStyle = pal[ch];
        ctx.fillRect(x0 + c * s, y0 + r * s + (sq && r < h - 3 ? s : 0), s, s);
      }
    }
  }

  /* A soft pixel shadow under anything standing on the floor. */
  function shadow(ctx, cx, cy, wWorld, s, alpha) {
    var w = Math.max(2, Math.round(wWorld)), h = Math.max(1, Math.round(wWorld / 4));
    ctx.globalAlpha = alpha === undefined ? 0.38 : alpha;
    ctx.fillStyle = '#000000';
    for (var i = 0; i < h; i++) {
      var k = 1 - Math.abs((i + 0.5) / h * 2 - 1) * 0.5;
      var ww = Math.round(w * k);
      ctx.fillRect(Math.round(cx - ww * s / 2), Math.round(cy - (h - i) * s + s * 0.5), ww * s, s);
    }
    ctx.globalAlpha = 1;
  }

  /* ── the player ──────────────────────────────────────────────────────
     Same 9-wide character as v1 and dark.js. v2 adds a four-step walk
     (stride, pass, stride, pass) with the body dipping a pixel on each
     stride, a blink, and a one-frame settle when you stop. */
  var PAL = { h: '#241d2e', H: '#3a2f4a', s: '#E8DCC8', S: '#c9b9a2', e: '#241d2e',
              c: '#6F5FA6', C: '#8a7bc4', d: '#54468a', b: '#191426' };
  var BODY = {
    down:  ['..hhhhh..', '.hHhhhHh.', '.hsssssh.', '.hsesesh.', '.hsssssh.',
            '..sssss..', '.cCcccCc.', 'scccccccs', '.cdcccdc.', '..ccccc..'],
    up:    ['..hhhhh..', '.hHhhhHh.', '.hhhhhhh.', '.hhhhhhh.', '.hhhhhhh.',
            '..sssss..', '.cCcccCc.', 'scccccccs', '.cdcccdc.', '..ccccc..'],
    left:  ['..hhhh...', '.hHhhhh..', '.hssssh..', '.essssh..', '.hssssh..',
            '..sssss..', '..cCccc..', '.sccccc..', '..cdccc..', '..cccc...']
  };
  var BLINK = { down: BODY.down.slice(), left: BODY.left.slice() };
  BLINK.down[3] = '.hsssssh.';
  BLINK.left[3] = '.ssssssh.';
  var LEGS = [['..c...c..', '..b...b..', '..b...b..'],   /* stand   */
              ['...c.c...', '...b.b...', '..b...b..'],   /* stride A */
              ['..c...c..', '..bb.bb..', '..b...b..']];  /* stride B */

  function playerRows(face, phase, blink) {
    var f = face === 'right' ? 'left' : face;
    var body = (blink && BLINK[f]) ? BLINK[f] : BODY[f];
    var legs = phase === 1 ? LEGS[1] : phase === 3 ? LEGS[2] : LEGS[0];
    return body.concat(legs);
  }

  /* phase: 0..3 from distance walked; dip on the strides. */
  function walkPhase(walked, moving, period) {
    if (!moving) return 0;
    return (((walked / (period || 6)) | 0) % 4);
  }

  function drawPlayer(ctx, sx, sy, face, walked, moving, s, now, extra) {
    var phase = walkPhase(walked, moving);
    var blink = !moving && !reduced && ((now || 0) % 3600) < 130;
    var dip = (phase === 1 || phase === 3) ? 0 : 0;
    stamp(ctx, playerRows(face, phase, blink), PAL, sx, sy, s,
          { flip: face === 'right', dy: dip, squash: extra && extra.settle && !reduced });
  }

  /* ── figures and props ───────────────────────────────────────────────
     An npc in v1 was an 18px square in its `colour`. Most of them are
     not people — a signpost, a throne, a vase, a fountain — and the ones
     that are should look like someone. Every entry is a sprite at world
     pixel scale; `tint` slots take the entity's own colour so the room
     files keep authoring the palette they always did. */
  var OUT = '#120F18';
  function tintPal(base, tint) {
    var t = tint || '#8A8598';
    var p = { k: OUT, c: relight(t, 0.5, 1.05), C: relight(t, 0.64, 1.05), d: relight(t, 0.34, 1.05),
              D: relight(t, 0.22, 1.0) };
    for (var k in base) p[k] = base[k];
    return p;
  }
  var PROPS = {
    figure: { pal: { f: '#0B0910', e: '#E8DCC8' }, rows: [
      '...kkk...', '..kccck..', '.kcCCcck.', '.kcfffck.', '.kcefeck.', '.kcfffck.', '.kccccck.',
      'kcccdccck', 'kcCddddck', 'kccdddcck', 'kccdddcck', '.kcdddck.', '.kkkkkkk.'] },
    witch: { pal: { f: '#0B0910', e: '#FFB0C0', h: '#1E1426' }, rows: [
      '....k....', '...khk...', '...khk...', '..khhhk..', '.khhhhhk.', 'kkkkkkkkk',
      '.kcfffck.', '.kcefeck.', '.kcfffck.', 'kcccdccck', 'kcCddddck', 'kccdddcck', '.kcdddck.', '.kkkkkkk.'] },
    merchant: { pal: { f: '#2A1E14', e: '#FFF2C4', s: '#E8DCC8', b: '#6B4F2F' }, rows: [
      '..kkkkk..', '.kCCCCCk.', 'kkkkkkkkk', '.kssssk..', '.ksesesk.', '.kssssk..', '..kssk...',
      '.kcccccck', 'kcCbbbCck', 'kccbbbcck', 'kccbbbcck', '.kcbbbck.', '.kkkkkkk.'] },
    sans: { pal: { w: '#EDE7DE', W: '#C9C2D6', e: '#241d2e', b: '#3B4F8A', B: '#2C3B6A', n: '#111017' }, rows: [
      '..kkkkk..', '.kwwwwwk.', 'kwwWwwWwk', 'kwekwkewk', 'kwwwwwwwk', 'kWwnnnwWk', '.kwwwwwk.',
      'kbbbbbbbk', 'kbBbbbBbk', 'kbbbbbbbk', '.kBbbbBk.', '.kwk.kwk.', '.kkk.kkk.'] },
    signpost: { pal: { k: '#2B2014', w: '#8A6A42', l: '#C8B48A', p: '#5A4430' }, rows: [
      'kkkkkkkkkk', 'kwwwwwwwwk', 'kwllllllwk', 'kwwwwwwwwk', 'kwllllwwwk', 'kwwwwwwwwk', 'kkkkkkkkkk',
      '....pp....', '....pp....', '....pp....', '...pppp...'] },
    inscription: { pal: { s: '#5A5470', S: '#7A7290', l: '#B8B0D0', k: '#2A2438' }, rows: [
      'kkkkkkkkkkkk', 'kSSSSSSSSSSk', 'kSllslllsllk', 'kSsssssssssk', 'kSlsllsllslk', 'kSsssssssssk',
      'kSllslllsslk', 'kSsssssssssk', 'kkkkkkkkkkkk'] },
    tree: { pal: { b: '#4A3B2E', B: '#6E5844', k: '#1C150F', g: '#2E3B2A' }, rows: [
      '...k.k.k...', '..kBkBkBk..', '...kbbbk...', '..kBbbbBk..', '...kbbbk...', '....kbk....',
      '....kbk....', '....kbk....', '...kbbbk...', '..kbbkbbk..', '.kgg...ggk.'] },
    throne: { pal: { r: '#5A2A55', R: '#7E3E78', g: '#C8A04A', k: '#1A0F1A' }, rows: [
      '.kkkkkkkkk.', '.kgRRRRRgk.', '.kRrrrrrRk.', '.kRrrrrrRk.', '.kRrrrrrRk.', 'kkgkkkkkgkk',
      'kgRRRRRRRgk', 'kgrrrrrrrgk', 'kkkkkkkkkkk', '.kg.....gk.', '.kk.....kk.'] },
    fountain: { pal: { s: '#6A6480', S: '#8C86A2', d: '#3A3548', k: '#1A1724' }, rows: [
      '.....kk.....', '....kSSk....', '.....ss.....', '.....ss.....', 'kkkkkkkkkkkk', 'kSSSSSSSSSSk',
      'ksddddddddsk', 'ksddddddddsk', 'kssssssssssk', 'kkkkkkkkkkkk'] },
    frame: { pal: { g: '#8A7A4A', G: '#B8A060', d: '#141218', k: '#1A1610' }, rows: [
      'kkkkkkkkkk', 'kGGGGGGGGk', 'kGddddddGk', 'kgddddddgk', 'kgddddddgk', 'kgddddddgk',
      'kGGGGGGGGk', 'kkkkkkkkkk', '..........', '..........'] },
    vase: { pal: { v: '#5E6A8A', V: '#8494B8', l: '#D8E0F0', k: '#1A1E2A' }, rows: [
      '..kkkk..', '...kk...', '..kVVk..', '.kVvvvk.', 'kVlvvvvk', 'kVvvvvvk', 'kvlvlvvk', '.kvvvvk.', '..kkkk..'] },
    door: { pal: { w: '#5A3E2A', W: '#7A5A3E', h: '#C8A04A', k: '#1A100A' }, rows: [
      '.kkkkkkkkkk.', 'kWWWWWWWWWWk', 'kWwwwwwwwwWk', 'kWwkkkkkkwWk', 'kWwkwwwwkwWk', 'kWwkwwwwkwWk',
      'kWwwwwwwwhWk', 'kWwkkkkkkwWk', 'kWwkwwwwkwWk', 'kWwkwwwwkwWk', 'kWwwwwwwwwWk', 'kkkkkkkkkkkk'] },
    gate: { pal: { r: '#7A2A3A', R: '#B83A4E', g: '#FF8A5A', k: '#1A080C' }, rows: [
      '..kkkkkkkk..', '.kRRRRRRRRk.', 'kRrrrrrrrrRk', 'kRrgrrrrgrRk', 'kRrrrggrrrRk', 'kRrrrrrrrrRk',
      'kRrgrrrrgrRk', 'kRrrrrrrrrRk', 'kRrrrrrrrrRk', 'kkkkkkkkkkkk'] },
    bigdoor: { scale: 2, pal: { b: '#2C3B6A', B: '#4A5E9E', l: '#9FB8FF', k: '#080A18' }, rows: [
      '...kkkkkkkkkk...', '..kBBBBBBBBBBk..', '.kBbbbbbbbbbbBk.', 'kBbbllbbbbllbbBk', 'kBbbbbbbbbbbbbBk',
      'kBbbbbbbbbbbbbBk', 'kBbbbbbllbbbbbBk', 'kBbbbbbbbbbbbbBk', 'kBbbbbbbbbbbbbBk', 'kBbbllbbbbllbbBk',
      'kBbbbbbbbbbbbbBk', 'kkkkkkkkkkkkkkkk'] },
    certificate: { pal: { p: '#E8DCC8', l: '#8A8598', r: '#C2405F', k: '#2A2438' }, rows: [
      'kkkkkkkkkk', 'kppppppppk', 'kpllllllpk', 'kppppppppk', 'kplllpppprk', 'kppppppprk', 'kkkkkkkkkk'] },
    chair: { pal: { w: '#6B4F2F', W: '#8A6A42', k: '#1A120A' }, rows: [
      '.kkk....', '.kWk....', '.kWk....', '.kWk....', '.kWkkkkk', '.kWWWWWk', '.kwkkkwk', '.kwk.kwk', '.kkk.kkk'] },
    vending: { pal: { b: '#3A4A7A', B: '#5A6EAA', g: '#9FE0FF', y: '#E4C46A', k: '#0E1020' }, rows: [
      'kkkkkkkkkkk', 'kBBBBBBBBBk', 'kBggggggbBk', 'kBgyggyg bk', 'kBggggggbBk', 'kBgyggygbBk',
      'kBggggggbBk', 'kBbbbbbbbBk', 'kBkkkkkkbBk', 'kBbbbbbbbBk', 'kkkkkkkkkkk'] },
    tank: { pal: { g: '#9FB8C8', G: '#C8DCE8', d: '#1A2430', o: '#E4A64A', k: '#0E1418' }, rows: [
      'kkkkkkkkkkkk', 'kGGGGGGGGGGk', 'kgddddddddgk', 'kgddoddddddk', 'kgdddddoddgk', 'kgddddddddgk', 'kkkkkkkkkkkk', '.kk......kk.'] },
    poster: { pal: { p: '#B892FF', P: '#D9C2FF', y: '#E4C46A', k: '#1E1430' }, rows: [
      'kkkkkkkk', 'kPPPPPPk', 'kPyyppPk', 'kPpyypPk', 'kPppppPk', 'kPpppPPk', 'kPPPPPPk', 'kkkkkkkk'] },
    piano: { pal: { b: '#1E1A24', B: '#3A3444', w: '#EDE7DE', k: '#08070A' }, rows: [
      'kkkkkkkkkkkk', 'kBBBBBBBBBBk', 'kbbbbbbbbbbk', 'kwwkwwkwwbbk', 'kwwkwwkwwbbk', 'kkkkkkkkkkkk', '.kb......bk.', '.kk......kk.'] },
    shelf: { pal: { w: '#5A3E2A', r: '#C2405F', b: '#4A5E9E', g: '#6A9A5A', k: '#1A100A' }, rows: [
      'kkkkkkkkkk', 'kwrbgrbgwk', 'kwrbgrbgwk', 'kkkkkkkkkk', 'kwgrbgrbwk', 'kwgrbgrbwk', 'kkkkkkkkkk', 'kwk....kwk'] },
    smalldoor: { pal: { w: '#6B4F2F', W: '#8A6A42', h: '#E4C46A', k: '#1A100A' }, rows: [
      '.kkk.', 'kWWWk', 'kWwhk', 'kWWWk', 'kkkkk'] },
    stairs: { pal: { s: '#4A4560', S: '#6A6480', d: '#14121C', k: '#0A090E' }, rows: [
      'kkkkkkkkkkkk', 'kddddddddddk', 'kSSSSSSSSSSk', 'kdddddddddsk', 'kSSSSSSSSssk', 'kddddddddsssk', 'kkkkkkkkkkkk'] },
    pot: { pal: { p: '#8A5A3A', P: '#B87A4E', l: '#FF6BD6', k: '#1E120A' }, rows: [
      '.kkkkkkkkkk.', 'kPPPPPPPPPPk', '.kpppppppk..', 'kpPppppppppk', 'kpPplplplppk', 'kppppppppppk', '.kppppppppk.', '..kkkkkkkk..'] },
    stone: { pal: { s: '#5A5470', S: '#7A7290', l: '#C8C0E0', k: '#1E1A28' }, rows: [
      '..kkkkkk..', '.kSSSSSSk.', 'kSssssssSk', 'kSslllsssk', 'kSsslllssk', 'kSssssssSk', 'kssssssssk', '.kkkkkkkk.'] },
    mirror: { pal: { f: '#8A7A4A', F: '#C8A04A', m: '#9FB8D8', M: '#E8F0FF', k: '#1A1610' }, rows: [
      '..kkkkkk..', '.kFFFFFFk.', 'kFmmmmMmFk', 'kFmmmMmmFk', 'kFmmMmmmFk', 'kFmMmmmmFk', 'kFmmmmmmFk', '.kFFFFFFk.', '...kffk...', '..kffffk..'] },
    torch: { pal: { w: '#6B4F2F', f: '#FFB347', F: '#FFE6A0', r: '#E4602A', k: '#1A100A' }, rows: [
      '...F...', '..FfF..', '..fFf..', '.rfFfr.', '..rfr..', '..kwk..', '..kwk..', '..kwk..', '..kkk..'] },
    socket: { pal: { m: '#4A4458', M: '#6A6478', k: '#14121A' }, rows: [
      '.kkkkk.', 'kMmmmMk', 'kmkkkmk', 'kMmmmMk', '.kkkkk.', '..kmk..', '..kkk..'] }
  };
  /* "vending" row 3 had a typo'd space; normalise every sprite once so a
     stray character can never shift a row. */
  (function () {
    for (var k in PROPS) {
      var rows = PROPS[k].rows, w = 0, i;
      for (i = 0; i < rows.length; i++) { rows[i] = rows[i].replace(/ /g, 'b'); w = Math.max(w, rows[i].length); }
      for (i = 0; i < rows.length; i++) while (rows[i].length < w) rows[i] += '.';
    }
  })();

  /* Which prop a plain npc is, from its own first line, when the room
     did not say. Order matters: "a very small door" before "door". */
  var INFER = [
    [/signpost|two ways/, 'signpost'], [/riddle|plaque|written .* on the wall/, 'inscription'],
    [/trees/, 'tree'], [/throne/, 'throne'], [/fountain/, 'fountain'], [/picture frame/, 'frame'],
    [/vase/, 'vase'], [/certificate/, 'certificate'], [/chair/, 'chair'], [/vending/, 'vending'],
    [/fish tank/, 'tank'], [/poster/, 'poster'], [/piano/, 'piano'], [/shelf|books/, 'shelf'],
    [/very small door/, 'smalldoor'], [/staircase/, 'stairs'], [/door/, 'door'], [/pot\b/, 'pot']
  ];
  function lookFor(e) {
    if (e.look && PROPS[e.look]) return e.look;
    if (e.stone) return 'stone';
    if (e.mirror) return 'mirror';
    if (e.torch) return 'torch';
    if (e.socket) return 'socket';
    if (e.key === 'witch') return 'witch';
    var first = String((e.lines && e.lines[0]) || '');
    for (var i = 0; i < INFER.length; i++) if (INFER[i][0].test(first)) return INFER[i][1];
    return 'figure';
  }
  /* These look like people and breathe; props hold still. */
  var LIVING = { figure: 1, witch: 1, merchant: 1, sans: 1 };

  function drawProp(ctx, name, tint, cx, cy, s, now, seed) {
    var pr = PROPS[name] || PROPS.figure;
    var bob = (LIVING[name] && !reduced) ? ((((now || 0) + seed * 700) % 1400) < 700 ? 0 : -1) : 0;
    stamp(ctx, pr.rows, tintPal(pr.pal, tint), cx, cy, s * (pr.scale || 1), { dy: bob });
    return pr;
  }
  function propWidth(name) { var pr = PROPS[name] || PROPS.figure; return pr.rows[0].length * (pr.scale || 1); }

  /* ── light ───────────────────────────────────────────────────────── */
  var LQ = 4;                     /* screen px per lightmap px */
  var lcv = null, lctx = null;
  function lightCanvas(w, h) {
    var W = Math.ceil(w / LQ) + 1, H = Math.ceil(h / LQ) + 1;
    if (!lcv) { lcv = mkCanvas(W, H); lctx = lcv.getContext && lcv.getContext('2d'); }
    if (lcv.width !== W || lcv.height !== H) { lcv.width = W; lcv.height = H; }
    return lctx;
  }
  /* Four hard bands, centre fully lit. `a` scales the whole light. */
  function cutLight(g, x, y, r, a) {
    if (r <= 0) return;
    var gr = g.createRadialGradient(x, y, 0, x, y, r);
    var k = a === undefined ? 1 : a;
    gr.addColorStop(0, 'rgba(0,0,0,' + k + ')');
    gr.addColorStop(0.42, 'rgba(0,0,0,' + k + ')');
    gr.addColorStop(0.43, 'rgba(0,0,0,' + (k * 0.72) + ')');
    gr.addColorStop(0.66, 'rgba(0,0,0,' + (k * 0.72) + ')');
    gr.addColorStop(0.67, 'rgba(0,0,0,' + (k * 0.4) + ')');
    gr.addColorStop(0.88, 'rgba(0,0,0,' + (k * 0.4) + ')');
    gr.addColorStop(0.89, 'rgba(0,0,0,' + (k * 0.14) + ')');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function glow(ctx, x, y, r, col, a) {
    var gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(col, a));
    gr.addColorStop(0.5, rgba(col, a * 0.5));
    gr.addColorStop(0.51, rgba(col, a * 0.25));
    gr.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = gr;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  /* lights: [{x, y, r, col, a, glow}] in WORLD units. */
  function drawLight(ctx, w, h, ambient, night, lights, camX, camY, S) {
    if (ambient >= 0.999 && !lights.length) return;
    var g = lightCanvas(w, h);
    if (!g) return;
    var W = lcv.width, H = lcv.height;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, W, H);
    g.fillStyle = rgba(night, Math.max(0, Math.min(1, 1 - ambient)));
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-out';
    var k = S / LQ, i, L;
    for (i = 0; i < lights.length; i++) {
      L = lights[i];
      cutLight(g, (L.x - camX) * k, (L.y - camY) * k, L.r * k, L.a);
    }
    g.globalCompositeOperation = 'source-over';
    var smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(lcv, 0, 0, W * LQ, H * LQ);
    ctx.imageSmoothingEnabled = smooth;
    /* additive colour where lamps are — the warmth, not just the absence
       of dark */
    var op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < lights.length; i++) {
      L = lights[i];
      if (!L.col || !L.glow) continue;
      glow(ctx, Math.round((L.x - camX) * S), Math.round((L.y - camY) * S), L.r * S * 0.7, L.col, L.glow);
    }
    ctx.globalCompositeOperation = op;
  }

  /* ── atmosphere ──────────────────────────────────────────────────────
     A handful of particles per zone, in world space, so they scroll with
     the room. Counts are small on purpose and scale down with the
     reduce-particles switch; under reduced motion nothing drifts. */
  var parts = [], wKind = null, wRoom = null, flash = 0, nextBolt = 0;
  function noParticles() { return !!(NEU.juice && NEU.juice.noParticles); }
  function noFlash() { return reduced || !!(NEU.juice && NEU.juice.noFlash); }

  function weatherReset(kind, room) {
    parts = []; wKind = kind; wRoom = room; flash = 0; nextBolt = 4 + Math.random() * 6;
    if (!kind || reduced) return;
    var n = { woods: 22, dust: 26, drizzle: 70, storm: 140, sparkle: 18 }[kind] || 0;
    if (noParticles()) n = Math.ceil(n * 0.3);
    var W = room.w * T, H = room.h * T;
    for (var i = 0; i < n; i++) parts.push(spawn(kind, W, H, true, i));
  }
  function spawn(kind, W, H, anywhere, i) {
    var p = { x: Math.random() * W, y: anywhere ? Math.random() * H : -8, t: Math.random() * 10, k: 0, life: 0 };
    if (kind === 'woods') { p.k = (i % 3 === 0) ? 1 : 0; p.vx = (Math.random() - 0.5) * 6; p.vy = p.k ? 8 + Math.random() * 6 : 0; }
    else if (kind === 'dust') { p.vx = (Math.random() - 0.5) * 3; p.vy = -1 - Math.random() * 2; }
    else if (kind === 'drizzle') { p.vx = -18; p.vy = 160 + Math.random() * 60; p.len = 4; }
    else if (kind === 'storm') { p.vx = -70; p.vy = 300 + Math.random() * 120; p.len = 8; }
    else if (kind === 'sparkle') { p.life = Math.random() * 1.4; }
    return p;
  }
  function weatherStep(dt, room) {
    if (!wKind || reduced || room !== wRoom) return;
    var W = room.w * T, H = room.h * T;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.t += dt;
      if (wKind === 'woods' && !p.k) {             /* firefly */
        p.x += Math.sin(p.t * 0.9 + i) * 6 * dt; p.y += Math.cos(p.t * 0.7 + i * 2) * 5 * dt;
      } else if (wKind === 'sparkle') {
        p.life -= dt;
        if (p.life <= 0) { parts[i] = spawn(wKind, W, H, true, i); parts[i].life = 1.4; }
        continue;
      } else {
        p.x += (p.vx + (wKind === 'woods' ? Math.sin(p.t * 2 + i) * 8 : 0)) * dt;
        p.y += p.vy * dt;
      }
      if (p.y > H + 8 || p.x < -16 || p.x > W + 16 || p.y < -16) parts[i] = spawn(wKind, W, H, wKind === 'dust' || (wKind === 'woods' && !p.k), i);
    }
    if (wKind === 'storm' && !noFlash()) {
      nextBolt -= dt;
      if (nextBolt <= 0) { flash = 1; nextBolt = 5 + Math.random() * 7; }
    }
    if (flash > 0) flash = Math.max(0, flash - dt * 6);
  }
  function weatherDraw(ctx, camX, camY, S, w, h) {
    if (!wKind || reduced) return;
    var i, p, x, y;
    var op = ctx.globalCompositeOperation;
    for (i = 0; i < parts.length; i++) {
      p = parts[i];
      x = Math.round((p.x - camX) * S); y = Math.round((p.y - camY) * S);
      if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
      if (wKind === 'woods') {
        if (p.k) {   /* leaf */
          ctx.fillStyle = (i & 1) ? '#5E7A3A' : '#8A6A2E';
          ctx.fillRect(x, y, S * 2, S);
        } else {     /* firefly: a lit pixel and a soft halo */
          var a = 0.45 + 0.55 * Math.max(0, Math.sin(p.t * 2.2 + i));
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a * 0.35; ctx.fillStyle = '#D8F27A';
          ctx.fillRect(x - S, y - S, S * 3, S * 3);
          ctx.globalAlpha = a; ctx.fillRect(x, y, S, S);
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = op;
        }
      } else if (wKind === 'dust') {
        ctx.globalAlpha = 0.18 + 0.18 * Math.sin(p.t * 1.3 + i);
        ctx.fillStyle = '#E8DCC8'; ctx.fillRect(x, y, S, S);
        ctx.globalAlpha = 1;
      } else if (wKind === 'drizzle' || wKind === 'storm') {
        ctx.globalAlpha = wKind === 'storm' ? 0.42 : 0.3;
        ctx.fillStyle = '#9FB8FF';
        var L = p.len;
        for (var s2 = 0; s2 < L; s2++) ctx.fillRect(x + Math.round(p.vx / p.vy * s2 * S), y - s2 * S, S, S);
        ctx.globalAlpha = 1;
      } else if (wKind === 'sparkle') {
        var k = Math.sin((p.life / 1.4) * Math.PI);
        ctx.globalAlpha = k * 0.8; ctx.fillStyle = '#E8DAFF';
        ctx.fillRect(x, y - S, S, S * 3); ctx.fillRect(x - S, y, S * 3, S);
        ctx.globalAlpha = 1;
      }
    }
    if (flash > 0) {
      ctx.globalAlpha = flash * 0.32; ctx.fillStyle = '#DDE6FF';
      ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;
    }
  }

  /* ── the prompt ──────────────────────────────────────────────────────
     A small key cap above whatever you can use — the letter on a
     keyboard, three dots on a phone. It eases in and bobs. */
  var GLYPH_E = ['111', '100', '110', '100', '111'];
  function drawPrompt(ctx, cx, cy, s, t, touch) {
    var u = Math.max(2, Math.round(s * 0.75));
    var bob = reduced ? 0 : Math.round(Math.sin(t * 5) * u * 0.6);
    var w = 9 * u, h = 9 * u, x = Math.round(cx - w / 2), y = Math.round(cy - h) + bob;
    ctx.fillStyle = OUT; ctx.fillRect(x - u, y, w + 2 * u, h); ctx.fillRect(x, y - u, w, h + 2 * u);
    ctx.fillStyle = '#EDE7DE'; ctx.fillRect(x, y, w, h - u);
    ctx.fillStyle = '#B8B0C8'; ctx.fillRect(x, y + h - 2 * u, w, u);
    ctx.fillStyle = OUT;
    if (touch) {
      ctx.fillRect(x + 2 * u, y + 4 * u, u, u); ctx.fillRect(x + 4 * u, y + 4 * u, u, u); ctx.fillRect(x + 6 * u, y + 4 * u, u, u);
    } else {
      for (var r = 0; r < 5; r++) for (var c = 0; c < 3; c++)
        if (GLYPH_E[r][c] === '1') ctx.fillRect(x + (3 + c) * u, y + (1 + r) * u, u, u);
    }
    /* the tail, pointing at the thing */
    ctx.fillStyle = OUT; ctx.fillRect(x + 3 * u, y + h, 3 * u, u);
    ctx.fillStyle = '#EDE7DE'; ctx.fillRect(x + 4 * u, y + h - u, u, u);
  }

  /* ── transitions ─────────────────────────────────────────────────────
     An iris: a stepped circle closing on the player, opening on the
     spawn. k = 0 open, 1 closed. */
  function drawIris(ctx, w, h, cx, cy, k) {
    if (k <= 0) return;
    if (k >= 1) { ctx.fillStyle = '#050507'; ctx.fillRect(0, 0, w, h); return; }
    var R = Math.sqrt(w * w + h * h);
    var steps = 10, r = Math.round((1 - k) * steps) / steps * R;
    ctx.fillStyle = '#050507';
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.moveTo(cx + r, cy);
    ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2, true);
    ctx.fill('evenodd');
  }

  NEU.engineLook = {
    zone: zone, palette: palette, material: material, bakeRoom: bakeRoom,
    drawAnimated: drawAnimated, stamp: stamp, shadow: shadow,
    drawPlayer: drawPlayer, playerRows: playerRows, walkPhase: walkPhase,
    lookFor: lookFor, drawProp: drawProp, propWidth: propWidth, props: PROPS, living: LIVING,
    drawLight: drawLight, glow: glow,
    weatherReset: weatherReset, weatherStep: weatherStep, weatherDraw: weatherDraw,
    get weather() { return { kind: wKind, count: parts.length, flash: flash }; },
    drawPrompt: drawPrompt, drawIris: drawIris,
    relight: relight, mix: mix, shade: shade, rgba: rgba, hash: hash,
    get reduced() { return reduced; },
    /* tests flip this to exercise the reduced-motion path */
    setReduced: function (on) { reduced = !!on; }
  };
})();
