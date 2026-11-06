/* kernel.js — Phase 2 scaffold: one rAF owner, scene stack, sim clock.
   ────────────────────────────────────────────────────────────────
   SCAFFOLD ONLY in this slice: it sets up NEU.kernel and starts the single
   rAF loop, but no scene has migrated yet — every scene still drives its own
   loop and opens/closes itself. Migration happens one scene per slice
   (dark, bullet, deck, rhythm/craft/crack, quiz, boss-polt, boss-scal,
   engine, sans last). The `k.legacy` adapter is what keeps music.js and
   touch.js (which poll scene `.running`) working while a scene migrates.

   Public surface (stable; slices add to it, never rename):
     NEU.kernel.register(name, api)   api = { tick(dt), open(), close(), running() }
     NEU.kernel.unregister(name)
     NEU.kernel.stack                 array of active scene names (top = current)
     NEU.kernel.current()             top of stack or null
     NEU.kernel.push(name) / pop() / replace(name)
     NEU.kernel.after(ms, fn)         sim-clock callback (wall clock for now)
     NEU.kernel.legacy(scene)         adapter for an unmigrated scene object
     NEU.kernel.start() / stop()
     NEU.kernel.rafId                 0 when stopped

   Sim clock vs wall clock: `after` uses performance.now() today; dark pulses
   stay on wall clock until fixes5 moves to the sim clock (plan caveat). */
(function () {
  'use strict';
  if (!window.NEU) window.NEU = {};

  var scenes = {};          // name -> api
  var stack = [];           // active scene names, top = current
  var afterQueue = [];      // { due, fn }
  var rafId = 0;
  var last = 0;
  var running = false;

  function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

  function tick(ts) {
    if (!running) { rafId = 0; return; }
    if (!last) last = ts;
    var dt = ts - last;
    last = ts;
    // sim-clock callbacks
    var n = now();
    var i = 0;
    while (i < afterQueue.length) {
      if (afterQueue[i].due <= n) {
        var cb = afterQueue[i].fn;
        afterQueue.splice(i, 1);
        try { cb(); } catch (e) { if (window.console) console.error('kernel.after', e); }
      } else i++;
    }
    // tick active scenes (top of stack only for now; stacked scenes pause)
    var top = stack.length ? stack[stack.length - 1] : null;
    if (top && scenes[top] && typeof scenes[top].tick === 'function' && isRunning(top)) {
      try { scenes[top].tick(dt); } catch (e) { if (window.console) console.error('kernel.tick ' + top, e); }
    }
    rafId = requestAnimationFrame(tick);
  }

  function isRunning(name) {
    var s = scenes[name];
    if (!s) return false;
    if (typeof s.running === 'function') return !!s.running();
    return !!s.running;
  }

  function register(name, api) {
    if (!name || !api) return;
    scenes[name] = api;
  }
  function unregister(name) { delete scenes[name]; var i = stack.indexOf(name); if (i >= 0) stack.splice(i, 1); }

  function push(name) { if (stack.indexOf(name) < 0) stack.push(name); }
  function pop() { return stack.pop() || null; }
  function replace(name) { stack.length = 0; if (name) stack.push(name); }

  function after(ms, fn) { afterQueue.push({ due: now() + (ms || 0), fn: fn }); }

  // Adapter for an unmigrated scene: delegates open/close/running/tick to it
  // so music.js and touch.js (which poll `.running`) keep working.
  function legacy(scene) {
    if (!scene) return null;
    return {
      open: function () { if (typeof scene.open === 'function') scene.open(); push(scene.__name || ''); },
      close: function () { if (typeof scene.close === 'function') scene.close(); pop(); },
      running: function () { return !!scene.running; },
      tick: function (dt) { if (typeof scene.tick === 'function') scene.tick(dt); },
      __legacy: true
    };
  }

  function start() {
    if (running) return;
    running = true;
    last = 0;
    rafId = requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  }

  var kernel = {
    register: register,
    unregister: unregister,
    stack: stack,
    current: function () { return stack.length ? stack[stack.length - 1] : null; },
    push: push,
    pop: pop,
    replace: replace,
    after: after,
    legacy: legacy,
    start: start,
    stop: stop,
    get rafId() { return rafId; },
    scenes: scenes
  };

  window.NEU.kernel = kernel;

  // Auto-start on load; scenes that need the loop register later.
  if (document && document.readyState !== 'loading') start();
  else if (document) document.addEventListener('DOMContentLoaded', start);
  else start();
})();
