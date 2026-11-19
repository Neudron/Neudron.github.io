/* boss.js — the one surface a fight uses to read the chosen tier.
   Health and phase stay where they already live (kit.js for Draedon/Exo,
   the fight module for its own bar). This shell only owns the per-fight
   latch and the scaling of the shared knobs, so a tier cannot be half read. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var cur = null;

  function mul(k) { return NEU.diff && NEU.diff.f ? NEU.diff.f(k) : 1; }
  function pick(a, fallback) { return NEU.diff && NEU.diff.fpick ? NEU.diff.fpick(a) : fallback; }

  var B = {
    /* one latch per open: NEU.diff owns the tier, this only says which
       fight is reading it and when the read ends. */
    open: function (name) {
      if (NEU.diff && NEU.diff.begin) NEU.diff.begin();
      cur = name || 'fight';
      return cur;
    },
    close: function (name) { if (!name || name === cur) cur = null; },
    /* raw multiplier for the attacks module (its own speed/tele/gap maths) */
    mul: mul,
    /* outgoing player damage; incoming i-frames; boss and player life */
    hit: function (n) { return n * mul('dmg'); },
    iframes: function (s) { return s * mul('iframes'); },
    hp: function (base) { return Math.max(1, Math.round(base * mul('bossHp'))); },
    playerHp: function (base) { return pick([12, 9, 6, 5, 4, 3, 1], base); },
    /* timing and density */
    gap: function (f) { return f * mul('gap'); },
    tele: function (f) { return f * mul('tele'); },
    speed: function (v) { return v * mul('bulletSpeed'); },
    /* kit.js keeps the heal authority; it reads these at fight open */
    healCd: function (s) { return s * mul('healCd'); },
    heals: function () { return mul('heals') > 0; },
    get active() { return cur; },
    get tier() { return NEU.diff && NEU.diff.fid ? NEU.diff.fid() : 'medium'; }
  };
  NEU.boss = B;
})();
