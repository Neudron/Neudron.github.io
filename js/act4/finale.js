/* finale.js — the figure's beam. Galaxy purple, then the skeleton
   by the campfire. Reduced motion is a fade onto that still frame.
   The kernel owns the clock. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};

  var W = 320, H = 180, BEAM_X = 40;
  var START = 28, REST = 132, FIRE = 150;
  var GRANTS = ['phaseslayer', 'pulse_rifle', 'exoblade', 'magnomaly', 'flying_chair'];

  var live = false, age = 0, beam = 0, skin = 1, bodyY = START, fade = 1;
  var still = false, granted = false, shook = false, hitOnce = false, burstOnce = false, fxT = -1;
  var parts = [], layers = [0, 0], shedT = 0, shedN = 0;
  var root = null, wordEl = null, g = null, off = null;

  function reduced() {
    return !!(NEU.motion && NEU.motion.reduced && NEU.motion.reduced());
  }
  function routeKey(e) {
    var key = e.key || '';
    if (NEU.keys && NEU.keys.route) {
      var r = NEU.keys.route(key, null);
      if (r.swallow) return '';
      key = r.to || key;
    }
    if (key.length === 1) key = key.toLowerCase();
    return key;
  }
  function snapshot() {
    var copy = [], i;
    for (i = 0; i < parts.length; i++) copy.push({ x: parts[i].x, y: parts[i].y });
    return {
      beam: beam, skin: skin, bodyY: bodyY, fireY: FIRE, fade: fade,
      still: still, granted: granted, shook: shook, parts: copy
    };
  }
  function grant() {
    var i;
    if (granted) return;
    granted = true;
    still = true;
    if (NEU.save) for (i = 0; i < GRANTS.length; i++) NEU.save.give(GRANTS[i]);
    if (NEU.juice && NEU.juice.hit) NEU.juice.hit('large');
    if (NEU.talk) NEU.talk(['Supreme.', 'the chair lifts. the snails are done.'], 'figure');
  }
  function spawnAcid() {
    if (parts.length) return;
    parts.push({ x: 140, y: REST, vx: 48, vy: -24, c: '#39FF6A' });
    parts.push({ x: 168, y: REST + 8, vx: -36, vy: 18, c: '#9AFF8A' });
    parts.push({ x: 152, y: REST + 16, vx: 22, vy: -12, c: '#39FF6A' });
    if (!burstOnce && NEU.juice && NEU.juice.burst) {
      burstOnce = true;
      fxT = 0;
      NEU.juice.burst(156, REST, 12, '#39FF6A', 90);
    }
  }
  function play(t) {
    var u, i;
    age += t;
    if (!hitOnce && NEU.juice && NEU.juice.hit) { hitOnce = true; NEU.juice.hit('large'); }
    if (age < 1.4) {
      beam = age / 1.4;
      bodyY = START;
      skin = 1;
    } else if (age < 2.2) {
      beam = 1;
      u = (age - 1.4) / 0.8;
      bodyY = START + (REST - START) * u;
      skin = 1;
    } else {
      beam = 1;
      bodyY = REST;
      u = (age - 2.2) / 1.6;
      if (u >= 1) skin = 0;
      else skin = u < 0 ? 1 : 1 - u;
      spawnAcid();
      if (!reduced()) {
        for (i = 0; i < parts.length; i++) {
          parts[i].x += parts[i].vx * t;
          parts[i].y += parts[i].vy * t;
        }
      }
      if (skin === 0) grant();
    }
    if (fxT >= 0) { fxT += t; if (fxT > 0.9) fxT = -1; }
    tickShed(t, Math.round(beam * (W - BEAM_X)));
    layers[0] += t * 12;
    layers[1] += t * 28;
    fade = 1;
  }
  function calm(t) {
    var i;
    age += t;
    beam = 1;
    bodyY = REST;
    skin = 0;
    fade = age / 0.45;
    if (fade >= 1) { fade = 1; still = true; grant(); }
    if (fxT >= 0) { fxT += t; if (fxT > 0.9) fxT = -1; }
    if (!parts.length) {
      for (i = 0; i < 3; i++) parts.push({ x: 144 + i * 10, y: REST, vx: 0, vy: 0, c: '#39FF6A' });
    }
  }
  /* ── art: sky, ground, figure, skeleton and skin are baked once ───── */
  var art = null, shed = [], HAND_X = 40, HAND_Y = 113, BEAM_TOP = 48;
  var BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  function mk(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function hs(x, y, s) {
    var h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function F(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
  function halo(x, y, r, col, a) {
    var L = NEU.engineLook, i, prev = g.globalAlpha;
    if (L && L.glow) { L.glow(g, x, y, r, col, a); return; }
    for (i = 3; i >= 1; i--) { g.globalAlpha = a * 0.5; F(g, x - r * i / 3 | 0, y - r * i / 3 | 0, 2 * r * i / 3 | 0, 2 * r * i / 3 | 0, col); }
    g.globalAlpha = prev;
  }
  function bakeSky() {
    var c = mk(W, H), k = c.getContext('2d'), x, i;
    F(k, 0, 0, W, H, '#05030A');
    F(k, 0, 22, W, 8, '#0A0614'); F(k, 0, 30, W, 70, '#0A0614'); F(k, 0, 100, W, 8, '#0A0614');
    for (x = 0; x < W; x += 2) { F(k, x, 22 + ((x >> 1) & 1) * 2, 2, 2, '#05030A'); F(k, x, 104 + ((x >> 1) & 1) * 2, 2, 2, '#05030A'); }
    F(k, 0, 38, W, 8, '#140A26'); F(k, 0, 46, W, 44, '#140A26'); F(k, 0, 90, W, 8, '#140A26');
    for (x = 0; x < W; x += 2) { F(k, x, 38 + ((x >> 1) & 1) * 2, 2, 2, '#0A0614'); F(k, x, 92 + ((x >> 1) & 1) * 2, 2, 2, '#0A0614'); }
    F(k, 0, 134, W, 8, '#0A0614'); F(k, 0, 142, W, 8, '#140A26');
    for (x = 0; x < W; x += 2) F(k, x, 134 + ((x >> 1) & 1) * 2, 2, 2, '#05030A');
    for (i = 0; i < 20; i++) F(k, (hs(i, 1, 4) * 316) | 0, (hs(i, 2, 4) * 130) | 0, 1 + (i % 5 === 0 ? 1 : 0), 1, i % 4 === 0 ? '#E4E0D4' : '#B892FF');
    return c;
  }
  function bakeGround(layer) {
    var c = mk(W, 30), k = c.getContext('2d'), i, x, y, w;
    if (!layer) {
      F(k, 0, 0, W, 30, '#14101C'); F(k, 0, 0, W, 1, '#3A3248'); F(k, 0, 1, W, 1, '#2A2236');
      F(k, 0, 8, W, 6, '#1E1828'); F(k, 0, 20, W, 10, '#1E1828'); F(k, 0, 24, W, 6, '#14101C');
    } else {
      for (i = 0; i < 26; i++) {
        x = (hs(i, 3, 6) * W) | 0; y = 3 + ((hs(i, 4, 6) * 24) | 0); w = 4 + ((hs(i, 5, 6) * 10) | 0);
        F(k, x, y, w, 3, '#2A2236'); F(k, x, y, w, 1, '#3A3248'); F(k, x + 1, y + 3, w - 1, 1, '#0A080E');
        if (x + w > W) { F(k, x - W, y, w, 3, '#2A2236'); F(k, x - W, y, w, 1, '#3A3248'); }
      }
    }
    return c;
  }
  function bakeFigure() {
    var c = mk(40, 56), k = c.getContext('2d'), cx = 16, r, hw, l, wd, i, ox, T = ['#0A080E', '#100E16', '#1E1828', '#2A2236'];
    function row(y, a, wdt, rim) {
      F(k, a, y, wdt, 1, T[1]);
      F(k, a, y, Math.max(1, Math.round(wdt * 0.3)), 1, T[0]);
      F(k, a + Math.round(wdt * 0.62), y, Math.max(1, Math.round(wdt * 0.24)), 1, T[2]);
      F(k, a + Math.round(wdt * 0.86), y, wdt - Math.round(wdt * 0.86), 1, T[3]);
      if (rim) F(k, a + wdt - 1, y, 1, 1, '#B892FF');
    }
    for (r = 14; r < 56; r++) {
      hw = Math.round(6 + (r - 14) * 0.22); l = cx - hw; wd = hw * 2 + 1;
      row(r, l, wd, true);
      if (r > 52) F(k, l, r, wd - 1, 1, T[0]);
    }
    for (i = 0; i < 4; i++) { r = 22 + ((hs(i, 7, 3) * 14) | 0); F(k, cx - 6 + i * 4, r, 1, 10 + i * 2, T[0]); F(k, cx - 5 + i * 4, r + 2, 1, 6, T[2]); }
    for (r = 0; r < 16; r++) {
      ox = Math.round(4 * (1 - r / 15)); hw = r < 2 ? 1 : Math.min(9, Math.round(3 + r * 0.45));
      row(r, cx + ox - hw, hw * 2 + 1, true);
    }
    F(k, cx + 1, 5, 7, 8, '#000');
    F(k, cx + 2, 7, 2, 2, '#E4E0D4'); F(k, cx + 5, 7, 2, 2, '#E4E0D4');
    /* the raised arm points at the beam */
    F(k, cx + 3, 16, 22, 4, T[2]); F(k, cx + 3, 16, 22, 1, T[3]); F(k, cx + 3, 19, 22, 1, T[0]); F(k, cx + 3, 16, 22, 1, '#B892FF');
    F(k, 36, 16, 3, 3, '#E4E0D4');
    return c;
  }
  /* the skeleton is a few dozen rects: drawn live at rest, baked only for the dither mix */
  function boneAt(k, ox, oy) {
    var i, f = function (x, y, w, h, c) { F(k, ox + x, oy + y, w, h, c); };
    f(5, 0, 10, 10, '#C9B9A2'); f(5, 0, 9, 9, '#E8DCC8'); f(5, 0, 4, 1, '#F4F0E6'); f(5, 0, 1, 4, '#F4F0E6');
    f(6, 3, 3, 3, '#1A120C'); f(11, 3, 3, 3, '#1A120C'); f(9, 7, 2, 2, '#1A120C');
    f(6, 9, 8, 2, '#E8DCC8');
    f(9, 11, 2, 12, '#E8DCC8'); f(9, 11, 1, 12, '#F4F0E6');
    for (i = 0; i < 4; i++) { f(4, 13 + i * 3, 12, 1, '#E8DCC8'); f(4, 13 + i * 3, 3, 1, '#F4F0E6'); }
    f(5, 22, 10, 3, '#C9B9A2'); f(5, 22, 10, 1, '#E8DCC8');
    f(5, 25, 2, 15, '#E8DCC8'); f(13, 25, 2, 15, '#E8DCC8'); f(5, 25, 1, 15, '#F4F0E6'); f(4, 38, 4, 2, '#C9B9A2'); f(12, 38, 4, 2, '#C9B9A2');
    f(1, 13, 2, 12, '#E8DCC8'); f(17, 13, 2, 12, '#E8DCC8'); f(1, 13, 1, 12, '#F4F0E6');
  }
  function bakeBone() {
    var c = mk(20, 40);
    boneAt(c.getContext('2d'), 0, 0);
    return c;
  }
  function bakeSkin() {
    var c = mk(20, 40), k = c.getContext('2d'), L = NEU.engineLook;
    if (L && L.drawPlayer) L.drawPlayer(k, 10, 40, 'down', 0, false, 2, 0);
    else { F(k, 4, 14, 12, 10, '#C4A882'); F(k, 3, 24, 14, 12, '#6A5A8A'); F(k, 4, 36, 4, 4, '#3A2414'); F(k, 12, 36, 4, 4, '#3A2414'); }
    return c;
  }
  function ensureArt() {
    if (art) return;
    art = { sky: bakeSky(), gA: bakeGround(0), gB: bakeGround(1), fig: bakeFigure(), bone: bakeBone(), skin: bakeSkin(), mix: {} };
  }
  /* skin -> bones through a 2px ordered dither, cached per level (no alpha) */
  function mixFor(level) {
    var c = art.mix[level], k, bx, by;
    if (c) return c;
    c = mk(20, 40); k = c.getContext('2d');
    for (by = 0; by < 20; by++) for (bx = 0; bx < 10; bx++) {
      k.drawImage(BAYER[by & 3][bx & 3] < level * 2 ? art.skin : art.bone, bx * 2, by * 2, 2, 2, bx * 2, by * 2, 2, 2);
    }
    art.mix[level] = c;
    return c;
  }
  function beamCY(x) {
    var u = (x - HAND_X) / 100;
    if (u < 0) u = 0; if (u > 1) u = 1;
    return Math.round(HAND_Y + (BEAM_TOP - HAND_Y) * u);
  }
  function drawBeam(bw, rm) {
    var LAY = [['#3A1066', 40], ['#6A2ACC', 30], ['#7C5CFF', 22], ['#B892FF', 14], ['#F4ECFF', 6]];
    var x, i, cy, hh, wob, tap, x1 = HAND_X + bw;
    for (x = HAND_X; x < x1; x += 4) {
      cy = beamCY(x);
      tap = Math.min(1, 0.45 + (x - HAND_X) / 50);
      for (i = 0; i < 5; i++) {
        hh = Math.max(2, Math.round(LAY[i][1] * tap));
        wob = rm ? 0 : Math.round(Math.sin(age * 18 + x * 0.5 + i));
        F(g, x, cy - (hh >> 1) + (i < 3 ? wob : 0), Math.min(4, x1 - x), hh, LAY[i][0]);
      }
    }
  }
  /* the galaxy the beam tears open: the old five bands as a faint wash behind the ray */
  function drawWash(bw) {
    var C = ['#07060C', '#1A1030', '#3A1464', '#6A2CFF', '#120814'], A = [0.55, 0.45, 0.4, 0.14, 0.45], i;
    for (i = 0; i < 5; i++) { g.globalAlpha = A[i]; F(g, BEAM_X, 8 + i * 24, bw, 24, C[i]); }
    g.globalAlpha = 1;
  }
  function drawShed(rm) {
    var i, p;
    if (rm) return;
    for (i = 0; i < shed.length; i++) {
      p = shed[i];
      F(g, Math.round(p.x), Math.round(p.y), p.s, p.s, i & 1 ? '#B892FF' : '#E4E0D4');
    }
  }
  function tickShed(t, bw) {
    var i, p, x;
    for (i = shed.length - 1; i >= 0; i--) {
      p = shed[i]; p.y -= 24 * t; p.life -= t;
      if (p.life <= 0) shed.splice(i, 1);
    }
    shedT += t;
    if (shedT >= 0.05 && bw > 20 && shed.length < 24) {
      shedT = 0; shedN++;
      x = HAND_X + 8 + ((hs(shedN, 1, 2) * (bw - 8)) | 0);
      shed.push({ x: x, y: beamCY(x) + (shedN & 1 ? 12 : -14), s: 1 + (shedN & 1), life: 0.5 });
    }
  }
  function draw() {
    var bw, i, rm = reduced(), shookNow, by, lv, so = layers[0], mid;
    if (!g) return;
    ensureArt();
    g.imageSmoothingEnabled = false;
    if (root) {
      root.style.opacity = fade >= 1 ? '1' : String(Math.round(fade * 100) / 100);
      if (still) root.classList.add('is-still');
    }
    if (wordEl) wordEl.hidden = beam < 0.85;
    shookNow = NEU.juice && NEU.juice.begin && NEU.juice.begin(g, W, H);
    if (shookNow) shook = true;
    g.drawImage(art.sky, 0, 0);
    g.drawImage(art.gA, 0, 150);
    so = Math.round(((layers[0] % W) + W) % W);
    g.drawImage(art.gB, -so, 150); g.drawImage(art.gB, W - so, 150);
    so = Math.round(((layers[1] % W) + W) % W);
    g.drawImage(art.gB, -so, 156); g.drawImage(art.gB, W - so, 156);
    /* campfire: logs, glow, flame */
    halo(202, 160, 28, '#FFB347', 0.2);
    F(g, 193, 162, 18, 6, '#22140A'); F(g, 194, 162, 16, 5, '#3A2414'); F(g, 194, 162, 16, 1, '#5A3418'); F(g, 197, 160, 10, 3, '#3A2414');
    F(g, 190, 166, 4, 3, '#2A2236'); F(g, 210, 166, 4, 3, '#2A2236'); F(g, 190, 166, 4, 1, '#3A3248'); F(g, 210, 166, 4, 1, '#3A3248');
    if (NEU.roomArt && NEU.roomArt.flame) NEU.roomArt.flame(g, 202, 163, 1, 2, rm ? 0 : age * 1000, 0);
    else { F(g, 197, 154, 10, 9, '#E25822'); F(g, 199, 150, 6, 8, '#F0C040'); }
    g.drawImage(art.fig, 3, 96);
    bw = Math.round(beam * (W - BEAM_X));
    if (bw > 0) {
      drawWash(bw);
      drawBeam(bw, rm);
      halo(HAND_X, HAND_Y, 12, '#B892FF', 0.5);
      g.globalAlpha = 0.5; F(g, HAND_X - 10, HAND_Y - 10, 21, 1, '#B892FF'); F(g, HAND_X - 10, HAND_Y + 10, 21, 1, '#B892FF');
      F(g, HAND_X - 10, HAND_Y - 10, 1, 21, '#B892FF'); F(g, HAND_X + 10, HAND_Y - 10, 1, 21, '#B892FF');
      g.globalAlpha = 0.3; F(g, HAND_X - 16, HAND_Y - 16, 33, 1, '#B892FF'); F(g, HAND_X - 16, HAND_Y + 16, 33, 1, '#B892FF');
      F(g, HAND_X - 16, HAND_Y - 16, 1, 33, '#B892FF'); F(g, HAND_X + 16, HAND_Y - 16, 1, 33, '#B892FF');
      g.globalAlpha = 1;
      F(g, HAND_X - 6, HAND_Y - 2, 6, 4, '#100E16'); F(g, HAND_X - 6, HAND_Y - 2, 6, 1, '#2A2236');
      F(g, HAND_X - 1, HAND_Y - 1, 3, 3, '#E4E0D4');
      drawShed(rm);
    }
    by = Math.round(bodyY);
    if (skin <= 0) boneAt(g, 132, by);
    else if (skin >= 1) g.drawImage(art.skin, 132, by);
    else { lv = Math.max(1, Math.min(7, Math.round(skin * 8))); g.drawImage(mixFor(lv), 132, by); }
    if (skin < 1 && bw > 0) halo(142, by + 20, 14, '#B892FF', 0.25);
    for (i = 0; i < parts.length; i++) {
      F(g, Math.round(parts[i].x), Math.round(parts[i].y), 2, 2, parts[i].c);
    }
    if (fxT >= 0 && fxT <= 0.9 && NEU.fxBurst) NEU.fxBurst(g, 'fxGigBoomV', 156, REST, fxT / 0.9, 2.4);
    if (shookNow && NEU.juice.end) NEU.juice.end(g, shookNow);
    if (NEU.juice && NEU.juice.overlay) NEU.juice.overlay(g, W, H);
  }
  function step(dtMs) {
    var t;
    if (!live) return null;
    t = Math.min(0.05, Math.max(0, dtMs) / 1000);
    if (reduced()) calm(t);
    else play(t);
    draw();
    return snapshot();
  }
  function close() {
    if (live) grant();
    live = false;
    if (NEU.activeMinigame === 'finale') NEU.activeMinigame = null;
    if (off) off();
    off = null;
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null;
    wordEl = null;
    g = null;
    if (NEU.kernel && NEU.kernel.current() === 'finale') NEU.kernel.pop();
  }
  function onKey(e) {
    var k;
    if (!live || e.type !== 'keydown') return;
    if (NEU.kernel && NEU.kernel.current() !== 'finale') return;
    if (NEU.tboxOpen && NEU.tboxOpen()) return;
    k = routeKey(e);
    if (k === 'x' || k === 'Escape' || ((k === 'z' || k === 'Enter' || k === ' ') && granted)) close();
  }
  function open() {
    var cv;
    if (live) return;
    live = true;
    age = 0;
    granted = false;
    shook = false;
    hitOnce = false;
    burstOnce = false;
    fxT = -1;
    layers = [0, 0];
    shed = [];
    still = false;
    if (reduced()) {
      beam = 1; skin = 0; bodyY = REST; fade = 0;
      parts = [{ x: 148, y: REST, vx: 0, vy: 0, c: '#39FF6A' }];
    } else {
      beam = 0; skin = 1; bodyY = START; fade = 1;
      parts = [];
    }
    NEU.activeMinigame = 'finale';
    root = document.createElement('div');
    root.id = 'finale';
    root.className = 'finale';
    root.setAttribute('role', 'dialog');
    root.style.opacity = fade >= 1 ? '1' : '0';
    cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    wordEl = document.createElement('p');
    wordEl.className = 'finale__word';
    wordEl.textContent = 'Supreme.';
    wordEl.hidden = true;
    root.appendChild(cv);
    root.appendChild(wordEl);
    document.body.appendChild(root);
    g = cv.getContext('2d');
    off = function () { removeEventListener('keydown', onKey); };
    addEventListener('keydown', onKey);
    if (NEU.kernel && NEU.kernel.current() !== 'finale') NEU.kernel.push('finale');
    draw();
  }

  NEU.finale = {
    open: open, close: close, step: step,
    get state() { return live ? snapshot() : null; }
  };
  if (NEU.kernel) NEU.kernel.register('finale', {
    tick: step, open: open, close: close,
    running: function () { return live; }
  });
})();
