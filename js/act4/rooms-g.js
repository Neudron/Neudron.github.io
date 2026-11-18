/* rooms-g.js — the prize rooms, and what is behind the last one.
   ───────────────────────────────────────────────────────────────────
   Zone G is nine small rooms off one corridor, one per rank. Zone H is
   what happens after the vending machine.

   The rooms are DATA. What they look like — the corridor's prosceniums,
   each prize's set, the storm landing, the machine hall, the trip — is
   js/act4/look-prize.js (kinds prizefloor / prizeprop / prizenpc, all
   pre-rendered once and blitted). Every room here carries ONE
   prizefloor entity first; it paints that room's floors and walls.

   WHY NINE SMALL ROOMS AND NOT ONE BIG REWARD:

   1. EVERY RANK OPENS A DOOR. D- opens one. S+ opens nine. A run that
      earns nothing is a run you resent; a run that earns less is a run
      you want to improve on. That difference is the whole reason to
      re-take the quiz.

   2. THEY ARE DELIBERATELY SMALL. One joke, one object, one line each.
      A prize room that takes five minutes to explore is a chore
      wearing a reward's clothes. Each is still a PLACE: its own floor,
      its own light, the prize as the one thing the set points at.

   3. THE CORRIDOR SHOWS YOU THE DOORS YOU DID NOT EARN. Locked, named,
      right there. An earned door's arch is lit in its rank's colour and
      its star on the carpet is gold; an unearned one is dark, roped
      off, and says what it waits for when you walk into it. Being told
      what you missed is the point; hiding it would make a bad score
      feel like a bug.

   EXITS ARE WALKED INTO (engine.js walkExits). Every exit here sits in
   a wall — the corridor's doors in its north wall, each prize room's
   curtain in its south wall, the stairs in a west wall, the storm door
   in the cliff — never on open floor, so crossing a room cannot fire
   one by accident. The spawn on the far side is one tile inside,
   facing away from the door it came through. Every exit carries a
   `style` for js/core/engine-doors.js.

   THE VENDING MACHINE:
   You have no money and the game never pretends otherwise. The verb is
   choosing: three machines, one decision, and each one says what it
   costs. A "buy" prompt with no currency would be a puzzle about
   noticing you cannot buy things, which is not a puzzle.             */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  if (!NEU.engine || !NEU.engine.register) return;
  var E = NEU.engine;

  /* 'o' is furniture: solid, painted as floor under the prop that
     stands on it. 'v' is the storm's void: the sky under the landing. */
  E.tileset('prize', {
    /* Texture from the real Deltarune atlases, PALETTE from this site.
       `colours` stays as the fallback and MUST NOT be deleted. It is what
       let every room ship before the art existed, and it is what renders if
       a sheet 404s (and under a harness with no canvas, it is the room). */
    src: 'img/act4/tiles/prize.png',
    rects: { '#': [0, 0], '|': [16, 0], '.': [32, 0], ',': [48, 0], '=': [64, 0], '_': [80, 0], '+': [96, 0] },
    solid: '#|+o',
    colours: { '#': '#14121C', '|': '#221E2E', '.': '#1A1724',
               ',': '#241F33', '=': '#2E2740', '_': '#3A2140', '+': '#4A3255', 'o': '#1A1724' }
  });
  E.tileset('storm', {
    src: 'img/act4/tiles/storm.png',
    rects: { '#': [0, 0], '|': [16, 0], '.': [32, 0], ',': [48, 0], '=': [64, 0], '_': [80, 0], '+': [96, 0] },
    solid: '#|+ov',
    colours: { '#': '#0A0C18', '|': '#141A30', '.': '#101426',
               ',': '#1A2140', '=': '#222A4A', '_': '#2E3A66', '+': '#3E4E82', 'o': '#101426', 'v': '#04050C', 'w': '#0A1428' }
  });

  function say(c, l, w) { c.say(l, w || 'narr'); }
  function P(v, x, y, more) {
    var e = { t: 'prizeprop', v: v, x: x, y: y };
    for (var k in more || {}) e[k] = more[k];
    return e;
  }
  function rows(a) { return a.join('\n'); }

  var RANKS = ['Z', 'C–', 'C', 'B–', 'B', 'A–', 'A', 'S', 'T'];
  /* each rank's colour on its arch, and the kind of door it is: the
     low ranks get a stage door, the middle a curtain, the top a gate,
     and T — the best room — something that is not a door at all */
  var TINT = ['#9A94B0', '#C07A44', '#E09A4E', '#8EA6D0', '#B4CCF4', '#F0D070', '#FFD34E', '#FF8AD0', '#A8F0FF'];
  var STYLE = ['door', 'door', 'door', 'curtain', 'curtain', 'curtain', 'gate', 'gate', 'portal'];
  function doorX(n) { return 4 + n * 3; }

  /* ══ G0 — the corridor of doors ══════════════════════════════════
     32 x 11. The doors are IN the north wall (row 2): you go through
     one by walking up into it, never by walking past it. Rows 3-7 are
     the stage; rows 8-10 are the audience pit (solid, painted). */
  E.register('g0_hall', {
    tileset: 'prize',
    tiles: rows([
      '################################',
      '################################',
      '################################',
      '#..............................#',
      '#..............................#',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
      '#..............................#',
      '################################',
      '################################',
      '################################'
    ]),
    spawns: (function () {
      /* `default` is where the quiz drops you; `back` is kept for
         anything that still names it; backN is in front of door N */
      var s = { default: { x: 2, y: 5, face: 'right' }, back: { x: 2, y: 5, face: 'right' } };
      for (var n = 0; n < RANKS.length; n++) s['back' + n] = { x: doorX(n), y: 3, face: 'down' };
      return s;
    })(),
    entities: (function () {
      var doors = RANKS.map(function (r, n) { return { x: doorX(n), lock: 'rank:' + r, tint: TINT[n] }; });
      var out = [{ t: 'prizefloor', v: 'g0', x: 0, y: 0, doors: doors }];
      RANKS.forEach(function (r, n) {
        out.push({ t: 'exit', x: doorX(n), y: 2, to: 'g_' + n, spawn: 'default', style: STYLE[n], tint: TINT[n],
                   locked: 'rank:' + r, glowOpen: TINT[n], label: r,
                   lines: ['a door marked ' + r + '.',
                           'you did not score high enough for this one. yet.'] });
        /* a plain stage door has no shut state of its own, so it gets
           the velvet rope (hidden once its rank flag is set) — after
           the exit, so it draws in front. Curtains and gates rope and
           chain themselves (engine-doors). */
        if (STYLE[n] === 'door') out.push(P('rope', doorX(n), 2, { lock: 'rank:' + r, rank: r }));
      });
      out.push({ t: 'save', x: 30, y: 4 });
      out.push(P('podium', 16, 7, { solid: true,
                 lines: ['PRIZE CORRIDOR. one door per rank.',
                         'complaints go in the bin. there is no bin.'] }));
      out.push(P('palm', 2, 3), P('palm', 30, 7), P('palm', 1, 7));
      return out;
    })(),
    onEnter: function (c) {
      /* an old save at T or S already holds the A flag once it reads
         the quiz; this makes sure a save with only the T flag passes */
      if (NEU.save && (NEU.save.flagged('rank:T') || NEU.save.flagged('rank:S'))) NEU.save.flag('rank:A', 1);
      if (c.flagged('g0_seen')) return;
      c.flag('g0_seen', 1);
      var rank = (NEU.save && NEU.save.flag('quiz_rank')) || 'Z';
      var n = NEU.quiz ? NEU.quiz.opens(rank).length : 1;
      say(c, ['nine doors, each with a letter on it.',
              'you scored ' + rank + '. ' + n + ' of them will open for you.',
              'the rest are right there, being smug.']);
    }
  });

  /* Nine prize rooms. Each is one gag and one line, because a small
     reward delivered instantly beats a big one you have to work for
     after already working for it. [rank, the thing, the line]. */
  var PRIZES = [
    ['Z',  'a participation certificate, unsigned',
     'somebody started writing your name and gave up after the first letter.'],
    ['C–', 'a chair, facing a wall',
     'the chair is comfortable. the wall is not interesting. these facts are unrelated.'],
    ['C',  'a vending machine with one button and no slot',
     'pressing it makes a noise like a filing cabinet agreeing with you.'],
    ['B–', 'a fish tank with no water',
     'the fish appear to be fine. you decide not to look directly at them.'],
    ['B',  'a poster of a much better room',
     'the room in the poster has a chandelier. this room has a poster.'],
    ['A–', 'a piano with three keys',
     'all three are middle c. it is the most decisive instrument you have ever met.'],
    ['A',  'a shelf of books, all the same book',
     'the book is called THE BOOK. you do not open it. that felt correct.'],
    ['S',  'a very small door you cannot fit through',
     'through the keyhole: another, smaller door.'],
    ['T',  'nothing at all, and a staircase down',
     'the best room is empty. that is either a joke or the point.']
  ];

  /* Each prize's set. `tiles` puts the prize where the set points at it
     (furniture 'o' under anything you cannot walk through); `at` is the
     prize itself; `props` the dressing. The exit is always the curtain
     in the middle of the south wall and `default` one tile above it. */
  var SETS = [
    { /* Z — a strip-lit office at five past five */
      tiles: ['###########', '###########', '#.........#', '#...ooo...#', '#.........#',
              '#.........#', '#.........#', '###########'],
      at: [5, 3],
      props: [P('ftable', 5, 3), P('cooler', 8, 2, { solid: true }), P('chairs', 3, 2, { solid: true }),
              P('bin', 9, 6, { solid: true, lines: ['a bin full of certificates.', 'all of them start with the same letter.'] }),
              P('pen', 3, 5, { lines: ['a pen on a string. the string goes into the wall.'], run: rankCheat })] },
    { /* C– — a gallery, one exhibit, which is the wall */
      tiles: ['#############', '#############', '#...........#', '#...........#', '#...........#',
              '#...........#', '#...........#', '#############'],
      at: [6, 3],
      props: [P('stanchion', 4, 3, { solid: true }), P('stanchion', 8, 3, { solid: true }),
              P('bench', 10, 5, { solid: true }), P('stool', 1, 6, { solid: true })] },
    { /* C — the break room */
      tiles: ['###########', '###########', '#.........#', '#.........#', '#.........#',
              '#.........#', '#.........#', '###########'],
      at: [5, 2],
      props: [P('plant', 2, 2), P('cafe', 8, 4, { solid: true }), P('stool2', 9, 4), P('stool2', 7, 4)] },
    { /* B– — the aquarium with no water in it */
      tiles: ['#############', '#############', '#...ooo.....#', '#...........#', '#...........#',
              '#...........#', '#...........#', '#############'],
      at: [5, 2],
      props: [P('net', 9, 2), P('armchair', 2, 4, { solid: true }), P('kelp', 11, 2), P('kelp', 1, 6)] },
    { /* B — a bedsit with a poster of a better room */
      tiles: ['#############', '#############', '#...........#', '#...........#', '#...........#',
              '#...........#', '#...........#', '#############'],
      at: [6, 1],
      props: [P('bulb', 6, 3), P('bucket', 3, 4), P('cratetable', 9, 4, { solid: true }), P('mattress', 2, 6)] },
    { /* A– — a recital for one */
      tiles: ['#############', '#############', '#...........#', '#....ooo....#', '#...........#',
              '#...........#', '#.o.o...o.o.#', '#...........#', '#############'],
      at: [6, 3],
      props: [P('pbench', 6, 4), P('stand', 9, 3, { solid: true }), P('bouquet', 3, 3),
              P('seat', 2, 6), P('seat', 4, 6), P('seat', 8, 6), P('seat', 10, 6)] },
    { /* A — the library of one book */
      tiles: ['#############', '#############', '#...........#', '#...........#', '#....ooo....#',
              '#...........#', '#...........#', '#...........#', '#############'],
      at: [6, 4],
      props: [P('readlamp', 3, 6, { solid: true }), P('armchair', 2, 6, { solid: true }), P('lectern', 10, 6, { solid: true }),
              P('globe', 10, 3, { solid: true }), P('bookpile', 2, 3)] },
    { /* S — a grand hall built for a very small door */
      tiles: ['#############', '#############', '#...........#', '#...........#', '#...........#',
              '#...........#', '#...........#', '#...........#', '#############'],
      at: [6, 1],
      props: [P('topiary', 3, 2, { solid: true }), P('topiary', 9, 2, { solid: true }),
              P('magnifier', 8, 3), P('urn', 1, 7, { solid: true }), P('urn', 11, 7, { solid: true })] },
    { /* T — the best room: marble, a skylight, an empty plinth, stairs */
      tiles: ['###############', '###############', '#.............#', '#.............#', '#.............#',
              '#.............#', '#.............#', '#.............#', '#.............#', '###############'],
      at: [7, 5],
      props: [P('column', 2, 2, { solid: true }), P('column', 12, 2, { solid: true }),
              P('column', 2, 8, { solid: true }), P('column', 12, 8, { solid: true })] }
  ];
  PRIZES.forEach(function (p, n) {
    var last = n === PRIZES.length - 1, set = SETS[n];
    var w = set.tiles[0].length, h = set.tiles.length, mid = (w - 1) / 2;
    var spawns = { default: { x: mid, y: h - 2, face: 'up' } };
    if (last) spawns.stairs = { x: 1, y: 5, face: 'right' };
    E.register('g_' + n, {
      tileset: 'prize',
      tiles: rows(set.tiles),
      spawns: spawns,
      entities: [{ t: 'prizefloor', v: 'g_' + n, x: 0, y: 0 }]
        .concat(set.props)
        .concat([
          /* the prize: an npc in every way but its drawing */
          { t: 'prizenpc', v: 'prize' + n, x: set.at[0], y: set.at[1], solid: true, colour: '#B892FF', lines: [p[1], p[2]] },
          { t: 'exit', x: mid, y: h - 1, to: 'g0_hall', spawn: 'back' + n, style: 'curtain' }
        ]).concat(n === 0 ? [{ t: 'exit', x: 1, y: 1, to: 'a1_clearing', spawn: 'default', style: 'hatch',
                                locked: 'vend_pick', confirm: 'the prize corridor',
                                confirmNote: 'the trapdoor drops shut behind you. your save is kept.',
                                lines: ['a trapdoor in the floor. chained, with a padlock the size of a fist.',
                                        'the chain stays on until the machines upstairs have been used. they have not.'] }] : [])
        .concat(last ? [{ t: 'exit', x: 0, y: 5, to: 'h1_storm', spawn: 'top', style: 'stairs' }] : []),
      onEnter: function (c) {
        if (NEU.quest) NEU.quest.bump('a4_prizes', n + 1);
        if (last && !c.flagged('g_last_seen')) {
          c.flag('g_last_seen', 1);
          say(c, [p[1], 'the staircase goes down. of course it does.']);
        }
      }
    });
  });

  /* ══ H1 — the lightning door ═════════════════════════════════════
     A landing in the middle of a storm: a cliff to the north with a
     door the size of a house in it, standing ajar, weather pouring out
     of the gap. The stairs from the best room come in through the west
     wall; the south and east edges fall away into cloud ('v').

     The door used to be an npc you pressed; it is an exit now, in the
     cliff at (10,2), so you go in by walking up into the gap. It was
     once sealed inside its own frame — the same mistake as b8_arena —
     which walled off h2_machine and h3_trip, which nothing else leads
     to. Here the gap opens straight onto the landing. */
  E.register('h1_storm', {
    tileset: 'storm',
    tiles: rows([
      '#####################',
      '#####################',
      '#####################',
      '##.................vv',
      '#..................vv',
      '#..................vv',
      '#.................vvv',
      '#................vvvv',
      '##..............vvvvv',
      'vv.....vvv.....wwwvvv',
      'vvvvvvvvvvvvvvvvvvvvv'
    ]),
    spawns: { top: { x: 1, y: 5, face: 'right' }, door: { x: 10, y: 3, face: 'down' } },
    entities: [
      { t: 'prizefloor', v: 'h1', x: 0, y: 0 },
      { t: 'trigger', x: 15, y: 9, w: 3, h: 1, run: function (c) { water(c); } },
      { t: 'save', x: 3, y: 7 },
      /* the gap between the leaves: a tear of weather (style rift) */
      { t: 'exit', x: 10, y: 2, to: 'h2_machine', spawn: 'door', style: 'rift' },
      { t: 'exit', x: 0, y: 5, to: 'g_8', spawn: 'stairs', style: 'stairs' },
      P('menhir', 4, 3, { solid: true, lines: ['a standing stone. rain runs down it in bright threads.', 'the rune is older than the door and does not match it.'] }),
      P('menhir', 16, 4, { solid: true, lines: ['another stone, turned to face the gap.', 'it was here before the stairs.'] }),
      P('stormlamp', 7, 4, { solid: true, lines: ['a lamp that keeps burning in weather that should have put it out.', 'the glass is warm. nobody maintains it.'] }),
      P('stormlamp', 13, 4, { solid: true, lines: ['the other lamp. it dims when the door flashes.', 'there is no wiring.'] }),
      P('rubble', 14, 7, { lines: ['wet gravel. something scratched underneath, or just the rain.'] }),
      P('rubble', 5, 8, { lines: ['under the loose stones, a rune scratched by hand.', 'someone stood here a long time, waiting for the weather to stop.'], secret: true }),
      P('rod', 18, 3, { solid: true, lines: ['an iron rod, ridged with old burns.', 'it hums when the sky forks.'] })
    ],
    onEnter: function (c) {
      if (c.flagged('h1_seen')) return;
      c.flag('h1_seen', 1);
      say(c, ['a door the size of a house, with weather inside it.',
              'it is not locked. it has never needed to be.']);
    }
  });

  /* ══ H2 — the machine ════════════════════════════════════════════
     The biggest room in the world: 31 x 19, wider than the screen, the
     edges lost in the dark. One vending machine stands in the middle
     under the only light. You come in through the bulkhead hatch in
     the south wall and walk the whole way up to it. */
  E.register('h2_machine', {
    tileset: 'storm',
    tiles: rows([
      '###############################',
      '###############################',
      '#.............................#',
      '#.............................#',
      '#....o...................o....#',
      '#.............................#',
      '#.............................#',
      '#.............................#',
      '#.............................#',
      '#.............................#',
      '#.............................#',
      '#.............................#',
      '#.............................#',
      '#....o...................o....#',
      '#.............................#',
      '#.............................#',
      '#.............................#',
      '#.............................#',
      '###############################'
    ]),
    spawns: { door: { x: 15, y: 17, face: 'up' } },
    entities: [
      { t: 'prizefloor', v: 'h2', x: 0, y: 0 },
      /* three machines, one decision: the first slot you use is the
         only one that works. Every slot leads to the same trip. */
      { t: 'prizenpc', v: 'vend_a', x: 12, y: 8, solid: true, colour: '#E4C46A', look: 'vending',
        run: function (c) { vend(c, 0); } },
      { t: 'prizenpc', v: 'vend_b', x: 15, y: 8, solid: true, colour: '#E4C46A', look: 'vending',
        run: function (c) { vend(c, 1); } },
      { t: 'prizenpc', v: 'vend_c', x: 18, y: 8, solid: true, colour: '#E4C46A', look: 'vending',
        run: function (c) { vend(c, 2); } },
      { t: 'exit', x: 15, y: 18, to: 'h1_storm', spawn: 'door', style: 'hatch' },
      P('aframe', 12, 11, { lines: ['OUT OF ORDER.', 'the sign is not on the machine. it is on the room.'] }),
      P('mbin', 21, 8, { solid: true }), P('crate2', 4, 15, { solid: true }), P('crate2', 5, 15, { solid: true, k: 1 }),
      P('pillar', 5, 4), P('pillar', 25, 4), P('pillar', 5, 13), P('pillar', 25, 13),
      P('coin', 22, 11, { lines: ['a coin.', 'it is painted on the floor. someone thought that was funny.'] }),
      P('hpanel', 8, 8, { lines: ['a service panel on a stalk, blinking at a slow, patient rate.', 'the readout is a row of dashes. it has been blinking since before you came in.'] }),
      P('hpanel', 22, 8, { lines: ['the second panel. its light is out of step with the first.', 'under the grime, a scratch: one, then two, then nothing. someone counted.'], secret: true })
    ],
    onEnter: function (c) {
      /* The trip is committed on the decision, so a reload before the
         eat has played lands here tripping: carry on to h3 from here. A
         save from before that change holds nutz and no trip; finish it. */
      if (NEU.save && NEU.save.has('nutz')) { NEU.save.take('nutz'); NEU.save.flag('tripping', 1); }
      if (c.flagged('tripping')) { setTimeout(function () { c.go('h3_trip', 'in'); }, 600); return; }
      if (c.flagged('h2_seen')) return;
      c.flag('h2_seen', 1);
      say(c, ['three vending machines, humming, in the biggest room in the world.',
              'left: "DEEZ NUTZ". middle: a can with no label. right: a packet that says HOLD ME.',
              'you have no money. you can take one. the machines will not give you a second.']);
    }
  });

  /* The verb is punching, six times, and the machine gets more
     passive-aggressive each go (story bible, Zone H). Six punches share one
     counter; the sixth drops the bag. vend_pick still records which slot,
     so old saves and the Z-room hatch agree. */
  var PUNCH = [
    'you hit the vending machine. it does not comment.',
    'you hit it again. it makes a note of this.',
    'the bag moves about a centimetre. the machine sighs.',
    'the machine says something in a language of servos.',
    'it is very nearly over the edge. so is the machine.',
    'the bag drops. the machine turns its light off, pointedly.'
  ];

  function reduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function vend(c, n) {
    if (NEU.save && NEU.save.flagged('vend_pick')) {
      c.say(['the machines have made their one decision. they are not taking another.'], 'narr');
      return;
    }
    var p = NEU.save ? ((NEU.save.flag('punches') || 0) + 1) : 1;
    if (NEU.save) NEU.save.flag('punches', p);
    /* 2px kick, 1px bag slide (look-prize owns the drawing) */
    if (NEU.vendPunch) NEU.vendPunch(n, p);
    c.say([PUNCH[p - 1]], 'narr');
    if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
    /* SMALL: a hit landed, on a machine */
    if (NEU.juice && NEU.juice.hit) NEU.juice.hit('small');
    if (p < 6) return;
    /* sixth: commit, drop the bag, and let the EAT call the walk back */
    if (NEU.save) { NEU.save.flag('vend_pick', n + 1); NEU.save.flag('tripping', 1); }
    if (NEU.quest) { NEU.quest.mark('a4_nutz'); NEU.quest.mark('a4_trip'); }
    if (NEU.vendDrop) NEU.vendDrop(n, function () { trip(c); });
    else trip(c);
  }

  /* The Z room's cheat. It writes the same rank state the quiz writes when
     you finish (quiz_rank, the rank:* door flags, the saved quiz record), so
     the stairs, the doors and the quiz all agree that you are rank T. */
  function rankCheat(c) {
    if (!NEU.save || NEU.save.flagged('rank:T')) { c.say(['the pen is still attached to nothing.'], 'narr'); return; }
    NEU.save.flag('quiz_rank', 'T');
    NEU.save.flag('rank:T', 1); NEU.save.flag('rank:S', 1); NEU.save.flag('rank:A', 1);
    NEU.save.data.quiz = { rank: 'T', score: 20 };
    NEU.save.capture();
    if (NEU.quest) NEU.quest.mark('a4_rank');
    c.say(['you click the pen. the wall takes the string back, with a sigh.', 'you cheated. you are now rank T.'], 'narr');
  }

  /* ══ the trip home: one scripted walk ═══════════════════════════
     After the eat, letterbox bars slide in (the cue — control is never
     silently lost), the cine flag swallows real keys, and api.drive
     walks h2 -> h1 -> the water inlet; the water trigger wakes the
     portal and control returns on arrival in h3. */
  var CINE = null, LB = null;
  function letterbox(on) {
    if (!document.body) return;
    if (!LB) {
      LB = document.createElement('div');
      LB.id = 'cineBars'; LB.setAttribute('aria-hidden', 'true');
      document.body.appendChild(LB);
    }
    LB.classList.toggle('on', on);
  }
  function talkOpen() { return !!(NEU.tboxOpen && NEU.tboxOpen()); }

  /* The walk is planned, not hand-waypointed: a 4-neighbour BFS over the room grid, solid tiles and
     solid props blocking. Goals: the cell above the bulkhead hatch in h2, the water inlet in h1. */
  var WATER = { x: 15, y: 9, w: 3, h: 1 };
  var GOALS = {
    h2_machine: function (x, y) { return x === 15 && y === 17; },
    h1_storm: function (x, y) { return x >= WATER.x && x < WATER.x + WATER.w && y === WATER.y; }
  };
  function plan(c, sx, sy) {
    var r = c.room, g = r.grid, goal = GOALS[r.id], ts = NEU.engine.tilesets()[r.tileset], solidCh = ts ? ts.solid : '#';
    if (!g || !goal) return null;
    var es = c.ents(), prev = {}, q = [[sx, sy]], i, k, d, cur, nx, ny, path;
    function solid(x, y) {
      var row = g[y], j;
      if (!row || x < 0 || x >= row.length || solidCh.indexOf(row.charAt(x)) >= 0) return true;
      for (j = 0; j < es.length; j++) if (!es[j].dead && es[j].solid && es[j].x === x && es[j].y === y) return true;
      return false;
    }
    var D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    prev[sx + ',' + sy] = true;
    for (i = 0; i < q.length; i++) {
      cur = q[i];
      if (goal(cur[0], cur[1])) {
        path = [];
        for (k = cur[0] + ',' + cur[1]; prev[k] !== true; k = prev[k].k) path.unshift(prev[k].c);
        return path;
      }
      for (d = 0; d < 4; d++) {
        nx = cur[0] + D[d][0]; ny = cur[1] + D[d][1]; k = nx + ',' + ny;
        if (prev[k] || solid(nx, ny)) continue;
        prev[k] = { k: cur[0] + ',' + cur[1], c: [nx, ny] }; q.push([nx, ny]);
      }
    }
    return null;
  }
  NEU.tripWalk = { plan: plan };
  /* shared by the walk and a player wading in themselves: the flag,
     not the cutscene, is the truth (a reload lands here too) */
  function cineOn(c, phase) {
    if (CINE) return;
    CINE = { c: c, phase: phase, room: null, lx: -1, ly: -1, moved: 0, replans: 0, until: 0, t0: 0 };
    document.body.classList.add('is-trip');
    letterbox(true);
    if (c.cine) c.cine(true);
    if (c.pace) c.pace(60, 150);   /* 60 px/s, up from rest in 0.4 s */
    if (talkOpen()) NEU.talk.close();
  }
  /* One decision per frame (requestAnimationFrame, so it stays in step with the engine).
     Each room plans its own cell path once and walks it axis by axis; two stumbles on the
     way; stuck for 1.5 s re-plans once, then hands control back (never a teleport). */
  function cineTick() {
    if (!CINE || CINE.phase !== 'walk') return;
    var c = CINE.c, room = NEU.engine.room, p = c.player, t, dx, dy, now = performance.now();
    if (!CINE.t0) CINE.t0 = now;
    if (now - CINE.t0 > 24000) { cineRelease(); return; }            /* watchdog */
    if (room !== CINE.room) { CINE.room = room; CINE.path = null; CINE.i = 0; CINE.moved = now; CINE.replans = 0; CINE.until = 0; }
    if (room !== 'h2_machine' && room !== 'h1_storm') {
      c.drive(0, 0);
      if (NEU.save && NEU.save.flagged('water_portal')) return;   /* water() owns the tail */
      requestAnimationFrame(cineTick); return;
    }
    if (now < CINE.until) { c.drive(0, 0); requestAnimationFrame(cineTick); return; }
    if (!CINE.path) {
      CINE.path = plan(c, Math.floor(p.x / 16), Math.floor((p.y - 1) / 16)) || [];
      CINE.i = 0; CINE.beats = [Math.floor(CINE.path.length / 3), Math.floor(CINE.path.length * 2 / 3)];
    }
    t = CINE.path[CINE.i];
    if (!t) {
      c.drive(0, room === 'h2_machine' ? 1 : 0);                    /* h2: on into the hatch; h1: the water */
      if (room === 'h1_storm') { water(c); return; }
    } else {
      dx = t[0] * 16 + 8 - p.x; dy = t[1] * 16 + 12 - p.y;
      if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) {
        CINE.i++;
        if (CINE.i === CINE.beats[0] || CINE.i === CINE.beats[1]) { CINE.until = now + 120; if (c.stumble) c.stumble(); }  /* "they are not fine" */
      } else if (Math.abs(dx) > Math.abs(dy)) c.drive(dx > 0 ? 1 : -1, 0);
      else c.drive(0, dy > 0 ? 1 : -1);
    }
    if (Math.abs(p.x - CINE.lx) + Math.abs(p.y - CINE.ly) >= 0.2 || now < CINE.until) CINE.moved = now;
    CINE.lx = p.x; CINE.ly = p.y;
    if (now - CINE.moved > 1500) {
      CINE.moved = now;
      if (CINE.replans++ < 1) CINE.path = null;
      else { cineRelease(); return; }
    }
    requestAnimationFrame(cineTick);
  }
  /* Control comes back only once the pot room has landed and settled. */
  function cineRelease() {
    var n = 0;
    (function poll() {
      n++;
      if ((NEU.engine.room === 'h3_trip' && n > 3) || n > 30) {
        if (CINE) CINE = null;
        letterbox(false);
        if (NEU.engine.api && NEU.engine.api.cine) NEU.engine.api.cine(false);
        return;
      }
      setTimeout(poll, 150);
    })();
  }
  /* The water inlet: a hop, a twelve-particle splash, portal rings and the
     player sinking — then the 400ms portal:water into h3. Nothing here is a
     flat freeze: each beat is a timer off the previous one's end. */
  var WSEQ = { phase: 'off', plan: null, origin: { x: 0, y: 0 } };
  NEU.tripWater = {
    state: function () { return { phase: WSEQ.phase, origin: WSEQ.origin }; },
    plan: function () { return WSEQ.plan || { jump: 350, rings: 500, sink: 300 }; }
  };
  function water(c) {
    if (!NEU.save || !NEU.save.flagged('tripping') || NEU.save.flagged('water_portal')) return;
    NEU.save.flag('water_portal', 1);
    cineOn(c, 'portal');
    CINE.c.drive(0, 0);
    CINE.phase = 'portal';
    var plan = reduced() ? { jump: 120, rings: 160, sink: 100 } : { jump: 350, rings: 500, sink: 300 };
    WSEQ.plan = plan; WSEQ.phase = 'jump';
    WSEQ.origin = { x: c.player.x, y: c.player.y };
    if (NEU.engineTrans && NEU.engineTrans.setOrigin) NEU.engineTrans.setOrigin(0.5, 0.68);
    if (NEU.juice && NEU.juice.hit) NEU.juice.hit('small');
    if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
    setTimeout(function () {
      WSEQ.phase = 'splash';
      if (NEU.juice && NEU.juice.hit) NEU.juice.hit('large', { colour: '#9FE0FF' });
      if (NEU.juice && NEU.juice.burst) {
        var dbg = NEU.engine.debug, q = c.player;
        NEU.juice.burst(Math.round((q.x - dbg.cam.x) * NEU.engine.SCALE), Math.round((q.y - dbg.cam.y) * NEU.engine.SCALE), 12, '#9FE0FF', 90);
      }
      WSEQ.phase = 'rings';
      setTimeout(function () {
        WSEQ.phase = 'sink';
        setTimeout(function () {
          WSEQ.phase = 'portal';
          if (NEU.engine.room === 'h1_storm') c.go('h3_trip', 'in', 'portal:water');
          setTimeout(cineRelease, 700);
        }, plan.sink);
      }, plan.rings);
    }, plan.jump);
  }

  function trip(c) {
    var n = 0;   /* let the VEND lines finish; the eat already played */
    (function waitTalk() {
      n++;
      if (talkOpen() && n < 40) { setTimeout(waitTalk, 150); return; }
      cineOn(c, 'walk'); cineTick();
    })();
  }

  /* ══ H3 — the hallucination ══════════════════════════════════════
     One urgent idea: SOUP. The pot is the only thing in focus: it sits
     on its fire in the middle of a floor that rings out from it like a
     dropped stone, ringed by mushrooms bigger than you. body.is-trip
     (style.css) still turns everything else — you, the rain, the
     portal; the room's own paint is pre-turned against that filter
     (look-prize.js) so its palette lands as drawn. The way back to the
     street is the portal in the east wall; `in` is one tile inside it. */
  E.register('h3_trip', {
    tileset: 'storm',
    tiles: rows([
      '#####################',
      '#####################',
      '#..o.............o..#',
      '#...................#',
      '#...................#',
      '#.........o.........#',
      '#...................#',
      '#...................#',
      '#..o.............o..#',
      '#####################'
    ]),
    spawns: { in: { x: 19, y: 5, face: 'left' } },
    entities: [
      { t: 'prizefloor', v: 'h3', x: 0, y: 0 },
      { t: 'save', x: 17, y: 7 },
      { t: 'prizenpc', v: 'pot', x: 10, y: 5, solid: true, colour: '#FF6BD6', pot: true,
        lines: ['a pot. an enormous pot. it is the only thing in focus.',
                'it wants mushroom soup. you are certain of this in a way you cannot defend.'],
        run: function (c) { pot(c); } },
      { t: 'exit', x: 20, y: 5, to: 'd1_street', spawn: 'portal', style: 'portal' },
      P('bigshroom', 3, 2, { k: 0, lines: ['a mushroom taller than you. its cap is a colour you have no name for.', 'it is pleased you came.'] }),
      P('bigshroom', 17, 2, { k: 1, lines: ['a second giant, leaning toward the pot.', 'the gills are a very soft pink.'] }),
      P('bigshroom', 3, 8, { k: 2, lines: ['this one has a face in the spores.', 'it does not blink.'] }),
      P('bigshroom', 17, 8, { k: 3, lines: ['the last giant, half in shadow.', 'it smells of rain, though there is no rain here.'] }),
      P('tinyshroom', 6, 3, { lines: ['a small mushroom. a spot of green on it, like a stain.'] }),
      P('tinyshroom', 14, 7, { k: 1, lines: ['another tiny one, growing out of a ring of darker soil.'] }),
      P('tinyshroom', 7, 7, { k: 2, lines: ['this one is bent toward the wall, as if listening.'] }),
      P('tinyshroom', 13, 3, { k: 3, lines: ['under its cap, a message in spore-print: nothing you can read.', 'you are certain it means something.'], secret: true }),
      P('spoon', 6, 5, { lines: ['a spoon, hanging in the air.', 'it points at the pot, the way a compass points north.'] }),
      P('spoon', 14, 5, { k: 1, lines: ['a second spoon. it is not reflecting you.'] })
    ],
    onEnter: function (c) {
      /* Soup made but not yet woken (a reload in the 3.2s window, or a
         room change before the timer ran): finish the wake here. The
         saved tripping flag is unreliable in exactly the reload case we
         are healing, so the quest mark — written by wake itself — is
         the alone source of truth. */
      if (c.flagged('soup_made') && NEU.quest && !NEU.quest.has('a4_wake') && NEU.act4) { NEU.act4.wake(); return; }
      if (c.flagged('h3_seen')) return;
      c.flag('h3_seen', 1);
      say(c, ['the colours have opinions now.',
              'you need five mushrooms. you know exactly where all five are.',
              'you also need something sharp, which you have never had.']);
    }
  });

  function pot(c) {
    if (c.flagged('soup_made')) {
      c.say(['the pot is empty and still warm.', 'you made the soup. it was your idea, apparently.'], 'narr');
      return;
    }
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
    if (NEU.quest) NEU.quest.mark('a4_pot');
    if (NEU.craft) NEU.craft.fromRoom(c);
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
    if (NEU.save.has(id)) { c.say(['already cut.'], 'mush'); return; }
    if (!NEU.save.flagged('tripping')) {
      c.say(['a mushroom. you have no reason to want it and nothing to cut it with.'], 'mush');
      return;
    }
    if (!NEU.save.has('axe')) {
      c.say(['a mushroom. you want it very badly. you have nothing sharp.'], 'mush');
      return;
    }
    var ents = (typeof c.ents === 'function') ? c.ents() : (c.ents || []);
    var e = ents.filter(function (x) { return x.mush === id; })[0];
    var n = mushrooms() + 1;
    var lines = n < 5 ? ['you take the mushroom. ' + n + ' of five.']
      : ['you take the mushroom. five of five.',
         'bring them to the pot. the street has a door that opens only while you are tripping; it goes to the pot.'];
    if (e) {
      /* The cut takes a beat: the mushroom squashes (engine-kinds reads
         e._cutAt for the pose), the axe lands, THEN NEU.take writes the
         gone flag, the pocket and the line. A second swing inside the
         beat is spent — the mushroom is already falling. */
      if (e._cutAt !== undefined) return;
      e._cutAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      var rid = NEU.engine.room, key = c.key('gone', e);
      setTimeout(function () {
        if (e.dead) return;
        var here = NEU.engine && NEU.engine.room;
        if (here === rid) {
          NEU.take(e, id, lines, 'mush', key);
        } else {
          /* walked out mid-swing: the mushroom is still yours — flag
             this room's copy gone and grant, or the cut would be lost
             and the room would hand you a second one. */
          e.dead = true;
          if (NEU.save) {
            NEU.save.give(id);
            NEU.save.flag(key, 1);
          }
          if (NEU.say) NEU.say(lines, 'mush');
        }
        if (NEU.quest) NEU.quest.bump('a4_mush', mushrooms());
      }, 700);
      return;
    }
    if (NEU.save) NEU.save.give(id);
    if (NEU.say) NEU.say(lines || ['* You got the ' + id.toUpperCase() + '.'], 'mush');
    if (NEU.quest) NEU.quest.bump('a4_mush', mushrooms());
  };

  NEU.act4RoomsG = ['g0_hall','h1_storm','h2_machine','h3_trip']
    .concat(PRIZES.map(function (_, n) { return 'g_' + n; }));
})();
