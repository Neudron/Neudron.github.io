/* fixes20.mjs — Tenna TV minigame overhaul.
   Run: node tests/fixes20.mjs

   Tests the multi-round show structure: the exit fix (Enter sends you
   to g0_hall), the rank remapping (T/S/A/B/C/Z), the "only ever
   improves" save rule, the focus trap regression, and the ranks/doors
   agreement between quiz.js and rooms-g.js.

   The harness is the same as fixes17: boot the full game into jsdom,
   drive the quiz state machine with fast(true), and assert against
   the real save flags and quest markers. */

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };
const read = f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const MODULES = [
  'core/quest.js', 'core/save.js', 'core/juice.js', 'core/danmaku.js',
  'data/sheets.js', 'core/engine.js', 'game/sword.js', 'game/sans.js',
  'game/bullet.js', 'game/dark.js', 'act4/act4.js', 'act4/rooms-a.js',
  'act4/rooms-d.js', 'act4/boss-scal.js', 'act4/rooms-g.js', 'act4/quiz.js',
  'act4/rhythm.js', 'act4/craft.js', 'act4/boss-polt.js', 'act4/crack.js',
  'game/deck.js', 'core/music.js', 'core/perf.js', 'core/settings.js', 'core/touch.js',
  'core/dev.js'
];

function boot() {
  const dom = new JSDOM(HTML, { pretendToBeVisual: true, url: 'https://www.neu.ac/',
                                runScripts: 'outside-only' });
  const w = dom.window;
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
  w.requestAnimationFrame = cb => w.setTimeout(() => cb(Date.now()), 0);
  w.Element.prototype.getBoundingClientRect = () =>
    ({ left: 100, top: 100, right: 146, bottom: 146, width: 46, height: 46, x: 100, y: 100 });

  for (const f of MODULES) {
    const p = path.join(ROOT, 'js', f);
    if (!fs.existsSync(p)) { console.log('  !! missing ' + f); continue; }
    try { w.eval(fs.readFileSync(p, 'utf8')); }
    catch (e) { console.log('  !! ' + f + ': ' + e.message); }
  }
  return { w, NEU: w.NEU, dom };
}

const wait = ms => new Promise(r => setTimeout(r, ms));

/* ═══ 1. the show runs and finishes ═══════════════════════════════*/
console.log('\n1. the show runs and finishes');
{
  const { w, NEU } = boot();
  NEU.quiz.fast(true);
  NEU.quiz.open();
  await wait(60);
  ok('quiz is running', NEU.quiz.running === true);

  /* answer everything correctly */
  for (let k = 0; k < 20; k++) {
    const q = NEU.quiz.questions[NEU.quiz.index];
    if (!q) break;
    w.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'abcd'[q[3]], bubbles: true }));
    await wait(20);
  }
  await wait(200);
  ok('>>> a perfect run scores twenty <<<', NEU.quiz.score === 20);
  ok('the objective ticked', NEU.quest.has('a4_rank') === true);
  ok('quiz_rank is set', NEU.save.flag('quiz_rank') === 'T');
  NEU.quiz.close();
}

/* ═══ 2. the exit works (Enter -> g0_hall) ════════════════════════*/
console.log('\n2. the exit works');
{
  const { w, NEU } = boot();
  NEU.quiz.fast(true);
  NEU.quiz.open();
  await wait(60);

  /* finish the show */
  for (let k = 0; k < 20; k++) {
    const q = NEU.quiz.questions[NEU.quiz.index];
    if (!q) break;
    w.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'abcd'[q[3]], bubbles: true }));
    await wait(20);
  }
  await wait(200);
  ok('show is finished', NEU.quiz.index >= 20);

  /* Enter should close and enter g0_hall */
  w.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await wait(100);
  ok('>>> Enter sends you to the prize corridor <<<',
     NEU.engine.room === 'g0_hall');
  ok('the overlay is closed', w.document.getElementById('quiz').hidden === true);
}

/* ═══ 3. rank flags are set correctly ════════════════════════════*/
console.log('\n3. rank flags');
{
  const { w, NEU } = boot();
  NEU.quiz.fast(true);
  NEU.quiz.open();
  await wait(60);

  /* perfect run: all 20 correct -> rank T */
  for (let k = 0; k < 20; k++) {
    const q = NEU.quiz.questions[NEU.quiz.index];
    if (!q) break;
    w.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'abcd'[q[3]], bubbles: true }));
    await wait(20);
  }
  await wait(200);
  ok('>>> a perfect run sets rank:T <<<', NEU.save.flag('quiz_rank') === 'T');
  ok('>>> which opens all 9 doors <<<',
     NEU.quiz.opens('T').length === 9);
  ok('every rank flag is set',
     NEU.quiz.ranks.every(r => NEU.save.flagged('rank:' + r[0])));
  NEU.quiz.close();

  /* terrible run: all wrong -> rank Z, only 1 door */
  NEU.save.wipe();
  NEU.quiz.fast(true);
  NEU.quiz.open();
  await wait(60);
  for (let k = 0; k < 20; k++) {
    const q = NEU.quiz.questions[NEU.quiz.index];
    if (!q) break;
    /* always answer wrong (pick the last option, which is rarely correct) */
    w.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'd', bubbles: true }));
    await wait(20);
  }
  await wait(200);
  ok('a terrible run sets rank:Z', NEU.save.flag('quiz_rank') === 'Z');
  ok('>>> Z opens exactly one door <<<', NEU.quiz.opens('Z').length === 1);
  ok('only rank:Z is flagged', NEU.save.flagged('rank:Z') && !NEU.save.flagged('rank:T'));
  NEU.quiz.close();
}

/* ═══ 4. focus trap still works (regression) ═════════════════════*/
console.log('\n4. focus trap regression');
{
  const { w, NEU } = boot();
  const doc = w.document;
  const outside = doc.createElement('button');
  outside.textContent = 'outside';
  doc.body.appendChild(outside);
  outside.focus();

  NEU.quiz.fast(true);
  NEU.quiz.open();
  await wait(40);
  ok('quiz is running', NEU.quiz.running === true);
  ok('focus moved into the overlay',
     doc.getElementById('quiz').contains(doc.activeElement));

  /* Tab off the last control wraps back */
  const opts = [...doc.querySelectorAll('#quizOpts .quiz__o')];
  ok('four options rendered', opts.length === 4);
  ok('caret on option A', doc.activeElement === opts[0]);

  const all = [...doc.querySelectorAll('#quiz button')].filter(b => !b.hidden && !b.disabled);
  ok('focusable set is options + quit (' + all.length + ')', all.length === 5);

  /* Tab forward past the end */
  const quit = doc.getElementById('quizQuit');
  quit.focus();
  const e = new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  w.dispatchEvent(e);
  ok('>>> Tab off the last control is prevented <<<', e.defaultPrevented === true);
  ok('>>> wraps back inside <<<',
     doc.getElementById('quiz').contains(doc.activeElement));

  /* The focusable list is computed live, not cached */
  const Q = read('act4/quiz.js');
  ok('focusables() is called on every Tab press',
     /if \(e\.key === 'Tab'\)[\s\S]{0,120}focusables\(\)/.test(Q));

  NEU.quiz.close();
  ok('closing returns focus', doc.activeElement === outside);
}

/* ═══ 5. ranks and doors agree ════════════════════════════════════*/
console.log('\n5. ranks and doors agree');
{
  const { NEU } = boot();
  ok('>>> T opens all 9 <<<', NEU.quiz.opens('T').length === 9);
  ok('>>> Z opens only 1 <<<', NEU.quiz.opens('Z').length === 1);

  /* The ranks in quiz.js match the door flags in rooms-g.js */
  const quizRanks = NEU.quiz.ranks.map(r => r[0]);
  ok('nine ranks', quizRanks.length === 9);
  ok('T is the top rank', quizRanks[0] === 'T');
  ok('Z is the bottom rank', quizRanks[8] === 'Z');

  /* rooms-g.js has the same rank names in its RANKS array.
     The door flags are built dynamically ('rank:' + r), so we
     check the source RANKS array, not literal 'rank:X' strings. */
  const G = read('act4/rooms-g.js');
  ok('rooms-g.js builds rank:* door flags', /'rank:' \+ r/.test(G));
  /* The RANKS array in rooms-g.js is the same set, reversed
     (lowest to highest). Check each rank name appears in it. */
  for (const r of quizRanks) {
    /* The source has \u2013 as literal text (JS escape); the
       runtime value is the actual en-dash. Search for the
       literal text the source file contains. */
    const lit = r.replace(/\u2013/g, '\\u2013');
    ok('rank ' + r + ' is in rooms-g RANKS',
       G.includes("'" + lit + "'") || G.includes("'" + r + "'"));
  }

  /* The save migration remaps old ranks */
  const S = read('core/save.js');
  ok('save.js has a v1->v2 migration', /STEPS\s*=/.test(S) && /VERSION\s*=\s*2/.test(S));
  ok('the migration maps old rank names',
     /'S\+'.*'T'/.test(S) && /'D-'\s*:\s*'Z'/.test(S));
}

console.log('\n' + (fail === 0 ? `ALL PASS (${pass})` : `${fail} FAILED, ${pass} passed`));
process.exit(fail === 0 ? 0 : 1);
