/* rooms-g.js — the prize rooms, and what is behind the last one.
   ───────────────────────────────────────────────────────────────────
   Zone G is nine small rooms off one corridor, one per rank. Zone H is
   what happens after the vending machine.

   WHY NINE SMALL ROOMS AND NOT ONE BIG REWARD:

   1. EVERY RANK OPENS A DOOR. D- opens one. S+ opens nine. A run that
      earns nothing is a run you resent; a run that earns less is a run
      you want to improve on. That difference is the whole reason to
      re-take the quiz.

   2. THEY ARE DELIBERATELY SMALL. One joke, one object, one line each.
      A prize room that takes five minutes to explore is a chore
      wearing a reward's clothes.

   3. THE CORRIDOR SHOWS YOU THE DOORS YOU DID NOT EARN. Locked, named,
      right there. Being told what you missed is the point; hiding it
      would make a bad score feel like a bug.

   THE VENDING MACHINE:
   You have no money and the game never pretends otherwise. The verb is
   punching, it takes six goes, and the machine complains more each
   time. A "buy" prompt with no currency would be a puzzle about
   noticing you cannot buy things, which is not a puzzle.             */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  if (!NEU.engine || !NEU.engine.register) return;
  var E = NEU.engine;

  E.tileset('prize', {
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
    src: 'img/act4/tiles/prize.png',
    rects: { '#': [0, 0], '|': [16, 0], '.': [32, 0], ',': [48, 0], '=': [64, 0], '_': [80, 0], '+': [96, 0] },
    solid: '#|+',
    colours: { '#': '#14121C', '|': '#221E2E', '.': '#1A1724',
               ',': '#241F33', '=': '#2E2740', '_': '#3A2140', '+': '#4A3255' }
  });
  E.tileset('storm', {
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
    src: 'img/act4/tiles/storm.png',
    rects: { '#': [0, 0], '|': [16, 0], '.': [32, 0], ',': [48, 0], '=': [64, 0], '_': [80, 0], '+': [96, 0] },
    solid: '#|+',
    colours: { '#': '#0A0C18', '|': '#141A30', '.': '#101426',
               ',': '#1A2140', '=': '#222A4A', '_': '#2E3A66', '+': '#3E4E82' }
  });

  function say(c, l, w) { c.say(l, w || 'narr'); }

  var RANKS = ['D-', 'D', 'C', 'B', 'B+', 'A', 'A+', 'S', 'S+'];

  /* ══ G0 — the corridor of doors ══════════════════════════════════*/
  E.register('g0_hall', {
    tileset: 'prize',
    tiles: [
      '##############################',
      '#............................#',
      '#.++.++.++.++.++.++.++.++.++.#',
      '#............................#',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
      '#............................#',
      '#............................#',
      '##############################'
    ].join('\n'),
    spawns: { default: { x: 2, y: 4, face: 'right' }, back: { x: 2, y: 4, face: 'right' } },
    entities: (function () {
      var out = [{ t: 'save', x: 27, y: 6 }];
      RANKS.forEach(function (r, n) {
        out.push({ t: 'exit', x: 2 + n * 3, y: 3, to: 'g_' + n, spawn: 'default',
                   locked: 'rank:' + r,
                   lines: ['a door marked ' + r + '.',
                           'you did not score high enough for this one. yet.'] });
      });
      return out;
    })(),
    onEnter: function (c) {
      if (c.flagged('g0_seen')) return;
      c.flag('g0_seen', 1);
      var rank = (NEU.save && NEU.save.flag('quiz_rank')) || 'D-';
      var n = NEU.quiz ? NEU.quiz.opens(rank).length : 1;
      say(c, ['nine doors, each with a letter on it.',
              'you scored ' + rank + '. ' + n + ' of them will open for you.',
              'the rest are right there, being smug.']);
    }
  });

  /* Nine prize rooms, generated. Each is one gag and one line, because
     a small reward delivered instantly beats a big one you have to
     work for after already working for it. */
  var PRIZES = [
    ['D-', 'a participation certificate, unsigned',
     'somebody started writing your name and gave up after the first letter.'],
    ['D',  'a chair, facing a wall',
     'the chair is comfortable. the wall is not interesting. these facts are unrelated.'],
    ['C',  'a vending machine with one button and no slot',
     'pressing it makes a noise like a filing cabinet agreeing with you.'],
    ['B',  'a fish tank with no water',
     'the fish appear to be fine. you decide not to look directly at them.'],
    ['B+', 'a poster of a much better room',
     'the room in the poster has a chandelier. this room has a poster.'],
    ['A',  'a piano with three keys',
     'all three are middle c. it is the most decisive instrument you have ever met.'],
    ['A+', 'a shelf of books, all the same book',
     'the book is called THE BOOK. you do not open it. that felt correct.'],
    ['S',  'a very small door you cannot fit through',
     'through the keyhole: another, smaller door.'],
    ['S+', 'nothing at all, and a staircase down',
     'the best room is empty. that is either a joke or the point.']
  ];

  PRIZES.forEach(function (p, n) {
    var last = n === PRIZES.length - 1;
    E.register('g_' + n, {
      tileset: 'prize',
      tiles: [
        '##############',
        '#............#',
        '#....====....#',
        '#....====....#',
        '#,,,,,,,,,,,,#',
        '#............#',
        '##############'
      ].join('\n'),
      spawns: { default: { x: 11, y: 4, face: 'left' } },
      entities: [
        { t: 'npc', x: 6, y: 3, colour: '#B892FF', lines: [p[1], p[2]] },
        { t: 'exit', x: 12, y: 4, to: 'g0_hall', spawn: 'back' }
      ].concat(last ? [{ t: 'exit', x: 2, y: 4, to: 'h1_storm', spawn: 'top' }] : []),
      onEnter: function (c) {
        if (NEU.quest) NEU.quest.bump('a4_prizes', n + 1);
        if (last) say(c, [p[1], 'the staircase goes down. of course it does.']);
      }
    });
  });

  /* ══ H1 — the lightning door ═════════════════════════════════════*/
  E.register('h1_storm', {
    tileset: 'storm',
    tiles: [
      '####################',
      '#..................#',
      '#.......++++.......#',
      '#.......+..+.......#',
      '#,,,,,,,+..+,,,,,,,#',
      '#.......++++.......#',
      '#..................#',
      '####################'
    ].join('\n'),
    spawns: { top: { x: 2, y: 4, face: 'right' } },
    entities: [
      { t: 'save', x: 4, y: 6 },
      { t: 'npc', x: 9, y: 3, colour: '#7FA8FF', run: function (c) { c.go('h2_machine', 'door'); } },
      { t: 'exit', x: 2, y: 6, to: 'g_8', spawn: 'default' }
    ],
    onEnter: function (c) {
      say(c, ['a door the size of a house, with weather inside it.',
              'it is not locked. it has never needed to be.']);
    }
  });

  /* ══ H2 — the machine ════════════════════════════════════════════*/
  E.register('h2_machine', {
    tileset: 'storm',
    tiles: [
      '################',
      '#..............#',
      '#....======....#',
      '#....======....#',
      '#,,,,,,,,,,,,,,#',
      '#..............#',
      '################'
    ].join('\n'),
    spawns: { door: { x: 13, y: 4, face: 'left' } },
    entities: [
      { t: 'npc', x: 6, y: 3, colour: '#E4C46A', run: function (c) { punch(c); } },
      { t: 'exit', x: 14, y: 4, to: 'h1_storm', spawn: 'top' }
    ],
    onEnter: function (c) {
      if (c.flagged('h2_seen')) return;
      c.flag('h2_seen', 1);
      say(c, ['a vending machine, humming, alone, in the biggest room in the world.',
              'one item. slot D4. "Deez Nutz".',
              'you have no money. you have never had any money.']);
    }
  });

  var PUNCH = [
    'you hit the vending machine. it does not comment.',
    'you hit it again. it makes a note of this.',
    'the bag moves about a centimetre. the machine sighs.',
    'the machine says something in a language of servos.',
    'it is very nearly over the edge. so is the machine.',
    'the bag drops. the machine turns its light off, pointedly.'
  ];

  function punch(c) {
    if (c.has('nutz')) { c.say(['it has turned its light off. that is a boundary.'], 'narr'); return; }
    var n = (NEU.save && NEU.save.flag('punches')) || 0;
    c.say([PUNCH[Math.min(n, PUNCH.length - 1)]], 'narr');
    if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
    n++;
    if (NEU.save) NEU.save.flag('punches', n);
    if (n >= PUNCH.length) {
      if (NEU.save) NEU.save.give('nutz');
      if (NEU.quest) NEU.quest.mark('a4_nutz');
      setTimeout(function () { eat(c); }, 2600);
    }
  }

  function eat(c) {
    c.say(['you eat them, standing up, in a storm, out of a machine you assaulted.',
           'they are fine.',
           '...',
           'they are not fine.'], 'narr');
    if (NEU.save) { NEU.save.take('nutz'); NEU.save.flag('tripping', 1); }
    if (NEU.quest) NEU.quest.mark('a4_trip');
    document.body.classList.add('is-trip');
    setTimeout(function () { c.go('h3_trip', 'in'); }, 5200);
  }

  /* ══ H3 — the hallucination ══════════════════════════════════════
     The world does not change layout, only palette and one urgent
     idea: SOUP. Changing the geometry too would be disorienting for
     no gain; changing the colour and the goal is enough. */
  E.register('h3_trip', {
    tileset: 'storm',
    tiles: [
      '####################',
      '#..................#',
      '#..###..####..###..#',
      '#..................#',
      '#,,,,,,,,,,,,,,,,,,#',
      '#..................#',
      '#..###..####..###..#',
      '#..................#',
      '####################'
    ].join('\n'),
    spawns: { in: { x: 2, y: 4, face: 'right' } },
    entities: [
      { t: 'save', x: 4, y: 7 },
      { t: 'npc', x: 10, y: 2, colour: '#FF6BD6',
        lines: ['a pot. an enormous pot. it is the only thing in focus.',
                'it wants mushroom soup. you are certain of this in a way you cannot defend.'],
        run: function (c) { pot(c); } },
      { t: 'exit', x: 19, y: 4, to: 'd1_street', spawn: 'east' }
    ],
    onEnter: function (c) {
      if (c.flagged('h3_seen')) return;
      c.flag('h3_seen', 1);
      say(c, ['the colours have opinions now.',
              'you need five mushrooms. you know exactly where all five are.',
              'you also need something sharp, which you have never had.']);
    }
  });

  function pot(c) {
    var n = mushrooms();
    if (!c.has('axe')) {
      c.say(['the pot waits.',
             'you have ' + n + ' of five, and nothing sharp.',
             'the man with the axe is still in the city. he still will not sell it.'], 'narr');
      return;
    }
    if (n < 5) {
      c.say(['you have the axe and ' + n + ' of five.',
             'they are where they have always been: the path, the altar, the alley, the square.'], 'narr');
      return;
    }
    if (NEU.craft) { c.leave(); setTimeout(function () { NEU.craft.open(); }, 320); }
  }

  function mushrooms() {
    if (!NEU.save) return 0;
    var n = 0;
    for (var i = 1; i <= 5; i++) if (NEU.save.has('mush' + i)) n++;
    return n;
  }
  NEU.mushrooms = mushrooms;

  /* Cutting one. The mushroom NPCs in zones A/B/D become choppable
     once you are tripping AND carrying the axe — the same object,
     three different responses depending on the state of the world,
     which is the cheapest way to make a world feel like it noticed. */
  NEU.chop = function (c, id) {
    if (!NEU.save) return;
    if (NEU.save.has(id)) { c.say(['already cut.'], 'narr'); return; }
    if (!NEU.save.flagged('tripping')) {
      c.say(['a mushroom. you have no reason to want it and nothing to cut it with.'], 'narr');
      return;
    }
    if (!NEU.save.has('axe')) {
      c.say(['a mushroom. you want it very badly. you have nothing sharp.'], 'narr');
      return;
    }
    NEU.save.give(id);
    if (NEU.quest) NEU.quest.bump('a4_mush', mushrooms());
    if (NEU.sfx && NEU.sfx.whoosh) NEU.sfx.whoosh();
    c.say(['you take the mushroom. ' + mushrooms() + ' of five.'], 'narr');
  };

  NEU.act4RoomsG = ['g0_hall','h1_storm','h2_machine','h3_trip']
    .concat(PRIZES.map(function (_, n) { return 'g_' + n; }));
})();
