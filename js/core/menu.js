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
  var pending = null, importText = '';
  var paused = false;

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
    var legend = el('p', 'menu__keys', '↑↓ choose · Enter confirm · Esc back');
    if (NEU.glyph) {
      legend.innerHTML = '<span class="glyph__copy">↑↓ choose · Enter confirm · Esc back</span>' +
        '<kbd class="glyph__shape glyph__key" aria-hidden="true">↑↓</kbd> ' +
        '<kbd class="glyph__shape glyph__key" aria-hidden="true">Enter</kbd> ' +
        '<kbd class="glyph__shape glyph__key" aria-hidden="true">Esc</kbd>';
    }
    win.appendChild(legend);
    box.appendChild(win);
    document.body.appendChild(box);
    box._body = body;
  }

  /* The buttons currently on screen, in visual order. */
  function focusables() {
    var nodes = box._body.querySelectorAll(
      '.menu__act:not(:disabled), .menu__tier:not(:disabled), textarea:not(:disabled), input:not(:disabled)');
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

  /* The act boundary is already owned by save.js's slot meta: a1_seen
     is where "acts I-III" ends and Act IV begins. No new flag, no
     second copy of where the story is. */
  function actLabel(data) {
    return data.flags && data.flags.a1_seen ? 'IV' : 'I\u2013III';
  }

  function countOn(o) {
    var n = 0, k;
    for (k in o) if (Object.prototype.hasOwnProperty.call(o, k) && o[k]) n++;
    return n;
  }

  /* A question with two ways out. Every destructive action in here
     goes through ask(): overwriting a slot, importing a file, starting
     over. One shape, so none of them can be missed. */
  function ask(title, msg, yesLabel, onYes, onNo) {
    pending = { title: title, msg: msg, yesLabel: yesLabel, onYes: onYes, onNo: onNo };
    setScreen('confirm');
  }

  function ioArea(value, ro, label) {
    var ta = el('textarea', 'menu__io');
    ta.value = value || '';
    ta.readOnly = !!ro;
    ta.rows = 8;
    ta.spellcheck = false;
    ta.setAttribute('aria-label', label);
    return ta;
  }

  function download(name, text) {
    try {
      if (!window.Blob || !window.URL || !window.URL.createObjectURL) return false;
      var url = window.URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      var a = el('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      return true;
    } catch (e) { return false; }
  }

  /* ── screens ──────────────────────────────────────────────────── */
  function root() {
    clear();
    var save = NEU.save && NEU.save.load ? NEU.save.load() : null;
    heading(paused ? 'MENU' : (save ? 'the woods are still there.' : 'something is hidden down here.'));
    if (paused) box._body.appendChild(button('Resume', 'menu__primary', close));
    box._body.appendChild(button('Play', 'menu__primary', function () {
      if (NEU.save && NEU.save.load && NEU.save.load()) continueGame();
      else setScreen('difficulty');
    }));
    box._body.appendChild(button('Config', '', function () {
      if (NEU.settings && NEU.settings.open) NEU.settings.open();
    }));
    box._body.appendChild(button('Save', '', function () { setScreen('save'); }));
    if (paused) box._body.appendChild(button('Exit', 'menu__danger', function () {
      NEU.engine.confirmExit('the game', function () { close(); NEU.engine.leave(); },
        'leave the game? your save is kept.');
    }));
    note('');
  }

  function continueGame() {
    close();
    if (NEU.act4 && NEU.act4.open) NEU.act4.open();
  }

  /* Read-only window onto the two owners: quest.view() already hides the
     unreachable steps, and save.js owns every number shown here. No
     room ids or flag counts — those only ever spoiled the chain. */
  function progress() {
    clear();
    heading('where you are.');
    var data = (NEU.save && NEU.save.data) || {};
    var view = NEU.quest && NEU.quest.view ? NEU.quest.view() : [];
    for (var g = 0; g < view.length; g++) {
      var grp = view[g];
      var group = el('div', 'menu__prog');
      group.appendChild(el('h4', '', grp.group + ' ' + grp.n + '/' + grp.total));
      var ul = el('ul', '');
      for (var r = 0; r < grp.rows.length; r++) {
        var row = grp.rows[r];
        var line = (row.done ? '\u00d7 ' : '\u00b7 ') + row.text +
          (row.of ? ' (' + row.count + '/' + row.of + ')' : '');
        ul.appendChild(el('li', '', line));
      }
      group.appendChild(ul);
      box._body.appendChild(group);
    }
    var info = el('div', 'menu__file');
    info.appendChild(el('span', '', 'coins: ' +
      (NEU.save && NEU.save.coins ? NEU.save.coins() : (data.coins || 0))));
    info.appendChild(el('span', '', 'time: ' +
      (NEU.save && NEU.save.playtime ? fmtTime(NEU.save.playtime()) : '0:00')));
    var items = data.items || [];
    for (var i = 0; i < items.length; i++) {
      var def = NEU.items && NEU.items.get ? NEU.items.get(items[i]) : null;
      if (def && def.name) info.appendChild(el('span', '', 'item: ' + def.name));
    }
    var best = data.best || {};
    for (var b in best)
      if (Object.prototype.hasOwnProperty.call(best, b) && best[b] > 0)
        info.appendChild(el('span', '', b + ': ' + best[b]));
    box._body.appendChild(info);
    box._body.appendChild(button('Back', 'menu__back', function () { setScreen('root'); }));
    note('');
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
        var desc = el('span', 'menu__tier-fx', FX[id] || FALLBACK_FX);
        if (NEU.glyph) {
          desc.classList.add('glyph__copy');
          b.appendChild(NEU.glyph.meter(n + 1));
        }
        b.appendChild(desc);
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

  function fmtDate(ms) {
    var d = new Date(Number(ms) || 0);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) +
      '-' + ('0' + d.getDate()).slice(-2);
  }

  function slotRow(n) {
    var cards = NEU.save && NEU.save.slots ? NEU.save.slots() : [];
    var card = cards[n - 1] || { empty: true, ok: true };
    var row = el('div', 'menu__slot');
    var label;
    if (card.empty) label = 'slot ' + n + ' \u00b7 empty';
    else if (!card.ok) label = 'slot ' + n + ' \u00b7 cannot load';
    else {
      var m = card.meta || {};
      label = 'slot ' + n + ' \u00b7 ' + (m.group || '?') + ' \u00b7 ' + (m.done || 0) +
        ' steps \u00b7 ' + (m.diff || '') + ' \u00b7 ' + fmtTime(m.t_play) +
        ' \u00b7 ' + fmtDate(m.saved);
    }
    row.appendChild(el('span', 'menu__slot-h', label));
    var acts = el('div', 'menu__slot-b');
    acts.appendChild(button('Save', 'menu__mini', function () {
      function write() {
        var saved = NEU.save && NEU.save.saveSlot ? NEU.save.saveSlot(n) : false;
        setScreen('save');
        note(saved ? 'saved to slot ' + n + '.' : 'could not save.');
      }
      if (card.empty) write();
      else ask('overwrite slot ' + n + '?', 'the file in this slot will be replaced.',
        'overwrite', write, function () { setScreen('save'); });
    }));
    if (card.ok || card.empty) acts.appendChild(button('Load', 'menu__mini', function () {
      var loaded = NEU.save && NEU.save.loadSlot ? NEU.save.loadSlot(n) : false;
      if (loaded) setScreen('save');
      note(loaded ? 'loaded slot ' + n + '.' : 'nothing saved in this slot yet.');
    }));
    row.appendChild(acts);
    return row;
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
    box._body.appendChild(slotRow(1));
    box._body.appendChild(slotRow(2));
    box._body.appendChild(slotRow(3));
    box._body.appendChild(button('Progress', '', function () { setScreen('progress'); }));
    box._body.appendChild(button('Export JSON', '', function () { setScreen('export'); }));
    box._body.appendChild(button('Import JSON', '', function () { importText = ''; setScreen('import'); }));
    box._body.appendChild(button('New Game', 'menu__danger', function () {
      ask('erase this progress and start over?',
        'your save in this browser will be replaced.', 'start over',
        function () {
          if (NEU.save && NEU.save.newGame) NEU.save.newGame();
          setScreen('difficulty');
        }, function () { setScreen('save'); });
    }));
    box._body.appendChild(button('Back', 'menu__back', function () { setScreen('root'); }));
    note('');
  }

  function confirmScreen() {
    clear();
    var p = pending || { title: 'are you sure?', msg: '', yesLabel: 'yes', onNo: null, onYes: null };
    heading(p.title);
    if (p.msg) box._body.appendChild(el('p', 'menu__file', p.msg));
    box._body.appendChild(button('Keep', 'menu__primary', function () {
      var back = p.onNo; pending = null;
      if (back) back(); else setScreen('save');
    }));
    box._body.appendChild(button(p.yesLabel || 'yes', 'menu__danger', function () {
      var yes = p.onYes; pending = null;
      if (yes) yes();
    }));
    note('this cannot be undone.');
  }

  function exportScreen() {
    clear();
    heading('your save, as text.');
    var json = NEU.save && NEU.save.exportJSON ? NEU.save.exportJSON() : '{}';
    box._body.appendChild(ioArea(json, true, 'save JSON to copy'));
    box._body.appendChild(button('Download .json', '', function () {
      note(download('neu-save.json', json) ? 'downloaded.' : 'select the text and copy it.');
    }));
    box._body.appendChild(button('Back', 'menu__back', function () { setScreen('save'); }));
    note('copy the text, or download the file.');
  }

  function importScreen() {
    clear();
    heading('paste a save to load it.');
    var ta = ioArea(importText, false, 'save JSON to import');
    ta.addEventListener('input', function () { importText = ta.value; });
    box._body.appendChild(ta);
    box._body.appendChild(button('Load this save', 'menu__primary', function () {
      importText = ta.value;
      if (!importText.trim()) { note('paste a save first.'); return; }
      ask('replace this save with the pasted one?',
        'progress in this browser will be overwritten.', 'replace',
        function () {
          var res = NEU.save && NEU.save.importJSON ?
            NEU.save.importJSON(importText) : { ok: false, why: 'no save module' };
          if (res.ok) setScreen('save');
          note(res.ok ? 'loaded.' : 'could not load: ' + res.why);
        }, function () { setScreen('import'); });
    }));
    box._body.appendChild(button('Back', 'menu__back', function () { setScreen('save'); }));
    note('');
  }

  var SCREENS = {
    root: root, difficulty: difficulty, progress: progress, save: saveScreen,
    confirm: confirmScreen, export: exportScreen, import: importScreen
  };

  function setScreen(name) {
    screen = SCREENS[name] ? name : 'root';
    if (SCREENS[screen]) SCREENS[screen]();
    box.setAttribute('aria-label', 'main menu \u2014 ' + screen);
    focusAt(0);
  }

  function open(name) {
    if (!box) build();
    if (NEU.engine && NEU.engine.clearKeys) NEU.engine.clearKeys();
    if (!active) { returnTo = document.activeElement; active = true; }
    box.hidden = false;
    box.classList.toggle('is-calm', reduced());
    setScreen(name || 'root');
  }

  function close() {
    if (!active) return;
    active = false;
    paused = false;
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
    /* A pasted save is text: arrows move the caret, Enter is a newline
       and Space is a space. Tab and Escape still belong to the dialog. */
    var t = e.target;
    var typing = !!t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT');
    if (e.key === 'Tab') {
      e.preventDefault();
      e.stopImmediatePropagation();
      focusAt(index + (e.shiftKey ? -1 : 1));
      return;
    }
    if (e.key === 'Escape' || (!typing && (e.key === 'x' || e.key === 'X'))) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (screen === 'root') close();
      else if (screen === 'confirm') {
        var back = pending && pending.onNo; pending = null;
        if (back) back(); else setScreen('save');
      } else if (screen === 'export' || screen === 'import') setScreen('save');
      else setScreen('root');
      return;
    }
    if (typing) return;
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
    NEU.menu.pause();
  });

  /* Built on first open (open() guards it), so the portfolio carries no menu node. */

  NEU.menu = {
    open: open, close: close, toggle: toggle,
    /* A fresh page opens the title menu; Escape in a room pauses into the
       same root screen with Resume/Exit and the MENU heading. Neither path
       claims the keyboard or sets activeMinigame (R26). */
    title: function () { if (NEU.save) NEU.save.flag('opt_seenTitle', 1); paused = false; open('root'); },
    pause: function () { paused = true; open('root'); },
    /* The settings slider shows the same one-line description as the
       tier picker: one copy of the copy, read lazily after both load. */
    effect: function (id) { return FX[id] || FALLBACK_FX; },
    get active() { return active; },
    get screen() { return screen; }
  };
})();
