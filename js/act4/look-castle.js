/* look-castle.js — what the castle (b1 … b7) looks like.
   ───────────────────────────────────────────────────────────────────
   Built on the kit in look-woods.js (NEU.roomArt) and on the same
   pattern as summon.js: entity kinds the engine draws and lights like
   any other. b8_arena is summon.js's and is not touched here.

     castlefloor  one per room at (0,0): the whole room — flagstones, the
                  worn path, carpet, dais, ice, the tall north wall with
                  its windows, reliefs and tapestries — painted ONCE from
                  the grid into a 1x canvas and blitted per frame. A room
                  may name a live overlay in ANIM (ice glints, the ember
                  trench, the mirror's gaze) — a few rects a frame.
     castleprop   standing set dressing sorted by foot Y: columns,
                  candelabras, wall sconces, thrones, ash urns, statues,
                  armour, candles, bones, a light-only `glow`. Baked once
                  per variant, flames drawn live.
     castlefx     one per room on its bottom row: window light shafts,
                  above the sprites and under the engine's light layer.

   Skins (see look-woods.js) for the castle's logic-bearing entities:
   throne2, riddle, wordstone, plaque, lectern, brazier, iceplate,
   mirrorplate, mirror, walltorch, cresset, altar.

   Tile chars the castle adds (rooms-a.js tileset 'castle'):
     D  dais (walkable)        d  the dais's front step (walkable)
     L  the ember trench (solid, b3)

   No gradients, no shadowBlur, nothing allocated per frame; under
   reduced motion every flame and glint holds still. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var KK = NEU.engineKinds, A = NEU.roomArt;
  if (!KK || !A) return;

  var T = 16;
  var hash = A.hash, sprite = A.sprite, blit = A.blit, blob = A.blob, flame = A.flame, W = A.W, still = A.still;
  function Lk() { return NEU.engineLook; }
  var roomOf = A.roomOf;
  function save() { return NEU.save; }
  function flagged(k) { return !!(save() && save().flagged(k)); }

  var C = {
    /* flagstones */
    s0: '#2C2638', s1: '#312A40', s2: '#2A2439', s3: '#352D44', mort: '#1C1726', sHi: '#41384F', crack: '#1A1624', moss: '#26342E',
    /* worn path */
    p0: '#4E4250', p1: '#5A4C5A', pHi: '#6E5E6A', pMort: '#2A222E',
    /* carpet */
    k0: '#5A1C34', k1: '#702644', kD: '#3A1022', gold: '#B8903A', goldHi: '#E4C46A',
    /* dais */
    d0: '#463E58', d1: '#4E4662', dHi: '#625878', dVein: '#3A3248', step: '#2A2238',
    /* walls */
    cap: '#0C0912', rim: '#2E2640', rim2: '#1C1628', f0: '#3C3252', f1: '#30283F', f2: '#272033', fM: '#17121F', fLip: '#4E4466', skirt: '#130F1A',
    /* ice */
    i0: '#6E9EC0', i1: '#82B4D4', iHi: '#D8F0FF', iCr: '#4E7EA0', iEdge: '#B8E0F4',
    /* glass */
    g0: '#1E2A5A', g1: '#3A2A6A', g2: '#6A2244', g3: '#2E5A7A', gLead: '#0C0A12', gMoon: '#AFC8FF'
  };
  var CASTLE_SOLID = '#|+L';

  /* ── the painter ─────────────────────────────────────────────────── */
  function paintCastle(R, g, room, c, opts) {
    opts = opts || {};
    var grid = room.grid, Wd = room.w, Ht = room.h, x, y, i;
    function at(xx, yy) {
      if (xx < 0 || yy < 0 || yy >= Ht) return '#';
      var r = grid[yy];
      return xx >= r.length ? '#' : r.charAt(xx);
    }
    function solid(xx, yy) { return CASTLE_SOLID.indexOf(at(xx, yy)) >= 0; }
    function wall(xx, yy) { var ch = at(xx, yy); return ch === '#' || ch === '+'; }
    c.at = at;
    var ice = [];
    /* 1. floors (pillar cells get floor under the column) */
    for (y = 0; y < Ht; y++) for (x = 0; x < Wd; x++) {
      var ch = at(x, y), X = x * T, Y = y * T;
      if (wall(x, y) || ch === 'L') continue;
      if (ch === ',') pathCell(R, x, y, X, Y, at);
      else if (ch === '_') carpetCell(R, x, y, X, Y, at);
      else if (ch === 'D' || ch === 'd') daisCell(R, x, y, X, Y, at, ch === 'd');
      else if (ch === 'A') plinthCell(R, x, y, X, Y, at);
      else if (ch === 'i') { iceCell(R, g, x, y, X, Y, at); ice.push(x, y); }
      else flagCell(R, x, y, X, Y, opts.floor);
      if (ch === 'P') { R(X + 1, Y + 2, 14, 11, C.mort); R(X + 2, Y + 3, 12, 9, '#1E1A28'); }
    }
    c.ice = ice;
    /* 2. contact shadows: under the north wall, beside side walls */
    for (y = 0; y < Ht; y++) for (x = 0; x < Wd; x++) {
      if (solid(x, y)) continue;
      X = x * T; Y = y * T;
      if (wall(x, y - 1)) { g.globalAlpha = 0.5; R(X, Y, T, 3, '#000000'); g.globalAlpha = 0.25; R(X, Y + 3, T, 3, '#000000'); g.globalAlpha = 1; }
      if (wall(x - 1, y)) { g.globalAlpha = 0.3; R(X, Y, 3, T, '#000000'); g.globalAlpha = 1; }
      if (wall(x + 1, y)) { g.globalAlpha = 0.3; R(X + T - 3, Y, 3, T, '#000000'); g.globalAlpha = 1; }
      if (at(x, y - 1) === '|') { g.globalAlpha = 0.35; R(X + 2, Y, 12, 4, '#000000'); g.globalAlpha = 1; }
    }
    /* 3. the ember trench */
    for (y = 0; y < Ht; y++) for (x = 0; x < Wd; x++) {
      if (at(x, y) !== 'L') continue;
      X = x * T; Y = y * T;
      R(X, Y, T, T, '#0A0608');
      R(X, Y, T, 3, '#3A3048'); R(X, Y + 3, T, 1, '#1A1420');
      R(X, Y + T - 2, T, 2, '#2A2238');
      for (i = 0; i < 6; i++) R(X + ((hash(x, y, 200 + i) * 13) | 0), Y + 6 + ((hash(x, y, 210 + i) * 6) | 0), 3, 2, i & 1 ? '#2A1614' : '#3A1E18');
    }
    /* 4. walls: caps everywhere, faces where the floor is below */
    for (y = 0; y < Ht; y++) for (x = 0; x < Wd; x++) {
      if (!wall(x, y)) continue;
      X = x * T; Y = y * T;
      var face = !solid(x, y + 1) && at(x, y + 1) !== undefined && y < Ht - 1;
      if (face) faceCell(R, g, x, y, X, Y, wall(x, y - 1), at);
      else capCell(R, x, y, X, Y, solid, at);
    }
    if (opts.extra) opts.extra(R, g, room, c, at);
  }
  function flagCell(R, x, y, X, Y, style) {
    /* irregular slabs: one big + two small, or four, by cell */
    var h = hash(x, y, 1), i;
    var tones = style === 'cold' ? ['#2A2E42', '#2E3448', '#282B3E', '#333A50'] : [C.s0, C.s1, C.s2, C.s3];
    if (h < 0.5) {
      R(X, Y, T, T, tones[(hash(x, y, 2) * 4) | 0]);
      R(X, Y + 9, 9, 7, tones[(hash(x, y, 3) * 4) | 0]); R(X + 9, Y + 9, 7, 7, tones[(hash(x, y, 4) * 4) | 0]);
      R(X, Y + 8, T, 1, C.mort); R(X + 8, Y + 9, 1, 7, C.mort);
    } else {
      for (i = 0; i < 4; i++) R(X + (i & 1) * 8, Y + (i >> 1) * 8, 8, 8, tones[(hash(x, y, 5 + i) * 4) | 0]);
      R(X, Y + 8, T, 1, C.mort); R(X + ((hash(x, y, 9) < 0.5) ? 8 : 6), Y, 1, 8, C.mort); R(X + 10, Y + 8, 1, 8, C.mort);
    }
    R(X, Y, T, 1, C.mort); R(X, Y + ((x & 1) ? 0 : 8), 1, 8, C.mort);
    R(X + 1, Y + 1, 6, 1, C.sHi); R(X + 1, Y + 9, 4, 1, C.sHi);
    var r = hash(x, y, 12);
    if (r < 0.14) { R(X + 4, Y + 4, 3, 1, C.crack); R(X + 6, Y + 5, 2, 1, C.crack); R(X + 7, Y + 6, 1, 2, C.crack); }
    if (r > 0.9) { R(X + 11, Y + 12, 2, 1, '#4A4258'); }
    if (style === 'dust' && r > 0.6 && r < 0.75) { R(X + 3, Y + 10, 5, 1, '#3A3446'); }
  }
  function pathCell(R, x, y, X, Y, at) {
    R(X, Y, T, T, C.p0);
    for (var i = 0; i < 2; i++) {
      R(X + i * 8, Y, 8, 8, hash(x, y, 20 + i) < 0.5 ? C.p0 : C.p1);
      R(X + ((i + 1) & 1) * 8 - 4 + 4, Y + 8, 8, 8, hash(x, y, 22 + i) < 0.5 ? C.p1 : C.p0);
    }
    R(X, Y + 8, T, 1, C.pMort); R(X + 8, Y, 1, 8, C.pMort); R(X + 4, Y + 8, 1, 8, C.pMort); R(X + 12, Y + 8, 1, 8, C.pMort);
    R(X + 1, Y + 1, 5, 1, C.pHi); R(X + 9, Y + 9, 3, 1, C.pHi);
    if (at(x, y - 1) !== ',') R(X, Y, T, 1, C.pMort);
    if (at(x, y + 1) !== ',') R(X, Y + T - 1, T, 1, C.pMort);
  }
  function carpetCell(R, x, y, X, Y, at) {
    R(X, Y, T, T, C.k0);
    if (((x + y) & 1) === 0) { R(X + 6, Y + 5, 4, 6, C.k1); R(X + 5, Y + 7, 6, 2, C.k1); R(X + 7, Y + 7, 2, 2, C.goldHi); }
    else { R(X + 7, Y + 2, 2, 2, C.kD); R(X + 7, Y + 12, 2, 2, C.kD); }
    if (at(x - 1, y) !== '_') { R(X, Y, 2, T, C.gold); R(X + 2, Y, 1, T, C.kD); R(X, Y + ((y & 1) * 8) + 3, 2, 2, C.goldHi); }
    if (at(x + 1, y) !== '_') { R(X + T - 2, Y, 2, T, C.gold); R(X + T - 3, Y, 1, T, C.kD); }
    if (at(x, y + 1) !== '_' && at(x, y + 1) !== 'd') {
      R(X, Y + T - 2, T, 2, C.gold);
      for (var i = 1; i < 16; i += 3) R(X + i, Y + T, 1, 2, C.gold);   /* fringe */
    }
  }
  function daisCell(R, x, y, X, Y, at, isStep) {
    R(X, Y, T, T, hash(x, y, 30) < 0.5 ? C.d0 : C.d1);
    R(X, Y, T, 1, C.dVein); R(X, Y, 1, T, C.dVein);
    R(X + 2 + ((hash(x, y, 31) * 8) | 0), Y + 4, 5, 1, C.dVein); R(X + 6 + ((hash(x, y, 32) * 4) | 0), Y + 5, 3, 1, C.dVein);
    R(X + 1, Y + 1, 8, 1, C.dHi);
    if (isStep) {
      R(X, Y + 10, T, 2, C.dHi); R(X, Y + 12, T, 4, C.step); R(X, Y + 15, T, 1, '#120E1A');
    } else if (at(x, y + 1) !== 'D' && at(x, y + 1) !== 'd' && at(x, y + 1) !== '_') {
      R(X, Y + 12, T, 4, C.step); R(X, Y + 11, T, 1, C.dHi);
    }
  }
  function plinthCell(R, x, y, X, Y, at) {
    R(X, Y, T, T, '#544A64');
    R(X, Y, T, 1, '#6E6280');
    if (at(x, y - 1) !== 'A') R(X, Y, T, 2, '#7A6E8C');
    if (at(x - 1, y) !== 'A') R(X, Y, 2, T, '#6E6280');
    if (at(x + 1, y) !== 'A') R(X + T - 2, Y, 2, T, '#3A3248');
    if (at(x, y + 1) !== 'A') { R(X, Y + T - 4, T, 4, '#2E2640'); R(X, Y + T - 5, T, 1, '#6E6280'); }
    for (var i = 0; i < 3; i++) R(X + 3 + i * 4, Y + 6 + (i & 1), 2, 1, '#3E3550');
  }
  function iceCell(R, g, x, y, X, Y, at) {
    R(X, Y, T, T, C.i0);
    R(X + 1, Y + 1, 14, 14, C.i1);
    R(X + 2, Y + 3, 6, 1, C.iHi); R(X + 3, Y + 4, 2, 1, C.iHi); R(X + 9, Y + 11, 4, 1, C.iHi);
    var h = hash(x, y, 40);
    if (h < 0.5) { R(X + 4, Y + 8, 4, 1, C.iCr); R(X + 8, Y + 7, 3, 1, C.iCr); R(X + 10, Y + 6, 1, 1, C.iCr); }
    else { R(X + 9, Y + 3, 1, 4, C.iCr); R(X + 6, Y + 6, 3, 1, C.iCr); }
    if (at(x, y - 1) !== 'i') { R(X, Y, T, 2, C.iEdge); }
    if (at(x, y + 1) !== 'i') { R(X, Y + T - 2, T, 2, '#4A7A9A'); }
    if (at(x - 1, y) !== 'i') R(X, Y, 1, T, C.iEdge);
    if (at(x + 1, y) !== 'i') R(X + T - 1, Y, 1, T, '#4A7A9A');
  }
  /* the wall's face: taller than a tile when the wall is two rows deep */
  function faceCell(R, g, x, y, X, Y, tall, at) {
    var top = tall ? Y - 12 : Y + 4, h = Y + T - top, i;
    if (tall) R(X, Y - T, T, 4, C.cap); else R(X, Y, T, 4, C.cap);
    R(X, top, T, 1, C.fLip);
    R(X, top + 1, T, h - 1, C.f1);
    R(X, top + 1, T, 6, C.f0);
    R(X, Y + T - 5, T, 5, C.f2);
    /* ashlar: courses of 6, blocks offset each course */
    var course = 0;
    for (var yy = top + 6; yy < Y + T - 3; yy += 6) {
      R(X, yy, T, 1, C.fM);
      var off = ((course + x) & 1) ? 0 : 6;
      R(X + off, yy - 5, 1, 5, C.fM); if (off + 10 < T) R(X + off + 10, yy - 5, 1, 5, C.fM);
      if (hash(x, course, 50) < 0.3) R(X + off + 2, yy - 4, 4, 1, '#463C5C');
      course++;
    }
    R(X, Y + T - 3, T, 3, C.skirt); R(X, Y + T - 3, T, 1, '#2A2238');
    /* a sconce scorch or a damp streak, now and then */
    if (hash(x, y, 51) < 0.12) { g.globalAlpha = 0.4; R(X + 6, top + 3, 3, h - 6, '#0A0810'); g.globalAlpha = 1; }
  }
  function capCell(R, x, y, X, Y, solid, at) {
    R(X, Y, T, T, C.cap);
    var o = function (dx, dy) { return !solid(x + dx, y + dy); };
    if (o(0, -1)) { R(X, Y, T, 2, C.rim); R(X, Y + 2, T, 1, C.rim2); }
    if (o(-1, 0)) { R(X, Y, 2, T, C.rim); R(X + 2, Y, 1, T, C.rim2); }
    if (o(1, 0)) { R(X + T - 2, Y, 2, T, C.rim); R(X + T - 3, Y, 1, T, C.rim2); }
    if (o(0, 1)) { R(X, Y + T - 3, T, 3, C.f1); R(X, Y + T - 3, T, 1, C.fLip); }
  }

  /* ── wall furniture, painted into the bake ─────────────────────────
     All at world px; (x, y) is the TILE of the north wall face. */
  function window_(R, g, x, y, w, colours) {
    var X = x * T + 8 - (w >> 1), top = y * T - 10, bot = y * T + 11, i, j;
    var cols = colours || [C.g0, C.g1, C.g2, C.g3];
    R(X - 2, top - 1, w + 4, bot - top + 3, '#4E4466');           /* stone surround */
    R(X - 1, top, w + 2, bot - top + 1, C.gLead);
    for (j = top + 1; j < bot; j++) {
      /* pointed arch */
      var d = j - top, inset = d < 4 ? 3 - d + (d < 2 ? 1 : 0) : 0;
      for (i = X + inset; i < X + w - inset; i++) {
        var cell = ((i - X) >> 2) + ((j - top) >> 2) * 3;
        R(i, j, 1, 1, cols[(cell + ((i - X) >> 2)) % cols.length]);
      }
    }
    for (i = X + 3; i < X + w; i += 4) R(i, top + 2, 1, bot - top - 2, C.gLead);
    for (j = top + 5; j < bot; j += 5) R(X, j, w, 1, C.gLead);
    R(X + 1, top + 3, 1, bot - top - 5, C.gMoon);                   /* moon catching the leading */
    R(X - 3, bot + 1, w + 6, 2, '#5A5070'); R(X - 3, bot + 3, w + 6, 1, '#1A1424');   /* sill */
  }
  function rose(R, cx, cy, r) {
    var a, i;
    blob(R, cx, cy, r + 2, r + 2, '#4E4466');
    blob(R, cx, cy, r, r, C.gLead);
    for (i = 0; i < 8; i++) {
      a = i / 8 * Math.PI * 2;
      blob(R, Math.round(cx + Math.cos(a) * r * 0.58), Math.round(cy + Math.sin(a) * r * 0.58), 2, 2, i & 1 ? C.g2 : C.g1);
    }
    blob(R, cx, cy, 3, 3, C.g3); R(cx - 1, cy - 1, 2, 2, C.gMoon);
  }
  function tapestry(R, x, y, w, len, col, sigil) {
    var X = x * T + 8 - (w >> 1), top = y * T - 9, i;
    R(X - 1, top - 1, w + 2, 2, '#6A5A3A');                         /* rod */
    R(X, top + 1, w, len, col);
    R(X + 1, top + 1, 1, len, '#000000'); R(X + w - 2, top + 1, 1, len, '#000000');
    R(X, top + 1, w, 1, C.gold); R(X, top + len - 1, w, 1, C.gold);
    for (i = 0; i < w; i += 2) R(X + i, top + len, 1, 2 + (i & 2 ? 1 : 0), C.gold);
    if (sigil) {
      /* a crescent over a small diamond: the witch's mark */
      var mx = X + (w >> 1);
      R(mx - 2, top + 4, 3, 1, C.goldHi); R(mx - 3, top + 5, 1, 3, C.goldHi); R(mx - 2, top + 8, 3, 1, C.goldHi);
      R(mx, top + 11, 1, 1, C.gold); R(mx - 1, top + 12, 3, 1, C.gold); R(mx, top + 13, 1, 1, C.gold);
    }
  }
  function cobweb(R, g, X, Y, flip) {
    g.globalAlpha = 0.45;
    for (var i = 0; i < 9; i++) { R(flip ? X - i - 1 : X + i, Y, 1, 1, '#B8B0C8'); R(flip ? X - 1 : X, Y + i, 1, 1, '#B8B0C8'); }
    for (i = 0; i < 6; i++) R(flip ? X - i - 1 : X + i, Y + 6 - i, 1, 1, '#B8B0C8');
    for (i = 0; i < 4; i++) R(flip ? X - i - 1 : X + i, Y + 3 - i, 1, 1, '#9A92AA');
    g.globalAlpha = 1;
  }
  function icicles(R, x0, x1, y) {
    /* clustered, uneven: a few long ones, runs of short ones, gaps */
    var base = y * T + T - 3;
    R(x0 * T, base - 1, (x1 - x0 + 1) * T, 2, '#C8E4F4');
    for (var x = x0 * T; x < (x1 + 1) * T; x += 2) {
      var h = hash(x >> 3, y, 61), k = hash(x, y, 60);
      if (h < 0.3 || k < 0.35) continue;
      var len = 1 + ((k * k * (h > 0.75 ? 11 : 5)) | 0);
      for (var i = 0; i < len; i++) R(x, base + i, i < len - 2 ? 2 : 1, 1, i < len - 2 ? '#B8E0F4' : '#E8F8FF');
      R(x, base, 1, Math.max(1, len - 2), '#F4FCFF');
    }
  }
  function snow(R, g, cx, cy, rx, ry) {
    blob(R, cx, cy, rx, ry, '#8AA8C0'); blob(R, cx - 1, cy - 1, rx - 2, ry - 1, '#B8D0E4'); R(cx - rx + 3, cy - ry + 1, rx, 1, '#E0F0FF');
  }
  function ringPaint(R, cx, cy, rx, ry, col, gap) {
    var n = Math.round(Math.PI * 2 * Math.max(rx, ry));
    for (var i = 0; i < n; i++) {
      if (gap && gap(i / n)) continue;
      var a = i / n * Math.PI * 2;
      R(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1, col);
    }
  }
  /* 3x5 letters for the word stones and the numerals */
  var GL = {
    A: ['010', '101', '111', '101', '101'], E: ['111', '100', '110', '100', '111'], F: ['111', '100', '110', '100', '100'],
    H: ['101', '101', '111', '101', '101'], I: ['111', '010', '010', '010', '111'], N: ['101', '111', '111', '111', '101'],
    D: ['110', '101', '101', '101', '110'], L: ['100', '100', '100', '100', '111'], P: ['110', '101', '110', '100', '100'],
    R: ['110', '101', '110', '101', '101'], S: ['011', '100', '010', '001', '110'], V: ['101', '101', '101', '101', '010'],
    '|': ['010', '010', '010', '010', '010']
  };
  function word(R, text, cx, y, col, gap) {
    var sp = gap || 4, w = text.length * sp - 1, x0 = Math.round(cx - w / 2);
    for (var k = 0; k < text.length; k++) {
      var gl = GL[text.charAt(k)];
      if (!gl) continue;
      for (var r = 0; r < 5; r++) for (var c = 0; c < 3; c++) if (gl[r].charAt(c) === '1') R(x0 + k * sp + c, y + r, 1, 1, col);
    }
  }

  /* ── per-room paint ─────────────────────────────────────────────── */
  var PAINT = {
    b1_throne: function (R, g, room, c) {
      paintCastle(R, g, room, c, { floor: 'dust', extra: function (R2, g2) {
        window_(R2, g2, 4, 1, 10); window_(R2, g2, 18, 1, 10);
        rose(R2, 11 * T + 8, 1 * T - 1, 11);
        tapestry(R2, 8, 1, 10, 22, '#4A1E4A', true); tapestry(R2, 14, 1, 10, 22, '#4A1E4A', true);
        tapestry(R2, 1, 1, 8, 18, '#2A1E3A'); tapestry(R2, 21, 1, 8, 18, '#2A1E3A');
        /* moonlight pools from the windows, stepped */
        var pools = [[4, 5], [18, 5], [11, 7]];
        for (var i = 0; i < pools.length; i++) {
          g2.globalAlpha = 0.07; blob(R2, pools[i][0] * T + 14, pools[i][1] * T + 6, 22, 12, '#AFC8FF');
          g2.globalAlpha = 0.07; blob(R2, pools[i][0] * T + 14, pools[i][1] * T + 6, 13, 7, '#AFC8FF');
        }
        g2.globalAlpha = 1;
        /* dust: footprints from the door to the SECOND throne only */
        for (var s = 0; s < 9; s++) {
          var fx = 13 * T + 4 + (s & 1) * 5, fy = 12 * T - s * 18 + 4;
          if (fy < 3 * T) break;
          g2.globalAlpha = 0.5; R2(fx + 18 - s * 2, fy, 2, 3, '#1A1622'); g2.globalAlpha = 1;
        }
        cobweb(R2, g2, 1 * T, 2 * T, false); cobweb(R2, g2, 22 * T, 2 * T, true);
      } });
    },
    b2_blocks: function (R, g, room, c) {
      paintCastle(R, g, room, c, { floor: 'dust', extra: function (R2, g2) {
        /* the riddle relief: a carved panel across the north wall */
        var X0 = 6 * T + 4, X1 = 15 * T - 4, top = 1 * T - 10;
        R2(X0 - 2, top - 1, X1 - X0 + 4, 27, '#4E4466');
        R2(X0, top + 1, X1 - X0, 23, '#2A2238');
        R2(X0 + 1, top + 2, X1 - X0 - 2, 1, '#5A5072');
        for (var l = 0; l < 3; l++)
          for (var k = X0 + 4; k < X1 - 4; k += 3 + ((hash(k, l, 70) * 3) | 0)) R2(k, top + 5 + l * 6, 2 + ((hash(k, l, 71) * 2) | 0), 2, '#8A80A8');
        /* the bowl and the fire carved at its ends */
        R2(X0 + 3, top + 18, 8, 2, '#8A80A8'); R2(X0 + 4, top + 20, 6, 1, '#8A80A8');
        R2(X1 - 10, top + 14, 2, 6, '#C08A6A'); R2(X1 - 12, top + 17, 6, 3, '#C08A6A');
        /* ash drifts under the urns and swept toward the stones */
        g2.globalAlpha = 0.6;
        blob(R2, 5 * T + 8, 3 * T + 3, 9, 3, '#4A4650'); blob(R2, 15 * T + 8, 3 * T + 3, 9, 3, '#4A4650');
        blob(R2, 10 * T + 8, 5 * T + 4, 12, 3, '#3E3A46');
        g2.globalAlpha = 1;
        /* the medallion: a bowl inside a flame, inlaid in the floor */
        var mx = 10 * T + 8, my = 9 * T + 8;
        ringPaint(R2, mx, my, 22, 13, '#1A1622'); ringPaint(R2, mx, my, 21, 12, '#5A5070');
        ringPaint(R2, mx, my, 15, 8, '#5A5070');
        R2(mx - 6, my + 1, 12, 2, '#7A6E90'); R2(mx - 4, my + 3, 8, 1, '#7A6E90');
        R2(mx - 1, my - 7, 2, 7, '#8A5A4A'); R2(mx - 3, my - 4, 6, 3, '#8A5A4A');
        cobweb(R2, g2, 1 * T, 2 * T, false); cobweb(R2, g2, 20 * T, 2 * T, true);
        /* the word plates in front of each stone */
        var words = [[7, 'FRIEND'], [10, 'ASH'], [13, 'PLEASE']];
        for (var w = 0; w < words.length; w++) {
          var px = words[w][0] * T + 8, py = 5 * T + 1, ww = words[w][1].length * 4 + 3;
          R2(px - (ww >> 1) - 1, py - 1, ww + 2, 9, '#0C0A12'); R2(px - (ww >> 1), py, ww, 7, '#3A3020');
          word(R2, words[w][1], px, py + 1, '#C8A86A');
        }
      } });
    },
    b3_braziers: function (R, g, room, c) {
      paintCastle(R, g, room, c, { extra: function (R2, g2) {
        /* a mural of four flames on the north wall, lit in the order */
        for (var i = 0; i < 4; i++) {
          var fx = (5 + i * 4) * T + 8, fy = 1 * T - 4;
          R2(fx - 6, fy - 4, 12, 18, '#241C30'); R2(fx - 5, fy - 3, 10, 16, '#2E2440');
          R2(fx - 2, fy + 2, 4, 9, '#6A3A3A'); R2(fx - 3, fy + 6, 6, 5, '#6A3A3A'); R2(fx - 1, fy, 2, 4, '#8A4A3A');
        }
        tapestry(R2, 3, 1, 8, 20, '#5A2A1E', true); tapestry(R2, 19, 1, 8, 20, '#5A2A1E', true);
        /* a round dais under each brazier, and its numeral */
        var NUM = ['I', 'II', 'III', 'IV'];
        for (i = 0; i < 4; i++) {
          var bx = (5 + i * 4) * T + 8, by = 4 * T + 12;
          blob(R2, bx, by, 14, 7, '#1A1622'); blob(R2, bx, by - 1, 13, 6, '#4A4058'); blob(R2, bx, by - 1, 10, 4, '#3A3248');
          ringPaint(R2, bx, by - 1, 12, 5, '#5A5070');
          var n = NUM[i]; R2(bx - 7, by + 9, 14, 8, '#0C0A12'); R2(bx - 6, by + 10, 12, 6, '#2A2232');
          word(R2, n.replace(/I/g, '|').replace('V', 'V'), bx, by + 10, '#C8A86A', 3);
        }
        cobweb(R2, g2, 1 * T, 2 * T, false); cobweb(R2, g2, 22 * T, 2 * T, true);
      } });
    },
    b4_ice: function (R, g, room, c) {
      paintCastle(R, g, room, c, { floor: 'cold', extra: function (R2, g2) {
        window_(R2, g2, 3, 1, 8, ['#2E5A7A', '#3A6A8A', '#1E3A5A', '#5A8AAA']);
        window_(R2, g2, 16, 1, 8, ['#2E5A7A', '#3A6A8A', '#1E3A5A', '#5A8AAA']);
        icicles(R2, 1, 18, 1);
        /* frost creeping off the ice across the flagstones */
        for (var y = 2; y < 11; y++) for (var x = 1; x < 19; x++) {
          var ch = c.at(x, y);
          if (ch === 'i' || ch === '#' || ch === '|') continue;
          var near = c.at(x - 1, y) === 'i' || c.at(x + 1, y) === 'i' || c.at(x, y - 1) === 'i' || c.at(x, y + 1) === 'i';
          if (!near && hash(x, y, 80) > 0.25) continue;
          g2.globalAlpha = near ? 0.35 : 0.18;
          for (var k = 0; k < 6; k++) R2(x * T + ((hash(x, y, 81 + k) * 14) | 0), y * T + ((hash(x, y, 90 + k) * 14) | 0), 2, 1, '#CFE8F8');
          g2.globalAlpha = 1;
        }
        snow(R2, g2, 2 * T + 2, 2 * T + 6, 14, 6); snow(R2, g2, 18 * T + 6, 2 * T + 6, 12, 5);
        snow(R2, g2, 2 * T, 10 * T + 10, 12, 5); snow(R2, g2, 18 * T + 8, 10 * T + 10, 13, 5);
        /* plate rings: where the slides must die */
        var pl = [[13, 3], [13, 8], [5, 8]];
        for (var i = 0; i < pl.length; i++) ringPaint(R2, pl[i][0] * T + 8, pl[i][1] * T + 9, 10, 6, '#E8F8FF');
      } });
    },
    b5_two: function (R, g, room, c) {
      paintCastle(R, g, room, c, { extra: function (R2, g2) {
        /* a gallery of smaller mirrors along the north wall, all dull */
        var xs = [3, 6, 14, 17];
        for (var i = 0; i < xs.length; i++) {
          var X = xs[i] * T + 3, top = 1 * T - 8;
          R2(X - 1, top - 1, 12, 22, '#6A5A3A'); R2(X, top, 10, 20, '#8A7A4A');
          R2(X + 1, top + 1, 8, 18, '#2A3448'); R2(X + 2, top + 2, 1, 12, '#5A6A88'); R2(X + 5, top + 4, 1, 6, '#3E4A64');
          if (i & 1) { R2(X + 3, top + 6, 4, 1, '#14121C'); R2(X + 5, top + 7, 1, 5, '#14121C'); }   /* cracked */
        }
        /* a long runner, then the two plate settings */
        var pl = [[5, 5], [15, 5]];
        for (i = 0; i < 2; i++) {
          var px = pl[i][0] * T + 8, py = pl[i][1] * T + 8;
          ringPaint(R2, px, py, 13, 8, '#8A7A4A'); ringPaint(R2, px, py, 14, 9, '#1A1424');
          for (var k = 0; k < 8; k++) { var a = k / 8 * Math.PI * 2; R2(Math.round(px + Math.cos(a) * 17) - 1, Math.round(py + Math.sin(a) * 11), 2, 1, '#6A5A3A'); }
        }
        cobweb(R2, g2, 1 * T, 2 * T, false); cobweb(R2, g2, 20 * T, 2 * T, true);
      } });
    },
    b6_dark: function (R, g, room, c) {
      paintCastle(R, g, room, c, { floor: 'dust', extra: function (R2, g2) {
        /* the blind alcoves are crypt niches: a sarcophagus in each */
        /* the niches' floors are a step down and in shadow */
        var cells = [[3, 4, 2], [8, 4, 4], [15, 4, 2], [3, 7, 2], [8, 7, 4], [15, 7, 2]];
        for (var i = 0; i < cells.length; i++) {
          var nx = cells[i][0], ny = cells[i][1], nw = cells[i][2];
          R2(nx * T, ny * T, nw * T, 2 * T, '#16121E');
          for (var k = 0; k < nw * 4; k++) R2(nx * T + ((hash(nx, k, 95) * nw * T) | 0), ny * T + ((hash(ny, k, 96) * 30) | 0), 2, 1, '#1E1828');
          g2.globalAlpha = 0.5; R2(nx * T, ny * T, nw * T, 5, '#000000'); g2.globalAlpha = 1;
          /* a sarcophagus with a sleeping effigy on its lid */
          var w = nw === 4 ? 40 : 24, X = nx * T + ((nw * T - w) >> 1), Y = ny * T + 6;
          R2(X - 1, Y - 1, w + 2, 24, '#08060C');
          R2(X, Y, w, 22, '#3A3248'); R2(X, Y + 17, w, 5, '#2A2438'); R2(X, Y + 17, w, 1, '#5A5070');
          R2(X + 1, Y + 1, w - 2, 15, '#4E4662'); R2(X + 1, Y + 1, w - 2, 1, '#6A6080');
          var mx = X + (w >> 1);
          R2(mx - 3, Y + 2, 6, 4, '#7A7290'); R2(mx - 2, Y + 3, 1, 1, '#3A3248'); R2(mx + 1, Y + 3, 1, 1, '#3A3248');
          R2(mx - 4, Y + 6, 8, 9, '#6A6280'); R2(mx - 4, Y + 6, 2, 9, '#7A7290');
          R2(mx - 2, Y + 8, 4, 2, '#8A82A0');                                  /* folded hands */
          if (nw === 4) { R2(X + 3, Y + 4, 3, 10, '#5A5070'); R2(X + w - 6, Y + 4, 3, 10, '#5A5070'); }
          if (i % 3 === 1) { R2(X - 4, Y + 18, 4, 2, '#B8AEA0'); R2(X + w + 1, Y + 16, 3, 1, '#8A8278'); }
          if (i === 0 || i === 5) { R2(X + 4, Y + 6, 1, 1, '#E8DCC8'); R2(X + 4, Y + 5, 1, 1, '#FFB347'); }
        }
        cobweb(R2, g2, 1 * T, 2 * T, false); cobweb(R2, g2, 19 * T, 2 * T, true);
        cobweb(R2, g2, 1 * T, 10 * T, false); cobweb(R2, g2, 19 * T, 10 * T, true);
        tapestry(R2, 4, 1, 8, 16, '#2A1E2A'); tapestry(R2, 15, 1, 8, 16, '#2A1E2A');
        /* the socket's floor: a ring of scorched stone round it */
        var sx = 10 * T + 8, sy = 6 * T + 10;
        g2.globalAlpha = 0.5; blob(R2, sx, sy, 14, 6, '#0A0608'); g2.globalAlpha = 1;
        ringPaint(R2, sx, sy, 12, 5, '#5A4A3A');
      } });
    },
    b7_altar: function (R, g, room, c) {
      paintCastle(R, g, room, c, { extra: function (R2, g2) {
        tapestry(R2, 5, 1, 10, 22, '#3A1E2E', true); tapestry(R2, 17, 1, 10, 22, '#3A1E2E', true);
        window_(R2, g2, 2, 1, 8); window_(R2, g2, 20, 1, 8);
        /* the ash circle round the plinth: old, grey, half scuffed */
        var cx = 11 * T + 8, cy = 7 * T + 2;
        ringPaint(R2, cx, cy, 44, 30, '#6A6470', function (t) { return hash((t * 60) | 0, 1, 90) < 0.25; });
        ringPaint(R2, cx, cy, 40, 27, '#4A4450', function (t) { return hash((t * 50) | 0, 2, 91) < 0.3; });
        for (var i = 0; i < 8; i++) {
          var a = i / 8 * Math.PI * 2 + 0.2, rx = Math.round(cx + Math.cos(a) * 42), ry = Math.round(cy + Math.sin(a) * 28.5);
          R2(rx - 1, ry - 2, 3, 5, '#7A7480'); R2(rx - 2, ry, 5, 1, '#7A7480');
        }
        g2.globalAlpha = 0.55; blob(R2, cx, cy + 4, 30, 6, '#5A5662'); g2.globalAlpha = 1;
        cobweb(R2, g2, 1 * T, 2 * T, false); cobweb(R2, g2, 22 * T, 2 * T, true);
        /* roots pushing in through the east wall from the wood */
        for (var r = 0; r < 4; r++) {
          var ry2 = 4 * T + r * 9;
          for (var k = 0; k < 10 + r * 3; k++) R2(22 * T - 1 - k, ry2 + ((Math.sin(k * 0.6 + r) * 2) | 0), 2, 2, k & 1 ? '#2A2026' : '#3E3036');
        }
        /* the crack the mushroom grows out of */
        R2(19 * T + 2, 10 * T + 12, 8, 1, '#0C0A12'); R2(19 * T + 9, 10 * T + 13, 5, 1, '#0C0A12'); R2(19 * T + 4, 10 * T + 13, 3, 1, '#26342E');
      } });
    }
  };

  /* ── live floor overlays ─────────────────────────────────────────── */
  function brazierLit(d) {
    var es = d.api && d.api.ents ? d.api.ents() : [], n = 0;
    for (var i = 0; i < es.length; i++) if (es[i].t === 'brazier' && es[i].lit) n++;
    return n;
  }
  var ANIM = {
    b3_braziers: function (g, o, S, d, c) {
      /* the trench under the braziers catches a quarter per brazier held */
      var lit = d.api && d.api.solved && d.api.solved('b3_braziers') ? 4 : brazierLit(d);
      var x0 = 3, x1 = 19, len = x1 - x0 + 1, now = d.now;
      for (var x = x0; x <= x1; x++) {
        var on = (x - x0) < Math.ceil(len * lit / 4);
        for (var k = 0; k < 4; k++) {
          var fl = still() ? 0.5 : 0.5 + 0.5 * Math.sin(now / 220 + x * 1.7 + k * 2.1);
          var col = on ? (fl > 0.66 ? '#FFB347' : fl > 0.33 ? '#E4602A' : '#8A2A10') : (k & 1 ? '#2A1614' : '#3A1E18');
          W(g, o, S, x * T + 1 + k * 4, 9 * T + 7 + ((hash(x, k, 7) * 4) | 0), 3, 2, col);
        }
        if (on && !still() && hash(x, (now / 300) | 0, 3) < 0.15) W(g, o, S, x * T + 7, 9 * T + 3, 1, 2, '#FFE6A0');
      }
    },
    b4_ice: function (g, o, S, d, c) {
      var w = c.ice;
      if (!w || still()) return;
      var t = d.now / 1000;
      for (var i = 0; i < w.length; i += 2) {
        var x = w[i], y = w[i + 1], ph = (t * 0.45 + (x + y) * 0.13) % 1.4;
        if (ph > 1) continue;
        W(g, o, S, x * T + ((ph * 16) | 0), y * T + 2, 1, 12, '#F4FCFF');
        W(g, o, S, x * T + ((ph * 16) | 0) + 2, y * T + 4, 1, 8, '#C8E8FA');
      }
    },
    b5_two: function (g, o, S, d, c) {
      /* the mirror's gaze: a dotted beam to the plate it holds, and on
         that plate, a reflection of whoever stands on the other one */
      var room = roomOf(d), f = room && room.mirrorFace ? room.mirrorFace() : 0;
      if (!f) return;
      var mx = 10 * T + 8, my = 1 * T + 10, tx = (f === 1 ? 15 : 5) * T + 8, ty = 5 * T + 9;
      var n = 40, march = still() ? 0 : ((d.now / 90) | 0) % 4;
      for (var i = 0; i < n; i++) {
        if (((i + march) & 3) === 0) continue;
        var k = i / n;
        W(g, o, S, Math.round(mx + (tx - mx) * k), Math.round(my + (ty - my) * k), 1, 1, i & 1 ? '#E8F0FF' : '#9FB8D8');
      }
      g.globalAlpha = 0.35;
      W(g, o, S, tx - 10, ty - 1, 20, 3, '#9FB8D8');
      g.globalAlpha = 1;
    },
    b7_altar: function (g, o, S, d, c) {
      /* once the ashes are in, the circle smoulders */
      if (!flagged('firedoor') || still()) return;
      var cx = 11 * T + 8, cy = 7 * T + 2, now = d.now;
      for (var i = 0; i < 10; i++) {
        var a = (now / 4000 + i / 10) * Math.PI * 2;
        W(g, o, S, Math.round(cx + Math.cos(a) * 44), Math.round(cy + Math.sin(a) * 30), 1, 1, i & 1 ? '#FF8A3A' : '#E4602A');
      }
    }
  };

  KK.kind('castlefloor', {
    interactive: function () { return false; },
    floor: true,
    draw: function (g, e, d) {
      var room = roomOf(d);
      if (!room || !room.grid) return;
      var c = A.roomPaint(room, PAINT[room.id] || paintCastle);
      var o = A.drawPaint(g, e, d, c);
      var an = ANIM[room.id];
      if (an) an(g, o, d.S, d, c);
    }
  });

  /* ── castle props ────────────────────────────────────────────────── */
  function shadowOval(R, g, cx, cy, rx, ry, a) { g.globalAlpha = a || 0.45; blob(R, cx, cy, rx, ry, '#000000'); g.globalAlpha = 1; }
  var CPROP = {
    column: function (e) {
      var h = e.h || 40;
      return sprite('column' + h, 22, h + 14, 11, h + 10, function (R, g) {
        shadowOval(R, g, 0, 1, 10, 3, 0.5);
        R(-9, -6, 18, 6, '#0C0A12'); R(-8, -6, 16, 2, '#6A6080'); R(-8, -4, 16, 3, '#3E3654');   /* base */
        R(-6, -h, 12, h - 6, '#0C0A12');
        R(-5, -h, 10, h - 6, '#4A4260'); R(-5, -h, 3, h - 6, '#6A6080'); R(2, -h, 3, h - 6, '#2E2840');
        for (var f = -3; f <= 3; f += 3) R(f, -h + 2, 1, h - 10, '#3A3450');
        R(-8, -h - 5, 16, 5, '#0C0A12'); R(-7, -h - 5, 14, 2, '#7A7090'); R(-7, -h - 3, 14, 2, '#4A4260');   /* capital */
        R(-9, -h - 8, 18, 3, '#0C0A12'); R(-8, -h - 8, 16, 1, '#6A6080');
        if (e.ivy) for (var k = 0; k < h; k += 3) R(-5 + ((Math.sin(k * 0.4) * 4) | 0), -h + k, 2, 2, k & 2 ? '#1E3432' : '#264440');
      });
    },
    candelabra: function () {
      return sprite('candelabra', 24, 40, 12, 37, function (R, g) {
        shadowOval(R, g, 0, 0, 6, 2, 0.5);
        R(-5, -2, 10, 2, '#1A1420'); R(-3, -4, 6, 2, '#2A2232');
        R(-1, -26, 2, 24, '#3A3040'); R(-1, -26, 1, 24, '#5A5060');
        R(-8, -24, 16, 2, '#3A3040'); R(-8, -27, 2, 3, '#3A3040'); R(6, -27, 2, 3, '#3A3040');
        R(-9, -28, 4, 1, '#5A5060'); R(5, -28, 4, 1, '#5A5060'); R(-2, -29, 4, 1, '#5A5060');
        R(-8, -32, 2, 4, '#E8DCC8'); R(6, -32, 2, 4, '#E8DCC8'); R(-1, -34, 2, 5, '#E8DCC8');
        R(-8, -29, 2, 1, '#C8B8A0'); R(6, -29, 2, 1, '#C8B8A0');
      });
    },
    sconce: function () {
      return sprite('sconce', 12, 22, 6, 19, function (R) {
        R(-3, -12, 6, 2, '#2A2232'); R(-1, -10, 2, 4, '#2A2232'); R(-2, -6, 4, 1, '#3A3040');
        R(-2, -14, 4, 2, '#5A3A1A'); R(-2, -14, 4, 1, '#7A5A2A');
      });
    },
    throne: function () {
      return sprite('throne', 36, 50, 18, 46, function (R, g) {
        shadowOval(R, g, 0, 0, 14, 3, 0.55);
        R(-12, -40, 24, 40, '#1A0F1A');
        R(-11, -39, 22, 2, '#C8A04A'); R(-10, -44, 4, 6, '#C8A04A'); R(6, -44, 4, 6, '#C8A04A'); R(-2, -46, 4, 8, '#C8A04A');
        R(-9, -42, 2, 3, '#E4C46A'); R(7, -42, 2, 3, '#E4C46A'); R(-1, -45, 2, 3, '#E4C46A');
        R(-10, -37, 20, 20, '#5A2A55'); R(-8, -35, 16, 16, '#7E3E78'); R(-8, -35, 2, 16, '#9A5A94');
        R(-1, -33, 2, 12, '#5A2A55'); R(-4, -28, 8, 2, '#5A2A55');
        R(-13, -18, 26, 4, '#C8A04A'); R(-13, -18, 26, 1, '#E4C46A');
        R(-11, -14, 22, 6, '#7E3E78'); R(-11, -14, 22, 1, '#9A5A94');
        R(-14, -24, 4, 16, '#3A1E3A'); R(10, -24, 4, 16, '#3A1E3A'); R(-14, -24, 4, 2, '#C8A04A'); R(10, -24, 4, 2, '#C8A04A');
        R(-12, -8, 3, 8, '#2A162A'); R(9, -8, 3, 8, '#2A162A'); R(-12, -2, 3, 2, '#C8A04A'); R(9, -2, 3, 2, '#C8A04A');
      });
    },
    urn: function () {
      return sprite('urn', 22, 32, 11, 29, function (R, g) {
        shadowOval(R, g, 0, 0, 8, 2, 0.5);
        R(-6, -6, 12, 6, '#2A2232'); R(-6, -6, 12, 1, '#4A4058');
        R(-5, -16, 10, 10, '#4A4058'); R(-7, -14, 14, 7, '#4A4058'); R(-7, -14, 2, 7, '#6A6080'); R(4, -14, 3, 7, '#2E2840');
        R(-8, -18, 16, 3, '#5A5070'); R(-8, -18, 16, 1, '#7A7090');
        blob(R, 0, -19, 6, 2, '#6A6670'); blob(R, 0, -20, 4, 1, '#8A8690');            /* ash heaped */
        R(-6, -11, 12, 1, '#2E2840');
      });
    },
    statue: function (e) {
      var frozen = !!e.frozen;
      return sprite('statue' + (frozen ? 'f' : ''), 30, 56, 15, 52, function (R, g) {
        shadowOval(R, g, 0, 0, 12, 3, 0.55);
        R(-10, -8, 20, 8, '#3A3450'); R(-10, -8, 20, 2, '#6A6080'); R(-11, -2, 22, 2, '#2A2438');
        var s = frozen ? '#8AA8C0' : '#5A5470', sh = frozen ? '#C8E0F0' : '#7A7290', sd = frozen ? '#5A7A98' : '#3E3850';
        /* a knight with a sword point-down */
        R(-5, -30, 10, 22, s); R(-5, -30, 2, 22, sh); R(3, -30, 2, 22, sd);
        R(-7, -28, 3, 12, s); R(4, -28, 3, 12, sd);
        R(-3, -38, 6, 8, s); R(-3, -38, 2, 8, sh); R(-2, -35, 4, 1, '#1A1626');
        R(-4, -40, 8, 3, sd); R(-1, -42, 2, 3, sh);
        R(-1, -24, 2, 18, '#9A92AA'); R(-4, -25, 8, 2, '#9A92AA');
        if (frozen) {
          for (var i = 0; i < 6; i++) R(-7 + i * 3, -16, 1, 2 + (i & 1) * 3, '#E8F8FF');
          R(-5, -31, 10, 1, '#E8F8FF'); R(-4, -41, 8, 1, '#E8F8FF');
          blob(R, 0, -6, 11, 2, '#B8D0E4');
        }
      });
    },
    armour: function () {
      return sprite('armour', 20, 42, 10, 39, function (R, g) {
        shadowOval(R, g, 0, 0, 7, 2, 0.5);
        R(-4, -4, 8, 4, '#2A2232');
        R(-4, -16, 3, 12, '#5A5A6A'); R(1, -16, 3, 12, '#4A4A5A');
        R(-5, -28, 10, 12, '#6A6A7A'); R(-5, -28, 2, 12, '#8A8A9A'); R(3, -28, 2, 12, '#4A4A5A');
        R(-7, -28, 2, 10, '#5A5A6A'); R(5, -28, 2, 10, '#4A4A5A');
        R(-3, -35, 6, 7, '#6A6A7A'); R(-3, -35, 2, 7, '#8A8A9A'); R(-2, -32, 4, 1, '#14121C');
        R(-1, -38, 2, 3, '#7E3E78'); R(0, -39, 3, 2, '#7E3E78');
        R(7, -36, 1, 32, '#7A7090'); R(6, -38, 3, 3, '#9A92AA');                 /* halberd */
      });
    },
    candles: function (e) {
      return sprite('candles' + ((e.seed || 0) % 2), 18, 16, 9, 13, function (R) {
        R(-6, -1, 12, 1, '#C8B8A0');
        R(-5, -7, 2, 6, '#E8DCC8'); R(-1, -10, 2, 9, '#E8DCC8'); R(3, -6, 2, 5, '#E8DCC8');
        R(-5, -2, 2, 1, '#C8B8A0'); R(-1, -3, 3, 2, '#C8B8A0'); R(4, -1, 3, 1, '#C8B8A0');
      });
    },
    bones: function (e) {
      return sprite('bones' + ((e.seed || 0) % 2), 22, 10, 11, 8, function (R) {
        R(-8, -3, 7, 2, '#B8AEA0'); R(-9, -4, 2, 4, '#B8AEA0'); R(-2, -4, 2, 4, '#B8AEA0');
        R(1, -6, 5, 5, '#C8BEB0'); R(2, -4, 1, 1, '#1A1014'); R(4, -4, 1, 1, '#1A1014'); R(2, -2, 3, 1, '#8A8278');
        R(-4, -1, 8, 1, '#8A8278');
      });
    },
    rubble: function (e) {
      return sprite('rubble', 24, 12, 12, 9, function (R) {
        R(-9, -4, 6, 4, '#3A3450'); R(-9, -4, 6, 1, '#5A5070'); R(-2, -6, 7, 6, '#2E2840'); R(-2, -6, 7, 1, '#4A4260');
        R(6, -3, 4, 3, '#3A3450'); R(-5, -1, 3, 1, '#4A4260');
      });
    },
    books: function () {
      return sprite('books', 34, 40, 17, 37, function (R, g) {
        R(-14, -34, 28, 34, '#1A100A'); R(-13, -33, 26, 32, '#3A2A1A');
        var cols = ['#5A2A3A', '#2A3A5A', '#3A4A2A', '#6A5A3A', '#4A2A4A'];
        for (var sh = 0; sh < 3; sh++) {
          var y = -31 + sh * 10;
          R(-13, y + 8, 26, 2, '#1A100A');
          for (var b = -12; b < 12; b += 2 + ((hash(b, sh, 3) * 2) | 0)) {
            var hh = 5 + ((hash(b, sh, 4) * 3) | 0);
            R(b, y + 8 - hh, 2, hh, cols[((hash(b, sh, 5) * 5) | 0)]);
          }
        }
      });
    },
    glow: function () { return null; }
  };
  /* Two tables. lampR: how much of the baked shade a prop cuts away
     (free at run time). propLight: what it asks the ENGINE to light every
     frame — each of those costs gradients per frame, so only real flames
     that deserve a live flicker are in it; candles and window glows live
     in the shade alone unless a room marks one `live`. */
  var LAMP_R = { candelabra: 60, sconce: 46, candles: 34 };
  function lampR(e) { return e.v === 'glow' ? (e.r || 56) : LAMP_R[e.v] || 0; }
  function propLight(e) {
    switch (e.v) {
      case 'candelabra': return { r: 52, col: '#FFC873', glow: 0.24, flicker: true };
      case 'sconce': return { r: 40, col: '#FFB347', glow: 0.26, flicker: true };
      case 'candles': return e.live ? { r: 26, col: '#FFC873', glow: 0.2 } : null;
      case 'glow': return e.live ? { r: e.r || 56, col: e.col || '#9FB8FF', glow: e.g || 0.1, a: e.a || 0.8 } : null;
      default: return null;
    }
  }
  function propLive(g, e, d) {
    var S = d.S, x = d.sx, y = d.sy, now = d.now;
    if (e.v === 'candelabra') {
      flame(g, x - 7 * S, y - 32 * S, S, 1, now, e.x); flame(g, x + 7 * S, y - 32 * S, S, 1, now, e.x + 1);
      flame(g, x, y - 34 * S, S, 1, now, e.x + 2);
    } else if (e.v === 'sconce') flame(g, x, y - 14 * S, S, 2, now, e.x);
    else if (e.v === 'candles') {
      flame(g, x - 4 * S, y - 7 * S, S, 1, now, e.x); flame(g, x, y - 10 * S, S, 1, now, e.y); flame(g, x + 4 * S, y - 6 * S, S, 1, now, e.x + 2);
    }
  }
  KK.kind('castleprop', {
    interactive: function () { return false; },
    draw: function (g, e, d) {
      var f = CPROP[e.v];
      if (f) blit(g, f(e), d, e.dx || 0, e.dy || 0);
      propLive(g, e, d);
    },
    width: function () { return 0; },
    light: function (e, d) {
      if (e.lightIf && !flagged(e.lightIf)) return null;
      return propLight(e);
    }
  });

  /* ── the fx layer: window light, above the sprites ──────────────── */
  var fxCache = {};
  /* the lights that never move, for the baked shade */
  function lampsOf(room) {
    var out = [], es = room.entities || [];
    for (var i = 0; i < es.length; i++) {
      var e = es[i], li = null;
      if (e.t === 'castleprop' && !e.lightIf && lampR(e)) li = { r: lampR(e) };
      else if (e.t === 'save') li = { r: 46 };
      else if (e.lamp) li = { r: e.lamp };
      if (li) out.push({ x: (e.x + 0.5) * T, y: (e.y + 1) * T - 8, r: li.r * 1.15 });
    }
    return out;
  }
  /* live things that sit ABOVE the shade */
  var FX = {
    b5_two: function (g, e, d) {
      /* stand where the mirror looks, and your reflection holds the other plate */
      var room = roomOf(d), f = room && room.mirrorFace ? room.mirrorFace() : 0;
      var p = d.api && d.api.player, LL = Lk();
      if (!f || !p || !LL) return;
      var cx = Math.floor(p.x / T), cy = Math.floor((p.y - 1) / T);
      var src = f === 1 ? 15 : 5, other = f === 1 ? 5 : 15;
      if (cy !== 5 || cx !== src) return;
      var S = d.S, ox = d.sx - (e.x + 0.5) * T * S, oy = d.sy - (e.y + 1) * T * S;
      g.globalAlpha = still() ? 0.55 : 0.45 + 0.15 * Math.sin(d.now / 300);
      LL.drawPlayer(g, ox + (other * T + 8) * S, oy + 6 * T * S, p.face || 'down', 0, false, S, d.now);
      g.globalAlpha = 1;
    }
  };
  KK.kind('castlefx', {
    interactive: function () { return false; },
    draw: function (g, e, d) {
      var room = roomOf(d);
      if (!room || !room.grid) return;
      var sa = typeof room.shade === 'function' ? room.shade(d.api) : room.shade;
      if (sa > 0) A.drawShade(g, e, d, A.shadeFor(room, sa, lampsOf(room)));
      if (FX[room.id]) FX[room.id](g, e, d);
      if (!room.shafts) return;
      var c = fxCache[room.id];
      if (!c) {
        var cv = A.mkCanvas(room.w * T, room.h * T), gg = cv.getContext && cv.getContext('2d');
        c = fxCache[room.id] = { cv: cv };
        if (gg) {
          var sh = room.shafts;
          for (var i = 0; i < sh.length; i++) {
            /* [tile x, length px, width px, slant, colour] from the north wall down */
            var bx = sh[i][0] * T + 8, len = sh[i][1], w = sh[i][2], sl = sh[i][3] || 0.3, col = sh[i][4] || '#BFD3FF';
            for (var s = 0; s < len; s += 2) {
              var k = s / len, cx = Math.round(bx + s * sl), y = T + 10 + s;
              gg.globalAlpha = 0.09 * (1 - k * 0.7);
              gg.fillStyle = col; gg.fillRect(cx - (w >> 1), y, w, 2);
              gg.globalAlpha = 0.06 * (1 - k);
              gg.fillStyle = '#FFFFFF'; gg.fillRect(cx - (w >> 2), y, w >> 1, 2);
            }
          }
        }
      }
      var S = d.S, ox = d.sx - (e.x + 0.5) * T * S, oy = d.sy - (e.y + 1) * T * S;
      var sm = g.imageSmoothingEnabled;
      g.imageSmoothingEnabled = false;
      g.drawImage(c.cv, ox, oy, c.cv.width * S, c.cv.height * S);
      g.imageSmoothingEnabled = sm;
    },
    width: function () { return 0; }
  });

  /* ── castle skins ───────────────────────────────────────────────── */
  var skins = A.skins;
  skins.throne2 = {
    width: 0,
    draw: function (g, e, d) {
      blit(g, sprite('throne2', 30, 42, 15, 39, function (R, gg) {
        shadowOval(R, gg, 0, 0, 11, 3, 0.55);
        R(-10, -32, 20, 32, '#140C14');
        R(-9, -31, 18, 2, '#8A7040'); R(-2, -35, 4, 5, '#8A7040');
        R(-8, -29, 16, 15, '#3E2440'); R(-6, -27, 12, 12, '#5A3456'); R(-6, -27, 2, 12, '#6E4468');
        R(-11, -14, 22, 3, '#8A7040'); R(-9, -11, 18, 5, '#5A3456');
        R(-4, -12, 6, 2, '#2A1828');                                          /* the dent somebody left */
        R(-9, -6, 2, 6, '#1E121E'); R(7, -6, 2, 6, '#1E121E');
        gg.globalAlpha = 0.5; R(-9, -31, 18, 1, '#8A8290'); R(-8, -14, 16, 1, '#8A8290'); gg.globalAlpha = 1;   /* dust */
      }), d);
    }
  };
  /* the riddle, read where it is carved: the engine npc sits on the wall
     cell; the relief itself is in the paint. A small lit stone marks it. */
  skins.riddle = {
    width: 0,
    draw: function (g, e, d) {
      blit(g, sprite('riddle', 18, 10, 9, 8, function (R) {
        R(-6, -4, 12, 4, '#0C0A12'); R(-5, -4, 10, 3, '#5A5070'); R(-5, -4, 10, 1, '#7A7090');
      }), d);
      var lit = d.api && d.api.solved && d.api.solved('b2_blocks');
      var p = still() ? 0.7 : 0.55 + 0.45 * Math.sin(d.now / 700);
      g.globalAlpha = p; g.fillStyle = lit ? '#E4C46A' : '#B892FF';
      g.fillRect(d.sx - d.S, d.sy - 3 * d.S, 2 * d.S, d.S);
      g.globalAlpha = 1;
    },
    light: function () { return { r: 34, col: '#B892FF', glow: 0.12 }; }
  };
  skins.wordstone = {
    width: 0,
    draw: function (g, e, d) {
      var col = e.colour || '#564B66', state = col === '#E4C46A' ? 'gold' : col === '#2A2A38' ? 'dim' : 'idle';
      var sunk = e.stone === 'ash' && d.api && d.api.solved && d.api.solved('b2_blocks');
      if (sunk) state = 'gold';
      var key = 'wstone' + e.stone + state + (sunk ? 's' : '');
      var pal = state === 'gold' ? ['#E4C46A', '#FFF2C4', '#8F7016'] : state === 'dim' ? ['#2A2A38', '#3A3A4A', '#14141C'] : ['#5A5070', '#7A7090', '#2E2840'];
      blit(g, sprite(key, 22, 34, 11, 31, function (R, gg) {
        shadowOval(R, gg, 0, 0, 9, 2, 0.5);
        R(-9, -4, 18, 4, '#1A1424'); R(-9, -4, 18, 1, '#3E3654');
        var h = sunk ? 8 : 26;
        R(-7, -4 - h, 14, h, '#0C0A12'); R(-6, -4 - h, 12, h, pal[0]); R(-6, -4 - h, 2, h, pal[1]); R(4, -4 - h, 2, h, pal[2]);
        R(-5, -6 - h, 10, 2, pal[0]); R(-4, -7 - h, 8, 1, pal[1]);
        if (!sunk) {
          /* each stone's sign: two rings (friend), a flame on a heap (ash), an open hand (please) */
          var k = pal[2];
          if (e.stone === 'friend') { R(-4, -20, 4, 4, k); R(-3, -19, 2, 2, pal[0]); R(0, -18, 4, 4, k); R(1, -17, 2, 2, pal[0]); }
          else if (e.stone === 'ash') { R(-4, -14, 8, 2, k); R(-3, -16, 6, 2, k); R(-1, -22, 2, 6, k); R(-2, -19, 4, 2, k); }
          else { R(-3, -21, 1, 5, k); R(-1, -22, 1, 6, k); R(1, -21, 1, 5, k); R(3, -19, 1, 3, k); R(-3, -16, 6, 3, k); }
        }
      }), d);
    },
    light: function (e) { return e.colour === '#E4C46A' ? { r: 30, col: '#FFD34E', glow: 0.22 } : null; }
  };
  skins.plaque = {
    width: 0,
    draw: function (g, e, d) {
      blit(g, sprite('plaque', 20, 30, 10, 27, function (R, gg) {
        shadowOval(R, gg, 0, 0, 6, 2, 0.5);
        R(-1, -12, 3, 12, '#2A2232'); R(-4, -2, 8, 2, '#2A2232');
        R(-8, -24, 16, 13, '#3A2A10'); R(-7, -23, 14, 11, '#8A6A2A'); R(-7, -23, 14, 1, '#C8A04A');
        for (var i = 0; i < 4; i++) { R(-5 + i * 3, -20, 2, 1 + (i === 2 ? 2 : i === 0 ? 1 : i === 3 ? 3 : 0), '#3A2A10'); }
        R(-5, -15, 10, 1, '#5A4418');
      }), d);
    },
    light: function () { return { r: 22, col: '#FFC873', glow: 0.1 }; }
  };
  skins.lectern = {
    width: 0,
    draw: function (g, e, d) {
      blit(g, sprite('lectern', 18, 26, 9, 23, function (R, gg) {
        shadowOval(R, gg, 0, 0, 6, 2, 0.5);
        R(-1, -12, 3, 12, '#3A2A1A'); R(-4, -2, 8, 2, '#3A2A1A');
        R(-7, -18, 14, 7, '#2B2014'); R(-6, -17, 12, 5, '#E8DCC8'); R(-6, -17, 12, 1, '#FFF2DC');
        R(-5, -15, 4, 1, '#8A8290'); R(1, -15, 4, 1, '#8A8290'); R(-5, -13, 3, 1, '#8A8290'); R(1, -13, 3, 1, '#8A8290');
        R(0, -17, 1, 5, '#8A7A60');
      }), d);
    }
  };
  /* b3's braziers: tall bronze on a tripod; cold coals, then a real fire */
  skins.brazier = {
    width: 0,
    draw: function (g, e, d) {
      var on = !!e.lit;
      blit(g, sprite('cbrazier' + (on ? 1 : 0), 26, 36, 13, 33, function (R, gg) {
        shadowOval(R, gg, 0, 0, 9, 2, 0.5);
        /* tripod feet, a single stem with a knot, a wide shallow bowl */
        R(-8, -1, 4, 1, '#2A1E10'); R(4, -1, 4, 1, '#2A1E10');
        R(-6, -4, 2, 3, '#5A4428'); R(4, -4, 2, 3, '#3A2A18'); R(-4, -5, 8, 2, '#5A4428');
        R(-1, -13, 2, 9, '#7A5A2A'); R(-1, -13, 1, 9, '#A8783A'); R(-2, -9, 4, 2, '#8A6A30');
        var rows = [[10, -19], [9, -18], [8, -17], [7, -16], [5, -15], [3, -14]];
        for (var i = 0; i < rows.length; i++) {
          var w = rows[i][0], y = rows[i][1];
          R(-w, y, w * 2, 1, '#7A5A2A'); R(-w, y, 2, 1, '#B8863A'); R(w - 2, y, 2, 1, '#4A3418');
        }
        R(-10, -20, 20, 1, '#E4B45A'); R(-11, -19, 1, 1, '#2A1E10'); R(10, -19, 1, 1, '#2A1E10');
        R(-8, -21, 16, 1, on ? '#E4602A' : '#2A2026'); R(-6, -22, 12, 1, on ? '#FFB347' : '#3A3036');
        R(-5, -21, 2, 1, on ? '#FFE6A0' : '#4A4048'); R(3, -21, 2, 1, on ? '#8A2A10' : '#1E181E');
        for (i = 0; i < 4; i++) R(-6 + i * 4, -17, 1, 1, '#E4C46A');
      }), d);
      if (on) { flame(g, d.sx - 2 * d.S, d.sy - 20 * d.S, d.S, 2, d.now, e.n); flame(g, d.sx + 3 * d.S, d.sy - 20 * d.S, d.S, 1, d.now, e.n + 2); }
    },
    light: function (e) { return e.lit ? { r: 70, col: '#FFB347', glow: 0.3, flicker: true } : null; }
  };
  /* b4's plates: a frost rune that blazes once a slide has armed it */
  skins.iceplate = {
    width: 0,
    draw: function (g, e, d) {
      var on = !!e.armed;
      blit(g, sprite('iceplate' + (on ? 1 : 0), 18, 12, 9, 12, function (R) {
        R(-7, -10, 14, 8, '#0C0A12'); R(-6, -9, 12, 6, on ? '#3E8A6E' : '#3A5A78');
        var c2 = on ? '#9FFFD0' : '#8AB8D8';
        R(-1, -9, 2, 6, c2); R(-5, -7, 10, 2, c2); R(-4, -9, 1, 1, c2); R(3, -9, 1, 1, c2); R(-4, -4, 1, 1, c2); R(3, -4, 1, 1, c2);
      }), d);
    },
    light: function (e) { return e.armed ? { r: 26, col: '#7BE3B0', glow: 0.24 } : null; }
  };
  /* b5's plates: brass with a glass eye; the one the mirror holds glows */
  skins.mirrorplate = {
    width: 0,
    draw: function (g, e, d) {
      var room = roomOf(d), f = room && room.mirrorFace ? room.mirrorFace() : 0;
      var held = (f === 1 && e.id === 'R') || (f === 2 && e.id === 'L') || (d.api && d.api.solved && d.api.solved('b5_two'));
      blit(g, sprite('mplate' + (held ? 1 : 0), 20, 12, 10, 12, function (R) {
        R(-8, -10, 16, 8, '#1A1408'); R(-7, -9, 14, 6, '#8A6A2A'); R(-7, -9, 14, 1, '#C8A04A');
        R(-3, -8, 6, 4, held ? '#CFE8FF' : '#3A4A6A'); R(-2, -7, 2, 1, '#FFFFFF');
      }), d);
    },
    light: function (e, d) {
      var room = d && roomOf(d), f = room && room.mirrorFace ? room.mirrorFace() : 0;
      var held = (f === 1 && e.id === 'R') || (f === 2 && e.id === 'L');
      return held ? { r: 28, col: '#BFD8FF', glow: 0.22 } : null;
    }
  };
  skins.mirror = {
    width: 0,
    draw: function (g, e, d) {
      var room = roomOf(d), f = room && room.mirrorFace ? room.mirrorFace() : 0;
      if (d.api && d.api.solved && d.api.solved('b5_two')) f = 3;
      blit(g, sprite('bigmirror' + f, 36, 46, 18, 42, function (R) {
        R(-15, -40, 30, 40, '#3A2A10');
        R(-14, -40, 28, 38, '#8A7A4A'); R(-14, -40, 28, 2, '#E4C46A'); R(-14, -40, 2, 38, '#C8A04A');
        R(-12, -36, 24, 32, '#1E2838');
        R(-11, -35, 22, 30, '#2E3E58');
        R(-9, -33, 2, 22, '#7A9ABA'); R(-6, -33, 1, 10, '#5A7A9A'); R(5, -20, 1, 12, '#4A6A8A');
        R(-4, -46 + 4, 8, 4, '#C8A04A'); R(-2, -44, 4, 2, '#E4C46A');            /* crest */
        R(-16, -4, 32, 4, '#3A2A10'); R(-15, -4, 30, 1, '#C8A04A');
        /* the "pupil": where it looks */
        var px = f === 1 ? 4 : f === 2 ? -6 : f === 3 ? -1 : -1;
        if (f) { R(px - 1, -24, 4, 6, '#CFE8FF'); R(px, -23, 2, 4, '#FFFFFF'); }
        else { R(-6, -21, 12, 1, '#1A2232'); }
      }), d);
    },
    light: function () { return { r: 30, col: '#BFD8FF', glow: 0.14 }; }
  };
  /* b6: the torch in its wall bracket, found by touch in the dark */
  skins.walltorch = {
    width: 0,
    draw: function (g, e, d) {
      blit(g, sprite('walltorch', 14, 30, 7, 27, function (R) {
        R(-1, -2, 3, 2, '#2A2232');
        R(-1, -16, 3, 14, '#5A3E2A'); R(-1, -16, 1, 14, '#7A5A3E');
        R(-3, -18, 7, 3, '#3A3040'); R(-2, -19, 5, 1, '#5A5060');
      }), d);
      flame(g, d.sx, d.sy - 19 * d.S, d.S, 2, d.now, 3);
    },
    light: function () { return { r: 26, col: '#FFB347', glow: 0.3, flicker: true }; }
  };
  skins.cresset = {
    width: 0,
    draw: function (g, e, d) {
      var lit = d.api && d.api.solved && d.api.solved(roomOf(d).id);
      blit(g, sprite('cresset', 26, 36, 13, 33, function (R, gg) {
        shadowOval(R, gg, 0, 0, 9, 2, 0.5);
        R(-6, -4, 12, 4, '#2A2232'); R(-6, -4, 12, 1, '#4A4058');
        R(-2, -18, 4, 14, '#3A3040'); R(-2, -18, 1, 14, '#5A5060');
        R(-9, -24, 18, 6, '#1A1420'); R(-8, -24, 16, 1, '#5A5060');
        for (var i = 0; i < 5; i++) R(-9 + i * 4, -28, 2, 5, '#2A2232');
        R(-6, -22, 12, 2, '#120E14');
      }), d);
      if (lit) {
        flame(g, d.sx - 3 * d.S, d.sy - 24 * d.S, d.S, 2, d.now, 1);
        flame(g, d.sx + 3 * d.S, d.sy - 24 * d.S, d.S, 2, d.now, 3);
      } else if (!still()) {
        g.globalAlpha = 0.3 + 0.2 * Math.sin(d.now / 600);
        g.fillStyle = '#4A2A1A'; g.fillRect(d.sx - 4 * d.S, d.sy - 23 * d.S, 8 * d.S, d.S);
        g.globalAlpha = 1;
      }
    },
    light: function (e, d) {
      return d && d.api && d.api.solved(roomOf(d).id) ? { r: 110, col: '#FFB347', glow: 0.3, flicker: true } : null;
    }
  };
  skins.altar = {
    width: 0,
    draw: function (g, e, d) {
      var fed = flagged(e.gives);
      blit(g, sprite('altarB', 30, 36, 15, 33, function (R, gg) {
        shadowOval(R, gg, 0, 0, 12, 3, 0.55);
        R(-11, -10, 22, 10, '#0C0A12'); R(-10, -10, 20, 2, '#8A8098'); R(-10, -8, 20, 7, '#4A4258');
        for (var i = 0; i < 5; i++) R(-8 + i * 4, -6, 2, 3, '#2E2840');
        R(-4, -20, 8, 10, '#0C0A12'); R(-3, -20, 6, 10, '#5A5070'); R(-3, -20, 2, 10, '#7A7090');
        R(-10, -24, 20, 4, '#0C0A12'); R(-9, -24, 18, 1, '#9A90A8'); R(-9, -23, 18, 2, '#5A5070');
        blob(R, 0, -24, 7, 1, '#3A3446'); R(-5, -25, 10, 1, '#6A6670');        /* the ash ring */
      }), d);
      if (fed) flame(g, d.sx, d.sy - 24 * d.S, d.S, 2, d.now, 5, ['#8A2A10', '#FF6A2A', '#FFB347', '#FFF2C4']);
    },
    light: function (e) { return flagged(e.gives) ? { r: 60, col: '#FF8A3A', glow: 0.26, flicker: true } : null; }
  };
})();
