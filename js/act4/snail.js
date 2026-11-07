/* snail.js — the underground station. A menu of stops the save has
   already marked, then one full-screen ride on the kernel clock.
   The shell wobbles under 3 Hz. Reduced motion is a slow pan. */
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
  var FAST = 2.8, SLOW = 0.16, WOB = 17;

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
  function band(col, y, shift) {
    var o = ((shift % W) + W) % W;
    g.fillStyle = col;
    g.fillRect(Math.round(-o), y, W, 16);
    g.fillRect(Math.round(W - o), y, W, 16);
  }
  function draw() {
    var rm, i, x, y;
    fillList();
    if (!g) return;
    g.imageSmoothingEnabled = false;
    rm = reduced();
    g.fillStyle = '#1A120C';
    g.fillRect(0, 0, W, H);
    band('#3A2414', 28, layers[0]);
    band('#6A4020', 64, layers[1]);
    band('#C47A32', 100, layers[2]);
    if (!rm && phase === 'ride') {
      g.fillStyle = '#F0D48A';
      for (i = 0; i < lines.length; i++) {
        x = Math.round(lines[i].x);
        y = Math.round(lines[i].y);
        g.fillRect(x, y, lines[i].w, 2);
      }
    }
    shellX = (rm || phase !== 'ride') ? 0 : Math.round(Math.sin(wob) * 6);
    g.fillStyle = '#C4A15A';
    g.fillRect(140, 110, 28, 16);
    g.fillStyle = '#8A5A28';
    g.fillRect(148 + shellX, 92, 24, 20);
    g.fillStyle = '#3A2410';
    g.fillRect(156 + shellX, 100, 8, 8);
    g.fillStyle = '#F0D48A';
    g.fillRect(164, 108, 4, 8);
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
    if (phase === 'ride') {
      prog += t * (reduced() ? SLOW : FAST);
      if (reduced()) {
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
