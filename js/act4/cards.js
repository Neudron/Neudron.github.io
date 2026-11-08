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

  /* ── art: static layers are baked once, the frame is a few blits ── */
  var INK = '#12081E';
  var art = null;
  var PINS = ['#1A120C', '#2A1248', '#3A2414', '#5A3418', '#8A4A20'];
  var FILL = { ATTACK: ['#8A2E2E', '#C84A4A'], PARRY: ['#2E5A8F', '#4A82C0'], HEAL: ['#2E8B57', '#4AB880'], DEFEND: ['#8A6A20', '#C8A040'] };
  var HEART = ['.RR..RR.', 'RRRRRRRR', 'RRRRRRRR', 'RRRRRRRR', '.RRRRRR.', '..RRRR..', '...RR...'];
  var HAT = ['...PP...', '..PPPP..', '..PPPP..', '.PPPPPP.', '.PPPPPP.', 'BBBBBBBB', 'bbbbbbbb'];

  function rr(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
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
  function hs(x, y, s) {
    var h = (x * 374761393 + y * 668265263 + (s || 0) * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function blob(g, cx, cy, rx, ry, c) {
    var y, k, hw;
    for (y = -ry; y <= ry; y++) {
      k = 1 - (y * y) / ((ry + 0.5) * (ry + 0.5));
      if (k <= 0) continue;
      hw = Math.round(rx * Math.sqrt(k));
      rr(g, cx - hw, cy + y, hw * 2 + 1, 1, c);
    }
  }
  function blit(cv, x, y, w, h) {
    if (!cv || !ctx.drawImage) return;
    if (w) ctx.drawImage(cv, x, y, w, h); else ctx.drawImage(cv, x, y);
  }
  function icon(g, rows, pal, x, y) {
    var r, c, ch, d;
    for (d = 0; d < 4; d++) for (r = 0; r < rows.length; r++) for (c = 0; c < 8; c++) {
      if (rows[r].charAt(c) !== '.') rr(g, x + c * 2 + (d === 0 ? -2 : d === 1 ? 2 : 0), y + r * 2 + (d === 2 ? -2 : d === 3 ? 2 : 0), 2, 2, INK);
    }
    for (r = 0; r < rows.length; r++) for (c = 0; c < 8; c++) {
      ch = rows[r].charAt(c);
      if (ch !== '.') rr(g, x + c * 2, y + r * 2, 2, 2, pal[ch]);
    }
  }

  function backLayer(g) {
    var x, y, k, tone, px, py;
    var T = ['#1A120C', '#241A12', '#2E2218'];
    rr(g, 0, 0, 640, 480, '#100C08');
    for (y = 0; y < 368; y += 16) {
      for (x = -((y >> 4) % 3) * 11; x < 640; x += 32) {
        k = Math.floor(hs(x, y, 2) * 3);
        rr(g, x, y, 31, 15, T[k]);
        rr(g, x, y, 31, 1, k === 2 ? '#3A2A1C' : '#2E2218');
        rr(g, x + 30, y, 1, 15, '#0C0806');
        rr(g, x, y + 15, 32, 1, '#0C0806');
        if (hs(x, y, 7) < 0.15) { px = x + 6 + ((hs(x, y, 8) * 18) | 0); rr(g, px, y + 5, 2, 2, '#120C08'); rr(g, px - 1, y + 4, 4, 1, '#0C0806'); }
      }
    }
    for (y = 368; y < 480; y += 16) {
      for (x = -((y >> 4) % 3) * 13; x < 640; x += 40) {
        rr(g, x, y, 39, 15, hs(x, y, 4) < 0.5 ? '#0C0806' : '#120C08');
        rr(g, x + 39, y, 1, 16, '#080504');
      }
    }
    rr(g, 0, 360, 640, 8, '#0A0604');
    rr(g, 0, 360, 640, 1, '#2E2218');
    /* plaques behind the hit points */
    for (k = 0; k < 2; k++) {
      px = k ? 528 : 32;
      rr(g, px - 2, 10, 100, 70, INK);
      rr(g, px, 12, 96, 66, '#1A120C');
      rr(g, px, 12, 96, 2, '#5A3418'); rr(g, px, 12, 2, 66, '#5A3418');
      rr(g, px + 94, 12, 2, 66, '#0C0806'); rr(g, px, 76, 96, 2, '#0C0806');
      rr(g, px + 2, 14, 92, 62, '#241A12');
    }
    icon(g, HAT, { P: '#7A52B8', B: '#2A1248', b: '#4B2A78' }, 100, 22);
    icon(g, HEART, { R: '#E04A4A' }, 592, 22);
    rr(g, 598, 26, 2, 2, '#FFB0B0');
  }
  function lightSprite(g) {
    var cols = ['#3A2818', '#6A4828', '#A07030', '#FFD060'], rad = [200, 140, 90, 48], al = [0.10, 0.14, 0.18, 0.24], i;
    for (i = 0; i < 4; i++) { g.globalAlpha = al[i]; blob(g, 200, 150, rad[i], Math.round(rad[i] * 0.75), cols[i]); }
    g.globalAlpha = 1;
  }
  function lampSprite(g) {
    rr(g, 0, 2, 16, 18, INK);
    rr(g, 2, 0, 12, 2, INK);
    rr(g, 1, 3, 14, 3, '#8A6A30'); rr(g, 1, 3, 14, 1, '#C8A050');
    rr(g, 3, 6, 10, 10, '#FFE080');
    rr(g, 3, 6, 2, 10, '#C8A050'); rr(g, 11, 6, 2, 10, '#C8A050');
    rr(g, 6, 7, 2, 4, '#FFF6C0');
    rr(g, 1, 16, 14, 3, '#8A6A30'); rr(g, 1, 16, 14, 1, '#C8A050');
    rr(g, 5, 19, 6, 1, '#8A6A30');
  }
  function bustSprite(g) {
    var i, k, y, h, w, x0, cx, L, R3;
    function B(x, yy, ww, hh, c) { rr(g, 24 + x, yy, ww, hh, c); }
    for (y = 30; y < 64; y++) {
      h = 14 + Math.floor((y - 30) * 6 / 34);
      B(-h - 1, y, h * 2 + 2, 1, INK);
      B(-h, y, h * 2, 1, '#3B1F5C');
      B(-h, y, 4, 1, '#1E0F33');
      B(h - 6, y, 3, 1, '#6A3FA0');
      B(h - 3, y, 2, 1, '#9A70D0');
      B(h - 1, y, 1, 1, '#E8B060');
      if (y > 40) { B(-6, y, 1, 1, '#2A1640'); B(3, y, 1, 1, '#4B2A78'); }
    }
    B(-6, 46, 2, 1, '#B892FF'); B(5, 46, 2, 1, '#B892FF');
    B(-8, 16, 16, 13, INK);
    B(-7, 16, 14, 12, '#C4A574');
    B(4, 16, 3, 12, '#E6C9A0');
    B(-7, 16, 14, 2, '#8A6A4A');
    B(-5, 18, 4, 1, '#B8B0A8'); B(1, 18, 4, 1, '#B8B0A8');
    B(-4, 20, 2, 2, '#F4F0A0'); B(1, 20, 2, 2, '#F4F0A0');
    B(0, 20, 2, 5, '#C49B6A'); B(1, 20, 1, 5, '#E6C9A0');
    for (i = 0; i < 16; i++) {
      w = i < 6 ? 18 : (i < 10 ? 16 : (i < 13 ? 12 : (i < 15 ? 8 : 4)));
      x0 = -(w >> 1); y = 22 + i;
      B(x0 - 1, y, w + 2, 1, INK);
      B(x0, y, w, 1, '#B8B0A8');
      B(x0 + w - 5, y, 5, 1, '#E4DCD0');
      B(x0, y, 2, 1, '#8A827A');
      if ((i & 3) < 2) B(x0 + 3 + (i & 1), y, 1, 1, '#FFFFFF');
    }
    B(-21, 11, 42, 6, INK);
    B(-20, 12, 40, 4, '#2A1248');
    B(-20, 12, 40, 1, '#4B2A78');
    B(13, 13, 7, 2, '#7A52B8');
    B(-20, 15, 40, 1, INK);
    for (k = 0; k < 11; k++) {
      w = 20 - Math.round(14 * k / 10);
      cx = k > 6 ? Math.floor((k - 6) * 4 / 4) : 0;
      x0 = cx - (w >> 1); y = 10 - k;
      B(x0 - 1, y, w + 2, 1, INK);
      L = Math.max(1, Math.floor(w / 3)); R3 = w > 10 ? 3 : 2;
      B(x0, y, L, 1, '#2A1640');
      B(x0 + L, y, w - L - R3, 1, '#4B2A78');
      B(x0 + w - R3, y, R3, 1, '#7A52B8');
      if (k === 1) B(x0, y, w, 1, '#C8A040');
    }
    B(-3, -1, 6, 1, INK); B(2, -1, 4, 1, INK);
    B(-1, 8, 2, 2, '#E8C860');
  }
  function tableLayer(g) {
    var y, x0, i, w;
    function T(xx, yy, ww, hh, c) { rr(g, xx, yy - 200, ww, hh, c); }
    /* stool for the deck */
    T(8, 208, 56, 8, '#3A2414'); T(8, 208, 56, 1, '#5A3418'); T(8, 215, 56, 1, '#1A120C');
    T(14, 216, 6, 150, '#2A1C12'); T(52, 216, 6, 150, '#2A1C12');
    /* far rail */
    T(46, 206, 548, 12, INK);
    T(48, 207, 544, 10, '#3A2414');
    T(48, 207, 544, 1, '#5C3A1E');
    /* top */
    for (y = 218; y < 322; y++) {
      x0 = 78 - Math.floor((y - 218) * 40 / 104);
      T(x0 - 1, y, 640 - x0 * 2 + 2, 1, INK);
      T(x0, y, 640 - x0 * 2, 1, y < 224 ? '#7A5230' : (y & 8 ? '#5C3A1E' : '#6B4423'));
    }
    for (i = 0; i < 3; i++) {
      y = 252 + i * 26;
      x0 = 78 - Math.floor((y - 218) * 40 / 104);
      for (w = 0; w < 5; w++) T(x0 + 14 + ((hs(i, w, 3) * 480) | 0), y + (w & 1), 30 + ((hs(i, w, 4) * 70) | 0), 1, '#4A2E18');
    }
    /* felt inset 400x56 with a trim */
    T(118, 234, 404, 60, INK);
    T(119, 235, 402, 58, '#C8A040');
    T(119, 235, 402, 1, '#FFE080');
    T(119, 292, 402, 1, '#8A6A20');
    T(121, 237, 398, 54, '#12281E');
    T(122, 238, 396, 52, '#1E4030');
    for (i = 0; i < 90; i++) T(124 + ((hs(i, 1, 5) * 390) | 0), 240 + ((hs(i, 2, 5) * 48) | 0), 2, 1, '#2A5A40');
    T(122, 238, 396, 2, '#2A5A40');
    T(122, 288, 396, 2, '#163326');
    /* front edge */
    T(38, 322, 564, 1, INK);
    T(38, 323, 564, 8, '#3A2414');
    T(38, 323, 564, 1, '#5A3418');
    T(38, 330, 564, 1, INK);
    g.globalAlpha = 0.5;
    T(38, 331, 564, 5, '#000000');
    g.globalAlpha = 1;
  }
  function backCard(g) {
    var x, y, w2;
    rr(g, 2, 0, 52, 76, '#0E1C30'); rr(g, 0, 2, 56, 72, '#0E1C30');
    rr(g, 2, 2, 52, 72, '#1E3A5F');
    rr(g, 4, 4, 48, 68, '#1E3A5F');
    for (y = 4; y < 72; y++) for (x = 4; x < 52; x++) {
      if (((x + y) & 7) === 0 || ((x - y + 80) & 7) === 0) rr(g, x, y, 1, 1, '#2E5A8F');
    }
    rr(g, 4, 4, 48, 1, '#0E1C30'); rr(g, 4, 71, 48, 1, '#0E1C30');
    rr(g, 4, 4, 1, 68, '#0E1C30'); rr(g, 51, 4, 1, 68, '#0E1C30');
    for (y = 0; y < 12; y++) {
      w2 = (Math.min(y, 11 - y) + 1) * 2;
      rr(g, 28 - (w2 >> 1), 32 + y, w2, 1, '#C8A040');
      if (y > 2 && y < 9) rr(g, 28 - (Math.min(y - 3, 8 - y) + 1), 32 + y, (Math.min(y - 3, 8 - y) + 1) * 2, 1, '#8A6A20');
    }
    rr(g, 26, 34, 2, 1, '#FFE080');
  }
  function faceArt(id) {
    return bake(CW, CH, function (g) {
      var icn = ICON[id], r, c, f = FILL[id] || FILL.DEFEND, x, y;
      rr(g, 0, 0, CW, CH, '#F0D8A8');
      rr(g, 0, 0, CW, 2, '#1A120C'); rr(g, 0, CH - 2, CW, 2, '#1A120C');
      rr(g, 0, 0, 2, CH, '#1A120C'); rr(g, CW - 2, 0, 2, CH, '#1A120C');
      rr(g, 2, 2, CW - 4, 1, '#FFF0D0'); rr(g, 2, 2, 1, CH - 4, '#FFF0D0');
      rr(g, CW - 4, 3, 2, CH - 6, '#D8BC88'); rr(g, 3, CH - 4, CW - 6, 2, '#D8BC88');
      rr(g, 2, 2, 2, 2, '#1A120C'); rr(g, CW - 4, 2, 2, 2, '#1A120C'); rr(g, 2, CH - 4, 2, 2, '#1A120C'); rr(g, CW - 4, CH - 4, 2, 2, '#1A120C');
      if (!icn) return;
      for (r = 0; r < icn.length; r++) for (c = 0; c < 5; c++) if (icn[r].charAt(c) === '1') {
        x = 16 + c * 8; y = 16 + r * 8;
        rr(g, x + 1, y + 1, 8, 8, '#C8AC78');
        rr(g, x, y, 8, 8, '#1A120C');
      }
      for (r = 0; r < icn.length; r++) for (c = 0; c < 5; c++) if (icn[r].charAt(c) === '1') {
        x = 16 + c * 8; y = 16 + r * 8;
        rr(g, x + 1, y + 1, 6, 6, f[0]);
        if (c < 4 && icn[r].charAt(c + 1) === '1') rr(g, x + 6, y + 1, 4, 6, f[0]);
        if (r < icn.length - 1 && icn[r + 1].charAt(c) === '1') rr(g, x + 1, y + 6, 6, 4, f[0]);
        if (c < 4 && r < icn.length - 1 && icn[r + 1].charAt(c + 1) === '1' && icn[r].charAt(c + 1) === '1' && icn[r + 1].charAt(c) === '1') rr(g, x + 6, y + 6, 4, 4, f[0]);
        if (r === 0 || icn[r - 1].charAt(c) !== '1') rr(g, x + 1, y + 1, 6, 1, f[1]);
        if (c === 0 || icn[r].charAt(c - 1) !== '1') rr(g, x + 1, y + 1, 1, 6, f[1]);
      }
    });
  }
  function build() {
    var i, ids = ['ATTACK', 'HEAL', 'DEFEND', 'PARRY'];
    if (art) return art;
    art = {
      back: bake(640, 480, backLayer),
      light: bake(400, 300, lightSprite),
      lamp: bake(16, 20, lampSprite),
      bust: bake(48, 64, bustSprite),
      table: bake(640, 140, tableLayer),
      cb: bake(56, 76, backCard),
      face: {}
    };
    for (i = 0; i < ids.length; i++) art.face[ids[i]] = faceArt(ids[i]);
    return art;
  }

  function drawFace(id, x, y, sel) {
    var a = build(), cv = a.face[id];
    x = Math.round(x); y = Math.round(y);
    ctx.globalAlpha = sel ? 0.4 : 0.3;
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + (sel ? 4 : 2), y + (sel ? 4 : 2), CW, CH);
    ctx.globalAlpha = 1;
    if (sel) {
      ctx.fillStyle = '#FFE080';
      ctx.fillRect(x - 2, y - 2, CW + 4, CH + 4);
    }
    if (cv) blit(cv, x, y);
    else { ctx.fillStyle = '#FF00FF'; ctx.fillRect(x, y, CW, CH); }
    ctx.fillStyle = '#1A120C';
    ctx.font = '32px "Determination Mono"';
    ctx.fillText(id === 'HEAL' ? '+3' : '3', x + 24, y + 78);
    ctx.font = '16px "Determination Mono"';
    ctx.fillText(id, x + 8, y + 96);
  }

  function freshGrain() {
    var g = [], i;
    for (i = 0; i < 36; i++) g.push({ x: (Math.random() * 640) | 0, y: (Math.random() * 480) | 0 });
    return g;
  }

  function text(s, x, y, size, col) {
    ctx.font = size + 'px "Determination Mono"';
    ctx.fillStyle = '#0A0604';
    ctx.fillText(s, x + 2, y + 2);
    ctx.fillStyle = col;
    ctx.fillText(s, x, y);
  }

  function draw() {
    var w, h, sway, cx, i, n, pos, f, t, x, y, shook, a, sel, k;
    if (!ctx || !state) return;
    w = canvas.width || 640;
    h = canvas.height || 480;
    ctx.imageSmoothingEnabled = false;
    shook = NEU.juice && NEU.juice.begin ? NEU.juice.begin(ctx, w, h) : false;
    a = build();
    ctx.fillStyle = '#100C08';
    ctx.fillRect(0, 0, w, h);
    sway = reduced() ? 0 : Math.round(Math.sin(state.clock / 800) * 14);
    cx = 248 + sway;
    blit(a.back, 0, 0);
    blit(a.bust, 248, 26 + (reduced() ? 0 : (Math.floor(state.clock / 1200) & 1)) * 2, 144, 192);
    blit(a.light, cx - 200, 42 - 150);
    ctx.fillStyle = '#C8B48A';
    ctx.fillRect(cx - 1, 0, 2, 24);
    blit(a.lamp, cx - 8, 24);
    /* live flame inside the baked cage: steps at under 3 Hz, holds still when calm */
    k = reduced() ? 0 : Math.floor(state.clock / 340) % 3;
    ctx.fillStyle = '#FFE080'; ctx.fillRect(cx - 5, 30, 10, 10);
    ctx.fillStyle = '#FFF6C0'; ctx.fillRect(cx - 1, 34 - k, 2, 4 + k);
    blit(a.table, 0, 200);
    for (i = 0; i < 4; i++) blit(a.cb, 214 + i * 68, 152);
    n = state.deck.length > 6 ? 6 : state.deck.length;
    for (i = 0; i < n; i++) {
      x = 16 + i; y = 156 - i;
      ctx.fillStyle = INK; ctx.fillRect(x - 1, y - 1, 42, 58);
      ctx.fillStyle = i & 1 ? '#C8B080' : '#F0D8A8'; ctx.fillRect(x, y, 40, 56);
    }
    if (n) {
      x = 16 + n - 1; y = 156 - (n - 1);
      ctx.fillStyle = '#0E1C30'; ctx.fillRect(x, y, 40, 56);
      ctx.fillStyle = '#1E3A5F'; ctx.fillRect(x + 2, y + 2, 36, 52);
      ctx.fillStyle = '#C8A040'; ctx.fillRect(x + 16, y + 24, 8, 8);
      ctx.fillStyle = '#8A6A20'; ctx.fillRect(x + 18, y + 26, 4, 4);
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
        drawFace(f.id, x, y, false);
      } else drawFace(state.you.hand[i], slotPos(i).x, slotPos(i).y, i === state.sel && !state.over);
    }
    if (state.slide && state.slide.t < state.slide.dur) {
      t = state.slide.t / state.slide.dur;
      drawFace(state.slide.id, qbez(300, 320, 284, t), qbez(360, 200, 236, t), false);
    }
    text(String(state.mage.hp), 48, 50, 32, '#F4EFE4');
    text(String(state.you.hp), 544, 50, 32, '#F4EFE4');
    text('MAGE', 48, 70, 16, '#C8B898');
    text('YOU', 544, 70, 16, '#C8B898');
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
