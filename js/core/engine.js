/* engine.js — rooms, as data. (v2)
   ───────────────────────────────────────────────────────────────────
   Act IV is ~35 rooms. One implementation of movement, collision and
   interaction, and rooms are DATA: a tile string, spawns, entities,
   a few hooks. That was v1's idea and it was right; v2 keeps every
   room file and every hook exactly as they were and rebuilds what it
   feels like to be inside one.

   What v1 got right and v2 keeps verbatim:
   1. TILES ARE A STRING, one character per cell, readable in place.
   2. TILESETS HAVE A PALETTE FALLBACK, so a room plays before its art.
   3. COLLISION IS SWEPT, ALWAYS. Movement is resolved axis by axis in
      sub-steps no longer than half a tile, so nothing tunnels at any
      frame rate.
   4. THE WALK CYCLE ADVANCES ON DISTANCE, NOT TIME.

   What v2 changes, and why (full review: .opencode/plans/engine-v2.md):
   5. A FIXED 60 Hz STEP. Physics no longer depends on the display's
      refresh rate; a 144 Hz screen and a 60 Hz phone play the same.
   6. MOVEMENT HAS WEIGHT. ~90 ms to reach full speed, ~70 ms to stop.
      Top speed is unchanged, so every puzzle's timing holds.
   7. CORNERS FORGIVE. Walking into a wall edge you overlap by a few
      units slides you around it — one-tile doorways stop snagging.
   8. YOU INTERACT WITH WHAT YOU FACE. When two things are in reach, the
      one in front of you wins. REACH itself is unchanged.
   9. THE CAMERA EASES, LEADS AND KNOWS ABOUT THUMBS. Exponential follow
      with a little look-ahead; on a phone the touch pad's height is
      taken out of the view so the player is never under it.
  10. THE VIEW FITS THE SCREEN. About 20×12 tiles at the largest integer
      scale that fits, instead of a fixed 3× that showed 8 tiles on a
      phone and a postage stamp on a desktop.
  11. WHAT THINGS DO lives in engine-kinds.js, one record per kind; WHAT
      THINGS LOOK LIKE lives in engine-look.js. This file is the sim, the
      loop, the camera and the API.                                    */

(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};

  var wrap = document.getElementById('eng');
  var cv   = document.getElementById('engCanvas');
  if (!wrap || !cv) { NEU.engine = { enter: function () {}, leave: function () {} }; return; }
  var ctx = cv.getContext ? cv.getContext('2d') : null;
  if (!ctx) { NEU.engine = { enter: function () {}, leave: function () {} }; return; }

  var reduced = false;
  try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var TILE = 16;              // world units per cell
  var SPEED = 96;             // world units/sec — top speed, unchanged from v1
  var ACCEL = 1100;           // u/s²: full speed in ~87 ms
  var FRICTION = 1400;        // u/s²: stop in ~69 ms, ~3 u of slide
  var CORNER = 5;             // u of overlap a corner forgives
  var PLAYER_W = 10, PLAYER_H = 8;   // the FEET box. smaller than the sprite.
  var REACH = 22;
  var STEP = 1 / 60;
  var LOOKAHEAD = 12;         // u the camera leads in the facing direction
  var INTERACT_COOLDOWN = 500; // ms

  function look() { return NEU.engineLook || null; }
  function kinds() { return NEU.engineKinds || null; }

  /* ── state ────────────────────────────────────────────────────── */
  var rooms = {}, tilesets = {};
  var room = null, running = false, last = 0, acc = 0;
  var px = 0, py = 0, vx = 0, vy = 0, keys = {}, face = 'down', walked = 0, moving = false;
  var movedFor = 0, settle = 0;
  var camX = 0, camY = 0, kickX = 0, kickY = 0;
  var S = 3, padH = 0, padPoll = 0;
  var fade = 0, fadeDir = 0, fadeThen = null;
  /* Seconds the iris takes. A door is quick (0.22); arriving from a
     scene that has just played its own ending can ask for a slower one
     through enter()'s opts, and it goes back to quick when it is done. */
  var IRIS = 0.22, fadeSpan = IRIS;
  var busy = false;                    // a cutscene owns input
  var ents = [];                       // live copy of room.entities
  var images = {};
  var layers = {};                     // baked static layer per room id
  var timers = [];                     // api.later — die with the visit
  var promptFor = null, promptT = 0, clock = 0;

  /* ── tilesets ─────────────────────────────────────────────────── */
  function tileset(name, def) {
    /* def = { solid:'#XT', colours:{ '#':'#1a1a24', '.':'#0d0d12' },
               src:'img/...png', rects:{ '#':[0,0], '.':[16,0] } }     */
    tilesets[name] = def;
    if (def.src) img(def.src);
    return def;
  }

  function img(src) {
    if (images[src]) return images[src];
    var i = new Image();
    i.onerror = function () { i.__failed = true; };
    i.src = src;
    images[src] = i;
    return i;
  }

  /* ── rooms ────────────────────────────────────────────────────── */
  function register(id, def) {
    def.id = id;
    def.grid = def.tiles.split('\n').filter(function (r) { return r.length; });
    def.h = def.grid.length;
    def.w = def.grid.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    rooms[id] = def;
    delete layers[id];
    return def;
  }

  function at(cx, cy) {
    if (!room) return '#';
    if (cx < 0 || cy < 0 || cy >= room.h) return '#';
    var r = room.grid[cy];
    if (cx >= r.length) return '#';
    return r[cx];
  }

  function solidAt(cx, cy) {
    var ts = tilesets[room.tileset];
    var ch = at(cx, cy);
    return !ts || ts.solid.indexOf(ch) >= 0;
  }

  /* Box-vs-tiles. Tests every cell the box overlaps rather than its
     corners — a box wider than a tile can straddle a wall with all
     four corners in open space. */
  function blocked(x, y) {
    var x0 = Math.floor((x - PLAYER_W / 2) / TILE);
    var x1 = Math.floor((x + PLAYER_W / 2 - 0.01) / TILE);
    var y0 = Math.floor((y - PLAYER_H) / TILE);
    var y1 = Math.floor((y - 0.01) / TILE);
    for (var cy = y0; cy <= y1; cy++)
      for (var cx = x0; cx <= x1; cx++) {
        if (solidAt(cx, cy)) return true;
        if (entSolid(cx, cy)) return true;
      }
    return false;
  }

  /* Entities can occupy the grid too — a push block is not a tile,
     because tiles are immutable strings and a block that moves has to
     be a thing with a position. */
  function entSolid(cx, cy) {
    for (var i = 0; i < ents.length; i++) {
      var e = ents[i];
      if (e.dead || !e.solid) continue;
      if (e.x === cx && e.y === cy) return true;
    }
    return false;
  }

  function entHere(cx, cy, kind) {
    for (var i = 0; i < ents.length; i++) {
      var e = ents[i];
      if (e.dead) continue;
      if (e.x === cx && e.y === cy && (!kind || e.t === kind)) return e;
    }
    return null;
  }

  /* -Infinity, not 0. v1 started this at 0 against performance.now(),
     so every reset in the first four seconds after the PAGE loaded was
     refused as spam. */
  var lastReset = -Infinity;
  var slideD = 0;         /* direction of an active ice slide; 0 = not sliding */
  var slideDead = false;  /* the direction a slide just died in — a held key must not re-commit */

  /* ── push blocks ────────────────────────────────────────────────
     Walk into one and press e: it moves a whole cell in the direction
     you face, if the cell beyond is clear. Grid-snapped — a block that
     slides continuously can straddle two cells, and then "is it on the
     plate" has no honest answer. No undo; an unsolvable arrangement
     resets the WHOLE room (Deltarune's answer, and the right one). */
  var DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  function tryPush() {
    var d = DIRV[face];
    if (!d) return false;
    var cx = Math.floor(px / TILE) + d[0];
    var cy = Math.floor((py - 1) / TILE) + d[1];
    var b = entHere(cx, cy, 'block');
    if (!b || !b.push) return false;
    var tx = cx + d[0], ty = cy + d[1];
    if (solidAt(tx, ty) || entSolid(tx, ty)) return false;
    b.x = tx; b.y = ty;
    if (NEU.juice) NEU.juice.hit('tick');
    kick(d[0] * 2, d[1] * 2);
    /* Ice. The block keeps going until something stops it, which is
       what turns "push a block" into "aim a block". Bounded so a
       malformed map cannot spin forever. */
    var guard = 0;
    while (at(b.x, b.y) === 'i' && guard++ < 64) {
      var nx = b.x + d[0], ny = b.y + d[1];
      if (solidAt(nx, ny) || entSolid(nx, ny)) break;
      b.x = nx; b.y = ny;
    }
    if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
    checkPuzzle();
    return true;
  }

  /* A slide dies on the last ice cell. If that cell holds a slideOnly
     plate, the plate locks — arming by landing, never by walking up. */
  function stopSlide() {
    var ci = Math.floor(px / TILE), cj = Math.floor((py - 1) / TILE);
    var pl = entHere(ci, cj, 'plate');
    if (pl && pl.slideOnly && !pl.armed) {
      pl.armed = true;
      if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
      if (NEU.juice) NEU.juice.hit('small');
    }
    slideD = 0;
    slideDead = true;
    checkPuzzle();
  }

  /* A room is solved when every plate has a block on it, or when its
     own `solved(ctx)` says so. */
  function checkPuzzle() {
    if (!room || room.__solved) return;
    var done;
    if (typeof room.solved === 'function') done = room.solved(API);
    else {
      var plates = ents.filter(function (e) { return e.t === 'plate' && !e.dead; });
      done = plates.length > 0 && plates.every(function (p) {
        return !!entHere(p.x, p.y, 'block');
      });
    }
    if (!done) return;
    room.__solved = true;
    if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick();
    /* Solving a room is a LARGE moment. It is the only reward the
       puzzle gives and it should feel like one. */
    if (NEU.juice) NEU.juice.hit('large', { colour: '#7BE38A' });
    kick(0, 3);
    if (room.onSolved) room.onSolved(API);
  }

  function resetPuzzle() {
    if (!room) return;
    /* R-spam is the cheese: brute-forcing a puzzle by resetting every
       second is not solving it. */
    if (performance.now() - lastReset < 4000) {
      say(['the room is still settling. give it a moment.'], 'narr');
      return;
    }
    lastReset = performance.now();
    room.__solved = false;
    slideD = 0;
    slideDead = false;
    ents = spawnEnts(room);
    if (room.onReset) room.onReset();
    say(['the room resets itself. it has done this before.'], 'narr');
  }

  /* ── movement ─────────────────────────────────────────────────────
     Swept along each axis in sub-steps no larger than half a tile
     (decision 3). When an axis is blocked and the player is not also
     pressing the other axis, look up to CORNER units either side: if a
     sideways shift would clear the edge, take one sub-step of it. The
     sideways move is itself collision-checked, so the forgiveness can
     never put you inside anything. */
  function nudge(x, y, tx, ty, axis, stepLen) {
    for (var d = 1; d <= CORNER; d++) {
      for (var sgn = -1; sgn <= 1; sgn += 2) {
        var ox = axis === 'x' ? sgn * d : 0, oy = axis === 'y' ? sgn * d : 0;
        if (!blocked(tx + ox, ty + oy) && !blocked(x + ox, y + oy)) {
          var m = sgn * Math.min(d, stepLen);
          return axis === 'x' ? { x: m, y: 0 } : { x: 0, y: m };
        }
      }
    }
    return null;
  }

  function sweep(x, y, dx, dy, ix, iy) {
    var dist = Math.sqrt(dx * dx + dy * dy);
    var out = { x: x, y: y, bx: false, by: false };
    if (!dist) return out;
    var steps = Math.max(1, Math.ceil(dist / (TILE / 2)));
    var sx = dx / steps, sy = dy / steps, n;
    for (var i = 0; i < steps; i++) {
      if (sx) {
        if (!blocked(x + sx, y)) x += sx;
        else {
          out.bx = true;
          if (!iy && (n = nudge(x, y, x + sx, y, 'y', Math.abs(sx)))) { x += n.x; y += n.y; }
        }
      }
      if (sy) {
        if (!blocked(x, y + sy)) y += sy;
        else {
          out.by = true;
          if (!ix && (n = nudge(x, y, x, y + sy, 'x', Math.abs(sy)))) { x += n.x; y += n.y; }
        }
      }
    }
    out.x = x; out.y = y;
    return out;
  }

  function approach(v, target, delta) {
    if (v < target) return Math.min(target, v + delta);
    if (v > target) return Math.max(target, v - delta);
    return v;
  }

  /* ── entities ─────────────────────────────────────────────────── */
  function entAt(e) { return { x: (e.x + 0.5) * TILE, y: (e.y + 1) * TILE }; }

  function interactive(e) {
    var K = kinds();
    if (K) return K.interactive(e);
    return typeof e.run === 'function' || e.t === 'exit' || e.t === 'pickup' ||
           e.t === 'save' || e.t === 'npc' || e.t === 'altar' || e.t === 'sign';
  }
  function promptable(e) {
    var K = kinds();
    return K ? K.promptable(e) : (interactive(e) || (e.t === 'block' && e.push));
  }

  /* Within REACH, the lowest distance plus a facing penalty: something
     straight ahead costs nothing extra, something behind you costs ten
     units. Decision 8. */
  function nearest(want) {
    var best = null, bs = Infinity;
    var f = DIRV[face] || [0, 1];
    var cy = py - PLAYER_H / 2;
    for (var i = 0; i < ents.length; i++) {
      var e = ents[i];
      if (e.dead || e.t === 'trigger') continue;
      if (want && !want(e)) continue;
      /* exit tiles: measure to the face you can stand at, not the tile's
         far wall — a door embedded in a wall was only reachable in a sliver. */
      if (e.t === 'exit') {
        var qx = Math.max(e.x * TILE, Math.min(px, e.x * TILE + TILE));
        var qy = Math.max(e.y * TILE, Math.min(cy, e.y * TILE + TILE));
        var dx = qx - px, dy = qy - cy;
      } else {
        var p = entAt(e);
        var dx = p.x - px, dy = p.y - cy;
      }
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d >= REACH) continue;
      var score = d + (d > 0.5 ? 10 * (1 - (dx * f[0] + dy * f[1]) / d) : 0);
      if (score < bs) { bs = score; best = e; }
    }
    return best;
  }

  /* Rapid e on the same entity inside the cooldown is one press. */
  var lastInteractedEntity = null, lastInteractedTime = 0;

  var SYS = {
    say: function (l, w) { say(l, w); },
    go: function (id, sp) { go(id, sp); },
    flag: function (k, v) { return flag(k, v); },
    room: function () { return room; },
    burst: function (e, n, col) {
      if (!NEU.juice || !NEU.juice.burst) return;
      var p = entAt(e);
      NEU.juice.burst(Math.round((p.x - camX) * S), Math.round((p.y - camY - 6) * S), n, col);
    }
  };

  function fire(e) {
    if (!e) return;
    var now = Date.now();
    if (e === lastInteractedEntity && now - lastInteractedTime < INTERACT_COOLDOWN) return;
    lastInteractedEntity = e;
    lastInteractedTime = now;
    var K = kinds();
    if (K) { K.fire(e, SYS); return; }
    if (typeof e.run === 'function') e.run(API);
  }

  function checkTriggers() {
    for (var i = 0; i < ents.length; i++) {
      var e = ents[i];
      if (e.t !== 'trigger' || e.dead) continue;
      var x0 = e.x * TILE, y0 = e.y * TILE;
      var x1 = x0 + (e.w || 1) * TILE, y1 = y0 + (e.h || 1) * TILE;
      if (px >= x0 && px <= x1 && py >= y0 && py <= y1) {
        if (e.once) e.dead = true;
        if (typeof e.run === 'function') e.run(API);
      }
    }
  }

  /* ── transitions ──────────────────────────────────────────────── */
  function go(id, spawn) {
    if (!rooms[id]) { say(['there is nothing through there. yet.'], 'narr'); return; }
    if (fadeDir) return;                    // already moving
    busy = true;
    fadeDir = 1;
    fadeThen = function () {
      land(id, spawn);
      fadeDir = -1;
      fadeThen = function () { busy = false; };
    };
    if (reduced) { fade = 1; }              // no iris, just the cut
  }

  function spawnEnts(r) {
    return (r.entities || []).map(function (e) {
      var c = {}; for (var k in e) c[k] = e[k];
      /* Pickups already taken and one-shot triggers already fired stay
         gone across a reload — otherwise the save file hands out
         infinite copies of every item. "Taken" is its own flag now, not
         "still in your pocket" (see engine-kinds pickup). */
      if (c.t === 'pickup' && NEU.save &&
          (NEU.save.has(c.item) || NEU.save.flagged('p:' + r.id + ':' + c.x + ',' + c.y))) c.dead = true;
      if (c.once && NEU.save && NEU.save.flagged('t:' + r.id + ':' + c.x + ',' + c.y)) c.dead = true;
      return c;
    });
  }

  /* Only reached by a room that declares no spawns at all. */
  function firstOpenCell() {
    for (var y = 0; y < room.h; y++)
      for (var x = 0; x < room.w; x++)
        if (!solidAt(x, y)) return { x: x, y: y };
    return { x: 2, y: 2 };
  }

  function land(id, spawn) {
    if (room && room.onExit) room.onExit(API);
    clearLater();
    room = rooms[id];
    /* A solved puzzle stays solved across a revisit, but the blocks go
       back to their starting cells. */
    room.__solved = NEU.save ? NEU.save.flagged('solved:' + id) : false;
    ents = spawnEnts(room);
    var s = (room.spawns && room.spawns[spawn]) || (room.spawns && room.spawns.default);
    if (!s) {
      /* An exit naming a spawn the target room does not declare is a
         bug in the room, and it must not be able to pass for level
         design: prefer any declared spawn, then floor, and say so. */
      var names = room.spawns ? Object.keys(room.spawns) : [];
      s = names.length ? room.spawns[names[0]] : firstOpenCell();
      if (window.console && console.warn)
        console.warn('[neu] room "' + id + '" has no spawn "' + spawn +
                     '" — landing at ' + s.x + ',' + s.y);
    }
    px = (s.x + 0.5) * TILE; py = (s.y + 1) * TILE;
    vx = 0; vy = 0; walked = 0; face = s.face || 'down';
    slideD = 0; slideDead = false; promptFor = null;
    room.__spawn = spawn;
    bake();
    camSnap();
    var L = look();
    if (L) L.weatherReset(L.zone(room.tileset).weather, room);
    /* A room change must not carry the old room's dialogue. */
    if (NEU.talk && NEU.talk.close) NEU.talk.close();
    if (room.onEnter) room.onEnter(API);
    if (NEU.save) NEU.save.capture();
  }

  /* ── api.later: timers that die with the visit (F4) ──────────────
     A hook that schedules something and then gets walked away from
     must not fire into the next room. */
  function later(fn, ms) {
    var id = setTimeout(function () {
      var i = timers.indexOf(id); if (i >= 0) timers.splice(i, 1);
      if (running) fn(API);
    }, ms);
    timers.push(id);
    return id;
  }
  function clearLater() { for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]); timers = []; }

  /* ── the baked layer ──────────────────────────────────────────── */
  function bake() {
    var L = look();
    if (!L || !room || layers[room.id]) return;
    var ts = tilesets[room.tileset];
    try { layers[room.id] = L.bakeRoom(room, ts, room.tileset); } catch (e) { layers[room.id] = null; }
  }

  /* ── camera ───────────────────────────────────────────────────── */
  function chooseScale() {
    var s = Math.floor(Math.min(innerWidth / (20 * TILE), innerHeight / (12 * TILE)));
    return Math.max(2, Math.min(6, s || 2));
  }
  /* How much of the bottom of the screen the touch pad covers. */
  function measurePad() {
    var el = document.querySelector && document.querySelector('.tpad');
    if (!el || el.hidden) return 0;
    try {
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
    } catch (e) {}
    var r = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    if (!r || !r.height) return 0;
    return Math.max(0, Math.min(r.height, innerHeight - r.top, innerHeight * 0.45));
  }
  function view() {
    return { w: innerWidth / S, h: innerHeight / S, uh: Math.max(1, innerHeight - padH) / S };
  }
  function camClamp() {
    var v = view();
    var maxX = Math.max(0, room.w * TILE - v.w), maxY = Math.max(0, room.h * TILE - v.uh);
    camX = Math.min(Math.max(camX, 0), maxX);
    camY = Math.min(Math.max(camY, 0), maxY);
    if (room.w * TILE < v.w) camX = (room.w * TILE - v.w) / 2;
    if (room.h * TILE < v.uh) camY = (room.h * TILE - v.uh) / 2;
  }
  function camTarget() {
    var v = view(), f = DIRV[face] || [0, 0];
    var lead = reduced ? 0 : LOOKAHEAD;
    return { x: px + f[0] * lead - v.w / 2, y: py - 6 + f[1] * lead - v.uh / 2 };
  }
  function camSnap() { var t = camTarget(); camX = t.x; camY = t.y; camClamp(); }
  function camFollow(dt) {
    var t = camTarget(), k = 1 - Math.exp(-10 * dt);
    camX += (t.x - camX) * k; camY += (t.y - camY) * k;
    camClamp();
  }
  /* A small directional camera impulse (B3): a push, a solved room.
     Part of shake, so it obeys the same switches. */
  function kick(x, y) {
    if (reduced || (NEU.juice && NEU.juice.noShake)) return;
    kickX += x; kickY += y;
  }

  /* ── loop ─────────────────────────────────────────────────────── */
  function layout() {
    var dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = (innerWidth * dpr) | 0; cv.height = (innerHeight * dpr) | 0;
    cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    S = chooseScale();
    padH = measurePad();
    if (room) camClamp();
  }
  addEventListener('resize', function () { if (running) layout(); });

  function update(dt) {
    clock += dt;
    if (fadeDir) {
      fade += fadeDir * dt / fadeSpan;
      if (fade >= 1 && fadeDir > 0) { fade = 1; fadeDir = 0; fadeSpan = IRIS; var f = fadeThen; fadeThen = null; if (f) f(); }
      else if (fade <= 0 && fadeDir < 0) { fade = 0; fadeDir = 0; fadeSpan = IRIS; var g = fadeThen; fadeThen = null; if (g) g(); }
    }
    if ((padPoll -= dt) <= 0) { padPoll = 0.5; var ph = measurePad(); if (ph !== padH) padH = ph; }
    if (!room) return;

    if (!busy) move(dt); else { vx = 0; vy = 0; moving = false; }
    camFollow(dt);
    var decay = Math.exp(-14 * dt);
    kickX *= decay; kickY *= decay;
    if (settle > 0) settle -= dt;
    var L = look();
    if (L) L.weatherStep(dt, room);
  }

  function move(dt) {
    var ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    var iy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    /* A fresh press is a fresh commitment; the key that killed a slide
       must not immediately re-commit to the same line. */
    if (!ix && !iy) slideDead = false;
    var wasMoving = moving;

    if (slideD) {
      /* Sliding: input does nothing until the ice runs out. */
      face = slideD; vx = 0; vy = 0; moving = true;
      var d = DIRV[slideD];
      var ci = Math.floor(px / TILE), cj = Math.floor((py - 1) / TILE);
      var ni = ci + d[0], nj = cj + d[1];
      /* Predict before moving: the slide dies when the cell ahead is not
         ice, so the stop lands exactly ON the last ice cell. */
      if (at(ci, cj) !== 'i' || at(ni, nj) !== 'i') {
        stopSlide(); checkTriggers(); checkPuzzle();
      } else {
        var bp = px, bq = py;
        var sp = sweep(px, py, d[0] * SPEED * dt, d[1] * SPEED * dt, d[0], d[1]);
        px = sp.x; py = sp.y;
        walked += Math.sqrt((px - bp) * (px - bp) + (py - bq) * (py - bq));
        checkTriggers(); checkPuzzle();
      }
      return;
    }

    if (ix || iy) {
      var len = Math.sqrt(ix * ix + iy * iy);
      vx = approach(vx, ix / len * SPEED, ACCEL * dt);
      vy = approach(vy, iy / len * SPEED, ACCEL * dt);
      face = Math.abs(ix) > Math.abs(iy) ? (ix > 0 ? 'right' : 'left') : (iy > 0 ? 'down' : 'up');
      if (!ix) vx = approach(vx, 0, FRICTION * dt);
      if (!iy) vy = approach(vy, 0, FRICTION * dt);
    } else {
      vx = approach(vx, 0, FRICTION * dt);
      vy = approach(vy, 0, FRICTION * dt);
    }
    moving = !!(ix || iy);
    if (moving) movedFor += dt;
    else { if (wasMoving && movedFor > 0.25) settle = 0.09; movedFor = 0; }
    if (!vx && !vy) return;

    var bx = px, by = py;
    var p = sweep(px, py, vx * dt, vy * dt, ix, iy);
    px = p.x; py = p.y;
    if (p.bx && !ix) vx = 0;
    if (p.by && !iy) vy = 0;
    if (p.bx && px === bx) vx = 0;
    if (p.by && py === by) vy = 0;
    walked += Math.sqrt((px - bx) * (px - bx) + (py - by) * (py - by));
    /* Ice catches you: the moment your feet are on it, you are committed
       to that line of travel. */
    var eci = Math.floor(px / TILE), ecj = Math.floor((py - 1) / TILE);
    /* A dead slide lifts once your feet leave the ice: without this the
       death state latched forever and chained slides could never start. */
    if (slideDead && !slideD && at(eci, ecj) !== 'i') slideDead = false;
    if (at(eci, ecj) === 'i' && !slideDead && moving) { slideD = face; vx = 0; vy = 0; }
    checkTriggers();
    /* solved() can become true on a WALK (b5: you stand on one plate
       while the block holds the other). */
    checkPuzzle();
  }

  function step(now) {
    if (!running) return;
    requestAnimationFrame(step);
    var dt = (now - last) / 1000; last = now;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    var n = 0;
    while (acc >= STEP && n < 16) { update(STEP); acc -= STEP; n++; }
    if (n >= 16) acc = 0;
    draw(now);
  }

  /* ── draw ─────────────────────────────────────────────────────── */
  function lightsFor(now, camSX, camSY, v) {
    var L = look(), K = kinds(), out = [];
    var z = L.zone(room.tileset);
    var darkAmt = typeof room.dark === 'function' ? room.dark(API) : room.dark;
    var ambient = z.ambient;
    var d = drawCtx(now);
    if (darkAmt > 0) {
      /* A dark room. The light follows the room's `light` hook (b6's
         carried torch), else the player carries a faint one of their
         own — v1 centred it on the SCREEN, so in a room narrower than
         the view you could not see yourself at all. */
      ambient = 0.03;
      var lt = room.light ? room.light(API) : null;
      if (lt) out.push({ x: lt.x, y: lt.y - 6, r: darkAmt * 0.7, col: z.warm, glow: 0.18, a: 1 });
      else out.push({ x: px, y: py - 6, r: 20, a: 0.8 });
    } else if (ambient < 0.8) {
      out.push({ x: px, y: py - 6, r: 34, a: 0.5 });
    }
    /* entity lights */
    for (var i = 0; i < ents.length; i++) {
      var e = ents[i];
      if (e.dead) continue;
      var k = K ? K.get(e) : null;
      var li = k && k.light ? k.light(e, d) : null;
      if (!li) continue;
      var p = entAt(e);
      var r = li.r;
      if (li.flicker && !reduced) r *= 1 + Math.sin(now / 70 + e.x * 3) * 0.05;
      out.push({ x: p.x, y: p.y - 8, r: r, col: li.col, glow: li.glow, a: li.a });
    }
    /* the lit path lights itself in the dark zones — "lit ground is
       walkable" is the woods' whole tutorial */
    if (ambient < 0.8 && !darkAmt) {
      var x0 = Math.max(0, Math.floor(camSX / TILE)), y0 = Math.max(0, Math.floor(camSY / TILE));
      var x1 = Math.min(room.w - 1, Math.ceil((camSX + v.w) / TILE)), y1 = Math.min(room.h - 1, Math.ceil((camSY + v.h) / TILE));
      for (var cy = y0; cy <= y1; cy++) for (var cx = x0; cx <= x1; cx++)
        if (at(cx, cy) === ',') out.push({ x: (cx + 0.5) * TILE, y: (cy + 0.5) * TILE, r: 20, a: 0.55 });
    }
    return { ambient: ambient, night: z.night, list: out };
  }

  function drawCtx(now) {
    return { S: S, sx: 0, sy: 0, now: now, api: API, room: room, entHere: entHere };
  }

  function draw(now) {
    var w = innerWidth, h = innerHeight;
    ctx.fillStyle = '#050507'; ctx.fillRect(0, 0, w, h);
    if (!room) return;
    var L = look(), K = kinds();
    var shook = NEU.juice ? NEU.juice.begin(ctx, w, h) : false;
    var v = view();
    /* Pixel-snap the camera once; every world→screen conversion below
       rounds against the same origin, so sprites never shimmer against
       the floor. */
    var ox = Math.round((camX + kickX) * S), oy = Math.round((camY + kickY) * S);
    var camSX = ox / S, camSY = oy / S;
    function sx(wx) { return Math.round(wx * S) - ox; }
    function sy(wy) { return Math.round(wy * S) - oy; }

    var layer = layers[room.id];
    if (layer && L) {
      var smooth = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(layer, -ox, -oy, layer.width * S, layer.height * S);
      ctx.imageSmoothingEnabled = smooth;
      L.drawAnimated(ctx, room, tilesets[room.tileset], room.tileset, camSX, camSY, S, now, v);
    } else drawFlat(camSX, camSY, v);

    var d = drawCtx(now);
    /* floor decals first and unsorted — sorting a plate by foot Y makes
       a block vanish underneath its own plate */
    var i, e, k;
    for (i = 0; i < ents.length; i++) {
      e = ents[i];
      if (e.dead) continue;
      k = K ? K.get(e) : null;
      if (!k || !k.floor || !k.draw) continue;
      var pf = entAt(e); d.sx = sx(pf.x); d.sy = sy(pf.y);
      k.draw(ctx, e, d);
    }
    /* everything that stands, sorted by foot Y */
    var drawn = [];
    for (i = 0; i < ents.length; i++) {
      e = ents[i];
      if (e.dead || e.t === 'trigger') continue;
      k = K ? K.get(e) : null;
      if (k && (k.floor || k.hidden)) continue;
      drawn.push({ e: e, k: k, y: (e.y + 1) * TILE });
    }
    drawn.push({ e: null, y: py });
    drawn.sort(function (a, b) { return a.y - b.y; });
    /* shadows under all of it, then the things themselves */
    if (L) {
      for (i = 0; i < drawn.length; i++) {
        var it = drawn[i];
        if (!it.e) { L.shadow(ctx, sx(px), sy(py), 9, S, 0.42); continue; }
        var ww = it.k && it.k.width ? it.k.width(it.e, S) : 9;
        if (ww > 0) { var pe = entAt(it.e); L.shadow(ctx, sx(pe.x), sy(pe.y), Math.min(14, ww * 0.8), S, 0.32); }
      }
    }
    for (i = 0; i < drawn.length; i++) {
      var dr = drawn[i];
      if (!dr.e) {
        if (L) L.drawPlayer(ctx, sx(px), sy(py), face, walked, moving, S, now, { settle: settle > 0 });
        continue;
      }
      var pp = entAt(dr.e); d.sx = sx(pp.x); d.sy = sy(pp.y);
      if (dr.k && dr.k.draw) dr.k.draw(ctx, dr.e, d);
      else { ctx.fillStyle = dr.e.colour || '#B892FF'; ctx.fillRect(d.sx - 3 * S, d.sy - 6 * S, 6 * S, 6 * S); }
    }

    if (L) {
      L.weatherDraw(ctx, camSX, camSY, S, w, h);
      var lt = lightsFor(now, camSX, camSY, v);
      L.drawLight(ctx, w, h, lt.ambient, lt.night, lt.list, camSX, camSY, S);
    }

    /* the interact prompt, above the light so it is always readable */
    var n = (!busy && !(NEU.tboxOpen && NEU.tboxOpen())) ? nearest(promptable) : null;
    if (n !== promptFor) { promptFor = n; promptT = 0; }
    if (n && L) {
      promptT += 1 / 60;
      var pn = entAt(n);
      var a = reduced ? 1 : Math.min(1, promptT / 0.12);
      ctx.globalAlpha = a;
      L.drawPrompt(ctx, sx(pn.x), sy(pn.y - 18), S, clock, padH > 0);
      ctx.globalAlpha = 1;
    }

    if (NEU.juice) { NEU.juice.drawParts(ctx, 1 / 60);
                     NEU.juice.end(ctx, shook);
                     NEU.juice.overlay(ctx, w, h); }

    if (fade > 0) {
      if (L && !reduced) L.drawIris(ctx, w, h, sx(px), sy(py - 8), fade);
      else { ctx.fillStyle = 'rgba(5,5,7,' + fade.toFixed(3) + ')'; ctx.fillRect(0, 0, w, h); }
    }
  }

  /* No look kit loaded: v1's flat palette, so the engine is never blind. */
  function drawFlat(camSX, camSY, v) {
    var ts = tilesets[room.tileset] || { colours: {}, solid: '#' };
    var cx0 = Math.max(0, Math.floor(camSX / TILE)), cy0 = Math.max(0, Math.floor(camSY / TILE));
    var cx1 = Math.min(room.w - 1, Math.ceil((camSX + v.w) / TILE)), cy1 = Math.min(room.h - 1, Math.ceil((camSY + v.h) / TILE));
    for (var cy = cy0; cy <= cy1; cy++) for (var cx = cx0; cx <= cx1; cx++) {
      var ch = at(cx, cy);
      ctx.fillStyle = (ts.colours && ts.colours[ch]) || (ts.solid.indexOf(ch) >= 0 ? '#1a1a24' : '#0d0d12');
      ctx.fillRect(Math.round((cx * TILE - camSX) * S), Math.round((cy * TILE - camSY) * S), TILE * S, TILE * S);
    }
  }

  /* ── input ────────────────────────────────────────────────────── */
  function keyName(e) {
    var k = e.key;
    if (k === 'ArrowLeft'  || k === 'a' || k === 'A') return 'left';
    if (k === 'ArrowRight' || k === 'd' || k === 'D') return 'right';
    if (k === 'ArrowUp'    || k === 'w' || k === 'W') return 'up';
    if (k === 'ArrowDown'  || k === 's' || k === 'S') return 'down';
    return null;
  }
  addEventListener('keydown', function (e) {
    if (!running) return;
    /* A minigame owns the page while it is open. */
    if (NEU.activeMinigame) return;
    if (e.key === 'Escape') { e.preventDefault(); leave(); return; }
    if (e.key === 'e' || e.key === 'E') {
      e.preventDefault();
      if (busy) return;
      /* Interact first, push second. A block you are standing next to
         is almost never what you meant when there is an npc in reach. */
      var n = nearest(interactive);
      if (n) fire(n); else tryPush();
      return;
    }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); if (!busy) resetPuzzle(); return; }
    var kn = keyName(e); if (kn) { keys[kn] = true; e.preventDefault(); }
  });
  addEventListener('keyup', function (e) {
    if (!running || NEU.activeMinigame) return;
    var kn = keyName(e); if (kn) keys[kn] = false;
  });
  /* Alt-tab away with a key held and the keyup never arrives. */
  addEventListener('blur', function () { keys = {}; });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) keys = {};
  });

  /* ── talking ──────────────────────────────────────────────────── */
  function say(lines, who) { if (NEU.talk) NEU.talk(lines, who); }
  function flag(k, v) { return NEU.save ? NEU.save.flag(k, v) : null; }

  /* ── open / close ─────────────────────────────────────────────── */
  /* opts.iris: seconds for the iris to open on arrival (default 0.22). */
  function enter(id, spawn, opts) {
    if (!rooms[id]) return false;
    wrap.hidden = false;
    document.body.classList.add('is-playing');
    if (NEU.quest) NEU.quest.lock(true);
    layout();
    land(id, spawn);
    fade = 1; fadeDir = -1; fadeThen = null;
    fadeSpan = opts && opts.iris > 0 ? opts.iris : IRIS;
    keys = {}; busy = false; acc = 0;
    /* rhythm and craft re-enter while the room still runs — a second
       loop here would tick everything at double speed. */
    if (!running) {
      running = true; last = performance.now();
      requestAnimationFrame(step);
    }
    return true;
  }

  /* ESC confirmation dialog — every minigame's "leave?" */
  function confirmExit(minigameName, onConfirm) {
    if (document.getElementById('confirmExit')) return;
    var before = document.activeElement;
    var overlay = document.createElement('div');
    overlay.id = 'confirmExit';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Leave ' + minigameName + '?');
    overlay.tabIndex = -1;
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:95;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = '<div style="background:#1A1016;padding:32px 48px;border:2px solid #E23B55;border-radius:4px;text-align:center;">' +
      '<p style="font:24px \'Determination Mono\',monospace;color:#EDE7DE;margin:0 0 16px;">Leave ' + minigameName + '?</p>' +
      '<p style="font:16px \'Undertale Sans\',cursive;color:#8A8598;margin:0 0 24px;">Enter = Yes &nbsp;·&nbsp; Escape = No</p>' +
      '<div style="display:flex;gap:16px;justify-content:center;margin:0 0 20px;">' +
        '<button type="button" data-ans="yes" style="font:20px \'Determination Mono\',monospace;color:#EDE7DE;background:#331419;border:2px solid #E23B55;padding:10px 28px;cursor:pointer;">yes</button>' +
        '<button type="button" data-ans="no" style="font:20px \'Determination Mono\',monospace;color:#EDE7DE;background:#14111A;border:2px solid #8A8598;padding:10px 28px;cursor:pointer;">no</button>' +
      '</div>' +
      '<div style="font:14px monospace;color:#555;">Progress will be lost.</div></div>';
    document.body.appendChild(overlay);
    /* Focus moves INTO the prompt (C11) — onto the dialog itself, not a
       button, so "Enter = Yes" stays true and nothing looks pre-picked. */
    try { overlay.focus(); } catch (x) {}
    var done = false;
    function cleanup() {
      if (done) return;
      done = true;
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      removeEventListener('keydown', onKey, true);
      if (before && before.focus && document.contains(before)) { try { before.focus(); } catch (x) {} }
    }
    /* Window, capture phase, and stopImmediatePropagation: the touch pad
       dispatches its synthetic Enter/Escape on window, which a document
       listener never hears, and the minigames listen on window too. */
    function onKey(e) {
      e.stopImmediatePropagation();
      if (e.key !== 'Enter' && e.key !== 'Escape' && e.key !== 'Tab') return;
      e.preventDefault();
      if (e.key === 'Tab') {
        /* a two-button trap */
        var bs = overlay.querySelectorAll('button');
        var i = Array.prototype.indexOf.call(bs, document.activeElement);
        var nx = e.shiftKey ? (i <= 0 ? bs.length - 1 : i - 1) : (i + 1) % bs.length;
        if (bs[nx]) bs[nx].focus();
        return;
      }
      var focused = document.activeElement && document.activeElement.getAttribute &&
                    document.activeElement.getAttribute('data-ans');
      if (e.key === 'Escape' || focused === 'no') { cleanup(); return; }
      cleanup(); onConfirm();
    }
    addEventListener('keydown', onKey, true);
    overlay.addEventListener('click', function (e) {
      var ans = e.target && e.target.getAttribute && e.target.getAttribute('data-ans');
      if (ans === 'yes') { cleanup(); onConfirm(); }
      else if (ans === 'no') { cleanup(); }
    });
  }

  /* The room's quit button is the same exit as its ESC. */
  var engQuitBtn = document.getElementById('engQuit');
  if (engQuitBtn) engQuitBtn.addEventListener('click', function () {
    if (!running) return;
    leave();
  });

  function leave() {
    running = false;
    clearLater();
    wrap.hidden = true;
    document.body.classList.remove('is-playing');
    if (NEU.quest) NEU.quest.lock(false);
    if (NEU.hush) NEU.hush();
    if (NEU.save) { NEU.save.capture(); NEU.save.flush(); }
  }

  var API = {
    say: say, flag: flag,
    flagged: function (k) { return NEU.save ? NEU.save.flagged(k) : false; },
    give: function (i) { if (NEU.save) NEU.save.give(i); },
    has: function (i) { return NEU.save ? NEU.save.has(i) : false; },
    go: go, leave: leave,
    busy: function (on) { busy = !!on; },
    entHere: entHere, reset: resetPuzzle, check: checkPuzzle,
    ents: function () { return ents; },
    solved: function (id) { return NEU.save ? NEU.save.flagged('solved:' + id) : false; },
    markSolved: function (id) { if (NEU.save) NEU.save.flag('solved:' + id, 1); },
    later: later,
    /* the live room definition — rooms with hooks (dark, light, onReset)
       expose their state through it, and tests read it the same way */
    get room() { return room; },
    get player() { return { x: px, y: py, face: face }; }
  };
  SYS.api = API;

  /* v1's signature, kept for dark.js: anchorFeet false centres the
     sprite vertically on (sx, sy). */
  function drawPlayerCompat(targetCtx, sx, sy, fce, wlk, mov, anchorFeet, sc) {
    var L = look(), s = sc || 2;
    if (!L) return;
    var y = anchorFeet ? sy : sy + (13 * s) / 2;
    L.drawPlayer(targetCtx || ctx, sx, y, fce || 'down', wlk || 0, !!mov, s, Date.now());
  }

  NEU.engine = {
    register: register, tileset: tileset, enter: enter, leave: leave, go: go,
    confirmExit: confirmExit,
    where: function () { return room ? { room: room.id, spawn: room.__spawn } : null; },
    get running() { return running; },
    get room() { return room ? room.id : null; },
    /* Which zone the player is standing in, by tileset name. music.js
       and engine-look both key off this — one source of truth. */
    zone: function () { return room ? room.tileset : null; },
    get rooms() { return Object.keys(rooms); },
    tilesets: function () { return tilesets; },
    api: API,
    /* dev */
    warp: function (id, spawn) { if (running) { land(id, spawn); } else { enter(id, spawn); } },
    drawPlayer: drawPlayerCompat,
    TILE: TILE,
    /* live: the scale the view was fitted at (decision 10) */
    get SCALE() { return S; },
    REACH: REACH, PLAYER_H: PLAYER_H, PLAYER_W: PLAYER_W, SPEED: SPEED,
    /* read-only internals for tests and the dev console */
    get debug() {
      return { scale: S, cam: { x: camX, y: camY }, vel: { x: vx, y: vy }, padH: padH,
               baked: !!(room && layers[room.id]), fade: fade, iris: fadeSpan, prompt: promptFor,
               lights: (room && look()) ? lightsFor(0, camX, camY, view()).list.length : 0,
               view: view(), timers: timers.length };
    },
    nearest: function () { return nearest(promptable); }
  };
})();
