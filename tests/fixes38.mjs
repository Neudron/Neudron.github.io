/* fixes38.mjs — scene timers that can outlive their scene (F4), and the
   one-line error the page shows when something throws (J5).
   Run: node tests/fixes38.mjs

   F4. A timer that acts on scene state was a bare setTimeout, so one
   scheduled in a scene could fire after that scene had ended and write
   into whatever was on screen by then. Each stale test here starts a
   scene, ends it inside the timer's window, waits past the window and
   checks the stale callback did nothing. Each one has a positive
   control with no teardown, so a check that always passes cannot hide
   behind the teardown.

   J5. An uncaught error or an unhandled rejection shows ONE line at the
   bottom of the page, in the game's voice, with a reload button. The
   error's own text is never shown, and it is never read as markup.

   Boot: the page's own index.html, its classic scripts in page order
   (comments stripped, as fixes26 does), and the <noscript> fallback
   removed (see fixes30). The IntersectionObserver is driven by hand:
   enter() and leave() fire the one observer sans.js watches (#contact). */

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const HTML = read('index.html');
const CSS = read('css/style.css');
const SANS = read('js/game/sans.js');

/* The page's classic scripts, in the order index.html loads them. */
const MODULES = [...HTML.replace(/<!--[\s\S]*?-->/g, '')
                        .matchAll(/<script src="js\/([^"]+)"><\/script>/g)].map(m => m[1]);

/* The body of the block that opens at `at`, counting depth, so a nested
   rule does not end the search early. */
function bodyOf(src, at) {
  const open = src.indexOf('{', at);
  let d = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}' && --d === 0) return src.slice(open + 1, i);
  }
  return '';
}

/* ── a recording AudioContext ────────────────────────────────────
   sans.js plays voice blips through Web Audio; the stub keeps the
   calls so nothing needs a sound device. */
function audioStub(w) {
  class Param {
    constructor(v) { this.value = v; this.log = []; }
    setValueAtTime(v) { this.value = v; return this; }
    exponentialRampToValueAtTime(v) { this.value = v; return this; }
    linearRampToValueAtTime(v, t) { this.log.push({ v, t }); this.value = v; return this; }
    cancelScheduledValues() { return this; }
  }
  class Node {
    constructor(ctx) { this.ctx = ctx; this.out = []; }
    connect(d) { this.out.push(d); return d; }
    disconnect() {}
  }
  class Gain extends Node {
    constructor(ctx) { super(ctx); this.gain = new Param(1); ctx.gains.push(this); }
  }
  class Osc extends Node {
    constructor(ctx) {
      super(ctx);
      this.type = ''; this.frequency = new Param(0); this.detune = new Param(0);
    }
    start(t) { this.ctx.notes.push({ t, f: this.frequency.value }); }
    stop() {}
  }
  class Src extends Node {
    constructor(ctx) { super(ctx); this.buffer = null; this.playbackRate = new Param(1); }
    start(t) { this.ctx.notes.push({ t, f: 0 }); }
    stop() {}
  }
  class Filt extends Node {
    constructor(ctx) {
      super(ctx);
      this.type = ''; this.frequency = new Param(0); this.Q = new Param(1);
    }
  }
  class AC {
    constructor() {
      this.state = 'running'; this.currentTime = 0; this.sampleRate = 44100;
      this.destination = new Node(this); this.notes = []; this.gains = [];
      w.__actx = this;
    }
    resume() { this.state = 'running'; return Promise.resolve(); }
    createOscillator() { return new Osc(this); }
    createGain() { return new Gain(this); }
    createBufferSource() { return new Src(this); }
    createBiquadFilter() { return new Filt(this); }
    createBuffer(ch, n) { return { getChannelData: () => new Float32Array(n) }; }
  }
  w.AudioContext = AC;
  w.webkitAudioContext = AC;
}

/* The page's own script order. main.js is in it: J5 lives there. */
function boot({ save } = {}) {
  const dom = new JSDOM(HTML, { pretendToBeVisual: true, url: 'https://www.neu.ac/',
                                runScripts: 'outside-only' });
  const w = dom.window;
  w.document.querySelectorAll('noscript').forEach(n => n.remove());
  if (save) w.localStorage.setItem('neu.save.v1', JSON.stringify(save));

  /* Every observer the page makes is kept, so enter()/leave() can fire
     the one sans.js watches and nothing else. */
  const obs = [];
  w.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; this.els = []; obs.push(this); }
    observe(el) { this.els.push(el); }
    unobserve() {}
    disconnect() {}
  };
  w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
  audioStub(w);
  w.HTMLMediaElement.prototype.play = () => Promise.resolve();
  const noop = () => {};
  /* Must not be null: engine.js and both bosses bail out of their whole
     module if getContext fails. (neu-verify section 2) */
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

  const contact = () => obs.find(o => o.els.some(el => el.id === 'contact'));
  return {
    w, NEU: w.NEU, doc: w.document,
    enter: () => { const o = contact(); if (o) o.cb([{ isIntersecting: true }]); },
    leave: () => { const o = contact(); if (o) o.cb([{ isIntersecting: false }]); },
  };
}

const press = (w, k) => w.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
const wait = ms => new Promise(r => setTimeout(r, ms));

/* Five taps on the dog hand over the hammer. The fifth one also starts
   the hammer narration, which is 1500ms of scene timer. */
async function getHammer(doc, NEU) {
  const dog = doc.getElementById('dogBtn');
  for (let i = 0; i < 5; i++) { dog.click(); await wait(10); }
  return NEU.sans.hasHammer === true;
}

/* ═══ 1. F4 — the hammer narration does not outlive the hammer ═══════*/
console.log('\n1. F4 — the hammer narration is not said after the light is smashed');
{
  /* Control: nothing intervenes, so the narration plays. Total 3 is the
     narration; the dog's own line is total 1. */
  const { NEU, doc } = boot();
  const totals = [];
  NEU.talkWatch((i, t) => totals.push(t));
  const got = await getHammer(doc, NEU);
  await wait(1700);
  ok('control: five talks hand over the hammer', got === true);
  ok('control: the narration plays when nothing intervenes', totals.includes(3));
}
{
  const { NEU, doc } = boot();
  const totals = [];
  NEU.talkWatch((i, t) => totals.push(t));
  const got = await getHammer(doc, NEU);
  ok('stale: the hammer is in hand, narration pending', got === true);
  NEU.switchHook();                       // hit the jammed light: the hammer is spent
  ok('stale: the light is smashed and the hammer is gone', NEU.sans.hasHammer === false);
  await wait(1700);
  ok('>>> the narration about the hammer is not said after it is spent <<<',
     !totals.includes(3));
}

/* ═══ 2. F4 — ending the blackout cancels the grey room's opening ════*/
console.log('\n2. F4 — the grey room does not open after the blackout has ended');
{
  const { NEU, doc } = boot();
  await getHammer(doc, NEU);
  NEU.switchHook();                       // smash: the grey room is due in 750ms
  await wait(950);
  ok('control: with no teardown the grey room opens', NEU.dark.running === true);
}
{
  const { NEU, doc } = boot();
  await getHammer(doc, NEU);
  NEU.switchHook();                       // smash: the grey room is due in 750ms
  NEU.fitClicker();                       // the blackout ends first
  await wait(950);
  ok('>>> the grey room stays shut after the blackout ended <<<',
     NEU.dark.running !== true);
}

/* ═══ 3. F4 — going to sleep cancels the walk-up scroll ══════════════*/
console.log('\n3. F4 — the walk-up does not scroll a page whose sans is already asleep');
{
  const { w, NEU } = boot();
  const calls = [];
  w.scrollTo = (...a) => calls.push(a);
  NEU.fitClicker();                       // arms the sleep; the walk-up is due at 2600ms
  await wait(100);
  NEU.devSleep();                         // he falls asleep before the walk-up fires
  calls.length = 0;
  await wait(2800);
  ok('he is asleep', NEU.sans.asleep === true);
  ok('>>> the walk-up does not scroll the page after he is asleep <<<', calls.length === 0);
}
{
  const { w, NEU } = boot();
  const calls = [];
  w.scrollTo = (...a) => calls.push(a);
  NEU.fitClicker();
  await wait(2800);
  ok('control: with no sleep the walk-up scrolls to the top', calls.length >= 1);
}

/* ═══ 4. F4 — a door panel reopened inside its fade stays open ═══════*/
console.log('\n4. F4 — a panel reopened while it is still fading stays open');
{
  const { w, NEU, doc } = boot();
  const panel = doc.getElementById('panel');
  NEU.devOpenRoom();                      // unlocks the door and opens the panel
  ok('the panel opens', panel.hidden === false);
  press(w, 'Escape');                     // closes it: a 420ms fade before hidden
  await wait(100);
  NEU.tryDoor();                          // the door is open, so this opens the panel again
  await wait(600);
  ok('>>> the panel is still open after the old fade would have ended <<<',
     panel.hidden === false);
}
{
  const { w, NEU, doc } = boot();
  const panel = doc.getElementById('panel');
  NEU.devOpenRoom();
  press(w, 'Escape');
  await wait(600);
  ok('control: a panel closed and left alone ends up hidden', panel.hidden === true);
}

/* ═══ 5. F4 — the deck does not reopen after you have closed it ═════*/
console.log('\n5. F4 — the dock\'s pending deck opening does not reopen a deck you closed');
async function dockIt(NEU, doc) {
  NEU.devTake();                          // sleep, console taken, charge filled
  doc.getElementById('tv').click();       // the flight: 760ms, then the 420ms handoff
  const t0 = Date.now();
  while (!NEU.sans.docked && Date.now() - t0 < 3000) await wait(10);
  return NEU.sans.docked === true;
}
{
  const { NEU, doc } = boot();
  const docked = await dockIt(NEU, doc);
  ok('the console docks', docked === true);
  doc.getElementById('tv').click();       // a hand-open, inside the 420ms window
  ok('the hand-open opens the deck', NEU.deck.running === true);
  NEU.deck.close();
  await wait(600);
  ok('>>> the deck stays closed past the handoff window <<<', NEU.deck.running !== true);
}
{
  const { NEU, doc } = boot();
  const docked = await dockIt(NEU, doc);
  ok('control: the console docks again on a fresh page', docked === true);
  await wait(600);
  ok('control: with no hand-open the deck opens on its own', NEU.deck.running === true);
}

/* ═══ 6. J5 — one line when something breaks ═════════════════════════*/
console.log('\n6. J5 — one in-tone line when an error is thrown');
{
  const { w, doc } = boot();
  ok('no error line before anything breaks', doc.querySelectorAll('.errline').length === 0);
  const SECRET = 'SECRET_ZQ7 at /js/game/sans.js:1482';
  w.dispatchEvent(new w.ErrorEvent('error', { message: SECRET, error: new w.Error(SECRET) }));
  const lines = doc.querySelectorAll('.errline');
  ok('>>> one error puts one line on the page <<<', lines.length === 1);
  const line = lines[0];
  ok('the line has role="status"', !!line && line.getAttribute('role') === 'status');
  ok('it says it is not your fault',
     !!line && /something broke\. it's not your fault\. reload\?/.test(line.textContent));
  const btn = line && line.querySelector('button');
  ok('there is a reload button', !!btn && /reload/.test(btn.textContent));

  w.dispatchEvent(new w.ErrorEvent('error', { message: 'second', error: new w.Error('second') }));
  w.dispatchEvent(new w.ErrorEvent('error', { message: 'third', error: new w.Error('third') }));
  ok('>>> a second and third error add no more lines <<<', doc.querySelectorAll('.errline').length === 1);

  ok('the error message is not on the page',
     !doc.body.textContent.includes(SECRET) && !doc.documentElement.outerHTML.includes(SECRET));
}
{
  /* The message is text. Markup in it must not be parsed into the page. */
  const { w, doc } = boot();
  w.dispatchEvent(new w.ErrorEvent('error', {
    message: '<img id="pwned" src="x"> boom', error: new w.Error('boom') }));
  ok('>>> a message full of markup is shown as nothing, not parsed <<<',
     doc.getElementById('pwned') === null);
}
{
  /* An unhandled rejection is the other way a page breaks. It shares the
     same single line. */
  const { w, doc } = boot();
  const rej = new w.Event('unhandledrejection');
  rej.reason = new w.Error('REJ_SECRET');
  w.dispatchEvent(rej);
  const rej2 = new w.Event('unhandledrejection');
  rej2.reason = new w.Error('REJ_SECRET_2');
  w.dispatchEvent(rej2);
  ok('>>> an unhandled rejection shows the line, once <<<', doc.querySelectorAll('.errline').length === 1);
  ok('its reason is not on the page',
     !doc.documentElement.outerHTML.includes('REJ_SECRET'));
}
{
  /* A sound the browser refuses is not a broken page: play() rejects, and
     every sound here has a synth fallback. A real rejection still shows. */
  const { w, doc } = boot();
  const refused = new w.Event('unhandledrejection');
  refused.reason = new w.DOMException('blocked', 'NotAllowedError');
  w.dispatchEvent(refused);
  ok('>>> a refused sound is not a broken page <<<', doc.querySelectorAll('.errline').length === 0);
  const real = new w.Event('unhandledrejection');
  real.reason = new w.Error('a real bug');
  w.dispatchEvent(real);
  ok('a real rejection still shows the line', doc.querySelectorAll('.errline').length === 1);
}

/* ═══ 7. J5 — the style is one block, appended, on the page's tokens ═*/
console.log('\n7. J5 — the error line is styled by one block at the end of style.css');
{
  const at = CSS.indexOf('\n.errline {');
  const portrait = CSS.indexOf('\nbody.is-portrait-fight::before {');
  ok('the error line has a rule block', at > 0);
  ok('it is appended after the last block that was there before', at > portrait && portrait > 0);
  const blk = at > 0 ? bodyOf(CSS, at) : '';
  ok('16px text', /font(?:-size)?:\s*(?:400\s+)?16px/.test(blk));
  ok('the page\'s bone on void tokens', /color:\s*var\(--bone\)/.test(blk) &&
     /background:\s*var\(--void\)/.test(blk));
  ok('a 16px gutter at the sides', /padding:\s*16px/.test(blk));
  ok('pinned to the bottom of the viewport',
     /position:\s*fixed/.test(blk) && /bottom:\s*0/.test(blk));
  const z = +((blk.match(/z-index:\s*(\d+)/) || [])[1]);
  const dz = +((bodyOf(CSS, CSS.indexOf('\n.tbox {')).match(/z-index:\s*(\d+)/) || [])[1]);
  ok(`>>> z-index ${z} sits below the dialogue box (${dz}) <<<`, z > 0 && dz > z);
  const tail = at > 0 ? CSS.slice(at) : '';
  ok('reduced motion turns the slide off',
     /@media \(prefers-reduced-motion: reduce\)\s*\{[^@]*\.errline\s*\{[^}]*animation:\s*none/.test(tail));
  ok('the button has a 44px target', /min-height:\s*44px/.test(blk) || /\.errline button \{[^}]*min-height:\s*44px/.test(tail));
}

/* ═══ 8. F4 — the helper is the one used, with the one clear-all ═════*/
console.log('\n8. F4 — the scene helper exists and the migrated timers use it');
{
  ok('later(fn, ms) is defined in sans.js', /\n  function later\(fn, ms\) \{/.test(SANS));
  ok('cancelLater() is defined in sans.js', /\n  function cancelLater\(\) \{/.test(SANS));
  ok('the blackout end cancels the scene timers',
     /function fitClicker\(\) \{[\s\S]*?cancelLater\(\);/.test(SANS));
  ok('the hammer hand-off is cancelled by the smash',
     /function smashLight\(\) \{[\s\S]*?cancelLater\(\);/.test(SANS));
  ok('going to sleep cancels the walk-up',
     /function goToSleep\(\) \{[\s\S]*?cancelLater\(\);/.test(SANS));
}

console.log(fail ? `${fail} FAILED, ${pass} passed` : `ALL PASS (${pass})`);
process.exit(fail ? 1 : 0);
