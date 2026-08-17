/* crack.js — the last thing on the page.
   ───────────────────────────────────────────────────────────────────
   Bottom-right corner of the panel inside the cube. Four pixels. It
   does nothing until he sits down, and then it does not announce
   itself either.

   THE THREE-CLICK RULE IS THE WHOLE DESIGN:
     1st — a sound, and nothing else. You are not sure you did that.
     2nd — a worse sound, and it visibly widens. Now you are sure.
     3rd — it opens.

   One click would be a button. A dozen would be a chore. Three is the
   number where a person goes "...did that do something?" and clicks
   again, which is the exact feeling this is for.

   IT IS DISCOVERABLE BECAUSE THE MERCHANT TAUGHT YOU. One lit name in
   a list of junk, hours ago, established that this game points at
   things by making them glow. The crack glows, faintly, once armed.  */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};

  var el = document.getElementById('crack');
  if (!el) { NEU.crack = { arm: function () {} }; return; }

  var armed = false, clicks = 0, opened = false;

  var NOISE = [
    'something behind the panel makes a noise. it is not a good noise.',
    'the crack widens. whatever is behind it has stopped pretending.',
    ''
  ];

  function arm() {
    if (armed) return;
    armed = true;
    el.hidden = false;
    requestAnimationFrame(function () { el.classList.add('is-in'); });
    if (NEU.save) NEU.save.flag('crack_armed', 1);
  }

  function hit() {
    if (!armed || opened) return;
    clicks++;
    if (NEU.save) NEU.save.flag('crack_clicks', clicks);

    /* Each knock is lower and longer than the last. Pitch dropping is
       what makes three identical clicks read as something getting
       closer rather than a button being pressed three times. */
    try {
      var a = new (window.AudioContext || window.webkitAudioContext)();
      var o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(160 - clicks * 38, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(30, 60 - clicks * 14), t + 0.35);
      g.gain.setValueAtTime(0.10 + clicks * 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.connect(g); g.connect(a.destination);
      o.start(t); o.stop(t + 0.5);
    } catch (e) {}

    el.classList.remove('is-hit');
    void el.offsetWidth;
    el.classList.add('is-hit');
    el.setAttribute('data-n', String(clicks));

    if (clicks === 1 && NEU.quest) NEU.quest.mark('a4_crack');
    if (NOISE[clicks - 1] && NEU.talk) NEU.talk([NOISE[clicks - 1]], 'narr');

    if (clicks >= 3) {
      opened = true;
      el.classList.add('is-portal');
      if (NEU.talk) NEU.talk(['it is not a crack. it is a hole, and it is round now.'], 'narr');
      setTimeout(function () {
        if (NEU.polt) NEU.polt.open();
      }, 2400);
    }
  }

  el.addEventListener('click', function (e) { e.stopPropagation(); hit(); });

  /* Restore across a reload — a crack that forgets you have hit it
     twice is a crack you have to hit five times. */
  if (NEU.save && NEU.save.flagged('crack_armed')) {
    arm();
    clicks = (NEU.save.flag('crack_clicks') || 0);
    if (clicks >= 3) { opened = true; el.classList.add('is-portal'); }
  }

  NEU.crack = { arm: arm, hit: hit,
                get armed() { return armed; },
                get clicks() { return clicks; },
                get opened() { return opened; } };
})();
