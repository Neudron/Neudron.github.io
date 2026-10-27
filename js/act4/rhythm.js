/* rhythm.js — the argument with the merchant.
   ───────────────────────────────────────────────────────────────────
   He will not sell you the axe. He will, however, accept a challenge,
   because he is that kind of person.

   Gameplay timing and scoring ported from Friday Night Funkin' (FunkinCrew/Funkin @a87711a, Apache-2.0).

   TIMING COMES FROM AudioContext.currentTime, NEVER from rAF deltas or
   timers. One songPos (seconds since beat 0) drives the countdown, the
   taunt switch, his notes, your notes and hold gains. rAF drift is small
   per frame and ruinous over a minute, so a chart that starts in time
   stays in time.

   WHAT MAKES IT FAIR:
   1. PBOT1 judgement windows, named on screen: SICK!! ≤45ms, GOOD ≤90,
      BAD ≤135, SHIT ≤160. Past 160 is a miss.
   2. CALL AND RESPONSE. His notes and yours share one song. Yours sit
      four beats after his, so you are asked to repeat, not sightread.
   3. YOU CANNOT LOSE PERMANENTLY. Health runs out, the round restarts,
      and he gets a better line. A press in an empty lane costs nothing. */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};

  var wrap = document.getElementById('fnf');
  if (!wrap) { NEU.rhythm = { open: function () {} }; return; }
  var cv = document.getElementById('fnfCanvas');
  var ctx = cv && cv.getContext ? cv.getContext('2d') : null;
  if (!ctx) { NEU.rhythm = { open: function () {} }; return; }
  var msg = document.getElementById('fnfMsg');
  var won = false;                    // set by win, cashed in by close

  var LANES = ['left', 'down', 'up', 'right'];
  var ARROW = { left: '◀', down: '▼', up: '▲', right: '▶' };
  var LANECOL = ['#C24AE0', '#4AC2E0', '#7BE38A', '#E04A6B'];

  var WINDOW_MS = 160;                // PBOT1 shit edge. Past it, a miss.
  var PIXELS_PER_MS = 0.45;           // Funkin Constants.PIXELS_PER_MS, times the round's speed
  var SPEED = [1.6, 1.9, 2.2];
  var DROP_AFTER = 0.16;              // a hold released with more than this still owed loses score

  /* Judgement table, in PBOT1 order: sick, good, bad, shit, miss. */
  var NAMES = ['SICK!!', 'GOOD', 'BAD', 'SHIT', 'MISS'];
  var EDGE = [45, 90, 135, 160];
  var HEALTH = [0.03, 0.015, 0, -0.02, -0.08];
  var BREAK = [false, false, true, true, true];
  var HEALTH_MAX = 2;

  /* Three rounds. Each is a list of [beat, lane, holdBeats?]; his notes
     play on their beats and yours on the same beats four bars later. */
  var BPM = [104, 122, 140];
  var CHARTS = [
    [[0,0],[1,1],[2,2],[3,3],[4,0,2],[6,1],[6,2],[7,3]],
    [[0,3],[0.5,2],[1,1],[2,0,1],[2.5,3],[3,2],[4,3],[4.5,3],[5,1],[6,2],[7,0]],
    [[0,0],[0.5,1],[1,2],[1.5,3],[2,3],[2.5,2],[3,1],[3.5,0],
     [4,0],[4.5,2],[5,1],[5.5,3],[6,2],[6.5,0,1.5],[7,3],[7.5,1]]
  ];

  var TAUNT = [
    ["you want the axe.", "the axe wants a reason."],
    ["not bad. i've heard worse from a kettle.", "again. faster."],
    ["last one. if you land this i'll feel something."]
  ];

  var actx = null;
  var running = false, round = 0, notes = [], t0 = 0, lastSp = 0, phase = -1;
  var judgedT = 0;
  var keys = {};
  var S = { score: 0, combo: 0, health: 1, judgement: '', countdown: '', round: 0 };

  function audio() {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function now() { return audio().currentTime; }
  function songPos() { return now() - t0; }
  function beatLen() { return 60 / BPM[round]; }
  function ms(d) { return Math.floor(d * 1000 + 1e-6); }

  function build(forYou) {
    var bl = beatLen(), off = forYou ? 4 : 0;
    return CHARTS[round].map(function (n) {
      var t = (off + n[0]) * bl;
      return { t: t, end: t + (n[2] || 0) * bl, lane: n[1], mine: forYou, hit: false, done: false };
    });
  }

  function startRound() {
    t0 = now() + 4 * beatLen();           // four beats of 3-2-1-GO before beat 0
    notes = build(false).concat(build(true));
    lastSp = 0; phase = 0; S.round = round; S.judgement = '';
    say(TAUNT[round][0]);
  }

  function countLabel(sp) {
    if (sp >= 0) return '';
    var i = Math.floor((sp + 4 * beatLen()) / beatLen());
    return ['3', '2', '1', 'GO!'][i] || '';
  }

  function say(s) { if (msg) { msg.hidden = false; msg.textContent = s; } }

  function blip(lane, mine) {
    if (NEU.settings && NEU.settings.muted) return;       /* the Sound switch; timing still runs on the clock */
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

  function addHealth(d) { S.health = Math.min(HEALTH_MAX, Math.max(0, S.health + d)); }

  /* r: 0 sick, 1 good, 2 bad, 3 shit, 4 miss. ms: the timing error. */
  function judge(r, m) {
    /* PBOT1 score curve: flat 500 inside 5 ms, then a sigmoid that floors at 9 */
    var curve = m < 5 ? 500 : Math.floor(500 * (1 - 1 / (1 + Math.exp(-0.08 * (m - 54.99)))) + 9);
    S.score += r === 4 ? -100 : curve;
    addHealth(HEALTH[r]);
    S.combo = BREAK[r] ? 0 : S.combo + 1;
    S.judgement = NAMES[r];
    judgedT = now();
  }

  /* Hold gains for the stretch since the last tick, while the key is down. */
  function tick(sp) {
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      if (!n.mine || !n.hit || n.done || !keys[LANES[n.lane]]) continue;
      var d = Math.min(sp, n.end) - Math.max(lastSp, n.t);
      if (d > 0) { addHealth(0.12 * d); S.score += 250 * d; }
    }
    lastSp = sp;
  }

  function press(lane) {
    if (!running) return;
    var sp = songPos(), best = null, bm = WINDOW_MS + 1;
    tick(sp);
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      if (!n.mine || n.hit || n.lane !== lane) continue;
      var m = ms(Math.abs(n.t - sp));
      if (m <= WINDOW_MS && m < bm) { bm = m; best = n; }
    }
    if (!best) return;                  /* ghost tap: forgiven, no penalty */
    best.hit = true;
    if (best.end === best.t) best.done = true;
    judge(bm <= EDGE[0] ? 0 : bm <= EDGE[1] ? 1 : bm <= EDGE[2] ? 2 : 3, bm);
    blip(lane, true);
  }

  /* Key up: a hold released early loses 125 per second still owed past 160 ms. */
  function release(lane) {
    if (!running) return;
    var sp = songPos();
    tick(sp);
    notes.forEach(function (n) {
      if (!n.mine || n.lane !== lane || !n.hit || n.done) return;
      n.done = true;
      var rem = n.end - sp;
      if (rem > DROP_AFTER) S.score -= 125 * rem;
    });
  }

  function step() {
    if (!running) return;
    requestAnimationFrame(step);
    var sp = songPos();
    S.countdown = countLabel(sp);
    /* Leave prompt up: hold the frame. Notes that pass meanwhile are judged on resume. */
    if (NEU.juice && NEU.juice.frozen()) { lastSp = sp; draw(sp); return; }

    var ph = ms(sp - 4 * beatLen()) >= 0 ? 1 : 0;
    if (ph !== phase) { phase = ph; say(TAUNT[round][ph] || 'go.'); }
    tick(sp);

    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      if (n.done) continue;
      if (!n.mine) {
        if (sp >= n.t) { n.hit = n.done = true; blip(n.lane, false); }
      } else if (!n.hit && ms(sp - n.t) > WINDOW_MS) {
        n.done = true; judge(4, 0);
      } else if (n.hit && sp >= n.end) {
        n.done = true;
      }
    }

    if (S.health <= 0) { lose(); return; }
    if (notes.every(function (n) { return n.done; })) { nextRound(); return; }
    draw(sp);
  }

  function nextRound() {
    round++;
    if (round >= CHARTS.length) { win(); return; }
    startRound();
  }

  function win() {
    running = false;
    won = true;
    if (NEU.save) NEU.save.give('axe');
    if (NEU.quest) NEU.quest.mark('a4_axe');
    if (msg) {
      msg.hidden = false;
      msg.innerHTML = '<b>he hands you the axe.</b><br>' +
        '"that was rude and i respect it."<br><small>esc to leave</small>';
    }
    draw(songPos());
  }

  function lose() {
    running = false;
    if (msg) {
      msg.hidden = false;
      msg.innerHTML = '<b>he stops, mid-bar.</b><br>' +
        '"no."<br><small>enter to go again &middot; esc to leave</small>';
    }
    draw(songPos());
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

  function draw(sp) {
    var w = innerWidth, h = innerHeight;
    ctx.fillStyle = '#120A1E'; ctx.fillRect(0, 0, w, h);

    var laneW = 64, gap = 12;
    var totalW = LANES.length * (laneW + gap) - gap;
    var mineX = w / 2 + 60;
    var hisX  = w / 2 - 60 - totalW;
    var hitY = h - 150;
    var K = 1000 * PIXELS_PER_MS * SPEED[round];

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
      if (n.done) continue;
      var y = Math.round(hitY - (n.t - sp) * K);
      var top = Math.round(hitY - (n.end - sp) * K);
      var lo = Math.min(y, top), hi = Math.max(y, top);
      if (hi < 40 || lo > hitY + 40) continue;
      var x0 = n.mine ? mineX : hisX;
      var x = x0 + n.lane * (laneW + gap);
      ctx.fillStyle = n.mine ? LANECOL[n.lane] : '#4A3C62';
      if (n.end > n.t) ctx.fillRect(x + 24, top, laneW - 48, y - top);
      ctx.fillRect(x + 6, y - 8, laneW - 12, 16);
    }

    /* the countdown, then the tug of war */
    if (S.countdown) {
      ctx.fillStyle = '#EDE7DE';
      ctx.font = '32px "Determination Sans","Pixelify Sans",monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(S.countdown, w / 2, h / 2);
    }
    var bw = Math.min(560, w - 80), bx = (w - bw) / 2;
    ctx.fillStyle = '#E04A6B'; ctx.fillRect(bx, 20, bw, 16);
    ctx.fillStyle = '#7BE38A'; ctx.fillRect(bx, 20, (bw * S.health / HEALTH_MAX) | 0, 16);
    ctx.fillStyle = '#EDE7DE';
    ctx.font = '16px "Determination Mono","Pixelify Sans",monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('round ' + Math.min(round + 1, CHARTS.length) + ' / ' + CHARTS.length +
                 '   score ' + Math.floor(S.score) + '   combo ' + S.combo, bx, 44);

    if (S.judgement && now() - judgedT < 0.6) {
      ctx.textAlign = 'center';
      ctx.fillStyle = S.judgement === 'MISS' ? '#E04A6B'
                    : S.judgement === 'SICK!!' ? '#FFD34E' : '#7BE38A';
      ctx.font = '32px "Determination Sans","Pixelify Sans",monospace';
      ctx.fillText(S.judgement, w / 2, hitY - 90);
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
    if (l >= 0) { release(l); keys[LANES[l]] = false; }
  });

  function retry() {
    wrap.hidden = false;
    document.body.classList.add('is-playing');
    if (NEU.quest) NEU.quest.lock(true);
    if (msg) msg.hidden = true;
    layout();
    S.health = 1; S.combo = 0; keys = {};
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
    round = 0; S.score = 0; S.combo = 0; S.health = 1; keys = {};
    running = true;
    startRound();
    requestAnimationFrame(step);
  }
  /* The counter axe leaves the room for good, and the line about it
     waits until the overlay is gone (see close). */
  function takeAxe() {
    var api = NEU.engine && NEU.engine.api;
    var axe = api && api.ents().filter(function (e) { return e.sheet === 'axe'; })[0];
    if (axe && NEU.take) NEU.take(axe, 'axe');
  }

  function close() {
    running = false;
    /* release the input claim before handing control back to the room */
    if (NEU.activeMinigame === 'rhythm') NEU.activeMinigame = null;
    wrap.hidden = true;
    document.body.classList.remove('is-playing');
    if (NEU.quest) NEU.quest.lock(false);
    if (NEU.engine) NEU.engine.enter('d1_street', 'fire');
    if (won) { won = false; takeAxe(); }
  }

  var q = document.getElementById('fnfQuit');
  if (q) q.addEventListener('click', function () {
    /* same path as ESC: a confirmed exit, since the round is on the line */
    if (NEU.engine && NEU.engine.confirmExit) NEU.engine.confirmExit('Rhythm Game', close);
    else close();
  });

  NEU.rhythm = { open: open, close: close, win: win,
                 get running() { return running; },
                 state: S,
                 charts: CHARTS, bpm: BPM, WINDOW: WINDOW_MS / 1000 };
})();
