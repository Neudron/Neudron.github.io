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
  E.register('d1_street', {
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
    spawns: { fire: { x: 1, y: 7, face: 'right' }, east: { x: 24, y: 7, face: 'left' } },
    entities: [
      { t: 'cityfloor', v: 'd1_street', x: 0, y: 0 },
      { t: 'save', x: 4, y: 10 },
      P('stallback', 10, 3),
      { t: 'npc', x: 10, y: 4, colour: '#E4C46A', look: 'merchant', run: function (c) { shop(c); } },
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
      { t: 'exit', x: 0, y: 7, to: 'b7_altar', spawn: 'east', style: 'door' },
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
  });

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

  function shop(c) {
    /* Third state. The axe was refused hours ago and the refusal was a
       person, not a price — so the way past it is also a person. */
    if (NEU.save && NEU.save.flagged('tripping') && !NEU.save.has('axe')) {
      c.say(["you again. you look terrible.",
             "the axe? still not for sale.",
             "...but i'll go against you for it. you look like you'd lose."], 'narr');
      setTimeout(function () {
        c.leave();
        if (NEU.rhythm) NEU.rhythm.open();
      }, 6000);
      return;
    }
    if (NEU.save && NEU.save.has('recall')) {
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
  E.register('d2_alley', {
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
    spawns: { west: { x: 1, y: 6, face: 'right' }, east: { x: 18, y: 5, face: 'left' } },
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
      { t: 'exit', x: 0, y: 6, to: 'd1_street', spawn: 'east', style: 'arch' }
    ]
  });

  /* ══ D3 — the square ═════════════════════════════════════════════
     The end of the city. An old hall with a clock that keeps the real
     time (the only thing here that is right), a dry fountain with a
     very confident statue on the axis, four trees, four lamps, and the
     chalk circle on the same axis below it. The east side is a
     balustrade over the drop, with the rest of the city far below.
     In through the park gate in the west wall. */
  E.register('d3_square', {
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
  });

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
    c.flag('used_recall', 1);
    if (NEU.save) NEU.save.take('recall');
    c.say(['you drink it standing in the circle, which is what the circle wanted.',
           'the square folds up like a map.'], 'narr');
    if (NEU.sfx && NEU.sfx.whoosh) NEU.sfx.whoosh();
    setTimeout(function () { c.go('e1_hall', 'south'); }, 2200);
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
  var HALL = [
    '########################',
    '########################',
    '#......................#',
    '#......................#',
    '#......................#',
    '#......................#',
    '#......................#',
    '########################'
  ];
  function grid(solids) {
    var rows = HALL.slice();
    for (var i = 0; i < solids.length; i += 2) {
      var x = solids[i], y = solids[i + 1], r = rows[y];
      rows[y] = r.substr(0, x) + 'o' + r.substr(x + 1);
    }
    return rows.join('\n');
  }
  function corridor(id, next, prev, styles, solids, odd) {
    E.register(id, {
      tileset: 'home',
      tiles: grid(solids),
      spawns: { south: { x: 1, y: 4, face: 'right' }, north: { x: 22, y: 4, face: 'left' } },
      entities: [
        { t: 'cityfloor', v: id, x: 0, y: 0 },
        P('moon', 5, 1), P('moon', 19, 1),
        P('sconce', 6, 1), P('sconce', 10, 1), P('sconce', 14, 1, { flick: id === 'e3_hall' }),
        { t: 'exit', x: 23, y: 4, to: next, spawn: 'south', style: styles[1] },
        { t: 'exit', x: 0, y: 4, to: prev, spawn: 'north', style: styles[0] }
      ].concat(odd),
      onEnter: function (c) { if (id === 'e1_hall') homeIn(c); }
    });
  }

  corridor('e1_hall', 'e2_hall', 'd3_square', ['door', 'arch'], [2, 2, 21, 2], [
    P('none', 12, 1, { lines: ['a picture frame with nothing in it.', 'the nail is still in the wall.'] }),
    P('coatstand', 2, 2), P('gclock', 21, 2, { n: 1 })
  ]);
  corridor('e2_hall', 'e3_hall', 'e1_hall', ['arch', 'door'], [2, 2, 12, 2, 17, 2, 21, 2], [
    P('vasetable', 12, 2, { lines: function (s) {
      return s && s.flagged('tv_breakable')
        ? ['a vase. it has been swept up and put back together at least once.',
           'there is a new crack in the glaze. you know the feeling.']
        : ['a vase. it has been swept up and put back together at least once.'];
    } }),
    P('coatstand', 2, 2), P('chair', 17, 2), P('gclock', 21, 2, { n: 2 })
  ]);
  corridor('e3_hall', 'e4_corridor', 'e2_hall', ['door', 'curtain'], [12, 6, 21, 2], [
    P('none', 12, 1, { lines: ['a door you do not have a key for. you do not want one.'] }),
    P('pot', 12, 6), P('gclock', 21, 2, { n: 3 })
  ]);

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
      '########################',
      '########################',
      '#o....................o#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#.....................o#',
      '########################'
    ].join('\n'),
    spawns: { south: { x: 1, y: 4, face: 'right' } },
    entities: [
      { t: 'cityfloor', v: 'e4_corridor', x: 0, y: 0 },
      { t: 'save', x: 3, y: 6 },
      P('goldlight', 6, 3), P('goldlight', 11, 3), P('goldlight', 15, 3),
      P('pot', 1, 2), P('pot', 22, 2), P('pot', 22, 6),
      { t: 'npc', x: 19, y: 4, colour: '#EDE7DE', look: 'sans', run: function (c) { lastTalk(c); } },
      { t: 'exit', x: 0, y: 4, to: 'e3_hall', spawn: 'north', style: 'curtain' }
    ],
    onEnter: function (c) {
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
      setTimeout(function () {
        c.say(['the corridor lets you out. you are back on the page.'], 'narr');
        setTimeout(function () { c.leave(); }, 1800);
      }, 2600);
    }
  }

  NEU.act4RoomsD = ['d1_street','d2_alley','d3_square',
                    'e1_hall','e2_hall','e3_hall','e4_corridor'];
})();
