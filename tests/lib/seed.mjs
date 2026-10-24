/* lib/seed.mjs — deterministic Math.random for jsdom suites.
   ────────────────────────────────────────────────────────────────
   The game draws on Math.random in about ten files: the star field
   (stars.js), the totem's drift (main.js), Tenna's lines and the quiz's
   shots (quiz.js), the boss pattern draws (boss-scal.js, boss-polt.js)
   and the side bullets enter from (bullet.js). A fuzz run on the real
   generator cannot be replayed, so a
   failure found once may never come back. seedRandom() swaps the
   window's Math.random for mulberry32(seed) — for that jsdom window
   only. Node's own Math is untouched, and a second window seeded with
   the same number produces the same stream.

   Call it BEFORE the game scripts are evaluated, or the scripts'
   load-time draws come from the real generator and the run is not
   reproducible. */

/* mulberry32: a 32-bit state, one add and a few xor-shifts per draw.
   Small, fast, and good enough for choosing test inputs. */
export function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Replace window.Math.random with a seeded stream. Returns the stream
   so a suite can draw from it directly if it wants the same numbers
   the page sees. */
export function seedRandom(window, seed) {
  /* A jsdom window built WITHOUT runScripts shares the Node process's
     own Math. Seeding it would reseed the test runner too, and every
     other window that shares it. Refuse rather than do that quietly.
     A window built with runScripts: 'outside-only' has its own realm. */
  if (window.Math === globalThis.Math)
    throw new Error('seedRandom: this window shares Node\'s Math; build it with runScripts: \'outside-only\'');
  const rng = mulberry32(seed);
  window.Math.random = rng;
  return rng;
}
