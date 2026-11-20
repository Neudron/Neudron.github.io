/* polt-fx.js — Polterghast's VFX authority: one palette per fight, shape-true
   telegraphs, and cached glow without ctx.filter or per-frame pixel reads.

   Study, not a port: the ramp/telegraph/glow TECHNIQUES were measured from
   WotG and Scal, but WotG is all-rights-reserved. No code or shader copied.

   Everything here is ES5 on window.NEU, guards its own DOM lookups and
   allocates nothing per frame: warn records are pooled by reuse, rays are
   precomputed by polt-attacks, rings are stepped with fillRect, and the glow
   buffer is one offscreen canvas resized only on a geometry change. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var TAU = Math.PI * 2;

  /* VIP-03: the two agreed six-step ramps, dark -> white. One source of
     truth for every saturated pixel this fight adds. Scal's BRIM and the
     shared kit keep their own palettes; nothing here touches them. */
  var PAL = {
    ECTO: { name: 'ECTO',
      ramp: ['#02100e', '#0d3b36', '#1f8f7c', '#5fe0c4', '#c4fff0', '#ffffff'],
      rgb: [[2, 16, 14], [13, 59, 54], [31, 143, 124], [95, 224, 196], [196, 255, 240], [255, 255, 255]] },
    RED: { name: 'RED',
      ramp: ['#1a0008', '#5a0018', '#c0143a', '#ff3a64', '#ff9aae', '#fff0f4'],
      rgb: [[26, 0, 8], [90, 0, 24], [192, 20, 58], [255, 58, 100], [255, 154, 174], [255, 240, 244]] }
  };
  /* VIP-02: one reservation. Red = not-yet-lethal tell, white-gold = the
     frame the hitbox goes live, black under-stroke keeps both readable
     over an explosion. A safe gap uses ECTO[3], not a new hue. */
  var WARN = { warn: '#FF5D73', commit: '#FFD98A', ink: '#000000', life: 24 };
  var KINDS = ['line', 'rect', 'fan', 'ring', 'safe'];
  /* Explicit danger-layer order. Bullets are drawn by the fight itself,
     between warn and card; this array documents that placement. */
  var LAYERS = ['ghost', 'warn', 'bullets', 'card'];
  var LIFE_MIN = 24, LIFE_MAX = 30;

  function clamp(n, lo, hi) { return n < lo ? lo : n > hi ? hi : n; }
  function bump(t, a, b, peak, c) {
    if (t < a || t > c) return 0;
    if (t < b) return (t - a) / (b - a);
    if (t < peak) return 1;
    return (c - t) / (c - peak);
  }
  function pal(p) { return typeof p === 'string' ? PAL[p] : p; }

  /* ── VIP-02: warnings ──────────────────────────────────────────────
     The life is FRAMES at 60 Hz, never seconds. A warn issued 24 frames
     before its hit expires exactly as the hitbox goes live. */
  var warns = [];
  function warn(o) {
    if (!o) return null;
    var k = o.kind || 'line';
    if (KINDS.indexOf(k) < 0) k = 'line';
    var r = {
      kind: k, x: o.x || 0, y: o.y || 0, a: o.a || 0,
      r: o.r || 0, spread: o.spread || 0, len: o.len || 0,
      w: o.w || 0, h: o.h || 0,
      lines: o.lines || null, safe: !!o.safe || k === 'safe',
      compat: !!o.compat, phase: o.phase || 1,
      life: clamp(o.life || LIFE_MIN, LIFE_MIN, LIFE_MAX), age: 0
    };
    warns.push(r);
    return r;
  }
  function step(dt) {
    for (var i = warns.length - 1; i >= 0; i--) {
      warns[i].age += dt;
      if (warns[i].age >= warns[i].life / 60) warns.splice(i, 1);
    }
    gCool -= dt;
    for (i = 0; i < GHOSTS; i++) if (ghosts[i].a > 0) ghosts[i].a = Math.max(0, ghosts[i].a - dt * GHOST_A / GHOST_LIFE);
    if (card.text) { card.age += dt; if (card.age >= CARD_F / 60) card.text = ''; }
  }
  function clear() {
    warns.length = 0; card.text = '';
    for (var i = 0; i < GHOSTS; i++) ghosts[i].a = 0;
  }

  /* WK2: shake budget. NEU.juice decays trauma at 1.5/s, so 0.2 trauma is
     gone in 8 frames; a Polt hit passes shake(tier) as its opts.shake, which tops
     trauma up to that ceiling, never past it. Reduced motion / photosensitive stay gated inside juice.hit. */
  var SHAKE_MAX = 0.2;
  function shake(tier) {
    var j = NEU.juice, t;
    if (!j) return undefined;
    t = j.tiers[tier] || j.tiers.small;
    return Math.min(t.shake, Math.max(0, SHAKE_MAX - j.trauma));
  }

  /* WK2: charge afterimages. Four pooled ghosts, one per 4 frames, fading
     over 12 frames from 0.4 alpha; no flicker. The caller skips both
     ghost() and eachGhost() under reduced motion. */
  var GHOSTS = 4, GHOST_LIFE = 0.2, GHOST_A = 0.4, ghosts = [], gCool = 0, gi;
  for (gi = 0; gi < GHOSTS; gi++) ghosts.push({ x: 0, y: 0, a: 0 });
  function ghost(x, y) {
    if (NEU.juice && NEU.juice.degrade >= 2) return;   /* degrade: no decorative ghosts */
    if (gCool > 0.001) return;   /* float slack: 4 frames of dt land at ~0 */
    for (var i = 0; i < GHOSTS; i++) if (ghosts[i].a <= 0) {
      ghosts[i].x = x; ghosts[i].y = y; ghosts[i].a = GHOST_A; gCool = 4 / 60;
      return;
    }
  }
  function eachGhost(fn) {
    for (var i = 0; i < GHOSTS; i++) if (ghosts[i].a > 0) fn(ghosts[i]);
  }

  /* WK2: phase title card, 90 frames. Fades in/out; reduced motion shows
     it static for the same time. Draw-only, never touches input. */
  var CARD_F = 90, card = { text: '', age: 0 };
  function titleCard(text) { card.text = text || ''; card.age = 0; }
  function drawCard(ctx, cx, cy, o) {
    if (!ctx || !card.text) return;
    o = o || {};
    var t = card.age / (CARD_F / 60);
    var a = o.reduced ? 1 : clamp(t / 0.15, 0, 1) * clamp((1 - t) / 0.25, 0, 1);
    ctx.font = '32px "Determination Mono","Pixelify Sans",monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = a; ctx.fillStyle = WARN.ink;
    ctx.fillText(card.text, cx + 2, cy + 2);
    ctx.fillStyle = (pal(o.pal) || PAL.ECTO).ramp[4];
    ctx.fillText(card.text, cx, cy);
    ctx.globalAlpha = 1; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  /* Straight runs: the under-stroke is 2px black, the tell is 1px. `dots`
     is the old dotted read, kept as a redundant channel (VIP-02 proof and
     the existing Polt suites pin its colour). No array is built here. */
  function run(ctx, ln, col, alpha, thick) {
    var dx = Math.cos(ln.a) * ln.len, dy = Math.sin(ln.a) * ln.len;
    var n = Math.max(2, Math.min(32, (ln.len / 32) | 0)), s, u;
    ctx.globalAlpha = alpha; ctx.fillStyle = col;
    for (s = 0; s <= n; s++) {
      u = s / n;
      ctx.fillRect((ln.x + dx * u - thick) | 0, (ln.y + dy * u - thick) | 0, thick * 2, thick * 2);
    }
  }
  function ring(ctx, w, col, alpha, thick) {
    var n = clamp((w.r / 8) | 0, 12, 48), i, a, x, y;
    ctx.globalAlpha = alpha; ctx.fillStyle = col;
    for (i = 0; i < n; i++) {
      a = i * TAU / n; x = w.x + Math.cos(a) * w.r; y = w.y + Math.sin(a) * w.r;
      ctx.fillRect((x - thick) | 0, (y - thick) | 0, thick * 2, thick * 2);
    }
  }
  function rect(ctx, w, col, alpha, thick, dashed) {
    var x = w.x | 0, y = w.y | 0, ww = w.w | 0, hh = w.h | 0, i;
    ctx.globalAlpha = alpha; ctx.fillStyle = col;
    if (!dashed) {
      ctx.fillRect(x, y, ww, thick * 2); ctx.fillRect(x, y + hh - thick * 2, ww, thick * 2);
      ctx.fillRect(x, y, thick * 2, hh); ctx.fillRect(x + ww - thick * 2, y, thick * 2, hh);
      return;
    }
    for (i = x; i < x + ww; i += 16) {
      ctx.fillRect(i, y, 8, thick * 2); ctx.fillRect(i, y + hh - thick * 2, 8, thick * 2);
    }
    for (i = y; i < y + hh; i += 16) {
      ctx.fillRect(x, i, thick * 2, 8); ctx.fillRect(x + ww - thick * 2, i, thick * 2, 8);
    }
  }
  function fan(ctx, w, col, alpha, thick) {
    var i, fake, n = w.lines ? w.lines.length : 1;
    if (!w.lines) {
      fake = { x: w.x, y: w.y, a: w.a, len: w.len || 400 };
      run(ctx, fake, col, alpha, thick);
      return;
    }
    for (i = 0; i < n; i++) run(ctx, w.lines[i], col, alpha, thick);
  }

  /* Drawn AFTER VFX and BEFORE bullets. `compat` keeps the pre-existing
     dotted read so old proof stays true; the new shape-true outline is the
     readable layer. Reduced motion removes the fade, not the telegraph. */
  function drawWarns(ctx, o) {
    if (!ctx) return;
    o = o || {};
    var reduced = !!o.reduced, i, w, t, fade, col, oldCol, oldA, j, ln;
    for (i = 0; i < warns.length; i++) {
      w = warns[i];
      t = clamp(w.age / (w.life / 60), 0, 1);
      fade = reduced ? 1 : clamp((1 - t) / 0.22, 0, 1) * clamp(t / 0.14, 0, 1);
      col = w.safe ? PAL.ECTO.ramp[3] : (t >= 0.8 ? WARN.commit : WARN.warn);

      /* 1. black under-stroke: the tell reads over white bloom */
      if (w.kind === 'rect' || w.kind === 'safe') rect(ctx, w, WARN.ink, fade, 2, w.safe);
      else if (w.kind === 'ring') ring(ctx, w, WARN.ink, fade, 2);
      else fan(ctx, w, WARN.ink, fade, 2);

      /* 2. the shape that will actually hit: warn -> commit at the last fifth */
      if (w.kind === 'rect' || w.kind === 'safe') rect(ctx, w, col, fade, 1, w.safe);
      else if (w.kind === 'ring') ring(ctx, w, col, fade, 1);
      else fan(ctx, w, col, fade, 1);

      /* 3. compat dotted ray: same colour and fade as the pre-fx fight.
         One alpha for every dot under reduced motion (static telegraph). */
      if (w.compat && w.lines && w.lines.length) {
        oldCol = o.compatCol || ((w.phase === 3 || o.phase === 3) ? '#E04A6B' : '#C4FFF0');
        oldA = reduced ? 1 : bump(t, 0, 0.08, 0.27, 0.75);
        for (j = 0; j < w.lines.length; j++) { ln = w.lines[j]; run(ctx, ln, oldCol, oldA, 1); }
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ── VIP-03 / VIP-07: cached radial stamps + one half-res additive
     buffer. No ctx.filter, no shadowBlur, no getImageData. The stamp is
     built once per palette/index and reused; the buffer is resized only
     when the viewport geometry changes. */
  var stamps = {}, glowBuf = null, glowW = 0, glowH = 0;
  function glowStamp(p, idx) {
    p = pal(p);
    if (!p) return null;
    idx = idx === undefined ? 5 : (idx | 0);
    var key = p.name + ':' + idx;
    if (stamps[key] !== undefined) return stamps[key];
    var c = null;
    try {
      c = document.createElement('canvas'); c.width = c.height = 64;
      var g = c.getContext && c.getContext('2d');
      if (!g || !g.createRadialGradient) c = null;
      else {
        var r = p.rgb, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, 'rgb(' + r[5].join(',') + ')');
        gr.addColorStop(0.18, 'rgb(' + r[4].join(',') + ')');
        gr.addColorStop(0.45, 'rgba(' + r[3].join(',') + ',0.55)');
        gr.addColorStop(1, 'rgba(' + r[1].join(',') + ',0)');
        g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      }
    } catch (e) { c = null; }
    stamps[key] = c;
    return c;
  }
  function beginGlow(w, h) {
    var bw = Math.max(1, w >> 1), bh = Math.max(1, h >> 1), g;
    if (!glowBuf) {
      try { glowBuf = document.createElement('canvas'); } catch (e) { return null; }
    }
    if (!glowBuf || !glowBuf.getContext) return null;
    if (glowW !== bw || glowH !== bh) {
      glowBuf.width = bw; glowBuf.height = bh; glowW = bw; glowH = bh;
    }
    g = glowBuf.getContext('2d');
    if (!g) return null;
    g.clearRect(0, 0, bw, bh);
    g.globalCompositeOperation = 'lighter';
    return g;
  }
  function stampGlow(g, x, y, r, p, idx, alpha) {
    var im = glowStamp(p, idx), s;
    if (!g || !im) return;
    s = Math.max(2, r | 0);
    g.globalAlpha = alpha;
    g.drawImage(im, (x - s) | 0, (y - s) | 0, s << 1, s << 1);
    g.globalAlpha = 1;
  }
  function endGlow(ctx, w, h) {
    if (!glowBuf || !ctx) return;
    var a = ctx.globalAlpha, sm = ctx.imageSmoothingEnabled;
    ctx.globalAlpha = 0.35; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(glowBuf, 0, 0, w, h);
    ctx.globalAlpha = a; ctx.imageSmoothingEnabled = sm;
  }
  /* Decorative ramp cycle: 4-6 frames per step. Never applied to a bullet
     or a telegraph - those keep a fixed reservation colour. */
  function rampStep(t, period) {
    var n = clamp(period || 5, 4, 6);
    return Math.floor(t * 60 / n) % 6;
  }
  function stats() {
    return {
      palettes: [PAL.ECTO.name, PAL.RED.name],
      rampSteps: PAL.ECTO.ramp.length,
      kinds: KINDS.slice(),
      warn: WARN.warn, commit: WARN.commit,
      life: [LIFE_MIN, LIFE_MAX],
      stamps: (function () { var k, n = 0; for (k in stamps) if (stamps.hasOwnProperty(k)) n++; return n; })(),
      buffer: glowBuf ? glowW + 'x' + glowH : null,
      live: warns.length
    };
  }

  /* One layered draw entry. The fight never calls drawWarns/drawCard/
     eachGhost directly; it routes every VFX layer through here. */
  function drawFx(ctx, layer, o) {
    o = o || {};
    if (layer === 'warn') drawWarns(ctx, o);
    else if (layer === 'card') drawCard(ctx, o.cx, o.cy, o);
    else if (layer === 'ghost' && !o.reduced && o.ghost) eachGhost(o.ghost);
  }

  NEU.poltFx = {
    PAL: PAL, WARN: WARN, KINDS: KINDS, LAYERS: LAYERS, drawFx: drawFx,
    warns: warns,
    pal: pal,
    ramp: function (t, p) { var q = pal(p); return q ? q.ramp[clamp(t, 0, 5) | 0] : null; },
    rampStep: rampStep,
    bump: bump, clamp: clamp,
    warn: warn, step: step, clear: clear, drawWarns: drawWarns,
    shake: shake, SHAKE_MAX: SHAKE_MAX, ghosts: ghosts, ghost: ghost, eachGhost: eachGhost,
    card: titleCard, drawCard: drawCard, cardOn: function () { return !!card.text; },
    glow: {
      stamp: glowStamp,
      begin: beginGlow,
      draw: stampGlow,
      end: endGlow
    },
    stats: stats
  };
})();
