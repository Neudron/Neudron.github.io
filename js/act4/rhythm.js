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
  var hintEl = wrap.querySelector('.bh__keys');   /* the key hint: it rides the floor, off the valance */
  var won = false;                    // set by win, cashed in by close

  var LANES = ['left', 'down', 'up', 'right'];
  var LANECOL = ['#C24AE0', '#4AC2E0', '#7BE38A', '#E04A6B'];
  var LIGHT   = ['#EBB0F7', '#B0EBF7', '#C9F7D0', '#F7B0C0'];
  var DARK    = ['#5E1C75', '#1C5E75', '#2A7038', '#751C33'];
  var INK = '#0E0818';
  var reduced = (window.NEU && window.NEU.motion) ? window.NEU.motion.reduced() : !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  /* NEU.motion (motion.js) is the one source; it can change live. */
  if (window.NEU && window.NEU.motion) window.NEU.motion.on(function (r) { reduced = r; });
  function still() { return reduced || !!(NEU.settings && NEU.settings.reduced); }

  var WINDOW_MS = 160;                // PBOT1 shit edge. Past it, a miss.
  var PIXELS_PER_MS = 0.45;           // Funkin Constants.PIXELS_PER_MS, times the round's speed
  var SPEED = [1.6, 1.9, 2.2];
  var DROP_AFTER = 0.16;              // a hold released with more than this still owed loses score

  /* Judgement table, in PBOT1 order: sick, good, bad, shit, miss. */
  var NAMES = ['SICK!!', 'GOOD', 'BAD', 'SHIT', 'MISS'];
  var POPCOL = ['#FFD34E', '#7BE38A', '#4AC2E0', '#EBB0F7', '#F7708E'];
  var ACC = [1, 0.75, 0.5, 0.25, 0];  /* accuracy weight per judgement */
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
  /* Four sections of one song, beat 0 through SONG. Breaks are the dodge
     start; the arrows ease out before that and back after (see EASE_*). */
  var SECTIONS = 4, SONG = 104, DODGE = 8;
  var EASE_IN = 0.6;                 /* the arrows fade out before the soul moves */
  var EASE_OUT = 0.1;                /* and are back almost at once after it: this is the return */
  var INTRO = 2.4;                   /* mics collide, explode, the disco sphere drops */
  var MAX_MISS = 5;                  /* five notes in a row missed and the fight is lost */
  var SEC = [0, 26, 52, 78];
  var BREAK_AT = [14, 40, 66, 92];   /* four soul sections, four attack patterns */
  var PAT_GAP = [0.55, 1.0, 1.4, 1.5];   /* seconds between hazard spawns, per pattern */
  var ITEMS = [
    [0.55, 1, 'bomb'], [7, 0, 'coin'], [8.2, 2, 'potion'], [9.4, 3, 'axe'],
    [10.6, 0, 'mushroom'], [11.8, 1, 'recall'],
    [33, 0, 'coin'], [34.2, 1, 'bomb'], [35.4, 2, 'potion'], [36.6, 3, 'axe'],
    [59, 1, 'mushroom'], [60.5, 2, 'recall'], [62, 0, 'coin'],
    [85, 3, 'axe'], [86.5, 1, 'bomb'], [88, 0, 'potion'], [103.6, 0, 'coin']
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
  var S = { brk: '', score: 0, combo: 0, health: 1, judgement: '', countdown: '', round: 0,
            misses: 0, consecMiss: 0, acc: 1, judged: 0, weight: 0,
            section: 0, mode: 'chart', arrowA: 1, sway: 0, swayUntil: 0,
            blockLane: -1, blockUntil: 0,
            soulx: 0, souly: 0, hazards: [], pattern: 0, spawnN: 0, paused: false, introT: 0 };
  var pops = [], splashes = [];
  var raf = 0, soulF = null, hazBreak = -1, lastBrk = 0, loopSrc = null;
  var introOn = false, boomed = false, crowdCache = null;
  var pausedAt = 0, msgCentered = false;
  var confirmAt = [[-9, -9, -9, -9], [-9, -9, -9, -9]];   /* [his, mine][lane], audio time */
  var singAt = [-9, -9], singLane = [0, 0];

  function audio() {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function now() { return audio().currentTime; }
  /* while paused the song clock stands still at the pause point */
  function songPos() { return (S.paused ? pausedAt : now()) - t0; }
  function beatLen() { return 60 / BPM[round]; }
  function blOf(sp) { return 60 / BPM[Math.min(sectionOf(sp), BPM.length - 1)]; }
  function ms(d) { return Math.floor(d * 1000 + 1e-6); }
  function sectionOf(sp) {
    var s = 0, i;
    for (i = 0; i < SEC.length; i++) if (sp >= SEC[i]) s = i;
    return s;
  }
  function breakPhase(sp) {
    var i, b, u;
    for (i = 0; i < BREAK_AT.length; i++) {
      b = BREAK_AT[i];
      if (sp >= b - EASE_IN && sp < b) { u = (sp - (b - EASE_IN)) / EASE_IN; return { i: i, name: 'in', u: u }; }
      if (sp >= b && sp < b + DODGE) return { i: i, name: 'dodge', u: 1 };
      if (sp >= b + DODGE && sp < b + DODGE + EASE_OUT) {
        u = (sp - (b + DODGE)) / EASE_OUT; return { i: i, name: 'out', u: u };
      }
    }
    return null;
  }
  function songHasTail() {
    var i;
    for (i = 0; i < notes.length; i++) if (notes[i].t > 20) return true;
    return false;
  }

  function build(forYou) {
    var bl = beatLen(), off = forYou ? 4 : 0;
    return CHARTS[round].map(function (n) {
      var t = (off + n[0]) * bl;
      return { t: t, end: t + (n[2] || 0) * bl, lane: n[1], mine: forYou, hit: false, done: false };
    });
  }

  function appendSong() {
    var i, s, bl, chart, n, t;
    for (i = 0; i < ITEMS.length; i++) {
      notes.push({ t: ITEMS[i][0], end: ITEMS[i][0], lane: ITEMS[i][1], mine: true,
        hit: false, done: false, kind: ITEMS[i][2] });
    }
    for (s = 1; s < SECTIONS; s++) {
      bl = 60 / BPM[Math.min(s, 2)];
      chart = CHARTS[Math.min(s, 2)];
      for (i = 0; i < chart.length; i++) {
        n = chart[i];
        t = SEC[s] + n[0] * bl;
        notes.push({ t: t, end: t + (n[2] || 0) * bl, lane: n[1], mine: false, hit: false, done: false });
        t = SEC[s] + (4 + n[0]) * bl;
        notes.push({ t: t, end: t + (n[2] || 0) * bl, lane: n[1], mine: true, hit: false, done: false });
      }
    }
  }
  function resetFeel() {
    S.section = 0; S.mode = 'chart'; S.arrowA = 1;
    S.sway = 0; S.swayUntil = 0;
    S.blockLane = -1; S.blockUntil = 0; S.soulx = 0; S.souly = 0; S.hazards = [];
    soulF = null; hazBreak = -1; lastBrk = 0;
  }
  /* the score, the streak and the judgement counts start from nothing */
  function resetScore() {
    S.score = 0; S.combo = 0; S.misses = 0; S.judged = 0; S.weight = 0; S.acc = 1;
    S.consecMiss = 0; pops.length = 0;
  }
  function backing() {
    if (NEU.settings && NEU.settings.muted) return;
    try {
      var a = audio(), bl = beatLen(), sr = a.sampleRate || 44100;
      var frames = (sr * bl) | 0;
      if (frames < 8) frames = 8;
      var buf = a.createBuffer(1, frames, sr);
      var data = buf.getChannelData(0);
      var i, t;
      for (i = 0; i < data.length; i++) {
        t = i / sr;
        data[i] = (t < 0.03 ? 0.45 : 0) + Math.sin(2 * Math.PI * 110 * t) * 0.18;
      }
      if (loopSrc && loopSrc.stop) { try { loopSrc.stop(); } catch (e1) {} }
      var g = a.createGain(), sp = songPos();
      g.gain.setValueAtTime(0.08, a.currentTime);
      loopSrc = a.createBufferSource();
      loopSrc.buffer = buf;
      loopSrc.loop = true;
      loopSrc.connect(g); g.connect(a.destination);
      /* from the top at beat 0, or mid-loop when resuming from a pause */
      if (sp < 0) loopSrc.start(t0); else loopSrc.start(now(), ((sp % bl) + bl) % bl);
      loopSrc.stop(t0 + SONG);
    } catch (e2) {}
  }
  /* lead: the first round of a fight, which opens with the intro */
  function startRound(lead) {
    introOn = !!lead; boomed = false;
    t0 = now() + (introOn ? INTRO : 0) + 4 * beatLen();   // then 3-2-1-GO before beat 0
    notes = build(false).concat(build(true));
    if (round === 0) appendSong();
    lastSp = 0; phase = 0; S.round = round; S.judgement = '';
    resetFeel();
    say(TAUNT[round][0]);
    backing();
  }

  function countLabel(sp) {
    if (sp >= 0) return '';
    var i = Math.floor((sp + 4 * beatLen()) / beatLen());
    return ['3', '2', '1', 'GO!'][i] || '';
  }

  /* the Deltarune box at the bottom; the loss popup takes the centre instead */
  function placeMsg(centre) {
    if (!msg) return;
    msgCentered = !!centre;
    if (!centre) { msg.style.cssText = ''; return; }
    msg.style.left = '50%'; msg.style.right = 'auto';
    msg.style.top = '50%'; msg.style.bottom = 'auto';
    msg.style.transform = 'translate(-50%, -50%)';
    msg.style.width = 'min(640px, calc(100% - 32px))';
    msg.style.textAlign = 'center';
  }
  function say(s) { if (msg) { placeMsg(false); msg.hidden = false; msg.textContent = s; } }

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
  function judge(r, m, free) {
    /* PBOT1 score curve: flat 500 inside 5 ms, then a sigmoid that floors at 9 */
    var curve = m < 5 ? 500 : Math.floor(500 * (1 - 1 / (1 + Math.exp(-0.08 * (m - 54.99)))) + 9);
    S.score += r === 4 ? -100 : curve;
    addHealth(HEALTH[r]);
    S.combo = BREAK[r] ? 0 : S.combo + 1;
    S.judgement = NAMES[r];
    judgedT = now();
    S.judged++; S.weight += ACC[r]; S.acc = S.weight / S.judged;
    /* only a note that went by counts toward the five-in-a-row; a stray tap or a bomb neither adds nor clears */
    if (r === 4) { S.misses++; if (!free) S.consecMiss++; } else S.consecMiss = 0;
    /* Funkin pops the rating and, from a combo of 10, the digits. Ours
       pop beside the player strumline, never in the middle. */
    var g = geom(), y = g.popY;
    pops.push({ text: NAMES[r], x: g.cx, y: y, t: judgedT, col: POPCOL[r], size: 48 });
    if (S.combo >= 10) {
      pops.push({ text: ('00' + S.combo).slice(-Math.max(3, String(S.combo).length)),
                  x: g.cx, y: y + 56, t: judgedT, col: '#FFFFFF', size: 32 });
    }
    if (pops.length > 8) pops.splice(0, pops.length - 8);
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

  function applyKind(n, sp) {
    if (n.kind === 'coin') S.score += 200;
    else if (n.kind === 'potion') addHealth(0.3);
    else if (n.kind === 'axe') { S.blockLane = n.lane; S.blockUntil = sp + 2 * blOf(sp); }
    else if (n.kind === 'mushroom') { S.sway = still() ? 0 : 12; S.swayUntil = sp + 2; }
    else if (n.kind === 'recall') { S.consecMiss = 0; addHealth(0.15); }   /* the potion calls you back: the streak and some health */
    if (n.kind && NEU.juice) NEU.juice.hit('small');
  }
  /* mushroom notes fall from the top; every other note rises from the bottom */
  function dirOf(n) { return n.kind === 'mushroom' ? -1 : 1; }
  function press(lane) {
    if (!running || S.paused) return;
    var sp = songPos();
    if (breakPhase(sp) || (introOn && sp < -4 * beatLen())) return;      /* the mic intro has nothing to hit */
    if (lane === S.blockLane && sp < S.blockUntil) return;
    var best = null, bm = WINDOW_MS + 1;
    tick(sp);
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      if (!n.mine || n.hit || n.lane !== lane) continue;
      var m = ms(Math.abs(n.t - sp));
      if (m <= WINDOW_MS && m < bm) { bm = m; best = n; }
    }
    if (!best) { judge(4, 0, true); return; } /* ghost tap: a miss, so mashing cannot farm health */
    best.hit = true;
    confirmAt[1][lane] = singAt[1] = now(); singLane[1] = lane;
    if (best.kind === 'bomb') {
      best.done = true;
      judge(4, bm, true);
      if (NEU.juice) NEU.juice.burst(S.soulx || 80, S.souly || 80, 8, '#E04A6B', 1);
      return;
    }
    if (bm <= EDGE[0] && !still()) splashes.push({ l: lane, t: now() });
    if (best.end === best.t) best.done = true;
    judge(bm <= EDGE[0] ? 0 : bm <= EDGE[1] ? 1 : bm <= EDGE[2] ? 2 : 3, bm);
    if (best.kind) applyKind(best, sp);
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

  /* the one rAF handle: a second open() replaces the loop instead of
     doubling it, and close() cancels it */
  function loop() {
    if (raf && window.cancelAnimationFrame) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(step);
  }
  function stopBacking() {
    if (loopSrc && loopSrc.stop) { try { loopSrc.stop(); } catch (e3) {} }
    loopSrc = null;
  }
  function step(ts) {
    if (!running) return;
    if (!NEU.kernel) requestAnimationFrame(step);
    /* the pace cap (perf.js): note judgment runs on the audio clock,
       so a skipped draw costs no timing */
    if (NEU.perf && !NEU.perf.paced(ts)) return;
    /* ESC: the song clock is frozen, so draw the held frame and nothing else */
    if (S.paused) { draw(songPos()); return; }
    var sp = songPos();
    S.countdown = countLabel(sp);
    S.section = sectionOf(sp);
    /* Leave prompt up: hold the frame. Notes that pass meanwhile are judged on resume. */
    if (NEU.juice && NEU.juice.frozen()) { lastSp = sp; draw(sp); return; }
    if (introOn) {
      if (sp < -4 * beatLen()) {       /* the intro: mics, explosion, disco sphere */
        S.mode = 'intro'; S.brk = '';
        S.introT = sp + 4 * beatLen() + INTRO;
        draw(sp);
        return;
      }
      introOn = false;
    }
    var bp = breakPhase(sp);
    /* the talk box would hide the soul and the hazards low on the screen, so it steps aside
       (visibility, not hidden: the stage layout above it must not jump) */
    if (msg && msg.style.visibility !== (bp ? 'hidden' : '')) msg.style.visibility = bp ? 'hidden' : '';
    if (bp) {
      runBreak(sp, bp);
      if (S.health <= 0) { lose(); return; }
      draw(sp);
      return;
    }
    S.mode = 'chart'; S.brk = '';
    S.arrowA = 1;

    var ph = ms(sp - 4 * beatLen()) >= 0 ? 1 : 0;
    if (ph !== phase) { phase = ph; say(TAUNT[round][ph] || 'go.'); }
    tick(sp);

    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      if (n.done) continue;
      if (!n.mine) {
        if (sp >= n.t) {
          n.hit = n.done = true; blip(n.lane, false);
          confirmAt[0][n.lane] = singAt[0] = now(); singLane[0] = n.lane;
        }
      } else if (!n.hit && ms(sp - n.t) > WINDOW_MS) {
        n.done = true;
        if (n.kind === 'bomb') S.score += 50;
        else judge(4, 0);
      } else if (n.hit && sp >= n.end) {
        n.done = true;
      }
    }

    if (S.health <= 0 || S.consecMiss >= MAX_MISS) { lose(); return; }
    if (notes.every(function (n) { return n.done; })) {
      if (songHasTail()) { win(); return; }
      nextRound(); return;
    }
    draw(sp);
  }
  function easeU(u) {
    if (u < 0) u = 0;
    if (u > 1) u = 1;
    if (still()) return 1;
    if (NEU.juice && NEU.juice.outCubic) return NEU.juice.outCubic(u);
    return u;
  }
  /* Four soul attacks, one per break, each asks something different of the soul:
     0 volley: coins fall straight onto where you stand, so standing still is a hit; an axe sweeps
       down, a bottle is lobbed in every other wave, and every third wave a fast coin is aimed
       along your row from a side, a dash gap;
     1 lobs: two bottles per wave, one aimed at you and one a step to the side you will dodge
       toward, thrown from opposite edges; glass on the floor is harmless, only the air hurts;
     2 ring: a ring of eight axes bursts from a point off to one side, one aimed at you, alternate
       axes fast and slow, so you step into the gap and the next burst comes from elsewhere;
     3 wall: a wall of coins sweeps in from alternating sides with a two-slot gap that moves about
       a third of the arena a wave: be at the gap in time, and a dash covers the last stretch. */
  var WALL_GAPS = [0.2, 0.42, 0.7, 0.95, 0.7, 0.45, 0.2, 0.0, 0.24, 0.5, 0.28, 0.05];
  var HIT_R = 24;                     /* hazard plus soul radius: a wall of coins at 40 px has no crack */
  function wallSlots(g) { return Math.ceil((g.h - 128) / 40); }
  /* x of a lobbed bottle thrown from x0 so that it is at row y with x equal tx (descending root) */
  function lobVx(x0, y0, vy, sy, tx) {
    var D = vy * vy - 560 * (y0 - sy), t = D > 0 ? (-vy + Math.sqrt(D)) / 280 : -vy / 280;
    return Math.max(-440, Math.min(440, (tx - x0) / Math.max(0.3, t)));
  }
  function spawnAt(pat, n, g, so) {
    var side = n & 1, out = [], k, a, sx = so ? so.x : g.w / 2, sy = so ? so.y : g.h / 2;
    if (pat === 0) {
      out.push({ kind: 'coin', x: sx, y: 24, vx: 0, vy: 200, grav: false, broke: false });
      out.push({ kind: 'axe', x: g.w * (0.5 - 0.42 * Math.sin(n * 1.7)), y: 24, vx: 0, vy: 150, grav: false, broke: false, spin: 0 });
      if (!side) out.push({ kind: 'bottle', x: n & 2 ? g.w + 12 : -12, y: g.h * 0.45, vx: n & 2 ? -190 : 190, vy: -300, grav: true, broke: false, age: 0 });
      if (n % 3 === 2) out.push({ kind: 'coin', x: side ? g.w + 20 : -20, y: sy, vx: side ? -440 : 440, vy: 0, grav: false, broke: false });
    } else if (pat === 1) {
      for (k = 0; k < 2; k++) {
        var from = (n + k) & 1, x0 = from ? g.w + 12 : -12, y0 = g.h * 0.45, vy0 = -300 - k * 60;
        var tx = k ? sx + (sx < g.w / 2 ? 200 : -200) : sx;       /* the second goes where you will step */
        out.push({ kind: 'bottle', x: x0, y: y0, vx: lobVx(x0, y0, vy0, sy, tx), vy: vy0, grav: true, broke: false, age: 0 });
      }
    } else if (pat === 2) {
      var ph = n * 2.1, ox = Math.max(48, Math.min(g.w - 48, sx + Math.cos(ph) * 220)), oy = Math.max(48, Math.min(g.h - 48, sy + Math.sin(ph) * 220));
      var aim = Math.atan2(sy - oy, sx - ox);
      for (k = 0; k < 8; k++) {
        a = aim + (k - 1) * Math.PI / 4;
        var sp2 = k & 1 ? 230 : 150;
        out.push({ kind: 'axe', x: ox, y: oy, vx: Math.cos(a) * sp2, vy: Math.sin(a) * sp2, grav: false, broke: false, spin: 0 });
      }
    } else {
      var ns = wallSlots(g), sh = (g.h - 128) / ns, gap = Math.round(WALL_GAPS[n % WALL_GAPS.length] * (ns - 2)), v2 = g.w / 4.2;
      for (k = 0; k < ns; k++) {
        if (k === gap || k === gap + 1) continue;
        out.push({ kind: 'coin', x: side ? g.w + 20 : -20, y: 64 + sh * (k + 0.5), vx: side ? -v2 : v2, vy: 0, grav: false, broke: false });
      }
    }
    for (k = 0; k < out.length; k++) out[k].wave = n;
    return out;
  }
  /* the dodge's spawns: each pattern drops its next wave once its gap has passed */
  function spawnHazards(i, tb, g) {
    if (hazBreak !== i) { hazBreak = i; S.pattern = i; S.spawnN = 0; S.hazards = []; }
    while (S.spawnN * PAT_GAP[i] <= tb) {
      S.hazards = S.hazards.concat(spawnAt(i, S.spawnN, g, soulF));
      S.spawnN++;
    }
  }
  function runBreak(sp, bp) {
    var g = geom(), u = easeU(bp.u);
    var cx = g.w / 2, cy = g.h / 2;
    var dt = sp - lastBrk;
    if (!(dt > 0) || dt > 0.05) dt = 0.05;
    lastBrk = sp;
    S.mode = 'break'; S.brk = bp.name;
    if (!soulF && NEU.danmaku) soulF = NEU.danmaku.fight(g.cx, g.strumY);
    if (!soulF) soulF = { x: g.cx, y: g.strumY, dashI: 0 };
    if (bp.name === 'dodge') spawnHazards(bp.i, sp - BREAK_AT[bp.i], g);
    if (bp.name === 'in') {
      S.arrowA = 1 - u;
      soulF.x = g.cx + (cx - g.cx) * u;
      soulF.y = g.strumY + (cy - g.strumY) * u;
    } else if (bp.name === 'out') {
      S.arrowA = u; S.hazards = [];
      soulF.x = cx + (g.cx - cx) * u;
      soulF.y = cy + (g.strumY - cy) * u;
    } else {
      S.arrowA = 0;
      var mk = {
        left: !!keys[LANES[0]], down: !!keys[LANES[1]],
        up: !!keys[LANES[2]], right: !!keys[LANES[3]], focus: !!keys.focus
      };
      var box = { AX: 64, AY: 64, AW: Math.max(32, g.w - 128), AH: Math.max(32, g.h - 128) };
      if (NEU.danmaku && NEU.danmaku.move) NEU.danmaku.move(soulF, mk, dt, box);
      else if (soulF.dashI > 0) soulF.dashI -= dt;
      var hi;
      for (hi = 0; hi < S.hazards.length; hi++) {
        var h = S.hazards[hi];
        h.x += h.vx * dt; h.y += h.vy * dt;
        if (h.grav) h.vy += 280 * dt;
        if (h.kind === 'axe') h.spin += dt * 4;
        if (h.kind === 'bottle' && !h.broke && h.y > g.h - 80) {
          h.broke = true; h.vx = 0; h.vy = 0;
          if (NEU.juice) NEU.juice.burst(h.x, h.y, 10, '#C8E8FF', 1);
        }
        if (h.broke) h.age += dt;
        var dx = soulF.x - h.x, dy = soulF.y - h.y;
        if (!h.broke && dx * dx + dy * dy < HIT_R * HIT_R && !(soulF.dashI > 0)) {
          addHealth(-0.12);
          soulF.dashI = 0.45;
          if (NEU.juice) NEU.juice.hit('small');
        }
      }
      /* cull what has left the arena, and glass that has lain on the floor a while */
      S.hazards = S.hazards.filter(function (h) {
        if (h.broke) return h.age < 1.5;
        return h.x > -60 && h.x < g.w + 60 && h.y > -60 && h.y < g.h + 60;
      });
    }
    S.soulx = soulF.x; S.souly = soulF.y;
  }

  function nextRound() {
    round++;
    if (round >= CHARTS.length) { win(); return; }
    startRound();
  }

  function win() {
    running = false;
    won = true;
    if (msg) { placeMsg(false); msg.hidden = true; }   /* the talk box says it; the stall carries the esc hint */
    /* the axe comes by hand-over; the stall opens only when the hand-over lands */
    /* the stall's own line carries the hand-over text, so no talk box lands on top of the menu */
    NEU.shop.handover('axe', function () {
      if (NEU.quest) NEU.quest.mark('a4_axe');
    });
    draw(songPos());
  }
  /* the soul controls, as keycaps: Z retries, X dashes, the arrows move */
  function keycap(k) {
    return '<span style="display:inline-block;border:2px solid #fff;padding:0 8px;margin:0 4px">' + k + '</span>';
  }
  function lose() {
    running = false;
    resetScore();                        /* a death wipes the score */
    if (msg) {
      placeMsg(true);
      msg.style.visibility = '';
      msg.hidden = false;
      msg.innerHTML = 'he stops, mid-bar. "no."' +
        '<br><small>' + keycap('Z') + 'enter to go again' + keycap('X') + 'dash' +
        keycap('← ↓ ↑ →') + 'soul' + keycap('ESC') + 'leave</small>';
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

  /* The arrows are our own pixel art (Funkin's are not licensed), built
     once into a 4x4 sheet of 17px cells: a 15px arrow, its ink outline,
     and room for the confirm halo. Columns: idle, press, confirm, note.
     Rows: left, down, up, right. Lit from the top in every direction. */
  var N = 17, sheet = null;
  function arrowAt(x, y) {             /* the left arrow: a head and a stem */
    var dy = Math.abs(y - 8);
    return (x >= 2 + dy && x <= 8 && dy <= 6) || (x >= 8 && x <= 14 && dy <= 2);
  }
  function inArrow(l, x, y) {
    if (x < 0 || y < 0 || x >= N || y >= N) return false;
    return l === 0 ? arrowAt(x, y) : l === 3 ? arrowAt(N - 1 - x, y)
         : l === 2 ? arrowAt(y, x) : arrowAt(N - 1 - y, x);
  }
  function near8(l, x, y) {
    for (var j = -1; j <= 1; j++) for (var i = -1; i <= 1; i++) if (inArrow(l, x + i, y + j)) return true;
    return false;
  }
  function buildSheet() {
    sheet = document.createElement('canvas');
    sheet.width = sheet.height = 4 * N;
    var g = sheet.getContext && sheet.getContext('2d');
    if (!g) return;
    for (var l = 0; l < 4; l++) {
      var FR = [
        ['#4E4468', '#7A6E9A', '#2E2642', null],     /* idle: Deltarune grey-violet */
        [DARK[l], LANECOL[l], '#1A1028', null],      /* press */
        [LIGHT[l], '#FFFFFF', LANECOL[l], '#FFFFFF'],/* confirm, with a halo */
        [LANECOL[l], LIGHT[l], DARK[l], null]        /* the note */
      ];
      for (var f = 0; f < 4; f++) {
        for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
          var c = null;
          if (inArrow(l, x, y)) {
            c = !inArrow(l, x, y - 1) ? FR[f][1] : !inArrow(l, x, y + 1) ? FR[f][2] : FR[f][0];
          } else if (near8(l, x, y)) c = INK;
          else if (FR[f][3]) {
            for (var j = -1; j <= 1 && !c; j++) for (var i = -1; i <= 1; i++)
              if (!inArrow(l, x + i, y + j) && near8(l, x + i, y + j) && (i || j)) { c = FR[f][3]; break; }
          }
          if (c) { g.fillStyle = c; g.fillRect(f * N + x, l * N + y, 1, 1); }
        }
      }
    }
  }
  function arrow(f, l, x, y, s) {
    if (!sheet) buildSheet();
    ctx.drawImage(sheet, f * N, l * N, N, N, x, y, N * s, N * s);
  }

  /* Funkin's classic placement: his strumline from 48px on the left,
     yours from 48px past the middle, receptors at the top, notes rising.
     On a phone (taller than wide) yours is four big arrows across 90% of
     the width, his shrinks to a half-size row at the top left, and the
     singers stand below. */
  function geom() {
    var w = innerWidth, h = innerHeight, tall = h > w, s, hs, hisX, hisY, mineX, strumY;
    if (tall) {
      s = Math.max(2, Math.min(6, Math.floor(w * 0.9 / (4 * N))));
      mineX = Math.round((w - 4 * N * s) / 2);
      hs = Math.max(1, s >> 1); hisX = 12; hisY = 84;   /* under the valance and truss */
      strumY = hisY + N * hs + 14;
    } else {
      s = Math.max(2, Math.min(6, Math.floor((w / 2 - 56) / (4 * N))));
      hs = s; hisX = 48; hisY = 72; mineX = Math.round(w / 2 + 48); strumY = 72;
    }
    var pitch = N * s, pitchH = N * hs;
    var floor = h - 16;
    if (msg && !msg.hidden && !msgCentered && msg.getBoundingClientRect) {
      var mt = Math.round(msg.getBoundingClientRect().top);
      if (mt > 0) floor = mt - 16;     /* 0 = no layout yet: keep the window floor */
    }
    /* an open dialogue box covers the bottom: the stage floor sits above it */
    if (NEU.tboxOpen && NEU.tboxOpen()) {
      var tb = document.getElementById('tbox'), tt = tb && tb.getBoundingClientRect ? Math.round(tb.getBoundingClientRect().top) : 0;
      if (tt > 0 && tt - 16 < floor) floor = tt - 16;
    }
    var by = floor - 56;               /* the health bar, with the score line under it */
    var cx = mineX + 2 * pitch;
    /* the two singers: on a phone the soul stands centre, his stall to the left */
    var who = tall ? [Math.round(w * 0.22), Math.round(w / 2)] : [hisX + 2 * pitchH, cx];
    var g = { w: w, h: h, s: s, hs: hs, pitch: pitch, pitchH: pitchH, hisX: hisX, hisY: hisY, mineX: mineX,
              cx: cx, strumY: strumY, by: by, stage: by - 40, tall: tall, who: who,
              popY: 0, head: 0, spk: [], crowdN: 0,
              K: 1000 * PIXELS_PER_MS * SPEED[Math.min(round, SPEED.length - 1)] };
    /* the soul's strumline hangs above the soul's head, centred on the soul */
    g.head = g.stage + 8 - 13 * peopleCs(g);
    /* never under the valance or on top of his strumline (the box can lift the stage) */
    g.strumY = Math.max(g.head - N * s - 48, tall ? hisY + N * hs + 14 : 72);
    g.mineX = Math.round(who[1] - 2 * pitch);
    if (tall) g.mineX = Math.round((w - 4 * pitch) / 2);
    g.cx = g.mineX + 2 * pitch;
    g.popY = Math.max(60, g.strumY - 64);      /* ratings and the 3-2-1 hang above the arrows, off the singers */
    /* two large speakers stand in the gap between the singers, behind them */
    /* between the singers on a wide screen. On a phone they nearly touch, so
       there is no gap to stand in: the stacks go to the two edges at half size.
       ponytail: phone speakers sit at the edges, not between. Space the singers to bring them back. */
    var mid = (who[0] + who[1]) / 2;
    g.sk = tall ? 0.5 : 1;
    g.spw = Math.round(64 * g.sk);
    g.spk = tall ? [0, w - g.spw] : [Math.round(mid - 72), Math.round(mid + 8)];
    g.crowdN = Math.floor(w / 56);
    g.cs = peopleCs(g);
    g.kid = Math.max(4, Math.round(g.cs / 3));      /* dancers: 4px a cell at least, 44px tall (66px at 720p) */
    g.scoreY = by + (w < 600 ? 40 : 32);            /* the score line, clear of the head icons */
    return g;
  }

  function text(str, x, y, size, col, align) {
    ctx.font = size + 'px "Determination Sans","Pixelify Sans",monospace';
    ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    var o = size >= 48 ? 4 : 2;
    ctx.fillStyle = INK;
    ctx.fillText(str, x - o, y); ctx.fillText(str, x + o, y);
    ctx.fillText(str, x, y - o); ctx.fillText(str, x, y + o);
    ctx.fillStyle = col; ctx.fillText(str, x, y);
  }

  /* ── the art ────────────────────────────────────────────────────
     Everything static is baked once into an offscreen canvas (keyed by
     size) and costs one drawImage a frame; only the woofers, the beam
     swing and the singers are drawn live. */
  function mkc(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
    return c;
  }
  /* a stepped pixel ellipse in 2px rows */
  function ellP(g, cx, cy, rx, ry, col, a) {
    g.globalAlpha = a; g.fillStyle = col;
    for (var y = -ry; y < ry; y += 2) {
      var k = 1 - ((y + 1) * (y + 1)) / (ry * ry), hw = k > 0 ? Math.round(rx * Math.sqrt(k)) : 0;
      if (hw > 0) g.fillRect((cx - hw) | 0, (cy + y) | 0, hw * 2, 2);
    }
    g.globalAlpha = 1;
  }
  function peopleCs(g) {
    var cs = Math.ceil(g.h * 0.30 / 13);
    if (g.tall) cs = Math.min(cs, Math.floor(g.w * 0.28 / 9));   /* two 9-cell singers must not overlap */
    return Math.max(3, cs);
  }
  /* one speaker stack, 64x112 with a bevel and two stepped woofers, plus its
     2px outline: 68x116. Baked once; stage() draws it at g.sk. */
  var spkSprite = null;
  function speakerSprite() {
    if (spkSprite) return spkSprite;
    var c = mkc(68, 116), x = c.getContext && c.getContext('2d');
    if (!x) return null;
    function R(x0, y0, w, h, col) { x.fillStyle = col; x.fillRect(x0, y0, w, h); }
    var sx = 2, sy = 2;
    R(0, 0, 68, 116, '#0A0614');
    R(sx, sy, 64, 112, '#1A1020'); R(sx, sy, 64, 2, '#2A1840'); R(sx, sy, 2, 112, '#2A1840');
    R(sx + 62, sy, 2, 112, '#0A0614'); R(sx, sy + 110, 64, 2, '#0A0614');
    ellP(x, sx + 32, sy + 32, 24, 24, '#3A2A55', 1); ellP(x, sx + 32, sy + 32, 20, 20, '#2A1840', 1);
    ellP(x, sx + 32, sy + 32, 14, 14, '#0A0614', 1); ellP(x, sx + 32, sy + 32, 4, 4, '#2A1840', 1);
    ellP(x, sx + 32, sy + 84, 18, 18, '#3A2A55', 1); ellP(x, sx + 32, sy + 84, 15, 15, '#2A1840', 1);
    ellP(x, sx + 32, sy + 84, 10, 10, '#0A0614', 1); ellP(x, sx + 32, sy + 84, 3, 3, '#2A1840', 1);
    R(sx + 4, sy + 4, 2, 2, '#4A3A66'); R(sx + 58, sy + 4, 2, 2, '#0A0614');
    spkSprite = c; return c;
  }
  var stageCache = null, beamCache = null;
  function bakeStage(g) {
    var W = g.w, H = g.h, st = g.stage, c = mkc(W, H), x = c.getContext && c.getContext('2d');
    if (!x) return null;
    x.imageSmoothingEnabled = false;
    function R(x0, y0, w, h, col) { x.fillStyle = col; x.fillRect(x0, y0, w, h); }
    var i, k, VEL = ['#12081E', '#1E0F33', '#2A1648', '#3B1F5C'];
    /* velvet: four stepped bands, dark under the valance */
    var bh = Math.ceil(st / VEL.length);
    for (i = 0; i < VEL.length; i++) R(0, i * bh, W, bh, VEL[i]);
    /* vertical folds every 24px: a 4px light, a 2px dark */
    for (k = 0; k * 24 < W; k++) {
      R(k * 24, 32, 4, st - 32, '#4B2A78'); R(k * 24 + 4, 32, 2, st - 32, '#12081E');
      R(k * 24, 32, 4, 3, '#6A40A0');
    }
    /* the floor-level shadow the curtain throws behind the speakers */
    x.globalAlpha = 0.3; R(0, st - 24, W, 24, '#000000'); x.globalAlpha = 1;
    /* valance: a 16px band with 16px-radius scallops, gold fringe */
    R(0, 0, W, 16, '#5A1A2A'); R(0, 0, W, 5, '#8C2F4A'); R(0, 0, W, 2, '#C2405F'); R(0, 14, W, 2, '#3A0E1A');
    for (k = 0; k * 32 < W + 32; k++) {
      var cx = k * 32 + 16, dy, hw;
      for (dy = 0; dy < 16; dy++) {
        hw = Math.round(Math.sqrt(256 - dy * dy)); if (hw < 1) continue;
        R(cx - hw, 16 + dy, hw * 2, 1, '#5A1A2A');
        hw = Math.round(Math.sqrt(196 - Math.min(195, dy * dy))); if (dy < 14) R(cx - hw - 1, 16 + dy, hw * 2 + 1, 1, '#8C2F4A');
        hw = Math.round(Math.sqrt(100 - Math.min(99, dy * dy))); if (dy < 10) R(cx - hw - 4, 16 + dy, hw + 1, 1, '#C2405F');
        R(cx - Math.round(Math.sqrt(256 - dy * dy)), 16 + dy, 1, 1, '#C8A040');
        R(cx + Math.round(Math.sqrt(256 - dy * dy)) - 1, 16 + dy, 1, 1, '#C8A040');
      }
      R(cx - 4, 31, 8, 1, '#C8A040');
    }
    /* truss: a lattice bar, an X every 8px, and six PAR cans */
    var ty = 40, tn = 6;
    R(0, ty, W, 16, '#3A3A4A');
    for (k = 0; k * 8 < W; k++) for (i = 0; i < 4; i++) {
      R(k * 8 + i * 2, ty + 3 + i * 2, 2, 2, '#5A5A6A'); R(k * 8 + 6 - i * 2, ty + 3 + i * 2, 2, 2, '#5A5A6A');
    }
    R(0, ty, W, 3, '#5A5A6A'); R(0, ty + 13, W, 3, '#5A5A6A'); R(0, ty + 16, W, 2, '#12081E');
    for (i = 0; i < tn; i++) {
      var px = Math.round(W * (i + 0.5) / tn) - 6, lens = i % 2 ? '#E0C24A' : '#C24AE0';
      R(px + 5, ty + 16, 2, 4, '#12081E');
      R(px, ty + 20, 12, 12, '#12081E'); R(px + 1, ty + 21, 10, 10, '#2A2A34'); R(px + 1, ty + 21, 10, 2, '#5A5A6A');
      R(px + 2, ty + 28, 8, 3, lens); R(px + 3, ty + 28, 3, 1, '#FFFFFF');
    }
    /* the floor: planks, a lit lip, and a pool of light under each singer */
    R(0, st, W, H - st, '#2A1C42');
    for (k = 0; k * 64 < W; k++) {
      if (k & 1) R(k * 64, st + 6, 64, H - st - 6, '#2F2048');
      R(k * 64, st + 6, 4, H - st - 6, '#22163A');
    }
    R(0, st + 6, W, 2, '#22163A');
    R(0, st, W, 6, '#5A3C82'); R(0, st, W, 1, '#8A6AB2'); R(0, st + 5, W, 1, '#3A2660');
    var cs = peopleCs(g), who = g.who;
    for (i = 0; i < 2; i++) {
      ellP(x, who[i], st + 16, 5 * cs, 12, '#E8D8FF', 0.06);
      ellP(x, who[i], st + 16, 3 * cs, 8, '#E8D8FF', 0.1);
      ellP(x, who[i], st + 10, 3 * cs, 5, '#000000', 0.35);
    }
    return c;
  }
  /* the PAR cans' beam cones: three stepped trapezoids each, baked as one
     translucent layer; a frame shifts it a few px on the beat */
  function bakeBeams(g) {
    var W = g.w, st = g.stage, c = mkc(W + 16, st), x = c.getContext && c.getContext('2d'), i, j, y;
    if (!x) return null;
    var top = 72, A = [0.02, 0.04, 0.06], HW = [96, 64, 36];
    for (i = 0; i < 6; i++) {
      var cx = Math.round(W * (i + 0.5) / 6) + 8;
      x.fillStyle = i % 2 ? '#FFE88A' : '#E49BFF';
      for (j = 0; j < 3; j++) {
        x.globalAlpha = A[j];
        for (y = top; y < st; y += 4) {
          var hw = 6 + Math.round((HW[j] - 6) * (y - top) / (st - top));
          x.fillRect(cx - hw, y, hw * 2, 4);
        }
      }
    }
    x.globalAlpha = 1;
    return c;
  }
  function stageBg(g) {
    var key = [g.w, g.h, g.stage, g.s, g.spk.join('/')].join(',');
    if (!stageCache || stageCache.key !== key) { stageCache = { key: key, bg: bakeStage(g), beams: null }; }
    if (!stageCache.beams) stageCache.beams = bakeBeams(g);
    return stageCache;
  }

  function beatFrac(sp) { var b = sp / beatLen(); return b - Math.floor(b); }

  /* The crowd: kids dancing at the back, four baked frames of one row. Each
     kid starts on its own pose so the row never moves in lockstep; the frame
     changes on every beat (frame 0 only under reduced motion). Drawn dim, so
     the notes stay the brightest thing on screen. */
  var KID_SHIRT = ['#E04A6B', '#4AC2E0', '#7BE38A', '#E4C46A', '#C24AE0', '#EDE7DE'];
  function crowd(g) {
    var cc = g.kid, key = [g.w, g.stage, g.crowdN, cc].join(',');
    if (crowdCache && crowdCache.key === key) return crowdCache;
    var H = 11 * cc, frames = [], f, k, c, x;
    for (f = 0; f < 4; f++) {
      c = mkc(g.w, H);
      var X = c.getContext && c.getContext('2d');
      if (!X) return null;
      for (k = 0; k < g.crowdN; k++) {
        var pose = (f + k) & 3, shirt = KID_SHIRT[(k * 5) % KID_SHIRT.length], skin = (k & 1) ? '#E8C0A0' : '#8A5A3A';
        x = Math.round((g.w * (k + 0.5) / g.crowdN) - 2.5 * cc) + ((k * 7) % 3 - 1) * cc;
        var y = H - 10 * cc - cc;          /* feet on the back row */
        var R = function (cx, cy, w2, h2, col) { X.fillStyle = col; X.fillRect(x + cx * cc, y + cy * cc, w2 * cc, h2 * cc); };
        R(1, 0, 3, 3, skin); R(1, 0, 3, 1, '#1A1020');                 /* head and hair */
        R(1, 3, 3, 4, shirt);                                           /* body */
        if (pose === 0) { R(0, 3, 1, 3, shirt); R(4, 3, 1, 3, shirt); R(0, 6, 1, 1, skin); R(4, 6, 1, 1, skin); }
        else if (pose === 1) { R(0, 0, 1, 3, shirt); R(4, 0, 1, 3, shirt); R(0, 0, 1, 1, skin); R(4, 0, 1, 1, skin); }
        else if (pose === 2) { R(0, 0, 1, 3, shirt); R(4, 3, 1, 3, shirt); R(0, 0, 1, 1, skin); R(4, 6, 1, 1, skin); }
        else { R(0, 4, 1, 1, shirt); R(4, 4, 1, 1, shirt); R(0, 5, 1, 1, shirt); R(4, 5, 1, 1, shirt); }
        if (pose & 1) { R(0, 7, 1, 3, '#12081E'); R(4, 7, 1, 3, '#12081E'); }
        else { R(1, 7, 1, 3, '#12081E'); R(3, 7, 1, 3, '#12081E'); }
      }
      frames.push(c);
    }
    crowdCache = { key: key, frames: frames, H: H };
    return crowdCache;
  }

  /* A dark Deltarune stage: curtain, speakers, truss and PAR beams, floor,
     and the crowd behind the singers. */
  function stage(g, sp) {
    var sc = stageBg(g), i, pulse = still() ? 0 : (beatFrac(sp) < 0.25 ? 2 : 0);
    if (!sc.bg) { ctx.fillStyle = '#1F1439'; ctx.fillRect(0, 0, g.w, g.stage); ctx.fillStyle = '#2A1C42'; ctx.fillRect(0, g.stage, g.w, g.h - g.stage); return; }
    ctx.drawImage(sc.bg, 0, 0);
    var swing = still() ? 0 : [-4, 0, 4, 0][((sp / beatLen()) | 0) & 3] || 0;
    if (sc.beams) ctx.drawImage(sc.beams, -8 + swing, 0);
    /* the crowd is the back row: drawn first, so the speakers and singers stand in front of it */
    var cr = crowd(g);
    if (cr) {
      ctx.globalAlpha = 0.6;
      ctx.drawImage(cr.frames[still() ? 0 : (((sp / beatLen()) | 0) & 3)], 0, g.stage - cr.H - 2);
      ctx.globalAlpha = 1;
    }
    /* the two speaker stacks stand on the floor; the woofers pump 2px on the beat */
    var spr = speakerSprite(), sk = g.sk, body = g.stage - 8 - 112 * sk;
    if (spr) {
      for (i = 0; i < 2; i++) {
        ctx.drawImage(spr, Math.round(g.spk[i] - 2 * sk - pulse), Math.round(body - 2 * sk - pulse),
                      Math.round(68 * sk) + 2 * pulse, Math.round(116 * sk) + 2 * pulse);
      }
    }
  }

  /* The two of them stand on the floor under their strumlines and bob on
     the beat. A hit holds a sing pose for 180 ms: an arm out toward the
     lane (left/right), an arm up, or a crouch (down), and the mouth opens
     on alternate 90 ms frames. */
  var INKC = '#12081E';
  function limb(x, y, w, h, cloth, light, ink) {
    ctx.fillStyle = INKC; ctx.fillRect(x - ink, y - ink, w + 2 * ink, h + 2 * ink);
    ctx.fillStyle = cloth; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = light; ctx.fillRect(x, y, w, Math.max(2, h >> 2));
  }
  function people(g, sp, t) {
    var L = NEU.engineLook;
    if (!L) {
      ctx.fillStyle = '#FF00FF';
      ctx.fillRect(g.hisX, g.stage - 64, 48, 64);
      ctx.fillRect(g.cx, g.stage - 64, 48, 64);
      return;
    }
    var cs = peopleCs(g), ink = Math.max(2, cs >> 3);
    var bob = still() ? 0 : beatFrac(sp) < 0.25 ? (cs >> 1) : 0;
    var who = g.who;
    var CLOTH = [['#7A7688', '#A8A4BC'], ['#6F5FA6', '#8A7BC4']];
    for (var side = 0; side < 2; side++) {
      var age = t - singAt[side], sing = age < 0.18 && age >= 0, pose = singLane[side];
      var x = who[side], y = g.stage + 8 + bob + ((sing && pose === 1 && !still()) ? cs : 0);
      /* the figure is 9 cells wide and 13 tall, feet at y */
      var x0 = Math.round(x - 4.5 * cs), y0 = y - 13 * cs, shY = y0 + (side ? 7 : 8) * cs;
      if (side) L.drawPlayer(ctx, x, y, 'left', 0, false, cs, performance.now());
      else L.drawProp(ctx, 'merchant', null, x, y, cs, 0, 0);
      if (sing && !still()) {
        var cl = CLOTH[side][0], li = CLOTH[side][1];
        if (pose === 0) { limb(x0 - 4 * cs, shY, 5 * cs, cs, cl, li, ink); ctx.fillStyle = '#E8DCC8'; ctx.fillRect(x0 - 5 * cs, shY, cs, cs); }
        else if (pose === 3) { limb(x0 + 8 * cs, shY, 5 * cs, cs, cl, li, ink); ctx.fillStyle = '#E8DCC8'; ctx.fillRect(x0 + 13 * cs, shY, cs, cs); }
        else if (pose === 2) { limb(x0 + 8 * cs, shY - 5 * cs, cs, 6 * cs, cl, li, ink); ctx.fillStyle = '#E8DCC8'; ctx.fillRect(x0 + 8 * cs, shY - 6 * cs, cs, cs); }
        if (((age * 1000 / 90) | 0) % 2 === 0) {           /* mouth open */
          ctx.fillStyle = '#2A1020';
          ctx.fillRect(x0 + (side ? 2 : 3) * cs, y0 + (side ? 4 : 5) * cs, 2 * cs, cs);
        }
      }
      if (!side) {            /* he holds a mic: 2x6 at a quarter-cell unit, head on top */
        var u = Math.max(1, cs >> 2), mx = sing ? x0 + 6 * cs : x0 + 9 * cs + cs, my = sing ? y0 + 4 * cs : shY - 2 * u;
        ctx.fillStyle = INKC; ctx.fillRect(mx - 1, my - 3 * u - 1, 2 * u + 2, 9 * u + 2);
        ctx.fillStyle = '#3A3A4A'; ctx.fillRect(mx, my, 2 * u, 6 * u);
        ctx.fillStyle = '#8A8A9A'; ctx.fillRect(mx - (u >> 1), my - 3 * u, 3 * u, 3 * u);
        ctx.fillStyle = '#C4C4D4'; ctx.fillRect(mx - (u >> 1), my - 3 * u, u, u);
      }
    }
  }

  /* hazards and chart items are authored as grids, outlined with INK, and
     baked to canvases; the axe gets 8 pre-rotated frames (no ctx.rotate on
     pixel art). */
  function gMk(w, h) { var o = [], y, x; for (y = 0; y < h; y++) { o.push([]); for (x = 0; x < w; x++) o[y].push(null); } return o; }
  function gSet(G, x, y, c) { if (y >= 0 && y < G.length && x >= 0 && x < G[0].length) G[y][x] = c; }
  function gRect(G, x, y, w, h, c) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) gSet(G, x + i, y + j, c); }
  function gDisc(G, cx, cy, r, fn) {
    for (var y = 0; y < G.length; y++) for (var x = 0; x < G[0].length; x++) {
      var dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
      if (d <= r) gSet(G, x, y, fn(dx, dy, d));
    }
  }
  function gRot(G, a, n) {
    var O = gMk(n, n), cx = (G[0].length - 1) / 2, cy = (G.length - 1) / 2, o = (n - 1) / 2, c = Math.cos(a), s = Math.sin(a), x, y;
    for (y = 0; y < n; y++) for (x = 0; x < n; x++) {
      var dx = x - o, dy = y - o, sx = Math.round(cx + dx * c + dy * s), sy = Math.round(cy - dx * s + dy * c);
      if (sy >= 0 && sy < G.length && sx >= 0 && sx < G[0].length) O[y][x] = G[sy][sx];
    }
    return O;
  }
  function gInk(G) {
    var w = G[0].length, h = G.length, O = gMk(w + 2, h + 2), x, y, i, j;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) O[y + 1][x + 1] = G[y][x];
    var P = gMk(w + 2, h + 2);
    for (y = 0; y < h + 2; y++) for (x = 0; x < w + 2; x++) {
      if (O[y][x]) { P[y][x] = O[y][x]; continue; }
      for (j = -1; j <= 1 && !P[y][x]; j++) for (i = -1; i <= 1; i++)
        if (O[y + j] && O[y + j][x + i]) { P[y][x] = INKC; break; }
    }
    return P;
  }
  function gBake(G) {
    var c = mkc(G[0].length, G.length), g = c.getContext && c.getContext('2d'), x, y;
    if (!g) return c;
    for (y = 0; y < G.length; y++) for (x = 0; x < G[0].length; x++) if (G[y][x]) { g.fillStyle = G[y][x]; g.fillRect(x, y, 1, 1); }
    return c;
  }
  function flaskG(body, lite, dark) {
    var G = gMk(14, 16);
    gRect(G, 5, 0, 4, 2, '#8A6040'); gRect(G, 5, 2, 4, 4, '#C8E0F0'); gRect(G, 5, 2, 1, 4, '#FFFFFF');
    gDisc(G, 6.5, 10, 5.5, function (dx, dy, d) { return d > 4.4 ? ((dx + dy < 0) ? lite : dark) : (dx + dy < -3 ? lite : body); });
    gSet(G, 4, 8, '#FFFFFF'); gSet(G, 4, 9, '#FFFFFF');
    return G;
  }
  var hzArt = null;
  function art() {
    if (hzArt) return hzArt;
    var G, i, A = {};
    /* coin 12x12: dark rim #6A4A08, gold #C89A1A, light #FFE35A, glint #FFF6C0 */
    G = gMk(12, 12);
    gDisc(G, 5.5, 5.5, 6, function (dx, dy, d) {
      if (d > 4.9) return dx + dy < 0 ? '#FFE35A' : '#6A4A08';
      if (d > 2.6 && d < 3.7) return dx + dy < 0 ? '#6A4A08' : '#FFE35A';
      return '#C89A1A';
    });
    gSet(G, 2, 2, '#FFF6C0'); gSet(G, 3, 2, '#FFF6C0'); gSet(G, 2, 3, '#FFF6C0');
    A.coin = gBake(gInk(G));
    /* bottle 8x20: glass #2A5A3A #4A8A5A #8AC8A0, label #E8DCC0, cork #8A6040 */
    G = gMk(8, 20);
    gRect(G, 2, 0, 4, 2, '#8A6040'); gRect(G, 2, 0, 4, 1, '#B08A60');
    gRect(G, 2, 2, 4, 5, '#4A8A5A'); gRect(G, 2, 2, 1, 5, '#8AC8A0'); gRect(G, 5, 2, 1, 5, '#2A5A3A');
    gRect(G, 1, 7, 6, 2, '#4A8A5A'); gRect(G, 1, 7, 1, 2, '#8AC8A0'); gRect(G, 6, 7, 1, 2, '#2A5A3A');
    gRect(G, 0, 9, 8, 11, '#4A8A5A'); gRect(G, 1, 9, 2, 10, '#8AC8A0'); gRect(G, 7, 9, 1, 11, '#2A5A3A'); gRect(G, 0, 19, 8, 1, '#2A5A3A');
    gRect(G, 1, 12, 6, 5, '#E8DCC0'); gRect(G, 2, 14, 4, 1, '#8A7A5A'); gRect(G, 1, 16, 6, 1, '#B8AC90');
    A.bottle = gBake(gInk(G));
    /* axe 20x20: head #5A6470 #9AA0A8, edge #E4E4EC, handle #5A3418 #8A5A32; 8 frames */
    G = gMk(20, 20);
    gRect(G, 9, 4, 1, 16, '#8A5A32'); gRect(G, 10, 4, 1, 16, '#5A3418');
    gRect(G, 9, 14, 2, 1, '#3A200E'); gRect(G, 9, 17, 2, 1, '#3A200E');
    gRect(G, 5, 3, 5, 6, '#5A6470'); gRect(G, 5, 3, 5, 2, '#9AA0A8');
    for (i = 2; i < 10; i++) {
      var ext = Math.round(7 * Math.sin((i - 2 + 0.5) / 8 * Math.PI)), ex = 10 + ext;
      gRect(G, 10, i, ext + 1, 1, i > 6 ? '#5A6470' : '#9AA0A8');
      gSet(G, ex, i, '#E4E4EC'); gSet(G, ex - 1, i, '#E4E4EC');
    }
    A.axe = [];
    for (i = 0; i < 8; i++) A.axe.push(gBake(gInk(gRot(G, i * Math.PI / 4, 28))));
    /* chart items: 14-16px sprites */
    G = gMk(14, 16); gDisc(G, 6.5, 9.5, 5.5, function (dx, dy, d) { return dx + dy < -4 ? '#4A3A66' : '#1A1020'; });
    gRect(G, 6, 2, 2, 3, '#8A6040'); gSet(G, 8, 1, '#FFD34E'); gSet(G, 9, 0, '#E04A6B'); gSet(G, 7, 0, '#FFD34E');
    A.bomb = gBake(gInk(G));
    A.potion = gBake(gInk(flaskG('#E04A6B', '#F7A0B0', '#751C33')));
    A.recall = gBake(gInk(flaskG('#4AC2E0', '#B0EBF7', '#1C5E75')));
    G = gMk(14, 16);
    gDisc(G, 6.5, 8, 6.5, function (dx, dy, d) { return dy > 0 ? null : (dx + dy < -5 ? '#F7A0B0' : (dx + dy > 3 ? '#751C33' : '#E04A6B')); });
    gSet(G, 4, 4, '#EDE7DE'); gSet(G, 5, 4, '#EDE7DE'); gSet(G, 9, 5, '#EDE7DE'); gSet(G, 8, 3, '#EDE7DE'); gSet(G, 3, 6, '#EDE7DE');
    gRect(G, 5, 9, 4, 6, '#EDE7DE'); gRect(G, 8, 9, 1, 6, '#C9B9A2'); gRect(G, 5, 9, 4, 1, '#C9B9A2');
    A.mushroom = gBake(gInk(G));
    return (hzArt = A);
  }
  function itemIcon(kind, lane, x, y, s) {
    var A = art(), u = Math.max(3, (s * 2 / 3 + 0.5) | 0), spr = kind === 'axe' ? A.axe[0] : A[kind];
    if (!spr) { ctx.fillStyle = '#FF00FF'; ctx.fillRect(x, y, 16 * u, 16 * u); return; }
    var w = spr.width * u, h = spr.height * u;
    /* a lane-coloured halo under it, so an item reads as a note and not as scenery */
    var hr = (N * s) >> 1, hx = x + hr, hy = y + hr;
    ellP(ctx, hx, hy, hr, hr, DARK[lane], 0.85); ellP(ctx, hx, hy, hr - 4, hr - 4, LANECOL[lane], 0.45);
    ctx.drawImage(spr, Math.round(x + N * s / 2 - w / 2), Math.round(y + N * s / 2 - h / 2), w, h);
  }
  /* corner brackets and a dotted aim: the hazard's entry warning */
  function bracket(x, y, r, col) {
    var L = 8, x0 = (x - r) | 0, y0 = (y - r) | 0, x1 = (x + r) | 0, y1 = (y + r) | 0;
    ctx.fillStyle = col;
    ctx.fillRect(x0, y0, L, 3); ctx.fillRect(x0, y0, 3, L);
    ctx.fillRect(x1 - L, y0, L, 3); ctx.fillRect(x1 - 3, y0, 3, L);
    ctx.fillRect(x0, y1 - 3, L, 3); ctx.fillRect(x0, y1 - L, 3, L);
    ctx.fillRect(x1 - L, y1 - 3, L, 3); ctx.fillRect(x1 - 3, y1 - L, 3, L);
  }
  function drawHazards(g) {
    var A = art(), u = Math.max(2, Math.floor(peopleCs(g) / 4)), hi, hz, spr, fade = S.brk === 'out' ? S.arrowA : 1;
    for (hi = 0; hi < S.hazards.length; hi++) {
      hz = S.hazards[hi];
      ctx.globalAlpha = fade;
      if (hz.kind === 'coin') spr = A.coin;
      else if (hz.kind === 'axe') spr = A.axe[((hz.spin / (Math.PI / 4)) | 0) & 7];
      else spr = A.bottle;
      if (hz.broke) {                          /* the bottle is glass on the floor */
        ctx.fillStyle = INKC; ctx.fillRect((hz.x - 5 * u) | 0, (hz.y - u) | 0, 10 * u, 2 * u);
        ctx.fillStyle = '#4A8A5A'; ctx.fillRect((hz.x - 4 * u) | 0, hz.y | 0, 3 * u, u);
        ctx.fillStyle = '#8AC8A0'; ctx.fillRect((hz.x + u) | 0, (hz.y - u + 1) | 0, 2 * u, u);
        continue;
      }
      if (S.brk === 'in') bracket(hz.x, hz.y, spr.width * u / 2 + 8, '#E04A6B');
      ctx.drawImage(spr, Math.round(hz.x - spr.width * u / 2), Math.round(hz.y - spr.height * u / 2), spr.width * u, spr.height * u);
    }
    ctx.globalAlpha = 1;
  }

  /* Head icons on the health bar: each sprite stamped once at 1x into a
     24x13 strip (his at 6, yours at 18), then its head rows copied out. */
  var heads = null;
  function icon(side, cx, cy, is) {
    var L = NEU.engineLook;
    if (!L) return;
    if (!heads) {
      heads = document.createElement('canvas'); heads.width = 24; heads.height = 13;
      var hg = heads.getContext && heads.getContext('2d');
      if (hg) { L.drawProp(hg, 'merchant', null, 6, 13, 1, 0, 0); L.drawPlayer(hg, 18, 13, 'left', 0, false, 1, 1000); }
    }
    var rows = side ? 6 : 7;
    ctx.drawImage(heads, side * 12, 0, 12, rows, Math.round(cx - 6 * is), Math.round(cy - rows * is / 2), 12 * is, rows * is);
  }

  function healthBar(g, sp) {
    var bw = Math.min(600, g.w - 96), bx = Math.round((g.w - bw) / 2), by = g.by;
    ctx.fillStyle = '#000'; ctx.fillRect(bx - 6, by - 6, bw + 12, 28);
    ctx.fillStyle = '#FFF'; ctx.fillRect(bx - 4, by - 4, bw + 8, 24);
    ctx.fillStyle = '#000'; ctx.fillRect(bx - 2, by - 2, bw + 4, 20);
    var split = bx + Math.round(bw * (1 - S.health / HEALTH_MAX));
    ctx.fillStyle = '#E04A6B'; ctx.fillRect(bx, by, split - bx, 16);
    ctx.fillStyle = '#7BE38A'; ctx.fillRect(split, by, bx + bw - split, 16);
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(bx, by, bw, 4);
    var is = (!still() && beatFrac(sp) < 0.15) ? 5 : 4;
    icon(0, split - 6 * is + 4, by + 8, is);
    icon(1, split + 6 * is - 4, by + 8, is);
    ctx.font = '16px "Determination Mono","Pixelify Sans",monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#EDE7DE';
    ctx.fillText('SCORE ' + Math.floor(S.score) + ' · MISSES ' + S.misses + ' · ' +
                 (S.acc * 100).toFixed(1) + '%' + (g.w < 600 ? '' : ' · ROUND ' +
                 Math.min(round + 1, CHARTS.length) + '/' + CHARTS.length), g.w / 2 | 0, g.scoreY);
  }

  /* A hold's tail: a stepped trail of blocks that scrolls with its note. */
  function tail(x, head, from, to, l, s) {
    var step = 4 * s, k0 = Math.max(0, Math.floor((from - head) / step));
    for (var k = k0; head + k * step < to; k++) {
      var y0 = Math.max(from, head + k * step), y1 = Math.min(to, head + (k + 1) * step);
      if (y1 <= y0) continue;
      var tw = (k & 1 ? 3 : 5) * s, tx = x + ((N * s - tw) >> 1);
      ctx.fillStyle = INK; ctx.fillRect(tx - s, y0, tw + 2 * s, y1 - y0);
      ctx.fillStyle = k & 1 ? DARK[l] : LANECOL[l]; ctx.fillRect(tx, y0, tw, y1 - y0);
    }
  }

  /* the screen y of a note's time: its strumline's receptor centre plus the
     distance to go, up for a regular note, down for a mushroom */
  function yAt(tm, mine, sp, g, dn) {
    var sc = mine ? g.s : g.hs, rec = (mine ? g.strumY : g.hisY) + ((N * sc) >> 1);
    return Math.round(rec + (tm - sp) * g.K * dn);
  }
  function noteY(n, sp, g) { return yAt(n.t, n.mine, sp, g || geom(), dirOf(n)); }

  /* the intro: two mics slide in and meet, a ring blast, then a disco sphere
     drops above with rainbow light. el: seconds into the intro (0..INTRO). */
  var RAINBOW = ['#E04A6B', '#FFD34E', '#7BE38A', '#4AC2E0', '#C24AE0', '#FFFFFF'];
  /* a round-head stage mic, 8x16 cells: mesh ball, gold collar, tapering handle, ink outline.
     flip mirrors the map so each mic is lit from the side that faces the other. */
  var MIC = ['..OOOO..', '.OHhgdO.', 'OHgkgkdO', 'OhkgkgdO', 'OgkgkgdO', '.OgkgdO.', '.OCcccO.', '.OccdcO.',
             '.OBbssO.', '.OBbssO.', '.OCccdO.', '.OBbssO.', '..OBsO..', '..OBsO..', '..OBsO..', '..OOOO..'];
  var MICC = { O: INKC, H: '#F4F6FF', h: '#D8DCE8', g: '#9AA0B0', k: '#6A7088', d: '#4A4E62', C: '#FFF6C0', c: '#E4C46A',
               B: '#7A7A8E', b: '#4A4A5A', s: '#2A2A3A' };
  function mic(x, y, u, flip) {
    for (var r = 0; r < 16; r++) for (var c = 0; c < 8; c++) {
      var ch = MIC[r].charAt(flip ? 7 - c : c);
      if (ch === '.') continue;
      ctx.fillStyle = MICC[ch]; ctx.fillRect(x + (c - 4) * u, y + (r - 8) * u, u, u);
    }
  }
  /* a pixel ring: square dabs spaced one square apart, so it reads as solid */
  function ring(cx, cy, r, sz, col) {
    var n = Math.max(24, Math.round(2 * Math.PI * r / sz)), q, an;
    ctx.fillStyle = col;
    for (q = 0; q < n; q++) {
      an = q * 2 * Math.PI / n;
      ctx.fillRect(Math.round(cx + Math.cos(an) * r - sz / 2), Math.round(cy + Math.sin(an) * r - sz / 2), sz, sz);
    }
  }
  function introFx(g, el) {
    var mv = still() ? 0 : 1, cx = g.w / 2, cs = peopleCs(g), u = Math.max(7, cs * 0.5 | 0);
    /* the mics meet above the speakers at head height: clear curtain behind them, and on a
       phone, above the two close singers rather than on their faces */
    var my = g.tall ? g.head - 9 * u : g.head + 3 * cs;
    var ease = function (v) { v = Math.max(0, Math.min(1, v)); return 1 - (1 - v) * (1 - v); };
    var k = mv ? ease(el / 0.8) : 1;
    var mx0 = g.who[0] + 4 * cs, mx1 = g.who[1] - 4 * cs;
    if (el < 0.8 || still()) {                      /* until the hit they glint; the blast hides them for a beat */
      mic(mx0 + (cx - 3 * u - mx0) * k, my, u, 0);  /* his mic comes in from the left */
      mic(mx1 + (cx + 3 * u - mx1) * k, my, u, 1);  /* yours from the right */
    } else {
      var rec = mv ? Math.min(1, (el - 0.8) / 0.15) * 2 * u : 0;   /* both recoil from the hit */
      mic(cx - 3 * u - rec, my, u, 0);
      mic(cx + 3 * u + rec, my, u, 1);
    }
    if (el >= 0.8 && !boomed) {
      boomed = true;
      if (NEU.juice) NEU.juice.burst(cx, my, 14, '#FFD34E', 1);
    }
    if (el >= 0.8 && el < 1.4 && mv) {             /* the blast: a flash, a pixel ring that grows and thins, spokes */
      var a = (el - 0.8) / 0.6, r = 16 + a * 170, q;
      if (a < 0.3) { ctx.globalAlpha = 0.5 * (1 - a / 0.3); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, g.w, g.h); ctx.globalAlpha = 1; }
      ring(cx, my, r, u + 2, a < 0.5 ? '#FFFFFF' : '#FFD34E');
      ring(cx, my, r * 0.7, 3, '#FFD34E');
      ctx.fillStyle = '#FFF6C0';
      for (q = 0; q < 8; q++) {                    /* eight spokes of square sparks thrown past the ring */
        var an = q * Math.PI / 4 + 0.2, dd;
        for (dd = 0; dd < 3; dd++) {
          var rd = r * (0.5 + dd * 0.28);
          ctx.fillRect(Math.round(cx + Math.cos(an) * rd - u / 2), Math.round(my + Math.sin(an) * rd - u / 2), u, u);
        }
      }
    }
    if (el >= 1.2) {                                /* the disco sphere drops, then its light spreads */
      var d = mv ? ease((el - 1.2) / 1.2) : 1, sy = Math.round(-40 + (g.stage * 0.2 + 40) * d), rr = Math.max(24, (cs * 1.6) | 0);
      var t = el * 3, i;
      ctx.globalAlpha = 0.3 * d;
      for (i = 0; i < 6; i++) {                     /* rainbow beams fanning from the ball */
        var ang = Math.PI / 2 + (i - 2.5) * 0.22 + (mv ? Math.sin(t) * 0.05 : 0);
        ctx.fillStyle = RAINBOW[i];
        ctx.beginPath(); ctx.moveTo(cx, sy);
        ctx.lineTo(cx + Math.cos(ang - 0.08) * g.h, sy + Math.sin(ang - 0.08) * g.h);
        ctx.lineTo(cx + Math.cos(ang + 0.08) * g.h, sy + Math.sin(ang + 0.08) * g.h);
        ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
      /* the ball: a rod from the truss, then an 8px mirror grid clipped to a disc, lit from the upper left */
      var cell = Math.max(4, (rr / 4) | 0), gx, gy, sw = (Math.floor(t * 3) + 7) % 11;
      ctx.fillStyle = INKC; ctx.fillRect(cx - 2, 0, 4, Math.max(0, sy - rr));
      ctx.fillStyle = '#5A5A6A'; ctx.fillRect(cx - 1, 0, 2, Math.max(0, sy - rr));
      ellP(ctx, cx, sy, rr + 3, rr + 3, INKC, 1);
      for (gy = -rr; gy < rr; gy += cell) for (gx = -rr; gx < rr; gx += cell) {
        var ddx = gx + cell / 2, ddy = gy + cell / 2, dist = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dist > rr - 1) continue;
        var cellN = ((gx / cell) | 0) * 7 + ((gy / cell) | 0) * 3;
        ctx.fillStyle = (cellN + 99) % 11 === sw ? RAINBOW[((cellN + 99) >> 1) % 6]
                      : (ddx + ddy < -rr * 0.5) ? '#F4F4FF' : dist > rr * 0.7 ? ((ddx + ddy > 0) ? '#5A5A78' : '#8A8AA8') : ((gx / cell + gy / cell) & 1 ? '#C8C8DC' : '#9A9AB8');
        ctx.fillRect(cx + gx, sy + gy, cell - 1, cell - 1);
      }
      ctx.fillStyle = '#FFFFFF';                     /* a four-point glint that turns on and off */
      if (Math.floor(t * 4) % 2 === 0) {
        var gl = (rr * 0.55) | 0;
        ctx.fillRect(cx - gl - 1, sy - gl - 10, 3, 21); ctx.fillRect(cx - gl - 10, sy - gl - 1, 21, 3);
      }
    }
  }

  function draw(sp) {
    var g = geom(), t = now(), s = g.s, half = (N * s) >> 1;
    var SD = [{ x: g.hisX, y: g.hisY, s: g.hs, p: g.pitchH }, { x: g.mineX, y: g.strumY, s: s, p: g.pitch }];
    var recY = g.strumY + half;        /* receptor centre line (yours) */
    var shook = false, sway = 0;
    if (!still() && sp < S.swayUntil) sway = Math.round(Math.sin(sp * 6) * S.sway);
    if (NEU.juice && NEU.juice.begin) shook = NEU.juice.begin(ctx, g.w, g.h);
    ctx.save();
    ctx.translate(sway, 0);
    if (hintEl) { var hy = Math.round(g.stage + 56) + 'px'; if (hintEl.style.top !== hy) hintEl.style.top = hy; }
    stage(g, sp);
    people(g, sp, t);
    if (S.mode === 'intro') {
      introFx(g, S.introT);
      ctx.restore();
      if (NEU.juice && NEU.juice.end) NEU.juice.end(ctx, shook);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      return;
    }
    healthBar(g, sp);                   /* under the notes, so a note rising from the bottom stays readable */

    /* receptors: his auto-confirm, yours press, then confirm on a hit or a held tail */
    var held = [[0, 0, 0, 0], [0, 0, 0, 0]];
    notes.forEach(function (n) {
      if (n.end > n.t && n.hit && sp < n.end && (n.mine ? !n.done : true)) held[n.mine ? 1 : 0][n.lane] = 1;
    });
    ctx.globalAlpha = won ? 0 : S.arrowA;      /* the fight is over: no receptors, no notes */
    for (var side = 0; side < 2; side++) {
      var sd = SD[side];
      for (var l = 0; l < 4; l++) {
        var f = (t - confirmAt[side][l] < 0.15 || held[side][l]) ? 2 : (side && keys[LANES[l]]) ? 1 : 0;
        if (side && l === S.blockLane && sp < S.blockUntil) f = 1;
        arrow(f, l, sd.x + l * sd.p, sd.y, sd.s);
      }
    }
    ctx.globalAlpha = 1;

    var lim = g.by - 8;                /* a hold's tail stops above the health bar */
    for (var i = 0; !won && i < notes.length; i++) {
      var n = notes[i], nd = SD[n.mine ? 1 : 0], nhalf = (N * nd.s) >> 1, nrec = nd.y + nhalf;
      var x = nd.x + n.lane * nd.p;
      var dn = dirOf(n), y = yAt(n.t, n.mine, sp, g, dn), ye = yAt(n.end, n.mine, sp, g, dn);
      if (ye < -64 || y > g.h + 64) continue;
      /* a hold's trail is intended, not a stray draw: it hangs below the receptor
         while the hold lasts, in the lane colour. His holds trail too, so on a
         phone his lane-0 hold is the purple dotted column down the left edge. */
      if (n.end > n.t && (n.mine ? !n.done : sp < n.end)) {
        tail(x, y, n.hit ? Math.max(y, nrec) : y, Math.min(ye, lim), n.lane, nd.s);
      }
      if (!n.hit && !n.done) {
        ctx.globalAlpha = n.kind ? 1 : S.arrowA;
        if (n.kind) itemIcon(n.kind, n.lane, x, y - nhalf, nd.s);
        else arrow(3, n.lane, x, y - nhalf, nd.s);
        ctx.globalAlpha = 1;
      }
    }

    /* the splash: eight pixels thrown off a SICK, gone in a quarter second */
    for (var j = splashes.length - 1; j >= 0; j--) {
      var p = splashes[j], a = t - p.t;
      if (a > 0.25) { splashes.splice(j, 1); continue; }
      var cx = g.mineX + p.l * g.pitch + half, r = s * 8 + a * 240, sz = Math.max(s, Math.round(s * 3 * (1 - a * 4)));
      ctx.fillStyle = LIGHT[p.l];
      for (var q = 0; q < 8; q++) {
        ctx.fillRect(Math.round(cx + Math.cos(q * Math.PI / 4) * r - sz / 2),
                     Math.round(recY + Math.sin(q * Math.PI / 4) * r - sz / 2), sz, sz);
      }
    }

    /* 3-2-1-GO in big numerals over your lane, fading through each beat */
    if (S.countdown) {
      ctx.globalAlpha = still() ? 1 : 1 - beatFrac(sp) * 0.7;
      text(S.countdown, g.cx, g.popY, 96, S.countdown === 'GO!' ? '#FFD34E' : '#FFFFFF');
      ctx.globalAlpha = 1;
    }

    /* the rating and combo rise beside your strumline and fade (Funkin's
       PopUpStuff: up 140-175 px/s, 550 px/s² down, fade 0.2 s after a beat) */
    for (var k = pops.length - 1; k >= 0; k--) {
      var o = pops[k], age = t - o.t, life = beatLen();
      if (age > life + 0.2) { pops.splice(k, 1); continue; }
      var dy = still() ? 0 : Math.round(-160 * age + 275 * age * age);
      ctx.globalAlpha = age < life ? 1 : 1 - (age - life) / 0.2;
      var sz2 = g.w < 600 ? o.size - 16 : o.size;          /* a phone gets 32/16 */
      ctx.font = sz2 + 'px "Determination Sans","Pixelify Sans",monospace';
      var hw = Math.ceil(ctx.measureText(o.text).width / 2) || 0;
      text(o.text, Math.min(o.x, g.w - 12 - hw), o.y + dy, sz2, o.col);
    }
    ctx.globalAlpha = 1;

    if (S.mode === 'break' && soulF) {
      /* the stage dims for the dodge: one black veil under the soul and the
         hazards, eased in and out with the arrows */
      var dim = 0.5 * (1 - S.arrowA);
      if (dim > 0.01) { ctx.globalAlpha = dim; ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, g.w, g.h); ctx.globalAlpha = 1; }
      drawHazards(g);
      if (NEU.danmaku && NEU.danmaku.soul) NEU.danmaku.soul.draw(ctx, soulF.x, soulF.y, 0);
      else { ctx.fillStyle = '#FF00FF'; ctx.fillRect(soulF.x - 4, soulF.y - 4, 8, 8); }
    }
    if (S.paused) {                     /* ESC pauses: the held frame under a veil */
      ctx.globalAlpha = 0.6; ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, g.w, g.h); ctx.globalAlpha = 1;
      text('PAUSED', g.w / 2, g.h / 2 - 16, 48, '#FFFFFF');
      text('ESC to resume', g.w / 2, g.h / 2 + 32, 16, '#EDE7DE');
    }
    ctx.restore();
    if (NEU.juice && NEU.juice.end) NEU.juice.end(ctx, shook);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  /* ── input ──────────────────────────────────────────────────────*/
  function laneOf(e) {
    var k = e.key;
    function hit(def, arrow) {
      var b = (NEU.keys && NEU.keys.get) ? NEU.keys.get(def) : def;
      return k === arrow || k === b || (b.length === 1 && k === b.toUpperCase());
    }
    if (hit('a', 'ArrowLeft')) return 0;
    if (hit('s', 'ArrowDown')) return 1;
    if (hit('w', 'ArrowUp')) return 2;
    if (hit('d', 'ArrowRight')) return 3;
    return -1;
  }
  addEventListener('keydown', function (e) {
    if (wrap.hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (running) { togglePause(); return; }   /* ESC pauses and resumes; Quit leaves */
      if (NEU.engine && NEU.engine.confirmExit) {
        NEU.engine.confirmExit('Rhythm Game', close);
      } else { close(); }
      return;
    }
    if (!running && !won && (e.key === 'Enter' || e.key === 'z' || e.key === 'Z')) { e.preventDefault(); retry(); return; }
    if (e.key === 'Shift') { keys.focus = true; return; }
    if ((e.key === 'x' || e.key === 'X') && soulF && NEU.danmaku && NEU.danmaku.key) {
      NEU.danmaku.key(soulF, e); e.preventDefault(); return;
    }
    var l = laneOf(e);
    if (l >= 0) { e.preventDefault(); if (!keys[LANES[l]]) press(l); keys[LANES[l]] = true; }
  });
  addEventListener('keyup', function (e) {
    var l = laneOf(e);
    if (e.key === 'Shift') keys.focus = false;
    if (l >= 0) { release(l); keys[LANES[l]] = false; }
  });

  function retry() {
    wrap.hidden = false;
    document.body.classList.add('is-playing');
    if (NEU.quest) NEU.quest.lock(true);
    if (msg) { msg.hidden = true; placeMsg(false); }
    layout();
    S.health = 1; S.paused = false; keys = {};
    resetScore();
    running = true;
    startRound(false);
    if (!NEU.kernel) loop();
    if (NEU.kernel) NEU.kernel.push('rhythm');
  }
  /* ESC: the song clock stops at the pause point and the music restarts at it */
  function togglePause() {
    if (!running) return;
    if (!S.paused) {
      S.paused = true; pausedAt = now(); stopBacking();
    } else {
      S.paused = false; t0 += now() - pausedAt; backing();
    }
    draw(songPos());
  }
  function open() {
    wrap.hidden = false;
    NEU.activeMinigame = 'rhythm';      /* the room underneath must not move or take Escape */
    document.body.classList.add('is-playing');
    if (NEU.quest) NEU.quest.lock(true);
    if (msg) { msg.hidden = true; placeMsg(false); }
    layout();
    round = 0; S.health = 1; S.paused = false; keys = {};
    resetScore(); splashes.length = 0;
    won = false;
    running = true;
    startRound(true);
    if (!NEU.kernel) loop();
    if (NEU.kernel) NEU.kernel.push('rhythm');
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
    if (raf && window.cancelAnimationFrame) cancelAnimationFrame(raf);
    raf = 0;
    stopBacking();                      /* the backing loop must not outlive the overlay */
    if (NEU.kernel && NEU.kernel.current() === 'rhythm') NEU.kernel.pop();
    /* release the input claim before handing control back to the room */
    if (NEU.activeMinigame === 'rhythm') NEU.activeMinigame = null;
    wrap.hidden = true;
    /* the engine re-adds is-playing itself for the room it enters next */
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

  if (NEU.kernel) NEU.kernel.register('rhythm', {
    tick: function (dt) { if (running) step(performance.now()); },
    open: open, close: close,
    running: function () { return running; }
  });

  NEU.rhythm = { open: open, close: close, win: win, songPos: songPos,
                 get running() { return running; }, get notes() { return notes; },
                 state: S, pops: pops, geom: geom, noteY: noteY, dirOf: dirOf,
                 charts: CHARTS, bpm: BPM, WINDOW: WINDOW_MS / 1000,
                 sections: SECTIONS, length: SONG };
})();
