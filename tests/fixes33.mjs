/* fixes33.mjs — the small accessibility and print pass.
   Run: node tests/fixes33.mjs

   Seven small things, one suite:
     C8   a settings switch that gives the quiz twice the time
     C9   the dialogue box stops re-announcing every character
     C10  the bullet-hell HP is readable by a screen reader
     A6   images that nothing draws from wait until they are needed
     A9   a preconnect to the CDN the importmap loads three.js from
     I5   the colophon says what the site does not keep
     J4   printing gives you the words, not the room

   Normal timers, no warp. The quiz clock is the one exception: it is
   swapped for a queue the test advances by hand, so "thirteen seconds
   with nobody answering" costs no real time. */

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const CSS  = fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8')
               .replace(/^﻿/, '');

const MODULES = [
  'core/quest.js', 'core/save.js', 'core/juice.js', 'core/danmaku.js',
  'data/sheets.js', 'core/engine-look.js', 'core/engine-kinds.js', 'core/engine.js', 'game/sword.js', 'game/sans.js',
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
  /* runScripts: 'outside-only' means scripting is OFF as far as the
     parser knows, so the <noscript> fallback style applies and hides
     .quiz — and jsdom 30 will not focus anything inside display:none.
     A real browser running the page never applies that block. */
  w.document.querySelectorAll('noscript').forEach(n => n.remove());
  /* Bound before anything else touches the timers, so the frame clock
     stays real even after a test swaps setTimeout for its own queue. */
  const st = w.setTimeout.bind(w);
  /* The bullet loop measures its frame delta against performance.now(),
     so the frame stamp has to come from the same clock. */
  w.requestAnimationFrame = cb => st(() => cb(w.performance.now()), 16);
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
  /* A Proxy of no-ops, not null: engine.js, bullet.js, dark.js and the
     bosses bail out of their whole module if getContext fails. */
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

/* A clock the test owns. The page's timers go into a queue that only
   moves when advance() is called, so the quiz's twelve- or
   twenty-four-second limits run in no real time at all. */
function fakeClock(w) {
  let now = 0, seq = 0, jobs = [];
  const add = (f, ms, args, every) => {
    const id = ++seq;
    jobs.push({ id, at: now + Math.max(0, ms || 0), f, args,
                every: every ? Math.max(1, ms || 0) : 0 });
    return id;
  };
  w.setTimeout  = (f, ms, ...a) => add(f, ms, a, false);
  w.setInterval = (f, ms, ...a) => add(f, ms, a, true);
  w.clearTimeout = w.clearInterval = id => { jobs = jobs.filter(j => j.id !== id); };
  return {
    advance(ms) {
      const end = now + ms;
      for (;;) {
        let next = null;
        for (const j of jobs)
          if (!next || j.at < next.at || (j.at === next.at && j.id < next.id)) next = j;
        if (!next || next.at > end) break;
        now = next.at;
        if (next.every) next.at = now + next.every;
        else jobs = jobs.filter(j => j !== next);
        next.f(...next.args);
      }
      now = end;
    }
  };
}

/* Steps the fake clock in 50ms slices until the predicate holds. */
function advanceUntil(clock, pred, maxMs) {
  for (let t = 0; t < maxMs; t += 50) { if (pred()) return true; clock.advance(50); }
  return pred();
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

/* The body of one @media block, found by depth counting. CSS is read
   with comments stripped first, so a word inside an explanatory comment
   can never be taken for the rule itself. */
function mediaBody(css, query) {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const m = new RegExp('@media\\s+' + query + '\\s*\\{').exec(bare);
  if (!m) return null;
  let depth = 1, i = m.index + m[0].length;
  for (; i < bare.length && depth > 0; i++) {
    if (bare[i] === '{') depth++;
    else if (bare[i] === '}') depth--;
  }
  return bare.slice(m.index + m[0].length, i - 1);
}

const toggleRelaxed = (NEU, doc) => {
  NEU.settings.open();
  const sw = doc.getElementById('settRelaxed');
  if (sw) sw.click();
  NEU.settings.close();
};

/* ═══ 1. C8 — the switch exists, saves, and reads back ════════════*/
console.log('\n1. the relaxed quiz switch (C8)');
{
  const { NEU, doc } = boot();
  const sw = doc.getElementById('settRelaxed') || doc.createElement('button');
  ok('the switch exists and is a switch', !!sw && sw.getAttribute('role') === 'switch');
  ok('it is labelled by its own label',
     !!sw && !!doc.getElementById(sw.getAttribute('aria-labelledby')));
  ok('it starts off', !!sw && sw.getAttribute('aria-checked') === 'false');
  NEU.settings.open();
  sw.click();
  ok('clicking it turns it on', sw.getAttribute('aria-checked') === 'true');
  ok('the choice is saved as opt_relaxedQuiz', NEU.save.flag('opt_relaxedQuiz') === 1);
  ok('the settings getter reads it back', NEU.settings.relaxedQuiz === true);
  NEU.settings.close();
  sw.setAttribute('aria-checked', 'false');        // lie to the panel...
  NEU.settings.open();
  ok('reopening the panel reads it back from the save',
     sw.getAttribute('aria-checked') === 'true');  // ...and it corrects itself
  NEU.settings.close();
}

/* ═══ 2. C8 — the quiz clock with the switch on, then off ═════════*/
console.log('\n2. the quiz clock with the switch on (C8)');
{
  const { w, NEU, doc } = boot();
  const clock = fakeClock(w);
  toggleRelaxed(NEU, doc);
  ok('with the switch on the limit is twenty-four', NEU.quiz.limit === 24);
  NEU.quiz.open();
  const shown = advanceUntil(clock, () =>
    doc.querySelectorAll('#quizOpts .quiz__o').length === 4, 10000);
  ok('the first question is on screen', shown);
  clock.advance(13000);
  ok('thirteen seconds unanswered: the show has NOT moved on', NEU.quiz.index === 0);
  const pct = parseFloat(doc.getElementById('quizBar').style.width);
  ok('the bar is about half full at thirteen seconds (' + pct.toFixed(1) + '%)',
     pct > 40 && pct < 50);
  clock.advance(12000);
  ok('and it still runs out, at twenty-four seconds', NEU.quiz.index === 1);
  NEU.quiz.close();
}

console.log('\n3. the quiz clock with the switch off (C8)');
{
  const { w, NEU, doc } = boot();
  const clock = fakeClock(w);
  ok('with the switch off the limit is twelve', NEU.quiz.limit === 12);
  NEU.quiz.open();
  advanceUntil(clock, () => doc.querySelectorAll('#quizOpts .quiz__o').length === 4, 10000);
  clock.advance(13000);
  ok('thirteen seconds unanswered: the show HAS moved on', NEU.quiz.index === 1);
  NEU.quiz.close();
}

/* ═══ 4. C9 — the dialogue box is not a live region per character ═*/
console.log('\n4. the dialogue box announces a line once (C9)');
{
  const { NEU, doc } = boot();
  const box = doc.getElementById('tbox');
  const sr  = doc.getElementById('tboxSR') || doc.createElement('p');
  ok('#tbox has no aria-live', !box.hasAttribute('aria-live'));
  ok('#tbox is not role=status', box.getAttribute('role') !== 'status');
  ok('a visually hidden polite region exists',
     !!sr && sr.classList.contains('sr-only') && sr.getAttribute('aria-live') === 'polite');
  ok('the region is a sibling of the box, not inside it',
     !!sr && sr.parentNode === box.parentNode && !box.contains(sr));
  NEU.talk(['hello there']);
  ok('the whole line is in the region at once', sr.textContent === 'hello there');
  await wait(150);
  const typed = doc.getElementById('tboxTxt').textContent.length;
  ok('the typewriter is still going (' + typed + ' of 11 letters)', typed > 0 && typed < 11);
  ok('and the region still holds the whole line, not the letters',
     sr.textContent === 'hello there');
  NEU.talk.close();
  ok('closing the box clears the region', sr.textContent === '');
}

/* ═══ 5. C10 — the bullet-hell HP is a live line ═════════════════*/
console.log('\n5. the bullet-hell HP is announced (C10)');
{
  const { w, NEU, doc } = boot();
  const live = doc.getElementById('bhLive') || doc.createElement('p');
  ok('bhLive is visually hidden and polite',
     !!live && live.classList.contains('sr-only') && live.getAttribute('aria-live') === 'polite');
  NEU.bullet.open();
  ok('a fresh run says HP 3/3', live.textContent === 'HP 3/3');
  const hit = await until(() => live.textContent === 'HP 2/3', 20000);
  ok('the first hit reads out as HP 2/3', hit);
  for (const k of '69420') key(w, k);             // the cheat: ends the run as a win
  const done = await until(() => !NEU.bullet.running, 3000);
  ok('the win reads out a line', done && /you made it/.test(live.textContent));
  NEU.bullet.close();
}

/* ═══ 6. A6 — lazy where nothing draws from the image ════════════*/
console.log('\n6. the images nothing draws from wait until needed (A6)');
{
  const { doc } = boot();
  const lazy = i => i.getAttribute('loading') === 'lazy' && i.getAttribute('decoding') === 'async';
  const contact = [...doc.querySelectorAll('#contact img')];
  ok('every image in #contact is lazy and async (' + contact.length + ')',
     contact.length > 0 && contact.every(lazy));
  const overlay = [...doc.querySelectorAll('#panel img, #tbox img')];
  ok('the hidden overlay images are lazy and async (' + overlay.length + ')',
     overlay.length > 0 && overlay.every(lazy));
  const eager = [...doc.querySelectorAll('#top img, .boot img, #sword img, #chips img, #swcue img')];
  ok('nothing in the hero, the boot screen or the HUD is lazy (' + eager.length + ')',
     eager.every(i => i.getAttribute('loading') !== 'lazy'));
}

/* ═══ 7. A9 — the CDN preconnect ══════════════════════════════════*/
console.log('\n7. the CDN preconnect (A9)');
{
  const { doc } = boot();
  const pc = doc.querySelector('link[rel="preconnect"][href="https://cdn.jsdelivr.net"]');
  ok('a preconnect to cdn.jsdelivr.net exists', !!pc);
  ok('it is crossorigin, like the font preconnect', !!pc && pc.hasAttribute('crossorigin'));
}

/* ═══ 8. I5 — the colophon line ════════════════════════════════════*/
console.log('\n8. the colophon says what is kept (I5)');
{
  const { doc } = boot();
  const lines = [...doc.querySelectorAll('.colophon')]
    .map(p => p.textContent.replace(/\s+/g, ' ').trim());
  ok('the colophon has the line, verbatim',
     lines.includes('no analytics, no cookies. your save stays in this browser.'));
}

/* ═══ 9. J4 — printing ════════════════════════════════════════════*/
console.log('\n9. printing gives the words, not the room (J4)');
{
  const block = mediaBody(CSS, 'print');
  ok('there is an @media print block', block !== null);
  const hides = sel => new RegExp('(^|[\\s,{])' + sel.replace('.', '\\.') + '(?![\\w-])')
                         .test(block || '');
  ok('the print block hides .glass', hides('.glass'));
  for (const sel of ['.stars', '.ctl', '.bh', '.dk', '.eng', '.quiz', '.fnf', '.craft',
                     '.polt', '.shop', '.deck', '.tpad', '.tbox'])
    ok('the print block hides ' + sel, hides(sel));
  ok('the hiding is display:none', /display:\s*none/.test(block || ''));
  ok('the one line is body::after, in-tone, 16px',
     /body::after\s*\{[^}]*content:\s*'\.\.\.printed\. the stars did not come with it\.'/
       .test(block || '') &&
     /body::after\s*\{[^}]*font-size:\s*16px/.test(block || ''));
}

console.log('\n' + (fail === 0 ? `ALL PASS (${pass})` : `${fail} FAILED, ${pass} passed`));
process.exit(fail === 0 ? 0 : 1);
