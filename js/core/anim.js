/* anim.js — one small state animator on NEU.anim (ES5 IIFE, no input here).
   NEU.anim.make({ states:{ name:{ dur, loop, next } },
                   trans:{ 'a>b':{ dur, ease, hold } } })
     -> { set(name, force), step(dt), state, prev, u, k }
   Time is in seconds (dur, dt). u = 0..1 progress in the current state
   (wraps on loop). k = 0..1 eased blend from prev to state (1 = settled).
   - set(name): non-forced during a running transition queues it; it fires
     when the transition ends. No pops.
   - set(name, true): cuts at once (fail and hit paths), clears the queue.
   - trans.hold: a looping state keeps running to its next loop boundary
     before the transition to name starts.
   - ease: a NEU.juice curve name ('outCubic', 'backOut'), else linear.
   - Reduced motion (NEU.motion.reduced() or NEU.settings.reduced): every
     transition dur is 0, so state changes are instant with k = 1.
   State durations are real time, so a caller that steps by songPos deltas
   keeps the chart authoritative; the animator only shapes how it looks. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var EPS = 1e-9;

  function reduced() {
    var m = NEU.motion, s = NEU.settings;
    return !!((m && m.reduced && m.reduced()) || (s && s.reduced));
  }
  function ease(name, x) {
    var f = name && NEU.juice && NEU.juice[name];
    return typeof f === 'function' ? f(x) : x;
  }

  function make(cfg) {
    var S = cfg.states || {}, T = cfg.trans || {};
    var a = { state: null, prev: null, u: 0, k: 1 };
    var t = 0, tt = 0, tdur = 0, tr = false, ended = false, tname = null;
    var queue = null, held = null;

    function sdef() { return S[a.state] || {}; }
    function refresh() {
      var d = sdef().dur;
      a.u = d > 0 ? (sdef().loop ? (t % d) / d : Math.min(1, t / d)) : 0;
      a.k = tr ? ease(tname, Math.min(1, tt / tdur)) : 1;
    }
    function go(name, cut) {
      var tdef = a.state === null ? null : T[a.state + '>' + name];
      queue = held = null;
      tdur = tdef && !cut && !reduced() ? (tdef.dur || 0) : 0;
      tname = tdef ? tdef.ease : null;
      tr = tdur > 0;
      tt = t = 0;
      ended = false;
      a.prev = a.state;
      a.state = name;
      refresh();
    }
    function request(name) {
      var tdef = T[a.state + '>' + name];
      if (tr) queue = name;
      else if (tdef && tdef.hold && sdef().loop && sdef().dur > 0) held = name;
      else go(name);
    }

    a.set = function (name, force) {
      if (!S[name]) return;
      if (force) return go(name, true);
      if (name === a.state && !tr && held === null) return;
      request(name);
    };

    a.step = function (dt) {
      var guard = 0, e, adv, d;
      if (a.state === null) return;
      if (tr && reduced()) { tr = false; if (queue) go(queue); }
      while (dt > EPS && guard++ < 32) {
        d = sdef().dur;
        e = Infinity;
        if (tr) e = Math.min(e, tdur - tt);
        if (d > 0 && (sdef().loop || (!ended && sdef().next))) e = Math.min(e, d - t);
        adv = Math.min(dt, e);
        t += adv; dt -= adv;
        if (tr) tt += adv;
        if (tr && tt >= tdur - EPS) { tr = false; if (queue) { go(queue); continue; } }
        if (d > 0 && t >= d - EPS) {
          if (sdef().loop) {
            t -= d;
            if (held !== null) go(held);
          } else if (!ended) {
            ended = true; t = d;
            if (sdef().next) request(sdef().next);
          }
        }
      }
      refresh();
    };

    return a;
  }

  NEU.anim = { make: make };
})();
