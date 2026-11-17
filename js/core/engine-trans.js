/* engine-trans.js — transition registry and scene bridge. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var kinds = {}, enabled = { woods: 1, castle: 1 }, active = null;
  var waterAt = { x: 0.5, y: 0.7 };   /* splash point, in screen fractions */
  function kind(name, def) { kinds[name] = def; return def; }
  function get(name) { return kinds[name] || null; }
  function start(name, canvas, dir, reduced, incoming, opts) {
    var k = get(name), snapshot;
    if (active) return active;
    if (!k) return null;
    /* reduced motion: a plain cut (the old frame held 150 ms, no wipe) for the themed mode-entry kinds, none for the rest */
    if (reduced && !k.cut) { active = null; return null; }
    if (name === 'mode' && !canvas) {
      snapshot = NEU.kernel && NEU.kernel.bridge && NEU.kernel.bridge();
      if (!snapshot) { active = null; return null; }
      canvas = snapshot;
    }
    active = { name: name, def: k, canvas: canvas, incoming: incoming || null, dir: dir || k.dir || 'right', t: 0, ms: reduced ? k.cut : opts && opts.ms || k.ms,
      wall: opts && opts.wall || '#16141E', look: opts && opts.look || '#280204', reduced: !!reduced };
    if (k.pre) k.pre(active);
    if (k.cover) k.cover(active);
    return active;
  }
  function step(dt) {
    if (!active) return false;
    active.t = Math.min(1, active.t + dt * 1000 / active.ms);
    if (active.t >= 1) { var a = active; active = null; if (a.def.post) a.def.post(a); return false; }
    return true;
  }
  function motion(w, h, scale) {
    if (!active) return null;
    var t = 1 - Math.pow(1 - active.t, 3), d = active.dir;
    var x = d === 'right' ? w : d === 'left' ? -w : 0;
    var y = d === 'down' ? h : d === 'up' ? -h : 0;
    return { t: t, x: Math.round(x * (1 - t) / scale) * scale,
      y: Math.round(y * (1 - t) / scale) * scale,
      oldX: d === 'right' ? Math.round(x * (1 - t) / scale) * scale - w : d === 'left' ? Math.round(x * (1 - t) / scale) * scale + w : Math.round(-x * t / scale) * scale,
      oldY: d === 'down' ? Math.round(y * (1 - t) / scale) * scale - h : d === 'up' ? Math.round(y * (1 - t) / scale) * scale + h : Math.round(-y * t / scale) * scale };
  }
  /* the fall: the old frame drops out through a brick shaft that lights up from below (dungeon entry, mode:dungeon) */
  function drawFall(ctx, w, h, scale, active) {
    var t = active.t, oldY = -Math.round(t * h), shaftY = Math.round((1 - t) * h), newY = Math.round((2.5 - 2.5 * t) * h);
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.fillStyle = active.wall; ctx.fillRect(0, 0, w, h);
    /* brick courses, warm at the bottom: the hall below lights the shaft */
    for (var y = 0; y < h * 1.5; y += 16 * scale) {
      var row = (y / (16 * scale) | 0) % 2, deep = y / (h * 1.5);
      ctx.fillStyle = deep > 0.7 ? (row ? '#2E1E18' : '#3A2518')
                                 : (row ? active.wall : '#201B28');
      ctx.fillRect(0, shaftY + y, w, 8 * scale);
    }
    for (var k = 0; k < 4; k++) {
      ctx.globalAlpha = 0.04 * (4 - k);
      ctx.fillStyle = '#FF8A3A';
      ctx.fillRect(0, shaftY + h * 1.5 - (k + 1) * 16 * scale, w, 16 * scale);
    }
    ctx.globalAlpha = 1;
    if (active.canvas) ctx.drawImage(active.canvas, 0, oldY, w, h);
    if (active.incoming) ctx.drawImage(active.incoming, 0, newY, w, h);
    ctx.restore();
  }
  /* mode entry, boss fight: the old frame holds, then the picture snaps to the fight's first look (the field colour over
     the new frame) with ONE flash: white, 0.9 fading to 0 over 0.75 of the 480 ms (360 ms, over the 0.34 s floor).
     The flash toggle (and calm motion) turn the white into a dim of the same shape. */
  function drawBoss(ctx, w, h, scale, a) {
    var cut = 0.25, u = a.t < cut ? 0 : (a.t - cut) / (1 - cut), calm = NEU.juice && NEU.juice.noFlash;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    var src = a.t < cut ? a.canvas : (a.incoming || a.canvas);
    if (src) ctx.drawImage(src, 0, 0, w, h);
    if (a.t >= cut) {
      ctx.globalAlpha = 0.45 * (1 - u); ctx.fillStyle = a.look; ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = (calm ? 0.25 : 0.9) * (1 - u); ctx.fillStyle = calm ? '#000000' : '#FFFFFF'; ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }
  /* mode entry, rhythm and quiz: channel static. Bands of grey re-rolled at most 3 times a second (stepped, never a
     flicker): thin over the old frame, thick, then thin over the new one. */
  var STATIC_COVER = [0.35, 0.85, 0.35];
  function drawStatic(ctx, w, h, scale, a) {
    var step = Math.min(2, Math.floor(a.t * a.ms / 1000 * 3)), src = step < 2 ? a.canvas : (a.incoming || a.canvas),
        rowH = 8 * scale, seed = (step + 1) * 7919, y, g, r;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    if (src) ctx.drawImage(src, 0, 0, w, h);
    for (y = 0; y < h; y += rowH) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; r = seed / 4294967296;
      if (r >= STATIC_COVER[step]) continue;
      g = 40 + ((seed >>> 8) % 180);
      ctx.fillStyle = 'rgb(' + g + ',' + g + ',' + g + ')'; ctx.fillRect(0, y, w, rowH);
    }
    ctx.restore();
  }
  /* mode entry, cards: the new frame is dealt in as six cards, one after another, each dropping from above */
  function drawCards(ctx, w, h, scale, a) {
    var n = 6, cw = Math.ceil(w / n), i, p, x, y;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    if (a.canvas) ctx.drawImage(a.canvas, 0, 0, w, h);
    for (i = 0; i < n; i++) {
      p = Math.max(0, Math.min(1, a.t * 1.5 - i * 0.1)); p = 1 - (1 - p) * (1 - p);
      x = i * cw; y = -Math.round((1 - p) * h);
      if (p <= 0) continue;
      if (a.incoming) ctx.drawImage(a.incoming, x, 0, cw, h, x, y, cw, h);
      else { ctx.fillStyle = '#1B1626'; ctx.fillRect(x, y, cw, h); }
      ctx.fillStyle = '#E8E0C8'; ctx.fillRect(x, y, 2, h); ctx.fillRect(x + cw - 2, y, 2, h);
    }
    ctx.restore();
  }
  function draw(ctx, w, h, scale) {
    if (!active) return;
    if (active.name === 'portal:water') {
      /* the inlet: rings open from the splash point, not from a flat wipe */
      var t = active.t, ox = Math.round(active.wx * w), oy = Math.round(active.wy * h);
      var rad = Math.ceil(Math.max(w, h) * (0.15 + 0.9 * t));
      var i, rr;
      ctx.save(); ctx.imageSmoothingEnabled = false;
      if (active.canvas) ctx.drawImage(active.canvas, 0, 0, w, h);
      ctx.save();
      ctx.beginPath(); ctx.arc(ox, oy, Math.max(1, rad), 0, Math.PI * 2); ctx.clip();
      if (active.incoming) ctx.drawImage(active.incoming, 0, 0, w, h);
      ctx.restore();
      for (i = 0; i < 3; i++) {
        rr = Math.max(1, rad - i * 26 * (1 - t) - i * 6);
        ctx.globalAlpha = 0.75 - i * 0.2;
        ctx.strokeStyle = i === 0 ? '#C8F0FF' : i === 1 ? '#9FE0FF' : '#5EA8D8';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ox, oy, rr, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.restore(); return;
    }
    if (active.reduced) { if (active.canvas) ctx.drawImage(active.canvas, 0, 0, w, h); return; }
    if (active.def.draw) { active.def.draw(ctx, w, h, scale, active); return; }
    if (active.name === 'fall') { drawFall(ctx, w, h, scale, active); return; }
    if (!active.canvas) return;
    var m = motion(w, h, scale);
    ctx.save(); ctx.imageSmoothingEnabled = false;
    if (active.incoming) ctx.drawImage(active.incoming, m.x, m.y, w, h);
    ctx.drawImage(active.canvas, m.oldX, m.oldY, w, h);
    ctx.restore();
  }
  kind('slide', { ms: 320, pre: function () {}, cover: function () {}, post: function () {} });
  kind('door', { ms: 220 });
  kind('stairs', { ms: 270 });
  kind('fall', { ms: 520 });
  kind('mode', { ms: 320 });
  kind('portal:fire', { ms: 380 });
  kind('portal:lightning', { ms: 400 });
  kind('portal:d_city>b7_altar', { ms: 380 });
  kind('portal:d_city>h3_trip', { ms: 380 });
  kind('portal:recall', { ms: 2850 });
  kind('portal:water', { ms: 400, cover: function (a) { a.wx = waterAt.x; a.wy = waterAt.y; } });
  kind('cine:rooms-g-trip', { ms: 320 });
  kind('cine:crack-sky', { ms: 320 });
  /* v4-B4: one themed kind per mode entry. cut = the reduced-motion hold in ms (a cut, not a wipe). Callers: engine.js,
     act4.js, rhythm.js, quiz.js, boss-polt.js, cards.js start these (not wired here). */
  kind('mode:boss', { ms: 480, cut: 150, draw: drawBoss });
  kind('mode:dungeon', { ms: 520, cut: 150, draw: drawFall });
  kind('mode:mountain', { ms: 320, cut: 150, dir: 'up' });
  kind('mode:rhythm', { ms: 700, cut: 150, draw: drawStatic });
  kind('mode:quiz', { ms: 700, cut: 150, draw: drawStatic });
  kind('mode:cards', { ms: 600, cut: 150, draw: drawCards });
  NEU.engineTrans = { kind: kind, get: get, enabled: enabled, start: start, step: step, draw: draw, motion: motion,
    setOrigin: function (x, y) { waterAt.x = x; waterAt.y = y; },
    get active() { return active; }, cut: function () { active = null; } };
})();
