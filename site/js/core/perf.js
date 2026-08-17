/* perf.js — frame time, and a budget to hold it against.
   ───────────────────────────────────────────────────────────────────
   Nothing in this project measured frame time. That was tolerable
   while the heaviest thing on screen was one canvas; it stopped being
   tolerable when `core/music.js` started running an audio scheduler
   every 40ms alongside three bullet-hell scenes, a particle pool and
   a three.js cube.

   AN FPS COUNTER THAT COSTS FPS IS A JOKE, so:

   - it samples nothing until you ask for it (`fps` in the dev console)
   - the rAF loop only exists while it is on
   - the DOM is written four times a second, not sixty. Writing a
     number into an element every frame is itself a layout every
     frame, which is enough to move the number you are reading

   WHY p99 AND NOT AVERAGE. Average frame time hides exactly the
   problem worth finding. A scene that runs at a steady 60 with one
   90ms hitch per second averages out near budget and feels broken,
   because the hitch is the thing you feel. The "1% low" and the worst
   frame in the window are what a stutter looks like in numbers.

   AND WHY NOT p95. This was written against p95 first, and the suite
   caught it: one hitch per second over a three-second window is three
   bad frames out of 180, which is 1.7% — inside p95's discard, so the
   meter reported a clean 15ms for a feed that was visibly stuttering
   by construction. p95 is the right statistic for "is this generally
   heavy" and the wrong one for "does this hitch". p99 keeps the top
   two frames of the window, which is what a hitch actually is.

   THE BUDGET
     16.7ms  target   60fps, one frame per refresh
     20.0ms  warn     50fps. Still smooth; something is getting heavy
     33.3ms  fail     30fps. Visibly stuttering on a phone

   These are per-frame totals for everything on screen, not per scene.
   Act IV is a pixel game on a canvas; if it cannot hold 60 there is
   headroom being wasted somewhere, and this says where.             */

(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};
  if (NEU.perf) return;

  var TARGET = 1000 / 60;     /* 16.67 */
  var WARN   = 20;
  var FAIL   = 1000 / 30;     /* 33.33 */
  var WINDOW = 180;           /* ~3s at 60fps */
  var DRAW_EVERY = 250;       /* ms between DOM writes */

  var times = [], head = 0, n = 0;
  var running = false, raf = 0, last = 0, lastDraw = 0;
  var el = null, worstEver = 0;

  function push(dt) {
    /* A tab that was in the background reports one enormous frame on
       return. That is not a stutter, it is a gap, and letting it into
       the window poisons the worst-frame reading for three seconds. */
    if (dt > 250) return;
    times[head] = dt;
    head = (head + 1) % WINDOW;
    if (n < WINDOW) n++;
    if (dt > worstEver) worstEver = dt;
  }

  function stats() {
    if (!n) return { n: 0, fps: 0, mean: 0, p50: 0, p99: 0, worst: 0, verdict: 'no data' };
    var a = times.slice(0, n).sort(function (x, y) { return x - y; });
    var sum = 0, i;
    for (i = 0; i < n; i++) sum += a[i];
    var mean = sum / n;
    var p50 = a[(n * 0.50) | 0];
    var p99 = a[Math.min(n - 1, (n * 0.99) | 0)];
    var worst = a[n - 1];
    /* Judged on the 1% low, not the mean and not p95. See the header. */
    var verdict = p99 <= TARGET ? 'ok' : p99 <= WARN ? 'warn' : p99 <= FAIL ? 'over' : 'fail';
    return { n: n, fps: mean ? 1000 / mean : 0, mean: mean, p50: p50, p99: p99,
             worst: worst, worstEver: worstEver, verdict: verdict };
  }

  /* Which scene the number belongs to. Same polling idea as touch.js
     and music.js — a frame time with no attribution tells you that
     something is slow and nothing about what. */
  function scene() {
    var S = [['scal', NEU.scal], ['polt', NEU.polt], ['bullet', NEU.bullet],
             ['rhythm', NEU.rhythm], ['quiz', NEU.quiz], ['craft', NEU.craft],
             ['deck', NEU.deck], ['dark', NEU.dark], ['engine', NEU.engine]];
    for (var i = 0; i < S.length; i++) {
      try { if (S[i][1] && S[i][1].running) return S[i][0]; } catch (e) {}
    }
    return 'page';
  }

  function build() {
    if (el) return el;
    el = document.createElement('div');
    el.className = 'fps';
    el.setAttribute('aria-hidden', 'true');   /* a dev readout, not content */
    el.hidden = true;
    document.body.appendChild(el);
    return el;
  }

  function paint() {
    var s = stats();
    if (!el) return;
    el.setAttribute('data-v', s.verdict);
    el.textContent =
      Math.round(s.fps) + ' fps   ' +
      s.p50.toFixed(1) + ' / ' + s.p99.toFixed(1) + ' / ' + s.worst.toFixed(1) + ' ms' +
      '   ' + scene();
  }

  function frame(now) {
    if (!running) return;
    if (last) push(now - last);
    last = now;
    if (now - lastDraw >= DRAW_EVERY) { lastDraw = now; paint(); }
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return true;
    running = true;
    times = []; head = 0; n = 0; worstEver = 0;
    last = 0; lastDraw = 0;
    build();
    el.hidden = false;
    raf = requestAnimationFrame(frame);
    return true;
  }

  function stop() {
    if (!running) return false;
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (el) el.hidden = true;
    return true;
  }

  /* One line for the dev log, so `fps` can report without the overlay
     having to be watched. */
  function line() {
    var s = stats();
    if (!s.n) return 'no frames sampled yet';
    return Math.round(s.fps) + ' fps · p50 ' + s.p50.toFixed(1) +
           'ms · p99 ' + s.p99.toFixed(1) + 'ms · worst ' + s.worst.toFixed(1) +
           'ms · ' + s.n + ' frames · ' + scene() + ' · ' + s.verdict +
           ' (budget ' + TARGET.toFixed(1) + '/' + WARN.toFixed(1) + '/' + FAIL.toFixed(1) + ')';
  }

  /* Backgrounding is not a stutter. Drop the stale timestamp so the
     first frame back is not measured against it. */
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) last = 0;
  });

  NEU.perf = {
    start: start, stop: stop, toggle: function () { return running ? (stop(), false) : (start(), true); },
    stats: stats, line: line, scene: scene,
    get running() { return running; },
    TARGET: TARGET, WARN: WARN, FAIL: FAIL, WINDOW: WINDOW,
    /* tests: feed frames without a real rAF loop */
    _push: push,
    _paint: paint,
    get el() { return el; }
  };
})();
