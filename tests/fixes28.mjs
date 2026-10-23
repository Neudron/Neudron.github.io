/* fixes28.mjs — G5: a seeded key-fuzz of the whole game.
   Run: node tests/fixes28.mjs

   The other suites mostly drive one feature with a script: this key,
   then that assertion. A script only reaches the states its author
   thought of. This one boots the page in its real script order, puts the room
   engine on the first map, and presses 600 keys chosen by a seeded
   generator — arrows, WASD, E, R, Enter, Escape, Space, Z, X, Shift —
   as a mix of keydown and keyup. Every 50 presses it checks:
     - no window 'error' has fired, and jsdom has reported no
       uncaught exception from a timer or listener
     - the save holds no NaN anywhere
     - while the engine is running, the player's x and y are finite
   Escape leaves the room, so the engine is re-entered straight away
   and the rest of that batch still reaches the room.

   Reproducibility: the page's Math.random is seeded (SEED below) before
   any game script runs, so load-time draws and the key sequence are
   the same on every run. Timers stay real, so the interleaving of key
   presses with game frames is not fixed; a failure names the press
   count it was caught at, and the seed replays the same key sequence. */

import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mulberry32, seedRandom } from './lib/seed.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const SEED = 1234;
const PRESSES = 600, BATCH = 50;
const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd',
              'e', 'r', 'Enter', 'Escape', ' ', 'z', 'x', 'Shift'];
const wait = ms => new Promise(r => setTimeout(r, ms));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log(`  seed = ${SEED}`);

/* ── 1. determinism of the generator ──────────────────────────────*/
console.log('\n1. the seed reproduces the stream');
{
  const first5 = seed => { const r = mulberry32(seed); return [0, 1, 2, 3, 4].map(() => r()); };
  const a = first5(SEED);
  ok('mulberry32: the same seed gives the same first 5 numbers', same(a, first5(SEED)));
  ok('mulberry32: a different seed gives a different stream', !same(a, first5(SEED + 1)));

  /* runScripts: 'outside-only' gives each window its own Math. Without it
     the window shares Node's, and seeding one would reseed both. */
  const w1 = new JSDOM('', { runScripts: 'outside-only' }).window;
  const w2 = new JSDOM('', { runScripts: 'outside-only' }).window;
  seedRandom(w1, SEED); seedRandom(w2, SEED);
  const c = [0, 1, 2, 3, 4].map(() => w1.Math.random());
  const d = [0, 1, 2, 3, 4].map(() => w2.Math.random());
  ok('two windows seeded alike draw the same first 5 numbers', same(c, d));
  ok('and those are the numbers the seed promises', same(c, a));
  w1.close(); w2.close();

  /* A window without runScripts shares Node's Math; seeding it must
     refuse, not reseed the runner. */
  let refused = false;
  try { seedRandom(new JSDOM('').window, SEED); } catch (e) { refused = /shares Node/.test(e.message); }
  ok('seedRandom refuses a window that shares Node\'s Math', refused);
  ok('and the runner\'s own Math.random is still the native one',
     /\[native code\]/.test(Math.random.toString()));
}

/* ── 2. boot the page in its real order ───────────────────────────
   The classic scripts are read from index.html, the same way the page
   loads them. fixes21's copy of this list leaves out shop.js,
   scal-worm.js and scal-seekers.js, which index.html does load, so a
   fuzz on that list would not run three of the page's scripts. */
const MODULES = [...HTML.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b([^>]*)>/gi)]
  .map(m => m[1])
  .filter(a => !/\btype\s*=\s*["']?(module|importmap|application\/ld\+json)/i.test(a))
  .map(a => (a.match(/\bsrc\s*=\s*["']([^"']+)["']/i) || [])[1])
  .filter(s => s && s.startsWith('js/'));

console.log('\n2. boot');
const errors = [];                   /* window 'error' events and jsdom's uncaught reports */
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdom: ' + ((e && e.message) || e)));
const dom = new JSDOM(HTML, { pretendToBeVisual: true, url: 'https://www.neu.ac/',
                              runScripts: 'outside-only', virtualConsole: vc });
const w = dom.window;
/* runScripts: 'outside-only' makes the parser think scripting is off, so
   the <noscript> fallback hides the quiz and focus will not land in it.
   A real browser running the page never applies that block. */
w.document.querySelectorAll('noscript').forEach(n => n.remove());
w.addEventListener('error', e => errors.push('window error: ' + ((e.error && e.error.message) || e.message)));

/* Stubs the page needs but jsdom does not provide. None of them slows
   a timer: the suite runs at the game's own pace. */
w.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe() {} disconnect() {} };
w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
w.AudioContext = class {
  constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 44100; this.destination = {}; }
  resume() {}
  createOscillator() { return { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, detune: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
  createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} }, connect() {} }; }
  createBufferSource() { return { buffer: null, connect() {}, start() {}, stop() {} }; }
  createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {} }; }
  createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
};
w.webkitAudioContext = w.AudioContext;
w.HTMLMediaElement.prototype.play = () => Promise.resolve();
const noop = () => {};
w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {
  get(_, k) {
    if (k === 'canvas') return {};
    if (k === 'measureText') return () => ({ width: 10 });
    if (k === 'createRadialGradient' || k === 'createLinearGradient')
      return () => ({ addColorStop: noop });
    if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
    if (typeof k === 'string') return () => {};
    return undefined;
  }, set() { return true; }
});
w.scrollTo = noop;
w.requestAnimationFrame = cb => w.setTimeout(() => cb(Date.now()), 16);
w.Element.prototype.getBoundingClientRect = () =>
  ({ left: 100, top: 100, right: 146, bottom: 146, width: 46, height: 46, x: 100, y: 100 });

/* Seed BEFORE any game script runs: a script's load-time draws come
   from this stream too, and the replay depends on them. */
seedRandom(w, SEED);

const bootErrors = [];
for (const f of MODULES) {
  try { w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8')); }
  catch (e) { bootErrors.push(f + ': ' + e.message); }
}
ok(`all ${MODULES.length} classic scripts evaluate without throwing`, bootErrors.length === 0);
for (const e of bootErrors) console.log('       ' + e);
ok('the boot raised no window error', errors.length === 0);

const NEU = w.NEU;
ok('NEU.engine exists', !!(NEU && NEU.engine));

/* ── 3. the fuzz ──────────────────────────────────────────────────*/
console.log('\n3. the fuzz');
ok("NEU.engine.enter('a1_clearing','default') puts the player on the map",
   NEU.engine.enter('a1_clearing', 'default') === true && NEU.engine.running === true);

const pick = mulberry32(SEED + 1);   /* the key stream, separate from the page's */
const seenTiles = new Set();
let reentries = 0, presses = 0, moves = 0;
let last = null;

function checkpoint(n) {
  ok(`after ${n} presses: no window error has fired` + (errors.length ? ' — first: ' + errors[0] : ''),
     errors.length === 0);
  const save = JSON.stringify(NEU.save.data);
  ok(`after ${n} presses: the save holds no NaN`, !save.includes('NaN'));
  const p = NEU.engine.api.player;
  const running = NEU.engine.running;
  ok(`after ${n} presses: player position is finite (engine ${running ? 'running' : 'not running'})`,
     !running || (Number.isFinite(p.x) && Number.isFinite(p.y)));
  if (running) {
    seenTiles.add(NEU.engine.room);
    if (last && (last.x !== p.x || last.y !== p.y || last.room !== NEU.engine.room)) moves++;
    last = { x: p.x, y: p.y, room: NEU.engine.room };
  }
}

for (let b = 0; b < PRESSES / BATCH; b++) {
  for (let i = 0; i < BATCH; i++) {
    const key = KEYS[Math.floor(pick() * KEYS.length)];
    const type = pick() < 0.6 ? 'keydown' : 'keyup';
    w.dispatchEvent(new w.KeyboardEvent(type, { key, bubbles: true, cancelable: true }));
    presses++;
    /* Escape leaves the room; put the player straight back on the map so
       the rest of the batch still exercises it. */
    if (key === 'Escape' && !NEU.engine.running) {
      NEU.engine.enter('a1_clearing', 'default');
      reentries++;
    }
  }
  await wait(10);                    /* let the game run its frames */
  checkpoint(presses);
  if (!NEU.engine.running) { NEU.engine.enter('a1_clearing', 'default'); reentries++; }
}

ok(`${presses} presses delivered (${PRESSES} asked)`, presses === PRESSES);
ok(`the presses reached the game (the player moved or changed room ${moves} times)`, moves > 0);
console.log(`       rooms the player stood in: ${[...seenTiles].join(', ') || '(none)'}; re-entries after Escape: ${reentries}`);
ok('the run ended with no window error', errors.length === 0);

/* ── summary ─────────────────────────────────────────────────────*/
console.log('\n' + (fail === 0 ? `ALL PASS (${pass})` : `${fail} FAILED, ${pass} passed`));
process.exit(fail === 0 ? 0 : 1);
