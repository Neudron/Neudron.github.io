/* mountain.js — eight original screens on the plat kernel (W5.4). */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var P = NEU.plat;
  if (!P || !P.level) return;
  var W = 48, H = 18, currentId = '';

  var REC = {
    m0: [[29, 'right'], [49, 'jump right'], [1, 'right'], [17, 'jump right'], [1, 'right'], [13, 'jump right'], [28, 'right'], [49, 'jump right'], [1, 'right'], [11, 'jump right'], [38, 'right']],
    m1: [[172, 'right']],
    m2: [[71, 'right'], [101, ''], [46, 'right'], [49, 'jump right'], [1, 'right'], [17, 'jump right'], [1, 'right'], [3, 'jump right'], [38, 'right']],
    m3: [[124, 'right']],
    m4: [[64, 'right'], [1, 'dash right'], [117, 'right']],
    m5: [[16, 'right'], [1, 'jump right'], [7, 'right'], [17, 'right down melee'], [1, 'right'], [3, 'right down melee'], [56, 'right']],
    m6: [[1, ''], [1, 'dash up'], [21, ''], [1, 'right'], [1, ''], [1, 'right'], [1, ''], [26, 'right']],
    m7: [[119, 'right'], [49, 'jump right'], [1, 'right'], [17, 'jump right'], [1, 'right'], [3, 'jump right'], [27, 'right']]
  };

  function blank() {
    var rows = [], y, x, s;
    for (y = 0; y < H; y++) {
      s = '';
      for (x = 0; x < W; x++) s += '.';
      rows.push(s);
    }
    return rows;
  }
  function put(rows, x, y, ch) {
    if (y < 0 || y >= rows.length || x < 0 || x >= W) return;
    rows[y] = rows[y].substring(0, x) + ch + rows[y].substring(x + 1);
  }
  function fill(rows, x0, x1, y, ch) {
    var x;
    for (x = x0; x <= x1; x++) put(rows, x, y, ch);
  }
  function puff() {
    var s = P.state || { x: 0, y: 0 };
    if (!NEU.juice) return;
    if (NEU.juice.hit) NEU.juice.hit('medium');
    if (NEU.juice.burst) NEU.juice.burst(s.x, s.y - 16, 12, '#E8EEF2', 90);
  }
  function arrive(id) {
    if (!NEU.engine || !NEU.engine.rooms || NEU.engine.rooms.indexOf(id) < 0) return;
    if (NEU.engine.running && NEU.engine.warp) NEU.engine.warp(id, 'door');
    else if (NEU.engine.enter) NEU.engine.enter(id, 'door');
  }
  function summit() {
    if (NEU.save && NEU.save.flag) NEU.save.flag('mtn_summit', 1);
    puff();
    P.close();
    arrive('p1_tavern');
  }
  function makeExit(n) {
    return function () {
      if (NEU.save && NEU.save.flag) NEU.save.flag('mtn_' + n, 1);
      if (n >= 7) { summit(); return; }
      puff();
      P.open('m' + (n + 1));
    };
  }
  function add(id, rows, spawn, ents, n) {
    var def = P.level(id, {
      tiles: rows.join('\n'),
      spawn: spawn,
      entities: ents,
      tileset: 'mountain',
      onExit: makeExit(n)
    });
    var i;
    for (i = 0; i < def.entities.length; i++) if (def.entities[i].t === 'crumble') def.entities[i].solid = true;
    def.recording = REC[id];
    NEU.mountain.recordings[id] = REC[id];
    return def;
  }

  NEU.mountain = {
    recordings: {},
    active: false,
    mood: '',
    here: function () { return currentId; }
  };

  function build(n) {
    var rows = blank(), id = 'm' + n, ents, spawn;
    if (n === 0) {
      fill(rows, 0, 8, 12, '#');
      fill(rows, 9, 12, 13, '^');
      fill(rows, 9, 12, 14, '#');
      fill(rows, 13, 26, 12, '#');
      fill(rows, 27, 30, 13, '^');
      fill(rows, 27, 30, 14, '#');
      fill(rows, 31, 47, 12, '#');
      spawn = { x: 2, y: 11 };
      ents = [{ t: 'refill', x: 18, y: 11 }, { t: 'exit', x: 42, y: 11 }];
    } else if (n === 1) {
      fill(rows, 0, 15, 14, '#');
      fill(rows, 16, 18, 15, '^');
      fill(rows, 16, 18, 16, '#');
      fill(rows, 17, 42, 12, '#');
      spawn = { x: 3, y: 13 };
      ents = [{ t: 'spring', x: 15, y: 13 }, { t: 'exit', x: 36, y: 11 }];
    } else if (n === 2) {
      fill(rows, 0, 24, 14, '#');
      fill(rows, 25, 28, 15, '^');
      fill(rows, 25, 28, 16, '#');
      fill(rows, 29, 47, 14, '#');
      fill(rows, 16, 16, 9, 'v');
      spawn = { x: 2, y: 13 };
      ents = [{ t: 'zip', x: 16, y: 13, targetX: 16, targetY: 8 }, { t: 'exit', x: 42, y: 13 }];
    } else if (n === 3) {
      fill(rows, 0, 10, 14, '#');
      fill(rows, 14, 30, 14, '#');
      fill(rows, 11, 13, 15, '^');
      fill(rows, 11, 13, 16, '#');
      spawn = { x: 2, y: 13 };
      ents = [
        { t: 'crumble', x: 11, y: 14 }, { t: 'crumble', x: 12, y: 14 }, { t: 'crumble', x: 13, y: 14 },
        { t: 'exit', x: 26, y: 13 }
      ];
    } else if (n === 4) {
      fill(rows, 0, 47, 14, '#');
      fill(rows, 18, 18, 12, 'x');
      fill(rows, 18, 18, 13, 'x');
      spawn = { x: 2, y: 13 };
      ents = [{ t: 'exit', x: 40, y: 13 }];
    } else if (n === 5) {
      fill(rows, 0, 10, 14, '#');
      fill(rows, 11, 14, 15, '^');
      fill(rows, 11, 30, 13, '#');
      spawn = { x: 4, y: 13 };
      ents = [{ t: 'pogo', x: 8, y: 13 }, { t: 'exit', x: 24, y: 12 }];
    } else if (n === 6) {
      fill(rows, 4, 10, 16, '#');
      fill(rows, 0, 3, 16, '^');
      fill(rows, 11, 20, 16, '^');
      fill(rows, 0, 20, 17, '#');
      fill(rows, 2, 14, 11, '=');
      spawn = { x: 6, y: 15 };
      ents = [{ t: 'refill', x: 8, y: 10 }, { t: 'exit', x: 12, y: 10 }];
    } else {
      fill(rows, 0, 15, 14, '#');
      fill(rows, 16, 18, 15, '^');
      fill(rows, 16, 18, 16, '#');
      fill(rows, 17, 26, 12, '#');
      fill(rows, 27, 30, 13, '^');
      fill(rows, 27, 30, 14, '#');
      fill(rows, 31, 46, 12, '#');
      spawn = { x: 3, y: 13 };
      ents = [{ t: 'spring', x: 15, y: 13 }, { t: 'exit', x: 42, y: 11 }];
    }
    add(id, rows, spawn, ents, n);
  }

  var n;
  for (n = 0; n <= 7; n++) build(n);

  /* Heaven is gold and cloud. Evil is crimson and ash. Four screens each. */
  var HEAVEN = { floor: '#E2B84A', hi: '#FFF6DE', cloud: '#F7FBFF', ash: '#F7FBFF' };
  var EVIL = { floor: '#7A1020', hi: '#E8D8D4', cloud: '#1A1214', ash: '#3A3A3A' };
  var lastCanvas = null;
  if (document && document.createElement) {
    var origCreate = document.createElement;
    document.createElement = function (tag) {
      var el = origCreate.call(document, tag);
      if (el && String(tag).toLowerCase() === 'canvas') lastCanvas = el;
      return el;
    };
  }
  function paintMood(level, mood) {
    var cv = lastCanvas, c = cv && cv.getContext ? cv.getContext('2d') : null;
    var pal = mood === 'evil' ? EVIL : HEAVEN, y, x, row, ch, px, py;
    if (!c || !level || !level.grid) return;
    try { c.imageSmoothingEnabled = false; } catch (e0) {}
    for (y = 0; y < level.h; y++) {
      row = level.grid[y] || '';
      for (x = 0; x < level.w; x++) {
        ch = x < row.length ? row.charAt(x) : '.';
        px = x * 16; py = y * 16;
        if (ch === '#' || ch === '=') {
          c.fillStyle = ch === '=' ? pal.cloud : pal.floor;
          c.fillRect(px, py, 16, ch === '=' ? 4 : 16);
          c.fillStyle = pal.hi;
          c.fillRect(px, py, 16, 2);
        } else if (ch !== '.' && ch !== ' ') {
          c.fillStyle = '#FF00FF';
          c.fillRect(px, py, 16, 16);
        }
      }
    }
  }
  function sky(c, camX, camY, mood) {
    var pal = mood === 'evil' ? ['#14080C', '#3A1018', '#6A2030'] : ['#F8E7A8', '#F4D0E8', '#E7F2FF'];
    var i, top = camY | 0, left = camX | 0;
    try { c.imageSmoothingEnabled = false; } catch (e1) {}
    for (i = 0; i < pal.length; i++) {
      c.fillStyle = pal[i];
      c.fillRect(left, top + i * 120, 640, 120);
    }
    c.fillStyle = mood === 'evil' ? EVIL.ash : HEAVEN.cloud;
    c.fillRect(left + 40, top + 36, 48, 16);
    c.fillRect(left + 220, top + 64, 64, 16);
  }
  function hookSky() {
    var canvas = document.getElementById('platCanvas');
    var ctx, orig;
    if (!canvas || !canvas.getContext) return;
    ctx = canvas.getContext('2d');
    if (!ctx || !ctx.drawImage || ctx._des) return;
    orig = ctx.drawImage;
    ctx.drawImage = function (img, dx, dy) {
      var camX = -(dx || 0), camY = -(dy || 0), r;
      if (NEU.mountain.mood) sky(this, camX, camY, NEU.mountain.mood);
      r = orig.apply(this, arguments);
      return r;
    };
    ctx._des = 1;
  }
  function backToTavern(which) {
    NEU.mountain.mood = '';
    if (NEU.save && NEU.save.flag) NEU.save.flag(which, 1);
    puff();
    P.close();
    arrive('p1_tavern');
  }
  function descentExit(prefix, i) {
    return function () {
      if (NEU.save && NEU.save.flag) NEU.save.flag('mtn_' + prefix + i, 1);
      if (i >= 3) { backToTavern(prefix === 'h' ? 'mtn_heaven' : 'mtn_evil'); return; }
      puff();
      P.open(prefix + (i + 1));
    };
  }
  function descent(prefix, i, evil) {
    var rows = blank(), id = prefix + i, ents, spawn, rec, def;
    fill(rows, 0, 47, 14, '#');
    if (!evil) { fill(rows, 6, 12, 6, '='); fill(rows, 28, 34, 5, '='); }
    spawn = { x: 2, y: 13 };
    ents = [{ t: 'exit', x: 34 + (i % 2), y: 13 }];
    rec = [[240, 'right']];
    def = P.level(id, {
      tiles: rows.join('\n'),
      spawn: spawn,
      entities: ents,
      tileset: 'mountain',
      onExit: descentExit(prefix, i)
    });
    def.recording = rec;
    NEU.mountain.recordings[id] = rec;
  }
  for (n = 0; n <= 3; n++) { descent('h', n, false); descent('v', n, true); }
  hookSky();

  var origOpen = P.open, origReplay = P.replay;
  P.open = function (id, opts) {
    var ascent = !!P.levels[id] && /^m[0-7]$/.test(id);
    var drop = !!P.levels[id] && /^[hv][0-3]$/.test(id);
    var ok;
    NEU.mountain.mood = drop ? (id.charAt(0) === 'v' ? 'evil' : 'heaven') : '';
    ok = origOpen(id, opts);
    NEU.mountain.active = !!(ok && ascent);
    if (ascent || drop) {
      currentId = id;
      if (ascent && NEU.mountainLook && NEU.mountainLook.paint) NEU.mountainLook.paint(P.levels[id]);
      if (drop) paintMood(P.levels[id], NEU.mountain.mood);
    } else if (ok) currentId = '';
    return ok;
  };
  P.replay = function (id, rec) {
    var prev = NEU.mountain.active, mood = NEU.mountain.mood, r;
    r = origReplay(id, rec);
    NEU.mountain.active = prev;
    NEU.mountain.mood = mood;
    return r;
  };
  if (NEU.kernel && NEU.kernel.scenes && NEU.kernel.scenes.plat && NEU.kernel.scenes.plat.tick) {
    var sc = NEU.kernel.scenes.plat, origTick = sc.tick;
    sc.tick = function (dt) {
      if (NEU.mountain.active && NEU.juice && NEU.juice.frozen && NEU.juice.frozen()) return;
      origTick(dt);
      if (NEU.mountain.active && NEU.mountainLook && NEU.mountainLook.stepWind) NEU.mountainLook.stepWind(dt);
    };
  }
})();
