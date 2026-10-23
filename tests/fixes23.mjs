/* fixes23.mjs — the save migration, run against a real v1 file.
   Run: node tests/fixes23.mjs

   G6. save.js is at VERSION 2 because 0232f20 renamed the nine prize
   ranks (S+..D- became T..Z) and added one migration step, STEPS[1],
   so a v1 save keeps its doors. Until now nothing loaded a v1 file
   through the code that reads a stored save; the step was only ever
   checked by reading it.

   This suite stores tests/fixtures/save-v1.json under the key save.js
   reads, evaluates save.js the way a returning page does, and lets its
   boot code read, migrate and write the file back. It then checks the
   migrated state against the fixture, round-trips it, checks that a
   file already at VERSION is left alone, and checks that every
   migration step has a fixture.

   KNOWN DEFECT, kept failing on purpose. STEPS[1] visits the old rank
   flags in insertion order and writes each new name before deleting
   the old one. The fixture is a real v1 save: a player who scored A+
   or B+ holds both rank:A+ and rank:A, because opens() is cumulative.
   rank:A+ is renamed TO rank:A, which is itself an old name, so when
   rank:A's own turn comes it copies that value to rank:A- and deletes
   rank:A. Result: the A and B doors close for every such save. These
   checks are not weakened to pass; fix STEPS[1] to build the whole
   remap from a snapshot of the old flags. */

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SAVE_JS = fs.readFileSync(path.join(ROOT, 'js/core/save.js'), 'utf8');
const FIXTURES = path.join(ROOT, 'tests/fixtures');
const RAW = fs.readFileSync(path.join(FIXTURES, 'save-v1.json'), 'utf8');
const FX = JSON.parse(RAW);

/* The key and VERSION are read from the source, not copied here, so a
   renamed key or a bumped VERSION shows up as a failure instead of a
   test quietly reading the wrong slot. */
const KEY = SAVE_JS.match(/var KEY = '([^']+)'/)[1];
const SRC_VERSION = +SAVE_JS.match(/var VERSION = (\d+);/)[1];

/* The MAP literal inside STEPS[1], parsed from the source. */
const SRC_MAP = {};
for (const m of SAVE_JS.match(/var MAP = \{([^}]*)\}/)[1]
                       .matchAll(/'([^']+)':\s*'((?:[^'\\]|\\.)+)'/g)) {
  SRC_MAP[m[1]] = m[2].replace(/\\u([0-9a-fA-F]{4})/g,
                               (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/* The table 0232f20 publishes: nine old names, nine Deltarune letters,
   highest to lowest in both. */
const SPEC = { 'S+': 'T', 'S': 'S', 'A+': 'A', 'A': 'A–', 'B+': 'B',
               'B': 'B–', 'C': 'C', 'D': 'C–', 'D-': 'Z' };

/* Same harness as fixes21's boot(), with the modules trimmed to the two
   this suite needs and the stored save seeded before save.js runs (the
   page reads its save at load, so the file must already be there). */
function boot({ stored = null } = {}) {
  const dom = new JSDOM(HTML, { pretendToBeVisual: true, url: 'https://www.neu.ac/',
                                runScripts: 'outside-only' });
  const w = dom.window;
  /* runScripts: 'outside-only' means scripting is OFF as far as the
     parser knows, so the <noscript> fallback style applies and hides
     .quiz — and jsdom 30 will not focus anything inside display:none.
     A real browser running the page never applies that block. */
  w.document.querySelectorAll('noscript').forEach(n => n.remove());
  const st = w.setTimeout.bind(w), si = w.setInterval.bind(w);
  const WARP = 0.02;
  w.setTimeout  = (f, ms, ...a) => st(f, (ms || 0) * WARP, ...a);
  w.setInterval = (f, ms, ...a) => si(f, Math.max(1, (ms || 0) * WARP), ...a);
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
  w.requestAnimationFrame = cb => st(() => cb(Date.now()), 16);
  w.Element.prototype.getBoundingClientRect = () =>
    ({ left: 100, top: 100, right: 146, bottom: 146, width: 46, height: 46, x: 100, y: 100 });

  if (stored !== null) w.localStorage.setItem(KEY, stored);
  for (const f of ['core/quest.js', 'core/save.js']) {
    const p = path.join(ROOT, 'js', f);
    try { w.eval(fs.readFileSync(p, 'utf8')); }
    catch (e) { console.log('  !! ' + f + ': ' + e.message); }
  }
  return { w, NEU: w.NEU, store: w.localStorage };
}

/* ═══ 0. the fixture and the source agree on what a v1 file is ═════*/
console.log('\n0. the fixture is a real VERSION 1 file, and save.js has the 0232f20 table');
ok('fixture says v:1', FX.v === 1);
ok('fixture carries all nine v1 rank flags (the S+ cascade)',
   Object.keys(SPEC).every(k => FX.flags['rank:' + k] === 1));
ok('fixture quiz_rank and quiz.rank are S+', FX.flags.quiz_rank === 'S+' && FX.quiz.rank === 'S+');
ok('save.js MAP is the 0232f20 table',
   Object.keys(SPEC).length === Object.keys(SRC_MAP).length &&
   Object.keys(SPEC).every(k => SRC_MAP[k] === SPEC[k]));

/* ═══ 1. a stored v1 file is migrated when save.js loads ══════════*/
console.log('\n1. a stored v1 file is migrated when save.js loads');
const { NEU, store } = boot({ stored: RAW });
const D = NEU.save.data;
ok(`save.js VERSION is ${SRC_VERSION}`, NEU.save.VERSION === SRC_VERSION);
ok('the migrated file is at the current VERSION', D.v === SRC_VERSION);
ok('the migrated file was written back under the same key',
   JSON.parse(store.getItem(KEY)).v === SRC_VERSION);

for (const k of Object.keys(SPEC)) {
  const want = 'rank:' + SPEC[k];
  ok(`v1 rank:${k} -> ${want}`, D.flags[want] === 1);
}
const NEW = new Set(Object.values(SPEC));
const OLD_ONLY = Object.keys(SPEC).filter(k => !NEW.has(k));
ok(`old-only names are gone (${OLD_ONLY.map(k => 'rank:' + k).join(', ')})`,
   OLD_ONLY.every(k => !(('rank:' + k) in D.flags)));
ok('quiz_rank S+ became T', D.flags.quiz_rank === SPEC['S+']);
ok('quiz.rank S+ became T, score untouched', D.quiz.rank === SPEC['S+'] && D.quiz.score === FX.quiz.score);

const ordinary = Object.keys(FX.flags).filter(k => !k.startsWith('rank:') && k !== 'quiz_rank');
ok('ordinary flags untouched', ordinary.length > 0 && ordinary.every(k => D.flags[k] === FX.flags[k]));
ok('items untouched', eq(D.items, FX.items));
ok('quest progress untouched', eq(D.quest, FX.quest));
ok('room and spawn untouched', D.room === FX.room && D.spawn === FX.spawn);
ok('act and best scores untouched', D.act === FX.act && eq(D.best, FX.best));

/* ═══ 2. the public read path gives the same answer ════════════════*/
console.log('\n2. NEU.save.load() reads the same file through the public API');
store.setItem(KEY, RAW);
const loaded = NEU.save.load();
ok('load() migrates a stored v1 file',
   !!loaded && loaded.v === SRC_VERSION && loaded.flags.quiz_rank === SPEC['S+']);
ok('load() returns a copy and does not apply it', loaded !== NEU.save.data);

/* ═══ 3. serialise -> wipe -> restore is identical ════════════════*/
console.log('\n3. serialise -> wipe -> restore is identical');
const before = NEU.save.serialise();
NEU.save.wipe();
ok('wipe() forgets the save in memory and in storage',
   NEU.save.data.items.length === 0 && store.getItem(KEY) === null);
const back = NEU.save.deserialise(before);
ok('deserialise() applies the file and returns it', back === NEU.save.data && back.v === SRC_VERSION);
const after = NEU.save.serialise();
/* flush() stamps mem on every write, so the stamp moves on restore by
   design. Everything else has to match exactly. */
const noStamp = s => { const o = JSON.parse(s); delete o.stamp; return JSON.stringify(o); };
ok('round trip is identical (stamp aside)', noStamp(before) === noStamp(after));
ok('quest progress comes back from the restore', eq(NEU.quest.snapshot(), JSON.parse(before).quest));
ok('the restored file is written back to storage', noStamp(store.getItem(KEY)) === noStamp(before));

/* ═══ 4. a file already at VERSION is not remapped again ═══════════*/
console.log('\n4. a file already at VERSION is not remapped again');
const cur = JSON.parse(RAW);
cur.v = SRC_VERSION;
cur.flags = { 'rank:A': 1, 'rank:A–': 1, quiz_rank: 'A' };
const again = boot({ stored: JSON.stringify(cur) }).NEU.save.data;
ok('rank:A stays rank:A in a current file', again.flags['rank:A'] === 1);
ok('rank:A– stays rank:A– in a current file', again.flags['rank:A–'] === 1);
ok('quiz_rank A stays A in a current file', again.flags.quiz_rank === 'A');

/* ═══ 5. every migration step has a fixture ═══════════════════════*/
console.log('\n5. every migration step has a fixture');
const from = SAVE_JS.indexOf('var STEPS = {');
let depth = 0, end = -1;
for (let i = SAVE_JS.indexOf('{', from); i < SAVE_JS.length; i++) {
  if (SAVE_JS[i] === '{') depth++;
  else if (SAVE_JS[i] === '}' && --depth === 0) { end = i; break; }
}
const steps = [...SAVE_JS.slice(from, end).matchAll(/^\s*(\d+)\s*:\s*function\b/gm)].map(m => +m[1]);
const wantSteps = Array.from({ length: SRC_VERSION - 1 }, (_, i) => i + 1);
ok(`STEPS cover every version below ${SRC_VERSION} with no gaps (found: ${steps.join(', ') || 'none'})`,
   eq(steps, wantSteps));
for (const v of steps) {
  const f = path.join(FIXTURES, `save-v${v}.json`);
  ok(`STEPS[${v}] has fixtures/save-v${v}.json at v:${v}`,
     fs.existsSync(f) && JSON.parse(fs.readFileSync(f, 'utf8')).v === v);
}

console.log('\n' + (fail === 0 ? `ALL PASS (${pass})` : `${fail} FAILED, ${pass} passed`));
process.exit(fail === 0 ? 0 : 1);
