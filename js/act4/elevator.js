/* elevator.js — dusty cabin after the mine. Buttons 0 and ?.
   Kernel scene "elevator". One 60 Hz frame per step. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var STEP = 1 / 60;
  var W = 480, H = 270;
  var overlay, canvas, ctx, screen, live, reduced;
  var phase, y, yFrom, t, door, light, lightT, gear, piston, mountain, sent;
  var sirenOn, dust, actx, sirenOsc, sirenGain;

  function motion() {
    reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function reset() {
    phase = 'cabin'; y = 0; yFrom = 0; t = 0; door = 0; gear = 0; piston = 0;
    light = false; lightT = 0; mountain = false; sent = false; sirenOn = false;
    dust = [];
    stopSiren();
    if (screen) screen.textContent = '';
  }
  function ensure() {
    var pad, b0, bq;
    overlay = document.getElementById('elevator');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'elevator';
      overlay.className = 'elv';
      overlay.hidden = true;
      canvas = document.createElement('canvas');
      canvas.id = 'elvCanvas';
      canvas.width = W;
      canvas.height = H;
      screen = document.createElement('p');
      screen.id = 'elvScreen';
      screen.className = 'elv__screen';
      pad = document.createElement('div');
      pad.className = 'elv__pad';
      b0 = document.createElement('button');
      b0.type = 'button';
      b0.id = 'elv0';
      b0.textContent = '0';
      bq = document.createElement('button');
      bq.type = 'button';
      bq.id = 'elvQ';
      bq.textContent = '?';
      pad.appendChild(b0);
      pad.appendChild(bq);
      overlay.appendChild(canvas);
      overlay.appendChild(screen);
      overlay.appendChild(pad);
      document.body.appendChild(overlay);
      b0.addEventListener('click', function () { press('0'); });
      bq.addEventListener('click', function () { press('?'); });
    }
    canvas = document.getElementById('elvCanvas');
    screen = document.getElementById('elvScreen');
    ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    if (ctx) ctx.imageSmoothingEnabled = false;
  }
  function audio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!actx) {
      try { actx = new AC(); } catch (e) { return null; }
    }
    if (actx.state === 'suspended' && actx.resume) actx.resume();
    return actx;
  }
  function buzz(freq, type, dur, hold) {
    var a = audio(), o, g, t0;
    if (!a) return null;
    o = a.createOscillator();
    g = a.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = 0.06;
    o.connect(g);
    g.connect(a.destination);
    t0 = a.currentTime || 0;
    o.start(t0);
    if (!hold) o.stop(t0 + dur);
    return { o: o, g: g };
  }
  function grind() { buzz(55, 'sawtooth', 0.35, false); }
  function startSiren() {
    var node;
    if (sirenOsc) { sirenOn = true; return; }
    node = buzz(740, 'square', 0, true);
    if (!node) return;
    sirenOsc = node.o;
    sirenGain = node.g;
    sirenGain.gain.value = 0.06;
    sirenOn = true;
  }
  function stopSiren() {
    sirenOn = false;
    if (!sirenOsc) return;
    try { sirenOsc.stop(actx && actx.currentTime ? actx.currentTime : 0); } catch (e) {}
    sirenOsc = null;
    sirenGain = null;
  }
  function pulse() {
    if (sirenGain) sirenGain.gain.value = light ? 0.06 : 0;
  }
  function press(which) {
    if (!live || sent) return;
    if (which === '0') {
      if (phase !== 'cabin' && phase !== 'floor') return;
      phase = 'floor';
      if (screen) screen.textContent = 'YOU ARE ON FLOOR 0';
      if (NEU.save) NEU.save.flag('elevator_floor', 1);
      if (NEU.talk) NEU.talk(['* YOU ARE ON FLOOR 0.'], 'narr');
      draw();
      return;
    }
    if (which !== '?' || phase === 'drop' || phase === 'rise' || phase === 'doors' || phase === 'vista') return;
    phase = 'drop';
    t = 0;
    yFrom = y;
    light = true;
    lightT = 0;
    grind();
    startSiren();
    if (!reduced && NEU.juice && NEU.juice.hit) NEU.juice.hit('large', { dy: 1, colour: '#ff2040' });
    draw();
  }
  function finish() {
    var opened = false;
    if (sent) return;
    sent = true;
    phase = 'vista';
    door = 1;
    piston = 1;
    mountain = true;
    stopSiren();
    if (NEU.save) NEU.save.flag('elevator_out', 1);
    if (NEU.plat && typeof NEU.plat.open === 'function') opened = NEU.plat.open('m0') === true;
    if (!opened) return;
    live = false;
    if (overlay) overlay.hidden = true;
    if (NEU.activeMinigame === 'elevator') NEU.activeMinigame = null;
    if (document.body && !(NEU.cart && NEU.cart.running)) document.body.classList.remove('is-playing');
    if (NEU.kernel && NEU.kernel.stack) {
      var i = NEU.kernel.stack.indexOf('elevator');
      if (i >= 0) NEU.kernel.stack.splice(i, 1);
    }
    if (NEU.cart && NEU.cart.close) NEU.cart.close();
  }
  function band(col, y0, h) {
    ctx.fillStyle = col;
    ctx.fillRect(0, y0, W, h);
  }
  function drawMountain() {
    band('#1a2744', 0, 68);
    band('#2c4a72', 68, 68);
    band('#4e82b0', 136, 68);
    band('#8ec4dc', 204, 66);
    ctx.fillStyle = '#243024';
    ctx.fillRect(0, 210, W, 60);
    ctx.fillStyle = '#3c4e34';
    ctx.fillRect(20, 168, 100, 70);
    ctx.fillRect(150, 140, 150, 98);
    ctx.fillRect(330, 176, 120, 62);
    ctx.fillStyle = '#d8e4ea';
    ctx.fillRect(186, 140, 28, 8);
    ctx.fillRect(360, 176, 20, 6);
  }
  function drawGear(x, y0) {
    var n = gear % 4;
    ctx.fillStyle = '#5a4630';
    ctx.fillRect(x, y0, 24, 24);
    ctx.fillStyle = '#e0b060';
    ctx.fillRect(x + 10, y0 - 6 + n * 2, 4, 36);
    ctx.fillRect(x - 6 + n * 2, y0 + 10, 36, 4);
  }
  function drawDoors() {
    var span = ((1 - door) * (W / 2)) | 0;
    var ext = (piston * 48) | 0;
    var i, p;
    if (span < 0) span = 0;
    drawMountain();
    ctx.fillStyle = '#9aa3ad';
    ctx.fillRect(0, 0, span, H);
    ctx.fillRect(W - span, 0, span, H);
    ctx.fillStyle = '#d5dde4';
    if (span > 4) {
      ctx.fillRect(span - 4, 0, 4, H);
      ctx.fillRect(W - span, 0, 4, H);
    }
    ctx.fillStyle = '#c8b49a';
    for (i = 0; i < dust.length; i++) {
      p = dust[i];
      ctx.fillRect(p.x | 0, p.y | 0, 2, 2);
    }
    if (span > 36) {
      drawGear(28, 48);
      drawGear(W - 64, 48);
    }
    ctx.fillStyle = '#6e7680';
    ctx.fillRect(8, 150, 14, 28 + ext);
    ctx.fillRect(W - 22, 150, 14, 28 + ext);
    ctx.fillStyle = '#d7c07a';
    ctx.fillRect(10, 154, 10, 16 + ext);
    ctx.fillRect(W - 20, 154, 10, 16 + ext);
  }
  function drawCabin() {
    var i, p, bob = reduced ? 0 : (y | 0);
    ctx.fillStyle = '#1a140e';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#3a3228';
    ctx.fillRect(0, 0, W, 24);
    ctx.fillRect(0, H - 28, W, 28);
    ctx.fillStyle = '#2a241c';
    ctx.fillRect(16, 40 + bob, W - 32, 180);
    ctx.fillStyle = '#6a5a44';
    ctx.fillRect(16, 40 + bob, W - 32, 6);
    ctx.fillRect(16, 214 + bob, W - 32, 6);
    ctx.fillStyle = '#c8b49a';
    for (i = 0; i < dust.length; i++) {
      p = dust[i];
      ctx.fillRect(p.x | 0, (p.y + bob) | 0, 2, 2);
    }
    if (dust.length < 12) {
      ctx.fillStyle = '#8a7860';
      ctx.fillRect(40 + (dust.length * 18) % 200, 80, 2, 2);
    }
  }
  function draw() {
    var shook;
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    shook = NEU.juice && NEU.juice.begin ? NEU.juice.begin(ctx, W, H) : false;
    if (phase === 'doors' || phase === 'vista') drawDoors();
    else drawCabin();
    if (light && (phase === 'drop' || phase === 'rise' || phase === 'doors')) {
      ctx.fillStyle = '#e01030';
      ctx.fillRect(20, 28, 16, 16);
      ctx.fillRect(W - 36, 28, 16, 16);
    }
    if (NEU.juice && NEU.juice.drawParts) NEU.juice.drawParts(ctx, STEP);
    if (NEU.juice && NEU.juice.end) NEU.juice.end(ctx, shook);
    if (NEU.juice && NEU.juice.overlay) NEU.juice.overlay(ctx, W, H);
    if (screen && phase === 'floor' && !screen.textContent) screen.textContent = 'YOU ARE ON FLOOR 0';
  }
  function getState() {
    if (!live) return null;
    return {
      phase: phase, y: y, door: door, light: light, siren: sirenOn,
      dust: dust.length, gear: gear, piston: piston, mountain: mountain
    };
  }
  function step(dt, key) {
    var span, raw, u, period;
    if (!live) return null;
    if (key === '0' || key === '?') press(key);
    if (!live) return null;
    if (dt > 0.05) dt = 0.05;
    if (phase === 'drop' || phase === 'rise' || phase === 'doors') {
      t += dt;
      lightT += dt;
      period = reduced ? 0.7 : 0.4;
      if (lightT >= period) {
        lightT -= period;
        light = !light;
        pulse();
      }
    }
    if (phase === 'drop') {
      span = reduced ? 0.2 : 0.8;
      raw = t / span;
      if (raw > 1) raw = 1;
      y = yFrom + 64 * raw;
      if (t >= span) { phase = 'rise'; t = 0; yFrom = y; }
    } else if (phase === 'rise') {
      span = reduced ? 0.35 : 1.6;
      raw = t / span;
      if (raw > 1) raw = 1;
      u = raw * raw * (3 - 2 * raw);
      y = yFrom + (-96 - yFrom) * u;
      if (t >= span) { phase = 'doors'; t = 0; mountain = true; }
    } else if (phase === 'doors') {
      span = reduced ? 0.4 : 2.8;
      raw = t / span;
      if (raw > 1) raw = 1;
      door = raw;
      piston = raw;
      gear += 1;
      if (dust.length < 36) dust.push({ x: (dust.length * 23 + 40) % W, y: (dust.length * 17 + 24) % (H - 8) });
      if (t >= span) finish();
    } else if (dust.length < 8 && phase !== 'vista') {
      dust.push({ x: (dust.length * 37 + 24) % W, y: 60 + (dust.length * 19) % 140 });
    }
    draw();
    return getState();
  }
  function tick(dtMs) {
    var acc = tick.acc || 0, n = 0;
    if (!live) return;
    if (NEU.juice && NEU.juice.frozen && NEU.juice.frozen()) { draw(); return; }
    acc += Math.min(0.25, Math.max(0, dtMs) / 1000);
    while (acc >= STEP && n < 8) { step(STEP); acc -= STEP; n++; }
    tick.acc = acc;
  }
  function open() {
    ensure();
    if (live) close();
    motion();
    reset();
    live = true;
    overlay.hidden = false;
    if (NEU.keys && NEU.keys.refresh) NEU.keys.refresh();
    NEU.activeMinigame = 'elevator';
    document.body.classList.add('is-playing');
    if (NEU.kernel) NEU.kernel.push('elevator');
    draw();
    return true;
  }
  function close() {
    if (!live && (!overlay || overlay.hidden)) return;
    live = false;
    stopSiren();
    if (overlay) overlay.hidden = true;
    if (NEU.activeMinigame === 'elevator') NEU.activeMinigame = null;
    if (document.body) document.body.classList.remove('is-playing');
    if (NEU.kernel && NEU.kernel.current() === 'elevator') NEU.kernel.pop();
  }
  function onKey(e) {
    var routed, k;
    if (!live || e.repeat || e.type !== 'keydown') return;
    routed = (NEU.keys && NEU.keys.route) ? NEU.keys.route(e.key, {}) : { to: e.key, swallow: false };
    if (routed.swallow) return;
    k = routed.to;
    if (k === '0' || k === 'Digit0') { press('0'); e.preventDefault(); }
    else if (k === '?' || k === '/') { press('?'); e.preventDefault(); }
    else if (k === 'Escape') close();
  }
  window.addEventListener('keydown', onKey);

  NEU.elevator = {
    open: open, close: close, step: step,
    get state() { return getState(); },
    get running() { return live; }
  };
  if (NEU.kernel) NEU.kernel.register('elevator', {
    tick: tick, open: open, close: close,
    running: function () { return live; }
  });
})();
