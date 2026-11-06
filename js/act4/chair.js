/* chair.js — fast travel once the flying chair is owned.
   The snail menu hands over. Any room the save has visited is a stop.
   Keys go through NEU.keys. The kernel owns the clock. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};

  var live = false, sel = 0;
  var root = null, listEl = null, off = null;

  function owns() { return !!(NEU.save && NEU.save.has && NEU.save.has('flying_chair')); }
  function keyName(def) { return NEU.keys && NEU.keys.label ? NEU.keys.label(def) : def; }
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
  function markVisit(id) {
    if (!id || !NEU.save) return;
    NEU.save.flag('visit:' + id, 1);
  }
  function wrapGo(orig) {
    function wrapped(id, spawn, opts) {
      markVisit(id);
      return orig.call(NEU.engine, id, spawn, opts);
    }
    wrapped.__chair = 1;
    return wrapped;
  }
  function visited() {
    var out = [], rooms, i, flags, k;
    if (NEU.engine && NEU.engine.room) markVisit(NEU.engine.room);
    if (NEU.save && NEU.save.data && NEU.save.data.room) markVisit(NEU.save.data.room);
    rooms = NEU.engine && NEU.engine.rooms;
    if (rooms && rooms.length) {
      for (i = 0; i < rooms.length; i++) {
        if (NEU.save && NEU.save.flagged('visit:' + rooms[i])) out.push(rooms[i]);
      }
      return out;
    }
    flags = NEU.save && NEU.save.data ? NEU.save.data.flags : {};
    for (k in flags) if (k.indexOf('visit:') === 0 && flags[k]) out.push(k.slice(6));
    return out;
  }
  function label(id) { return String(id).split('_').join(' '); }
  function fill() {
    var list, i, li;
    if (!listEl) return;
    list = visited();
    if (sel >= list.length) sel = list.length ? list.length - 1 : 0;
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
    for (i = 0; i < list.length; i++) {
      li = document.createElement('li');
      li.setAttribute('data-room', list[i]);
      li.textContent = label(list[i]);
      if (i === sel) li.className = 'is-sel';
      listEl.appendChild(li);
    }
  }
  function draw() { fill(); }
  function travel(id) {
    if (NEU.save) NEU.save.flag('chair_dest', id);
    if (NEU.talk) NEU.talk(['* the chair sets down.'], 'narr');
    close();
    if (NEU.engine && typeof NEU.engine.go === 'function') NEU.engine.go(id, 'default');
  }
  function step() {
    if (!live) return null;
    draw();
    return { sel: sel };
  }
  function close() {
    live = false;
    if (NEU.activeMinigame === 'chair') NEU.activeMinigame = null;
    if (off) off();
    off = null;
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null;
    listEl = null;
    if (NEU.kernel && NEU.kernel.current() === 'chair') NEU.kernel.pop();
  }
  function onKey(e) {
    var k, list;
    if (!live || e.type !== 'keydown') return;
    if (NEU.tboxOpen && NEU.tboxOpen()) return;
    k = routeKey(e);
    list = visited();
    if (k === 'w' || k === 'ArrowUp') { if (sel > 0) sel -= 1; }
    else if (k === 's' || k === 'ArrowDown') { if (sel < list.length - 1) sel += 1; }
    else if ((k === 'z' || k === 'Enter' || k === ' ') && !e.repeat) {
      if (list.length) travel(list[sel]);
      return;
    } else if (k === 'x' || k === 'Escape') { close(); return; }
    else return;
    draw();
  }
  function open() {
    var hint;
    if (live || !owns()) return;
    live = true;
    sel = 0;
    NEU.activeMinigame = 'chair';
    root = document.createElement('div');
    root.id = 'chair';
    root.className = 'chair';
    root.setAttribute('role', 'dialog');
    listEl = document.createElement('ul');
    listEl.id = 'chairList';
    listEl.className = 'chair__list';
    hint = document.createElement('p');
    hint.className = 'chair__hint';
    hint.textContent = keyName('w') + '  ' + keyName('s') + '  ' + keyName('z');
    root.appendChild(listEl);
    root.appendChild(hint);
    document.body.appendChild(root);
    off = function () { removeEventListener('keydown', onKey); };
    addEventListener('keydown', onKey);
    if (NEU.kernel && NEU.kernel.current() !== 'chair') NEU.kernel.push('chair');
    draw();
  }
  function hook() {
    var names = ['go', 'enter', 'warp'], i, orig, wrapped;
    if (NEU.engine) {
      for (i = 0; i < names.length; i++) {
        orig = NEU.engine[names[i]];
        if (typeof orig !== 'function' || orig.__chair) continue;
        NEU.engine[names[i]] = wrapGo(orig);
      }
    }
    if (NEU.snail && NEU.snail.open && !NEU.snail.open.__chair) {
      orig = NEU.snail.open;
      wrapped = function () {
        if (owns()) { open(); return; }
        return orig();
      };
      wrapped.__chair = 1;
      NEU.snail.open = wrapped;
    }
  }

  NEU.chair = {
    open: open, close: close, step: step, hook: hook,
    get state() { return live ? { sel: sel } : null; }
  };
  if (NEU.kernel) NEU.kernel.register('chair', {
    tick: step, open: open, close: close,
    running: function () { return live; }
  });
  hook();
})();
