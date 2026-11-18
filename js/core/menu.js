(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {}, el = null, sky = null, ctx = null;
  var stack = [], screens = {}, open_ = false, mode = '', previousFocus = null, frame = 0;
  var rows = [], selected = 0, raf = 0;
  var bands = ['#08080B', '#0C0A12', '#110D1A', '#160F20', '#1B1026', '#22102A', '#2A0F2A', '#280204'];

  function reduced() { return !!(NEU.motion && NEU.motion.reduced && NEU.motion.reduced()); }
  function ensure() {
    if (el) return;
    el = document.createElement('div'); el.className = 'menu'; el.hidden = true;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'menu');
    sky = document.createElement('canvas'); sky.className = 'menu__sky'; sky.setAttribute('aria-hidden', 'true');
    el.appendChild(sky); ctx = sky.getContext('2d');
    document.body.appendChild(el);
    if (NEU.motion && NEU.motion.on) NEU.motion.on(motionChanged);
  }
  function drawSky() {
    raf = 0;
    if (!ctx || mode !== 'title') return;
    var w = sky.width = window.innerWidth, h = sky.height = window.innerHeight, i;
    ctx.imageSmoothingEnabled = false;
    for (i = 0; i < bands.length; i++) { ctx.fillStyle = bands[i]; ctx.fillRect(0, Math.floor(h * i / bands.length), w, Math.ceil(h / bands.length)); }
    ctx.fillStyle = '#EDE7DE'; ctx.beginPath(); ctx.arc(w * .75, h * .22, 48, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#D9D2C6'; ctx.beginPath(); ctx.arc(w * .75 + 8, h * .22 - 4, 44, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#22222E'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w * .75 - 4, h * .22 - 25); ctx.lineTo(w * .75 + 2, h * .22 - 8); ctx.lineTo(w * .75 - 3, h * .22 + 2); ctx.lineTo(w * .75 + 6, h * .22 + 10); ctx.lineTo(w * .75 + 3, h * .22 + 25); ctx.stroke();
    if (!reduced()) {
      for (i = 0; i < 24; i++) {
        var y = h - ((frame * (i % 3 + 1) + i * 71) % h);
        ctx.fillStyle = i % 2 ? '#FF4A2A' : '#FFC46A'; ctx.fillRect((i * 97 + Math.sin((frame + i * 13) / 30) * 6 + w) % w, y, 2, 2);
      }
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(w * .75 + (frame % 60 < 30 ? -3 : 3), h * .22 + 2, 2, 2);
    }
    frame++;
    if (mode === 'title' && !reduced()) raf = requestAnimationFrame(drawSky);
  }
  function stopSky() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function motionChanged(r) { if (el) el.classList.toggle('is-reduced', !!r); if (r) stopSky(); if (mode === 'title') drawSky(); }
  function label(def) { return NEU.keys && NEU.keys.label ? NEU.keys.label(def) : def; }
  function focusables() { return el ? Array.prototype.slice.call(el.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])')) : []; }
  function setClaim(on) {
    if (on) NEU.activeMinigame = 'menu';
    else if (NEU.activeMinigame === 'menu') NEU.activeMinigame = null;
  }
  function render() {
    var box, screen = screens[stack[stack.length - 1]], nodes;
    ensure();
    while (el.childNodes.length > 1) el.removeChild(el.lastChild);
    box = document.createElement('section'); box.className = 'menu__panel ' + (mode === 'title' ? 'menu__panel--title' : 'menu__panel--pause');
    if (mode === 'pause') { var heading = document.createElement('h1'); heading.className = 'menu__heading'; heading.textContent = 'MENU'; box.appendChild(heading); }
    var list = document.createElement('div'); list.className = 'menu__rows'; list.setAttribute('role', 'group');
    box.appendChild(list); el.appendChild(box); rows = [];
    if (screen) screen(list, { add: addRow, mode: mode });
    nodes = list.querySelectorAll('button'); rows = Array.prototype.slice.call(nodes);
    if (rows.length) selected = Math.max(0, Math.min(selected, rows.length - 1));
    updateRows();
    if (mode === 'title') {
      var title = document.createElement('h1'); title.className = 'menu__title'; title.textContent = 'NEU';
      var sub = document.createElement('p'); sub.className = 'menu__subtitle'; sub.textContent = 'the woods';
      box.insertBefore(sub, list); box.insertBefore(title, sub);
      var foot = document.createElement('p'); foot.className = 'menu__footer';
      foot.textContent = '↑/' + label('w') + ' ↓/' + label('s') + ' choose · ' + label('z') + ' / enter pick · ' + label('x') + ' / esc back'; box.appendChild(foot);
    }
    var focus = rows.filter(function (r) { return !r.disabled; })[0];
    if (focus) focus.focus();
  }
  function addRow(list, text, fn, opts) {
    opts = opts || {};
    var b = document.createElement('button'); b.type = 'button'; b.className = 'menu__row'; b.textContent = text;
    if (opts.disabled) { b.disabled = true; var hint = document.createElement('span'); hint.className = 'menu__hint'; hint.textContent = opts.hint || 'soon'; b.appendChild(hint); }
    b.addEventListener('mouseenter', function () { selected = rows.indexOf(b); updateRows(); });
    b.addEventListener('click', function () { if (!b.disabled) fn(); });
    list.appendChild(b);
  }
  function updateRows() { rows.forEach(function (r, i) { r.classList.toggle('is-selected', i === selected); }); }
  function addStandard(list, text, action, opts) { addRow(list, text, action, opts); }
  function register(name, build) { screens[name] = build; }
  function titleScreen(list, api) {
    var hasSave = !!(NEU.save && NEU.save.data && NEU.save.data.room != null);
    if (hasSave) addStandard(list, 'CONTINUE', function () { close(); if (NEU.act4 && NEU.act4.open) NEU.act4.open(); });
    addStandard(list, 'PLAY', function () {
      function go() { if (NEU.save) { if (NEU.save.newGame) NEU.save.newGame(); else if (NEU.save.wipe) NEU.save.wipe(); } close(); if (NEU.act4 && NEU.act4.open) NEU.act4.open(); }
      if (hasSave && NEU.engine && NEU.engine.confirmExit) NEU.engine.confirmExit('a new game', go, 'start over? your settings stay.'); else go();
    });
    addStandard(list, 'SAVES', function () { push('saves'); }, { disabled: !screens.saves });
    addStandard(list, 'SETTINGS', function () { if (NEU.settings && NEU.settings.open) NEU.settings.open(); });
    addStandard(list, 'PROGRESS', function () { push('progress'); }, { disabled: !screens.progress });
    addStandard(list, 'EXIT', function () { close(); if (NEU.deck && NEU.deck.open) NEU.deck.open(); });
  }
  function pauseScreen(list) {
    addStandard(list, 'RESUME', close);
    addStandard(list, 'SAVES', function () { push('saves'); }, { disabled: !screens.saves });
    addStandard(list, 'SETTINGS', function () { if (NEU.settings && NEU.settings.open) NEU.settings.open(); });
    addStandard(list, 'PROGRESS', function () { push('progress'); }, { disabled: !screens.progress });
    addStandard(list, 'EXIT', function () { if (NEU.engine && NEU.engine.confirmExit) NEU.engine.confirmExit('the game', function () { close(); NEU.engine.leave(); }, 'leave the game? your save is kept.'); });
  }
  function push(name) { if (!screens[name]) return; stack.push(name); selected = 0; render(); }
  function pop() { if (stack.length > 1) { stack.pop(); selected = 0; render(); } else if (mode === 'pause') close(); else close(); }
  function open(kind) {
    ensure(); if (open_) return;
    open_ = true; mode = kind; stack = [kind]; previousFocus = document.activeElement;
    if (NEU.engine && NEU.engine.clearKeys) NEU.engine.clearKeys();
    setClaim(true); el.hidden = false; el.classList.toggle('is-title', kind === 'title'); el.classList.toggle('is-pause', kind === 'pause'); el.classList.toggle('is-reduced', reduced()); render();
    if (kind === 'title' && NEU.save) NEU.save.flag('opt_seenTitle', 1);
    if (kind === 'title') drawSky();
  }
  function close() {
    if (!open_) return;
    open_ = false; stopSky(); el.hidden = true; stack = []; mode = '';
    if (NEU.engine && NEU.engine.clearKeys) NEU.engine.clearKeys();
    setClaim(false);
    if (previousFocus && previousFocus.focus) previousFocus.focus();
    previousFocus = null;
  }
  function route(e) {
    if (!open_ || document.getElementById('confirmExit') || (NEU.settings && NEU.settings.open_)) return;
    var key = e.key, routed = NEU.keys && NEU.keys.route ? NEU.keys.route(key).to : key;
    var up = routed === 'w' || key === 'ArrowUp', down = routed === 's' || key === 'ArrowDown';
    if (key === 'Tab') {
      var els = focusables(); if (!els.length) return;
      e.preventDefault(); e.stopImmediatePropagation();
      var i = els.indexOf(document.activeElement), next = e.shiftKey ? (i <= 0 ? els.length - 1 : i - 1) : (i + 1) % els.length; els[next].focus(); return;
    }
    if (up || down) {
      e.preventDefault(); e.stopImmediatePropagation();
      var step = down ? 1 : -1, count = rows.length;
      for (var n = 0; n < count; n++) { selected = (selected + step + count) % count; if (!rows[selected].disabled) break; }
      updateRows(); if (rows[selected]) rows[selected].focus(); if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick(); return;
    }
    if ((routed === 'z' || key === 'Enter' || key === ' ') && !e.repeat) {
      e.preventDefault(); e.stopImmediatePropagation(); if (rows[selected] && !rows[selected].disabled) rows[selected].click(); return;
    }
    if ((routed === 'x' || key === 'Escape') && !e.repeat) { e.preventDefault(); e.stopImmediatePropagation(); pop(); return; }
  }
  register('title', titleScreen); register('pause', pauseScreen);
  addEventListener('keydown', route, true);
  if (NEU.kernel) NEU.kernel.register('menu', { open: function () {}, close: close, running: function () { return open_; }, tick: function () {} });
  NEU.menu = { title: function () { open('title'); }, pause: function () { open('pause'); }, push: push, pop: pop, register: register, close: close, get isOpen() { return open_; } };
})();
