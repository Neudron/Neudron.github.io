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
  var LANECOL = ['#C24AE0', '#4AC2E0', '#7BE38A', '#E04A6B'];
  var LIGHT   = ['#EBB0F7', '#B0EBF7', '#C9F7D0', '#F7B0C0'];
  var DARK    = ['#5E1C75', '#1C5E75', '#2A7038', '#751C33'];
  var INK = '#0E0818';
  var reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
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

  var TAUNT = [
    ["you want the axe.", "the axe wants a reason."],
    ["not bad. i've heard worse from a kettle.", "again. faster."],
    ["last one. if you land this i'll feel something."]
  ];

  var actx = null;
  var running = false, round = 0, notes = [], t0 = 0, lastSp = 0, phase = -1;
  var judgedT = 0;
  var keys = {};
  var S = { score: 0, combo: 0, health: 1, judgement: '', countdown: '', round: 0,
            misses: 0, acc: 1, judged: 0, weight: 0 };
  var pops = [], splashes = [];
  var confirmAt = [[-9, -9, -9, -9], [-9, -9, -9, -9]];   /* [his, mine][lane], audio time */
  var singAt = [-9, -9], singLane = [0, 0];

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
    S.judged++; S.weight += ACC[r]; S.acc = S.weight / S.judged;
    if (r === 4) S.misses++;
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
    confirmAt[1][lane] = singAt[1] = now(); singLane[1] = lane;
    if (bm <= EDGE[0] && !still()) splashes.push({ l: lane, t: now() });
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
        if (sp >= n.t) {
          n.hit = n.done = true; blip(n.lane, false);
          confirmAt[0][n.lane] = singAt[0] = now(); singLane[0] = n.lane;
        }
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
      msg.innerHTML = 'he hands you the axe. "that was rude and i respect it."' +
        '<br><small>esc to leave</small>';
    }
    draw(songPos());
  }

  function lose() {
    running = false;
    if (msg) {
      msg.hidden = false;
      msg.innerHTML = 'he stops, mid-bar. "no."' +
        '<br><small>enter to go again &middot; esc to leave</small>';
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
     yours from 48px past the middle, receptors at the top, notes rising. */
  function geom() {
    var w = innerWidth, h = innerHeight;
    var s = Math.max(2, Math.min(6, Math.floor((w / 2 - 56) / (4 * N))));
    var pitch = N * s, hisX = 48, mineX = Math.round(w / 2 + 48);
    var floor = h - 16;
    if (msg && !msg.hidden && msg.getBoundingClientRect) floor = Math.round(msg.getBoundingClientRect().top) - 16;
    var by = floor - 56;               /* the health bar, with the score line under it */
    return { w: w, h: h, s: s, pitch: pitch, hisX: hisX, mineX: mineX,
             cx: mineX + 2 * pitch, strumY: 72, by: by, stage: by - 40,
             popY: Math.round((72 + N * s + by - 40) / 2),
             K: 1000 * PIXELS_PER_MS * SPEED[Math.min(round, SPEED.length - 1)] };
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

  /* A dark Deltarune stage: stepped bands, two still spotlights, a floor. */
  function stage(g) {
    var BAND = ['#06030C', '#0A0614', '#0F091D', '#140C26', '#19102F', '#1F1439'];
    var bh = Math.ceil(g.stage / BAND.length);
    for (var i = 0; i < BAND.length; i++) { ctx.fillStyle = BAND[i]; ctx.fillRect(0, i * bh, g.w, bh); }
    ctx.fillStyle = '#2A1C42'; ctx.fillRect(0, g.stage, g.w, g.h - g.stage);
    ctx.fillStyle = '#5A3C82'; ctx.fillRect(0, g.stage, g.w, 4);
    ctx.fillStyle = '#22163A';
    for (var x = (g.w / 2 | 0) % 64; x < g.w; x += 64) ctx.fillRect(x, g.stage + 4, 4, g.h - g.stage);
    ctx.fillStyle = '#FFFFFF';
    [g.hisX + 2 * g.pitch, g.cx].forEach(function (cx) {
      for (var k = 0; k < 8; k++) {
        var hw = 24 + k * 10, y0 = Math.round(k * g.stage / 8), y1 = Math.round((k + 1) * g.stage / 8);
        ctx.globalAlpha = 0.035; ctx.fillRect(cx - hw, y0, 2 * hw, y1 - y0);
      }
      ctx.globalAlpha = 0.07; ctx.fillRect(cx - 104, g.stage + 4, 208, 12);
    });
    ctx.globalAlpha = 1;
  }

  function beatFrac(sp) { var b = sp / beatLen(); return b - Math.floor(b); }

  /* The two of them stand on the floor under their strumlines and bob on
     the beat. No sing frames exist, so a hit leans them toward the lane. */
  function people(g, sp, t) {
    var L = NEU.engineLook;
    if (!L) return;
    var cs = Math.max(3, Math.min(8, Math.floor(Math.min(g.w / 4, g.h / 2.4) / 13)));
    var bob = still() ? 0 : beatFrac(sp) < 0.25 ? cs : 0;
    var LEAN = [[-1, 0], [0, 1], [0, -1], [1, 0]];
    var who = [g.hisX + 2 * g.pitch, g.cx];
    for (var side = 0; side < 2; side++) {
      var d = (!still() && t - singAt[side] < 0.15) ? LEAN[singLane[side]] : [0, 0];
      var x = who[side] + d[0] * cs, y = g.stage + 8 + bob + d[1] * cs;
      if (side) L.drawPlayer(ctx, x, y, 'left', 0, false, cs, 1000);
      else L.drawProp(ctx, 'merchant', null, x, y, cs, 0, 0);
    }
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
                 Math.min(round + 1, CHARTS.length) + '/' + CHARTS.length), g.w / 2 | 0, by + 32);
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

  function draw(sp) {
    var g = geom(), t = now(), s = g.s, half = (N * s) >> 1;
    var recY = g.strumY + half;        /* receptor centre line */
    stage(g);
    people(g, sp, t);

    /* receptors: his auto-confirm, yours press, then confirm on a hit or a held tail */
    var held = [[0, 0, 0, 0], [0, 0, 0, 0]];
    notes.forEach(function (n) {
      if (n.end > n.t && n.hit && sp < n.end && (n.mine ? !n.done : true)) held[n.mine ? 1 : 0][n.lane] = 1;
    });
    for (var side = 0; side < 2; side++) {
      var x0 = side ? g.mineX : g.hisX;
      for (var l = 0; l < 4; l++) {
        var f = (t - confirmAt[side][l] < 0.15 || held[side][l]) ? 2 : (side && keys[LANES[l]]) ? 1 : 0;
        arrow(f, l, x0 + l * g.pitch, g.strumY, s);
      }
    }

    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      var x = (n.mine ? g.mineX : g.hisX) + n.lane * g.pitch;
      var y = Math.round(recY + (n.t - sp) * g.K), ye = Math.round(recY + (n.end - sp) * g.K);
      if (ye < -64 || y > g.h + 64) continue;
      if (n.end > n.t && (n.mine ? !n.done : sp < n.end)) {
        tail(x, y, n.hit ? Math.max(y, recY) : y, ye, n.lane, s);
      }
      if (!n.hit && !n.done) arrow(3, n.lane, x, y - half, s);
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
      var sz = g.w < 600 ? o.size - 16 : o.size;           /* a phone gets 32/16 */
      ctx.font = sz + 'px "Determination Sans","Pixelify Sans",monospace';
      var hw = Math.ceil(ctx.measureText(o.text).width / 2) || 0;
      text(o.text, Math.min(o.x, g.w - 12 - hw), o.y + dy, sz, o.col);
    }
    ctx.globalAlpha = 1;

    healthBar(g, sp);
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
    S.misses = S.judged = S.weight = 0; S.acc = 1; pops.length = splashes.length = 0;
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
                 state: S, pops: pops, geom: geom,
                 charts: CHARTS, bpm: BPM, WINDOW: WINDOW_MS / 1000 };
})();
