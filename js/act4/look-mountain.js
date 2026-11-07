/* look-mountain.js — mountain tiles, parallax peaks, snow (W5.4). */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var SKY = ['#1B3A4B', '#3D6E8C', '#87A8B8', '#E6EEF2'];
  var PEAKS = [
    { x: 20, y: 150, w: 200, h: 150, p: 0.2, c: '#243440', s: '#D5DEE4' },
    { x: 280, y: 170, w: 240, h: 170, p: 0.4, c: '#1A2832', s: '#EEF3F6' },
    { x: 560, y: 140, w: 220, h: 190, p: 0.62, c: '#314858', s: '#F4F7F8' }
  ];
  var flakes = [], bake = null, i;

  for (i = 0; i < 28; i++) flakes.push({ x: (i * 53) % 768, y: (i * 37) % 320, v: 18 + (i % 5) * 8 });

  function reducedNow() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  }
  function box(c, style, x, y, w, h) {
    x = x | 0; y = y | 0; w = w | 0; h = h | 0;
    if (w <= 0 || h <= 0) return;
    c.fillStyle = style;
    c.fillRect(x, y, w, h);
  }
  function rock(c, px, py, ch) {
    var body = ch === 'x' ? '#6A3E55' : '#3E4C59';
    var hi = ch === 'x' ? '#C48AA0' : '#E8EEF2';
    box(c, body, px, py, 16, 16);
    box(c, ch === '=' ? '#B7C4CE' : '#6D7B88', px + 1, py + 4, 14, 11);
    box(c, hi, px, py, 16, ch === '=' ? 3 : 4);
    if (ch === 'x') box(c, '#1A1218', px + 7, py + 2, 2, 12);
  }
  function spike(c, px, py, ch) {
    if (ch === '^') {
      box(c, '#D7E4EA', px + 7, py + 2, 2, 6);
      box(c, '#D7E4EA', px + 4, py + 8, 8, 4);
      box(c, '#8AA0AA', px + 2, py + 12, 12, 4);
    } else if (ch === 'v') {
      box(c, '#8AA0AA', px + 2, py, 12, 4);
      box(c, '#D7E4EA', px + 4, py + 4, 8, 4);
      box(c, '#D7E4EA', px + 7, py + 8, 2, 6);
    } else if (ch === '<') {
      box(c, '#D7E4EA', px + 2, py + 7, 6, 2);
      box(c, '#8AA0AA', px + 8, py + 4, 6, 8);
    } else {
      box(c, '#8AA0AA', px + 2, py + 4, 6, 8);
      box(c, '#D7E4EA', px + 8, py + 7, 6, 2);
    }
  }
  function peak(c, p, camX, camY) {
    var row, span, left, top;
    top = (p.y - camY * p.p * 0.35) | 0;
    for (row = 0; row < p.h; row += 2) {
      span = (p.w * row / p.h) | 0;
      if (span < 2) span = 2;
      left = (p.x - camX * p.p + (p.w - span) / 2) | 0;
      box(c, p.c, left, top + row, span, 2);
    }
    box(c, p.s, (p.x - camX * p.p + p.w / 2 - 4) | 0, top, 8, 4);
  }
  function parallax(c, camX, camY) {
    var i, top;
    top = camY | 0;
    for (i = 0; i < SKY.length; i++) box(c, SKY[i], camX | 0, top + i * 90, 640, 90);
    for (i = 0; i < PEAKS.length; i++) peak(c, PEAKS[i], camX, camY);
  }
  function snow(c, camX, camY) {
    var f, n;
    for (n = 0; n < flakes.length; n++) {
      f = flakes[n];
      box(c, '#F4F7FA', f.x - camX * 0.85, f.y - camY * 0.15, 2, 2);
    }
  }
  function paint(level) {
    var cv = bake, c = cv && cv.getContext ? cv.getContext('2d') : null;
    var y, x, row, ch, px, py;
    if (!c || !level || !level.grid) return;
    try { c.imageSmoothingEnabled = false; } catch (e0) {}
    for (y = 0; y < level.h; y++) {
      row = level.grid[y] || '';
      for (x = 0; x < level.w; x++) {
        ch = x < row.length ? row.charAt(x) : '.';
        px = x * 16; py = y * 16;
        if (ch === '.' || ch === ' ') continue;
        if (ch === '#' || ch === 'x' || ch === '=') rock(c, px, py, ch);
        else if (ch === '^' || ch === 'v' || ch === '<' || ch === '>') spike(c, px, py, ch);
        else box(c, '#FF00FF', px, py, 16, 16);
      }
    }
  }
  function stepWind(dt) {
    var sec = typeof dt === 'number' ? dt : 0, n, f;
    if (sec > 2) sec = sec / 1000;
    if (sec > 0.05) sec = 0.05;
    if (reducedNow() || sec <= 0) return;
    for (n = 0; n < flakes.length; n++) {
      f = flakes[n];
      f.y += f.v * sec;
      f.x += (8 + (n % 3) * 6) * sec;
      if (f.y > 420) f.y = 0;
      if (f.x > 820) f.x = 0;
    }
  }
  function hookCtx() {
    var canvas = document.getElementById('platCanvas');
    var ctx, orig;
    if (!canvas || !canvas.getContext) return;
    ctx = canvas.getContext('2d');
    if (!ctx || ctx._mtn || !ctx.drawImage) return;
    orig = ctx.drawImage;
    ctx.drawImage = function (img, dx, dy) {
      var camX = -(dx || 0), camY = -(dy || 0), shook = false, r, levelBlit = arguments.length <= 3;
      if (!levelBlit) return orig.apply(this, arguments);
      if (NEU.mountain && NEU.mountain.active) {
        try { this.imageSmoothingEnabled = false; } catch (e1) {}
        if (NEU.juice && NEU.juice.begin) shook = !!NEU.juice.begin(this, 640, 360);
        parallax(this, camX, camY);
      }
      r = orig.apply(this, arguments);
      if (NEU.mountain && NEU.mountain.active) {
        snow(this, camX, camY);
        if (NEU.juice && NEU.juice.drawParts) NEU.juice.drawParts(this, 0.016);
        if (NEU.juice && NEU.juice.end) NEU.juice.end(this, shook);
      }
      return r;
    };
    ctx._mtn = 1;
  }

  NEU.mountainLook = {
    tileset: 'mountain',
    paint: paint,
    parallax: parallax,
    snow: snow,
    stepWind: stepWind,
    flakes: flakes,
    sky: SKY
  };
  if (document && document.createElement) {
    var origCreate = document.createElement;
    document.createElement = function (tag) {
      var el = origCreate.call(document, tag);
      if (el && String(tag).toLowerCase() === 'canvas' && NEU.plat && NEU.plat._baking) bake = el;
      return el;
    };
  }
  hookCtx();
})();
