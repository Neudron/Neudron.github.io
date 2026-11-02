/* motion.js — one answer to "should this move / flash?"
   ───────────────────────────────────────────────────────────────────
   Loaded FIRST, before every other script, because modules read it
   while they boot.

   The device's prefers-reduced-motion is a DEFAULT, not a lock. Many
   people have it on without knowing: Windows turns "animation
   effects" off in some performance modes, and some phones turn it on
   in battery saver. The site used to treat it as final. The cube then
   refused to turn, and Act I could not be finished. The rule now
   follows Xbox Accessibility Guidelines 117/118: honour the device by
   default, tell the player it happened, and let them choose.

     NEU.motion.reduced()   true = calm motion (no auto spin, shake, sway)
     NEU.motion.calmFlash() true = flashes dim instead of whitening
     NEU.motion.device      the device's own setting (live)
     NEU.motion.pref        'auto' | 'full' | 'reduced'
     NEU.motion.flashPref   'auto' | 'full' | 'reduced'  (auto = follow motion)
     NEU.motion.set(pref, flashPref)   either may be null = keep
     NEU.motion.on(fn)      fn(reduced, calmFlash) on every change

   Stored in localStorage, not in the save file. It is a comfort setting
   for this device, it has to be read before save.js exists, and wiping
   a save must not turn flashing back on.

   Reduced motion NEVER removes an interaction. It removes motion that
   the player did not cause. Dragging the cube still turns it.     */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  if (NEU.motion) return;

  var KEY = 'neu.motion';
  var mq = null;
  try { mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null; } catch (e) {}

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function save(o) {
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
  }

  var st = load();
  if (!/^(auto|full|reduced)$/.test(st.m)) st.m = 'auto';
  if (!/^(auto|full|reduced)$/.test(st.f)) st.f = 'auto';

  var subs = [];

  function device() { return !!(mq && mq.matches); }
  function reduced() { return st.m === 'reduced' || (st.m === 'auto' && device()); }
  function calmFlash() { return st.f === 'reduced' || (st.f === 'auto' && reduced()); }

  function paint() {
    var c = document.documentElement.classList;
    c.toggle('rm', reduced());
    c.toggle('rf', calmFlash());
  }

  function emit() {
    paint();
    for (var i = 0; i < subs.length; i++) {
      try { subs[i](reduced(), calmFlash()); } catch (e) {}
    }
  }

  function onDevice() { emit(); }
  if (mq) {
    if (mq.addEventListener) mq.addEventListener('change', onDevice);
    else if (mq.addListener) mq.addListener(onDevice);
  }

  /* Which device the player is on, for the "how to change it" steps.
     A guess is fine: every answer also says where the in-game switch is. */
  function os() {
    var ua = (navigator.userAgent || '') + ' ' + (navigator.platform || '');
    if (/iPhone|iPad|iPod/.test(ua) || (/Mac/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    if (/CrOS/.test(ua)) return 'chromeos';
    if (/Mac/.test(ua)) return 'mac';
    if (/Win/.test(ua)) return 'windows';
    if (/Linux/.test(ua)) return 'linux';
    return 'other';
  }

  /* MDN's per-platform paths for the reduce-motion setting (2026). */
  var STEPS = {
    windows:  'Windows 11: Settings > Accessibility > Visual effects > Animation effects (on = motion). Windows 10: Settings > Ease of Access > Display > Show animations.',
    mac:      'Mac: System Settings > Accessibility > Display (Motion on newer Macs) > Reduce motion (off = motion).',
    ios:      'iPhone / iPad: Settings > Accessibility > Motion > Reduce Motion (off = motion).',
    android:  'Android: Settings > Accessibility > Remove animations (off = motion).',
    linux:    'GNOME: Settings > Accessibility > Seeing > Reduced animation. KDE: System Settings > Workspace Behavior > General Behavior > Animation speed.',
    chromeos: 'ChromeOS: Settings > Accessibility > Display and magnification.',
    other:    'Look for "reduce motion" or "animations" in your device\'s accessibility settings.'
  };

  NEU.motion = {
    reduced: reduced,
    calmFlash: calmFlash,
    get device() { return device(); },
    get pref() { return st.m; },
    get flashPref() { return st.f; },
    set: function (m, f) {
      if (m && /^(auto|full|reduced)$/.test(m)) st.m = m;
      if (f && /^(auto|full|reduced)$/.test(f)) st.f = f;
      save(st);
      emit();
    },
    on: function (fn) { if (typeof fn === 'function') subs.push(fn); },
    os: os,
    steps: function () { return STEPS[os()] || STEPS.other; },
    /* one-time notes: true the first time only */
    once: function (k) {
      if (st['seen_' + k]) return false;
      st['seen_' + k] = 1; save(st); return true;
    }
  };

  paint();
})();
