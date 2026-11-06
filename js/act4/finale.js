/* finale.js — the figure's beam. Galaxy purple, then the skeleton
   by the campfire. Reduced motion is a fade onto that still frame.
   The kernel owns the clock. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};

  var W = 320, H = 180;
  var START = 28, REST = 132, FIRE = 150;
  var BANDS = ['#07060C', '#1A1030', '#3A1464', '#6A2CFF', '#120814'];
  var GRANTS = ['phaseslayer', 'pulse_rifle', 'exoblade', 'magnomaly', 'flying_chair'];

  var live = false, age = 0, beam = 0, skin = 1, bodyY = START, fade = 1;
  var still = false, granted = false, shook = false, hitOnce = false, burstOnce = false;
  var parts = [], layers = [0, 0];
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
    parts.push({ x: 168, y: REST + 8, vx: -36, vy: 18, c: '#B44CFF' });
    parts.push({ x: 152, y: REST + 16, vx: 22, vy: -12, c: '#39FF6A' });
    if (!burstOnce && NEU.juice && NEU.juice.burst) {
      burstOnce = true;
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
    if (!parts.length) {
      for (i = 0; i < 3; i++) parts.push({ x: 144 + i * 10, y: REST, vx: 0, vy: 0, c: '#39FF6A' });
    }
  }
  function band(col, y, shift) {
    var o = Math.round(((shift % W) + W) % W);
    g.fillStyle = col;
    g.fillRect(-o, y, W, 16);
    g.fillRect(W - o, y, W, 16);
  }
  function drawBody() {
    var x = 132, y = Math.round(bodyY);
    if (skin <= 0) {
      g.fillStyle = '#F4F0E6';
      g.fillRect(x + 6, y, 8, 8);
      g.fillRect(x + 8, y + 10, 4, 16);
      g.fillRect(x, y + 12, 20, 4);
      g.fillRect(x + 2, y + 26, 4, 12);
      g.fillRect(x + 12, y + 26, 4, 12);
    } else {
      g.fillStyle = '#C4A882';
      g.fillRect(x + 4, y, 12, 10);
      g.fillRect(x + 2, y + 10, 16, 18);
      g.fillRect(x + 2, y + 28, 6, 10);
      g.fillRect(x + 12, y + 28, 6, 10);
    }
  }
  function draw() {
    var bw, i, y, shookNow;
    if (!g) return;
    g.imageSmoothingEnabled = false;
    if (root) {
      root.style.opacity = fade >= 1 ? '1' : String(Math.round(fade * 100) / 100);
      if (still) root.classList.add('is-still');
    }
    if (wordEl) wordEl.hidden = beam < 0.85;
    shookNow = NEU.juice && NEU.juice.begin && NEU.juice.begin(g, W, H);
    if (shookNow) shook = true;
    g.fillStyle = '#07060C';
    g.fillRect(0, 0, W, H);
    band('#1A1030', 150, layers[0]);
    band('#3A1464', 166, layers[1]);
    bw = Math.round(beam * W);
    if (bw > 0) {
      for (i = 0; i < BANDS.length; i++) {
        g.fillStyle = BANDS[i];
        g.fillRect(0, 8 + i * 24, bw, 24);
      }
      g.fillStyle = '#FFFFFF';
      for (i = 0; i < 12; i++) {
        y = 16 + ((i * 18) % 100);
        g.fillRect(Math.round((i * 26) % Math.max(bw, 1)), y, 2, 2);
      }
    }
    g.fillStyle = '#3A2414';
    g.fillRect(188, 156, 28, 8);
    g.fillStyle = '#E25822';
    g.fillRect(194, 146, 8, 10);
    g.fillStyle = '#F0C040';
    g.fillRect(196, 140, 4, 8);
    drawBody();
    for (i = 0; i < parts.length; i++) {
      g.fillStyle = parts[i].c;
      g.fillRect(Math.round(parts[i].x), Math.round(parts[i].y), 2, 2);
    }
    if (beam >= 0.85) {
      g.font = '64px monospace';
      g.fillStyle = '#E8D4FF';
      g.fillText('Supreme.', 16, 96);
    }
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
    layers = [0, 0];
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
