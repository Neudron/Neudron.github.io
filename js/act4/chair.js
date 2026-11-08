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
    if (!list.length) {
      li = document.createElement('li');
      li.textContent = '* nowhere yet.';
      listEl.appendChild(li);
      return;
    }
    for (i = 0; i < list.length; i++) {
      li = document.createElement('li');
      li.setAttribute('data-room', list[i]);
      li.textContent = label(list[i]);
      if (i === sel) li.className = 'is-sel';
      listEl.appendChild(li);
    }
  }
  /* ── art: sky, clouds and cards are baked once ────────────────────── */
  var CW = 320, CH = 180, cv = null, g = null, clock = 0, art = null, chairImg = null;
  var ZONES = {
    woods: ['#0E1A1C', '#16302A', '#2A4A3A'], tavern: ['#3A2414', '#8A5A32', '#FFB347'],
    dad: ['#121214', '#2A2824', '#E8C890'], sand: ['#8A5A28', '#C47A32', '#E2B84A']
  };
  function reduced() {
    if (NEU.motion && NEU.motion.reduced && NEU.motion.reduced()) return true;
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function mk(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function hs(x, y, s) {
    var h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function F(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
  function WF(c, x, y, w, h, col) { F(c, x, y, w, h, col); if (x + w > CW) F(c, x - CW, y, w, h, col); }
  function bakeSky() {
    var c = mk(CW, CH), k = c.getContext('2d'), B = ['#0A0614', '#120A22', '#1A1030', '#241640'], i, x;
    for (i = 0; i < 4; i++) F(k, 0, i * 45, CW, 45, B[i]);
    for (i = 1; i < 4; i++) for (x = 0; x < CW; x += 2) F(k, x, i * 45 + ((x >> 1) & 1) * 2, 2, 2, B[i - 1]);
    for (i = 4; i < 30; i++) F(k, (hs(i, 1, 3) * 318) | 0, (hs(i, 2, 3) * 110) | 0, 1, 1, '#EDE7DE');
    return c;
  }
  function bakeClouds(far) {
    var c = mk(CW, 40), k = c.getContext('2d'), i, x, w, h, r, hw, base = far ? ['#2A1E40', '#3A2A55', '#3A2A55'] : ['#3A2A55', '#4A3A6A', '#6A5A8A'];
    for (i = 0; i < (far ? 5 : 4); i++) {
      x = ((i * (far ? 71 : 85)) + ((hs(i, 4, 9) * 30) | 0)) % CW; w = (far ? 44 : 60) + ((hs(i, 5, 9) * 20) | 0); h = far ? 12 : 18;
      for (r = 0; r < h; r++) {
        hw = Math.round(w / 2 * Math.sqrt(1 - Math.pow(1 - r / h, 2)) * (1 - r / h * 0.1));
        WF(k, x + (w >> 1) - hw, 20 + r - (far ? 0 : 4), hw * 2, 1, r < 2 ? base[2] : r < h * 0.6 ? base[1] : base[0]);
      }
      WF(k, x + (w >> 1) - ((w / 2 * 0.9) | 0), 20 + h - (far ? 0 : 4), (w * 0.9) | 0, 3, base[0]);
    }
    return c;
  }
  function bakeCard(zone) {
    var c = mk(64, 40), k = c.getContext('2d'), R = ZONES[zone] || ZONES.woods, i, r, w;
    F(k, 0, 0, 64, 40, '#12081E'); F(k, 1, 1, 62, 38, '#6A5A8A'); F(k, 2, 2, 60, 36, R[0]);
    F(k, 2, 26, 60, 12, R[1]); F(k, 2, 26, 60, 1, R[2]);
    if (zone === 'tavern') {
      F(k, 22, 14, 18, 16, '#22140A'); F(k, 23, 15, 16, 14, R[2]); F(k, 23, 15, 3, 14, '#FFE0A0'); F(k, 36, 15, 3, 14, R[1]);
      F(k, 40, 18, 5, 8, '#22140A'); F(k, 41, 19, 3, 6, R[2]); F(k, 22, 11, 18, 4, '#FFF6C0'); F(k, 24, 9, 6, 3, '#FFF6C0');
    } else if (zone === 'dad') {
      F(k, 31, 12, 2, 20, '#22201C'); F(k, 24, 8, 16, 2, '#0A0A0C'); for (r = 0; r < 8; r++) F(k, 24 + (r >> 1) * -1 + 0, 8 + r, 16 + (r >> 1) * 2, 1, r < 2 ? R[2] : '#C9A870');
      F(k, 26, 30, 12, 2, '#0A0A0C');
    } else if (zone === 'sand') {
      F(k, 31, 16, 3, 16, '#3A2414'); F(k, 31, 16, 1, 16, '#5A3418');
      for (r = 0; r < 6; r++) { w = 44 - r * 4; F(k, 32 - (w >> 1), 8 + r, w, 1, r < 2 ? '#5A6A2A' : '#3A4A1E'); }
      F(k, 8, 20, 5, 6, '#E2B84A'); F(k, 50, 14, 6, 6, '#FFE080');
    } else {
      for (i = 0; i < 3; i++) for (r = 0; r < 8; r++) { w = 4 + r * 2 + i * 2; F(k, 32 - (w >> 1), 5 + i * 7 + r, w, 1, r < 2 ? '#3A6A4A' : R[2]); }
      F(k, 30, 29, 4, 7, '#22140A');
      F(k, 8, 8, 2, 2, '#EDE7DE'); F(k, 52, 12, 1, 1, '#EDE7DE');
    }
    return c;
  }
  function zoneOf(id) {
    var c = String(id || '').charAt(0);
    return c === 'p' ? 'tavern' : c === 'e' ? 'dad' : c === 's' ? 'sand' : 'woods';
  }
  function ensureArt() {
    if (art) return;
    art = { sky: bakeSky(), far: bakeClouds(true), near: bakeClouds(false), cards: {} };
    if (typeof Image !== 'undefined') {
      chairImg = new Image();
      chairImg.src = 'img/act4/undertale/armchair.png';
    }
  }
  function scrollTo(img, y, off) {
    var o = Math.round(((off % CW) + CW) % CW);
    g.drawImage(img, -o, y);
    g.drawImage(img, CW - o, y);
  }
  function paint() {
    var rm = reduced(), i, bob, flut, z, list, tw, ready;
    if (!g) return;
    ensureArt();
    g.imageSmoothingEnabled = false;
    g.drawImage(art.sky, 0, 0);
    tw = rm ? 1 : (Math.floor(clock / 0.9) & 1);
    for (i = 0; i < 4; i++) {
      F(g, 16 + i * 71, 14 + i * 23, 1, 1, tw ? '#EDE7DE' : '#241640');
      if (tw) { F(g, 15 + i * 71, 14 + i * 23, 3, 1, '#6A5A8A'); F(g, 16 + i * 71, 13 + i * 23, 1, 3, '#6A5A8A'); F(g, 16 + i * 71, 14 + i * 23, 1, 1, '#EDE7DE'); }
    }
    scrollTo(art.far, 96, rm ? 0 : clock * 6);
    bob = rm ? 0 : Math.round(Math.sin(Math.floor(clock / 0.15) * 0.785) * 2);
    flut = rm ? 0 : (Math.floor(clock / 0.3) & 1);
    ready = chairImg && chairImg.complete && chairImg.naturalWidth > 0;
    F(g, 192, 142 + bob, 56, 3, '#120A22');
    if (ready) g.drawImage(chairImg, 196, 54 + bob);
    else {
      F(g, 198, 76 + bob, 42, 40, '#12081E'); F(g, 200, 78 + bob, 38, 36, '#8A2A3A'); F(g, 200, 78 + bob, 38, 3, '#C45A6A'); F(g, 196, 90 + bob, 8, 28, '#6A1A28');
    }
    F(g, 214 + flut, 138 + bob, 2, 4, '#C45A6A'); F(g, 224 - flut, 138 + bob, 2, 4, '#C45A6A');
    scrollTo(art.near, 124, rm ? 0 : clock * 14);
    F(g, 0, 160, CW, 20, '#241640'); F(g, 0, 160, CW, 1, '#4A3A6A'); F(g, 0, 164, CW, 16, '#1A1030');
    list = visited();
    z = zoneOf(list[sel]);
    if (!art.cards[z]) art.cards[z] = bakeCard(z);
    g.drawImage(art.cards[z], 244, 14);
  }
  function draw() { fill(); paint(); }
  function travel(id) {
    if (NEU.save) NEU.save.flag('chair_dest', id);
    if (NEU.talk) NEU.talk(['* the chair sets down.'], 'narr');
    close();
    if (NEU.engine && typeof NEU.engine.go === 'function') NEU.engine.go(id, 'default');
  }
  function step(dtMs) {
    if (!live) return null;
    clock += Math.min(0.05, Math.max(0, dtMs || 0) / 1000);
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
    cv = null; g = null;
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
    cv = document.createElement('canvas');
    cv.width = CW; cv.height = CH;
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;object-fit:cover;z-index:0';
    g = cv.getContext('2d');
    listEl.style.zIndex = '1';
    root.appendChild(cv);
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
