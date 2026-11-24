/* dungeon.js — the dungeon (B3): ONE connected map under the woods, Terraria-shaped (a surface castle,
   then a winding descent of eleven 40x24 zones stitched on a 3x6 grid, brick between them). The only save
   is at the door; any death wakes you there, so d3/d6/d9 open chain lifts back up (flag dgn_lift_<n>).
   Kept contracts: NEU.plat.open('d0'..'d10'), the d5 mage gate, the d10 bone door (boss_key -> a portcullis in the wall; the Polterghast chamber is its annex, dgn-polt.js),
   the painting (cart + painting_found), flag dgn_depth, NEU.dungeon.{here,spawnPx,bossOpen,bossLine,mageSign,toSurface}. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var P = NEU.plat;
  if (!P || !P._kinds) return;
  var kinds = P._kinds, T = 16, W0 = 128, W = 216, H = 148, ZW = 40, ZH = 24, SURF = 15, INK = '#12081E';   /* W0: the stitched dungeon; W adds the Polterghast annex east of d10 */
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
  /* D1 beat table: the pacing curve the ZONES below are built to (intensity 0..1): d0 arrival 0.0 · d1 teach skull 0.2 · d2 teach fighter + cracked floor 0.3 · d3 lift, rest 0.1 · d4 teach caster 0.4 · d5 mage gate, rest 0.1 · d6 fighter + spike ball 0.6 · d7 ranged with cover 0.7 · d8 wheel + caster 0.8 · d9 lift, gauntlet 0.9 · d10 bone door, rest 0.1. */
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
      '########....$$$...................######',
      '########....=====.........u...u...######',
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
      '#...............$$$................#####',
      '#..............=====...............#####',
      '#..........................a.......#####',
      '...................................#####',
      '...................................#####',
      '..S......w..........p.....a.w......#####',
      '#####kkkkkk#######kkkkkk######....######',
      '#####^^^^^^#######^^^^^^######....######',
      '##############################....######'],
    d3: ['##############################....######',
      '######################................##',
      '######################............c...##',
      '######################............c...##',
      '######################............L...##',
      '######################................##',
      '......................................##',
      '..........w...........................##',
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
      '##..........$$$...................######',
      '##......G...=========.............######',
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
      '..n...w............p....w......M....####',
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
      '##......h..........................####',
      '##..................O...................',
      '##......................................',
      '##.....G..........$$$.........t.....S.l.',
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
      '##...........#...........#......$$.y$###',
      '##..............................==k==###',
      '##...................................###',
      '##...................................###',
      '##......................................',
      '##........#......#......#...............',
      '##.S..p...#..w...#..T...#...#......y....',
      '########################################',
      '########################################',
      '########################################'],
    d8: ['########################################',
      '########################################',
      '########################################',
      '########################################',
      '########################################',
      '########################################',
      '##..c...........b.........Yc......######',
      '##..c.....................=c......######',
      '##..L......................L......######',
      '##................................######',
      '##................................######',
      '##.........$$$.......t............######',
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
      '##...................Q................##',
      '##.........U...............E..........##',
      '##............................W.......##',
      '##....=======............=======......##',
      '##....................................##',
      '##...............$$$O.................##',
      '##..............=======...............##',
      '##....................................##',
      '##....................................##',
      '##....................................##',
      '##....................................##',
      '##....................................##',
      '##......................................',
      '##......................................',
      '##..w....C.....Q.......p.....l..w.......',   /* DGN-04: this row was one tile short, which slid d10's row 140 a tile west of its entities; the annex needs the row square */
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
      '#...................................####',
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
  /* DGN-04: the Polterghast chamber is an annex of d10 behind the bone door, not a level of its own. 96x56 tiles at (x,y): its floor row is d10's floor row 141,
     its mouth is the corridor behind the door. spawn is the retry anchor (chamber-local tile). inner is the world tile column that seals the gate once the hero is past it.
     shelves [x, y, len], movers [cx, cy, halfX, halfY, speed, phase], crystals [x, y] are chamber-local plat tiles; dgn-polt.js binds the fight to this rectangle. */
  var CH = { x: 120, y: 87, w: 96, h: 56, spawn: { x: 5, y: 53 }, inner: 123, door: { x: 114, y: 138, w: 2, h: 3 },
    shelves: [[10, 47, 9], [77, 47, 9], [34, 40, 28], [10, 33, 9], [77, 33, 9], [28, 26, 12], [56, 26, 12], [40, 19, 16], [10, 19, 9], [77, 19, 9], [38, 12, 20]],
    movers: [[22, 43, 14, 0, 0.9, 0], [70, 43, -14, 0, 0.9, 0], [46, 31, 0, 6, 0.7, 0], [24, 23, 10, 0, 1.1, 1.5], [70, 23, -10, 0, 1.1, 1.5]],
    crystals: [[14, 44], [81, 44], [30, 36], [65, 36], [47, 22], [20, 16], [75, 16], [47, 8], [47, 46]] };
  function inCh(tx, ty) { return tx >= CH.x && tx < CH.x + CH.w && ty >= CH.y && ty < CH.y + CH.h; }
  /* the chamber's cel entities, native cel px (one plat tile is 8): a mover swings between two ends at its old sine's mean speed */
  function chamberCel() {
    var out = [], m, v, i;
    for (m = 0; m < CH.movers.length; m++) {
      v = CH.movers[m];
      out.push({ t: 'movingPlatform', x: (CH.x + v[0] - Math.abs(v[2])) * 8, y: (CH.y + v[1] - Math.abs(v[3])) * 8, nx: (CH.x + v[0] + Math.abs(v[2])) * 8, ny: (CH.y + v[1] + Math.abs(v[3])) * 8,
        w: 24, h: 8, spd: Math.round(16 * Math.max(Math.abs(v[2]), Math.abs(v[3])) * v[4] / Math.PI), at0: (1 + Math.sin(v[5])) / 2 * 0.98 + 0.01 });
    }
    for (i = 0; i < CH.crystals.length; i++) out.push({ t: 'refill', x: (CH.x + CH.crystals[i][0]) * 8 + 4, y: (CH.y + CH.crystals[i][1]) * 8 + 4 });
    return out;
  }
  var zones = [], spawners = [], decor = [], ents = [], cracks = {}, save = null, lifts = {}, here = '', goal = '', live = null;
  /* WO-DGN world additions, all attached to the one map (no new level, no new authority).
     braziers are numbered globally; flags dgn_lit_<n> are saved through NEU.save.
     water is decorative: the lever only drains it, never changes Celeste physics. */
  var braN = 0, water = [], rest = {}, secrets = [], dress = [];
  function openFloor(rows, want, skip) {
    var out = [], y, x, ch, row;
    for (y = 1; y < rows.length - 1; y++) {
      row = rows[y];
      for (x = 2; x < row.length - 2; x++) {
        ch = row.charAt(x);
        if (ch !== '.') continue;
        if (row.charAt(x - 1) !== '#' && row.charAt(x + 1) !== '#' &&
            !(rows[y - 1] && rows[y - 1].charAt(x) === '#') && !(rows[y + 1] && rows[y + 1].charAt(x) === '#')) continue;
        if (skip && skip(x, y)) continue;
        out.push({ x: x, y: y });
      }
    }
    var pick = [], i, at;
    if (out.length <= want) return out;
    for (i = 0; i < want; i++) { at = Math.floor((i + 0.5) * out.length / want); pick.push(out[at]); }
    return pick;
  }
  /* WO-NEW-DGN's eight named chambers are set pieces INSIDE the one connected
     map, not new levels: the blue/green/pink wings and their two-way corridors
     already are the branches, and the zone spawns are the named landings. Each
     chamber has a centrepiece with a reveal and six inspectable plaques (R1). */
  var CHAMBERS = [
    { id: 'bell', z: 0, ax: 26, ay: 8, flag: 'dgn_bell', kind: 'bell', centre: '* a bronze bell on a chain.',
      reveal: '* the bell rings. every blue brazier catches.',
      lines: ['* frayed rope, knotted by many hands.', '* the mould still smells of hot metal.', '* a notice: LOST — one small courage.', '* the clapper is cracked but true.', '* birds nested in the rafters.', '* a stair runs down into the dark.'] },
    { id: 'library', z: 4, ax: 12, ay: 11, flag: 'dgn_book', kind: 'book', centre: '* a bookcase one inch out of line.',
      reveal: '* the shelf slides. a hollow waits behind it.',
      lines: ['* "Why the skeleton went to the library: it had no body."', '* a shelf of jokes, all in the same hand.', '* an index with nothing in it.', '* a bookmark a hundred years old.', '* the lamp smells of dust and ink.', '* someone wrote: READ THE UPSIDE-DOWN ONE.'] },
    { id: 'flood', z: 6, ax: 20, ay: 16, flag: 'dgn_drain', kind: 'lever', centre: '* a lever grown stiff with mineral.',
      reveal: '* the water withdraws. something glints on the bricks.',
      lines: ['* the flood line is scored into the wall.', '* a drowned sign: KEEP TO THE STAIRS.', '* reeds grew indoors.', '* bubbles, then silence.', '* a stone where a handle used to be.', '* the tide never comes in anymore.'] },
    { id: 'ossuary', z: 7, ax: 14, ay: 12, flag: 'dgn_mimic', kind: 'bone', centre: '* a chest breathing in the bone pile.',
      reveal: '* the lid exhales. you step back; it settles.',
      lines: ['* skulls stacked by size, not by name.', '* a ribcage used as a coat rack.', '* someone counted these twice.', '* a tiny coffin, neatly made.', '* dust that has never been disturbed.', '* the pile is warmer than the room.'] },
    { id: 'chainbridge', z: 3, ax: 28, ay: 4, flag: 'dgn_bridge', kind: 'chain', centre: '* the lamps swing before you touch them.',
      reveal: '* the chains find a rhythm. cross on the beat.',
      lines: ['* a chain disappears into the ceiling.', '* lamp oil, still warm.', '* a foothold worn smooth.', '* the gap is wider than it looks.', '* chains answer the smallest push.', '* below: spikes, patient and bright.'] },
    { id: 'forge', z: 5, ax: 20, ay: 10, flag: 'dgn_forge', kind: 'anvil', centre: '* an anvil with a worn right edge.',
      reveal: '* the old axe remembers this weight.',
      lines: ['* the bellows sigh on their own.', '* a quench trough, dry and cracked.', '* tongs, bent around something larger.', '* soot handprints on the wall.', '* a horseshoe for luck, long gone cold.', '* the fire has been out for years.'] },
    { id: 'cell', z: 2, ax: 20, ay: 15, flag: 'dgn_cell', kind: 'chain', centre: '* a chained merchant, teeth intact.',
      reveal: '* "You again. I saved you something."',
      lines: ['* "First time? Take the small one."', '* "Back again? Then you know the drill."', '* the chain is longer than the cell.', '* a cup, a straw, a stack of IOUs.', '* a tally scratched in the wall.', '* the lock has no keyhole.'] },
    { id: 'vault', z: 10, ax: 18, ay: 13, flag: 'dgn_vault', kind: 'brick', centre: '* a brick that sounds hollow.',
      reveal: '* the wall gives. the vault was never locked.',
      lines: ['* a keyhole with no key.', '* gold dust in the joints.', '* a ledger of things never spent.', '* the seal was broken from inside.', '* a dusty chair facing the door.', '* nothing here was taken.'] }
  ];
  function nearFloor(rows, ax, ay, want) {
    var out = [], y, x, d, row;
    for (y = Math.max(1, ay - 9); y < Math.min(rows.length - 1, ay + 9); y++) {
      row = rows[y] || '';
      for (x = Math.max(2, ax - 9); x < Math.min(row.length - 2, ax + 9); x++) {
        if (row.charAt(x) !== '.') continue;
        if (row.charAt(x - 1) !== '#' && row.charAt(x + 1) !== '#' &&
            !(rows[y - 1] && rows[y - 1].charAt(x) === '#') && !(rows[y + 1] && rows[y + 1].charAt(x) === '#')) continue;
        d = Math.abs(x - ax) + Math.abs(y - ay);
        out.push({ x: x, y: y, d: d });
      }
    }
    out.sort(function (a, b) { return a.d - b.d || a.y - b.y || a.x - b.x; });
    return out.slice(0, want);
  }
  /* W10: the surface hut; BED is the respawn cell every death lands on. */
  var BED = { x: 22, y: 14 }, HUT = { x0: 16, x1: 32, roof: 9, wall0: 10, wall1: 14 };

  function zoneAt(px, py) {
    var tx = Math.floor(px / T), ty = Math.floor(py / T), i, z;
    for (i = 0; i < zones.length; i++) { z = zones[i]; if (tx >= z.x && tx < z.x + ZW && ty >= z.y && ty < z.y + ZH) return z; }
    return inCh(tx, ty) ? zones[10] : null;   /* the annex is d10 */
  }
  function faction(tx, ty) {
    if (inCh(tx, ty)) return GRID[5].charAt(2);
    var c = Math.max(0, Math.min(2, Math.floor((tx - 4) / ZW))), r = Math.max(0, Math.min(5, Math.floor(ty / ZH)));
    return GRID[r].charAt(c);
  }
  function build() {
    var g = [], x, y, i, n, z, rows, ch, wx, wy, row, id, cacheSeen = {}, cfac;
    for (y = 0; y < H; y++) { row = []; for (x = 0; x < W; x++) row.push(y < SURF ? ' ' : y < ZH ? 'g' : '#'); g.push(row); }
    for (n = 0; n < CELL.length; n++) {
      id = 'd' + n; rows = ZONES[id];
      z = { id: id, n: n, x: 4 + CELL[n][0] * ZW, y: CELL[n][1] * ZH, spawn: null };
      z.wall = faction(z.x, z.y); zones.push(z);
      for (y = 0; y < ZH; y++) for (x = 0; x < ZW; x++) {
        ch = rows[y].charAt(x); wx = z.x + x; wy = z.y + y;
        g[wy][wx] = (ch === ' ' || ch === '#' || ch === 'g' || ch === '=' || '^v<>'.indexOf(ch) >= 0) ? ch : rows[y].charAt(x - 1) === ' ' || rows[y].charAt(x + 1) === ' ' ? ' ' : '.';
        if (ch === 'S') z.spawn = { x: wx, y: wy };
        else if (ch === 'k') {
          /* D6: one hidden five-coin cache per wall faction (B/G/P). */
          cfac = faction(wx, wy);
          var ke = { t: 'crumble', x: wx, y: wy };
          if (!cacheSeen[cfac]) { ke.cache = 5; cacheSeen[cfac] = 1; }
          ents.push(ke); cracks[wy + ',' + wx] = 'k';
        }
        else if (DECOR.indexOf(ch) >= 0) decor.push({ k: ch, x: wx, y: wy, f: z.wall });
        else if (FOE.indexOf(ch) >= 0) spawners.push({ k: ch, x: wx, y: wy, zone: id, rest: n % 3 === 2 });
        else if (ch === 'P') { save = { x: wx, y: wy }; ents.push({ t: 'dsave', x: wx, y: wy }); }
        else if (ch === 'n') ents.push({ t: 'sign', x: wx, y: wy, lines: SIGN[id], textlessCue: id === 'd5' ? ['graze', 'key:c'] : null });
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
    /* ── WO-DGN world dressing, generated from the real zone rows ─────────
       Nothing here alters a tile the input recordings walk on: every new prop
       is non-solid except the gimmick platforms, which sit in open upper air. */
    for (n = 0; n < zones.length; n++) {
      z = zones[n]; rows = ZONES[z.id];
      /* 4-8 braziers per wing: blue d0-d5, green d6-d7, pink d8-d10. */
      var want = z.wall === 'G' ? 3 : z.wall === 'P' ? 2 : 1;
      var spots = openFloor(rows, want);
      for (i = 0; i < spots.length; i++) {
        ents.push({ t: 'brazier', x: z.x + spots[i].x, y: z.y + spots[i].y, n: ++braN, f: z.wall });
      }
      /* every third room is a rest room: a bench and a sign, no foe (restCalm). */
      if (n % 3 === 2) {
        rest[z.id] = true;
        spots = openFloor(rows, 1, function (fx, fy) { return fy > ZH - 4; });
        if (spots.length) {
          ents.push({ t: 'bench', x: z.x + spots[0].x, y: z.y + spots[0].y });
        }
      }
    }
    /* BLUE: swinging chain lamps as moving platforms, high in d3's open shaft. */
    var blue = zones[3];
    ents.push({ t: 'chainplat', x: blue.x + 22, y: blue.y + 3, ax: blue.x + 22, ay: blue.y + 3, sw: 2, spd: 1.2, drop: 0.2, solid: true, phase: 0 });
    ents.push({ t: 'chainplat', x: blue.x + 28, y: blue.y + 4, ax: blue.x + 28, ay: blue.y + 4, sw: 2.5, spd: 1.4, drop: 0.25, solid: true, phase: 1.6 });
    ents.push({ t: 'chainplat', x: blue.x + 34, y: blue.y + 3, ax: blue.x + 34, ay: blue.y + 3, sw: 2, spd: 1.1, drop: 0.15, solid: true, phase: 3.1 });
    /* GREEN: a flooded hall and a drain lever. The water is drawn, never collided with. */
    var green = zones[6];
    water.push({ x: green.x + 4, y: green.y + 12, w: 32, h: 8 });
    ents.push({ t: 'dgnlever', x: green.x + 5, y: green.y + 20 });
    ents.push({ t: 'dgnheart', x: green.x + 33, y: green.y + 16, n: 1, req: 'dgn_drain' });
    /* PINK: telegraphed crumbling floors above d8's lower hall. */
    var pink = zones[8];
    ents.push({ t: 'dgncrumb', x: pink.x + 6, y: pink.y + 7, solid: true });
    ents.push({ t: 'dgncrumb', x: pink.x + 12, y: pink.y + 8, solid: true });
    ents.push({ t: 'dgncrumb', x: pink.x + 18, y: pink.y + 7, solid: true });
    /* Three hidden max-hearts, each behind a noticed secret. */
    var lib = zones[4], vault = zones[10];
    ents.push({ t: 'dgnsecret', x: lib.x + 22, y: lib.y + 20, flag: 'dgn_book', lines: ['* one book is upside down. behind it, a hollow.'] });
    ents.push({ t: 'dgnheart', x: lib.x + 24, y: lib.y + 20, n: 2, req: 'dgn_book' });
    ents.push({ t: 'dgnsecret', x: vault.x + 15, y: vault.y + 20, flag: 'dgn_vault', lines: ['* this brick sounds hollow when you knock.'] });
    ents.push({ t: 'dgnheart', x: vault.x + 17, y: vault.y + 20, n: 3, req: 'dgn_vault' });
    /* the eight named chambers: a centrepiece with a reveal + six inspectables */
    for (n = 0; n < CHAMBERS.length; n++) {
      var c = CHAMBERS[n], cz = zones[c.z], cs = nearFloor(ZONES[cz.id], c.ax, c.ay, 7);
      if (!cs.length) continue;
      ents.push({ t: 'dgnsecret', x: cz.x + cs[0].x, y: cz.y + cs[0].y, flag: c.flag,
        kind: c.kind, chamber: c.id, lines: [c.centre, c.reveal] });
      for (i = 1; i < cs.length; i++)
        ents.push({ t: 'dgnplaque', x: cz.x + cs[i].x, y: cz.y + cs[i].y, chamber: c.id, lines: [c.lines[(i - 1) % c.lines.length]] });
    }
    /* DGN-02 baked set dressing (look-dungeon.js paints it into the chunks; pure presentation, no collision, flag or spawn).
       bellfrm: cold stone niche around the d0 bell. pool: warm light at the shaft mouth. tide: mineral flood line that stays after the drain.
       arch: broken ribbed pier either side of the bone door (x = pier tile, d = side the rib springs toward). course: vault masonry, bottom row first. */
    dress.push({ k: 'bellfrm', x: 70, y: 4 }, { k: 'pool', x: 64, y: 14 },
      { k: 'tide', x: green.x + 4, y: green.y + 12, w: 32, lx: green.x + 5, ly: green.y + 20 },
      { k: 'arch', x: vault.x + 28, y: vault.y + 20, h: 6, d: 1, b: 1.25, r: 38 }, { k: 'arch', x: vault.x + 22, y: vault.y + 20, h: 6, d: 1, b: 1.25, r: 38 },
      { k: 'arch', x: CH.door.x + 3, y: CH.door.y + 2, h: 3, d: -1, b: 1.1, r: 12 },
      { k: 'course', x: vault.x + 1, y: vault.y + 20, w: 35, a: [0.85, 0.6, 0.38] },
      { k: 'jamb', x: CH.door.x, y: CH.door.y, w: CH.door.w, h: CH.door.h },
      { k: 'course', x: CH.x, y: 140, w: 2, a: [0.85, 0.6, 0.38, 0.18], any: 1 }, { k: 'course', x: CH.x + 2, y: CH.y + CH.h - 3, w: CH.w - 4, a: [0.85, 0.6, 0.38, 0.18], any: 1 });
    /* DGN-04: the chamber and the way in. The door wall (brick above a 2x3 gap) stands where the bone door always stood; behind it a four-tile corridor runs
       through d10's old east wall to the chamber mouth (floor row 141 is shared). The gap's collision is six 'bossbar' tiles, see the bone door below. */
    for (y = 2; y < CH.h - 2; y++) for (x = 2; x < CH.w - 2; x++) g[CH.y + y][CH.x + x] = ' ';
    for (n = 0; n < CH.shelves.length; n++) for (x = 0; x < CH.shelves[n][2]; x++) g[CH.y + CH.shelves[n][1]][CH.x + CH.shelves[n][0] + x] = '=';
    for (y = 131; y <= 137; y++) for (x = CH.door.x; x < CH.door.x + CH.door.w; x++) g[y][x] = '#';
    for (y = 131; y <= 136; y++) for (x = CH.door.x + CH.door.w; x < CH.x; x++) g[y][x] = '#';
    for (y = 137; y <= 140; y++) for (x = CH.x; x < CH.x + 2; x++) g[y][x] = '.';
    decor = decor.filter(function (d) { return !(d.x >= CH.door.x && d.x < CH.x && d.y >= 131 && d.y <= 137); });   /* the old pocket's chains and lantern are brick now */
    decor.push({ k: 'L', x: CH.x - 3, y: 137, f: 'P' });
    for (y = 0; y < CH.door.h; y++) for (x = 0; x < CH.door.w; x++) ents.push({ t: 'bossbar', x: CH.door.x + x, y: CH.door.y + y, solid: true });
    ents.push({ t: 'rematch', x: CH.x + 9, y: 140 });
    /* W10 surface hut: packed-earth hut on the open grass, west of the castle. */
    for (x = HUT.x0 - 1; x <= HUT.x1 + 1; x++) g[HUT.roof][x] = 'g';
    for (y = HUT.wall0; y <= HUT.wall1; y++) {
      g[y][HUT.x0] = 'g'; g[y][HUT.x1] = 'g';
      for (x = HUT.x0 + 1; x < HUT.x1; x++) g[y][x] = ' ';
    }
    g[HUT.wall1 - 1][HUT.x0] = ' '; g[HUT.wall1][HUT.x0] = ' ';   /* the west door */
    /* a high east window: dash up and out to the lift heads; rows 12-14 stay solid so
       the hut wall and the tutorial-door walk still behave as tested (fixes216/fixes561). */
    g[HUT.wall0][HUT.x1] = ' '; g[HUT.wall0 + 1][HUT.x1] = ' ';
    ents.push({ t: 'bed', x: 18, y: HUT.wall1 });
    ents.push({ t: 'tdoor', x: 31, y: HUT.wall1 });   /* W20: the door to the tutorial room t0 */
    decor.push({ k: 'L', x: 26, y: HUT.wall0, f: 'B' });
    /* d0 holds the three lift heads, in order, for the lifts of d3, d6 and d9 */
    n = 0;
    for (i = 0; i < ents.length; i++) if (ents[i].t === 'lift') {
      if (ents[i].n === 0) { ents[i].n = [3, 6, 9][n++]; ents[i].top = true; }
      lifts[ents[i].n + (ents[i].top ? 'top' : '')] = ents[i];
    }
    ents.push({ t: 'leave', x: 1, y: SURF - 1 }, { t: 'leave', x: W0 - 2, y: SURF - 1 });
    return g.map(function (r) { return r.join(''); });
  }
  function px(cell) { return cell ? { x: (cell.x + 0.5) * T, y: (cell.y + 1) * T } : null; }
  function dN(id) { var m = /^d(\d+)$/.exec(id || ''); return m && +m[1] <= 10 ? +m[1] : -1; }
  function talk(lines, cue) { if (NEU.talk && !P.replaying()) NEU.talk(lines, 'narr', cue); }
  function flag(k, v) { if (NEU.save && NEU.save.flag && !P.replaying()) NEU.save.flag(k, v); }
  function flagged(k) { return !!(NEU.save && NEU.save.flagged && NEU.save.flagged(k)); }
  function heartCap() { return 6 + (flagged('dgn_heart_1') ? 1 : 0) + (flagged('dgn_heart_2') ? 1 : 0) + (flagged('dgn_heart_3') ? 1 : 0); }

  var def = P.level('dgn', {
    rows: build(), spawn: zones[0].spawn, entities: ents, tileset: 'dungeon', view: 'terraria', chunked: true, hp: 6, solid: '#g',
    onOpen: function (opts) {
      live = P.level0(); here = ''; goal = opts.goal || '';
      /* saved max-hearts raise only the LIVE cap; the template stays at 6 so
         older suites and fresh saves keep the original contract. The cap goes first and the hero's hearts follow it: plat set them from the template's 6. */
      live.hp = heartCap();
      P.hero().hp = live.hp;
      track();
      rematchOn(flagged('polt_dead'));
      if (flagged('polt_dead') && !P.replaying()) gateTo(true, true);   /* a cleared chamber stands open and quiet */
    },
    /* a fight death retries at the chamber mouth (dgn-polt.js answers false here and plat respawns); everywhere else it is the surface bed */
    onDeath: function () { if (NEU.dgnPolt && NEU.dgnPolt.on && NEU.dgnPolt.on()) return false; toSurface(); },
    onRespawn: function () { if (NEU.dgnPolt && NEU.dgnPolt.retry) NEU.dgnPolt.retry(); },
    celEnts: chamberCel(), chamber: CH,
    /* the chamber stays black while its gate is shut and no fight runs: the way in is a keyed door, and nothing past it is shown early */
    chamberHidden: function () { return gateState() === 'closed' && !(NEU.dgnPolt && NEU.dgnPolt.on && NEU.dgnPolt.on()); },
    /* the camera stops at the stitched dungeon's east edge except down in the lower vaults, where it follows the hero into the annex */
    camW: function (h) { return h.y < 85 * T ? W0 : W; },
    tick: function () { track(); restCalm(); }
  });
  def.zones = zones; def.decor = decor; def.cracks = cracks; def.spawners = spawners; def.faction = faction; def.zoneAt = zoneAt;
  def.water = water; def.rest = rest; def.dress = dress;
  def.cel = true;   /* the dungeon moves on the cel kernel (the cel.html movement); refills, springs, crumbles and the swinging plates are cel entities */
  /* backward-compat aliases so legacy tests/suites that reference d0..d10 levels resolve to the one map */
  for (var _ai = 0; _ai <= 10; _ai++) P.levels['d' + _ai] = def;

  /* MAP REVEAL: four-tile map cells light up around the hero as they pass. */
  function reveal(h) {
    var tx = Math.floor(h.x / T / 4), ty = Math.floor((h.y - 11) / T / 4), dx, dy;
    for (dy = -1; dy <= 1; dy++) for (dx = -1; dx <= 1; dx++)
      NEU.dungeon.mapSeen[(tx + dx) + ',' + (ty + dy)] = 1;
  }
  /* Rest rooms stay foe-free without editing dgn-foes.js or the spawner table:
     only auto-spawned foes tied to a rest spawner are removed, and those
     spawners never refill. Manually spawned foes (fixtures) are untouched. */
  function restCalm() {
    var F = NEU.dgnFoes, i, fs;
    if (!F) return;
    for (i = 0; i < spawners.length; i++) if (spawners[i].rest) spawners[i].cd = 1e9;
    fs = F.foes;
    for (i = fs.length - 1; i >= 0; i--) if (fs[i].sp && fs[i].sp.rest) fs.splice(i, 1);
  }
  /* the zone under the hero: entering one keeps the deepest depth reached, and d3/d6/d9 open their lift */
  function track() {
    var h = P.hero(), z = zoneAt(h.x, h.y - 11), id, depth;
    reveal(h);
    if (NEU.dungeon && NEU.dungeon._liftFrames > 0) NEU.dungeon._liftFrames--;
    /* the open surface band is d0's: castle and hut both live there */
    if (!z && h.y - 11 < ZH * T) z = zones[0];
    id = z ? z.id : here;
    if (id !== here) {
      here = id;
      if (z) {
        depth = NEU.save && NEU.save.flag ? NEU.save.flag('dgn_depth') : undefined;
        if (depth === undefined || depth === null || z.n > depth) flag('dgn_depth', z.n);
        if (z.n === 3 || z.n === 6 || z.n === 9) {
          flag('dgn_lift_' + z.n, 1);
          if (!flagged('dgn_lift_woke_' + z.n)) { flag('dgn_lift_woke_' + z.n, 1); talk(['* a chain lift wakes.']); }
        }
        if (z.n === 10) {
          NEU.dungeon.bossOpen = gateState() === 'open'; NEU.dungeon.bossLine = '';
          /* BUG-0032b: the descent pays once at the bottom, through the one coin authority. */
          if (!P.replaying() && NEU.save && NEU.save.addCoins && NEU.save.flagged && !NEU.save.flagged('dgn_descent_paid')) {
            NEU.save.addCoins(25);
            flag('dgn_descent_paid', 1);
          }
        }
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
  /* o.won: the victory walk home. Only a death records where it happened. */
  function toSurface(o) {
    if (!(o && o.won)) NEU.dungeon.lastDeath = here;
    if (NEU.mage && NEU.mage.active && NEU.mage.close) NEU.mage.close();
    return origOpen('dgn', { spawn: { x: BED.x, y: BED.y }, zone: 'd0', wipe: 0.25 });   /* the wipe-in the death wipe-out hands over to */
  }

  function kd(name, d) { var k = kinds[name] || (kinds[name] = {}), q; for (q in d) k[q] = d[q]; return k; }
  /* D6: a cracked wall hides a five-coin cache, paid once and kept across reloads. */
  var prevCrumbleTick = kinds.crumble && kinds.crumble.tick;
  if (prevCrumbleTick) kd('crumble', { tick: function (e, dt) {
    prevCrumbleTick(e, dt);
    if (e.dead && e.cache && !flagged('dgn_cache_' + e.x + ',' + e.y)) {
      flag('dgn_cache_' + e.x + ',' + e.y, 1);
      if (NEU.save && NEU.save.addCoins && !P.replaying()) NEU.save.addCoins(e.cache);
    }
  } });
  kd('dsave', { touch: function (e) {
    if (e.active) return;
    e.active = true; P.heal(6); flag('dgn_saved', 1);
  }, draw: function (c, x, y, e, now) { P.ent('checkpoint', c, x, y, e, now); } });
  kd('sign', { touch: function (e, input, melee) { if (melee) { NEU.dungeon.sign = e.lines.join(' '); talk(e.lines, e.textlessCue); } } });
  /* TORCH MEMORY: walking past a brazier lights it permanently (WO-DGN). */
  kd('brazier', { touch: function (e) {
    if (flagged('dgn_lit_' + e.n)) return;
    flag('dgn_lit_' + e.n, 1);
  } });
  kd('bench', { touch: function (e, input, melee) {
    if (melee && !flagged('dgn_bench')) { flag('dgn_bench', 1); talk(['* the bench holds the warmth of everyone who sat here.']); }
  } });
  kd('dgnlever', { touch: function (e, input, melee) {
    if (!melee || flagged('dgn_drain')) return;
    flag('dgn_drain', 1);
    talk(['* the lever groans. water slips away through the bricks.', '* something glints where the flood used to be.']);
  } });
  kd('dgnsecret', { touch: function (e, input, melee) {
    if (!melee || flagged(e.flag)) return;
    flag(e.flag, 1);
    /* the bell's reveal lights the blue wing's braziers (R12/R15) */
    if (e.flag === 'dgn_bell') for (var i = 0; i < ents.length; i++)
      if (ents[i].t === 'brazier' && ents[i].f === 'B') flag('dgn_lit_' + ents[i].n, 1);
    talk(e.lines || ['* something was hidden here.']);
  } });
  kd('dgnplaque', { touch: function (e, input, melee) {
    if (melee) { NEU.dungeon.sign = e.lines.join(' '); talk(e.lines); }
  } });
  kd('dgnheart', { touch: function (e) {
    if (P.replaying() || e.dead || !flagged(e.req)) return;
    e.dead = true;
    flag('dgn_heart_' + e.n, 1);
    if (live) live.hp = heartCap();
    P.heal(1);
    talk(['* a life crystal. the heart can hold a little more.']);
  } });
  kd('keeper', { touch: function (e, input, melee) {
    if (melee) talk(['* the keeper: going down? the bones do not stay dead.', '* the keeper: neither will you. you wake up at my door.']);
  } });
  kd('leave', { touch: function () { if (!P.replaying()) P.close(); } });
  kd('magegate', { touch: function (e, input, melee) {
    if (!melee) return;
    if (NEU.mage && typeof NEU.mage.open === 'function') { NEU.dungeon.mageSign = ''; if (!P.replaying()) NEU.mage.open(); }
    else { NEU.dungeon.mageSign = 'closed'; talk(['* closed']); }
  } });
  /* ── the bone door (DGN-04): a portcullis in a brick wall ──
     Six solid 'bossbar' tiles are its collision. They clear from the floor up as the panel rises in three ratchet steps, so the gap you see is the gap you can
     walk through; reduced motion shows it open at once. The encounter seals it again once the hero is past the inner threshold. */
  var GATE_H = 48, GATE_STEP = 16, GATE_T0 = 10, GATE_STEP_FR = 16, GATE_MOVE = 6, GATE_DROP = 12;
  function gateEnt() {
    var L = P.level0(), i;
    if (!L || L.id !== 'dgn' || !L.entities) return null;
    if (L._gate) return L._gate;
    for (i = 0; i < L.entities.length; i++) if (L.entities[i].t === 'bossdoor') return (L._gate = L.entities[i]);
    return null;
  }
  function gateState() { var e = gateEnt(); return e ? e.gate || 'closed' : 'closed'; }
  function barsDead(on) {   /* the collision tiles: on = every one cleared, else every one solid */
    var i, es = P.level0().entities;
    for (i = 0; i < es.length; i++) if (es[i].t === 'bossbar') es[i].dead = on;
  }
  function gateRise(e, rise) {   /* rise px of panel travel: a bar tile clears once the panel's foot is above it */
    var i, es = P.level0().entities;
    e.rise = rise;
    for (i = 0; i < es.length; i++) if (es[i].t === 'bossbar') es[i].dead = GATE_H - rise <= (es[i].y - CH.door.y) * T;
  }
  function gateTo(open, instant) {
    var e = gateEnt();
    if (!e) return;
    e.fr = 0;
    if (instant || P.reduced()) { e.gate = open ? 'open' : 'closed'; gateRise(e, open ? GATE_H : 0); }
    else { e.gate = open ? 'opening' : 'closing'; if (!open) barsDead(false); }
    NEU.dungeon.bossOpen = !!open;
  }
  function gateTick(e) {
    var t, k, u, rise;
    if (e.gate === 'opening') {
      e.fr++; t = e.fr - GATE_T0; k = Math.max(0, Math.floor(t / GATE_STEP_FR));
      u = Math.max(0, Math.min(1, (t - k * GATE_STEP_FR) / GATE_MOVE)); u = 1 - (1 - u) * (1 - u);
      rise = Math.min(GATE_H, (k + u) * GATE_STEP);
      gateRise(e, rise);
      if (rise >= GATE_H) e.gate = 'open';
    } else if (e.gate === 'closing') {
      e.fr++; u = Math.min(1, e.fr / GATE_DROP);
      e.rise = GATE_H * (1 - u * u);
      if (u >= 1) { e.rise = 0; e.gate = 'closed'; }
    }
  }
  function rematchOn(on) { var i, es = P.level0() && P.level0().entities; if (es) for (i = 0; i < es.length; i++) if (es[i].t === 'rematch') es[i].dead = !on; }
  kd('bossdoor', { touch: function (e, input, melee) {
    if (!melee || P.replaying() || (e.gate && e.gate !== 'closed')) return;
    if (NEU.dgnPolt && NEU.dgnPolt.engage && NEU.save && NEU.save.has && NEU.save.has('boss_key')) { gateTo(true); return; }
    NEU.dungeon.bossOpen = false; NEU.dungeon.bossLine = '* a bone lock. it wants a key.'; talk([NEU.dungeon.bossLine]);
  }, tick: gateTick });
  kd('bossbar', {});
  kd('rematch', { touch: function (e, input, melee) {
    if (!melee || e.dead || P.replaying()) return;
    e.dead = true;
    if (NEU.dgnPolt && NEU.dgnPolt.rematch) NEU.dgnPolt.rematch();
  } });
  kd('painting', { touch: function (e, input, melee) {
    var cv;
    if (P.replaying()) return;
    if (!melee) { e.held = false; return; }
    if (e.held) return;
    e.held = true;
    /* the painting waits for the thing at the bottom of the dungeon; an older save already past it keeps its cart */
    if (!flagged('polt_dead') && !flagged('painting_found')) { talk(['* a painting of somewhere you have not been yet.']); return; }
    flag('painting_found', 1);
    if (NEU.cart && typeof NEU.cart.open === 'function') NEU.cart.open();
    cv = document.getElementById('platCanvas');
    if (cv && NEU.juice && NEU.juice.shakeEl) NEU.juice.shakeEl(cv);
  } });
  /* a chain lift: the one below only goes up; the head at the door rides down once that lift is open.
     The ride is replay-safe: a recorded bed->d9 input chain must be able to take the lifts. */
  kd('lift', { touch: function (e, input, melee) {
    var to;
    if (!melee) return;
    if (NEU.dungeon && NEU.dungeon._liftFrames > 0) return;
    if (e.top && !flagged('dgn_lift_' + e.n)) { talk(['* the chain is slack. it hangs from somewhere deep.']); return; }
    to = lifts[e.n + (e.top ? '' : 'top')];
    if (!to) return;
    if (!flagged('dgn_lift_' + e.n)) talk(['* a chain lift wakes.']);
    flag('dgn_lift_' + e.n, 1);
    if (NEU.dungeon) NEU.dungeon._liftFrames = 2;
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

  /* one input recording per zone, spawn to the next zone (d10: to the bone door); fixes201 replays each twice.
     Found by a beam search over the cel kernel (tests/_dgn-route.mjs) and proved by P.replay on the live level: the dungeon moves on cel.js. */
  var REC = {
    d0: [[4, 'dash d'], [4, 'dash s d'], [12, 'space d'], [4, 'd'], [4, 'space d'], [12, 'd'], [4, 'a'], [4, 'dash s d'], [8, 'dash s a'], [4, 'd']],
    d1: [[4, 'dash d'], [4, 'dash s d'], [4, 'space d'], [16, 'd'], [16, 'dash s d'], [4, 'a'], [4, 'dash s d'], [8, 'd'], [4, 'dash d'], [4, 'dash s d'], [4, 'd'], [4, 'space d']],
    d2: [[4, 'dash d'], [4, 'dash s d'], [4, 'space d'], [8, 'd'], [4, 'space d'], [16, 'd'], [4, 'space d'], [8, 'd'], [16, 'a'], [4, 'd']],
    d3: [[4, 'dash d'], [4, 'dash w'], [12, 'space a'], [4, 'a'], [4, 'space shift a'], [4, 'space d'], [4, 'space a'], [4, 'a'], [4, 'space shift a'], [4, 'd'], [4, 'space shift a'], [4, 'space d'], [8, 'a'], [4, 'dash d'], [4, 'dash s a'], [4, 'space a'], [8, 'a'], [8, 'space a'], [8, 'a'], [4, 'space a'], [4, 'd']],
    d4: [[4, 'dash d'], [4, 'dash s a'], [8, 'space a'], [8, 'a'], [4, 'space a'], [4, 'dash d'], [4, 'dash s a'], [4, 'd'], [8, 'space a'], [12, 'd'], [32, 'shift s'], [4, 'd']],
    d5: [[4, 'space a'], [4, 'dash d'], [4, 'dash s a'], [8, 'd'], [4, 'dash s a'], [4, 'dash s d'], [4, 'dash s a'], [4, 'dash s'], [4, 'a'], [4, 'dash s a'], [4, 'a'], [4, 'dash d'], [4, 'a']],
    d6: [[4, 'dash d'], [4, 'dash s a'], [12, 'space a'], [4, 'a'], [4, 'space a'], [4, 'a'], [4, 'space a'], [4, 'dash d'], [4, 'dash s a'], [8, 'space a'], [4, 'a'], [4, 'd'], [4, 'space a'], [4, 'dash d'], [4, 'dash s'], [4, 'd']],
    d7: [[4, 'dash d'], [4, 'space d'], [4, 'd'], [4, 'space d'], [4, 'space shift d'], [12, 'd'], [4, 'dash d'], [4, 'dash s d'], [8, 'space d'], [4, 'd'], [4, 'space d'], [8, 'd'], [8, 'space d'], [4, 'd'], [8, 'space d']],
    d8: [[4, 'dash d'], [4, 'dash w'], [12, 'space d'], [8, 'd'], [4, 'dash d'], [4, 'dash s d'], [8, 'space d'], [4, 'd'], [4, 'space d'], [12, 'd'], [12, 'dash s d'], [4, 'a']],
    d9: [[4, 'space d'], [4, 'd'], [4, 'dash d'], [4, 'dash s d'], [8, 'd'], [12, 'dash s d'], [4, 'dash s a'], [4, 'd'], [4, 'dash s d'], [4, 'd'], [4, 'space d'], [4, 'dash d'], [4, 'd']],
    d10: [[4, 'dash d'], [4, 'dash s d'], [8, 'space d'], [8, 'd'], [4, 'space d'], [12, 'd'], [8, 'space d'], [4, 'd']]
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

  /* t0, the tutorial room (W20): 60x20 tiles behind the hut door (tdoor), no enemies, six stations left to right.
     Each station is a sign plus an obstacle that needs exactly one verb: jump, dash, melee twice, charged melee,
     a soul shot across a pit, a spell on a barrier (TP from the crystal), melee to open the chest. The door back
     (tleave) is always open. Death respawns at the last station checkpoint (tcp). Per-open state lives on the level. */
  var TW = 60, TH = 20, TPIT = [[11, 12], [18, 23], [39, 47]];
  /* D2r supersedes the original station notes: seven listed stations, C opens existing equipment;
     a six-tile dash corridor has a 32px clearance, so jump-only fails without changing player physics. */
  function tpit(x) { var i; for (i = 0; i < TPIT.length; i++) if (x >= TPIT[i][0] && x <= TPIT[i][1]) return true; return false; }
  function tRows() {
    var g = [], x, y, s;
    for (y = 0; y < TH; y++) {
      s = '';
      for (x = 0; x < TW; x++) s += (y === 0 || x === TW - 1 || (x === 0 && y !== 15) || (y <= 13 && x >= 13 && x <= 27)) ? '#' : y === 15 && x === 9 ? '^' : y < 16 ? '.' : tpit(x) ? ' ' : '#';
      g.push(s);
    }
    return g;
  }
  function kn(def) { return String(NEU.keys && NEU.keys.get ? NEU.keys.get(def) : def).toUpperCase(); }
  var TSIGN = {
    jump: function () { return '* ' + kn(' ') + ' jumps the gap.'; },
    dash: function () { return '* ' + kn('x') + ' dashes the wide gap. the low ceiling blocks a jump.'; },
    crate: function () { return '* ' + kn('z') + ' twice breaks a crate. the wall is two crates high.'; },
    armour: function () { return '* hold ' + kn('z') + ' for a full swing. it breaks armour.'; },
    shot: function () { return '* hold ' + kn('z') + ', then let go: a soul shot. hit the far target.'; },
    spell: function () { return '* the crystal gives TP. ' + kn('c') + ' opens the strip. ' + kn('ArrowDown') + ' picks SPELL I, ' + kn('z') + ' casts it.'; },
    chest: function () { return '* ' + kn('c') + ' opens the chest and equipment. choose EQUIP to practise.'; }
  };
  /* pit widths are measured (tests/fixes561.mjs): jump alone clears 8 tiles at best and never 9; a ground dash
     clears up to 6; a dash in the air clears 9. So the wide gap is 9 wide and the shot pit 9 wide too. */
  /* checkpoints sit two tiles past each pit: a fall touches none of them, only the landing does */
  var TENTS = [
    { t: 'tleave', x: 0, y: 15 }, { t: 'sign', x: 5, y: 15, key: 'jump' },
    { t: 'tcp', x: 14, y: 15 }, { t: 'sign', x: 14, y: 15, key: 'dash' },
    { t: 'tcp', x: 28, y: 15 }, { t: 'sign', x: 28, y: 15, key: 'crate' },
    { t: 'tcrate', x: 30, y: 15, solid: true, hp: 2 }, { t: 'tcrate', x: 30, y: 14, solid: true, hp: 2 },
    { t: 'tcp', x: 32, y: 15 }, { t: 'sign', x: 32, y: 15, key: 'armour' }, { t: 'tarm', x: 34, y: 15, solid: true },
    { t: 'tcp', x: 36, y: 15 }, { t: 'sign', x: 36, y: 15, key: 'shot' },
    { t: 'tbridge', x: 39, y: 16, solid: true }, { t: 'tbridge', x: 40, y: 16, solid: true }, { t: 'tbridge', x: 41, y: 16, solid: true },
    { t: 'tbridge', x: 42, y: 16, solid: true }, { t: 'tbridge', x: 43, y: 16, solid: true }, { t: 'tbridge', x: 44, y: 16, solid: true },
    { t: 'tbridge', x: 45, y: 16, solid: true }, { t: 'tbridge', x: 46, y: 16, solid: true }, { t: 'tbridge', x: 47, y: 16, solid: true },
    { t: 'tcp', x: 49, y: 15 }, { t: 'sign', x: 49, y: 15, key: 'spell' }, { t: 'ttgt', x: 50, y: 13 },
    { t: 'tcry', x: 51, y: 15 }, { t: 'tbar', x: 53, y: 14, solid: true }, { t: 'tbar', x: 53, y: 15, solid: true },
    { t: 'sign', x: 54, y: 15, key: 'chest' }, { t: 'tchest', x: 55, y: 15 },
    { t: 'tgate', x: 57, y: 14, solid: true }, { t: 'tgate', x: 57, y: 15, solid: true }
  ];
  function tk() { var L = P.level0(); return L ? L.kit : null; }
  function tTargets() {
    var L = P.level0(), out = [], i, e, s = L.ts;
    for (i = 0; i < L.entities.length; i++) {
      e = L.entities[i];
      if ((e.t === 'ttgt' && !s.hit) || (e.t === 'tbar' && !s.bar)) out.push({ x: (e.x + 0.5) * T, y: (e.y + 0.5) * T, r: 8, e: e });
    }
    return out;
  }
  function tDamage(t, n, kind) {
    var s = P.level0().ts;
    if (!t || !t.e || kind === 'melee') return;
    if (t.e.t === 'ttgt') s.hit = true;
    else if (t.e.t === 'tbar' && kind === 'spell') s.bar = true;
  }
  function tOpen() {
    var L = P.level0(), F = { x: 0, y: 0, fx: 1, fy: 0 }, i, e;
    L.ts = { hit: false, bar: false, gate: false }; L.kitF = F;
    L.kit = NEU.kit ? NEU.kit.create({ F: F, box: { AX: 0, AY: 0, AW: TW * T, AH: TH * T }, noMelee: true, adapter: {
      targets: tTargets, damage: tDamage, hurtPlayer: function (n) { P.hurt(n); } } }) : null;
    for (i = 0; i < L.entities.length; i++) { e = L.entities[i]; if (e.t === 'sign') e.lines = [TSIGN[e.key]()]; }
  }
  function tTick(dt) {
    var L = P.level0(), h = P.hero(), f = L.kitF;
    /* the pits open to a solid floor below the map: feet past the floor line (y 256) means a fall, so wake at the checkpoint */
    /* D2r correction: pits are open below the map; the actual fall threshold is y 272. */
    if (h.y > 17 * T) { P.die(); return; }
    if (!L.kit) return;
    f.x = h.x; f.y = h.y - P.hh / 2; f.fx = h.face; f.fy = 0;
    L.kit.hp = h.hp; L.kit.tick(dt);
  }
  function tKey(k, down) {
    var lk = String(k).toLowerCase(), h = P.hero(), kt = tk(), L = P.level0(), i, e;
    if (!kt) return false;
    if (down && lk === 'c' && !kt.stripOpen && NEU.inv) {
      for (i = 0; i < L.entities.length; i++) {
        e = L.entities[i];
        if (e.t === 'tchest' && Math.abs(h.x - (e.x + 0.5) * T) <= 22 && Math.abs(h.y - (e.y + 1) * T) < 24) {
          e.opened = true; L.ts.gate = true; NEU.inv.open(); return true;
        }
      }
    }
    if (down && kt.stripOpen) { kt.hp = h.hp; kt.keydown(k); h.hp = Math.max(h.hp, kt.hp); return true; }
    if (down && lk === 'c') { kt.keydown('c'); return true; }
    if (lk === 'z') { if (down) kt.keydown('z'); else kt.keyup('z'); }
    return false;
  }
  function tLights(list) { var h = P.hero(); list.push(h.x / T, (h.y - 11) / T, 0.8); }
  function tDraw(c, cx, cy) { var kt = tk(); if (!kt) return; c.save(); c.translate(-cx, -cy); kt.draw(c); c.restore(); }
  P.level('t0', {
    rows: tRows(), spawn: { x: 2, y: 15 }, entities: TENTS, tileset: 'dungeon', view: 'terraria', chunked: true, hp: 6, solid: '#', cel: true,
    faction: function () { return 'B'; }, zoneAt: function () { return null; }, cracks: {},
    decor: [{ k: 'w', x: 5, y: 15, f: 'B' }, { k: 'w', x: 16, y: 15, f: 'B' }, { k: 'w', x: 28, y: 15, f: 'B' }, { k: 'w', x: 36, y: 15, f: 'B' }, { k: 'w', x: 49, y: 15, f: 'B' }, { k: 'w', x: 55, y: 15, f: 'B' }],
    onOpen: tOpen, tick: tTick, key: tKey, draw: tDraw, lights: tLights, swing: function () { return 0; }   /* a hook: plat charges melee only when the level has one */
  });
  kd('tdoor', { touch: function (e, input, melee) { if (melee && !P.replaying()) origOpen('t0', {}); } });
  kd('tleave', { touch: function () { if (!P.replaying()) origOpen('dgn', { spawn: { x: 29, y: HUT.wall1 }, zone: 'd0' }); } });
  kd('tcp', { touch: function (e) { var L = P.level0(); if (L && (L.spawn.x !== e.x || L.spawn.y !== e.y)) L.spawn = { x: e.x, y: e.y }; } });
  kd('tcrate', { touch: function (e, input, melee) { if (!melee || e.dead) return; e.hp -= 1; if (e.hp <= 0) e.dead = true; } });
  kd('tarm', { touch: function (e, input, melee) {
    if (!melee || e.dead) return;
    if (P.hero().swingPow === 2) { e.dead = true; return; }
    if (!e.said && !P.replaying()) { e.said = true; talk(['* the armour holds. hold ' + kn('z') + ' for a full swing.']); }
  } });
  kd('tbridge', { tick: function (e) { e.dead = !P.level0().ts.hit; } });
  kd('tbar', { tick: function (e) { e.dead = !!P.level0().ts.bar; } });
  kd('tgate', { tick: function (e) { e.dead = !!P.level0().ts.gate; } });
  kd('tcry', { touch: function (e) { var kt = tk(); if (e.used) return; e.used = true; if (kt && !P.replaying()) kt.addTp(0.6); } });
  kd('tchest', { touch: function (e, input, melee) {
    if (melee && !e.opened) talk(['* press ' + kn('c') + ' to open the chest and equipment.']);
  } });

  function enterDungeon(opts) {
    var id = typeof opts === 'string' ? opts : (opts && opts.id) || 'd0';
    var zone = typeof opts === 'string' ? opts : opts && opts.zone;
    /* B4/J3: the first surface entry falls through the dungeon shaft. Other zones keep the direct open. */
    if (zone !== 'd0' || P.replaying()) return P.open(id, opts);
    return P.dungeonFall(function () { return P.open(id, opts); });
  }

  /* MAP TOGGLE (WO-DGN): goes through NEU.keys routing, so a rebound key works
     and the old key is swallowed. No screen-corner button (F-02). */
  NEU.dungeon = {
    mapOpen: false, mapSeen: {}, recordings: REC, bossOpen: false, bossLine: '', mageSign: '', sign: '', lastDeath: null,
    /* B3: a won mage duel hands the dungeon back safely. calmUntil is the
       foe-stun window; the shared plat hook grants player i-frames. */
    calmUntil: 0,
    calm: function (invSec, stunSec) {
      var fs, i, f, n;
      if (P.grantInvuln) P.grantInvuln(invSec || 1.5);
      n = stunSec || 1;
      NEU.dungeon.calmUntil = Date.now() + n * 1000;
      fs = NEU.dgnFoes && NEU.dgnFoes.foes;
      if (fs) for (i = 0; i < fs.length; i++) {
        f = fs[i];
        f.vx = 0; f.vy = 0;
        if (typeof f.cd === 'number') f.cd = Math.max(f.cd, n);
      }
    },
    zones: zones, lifts: lifts, zoneAt: zoneAt,
    chamber: CH, rematchOn: rematchOn,
    /* the bone door: open / seal (instant skips the animation) and its state, 'closed' | 'opening' | 'open' | 'closing' */
    gate: { state: gateState, open: function (instant) { gateTo(true, instant); }, seal: function (instant) { gateTo(false, instant); } },
    here: function () { return P.running() && P.levelId() === 'dgn' ? here : ''; },
    spawnPx: function (id) { var n = dN(id); return n < 0 ? null : px(zones[n].spawn); },
    savePx: function () { return px(save); },
    enter: enterDungeon,
    bed: BED, bedPx: function () { return px(BED); },
    toSurface: toSurface
  };
  if (window.addEventListener) window.addEventListener('keydown', function (e) {
    if (!P.running() || P.levelId() !== 'dgn' || P.replaying() || e.repeat) return;
    if (NEU.tboxOpen && NEU.tboxOpen()) return;
    if (NEU.dgnPolt && NEU.dgnPolt.on && NEU.dgnPolt.on()) return;   /* the fight owns the keys; its map stays shut */
    if (NEU.kernel && NEU.kernel.current && NEU.kernel.current() !== 'plat') return;
    /* routed() has already turned the player's bound key into 'e' */
    if (String(e.key).toLowerCase() !== 'e') return;
    NEU.dungeon.mapOpen = !NEU.dungeon.mapOpen;
    e.preventDefault();
  });
})();
