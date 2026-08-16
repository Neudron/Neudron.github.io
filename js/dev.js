/* dev.js — the skip button.
   ───────────────────────────────────────────────────────────────────
   Ctrl + Shift + `  (backquote)

   Everything past the contact section is gated behind a nine-swing
   errand, and re-walking it to test the room behind the door is a
   minute of scrolling per attempt. This exists so it doesn't have to
   be.

   The combination is deliberately awkward: backquote is not on any
   browser or OS shortcut worth colliding with, and requiring both
   modifiers means it cannot be hit by accident while reading. It is
   not hidden — it is just not discoverable, which is the right level
   of secret for a tool rather than an easter egg.

   Commands are matched loosely (trimmed, lowercased) because the
   point is speed, not ceremony.                                     */

(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};
  var panel = document.getElementById('dev');
  var input = document.getElementById('devIn');
  var out   = document.getElementById('devOut');
  if (!panel || !input || !out) return;

  function log(s) {
    var p = document.createElement('div');
    p.textContent = s;
    out.appendChild(p);
    out.scrollTop = out.scrollHeight;
  }

  var CMDS = {
    help: function () {
      log('sans   skip the whole sword errand, hand over the key');
      log('key    same thing, shorter');
      log('door   open the room');
      log('game   start the bullet hell');
      log('food   grant "dog food?"');
      log('dog    summon him directly');
      log('dark   open the blackout');
      log('warp   stand at the grey door');
      log('reset  back to the start');
      log('close  esc also works');
    },
    sans: function () {
      if (NEU.devSkip) { NEU.devSkip(); log('skipped. key is yours, door is live.'); }
      else log('sans.js not loaded');
    },
    door: function () {
      if (NEU.devOpenRoom) { NEU.devOpenRoom(); log('room open.'); }
      else log('no door');
    },
    game: function () {
      if (NEU.bullet) { hide(); NEU.bullet.open(); log('good luck.'); }
      else log('bullet.js not loaded');
    },
    food: function () {
      if (NEU.grantDogFood) { NEU.grantDogFood(); log('"dog food?" granted.'); }
      else log('nope');
    },
    dog: function () {
      if (NEU.devDog) { NEU.devDog(); log('who let him in'); }
      else log('nope');
    },
    dark: function () {
      if (NEU.dark) { hide(); NEU.dark.open(); log('lights out.'); }
      else log('dark.js not loaded');
    },
    warp: function () {
      if (NEU.dark) { NEU.dark.warp(); log('at the door.'); }
      else log('nope');
    },
    reset: function () {
      if (NEU.devReset) { NEU.devReset(); log('reset.'); }
      else log('nope');
    },
    close: function () { hide(); }
  };
  CMDS.k = CMDS.key = CMDS.sans;     // aliases, because typing is the cost

  function run(raw) {
    var c = String(raw || '').trim().toLowerCase();
    if (!c) return;
    log('> ' + c);
    if (CMDS[c]) CMDS[c]();
    else log('? try: sans, door, game, food, dog, dark, warp, reset, help');
  }

  function show() {
    panel.hidden = false;
    input.value = '';
    input.focus();
  }
  function hide() { panel.hidden = true; input.blur(); }

  addEventListener('keydown', function (e) {
    /* `e.code` rather than `e.key`: with Ctrl+Shift held, `key` for
       this physical key varies by layout and by browser, but the code
       is always Backquote. */
    if (e.ctrlKey && e.shiftKey && (e.code === 'Backquote' || e.key === '~' || e.key === '`')) {
      e.preventDefault();
      panel.hidden ? show() : hide();
      return;
    }
    if (!panel.hidden && e.key === 'Escape') { e.preventDefault(); hide(); }
  });

  input.addEventListener('keydown', function (e) {
    e.stopPropagation();                       // don't drive the game from in here
    if (e.key === 'Enter') { run(input.value); input.value = ''; }
    else if (e.key === 'Escape') hide();
  });

  var go = document.getElementById('devGo');
  if (go) go.addEventListener('click', function () { run(input.value); input.value = ''; });

  log('dev console. type help.');
  NEU.dev = { show: show, hide: hide, run: run };
})();
