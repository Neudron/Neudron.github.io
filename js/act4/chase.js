/* chase.js — Draedon on the village grid after the nuke.
   The kind is registered here. engine-kinds.js stays untouched.
   The kernel ticks the engine scene; this file hangs the chase
   off that tick. There is no second animation frame. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var SPEED = 72;
  var PERIOD = 400;
  var catching = false;

  function calm() {
    if (NEU.motion && NEU.motion.reduced) return !!NEU.motion.reduced();
    try { return !!matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function figureMet() {
    return !!(NEU.save && NEU.save.flagged && NEU.save.flagged('s_figure'));
  }
  function lockdown() {
    if (!NEU.save || !NEU.save.flagged) return false;
    if (figureMet()) {
      if (NEU.chase) NEU.chase.over = true;
      return false;
    }
    return !!(NEU.save.flagged('s_lockdown') || NEU.save.flagged('draedon_won'));
  }
  function openTile(room, x, y) {
    var ts, solid, row;
    if (!room || y < 0 || x < 0 || y >= room.h) return false;
    row = room.grid[y];
    if (!row || x >= row.length) return false;
    ts = NEU.engine && NEU.engine.tilesets ? NEU.engine.tilesets()[room.tileset] : null;
    solid = (ts && ts.solid) || '#';
    return solid.indexOf(row.charAt(x)) < 0;
  }
  function farCell(room) {
    var spawns = [], k, s, best, bestD, y, x, i, d, md;
    for (k in room.spawns || {}) {
      s = room.spawns[k];
      if (s && typeof s.x === 'number') spawns.push(s);
    }
    best = { x: 1, y: 1 };
    bestD = -1;
    for (y = 0; y < room.h; y++) {
      for (x = 0; x < room.w; x++) {
        if (!openTile(room, x, y)) continue;
        md = spawns.length ? 999 : 0;
        for (i = 0; i < spawns.length; i++) {
          d = Math.abs(x - spawns[i].x) + Math.abs(y - spawns[i].y);
          if (d < md) md = d;
        }
        if (md > bestD) { bestD = md; best = { x: x, y: y }; }
      }
    }
    return best;
  }
  function playerCell() {
    var p, T;
    if (!NEU.engine || !NEU.engine.api) return { x: 0, y: 0 };
    p = NEU.engine.api.player;
    T = NEU.engine.TILE || 16;
    return { x: Math.floor(p.x / T), y: Math.floor((p.y - 1) / T) };
  }
  function blocked(room, x, y) {
    return !openTile(room, x, y);
  }
  /* First step of a BFS from the chaser to the player. */
  function nextCell(room, sx, sy, gx, gy) {
    var q, seen, prev, head, dirs, d, cur, nx, ny, key, pk, parts, cx, cy;
    if (sx === gx && sy === gy) return { x: sx, y: sy };
    q = [{ x: sx, y: sy }];
    seen = {};
    prev = {};
    seen[sx + ',' + sy] = 1;
    head = 0;
    dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (head < q.length) {
      cur = q[head++];
      for (d = 0; d < 4; d++) {
        nx = cur.x + dirs[d][0];
        ny = cur.y + dirs[d][1];
        key = nx + ',' + ny;
        if (seen[key] || blocked(room, nx, ny)) continue;
        seen[key] = 1;
        prev[key] = cur.x + ',' + cur.y;
        if (nx === gx && ny === gy) {
          cx = nx;
          cy = ny;
          while (prev[cx + ',' + cy]) {
            pk = prev[cx + ',' + cy];
            parts = pk.split(',');
            if (+parts[0] === sx && +parts[1] === sy) return { x: cx, y: cy };
            cx = +parts[0];
            cy = +parts[1];
          }
          return { x: nx, y: ny };
        }
        q.push({ x: nx, y: ny });
      }
    }
    return null;
  }
  function syncDom() {
    var id, on, el;
    id = NEU.engine && NEU.engine.room;
    on = lockdown() && !NEU.chase.over && id && id.charAt(0) === 's';
    el = document.getElementById('sAlarm');
    if (!on) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      return;
    }
    if (el) return;
    el = document.createElement('div');
    el.id = 'sAlarm';
    el.className = 's-alarm';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
  }
  function arrive() {
    var ents, i, el;
    if (NEU.chase.over) return;
    NEU.chase.over = true;
    if (NEU.save) NEU.save.flag('s_figure', 1);
    ents = (NEU.engine && NEU.engine.api) ? NEU.engine.api.ents() : [];
    for (i = 0; i < ents.length; i++) if (ents[i].t === 'chaser') ents[i].dead = true;
    el = document.getElementById('sAlarm');
    if (el && el.parentNode) el.parentNode.removeChild(el);
    if (NEU.juice && NEU.juice.hit) NEU.juice.hit('medium');
    if (NEU.finale && NEU.finale.open) NEU.finale.open();
    if (NEU.talk) NEU.talk(['a hood. no face. the thing behind you stops.'], 'narr');
  }
  function caught() {
    var w;
    if (catching) return;
    catching = true;
    NEU.chase.catches += 1;
    if (NEU.juice && NEU.juice.hit) NEU.juice.hit('small');
    w = NEU.engine.where();
    if (w) NEU.engine.warp(w.room, w.spawn);
    catching = false;
  }
  function step(dt) {
    var sec, room, ents, ch, goal, fig, i, need, nxt;
    syncDom();
    if (!lockdown() || NEU.chase.over) return;
    if (!NEU.engine || !NEU.engine.api || !NEU.engine.room || NEU.engine.room.charAt(0) !== 's') return;
    sec = typeof dt === 'number' ? dt : 0;
    if (sec > 2) sec = sec / 1000;
    if (!(sec > 0)) return;
    if (sec > 0.25) sec = 0.25;
    room = NEU.engine.api.room;
    ents = NEU.engine.api.ents();
    goal = playerCell();
    for (i = 0; i < ents.length; i++) if (ents[i].figure && ents[i].x === goal.x && ents[i].y === goal.y) fig = ents[i];
    if (fig) { arrive(); return; }
    ch = null;
    for (i = 0; i < ents.length; i++) if (ents[i].t === 'chaser' && !ents[i].dead) ch = ents[i];
    if (!ch) return;
    if (ch.x === goal.x && ch.y === goal.y) { caught(); return; }
    ch.acc = (ch.acc || 0) + sec;
    need = (NEU.engine.TILE || 16) / SPEED;
    if (ch.acc < need) return;
    ch.acc -= need;
    nxt = nextCell(room, ch.x, ch.y, goal.x, goal.y);
    if (!nxt) return;
    ch.x = nxt.x;
    ch.y = nxt.y;
    if (ch.x === goal.x && ch.y === goal.y) caught();
  }
  function rect(g, x, y, w, h, col) {
    g.fillStyle = col;
    g.fillRect(x | 0, y | 0, w | 0, h | 0);
  }
  function A() { return NEU.roomArt; }
  var droneSp = null, lampSp = null;
  function droneSprite() {
    if (droneSp || !A()) return droneSp;
    droneSp = A().sprite('vzs:drone', 32, 42, 16, 40, function (R, g) {
      var i, d, o = [], x, y;
      R(-11, -21, 4, 9, '#3A4048'); R(-11, -21, 1, 9, '#8E98A2'); R(-10, -21, 3, 1, '#5A6470');
      R(8, -21, 4, 9, '#3A4048'); R(8, -21, 1, 9, '#5A6470'); R(8, -21, 4, 1, '#5A6470');
      R(-8, -23, 16, 15, '#5A6470');
      R(-8, -23, 3, 15, '#8E98A2'); R(-8, -23, 16, 1, '#C5D0D8'); R(-8, -22, 1, 14, '#C5D0D8');
      R(5, -22, 3, 14, '#3A4048'); R(-8, -10, 16, 2, '#3A4048');
      R(-5, -17, 10, 1, '#3A4048'); R(-5, -15, 10, 1, '#8E98A2');
      for (i = 0; i < 3; i++) R(-4 + i * 3, -13, 2, 2, '#3A4048');
      R(-1, -20, 2, 2, '#20C8D0');
      R(-5, -9, 10, 2, '#3A4048'); R(-5, -9, 10, 1, '#5A6470');
      R(-3, -25, 6, 2, '#3A4048');
      R(-7, -34, 14, 10, '#5A6470');
      R(-7, -34, 14, 1, '#C5D0D8'); R(-7, -33, 2, 9, '#8E98A2'); R(5, -33, 2, 9, '#3A4048'); R(-7, -25, 14, 1, '#3A4048');
      R(-5, -31, 10, 4, '#0A0C10');
      R(3, -38, 1, 4, '#3A4048'); R(3, -38, 1, 1, '#C5D0D8');
      /* ink outline so it reads as one shape */
      try { d = g.getImageData(0, 0, 32, 42).data; } catch (err) { return; }
      for (y = 0; y < 42; y++) for (x = 0; x < 32; x++) {
        if (d[(y * 32 + x) * 4 + 3] > 40) continue;
        if ((x > 0 && d[(y * 32 + x - 1) * 4 + 3] > 40) || (x < 31 && d[(y * 32 + x + 1) * 4 + 3] > 40) ||
            (y > 0 && d[((y - 1) * 32 + x) * 4 + 3] > 40) || (y < 41 && d[((y + 1) * 32 + x) * 4 + 3] > 40)) o.push(x, y);
      }
      g.fillStyle = '#0A0C10';
      for (i = 0; i < o.length; i += 2) g.fillRect(o[i], o[i + 1], 1, 1);
    });
    return droneSp;
  }
  function chaserDir(e, d) {
    var room, goal, fn, key, n;
    room = (d && d.room) || (NEU.engine && NEU.engine.api && NEU.engine.api.room);
    if (!room) return null;
    goal = playerCell();
    fn = NEU.chase && NEU.chase.nextCell;
    key = e.x + ',' + e.y + ',' + goal.x + ',' + goal.y;
    if (e._nk !== key || e._nf !== fn) {
      e._nk = key;
      e._nf = fn;
      n = fn ? fn(room, e.x, e.y, goal.x, goal.y) : null;
      e._nd = n ? { x: n.x - e.x, y: n.y - e.y } : null;
    }
    return e._nd;
  }
  /* The telegraph: a searchlight on the floor toward the next cell. */
  function cone(g, x, y, dir, S) {
    var lens = [44, 30, 16], alphas = [0.03, 0.06, 0.10], l, i, n, hw, o;
    g.fillStyle = '#FFE8A0';
    for (l = 0; l < 3; l++) {
      g.globalAlpha = alphas[l];
      n = lens[l] >> 2;
      for (i = 0; i < n; i++) {
        hw = 4 + ((i * 10 / n) | 0);
        o = 8 + i * 4;
        if (dir.x) g.fillRect(x + (dir.x > 0 ? o : -o - 4) * S, y - hw * S, 4 * S, hw * 2 * S);
        else g.fillRect(x - hw * S, y + (dir.y > 0 ? o : -o - 4) * S, hw * 2 * S, 4 * S);
      }
    }
    g.globalAlpha = 1;
  }
  function drawChaser(g, e, d) {
    var S, x, y, now, hold, bob, f, sp, dir, lk;
    S = (d && d.S) || 1;
    x = d.sx;
    y = d.sy;
    lk = NEU.engineLook;
    now = d.now || 0;
    hold = calm();
    try { g.imageSmoothingEnabled = false; } catch (err) {}
    dir = chaserDir(e, d);
    if (dir && (dir.x || dir.y)) cone(g, x, y - 6 * S, dir, S);
    if (lk && lk.shadow) lk.shadow(g, x, y, 22, S, 0.35);
    f = hold ? 0 : ((now / 330) | 0) & 1;
    g.fillStyle = '#20C8D0';
    g.globalAlpha = 0.06; g.fillRect(x - 12 * S, y - 3 * S, 24 * S, 3 * S);
    g.globalAlpha = 0.12; g.fillRect(x - 9 * S, y - 3 * S, 18 * S, 2 * S);
    g.globalAlpha = 0.2; g.fillRect(x - 6 * S, y - 2 * S, 12 * S, S);
    g.globalAlpha = 1;
    bob = hold ? 0 : [0, 0, -1, -1][((now / 250) | 0) & 3];
    sp = droneSprite();
    if (sp) A().blit(g, sp, { S: S, sx: x, sy: y + bob * S });
    else rect(g, x - 8 * S, y - 30 * S, 16 * S, 24 * S, '#5A6470');
    rect(g, x - 4 * S, y + (bob - 30) * S, 8 * S, 2 * S, '#E04A3A');
    rect(g, x - 4 * S, y + (bob - 30) * S, 3 * S, S, '#FF8A70');
    if (lk && lk.glow) lk.glow(g, x, y + (bob - 29) * S, 10 * S, '#E04A3A', 0.25);
    rect(g, x - 4 * S, y + (bob - 7) * S, 2 * S, (1 + f) * S, '#20C8D0');
    rect(g, x + 2 * S, y + (bob - 7) * S, 2 * S, (2 - f) * S, '#20C8D0');
  }
  function lampSprite() {
    if (lampSp || !A()) return lampSp;
    lampSp = A().sprite('vzs:alarm', 16, 30, 8, 28, function (R, g) {
      R(-1, -20, 3, 20, '#3A2410'); R(-1, -20, 1, 20, '#8A5A28');
      R(-4, -2, 9, 2, '#2A1A0C'); R(-3, -3, 7, 1, '#5C3A18');
      R(-4, -26, 9, 7, '#2A1218'); R(-4, -26, 9, 1, '#5A2A30'); R(-4, -26, 1, 7, '#5A2A30');
      R(-3, -19, 7, 1, '#12081E');
      R(-1, -27, 3, 1, '#5C3A18');
      var d, o = [], x, y, i;
      try { d = g.getImageData(0, 0, 16, 30).data; } catch (err) { return; }
      for (y = 0; y < 30; y++) for (x = 0; x < 16; x++) {
        if (d[(y * 16 + x) * 4 + 3] > 40) continue;
        if ((x > 0 && d[(y * 16 + x - 1) * 4 + 3] > 40) || (x < 15 && d[(y * 16 + x + 1) * 4 + 3] > 40) ||
            (y > 0 && d[((y - 1) * 16 + x) * 4 + 3] > 40) || (y < 29 && d[((y + 1) * 16 + x) * 4 + 3] > 40)) o.push(x, y);
      }
      g.fillStyle = '#12081E';
      for (i = 0; i < o.length; i += 2) g.fillRect(o[i], o[i + 1], 1, 1);
    });
    return lampSp;
  }
  function alarmOn(d) {
    return calm() || (Math.floor(((d && d.now) || 0) / PERIOD) % 2) === 0;
  }
  function drawAlarm(g, e, d) {
    var S, x, y, on, sp, lk;
    S = (d && d.S) || 1;
    x = d.sx;
    y = d.sy;
    lk = NEU.engineLook;
    try { g.imageSmoothingEnabled = false; } catch (err) {}
    on = alarmOn(d);
    sp = lampSprite();
    if (sp) A().blit(g, sp, d);
    else rect(g, x - 3 * S, y - 14 * S, 6 * S, 4 * S, '#2A1218');
    rect(g, x - 3 * S, y - 25 * S, 7 * S, 5 * S, on ? '#E04A3A' : '#5A1810');
    rect(g, x - 3 * S, y - 25 * S, 3 * S, 2 * S, on ? '#FFB0A0' : '#7A2A20');
    if (on && lk && lk.glow) lk.glow(g, x, y - 22 * S, 18 * S, '#E04A3A', 0.3);
  }
  function drawFigure(g, e, d) {
    var S, x, y, sk;
    S = (d && d.S) || 1;
    x = d.sx;
    y = d.sy;
    sk = A() && A().skins && A().skins.hood;
    if (sk && sk.draw) { sk.draw(g, e, d); return; }
    try { g.imageSmoothingEnabled = false; } catch (err) {}
    rect(g, x - 5 * S, y - 18 * S, 10 * S, 16 * S, '#100E16');
    rect(g, x - 4 * S, y - 24 * S, 8 * S, 8 * S, '#100E16');
    rect(g, x - 2 * S, y - 18 * S, 2 * S, 2 * S, '#E4E0D4');
    rect(g, x + 1 * S, y - 18 * S, 2 * S, 2 * S, '#E4E0D4');
  }
  function lampLight(e, d) {
    if (calm()) return { r: 28, col: '#E04A3A', glow: 0.2, a: 0.7 };
    if (alarmOn(d)) return { r: 36, col: '#E04A3A', glow: 0.35, a: 1 };
    return null;                       /* off half of the 400 ms flash: dark, the engine skips a null light */
  }

  if (NEU.engineKinds && NEU.engineKinds.kind) {
    NEU.engineKinds.kind('chaser', {
      interactive: function () { return false; },
      draw: drawChaser,
      width: function () { return 12; }
    });
    NEU.engineKinds.kind('alarm', {
      interactive: function () { return false; },
      draw: drawAlarm,
      light: lampLight,
      width: function () { return 6; }
    });
    NEU.engineKinds.kind('figure', {
      interactive: function () { return false; },
      draw: drawFigure,
      width: function () { return 10; }
    });
  }

  NEU.chase = {
    SPEED: SPEED,
    PERIOD: PERIOD,
    catches: 0,
    over: figureMet(),
    step: step,
    nextCell: nextCell,
    arrive: arrive,
    bind: function (room) {
      var base, prev, far;
      if (!room || !room.entities || !room.entities.slice) return;
      base = room.entities.slice();
      prev = room.onEnter;
      far = farCell(room);
      Object.defineProperty(room, 'entities', {
        configurable: true,
        get: function () {
          var out, i, e;
          if (!lockdown()) return base;
          out = [];
          for (i = 0; i < base.length; i++) {
            e = base[i];
            if (e.t === 'npc') continue;
            out.push(e);
          }
          if (!NEU.chase.over) {
            out.push({ t: 'chaser', x: far.x, y: far.y, acc: 0 });
            out.push({ t: 'alarm', x: 1, y: 1 });
            out.push({ t: 'alarm', x: Math.max(1, room.w - 2), y: 1 });
          }
          if (room.id === 's11_elder') {
            out.push({ t: 'figure', x: 5, y: 6, figure: 1 });
            out.push({ t: 'trigger', x: 5, y: 6, once: 1, run: function () { arrive(); } });
          }
          return out;
        }
      });
      room.onEnter = function (c) {
        syncDom();
        if (lockdown()) {
          if (!NEU.chase.over && NEU.talk && !c.flagged('s_lock_said')) {
            c.flag('s_lock_said', 1);
            NEU.talk(['the village is shut. the doors are barred from the inside.'], 'narr');
          }
          return;
        }
        if (prev) prev(c);
      };
    }
  };

  if (NEU.kernel) {
    NEU.kernel.register('chase', {
      open: function () {},
      close: function () {},
      running: function () { return lockdown() && !NEU.chase.over; },
      tick: function (dt) { step(dt); }
    });
    if (NEU.kernel.scenes && NEU.kernel.scenes.engine && !NEU.kernel.scenes.engine.__chase) {
      (function (eng) {
        var prev = eng.tick;
        eng.tick = function (dt) {
          if (prev) prev(dt);
          step(dt);
        };
        eng.__chase = 1;
      })(NEU.kernel.scenes.engine);
    }
  }
})();
