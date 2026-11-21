/* cel-mode.js — the lower shaft: imported mod rooms played 1:1 on js/core/cel.js.
   Optional, behind the elevator's -1 button after the cart ride. Kernel scene "cel".
   Kernel and map data load on demand; when cel/<map>.js is missing (a deploy without
   the local-only mod data) the shaft stays shut. Route progress lives in the save flag cel_route. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var STEP = 1 / 60, ROUTE = ['forest-path', 'the-squeeze'];
  var overlay, canvas, hud, attached = false, live = false, loading = false, idx = 0, acc = 0, keys = {}, prevMini = null;
  /* the dev route's layout (cel.html); NEU.keys.route applies the player's rebinds first */
  var MAP = { ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'U', ArrowDown: 'D', c: 'J', ' ': 'K', x: 'X', z: 'G', Shift: 'H', v: 'Z' };

  function need(list, ok, bad) {
    var s;
    if (!list.length) { ok(); return; }
    s = document.createElement('script');
    s.src = list[0];
    s.onload = function () { need(list.slice(1), ok, bad); };
    s.onerror = bad;
    document.body.appendChild(s);
  }
  function missing(id) {
    var l = [];
    if (!NEU.cel) l.push('js/core/cel.js');
    if (!NEU.celView) l.push('js/core/cel-view.js');
    if (!(NEU.celMaps && NEU.celMaps[id])) l.push('cel/' + id + '.js');
    return l;
  }
  function ensure() {
    overlay = document.getElementById('celmode');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'celmode';
      overlay.className = 'celm';
      overlay.hidden = true;
      canvas = document.createElement('canvas');
      canvas.id = 'celCanvas';
      hud = document.createElement('p');
      hud.className = 'celm__hud';
      overlay.appendChild(canvas);
      overlay.appendChild(hud);
      document.body.appendChild(overlay);
    }
    canvas = document.getElementById('celCanvas');
    hud = overlay.querySelector('.celm__hud');
  }
  function saved() { var s = NEU.save && NEU.save.flag('cel_route'); return s && typeof s.i === 'number' ? s : { i: 0 }; }
  function shut() {
    loading = false;
    if (NEU.talk) NEU.talk(['* the -1 button clicks. far below, water.', '* the lower shaft is flooded.'], 'narr');
  }
  function begin(room) {
    var opts = room ? { room: room, intro: false } : {};
    keys = {}; acc = 0;
    NEU.cel.start(ROUTE[idx], opts);
  }
  function open() {
    var s;
    if (live || loading) return true;
    s = saved();
    if (s.i >= ROUTE.length) s = { i: 0 };
    idx = s.i; loading = true;
    need(missing(ROUTE[idx]), function () {
      loading = false;
      ensure();
      live = true;
      overlay.hidden = false;
      if (!attached) { NEU.celView.attach(canvas); attached = true; }
      begin(s.room);
      prevMini = NEU.activeMinigame || null;
      NEU.activeMinigame = 'cel';
      document.body.classList.add('is-playing');
      if (NEU.keys && NEU.keys.refresh) NEU.keys.refresh();
      if (NEU.kernel) NEU.kernel.push('cel');
      if (NEU.save) NEU.save.flag('cel_seen', 1);
    }, shut);
    return true;
  }
  function close() {
    if (!live) return;
    live = false;
    if (NEU.save && NEU.cel && NEU.cel.room && idx < ROUTE.length) NEU.save.flag('cel_route', { i: idx, room: NEU.cel.room.name });
    if (overlay) overlay.hidden = true;
    if (NEU.activeMinigame === 'cel') NEU.activeMinigame = prevMini;
    if (!prevMini) document.body.classList.remove('is-playing');
    if (NEU.kernel && NEU.kernel.current() === 'cel') NEU.kernel.pop();
  }
  function next() {   /* heart taken: the next map on the route */
    idx++;
    if (NEU.save) NEU.save.flag('cel_route', { i: idx });
    if (idx >= ROUTE.length) {
      if (NEU.save) NEU.save.flag('cel_done', 1);
      close();
      if (NEU.talk) NEU.talk(['* the shaft goes quiet. the cabin is still waiting.'], 'narr');
      return;
    }
    live = false; loading = true;
    need(missing(ROUTE[idx]), function () { loading = false; live = true; begin(null); }, function () { live = true; close(); shut(); });
  }
  function tick(dtMs) {
    var n = 0, C = NEU.cel, p;
    if (!live) return;
    acc += Math.min(0.25, Math.max(0, dtMs) / 1000);
    while (acc >= STEP && n < 8) {
      C.step(keys); acc -= STEP; n++;
      if (C.level.done) { next(); return; }
    }
    NEU.celView.draw(STEP);
    p = C.player;
    if (hud) hud.textContent = ROUTE[idx] + ' · ' + C.room.name + ' · deaths ' + C.level.deaths + (p && p.dashes > 1 ? ' · 2 dashes' : '');
  }
  /* capture phase: while the shaft is open the cabin below must not see these keys */
  function onKey(e) {
    var r, k, down;
    if (!live) return;
    r = (NEU.keys && NEU.keys.route) ? NEU.keys.route(e.key, {}) : { to: e.key, swallow: false };
    if (r.swallow) return;
    k = r.to.length === 1 ? r.to.toLowerCase() : r.to;
    down = e.type === 'keydown';
    if (k === 'Escape') { if (down) close(); e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (MAP[k]) { keys[MAP[k]] = down; e.preventDefault(); e.stopImmediatePropagation(); }
  }
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keyup', onKey, true);

  NEU.celMode = {
    open: open, close: close, ROUTE: ROUTE,
    get running() { return live; }
  };
  if (NEU.kernel) NEU.kernel.register('cel', {
    tick: tick, open: open, close: close,
    running: function () { return live; }
  });
})();
