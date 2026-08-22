/* rhythm.js — the argument with the merchant.
   ───────────────────────────────────────────────────────────────────
   He will not sell you the axe. He will, however, accept a challenge,
   because he is that kind of person.

   THE ONE THING THAT MATTERS TECHNICALLY:
   TIMING COMES FROM AudioContext.currentTime, NEVER from accumulated
   requestAnimationFrame deltas. rAF drift is small per frame and
   ruinous over a minute — a chart that starts in time is a quarter of
   a beat late by the second verse, and the player correctly concludes
   the game is broken. The audio clock is the only clock.

   WHAT MAKES IT FAIR:

   1. THE HIT WINDOW IS GENEROUS AND SHOWN. ±140ms, and every judgement
      is named on screen the moment it happens.

   2. THE CHART IS CALL AND RESPONSE. He plays four bars, then you play
      the same four bars back. You are never asked to sightread — you
      are asked to repeat, which is what a rap battle IS.

   3. THREE ROUNDS, EACH SHORTER THAN THE LAST, EACH FASTER. Failing
      restarts the round, not the battle.

   4. YOU CANNOT LOSE PERMANENTLY. Losing sends you back to the room
      with the axe still on the counter, and he gets a better line. */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};

  var wrap = document.getElementById('fnf');
  if (!wrap) { NEU.rhythm = { open: function () {} }; return; }
  var cv = document.getElementById('fnfCanvas');
  var ctx = cv && cv.getContext ? cv.getContext('2d') : null;
  if (!ctx) { NEU.rhythm = { open: function () {} }; return; }
  var msg = document.getElementById('fnfMsg');

  var LANES = ['left', 'down', 'up', 'right'];
  var ARROW = { left: '◀', down: '▼', up: '▲', right: '▶' };
  var LANECOL = ['#C24AE0', '#4AC2E0', '#7BE38A', '#E04A6B'];

  var WINDOW = 0.14;        // seconds either side. generous on purpose.
  var SCROLL = 320;         // px per second the notes travel

  /* Three rounds. Each is a list of [beat, lane]; the call is his and
     the response is yours, so the chart is written once and played
     twice with a bar offset. */
  var BPM = [104, 122, 140];
  var CHARTS = [
    [[0,0],[1,1],[2,2],[3,3],[4,0],[5,0],[6,2],[7,3]],
    [[0,3],[0.5,2],[1,1],[2,0],[2.5,0],[3,2],[4,3],[4.5,3],[5,1],[6,2],[7,0]],
    [[0,0],[0.5,1],[1,2],[1.5,3],[2,3],[2.5,2],[3,1],[3.5,0],
     [4,0],[4.5,2],[5,1],[5.5,3],[6,2],[6.5,0],[7,3],[7.5,1]]
  ];

  var TAUNT = [
    ["you want the axe.", "the axe wants a reason."],
    ["not bad. i've heard worse from a kettle.", "again. faster."],
    ["last one. if you land this i'll feel something."]
  ];

  var actx = null;
  var running = false, round = 0, notes = [], t0 = 0;
  var phaseTimer = 0;         /* call→response switch — cleared on close/restart so a stale
                                 timer can't concat its chart onto the next round */
  var hp = 0.5, judged = '', judgedT = 0, misses = 0;
  var phase = 'call';        // call | response
  var keys = {};

  function audio() {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function now() { return audio().currentTime; }

  function beatLen() { return 60 / BPM[round]; }

  function build(forYou) {
    var bl = beatLen();
    /* His bars run first; yours start one bar (4 beats) later. Same
       chart, shifted — that is what makes it call-and-response rather
       than two unrelated songs. */
    var off = forYou ? 4 * bl : 0;
    return CHARTS[round].map(function (n) {
      return { t: t0 + off + n[0] * bl, lane: n[1], hit: false, mine: forYou };
    });
  }

  function startRound() {
    if (phaseTimer) { clearTimeout(phaseTimer); phaseTimer = 0; }
    phase = 'call';
    t0 = now() + 1.4;
    notes = build(false);
    misses = 0;
    say(TAUNT[round][0] || '');
    /* His bar plays itself; yours arrives a bar later. */
    phaseTimer = setTimeout(function () {
      phaseTimer = 0;
      if (!running) return;
      phase = 'response';
      notes = notes.concat(build(true));
      say(TAUNT[round][1] || 'go.');
    }, 1400 + 4 * beatLen() * 1000);
  }

  function say(s) { judged = ''; if (msg) { msg.hidden = false; msg.textContent = s; } }

  function blip(lane, mine) {
    try {
      var a = audio(), tt = a.currentTime;
      var o = a.createOscillator(), g = a.createGain();
      o.type = mine ? 'square' : 'triangle';
      o.frequency.setValueAtTime([220, 294, 370, 440][lane] * (mine ? 2 : 1), tt);
      g.gain.setValueAtTime(mine ? 0.09 : 0.06, tt);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.14);
      o.connect(g); g.connect(a.destination);
      o.start(tt); o.stop(tt + 0.15);
    } catch (e) {}
  }

  function press(lane) {
    if (!running || phase !== 'response') return;
    var tn = now(), best = null, bd = 9;
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      if (!n.mine || n.hit || n.lane !== lane) continue;
      var d = Math.abs(n.t - tn);
      if (d < bd) { bd = d; best = n; }
    }
    if (best && bd <= WINDOW) {
      best.hit = true;
      hp = Math.min(1, hp + 0.045);
      judged = bd < 0.05 ? 'PERFECT' : bd < 0.09 ? 'GOOD' : 'OK';
      judgedT = tn;
      blip(lane, true);
    } else {
      hp = Math.max(0, hp - 0.03);
      judged = 'MISS'; judgedT = tn;
      if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
    }
  }

  function step() {
    if (!running) return;
    requestAnimationFrame(step);
    var tn = now();

    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      if (n.hit) continue;
      if (!n.mine && tn >= n.t) { n.hit = true; blip(n.lane, false); continue; }
      if (n.mine && tn > n.t + WINDOW) {
        n.hit = true; misses++;
        hp = Math.max(0, hp - 0.055);
        judged = 'MISS'; judgedT = tn;
      }
    }

    if (hp <= 0) { lose(); return; }

    var mine = notes.filter(function (n) { return n.mine; });
    if (phase === 'response' && mine.length && mine.every(function (n) { return n.hit; })) {
      if (tn > mine[mine.length - 1].t + 0.5) nextRound();
    }
    draw(tn);
  }

  function nextRound() {
    round++;
    if (round >= CHARTS.length) { win(); return; }
    hp = Math.min(1, hp + 0.15);
    startRound();
  }

  function win() {
    running = false;
    if (NEU.save) NEU.save.give('axe');
    if (NEU.quest) NEU.quest.mark('a4_axe');
    if (msg) {
      msg.hidden = false;
      msg.innerHTML = '<b>he hands you the axe.</b><br>' +
        '"that was rude and i respect it."<br><small>esc to leave</small>';
    }
    draw(now());
  }

  function lose() {
    running = false;
    if (msg) {
      msg.hidden = false;
      msg.innerHTML = '<b>he stops, mid-bar.</b><br>' +
        '"no."<br><small>enter to go again &middot; esc to leave</small>';
    }
    draw(now());
  }

  /* ── draw ───────────────────────────────────────────────────────*/
  function layout() {
    var dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = (innerWidth * dpr) | 0; cv.height = (innerHeight * dpr) | 0;
    cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }
  addEventListener('resize', function () { if (running) layout(); });

  function draw(tn) {
    var w = innerWidth, h = innerHeight;
    ctx.fillStyle = '#120A1E'; ctx.fillRect(0, 0, w, h);

    var laneW = 64, gap = 12;
    var totalW = LANES.length * (laneW + gap) - gap;
    var mineX = w / 2 + 60;
    var hisX  = w / 2 - 60 - totalW;
    var hitY = h - 150;

    [hisX, mineX].forEach(function (x0, side) {
      for (var l = 0; l < 4; l++) {
        var x = x0 + l * (laneW + gap);
        ctx.strokeStyle = '#2A1C42'; ctx.lineWidth = 2;
        ctx.strokeRect(x, 60, laneW, hitY - 60);
        /* the receptor */
        ctx.fillStyle = side ? LANECOL[l] : '#3A2C52';
        ctx.globalAlpha = side ? (keys[LANES[l]] ? 1 : 0.42) : 0.4;
        ctx.fillRect(x, hitY, laneW, 10);
        ctx.globalAlpha = 1;
        ctx.fillStyle = side ? '#EDE7DE' : '#5A4C72';
        ctx.font = '32px "Determination Mono","Pixelify Sans",monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(ARROW[LANES[l]], x + laneW / 2, hitY + 30);
      }
    });

    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      if (n.hit) continue;
      var dy = (n.t - tn) * SCROLL;
      var y = hitY - dy;
      if (y < 40 || y > hitY + 40) continue;
      var x0 = n.mine ? mineX : hisX;
      var x = x0 + n.lane * (laneW + gap);
      ctx.fillStyle = n.mine ? LANECOL[n.lane] : '#4A3C62';
      ctx.fillRect(x + 6, y - 8, laneW - 12, 16);
    }

    /* tug of war */
    var bw = Math.min(560, w - 80), bx = (w - bw) / 2;
    ctx.fillStyle = '#E04A6B'; ctx.fillRect(bx, 20, bw, 16);
    ctx.fillStyle = '#7BE38A'; ctx.fillRect(bx, 20, (bw * hp) | 0, 16);
    ctx.fillStyle = '#EDE7DE';
    ctx.font = '16px "Determination Mono","Pixelify Sans",monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('round ' + Math.min(round + 1, CHARTS.length) + ' / ' + CHARTS.length, bx, 44);

    if (judged && tn - judgedT < 0.6) {
      ctx.textAlign = 'center';
      ctx.fillStyle = judged === 'MISS' ? '#E04A6B'
                    : judged === 'PERFECT' ? '#FFD34E' : '#7BE38A';
      ctx.font = '32px "Determination Sans","Pixelify Sans",monospace';
      ctx.fillText(judged, w / 2, hitY - 90);
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  /* ── input ──────────────────────────────────────────────────────*/
  function laneOf(e) {
    var k = e.key;
    if (k === 'ArrowLeft'  || k === 'a' || k === 'A') return 0;
    if (k === 'ArrowDown'  || k === 's' || k === 'S') return 1;
    if (k === 'ArrowUp'    || k === 'w' || k === 'W') return 2;
    if (k === 'ArrowRight' || k === 'd' || k === 'D') return 3;
    return -1;
  }
  addEventListener('keydown', function (e) {
    if (wrap.hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (NEU.engine && NEU.engine.confirmExit) {
        NEU.engine.confirmExit('Rhythm Game', close);
      } else { close(); }
      return;
    }
    if (!running && e.key === 'Enter') { e.preventDefault(); retry(); return; }
    var l = laneOf(e);
    if (l >= 0) { e.preventDefault(); if (!keys[LANES[l]]) press(l); keys[LANES[l]] = true; }
  });
  addEventListener('keyup', function (e) {
    var l = laneOf(e);
    if (l >= 0) keys[LANES[l]] = false;
  });

  function retry() {
    wrap.hidden = false;
    document.body.classList.add('is-playing');
    if (NEU.quest) NEU.quest.lock(true);
    if (msg) msg.hidden = true;
    layout();
    hp = 0.5; keys = {}; judged = '';
    running = true;
    startRound();
    requestAnimationFrame(step);
  }
  function open() {
    wrap.hidden = false;
    NEU.activeMinigame = 'rhythm';      /* the room underneath must not move or take Escape */
    document.body.classList.add('is-playing');
    if (NEU.quest) NEU.quest.lock(true);
    if (msg) msg.hidden = true;
    layout();
    round = 0; hp = 0.5; keys = {}; judged = '';
    running = true;
    startRound();
    requestAnimationFrame(step);
  }
  function close() {
    running = false;
    if (phaseTimer) { clearTimeout(phaseTimer); phaseTimer = 0; }
    /* release the input claim before handing control back to the room */
    if (NEU.activeMinigame === 'rhythm') NEU.activeMinigame = null;
    wrap.hidden = true;
    document.body.classList.remove('is-playing');
    if (NEU.quest) NEU.quest.lock(false);
    if (NEU.engine) NEU.engine.enter('d1_street', 'fire');
  }

  var q = document.getElementById('fnfQuit');
  if (q) q.addEventListener('click', function () {
    /* same path as ESC: a confirmed exit, since the round is on the line */
    if (NEU.engine && NEU.engine.confirmExit) NEU.engine.confirmExit('Rhythm Game', close);
    else close();
  });

  NEU.rhythm = { open: open, close: close,
                 get running() { return running; },
                 get round() { return round; },
                 get hp() { return hp; },
                 charts: CHARTS, bpm: BPM, WINDOW: WINDOW };
})();
