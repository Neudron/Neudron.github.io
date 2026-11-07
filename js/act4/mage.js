/* mage.js — the stone shop.
   Top of the screen is the room. Bottom left is the menu. Bottom
   right is what he says. Candles move on the kernel tick. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var wrap = document.getElementById('mage');
  if (!wrap) {
    NEU.mage = { open: function () {}, close: function () {}, provoke: function () {}, buy: function () { return false; }, sell: function () { return false; } };
    return;
  }

  var menuEl = document.getElementById('mageMenu');
  var sayEl = document.getElementById('mageSay');
  var KINDS = { melee: 1, ranged: 1, spell: 1, heal: 1 };
  var TOPICS = [
    { n: 1, label: 'the shelves', first: '* they hold what they hold. the shelves do not care.', again: '* still shelves. still dust.' },
    { n: 2, label: 'the cards', first: '* the cards are not a conversation.', again: '* i said what i said.' },
    { n: 3, label: 'the candles', first: '* three flames. they do not agree.', again: '* they still do not agree.' },
    { n: 4, label: 'you', first: '* i sell. you buy. that is the whole of me.', again: '* we have had this talk.' }
  ];
  var MOTES = [
    { x: 24, y: 40 }, { x: 88, y: 96 }, { x: 140, y: 28 },
    { x: 210, y: 70 }, { x: 280, y: 44 }, { x: 300, y: 100 }
  ];
  var WARN = '* one thing. cast a spell at me and we play cards. you will not like the cards.';

  var active = false;
  var mode = 'main';
  var sel = 0;
  var full = '';
  var shown = 0;
  var clock = 0;
  var ctx = null;
  var api;

  function reduced() {
    try {
      if (NEU.motion && NEU.motion.reduced) return !!NEU.motion.reduced();
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  function paintSay() {
    var n;
    if (!sayEl) return;
    n = shown;
    if (n > full.length) n = full.length;
    if (n < 0) n = 0;
    sayEl.textContent = full.substring(0, Math.floor(n));
  }

  function say(msg) {
    full = msg || '';
    shown = reduced() ? full.length : 0;
    paintSay();
  }

  function context() {
    var canvas;
    if (ctx) return ctx;
    canvas = document.getElementById('mageCanvas');
    if (!canvas || !canvas.getContext) return null;
    ctx = canvas.getContext('2d');
    return ctx;
  }

  function box(x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
  }

  function flameH(i) {
    if (reduced()) return 8;
    if (Math.floor((clock + i * 160) / 400) % 2) return 10;
    return 6;
  }

  function draw() {
    var y, x, i, h, m;
    if (!context()) return;
    ctx.imageSmoothingEnabled = false;
    box(0, 0, 320, 192, '#1C1814');
    for (y = 0; y < 128; y += 8) {
      for (x = ((y / 8) % 2) ? 0 : 8; x < 320; x += 16) box(x, y, 15, 7, '#2A2622');
    }
    box(8, 36, 72, 4, '#5C4030');
    box(8, 64, 72, 4, '#5C4030');
    box(14, 22, 6, 14, '#2E8B57');
    box(28, 26, 6, 10, '#8B2E2E');
    box(42, 20, 6, 16, '#2E4A8B');
    box(16, 48, 16, 12, '#E6D2A2');
    box(40, 50, 14, 10, '#CDB88A');
    box(236, 24, 70, 48, '#3A342C');
    box(242, 30, 18, 14, '#E6D2A2');
    box(266, 32, 16, 12, '#CDB88A');
    box(0, 140, 320, 36, '#6B4226');
    box(0, 136, 320, 4, '#8A5A32');
    box(150, 78, 28, 58, '#3B1F5C');
    box(148, 86, 32, 8, '#6A3FA0');
    box(156, 36, 16, 30, '#3B1F5C');
    box(148, 62, 32, 6, '#6A3FA0');
    box(160, 22, 8, 16, '#3B1F5C');
    box(156, 66, 12, 10, '#C4A574');
    box(158, 69, 3, 3, '#F4F0A0');
    box(164, 69, 3, 3, '#F4F0A0');
    box(188, 48, 3, 88, '#4A3424');
    box(184, 44, 11, 4, '#C8C060');
    for (i = 0; i < 3; i++) {
      x = 230 + i * 24;
      box(x, 112, 6, 18, '#E8D8B0');
      h = flameH(i);
      box(x + 1, 112 - h, 4, h, '#FFD060');
    }
    for (i = 0; i < MOTES.length; i++) {
      m = MOTES[i];
      box(m.x, m.y, 2, 2, '#D8D0C0');
    }
  }

  function stepMotes(dt) {
    var i, m;
    if (reduced()) return;
    for (i = 0; i < MOTES.length; i++) {
      m = MOTES[i];
      m.y -= dt * 0.012;
      if (m.y < 8) m.y = 118;
    }
  }

  function catalog() {
    var all, out, i, it;
    all = (NEU.items && NEU.items.all) ? NEU.items.all : [];
    out = [];
    for (i = 0; i < all.length; i++) {
      it = all[i];
      if (KINDS[it.kind] && it.price > 0) out.push(it);
    }
    return out;
  }

  function sellable() {
    var ids, out, i, def;
    if (!NEU.save || !NEU.items || !NEU.items.get) return [];
    ids = NEU.save.items();
    out = [];
    for (i = 0; i < ids.length; i++) {
      def = NEU.items.get(ids[i]);
      if (def && KINDS[def.kind]) out.push(def);
    }
    return out;
  }

  function isEquipped(id) {
    var eq, k;
    if (!NEU.save || !NEU.save.data) return false;
    eq = NEU.save.data.equip || {};
    for (k in eq) if (eq[k] === id) return true;
    return false;
  }

  function rows() {
    var list, out, i, it;
    if (mode === 'buy') {
      list = catalog();
      out = [];
      for (i = 0; i < list.length; i++) {
        it = list[i];
        out.push({ id: it.id, label: it.name, price: it.price });
      }
      return out;
    }
    if (mode === 'sell') {
      list = sellable();
      out = [];
      for (i = 0; i < list.length; i++) {
        it = list[i];
        out.push({ id: it.id, label: it.name, price: it.sell });
      }
      return out;
    }
    if (mode === 'talk') {
      out = [];
      for (i = 0; i < TOPICS.length; i++) out.push({ id: TOPICS[i].n, label: TOPICS[i].label });
      return out;
    }
    return [
      { id: 'buy', label: 'BUY' },
      { id: 'sell', label: 'SELL' },
      { id: 'talk', label: 'TALK' },
      { id: 'exit', label: 'EXIT' }
    ];
  }

  function render() {
    var list, i, b, name, price, row;
    if (!menuEl) return;
    list = rows();
    if (!list.length) sel = 0;
    else {
      if (sel >= list.length) sel = 0;
      if (sel < 0) sel = list.length - 1;
    }
    menuEl.innerHTML = '';
    for (i = 0; i < list.length; i++) {
      row = list[i];
      b = document.createElement('button');
      b.type = 'button';
      b.className = 'mage__row' + (i === sel ? ' is-sel' : '');
      b.setAttribute('role', 'option');
      if (i === sel) b.setAttribute('aria-selected', 'true');
      name = document.createElement('span');
      name.textContent = row.label;
      b.appendChild(name);
      if (row.price != null) {
        price = document.createElement('span');
        price.className = 'mage__p';
        price.textContent = row.price + 'g';
        b.appendChild(price);
      }
      (function (n) {
        b.addEventListener('click', function () { sel = n; render(); confirm(); });
      })(i);
      menuEl.appendChild(b);
    }
  }

  function buy(id) {
    var def;
    def = NEU.items && NEU.items.get ? NEU.items.get(id) : null;
    if (!def || !KINDS[def.kind] || !(def.price > 0) || !NEU.save) return false;
    if (def.kind !== 'heal' && NEU.save.count(id) > 0) {
      say('* you already carry that.');
      return false;
    }
    if (NEU.save.coins() < def.price || !NEU.save.spend(def.price)) {
      say('* not enough coins.');
      return false;
    }
    NEU.save.give(id);
    say('* bought. ' + def.name + '.');
    return true;
  }

  function sell(id) {
    var def, pay;
    def = NEU.items && NEU.items.get ? NEU.items.get(id) : null;
    if (!def || !KINDS[def.kind] || !NEU.save || NEU.save.count(id) < 1) return false;
    if (isEquipped(id)) {
      say('* equipped. unequip first.');
      return false;
    }
    pay = def.sell || 0;
    NEU.save.take(id);
    NEU.save.addCoins(pay);
    say('* sold. ' + pay + ' coins.');
    return true;
  }

  function talkTopic(n) {
    var i, t, key, seen;
    t = null;
    for (i = 0; i < TOPICS.length; i++) if (TOPICS[i].n === n) t = TOPICS[i];
    if (!t || !NEU.save) return;
    key = 'mage_talk_' + n;
    seen = NEU.save.flagged(key);
    NEU.save.flag(key, true);
    say(seen ? t.again : t.first);
  }

  function exitAction() {
    if (NEU.save && !NEU.save.flagged('mage_warned')) {
      NEU.save.flag('mage_warned', true);
      say(WARN);
      return;
    }
    close();
  }

  function confirm() {
    var list, row;
    list = rows();
    if (!list.length) {
      mode = 'main';
      sel = 0;
      say('* nothing there.');
      render();
      return;
    }
    row = list[sel];
    if (!row) return;
    if (mode === 'main') {
      if (row.id === 'buy') { mode = 'buy'; sel = 0; say('* what will you buy?'); render(); return; }
      if (row.id === 'sell') { mode = 'sell'; sel = 0; say('* what will you sell?'); render(); return; }
      if (row.id === 'talk') { mode = 'talk'; sel = 0; say('* speak, then.'); render(); return; }
      exitAction();
      return;
    }
    if (mode === 'buy') { buy(row.id); render(); return; }
    if (mode === 'sell') { sell(row.id); render(); return; }
    if (mode === 'talk') talkTopic(row.id);
  }

  function move(d) {
    var n = rows().length;
    if (!n) return;
    sel = (sel + d + n) % n;
    render();
  }

  function unstack() {
    var i;
    if (!NEU.kernel || !NEU.kernel.stack) return;
    i = NEU.kernel.stack.indexOf('mage');
    if (i >= 0) NEU.kernel.stack.splice(i, 1);
  }

  function open() {
    var beaten, met;
    active = true;
    if (api) api.active = true;
    NEU.activeMinigame = 'mage';
    wrap.hidden = false;
    if (NEU.kernel) NEU.kernel.push('mage');
    mode = 'main';
    sel = 0;
    beaten = NEU.save && NEU.save.flagged('mage_beaten');
    met = NEU.save && NEU.save.flagged('mage_met');
    if (NEU.save && !met) NEU.save.flag('mage_met', true);
    if (beaten) say('* you again. the cards remember you.');
    else if (met) say('* you return. the shelves have not moved.');
    else say('* a stone shop. the mage waits.');
    render();
    draw();
  }

  function close() {
    active = false;
    if (api) api.active = false;
    if (NEU.activeMinigame === 'mage') NEU.activeMinigame = null;
    wrap.hidden = true;
    mode = 'main';
    sel = 0;
    unstack();
  }

  function provoke() {
    if (NEU.cards && NEU.cards.open) NEU.cards.open();
  }

  function tick(dt) {
    if (!active) return;
    if (dt !== dt || dt < 0) dt = 0;
    if (!reduced()) clock += dt;
    if (!reduced() && shown < full.length) {
      shown += dt * 30 / 1000;
      if (shown > full.length) shown = full.length;
      paintSay();
    }
    stepMotes(dt);
    draw();
  }

  addEventListener('keydown', function (e) {
    var k, r;
    if (!active || wrap.hidden) return;
    if (NEU.kernel && NEU.kernel.current() !== 'mage') return;
    r = (NEU.keys && NEU.keys.route) ? NEU.keys.route(e.key, {}) : { to: e.key, swallow: false };
    if (r.swallow) return;
    k = r.to;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') { move(-1); e.preventDefault(); return; }
    if (k === 'ArrowDown' || k === 's' || k === 'S') { move(1); e.preventDefault(); return; }
    if (k === 'Escape') {
      e.preventDefault();
      if (mode !== 'main') { mode = 'main'; sel = 0; render(); return; }
      exitAction();
      return;
    }
    if (k === 'Enter' || k === 'z' || k === 'Z') {
      e.preventDefault();
      if (Math.floor(shown) < full.length) { shown = full.length; paintSay(); return; }
      confirm();
    }
  });

  api = {
    open: open, close: close, provoke: provoke, buy: buy, sell: sell, tick: tick,
    running: function () { return active; },
    active: false
  };
  NEU.mage = api;
  if (NEU.kernel) NEU.kernel.register('mage', {
    tick: tick, open: open, close: close,
    running: function () { return active; }
  });
})();
