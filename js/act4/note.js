/* note.js — the desk note, drawn in Standard Galactic glyphs.
   Kernel scene "note". The signature is cycling glyphs, never a name. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var W = 320, H = 180, SCALE = 2, OX = 24, OY = 28, VIEW = 64;
  var CELLW = SCALE * 5 + 2, CELLH = SCALE * 7 + 6, SIG = 5, SPEED = 64;
  var INK = '#24180F', RED = '#C41018', DUST = '#6A5848', FAR = '#3A2E26';
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
      ink: INK, red: RED, dust: DUST
    };
  }
  function ensure() {
    var scrollK, closeK;
    overlay = document.getElementById('note');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'note';
      overlay.className = 'note';
      overlay.hidden = true;
      overlay.style.position = 'fixed';
      overlay.style.left = '50%';
      overlay.style.top = '50%';
      overlay.style.transform = 'translate(-50%, -50%)';
      overlay.style.zIndex = '78';
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
  function drawGlyph(g, x, y, col) {
    var r, c, bit;
    x = x | 0;
    y = y | 0;
    if (!g) {
      ctx.fillStyle = '#FF00FF';
      ctx.fillRect(x, y, SCALE * 5, SCALE * 7);
      return;
    }
    ctx.fillStyle = col;
    for (r = 0; r < 7; r++) {
      bit = g[r];
      for (c = 0; c < 5; c++) {
        if (bit & (1 << (4 - c))) ctx.fillRect(x + c * SCALE, y + r * SCALE, SCALE, SCALE);
      }
    }
  }
  function drawLine(text, y, col) {
    var i, x = OX, ch;
    for (i = 0; i < text.length; i++) {
      ch = text.charAt(i);
      if (ch === ' ') { x += CELLW; continue; }
      drawGlyph(bits(ch), x, y, col);
      x += CELLW;
    }
  }
  function sigLine() {
    var s = '', i;
    for (i = 0; i < SIG; i++) s += String.fromCharCode(97 + sig[i]);
    return s;
  }
  function draw(dt) {
    var y, i, far, drift, page, b;
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    b = (NEU.juice && NEU.juice.bias) ? NEU.juice.bias : { x: 0, y: 0 };
    ctx.setTransform(1, 0, 0, 1, Math.round(b.x), Math.round(b.y));
    ctx.fillStyle = '#120E0C';
    ctx.fillRect(0, 0, W, H);
    far = Math.floor(scroll * 0.15);
    drift = driftOf();
    ctx.fillStyle = FAR;
    for (i = 0; i < 6; i++) ctx.fillRect(16 + i * 40, 18 + (i % 2) * 20 - far, 2, 2);
    ctx.fillStyle = DUST;
    for (i = 0; i < 8; i++) ctx.fillRect(30 + i * 28, 40 + (i % 3) * 12 - drift, 2, 2);
    page = OY - Math.floor(scroll);
    ctx.fillStyle = '#E8D8BC';
    ctx.fillRect(16, page - 8, 288, (LINES.length + 1) * CELLH + 16);
    ctx.fillStyle = '#DCC8A4';
    for (i = 0; i < LINES.length + 1; i += 2) ctx.fillRect(16, page - 8 + i * CELLH, 288, 8);
    y = page;
    for (i = 0; i < LINES.length; i++) {
      drawLine(LINES[i], y, INK);
      y += CELLH;
    }
    drawLine(sigLine(), y, RED);
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
    drawGlyph(bits(ch), 0, 0, INK);
  }
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

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
