/* core/rand.js — seeded RNG for gameplay randomness.
   The xorshift32 implementation used to live privately in
   act4/scal-attacks.js; it is the only seeded stream in the game, so
   every module that needs reproducible randomness routes through here.
   Cosmetic randomness (star shimmer, etc.) stays on Math.random. */
(function (NEU) {
  'use strict';
  var current = Math.random;
  function seeded(s) {
    var x = (s >>> 0) || 1;
    return function () { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
  }
  function rng() { return current(); }
  function setRng(fn) { current = fn || Math.random; }
  function rnd(a, b) { return a + current() * (b - a); }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = (current() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  NEU.rand = { seeded: seeded, rng: rng, setRng: setRng, rnd: rnd, shuffle: shuffle };
})(window.NEU = window.NEU || {});