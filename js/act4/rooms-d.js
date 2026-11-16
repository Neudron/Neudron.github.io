/* rooms-d.js — the city, and the long way home.
   ───────────────────────────────────────────────────────────────────
   Through the fire door. Zone D is three streets and a merchant; Zone
   E is New Home, which is deliberately the quietest place in the whole
   act and knows it.

   The rooms are DATA. How they look — facades, the wet road, the stall,
   the dry fountain, the wallpaper, the moon on the floorboards — is
   js/act4/look-city.js: one `cityfloor` per room (the whole room
   painted once and blitted) and `cityprop`s that stand and sort with
   you. The tile grid is collision and the fallback; an `o` is solid
   ground under a prop (a counter, a lamp post, a basin, a clock).

   Every exit is in a wall or an edge and is taken by walking into it;
   its `style` tells js/core/engine-doors.js what to draw there. Every
   arrival spawn is the floor cell just inside that exit, facing away.

   WHY THE MERCHANT WORKS:

   1. THE GLOW IS THE TUTORIAL FOR THE CRACK. One item on his shelves
      is lit. You learn "glowing = the game is pointing at this" here,
      cheaply, and it gets called in five hours later when a single
      cracked pixel in the cube panel is the only way forward.

   2. THE AXE IS ON THE COUNTER AND NOT FOR SALE. You see it, you want
      it, you cannot have it, and the reason is a person rather than a
      price. That is a promise the rap battle pays off.

   3. THE JUNK IS REAL JUNK. Nine items you will never need. A shop
      where everything is useful is not a shop, it is a menu.

   WHY NEW HOME IS QUIET ON PURPOSE:
   Three near-identical grey corridors after a castle, a boss and a
   city. The tempo drop is the point — the last corridor has to land
   quietly, and it cannot land quietly if the room before it was
   exciting. They are dressed now, but in grey and moonlight; what
   differs between them is small and wrong (the moon's phase, the
   clock, the wallpaper) and nobody points at it.                     */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  if (!NEU.engine || !NEU.engine.register) return;
  var E = NEU.engine;

  E.tileset('city', {
    /* Texture from the real Deltarune atlases, PALETTE from this site.
       look-city.js paints over all of it; this is what renders if that
       file is missing, and what the engine bakes underneath.

       `colours` stays as the fallback and MUST NOT be deleted. It is what
       let every room ship before the art existed, and it is what renders if
       a sheet 404s. `o` is solid ground under a prop. */
    src: 'img/act4/tiles/city.png',
    rects: { '#': [0, 0], '|': [16, 0], '.': [32, 0], ',': [48, 0], '=': [64, 0], '_': [80, 0], '+': [96, 0] },
    solid: '#|+o',
    colours: { '#': '#0E1018', '|': '#1A1D28', '.': '#141824',
               ',': '#1E2434', '=': '#232838', '_': '#2A2033', '+': '#3A3245', 'o': '#1A1D28' }
  });
  E.tileset('home', {
    /* As above: look-city.js paints the corridors; this is the fallback. */
    src: 'img/act4/tiles/home.png',
    rects: { '#': [0, 0], '|': [16, 0], '.': [32, 0], ',': [48, 0], '_': [64, 0], '+': [80, 0] },
    solid: '#|+o',
    /* Grey. Only grey. The one warm thing in the whole zone is the
       carpet in the last corridor, and it is the only thing your eye
       has to look at when he finally speaks. */
    colours: { '#': '#1A1A1E', '|': '#232329', '.': '#212127',
               ',': '#26262D', '_': '#3A2E28', '+': '#33333A', 'o': '#232329' }
  });

  function say(c, l, w) { c.say(l, w || 'narr'); }
  function P(v, x, y, extra) {
    var e = { t: 'cityprop', v: v, x: x, y: y };
    for (var k in extra || {}) e[k] = extra[k];
    return e;
  }

  /* ══ D1 — the street with the stall ══════════════════════════════
     A wet street at night. Facades along the top, the road across the
     middle, a parapet over the canal at the bottom. The stall is the
     focal point: warm, strung with bulbs, under a pink neon moon, and
     the merchant stands BETWEEN his shelves and his counter (two props
     either side of him in the sort). You came out of the fire door in
     the west wall; the alley mouth is the east wall; the painted door
     is on the plum building's front wall, left of the stall. */
  var D1 = {
    tileset: 'city',
    tiles: [
      '##########################',
      '##########################',
      '##########################',
      '#.......ooooo.....ooo....#',
      '#..o....o...o..o.....o.o.#',
      '#.......ooooo............#',
      '#........................#',
      '#........................#',
      '#........................#',
      '#........................#',
      '#......o...ooo..o..o...o.#',
      '#........................#',
      '##########################'
    ].join('\n'),
    /* portal: the painted door in the north wall, one tile inside it. The
       pot's exit lands here; `east` is the alley side. */
    spawns: { fire: { x: 1, y: 7, face: 'right' }, stall: { x: 10, y: 6, face: 'up' }, east: { x: 24, y: 7, face: 'left' },
              portal: { x: 6, y: 3, face: 'down' } },
    entities: [
      { t: 'cityfloor', v: 'd1_street', x: 0, y: 0 },
      { t: 'save', x: 4, y: 10 },
      P('stallback', 10, 3),
      /* hint: a speech bubble over him, so the shop reads as something to talk to */
      { t: 'npc', x: 10, y: 4, colour: '#E4C46A', look: 'merchant', hint: true, run: function (c) { shop(c); } },
      /* the counter answers for him: you talk to a merchant across it,
         and from the road he is just out of arm's reach */
      P('stallfront', 10, 5, { run: function (c) { shop(c); } }),
      P('axe', 12, 5, { lines: ['an axe, on the counter, behind the till.',
                                'it is not on the board with the prices.'] }),
      P('neonpink', 10, 2),
      P('lamp', 3, 4), P('lamp', 15, 4), P('lamp', 23, 4), P('lamp', 7, 10),
      P('shelter', 19, 3),
      P('busstop', 21, 4, { lines: ['BUS STOP.',
                                    'the timetable is a drawing of a bus. someone has coloured it in, carefully.'] }),
      P('bench', 12, 10),
      P('cat', 13, 10, { dy: 7, lines: ['a black cat, asleep on the bench.',
                                        'it is not your cat. it is nobody\'s cat, which it seems to have arranged.'] }),
      P('planter', 16, 10), P('bin', 19, 10), P('hydrant', 23, 10),
      { t: 'exit', x: 25, y: 7, to: 'd2_alley', spawn: 'west', style: 'arch' },
      { t: 'exit', x: 0, y: 7, to: 'b7_altar', spawn: 'fire', style: 'door' },
      /* The way back to the pot. Nothing else leads into the trip room
         from the city, so without this the five mushrooms could never
         reach the pot. Open only while tripping (see rooms-g h3_trip).
         It is in the wall now, so sober you bump it and it says so,
         and tripping you walk straight through it. */
      { t: 'exit', x: 6, y: 2, to: 'h3_trip', spawn: 'in', locked: 'tripping', style: 'portal',
        lines: ['a door painted on the wall. it has no handle while you are sober.'] }
    ],
    onEnter: function (c) {
      if (c.flagged('d1_seen')) return;
      c.flag('d1_seen', 1);
      say(c, ['the door lets you out somewhere with weather.',
              'there is a stall. there is always a stall.']);
    }
  };

  /* The shop. Nine pieces of junk and one thing that matters, and the
     only difference is that one of them is lit. */
  var STOCK = [
    ['a bent nail', '2g'],
    ['half a map', '5g'],
    ['a jar of something', '9g'],
    ['Recall Potion', '—', true],
    ['a chair leg', '3g'],
    ['a working watch, wrong', '11g'],
    ['a sock, dry', '1g'],
    ['a smaller stall', '40g'],
    ['a promise', 'free'],
    ['an axe', 'not for sale', false, 'axe']
  ];

  function fought() {
    return (NEU.quest && NEU.quest.has && NEU.quest.has('a4_axe')) ||
      (NEU.save && NEU.save.has('axe'));
  }
  /* Dialogue to combat. The fight waits for the dialogue to be shut (not a
     timer), the screen goes black, the room is left, the fight opens on the
     black, and the black lifts into it. Reduced motion skips the fades. */
  var cutEl = null;
  /* the black is made as soon as the dialogue can open, so it is in the page
     from the first line of the talk, not only when the fight is armed */
  function cutFx() {
    if (!cutEl) {
      cutEl = document.createElement('div');
      cutEl.id = 'combatCut';
      cutEl.setAttribute('aria-hidden', 'true');
      cutEl.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#000;opacity:0;pointer-events:none;z-index:96;transition:opacity 500ms linear;';
      document.body.appendChild(cutEl);
    }
    return cutEl;
  }
  /* The black cut, shared: black in, mid() runs behind it, black out. */
  NEU.cut = function (mid, ms) {
    var el = cutFx(), still = !!(NEU.motion && NEU.motion.reduced ? NEU.motion.reduced() : window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ||
      !!(NEU.settings && NEU.settings.reduced);
    var d = still ? 0 : (ms || 500);
    el.style.transitionDuration = d + 'ms';
    el.style.pointerEvents = 'auto';
    el.style.opacity = '1';
    setTimeout(function () {
      mid();
      el.style.opacity = '0';
      setTimeout(function () { el.style.pointerEvents = 'none'; }, d);
    }, d);
  };
  /* The stage's own curtain, shared with the rhythm fight's exit. Red cloth
     drops over the outgoing room and lifts on the incoming stage; the reverse
     plays on the way out. z 96, below the dialogue box at 96/96 — it never
     covers a textbox that is still closing. */
  var stageCurtain = null;
  function curtainFx() {
    if (!stageCurtain) {
      stageCurtain = document.createElement('div');
      stageCurtain.id = 'stageCurtain';
      stageCurtain.setAttribute('aria-hidden', 'true');
      stageCurtain.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:96;pointer-events:none;overflow:hidden;' +
        'transform:translateY(-100%);transition:transform 500ms linear;' +
        'background:repeating-linear-gradient(90deg,#5A1024 0 24px,#7A1830 24px 48px);' +
        'box-shadow:inset 0 -24px 0 #3A0A18;';
      document.body.appendChild(stageCurtain);
    }
    return stageCurtain;
  }
  function curtainStill() {
    return !!(NEU.motion && NEU.motion.reduced ? NEU.motion.reduced() :
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ||
      !!(NEU.settings && NEU.settings.reduced);
  }
  NEU.stageCurtain = {
    el: curtainFx,
    still: curtainStill,
    /* drop the cloth, run mid() behind it, then lift it again */
    through: function (mid, ms, cb) {
      var el = curtainFx(), d = curtainStill() ? 0 : (ms || 500);
      el.style.transitionDuration = d + 'ms';
      el.style.transform = 'translateY(0)';
      el.style.pointerEvents = 'auto';
      setTimeout(function () {
        mid();
        el.style.transform = 'translateY(-100%)';
        setTimeout(function () {
          el.style.pointerEvents = 'none';
          if (cb) cb();
        }, d);
      }, d);
    }
  };
  function toCombat(c, start) {
    curtainFx();
    var reduced = curtainStill();
    var shut = reduced ? 0 : 500, hold = reduced ? 0 : 450, lift = reduced ? 0 : 600;
    function waitShut() {
      if (NEU.tboxOpen && NEU.tboxOpen()) { setTimeout(waitShut, 120); return; }
      stageCurtain.style.transitionDuration = shut + 'ms';
      stageCurtain.style.pointerEvents = 'auto';
      stageCurtain.style.transform = 'translateY(0)';
      setTimeout(function () {
        c.leave();
        start();
        stageCurtain.style.transitionDuration = lift + 'ms';
        stageCurtain.style.transform = 'translateY(-100%)';
        setTimeout(function () { stageCurtain.style.pointerEvents = 'none'; }, lift);
      }, shut + hold);
    }
    setTimeout(waitShut, 120);
  }
  function shop(c) {
    /* Third state. The axe was refused hours ago and the refusal was a
       person, not a price — so the way past it is also a person.
       After the fight the board stays open, recall included. */
    if (NEU.save && NEU.save.flagged('tripping') && !fought()) {
      cutFx();
      c.say(["you again. you look terrible.",
             "the axe? still not for sale.",
             "...but i'll go against you for it. you look like you'd lose."], 'narr');
      toCombat(c, function () { if (NEU.rhythm) NEU.rhythm.open(); });
      return;
    }
    if (!fought() && NEU.save && NEU.save.has('recall')) {
      c.say(["you have the one that does anything.", "the rest is atmosphere."], 'narr');
      return;
    }
    /* Open the graphical shop board — a real interface with
       selectable rows, prices, and per-item quips. The text dump it
       replaced is gone. The engine pauses while it is up. */
    c.leave();
    /* The first-visit line is a save flag, not a closure variable. A
       reload used to replay it, because the variable started at 0 every
       time the page loaded. The board opens on step 0 only until the
       flag is written. */
    if (NEU.shop) NEU.shop.open(NEU.save && NEU.save.flagged('shop_seen') ? 1 : 0);
    if (NEU.save) NEU.save.flag('shop_seen', 1);
  }

  /* ══ D2 — the alley ══════════════════════════════════════════════
     Behind the street: brick backs, a fire escape with laundry on it,
     a dripping air conditioner, a bare bulb over a back door, steam
     from a grate, and NEU sprayed on the wall in lilac — crossed out,
     and sprayed again underneath, worse, in teal. Two mushrooms grow
     in the damp corners. In from the street's alley mouth on the west;
     out up the steps on the east. */
  var D2 = {
    tileset: 'city',
    tiles: [
      '####################',
      '####################',
      '####################',
      '##..oo......o....###',
      '#...oo...........o.#',
      '#..................#',
      '#..................#',
      '#..ooo.........oo..#',
      '##.........o.......#',
      '####################'
    ].join('\n'),
    spawns: { west: { x: 1, y: 6, face: 'right' }, east: { x: 18, y: 5, face: 'left' },
              garage: { x: 10, y: 3, face: 'up' } },
    entities: [
      { t: 'cityfloor', v: 'd2_alley', x: 0, y: 0 },
      P('dumpster', 4, 4),
      P('cat', 5, 4, { dy: 26, dx: -2, awake: true }),
      P('crates', 12, 3), P('pallets', 17, 4),
      P('bags', 4, 7), P('crates', 15, 7), P('pallets', 16, 7), P('barrel', 11, 8),
      P('bulb', 14, 2),
      { t: 'npc', x: 2, y: 3, colour: '#C4705F', mush: 'mush3', sheet: 'mushroom',
        run: function (c) { NEU.chop && NEU.chop(c, 'mush3'); } },
      P('neonglow', 7, 2, { lines: ['someone has written NEU on the wall.',
                                    'someone else has crossed it out and written it again, worse.'] }),
      { t: 'npc', x: 17, y: 8, colour: '#C4705F', mush: 'mush5', sheet: 'mushroom',
        run: function (c) { NEU.chop && NEU.chop(c, 'mush5'); } },
      { t: 'exit', x: 19, y: 5, to: 'd3_square', spawn: 'west', style: 'stairs' },
      { t: 'exit', x: 0, y: 6, to: 'd1_street', spawn: 'east', style: 'arch' },
      /* Shut until the photograph is a flag. The sand starts on the other side. */
      { t: 'exit', x: 10, y: 2, to: 's0_sand', spawn: 'west', locked: 'photo',
        style: 'door', label: 'garage',
        lines: ['a garage door, shut.', 'it is waiting on a photograph.'] }
    ]
  };

  /* ══ D3 — the square ═════════════════════════════════════════════
     The end of the city. An old hall with a clock that keeps the real
     time (the only thing here that is right), a dry fountain with a
     very confident statue on the axis, four trees, four lamps, and the
     chalk circle on the same axis below it. The east side is a
     balustrade over the drop, with the rest of the city far below.
     In through the park gate in the west wall. */
  var D3 = {
    tileset: 'city',
    tiles: [
      '#########################',
      '#########################',
      '#########################',
      '#..o...ooo.....ooo...o..#',
      '#.....o...........o.....#',
      '#..........ooo..........#',
      '#.........ooooo.........#',
      '#.........ooooo.........#',
      '#..........ooo..........#',
      '#.......................#',
      '#.....o...........o.....#',
      '#..o.................o..#',
      '#.......................#',
      '#########################'
    ].join('\n'),
    /* `north` is where you come back to when you walk west out of the
       house. e1_hall's exit has always asked for it by name. You step
       back out of the chalk circle, toward the fountain. */
    spawns: { west: { x: 1, y: 7, face: 'right' },
              north: { x: 12, y: 10, face: 'down' } },
    entities: [
      { t: 'cityfloor', v: 'd3_square', x: 0, y: 0 },
      { t: 'save', x: 2, y: 5 },
      P('fountain', 12, 8, { lines: ['a fountain with no water and no fish and a great deal of confidence.'] }),
      P('lamp', 3, 3), P('lamp', 21, 3), P('lamp', 3, 11), P('lamp', 21, 11),
      P('tree', 6, 4), P('tree', 18, 4), P('tree', 6, 10), P('tree', 18, 10),
      P('bench', 8, 3), P('bench', 16, 3),
      { t: 'npc', x: 22, y: 12, colour: '#C4705F', mush: 'mush4', sheet: 'mushroom',
        run: function (c) { NEU.chop && NEU.chop(c, 'mush4'); } },
      P('chalk', 12, 11, { run: function (c) { drink(c); } }),
      { t: 'exit', x: 0, y: 7, to: 'd2_alley', spawn: 'east', style: 'gate' },
      P('birdsign', 22, 7, { lines: ['PLEASE DO NOT FEED THE BIRDS.',
                                     'there are no birds. the sign seems to think that is its doing.'] })
    ],
    onEnter: function (c) {
      if (c.flagged('d3_seen')) return;
      c.flag('d3_seen', 1);
      say(c, ['the square. it is the end of the city and it does not pretend otherwise.',
              'if you are carrying something that takes you home, this is the place.']);
    }
  };

  /* ── the city is one street (PLAN 7.1) ───────────────────────────
     D1, D2 and D3 stay as source rooms. d_city copies their tiles and
     entities at the offsets PLAN 7.1 gives, drops the exits they shared,
     and shuts the alley's two side walls except at its seams. Each old
     id is an alias into d_city with its own area. A copied entity keeps
     its old room and cell in `origin`, so gone:… flags saved before the
     merge still match. */
  var CITY_SRC = [
    { id: 'd1_street', room: D1, dx: 0, dy: 1, x0: 0, x1: 24 },
    { id: 'd2_alley', room: D2, dx: 24, dy: 2, x0: 1, x1: 18 },
    { id: 'd3_square', room: D3, dx: 42, dy: 0, x0: 1, x1: 24 }
  ];
  var CITY_IDS = ['d1_street', 'd2_alley', 'd3_square'];
  function mergeCityTiles() {
    var rows = [], x, y, i, j, s, g;
    for (y = 0; y < 14; y++) { rows.push([]); for (x = 0; x < 67; x++) rows[y].push('#'); }
    for (i = 0; i < CITY_SRC.length; i++) {
      s = CITY_SRC[i]; g = s.room.tiles.split('\n');
      for (j = 0; j < g.length; j++)
        for (x = s.x0; x <= s.x1; x++) rows[j + s.dy][x + s.dx] = g[j].charAt(x);
    }
    /* the alley's west and east walls: shut, except at the seams (24,8)-(25,8) and (42,7)-(43,7) */
    for (y = 0; y < 14; y++) {
      if (y !== 8) rows[y][25] = '#';
      if (y !== 7) rows[y][42] = '#';
    }
    return rows.map(function (r) { return r.join(''); }).join('\n');
  }
  function mergeCityEntities() {
    var out = [], i, k, s, es, e, copy, key;
    for (i = 0; i < CITY_SRC.length; i++) {
      s = CITY_SRC[i]; es = s.room.entities;
      for (k = 0; k < es.length; k++) {
        e = es[k];
        if (e.t === 'cityfloor' || (e.t === 'exit' && CITY_IDS.indexOf(e.to) >= 0)) continue;
        copy = {};
        for (key in e) copy[key] = e[key];
        copy.origin = { room: s.id, x: e.x, y: e.y };
        copy.x = e.x + s.dx; copy.y = e.y + s.dy;
        out.push(copy);
      }
    }
    return out;
  }

  E.register('d_city', {
    tileset: 'city',
    tiles: mergeCityTiles(),
    spawns: {
      fire: { x: 1, y: 8, face: 'right' }, stall: { x: 10, y: 7, face: 'up' }, portal: { x: 6, y: 4, face: 'down' },
      alley_west: { x: 25, y: 8, face: 'right' }, garage: { x: 34, y: 5, face: 'up' }, alley_east: { x: 42, y: 7, face: 'left' },
      square_west: { x: 43, y: 7, face: 'right' }, north: { x: 54, y: 10, face: 'down' }
    },
    areas: [
      { id: 'd1_street', x0: 0, y0: 0, x1: 24, y1: 13, spawn: 'fire', onEnter: D1.onEnter },
      { id: 'd2_alley', x0: 25, y0: 0, x1: 42, y1: 13, spawn: 'alley_west' },
      { id: 'd3_square', x0: 43, y0: 0, x1: 66, y1: 13, spawn: 'square_west', onEnter: D3.onEnter }
    ],
    entities: [{ t: 'cityfloor', v: 'd_city', x: 0, y: 0 }].concat(mergeCityEntities())
  });
  /* every spawn an old id declared is listed, as a_woods lists its own */
  E.alias('d1_street', 'd_city', { fire: 'fire', stall: 'stall', portal: 'portal', east: 'alley_west' }, 'd1_street');
  E.alias('d2_alley', 'd_city', { west: 'alley_west', east: 'alley_east', garage: 'garage' }, 'd2_alley');
  E.alias('d3_square', 'd_city', { west: 'square_west', north: 'north' }, 'd3_square');

  function drink(c) {
    if (!c.has('recall')) {
      if (c.flagged('used_recall')) {
        c.say(['the chalk is scuffed where you stood.',
               'it did its job. it does not need you to do it again.'], 'narr');
        return;
      }
      c.say(['a chalk circle on the ground, drawn by someone in a hurry.',
             'it wants a potion. it is quite specific about which.'], 'narr');
      return;
    }
    c.say(['you drink it standing in the circle, which is what the circle wanted.',
           'the square folds up like a map.'], 'narr');
    /* Same sequence as the C menu: drink, ring, iris, bedroom. */
    if (NEU.act4 && NEU.act4.recall) NEU.act4.recall();
  }

  /* ══ E — New Home ════════════════════════════════════════════════
     Three corridors that are almost the same corridor: two moonlit
     windows, two shut doors, three sconces, a runner, a banister over
     the stairwell, a grandfather clock. The details that differ are
     small and wrong, and nobody points at them:
       e1  a crescent moon; the clock says ten past three; an empty frame
       e2  a half moon; the clock runs backwards; a mended vase, a chair
       e3  a full moon; the clock has no hands; the wallpaper has eyes;
           a door you have no key for, with light under it          */
  /* W18: the walk home is shorter and it is not the same room four
     times. e1 is a 20-tile entry hall, e2 a 14-tile squeeze with a door
     into the nook you outgrew, e3 the 24-tile hub (dad's door, and now
     a locked cellar door), e4 a 16-tile last corridor. Two more rooms
     exist behind doors that never open — the larder and the cellar —
     and they say so when you bump them. */
  function hallGrid(w, solids) {
    var rows = [], x, y, i, h, r;
    for (y = 0; y < 8; y++) {
      if (y < 2 || y === 7) { h = ''; for (x = 0; x < w; x++) h += '#'; }
      else { h = '#'; for (x = 1; x < w - 1; x++) h += '.'; h += '#'; }
      rows.push(h);
    }
    for (i = 0; i < solids.length; i += 2) {
      var sx = solids[i], sy = solids[i + 1]; r = rows[sy];
      rows[sy] = r.substr(0, sx) + 'o' + r.substr(sx + 1);
    }
    return rows.join('\n');
  }
  function corridor(id, w, next, prev, styles, solids, odd, xspawns) {
    var spawns = { south: { x: 1, y: 4, face: 'right' }, north: { x: w - 2, y: 4, face: 'left' } };
    if (id === 'e3_hall') spawns.dad = { x: 12, y: 2, face: 'down' };
    if (xspawns) for (var k in xspawns) spawns[k] = xspawns[k];
    E.register(id, {
      tileset: 'home',
      tiles: hallGrid(w, solids),
      spawns: spawns,
      entities: [
        { t: 'cityfloor', v: id, x: 0, y: 0 },
        P('moon', Math.round(w * 0.2), 1), P('moon', Math.round(w * 0.8), 1),
        P('sconce', Math.round(w * 0.25), 1), P('sconce', Math.round(w * 0.42), 1),
        P('sconce', Math.round(w * 0.58), 1, { flick: id === 'e3_hall' }),
        { t: 'exit', x: w - 1, y: 4, to: next, spawn: 'south', style: styles[1] },
        { t: 'exit', x: 0, y: 4, to: prev, spawn: 'north', style: styles[0] }
      ].concat(odd),
      onEnter: function (c) {
        if (id === 'e1_hall') homeIn(c);
        if (id === 'e3_hall') c.flag('dad_door', c.has('dad_card') ? 1 : 0);
      }
    });
  }

  corridor('e1_hall', 20, 'e2_hall', 'd3_square', ['door', 'arch'], [2, 2, 17, 2], [
    { t: 'exit', x: 12, y: 1, to: 'e8_larder', spawn: 'door', style: 'door',
      locked: 'home_larder', label: 'larder',
      lines: ['a door with a towel rolled along the bottom.',
              'it is locked from this side. it has opinions about you.',
              'it is waiting for a key nobody in this house ever cut.'] },
    P('none', 7, 1, { lines: ['a picture frame with nothing in it.',
                              'the nail is still in the wall.'] }),
    P('coatstand', 2, 2, { lines: ['a coat on a stand.',
                                   'it is not yours. it is everyone\'s.'] }),
    P('gclock', 17, 2, { n: 1, lines: ['the clock says ten past three.',
                                      'it has said ten past three since you got here.'] })
  ]);
  corridor('e2_hall', 14, 'e3_hall', 'e1_hall', ['arch', 'door'], [4, 2, 9, 2, 11, 2], [
    { t: 'exit', x: 7, y: 1, to: 'e7_nook', spawn: 'door', style: 'door' },
    P('vasetable', 9, 2, { lines: function (s) {
      return s && s.flagged('tv_breakable')
        ? ['a vase. it has been swept up and put back together at least once.',
           'there is a new crack in the glaze. you know the feeling.']
        : ['a vase. it has been swept up and put back together at least once.'];
    } }),
    P('chair', 4, 2, { lines: ['a chair, facing the wall.',
                              'you could sit in it. you won\'t.'] }),
    P('gclock', 11, 2, { n: 2, lines: ['the clock runs backwards.',
                                      'it is in a hurry to be earlier.'] })
  ], { nook: { x: 7, y: 3, face: 'down' } });
  corridor('e3_hall', 24, 'e4_corridor', 'e2_hall', ['door', 'curtain'], [12, 6, 21, 2], [
    { t: 'exit', x: 12, y: 1, to: 'e5_dad', spawn: 'door', style: 'door', locked: 'dad_door',
      label: 'dad',
      lines: ['a door you do not have a key for.', 'it wants a card.'] },
    { t: 'exit', x: 8, y: 1, to: 'e9_cellar', spawn: 'door', style: 'door',
      locked: 'home_cellar', label: 'cellar',
      lines: ['a door with a towel rolled along the bottom.',
              'it is locked from this side. it has opinions about you.',
              'it is waiting for a key that was never cut for this house.'] },
    P('pot', 12, 6, { lines: ['a plant. it has been here longer than you have.',
                            'it does not seem to mind the wallpaper watching.'] }),
    P('none', 18, 1, { lines: ['a scuff mark at shoulder height.',
                               'something wide was carried through here. recently.'] }),
    P('gclock', 21, 2, { n: 3, lines: ['the clock has no hands.',
      'it does not want to tell you the time. it wants you to know that.'] })
  ]);

  /* The nook you outgrew: a music box that still plays its five notes,
     and a floorboard that was never about what was under it. */
  var boxCtx = null;
  function jingle() {
    if (NEU.settings && NEU.settings.muted) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      boxCtx = boxCtx || new AC();
      if (boxCtx.state === 'suspended' && boxCtx.resume) boxCtx.resume();
      var notes = [659.25, 783.99, 880, 783.99, 659.25], i;
      for (i = 0; i < notes.length; i++) (function (f, d) {
        var t = boxCtx.currentTime + d, o = boxCtx.createOscillator(), g = boxCtx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.035, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        o.connect(g); g.connect(boxCtx.destination);
        o.start(t); o.stop(t + 0.55);
      })(notes[i], i * 0.16);
    } catch (err) {}
  }
  function windBox(c) {
    if (!NEU.save.flagged('nook_wind')) {
      NEU.save.flag('nook_wind', 1);
      c.say(['a music box. you wound it as a kid.',
             'it plays the same five notes it always played.'], 'narr');
    } else {
      c.say(['the same five notes it always played.',
             'you never did learn the song.'], 'narr');
    }
    jingle();
  }
  function boardPeek(c) {
    if (!NEU.save.flagged('nook_board')) {
      NEU.save.flag('nook_board', 1);
      c.say(['one floorboard is loose.',
             'under it: nothing but dust, and a smell of rain on hot pavement.'], 'narr');
    } else {
      c.say(['the loose board again. still nothing under it.',
             'it was never about what was under it.'], 'narr');
    }
  }

  E.register('e7_nook', {
    tileset: 'home',
    tiles: hallGrid(12, [8, 2]),
    spawns: { door: { x: 6, y: 5, face: 'up' }, default: { x: 6, y: 5, face: 'up' } },
    entities: [
      { t: 'cityfloor', v: 'e7_nook', x: 0, y: 0 },
      P('moon', 6, 1), P('sconce', 3, 1), P('sconce', 9, 1),
      P('musicbox', 8, 2, { run: function (c) { windBox(c); } }),
      P('none', 3, 5, { run: function (c) { boardPeek(c); } }),
      { t: 'exit', x: 6, y: 6, to: 'e2_hall', spawn: 'nook', style: 'door' }
    ],
    onEnter: function (c) {
      if (c.flagged('nook_seen')) return;
      c.flag('nook_seen', 1);
      say(c, ['a room you outgrew.',
              'it kept your things anyway.']);
    }
  });

  /* The two doors that never open. They are real rooms — the engine
     draws them shut, the bump gives them a line — but no flag in the
     game ever satisfies their locks. */
  E.register('e8_larder', {
    tileset: 'home',
    tiles: hallGrid(10, [4, 2]),
    spawns: { door: { x: 5, y: 4, face: 'up' }, default: { x: 5, y: 4, face: 'up' } },
    entities: [
      { t: 'cityfloor', v: 'e8_larder', x: 0, y: 0 },
      { t: 'exit', x: 5, y: 6, to: 'e1_hall', spawn: 'north', style: 'door' }
    ]
  });
  E.register('e9_cellar', {
    tileset: 'home',
    tiles: hallGrid(10, [4, 2]),
    spawns: { door: { x: 5, y: 4, face: 'up' }, default: { x: 5, y: 4, face: 'up' } },
    entities: [
      { t: 'cityfloor', v: 'e9_cellar', x: 0, y: 0 },
      { t: 'exit', x: 5, y: 6, to: 'e3_hall', spawn: 'north', style: 'door' }
    ]
  });

  function homeIn(c) {
    if (c.flagged('home_seen')) return;
    c.flag('home_seen', 1);
    if (NEU.quest) NEU.quest.mark('a4_home');
    say(c, ['this is your house.',
            'you have never been here before and you know where everything is.']);
  }

  /* ══ E4 — the last corridor ══════════════════════════════════════
     No fight. He tells you one thing and it changes what the FIRST
     page of the site can do, which is the trick the whole act has been
     building to: the world outside the console is also the game.
     The same grey corridor, with no windows and no clock — and gold
     falling through the wall in shafts, onto the one warm carpet. */
  E.register('e4_corridor', {
    tileset: 'home',
    tiles: [
      '################',
      '################',
      '#o............o#',
      '#..............#',
      '#..............#',
      '#..............#',
      '#.............o#',
      '################'
    ].join('\n'),
    spawns: { south: { x: 1, y: 4, face: 'right' } },
    entities: [
      { t: 'cityfloor', v: 'e4_corridor', x: 0, y: 0 },
      { t: 'save', x: 3, y: 6 },
      P('goldlight', 5, 3), P('goldlight', 9, 3), P('goldlight', 13, 3),
      P('pot', 1, 2), P('pot', 14, 2), P('pot', 14, 6),
      P('none', 8, 1, { lines: ['a photograph of this hallway.',
                                'the date on the back is tomorrow.'] }),
      { t: 'npc', x: 13, y: 4, colour: '#EDE7DE', look: 'sans', run: function (c) { lastTalk(c); } },
      { t: 'exit', x: 0, y: 4, to: 'e3_hall', spawn: 'north', style: 'curtain' }
    ],
    onEnter: function (c) {
      if (c.flagged('e4_seen')) return;
      c.flag('e4_seen', 1);
      say(c, ['golden light from nowhere in particular.',
              'somebody is standing at the far end, not blocking it.']);
    }
  });

  var LAST = [
    ["so you did all that.", 'sans'],
    ["the witch, the ash, the door, the potion. that's a day.", 'sans'],
    ["listen. the television. the one in the corner of the actual page.", 'sans'],
    ["it's been playing something this whole time and nobody's watching it.", 'sans'],
    ["you've still got that broken key up at the top of the page.", 'sans'],
    ["the hilt was always the sword. put it through the television.", 'sans'],
    ["go on. i'll be here. i'm always here, that's the whole bit.", 'sans']
  ];

  function lastTalk(c) {
    var n = (NEU.save && NEU.save.flag('last_talks')) || 0;
    if (n >= LAST.length) {
      c.say(["go and hit the television.", "with that key. throw it. yes, really."], 'sans');
      return;
    }
    c.say([LAST[n][0]], 'sans');
    if (NEU.save) NEU.save.flag('last_talks', n + 1);
    if (n + 1 >= LAST.length) {
      /* THE flag. From here a thrown key can break the TV on the main
         page — an object two acts old gains a new verb. */
      c.flag('tv_breakable', 1);
      if (NEU.quest) NEU.quest.mark('a4_told');
      c.later(function () {
        if (NEU.engine && NEU.engine.room !== 'e4_corridor') return;
        c.say(['the corridor lets you out. you are back on the page.'], 'narr');
        c.later(function () {
          if (NEU.engine && NEU.engine.room !== 'e4_corridor') return;
          c.leave();
        }, 1800);
      }, 2600);
    }
  }

  NEU.act4RoomsD = ['d_city',
                    'e1_hall','e2_hall','e3_hall','e4_corridor',
                    'e7_nook','e8_larder','e9_cellar'];
})();
