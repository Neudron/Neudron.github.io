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
  function drawChaser(g, e, d) {
    var S, x, y;
    S = (d && d.S) || 1;
    x = d.sx;
    y = d.sy;
    try { g.imageSmoothingEnabled = false; } catch (err) {}
    rect(g, x - 6 * S, y - 4 * S, 12 * S, 4 * S, '#C8A04A');
    rect(g, x - 4 * S, y - 3 * S, 3 * S, 2 * S, '#F0D48A');
    rect(g, x - 4 * S, y - 16 * S, 8 * S, 12 * S, '#1A4A48');
    rect(g, x - 3 * S, y - 20 * S, 6 * S, 5 * S, '#D8DEE6');
    rect(g, x - 2 * S, y - 18 * S, 2 * S, 2 * S, '#E23B55');
    rect(g, x + 1 * S, y - 18 * S, 2 * S, 2 * S, '#E23B55');
    rect(g, x - 7 * S, y - 12 * S, 3 * S, 6 * S, '#8A7040');
    rect(g, x + 4 * S, y - 12 * S, 3 * S, 6 * S, '#8A7040');
  }
  function drawAlarm(g, e, d) {
    var S, x, y, on;
    S = (d && d.S) || 1;
    x = d.sx;
    y = d.sy;
    try { g.imageSmoothingEnabled = false; } catch (err) {}
    on = calm() || (Math.floor((d.now || 0) / PERIOD) % 2) === 0;
    rect(g, x - 3 * S, y - 14 * S, 6 * S, 4 * S, '#2A1218');
    rect(g, x - 2 * S, y - 16 * S, 4 * S, 3 * S, on ? '#E23B55' : '#4A1820');
    rect(g, x - S, y - 10 * S, 2 * S, 8 * S, '#3A2410');
  }
  function drawFigure(g, e, d) {
    var S, x, y;
    S = (d && d.S) || 1;
    x = d.sx;
    y = d.sy;
    try { g.imageSmoothingEnabled = false; } catch (err) {}
    rect(g, x - 5 * S, y - 18 * S, 10 * S, 16 * S, '#100E16');
    rect(g, x - 4 * S, y - 24 * S, 8 * S, 8 * S, '#100E16');
    rect(g, x - 2 * S, y - 18 * S, 2 * S, 2 * S, '#E4E0D4');
    rect(g, x + 1 * S, y - 18 * S, 2 * S, 2 * S, '#E4E0D4');
  }
  function lampLight(e, d) {
    var t, on;
    if (calm()) return { r: 28, col: '#E23B55', glow: 0.2, a: 0.7 };
    t = d && d.now ? d.now : 0;
    on = (Math.floor(t / PERIOD) % 2) === 0;
    if (!on) return null;
    return { r: 36, col: '#E23B55', glow: 0.35, a: 1 };
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
