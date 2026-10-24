/* quiz.js — TV TIME. Tenna's game show, and the ranking.
   ───────────────────────────────────────────────────────────────────
   You break the television with a sword and a game show falls out.

   RULES THAT MAKE A QUIZ NOT-TEDIOUS:

   1. THE THRESHOLDS ARE PUBLISHED BEFORE THE FIRST QUESTION. A rank
      you cannot predict is a rank you did not earn. The board is on
      screen the whole time.

   2. THE TIMER IS GENEROUS AND VISIBLE, AND RUNNING OUT IS JUST A
      WRONG ANSWER. Twelve seconds is enough to read four options and
      still feel hurried. A timer that eliminates you turns knowledge
      into reflexes.

   3. YOU ARE TOLD THE ANSWER IMMEDIATELY, EVERY TIME. Twenty questions
      with the results at the end is an exam. Twenty questions with an
      instant reveal is a game show, and the difference is entirely in
      the pacing.

   4. FOUR CATEGORIES ROTATE. Five in a row about Terraria makes the
      whole thing feel like one long question.

   5. NOTHING IS UNWINNABLE AND NOTHING IS FREE. Z still opens a room.
      Every rank opens its own room and all the ones below it, so a bad
      run is a smaller reward rather than no reward — which is what
      makes a second attempt appealing instead of obligatory.

   6. THE SHOW ENDS ON SCREEN, AND THEN IT TAKES YOU SOMEWHERE. The last
      answer used to be followed by a text panel and a countdown, which
      read as "nothing happened". The finale is now a sequence that plays
      by itself: the score counts up, the rank stamps down, the doors it
      opened light up on the board, Tenna bows, the television switches
      off like a CRT, and the prize corridor irises open behind it. Any
      key, click or tap skips straight to the switch-off; nothing waits
      for input.

   THE ONE TIMELINE. Every delay in the show goes through later(), which
   belongs to a numbered run. begin() and close() start a new run, so a
   callback queued by an old run finds its number stale and does
   nothing. No beat of a finished show can fire into a new one, and none
   can fire into a closed overlay. That is the whole class of bug the
   soft-lock at the end of the show came from.                        */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};

  var wrap = document.getElementById('quiz');
  if (!wrap) { NEU.quiz = { open: function () {} }; return; }
  function $(id) { return document.getElementById(id); }
  var elQ    = $('quizQ');
  var elCat  = $('quizCat');
  var elNum  = $('quizNum');
  var elOpts = $('quizOpts');
  var elBar  = $('quizBar');
  var elSay  = $('quizSay');
  var elEnd  = $('quizEnd');
  var elQuit = $('quizQuit');
  var beams  = wrap.querySelectorAll('.quiz__beam');
  function lights(on) { for (var k = 0; k < beams.length; k++) beams[k].hidden = !on; }

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── the questions ──────────────────────────────────────────────
     Four per game, rotating, so no two consecutive questions share a
     category. `a` is the index of the correct option. */
  var Q = [
    ['UNDERTALE', 'What does the "ACT" button let you do?',
      ['Attack twice', 'Interact non-violently', 'Flee the battle', 'Use an item'], 1],
    ['TERRARIA', 'Which boss must be defeated to enter Hardmode?',
      ['Skeletron', 'The Twins', 'Wall of Flesh', 'Plantera'], 2],
    ['MINECRAFT', 'How many blocks of obsidian does a Nether portal need at minimum?',
      ['8', '10', '12', '14'], 1],
    ['ISAAC', 'What does picking up "The D6" let you do?',
      ['Reroll items', 'Reroll the room', 'Double your damage', 'Skip a floor'], 0],
    ['VALORANT', 'How many players are on each team in standard play?',
      ['4', '5', '6', '7'], 1],

    ['UNDERTALE', 'What colour is the soul you play as?',
      ['Blue', 'Green', 'Red', 'Yellow'], 2],
    ['TERRARIA', 'What does a Recall Potion do?',
      ['Refills health', 'Teleports you home', 'Reveals the map', 'Summons a boss'], 1],
    ['MINECRAFT', 'What is the maximum level for a standard enchantment table?',
      ['20', '30', '40', '50'], 1],
    ['ISAAC', 'What is the currency used in the shop?',
      ['Keys', 'Bombs', 'Coins', 'Souls'], 2],
    ['VALORANT', 'What is the in-game currency for buying weapons each round?',
      ['Credits', 'Points', 'Radianite', 'Chips'], 0],

    ['UNDERTALE', 'Which character sells hot dogs?',
      ['Papyrus', 'Sans', 'Undyne', 'Alphys'], 1],
    ['TERRARIA', 'Which NPC moves in when you have a house and 50 silver?',
      ['Nurse', 'Guide', 'Merchant', 'Dryad'], 2],
    ['MINECRAFT', 'What do you get when you mine a diamond ore with a stone pickaxe?',
      ['A diamond', 'Nothing', 'Cobblestone', 'Coal'], 1],
    ['ISAAC', 'Beating which boss first unlocks the Cathedral path?',
      ['Mom', "Mom's Heart", 'Satan', 'Isaac'], 1],
    ['VALORANT', 'How many rounds are needed to win a standard match?',
      ['11', '12', '13', '16'], 2],

    ['UNDERTALE', 'What is the name of the first flower you meet?',
      ['Flowey', 'Asriel', 'Chara', 'Toriel'], 0],
    ['TERRARIA', 'What material is needed to craft a Nurse-summoning house? (trick)',
      ['There is no such item', 'Silver', 'Gold', 'Demonite'], 0],
    ['MINECRAFT', 'Which mob explodes?',
      ['Zombie', 'Creeper', 'Skeleton', 'Enderman'], 1],
    ['ISAAC', 'How many hearts does Isaac start with?',
      ['2', '3', '4', '6'], 1],
    ['VALORANT', 'Which agent is a duelist known for flames?',
      ['Sage', 'Phoenix', 'Cypher', 'Omen'], 1]
  ];

  /* ── the board ──────────────────────────────────────────────────*/
  var RANKS = [
    ['T', 20], ['S', 18], ['A', 16], ['A–', 14], ['B', 12],
    ['B–', 10], ['C', 7], ['C–', 4], ['Z', 0]
  ];
  function rankFor(score) {
    for (var i = 0; i < RANKS.length; i++) if (score >= RANKS[i][1]) return RANKS[i][0];
    return 'Z';
  }
  /* Ranks are cumulative: holding A opens A and everything under it. */
  function opens(rank) {
    var out = [], hit = false;
    for (var i = 0; i < RANKS.length; i++) {
      if (RANKS[i][0] === rank) hit = true;
      if (hit) out.push(RANKS[i][0]);
    }
    return out;
  }

  /* How long a question gives you. Twelve is the limit the header was
     written for. The relaxed switch in settings.js doubles it for a
     player who needs longer to read four options. It is read when a
     question starts, and the question keeps the number it started
     with (span below), so a switch thrown mid-question cannot leave
     the bar and the clock disagreeing about that question. */
  function limit() {
    var s = NEU.settings;
    return s && s.relaxedQuiz ? 24 : 12;
  }
  var span = 12;
  var i = 0, score = 0, t = 0, tick = null, locked = false, open_ = false;
  /* Where the show is: idle | intro | ask | reveal | dodge | shoot |
     round3 | finale | off. `ended` is true from the finale on; the
     shoot phase and Tenna's faux Round 3 both run with i at 20, so
     "i ran past the last question" is not the same thing. */
  var state = 'idle', ended = false, leaving = false;
  var runRank = 'Z', bestRank = 'Z';
  /* Dev/test only. The pacing between questions is most of what makes
     this feel like a game show, so it cannot be tuned down for real
     players — but a test that has to sit through twenty 1.5-second
     reveals is a test nobody runs. */
  var fast = false;
  function pace(ms) { return fast ? 0 : (reduced ? Math.min(ms, 400) : ms); }

  /* ── the one timeline ───────────────────────────────────────────*/
  var run = 0, timers = [];
  function later(fn, ms) {
    var r = run;
    var id = setTimeout(function () {
      var k = timers.indexOf(id);
      if (k >= 0) timers.splice(k, 1);
      if (r === run && open_) fn();
    }, pace(ms));
    timers.push(id);
    return id;
  }
  function stopTimers() {
    clearInterval(tick); tick = null;
    for (var k = 0; k < timers.length; k++) clearTimeout(timers[k]);
    timers = [];
  }

  /* Tenna is a character, not a text box. Every line he says is
     keyed to a moment in the show. His voice, from the wiki:
     desperate, needy, takes the ranking personally, insults
     Spamton (BAD CAR! SMALL NOSE!), and talks to the audience.
     COWABUNGA-DERO is his catchphrase. */
  var TENNA = {
    intro: [
      "WELCOME! YES! TO THE SHOW! i am TENNA and this is TV TIME!",
      "twenty questions. four buttons. one of you. COWABUNGA-DERO!",
      "the board is right there. i am not hiding it. i would NEVER."
    ],
    right: [
      "CORRECT! the audience loves you.",
      "YES! that is the smooth taste of TV TIME!",
      "obviously. obviously correct.",
      "you knew that one. i saw you know it."
    ],
    wrong: [
      "NO! it was ",
      "WRONG! the answer was "
    ],
    slow: "TOO SLOW! the answer was ",
    finish: "AND THAT IS THE SHOW! COWABUNGA-DERO!",
    /* His reaction to the final rank. Takes it personally. */
    rank: {
      'T': 'T! ULTIMATE! i... i have nothing bad to say.',
      'S': 'S! PERFECT! okay. okay. that is fine.',
      'A': 'A! AWESOME! ...for now.',
      'A–': 'A! well. almost awesome.',
      'B': 'B! NOT BAD! which is the worst thing you can be.',
      'B–': 'B! not bad. not good either. just... there.',
      'C': 'C! KINDA SLOW! like a certain salesman i know.',
      'C–': 'C! you are testing my patience. and my show.',
      'Z': 'Z! VERY SLOW! BAD CAR! SMALL NOSE! ...SALESMAN.'
    },
    prizes: "and now... TO THE PRIZES! the tv is always on. come back any time!"
  };
  /* How he takes each rank: a pose and a face on his screen. */
  var TAKES = {
    'T': ['cheer', 'stars'], 'S': ['cheer', 'stars'],
    'A': ['point', 'happy'], 'A–': ['point', 'happy'],
    'B': ['shrug', 'smug'],  'B–': ['shrug', 'smug'],
    'C': ['shrug', 'sad'],   'C–': ['shrug', 'sad'],
    'Z': ['shock', 'shock']
  };

  /* ── Tenna, drawn ───────────────────────────────────────────────
     The two wiki crops in img/act4/deltarune are cut off at the neck
     and carry the wiki's own backgrounds, so he is drawn here instead:
     a 48 x 80 sprite on the page's pixel grid, scaled up whole by CSS.
     A television for a head, a red tuxedo, white gloves, yellow shoes.
     His face is on the screen, so it changes with the show.

     Every shape is drawn twice. Pass 0 paints it one pixel larger in
     ink, pass 1 paints it in colour, so the whole figure gets a clean
     outline without an outline being drawn for each part. */
  var tcv = $('quizTenna');
  var tg = tcv && tcv.getContext ? tcv.getContext('2d') : null;
  var INK = '#12081E';
  var PAL = {
    tv: '#3A3550', tvHi: '#5D5684', tvLo: '#262038', scr: '#0B1630', scan: '#0F1E3E',
    glow: '#9FF0FF', dim: '#3E8FB0', ant: '#8A8598',
    red: '#C8203A', redHi: '#FF4D6A', white: '#F4F0FF', gold: '#FFD34E', goldLo: '#C8901E',
    black: '#1A1426', blackHi: '#3A3252', tear: '#4FC3F7'
  };
  /* shoulder, elbow, hand: left arm then right arm, per pose */
  var ARMS = {
    idle:  [12, 38, 10, 45, 10, 52,  36, 38, 38, 45, 38, 52],
    point: [12, 38, 10, 45, 10, 52,  36, 38, 41, 34, 45, 30],
    cheer: [12, 38,  7, 31,  6, 22,  36, 38, 41, 31, 42, 22],
    shrug: [12, 38,  5, 42,  4, 35,  36, 38, 43, 42, 44, 35],
    shock: [12, 38,  6, 34,  8, 25,  36, 38, 42, 34, 40, 25],
    bow:   [12, 41, 15, 48, 21, 51,  36, 41, 33, 48, 27, 51]
  };
  var look = { pose: 'idle', face: 'grin' };
  function pose(p, f) { look.pose = p; if (f) look.face = f; }

  var pass = 1;
  function R(x, y, w, h, c) {
    if (!pass) { tg.fillRect(x - 1, y - 1, w + 2, h + 2); return; }
    tg.fillStyle = c; tg.fillRect(x, y, w, h);
  }
  function seg(x0, y0, x1, y1, c) {
    var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (var k = 0; k <= n; k++) {
      R(Math.round(x0 + (x1 - x0) * k / n) - 1, Math.round(y0 + (y1 - y0) * k / n) - 1, 3, 3, c);
    }
  }
  /* face pixels: colour only, inside the screen */
  function F(x, y, w, h, c) { tg.fillStyle = c || PAL.glow; tg.fillRect(x, y, w, h); }
  function ring(x, y, w, h) { F(x, y, w, 1); F(x, y + h - 1, w, 1); F(x, y, 1, h); F(x + w - 1, y, 1, h); }
  function star(x, y) { F(x - 2, y, 5, 1, PAL.gold); F(x, y - 2, 1, 5, PAL.gold); F(x - 1, y - 1, 3, 3, PAL.gold); }

  function drawFace(f, x, y, clock) {
    /* the screen is 20 x 16; eyes at x+4 and x+14, mouth across x+4..15 */
    F(x, y, 20, 16, PAL.scr);
    for (var k = 0; k < 16; k += 2) F(x, y + k, 20, 1, PAL.scan);
    if (f === 'off') return;
    if (f === 'static') {
      for (k = 0; k < 70; k++) {
        F(x + ((Math.random() * 20) | 0), y + ((Math.random() * 16) | 0), 1, 1,
          Math.random() < 0.5 ? PAL.glow : PAL.dim);
      }
      return;
    }
    var a = x + 4, b = x + 14, ey = y + 4, my = y + 11;
    var blink = !reduced && clock % 3.7 < 0.12 && (f === 'grin' || f === 'smug' || f === 'wink');
    if (blink)                { F(a - 1, ey + 2, 4, 1); F(b - 1, ey + 2, 4, 1); }
    else if (f === 'stars')   { star(a + 1, ey + 2); star(b + 1, ey + 2); }
    else if (f === 'shock')   { ring(a - 1, ey - 1, 4, 5); ring(b - 1, ey - 1, 4, 5); }
    else if (f === 'happy')   { F(a - 1, ey + 2, 1, 1); F(a, ey + 1, 2, 1); F(a + 2, ey + 2, 1, 1);
                                F(b - 1, ey + 2, 1, 1); F(b, ey + 1, 2, 1); F(b + 2, ey + 2, 1, 1); }
    else if (f === 'smug')    { F(a - 1, ey + 2, 4, 1); F(b - 1, ey + 2, 4, 1);
                                F(a, ey + 3, 2, 1, PAL.dim); F(b, ey + 3, 2, 1, PAL.dim); }
    else if (f === 'sad')     { F(a - 1, ey + 1, 1, 1); F(a, ey + 2, 3, 1); F(b + 2, ey + 1, 1, 1);
                                F(b - 1, ey + 2, 3, 1); F(a - 1, ey + 4, 1, 2, PAL.tear); }
    else if (f === 'wink')    { F(a - 1, ey + 2, 4, 1); F(b, ey, 2, 4); }
    else                      { F(a, ey, 2, 4); F(b, ey, 2, 4); }
    if (f === 'shock')        ring(x + 8, my - 2, 4, 4);
    else if (f === 'sad')     { F(x + 5, my + 1, 10, 1); F(x + 4, my + 2, 1, 1); F(x + 15, my + 2, 1, 1); }
    else if (f === 'smug')    { F(x + 7, my, 7, 1); F(x + 14, my - 1, 2, 1); }
    else if (f === 'happy' || f === 'stars') { F(x + 4, my - 1, 12, 2); F(x + 6, my + 1, 8, 1, PAL.dim); }
    else                      { F(x + 4, my, 12, 1); F(x + 3, my - 1, 1, 1); F(x + 16, my - 1, 1, 1);
                                F(x + 5, my + 1, 10, 1, PAL.dim); }
  }

  function drawTenna(clock) {
    if (!tg) return;
    tg.clearRect(0, 0, 48, 80);
    var p = look.pose, a = ARMS[p] || ARMS.idle;
    /* a one-pixel bob, two when he is cheering; nothing under reduced motion */
    var by = reduced ? 0 : (p === 'cheer' ? (Math.floor(clock * 6) % 2) * 2 : Math.floor(clock * 2.5) % 2);
    var hy = by + (p === 'bow' ? 6 : 0);
    var wig = reduced ? 0 : Math.round(Math.sin(clock * 5));
    var droop = p === 'bow' ? 3 : 0;
    for (pass = 0; pass < 2; pass++) {
      if (!pass) tg.fillStyle = INK;
      /* legs and shoes stay planted */
      R(17, 56, 6, 16, PAL.black); R(26, 56, 6, 16, PAL.black);
      R(13, 71, 10, 4, PAL.gold);  R(26, 71, 10, 4, PAL.gold);
      /* the jacket, its tails, the shirt and the bow tie */
      R(13, 36 + by, 23, 21, PAL.red); R(11, 37 + by, 27, 4, PAL.red);
      R(13, 56, 4, 3, PAL.red); R(32, 56, 4, 3, PAL.red);
      /* the arms, then the gloves */
      seg(a[0], a[1] + by, a[2], a[3] + by, PAL.red);  seg(a[2], a[3] + by, a[4], a[5] + by, PAL.red);
      seg(a[6], a[7] + by, a[8], a[9] + by, PAL.red);  seg(a[8], a[9] + by, a[10], a[11] + by, PAL.red);
      R(a[4] - 2, a[5] + by - 2, 5, 5, PAL.white);     R(a[10] - 2, a[11] + by - 2, 5, 5, PAL.white);
      /* the neck, the television, its antennae */
      R(22, 31 + hy, 5, 6, PAL.tvLo);
      R(9, 9 + hy, 31, 23, PAL.tv);
      seg(17, 9 + hy, 13 + wig, 3 + hy + droop, PAL.ant); seg(31, 9 + hy, 35 - wig, 3 + hy + droop, PAL.ant);
      R(11 + wig, hy + droop, 3, 3, PAL.redHi); R(34 - wig, hy + droop, 3, 3, PAL.gold);
    }
    /* colour-only detail, no outline */
    F(18, 57, 1, 13, PAL.blackHi); F(27, 57, 1, 13, PAL.blackHi);
    F(13, 74, 10, 1, PAL.goldLo); F(26, 74, 10, 1, PAL.goldLo);
    F(15, 40 + by, 2, 14, PAL.redHi);
    F(22, 36 + by, 5, 8, PAL.white); F(23, 44 + by, 3, 3, PAL.white);
    F(19, 36 + by, 4, 3, PAL.gold); F(26, 36 + by, 4, 3, PAL.gold); F(23, 37 + by, 3, 2, PAL.goldLo);
    F(24, 48 + by, 1, 1, INK); F(24, 52 + by, 1, 1, INK);
    F(10, 10 + hy, 29, 1, PAL.tvHi); F(10, 30 + hy, 29, 1, PAL.tvLo);
    F(34, 14 + hy, 3, 3, PAL.tvHi); F(34, 20 + hy, 3, 3, PAL.tvHi);
    F(34, 26 + hy, 3, 1, PAL.tvLo); F(34, 28 + hy, 3, 1, PAL.tvLo);
    drawFace(look.face, 12, 12 + hy, clock);
  }

  /* ── confetti ───────────────────────────────────────────────────
     One full-screen canvas over the picture. Nothing spawns under
     reduced motion or with the reduce-particles switch on, and the
     pool is capped, so a perfect run cannot bury the screen. */
  var fcv = $('quizFx');
  var fg = fcv && fcv.getContext ? fcv.getContext('2d') : null;
  var bits = [], fxW = 0, fxH = 0, DPR = 1, fxDirty = false;
  var CONF = ['#FFD34E', '#FF8ACF', '#7BE38A', '#4FC3F7', '#FF4D6A', '#F4F0FF'];
  function noBits() { return reduced || !!(NEU.settings && NEU.settings.particles); }
  function sizeFx() {
    if (!fcv) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    fxW = window.innerWidth || 800; fxH = window.innerHeight || 600;
    fcv.width = (fxW * DPR) | 0; fcv.height = (fxH * DPR) | 0;
  }
  function burst(n, x, y, vx, vy, spread) {
    if (!fg || noBits()) return;
    for (var k = 0; k < n && bits.length < 240; k++) {
      bits.push({ x: x, y: y,
                  vx: vx + (Math.random() - 0.5) * spread,
                  vy: vy + (Math.random() - 0.5) * spread * 0.6,
                  r: Math.random() * 6.3, vr: (Math.random() - 0.5) * 14,
                  s: 5 + Math.random() * 5, c: CONF[(Math.random() * CONF.length) | 0],
                  life: 2.2 + Math.random() * 1.2 });
    }
  }
  function stepFx(dt) {
    if (!fg) return;
    if (!bits.length) {
      if (fxDirty) { fg.setTransform(1, 0, 0, 1, 0, 0); fg.clearRect(0, 0, fcv.width, fcv.height); fxDirty = false; }
      return;
    }
    fxDirty = true;
    fg.setTransform(DPR, 0, 0, DPR, 0, 0);
    fg.clearRect(0, 0, fxW, fxH);
    for (var k = bits.length - 1; k >= 0; k--) {
      var b = bits[k];
      b.vy += 760 * dt; b.vx *= 1 - 0.9 * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.r += b.vr * dt; b.life -= dt;
      if (b.life <= 0 || b.y > fxH + 24) { bits.splice(k, 1); continue; }
      var w = Math.max(1, b.s * Math.abs(Math.cos(b.r)));
      fg.globalAlpha = Math.min(1, b.life * 2);
      fg.fillStyle = b.c;
      fg.fillRect(Math.round(b.x - w / 2), Math.round(b.y), Math.round(w) || 1, Math.round(b.s * 0.6) || 1);
    }
    fg.globalAlpha = 1;
  }
  function clearFx() {
    bits = [];
    if (fg && fcv) { fg.setTransform(1, 0, 0, 1, 0, 0); fg.clearRect(0, 0, fcv.width, fcv.height); }
    fxDirty = false;
  }

  /* ── the studio's frame loop ────────────────────────────────────
     Tenna and the confetti, while the overlay is open and only then. */
  var looping = false, clock = 0, lastNow = 0;
  function frame(now) {
    if (!open_) { looping = false; return; }
    requestAnimationFrame(frame);
    var dt = (now - lastNow) / 1000;
    lastNow = now;
    if (!(dt > 0) || dt > 0.05) dt = 0.016;
    clock += dt;
    drawTenna(clock);
    stepFx(dt);
  }
  function startLoop() {
    if (looping || typeof requestAnimationFrame !== 'function') return;
    looping = true; lastNow = 0;
    requestAnimationFrame(frame);
  }
  addEventListener('resize', function () { if (open_) sizeFx(); });

  /* ── keyboard focus ─────────────────────────────────────────────
     The show is a modal overlay, so Tab stays inside it. THE LIST IS
     COMPUTED ON EVERY PRESS, NEVER CACHED: the four option buttons are
     rebuilt for every question, so a list captured at open() would be
     pointing at detached elements by question two. */
  function focusables() {
    var out = [], all = wrap.querySelectorAll('button'), k;
    for (k = 0; k < all.length; k++) {
      if (!all[k].hidden && !all[k].disabled) out.push(all[k]);
    }
    return out;
  }

  var lastFocus = null;

  function open() {
    if (open_) return;
    open_ = true;
    /* Where to put the player back when they leave. Only captured once
       per visit, so a replay cannot overwrite it with a button inside. */
    if (!lastFocus) lastFocus = document.activeElement;
    /* The show owns the screen. A line still on the room's box (the
       break narration, a replay) sat on top of the first question. */
    if (NEU.hush) NEU.hush();
    wrap.hidden = false;
    NEU.activeMinigame = 'quiz';        /* the room underneath must not move or take Escape */
    document.body.classList.add('is-playing');
    if (NEU.quest) { NEU.quest.lock(true); NEU.quest.mark('a4_tenna'); }
    sizeFx();
    startLoop();
    begin();
  }

  /* A fresh show, from the top. It owns all the per-run state,
     including whether each physical phase has run yet. */
  function begin() {
    run++;
    stopTimers();
    stopPhase();
    clearFx();
    i = 0; score = 0; locked = false; ended = false; leaving = false;
    dodged = false; shot = false;
    wrap.classList.remove('is-finale', 'is-off');
    lights(false);
    if (elEnd) { elEnd.hidden = true; elEnd.innerHTML = ''; }
    if (elOpts) elOpts.innerHTML = '';
    if (elQ) elQ.textContent = '';
    if (elBar) { elBar.style.width = '100%'; elBar.classList.remove('is-low'); }
    board();
    roundBanner('ROUND 1: THE LEGEND OF TENNA');
    state = 'intro';
    host('');
    /* the set warms up like an old television, then he is on */
    if (!fast && !reduced) { wrap.classList.remove('is-on'); void wrap.offsetWidth; wrap.classList.add('is-on'); }
    pose('cheer', 'static');
    later(function () { pose('cheer', 'grin'); host(TENNA.intro[0]); }, 450);
    later(function () { pose('point', 'wink'); host(TENNA.intro[1]); }, 1900);
    later(function () { pose('shrug', 'smug'); host(TENNA.intro[2]); }, 3300);
    /* No options exist yet, so the quit button is the way in. */
    if (elQuit && elQuit.focus) elQuit.focus();
    later(ask, 4700);
  }

  function close() {
    /* Idempotent. The confirm prompt can still be up when the finale
       hands you to the corridor, and its "yes" must not unlock the
       objectives panel over a running room. */
    if (!open_) return;
    open_ = false;
    run++;
    ended = false; leaving = false; state = 'idle';
    stopTimers();
    stopPhase();
    clearFx();
    wrap.hidden = true;
    wrap.classList.remove('is-on', 'is-finale', 'is-off');
    lights(false);
    if (NEU.activeMinigame === 'quiz') NEU.activeMinigame = null;
    document.body.classList.remove('is-playing');
    if (NEU.quest) NEU.quest.lock(false);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    lastFocus = null;
  }

  function host(s) { if (elSay) elSay.textContent = s; }

  function board() {
    var el = $('quizBoard');
    if (!el) return;
    el.innerHTML = RANKS.map(function (r) {
      return '<span><b>' + r[0] + '</b>' + r[1] + '+</span>';
    }).join('');
  }
  function chips() { var el = $('quizBoard'); return el ? el.children : []; }

  function roundBanner(text) {
    var el = $('quizRound');
    if (el) { el.textContent = text; el.hidden = !text; }
  }

  /* restart a CSS animation on an element that may already carry it */
  function again(el, cls) {
    if (!el) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  }

  function ask() {
    /* Round break: after question 10, the DODGE FIRE phase runs
       before the second half. In fast mode the dodge is a no-op
       (dodgeStart calls dodgeDone immediately). Whether a phase has
       run is its own flag, reset by begin(). */
    if (i === 10 && !dodged) { dodged = true; dodgeStart(8); return; }
    /* Round 2 Phase B: after the last question, SHOOT THE TARGETS. */
    if (i >= Q.length && !shot) { shot = true; shootStart(8); return; }
    if (i >= Q.length) { finish(); return; }
    state = 'ask';
    locked = false;
    var q = Q[i];
    if (elCat) elCat.textContent = q[0];
    if (elNum) elNum.textContent = (i + 1) + ' / ' + Q.length + '   ·   ' + score + ' right';
    if (elQ) { elQ.textContent = q[1]; again(elQ, 'is-in'); }
    pose('point', ['grin', 'smug', 'wink'][i % 3]);
    if (elOpts) {
      elOpts.innerHTML = '';
      q[2].forEach(function (opt, n) {
        var b = document.createElement('button');
        b.className = 'quiz__o';
        b.innerHTML = '<b>' + 'ABCD'[n] + '</b>' + opt;
        b.addEventListener('click', function () { answer(n); });
        elOpts.appendChild(b);
      });
      /* Put the caret on option A each question. Without it, Tab from
         the quit button is the only way to reach an answer, and the
         twelve-second timer runs while you look for it. */
      if (elOpts.firstChild && elOpts.firstChild.focus) elOpts.firstChild.focus();
    }
    span = limit();
    t = span;
    clearInterval(tick);
    if (elBar) elBar.classList.remove('is-low');
    tick = setInterval(function () {
      t -= 0.1;
      if (elBar) {
        elBar.style.width = Math.max(0, (t / span) * 100) + '%';
        if (t < 3) elBar.classList.add('is-low');
      }
      /* Running out is a wrong answer, not an ejection. */
      if (t <= 0) { clearInterval(tick); tick = null; answer(-1); }
    }, 100);
  }

  function answer(n) {
    if (locked || state !== 'ask') return;
    locked = true;
    state = 'reveal';
    clearInterval(tick); tick = null;
    var q = Q[i], right = q[3];
    var btns = elOpts ? elOpts.children : [];
    for (var k = 0; k < btns.length; k++) {
      if (k === right) btns[k].classList.add('is-right');
      else if (k === n) btns[k].classList.add('is-wrong');
    }
    if (n === right) {
      score++;
      host(TENNA.right[(Math.random() * TENNA.right.length) | 0]);
      pose('cheer', 'happy');
      var b = btns[right] && btns[right].getBoundingClientRect ? btns[right].getBoundingClientRect() : null;
      if (b) burst(16, b.left + b.width / 2, b.top + b.height / 2, 0, -260, 520);
      if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick();
    } else {
      host(n < 0
        ? TENNA.slow + 'ABCD'[right] + "."
        : TENNA.wrong[(Math.random() * TENNA.wrong.length) | 0] + 'ABCD'[right] + ".");
      pose('shrug', n < 0 ? 'sad' : 'shock');
      if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
    }
    if (elNum) elNum.textContent = (i + 1) + ' / ' + Q.length + '   ·   ' + score + ' right';
    i++;
    later(ask, 1500);
  }

  /* ── the finale ─────────────────────────────────────────────────
     A sequence, not a screen. Each beat queues the next on the one
     timeline, so a skip (stopTimers, then land()) or a close can cut
     it anywhere without a beat firing late. */
  function finish() {
    if (!open_ || ended) return;
    stopTimers();
    stopPhase();
    ended = true; leaving = false; state = 'finale';
    roundBanner('');
    runRank = rankFor(score); bestRank = runRank;
    if (NEU.save) {
      /* Only ever improves. A worse re-run must not close a door that
         is already open. */
      var prev = NEU.save.data.quiz;
      var best = (prev && prev.score > score) ? prev : { rank: runRank, score: score };
      NEU.save.data.quiz = best;
      NEU.save.flag('quiz_rank', best.rank);
      opens(best.rank).forEach(function (r) { NEU.save.flag('rank:' + r, 1); });
      NEU.save.capture();
      bestRank = best.rank;
    }
    if (NEU.quest) NEU.quest.mark('a4_rank');
    if (elOpts) elOpts.innerHTML = '';
    if (elQ) elQ.textContent = '';
    if (elEnd) {
      elEnd.hidden = false;
      elEnd.innerHTML =
        '<p class="quiz__fin">AND THAT’S THE SHOW!</p>' +
        '<p class="quiz__score"><b id="quizTally">0</b> / ' + Q.length + '</p>' +
        '<p class="quiz__rank" id="quizRank"></p>' +
        '<p class="quiz__doors" id="quizDoors"></p>' +
        '<button type="button" class="quiz__go" id="quizGoBtn">to the doors →</button>' +
        '<p class="quiz__small">the show takes you there on its own. enter or a tap goes now.</p>';
      var go_ = $('quizGoBtn');
      if (go_) {
        go_.addEventListener('click', skip);
        /* Off the dead option buttons, onto the one thing to press. */
        if (go_.focus) go_.focus();
      }
    }
    wrap.classList.add('is-finale');
    lights(true);
    host(TENNA.finish);
    pose('cheer', 'stars');
    if (NEU.sfx && NEU.sfx.stinger) NEU.sfx.stinger(3);
    burst(80, 0, fxH, 560, -820, 420);
    burst(80, fxW, fxH, -560, -820, 420);
    later(tally, 1000);
  }

  /* the score counts up, one tick per right answer */
  function tally() {
    var el = $('quizTally'), n = 0;
    (function step() {
      if (n >= score) { later(stamp, 450); return; }
      n++;
      if (el) el.textContent = String(n);
      if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick();
      later(step, 70);
    })();
  }

  /* the rank comes down like a rubber stamp, and he takes it personally */
  function stamp() {
    showRank(true);
    if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
    var take = TAKES[runRank] || TAKES.Z;
    pose(take[0], take[1]);
    host(score + ' OUT OF ' + Q.length + '! ' + (TENNA.rank[runRank] || ''));
    if (score >= 12) burst(50, fxW / 2, fxH * 0.45, 0, -420, 760);
    later(doors, 1300);
  }
  function showRank(animate) {
    var t_ = $('quizTally'), r = $('quizRank');
    if (t_) t_.textContent = String(score);
    if (!r || r.textContent) return;
    r.textContent = runRank;
    if (animate) again(r, 'is-stamped');
  }

  /* the doors it opened light up on the board, from Z upward */
  function doors() {
    var n = opens(bestRank).length, k = 0, cs = chips();
    (function light() {
      if (k >= n) { doorsLine(); later(prizes, 900); return; }
      var c = cs[RANKS.length - 1 - k];
      if (c) c.classList.add('is-lit');
      if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick();
      k++;
      later(light, 140);
    })();
  }
  function doorsLine() {
    var n = opens(bestRank).length, el = $('quizDoors'), cs = chips();
    for (var k = 0; k < n; k++) if (cs[RANKS.length - 1 - k]) cs[RANKS.length - 1 - k].classList.add('is-lit');
    if (!el || el.textContent) return;
    el.textContent = n + ' door' + (n === 1 ? '' : 's') + ' just unlocked. all of them are yours.' +
      (bestRank !== runRank ? ' your best is still ' + bestRank + ', and the best is the one that counts.' : '');
  }

  function prizes() {
    host(TENNA.prizes);
    pose('bow', 'happy');
    later(off, 1800);
  }

  /* The television switches off: the picture folds to a bright line,
     the line to a dot, the dot to black. Then the corridor. */
  function off() {
    if (!open_ || state === 'off') return;
    state = 'off';
    pose('bow', 'off');
    if (NEU.sfx && NEU.sfx.whoosh) NEU.sfx.whoosh();
    wrap.classList.add('is-off');
    later(go, reduced ? 320 : 720);
  }

  /* Any key, click or tap on the finale. Every beat lands at once, so
     what you skip to is the result, and then the set switches off. */
  function skip() {
    if (!open_ || !ended || leaving) return;
    leaving = true;
    stopTimers();
    showRank(false);
    doorsLine();
    host(score + ' OUT OF ' + Q.length + '! ' + TENNA.prizes);
    later(off, 500);
  }

  /* Off the stage and into the prize corridor the show was always
     meant to open, through a slower iris than a door gets. */
  function go() {
    if (!open_ || !ended) return;
    close();
    if (NEU.engine && NEU.engine.enter) NEU.engine.enter('g0_hall', undefined, { iris: reduced ? 0.22 : 1.1 });
  }

  /* ── the physical challenge: DODGE FIRE ─────────────────────────
     Round 1 Phase B. Fire rains; the SOUL (a red heart) dodges for a
     fixed duration. This is the DODGE FIRE minigame from the Tenna
     boss battle, adapted to the quiz canvas.

     Gated behind `fast`: tests drive the show with fast(true), which
     collapses pacing to zero, so dodgeStart hands straight to
     dodgeDone and the phase is a no-op. Real players get it all.

     BOTH PHASES SHARE ONE LOOP HANDLE AND ONE `phase` NAME, AND
     stopPhase() NULLS THEM. The first version cleared each interval
     but kept its handle, and the handle doubled as "is this phase
     live" — so once the shoot phase had run, its key handler stayed
     armed for the rest of the session and ate every Enter on the end
     screen. That was the soft-lock at the end of the show. */
  var cv = $('quizCanvas');
  var cx = cv ? cv.getContext('2d') : null;
  var soul = { x: 240, y: 210 }, dodgeTime = 0, dodgeHits = 0;
  var fires = [];
  var phase = null, phaseLoop = null, dodged = false, shot = false;
  var DT = 0.033;

  /* Held arrows, not keydown counts. A step per keydown meant the soul
     moved once, waited out the keyboard's repeat delay, then lurched —
     and on a phone it moved once and stopped, because the touch stick
     sends one keydown per push and a keyup on release. */
  var held = {};
  var SOUL_SPEED = 240, AIM_SPEED = 300;
  function axis(neg, pos) { return (held[pos] ? 1 : 0) - (held[neg] ? 1 : 0); }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function stopPhase() {
    clearInterval(phaseLoop);
    phaseLoop = null;
    phase = null;
    held = {};
    if (cv) cv.hidden = true;
  }

  function stageFloor() {
    cx.fillStyle = '#0E0820'; cx.fillRect(0, 0, 480, 240);
    cx.fillStyle = '#1B1036';
    for (var g = 0; g < 480; g += 32) cx.fillRect(g, 0, 1, 240);
    for (g = 0; g < 240; g += 32) cx.fillRect(0, g, 480, 1);
  }
  /* The rounds are not scored (the twenty questions are), but a hit you
     cannot see is a round you cannot read: a time bar along the top,
     a counter in the corner, a flash on every hit. */
  var hurt = 0, pops = [], roundLen = 8;
  function hud(left, label, col) {
    cx.fillStyle = '#2A1747'; cx.fillRect(0, 0, 480, 4);
    cx.fillStyle = '#FFD34E'; cx.fillRect(0, 0, Math.max(0, left / roundLen) * 480, 4);
    cx.font = '16px "Determination Mono", monospace';
    cx.fillStyle = col; cx.fillText(label, 10, 24);
  }
  /* A hit has to read at a glance, not only in the counter: Tenna
     reacts for a moment and goes back to the round's pose, and a hit
     you take shakes the arena (not under reduced motion). */
  var reactT = 0;
  function react(p, f, back, shake) {
    pose(p, f);
    clearTimeout(reactT);
    reactT = later(function () { pose(back[0], back[1]); }, 450);
    if (shake && cv && !reduced) { cv.classList.remove('is-hit'); void cv.offsetWidth; cv.classList.add('is-hit'); }
  }
  function soulAt(x, y) {
    x = Math.round(x); y = Math.round(y);
    cx.fillStyle = hurt > 0 && Math.floor(hurt * 20) % 2 ? '#FFFFFF' : '#FF2030';
    cx.fillRect(x - 4, y - 3, 3, 2); cx.fillRect(x + 1, y - 3, 3, 2);
    cx.fillRect(x - 4, y - 1, 8, 2); cx.fillRect(x - 3, y + 1, 6, 1);
    cx.fillRect(x - 2, y + 2, 4, 1); cx.fillRect(x - 1, y + 3, 2, 1);
  }

  function dodgeStart(duration) {
    if (!cv || !cx || fast) { dodgeDone(); return; }
    state = 'dodge';
    soul = { x: 240, y: 210 }; dodgeTime = duration; dodgeHits = 0; fires = [];
    roundLen = duration; hurt = 0;
    cv.hidden = false;
    if (elOpts) elOpts.innerHTML = '';
    if (elQ) elQ.textContent = '';
    host("DODGE FIRE! don't get hit!");
    pose('point', 'grin');
    phase = 'dodge';
    phaseLoop = setInterval(dodgeTick, 33);
  }

  function dodgeTick() {
    if (!open_ || phase !== 'dodge') { stopPhase(); return; }
    dodgeTime -= DT;
    soul.x = clamp(soul.x + axis('ArrowLeft', 'ArrowRight') * SOUL_SPEED * DT, 8, 472);
    soul.y = clamp(soul.y + axis('ArrowUp', 'ArrowDown') * SOUL_SPEED * DT, 8, 232);
    if (Math.random() < 0.4)
      fires.push({ x: Math.random() * 480, y: 0, vy: 80 + Math.random() * 80 });
    stageFloor();
    for (var f = fires.length - 1; f >= 0; f--) {
      fires[f].y += fires[f].vy * DT;
      if (fires[f].y > 240) { fires.splice(f, 1); continue; }
      var fx = Math.round(fires[f].x), fy = Math.round(fires[f].y);
      cx.fillStyle = '#FF6B2A'; cx.fillRect(fx, fy, 8, 12);
      cx.fillStyle = '#FFD34E'; cx.fillRect(fx + 2, fy + 5, 4, 6);
      if (Math.abs(fires[f].x - soul.x) < 10 && Math.abs(fires[f].y - soul.y) < 10) {
        dodgeHits++; fires.splice(f, 1);
        hurt = 0.4;
        if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
        react('shock', 'shock', ['point', 'grin'], true);
      }
    }
    if (hurt > 0) {
      hurt -= DT;
      cx.fillStyle = 'rgba(255, 32, 48, ' + (Math.max(0, hurt) * 0.6).toFixed(2) + ')';
      cx.fillRect(0, 0, 480, 240);
      cx.strokeStyle = '#FF2030'; cx.lineWidth = 4; cx.strokeRect(2, 2, 476, 236);
    }
    soulAt(soul.x, soul.y);
    hud(dodgeTime, dodgeHits ? 'OUCH \u00d7' + dodgeHits : 'NOT A SCRATCH', dodgeHits ? '#FF6B8A' : '#7BE38A');
    if (dodgeTime <= 0) dodgeDone();
  }

  function dodgeDone() {
    stopPhase();
    if (!open_) return;
    state = 'intro';
    if (elQ) elQ.textContent = '';
    roundBanner('ROUND 2: THE ONE I SAID WAS LAST');
    host((dodgeHits ? 'OUCH! ' + dodgeHits + (dodgeHits === 1 ? ' hit. ' : ' hits. ') : 'NOT A SCRATCH! ') +
         'ROUND TWO! the one i said was last! i lied!');
    pose('cheer', 'wink');
    later(ask, 800);
  }

  /* ── the physical challenge: SHOOT THE TARGETS ──
     Round 2 Phase B. Tenna faces appear in windows; the player shoots
     them before they shoot back. Redder = about to shoot. This is the
     Cowboy minigame from the Tenna battle, adapted. Arrow keys (or
     the stick) move the crosshair; Space or Enter (or A) fires.
     Like dodge, gated behind `fast`: in test mode it's a no-op. */
  var shootTime = 0, shootHits = 0, shootMisses = 0;
  var targets = [], crosshair = { x: 240, y: 120 };

  function shootStart(duration) {
    if (!cv || !cx || fast) { shootDone(); return; }
    state = 'shoot';
    shootTime = duration; shootHits = 0; shootMisses = 0; targets = [];
    crosshair = { x: 240, y: 120 };
    roundLen = duration; pops = [];
    cv.hidden = false;
    if (elOpts) elOpts.innerHTML = '';
    if (elQ) elQ.textContent = '';
    host("SHOOT THE TARGETS! don't let them shoot you!");
    pose('shock', 'grin');
    phase = 'shoot';
    phaseLoop = setInterval(shootTick, 33);
  }

  function shootTick() {
    if (!open_ || phase !== 'shoot') { stopPhase(); return; }
    shootTime -= DT;
    crosshair.x = clamp(crosshair.x + axis('ArrowLeft', 'ArrowRight') * AIM_SPEED * DT, 12, 468);
    crosshair.y = clamp(crosshair.y + axis('ArrowUp', 'ArrowDown') * AIM_SPEED * DT, 12, 228);
    if (Math.random() < 0.3)
      targets.push({ x: 20 + Math.random() * 440, y: 20 + Math.random() * 180, timer: 2 + Math.random() * 2 });
    stageFloor();
    for (var n = targets.length - 1; n >= 0; n--) {
      targets[n].timer -= DT;
      if (targets[n].timer <= 0) { shootMisses++; targets.splice(n, 1); continue; }
      /* a little television with his face on it; red when it is about to fire */
      var tx = Math.round(targets[n].x), ty = Math.round(targets[n].y);
      cx.fillStyle = targets[n].timer < 1 ? '#FF2030' : '#FFD34E';
      cx.fillRect(tx - 8, ty - 8, 16, 16);
      cx.fillStyle = '#0B1630'; cx.fillRect(tx - 6, ty - 6, 12, 9);
      cx.fillStyle = '#9FF0FF'; cx.fillRect(tx - 4, ty - 4, 2, 2); cx.fillRect(tx + 2, ty - 4, 2, 2);
      cx.fillRect(tx - 3, ty, 6, 1);
    }
    /* a target you hit bursts: a ring that grows and goes */
    for (n = pops.length - 1; n >= 0; n--) {
      pops[n].t -= DT;
      if (pops[n].t <= 0) { pops.splice(n, 1); continue; }
      var pr = 22 - pops[n].t * 50;
      if (pops[n].t > 0.2) { cx.fillStyle = '#FFFFFF'; cx.fillRect(pops[n].x - 10, pops[n].y - 10, 20, 20); }
      cx.strokeStyle = '#FFFFFF'; cx.lineWidth = 2;
      cx.strokeRect(pops[n].x - pr, pops[n].y - pr, pr * 2, pr * 2);
    }
    hud(shootTime, 'HITS ' + shootHits, '#7BE38A');
    cx.strokeStyle = '#7BE38A'; cx.lineWidth = 2;
    cx.strokeRect(crosshair.x - 12, crosshair.y - 12, 24, 24);
    cx.beginPath();
    cx.moveTo(crosshair.x - 16, crosshair.y); cx.lineTo(crosshair.x + 16, crosshair.y);
    cx.moveTo(crosshair.x, crosshair.y - 16); cx.lineTo(crosshair.x, crosshair.y + 16);
    cx.stroke();
    if (shootTime <= 0) shootDone();
  }

  function shootFire() {
    if (phase !== 'shoot') return;
    for (var n = targets.length - 1; n >= 0; n--) {
      if (Math.abs(targets[n].x - crosshair.x) < 16 && Math.abs(targets[n].y - crosshair.y) < 16) {
        shootHits++;
        pops.push({ x: targets[n].x, y: targets[n].y, t: 0.3 });
        targets.splice(n, 1);
        if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick();
        react('cheer', 'stars', ['shock', 'grin'], false);
        return;
      }
    }
    shootMisses++;
  }

  function shootDone() {
    stopPhase();
    if (!open_) return;
    state = 'round3';
    if (elQ) elQ.textContent = '';
    roundBanner('');
    /* Faux Round 3: Tenna tries to start a third round, the act breaks. */
    host((shootHits ? 'YOU GOT ' + shootHits + '! ' : 'NOT ONE! ') +
         'ROUND THREE! TV CITY! collect the— wait. wait. the show is over. it is OVER.');
    pose('shock', 'shock');
    later(finish, 2400);
  }

  /* During a phase the arrows are held state and, in the shoot phase,
     Space/Enter fire. Returns true if it consumed the key, so the
     trivia handler below skips it. Only while a phase is LIVE. */
  var ARROWS = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1 };
  function phaseKey(e) {
    if (!phase) return false;
    if (ARROWS[e.key]) { held[e.key] = true; return true; }
    if (phase === 'shoot' && (e.key === ' ' || e.key === 'Enter')) {
      if (!e.repeat) shootFire();
      return true;
    }
    return false;
  }
  addEventListener('keyup', function (e) { if (held[e.key]) held[e.key] = false; });
  /* A key released while the tab was in the background never sends
     its keyup; without this the soul keeps walking into the wall. */
  addEventListener('blur', function () { held = {}; });

  /* Arrows walk the caret between the four answers and Enter picks the
     one it is on. The touch stick and A button arrive as synthetic
     key events, which never activate a focused button by themselves —
     so without this, a phone could see the answers and not pick one
     with the pad. */
  function options() {
    return elOpts ? Array.prototype.slice.call(elOpts.querySelectorAll('.quiz__o')) : [];
  }
  function optionKey(e) {
    var os = options();
    if (!os.length || locked) return false;
    var at = os.indexOf(document.activeElement);
    if (ARROWS[e.key]) {
      var step = (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 1;
      var to = at < 0 ? 0 : (at + step + os.length) % os.length;
      os[to].focus();
      return true;
    }
    if (e.key === 'Enter' && at >= 0) { answer(at); return true; }
    return false;
  }

  function leave() {
    /* a confirmed exit, since the score is on the line */
    if (NEU.engine && NEU.engine.confirmExit) NEU.engine.confirmExit('Quiz', close);
    else close();
  }

  addEventListener('keydown', function (e) {
    if (!open_) return;
    /* "Leave Quiz?" owns the keyboard while it is up. */
    if (document.getElementById('confirmExit')) return;
    if (phaseKey(e)) { e.preventDefault(); return; }
    if (e.key === 'Tab') {
      var els = focusables();
      if (!els.length) { e.preventDefault(); return; }
      var idx = els.indexOf(document.activeElement);
      if (e.shiftKey) {
        if (idx <= 0) { e.preventDefault(); els[els.length - 1].focus(); }
      } else {
        if (idx === -1 || idx >= els.length - 1) { e.preventDefault(); els[0].focus(); }
      }
      return;
    }
    if (ended) {
      /* The show is finished and the score is saved, so there is
         nothing to leave: Enter, Space and Escape all mean "go on". */
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); skip(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); leave(); return; }
    if (phase || i >= Q.length) return;
    if (optionKey(e)) { e.preventDefault(); return; }
    var k = 'abcd'.indexOf(String(e.key).toLowerCase());
    if (k >= 0) { e.preventDefault(); answer(k); return; }
    var n = '1234'.indexOf(e.key);
    if (n >= 0) { e.preventDefault(); answer(n); }
  });

  /* a click or tap anywhere on the finale goes on, like a key */
  wrap.addEventListener('click', function (e) {
    if (ended && e.target !== elQuit) skip();
  });
  if (elQuit) elQuit.addEventListener('click', function () {
    if (ended) { skip(); return; }
    /* same path as ESC: confirmExit('Quiz', close) */
    leave();
  });

  NEU.quiz = { open: open, close: close, skip: skip,
               fast: function (on) { fast = !!on; },
               get running() { return open_; },
               get score() { return score; },
               get index() { return i; },
               get phase() { return phase; },
               get ended() { return ended; },
               get state() { return state; },
               get look() { return { pose: look.pose, face: look.face }; },
               get limit() { return limit(); },
               get soul() { return { x: soul.x, y: soul.y }; },
               questions: Q, ranks: RANKS,
               rankFor: rankFor, opens: opens };
})();
