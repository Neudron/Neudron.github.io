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

  var TIME = 12;
  var i = 0, score = 0, t = 0, tick = null, askTimer = null, locked = false, open_ = false;
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
    i = 0; score = 0; locked = false;
    if (elEnd) elEnd.hidden = true;
    board();
    roundBanner('ROUND 1: THE LEGEND OF TENNA');
    host(TENNA.intro.join('  '));
    /* No options exist yet, so the quit button is the way in. */
    var q0 = document.getElementById('quizQuit');
    if (q0 && q0.focus) q0.focus();
    askTimer = setTimeout(ask, pace(2400));
  }

  function close() {
    open_ = false;
    clearInterval(tick);
    /* A pending "next question" timer must die with the overlay. If
       it survived, ask() would keep rebuilding the board on a hidden
       wrapper, the timer would run the whole show into a phantom "Z"
       finish, and the rank door would mark itself a4_rank behind the
       player's back. */
    clearTimeout(askTimer);
    askTimer = null;
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
       (pace is 0, dodgeStart calls dodgeDone immediately). */
    if (i === 10 && !dodgeLoop && !fast) { dodgeStart(8); return; }
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
    t = TIME;
    clearInterval(tick);
    tick = setInterval(function () {
      t -= 0.1;
      if (elBar) elBar.style.width = Math.max(0, (t / TIME) * 100) + '%';
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
        'enter to go and see &middot; esc to try again</p>';
    }
    host(TENNA.finish);
    /* His reaction to the rank itself, shown after the end screen. */
    var react = TENNA.rank[rank];
    if (react) setTimeout(function () { if (open_) host(react); }, pace(1800));
    /* Off the dead option buttons. The global Enter handler below
       preventDefaults, so Enter here retries the show rather than
       activating whatever the caret was left sitting on. */
    var qq = document.getElementById('quizQuit');
    if (qq && qq.focus) qq.focus();
  }

  /* ── the physical challenge: DODGE FIRE ───────────────────────────────────────
     Round 1 Phase B and the bonus layer. Fire rains; the SOUL (a
     red dot) dodges left and right for a fixed duration. Each hit
     subtracts from the round score. This is the DODGE FIRE minigame
     from the Tenna boss battle, adapted to the quiz canvas.

     The phase is gated behind `fast`: tests drive the show with
     fast(true) which collapses pacing to zero, so the dodge timer
     fires instantly and the phase is a no-op. Real players get the
     full dodge. */
  var cv = document.getElementById('quizCanvas');
  var cx = cv ? cv.getContext('2d') : null;
  var soul = { x: 240, y: 210 }, dodgeTime = 0, dodgeHits = 0, dodgeLoop = null;
  var fires = [];

  function dodgeStart(duration) {
    if (!cv || !cx || fast) { dodgeDone(); return; }
    soul = { x: 240, y: 210 }; dodgeTime = duration; dodgeHits = 0; fires = [];
    cv.hidden = false;
    if (elOpts) elOpts.innerHTML = '';
    if (elQ) elQ.textContent = '';
    host("DODGE FIRE! don't get hit!");
    dodgeLoop = setInterval(dodgeTick, 33);
  }

  function dodgeTick() {
    if (!open_ || fast) { clearInterval(dodgeLoop); cv.hidden = true; dodgeDone(); return; }
    dodgeTime -= 0.033;
    if (Math.random() < 0.4)
      fires.push({ x: Math.random() * 480, y: 0, vy: 80 + Math.random() * 80 });
    cx.fillStyle = '#0E0820'; cx.fillRect(0, 0, 480, 240);
    cx.fillStyle = '#FF6B2A';
    for (var f = fires.length - 1; f >= 0; f--) {
      fires[f].y += fires[f].vy * 0.033;
      if (fires[f].y > 240) { fires.splice(f, 1); continue; }
      cx.fillRect(fires[f].x, fires[f].y, 8, 12);
      if (Math.abs(fires[f].x - soul.x) < 10 && Math.abs(fires[f].y - soul.y) < 10) {
        dodgeHits++; fires.splice(f, 1);
      }
    }
    cx.fillStyle = '#FF2030'; cx.fillRect(soul.x - 4, soul.y - 4, 8, 8);
    if (dodgeTime <= 0) { clearInterval(dodgeLoop); cv.hidden = true; dodgeDone(); }
  }

  function dodgeDone() {
    if (elQ) elQ.textContent = '';
    cv.hidden = true;
    roundBanner('ROUND 2: THE ONE I SAID WAS LAST');
    host('ROUND TWO! the one i said was last! i lied!');
    askTimer = setTimeout(ask, pace(800));
  }

  /* Arrow keys move the SOUL during the dodge phase. The global
     keydown handler below calls this; it returns true if it
     consumed the key, so the trivia handler can skip it. */
  function dodgeKey(e) {
    if (!dodgeLoop || fast) return false;
    var s = 24;
    if (e.key === 'ArrowLeft')  { soul.x = Math.max(8, soul.x - s); return true; }
    if (e.key === 'ArrowRight') { soul.x = Math.min(472, soul.x + s); return true; }
    if (e.key === 'ArrowUp')    { soul.y = Math.max(8, soul.y - s); return true; }
    if (e.key === 'ArrowDown')  { soul.y = Math.min(232, soul.y + s); return true; }
    return false;
  }

  addEventListener('keydown', function (e) {
    if (!open_) return;
    if (dodgeKey(e)) { e.preventDefault(); return; }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (i >= Q.length) { open_ = false; open(); return; }
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
    if (i >= Q.length && e.key === 'Enter') {
      e.preventDefault();
      /* The show is finished and the score is saved; Enter is the
         reward door, not an exit to confirm. Close and walk into the
         prize corridor the show was always meant to open. */
      close();
      if (NEU.engine && NEU.engine.enter) NEU.engine.enter('g0_hall');
      return;
    }
    var k = 'abcd'.indexOf(String(e.key).toLowerCase());
    if (k >= 0 && i < Q.length) { e.preventDefault(); answer(k); return; }
    var n = '1234'.indexOf(e.key);
    if (n >= 0 && i < Q.length) { e.preventDefault(); answer(n); }
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
               questions: Q, ranks: RANKS,
               rankFor: rankFor, opens: opens };
})();
