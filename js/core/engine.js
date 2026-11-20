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
  try { reduced = (window.NEU && window.NEU.motion) ? window.NEU.motion.reduced() : matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  /* NEU.motion (motion.js) is the one source; it can change live. */
  if (window.NEU && window.NEU.motion) window.NEU.motion.on(function (r) {
    reduced = r;
    if (r) {
      camLeadX = camLeadY = 0; camZoomState = null; cv.style.transform = '';
      if (camPan) { camX = camPan.x; camY = camPan.y; camFocusX = camX + view().w / 2; camFocusY = camY + view().uh / 2; camPan = null; camClamp(); }
    }
  });

  var TILE = 16;              // world units per cell
  var SPEED = 96;             // world units/sec — top speed, unchanged from v1
  var ACCEL = 1100;           // u/s²: full speed in ~87 ms
  var FRICTION = 1400;        // u/s²: stop in ~69 ms, ~3 u of slide
  var CORNER = 5;             // u of overlap a corner forgives
  var PLAYER_W = 10, PLAYER_H = 8;   // the FEET box. smaller than the sprite.
  var REACH = 22;
  var STEP = 1 / 60;
  var LOOKAHEAD = 20;         // u the camera leads along velocity
  var INTERACT_COOLDOWN = 500; // ms

  function look() { return NEU.engineLook || null; }
  function kinds() { return NEU.engineKinds || null; }

  /* ── state ────────────────────────────────────────────────────── */
  var rooms = {}, tilesets = {}, aliases = {};
  var room = null, running = false, last = 0, acc = 0;
  var currentArea = null;
  var px = 0, py = 0, prevPX = 0, prevPY = 0, prevCamX = 0, prevCamY = 0, vx = 0, vy = 0, keys = {}, face = 'down', walked = 0, moving = false;
  var movedFor = 0, settle = 0;
  var camX = 0, camY = 0, camFocusX = 0, camFocusY = 0, camLeadX = 0, camLeadY = 0;
  var camHold = false, camPan = null, camZoomState = null, kickX = 0, kickY = 0;
  var S = 3;
  var fade = 0, fadeDir = 0, fadeThen = null;
  /* Seconds the iris takes. A door is quick (0.22); arriving from a
     scene that has just played its own ending can ask for a slower one
     through enter()'s opts, and it goes back to quick when it is done. */
  var IRIS = 0.22, fadeSpan = IRIS;
  var busy = false;                    // a cutscene owns input
  var hideTransitionPlayer = false, transitionCanvas = null, transitionNewCanvas = null, transitionPlayer = null, transitionStarting = false, frameNow = 0;
  var physical = null, physicalExit = null;
  var transitionCategory = null;       // last category from engineTrans.classify (one authority)
  var playerAct = null;                // { name, t, max } — a held player pose (the recall drink)
  var sitting = null;                  // { ent, x, y } — seated on a seat entity until a move key
  var cine = false;                    // a scripted walk owns the stick (api.drive)
  var paceV = 0, paceA = 0;            // api.pace: the scripted walk's top speed and acceleration (0 = the usual)
  var ents = [];                       // live copy of room.entities
  var images = {};
  var layers = {};                     // baked static layer per room id (small rooms)
  /* W1: oversized rooms paint lazily into 32-tile (512 native px) chunks.
     Each canvas is 512*512*4 = 1 MiB; the 24-chunk budget (~24 MiB) is the
     measured ceiling for one active zone. Chunks are pure visual cache — no
     land, spawn, save or area hook ever keys off a chunk coordinate. */
  var CHUNK_TILES = 32, CHUNK_PX = 512, CHUNK_BUDGET = 24 * 1024 * 1024;
  var chunks = {}, chunkOrder = [], chunkBytes = 0, chunkRoom = null, chunked = false;
  var visibleKeys = {};
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
    if (chunkRoom === id) resetChunks(null);
    return def;
  }

  function alias(oldId, newId, spawnMap, areaId) {
    if (!oldId || !newId || oldId === newId || typeof oldId !== 'string' || typeof newId !== 'string' ||
        rooms[oldId] || aliases[oldId] ||
        (spawnMap != null && (typeof spawnMap !== 'object' || Array.isArray(spawnMap))) ||
        (areaId != null && typeof areaId !== 'string')) return false;
    var names = Object.keys(spawnMap || {});
    for (var i = 0; i < names.length; i++) if (typeof spawnMap[names[i]] !== 'string') return false;
    aliases[oldId] = { id: newId, spawns: spawnMap || {}, area: areaId || null };
    return true;
  }

  /* merge(roomId, areas, opts) — declare ONE contiguous physical room from
     area defs. The a/d/s zones used to hand-roll this in their room files;
     this is that same operation as data. It reuses register()/alias()/areas[]
     below, so room, camera, flags and save keep a single authority — merge
     adds no parallel registry. Every legacy area id stays an alias with its
     old spawns and its own save namespace (entity.origin).               */
  function merge(roomId, areas, opts) {
    opts = opts || {};
    var i, j, a, p, rows, maxX = 0, maxY = 0, cursor = 0, P = [], seen = {};
    if (typeof roomId !== 'string' || !roomId || rooms[roomId] || aliases[roomId] ||
        !Array.isArray(areas) || !areas.length) return null;
    /* 1. normalise each area def into a local grid + world offset. */
    for (i = 0; i < areas.length; i++) {
      a = areas[i];
      if (!a || typeof a.id !== 'string' || !a.id || seen[a.id] || typeof a.tiles !== 'string') return null;
      seen[a.id] = true;
      rows = a.tiles.split('\n').filter(function (r) { return r.length; });
      p = { def: a, grid: rows, h: rows.length,
            w: rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0),
            /* Explicit x/y win; a missing x auto-packs left-to-right and a
               missing y sits at row 0. This covers both hand-laid footprints
               (a/d/s) and a synthetic contiguous strip. */
            x: a.x == null ? cursor : a.x | 0, y: a.y == null ? 0 : a.y | 0 };
      cursor = Math.max(cursor, p.x + p.w);
      P.push(p);
    }
    for (i = 0; i < P.length; i++) { maxX = Math.max(maxX, P[i].x + P[i].w); maxY = Math.max(maxY, P[i].y + P[i].h); }
    /* 2. world-coordinate TILE paint: every cell lands at its absolute
       x/y; filler is wall so a seam can never read as a hole. */
    var grid = [], y, x, row;
    for (y = 0; y < maxY; y++) { row = []; for (x = 0; x < maxX; x++) row.push('#'); grid.push(row); }
    for (i = 0; i < P.length; i++) {
      p = P[i];
      for (y = 0; y < p.h; y++) { row = p.grid[y]; for (x = 0; x < row.length; x++) grid[p.y + y][p.x + x] = row[x]; }
    }
    /* 3. spawns (final merged keys), area records, entities (origin-tagged). */
    var spawns = {}, areaRec = [], entList = [];
    for (i = 0; i < P.length; i++) {
      p = P[i]; a = p.def;
      var map = a.spawnMap || {}, local = a.spawns || {}, name, s, key = a.spawn || map.default;
      for (name in local) if (Object.prototype.hasOwnProperty.call(local, name)) {
        s = local[name];
        if (!s || typeof s.x !== 'number' || typeof s.y !== 'number') return null;
        spawns[name] = { x: s.x + p.x, y: s.y + p.y, face: s.face || 'down' };
      }
      if (!key || !spawns[key]) {
        /* No declared default: first open cell inside this area's footprint. */
        var found = null;
        for (y = 0; y < p.h && !found; y++) for (x = 0; x < p.w; x++)
          if (grid[p.y + y][p.x + x] !== '#') { found = { x: p.x + x, y: p.y + y, face: 'down' }; break; }
        if (!found) return null;
        key = a.id + '_default'; spawns[key] = found;
      }
      var rec = { id: a.id, x0: p.x, y0: p.y, x1: p.x + p.w - 1, y1: p.y + p.h - 1, spawn: key };
      if (typeof a.onEnter === 'function') rec.onEnter = a.onEnter;
      for (j in a.area || {}) if (Object.prototype.hasOwnProperty.call(a.area, j)) rec[j] = a.area[j];
      areaRec.push(rec);
      var src = a.entities || [], e, k;
      for (j = 0; j < src.length; j++) {
        e = {}; for (k in src[j]) if (Object.prototype.hasOwnProperty.call(src[j], k)) e[k] = src[j][k];
        if (!e.origin) e.origin = { room: a.id, x: e.x, y: e.y };
        e.part = a.id; e.x += p.x; e.y += p.y;
        entList.push(e);
      }
    }
    var def = { tileset: opts.tileset || 'woods',
      tiles: grid.map(function (r) { return r.join(''); }).join('\n'),
      spawns: spawns, areas: areaRec, entities: entList };
    for (j in opts.extra || {}) if (Object.prototype.hasOwnProperty.call(opts.extra, j)) def[j] = opts.extra[j];
    for (j in opts.hooks || {}) if (Object.prototype.hasOwnProperty.call(opts.hooks, j)) def[j] = opts.hooks[j];
    var roomDef = register(roomId, def);
    /* 4. aliases last — alias() refuses an id that is already a room. */
    for (i = 0; i < P.length; i++) {
      a = P[i].def; var amap = {}, nm;
      for (nm in a.spawnMap || {}) if (Object.prototype.hasOwnProperty.call(a.spawnMap, nm)) amap[nm] = a.spawnMap[nm];
      amap.default = a.spawn || amap.default || areaRec[i].spawn;
      alias(a.id, roomId, amap, a.id);
    }
    return roomDef;
  }

  function areaTarget(id) {
    var found = null, collision = !!rooms[id], ids = Object.keys(rooms);
    for (var i = 0; i < ids.length; i++) {
      var areas = rooms[ids[i]].areas || [];
      for (var j = 0; j < areas.length; j++) if (areas[j] && areas[j].id === id) {
        if (collision || found) return false;
        found = { room: rooms[ids[i]], area: areas[j] };
      }
    }
    return found && found.room.spawns && found.room.spawns[found.area.spawn] ? found : found ? false : null;
  }

  function resolve(id, spawn) {
    var seen = {}, mapped = false, area = null, a;
    while (aliases[id]) {
      if (seen[id]) return null;
      seen[id] = true;
      a = aliases[id];
      if (Object.prototype.hasOwnProperty.call(a.spawns, spawn)) { spawn = a.spawns[spawn]; mapped = true; }
      if (!area && a.area) area = a.area;
      id = a.id;
    }
    var directArea = areaTarget(id);
    if (directArea === false) return null;
    if (!rooms[id]) {
      var target = directArea;
      if (!target || (spawn && spawn !== target.area.spawn)) return null;
      area = target.area.id;
      spawn = target.area.spawn;
      id = target.room.id;
    }
    if (!rooms[id]) return null;
    if (area && !mapped && (!spawn || spawn === 'default' || !(rooms[id].spawns && rooms[id].spawns[spawn]))) {
      var areas = rooms[id].areas || [];
      for (var i = 0; i < areas.length; i++) if (areas[i].id === area) { spawn = areas[i].spawn; break; }
    }
    if (mapped && !(rooms[id].spawns && rooms[id].spawns[spawn])) return null;
    if (area && !(rooms[id].areas || []).some(function (a) { return a.id === area; })) return null;
    return { id: id, spawn: spawn, area: area };
  }

  function areaAt() {
    var x = Math.floor(px / TILE), y = Math.floor((py - 1) / TILE), areas = room && room.areas || [];
    for (var i = 0; i < areas.length; i++) {
      var a = areas[i];
      if (x >= a.x0 && x <= a.x1 && y >= a.y0 && y <= a.y1) return a;
    }
    return null;
  }

  function checkArea() {
    var a = areaAt(), id = a && a.id;
    if (id === currentArea) return;
    currentArea = id || null;
    room.__spawn = a ? a.spawn : ((room.spawns || {}).default ? 'default' : room.__spawn);
    if (NEU.save) NEU.save.capture();
    if (a && a.onEnter) a.onEnter(API);
  }

  /* decor('tree', [x, y, x, y, ...], extra) — a row of one prop or
     sheet as set dressing (engine-kinds `decor`), so a room lists its
     dressing in one line per kind. Data only, like register. */
  function decor(look, xy, extra) {
    var out = [];
    for (var i = 0; i + 1 < xy.length; i += 2) {
      var e = { t: 'decor', x: xy[i], y: xy[i + 1] };
      if (NEU.sheets && NEU.sheets[look]) e.sheet = look; else e.look = look;
      for (var k in extra || {}) e[k] = extra[k];
      out.push(e);
    }
    return out;
  }

  function at(cx, cy) {
    if (!room) return '#';
    if (cx < 0 || cy < 0 || cy >= room.h) return '#';
    var r = room.grid[cy];
    if (cx >= r.length) return '#';
    return r[cx];
  }

  function solidAt(cx, cy) {
    if (physicalExit && physicalExit.x === cx && physicalExit.y === cy) return false;
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
     Walk into one and press z: it moves a whole cell in the direction
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
    /* A solved room stays solved: R must never relock a door you
       earned (b5 used to clear its own flag, b6 put its lights out). */
    if (NEU.save && NEU.save.flagged('solved:' + room.id)) {
      say(['the room is done. it stays done.'], 'narr');
      return;
    }
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
    buildPartIndex();
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
  var renderEnts = [];

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
      if (exitHidden(e)) continue;
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

  /* ── exits: walk into them ────────────────────────────────────────
     An exit is entered by WALKING into it. Three cases, one test:
       - the exit cell is floor: the feet box has to be well inside it;
       - the exit cell is a wall / door-frame / undergrowth tile: the feet
         box is pressed against it while the input points into it;
       - either way the input is whatever `keys` holds, which is also what
         the touch stick feeds (touch.js dispatches arrow keydowns).
     Landing never bounces you back: every entity is a fresh copy on land,
     and an exit is ARMED only after the player has been out of contact
     with it once (e.__arm). Z / E on an exit still fires it, and an exit
     flagged `walk: false` is press-only (the old behaviour). */
  function ov(a0, a1, b0, b1) { return Math.min(a1, b1) - Math.max(a0, b0); }

  function exitTouch(e, ix, iy) {
    var x0 = e.x * TILE, y0 = e.y * TILE, x1 = x0 + TILE, y1 = y0 + TILE;
    var bx0 = px - PLAYER_W / 2, bx1 = px + PLAYER_W / 2, by0 = py - PLAYER_H, by1 = py;
    var ox = ov(bx0, bx1, x0, x1), oy = ov(by0, by1, y0, y1);
    if (ox >= 5 && oy >= 4) return true;                       // standing in it
    /* The probe is 4 units, not 2: sweep() stops a sub-step short of a
       wall (up to ~1.6 u at 60 fps, 3+ at 30 fps), so a 2-unit probe
       sometimes never reached the cell and the walk-in silently failed.
       The cross-axis overlap only has to be 1 u: nudge() cannot slide you
       along a solid exit tile, so a feet box straddling two rows could
       never get the 3 u it used to ask for. */
    if (ix && oy >= 1) {                                        // pressing sideways into it
      var ox2 = ov(bx0 + ix * 4, bx1 + ix * 4, x0, x1);
      if (ox2 > Math.max(ox, 0.5)) return true;
    }
    if (iy && ox >= 1) {                                        // pressing up / down into it
      var oy2 = ov(by0 + iy * 4, by1 + iy * 4, y0, y1);
      if (oy2 > Math.max(oy, 0.5)) return true;
    }
    return false;
  }

  /* 0..1: 1 when the feet box touches the cell, 0 beyond ~3 tiles. */
  function exitNear(e) {
    var x0 = e.x * TILE, y0 = e.y * TILE;
    var gx = Math.max(0, x0 - (px + PLAYER_W / 2), (px - PLAYER_W / 2) - (x0 + TILE));
    var gy = Math.max(0, y0 - py, (py - PLAYER_H) - (y0 + TILE));
    var g = Math.sqrt(gx * gx + gy * gy);
    return Math.max(0, Math.min(1, 1 - g / (3 * TILE)));
  }

  /* The four steps off an exit cell. Module scope because exitSide runs
     for every door on every frame; it only reads this table. */
  var EXIT_D = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
  /* 'n' | 's' | 'e' | 'w': the side of the exit cell that faces walkable
     floor. When several do, the one pointing most toward the room's
     interior; when none does, toward the interior anyway. */
  function exitSide(e) {
    if (!room) return 's';
    var ccx = room.w / 2 - 0.5, ccy = room.h / 2 - 0.5;
    var vx_ = ccx - e.x, vy_ = ccy - e.y, best = null, bs = -Infinity, any = null, as = -Infinity;
    for (var k in EXIT_D) {
      var nx = e.x + EXIT_D[k][0], ny = e.y + EXIT_D[k][1];
      var score = EXIT_D[k][0] * vx_ + EXIT_D[k][1] * vy_;
      if (score > as) { as = score; any = k; }
      if (nx < 0 || ny < 0 || ny >= room.h || nx >= room.grid[ny].length) continue;
      if (solidAt(nx, ny)) continue;
      if (score > bs) { bs = score; best = k; }
    }
    return best || any;
  }

  /* A locked exit that carries a `sheet` (b7_altar's fire door) does not
     exist until its lock is satisfied: not drawn, lit, prompted or bumped.
     `hiddenLocked: false` opts a sheet exit out; `hiddenLocked: true` opts
     any exit in. */
  function exitHidden(e) {
    if (e.t !== 'exit' || !e.locked) return false;
    if (NEU.save && NEU.save.flagged(e.locked)) return false;
    return e.hiddenLocked === undefined ? !!e.sheet : !!e.hiddenLocked;
  }

  /* The context the door art gets (see engine-kinds.js, kind 'exit'). */
  function doorCtx(d, e) {
    d.open = !e.locked || !!(NEU.save && NEU.save.flagged(e.locked));
    if (room.doorCtx) room.doorCtx(d, e);   /* a room may stage its own door (b1 cast) */
    d.side = exitSide(e);
    d.near = e.__transitionNear === undefined ? exitNear(e) : e.__transitionNear;
    d.tileset = room.tileset;
    d.room = room.id;                 /* exits see the id; every other kind the room */
    d.T = TILE;
    return d;
  }

  function walkExits() {
    if (!room || busy || fadeDir || slideD || NEU.activeMinigame) return;
    if (NEU.tboxOpen && NEU.tboxOpen()) return;
    var ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    var iy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    var hit = null;
    for (var i = 0; i < ents.length; i++) {
      var e = ents[i];
      if (e.t !== 'exit' || e.dead || e.walk === false || exitHidden(e)) continue;
      if (!exitTouch(e, ix, iy)) { e.__arm = true; continue; }
      if (!e.__arm || hit) continue;
      hit = e;
    }
    if (!hit) return;
    hit.__arm = false;                 /* once per approach */
    var open = !hit.locked || !!(NEU.save && NEU.save.flagged(hit.locked));
    if (open) {
      if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick();
      fire(hit);
      return;
    }
    /* Locked: it talks when bumped if it is a wall / frame tile or a
       labelled door. A locked THING on open floor (the fire door, the
       painted door) stays press-only, or it would nag every time you
       crossed its cell. */
    var solid = solidAt(hit.x, hit.y);
    if (solid || hit.label) fire(hit);
  }

  /* Rapid e on the same entity inside the cooldown is one press. */
  var lastInteractedEntity = null, lastInteractedTime = 0;

  var SYS = {
    say: function (l, w) { say(l, w); },
    go: function (id, sp, via, exit) { go(id, sp, via, exit); },
    flag: function (k, v) { return flag(k, v); },
    room: function () { return room; },
    key: function (prefix, e) { return entityKey(prefix, room, e); },
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
  function dirVector(dir) { return DIRV[dir] || ({ n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] })[dir] || [0, 1]; }
  /* W1: a hi-dpi 1440p viewport makes cv 5120px wide. Snapshot canvases must
     stay under the 4096 allocation ceiling; downscale the copy so the whole
     frame survives even then (display coordinates are unchanged). */
  var SNAP_CAP = 4096;
  function snapshotInto(canvas) {
    var w = Math.max(1, Math.min(SNAP_CAP, cv.width | 0)), h = Math.max(1, Math.min(SNAP_CAP, cv.height | 0));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    var c = canvas.getContext('2d');
    if (c) {
      if (w === cv.width && h === cv.height) c.drawImage(cv, 0, 0);
      else c.drawImage(cv, 0, 0, w, h);
    }
    return c;
  }
  function captureTransition(canvas) {
    prevPX = px; prevPY = py; prevCamX = camX; prevCamY = camY;
    hideTransitionPlayer = true; draw(frameNow); hideTransitionPlayer = false;
    snapshotInto(canvas);
  }
  function finishPhysical() {
    var held = physical && physical.heldKeys || {}, wasCine = !!(physical && physical.wasCine);
    if (physicalExit) delete physicalExit.__transitionNear;
    physicalExit = null; physical = null; transitionPlayer = null; transitionStarting = false;
    cine = wasCine; if (!cine) keys = held; busy = false;
  }
  function startPhysicalSlide(kind, dir, ms) {
    var wall = tilesets[room.tileset] && tilesets[room.tileset].colours && tilesets[room.tileset].colours['#'];
    captureTransition(transitionCanvas);
    var x = Math.round(px * S) - Math.round((camX + kickX) * S), y = Math.round(py * S) - Math.round((camY + kickY) * S);
    if (physicalExit) delete physicalExit.__transitionNear;
    physicalExit = null;
    if (!land(physical.id, physical.spawn)) { finishPhysical(); return; }
    captureTransition(transitionNewCanvas);
    if (!NEU.engineTrans.start(kind, transitionCanvas, dir, reduced, transitionNewCanvas, { ms: ms, wall: wall })) { finishPhysical(); return; }
    transitionPlayer = { x: x, y: y, toX: Math.round(px * S) - Math.round((camX + kickX) * S), toY: Math.round(py * S) - Math.round((camY + kickY) * S) };
    physical.stage = 'slide'; physical.elapsed = 0;
  }
  function walkPhysical(dt) {
    var p = physical, v = p.vector;
    API.drive(v[0], v[1]);
    move(dt);
    if (Math.sqrt(Math.pow(p.target.x - px, 2) + Math.pow(p.target.y - py, 2)) < 1 || p.elapsed > 0.28) {
      px = p.target.x; py = p.target.y; vx = 0; vy = 0; moving = false; p.stage = p.next;
      if (p.stage === 'capture') startPhysicalSlide('slide', p.dir, 220);
      else if (p.stage === 'close') p.elapsed = 0;
    }
  }
  function advancePhysical(dt) {
    var p = physical;
    if (!p) return;
    p.elapsed += dt;
    if (p.stage === 'open') {
      var step = Math.min(2, Math.floor(p.elapsed / 0.09));
      while (step > p.step) { p.step++; p.exit.__transitionNear = p.step / 2; if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick(); }
      if (p.elapsed >= 0.18) { p.stage = 'inwalk'; p.elapsed = 0; p.vector = dirVector(exitSide(p.exit)); p.vector = [-p.vector[0], -p.vector[1]]; p.target = { x: px + p.vector[0] * TILE, y: py + p.vector[1] * TILE }; p.next = 'capture'; }
      return;
    }
    if (p.stage === 'inwalk' || p.stage === 'outwalk') { walkPhysical(dt); return; }
    if (p.stage === 'close') {
      var shut = 2 - Math.min(2, Math.floor(p.elapsed / 0.09));
      if (shut < p.shut) { p.shut = shut; p.exit.__transitionNear = shut / 2; if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick(); }
      if (p.elapsed >= 0.18) finishPhysical();
      return;
    }
    if (p.stage === 'fall') {
      py = p.fromY + Math.min(1, p.elapsed / 0.18) * 8;
      if (p.elapsed >= 0.18) startPhysicalSlide('fall', 'down', 520);
      return;
    }
    if (p.stage === 'slide') {
      if (p.kind === 'stairs') {
        var ticks = Math.min(3, Math.floor((p.elapsed + 0.001) / 0.09));
        while (ticks > p.step) { p.step++; if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick(); }
        transitionPlayer.bob = p.step % 2 ? -S : 0;
      }
      if (NEU.engineTrans.active && NEU.engineTrans.step(dt)) return;
      transitionPlayer = null;
      if (p.kind === 'door') {
        var reverse = null, reverseDistance = Infinity, reverseCandidate, reverseD, ri;
        for (ri = 0; ri < ents.length; ri++) {
          reverseCandidate = ents[ri];
          if (reverseCandidate.t !== 'exit' || reverseCandidate.to !== p.from) continue;
          reverseD = Math.abs(reverseCandidate.x * TILE + TILE / 2 - px) + Math.abs(reverseCandidate.y * TILE + TILE / 2 - py);
          if (reverseD < reverseDistance) { reverse = reverseCandidate; reverseDistance = reverseD; }
        }
        if (!reverse) { finishPhysical(); return; }
        physicalExit = reverse; reverse.__transitionNear = 1;
        p.exit = reverse; p.vector = dirVector(exitSide(reverse)); p.target = { x: px + p.vector[0] * TILE, y: py + p.vector[1] * TILE }; p.stage = 'outwalk'; p.next = 'close'; p.elapsed = 0; p.shut = 2;
      } else {
        if (p.kind === 'fall') { settle = 0.09; if (NEU.juice) { NEU.juice.hit('small'); NEU.juice.burst(Math.round((px - camX) * S), Math.round((py - camY) * S), 8, '#D8C8B0'); } }
        finishPhysical();
      }
    }
  }
  function beginPhysical(id, spawn, kind, dir, exit) {
    if (!exit || reduced) { land(id, spawn); busy = false; return; }
    var held = {}, key, wasCine = cine;
    for (key in keys) if (keys[key]) held[key] = true;
    physicalExit = exit; transitionStarting = true; busy = true; cine = true; keys = {};
    if (!transitionCanvas) transitionCanvas = document.createElement('canvas');
    if (!transitionNewCanvas) transitionNewCanvas = document.createElement('canvas');
    physical = { id: id, spawn: spawn, kind: kind, dir: dir, exit: exit, from: room.id, heldKeys: held, wasCine: wasCine, stage: kind === 'door' ? 'open' : kind === 'fall' ? 'fall' : 'slide', elapsed: 0, step: 0, shut: 2, fromY: py };
    if (kind === 'door') { exit.__transitionNear = 0; exit.__arm = false; }
    if (kind === 'fall') settle = 0.18;
    if (kind === 'stairs') startPhysicalSlide('slide', dir, 270);
  }
  /* SEAMLESS: the a1/a2/a3 areas share one grid, so landing at the
     neighbour's spawn leaves the camera where the player already is.
     Keep held keys and travel velocity across the seam; never fade, never
     write a save mid-portal (land() saves once, at the safe spawn). */
  function seamlessGo(id, spawn) {
    var held = {}, k, dx = vx, dy = vy;
    for (k in keys) if (keys[k]) held[k] = true;
    if (!land(id, spawn)) { busy = false; return; }
    keys = held; vx = dx; vy = dy;
    fade = 0; fadeDir = 0; fadeThen = null;
    busy = false;
  }
  function go(id, spawn, via, exit) {
    if (!resolve(id, spawn)) { say(['there is nothing through there. yet.'], 'narr'); return; }
    var T = NEU.engineTrans, kind = null, dir = face;
    if (fadeDir || transitionStarting || (T && T.active)) return;
    if (T && room && T.enabled[room.tileset]) {
      if (!exit) for (var ei = 0; ei < ents.length; ei++) if (ents[ei].t === 'exit' && ents[ei].to === id) { exit = ents[ei]; break; }
      var doors = NEU.engineDoors, pick = doors && doors.byExit[room.id + '>' + id];
      var resolved = exit && doors && doors.resolve(exit, doorCtx({}, exit));
      via = via || (exit && exit.via) || (pick && pick.via);
      var style = (resolved && resolved.name) || (exit && exit.style) || (pick && pick.style) || '';
      if (!via) via = /^(door|gate|curtain|alley)$/.test(style) ? 'door' : style === 'stairs' ? 'stairs' : style === 'hatch' ? 'fall' : /^(path|tunnel|arch)$/.test(style) ? 'slide' : /^(portal|rift|frame)$/.test(style) ? 'portal' : '';
      kind = via && T.get(via) ? via : null;
      if (exit && /^(left|right|up|down)$/.test(exit.dir || '')) dir = exit.dir;
      else if (pick && /^(left|right|up|down)$/.test(pick.dir || '')) dir = pick.dir;
    }
    var seam = !!(room && room.tileset === 'woods' && /^a[123]_/.test(currentArea || room.id) && /^a[123]_/.test(id));
    if (via === 'split' || /^(rift|crack|painting)$/.test(style || '')) kind = 'split';
    transitionCategory = T && T.classify ? T.classify({ seamless: seam, style: style, via: via, kind: kind,
      cine: /^cine:/.test((via || '') + (style || '')), mode: /^mode:/.test(kind || '') }) : 'CINEMATIC';
    if (transitionCategory === 'SEAMLESS') { seamlessGo(id, spawn); return; }
    busy = true;
    if (/^(door|stairs|fall)$/.test(kind || '')) { beginPhysical(id, spawn, kind, dir, exit); return; }
    if (kind) {
      if (reduced) { land(id, spawn); busy = false; return; }
      transitionStarting = true;
      if (!transitionCanvas) transitionCanvas = document.createElement('canvas');
      var fromX = Math.round(px * S) - Math.round((camX + kickX) * S);
      var fromY = Math.round(py * S) - Math.round((camY + kickY) * S);
      hideTransitionPlayer = true; draw(frameNow); hideTransitionPlayer = false;
      var tc = snapshotInto(transitionCanvas);
      land(id, spawn);
      if (!transitionNewCanvas) transitionNewCanvas = document.createElement('canvas');
      hideTransitionPlayer = true; draw(frameNow); hideTransitionPlayer = false;
      tc = snapshotInto(transitionNewCanvas);
      if (T.start(kind, transitionCanvas, dir, reduced, transitionNewCanvas)) {
        transitionPlayer = { x: fromX, y: fromY,
          toX: Math.round(px * S) - Math.round((camX + kickX) * S),
          toY: Math.round(py * S) - Math.round((camY + kickY) * S) };
      } else { transitionPlayer = null; busy = false; }
      transitionStarting = false;
      return;
    }
    fadeDir = 1;
    fadeThen = function () {
      land(id, spawn);
      fadeDir = -1;
      fadeThen = function () { busy = false; };
    };
    if (reduced) { fade = 1; }              // no iris, just the cut
  }

  function entityKey(prefix, r, e) {
    var o = e.origin || {}, id = o.room || r.id;
    var x = o.x != null ? o.x : e.x, y = o.y != null ? o.y : e.y;
    return prefix + ':' + id + ':' + (prefix === 'gone' && e.mush ? e.mush : x + ',' + y);
  }

  function goneKey(r, e) { return entityKey('gone', r, e); }

  function spawnEnts(r) {
    return (r.entities || []).filter(function (e) {
      return !(NEU.save && NEU.save.flagged(goneKey(r, e)));
    }).map(function (e) {
      var c = {}; for (var k in e) c[k] = e[k];
      /* Pickups already taken and one-shot triggers already fired stay
         gone across a reload — otherwise the save file hands out
         infinite copies of every item. "Taken" is its own flag now, not
         "still in your pocket" (see engine-kinds pickup). */
      if (c.t === 'pickup' && NEU.save &&
          (NEU.save.has(c.item) || NEU.save.flagged(entityKey('p', r, c)))) c.dead = true;
      if (c.once && NEU.save && NEU.save.flagged(entityKey('t', r, c))) c.dead = true;
      return c;
    });
  }

  /* Entity partition. origin.room is the one authority for an entity's
     legacy area (that is also what keys its saves); `part` is set by merge()
     but hand-merged rooms carry origin.room too, so one index covers both.
     Holds references, never copies, so death / pushed blocks / R-reset are
     reflected without a second authority. Read-only: lookup and the fixed
     60 Hz swept sim keep scanning `ents`; the index only answers culling /
     per-area queries (proven in fixes930). */
  var partIndex = {};
  function buildPartIndex() {
    partIndex = {};
    for (var i = 0; i < ents.length; i++) {
      var p = ents[i].part || (ents[i].origin && ents[i].origin.room) || (room && room.id) || '?';
      (partIndex[p] || (partIndex[p] = [])).push(ents[i]);
    }
  }
  function entsInPart(id) {
    var list = partIndex[id] || [], out = [];
    for (var i = 0; i < list.length; i++) if (!list[i].dead) out.push(list[i]);
    return out;
  }
  function partInfo() {
    var counts = {}, parts = [], total = 0;
    for (var p in partIndex) if (Object.prototype.hasOwnProperty.call(partIndex, p)) {
      var live = entsInPart(p); counts[p] = live.length; total += live.length; parts.push(p);
    }
    return { room: room ? room.id : null, parts: parts, counts: counts, total: total };
  }

  /* Taking an entity's item for good. The gone flag keeps spawnEnts from
     putting it back on any later visit; the chime and burst match the
     pickup kind so a taken thing feels the same whichever kind it is. */
  NEU.take = function (e, item, lines, who, key) {
    if (!room || !e) return;
    e.dead = true;
    if (NEU.save) { NEU.save.give(item); NEU.save.flag(key || goneKey(room, e), 1); }
    if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
    if (NEU.juice) { NEU.juice.hit('small'); SYS.burst(e, 10, '#B892FF'); }
    say(lines || ['* You got the ' + item.toUpperCase() + '.'], who || 'narr');
  };

  /* Only reached by a room that declares no spawns at all. */
  function firstOpenCell() {
    for (var y = 0; y < room.h; y++)
      for (var x = 0; x < room.w; x++)
        if (!solidAt(x, y)) return { x: x, y: y };
    return { x: 2, y: 2 };
  }

  function land(id, spawn) {
    var target = resolve(id, spawn), selected;
    if (!target) return false;
    if (room && room.onExit) room.onExit(API);
    clearLater();
    room = rooms[target.id];
    /* A solved puzzle stays solved across a revisit, but the blocks go
       back to their starting cells. */
    room.__solved = NEU.save ? NEU.save.flagged('solved:' + target.id) : false;
    ents = spawnEnts(room);
    buildPartIndex();
    var s = (room.spawns && room.spawns[target.spawn]) || (room.spawns && room.spawns.default);
    if (!s) {
      /* An exit naming a spawn the target room does not declare is a
         bug in the room, and it must not be able to pass for level
         design: prefer any declared spawn, then floor, and say so. */
      var names = room.spawns ? Object.keys(room.spawns) : [];
      s = names.length ? room.spawns[names[0]] : firstOpenCell();
      if (window.console && console.warn)
        console.warn('[neu] room "' + target.id + '" has no spawn "' + target.spawn +
                     '" — landing at ' + s.x + ',' + s.y);
    }
    px = (s.x + 0.5) * TILE; py = (s.y + 1) * TILE;
    vx = 0; vy = 0; walked = 0; face = s.face || 'down';
    slideD = 0; slideDead = false; promptFor = null; sitting = null;
    room.__spawn = target.spawn;
    selected = target.area && (room.areas || []).filter(function (a) { return a.id === target.area; })[0];
    if (!selected) selected = areaAt();
    currentArea = selected ? selected.id : null;
    if (selected) room.__spawn = selected.spawn;
    bake();
    camSnap();
    var L = look();
    if (L) L.weatherReset(L.zone(room.tileset).weather, room);
    /* A room change must not carry the old room's dialogue. */
    if (NEU.talk && NEU.talk.close) NEU.talk.close();
    if (room.onEnter) room.onEnter(API);
    if (selected && selected.onEnter) selected.onEnter(API);
    prevPX = px; prevPY = py; prevCamX = camX; prevCamY = camY;
    if (NEU.save) NEU.save.capture();
    return true;
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
  function resetChunks(id) {
    chunks = {}; chunkOrder = []; chunkBytes = 0;
    chunkRoom = id || (room ? room.id : null);
  }
  function chunkKey(cx, cy) { return cx + ',' + cy; }
  function touchChunk(k) {
    var i = chunkOrder.indexOf(k);
    if (i >= 0) { chunkOrder.splice(i, 1); chunkOrder.push(k); }
  }
  function needChunk(cx, cy) {
    if (!room) return null;
    var k = chunkKey(cx, cy), cv = chunks[k];
    if (cv) { touchChunk(k); return cv; }
    var L = look();
    if (!L || !L.bakeChunk) return null;
    try { cv = L.bakeChunk(room, tilesets[room.tileset], room.tileset, cx, cy); }
    catch (e) {
      if (window.console && console.warn) console.warn('[neu] chunk bake failed: ' + k, e);
      return null;
    }
    if (!cv) return null;
    chunks[k] = cv; chunkOrder.push(k); chunkBytes += CHUNK_PX * CHUNK_PX * 4;
    return cv;
  }
  function evictChunks(vis) {
    var guard = 0, k, cv;
    while (chunkBytes > CHUNK_BUDGET && chunkOrder.length && guard++ < CHUNK_TILES * 4) {
      k = chunkOrder[0];
      if (vis && vis[k]) { chunkOrder.shift(); chunkOrder.push(k); continue; }
      cv = chunks[k];
      if (cv) chunkBytes -= CHUNK_PX * CHUNK_PX * 4;
      delete chunks[k]; chunkOrder.shift();
    }
  }
  function chunkRange(camSX, camSY, v, padX, padY) {
    var n = CHUNK_TILES * TILE;
    var x0 = Math.max(0, Math.floor((camSX - padX) / n));
    var y0 = Math.max(0, Math.floor((camSY - padY) / n));
    var x1 = Math.min(Math.floor((room.w - 1) / CHUNK_TILES), Math.floor((camSX + v.w + padX) / n));
    var y1 = Math.min(Math.floor((room.h - 1) / CHUNK_TILES), Math.floor((camSY + v.h + padY) / n));
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }
  /* Flat tiles for a chunk not baked yet — a cold miss still shows ground
     immediately instead of a hole. Bounded to the one 32x32 tile rect. */
  function drawFlatChunk(cx, cy, camSX, camSY, S) {
    var ts = tilesets[room.tileset] || { colours: {}, solid: '#' };
    var x0 = cx * CHUNK_TILES, y0 = cy * CHUNK_TILES;
    var x1 = Math.min(room.w, x0 + CHUNK_TILES), y1 = Math.min(room.h, y0 + CHUNK_TILES);
    for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) {
      var ch = at(x, y);
      ctx.fillStyle = (ts.colours && ts.colours[ch]) || (ts.solid.indexOf(ch) >= 0 ? '#1a1a24' : '#0d0d12');
      ctx.fillRect(Math.round((x * TILE - camSX) * S), Math.round((y * TILE - camSY) * S), TILE * S, TILE * S);
    }
  }
  function drawChunkLayer(camSX, camSY, ox, oy, S, v) {
    var vis = chunkRange(camSX, camSY, v, 0, 0);
    var ahead = Math.ceil(v.w / (CHUNK_TILES * TILE)) + 1;
    var pre = chunkRange(camSX, camSY, v, ahead * CHUNK_TILES * TILE, 0);
    var k, cx, cy, cv, made = 0, prewarmed = false, smooth;
    visibleKeys = {};
    /* visible chunks first, bounded so a cold teleport cannot spike a frame */
    for (cy = vis.y0; cy <= vis.y1; cy++) for (cx = vis.x0; cx <= vis.x1; cx++) {
      k = chunkKey(cx, cy); visibleKeys[k] = 1;
      cv = chunks[k];
      if (cv) touchChunk(k);
      else if (made < 3) { if (needChunk(cx, cy)) made++; }
    }
    /* prewarm exactly one chunk per frame, one camera-width outside the view */
    for (cy = pre.y0; cy <= pre.y1 && !prewarmed; cy++) for (cx = pre.x0; cx <= pre.x1 && !prewarmed; cx++) {
      k = chunkKey(cx, cy);
      if (!visibleKeys[k] && !chunks[k]) { needChunk(cx, cy); prewarmed = true; }
    }
    evictChunks(visibleKeys);
    smooth = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
    for (cy = vis.y0; cy <= vis.y1; cy++) for (cx = vis.x0; cx <= vis.x1; cx++) {
      cv = chunks[chunkKey(cx, cy)];
      if (cv) ctx.drawImage(cv, Math.round(cx * CHUNK_PX * S) - ox, Math.round(cy * CHUNK_PX * S) - oy, CHUNK_PX * S, CHUNK_PX * S);
      else drawFlatChunk(cx, cy, camSX, camSY, S);
    }
    ctx.imageSmoothingEnabled = smooth;
  }
  function chunkInfo() {
    var L = look();
    return { chunked: chunked, size: CHUNK_PX, tiles: CHUNK_TILES, count: chunkOrder.length,
      bytes: chunkBytes, budget: CHUNK_BUDGET, room: chunkRoom, visible: Object.keys(visibleKeys).length,
      alloc: L && L.allocStats ? { made: L.allocStats.made, over: L.allocStats.over, maxSide: L.allocStats.maxSide } : null };
  }
  function bake() {
    var L = look();
    if (!L || !room) return;
    var ts = tilesets[room.tileset];
    var big = room.w * TILE > L.ALLOC_CAP || room.h * TILE > L.ALLOC_CAP;
    if (big && L.bakeChunk) {
      if (chunkRoom !== room.id) resetChunks();
      chunked = true;
      return;
    }
    chunked = false;
    if (chunkOrder.length) resetChunks(null);
    if (layers[room.id]) return;
    try { layers[room.id] = L.bakeRoom(room, ts, room.tileset); } catch (e) { layers[room.id] = null; }
  }

  /* ── camera ───────────────────────────────────────────────────── */
  function chooseScale() {
    var s = Math.floor(Math.min(innerWidth / (20 * TILE), innerHeight / (12 * TILE)));
    return Math.max(2, Math.min(12, s || 2));
  }
  function view() {
    return { w: innerWidth / S, h: innerHeight / S, uh: Math.max(1, innerHeight) / S };
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
    var v = view();
    return { x: camFocusX + camLeadX - v.w / 2, y: camFocusY + camLeadY - v.uh / 2 };
  }
  function camReset() {
    camHold = false; camPan = null; camZoomState = null; camLeadX = camLeadY = 0;
    cv.style.transform = ''; cv.style.transformOrigin = '';
  }
  function camSnap() { camReset(); camFocusX = px; camFocusY = py - 6; var t = camTarget(); camX = t.x; camY = t.y; camClamp(); prevPX = px; prevPY = py; prevCamX = camX; prevCamY = camY; }
  function camFollow(dt) {
    if (camPan) {
      camPan.t += dt;
      var p = camPan.ms ? Math.min(1, camPan.t / camPan.ms) : 1;
      p = 1 - Math.pow(1 - p, 3);
      camX = camPan.sx + (camPan.x - camPan.sx) * p; camY = camPan.sy + (camPan.y - camPan.sy) * p;
      if (p >= 1) { camFocusX = camPan.x + view().w / 2; camFocusY = camPan.y + view().uh / 2; camPan = null; }
      camClamp(); return;
    }
    if (camHold) return;
    var dx = px - camFocusX, dy = (py - 6) - camFocusY;
    if (Math.abs(dx) > 12) camFocusX += dx - (dx < 0 ? -12 : 12);
    if (Math.abs(dy) > 8) camFocusY += dy - (dy < 0 ? -8 : 8);
    var speed = Math.sqrt(vx * vx + vy * vy), lx = reduced || !speed ? 0 : vx / speed * LOOKAHEAD;
    var ly = reduced || !speed ? 0 : vy / speed * LOOKAHEAD, lk = 1 - Math.exp(-4 * dt);
    camLeadX += (lx - camLeadX) * lk; camLeadY += (ly - camLeadY) * lk;
    var t = camTarget(), k = 1 - Math.exp(-10 * dt);
    camX += (t.x - camX) * k; camY += (t.y - camY) * k;
    camClamp();
  }
  function camTo(x, y, ms) {
    var v = view(), tx = x - v.w / 2, ty = y - v.uh / 2;
    camHold = true;
    if (reduced || !ms) { camX = tx; camY = ty; camFocusX = x; camFocusY = y; camPan = null; camClamp(); prevCamX = camX; prevCamY = camY; return; }
    camPan = { sx: camX, sy: camY, x: tx, y: ty, t: 0, ms: ms / 1000 };
  }
  function camZoom(k, ms) {
    if (reduced) { cv.style.transform = ''; camZoomState = null; return; }
    var from = parseFloat((cv.style.transform.match(/scale\(([^)]+)\)/) || [0, 1])[1]) || 1;
    camZoomOrigin();
    if (!ms) { cv.style.transform = k === 1 ? '' : 'scale(' + k + ')'; camZoomState = null; return; }
    camZoomState = { from: from, to: k, t: 0, ms: ms / 1000 };
  }
  function camZoomOrigin() {
    cv.style.transformOrigin = (Math.round(camFocusX * S) - Math.round(camX * S)) + 'px ' +
      (Math.round(camFocusY * S) - Math.round(camY * S)) + 'px';
  }
  function camZoomStep(dt) {
    if (camZoomState) {
      camZoomState.t += dt;
      var p = Math.min(1, camZoomState.t / camZoomState.ms), eased = 1 - Math.pow(1 - p, 3);
      var z = camZoomState.from + (camZoomState.to - camZoomState.from) * eased;
      cv.style.transform = Math.abs(z - 1) < 0.001 ? '' : 'scale(' + z + ')';
      if (p >= 1) camZoomState = null;
    }
    if (cv.style.transform) camZoomOrigin();
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
    if (room) camClamp();
  }
  /* A window drag fires resize dozens of times a frame; lay out once per frame. */
  var layoutQueued = false;
  addEventListener('resize', function () {
    if (!running || layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(function () { layoutQueued = false; if (running) layout(); });
  });

  function update(dt) {
    if (room) { prevPX = px; prevPY = py; prevCamX = camX; prevCamY = camY; }
    clock += dt;
    if (fadeDir) {
      fade += fadeDir * dt / fadeSpan;
      if (fade >= 1 && fadeDir > 0) { fade = 1; fadeDir = 0; fadeSpan = IRIS; var f = fadeThen; fadeThen = null; if (f) f(); }
      else if (fade <= 0 && fadeDir < 0) { fade = 0; fadeDir = 0; fadeSpan = IRIS; var g = fadeThen; fadeThen = null; if (g) g(); }
    }
    if (physical) advancePhysical(dt);
    else if (transitionPlayer && NEU.engineTrans && NEU.engineTrans.active && !NEU.engineTrans.step(dt)) { busy = false; transitionPlayer = null; }
    if (!room) return;

    if (!busy) { if (!NEU.activeMinigame) move(dt); walkExits(); }
    else if (!physical || !/^(inwalk|outwalk)$/.test(physical.stage)) { vx = 0; vy = 0; moving = false; }
    checkArea();
    camFollow(dt);
    camZoomStep(dt);
    var decay = Math.exp(-14 * dt);
    kickX *= decay; kickY *= decay;
    if (settle > 0) settle -= dt;
    if (playerAct && (playerAct.t -= dt) <= 0) playerAct = null;
    var L = look();
    if (L) L.weatherStep(dt, room);
  }

  function move(dt) {
    var ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    var iy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    /* Seated: a move key stands you up through api.sit's reverse frames. */
    if (sitting && (ix || iy)) { API.sit(sitting.ent); return; }
    /* Seated: the stick is dead until a direction is pressed, which is
       also what stands you back up. */
    if (sitting) {
      if (ix || iy) { sitting = null; settle = 0.09; }
      else { vx = 0; vy = 0; moving = false; return; }
    }
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
        /* The cell test above reads the feet row, the sweep reads the whole
           feet box: a pillar the box clips is solid to one and open to the
           other. No progress means the wall is here, so the slide ends. */
        if (px === bp && py === bq) stopSlide();
        checkTriggers(); checkPuzzle();
      }
      return;
    }

    if (ix || iy) {
      var len = Math.sqrt(ix * ix + iy * iy);
      var top = cine && paceV ? paceV : SPEED, acc = cine && paceA ? paceA : ACCEL;   /* a scripted walk may set its own pace */
      vx = approach(vx, ix / len * top, acc * dt);
      vy = approach(vy, iy / len * top, acc * dt);
      face = Math.abs(ix) > Math.abs(iy) ? (ix > 0 ? 'right' : 'left') : (iy > 0 ? 'down' : 'up');
      if (!ix) vx = approach(vx, 0, FRICTION * dt);
      if (!iy) vy = approach(vy, 0, FRICTION * dt);
    } else {
      /* a cinematic's released stick is a hard stop, no coast */
      if (cine) { vx = 0; vy = 0; }
      else { vx = approach(vx, 0, FRICTION * dt); vy = approach(vy, 0, FRICTION * dt); }
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
    frameNow = now;
    requestAnimationFrame(step);
    var dt = (now - last) / 1000; last = now;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    var pf = NEU.perf && NEU.perf.running ? performance.now() : 0;
    var n = 0;
    while (acc >= STEP && n < 16) { update(STEP); acc -= STEP; n++; }
    if (n >= 16) acc = 0;
    /* the pace cap (perf.js): on a 240 Hz panel an uncapped draw burns
       four redraws of one 60 Hz step and misses the vsync budget. */
    if (!NEU.perf || NEU.perf.paced(now)) draw(now);
    if (pf) NEU.perf.work(performance.now() - pf);
  }

  /* ── draw ─────────────────────────────────────────────────────── */
  function lightsFor(now, camSX, camSY, v, playerX, playerY) {
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
      else if (!hideTransitionPlayer) out.push({ x: playerX, y: playerY - 6, r: 20, a: 0.8 });
    } else if (ambient < 0.8 && !hideTransitionPlayer) {
      out.push({ x: playerX, y: playerY - 6, r: 34, a: 0.5 });
    }
    /* entity lights */
    for (var i = 0; i < ents.length; i++) {
      var e = ents[i];
      if (e.dead || exitHidden(e)) continue;
      var k = K ? K.get(e) : null;
      if (e.t === 'exit') doorCtx(d, e);
      var li = k && k.light ? k.light(e, d) : null;
      d.room = room;                  /* doorCtx lent the exit the id; give the room back */
      if (!li) continue;
      var p = entAt(e);
      var r = li.r;
      if (p.x + r + 32 < camX || p.x - r - 32 > camX + v.w || p.y + r + 32 < camY || p.y - r - 32 > camY + v.h) continue;
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

  /* Floors that paint every pixel of the room opaque (the look modules'
     room paints). They are drawn right after the baked layer and the
     animated tiles and hide both, so neither is drawn under them. */
  var OPAQUE_FLOOR = { woodsfloor: 1, castlefloor: 1, scalfloor: 1, cityfloor: 1, prizefloor: 1 };
  function floorHidesLayer(K) {
    if (!K) return false;
    for (var i = 0; i < ents.length; i++) {
      var e = ents[i];
      if (e.dead || !OPAQUE_FLOOR[e.t]) continue;
      var k = K.get(e);
      if (k && k.floor && k.draw) return true;
    }
    return false;
  }

  function draw(now) {
    var w = innerWidth, h = innerHeight;
    ctx.fillStyle = '#050507'; ctx.fillRect(0, 0, w, h);
    if (!room) return;
    var trans = transitionPlayer && NEU.engineTrans && NEU.engineTrans.active ? NEU.engineTrans.motion(w, h, S) : null;
    if (trans) {
      var tl = look(), tr = NEU.engineTrans.active, tp = transitionPlayer;
      NEU.engineTrans.draw(ctx, w, h, S);
      if (tl && tp) {
        var pt = 1 - Math.pow(1 - tr.t, 3);
        var tx = Math.round((tp.x + (tp.toX - tp.x) * pt) / S) * S;
        var ty = Math.round((tp.y + (tp.toY - tp.y) * pt) / S) * S + (tp.bob || 0);
        tl.drawPlayer(ctx, tx, ty, face, walked + (Math.abs(tx - tp.x) + Math.abs(ty - tp.y)) / S, true, S, now);
      }
      return;
    }
    var L = look(), K = kinds();
    var shook = NEU.juice ? NEU.juice.begin(ctx, w, h) : false;
    var v = view();
    /* Pixel-snap the camera once; every world→screen conversion below
       rounds against the same origin, so sprites never shimmer against
       the floor. */
    var alpha = reduced || hideTransitionPlayer ? 1 : acc / STEP;
    var drawPX = prevPX + (px - prevPX) * alpha, drawPY = prevPY + (py - prevPY) * alpha;
    var drawCamX = prevCamX + (camX - prevCamX) * alpha, drawCamY = prevCamY + (camY - prevCamY) * alpha;
    var ox = Math.round((drawCamX + kickX) * S), oy = Math.round((drawCamY + kickY) * S);
    var camSX = ox / S, camSY = oy / S;
    function sx(wx) { return Math.round(wx * S) - ox; }
    function sy(wy) { return Math.round(wy * S) - oy; }

    var layer = chunked ? null : layers[room.id];
    var worldW = chunked ? room.w * TILE : (layer ? layer.width : (room.grid[0] || '').length * TILE);
    var worldH = chunked ? room.h * TILE : (layer ? layer.height : room.grid.length * TILE);
    if (!L || !L.surround || !L.surround(ctx, room.tileset, -ox, -oy, worldW * S, worldH * S, w, h, S)) {
      ctx.fillStyle = '#050507'; ctx.fillRect(0, 0, w, h);
    }
    /* PERF: an opaque floor pass paints over the whole room, so the static
       tiles beneath it are never seen. The same skip applies to chunks. */
    if (chunked && L) {
      if (!floorHidesLayer(K)) {
        drawChunkLayer(camSX, camSY, ox, oy, S, v);
        L.drawAnimated(ctx, room, tilesets[room.tileset], room.tileset, camSX, camSY, S, now, v);
      }
    } else if (layer && L) {
      if (!floorHidesLayer(K)) {
        var smooth = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(layer, -ox, -oy, layer.width * S, layer.height * S);
        ctx.imageSmoothingEnabled = smooth;
        L.drawAnimated(ctx, room, tilesets[room.tileset], room.tileset, camSX, camSY, S, now, v);
      }
    } else drawFlat(camSX, camSY, v);

    var d = drawCtx(now), i, e, k;
    renderEnts.length = 0;
    /* Woods sprite anchors stay within 64x112 px; full-room FX skip anchor culling. */
    var marginX = room.id === 'a_woods' ? 64 : 128, marginY = room.id === 'a_woods' ? 112 : 128;
    for (i = 0; i < ents.length; i++) {
      e = ents[i];
      if (e.dead) continue;
      k = K && K.get(e);
      var ex = (e.x + 0.5) * TILE, ey = (e.y + 1) * TILE;
      var reachX = k && k.reach ? Math.max(marginX, k.reach(e)) : marginX;
      if ((k && k.floor) || OPAQUE_FLOOR[e.t] || e.roomSpan ||
          (ex + reachX >= camSX && ex - reachX <= camSX + v.w && ey + marginY >= camSY && ey - marginY <= camSY + v.h))
        renderEnts.push(e);
    }
    /* floor decals first and unsorted — sorting a plate by foot Y makes
       a block vanish underneath its own plate */
    for (i = 0; i < renderEnts.length; i++) {
      e = renderEnts[i];
      if (e.dead) continue;
      k = K ? K.get(e) : null;
      if (!k || !k.floor || !k.draw) continue;
      var pf = entAt(e); d.sx = sx(pf.x); d.sy = sy(pf.y);
      k.draw(ctx, e, d);
    }
    /* Doors in a south / east / west wall (side 'n' | 'e' | 'w') are wall
       furniture the player stands IN FRONT of: sorted by their bottom edge
       they covered the player at the arrival spawn. Draw them as decals;
       only north-wall doors (side 's') take part in the foot-Y sort. */
    for (i = 0; i < renderEnts.length; i++) {
      e = renderEnts[i];
      if (e.dead || e.t !== 'exit' || exitHidden(e) || exitSide(e) === 's') continue;
      k = K ? K.get(e) : null;
      if (!k || !k.draw) continue;
      var pw = entAt(e); d.sx = sx(pw.x); d.sy = sy(pw.y);
      doorCtx(d, e); k.draw(ctx, e, d); d.room = room;
    }
    /* everything that stands, sorted by foot Y */
    var drawn = [];
    for (i = 0; i < renderEnts.length; i++) {
      e = renderEnts[i];
      if (e.dead || e.t === 'trigger' || exitHidden(e)) continue;
      if (e.t === 'exit' && exitSide(e) !== 's') continue;   /* drawn in the pre-pass above */
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
        if (!it.e) { if (!hideTransitionPlayer) L.shadow(ctx, sx(drawPX), sy(drawPY), 9, S, 0.42); continue; }
        var ww = it.k && it.k.width ? it.k.width(it.e, S) : 9;
        if (ww > 0) { var pe = entAt(it.e); L.shadow(ctx, sx(pe.x), sy(pe.y), Math.min(14, ww * 0.8), S, 0.32); }
      }
    }
    for (i = 0; i < drawn.length; i++) {
      var dr = drawn[i];
      if (!dr.e) {
        if (L && !hideTransitionPlayer) L.drawPlayer(ctx, sx(drawPX), sy(drawPY) - (sitting ? 11 * S : 0), face, walked, moving, S, now,
          { settle: settle > 0, act: playerAct && playerAct.name, actP: playerAct ? 1 - playerAct.t / playerAct.max : 0, sit: sitting });
        continue;
      }
      var pp = entAt(dr.e); d.sx = sx(pp.x); d.sy = sy(pp.y);
      if (dr.e.t === 'exit') doorCtx(d, dr.e);
      if (dr.k && dr.k.draw) { dr.k.draw(ctx, dr.e, d); d.room = room; }
      else { ctx.fillStyle = dr.e.colour || '#B892FF'; ctx.fillRect(d.sx - 3 * S, d.sy - 6 * S, 6 * S, 6 * S); }
    }
    /* speech bubbles (e.hint) go over everything: a counter drawn after
       its shopkeeper must not hide the sign that he has something to say */
    for (i = 0; K && i < renderEnts.length; i++) {
      e = renderEnts[i];
      if (!e.hint || e.dead) continue;
      var ph = entAt(e); d.sx = sx(ph.x); d.sy = sy(ph.y);
      K.hint(ctx, e, d);
    }

    if (L) {
      L.weatherDraw(ctx, camSX, camSY, S, w, h);
      var lt = lightsFor(now, camSX, camSY, v, drawPX, drawPY);
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
      L.drawPrompt(ctx, sx(pn.x), sy(pn.y - 18), S, clock);
      ctx.globalAlpha = 1;
    }

    if (NEU.juice) { NEU.juice.drawParts(ctx, 1 / 60);
                     NEU.juice.end(ctx, shook);
                     NEU.juice.overlay(ctx, w, h); }

    if (fade > 0) {
      if (L && !reduced) L.drawIris(ctx, w, h, sx(drawPX), sy(drawPY - 8), fade);
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
  /* Page dialogue skip (Acts I–III and the rest of the page). A line still
     typing completes; the next press advances. Z, Enter and X all do the
     same thing, through NEU.talk.ff. Act IV keeps its own keys below. */
  addEventListener('keydown', function (e) {
    if (running || NEU.activeMinigame || !NEU.talk || !NEU.talk.ff) return;
    if (!NEU.tboxOpen || !NEU.tboxOpen()) return;
    var t = document.activeElement;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    if (e.key === 'z' || e.key === 'Z' || e.key === 'Enter' || e.key === 'x' || e.key === 'X') {
      e.preventDefault();
      if (e.key === 'x' || e.key === 'X') NEU.talk.holdStart ? NEU.talk.holdStart() : NEU.talk.ff();
      else NEU.talk.ff();
    }
  });
  addEventListener('keydown', function (e) {
    if (!running) return;
    /* A minigame owns the page while it is open. */
    if (NEU.activeMinigame) return;
    /* A cinematic owns the stick: real keys do nothing until api.cine(false). */
    if (cine) { var heldKey = keyName(e); if (physical && heldKey) physical.heldKeys[heldKey] = true; e.preventDefault(); return; }
    if (e.key === 'Escape') {
      e.preventDefault();
      /* ESC never leaves the console — leaving is the quit button's job.
         It only closes whatever is currently open (a dialogue box, a shop
         board, a minigame), so a stray press cannot drop you out of the
         room mid-puzzle. */
      if (NEU.tboxOpen && NEU.tboxOpen()) { if (NEU.talk && NEU.talk.close) NEU.talk.close(); return; }
      if (NEU.activeMinigame === 'shop' && NEU.shop && NEU.shop.close) { NEU.shop.close(); return; }
      if (NEU.activeMinigame === 'quiz' && NEU.quiz && NEU.quiz.close) { NEU.quiz.close(); return; }
      if (NEU.activeMinigame === 'craft' && NEU.craft && NEU.craft.close) { NEU.craft.close(); return; }
      if (NEU.activeMinigame === 'rhythm' && NEU.rhythm && NEU.rhythm.close) { NEU.rhythm.close(); return; }
      if (NEU.activeMinigame === 'dark' && NEU.dark && NEU.dark.close) { NEU.dark.close(); return; }
      if (NEU.activeMinigame === 'bullet' && NEU.bullet && NEU.bullet.close) { NEU.bullet.close(); return; }
      if (NEU.activeMinigame === 'deck' && NEU.deck && NEU.deck.close) { NEU.deck.close(); return; }
      var ce = document.getElementById('confirmExit');
      if (ce) { ce.remove(); return; }
      return;
    }
    if (e.key === 'x' || e.key === 'X') {
      /* X hold timing lives with the shared dialogue box. */
      if (NEU.tboxOpen && NEU.tboxOpen() && NEU.talk) {
        e.preventDefault();
        if (NEU.talk.holdStart) NEU.talk.holdStart(); else if (NEU.talk.ff) NEU.talk.ff();
      }
      return;
    }
    if (e.key === 'z' || e.key === 'Z') {
      e.preventDefault();
      /* Z reveals the current line before it advances dialogue. */
      if (NEU.tboxOpen && NEU.tboxOpen()) { if (NEU.talk && NEU.talk.ff) NEU.talk.ff(); return; }
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
    var kn = keyName(e);
    if (physical && kn) { delete physical.heldKeys[kn]; e.preventDefault(); return; }
    if (kn) keys[kn] = false;
  });
  /* Alt-tab away with a key held and the keyup never arrives. */
  addEventListener('blur', function () { keys = {}; if (physical) physical.heldKeys = {}; });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { keys = {}; if (physical) physical.heldKeys = {}; }
  });

  /* ── talking ──────────────────────────────────────────────────── */
  function say(lines, who, cue) { if (NEU.talk) NEU.talk(lines, who, cue); }
  function flag(k, v) { return NEU.save ? NEU.save.flag(k, v) : null; }

  /* ── open / close ─────────────────────────────────────────────── */
  /* opts.iris: seconds for the iris to open on arrival (default 0.22). */
  function enter(id, spawn, opts) {
    if (!resolve(id, spawn)) return false;
    if (physicalExit) delete physicalExit.__transitionNear;
    if ((transitionPlayer || physical) && NEU.engineTrans) NEU.engineTrans.cut();
    physical = null; physicalExit = null; transitionPlayer = null; transitionStarting = false; cine = false;
    transitionCategory = null;
    if (NEU.kernel) NEU.kernel.push('engine');
    if (NEU.settings && NEU.settings.warnFlash) NEU.settings.warnFlash();
    wrap.hidden = false;
    document.body.classList.add('is-playing');
    if (NEU.quest) NEU.quest.lock(true);
    layout();
    /* opts.split (or entry:'hidden') plays the Deltarune two-half wipe on
       hidden-game entry. Reduced motion skips it for a plain cut. */
    var wantSplit = !!(opts && (opts.split || opts.entry === 'hidden')) && !reduced &&
      NEU.engineTrans && NEU.engineTrans.get('split');
    if (!wantSplit) {
      land(id, spawn);
      fade = 1; fadeDir = -1; fadeThen = null;
      fadeSpan = opts && opts.iris > 0 ? opts.iris : IRIS;
    } else {
      var fromX = Math.round(px * S) - Math.round((camX + kickX) * S);
      var fromY = Math.round(py * S) - Math.round((camY + kickY) * S);
      if (!transitionCanvas) transitionCanvas = document.createElement('canvas');
      if (!transitionNewCanvas) transitionNewCanvas = document.createElement('canvas');
      hideTransitionPlayer = true; draw(frameNow); hideTransitionPlayer = false;
      snapshotInto(transitionCanvas);
      land(id, spawn);
      hideTransitionPlayer = true; draw(frameNow); hideTransitionPlayer = false;
      snapshotInto(transitionNewCanvas);
      transitionCategory = 'SUPERNATURAL';
      if (NEU.engineTrans.start('split', transitionCanvas, 'right', false, transitionNewCanvas)) {
        transitionPlayer = { x: fromX, y: fromY,
          toX: Math.round(px * S) - Math.round((camX + kickX) * S),
          toY: Math.round(py * S) - Math.round((camY + kickY) * S) };
      }
      fade = 0; fadeDir = 0; fadeThen = null; fadeSpan = IRIS;
    }
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
  function confirmExit(minigameName, onConfirm, note) {
    if (document.getElementById('confirmExit')) return;
    var before = document.activeElement;
    if (NEU.juice) NEU.juice.pause(true);
    var overlay = document.createElement('div');
    overlay.id = 'confirmExit';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Leave ' + minigameName + '?');
    overlay.tabIndex = -1;
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:95;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = '<div style="background:#1A1016;padding:32px 48px;border:2px solid #E23B55;border-radius:4px;text-align:center;">' +
      '<p style="font:24px \'Determination Mono\',monospace;color:#EDE7DE;margin:0 0 16px;">Leave ' + minigameName + '?</p>' +
      '<p style="font:16px \'Determination Mono\',monospace;color:#8A8598;margin:0 0 24px;">Z = select, X = back</p>' +
      '<div style="display:flex;gap:16px;justify-content:center;margin:0 0 20px;">' +
        confirmOpt('yes') + confirmOpt('no') +
      '</div>' +
      '<div style="font:16px monospace;color:#8A8598;">' + (note || 'This run won\'t count. Your save is kept.') + '</div></div>';
    document.body.appendChild(overlay);
    /* Focus moves INTO the prompt (C11) — onto the dialog itself, not a
       button. The highlight is the only selection: `sel` drives both the
       soul and what Z activates, so the two cannot disagree. Default NO. */
    var sel = 'no';
    function confirmOpt(a) {
      return '<button type="button" data-ans="' + a + '" style="font:20px \'Determination Mono\',monospace;color:#EDE7DE;padding:10px 28px;cursor:pointer;">' +
        '<span data-soul="' + a + '" aria-hidden="true" style="font:16px monospace;color:#E23B55;margin-right:8px;" hidden>&#9829;</span>' + a + '</button>';
    }
    function paint() {
      var bs = overlay.querySelectorAll('button[data-ans]');
      for (var j = 0; j < bs.length; j++) {
        var a = bs[j].getAttribute('data-ans'), on = a === sel;
        bs[j].setAttribute('aria-pressed', on ? 'true' : 'false');
        bs[j].style.background = on ? '#331419' : '#14111A';
        bs[j].style.border = on ? '2px solid #E23B55' : '2px solid #8A8598';
        var soul = bs[j].querySelector('[data-soul]');
        if (soul) soul.hidden = !on;
      }
    }
    paint();
    try { overlay.focus(); } catch (x) {}
    var done = false;
    function cleanup() {
      if (done) return;
      done = true;
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      removeEventListener('keydown', onKey, true);
      if (NEU.juice) NEU.juice.pause(false);
      if (before && before.focus && document.contains(before)) { try { before.focus(); } catch (x) {} }
    }
    /* Window, capture phase, and stopImmediatePropagation: the touch pad
       dispatches its synthetic Enter/Escape on window, which a document
       listener never hears, and the minigames listen on window too. */
    function onKey(e) {
      e.stopImmediatePropagation();
      var k = e.key;
      /* Held Escape repeats: swallow them, or the prompt closes and the
         minigame's ESC reopens it on the next repeat. */
      if (k === 'Escape' && e.repeat) { e.preventDefault(); return; }
      if (k === 'ArrowLeft' || k === 'ArrowUp') { e.preventDefault(); sel = 'yes'; paint(); return; }
      if (k === 'ArrowRight' || k === 'ArrowDown') { e.preventDefault(); sel = 'no'; paint(); return; }
      if (k === 'Tab') { e.preventDefault(); sel = sel === 'yes' ? 'no' : 'yes'; paint(); return; }
      if (k === 'Escape' || k === 'x' || k === 'X') { e.preventDefault(); cleanup(); return; }
      if (k === 'z' || k === 'Z' || k === 'Enter') {
        e.preventDefault();
        if (e.repeat) return;
        if (sel === 'no') { cleanup(); return; }
        cleanup(); onConfirm();
      }
    }
    addEventListener('keydown', onKey, true);
    overlay.addEventListener('click', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('[data-ans]') : null;
      var ans = el && el.getAttribute('data-ans');
      if (ans === 'yes') { cleanup(); onConfirm(); }
      else if (ans === 'no') { cleanup(); }
    });
  }

  function leave() {
    running = false;
    if (physicalExit) delete physicalExit.__transitionNear;
    if ((transitionPlayer || physical) && NEU.engineTrans) NEU.engineTrans.cut();
    physical = null; physicalExit = null; transitionPlayer = null; transitionStarting = false; cine = false; fadeDir = 0; fadeThen = null; busy = false;
    transitionCategory = null;
    camReset();
    if (NEU.kernel && NEU.kernel.current() === 'engine') NEU.kernel.pop();
    clearLater();
    wrap.hidden = true;
    document.body.classList.remove('is-playing');
    if (NEU.quest) NEU.quest.lock(false);
    if (NEU.hush) NEU.hush();
    if (NEU.save) { NEU.save.capture(); NEU.save.flush(); }
  }

  /* Back into the room leave() stopped (craft hands the player back here).
     enter() would re-run the room's onEnter, which wakes you; this does not.
     false when there is no room or it already runs. */
  function resume() {
    if (running || !room) return false;
    if (NEU.kernel) NEU.kernel.push('engine');
    wrap.hidden = false;
    document.body.classList.add('is-playing');
    if (NEU.quest) NEU.quest.lock(true);
    keys = {}; busy = false; acc = 0; sitting = null;
    running = true; last = performance.now();
    requestAnimationFrame(step);
    return true;
  }

  var API = {
    cam: {
      to: function (x, y, ms) { camTo(x, y, ms); },
      hold: function () { camHold = true; camPan = null; },
      release: function () { camHold = false; camPan = null; },
      zoom: camZoom
    },
    say: say, flag: flag,
    flagged: function (k) { return NEU.save ? NEU.save.flagged(k) : false; },
    give: function (i) { if (NEU.save) NEU.save.give(i); },
    has: function (i) { return NEU.save ? NEU.save.has(i) : false; },
    go: go, leave: leave,
    busy: function (on) { busy = !!on; },
    playerAt: function () { return { x: px, y: py }; },
    /* Hold a named pose on the player for secs (engine-look draws it).
       'drink' is the recall potion's. */
    act: function (name, secs) { playerAct = name ? { name: name, t: secs || 0, max: secs || 0 } : null; },
    /* Sit on a seat entity (b1_throne's second throne). The player walks
       to the cell in front of it, then faces the room and plays stand ->
       crouch -> seated, 120 ms each. A second call, or a move key via
       move(), plays the same frames in reverse. busy holds input meanwhile. */
    sit: function (e) {
      if (!e) { sitting = null; return false; }
      if (busy || cine) return false;
      var p = entAt(e), front = entAt({ x: e.x, y: e.y + 1 }), fx = e.x, fy = e.y + 1;
      function frame(ms, fn) { if (reduced) fn(); else later(fn, ms); }
      function cellOf(q) { return [Math.floor(q.x / TILE), Math.floor((q.y - 1) / TILE)]; }
      function sitDown() {
        busy = true; face = 'down'; moving = false; vx = 0; vy = 0;
        frame(120, function () {
          sitting = { ent: e, x: p.x, y: p.y + 5 };
          px = sitting.x; py = sitting.y; prevPX = px; prevPY = py;
          API.act('crouch', 9);             /* cleared by the timer below, never by its own clock */
        });
        frame(240, function () { API.act(null); busy = false; settle = 0.09; });
      }
      if (sitting && sitting.ent === e) {
        busy = true; API.act('crouch', 9);
        frame(120, function () {
          sitting = null; px = front.x; py = front.y; prevPX = px; prevPY = py;
          face = 'down'; moving = false; API.act(null);
        });
        frame(240, function () { busy = false; settle = 0.09; });
        return false;
      }
      if (sitting) return false;
      var cur = cellOf(API.playerAt());
      if (cur[0] === fx && cur[1] === fy) { sitDown(); return true; }
      /* not in front yet: walk there on the scripted stick, one axis at a time */
      var n = 0;
      API.cine(true);
      (function walk() {
        var c = cellOf(API.playerAt());
        if (c[0] === fx && c[1] === fy) { API.cine(false); sitDown(); return; }
        if (n++ > 300) { API.cine(false); return; }
        if (c[1] !== fy) API.drive(0, fy > c[1] ? 1 : -1);
        else API.drive(fx > c[0] ? 1 : -1, 0);
        later(walk, 16);
      })();
      return true;
    },
    /* Scripted input for cinematics: real keys die, drive() walks. */
    cine: function (on) { cine = !!on; keys = {}; if (!on) paceV = paceA = 0; },
    pace: function (v, a) { paceV = Number(v) || 0; paceA = Number(a) || 0; },
    /* a stumble: the same squash a stop gives, held a little longer */
    stumble: function () { settle = 0.12; },
    drive: function (ix, iy) {
      if (!cine) return;
      keys.left = ix < 0; keys.right = ix > 0; keys.up = iy < 0; keys.down = iy > 0;
    },
    entHere: entHere, reset: resetPuzzle, check: checkPuzzle,
    ents: function () { return ents; },
    entsInPart: entsInPart,
    key: function (prefix, e) { return entityKey(prefix, room, e); },
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

  if (NEU.kernel) NEU.kernel.register('engine', {
    canvas: cv,
    tick: function (dt) {},
    running: function () { return running; }
  });

  NEU.engine = {
    register: register, alias: alias, merge: merge, tileset: tileset, decor: decor, enter: enter, leave: leave, resume: resume, go: go,
    confirmExit: confirmExit,
    clearKeys: function () { keys = {}; if (physical) physical.heldKeys = {}; },
    partInfo: partInfo,
    where: function () { return room ? { room: currentArea || room.id, spawn: room.__spawn } : null; },
    get running() { return running; },
    get room() { return room ? room.id : null; },
    /* Which zone the player is standing in, by tileset name. music.js
       and engine-look both key off this — one source of truth. */
    zone: function () { return room ? room.tileset : null; },
    get rooms() {
      var ids = Object.keys(rooms).concat(Object.keys(aliases)), areas = {};
      Object.keys(rooms).forEach(function (id) {
        (rooms[id].areas || []).forEach(function (a) { areas[a.id] = (areas[a.id] || 0) + 1; });
      });
      Object.keys(areas).forEach(function (id) {
        if (areas[id] === 1 && ids.indexOf(id) < 0 && areaTarget(id)) ids.push(id);
      });
      return ids;
    },
    tilesets: function () { return tilesets; },
    chunkInfo: chunkInfo,
    api: API,
    /* dev */
    warp: function (id, spawn) { if (!resolve(id, spawn)) return false; return running ? land(id, spawn) : enter(id, spawn); },
    drawPlayer: drawPlayerCompat,
    TILE: TILE,
    /* live: the scale the view was fitted at (decision 10) */
    get SCALE() { return S; },
    REACH: REACH, PLAYER_H: PLAYER_H, PLAYER_W: PLAYER_W, SPEED: SPEED,
    /* read-only internals for tests and the dev console */
    get debug() {
      return { scale: S, cam: { x: camX, y: camY }, focus: { x: camFocusX, y: camFocusY }, camLead: { x: camLeadX, y: camLeadY }, vel: { x: vx, y: vy },
               baked: !!(room && (chunked || layers[room.id])), fade: fade, iris: fadeSpan, transition: transitionCategory, prompt: promptFor,
               lights: (room && look()) ? lightsFor(0, camX, camY, view()).list.length : 0,
               cine: cine, seat: sitting ? { x: sitting.x, y: sitting.y } : null,
               view: view(), timers: timers.length };
    },
    nearest: function () { return nearest(promptable); },
    exitSide: function (e) { return exitSide(e); }
  };
})();
