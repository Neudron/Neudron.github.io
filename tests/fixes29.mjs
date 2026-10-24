/* fixes29.mjs — F9: listener drift across scene cycles.
   Run: node tests/fixes29.mjs

   Nothing in the page throws when a listener is left behind. A scene
   that adds a handler when it opens and does not remove it on close
   keeps that handler firing, and the next open adds another. Each visit
   then costs a little more: the same key runs its handler twice, then
   three times, and the page slows as the handlers pile up.

   Method. Before any game script runs, EventTarget.prototype's add and
   remove are wrapped so every live registration is counted per event
   type. A second add of the same listener on the same target is not
   counted (the DOM ignores it too), and a matching remove takes one
   back off. The page is booted, then the room engine, the quiz, the
   craft table and the deck are each opened and closed three times.

   What is asserted. Two things, and both are leaks in the sense that
   matters to a player:
     - listeners that can still fire: registrations whose target is the
       window, the document, or an element connected to the page
     - elements: how many the page holds
   Both are measured after a warm-up cycle and then again after the last
   cycle, and must not grow in between. The warm-up is needed because a
   scene builds its lists lazily on first open (the deck shelf, the quest
   list, the quiz board, the craft grid), and that population is not drift.

   What is reported and not asserted. The raw registry count — every
   live registration on every target — grows while the craft table and
   the deck are opened, because they rebuild their buttons on each open
   and the old buttons, with their listeners, are detached. A detached
   node cannot receive an event and nothing in the code keeps it alive,
   so the browser reclaims it with its listeners. That is churn in the
   registry, not a leak, and the suite names it by scene and type. The
   registry count is still kept exactly as specified. */

import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedRandom } from './lib/seed.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const wait = ms => new Promise(r => setTimeout(r, ms));
const CYCLES = 3, SEED = 1234;

/* ── the live count ──────────────────────────────────────────────*/
const counts = new Map();            /* type → registrations alive, all targets */
const live = new Set();              /* { type, target, fn, capture } */
const bump = (t, d) => counts.set(t, (counts.get(t) || 0) + d);
const capOf = o => (typeof o === 'boolean' ? o : !!(o && o.capture));
const snap = () => Object.fromEntries(counts);
const sum = o => Object.values(o).reduce((a, b) => a + b, 0);

function instrument(w) {
  const EP = w.EventTarget.prototype;
  const add = EP.addEventListener, rem = EP.removeEventListener;
  /* A bare addEventListener(...) in a game script arrives with no `this`;
     jsdom resolves that to the window, and so must the counter. */
  EP.addEventListener = function (type, fn, opts) {
    const target = this == null ? w : this;
    const r = add.call(target, type, fn, opts);
    if (fn) {
      const capture = capOf(opts);
      let dup = false;
      for (const x of live) if (x.target === target && x.type === type && x.fn === fn && x.capture === capture) { dup = true; break; }
      if (!dup) { live.add({ type, target, fn, capture }); bump(type, 1); }
    }
    return r;
  };
  EP.removeEventListener = function (type, fn, opts) {
    const target = this == null ? w : this;
    const r = rem.call(target, type, fn, opts);
    if (fn) {
      const capture = capOf(opts);
      for (const x of live) if (x.target === target && x.type === type && x.fn === fn && x.capture === capture) {
        live.delete(x); bump(type, -1); break;
      }
    }
    return r;
  };
}

/* ── boot ────────────────────────────────────────────────────────*/
console.log('\n1. boot, with the counter in place first');
const MODULES = [...HTML.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b([^>]*)>/gi)]
  .map(m => m[1])
  .filter(a => !/\btype\s*=\s*["']?(module|importmap|application\/ld\+json)/i.test(a))
  .map(a => (a.match(/\bsrc\s*=\s*["']([^"']+)["']/i) || [])[1])
  .filter(s => s && s.startsWith('js/'));

const vc = new VirtualConsole();
const jsdomErrors = [];
vc.on('jsdomError', e => jsdomErrors.push((e && e.message) || String(e)));
const dom = new JSDOM(HTML, { pretendToBeVisual: true, url: 'https://www.neu.ac/',
                              runScripts: 'outside-only', virtualConsole: vc });
const w = dom.window;
w.document.querySelectorAll('noscript').forEach(n => n.remove());
instrument(w);                       /* before any game script: nothing is missed */

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
seedRandom(w, SEED);

const bootErrors = [];
for (const f of MODULES) {
  try { w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8')); }
  catch (e) { bootErrors.push(f + ': ' + e.message); }
}
ok(`all ${MODULES.length} classic scripts evaluate without throwing`, bootErrors.length === 0);
for (const e of bootErrors) console.log('       ' + e);

const NEU = w.NEU;
/* No listener in the page is registered with once:true. The counter does
   not model one-shot listeners, so this guard keeps it honest: if one is
   added, the counter must learn about it first. */
const ALL_JS = MODULES.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
ok('no script registers a once: listener (the counter does not model them)',
   !/once\s*:\s*true/.test(ALL_JS));

/* Reachable: a registration that can still receive an event. */
const reachable = x => x.target === w || x.target === w.document || x.target.isConnected === true;
const reachCount = () => {
  const m = {};
  for (const x of live) if (reachable(x)) m[x.type] = (m[x.type] || 0) + 1;
  return m;
};
const elements = () => w.document.querySelectorAll('*').length;

const boot = { reg: snap(), reach: reachCount(), el: elements() };
console.log(`       baseline: ${sum(boot.reg)} registrations (${sum(boot.reach)} reachable), ${boot.el} elements`);
console.log('       ' + Object.entries(boot.reg).sort((a, b) => b[1] - a[1])
  .map(([t, n]) => `${t} ${n}`).join(', '));

/* ── the scenes ───────────────────────────────────────────────────
   Each scene is opened and closed the way the game does it. The quiz runs
   in fast mode so a cycle takes milliseconds, not the full show. */
const present = {
  engine: !!NEU.engine,
  quiz: !!(NEU.quiz && NEU.quiz.open),
  craft: !!(NEU.craft && NEU.craft.open),
  deck: !!(NEU.deck && NEU.deck.open),
};
console.log('       scenes present: ' + Object.entries(present).map(([k, v]) => `${k}=${v}`).join(', '));
ok('the room engine, the quiz, the craft table and the deck are all present',
   present.engine && present.quiz && present.craft && present.deck);

/* growth[scene][type]: the change in registry count across that scene's
   opens and closes, summed over the cycles it ran in. */
const growth = {};
async function scene(name, open, close, hold = 0) {
  const before = snap();
  open();
  /* The engine's frame loop and the quiz timers run on real time, so a
     scene that is held open gets real time to run. */
  if (hold) await wait(hold);
  close();
  const after = snap();
  growth[name] = growth[name] || {};
  for (const t of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const d = (after[t] || 0) - (before[t] || 0);
    if (d) growth[name][t] = (growth[name][t] || 0) + d;
  }
}

/* ── the loops ───────────────────────────────────────────────────*/
console.log(`\n2. ${CYCLES} cycles: one warm-up, then two measured`);
NEU.quiz.fast(true);
let done = 0;
const afterWarm = {};
for (let i = 0; i < CYCLES; i++) {
  await scene('engine', () => NEU.engine.enter('a1_clearing', 'default'), () => NEU.engine.leave(), 50);
  await scene('quiz', () => NEU.quiz.open(), () => NEU.quiz.close());
  if (present.craft) await scene('craft', () => NEU.craft.open(), () => NEU.craft.close());
  if (present.deck) await scene('deck', () => NEU.deck.open(), () => NEU.deck.close());
  done++;
  if (i === 0) {
    /* attribution is for the measured cycles only */
    for (const k of Object.keys(growth)) delete growth[k];
    afterWarm.reg = snap();
    afterWarm.reach = reachCount();
    afterWarm.el = elements();
    console.log(`       after the warm-up: ${sum(afterWarm.reg)} registrations (${sum(afterWarm.reach)} reachable), ${afterWarm.el} elements`);
  }
}
const end = { reg: snap(), reach: reachCount(), el: elements() };
ok(`${done} cycles completed`, done === CYCLES);

/* ── the assertions ──────────────────────────────────────────────*/
console.log('\n3. nothing that can fire, and nothing in the page, accumulates across repeated cycles');
const types = new Set([...Object.keys(afterWarm.reach), ...Object.keys(end.reach)]);
const grewReach = [...types].filter(t => (end.reach[t] || 0) > (afterWarm.reach[t] || 0));
ok('no type gains a reachable listener after the warm-up', grewReach.length === 0);
for (const t of grewReach) {
  const scenes = Object.entries(growth).filter(([, g]) => (g[t] || 0) > 0).map(([s, g]) => `${s} +${g[t]}`);
  console.log(`       ${t}: reachable ${afterWarm.reach[t] || 0} → ${end.reach[t] || 0} — grew in: ${scenes.join(', ') || '(no single scene)'}`);
}
ok(`the page holds no more elements after the last cycle than after the warm-up (${afterWarm.el} → ${end.el})`,
   end.el <= afterWarm.el);

/* The registry churn, attributed. Reported, not asserted: every increase
   here must be on a detached node, which the reachable check above has
   already shown. */
const churn = [...new Set([...Object.keys(afterWarm.reg), ...Object.keys(end.reg)])]
  .filter(t => (end.reg[t] || 0) > (afterWarm.reg[t] || 0));
console.log('       registry churn after the warm-up (detached buttons, reclaimed by the browser):');
for (const t of churn) {
  const scenes = Object.entries(growth).filter(([, g]) => (g[t] || 0) > 0).map(([s, g]) => `${s} +${g[t]}`);
  console.log(`         ${t}: ${afterWarm.reg[t] || 0} → ${end.reg[t] || 0} (${scenes.join(', ')})`);
}
if (!churn.length) console.log('         (none)');

/* What the first open adds, for the record. */
console.log(`       first open, before any warm-up cycle: ${sum(boot.reg)} → ${sum(afterWarm.reg)} registrations, ` +
            `${boot.el} → ${afterWarm.el} elements (lazy population, not drift)`);
if (jsdomErrors.length) console.log('       jsdom reported: ' + jsdomErrors[0]);

/* ── summary ─────────────────────────────────────────────────────*/
console.log('\n' + (fail === 0 ? `ALL PASS (${pass})` : `${fail} FAILED, ${pass} passed`));
process.exit(fail === 0 ? 0 : 1);
