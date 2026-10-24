/* fixes21.mjs — the show must let you leave.
   Run: node tests/fixes21.mjs

   Every earlier quiz suite drives the show with fast(true), and fast
   mode SKIPS the DODGE FIRE and SHOOT THE TARGETS phases. So nothing
   ever ran the show the way a player does — and the player path was
   a soft-lock: the shoot phase's interval handle was cleared but never
   nulled, so on the end screen shootKey() still thought the phase was
   live and swallowed every Enter. "enter to go and see" did nothing,
   Esc restarted a show that then skipped both phases, and the prize
   corridor could not be reached from the quiz at all.

   This suite runs the REAL pacing — fast mode off, both phases on —
   with the window's timers time-warped, so twenty questions, two
   phases and the end screen take a couple of seconds instead of a
   minute and a half. Then it asserts the show hands you to g0_hall on
   its own, that Enter (or Esc) on the finale gets you there sooner,
   that opening the show again replays BOTH phases (replayable loops
   run twice), and that Esc mid-phase asks before leaving instead of
   restarting. */

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const MODULES = [
  'core/quest.js', 'core/save.js', 'core/juice.js', 'core/danmaku.js',
  'data/sheets.js', 'core/engine-look.js', 'core/engine-kinds.js', 'core/engine.js', 'game/sword.js', 'game/sans.js',
  'game/bullet.js', 'game/dark.js', 'act4/act4.js', 'act4/rooms-a.js',
  'act4/rooms-d.js', 'act4/boss-scal.js', 'act4/rooms-g.js', 'act4/quiz.js',
  'act4/rhythm.js', 'act4/craft.js', 'act4/boss-polt.js', 'act4/crack.js',
  'game/deck.js', 'core/music.js', 'core/perf.js', 'core/settings.js', 'core/touch.js',
  'core/dev.js'
];

/* Every delay the page asks for is multiplied by WARP. The phases
   count down per tick rather than per millisecond, so they still run
   their full length — just on a faster clock. */
const WARP = 0.02;

function boot() {
  const dom = new JSDOM(HTML, { pretendToBeVisual: true, url: 'https://www.neu.ac/',
                                runScripts: 'outside-only' });
  const w = dom.window;
  /* runScripts: 'outside-only' means scripting is OFF as far as the
     parser knows, so the <noscript> fallback style applies and hides
     .quiz — and jsdom 30 will not focus anything inside display:none.
     A real browser running the page never applies that block. */
  w.document.querySelectorAll('noscript').forEach(n => n.remove());
  const st = w.setTimeout.bind(w), si = w.setInterval.bind(w);
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

  for (const f of MODULES) {
    const p = path.join(ROOT, 'js', f);
    if (!fs.existsSync(p)) { console.log('  !! missing ' + f); continue; }
    try { w.eval(fs.readFileSync(p, 'utf8')); }
    catch (e) { console.log('  !! ' + f + ': ' + e.message); }
  }
  return { w, NEU: w.NEU, doc: w.document };
}

const wait = ms => new Promise(r => setTimeout(r, ms));
const key = (w, k, type = 'keydown') => {
  const e = new w.KeyboardEvent(type, { key: k, bubbles: true, cancelable: true });
  w.dispatchEvent(e);
  return e;
};
async function until(fn, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return true; await wait(5); }
  return !!fn();
}

/* If a question is on screen and not yet answered, answer it. */
function answerAsked(w, NEU, doc, right = true) {
  const q = NEU.quiz.questions[NEU.quiz.index];
  const opts = doc.querySelectorAll('#quizOpts .quiz__o');
  if (!q || opts.length !== 4 || [...opts].some(b => b.classList.contains('is-right'))) return false;
  key(w, right ? 'abcd'[q[3]] : 'abcd'[(q[3] + 1) % 4]);
  return true;
}

/* Play one whole show the way a person does: wait for each question's
   buttons, answer it, sit through both phases, stop at the end screen.
   Records which phases were actually seen on screen. */
async function playShow(w, NEU, doc, { right = true } = {}) {
  const seen = { dodge: false, shoot: false, canvasShown: false };
  const cv = doc.getElementById('quizCanvas');
  const end = doc.getElementById('quizEnd');
  let answered = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 15000) {
    if (NEU.quiz.phase === 'dodge') seen.dodge = true;
    if (NEU.quiz.phase === 'shoot') seen.shoot = true;
    if (cv && !cv.hidden) seen.canvasShown = true;
    if (!end.hidden) break;
    if (answerAsked(w, NEU, doc, right)) answered++;
    await wait(3);
  }
  return { ...seen, answered, ended: !end.hidden };
}

/* ═══ 1. a real show ends on a screen you can leave with Enter ═════*/
console.log('\n1. the real show (both phases) -> Enter -> prize corridor');
{
  const { w, NEU, doc } = boot();
  NEU.quiz.open();
  ok('the show is running', NEU.quiz.running === true);
  const r = await playShow(w, NEU, doc);
  ok('twenty questions were answered (' + r.answered + ')', r.answered === 20);
  ok('DODGE FIRE actually ran', r.dodge === true);
  ok('SHOOT THE TARGETS actually ran', r.shoot === true);
  ok('the end screen is up', r.ended === true);
  ok('a perfect run scored twenty', NEU.quiz.score === 20);
  ok('no phase is still live on the end screen', NEU.quiz.phase === null);
  ok('a4_rank ticked', NEU.quest.has('a4_rank') === true);

  const e = key(w, 'Enter');
  ok('Enter was taken by the show', e.defaultPrevented === true);
  /* Enter skips the rest of the finale: the result lands at once, the
     set switches off, then the corridor. A breath, not a wait. */
  await until(() => NEU.engine.room === 'g0_hall', 1000);
  ok('>>> Enter on the end screen sends you to the prize corridor <<<',
     NEU.engine.room === 'g0_hall');
  ok('>>> and the show is closed behind you <<<',
     doc.getElementById('quiz').hidden === true && NEU.quiz.running === false);
  ok('the show released the input lock', NEU.activeMinigame !== 'quiz');
  ok('the corridor is actually on screen', NEU.engine.running === true &&
     doc.getElementById('eng').hidden === false);
}

/* ═══ 2. finishing the show opens the next room on its own ═════════*/
console.log('\n2. no input at all on the end screen -> it takes you there');
{
  const { w, NEU, doc } = boot();
  NEU.quiz.open();
  const r = await playShow(w, NEU, doc, { right: false });
  ok('the show ended', r.ended === true);
  ok('even a Z run gets an end screen', NEU.save.flag('quiz_rank') === 'Z');
  ok('the end screen tells you it is moving on',
     /taking you|doors/i.test(doc.getElementById('quizEnd').textContent));
  ok('it does not leave before you can read it',
     NEU.quiz.running === true && NEU.engine.room !== 'g0_hall');
  const went = await until(() => NEU.engine.room === 'g0_hall' && !NEU.quiz.running, 4000);
  ok('>>> the prize corridor opens by itself <<<', went);
  ok('the overlay is hidden', doc.getElementById('quiz').hidden === true);
}

/* ═══ 3. Esc on the finale goes on; the TV replays a whole show ═══
   The finale has nothing to leave (the score is saved the moment it
   starts), so Escape there means the same as Enter. A replay is the
   broken television opening the show again, and it must run both
   phases again: replayable loops run twice. */
console.log('\n3. Esc on the finale goes on; opening it again is a full second show');
{
  const { w, NEU, doc } = boot();
  NEU.quiz.open();
  let r = await playShow(w, NEU, doc);
  ok('first show ended', r.ended === true);
  const e = key(w, 'Escape');
  ok('Esc on the finale is taken by the show', e.defaultPrevented === true);
  ok('>>> and does not restart it <<<', NEU.quiz.index === 20);
  const went = await until(() => NEU.engine.room === 'g0_hall' && !NEU.quiz.running, 2000);
  ok('>>> Esc on the finale goes on to the corridor <<<', went);
  NEU.quiz.open();                          /* the broken TV, again */
  ok('opening it again starts at question one',
     NEU.quiz.running === true && NEU.quiz.index === 0);
  ok('the finale went away', doc.getElementById('quizEnd').hidden === true);
  r = await playShow(w, NEU, doc);
  ok('>>> the replay ran DODGE FIRE again <<<', r.dodge === true);
  ok('>>> the replay ran SHOOT THE TARGETS again <<<', r.shoot === true);
  ok('the replay ended', r.ended === true);
  key(w, 'Enter');
  const back = await until(() => NEU.engine.room === 'g0_hall' && !NEU.quiz.running, 1000);
  ok('>>> and Enter still leaves after a replay <<<', back);
}

/* ═══ 4. Esc during a phase asks; it does not restart ══════════════*/
console.log('\n4. Esc mid-phase is a confirmed exit, not a silent restart');
{
  const { w, NEU, doc } = boot();
  NEU.quiz.open();
  /* get to the shoot phase */
  await until(() => NEU.quiz.phase === 'shoot' || (answerAsked(w, NEU, doc), false), 15000);
  ok('reached SHOOT THE TARGETS', NEU.quiz.phase === 'shoot');
  key(w, 'Escape');
  await wait(5);
  ok('>>> Esc mid-phase asks before leaving <<<', !!doc.getElementById('confirmExit'));
  ok('>>> and did not quietly restart the show <<<', NEU.quiz.index === 20);
  /* decline -> the phase carries on and the show still finishes */
  doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  ok('declining closes the prompt', !doc.getElementById('confirmExit'));
  const fin = await until(() => !doc.getElementById('quizEnd').hidden, 8000);
  ok('the show still reaches its end screen', fin);
  /* out through the corridor and back to the page, then the TV again */
  await until(() => !NEU.quiz.running, 2000);
  if (NEU.engine.leave) NEU.engine.leave();
  /* accept a leave mid-dodge on a fresh show: everything stops */
  NEU.quiz.open();
  await until(() => NEU.quiz.phase === 'dodge' || (answerAsked(w, NEU, doc), false), 8000);
  ok('reached DODGE FIRE on the replay', NEU.quiz.phase === 'dodge');
  key(w, 'Escape');
  doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await wait(40);
  ok('accepting the leave closes the show', NEU.quiz.running === false);
  ok('>>> and kills the phase loop with it <<<', NEU.quiz.phase === null);
  ok('the canvas is hidden again', doc.getElementById('quizCanvas').hidden === true);
  await wait(400);
  ok('nothing auto-advanced after a deliberate leave', NEU.engine.running === false);
}

/* ═══ 5. the stick and the A button can play the show ══════════════
   touch.js maps the stick to arrows and A to Enter. Synthetic events
   never activate a focused button, so the quiz has to act on them
   itself — otherwise a phone player can see the options and not pick
   one with the pad. */
console.log('\n5. arrows move between options, Enter picks');
{
  const { w, NEU, doc } = boot();
  NEU.quiz.open();
  await until(() => doc.querySelectorAll('#quizOpts .quiz__o').length === 4);
  const opts = () => [...doc.querySelectorAll('#quizOpts .quiz__o')];
  ok('caret starts on A', doc.activeElement === opts()[0]);
  key(w, 'ArrowDown');
  ok('ArrowDown moves to B', doc.activeElement === opts()[1]);
  key(w, 'ArrowRight');
  ok('ArrowRight moves to C', doc.activeElement === opts()[2]);
  key(w, 'ArrowUp');
  ok('ArrowUp moves back to B', doc.activeElement === opts()[1]);
  key(w, 'ArrowLeft'); key(w, 'ArrowLeft');
  ok('ArrowLeft wraps from A to D', doc.activeElement === opts()[3]);
  /* Q1's answer is B */
  key(w, 'ArrowRight'); key(w, 'ArrowRight');
  ok('caret on B again', doc.activeElement === opts()[1]);
  const e = key(w, 'Enter');
  ok('Enter on an option is taken', e.defaultPrevented === true);
  ok('>>> Enter picked the focused option <<<',
     opts()[1].classList.contains('is-right') && NEU.quiz.score === 1);

  /* held arrows move the SOUL every tick, not once per keydown */
  NEU.quiz.close();
}
{
  const { w, NEU, doc } = boot();
  NEU.quiz.open();
  await until(() => NEU.quiz.phase === 'dodge' || (answerAsked(w, NEU, doc), false), 8000);
  ok('reached DODGE FIRE', NEU.quiz.phase === 'dodge');
  const x0 = NEU.quiz.soul.x;
  key(w, 'ArrowLeft');                 /* ONE keydown, held */
  await wait(60);
  const x1 = NEU.quiz.soul.x;
  key(w, 'ArrowLeft', 'keyup');
  await wait(30);
  const x2 = NEU.quiz.soul.x;
  await wait(30);
  ok('>>> one held keydown keeps the soul moving <<<', x0 - x1 > 30);
  ok('releasing the key stops it', NEU.quiz.soul.x === x2);
  NEU.quiz.close();
}

console.log('\n' + (fail === 0 ? `ALL PASS (${pass})` : `${fail} FAILED, ${pass} passed`));
process.exit(fail === 0 ? 0 : 1);
