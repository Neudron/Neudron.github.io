/* fixes31.mjs — directional shake bias (B2) and haptics (K2).
   Run: node fixes31.mjs

   B2. hit(tier, { dx, dy }) records an impact direction, and the shake
   leans along it. A share of each axis's offset comes from the impact
   and the rest from the existing sin waves. It is a mix, not an
   addition, so amplitude never grows past the tier's ceiling, and an
   undirected hit produces exactly the offsets it always did.

   K2. Large and huge hits buzz navigator.vibrate, but only where shake
   is allowed. Reduced motion and the noShake switch silence both.

   The clock is ours. juice.js reads performance.now() for trauma decay
   and for the sin phase, so the suite owns time and every frame is exact. */

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const read = f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
const J = read('core/juice.js');

/* The <noscript> fallback is a <style> that hides most of the page for
   visitors without JS. jsdom parses it as ordinary markup here, so its
   rules would apply to the document. Strip it before the boot. */
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .replace(/<noscript>[\s\S]*?<\/noscript>/gi, '');

/* Canvas size for every begin() call. begin() ends with
   translate(-w/2 + ox, -h/2 + oy), so the ctx stub's last move gives the
   offset back. MAXX / MAXY are juice.js's full-trauma ceilings. */
const W = 200, H = 100;
const MAXX = 14, MAXY = 10;

function boot(reducedMotion = false) {
  const dom = new JSDOM(HTML, { pretendToBeVisual: true, url: 'https://www.neu.ac/',
                                runScripts: 'outside-only' });
  const w = dom.window;
  w.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe() {} disconnect() {} };
  w.matchMedia = q => ({ matches: reducedMotion && /reduce/.test(q),
                         addListener() {}, addEventListener() {} });
  w.requestAnimationFrame = cb => w.setTimeout(() => cb(Date.now()), 0);
  w.scrollTo = () => {};
  let now = 1000;
  w.performance.now = () => now;
  for (const f of ['core/quest.js', 'core/save.js', 'core/juice.js']) {
    w.eval(read(f));
  }
  return { NEU: w.NEU, nav: w.navigator, tick(ms) { now += ms; } };
}

/* Records translate() calls so the frame's offset can be recovered. */
function ctxStub() {
  const c = { moves: [], save() {}, restore() {}, rotate() {} };
  c.translate = (x, y) => { c.moves.push([x, y]); };
  return c;
}

/* One frame: advance the clock, then ask for the camera. Returns the
   {x, y} offset, or null when begin() reports no shake. */
function frame(env, ctx, dtMs = 16) {
  env.tick(dtMs);
  ctx.moves.length = 0;
  if (!env.NEU.juice.begin(ctx, W, H)) return null;
  const last = ctx.moves[ctx.moves.length - 1];
  return { x: last[0] + W / 2, y: last[1] + H / 2 };
}

/* Reads the public bias. Missing reads as NaN so a red run reports
   failures instead of crashing. */
const biasOf = NEU => (NEU.juice && NEU.juice.bias) || { x: NaN, y: NaN };
const isZero = NEU => { const b = biasOf(NEU); return b.x === 0 && b.y === 0; };

/* navigator.vibrate stub. Returns the list of calls it received. */
function vibrateStub(env) {
  const calls = [];
  Object.defineProperty(env.nav, 'vibrate', { configurable: true, writable: true,
    value: ms => { calls.push(ms); return true; } });
  return calls;
}
function noVibrate(env) {
  Object.defineProperty(env.nav, 'vibrate', { configurable: true, writable: true, value: undefined });
}

/* ═══ 1. the direction is stored, normalised and reset ═════════════*/
console.log('\n1. impact direction is stored, normalised and reset');
{
  const env = boot();
  const { NEU } = env;
  NEU.juice.hit('large', { dx: 3, dy: 4 });
  const b = biasOf(NEU);
  ok('hit(large,{dx:3,dy:4}) → bias ≈ {0.6, 0.8}', near(b.x, 0.6) && near(b.y, 0.8));
  ok('the stored direction is unit length', near(Math.hypot(b.x, b.y), 1));

  const ctx = ctxStub();
  frame(env, ctx); frame(env, ctx);
  ok('>>> it persists for the shake: begin() does not clear it <<<',
     near(biasOf(NEU).x, 0.6) && near(biasOf(NEU).y, 0.8));

  NEU.juice.hit('small');
  ok('>>> a following hit without a direction resets it to {0,0} <<<', isZero(NEU));

  NEU.juice.hit('medium', { dx: 0, dy: 0 });
  ok('a zero-length direction is no direction', isZero(NEU));
  NEU.juice.hit('medium', { dx: NaN, dy: 2 });
  ok('a non-finite component is no direction', isZero(NEU));

  NEU.juice.hit('huge', { dx: -2, dy: 0 });
  ok('a pure -x direction normalises to {-1, 0}', near(biasOf(NEU).x, -1) && near(biasOf(NEU).y, 0));

  NEU.juice._reset();
  ok('_reset clears the bias along with the trauma', isZero(NEU));

  /* The getter is read-only: it hands back a copy, not the live state. */
  NEU.juice.hit('large', { dx: 3, dy: 4 });
  const copy = biasOf(NEU); copy.x = 9;
  ok('>>> the getter returns a copy, not the internal state <<<', near(biasOf(NEU).x, 0.6));
  try { NEU.juice.bias = { x: 9, y: 9 }; } catch (e) { /* strict-mode setter-less write */ }
  ok('and assigning to it changes nothing', near(biasOf(NEU).x, 0.6) && near(biasOf(NEU).y, 0.8));
}

/* ═══ 2. undirected hits keep their exact offsets ══════════════════*/
console.log('\n2. no direction, no change to the offsets');
{
  /* First frame after boot: dt is 0, so phase is 0 and trauma is 1.
     Old formula: ox = 14 * sin(0) = 0, oy = 10 * sin(1.1). */
  const env = boot();
  env.NEU.juice.hit('huge');
  const o = frame(env, ctxStub(), 0);
  ok('>>> huge, no direction: x offset is 0 (sin 0) <<<', !!o && near(o.x, 0, 1e-9));
  ok('and y is the old 10 * sin(1.1)', !!o && near(o.y, MAXY * Math.sin(1.1), 1e-9));

  /* Second frame, 16ms on: phase 0.544, trauma 1 - 1.5 * 0.016. */
  const dt = 0.016, tr = 1 - 1.5 * dt, s = tr * tr;
  const o2 = frame(env, ctxStub(), 16);
  ok('>>> a later undirected frame matches the old formula <<<',
     !!o2 && near(o2.x, MAXX * s * Math.sin(34 * dt), 1e-9) &&
             near(o2.y, MAXY * s * Math.sin(34 * dt * 1.37 + 1.1), 1e-9));
}

/* ═══ 3. the lean: exact golden offsets for a directed hit ═════════*/
console.log('\n3. directed hit: the lean mixes into each axis');
{
  /* Toward +x. Mix is 0.6 * wave + 0.4 * bias.x, times the old ceiling. */
  const a = boot();
  a.NEU.juice.hit('huge', { dx: 1, dy: 0 });
  const o = frame(a, ctxStub(), 0);
  ok('>>> huge toward +x: x is 14 * 0.4 = 5.6 (the lean alone, sin 0) <<<',
     !!o && near(o.x, MAXX * 0.4, 1e-9));
  ok('and y is 0.6 of the old wave: 6 * sin(1.1)',
     !!o && near(o.y, 0.6 * MAXY * Math.sin(1.1), 1e-9));

  /* Toward -y. x keeps its old wave (sin 0 here) and y leans down. */
  const c = boot();
  c.NEU.juice.hit('huge', { dx: 0, dy: -1 });
  const p = frame(c, ctxStub(), 0);
  ok('toward -y: y = 10 * (0.6 * sin 1.1 - 0.4)',
     !!p && near(p.y, MAXY * (0.6 * Math.sin(1.1) - 0.4), 1e-9));
  ok('and x is untouched by a pure -y lean', !!p && near(p.x, 0, 1e-9));
}

/* ═══ 4. noShake: no shake, no buzz ════════════════════════════════*/
console.log('\n4. noShake silences the shake and the buzz');
{
  const env = boot();
  const buzz = vibrateStub(env);
  env.NEU.juice.setNoShake(true);
  ok('the switch reads back', env.NEU.juice.noShake === true);
  env.NEU.juice.hit('huge', { dx: 1, dy: 0 });
  ok('>>> begin() reports no shake <<<', frame(env, ctxStub()) === null);
  ok('>>> huge with noShake: no vibrate <<<', buzz.length === 0);
  env.NEU.juice.hit('large');
  ok('large with noShake: no vibrate either', buzz.length === 0);
  ok('and no trauma was added', env.NEU.juice.trauma === 0);
  env.NEU.juice.setNoShake(false);
  env.NEU.juice.hit('large');
  ok('turned back on, large buzzes again', buzz.length === 1 && buzz[0] === 18);
}

/* ═══ 5. haptics: large 18ms, huge 30ms, nothing else ══════════════*/
console.log('\n5. haptics');
{
  const env = boot();
  const buzz = vibrateStub(env);
  const { NEU } = env;
  const pulse = (tier, opts) => { buzz.length = 0; NEU.juice.hit(tier, opts); return buzz.slice(); };
  const huge = pulse('huge'), large = pulse('large');
  ok('>>> huge buzzes once, for 30ms <<<', huge.length === 1 && huge[0] === 30);
  ok('>>> large buzzes once, for 18ms <<<', large.length === 1 && large[0] === 18);
  ok('medium does not buzz', pulse('medium').length === 0);
  ok('small does not buzz', pulse('small').length === 0);
  ok('tick does not buzz', pulse('tick').length === 0);
  const dl = pulse('large', { dx: 1, dy: 0 });
  ok('a directed large buzzes too, once, for 18ms', dl.length === 1 && dl[0] === 18);
  ok('the buzz is guarded by typeof navigator.vibrate',
     /typeof navigator\.vibrate === 'function'/.test(J));

  const bare = boot();
  noVibrate(bare);
  let threw = false;
  try { bare.NEU.juice.hit('huge'); bare.NEU.juice.hit('large'); } catch (e) { threw = true; }
  ok('>>> with no navigator.vibrate, large and huge do not throw <<<', !threw);
  ok('and the shake still lands without it', bare.NEU.juice.trauma > 0);

  const angry = boot();
  Object.defineProperty(angry.nav, 'vibrate', { configurable: true, writable: true,
    value: () => { throw new Error('blocked by policy'); } });
  let threw2 = false;
  try { angry.NEU.juice.hit('huge'); } catch (e) { threw2 = true; }
  ok('>>> a vibrate that throws is swallowed <<<', !threw2);
  ok('and the shake still lands', angry.NEU.juice.trauma === 1);
}

/* ═══ 6. reduced motion: nothing moves, nothing buzzes ═════════════*/
console.log('\n6. prefers-reduced-motion');
{
  const env = boot(true);
  const buzz = vibrateStub(env);
  env.NEU.juice.hit('huge', { dx: 1, dy: 0 });
  ok('>>> no trauma under reduced motion <<<', env.NEU.juice.trauma === 0);
  ok('and begin() reports no shake', frame(env, ctxStub()) === null);
  ok('>>> and no buzz either <<<', buzz.length === 0);
}

/* ═══ 7. the lean is real, and the tier's ceiling holds ════════════*/
console.log('\n7. the lean moves the mean; amplitude stays under the tier');
{
  const env = boot();
  const ctx = ctxStub();
  /* Mean x offset over n frames, re-hitting each frame so trauma stays
     at 1. Over 60 frames the sin terms average to near zero, so what is
     left is the lean. */
  const meanX = (opts, n = 60) => {
    let sum = 0, got = 0;
    for (let k = 0; k < n; k++) {
      env.NEU.juice.hit('huge', opts);
      const o = frame(env, ctx);
      if (o) { sum += o.x; got++; }
    }
    return got ? sum / got : NaN;
  };
  const plus = meanX({ dx: 1, dy: 0 });
  const none = meanX(null);
  const minus = meanX({ dx: -1, dy: 0 });
  /* The lean alone is about 14 * 0.4 = 5.6 px; the undirected mean sits
     near zero. A threshold of 1 px rules out a chance-positive wave. */
  ok('>>> leaning +x: the mean x offset is well positive (> 1 px) <<<', plus > 1);
  ok('and it sits above the undirected mean', plus > none);
  ok('leaning -x: the mean x offset is well negative (< -1 px)', minus < -1);

  /* Every tier, directed toward (1,1). The ceiling is the old full
     amplitude scaled by the tier's trauma, squared. */
  let peakX = 0, within = true;
  for (const tier of ['small', 'medium', 'large', 'huge']) {
    env.NEU.juice._reset();
    env.NEU.juice.hit(tier, { dx: 1, dy: 1 });
    const cap = env.NEU.juice.tiers[tier].shake;
    for (let k = 0; k < 40; k++) {
      const o = frame(env, ctx);
      if (!o) continue;
      if (Math.abs(o.x) > MAXX * cap * cap + 1e-9) within = false;
      if (Math.abs(o.y) > MAXY * cap * cap + 1e-9) within = false;
      if (tier === 'huge') peakX = Math.max(peakX, Math.abs(o.x));
    }
  }
  ok('>>> no directed frame exceeds its tier\'s max shake <<<', within);
  ok('and the huge lean actually moves the camera (not a vacuous pass)', peakX > 1);
}

/* ═══ 8. the source keeps its shape ════════════════════════════════*/
console.log('\n8. source shape');
{
  /* Three wave terms, sampled not random, and no new sin terms. */
  ok('still exactly three sampled wave terms',
     (J.match(/Math\.sin\(phase \* [\d.]+/g) || []).length === 3);
  const code = J.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok('>>> ES5 only in juice.js (no arrows, let, const, templates) <<<',
     !/=>|\blet\s|\bconst\s|`/.test(code));
  /* The one caller that leans: a bullet hitting the soul pushes the
     screen the way the bullet was going. */
  ok('bullet.js\'s soul hit passes the bullet\'s velocity as the direction',
     /hit\('medium', \{ dx: b\.vx, dy: b\.vy \}\)/.test(read('game/bullet.js')));
}

console.log('');
console.log(fail ? `${fail} FAILED, ${pass} passed` : `ALL PASS (${pass})`);
process.exit(fail ? 1 : 0);
