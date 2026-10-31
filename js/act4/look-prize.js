/* look-prize.js — what zones G and H look like.
   ───────────────────────────────────────────────────────────────────
   rooms-g.js says where things are; this file says what they look like,
   the way summon.js dresses b8_arena. Three entity kinds the engine
   draws like any other:

     prizefloor   floor paint: ONE per room, `v` = the room's look id.
                  Paints the whole room (floors AND walls, in that
                  room's own materials) into an offscreen canvas at one
                  pixel per world unit, once, and blits it scaled every
                  frame. A cheap animated overlay (marquee bulbs, a
                  flickering tube, lightning in a doorway) goes on top.
     prizeprop    set dressing with a `v`: furniture, lamps, plants…
                  Each is a cached 1x sprite plus an optional small
                  animated part. Pressable only if it carries `lines`.
     prizenpc     the prize itself (and the vending machine, the pot):
                  pressing it is EXACTLY the engine's npc — same fire(),
                  same lines/run hooks, same resume-where-you-left-off —
                  only the drawing is bespoke.

   PERFORMANCE (the user reported lag): nothing static is drawn twice.
   Room paint and every prop sprite are rendered once into a canvas at
   1x and blitted with drawImage; per frame only a handful of fillRects
   animate. No gradients, no shadowBlur, no allocation in a draw.
   Reduced motion: every animation holds a still frame.

   Missing canvas (the jsdom harness): every painter is skipped and the
   engine's own baked room shows through, so nothing here can break a
   room — it can only make it plainer.                                 */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var KK = NEU.engineKinds;
  if (!KK) return;

  var T = 16;
  function LK() { return NEU.engineLook; }
  function still() { var l = LK(); return !l || !!l.reduced; }
  function save() { return NEU.save; }
  function flagged(k) { return !!(save() && save().flagged(k)); }
  function hsh(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  /* ── offscreen canvases, at 1px per world unit ─────────────────── */
  function mk(w, h) {
    if (typeof document === 'undefined' || !document.createElement) return null;
    var c = document.createElement('canvas');
    c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
    var g = c.getContext && c.getContext('2d');
    return g ? { c: c, g: g } : null;
  }
  /* A tiny pen over a 1x context: everything is integer rects. */
  function pen(g) {
    var P = {
      g: g,
      r: function (x, y, w, h, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); },
      px: function (x, y, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, 1); },
      /* 50% checker dither of c over a rect */
      dith: function (x, y, w, h, c, ph) {
        g.fillStyle = c;
        for (var j = 0; j < h; j++) for (var i = ((j + (ph || 0)) & 1); i < w; i += 2) g.fillRect(x + i, y + j, 1, 1);
      },
      /* sparse dither (1 in 4) */
      dith4: function (x, y, w, h, c, ph) {
        g.fillStyle = c;
        for (var j = 0; j < h; j++) for (var i = ((j & 1) * 2 + (ph || 0)) % 4; i < w; i += 4) g.fillRect(x + i, y + j, 1, 1);
      },
      a: function (k) { g.globalAlpha = k; },
      /* filled ellipse, row by row */
      oval: function (cx, cy, rx, ry, c) {
        g.fillStyle = c;
        for (var j = -ry; j <= ry; j++) {
          var k = 1 - (j * j) / ((ry + 0.5) * (ry + 0.5));
          if (k <= 0) continue;
          var hw = Math.round(rx * Math.sqrt(k));
          g.fillRect(cx - hw, cy + j, hw * 2 + 1, 1);
        }
      },
      ring: function (cx, cy, rx, ry, c) {
        var n = Math.round(Math.PI * 2 * Math.max(rx, ry)) + 4;
        g.fillStyle = c;
        for (var i = 0; i < n; i++) {
          var a = i / n * Math.PI * 2;
          g.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1);
        }
      },
      line: function (x0, y0, x1, y1, c) {
        var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
        g.fillStyle = c;
        for (var i = 0; i <= n; i++) {
          var k = n ? i / n : 0;
          g.fillRect(Math.round(x0 + (x1 - x0) * k), Math.round(y0 + (y1 - y0) * k), 1, 1);
        }
      },
      text: function (s, x, y, c) { glyphs(P, s, x, y, c); }
    };
    return P;
  }

  /* 3x5 pixel font: only what the rooms write */
  var FONT = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
    E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
    I: '111010010010111', K: '101101110101101', L: '100100100100111', M: '101111111101101',
    N: '110101101101101', O: '010101101101010', P: '110101110100100', R: '110101110101101',
    S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010',
    W: '101101111111101', Y: '101101010010010', Z: '111001010100111', X: '101101010101101',
    '1': '010110010010111', '2': '110001010100111', '4': '101101111001001', '0': '010101101101010',
    '6': '011100110101010', '-': '000000111000000', '!': '010010010000010', '.': '000000000000010',
    '–': '000000111000000', '?': '110001010000010', ':': '000010000010000', '/': '001001010100100'
  };
  function glyphs(P, s, x, y, c) {
    for (var k = 0; k < s.length; k++) {
      var gl = FONT[s.charAt(k)];
      if (!gl) continue;
      for (var i = 0; i < 15; i++) if (gl.charAt(i) === '1') P.px(x + k * 4 + (i % 3), y + ((i / 3) | 0), c);
    }
  }
  function textW(s) { return s.length * 4 - 1; }

  /* ── sprite cache ─────────────────────────────────────────────────
     key -> { c: canvas, ax, ay } where (ax, ay) is the anchor (feet,
     the bottom-centre of the entity's cell) inside the sprite. */
  var SPR = {};
  function sprite(key, w, h, ax, ay, paint) {
    var s = SPR[key];
    if (s !== undefined) return s;
    var m = mk(w, h);
    if (!m) { SPR[key] = null; return null; }
    m.g.imageSmoothingEnabled = false;
    paint(pen(m.g), w, h);
    s = SPR[key] = { c: m.c, ax: ax, ay: ay, w: w, h: h };
    return s;
  }
  function blit(g, s, sx, sy, S) {
    if (!s) return;
    g.drawImage(s.c, sx - s.ax * S, sy - s.ay * S, s.w * S, s.h * S);
  }
  /* screen position of world (0,0), from an entity's draw context */
  function origin(e, d) {
    return { x: d.sx - (e.x + 0.5) * T * d.S, y: d.sy - (e.y + 1) * T * d.S };
  }
  /* a world-px rect in screen space, for the animated overlays */
  function W(g, o, S, x, y, w, h, c) {
    g.fillStyle = c;
    g.fillRect(o.x + Math.round(x) * S, o.y + Math.round(y) * S, (w || 1) * S, (h || 1) * S);
  }

  /* ── shared materials ─────────────────────────────────────────── */
  function solidIn(room, x, y, set) {
    if (x < 0 || y < 0 || y >= room.h) return true;
    var r = room.grid[y];
    if (x >= r.length) return true;
    return set.indexOf(r.charAt(x)) >= 0;
  }
  function cellAt(room, x, y) {
    if (x < 0 || y < 0 || y >= room.h) return '#';
    var r = room.grid[y];
    return x >= r.length ? '#' : r.charAt(x);
  }
  /* Walk every cell, telling the painter what it is:
       'floor'  open ground
       'face'   a wall cell whose cell below is open (n rows tall: 1 or 2)
       'cap'    a wall cell seen from above
     `wallset` is which chars count as wall (furniture chars 'o' are
     floor underneath: the prop stands on them). */
  function cells(room, wallset, fn) {
    for (var y = 0; y < room.h; y++) for (var x = 0; x < room.w; x++) {
      var w = solidIn(room, x, y, wallset);
      if (!w) { fn('floor', x, y, 0); continue; }
      var below = solidIn(room, x, y + 1, wallset), below2 = solidIn(room, x, y + 2, wallset);
      if (!below) fn('face', x, y, 1);
      else if (!below2 && y + 1 < room.h) fn('face', x, y, 2);
      else fn('cap', x, y, 0);
    }
  }

  /* registries filled per room below */
  var PAINT = {};     /* v -> function (P, room, st, e) : the static room */
  var STATE = {};     /* v -> function (e) : a key; a change repaints */
  var POST = {};      /* v -> function (g, w, h, st) : once, after PAINT */
  var ANIM = {};      /* v -> function (g, o, S, now, room, e) : per frame,
                         skipped entirely under reduced motion */
  var PROP = {};      /* v -> { w, h, ax, ay, paint(P), anim(g, x, y, S, now, e), light(e), solid } */
  var NPCART = {};    /* v -> same shape as PROP, for prizenpc */

  var roomCache = {};
  function roomCanvas(e, room) {
    var v = e.v, st = STATE[v] ? STATE[v](e) : '';
    var c = roomCache[v];
    if (c !== undefined && c && c.st === st && c.room === room) return c;
    if (c === null) return null;
    var m = mk(room.w * T, room.h * T);
    if (!m) { roomCache[v] = null; return null; }
    m.g.imageSmoothingEnabled = false;
    PAINT[v](pen(m.g), room, st, e);
    if (POST[v]) POST[v](m.g, m.c.width, m.c.height, st);
    c = roomCache[v] = { c: m.c, st: st, room: room };
    return c;
  }

  KK.kind('prizefloor', {
    interactive: function () { return false; },
    floor: true,
    draw: function (g, e, d) {
      if (!PAINT[e.v] || !d.room || !d.room.grid) return;
      var o = origin(e, d), S = d.S;
      var rc = roomCanvas(e, d.room);
      if (rc) g.drawImage(rc.c, o.x, o.y, rc.c.width * S, rc.c.height * S);
      if (ANIM[e.v] && !still()) ANIM[e.v](g, o, S, d.now, d.room, e);
    }
  });

  function propSprite(tab, e) {
    var def = tab[e.v];
    if (!def) return null;
    var key = e.v + (def.key ? '|' + def.key(e) : '');
    return sprite(key, def.w, def.h, def.ax, def.ay, function (P, w, h) {
      def.paint(P, e);
      if (def.post) def.post(P.g, w, h, e);
    });
  }
  function drawFrom(tab, g, e, d) {
    var def = tab[e.v];
    if (!def) return false;
    if (def.hide && def.hide(e)) return true;
    var s = propSprite(tab, e);
    if (s) blit(g, s, d.sx, d.sy, d.S);
    if (def.anim) def.anim(g, d.sx, d.sy, d.S, d.now, e);
    return true;
  }

  KK.kind('prizeprop', {
    interactive: function (e) { return !!e.lines; },
    fire: function (e, sys) {
      if (!e.lines) return;
      if (NEU.tboxOpen && NEU.tboxOpen()) return;
      sys.say(e.lines, e.who || 'narr');
      if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick();
    },
    draw: function (g, e, d) {
      if (!drawFrom(PROP, g, e, d)) { g.fillStyle = '#FF00A0'; g.fillRect(d.sx - 4 * d.S, d.sy - 8 * d.S, 8 * d.S, 8 * d.S); }
    },
    width: function (e) { var p = PROP[e.v]; return p && p.shadow !== undefined ? p.shadow : 0; },
    light: function (e) { var p = PROP[e.v]; return p && p.light ? p.light(e) : null; }
  });

  var NPC = KK.all.npc;
  KK.kind('prizenpc', {
    interactive: function () { return true; },
    /* the engine's own npc: run hooks, lines, resume — untouched */
    fire: function (e, sys) { NPC.fire(e, sys); },
    draw: function (g, e, d) { if (!drawFrom(NPCART, g, e, d)) NPC.draw(g, e, d); },
    width: function (e) { var p = NPCART[e.v]; return p && p.shadow !== undefined ? p.shadow : 10; },
    light: function (e, d) {
      var p = NPCART[e.v];
      if (p && p.light) return p.light(e, d);
      return NPC.light ? NPC.light(e, d) : null;
    }
  });

  /* ── tiny shared helpers for props ─────────────────────────────── */
  var K = '#0A070E';       /* outline */

  /* ══ ART ═══════════════════════════════════════════════════════ */
  /* colour helpers for the painters (1x, cached, so cost is irrelevant) */
  function hx(c) { return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; }
  function mixc(a, b, k) {
    var A = hx(a), B = hx(b), out = '#';
    for (var i = 0; i < 3; i++) {
      var v = Math.max(0, Math.min(255, Math.round(A[i] + (B[i] - A[i]) * k))).toString(16);
      out += v.length < 2 ? '0' + v : v;
    }
    return out;
  }

  /* ── reusable furniture, painted at 1x into a sprite ───────────── */
  /* a potted plant: big soft leaves, terracotta-black pot */
  function paintPlant(P, x, y, leaf, leafHi, pot) {
    /* x,y = pot base centre */
    P.r(x - 5, y - 9, 10, 9, K); P.r(x - 4, y - 8, 8, 7, pot); P.r(x - 4, y - 8, 8, 1, mixc(pot, '#FFFFFF', 0.25));
    P.r(x - 5, y - 10, 10, 2, mixc(pot, '#000000', 0.3));
    var L = [[-7, -22, 6, 10], [1, -24, 6, 12], [-3, -28, 6, 12], [-9, -16, 6, 6], [4, -17, 6, 6]];
    for (var i = 0; i < L.length; i++) {
      var l = L[i];
      P.oval(x + l[0] + 3, y + l[1] + l[3] / 2, l[2] / 2 + 1, l[3] / 2 + 1, K);
    }
    for (i = 0; i < L.length; i++) {
      l = L[i];
      P.oval(x + l[0] + 3, y + l[1] + l[3] / 2, l[2] / 2, l[3] / 2, leaf);
      P.r(x + l[0] + 2, y + l[1] + 2, 1, l[3] - 4, leafHi);
    }
    P.r(x - 1, y - 14, 2, 4, mixc(leaf, '#000000', 0.4));
  }
  /* a hanging bulb on a cord, painted into a wall */
  function bulbOn(P, x, y, c) { P.r(x - 1, y - 1, 3, 3, K); P.r(x, y, 1, 1, c); }

  /* a star, 7px */
  function star(P, cx, cy, c, hi) {
    P.r(cx, cy - 3, 1, 7, c); P.r(cx - 3, cy, 7, 1, c);
    P.r(cx - 1, cy - 1, 3, 3, c); P.r(cx - 2, cy - 2, 1, 1, c); P.r(cx + 2, cy - 2, 1, 1, c);
    P.r(cx - 2, cy + 2, 1, 1, c); P.r(cx + 2, cy + 2, 1, 1, c);
    if (hi) P.r(cx, cy - 1, 1, 1, hi);
  }

  /* ══ G0 — the prize corridor ════════════════════════════════════
     A game show's backstage hall: plum damask wall, a red walk-of-fame
     carpet, nine prosceniums in the north wall. An EARNED door's arch
     is lit in its rank's colour, a spotlight pools on the threshold and
     its star on the carpet is gold; an unearned one is dark, roped off
     and grey. The south edge is the stage lip, footlights, and the
     audience — mostly the backs of heads, a few turned round to watch
     you not get in. */
  function doorOpen(dr) { return flagged(dr.lock); }
  STATE.g0 = function (e) {
    var s = '';
    for (var i = 0; i < e.doors.length; i++) s += doorOpen(e.doors[i]) ? '1' : '0';
    return s;
  };
  /* bulb positions round one proscenium, relative to its centre x and
     the wall top: computed once, read every frame */
  var ARCH = (function () {
    var out = [], i;
    for (i = -12; i <= 12; i += 4) out.push([i, 10]);
    for (i = 15; i <= 43; i += 5) { out.push([-12, i]); out.push([12, i]); }
    return out;
  })();

  PAINT.g0 = function (P, room, st, e) {
    var Wd = room.w * T, i, x, y;
    /* floor: dark stage boards, 8px courses, staggered seams */
    for (y = 3 * T; y < 8 * T; y += 8) {
      var row = (y / 8) | 0;
      P.r(0, y, Wd, 8, row & 1 ? '#25161F' : '#2A1923');
      P.r(0, y, Wd, 1, '#34212C');
      P.r(0, y + 7, Wd, 1, '#170D14');
      for (x = (row * 37) % 40; x < Wd; x += 40 + ((hsh(row * 7 + x) * 24) | 0)) P.r(x, y + 1, 1, 6, '#170D14');
      for (x = 0; x < Wd; x += 13) if (hsh(x + row * 91) > 0.82) P.r(x, y + 3, 3, 1, '#311E29');
    }
    /* the threshold: a marble strip under the doors */
    P.r(0, 3 * T, Wd, 12, '#2E2638');
    for (x = 0; x < Wd; x += 16) { P.r(x, 3 * T, 1, 12, '#221C2C'); P.line(x + 3, 3 * T + 2, x + 9, 3 * T + 9, '#3A3248'); }
    P.r(0, 3 * T + 12, Wd, 1, '#1A1220');
    P.a(0.7); P.r(0, 3 * T, Wd, 3, '#0E0812'); P.a(1);
    /* the carpet: red pile, gold edging, a diamond every 8px */
    var cy0 = 5 * T + 2, cy1 = 7 * T - 2;
    P.r(T, cy0, Wd - 2 * T, cy1 - cy0, '#6A1226');
    P.dith4(T, cy0 + 3, Wd - 2 * T, cy1 - cy0 - 6, '#7A1A2E');
    for (x = T + 6; x < Wd - T - 4; x += 12) { P.px(x, (cy0 + cy1) / 2 - 1, '#82203A'); P.r(x - 1, (cy0 + cy1) / 2, 3, 1, '#82203A'); P.px(x, (cy0 + cy1) / 2 + 1, '#82203A'); }
    for (x = T + 12; x < Wd - T - 4; x += 12) { P.px(x, cy0 + 5, '#7A1A30'); P.px(x, cy1 - 6, '#7A1A30'); }
    P.r(T, cy0, Wd - 2 * T, 2, '#9A7A2E'); P.r(T, cy0, Wd - 2 * T, 1, '#E4C46A');
    P.r(T, cy1 - 2, Wd - 2 * T, 2, '#9A7A2E'); P.r(T, cy1 - 1, Wd - 2 * T, 1, '#5A4420');
    P.r(T, cy1, Wd - 2 * T, 2, '#140A10');
    /* fringe at the carpet's west end */
    for (y = cy0; y < cy1; y += 2) P.r(T - 2, y, 2, 1, '#C8A04A');
    /* north wall: cap, cornice, damask velvet, dado */
    P.r(0, 0, Wd, 3 * T, '#2A0F32');
    P.r(0, 0, Wd, 5, '#0B060E');
    P.r(0, 5, Wd, 1, '#5A4420'); P.r(0, 6, Wd, 2, '#9A7A2E'); P.r(0, 6, Wd, 1, '#E4C46A'); P.r(0, 8, Wd, 1, '#3A2A10');
    P.r(0, 9, Wd, 4, '#1E0A24');
    for (y = 14; y < 42; y += 12) for (x = ((y / 12) & 1) * 6; x < Wd; x += 12) {
      P.px(x, y, '#3C1846'); P.r(x - 1, y + 1, 3, 1, '#3C1846'); P.r(x - 2, y + 2, 5, 1, '#36143F');
      P.r(x - 1, y + 3, 3, 1, '#3C1846'); P.px(x, y + 4, '#3C1846'); P.px(x, y + 2, '#5A2A62');
    }
    P.r(0, 41, Wd, 1, '#9A7A2E'); P.r(0, 42, Wd, 6, '#170A14'); P.r(0, 42, Wd, 1, '#2C1A20');
    /* the doors */
    for (i = 0; i < e.doors.length; i++) proscenium(P, e.doors[i], st.charAt(i) === '1');
    /* wall sconces in the gaps, and a gold star over each gap */
    for (i = 0; i + 1 < e.doors.length; i++) {
      x = e.doors[i].x * T + 8 + 24;
      P.a(0.1); P.oval(x, 18, 7, 9, '#FFB347'); P.a(0.12); P.oval(x, 17, 4, 5, '#FFD890'); P.a(1);
      P.r(x - 3, 30, 7, 2, K); P.r(x - 2, 30, 5, 1, '#C8A04A');      /* wall plate */
      P.r(x, 26, 1, 4, '#9A7A2E');                                   /* arm */
      P.r(x - 3, 25, 7, 2, K); P.r(x - 2, 25, 5, 1, '#E4C46A');      /* drip tray */
      P.r(x - 1, 20, 3, 5, '#E8DCC8'); P.r(x - 1, 20, 1, 5, '#FFFFFF'); /* candle */
      P.r(x - 1, 16, 2, 3, '#FFB347'); P.r(x, 15, 1, 2, '#FFE6A0');
    }
    /* dressing-room mirror at the far east end */
    var mx = 29 * T + 1;
    P.r(mx, 13, 26, 26, K); P.r(mx + 1, 14, 24, 24, '#9A7A2E'); P.r(mx + 3, 16, 20, 20, '#2A3446');
    P.r(mx + 5, 18, 6, 1, '#6A7A96'); P.r(mx + 5, 19, 3, 1, '#6A7A96'); P.line(mx + 14, 34, mx + 21, 27, '#3A465A');
    for (i = 0; i < 5; i++) { bulbOn(P, mx + 3 + i * 5, 15, '#FFF2C4'); bulbOn(P, mx + 3 + i * 5, 37, '#FFF2C4'); }
    P.text('STAR', mx + 6, 24, '#E4C46A');
    /* side walls: stage wings, heavy curtain folds */
    wing(P, 0, 0, 8 * T); wing(P, Wd - T, 0, 8 * T);
    /* the stage lip and footlights */
    var ly = 8 * T;
    P.r(0, ly - 3, Wd, 3, '#3A2418'); P.r(0, ly - 3, Wd, 1, '#5A3A26');
    for (x = 24; x < Wd - 16; x += 32) {
      P.a(0.2); P.r(x - 8, ly - 12, 18, 9, '#FFB347'); P.r(x - 4, ly - 16, 10, 4, '#FFB347'); P.a(1);
      P.r(x - 3, ly - 4, 8, 3, K); P.r(x - 2, ly - 4, 6, 1, '#FFE6A0'); P.r(x - 2, ly - 3, 6, 1, '#C8A04A');
    }
    /* the pit: brass rail, then the audience in three rows */
    P.r(0, ly, Wd, room.h * T - ly, '#07040A');
    P.r(0, ly, Wd, 2, '#C8A04A'); P.r(0, ly + 2, Wd, 1, '#5A4420'); P.r(0, ly + 3, Wd, 3, '#030205');
    var HAIR = ['#2A1E34', '#3A2A1E', '#1E1A2A', '#4A3A52', '#2E2420'];
    for (var rw = 2; rw >= 0; rw--) {
      var sy = ly + 13 + rw * 13, off = rw & 1 ? 7 : 0;
      for (x = 2 + off; x < Wd - 4; x += 14) {
        var who = hsh(x * 3 + rw * 101);
        if (who > 0.3) {
          /* a head; about one in eight has turned round to look at you */
          var turned = who > 0.93, hair = HAIR[((who * 50) | 0) % HAIR.length];
          P.oval(x + 5, sy - 3, 4, 4, K);
          P.oval(x + 5, sy - 3, 3, 3, turned ? '#C8B4A8' : hair);
          if (turned) {
            P.r(x + 2, sy - 7, 7, 2, hair); P.px(x + 2, sy - 5, hair); P.px(x + 8, sy - 5, hair);
            P.px(x + 4, sy - 3, '#1A1020'); P.px(x + 6, sy - 3, '#1A1020'); P.r(x + 4, sy - 1, 3, 1, '#8A5A5A');
          } else { P.r(x + 3, sy - 6, 3, 1, mixc(hair, '#FFFFFF', 0.2)); }
        }
        /* the seat back, rounded */
        P.r(x + 1, sy, 9, 9, K); P.r(x, sy + 1, 11, 8, K);
        P.r(x + 2, sy + 1, 7, 7, '#4A1222'); P.r(x + 1, sy + 2, 9, 6, '#4A1222');
        P.r(x + 2, sy + 1, 7, 1, '#6A2232'); P.r(x + 2, sy + 4, 7, 1, '#3A0C1A');
      }
      /* each row further back is darker */
      if (rw) { P.a(0.18 * rw); P.r(0, sy - 8, Wd, 18, '#07040A'); P.a(1); }
    }
  };

  function wing(P, x, y, h) {
    P.r(x, y, T, h, '#3A0A18');
    for (var i = 0; i < T; i += 4) {
      P.r(x + i, y, 2, h, '#4E1222'); P.r(x + i + 1, y, 1, h, '#62182C'); P.r(x + i + 3, y, 1, h, '#22060E');
    }
    P.r(x, y, T, 4, '#0B060E');
    for (i = 0; i < T; i += 3) P.r(x + i, y + h - 3, 2, 3, '#C8A04A');
  }

  function proscenium(P, dr, open) {
    var cx = dr.x * T + 8, tint = dr.tint;
    var base = open ? mixc(tint, '#2A1A30', 0.45) : mixc(tint, '#1A1420', 0.78);
    var hi = open ? mixc(tint, '#FFFFFF', 0.25) : mixc(tint, '#1A1420', 0.6);
    var lo = open ? mixc(tint, '#0A060C', 0.6) : '#120E16';
    /* spotlight pool on the threshold and boards in front */
    if (open) {
      P.a(0.13); for (var k = 0; k < 4; k++) P.r(cx - 10 - k * 3, 3 * T + k * 6, 21 + k * 6, 6, tint);
      P.a(0.2); P.r(cx - 8, 3 * T, 17, 12, '#FFF2C4'); P.a(1);
    }
    /* its star on the walk of fame */
    P.oval(cx, 5 * T + 16, 5, 4, open ? '#8A2236' : '#5A1022');
    star(P, cx, 5 * T + 16, open ? '#E4C46A' : '#3A2430', open ? '#FFF2C4' : null);
    /* columns and arch */
    P.r(cx - 15, 8, 31, 40, K);
    P.r(cx - 14, 9, 29, 6, base); P.r(cx - 14, 9, 29, 1, hi);
    P.r(cx - 14, 15, 5, 33, base); P.r(cx + 10, 15, 5, 33, base);
    P.r(cx - 14, 15, 1, 33, hi); P.r(cx + 14, 15, 1, 33, lo); P.r(cx - 10, 15, 1, 33, lo); P.r(cx + 10, 15, 1, 33, hi);
    P.r(cx - 15, 45, 7, 3, lo); P.r(cx + 9, 45, 7, 3, lo);
    /* keystone */
    P.r(cx - 3, 6, 7, 6, K); P.r(cx - 2, 7, 5, 4, open ? tint : base); P.px(cx, 8, open ? '#FFFFFF' : hi);
    /* the recess: lit warm inside if earned, cold black if not */
    P.r(cx - 9, 15, 19, 33, open ? '#2A1A14' : '#07050A');
    if (open) { P.a(0.35); P.r(cx - 7, 17, 15, 31, tint); P.a(1); P.r(cx - 9, 15, 19, 2, '#140C0A'); }
    else { P.dith4(cx - 9, 15, 19, 33, '#120E18'); }
    /* bulbs: lit in rank colour, or dead grey */
    for (var i = 0; i < ARCH.length; i++) {
      var b = ARCH[i];
      if (open) bulbOn(P, cx + b[0], b[1], mixc(tint, '#FFFFFF', 0.45));
      else bulbOn(P, cx + b[0], b[1], '#2A2432');
    }
  }

  ANIM.g0 = function (g, o, S, now, room, e) {
    /* chase lights round every earned arch: one bulb in three bright,
       stepping every 300 ms (each bulb toggles ~1 Hz, well under 3) */
    var step = (now / 300) | 0, i, j;
    for (i = 0; i < e.doors.length; i++) {
      var dr = e.doors[i];
      if (!doorOpen(dr)) continue;
      var cx = dr.x * T + 8;
      for (j = 0; j < ARCH.length; j++) if ((j + step) % 3 === 0) W(g, o, S, cx + ARCH[j][0], ARCH[j][1], 1, 1, '#FFFFFF');
    }
    /* sconce flames */
    for (i = 0; i + 1 < e.doors.length; i++) {
      var x = e.doors[i].x * T + 8 + 24, f = ((now / 140 + i * 3) | 0) % 4;
      if (f === 1) W(g, o, S, x, 14, 1, 1, '#FFB347');
      else if (f === 3) W(g, o, S, x - 1, 15, 1, 1, '#FFE6A0');
    }
    /* the audience blinks */
    var ly = 8 * T;
    for (var rw = 0; rw < 3; rw++) {
      var sy = ly + 13 + rw * 13, off = rw & 1 ? 7 : 0;
      for (x = 2 + off; x < room.w * T - 4; x += 14) {
        var who = hsh(x * 3 + rw * 101);
        if (who <= 0.93) continue;
        if (((now + who * 9000) % 4200) < 150) W(g, o, S, x + 4, sy - 3, 3, 1, '#C8B4A8');
      }
    }
  };

  /* the velvet rope across a door you did not earn; drawn after the
     door itself (same cell, later in the list) so it sits in front */
  PROP.rope = {
    w: 22, h: 20, ax: 11, ay: 18, shadow: 0,
    hide: function (e) { return flagged(e.lock); },
    key: function (e) { return e.rank || ''; },
    paint: function (P, e) {
      /* posts */
      for (var s = 0; s < 2; s++) {
        var x = s ? 18 : 2;
        P.r(x - 1, 6, 4, 13, K); P.r(x, 7, 2, 11, '#C8A04A'); P.r(x, 7, 1, 11, '#FFE6A0');
        P.r(x - 1, 4, 4, 3, K); P.r(x, 4, 2, 2, '#FFE6A0');
        P.r(x - 2, 17, 6, 2, K); P.r(x - 1, 17, 4, 1, '#9A7A2E');
      }
      /* the rope, sagging */
      var sag = [0, 1, 1, 2, 2, 3, 3, 3, 3, 3, 3, 2, 2, 1, 1, 0];
      for (var i = 0; i < 16; i++) { P.r(3 + i, 7 + sag[i], 1, 3, K); P.r(3 + i, 8 + sag[i], 1, 1, '#B0203A'); }
      /* the tag */
      P.r(5, 12, 13, 7, K); P.r(6, 13, 11, 5, '#E8DCC8'); P.text('NO', 8, 13, '#8A1A2A');
    }
  };

  /* the host's podium: a small lectern on the stage edge */
  PROP.podium = {
    w: 20, h: 26, ax: 10, ay: 24, shadow: 14,
    paint: function (P) {
      P.r(2, 4, 16, 20, K); P.r(3, 5, 14, 3, '#C8A04A'); P.r(3, 5, 14, 1, '#FFE6A0');
      P.r(4, 8, 12, 15, '#4A1430'); P.r(4, 8, 2, 15, '#6A2244'); P.r(14, 8, 2, 15, '#2E0A1E');
      star(P, 10, 14, '#E4C46A', '#FFF2C4');
      P.r(2, 22, 16, 2, '#9A7A2E');
      /* the microphone */
      P.r(12, 0, 2, 5, K); P.r(12, 0, 2, 2, '#8A8598'); P.r(13, 2, 1, 3, '#3A3448');
    }
  };

  /* a tall potted palm (the stage kind, in a gold pot) */
  PROP.palm = {
    w: 30, h: 36, ax: 15, ay: 34, shadow: 10,
    paint: function (P) { paintPlant(P, 15, 34, '#2E5A44', '#4E8A62', '#8A6A2E'); }
  };

  /* ══ G_N — the prize rooms ══════════════════════════════════════
     Every prize room has the same bones — a two-row north wall seen
     face-on, side walls seen from above, a south wall with the curtain
     back to the corridor in its middle — and its own skin: floor,
     wallpaper, light. `shell` paints the bones from a material table. */
  function shell(P, room, M) {
    var Wd = room.w * T, Hd = room.h * T, x, y;
    /* floor: the whole interior, furniture cells included */
    M.floor(P, T, 2 * T, Wd - 2 * T, Hd - 3 * T);
    /* the north wall, face-on: 3px cap, then the wall's own paper */
    P.r(0, 0, Wd, 2 * T, M.cap);
    M.wall(P, T, 3, Wd - 2 * T, 2 * T - 3);
    P.r(T, 3, Wd - 2 * T, 1, M.rim);
    /* skirting */
    P.r(T, 2 * T - 3, Wd - 2 * T, 3, M.skirt || '#140E14'); P.r(T, 2 * T - 3, Wd - 2 * T, 1, M.skirtHi || '#2A2028');
    /* contact shadow on the floor under it */
    P.a(0.45); P.r(T, 2 * T, Wd - 2 * T, 3, '#000000'); P.a(0.2); P.r(T, 2 * T + 3, Wd - 2 * T, 3, '#000000'); P.a(1);
    /* side walls from above */
    for (var s = 0; s < 2; s++) {
      x = s ? Wd - T : 0;
      P.r(x, 0, T, Hd, M.cap);
      P.r(s ? x : x + T - 1, 2 * T, 1, Hd - 3 * T, M.rim);
      P.a(0.3); P.r(s ? x - 2 : x + T, 2 * T, 2, Hd - 3 * T, '#000000'); P.a(1);
    }
    /* the south wall from above, its lip, and the doorway back */
    y = Hd - T;
    P.r(0, y, Wd, T, M.cap); P.r(T, y, Wd - 2 * T, 1, M.rim);
    var mx = ((room.w - 1) / 2) * T;
    P.r(mx - 2, y, T + 4, T, '#050307'); P.r(mx, y, T, T, M.door || '#3A0E1C');
    for (x = 0; x < T; x += 3) P.r(mx + x, y, 1, T, mixc(M.door || '#3A0E1C', '#000000', 0.35));
    P.r(mx - 2, y, 2, T, M.rim); P.r(mx + T, y, 2, T, M.rim);
    /* a warm wash on the floor at the door */
    P.a(0.12); P.r(mx - 6, y - 10, T + 12, 10, M.wash || '#FFE6A0'); P.a(1);
    if (M.after) M.after(P, room);
  }
  function stageLight(P, cx, y0, y1, w0, w1, c, a) {
    /* a stepped cone of light, top width w0 to bottom width w1 */
    P.a(a || 0.1);
    for (var y = y0; y < y1; y += 2) {
      var k = (y - y0) / Math.max(1, y1 - y0), hw = Math.round((w0 + (w1 - w0) * k) / 2);
      P.r(cx - hw, y, hw * 2, 2, c);
    }
    P.a(1);
  }
  function pool(P, cx, cy, rx, ry, c, a) {
    P.a(a || 0.14); P.oval(cx, cy, rx, ry, c); P.a((a || 0.14) * 0.9); P.oval(cx, cy, Math.round(rx * 0.6), Math.round(ry * 0.6), c); P.a(1);
  }
  /* floors */
  function fLino(P, x, y, w, h, a, b) {
    P.r(x, y, w, h, a);
    for (var j = 0; j < h; j += 8) for (var i = 0; i < w; i += 8) if (((i + j) / 8) & 1) P.r(x + i, y + j, 8, 8, b);
    for (j = 0; j < h; j += 8) P.r(x, y + j, w, 1, mixc(a, '#000000', 0.2));
    for (i = 0; i < 9; i++) P.r(x + ((hsh(i * 7) * (w - 6)) | 0), y + ((hsh(i * 13) * (h - 2)) | 0), 4 + (i % 3), 1, mixc(a, '#000000', 0.3));
  }
  function fParquet(P, x, y, w, h, a, b) {
    P.r(x, y, w, h, a);
    for (var j = 0; j < h; j += 4) for (var i = ((j / 4) & 1) * 6; i < w; i += 12) {
      P.r(x + i, y + j, 6, 4, b); P.r(x + i, y + j + 3, 6, 1, mixc(b, '#000000', 0.25));
    }
    for (j = 0; j < h; j += 4) P.r(x, y + j + 3, w, 1, mixc(a, '#000000', 0.25));
  }
  function fBoards(P, x, y, w, h, a, b) {
    for (var j = 0; j < h; j += 6) {
      P.r(x, y + j, w, 6, ((j / 6) & 1) ? a : b); P.r(x, y + j + 5, w, 1, mixc(a, '#000000', 0.35));
      for (var i = ((j * 7) % 29); i < w; i += 29 + ((j * 3) % 11)) P.r(x + i, y + j, 1, 5, mixc(a, '#000000', 0.35));
      if (hsh(j) > 0.5) P.r(x + ((hsh(j + 3) * w) | 0), y + j + 2, 2, 1, mixc(a, '#000000', 0.4));
    }
  }
  function fTiles(P, x, y, w, h, a, b, line) {
    for (var j = 0; j < h; j += 8) for (var i = 0; i < w; i += 8) {
      P.r(x + i, y + j, 8, 8, (((i + j) / 8) & 1) ? b : a);
      P.r(x + i, y + j, 8, 1, line); P.r(x + i, y + j, 1, 8, line);
    }
  }
  function fMarble(P, x, y, w, h, a, b, vein) {
    for (var j = 0; j < h; j += 16) for (var i = 0; i < w; i += 16) {
      var k = ((i + j) / 16) & 1;
      P.r(x + i, y + j, 16, 16, k ? b : a);
      P.r(x + i, y + j, 16, 1, mixc(a, '#FFFFFF', 0.15)); P.r(x + i, y + j, 1, 16, mixc(a, '#000000', 0.2));
      var s = hsh(i * 3 + j * 7);
      P.line(x + i + 2 + ((s * 6) | 0), y + j + 3, x + i + 10 + ((s * 4) | 0), y + j + 12, vein);
      if (s > 0.6) P.line(x + i + 9, y + j + 2, x + i + 13, y + j + 6, vein);
    }
  }
  function rug(P, x, y, w, h, base, border, pat) {
    P.r(x - 1, y - 1, w + 2, h + 2, '#0A0608');
    P.r(x, y, w, h, border); P.r(x + 2, y + 2, w - 4, h - 4, base);
    P.dith4(x + 2, y + 2, w - 4, h - 4, mixc(base, '#000000', 0.25));
    for (var i = x + 5; i < x + w - 5; i += 6) { P.px(i, y + 4, pat); P.px(i, y + h - 5, pat); }
    P.oval(x + w / 2, y + h / 2, Math.max(2, (w / 6) | 0), Math.max(2, (h / 4) | 0), pat);
    P.oval(x + w / 2, y + h / 2, Math.max(1, (w / 10) | 0), Math.max(1, (h / 7) | 0), base);
    for (i = x; i < x + w; i += 2) { P.px(i, y - 2, border); P.px(i, y + h + 1, border); }
  }
  /* walls */
  function wStripe(P, x, y, w, h, a, b, step) {
    P.r(x, y, w, h, a);
    for (var i = 0; i < w; i += step) P.r(x + i, y, 2, h, b);
  }
  function wPanel(P, x, y, w, h, top, wood, woodHi) {
    var split = y + ((h * 0.55) | 0);
    P.r(x, y, w, split - y, top);
    P.r(x, split, w, y + h - split, wood); P.r(x, split, w, 1, woodHi); P.r(x, split + 1, w, 1, mixc(wood, '#000000', 0.4));
    for (var i = x + 4; i < x + w - 8; i += 14) { P.r(i, split + 3, 10, y + h - split - 5, mixc(wood, '#000000', 0.2)); P.r(i, split + 3, 10, 1, mixc(wood, '#000000', 0.45)); }
  }
  function clock(P, cx, cy, face, rim) {
    P.oval(cx, cy, 5, 5, K); P.oval(cx, cy, 4, 4, rim); P.oval(cx, cy, 3, 3, face);
    P.r(cx, cy - 2, 1, 3, K); P.r(cx, cy, 2, 1, K);
  }

  /* ── Z: participation ──────────────────────────────────────────── */
  PAINT.g_0 = function (P, room) {
    shell(P, room, {
      cap: '#0C0E10', rim: '#2A3034', door: '#2A3A3A', wash: '#E8F0E0', skirt: '#1A1E1C', skirtHi: '#3A403A',
      floor: function (P, x, y, w, h) { fLino(P, x, y, w, h, '#3A3C34', '#34362F'); },
      wall: function (P, x, y, w, h) { P.r(x, y, w, h, '#4A5048'); P.r(x, y + h - 9, w, 9, '#3E443E'); P.r(x, y + h - 10, w, 1, '#5A6058'); }
    });
    /* the fluorescent tube, and the cold light it throws */
    stageLight(P, 88, 8, 2 * T, 34, 80, '#E8FFF0', 0.1);
    P.r(64, 3, 48, 4, K); P.r(65, 4, 46, 2, '#DCF2E4'); P.r(65, 5, 46, 1, '#A8C0B0');
    pool(P, 88, 60, 46, 22, '#E8FFF0', 0.08);
    /* a cork noticeboard, one notice, and a bunting that has given up */
    P.r(20, 8, 26, 18, K); P.r(21, 9, 24, 16, '#8A6A42'); P.dith4(21, 9, 24, 16, '#6E5232');
    P.r(24, 11, 9, 7, '#E8DCC8'); P.r(25, 12, 7, 1, '#8A8598'); P.r(25, 14, 5, 1, '#8A8598'); P.px(28, 11, '#C2405F');
    P.r(36, 15, 7, 8, '#D8E8F0'); P.r(37, 17, 5, 1, '#8A8598');
    var bx = 120;
    for (var i = 0; i < 6; i++) {
      var by = 10 + [0, 2, 3, 3, 2, 0][i];
      if (i === 3) { P.r(bx + i * 7 + 2, 26, 4, 3, '#C2A040'); continue; }   /* one flag has fallen to the skirting */
      P.r(bx + i * 7, by, 5, 1, K); P.r(bx + i * 7 + 1, by + 1, 3, 2, i & 1 ? '#C2405F' : '#C2A040'); P.px(bx + i * 7 + 2, by + 3, i & 1 ? '#C2405F' : '#C2A040');
    }
    P.line(bx, 10, bx + 38, 10, '#1A1A1A');
    clock(P, 160, 14, '#E8E8DC', '#6A706A');
  };
  ANIM.g_0 = function (g, o, S, now) {
    /* the tube dips now and then — a slow sag, never a strobe */
    var ph = now % 5200;
    if (ph < 260) { W(g, o, S, 65, 4, 46, 2, '#8AA090'); }
  };
  /* folding table: three cells wide, centred on its cell */
  PROP.ftable = {
    w: 52, h: 18, ax: 26, ay: 17, shadow: 30,
    paint: function (P) {
      P.r(2, 3, 48, 5, K); P.r(3, 4, 46, 3, '#B8B4A4'); P.r(3, 4, 46, 1, '#D8D4C4');
      P.r(4, 8, 2, 9, K); P.r(46, 8, 2, 9, K); P.r(10, 8, 1, 8, '#2A2A2A'); P.r(41, 8, 1, 8, '#2A2A2A');
      P.line(6, 9, 20, 15, '#3A3A3A'); P.line(46, 9, 32, 15, '#3A3A3A');
      /* a paper cup, a stack of blank certificates */
      P.r(38, 0, 4, 4, K); P.r(39, 0, 2, 3, '#E8E8E8');
      P.r(7, 1, 10, 3, K); P.r(8, 1, 8, 2, '#F0E8D8'); P.r(8, 2, 8, 1, '#D8D0C0');
    }
  };
  NPCART.prize0 = {
    w: 22, h: 30, ax: 11, ay: 17, shadow: 0,
    paint: function (P) {
      /* the certificate, propped on a little easel on the table */
      P.r(2, 1, 18, 14, K); P.r(3, 2, 16, 12, '#C8A04A'); P.r(4, 3, 14, 10, '#F4ECD8');
      P.r(6, 4, 10, 1, '#8A6A42'); P.r(7, 6, 8, 1, '#C8BCA8'); P.r(7, 8, 8, 1, '#C8BCA8');
      /* the name: one letter and a trail of giving up */
      P.r(6, 10, 1, 2, '#2A2438'); P.r(7, 10, 1, 1, '#2A2438'); P.r(8, 11, 1, 1, '#2A2438'); P.r(9, 10, 1, 2, '#2A2438');
      P.r(10, 11, 3, 1, '#7A7290'); P.px(13, 12, '#7A7290');
      P.oval(16, 12, 2, 2, '#C2405F'); P.r(15, 14, 1, 2, '#C2405F'); P.r(17, 14, 1, 2, '#C2405F');
      P.r(10, 15, 2, 2, K);
    }
  };
  PROP.cooler = {
    w: 14, h: 30, ax: 7, ay: 29, shadow: 10,
    paint: function (P) {
      P.oval(7, 7, 5, 6, K); P.oval(7, 7, 4, 5, '#9FC8E8'); P.r(5, 4, 2, 5, '#D8F0FF'); P.r(3, 4, 8, 1, '#7AA8C8');
      P.r(2, 12, 10, 17, K); P.r(3, 13, 8, 15, '#D8D4CC'); P.r(3, 13, 1, 15, '#F0ECE4');
      P.r(5, 16, 2, 2, '#C2405F'); P.r(8, 16, 2, 2, '#4A7AC8'); P.r(4, 20, 6, 1, '#8A8680');
    }
  };
  PROP.chairs = {
    w: 16, h: 30, ax: 8, ay: 29, shadow: 10,
    paint: function (P) {
      /* a stack of folding chairs, leaning */
      for (var i = 0; i < 4; i++) {
        var y = 3 + i * 3;
        P.r(2 + i, y, 12, 4, K); P.r(3 + i, y + 1, 10, 2, i & 1 ? '#5A6A72' : '#4A5A62');
      }
      P.r(3, 15, 2, 14, K); P.r(12, 15, 2, 14, K); P.r(4, 15, 1, 14, '#6A7A82'); P.r(12, 15, 1, 14, '#6A7A82');
      P.line(4, 18, 12, 27, '#2A3236');
    }
  };
  PROP.bin = {
    w: 12, h: 14, ax: 6, ay: 13, shadow: 8,
    paint: function (P) {
      P.r(1, 3, 10, 10, K); P.r(2, 4, 8, 8, '#4A5060'); P.r(2, 4, 8, 1, '#6A7288'); P.r(4, 6, 1, 6, '#3A404E'); P.r(7, 6, 1, 6, '#3A404E');
      /* crumpled certificates */
      P.oval(4, 3, 2, 2, '#F4ECD8'); P.oval(8, 2, 2, 2, '#E8DCC8'); P.px(6, 1, '#F4ECD8'); P.px(9, 2, '#C8A04A');
    }
  };
  PROP.pen = {
    w: 10, h: 4, ax: 5, ay: 3, shadow: 0,
    paint: function (P) { P.line(1, 2, 8, 0, '#2A3A8A'); P.px(9, 0, '#C8C8C8'); P.px(1, 2, '#1A1A1A'); }
  };

  /* ── C–: the chair and the wall ─────────────────────────────────── */
  PAINT.g_1 = function (P, room) {
    shell(P, room, {
      cap: '#100E14', rim: '#34303C', door: '#3A2A4A', skirt: '#2A2630', skirtHi: '#4A4652',
      floor: function (P, x, y, w, h) { fBoards(P, x, y, w, h, '#4A3A30', '#524034'); },
      wall: function (P, x, y, w, h) { P.r(x, y, w, h, '#B8B0C4'); P.r(x, y, w, 2, '#9A92A8'); P.dith4(x, y + 2, w, h - 2, '#AEA6BA'); P.r(x, y + 5, w, 1, '#8A8298'); }
    });
    /* track lights on the ceiling edge, one pointed at the exhibit */
    for (var i = 0; i < 4; i++) { var tx = 34 + i * 40; P.r(tx, 4, 6, 3, K); P.r(tx + 1, 5, 4, 1, '#5A5668'); }
    stageLight(P, 104, 7, 30, 10, 36, '#FFF6E0', 0.18);
    P.a(0.16); P.oval(104, 22, 18, 8, '#FFF6E0'); P.a(1);
    /* the exhibit: nothing, a nail, and a plaque */
    P.r(104, 17, 1, 2, '#5A5060'); P.px(104, 16, '#8A8298');
    P.r(116, 18, 12, 7, K); P.r(117, 19, 10, 5, '#E8DCC8'); P.r(118, 20, 8, 1, '#5A5060'); P.r(118, 22, 5, 1, '#8A8298');
    /* a velvet rope between the posts, drawn on the floor plane */
    for (var x = 72; x < 136; x++) P.r(x, 41 + Math.round(Math.sin((x - 72) / 64 * Math.PI) * 3), 1, 1, '#8A1A2E');
    /* a polished floor reflects the spotlight */
    pool(P, 104, 64, 30, 14, '#FFF6E0', 0.1);
    /* the other walls are empty too: one sign by the door */
    P.r(150, 8, 34, 10, K); P.r(151, 9, 32, 8, '#2A2632'); P.text('GALLERY', 152, 11, '#E8DCC8');
  };
  NPCART.prize1 = {
    w: 16, h: 24, ax: 8, ay: 23, shadow: 10,
    paint: function (P) {
      /* a good chair, from behind: tall back, red velvet seat */
      P.r(2, 1, 12, 15, K); P.r(3, 2, 10, 13, '#6B4F2F'); P.r(3, 2, 10, 2, '#8A6A42');
      P.r(5, 5, 6, 8, '#7A1A2E'); P.r(5, 5, 6, 1, '#9A2A3E');
      P.r(1, 15, 14, 4, K); P.r(2, 16, 12, 2, '#8A2236');
      P.r(2, 19, 2, 4, K); P.r(12, 19, 2, 4, K); P.r(3, 19, 1, 4, '#6B4F2F'); P.r(12, 19, 1, 4, '#6B4F2F');
    }
  };
  PROP.stanchion = {
    w: 8, h: 18, ax: 4, ay: 17, shadow: 6,
    paint: function (P) {
      P.r(2, 0, 4, 4, K); P.r(3, 1, 2, 2, '#FFE6A0');
      P.r(3, 4, 2, 11, '#C8A04A'); P.r(3, 4, 1, 11, '#FFE6A0');
      P.r(1, 15, 6, 2, K); P.r(2, 15, 4, 1, '#9A7A2E');
    }
  };
  PROP.bench = {
    w: 24, h: 12, ax: 12, ay: 11, shadow: 18,
    paint: function (P) {
      P.r(1, 2, 22, 5, K); P.r(2, 3, 20, 3, '#3A3044'); P.r(2, 3, 20, 1, '#5A5068');
      P.r(3, 7, 2, 4, K); P.r(19, 7, 2, 4, K);
    }
  };
  PROP.stool = {
    w: 12, h: 16, ax: 6, ay: 15, shadow: 8,
    paint: function (P) {
      P.r(1, 5, 10, 3, K); P.r(2, 6, 8, 1, '#5A5068');
      P.r(2, 8, 1, 7, K); P.r(9, 8, 1, 7, K); P.r(5, 8, 1, 7, K);
      /* the guard's cup, left on the stool; the guard is not here either */
      P.r(4, 1, 4, 4, K); P.r(5, 2, 2, 2, '#E8DCC8'); P.px(5, 0, '#8A8598');
    }
  };

  /* ── C: the break room machine ──────────────────────────────────── */
  PAINT.g_2 = function (P, room) {
    shell(P, room, {
      cap: '#0C1014', rim: '#2A3640', door: '#1A3A4A', wash: '#9FE0FF',
      floor: function (P, x, y, w, h) { fTiles(P, x, y, w, h, '#2E3A3E', '#283236', '#1E2629'); },
      wall: function (P, x, y, w, h) {
        P.r(x, y, w, h, '#2A4A4E');
        for (var j = 0; j < h; j += 5) for (var i = ((j / 5) & 1) * 4; i < w; i += 8) P.r(x + i, y + j, 7, 4, '#30565A');
      }
    });
    /* the machine's own light, the only one in here */
    pool(P, 88, 50, 40, 18, '#9FE0FF', 0.13);
    P.a(0.1); P.r(70, 3, 36, 29, '#9FE0FF'); P.a(1);
    /* a calendar three years out of date, a sign about the fridge */
    P.r(130, 7, 14, 17, K); P.r(131, 8, 12, 15, '#E8E4D8'); P.r(131, 8, 12, 4, '#C2405F');
    for (var j = 0; j < 3; j++) for (var i = 0; i < 3; i++) P.px(133 + i * 4, 14 + j * 3, '#5A5668');
    P.r(24, 12, 24, 9, K); P.r(25, 13, 22, 7, '#F0E8C8'); P.text('PRESS', 26, 14, '#3A3448');
  };
  NPCART.prize2 = {
    w: 26, h: 40, ax: 13, ay: 39, shadow: 18,
    light: function () { return { r: 46, col: '#9FE0FF', glow: 0.18 }; },
    paint: function (P) {
      P.r(1, 0, 24, 39, K); P.r(2, 1, 22, 37, '#3A6A8A'); P.r(2, 1, 22, 2, '#5A8AAA'); P.r(2, 1, 2, 37, '#4A7A9A');
      /* the glass: lit, empty shelves */
      P.r(4, 5, 18, 17, '#0E1E2A'); P.r(5, 6, 16, 15, '#9FE0FF'); P.dith4(5, 6, 16, 15, '#7AC0E0');
      for (var i = 0; i < 3; i++) P.r(5, 10 + i * 5, 16, 1, '#4A7A9A');
      P.line(7, 7, 11, 11, '#D8F6FF');
      /* ONE button, enormous, and nowhere to put money */
      P.oval(13, 28, 5, 4, K); P.oval(13, 28, 4, 3, '#C2203A'); P.r(11, 26, 3, 1, '#FF7A8A');
      P.r(6, 34, 14, 3, K); P.r(7, 35, 12, 1, '#1A2A36');
    },
    anim: function (g, x, y, S, now) {
      if (still()) return;
      /* the button breathes, slowly */
      if (((now / 900) | 0) % 2) { g.fillStyle = '#FF5A6A'; g.fillRect(x - 2 * S, y - 12 * S, 3 * S, S); }
    }
  };
  PROP.plant = {
    w: 24, h: 32, ax: 12, ay: 31, shadow: 10,
    paint: function (P) { paintPlant(P, 12, 31, '#2E5040', '#4E7A5A', '#6A5A4A'); }
  };
  PROP.cafe = {
    w: 18, h: 18, ax: 9, ay: 17, shadow: 12,
    paint: function (P) {
      P.oval(9, 5, 8, 3, K); P.oval(9, 5, 7, 2, '#C8C4B8'); P.r(4, 4, 6, 1, '#E8E4D8');
      P.r(8, 8, 2, 8, K); P.r(5, 15, 8, 2, K);
      P.r(11, 1, 3, 4, K); P.r(12, 2, 1, 2, '#E8E8E8');
    }
  };
  PROP.stool2 = {
    w: 10, h: 12, ax: 5, ay: 11, shadow: 6,
    paint: function (P) { P.oval(5, 3, 4, 2, K); P.oval(5, 3, 3, 1, '#C2405F'); P.r(4, 5, 2, 5, K); P.r(2, 10, 6, 1, K); }
  };

  /* ── B–: the dry aquarium ───────────────────────────────────────── */
  PAINT.g_3 = function (P, room) {
    shell(P, room, {
      cap: '#060A14', rim: '#1E2A44', door: '#123050', wash: '#7AB8FF',
      floor: function (P, x, y, w, h) {
        P.r(x, y, w, h, '#1A2236'); P.dith4(x, y, w, h, '#1E2840');
        /* caustics painted on the floor, of water that is not there */
        for (var i = 0; i < 26; i++) {
          var cx = x + ((hsh(i * 5) * w) | 0), cy = y + ((hsh(i * 9 + 1) * h) | 0);
          P.r(cx, cy, 4, 1, '#2A3A5A'); P.r(cx + 3, cy + 1, 3, 1, '#2A3A5A'); P.px(cx - 1, cy + 1, '#2A3A5A');
        }
      },
      wall: function (P, x, y, w, h) {
        P.r(x, y, w, h, '#14284A');
        for (var j = 0; j < h; j += 6) for (var i = 0; i < w; i += 12) { P.r(x + i + ((j / 6) & 1) * 6, y + j + 2, 5, 1, '#1C3660'); }
      }
    });
    /* the tank lamp spills down the wall and across the floor */
    P.a(0.12); P.r(70, 3, 60, 30, '#7AB8FF'); P.a(1);
    pool(P, 96, 52, 46, 16, '#7AB8FF', 0.1);
    rug(P, 72, 70, 50, 26, '#1E3A5A', '#2A4E78', '#3A6A9A');
    /* a framed photograph of a fish, on the wall */
    P.r(22, 9, 16, 13, K); P.r(23, 10, 14, 11, '#8A7A4A'); P.r(25, 12, 10, 7, '#3A6A9A');
    P.r(27, 14, 5, 3, '#E4A64A'); P.px(32, 15, '#E4A64A'); P.px(33, 14, '#E4A64A'); P.px(33, 16, '#E4A64A');
    P.r(160, 9, 20, 9, K); P.r(161, 10, 18, 7, '#E8DCC8'); P.text('FISH', 162, 11, '#123050');
  };
  NPCART.prize3 = {
    w: 50, h: 38, ax: 25, ay: 37, shadow: 0,
    light: function () { return { r: 40, col: '#7AB8FF', glow: 0.16 }; },
    paint: function (P) {
      /* the cabinet: three cells wide, starting one cell left */
      P.r(1, 24, 48, 13, K); P.r(2, 25, 46, 11, '#2A2034'); P.r(2, 25, 46, 1, '#4A3A54');
      P.r(4, 27, 20, 8, '#22182A'); P.r(26, 27, 20, 8, '#22182A'); P.px(22, 31, '#C8A04A'); P.px(27, 31, '#C8A04A');
      /* the tank: glass, dry gravel, a little castle, no water */
      P.r(2, 3, 46, 21, K); P.r(3, 4, 44, 19, '#16243A');
      P.r(3, 4, 44, 2, '#2A3A54');               /* the lid */
      P.r(10, 3, 30, 1, '#9FC8FF');               /* its lamp */
      P.r(3, 19, 44, 4, '#8A7A5A'); P.dith(3, 19, 44, 4, '#6A5A42');
      P.r(34, 12, 8, 7, '#5A5068'); P.r(34, 11, 2, 2, '#5A5068'); P.r(38, 11, 2, 2, '#5A5068'); P.r(40, 11, 2, 2, '#5A5068'); P.r(37, 15, 2, 4, '#1A1420');
      P.r(8, 12, 1, 7, '#3A6A3A'); P.r(9, 14, 1, 5, '#4A7A4A'); P.r(7, 15, 1, 4, '#4A7A4A');
      P.line(4, 6, 8, 10, '#3A5070'); P.line(44, 6, 46, 8, '#3A5070');
      P.r(3, 22, 44, 1, '#2A1E1A');
    },
    anim: function (g, x, y, S, now) {
      /* the fish, hanging in the air where the water should be */
      var t = still() ? 0 : now / 700;
      var fish = [[16, 11, '#E4A64A'], [26, 8, '#FF7A5A'], [22, 15, '#E4C46A']];
      for (var i = 0; i < 3; i++) {
        var f = fish[i], b = Math.round(Math.sin(t + i * 2) * 1);
        var fx = x + (f[0] - 25) * S, fy = y + (f[1] - 37 + b) * S;
        g.fillStyle = f[2]; g.fillRect(fx, fy, 4 * S, 2 * S); g.fillRect(fx + 4 * S, fy - S, S, 4 * S);
        g.fillStyle = '#0A0A0A'; g.fillRect(fx + S, fy, S, S);
      }
    }
  };
  PROP.net = {
    w: 14, h: 30, ax: 7, ay: 29, shadow: 4,
    paint: function (P) {
      P.line(3, 28, 9, 6, '#8A6A42'); P.line(4, 28, 10, 6, '#6B4F2F');
      P.oval(10, 4, 3, 3, '#5A6A7A'); P.oval(10, 4, 2, 2, '#2A3444'); P.dith(8, 2, 5, 5, '#7A8A9A');
    }
  };
  PROP.armchair = {
    w: 22, h: 22, ax: 11, ay: 21, shadow: 16,
    paint: function (P) {
      P.r(3, 1, 16, 12, K); P.r(4, 2, 14, 10, '#4A2A5A'); P.r(4, 2, 14, 2, '#6A3A7A');
      P.r(1, 9, 20, 10, K); P.r(2, 10, 4, 8, '#5A3468'); P.r(16, 10, 4, 8, '#5A3468'); P.r(6, 12, 10, 6, '#3A2048');
      P.r(6, 12, 10, 1, '#6A3A7A'); P.r(3, 19, 2, 2, K); P.r(17, 19, 2, 2, K);
    }
  };
  PROP.kelp = {
    w: 10, h: 24, ax: 5, ay: 23, shadow: 4,
    /* a plastic aquarium plant, out of its depth */
    paint: function (P) {
      P.r(2, 20, 6, 3, K); P.r(3, 20, 4, 2, '#3A3448');
      for (var j = 0; j < 20; j += 2) { P.px(4 + Math.round(Math.sin(j * 0.6) * 2), j, '#3A8A5A'); P.px(5 + Math.round(Math.sin(j * 0.6 + 1) * 2), j + 1, '#2A6A4A'); }
    }
  };

  /* ── B: the poster of a better room ─────────────────────────────── */
  PAINT.g_4 = function (P, room) {
    shell(P, room, {
      cap: '#0E0C0A', rim: '#2E2A24', door: '#3A2E20', wash: '#FFE6A0', skirt: '#1A1612', skirtHi: '#3A3228',
      floor: function (P, x, y, w, h) { fBoards(P, x, y, w, h, '#2E261E', '#342A22'); },
      wall: function (P, x, y, w, h) {
        P.r(x, y, w, h, '#4A4434');
        for (var i = 0; i < w; i += 8) { P.r(x + i, y, 1, h, '#423C2E'); P.dith4(x + i + 3, y, 2, h, '#544E3C'); }
        /* peeling: curls of paper and the plaster behind */
        var peel = [[14, 6], [60, 14], [150, 8], [172, 18], [128, 20]];
        for (var k = 0; k < peel.length; k++) {
          var px = x + peel[k][0], py = y + peel[k][1];
          P.r(px, py, 6, 5, '#6A6250'); P.r(px + 1, py + 1, 4, 3, '#2A2620'); P.r(px + 5, py - 1, 2, 2, '#5A5442');
        }
        /* a damp stain */
        P.a(0.45); P.oval(x + 40, y + 4, 9, 5, '#2A261A'); P.a(1);
      }
    });
    /* the bare bulb's light */
    pool(P, 104, 62, 50, 22, '#FFE6A0', 0.1);
    /* a cord to the ceiling */
    P.r(104, 0, 1, 34, '#1A1612');
  };
  NPCART.prize4 = {
    w: 46, h: 30, ax: 23, ay: 30, shadow: 0,
    paint: function (P) {
      /* taped to the wall, slightly crooked: a much better room */
      P.r(1, 1, 44, 28, K); P.r(2, 2, 42, 26, '#E8DCC8');
      P.r(4, 4, 38, 22, '#5A1A2E'); for (var i = 4; i < 42; i += 4) P.r(i, 4, 1, 22, '#6A2238');
      P.r(4, 20, 38, 6, '#7A4A2A'); P.r(4, 20, 38, 1, '#9A6A3A');                 /* parquet */
      P.r(30, 7, 8, 10, '#2A3A6A'); P.r(31, 8, 6, 8, '#6A8ACA'); P.r(33, 8, 1, 8, '#2A3A6A'); P.r(31, 11, 6, 1, '#2A3A6A');
      P.r(6, 14, 10, 6, '#C2405F'); P.r(6, 12, 3, 8, '#C2405F'); P.r(7, 15, 8, 1, '#E2607F');   /* armchair */
      /* THE CHANDELIER */
      P.r(22, 4, 1, 3, '#C8A04A'); P.r(17, 7, 11, 2, '#E4C46A'); P.r(19, 9, 7, 1, '#C8A04A');
      for (i = 0; i < 4; i++) { P.px(17 + i * 3, 6, '#FFF2C4'); P.px(17 + i * 3, 5, '#FFB347'); }
      P.px(22, 10, '#FFF2C4');
      /* tape */
      P.r(0, 0, 5, 3, '#D8D0A0'); P.r(41, 0, 5, 3, '#D8D0A0'); P.r(0, 27, 5, 3, '#D8D0A0');
      P.r(41, 26, 4, 2, '#2A2620'); P.line(41, 28, 44, 26, '#C8BCA0');   /* one corner has come away */
    }
  };
  PROP.bulb = {
    /* drawn over the floor where it hangs: just the bulb and its shade */
    w: 9, h: 12, ax: 4, ay: 30, shadow: 0,
    light: function () { return { r: 40, col: '#FFE6A0', glow: 0.16 }; },
    paint: function (P) { P.r(4, 0, 1, 5, '#1A1612'); P.r(3, 5, 3, 2, '#3A3228'); P.oval(4, 8, 2, 2, '#FFF2C4'); P.px(4, 8, '#FFFFFF'); }
  };
  PROP.bucket = {
    w: 12, h: 14, ax: 6, ay: 13, shadow: 8,
    paint: function (P) {
      P.r(1, 4, 10, 9, K); P.r(2, 5, 8, 7, '#6A7280'); P.r(2, 5, 8, 1, '#8A92A0'); P.r(3, 6, 6, 2, '#3A4A6A');
      P.line(1, 4, 6, 0, '#4A505A'); P.line(10, 4, 6, 0, '#4A505A');
    },
    anim: function (g, x, y, S, now) {
      /* the drip from the damp patch, once every two seconds */
      if (still()) return;
      var t = (now % 2000) / 2000;
      if (t < 0.5) { g.fillStyle = '#9FB8FF'; g.fillRect(x, y - Math.round((1 - t * 2) * 34 + 10) * S, S, 2 * S); }
      else if (t < 0.6) { g.fillStyle = '#C8D8FF'; g.fillRect(x - 2 * S, y - 10 * S, S, S); g.fillRect(x + 2 * S, y - 10 * S, S, S); }
    }
  };
  PROP.cratetable = {
    w: 18, h: 22, ax: 9, ay: 21, shadow: 14,
    light: function () { return { r: 18, col: '#FFB347', glow: 0.2, flicker: true }; },
    paint: function (P) {
      P.r(1, 7, 16, 14, K); P.r(2, 8, 14, 12, '#6B4F2F'); P.r(2, 8, 14, 1, '#8A6A42');
      P.line(2, 9, 15, 19, '#4A3420'); P.line(15, 9, 2, 19, '#4A3420');
      /* a candle in a saucer */
      P.r(6, 6, 6, 1, K); P.r(8, 1, 2, 5, '#E8DCC8'); P.r(8, 0, 2, 1, '#FFB347');
    },
    anim: function (g, x, y, S, now) {
      var f = still() ? 0 : ((now / 130) | 0) % 3;
      g.fillStyle = f === 1 ? '#FFE6A0' : '#FFB347'; g.fillRect(x - S + (f === 2 ? S : 0), y - (22 + (f & 1)) * S, S, 2 * S);
    }
  };
  PROP.mattress = {
    w: 34, h: 14, ax: 9, ay: 13, shadow: 0,
    paint: function (P) {
      P.r(1, 3, 32, 10, K); P.r(2, 4, 30, 8, '#8A8070'); P.r(2, 4, 30, 1, '#A89E8C');
      for (var i = 6; i < 30; i += 6) P.px(i, 8, '#6A6254');
      P.r(3, 5, 9, 5, '#C8C0B0'); P.r(14, 5, 17, 6, '#4A5A7A'); P.r(14, 5, 17, 1, '#6A7A9A');
    }
  };

  /* ── A–: a recital for one ──────────────────────────────────────── */
  PAINT.g_5 = function (P, room) {
    var Wd = room.w * T;
    shell(P, room, {
      cap: '#0C0608', rim: '#3A1420', door: '#5A1022', wash: '#FFD890',
      floor: function (P, x, y, w, h) { fParquet(P, x, y, w, h, '#2A1C18', '#33221C'); },
      wall: function (P, x, y, w, h) {
        /* the house curtain, closed behind the stage, and a valance */
        P.r(x, y, w, h, '#5A0E1E');
        for (var i = 0; i < w; i += 6) { P.r(x + i, y, 2, h, '#7A1A2C'); P.r(x + i + 2, y, 1, h, '#8E2436'); P.r(x + i + 5, y, 1, h, '#3A0612'); }
        P.r(x, y, w, 6, '#7A1A2C'); P.r(x, y + 6, w, 1, '#C8A04A');
        for (i = 0; i < w; i += 12) P.oval(x + i + 6, y + 6, 6, 2, '#6A1424');
        for (i = 0; i < w; i += 3) P.px(x + i, y + 9, '#C8A04A');
      }
    });
    /* the stage: rows 2-4, raised, boards running across */
    var sy0 = 2 * T, sy1 = 5 * T;
    fBoards(P, T, sy0, Wd - 2 * T, sy1 - sy0, '#4A3424', '#523A28');
    P.a(0.45); P.r(T, sy0, Wd - 2 * T, 3, '#000000'); P.a(1);
    P.r(T, sy1 - 2, Wd - 2 * T, 2, '#C8A04A'); P.r(T, sy1, Wd - 2 * T, 3, '#1A0E0A'); P.r(T, sy1 + 3, Wd - 2 * T, 2, '#120A08');
    /* footlights along its edge */
    for (var x = 2 * T; x < Wd - T; x += 16) {
      P.a(0.16); P.r(x - 6, sy1 - 12, 14, 10, '#FFD890'); P.a(1);
      P.r(x - 2, sy1 - 3, 5, 2, K); P.r(x - 1, sy1 - 3, 3, 1, '#FFE6A0');
    }
    /* the spotlight on the piano */
    stageLight(P, 6 * T + 8, 3, 3 * T + 12, 6, 54, '#FFF2C4', 0.08);
    pool(P, 6 * T + 8, 3 * T + 10, 34, 12, '#FFF2C4', 0.12);
    /* the house: an aisle carpet to the door */
    P.r(5 * T, sy1 + 5, 3 * T, room.h * T - T - sy1 - 5, '#4A1424'); P.dith4(5 * T, sy1 + 5, 3 * T, room.h * T - T - sy1 - 5, '#5A1A2E');
    P.r(5 * T, sy1 + 5, 1, room.h * T - T - sy1 - 5, '#C8A04A'); P.r(8 * T - 1, sy1 + 5, 1, room.h * T - T - sy1 - 5, '#C8A04A');
    /* the side wings: curtain pulled back and tied */
    for (var s = 0; s < 2; s++) {
      var wx = s ? Wd - T : 0;
      for (var i = 0; i < T; i += 4) { P.r(wx + i, 0, 2, 6 * T, '#6A1424'); P.r(wx + i + 2, 0, 1, 6 * T, '#3A0612'); }
      P.r(wx + 2, 3 * T, 12, 3, '#C8A04A');
    }
  };
  ANIM.g_5 = function (g, o, S, now) {
    /* a note drifts up off the piano now and then */
    var t = (now % 3600) / 3600;
    if (t > 0.6) return;
    var y = 3 * T - 14 - Math.round(t * 28), x = 6 * T + 12 + Math.round(Math.sin(t * 9) * 3);
    W(g, o, S, x, y, 2, 2, '#FFF2C4'); W(g, o, S, x + 2, y - 5, 1, 6, '#FFF2C4'); W(g, o, S, x + 3, y - 5, 2, 1, '#FFF2C4');
  };
  NPCART.prize5 = {
    w: 50, h: 34, ax: 25, ay: 33, shadow: 30,
    paint: function (P) {
      /* a small grand: black lacquer, lid propped, three keys */
      P.r(3, 14, 44, 12, K);
      P.r(4, 15, 42, 10, '#1E1A24'); P.r(4, 15, 42, 2, '#3A3444');
      P.oval(38, 15, 9, 6, K); P.oval(38, 15, 8, 5, '#1E1A24');
      /* the lid, up at an angle, and its prop stick */
      P.line(6, 14, 34, 2, K); P.line(6, 13, 34, 1, K); P.line(7, 13, 33, 2, '#3A3444');
      for (var i = 0; i < 6; i++) P.line(8 + i * 4, 13 - (i * 1.7 | 0), 8 + i * 4, 14, '#2A2632');
      P.r(28, 4, 1, 10, '#8A7A4A');
      /* the keyboard: a long black cheek and exactly three white keys */
      P.r(10, 20, 18, 5, K); P.r(12, 21, 4, 3, '#EDE7DE'); P.r(17, 21, 4, 3, '#EDE7DE'); P.r(22, 21, 4, 3, '#EDE7DE');
      P.r(12, 23, 14, 1, '#B8B0A8');
      P.r(8, 18, 22, 1, '#C8A04A');
      /* legs and pedals */
      P.r(6, 25, 3, 8, K); P.r(40, 25, 3, 8, K); P.r(23, 25, 3, 8, K);
      P.r(16, 30, 6, 2, K); P.r(17, 30, 4, 1, '#C8A04A');
    }
  };
  PROP.pbench = {
    w: 18, h: 10, ax: 9, ay: 9, shadow: 12,
    paint: function (P) { P.r(1, 1, 16, 4, K); P.r(2, 2, 14, 2, '#1E1A24'); P.r(2, 2, 14, 1, '#3A3444'); P.r(2, 5, 2, 4, K); P.r(14, 5, 2, 4, K); }
  };
  PROP.stand = {
    w: 14, h: 26, ax: 7, ay: 25, shadow: 6,
    paint: function (P) {
      P.r(1, 2, 12, 9, K); P.r(2, 3, 10, 7, '#E8DCC8');
      /* the score: one note, middle c, held */
      P.r(3, 5, 8, 1, '#8A8598'); P.r(3, 7, 8, 1, '#8A8598'); P.r(6, 6, 2, 2, '#1A1420'); P.r(5, 7, 4, 1, '#1A1420');
      P.r(6, 11, 2, 12, K); P.r(3, 23, 8, 2, K);
    }
  };
  PROP.bouquet = {
    w: 14, h: 10, ax: 7, ay: 9, shadow: 0,
    paint: function (P) {
      P.line(2, 8, 9, 5, '#3A6A3A'); P.line(3, 8, 10, 6, '#2A5A2A');
      P.r(9, 3, 3, 3, '#C2405F'); P.r(11, 5, 2, 2, '#E2607F'); P.r(10, 2, 2, 2, '#FFD34E'); P.px(12, 3, '#FFFFFF');
      P.r(4, 6, 4, 2, '#E8DCC8');
    }
  };
  PROP.seat = {
    w: 14, h: 20, ax: 7, ay: 19, shadow: 10,
    paint: function (P) {
      /* an audience chair, empty: we see its back */
      P.r(2, 1, 10, 12, K); P.r(3, 2, 8, 10, '#6A1424'); P.r(3, 2, 8, 1, '#8A2436'); P.r(4, 4, 1, 7, '#7A1A2C');
      P.r(1, 12, 12, 4, K); P.r(2, 13, 10, 2, '#4A0E1C');
      P.r(2, 16, 2, 3, K); P.r(10, 16, 2, 3, K);
    }
  };

  /* ── A: the library of one book ─────────────────────────────────── */
  function shelfRow(P, x, y, w, h) {
    /* one shelf of THE BOOK: identical spines, identical gold bands */
    P.r(x, y, w, h, '#1A0E0A');
    for (var i = x + 1; i + 3 <= x + w; i += 4) {
      P.r(i, y + 1, 3, h - 1, '#8A1A2A'); P.r(i, y + 1, 1, h - 1, '#A02A38');
      P.r(i, y + 3, 3, 1, '#C8A04A'); P.r(i, y + h - 3, 3, 1, '#C8A04A');
    }
  }
  PAINT.g_6 = function (P, room) {
    shell(P, room, {
      cap: '#0A0806', rim: '#2E2418', door: '#2A3A20', wash: '#FFD890', skirt: '#1A1008', skirtHi: '#4A3420',
      floor: function (P, x, y, w, h) { fBoards(P, x, y, w, h, '#2A1E14', '#2E2216'); },
      wall: function (P, x, y, w, h) {
        /* floor-to-ceiling shelves of the same book */
        P.r(x, y, w, h, '#3A2414');
        for (var j = y + 1; j + 8 <= y + h; j += 9) { shelfRow(P, x + 2, j, w - 4, 8); P.r(x + 1, j + 8, w - 2, 1, '#5A3A20'); }
        for (var i = x; i < x + w; i += 40) { P.r(i, y, 3, h, '#4A3020'); P.r(i, y, 1, h, '#6A4A2A'); }
      }
    });
    /* a library ladder leaning on the shelves */
    P.line(150, 4, 156, 32, '#6A4A2A'); P.line(160, 4, 166, 32, '#6A4A2A');
    for (var k = 0; k < 6; k++) P.line(151 + k, 8 + k * 4, 161 + k, 8 + k * 4, '#8A6A42');
    /* the reading rug and the lamp's pool */
    rug(P, 52, 84, 72, 26, '#2A4A2E', '#6A2A1E', '#C8A04A');
    pool(P, 56, 96, 34, 16, '#FFD890', 0.14);
    pool(P, 104, 56, 40, 14, '#FFD890', 0.06);
  };
  NPCART.prize6 = {
    w: 52, h: 42, ax: 26, ay: 41, shadow: 0,
    paint: function (P) {
      /* the freestanding case, three cells wide, and its sign */
      P.r(2, 8, 48, 33, K); P.r(3, 9, 46, 31, '#4A3020'); P.r(3, 9, 46, 1, '#6A4A2A');
      for (var j = 0; j < 3; j++) { shelfRow(P, 5, 11 + j * 9, 42, 8); P.r(4, 19 + j * 9, 44, 1, '#6A4A2A'); }
      P.r(3, 38, 46, 2, '#2A1A10');
      P.r(8, 0, 36, 9, K); P.r(9, 1, 34, 7, '#C8A04A'); P.r(10, 2, 32, 5, '#3A2414');
      P.text('THE', 12, 2, '#E4C46A'); P.text('BOOK', 26, 2, '#E4C46A');
    }
  };
  PROP.readlamp = {
    w: 14, h: 32, ax: 7, ay: 31, shadow: 6,
    light: function () { return { r: 34, col: '#FFD890', glow: 0.2 }; },
    paint: function (P) {
      P.r(1, 0, 12, 7, K); P.r(2, 1, 10, 5, '#3A6A3A'); P.r(2, 5, 10, 1, '#FFE6A0');
      P.r(6, 7, 2, 22, K); P.r(6, 7, 1, 22, '#C8A04A'); P.r(3, 29, 8, 2, K);
    }
  };
  PROP.lectern = {
    w: 16, h: 24, ax: 8, ay: 23, shadow: 8,
    paint: function (P) {
      P.r(1, 2, 14, 6, K); P.r(2, 3, 12, 4, '#5A3A20');
      /* THE BOOK, closed, on its stand */
      P.r(4, 0, 8, 5, K); P.r(5, 1, 6, 3, '#8A1A2A'); P.r(5, 2, 6, 1, '#C8A04A');
      P.r(6, 8, 4, 13, K); P.r(7, 8, 2, 13, '#4A3020'); P.r(3, 21, 10, 2, K);
    }
  };
  PROP.globe = {
    w: 14, h: 22, ax: 7, ay: 21, shadow: 8,
    paint: function (P) {
      P.oval(7, 7, 6, 6, K); P.oval(7, 7, 5, 5, '#3A6A8A'); P.r(4, 5, 3, 3, '#6A8A4A'); P.r(8, 8, 3, 2, '#6A8A4A');
      P.ring(7, 7, 6, 6, '#C8A04A');
      P.r(6, 13, 2, 6, K); P.r(3, 19, 8, 2, K);
    }
  };
  PROP.bookpile = {
    w: 14, h: 14, ax: 7, ay: 13, shadow: 8,
    paint: function (P) {
      for (var i = 0; i < 4; i++) { P.r(1 + (i & 1), 10 - i * 3, 11, 3, K); P.r(2 + (i & 1), 11 - i * 3, 9, 1, '#8A1A2A'); P.r(2 + (i & 1), 10 - i * 3, 9, 1, '#C8A04A'); }
    }
  };

  /* ── S: the very small door ─────────────────────────────────────── */
  PAINT.g_7 = function (P, room) {
    var Wd = room.w * T;
    shell(P, room, {
      cap: '#0C0A10', rim: '#3A3448', door: '#3A1A40', wash: '#FFE6A0', skirt: '#1A1620', skirtHi: '#5A5468',
      floor: function (P, x, y, w, h) { fMarble(P, x, y, w, h, '#3A3448', '#2E2A3A', '#4A4458'); },
      wall: function (P, x, y, w, h) {
        P.r(x, y, w, h, '#4A4458'); P.dith4(x, y, w, h, '#524C62');
        /* pilasters */
        for (var i = x + 8; i < x + w; i += 32) { P.r(i, y, 6, h, '#5A5468'); P.r(i, y, 1, h, '#6A6478'); P.r(i + 5, y, 1, h, '#3A3448'); }
      }
    });
    /* the carpet from the door to the door */
    var cx = 6 * T + 8;
    P.r(cx - 10, 2 * T, 21, room.h * T - 3 * T, '#6A1226'); P.dith4(cx - 10, 2 * T, 21, room.h * T - 3 * T, '#7A1A2E');
    P.r(cx - 10, 2 * T, 2, room.h * T - 3 * T, '#C8A04A'); P.r(cx + 9, 2 * T, 2, room.h * T - 3 * T, '#C8A04A');
    /* an enormous gilded frame, built for a door forty times the size */
    P.r(cx - 30, 3, 61, 29, K);
    P.r(cx - 29, 4, 59, 28, '#C8A04A'); P.r(cx - 29, 4, 59, 1, '#FFE6A0');
    P.r(cx - 25, 8, 51, 24, '#9A7A2E'); P.r(cx - 23, 10, 47, 22, '#1E1828');
    P.dith4(cx - 23, 10, 47, 22, '#2A2236');
    for (var i = cx - 27; i < cx + 28; i += 6) { P.px(i, 6, '#FFF2C4'); }
    P.r(cx - 4, 1, 9, 5, K); P.r(cx - 3, 2, 7, 3, '#E4C46A'); P.px(cx, 3, '#FFFFFF');
    /* spotlights in from both sides */
    P.a(0.1); P.oval(cx, 26, 20, 8, '#FFF2C4'); P.a(1);
    pool(P, cx, 40, 22, 8, '#FFE6A0', 0.12);
  };
  NPCART.prize7 = {
    w: 16, h: 14, ax: 8, ay: 14, shadow: 0,
    light: function () { return { r: 14, col: '#FFE6A0', glow: 0.2 }; },
    paint: function (P) {
      /* the door: seven pixels wide, with a doormat */
      P.r(4, 2, 8, 11, K); P.r(5, 3, 6, 10, '#7A5A3A'); P.r(5, 3, 6, 1, '#9A7A4A');
      P.r(6, 5, 4, 3, '#5A3E2A'); P.r(6, 9, 4, 3, '#5A3E2A');
      P.px(9, 8, '#FFD34E'); P.px(7, 8, '#FFE6A0');
      P.r(3, 13, 10, 1, '#8A6A42');
    }
  };
  PROP.topiary = {
    w: 18, h: 34, ax: 9, ay: 33, shadow: 10,
    paint: function (P) {
      P.oval(9, 8, 7, 7, K); P.oval(9, 8, 6, 6, '#2E5A3A'); P.dith4(4, 3, 10, 10, '#4A7A52');
      P.oval(9, 19, 5, 4, K); P.oval(9, 19, 4, 3, '#2E5A3A');
      P.r(8, 15, 2, 10, '#4A3020');
      P.r(3, 24, 12, 9, K); P.r(4, 25, 10, 7, '#C8C0D0'); P.r(4, 25, 10, 1, '#FFFFFF'); P.r(4, 30, 10, 1, '#9A92A8');
    }
  };
  PROP.magnifier = {
    w: 14, h: 26, ax: 7, ay: 25, shadow: 6,
    paint: function (P) {
      /* on a stand, so that you can look at the door properly */
      P.oval(7, 6, 6, 6, K); P.oval(7, 6, 5, 5, '#C8A04A'); P.oval(7, 6, 4, 4, '#A8C8E8'); P.r(5, 4, 2, 1, '#FFFFFF');
      P.r(6, 12, 2, 11, K); P.r(6, 12, 1, 11, '#C8A04A'); P.r(3, 23, 8, 2, K);
    }
  };
  PROP.urn = {
    w: 14, h: 20, ax: 7, ay: 19, shadow: 8,
    paint: function (P) {
      P.r(3, 1, 8, 2, K); P.oval(7, 9, 5, 6, K); P.oval(7, 9, 4, 5, '#8A8298'); P.r(4, 6, 2, 5, '#B8B0C8');
      P.r(5, 15, 4, 3, K); P.r(3, 18, 8, 2, K); P.r(4, 2, 6, 1, '#B8B0C8');
    }
  };

  /* ── T: the best room ───────────────────────────────────────────── */
  PAINT.g_8 = function (P, room) {
    var Wd = room.w * T, Hd = room.h * T;
    shell(P, room, {
      cap: '#14121A', rim: '#6A6478', door: '#3A3448', wash: '#FFFFFF', skirt: '#4A4458', skirtHi: '#9A92A8',
      floor: function (P, x, y, w, h) { fMarble(P, x, y, w, h, '#C8C0D0', '#B8B0C4', '#D8D0E0'); },
      wall: function (P, x, y, w, h) {
        P.r(x, y, w, h, '#8A8298'); P.dith4(x, y, w, h, '#928AA0');
        /* three tall windows full of night */
        for (var i = 0; i < 3; i++) {
          var wx = x + 30 + i * 70;
          P.r(wx - 1, y + 2, 22, h - 3, K); P.r(wx, y + 3, 20, h - 5, '#0E1430');
          P.oval(wx + 10, y + 4, 10, 3, '#0E1430');
          P.px(wx + 4, y + 8, '#E8DAFF'); P.px(wx + 14, y + 12, '#E8DAFF'); P.px(wx + 9, y + 19, '#9FB8FF'); P.px(wx + 16, y + 6, '#9FB8FF');
          P.r(wx + 9, y + 3, 2, h - 5, '#6A6478'); P.r(wx, y + 15, 20, 1, '#6A6478');
        }
      }
    });
    /* the stairwell in the west wall: steps going down into the dark */
    var sy = 5 * T;
    P.r(0, sy - 2, T, T + 4, K);
    for (var k = 0; k < 5; k++) P.r(k * 3, sy + 1 + k, T - k * 3, T - 2 - k * 2 > 0 ? T - 2 - k * 2 : 1, mixc('#6A6478', '#000000', k / 5));
    /* the compass star inlaid round the plinth */
    var cx = 7 * T + 8, cy = 5 * T + 10;
    P.ring(cx, cy, 34, 20, '#A89EB8'); P.ring(cx, cy, 30, 17, '#E4C46A');
    for (var a = 0; a < 8; a++) {
      var ang = a * Math.PI / 4, r = a & 1 ? 18 : 30;
      P.line(cx, cy, Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r * 0.6), a & 1 ? '#A89EB8' : '#C8A04A');
    }
    /* the skylight: a shaft of white from the top of the room */
    stageLight(P, cx, 0, cy + 6, 26, 42, '#FFFFFF', 0.08);
    stageLight(P, cx, 0, cy + 6, 14, 26, '#FFFFFF', 0.08);
    pool(P, cx, cy + 2, 26, 12, '#FFFFFF', 0.16);
    /* a bloom of light around the room's edge from the windows */
    P.a(0.1); P.r(T, 2 * T, Wd - 2 * T, 10, '#9FB8FF'); P.a(1);
    P.a(0.25); P.r(T, Hd - 2 * T, Wd - 2 * T, T, '#4A4458'); P.a(1);
  };
  ANIM.g_8 = function (g, o, S, now) {
    /* dust in the beam: six motes drifting down, slowly */
    var cx = 7 * T + 8;
    for (var i = 0; i < 6; i++) {
      var t = ((now / 9000) + hsh(i)) % 1;
      var y = Math.round(t * 80), x = cx - 10 + ((hsh(i + 7) * 20) | 0) + Math.round(Math.sin(now / 1400 + i) * 2);
      W(g, o, S, x, y, 1, 1, '#FFFFFF');
    }
  };
  NPCART.prize8 = {
    w: 22, h: 22, ax: 11, ay: 21, shadow: 16,
    light: function () { return { r: 46, col: '#FFFFFF', glow: 0.14 }; },
    paint: function (P) {
      /* an empty plinth with an empty cushion: the prize */
      P.r(2, 9, 18, 12, K); P.r(3, 10, 16, 10, '#E8E0F0'); P.r(3, 10, 16, 2, '#FFFFFF'); P.r(16, 12, 3, 8, '#B8B0C4');
      P.r(1, 7, 20, 3, K); P.r(2, 7, 18, 2, '#F4F0FA');
      P.r(1, 19, 20, 2, K);
      P.r(5, 3, 12, 5, K); P.r(6, 4, 10, 3, '#8A1A2E'); P.r(6, 4, 10, 1, '#B03044');
      P.px(5, 7, '#E4C46A'); P.px(16, 7, '#E4C46A');
    }
  };
  PROP.column = {
    w: 18, h: 42, ax: 9, ay: 41, shadow: 12,
    paint: function (P) {
      P.r(2, 0, 14, 5, K); P.r(3, 1, 12, 3, '#E8E0F0'); P.r(3, 1, 12, 1, '#FFFFFF');
      P.r(4, 5, 10, 30, K); P.r(5, 5, 8, 30, '#D8D0E0');
      P.r(6, 5, 1, 30, '#FFFFFF'); P.r(9, 5, 1, 30, '#B8B0C4'); P.r(12, 5, 1, 30, '#A89EB8');
      P.r(1, 35, 16, 6, K); P.r(2, 36, 14, 4, '#E8E0F0'); P.r(2, 39, 14, 1, '#A89EB8');
    }
  };

  /* ══ H1 — the landing in the storm ══════════════════════════════
     A shelf of wet flagstones hanging in cloud. North is a cliff with a
     door the size of a house in it, its two leaves standing ajar; the
     gap between them is the exit (engine-doors draws the rift of
     weather in it). The stairs from the best room come through the
     west wall; south and east the floor breaks off into sky ('v'). */
  var SKY = ['#04050E', '#070A1A', '#0A1026', '#0E1632', '#131C3E'];
  function stormSky(P, x, y, w, h, seed) {
    /* stepped cloud bands, lighter toward the bottom where the storm
       lights them from below */
    for (var j = 0; j < h; j++) {
      var k = Math.min(SKY.length - 1, ((j / h) * SKY.length) | 0);
      P.r(x, y + j, w, 1, SKY[k]);
    }
    for (var i = 0; i < 18; i++) {
      var cx = x + ((hsh(seed + i) * w) | 0), cy = y + ((hsh(seed + i + 40) * h) | 0), cw = 10 + ((hsh(seed + i + 80) * 26) | 0);
      P.r(cx, cy, cw, 2, '#1A2448'); P.r(cx + 3, cy - 1, cw - 8, 1, '#26325C'); P.r(cx + 2, cy + 2, cw - 4, 1, '#0E1430');
    }
  }
  PAINT.h1 = function (P, room) {
    var Wd = room.w * T, Hd = room.h * T, x, y, i;
    /* everything starts as sky; floor and rock are laid over it */
    stormSky(P, 0, 0, Wd, Hd, 3);
    /* distant forks, frozen in the clouds */
    P.line(300, 100, 306, 120, '#2E3A6A'); P.line(306, 120, 302, 132, '#2E3A6A'); P.line(306, 120, 314, 128, '#2E3A6A');
    P.line(60, 150, 66, 166, '#26325C'); P.line(66, 166, 62, 176, '#26325C');
    for (y = 0; y < room.h; y++) for (x = 0; x < room.w; x++) {
      var ch = cellAt(room, x, y), X = x * T, Y = y * T;
      if (ch === 'v') {
        /* under an edge: the cliff face of the landing, breaking up */
        if (y > 0 && '.o'.indexOf(cellAt(room, x, y - 1)) >= 0) {
          var d = 6 + ((hsh(x * 7 + y) * 6) | 0);
          P.r(X, Y, T, d, '#1A1E30'); P.r(X, Y, T, 2, '#2E3448');
          for (i = 0; i < T; i += 3) P.r(X + i, Y + d, 2, 2 + ((hsh(x + i) * 4) | 0), '#141828');
        }
        continue;
      }
      if (ch === '#' && y >= 3) {
        /* the west wall: tumbled rock from above */
        P.r(X, Y, T, T, '#0E1020'); P.r(X + 2, Y + 3, 10, 7, '#1A1E30'); P.r(X + 3, Y + 3, 8, 1, '#2A3048');
        if (cellAt(room, x + 1, y) === '.') P.r(X + T - 2, Y, 2, T, '#2A3048');
        continue;
      }
      if (ch === '#') continue;
      /* wet flagstones */
      for (i = 0; i < 4; i++) {
        var sx = X + (i & 1) * 8, sy = Y + (i >> 1) * 8, k = hsh(x * 13 + y * 31 + i);
        P.r(sx, sy, 8, 8, k > 0.66 ? '#283252' : k > 0.33 ? '#222A46' : '#1E263E');
        P.r(sx, sy, 8, 1, '#323C60'); P.r(sx, sy + 7, 8, 1, '#141A2C'); P.r(sx + 7, sy, 1, 8, '#141A2C');
      }
      if (hsh(x * 3 + y * 17) > 0.8) { P.r(X + 3, Y + 12, 3, 2, '#2E5040'); P.px(X + 4, Y + 11, '#4A7A5A'); }
      /* the edge of the shelf: a worn lip */
      if ('v'.indexOf(cellAt(room, x, y + 1)) >= 0) { P.r(X, Y + T - 2, T, 2, '#323C60'); P.r(X, Y + T - 1, T, 1, '#4A5680'); }
      if (cellAt(room, x + 1, y) === 'v') { P.r(X + T - 2, Y, 2, T, '#323C60'); }
    }
    /* the worn path from the stairs to the door */
    var path = [[1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5], [7, 4], [8, 4], [9, 4], [10, 4], [10, 3], [11, 4], [8, 5], [9, 3], [11, 3]];
    for (i = 0; i < path.length; i++) { P.a(0.22); P.r(path[i][0] * T + 1, path[i][1] * T + 2, T - 2, T - 4, '#6A7AB0'); P.a(1); }
    /* puddles holding the door's light */
    var pud = [[5, 6, 9], [12, 6, 12], [9, 7, 8], [3, 4, 6], [14, 3, 7]];
    for (i = 0; i < pud.length; i++) {
      var px = pud[i][0] * T + 8, py = pud[i][1] * T + 8, pw = pud[i][2];
      P.oval(px, py, pw + 1, 4, '#141A2C'); P.oval(px, py, pw, 3, '#1A2850');
      P.r(px - pw + 3, py - 1, pw, 1, '#6E8CFF'); P.r(px - 2, py + 1, pw - 2, 1, '#3A4E8A'); P.px(px + 2, py - 2, '#C8D8FF');
    }
    /* the cliff and the door in it */
    P.r(0, 0, Wd, 3 * T, '#0E1020');
    for (y = 0; y < 3 * T; y += 6) for (x = ((y / 6) & 1) * 9; x < Wd; x += 18) {
      P.r(x, y, 16, 5, '#161A2C'); P.r(x, y, 16, 1, '#20263C'); P.r(x + 15, y, 1, 5, '#0A0C18');
    }
    P.r(0, 3 * T - 2, Wd, 2, '#060810');
    P.a(0.45); P.r(T, 3 * T, Wd - 3 * T, 4, '#000000'); P.a(1);
    var cx = 10 * T + 8;
    /* the frame: a stone arch five cells across */
    P.r(cx - 40, 0, 81, 48, K);
    P.r(cx - 39, 0, 8, 48, '#2A3048'); P.r(cx + 32, 0, 8, 48, '#2A3048');
    P.r(cx - 39, 0, 1, 48, '#3E4868'); P.r(cx + 32, 0, 1, 48, '#3E4868');
    P.r(cx - 31, 0, 63, 4, '#2A3048'); P.r(cx - 31, 3, 63, 1, '#3E4868');
    /* the leaves: banded iron-dark wood, standing a little open */
    for (var s = 0; s < 2; s++) {
      var lx = s ? cx + 9 : cx - 31, lw = 22;
      P.r(lx, 4, lw, 44, '#1E2440');
      for (i = 0; i < lw; i += 4) P.r(lx + i, 4, 1, 44, '#161A30');
      for (y = 10; y < 48; y += 12) { P.r(lx, y, lw, 2, '#3A4466'); P.r(lx, y, lw, 1, '#5A668E'); for (i = 2; i < lw; i += 6) P.px(lx + i, y, '#9FB8FF'); }
      /* a sliver of edge where it has swung in */
      P.r(s ? lx : lx + lw - 2, 4, 2, 44, '#2E3858');
    }
    /* the gap, and the weather pouring out of it onto the stones */
    P.r(cx - 9, 4, 18, 44, '#0A1030');
    P.a(0.3); P.r(cx - 12, 3 * T, 25, 10, '#9FB8FF'); P.r(cx - 18, 3 * T + 10, 37, 10, '#6E8CFF'); P.a(0.14); P.r(cx - 26, 3 * T + 20, 53, 14, '#6E8CFF'); P.a(1);
    /* a cold glow on the leaves nearest the gap */
    P.a(0.25); P.r(cx - 14, 4, 5, 44, '#6E8CFF'); P.r(cx + 9, 4, 5, 44, '#6E8CFF'); P.a(1);
    /* runes over the lintel */
    for (i = -3; i <= 3; i++) { P.r(cx + i * 8 - 1, 1, 3, 1, '#4A64A8'); P.px(cx + i * 8, 2, '#9FB8FF'); }
  };
  ANIM.h1 = function (g, o, S, now) {
    /* a vein of lightning crawls across the door's leaves now and
       then: on for 120 ms, once every few seconds */
    var cx = 10 * T + 8, ph = now % 4700;
    if (ph < 120) {
      var side = ((now / 4700) | 0) & 1 ? 1 : -1, x = cx + side * 20, y = 6;
      for (var i = 0; i < 6; i++) { var nx = x + ((hsh(i + ((now / 4700) | 0)) - 0.5) * 8) | 0; W(g, o, S, nx, y, 1, 6, '#C8D8FF'); x = nx; y += 6; }
    }
    /* two cloud wisps drifting under the landing */
    var t = now / 1000;
    for (var k = 0; k < 2; k++) {
      var wx = ((t * (3 + k * 2) + k * 140) % 380) - 40, wy = 150 + k * 12;
      W(g, o, S, wx, wy, 22, 1, '#26325C'); W(g, o, S, wx + 4, wy - 1, 12, 1, '#323E6A');
    }
  };
  PROP.menhir = {
    w: 16, h: 34, ax: 8, ay: 33, shadow: 12,
    paint: function (P) {
      P.r(3, 2, 10, 31, K); P.r(4, 0, 7, 3, K);
      P.r(4, 3, 8, 29, '#2A3048'); P.r(5, 1, 5, 3, '#2A3048'); P.r(4, 3, 2, 29, '#3E4868'); P.r(10, 3, 2, 29, '#1A1E30');
      /* a rune, faintly lit */
      P.r(7, 10, 1, 7, '#4A64A8'); P.r(6, 12, 3, 1, '#4A64A8'); P.px(7, 9, '#9FB8FF');
      P.r(4, 26, 3, 3, '#2E5040'); P.px(5, 25, '#4A7A5A');
    }
  };
  PROP.stormlamp = {
    w: 14, h: 34, ax: 7, ay: 33, shadow: 6,
    light: function () { return { r: 34, col: '#9FB8FF', glow: 0.2, flicker: true }; },
    paint: function (P) {
      P.r(6, 10, 2, 22, K); P.r(6, 10, 1, 22, '#3A4466');
      P.r(3, 31, 8, 2, K);
      P.r(2, 2, 10, 9, K); P.r(3, 3, 8, 7, '#16203A'); P.r(1, 1, 12, 2, '#2E3858'); P.r(4, 0, 6, 1, K);
      P.r(5, 5, 4, 4, '#6E8CFF'); P.r(6, 6, 2, 2, '#DDE6FF');
    },
    anim: function (g, x, y, S, now) {
      if (still()) return;
      var f = ((now / 120) | 0) % 3;
      g.fillStyle = f ? '#C8D8FF' : '#9FB8FF';
      g.fillRect(x - S, y - (27 + (f === 2 ? 1 : 0)) * S, 2 * S, S);
    }
  };
  PROP.rubble = {
    w: 18, h: 8, ax: 9, ay: 7, shadow: 0,
    paint: function (P) {
      P.r(1, 3, 6, 4, K); P.r(2, 3, 4, 3, '#2A3048'); P.r(2, 3, 4, 1, '#3E4868');
      P.r(8, 1, 8, 6, K); P.r(9, 1, 6, 5, '#2A3048'); P.r(9, 1, 6, 1, '#3E4868');
      P.r(6, 5, 3, 2, '#1A1E30');
    }
  };
  PROP.rod = {
    w: 12, h: 40, ax: 6, ay: 39, shadow: 4,
    paint: function (P) {
      P.r(5, 0, 2, 37, K); P.r(5, 0, 1, 37, '#8A92A8');
      for (var i = 12; i < 30; i += 3) { P.r(3, i, 6, 1, '#C08A4A'); }
      P.r(2, 36, 8, 3, K); P.r(3, 36, 6, 1, '#3A4466');
    },
    anim: function (g, x, y, S, now) {
      if (still()) return;
      if ((now % 2900) < 90) { g.fillStyle = '#DDE6FF'; g.fillRect(x - 2 * S, y - 41 * S, S, 2 * S); g.fillRect(x + S, y - 42 * S, S, 2 * S); }
    }
  };

  /* ══ H2 — the biggest room in the world ═════════════════════════
     A concrete floor that runs out of light before it runs out of
     floor. The only light is the machine's: a cold pool, and then the
     dark stepping in, ring by ring, to black at the walls. When you
     have punched it six times it turns its light off and the pool goes
     with it. */
  function machineOff() { var s = save(); return !!(s && (s.flag('punches') || 0) >= 6); }
  STATE.h2 = function () { return machineOff() ? 'off' : 'on'; };
  PAINT.h2 = function (P, room, st) {
    var Wd = room.w * T, Hd = room.h * T, x, y, i;
    var cx = 15 * T + 8, cy = 8 * T + 8, off = st === 'off';
    /* the slab: 32px pours, expansion joints, stains */
    for (y = 0; y < Hd; y += 32) for (x = 0; x < Wd; x += 32) {
      var k = hsh(x * 3 + y * 7);
      P.r(x, y, 32, 32, k > 0.5 ? '#262A36' : '#22262F');
      P.r(x, y, 32, 1, '#1A1D26'); P.r(x, y, 1, 32, '#1A1D26');
      P.dith4(x + 1, y + 1, 31, 31, '#2A2E3A', (x / 32) & 1);
      if (k > 0.7) { P.a(0.5); P.oval(x + 8 + ((k * 14) | 0), y + 16, 6, 3, '#1A1C24'); P.a(1); }
      if (k < 0.15) P.line(x + 4, y + 6, x + 14, y + 12, '#1A1D26');
    }
    /* painted floor markings: a yellow walkway from the hatch to the machine */
    for (y = cy + 18; y < Hd - T; y += 8) { P.r(cx - 14, y, 2, 4, '#8A7A2A'); P.r(cx + 13, y, 2, 4, '#8A7A2A'); }
    for (x = cx - 16; x < cx + 17; x += 6) P.r(x, cy + 14, 3, 2, '#8A7A2A');
    /* the walls: corrugated steel, barely there */
    P.r(0, 0, Wd, 2 * T, '#0C0E14');
    for (x = 0; x < Wd; x += 4) { P.r(x, 4, 2, 2 * T - 6, '#141822'); }
    P.r(0, 2 * T - 2, Wd, 2, '#06070A');
    P.r(0, 2 * T, T, Hd, '#0A0C10'); P.r(Wd - T, 2 * T, T, Hd, '#0A0C10');
    P.r(0, Hd - T, Wd, T, '#0A0C10');
    /* the hatch's alcove in the south wall */
    P.r(15 * T, Hd - T, T, T, '#1A1D26'); P.r(15 * T - 2, Hd - T, 2, T, '#2A2E3A'); P.r(16 * T, Hd - T, 2, T, '#2A2E3A');
    /* the machine's pool */
    if (!off) {
      P.a(0.1); P.oval(cx, cy + 4, 70, 46, '#9FE0FF');
      P.a(0.1); P.oval(cx, cy + 4, 46, 30, '#9FE0FF');
      P.a(0.12); P.oval(cx, cy + 4, 26, 16, '#C8F0FF'); P.a(1);
    }
    /* the dark: stepped rings closing in from the walls (decision 4 of
       engine-look: light has hard edges) */
    var R = off ? [60, 90, 120, 150, 185] : [96, 126, 156, 186, 220];
    for (i = 0; i < R.length; i++) {
      P.a(0.2);
      var rr = R[i];
      for (y = 0; y < Hd; y += 2) {
        var dy = (y + 1 - cy) / 0.75;
        var span = rr * rr - dy * dy;
        if (span <= 0) { P.r(0, y, Wd, 2, '#020306'); continue; }
        var hw = Math.round(Math.sqrt(span));
        if (cx - hw > 0) P.r(0, y, cx - hw, 2, '#020306');
        if (cx + hw < Wd) P.r(cx + hw, y, Wd - cx - hw, 2, '#020306');
      }
    }
    P.a(1);
  };
  ANIM.h2 = function (g, o, S, now) {
    if (machineOff()) return;
    /* a moth, circling the only light in the world */
    var t = now / 1000, cx = 15 * T + 8, cy = 8 * T - 18;
    var mx = cx + Math.round(Math.cos(t * 1.7) * 14 + Math.sin(t * 4.3) * 2), my = cy + Math.round(Math.sin(t * 1.7) * 6);
    var wing = ((now / 60) | 0) & 1;
    W(g, o, S, mx, my, 1, 1, '#C8C0B0');
    W(g, o, S, mx - 1, my - wing, 1, 1, '#8A8478'); W(g, o, S, mx + 1, my - wing, 1, 1, '#8A8478');
  };
  NPCART.vending = {
    w: 32, h: 50, ax: 16, ay: 48, shadow: 22,
    key: function () { var s = save(); return String(Math.min(6, (s && s.flag('punches')) || 0)); },
    light: function () { return machineOff() ? { r: 16, col: '#3A4A7A', glow: 0.05 } : { r: 66, col: '#9FE0FF', glow: 0.22 }; },
    paint: function (P) {
      var n = Math.min(6, ((save() && save().flag('punches')) || 0)), off = n >= 6;
      /* the cabinet */
      P.r(1, 2, 30, 46, K);
      P.r(2, 3, 28, 44, '#2E3E6E'); P.r(2, 3, 28, 2, '#4A5E9E'); P.r(2, 3, 2, 44, '#3A4E86'); P.r(28, 3, 2, 44, '#1E2A4E');
      P.r(4, 0, 24, 4, K); P.r(5, 1, 22, 2, off ? '#1A2238' : '#9FE0FF');                 /* the header light */
      /* the glass, the spirals, and slot D4 */
      P.r(4, 6, 18, 28, K); P.r(5, 7, 16, 26, off ? '#0A1020' : '#123A4E');
      for (var r = 0; r < 4; r++) {
        P.r(5, 12 + r * 6, 16, 1, '#4A5E9E');
        for (var c = 0; c < 4; c++) {
          var x = 6 + c * 4, y = 9 + r * 6;
          var d4 = r === 3 && c === 3;
          if (d4) continue;
          if (r === 3 && c === 0) continue;   /* the one empty slot that was always empty */
          P.r(x, y, 3, 3, ['#C2405F', '#E4C46A', '#6A9A5A', '#B892FF'][(r + c) & 3]);
        }
      }
      /* Deez Nutz: hanging on, then not */
      if (n < 6) {
        var lean = n >= 3 ? 1 : 0, drop = n >= 5 ? 1 : 0;
        P.r(18 + lean, 27 + drop, 3, 4, '#B07A3A'); P.r(18 + lean, 27 + drop, 3, 1, '#E4C46A');
      } else { P.r(7, 42, 14, 3, '#B07A3A'); P.r(7, 42, 14, 1, '#E4C46A'); }
      if (!off) { P.a(0.25); P.r(5, 7, 16, 26, '#9FE0FF'); P.a(1); P.line(6, 8, 12, 14, '#D8F6FF'); }
      /* keypad, coin slot (useless), tray */
      P.r(23, 8, 5, 16, K); P.r(24, 9, 3, 3, off ? '#1A2238' : '#4ADE80');
      for (var k = 0; k < 6; k++) P.r(24 + (k & 1) * 2, 13 + (k >> 1) * 3, 1, 2, '#C8C0B0');
      P.r(24, 22, 3, 1, '#0A0C14');
      P.r(4, 37, 24, 8, K); P.r(5, 38, 22, 6, '#0A0E1A'); P.r(5, 38, 22, 1, '#3A4E86');
      /* dents: one per punch */
      var dents = [[8, 46], [24, 30], [14, 46], [3, 20], [27, 40], [10, 4]];
      for (k = 0; k < n; k++) { P.r(dents[k][0], dents[k][1] - 1, 3, 1, '#1A2448'); P.px(dents[k][0] + 1, dents[k][1], '#5A6EAA'); }
      P.r(3, 47, 26, 1, '#0A0C14');
    },
    anim: function (g, x, y, S, now) {
      /* the hum: a scan line creeping down the glass */
      if (still() || machineOff()) return;
      var k = ((now / 90) | 0) % 26;
      g.globalAlpha = 0.25; g.fillStyle = '#D8F6FF';
      g.fillRect(x - 11 * S, y + (k - 41) * S, 16 * S, S);
      g.globalAlpha = 1;
    }
  };
  PROP.aframe = {
    w: 18, h: 22, ax: 9, ay: 21, shadow: 10,
    paint: function (P) {
      P.line(2, 21, 7, 1, K); P.line(16, 21, 11, 1, K);
      P.r(3, 2, 12, 16, K); P.r(4, 3, 10, 14, '#E4C46A');
      for (var i = 0; i < 10; i += 4) P.line(4 + i, 3, 4 + i + 3, 6, '#1A1A1A');
      P.text('OUT', 5, 8, '#1A1420'); P.r(5, 14, 8, 1, '#1A1420');
    }
  };
  PROP.mbin = {
    w: 14, h: 18, ax: 7, ay: 17, shadow: 8,
    paint: function (P) {
      P.r(2, 3, 10, 14, K); P.r(3, 4, 8, 12, '#3A4A3A'); P.r(3, 4, 8, 1, '#5A6A5A'); P.r(1, 2, 12, 2, K);
      for (var i = 0; i < 3; i++) P.r(4 + i * 3, 6, 1, 9, '#2A3A2A');
      P.r(5, 1, 4, 2, '#E8DCC8');                     /* a wrapper. not yours. */
    }
  };
  PROP.crate2 = {
    w: 18, h: 18, ax: 9, ay: 17, shadow: 14,
    paint: function (P, e) {
      P.r(1, 2, 16, 15, K); P.r(2, 3, 14, 13, '#4A3A2A'); P.r(2, 3, 14, 1, '#6A5232');
      P.line(2, 4, 15, 15, '#3A2A1A'); P.line(15, 4, 2, 15, '#3A2A1A');
      if (!e.k) P.text('D4', 5, 7, '#8A7A4A');
    }
  };
  PROP.pillar = {
    w: 22, h: 70, ax: 11, ay: 69, shadow: 16,
    paint: function (P) {
      /* concrete, rising into the dark until you lose it */
      P.r(3, 0, 16, 64, '#1A1D26'); P.r(4, 0, 4, 64, '#262A36'); P.r(15, 0, 3, 64, '#12141C');
      for (var y = 0; y < 30; y += 2) { P.a(1 - y / 30); P.r(2, y, 18, 2, '#020306'); }
      P.a(1);
      P.r(1, 62, 20, 6, K); P.r(2, 62, 18, 5, '#22262F'); P.r(2, 62, 18, 1, '#2E3240');
      for (y = 40; y < 62; y += 5) P.r(4, y, 14, 1, '#14161E');
    }
  };
  PROP.coin = {
    w: 8, h: 6, ax: 4, ay: 5, shadow: 0,
    paint: function (P) { P.oval(4, 3, 3, 2, K); P.oval(4, 3, 2, 1, '#E4C46A'); P.px(3, 2, '#FFF2C4'); }
  };

  /* ══ H3 — the trip ══════════════════════════════════════════════
     Painted to land AFTER body.is-trip's hue-rotate(75deg): blues come
     out magenta, greens come out teal, pinks come out amber, reds gold.
     The floor rings out from the pot like a dropped stone; under
     reduced motion the rings hold still (and the filter is milder). */
  /* body.is-trip turns the canvas with hue-rotate(75deg) (style.css).
     Painted straight, the room's blues and violets come out of that as
     a wall of red. So while the filter is on, everything static here is
     run once through the INVERSE of the CSS hue-rotate matrix: what
     reaches the eye is the palette below, the one reduced motion (whose
     filter only saturates) sees as is. A repaint follows the class. */
  function tripOn() {
    return !still() && typeof document !== 'undefined' && !!document.body &&
           !!document.body.classList && document.body.classList.contains('is-trip');
  }
  var HR = (function () {
    var a = -75 * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return [0.213 + 0.787 * c - 0.213 * s, 0.715 - 0.715 * c - 0.715 * s, 0.072 - 0.072 * c + 0.928 * s,
            0.213 - 0.213 * c + 0.143 * s, 0.715 + 0.285 * c + 0.140 * s, 0.072 - 0.072 * c - 0.283 * s,
            0.213 - 0.213 * c - 0.787 * s, 0.715 - 0.715 * c + 0.715 * s, 0.072 + 0.928 * c + 0.072 * s];
  })();
  function cl(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }
  function unturn(g, w, h) {
    if (!tripOn() || !g.getImageData) return;
    var im;
    try { im = g.getImageData(0, 0, w, h); } catch (err) { return; }
    var d = im.data;
    for (var i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      var r = d[i], gg = d[i + 1], b = d[i + 2];
      d[i] = cl(HR[0] * r + HR[1] * gg + HR[2] * b);
      d[i + 1] = cl(HR[3] * r + HR[4] * gg + HR[5] * b);
      d[i + 2] = cl(HR[6] * r + HR[7] * gg + HR[8] * b);
    }
    g.putImageData(im, 0, 0);
  }
  var turned = {};
  /* one colour through the same matrix, for the per-frame overlays */
  function tc(c) {
    if (!tripOn()) return c;
    var t = turned[c];
    if (t) return t;
    var A = hx(c);
    var out = '#', v = [HR[0] * A[0] + HR[1] * A[1] + HR[2] * A[2], HR[3] * A[0] + HR[4] * A[1] + HR[5] * A[2], HR[6] * A[0] + HR[7] * A[1] + HR[8] * A[2]];
    for (var i = 0; i < 3; i++) { var h2 = Math.round(cl(v[i])).toString(16); out += h2.length < 2 ? '0' + h2 : h2; }
    turned[c] = out;
    return out;
  }
  STATE.h3 = function () { return tripOn() ? 'trip' : 'plain'; };
  POST.h3 = function (g, w, h) { unturn(g, w, h); };
  function tripKey(e) { return (tripOn() ? 't' : 'n') + (e.k || 0); }

  var RINGS = ['#1A1460', '#3A1A8A', '#0E5A5A', '#5A1A9A', '#1A1460', '#2A4AA0', '#0E5A5A', '#3A1A8A'];
  PAINT.h3 = function (P, room) {
    var Wd = room.w * T, Hd = room.h * T, x, y, i;
    var cx = 10 * T + 8, cy = 5 * T + 8;
    /* the rings, outermost first */
    for (i = 14; i >= 0; i--) {
      var rx = 10 + i * 14, ry = Math.round(rx * 0.62);
      P.oval(cx, cy, rx, ry, RINGS[i % RINGS.length]);
    }
    /* a dither over every other ring, so the bands shimmer even still */
    for (y = 2 * T; y < Hd - T; y += 1) for (x = T + ((y & 1) ? 0 : 2); x < Wd - T; x += 4) {
      var dx = (x - cx), dy = (y - cy) / 0.62, rr = Math.sqrt(dx * dx + dy * dy);
      if (((rr / 14) | 0) & 1) P.px(x, y, '#2A1A7A');
    }
    /* spots, like the mushrooms dropped them */
    for (i = 0; i < 40; i++) {
      var sx = T + ((hsh(i * 3) * (Wd - 2 * T)) | 0), sy = 2 * T + ((hsh(i * 7 + 1) * (Hd - 3 * T)) | 0);
      P.oval(sx, sy, 2, 1, i & 1 ? '#3AA05A' : '#E8E0FF');
    }
    /* the walls: wallpaper that has started to melt */
    P.r(0, 0, Wd, 2 * T, '#140A3A');
    for (x = 0; x < Wd; x += 12) {
      P.oval(x + 6, 12, 4, 4, '#2A1A7A'); P.oval(x + 6, 12, 2, 2, '#3AA05A'); P.px(x + 6, 12, '#E8E0FF');
      var drip = 4 + ((hsh(x) * 12) | 0);
      P.r(x + 2, 22, 2, drip, '#2A1A7A'); P.r(x + 2, 22 + drip, 2, 1, '#3A2A9A');
    }
    P.r(0, 2 * T - 2, Wd, 2, '#06041A');
    P.a(0.4); P.r(T, 2 * T, Wd - 2 * T, 4, '#000000'); P.a(1);
    P.r(0, 2 * T, T, Hd, '#0E0828'); P.r(Wd - T, 2 * T, T, Hd, '#0E0828'); P.r(0, Hd - T, Wd, T, '#0E0828');
    P.r(T - 1, 2 * T, 1, Hd - 3 * T, '#3A2A9A'); P.r(Wd - T, 2 * T, 1, Hd - 3 * T, '#3A2A9A'); P.r(T, Hd - T, Wd - 2 * T, 1, '#3A2A9A');
    /* SOUP, written on the wall in letters that are slightly too tall */
    var word = 'SOUP', tx = cx - 15;
    for (i = 0; i < 4; i++) {
      var gl = FONT[word.charAt(i)];
      for (var j = 0; j < 15; j++) if (gl.charAt(j) === '1') P.r(tx + i * 8 + (j % 3) * 2, 4 + ((j / 3) | 0) * 3, 2, 3, '#E85AC8');
    }
    /* the fire's glow on the floor round the pot */
    pool(P, cx, cy + 6, 40, 18, '#E85AC8', 0.16);
  };
  ANIM.h3 = function (g, o, S, now) {
    /* one bright ring travelling out from the pot every 2.4 s */
    var cx = 10 * T + 8, cy = 5 * T + 8, k = (now % 2400) / 2400;
    var rx = 12 + k * 150, ry = rx * 0.62, n = Math.round(rx * 0.7);
    g.fillStyle = tc('#7A5ADA');
    g.globalAlpha = 0.7 * (1 - k);
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2, x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry);
      if (y < 2 * T || y >= 9 * T || x < T || x >= 20 * T) continue;
      g.fillRect(o.x + x * S, o.y + y * S, 2 * S, S);
    }
    g.globalAlpha = 1;
  };
  NPCART.pot = {
    w: 44, h: 40, ax: 22, ay: 38, shadow: 0, key: tripKey, post: unturn,
    light: function () {
      var five = NEU.mushrooms && NEU.mushrooms() >= 5;
      return five ? { r: 56, col: '#FF8AA0', glow: 0.26, flicker: true } : { r: 40, col: '#E85AC8', glow: 0.18, flicker: true };
    },
    paint: function (P) {
      /* the fire under it */
      P.r(8, 33, 28, 5, '#2A1460'); for (var i = 10; i < 34; i += 5) P.line(i, 37, i + 3, 33, '#4A2A1A');
      /* the pot: huge, black-iron, rim lit pink by the fire */
      P.oval(22, 22, 19, 12, K); P.oval(22, 22, 18, 11, '#1E1A30'); P.oval(18, 19, 8, 5, '#2E2848');
      P.r(4, 9, 36, 5, K); P.r(5, 10, 34, 3, '#3A3458'); P.r(5, 10, 34, 1, '#6A5A9A');
      P.r(2, 12, 4, 6, K); P.r(38, 12, 4, 6, K); P.r(3, 13, 2, 3, '#3A3458'); P.r(39, 13, 2, 3, '#3A3458');
      /* the soup: whatever colour soup is, here */
      P.oval(22, 10, 15, 2, '#3AA05A'); P.r(12, 9, 6, 1, '#7ADE8A');
      P.r(9, 33, 4, 4, K); P.r(31, 33, 4, 4, K);
    },
    anim: function (g, x, y, S, now) {
      var st = still(), t = now / 1000, i;
      /* flames */
      var f = st ? 1 : ((now / 100) | 0) % 3;
      for (i = 0; i < 5; i++) {
        var fx = x + (-12 + i * 6) * S, h = 3 + ((i + f) % 3);
        g.fillStyle = tc('#E85AC8'); g.fillRect(fx, y - (5 + h) * S, 3 * S, h * S);
        g.fillStyle = tc('#FFE0F8'); g.fillRect(fx + S, y - (4 + h - 1) * S, S, 2 * S);
      }
      if (st) return;
      /* bubbles on the soup, steam above */
      for (i = 0; i < 3; i++) {
        var ph = (t * 0.9 + i * 0.37) % 1, bx = x + (-8 + i * 7) * S;
        if (ph < 0.3) { g.fillStyle = tc('#7ADE8A'); g.fillRect(bx, y - 29 * S, 2 * S, S); }
        var sy = y - (32 + ph * 18) * S, sx = bx + Math.round(Math.sin(t * 2 + i) * 2) * S;
        g.globalAlpha = 0.5 * (1 - ph); g.fillStyle = tc('#E8E0FF'); g.fillRect(sx, sy, 2 * S, 2 * S); g.globalAlpha = 1;
      }
    }
  };
  var SHROOM = [['#2A6ADA', '#E8E0FF'], ['#3AA05A', '#E8E0FF'], ['#E85AC8', '#FFF2C4'], ['#5A3ADA', '#9FE0FF']];
  PROP.bigshroom = {
    w: 36, h: 44, ax: 18, ay: 43, shadow: 18, key: tripKey, post: unturn,
    paint: function (P, e) {
      var c = SHROOM[(e.k || 0) % 4];
      /* stem */
      P.r(12, 22, 12, 21, K); P.r(13, 22, 10, 20, '#D8D0F0'); P.r(13, 22, 3, 20, '#F4F0FF'); P.r(20, 22, 3, 20, '#A89EC8');
      P.r(10, 40, 16, 3, K);
      /* gills, then cap */
      P.oval(18, 20, 15, 4, '#8A7AB0');
      P.oval(18, 14, 17, 12, K); P.oval(18, 13, 16, 11, c[0]);
      P.r(2, 18, 33, 5, K); P.r(3, 18, 31, 3, mixc(c[0], '#000000', 0.3));
      P.oval(13, 8, 5, 3, mixc(c[0], '#FFFFFF', 0.3));
      /* spots */
      var sp = [[9, 11, 3], [22, 6, 2], [27, 13, 3], [16, 15, 2], [6, 16, 1]];
      for (var i = 0; i < sp.length; i++) P.oval(sp[i][0], sp[i][1], sp[i][2], sp[i][2] - (sp[i][2] > 1 ? 1 : 0), c[1]);
      /* a face. it is pleased you came. */
      P.px(15, 30, K); P.px(20, 30, K); P.r(16, 33, 4, 1, K);
    }
  };
  PROP.tinyshroom = {
    w: 10, h: 12, ax: 5, ay: 11, shadow: 4, key: tripKey, post: unturn,
    paint: function (P, e) {
      var c = SHROOM[(e.k || 0) % 4];
      P.r(3, 6, 4, 5, K); P.r(4, 6, 2, 5, '#E8E0FF');
      P.oval(5, 4, 4, 3, K); P.oval(5, 4, 3, 2, c[0]); P.px(4, 3, c[1]); P.px(7, 4, c[1]);
    }
  };
  PROP.spoon = {
    w: 10, h: 26, ax: 5, ay: 25, shadow: 0,
    paint: function () {},
    anim: function (g, x, y, S, now, e) {
      /* a spoon, hovering, ready */
      var b = still() ? 0 : Math.round(Math.sin(now / 600 + (e.k || 0) * 2) * 2);
      var yy = y - (16 + b) * S;
      g.fillStyle = K; g.fillRect(x - 3 * S, yy - 6 * S, 6 * S, 6 * S); g.fillRect(x - S, yy, 2 * S, 9 * S);
      g.fillStyle = tc('#C8C0E0'); g.fillRect(x - 2 * S, yy - 5 * S, 4 * S, 4 * S); g.fillRect(x, yy, S, 8 * S);
      g.fillStyle = '#FFFFFF'; g.fillRect(x - S, yy - 4 * S, S, S);
      g.globalAlpha = 0.3; g.fillStyle = '#000000'; g.fillRect(x - 2 * S, y - S, 4 * S, S); g.globalAlpha = 1;
    }
  };


  /* public: rooms-g registers its looks through this */
  NEU.lookPrize = {
    PAINT: PAINT, STATE: STATE, ANIM: ANIM, PROP: PROP, NPCART: NPCART,
    pen: pen, glyphs: glyphs, textW: textW, cells: cells, cellAt: cellAt, solidIn: solidIn,
    W: W, hsh: hsh, still: still, flagged: flagged, K: K, T: T,
    /* dev: drop every cached canvas (after editing art live) */
    flush: function () { SPR = {}; roomCache = {}; },
    get cached() { return { sprites: Object.keys(SPR).length, rooms: Object.keys(roomCache).length }; }
  };
})();
