/* menu.js — the in-game main menu (Play / Config / Save).
   ───────────────────────────────────────────────────────────────────
   A real menu for the hidden game, not for the public landing page:
   nothing here exists until a game script opens it. One authority for
   every value it shows — NEU.save owns the file, NEU.diff owns the
   tiers, NEU.settings owns the options, NEU.act4 owns launching.
   This module only lays out buttons and hands focus between them.

   z 93: under settings (94) and the dialogue box (96), over every
   scene. Arrow keys wrap, Escape goes back one screen, Tab is trapped
   inside the overlay, and every action works with a mouse as well.  */

(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};
  if (NEU.menu) return;                       /* built already */

  /* One short line per tier. These describe the maths in diff.js and
     nothing else — no story, no names of rooms, fights or items. */
  var FX = {
    bot: 'bullets barely move. a very gentle introduction.',
    easy: 'slower bullets and wider gaps.',
    medium: 'the intended balance of speed and room.',
    hard: 'faster bullets, tighter gaps to slip through.',
    vhard: 'tougher fights and longer waits between heals.',
    ultrakill: 'very fast patterns; healing costs more time.',
    finalbreath: 'the fastest patterns, and no healing at all.'
  };
  var FALLBACK_FX = 'changes how hard the fights press you.';

  var box = null, screen = 'root', active = false, returnTo = null;
  var list = [], index = 0, announce = null;

  function reduced() {
    try {
      if (NEU.settings && NEU.settings.reduced) return !!NEU.settings.reduced;
      if (NEU.motion && NEU.motion.reduced) return !!NEU.motion.reduced();
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function button(label, cls, fn) {
    var b = el('button', 'menu__act' + (cls ? ' ' + cls : ''), label);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }

  function build() {
    box = el('div', 'menu');
    box.hidden = true;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'main menu');
    box.tabIndex = -1;
    var win = el('div', 'menu__win');
    var head = el('div', 'menu__head');
    head.appendChild(el('h2', 'menu__title', 'neu'));
    var ver = NEU.save && NEU.save.VERSION ? NEU.save.VERSION : 3;
    head.appendChild(el('span', 'menu__ver', 'v' + ver));
    win.appendChild(head);
    var body = el('div', 'menu__screen');
    win.appendChild(body);
    announce = el('p', 'menu__note');
    announce.setAttribute('aria-live', 'polite');
    win.appendChild(announce);
    win.appendChild(el('p', 'menu__keys', '\u2191\u2193 choose \u00b7 Enter confirm \u00b7 Esc back'));
    box.appendChild(win);
    document.body.appendChild(box);
    box._body = body;
  }

  /* The buttons currently on screen, in visual order. */
  function focusables() {
    var nodes = box._body.querySelectorAll('.menu__act:not(:disabled), .menu__tier:not(:disabled)');
    return Array.prototype.slice.call(nodes);
  }

  function focusAt(i) {
    list = focusables();
    if (!list.length) return;
    index = (i + list.length) % list.length;
    list[index].focus();
  }

  function note(msg) { if (announce) announce.textContent = msg || ''; }

  function clear() { box._body.textContent = ''; list = []; index = 0; }

  function heading(text) {
    var h = el('h3', 'menu__h', text);
    box._body.appendChild(h);
    return h;
  }

  /* ── screens ──────────────────────────────────────────────────── */
  function root() {
    clear();
    var save = NEU.save && NEU.save.load ? NEU.save.load() : null;
    heading(save ? 'the woods are still there.' : 'something is hidden down here.');
    box._body.appendChild(button('Play', 'menu__primary', function () {
      if (NEU.save && NEU.save.load && NEU.save.load()) continueGame();
      else setScreen('difficulty');
    }));
    box._body.appendChild(button('Config', '', function () {
      if (NEU.settings && NEU.settings.open) NEU.settings.open();
    }));
    box._body.appendChild(button('Save', '', function () { setScreen('save'); }));
    note('');
  }

  function continueGame() {
    close();
    if (NEU.act4 && NEU.act4.open) NEU.act4.open();
  }

  function difficulty() {
    clear();
    heading('pick how hard it pushes back.');
    var ids = NEU.diff && NEU.diff.list ? NEU.diff.list() : [];
    for (var i = 0; i < ids.length; i++) {
      (function (id, n) {
        var b = el('button', 'menu__tier');
        b.type = 'button';
        b.setAttribute('role', 'option');
        b.appendChild(el('b', 'menu__tier-name', NEU.diff.name ? NEU.diff.name(n) : id));
        b.appendChild(el('span', 'menu__tier-fx', FX[id] || FALLBACK_FX));
        b.addEventListener('click', function () { chooseTier(id); });
        box._body.appendChild(b);
      })(ids[i], i);
    }
    var back = button('Back', 'menu__back', function () { setScreen('root'); });
    box._body.appendChild(back);
    note('you can change this later in the file.');
  }

  function chooseTier(id) {
    if (NEU.diff && NEU.diff.set) NEU.diff.set(id);
    if (NEU.save && NEU.save.newGame) NEU.save.newGame();
    close();
    if (NEU.act4 && NEU.act4.open) NEU.act4.open();
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function saveScreen() {
    clear();
    var d = (NEU.save && NEU.save.data) || {};
    var tier = NEU.diff && NEU.diff.name ? NEU.diff.name() : 'Medium';
    var room = d.room || 'not in a room';
    var time = NEU.save && NEU.save.playtime ? fmtTime(NEU.save.playtime()) : '0:00';
    heading('this browser remembers you.');
    var info = el('p', 'menu__file');
    info.appendChild(el('span', '', 'tier: ' + tier));
    info.appendChild(el('span', '', 'last room: ' + room));
    info.appendChild(el('span', '', 'time: ' + time));
    box._body.appendChild(info);
    box._body.appendChild(button('Save', '', function () {
      if (NEU.save) { NEU.save.capture(); NEU.save.saveSlot(1); }
      note('saved to this browser.');
    }));
    box._body.appendChild(button('Load', '', function () {
      var ok = NEU.save && NEU.save.loadSlot ? NEU.save.loadSlot(1) : false;
      note(ok ? 'loaded.' : 'nothing saved in this slot yet.');
    }));
    box._body.appendChild(button('New Game', 'menu__danger', function () { setScreen('confirm'); }));
    box._body.appendChild(button('Back', 'menu__back', function () { setScreen('root'); }));
    note('');
  }

  function confirmScreen() {
    clear();
    heading('erase this progress and start over?');
    box._body.appendChild(button('Keep my save', 'menu__primary', function () { setScreen('save'); }));
    box._body.appendChild(button('New Game', 'menu__danger', function () {
      if (NEU.save && NEU.save.newGame) NEU.save.newGame();
      setScreen('difficulty');
    }));
    note('this cannot be undone.');
  }

  var SCREENS = { root: root, difficulty: difficulty, save: saveScreen, confirm: confirmScreen };

  function setScreen(name) {
    screen = SCREENS[name] ? name : 'root';
    if (SCREENS[screen]) SCREENS[screen]();
    box.setAttribute('aria-label', 'main menu \u2014 ' + screen);
    focusAt(0);
  }

  function open(name) {
    if (!box) build();
    if (!active) { returnTo = document.activeElement; active = true; }
    box.hidden = false;
    box.classList.toggle('is-calm', reduced());
    setScreen(name || 'root');
  }

  function close() {
    if (!active) return;
    active = false;
    box.hidden = true;
    var back = returnTo;
    returnTo = null;
    if (back && back !== document.body && document.contains(back) && back.focus) back.focus();
  }

  function toggle() { active ? close() : open('root'); }

  /* ── keyboard ───────────────────────────────────────────────────
     Capture, so a scene underneath never sees the key. Tab is stepped
     by index so jsdom and every browser agree on the order. */
  addEventListener('keydown', function (e) {
    if (!active || !box) return;
    /* Settings opened from Config sits above this overlay. */
    if (NEU.settings && NEU.settings.open_) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      e.stopImmediatePropagation();
      focusAt(index + (e.shiftKey ? -1 : 1));
      return;
    }
    if (e.key === 'Escape' || e.key === 'x' || e.key === 'X') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (screen === 'root') close();
      else setScreen(screen === 'confirm' ? 'save' : 'root');
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault(); e.stopImmediatePropagation(); focusAt(index + 1); return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault(); e.stopImmediatePropagation(); focusAt(index - 1); return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      if (document.activeElement && list.indexOf(document.activeElement) >= 0) {
        e.preventDefault(); e.stopImmediatePropagation();
        document.activeElement.click();
      }
    }
  }, true);

  /* Escape in a room opens the menu (pause), but only when no other
     modal owns the key. The menu's own Escape handler above closes it. */
  addEventListener('keydown', function (e) {
    if (active || e.key !== 'Escape' || e.repeat) return;
    if (NEU.activeMinigame || NEU.tboxOpen && NEU.tboxOpen()) return;
    if (NEU.settings && NEU.settings.open_) return;
    if (document.getElementById('confirmExit')) return;
    var inRoom = !!(NEU.engine && NEU.engine.running) ||
      !!(NEU.save && NEU.save.data && NEU.save.data.room);
    if (!inRoom) return;
    e.preventDefault();
    open('root');
  });

  /* Built at load, the way settings.js builds its panel: an overlay that
     only exists after the first open can never be found by a screen reader
     or by CSS until someone presses a key. */
  build();

  NEU.menu = {
    open: open, close: close, toggle: toggle,
    get active() { return active; },
    get screen() { return screen; }
  };
})();
