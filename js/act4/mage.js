/* mage.js — the stone shop.
   Top of the screen is the room. Bottom left is the menu. Bottom
   right is what he says. Candles move on the kernel tick. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var wrap = document.getElementById('mage');
  if (!wrap) {
    NEU.mage = { open: function () {}, close: function () {}, provoke: function () {}, buy: function () { return false; }, sell: function () { return false; } };
    return;
  }

  var menuEl = document.getElementById('mageMenu');
  var sayEl = document.getElementById('mageSay');
  var KINDS = { melee: 1, ranged: 1, spell: 1, heal: 1 };
  var TOPICS = [
    { n: 1, label: 'the shelves', first: '* they hold what they hold. the shelves do not care.', again: '* still shelves. still dust.' },
    { n: 2, label: 'the cards', first: '* the cards are not a conversation.', again: '* i said what i said.' },
    { n: 3, label: 'the candles', first: '* three flames. they do not agree.', again: '* they still do not agree.' },
    { n: 4, label: 'you', first: '* i sell. you buy. that is the whole of me.', again: '* we have had this talk.' }
  ];
  var MOTES = [
    { x: 24, y: 40 }, { x: 88, y: 96 }, { x: 140, y: 28 },
    { x: 210, y: 70 }, { x: 280, y: 44 }, { x: 300, y: 100 }
  ];
  var WARN = '* one thing. cast a spell at me and we play cards. you will not like the cards.';

  var active = false;
  var mode = 'main';
  var sel = 0;
  var full = '';
  var shown = 0;
  var clock = 0;
  var ctx = null;
  var api;

  function reduced() {
    try {
      if (NEU.motion && NEU.motion.reduced) return !!NEU.motion.reduced();
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  function paintSay() {
    var n;
    if (!sayEl) return;
    n = shown;
    if (n > full.length) n = full.length;
    if (n < 0) n = 0;
    sayEl.textContent = full.substring(0, Math.floor(n));
  }

  function say(msg) {
    full = msg || '';
    shown = reduced() ? full.length : 0;
    paintSay();
  }

  function context() {
    var canvas;
    if (ctx) return ctx;
    canvas = document.getElementById('mageCanvas');
    if (!canvas || !canvas.getContext) return null;
    ctx = canvas.getContext('2d');
    return ctx;
  }

  function box(x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
  }

  /* ── art: every static layer is baked once, the frame is a few blits ── */
  var INK = '#12081E';
  var LX = [230, 254, 278];
  var OFF = 120;
  var art = null;

  function rr(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
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
  function blit(cv, x, y) {
    if (cv && ctx.drawImage) ctx.drawImage(cv, x, y);
  }

  function wallLayer(g) {
    var bx, by, x, y, k, d, i, dx, dy, tone, hi, warm, dmin;
    var cool = ['#1C1814', '#2A2622', '#3A342C', '#1A120C'];
    rr(g, 0, 0, 320, 192, '#120E14');
    for (by = 0; by < 128; by += 8) {
      for (bx = ((by / 8) % 2) ? -8 : 0; bx < 320; bx += 16) {
        k = Math.floor(hs(bx, by, 3) * cool.length);
        dmin = 999;
        for (i = 0; i < 3; i++) {
          dx = bx + 7 - (LX[i] + 7); dy = by + 3 - 118;
          d = Math.sqrt(dx * dx + dy * dy);
          if (d < dmin) dmin = d;
        }
        warm = dmin < 60;
        if (warm) {
          tone = dmin < 30 ? (k ? '#5A4030' : '#3A2C22') : (k === 2 ? '#5A4030' : '#3A2C22');
          hi = tone === '#5A4030' ? '#7A5A44' : '#5A4030';
        } else {
          tone = cool[k];
          hi = (k === 2 || k === 3) ? '#4E463C' : '#3A342C';
        }
        rr(g, bx, by, 15, 7, tone);
        rr(g, bx, by, 15, 1, hi);
        rr(g, bx, by, 1, 7, hi);
        rr(g, bx, by + 6, 15, 1, '#120E14');
        rr(g, bx + 14, by, 1, 7, '#120E14');
        if (hs(bx, by, 9) > 0.7) rr(g, bx + 3 + ((hs(bx, by, 5) * 8) | 0), by + 2 + ((hs(bx, by, 6) * 3) | 0), 2, 1, warm ? '#6A5040' : '#4E463C');
        if (hs(bx, by, 11) > 0.88) rr(g, bx + 5, by + 3, 1, 2, '#0A0810');
      }
    }
    rr(g, 0, 120, 320, 8, '#120E14');
    rr(g, 0, 118, 320, 2, '#1C1814');
  }
  function windowLayer(g) {
    var i, y, hw, r = 28, dy, band;
    for (i = 0; i < 57; i++) {
      y = 24 + i;
      if (i < r) { dy = r - i - 0.5; hw = Math.round(Math.sqrt(r * r - dy * dy)); } else hw = r;
      rr(g, 264 - hw - 3, y, hw * 2 + 6, 1, INK);
      rr(g, 264 - hw - 2, y, hw * 2 + 4, 1, '#3A2A20');
      band = y < 40 ? '#0E1630' : (y < 60 ? '#142038' : '#1A2848');
      rr(g, 264 - hw, y, hw * 2, 1, band);
    }
    rr(g, 261 - 24, 25, 48, 1, INK);
    for (i = 0; i < 7; i++) rr(g, 238 + ((hs(i, 1, 2) * 50) | 0), 30 + ((hs(i, 2, 2) * 36) | 0), 1, 1, '#8AA0D0');
    rr(g, 276, 36, 2, 2, '#B8CCD6');
    blob(g, 250, 38, 4, 4, '#B8CCD6');
    blob(g, 249, 37, 3, 3, '#E6EEF2');
    rr(g, 236, 72, 56, 8, '#0A1020');
    rr(g, 270, 62, 8, 10, '#0A1020');
    rr(g, 272, 58, 4, 4, '#0A1020');
    rr(g, 246, 66, 6, 6, '#0A1020');
    rr(g, 273, 64, 2, 2, '#E8C878');
    rr(g, 263, 24, 2, 56, '#3A2A20');
    rr(g, 236, 52, 56, 2, '#3A2A20');
    rr(g, 263, 24, 1, 56, '#4A3A2E');
    rr(g, 232, 80, 64, 3, '#6B4423');
    rr(g, 232, 80, 64, 1, '#8A5A32');
    rr(g, 234, 83, 60, 2, '#3A2414');
    rr(g, 234, 85, 60, 2, '#0A0810');
  }
  function potion(g, x, yb, t) {
    var y = yb - 10;
    rr(g, x + 2, y, 2, 2, '#8A6040');
    rr(g, x + 1, y + 2, 4, 1, INK);
    rr(g, x, y + 3, 6, 7, INK);
    rr(g, x + 1, y + 3, 4, 6, t[1]);
    rr(g, x + 1, y + 3, 1, 6, t[0]);
    rr(g, x + 4, y + 3, 1, 6, t[2]);
    rr(g, x + 2, y + 4, 1, 1, '#FFFFFF');
    rr(g, x + 1, y + 8, 4, 1, t[0]);
  }
  function book(g, x, yb, h, c, lean) {
    var r, s;
    for (r = 0; r < h; r++) {
      s = lean ? ((h - 1 - r) >> 2) : 0;
      rr(g, x + s - 1, yb - 1 - r, 1, 1, INK);
      rr(g, x + s + 4, yb - 1 - r, 1, 1, INK);
      rr(g, x + s, yb - 1 - r, 3, 1, c[0]);
      rr(g, x + s + 3, yb - 1 - r, 1, 1, c[1]);
      if (r === 2 || r === 3 || r === h - 3) rr(g, x + s, yb - 1 - r, 4, 1, '#C8A040');
    }
    rr(g, x + (lean ? 1 : 0), yb - h - 1, 4, 1, INK);
  }
  var SKULL = ['..XXXX..', '.XwwwwX.', 'XwwwwwsX', 'XwkwwkwX', 'XwwwwwsX', '.XwXXwX.', '..XwwX..'];
  function shelfLayer(g) {
    var i, r, c;
    var BK = [['#2E8B57', '#1A5A38'], ['#8B2E2E', '#5A1A1A'], ['#2E4A8B', '#1A2A5A']];
    var RED = ['#5A1018', '#B02838', '#FF6A6A'], GRN = ['#0C3A1A', '#1A7A3A', '#8AFFB0'], BLU = ['#14284A', '#2E4A8B', '#8AB0FF'];
    for (i = 0; i < 2; i++) {
      rr(g, 8, 40 + i * 28, 72, 3, '#0A0810');
      rr(g, 8, 36 + i * 28, 72, 1, '#8A6040');
      rr(g, 8, 37 + i * 28, 72, 2, '#5C4030');
      rr(g, 8, 39 + i * 28, 72, 1, '#3A2414');
      rr(g, 14, 40 + i * 28, 3, 8, '#2A1C12');
      rr(g, 14, 40 + i * 28, 1, 8, '#3A2414');
      rr(g, 70, 40 + i * 28, 3, 8, '#2A1C12');
      rr(g, 70, 40 + i * 28, 1, 8, '#3A2414');
    }
    book(g, 12, 36, 12, BK[0], false);
    book(g, 18, 36, 10, BK[1], false);
    book(g, 24, 36, 13, BK[2], true);
    book(g, 31, 36, 11, BK[0], true);
    potion(g, 42, 36, RED);
    potion(g, 51, 36, GRN);
    potion(g, 60, 36, BLU);
    potion(g, 69, 36, RED);
    for (r = 0; r < SKULL.length; r++) for (c = 0; c < 8; c++) {
      i = SKULL[r].charAt(c);
      if (i === '.') continue;
      rr(g, 14 + c, 57 + r, 1, 1, i === 'X' || i === 'k' ? INK : (i === 's' ? '#B8B0A8' : '#E4DCD0'));
    }
    rr(g, 26, 61, 10, 3, '#3A2414');
    rr(g, 26, 61, 10, 1, '#8A6040');
    blob(g, 31, 54, 7, 7, INK);
    blob(g, 31, 54, 6, 6, '#3B1F5C');
    blob(g, 32, 55, 4, 4, '#7A52B8');
    blob(g, 30, 52, 2, 2, '#B892FF');
    rr(g, 28, 50, 2, 1, '#E8DCFF');
    potion(g, 46, 64, GRN);
    potion(g, 56, 64, BLU);
    potion(g, 66, 64, RED);
  }
  function bgLayer(g) {
    wallLayer(g);
    windowLayer(g);
    shelfLayer(g);
    g.globalAlpha = 0.34;
    rr(g, 0, 0, 12, 128, '#000000'); rr(g, 308, 0, 12, 128, '#000000'); rr(g, 0, 0, 320, 6, '#000000');
    g.globalAlpha = 0.2;
    rr(g, 12, 0, 12, 128, '#000000'); rr(g, 296, 0, 12, 128, '#000000'); rr(g, 0, 6, 320, 6, '#000000');
    g.globalAlpha = 0.09;
    rr(g, 24, 0, 12, 128, '#000000'); rr(g, 284, 0, 12, 128, '#000000'); rr(g, 0, 12, 320, 6, '#000000');
    g.globalAlpha = 1;
  }
  function mageSprite(g) {
    var y, h, i, k, w, x0, cx, L, R3, ws, wd;
    function Rm(x, yy, ww, hh, c) { rr(g, 32 + x, 95 + yy, ww, hh, c); }
    /* pin keep */ Rm(0, 0, 0, 0, '#2A1248');
    for (y = -56; y < 0; y++) {
      h = 14 + Math.floor((y + 56) * 6 / 56);
      Rm(-h - 1, y, h * 2 + 2, 1, INK);
      Rm(-h, y, h * 2, 1, '#3B1F5C');
      Rm(-h, y, 4, 1, '#1E0F33');
      Rm(h - 6, y, 3, 1, '#6A3FA0');
      if (y > -50) Rm(h - 3, y, 2, 1, '#9A70D0');
      Rm(h - 1, y, 1, 1, '#E8B060');
      if (y > -46) { Rm(-6 + ((y + 56) >> 4), y, 1, 1, '#2A1640'); Rm(2 + ((y + 56) >> 5), y, 1, 1, '#4B2A78'); }
    }
    Rm(-15, -57, 30, 1, INK);
    Rm(-6, -40, 2, 1, '#B892FF'); Rm(5, -40, 2, 1, '#B892FF');
    Rm(20, -77, 5, 77, INK);
    Rm(21, -76, 3, 76, '#4A3424');
    Rm(23, -76, 1, 76, '#6B4A30');
    Rm(21, -50, 3, 2, '#2A1C12'); Rm(21, -24, 3, 2, '#2A1C12');
    ws = [2, 4, 6, 8, 8, 8, 8, 6, 4, 2];
    for (i = 0; i < 10; i++) {
      w = ws[i]; x0 = 23 - (w >> 1); y = -88 + i;
      Rm(x0 - 1, y, w + 2, 1, INK);
      Rm(x0, y, w, 1, '#7A52B8');
      Rm(x0, y, 2, 1, '#4B2A78');
      Rm(x0 + w - 2, y, 2, 1, '#B892FF');
    }
    Rm(-3, -90, 6, 1, INK); Rm(22, -89, 2, 1, INK);
    Rm(23, -84, 1, 2, '#FFFFFF');
    Rm(-23, -55, 10, 32, INK);
    Rm(-22, -54, 8, 30, '#3B1F5C');
    Rm(-22, -54, 3, 30, '#1E0F33');
    Rm(-15, -54, 1, 30, '#6A3FA0');
    Rm(-22, -28, 8, 3, '#C8A040'); Rm(-22, -28, 8, 1, '#FFE080'); Rm(-22, -26, 8, 1, '#8A6A20');
    Rm(-21, -25, 6, 5, INK); Rm(-20, -25, 4, 4, '#C4A574'); Rm(-17, -25, 1, 4, '#E6C9A0');
    Rm(11, -53, 11, 20, INK);
    Rm(12, -52, 9, 18, '#3B1F5C');
    Rm(12, -52, 3, 18, '#1E0F33');
    Rm(18, -52, 2, 18, '#6A3FA0');
    Rm(20, -52, 1, 18, '#E8B060');
    Rm(12, -37, 9, 3, '#C8A040'); Rm(12, -37, 9, 1, '#FFE080'); Rm(12, -35, 9, 1, '#8A6A20');
    Rm(19, -34, 7, 6, INK); Rm(20, -33, 5, 4, '#C4A574'); Rm(24, -33, 1, 4, '#E6C9A0');
    Rm(-8, -71, 16, 13, INK);
    Rm(-7, -70, 14, 12, '#C4A574');
    Rm(4, -70, 3, 12, '#E6C9A0');
    Rm(-7, -70, 14, 2, '#8A6A4A');
    Rm(-5, -68, 4, 1, '#B8B0A8'); Rm(1, -68, 4, 1, '#B8B0A8');
    Rm(-4, -67, 2, 2, '#F4F0A0'); Rm(1, -67, 2, 2, '#F4F0A0');
    Rm(0, -66, 2, 5, '#C49B6A'); Rm(1, -66, 1, 5, '#E6C9A0');
    for (i = 0; i < 16; i++) {
      w = i < 6 ? 18 : (i < 10 ? 16 : (i < 13 ? 12 : (i < 15 ? 8 : 4)));
      x0 = -(w >> 1); y = -62 + i;
      Rm(x0 - 1, y, w + 2, 1, INK);
      Rm(x0, y, w, 1, '#B8B0A8');
      Rm(x0 + w - 5, y, 5, 1, '#E4DCD0');
      Rm(x0, y, 2, 1, '#8A827A');
      if ((i & 3) < 2) Rm(x0 + 3 + (i & 1), y, 1, 1, '#FFFFFF');
      if ((i & 3) > 0) Rm(x0 + w - 4 + (i & 1), y, 1, 1, '#FFFFFF');
    }
    Rm(-21, -75, 42, 6, INK);
    Rm(-20, -74, 40, 4, '#2A1640');
    Rm(-20, -74, 40, 1, '#4B2A78');
    Rm(14, -73, 6, 2, '#7A52B8');
    Rm(-20, -71, 40, 1, INK);
    for (k = 0; k < 18; k++) {
      w = 22 - Math.round(16 * k / 17);
      cx = k > 9 ? Math.floor((k - 9) * 6 / 8) : 0;
      x0 = cx - (w >> 1); y = -75 - k;
      Rm(x0 - 1, y, w + 2, 1, INK);
      L = Math.max(1, Math.floor(w / 3)); R3 = w > 10 ? 3 : 2;
      Rm(x0, y, L, 1, '#2A1640');
      Rm(x0 + L, y, w - L - R3, 1, '#4B2A78');
      Rm(x0 + w - R3, y, R3, 1, '#7A52B8');
      if (k === 1 || k === 2) Rm(x0, y, w, 1, '#C8A040');
    }
    Rm(-4, -93, 8, 1, INK); Rm(2, -93, 5, 1, INK);
    Rm(-2, -78, 4, 3, '#E8C860'); Rm(-1, -77, 2, 1, INK);
  }
  function counterLayer(g) {
    var i, x, y, w, px, pw;
    function C(xx, yy, ww, hh, c) { rr(g, xx, yy - OFF, ww, hh, c); }
    C(0, 136, 320, 1, '#C49060');
    C(0, 137, 320, 3, '#A07040');
    C(0, 140, 320, 2, '#3A2414');
    C(0, 142, 320, 34, '#6B4226');
    C(0, 142, 320, 2, '#8A4A20');
    for (i = 0; i < 3; i++) {
      px = 4 + i * 106; pw = 100;
      C(px, 146, pw, 26, '#5A3418');
      C(px, 146, pw, 1, '#3A2414'); C(px, 146, 1, 26, '#3A2414');
      C(px, 171, pw, 1, '#8A5A32'); C(px + pw - 1, 146, 1, 26, '#8A5A32');
      for (x = 0; x < 5; x++) C(px + 6 + ((hs(i, x, 1) * 60) | 0), 150 + x * 5, 10 + ((hs(i, x, 2) * 14) | 0), 1, '#6B4226');
      C(px + 1, 147, pw - 2, 1, '#7A4E2C');
      if (i) C(px - 3, 142, 2, 34, '#1A120C');
    }
    C(0, 176, 320, 4, '#2A1C12');
    C(0, 180, 320, 12, '#120E14');
    C(0, 180, 320, 1, '#1C1814');
    C(0, 142, 2, 34, '#2A1C12'); C(318, 142, 2, 34, '#2A1C12');
    /* on the counter: open book, coins, bell */
    C(43, 134, 26, 2, '#5A3418');
    C(43, 134, 26, 1, '#8A5A32');
    C(44, 126, 24, 1, INK);
    C(44, 127, 12, 7, '#E8DCC0');
    C(56, 127, 12, 7, '#C8B898');
    C(55, 127, 2, 7, '#8A7A5A');
    for (i = 0; i < 3; i++) { C(46, 129 + i * 2, 8, 1, '#8A7A5A'); C(58, 129 + i * 2, 7, 1, '#6A5A3A'); }
    C(43, 127, 1, 7, INK); C(68, 127, 1, 7, INK);
    for (i = 0; i < 3; i++) {
      C(96, 134 - i * 2, 6, 2, INK);
      C(97, 134 - i * 2, 4, 1, '#FFE080');
      C(97, 135 - i * 2, 4, 1, '#8A6A20');
    }
    C(97, 134 - 6, 4, 1, '#C8A040');
    C(106, 134, 4, 2, INK); C(107, 134, 2, 1, '#FFE080'); C(107, 135, 2, 1, '#8A6A20');
    C(119, 126, 10, 10, INK);
    C(121, 125, 4, 2, INK); C(122, 126, 2, 2, '#C8A040');
    C(120, 128, 8, 6, '#C8A040');
    C(120, 128, 2, 6, '#FFE080');
    C(126, 128, 2, 6, '#8A6A20');
    C(119, 133, 10, 2, '#8A6A20');
    C(123, 135, 2, 1, '#FFE080');
  }
  function lanternSprite(g) {
    rr(g, 0, 1, 14, 21, INK);
    rr(g, 3, 0, 8, 1, INK);
    rr(g, 2, 1, 10, 2, '#2A2420'); rr(g, 2, 1, 10, 1, '#4A3E34');
    rr(g, 1, 3, 2, 16, '#2A2420'); rr(g, 1, 3, 1, 16, '#4A3E34');
    rr(g, 11, 3, 2, 16, '#2A2420'); rr(g, 12, 3, 1, 16, '#1A1614');
    rr(g, 3, 3, 8, 16, '#3A2410');
    g.globalAlpha = 0.5;
    rr(g, 3, 3, 8, 16, '#FFD060');
    g.globalAlpha = 1;
    rr(g, 3, 10, 8, 1, '#2A2420');
    rr(g, 6, 15, 2, 4, '#E8D8B0'); rr(g, 7, 15, 1, 4, '#C8B898');
    rr(g, 1, 19, 12, 3, '#2A2420'); rr(g, 1, 19, 12, 1, '#4A3E34');
  }
  function glowSprite(g, D, radii, alphas, col) {
    var i, c = D >> 1;
    for (i = radii.length - 1; i >= 0; i--) {
      g.globalAlpha = alphas[i];
      blob(g, c, c, radii[i], Math.round(radii[i] * 0.85), col);
    }
    g.globalAlpha = 1;
  }
  function build() {
    if (art) return art;
    art = {
      bg: bakeOnce(320, 192, bgLayer),
      mage: bakeOnce(64, 96, mageSprite),
      counter: bakeOnce(320, 72, counterLayer),
      lamp: bakeOnce(14, 22, lanternSprite),
      lg: [
        bakeOnce(96, 96, function (g) { glowSprite(g, 96, [18, 30, 44], [0.22, 0.12, 0.06], '#FFB347'); }),
        bakeOnce(96, 96, function (g) { glowSprite(g, 96, [20, 32, 46], [0.22, 0.12, 0.06], '#FFB347'); })
      ],
      cg: [
        bakeOnce(80, 80, function (g) { glowSprite(g, 80, [22, 30], [0.2, 0.1], '#B892FF'); }),
        bakeOnce(80, 80, function (g) { glowSprite(g, 80, [26, 34], [0.2, 0.1], '#B892FF'); })
      ]
    };
    return art;
  }
  function bakeOnce(w, h, fn) { return bake(w, h, fn); }

  function candleH(i) {
    if (reduced()) return 8;
    if (Math.floor((clock + i * 160) / 400) % 2) return 10;
    return 6;
  }

  function draw() {
    var a, i, m, bob, still, ph, lx, fl, dx, dy, near, cry;
    if (!context()) return;
    ctx.imageSmoothingEnabled = false;
    a = build();
    still = reduced();
    bob = still ? 0 : (Math.floor(clock / 600) % 2);
    ph = still ? 0 : (Math.floor(clock / 800) % 2);
    blit(a.bg, 0, 0);
    if (!a.bg) { box(0, 0, 320, 192, '#1C1814'); return; }
    cry = 57 + bob;
    blit(a.cg[ph], 187 - 40, cry - 40);
    blit(a.mage, 164 - 32, 140 - 95 + bob);
    if (!still && clock % 3600 < 120) {
      box(160, 140 - 67 + bob, 2, 2, '#C4A574');
      box(165, 140 - 67 + bob, 2, 2, '#C4A574');
    } else {
      ctx.globalAlpha = 0.22;
      box(158, 140 - 69 + bob, 6, 6, '#F4F0A0');
      box(163, 140 - 69 + bob, 6, 6, '#F4F0A0');
      ctx.globalAlpha = 1;
    }
    for (i = 0; i < 3; i++) blit(a.lg[still ? 0 : (Math.floor(clock / 400 + i) % 2)], LX[i] + 7 - 48, 122 - 48);
    blit(a.counter, 0, OFF);
    for (i = 0; i < 3; i++) blit(a.lamp, LX[i], 114);
    /* the flame sits inside each lamp glass, drawn after the lamp so it shows.
       The shared room flame is used when the room kit is loaded; otherwise a plain flame. */
    if (NEU.roomArt && NEU.roomArt.flame) {
      for (i = 0; i < 3; i++) NEU.roomArt.flame(ctx, LX[i] + 7, 128, 1, 1, clock, i);
    } else {
      ctx.fillStyle = '#FFD060';
      for (i = 0; i < 3; i++) ctx.fillRect(LX[i] + 5, 128 - candleH(i), 4, candleH(i));
    }
    ctx.fillStyle = '#E8D8A0';
    for (i = 0; i < MOTES.length; i++) {
      m = MOTES[i];
      near = 0;
      for (lx = 0; lx < 3; lx++) {
        dx = m.x - (LX[lx] + 7); dy = m.y - 122;
        if (dx * dx + dy * dy < 44 * 44) near = 1;
      }
      dx = m.x - 187; dy = m.y - cry;
      if (dx * dx + dy * dy < 30 * 30) near = 1;
      if (near) ctx.fillRect(m.x | 0, m.y | 0, 2, 2);
    }
  }

  function stepMotes(dt) {
    var i, m;
    if (reduced()) return;
    for (i = 0; i < MOTES.length; i++) {
      m = MOTES[i];
      m.y -= dt * 0.012;
      if (m.y < 8) m.y = 118;
    }
  }

  function catalog() {
    var all, out, i, it;
    all = (NEU.items && NEU.items.all) ? NEU.items.all : [];
    out = [];
    for (i = 0; i < all.length; i++) {
      it = all[i];
      if (KINDS[it.kind] && it.price > 0) out.push(it);
    }
    return out;
  }

  function sellable() {
    var ids, out, i, def;
    if (!NEU.save || !NEU.items || !NEU.items.get) return [];
    ids = NEU.save.items();
    out = [];
    for (i = 0; i < ids.length; i++) {
      def = NEU.items.get(ids[i]);
      if (def && KINDS[def.kind]) out.push(def);
    }
    return out;
  }

  function isEquipped(id) {
    var eq, k;
    if (!NEU.save || !NEU.save.data) return false;
    eq = NEU.save.data.equip || {};
    for (k in eq) if (eq[k] === id) return true;
    return false;
  }

  function rows() {
    var list, out, i, it;
    if (mode === 'buy') {
      list = catalog();
      out = [];
      for (i = 0; i < list.length; i++) {
        it = list[i];
        out.push({ id: it.id, label: it.name, price: it.price });
      }
      return out;
    }
    if (mode === 'sell') {
      list = sellable();
      out = [];
      for (i = 0; i < list.length; i++) {
        it = list[i];
        out.push({ id: it.id, label: it.name, price: it.sell });
      }
      return out;
    }
    if (mode === 'talk') {
      out = [];
      for (i = 0; i < TOPICS.length; i++) out.push({ id: TOPICS[i].n, label: TOPICS[i].label });
      return out;
    }
    return [
      { id: 'buy', label: 'BUY' },
      { id: 'sell', label: 'SELL' },
      { id: 'talk', label: 'TALK' },
      { id: 'exit', label: 'EXIT' }
    ];
  }

  function render() {
    var list, i, b, name, price, row;
    if (!menuEl) return;
    list = rows();
    if (!list.length) sel = 0;
    else {
      if (sel >= list.length) sel = 0;
      if (sel < 0) sel = list.length - 1;
    }
    menuEl.innerHTML = '';
    for (i = 0; i < list.length; i++) {
      row = list[i];
      b = document.createElement('button');
      b.type = 'button';
      b.className = 'mage__row' + (i === sel ? ' is-sel' : '');
      b.setAttribute('role', 'option');
      if (i === sel) b.setAttribute('aria-selected', 'true');
      name = document.createElement('span');
      name.textContent = row.label;
      b.appendChild(name);
      if (row.price != null) {
        price = document.createElement('span');
        price.className = 'mage__p';
        price.textContent = row.price + 'g';
        b.appendChild(price);
      }
      (function (n) {
        b.addEventListener('click', function () { sel = n; render(); confirm(); });
      })(i);
      menuEl.appendChild(b);
    }
    /* the purse, always on the menu: you cannot shop blind */
    price = document.createElement('div');
    price.className = 'mage__gold';
    price.textContent = (NEU.save ? NEU.save.coins() : 0) + 'g';
    menuEl.appendChild(price);
  }

  function buy(id) {
    var def;
    def = NEU.items && NEU.items.get ? NEU.items.get(id) : null;
    if (!def || !KINDS[def.kind] || !(def.price > 0) || !NEU.save) return false;
    if (def.kind !== 'heal' && NEU.save.count(id) > 0) {
      say('* you already carry that.');
      return false;
    }
    if (NEU.save.coins() < def.price || !NEU.save.spend(def.price)) {
      say('* not enough coins.');
      return false;
    }
    NEU.save.give(id);
    say('* bought. ' + def.name + '.');
    return true;
  }

  function sell(id) {
    var def, pay;
    def = NEU.items && NEU.items.get ? NEU.items.get(id) : null;
    if (!def || !KINDS[def.kind] || !NEU.save || NEU.save.count(id) < 1) return false;
    if (isEquipped(id)) {
      say('* equipped. unequip first.');
      return false;
    }
    pay = def.sell || 0;
    NEU.save.take(id);
    NEU.save.addCoins(pay);
    say('* sold. ' + pay + ' coins.');
    return true;
  }

  function talkTopic(n) {
    var i, t, key, seen;
    t = null;
    for (i = 0; i < TOPICS.length; i++) if (TOPICS[i].n === n) t = TOPICS[i];
    if (!t || !NEU.save) return;
    key = 'mage_talk_' + n;
    seen = NEU.save.flagged(key);
    NEU.save.flag(key, true);
    say(seen ? t.again : t.first);
  }

  function exitAction() {
    if (NEU.save && !NEU.save.flagged('mage_warned')) {
      NEU.save.flag('mage_warned', true);
      say(WARN);
      return;
    }
    close();
  }

  function confirm() {
    var list, row;
    list = rows();
    if (!list.length) {
      mode = 'main';
      sel = 0;
      say('* nothing there.');
      render();
      return;
    }
    row = list[sel];
    if (!row) return;
    if (mode === 'main') {
      if (row.id === 'buy') { mode = 'buy'; sel = 0; say('* what will you buy?'); render(); return; }
      if (row.id === 'sell') { mode = 'sell'; sel = 0; say('* what will you sell?'); render(); return; }
      if (row.id === 'talk') { mode = 'talk'; sel = 0; say('* speak, then.'); render(); return; }
      exitAction();
      return;
    }
    if (mode === 'buy') { buy(row.id); render(); return; }
    if (mode === 'sell') { sell(row.id); render(); return; }
    if (mode === 'talk') talkTopic(row.id);
  }

  function move(d) {
    var n = rows().length;
    if (!n) return;
    sel = (sel + d + n) % n;
    render();
  }

  function unstack() {
    var i;
    if (!NEU.kernel || !NEU.kernel.stack) return;
    i = NEU.kernel.stack.indexOf('mage');
    if (i >= 0) NEU.kernel.stack.splice(i, 1);
  }

  function open() {
    var beaten, met;
    active = true;
    if (api) api.active = true;
    NEU.activeMinigame = 'mage';
    wrap.hidden = false;
    if (NEU.kernel) NEU.kernel.push('mage');
    mode = 'main';
    sel = 0;
    beaten = NEU.save && NEU.save.flagged('mage_beaten');
    met = NEU.save && NEU.save.flagged('mage_met');
    if (NEU.save && !met) NEU.save.flag('mage_met', true);
    if (beaten) say('* you again. the cards remember you.');
    else if (met) say('* you return. the shelves have not moved.');
    else say('* a stone shop. the mage waits.');
    render();
    draw();
  }

  function close() {
    active = false;
    if (api) api.active = false;
    if (NEU.activeMinigame === 'mage') NEU.activeMinigame = null;
    wrap.hidden = true;
    mode = 'main';
    sel = 0;
    unstack();
  }

  function provoke() {
    if (NEU.cards && NEU.cards.open) NEU.cards.open();
  }

  function tick(dt) {
    if (!active) return;
    if (dt !== dt || dt < 0) dt = 0;
    if (!reduced()) clock += dt;
    if (!reduced() && shown < full.length) {
      shown += dt * 30 / 1000;
      if (shown > full.length) shown = full.length;
      paintSay();
    }
    stepMotes(dt);
    draw();
  }

  addEventListener('keydown', function (e) {
    var k, r;
    if (!active || wrap.hidden) return;
    if (NEU.kernel && NEU.kernel.current() !== 'mage') return;
    r = (NEU.keys && NEU.keys.route) ? NEU.keys.route(e.key, {}) : { to: e.key, swallow: false };
    if (r.swallow) return;
    k = r.to;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') { move(-1); e.preventDefault(); return; }
    if (k === 'ArrowDown' || k === 's' || k === 'S') { move(1); e.preventDefault(); return; }
    if (k === 'Escape') {
      e.preventDefault();
      if (mode !== 'main') { mode = 'main'; sel = 0; render(); return; }
      exitAction();
      return;
    }
    if (k === 'Enter' || k === 'z' || k === 'Z') {
      e.preventDefault();
      if (Math.floor(shown) < full.length) { shown = full.length; paintSay(); return; }
      confirm();
    }
    /* X goes back one menu level; on the top menu it leaves, like Esc's exit */
    if (k === 'x' || k === 'X') {
      e.preventDefault();
      if (mode !== 'main') { mode = 'main'; sel = 0; render(); return; }
      exitAction();
      return;
    }
    /* C or spell cast: cast a spell at the mage -> triggers card duel */
    if (k === 'c' || k === 'C') {
      e.preventDefault();
      close();
      provoke();
      return;
    }
  });

  api = {
    open: open, close: close, provoke: provoke, buy: buy, sell: sell, tick: tick,
    running: function () { return active; },
    active: false
  };
  NEU.mage = api;
  if (NEU.kernel) NEU.kernel.register('mage', {
    tick: tick, open: open, close: close,
    running: function () { return active; }
  });
})();
