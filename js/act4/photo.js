/* photo.js — the photograph from the desk compartment.
   Kernel scene "photo". Five places, one crossed out in red.
   The cross changes on every open and on visibilitychange. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var W = 320, H = 180, RED = '#B01018', SKY = '#1A2840', GROUND = '#3A2E24';
  var PLACES = [
    { id: 'woods', name: 'the woods', col: '#2E6A34' },
    { id: 'city', name: 'the city', col: '#4A5A78' },
    { id: 'castle', name: 'the castle', col: '#6A5A68' },
    { id: 'savanna', name: 'the savanna village', col: '#C4A04A' },
    { id: 'house', name: 'the mechanical house', col: '#6A7A88' }
  ];
  var SHUT = ['the desk is shut.', 'the seam does not move.'];
  var HINTS = [
    'the seam gives. a photograph was shut inside.',
    'woods, a city, a castle, a savanna village, a mechanical house.',
    'one of them is crossed out. the red is the same red as the cracks.',
    'the painter left red in the grain. the figure kept a fire.',
    'dad kept the door. none of them say who crossed the name out.'
  ];
  var overlay, canvas, ctx, mark, live = false, reduced = false;
  var crossed = 0, drift = 0, look = 0;

  function motion() {
    reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function panels() {
    var out = [], i, p;
    for (i = 0; i < PLACES.length; i++) {
      p = PLACES[i];
      out.push({ id: p.id, name: p.name, col: p.col, x: 8 + i * 62, y: 48, w: 56, h: 72 });
    }
    return out;
  }
  function names() {
    var out = [], i;
    for (i = 0; i < PLACES.length; i++) out.push(PLACES[i].name);
    return out;
  }
  function offsets() {
    var d = reduced ? 0 : drift;
    return { far: Math.round(d * 0.25 + look * 0.25), near: Math.round(d + look) };
  }
  function state() {
    var off = offsets();
    return {
      open: live, places: names(), panels: panels(), crossed: PLACES[crossed].name,
      lines: HINTS.slice(), drift: reduced ? 0 : drift, far: off.far, near: off.near,
      sky: SKY, ground: GROUND, red: RED
    };
  }
  function showMark() {
    var name = PLACES[crossed].name;
    if (overlay) overlay.setAttribute('data-crossed', name);
    if (mark) mark.textContent = name;
  }
  function roll() {
    var n = (Math.random() * PLACES.length) | 0;
    if (n === crossed) n = (n + 1) % PLACES.length;
    crossed = n;
    showMark();
  }
  function ensure() {
    var closeK;
    overlay = document.getElementById('photo');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'photo';
      overlay.className = 'photo';
      overlay.hidden = true;
      overlay.style.position = 'fixed';
      overlay.style.left = '50%';
      overlay.style.top = '50%';
      overlay.style.transform = 'translate(-50%, -50%)';
      overlay.style.zIndex = '78';
      canvas = document.createElement('canvas');
      canvas.id = 'photoCanvas';
      canvas.width = W;
      canvas.height = H;
      mark = document.createElement('p');
      mark.id = 'photoMark';
      mark.className = 'photo__mark';
      closeK = document.createElement('p');
      closeK.className = 'photo__hint';
      closeK.appendChild(document.createTextNode('close '));
      var span = document.createElement('span');
      span.setAttribute('data-k', 'x');
      closeK.appendChild(span);
      overlay.appendChild(canvas);
      overlay.appendChild(mark);
      overlay.appendChild(closeK);
      document.body.appendChild(overlay);
    }
    canvas = document.getElementById('photoCanvas');
    mark = document.getElementById('photoMark');
    ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    if (ctx) ctx.imageSmoothingEnabled = false;
    if (NEU.keys && NEU.keys.refresh) NEU.keys.refresh();
  }
  function rect(x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
  }
  function cross(x, y) {
    var i;
    for (i = 0; i < 8; i++) {
      rect(x + 8 + i * 4, y + 12 + i * 4, 4, 4, RED);
      rect(x + 8 + (7 - i) * 4, y + 12 + i * 4, 4, 4, RED);
    }
  }
  function detail(p) {
    var x = p.x, y = p.y;
    if (p.id === 'woods') { rect(x + 8, y + 28, 8, 28, '#1A3A1C'); rect(x + 24, y + 20, 8, 36, '#143016'); rect(x + 40, y + 32, 6, 24, '#1A3A1C'); }
    else if (p.id === 'city') { rect(x + 6, y + 24, 10, 40, '#2A3448'); rect(x + 20, y + 12, 12, 52, '#222A3A'); rect(x + 36, y + 30, 12, 34, '#2A3448'); }
    else if (p.id === 'castle') { rect(x + 8, y + 36, 40, 28, '#4A3A48'); rect(x + 16, y + 16, 12, 24, '#3A2A38'); rect(x + 32, y + 20, 8, 20, '#3A2A38'); }
    else if (p.id === 'savanna') { rect(x + 4, y + 40, 48, 16, '#A07830'); rect(x + 10, y + 28, 16, 12, '#8A5A38'); rect(x + 30, y + 22, 4, 22, '#6A4A28'); }
    else if (p.id === 'house') { rect(x + 10, y + 24, 36, 36, '#4A5A68'); rect(x + 16, y + 12, 24, 12, '#3A4A58'); rect(x + 22, y + 36, 8, 8, '#C8D0D8'); }
    else { rect(x, y, p.w, p.h, '#FF00FF'); }
  }
  function draw() {
    var list, off, i, p;
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    rect(0, 0, W, H, '#12161E');
    off = offsets();
    rect(4 + off.far, 16, 48, 8, SKY);
    rect(4 + off.near, 150, 48, 8, GROUND);
    list = panels();
    for (i = 0; i < list.length; i++) {
      p = list[i];
      rect(p.x, p.y, p.w, p.h, p.col);
      detail(p);
      if (i === crossed) cross(p.x, p.y);
    }
    showMark();
  }
  function drawPlace(id) {
    var i, p = null;
    ensure();
    if (!ctx) return;
    for (i = 0; i < PLACES.length; i++) if (PLACES[i].id === id) p = PLACES[i];
    if (!p) rect(0, 0, 16, 16, '#FF00FF');
    else rect(0, 0, 16, 16, p.col);
  }
  function advance(dt) {
    if (reduced || !(dt > 0)) return;
    drift += dt * 8;
    if (drift > 16) drift -= 16;
  }
  function speak(lines) {
    if (NEU.talk) NEU.talk(lines, 'narr');
  }
  function reveal() {
    var where;
    if (!NEU.save || !NEU.save.flagged('dad_note')) return;
    if (NEU.note && NEU.note.running) return;
    if (NEU.save.flagged('dad_compartment')) return;
    where = NEU.engine && NEU.engine.where && NEU.engine.where();
    if (where && where.room !== 'e5_dad') return;
    NEU.save.flag('dad_compartment', 1);
    if (NEU.lookCity && NEU.lookCity._cache) delete NEU.lookCity._cache['prop:dadseam'];
    if (NEU.juice && NEU.juice.burst && !NEU.juice.reduced) NEU.juice.burst(96, 40, 6, '#E4D8C0');
  }
  function open() {
    ensure();
    if (live) return true;
    motion();
    live = true;
    look = 0;
    roll();
    if (overlay) overlay.hidden = false;
    NEU.activeMinigame = 'photo';
    if (NEU.kernel) NEU.kernel.push('photo');
    if (NEU.juice && !NEU.juice.reduced) {
      if (NEU.juice.hit) NEU.juice.hit('small');
      if (NEU.juice.burst) NEU.juice.burst(W / 2, 40, 8, '#E4D8C0');
    }
    draw();
    return true;
  }
  function close() {
    if (!live && (!overlay || overlay.hidden)) return;
    live = false;
    look = 0;
    if (overlay) overlay.hidden = true;
    if (NEU.activeMinigame === 'photo') NEU.activeMinigame = null;
    if (NEU.kernel && NEU.kernel.current() === 'photo') NEU.kernel.pop();
  }
  function take() {
    if (!NEU.save || !NEU.save.flagged('dad_note')) {
      speak(SHUT);
      return false;
    }
    reveal();
    if (!NEU.save.has('photo')) {
      NEU.save.give('photo');
      if (NEU.quest && NEU.quest.garage) NEU.quest.add(NEU.quest.garage, 'IV the woods');
      speak(HINTS);
    }
    open();
    return true;
  }
  function tick(dtMs) {
    if (!live) return;
    advance((dtMs || 0) / 1000);
    draw();
  }
  function step(dt, key) {
    if (!live) return state();
    if (key === 'close') { close(); return state(); }
    if (key === 'left') look -= 4;
    else if (key === 'right') look += 4;
    if (look < -16) look = -16;
    if (look > 16) look = 16;
    advance(dt || 0);
    draw();
    return state();
  }
  function onKey(e) {
    var routed, k;
    if (e.type !== 'keydown' || e.repeat) return;
    reveal();
    if (!live) return;
    routed = (NEU.keys && NEU.keys.route) ? NEU.keys.route(e.key, {}) : { to: e.key, swallow: false };
    if (routed.swallow) return;
    k = routed.to;
    if (k === 'Escape' || k === 'x' || k === 'X') {
      close();
      if (e.preventDefault) e.preventDefault();
    } else if (k === 'a' || k === 'A' || k === 'ArrowLeft') {
      look -= 4;
      if (look < -16) look = -16;
      draw();
    } else if (k === 'd' || k === 'D' || k === 'ArrowRight') {
      look += 4;
      if (look > 16) look = 16;
      draw();
    }
  }
  function hookNote() {
    var orig;
    if (!NEU.note || !NEU.note.close || NEU.note.__seam) return;
    orig = NEU.note.close;
    NEU.note.close = function () {
      orig();
      reveal();
    };
    NEU.note.__seam = 1;
    if (NEU.kernel && NEU.kernel.scenes && NEU.kernel.scenes.note) NEU.kernel.scenes.note.close = NEU.note.close;
  }
  window.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', function () {
    roll();
    if (live) draw();
  });
  hookNote();

  NEU.photo = {
    open: open, close: close, take: take, step: step, drawPlace: drawPlace,
    get state() { return state(); },
    get running() { return live; }
  };
  if (NEU.kernel) NEU.kernel.register('photo', {
    tick: tick, open: open, close: close,
    running: function () { return live; }
  });
})();
