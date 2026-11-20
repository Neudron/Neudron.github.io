/* cards.js — the Mage's card duel. First person, his table, your shelf. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var wrap = document.getElementById('cards');
  var canvas = wrap ? (wrap.querySelector('canvas') || document.getElementById('cardsCanvas')) : null;
  var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  var active = false;
  var state = null;
  var losePending = null;
  var CW = 72;
  var CH = 104;

  var SPEC = [['ATTACK', 6], ['HEAL', 4], ['DEFEND', 3], ['PARRY', 3]];
  /* PLAN 9.4: no shuffle. Both orders are written data, guarded by the
     solver in fixes522 (a reacting line wins, all-in ATTACK loses) and
     fixes587 (never-ATTACK also loses). */
  var PLAYER_DECK = ['ATTACK', 'PARRY', 'ATTACK', 'ATTACK', 'HEAL', 'PARRY', 'DEFEND', 'ATTACK',
    'HEAL', 'ATTACK', 'HEAL', 'PARRY', 'DEFEND', 'HEAL', 'ATTACK', 'DEFEND'];
  var MAGE_DECK = ['ATTACK', 'ATTACK', 'HEAL', 'PARRY', 'HEAL', 'HEAL', 'DEFEND', 'ATTACK',
    'HEAL', 'ATTACK', 'ATTACK', 'DEFEND', 'PARRY', 'DEFEND', 'PARRY', 'ATTACK'];
  var ANIM = { lift: 150, flip: 200, travel: 250, effect: 300, discard: 150, hp: 60, retreat: 400 };
  var ICON = {
    ATTACK: ['00100', '00100', '00100', '11111', '00100'],
    HEAL: ['00100', '00100', '11111', '00100', '00100'],
    DEFEND: ['01110', '11111', '11111', '11111', '01110'],
    PARRY: ['00100', '01100', '11111', '00110', '00100']
  };
  /* The one written copy of each rule, reused by the hand and the intent. */
  var RULES = {
    ATTACK: 'deal 3. +1 for each attack in a row.',
    HEAL: 'restore 3.',
    DEFEND: 'block 3 until your next turn.',
    PARRY: 'turn his next attack back on him. wasted if he does not attack.'
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
      you: { hp: 15, hand: [], block: 0, blockShown: 0, parry: false, streak: 0 },
      mage: { hp: 15, hand: [], block: 0, blockShown: 0, parry: false },
      deck: [], mageDeck: [], discard: [],
      sel: 0, over: false, result: null, awarded: false,
      clock: 0, flies: [], slide: null, grain: [], grainAt: -1000,
      disp: { you: 15, mage: 15 }, fx: [], intent: null,
      legacy: false,
      exiting: false, exitT: 0, returned: false, endT: 0
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

  function attackDamage(who) {
    return who === 'you' ? Math.min(3 + state.you.streak, 5) : 3;
  }

  /* Fixed priority over public state: each rule fires only when its card is
     in hand, then the next rule gets its turn. */
  function mageIndex() {
    var h = state.mage.hand, i, through, dmg;
    dmg = attackDamage('mage');
    through = state.you.block >= dmg ? 0 : dmg - state.you.block;
    if (!state.you.parry && state.you.hp - through <= 0) {
      i = h.indexOf('ATTACK'); if (i >= 0) return i;
    }
    if (state.mage.hp <= 6) { i = h.indexOf('HEAL'); if (i >= 0) return i; }
    if (state.you.streak >= 2) { i = h.indexOf('PARRY'); if (i >= 0) return i; }
    if (state.you.streak === 1 && state.mage.hp <= 9) {
      i = h.indexOf('DEFEND'); if (i >= 0) return i;
    }
    i = h.indexOf('ATTACK');
    if (i >= 0) return i;
    return h.length ? 0 : -1;
  }

  /* The mage's next card is locked at the START of each turn and shown
     face-up — intent is information, not a surprise (PLAN 9.4). */
  function beginTurn() {
    var mi;
    if (!state || state.over) return;
    mi = mageIndex();
    state.intent = mi >= 0 ? { id: state.mage.hand[mi], index: mi } : null;
  }

  /* Visual-only card timeline. State resolves synchronously so every old
     caller stays correct; the fx queue is what the eye follows. */
  function queueFx(id, who) {
    if (!id || reduced()) return;
    state.fx.push({ id: id, who: who, t: 0 });
    if (state.fx.length > 2) state.fx.shift();
  }

  /* HP plates count toward the real value at 60 ms a point. */
  function stepDisp(dt) {
    var i, k, d;
    for (i = 0; i < 2; i++) {
      k = i ? 'mage' : 'you';
      d = state[k].hp - state.disp[k];
      if (d > 0) state.disp[k] = Math.min(state[k].hp, state.disp[k] + dt / ANIM.hp);
      else if (d < 0) state.disp[k] = Math.max(state[k].hp, state.disp[k] - dt / ANIM.hp);
      if (reduced()) state.disp[k] = state[k].hp;
    }
  }

  function act(who, idx) {
    var p, id, enemy, dmg, tier, reflected;
    if (!state || state.over) return false;
    p = state[who];
    if (idx < 0 || idx >= p.hand.length) return false;
    id = p.hand.splice(idx, 1)[0];
    enemy = state[who === 'you' ? 'mage' : 'you'];
    reflected = false;
    if (id !== 'ATTACK' && enemy.parry) enemy.parry = false;
    if (id === 'ATTACK') {
      dmg = attackDamage(who);
      if (enemy.parry) { enemy.parry = false; reflected = true; hurt(p, dmg); }
      else hurt(enemy, dmg);
      if (who === 'you') state.you.streak = Math.min(state.you.streak + 1, 3);
    } else if (id === 'HEAL') {
      p.hp = p.hp + 3;
      if (p.hp > 15) p.hp = 15;
      if (who === 'you') state.you.streak = 0;
    } else if (id === 'DEFEND') {
      p.block = 3;
      p.blockShown = 3;
      if (who === 'you') state.you.streak = 0;
    } else if (id === 'PARRY') {
      p.parry = true;
      if (who === 'you') state.you.streak = 0;
    }
    state.discard.push(id);
    if (who === 'you' && !reduced()) state.slide = { id: id, t: 0, dur: 280 };
    /* small for quiet cards, medium for a normal ATTACK, large only for a
       killing blow or a parry that actually turns a blow back. */
    tier = 'small';
    if (id === 'ATTACK') {
      tier = 'medium';
      if (reflected || p.hp <= 0 || enemy.hp <= 0) tier = 'large';
    }
    if (NEU.juice && NEU.juice.hit) NEU.juice.hit(tier);
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

  /* a lost duel is a dungeon death: you wake at the surface save */
  function dungeonDeath() {
    if (NEU.dungeon && NEU.dungeon.toSurface) NEU.dungeon.toSurface();
  }

  /* The board is held, then the surface teleport fires. A new duel or a
     direct close cannot swallow the pending death: it pays exactly once. */
  function finishLose(s) {
    if (!losePending || losePending.s !== s) return;
    losePending = null;
    if (state === s && active) close();
    dungeonDeath();
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
    var intent, youCard, mageCard, mi, wasOver, s, done;
    if (!state || losePending) return state;
    wasOver = state.over;
    /* Keep the played block visible for this frame; it expires at the
       start of its owner's next turn (below). */
    state.you.blockShown = 0;
    state.mage.blockShown = 0;
    if (!state.over) {
      intent = state.intent;
      youCard = state.you.hand[idx];
      mageCard = intent ? intent.id : null;
      act('you', idx);
      if (!state.over) {
        /* his last block guarded your turn; it expires as his turn starts */
        state.mage.block = 0;
        mi = intent && intent.index < state.mage.hand.length &&
             state.mage.hand[intent.index] === intent.id ? intent.index : mageIndex();
        if (mi >= 0) { mageCard = state.mage.hand[mi]; act('mage', mi); }
        else mageCard = null;
        /* your block guarded his turn; it expires as your next turn starts */
        state.you.block = 0;
      } else mageCard = null;
      settle();
      queueFx(youCard, 'you');
      if (mageCard) queueFx(mageCard, 'mage');
      if (!state.over) beginTurn();
    }
    if (state.result === 'win') grant();
    if (state.result === 'lose') {
      if (wasOver || state.legacy || reduced()) { close(); dungeonDeath(); }
      else if (!losePending) {
        draw();
        s = state;
        losePending = { s: s };
        done = function () { finishLose(s); };
        if (NEU.kernel && NEU.kernel.after) NEU.kernel.after(1200, done);
        else setTimeout(done, 1200);
      }
    } else draw();
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
    if (losePending) { losePending = null; dungeonDeath(); }
    opts = opts || {};
    rng = opts.rng;
    if (!rng && opts.seed != null && NEU.rand && NEU.rand.seeded) rng = NEU.rand.seeded(opts.seed);
    if (!rng) rng = Math.random;
    state = blank();
    /* Shipped game: fixed orders. An explicit rng/seed is kept only as a
       compatibility adapter for the older scripted suites. */
    if (opts.rng || opts.seed != null) {
      state.legacy = true;
      state.deck = shuffle(buildDeck(), rng);
      state.mageDeck = shuffle(buildDeck(), rng);
    } else {
      state.deck = PLAYER_DECK.slice();
      state.mageDeck = MAGE_DECK.slice();
    }
    drawUp('you');
    drawUp('mage');
    beginTurn();
    active = true;
    if (wrap) wrap.hidden = false;
    if (canvas) { canvas.width = 640; canvas.height = 480; }
    stackPush();
    NEU.activeMinigame = 'cards';       /* the room underneath must not move; act4.js claims stack hands back plat */
    draw();
  }

  /* PLAN 9.4: a won duel hands the dungeon back with 1.5 s of player
     invulnerability and a 1 s foe-stun window, through the small shared
     hook in dungeon.js. The visual return itself lasts 400 ms. */
  function returnCalm() {
    if (NEU.dungeon && NEU.dungeon.calm) NEU.dungeon.calm(1.5, 1);
  }

  function finishClose() {
    active = false;
    if (wrap) wrap.hidden = true;
    stackPop();
    if (NEU.activeMinigame === 'cards') NEU.activeMinigame = null;
  }

  function close() {
    if (losePending) { losePending = null; dungeonDeath(); }
    if (!active) return;
    if (state && state.result === 'win' && !state.returned) {
      state.returned = true;
      returnCalm();
      if (!reduced()) { state.exiting = true; state.exitT = 0; return; }
    }
    finishClose();
  }

  function tick(dt) {
    var i;
    if (!active || !state) return;
    if (dt !== dt || dt < 0) dt = 0;
    if (!reduced()) state.clock += dt;
    stepDisp(dt);
    if (state.over) state.endT += dt;
    if (state.exiting) {
      state.exitT += dt;
      if (state.exitT >= ANIM.retreat) { state.exiting = false; finishClose(); return; }
    }
    if (state.slide) {
      state.slide.t += dt;
      if (state.slide.t >= state.slide.dur) state.slide = null;
    }
    for (i = state.fx.length - 1; i >= 0; i--) {
      state.fx[i].t += dt;
      if (state.fx[i].t >= ANIM.lift + ANIM.flip + ANIM.travel + ANIM.effect + ANIM.discard) state.fx.splice(i, 1);
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
    /* Deterministic grain: the whole duel must survive a throwing
       Math.random (PLAN 9.4 proof). */
    for (i = 0; i < 36; i++) g.push({ x: (hs(i, 1, 11) * 640) | 0, y: (hs(i, 2, 11) * 480) | 0 });
    return g;
  }

  function text(s, x, y, size, col) {
    ctx.font = size + 'px "Determination Mono"';
    ctx.fillStyle = '#0A0604';
    ctx.fillText(s, x + 2, y + 2);
    ctx.fillStyle = col;
    ctx.fillText(s, x, y);
  }

  /* Keep a long rule on screen by sliding it left, never shrinking the 16px
     game font (the pixel grid is the constraint, not the string length). */
  function ruleLine(line, x, y, col) {
    var w;
    if (!line) return;
    ctx.font = '16px "Determination Mono"';
    if (ctx.measureText) {
      w = ctx.measureText(line).width;
      if (w) x = Math.min(x, 640 - w - 8);
    }
    text(line, x < 8 ? 8 : x, y, 16, col);
  }

  /* A small face-up card used by the draw forecast and the mage's intent. */
  function miniCard(id, x, y, w, h, gold) {
    var f = FILL[id] || FILL.DEFEND;
    ctx.fillStyle = INK; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = gold ? '#FFE080' : '#F0D8A8'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = f[0]; ctx.fillRect(x + 4, y + 4, w - 8, h - 18);
    ctx.fillStyle = f[1]; ctx.fillRect(x + 4, y + 4, w - 8, 2);
    ctx.font = '16px "Determination Mono"';
    ctx.fillStyle = '#1A120C'; ctx.fillText(id, x + 3, y + h - 3, w - 6);
  }

  /* Visual timeline for a played card: lift, flip, travel, effect, discard.
     State already resolved; this is only what the eye follows. */
  function drawFx(fx) {
    var L = ANIM.lift, F = L + ANIM.flip, T = F + ANIM.travel,
        E = T + ANIM.effect, D = E + ANIM.discard, t = fx.t, x, y, id;
    if (t >= D) return;
    id = fx.id;
    if (t < L) { x = 300; y = 356 - (t / L) * 24; }
    else if (t < F) { x = 300; y = 332; ctx.globalAlpha = Math.abs((t - F / 2 - L) / (ANIM.flip / 2)); }
    else if (t < T) {
      x = 300 + ((fx.who === 'mage' ? 40 : -40) * ((t - F) / ANIM.travel));
      y = 332 - 120 * ((t - F) / ANIM.travel);
    } else if (t < E) { x = fx.who === 'mage' ? 100 : 540; y = 60; }
    else { x = fx.who === 'mage' ? 100 : 540; y = 60 + ((t - E) / ANIM.discard) * 60; ctx.globalAlpha = 1 - (t - E) / ANIM.discard; }
    drawFace(id, x - CW / 2, y - CH / 2, false);
    ctx.globalAlpha = 1;
    if (t >= T && t < E) {
      var col = id === 'HEAL' ? '#4AB880' : id === 'DEFEND' ? '#C8A040' :
                id === 'PARRY' ? '#4A82C0' : '#C84A4A';
      ctx.fillStyle = col;
      ctx.fillRect((fx.who === 'mage' ? 66 : 520), 30 + (((t - T) / ANIM.effect) * 30 | 0), 60, 4);
    }
  }

  function drawEnd() {
    var e = state.endT | 0, i, x, y;
    if (state.result === 'win') {
      /* hat tips, cards scatter, and the key + spell slide across */
      for (i = 0; i < 4; i++) {
        x = 214 + i * 68 + ((i & 1) ? 1 : -1) * ((e / 8) | 0);
        y = 152 + ((e / 6) | 0) + i * 3;
        drawFace(state.mageDeck.length ? state.mageDeck[i % state.mageDeck.length] : 'ATTACK', x, y, false);
      }
      x = Math.min(320, 120 + e);
      ctx.fillStyle = '#C8A040'; ctx.fillRect(x, 250, 22, 8);
      ctx.fillStyle = '#B892FF'; ctx.fillRect(x + 28, 250, 14, 8);
      text('YOU WIN', 250, 210, 32, '#FFE080');
    } else if (state.result === 'lose') {
      ctx.fillStyle = 'rgba(0,0,0,' + Math.min(0.85, e / 700) + ')';
      ctx.fillRect(0, 0, 640, 480);
      text('THE LAMP GOES OUT', 180, 220, 32, '#C8B898');
    }
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
    /* the two cards you will draw next, face up on the shelf */
    for (i = 0; i < 2; i++) {
      if (state.deck.length - 1 - i < 0) break;
      miniCard(state.deck[state.deck.length - 1 - i], 16 + i * 52, 176, 30, 44, false);
    }
    text('NEXT', 16, 168, 16, '#C8B898');
    /* the mage's locked intent, lifted out of his face-down hand */
    if (state.intent && !state.over) {
      miniCard(state.intent.id, 124, 120, 48, 68, true);
      text('HE WILL PLAY', 118, 112, 16, '#FFE080');
      ruleLine(RULES[state.intent.id], 124, 272, '#FFE080');
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
    if (!state.over && state.you.hand[state.sel]) {
      ruleLine(RULES[state.you.hand[state.sel]], 196 + state.sel * 86, 476, '#F0D8A8');
    }
    if (state.slide && state.slide.t < state.slide.dur) {
      t = state.slide.t / state.slide.dur;
      drawFace(state.slide.id, qbez(300, 320, 284, t), qbez(360, 200, 236, t), false);
    }
    for (i = 0; i < state.fx.length; i++) drawFx(state.fx[i]);
    text(String(Math.round(state.disp.mage)), 48, 50, 32, '#F4EFE4');
    text(String(Math.round(state.disp.you)), 544, 50, 32, '#F4EFE4');
    text('MAGE', 48, 70, 16, '#C8B898');
    text('YOU', 544, 70, 16, '#C8B898');
    /* status icons and the pre-absorb block value sit under each HP plate */
    if (state.mage.blockShown > 0) {
      icon(ctx, ICON.DEFEND, { '1': '#C8A040' }, 48, 84);
      text('BLK' + state.mage.blockShown, 68, 94, 16, '#C8A040');
    }
    if (state.mage.parry) {
      icon(ctx, ICON.PARRY, { '1': '#4A82C0' }, 48, 84);
      text('PARRY', 68, 94, 16, '#4A82C0');
    }
    if (state.you.blockShown > 0) {
      icon(ctx, ICON.DEFEND, { '1': '#C8A040' }, 544, 84);
      text('BLK' + state.you.blockShown, 564, 94, 16, '#C8A040');
    }
    if (state.you.parry) {
      icon(ctx, ICON.PARRY, { '1': '#4A82C0' }, 544, 84);
      text('PARRY', 564, 94, 16, '#4A82C0');
    }
    /* up to three streak pips under the player plate */
    for (i = 0; i < 3; i++) {
      ctx.fillStyle = INK; ctx.fillRect(543 + i * 12, 110, 10, 10);
      ctx.fillStyle = i < state.you.streak ? '#C8A040' : '#2A1C12';
      ctx.fillRect(545 + i * 12, 112, 6, 6);
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
    if (state.over) drawEnd();
    if (state.exiting) {
      ctx.globalAlpha = Math.min(1, state.exitT / ANIM.retreat);
      ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      if (!reduced()) text('RETURNING TO THE DUNGEON', 180, 230, 16, '#C8B898');
    }
  }

  /* The topmost overlay owns the keyboard. Settings sits above the duel
     (gear button, Ctrl+Shift+,), and the main menu / practice room sit
     above it too. Without this guard, Right moved the card cursor and
     Escape closed the duel BEHIND an open settings panel. Returning
     early lets the higher overlay's own listener handle the key. */
  function covered() {
    return !!(NEU.settings && NEU.settings.open_) ||
           !!(NEU.menu && NEU.menu.active) ||
           !!(NEU.dummy && NEU.dummy.active);
  }

  function onKey(e) {
    var k, n, r;
    if (!active || !state || covered()) return;
    if (losePending) return;
    if (NEU.kernel && NEU.kernel.current() !== 'cards') return;
    /* Tab is not a duel action. Swallow it so quest.js cannot open the
       objectives panel over a live hand of cards. */
    if (e.key === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); return; }
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
    ANIM: ANIM,
    RULES: RULES,
    rule: function (id) { return RULES[id]; },
    decks: function () { return { you: PLAYER_DECK.slice(), mage: MAGE_DECK.slice() }; },
    intent: function () { return state ? state.intent : null; },
    mageIndex: function () { return mageIndex(); },
    shelf: function () {
      if (!state) return [];
      return [state.deck[state.deck.length - 1], state.deck[state.deck.length - 2]]
        .filter(function (id) { return !!id; });
    },
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
