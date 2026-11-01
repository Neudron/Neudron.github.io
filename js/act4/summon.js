/* summon.js — b8_arena, the hall where Supreme Calamitas is summoned.
   ───────────────────────────────────────────────────────────────────
   The room itself is data in rooms-a.js. This file is everything that
   makes it read as "the hardest thing in the game is about to happen":

     the look     two entity kinds the engine draws like any other —
                  scalfloor (the whole hall: bloodstone flags, the
                  crimson runner, the tall north wall with her gilded
                  sigil, banners and plaques, the brimstone groove round
                  the circle; then the hex circle and the bloodstone
                  cracks — floor paint, under everything) and scalprop
                  (altar, broken columns, brimstone braziers, sconces,
                  chains and a gibbet, skulls with candles, vents).
                  Procedural integer pixel art baked once into small
                  canvases (see "baked layers"), plus her own
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
                  cracked through and nothing is summoned again: the
                  groove has crusted over, her sigil is split and shut,
                  a banner is down, every fire is a wisp of smoke, and
                  one pale shaft of light comes down onto the altar
                  through the vault, with motes turning in it.

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
  /* Stepped colour ramps: n+1 strings built once. A colour that follows
     `near` or a pulse is looked up, never mixed per frame, so it costs no
     allocation and a baked mask is re-tinted only when it crosses a step
     (and every step's tint is cached, so after the first beat: never). */
  function ramp(a, b, n) { var r = []; for (var i = 0; i <= n; i++) r.push(mix(a, b, i / n)); return r; }
  function rampAt(rp, k) { return rp[Math.round(clamp(k) * (rp.length - 1))]; }
  var R_DIM = ramp('#3A0E14', '#8A1A20', 8), R_CRACK = ramp('#6A0A10', '#FF3020', 8);
  var R_RUNE = ramp('#5A0A10', '#FF4A2A', 8), R_VENT = ramp('#2A0608', '#7A1010', 6);
  var R_LAVA = ramp('#4A060A', '#FF4A1A', 8), R_CORE = ramp('#B0240E', '#FFE0A0', 8);
  var R_SIGIL = ramp('#3A0008', '#FF3A1A', 8);
  var R_BRZ = ramp('#FF7A3A', '#FF1A10', 8), R_ALT = ramp('#FF5A2A', '#FF1A10', 8);
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
          tinted(b, colour)  (re-tints only when the colour changes);
          a colour that FOLLOWS something (near, a pulse) walks a
          stepped ramp (ramp / rampAt) and is drawn with
          blitT(g, b, ox, oy, S, colour), which caches one tinted
          canvas per step: no per-frame tinting, no per-frame strings.
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
  /* the layer's mask in `col`, one cached canvas PER colour. For masks
     whose colour walks a ramp (rampAt): a handful of steps, each tinted
     once, then every frame is a plain drawImage. Painters for these
     masks paint in their 5th argument so the immediate path matches. */
  function tintC(b, col) {
    if (!b.cv) return null;
    var m = b.tc || (b.tc = {}), c = m[col];
    if (c) return c;
    if ((b.tcn = (b.tcn || 0) + 1) > 24) { b.tc = m = {}; b.tcn = 1; }
    c = mkc(b.w, b.h);
    var t = c.getContext('2d');
    t.drawImage(b.cv, 0, 0);
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = col; t.fillRect(0, 0, b.w, b.h);
    t.globalCompositeOperation = 'source-over';
    return (m[col] = c);
  }
  function blitT(g, b, ox, oy, S, col) {
    var c = slow ? null : tintC(b, col);
    if (c) g.drawImage(c, ox + b.x0 * S, oy + b.y0 * S, b.w * S, b.h * S);
    else b.paint(g, ox, oy, S, col);
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
  function circleBitmap(st, cols, key) {
    var L = circleLayers(st);
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
  /* the dormant rings' colour walks a 9-step ramp, so the composed
     bitmap is rebuilt only when the beat crosses a step; the key is a
     number (no string per frame) */
  var CCOLS = ['', '', '', '', '', '', ''];
  function circleColours(st, lit, now) {
    var beat = pulse(now, 0.4 + near * 0.8), li = Math.round(clamp(near * (0.4 + 0.6 * beat)) * 8);
    var dim = st === 'cracked' ? '#2E2830' : R_DIM[li];
    var hot = '#FF3A22', core = '#FFC890';
    CCOLS[0] = lit > 0 ? '#7A0A0E' : ''; CCOLS[1] = 0 < lit ? hot : dim; CCOLS[2] = 1 < lit ? hot : dim;
    CCOLS[3] = lit > 1 ? core : CCOLS[2]; CCOLS[4] = 2 < lit ? hot : dim; CCOLS[5] = 3 < lit ? hot : dim;
    CCOLS[6] = st === 'cracked' ? '#060306' : '';
    CCOLS.key = (st === 'cracked' ? 1000 : 0) + lit * 20 + (st === 'cracked' ? 0 : li);
    return CCOLS;
  }
  /* the shock rings: a ring catching throws a stepped ring outward
     (six baked sizes, one drawImage), and the eruption a bigger one */
  var SHOCK_N = 6, SHOCK_COL = '#FF6A2A', SHOCK_HOT = '#FFD890';
  function shockLayer(k) {
    return bake('shock:' + k, CX - RX - 52, CY - RY - 42, 2 * RX + 104, 2 * RY + 84, function (g2, ox, oy, S2, c) {
      ellipse(g2, ox, oy, S2, CX, CY, RX + 5 + k * 8, RY + 4 + k * 6, c);
      if (k < SHOCK_N - 2) ellipse(g2, ox, oy, S2, CX, CY, RX + 3 + k * 8, RY + 2 + k * 6, c,
                                   function (t) { return ((t * 40) | 0) & 1; });
    });
  }
  function drawShock(g, ox, oy, S, since, len, col) {
    if (since < 0 || since >= len) return;
    var k = since / len, step = Math.min(SHOCK_N - 1, (k * SHOCK_N) | 0);
    g.globalAlpha = 1 - k * 0.8;
    blitT(g, shockLayer(step), ox, oy, S, col);
    g.globalAlpha = 1;
  }
  function drawCircle(g, e, d) {
    var S = d.S, o = orig(e, d), ox = o.x, oy = o.y, now = d.now, i;
    origin.x = ox; origin.y = oy; origin.S = S;
    var st = circleState(), lit = st === 'lit' ? dbg.rings : 0;
    var cols = circleColours(st, lit, now);
    var bm = slow ? null : circleBitmap(st, cols, cols.key);
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
      for (i = 0; i < 10; i++) {
        var a = (run0 + i * 36) * Math.PI / 180;
        P(g, ox, oy, S, CX + Math.cos(a) * RX, CY + Math.sin(a) * RY, 1, 1, '#FFC890');
      }
    }
    if (run && !still()) {
      var t = run.t;
      for (i = 0; i < dbg.rings; i++) drawShock(g, ox, oy, S, t - RING_T[i], 480, SHOCK_COL);
      drawShock(g, ox, oy, S, t - ERUPT_T, 640, SHOCK_HOT);
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
    var glow = dead() ? '#3A1418' : rampAt(R_CRACK, 0.25 + near * 0.5 * pulse(d.now, 0.5 + near));
    var bx = Math.floor((e.x + 0.5) * TILE - 10) - 3, by = Math.floor((e.y + 0.5) * TILE) - 26;
    var b = slow ? null : bakeRoles('cracks:' + e.x + ',' + e.y, bx, by, 48, 56, 2,
                                    function (g2, ox, oy, S2, cols) { paintCracks(g2, ox, oy, S2, cols, e); });
    if (!b || !b.roles) { paintCracks(g, o.x, o.y, S, ['#050204', glow], e); return; }
    var sm = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = false;
    /* shadow + glow composed once per glow step: one drawImage */
    var cc = b.cc || (b.cc = {}), c = cc[glow];
    if (!c) {
      c = cc[glow] = mkc(48, 56);
      var t = c.getContext('2d');
      t.drawImage(tintC(b.roles[0], '#050204'), 0, 0); t.drawImage(tintC(b.roles[1], glow), 0, 0);
      b.roles[1].tc = null; b.roles[1].tcn = 0;
    }
    g.drawImage(c, o.x + bx * S, o.y + by * S, 48 * S, 56 * S);
    if (sm) g.imageSmoothingEnabled = sm;
  }

  /* ── the hall: floor, runner, walls, the sigil, the gutters ───────
     ONE floor entity (scalfloor v:'hall' at 0,0, FIRST in the room's
     list so it is under every other decal) paints the whole room from
     its grid into a 1x canvas, once per state (burning / after): the
     bloodstone flags, the crimson runner the circle burnt the end off,
     the gold-studded processional ring, the tall north wall with its
     banners, brass plaques and the gilded niche of her sigil, and the
     stone lips of six brimstone gutters that run from the circle's
     vents to the braziers. Live on top: three baked masks (the molten
     brimstone, its hot core, the sigil's eye) tinted from stepped ramps
     (each step tinted once, cached), and ten sparks riding the gutters.
     A frame of the hall is 4 drawImages and 10 fillRects. */
  var HW = 21 * TILE, HH = 13 * TILE;
  var HC = { s: ['#1E1826', '#231C2C', '#1A1522', '#271F30'], mort: '#0F0B14', hi: '#33293E',
             vein: '#3E1018', veinHi: '#5E161C',
             cap: '#09060C', capT: '#140F18', rim: '#33283A', rim2: '#1E1624',
             b: ['#2A1E2E', '#241A28', '#1F1724'], bM: '#120C16', bHi: '#3A2C40', blood: '#3A1622',
             skirt: '#0E0910', skirtHi: '#1E1622',
             gold: '#B8903A', goldHi: '#E4C46A', goldLo: '#6E5020',
             red: '#7A1A26', redHi: '#A8283A', redLo: '#4A0E18', emb: '#E0301A',
             k0: '#4A0E18', k1: '#621622', kHi: '#8A2430',
             out: '#0B070D', lipHi: '#4E3A4E', lipLo: '#22161E', bed: '#2A0608',
             crust: '#1C1216', crustHi: '#3A1A18', niche: '#06030A' };
  /* integer hash for the paint: same cell, same slab, every bake */
  function ih(x, y, s) {
    var h = (x * 374761393 + y * 668265263 + (s || 0) * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  /* The brimstone groove: a channel inlaid round the circle, outside its
     outer ring (outline / stone bed / molten band, as ellipse radii), a
     stone bridge where the runner crosses it, and the sigil's drip down
     the wall. ringRows() walks an elliptic annulus row by row. */
  var GRV = { out: [RX + 13, RY + 11, RX + 7, RY + 5], bed: [RX + 12, RY + 10, RX + 8, RY + 6],
              hot: [RX + 11, RY + 9, RX + 9, RY + 7] };
  var BR_X0 = 94, BR_X1 = 116, BR_Y0 = 113, BR_Y1 = 128;      /* the bridge, world px */
  function ringRows(r, fn) {
    var rxo = r[0], ryo = r[1], rxi = r[2], ryi = r[3];
    for (var y = -ryo; y <= ryo; y++) {
      var ko = 1 - (y * y) / ((ryo + 0.5) * (ryo + 0.5));
      if (ko <= 0) continue;
      var wo = Math.round(rxo * Math.sqrt(ko)), ki = 1 - (y * y) / ((ryi + 0.5) * (ryi + 0.5));
      if (ki <= 0) { fn(CY + y, CX - wo, 2 * wo); continue; }
      var wi = Math.round(rxi * Math.sqrt(ki));
      if (wo > wi) { fn(CY + y, CX - wo, wo - wi); fn(CY + y, CX + wi, wo - wi); }
    }
  }
  function onBridge(x, y) { return x < CX && y >= BR_Y0 && y < BR_Y1; }
  /* the groove's centre line, sampled once: the sparks ride it */
  var SPK = (function () {
    var out = [], n = 320, lx = null, ly = null;
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2, x = Math.round(CX + Math.cos(a) * (RX + 10)), y = Math.round(CY + Math.sin(a) * (RY + 8));
      if ((x === lx && y === ly) || onBridge(x, y)) continue;
      lx = x; ly = y; out.push(x, y);
    }
    return out;
  })();
  var SIG_X = 168, SIG_Y = 14;
  function sigilHW(r) { return Math.round(9 * Math.sqrt(Math.max(0, 1 - (r * r) / 16))); }

  function paintHall(g, ox, oy, S, grid, cold) {
    function R(x, y, w, h, c) { if (w > 0 && h > 0) { g.fillStyle = c; g.fillRect(ox + x * S, oy + y * S, w * S, h * S); } }
    var Ht = grid.length, Wd = grid[0].length, x, y, X, Y, i;
    function at(xx, yy) { if (xx < 0 || yy < 0 || yy >= Ht) return '#'; var r = grid[yy]; return xx >= r.length ? '#' : r.charAt(xx); }
    function wall(xx, yy) { return at(xx, yy) === '#'; }
    /* 1. bloodstone flags under everything that is not wall: one slab a
       cell, some split in two, bevelled light at the top-left */
    for (y = 0; y < Ht; y++) for (x = 0; x < Wd; x++) {
      if (wall(x, y)) continue;
      X = x * TILE; Y = y * TILE;
      var t = HC.s, h1 = ih(x, y, 1), c0 = t[(ih(x, y, 2) * 4) | 0], c1 = t[(ih(x, y, 3) * 4) | 0];
      R(X, Y, 16, 16, c0);
      R(X + 1, Y + 1, 14, 1, HC.hi); R(X + 1, Y + 2, 1, 13, HC.hi);
      R(X + 1, Y + 15, 15, 1, '#14101A'); R(X + 15, Y + 1, 1, 15, '#14101A');
      if (h1 < 0.3) { R(X + 8, Y + 1, 7, 14, c1); R(X + 8, Y + 1, 1, 15, HC.mort); R(X + 9, Y + 1, 6, 1, HC.hi); }
      else if (h1 < 0.55) { R(X + 1, Y + 9, 14, 6, c1); R(X + 1, Y + 8, 15, 1, HC.mort); R(X + 2, Y + 9, 13, 1, HC.hi); }
      R(X, Y, 16, 1, HC.mort); R(X, Y, 1, 16, HC.mort);
      var r = ih(x, y, 12);
      if (r < 0.2) { R(X + 3, Y + 4, 3, 1, HC.vein); R(X + 6, Y + 5, 2, 1, HC.veinHi); R(X + 8, Y + 6, 1, 2, HC.vein); R(X + 9, Y + 8, 2, 1, HC.vein); }
      else if (r > 0.88) { R(X + 10, Y + 11, 2, 1, '#3A3044'); R(X + 4, Y + 12, 1, 1, '#120E16'); }
    }
    /* 2. the brimstone groove round the circle (its molten band is the
       live mask), gold studs on its rim, the bridge for the runner */
    ringRows(GRV.out, function (yy, x0, w) { R(x0, yy, w, 1, HC.out); });
    ringRows(GRV.bed, function (yy, x0, w) { R(x0, yy, w, 1, cold ? HC.crust : HC.bed); });
    if (cold) ringRows(GRV.hot, function (yy, x0, w) { if (ih(x0, yy, 41) < 0.4) R(x0 + ((ih(x0, yy, 42) * w) | 0), yy, 1, 1, HC.crustHi); });
    ellipse(g, ox, oy, S, CX, CY, RX + 7, RY + 5, HC.lipHi, function (k) { return k < 0.5; });
    for (i = 0; i < 12; i++) {
      var a = (i + 0.5) / 12 * Math.PI * 2;
      var sx0 = Math.round(CX + Math.cos(a) * (RX + 15)), sy0 = Math.round(CY + Math.sin(a) * (RY + 13));
      R(sx0 - 1, sy0 - 1, 3, 3, HC.out); R(sx0, sy0, 1, 1, cold ? '#8A7A4A' : HC.goldHi); R(sx0 - 1, sy0 - 1, 1, 1, HC.goldLo);
    }
    R(BR_X0, BR_Y0, BR_X1 - BR_X0, BR_Y1 - BR_Y0, HC.out);
    R(BR_X0 + 1, BR_Y0 + 1, BR_X1 - BR_X0 - 2, BR_Y1 - BR_Y0 - 2, '#3A2E3C');
    R(BR_X0 + 1, BR_Y0 + 1, BR_X1 - BR_X0 - 2, 1, HC.gold); R(BR_X0 + 1, BR_Y1 - 2, BR_X1 - BR_X0 - 2, 1, HC.goldLo);
    R(BR_X0 + 7, BR_Y0 + 2, 1, BR_Y1 - BR_Y0 - 4, HC.mort); R(BR_X0 + 14, BR_Y0 + 2, 1, BR_Y1 - BR_Y0 - 4, HC.mort);
    /* 3. the runner: crimson and gold from the door to the circle's rim,
       where the circle has burnt it off; worn flags beyond */
    var burn = CX - RX - 2;
    for (y = 0; y < Ht; y++) for (x = 0; x < Wd; x++) {
      if (at(x, y) !== ',') continue;
      X = x * TILE; Y = y * TILE;
      if (X >= burn) {
        R(X, Y + 3, 16, 10, '#2C2230'); R(X, Y + 3, 16, 1, '#3A2E3C');
        R(X + 4, Y + 8, 1, 5, HC.mort); R(X + 11, Y + 3, 1, 5, HC.mort); R(X, Y + 8, 16, 1, HC.mort);
        continue;
      }
      var w = Math.min(16, burn - X);
      R(X, Y + 2, w, 12, HC.k0);
      R(X, Y + 2, w, 1, HC.goldLo); R(X, Y + 3, w, 1, HC.gold); R(X, Y + 12, w, 1, HC.gold); R(X, Y + 13, w, 1, HC.goldLo);
      R(X, Y + 4, w, 1, HC.redLo); R(X, Y + 11, w, 1, HC.redLo);
      for (i = 0; i < 2; i++) {
        var dx = X + 4 + i * 8;
        if (dx + 3 > X + w) break;
        R(dx, Y + 5, 1, 1, HC.gold); R(dx - 1, Y + 6, 3, 1, HC.k1); R(dx - 2, Y + 7, 5, 2, HC.kHi);
        R(dx, Y + 7, 1, 2, HC.goldHi); R(dx - 1, Y + 9, 3, 1, HC.k1); R(dx, Y + 10, 1, 1, HC.gold);
      }
      if (X + 16 >= burn) {
        for (i = 0; i < 12; i++) {
          var ln = 1 + ((ih(x, i, 30) * 5) | 0);
          R(X + w - ln, Y + 2 + i, ln, 1, HC.out);
          if (ih(x, i, 31) < 0.35) R(X + w - ln - 1, Y + 2 + i, 1, 1, cold ? '#2A1A1A' : '#8A2010');
        }
      }
    }
    /* 5. contact shadows under the north wall and beside the side walls */
    for (y = 0; y < Ht; y++) for (x = 0; x < Wd; x++) {
      if (wall(x, y)) continue;
      X = x * TILE; Y = y * TILE;
      if (wall(x, y - 1)) { g.globalAlpha = 0.55; R(X, Y, 16, 3, '#000000'); g.globalAlpha = 0.28; R(X, Y + 3, 16, 4, '#000000'); }
      if (wall(x - 1, y)) { g.globalAlpha = 0.32; R(X, Y, 3, 16, '#000000'); }
      if (wall(x + 1, y)) { g.globalAlpha = 0.32; R(X + 13, Y, 3, 16, '#000000'); }
      g.globalAlpha = 1;
    }
    /* 6. wall tops, rimmed where they meet the floor */
    for (y = 0; y < Ht; y++) for (x = 0; x < Wd; x++) {
      if (!wall(x, y)) continue;
      X = x * TILE; Y = y * TILE;
      R(X, Y, 16, 16, HC.cap);
      if (ih(x, y, 50) < 0.5) R(X + ((ih(x, y, 51) * 12) | 0), Y + ((ih(x, y, 52) * 12) | 0), 3, 1, HC.capT);
      if (!wall(x + 1, y)) { R(X + 13, Y, 2, 16, HC.rim2); R(X + 15, Y, 1, 16, HC.rim); }
      if (!wall(x - 1, y)) { R(X + 1, Y, 2, 16, HC.rim2); R(X, Y, 1, 16, HC.rim); }
      if (!wall(x, y - 1)) { R(X, Y, 16, 1, HC.rim); R(X, Y + 1, 16, 2, HC.rim2); }
    }
    /* 7. the north wall's face: two rows tall wherever row 2 is floor */
    var xa = -1, xb = -1;
    for (x = 0; x < Wd; x++) if (wall(x, 1) && !wall(x, 2)) { if (xa < 0) xa = x; xb = x + 1; }
    if (xa >= 0) paintNorth(R, g, xa * TILE, xb * TILE, cold);
    /* 8. after: rubble off the broken circle, and two small pale flowers
       where the runner burnt — the room is allowed to be quiet now */
    if (cold) {
      var RB = [[-48, -6], [-30, 3], [-12, -9], [14, 6], [36, -4], [52, 2], [24, 18], [-40, 16]];
      for (i = 0; i < RB.length; i++) {
        R(CX + RB[i][0], CY + RB[i][1], 3, 2, HC.out); R(CX + RB[i][0], CY + RB[i][1], 2, 1, '#4A4048');
      }
      flower(R, burn - 4, 124); flower(R, 242, 104); flower(R, 52, 170);
    }
  }
  function flower(R, x, y) {
    R(x, y + 1, 1, 3, '#3A5A3A'); R(x + 1, y + 3, 1, 1, '#4A6E4A');
    R(x - 1, y, 3, 1, '#C8B8E8'); R(x, y - 1, 1, 3, '#C8B8E8'); R(x, y, 1, 1, '#FFF2C4');
  }
  function paintNorth(R, g, x0, x1, cold) {
    var c, bx, i;
    R(x0, 0, x1 - x0, 3, HC.cap); R(x0, 3, x1 - x0, 1, HC.rim);
    /* courses of bloodstone brick, one in ten a red vein-stone */
    for (c = 0; c < 4; c++) {
      var cy = 4 + c * 6, chh = c < 3 ? 6 : 4, off = (c & 1) * 6;
      for (bx = x0 - off; bx < x1; bx += 12) {
        var l = Math.max(bx, x0), r = Math.min(bx + 12, x1);
        var hv = ih(bx, c, 60), col = hv < 0.1 ? HC.blood : HC.b[(ih(bx, c, 61) * 3) | 0];
        R(l, cy, r - l, chh, col);
        R(l, cy, r - l, 1, HC.bM);
        if (bx >= x0) R(bx, cy, 1, chh, HC.bM);
        R(l + 1, cy + 1, r - l - 2, 1, hv < 0.1 ? '#4E2030' : HC.bHi);
        if (hv < 0.1) { R(l + 3, cy + 3, 3, 1, HC.veinHi); R(l + 6, cy + 2, 2, 1, HC.vein); }
      }
    }
    /* soot over the two sconces */
    g.globalAlpha = 0.22; R(30, 4, 20, 18, '#000000'); R(286, 4, 20, 18, '#000000');
    g.globalAlpha = 0.3; R(34, 4, 12, 10, '#000000'); R(290, 4, 12, 10, '#000000');
    g.globalAlpha = 1;
    /* the dado: a gold band over a black skirt */
    R(x0, 26, x1 - x0, 1, HC.goldLo); R(x0, 27, x1 - x0, 1, HC.gold); R(x0, 28, x1 - x0, 4, HC.skirt); R(x0, 28, x1 - x0, 1, HC.skirtHi);
    for (i = x0 + 8; i < x1; i += 24) R(i, 27, 2, 1, HC.goldHi);
    paintSigil(R, cold);
    paintBanner(R, 72, false);
    paintBanner(R, 264, cold);
    paintPlaque(R, 120, false);
    paintPlaque(R, 216, true);
  }
  /* her sigil: a gilded niche, a crown of gold flame, and an eye whose
     iris is the live mask (SIGIL) — it wakes as you come close and goes
     wide open when hers does */
  function paintSigil(R, cold) {
    var x = SIG_X, r;
    /* gold pilasters with capitals */
    R(x - 22, 4, 5, 24, HC.out); R(x - 21, 5, 3, 22, HC.gold); R(x - 21, 5, 1, 22, HC.goldHi); R(x - 19, 5, 1, 22, HC.goldLo);
    R(x + 17, 4, 5, 24, HC.out); R(x + 18, 5, 3, 22, HC.gold); R(x + 18, 5, 1, 22, HC.goldHi); R(x + 20, 5, 1, 22, HC.goldLo);
    R(x - 23, 3, 7, 2, HC.goldHi); R(x + 16, 3, 7, 2, HC.goldHi); R(x - 23, 26, 7, 2, HC.gold); R(x + 16, 26, 7, 2, HC.gold);
    /* the niche: an arch of black */
    R(x - 17, 7, 34, 19, HC.niche);
    R(x - 15, 5, 30, 2, HC.niche); R(x - 12, 4, 24, 1, HC.niche); R(x - 7, 3, 14, 1, HC.niche);
    R(x - 17, 6, 2, 1, HC.gold); R(x - 15, 4, 3, 1, HC.gold); R(x - 12, 3, 5, 1, HC.gold); R(x - 7, 2, 14, 1, HC.goldHi);
    R(x + 15, 6, 2, 1, HC.gold); R(x + 12, 4, 3, 1, HC.gold); R(x + 7, 3, 5, 1, HC.gold);
    R(x - 2, 0, 5, 3, HC.out); R(x - 1, 1, 3, 2, HC.goldHi);                       /* keystone */
    /* a crown of gold flame over the eye */
    R(x, 4, 1, 1, HC.goldHi); R(x - 1, 5, 3, 2, HC.gold); R(x - 2, 7, 5, 1, HC.goldLo);
    R(x - 7, 6, 1, 1, HC.gold); R(x - 8, 7, 2, 2, HC.goldLo); R(x + 6, 6, 1, 1, HC.gold); R(x + 6, 7, 2, 2, HC.goldLo);
    /* the eye: gold lids, a dark bed, a slit pupil */
    for (r = -4; r <= 4; r++) {
      var hw = sigilHW(r) + 1;
      if (Math.abs(r) === 4) { R(x - hw - 2, SIG_Y + r, hw * 2 + 4, 1, HC.goldLo); continue; }
      R(x - hw, SIG_Y + r, 1, 1, HC.gold); R(x + hw - 1, SIG_Y + r, 1, 1, HC.gold);
      R(x - hw + 1, SIG_Y + r, hw * 2 - 2, 1, cold ? '#1A1014' : '#2A0006');
    }
    R(x - 1, SIG_Y - 3, 2, 7, '#000000');
    /* the basin it weeps into, over the gutter */
    R(x - 7, 20, 14, 1, HC.goldLo); R(x - 6, 21, 12, 2, HC.out); R(x - 5, 21, 10, 1, cold ? HC.crust : HC.bed);
    R(x - 2, 23, 5, 5, HC.out); R(x - 1, 23, 3, 5, cold ? HC.crust : HC.bed);
    R(x - 3, 28, 7, 2, HC.goldLo); R(x - 2, 28, 5, 1, cold ? HC.crust : HC.bed);
    if (cold) {           /* split through, and shut */
      R(x + 3, 3, 1, 4, '#000000'); R(x + 2, 7, 1, 5, '#000000'); R(x + 3, 12, 1, 5, '#000000'); R(x + 2, 17, 1, 4, '#000000');
      R(x - 8, SIG_Y, 7, 1, '#3A2A30'); R(x + 1, SIG_Y, 7, 1, '#3A2A30');
    }
  }
  var EMBLEM = { rows: ['...g...', '..gRg..', '.gRRRg.', 'gRRkRRg', '.gRRRg.', '..ggg..'],
                 pal: { g: '#B8903A', R: '#E0301A', k: '#0B070D' } };
  function paintBanner(R, cx, torn) {
    var y, i, j;
    R(cx - 9, 4, 18, 2, HC.out); R(cx - 8, 4, 16, 1, HC.goldHi); R(cx - 8, 5, 16, 1, HC.goldLo);   /* the rod */
    R(cx - 10, 3, 2, 4, HC.gold); R(cx + 8, 3, 2, 4, HC.gold);
    var bot = torn ? 17 : 33;
    for (y = 6; y <= bot; y++) {
      var l = cx - 6, w = 12;
      if (torn && y > 11) { var cut = (ih(cx, y, 70) * 4) | 0; l += cut; w -= cut + ((ih(cx, y, 71) * 4) | 0); }
      R(l - 1, y, w + 2, 1, HC.out);
      R(l, y, w, 1, HC.red); R(l, y, 1, 1, HC.redHi); R(l + w - 1, y, 1, 1, HC.redLo);
      if (!torn || y < 12) { R(l + 1, y, 1, 1, HC.gold); R(l + w - 2, y, 1, 1, HC.gold); }
    }
    if (torn) {
      /* the rest of it, in a heap on the floor below */
      R(cx - 9, 38, 18, 6, HC.out); R(cx - 8, 38, 15, 4, HC.red); R(cx - 6, 39, 5, 1, HC.redHi);
      R(cx + 1, 40, 6, 1, HC.redLo); R(cx - 8, 42, 16, 1, HC.redLo); R(cx - 7, 38, 4, 1, HC.gold); R(cx + 3, 41, 3, 1, HC.gold);
      return;
    }
    /* a swallowtail */
    R(cx - 7, 34, 6, 2, HC.out); R(cx + 1, 34, 6, 2, HC.out); R(cx - 7, 36, 3, 1, HC.out); R(cx + 4, 36, 3, 1, HC.out);
    R(cx - 6, 34, 4, 1, HC.red); R(cx + 2, 34, 4, 1, HC.red); R(cx - 6, 35, 2, 1, HC.red); R(cx + 4, 35, 2, 1, HC.redLo);
    /* gold bands and her eye */
    R(cx - 5, 8, 10, 1, HC.gold); R(cx - 5, 30, 10, 1, HC.gold); R(cx - 5, 31, 10, 1, HC.goldLo);
    for (i = 0; i < EMBLEM.rows.length; i++) for (j = 0; j < 7; j++) {
      var ch = EMBLEM.rows[i].charAt(j);
      if (ch !== '.') R(cx - 3 + j, 15 + i, 1, 1, EMBLEM.pal[ch]);
    }
    R(cx, 11, 1, 1, HC.gold); R(cx - 1, 12, 3, 1, HC.goldLo); R(cx, 23, 1, 3, HC.goldLo);
  }
  function paintPlaque(R, cx, scratched) {
    R(cx - 8, 8, 16, 13, HC.out); R(cx - 7, 9, 14, 11, '#8A6A2A'); R(cx - 7, 9, 14, 1, '#C8A04A'); R(cx - 7, 19, 14, 1, '#5A4418');
    R(cx - 6, 10, 1, 1, '#3A2A10'); R(cx + 5, 10, 1, 1, '#3A2A10'); R(cx - 6, 18, 1, 1, '#3A2A10'); R(cx + 5, 18, 1, 1, '#3A2A10');
    for (var i = 0; i < 3; i++) R(cx - 4, 12 + i * 2, i === 2 ? 5 : 8, 1, '#3A2A10');
    if (scratched) { R(cx - 6, 22, 3, 1, '#6A5E68'); R(cx - 2, 23, 4, 1, '#6A5E68'); R(cx + 3, 22, 3, 1, '#6A5E68'); }
  }
  /* the live masks: painted in their 5th argument (see tintC). The
     molten band and its dashed hot core share one box and are composed
     into ONE canvas per ramp step (9 at most, built on first use). */
  var LV_X = CX - RX - 14, LV_Y = 18, LV_W = 2 * RX + 28, LV_H = CY + RY + 13 - 18;
  function lavaMask() {
    return bake('hall:lava', LV_X, LV_Y, LV_W, LV_H, function (g, ox, oy, S, c) {
      g.fillStyle = c;
      ringRows(GRV.hot, function (yy, x0, w) {
        if (x0 < CX && yy >= BR_Y0 && yy < BR_Y1) return;
        g.fillRect(ox + x0 * S, oy + yy * S, w * S, S);
      });
      g.fillRect(ox + (SIG_X - 5) * S, oy + 21 * S, 10 * S, S);              /* the eye's basin */
      g.fillRect(ox + (SIG_X - 1) * S, oy + 23 * S, 3 * S, 5 * S);           /* its drip */
      g.fillRect(ox + (SIG_X - 2) * S, oy + 28 * S, 5 * S, S);               /* and its spout */
    });
  }
  function coreMask() {
    return bake('hall:core', LV_X, LV_Y, LV_W, LV_H, function (g, ox, oy, S, c) {
      g.fillStyle = c;
      for (var i = 0; i < SPK.length; i += 2) if (((i >> 1) % 9) < 6) g.fillRect(ox + SPK[i] * S, oy + SPK[i + 1] * S, S, S);
      g.fillRect(ox + SIG_X * S, oy + 23 * S, S, 5 * S);
    });
  }
  var LAVA_C = [];
  function lavaComp(li) {
    var c = LAVA_C[li];
    if (c !== undefined) return c;
    var lm = lavaMask(), cm = coreMask(), a = tintC(lm, R_LAVA[li]), b = tintC(cm, R_CORE[Math.round(li * 0.85)]);
    if (!a || !b) return (LAVA_C[li] = null);
    c = mkc(LV_W, LV_H);
    var t = c.getContext('2d');
    t.drawImage(a, 0, 0); t.drawImage(b, 0, 0);
    /* the per-step tints were only scaffolding for this canvas */
    lm.tc = null; lm.tcn = 0; cm.tc = null; cm.tcn = 0;
    return (LAVA_C[li] = c);
  }
  function sigilMask() {
    return bake('hall:sigil', SIG_X - 12, SIG_Y - 5, 24, 10, function (g, ox, oy, S, c) {
      g.fillStyle = c;
      for (var r = -3; r <= 3; r++) {
        var hw = sigilHW(r);
        if (hw < 2) continue;
        g.fillRect(ox + (SIG_X - hw) * S, oy + (SIG_Y + r) * S, (hw - 1) * S, S);
        g.fillRect(ox + (SIG_X + 1) * S, oy + (SIG_Y + r) * S, (hw - 1) * S, S);
      }
    });
  }
  function drawHall(g, e, d) {
    var room = d.room && d.room.grid ? d.room : (d.api && d.api.room);
    if (!room || !room.grid) return;
    var S = d.S, o = orig(e, d), cold = dead(), now = d.now, grid = room.grid, i;
    origin.x = o.x; origin.y = o.y; origin.S = S;
    blit(g, bake(cold ? 'hall:cold' : 'hall:hot', 0, 0, HW, HH, function (g2, ox, oy, S2) { paintHall(g2, ox, oy, S2, grid, cold); }),
         o.x, o.y, S);
    if (cold) return;
    var lv = run ? 1 : 0.3 + 0.25 * pulse(now, 0.45) + 0.45 * near, li = Math.round(clamp(lv) * 8);
    var lc = slow ? null : lavaComp(li);
    if (lc) g.drawImage(lc, o.x + LV_X * S, o.y + LV_Y * S, LV_W * S, LV_H * S);
    else { blitT(g, lavaMask(), o.x, o.y, S, R_LAVA[li]); blitT(g, coreMask(), o.x, o.y, S, R_CORE[Math.round(li * 0.85)]); }
    var sg = run ? (dbg.eye > 0 ? 1 : 0.55 + 0.1 * dbg.rings) : 0.3 + 0.55 * near * pulse(now, 0.4 + near);
    blitT(g, sigilMask(), o.x, o.y, S, rampAt(R_SIGIL, sg));
    if (still()) return;
    /* sparks running round the groove */
    var n = SPK.length >> 1, step = (now / 40) | 0;
    g.fillStyle = '#FFE6B0';
    for (i = 0; i < 10; i++) {
      var k = ((step + i * 29) % n) * 2;
      g.fillRect(o.x + SPK[k] * S, o.y + SPK[k + 1] * S, S, S);
    }
  }

  /* ── the altar ─────────────────────────────────────────────────── */
  /* three stepped tiers of bloodstone with gold on every lip, skulls set
     in the corners, bone horns, a gilded bowl: static, baked once, in
     altar-relative px. Its runes are a mask tinted from a ramp; the
     fire and the heart are live. */
  var HORN = ['.kk.....', 'kgk.....', 'kbk.....', 'kbk.....', 'kbbk....', 'kbbk....', '.kbbk...', '.kbBbk..',
              '..kbBbkk', '...kkBBk', '.....kkk'], HORN_P = { k: '#0B070D', b: '#A89E90', B: '#C8BEB0', g: '#E4C46A' };
  var ASKULL = ['.kkk.', 'kwwwk', 'kdwdk', '.kwk.'], ASKULL_P = { k: '#0B070D', w: '#A89E90', d: '#3A0A10' };
  function paintAltarStone(g, x, y, S) {
    function R(px, py, w, h, c) { g.fillStyle = c; g.fillRect(x + px * S, y + py * S, w * S, h * S); }
    var i, j, ch;
    R(-27, -12, 54, 12, '#0B070D');
    R(-26, -11, 52, 3, '#4A3044'); R(-26, -8, 52, 1, '#8A6A2A'); R(-26, -7, 52, 6, '#2A1A28'); R(-26, -2, 52, 1, '#170E15');
    R(-21, -21, 42, 10, '#0B070D');
    R(-20, -20, 40, 3, '#563650'); R(-20, -17, 40, 1, '#A8803A'); R(-20, -16, 40, 5, '#30202E');
    R(-15, -29, 30, 9, '#0B070D');
    R(-14, -28, 28, 2, '#6A4460'); R(-14, -26, 28, 1, '#C8A04A'); R(-14, -25, 28, 5, '#3A2636');
    R(-25, -11, 50, 1, '#5E3E56'); R(-19, -20, 38, 1, '#6E4A66'); R(-13, -28, 26, 1, '#7E5A74');
    for (i = 0; i < 4; i++) for (j = 0; j < 5; j++) {
      ch = ASKULL[i].charAt(j);
      if (ch === '.') continue;
      R(-25 + j, -7 + i, 1, 1, ASKULL_P[ch]); R(20 + j, -7 + i, 1, 1, ASKULL_P[ch]);
    }
    /* horns curling up and out off the top tier: bone, tipped in gold */
    for (i = 0; i < HORN.length; i++) for (j = 0; j < 8; j++) {
      ch = HORN[i].charAt(j);
      if (ch === '.') continue;
      R(-21 + j, -40 + i, 1, 1, HORN_P[ch]); R(20 - j, -40 + i, 1, 1, HORN_P[ch]);
    }
    /* the bowl */
    R(-10, -32, 20, 4, '#0B070D'); R(-9, -32, 18, 1, '#E4C46A'); R(-9, -31, 18, 1, '#8A6A2A'); R(-8, -30, 16, 1, '#3A2010');
  }
  function paintAltarRunes(g, x, y, S, c) {
    g.fillStyle = c;
    function R(px, py, w, h) { g.fillRect(x + px * S, y + py * S, w * S, h * S); }
    for (var i = 0; i < 7; i++) R(-18 + i * 6, -6 + (i & 1), 2, 3);
    R(-10, -15, 2, 2); R(-1, -16, 2, 3); R(8, -15, 2, 2); R(-16, -14, 1, 2); R(15, -14, 1, 2);
    R(-7, -24, 2, 2); R(5, -24, 2, 2); R(-1, -24, 2, 3);
  }
  /* a thin wisp of smoke off something that has gone out (3 rects) */
  function wisp(g, x, y, S, now, seed) {
    if (still()) return;
    g.globalAlpha = 0.35;
    g.fillStyle = '#6A6270';
    for (var i = 0; i < 3; i++) {
      var k = ((now / 1600 + seed * 0.37 + i / 3) % 1);
      g.fillRect(x + Math.round(Math.sin(now / 700 + i * 2 + seed) * 1.5) * S, y - Math.round(k * 16) * S, S, 2 * S);
    }
    g.globalAlpha = 1;
  }
  function drawAltar(g, e, d) {
    var S = d.S, x = d.sx, y = d.sy, now = d.now, cold = dead();
    function R(px, py, w, h, c) { g.fillStyle = c; g.fillRect(x + px * S, y + py * S, w * S, h * S); }
    blit(g, bake('altar:stone', -28, -40, 56, 41, function (g2, ox, oy, S2) { paintAltarStone(g2, ox, oy, S2); }), x, y, S);
    var rc = cold ? '#2A2028' : rampAt(R_RUNE, 0.3 + 0.7 * Math.max(near * pulse(now, 0.5 + near), run ? 1 : 0));
    blitT(g, bake('altar:runes', -28, -40, 56, 41, paintAltarRunes), x, y, S, rc);
    if (cold) {
      R(-7, -34, 14, 2, '#4A4048'); R(-4, -35, 8, 1, '#5A5058');
      wisp(g, x, y - 36 * S, S, now, 1);
      return;
    }
    /* brimstone fire in the bowl: dark root, red, orange, a white tip */
    var w = still() ? 1 : ((now / 90) | 0) % 3, big = run ? 7 : Math.round(near * 4);
    R(-7, -37 - w - big, 14, 5 + w + big, '#8A0A14');
    R(-6, -40 - w - big, 12, 8 + w + big, '#D0141A');
    R(-4, -43 - w - big, 8, 8 + w + big, '#FF4A1A');
    R(-2, -46 - w - big, 4, 7 + w, '#FF9A4A');
    R(-1, -47 - w - big, 2, 3, '#FFE6B0');
    R(-3, -35, 6, 3, '#2A0006');
    /* her heart, floating over the flame */
    var sh = NEU.sheets && NEU.sheets.heart;
    if (sh && NEU.sheetDraw) {
      var bob = still() ? 0 : Math.round(Math.sin(now / 420) * 2);
      NEU.sheetDraw(g, 'heart', x, y - (54 + bob + big) * S, { scale: Math.max(1, Math.round(S / 3)), anchor: 'feet', now: now, glow: !!run });
    }
  }

  /* ── broken columns ────────────────────────────────────────────── */
  function paintPillar(g, x, y, S, e) {
    var h = e.h || 28;
    function R(px, py, w, hh, c) { g.fillStyle = c; g.fillRect(x + px * S, y + py * S, w * S, hh * S); }
    R(-8, -6, 16, 6, '#0B070D'); R(-7, -5, 14, 4, '#3A3044'); R(-7, -5, 14, 1, '#8A6A2A');   /* plinth, gold lip */
    R(-6, -6 - h, 12, h, '#0B070D');
    R(-5, -6 - h, 3, h, '#5A4E68'); R(-2, -6 - h, 5, h, '#3A3048'); R(3, -6 - h, 2, h, '#221A2C');
    for (var f = 0; f < h; f += 7) R(-5, -6 - h + f, 10, 1, '#1A1422');   /* courses */
    /* a bloodstone vein down the shaft */
    R(0, -h + 2, 1, 4, '#5E161C'); R(1, -h + 6, 1, 3, '#5E161C'); R(0, -h + 9, 1, 2, '#3E1018');
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
    /* a gilded bowl on a black tripod, two horned prongs: baked */
    blit(g, bake('brazier:stand', -10, -19, 20, 20, function (g2, ox, oy, S2) {
      function Q(px, py, w, h, c) { g2.fillStyle = c; g2.fillRect(ox + px * S2, oy + py * S2, w * S2, h * S2); }
      Q(-6, -1, 3, 1, '#0B070D'); Q(3, -1, 3, 1, '#0B070D');
      Q(-5, -9, 2, 8, '#2A1E2A'); Q(-5, -9, 1, 8, '#4A3A4A'); Q(3, -9, 2, 8, '#2A1E2A'); Q(-1, -10, 2, 10, '#3A2C3A');
      Q(-4, -5, 8, 1, '#6E5020');
      Q(-8, -14, 16, 5, '#0B070D'); Q(-7, -14, 14, 1, '#E4C46A'); Q(-7, -13, 14, 1, '#8A6A2A'); Q(-7, -12, 14, 2, '#3A2636');
      Q(-6, -10, 12, 1, '#0B070D');
      Q(-10, -18, 3, 5, '#0B070D'); Q(-9, -17, 1, 4, '#B8903A'); Q(7, -18, 3, 5, '#0B070D'); Q(8, -17, 1, 4, '#B8903A');
    }), x, y, S);
    if (dead()) { R(-6, -15, 12, 1, '#4A4048'); R(-4, -16, 8, 1, '#5A5058'); wisp(g, x, y - 17 * S, S, now, e.x); return; }
    var f = still() ? 1 : ((now / 80 + e.x) | 0) % 4, up = Math.round(near * 3) + (run ? 3 : 0);
    var wv = [0, 1, 2, 1][f];
    R(-5, -18 - up, 10, 5 + up, '#8A0A14');
    R(-4, -22 - wv - up, 8, 9 + wv + up, '#E0201A');
    R(-3 + (f & 1), -25 - wv - up, 5, 8, '#FF6A2A');
    R(-1, -27 - wv - up, 2, 5, '#FFC27A');
    R(-2, -15, 4, 2, '#2A0006');                                        /* the dark core */
  }

  /* ── wall sconces ──────────────────────────────────────────────── */
  function drawSconce(g, e, d) {
    var S = d.S, x = d.sx, y = d.sy, now = d.now;
    function R(px, py, w, h, c) { g.fillStyle = c; g.fillRect(x + px * S, y + py * S, w * S, h * S); }
    blit(g, bake('sconce', -6, -22, 12, 9, function (g2, ox, oy, S2) {
      function Q(px, py, w, h, c) { g2.fillStyle = c; g2.fillRect(ox + px * S2, oy + py * S2, w * S2, h * S2); }
      Q(-3, -17, 6, 4, '#0B070D'); Q(-2, -16, 4, 2, '#6E5020'); Q(-2, -16, 4, 1, '#B8903A');
      Q(-1, -18, 2, 2, '#3A2C3A');
      Q(-5, -21, 10, 3, '#0B070D'); Q(-4, -21, 8, 1, '#E4C46A'); Q(-4, -20, 8, 1, '#8A6A2A');
    }), x, y, S);
    if (dead()) { wisp(g, x, y - 22 * S, S, now, e.x); return; }
    var w = still() ? 1 : (((now / 85) | 0) + e.x) % 3;
    R(-3, -24 - w, 6, 3 + w, '#B0101A');
    R(-2, -26 - w, 4, 4 + w, '#FF4A1A');
    R(-1, -27 - w, 2, 3, '#FFB070');
  }

  /* ── chains, and a gibbet on the longest ──────────────────────── */
  /* a chain is baked whole per (length, sway step): the sway is rounded
     to a whole px at its foot (-5..5) and spread down the links, so a
     swinging chain is one drawImage plus one for its end */
  var CHAIN_LEN = 66;
  function chainLayer(len, off) {
    return bake('chain:' + len + ':' + off, -7, 0, 15, len, function (g2, ox, oy, S2) {
      for (var i = 0; i < len; i += 3) {
        var cx = ox + Math.round(off * (i + 1.5) / len) * S2;
        g2.fillStyle = '#0B070D'; g2.fillRect(cx - S2, oy + i * S2, 3 * S2, 3 * S2);
        g2.fillStyle = (i / 3) & 1 ? '#4A4256' : '#6A6078';
        if ((i / 3) & 1) g2.fillRect(cx, oy + i * S2, S2, 3 * S2);
        else { g2.fillRect(cx - S2, oy + i * S2, S2, 3 * S2); g2.fillRect(cx + S2, oy + i * S2, S2, 3 * S2); }
      }
    });
  }
  function paintShackle(g2, ox, oy, S2) {
    function Q(px, py, w, h, c) { g2.fillStyle = c; g2.fillRect(ox + px * S2, oy + py * S2, w * S2, h * S2); }
    Q(-3, 0, 6, 4, '#0B070D'); Q(-2, 0, 4, 1, '#5A5068'); Q(-2, 0, 1, 3, '#5A5068');
  }
  function paintCage(g2, ox, oy, S2) {
    function Q(px, py, w, h, c) { g2.fillStyle = c; g2.fillRect(ox + px * S2, oy + py * S2, w * S2, h * S2); }
    Q(-1, 0, 2, 2, '#0B070D');
    Q(-6, 2, 12, 3, '#0B070D'); Q(-5, 2, 10, 1, '#6A6078');
    /* who is still in it */
    Q(-2, 6, 4, 4, '#0B070D'); Q(-2, 6, 3, 3, '#B8AEA0'); Q(-1, 7, 1, 1, '#1A1014');
    Q(0, 10, 1, 8, '#8A8078'); Q(-2, 11, 4, 1, '#8A8078'); Q(-2, 13, 4, 1, '#8A8078'); Q(-2, 15, 3, 1, '#7A7068');
    Q(4, 11, 1, 6, '#8A8078'); Q(5, 17, 1, 1, '#8A8078');                          /* an arm out through the bars */
    for (var bx = -6; bx <= 5; bx += 3) { Q(bx, 4, 1, 15, '#0B070D'); Q(bx, 5, 1, 13, (bx & 2) ? '#5A5068' : '#4A4256'); }
    Q(-6, 18, 12, 3, '#0B070D'); Q(-5, 18, 10, 1, '#6A6078');
  }
  function drawChain(g, e, d) {
    var S = d.S, x = d.sx, len = Math.min(CHAIN_LEN, e.len || 30), top = d.sy - (e.y + 1) * TILE * S;
    var sway = still() ? 0 : Math.sin(d.now / 1300 + e.x) * (1 + near * 2 + (run ? 2 : 0));
    var off = Math.max(-5, Math.min(5, Math.round(sway)));
    blit(g, chainLayer(len, off), x, top, S);
    var ex = x + off * S, ey = top + len * S;
    if (e.cage) blit(g, bake('chain:cage', -7, 0, 14, 22, paintCage), ex, ey, S);
    else blit(g, bake('chain:shackle', -3, 0, 6, 4, paintShackle), ex, ey, S);
  }

  /* ── skull piles ───────────────────────────────────────────────── */
  var SKULL = { rows: ['.kkk.', 'kwwwk', 'kdwdk', 'kwwwk', '.kwk.'],
                pal: { k: '#0B070D', w: '#B8AEA0', d: '#1A1014' } };
  var SKULL_DIM = { k: '#0B070D', w: '#7A7068', d: '#1A1014' };
  /* a pile is baked whole (one drawImage, was five stamps + two rects);
     some carry a stub of candle with a live flame */
  function drawSkulls(g, e, d) {
    var S = d.S, seed = e.x * 17 + e.y * 5;
    blit(g, bake('skulls:' + e.x + ',' + e.y, -10, -14, 21, 15, function (g2, ox, oy, S2) {
      function Q(px, py, w, h, c) { g2.fillStyle = c; g2.fillRect(ox + px * S2, oy + py * S2, w * S2, h * S2); }
      for (var i = 0; i < 5; i++) {
        var dx = Math.round((hash(seed + i) - 0.5) * 12), dy = -Math.round(hash(seed + i + 20) * 4) - (i > 2 ? 3 : 0);
        var pal = i & 1 ? SKULL_DIM : SKULL.pal;
        for (var r = 0; r < 5; r++) for (var c = 0; c < 5; c++) {
          var ch = SKULL.rows[r].charAt(c);
          if (ch !== '.') Q(dx - 2 + c, dy - 5 + r, 1, 1, pal[ch]);
        }
      }
      Q(-6, -1, 2, 1, '#6A6058'); Q(4, -2, 3, 1, '#6A6058');
      if (e.candle) { Q(-1, -13, 3, 6, '#0B070D'); Q(0, -12, 1, 5, '#D8CCB0'); Q(0, -13, 1, 1, '#2A2020'); }
    }), d.sx, d.sy, S);
    if (e.candle && !dead()) {
      var f = still() ? 0 : ((d.now / 110 + e.x) | 0) % 2;
      g.fillStyle = '#FF5A1A'; g.fillRect(d.sx, d.sy - (15 + f) * S, S, (2 + f) * S);
      g.fillStyle = '#FFE0A0'; g.fillRect(d.sx, d.sy - 14 * S, S, S);
    }
  }

  /* ── vents and the pillars of brimstone ────────────────────────── */
  /* the column is baked whole in six wobble frames (26 x 85 world px);
     growing is a source crop, so a column is ONE drawImage (was ~115
     fillRects, ~690 a frame with all six up) */
  function paintErupt(f) {
    return function (g2, ox, oy, S2) {
      function Q(px, py, w, h, c) { g2.fillStyle = c; g2.fillRect(ox + px * S2, oy + py * S2, w * S2, h * S2); }
      for (var j = 0; j < 80; j += 2) {
        var wob = Math.round(Math.sin(f / 6 * Math.PI * 2 + j * 0.3) * 1.5);
        var wide = 6 + (j < 8 ? 3 : 0) + ((j / 10) & 1) - (j > 66 ? 2 : 0) - (j > 72 ? 2 : 0);
        Q(-wide - 1 + wob, -4 - j, wide * 2 + 2, 2, '#5A0008');
        Q(-wide + wob, -4 - j, wide * 2, 2, '#A80E16');
        Q(-wide + 2 + wob, -4 - j, wide * 2 - 4, 2, '#FF3A1A');
        if (wide > 4) Q(-wide + 4 + wob, -4 - j, wide * 2 - 8, 2, '#FF8A3A');
        Q(-1 + wob, -4 - j, 2, 2, j % 6 ? '#FFC890' : '#FFF0D0');
      }
    };
  }
  function paintSplash(g2, ox, oy, S2) {
    function Q(px, py, w, h, c) { g2.fillStyle = c; g2.fillRect(ox + px * S2, oy + py * S2, w * S2, h * S2); }
    Q(-11, -5, 22, 4, '#5A0008'); Q(-9, -6, 18, 4, '#C0101A'); Q(-7, -7, 14, 3, '#FF5A1A'); Q(-4, -7, 8, 1, '#FFC890');
    Q(-13, -3, 2, 1, '#FF5A1A'); Q(11, -4, 2, 1, '#FF5A1A');
  }
  function drawVent(g, e, d) {
    var S = d.S, x = d.sx, y = d.sy, now = d.now, n = e.n || 0;
    function R(px, py, w, h, c) { g.fillStyle = c; g.fillRect(x + px * S, y + py * S, w * S, h * S); }
    R(-5, -6, 10, 4, '#0B070D');
    var on = erupted() > n;
    R(-4, -5, 8, 2, dead() ? '#1A1418' : on ? '#FF6A2A' : rampAt(R_VENT, near));
    if (!on) return;
    var since = T() - (ERUPT_T + n * ERUPT_STEP), hgt = Math.round(78 * clamp(since / 240)) & ~1;
    blit(g, bake('erupt:splash', -13, -8, 26, 8, paintSplash), x, y, S);
    if (hgt <= 0) return;
    var f = still() ? 0 : (((now / 70) | 0) + n) % 6;
    var b = bake('erupt:' + f, -13, -84, 26, 85, paintErupt(f));
    if (b.cv && !slow) {
      g.drawImage(b.cv, 0, 82 - hgt, 26, hgt, x - 13 * S, y + (-2 - hgt) * S, 26 * S, hgt * S);
      return;
    }
    for (var j = 0; j < hgt; j += 2) {
      var wob = still() ? 0 : Math.round(Math.sin(now / 70 + j * 0.3 + n) * 1.5);
      var wide = 6 + (j < 8 ? 3 : 0) + ((j / 10) & 1) - (j > hgt - 12 ? 2 : 0);
      R(-wide + wob, -4 - j, wide * 2, 2, '#A80E16');
      R(-wide + 2 + wob, -4 - j, wide * 2 - 4, 2, '#FF3A1A');
      R(-1 + wob, -4 - j, 2, 2, j % 6 ? '#FFC890' : '#FFF0D0');
    }
  }

  /* ── lights: brimstone red, redder and wider the closer you are ── */
  function lightAt(e, p) {
    if (dead()) return null;
    var boost = run ? 1 : 0;
    if (e.v === 'brazier') return { r: 54 + 30 * p + 20 * boost, col: rampAt(R_BRZ, p), glow: 0.28 + 0.16 * p, flicker: true };
    if (e.v === 'altar') return { r: 34 + 44 * p + 30 * boost, col: rampAt(R_ALT, p), glow: 0.3 + 0.2 * p + 0.2 * boost, flicker: true };
    if (e.v === 'sconce') return { r: 30 + 12 * p, col: '#FF4A2A', glow: 0.22, flicker: true };
    if (e.v === 'vent') return erupted() > (e.n || 0) ? { r: 70, col: '#FF3A1A', glow: 0.42, flicker: true }
                                                     : (p > 0.3 ? { r: 10 + 10 * p, col: '#8A1010', glow: 0.12 } : null);
    return null;
  }

  var FLOOR = { hall: drawHall, circle: drawCircle, cracks: drawCracks };
  KK.kind('scalfloor', {
    interactive: function () { return false; },
    floor: true,
    draw: function (g, e, d) { var f = FLOOR[e.v] || drawCracks; f(g, e, d); },
    light: function (e) {
      if (e.v !== 'circle' || dead()) return null;
      var lit = ringsLit();
      if (lit) return { r: 50 + 18 * lit, col: '#FF2A14', glow: 0.14 + 0.05 * lit };
      return near > 0.2 ? { r: 30 * near, col: '#A0101A', glow: 0.1 * near } : null;
    }
  });

  /* `plaque`: the brass plaques are painted into the wall; this is only
     the thing you press E at */
  var DRAW = { altar: drawAltar, pillar: drawPillar, brazier: drawBrazier, chain: drawChain,
               skulls: drawSkulls, vent: drawVent, sconce: drawSconce, plaque: function () {} };
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
  /* (gutters too: 6.5,3.8 / 14.5,3.8 / 6,10 / 15,10 are where they run) */
  var SOURCES = [[6.5, 2], [14.5, 2], [5.5, 11], [15.5, 11], [10.5, 4.4], [10.5, 4.4], [6.5, 10.5], [15.5, 6.5],
                 [6.5, 3.8], [14.5, 3.8], [6, 10], [15, 10], [10.5, 1.8]];
  /* the six vents' feet: once they erupt, most embers come off the columns */
  var VENTS = [[10.5, 3], [14.5, 5], [14.5, 9], [10.5, 11], [6.5, 9], [6.5, 5]];
  /* an ember cools as it dies: white-gold, orange, red, ember-brown */
  var EMBER_COL = ['#7A0A0E', '#FF2A14', '#FF7A2A', '#FFE0A0'];
  /* re-seeds `m` in place (no allocation per respawn) */
  function newEmber(spread, m) {
    m = m || {};
    var s, col = run && dbg.erupted > 0 && Math.random() < 0.65;
    if (col) {
      s = VENTS[(Math.random() * Math.min(6, dbg.erupted)) | 0];
      m.x = s[0] * TILE + (Math.random() - 0.5) * 16; m.y = s[1] * TILE - Math.random() * 70;
    } else {
      s = SOURCES[(Math.random() * SOURCES.length) | 0];
      m.x = s[0] * TILE + (Math.random() - 0.5) * 10; m.y = s[1] * TILE + (spread ? -Math.random() * 60 : 0);
    }
    m.v = (col ? 22 : 10) + Math.random() * 16; m.life = 1.5 + Math.random() * 2.5; m.ph = Math.random() * 6;
    m.s = Math.random() < 0.25 ? 2 : 1;
    return m;
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

  /* the after: a hole in the vault and one pale shaft down onto the
     cold altar. Three stepped bands, alpha baked in, world px. */
  var SHAFT_L = 148, SHAFT_DL = 0.12, SHAFT_R = 186, SHAFT_DR = 0.22, SHAFT_H = 122, SHAFT_MOTES = 9;
  function shaftLayer() {
    return bake('shaft', 130, 0, 110, 140, function (g2, ox, oy, S2) {
      var inset = [0, 5, 11], al = [0.06, 0.06, 0.08], b, y;
      g2.fillStyle = '#E8E0FF';
      for (b = 0; b < 3; b++) {
        g2.globalAlpha = al[b];
        for (y = 0; y < SHAFT_H; y += 2) {
          var l = Math.round(SHAFT_L + y * SHAFT_DL) + inset[b], r = Math.round(SHAFT_R + y * SHAFT_DR) - inset[b];
          g2.fillRect(ox + l * S2, oy + y * S2, (r - l) * S2, 2 * S2);
        }
        /* where it lands: a stepped pool on the floor */
        var cx = Math.round((SHAFT_L + SHAFT_R + SHAFT_H * (SHAFT_DL + SHAFT_DR)) / 2), hw = 30 - inset[b] * 2;
        for (y = -6 + b * 2; y <= 6 - b * 2; y += 2) {
          var w = Math.round(hw * Math.sqrt(1 - (y * y) / 49));
          g2.fillRect(ox + (cx - w) * S2, oy + (SHAFT_H + 4 + y) * S2, w * 2 * S2, 2 * S2);
        }
      }
      g2.globalAlpha = 1;
    });
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
    /* after: a shaft of pale light down onto the cold altar (baked,
       one drawImage), with the first few motes of ash turning in it */
    if (cold) blit(g, shaftLayer(), ox, oy, S);
    for (i = 0; i < ash.length; i++) {
      var f = ash[i];
      if (cold && i < SHAFT_MOTES) {
        if (moving) { f.y += f.v * 0.35 * dt; if (f.y > SHAFT_H) f.y = 0; }
        var sl = SHAFT_L + f.y * SHAFT_DL, sr = SHAFT_R + f.y * SHAFT_DR;
        g.fillStyle = '#E8E0FF';
        g.fillRect(ox + Math.round(sl + (sr - sl) * (f.ph / 6.3) + (still() ? 0 : Math.sin(now / 1300 + f.ph) * 3)) * S,
                   oy + Math.round(f.y) * S, S, S);
        continue;
      }
      if (moving) { f.y += f.v * dt; f.x += Math.sin(now / 900 + f.ph) * 4 * dt; if (f.y > 13 * TILE) { f.y = 0; f.x = Math.random() * 21 * TILE; } }
      g.fillStyle = cold ? '#8A8290' : '#5A5260';
      g.fillRect(ox + Math.round(f.x) * S, oy + Math.round(f.y) * S, f.s * S, f.s * S);
    }
    if (!cold) for (i = 0; i < embers.length; i++) {
      var m = embers[i];
      if (moving) {
        m.y -= m.v * speed * dt; m.x += Math.sin(now / 400 + m.ph) * 8 * dt; m.life -= dt * (0.6 + near);
        if (m.life <= 0 || m.y < 0) newEmber(false, m);
      }
      g.globalAlpha = Math.min(1, m.life);
      g.fillStyle = EMBER_COL[m.life > 3 ? 3 : m.life > 1.6 ? 2 : m.life > 0.6 ? 1 : 0];
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

  /* her eye, baked per opening step (half = rows open each side, 0..10):
     a gold-cornered almond, a red sclera with veins, a stepped iris of
     orange to gold, and a black slit */
  var EYE_W = 34;
  function eyeLayer(half) {
    return bake('eye:' + half, -40, -12, 80, 24, function (g2, ox, oy, S2) {
      function Q(x, y, w, h, c) { if (w > 0) { g2.fillStyle = c; g2.fillRect(ox + x * S2, oy + y * S2, w * S2, h * S2); } }
      for (var r = -10; r <= 10; r++) {
        var hw = Math.round(EYE_W * Math.sqrt(Math.max(0, 1 - (r * r) / 121)));
        if (!hw) continue;
        var ar = Math.abs(r);
        if (ar > half) { Q(-hw, r, hw * 2, 1, ar === half + 1 ? '#6A0A12' : '#1A0004'); continue; }
        Q(-hw - 1, r, hw * 2 + 2, 1, '#E4C46A');
        Q(-hw, r, hw * 2, 1, ar >= half - 1 ? '#FFB070' : '#8A0A12');
        if (ar < half - 1) Q(-hw + 3, r, hw * 2 - 6, 1, '#C0141A');
        var iw = Math.round(12 * Math.sqrt(Math.max(0, 1 - (r * r) / 110)));
        if (iw > 0 && ar < half) {
          Q(-iw, r, iw * 2, 1, '#E0301A');
          if (iw > 3) Q(-iw + 2, r, iw * 2 - 4, 1, '#FF7A2A');
          if (iw > 6) Q(-iw + 5, r, iw * 2 - 10, 1, '#FFC860');
          if (ar <= 8) { Q(-2, r, 4, 1, '#3A0006'); Q(-1, r, 2, 1, '#000000'); }
        }
      }
      if (half >= 6) {
        Q(-29, -1, 6, 1, '#5A0008'); Q(-24, 1, 4, 1, '#5A0008'); Q(-20, 2, 2, 1, '#5A0008');
        Q(23, 0, 6, 1, '#5A0008'); Q(20, -2, 3, 1, '#5A0008'); Q(18, 2, 2, 1, '#5A0008');
      }
    });
  }
  /* the pillar of light behind her: four stepped bands, 1 px tall,
     stretched from the top of the screen to her feet */
  function beamLayer() {
    return bake('beam', -14, 0, 28, 1, function (g2, ox, oy, S2, c, hh) {
      var H = hh || 1, B = [[14, '#5A0008'], [10, '#A0101A'], [6, '#FF4A1A'], [2, '#FFD0A0']];
      for (var i = 0; i < 4; i++) { g2.fillStyle = B[i][1]; g2.fillRect(ox - B[i][0] * S2, oy, B[i][0] * 2 * S2, H); }
    });
  }
  /* one tongue of the wreath (fl = height, hot = which side the tip leans) */
  function tongueLayer(fl, hot) {
    return bake('tongue:' + fl + ':' + hot, -3, -(fl + 1), 6, fl + 2, function (g2, ox, oy, S2) {
      function Q(x, y, w, h, c) { g2.fillStyle = c; g2.fillRect(ox + x * S2, oy + y * S2, w * S2, h * S2); }
      Q(-3, -(fl + 1), 6, fl + 2, '#5A0008'); Q(-2, -fl, 4, fl, '#C0101A');
      Q(-1, -(fl - 1), 2, fl - 3, '#FF5A1A'); Q(-hot, -(fl - 1), 1, 2, '#FFD890');
    });
  }

  function paintSummon(now, S, cx, cy, w, h) {
    var t = T(), u = S, i;
    /* the eye: an almond of brimstone, lids parting row by row */
    var eye = dbg.eye, fadeEye = 1 - clamp((t - RISE_T) / 600);
    if (eye > 0 && fadeEye > 0) {
      var ey = cy - 40 * u, half = Math.round(10 * (still() ? 1 : eye));
      g.globalAlpha = (still() ? eye : 1) * fadeEye;
      /* baked per opening step (11 bitmaps): one drawImage */
      blit(g, eyeLayer(half), cx, ey, u);
      /* tongues of light around it, flaring outward as it opens */
      for (i = 0; i < 12; i++) {
        var a = i / 12 * Math.PI * 2, rr = 42 + (i & 1) * 7;
        g.fillStyle = i & 1 ? '#FFB070' : '#FF3A1A';
        g.fillRect(cx + Math.round(Math.cos(a) * rr * eye) * u - u, ey + Math.round(Math.sin(a) * rr * 0.5 * eye) * u - u,
                   2 * u, (i & 1 ? 2 : 3) * u);
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
      /* a pillar of brimstone light behind her, from the vault to her feet */
      var bw = Math.max(1, Math.round(sc * 0.7)), bm = beamLayer();
      g.globalAlpha = rise * 0.5;
      if (bm.cv && !slow) g.drawImage(bm.cv, Math.round(cx - 14 * bw), 0, 28 * bw, Math.max(1, Math.round(sy)));
      else bm.paint(g, Math.round(cx), 0, bw, null, Math.max(1, Math.round(sy)));
      g.globalAlpha = rise;
      for (i = 0; i < n; i++) {
        var aa = i / n * Math.PI * 2 + spin, fx = Math.round(cx + Math.cos(aa) * wr * Math.min(1, rise * 1.4)),
            fy = Math.round(wy + Math.sin(aa) * wr * Math.min(1, rise * 1.4)),
            fl = still() ? 7 : 6 + ((i * 7 + ((now / 90) | 0)) % 4);
        blit(g, tongueLayer(fl, i & 1), fx, fy, q);
      }
      /* the floor gives as she comes up: chunks of it thrown outward */
      var dt0 = t - RISE_T;
      if (!still() && dt0 < 800) {
        var kk = dt0 / 800;
        for (i = 0; i < 12; i++) {
          var da = i / 12 * Math.PI * 2 + 0.3, dist = (26 + 64 * kk) * u;
          g.fillStyle = i & 1 ? '#FF5A1A' : '#3A2A3A';
          g.fillRect(Math.round(cx + Math.cos(da) * dist),
                     Math.round(cy + Math.sin(da) * dist * 0.5 - Math.sin(kk * Math.PI) * (30 + (i % 3) * 12) * u), 2 * u, 2 * u);
        }
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
