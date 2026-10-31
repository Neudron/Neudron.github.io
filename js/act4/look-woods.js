/* look-woods.js — what the woods (a1, a2, a3) look like, and the shared
   kit the castle's look (look-castle.js) is built on.
   ───────────────────────────────────────────────────────────────────
   The rooms stay DATA in rooms-a.js. This file only draws them, the
   same way summon.js draws b8_arena: entity kinds the engine sorts and
   lights like any other.

     woodsfloor  one per room, at (0,0). Repaints the whole room — ground,
                 lit path, undergrowth, the forest wall, water — from the
                 room's own grid into ONE offscreen canvas at 1px per
                 world unit, once per room. Every frame is a single
                 drawImage plus a handful of animated pixels (water
                 glints). Drawn under everything (floor: true).
     woodsprop   standing set dressing, sorted by foot Y like the player:
                 oaks, pines, a dead tree, stumps, logs, rocks, lanterns,
                 a cold campfire, glowing toadstools, standing stones, a
                 stone lantern, the castle gate. Each sprite is baked
                 once (per variant + seed) and blitted; only flames,
                 smoke and glow pulses are drawn live.
     woodsfx     one per room, on the bottom row so it sorts LAST: the
                 moonbeams and the ground mist, above every sprite and
                 below the engine's light layer.

   SKINS. Some things in these rooms carry logic (a signpost that
   talks, a brazier in an order puzzle, a mirror that turns). They stay
   the engine's own kinds — npc, brazier, plate, altar, sign — so every
   line, flag and puzzle rule runs exactly as before. An entity with a
   `skin` field is drawn by NEU.roomArt.skins[skin] instead of the stock
   prop; an entity without one is untouched. The hook wraps the kind's
   draw/light/width once (installSkins), never its fire.

   PERFORMANCE RULES (the act was reported laggy):
     - nothing static is drawn twice: room paint and sprites are cached
       canvases, blitted at the room scale with smoothing off;
     - no gradients, no shadowBlur, no per-frame allocation in draw();
     - animated overlays are a few fillRects each, and stop entirely
       under prefers-reduced-motion (NEU.engineLook.reduced).          */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var KK = NEU.engineKinds;
  if (!KK) return;

  var T = 16;
  function L() { return NEU.engineLook; }
  /* The room being drawn. d.room is the room for most kinds, but the
     engine hands exits the room's id in the same (reused) object, so
     anything drawn after a door may see a string: ask the API instead. */
  function roomOf(d) {
    if (d && d.room && d.room.grid) return d.room;
    return (d && d.api && d.api.room) || null;
  }
  function still() { var l = L(); return !l || !!l.reduced; }

  /* ── the shared kit ─────────────────────────────────────────────── */
  function hash(x, y, s) {
    var h = (x * 374761393 + y * 668265263 + (s || 0) * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function mkCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
    return c;
  }
  /* one cached sprite: fn(R, g) draws around the anchor (the foot point) */
  var sprites = {};
  function sprite(key, w, h, ax, ay, fn) {
    var s = sprites[key];
    if (s) return s;
    var cv = mkCanvas(w, h), g = cv.getContext && cv.getContext('2d');
    s = { cv: cv, w: w, h: h, ax: ax, ay: ay };
    sprites[key] = s;
    if (!g) return s;
    var R = function (x, y, ww, hh, c) { g.fillStyle = c; g.fillRect(ax + x, ay + y, ww, hh); };
    R.g = g; R.ax = ax; R.ay = ay;
    fn(R, g);
    return s;
  }
  function blit(g, s, d, dx, dy) {
    if (!s || !s.cv) return;
    var S = d.S, sm = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = false;
    g.drawImage(s.cv, d.sx - (s.ax - (dx || 0)) * S, d.sy - (s.ay - (dy || 0)) * S, s.w * S, s.h * S);
    g.imageSmoothingEnabled = sm;
  }
  /* rows + palette stamped into a 1x canvas */
  function stamp(R, rows, pal, x, y, flip) {
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r], w = row.length;
      for (var c = 0; c < w; c++) {
        var ch = row.charAt(flip ? w - 1 - c : c);
        if (ch === '.' || !pal[ch]) continue;
        R(x + c, y + r, 1, 1, pal[ch]);
      }
    }
  }
  /* filled pixel ellipse */
  function blob(R, cx, cy, rx, ry, c) {
    for (var y = -ry; y <= ry; y++) {
      var k = 1 - (y * y) / ((ry + 0.5) * (ry + 0.5));
      if (k <= 0) continue;
      var hw = Math.round(rx * Math.sqrt(k));
      R(cx - hw, cy + y, hw * 2 + 1, 1, c);
    }
  }
  /* a live flame at screen px: three stepped tongues and a hot core */
  var FIRE = ['#8A2A10', '#E4602A', '#FFB347', '#FFF2C4'];
  function flame(g, x, y, S, size, now, seed, pal) {
    var p = pal || FIRE, f = still() ? 1 : (((now / 85) | 0) + seed) % 4, w = [0, 1, 2, 1][f];
    var s = size || 1;
    g.fillStyle = p[0]; g.fillRect(x - 2 * s * S, y - (3 + w) * s * S, 4 * s * S, (3 + w) * s * S);
    g.fillStyle = p[1]; g.fillRect(x - (2 * s - (f & 1)) * S, y - (5 + w) * s * S, (3 * s) * S, (4 + w) * s * S);
    g.fillStyle = p[2]; g.fillRect(x - s * S, y - (6 + w) * s * S, 2 * s * S, (4 + w) * s * S);
    g.fillStyle = p[3]; g.fillRect(x - Math.max(1, s >> 1) * S, y - (3 + (w >> 1)) * s * S, Math.max(1, s) * S, 2 * S);
  }

  /* ── room paint: one canvas per room, built by its painter ────────── */
  var paints = {};
  function roomPaint(room, painter) {
    var c = paints[room.id];
    if (c) return c;
    var cv = mkCanvas(room.w * T, room.h * T), g = cv.getContext && cv.getContext('2d');
    c = { cv: cv, anim: [] };
    paints[room.id] = c;
    if (!g) return c;
    var R = function (x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); };
    R.g = g;
    try { painter(R, g, room, c); } catch (err) { if (window.console) console.warn('[neu] paint', room.id, err); }
    return c;
  }
  function drawPaint(g, e, d, c) {
    var S = d.S, ox = d.sx - (e.x + 0.5) * T * S, oy = d.sy - (e.y + 1) * T * S;
    var sm = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = false;
    g.drawImage(c.cv, ox, oy, c.cv.width * S, c.cv.height * S);
    g.imageSmoothingEnabled = sm;
    return { x: ox, y: oy };
  }
  /* world rect → screen, for the live overlays */
  function W(g, o, S, x, y, w, h, col) {
    g.fillStyle = col;
    g.fillRect(o.x + x * S, o.y + y * S, w * S, h * S);
  }

  /* ── skins: a look for a logic-bearing entity ───────────────────── */
  var skins = {};
  function installSkins() {
    if (KK.__roomSkins) return;
    KK.__roomSkins = true;
    ['npc', 'brazier', 'plate', 'altar', 'sign', 'save', 'pickup'].forEach(function (t) {
      var k = KK.all[t];
      if (!k) return;
      var draw = k.draw, light = k.light, width = k.width;
      k.draw = function (g, e, d) {
        var s = e.skin && skins[e.skin];
        if (s && s.draw) return s.draw(g, e, d);
        return draw ? draw.apply(this, arguments) : undefined;
      };
      k.light = function (e, d) {
        var s = e.skin && skins[e.skin];
        if (s && s.light) return s.light(e, d);
        return light ? light.apply(this, arguments) : null;
      };
      k.width = function (e, S) {
        var s = e.skin && skins[e.skin];
        if (s && s.width !== undefined) return typeof s.width === 'function' ? s.width(e, S) : s.width;
        return width ? width.apply(this, arguments) : 9;
      };
    });
  }
  installSkins();

  /* ── the shade: a room's static darkness, baked ─────────────────────
     A pre-lit dim layer, the cheap cousin of the engine's dark rooms: the
     room is filled with night at `alpha`, and every light that never moves
     (`lamps`, gathered from the room's props) is cut out of it in three
     stepped bands. One canvas per room and level, one drawImage a frame;
     the engine's own light layer still adds the live glow on top. */
  var shades = {};
  function shadeFor(room, alpha, lamps) {
    var key = room.id + ':' + alpha.toFixed(2), c = shades[key];
    if (c) return c;
    var cv = mkCanvas(room.w * T, room.h * T), g = cv.getContext && cv.getContext('2d');
    shades[key] = cv;
    if (!g) return cv;
    g.fillStyle = '#06040C'; g.globalAlpha = alpha; g.fillRect(0, 0, cv.width, cv.height);
    g.globalCompositeOperation = 'destination-out';
    var R = function (x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); };
    for (var i = 0; i < lamps.length; i++) {
      var L0 = lamps[i], cx = Math.round(L0.x), cy = Math.round(L0.y), r = L0.r;
      var bands = [1, 0.74, 0.5];
      for (var b = 0; b < bands.length; b++) {
        g.globalAlpha = 0.34;
        blob(R, cx, cy, Math.round(r * bands[b]), Math.round(r * bands[b] * 0.8), '#000');
      }
    }
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    return cv;
  }
  /* The player carries a little light of their own through the shade:
     two clipped draws leave a stepped hole round them (no gradient). */
  function drawShade(g, e, d, cv) {
    var S = d.S, ox = d.sx - (e.x + 0.5) * T * S, oy = d.sy - (e.y + 1) * T * S;
    var sm = g.imageSmoothingEnabled, W2 = cv.width * S, H2 = cv.height * S;
    g.imageSmoothingEnabled = false;
    var p = d.api && d.api.player;
    if (!p || !g.clip) { g.drawImage(cv, ox, oy, W2, H2); g.imageSmoothingEnabled = sm; return; }
    var px = ox + p.x * S, py = oy + (p.y - 7) * S, r1 = 16 * S, r2 = 26 * S;
    g.save();
    g.beginPath(); g.rect(ox, oy, W2, H2); g.arc(px, py, r2, 0, Math.PI * 2, true); g.clip('evenodd');
    g.drawImage(cv, ox, oy, W2, H2);
    g.restore();
    g.save();
    g.beginPath(); g.arc(px, py, r2, 0, Math.PI * 2); g.arc(px, py, r1, 0, Math.PI * 2, true); g.clip('evenodd');
    g.globalAlpha = 0.5; g.drawImage(cv, ox, oy, W2, H2);
    g.restore();
    g.imageSmoothingEnabled = sm;
  }

  var A = NEU.roomArt = {
    hash: hash, mkCanvas: mkCanvas, sprite: sprite, blit: blit, stamp: stamp, blob: blob,
    flame: flame, roomOf: roomOf, roomPaint: roomPaint, shadeFor: shadeFor, drawShade: drawShade, drawPaint: drawPaint, W: W, still: still,
    skins: skins, installSkins: installSkins,
    /* the paint caches, for tests and for a room edited at runtime */
    _paints: paints, _sprites: sprites,
    forget: function (id) { if (id) delete paints[id]; else { for (var k in paints) delete paints[k]; } }
  };

  /* ══ THE WOODS ═══════════════════════════════════════════════════ */
  /* Moonlit, blue-green, cold; the only warm colour is the lit path and
     the lanterns somebody hung along it. */
  var C = {
    g0: '#141E26', g1: '#18242C', g2: '#1C2A30', gD: '#0F171D', blade: '#24383A', bladeHi: '#30484A',
    leaf: '#4A2E36', leaf2: '#5A3A2E', peb: '#3A4048', flower: '#9FB8D8', flower2: '#C8A0D8',
    p0: '#7A5E46', p1: '#8A6C50', p2: '#644C3A', pHi: '#A08060', pStone: '#B09A80', pEdge: '#3A2C24',
    m0: '#26443C', m1: '#30564A', mHi: '#4A7A66',
    u0: '#0A1317', u1: '#122226', u2: '#1A3032', u3: '#264440', uHi: '#3E625A', berry: '#9A4A8E',
    f0: '#05080B', f1: '#0A1216', f2: '#101C20', fRim: '#1E3438', bark: '#1E1820', bark2: '#2C2228', barkHi: '#3E3036',
    w0: '#0A1626', w1: '#10223A', w2: '#1C3A5A', wHi: '#5A86AA', wMoon: '#B8D0E8', bank: '#141210'
  };
  var WOOD_SOLID = '#~wT';

  /* fern fronds: three variants, two tones + highlight */
  var FROND = [
    ['...h.....', '..hm.h...', '.mmhmm.h.', 'mmdmmhmm.', '.ddmdmmd.', '..d.dd...'],
    ['.h...h...', '.mh.hm.h.', 'mmmhmmhm.', 'dmdmmmmdd', '.dd.dmd..', '...d.....'],
    ['....h....', '..h.m.h..', '.hmmmmmh.', 'mmdmhmdmm', 'dd.dmd.dd', '....d....']
  ];

  function paintWoods(R, g, room, c, opts) {
    opts = opts || {};
    var grid = room.grid, Wd = room.w, Ht = room.h, x, y, i;
    function at(xx, yy) {
      if (xx < 0 || yy < 0 || yy >= Ht) return '#';
      var r = grid[yy];
      return xx >= r.length ? '#' : r.charAt(xx);
    }
    function solid(xx, yy) { return WOOD_SOLID.indexOf(at(xx, yy)) >= 0; }
    function open(xx, yy) { return !solid(xx, yy); }
    var water = [];
    /* 1. ground everywhere — under solids too, so an overhang has earth under it */
    for (y = 0; y < Ht; y++) for (x = 0; x < Wd; x++) {
      var X = x * T, Y = y * T;
      var n = hash(x >> 1, y >> 1, 3) * 0.6 + hash(x, y, 4) * 0.4;
      R(X, Y, T, T, n < 0.33 ? C.g0 : n < 0.7 ? C.g1 : C.g2);
      /* low-frequency patches so the floor is not a checkerboard */
      if (hash(x, y, 5) < 0.4) R(X + ((hash(x, y, 6) * 8) | 0), Y + ((hash(x, y, 7) * 8) | 0), 6, 4, n < 0.5 ? C.g2 : C.gD);
      for (i = 0; i < 7; i++) {
        var bx = (hash(x, y, 10 + i) * 15) | 0, by = (hash(x, y, 20 + i) * 13) | 0;
        R(X + bx, Y + by, 1, i & 1 ? 2 : 3, i < 4 ? C.blade : C.bladeHi);
      }
      var r0 = hash(x, y, 30);
      if (r0 < 0.18) R(X + ((hash(x, y, 31) * 13) | 0), Y + ((hash(x, y, 32) * 14) | 0), 2, 1, r0 < 0.09 ? C.leaf : C.leaf2);
      if (r0 > 0.9) R(X + ((hash(x, y, 33) * 13) | 0), Y + ((hash(x, y, 34) * 14) | 0), 2, 1, C.peb);
      if (r0 > 0.82 && r0 < 0.86) {
        var fx = X + 3 + ((hash(x, y, 35) * 8) | 0), fy = Y + 3 + ((hash(x, y, 36) * 8) | 0);
        R(fx, fy, 1, 1, C.flower); R(fx + 2, fy + 1, 1, 1, C.flower); R(fx + 1, fy + 3, 1, 1, C.flower2);
      }
    }
    /* 2. moss */
    for (y = 0; y < Ht; y++) for (x = 0; x < Wd; x++) {
      if (at(x, y) !== 'm') continue;
      X = x * T; Y = y * T;
      blob(R, X + 8, Y + 8, 9, 7, C.m0);
      blob(R, X + 5 + ((hash(x, y, 40) * 6) | 0), Y + 6 + ((hash(x, y, 41) * 4) | 0), 4, 3, C.m1);
      for (i = 0; i < 4; i++) R(X + ((hash(x, y, 42 + i) * 14) | 0), Y + ((hash(x, y, 46 + i) * 14) | 0), 1, 1, i ? C.mHi : C.flower);
    }
    /* 3. the lit path: packed earth with a ragged, worn edge */
    for (y = 0; y < Ht; y++) for (x = 0; x < Wd; x++) {
      if (at(x, y) !== ',') continue;
      X = x * T; Y = y * T;
      R(X - 1, Y - 1, T + 2, T + 2, C.pEdge);
    }
    for (y = 0; y < Ht; y++) for (x = 0; x < Wd; x++) {
      if (at(x, y) !== ',') continue;
      X = x * T; Y = y * T;
      R(X, Y, T, T, C.p0);
      var up = at(x, y - 1) === ',', dn = at(x, y + 1) === ',', lf = at(x - 1, y) === ',', rt = at(x + 1, y) === ',';
      /* ragged edge: bites out of the side that meets the grass */
      for (i = 0; i < 16; i += 2) {
        var b1 = (hash(x * 16 + i, y, 50) * 3) | 0;
        if (!up) R(X + i, Y, 2, b1, C.pEdge);
        if (!dn) R(X + i, Y + T - b1, 2, b1, C.pEdge);
        var b2 = (hash(x, y * 16 + i, 51) * 3) | 0;
        if (!lf) R(X, Y + i, b2, 2, C.pEdge);
        if (!rt) R(X + T - b2, Y + i, b2, 2, C.pEdge);
      }
      /* two worn ruts along the direction of travel */
      var horiz = lf || rt || !(up || dn);
      if (horiz) { R(X, Y + 5, T, 1, C.p2); R(X, Y + 11, T, 1, C.p2); R(X, Y + 7, T, 2, C.p1); }
      else { R(X + 5, Y, 1, T, C.p2); R(X + 11, Y, 1, T, C.p2); R(X + 7, Y, 2, T, C.p1); }
      for (i = 0; i < 5; i++) {
        var sx = (hash(x, y, 60 + i) * 13) | 0, sy = (hash(x, y, 70 + i) * 13) | 0;
        R(X + 1 + sx, Y + 1 + sy, 2, 1, i < 2 ? C.pStone : C.pHi);
        if (i < 2) R(X + 1 + sx, Y + 2 + sy, 2, 1, C.p2);
      }
    }
    /* 4. water: a black stream with banks */
    for (y = 0; y < Ht; y++) for (x = 0; x < Wd; x++) {
      if (at(x, y) !== 'w') continue;
      X = x * T; Y = y * T;
      R(X, Y, T, T, C.w0);
      R(X, Y + 5 + ((hash(x, y, 80) * 3) | 0), T, 2, C.w1);
      R(X + ((hash(x, y, 81) * 8) | 0), Y + 10, 6, 1, C.w2);
      if (at(x, y - 1) !== 'w') { R(X, Y, T, 3, C.bank); R(X, Y + 3, T, 1, C.w2); for (i = 0; i < 16; i += 3) R(X + i, Y - 1, 2, 1, C.bank); }
      if (at(x, y + 1) !== 'w') { R(X, Y + T - 2, T, 2, C.bank); R(X, Y + T - 3, T, 1, C.w1); }
      if (at(x - 1, y) !== 'w') R(X, Y, 2, T, C.bank);
      if (at(x + 1, y) !== 'w') R(X + T - 2, Y, 2, T, C.bank);
      /* reeds on the far bank */
      if (hash(x, y, 82) < 0.35) { var rx = X + 2 + ((hash(x, y, 83) * 10) | 0); R(rx, Y - 5, 1, 6, C.u3); R(rx + 2, Y - 3, 1, 4, C.u2); R(rx, Y - 6, 1, 2, C.leaf2); }
      water.push(x, y);
    }
    c.water = water;
    /* 5. contact shadow under every solid that has open ground below */
    g.globalAlpha = 0.55;
    for (y = 0; y < Ht; y++) for (x = 0; x < Wd; x++) {
      if (!solid(x, y) || at(x, y) === 'w' || !open(x, y + 1)) continue;
      R(x * T, (y + 1) * T, T, 5, '#000000');
    }
    g.globalAlpha = 1;
    /* 6. the forest wall: black canopy, trunks where it meets open ground */
    for (y = 0; y < Ht; y++) for (x = 0; x < Wd; x++) {
      if (at(x, y) !== '#') continue;
      X = x * T; Y = y * T;
      R(X, Y, T, T, C.f0);
      var faceDown = !solid(x, y + 1) || at(x, y + 1) === '~';
      if (faceDown && open(x, y + 1)) {
        /* trunks rising into the dark, roots spilling onto the floor */
        var tx = X + 2 + ((hash(x, y, 90) * 6) | 0), tw = 4 + ((hash(x, y, 91) * 3) | 0);
        R(tx, Y + 4, tw, 12, C.bark); R(tx, Y + 4, 1, 12, C.barkHi); R(tx + tw - 1, Y + 4, 1, 12, C.f1);
        R(tx - 2, Y + T - 1, 2, 2, C.bark); R(tx + tw, Y + T - 1, 3, 2, C.bark);
        if (hash(x, y, 92) < 0.6) { var t2 = X + 11 + ((hash(x, y, 93) * 3) | 0); R(t2, Y + 7, 3, 9, C.bark2); R(t2, Y + T - 1, 4, 1, C.bark2); }
        R(X, Y + T - 1, T, 1, C.f1);
      }
      for (i = 0; i < 3; i++) {
        var cx = X + ((hash(x, y, 100 + i) * 16) | 0), cy = Y + ((hash(x, y, 110 + i) * (faceDown ? 6 : 14)) | 0);
        blob(R, cx, cy, 5 + i, 3 + i, i === 2 ? C.f2 : C.f1);
      }
      /* moonlit rim on a canopy edge facing the room */
      if (open(x, y + 1) && hash(x, y, 120) < 0.7) R(X + ((hash(x, y, 121) * 8) | 0), Y + 1, 5, 1, C.fRim);
    }
    /* 7. undergrowth: layered fronds, top-down so lower rows overhang */
    for (y = 0; y < Ht; y++) for (x = 0; x < Wd; x++) {
      if (at(x, y) !== '~') continue;
      X = x * T; Y = y * T;
      R(X, Y, T, T, C.u0);
      var pal = { d: C.u1, m: C.u2, h: C.u3 };
      for (i = 0; i < 4; i++) {
        var v = FROND[(hash(x, y, 130 + i) * 3) | 0];
        stamp(R, v, pal, X - 2 + ((hash(x, y, 140 + i) * 10) | 0), Y - 2 + ((hash(x, y, 150 + i) * 12) | 0), hash(x, y, 160 + i) < 0.5);
      }
      if (open(x, y - 1)) {           /* moonlit top edge, fronds poking up */
        for (i = 0; i < 16; i += 3) R(X + i, Y - 1 - ((hash(x * 16 + i, y, 170) * 3) | 0), 2, 2, C.u3);
        R(X + ((hash(x, y, 171) * 10) | 0), Y, 5, 1, C.uHi);
      }
      if (open(x, y + 1)) {           /* the front: hanging fronds over the floor */
        R(X, Y + 11, T, 5, C.u1);
        for (i = 0; i < 16; i += 2) R(X + i, Y + T, 1, 1 + ((hash(x * 16 + i, y, 180) * 4) | 0), C.u1);
        R(X + 2, Y + 11, 3, 1, C.u3); R(X + 9, Y + 12, 4, 1, C.u3);
      }
      if (hash(x, y, 190) < 0.16) { var bx2 = X + 3 + ((hash(x, y, 191) * 9) | 0), by2 = Y + 4 + ((hash(x, y, 192) * 6) | 0); R(bx2, by2, 1, 1, C.berry); R(bx2 + 2, by2 + 1, 1, 1, C.berry); }
      if (hash(x, y, 193) > 0.9) { var wx = X + 4 + ((hash(x, y, 194) * 8) | 0); R(wx, Y + 6, 1, 1, '#D8E0F0'); R(wx + 1, Y + 5, 1, 1, '#D8E0F0'); }
    }
    /* 8. the room's own extras (moon pools, the castle wall at the fork) */
    if (opts.extra) opts.extra(R, g, room, c, at);
  }

  /* moonlight pool on the ground: stepped, three bands */
  function moonPool(R, g, cx, cy, rx, ry) {
    var bands = [[1, 0.10], [0.72, 0.10], [0.44, 0.12]];
    for (var i = 0; i < bands.length; i++) {
      g.globalAlpha = bands[i][1];
      blob(R, cx, cy, Math.round(rx * bands[i][0]), Math.round(ry * bands[i][0]), '#BFD3FF');
    }
    g.globalAlpha = 1;
  }

  /* a castle curtain wall across the top rows (the fork): ashlar,
     crenels, and the gate opening the exit sits in */
  function castleWall(R, g, x0, x1, gateX) {
    var X0 = x0 * T, X1 = (x1 + 1) * T, i, y;
    R(X0, 0, X1 - X0, 32, '#1A1626');
    for (y = 6; y < 30; y += 6) {
      R(X0, y, X1 - X0, 1, '#110E1A');
      for (i = X0 + ((y / 6) & 1 ? 0 : 5); i < X1; i += 10) R(i, y - 5, 1, 5, '#110E1A');
    }
    R(X0, 0, X1 - X0, 2, '#2E2840');
    for (i = X0; i < X1; i += 8) R(i, 2, 4, 3, '#2E2840');      /* crenels */
    R(X0, 30, X1 - X0, 2, '#0C0A12');
    /* ivy down the stone */
    for (i = X0 + 3; i < X1; i += 13) {
      var len = 6 + ((hash(i, 1, 7) * 18) | 0);
      for (y = 2; y < len; y += 2) R(i + ((hash(i, y, 8) * 3) | 0) - 1, y, 2, 2, y & 2 ? '#1E3432' : '#264440');
    }
    if (gateX !== undefined) {
      var gx = gateX * T;
      R(gx - 6, 4, T + 12, 28, '#120E18');               /* the gatehouse */
      R(gx - 6, 4, T + 12, 2, '#3E3654');
      R(gx - 7, 4, 2, 28, '#2E2840'); R(gx + T + 5, 4, 2, 28, '#2E2840');
      for (i = 0; i < 4; i++) R(gx - 5 + i * 7, 0, 4, 4, '#2E2840');
    }
  }

  /* the painters, by room id */
  var PAINT = {
    a1_clearing: function (R, g, room, c) {
      paintWoods(R, g, room, c, { extra: function (R2, g2) {
        moonPool(R2, g2, 10 * T + 8, 7 * T + 4, 54, 36);
        /* a ring of pale stones round the clearing's heart */
        for (var i = 0; i < 14; i++) {
          var a = i / 14 * Math.PI * 2, sx = Math.round(10 * T + 8 + Math.cos(a) * 46), sy = Math.round(7 * T + 6 + Math.sin(a) * 30);
          if (Math.abs(Math.sin(a)) < 0.25 && Math.cos(a) > 0) continue;   /* the gap the path leaves by */
          R2(sx - 2, sy - 1, 4, 3, '#0E1216'); R2(sx - 2, sy - 2, 4, 2, '#6A7280'); R2(sx - 1, sy - 2, 2, 1, '#9AA2B0');
        }
      } });
    },
    a2_path: function (R, g, room, c) {
      paintWoods(R, g, room, c, { extra: function (R2, g2) {
        moonPool(R2, g2, 8 * T + 8, 6 * T + 10, 22, 12);
        moonPool(R2, g2, 18 * T + 8, 2 * T + 10, 20, 10);
      } });
    },
    a3_fork: function (R, g, room, c) {
      paintWoods(R, g, room, c, { extra: function (R2, g2, rm, cc, at) {
        castleWall(R2, g2, 0, rm.w - 1, 10);
        moonPool(R2, g2, 10 * T + 8, 4 * T + 8, 36, 22);
        /* swept steps up to the gate */
        for (var s = 0; s < 3; s++) {
          var sy = 2 * T + s * 6, w = 3 * T + 4 - s * 2;
          R2(9 * T - 2 + s, sy, w, 2, '#7E6650'); R2(9 * T - 2 + s, sy + 2, w, 1, '#3A2E2A');
        }
        /* the unswept way: fallen leaves over the east path */
        for (var x = 11; x < rm.w - 1; x++) for (var y = 6; y < 9; y++) {
          if (at(x, y) !== 'm') continue;
          for (var i = 0; i < 6; i++) R2(x * T + ((hash(x, y, 300 + i) * 14) | 0), y * T + ((hash(x, y, 310 + i) * 14) | 0), 2, 1, i & 1 ? C.leaf : '#6A4A2A');
        }
      } });
    }
  };

  /* water glints: a few pixels a frame, phase-walked along the stream */
  function waterAnim(g, o, S, c, now) {
    var w = c.water;
    if (!w || !w.length || still()) return;
    var t = now / 1000;
    for (var i = 0; i < w.length; i += 2) {
      var x = w[i], y = w[i + 1], ph = (t * 0.5 + hash(x, y, 400)) % 1;
      if (ph > 0.55) continue;
      var gx = x * T + ((ph * 26) | 0) - 4, gy = y * T + 6 + ((hash(x, y, 401) * 5) | 0);
      if (gx < x * T || gx > x * T + 12) continue;
      W(g, o, S, gx, gy, 3, 1, ph < 0.3 ? C.wHi : C.w2);
      if (hash(x, y, 402) < 0.3) W(g, o, S, gx + 6, gy + 3, 2, 1, C.wMoon);
    }
  }

  KK.kind('woodsfloor', {
    interactive: function () { return false; },
    floor: true,
    draw: function (g, e, d) {
      var room = roomOf(d);
      if (!room || !room.grid) return;
      var p = PAINT[room.id] || paintWoods;
      var c = roomPaint(room, p);
      var o = drawPaint(g, e, d, c);
      waterAnim(g, o, d.S, c, d.now);
    }
  });

  /* ── woods props ─────────────────────────────────────────────────── */
  function shadowOval(R, g, cx, cy, rx, ry, a) {
    g.globalAlpha = a || 0.45;
    blob(R, cx, cy, rx, ry, '#000000');
    g.globalAlpha = 1;
  }
  /* a canopy: overlapping blobs, dark underside, moonlit top-left */
  function canopy(R, g, cx, cy, rx, ry, seed, pal) {
    var i, n = 9;
    blob(R, cx, cy + 2, rx, ry, pal[0]);
    for (i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2 + hash(seed, i, 1);
      var bx = Math.round(cx + Math.cos(a) * rx * 0.62), by = Math.round(cy + Math.sin(a) * ry * 0.6);
      blob(R, bx, by, Math.round(rx * 0.42), Math.round(ry * 0.42), pal[1]);
    }
    for (i = 0; i < 6; i++) {
      var a2 = Math.PI * 1.05 + i / 6 * Math.PI * 0.9;
      blob(R, Math.round(cx + Math.cos(a2) * rx * 0.5), Math.round(cy + Math.sin(a2) * ry * 0.5), Math.round(rx * 0.3), Math.round(ry * 0.3), pal[2]);
    }
    for (i = 0; i < 14; i++) {
      var a3 = Math.PI * 1.1 + hash(seed, i, 2) * Math.PI * 0.8, rr = 0.75 + hash(seed, i, 3) * 0.2;
      R(Math.round(cx + Math.cos(a3) * rx * rr), Math.round(cy + Math.sin(a3) * ry * rr), 2, 1, pal[3]);
    }
    /* leaf texture specks */
    for (i = 0; i < 22; i++) {
      var sx = Math.round(cx + (hash(seed, i, 4) - 0.5) * rx * 1.6), sy = Math.round(cy + (hash(seed, i, 5) - 0.5) * ry * 1.5);
      R(sx, sy, 2, 1, i & 1 ? pal[0] : pal[2]);
    }
  }
  var OAK = ['#0C1A1C', '#14282A', '#1E3A38', '#4A7470'];
  var PINE = ['#08141A', '#0E2026', '#163236', '#3E6468'];

  var WPROP = {
    oak: function (e) {
      var sd = e.seed || (e.x * 7 + e.y * 13), big = e.big ? 1.3 : 1;
      var rx = Math.round((e.rx || 26) * big), ry = Math.round((e.ry || 20) * big), h = Math.round((e.h || 56) * big);
      return sprite('oak' + sd + (e.big ? 'b' : '') + h + rx, rx * 2 + 12, h + ry + 8, rx + 6, h + ry + 4, function (R, g) {
        shadowOval(R, g, 0, 0, 16 * big | 0, 4, 0.5);
        /* roots */
        R(-9, -3, 4, 3, C.bark); R(5, -3, 5, 3, C.bark); R(-12, -1, 4, 2, C.bark2); R(9, -1, 4, 2, C.bark2);
        /* trunk */
        R(-5, -h + 10, 10, h - 10, C.bark); R(-5, -h + 10, 2, h - 10, C.barkHi); R(3, -h + 10, 2, h - 10, '#120E14');
        for (var k = 0; k < 6; k++) R(-3 + ((hash(sd, k, 9) * 6) | 0), -h + 14 + k * 7, 1, 4, '#120E14');
        R(-2, -22, 4, 5, '#120E14'); R(-1, -21, 2, 3, '#060408');          /* a knot-hole */
        R(-12, -h + 16, 8, 3, C.bark); R(5, -h + 20, 9, 3, C.bark);       /* limbs */
        canopy(R, g, 0, -h, rx, ry, sd, OAK);
      });
    },
    pine: function (e) {
      var sd = e.seed || (e.x * 5 + e.y * 11), h = e.h || 64;
      return sprite('pine' + sd + h, 44, h + 8, 22, h + 4, function (R, g) {
        shadowOval(R, g, 0, 0, 12, 3, 0.5);
        R(-2, -12, 4, 12, C.bark); R(-2, -12, 1, 12, C.barkHi);
        var tiers = 5;
        for (var i = 0; i < tiers; i++) {
          var ty = -10 - i * (h - 14) / tiers, w = Math.round(18 - i * 3);
          for (var r = 0; r < 12; r++) {
            var ww = Math.round(w * (r + 2) / 13);
            R(-ww, Math.round(ty - 12 + r), ww * 2, 1, r < 3 ? PINE[2] : r < 8 ? PINE[1] : PINE[0]);
          }
          R(-w + 2, Math.round(ty - 1), 3, 1, PINE[0]); R(w - 5, Math.round(ty - 1), 3, 1, PINE[0]);
          for (var k = 0; k < 4; k++) R(-w + 3 + ((hash(sd, i * 4 + k, 3) * (w * 2 - 6)) | 0), Math.round(ty - 9 + k * 2), 2, 1, PINE[3]);
        }
        R(-1, -h + 2, 2, 4, PINE[2]);
      });
    },
    dead: function (e) {
      var sd = e.seed || (e.x * 3 + e.y * 17);
      return sprite('dead' + sd, 46, 66, 23, 62, function (R, g) {
        shadowOval(R, g, 0, 0, 10, 3, 0.45);
        var col = '#3A3440', hi = '#5A5262';
        R(-3, -40, 6, 40, col); R(-3, -40, 1, 40, hi);
        R(-4, -2, 2, 2, col); R(3, -2, 3, 2, col);
        function br(x, y, dx, dy, n) {
          for (var i = 0; i < n; i++) { R(Math.round(x), Math.round(y), 2, 2, col); x += dx; y += dy; }
          return [x, y];
        }
        var a = br(-2, -36, -1, -1, 12), b = br(2, -34, 1, -1.1, 13), c2 = br(0, -40, 0.2, -1, 14);
        br(a[0], a[1], -1, 0.3, 5); br(a[0] + 4, a[1] + 4, 0, -1, 5); br(b[0], b[1], 1, 0.2, 5); br(c2[0], c2[1], -0.8, -0.5, 5);
        R(-1, -30, 2, 2, '#120E14');
      });
    },
    stump: function (e) {
      return sprite('stump', 22, 16, 11, 13, function (R, g) {
        shadowOval(R, g, 0, 0, 9, 2, 0.45);
        R(-7, -9, 14, 9, C.bark); R(-7, -9, 2, 9, C.barkHi);
        blob(R, 0, -10, 7, 3, '#6A5444'); blob(R, 0, -10, 4, 1, '#4A3A30'); R(-1, -10, 2, 1, '#7E6650');
        R(-9, -2, 3, 2, C.bark); R(6, -2, 4, 2, C.bark);
        R(3, -5, 2, 2, '#C4705F'); R(3, -6, 3, 1, '#E89A88');                 /* a tiny toadstool */
      });
    },
    log: function (e) {
      return sprite('log', 44, 18, 22, 15, function (R, g) {
        shadowOval(R, g, 0, 0, 20, 3, 0.45);
        R(-18, -10, 36, 9, C.bark); R(-18, -10, 36, 2, C.barkHi); R(-18, -3, 36, 2, '#120E14');
        blob(R, 18, -6, 3, 4, '#6A5444'); blob(R, 18, -6, 1, 2, '#4A3A30');
        for (var i = 0; i < 6; i++) R(-15 + i * 5, -8 + (i & 1), 3, 1, '#120E14');
        R(-14, -11, 10, 2, C.m1); R(-12, -12, 5, 1, C.mHi); R(2, -11, 6, 1, C.m1);
        R(-6, -14, 2, 3, '#D8C8B0'); R(-7, -15, 4, 1, '#C4705F');            /* toadstools */
        R(-2, -13, 1, 2, '#D8C8B0'); R(-3, -14, 3, 1, '#C4705F');
      });
    },
    rock: function (e) {
      var sd = e.seed || (e.x + e.y * 5);
      return sprite('rock' + (sd % 3), 26, 20, 13, 17, function (R, g) {
        shadowOval(R, g, 0, 0, 10, 3, 0.5);
        blob(R, 0, -6, 10, 6, '#2E3440'); blob(R, -2, -8, 7, 4, '#3E4654'); blob(R, -3, -10, 4, 2, '#5A6474');
        R(-8, -11, 6, 2, C.m1); R(-6, -12, 3, 1, C.mHi); R(3, -4, 4, 1, '#1E222A');
      });
    },
    lantern: function (e) {
      return sprite('lantern', 16, 40, 8, 37, function (R, g) {
        shadowOval(R, g, 0, 0, 4, 1, 0.45);
        R(-1, -30, 2, 30, '#2A2228'); R(-1, -30, 1, 30, '#3E3436');
        R(-1, -31, 6, 2, '#2A2228'); R(3, -29, 1, 3, '#14100E');
        R(1, -26, 6, 1, '#14100E'); R(1, -25, 1, 6, '#14100E'); R(6, -25, 1, 6, '#14100E'); R(1, -19, 6, 1, '#14100E');
        R(2, -25, 4, 6, '#5A3A1A'); R(2, -27, 4, 1, '#3A2A1A');
      });
    },
    campfire: function (e) {
      return sprite('campfire', 30, 16, 15, 12, function (R, g) {
        blob(R, 0, -3, 11, 4, '#141010');
        blob(R, 0, -3, 7, 2, '#3A3436');                                       /* ash */
        R(-6, -5, 12, 2, '#2A1E1A'); R(-4, -6, 3, 4, '#2A1E1A'); R(2, -7, 2, 5, '#1E1612');
        for (var i = 0; i < 9; i++) {
          var a = i / 9 * Math.PI * 2, sx = Math.round(Math.cos(a) * 10), sy = Math.round(Math.sin(a) * 4) - 3;
          R(sx - 1, sy - 1, 3, 2, '#5A6070'); R(sx - 1, sy - 1, 2, 1, '#8A92A0');
        }
        R(-1, -4, 1, 1, '#8A2A10'); R(2, -3, 1, 1, '#6A1A08');
      });
    },
    shrooms: function (e) {
      return sprite('shrooms' + (e.seed || 0), 20, 14, 10, 12, function (R, g) {
        var pts = [[-6, 0, 3], [-2, -1, 4], [3, 0, 3], [6, -1, 2], [0, 1, 2]];
        for (var i = 0; i < pts.length; i++) {
          var p = pts[i], h = p[2] + 2;
          R(p[0], p[1] - h, 1, h, '#A8C8D0');
          R(p[0] - 1, p[1] - h - 1, 3, 1, '#4ABED8'); R(p[0] - 1, p[1] - h - 2, 3, 1, '#8AE8F8');
          if (p[2] > 2) R(p[0] - 2, p[1] - h - 1, 5, 1, '#2A8EB0');
        }
      });
    },
    menhir: function (e) {
      return sprite('menhir', 20, 36, 10, 33, function (R, g) {
        shadowOval(R, g, 0, 0, 8, 2, 0.5);
        R(-6, -28, 12, 28, '#2E3440'); R(-5, -30, 10, 2, '#2E3440'); R(-3, -31, 6, 1, '#3E4654');
        R(-6, -28, 2, 28, '#4A5262'); R(4, -28, 2, 28, '#1E222A');
        R(-6, -8, 12, 3, C.m1); R(-5, -9, 4, 1, C.mHi);
        /* the rune, cut in, faintly lilac */
        R(-1, -24, 2, 10, '#6A5A9A'); R(-3, -21, 6, 1, '#6A5A9A'); R(-3, -17, 2, 1, '#6A5A9A'); R(1, -15, 2, 1, '#6A5A9A');
      });
    },
    toro: function (e) {
      /* a stone lantern at the fork: somebody keeps it lit */
      return sprite('toro', 22, 34, 11, 31, function (R, g) {
        shadowOval(R, g, 0, 0, 8, 2, 0.5);
        R(-6, -4, 12, 4, '#3A3E4A'); R(-2, -14, 4, 10, '#3A3E4A'); R(-2, -14, 1, 10, '#5A6070');
        R(-6, -17, 12, 3, '#4A5060'); R(-5, -24, 10, 7, '#2A2E38'); R(-3, -22, 6, 4, '#5A3A1A');
        R(-8, -27, 16, 3, '#4A5060'); R(-6, -28, 12, 1, '#6A7280'); R(-1, -30, 2, 2, '#4A5060');
        R(-6, -4, 12, 1, C.m1);
      });
    },
    bush: function (e) {
      var sd = e.seed || (e.x * 3 + e.y);
      return sprite('bush' + (sd % 4), 30, 22, 15, 19, function (R, g) {
        shadowOval(R, g, 0, 0, 11, 2, 0.45);
        canopy(R, g, 0, -8, 11, 7, sd, OAK);
        if (sd & 1) { R(-4, -9, 1, 1, C.berry); R(3, -6, 1, 1, C.berry); R(5, -11, 1, 1, C.berry); }
      });
    },
    ferns: function (e) {
      var sd = e.seed || (e.x * 9 + e.y);
      return sprite('ferns' + (sd % 3), 22, 14, 11, 12, function (R) {
        stamp(R, FROND[sd % 3], { d: C.u1, m: C.u2, h: C.u3 }, -9, -7, false);
        stamp(R, FROND[(sd + 1) % 3], { d: C.u2, m: C.u3, h: C.uHi }, -2, -9, true);
      });
    }
  };
  /* what glows, and what moves */
  function propLight(e) {
    if (e.v === 'lantern') return { r: 46, col: '#FFC873', glow: 0.26, flicker: true };
    if (e.v === 'toro') return { r: 40, col: '#FFC873', glow: 0.24, flicker: true };
    if (e.v === 'shrooms') return { r: 22, col: '#6AD8F0', glow: 0.18 };
    if (e.v === 'moon') return { r: e.r || 56, col: '#9FB8FF', glow: 0.1, a: 0.85 };
    if (e.v === 'campfire') return { r: 12, col: '#E4602A', glow: 0.1 };
    return null;
  }
  function propLive(g, e, d) {
    var S = d.S, x = d.sx, y = d.sy, now = d.now;
    if (e.v === 'lantern') flame(g, x + 4 * S, y - 20 * S, S, 1, now, e.x);
    else if (e.v === 'toro') flame(g, x, y - 19 * S, S, 1, now, e.x + 2);
    else if (e.v === 'campfire' && !still()) {
      /* one thin wisp of smoke, still warm */
      for (var i = 0; i < 5; i++) {
        var k = ((now / 1400 + i / 5) % 1), wy = Math.round(-6 - k * 26), wx = Math.round(Math.sin(k * 6 + now / 900) * 3);
        g.globalAlpha = 0.35 * (1 - k);
        g.fillStyle = '#8A92A0'; g.fillRect(x + wx * S, y + wy * S, 2 * S, 2 * S);
      }
      g.globalAlpha = 1;
    } else if (e.v === 'shrooms' && !still()) {
      var p = 0.5 + 0.5 * Math.sin(now / 900 + e.x);
      g.globalAlpha = 0.25 + 0.35 * p;
      g.fillStyle = '#BFF6FF'; g.fillRect(x - 3 * S, y - 7 * S, S, S); g.fillRect(x + 3 * S, y - 6 * S, S, S);
      g.globalAlpha = 1;
    } else if (e.v === 'menhir' && !still()) {
      g.globalAlpha = 0.3 + 0.3 * Math.sin(now / 1300 + e.y);
      g.fillStyle = '#D9B8FF'; g.fillRect(x - S, y - 24 * S, 2 * S, 10 * S);
      g.globalAlpha = 1;
    }
  }
  KK.kind('woodsprop', {
    interactive: function () { return false; },
    draw: function (g, e, d) {
      var f = WPROP[e.v];
      if (f) blit(g, f(e), d, e.dx || 0, e.dy || 0);
      propLive(g, e, d);
    },
    width: function () { return 0; },          /* shadows are baked in */
    light: function (e) { return propLight(e); }
  });

  /* ── the fx layer: moonbeams + ground mist, above every sprite ───── */
  var fxCache = {};
  function fxFor(room) {
    var c = fxCache[room.id];
    if (c) return c;
    var cv = mkCanvas(room.w * T, room.h * T), g = cv.getContext && cv.getContext('2d');
    c = fxCache[room.id] = { cv: cv, mist: null };
    if (!g) return c;
    var R = function (x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); };
    var beams = room.beams || [];
    for (var i = 0; i < beams.length; i++) {
      var b = beams[i], bx = b[0] * T + 8, by = b[1] * T + 8, len = b[2] || 80, w = b[3] || 18;
      /* a slanted shaft from above the canopy down to its pool */
      for (var s = 0; s < len; s += 2) {
        var k = s / len, cx = Math.round(bx - (len - s) * 0.35);
        g.globalAlpha = 0.05 + 0.05 * k;
        R(cx - (w >> 1), by - (len - s), w, 2, '#CFE0FF');
        g.globalAlpha = 0.05 * k;
        R(cx - (w >> 2), by - (len - s), w >> 1, 2, '#FFFFFF');
      }
    }
    g.globalAlpha = 1;
    /* a mist strip: soft stepped puffs, 128px wider than the room so a
       slow drift can be a source-rect offset (nothing drawn outside) */
    var mw = room.w * T + 128, mc = mkCanvas(mw, 16), mg = mc.getContext && mc.getContext('2d');
    if (mg) {
      var MR = function (x, y, w, h, col) { mg.fillStyle = col; mg.fillRect(x, y, w, h); };
      for (var px = 0; px < mw; px += 22) {
        var rx = 14 + ((hash(px, 1, 9) * 16) | 0), ry = 3 + ((hash(px, 2, 9) * 3) | 0), cy = 8 + ((hash(px, 3, 9) * 4) | 0) - 2;
        mg.globalAlpha = 0.05; blob(MR, px, cy, rx, ry, '#BFD3FF');
        mg.globalAlpha = 0.05; blob(MR, px, cy, (rx * 0.6) | 0, Math.max(1, ry - 1), '#BFD3FF');
      }
      c.mist = mc;
    }
    return c;
  }
  KK.kind('woodsfx', {
    interactive: function () { return false; },
    draw: function (g, e, d) {
      var room = roomOf(d);
      if (!room || !room.grid) return;
      var c = fxFor(room), S = d.S;
      var ox = d.sx - (e.x + 0.5) * T * S, oy = d.sy - (e.y + 1) * T * S;
      var sm = g.imageSmoothingEnabled;
      g.imageSmoothingEnabled = false;
      g.drawImage(c.cv, ox, oy, c.cv.width * S, c.cv.height * S);
      if (c.mist && room.mist) {
        var rows = room.mist, rw = room.w * T;
        for (var i = 0; i < rows.length; i++) {
          var dir = i & 1 ? 1 : -1, drift = still() ? 0 : (d.now / 140 + i * 37) % 128;
          var sx0 = Math.round(dir > 0 ? drift : 128 - drift);
          g.drawImage(c.mist, sx0, 0, rw, 16, ox, oy + (rows[i] * T) * S, rw * S, 16 * S);
        }
      }
      g.imageSmoothingEnabled = sm;
    },
    width: function () { return 0; }
  });

  /* ── woods skins ─────────────────────────────────────────────────── */
  /* the a1 signpost: one board, the writing run; the fork's: two arms,
     the left freshly painted and pointing up the swept steps */
  skins.sign1 = {
    width: 0,
    draw: function (g, e, d) {
      blit(g, sprite('sign1', 24, 30, 12, 27, function (R, gg) {
        shadowOval(R, gg, 0, 0, 6, 2, 0.45);
        R(-1, -20, 3, 20, '#4A3424'); R(-1, -20, 1, 20, '#6A4A30');
        R(-10, -22, 20, 9, '#2B2014'); R(-9, -21, 18, 7, '#8A6A42'); R(-9, -21, 18, 1, '#A88A5A');
        R(-7, -19, 6, 1, '#3A2A1A'); R(0, -19, 5, 1, '#3A2A1A'); R(-6, -17, 9, 1, '#3A2A1A');
        R(-5, -16, 1, 3, '#3A2A1A'); R(2, -16, 1, 4, '#3A2A1A');            /* the run */
        R(-2, -4, 6, 2, C.m1);
      }), d);
    }
  };
  skins.signfork = {
    width: 0,
    draw: function (g, e, d) {
      blit(g, sprite('signfork', 34, 36, 17, 33, function (R, gg) {
        shadowOval(R, gg, 0, 0, 7, 2, 0.45);
        R(-1, -30, 3, 30, '#4A3424'); R(-1, -30, 1, 30, '#6A4A30');
        /* the left arm: up, to the castle, fresh paint */
        R(-15, -28, 14, 7, '#2B2014'); R(-14, -27, 12, 5, '#C8A86A'); R(-17, -26, 2, 3, '#2B2014'); R(-16, -25, 1, 1, '#C8A86A');
        R(-12, -25, 8, 1, '#5A3A1A');
        /* the right arm: the altar, weathered, hanging at an angle */
        R(2, -20, 13, 6, '#2B2014'); R(3, -19, 11, 4, '#6A5440'); R(15, -18, 2, 3, '#2B2014');
        R(4, -18, 3, 1, '#3A2A1A'); R(9, -17, 3, 1, '#3A2A1A');
        R(6, -15, 6, 1, '#1E1612');
        R(-3, -4, 7, 2, C.m1); R(1, -6, 1, 3, C.u3);
      }), d);
    }
  };
  /* the barkless tree in a2 — pale on one side, the side there is no north on */
  skins.barktree = {
    width: 0,
    draw: function (g, e, d) {
      blit(g, sprite('barktree', 40, 64, 20, 61, function (R, gg) {
        shadowOval(R, gg, 0, 0, 10, 3, 0.5);
        R(-4, -48, 8, 48, C.bark); R(-4, -48, 4, 48, '#B8B0A4'); R(-4, -48, 1, 48, '#D8D0C4');
        for (var k = 0; k < 7; k++) R(-3, -44 + k * 6, 3, 1, '#8A8278');
        R(-6, -2, 3, 2, C.bark); R(3, -2, 4, 2, C.bark);
        R(-12, -40, 8, 2, '#B8B0A4'); R(4, -36, 10, 2, C.bark);
        canopy(R, gg, 0, -50, 15, 10, 77, OAK);
      }), d);
    }
  };
})();
