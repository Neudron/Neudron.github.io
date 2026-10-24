/* fixes40.mjs — TV TIME v2: the show ends on screen, then takes you on.
   Run: node tests/fixes40.mjs

   The complaint was "when you finish Tenna's questions, nothing
   happens". The old end was a text panel and a seven-second countdown.
   The rebuilt show ends with a finale that plays by itself:

     AND THAT'S THE SHOW -> the score counts up -> the rank stamps down
     and Tenna takes it personally -> the doors it opened light up on
     the board, from Z upward -> Tenna bows -> the television switches
     off like a CRT -> the prize corridor opens behind a slow iris.

   This suite plays real shows (fast mode off, both phases on) on a
   time-warped clock and watches every beat happen, in order, with no
   input at all; then checks that Enter, Escape, a click, the go button
   and the quit button each skip straight to the switch-off without
   losing a beat of the result; that Tenna is drawn and changes with the
   show; that the iris into the corridor is the slow one and goes back
   to the quick one after; and that nothing from a finished show fires
   into the next. */

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
const WARP = 0.05;

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


const lit = doc => [...doc.querySelectorAll('#quizBoard span')].filter(s => s.classList.contains('is-lit'));

/* ═══ 1. no input at all: every beat, in order, then the corridor ═══*/
console.log('\n1. the finale plays by itself, beat by beat, and ends in the corridor');
{
  const { w, NEU, doc } = boot();
  const calls = [];
  const enter = NEU.engine.enter;
  NEU.engine.enter = (id, spawn, opts) => { calls.push({ id, opts }); return enter(id, spawn, opts); };
  NEU.quiz.open();
  ok('the show opens on the intro', NEU.quiz.state === 'intro');
  ok('the spotlights are off during the questions',
     [...doc.querySelectorAll('.quiz__beam')].every(b => b.hidden));
  ok('Tenna is on screen as a drawn sprite', !!doc.getElementById('quizTenna') &&
     doc.getElementById('quizTenna').width === 48 && doc.getElementById('quizTenna').height === 80);
  const r = await playShow(w, NEU, doc);
  ok('a whole real show was played (' + r.answered + ' answers, both phases)',
     r.answered === 20 && r.dodge && r.shoot);
  ok('>>> the last answer is followed by the finale, not a dead screen <<<',
     NEU.quiz.state === 'finale' && NEU.quiz.ended === true);
  ok('the spotlights come on for it (and only for it)',
     [...doc.querySelectorAll('.quiz__beam')].length === 2 &&
     [...doc.querySelectorAll('.quiz__beam')].every(b => !b.hidden));
  ok('the questions are gone from the stage', doc.getElementById('quiz').classList.contains('is-finale') &&
     doc.querySelectorAll('#quizOpts .quiz__o').length === 0);
  ok('it opens with the title', /THAT.S THE SHOW/.test(doc.getElementById('quizEnd').textContent));
  ok('and Tenna cheers, stars on his screen', NEU.quiz.look.pose === 'cheer' && NEU.quiz.look.face === 'stars');
  const go = doc.getElementById('quizGoBtn');
  ok('there is one thing to press, and it has the focus', !!go && doc.activeElement === go);

  /* the tally counts up rather than appearing */
  const seen = new Set();
  const tallied = await until(() => {
    const t = doc.getElementById('quizTally');
    if (t) seen.add(t.textContent);
    return t && t.textContent === '20';
  }, 4000);
  ok('>>> the score counts up to twenty <<<', tallied);
  ok('through the numbers on the way (' + seen.size + ' values seen)', seen.size >= 5);

  const stamped = await until(() => doc.getElementById('quizRank').textContent === 'T', 4000);
  ok('>>> then the rank stamps down: T <<<', stamped &&
     doc.getElementById('quizRank').classList.contains('is-stamped'));
  ok('and he takes it personally, out loud', /20 OUT OF 20!.*ULTIMATE/.test(doc.getElementById('quizSay').textContent));

  const allLit = await until(() => lit(doc).length === 9, 4000);
  ok('>>> then the doors it opened light up on the board (9 for T) <<<', allLit);
  ok('and the line says how many', await until(() =>
     /9 doors just unlocked/.test(doc.getElementById('quizDoors').textContent), 2000));

  const bowed = await until(() => NEU.quiz.look.pose === 'bow', 4000);
  ok('>>> then Tenna bows and sends you to the prizes <<<', bowed &&
     /TO THE PRIZES/.test(doc.getElementById('quizSay').textContent));

  const offing = await until(() => doc.getElementById('quiz').classList.contains('is-off'), 4000);
  ok('>>> then the set switches off like a CRT <<<', offing && NEU.quiz.state === 'off');
  ok('his screen goes dark with it', NEU.quiz.look.face === 'off');
  ok('nothing has moved on yet: the switch-off plays first', NEU.quiz.running === true);

  const arrived = await until(() => NEU.engine.room === 'g0_hall' && !NEU.quiz.running, 3000);
  ok('>>> and the prize corridor opens on its own <<<', arrived);
  ok('the show is closed behind you', doc.getElementById('quiz').hidden === true &&
     NEU.activeMinigame !== 'quiz');
  const c = calls[calls.length - 1] || {};
  ok('>>> through the slow iris, not a door\'s quick one <<<', c.id === 'g0_hall' && c.opts && c.opts.iris > 0.5);
  ok('the engine is running that iris now', NEU.engine.debug.iris > 0.5 && NEU.engine.debug.fade > 0);
  const quick = await until(() => NEU.engine.debug.iris === 0.22 && NEU.engine.debug.fade === 0, 6000);
  ok('and goes back to the quick one once it is open', quick);
  ok('the corridor says where you are (its first-visit lines ran)', NEU.save.flagged('g0_seen'));
  ok('the set is reset for next time', !doc.getElementById('quiz').classList.contains('is-off') &&
     !doc.getElementById('quiz').classList.contains('is-finale'));
}

/* ═══ 2. every way of saying "go on" skips, and lands the result ══*/
console.log('\n2. Enter, Escape, a click, the go button and esc all skip to the switch-off');
for (const how of ['Enter', 'Escape', 'Space', 'click', 'go', 'quit']) {
  const { w, NEU, doc } = boot();
  NEU.quiz.open();
  await playShow(w, NEU, doc, { right: false });
  ok(how + ': the finale is on (a Z run)', NEU.quiz.state === 'finale');
  if (how === 'click') doc.getElementById('quizEnd').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  else if (how === 'go') doc.getElementById('quizGoBtn').click();
  else if (how === 'quit') doc.getElementById('quizQuit').click();
  else key(w, how === 'Space' ? ' ' : how);
  ok(how + ': no "Leave Quiz?" prompt (there is nothing to lose)', !doc.getElementById('confirmExit'));
  ok(how + ': >>> the result lands at once: score, rank and doors <<<',
     doc.getElementById('quizTally').textContent === '0' + '' &&
     doc.getElementById('quizRank').textContent === 'Z' && lit(doc).length === 1 &&
     /1 door just unlocked/.test(doc.getElementById('quizDoors').textContent));
  const off = await until(() => doc.getElementById('quiz').classList.contains('is-off'), 2000);
  ok(how + ': then the switch-off still plays', off);
  const there = await until(() => NEU.engine.room === 'g0_hall' && !NEU.quiz.running, 2000);
  ok(how + ': >>> then the corridor <<<', there);
}

/* ═══ 3. a skip in the middle of the count, with a mixed run ═══════*/
console.log('\n3. a skip mid-tally lands the real numbers');
{
  const { w, NEU, doc } = boot();
  NEU.quiz.open();
  /* every other answer right: ten of twenty is a B- */
  let k = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 15000 && doc.getElementById('quizEnd').hidden) {
    const q = NEU.quiz.questions[NEU.quiz.index];
    const opts = doc.querySelectorAll('#quizOpts .quiz__o');
    if (q && opts.length === 4 && ![...opts].some(b => b.classList.contains('is-right') || b.classList.contains('is-wrong'))) {
      key(w, 'abcd'[k++ % 2 ? q[3] : (q[3] + 1) % 4]);
    }
    await wait(3);
  }
  ok('ten of twenty', NEU.quiz.score === 10);
  await until(() => +doc.getElementById('quizTally').textContent >= 3, 3000);
  ok('the count is under way', +doc.getElementById('quizTally').textContent < 10);
  key(w, 'Enter');
  ok('>>> Enter lands ten, B–, and four doors at once <<<',
     doc.getElementById('quizTally').textContent === '10' &&
     doc.getElementById('quizRank').textContent === 'B–' && lit(doc).length === 4);
  ok('and the lit doors are the bottom four', lit(doc).map(s => s.querySelector('b').textContent).join(',') ===
     'B–,C,C–,Z');
  const there = await until(() => NEU.engine.room === 'g0_hall', 2000);
  ok('then the corridor', there);
  /* the corridor carries the board on: the doors you earned glow in
     the gold the show lit them with; the ones you did not stay dark */
  const hall = NEU.engine.api.ents().filter(e => e.t === 'exit' && e.glowOpen);
  const gold = hall.filter(e => { const l = NEU.engineKinds.get(e).light(e); return l && l.col === '#FFD34E'; });
  ok('>>> in the corridor, the four doors you earned glow gold; the other five do not <<<',
     hall.length === 9 && gold.length === 4 &&
     gold.every(e => NEU.save.flagged(e.locked)));
  /* and each door wears its letter: gold on the ones you earned */
  const ink = e => {
    const fills = [];
    const g = { set fillStyle(v) { fills.push(v); }, get fillStyle() { return fills[fills.length - 1]; },
                fillRect() {}, drawImage() {} };
    NEU.engineKinds.get(e).draw(g, e, { S: 2, sx: 100, sy: 100, now: 0 });
    return fills;
  };
  ok('every corridor door has its rank on a plate',
     hall.map(e => e.label).join(' ') === 'Z C\u2013 C B\u2013 B A\u2013 A S T');
  ok('>>> the plates of earned doors are gold, the rest grey <<<',
     hall.every(e => ink(e).includes(NEU.save.flagged(e.locked) ? '#FFD34E' : '#6E6880')));
}

/* ═══ 4. a better old score: the stamp is this run, the doors the best */
console.log('\n4. a worse replay stamps its own rank but keeps the best doors');
{
  const { w, NEU, doc } = boot();
  NEU.save.data.quiz = { rank: 'A', score: 16 };
  NEU.quiz.open();
  await playShow(w, NEU, doc, { right: false });
  key(w, 'Enter');
  ok('the stamp is this run: Z', doc.getElementById('quizRank').textContent === 'Z');
  ok('>>> the doors are the best run\'s: seven for A <<<', lit(doc).length === 7);
  ok('and it says the best still counts', /best is still A/.test(doc.getElementById('quizDoors').textContent));
  ok('the saved rank did not go down', NEU.save.flag('quiz_rank') === 'A');
}

/* ═══ 5. nothing from a finished show fires into the next ═════════*/
console.log('\n5. a closed finale is dead; the next show is clean');
{
  const { w, NEU, doc } = boot();
  NEU.quiz.open();
  await playShow(w, NEU, doc);
  ok('finale on', NEU.quiz.state === 'finale');
  NEU.quiz.close();                       /* the page takes the overlay away mid-finale */
  await wait(1500);
  ok('>>> a closed finale never reaches the corridor <<<', NEU.engine.running === false);
  NEU.quiz.open();                        /* the broken TV again */
  ok('the next show starts clean', NEU.quiz.state === 'intro' && NEU.quiz.index === 0 &&
     doc.getElementById('quizEnd').hidden === true && lit(doc).length === 0);
  await wait(1500);
  ok('>>> and no beat of the old finale lands in it <<<', NEU.quiz.state !== 'finale' &&
     NEU.quiz.state !== 'off' && !doc.getElementById('quiz').classList.contains('is-off') &&
     NEU.quiz.running === true);
  NEU.quiz.close();
}

/* ═══ 6. Tenna reacts to the show ═════════════════════════════════*/
console.log('\n6. Tenna is a character on screen, not a text box');
{
  const { w, NEU, doc } = boot();
  NEU.quiz.open();
  ok('he warms up with the set (static on his screen)', NEU.quiz.look.face === 'static');
  await until(() => NEU.quiz.state === 'ask', 3000);
  ok('he points at the question', NEU.quiz.look.pose === 'point');
  const q = NEU.quiz.questions[NEU.quiz.index];
  key(w, 'abcd'[q[3]]);
  ok('>>> a right answer: he cheers <<<', NEU.quiz.look.pose === 'cheer' && NEU.quiz.look.face === 'happy');
  await until(() => NEU.quiz.state === 'ask', 3000);
  const q2 = NEU.quiz.questions[NEU.quiz.index];
  key(w, 'abcd'[(q2[3] + 1) % 4]);
  ok('>>> a wrong one: he shrugs, shocked <<<', NEU.quiz.look.pose === 'shrug' && NEU.quiz.look.face === 'shock');
  const Q = fs.readFileSync(path.join(ROOT, 'js', 'act4', 'quiz.js'), 'utf8');
  ok('every pose he is given has arms to draw', [...Q.matchAll(/pose\('(\w+)'/g)].every(m => new RegExp('\\b' + m[1] + ':\\s*\\[').test(Q)));
  ok('the old wiki crops are not what is on screen', !/tenna-idle|tenna-point/.test(Q));
  NEU.quiz.close();
}

/* ═══ 7. the CSS has every beat, and a quiet version of each ══════*/
console.log('\n7. the switch-on, switch-off and stamp exist, and calm down for reduced motion');
{
  const CSS = fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8');
  ok('the CRT switch-on and switch-off are keyframed',
     /@keyframes quizCrtOn/.test(CSS) && /@keyframes quizCrtOff/.test(CSS) &&
     /\.quiz\.is-on \.quiz__tv \{ animation: quizCrtOn/.test(CSS) && /\.quiz\.is-off \.quiz__tv \{ animation: quizCrtOff/.test(CSS));
  ok('the black around the picture is the overlay itself', /\n\.quiz \{[^}]*background: #000/.test(CSS));
  ok('the rank stamp is keyframed', /@keyframes quizStamp/.test(CSS) && /\.quiz__rank\.is-stamped/.test(CSS));
  ok('a lit door has its own look', /\.quiz__board span\.is-lit \{/.test(CSS));
  const rm = CSS.slice(CSS.indexOf('.quiz.is-on .quiz__tv { animation: none; }') - 60);
  ok('>>> reduced motion: no CRT fold, a plain fade; no stamp or sweep <<<',
     /prefers-reduced-motion: reduce\) \{\s*\.quiz\.is-on \.quiz__tv \{ animation: none; \}\s*\.quiz\.is-off \.quiz__tv \{ animation: quizFade/.test(rm));
}

/* ═══ 8. nothing of the room sits on the show ════════════════════*/
console.log('\n8. the room\'s box clears when the show opens, and the talk face is in hand');
{
  const { w, NEU, doc } = boot();
  const tbox = doc.getElementById('tbox');
  NEU.save.flag('tv_breakable', 1);
  ok('the television breaks and says so', NEU.breakTV() === true && tbox.hidden === false);
  ok('>>> the show climbs out of it <<<', await until(() => NEU.quiz.running, 3000));
  /* On a phone the box sat over the first question and the timer
     until the narration was clicked through. */
  ok('>>> and the box that said so is gone from on top of it <<<', tbox.hidden === true);
  NEU.quiz.close();
  const S = fs.readFileSync(path.join(ROOT, 'js', 'game', 'sans.js'), 'utf8');
  ok('the broken TV replays the show without a line the show would wipe',
     !/press e to go again/.test(S));
  const Q = fs.readFileSync(path.join(ROOT, 'js', 'act4', 'quiz.js'), 'utf8');
  ok('a hit in the arena shakes it and Tenna flinches',
     /react\('shock', 'shock', \['point', 'grin'\], true\)/.test(Q) && /classList\.add\('is-hit'\)/.test(Q) &&
     /\.quiz__canvas\.is-hit \{ animation: quizWrong/.test(fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8')));
  ok('  and the shake is skipped under reduced motion', /shake && cv && !reduced/.test(Q));
  /* Undertale Sans is font-display: optional. Fetched on first use it
     misses the 100ms window and the page keeps the fallback (serif, or
     a script face on phones) for the whole visit — seen in Chromium. */
  ok('>>> the talk face is preloaded, so `optional` finds it ready <<<',
     /rel="preload" href="fonts\/webfonts\/sans-webfont\.woff2" as="font" type="font\/woff2" crossorigin/.test(HTML));
}

console.log('');
console.log(fail ? `${fail} FAILED, ${pass} passed` : `ALL PASS (${pass})`);
process.exit(fail ? 1 : 0);
