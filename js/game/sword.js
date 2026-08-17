/* sword.js — how the sword looks, turns, and eventually snaps.
   ───────────────────────────────────────────────────────────────────
   Pixel art, not a 3D mesh. This started as a small three.js scene and
   was replaced: a shaded 3D blade on a page built entirely from 16px
   bitmap type read as a foreign object, and it meant a second WebGL
   renderer for one 90px prop.

   Division of labour: this file owns appearance and rotation, sans.js
   owns position and meaning. Two transforms on two different elements
   — the wrapper is moved by sans.js, the img is rotated here. On one
   element they would overwrite each other every frame.

   ── why the swing is built the way it is ──────────────────────────
   The first version was a single 420ms rotation from -24 to -174 and
   it did not read as a swing at all. Two reasons, both fixable:

   1. NO ANTICIPATION. A strike is legible because of what happens
      BEFORE it. The eye needs to see the sword drawn back and slowed
      almost to a stop; that pause is what tells you a blow is coming,
      and it is what makes the strike itself feel fast even though it
      is only 140ms. Going straight to the blow means there is nothing
      to be fast relative to.
   2. NO FOLLOW-THROUGH. Stopping dead at the end of the arc reads as
      a bug. Real motion overshoots, recoils, and settles.

   So it is now five phases over 1250ms, roughly 3x longer, and almost
   all of the added time is the wind-up and the recovery — the strike
   itself got FASTER, not slower. That is the trick: slow the frame,
   speed the action.

   The impact callback fires at the strike's end (660ms), not when the
   animation finishes, so the totem and the sound land on the blow
   rather than a half-second after it.                                */

(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};
  var el   = document.getElementById('sword');
  var art  = document.getElementById('swordArt');
  var half = document.getElementById('swordBlade');   // the half that flies off
  var key  = document.getElementById('swordKey');     // the half you keep

  if (!el || !art) {
    NEU.sword = { ok: false, setScreenPos: function () {}, setPose: function () {},
                  swing: function (a, b) { setTimeout(a || function () {}, 200);
                                           setTimeout(b || function () {}, 400); },
                  breakApart: function (cb) { setTimeout(cb, 400); },
                  show: function () {}, hide: function () {} };
    return;
  }

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── the trail ────────────────────────────────────────────────────
     Six lagged copies of the sprite rather than a drawn arc. A canvas
     streak would need its own buffer and a clear every frame; these
     are the same 6KB svg the browser has already decoded, so they cost
     a transform each. Built here rather than in the markup because
     they are pure decoration and shouldn't be in the document for
     anyone reading it with scripts off. */
  var GH = 6, LAG = 2, HIST = GH * LAG + 2;
  var hist = new Array(HIST), hp = 0, ghosts = [];
  for (var i = 0; i < HIST; i++) hist[i] = { r: 0, y: 0 };
  if (!reduced) {
    for (var g = 0; g < GH; g++) {
      var c = document.createElement('img');
      c.src = art.getAttribute('src');
      c.className = 'sword__ghost';
      c.alt = ''; c.setAttribute('aria-hidden', 'true'); c.draggable = false;
      el.insertBefore(c, art);
      ghosts.push(c);
    }
  }

  var POSE = {
    hidden: { rot:   0, spin:   0, bob: 0 },
    spawn:  { rot: -22, spin:   0, bob: 0 },   // cocked back in his hand
    stuck:  { rot:  14, spin:   0, bob: 5 },
    held:   { rot: -24, spin:   0, bob: 1 },
    fly:    { rot:   0, spin: 430, bob: 0 }
  };

  /* Materialise: 260ms scale-in with a slight overshoot. Ease-OUT,
     because this is an element entering — entering is ease-out,
     leaving is ease-in, and getting that backwards is most of why a
     spawn feels wrong. Scale and opacity only, so nothing reflows. */
  var spawnT = 0, SPAWN_IN = 260;
  function spawnScale(now) {
    if (!spawnT) return 1;
    var k = (now - spawnT) / SPAWN_IN;
    if (k >= 1) { spawnT = 0; return 1; }
    var e = 1 - Math.pow(1 - k, 3);
    return 0.35 + e * 0.75 - Math.max(0, (e - 0.82)) * 0.55;   // 0.35 -> 1.10 -> 1
  }

  var pose = POSE.hidden, rot = 0, spun = 0, boost = 1;
  var t0 = performance.now(), last = t0;
  var sw = 0, onImpact = null, onDone = null, struck = false, whooshed = false;

  /* phase boundaries, ms */
  var P_WIND = 420, P_HOLD = 520, P_HIT = 660, P_OVER = 700, P_SET = 780, P_END = 1250;
  var A_REST = -24, A_BACK = 46, A_THRU = -152, A_OVERSHOOT = -168, A_SETTLE = -144;

  var ease = {
    out:  function (k) { return 1 - Math.pow(1 - k, 3); },
    in:   function (k) { return k * k * k; },
    outQ: function (k) { return 1 - Math.pow(1 - k, 2); }
  };
  function lerp(a, b, k) { return a + (b - a) * k; }

  function swingAt(ms) {
    /* returns { r, y, s, trail } */
    if (ms < P_WIND) {                                   // draw back, decelerating
      var k = ease.out(ms / P_WIND);
      return { r: lerp(A_REST, A_BACK, k), y: lerp(0, -7, k), s: lerp(1, 1.06, k), trail: 0 };
    }
    if (ms < P_HOLD) {                                   // the beat
      return { r: A_BACK, y: -7, s: 1.06, trail: 0 };
    }
    if (ms < P_HIT) {                                    // the blow
      var k2 = ease.in((ms - P_HOLD) / (P_HIT - P_HOLD));
      return { r: lerp(A_BACK, A_THRU, k2), y: lerp(-7, 16, k2), s: lerp(1.06, 1, k2), trail: 1 };
    }
    if (ms < P_OVER) {                                   // overshoot
      var k3 = (ms - P_HIT) / (P_OVER - P_HIT);
      return { r: lerp(A_THRU, A_OVERSHOOT, k3), y: 16, s: lerp(1, 0.94, k3), trail: 1 };
    }
    if (ms < P_SET) {                                    // recoil
      var k4 = ease.outQ((ms - P_OVER) / (P_SET - P_OVER));
      return { r: lerp(A_OVERSHOOT, A_SETTLE, k4), y: 16, s: lerp(0.94, 1, k4), trail: 0.5 };
    }
    var k5 = ease.out((ms - P_SET) / (P_END - P_SET));   // back to guard, slowly
    return { r: lerp(A_SETTLE, A_REST, k5), y: lerp(16, 0, k5), s: 1, trail: 0 };
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (el.hidden) return;

    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var r, y, s = 1, trail = 0;

    if (sw) {
      var ms = now - sw;
      var v = swingAt(ms);
      r = v.r; y = v.y; s = v.s; trail = v.trail;

      if (!whooshed && ms >= P_HOLD) { whooshed = true; if (NEU.sfx && NEU.sfx.whoosh) NEU.sfx.whoosh(); }
      if (!struck  && ms >= P_HIT)   { struck = true; var f = onImpact; onImpact = null; f && f(); }
      if (ms >= P_END) { sw = 0; var d = onDone; onDone = null; d && d(); }
    } else {
      spun += pose.spin * dt;
      rot  += (pose.rot - rot) * 0.12;
      r = rot + spun;
      y = reduced ? 0 : Math.sin((now - t0) / 1000 * 1.7) * pose.bob;
    }

    var ss = spawnScale(now);
    if (spawnT) art.style.opacity = Math.min(1, (now - spawnT) / 120).toFixed(2);
    art.style.transform = 'translateY(' + y.toFixed(2) + 'px) rotate(' + r.toFixed(2) +
                          'deg) scale(' + (s * ss * boost).toFixed(3) + ')';

    hist[hp] = { r: r, y: y }; hp = (hp + 1) % HIST;
    for (var i = 0; i < ghosts.length; i++) {
      var h = hist[(hp - 1 - (i + 1) * LAG + HIST * 2) % HIST];
      var o = trail * (1 - (i + 1) / (GH + 1)) * 0.55;
      ghosts[i].style.opacity = o.toFixed(3);
      if (o > 0.004) {
        ghosts[i].style.transform =
          'translateY(' + h.y.toFixed(2) + 'px) rotate(' + h.r.toFixed(2) + 'deg)';
      }
    }
  }
  requestAnimationFrame(frame);

  NEU.sword = {
    ok: true,
    setScreenPos: function (x, y) {
      el.style.transform = 'translate3d(' + (x | 0) + 'px,' + (y | 0) + 'px,0) translate(-50%,-50%)';
    },
    /* An extra scale channel on top of pose and spawn, so the reveal
       can present the sword large and shrink it back to travel size as
       it launches, without either of those two fighting for the same
       property. */
    setBoost: function (s) { boost = s; },
    setPose: function (name) {
      pose = POSE[name] || POSE.hidden;
      if (name !== 'fly') spun = 0;
    },
    /* onImpact fires on the blow; onDone when the follow-through has
       finished. Two callbacks, because the interesting thing happens
       in the middle of this animation, not at the end of it. */
    swing: function (impact, doneCb) {
      if (reduced) { setTimeout(impact, 100); setTimeout(doneCb, 240); return; }
      sw = performance.now(); struck = false; whooshed = false;
      onImpact = impact; onDone = doneCb;
    },
    /* The snap. Both halves are already in the markup so there is no
       decode hitch at the exact moment you want the timing tight. */
    breakApart: function (cb) {
      sw = 0;
      art.style.opacity = '0';
      for (var i = 0; i < ghosts.length; i++) ghosts[i].style.opacity = '0';
      if (half && key) {
        half.hidden = false; key.hidden = false;
        void half.offsetWidth;
        half.classList.add('is-go'); key.classList.add('is-go');
      }
      setTimeout(function () {
        if (half && key) {
          half.hidden = true; key.hidden = true;
          half.classList.remove('is-go'); key.classList.remove('is-go');
        }
        art.style.opacity = '';
        cb && cb();
      }, reduced ? 300 : 1500);
    },
    show: function () { el.hidden = false; },
    /* Called the instant it appears in his hand, so it grows out of
       nothing instead of blinking into existence at full size. */
    materialise: function () {
      if (reduced) { art.style.opacity = '1'; return; }
      spawnT = performance.now(); art.style.opacity = '0';
    },
    hide: function () { el.hidden = true; }
  };
})();
