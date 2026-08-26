/* rooms-d.js — the city, and the long way home.
   ───────────────────────────────────────────────────────────────────
   Through the fire door. Zone D is three streets and a merchant; Zone
   E is New Home, which is deliberately the least interesting place in
   the whole act and knows it.

   WHY THE MERCHANT WORKS:

   1. THE GLOW IS THE TUTORIAL FOR THE CRACK. One item in a list of
      junk has a lit name. You learn "glowing = the game is pointing at
      this" here, cheaply, and it gets called in five hours later when
      a single cracked pixel in the cube panel is the only way forward.

   2. THE AXE IS ON THE COUNTER AND NOT FOR SALE. You see it, you want
      it, you cannot have it, and the reason is a person rather than a
      price. That is a promise the rap battle pays off.

   3. THE JUNK IS REAL JUNK. Nine items you will never need. A shop
      where everything is useful is not a shop, it is a menu.

   WHY NEW HOME IS BORING ON PURPOSE:
   Three near-identical grey corridors after a castle, a boss and a
   city. The tempo drop is the point — the last corridor has to land
   quietly, and it cannot land quietly if the room before it was
   exciting.                                                          */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  if (!NEU.engine || !NEU.engine.register) return;
  var E = NEU.engine;

  E.tileset('city', {
    /* Texture from the real Deltarune atlases, PALETTE from this site.
       Each tile was picked by scoring every 16x16 block in the source for
       opacity, interior variance and seam cost (does its left edge match
       its right), then re-mapped onto a ramp built from the colour it
       already had below. Raw tiles are far brighter and warmer than this
       page — pasting them straight in would make the woods read as a
       screenshot of a different game.

       `colours` stays as the fallback and MUST NOT be deleted. It is what
       let every room ship before the art existed, and it is what renders if
       a sheet 404s. */
    src: 'img/act4/tiles/city.png',
    rects: { '#': [0, 0], '|': [16, 0], '.': [32, 0], ',': [48, 0], '=': [64, 0], '_': [80, 0], '+': [96, 0] },
    solid: '#|+',
    colours: { '#': '#0E1018', '|': '#1A1D28', '.': '#141824',
               ',': '#1E2434', '=': '#232838', '_': '#2A2033', '+': '#3A3245' }
  });
  E.tileset('home', {
    /* Texture from the real Deltarune atlases, PALETTE from this site.
       Each tile was picked by scoring every 16x16 block in the source for
       opacity, interior variance and seam cost (does its left edge match
       its right), then re-mapped onto a ramp built from the colour it
       already had below. Raw tiles are far brighter and warmer than this
       page — pasting them straight in would make the woods read as a
       screenshot of a different game.

       `colours` stays as the fallback and MUST NOT be deleted. It is what
       let every room ship before the art existed, and it is what renders if
       a sheet 404s. */
    src: 'img/act4/tiles/home.png',
    rects: { '#': [0, 0], '|': [16, 0], '.': [32, 0], ',': [48, 0], '_': [64, 0], '+': [80, 0] },
    solid: '#|+',
    /* Grey. Only grey. The one warm tile in the whole zone is the
       carpet in the last corridor, and it is the only thing your eye
       has to look at when he finally speaks. */
    colours: { '#': '#1A1A1E', '|': '#232329', '.': '#212127',
               ',': '#26262D', '_': '#3A2E28', '+': '#33333A' }
  });

  function say(c, l, w) { c.say(l, w || 'narr'); }

  /* ══ D1 — the street with the stall ══════════════════════════════*/
  E.register('d1_street', {
    tileset: 'city',
    tiles: [
      '########################',
      '#......................#',
      '#..||..||..||..||..||..#',
      '#......................#',
      '#,,,,,,,,,,,,,,,,,,,,,,#',
      '#......................#',
      '#......======..........#',
      '#......======..........#',
      '#......................#',
      '########################'
    ].join('\n'),
    spawns: { fire: { x: 2, y: 4, face: 'right' }, east: { x: 22, y: 4, face: 'left' } },
    entities: [
      { t: 'save', x: 4, y: 8 },
      { t: 'npc', x: 9, y: 5, colour: '#E4C46A', run: function (c) { shop(c); } },
      { t: 'npc', x: 13, y: 6, colour: '#8A8598', sheet: 'axe',
        lines: ['an axe, on the counter, behind the till.',
                'it is not on the board with the prices.'] },
      { t: 'exit', x: 23, y: 4, to: 'd2_alley', spawn: 'west' },
      { t: 'exit', x: 1, y: 4, to: 'b7_altar', spawn: 'east' }
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

  var shopStep = 0;
  function shop(c) {
    /* Third state. The axe was refused hours ago and the refusal was a
       person, not a price — so the way past it is also a person. */
    if (NEU.save && NEU.save.flagged('tripping') && !NEU.save.has('axe')) {
      c.say(["you again. you look terrible.",
             "the axe? still not for sale.",
             "...but i'll go against you for it. you look like you'd lose."], 'dog');
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
    if (NEU.shop) NEU.shop.open(shopStep);
    shopStep = 1;
  }

  /* ══ D2 / D3 — the rest of the city ══════════════════════════════*/
  E.register('d2_alley', {
    tileset: 'city',
    tiles: [
      '##################',
      '#................#',
      '#.####.....####..#',
      '#.#..........#...#',
      '#,,,,,,,,,,,,,,,,#',
      '#.#..........#...#',
      '#.####.....####..#',
      '#................#',
      '##################'
    ].join('\n'),
    spawns: { west: { x: 1, y: 4, face: 'right' }, east: { x: 16, y: 4, face: 'left' } },
    entities: [
      { t: 'npc', x: 5, y: 3, colour: '#C4705F', mush: 'mush3', sheet: 'mushroom',
        run: function (c) { NEU.chop && NEU.chop(c, 'mush3'); } },
      { t: 'npc', x: 12, y: 6, colour: '#4A4560',
        lines: ['someone has written NEU on the wall.',
                'someone else has crossed it out and written it again, worse.'] },
      { t: 'npc', x: 14, y: 3, colour: '#C4705F', mush: 'mush5', sheet: 'mushroom',
        run: function (c) { NEU.chop && NEU.chop(c, 'mush5'); } },
      { t: 'exit', x: 17, y: 4, to: 'd3_square', spawn: 'west' },
      { t: 'exit', x: 0, y: 4, to: 'd1_street', spawn: 'east' }
    ]
  });

  E.register('d3_square', {
    tileset: 'city',
    tiles: [
      '####################',
      '#..................#',
      '#....||......||....#',
      '#..................#',
      '#.......====.......#',
      '#,,,,,,,====,,,,,,,#',
      '#.......====.......#',
      '#..................#',
      '#....||......||....#',
      '#..................#',
      '####################'
    ].join('\n'),
    /* `north` is where you come back to when you walk west out of the
       house. e1_hall's exit has always asked for it by name; the room
       only had `west`, so the engine fell through to its last-ditch (2,2)
       and dropped you in the top-left corner of the square facing down,
       nowhere near the circle you left from. You step back out of the
       chalk circle now. */
    spawns: { west: { x: 1, y: 5, face: 'right' },
              north: { x: 4, y: 7, face: 'down' } },
    entities: [
      { t: 'save', x: 3, y: 2 },
      { t: 'npc', x: 9, y: 4, colour: '#4A4560',
        lines: ['a fountain with no water and no fish and a great deal of confidence.'] },
      { t: 'npc', x: 15, y: 8, colour: '#C4705F', mush: 'mush4', sheet: 'mushroom',
        run: function (c) { NEU.chop && NEU.chop(c, 'mush4'); } },
      { t: 'npc', x: 4, y: 8, colour: '#B892FF', sheet: 'recall', run: function (c) { drink(c); } },
      { t: 'exit', x: 0, y: 5, to: 'd2_alley', spawn: 'east' }
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
     Three corridors that are almost the same corridor. The details
     that differ are small and wrong, and nobody points at them. */
  function corridor(id, next, prev, note) {
    E.register(id, {
      tileset: 'home',
      tiles: [
        '########################',
        '#......................#',
        '#......................#',
        '#,,,,,,,,,,,,,,,,,,,,,,#',
        '#......................#',
        '#......................#',
        '########################'
      ].join('\n'),
      spawns: { south: { x: 2, y: 3, face: 'right' }, north: { x: 21, y: 3, face: 'left' } },
      entities: [
        { t: 'exit', x: 23, y: 3, to: next, spawn: 'south' },
        { t: 'exit', x: 0, y: 3, to: prev, spawn: 'north' },
        { t: 'npc', x: 12, y: 1, colour: '#2E2E36', lines: note }
      ],
      onEnter: function (c) { if (id === 'e1_hall') homeIn(c); }
    });
  }

  corridor('e1_hall', 'e2_hall', 'd3_square',
           ['a picture frame with nothing in it.', 'the nail is still in the wall.']);
  corridor('e2_hall', 'e3_hall', 'e1_hall',
           ['a vase. it has been swept up and put back together at least once.']);
  corridor('e3_hall', 'e4_corridor', 'e2_hall',
           ['a door you do not have a key for. you do not want one.']);

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
     building to: the world outside the console is also the game. */
  E.register('e4_corridor', {
    tileset: 'home',
    tiles: [
      '########################',
      '#......................#',
      '#....______________....#',
      '#,,,,______________,,,,#',
      '#....______________....#',
      '#......................#',
      '########################'
    ].join('\n'),
    spawns: { south: { x: 2, y: 3, face: 'right' } },
    entities: [
      { t: 'save', x: 3, y: 5 },
      { t: 'npc', x: 18, y: 3, colour: '#EDE7DE', run: function (c) { lastTalk(c); } },
      { t: 'exit', x: 0, y: 3, to: 'e3_hall', spawn: 'north' }
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
