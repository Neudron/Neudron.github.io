/* rooms-s.js — the sand path and the savanna village.
   The alley garage (rooms-d.js) opens onto s0_sand once the photo
   flag is set.    The path is 360 floor tiles: 60 s at the engine's
   96 px/s. Past it, fifteen rooms, three block puzzles and three
   short games. Puzzles are block, plate and brazier data. The games
   are kernel scenes and read keys through NEU.keys. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  if (!NEU.engine || !NEU.engine.register) return;
  var E = NEU.engine;

  E.tileset('savanna', {
    solid: '#',
    colours: { '#': '#8A5A28', '.': '#E2B84A', ',': '#C47A32', '=': '#A86828' }
  });
  E.tileset('station', {
    solid: '#',
    colours: { '#': '#2A2118', '.': '#3A2A1C', ',': '#5A4030', '=': '#1A1410' }
  });

  function say(c, lines) { c.say(lines, 'narr'); }
  function keyName(def) { return NEU.keys ? NEU.keys.label(def) : def; }

  function box(w, h) {
    var rows = [], y, x, s;
    for (y = 0; y < h; y++) {
      s = '';
      for (x = 0; x < w; x++) s += (y === 0 || x === 0 || y === h - 1 || x === w - 1) ? '#' : '.';
      rows.push(s);
    }
    return rows.join('\n');
  }
  function sandTiles() {
    var rows = [], y, x, s, ch;
    for (y = 0; y < 10; y++) {
      s = '';
      for (x = 0; x < 362; x++) {
        if (y === 0 || y === 9 || x === 0 || x === 361) ch = '#';
        else if (y >= 4 && y <= 6) ch = ',';
        else ch = '.';
        s += ch;
      }
      rows.push(s);
    }
    return rows.join('\n');
  }
  function spawn(dir) {
    if (dir === 'west') return { x: 1, y: 4, face: 'right' };
    if (dir === 'east') return { x: 9, y: 4, face: 'left' };
    if (dir === 'north') return { x: 5, y: 1, face: 'down' };
    return { x: 5, y: 7, face: 'up' };
  }
  function sp() {
    var o = {}, i;
    for (i = 0; i < arguments.length; i++) o[arguments[i]] = spawn(arguments[i]);
    return o;
  }
  function gate(dir, to, spawnName, extra) {
    var e = { t: 'exit', to: to, spawn: spawnName, style: 'arch' };
    if (dir === 'west') { e.x = 0; e.y = 4; }
    else if (dir === 'east') { e.x = 10; e.y = 4; }
    else if (dir === 'north') { e.x = 5; e.y = 0; }
    else { e.x = 5; e.y = 8; }
    var k;
    for (k in extra || {}) e[k] = extra[k];
    return e;
  }
  function prop(v, x, y) { return { t: 'savannaprop', v: v, x: x, y: y }; }
  function dress(ents) {
    return [{ t: 'savannafloor', x: 0, y: 0 }, { t: 'savannafx', x: 5, y: 8 }].concat(ents);
  }
  /* Lockdown is a flag, read when the room is entered. chase.js
     swaps the entity list. The exo rooms are not the village. */
  function room(id, def) {
    var r = E.register(id, def);
    if (NEU.chase && NEU.chase.bind) NEU.chase.bind(r);
    return r;
  }
  function addBox(id, spawns, ents, enter) {
    room(id, {
      tileset: 'savanna',
      tiles: box(11, 9),
      spawns: spawns,
      entities: dress(ents),
      onEnter: enter || null
    });
  }

  /* ── kernel minigames ──────────────────────────────────────────── */
  function routed(e) {
    var key = e.key || '';
    if (NEU.keys && NEU.keys.route) {
      var r = NEU.keys.route(key, null);
      if (r.swallow) return '';
      key = r.to || key;
    }
    if (key.length === 1) key = key.toLowerCase();
    return key;
  }
  function mount(id, hint, bg) {
    var boxEl = document.createElement('div');
    boxEl.id = id;
    boxEl.setAttribute('role', 'dialog');
    boxEl.style.position = 'fixed';
    boxEl.style.left = '0';
    boxEl.style.top = '0';
    boxEl.style.right = '0';
    boxEl.style.bottom = '0';
    boxEl.className = 'kernel-play';
    boxEl.style.zIndex = '76';
    boxEl.style.display = 'flex';
    boxEl.style.flexDirection = 'column';
    boxEl.style.alignItems = 'center';
    boxEl.style.justifyContent = 'center';
    boxEl.style.background = bg || '#C4A15A';
    var cv = document.createElement('canvas');
    cv.width = 160;
    cv.height = 96;
    cv.style.display = 'block';
    cv.style.width = 'min(100vw, 166.67vh)';
    cv.style.aspectRatio = '5 / 3';
    cv.style.imageRendering = 'pixelated';
    var cap = document.createElement('p');
    cap.style.margin = '0';
    cap.style.fontSize = '16px';
    cap.style.fontFamily = 'monospace';
    cap.style.color = bg ? '#D0D4D8' : '#3A2410';
    cap.textContent = hint;
    boxEl.appendChild(cv);
    boxEl.appendChild(cap);
    document.body.appendChild(boxEl);
    var g = cv.getContext('2d');
    if (g) g.imageSmoothingEnabled = false;
    return { box: boxEl, g: g };
  }
  function win(flag, close) {
    if (NEU.save) NEU.save.flag(flag, 1);
    if (NEU.juice) NEU.juice.hit('small');
    close();
  }

  var beadsOn = false, beadN = 0, beadUi = null, beadOff = null;
  function beadClose() {
    beadsOn = false;
    if (NEU.activeMinigame === 's_beads') NEU.activeMinigame = null;
    if (beadOff) beadOff();
    beadOff = null;
    if (beadUi && beadUi.box.parentNode) beadUi.box.parentNode.removeChild(beadUi.box);
    beadUi = null;
    if (NEU.kernel && NEU.kernel.current() === 's_beads') NEU.kernel.pop();
  }
  function beadPaint() {
    if (!beadUi || !beadUi.g) return;
    var g = beadUi.g, i;
    g.fillStyle = '#E2B84A';
    g.fillRect(0, 0, 160, 96);
    for (i = 0; i < 3; i++) {
      g.fillStyle = i < beadN ? '#C47A32' : '#8A5A28';
      g.fillRect(20 + i * 40, 36, 16, 16);
    }
  }
  function beadKey(e) {
    if (!beadsOn || e.type !== 'keydown') return;
    if (NEU.tboxOpen && NEU.tboxOpen()) return;
    if (routed(e) !== 'z' || e.repeat) return;
    beadN += 1;
    beadPaint();
    if (beadN >= 3) win('s_beads', beadClose);
  }
  if (NEU.kernel) NEU.kernel.register('s_beads', {
    open: function () {
      if (beadsOn) return;
      beadsOn = true;
      beadN = 0;
      NEU.activeMinigame = 's_beads';
      beadUi = mount('sBeads', keyName('z'));
      beadOff = function () {
        removeEventListener('keydown', beadKey);
      };
      addEventListener('keydown', beadKey);
      beadPaint();
      if (NEU.kernel.current() !== 's_beads') NEU.kernel.push('s_beads');
    },
    close: beadClose,
    running: function () { return beadsOn; },
    tick: function () { if (beadsOn) beadPaint(); }
  });

  var shellOn = false, shellSel = 0, shellUi = null, shellOff = null;
  function shellClose() {
    shellOn = false;
    if (NEU.activeMinigame === 's_shells') NEU.activeMinigame = null;
    if (shellOff) shellOff();
    shellOff = null;
    if (shellUi && shellUi.box.parentNode) shellUi.box.parentNode.removeChild(shellUi.box);
    shellUi = null;
    if (NEU.kernel && NEU.kernel.current() === 's_shells') NEU.kernel.pop();
  }
  function shellPaint() {
    if (!shellUi || !shellUi.g) return;
    var g = shellUi.g, i;
    g.fillStyle = '#E2B84A';
    g.fillRect(0, 0, 160, 96);
    for (i = 0; i < 3; i++) {
      g.fillStyle = i === shellSel ? '#F0D48A' : '#A86828';
      g.fillRect(16 + i * 48, 28, 32, 24);
      if (i === 1) { g.fillStyle = '#3A2410'; g.fillRect(28, 58, 8, 8); }
    }
  }
  function shellKey(e) {
    if (!shellOn || e.type !== 'keydown') return;
    if (NEU.tboxOpen && NEU.tboxOpen()) return;
    var k = routed(e);
    if (k === 'a' && shellSel > 0) shellSel -= 1;
    if (k === 'd' && shellSel < 2) shellSel += 1;
    if (k === 'z' && !e.repeat) {
      if (shellSel === 1) win('s_shells', shellClose);
      else if (NEU.juice) NEU.juice.hit('small');
    }
    shellPaint();
  }
  if (NEU.kernel) NEU.kernel.register('s_shells', {
    open: function () {
      if (shellOn) return;
      shellOn = true;
      shellSel = 0;
      NEU.activeMinigame = 's_shells';
      shellUi = mount('sShells', keyName('a') + ' ' + keyName('d') + ' ' + keyName('z'));
      shellOff = function () { removeEventListener('keydown', shellKey); };
      addEventListener('keydown', shellKey);
      shellPaint();
      if (NEU.kernel.current() !== 's_shells') NEU.kernel.push('s_shells');
    },
    close: shellClose,
    running: function () { return shellOn; },
    tick: function () { if (shellOn) shellPaint(); }
  });

  var windOn = false, windHeld = false, windCharge = 0, windUi = null, windOff = null;
  function windClose() {
    windOn = false;
    windHeld = false;
    if (NEU.activeMinigame === 's_wind') NEU.activeMinigame = null;
    if (windOff) windOff();
    windOff = null;
    if (windUi && windUi.box.parentNode) windUi.box.parentNode.removeChild(windUi.box);
    windUi = null;
    if (NEU.kernel && NEU.kernel.current() === 's_wind') NEU.kernel.pop();
  }
  function windPaint() {
    if (!windUi || !windUi.g) return;
    var g = windUi.g;
    var w = Math.max(0, Math.min(120, (windCharge / 1.5) * 120)) | 0;
    g.fillStyle = '#E2B84A';
    g.fillRect(0, 0, 160, 96);
    g.fillStyle = '#8A5A28';
    g.fillRect(20, 40, 120, 16);
    g.fillStyle = '#F0D48A';
    g.fillRect(20, 40, w, 16);
  }
  function windKey(e) {
    if (!windOn) return;
    if (routed(e) !== 'd') return;
    windHeld = e.type === 'keydown';
  }
  if (NEU.kernel) NEU.kernel.register('s_wind', {
    open: function () {
      if (windOn) return;
      windOn = true;
      windHeld = false;
      windCharge = 0;
      NEU.activeMinigame = 's_wind';
      windUi = mount('sWind', keyName('d'));
      windOff = function () {
        removeEventListener('keydown', windKey);
        removeEventListener('keyup', windKey);
      };
      addEventListener('keydown', windKey);
      addEventListener('keyup', windKey);
      windPaint();
      if (NEU.kernel.current() !== 's_wind') NEU.kernel.push('s_wind');
    },
    close: windClose,
    running: function () { return windOn; },
    tick: function (dt) {
      if (!windOn) return;
      var sec = (dt || 0) / 1000;
      if (sec > 0.05) sec = 0.05;
      if (windHeld) windCharge += sec;
      windPaint();
      if (windCharge >= 1.5) win('s_wind', windClose);
    }
  });

  NEU.savanna = {
    open: function (name) {
      var id = name === 'beads' ? 's_beads' : name === 'shells' ? 's_shells' : name === 'wind' ? 's_wind' : name;
      var sc = NEU.kernel && NEU.kernel.scenes[id];
      if (sc && sc.open) sc.open();
    }
  };

  /* ── s0 the sand ───────────────────────────────────────────────── */
  var trees = [], ti;
  for (ti = 0; ti < 8; ti++) trees.push(prop('acacia', 24 + ti * 40, ti % 2 ? 2 : 7));
  room('s0_sand', {
    tileset: 'savanna',
    tiles: sandTiles(),
    spawns: { west: { x: 1, y: 5, face: 'right' }, east: { x: 360, y: 5, face: 'left' } },
    entities: [{ t: 'savannafloor', x: 0, y: 0 }, { t: 'savannafx', x: 1, y: 8 }]
      .concat(trees)
      .concat([
        { t: 'exit', x: 0, y: 5, to: 'd2_alley', spawn: 'garage', style: 'door' },
        { t: 'exit', x: 361, y: 5, to: 's1_gate', spawn: 'west', style: 'arch' }
      ]),
    onEnter: function (c) {
      if (c.flagged('s0_seen')) return;
      c.flag('s0_seen', 1);
      say(c, ['sand. a few trees. the wind does not hurry.',
              'the village is at the far end. it is not close.']);
    }
  });

  /* ── village ───────────────────────────────────────────────────── */
  addBox('s1_gate', sp('west', 'east', 'north', 'south'), [
    gate('west', 's0_sand', 'east'),
    gate('east', 's3_market', 'west'),
    gate('north', 's4_shade', 'south'),
    gate('south', 's2_well', 'south'),
    { t: 'save', x: 2, y: 2 },
    prop('acacia', 8, 2),
    { t: 'sign', x: 3, y: 2, lines: ['the sand is behind you. the village is ahead, and also beside.'] }
  ], function (c) {
    if (NEU.snail) NEU.snail.arrive('s1');
    if (c.flagged('s1_seen')) return;
    c.flag('s1_seen', 1);
    say(c, ['golden grass. the heat sits on it and does not blink.']);
  });

  room('s2_well', {
    tileset: 'savanna',
    tiles: ['######', '#....#', '#....#', '#....#', '######'].join('\n'),
    spawns: {
      west: { x: 1, y: 2, face: 'right' },
      east: { x: 4, y: 2, face: 'left' },
      south: { x: 3, y: 3, face: 'up' }
    },
    entities: dress([
      { t: 'block', x: 2, y: 2, push: true },
      { t: 'plate', x: 3, y: 2 },
      { t: 'exit', x: 3, y: 4, to: 's1_gate', spawn: 'south', style: 'arch' },
      { t: 'exit', x: 5, y: 2, to: 's5_baobab', spawn: 'west', locked: 'solved:s2_well', style: 'door',
        lines: ['a gate of sticks.', 'it opens when the stone sits on the plate.'] },
      { t: 'sign', x: 4, y: 1, lines: ['one stone. one plate. push it right.'] }
    ]),
    onEnter: function (c) {
      if (c.flagged('s2_seen')) return;
      c.flag('s2_seen', 1);
      say(c, ['one stone, one plate.',
              'press ' + keyName('z') + ' to push it.',
              'press ' + keyName('r') + ' if you hate the result.']);
    },
    onSolved: function (c) { c.markSolved('s2_well'); }
  });

  addBox('s3_market', sp('west', 'east', 'north'), [
    gate('west', 's1_gate', 'east'),
    gate('east', 's6_kraal', 'west'),
    gate('north', 's9_beads', 'south'),
    prop('hut', 3, 2),
    { t: 'sign', x: 7, y: 2, lines: ['mats, beads, and nothing with a price.'] }
  ], function () { if (NEU.snail) NEU.snail.arrive('s3'); });

  addBox('s4_shade', sp('south', 'east', 'north'), [
    gate('south', 's1_gate', 'north'),
    gate('east', 's7_pool', 'west'),
    gate('north', 's10_shells', 'south'),
    prop('acacia', 3, 6),
    { t: 'sign', x: 7, y: 6, lines: ['shade. the only architecture the trees agreed to.'] }
  ]);

  addBox('s5_baobab', sp('west', 'east'), [
    gate('west', 's2_well', 'east'),
    gate('east', 's8_hearth', 'west'),
    prop('acacia', 5, 2),
    { t: 'sign', x: 5, y: 6, lines: ['a tree older than the argument about who planted it.'] }
  ]);

  room('s6_kraal', {
    tileset: 'savanna',
    tiles: ['#######', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '#######'].join('\n'),
    spawns: { west: { x: 1, y: 3, face: 'right' }, south: { x: 3, y: 5, face: 'up' } },
    entities: dress([
      { t: 'block', x: 2, y: 2, push: true },
      { t: 'plate', x: 3, y: 2 },
      { t: 'block', x: 2, y: 4, push: true },
      { t: 'plate', x: 3, y: 4 },
      { t: 'exit', x: 0, y: 3, to: 's3_market', spawn: 'east', style: 'arch' },
      { t: 'exit', x: 3, y: 6, to: 's11_elder', spawn: 'north', style: 'arch' },
      { t: 'sign', x: 5, y: 3, lines: ['two stones. two plates. one push each, to the right.'] }
    ]),
    onEnter: function (c) {
      if (NEU.snail) NEU.snail.arrive('s6');
      if (c.flagged('s6_seen')) return;
      c.flag('s6_seen', 1);
      say(c, ['two lanes. the well was the lesson. this is the same lesson twice.',
              'press ' + keyName('r') + ' to put the stones back.']);
    },
    onSolved: function (c) { c.markSolved('s6_kraal'); }
  });

  addBox('s7_pool', sp('west', 'east', 'north'), [
    gate('west', 's4_shade', 'east'),
    gate('east', 's12_termite', 'west'),
    gate('north', 's13_wind', 'south'),
    prop('well', 4, 6),
    { t: 'sign', x: 7, y: 6, lines: ['a pool with no water and a great deal of mud.'] }
  ]);

  var hearth = [];
  function lightHearth(c, n) {
    var es = c.ents(), b = null, i;
    for (i = 0; i < es.length; i++) if (es[i].t === 'brazier' && es[i].n === n) b = es[i];
    if (!b || b.lit) return;
    if (hearth.length !== n) {
      for (i = 0; i < es.length; i++) if (es[i].t === 'brazier') es[i].lit = false;
      hearth = [];
      say(c, ['they go out.', 'left to right. the room is not subtle.']);
      return;
    }
    b.lit = true;
    hearth.push(n);
    if (hearth.length === 3) {
      c.flag('s8_lit', 1);
      c.check();
    }
  }
  room('s8_hearth', {
    tileset: 'savanna',
    tiles: ['#########', '#.......#', '#.......#', '#.......#', '#.......#', '#########'].join('\n'),
    spawns: { west: { x: 1, y: 3, face: 'right' } },
    entities: dress([
      { t: 'brazier', x: 1, y: 1, n: 0, run: function (c) { lightHearth(c, 0); } },
      { t: 'brazier', x: 3, y: 1, n: 1, run: function (c) { lightHearth(c, 1); } },
      { t: 'brazier', x: 5, y: 1, n: 2, run: function (c) { lightHearth(c, 2); } },
      { t: 'block', x: 2, y: 3, push: true },
      { t: 'plate', x: 3, y: 3 },
      { t: 'exit', x: 8, y: 3, to: 's5_baobab', spawn: 'east', style: 'arch' },
      { t: 'sign', x: 6, y: 2, lines: ['three fires, left to right, and the stone on its plate.'] }
    ]),
    solved: function (c) { return !!c.flagged('s8_lit') && !!c.entHere(3, 3, 'block'); },
    onReset: function () { hearth = []; if (NEU.save) NEU.save.flag('s8_lit', 0); },
    onSolved: function (c) { c.markSolved('s8_hearth'); },
    onEnter: function (c) {
      if (c.flagged('s8_seen')) return;
      c.flag('s8_seen', 1);
      say(c, ['light them from the left. then push the stone.',
              'press ' + keyName('r') + ' if the fires go out and you would like them to mean it.']);
    }
  });

  function gameNpc(x, y, game) {
    var flag = game === 'beads' ? 's_beads' : game === 'shells' ? 's_shells' : 's_wind';
    return { t: 'npc', x: x, y: y, colour: '#8A5A28',
      run: function (c) {
        if (c.flagged(flag)) { say(c, ['done. the village noticed, briefly.']); return; }
        if (NEU.savanna) NEU.savanna.open(game);
      } };
  }
  addBox('s9_beads', sp('south'), [
    gate('south', 's3_market', 'north'),
    gameNpc(3, 3, 'beads'),
    { t: 'sign', x: 7, y: 3, lines: ['three beads. the board names the key. press it once for each.'] }
  ]);
  addBox('s10_shells', sp('south'), [
    gate('south', 's4_shade', 'north'),
    gameNpc(3, 3, 'shells'),
    { t: 'sign', x: 7, y: 3, lines: ['three shells. the pea is under the middle one.'] }
  ]);
  addBox('s11_elder', sp('north', 'south'), [
    gate('north', 's6_kraal', 'south'),
    gate('south', 's14_station', 'north'),
    prop('hut', 5, 4),
    { t: 'npc', x: 4, y: 5, colour: '#5C3A18',
      lines: ['the elder is asleep in the shade.', 'the shade is doing all the work.'] }
  ], function () { if (NEU.snail) NEU.snail.arrive('s11'); });

  room('s14_station', {
    tileset: 'station',
    tiles: box(11, 9),
    spawns: sp('north'),
    entities: [
      { t: 'exit', x: 5, y: 0, to: 's11_elder', spawn: 'south', style: 'arch' },
      { t: 'npc', x: 5, y: 4, colour: '#C47A32',
        run: function () { if (NEU.snail) NEU.snail.open(); } },
      { t: 'sign', x: 3, y: 6, lines: ['the snails stop where you have already stood.'] }
    ],
    onEnter: function (c) {
      if (NEU.snail) NEU.snail.arrive('s14');
      if (c.flagged('s14_seen')) return;
      c.flag('s14_seen', 1);
      say(c, ['a stair, then dark, then a snail the size of a cart.',
              'it goes to the stops you have already seen.']);
    }
  });
  addBox('s12_termite', sp('west', 'east'), [
    gate('west', 's7_pool', 'east'),
    gate('east', 'x0_foyer', 'west'),
    prop('hut', 6, 4),
    { t: 'sign', x: 3, y: 3, lines: ['a mound. the termites are not taking visitors.'] }
  ]);
  addBox('s13_wind', sp('south'), [
    gate('south', 's7_pool', 'north'),
    gameNpc(3, 3, 'wind'),
    { t: 'sign', x: 5, y: 5, lines: ['hold the key the grass names until the line is full.'] },
    prop('acacia', 7, 3)
  ]);

  NEU.act4RoomsS = ['s0_sand', 's1_gate', 's2_well', 's3_market', 's4_shade', 's5_baobab',
    's6_kraal', 's7_pool', 's8_hearth', 's9_beads', 's10_shells', 's11_elder', 's12_termite', 's13_wind',
    's14_station'];

  /* ── mechanical house (Exo lab) ────────────────────────────────── */
  E.tileset('exo', {
    solid: '#',
    colours: { '#': '#1A1E24', '.': '#1A1E24', ',': '#12383C', '=': '#E2C04A' }
  });
  function exoHall() {
    return [
      '###########',
      '#.........#',
      '#.........#',
      '#.........#',
      '#=========#',
      '#.........#',
      '#.........#',
      '#.........#',
      '###########'
    ].join('\n');
  }
  function exoDress(ents) {
    return [{ t: 'exofloor', x: 0, y: 0 }, { t: 'exoprop', v: 'eye', x: 1, y: 2 },
      { t: 'exoprop', v: 'holo', x: 8, y: 3 }].concat(ents);
  }

  var spiralOn = false, spiralStep = 0, spiralT = 0, spiralUi = null, spiralOff = null;
  function spiralFace() {
    return NEU.exoLook ? NEU.exoLook.faceOf(spiralStep) : (spiralStep + 4) % 8;
  }
  function spiralReduced() {
    return !!(NEU.exoLook && NEU.exoLook.reduced && NEU.exoLook.reduced());
  }
  function spiralSync() {
    NEU.house.state.climb = spiralStep;
    NEU.house.state.face = spiralFace();
    NEU.house.state.t = spiralT;
    NEU.house.state.on = spiralOn;
  }
  function spiralPaint() {
    var st;
    spiralSync();
    if (!spiralUi || !spiralUi.g) return;
    st = { climb: spiralStep, face: spiralFace(), t: spiralT };
    if (NEU.exoLook && NEU.exoLook.paintSpiral) NEU.exoLook.paintSpiral(spiralUi.g, st);
    else {
      spiralUi.g.fillStyle = '#FF00FF';
      spiralUi.g.fillRect(0, 0, 160, 96);
    }
    if (st.parallax) NEU.house.state.parallax = st.parallax;
  }
  function spiralClose() {
    spiralOn = false;
    if (NEU.activeMinigame === 'x_spiral') NEU.activeMinigame = null;
    if (spiralOff) spiralOff();
    spiralOff = null;
    if (spiralUi && spiralUi.box.parentNode) spiralUi.box.parentNode.removeChild(spiralUi.box);
    spiralUi = null;
    if (NEU.house) spiralSync();
    if (NEU.kernel && NEU.kernel.current() === 'x_spiral') NEU.kernel.pop();
  }
  function spiralArrive() {
    if (NEU.save) NEU.save.flag('x_climbed', 1);
    spiralClose();
    if (NEU.engine && NEU.engine.enter) NEU.engine.enter('x2_arena', 'stair');
  }
  function spiralMove(dir) {
    if (dir < 0) {
      if (spiralStep > 0) spiralStep -= 1;
      spiralPaint();
      return;
    }
    spiralStep += 1;
    if (!spiralReduced() && NEU.juice) NEU.juice.hit('small');
    if (spiralStep >= 8) { spiralArrive(); return; }
    spiralPaint();
  }
  function spiralKey(e) {
    var k;
    if (!spiralOn || e.type !== 'keydown' || e.repeat) return;
    if (NEU.tboxOpen && NEU.tboxOpen()) return;
    k = routed(e);
    if (k === 'Escape') { spiralClose(); return; }
    if (k === 'w' || k === 'ArrowUp') spiralMove(1);
    else if (k === 's' || k === 'ArrowDown') spiralMove(-1);
  }
  function spiralOpen() {
    if (spiralOn) return;
    spiralOn = true;
    spiralStep = 0;
    spiralT = 0;
    NEU.activeMinigame = 'x_spiral';
    spiralUi = mount('xSpiral', keyName('w') + ' climbs, ' + keyName('s') + ' descends', '#1A1E24');
    spiralOff = function () { removeEventListener('keydown', spiralKey); };
    addEventListener('keydown', spiralKey);
    if (NEU.kernel && NEU.kernel.current() !== 'x_spiral') NEU.kernel.push('x_spiral');
    if (NEU.talk && NEU.save && !NEU.save.flagged('x_spiral_seen')) {
      NEU.save.flag('x_spiral_seen', 1);
      NEU.talk(['* the chair turns as you climb.'], 'draedon');
    }
    spiralPaint();
  }
  NEU.house = {
    open: spiralOpen,
    close: spiralClose,
    step: function (dt) {
      var sec;
      if (!spiralOn) return;
      sec = typeof dt === 'number' ? dt : 0;
      if (sec > 2) sec = sec / 1000;
      if (sec < 0) sec = 0;
      if (sec > 0.05) sec = 0.05;
      if (!spiralReduced()) spiralT += sec;
      spiralPaint();
    },
    state: { climb: 0, face: 4, t: 0, on: false, parallax: [0, 0, 0] }
  };
  if (NEU.kernel) NEU.kernel.register('x_spiral', {
    open: spiralOpen,
    close: spiralClose,
    running: function () { return spiralOn; },
    tick: function (dt) { NEU.house.step(dt); }
  });

  E.register('x0_foyer', {
    tileset: 'exo',
    tiles: exoHall(),
    spawns: sp('west', 'north'),
    entities: exoDress([
      gate('west', 's12_termite', 'east'),
      gate('north', 'x1_spiral', 'south'),
      { t: 'sign', x: 3, y: 6, lines: ['a stair. the chair at the top has already turned.'] }
    ]),
    onEnter: function (c) {
      if (c.flagged('x0_seen')) return;
      c.flag('x0_seen', 1);
      c.say(['steel, and a stair that does not trust you.',
        'something at the top is already looking down.']);
    }
  });
  E.register('x1_spiral', {
    tileset: 'exo',
    tiles: exoHall(),
    spawns: { south: { x: 5, y: 7, face: 'up' } },
    entities: exoDress([
      { t: 'exit', x: 5, y: 8, to: 'x0_foyer', spawn: 'north', style: 'stairs' }
    ]),
    onEnter: function () { if (NEU.house) NEU.house.open(); }
  });
  E.register('x2_arena', {
    tileset: 'exo',
    tiles: exoHall(),
    spawns: { stair: { x: 5, y: 7, face: 'up' }, south: { x: 5, y: 7, face: 'up' } },
    entities: exoDress([
      { t: 'npc', x: 5, y: 3, colour: '#20C8D0',
        run: function (c) {
          if (NEU.exo && NEU.exo.open) NEU.exo.open();
          else c.say(['the arena door is shut.']);
        } },
      { t: 'exit', x: 5, y: 8, to: 'x0_foyer', spawn: 'north', style: 'hatch' }
    ])
  });
  NEU.act4RoomsX = ['x0_foyer', 'x1_spiral', 'x2_arena'];
})();
