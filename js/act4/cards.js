/* cards.js — the Mage's card duel. First person, his table, your shelf. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var wrap = document.getElementById('cards');
  var canvas = wrap ? (wrap.querySelector('canvas') || document.getElementById('cardsCanvas')) : null;
  var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  var active = false;
  var state = null;
  var CW = 72;
  var CH = 104;

  var SPEC = [['ATTACK', 6], ['HEAL', 4], ['DEFEND', 3], ['PARRY', 3]];
  var ICON = {
    ATTACK: ['00100', '00100', '00100', '11111', '00100'],
    HEAL: ['00100', '00100', '11111', '00100', '00100'],
    DEFEND: ['01110', '11111', '11111', '11111', '01110'],
    PARRY: ['00100', '01100', '11111', '00110', '00100']
  };

  function reduced() {
    if (NEU.motion && NEU.motion.reduced) return !!NEU.motion.reduced();
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function buildDeck() {
    var deck = [], s, i;
    for (s = 0; s < SPEC.length; s++) for (i = 0; i < SPEC[s][1]; i++) deck.push(SPEC[s][0]);
    return deck;
  }

  function shuffle(arr, rng) {
    var a = arr.slice(), i, j, t;
    for (i = a.length - 1; i > 0; i--) {
      j = Math.floor(rng() * (i + 1));
      t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function blank() {
    return {
      you: { hp: 15, hand: [], block: 0, parry: false, streak: 0 },
      mage: { hp: 15, hand: [], block: 0, parry: false },
      deck: [], mageDeck: [], discard: [],
      sel: 0, over: false, result: null, awarded: false,
      clock: 0, flies: [], slide: null, grain: [], grainAt: -1000
    };
  }

  function hurt(p, dmg) {
    var use;
    if (p.block > 0) {
      use = p.block > dmg ? dmg : p.block;
      p.block -= use;
      dmg -= use;
    }
    p.hp -= dmg;
  }

  function drawUp(who) {
    var p = state[who];
    var deck = who === 'you' ? state.deck : state.mageDeck;
    var id;
    while (p.hand.length < 4 && deck.length) {
      id = deck.pop();
      p.hand.push(id);
      if (who === 'you' && !reduced()) state.flies.push({ id: id, slot: p.hand.length - 1, t: 0, dur: 350 });
    }
  }

  function mageIndex() {
    var h = state.mage.hand, i;
    if (state.mage.hp <= 6) { i = h.indexOf('HEAL'); if (i >= 0) return i; }
    if (state.you.streak >= 2) { i = h.indexOf('PARRY'); if (i >= 0) return i; }
    i = h.indexOf('ATTACK');
    if (i >= 0) return i;
    return h.length ? 0 : -1;
  }

  function act(who, idx) {
    var p, id, enemy;
    if (!state || state.over) return false;
    p = state[who];
    if (idx < 0 || idx >= p.hand.length) return false;
    id = p.hand.splice(idx, 1)[0];
    enemy = state[who === 'you' ? 'mage' : 'you'];
    if (id !== 'ATTACK' && enemy.parry) enemy.parry = false;
    if (id === 'ATTACK') {
      if (enemy.parry) { enemy.parry = false; hurt(p, 3); }
      else hurt(enemy, 3);
      if (who === 'you') state.you.streak++;
    } else if (id === 'HEAL') {
      p.hp = p.hp + 3;
      if (p.hp > 15) p.hp = 15;
      if (who === 'you') state.you.streak = 0;
    } else if (id === 'DEFEND') {
      p.block = 3;
      if (who === 'you') state.you.streak = 0;
    } else if (id === 'PARRY') {
      p.parry = true;
      if (who === 'you') state.you.streak = 0;
    }
    state.discard.push(id);
    if (who === 'you' && !reduced()) state.slide = { id: id, t: 0, dur: 280 };
    if (NEU.juice && NEU.juice.hit) NEU.juice.hit(id === 'ATTACK' ? 'medium' : 'small');
    if (state.mage.hp <= 0) { state.mage.hp = 0; state.over = true; state.result = 'win'; }
    else if (state.you.hp <= 0) { state.you.hp = 0; state.over = true; state.result = 'lose'; }
    if (!state.over) drawUp(who);
    if (state.sel >= state.you.hand.length) state.sel = state.you.hand.length ? state.you.hand.length - 1 : 0;
    return true;
  }

  function grant() {
    if (!state || state.awarded) return;
    state.awarded = true;
    if (!NEU.save) return;
    NEU.save.give('boss_key');
    NEU.save.give('nova');
    NEU.save.flag('mage_beaten', true);
  }

  function dungeonDeath() {
    var P = NEU.plat, i, s;
    if (!P || !P.open || !P.step) return;
    if (!(P.levels && P.levels.d1)) {
      if (P.levels && P.levels.d0) P.open('d0');
      return;
    }
    P.open('d1');
    for (i = 0; i < 80; i++) {
      s = P.step(1 / 60, 'left');
      if (NEU.dungeon && NEU.dungeon.here && NEU.dungeon.here() === 'd0') return;
      if (s && s.dead) return;
    }
  }

  /* Both decks and both hands empty, both still up: the duel has nowhere
     to go. Higher HP wins. A tie is a loss. */
  function settle() {
    if (!state || state.over) return;
    drawUp('you');
    drawUp('mage');
    if (state.you.hand.length || state.mage.hand.length) return;
    state.over = true;
    state.result = state.you.hp > state.mage.hp ? 'win' : 'lose';
  }

  function play(idx) {
    if (!state) return state;
    if (!state.over) {
      act('you', idx);
      if (!state.over) {
        var mi = mageIndex();
        if (mi >= 0) act('mage', mi);
      }
      settle();
    }
    if (state.result === 'win') grant();
    if (state.result === 'lose') { close(); dungeonDeath(); }
    else draw();
    return state;
  }

  function stackPush() {
    if (NEU.kernel && NEU.kernel.stack && NEU.kernel.stack.indexOf('cards') < 0) NEU.kernel.push('cards');
  }
  function stackPop() {
    var i;
    if (!NEU.kernel || !NEU.kernel.stack) return;
    i = NEU.kernel.stack.indexOf('cards');
    if (i >= 0) NEU.kernel.stack.splice(i, 1);
  }

  function open(opts) {
    var rng;
    opts = opts || {};
    rng = opts.rng;
    if (!rng && opts.seed != null && NEU.rand && NEU.rand.seeded) rng = NEU.rand.seeded(opts.seed);
    if (!rng) rng = Math.random;
    state = blank();
    state.deck = shuffle(buildDeck(), rng);
    state.mageDeck = shuffle(buildDeck(), rng);
    drawUp('you');
    drawUp('mage');
    active = true;
    if (wrap) wrap.hidden = false;
    if (canvas) { canvas.width = 640; canvas.height = 480; }
    stackPush();
    draw();
  }

  function close() {
    active = false;
    if (wrap) wrap.hidden = true;
    stackPop();
  }

  function tick(dt) {
    var i;
    if (!active || !state) return;
    if (dt !== dt || dt < 0) dt = 0;
    if (!reduced()) state.clock += dt;
    if (state.slide) {
      state.slide.t += dt;
      if (state.slide.t >= state.slide.dur) state.slide = null;
    }
    for (i = state.flies.length - 1; i >= 0; i--) {
      state.flies[i].t += dt;
      if (state.flies[i].t >= state.flies[i].dur) state.flies.splice(i, 1);
    }
    draw();
  }

  function slotPos(i) { return { x: 196 + i * 86, y: state.sel === i ? 348 : 360 }; }

  function qbez(a, b, c, t) {
    var u = 1 - t;
    return u * u * a + 2 * u * t * b + t * t * c;
  }

  function flyFor(slot) {
    var i, f;
    for (i = 0; i < state.flies.length; i++) {
      f = state.flies[i];
      if (f.slot === slot && f.t < f.dur) return f;
    }
    return null;
  }

  function drawFace(id, x, y) {
    var icon = ICON[id], r, c, num;
    ctx.fillStyle = '#F0D8A8';
    ctx.fillRect(x, y, CW, CH);
    ctx.fillStyle = '#1A120C';
    ctx.fillRect(x, y, CW, 4);
    ctx.fillRect(x, y + CH - 4, CW, 4);
    ctx.fillRect(x, y, 4, CH);
    ctx.fillRect(x + CW - 4, y, 4, CH);
    if (icon) for (r = 0; r < icon.length; r++) for (c = 0; c < 5; c++) if (icon[r].charAt(c) === '1') {
      ctx.fillRect(x + 26 + c * 4, y + 18 + r * 4, 4, 4);
    }
    num = id === 'HEAL' ? '+3' : '3';
    ctx.fillStyle = '#1A120C';
    ctx.font = '32px monospace';
    ctx.fillText(num, x + 24, y + 78);
    ctx.font = '16px monospace';
    ctx.fillText(id, x + 8, y + 96);
  }

  function freshGrain() {
    var g = [], i;
    for (i = 0; i < 36; i++) g.push({ x: (Math.random() * 640) | 0, y: (Math.random() * 480) | 0 });
    return g;
  }

  function draw() {
    var w, h, sway, cx, bands, radii, i, n, pos, f, t, x, y, shook;
    if (!ctx || !state) return;
    w = canvas.width || 640;
    h = canvas.height || 480;
    ctx.imageSmoothingEnabled = false;
    shook = NEU.juice && NEU.juice.begin ? NEU.juice.begin(ctx, w, h) : false;
    ctx.fillStyle = '#100C08';
    ctx.fillRect(0, 0, w, h);
    sway = reduced() ? 0 : Math.round(Math.sin(state.clock / 800) * 14);
    cx = 320 + sway;
    bands = ['#3A2818', '#6A4828', '#A07030', '#FFD060'];
    radii = [200, 140, 90, 48];
    for (i = 0; i < bands.length; i++) {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = bands[i];
      ctx.beginPath();
      ctx.arc(cx, 42, radii[i], 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#C8B48A';
    ctx.fillRect(cx - 2, 0, 4, 28);
    ctx.fillStyle = '#FFE080';
    ctx.fillRect(cx - 8, 28, 16, 16);
    ctx.fillStyle = '#5C3A1E';
    ctx.fillRect(120, 228, 400, 24);
    ctx.fillRect(64, 252, 512, 78);
    ctx.fillStyle = '#E4C8A8';
    ctx.fillRect(308, 70, 24, 20);
    ctx.fillStyle = '#3B1F5C';
    ctx.fillRect(292, 90, 56, 34);
    ctx.fillRect(284, 124, 72, 28);
    for (i = 0; i < 4; i++) {
      ctx.fillStyle = '#1E3A5F';
      ctx.fillRect(214 + i * 68, 132, 56, 76);
      ctx.fillStyle = '#0E1C30';
      ctx.fillRect(236 + i * 68, 156, 12, 16);
    }
    ctx.fillStyle = '#6B4423';
    ctx.fillRect(16, 150, 40, 170);
    n = state.deck.length > 8 ? 8 : state.deck.length;
    for (i = 0; i < n; i++) {
      ctx.fillStyle = '#F0D8A8';
      ctx.fillRect(22, 292 - i * 8, 28, 10);
    }
    for (i = 0; i < state.you.hand.length; i++) {
      f = flyFor(i);
      if (f) {
        t = f.t / f.dur;
        if (t < 0) t = 0;
        if (t > 1) t = 1;
        pos = slotPos(i);
        x = qbez(36, 110, pos.x, t);
        y = qbez(188, 40, pos.y, t);
        drawFace(f.id, x, y);
      } else drawFace(state.you.hand[i], slotPos(i).x, slotPos(i).y);
    }
    if (state.slide && state.slide.t < state.slide.dur) {
      t = state.slide.t / state.slide.dur;
      drawFace(state.slide.id, qbez(300, 320, 284, t), qbez(360, 200, 236, t));
    }
    ctx.font = '32px monospace';
    ctx.fillStyle = '#F4EFE4';
    ctx.fillText(String(state.mage.hp), 48, 44);
    ctx.fillText(String(state.you.hp), 560, 44);
    ctx.font = '16px monospace';
    ctx.fillText('MAGE', 48, 64);
    ctx.fillText('YOU', 560, 64);
    if (state.sel < state.you.hand.length && !flyFor(state.sel)) {
      pos = slotPos(state.sel);
      ctx.fillStyle = '#FF0';
      ctx.fillRect(pos.x - 4, pos.y - 4, CW + 8, 4);
    }
    if (!reduced()) {
      if (state.clock - state.grainAt >= 400) {
        state.grainAt = state.clock;
        state.grain = freshGrain();
      }
      ctx.fillStyle = '#C8C0B4';
      for (i = 0; i < state.grain.length; i++) ctx.fillRect(state.grain[i].x, state.grain[i].y, 1, 1);
    }
    if (NEU.juice && NEU.juice.end) NEU.juice.end(ctx, shook);
    if (NEU.juice && NEU.juice.overlay) NEU.juice.overlay(ctx, w, h);
    if (NEU.juice && NEU.juice.drawParts) NEU.juice.drawParts(ctx, 0.016);
  }

  function onKey(e) {
    var k, n, r;
    if (!active || !state) return;
    if (NEU.kernel && NEU.kernel.current() !== 'cards') return;
    r = (NEU.keys && NEU.keys.route) ? NEU.keys.route(e.key, {}) : { to: e.key, swallow: false };
    if (r.swallow) return;
    k = r.to;
    if (k === 'Escape') {
      close();
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (k === 'ArrowLeft' || k === 'ArrowRight') {
      n = state.you.hand.length;
      if (n && !state.over) state.sel = (state.sel + (k === 'ArrowLeft' ? -1 : 1) + n) % n;
      draw();
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (k === 'z' || k === 'Z') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (state.over) { close(); return; }
      play(state.sel);
    }
  }

  window.addEventListener('keydown', onKey, true);

  NEU.cards = {
    open: open,
    close: close,
    play: play,
    tick: tick,
    state: function () { return state; },
    running: function () { return active; }
  };
  if (NEU.kernel) NEU.kernel.register('cards', {
    tick: tick,
    open: open,
    close: close,
    running: function () { return active; }
  });
})();
