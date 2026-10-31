/* engine-doors.js — the art of every way out of a room.
   ───────────────────────────────────────────────────────────────────
   Exits are WALKED into (engine.js walkExits), so the art has to say
   "go through here" on its own: a passage that reads at a glance, from
   whichever wall it sits in, and that tells you whether it will let you.

   engine-kinds.js asks this module first:
     NEU.engineDoors.draw(g, e, d)  -> true when it drew (false for a
                                       `sheet` exit: the sheet draws)
     NEU.engineDoors.light(e, d)    -> a light record, or null, or
                                       undefined to keep the default

   One style per kind of passage (STYLES below). Each is drawn for four
   views, from the side the room is on (d.side):
     's'  the exit is in the north wall:   seen FACE-ON           'F'
     'n'  the exit is in the south wall:   a lit threshold, gap   'B'
     'e'  the exit is in the west wall:    seen EDGE-ON           'E'
     'w'  the exit is in the east wall:    'E', mirrored
   and floor pieces (a hatch, a stairwell) are 'H' whatever the side.

   Every piece has a SHUT state (barred, chained, boarded, unlit, cold
   blue) and an OPEN one (warm light spilling onto the floor), and it
   leans toward you as you come close (d.near): the door opens a crack,
   the curtain parts, the portcullis lifts, the light grows, and gold
   chevrons on the floor point through it.

   PERFORMANCE. Each (style, view, state, near-step, scale, zone) is
   painted ONCE into two offscreen canvases — the piece, and the light
   it spills (blitted additively) — and every frame is two drawImage
   calls plus a handful of fillRects for what moves (motes, vines,
   sparkles, chevrons). Nothing in draw() builds a gradient, a string
   or an object after the first frame an exit is seen. Under reduced
   motion nothing moves at all: the chevrons hold still and the light
   does not flicker.                                                    */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var T = 16;

  /* the bake box, in world px, and where the feet anchor sits in it */
  var BW = 60, BH = 68, AX = 30, AY = 46;

  function look() { return NEU.engineLook; }
  function reduced() { var L = look(); return !!(L && L.reduced); }

  /* ── colour ───────────────────────────────────────────────────────── */
  var OUT = '#0A0810', VOID = '#030305';
  var WOOD = ['#2A1812', '#43281A', '#5E3B24', '#7C5432'];
  var IRON = ['#16141C', '#2E2C3A', '#4E4A60', '#7E7A98'];
  var GOLD = ['#6E5020', '#A8802E', '#E0B44A', '#FFE08A'];
  var DULL = ['#3A3428', '#5E5440', '#8A7A4A', '#A89868'];   /* a lock's brass */
  var COLD = ['#0E1226', '#1E2A4E', '#4A64A8', '#9FB8FF'];
  var VELV = ['#22081A', '#3E0F2C', '#62183F', '#8E2C58'];
  var THORN = ['#1A1018', '#3A2433', '#5E3E52', '#86627A'];

  /* used when the engine has not registered the tileset (the gallery) */
  var TS_FALLBACK = {
    woods:  { '#': '#0B0E14', '.': '#0D1119', '~': '#101725', ',': '#1C2333' },
    castle: { '#': '#191426', '.': '#1A1726', '|': '#2A2238', ',': '#221D33' },
    city:   { '#': '#0E1018', '.': '#141824', '|': '#1A1D28', ',': '#1E2434' },
    home:   { '#': '#1A1A1E', '.': '#212127', '|': '#232329', ',': '#26262D' },
    prize:  { '#': '#14121C', '.': '#1A1724', '|': '#221E2E', ',': '#241F33' },
    storm:  { '#': '#0A0C18', '.': '#101426', '|': '#141A30', ',': '#1A2140' }
  };
  var WARM = { woods: '#FFE2A0', castle: '#FFC873', city: '#FFB45E', home: '#F3D2A8',
               prize: '#D9B8FF', storm: '#BFD3FF' };

  function hx(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) {
    var L = look(); if (L && L.mix) return L.mix(a, b, t);
    var x = hx(a), y = hx(b), o = '#';
    for (var i = 0; i < 3; i++) { var v = Math.round(x[i] + (y[i] - x[i]) * t); o += (v < 16 ? '0' : '') + v.toString(16); }
    return o;
  }
  function relight(c, l, s) { var L = look(); return (L && L.relight) ? L.relight(c, l, s) : c; }

  /* Everything a piece is painted with, per zone and tint. Built once. */
  var palCache = {};
  function colours(ts, tint, hue) {
    var key = ts + '|' + (tint || '') + '|' + (hue || '');
    if (palCache[key]) return palCache[key];
    var tsd = null;
    try { tsd = NEU.engine && NEU.engine.tilesets && NEU.engine.tilesets()[ts]; } catch (err) { tsd = null; }
    var c = (tsd && tsd.colours) || TS_FALLBACK[ts] || TS_FALLBACK.castle;
    var L = look();
    var warm = tint || (L && L.zone ? L.zone(ts).warm : null) || WARM[ts] || '#FFE2A0';
    var wall = c['#'] || '#16141E', base = c['.'] || '#141420', leaf = c['~'] || '#101725';
    var P = {
      warm: warm,
      /* the light ramp: L4 is the core, L0 the edge of the spill */
      L: [mix(warm, '#120A10', 0.82), mix(warm, '#2A1418', 0.6), mix(warm, '#7A3A28', 0.35), warm, mix(warm, '#FFFFFF', 0.55)],
      cap: relight(wall, 0.075, 1.0), rim: relight(wall, 0.165, 1.1),
      face: relight(wall, 0.205, 1.0), faceLo: relight(wall, 0.125, 1.0),
      floor: relight(base, 0.165), floorLo: relight(base, 0.11),
      /* the zone's stone, a step brighter than its walls so a frame reads */
      st: [relight(wall, 0.1, 1.1), relight(wall, 0.18, 1.1), relight(wall, 0.27, 1.15), relight(wall, 0.37, 1.2), relight(wall, 0.5, 1.2)],
      fol: [relight(leaf, 0.06, 1.3), relight(leaf, 0.11, 1.35), relight(leaf, 0.17, 1.35), relight(leaf, 0.25, 1.3), relight(leaf, 0.36, 1.25)],
      path: mix(relight(c[','] || base, 0.28, 1.3), warm, 0.3),
      /* the magic: a portal / rift / frame's own colour */
      M: null
    };
    var m = hue || tint || (ts === 'storm' ? '#9FB8FF' : '#B892FF');
    P.M = [mix(m, '#06040C', 0.8), mix(m, '#0E0820', 0.55), mix(m, '#1A1030', 0.25), m, mix(m, '#FFFFFF', 0.6)];
    palCache[key] = P;
    return P;
  }

  /* ── the painter ──────────────────────────────────────────────────────
     R() paints world px into the bake canvas, mirrored for a west-facing
     ('w') piece so every edge-on drawing is written once. */
  var P = { g: null, S: 1, fl: false };
  function R(c, x, y, w, h) {
    if (w <= 0 || h <= 0) return;
    if (P.fl) x = -x - w;
    P.g.fillStyle = c;
    P.g.fillRect((AX + x) * P.S, (AY + y) * P.S, w * P.S, h * P.S);
  }
  function A(a) { P.g.globalAlpha = a; }
  function D(c, x, y) { R(c, x, y, 1, 1); }
  /* a little sprite from rows; '.' is empty, other chars index pal */
  function stamp(rows, pal, x, y) {
    for (var r = 0; r < rows.length; r++) for (var k = 0; k < rows[r].length; k++) {
      var ch = rows[r].charAt(k);
      if (ch !== '.' && pal[ch]) R(pal[ch], x + k, y + r, 1, 1);
    }
  }
  /* rows of [y, x0, x1) spans — the outline of an arch, an oval, a mouth */
  function spans(c, list) { for (var i = 0; i < list.length; i += 3) R(c, list[i + 1], list[i], list[i + 2] - list[i + 1], 1); }
  /* a symmetric shape from half-widths, rows from y0 down */
  function sym(c, y0, half, cx) {
    cx = cx || 0;
    for (var i = 0; i < half.length; i++) if (half[i] > 0) R(c, cx - half[i], y0 + i, half[i] * 2, 1);
  }

  var PADLOCK = ['.sss.', 's...s', 's...s', 'kkkkk', 'kGGGk', 'kGkGk', 'kgggk', 'kkkkk'];
  function padlock(x, y) { stamp(PADLOCK, { s: IRON[3], k: OUT, G: DULL[3], g: DULL[2] }, x, y); }
  /* a chain on a slope from (x0,y0) to (x1,y1), links alternating */
  function chain(x0, y0, x1, y1) {
    var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (var i = 0; i <= n; i += 2) {
      var x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
      if ((i >> 1) & 1) { R(OUT, x - 1, y - 1, 3, 3); R(IRON[2], x, y - 1, 1, 3); }
      else { R(OUT, x - 1, y - 1, 3, 3); R(IRON[3], x - 1, y, 3, 1); }
    }
  }
  /* a plank, nailed, on a slope */
  function plank(x0, y0, x1, y1, wd) {
    var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (var i = 0; i <= n; i++) {
      var x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
      R(OUT, x - 1, y - 1, 3, 4); R(wd[2], x - 1, y, 3, 2); R(wd[3], x - 1, y, 3, 1);
    }
    D(IRON[3], Math.round(x0 + (x1 - x0) * 0.15), Math.round(y0 + (y1 - y0) * 0.15) + 1);
    D(IRON[3], Math.round(x0 + (x1 - x0) * 0.85), Math.round(y0 + (y1 - y0) * 0.85) + 1);
  }
  /* the stepped spill of light on the floor, in front of a passage.
     F: down from y 0; B: up from y -16; E: right from x 8. */
  function spill(o, c, mid, w0, len, a) {
    for (var r = 0; r < len; r++) {
      var w = w0 + 2 * ((o === 'E' ? r / 3 : r * 2 / 3) | 0);
      var k = r < len * 0.34 ? 1 : r < len * 0.67 ? 0.6 : 0.3;
      A(a * k);
      if (o === 'F' || o === 'H') R(c, mid - (w >> 1), r, w, 1);
      else if (o === 'B') R(c, mid - (w >> 1), -17 - r, w, 1);
      else R(c, 8 + r, mid - (w >> 1), 1, w);
    }
    A(1);
  }

  /* ── the styles ───────────────────────────────────────────────────────
     draw(o, open, nl, C, v)  the piece        o: 'F'|'B'|'E'|'H'
     glow(o, open, nl, C, v)  the light it spills (added)
     anim(o, open, near, t, C, v)  per frame: small things that move
     nl is the near step: 0 far, 1 close, 2 touching. v = variant. */
  var STYLES = {};
  var DESC = {};
  function style(name, desc, def) { STYLES[name] = def; DESC[name] = desc; }

  /* ── door ─────────────────────────────────────────────────────────── */
  function doorFrame(C) { return C.ts === 'castle' || C.ts === 'prize' ? C.st : C.wood; }
  style('door', 'a wooden door in a frame: iron straps, a gold ring; it opens a crack as you come near and the room beyond spills out',
  {
    draw: function (o, open, nl, C) {
      var fr = doorFrame(C), w = C.ts === 'home' ? ['#3A3036', '#55464C', '#706066', '#8E7C80'] : WOOD;
      var lw, k;
      if (o === 'F') {
        R(OUT, -8, -24, 16, 24);
        R(fr[1], -7, -23, 14, 23); R(fr[2], -7, -23, 14, 1); R(fr[2], -7, -23, 1, 23); R(fr[0], 6, -22, 1, 22);
        R(OUT, -2, -25, 4, 3); R(open ? GOLD[2] : fr[3], -1, -24, 2, 2);
        R(OUT, -6, -20, 12, 20);
        /* behind the leaf: the other room, or cold dark */
        if (open) {
          R(C.L[1], -5, -19, 10, 19); R(C.L[2], -4, -17, 8, 17); R(C.L[3], -3, -14, 6, 14); R(C.L[4], -2, -10, 4, 10);
          R(C.L[3], -5, -3, 10, 3); R(C.L[4], -4, -2, 8, 2);
        } else R(COLD[0], -5, -19, 10, 19);
        lw = open ? [10, 6, 2][nl] : 10;
        R(w[1], -5, -19, lw, 19);
        for (k = 3; k < lw; k += 3) R(w[0], -5 + k, -19, 1, 19);
        R(w[2], -5, -19, lw, 1); R(w[2], -5, -19, 1, 19);
        if (lw < 10) { R(w[0], -6 + lw, -19, 1, 19); R(OUT, -5 + lw, -19, 1, 19); }
        R(IRON[1], -5, -16, Math.min(lw, 7), 2); R(IRON[2], -5, -16, Math.min(lw, 7), 1);
        R(IRON[1], -5, -6, Math.min(lw, 7), 2); R(IRON[2], -5, -6, Math.min(lw, 7), 1);
        if (lw >= 6) { var hx0 = -5 + lw - 3; R(OUT, hx0 - 1, -12, 3, 4); R(GOLD[1], hx0, -11, 1, 2); D(GOLD[3], hx0, -11); }
        /* the arch at the top of the opening */
        R(OUT, -5, -19, 2, 1); R(OUT, 3, -19, 2, 1); D(OUT, -5, -18); D(OUT, 4, -18);
        R(fr[3], -7, -1, 3, 1); R(fr[3], 4, -1, 3, 1);
        if (!open) {
          R(OUT, -8, -12, 16, 4); R(IRON[1], -7, -11, 14, 2); R(IRON[2], -7, -11, 14, 1);
          D(IRON[3], -6, -11); D(IRON[3], 5, -11);
          padlock(-2, -14);
        }
      } else if (o === 'E') {
        /* the passage through the wall, its far wall in shadow */
        R(OUT, -8, -23, 16, 23);
        if (open) {
          R(C.L[0], -8, -20, 12, 8);
          R(C.L[1], -8, -12, 12, 12); R(C.L[2], -8, -11, 9, 10); R(C.L[3], -8, -10, 5, 8); R(C.L[4], -8, -9, 2, 6);
        } else { R(COLD[0], -8, -20, 12, 20); R(VOID, -8, -12, 6, 10); }
        /* the lintel running back into the wall, and the front post */
        R(fr[1], -8, -23, 12, 3); R(fr[2], -8, -23, 12, 1);
        R(OUT, 3, -24, 5, 24); R(fr[1], 4, -23, 3, 23); R(fr[3], 4, -23, 1, 23); R(fr[2], 4, -23, 3, 1);
        R(C.cap, -8, -2, 11, 2); R(C.rim, -8, -2, 11, 1);
        lw = open ? nl : 0;
        if (lw === 0) {
          /* shut: the leaf is a thick plank across the passage */
          R(OUT, -3, -20, 5, 18); R(w[1], -2, -20, 3, 18); R(w[3], 0, -20, 1, 18);
          R(w[0], -2, -14, 3, 1); R(w[0], -2, -8, 3, 1);
          R(IRON[2], -2, -17, 3, 1); R(IRON[2], -2, -5, 3, 1);
          R(OUT, 1, -12, 2, 3); R(GOLD[2], 1, -11, 1, 1);
        } else {
          /* swung in against the far wall: now you see its face */
          var fw = lw === 1 ? 4 : 8, fx = 1 - fw;
          R(OUT, fx - 1, -21, fw + 2, lw === 1 ? 18 : 14);
          R(w[lw === 1 ? 0 : 1], fx, -20, fw, lw === 1 ? 16 : 12);
          for (k = 2; k < fw; k += 3) R(w[0], fx + k, -20, 1, lw === 1 ? 16 : 12);
          R(w[2], fx, -20, fw, 1);
          R(IRON[2], fx, -17, Math.min(fw, 5), 1); R(IRON[2], fx, -11, Math.min(fw, 5), 1);
        }
        if (!open) { chain(-7, -18, 2, -4); padlock(-2, -15); }
      } else {
        /* B: the jambs' tops, a stone sill, and the gap beyond */
        R(OUT, -8, -16, 16, 16);
        if (open) { R(C.L[1], -5, -14, 10, 14); R(C.L[2], -5, -10, 10, 10); R(C.L[3], -4, -6, 8, 6); R(C.L[4], -3, -3, 6, 3); }
        else R(COLD[0], -5, -14, 10, 14);
        R(fr[1], -8, -16, 3, 16); R(fr[3], -8, -16, 3, 1); R(fr[2], -6, -16, 1, 16);
        R(fr[1], 5, -16, 3, 16); R(fr[3], 5, -16, 3, 1); R(fr[2], 5, -16, 1, 16);
        R(C.st[3], -5, -16, 10, 1); R(C.st[2], -5, -15, 10, 1);
        lw = open ? [10, 5, 2][nl] : 10;
        if (lw > 2) {
          R(OUT, -5, -12, lw, 5); R(w[1], -5, -11, lw, 3); R(w[3], -5, -11, lw, 1);
          for (k = 3; k < lw; k += 3) R(w[0], -5 + k, -11, 1, 3);
          D(IRON[3], -4, -10); if (lw > 6) D(IRON[3], 3, -10);
        } else { R(OUT, -5, -14, 3, 12); R(w[2], -5, -14, 2, 11); }
        /* the mat, on the floor in front */
        R(OUT, -7, -22, 14, 6); R(VELV[1], -6, -21, 12, 4); R(VELV[2], -5, -20, 10, 2);
        for (k = -6; k < 6; k += 2) D(open ? GOLD[2] : DULL[1], k, -18);
        if (!open) { R(OUT, -7, -10, 14, 3); R(IRON[2], -6, -9, 12, 1); padlock(-2, -12); }
      }
    },
    glow: function (o, open, nl, C) {
      if (!open) {
        A(0.6);
        if (o === 'F') R(COLD[2], -5, -1, 10, 1); else if (o === 'B') R(COLD[2], -5, -14, 10, 1); else R(COLD[2], 3, -12, 1, 10);
        A(1); return;
      }
      if (o === 'F') {
        var lw = [10, 6, 2][nl], gx = -5 + lw, gw = 10 - lw;
        if (nl === 0) { A(0.7); R(C.L[3], -5, -1, 10, 1); A(1); spill(o, C.L[3], 0, 8, 3, 0.35); return; }
        A(0.4); R(C.L[4], gx, -19, gw, 19); A(1);
        spill(o, C.L[3], gx + (gw >> 1), gw + 2, 6 + 4 * nl, 0.5);
      } else if (o === 'E') {
        A(0.35); R(C.L[4], -8, -11, 10, 9); A(1);
        spill(o, C.L[3], -6, nl === 0 ? 4 : 8, nl === 0 ? 3 : 6 + 4 * nl, 0.5);
      } else {
        A(0.35); R(C.L[4], -5, -12, 10, 12); A(1);
        spill(o, C.L[3], 0, nl === 0 ? 6 : 8, nl === 0 ? 3 : 4 + 3 * nl, 0.45);
      }
    },
    motes: 1
  });

  /* ── arch ─────────────────────────────────────────────────────────── */
  var ARCH_OUT = [4, 6, 7, 8, 8], ARCH_IN = [2, 4, 5];
  style('arch', 'an open stone arch with a keystone: you see straight through it into the light of the next room; boarded over when shut',
  {
    draw: function (o, open, nl, C) {
      var s = C.st, k;
      if (o === 'F') {
        sym(OUT, -25, [5, 7, 8, 9, 9], 0); R(OUT, -9, -20, 18, 20);
        sym(s[2], -24, ARCH_OUT, 0); R(s[2], -8, -19, 16, 19);
        /* mortar: courses and a fan of joints around the curve */
        R(s[1], -8, -14, 3, 1); R(s[1], 5, -14, 3, 1); R(s[1], -8, -8, 3, 1); R(s[1], 5, -8, 3, 1);
        R(s[1], -8, -3, 3, 1); R(s[1], 5, -3, 3, 1);
        D(s[1], -6, -22); D(s[1], 5, -22); D(s[1], -7, -19); D(s[1], 6, -19);
        R(s[3], -8, -19, 1, 19); R(s[3], -7, -23, 2, 1); R(s[3], -5, -24, 2, 1);
        R(s[0], 7, -19, 1, 19);
        /* the opening */
        sym(OUT, -21, [3, 5, 6], 0); R(OUT, -6, -18, 12, 18);
        var inner = [2, 4, 5];
        if (open) {
          sym(C.L[1], -20, inner, 0); R(C.L[1], -5, -17, 10, 17);
          sym(C.L[2], -18, [2, 3], 0); R(C.L[2], -4, -16, 8, 16);
          R(C.L[3], -3, -14, 6, 14); R(C.L[4], -2, -11, 4, 11);
          /* the far room's floor, receding */
          R(C.L[3], -5, -4, 10, 4); R(C.L[4], -4, -3, 8, 1); R(C.L[4], -5, -1, 10, 1);
        } else {
          sym(VOID, -20, inner, 0); R(VOID, -5, -17, 10, 17); R(COLD[0], -5, -4, 10, 4);
        }
        /* keystone */
        R(OUT, -2, -26, 4, 7); R(open ? GOLD[2] : s[4], -1, -25, 2, 5); D(open ? GOLD[3] : s[4], -1, -25);
        R(s[3], -9, -2, 4, 2); R(s[3], 5, -2, 4, 2); R(s[4], -9, -2, 4, 1); R(s[4], 5, -2, 4, 1);
        if (!open) { plank(-6, -16, 5, -5, WOOD); plank(-6, -6, 5, -15, WOOD); }
      } else if (o === 'E') {
        R(OUT, -8, -25, 17, 25);
        if (open) {
          R(C.L[0], -8, -20, 11, 8);
          R(C.L[1], -8, -12, 11, 11); R(C.L[2], -8, -11, 8, 9); R(C.L[3], -8, -10, 5, 7); R(C.L[4], -8, -8, 2, 4);
        } else { R(VOID, -8, -20, 11, 19); R(COLD[0], -8, -12, 11, 10); }
        /* the soffit of the arch, curving down into the front pier */
        R(s[1], -8, -24, 12, 4); R(s[2], -8, -24, 12, 1);
        spans(s[1], [-20, -1, 4, -19, 1, 4, -18, 2, 4]);
        R(OUT, 3, -25, 6, 25); R(s[2], 4, -24, 4, 24); R(s[3], 4, -24, 1, 24); R(s[0], 7, -24, 1, 24);
        R(s[1], 4, -18, 4, 1); R(s[1], 4, -11, 4, 1); R(s[1], 4, -5, 4, 1);
        R(open ? GOLD[2] : s[4], 4, -24, 4, 3); R(OUT, 4, -21, 4, 1);
        R(C.cap, -8, -2, 11, 2); R(C.rim, -8, -2, 11, 1);
        if (!open) { plank(-6, -18, 1, -4, WOOD); plank(-6, -6, 1, -17, WOOD); }
      } else {
        R(OUT, -9, -17, 18, 17);
        if (open) { R(C.L[1], -5, -15, 10, 15); R(C.L[2], -5, -11, 10, 11); R(C.L[3], -4, -7, 8, 7); R(C.L[4], -3, -3, 6, 3); }
        else R(VOID, -5, -15, 10, 15);
        /* the two piers, from above, with a ball on each */
        for (k = -1; k <= 1; k += 2) {
          var px = k < 0 ? -8 : 5;
          R(s[2], px, -16, 3, 16); R(s[3], px, -16, 3, 1); R(s[1], px, -9, 3, 1);
          R(OUT, px - 1, -20, 5, 5); R(s[3], px, -19, 3, 3); D(s[4], px, -19);
        }
        R(s[3], -5, -16, 10, 1); R(s[2], -5, -15, 10, 1);
        if (!open) { plank(-6, -12, 5, -5, WOOD); plank(-6, -5, 5, -12, WOOD); }
      }
    },
    glow: function (o, open, nl, C) {
      if (!open) { A(0.45); if (o === 'F') R(COLD[1], -5, -4, 10, 4); A(1); return; }
      if (o === 'F') { A(0.3 + 0.1 * nl); R(C.L[4], -4, -16, 8, 16); A(1); spill(o, C.L[3], 0, 10, 6 + 3 * nl, 0.45); }
      else if (o === 'E') { A(0.3); R(C.L[4], -8, -11, 10, 9); A(1); spill(o, C.L[3], -6, 8, 6 + 3 * nl, 0.45); }
      else { A(0.3); R(C.L[4], -5, -14, 10, 14); A(1); spill(o, C.L[3], 0, 8, 4 + 2 * nl, 0.4); }
    },
    motes: 1
  });

  /* ── tunnel / cave ──────────────────────────────────────────────────
     v 'rock' is the cave: a stone rim with teeth instead of leaves. */
  var MOUTH = [2, 4, 5, 6, 6, 7];          /* half-widths from y -21 */
  function rim(C, v) { return v === 'rock' ? C.st : C.fol; }
  /* a rounded clump of leaves: lit from the top left, shaded under */
  function clump(f, x, y, w, h) {
    R(f[2], x + 1, y, w - 2, h); R(f[2], x, y + 1, w, h - 2);
    R(f[3], x + 1, y, w - 3, 1); R(f[3], x, y + 1, 2, 1); D(f[4], x + 1, y);
    R(f[1], x + 1, y + h - 1, w - 2, 1); D(f[1], x + w - 1, y + h - 2);
  }
  function clumpOut(x, y, w, h) { R(OUT, x, y - 1, w, h + 2); R(OUT, x - 1, y, w + 2, h); }
  /* a hedge: outlines first, then a body to close the gaps, then leaves */
  function hedge(f, list, body) {
    var i;
    for (i = 0; i < list.length; i += 4) clumpOut(list[i], list[i + 1], list[i + 2], list[i + 3]);
    R(f[1], body[0], body[1], body[2], body[3]);
    for (i = 0; i < list.length; i += 4) clump(f, list[i], list[i + 1], list[i + 2], list[i + 3]);
  }
  var HEDGE_F = [-12, -15, 6, 7, -12, -9, 5, 7, -12, -4, 6, 4, -11, -21, 7, 7, -7, -26, 7, 6, -2, -28, 6, 6,
                 3, -26, 7, 6, 6, -21, 7, 7, 7, -15, 6, 7, 8, -9, 5, 7, 6, -4, 6, 4, -4, -24, 4, 4, 1, -24, 4, 4];
  var HEDGE_E = [-9, -26, 7, 6, -4, -27, 7, 6, 1, -25, 7, 6, 4, -20, 6, 7, 5, -14, 5, 6, 4, -8, 6, 6, 3, -3, 6, 4,
                 -9, -20, 6, 6, -4, -20, 6, 5, -9, -3, 7, 4, -3, -3, 6, 4];
  style('tunnel', 'a black mouth in the hedge (or, as `cave`, in the rock): bands of depth down to a pin of light at the far end; brambles across it when shut',
  {
    draw: function (o, open, nl, C, v) {
      var f = rim(C, v), k;
      if (o === 'F') {
        /* the leafy mass, wider than its cell */
        if (v === 'rock') {
          sym(OUT, -27, [5, 8, 10, 11, 11], 0); R(OUT, -11, -22, 22, 22);
          sym(f[1], -26, [4, 7, 9, 10, 10], 0); R(f[1], -10, -21, 20, 21);
          R(f[2], -10, -21, 4, 21); R(f[2], 6, -21, 4, 21); R(f[3], -10, -21, 1, 21); R(f[2], -7, -25, 14, 3); R(f[3], -6, -25, 12, 1);
          R(f[0], -10, -12, 3, 1); R(f[0], 7, -8, 3, 1); R(f[0], -9, -4, 2, 1);
        } else {
          hedge(f, HEDGE_F, [-10, -24, 20, 24]);
        }
        /* the mouth: three bands of depth to black */
        sym(f[0], -21, MOUTH, 0); R(f[0], -7, -15, 14, 15);
        sym(OUT, -20, [1, 3, 4, 5, 5], 0); R(OUT, -6, -15, 12, 15);
        sym(VOID, -18, [2, 3, 4], 0); R(VOID, -5, -15, 10, 14);
        if (open) {
          /* the light at the end of it */
          R(C.L[1], -2, -11, 4, 4); R(C.L[2], -1, -11, 2, 3); D(C.L[4], -1, -10); D(C.L[3], 0, -10);
          R(C.L[0], -4, -2, 8, 2);
        } else R(COLD[0], -2, -11, 4, 3);
        if (v === 'rock') { D(f[3], -4, -20); D(f[3], -1, -21); D(f[3], 2, -21); D(f[2], 4, -19); D(f[2], -4, -19); R(f[2], -2, -21, 1, 2); R(f[2], 1, -21, 1, 3); }
        if (!open) {
          for (k = 0; k < 2; k++) {
            var a = k ? 1 : -1, x0 = -6 * a, i;
            for (i = 0; i < 14; i++) {
              var x = Math.round(x0 + a * i * 12 / 13), y = -17 + i;
              R(THORN[1], x, y, 2, 1); if (i % 3 === 1) { D(THORN[3], x + a * 2, y - 1); D(THORN[2], x - a, y + 1); }
            }
          }
          R(THORN[2], -6, -9, 12, 1); D(THORN[3], -3, -10); D(THORN[3], 3, -10);
        }
      } else if (o === 'E') {
        if (v === 'rock') { R(OUT, -9, -27, 20, 29); R(f[1], -9, -26, 19, 13); }
        else hedge(f, HEDGE_E, [-9, -26, 18, 26]);
        R(f[0], -9, -14, 13, 13);
        /* the dark going away to the left */
        R(OUT, -9, -13, 12, 11); R(VOID, -9, -12, 8, 9);
        if (open) { R(C.L[1], -9, -10, 2, 5); D(C.L[3], -9, -8); R(C.L[0], -6, -3, 9, 1); } else R(COLD[0], -9, -10, 2, 5);
        if (v === 'rock') {
          R(f[2], -9, -26, 19, 3); R(f[3], -9, -26, 19, 1); R(f[2], 4, -26, 6, 26); R(f[3], 4, -26, 1, 26);
          D(f[2], -6, -13); D(f[2], -3, -13); R(f[2], 0, -13, 1, 2);
        } else {
          clump(f, -6, -16, 5, 3);
        }
        if (v === 'rock') { R(f[2], -9, -3, 13, 4); R(f[3], -8, -3, 11, 1); R(OUT, -9, 1, 14, 1); }
        else { clump(f, -9, -3, 7, 4); clump(f, -3, -3, 6, 4); }
        if (!open) {
          for (k = 0; k < 12; k++) { R(THORN[1], -6 + (k >> 1), -13 + k, 2, 1); if (k % 3 === 0) D(THORN[3], -4 + (k >> 1), -14 + k); }
          for (k = 0; k < 12; k++) { R(THORN[1], 0 - (k >> 1), -13 + k, 2, 1); if (k % 3 === 1) D(THORN[3], -2 - (k >> 1), -12 + k); }
        }
      } else {
        R(OUT, -11, -18, 22, 19);
        R(f[1], -11, -17, 6, 18); R(f[1], 5, -17, 6, 18);
        if (v === 'rock') { R(f[2], -11, -17, 5, 3); R(f[2], 6, -17, 5, 3); R(f[3], -11, -17, 5, 1); R(f[3], 6, -17, 5, 1); }
        else { clump(f, -11, -18, 6, 5); clump(f, 5, -18, 6, 5); clump(f, -10, -11, 5, 5); clump(f, 6, -10, 5, 5); clump(f, -11, -5, 5, 5); clump(f, 6, -4, 5, 5); }
        R(f[0], -5, -16, 10, 16); R(OUT, -4, -14, 8, 14); R(VOID, -3, -11, 6, 11);
        if (open) { R(C.L[1], -2, -3, 4, 3); D(C.L[3], -1, -2); D(C.L[4], 0, -2); } else R(COLD[0], -2, -3, 4, 3);
        if (!open) { for (k = 0; k < 10; k++) { R(THORN[1], -5 + k, -14 + k, 2, 1); R(THORN[1], 4 - k, -14 + k, 2, 1); if (k % 3 === 0) { D(THORN[3], -5 + k, -15 + k); D(THORN[3], 5 - k, -13 + k); } } }
      }
    },
    glow: function (o, open, nl, C) {
      if (!open) return;
      if (o === 'F') { A(0.25 + 0.15 * nl); R(C.L[3], -2, -12, 4, 5); A(1); spill(o, C.L[2], 0, 6, 3 + 2 * nl, 0.3); }
      else if (o === 'E') { A(0.25 + 0.15 * nl); R(C.L[3], -9, -11, 3, 6); A(1); spill(o, C.L[2], -7, 6, 3 + 2 * nl, 0.3); }
      else { A(0.25 + 0.15 * nl); R(C.L[3], -2, -4, 4, 4); A(1); spill(o, C.L[2], 0, 6, 2 + 2 * nl, 0.3); }
    },
    fireflies: 1, vines: 1
  });

  /* ── stairs ──────────────────────────────────────────────────────────
     F: a flight going UP into the north wall, a lit landing at its top.
     H: a stairwell going DOWN into the floor (v 'up': a flight rising).
     E: a flight climbing away to the left. B: steps down to the south. */
  style('stairs', 'a flight of stone steps with a lit landing at the end: up into a wall, down into the floor, or away to the side; a rope across them when shut',
  {
    draw: function (o, open, nl, C, v) {
      var s = C.st, k;
      if (o === 'H' && v !== 'up') {
        /* a stairwell in the floor: the near tread is highest */
        R(OUT, -8, -16, 16, 16);
        R(s[3], -8, -16, 16, 1); R(s[2], -8, -16, 1, 16); R(s[2], 7, -16, 1, 16);
        var ramp = open ? [C.L[2], C.L[1], C.L[0], s[1], s[2]] : [COLD[0], VOID, VOID, s[0], s[1]];
        for (k = 0; k < 5; k++) {
          var y = -3 - k * 3;
          R(ramp[4 - k] || VOID, -6, y, 12, 3);
          R(k === 0 ? s[4] : k === 1 ? s[3] : k === 2 ? s[2] : s[1], -6, y, 12, 1);
        }
        if (open) { R(C.L[3], -5, -15, 10, 1); D(C.L[4], -1, -15); D(C.L[4], 0, -15); }
        /* a rail post */
        R(OUT, 6, -22, 3, 8); R(IRON[2], 7, -21, 1, 7); R(GOLD[open ? 2 : 0], 6, -22, 3, 1);
        R(OUT, -9, -22, 3, 8); R(IRON[2], -8, -21, 1, 7); R(GOLD[open ? 2 : 0], -9, -22, 3, 1);
        if (!open) { R(OUT, -8, -19, 16, 3); R(VELV[2], -7, -18, 14, 1); D(VELV[3], -1, -18); padlock(-2, -21); }
        return;
      }
      if (o === 'F' || o === 'H') {
        var walled = o === 'F';
        R(OUT, -9, -28, 18, 28);
        /* the landing at the top */
        if (open) { R(C.L[2], -6, -27, 12, 5); R(C.L[3], -5, -26, 10, 3); R(C.L[4], -3, -26, 6, 2); }
        else { R(COLD[0], -6, -27, 12, 5); R(COLD[1], -5, -24, 10, 1); }
        /* five treads, narrowing as they climb */
        for (k = 0; k < 5; k++) {
          var ty = -4 - k * 4, inset = k >> 1;
          var sw = 14 - 2 * inset, sx0 = -7 + inset;
          R(s[k < 3 ? 3 : 2], sx0, ty, sw, 2);                 /* the tread */
          R(s[4], sx0, ty + 1, sw, 1);                         /* its nosing */
          R(s[1], sx0, ty + 2, sw, 2);                         /* the riser */
          R(s[0], sx0, ty + 3, sw, 1);
          if (open && k >= 3) { A(0.35); R(C.L[3], sx0, ty, sw, 2); A(1); }
        }
        if (walled) {
          R(s[1], -9, -28, 2, 28); R(s[1], 7, -28, 2, 28); R(s[3], -9, -28, 1, 28); R(s[0], 8, -28, 1, 28);
          R(s[2], -9, -28, 18, 1);
        } else {
          /* rails, so a floor flight reads as stairs and not a ramp */
          for (k = 0; k < 6; k++) { D(IRON[3], -8 + (k >> 2), -4 - k * 4); D(IRON[3], 7 - (k >> 2), -4 - k * 4); }
          R(IRON[2], -8, -24, 1, 20); R(IRON[2], 7, -24, 1, 20);
        }
        if (!open) {
          R(OUT, -9, -13, 18, 4); R(VELV[2], -8, -12, 16, 2); R(VELV[3], -8, -12, 16, 1);
          R(OUT, -10, -16, 3, 16); R(GOLD[0], -9, -15, 1, 15); R(OUT, 7, -16, 3, 16); R(GOLD[0], 8, -15, 1, 15);
          padlock(-2, -15);
        }
      } else if (o === 'E') {
        R(OUT, -8, -26, 17, 26);
        if (open) { R(C.L[2], -8, -26, 4, 10); R(C.L[3], -8, -25, 2, 8); } else R(COLD[0], -8, -26, 4, 10);
        /* steps climbing to the left: each a tread and a riser */
        for (k = 0; k < 4; k++) {
          var sx = 3 - k * 3, sy = -4 - k * 3;
          R(s[2], sx - 3, sy, 3, -sy); R(s[4 - (k > 1 ? 1 : 0)], sx - 3, sy, 3, 1); R(s[0], sx - 1, sy + 1, 1, -sy - 1);
        }
        R(s[1], -8, -2, 11, 2);
        R(OUT, 3, -26, 6, 26); R(s[2], 4, -25, 4, 25); R(s[3], 4, -25, 1, 25); R(s[1], 4, -25, 4, 1);
        R(C.cap, -8, -26, 11, 2); R(C.rim, -8, -26, 11, 1);
        if (!open) { chain(-6, -20, 3, -6); padlock(-1, -16); }
      } else {
        /* B: down to the south; treads darken, then the light below */
        R(OUT, -8, -16, 16, 16);
        for (k = 0; k < 4; k++) {
          var by = -15 + k * 3;
          R(k === 0 ? s[3] : k === 1 ? s[2] : s[1], -6, by, 12, 3); R(k < 2 ? s[4] : s[2], -6, by, 12, 1);
        }
        if (open) { R(C.L[2], -6, -3, 12, 3); R(C.L[4], -4, -2, 8, 2); } else R(COLD[0], -6, -3, 12, 3);
        R(s[2], -8, -16, 2, 16); R(s[3], -8, -16, 2, 1); R(s[2], 6, -16, 2, 16); R(s[3], 6, -16, 2, 1);
        if (!open) { R(OUT, -8, -10, 16, 3); R(VELV[2], -7, -9, 14, 1); padlock(-2, -12); }
      }
    },
    glow: function (o, open, nl, C, v) {
      if (!open) return;
      if (o === 'H' && v !== 'up') { A(0.35 + 0.1 * nl); R(C.L[3], -6, -15, 12, 7); A(1); return; }
      if (o === 'F' || o === 'H') { A(0.3 + 0.1 * nl); R(C.L[4], -5, -27, 10, 5); R(C.L[3], -6, -22, 12, 8); A(1); spill('F', C.L[2], 0, 12, 3 + 2 * nl, 0.3); }
      else if (o === 'E') { A(0.35); R(C.L[4], -8, -26, 4, 10); A(1); spill(o, C.L[2], -6, 8, 4 + 2 * nl, 0.35); }
      else { A(0.35); R(C.L[4], -6, -4, 12, 4); A(1); spill(o, C.L[2], 0, 8, 3 + 2 * nl, 0.3); }
    },
    motes: 1
  });

  /* ── gate ─────────────────────────────────────────────────────────── */
  function portcullis(x0, y0, w, h, raised) {
    var k, bot = y0 + h - raised;
    if (bot <= y0) return;
    for (k = x0 + 1; k < x0 + w; k += 3) { R(IRON[0], k + 1, y0, 1, bot - y0); R(IRON[2], k, y0, 1, bot - y0); }
    for (k = y0 + 3; k < bot - 1; k += 5) R(IRON[2], x0, k, w, 1);
    for (k = x0 + 1; k < x0 + w; k += 3) { R(IRON[3], k, bot - 1, 1, 1); D(IRON[2], k, bot); }
  }
  style('gate', 'a castle portcullis in a square stone frame: it sits down, chained and padlocked, until you earn it, then lifts as you walk up',
  {
    draw: function (o, open, nl, C) {
      var s = C.st, k, raise = open ? [12, 15, 18][nl] : 0;
      if (o === 'F') {
        R(OUT, -9, -26, 18, 26);
        R(s[2], -8, -25, 16, 25); R(s[3], -8, -25, 16, 1); R(s[3], -8, -25, 1, 25); R(s[0], 7, -24, 1, 24);
        /* crenels */
        for (k = -8; k < 8; k += 4) { R(OUT, k, -28, 3, 3); R(s[3], k, -27, 3, 2); }
        R(s[1], -8, -20, 2, 1); R(s[1], 6, -20, 2, 1); R(s[1], -8, -13, 2, 1); R(s[1], 6, -13, 2, 1); R(s[1], -8, -6, 2, 1); R(s[1], 6, -6, 2, 1);
        R(OUT, -6, -21, 12, 21);
        if (open) { R(C.L[1], -5, -20, 10, 20); R(C.L[2], -4, -17, 8, 17); R(C.L[3], -3, -13, 6, 13); R(C.L[4], -2, -8, 4, 8); R(C.L[3], -5, -2, 10, 2); }
        else { R(COLD[0], -5, -20, 10, 20); R(VOID, -4, -16, 8, 14); }
        portcullis(-5, -20, 10, 20, raise);
        R(s[1], -6, -21, 12, 1);
        /* the winch chain on the frame */
        for (k = -22; k < -12 + (open ? -raise / 3 : 0); k += 2) D(k % 4 ? IRON[3] : IRON[2], 7, k);
        if (!open) { R(OUT, -7, -9, 14, 3); R(IRON[2], -6, -8, 12, 1); padlock(-2, -12); }
      } else if (o === 'E') {
        R(OUT, -8, -26, 17, 26);
        if (open) { R(C.L[1], -8, -20, 11, 18); R(C.L[2], -8, -12, 8, 10); R(C.L[3], -8, -10, 5, 7); R(C.L[4], -8, -8, 2, 4); }
        else R(COLD[0], -8, -20, 11, 18);
        R(s[1], -8, -25, 12, 5); R(s[3], -8, -25, 12, 1);
        /* the portcullis, side-on: a ladder of crossbars down its slot */
        var bot = open ? -20 + Math.max(0, 18 - raise) : -2;
        R(IRON[0], -3, -20, 4, bot + 20);
        for (k = -19; k < bot; k += 4) R(IRON[2], -3, k, 4, 1);
        R(IRON[3], -2, -20, 1, bot + 20); D(IRON[3], -2, bot); D(IRON[3], 0, bot);
        R(OUT, 3, -26, 6, 26); R(s[2], 4, -25, 4, 25); R(s[3], 4, -25, 1, 25);
        R(s[1], 4, -18, 4, 1); R(s[1], 4, -10, 4, 1);
        R(C.cap, -8, -2, 11, 2); R(C.rim, -8, -2, 11, 1);
        if (!open) { chain(-7, -16, 3, -6); padlock(0, -13); }
      } else {
        R(OUT, -8, -16, 16, 16);
        if (open) { R(C.L[1], -5, -14, 10, 14); R(C.L[2], -5, -10, 10, 10); R(C.L[3], -4, -6, 8, 6); R(C.L[4], -3, -3, 6, 3); }
        else R(COLD[0], -5, -14, 10, 14);
        R(s[2], -8, -16, 3, 16); R(s[3], -8, -16, 3, 1); R(s[2], 5, -16, 3, 16); R(s[3], 5, -16, 3, 1);
        R(s[3], -5, -16, 10, 1);
        /* the slot and the spikes along its edge */
        R(VOID, -5, -11, 10, 2);
        if (!open || nl === 0) { for (k = -5; k < 5; k += 2) { D(IRON[3], k, -10); D(IRON[2], k, -9); } }
        if (!open) { R(IRON[1], -5, -11, 10, 1); padlock(-2, -8); }
      }
    },
    glow: function (o, open, nl, C) {
      if (!open) { A(0.5); if (o === 'F') R(COLD[2], -5, -1, 10, 1); A(1); return; }
      if (o === 'F') { A(0.3 + 0.1 * nl); R(C.L[4], -4, -18, 8, 18); A(1); spill(o, C.L[3], 0, 10, 4 + 3 * nl, 0.45); }
      else if (o === 'E') { A(0.3); R(C.L[4], -8, -11, 10, 9); A(1); spill(o, C.L[3], -6, 8, 4 + 3 * nl, 0.45); }
      else { A(0.3); R(C.L[4], -5, -12, 10, 12); A(1); spill(o, C.L[3], 0, 8, 3 + 2 * nl, 0.4); }
    },
    motes: 1
  });

  /* ── portal ───────────────────────────────────────────────────────── */
  var OVAL = [3, 5, 6, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 7, 7, 6, 5, 3];      /* 24 rows */
  function shrink(list, n) { var o = []; for (var i = n; i < list.length - n; i++) o.push(Math.max(0, list[i] - n)); return o; }
  var OVAL1 = shrink(OVAL, 2), OVAL2 = shrink(OVAL, 4), OVAL3 = shrink(OVAL, 6);
  function narrow(list, k) { var o = []; for (var i = 0; i < list.length; i++) o.push(Math.max(list[i] ? 1 : 0, Math.round(list[i] * k))); return o; }
  var OVE = narrow(OVAL, 0.4), OVE1 = shrink(narrow(OVAL, 0.4), 2);
  /* the portal lying in the floor: a gilt ring and a pool of colour */
  var PRING = [3, 5, 6, 7, 7, 7, 7, 6, 5, 3], PIN = [0, 3, 4, 5, 5, 5, 5, 4, 3, 0], PCORE = [0, 0, 2, 3, 3, 3, 3, 2, 0, 0];
  function pool(open, C) {
    var gl = open ? GOLD : DULL, M = C.M;
    sym(OUT, -14, [2, 4, 6, 7, 8, 8, 8, 8, 7, 6, 4, 2], 0);
    sym(gl[1], -13, PRING, 0); R(gl[3], -3, -13, 6, 1); D(gl[2], -6, -11); D(gl[2], -7, -9);
    sym(open ? M[1] : '#1A1C28', -13, PIN, 0);
    if (open) { sym(M[3], -13, PCORE, 0); R(M[4], -1, -10, 2, 3); }
    else { spans('#3A3E52', [-11, -2, 0, -10, 0, 1, -9, 1, 3, -8, -1, 1, -7, -3, -1]); chain(-6, -11, 6, -5); padlock(-2, -12); }
  }
  style('portal', 'a standing gilded oval full of swirling colour, on a little plinth — for dreams and tears in the world; a dead grey film when shut',
  {
    draw: function (o, open, nl, C) {
      if (o === 'P') { pool(open, C); return; }
      var M = C.M, edge = o === 'E', ov = edge ? OVE : OVAL, ov1 = edge ? OVE1 : OVAL1;
      var cx = edge ? 1 : 0, gl = open ? GOLD : DULL;
      /* plinth */
      R(OUT, -7, -3, 14, 3); R(C.st[2], -6, -3, 12, 2); R(C.st[3], -6, -3, 12, 1);
      sym(OUT, -28, [2].concat(ov.map(function (h) { return h + 1; })).concat([2]), cx);
      sym(gl[1], -27, ov, cx);
      sym(open ? M[1] : '#1A1C28', -25, ov1, cx);
      if (open) {
        if (!edge) { sym(M[2], -23, OVAL2, 0); sym(M[3], -21, OVAL3, 0); R(M[4], -1, -18, 2, 9); }
        else { R(M[3], cx - 1, -22, 2, 14); R(M[4], cx - 1, -18, 1, 6); }
      } else {
        /* a grey film, cracked */
        if (!edge) { sym('#232634', -21, OVAL3, 0); spans('#3A3E52', [-20, -2, -1, -19, -1, 0, -18, 0, 1, -17, 0, 1, -16, 1, 2, -15, -1, 1, -14, -2, -1, -12, 2, 3, -11, 3, 4]); }
        else R('#2A2E3E', cx - 1, -20, 1, 10);
      }
      /* the ring's light: a highlight up its left side */
      for (var i = 4; i < 18; i++) D(gl[2], cx - ov[i], -27 + i);
      D(gl[3], cx - ov[6], -21);
      if (!edge) {
        /* gems at the top and the sides */
        R(OUT, -2, -29, 4, 4); R(open ? M[3] : '#3A3E52', -1, -28, 2, 2); D(open ? M[4] : '#5A5E72', -1, -28);
        R(OUT, -10, -16, 3, 3); D(open ? M[3] : '#3A3E52', -9, -15); R(OUT, 7, -16, 3, 3); D(open ? M[3] : '#3A3E52', 8, -15);
      }
      if (!open) { chain(-7, -20, 6, -8); padlock(-2, -16); }
    },
    glow: function (o, open, nl, C) {
      if (!open) return;
      if (o === 'P') { A(0.35 + 0.12 * nl); sym(C.M[3], -13, PIN, 0); A(1); spill('B', C.M[3], 0, 10, 3 + 2 * nl, 0.35); return; }
      var edge = o === 'E';
      A(0.35 + 0.12 * nl); sym(C.M[3], -23, edge ? OVE1 : OVAL2, edge ? 1 : 0); A(1);
      if (o === 'E') spill(o, C.M[3], -12, 6, 4 + 3 * nl, 0.4);
      else if (o === 'B') spill(o, C.M[3], 0, 10, 3 + 2 * nl, 0.35);
      else spill('F', C.M[3], 0, 10, 3 + 3 * nl, 0.4);
    },
    sparkle: 1
  });

  /* ── frame: a picture you step into ─────────────────────────────────── */
  style('frame', 'a big gilt picture frame with a painted elsewhere in it (sky, moon, hills); the painting glows when it will take you, a dust sheet hides it when not',
  {
    draw: function (o, open, nl, C) {
      var gl = open ? GOLD : DULL, M = C.M, k;
      if (o === 'P') {
        /* lying flat in the floor, a window down into the painting */
        R(OUT, -8, -15, 16, 14); R(gl[1], -7, -14, 14, 12); R(gl[3], -7, -14, 14, 1); R(gl[0], -7, -3, 14, 1);
        R(gl[3], -7, -14, 2, 2); R(gl[3], 5, -14, 2, 2);
        R(OUT, -5, -12, 10, 8);
        if (open) {
          R(M[1], -4, -11, 8, 6); R(M[2], -4, -9, 8, 2); R(C.fol[2], -4, -7, 5, 2); R(C.fol[1], 0, -6, 4, 1);
          D(M[4], 2, -10); D(C.L[3], -2, -7);
        } else { R('#5A5664', -6, -13, 12, 10); R('#77727E', -6, -13, 12, 1); for (k = -4; k < 6; k += 3) R('#46424E', k, -12, 1, 9); }
        return;
      }
      if (o === 'E') {
        /* side-on: a deep gilt edge with the painting's glow in it */
        R(OUT, 0, -26, 6, 24); R(gl[1], 1, -25, 4, 22); R(gl[2], 1, -25, 1, 22); R(gl[3], 1, -25, 4, 1);
        R(open ? M[3] : '#2A2E3E', 3, -22, 1, 16);
        R(OUT, -1, -3, 8, 3); R(C.st[2], 0, -3, 6, 2);
        if (!open) { R('#5A5664', -2, -26, 4, 22); R('#77727E', -2, -26, 1, 22); }
        return;
      }
      var top = -27;
      R(OUT, -10, top, 20, 25);
      R(gl[1], -9, top + 1, 18, 23); R(gl[2], -9, top + 1, 18, 1); R(gl[2], -9, top + 1, 1, 23); R(gl[0], 8, top + 2, 1, 22); R(gl[0], -9, -4, 18, 1);
      /* corner ornaments */
      R(gl[3], -9, top + 1, 2, 2); R(gl[3], 7, top + 1, 2, 2); R(gl[3], -9, -6, 2, 2); R(gl[3], 7, -6, 2, 2);
      R(OUT, -7, top + 3, 14, 19);
      if (open) {
        /* the painting: a night sky in bands, a moon, two hills */
        R(M[1], -6, top + 4, 12, 17); R(M[2], -6, top + 9, 12, 6); R(mix(M[3], C.warm, 0.5), -6, top + 13, 12, 3);
        R(M[4], 2, top + 6, 2, 2); D('#FFFFFF', 2, top + 6);
        R(C.fol[2], -6, top + 15, 7, 6); R(C.fol[1], 0, top + 16, 6, 5); R(C.fol[3], -5, top + 15, 4, 1);
        R(C.L[3], -2, top + 17, 1, 1); R(C.L[3], 3, top + 18, 1, 1);
      } else {
        R('#1A1C28', -6, top + 4, 12, 17);
        /* a dust sheet over it, tied off */
        R('#5A5664', -8, top + 2, 16, 20); R('#77727E', -8, top + 2, 16, 1);
        for (k = -6; k < 8; k += 3) R('#46424E', k, top + 3, 1, 19);
        R(OUT, -8, -10, 16, 1);
      }
      /* the floor it stands at: a little ledge */
      R(OUT, -8, -3, 16, 3); R(C.st[2], -7, -3, 14, 2); R(C.st[3], -7, -3, 14, 1);
    },
    glow: function (o, open, nl, C) {
      if (!open) return;
      if (o === 'E') { A(0.4); R(C.M[3], 3, -22, 1, 16); A(1); spill(o, C.M[3], -12, 6, 3 + 2 * nl, 0.35); return; }
      if (o === 'P') { A(0.3 + 0.15 * nl); R(C.M[3], -4, -11, 8, 6); A(1); spill('B', C.M[3], 0, 10, 3 + 2 * nl, 0.35); return; }
      A(0.12 + 0.08 * nl); R(C.M[3], -6, -23, 12, 17); A(1);
      spill(o === 'B' ? 'B' : 'F', C.M[3], 0, 12, 3 + 2 * nl, 0.35);
    },
    sparkle: 1
  });

  /* ── curtain ──────────────────────────────────────────────────────── */
  function drape(x, y, w, h, v) {
    R(v[1], x, y, w, h);
    for (var k = 0; k < w; k += 3) { R(v[2], x + k, y, 1, h); R(v[3], x + k, y, 1, Math.max(1, h >> 2)); if (k + 2 < w) R(v[0], x + k + 2, y, 1, h); }
  }
  style('curtain', 'a little proscenium: gold frame, velvet valance and two drapes that part as you come up, a stage light behind; roped off when shut',
  {
    draw: function (o, open, nl, C) {
      var gap = open ? [2, 6, 10][nl] : 0, half = (10 - gap) >> 1, k;
      var gl = open ? GOLD : DULL, v = VELV;
      if (o === 'F' || o === 'B') {
        var top = o === 'F' ? -26 : -16, h = o === 'F' ? 26 : 16, inner = o === 'F' ? -22 : -14;
        R(OUT, -9, top, 18, h);
        R(gl[1], -8, top + 1, 16, 3); R(gl[2], -8, top + 1, 16, 1); R(gl[1], -8, top + 1, 2, h - 1); R(gl[1], 6, top + 1, 2, h - 1);
        R(gl[2], -8, top + 1, 1, h - 1); R(gl[0], 7, top + 1, 1, h - 1);
        /* the stage beyond */
        if (open) { R(C.L[1], -6, inner, 12, -inner); R(C.L[2], -4, inner, 8, -inner); R(C.L[4], -2, inner, 4, -inner); R(C.L[3], -6, -2, 12, 2); }
        else R(VOID, -6, inner, 12, -inner);
        /* drapes, bunched to the sides by `gap` */
        drape(-6, inner, half + 1, -inner, v); drape(5 - half, inner, half + 1, -inner, v);
        if (gap >= 6) { R(gl[2], -6, inner + 9, half + 1, 1); R(gl[2], 5 - half, inner + 9, half + 1, 1); }
        /* the valance: scallops */
        R(v[2], -6, inner, 12, 3); for (k = -6; k < 6; k += 3) { D(v[1], k + 1, inner + 3); R(v[3], k, inner, 2, 1); }
        D(gl[3], -8, top + 1); D(gl[3], 7, top + 1);
        if (!open) {
          /* a rope barrier on two brass posts */
          R(OUT, -8, -8, 3, 8); R(DULL[2], -7, -7, 1, 7); R(OUT, 5, -8, 3, 8); R(DULL[2], 6, -7, 1, 7);
          spans(v[3], [-7, -6, -4, -6, -4, -2, -5, -2, 2, -6, 2, 4, -7, 4, 6]);
          padlock(-2, -11);
        }
      } else {
        /* E: the rail above the passage, the drape hanging across it */
        R(OUT, -8, -26, 17, 26);
        if (open) { R(C.L[1], -8, -22, 11, 20); R(C.L[2], -8, -12, 8, 10); R(C.L[4], -8, -10, 3, 6); } else R(VOID, -8, -22, 11, 20);
        R(gl[1], -8, -26, 16, 3); R(gl[2], -8, -26, 16, 1);
        var cw = open ? [7, 4, 2][nl] : 9;
        drape(3 - cw, -23, cw, 21, v); R(v[3], 3 - cw, -23, cw, 1);
        if (open && nl) R(gl[2], 3 - cw, -14, cw, 1);
        R(OUT, 3, -26, 6, 26); R(gl[1], 4, -25, 4, 25); R(gl[2], 4, -25, 1, 25); R(gl[0], 7, -25, 1, 25);
        R(C.cap, -8, -2, 11, 2);
        if (!open) { R(OUT, -8, -10, 11, 3); R(v[3], -7, -9, 10, 1); padlock(-3, -13); }
      }
    },
    glow: function (o, open, nl, C) {
      if (!open) return;
      var gap = [2, 6, 10][nl];
      if (o === 'F') { A(0.35); R(C.L[4], -(gap >> 1), -22, gap, 22); A(1); spill(o, C.L[3], 0, gap + 2, 4 + 3 * nl, 0.5); }
      else if (o === 'B') { A(0.35); R(C.L[4], -(gap >> 1), -14, gap, 14); A(1); spill(o, C.L[3], 0, gap + 2, 3 + 2 * nl, 0.45); }
      else { A(0.35); R(C.L[4], -8, -11, 8, 8); A(1); spill(o, C.L[3], -6, 6 + nl * 2, 4 + 3 * nl, 0.45); }
    },
    motes: 1
  });

  /* ── hatch / trapdoor ────────────────────────────────────────────── */
  style('hatch', 'a trapdoor in the floor: shut, chained and padlocked; open, its lid stands up and a ladder goes down into warm light',
  {
    draw: function (o, open, nl, C) {
      var w = WOOD, k;
      /* the floor frame */
      R(OUT, -8, -15, 16, 14); R(IRON[1], -7, -14, 14, 12); R(IRON[2], -7, -14, 14, 1);
      if (!open) {
        R(w[1], -6, -13, 12, 10); for (k = -6; k < 6; k += 3) R(w[0], k + 2, -13, 1, 10);
        R(w[2], -6, -13, 12, 1); R(IRON[2], -6, -11, 12, 1); R(IRON[2], -6, -6, 12, 1);
        R(OUT, -2, -9, 4, 3); R(IRON[3], -1, -9, 2, 1); D(IRON[3], -2, -8); D(IRON[3], 1, -8);
        chain(-6, -12, 5, -4); chain(-6, -4, 5, -12); padlock(-2, -11);
        return;
      }
      /* the hole, a ladder down it, light coming up from below */
      R(C.L[0], -6, -13, 12, 10); R(C.L[1], -5, -11, 10, 8); R(C.L[2], -4, -8, 8, 5); R(C.L[3], -3, -6, 6, 2);
      R(VOID, -6, -13, 12, 2);
      R(w[2], -4, -13, 1, 10); R(w[2], 3, -13, 1, 10);
      for (k = -12; k < -3; k += 3) R(w[3], -4, k, 8, 1);
      /* the lid, standing up behind it: taller as you come close */
      var lh = [5, 7, 9][nl];
      R(OUT, -7, -15 - lh, 14, lh + 1); R(w[1], -6, -14 - lh, 12, lh); R(w[2], -6, -14 - lh, 12, 1);
      for (k = -6; k < 6; k += 3) R(w[0], k + 2, -14 - lh, 1, lh);
      R(IRON[2], -6, -13 - (lh >> 1), 12, 1);
      R(OUT, -2, -17 - (lh >> 1), 4, 3); R(GOLD[1], -1, -16 - (lh >> 1), 2, 1);
    },
    glow: function (o, open, nl, C) {
      if (!open) { A(0.5); R(COLD[2], -7, -2, 14, 1); A(1); return; }
      A(0.3 + 0.15 * nl); R(C.L[4], -5, -11, 10, 8); A(1);
      A(0.25); R(C.L[3], -7, -2, 14, 2); A(1);
    },
    floorOnly: 1, motes: 1
  });

  /* ── path ─────────────────────────────────────────────────────────
     For open edges in the woods: a lit path running out through a gap
     in the trees, a lantern on a post either side, and a sign. */
  var LANTERN = ['.kkk.', 'kcCck', 'kgGgk', 'kgLgk', 'kgGgk', '.kkk.', '..p..', '..p..', '..p..', '..p..', '..p..', '.kpk.'];
  function lantern(x, y, open) {
    stamp(LANTERN, { k: OUT, c: IRON[2], C: IRON[3], g: open ? GOLD[1] : '#1E2238',
                     G: open ? GOLD[2] : COLD[1], L: open ? '#FFF0C0' : COLD[2], p: '#2A2030' }, x, y);
  }
  style('path', 'a lit path running out through a gap in the trees, a lantern post either side and a sign pointing on; a fallen log and dead lanterns when shut',
  {
    draw: function (o, open, nl, C) {
      var f = C.fol, k, pc = mix(C.floor, mix(C.path, C.warm, 0.25), open ? 0.38 : 0.2), pc2 = mix(C.floor, mix(C.path, C.warm, 0.35), open ? 0.6 : 0.3);
      if (o === 'F' || o === 'B') {
        var dir = o === 'F' ? -1 : 1;
        /* the gap in the treeline, dark trunks at its sides */
        R(f[0], -12, -16, 24, 16);
        R(OUT, -5, -16, 10, 16);
        R(pc, -4, -16, 8, 16);
        /* brighter toward where it goes, in steps */
        if (dir < 0) R(pc2, -3, -16, 6, 9); else R(pc2, -3, -9, 6, 9);
        for (k = 0; k < 6; k++) D(mix(pc, '#000000', 0.3), -3 + ((k * 5) % 7), -15 + k * 3);
        for (k = -16; k < 0; k += 3) { D(f[0], -4, k + (k & 1)); D(f[0], 3, k + 1); }
        for (k = 0; k < 4; k++) D(mix(pc2, '#FFFFFF', 0.2), -2 + ((k * 3) % 5), -14 + k * 4);
        if (open) {
          if (dir < 0) { R(C.L[2], -3, -16, 6, 3); R(C.L[3], -2, -16, 4, 1); }
          else { R(C.L[2], -3, -3, 6, 3); R(C.L[3], -2, -1, 4, 1); }
        }
        clump(f, -12, -18, 7, 5); clump(f, 5, -18, 7, 5); R(f[1], -12, -13, 6, 13); R(f[1], 6, -13, 6, 13);
        R(OUT, -6, -13, 1, 13); R(OUT, 5, -13, 1, 13);
        lantern(-10, -14, open); lantern(5, -14, open);
        /* the sign, pointing on (in front of the trees, in a south wall,
           so it never stands over you) */
        var sy0 = dir < 0 ? -24 : -15, ac = open ? GOLD[2] : DULL[1];
        R(OUT, 6, sy0, 8, 5); R(WOOD[2], 7, sy0 + 1, 6, 3); R(WOOD[3], 7, sy0 + 1, 6, 1);
        if (dir < 0) { D(ac, 10, sy0 + 1); R(ac, 9, sy0 + 2, 3, 1); }
        else { R(ac, 9, sy0 + 2, 3, 1); D(ac, 10, sy0 + 3); }
        if (dir < 0) R(WOOD[1], 9, sy0 + 5, 1, 5);
        if (!open) {
          /* a log across the path */
          R(OUT, -7, -10, 14, 5); R(WOOD[1], -6, -9, 12, 3); R(WOOD[2], -6, -9, 12, 1);
          R(WOOD[3], -7, -9, 2, 3); D(WOOD[0], -6, -8); D(f[3], -2, -10); D(f[3], 3, -10);
        }
      } else {
        /* E: running off to the left between two rows of trees */
        R(f[0], -10, -18, 18, 19);
        R(OUT, -10, -12, 18, 10); R(pc, -10, -11, 18, 8); R(pc2, -10, -10, 9, 6);
        for (k = 0; k < 6; k++) D(mix(pc, '#000000', 0.3), -9 + k * 3, -10 + ((k * 3) % 5));
        if (open) { R(C.L[2], -10, -10, 3, 6); R(C.L[3], -10, -9, 1, 4); }
        clump(f, -10, -19, 8, 6); clump(f, -3, -20, 8, 6); R(f[1], -10, -14, 18, 2);
        clump(f, -9, -2, 7, 4); clump(f, -2, -2, 6, 4);
        lantern(4, -24, open); lantern(4, -9, open);
        R(OUT, -7, -27, 8, 5); R(WOOD[2], -6, -26, 6, 3); R(WOOD[3], -6, -26, 6, 1);
        R(open ? GOLD[2] : DULL[1], -5, -25, 3, 1); D(open ? GOLD[2] : DULL[1], -4, -26); D(open ? GOLD[2] : DULL[1], -4, -24);
        R(WOOD[1], -3, -22, 1, 4);
        if (!open) { R(OUT, -5, -13, 5, 12); R(WOOD[1], -4, -12, 3, 10); R(WOOD[2], -4, -12, 1, 10); R(WOOD[3], -4, -13, 3, 1); }
      }
    },
    glow: function (o, open, nl, C) {
      if (!open) return;
      /* the lantern glass, and the path between them */
      if (o === 'F' || o === 'B') {
        A(0.6); R(C.L[4], -9, -13, 3, 3); R(C.L[4], 6, -13, 3, 3); A(1);
        A(0.12 + 0.08 * nl); if (o === 'F') R(C.L[3], -3, -16, 6, 6); else R(C.L[3], -3, -6, 6, 6); A(1);
        spill(o === 'F' ? 'F' : 'B', C.L[2], 0, 6, 2 + 2 * nl, 0.25);
      } else {
        A(0.6); R(C.L[4], 5, -23, 3, 3); R(C.L[4], 5, -8, 3, 3); A(1);
        A(0.12 + 0.08 * nl); R(C.L[3], -10, -10, 6, 6); A(1);
        spill(o, C.L[2], -7, 6, 2 + 2 * nl, 0.25);
      }
    },
    fireflies: 1
  });

  /* ── alley ────────────────────────────────────────────────────────
     For the city: a gap between two brick buildings, a lamp hung on a
     wire across it, a neon arrow; a shutter down when shut. */
  function bricks(x, y, w, h, b) {
    R(b[1], x, y, w, h);
    for (var r = 0; r < h; r += 3) {
      R(b[0], x, y + r + 2, w, 1);
      for (var c = ((r / 3) & 1) ? 2 : 0; c < w; c += 5) R(b[0], x + c, y + r, 1, 2);
      R(b[2], x, y + r, w, 0);
    }
    R(b[2], x, y, w, 1);
  }
  var BRICK = ['#1C1620', '#33242C', '#4A3640', '#634A54'];
  var NEON = ['#FF6BD6', '#6BE0FF'];
  style('alley', 'a narrow alley between two brick buildings, a lamp on a wire across it and a neon arrow on the wall; a rolled-down shutter when shut',
  {
    draw: function (o, open, nl, C) {
      var k;
      if (o === 'F' || o === 'B') {
        var t0 = o === 'F' ? -28 : -16;
        R(OUT, -13, t0, 26, -t0);
        bricks(-12, t0 + 1, 7, -t0 - 1, BRICK); bricks(5, t0 + 1, 7, -t0 - 1, BRICK);
        R(BRICK[3], -6, t0 + 1, 1, -t0 - 1); R(BRICK[0], 5, t0 + 1, 1, -t0 - 1);
        /* the alley going away: black above, its floor narrowing to a
           far, lit street */
        R(VOID, -5, t0 + 1, 10, -t0 - 1);
        var far = o === 'F', rows = far ? 14 : 15, r0, hw;
        for (r0 = 0; r0 < rows; r0++) {
          hw = far ? 1 + ((r0 * 4 / (rows - 1)) | 0) : 5 - ((r0 * 4 / (rows - 1)) | 0);
          var fc = open ? (far ? (r0 < 3 ? C.L[3] : r0 < 8 ? C.L[1] : C.L[2]) : (r0 > rows - 4 ? C.L[3] : r0 < 5 ? C.L[2] : C.L[1])) : '#14161E';
          R(fc, -hw, (far ? -rows : -16) + r0, hw * 2, 1);
        }
        /* the alley's own walls, a sliver each side */
        R(BRICK[1], -5, t0 + 1, 1, -t0 - 1); R(BRICK[0], 4, t0 + 1, 1, -t0 - 1);
        if (open) { if (far) R(C.L[4], -1, -15, 2, 2); else R(C.L[4], -1, -2, 2, 2); }
        /* the lamp on its wire */
        if (o === 'F') {
          R('#2A2430', -5, -24, 10, 1); R(OUT, -2, -24, 4, 4); R(IRON[2], -2, -24, 4, 1);
          R(open ? '#FFF0C0' : COLD[1], -1, -23, 2, 2);
        }
        /* neon arrow on the left wall */
        var nc = open ? NEON[0] : '#3A2A3A';
        R(OUT, -12, t0 + 6, 6, 7); R('#140A14', -11, t0 + 7, 4, 5);
        R(nc, -11, t0 + 9, 4, 1); D(nc, -9, t0 + 8); D(nc, -9, t0 + 10); if (o === 'F') { D(nc, -10, t0 + 8); D(nc, -10, t0 + 10); }
        if (!open) {
          /* the shutter, down */
          R(OUT, -6, t0 + 1, 12, -t0 - 1);
          for (k = t0 + 2; k < -1; k += 2) { R(IRON[1], -5, k, 10, 1); R(IRON[2], -5, k + 1, 10, 1); }
          R(IRON[3], -5, -2, 10, 1); padlock(-2, -9);
        }
      } else {
        R(OUT, -8, -28, 17, 28);
        bricks(-8, -27, 12, 9, BRICK);
        if (open) { R(C.L[0], -8, -18, 12, 16); R(C.L[1], -8, -12, 10, 10); R(C.L[2], -8, -10, 6, 7); R(C.L[3], -8, -9, 2, 5); }
        else R(VOID, -8, -18, 12, 16);
        R(OUT, 3, -28, 6, 28); bricks(4, -27, 4, 27, BRICK); R(BRICK[3], 4, -27, 1, 27);
        /* lamp hung from the corner on a bracket */
        R(IRON[2], 0, -22, 4, 1); R(OUT, -1, -22, 3, 4); R(open ? '#FFF0C0' : COLD[1], 0, -21, 1, 2);
        var ne = open ? NEON[1] : '#2A3A3A';
        R(OUT, 4, -18, 4, 7); R('#0A1418', 5, -17, 2, 5); R(ne, 5, -15, 2, 1); D(ne, 5, -16); D(ne, 5, -14);
        R(C.cap, -8, -2, 11, 2);
        if (!open) { R(OUT, -3, -18, 4, 16); for (k = -17; k < -2; k += 2) { R(IRON[2], -2, k, 2, 1); } padlock(-3, -12); }
      }
    },
    glow: function (o, open, nl, C) {
      if (!open) return;
      if (o === 'F') {
        A(0.6); R('#FFE0A0', -1, -23, 2, 2); A(0.25); R(C.L[3], -3, -21, 6, 3); A(1);
        A(0.5); R(NEON[0], -11, -19, 4, 1); A(1);
        spill(o, C.L[3], 0, 8, 4 + 3 * nl, 0.4);
        /* a wet reflection: the lamp again, in the street */
        A(0.35); R('#FFE0A0', -1, 3 + nl, 2, 1); R('#FFE0A0', -1, 5 + nl, 2, 1); A(1);
      } else if (o === 'B') { A(0.3); R(C.L[3], -3, -10, 6, 10); A(1); spill(o, C.L[3], 0, 8, 3 + 2 * nl, 0.4); }
      else { A(0.6); R('#FFE0A0', 0, -21, 1, 2); A(0.3); R(C.L[3], -8, -10, 6, 7); A(1); spill(o, C.L[3], -6, 8, 4 + 3 * nl, 0.4); }
    },
    motes: 0
  });

  /* ── rift ─────────────────────────────────────────────────────────── */
  var TEAR = [[-24, 0, 1], [-23, 0, 1], [-22, -1, 2], [-21, -1, 2], [-20, -1, 3], [-19, 0, 3], [-18, 0, 3], [-17, -1, 3], [-16, -2, 3],
              [-15, -2, 4], [-14, -2, 4], [-13, -1, 4], [-12, 0, 3], [-11, 0, 3], [-10, -1, 3], [-9, -1, 3], [-8, -2, 3], [-7, -1, 2],
              [-6, -1, 2], [-5, 0, 1], [-4, 0, 1]];
  style('rift', 'a jagged tear of storm-light hanging in the air, crackling gently; stitched shut when it will not have you',
  {
    draw: function (o, open, nl, C) {
      var M = C.M, i, r;
      var wide = open ? nl : 0;
      if (o === 'P') {
        /* a crack across the floor instead */
        for (i = 0; i < TEAR.length; i++) {
          r = TEAR[i];
          var cx = r[0] + 14, cy = -9 + r[1] - (wide ? 1 : 0), ch = r[2] + (wide ? wide : 0);
          R(OUT, cx, cy - 2, 1, ch + 4); R(open ? M[1] : '#14141E', cx, cy - 1, 1, ch + 2); R(open ? M[3] : '#22222E', cx, cy, 1, ch);
          if (open && ch > 2) D(M[4], cx, cy + (ch >> 1));
        }
        if (!open) for (i = -8; i < 9; i += 4) { R('#77727E', i, -11, 1, 5); }
        return;
      }
      for (i = 0; i < TEAR.length; i++) {
        r = TEAR[i];
        var x = r[1] - (wide > 1 ? 1 : 0), w = r[2] + (wide > 1 ? 1 : 0);
        R(OUT, x - 2, r[0], w + 4, 1);
        R(open ? M[1] : '#14141E', x - 1, r[0], w + 2, 1);
        R(open ? M[3] : '#22222E', x, r[0], w, 1);
        if (open && w > 2) D(M[4], x + (w >> 1), r[0]);
      }
      if (open) { D('#FFFFFF', 0, -15); D('#FFFFFF', 0, -14); if (wide) { D('#FFFFFF', -1, -13); D(M[4], 0, -16); } }
      else {
        /* stitches across the seam */
        for (i = -22; i < -5; i += 4) { R('#77727E', -3, i, 6, 1); D('#A8A2B0', -3, i); D('#A8A2B0', 2, i); }
      }
      /* bits of the world it has pulled loose, floating */
      R(OUT, -8, -18, 3, 3); D(C.st[3], -7, -17); R(OUT, 6, -10, 3, 3); D(C.st[3], 7, -9); D(C.st[2], -6, -7); D(C.st[2], 5, -21);
      /* a scorch on the floor under it */
      R(OUT, -5, -2, 10, 2); R(open ? M[1] : '#14141E', -4, -2, 8, 1);
    },
    glow: function (o, open, nl, C) {
      if (!open) return;
      A(0.4 + 0.15 * nl);
      for (var i = 0; i < TEAR.length; i++) {
        var r = TEAR[i];
        if (o === 'P') R(C.M[3], r[0] + 14, -11 + r[1], 1, r[2] + 4); else R(C.M[3], r[1] - 2, r[0], r[2] + 4, 1);
      }
      A(1);
      spill(o === 'E' ? 'E' : o === 'P' ? 'B' : 'F', C.M[3], o === 'E' ? -12 : 0, 6, 3 + 2 * nl, 0.35);
    },
    crackle: 1
  });

  var ALIAS = { trapdoor: 'hatch', cave: 'tunnel', hedge: 'tunnel', doorway: 'arch', portcullis: 'gate', stage: 'curtain',
                painting: 'frame', tear: 'rift', ladder: 'hatch', steps: 'stairs', stair: 'stairs' };
  var VARIANT = { cave: 'rock' };

  /* ── which style, when the room did not say ─────────────────────────
     By the passage it leads to first (some exits are a story beat), then
     by zone and wall. Keyed `room>to`. */
  var BY_EXIT = {
    'a3_fork>b1_throne': { style: 'stairs' },          /* up to the castle */
    'a3_fork>b7_altar': { style: 'tunnel' },           /* "not swept in a long time" */
    'b1_throne>a3_fork': { style: 'door' },            /* the castle's front door */
    'b7_altar>a3_fork': { style: 'tunnel' },           /* back out to the woods */
    'b7_altar>b8_arena': { style: 'gate' },
    'b8_arena>b7_altar': { style: 'arch' },
    'd1_street>b7_altar': { style: 'portal', tint: '#FF8A3A' },   /* the fire door, from the other side */
    'd1_street>h3_trip': { style: 'portal', tint: '#FF6BD6' },    /* "a door painted on the street" */
    'h3_trip>d1_street': { style: 'portal', tint: '#FF6BD6' },
    'g_8>h1_storm': { style: 'stairs' },               /* "a staircase down" */
    'h1_storm>g_8': { style: 'stairs', dir: 'up' },
    'h2_machine>h1_storm': { style: 'rift' },
    'e4_corridor>e3_hall': { style: 'arch' }
  };
  function byZone(ts, side, open, labelled, onFloor) {
    if (onFloor) return ts === 'woods' ? 'path' : ts === 'prize' || ts === 'storm' ? 'stairs' : 'hatch';
    switch (ts) {
      case 'woods': return side === 'e' || side === 'w' ? 'path' : 'tunnel';
      case 'castle': return !open ? 'gate' : (side === 'e' || side === 'w') ? 'arch' : 'door';
      case 'city': return side === 's' ? 'door' : 'alley';
      case 'home': return side === 'e' ? 'arch' : 'door';
      case 'prize': return labelled ? 'door' : 'curtain';
      case 'storm': return 'rift';
    }
    return 'arch';
  }

  /* ── where the piece stands ─────────────────────────────────────────
     An exit on a FLOOR cell (the prize hall's doors stand on the floor
     under their frames) is drawn in the wall it backs onto, so the art
     sits in the wall and the cell you walk onto is its lit threshold. */
  var DIRV = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
  function roomInfo() {
    var api = NEU.engine && NEU.engine.api, rm = api && api.room;
    if (!rm || !rm.grid) return null;
    var ts = NEU.engine.tilesets ? NEU.engine.tilesets()[rm.tileset] : null;
    return { rm: rm, solid: (ts && ts.solid) || '#' };
  }
  function cellAt(info, x, y) {
    if (y < 0 || y >= info.rm.grid.length || x < 0) return '#';
    var r = info.rm.grid[y];
    return x >= r.length ? '#' : r.charAt(x);
  }

  function resolve(e, d) {
    var side = d.side || (NEU.engine && NEU.engine.exitSide ? NEU.engine.exitSide(e) : 's');
    var rid = typeof d.room === 'string' ? d.room : (d.room && d.room.id) || '';
    var ts = d.tileset || (d.room && d.room.tileset) || 'castle';
    var info = roomInfo(), onFloor = false, lift = 0, shift = 0;
    var open = d.open !== undefined ? !!d.open : (!e.locked || !!(NEU.save && NEU.save.flagged(e.locked)));
    if (info && info.rm.id === rid) {
      var ch = cellAt(info, e.x, e.y);
      onFloor = info.solid.indexOf(ch) < 0;
      if (onFloor) {
        var dv = DIRV[side], bx = e.x - dv[0], by = e.y - dv[1];
        if (info.solid.indexOf(cellAt(info, bx, by)) >= 0) {
          lift = 1; onFloor = false;
          /* a frame two cells wide: centre on the pair */
          if ((side === 's' || side === 'n') && cellAt(info, bx + 1, by) === '+' && cellAt(info, bx - 1, by) !== '+') shift = 8;
        }
      }
    }
    var pick = BY_EXIT[rid + '>' + e.to] || null;
    var name = e.style || (pick && pick.style) || byZone(ts, side, open, !!e.label, onFloor);
    var variant = VARIANT[name] || e.variant || null;
    name = ALIAS[name] || name;
    if (!STYLES[name]) name = 'arch';
    var dir = e.dir || (pick && pick.dir) || null;
    var st = STYLES[name];
    var o = st.floorOnly ? 'H' : side === 's' ? 'F' : side === 'n' ? 'B' : 'E';
    if (name === 'stairs' && onFloor) { o = 'H'; variant = dir === 'up' ? 'up' : null; }
    else if (name === 'stairs' && dir === 'up' && o === 'B') o = 'B';
    /* a magic piece in a SOUTH wall would stand over you as you walk up
       to it (it sorts in front of you): it lies on the floor instead */
    if ((name === 'portal' || name === 'rift' || name === 'frame') && o === 'B') o = 'P';
    var DVs = DIRV[side];
    return {
      room: rid, name: name, st: st, o: o, fl: side === 'w', side: side, variant: variant,
      ts: ts, tint: e.tint || (pick && pick.tint) || null,
      /* world offset of the piece from the exit's own anchor */
      dx: lift ? -DVs[0] * T + shift : shift, dy: lift ? -DVs[1] * T : 0,
      S: 0, slots: null, light: [null, null, null, null, null, null], label: e.label || null
    };
  }

  /* ── baking ──────────────────────────────────────────────────────── */
  function mkCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
    return c;
  }
  var bakeCache = {};
  var bakes = 0;
  function bake(r, open, nl, S) {
    var key = r.name + '|' + r.o + '|' + (r.fl ? 1 : 0) + '|' + (open ? 1 : 0) + '|' + nl + '|' + S + '|' + r.ts + '|' + (r.tint || '') + '|' + (r.variant || '') + '|' + (r.label || '');
    if (bakeCache[key]) return bakeCache[key];
    var C = colours(r.ts, r.name === 'portal' || r.name === 'rift' || r.name === 'frame' ? null : r.tint,
                    r.name === 'portal' || r.name === 'rift' || r.name === 'frame' ? r.tint : null);
    C.ts = r.ts; C.wood = WOOD.slice ? [WOOD[0], WOOD[1], WOOD[2], WOOD[3]] : WOOD;
    var base = mkCanvas(BW * S, BH * S), glow = mkCanvas(BW * S, BH * S);
    var g = base.getContext && base.getContext('2d');
    var out = { base: base, glow: null };
    if (!g) { bakeCache[key] = out; return out; }
    P.g = g; P.S = S; P.fl = r.fl;
    r.st.draw(r.o, open, nl, C, r.variant);
    if (r.label) labelPlate(r.label, r.o, open);
    g.globalAlpha = 1;
    var gg = glow.getContext('2d');
    if (gg && r.st.glow) {
      P.g = gg;
      r.st.glow(r.o, open, nl, C, r.variant);
      gg.globalAlpha = 1;
      out.glow = glow;
    }
    out.C = C;
    P.g = null;
    bakeCache[key] = out;
    bakes++;
    return out;
  }

  /* A door's name plate (the prize corridor's ranks): a 3x5 font, gold
     once its lock is satisfied, grey while it is shut. */
  var GLYPH = {
    T: ['111', '010', '010', '010', '010'], S: ['111', '100', '111', '001', '111'],
    A: ['010', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'],
    C: ['011', '100', '100', '100', '011'], Z: ['111', '001', '010', '100', '111'],
    D: ['110', '101', '101', '101', '110'], E: ['111', '100', '110', '100', '111'],
    '–': ['000', '000', '111', '000', '000'], '-': ['000', '000', '111', '000', '000']
  };
  function labelPlate(text, o, open) {
    var n = text.length, w = n * 4 + 3, h = 9, top = o === 'F' ? -37 : -36, left = -((w + 1) >> 1);
    var fl = P.fl; P.fl = false;
    R(OUT, left - 1, top - 1, w + 2, h + 2);
    R(open ? '#3A2A10' : '#14121C', left, top, w, h);
    R(open ? GOLD[1] : '#2A2836', left, top, w, 1);
    var c = open ? '#FFD34E' : '#6E6880';
    for (var k = 0; k < n; k++) {
      var gl = GLYPH[text.charAt(k)];
      if (!gl) continue;
      for (var r = 0; r < 5; r++) for (var q = 0; q < 3; q++)
        if (gl[r].charAt(q) === '1') R(c, left + 2 + k * 4 + q, top + 2 + r, 1, 1);
    }
    P.fl = fl;
  }

  /* ── per frame ───────────────────────────────────────────────────── */
  var Q = { g: null, S: 1, x: 0, y: 0, fl: false };
  function q(c, x, y, w, h) {
    if (Q.fl) x = -x - w;
    Q.g.fillStyle = c;
    Q.g.fillRect(Q.x + x * Q.S, Q.y + y * Q.S, w * Q.S, h * Q.S);
  }
  /* gold chevrons on the floor, pointing through the passage. They
     march toward it (still, under reduced motion). */
  var CHEV_UP = [2, 0, 1, 1, 3, 1, 0, 2, 4, 2];       /* x,y pairs: '^' */
  function chevrons(side, near, t, col, still) {
    var g = Q.g, ph = still ? 0 : (t * 0.9) % 1, i, j, x, y;
    for (i = 0; i < 3; i++) {
      var dist = 4 + i * 5 + (1 - ph) * 5;            /* how far from the passage, in px */
      var a = near * (1 - i / 3.2) * (i === 2 ? ph : 1) * 0.85;
      if (a <= 0.02) continue;
      g.globalAlpha = a;
      for (j = 0; j < CHEV_UP.length; j += 2) {
        var cx = CHEV_UP[j] - 2, cy = CHEV_UP[j + 1];
        if (side === 's') { x = cx; y = Math.round(dist) + cy; }                      /* below, pointing up */
        else if (side === 'n') { x = cx; y = -16 - Math.round(dist) - cy; }           /* above, pointing down */
        else { x = 8 + Math.round(dist) + cy; y = -8 + cx; }                          /* right, pointing left */
        q(col, x, y, 1, 1);
      }
    }
    g.globalAlpha = 1;
  }

  function hashf(i, s) { var h = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return h - Math.floor(h); }

  function anim(r, open, near, t, C, still) {
    var g = Q.g, st = r.st, o = r.o, i;
    if (still) {
      /* reduced motion: the vines still hang, nothing drifts */
      if (st.vines && r.variant !== 'rock' && o === 'F') vines(C, 0);
      return;
    }
    if (st.vines && r.variant !== 'rock' && o === 'F') vines(C, t);
    if (!open) return;
    if (st.motes) {
      /* dust in the light, rising slowly */
      g.globalAlpha = 0.55 + 0.3 * near;
      for (i = 0; i < 4; i++) {
        var u = (t * (0.12 + hashf(i, 1) * 0.1) + hashf(i, 2)) % 1;
        var mx, my;
        if (o === 'F') { mx = -4 + hashf(i, 3) * 8; my = 6 - u * 22; }
        else if (o === 'B') { mx = -4 + hashf(i, 3) * 8; my = -4 - u * 20; }
        else if (o === 'H') { mx = -4 + hashf(i, 3) * 8; my = -4 - u * 14; }
        else { mx = -6 + u * 18; my = -10 + hashf(i, 3) * 8 - u * 3; }
        q(C.L[4], Math.round(mx), Math.round(my), 1, 1);
      }
      g.globalAlpha = 1;
    }
    if (st.fireflies) {
      for (i = 0; i < 3; i++) {
        var ph = t * (0.4 + hashf(i, 5) * 0.3) + i * 2.1;
        var fx = Math.round(Math.sin(ph) * 7 + (o === 'E' ? 4 : 0)), fy = Math.round(-12 + Math.cos(ph * 1.3) * 6 + i * 2);
        var on = Math.sin(ph * 2.2) > -0.2;
        if (!on) continue;
        g.globalAlpha = 0.5 + 0.4 * near;
        q('#E8FF9A', fx, fy, 1, 1);
      }
      g.globalAlpha = 1;
    }
    if (st.sparkle) {
      /* points of light running round the ring, the core breathing */
      var edge = o === 'E', n = 5;
      for (i = 0; i < n; i++) {
        var an = t * 1.1 + i * 6.283 / n;
        var sx = Math.round(Math.cos(an) * (edge ? 2 : 6)) + (edge ? 1 : 0), sy = Math.round(-15 + Math.sin(an) * 10);
        if (o === 'P') { sx = Math.round(Math.cos(an) * 6); sy = Math.round(-8 + Math.sin(an) * 3); }
        g.globalAlpha = 0.5 + 0.5 * near;
        q(i & 1 ? C.M[4] : '#FFFFFF', sx, sy, 1, 1);
      }
      g.globalAlpha = 0.18 + 0.08 * Math.sin(t * 1.6) + 0.15 * near;
      g.globalCompositeOperation = 'lighter';
      if (r.name !== 'frame') { if (o === 'P') q(C.M[3], -3, -10, 6, 4); else if (!edge) q(C.M[3], -3, -19, 6, 10); else q(C.M[3], 0, -20, 2, 12); }
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }
    if (st.crackle) {
      /* a slow walk of bright pixels down the edges of the tear (< 3 Hz) */
      var step = Math.floor(t * 2.5);
      for (i = 0; i < 3; i++) {
        var row = TEAR[(step * 7 + i * 5) % TEAR.length];
        g.globalAlpha = 0.6 + 0.4 * near;
        if (o === 'P') { q(i & 1 ? '#FFFFFF' : C.M[4], row[0] + 14, -11 + row[1] - (i & 1), 1, 1); continue; }
        q(i & 1 ? '#FFFFFF' : C.M[4], row[1] - 2 - (i & 1), row[0], 1, 1);
        q(C.M[4], row[1] + row[2] + 1 + (i & 1), row[0], 1, 1);
      }
      g.globalAlpha = 1;
    }
  }
  /* the vines over a tunnel mouth, swaying a pixel */
  var VINES = [[-5, -20, 5], [-2, -21, 7], [3, -21, 4], [5, -19, 6]];
  function vines(C, t) {
    for (var i = 0; i < VINES.length; i++) {
      var v = VINES[i], len = v[2];
      for (var k = 0; k < len; k++) {
        var sway = t ? Math.round(Math.sin(t * 1.3 + i * 1.7) * (k / len) * 1.2) : 0;
        q(k === len - 1 ? C.fol[4] : C.fol[2], v[0] + sway, v[1] + k, 1, 1);
      }
    }
  }

  function nearStep(n) { return n >= 0.85 ? 2 : n >= 0.4 ? 1 : 0; }

  function state(e, d) {
    var r = e.__door;
    var rid = typeof d.room === 'string' ? d.room : (d.room && d.room.id) || '';
    if (!r || r.room !== rid || (e.style && r.req !== e.style) || (d.side && r.side !== d.side)) {
      r = e.__door = resolve(e, d);
      r.req = e.style || null;
    }
    return r;
  }

  function draw(g, e, d) {
    if (!e || e.sheet || !g || !g.drawImage) return false;
    var r = state(e, d), S = d.S | 0 || 1;
    var open = d.open !== undefined ? !!d.open : (!e.locked || !!(NEU.save && NEU.save.flagged(e.locked)));
    var near = d.near || 0, nl = open ? nearStep(near) : 0;
    if (r.S !== S) { r.S = S; r.slots = [null, null, null, null, null, null]; }
    var si = (open ? 3 : 0) + nl, b = r.slots[si];
    if (!b) b = r.slots[si] = bake(r, open, nl, S);
    var x0 = d.sx + r.dx * S, y0 = d.sy + r.dy * S;
    var still = reduced(), t = (d.now || 0) / 1000;
    g.drawImage(b.base, x0 - AX * S, y0 - AY * S);
    if (b.glow) {
      var flick = still ? 1 : 0.9 + 0.1 * Math.sin(t * 2.3 + e.x) * Math.sin(t * 1.27 + e.y);
      var op = g.globalCompositeOperation;
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = (open ? 0.75 + 0.25 * near : 0.6 + 0.4 * near) * flick;
      g.drawImage(b.glow, x0 - AX * S, y0 - AY * S);
      g.globalAlpha = 1;
      g.globalCompositeOperation = op;
    }
    Q.g = g; Q.S = S; Q.x = x0; Q.y = y0; Q.fl = r.fl;
    anim(r, open, near, t, b.C, still);
    if (open && near > 0.05) {
      /* from the piece's own anchor: when it is drawn in the wall behind
         a floor exit, that puts them on the cell you walk onto */
      chevrons(r.side, near, t, '#FFD34E', still);
    }
    Q.g = null;
    return true;
  }

  /* ── light ─────────────────────────────────────────────────────────
     Records are made once per exit and state, then handed back. */
  var LIGHT = {
    door:    { r: 30, glow: 0.22 }, arch:  { r: 32, glow: 0.2 },  tunnel: { r: 18, glow: 0.12 },
    stairs:  { r: 28, glow: 0.2 },  gate:  { r: 26, glow: 0.18 }, portal: { r: 36, glow: 0.3, flicker: true },
    frame:   { r: 28, glow: 0.24 }, curtain: { r: 30, glow: 0.24 }, hatch: { r: 22, glow: 0.2 },
    path:    { r: 34, glow: 0.2, flicker: true }, alley: { r: 30, glow: 0.2 }, rift: { r: 34, glow: 0.3, flicker: true }
  };
  function light(e, d) {
    if (!e || e.sheet) return undefined;
    d = d || {};
    var r = state(e, d);
    var open = d.open !== undefined ? !!d.open : (!e.locked || !!(NEU.save && NEU.save.flagged(e.locked)));
    var nl = open ? nearStep(d.near || 0) : 0, si = (open ? 3 : 0) + nl;
    if (r.light[si]) return r.light[si];
    var C = colours(r.ts, r.name === 'portal' || r.name === 'rift' || r.name === 'frame' ? null : r.tint,
                    r.name === 'portal' || r.name === 'rift' || r.name === 'frame' ? r.tint : null);
    var base = LIGHT[r.name] || LIGHT.arch, rec;
    if (!open) rec = { r: 14, col: '#6E8CFF', glow: 0.08, a: 0.6 };
    else {
      var magic = r.name === 'portal' || r.name === 'rift' || r.name === 'frame';
      rec = { r: base.r + 5 * nl, col: magic ? C.M[3] : C.warm, glow: base.glow + 0.06 * nl, flicker: !!base.flicker };
    }
    r.light[si] = rec;
    return rec;
  }

  NEU.engineDoors = {
    draw: draw, light: light, styles: DESC,
    /* for tests and the gallery */
    resolve: resolve, aliases: ALIAS, byExit: BY_EXIT, byZone: byZone,
    get bakes() { return bakes; },
    clear: function () { bakeCache = {}; palCache = {}; bakes = 0; }
  };
})();
