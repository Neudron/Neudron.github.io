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

  var armed = false, clicks = 0, opened = false, transitioning = false, timer = null, actx = null;
  var hintEl = null;

  var NOISE = [
    'something behind the panel makes a noise. it is not a good noise.',
    'the crack widens. whatever is behind it has stopped pretending.',
    ''
  ];

  function showHint() {
    if (hintEl) return;
    if (NEU.quest && NEU.quest.has('a4_crack')) return;
    hintEl = document.createElement('div');
    hintEl.className = 'crack-hint';
    hintEl.textContent = 'something cracked inside the cube';
    document.body.appendChild(hintEl);
  }

  function hideHint() {
    if (!hintEl) return;
    if (hintEl.parentNode) hintEl.parentNode.removeChild(hintEl);
    hintEl = null;
  }

  function reducedMotion() {
    try {
      if (NEU.motion && NEU.motion.reduced) return NEU.motion.reduced();
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  function enterDungeon() {
    if (NEU.plat && NEU.plat.open) NEU.plat.open('d0');
  }

  function transitionToDungeon() {
    var panel = document.getElementById('panel'), flash, rect, crackRect, oldTransition, oldTransform;
    transitioning = true;
    if (panel) {
      oldTransition = panel.style.transition;
      oldTransform = panel.style.transform;
      panel.style.transition = 'transform 900ms cubic-bezier(.18,.72,.16,1), opacity 900ms ease';
      if (reducedMotion()) {
        panel.style.opacity = '0.08';
      } else {
        rect = panel.getBoundingClientRect();
        crackRect = el.getBoundingClientRect();
        panel.style.transformOrigin = (crackRect.left + crackRect.width / 2 - rect.left) + 'px ' +
          (crackRect.top + crackRect.height / 2 - rect.top) + 'px';
        panel.style.transform = 'scale(0.06)';
        flash = document.createElement('div');
        flash.setAttribute('aria-hidden', 'true');
        flash.style.cssText = 'position:fixed;inset:0;z-index:99;pointer-events:none;background:#D9203F;opacity:.55;transition:opacity 180ms ease';
        document.body.appendChild(flash);
        window.setTimeout(function () {
          flash.style.opacity = '0';
          window.setTimeout(function () { if (flash.parentNode) flash.parentNode.removeChild(flash); }, 200);
        }, 20);
      }
      void panel.offsetWidth;
    }
    timer = window.setTimeout(function () {
      if (panel) {
        panel.style.transition = oldTransition || '';
        panel.style.transform = oldTransform || '';
        panel.style.transformOrigin = '';
        panel.style.opacity = '';
      }
      transitioning = false;
      timer = null;
      enterDungeon();
    }, 900);
  }

  function arm() {
    if (armed) return;
    armed = true;
    el.hidden = false;
    requestAnimationFrame(function () { el.classList.add('is-in'); });
    if (NEU.save) NEU.save.flag('crack_armed', 1);
    showHint();
  }

  function hit() {
    if (!armed) return;
    /* The portal stays open across visits and reloads. */
    if (opened) {
      if (!transitioning) enterDungeon();
      return;
    }
    clicks++;
    if (NEU.save) NEU.save.flag('crack_clicks', clicks);

    /* Each knock is lower and longer than the last. Pitch dropping is
       what makes three identical clicks read as something getting
       closer rather than a button being pressed three times. */
    if (!(NEU.settings && NEU.settings.muted)) try {      /* the Sound switch */
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      var a = actx;
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
    hideHint();
    if (NOISE[clicks - 1] && NEU.talk) NEU.talk([NOISE[clicks - 1]], 'narr');

    if (clicks >= 3) {
      opened = true;
      if (NEU.save) NEU.save.flag('crack_portal', 1);
      el.classList.add('is-portal');
      if (NEU.talk) NEU.talk(['it is not a crack. it is a hole, and it is round now.'], 'narr');
      transitionToDungeon();
    }
  }

  /* Keep the portal available even when other scenes return control. */
  function reset() {
    if (opened) return;
    if (!armed) return;
    clicks = 0;
    el.setAttribute('data-n', '0');
    if (timer) { window.clearTimeout(timer); timer = null; transitioning = false; }
    if (NEU.save) NEU.save.flag('crack_clicks', 0);
  }

  el.addEventListener('click', function (e) { e.stopPropagation(); hit(); });

  /* Restore across a reload — a crack that forgets you have hit it
     twice is a crack you have to hit five times. */
  if (NEU.save && NEU.save.flagged('crack_armed')) {
    arm();
    clicks = (NEU.save.flag('crack_clicks') || 0);
    if (clicks >= 3 || NEU.save.flagged('crack_portal')) {
      clicks = Math.max(3, clicks);
      opened = true;
      el.classList.add('is-portal');
      el.setAttribute('data-n', String(clicks));
      if (!NEU.save.flagged('crack_portal')) NEU.save.flag('crack_portal', 1);
    }
  }

  NEU.crack = { arm: arm, hit: hit, reset: reset,
                get armed() { return armed; },
                get clicks() { return clicks; },
                get opened() { return opened; } };
})();
