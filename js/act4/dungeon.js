/* dungeon.js — the dungeon (B3): ONE connected map under the woods, Terraria-shaped (a surface castle,
   then a winding descent of eleven 40x24 zones stitched on a 3x6 grid, brick between them). The only save
   is at the door; any death wakes you there, so d3/d6/d9 open chain lifts back up (flag dgn_lift_<n>).
   Kept contracts: NEU.plat.open('d0'..'d10'), the d5 mage gate, the d10 bone door (boss_key -> polt),
   the painting (cart + painting_found), flag dgn_depth, NEU.dungeon.{here,spawnPx,bossOpen,bossLine,mageSign,toSurface}. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var P = NEU.plat;
  if (!P || !P._kinds) return;
  var kinds = P._kinds, T = 16, W = 128, H = 148, ZW = 40, ZH = 24, SURF = 15, INK = '#12081E';
  /* each zone's cell on the 3x6 grid; GRID is the faction of every cell: B brick (blue), G slab (green), P tiled (pink) */
  var CELL = [[1, 0], [1, 1], [2, 1], [2, 2], [1, 2], [1, 3], [0, 3], [0, 4], [1, 4], [1, 5], [2, 5]];
  var GRID = ['BBB', 'BBB', 'BBB', 'GBB', 'GPP', 'PPP'];
  var SIGN = {
    d0: ['* the old dungeon. one save, here at the door.', '* fall anywhere below and you wake up here.'],
    d1: ['* Z swings the axe. X dashes, SPACE jumps.', '* SHIFT grabs a wall and climbs.'],
    d4: ['* hold Z, then let go: a soul shot.'],
    d5: ['* graze their shots to fill TP.', '* C opens the strip. it slows the world.']
  };
  /* legend: ' ' sky  . air + back wall  # brick  g grass  = shelf  k cracked brick (crumbles)  ^v<> spikes
     decor: c chain  L chain lantern  w water candle  b banner  B bookcase  p pot  $ coin
     props: S zone spawn  P save  n sign  K keeper  F painting  M mage gate  D bone door  l lift  r spring
     foes (dgn-foes.js): u cursed skull  U giant cursed skull  a/t/h blue/rusty/hell armored bones  N necromancer
     G ragged caster  X diabolist  y sniper  T tactical  C commando  E paladin  Y renegade warlock  Q phantom spirit
     hazards: O spike ball  W blazing wheel */
  var ZONES = {
    d0: ['                                        ',
      '                                        ',
      '          ##  ##  ##  ##  ##  ##        ',
      '          ######################        ',
      '          #..c....b....b....c..#        ',
      '          #..c..............c..#        ',
      '          #..L..............L..#        ',
      '          #...w............w...#        ',
      '          #..====........====..#        ',
      '          #....................#        ',
      '          #....................#        ',
      '          #....................#        ',
      '          ........F.............        ',
      '          ......................        ',
      '  S   K   ...P.n.w.......l.l.l..        ',
      'gggggggggg########....##########gggggggg',
      'gggggggggg########....##########gggggggg',
      'gggggggggg########....##########gggggggg',
      'gggggggggg########....##########gggggggg',
      'gggggggggg########....##########gggggggg',
      'gggggggggg########....##########gggggggg',
      'gggggggggg########....##########gggggggg',
      'gggggggggg########....##########gggggggg',
      'gggggggggg########....##########gggggggg'],
    d1: ['##################....##################',
      '########..c...............c.......######',
      '########..c...............c.......######',
      '########..L...............L.......######',
      '########..........S...............######',
      '########..........=====...........######',
      '########..........................######',
      '########..........................######',
      '########....=====.........u.......######',
      '########..........................######',
      '########..........................######',
      '########..................=====...######',
      '########..........................######',
      '########..........................######',
      '########.....=====................######',
      '########..........................######',
      '########..........................######',
      '########..........................######',
      '########................................',
      '########................................',
      '########..n.p.....................w.....',
      '####################........############',
      '####################^^^^^^^^############',
      '########################################'],
    d2: ['########################################',
      '########################################',
      '########################################',
      '########################################',
      '########################################',
      '########################################',
      '########################################',
      '########################################',
      '########################################',
      '########################################',
      '########################################',
      '########################################',
      '#....c.........b........c..........#####',
      '#....c..................c..........#####',
      '#....L..................L..........#####',
      '#..................................#####',
      '#..............=====...............#####',
      '#...............$$$................#####',
      '...................................#####',
      '...................................#####',
      '..S......w..........p.....a.w......#####',
      '#####kkkkkk#######kkkkkk######....######',
      '#####^^^^^^#######^^^^^^######....######',
      '##############################....######'],
    d3: ['##############################....######',
      '######################..O.............##',
      '######################............c...##',
      '######################............c...##',
      '######################............L...##',
      '######################................##',
      '......................................##',
      '....a.....w...........................##',
      '......................................##',
      '######################................##',
      '######################................##',
      '######################................##',
      '######################................##',
      '######################................##',
      '######################................##',
      '######################................##',
      '######################................##',
      '######################................##',
      '######################................##',
      '######################................##',
      '######################....w...S....l..##',
      '########################################',
      '########################################',
      '########################################'],
    d4: ['########################################',
      '########################################',
      '########################################',
      '########################################',
      '########################################',
      '##....b.........b.........b.............',
      '##......................................',
      '##......................................',
      '##..............n......w.............S..',
      '##......################################',
      '##................................######',
      '##.....c..........c...........c...######',
      '##.....L..........c...........L...######',
      '##................L...............######',
      '##...........w....................######',
      '##..........=========.............######',
      '##................................######',
      '##................................######',
      '##................................######',
      '##................................######',
      '##.......B...p...N....B...B...w...######',
      '####....################################',
      '####....################################',
      '####....################################'],
    d5: ['####....################################',
      '##..................................####',
      '##....c.....b...........b.....c.....####',
      '##....c.......................c.....####',
      '##...SL.......................L.....####',
      '##..====............................####',
      '##..................................####',
      '##..................................####',
      '##..................................####',
      '##............=======...............####',
      '##..................................####',
      '##..................................####',
      '##....=====...............=====.....####',
      '##..................................####',
      '##..................................####',
      '##..................................####',
      '##..................................####',
      '##..................................####',
      '....................................####',
      '....................................####',
      '..n...w.......E....p....w......M....####',
      '########################################',
      '########################################',
      '########################################'],
    d6: ['########################################',
      '########################################',
      '########################################',
      '########################################',
      '########################################',
      '########################################',
      '########################################',
      '########################################',
      '########################################',
      '########################################',
      '########################################',
      '##...c.........b..........c.........####',
      '##...c....................c.........####',
      '##...L....................L.........####',
      '##..................................####',
      '##..................................####',
      '##..................................####',
      '##......................$.$.$.......####',
      '##......................................',
      '##......................................',
      '##.....G..........t.................S.l.',
      '##....###........####............#######',
      '##....###^^^^^^^^####^^^^^^^^^^^^#######',
      '##....##################################'],
    d7: ['##....##################################',
      '##....##################################',
      '##....##################################',
      '##....##################################',
      '##....##################################',
      '##....##################################',
      '##....##################################',
      '##....##################################',
      '##....##################################',
      '##....##################################',
      '##....##################################',
      '##..c.........b.........b.........c..###',
      '##..L.............................L..###',
      '##...................................###',
      '##................................y..###',
      '##..............................=====###',
      '##...................................###',
      '##...................................###',
      '##......................................',
      '##........#......#......#...............',
      '##.S..p...#..w...#..T...#..........y....',
      '########################################',
      '########################################',
      '########################################'],
    d8: ['########################################',
      '########################################',
      '########################################',
      '########################################',
      '########################################',
      '########################################',
      '##..c...........b..........c......######',
      '##..c......................c......######',
      '##..L......................L......######',
      '##................................######',
      '##................................######',
      '##.........$$.....................######',
      '##........====....................######',
      '##................................######',
      '##................................######',
      '##..........W...^^^...............######',
      '##..........###########...........######',
      '##..........###########...........######',
      '............###########...........######',
      '............###########...........######',
      '..S..r....h.###########..X........######',
      '#######################kkkkkkk....######',
      '#######################^^^^^^^....######',
      '##############################....######'],
    d9: ['##############################....######',
      '##....................................##',
      '##...c.........b.........b........c...##',
      '##...c............................c...##',
      '##...L.........................S..L...##',
      '##............................====....##',
      '##....................................##',
      '##.........U..........................##',
      '##....................................##',
      '##....=======............=======......##',
      '##....................................##',
      '##....................................##',
      '##..............=======...............##',
      '##....................................##',
      '##....................................##',
      '##....................................##',
      '##....................................##',
      '##....................................##',
      '##......................................',
      '##......................................',
      '##..w....C.........Y....p.....l..w......',
      '########################################',
      '########################################',
      '########################################'],
    d10: ['########################################',
      '########################################',
      '########################################',
      '########################################',
      '########################################',
      '########################################',
      '########################################',
      '########################################',
      '########################################',
      '########################################',
      '########################################',
      '#....c..........b.........b........c####',
      '#....c............................c.####',
      '#....L............................L.####',
      '#...................................####',
      '#..........Q.........Q..............####',
      '#...................................####',
      '#...................................####',
      '....................................####',
      '....................................####',
      '..S...w.....p.......w.........D.....####',
      '########################################',
      '########################################',
      '########################################']
  };
  var FOE = 'uUathNGXyTCEYQOW', DECOR = 'cLwbB';
  var zones = [], spawners = [], decor = [], ents = [], cracks = {}, save = null, lifts = {}, here = '', goal = '', live = null;
  /* W10: the surface hut; BED is the respawn cell every death lands on. */
  var BED = { x: 22, y: 14 }, HUT = { x0: 16, x1: 32, roof: 9, wall0: 10, wall1: 14 };

  function zoneAt(px, py) {
    var tx = Math.floor(px / T), ty = Math.floor(py / T), i, z;
    for (i = 0; i < zones.length; i++) { z = zones[i]; if (tx >= z.x && tx < z.x + ZW && ty >= z.y && ty < z.y + ZH) return z; }
    return null;
  }
  function faction(tx, ty) {
    var c = Math.max(0, Math.min(2, Math.floor((tx - 4) / ZW))), r = Math.max(0, Math.min(5, Math.floor(ty / ZH)));
    return GRID[r].charAt(c);
  }
  function build() {
    var g = [], x, y, i, n, z, rows, ch, wx, wy, row, id;
    for (y = 0; y < H; y++) { row = []; for (x = 0; x < W; x++) row.push(y < SURF ? ' ' : y < ZH ? 'g' : '#'); g.push(row); }
    for (n = 0; n < CELL.length; n++) {
      id = 'd' + n; rows = ZONES[id];
      z = { id: id, n: n, x: 4 + CELL[n][0] * ZW, y: CELL[n][1] * ZH, spawn: null };
      z.wall = faction(z.x, z.y); zones.push(z);
      for (y = 0; y < ZH; y++) for (x = 0; x < ZW; x++) {
        ch = rows[y].charAt(x); wx = z.x + x; wy = z.y + y;
        g[wy][wx] = (ch === ' ' || ch === '#' || ch === 'g' || ch === '=' || '^v<>'.indexOf(ch) >= 0) ? ch : rows[y].charAt(x - 1) === ' ' || rows[y].charAt(x + 1) === ' ' ? ' ' : '.';
        if (ch === 'S') z.spawn = { x: wx, y: wy };
        else if (ch === 'k') { ents.push({ t: 'crumble', x: wx, y: wy }); cracks[wy + ',' + wx] = 'k'; }
        else if (DECOR.indexOf(ch) >= 0) decor.push({ k: ch, x: wx, y: wy, f: z.wall });
        else if (FOE.indexOf(ch) >= 0) spawners.push({ k: ch, x: wx, y: wy, zone: id });
        else if (ch === 'P') { save = { x: wx, y: wy }; ents.push({ t: 'dsave', x: wx, y: wy }); }
        else if (ch === 'n') ents.push({ t: 'sign', x: wx, y: wy, lines: SIGN[id] });
        else if (ch === 'K') ents.push({ t: 'keeper', x: wx, y: wy });
        else if (ch === 'F') ents.push({ t: 'painting', x: wx, y: wy });
        else if (ch === 'M') ents.push({ t: 'magegate', x: wx, y: wy });
        else if (ch === 'D') ents.push({ t: 'bossdoor', x: wx, y: wy });
        else if (ch === 'r') ents.push({ t: 'spring', x: wx, y: wy });
        else if (ch === 'p') ents.push({ t: 'pot', x: wx, y: wy });
        else if (ch === '$') ents.push({ t: 'coin', x: wx, y: wy });
        else if (ch === 'l') ents.push({ t: 'lift', x: wx, y: wy, n: n });
      }
    }
    /* W10 surface hut: packed-earth hut on the open grass, west of the castle. */
    for (x = HUT.x0 - 1; x <= HUT.x1 + 1; x++) g[HUT.roof][x] = 'g';
    for (y = HUT.wall0; y <= HUT.wall1; y++) {
      g[y][HUT.x0] = 'g'; g[y][HUT.x1] = 'g';
      for (x = HUT.x0 + 1; x < HUT.x1; x++) g[y][x] = ' ';
    }
    g[HUT.wall1 - 1][HUT.x0] = ' '; g[HUT.wall1][HUT.x0] = ' ';   /* the door */
    ents.push({ t: 'bed', x: 18, y: HUT.wall1 });
    decor.push({ k: 'L', x: 26, y: HUT.wall0, f: 'B' });
    /* d0 holds the three lift heads, in order, for the lifts of d3, d6 and d9 */
    n = 0;
    for (i = 0; i < ents.length; i++) if (ents[i].t === 'lift') {
      if (ents[i].n === 0) { ents[i].n = [3, 6, 9][n++]; ents[i].top = true; }
      lifts[ents[i].n + (ents[i].top ? 'top' : '')] = ents[i];
    }
    ents.push({ t: 'leave', x: 1, y: SURF - 1 }, { t: 'leave', x: W - 2, y: SURF - 1 });
    return g.map(function (r) { return r.join(''); });
  }
  function px(cell) { return cell ? { x: (cell.x + 0.5) * T, y: (cell.y + 1) * T } : null; }
  function dN(id) { var m = /^d(\d+)$/.exec(id || ''); return m && +m[1] <= 10 ? +m[1] : -1; }
  function talk(lines) { if (NEU.talk && !P.replaying()) NEU.talk(lines, 'narr'); }
  function flag(k, v) { if (NEU.save && NEU.save.flag && !P.replaying()) NEU.save.flag(k, v); }
  function flagged(k) { return !!(NEU.save && NEU.save.flagged && NEU.save.flagged(k)); }

  var def = P.level('dgn', {
    rows: build(), spawn: zones[0].spawn, entities: ents, tileset: 'dungeon', view: 'terraria', chunked: true, hp: 6, solid: '#g',
    onOpen: function (opts) {
      live = P.level0(); here = ''; goal = opts.goal || '';
      track();
    },
    onDeath: function () { toSurface(); },
    tick: function () { track(); }
  });
  def.zones = zones; def.decor = decor; def.cracks = cracks; def.spawners = spawners; def.faction = faction; def.zoneAt = zoneAt;
  /* backward-compat aliases so legacy tests/suites that reference d0..d10 levels resolve to the one map */
  for (var _ai = 0; _ai <= 10; _ai++) P.levels['d' + _ai] = def;

  /* the zone under the hero: entering one keeps the deepest depth reached, and d3/d6/d9 open their lift */
  function track() {
    var h = P.hero(), z = zoneAt(h.x, h.y - 11), id, depth;
    /* the open surface band is d0's: castle and hut both live there */
    if (!z && h.y - 11 < ZH * T) z = zones[0];
    id = z ? z.id : here;
    if (id !== here) {
      here = id;
      if (z) {
        depth = NEU.save && NEU.save.flag ? NEU.save.flag('dgn_depth') : undefined;
        if (depth === undefined || depth === null || z.n > depth) flag('dgn_depth', z.n);
        if (z.n === 3 || z.n === 6 || z.n === 9) flag('dgn_lift_' + z.n, 1);
        if (z.n === 10) { NEU.dungeon.bossOpen = false; NEU.dungeon.bossLine = ''; }
        if (z.n === 5) NEU.dungeon.mageSign = '';
      }
    }
    if (goal && P.replaying() && (id === goal || (goal === 'door' && near('bossdoor', 40)))) live.exited = true;
  }
  function near(t, r) {
    var h = P.hero(), i, e;
    for (i = 0; i < live.entities.length; i++) { e = live.entities[i]; if (e.t === t && Math.abs((e.x + 0.5) * T - h.x) < r && Math.abs((e.y + 1) * T - h.y) < r) return true; }
    return false;
  }
  function toSurface() {
    NEU.dungeon.lastDeath = here;
    if (NEU.mage && NEU.mage.active && NEU.mage.close) NEU.mage.close();
    return origOpen('dgn', { spawn: { x: BED.x, y: BED.y }, zone: 'd0' });
  }

  function kd(name, d) { var k = kinds[name] || (kinds[name] = {}), q; for (q in d) k[q] = d[q]; return k; }
  kd('dsave', { touch: function (e) {
    if (e.active) return;
    e.active = true; P.heal(6); flag('dgn_saved', 1);
  }, draw: function (c, x, y, e, now) { P.ent('checkpoint', c, x, y, e, now); } });
  kd('sign', { touch: function (e, input, melee) { if (melee) { NEU.dungeon.sign = e.lines.join(' '); talk(e.lines); } } });
  kd('keeper', { touch: function (e, input, melee) {
    if (melee) talk(['* the keeper: going down? the bones do not stay dead.', '* the keeper: neither will you. you wake up at my door.']);
  } });
  kd('leave', { touch: function () { if (!P.replaying()) P.close(); } });
  kd('magegate', { touch: function (e, input, melee) {
    if (!melee) return;
    if (NEU.mage && typeof NEU.mage.open === 'function') { NEU.dungeon.mageSign = ''; if (!P.replaying()) NEU.mage.open(); }
    else { NEU.dungeon.mageSign = 'closed'; talk(['* closed']); }
  } });
  kd('bossdoor', { touch: function (e, input, melee) {
    if (!melee || e.dead || P.replaying()) return;
    if (NEU.save && NEU.save.has && NEU.save.has('boss_key')) {
      e.dead = true; NEU.dungeon.bossOpen = true; P.close();
      if (NEU.polt && NEU.polt.open) NEU.polt.open();
    } else { NEU.dungeon.bossOpen = false; NEU.dungeon.bossLine = '* a bone lock. it wants a key.'; talk([NEU.dungeon.bossLine]); }
  } });
  kd('painting', { touch: function (e, input, melee) {
    var cv;
    if (P.replaying()) return;
    if (!melee) { e.held = false; return; }
    if (e.held) return;
    e.held = true; flag('painting_found', 1);
    if (NEU.cart && typeof NEU.cart.open === 'function') NEU.cart.open();
    cv = document.getElementById('platCanvas');
    if (cv && NEU.juice && NEU.juice.shakeEl) NEU.juice.shakeEl(cv);
  } });
  /* a chain lift: the one below only goes up; the head at the door rides down once that lift is open */
  kd('lift', { touch: function (e, input, melee) {
    var to;
    if (!melee || P.replaying()) return;
    if (NEU.dungeon && NEU.dungeon._liftLock) return;
    if (e.top && !flagged('dgn_lift_' + e.n)) { talk(['* the chain is slack. it hangs from somewhere deep.']); return; }
    to = lifts[e.n + (e.top ? '' : 'top')];
    if (!to) return;
    flag('dgn_lift_' + e.n, 1);
    if (NEU.dungeon) NEU.dungeon._liftLock = true;
    P.hero().x = (to.x + 0.5) * T; P.hero().y = (to.y + 1) * T; P.hero().vx = 0; P.hero().vy = 0; P.hero().wipe = 0.25; P.snap();
  } });
  kd('pot', {});
  /* the bed tops you up and becomes the respawn (toSurface lands here anyway). */
  kd('bed', { touch: function (e, input, melee) {
    var L;
    if (P.replaying()) return;
    L = P.level0();
    if (L) L.spawn = { x: BED.x, y: BED.y };
    P.heal(6);
    if (!flagged('dgn_bed_met')) { flag('dgn_bed_met', 1); talk(['* the bed is warm. whatever waits below, you wake up here.']); }
  } });

  /* one input recording per zone, spawn to the next zone (d10: to the bone door); fixes201 replays each twice */
  var REC = {
    d0: [[4, 'dash down right'], [4, 'jump right'], [8, 'right'], [4, 'jump right'], [4, ''], [4, 'dash down right'], [4, 'right'], [16, 'left down melee'], [4, 'right']],
    d1: [[4, 'dash down right'], [4, 'right'], [4, 'jump right'], [4, 'dash down right'], [4, 'right'], [16, 'right down melee'], [4, 'left down melee'], [8, 'right down melee'], [4, 'right'], [4, 'dash right'], [4, 'right'], [4, 'jump right']],
    d2: [[4, 'dash down right'], [8, 'jump right'], [8, 'right'], [4, 'jump right'], [4, 'dash down right'], [4, 'right'], [4, 'jump right'], [4, 'right'], [8, 'jump'], [4, 'dash down left'], [8, 'right']],
    d3: [[4, 'dash left'], [4, 'right'], [4, 'jump right'], [4, 'jump left'], [8, 'jump right'], [4, 'dash up'], [4, 'right'], [8, 'left'], [4, 'grab up left'], [12, 'jump'], [4, ''], [4, 'left'], [4, 'dash down left'], [4, 'jump left'], [8, 'left'], [4, 'jump left'], [4, 'dash down left'], [4, 'right'], [4, 'jump right'], [4, 'dash down left'], [4, 'right']],
    d4: [[4, 'dash down left'], [4, 'right'], [4, 'jump right'], [4, 'left'], [4, 'dash down left'], [4, 'right'], [4, 'jump right'], [4, 'dash down left'], [8, 'jump left'], [12, 'left'], [8, 'left down melee'], [12, 'right down melee'], [4, 'left down melee'], [4, 'right down melee'], [4, 'left down melee'], [4, 'right']],
    d5: [[4, 'left'], [4, 'jump left'], [4, 'dash down left'], [4, 'right'], [16, 'left down melee'], [4, 'right down melee'], [8, 'left down melee'], [4, 'left'], [4, 'dash left'], [4, 'right']],
    d6: [[4, 'dash down left'], [4, 'jump left'], [12, 'left'], [4, 'left down melee'], [4, 'left'], [4, 'dash down left'], [4, 'right'], [4, 'jump right'], [4, 'left'], [4, 'dash left'], [16, 'right'], [4, 'left down melee'], [4, 'right']],
    d7: [[4, 'dash down right'], [4, 'right'], [4, 'jump'], [4, 'left'], [4, 'grab up right'], [4, 'jump right'], [4, 'jump left'], [4, 'dash down right'], [4, 'jump right'], [12, 'right'], [4, 'right down melee'], [4, 'jump left'], [4, 'jump right'], [4, 'right'], [4, 'dash down right'], [4, 'jump right'], [12, 'right'], [4, 'right down melee'], [4, 'dash down right'], [4, 'right']],
    d8: [[4, 'dash down right'], [4, 'jump'], [8, ''], [4, 'jump right'], [4, 'right'], [4, 'grab up right'], [8, ''], [4, 'grab up right'], [4, 'jump right'], [8, 'right'], [8, ''], [4, 'grab up right'], [4, 'jump right'], [4, 'left'], [4, 'right'], [4, 'grab up right'], [4, 'jump right'], [8, 'right'], [4, ''], [4, 'left'], [4, 'right down melee'], [4, 'jump'], [8, 'right'], [4, 'jump right'], [4, 'right'], [4, 'jump'], [4, 'jump left'], [4, 'jump right'], [4, 'right'], [4, ''], [4, 'grab up right'], [12, 'jump right'], [4, 'dash down right'], [8, 'jump right'], [12, 'right'], [8, 'right down melee'], [4, 'left down melee'], [4, 'right down melee'], [4, 'left down melee'], [4, 'right']],
    d9: [[4, 'jump right'], [4, 'right'], [4, 'dash down right'], [4, 'right'], [8, 'right down melee'], [4, 'left down melee'], [4, 'right down melee'], [4, 'left down melee'], [12, 'right down melee'], [4, 'dash right'], [4, 'right']],
    d10: [[4, 'dash down right'], [4, 'right'], [4, 'jump right'], [4, 'right'], [4, 'dash down right'], [4, 'right'], [4, 'jump right'], [4, 'dash down right'], [4, 'right'], [4, 'jump right'], [4, 'right']]
  };
  var origOpen = P.open, origReplay = P.replay;
  P.open = function (id, opts) {
    var n = dN(id);
    if (n < 0) return origOpen(id, opts);
    return origOpen('dgn', { spawn: zones[n].spawn, zone: id, goal: opts && opts.goal });
  };
  P.replay = function (id, rec) {
    var n = dN(id);
    if (n < 0) return origReplay(id, rec);
    return origReplay('dgn', rec, { spawn: zones[n].spawn, zone: id, goal: n < 10 ? 'd' + (n + 1) : 'door' });
  };

  NEU.dungeon = {
    recordings: REC, bossOpen: false, bossLine: '', mageSign: '', sign: '', lastDeath: null,
    zones: zones, lifts: lifts, zoneAt: zoneAt,
    here: function () { return P.running() && P.levelId() === 'dgn' ? here : ''; },
    spawnPx: function (id) { var n = dN(id); return n < 0 ? null : px(zones[n].spawn); },
    savePx: function () { return px(save); },
    bed: BED, bedPx: function () { return px(BED); },
    toSurface: toSurface
  };
})();
