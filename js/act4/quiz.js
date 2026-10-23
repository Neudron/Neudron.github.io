/* quiz.js — TENNA, and the ranking.
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
      makes a second attempt appealing instead of obligatory.        */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};

  var wrap = document.getElementById('quiz');
  if (!wrap) { NEU.quiz = { open: function () {} }; return; }
  var elQ    = document.getElementById('quizQ');
  var elCat  = document.getElementById('quizCat');
  var elNum  = document.getElementById('quizNum');
  var elOpts = document.getElementById('quizOpts');
  var elBar  = document.getElementById('quizBar');
  var elSay  = document.getElementById('quizSay');
  var elEnd  = document.getElementById('quizEnd');

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
    ['T', 20], ['S', 18], ['A', 16], ['A\u2013', 14], ['B', 12],
    ['B\u2013', 10], ['C', 7], ['C\u2013', 4], ['Z', 0]
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
  var i = 0, score = 0, t = 0, tick = null, askTimer = null, locked = false, open_ = false;
  /* The end screen is a state of its own, not "i ran past the last
     question": the shoot phase and Tenna's faux Round 3 both run with
     i at 20, and Escape there used to restart the show underneath a
     live phase loop. */
  var ended = false, goTimer = null, goLeft = 0, reactTimer = null;
  /* Seconds the end screen stays up before the show hands you to the
     prize corridor on its own. Long enough to read the rank and his
     reaction to it; Enter goes sooner, Escape stays for a replay. */
  var AUTO = 7;
  /* Dev/test only. The pacing between questions is most of what makes
     this feel like a game show, so it cannot be tuned down for real
     players — but a test that has to sit through twenty 1.5-second
     reveals is a test nobody runs. */
  var fast = false;
  function pace(ms) { return fast ? 0 : (reduced ? Math.min(ms, 400) : ms); }

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
      'A\u2013': 'A! well. almost awesome.',
      'B': 'B! NOT BAD! which is the worst thing you can be.',
      'B\u2013': 'B! not bad. not good either. just... there.',
      'C': 'C! KINDA SLOW! like a certain salesman i know.',
      'C\u2013': 'C! you are testing my patience. and my show.',
      'Z': 'Z! VERY SLOW! BAD CAR! SMALL NOSE! ...SALESMAN.'
    }
  };

  /* ── keyboard focus ─────────────────────────────────────────────
     The quiz was the last scene in the game with no focus management
     at all: a modal overlay at z-index 76 that a single Tab walked
     straight out of, into the page behind it, while the show carried
     on running and answering for you on the timer. `deck.js` and
     `settings.js` both trap; this is the same pattern.

     THE LIST IS COMPUTED ON EVERY PRESS, NEVER CACHED. The four
     option buttons are destroyed and rebuilt for every question, so a
     list captured at open() would be pointing at four detached
     elements by question two — focusable in the array, attached to
     nothing on screen. */
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
    /* Where to put the player back when they leave. Same courtesy the
       settings panel does with the gear button. Only captured once —
       a retry from the end screen must not overwrite it with the quit
       button it is sitting on. */
    if (!lastFocus) lastFocus = document.activeElement;
    wrap.hidden = false;
    NEU.activeMinigame = 'quiz';        /* the room underneath must not move or take Escape */
    document.body.classList.add('is-playing');
    if (NEU.quest) { NEU.quest.lock(true); NEU.quest.mark('a4_tenna'); }
    begin();
  }

  /* A fresh show, from the top. open() calls it, and so does Escape on
     the end screen — which is why it owns all the per-run state,
     including whether each physical phase has run yet. */
  function begin() {
    stopTimers();
    stopPhase();
    i = 0; score = 0; locked = false; ended = false;
    dodged = false; shot = false;
    if (elEnd) elEnd.hidden = true;
    if (elOpts) elOpts.innerHTML = '';
    if (elQ) elQ.textContent = '';
    board();
    roundBanner('ROUND 1: THE LEGEND OF TENNA');
    host(TENNA.intro.join('  '));
    /* No options exist yet, so the quit button is the way in. */
    var q0 = document.getElementById('quizQuit');
    if (q0 && q0.focus) q0.focus();
    askTimer = setTimeout(ask, pace(2400));
  }

  /* A pending "next question" timer must die with the overlay. If
     it survived, ask() would keep rebuilding the board on a hidden
     wrapper, the timer would run the whole show into a phantom "Z"
     finish, and the rank door would mark itself a4_rank behind the
     player's back. The same goes for the end screen's countdown: a
     replay or a deliberate leave must not be followed by a door. */
  function stopTimers() {
    clearInterval(tick);
    clearTimeout(askTimer); askTimer = null;
    clearInterval(goTimer); goTimer = null;
    clearTimeout(reactTimer); reactTimer = null;
  }

  function close() {
    /* Idempotent. The confirm prompt can still be up when the end
       screen's countdown takes you to the corridor, and its "yes"
       must not unlock the objectives panel over a running room. */
    if (!open_) return;
    open_ = false;
    ended = false;
    stopTimers();
    stopPhase();
    wrap.hidden = true;
    if (NEU.activeMinigame === 'quiz') NEU.activeMinigame = null;
    document.body.classList.remove('is-playing');
    if (NEU.quest) NEU.quest.lock(false);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    lastFocus = null;
  }

  function host(s) { if (elSay) elSay.textContent = s; }

  function board() {
    var el = document.getElementById('quizBoard');
    if (!el) return;
    el.innerHTML = RANKS.map(function (r) {
      return '<span><b>' + r[0] + '</b>' + r[1] + '+</span>';
    }).join('');
  }

  function roundBanner(text) {
    var el = document.getElementById('quizRound');
    if (el) { el.textContent = text; el.hidden = !text; }
  }

  function ask() {
    /* The guard every timer fires into: if the show was closed while
       this call was queued, rebuild nothing and touch nothing. */
    if (!open_) return;
    /* Round break: after question 10, the DODGE FIRE phase runs
       before the second half. In fast mode the dodge is a no-op
       (dodgeStart calls dodgeDone immediately). Whether a phase has
       run is its own flag, reset by begin() — it used to be read off
       the interval handle, which was never nulled, so a replay
       skipped both phases. */
    if (i === 10 && !dodged) { dodged = true; dodgeStart(8); return; }
    /* Round 2 Phase B: after the last question, SHOOT THE TARGETS. */
    if (i >= Q.length && !shot) { shot = true; shootStart(8); return; }
    if (i >= Q.length) { finish(); return; }
    locked = false;
    var q = Q[i];
    if (elCat) elCat.textContent = q[0];
    if (elNum) elNum.textContent = (i + 1) + ' / ' + Q.length + '   \u00b7   ' + score + ' right';
    if (elQ)   elQ.textContent = q[1];
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
    tick = setInterval(function () {
      t -= 0.1;
      if (elBar) elBar.style.width = Math.max(0, (t / span) * 100) + '%';
      /* Running out is a wrong answer, not an ejection. */
      if (t <= 0) { clearInterval(tick); answer(-1); }
    }, 100);
  }

  function answer(n) {
    if (locked) return;
    locked = true;
    clearInterval(tick);
    var q = Q[i], right = q[3];
    var btns = elOpts ? elOpts.children : [];
    for (var k = 0; k < btns.length; k++) {
      if (k === right) btns[k].classList.add('is-right');
      else if (k === n) btns[k].classList.add('is-wrong');
    }
    if (n === right) {
      score++;
      host(TENNA.right[(Math.random() * TENNA.right.length) | 0]);
      if (NEU.sfx && NEU.sfx.tick) NEU.sfx.tick();
    } else {
      host(n < 0
        ? TENNA.slow + 'ABCD'[right] + "."
        : TENNA.wrong[(Math.random() * TENNA.wrong.length) | 0] + 'ABCD'[right] + ".");
      if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
    }
    i++;
    askTimer = setTimeout(ask, pace(1500));
  }

  function finish() {
    if (!open_) return;
    stopPhase();
    ended = true;
    roundBanner('');
    var rank = rankFor(score);
    if (NEU.save) {
      /* Only ever improves. A worse re-run must not close a door that
         is already open. */
      var prev = NEU.save.data.quiz;
      var best = (prev && prev.score > score) ? prev : { rank: rank, score: score };
      NEU.save.data.quiz = best;
      NEU.save.flag('quiz_rank', best.rank);
      opens(best.rank).forEach(function (r) { NEU.save.flag('rank:' + r, 1); });
      NEU.save.capture();
      rank = best.rank;
    }
    if (NEU.quest) NEU.quest.mark('a4_rank');
    clearInterval(tick);
    if (elEnd) {
      elEnd.hidden = false;
      elEnd.innerHTML =
        '<b>' + score + ' / ' + Q.length + '</b>' +
        '<em>' + rank + '</em>' +
        '<p>' + opens(rank).length + ' door' + (opens(rank).length === 1 ? '' : 's') +
        ' just unlocked. all of them are yours.</p>' +
        '<p class="quiz__small">the highest one you have ever scored is the one that counts.<br>' +
        '<span id="quizGo"></span><br>' +
        'enter to go now &middot; esc to try again</p>';
    }
    host(TENNA.finish);
    /* His reaction to the rank itself, shown after the end screen. */
    var react = TENNA.rank[rank];
    if (react) reactTimer = setTimeout(function () { if (open_ && ended) host(react); }, pace(1800));
    /* Off the dead option buttons. The global Enter handler below
       preventDefaults, so Enter here goes to the corridor rather than
       activating whatever the caret was left sitting on. */
    var qq = document.getElementById('quizQuit');
    if (qq && qq.focus) qq.focus();

    /* The show is over and the doors are open, so the show takes you
       to them. Waiting on a keypress here was a dead end for anyone
       who did not read the small print — and on a phone, for anyone
       at all whenever that keypress went missing. */
    goLeft = AUTO;
    countdown();
    if (fast) { goTimer = setTimeout(go, 0); return; }
    goTimer = setInterval(function () {
      /* Hold the count while "Leave Quiz?" is on screen; the player
         is answering a question, not watching a clock. */
      if (document.getElementById('confirmExit')) return;
      goLeft--;
      countdown();
      if (goLeft <= 0) go();
    }, 1000);
  }

  function countdown() {
    var el = document.getElementById('quizGo');
    if (el) el.textContent = 'taking you to the doors in ' + Math.max(0, goLeft) + '\u2026';
  }

  /* Off the stage and into the prize corridor the show was always
     meant to open. */
  function go() {
    if (!open_ || !ended) return;
    close();
    if (NEU.engine && NEU.engine.enter) NEU.engine.enter('g0_hall');
  }

  /* ── the physical challenge: DODGE FIRE ───────────────────────────────────────
     Round 1 Phase B and the bonus layer. Fire rains; the SOUL (a
     red dot) dodges for a fixed duration. Each hit subtracts from
     the round score. This is the DODGE FIRE minigame from the Tenna
     boss battle, adapted to the quiz canvas.

     The phase is gated behind `fast`: tests drive the show with
     fast(true) which collapses pacing to zero, so dodgeStart hands
     straight to dodgeDone and the phase is a no-op. Real players get
     the full dodge.

     BOTH PHASES SHARE ONE LOOP HANDLE AND ONE `phase` NAME, AND
     stopPhase() NULLS THEM. The first version cleared each interval
     but kept its handle, and the handle doubled as "is this phase
     live" — so once the shoot phase had run, its key handler stayed
     armed for the rest of the session and ate every Enter on the end
     screen. That was the soft-lock at the end of the show. */
  var cv = document.getElementById('quizCanvas');
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

  function dodgeStart(duration) {
    if (!cv || !cx || fast) { dodgeDone(); return; }
    soul = { x: 240, y: 210 }; dodgeTime = duration; dodgeHits = 0; fires = [];
    cv.hidden = false;
    if (elOpts) elOpts.innerHTML = '';
    if (elQ) elQ.textContent = '';
    host("DODGE FIRE! don't get hit!");
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
    cx.fillStyle = '#0E0820'; cx.fillRect(0, 0, 480, 240);
    cx.fillStyle = '#FF6B2A';
    for (var f = fires.length - 1; f >= 0; f--) {
      fires[f].y += fires[f].vy * DT;
      if (fires[f].y > 240) { fires.splice(f, 1); continue; }
      cx.fillRect(fires[f].x, fires[f].y, 8, 12);
      if (Math.abs(fires[f].x - soul.x) < 10 && Math.abs(fires[f].y - soul.y) < 10) {
        dodgeHits++; fires.splice(f, 1);
      }
    }
    cx.fillStyle = '#FF2030'; cx.fillRect(soul.x - 4, soul.y - 4, 8, 8);
    if (dodgeTime <= 0) dodgeDone();
  }

  function dodgeDone() {
    stopPhase();
    if (!open_) return;
    if (elQ) elQ.textContent = '';
    roundBanner('ROUND 2: THE ONE I SAID WAS LAST');
    host('ROUND TWO! the one i said was last! i lied!');
    askTimer = setTimeout(ask, pace(800));
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
    shootTime = duration; shootHits = 0; shootMisses = 0; targets = [];
    crosshair = { x: 240, y: 120 };
    cv.hidden = false;
    if (elOpts) elOpts.innerHTML = '';
    if (elQ) elQ.textContent = '';
    host("SHOOT THE TARGETS! don't let them shoot you!");
    phase = 'shoot';
    phaseLoop = setInterval(shootTick, 33);
  }

  function shootTick() {
    if (!open_ || phase !== 'shoot') { stopPhase(); return; }
    shootTime -= DT;
    crosshair.x = clamp(crosshair.x + axis('ArrowLeft', 'ArrowRight') * AIM_SPEED * DT, 12, 468);
    crosshair.y = clamp(crosshair.y + axis('ArrowUp', 'ArrowDown') * AIM_SPEED * DT, 12, 228);
    /* spawn targets */
    if (Math.random() < 0.3)
      targets.push({ x: 20 + Math.random() * 440, y: 20 + Math.random() * 180, timer: 2 + Math.random() * 2 });
    cx.fillStyle = '#0E0820'; cx.fillRect(0, 0, 480, 240);
    cx.fillStyle = '#FFD34E';
    for (var t = targets.length - 1; t >= 0; t--) {
      targets[t].timer -= DT;
      if (targets[t].timer <= 0) { shootMisses++; targets.splice(t, 1); continue; }
      var red = targets[t].timer < 1;
      cx.fillStyle = red ? '#FF2030' : '#FFD34E';
      cx.fillRect(targets[t].x - 8, targets[t].y - 8, 16, 16);
      cx.fillStyle = '#FFFFFF';
      cx.fillText('T', targets[t].x - 4, targets[t].y + 4);
    }
    /* crosshair */
    cx.strokeStyle = '#7BE38A'; cx.lineWidth = 2;
    cx.strokeRect(crosshair.x - 12, crosshair.y - 12, 24, 24);
    cx.strokeStyle = '#7BE38A'; cx.beginPath();
    cx.moveTo(crosshair.x - 16, crosshair.y); cx.lineTo(crosshair.x + 16, crosshair.y);
    cx.moveTo(crosshair.x, crosshair.y - 16); cx.lineTo(crosshair.x, crosshair.y + 16);
    cx.stroke();
    if (shootTime <= 0) shootDone();
  }

  function shootFire() {
    if (phase !== 'shoot') return;
    for (var t = targets.length - 1; t >= 0; t--) {
      if (Math.abs(targets[t].x - crosshair.x) < 16 && Math.abs(targets[t].y - crosshair.y) < 16) {
        shootHits++; targets.splice(t, 1); return;
      }
    }
    shootMisses++;
  }

  function shootDone() {
    stopPhase();
    if (!open_) return;
    if (elQ) elQ.textContent = '';
    roundBanner('');
    /* Faux Round 3: Tenna tries to start a third round, the act breaks. */
    host('ROUND THREE! TV CITY! collect the\u2014 wait. wait. the show is over. it is OVER.');
    askTimer = setTimeout(finish, pace(2400));
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

  addEventListener('keydown', function (e) {
    if (!open_) return;
    /* "Leave Quiz?" owns the keyboard while it is up. */
    if (document.getElementById('confirmExit')) return;
    if (phaseKey(e)) { e.preventDefault(); return; }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (ended) { begin(); return; }
      if (NEU.engine && NEU.engine.confirmExit) {
        NEU.engine.confirmExit('Quiz', close);
      } else { close(); }
      return;
    }
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
      /* The show is finished and the score is saved; Enter is the
         reward door, not an exit to confirm. */
      if (e.key === 'Enter') { e.preventDefault(); go(); }
      return;
    }
    if (phase || i >= Q.length) return;
    if (optionKey(e)) { e.preventDefault(); return; }
    var k = 'abcd'.indexOf(String(e.key).toLowerCase());
    if (k >= 0) { e.preventDefault(); answer(k); return; }
    var n = '1234'.indexOf(e.key);
    if (n >= 0) { e.preventDefault(); answer(n); }
  });

  var q = document.getElementById('quizQuit');
  if (q) q.addEventListener('click', function () {
    /* same path as ESC: a confirmed exit, since the score is on the line */
    if (NEU.engine && NEU.engine.confirmExit) NEU.engine.confirmExit('Quiz', close);
    else close();
  });

  NEU.quiz = { open: open, close: close,
               fast: function (on) { fast = !!on; },
               get running() { return open_; },
               get score() { return score; },
               get index() { return i; },
               get phase() { return phase; },
               get ended() { return ended; },
               get limit() { return limit(); },
               get soul() { return { x: soul.x, y: soul.y }; },
               questions: Q, ranks: RANKS,
               rankFor: rankFor, opens: opens };
})();
