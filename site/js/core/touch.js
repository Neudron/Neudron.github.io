/* touch.js — thumb controls for phones.
   ────────────────────────────────────────────────────────────────
   Act IV was keyboard-only, which meant the entire second half of the
   game did not exist on a phone.

   THE APPROACH. Nine scenes read input, all of them the same way: a
   `keydown`/`keyup` listener on `window` that switches on `e.key`. So
   this module does not touch any of them. It draws a pad and
   synthesises real KeyboardEvents. Every scene — including any scene
   written later — gets touch support for free, and there is exactly one
   place where a stuck key can happen instead of nine.

   The alternative was adding pointer handlers to each scene. That is
   nine copies of "which direction is this touch", nine chances to
   diverge, and it would not have covered the acts I-III scenes at all.

   WHAT IT HAS TO GET RIGHT
   - Diagonals. Dodging bullets on four-way input is not playable, so
     the stick is a vector, not four buttons.
   - Focus/precision (Shift) in the three bullet-hell fights, for the
     same reason.
   - Never a stuck key. Any lost pointer, any hidden scene, any blur
     releases everything. A held direction with nothing to release it
     walks you into a wall forever.
   - Stay off desktop. Fine-pointer users never see it unless they ask.
   ──────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  if (!document.body) return;

  /* 'auto' | 'on' | 'off'.

     This one lives in localStorage rather than as a save flag like the
     other settings, on purpose. Every other setting is part of the
     playthrough; this one is a fact about the device you are holding.
     Resetting the game should not take your thumb controls away. */
  var K_MODE = 'opt_touch';

  /* ── which keys each scene wants ──────────────────────────────────
     Read straight off the modules' own handlers. `a` is the primary
     action, `b` is back, `x` is the one extra that scene needs.

     `xHold` on an extra means it is a modifier you keep pressed (focus
     mode) rather than a press you release immediately.

     `repeat` means the stick auto-repeats while held, the way a
     keyboard does. Menus need it — without it, holding left in the
     crafting grid moves one cell and then stalls until you re-centre
     your thumb, because a held key only ever fires one keydown.
     Movement must NOT have it (you would stutter), and neither must
     the rhythm game, where one deliberate flick is one note hit and a
     repeat would spam the lane. */
  var PROFILES = [
    { id: 'engine', on: function () { return NEU.engine && NEU.engine.running; },
      a: 'e',     aLabel: 'talk',   b: 'Escape',
      x: 'r',     xLabel: 'reset',  stick: true },

    { id: 'scal',   on: function () { return NEU.scal && NEU.scal.running; },
      a: 'Enter', aLabel: 'ok',     b: 'Escape',
      x: 'Shift', xLabel: 'focus',  xHold: true, stick: true },

    { id: 'polt',   on: function () { return NEU.polt && NEU.polt.running; },
      a: 'Enter', aLabel: 'ok',     b: 'Escape',
      x: 'Shift', xLabel: 'focus',  xHold: true, stick: true },

    { id: 'bullet', on: function () { return NEU.bullet && NEU.bullet.running; },
      a: 'Enter', aLabel: 'ok',     b: 'Escape',
      x: 'Shift', xLabel: 'focus',  xHold: true, stick: true },

    { id: 'dark',   on: function () { return NEU.dark && NEU.dark.running; },
      a: 'e',     aLabel: 'use',    b: 'Escape', stick: true },

    { id: 'rhythm', on: function () { return NEU.rhythm && NEU.rhythm.running; },
      a: 'Enter', aLabel: 'start',  b: 'Escape', stick: true },

    { id: 'craft',  on: function () { return NEU.craft && NEU.craft.running; },
      a: 'Enter', aLabel: 'place',  b: 'Escape', stick: true, repeat: true },

    { id: 'quiz',   on: function () { return NEU.quiz && NEU.quiz.running; },
      a: 'Enter', aLabel: 'pick',   b: 'Escape', stick: false },

    { id: 'deck',   on: function () { return NEU.deck && NEU.deck.running; },
      a: 'Enter', aLabel: 'open',   b: 'Escape',
      x: 'Tab',   xLabel: 'next',   stick: true, repeat: true }
  ];

  /* ── should we be visible at all ───────────────────────────────── */
  var sawTouch = false;
  function coarse() {
    try { return window.matchMedia('(pointer: coarse)').matches; }
    catch (e) { return false; }
  }
  function mode() {
    try { return localStorage.getItem(K_MODE) || 'auto'; } catch (e) { return 'auto'; }
  }
  function wanted() {
    var m = mode();
    if (m === 'on')  return true;
    if (m === 'off') return false;
    return coarse() || sawTouch;
  }
  addEventListener('touchstart', function () {
    if (sawTouch) return;
    sawTouch = true;
    sync();
  }, { passive: true, capture: true });

  /* ── key synthesis ─────────────────────────────────────────────── */
  /* Held keys, so we only dispatch on CHANGE. Firing keydown every
     frame would flood handlers that count presses (the rhythm game
     scores one hit per keydown). */
  var held = {};

  function send(key, down) {
    if (!key) return;
    if (!!held[key] === !!down) return;
    held[key] = !!down;
    var ev;
    try {
      ev = new KeyboardEvent(down ? 'keydown' : 'keyup',
                             { key: key, bubbles: true, cancelable: true });
    } catch (e) {                       /* very old engines */
      ev = document.createEvent('Event');
      ev.initEvent(down ? 'keydown' : 'keyup', true, true);
      ev.key = key;
    }
    window.dispatchEvent(ev);
  }

  /* The one function that must never be missed. Every exit path — a
     lifted thumb, a cancelled pointer, a closed scene, a backgrounded
     tab — comes through here.

     `killRepeat` is filled in by wireStick. A running auto-repeat is
     the same class of bug as a stuck key: the scene closes, the timer
     does not, and it keeps firing keydowns into nothing. */
  var killRepeat = function () {};
  var clearStick = function () {};

  function releaseAll() {
    killRepeat();
    clearStick();
    for (var k in held) if (held[k]) send(k, false);
  }

  /* ── the DOM ───────────────────────────────────────────────────── */
  var pad = null, stick = null, nub = null, btnA = null, btnB = null, btnX = null;
  var built = false, cur = null;

  function mk(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function build() {
    if (built) return;
    built = true;

    pad = mk('div', 'tpad');
    pad.hidden = true;
    pad.setAttribute('aria-hidden', 'true');   /* keyboard users have keys */

    stick = mk('div', 'tpad__stick', pad);
    nub   = mk('div', 'tpad__nub', stick);

    var acts = mk('div', 'tpad__acts', pad);
    btnX = mk('button', 'tpad__b tpad__b--x', acts);
    btnB = mk('button', 'tpad__b tpad__b--b', acts);
    btnA = mk('button', 'tpad__b tpad__b--a', acts);
    btnB.textContent = 'back';

    [btnA, btnB, btnX].forEach(function (b) {
      b.type = 'button';
      b.tabIndex = -1;                     /* never in the tab order */
    });

    document.body.appendChild(pad);
    wireStick();
    wireButton(btnA, function () { return cur && cur.a; }, true);
    wireButton(btnB, function () { return cur && cur.b; }, true);
    wireButton(btnX, function () { return cur && cur.x; }, false);
  }

  /* ── buttons ───────────────────────────────────────────────────── */
  /* `tap` = press and release on the same gesture (a confirm).
     Otherwise the key is held for as long as the thumb is down, which
     is what focus mode needs. */
  function wireButton(el, keyOf, tap) {
    var id = null;
    el.addEventListener('pointerdown', function (e) {
      var k = keyOf(); if (!k) return;
      e.preventDefault();
      id = e.pointerId;
      if (el.setPointerCapture) { try { el.setPointerCapture(id); } catch (x) {} }
      el.classList.add('is-down');
      send(k, true);
      /* A confirm is a press, not a hold. Release on the next frame so
         the keydown lands first and anything watching keyup still sees
         a real pair. */
      if (tap || !cur.xHold) requestAnimationFrame(function () { send(k, false); });
      if (NEU.juice) NEU.juice.hit('tick');
    });
    function up(e) {
      if (id !== null && e && e.pointerId !== id) return;
      id = null;
      el.classList.remove('is-down');
      var k = keyOf(); if (k) send(k, false);
    }
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  }

  /* ── the stick ─────────────────────────────────────────────────── */
  var DIRS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

  /* Auto-repeat, for menu scenes only. Matches a keyboard: a long
     first delay so a single nudge stays a single step, then a steady
     rate. Both numbers are the OS defaults rounded — anything faster
     overshoots a 3x3 grid. */
  var REPEAT_DELAY = 340, REPEAT_RATE = 170;

  function wireStick() {
    var id = null, cx = 0, cy = 0, r = 1;
    var repTimer = null, repDir = null;

    function stopRepeat() {
      if (repTimer) { clearTimeout(repTimer); clearInterval(repTimer); repTimer = null; }
      repDir = null;
    }

    /* Re-send one direction as a fresh press. The key is already down,
       so it has to come up first or `send` will suppress it as a
       no-change. */
    function tick(k) {
      send(k, false);
      send(k, true);
    }

    function startRepeat(k) {
      if (!cur || !cur.repeat || repDir === k) return;
      stopRepeat();
      repDir = k;
      repTimer = setTimeout(function () {
        repTimer = setInterval(function () {
          if (repDir) tick(repDir); else stopRepeat();
        }, REPEAT_RATE);
      }, REPEAT_DELAY);
    }

    function begin(e) {
      if (!cur || !cur.stick) return;
      e.preventDefault();
      id = e.pointerId;
      if (stick.setPointerCapture) { try { stick.setPointerCapture(id); } catch (x) {} }
      var b = stick.getBoundingClientRect();
      cx = b.left + b.width / 2; cy = b.top + b.height / 2;
      r = Math.max(12, b.width / 2);
      stick.classList.add('is-down');
      move(e);
    }

    function move(e) {
      if (id === null || e.pointerId !== id) return;
      e.preventDefault();
      var dx = (e.clientX - cx) / r, dy = (e.clientY - cy) / r;
      var d = Math.sqrt(dx * dx + dy * dy);

      /* Dead zone. A thumb resting on the pad is not an input, and
         without this the player drifts. 0.28 was picked by feel: small
         enough to respond, large enough that you can rest. */
      if (d < 0.28) { clear(); nudge(0, 0); return; }

      /* Diagonals: anything past ~22 degrees off an axis counts as
         both. Deliberately generous — the whole point of a vector
         stick is that you can dodge on the diagonal without aiming. */
      var ux = dx / d, uy = dy / d, T = 0.38;
      send('ArrowLeft',  ux < -T);
      send('ArrowRight', ux >  T);
      send('ArrowUp',    uy < -T);
      send('ArrowDown',  uy >  T);

      /* Repeat follows the DOMINANT axis only. A menu that moved
         diagonally on repeat would skip cells. */
      if (cur && cur.repeat) {
        var k = null;
        if (Math.abs(ux) > Math.abs(uy)) k = ux < 0 ? 'ArrowLeft' : 'ArrowRight';
        else                             k = uy < 0 ? 'ArrowUp'   : 'ArrowDown';
        startRepeat(k);
      }

      var c = Math.min(1, d);
      nudge(ux * c, uy * c);
    }

    function end(e) {
      if (id !== null && e && e.pointerId !== id) return;
      id = null;
      stick.classList.remove('is-down');
      clear(); nudge(0, 0);
    }

    function clear() {
      stopRepeat();
      for (var i = 0; i < 4; i++) send(DIRS[i], false);
    }
    function nudge(x, y) {
      nub.style.transform = 'translate(' + (x * 26).toFixed(1) + 'px,' +
                                           (y * 26).toFixed(1) + 'px)';
    }

    killRepeat = stopRepeat;
    /* releaseAll() calls this so a backgrounded tab cannot leave the
       stick latched to a pointer that is no longer there — the pad
       would come back looking held. end(null) skips the pointer-id
       guard and runs the same clear path. */
    clearStick = function () { end(null); };

    stick.addEventListener('pointerdown', begin);
    stick.addEventListener('pointermove', move);
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
    stick.addEventListener('pointerleave', end);
  }

  /* ── which profile is live ─────────────────────────────────────── */
  function active() {
    for (var i = 0; i < PROFILES.length; i++) {
      var p = PROFILES[i];
      var on = false;
      try { on = !!p.on(); } catch (e) { on = false; }
      if (on) return p;
    }
    return null;
  }

  /* The dialogue box is modal and sits above everything (z 96). While
     it is up the only useful input is "advance", which is a tap on the
     box itself (sans.js binds click). Showing the pad over it would
     put two competing targets on screen and cover the words. */
  function talking() {
    var t = document.getElementById('tbox');
    return !!(t && !t.hidden);
  }

  function sync() {
    var p = active();
    var show = !!p && wanted() && !talking();

    if (!show) {
      if (built && pad && !pad.hidden) { pad.hidden = true; }
      if (cur) { releaseAll(); cur = null; }
      return;
    }

    build();
    if (cur !== p) {
      releaseAll();                       /* never carry a key across scenes */
      cur = p;
      btnA.textContent = p.aLabel || 'ok';
      btnX.hidden = !p.x;
      if (p.x) btnX.textContent = p.xLabel || '';
      stick.hidden = !p.stick;
      pad.setAttribute('data-scene', p.id);
    }
    pad.hidden = false;
  }

  /* Poll. Scenes open and close from a dozen places and none of them
     announce it; a 200ms poll is cheaper than an event contract with
     nine modules, and the pad appearing a fifth of a second late is
     imperceptible next to a scene fade. */
  setInterval(sync, 200);
  addEventListener('resize', sync);
  addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) releaseAll();
  });
  /* A physical keyup makes the pad's latch stale: the pad thinks it is
     still holding ArrowLeft, so a thumb that has not moved stops being
     re-sent the moment the real keyboard lets go. Clear the latch —
     the next pointermove re-arms the direction. */
  addEventListener('keyup', function (e) {
    if (e && held[e.key]) held[e.key] = false;
  });

  NEU.touch = {
    /* dev + settings */
    get mode() { return mode(); },
    set: function (m) {
      try { localStorage.setItem(K_MODE, m); } catch (e) {}
      sync();
    },
    get visible() { return !!(pad && !pad.hidden); },
    get scene() { return cur ? cur.id : null; },
    get held() { var o = {}, k; for (k in held) if (held[k]) o[k] = true; return o; },
    profiles: PROFILES,
    /* tests */
    _sync: sync,
    _release: releaseAll,
    _send: send
  };
})();
