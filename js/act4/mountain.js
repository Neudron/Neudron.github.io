/* mountain.js — the Ascent: 26 original rooms on the plat kernel, five lobbies from a
   small tutorial to Grandmaster, plus the research prototypes and the two descents. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var P = NEU.plat;
  if (!P || !P.level) return;
  var W = 128, H = 18, currentId = '';

  function blank(w, h) {
    var rows = [], y, x, s, width = w || W, height = h || H;
    for (y = 0; y < height; y++) {
      s = '';
      for (x = 0; x < width; x++) s += '.';
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
      if (n >= ROOMS.length - 1) { summit(); return; }
      puff();
      if (P.slideOpen) P.slideOpen('m' + (n + 1));   /* D4: 400 ms snapshot slide between m levels */
      else P.open('m' + (n + 1));
    };
  }
  function cp(x, y, tag, alt) { return { t: 'checkpoint', x: x, y: y, id: tag, alt: alt }; }
  function cpHook(id) {
    return function (e) {
      if (e.alt) NEU.mountain.altitude = e.alt;
      if (NEU.save && NEU.save.flag) NEU.save.flag('mtn_cp:' + id + ':' + e.id, 1);
    };
  }
  function add(id, rows, spawn, ents, n, rec, chapter, baseAlt, wind) {
    var def = P.level(id, {
      tiles: rows.join('\n'),
      spawn: spawn,
      entities: ents,
      tileset: 'mountain',
      openBottom: true,   /* M2: pits are bottomless, so a mechanic over a pit is a real gate */
      chapter: chapter || 'pine',
      altitude: baseAlt || 1000,
      wind: wind,
      onCheckpoint: cpHook(id),
      onExit: makeExit(n)
    });
    def.recording = rec;
    NEU.mountain.recordings[id] = def.recording;
    return def;
  }

  NEU.mountain = {
    recordings: {},
    active: false,
    mood: '',
    altitude: 1000,
    /* D4's slideOpen calls plat.open directly, so currentId can lag the real
       level. Read the plat kernel when a mountain level is active. */
    here: function () { return NEU.mountain.active && P.levelId ? P.levelId() : currentId; }
  };

  /* ═══ THE ASCENT ═══════════════════════════════════════════════════
     26 rooms in five lobbies, Beginner to Grandmaster (owner brief 2026-11-21,
     modelled on the Strawberry Jam Collab lobby ladder). m0 is a small tutorial;
     every technique is taught in a safe room before a later room tests it.
     A room is data, edited only between its ROOM / END markers:
       rows  top to bottom. '#' rock, '=' jump-through, '^' 'v' spikes, 'x' dash-breakable,
             '`' tuft, 'l' lantern, 'f' banner. Rooms are openBottom: a column with
             no floor is a bottomless pit.
       tier  tutorial | teach | test | gauntlet | reference (difficulty bands in tests/fixes9990.mjs)
       teach techniques this room introduces; mech: techniques/entities its route must use
       rec   the intended deathless route; ref: difficulty reference (tier and mechanic
             vocabulary only, every layout is original).
     Measured envelope on this kernel (tiles): jump tap 1.5 up / 4 across, held jump
     3.6 / 7.6, jump+dash 11.2 across, super 16.5 across, hyper 17.2 across 1.6 up,
     dash up 5.6, held jump + dash up 9.1, wallbounce 3.6-6.6 (8.3 from the air),
     climb ~19.9 on full stamina. */
  var ROOMS = [];
  function flat(w) { var rows = blank(w), x; for (x = 0; x < w; x++) { put(rows, x, 15, '#'); put(rows, x, 16, '#'); put(rows, x, 17, '#'); } return rows; }
  /* ROOM m0 */
  ROOMS.push({ id: 'm0', chapter: 'pine', tier: 'tutorial', teach: ['jump','climb','dash'], mech: ['dash'],
    ref: '',
    /* tutorial: a held jump onto the step, a climb up the wall, a jump + dash over the gap. Nothing here kills; a missed dash drops to the catch floor and the wall climbs back up. */
    spawn: { x: 2, y: 14 },
    rows: [
      '................................................',
      '................................................',
      '................................................',
      '................................................',
      '................................................',
      '.........................................f......',
      '........................######.........#########',
      '........................######.........#########',
      '........................######..................',
      '........................######..................',
      '........................######..................',
      '........................######..................',
      '........................######..................',
      '............######......######..................',
      '.....l......######..`...######..................',
      '##############################..................',
      '##############################..................',
      '################################################'
    ],
    ents: [
      {t: 'checkpoint',x: 3,y: 14,id: 'start'},
      {t: 'checkpoint',x: 27,y: 5,id: 'wall'},
      {t: 'exit',x: 45,y: 5}
    ],
    rec: [[36,'right'],[16,'jump right'],[40,'right'],[220,'grab up right'],[20,'right'],[14,'jump right'],[3,'dash right'],[50,'right']] });
  /* END m0 */
  /* ROOM m1 */
  ROOMS.push({ id: 'm1', chapter: 'pine', tier: 'teach', teach: ['refill'], mech: ['refill','dash'],
    ref: '',
    /* teach: screen 1 jump+dash over a dip, the crystal refills the dash mid-air, dash again to the raised ledge. Screen 2 repeats it over a short bottomless gap. */
    spawn: { x: 2, y: 14 },
    rows: [
      '................................................................................',
      '................................................................................',
      '................................................................................',
      '................................................................................',
      '................................................................................',
      '................................................................................',
      '................................................................................',
      '................................................................................',
      '................................................................................',
      '................................................................................',
      '................................................................................',
      '..................................f.............................................',
      '............................############........................................',
      '............................############........................................',
      '....l.....`.................############....`.......................`...........',
      '##################..........#######################...........##################',
      '###################################################...........##################',
      '###################################################...........##################'
    ],
    ents: [{t: 'checkpoint', x: 2, y: 14, id: 'start'}, {t: 'refill', x: 23, y: 9}, {t: 'checkpoint', x: 41, y: 14, id: 'gap'}, {t: 'refill', x: 56, y: 9}, {t: 'exit', x: 75, y: 14}],
    rec: [[1, 'right']] });
  /* END m1 */
  /* ROOM m2 */
  ROOMS.push({ id: 'm2', chapter: 'pine', tier: 'todo', teach: [], mech: [], ref: '',
    spawn: { x: 2, y: 14 },
    rows: flat(32),
    ents: [{ t: 'checkpoint', x: 3, y: 14, id: 'start' }, { t: 'exit', x: 28, y: 14 }],
    rec: [[200, 'right']] });
  /* END m2 */
  /* ROOM m3 */
  ROOMS.push({ id: 'm3', chapter: 'pine', tier: 'todo', teach: [], mech: [], ref: '',
    spawn: { x: 2, y: 14 },
    rows: flat(32),
    ents: [{ t: 'checkpoint', x: 3, y: 14, id: 'start' }, { t: 'exit', x: 28, y: 14 }],
    rec: [[200, 'right']] });
  /* END m3 */
  /* ROOM m4 */
  ROOMS.push({ id: 'm4', chapter: 'pine', tier: 'todo', teach: [], mech: [], ref: '',
    spawn: { x: 2, y: 14 },
    rows: flat(32),
    ents: [{ t: 'checkpoint', x: 3, y: 14, id: 'start' }, { t: 'exit', x: 28, y: 14 }],
    rec: [[200, 'right']] });
  /* END m4 */
  /* ROOM m5 */
  ROOMS.push({ id: 'm5', chapter: 'pine', tier: 'todo', teach: [], mech: [], ref: '',
    spawn: { x: 2, y: 14 },
    rows: flat(32),
    ents: [{ t: 'checkpoint', x: 3, y: 14, id: 'start' }, { t: 'exit', x: 28, y: 14 }],
    rec: [[200, 'right']] });
  /* END m5 */
  /* ROOM m6 */
  ROOMS.push({ id: 'm6', chapter: 'ridge', tier: 'teach', teach: ['super'], mech: ['super'], ref: '',
    /* teach: ground dash right then jump during the dash clears a 8-wide demo gap over a catch floor;
       then a 14-wide bottomless gap that only a super clears (jump+dash reaches 11.2). */
    spawn: { x: 2, y: 14 },
    rows: [
      '................................................................',
      '................................................................',
      '................................................................',
      '................................................................',
      '................................................................',
      '................................................................',
      '................................................................',
      '................................................................',
      '................................................................',
      '................................................................',
      '................................................................',
      '................................................................',
      '................................................................',
      '................................................................',
      '......l.....`.......`.............`.f.....................`.....',
      '########################........########..............##########',
      '########################........########..............##########',
      '########################........########..............##########',
      '########################################..............##########',
      '########################################..............##########'
    ],
    ents: [
      {t: 'checkpoint',x: 2,y: 14,id: 'start'},
      {t: 'checkpoint',x: 38,y: 14,id: 'gap'},
      {t: 'exit',x: 60,y: 14}
    ],
    rec: [[200, 'right']] });
  /* END m6 */
  /* ROOM m7 */
  ROOMS.push({ id: 'm7', chapter: 'ridge', tier: 'todo', teach: [], mech: [], ref: '',
    spawn: { x: 2, y: 14 },
    rows: flat(32),
    ents: [{ t: 'checkpoint', x: 3, y: 14, id: 'start' }, { t: 'exit', x: 28, y: 14 }],
    rec: [[200, 'right']] });
  /* END m7 */
  /* ROOM m8 */
  ROOMS.push({ id: 'm8', chapter: 'ridge', tier: 'todo', teach: [], mech: [], ref: '',
    spawn: { x: 2, y: 14 },
    rows: flat(32),
    ents: [{ t: 'checkpoint', x: 3, y: 14, id: 'start' }, { t: 'exit', x: 28, y: 14 }],
    rec: [[200, 'right']] });
  /* END m8 */
  /* ROOM m9 */
  ROOMS.push({ id: 'm9', chapter: 'ridge', tier: 'todo', teach: [], mech: [], ref: '',
    spawn: { x: 2, y: 14 },
    rows: flat(32),
    ents: [{ t: 'checkpoint', x: 3, y: 14, id: 'start' }, { t: 'exit', x: 28, y: 14 }],
    rec: [[200, 'right']] });
  /* END m9 */
  /* ROOM m10 */
  ROOMS.push({ id: 'm10', chapter: 'ridge', tier: 'todo', teach: [], mech: [], ref: '',
    spawn: { x: 2, y: 14 },
    rows: flat(32),
    ents: [{ t: 'checkpoint', x: 3, y: 14, id: 'start' }, { t: 'exit', x: 28, y: 14 }],
    rec: [[200, 'right']] });
  /* END m10 */
  /* ROOM m11 */
  ROOMS.push({ id: 'm11', chapter: 'crag', tier: 'todo', teach: [], mech: [], ref: '',
    spawn: { x: 2, y: 14 },
    rows: flat(32),
    ents: [{ t: 'checkpoint', x: 3, y: 14, id: 'start' }, { t: 'exit', x: 28, y: 14 }],
    rec: [[200, 'right']] });
  /* END m11 */
  /* ROOM m12 */
  ROOMS.push({ id: 'm12', chapter: 'crag', tier: 'todo', teach: [], mech: [], ref: '',
    spawn: { x: 2, y: 14 },
    rows: flat(32),
    ents: [{ t: 'checkpoint', x: 3, y: 14, id: 'start' }, { t: 'exit', x: 28, y: 14 }],
    rec: [[200, 'right']] });
  /* END m12 */
  /* ROOM m13 */
  ROOMS.push({ id: 'm13', chapter: 'crag', tier: 'todo', teach: [], mech: [], ref: '',
    spawn: { x: 2, y: 14 },
    rows: flat(32),
    ents: [{ t: 'checkpoint', x: 3, y: 14, id: 'start' }, { t: 'exit', x: 28, y: 14 }],
    rec: [[200, 'right']] });
  /* END m13 */
  /* ROOM m14 */
  ROOMS.push({ id: 'm14', chapter: 'crag', tier: 'todo', teach: [], mech: [], ref: '',
    spawn: { x: 2, y: 14 },
    rows: flat(32),
    ents: [{ t: 'checkpoint', x: 3, y: 14, id: 'start' }, { t: 'exit', x: 28, y: 14 }],
    rec: [[200, 'right']] });
  /* END m14 */
  /* ROOM m15 */
  ROOMS.push({ id: 'm15', chapter: 'crag', tier: 'todo', teach: [], mech: [], ref: '',
    spawn: { x: 2, y: 14 },
    rows: flat(32),
    ents: [{ t: 'checkpoint', x: 3, y: 14, id: 'start' }, { t: 'exit', x: 28, y: 14 }],
    rec: [[200, 'right']] });
  /* END m15 */
  /* ROOM m16 */
  ROOMS.push({ id: 'm16', chapter: 'storm', tier: 'todo', teach: [], mech: [], ref: '',
    spawn: { x: 2, y: 14 },
    rows: flat(32),
    ents: [{ t: 'checkpoint', x: 3, y: 14, id: 'start' }, { t: 'exit', x: 28, y: 14 }],
    rec: [[200, 'right']] });
  /* END m16 */
  /* ROOM m17 */
  ROOMS.push({ id: 'm17', chapter: 'storm', tier: 'todo', teach: [], mech: [], ref: '',
    spawn: { x: 2, y: 14 },
    rows: flat(32),
    ents: [{ t: 'checkpoint', x: 3, y: 14, id: 'start' }, { t: 'exit', x: 28, y: 14 }],
    rec: [[200, 'right']] });
  /* END m17 */
  /* ROOM m18 */
  ROOMS.push({ id: 'm18', chapter: 'storm', tier: 'todo', teach: [], mech: [], ref: '',
    spawn: { x: 2, y: 14 },
    rows: flat(32),
    ents: [{ t: 'checkpoint', x: 3, y: 14, id: 'start' }, { t: 'exit', x: 28, y: 14 }],
    rec: [[200, 'right']] });
  /* END m18 */
  /* ROOM m19 */
  ROOMS.push({ id: 'm19', chapter: 'storm', tier: 'todo', teach: [], mech: [], ref: '',
    spawn: { x: 2, y: 14 },
    rows: flat(32),
    ents: [{ t: 'checkpoint', x: 3, y: 14, id: 'start' }, { t: 'exit', x: 28, y: 14 }],
    rec: [[200, 'right']] });
  /* END m19 */
  /* ROOM m20 */
  ROOMS.push({ id: 'm20', chapter: 'storm', tier: 'todo', teach: [], mech: [], ref: '',
    spawn: { x: 2, y: 14 },
    rows: flat(32),
    ents: [{ t: 'checkpoint', x: 3, y: 14, id: 'start' }, { t: 'exit', x: 28, y: 14 }],
    rec: [[200, 'right']] });
  /* END m20 */
  /* ROOM m21 */
  ROOMS.push({ id: 'm21', chapter: 'summit', tier: 'todo', teach: [], mech: [], ref: '',
    spawn: { x: 2, y: 14 },
    rows: flat(32),
    ents: [{ t: 'checkpoint', x: 3, y: 14, id: 'start' }, { t: 'exit', x: 28, y: 14 }],
    rec: [[200, 'right']] });
  /* END m21 */
  /* ROOM m22 */
  ROOMS.push({ id: 'm22', chapter: 'summit', tier: 'todo', teach: [], mech: [], ref: '',
    spawn: { x: 2, y: 14 },
    rows: flat(32),
    ents: [{ t: 'checkpoint', x: 3, y: 14, id: 'start' }, { t: 'exit', x: 28, y: 14 }],
    rec: [[200, 'right']] });
  /* END m22 */
  /* ROOM m23 */
  ROOMS.push({ id: 'm23', chapter: 'summit', tier: 'todo', teach: [], mech: [], ref: '',
    spawn: { x: 2, y: 14 },
    rows: flat(32),
    ents: [{ t: 'checkpoint', x: 3, y: 14, id: 'start' }, { t: 'exit', x: 28, y: 14 }],
    rec: [[200, 'right']] });
  /* END m23 */
  /* ROOM m24 */
  ROOMS.push({ id: 'm24', chapter: 'summit', tier: 'todo', teach: [], mech: [], ref: '',
    spawn: { x: 2, y: 14 },
    rows: flat(32),
    ents: [{ t: 'checkpoint', x: 3, y: 14, id: 'start' }, { t: 'exit', x: 28, y: 14 }],
    rec: [[200, 'right']] });
  /* END m24 */
  /* ROOM m25 */
  ROOMS.push({ id: 'm25', chapter: 'summit', tier: 'todo', teach: [], mech: [], ref: '',
    spawn: { x: 2, y: 14 },
    rows: flat(32),
    ents: [{ t: 'checkpoint', x: 3, y: 14, id: 'start' }, { t: 'exit', x: 28, y: 14 }],
    rec: [[200, 'right']] });
  /* END m25 */

  var n;
  for (n = 0; n < ROOMS.length; n++) {
    ROOMS[n].def = add(ROOMS[n].id, ROOMS[n].rows, ROOMS[n].spawn, ROOMS[n].ents, n, ROOMS[n].rec, ROOMS[n].chapter, 1000 + n * 150, ROOMS[n].wind);
    ROOMS[n].def.tier = ROOMS[n].tier; ROOMS[n].def.teach = ROOMS[n].teach; ROOMS[n].def.mech = ROOMS[n].mech; ROOMS[n].def.ref = ROOMS[n].ref;
  }
  NEU.mountain.rooms = ROOMS;

  /*
   * Research-gated precision-platforming PROTOTYPES. Deliberately separate
   * from the eight-room story route: none counts toward the promised 60
   * until a full-source map study and deterministic successful playthrough.
   * Every surface below is hand-positioned, not generated from RNG.
   */
  function prototype(id, width, height, spawn, geometry, entities, detail) {
    var rows = [], y, x, i, g, line, tiles;
    for (y = 0; y < height; y++) rows.push(new Array(width + 1).join('.'));
    for (i = 0; i < geometry.length; i++) {
      g = geometry[i];
      if (g.y < 0 || g.y >= height) throw new Error('mountain geometry outside room: ' + id);
      line = rows[g.y].split('');
      for (x = Math.max(0, g.from); x <= Math.min(width - 1, g.to); x++) line[x] = g.tile;
      rows[g.y] = line.join('');
    }
    tiles = rows.join('\n');
    return P.level(id, {
      tiles: tiles, spawn: spawn, entities: entities, tileset: 'mountain',
      chunked: true, resetOnDeath: true, cameraMode: 'mountain', camera: detail.camera || { focusY: 0.52 },
      wind: detail.wind || null, quickRespawn: true,
      stage: detail.stage, altitude: detail.altitude,
      mechanicRequirements: detail.mechanics,
      prototype: true, testing: { status: 'not-playtested', reference: detail.reference },
      onExit: function () { NEU.mountain.prototypeCleared = id; },
      onCheckpoint: function (e) {
        NEU.mountain.prototypeCheckpoint = id + ':' + e.id;
        cpHook(id)(e);
      }
    });
  }
  function treads(x0, x1, y0, y1, tile) {
    var a = [], y;
    for (y = y0; y >= y1; y -= 2) a.push({ from: x0, to: x1, y: y, tile: tile });
    return a;
  }
  /* First input: run and clear a short exposed crevasse. The overhead
     one-way ledge offers a safe alternate route, not an unavoidable trap. */
  prototype('mtest_easy', 24, 34, { x: 2, y: 29 }, [
    { from: 0, to: 7, y: 30, tile: '#' },
    { from: 10, to: 23, y: 30, tile: '#' },
    { from: 0, to: 23, y: 33, tile: '#' },
    { from: 8, to: 9, y: 32, tile: '^' },
    { from: 12, to: 16, y: 25, tile: '=' },
    { from: 6, to: 6, y: 29, tile: '`' },
    { from: 17, to: 18, y: 26, tile: '#' },
    { from: 17, to: 18, y: 25, tile: '#' }
  ], [
    { t: 'checkpoint', x: 12, y: 29, id: 'foot', alt: 1000 },
    { t: 'spring', x: 14, y: 24 },
    { t: 'crumble', x: 15, y: 24 },
    { t: 'coin', x: 13, y: 24, id: 'mtn_coin:mtest_easy' },
    { t: 'exit', x: 21, y: 29 }
  ], { stage: 'foot', altitude: 1000, mechanics: ['ground jump', 'basic air control', 'spring', 'crumble'],
    reference: 'Forsaken City 1A rooms 1–3; verify preview and route before final use' });

  /* Spring sends the player from the ravine floor to a first landing.
     Each next landing is offset laterally: aim, land, then climb again. */
  prototype('mtest_medium', 26, 44, { x: 3, y: 40 },
    [{ from: 0, to: 25, y: 41, tile: '#' }, { from: 4, to: 4, y: 40, tile: '`' }].concat(treads(6, 24, 38, 8, '=')), [
    { t: 'spring', x: 8, y: 37 },
    { t: 'refill', x: 14, y: 34 },
    { t: 'checkpoint', x: 19, y: 31, id: 'lift', alt: 1500 },
    { t: 'coin', x: 9, y: 13, id: 'mtn_coin:mtest_medium' },
    { t: 'zip', x: 14, y: 22, targetX: 14, targetY: 24 },
    { t: 'exit', x: 22, y: 7 }
  ], { stage: 'ridge', altitude: 1400, mechanics: ['spring', 'diagonal dash', 'landing control'],
    reference: 'SpringCollab MultiNodeMovingPlatform and Celeste 7A wall springs (mechanic study only)',
    wind: { x: 55, y: 0, period: 4.2, duty: 0.65 } });

  /* Vertical stress-test: alternating shelves make camera tracking,
     momentum changes, dash refills and precise resets observable. The
     placed zip block is intentionally a collision/state-machine test. */
  prototype('mtest_hard', 28, 60, { x: 4, y: 56 },
    [{ from: 0, to: 27, y: 57, tile: '#' }, { from: 4, to: 4, y: 56, tile: '`' }].concat(treads(8, 26, 54, 10, '=')), [
    { t: 'spring', x: 8, y: 53 },
    { t: 'zip', x: 13, y: 51, targetX: 13, targetY: 53 },
    { t: 'refill', x: 19, y: 47 },
    { t: 'refill', x: 9, y: 41 },
    { t: 'checkpoint', x: 16, y: 32, id: 'lift', alt: 2400 },
    { t: 'refill', x: 9, y: 29 },
    { t: 'refill', x: 16, y: 20 },
    { t: 'coin', x: 22, y: 11, id: 'mtn_coin:mtest_hard' },
    { t: 'exit', x: 24, y: 9 }
  ], { stage: 'summit', altitude: 2400,
    mechanics: ['spring', 'zip', 'walljump', 'dash refill', 'wind management'],
    reference: 'Celeste Summit 7B a-03 tall-room bounds; SJ DashZipMover source (not copied)',
    wind: { x: -88, y: -12, period: 3.6, duty: 0.76 },
    camera: { focusY: 0.61 } });

  /* CI replayed this authored input on the real movement controller:
     94 frames, 0 deaths, room exit triggered. Not a human-playtest time. */
  P.levels.mtest_easy.recording = [[18, 'right'], [8, 'right jump'], [125, 'right']];
  P.levels.mtest_easy.testing.status = 'simulated-route-passed';
  P.levels.mtest_easy.testing.successFrames = 94;
  P.levels.mtest_easy.testing.deaths = 0;
  NEU.mountain.recordings.mtest_easy = P.levels.mtest_easy.recording;

  /* Both other gyms are reachable on the real controller: a held jump
     lifts two tiles, a short release re-arms the edge-triggered jump. */
  function climbRecording(rest, cycles) {
    var a = [], k;
    for (k = 0; k < cycles; k++) a.push([18, 'right jump'], [rest, 'right']);
    return a;
  }
  record('mtest_medium', climbRecording(4, 40), 337);
  record('mtest_hard', climbRecording(8, 40), 430);

  NEU.mountain.prototypes = ['mtest_easy', 'mtest_medium', 'mtest_hard', 'mtest_springs', 'mtest_start', 'mtest_flags'];
  NEU.mountain.openPrototype = function (difficulty) {
    var id = 'mtest_' + difficulty;
    return NEU.mountain.prototypes.indexOf(id) >= 0 && P.open(id);
  };

  /*
   * Phase 1 reference-informed rooms. Original geometry only: scale, mechanic
   * vocabulary and room envelopes were studied, never tiles, sprites, map bins
   * or music. Phase 0 rights gate is NOT PASSED — no 1:1 accuracy is claimed.
   */
  var PROVENANCE = 'reference-informed, original implementation';
  function claim(id) { P.levels[id].provenance = PROVENANCE; }
  function record(id, rec, frames) {
    var def = P.levels[id];
    def.recording = rec;
    def.testing.status = 'simulated-route-passed';
    def.testing.successFrames = frames;
    def.testing.deaths = 0;
    NEU.mountain.recordings[id] = rec;
  }

  /* 7C 02 Springs envelope (95x31 source tiles). Springs, crumbling bridge,
     a downward gust and a touch switch that opens the gate to the exit. */
  prototype('mtest_springs', 48, 34, { x: 2, y: 29 }, [
    { from: 0, to: 13, y: 30, tile: '#' },
    { from: 17, to: 47, y: 30, tile: '#' },
    { from: 0, to: 47, y: 33, tile: '#' },
    { from: 14, to: 16, y: 32, tile: '^' },
    { from: 6, to: 20, y: 27, tile: '=' },
    { from: 40, to: 40, y: 29, tile: '`' }
  ], [
    { t: 'checkpoint', x: 4, y: 29, id: 'foot', alt: 1000 },
    { t: 'refill', x: 6, y: 26 },
    { t: 'spring', x: 9, y: 26 },
    { t: 'crumble', x: 14, y: 30 },
    { t: 'crumble', x: 15, y: 30 },
    { t: 'crumble', x: 16, y: 30 },
    { t: 'coin', x: 18, y: 26, id: 'mtn_coin:mtest_springs' },
    { t: 'barrier', x: 24, y: 29, sw: 1, id: 'mtest_springs:switch' },
    { t: 'barrier', x: 32, y: 28, gate: 1, solid: true, id: 'mtest_springs:gate0' },
    { t: 'barrier', x: 32, y: 29, gate: 1, solid: true, id: 'mtest_springs:gate1' },
    { t: 'exit', x: 44, y: 29 }
  ], { stage: 'foot', altitude: 1000, mechanics: ['spring', 'falling block', 'downwind', 'touch switch'],
    reference: 'Celestial 7C 02 Springs room envelope and mechanic set; original layout',
    wind: { x: 0, y: 55, period: 4.2, duty: 0.55, phase: 0.6 } });
  claim('mtest_springs');
  record('mtest_springs', [[260, 'right']], 219);
  /* A switch is one kinds-free state change on the level itself: the marker
     entity is touched in tick, the gate entity stops being solid, art is drawn
     in draw. No second authority and no engine change. */
  (function () {
    var def = P.levels.mtest_springs;
    def.tick = function () {
      var L = P.level0(), s = P.state, i, e, sw = null, on;
      if (!L || !s) return;
      for (i = 0; i < L.entities.length; i++) {
        e = L.entities[i];
        if (e.sw) sw = e;
      }
      if (!sw || sw.on) return;
      on = Math.abs(s.x - (sw.x + 0.5) * 16) < 22 && Math.abs(s.y - (sw.y + 1) * 16) < 24;
      if (!on) return;
      sw.on = true;
      for (i = 0; i < L.entities.length; i++) if (L.entities[i].gate) L.entities[i].dead = true;
      if (NEU.juice && NEU.juice.hit) NEU.juice.hit('light');
    };
    def.draw = function (c, cx, cy) {
      var L = P.level0(), i, e, x, y;
      if (!L) return;
      for (i = 0; i < L.entities.length; i++) {
        e = L.entities[i];
        if (!e.sw) continue;
        x = (e.x * 16 - cx) | 0; y = (e.y * 16 - cy) | 0;
        c.fillStyle = '#12081E'; c.fillRect(x, y + 2, 16, 14);
        c.fillStyle = e.on ? '#3DDC97' : '#FFCF4A'; c.fillRect(x + 2, y + 4, 12, 10);
        c.fillStyle = e.on ? '#C8FFE4' : '#FFF0A0'; c.fillRect(x + 5, y + 6, 6, 6);
      }
    };
  }());

  /* 7A a-00 Start envelope (86x23 source tiles). Three named spawn points
     and one gold collectible above the main walking line. */
  prototype('mtest_start', 48, 26, { x: 10, y: 21 }, [
    { from: 0, to: 47, y: 22, tile: '#' },
    { from: 28, to: 36, y: 19, tile: '=' },
    { from: 39, to: 47, y: 12, tile: '=' },
    { from: 16, to: 16, y: 21, tile: '`' }
  ], [
    { t: 'checkpoint', x: 4, y: 21, id: 'base', alt: 1200 },
    { t: 'checkpoint', x: 32, y: 18, id: 'ledge', alt: 1320 },
    { t: 'checkpoint', x: 42, y: 11, id: 'perch', alt: 1450 },
    { t: 'coin', x: 35, y: 18, id: 'mtn_golden:mtest_start' },
    { t: 'exit', x: 45, y: 21 }
  ], { stage: 'foot', altitude: 1200, mechanics: ['spawn points', 'golden collectible', 'camera focus'],
    reference: 'Celestial 7A a-00 envelope (3 spawns + golden); original layout',
    camera: { focusY: 0.55 } });
  claim('mtest_start');
  record('mtest_start', [[220, 'right']], 182);

  /* 7A g-03 Flags 5-1 envelope (262x407 source tiles). Six named summit
     checkpoints on a chunked vertical stage with a gusting crosswind. */
  var FLAGS = [
    { id: 'flag5', x: 4, alt: 3000 }, { id: 'flag4', x: 10, alt: 3300 },
    { id: 'flag3', x: 16, alt: 3600 }, { id: 'flag2', x: 22, alt: 3900 },
    { id: 'flag1', x: 28, alt: 4200 }, { id: 'summit', x: 34, alt: 4500 }
  ];
  var flagEnts = [], kf;
  for (kf = 0; kf < FLAGS.length; kf++) flagEnts.push({ t: 'checkpoint', x: FLAGS[kf].x, y: 85, id: FLAGS[kf].id, alt: FLAGS[kf].alt });
  flagEnts.push({ t: 'coin', x: 20, y: 72, id: 'mtn_coin:mtest_flags' });
  flagEnts.push({ t: 'exit', x: 38, y: 85 });
  prototype('mtest_flags', 40, 90, { x: 2, y: 85 }, [
    { from: 0, to: 39, y: 86, tile: '#' },
    { from: 0, to: 0, y: 0, tile: '#' },
    { from: 39, to: 39, y: 0, tile: '#' },
    { from: 6, to: 14, y: 76, tile: '=' },
    { from: 22, to: 30, y: 64, tile: '=' },
    { from: 8, to: 16, y: 50, tile: '=' },
    { from: 24, to: 32, y: 36, tile: '=' },
    { from: 10, to: 18, y: 22, tile: '=' },
    { from: 18, to: 18, y: 85, tile: '`' }
  ], flagEnts, { stage: 'summit', altitude: 3000, mechanics: ['six named flags', 'crosswind', 'chunked vertical stage'],
    reference: 'Celestial 7A g-03 flag sequence and envelope; original layout',
    wind: { x: -36, y: 0, period: 5.6, duty: 0.7, phase: 3.2 },
    camera: { focusY: 0.61 } });
  claim('mtest_flags');
  record('mtest_flags', [[280, 'right']], 187);

  /* Heaven is gold and cloud. Evil is crimson and ash. Four screens each. */
  var EX = 160, INK = '#12081E';
  var HSKY = ['#FFF6DE', '#F8E7A8', '#F4D0E8', '#E7D4F4', '#D8E6FF', '#E7F2FF'];
  var ESKY = ['#07030A', '#14080C', '#2A0C14', '#3A1018', '#6A2030', '#8A2A30'];
  var cache = {}, motes = [], ash = [];
  function reducedNow() { return P.reduced(); }
  function hs(x, y, z) { return P.hash(x, y, z); }
  function canvasOf(w, h) {
    var cv = P.mk(w, h), g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    return { cv: cv, g: g };
  }
  function F(g, col, x, y, w, h) { if (w > 0 && h > 0) { g.fillStyle = col; g.fillRect(x, y, w, h); } }
  function vnoise(x, period, spacing, seed) {
    var n = period / spacing, k = Math.floor(x / spacing), f = x / spacing - k, a = hs(k % n, 0, seed), b = hs((k + 1) % n, 0, seed);
    f = f * f * (3 - 2 * f);
    return a + (b - a) * f;
  }
  function layer(name, fn) { return cache[name] || (cache[name] = fn()); }
  var k0;
  for (k0 = 0; k0 < 12; k0++) { motes.push({ x: (k0 * 97) % 640, y: (k0 * 53) % 380 }); ash.push({ x: (k0 * 71 + 20) % 640, y: (k0 * 61) % 380, big: k0 & 1 }); }

  function seamsOf(cols, step) {
    var o = canvasOf(640, 360), g = o.g, k, x, y;
    for (k = 1; k < cols.length; k++) {
      y = k * step;
      for (x = 0; x < 640; x += 2) {
        F(g, cols[k - 1], x + (k & 1), y, 1, 1); F(g, cols[k], x + (k & 1), y - 1, 1, 1);
        F(g, cols[k], x + ((k + 1) & 1), y + 1, 1, 1); F(g, cols[k - 1], x + ((k + 1) & 1), y - 2, 1, 1);
      }
    }
    return o.cv;
  }
  function sunCanvas() {
    var o = canvasOf(64, 64), g = o.g;
    P.ell(g, 0, 0, 32, 32, 24, 24, '#F8E7A8');
    P.ell(g, 0, 0, 32, 32, 16, 16, '#FFF6DE');
    P.ell(g, 0, 0, 32, 32, 10, 10, '#FFFFFF');
    F(g, '#E2B84A', 10, 28, 2, 2); F(g, '#E2B84A', 52, 30, 2, 2); F(g, '#E2B84A', 30, 8, 2, 2);
    return o.cv;
  }
  function raysCanvas() {
    var o = canvasOf(640, 360), g = o.g, k, y;
    for (k = 0; k < 6; k++) for (y = 0; y < 360; y += 8) F(g, '#FFF6DE', 120 + k * 106 - Math.round(y * 0.55), y, 8, 2);
    return o.cv;
  }
  function puffBank(banks, y0) {
    var o = canvasOf(640, 220), g = o.g, k, j, b;
    function pass(dy, shrink, col) {
      for (k = 0; k < banks.length; k++) for (j = 0; j < banks[k].length; j++) {
        b = banks[k][j]; P.ell(g, 0, 0, b[0], b[1] + dy - y0, b[2] - shrink, b[3] - shrink, col);
      }
    }
    pass(4, 0, '#B8C8E8'); pass(2, 1, '#D8E6FF'); pass(-1, 1, '#FFFFFF'); pass(0, 2, '#F7FBFF');
    return o.cv;
  }
  function highClouds() {
    var o = canvasOf(640, 120), g = o.g, k, j, b;
    var banks = [[[80, 90, 22, 6], [104, 84, 18, 7], [126, 92, 20, 5]], [[360, 70, 24, 6], [386, 64, 20, 7], [410, 72, 22, 5]], [[540, 98, 18, 5], [560, 94, 14, 6]], [[220, 60, 16, 5], [238, 56, 12, 5]]];
    for (k = 0; k < banks.length; k++) for (j = 0; j < banks[k].length; j++) {
      b = banks[k][j];
      P.ell(g, 0, 0, b[0], b[1] + 2, b[2], b[3], '#E7D4F4');
      P.ell(g, 0, 0, b[0], b[1], b[2] - 2, b[3] - 1, '#F7FBFF');
      P.ell(g, 0, 0, b[0], b[1] - 2, b[2] - 5, b[3] - 2, '#FFFFFF');
    }
    return o.cv;
  }
  function cloudSea() {
    var o = canvasOf(640, 360 + EX), g = o.g, x, top;
    for (x = 0; x < 640; x += 2) {
      top = 286 - Math.round(vnoise(x, 640, 40, 51) * 16 + vnoise(x, 640, 10, 52) * 4);
      F(g, '#B8C8E8', x, top + 22, 2, 360 + EX - top - 22);
      F(g, '#D8E6FF', x, top + 10, 2, 12);
      F(g, '#F7FBFF', x, top, 2, 10); F(g, '#FFFFFF', x, top, 2, 1);
    }
    return o.cv;
  }
  function spires() {
    var o = canvasOf(640, 360 + EX), g = o.g, n, x, w, h, base = 300, j;
    F(g, '#0E0408', 0, base, 640, 360 + EX - base);
    for (n = 0; n < 9; n++) {
      x = n * 72 + 10 + ((hs(n, 0, 61) * 20) | 0); w = 8 + ((hs(n, 1, 62) * 3) | 0) * 4; h = 90 + ((hs(n, 2, 63) * 90) | 0);
      F(g, '#0E0408', x, base - h, w, h + 4); F(g, '#3A1018', x, base - h, 1, h); F(g, '#1A0A0C', x + 1, base - h, 1, h);
      F(g, '#0E0408', x + (w >> 1) - 1, base - h - 14, 2, 14); F(g, '#0E0408', x + (w >> 1) - 1, base - h - 18, 1, 4);
      F(g, '#0E0408', x - 2, base - h - 4, 2, 4); F(g, '#0E0408', x + w, base - h - 4, 2, 4);
      for (j = 0; j < 3; j++) if (hs(n, j, 64) < 0.7) F(g, '#7A1020', x + 2 + ((hs(n, j, 65) * (w - 4)) | 0), base - h + 14 + j * 22, 1, 2);
    }
    return o.cv;
  }
  function emberFloor() {
    var o = canvasOf(640, 360 + EX), g = o.g, x, top;
    for (x = 0; x < 640; x += 2) {
      top = 292 - Math.round(vnoise(x, 640, 32, 71) * 8);
      F(g, '#1A0A0C', x, top, 2, 360 + EX - top); F(g, '#3A1018', x, top, 2, 2);
    }
    for (x = 0; x < 40; x++) F(g, hs(x, 0, 72) < 0.5 ? '#7A1020' : '#FF6A3A', (hs(x, 1, 73) * 640) | 0, 304 + ((hs(x, 2, 74) * 50) | 0), 2 + ((hs(x, 3, 75) * 6) | 0), 1);
    return o.cv;
  }
  function drawLoop(c, cv, w, par, camX, a, y) {
    var x = -P.mod(camX * par, w) + Math.floor(a.x0 / w) * w - w;
    for (; x < a.x1; x += w) c.drawImage(cv, x | 0, y);
  }
  function mine(level) { return level && level.tileset === 'mountain' && /^[hv]\d/.test(level.id); }
  function evilStars() {
    var o = canvasOf(640, 120), g = o.g, k;
    var S = [[30, 18], [90, 44], [150, 12], [220, 56], [280, 26], [340, 70], [410, 14], [470, 48], [540, 22], [600, 60]];
    for (k = 0; k < S.length; k++) F(g, k & 1 ? '#6A2030' : '#3A1018', S[k][0], S[k][1], 1, 1);
    F(g, '#8A2A30', 180, 34, 2, 2); F(g, '#FF6A3A', 181, 35, 1, 1);
    return o.cv;
  }
  function backdrop(c, camX, camY, level, now, a) {
    var evil = level.id.charAt(0) === 'v', S = evil ? ESKY : HSKY, k, w = a.x1 - a.x0, drift = reducedNow() ? 0 : now * 0.004;
    for (k = 0; k < 6; k++) {
      c.fillStyle = S[k];
      c.fillRect(a.x0, k === 0 ? a.y0 : k * 60, w, k === 0 ? 60 - a.y0 : k === 5 ? a.y1 - 300 : 60);
    }
    drawLoop(c, layer(evil ? 'eseam' : 'hseam', function () { return seamsOf(S, 60); }), 640, 0, 0, a, 0);
    if (evil) {
      drawLoop(c, layer('evilStars', evilStars), 640, 0.05, camX, a, 0);
      drawLoop(c, layer('spires', spires), 640, 0.2, camX, a, 0);
    } else {
      c.drawImage(layer('sun', sunCanvas), (a.x1 - 100 - camX * 0.05) | 0, 30);
      drawLoop(c, layer('rays', raysCanvas), 640, 0.05, camX, a, 0);
      drawLoop(c, layer('hiClouds', highClouds), 640, 0.15, camX + drift * 2, a, 0);
      P.fr(c, 40, 18, 2, 2, '#F4D0E8'); P.fr(c, 180, 46, 1, 1, '#E7D4F4'); P.fr(c, 320, 28, 2, 1, '#D8E6FF'); P.fr(c, 460, 52, 1, 1, '#F8E7A8');
      if (!window.NOFAR) drawLoop(c, layer('far', function () { return puffBank([[[70, 150, 28, 9], [100, 144, 24, 10], [132, 152, 26, 8]], [[330, 120, 30, 9], [362, 112, 24, 10], [394, 122, 26, 8]]], 0); }), 640, 0.3, camX + drift * 3, a, 0);
      drawLoop(c, layer('mid', function () { return puffBank([[[200, 205, 34, 11], [236, 198, 28, 12], [270, 207, 30, 9]], [[500, 190, 30, 10], [530, 183, 24, 11], [558, 192, 26, 8]]], 0); }), 640, 0.6, camX + drift * 1.5, a, 0);
    }
    drawLoop(c, layer(evil ? 'ember' : 'sea', evil ? emberFloor : cloudSea), 640, evil ? 0.4 : 0.5, camX, a, 0);
  }
  function foreground(c, camX, camY, level, now, a) {
    var evil = level.id.charAt(0) === 'v', list = evil ? ash : motes, k, f, x, y, t = reducedNow() ? 0 : now * 0.006;
    for (k = 0; k < list.length; k++) {
      f = list[k];
      x = P.mod(f.x - camX * 0.9, 700) + a.x0 - 30;
      y = P.mod(f.y - t * (evil ? 1 : 1), 400) - 20;
      c.fillStyle = evil ? (f.big ? '#6A6A6A' : '#3A3A3A') : '#FFF6DE';
      c.fillRect(x | 0, y | 0, evil && f.big ? 2 : 1, evil && f.big ? 2 : 1);
    }
    /* A gust is visible before it pushes: streaks run only while the same
       deterministic windNow() cycle that moves the hero is active. */
    if (!reducedNow() && level.wind && P.wind && P.wind().active) {
      c.fillStyle = evil ? '#FFD070' : '#FFFFFF';
      for (k = 0; k < 9; k++) {
        x = P.mod(k * 97 - camX * 0.6 - now * 0.16, 700) + a.x0 - 30;
        y = P.mod(k * 53 - camY * 0.3, 400) + a.y0 - 20;
        c.fillRect(x | 0, y | 0, 14, 1);
        c.fillRect((x + 16) | 0, (y + 1) | 0, 6, 1);
      }
    }
  }
  function chainHook(name, fn) {
    var prev = P[name];
    P[name] = function (c, camX, camY, level, now, a) {
      if (mine(level)) return fn(c, camX, camY, level, now, a);
      if (prev) return prev(c, camX, camY, level, now, a);
    };
  }
  chainHook('backdrop', backdrop); chainHook('foreground', foreground);
  var prevSkin = P.skin;
  P.skin = function (level) {
    if (mine(level)) return level.id.charAt(0) === 'v'
      ? { key: 'evil', ink: INK, deep: '#1A0A0C', base: '#3A1018', light: '#7A1020', rim: '#FF6A3A' }
      : { key: 'heaven', ink: INK, deep: '#8A6A20', base: '#C49A3A', light: '#F8E08A', rim: '#FFF6DE' };
    return prevSkin ? prevSkin(level) : null;
  };

  function marble(g, level, x, y) {
    var px = x * 16, py = y * 16, left = (level.grid[y] || '').charAt(x - 1) !== '#', right = (level.grid[y] || '').charAt(x + 1) !== '#';
    F(g, '#E2B84A', px, py, 16, 16);
    F(g, '#F8E08A', px, py + 2, 16, 1); F(g, '#FFF6DE', px, py, 16, 2);
    F(g, '#8A6A20', px, py + 8, 16, 1); F(g, '#F8E08A', px, py + 9, 16, 1);
    F(g, '#8A6A20', px + 8, py + 3, 1, 5); F(g, '#8A6A20', px + 4, py + 10, 1, 3); F(g, '#8A6A20', px + 12, py + 10, 1, 3);
    F(g, '#C49A3A', px, py + 13, 16, 3); F(g, '#8A6A20', px, py + 15, 16, 1);
    if (left) F(g, '#F8E08A', px, py + 2, 1, 11);
    if (right) F(g, '#C49A3A', px + 15, py + 2, 1, 11);
    if (hs(x, y, 81) < 0.5) F(g, '#FFFFFF', px + 2 + ((hs(x, y, 82) * 10) | 0), py + 4, 2, 1);
  }
  function obsidian(g, level, x, y) {
    var px = x * 16, py = y * 16, h = hs(x, y, 83);
    F(g, '#1A0A0C', px, py, 16, 16);
    F(g, '#7A1020', px + 1, py, 1, 16);
    F(g, '#3A1018', px, py, 16, 2); F(g, '#7A1020', px, py + 2, 16, 1);
    F(g, '#3A1018', px + 2, py + 4, 5, 1); F(g, '#3A1018', px + 9, py + 9, 5, 1); F(g, '#3A1018', px, py + 5, 1, 9);
    F(g, '#0E0408', px + 15, py + 3, 1, 13); F(g, '#0E0408', px, py + 15, 16, 1);
    if (h < 0.34) {
      F(g, '#7A1020', px + 4, py + 5, 2, 1); F(g, '#FF6A3A', px + 5, py + 6, 1, 2); F(g, '#7A1020', px + 6, py + 8, 2, 1);
      F(g, '#FF6A3A', px + 7, py + 9, 1, 2); F(g, '#7A1020', px + 8, py + 11, 2, 1);
    }
  }
  function cloudLedge(g, px, py) {
    F(g, '#FFFFFF', px + 3, py, 10, 1); F(g, '#F7FBFF', px + 1, py + 1, 14, 2); F(g, '#F7FBFF', px, py + 2, 16, 2);
    F(g, '#D8E6FF', px + 1, py + 4, 14, 2); F(g, '#B8C8E8', px + 3, py + 6, 10, 1);
  }
  function chainBridge(g, px, py) {
    var k;
    for (k = 0; k < 4; k++) { F(g, '#6A6A6A', px + k * 4, py + 1, 3, 2); F(g, '#3A3A3A', px + k * 4 + 3, py + 1, 1, 2); F(g, '#8A8A8A', px + k * 4, py + 1, 3, 1); }
    F(g, '#3A3A3A', px, py + 3, 16, 1);
    F(g, '#3A3A3A', px + 2, py + 4, 1, 4); F(g, '#6A6A6A', px + 2, py + 4, 1, 2); F(g, '#3A3A3A', px + 13, py + 4, 1, 4); F(g, '#6A6A6A', px + 13, py + 4, 1, 2);
  }
  function duskPine(g, px, py) {
    F(g, '#1A1218', px + 7, py + 10, 2, 6);
    F(g, '#2A1F24', px + 2, py + 8, 12, 3); F(g, '#2A1F24', px + 4, py + 5, 8, 3); F(g, '#2A1F24', px + 6, py + 2, 4, 3);
    F(g, '#8A5A48', px + 2, py + 8, 12, 1); F(g, '#8A5A48', px + 4, py + 5, 8, 1);
    F(g, '#C89A78', px + 6, py + 2, 4, 1); F(g, '#E8B890', px + 7, py + 1, 2, 1);
  }
  function shelfTuft(g, px, py) {
    F(g, '#8A6A20', px + 3, py + 9, 10, 2);
    F(g, '#C9A24A', px + 5, py + 5, 1, 6); F(g, '#C9A24A', px + 8, py + 4, 1, 7); F(g, '#C9A24A', px + 11, py + 6, 1, 5);
  }
  function paintDescent(g, level) {
    var evil = level.id.charAt(0) === 'v', dusk = level.id === 'v3', y, x, row, ch, px, py;
    for (y = 0; y < level.h; y++) {
      row = level.grid[y] || '';
      for (x = 0; x < level.w; x++) {
        ch = x < row.length ? row.charAt(x) : '.';
        px = x * 16; py = y * 16;
        if (ch === '.' || ch === ' ') continue;
        if (ch === '#') { if (dusk && y < 46) duskPine(g, px, py); else if (evil) obsidian(g, level, x, y); else marble(g, level, x, y); }
        else if (ch === '=') { if (evil) chainBridge(g, px, py); else cloudLedge(g, px, py); }
        else if (ch === '`') shelfTuft(g, px, py);
        else if (ch === '^' || ch === 'v' || ch === '<' || ch === '>') P.spike(g, px, py, ch, { ink: '#12081E', dark: '#5A6470', mid: '#9AA0A8', light: '#E4E4EC', tip: '#FFFFFF', base: '#3A4048' });
        else F(g, '#FF00FF', px, py, 16, 16);
      }
    }
  }
  P.painters.push(function (g, level) {
    if (!mine(level)) return false;
    paintDescent(g, level);
    return true;
  });
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
  /* A timed Ember hazard: a lava column rises on a fixed cycle and is
     warned one second ahead. Both the lava and the vents use the same
     sim clock as the hero, so a retry always starts on the same beat. */
  function emberHazards(def, i) {
    var s = { top: 68 * 16, warn: false, high: false };
    def.hazard = s;
    def.tick = function () {
      var phase = (P.time() % 5.6) / 5.6, es, k, vent;
      s.warn = phase < 0.18;
      s.high = phase >= 0.18 && phase < 0.62;
      s.top = s.high ? (68 - (phase - 0.18) / 0.44 * (14 + i * 2)) * 16 : 68 * 16;
      es = P.level0() && P.level0().entities;
      if (es) for (k = 0; k < es.length; k++) {
        vent = es[k];
        if (vent.t !== 'spring' || !vent.vent) continue;
        vent.dead = !((phase >= 0.30 && phase < 0.56) || (phase >= 0.80 && phase < 0.94));
      }
      if (P.hero() && P.hero().x > 40 * 16 && P.hero().y > s.top + 4) P.die();
    };
    def.draw = function (c, cx, cy) {
      var x0 = 40 * 16 - cx, y0 = s.top - cy, k;
      if (s.warn) {
        c.fillStyle = '#FFD070';
        for (k = 0; k < 8 * 16; k += 16) c.fillRect(x0 + k, y0 - 3, 8, 1);
      }
      if (s.high) {
        c.fillStyle = '#7A1020'; c.fillRect(x0, y0, 8 * 16, 68 * 16 - s.top);
        c.fillStyle = '#FF6A3A'; c.fillRect(x0, y0, 8 * 16, 2);
        for (k = 0; k < 12 * 8; k++) if (P.hash(k, i, 91) < 0.4) c.fillRect(x0 + (P.hash(k, i, 92) * 190) | 0, y0 + 4 + ((P.hash(k, i, 93) * 40) | 0), 2, 1);
      }
    };
  }
  function descent(prefix, i, evil) {
    var rows = blank(48, 72), base = blank(48), id = prefix + i, ents, spawn, rec, def, k, y, x0, x1, alt;
    var chapter = evil ? 'ember' : 'sun', startAlt = evil ? 2100 + i * 380 : 1250 + i * 340;
    /* the original ground walk stays the guaranteed exit route */
    fill(base, 0, 47, 14, '#');
    if (!evil) { fill(base, 6, 12, 6, '='); fill(base, 28, 34, 5, '='); }
    for (y = 0; y < base.length; y++) rows[y + 54] = base[y];
    /* three screens of vertical traversal: treads sit a short jump apart,
       so every shelf is reachable without a spring or a lucky gust. */
    for (k = 0; k < 20; k++) {
      y = 66 - k * 3;
      if (y < 9) break;
      x0 = k % 4 === 2 ? 18 : 6; x1 = k % 4 === 2 ? 42 : 36;
      fill(rows, x0, x1, y, '=');
    }
    ents = [{ t: 'exit', x: 34 + (i % 2), y: 67 }];
    for (k = 0; k < 9; k++) {
      y = 62 - k * 6;
      x0 = k % 2 ? 4 : 26; x1 = k % 2 ? 18 : 42;
      fill(rows, x0, x1, y, '=');
      if (k > 1 && k < 8) fill(rows, k % 2 ? 32 : 8, k % 2 ? 40 : 16, y - 3, '=');
      alt = startAlt + k * 120;
      ents.push(cp(k % 2 ? 6 : 30, y - 1, 'shelf' + k, alt));
      if (evil && k === 3) ents.push({ t: 'spring', x: x1 - 2, y: y - 1, vent: 1, id: id + ':vent' });
      if (!evil && k % 3 === 1) ents.push({ t: 'zip', x: x0 + 5, y: y - 2, targetX: x0 + 5, targetY: y + 2, id: id + ':cloud' + k });
    }
    put(rows, 30, 59, '`');
    if (evil && i === 3) { fill(rows, 4, 10, 26, '#'); fill(rows, 30, 38, 20, '#'); }
    ents.push({ t: 'coin', x: evil ? 38 : 8, y: 11, id: 'mtn_coin:' + id });
    ents.push(cp(4, 67, 'base', startAlt));
    spawn = { x: 2, y: 67 };
    rec = [[240, 'right']];
    def = P.level(id, {
      tiles: rows.join('\n'),
      spawn: spawn,
      entities: ents,
      tileset: 'mountain',
      chapter: chapter,
      altitude: startAlt,
      wind: evil ? { x: -36, y: -8, period: 5.6, duty: 0.7 } : { x: 55, y: 0, period: 4.2, duty: 0.65 },
      onCheckpoint: cpHook(id),
      onExit: descentExit(prefix, i)
    });
    if (evil) emberHazards(def, i);
    def.recording = rec;
    NEU.mountain.recordings[id] = rec;
  }
  for (n = 0; n <= 3; n++) { descent('h', n, false); descent('v', n, true); }

  /* Chapter scores are data on NEU.music.tracks; the director in music.js
     owns playback, so no second audio authority is created here. */
  var SECTIONS = {
    pine: { id: 'mtn_pine', name: 'PINE STEPS', bpm: 88, root: 50, sky: '#B8CCD6', ink: '#E6EEF2' },
    ridge: { id: 'mtn_ridge', name: 'WIND RIDGE', bpm: 96, root: 52, sky: '#C8D8E0', ink: '#F0F6FA' },
    crag: { id: 'mtn_crag', name: 'IRON CRAG', bpm: 110, root: 47, sky: '#A8B4C4', ink: '#E8ECF4' },
    storm: { id: 'mtn_storm', name: 'STORM WALL', bpm: 124, root: 45, sky: '#8C9AB0', ink: '#DCE4F0' },
    summit: { id: 'mtn_summit_theme', name: 'GRAND SUMMIT', bpm: 132, root: 50, sky: '#E8EEF8', ink: '#FFFFFF' },
    sun: { id: 'mtn_sun', name: 'SUNLIT SHELF', bpm: 102, root: 57, sky: '#F8E7A8', ink: '#FFF6DE' },
    ember: { id: 'mtn_ember', name: 'EMBER PASS', bpm: 138, root: 45, sky: '#3A1018', ink: '#FFD070' }
  };
  function score(id) { return SECTIONS[id] || SECTIONS.pine; }
  function registerScores() {
    if (!NEU.music || !NEU.music.tracks) return;
    var k, s, t;
    for (k in SECTIONS) {
      s = SECTIONS[k]; t = NEU.music.tracks[s.id];
      if (!t) t = NEU.music.tracks[s.id] = { bpm: s.bpm, root: s.root, scale: NEU.music.tracks.storm.scale, chords: [0, 5, 3, 4], base: 0.6,
        pad: { wave: 'triangle', gain: 0.018, oct: 0 }, bass: { wave: 'sine', gain: 0.06, oct: -12, pat: [0, null, null, null, 4, null, null, null] },
        lead: { wave: 'triangle', gain: 0.032, oct: 12, pat: [null, null, 4, null, 2, null, null, 7] } };
    }
  }
  function chapterOf(id) {
    if (P.levels[id] && /^m\d+$/.test(id)) return P.levels[id].chapter || 'pine';
    if (/^m(\d|test_)/.test(id)) return 'pine';
    return id && id.charAt(0) === 'h' ? 'sun' : 'ember';
  }
  function coinsOf(L) {
    var n = 0, got = 0, i;
    for (i = 0; i < L.entities.length; i++) if (L.entities[i].t === 'coin') {
      n++;
      if (NEU.save && NEU.save.flagged && NEU.save.flagged('plat_coin:' + L.entities[i].id)) got++;
    }
    return { got: got, total: n };
  }
  function mapDots(c, x, y, L, s) {
    var asc = /^m\d+$/.test(L.id), ids = [], i, on;
    if (asc) { for (i = 0; i < ROOMS.length; i++) if (ROOMS[i].chapter === L.chapter) ids.push(ROOMS[i].id); }
    else ids = ['h0', 'h1', 'h2', 'h3', 'v0', 'v1', 'v2', 'v3'];
    for (i = 0; i < ids.length; i++) {
      if (!asc && ids[i].charAt(0) !== L.id.charAt(0)) continue;
      on = NEU.save && NEU.save.flagged && NEU.save.flagged('mtn_' + ids[i]);
      c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(x + i * 12 - 1, y - 1, 10, 10);
      c.fillStyle = on ? s.ink : 'rgba(255,255,255,0.45)';
      c.fillRect(x + i * 12, y, 8, 8);
      if (NEU.save && NEU.save.flagged && NEU.save.flagged('mtn_coin:' + ids[i])) { c.fillStyle = '#FFD070'; c.fillRect(x + i * 12 + 2, y + 2, 4, 4); }
    }
  }
  function hud(c, L, view, now, a) {
    if (!L || L.tileset !== 'mountain' || typeof c.fillText !== 'function') return;
    var s = score(L.chapter || chapterOf(L.id)), coins = coinsOf(L), x = a.x0 + 16, y = a.y0 + 20;
    c.font = '16px monospace'; c.textBaseline = 'top';
    c.fillStyle = '#12081E'; c.globalAlpha = 0.82; c.fillRect(x - 4, y - 4, 208, 62); c.globalAlpha = 1;
    c.fillStyle = s.ink;
    c.fillText(s.name, x, y);
    c.fillText(Math.round(NEU.mountain.altitude || L.altitude || 0) + ' m', x, y + 18);
    if (coins.total) c.fillText('◆ ' + coins.got + '/' + coins.total, x + 116, y + 18);
    mapDots(c, x, y + 42, L, s);
  }
  var prevHud = P.hud;
  P.hud = function (c, L, view, now, a) {
    hud(c, L, view, now, a);
    if (prevHud) prevHud(c, L, view, now, a);
  };

  var origOpen = P.open, origReplay = P.replay;
  P.open = function (id, opts) {
    var ascent = !!P.levels[id] && (/^m\d+$/.test(id) || /^mtest_(easy|medium|hard|springs|start|flags)$/.test(id));
    var drop = !!P.levels[id] && /^[hv][0-3]$/.test(id);
    var ok;
    NEU.mountain.mood = drop ? (id.charAt(0) === 'v' ? 'evil' : 'heaven') : '';
    registerScores();
    ok = origOpen(id, opts);
    NEU.mountain.active = !!(ok && ascent);
    if (ascent || drop) {
      currentId = id;
      NEU.mountain.musicSection = score(chapterOf(id)).id;
      NEU.mountain.altitude = (P.levels[id] && P.levels[id].altitude) || NEU.mountain.altitude;
    } else if (ok) currentId = '';
    return ok;
  };
  P.replay = function (id, rec) {
    var prev = NEU.mountain.active, mood = NEU.mountain.mood, priorId = currentId, r;
    r = origReplay(id, rec);
    NEU.mountain.active = prev;
    NEU.mountain.mood = mood;
    currentId = priorId;
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
