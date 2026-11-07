/* dungeon.js — dungeon levels and the one surface save (W3.2). */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var P = NEU.plat;
  if (!P || !P._kinds) return;
  var kinds = P._kinds;
  var currentId = '';
  var CLEAR = [[600, 'right']];

  function dungeonN(id) {
    var m = /^d(\d+)$/.exec(id || '');
    return m ? +m[1] : -1;
  }
  function put(rows, x, y, ch) {
    var r = rows[y];
    if (!r || x < 0 || x >= r.length) return;
    rows[y] = r.substring(0, x) + ch + r.substring(x + 1);
  }
  function build(n) {
    var W = 48, H = 16, rows = [], y, x, s, from;
    for (y = 0; y < H; y++) {
      s = '';
      for (x = 0; x < W; x++) s += '.';
      rows.push(s);
    }
    from = n === 0 ? 0 : 4;
    for (x = from; x <= 44; x++) put(rows, x, 11, '#');
    for (x = from; x < W; x++) { put(rows, x, 14, '#'); put(rows, x, 15, '#'); }
    if (n > 0) {
      for (x = 0; x <= 3; x++) put(rows, x, 13, '^');
      if (n >= 6) for (x = 0; x <= 3; x++) put(rows, x, 12, '^');
    }
    for (x = 8; x <= 40; x += 8) put(rows, x, 3, 'c');
    put(rows, 12, 4, 'b'); put(rows, 24, 4, 'b'); put(rows, 36, 4, 'b');
    put(rows, 18, 5, 'k'); put(rows, 32, 5, 'k');
    put(rows, 14, 4, 'w'); put(rows, 26, 4, 'w'); put(rows, 38, 3, 'w');
    for (x = 16; x <= 22 + n; x++) if (x <= 36) put(rows, x, 8, '=');
    if (n >= 3) { for (x = 10; x <= 40; x += 5) put(rows, x, 7, 'v'); }
    else put(rows, 20, 7, 'v');
    if (n === 0) {
      for (y = 6; y <= 8; y++) { put(rows, 18, y, '#'); put(rows, 24, y, '#'); }
      for (x = 18; x <= 24; x++) put(rows, x, 6, '#');
      put(rows, 21, 6, '.');
      put(rows, 16, 10, 'n');
    }
    return rows.join('\n');
  }
  function makeExit(n) {
    return function () { if (n < 10) openLevel('d' + (n + 1)); };
  }
  function ents(n) {
    var e = [], xs = [10, 12, 14, 16, 20, 22, 24, 30], i;
    if (n >= 7) xs = [10, 12, 13, 15, 17, 20, 22, 24, 30];
    for (i = 0; i < xs.length; i++) e.push({ t: 'coin', x: xs[i], y: 10 });
    e.push({ t: 'refill', x: 33, y: 10 });
    e.push({ t: 'crumble', x: 35, y: 10 });
    if (n > 0) e.push({ t: 'skull', x: 40, y: 4, x0: 40, y0: 4 });
    if (n === 0) {
      e.push({ t: 'checkpoint', x: 12, y: 11 });
      e.push({ t: 'sign', x: 16, y: 10, text: '* one way down. the surface is the only save.' });
      e.push({ t: 'painting', x: 6, y: 10 });
    }
    if (n === 5) e.push({ t: 'magegate', x: 28, y: 10 });
    if (n === 10) e.push({ t: 'bossdoor', x: 38, y: 10 });
    e.push({ t: 'exit', x: 42, y: 10 });
    return e;
  }

  kinds.skull = {
    touch: function (e, input, melee) {
      if (NEU.dungeon._replay) return;
      if (melee) {
        if (!e.dead) {
          e.dead = true;
          if (NEU.save && NEU.save.addCoins) NEU.save.addCoins(2);
        }
        return;
      }
      NEU.dungeon.lastDeath = 'skull';
      NEU.dungeon.pendingDeath = 'skull';
    },
    tick: function (e, dt) {
      if (e.x0 == null) e.x0 = e.x;
      if (e.y0 == null) e.y0 = e.y;
      e.t0 = (e.t0 || 0) + dt;
      e.x = e.x0 + Math.sin(e.t0 * 2) * 0.75;
      e.y = e.y0 + Math.sin(e.t0 * 1.3) * 0.28;
      NEU.dungeon.skullAt = { x: e.x, y: e.y };
    }
  };
  kinds.sign = {
    touch: function (e, input, melee) {
      if (!melee || NEU.dungeon._replay) return;
      NEU.dungeon.sign = e.text || '';
      if (NEU.talk) NEU.talk([NEU.dungeon.sign], 'narr');
    }
  };
  kinds.magegate = {
    touch: function (e, input, melee) {
      if (!melee || NEU.dungeon._replay) return;
      if (NEU.mage && typeof NEU.mage.open === 'function') {
        NEU.dungeon.mageSign = '';
        NEU.mage.open();
      } else {
        NEU.dungeon.mageSign = 'closed';
        if (NEU.talk) NEU.talk(['* closed'], 'narr');
      }
    }
  };
  /* Gilt frame, mountain inside. One interact opens the cart. */
  function drawPainting(c, x, y) {
    if (!c || !c.fillRect) return;
    try { c.imageSmoothingEnabled = false; } catch (e0) {}
    x = x | 0; y = y | 0;
    function R(px, py, w, h, col) {
      c.fillStyle = col;
      c.fillRect(x + px, y + py, w, h);
    }
    R(0, 0, 16, 16, '#8A6820');
    R(1, 1, 14, 14, '#E8C85A');
    R(2, 2, 12, 12, '#6A5018');
    R(3, 3, 10, 10, '#F4E0A0');
    R(4, 4, 8, 8, '#7EB0D8');
    R(4, 9, 8, 3, '#3A6A40');
    R(6, 6, 4, 5, '#5A7A68');
    R(7, 5, 2, 2, '#E8EEF2');
    R(1, 1, 2, 2, '#FFF4C8');
    R(13, 1, 2, 2, '#FFF4C8');
    R(1, 13, 2, 2, '#FFF4C8');
    R(13, 13, 2, 2, '#FFF4C8');
  }
  function stampPaintings() {
    var id = currentId, L, cv, c, dpr, w, h, scale, ox, oy, camX, camY, i, e;
    if (dungeonN(id) < 0 || !P.state) return;
    L = P.levels[id];
    if (!L || !L.entities) return;
    cv = document.getElementById('platCanvas');
    if (!cv || !cv.getContext) return;
    c = cv.getContext('2d');
    if (!c) return;
    dpr = window.devicePixelRatio || 1;
    w = (window.innerWidth || 640) * dpr;
    h = (window.innerHeight || 360) * dpr;
    scale = Math.min(w / 640, h / 360) || 1;
    ox = (w - 640 * scale) / 2;
    oy = (h - 360 * scale) / 2;
    if (P.cam) { camX = P.cam().x; camY = P.cam().y; }
    else {
      camX = Math.max(0, Math.min(P.state.x - 320, Math.max(0, L.w * 16 - 640)));
      camY = Math.max(0, Math.min(P.state.y - 180, Math.max(0, L.h * 16 - 360)));
    }
    if (c.save) c.save();
    if (c.setTransform) c.setTransform(scale, 0, 0, scale, ox, oy);
    try { c.imageSmoothingEnabled = false; } catch (e1) {}
    for (i = 0; i < L.entities.length; i++) {
      e = L.entities[i];
      if (e.t !== 'painting') continue;
      drawPainting(c, (e.x * 16 - camX) | 0, (e.y * 16 - camY) | 0);
    }
    if (c.restore) c.restore();
  }
  kinds.painting = {
    draw: function (c, px, py) { drawPainting(c, px, py); },
    touch: function (e, input, melee) {
      var cv;
      if (NEU.dungeon._replay) return;
      if (!melee) { e.held = false; return; }
      if (e.held) return;
      e.held = true;
      if (NEU.save && NEU.save.flag) NEU.save.flag('painting_found', 1);
      if (NEU.cart && typeof NEU.cart.open === 'function') NEU.cart.open();
      cv = document.getElementById('platCanvas');
      if (cv && NEU.juice && NEU.juice.shakeEl) NEU.juice.shakeEl(cv);
    }
  };
  kinds.bossdoor = {
    touch: function (e, input, melee) {
      if (!melee || e.dead || NEU.dungeon._replay) return;
      var has = NEU.save && NEU.save.has && NEU.save.has('boss_key');
      if (has) {
        e.dead = true;
        NEU.dungeon.bossOpen = true;
        P.close();
        if (NEU.polt && NEU.polt.open) NEU.polt.open();
      } else {
        NEU.dungeon.bossOpen = false;
        NEU.dungeon.bossLine = '* a bone lock. it wants a key.';
        if (NEU.talk) NEU.talk([NEU.dungeon.bossLine], 'narr');
      }
    }
  };

  var origOpen = P.open, origStep = P.step, origReplay = P.replay;

  function openLevel(id, opts) {
    var n = dungeonN(id), prev = currentId, ok;
    currentId = id;
    NEU.dungeon.lastDeath = null;
    NEU.dungeon.pendingDeath = null;
    if (n >= 0) {
      if (NEU.save && NEU.save.flag) NEU.save.flag('dgn_depth', n);
      if (n === 10) { NEU.dungeon.bossOpen = false; NEU.dungeon.bossLine = ''; }
      if (n === 5) NEU.dungeon.mageSign = '';
    }
    ok = origOpen(id, opts);
    if (!ok) { currentId = prev; return false; }
    if (n >= 0 && NEU.dungeonLook && NEU.dungeonLook.paint) NEU.dungeonLook.paint(P.levels[id]);
    return true;
  }
  function settle(s) {
    if (NEU.dungeon._replay) return s;
    if (dungeonN(currentId) > 0 && (NEU.dungeon.pendingDeath || (s && s.dead))) {
      NEU.dungeon.pendingDeath = null;
      openLevel('d0');
      return P.state || s;
    }
    return s;
  }

  NEU.dungeon = {
    recordings: {},
    bossOpen: false,
    bossLine: '',
    mageSign: '',
    sign: '',
    lastDeath: null,
    pendingDeath: null,
    skullAt: { x: 0, y: 0 },
    _replay: false,
    here: function () { return currentId; },
    spawnPx: function (id) {
      var L = P.levels[id];
      if (!L || !L.spawn) return null;
      return { x: (L.spawn.x + 0.5) * 16, y: (L.spawn.y + 1) * 16 };
    }
  };

  function makeLevel(n) {
    var id = 'd' + n;
    var def = P.level(id, {
      tiles: build(n),
      spawn: { x: n === 0 ? 12 : 8, y: 10 },
      entities: ents(n),
      tileset: 'dungeon',
      onExit: makeExit(n)
    });
    def.recording = CLEAR.slice();
    NEU.dungeon.recordings[id] = def.recording;
  }
  var n;
  for (n = 0; n <= 10; n++) makeLevel(n);

  P.open = openLevel;
  P.step = function (dt, raw) {
    NEU.dungeon.pendingDeath = null;
    return settle(origStep(dt, raw));
  };
  P.replay = function (id, rec) {
    var r;
    NEU.dungeon._replay = true;
    NEU.dungeon.pendingDeath = null;
    try { r = origReplay(id, rec); }
    finally { NEU.dungeon._replay = false; }
    return r;
  };
  if (NEU.kernel && NEU.kernel.scenes && NEU.kernel.scenes.plat && NEU.kernel.scenes.plat.tick) {
    var sc = NEU.kernel.scenes.plat;
    var origTick = sc.tick;
    sc.tick = function (dt) {
      NEU.dungeon.pendingDeath = null;
      origTick(dt);
      settle(P.state);
      if (dungeonN(currentId) >= 0) stampPaintings();
      if (NEU.dungeonLook && NEU.dungeonLook.flick && dungeonN(currentId) >= 0) NEU.dungeonLook.flick(dt);
    };
  }
})();
