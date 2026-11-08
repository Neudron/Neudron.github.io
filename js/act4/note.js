/* note.js — the desk note, drawn in Standard Galactic glyphs.
   Kernel scene "note". The signature is cycling glyphs, never a name. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var W = 320, H = 180, SCALE = 2, OX = 48, OY = 36, VIEW = 64;
  var CELLW = SCALE * 5 + 2, CELLH = SCALE * 7 + 6, SIG = 5, SPEED = 64;
  var INK = '#2A1A14', RED = '#8A0C14', RED_HI = '#C8202C', BLEED = '#5A4A3A';
  var LINES = [
    'the door remembers a',
    'hand that is not here',
    'red in the wood is old',
    'older than the house',
    'look where it will not'
  ];
  var GLYPH = {
    a: [27, 16, 24, 8, 16, 16, 16], b: [10, 8, 8, 21, 8, 8, 10],
    c: [4, 4, 4, 2, 4, 20, 14], d: [19, 2, 23, 5, 2, 2, 2],
    e: [1, 1, 1, 16, 1, 11, 11], f: [16, 21, 16, 8, 16, 16, 24],
    g: [25, 8, 8, 4, 10, 8, 8], h: [21, 4, 20, 2, 4, 4, 14],
    i: [6, 6, 2, 11, 2, 2, 2], j: [17, 1, 1, 16, 1, 1, 21],
    k: [16, 16, 26, 8, 16, 16, 26], l: [8, 14, 8, 4, 8, 29, 8],
    m: [21, 14, 4, 2, 4, 4, 20], n: [2, 2, 2, 1, 23, 2, 10],
    o: [11, 5, 1, 16, 1, 1, 1], p: [25, 16, 16, 29, 16, 16, 16],
    q: [8, 8, 8, 4, 8, 10, 10], r: [4, 4, 21, 18, 4, 4, 4],
    s: [19, 6, 2, 1, 2, 10, 2], t: [1, 21, 1, 16, 1, 1, 11],
    u: [16, 20, 16, 8, 26, 16, 16], v: [29, 8, 10, 4, 8, 8, 8],
    w: [20, 4, 4, 10, 4, 4, 14], x: [2, 6, 2, 1, 2, 6, 23],
    y: [17, 1, 11, 17, 1, 1, 1], z: [16, 24, 16, 8, 16, 21, 26]
  };
  var overlay, canvas, ctx, hint, live = false, reduced = false;
  var scroll = 0, sigMs = 0, sig = [0, 0, 0, 0, 0], held = { up: false, down: false };
  var art = null;

  function rnd() {
    if (NEU.rand && NEU.rand.rng) return NEU.rand.rng();
    return Math.random();
  }
  function motion() {
    reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function periodMs() { return reduced ? 1000 : 340; }
  function maxScroll() { return Math.max(0, (LINES.length + 1) * CELLH - VIEW); }
  function driftOf() { return Math.floor(scroll * 0.35); }
  function bits(ch) {
    if (!ch) return null;
    return GLYPH[String(ch).toLowerCase()] || null;
  }
  function glyph(ch) {
    var g = bits(ch);
    return g ? g.slice() : null;
  }
  function roll() {
    var i, n, prev;
    for (i = 0; i < SIG; i++) {
      prev = sig[i];
      n = (rnd() * 26) | 0;
      if (n === prev) n = (n + 1) % 26;
      sig[i] = n;
    }
  }
  function advanceSig(ms) {
    var period = periodMs();
    sigMs += ms;
    while (sigMs >= period) {
      sigMs -= period;
      roll();
    }
  }
  function state() {
    return {
      open: live, scroll: scroll, drift: driftOf(), max: maxScroll(),
      period: reduced ? 1 : 0.34, sig: sig.slice(), lines: LINES.slice(),
      ox: OX, oy: OY, scale: SCALE, cellW: CELLW, cellH: CELLH,
      ink: INK, red: RED, dust: '#6A5848'
    };
  }
  function rr(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function hs(x, y, s) {
    var h = (x * 374761393 + y * 668265263 + (s || 0) * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function blob(g, cx, cy, rx, ry, c) {
    var y, k, hw;
    for (y = -ry; y <= ry; y++) {
      k = 1 - (y * y) / ((ry + 0.5) * (ry + 0.5));
      if (k <= 0) continue;
      hw = Math.round(rx * Math.sqrt(k));
      rr(g, cx - hw, cy + y, hw * 2 + 1, 1, c);
    }
  }
  function bake(w, h, fn) {
    var cv, g;
    try {
      cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      g = cv.getContext('2d');
      if (!g) return null;
      g.imageSmoothingEnabled = false;
      fn(g);
      return cv;
    } catch (e) { return null; }
  }
  function fitScale() {
    if (!canvas) return;
    var vw = (window.innerWidth || 320) - 32;
    var vh = (window.innerHeight || 180) - 96;
    var k = Math.floor(Math.min(vw / W, vh / H));
    if (k < 1) k = 1;
    canvas.style.width = (W * k) + 'px';
    canvas.style.height = (H * k) + 'px';
  }
  function deskLayer(g) {
    var i;
    rr(g, 0, 0, W, H, '#08080B');
    /* 8px wood border */
    rr(g, 0, 0, W, 8, '#1A120C'); rr(g, 0, H - 8, W, 8, '#1A120C');
    rr(g, 0, 0, 8, H, '#1A120C'); rr(g, W - 8, 0, 8, H, '#1A120C');
    for (i = 0; i < W; i += 4) {
      rr(g, i, 1, 2, 1, '#2A1C12'); rr(g, i + 1, H - 2, 2, 1, '#2A1C12');
    }
    for (i = 0; i < H; i += 4) {
      rr(g, 1, i, 1, 2, '#2A1C12'); rr(g, W - 2, i + 1, 1, 2, '#2A1C12');
    }
    /* bottom-left glow: 3 stepped rings */
    g.globalAlpha = 0.12;
    blob(g, 24, H - 24, 90, 70, '#FFB347');
    g.globalAlpha = 0.08;
    blob(g, 24, H - 24, 60, 46, '#FFB347');
    g.globalAlpha = 0.04;
    blob(g, 24, H - 24, 34, 26, '#FFB347');
    g.globalAlpha = 1;
  }
  function paperLayer(g) {
    var px = 20, py = 12, pw = 280, ph = 156, i, x, y, dark;
    /* torn top edge (2-3px zig-zag) */
    for (x = px; x < px + pw; x += 2) {
      var zh = 2 + ((hs(x, 1, 7) * 2) | 0);
      rr(g, x, py - zh, 2, zh, '#CDBE9E');
      rr(g, x, py - zh, 2, 1, '#B8A888');
    }
    rr(g, px, py, pw, ph, '#E8DCC0');
    /* fibres 1px #DCCDAE over ~3% */
    for (i = 0; i < 1300; i++) {
      if (hs(i, 3, 9) < 0.03) {
        x = px + ((hs(i, 1, 1) * pw) | 0);
        y = py + ((hs(i, 2, 1) * ph) | 0);
        rr(g, x, y, 1, 1, '#DCCDAE');
      }
    }
    /* extra paper tones for >=6 colours */
    for (i = 0; i < 600; i++) {
      if (hs(i, 5, 2) < 0.04) {
        x = px + ((hs(i, 6, 3) * pw) | 0);
        y = py + ((hs(i, 7, 3) * ph) | 0);
        rr(g, x, y, 1, 1, '#F4ECD8');
      }
    }
    /* rule lines every 20px */
    for (y = py + 20; y < py + ph - 4; y += 20) rr(g, px + 4, y, pw - 8, 1, '#C8B898');
    /* margin line 1px #C88080 at x=40 */
    rr(g, 40, py + 2, 1, ph - 4, '#C88080');
    /* centre fold: 2px #D4C4A4 with 1px #F4ECD8 beside it */
    rr(g, 160, py, 2, ph, '#D4C4A4');
    rr(g, 162, py, 1, ph, '#F4ECD8');
    /* four corners one step darker */
    dark = '#D4C4A4';
    rr(g, px, py, 8, 8, dark); rr(g, px + pw - 8, py, 8, 8, dark);
    rr(g, px, py + ph - 8, 8, 8, dark); rr(g, px + pw - 8, py + ph - 8, 8, 8, dark);
    rr(g, px, py, 3, 3, '#C8B898'); rr(g, px + pw - 3, py, 3, 3, '#C8B898');
    rr(g, px, py + ph - 3, 3, 3, '#C8B898'); rr(g, px + pw - 3, py + ph - 3, 3, 3, '#C8B898');
    /* edge shadow */
    rr(g, px, py + ph, pw, 1, '#C8B898');
    rr(g, px + pw, py + 2, 1, ph, '#C8B898');
  }
  function build() {
    if (art) return art;
    art = {
      desk: bake(W, H, deskLayer),
      paper: bake(W, H, paperLayer)
    };
    return art;
  }
  function blit(cv, x, y) { if (cv && ctx && ctx.drawImage) ctx.drawImage(cv, x, y); }
  function ensure() {
    var scrollK, closeK;
    overlay = document.getElementById('note');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'note';
      overlay.className = 'note';
      overlay.hidden = true;
      canvas = document.createElement('canvas');
      canvas.id = 'noteCanvas';
      canvas.width = W;
      canvas.height = H;
      hint = document.createElement('p');
      hint.className = 'note__hint';
      hint.appendChild(document.createTextNode('scroll '));
      scrollK = document.createElement('span');
      scrollK.setAttribute('data-k', 'w,s');
      hint.appendChild(scrollK);
      hint.appendChild(document.createTextNode(' close '));
      closeK = document.createElement('span');
      closeK.setAttribute('data-k', 'x');
      hint.appendChild(closeK);
      overlay.appendChild(canvas);
      overlay.appendChild(hint);
      document.body.appendChild(overlay);
    }
    canvas = document.getElementById('noteCanvas');
    ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    if (ctx) ctx.imageSmoothingEnabled = false;
    if (NEU.keys && NEU.keys.refresh) NEU.keys.refresh();
  }
  function drawGlyph(g, x, y, col, wet) {
    var r, c, bit, bx, by;
    x = x | 0;
    y = y | 0;
    if (!g) {
      ctx.fillStyle = '#FF00FF';
      ctx.fillRect(x, y, SCALE * 5, SCALE * 7);
      return;
    }
    for (r = 0; r < 7; r++) {
      bit = g[r];
      for (c = 0; c < 5; c++) {
        if (bit & (1 << (4 - c))) {
          bx = x + c * SCALE; by = y + r * SCALE;
          ctx.fillStyle = col;
          ctx.fillRect(bx, by, SCALE, SCALE);
          if (wet) {
            ctx.fillStyle = RED_HI;
            ctx.fillRect(bx, by, 1, 1);
          } else if (hs(x + c, y + r, 3) < 0.3) {
            ctx.fillStyle = BLEED;
            ctx.fillRect(bx + SCALE, by, 1, SCALE);
          }
        }
      }
    }
  }
  function drawLine(text, y, col, wet) {
    var i, x = OX, ch;
    for (i = 0; i < text.length; i++) {
      ch = text.charAt(i);
      if (ch === ' ') { x += CELLW; continue; }
      drawGlyph(bits(ch), x, y, col, wet);
      x += CELLW;
    }
  }
  function sigLine() {
    var s = '', i;
    for (i = 0; i < SIG; i++) s += String.fromCharCode(97 + sig[i]);
    return s;
  }
  function draw(dt) {
    var a, y, i, page, b;
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    a = build();
    b = (NEU.juice && NEU.juice.bias) ? NEU.juice.bias : { x: 0, y: 0 };
    ctx.setTransform(1, 0, 0, 1, Math.round(b.x), Math.round(b.y));
    blit(a.desk, 0, 0);
    if (!a.desk) { rr(ctx, 0, 0, W, H, '#08080B'); }
    blit(a.paper, 0, 0);
    if (!a.paper) { rr(ctx, 20, 12, 280, 156, '#E8DCC0'); rr(ctx, 40, 12, 1, 156, '#C88080'); }
    /* dust motes ride the page at a third of its scroll speed (parallax) */
    for (i = 0; i < 8; i++) rr(ctx, 30 + i * 28, 40 + (i % 3) * 12 - driftOf(), 2, 2, '#6A5848');
    page = OY - Math.floor(scroll);
    y = page;
    for (i = 0; i < LINES.length; i++) {
      drawLine(LINES[i], y, INK, false);
      y += CELLH;
    }
    drawLine(sigLine(), y, RED, true);
    if (NEU.juice && NEU.juice.drawParts) NEU.juice.drawParts(ctx, dt || 0);
  }
  function step(dt, key) {
    if (!live) return state();
    if (key === 'close') { close(); return state(); }
    if (!(dt > 0)) dt = 0;
    if (key === 'down') scroll += SPEED * dt;
    else if (key === 'up') scroll -= SPEED * dt;
    else if (!key) {
      if (held.down) scroll += SPEED * dt;
      if (held.up) scroll -= SPEED * dt;
    }
    if (scroll < 0) scroll = 0;
    if (scroll > maxScroll()) scroll = maxScroll();
    advanceSig(dt * 1000);
    draw(dt);
    return state();
  }
  function tick(dtMs) {
    if (!live) return;
    step((dtMs || 0) / 1000);
  }
  function open() {
    ensure();
    if (live) return true;
    motion();
    fitScale();
    live = true;
    scroll = 0;
    sigMs = 0;
    held.up = false;
    held.down = false;
    roll();
    if (NEU.save) NEU.save.flag('dad_note', 1);
    if (overlay) overlay.hidden = false;
    NEU.activeMinigame = 'note';
    if (NEU.kernel) NEU.kernel.push('note');
    if (NEU.juice && NEU.juice.hit) NEU.juice.hit('small');
    if (NEU.juice && NEU.juice.burst) NEU.juice.burst(W / 2, 40, 6, '#E8C890');
    draw(0);
    return true;
  }
  function close() {
    if (!live && (!overlay || overlay.hidden)) return;
    live = false;
    held.up = false;
    held.down = false;
    if (overlay) overlay.hidden = true;
    if (NEU.activeMinigame === 'note') NEU.activeMinigame = null;
    if (NEU.kernel && NEU.kernel.current() === 'note') NEU.kernel.pop();
  }
  function onKey(e) {
    var routed, k, down;
    if (!live) return;
    routed = (NEU.keys && NEU.keys.route) ? NEU.keys.route(e.key, {}) : { to: e.key, swallow: false };
    if (routed.swallow) return;
    k = routed.to;
    down = e.type === 'keydown';
    if (e.repeat) return;
    if (k === 's' || k === 'S' || k === 'ArrowDown') {
      held.down = down;
      if (down && e.preventDefault) e.preventDefault();
    } else if (k === 'w' || k === 'W' || k === 'ArrowUp') {
      held.up = down;
      if (down && e.preventDefault) e.preventDefault();
    } else if (down && (k === 'Escape' || k === 'x' || k === 'X')) {
      close();
      if (e.preventDefault) e.preventDefault();
    }
  }
  function stamp(ch) {
    ensure();
    if (!ctx) return;
    drawGlyph(bits(ch), 0, 0, INK, false);
  }
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('resize', function () { if (live) fitScale(); });

  NEU.note = {
    open: open, close: close, step: step, stamp: stamp, glyph: glyph,
    get state() { return state(); },
    get running() { return live; }
  };
  if (NEU.kernel) NEU.kernel.register('note', {
    tick: tick, open: open, close: close,
    running: function () { return live; }
  });
})();
