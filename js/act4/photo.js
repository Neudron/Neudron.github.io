/* photo.js — the photograph from the desk compartment.
   Kernel scene "photo". Five places, one crossed out in red.
   The cross changes on every open and on visibilitychange. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var W = 320, H = 180, RED = '#B01018', RED_HI = '#E04A4A';
  var PLACES = [
    { id: 'woods', name: 'the woods', col: '#1E4A2A' },
    { id: 'city', name: 'the city', col: '#34425E' },
    { id: 'castle', name: 'the castle', col: '#5A4A58' },
    { id: 'savanna', name: 'the savanna village', col: '#B08A38' },
    { id: 'house', name: 'the mechanical house', col: '#566470' }
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
  var crossed = 0, drift = 0, look = 0, tick = 0;
  var art = null;

  function motion() {
    reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function panels() {
    var out = [], i, p, tilts = [-1, 1, 0, -1, 1];
    for (i = 0; i < PLACES.length; i++) {
      p = PLACES[i];
      out.push({ id: p.id, name: p.name, col: p.col, x: 4 + i * 63, y: 52 + tilts[i] * 2, w: 60, h: 76 });
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
      sky: '#1A2840', ground: '#3A2E24', red: RED
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
  function rr(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function hs(x, y, s) {
    var h = (x * 374761393 + y * 668265263 + (s || 0) * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
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
  function fitScale() {
    if (!canvas) return;
    var vw = (window.innerWidth || 320) - 32;
    var vh = (window.innerHeight || 180) - 96;
    var k = Math.floor(Math.min(vw / W, vh / H));
    if (k < 1) k = 1;
    canvas.style.width = (W * k) + 'px';
    canvas.style.height = (H * k) + 'px';
  }
  function boardLayer(g) {
    var i, x, y;
    /* cork */
    rr(g, 0, 0, W, H, '#8A6A40');
    for (i = 0; i < 3500; i++) {
      x = ((hs(i, 1, 1) * W) | 0);
      y = ((hs(i, 2, 1) * H) | 0);
      if (hs(i, 3, 1) < 0.06) rr(g, x, y, 1, 1, hs(i, 4, 1) < 0.5 ? '#A0804C' : '#B89060');
    }
    /* frame */
    rr(g, 0, 0, W, 4, '#3A2414'); rr(g, 0, H - 4, W, 4, '#3A2414');
    rr(g, 0, 0, 4, H, '#3A2414'); rr(g, W - 4, 0, 4, H, '#3A2414');
    rr(g, 0, 0, W, 1, '#5A3418'); rr(g, 0, 0, 1, H, '#5A3418');
    rr(g, 0, H - 1, W, 1, '#2A1810'); rr(g, W - 1, 0, 1, H, '#2A1810');
    /* masking tape header */
    rr(g, 120, 6, 80, 18, '#E8DCC0');
    rr(g, 120, 6, 80, 1, '#F4ECD8'); rr(g, 120, 23, 80, 1, '#C8B898');
    rr(g, 118, 8, 2, 14, '#DCCDAE'); rr(g, 200, 8, 2, 14, '#DCCDAE');
    g.fillStyle = '#2A2A3A';
    g.font = '16px "Determination Mono"';
    g.fillText('PLACES', 133, 19);
  }
  function photoWoods(g, x, y) {
    rr(g, x, y, 56, 56, '#0E1630');
    rr(g, x, y + 38, 56, 18, '#16302A');
    rr(g, x + 8, y + 18, 8, 22, '#0E1A1C'); rr(g, x + 5, y + 22, 14, 4, '#16302A'); rr(g, x + 7, y + 18, 10, 4, '#16302A');
    rr(g, x + 24, y + 14, 8, 26, '#0E1A1C'); rr(g, x + 21, y + 18, 14, 5, '#16302A'); rr(g, x + 23, y + 14, 10, 4, '#16302A');
    rr(g, x + 40, y + 20, 8, 20, '#0E1A1C'); rr(g, x + 38, y + 24, 12, 4, '#16302A');
    rr(g, x + 42, y + 6, 4, 4, '#E6EEF2'); rr(g, x + 43, y + 7, 2, 2, '#B8CCD6');
  }
  function photoCity(g, x, y) {
    rr(g, x, y, 56, 56, '#1A2848');
    rr(g, x, y + 44, 56, 12, '#2A2622');
    rr(g, x + 4, y + 20, 12, 24, '#2A3448'); rr(g, x + 18, y + 12, 14, 32, '#222A3A'); rr(g, x + 36, y + 24, 14, 20, '#2A3448');
    rr(g, x + 6, y + 24, 2, 2, '#E8C878'); rr(g, x + 10, y + 28, 2, 2, '#E8C878'); rr(g, x + 6, y + 34, 2, 2, '#E8C878');
    rr(g, x + 22, y + 16, 2, 2, '#E8C878'); rr(g, x + 26, y + 22, 2, 2, '#E8C878'); rr(g, x + 22, y + 30, 2, 2, '#E8C878'); rr(g, x + 26, y + 36, 2, 2, '#E8C878');
    rr(g, x + 40, y + 28, 2, 2, '#E8C878'); rr(g, x + 44, y + 34, 2, 2, '#E8C878');
    rr(g, x + 12, y + 8, 1, 4, '#4A5A78'); rr(g, x + 30, y + 14, 1, 3, '#4A5A78'); rr(g, x + 48, y + 6, 1, 4, '#4A5A78');
  }
  function photoDungeon(g, x, y) {
    rr(g, x, y, 56, 56, '#1C1814');
    rr(g, x, y + 40, 56, 16, '#2A2622');
    rr(g, x + 8, y + 8, 40, 32, '#120E14');
    rr(g, x + 10, y + 10, 36, 30, '#3A342C');
    rr(g, x + 20, y + 22, 16, 18, '#120E14');
    rr(g, x + 22, y + 20, 12, 2, '#120E14'); rr(g, x + 24, y + 18, 8, 2, '#120E14');
    rr(g, x + 14, y + 30, 4, 10, '#5A3418'); rr(g, x + 15, y + 26, 2, 4, '#FFB347'); rr(g, x + 15, y + 27, 1, 2, '#FFE080');
  }
  function photoSavanna(g, x, y) {
    rr(g, x, y, 56, 56, '#87CEEB');
    rr(g, x, y + 36, 56, 20, '#C4A04A');
    rr(g, x, y + 48, 56, 8, '#A07830');
    rr(g, x + 40, y + 8, 8, 6, '#FFD700'); rr(g, x + 42, y + 6, 4, 2, '#FFD700'); rr(g, x + 42, y + 14, 4, 2, '#FFD700');
    rr(g, x + 16, y + 18, 4, 22, '#6A4A28');
    rr(g, x + 6, y + 14, 24, 6, '#2E6A34'); rr(g, x + 10, y + 10, 16, 4, '#2E6A34');
  }
  function photoHouse(g, x, y) {
    rr(g, x, y, 56, 56, '#121820');
    rr(g, x, y + 42, 56, 14, '#1A2230');
    rr(g, x + 10, y + 14, 36, 28, '#3A4A58');
    rr(g, x + 10, y + 14, 36, 2, '#6A7A88'); rr(g, x + 10, y + 14, 2, 28, '#6A7A88');
    rr(g, x + 44, y + 14, 2, 28, '#2A3A48'); rr(g, x + 10, y + 40, 36, 2, '#2A3A48');
    rr(g, x + 22, y + 24, 12, 10, '#101820');
    rr(g, x + 26, y + 27, 4, 4, '#8A0C14'); rr(g, x + 27, y + 28, 2, 2, '#C8202C');
    rr(g, x + 14, y + 18, 4, 2, '#6A7A88'); rr(g, x + 38, y + 18, 4, 2, '#6A7A88');
  }
  function drawPolaroid(g, p, i) {
    var x = p.x, y = p.y, lbl;
    /* drop shadow, then the place colour as a 1px tinted edge, then the card */
    g.globalAlpha = 0.45;
    rr(g, x + 2, y + 2, p.w, p.h, '#000000');
    g.globalAlpha = 1;
    rr(g, x, y, p.w, p.h, p.col);
    rr(g, x + 1, y + 1, p.w - 2, p.h - 2, '#F4F0E6');
    rr(g, x + 1, y + 1, p.w - 2, 1, '#FFFFFF');
    rr(g, x + 1, y + p.h - 2, p.w - 2, 1, '#D8D0C0');
    /* photo window: 56x56, 2px border */
    rr(g, x + 2, y + 2, 56, 56, '#12161E');
    if (p.id === 'woods') photoWoods(g, x + 2, y + 2);
    else if (p.id === 'city') photoCity(g, x + 2, y + 2);
    else if (p.id === 'castle') photoDungeon(g, x + 2, y + 2);
    else if (p.id === 'savanna') photoSavanna(g, x + 2, y + 2);
    else if (p.id === 'house') photoHouse(g, x + 2, y + 2);
    /* the inner edge of the print */
    rr(g, x + 2, y + 57, 56, 1, '#C8C0B0');
    g.fillStyle = '#2A2A3A';
    g.font = '16px "Determination Mono"';
    lbl = p.id === 'savanna' ? 'village' : p.id;
    g.fillText(lbl, x + 2, y + p.h - 6);
    /* pin */
    rr(g, x + (p.w >> 1) - 2, y - 2, 4, 4, '#8A0C14');
    rr(g, x + (p.w >> 1) - 2, y - 2, 2, 2, '#C8202C');
    rr(g, x + (p.w >> 1) - 2, y - 2, 1, 1, '#FF8A8A');
  }
  function cross(g, x, y, wob) {
    var i, wx, wy;
    wob = wob || 0;
    for (i = 0; i < 48; i++) {
      wx = (reduced ? 0 : ((i % 4 === 0) ? wob : 0));
      wy = (reduced ? 0 : ((i % 4 === 2) ? -wob : 0));
      rr(g, x + 6 + i + wx, y + 10 + Math.floor(i * 0.9) + wy, 3, 3, RED);
      rr(g, x + 6 + i + wx, y + 10 + Math.floor(i * 0.9) + wy, 1, 1, RED_HI);
      rr(g, x + 54 - i + wx, y + 10 + Math.floor(i * 0.9) + wy, 3, 3, RED);
      rr(g, x + 54 - i + wx, y + 10 + Math.floor(i * 0.9) + wy, 1, 1, RED_HI);
    }
  }
  function build() {
    if (art) return art;
    art = { board: bake(W, H, boardLayer) };
    return art;
  }
  function blit(cv, x, y) { if (cv && ctx && ctx.drawImage) ctx.drawImage(cv, x, y); }
  function ensure() {
    var closeK;
    overlay = document.getElementById('photo');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'photo';
      overlay.className = 'photo';
      overlay.hidden = true;
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
  function draw() {
    var a, list, i, wob, off;
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    a = build();
    blit(a.board, 0, 0);
    if (!a.board) { rr(ctx, 0, 0, W, H, '#8A6A40'); }
    /* parallax: the sky band drifts a quarter as far as the ground band */
    off = offsets();
    rr(ctx, 4 + off.far, 16, 48, 8, '#1A2840');
    rr(ctx, 4 + off.far, 16, 48, 1, '#3A4E78');
    rr(ctx, 4 + off.far + 6, 19, 2, 2, '#E6EEF2'); rr(ctx, 4 + off.far + 22, 21, 1, 1, '#B8CCD6'); rr(ctx, 4 + off.far + 36, 18, 1, 1, '#B8CCD6'); rr(ctx, 4 + off.far + 42, 21, 2, 2, '#E6EEF2');
    rr(ctx, 4 + off.near, 150, 48, 8, '#3A2E24');
    rr(ctx, 4 + off.near, 150, 48, 1, '#5A4636');
    rr(ctx, 4 + off.near + 8, 153, 3, 1, '#2A2018'); rr(ctx, 4 + off.near + 24, 155, 5, 1, '#2A2018'); rr(ctx, 4 + off.near + 38, 152, 3, 1, '#2A2018');
    list = panels();
    for (i = 0; i < list.length; i++) drawPolaroid(ctx, list[i], i);
    wob = reduced ? 0 : ((Math.floor(tick / 67) % 3) - 1);
    if (list[crossed]) cross(ctx, list[crossed].x, list[crossed].y, wob);
    showMark();
  }
  function drawPlace(id) {
    var i, p = null;
    ensure();
    if (!ctx) return;
    for (i = 0; i < PLACES.length; i++) if (PLACES[i].id === id) p = PLACES[i];
    if (!p) { ctx.fillStyle = '#FF00FF'; ctx.fillRect(0, 0, 16, 16); }
    else {
      if (p.id === 'woods') photoWoods(ctx, 0, 0);
      else if (p.id === 'city') photoCity(ctx, 0, 0);
      else if (p.id === 'castle') photoDungeon(ctx, 0, 0);
      else if (p.id === 'savanna') photoSavanna(ctx, 0, 0);
      else if (p.id === 'house') photoHouse(ctx, 0, 0);
      else { ctx.fillStyle = '#FF00FF'; ctx.fillRect(0, 0, 16, 16); }
    }
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
    fitScale();
    live = true;
    look = 0;
    tick = 0;
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
    NEU.save.flag('photo', 1);
    open();
    return true;
  }
  function tickFn(dtMs) {
    if (!live) return;
    tick += dtMs || 0;
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
    tick += (dt || 0) * 1000;
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
  window.addEventListener('resize', function () { if (live) fitScale(); });
  hookNote();

  NEU.photo = {
    open: open, close: close, take: take, step: step, drawPlace: drawPlace,
    get state() { return state(); },
    get running() { return live; }
  };
  if (NEU.kernel) NEU.kernel.register('photo', {
    tick: tickFn, open: open, close: close,
    running: function () { return live; }
  });
})();
