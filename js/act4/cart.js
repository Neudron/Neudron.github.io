/* cart.js — the mine ride after the painting. Four rails, oncoming
   carts, gaps you jump. Kernel scene "cart". One 60 Hz frame per step. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var STEP = 1 / 60, RIDE = 4500, MID = 2250, HOLE = 48, HIT = 18, TELE = 30, AIR = 36;
  var EV = [], CLEAR, overlay, canvas, ctx;
  var live = false, reduced = false;
  var frames, lane, jumpN, dead, done, phase, holeN, checkpoint, cpLane, sparks, dust, held, sent;

  (function () {
    var f = 180, n = 0, cartLane = 1;
    while (f < 4380) {
      if (n % 3 === 2) EV.push({ f: f, kind: 'gap' });
      else {
        EV.push({ f: f, kind: 'cart', lane: cartLane % 4 });
        cartLane++;
      }
      f += 186;
      n++;
    }
  })();

  function buildClear() {
    var rec = [], cursor = 0, here = 1, i, ev, dir;
    function emit(at, key) {
      var gap = (at - 1) - cursor;
      if (gap > 0) rec.push([gap, '']);
      rec.push([1, key]);
      cursor = at;
    }
    for (i = 0; i < EV.length; i++) {
      ev = EV[i];
      if (ev.kind === 'cart' && ev.lane === here) {
        dir = here < 3 ? 'down' : 'up';
        emit(ev.f - TELE, dir);
        here += dir === 'down' ? 1 : -1;
      } else if (ev.kind === 'gap') emit(ev.f - 10, 'jump');
    }
    if (cursor < RIDE + HOLE) rec.push([RIDE + HOLE - cursor, '']);
    return rec;
  }
  CLEAR = buildClear();

  function motion() {
    reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function reset() {
    frames = 0; lane = 1; jumpN = 0; dead = false; done = false;
    phase = 'ride'; holeN = 0; checkpoint = false; cpLane = 1;
    sparks = 0; dust = []; sent = false;
    held = { up: false, down: false, jump: false };
  }
  function ensure() {
    overlay = document.getElementById('cart');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'cart';
      overlay.className = 'cart';
      overlay.hidden = true;
      canvas = document.createElement('canvas');
      canvas.id = 'cartCanvas';
      canvas.width = 480;
      canvas.height = 270;
      var hint = document.createElement('p');
      hint.className = 'cart__hint';
      hint.innerHTML = 'lanes <span data-k="w,s"></span>  jump <span data-k="z"></span>';
      overlay.appendChild(canvas);
      overlay.appendChild(hint);
      document.body.appendChild(overlay);
    }
    canvas = document.getElementById('cartCanvas');
    ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    if (ctx) ctx.imageSmoothingEnabled = false;
  }
  function keyString() {
    var s = '';
    if (keys.up) s += 'up ';
    if (keys.down) s += 'down ';
    if (keys.jump) s += 'jump ';
    return s;
  }
  function shift(dir) {
    lane += dir;
    sparks++;
    if (NEU.juice) {
      NEU.juice.burst(240, 190, 10, '#ffb040', 160);
      NEU.juice.hit('small', { dx: dir, dy: 0 });
    }
  }
  function die() {
    dead = true;
    jumpN = 0;
    if (NEU.juice) NEU.juice.hit('medium', { dx: 0, dy: 1 });
    if (checkpoint) { frames = MID; lane = cpLane; }
    else { frames = 0; lane = 1; }
  }
  function finish() {
    phase = 'done';
    done = true;
    if (sent) return;
    sent = true;
    if (NEU.save) NEU.save.flag('cart_done', 1);
    if (NEU.elevator && typeof NEU.elevator.open === 'function') NEU.elevator.open();
  }
  function railX(i, y) {
    var u = (y - 28) / 222;
    if (u < 0) u = 0;
    return (240 + ((48 + i * 112) - 240) * u) | 0;
  }
  function draw() {
    var i, y, ev, u, x, py, px, p, shook;
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    shook = NEU.juice && NEU.juice.begin ? NEU.juice.begin(ctx, 480, 270) : false;
    ctx.fillStyle = '#1a120c';
    ctx.fillRect(0, 0, 480, 270);
    ctx.fillStyle = '#2a1c14';
    for (i = 0; i < 8; i++) {
      y = ((i * 36 - (frames * 2) % 36) + 270) % 270;
      ctx.fillRect(0, y | 0, 480, 8);
    }
    ctx.fillStyle = '#3a2818';
    for (i = 0; i < 5; i++) {
      y = ((i * 56 - (frames * 3) % 56) + 270) % 270;
      ctx.fillRect(16, y | 0, 24, 32);
      ctx.fillRect(440, y | 0, 24, 32);
    }
    for (i = 0; i < 4; i++) {
      ctx.fillStyle = i === lane ? '#8a6848' : '#4a3428';
      for (y = 36; y <= 250; y += 8) ctx.fillRect(railX(i, y), y, 4, 6);
    }
    for (i = 0; i < EV.length; i++) {
      ev = EV[i];
      if (ev.kind === 'gap' && frames > ev.f - 40 && frames < ev.f + HIT) {
        ctx.fillStyle = '#0a0604';
        ctx.fillRect(0, 150, 480, 28);
      }
      if (ev.kind !== 'cart' || frames < ev.f - 150 || frames > ev.f + 8) continue;
      u = 1 - (ev.f - frames) / 150;
      if (u < 0) u = 0;
      y = (28 + u * 170) | 0;
      x = railX(ev.lane, y);
      ctx.fillStyle = '#6a5038';
      ctx.fillRect(x - 8, y, 16, 10);
      if (frames >= ev.f - TELE && frames < ev.f) {
        ctx.fillStyle = '#ffe080';
        ctx.fillRect(x - 2, y + 2, 4, 4);
      }
    }
    py = 186 - (jumpN > 0 ? 18 : 0);
    px = railX(lane, 200);
    ctx.fillStyle = '#2a160e';
    ctx.fillRect(px - 16, py + 12, 32, 6);
    ctx.fillStyle = '#c45a28';
    ctx.fillRect(px - 14, py, 28, 14);
    ctx.fillStyle = '#f0d8a8';
    ctx.fillRect(px - 4, py + 2, 6, 4);
    for (i = 0; i < dust.length; i++) {
      p = dust[i];
      ctx.fillStyle = '#8a7058';
      ctx.fillRect(p.x | 0, p.y | 0, 2, 2);
    }
    ctx.beginPath();
    ctx.rect(0, 0, 480, 270);
    ctx.moveTo(px, py);
    ctx.lineTo(px - 78, 16);
    ctx.lineTo(px + 78, 16);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fill('evenodd');
    if (phase === 'hole' || phase === 'done') {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 270 - (phase === 'done' ? 270 : holeN * 8), 480, 270);
    }
    if (NEU.juice && NEU.juice.drawParts) NEU.juice.drawParts(ctx, STEP);
    if (NEU.juice && NEU.juice.end) NEU.juice.end(ctx, shook);
  }
  function getState() {
    var g = [], i;
    for (i = 0; i < EV.length; i++) {
      if (EV[i].kind === 'cart' && frames >= EV[i].f - TELE && frames < EV[i].f) g.push(EV[i].lane);
    }
    return {
      t: frames / 60, frames: frames, lane: lane, jumping: jumpN > 0,
      dead: dead, done: done, phase: phase, checkpoint: checkpoint,
      glints: g, dust: dust.length, sparks: sparks, hole: phase !== 'ride'
    };
  }
  function open() {
    ensure();
    if (live) close();
    motion();
    reset();
    if (NEU.save) NEU.save.flag('cart_mid', null);
    live = true;
    overlay.hidden = false;
    if (NEU.keys && NEU.keys.refresh) NEU.keys.refresh();
    NEU.activeMinigame = 'cart';
    document.body.classList.add('is-playing');
    if (NEU.kernel) NEU.kernel.push('cart');
    draw();
    return true;
  }
  function close() {
    if (!live && (!overlay || overlay.hidden)) return;
    live = false;
    if (overlay) overlay.hidden = true;
    if (NEU.activeMinigame === 'cart') NEU.activeMinigame = null;
    document.body.classList.remove('is-playing');
    if (NEU.kernel && NEU.kernel.current() === 'cart') NEU.kernel.pop();
  }
  function step(dt, input) {
    var up, down, jp, i, ev, p;
    if (!live) return null;
    /* ponytail: one fixed 60 Hz frame; kernel tick slices real time. */
    if (arguments.length < 2) input = keyString();
    dead = false;
    if (phase === 'done') return getState();
    if (phase === 'hole') {
      holeN++;
      if (reduced || holeN >= HOLE) finish();
      draw();
      return getState();
    }
    frames++;
    up = input.indexOf('up') >= 0;
    down = input.indexOf('down') >= 0;
    jp = input.indexOf('jump') >= 0;
    if (up && !held.up && lane > 0) shift(-1);
    if (down && !held.down && lane < 3) shift(1);
    if (jp && !held.jump && jumpN <= 0) jumpN = AIR;
    held.up = up; held.down = down; held.jump = jp;
    if (jumpN > 0) jumpN--;
    if (frames % 8 === 0) {
      if (dust.length > 40) dust.shift();
      dust.push({ x: (frames * 17) % 480, y: 48 + (frames * 13) % 160, life: 36 });
    }
    for (i = dust.length - 1; i >= 0; i--) {
      p = dust[i];
      p.y += 3; p.life--;
      if (p.life <= 0) dust.splice(i, 1);
    }
    for (i = 0; i < EV.length; i++) {
      ev = EV[i];
      if (frames < ev.f || frames >= ev.f + HIT) continue;
      if (ev.kind === 'cart' && ev.lane === lane) { die(); break; }
      if (ev.kind === 'gap' && jumpN <= 0) { die(); break; }
    }
    if (!dead && !checkpoint && frames >= MID) {
      checkpoint = true;
      cpLane = lane;
      if (NEU.save) NEU.save.flag('cart_mid', { t: 37.5, lane: lane });
    }
    if (!dead && frames >= RIDE) {
      phase = 'hole';
      holeN = 0;
      if (reduced) finish();
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
  function replay(recording) {
    var old = NEU.kernel ? NEU.kernel.stack.slice() : null;
    var i, j, pair, st, framesN = 0, deaths = 0, was = false, stop = false, cleared;
    open();
    for (i = 0; i < recording.length && !stop; i++) {
      pair = recording[i];
      for (j = 0; j < pair[0] && !stop; j++) {
        st = step(STEP, pair[1]);
        framesN++;
        if (st.dead && !was) deaths++;
        was = st.dead;
        if (st.done) stop = true;
      }
    }
    cleared = !!(st && st.done);
    close();
    if (old && NEU.kernel) {
      NEU.kernel.stack.length = 0;
      for (i = 0; i < old.length; i++) NEU.kernel.stack.push(old[i]);
    }
    return { cleared: cleared, deaths: deaths, frames: framesN };
  }
  var keys = { up: false, down: false, jump: false };
  function onKey(e) {
    var routed, k, down;
    if (!live) return;
    routed = (NEU.keys && NEU.keys.route) ? NEU.keys.route(e.key, {}) : { to: e.key, swallow: false };
    if (routed.swallow) return;
    k = routed.to;
    down = e.type === 'keydown';
    if (k === 'ArrowUp' || k === 'w' || k === 'W') { keys.up = down; e.preventDefault(); }
    else if (k === 'ArrowDown' || k === 's' || k === 'S') { keys.down = down; e.preventDefault(); }
    else if (k === 'z' || k === 'Z' || k === ' ' || k === 'Spacebar') { keys.jump = down; e.preventDefault(); }
    else if (down && k === 'Escape') close();
  }
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  NEU.cart = {
    open: open, close: close, step: step, replay: replay,
    get state() { return live ? getState() : null; },
    get running() { return live; },
    events: EV,
    CLEAR: CLEAR
  };
  if (NEU.kernel) NEU.kernel.register('cart', {
    tick: tick, open: open, close: close,
    running: function () { return live; }
  });
})();
