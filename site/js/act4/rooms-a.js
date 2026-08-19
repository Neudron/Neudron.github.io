/* rooms-a.js — the woods, and the castle.
   ───────────────────────────────────────────────────────────────────
   Zone A is four rooms of forest and Zone B is the castle behind it.
   All of it is data; the only code here is the handful of closures a
   room needs to know when it has been solved.

   WHAT MAKES THIS FUN, written down so it does not get optimised away
   by someone tidying later:

   1. THE PATH IS THE TUTORIAL. Room A1 has exactly one lit route
      through a black forest. You are never told to follow it. By A3
      you have learned that "lit ground is walkable" and the fork can
      therefore be read at a glance instead of by trial and error.

   2. THE WITCH LIES, AND THE ROOM TELLS YOU. She says "a small boss".
      The throne room is enormous and empty and there is a second
      throne. Nobody points at it. The reveal is not a twist if the
      evidence was never on screen; it is just a surprise, which is
      worse.

   3. EVERY PUZZLE TEACHES ITS OWN RULE, THEN BENDS IT. B2 teaches
      "push blocks onto plates". B3 teaches "order matters". B4 teaches
      "you cannot stop". B5 breaks the rule B2 taught: you need two
      plates held at once and there is one of you.

   4. NOTHING IS TIMED. Not one puzzle here needs reflexes. The fights
      are where reflexes live; these rooms are where thinking lives,
      and mixing them makes both worse.

   5. THE MUSHROOMS ARE PLANTED HOURS EARLY. Two of the five are in
      this zone, visible and unobtainable. When Zone H finally asks for
      them you should feel like you already knew where they were —
      because you did.                                                */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  if (!NEU.engine || !NEU.engine.register) return;

  var E = NEU.engine;

  /* ── tilesets ─────────────────────────────────────────────────────
     Palette only for now. Every colour here is from the site's own
     token set so the forest reads as this website's forest and not as
     a screenshot of a different game.
       #  tree/wall (solid)     .  dark ground
       ,  lit path              ~  undergrowth (solid)
       =  castle floor          |  pillar (solid)
       _  carpet                +  door frame (solid) */
  E.tileset('woods', {
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
    src: 'img/act4/tiles/woods.png',
    rects: { '#': [0, 0], '~': [16, 0], '.': [32, 0], ',': [48, 0], '=': [64, 0], '|': [80, 0], '_': [96, 0], '+': [112, 0] },
    solid: '#~|+',
    colours: { '#': '#0B0E14', '~': '#101725', '.': '#0D1119',
               ',': '#1C2333', '=': '#161320', '|': '#241d2e',
               '_': '#2A1E33', '+': '#3A3245' }
  });
  E.tileset('castle', {
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
    src: 'img/act4/tiles/castle.png',
    rects: { '#': [0, 0], '|': [16, 0], '.': [32, 0], ',': [48, 0], '=': [64, 0], '_': [80, 0], '+': [96, 0],
             'A': [112, 0] },
    solid: '#|+',
    colours: { '#': '#191426', '|': '#2A2238', '.': '#1A1726',
               ',': '#221D33', '=': '#231E33', '_': '#3A2140',
               '+': '#4A3255',
               /* 'A' is the altar plinth in b7. It is 2x2 in the grid but
                  the altar entity only covers one cell, so without its own
                  colour the other three cells fell through to the generic
                  floor and the plinth read as a hole in the floor. */
               'A': '#6A5C74' }
  });

  function say(c, l, w) { c.say(l, w || 'narr'); }

  /* ══ A1 — where you arrive ═══════════════════════════════════════
     Deliberately small and almost empty. One route out, lit. The
     first thing a player does in an unfamiliar space is look for the
     exit, and finding it immediately is what buys patience for A2. */
  E.register('a1_clearing', {
    tileset: 'woods',
    tiles: [
      '####################',
      '#~~~~~~~~~~~~~~~~~~#',
      '#~..............~~~#',
      '#~....,,,,,,....~~~#',
      '#~....,......,..~~~#',
      '#~....,......,..~~~#',
      '#~~~~~,~~~~~~,~~~~~#',
      '#~~~~~,~~~~~~,~~~~~#',
      '#.....,,,,,,,,.....#',
      '#..................#',
      '####################'
    ].join('\n'),
    spawns: { default: { x: 9, y: 4, face: 'down' }, north: { x: 9, y: 2 } },
    entities: [
      { t: 'save', x: 6, y: 3 },
      { t: 'npc', x: 12, y: 4, colour: '#4A4560',
        lines: ['a signpost. the writing has run.',
                'you can make out one word. "ahead".'] },
      { t: 'exit', x: 13, y: 8, to: 'a2_path', spawn: 'west' }
    ],
    onEnter: function (c) {
      if (c.flagged('a1_seen')) return;
      c.flag('a1_seen', 1);
      say(c, ['it is very dark, and the ground is very cold.',
              'somebody has lit a path. that was thoughtful of them.',
              'it only goes one way.']);
    }
  });

  /* ══ A2 — the long walk ══════════════════════════════════════════
     The first mushroom. You cannot take it and the game says why in
     one line, which is the entire setup for a payoff two hours away.

     THE TWO LIT PATHS MUST STAY JOINED AT BOTH ENDS. You arrive on the
     top path and the exit east is on the BOTTOM one, so the columns at
     x=1 and x=24 are the only reason this room can be finished at all.
     Without them row 5 is solid undergrowth from wall to wall, the two
     corridors never touch, and a player who walks east and presses e
     gets silence — which is what shipped first and what the
     reachability proof in fixes8 now exists to catch.

     One cell wide and lit, same as the descents in A1, because A1
     already taught "lit ground is walkable" and this room should not
     have to teach it twice. They sit hard against the walls on purpose:
     hold right until you stop and you are standing in the gap, so the
     turn costs no aiming. */
  E.register('a2_path', {
    tileset: 'woods',
    tiles: [
      '##########################',
      '#~~~~~~~~~~~~~~~~~~~~~~~~#',
      '#~~..~~~~..~~~~~~..~~~~~~#',
      '#,,,,,,,,,,,,,,,,,,,,,,,,#',
      '#,~..~~~~..~~~~..~~~~..~,#',
      '#,~~~~~~~~~~~~~~~~~~~~~~,#',
      '#,...~~~~....~~~~....~~~,#',
      '#,,,,,,,,,,,,,,,,,,,,,,,,#',
      '#~~~~~~~~~~~~~~~~~~~~~~~~#',
      '##########################'
    ].join('\n'),
    spawns: { west: { x: 1, y: 3, face: 'right' }, east: { x: 24, y: 7, face: 'left' } },
    entities: [
      { t: 'npc', x: 8, y: 6, colour: '#C4705F', mush: 'mush1', sheet: 'mushroom',
        run: function (c) { NEU.chop && NEU.chop(c, 'mush1'); } },
      { t: 'npc', x: 17, y: 2, colour: '#4A4560',
        lines: ['the trees here have no bark on the north side.',
                'there is no north here.'] },
      { t: 'exit', x: 25, y: 7, to: 'a3_fork', spawn: 'west' },
      { t: 'exit', x: 0, y: 3, to: 'a1_clearing', spawn: 'default' }
    ]
  });

  /* ══ A3 — the fork ═══════════════════════════════════════════════
     Left is the castle. Right is the altar room you cannot open yet,
     and it says so as a promise rather than a wall. The difference
     between "locked" and "not yet" is one line of dialogue and it is
     the difference between curiosity and annoyance. */
  E.register('a3_fork', {
    tileset: 'woods',
    tiles: [
      '######################',
      '#~~~~~~~~~~~~~~~~~~~~#',
      '#~~~~,,,,,,,,,,~~~~~~#',
      '#~~~~,~~~~~~~~,~~~~~~#',
      '#~~~~,~~~~~~~~,~~~~~~#',
      '#,,,,,~~~~~~~~,,,,,,,#',
      '#~~~~~~~~~~~~~~~~~~~~#',
      '#~~~~~~~~~~~~~~~~~~~~#',
      '######################'
    ].join('\n'),
    spawns: { west: { x: 1, y: 5, face: 'right' },
              castle: { x: 5, y: 2, face: 'down' },
              altar: { x: 20, y: 5, face: 'left' } },
    entities: [
      { t: 'save', x: 8, y: 2 },
      { t: 'exit', x: 5, y: 1, to: 'b1_throne', spawn: 'south' },
      { t: 'exit', x: 21, y: 5, to: 'b7_altar', spawn: 'east' },
      { t: 'exit', x: 0, y: 5, to: 'a2_path', spawn: 'east' },
      { t: 'npc', x: 14, y: 5, colour: '#8A8598',
        lines: ['two ways. the left one has been swept.',
                'the right one has not been swept in a long time.'] }
    ],
    onEnter: function (c) {
      if (c.flagged('a3_seen')) return;
      c.flag('a3_seen', 1);
      say(c, ['the path splits.',
              'one way is lit and looks expected of you.']);
    }
  });

  /* ══ B1 — the throne room ════════════════════════════════════════
     The lie is here, and so is the evidence against it. */
  E.register('b1_throne', {
    tileset: 'castle',
    tiles: [
      '######################',
      '#....................#',
      '#..||............||..#',
      '#..||....____....||..#',
      '#........____........#',
      '#..||....____....||..#',
      '#..||....____....||..#',
      '#....................#',
      '#........,,,,........#',
      '#........,,,,........#',
      '######################'
    ].join('\n'),
    spawns: { south: { x: 10, y: 9, face: 'up' }, north: { x: 10, y: 2 } },
    entities: [
      { t: 'exit', x: 10, y: 10, to: 'a3_fork', spawn: 'castle' },
      /* the second throne. never pointed at. */
      { t: 'npc', x: 13, y: 3, colour: '#3A2140',
        lines: ['a second throne, beside the first.',
                'the dust on it has been disturbed recently.'] },
      { t: 'npc', x: 9, y: 3, colour: '#C2405F', key: 'witch',
        lines: ['...'],
        run: function (c) { witchTalk(c); } },
      { t: 'exit', x: 20, y: 4, to: 'b2_blocks', spawn: 'west', locked: 'witch_met' }
    ],
    onEnter: function (c) {
      if (c.flagged('witch_met')) return;
      say(c, ['the room is much too big for one person.']);
    }
  });

  var witchLines = [
    ["oh good. someone came.", 'witch'],
    ["there is a thing in the back of my castle and it will not leave.", 'witch'],
    ["small. loud. very rude about it.", 'witch'],
    ["the rooms between here and there lock themselves. they are fond of that.", 'witch'],
    ["solve them and i will deal with the rest. go on.", 'witch']
  ];

  function witchTalk(c) {
    var n = NEU.save ? (NEU.save.flag('witch_talks') || 0) : 0;
    if (n >= witchLines.length) {
      c.say(["it is through there. i will wait here.", "i am very good at waiting."], 'witch');
      return;
    }
    c.say([witchLines[n][0]], 'witch');
    if (NEU.save) NEU.save.flag('witch_talks', n + 1);
    if (n + 1 >= witchLines.length) {
      c.flag('witch_met', 1);
      if (NEU.quest) NEU.quest.mark('a4_witch');
    }
  }

  /* ══ B2 — the riddle stones ══════════════════════════════════════
     Teaches the rule: read the room, press e on the thing you believe,
     and r if you are wrong — which is announced the first time you
     enter rather than hidden in a manual. There are no blocks here and
     never will be; every other room in the castle had one until this
     one taught the press and the reset. The answer is on the wall and
     the two wrong stones are not "the game is unfair", they are the
     lesson that a wrong press costs nothing but your time. */
  var b2picked = '';
  function pickStone(c, word) {
    if (b2picked) return;   /* one press per attempt; r to try again */
    b2picked = word;
    var es = c.ents();
    for (var i = 0; i < es.length; i++)
      if (es[i].t === 'npc' && es[i].stone)
        es[i].colour = es[i].stone === word ? '#E4C46A' : '#2A2A38';
    if (word === 'ash') {
      c.markSolved('b2_blocks');
      if (NEU.quest) NEU.quest.bump('a4_rooms', 1);
      if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick();
      c.say(['the ash stone sinks into the wall.',
             'the way east is open.']);
      return;
    }
    if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
    c.say(['the ' + word + ' stone stays exactly where it is.',
           'the door does not move. it is not a conversation.']);
  }

  E.register('b2_blocks', {
    tileset: 'castle',
    tiles: [
      '################',
      '#..............#',
      '#....######....#',
      '#..............#',
      '#.........,,,,,#',
      '#..............#',
      '#....######....#',
      '#..............#',
      '################'
    ].join('\n'),
    spawns: { west: { x: 2, y: 4, face: 'right' } },
    entities: [
      { t: 'npc', x: 6, y: 4, colour: '#564B66', solid: true, stone: 'friend',
        run: function (c) { pickStone(c, 'friend'); } },
      { t: 'npc', x: 8, y: 4, colour: '#564B66', solid: true, stone: 'ash',
        run: function (c) { pickStone(c, 'ash'); } },
      { t: 'npc', x: 10, y: 4, colour: '#564B66', solid: true, stone: 'please',
        run: function (c) { pickStone(c, 'please'); } },
      { t: 'npc', x: 13, y: 2, colour: '#4A4560',
        lines: ['a riddle, cut into the wall.',
                'i am what the fire leaves, what the bowl wants,',
                'and what her door is paid with. press the right stone.'] },
      { t: 'exit', x: 15, y: 4, to: 'b3_braziers', spawn: 'west', locked: 'solved:b2_blocks' },
      { t: 'exit', x: 0, y: 4, to: 'b1_throne', spawn: 'north' }
    ],
    onEnter: function (c) {
      if (c.flagged('b2_seen')) return;
      c.flag('b2_seen', 1);
      say(c, ['the way east is a wall of three loose stones.',
              'each one has a word. one of them is the word.',
              'read the riddle. press e on the stone you believe.',
              'press r if you make a mess of it. the room does not mind.']);
    },
    onReset: function () { b2picked = ''; }
  });

  /* ══ B3 — the braziers ═══════════════════════════════════════════
     Order matters. The order is shown once, on entry, and can be
     asked for again — hiding it behind a single unrepeatable viewing
     is not difficulty, it is a memory test with no retry. */
  var B3_ORDER = [2, 0, 3, 1];

  E.register('b3_braziers', {
    tileset: 'castle',
    tiles: [
      '##################',
      '#................#',
      '#................#',
      '#..#..#..#..#....#',
      '#................#',
      '#..........,,,,,,#',
      '#................#',
      '#................#',
      '##################'
    ].join('\n'),
    spawns: { west: { x: 1, y: 5, face: 'right' } },
    entities: [
      { t: 'brazier', x: 3, y: 4, n: 0, run: function (c) { light(c, 0); } },
      { t: 'brazier', x: 6, y: 4, n: 1, run: function (c) { light(c, 1); } },
      { t: 'brazier', x: 9, y: 4, n: 2, run: function (c) { light(c, 2); } },
      { t: 'brazier', x: 12, y: 4, n: 3, run: function (c) { light(c, 3); } },
      { t: 'npc', x: 15, y: 2, colour: '#4A4560',
        lines: ['a plaque. four notches, worn in a particular order.',
                'third. first. fourth. second.'] },
      { t: 'exit', x: 17, y: 5, to: 'b4_ice', spawn: 'west', locked: 'solved:b3_braziers' },
      { t: 'exit', x: 0, y: 5, to: 'b2_blocks', spawn: 'west' }
    ],
    onEnter: function (c) {
      b3seq = [];
      if (c.flagged('b3_seen')) return;
      c.flag('b3_seen', 1);
      say(c, ['four braziers, all cold.',
              'there is a plaque on the east wall. it is worth reading.']);
    },
    onReset: function () { b3seq = []; }
  });

  var b3seq = [];
  function light(c, n) {
    var es = c.ents();
    var b = null;
    for (var i = 0; i < es.length; i++) if (es[i].t === 'brazier' && es[i].n === n) b = es[i];
    if (!b || b.lit) return;
    b.lit = true;
    b3seq.push(n);
    if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick();
    var k = b3seq.length - 1;
    if (b3seq[k] !== B3_ORDER[k]) {
      /* Wrong. Everything goes out. Told plainly — a silent reset here
         reads as the game not registering the press. */
      for (var j = 0; j < es.length; j++) if (es[j].t === 'brazier') es[j].lit = false;
      b3seq = [];
      c.say(['they all go out at once.', 'third. first. fourth. second.'], 'narr');
      if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
      return;
    }
    if (b3seq.length === B3_ORDER.length) {
      c.markSolved('b3_braziers');
      if (NEU.quest) NEU.quest.bump('a4_rooms', 2);
      c.say(['all four hold.', 'the east wall opens.'], 'narr');
    }
  }

  /* ══ B4 — the ice ring ═══════════════════════════════════════════
     The floor teaches the slide: step onto ice and you commit to that
     line of travel until the ice runs out — no turning, no stopping,
     no walking across a corner. Three plates sit on the last ice cell
     of three different slide lines, and a plate only locks when a
     slide dies on it (slideOnly). Walking up to one is the wrong move
     by design; the whole room is about reading the lines the ice
     gives you.

     Solvable in three slides, no brute force:
       1. walk up to (1,2), step east onto (3,2) → slide east along the
          top row, which dies on its last ice cell (11,2) → plate locks.
       2. step south: the ice underfoot commits you again → slide down
          the east column, dying on (11,7) → plate locks.
       3. step west → slide along the bottom row, dying on (3,7)
          → plate locks. The way opens.
     The puzzle is not "find the plates", it is "understand that the
     ice decides where you stop". The old version was a block-push
     with the block born on the ice; that read as a physics quirk and
     was retired with the rest of the castle's blocks. */
  E.register('b4_ice', {
    tileset: 'castle',
    tiles: [
      '################',
      '#..............#',
      '#..iiiiiiiii...#',
      '#..i.......i...#',
      '#..i...#...i...#',
      '#..i.......i,,,#',
      '#..i.......i...#',
      '#..iiiiiiiii...#',
      '#..............#',
      '################'
    ].join('\n'),
    spawns: { west: { x: 1, y: 5, face: 'right' } },
    entities: [
      { t: 'plate', x: 11, y: 2, slideOnly: true },
      { t: 'plate', x: 11, y: 7, slideOnly: true },
      { t: 'plate', x: 3, y: 7, slideOnly: true },
      { t: 'exit', x: 14, y: 5, to: 'b5_two', spawn: 'west', locked: 'solved:b4_ice' },
      { t: 'exit', x: 0, y: 5, to: 'b3_braziers', spawn: 'west' }
    ],
    onEnter: function (c) {
      if (c.flagged('b4_seen')) return;
      c.flag('b4_seen', 1);
      say(c, ['the middle of the room is polished to a mirror.',
              'step onto the ice and you will not stop until the ice runs out.',
              'three plates. they lock only when a slide lands on them.']);
    },
    /* The engine's default "every plate has a block" rule cannot know
       about slides, so this room owns its win condition: all three
       slide-only plates must be armed. */
    solved: function (c) {
      var es = c.ents(), any = false;
      for (var i = 0; i < es.length; i++)
        if (es[i].t === 'plate') { any = true; if (!es[i].armed) return false; }
      return any;
    },
    onSolved: function (c) {
      c.markSolved('b4_ice');
      if (NEU.quest) NEU.quest.bump('a4_rooms', 3);
      say(c, ['the third plate locks with a heavy clunk.',
              'the east wall slides open.']);
    }
  });

  /* ══ B5 — two plates, one of you ════════════════════════════════
     Teaches that not every press is a push. The mirror holds the
     second plate: stand in front of it, press e, and it turns to
     face one plate or the other. The room only answers when you
     stand where the mirror is looking — you hold one plate, the
     mirror's gaze holds the other. It is nonsense and the room knows
     it is nonsense, which is why it works: the castle locks its own
     doors for fun. The old version used a push block; the block is
     gone with the rest of them, and the mirror carries the whole
     room now. */
  var b5face = 0;   /* 0 = turned away, 1 = looks at the east plate, 2 = looks at the west plate */
  function mirrorTurn(c) {
    b5face = (b5face + 1) % 3;
    if (b5face === 0) c.say(['the mirror turns away from the room.'], 'narr');
    else if (b5face === 1) c.say(['the mirror looks east. whatever stands over the east plate stands on the west one too.'], 'narr');
    else c.say(['the mirror looks west. whatever stands over the west plate stands on the east one too.'], 'narr');
    if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick();
  }
  E.register('b5_two', {
    tileset: 'castle',
    tiles: [
      '##################',
      '#.....MMMM.......#',
      '#................#',
      '#................#',
      '#....P......P....#',
      '#..........,,,,,,#',
      '#................#',
      '##################'
    ].join('\n'),
    spawns: { west: { x: 1, y: 5, face: 'right' } },
    entities: [
      { t: 'plate', x: 5, y: 4, id: 'L' },
      { t: 'plate', x: 12, y: 4, id: 'R' },
      { t: 'npc', x: 7, y: 1, colour: '#8A8598', mirror: true,
        run: function (c) { mirrorTurn(c); } },
      { t: 'exit', x: 17, y: 5, to: 'b6_dark', spawn: 'west', locked: 'solved:b5_two' },
      { t: 'exit', x: 0, y: 5, to: 'b4_ice', spawn: 'west' }
    ],
    /* One plate under the mirror's gaze, and you standing on the
       other. The mirror turns with e; the room counts what it looks
       at as held. */
    solved: function (c) {
      if (!b5face) return false;
      var p = c.player;
      var cx = Math.floor(p.x / 16), cy = Math.floor((p.y - 1) / 16);
      var onL = (cx === 5 && cy === 4), onR = (cx === 12 && cy === 4);
      return (b5face === 1 && onR) || (b5face === 2 && onL);
    },
    onEnter: function (c) {
      if (c.flagged('b5_seen')) return;
      c.flag('b5_seen', 1);
      say(c, ['two plates. there is nobody to hold the second one.',
              'the mirror on the north wall has opinions. press e on it.']);
    },
    onSolved: function (c) {
      c.markSolved('b5_two');
      if (NEU.quest) NEU.quest.bump('a4_rooms', 4);
      say(c, ['the plate under you sinks.', 'the mirror holds the other one.',
              'the door opens anyway.']);
    },
    onReset: function () { b5face = 0; }
  });

/* ══ B6 — the torch ═════════════════════════════════════════════
     A callback, not a reskin: the torch from the blackout, in a room
     that is about remembering a shape rather than finding a door.

     The dark is a function, not a number: the room answers the
     darkness every frame, and the answer changes the moment the
     torch is seated. While you carry the torch the light follows you
     through the room (the engine's `light` hook) — the dark stops
     being a wall the moment the light comes with you, which is the
     whole lesson. Take it at (2,5), put it in the socket at (10,5),
     and the lights come back. The four blind alcoves are untouched —
     they are the shape you are meant to remember. */
  var b6carry = false, b6lit = false;
  function takeTorch(c) {
    if (b6carry) { c.say(['you already have it.'], 'narr'); return; }
    b6carry = true;
    /* the torch leaves the wall when it leaves the room with you —
       it was solid so it could be found by touch in the dark */
    var es = c.ents();
    for (var i = 0; i < es.length; i++)
      if (es[i].torch) es[i].dead = true;
    if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick();
    c.say(['you take the torch. the light walks with you.'], 'narr');
  }
  function placeTorch(c) {
    if (!b6carry) { c.say(['a socket in the wall, empty.', 'it is waiting for a light.'], 'narr'); return; }
    b6carry = false; b6lit = true;
    c.markSolved('b6_dark');
    if (NEU.quest) NEU.quest.bump('a4_rooms', 5);
    if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick();
    c.say(['it fits. light pours back into the room.'], 'narr');
  }
  E.register('b6_dark', {
    tileset: 'castle',
    tiles: [
      '####################',
      '#..................#',
      '#.####.######.####.#',
      '#.#..#.#....#.#..#.#',
      '#.#..#.#....#.#..#.#',
      '#................,,#',
      '#.#..#.#....#.#..#.#',
      '#.####.######.####.#',
      '#..................#',
      '####################'
    ].join('\n'),
    spawns: { west: { x: 1, y: 5, face: 'right' } },
    entities: [
      { t: 'npc', x: 2, y: 5, colour: '#E4A64A', solid: true, torch: true,
        run: function (c) { takeTorch(c); } },
      { t: 'npc', x: 10, y: 5, colour: '#5A5470', socket: true,
        run: function (c) { placeTorch(c); } },
      { t: 'exit', x: 19, y: 5, to: 'b7_altar', spawn: 'north', locked: 'solved:b6_dark' },
      { t: 'exit', x: 0, y: 5, to: 'b5_two', spawn: 'west' }
    ],
    onEnter: function (c) {
      if (c.flagged('b6_seen')) return;
      c.flag('b6_seen', 1);
      say(c, ['the lights here have been out for some time.',
              'you have done this before.']);
    },
    dark: function () { return b6lit ? 0 : 108; },
    light: function (c) { return b6carry ? { x: c.player.x, y: c.player.y } : null; },
    onReset: function () { b6carry = false; b6lit = false; }
  });

  /* ══ B7 — the altar ══════════════════════════════════════════════
     Reachable from the fork long before it is useful. Going out of
     your way early and being told "not yet, and here is exactly what
     it wants" is how a player builds a mental map. */
  E.register('b7_altar', {
    tileset: 'castle',
    tiles: [
      '################',
      '#..............#',
      '#....######....#',
      '#....#....#....#',
      '#....#.AA.#....#',
      '#,,,,..AA.,,,,,#',
      '#....#....#....#',
      '#....######....#',
      '#..............#',
      '################'
    ].join('\n'),
    spawns: { east: { x: 14, y: 5, face: 'left' }, north: { x: 1, y: 5, face: 'right' } },
    entities: [
      { t: 'save', x: 3, y: 2 },
      { t: 'altar', x: 8, y: 4, needs: 'ashes', gives: 'firedoor',
        empty: ['a stone bowl on a stone plinth.',
                'there is a ring of ash in it that has been there long enough to be part of the stone.',
                'it wants more. it is fairly clear about that.'],
        lines: ['you tip the ashes in.',
                'the bowl takes them without a sound, which is worse than a sound.',
                'a door opens in the east wall. it is on fire. it does not seem bothered.'] },
      { t: 'npc', x: 12, y: 3, colour: '#C4705F', mush: 'mush2', sheet: 'mushroom',
        run: function (c) { NEU.chop && NEU.chop(c, 'mush2'); } },
      { t: 'exit', x: 15, y: 5, to: 'a3_fork', spawn: 'altar' },
      { t: 'exit', x: 0, y: 5, to: 'b8_arena', spawn: 'west', locked: 'solved:b6_dark' },
      /* The fire door. It does not exist until the ashes go in, and it
         is drawn burning so it cannot be mistaken for the other two
         exits in a room that already has two exits. */
      { t: 'exit', x: 8, y: 8, to: 'd1_street', spawn: 'fire', locked: 'firedoor',
        sheet: 'firedoor',
        lines: ['the east wall is a wall.'] }
    ]
  });

  /* ══ B8 — the door at the back ═══════════════════════════════════
     A point of no return that says so, and lets you leave. Warning
     someone and then not honouring the warning is worse than no
     warning at all. */
  E.register('b8_arena', {
    tileset: 'castle',
    tiles: [
      '##############',
      '#............#',
      '#....++++....#',
      '#....+..+....#',
      '#,,,,+..+....#',
      '#....++++....#',
      '#............#',
      '##############'
    ].join('\n'),
    spawns: { west: { x: 1, y: 4, face: 'right' } },
    entities: [
      { t: 'save', x: 3, y: 6 },
      /* ON the doorframe at (5,4), where the swept corridor runs into it.
         This sat at (6,3), inside the 2x2 the frame encloses, and the
         frame is solid: there was no cell in the room you could stand in
         and still be within REACH of it, so the fight could not be
         started. Everything downstream of her — the ashes, the altar,
         the fire door, every zone after the castle — was unreachable
         because of one entity two cells too far in. It is the door
         itself now, which is also what the room has been calling it. */
      { t: 'npc', x: 5, y: 4, colour: '#C2405F', run: function (c) { enterArena(c); } },
      { t: 'exit', x: 0, y: 4, to: 'b7_altar', spawn: 'north' }
    ],
    onEnter: function (c) {
      say(c, ['a door with nothing written on it.',
              'whatever has been making the noise is on the other side.',
              'you can still go back. the save point is right there.']);
    }
  });

  function enterArena(c) {
    if (NEU.scal && NEU.scal.open) { c.leave(); setTimeout(function () { NEU.scal.open(); }, 320); }
    else c.say(['it will not open yet.'], 'narr');
  }

  /* Locked exits: an exit with `locked` refuses until the flag is set,
     and says which room it is waiting on rather than nothing. */
  NEU.act4Rooms = ['a1_clearing','a2_path','a3_fork','b1_throne','b2_blocks',
                   'b3_braziers','b4_ice','b5_two','b6_dark','b7_altar','b8_arena'];
})();
