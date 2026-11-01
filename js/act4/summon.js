/* summon.js — b8_arena, the hall where Supreme Calamitas is summoned.
   ───────────────────────────────────────────────────────────────────
   The room itself is data in rooms-a.js. This file is everything that
   makes it read as "the hardest thing in the game is about to happen":

     the look     two entity kinds the engine draws like any other —
                  scalfloor (the hex circle, bloodstone cracks: floor
                  paint, under everything) and scalprop (altar, broken
                  columns, brimstone braziers, chains, skulls, vents).
                  All procedural integer fillRects, plus her own
                  BrimstoneHeart and SupremeCalamitasHooded sheets.
     the dread    walking toward the altar ramps a heartbeat, a tremor,
                  the red rim on the screen, the ember speed and the
                  brazier light, and ducks the music.
     the summon   pressing the altar runs a ~9 s scene on a fixed
                  timeline: four rings of the circle catch one by one,
                  six brimstone pillars erupt, the room goes black, an
                  eye opens, her silhouette rises in a ring of fire, she
                  speaks (NEU.talk, her portrait), one white-red flash,
                  and then the SAME fight entry the old door used:
                  c.leave() + NEU.scal.open().
     the after    once she is dead the altar is cold, the circle is
                  cracked through and nothing is summoned again.

   Skippable with X once it has been seen (save flag scal_summon_seen).
   Reduced motion / no-shake / no-flash: no shake at all, no flash —
   fades instead, nothing rises, embers hold still.

   Screen effects that must sit ABOVE the room's light layer (embers,
   the vignette, the dark, the eye, her) go on one overlay canvas
   inside #eng, so the z-index ladder is the engine's own: above the
   room, below the textbox and every dialog. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var KK = NEU.engineKinds;
  if (!KK) return;

  var TILE = 16, ROOM = 'b8_arena';
  /* the circle's centre in world px: the middle of the altar block */
  var CX = 10.5 * TILE, CY = 6.25 * TILE;
  var RX = 60, RY = 45;                      /* outer ring; the floor is seen at 3/4 */
  var BASE_DARK = 150, SUMMON_DARK = 34;

  /* timeline, ms from the press */
  var RING_T = [400, 1100, 1800, 2500];
  var ERUPT_T = 3000, ERUPT_STEP = 120;
  var DARK_T = 4100, DARK_LEN = 1000;
  var EYE_T = 5100, EYE_LEN = 900;
  var RISE_T = 6400, RISE_LEN = 1800;
  var TALK_T = 8600, FLASH_LEN = 450, FADE_LEN = 700;
  var LINES = ['"you came all the way down here."',
               '"sit down. this will take a while."',
               '"do not die. i want the whole fight."'];

  var api = null;          /* the room hook API while we are in b8 */
  var near = 0;            /* 0..1, how close the player is to the altar */
  var run = null;          /* the summoning in progress */
  var dbg = { starts: 0, rings: 0, ringOrder: [], erupted: 0, dark: 0, eye: 0, rise: 0,
              shakes: 0, flashes: 0, fades: 0 };
  var origin = { x: 0, y: 0, S: 3 };   /* world (0,0) on screen, from the last floor draw */

  function L() { return NEU.engineLook; }
  function save() { return NEU.save; }
  var forceDead = null;   /* tests only */
  function dead() { return forceDead !== null ? forceDead : !!(save() && save().flagged('scal_dead')); }
  function seen() { return !!(save() && save().flagged('scal_summon_seen')); }
  function J() { return NEU.juice || {}; }
  function noShake() { var j = J(); return !NEU.juice || !!j.reduced || !!j.noShake; }
  function noFlash() { var j = J(); return !NEU.juice || !!j.reduced || !!j.noFlash; }
  function still() { var j = J(); return !!j.reduced; }
  function sfx(n, a) { if (NEU.sfx && NEU.sfx[n]) return NEU.sfx[n](a); return null; }
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function tboxOpen() { return !!(NEU.tboxOpen && NEU.tboxOpen()); }
  function shake(amt) {
    if (noShake()) return;
    dbg.shakes++;
    NEU.juice.hit('small', { shake: amt });
  }
  /* time on the summoning's own clock, or 0 */
  function T() { return run ? run.t : 0; }
  function ringsLit() { return dead() ? 0 : dbg.rings * (run ? 1 : 0); }
  function erupted() { return run ? dbg.erupted : 0; }

  /* how close a world point is to the altar's front, 0 (door) .. 1 */
  function prox(x, y) {
    var dx = x - CX, dy = y - (CY + 12);
    return clamp(1 - (Math.sqrt(dx * dx + dy * dy) - 24) / (8 * TILE));
  }

  /* ── colour ─────────────────────────────────────────────────────── */
  var HEXC = {}, H2 = [];
  for (var hi = 0; hi < 256; hi++) H2.push((hi < 16 ? '0' : '') + hi.toString(16));
  function hex(c) {
    return HEXC[c] || (HEXC[c] = [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]);
  }
  function mix(a, b, k) {
    var A = hex(a), B = hex(b);
    k = clamp(k);
    return '#' + H2[Math.round(A[0] + (B[0] - A[0]) * k)] + H2[Math.round(A[1] + (B[1] - A[1]) * k)] +
                 H2[Math.round(A[2] + (B[2] - A[2]) * k)];
  }
  /* a slow pulse, ~1 Hz at full dread: a heartbeat, never a strobe */
  function pulse(now, rate) { return still() ? 0.5 : 0.5 + 0.5 * Math.sin(now / 1000 * Math.PI * 2 * (rate || 0.6)); }
  /* deterministic per-thing noise, so nothing shimmers between frames */
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  /* ── pixel helpers: world px in, screen rects out ──────────────── */
  function P(g, ox, oy, S, x, y, w, h, col) {
    g.fillStyle = col;
    g.fillRect(ox + Math.round(x) * S, oy + Math.round(y) * S, (w || 1) * S, (h || 1) * S);
  }
  function ellipse(g, ox, oy, S, cx, cy, rx, ry, col, gap) {
    var n = Math.round(Math.PI * 2 * Math.max(rx, ry)), lx = null, ly = null;
    g.fillStyle = col;
    for (var i = 0; i < n; i++) {
      if (gap && gap(i / n)) continue;
      var a = i / n * Math.PI * 2;
      var x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry);
      if (x === lx && y === ly) continue;
      lx = x; ly = y;
      g.fillRect(ox + x * S, oy + y * S, S, S);
    }
  }
  function line(g, ox, oy, S, x0, y0, x1, y1, col, gap) {
    var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
    g.fillStyle = col;
    for (var i = 0; i <= n; i++) {
      if (gap && gap(i / (n || 1))) continue;
      var k = n ? i / n : 0;
      g.fillRect(ox + Math.round(x0 + (x1 - x0) * k) * S, oy + Math.round(y0 + (y1 - y0) * k) * S, S, S);
    }
  }
  /* the screen position of world (0,0), from an entity's draw context */
  function orig(e, d) {
    return { x: d.sx - (e.x + 0.5) * TILE * d.S, y: d.sy - (e.y + 1) * TILE * d.S };
  }

  /* ── baked layers ───────────────────────────────────────────────────
     PERF. Everything in this room's STATIC paint (the circle, the
     cracks, the altar's stone, the columns, the brazier stands) used to
     be re-issued every frame as procedural fillRects: ~3300 draw calls a
     frame in total, 1700 of them for the circle alone. Each piece is now
     painted ONCE into a small canvas at 1 canvas px per world px (no
     scale in the key, so a resize or a new S costs nothing) and blitted
     with nearest-neighbour scaling, which lands on exactly the pixels
     the fillRects did.

     HOW TO ADD STATIC PAINT (art agents: start here):
       1. write a painter  function (g, ox, oy, S, col)  using the P /
          ellipse / line helpers or plain fillRect on  ox + x*S ;
       2. bake it:   var b = bake('my:key', x0, y0, w, h, painter);
          x0,y0,w,h is its box in WORLD px (or entity-relative px for
          props); `bake` runs the painter once with S = 1;
       3. in the draw function:  blit(g, b, originX, originY, S);
          a layer that must change colour: paint it white and use
          tinted(b, colour)  (re-tints only when the colour changes).
     Anything that MOVES or whose shape changes every frame (flames,
     chains, the eruption, embers) stays immediate-mode. If a canvas is
     unavailable bake() returns a layer with no bitmap and blit()
     paints the same thing immediately, so nothing depends on it.
     `NEU.summon._slow = true` forces the immediate path (A/B checks). */
  var bakes = {}, slow = false;
  function mkc(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function bake(key, x0, y0, w, h, paint) {
    var b = bakes[key];
    if (b) return b;
    b = bakes[key] = { cv: null, tin: null, col: null, x0: x0, y0: y0, w: w, h: h, paint: paint };
    try {
      var c = mkc(w, h), x = c.getContext && c.getContext('2d');
      if (x && x.drawImage) { paint(x, -x0, -y0, 1, '#FFFFFF'); b.cv = c; }
    } catch (err) { b.cv = null; }
    return b;
  }
  /* at (ox, oy) = where the layer's (0,0) lands on screen, scale S */
  function blit(g, b, ox, oy, S, col) {
    if (b.cv && !slow) g.drawImage(b.cv, ox + b.x0 * S, oy + b.y0 * S, b.w * S, b.h * S);
    else b.paint(g, ox, oy, S, col || '#FFFFFF');
  }
  /* the layer's mask in `col`, re-tinted only when the colour changes */
  function tinted(b, col) {
    if (!b.cv) return null;
    if (b.col !== col) {
      if (!b.tin) b.tin = mkc(b.w, b.h);
      var t = b.tin.getContext('2d');
      t.globalCompositeOperation = 'copy';
      t.drawImage(b.cv, 0, 0);
      t.globalCompositeOperation = 'source-in';
      t.fillStyle = col; t.fillRect(0, 0, b.w, b.h);
      t.globalCompositeOperation = 'source-over';
      b.col = col;
    }
    return b.tin;
  }
  /* A painter that puts several colours down in a fixed ORDER (the
     cracks: black shadow line, then glow line over it) cannot be split
     into per-colour layers without changing who wins an overlapping
     pixel. Paint it once with one flat role colour per role, read the
     pixels back and keep, per role, only the pixels that survived. */
  function bakeRoles(key, x0, y0, w, h, nRoles, paint) {
    var b = bakes[key];
    if (b) return b;
    b = bakes[key] = { roles: null, x0: x0, y0: y0, w: w, h: h, paint: paint, n: nRoles };
    try {
      var c = mkc(w, h), x = c.getContext && c.getContext('2d');
      if (!x || !x.getImageData) return b;
      var cols = [], i;
      for (i = 0; i < nRoles; i++) cols.push('rgb(' + (i + 1) * 40 + ',0,0)');
      paint(x, -x0, -y0, 1, cols);
      var px = x.getImageData(0, 0, w, h).data, out = [], ctxs = [], ims = [];
      for (i = 0; i < nRoles; i++) {
        out.push(mkc(w, h)); ctxs.push(out[i].getContext('2d')); ims.push(ctxs[i].createImageData(w, h));
      }
      for (var p = 0; p < px.length; p += 4) {
        if (px[p + 3] < 128) continue;
        var r = Math.round(px[p] / 40) - 1;
        if (r < 0 || r >= nRoles) continue;
        var d = ims[r].data;
        d[p] = d[p + 1] = d[p + 2] = 255; d[p + 3] = 255;
      }
      for (i = 0; i < nRoles; i++) ctxs[i].putImageData(ims[i], 0, 0);
      b.roles = out.map(function (cv) { return { cv: cv, tin: null, col: null, w: w, h: h }; });
    } catch (err) { b.roles = null; }
    return b;
  }
  function roleTint(r, col) {
    if (r.col !== col) {
      if (!r.tin) r.tin = mkc(r.w, r.h);
      var t = r.tin.getContext('2d');
      t.globalCompositeOperation = 'copy';
      t.drawImage(r.cv, 0, 0);
      t.globalCompositeOperation = 'source-in';
      t.fillStyle = col; t.fillRect(0, 0, r.w, r.h);
      t.globalCompositeOperation = 'source-over';
      r.col = col;
    }
    return r.tin;
  }

  /* ── the hex circle ─────────────────────────────────────────────── */
  var RUNES = [['111', '101', '111', '100', '100'], ['101', '111', '010', '010', '111'],
               ['110', '010', '011', '010', '110'], ['111', '001', '010', '100', '111'],
               ['010', '111', '010', '101', '101'], ['100', '110', '111', '011', '001']];
  function circleState() { return dead() ? 'cracked' : run ? 'lit' : 'dormant'; }

  /* The circle's box in world px: the outer ring is RX/RY wide, the
     scorch RX+6/RY+4, and the cracked state's break runs from CX-64
     to CX+64 and sags 25px below CY-10. */
  var CBX = CX - 72, CBY = CY - 56, CBW = 144, CBH = 112;
  var GAP_CRACKED = function (t) { return hash(Math.floor(t * 23)) < 0.28; };
  var RY2 = RY - 7, RX2 = RX - 9;
  var P_SCORCH = function (g, ox, oy, S) {
    var r, k;
    for (r = -RY - 4; r <= RY + 4; r += 1) {
      k = 1 - (r * r) / ((RY + 4) * (RY + 4));
      if (k <= 0) continue;
      var hw = Math.round((RX + 6) * Math.sqrt(k));
      g.fillStyle = (r & 3) ? '#14070A' : '#1C0A0E';
      g.fillRect(ox + Math.round(CX - hw) * S, oy + Math.round(CY + r) * S, hw * 2 * S, S);
    }
  };
  /* one painter per ring group; `gap` is only set in the cracked state */
  function circlePainters(gap, st) {
    return {
      glow: function (g, ox, oy, S, c) { ellipse(g, ox, oy, S, CX, CY, RX + 1, RY + 1, c, gap); },
      r0: function (g, ox, oy, S, c) {
        ellipse(g, ox, oy, S, CX, CY, RX, RY, c, gap); ellipse(g, ox, oy, S, CX, CY, RX - 2, RY - 2, c, gap);
      },
      r1: function (g, ox, oy, S, c) { ellipse(g, ox, oy, S, CX, CY, RX2, RY2, c, gap); },
      runes: function (g, ox, oy, S, c) {
        for (var i = 0; i < 12; i++) {
          var a = (i + 0.5) / 12 * Math.PI * 2;
          var gx = Math.round(CX + Math.cos(a) * (RX - 5.5)) - 1, gy = Math.round(CY + Math.sin(a) * (RY - 4.5)) - 2;
          var rn = RUNES[i % RUNES.length];
          if (st === 'cracked' && hash(i + 9) < 0.4) continue;
          for (var ry = 0; ry < 5; ry++) for (var rx = 0; rx < 3; rx++)
            if (rn[ry].charAt(rx) === '1') P(g, ox, oy, S, gx + rx, gy + ry, 1, 1, c);
        }
      },
      star: function (g, ox, oy, S, c) {
        var pts = [], i, a;
        for (i = 0; i < 6; i++) {
          a = -Math.PI / 2 + i * Math.PI / 3;
          pts.push([Math.round(CX + Math.cos(a) * RX2), Math.round(CY + Math.sin(a) * RY2)]);
        }
        for (i = 0; i < 6; i++) {
          var p0 = pts[i], p1 = pts[(i + 2) % 6];
          line(g, ox, oy, S, p0[0], p0[1], p1[0], p1[1], c, gap);
        }
      },
      inner: function (g, ox, oy, S, c) { ellipse(g, ox, oy, S, CX, CY, 24, 17, c, gap); },
      crack: function (g, ox, oy, S, c) {
        var x = CX - RX - 4, y = CY - 10;
        for (var i = 0; i < 16; i++) {
          var nx = x + 8, ny = y + Math.round((hash(i + 3) - 0.5) * 8) + 1;
          line(g, ox, oy, S, x, y, nx, ny, '#060306');
          x = nx; y = ny;
        }
      }
    };
  }
  /* the six ring groups, baked once per state ('cracked' differs from the rest) */
  var CIRC = { cracked: null, normal: null, comp: null, compKey: '', scorch: null };
  function circleLayers(st) {
    var id = st === 'cracked' ? 'cracked' : 'normal';
    if (CIRC[id]) return CIRC[id];
    var pp = circlePainters(id === 'cracked' ? GAP_CRACKED : null, id), L = {}, k;
    for (k in pp) L[k] = bake('circle:' + id + ':' + k, CBX, CBY, CBW, CBH, pp[k]);
    return (CIRC[id] = L);
  }
  /* everything under the hot-core runners, composed into ONE bitmap that
     is rebuilt only when a ring colour changes (every frame while the
     dormant rings pulse on the approach, otherwise never) */
  function circleBitmap(st, cols) {
    var L = circleLayers(st), key = st + '|' + cols.join(',');
    if (CIRC.comp && CIRC.compKey === key) return CIRC.comp;
    if (!L.r0.cv) return null;
    if (!CIRC.scorch) CIRC.scorch = bake('circle:scorch', CBX, CBY, CBW, CBH, P_SCORCH);
    if (!CIRC.comp) CIRC.comp = mkc(CBW, CBH);
    var t = CIRC.comp.getContext('2d');
    t.clearRect(0, 0, CBW, CBH);
    t.globalAlpha = 0.5; t.drawImage(CIRC.scorch.cv, 0, 0); t.globalAlpha = 1;
    var order = ['glow', 'r0', 'r1', 'runes', 'star', 'inner', 'crack'];
    for (var i = 0; i < order.length; i++) {
      if (!cols[i]) continue;
      t.drawImage(tinted(L[order[i]], cols[i]), 0, 0);
    }
    CIRC.compKey = key;
    return CIRC.comp;
  }
  function circleColours(st, lit, now) {
    var beat = pulse(now, 0.4 + near * 0.8);
    var dim = st === 'cracked' ? '#2E2830' : mix('#3A0E14', '#8A1A20', near * (0.4 + 0.6 * beat));
    var hot = '#FF3A22', core = '#FFC890';
    function col(i) { return i < lit ? hot : dim; }
    return [lit > 0 ? '#7A0A0E' : '', col(0), col(1), lit > 1 ? core : col(1), col(2), col(3),
            st === 'cracked' ? '#060306' : ''];
  }
  function drawCircle(g, e, d) {
    var S = d.S, o = orig(e, d), ox = o.x, oy = o.y, now = d.now;
    origin.x = ox; origin.y = oy; origin.S = S;
    var st = circleState(), lit = st === 'lit' ? dbg.rings : 0;
    var cols = circleColours(st, lit, now);
    var bm = slow ? null : circleBitmap(st, cols);
    if (!bm) { drawCircleSlow(g, ox, oy, S, st, lit, cols); }
    else {
      var sm = g.imageSmoothingEnabled;
      g.imageSmoothingEnabled = false;
      g.drawImage(bm, ox + CBX * S, oy + CBY * S, CBW * S, CBH * S);
      if (sm) g.imageSmoothingEnabled = sm;
    }
    /* lit rings carry a hot core that runs round them */
    if (lit > 0 && !still()) {
      var run0 = (now / 6) % 360;
      for (var i = 0; i < 10; i++) {
        var a = (run0 + i * 36) * Math.PI / 180;
        P(g, ox, oy, S, CX + Math.cos(a) * RX, CY + Math.sin(a) * RY, 1, 1, '#FFC890');
      }
    }
  }
  /* the original immediate-mode painter: the fallback with no canvas, and
     the reference the baked bitmap is checked against */
  function drawCircleSlow(g, ox, oy, S, st, lit, cols) {
    var L = circlePainters(st === 'cracked' ? GAP_CRACKED : null, st === 'cracked' ? 'cracked' : 'normal');
    g.globalAlpha = 0.5;
    P_SCORCH(g, ox, oy, S);
    g.globalAlpha = 1;
    if (cols[0]) L.glow(g, ox, oy, S, cols[0]);
    L.r0(g, ox, oy, S, cols[1]);
    L.r1(g, ox, oy, S, cols[2]);
    L.runes(g, ox, oy, S, cols[3]);
    L.star(g, ox, oy, S, cols[4]);
    L.inner(g, ox, oy, S, cols[5]);
    if (cols[6]) L.crack(g, ox, oy, S, cols[6]);
  }

  /* ── bloodstone cracks ─────────────────────────────────────────── */
  /* painter: cols = [shadow, glow]; the black line goes down first, the
     glow line (and its branch) over it, per segment */
  function paintCracks(g, ox, oy, S, cols, e, glowPaint) {
    var seed = e.x * 31 + e.y * 7;
    var x = (e.x + 0.5) * TILE - 10, y = (e.y + 0.5) * TILE;
    for (var i = 0; i < 6; i++) {
      var nx = x + 3 + Math.round(hash(seed + i) * 2), ny = y + Math.round((hash(seed + i + 50) - 0.5) * 6);
      line(g, ox, oy, S, x, y + 1, nx, ny + 1, cols[0]);
      line(g, ox, oy, S, x, y, nx, ny, cols[1]);
      if (hash(seed + i + 90) > 0.6) line(g, ox, oy, S, nx, ny, nx + 2, ny + 3, cols[1]);
      x = nx; y = ny;
    }
  }
  function drawCracks(g, e, d) {
    var S = d.S, o = orig(e, d);
    var glow = dead() ? '#3A1418' : mix('#6A0A10', '#FF3020', 0.25 + near * 0.5 * pulse(d.now, 0.5 + near));
    var bx = Math.floor((e.x + 0.5) * TILE - 10) - 3, by = Math.floor((e.y + 0.5) * TILE) - 26;
    var b = slow ? null : bakeRoles('cracks:' + e.x + ',' + e.y, bx, by, 48, 56, 2,
                                    function (g2, ox, oy, S2, cols) { paintCracks(g2, ox, oy, S2, cols, e); });
    if (!b || !b.roles) { paintCracks(g, o.x, o.y, S, ['#050204', glow], e); return; }
    var sm = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = false;
    g.drawImage(roleTint(b.roles[0], '#050204'), o.x + bx * S, o.y + by * S, 48 * S, 56 * S);
    g.drawImage(roleTint(b.roles[1], glow), o.x + bx * S, o.y + by * S, 48 * S, 56 * S);
    if (sm) g.imageSmoothingEnabled = sm;
  }

  /* ── the altar ─────────────────────────────────────────────────── */
  /* the altar's stone (tiers + the bowl's rim): static, baked once, in
     altar-relative px. The runes, the fire and the heart move/glow. */
  function paintAltarStone(g, x, y, S) {
    function R(px, py, w, h, c) { g.fillStyle = c; g.fillRect(x + px * S, y + py * S, w * S, h * S); }
    /* three stepped tiers of black stone */
    R(-25, -12, 50, 12, '#0B070D');
    R(-24, -11, 48, 3, '#3E3040'); R(-24, -8, 48, 7, '#251A28'); R(-24, -2, 48, 1, '#170F19');
    R(-19, -21, 38, 10, '#0B070D');
    R(-18, -20, 36, 3, '#4A3A4C'); R(-18, -17, 36, 6, '#2C2030');
    R(-13, -29, 26, 9, '#0B070D');
    R(-12, -28, 24, 2, '#5A4A5C'); R(-12, -26, 24, 6, '#33263A');
  }
  function paintAltarBowl(g, x, y, S) {
    function R(px, py, w, h, c) { g.fillStyle = c; g.fillRect(x + px * S, y + py * S, w * S, h * S); }
    R(-9, -31, 18, 3, '#0B070D'); R(-8, -31, 16, 1, '#6A5A6C');
  }
  function drawAltar(g, e, d) {
    var S = d.S, x = d.sx, y = d.sy, now = d.now, cold = dead();
    function R(px, py, w, h, c) { g.fillStyle = c; g.fillRect(x + px * S, y + py * S, w * S, h * S); }
    /* stone first; the runes (drawn after it) never overlap the bowl rim,
       so the bowl rim can sit in the same bitmap */
    blit(g, bake('altar:stone', -26, -32, 52, 33, function (g2, ox, oy, S2) {
      paintAltarStone(g2, ox, oy, S2); paintAltarBowl(g2, ox, oy, S2);
    }), x, y, S);
    /* bloodstone runes cut into the face */
    var rc = cold ? '#2A2028' : mix('#5A0A10', '#FF4A2A', 0.3 + 0.7 * Math.max(near * pulse(now, 0.5 + near), run ? 1 : 0));
    for (var i = 0; i < 7; i++) R(-21 + i * 6, -7 + (i & 1), 2, 3, rc);
    R(-10, -16, 2, 2, rc); R(-1, -17, 2, 3, rc); R(8, -16, 2, 2, rc);
    if (cold) {
      R(-6, -33, 12, 2, '#4A4048'); R(-3, -34, 6, 1, '#5A5058');
      return;
    }
    /* brimstone fire in the bowl: dark core, red, orange, a white tip */
    var w = still() ? 1 : ((now / 90) | 0) % 3, big = run ? 6 : Math.round(near * 4);
    R(-6, -36 - w - big, 12, 5 + w + big, '#B0101A');
    R(-4, -40 - w - big, 8, 7 + w + big, '#FF3A1A');
    R(-2, -43 - w - big, 4, 6 + w, '#FF8A3A');
    R(-1, -44 - w - big, 2, 3, '#FFE6B0');
    R(-2, -35, 4, 3, '#2A0006');
    /* her heart, floating over the flame */
    var sh = NEU.sheets && NEU.sheets.heart;
    if (sh && NEU.sheetDraw) {
      var bob = still() ? 0 : Math.round(Math.sin(now / 420) * 2);
      NEU.sheetDraw(g, 'heart', x, y - (50 + bob + big) * S, { scale: Math.max(1, Math.round(S / 3)), anchor: 'feet', now: now, glow: !!run });
    }
  }

  /* ── broken columns ────────────────────────────────────────────── */
  function paintPillar(g, x, y, S, e) {
    var h = e.h || 28;
    function R(px, py, w, hh, c) { g.fillStyle = c; g.fillRect(x + px * S, y + py * S, w * S, hh * S); }
    R(-8, -6, 16, 6, '#0B070D'); R(-7, -5, 14, 4, '#3A3044');          /* plinth */
    R(-6, -6 - h, 12, h, '#0B070D');
    R(-5, -6 - h, 3, h, '#5A4E68'); R(-2, -6 - h, 5, h, '#3A3048'); R(3, -6 - h, 2, h, '#221A2C');
    for (var f = 0; f < h; f += 7) R(-5, -6 - h + f, 10, 1, '#1A1422');   /* courses */
    /* the break: a jagged top, a chunk fallen at its foot */
    for (var i = 0; i < 6; i++) {
      var jag = Math.round(hash(e.x * 13 + i) * 5);
      R(-6 + i * 2, -7 - h, 2, jag + 1, '#0B070D');
    }
    R(-1, -4 - h + 6, 1, 8, '#120C18'); R(0, -4 - h + 13, 2, 1, '#120C18');
    R(7, -3, 5, 3, '#0B070D'); R(8, -3, 3, 2, '#4A3E58');
    R(-12, -2, 3, 2, '#0B070D'); R(-11, -2, 2, 1, '#4A3E58');
  }
  /* static: the whole column is one baked bitmap per (x, height) */
  function drawPillar(g, e, d) {
    var h = e.h || 28;
    blit(g, bake('pillar:' + e.x + ':' + h, -14, -(h + 14), 28, h + 16, function (g2, ox, oy, S2) {
      paintPillar(g2, ox, oy, S2, e);
    }), d.sx, d.sy, d.S);
  }

  /* ── brimstone braziers ────────────────────────────────────────── */
  function drawBrazier(g, e, d) {
    var S = d.S, x = d.sx, y = d.sy, now = d.now;
    function R(px, py, w, h, c) { g.fillStyle = c; g.fillRect(x + px * S, y + py * S, w * S, h * S); }
    /* the stand and bowl are static: baked; only the flame is live */
    blit(g, bake('brazier:stand', -8, -14, 16, 15, function (g2, ox, oy, S2) {
      function Q(px, py, w, h, c) { g2.fillStyle = c; g2.fillRect(ox + px * S2, oy + py * S2, w * S2, h * S2); }
      Q(-5, -1, 2, 1, '#0B070D'); Q(3, -1, 2, 1, '#0B070D');            /* feet */
      Q(-4, -9, 2, 8, '#1A1420'); Q(2, -9, 2, 8, '#1A1420'); Q(-1, -9, 2, 9, '#2A2232');
      Q(-7, -13, 14, 4, '#0B070D'); Q(-6, -13, 12, 1, '#5A4E68'); Q(-6, -12, 12, 2, '#2E2638');
    }), x, y, S);
    if (dead()) { R(-5, -14, 10, 1, '#4A4048'); return; }
    var f = still() ? 1 : ((now / 80 + e.x) | 0) % 4, up = Math.round(near * 3) + (run ? 3 : 0);
    var wv = [0, 1, 2, 1][f];
    R(-5, -18 - up, 10, 5 + up, '#8A0A14');
    R(-4, -22 - wv - up, 8, 9 + wv + up, '#E0201A');
    R(-3 + (f & 1), -25 - wv - up, 5, 8, '#FF6A2A');
    R(-1, -27 - wv - up, 2, 5, '#FFC27A');
    R(-2, -15, 4, 2, '#2A0006');                                        /* the dark core */
  }

  /* ── chains from the ceiling ───────────────────────────────────── */
  function drawChain(g, e, d) {
    var S = d.S, x = d.sx, len = e.len || 30, top = d.sy - 24 * S;
    var sway = still() ? 0 : Math.sin(d.now / 1300 + e.x) * (1 + near * 2 + (run ? 2 : 0));
    for (var i = 0; i < len; i += 3) {
      var k = i / len, cx = x + Math.round(sway * k) * S, cy = top + i * S;
      g.fillStyle = '#0B070D'; g.fillRect(cx - S, cy, 3 * S, 3 * S);
      g.fillStyle = (i / 3) & 1 ? '#4A4256' : '#6A6078';
      if ((i / 3) & 1) g.fillRect(cx, cy, S, 3 * S);
      else { g.fillRect(cx - S, cy, S, 3 * S); g.fillRect(cx + S, cy, S, 3 * S); }
    }
    /* a broken shackle at the end */
    var ex = x + Math.round(sway) * S, ey = top + len * S;
    g.fillStyle = '#0B070D'; g.fillRect(ex - 3 * S, ey, 6 * S, 4 * S);
    g.fillStyle = '#5A5068'; g.fillRect(ex - 2 * S, ey, 4 * S, S); g.fillRect(ex - 2 * S, ey, S, 3 * S);
  }

  /* ── skull piles ───────────────────────────────────────────────── */
  var SKULL = { rows: ['.kkk.', 'kwwwk', 'kdwdk', 'kwwwk', '.kwk.'],
                pal: { k: '#0B070D', w: '#B8AEA0', d: '#1A1014' } };
  var SKULL_DIM = { k: '#0B070D', w: '#7A7068', d: '#1A1014' };
  function drawSkulls(g, e, d) {
    var S = d.S, seed = e.x * 17 + e.y * 5;
    for (var i = 0; i < 5; i++) {
      var dx = Math.round((hash(seed + i) - 0.5) * 12), dy = -Math.round(hash(seed + i + 20) * 4) - (i > 2 ? 3 : 0);
      L().stamp(g, SKULL.rows, i & 1 ? SKULL_DIM : SKULL.pal, d.sx + dx * S, d.sy + dy * S, S);
    }
    g.fillStyle = '#6A6058';
    g.fillRect(d.sx - 6 * S, d.sy - S, 2 * S, S); g.fillRect(d.sx + 4 * S, d.sy - 2 * S, 3 * S, S);
  }

  /* ── vents and the pillars of brimstone ────────────────────────── */
  function drawVent(g, e, d) {
    var S = d.S, x = d.sx, y = d.sy, now = d.now;
    function R(px, py, w, h, c) { g.fillStyle = c; g.fillRect(x + px * S, y + py * S, w * S, h * S); }
    R(-5, -6, 10, 4, '#0B070D');
    var on = erupted() > (e.n || 0);
    R(-4, -5, 8, 2, dead() ? '#1A1418' : on ? '#FF6A2A' : mix('#2A0608', '#7A1010', near));
    if (!on) return;
    /* the column: tall, wavy, stepped red to white */
    var since = T() - (ERUPT_T + (e.n || 0) * ERUPT_STEP), grow = clamp(since / 240);
    var hgt = Math.round(76 * grow);
    for (var j = 0; j < hgt; j += 2) {
      var wob = still() ? 0 : Math.round(Math.sin(now / 70 + j * 0.3 + e.n) * 1.5);
      var wide = 6 + (j < 8 ? 3 : 0) + ((j / 10) & 1) - (j > hgt - 12 ? 2 : 0);
      R(-wide + wob, -4 - j, wide * 2, 2, '#8A0A14');
      R(-wide + 2 + wob, -4 - j, wide * 2 - 4, 2, '#FF3A1A');
      R(-1 + wob, -4 - j, 2, 2, j % 6 ? '#FFB070' : '#FFF0D0');
    }
  }

  /* ── lights: brimstone red, redder and wider the closer you are ── */
  function lightAt(e, p) {
    if (dead()) return null;
    var boost = run ? 1 : 0;
    if (e.v === 'brazier') return { r: 54 + 30 * p + 20 * boost, col: mix('#FF7A3A', '#FF1A10', p), glow: 0.28 + 0.16 * p, flicker: true };
    if (e.v === 'altar') return { r: 34 + 44 * p + 30 * boost, col: mix('#FF5A2A', '#FF1A10', p), glow: 0.3 + 0.2 * p + 0.2 * boost, flicker: true };
    if (e.v === 'vent') return erupted() > (e.n || 0) ? { r: 70, col: '#FF3A1A', glow: 0.42, flicker: true }
                                                     : (p > 0.3 ? { r: 10 + 10 * p, col: '#8A1010', glow: 0.12 } : null);
    return null;
  }

  KK.kind('scalfloor', {
    interactive: function () { return false; },
    floor: true,
    draw: function (g, e, d) { if (e.v === 'circle') drawCircle(g, e, d); else drawCracks(g, e, d); },
    light: function (e) {
      if (e.v !== 'circle' || dead()) return null;
      var lit = ringsLit();
      if (lit) return { r: 50 + 18 * lit, col: '#FF2A14', glow: 0.14 + 0.05 * lit };
      return near > 0.2 ? { r: 30 * near, col: '#A0101A', glow: 0.1 * near } : null;
    }
  });

  var DRAW = { altar: drawAltar, pillar: drawPillar, brazier: drawBrazier, chain: drawChain,
               skulls: drawSkulls, vent: drawVent };
  KK.kind('scalprop', {
    interactive: function (e) { return typeof e.run === 'function'; },
    fire: function (e, sys) { if (typeof e.run === 'function') e.run(sys.api); },
    draw: function (g, e, d) { var f = DRAW[e.v]; if (f) f(g, e, d); },
    width: function (e) { return e.v === 'altar' ? 30 : e.v === 'pillar' ? 12 : e.v === 'brazier' ? 10 : 0; },
    light: function (e) { return lightAt(e, near); }
  });

  /* ── the overlay: embers, ash, the vignette, and the summoning ─── */
  var cv = null, g = null, raf = 0, lastNow = 0, beatAcc = 0, quakeAcc = 0;
  var embers = [], ash = [];
  function overlayOn() {
    if (cv) return;
    var wrap = document.getElementById('eng');
    if (!wrap) return;
    cv = document.createElement('canvas');
    cv.className = 'summon';
    cv.setAttribute('aria-hidden', 'true');
    wrap.appendChild(cv);
    g = cv.getContext('2d');
    embers = []; ash = [];
    for (var i = 0; i < 46; i++) embers.push(newEmber(true));
    for (i = 0; i < 26; i++) ash.push({ x: Math.random() * 21 * TILE, y: Math.random() * 13 * TILE,
                                        s: Math.random() < 0.3 ? 2 : 1, v: 4 + Math.random() * 6, ph: Math.random() * 6 });
    lastNow = 0;
    raf = requestAnimationFrame(frame);
  }
  function overlayOff() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (cv && cv.parentNode) cv.parentNode.removeChild(cv);
    cv = null; g = null;
  }
  /* embers come off the fires: braziers, the altar, the cracks */
  var SOURCES = [[6.5, 2], [14.5, 2], [5.5, 11], [15.5, 11], [10.5, 4], [10.5, 4], [6.5, 10.5], [15.5, 6.5]];
  function newEmber(spread) {
    var s = SOURCES[(Math.random() * SOURCES.length) | 0];
    return { x: s[0] * TILE + (Math.random() - 0.5) * 10, y: s[1] * TILE + (spread ? -Math.random() * 60 : 0),
             v: 10 + Math.random() * 16, life: 1.5 + Math.random() * 2.5, ph: Math.random() * 6,
             c: Math.random() < 0.2 ? '#FFE0A0' : Math.random() < 0.6 ? '#FF7A2A' : '#FF2A14',
             s: Math.random() < 0.25 ? 2 : 1 };
  }

  function frame(now) {
    raf = 0;
    var eng = NEU.engine;
    if (!eng || !eng.running || eng.room !== ROOM) { abort(); overlayOff(); return; }
    raf = requestAnimationFrame(frame);
    /* the pace cap (perf.js): `lastNow` advances on drawn frames only,
       so dt covers the skipped vsyncs */
    if (NEU.perf && !NEU.perf.paced(now)) return;
    var dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0;
    lastNow = now;
    if (api && !run) dread(dt);
    paint(now, dt);
  }

  /* the approach: heartbeat, tremor, music down */
  function dread(dt) {
    var p = api.player;
    near = dead() ? 0 : prox(p.x, p.y);
    NEU.duckHold = near > 0.4;
    if (near < 0.12) { beatAcc = 0; quakeAcc = 0; return; }
    beatAcc += dt * 1000;
    if (beatAcc >= 1500 - 950 * near) { beatAcc = 0; sfx('heart'); }
    quakeAcc += dt * 1000;
    if (near > 0.35 && quakeAcc >= 700) { quakeAcc = 0; shake(0.08 + 0.22 * near); }
  }

  /* The overlay is drawn at 1 canvas px per CSS px and scaled up by the
     browser (css: image-rendering: pixelated). Everything on it is an
     integer-CSS-px block, so at dpr 2/3 it lands on the same device
     pixels as a native-resolution canvas would, for a quarter to a
     ninth of the fill cost (the vignette alone covers the screen
     several times over). */
  var vig = null, vigKey = '';
  /* the black stepped vignette, cached: it only changes with `near` */
  function vignette(w, h, bw, aStr) {
    var key = w + 'x' + h + ':' + bw + ':' + aStr;
    if (key === vigKey && vig) return vig;
    if (!vig) vig = mkc(w, h);
    if (vig.width !== w || vig.height !== h) { vig.width = w; vig.height = h; }
    var v = vig.getContext('2d');
    v.clearRect(0, 0, w, h);
    v.fillStyle = 'rgba(0,0,0,' + aStr + ')';
    for (var i = 0; i < 10; i++) {
      v.fillRect(0, 0, w, (i + 1) * bw); v.fillRect(0, h - (i + 1) * bw, w, (i + 1) * bw);
      v.fillRect(0, 0, (i + 1) * bw, h); v.fillRect(w - (i + 1) * bw, 0, (i + 1) * bw, h);
    }
    vigKey = key;
    return vig;
  }

  function paint(now, dt) {
    var w = innerWidth, h = innerHeight;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, w, h);
    var S = origin.S, ox = origin.x, oy = origin.y, cold = dead();
    var dk = run ? dbg.dark : 0;
    var i;
    /* the vignette: stepped bands, black, then a red rim that beats */
    var bw = Math.max(4, Math.round(Math.min(w, h) / 64));
    var aStr = ((cold ? 0.035 : 0.06) * (1 + near)).toFixed(3);
    if (slow) {
      for (i = 0; i < 10; i++) {
        g.fillStyle = 'rgba(0,0,0,' + aStr + ')';
        g.fillRect(0, 0, w, (i + 1) * bw); g.fillRect(0, h - (i + 1) * bw, w, (i + 1) * bw);
        g.fillRect(0, 0, (i + 1) * bw, h); g.fillRect(w - (i + 1) * bw, 0, (i + 1) * bw, h);
      }
    } else g.drawImage(vignette(w, h, bw, aStr), 0, 0);
    if (!cold) {
      /* nested bands, each a little more red: a stepped gradient edge.
         Band i is the frame i+1 steps deep, so the ring j steps in has
         been painted (6 - j) times; paint each ring ONCE at the alpha
         those repeats add up to (one pass over the frame, not ~3.5). */
      var rim = (0.03 + 0.1 * near + (run ? 0.1 : 0)) * (0.55 + 0.45 * pulse(now, 0.5 + near * 0.7));
      var ra = parseFloat(rim.toFixed(3));
      for (i = 0; i < 6; i++) {
        var t = (i + 1) * bw;
        if (slow) {
          g.fillStyle = 'rgba(170,8,14,' + ra.toFixed(3) + ')';
          g.fillRect(0, 0, w, t); g.fillRect(0, h - t, w, t); g.fillRect(0, t, t, h - 2 * t); g.fillRect(w - t, t, t, h - 2 * t);
          continue;
        }
        var j = i, x0 = j * bw, iw = w - 2 * x0, ih = h - 2 * x0;
        if (iw <= 0 || ih <= 0) break;
        g.fillStyle = 'rgba(170,8,14,' + (1 - Math.pow(1 - ra, 6 - j)).toFixed(4) + ')';
        g.fillRect(x0, x0, iw, bw); g.fillRect(x0, h - x0 - bw, iw, bw);
        g.fillRect(x0, x0 + bw, bw, ih - 2 * bw); g.fillRect(w - x0 - bw, x0 + bw, bw, ih - 2 * bw);
      }
    }
    /* the dark falls */
    if (dk > 0) { g.fillStyle = 'rgba(2,0,2,' + (0.9 * dk).toFixed(3) + ')'; g.fillRect(0, 0, w, h); }
    /* ash drifts down; embers rise, faster as you close in */
    var moving = !still() && !(NEU.juice && NEU.juice.noParticles);
    var speed = 1 + near * 2.2 + (run ? 2 : 0);
    for (i = 0; i < ash.length; i++) {
      var f = ash[i];
      if (moving) { f.y += f.v * dt; f.x += Math.sin(now / 900 + f.ph) * 4 * dt; if (f.y > 13 * TILE) { f.y = 0; f.x = Math.random() * 21 * TILE; } }
      g.fillStyle = cold ? '#8A8290' : '#5A5260';
      g.fillRect(ox + Math.round(f.x) * S, oy + Math.round(f.y) * S, f.s * S, f.s * S);
    }
    if (!cold) for (i = 0; i < embers.length; i++) {
      var m = embers[i];
      if (moving) {
        m.y -= m.v * speed * dt; m.x += Math.sin(now / 400 + m.ph) * 8 * dt; m.life -= dt * (0.6 + near);
        if (m.life <= 0 || m.y < 0) { embers[i] = m = newEmber(false); }
      }
      g.globalAlpha = Math.min(1, m.life);
      g.fillStyle = m.c;
      g.fillRect(ox + Math.round(m.x) * S, oy + Math.round(m.y) * S, m.s * S, m.s * S);
    }
    g.globalAlpha = 1;
    if (run) paintSummon(now, S, ox + CX * S, oy + CY * S, w, h);
  }

  /* her shape, black with a red rim, cut from her own hooded sheet */
  var sil = null;
  function silhouette() {
    if (sil) return sil;
    var sh = NEU.sheets && NEU.sheets.scalHood, im = sh && NEU.sheetReady && NEU.sheetReady(sh);
    if (!im) return null;
    var c = document.createElement('canvas'), w = sh.fw + 2, h = sh.fh + 2;
    c.width = w; c.height = h;
    var x = c.getContext('2d');
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++)
      if (dx || dy) x.drawImage(im, 0, 0, sh.fw, sh.fh, 1 + dx, 1 + dy, sh.fw, sh.fh);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#FF2A14'; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'source-over';
    var y = document.createElement('canvas'); y.width = w; y.height = h;
    var yy = y.getContext('2d');
    yy.drawImage(im, 0, 0, sh.fw, sh.fh, 1, 1, sh.fw, sh.fh);
    yy.globalCompositeOperation = 'source-in';
    yy.fillStyle = '#040002'; yy.fillRect(0, 0, w, h);
    x.drawImage(y, 0, 0);
    sil = c;
    return sil;
  }

  function paintSummon(now, S, cx, cy, w, h) {
    var t = T(), u = S, i;
    /* the eye: an almond of brimstone, lids parting row by row */
    var eye = dbg.eye, fadeEye = 1 - clamp((t - RISE_T) / 600);
    if (eye > 0 && fadeEye > 0) {
      var ey = cy - 40 * u, half = Math.round(10 * (still() ? 1 : eye)), W = 34;
      g.globalAlpha = (still() ? eye : 1) * fadeEye;
      for (var r = -10; r <= 10; r++) {
        var k = 1 - (r * r) / 121, hw = Math.round(W * Math.sqrt(Math.max(0, k)));
        if (!hw) continue;
        var open = Math.abs(r) <= half;
        g.fillStyle = open ? (Math.abs(r) > half - 2 ? '#FFB070' : '#E01A12') : '#1A0004';
        g.fillRect(cx - hw * u, ey + r * u, hw * 2 * u, u);
        if (open) {
          var iw = Math.round(9 * Math.sqrt(Math.max(0, 1 - (r * r) / 100)));
          g.fillStyle = '#3A0006'; g.fillRect(cx - iw * u, ey + r * u, iw * 2 * u, u);
          g.fillStyle = '#000000'; g.fillRect(cx - u, ey + r * u, 2 * u, u);
        }
      }
      /* lashes of light around it */
      g.fillStyle = '#FF3A1A';
      for (i = 0; i < 12; i++) {
        var a = i / 12 * Math.PI * 2, rr = 40 + (i & 1) * 6;
        g.fillRect(cx + Math.round(Math.cos(a) * rr * eye) * u, ey + Math.round(Math.sin(a) * rr * 0.5 * eye) * u, 2 * u, 2 * u);
      }
      g.globalAlpha = 1;
    }
    /* her: rises out of the circle in a wreath of brimstone */
    var rise = dbg.rise;
    if (rise > 0) {
      /* huge: her sheet at about twice the room's own scale */
      var sc = Math.max(3, Math.round(S * 1.6)), sy = cy + (12 + (still() ? 0 : Math.round((1 - rise) * 40))) * u;
      /* the wreath first, behind her: tongues of brimstone in a ring */
      var n = 22, spin = still() ? 0 : now / 1600, q = Math.max(2, Math.round(sc / 2)),
          wr = 36 * sc, wy = sy - 32 * sc;
      g.globalAlpha = rise;
      for (i = 0; i < n; i++) {
        var aa = i / n * Math.PI * 2 + spin, fx = Math.round(cx + Math.cos(aa) * wr * Math.min(1, rise * 1.4)),
            fy = Math.round(wy + Math.sin(aa) * wr * Math.min(1, rise * 1.4)),
            fl = still() ? 7 : 6 + ((i * 7 + ((now / 90) | 0)) % 4);
        g.fillStyle = '#5A0008'; g.fillRect(fx - 3 * q, fy - (fl + 1) * q, 6 * q, (fl + 2) * q);
        g.fillStyle = '#C0101A'; g.fillRect(fx - 2 * q, fy - fl * q, 4 * q, fl * q);
        g.fillStyle = '#FF5A1A'; g.fillRect(fx - q, fy - (fl - 1) * q, 2 * q, (fl - 3) * q);
        g.fillStyle = '#FFD890'; g.fillRect(fx - (i & 1) * q, fy - (fl - 1) * q, q, 2 * q);
      }
      var sh = NEU.sheets && NEU.sheets.scalHood, s2 = silhouette();
      var dw = (sh ? sh.fw + 2 : 40) * sc, dh = (sh ? sh.fh + 2 : 60) * sc;
      g.globalAlpha = rise;
      if (s2) g.drawImage(s2, Math.round(cx - dw / 2), Math.round(sy - dh), dw, dh);
      else {
        /* her art did not load: a hooded figure, so the scene still reads */
        g.fillStyle = '#FF2A14'; g.fillRect(cx - 9 * u, sy - 46 * u, 18 * u, 46 * u);
        g.fillStyle = '#040002'; g.fillRect(cx - 8 * u, sy - 45 * u, 16 * u, 45 * u);
      }
      /* the last moments: her real colours bleed through */
      var real = clamp((t - (TALK_T - 300)) / 700);
      if (real > 0 && NEU.sheetDraw) NEU.sheetDraw(g, 'scalHood', cx, sy - sc, { scale: sc, anchor: 'feet', alpha: real * rise, frame: 0 });
      /* two coals for eyes, until she is in colour */
      if (real < 1) {
        g.globalAlpha = rise * (1 - real);
        g.fillStyle = '#FF5A2A';
        g.fillRect(cx - 4 * sc, sy - 47 * sc, 2 * sc, sc); g.fillRect(cx + 2 * sc, sy - 47 * sc, 2 * sc, sc);
      }
      g.globalAlpha = 1;
    }
    /* the flash (once), or under reduced motion a fade to black */
    if (run.flashAt) {
      var ft = t - run.flashAt;
      if (run.fade) {
        g.fillStyle = 'rgba(0,0,0,' + clamp(ft / FADE_LEN).toFixed(3) + ')';
        g.fillRect(0, 0, w, h);
      } else {
        var fa = 1 - clamp(ft / FLASH_LEN);
        g.fillStyle = 'rgba(255,236,226,' + (fa * 0.9).toFixed(3) + ')'; g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(255,40,20,' + (fa * 0.5).toFixed(3) + ')'; g.fillRect(0, 0, w, h);
      }
    }
  }

  /* ── the summoning ─────────────────────────────────────────────── */
  function start(c) {
    if (run) return;
    if (dead()) {
      c.say(['the altar is cold. the bowl holds ash and nothing else.',
             'whatever answered this circle will not answer it again.'], 'narr');
      return;
    }
    if (!(NEU.scal && NEU.scal.open)) { c.say(['the circle does not answer. not yet.'], 'narr'); return; }
    dbg.starts++;
    dbg.rings = 0; dbg.ringOrder = []; dbg.erupted = 0; dbg.dark = 0; dbg.eye = 0; dbg.rise = 0;
    dbg.flashes = 0; dbg.fades = 0; dbg.shakes = 0;
    run = { c: c, t: 0, talked: false, flashAt: 0, fade: false, stop: null };
    api = c;
    near = 1;
    NEU.duckHold = true;
    if (NEU.talk && NEU.talk.close) NEU.talk.close();
    c.busy(true);
    overlayOn();
    run.stop = sfx('rise', 3000);
    shake(0.2);
    c.later(tick, 16);
  }

  function tick() {
    if (!run) return;
    var c = run.c;
    run.t += 16;
    var t = run.t;
    while (dbg.rings < 4 && t >= RING_T[dbg.rings]) {
      dbg.ringOrder.push(dbg.rings);
      dbg.rings++;
      sfx('snap');
      shake(0.14 + dbg.rings * 0.05);
    }
    while (dbg.erupted < 6 && t >= ERUPT_T + dbg.erupted * ERUPT_STEP) {
      if (!dbg.erupted) { sfx('stinger', 2); shake(0.55); } else shake(0.12);
      dbg.erupted++;
    }
    dbg.dark = clamp((t - DARK_T) / DARK_LEN);
    dbg.eye = clamp((t - EYE_T) / EYE_LEN);
    dbg.rise = clamp((t - RISE_T) / RISE_LEN);
    if (dbg.eye > 0 && !run.eyeBeat) { run.eyeBeat = true; sfx('heart'); }
    if (dbg.rise > 0 && !run.riseHum) { run.riseHum = true; sfx('rise', 1800); shake(0.3); }
    if (t >= TALK_T && !run.talked) {
      run.talked = true;
      if (NEU.talk) NEU.talk(LINES, 'scal');
    }
    if (run.talked && !run.flashAt && !tboxOpen()) {
      run.flashAt = t;
      if (noFlash()) { run.fade = true; dbg.fades++; }
      else { dbg.flashes++; sfx('stinger', 3); shake(0.8); }
    }
    if (run.flashAt && t >= run.flashAt + (run.fade ? FADE_LEN : FLASH_LEN)) { launch(); return; }
    c.later(tick, 16);
  }

  /* The fight starts the way it always has: the room closes and
     NEU.scal.open() takes the screen (rooms-a.js enterArena). */
  function launch() {
    if (!run) return;
    var c = run.c;
    if (run.stop) run.stop();
    run = null;
    if (save()) save().flag('scal_summon_seen', 1);
    NEU.duckHold = false;
    overlayOff();
    c.busy(false);
    c.leave();
    if (NEU.scal && NEU.scal.open) NEU.scal.open();
  }

  /* left mid-scene (the quit button): drop it, leave nothing behind */
  function abort() {
    if (!run) return;
    if (run.stop) run.stop();
    run = null;
    NEU.duckHold = false;
  }

  /* X skips — once you have sat through it the first time. */
  addEventListener('keydown', function (e) {
    if (!run || (e.key !== 'x' && e.key !== 'X')) return;
    if (!seen()) return;
    e.preventDefault();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    if (NEU.talk && NEU.talk.close) NEU.talk.close();
    launch();
  }, true);

  NEU.summon = {
    start: start,
    enter: function (c) { api = c; near = 0; beatAcc = 0; quakeAcc = 0; overlayOn(); },
    exit: function () { abort(); api = null; near = 0; NEU.duckHold = false; overlayOff(); },
    /* room.dark / room.light for b8_arena */
    dark: function () {
      if (dead()) return 0;
      return run ? BASE_DARK + (SUMMON_DARK - BASE_DARK) * dbg.dark : BASE_DARK;
    },
    light: function () {
      if (run && dbg.dark > 0) return { x: CX, y: CY + 8 };
      return api ? api.player : null;
    },
    aftermath: dead,
    prox: prox,
    centre: { x: CX, y: CY },
    get active() { return !!run; },
    get near() { return near; },
    debug: dbg,
    /* dev/screenshots: jump the scene's clock (ms from the press) */
    _seek: function (ms) { if (run) run.t = Math.max(run.t, ms); },
    /* tests: pose the room without the engine (near 0..1, dead, rings lit 0..4) */
    _pose: function (o) {
      if ('near' in o) near = o.near;
      if ('dead' in o) forceDead = o.dead === null ? null : !!o.dead;
      if ('rings' in o) { dbg.rings = o.rings; run = o.rings ? { c: api, t: 0, talked: false, flashAt: 0, fade: false, stop: null } : null; }
    },
    set _slow(v) { slow = !!v; }, get _slow() { return slow; },
    _lightAt: lightAt,
    _circleState: circleState
  };
})();
