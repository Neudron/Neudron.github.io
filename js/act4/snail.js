/* snail.js — the underground station. A menu of stops the save has
   already marked, then one full-screen ride on the kernel clock.
   The shell wobbles under 3 Hz. Reduced motion: the pan state creeps, the picture holds still. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};

  var STOPS = [
    { id: 's1', flag: 'snail_s1', room: 's1_gate', spawn: 'south', name: 'the gate' },
    { id: 's3', flag: 'snail_s3', room: 's3_market', spawn: 'west', name: 'the market' },
    { id: 's6', flag: 'snail_s6', room: 's6_kraal', spawn: 'west', name: 'the kraal' },
    { id: 's11', flag: 'snail_s11', room: 's11_elder', spawn: 'north', name: 'the elder' },
    { id: 's14', flag: 'snail_s14', room: 's14_station', spawn: 'north', name: 'the station' }
  ];
  var W = 320, H = 180;
  var FAST = 0.5, SLOW = 0.16, WOB = 17;

  var live = false, phase = 'menu', sel = 0, prog = 0, pan = 0, wob = 0, shellX = 0;
  var lines = [], layers = [0, 0, 0];
  var root = null, listEl = null, g = null, off = null;
  var dest = null, from = null;

  function reduced() {
    return !!(NEU.motion && NEU.motion.reduced && NEU.motion.reduced());
  }
  function keyName(def) { return NEU.keys && NEU.keys.label ? NEU.keys.label(def) : def; }
  function stopById(id) {
    var i;
    for (i = 0; i < STOPS.length; i++) if (STOPS[i].id === id) return STOPS[i];
    return null;
  }
  function unlocked() {
    var out = [], i;
    for (i = 0; i < STOPS.length; i++) {
      if (NEU.save && NEU.save.flagged(STOPS[i].flag)) out.push(STOPS[i]);
    }
    return out;
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
    return {
      phase: phase, sel: sel, prog: prog, pan: pan, shell: shellX,
      lines: lines.length, layers: [layers[0], layers[1], layers[2]],
      from: from ? from.id : null, dest: dest ? dest.id : null
    };
  }
  function arrive(id) {
    var s = stopById(id);
    if (!s || !NEU.save) return;
    if (!NEU.save.flagged(s.flag)) NEU.save.flag(s.flag, 1);
    from = s;
  }
  function fillList() {
    var list, i, li;
    if (!listEl) return;
    list = unlocked();
    if (sel >= list.length) sel = list.length ? list.length - 1 : 0;
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
    if (!list.length) {
      li = document.createElement('li');
      li.textContent = '* nowhere yet.';
      listEl.appendChild(li);
      listEl.hidden = phase !== 'menu';
      return;
    }
    for (i = 0; i < list.length; i++) {
      li = document.createElement('li');
      li.setAttribute('data-stop', list[i].id);
      li.textContent = list[i].name;
      if (i === sel) li.className = 'is-sel';
      listEl.appendChild(li);
    }
    listEl.hidden = phase !== 'menu';
  }
  /* ── art: five parallax layers and the snail, all baked once ──────── */
  var art = null, clock = 0;
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
  function F(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  /* a rect that also lands one canvas-width to the left, so layers wrap */
  function WF(g, wc, x, y, w, h, c) { F(g, x, y, w, h, c); if (x + w > wc) F(g, x - wc, y, w, h, c); }
  function bakeCeil() {
    var c = mk(W, 40), g = c.getContext('2d'), i, x, len, w, r, wr;
    F(g, 0, 0, W, 40, '#0E0A08');
    F(g, 0, 28, W, 6, '#12100A');
    for (i = 0; i < 26; i++) {
      x = (hs(i, 1, 11) * W) | 0; len = 4 + ((hs(i, 2, 11) * 9) | 0); w = 2 + (len >> 2) * 2;
      for (r = 0; r < len; r++) {
        wr = Math.max(1, Math.round(w * (1 - r / len)));
        WF(g, W, x - (wr >> 1), 28 + r, wr, 1, r < len - 2 ? '#1A120C' : '#2A1E14');
        if (wr > 2) WF(g, W, x - (wr >> 1), 28 + r, 1, 1, '#3A2C20');
      }
    }
    return c;
  }
  function bakeFar() {
    var c = mk(W, 90), g = c.getContext('2d'), i, x, y, w, h, tone = ['#1A120C', '#2A1E14', '#3A2A1C', '#4A3624'], cx, cy, a;
    F(g, 0, 0, W, 90, tone[0]);
    for (y = 0; y < 90; y += 10) F(g, 0, y, W, 4, tone[1]);
    for (i = 0; i < 40; i++) {
      x = (hs(i, 3, 5) * W) | 0; y = 4 + ((hs(i, 4, 5) * 80) | 0); w = 8 + ((hs(i, 5, 5) * 18) | 0); h = 4 + (w >> 2);
      WF(g, W, x, y, w, h, tone[1]);
      WF(g, W, x, y, w, 1, tone[3]);
      WF(g, W, x, y, 1, h, tone[2]);
      WF(g, W, x + 1, y + h, w - 1, 1, tone[0]);
      if (i % 3 === 0) WF(g, W, x + 2, y + 1, w - 4, 2, tone[2]);
    }
    /* glowing fungus clusters */
    for (i = 0; i < 6; i++) {
      cx = 20 + ((hs(i, 6, 5) * 280) | 0); cy = 40 + ((hs(i, 7, 5) * 40) | 0);
      g.globalAlpha = 0.06; WF(g, W, cx - 18, cy - 14, 40, 26, '#39FF6A');
      g.globalAlpha = 0.1; WF(g, W, cx - 12, cy - 9, 28, 18, '#39FF6A');
      g.globalAlpha = 0.2; WF(g, W, cx - 7, cy - 5, 18, 10, '#39FF6A');
      g.globalAlpha = 1;
      for (a = 0; a < 3; a++) {
        WF(g, W, cx + a * 5 - 1, cy + 2, 1, 5 - a, '#1A120C');
        WF(g, W, cx + a * 5 - 3, cy - a % 2, 6, 3, '#2A8A4A');
        WF(g, W, cx + a * 5 - 3, cy - a % 2, 6, 1, '#5AD07A');
        WF(g, W, cx + a * 5 - 1, cy - a % 2 + 1, 2, 1, '#9AFF8A');
      }
    }
    return c;
  }
  function bakeArch() {
    var wc = 288, c = mk(wc, 130), g = c.getContext('2d'), x, k;
    for (k = 0; k < 3; k++) {
      x = k * 96;
      /* post */
      F(g, x + 4, 12, 10, 118, '#3A2414'); F(g, x + 4, 12, 3, 118, '#4A2C14'); F(g, x + 5, 12, 1, 118, '#8A5A32'); F(g, x + 12, 12, 2, 118, '#22140A');
      /* beam */
      F(g, x, 4, 96, 12, '#3A2414'); F(g, x, 4, 96, 2, '#8A5A32'); F(g, x, 6, 96, 4, '#4A2C14'); F(g, x, 14, 96, 2, '#22140A');
      /* braces */
      F(g, x + 14, 16, 3, 3, '#3A2414'); F(g, x + 17, 19, 3, 3, '#3A2414'); F(g, x + 20, 22, 3, 3, '#3A2414');
      F(g, x - 3, 16, 3, 3, '#3A2414'); F(g, x - 6, 19, 3, 3, '#3A2414');
      F(g, x + 8, 40, 2, 2, '#8A5A32');
    }
    return c;
  }
  function bakeTrack() {
    var c = mk(W, 44), g = c.getContext('2d'), tone = ['#3A2A1C', '#4A3624', '#5A4430'], r, x, q, i;
    for (r = 0; r < 5; r++) {
      for (x = -((r & 1) * 8); x < W; x += 16) {
        q = (hs(x + 40, r, 8) * 3) | 0;
        F(g, x, r * 8 + 4, 16, 8, tone[q]);
        F(g, x, r * 8 + 4, 16, 1, r ? tone[2] : '#6A5238');
        F(g, x, r * 8 + 4, 1, 8, tone[Math.min(2, q + 1)]);
        F(g, x + 15, r * 8 + 4, 1, 8, '#22160D');
        F(g, x, r * 8 + 11, 16, 1, '#22160D');
      }
    }
    F(g, 0, 0, W, 4, '#2A1E14'); F(g, 0, 3, W, 1, '#6A5238');
    g.globalAlpha = 0.3;
    for (i = 0; i < 20; i++) F(g, i * 16 + ((i * 7) % 5), 8 + (i & 1), 10, 1, '#7AE0A0');
    g.globalAlpha = 1;
    return c;
  }
  function bakeFore() {
    var wc = 640, c = mk(wc, H), g = c.getContext('2d'), i, px = [70, 330, 540], r, wr;
    for (i = 0; i < 3; i++) {
      for (r = 0; r < 36; r++) {
        wr = 24 - Math.round(r * 0.35) + ((r & 3) === 0 ? 1 : 0);
        F(g, px[i] - (wr >> 1), 144 + r, wr, 1, '#0A0806');
        if (r > 2) F(g, px[i] - (wr >> 1), 144 + r, 1, 1, '#1A120C');
      }
      for (r = 0; r < 30; r++) {
        wr = 14 - Math.round(r * 0.38);
        if (wr > 0) { F(g, px[i] + 90 - (wr >> 1), r, wr, 1, '#0A0806'); }
      }
    }
    return c;
  }
  function bakeShell() {
    var N = 34, c = mk(N, N + 8), g = c.getContext('2d'), x, y, dx, dy, d, e, a, rr, px, py;
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
      dx = x + 0.5 - 17; dy = y + 0.5 - 17; d = Math.sqrt(dx * dx + dy * dy);
      if (d > 17) continue;
      if (d > 16.2) { F(g, x, y, 1, 1, '#12081E'); continue; }
      e = Math.sqrt((x + 0.5 - 11) * (x + 0.5 - 11) + (y + 0.5 - 10) * (y + 0.5 - 10)) / 22;
      F(g, x, y, 1, 1, e < 0.3 ? '#F0B060' : e < 0.55 ? '#C47A32' : e < 0.8 ? '#8A5A28' : '#5A3418');
    }
    for (a = 0; a < 18.9; a += 0.09) {
      rr = 1.5 + a * 0.82;
      px = Math.round(17 + Math.cos(a) * rr); py = Math.round(17 + Math.sin(a) * rr);
      if (Math.sqrt((px - 17) * (px - 17) + (py - 17) * (py - 17)) < 15) F(g, px, py, 1, 1, '#3A2410');
    }
    F(g, 8, 6, 3, 2, '#FFE0A0');
    /* saddle on top, hung under the player */
    F(g, 9, 0, 16, 8, '#12081E'); F(g, 10, 1, 14, 6, '#A04030'); F(g, 10, 1, 14, 1, '#C45A44'); F(g, 10, 5, 14, 2, '#6A2A20');
    return c;
  }
  function bakeBody() {
    var c = mk(72, 28), g = c.getContext('2d'), r, x0, x1, row;
    function Row(y, a, b) {
      F(g, a - 1, y, b - a + 2, 1, '#12081E');
    }
    for (r = 0; r < 16; r++) { x0 = r < 2 ? 8 : r > 13 ? 6 : 4; x1 = r < 2 ? 56 : 62; Row(6 + r, x0, x1); }
    Row(1, 49, 62); Row(2, 49, 63); Row(3, 49, 63); Row(4, 49, 63); Row(5, 49, 63);
    for (r = 0; r < 14; r++) {
      x0 = r === 0 ? 8 : r > 12 ? 7 : 5; x1 = r === 0 ? 55 : 61;
      row = 7 + r;
      F(g, x0, row, x1 - x0, 1, r < 3 ? '#C4B48A' : r < 10 ? '#9A8A6A' : '#7A6A4A');
      if (r === 0) F(g, x0 + 2, row, x1 - x0 - 4, 1, '#E8DCB0');
    }
    F(g, 50, 2, 12, 5, '#9A8A6A'); F(g, 50, 2, 12, 1, '#E8DCB0'); F(g, 50, 3, 12, 1, '#C4B48A');
    F(g, 58, 5, 2, 1, '#12081E');
    return c;
  }
  function ensureArt() {
    if (art) return;
    art = { ceil: bakeCeil(), far: bakeFar(), arch: bakeArch(), track: bakeTrack(), fore: bakeFore(), shell: bakeShell(), body: bakeBody() };
  }
  function scrollDraw(img, wc, x, y, off) {
    var o = Math.round(((off % wc) + wc) % wc);
    g.drawImage(img, -o, y);
    g.drawImage(img, wc - o, y);
  }
  function lv(i) { return reduced() ? 0 : layers[i]; }
  function draw() {
    var rm, i, x, y, bx = 124, by = 106, sy, sway, L = NEU.engineLook;
    fillList();
    if (!g) return;
    ensureArt();
    g.imageSmoothingEnabled = false;
    rm = reduced();
    F(g, 0, 0, W, H, '#0E0A08');
    scrollDraw(art.far, W, 0, 34, lv(0) * 0.5);
    scrollDraw(art.ceil, W, 0, 0, lv(0) * 0.25);
    scrollDraw(art.arch, 288, 0, 22, lv(1));
    F(g, 0, 138, W, 6, '#1A120C');
    scrollDraw(art.track, W, 0, 138, lv(2));
    shellX = (rm || phase !== 'ride') ? 0 : Math.round(Math.sin(wob) * 6);
    sy = shellX >= 3 ? 1 : shellX <= -3 ? -1 : 0;
    sway = rm ? 0 : (Math.floor(clock / 0.3) & 1);
    /* contact shadow, body, stalks, shell, rider */
    F(g, bx + 2, by + 44, 62, 3, '#0A0806');
    g.drawImage(art.body, bx, by + 20 + sy);
    F(g, bx + 54, by + 21 - sway + sy, 2, 8, '#9A8A6A'); F(g, bx + 59, by + 21 + sway + sy, 2, 8, '#9A8A6A');
    F(g, bx + 53, by + 18 - sway + sy, 4, 4, '#12081E'); F(g, bx + 58, by + 18 + sway + sy, 4, 4, '#12081E');
    F(g, bx + 54, by + 19 - sway + sy, 2, 2, '#1A120C'); F(g, bx + 59, by + 19 + sway + sy, 2, 2, '#1A120C');
    F(g, bx + 55, by + 19 - sway + sy, 1, 1, '#FFFFFF'); F(g, bx + 60, by + 19 + sway + sy, 1, 1, '#FFFFFF');
    g.drawImage(art.shell, bx + 12, by + sy);
    if (L && L.drawPlayer) L.drawPlayer(g, bx + 29, by + sy + 3, 'right', 0, false, 1, rm ? 0 : clock * 1000);
    else F(g, bx + 25, by + sy - 12, 8, 14, '#f0d8a8');
    if (!rm && phase === 'ride') {
      g.globalAlpha = 0.5;
      g.fillStyle = '#F0D48A';
      for (i = 0; i < lines.length; i++) {
        x = Math.round(lines[i].x);
        y = Math.round(lines[i].y);
        g.fillRect(x, y, lines[i].w, 1);
      }
      g.globalAlpha = 1;
    }
    scrollDraw(art.fore, 640, 0, 0, lv(2) * 1.4);
    if (phase === 'menu') {
      F(g, 112, 8, 96, 28, '#12081E'); F(g, 113, 9, 94, 26, '#3A2414'); F(g, 113, 9, 94, 1, '#5A3418'); F(g, 113, 34, 94, 1, '#22140A');
      F(g, 116, 12, 2, 2, '#C8A040'); F(g, 202, 12, 2, 2, '#C8A040'); F(g, 116, 29, 2, 2, '#C8A040'); F(g, 202, 29, 2, 2, '#C8A040');
      g.font = '16px "Determination Mono", monospace';
      g.textBaseline = 'alphabetic';
      g.textAlign = 'center';
      g.fillStyle = '#12081E'; g.fillText('STATION', 161, 28);
      g.fillStyle = '#C8A040'; g.fillText('STATION', 160, 27);
      g.textAlign = 'left';
    }
  }
  function beginRide(stop) {
    var i;
    dest = stop;
    phase = 'ride';
    prog = 0;
    pan = 0;
    wob = 0;
    shellX = 0;
    layers = [0, 0, 0];
    lines = [];
    if (!reduced()) {
      for (i = 0; i < 8; i++) lines.push({ x: 20 + i * 36, y: 16 + (i * 22) % 150, w: 28 });
    }
    if (NEU.juice && NEU.juice.hit) NEU.juice.hit('small');
    draw();
  }
  function finish() {
    var room = dest ? dest.room : null;
    var spawn = dest ? dest.spawn : 'north';
    prog = 1;
    phase = 'done';
    if (room && NEU.save) NEU.save.flag('snail_dest', room);
    if (NEU.juice && NEU.juice.hit) NEU.juice.hit('small');
    if (NEU.talk && dest) NEU.talk(['* the snail stops at ' + dest.name + '.'], 'narr');
    close();
    if (room && NEU.engine && NEU.engine.running && typeof NEU.engine.go === 'function')
      NEU.engine.go(room, spawn);
  }
  function step(dtMs) {
    var t, i;
    if (!live) return null;
    t = Math.min(0.05, Math.max(0, dtMs) / 1000);
    clock += t;
    if (phase === 'ride') {
      prog += t * (reduced() ? SLOW : FAST);
      if (reduced()) {
        /* the pan state creeps (the save contract), but draw() paints still frames under reduced motion */
        pan += t * 24;
        wob = 0;
        lines.length = 0;
        layers[0] += t * 8;
        layers[1] += t * 14;
        layers[2] += t * 22;
      } else {
        wob += t * WOB;
        pan += t * 480;
        layers[0] += t * 40;
        layers[1] += t * 140;
        layers[2] += t * 320;
        for (i = 0; i < lines.length; i++) {
          lines[i].x -= t * 640;
          if (lines[i].x < -40) lines[i].x += W + 40;
        }
      }
      if (prog >= 1) { finish(); return null; }
    }
    draw();
    return snapshot();
  }
  function close() {
    live = false;
    phase = 'menu';
    if (NEU.activeMinigame === 'snail') NEU.activeMinigame = null;
    if (off) off();
    off = null;
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null;
    listEl = null;
    g = null;
    if (NEU.kernel && NEU.kernel.current() === 'snail') NEU.kernel.pop();
  }
  function open() {
    var cv, hint;
    if (live) return;
    live = true;
    phase = 'menu';
    sel = 0;
    prog = 0;
    dest = null;
    NEU.activeMinigame = 'snail';
    root = document.createElement('div');
    root.id = 'snail';
    root.className = 'snail';
    root.setAttribute('role', 'dialog');
    cv = document.createElement('canvas');
    cv.id = 'snailCanvas';
    cv.width = W;
    cv.height = H;
    listEl = document.createElement('ul');
    listEl.id = 'snailList';
    listEl.className = 'snail__list';
    hint = document.createElement('p');
    hint.className = 'snail__hint';
    hint.textContent = keyName('w') + '  ' + keyName('s') + '  ' + keyName('z');
    root.appendChild(cv);
    root.appendChild(listEl);
    root.appendChild(hint);
    document.body.appendChild(root);
    g = cv.getContext('2d');
    off = function () { removeEventListener('keydown', onKey); };
    addEventListener('keydown', onKey);
    if (NEU.kernel && NEU.kernel.current() !== 'snail') NEU.kernel.push('snail');
    draw();
  }
  function onKey(e) {
    var k, list;
    if (!live || e.type !== 'keydown' || phase !== 'menu') return;
    if (NEU.tboxOpen && NEU.tboxOpen()) return;
    k = routeKey(e);
    list = unlocked();
    if (k === 'w' || k === 'ArrowUp') { if (sel > 0) sel -= 1; }
    else if (k === 's' || k === 'ArrowDown') { if (sel < list.length - 1) sel += 1; }
    else if ((k === 'z' || k === 'Enter' || k === ' ') && !e.repeat) {
      if (!list.length) { draw(); return; }
      if (from && list[sel].id === from.id) {
        if (NEU.talk) NEU.talk(['* you are already here.'], 'narr');
        draw();
        return;
      }
      beginRide(list[sel]);
      return;
    } else if (k === 'x' || k === 'Escape') { close(); return; }
    else return;
    draw();
  }

  NEU.snail = {
    open: open, close: close, arrive: arrive, step: step,
    get state() { return live ? snapshot() : null; }
  };
  if (NEU.kernel) NEU.kernel.register('snail', {
    tick: step, open: open, close: close,
    running: function () { return live; }
  });
})();
