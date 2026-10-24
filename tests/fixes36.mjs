/* fixes36.mjs — the crack's tap target, focus for the two overlays, and
   the touch carry, codified.
   Run: node tests/fixes36.mjs

   C5  The crack is ten pixels, and a clip-path clips the element's hit
       box along with its paint. The shape stays clipped, but on ::after,
       so the element itself is never clipped; ::before is a transparent
       24px box centred on it, which is what a finger actually lands on
       (WCAG 2.5.8). jsdom has no layout engine, so these are read off the
       stylesheet text rather than measured.

   C11 The stall and the settings panel take focus when they open, keep
       Tab and Shift+Tab inside themselves, and hand focus back to the
       element that opened them. A keyboard player who opened a panel from
       the gear should not land at the top of the page when it closes.

   C6  A finger or a pen picks the sword or the key up with one tap, and
       no held drag. Driven with PointerEvents of pointerType 'touch' and
       'pen'. The mouse path is pinned as well: a press and a release never
       carries anything. The mouse has no single-pointer alternative to a
       held drag, and this suite records that rather than changing it.

   The boot is the page's own index.html with the <noscript> fallback
   removed, and the page's own script order, as fixes30 does. Each
   IntersectionObserver is recorded, so the contact section can be
   scrolled into view by hand; the observer never fires on its own. */

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const wait = ms => new Promise(r => setTimeout(r, ms));

const HTML = read('index.html');
const CSS  = read('css/style.css');
const SANS = read('js/game/sans.js');

/* ── a recording AudioContext ────────────────────────────────────
   Copied from fixes30. The modules create nodes at load and the
   sound effects need the methods to exist, not to make a sound. */
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

/* The page's own script order, read from index.html rather than copied
   by hand. A hand copy went stale: fixes30's list has no act4/shop.js,
   so the stall never existed in its boot. The page/ scripts are the
   scene and the starfield, which need WebGL and a real layout, and
   fixes30 leaves them out for the same reason. */
const MODULES = [...HTML.matchAll(/<script src="js\/([^"]+)"/g)]
  .map(m => m[1])
  .filter(f => !/^page\//.test(f));

function boot() {
  const dom = new JSDOM(HTML, { pretendToBeVisual: true, url: 'https://www.neu.ac/',
                                runScripts: 'outside-only' });
  const w = dom.window;
  w.document.querySelectorAll('noscript').forEach(n => n.remove());

  /* Every observer the page creates, so the contact section can be
     "scrolled into view" by calling the right one by hand. */
  const observers = [];
  w.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; observers.push(this); }
    observe(el) { this.el = el; }
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
  /* Every element reports the same real box, so a point of (120,120) is
     "over sans" and (500,500) is not. */
  w.Element.prototype.getBoundingClientRect = () =>
    ({ left: 100, top: 100, right: 146, bottom: 146, width: 46, height: 46, x: 100, y: 100 });

  for (const f of MODULES) {
    const p = path.join(ROOT, 'js', f);
    if (!fs.existsSync(p)) { console.log('  !! missing ' + f); continue; }
    try { w.eval(fs.readFileSync(p, 'utf8')); }
    catch (e) { console.log('  !! ' + f + ': ' + e.message); }
  }

  return {
    w, NEU: w.NEU, doc: w.document,
    enterContact() {
      const c = w.document.getElementById('contact');
      observers.filter(o => o.el === c).forEach(o => o.cb([{ isIntersecting: true, target: c }]));
    }
  };
}

const press = (w, k, mods, target) => {
  const e = new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...(mods || {}) });
  target.dispatchEvent(e);
  return e;
};
/* A key press goes to whatever has focus, so put focus where the
   keyboard would have it before pressing. */
const keyOn = (w, el, k, mods) => { el.focus(); return press(w, k, mods, el); };

/* A PointerEvent of the given pointerType. jsdom has the real class, so
   it is used; the MouseEvent fallback exists only so the suite still
   runs on an older jsdom that lacks PointerEvent. */
function pev(w, type, el, o) {
  o = o || {};
  const init = { bubbles: true, cancelable: true,
                 pointerId:   o.id   === undefined ? 1 : o.id,
                 pointerType: o.type === undefined ? 'touch' : o.type,
                 clientX:     o.x    === undefined ? 0 : o.x,
                 clientY:     o.y    === undefined ? 0 : o.y };
  let e;
  if (typeof w.PointerEvent === 'function') {
    e = new w.PointerEvent(type, init);
  } else {
    e = new w.MouseEvent(type, init);
    Object.defineProperty(e, 'pointerId',   { value: init.pointerId });
    Object.defineProperty(e, 'pointerType', { value: init.pointerType });
  }
  el.dispatchEvent(e);
  return e;
}

/* Scroll the contact section into view and click sans, then outwait the
   spawn choreography (1560ms in sans.js). Leaves the sword stuck. */
async function reachStuck(ctx) {
  ctx.enterContact();
  ctx.doc.getElementById('sansBtn').click();
  await wait(1700);
}

/* ── tiny CSS reader ─────────────────────────────────────────────
   A rule is a selector list and a body. The regex takes innermost
   braces only, which is all this sheet needs: nothing wraps the crack
   in an @media block, and @keyframes stops are read as rules too. */
function rulesOf(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(src))) out.push({ sels: m[1].trim().split(/\s*,\s*/), body: m[2] });
  return out;
}
const R = rulesOf(CSS);
const ruleAt = sel => R.find(r => r.sels.indexOf(sel) !== -1);
/* The value of one declaration, anchored so that `left` cannot match
   inside `right` and `background` cannot match `background-color`. */
const decl = (body, prop) => {
  const m = (body || '').match(new RegExp('(?:^|[;{\\s])' + prop + '\\s*:\\s*([^;]+)'));
  return m ? m[1].trim() : null;
};
const px = v => (v && /px$/.test(v) ? parseFloat(v) : NaN);

/* ═══ 1. C5 — the crack's tap target ═════════════════════════════
   The paint (shape, background, glow) moves to ::after, the element is
   left unclipped, and ::before becomes the 24px box a finger lands on.
   Every existing state keeps its look: .is-in, [data-n="1"],
   [data-n="2"], .is-hit and .is-portal. */
console.log('\n1. the crack: the paint moves to ::after, the element is not clipped');
{
  const base   = ruleAt('.crack');
  const after  = ruleAt('.crack::after');
  const before = ruleAt('.crack::before');
  ok('.crack, .crack::before and .crack::after all have rules', !!(base && before && after));

  const elementRules = R.filter(r => r.sels.some(s =>
    /^\.crack(?![\w-])/.test(s) && !/::(before|after)$/.test(s)));
  ok('the element has rules for its states', elementRules.length > 0);
  ok('>>> no rule clips the element itself, in any state <<<',
     elementRules.every(r => !/clip-path\s*:/.test(r.body)));
  ok('the element is transparent, so no black square sits under the target',
     !!base && decl(base.body, 'background') === 'transparent');

  ok('::after carries the polygon clip-path', !!after &&
     /^polygon\(/.test(decl(after.body, 'clip-path') || ''));
  ok('::after carries the black paint and the glow', !!after &&
     decl(after.body, 'background') === '#000' && decl(after.body, 'box-shadow') !== null);

  const hit = before ? before.body : '';
  ok('::before is at least 24 x 24 CSS px (WCAG 2.5.8)',
     px(decl(hit, 'width')) >= 24 && px(decl(hit, 'height')) >= 24);
  ok('::before has no clip-path', !!before && !/clip-path\s*:/.test(hit));
  ok('::before is transparent (or paints nothing)', !!before &&
     (decl(hit, 'background') === null || decl(hit, 'background') === 'transparent'));
  ok('::before is centred on the crack', !!before &&
     decl(hit, 'left') === '50%' && decl(hit, 'top') === '50%' &&
     /translate\(\s*-50%\s*,\s*-50%\s*\)/.test(hit));

  ok('.is-in still fades the crack in', decl((ruleAt('.crack.is-in') || {}).body, 'opacity') === '1');
  ok('[data-n="1"] still scales the element 1.5',
     decl((ruleAt('.crack[data-n="1"]') || {}).body, 'transform') === 'scale(1.5)');
  ok('[data-n="2"] still scales the element 2.4',
     decl((ruleAt('.crack[data-n="2"]') || {}).body, 'transform') === 'scale(2.4)');
  ok('[data-n="2"] still glows, now on ::after',
     decl((ruleAt('.crack[data-n="2"]::after') || {}).body, 'box-shadow') === '0 0 16px rgba(160,80,220,.9)');
  ok('.is-hit still runs the hit flicker',
     /crackHit/.test(decl((ruleAt('.crack.is-hit') || {}).body, 'animation') || ''));

  const portal = ruleAt('.crack.is-portal');
  ok('.is-portal keeps its 54px size and its spin',
     !!portal && px(decl(portal.body, 'width')) === 54 &&
     /crackSpin/.test(decl(portal.body, 'animation') || ''));
  const portalAfter = ruleAt('.crack.is-portal::after');
  ok('.is-portal clips its round shape on ::after',
     /^circle\(50%\)$/.test(decl((portalAfter || {}).body, 'clip-path') || ''));
  ok('.is-portal paints its gradient on ::after',
     /radial-gradient/.test(decl((portalAfter || {}).body, 'background') || ''));
}

/* ═══ 2. C11 — the stall: focus moves in, wraps, and goes back ═══ */
console.log('\n2. the stall: focus moves in, wraps, and goes back to the opener');
{
  const { w, NEU, doc } = boot();
  const board  = doc.getElementById('shop');
  const quit   = doc.getElementById('shopQuit');
  const opener = doc.getElementById('settBtn');
  const stops = () => Array.prototype.slice.call(board.querySelectorAll('button:not(:disabled)'));

  opener.focus();
  NEU.shop.open(0);
  ok('open: the board is up', !board.hidden && NEU.shop.active === true);
  ok('>>> open: focus is inside the board <<<', board.contains(doc.activeElement));
  ok('open: focus is on the first row', doc.activeElement === stops()[0]);
  ok('the quit button is the last stop', stops()[stops().length - 1] === quit);

  const tab = keyOn(w, stops()[stops().length - 1], 'Tab');
  ok('>>> Tab on the last stop wraps to the first <<<',
     doc.activeElement === stops()[0] && tab.defaultPrevented);
  const back = keyOn(w, stops()[0], 'Tab', { shiftKey: true });
  ok('>>> Shift+Tab on the first stop wraps to the last <<<',
     doc.activeElement === quit && back.defaultPrevented);
  const mid = keyOn(w, stops()[2], 'Tab');
  ok('a Tab in the middle of the board moves one stop on',
     doc.activeElement === stops()[3] && mid.defaultPrevented);
  const midBack = keyOn(w, stops()[2], 'Tab', { shiftKey: true });
  ok('a Shift+Tab in the middle moves one stop back',
     doc.activeElement === stops()[1] && midBack.defaultPrevented);

  keyOn(w, stops()[1], 'Escape');
  ok('>>> Esc closes the board <<<', board.hidden === true && NEU.shop.active === false);
  ok('>>> and focus goes back to the opener <<<', doc.activeElement === opener);

  opener.focus();
  NEU.shop.open(1);
  ok('reopened: focus is on the first row again', doc.activeElement === stops()[0]);
  quit.click();
  ok('>>> the quit button closes it, and focus goes back <<<',
     board.hidden === true && doc.activeElement === opener);

  opener.focus();
  NEU.shop.open(0);
  stops()[3].focus();
  NEU.shop.open(0);
  keyOn(w, stops()[3], 'Escape');
  ok('a second open while up does not overwrite the remembered opener',
     doc.activeElement === opener);

  const gone = doc.createElement('button');
  doc.body.appendChild(gone);
  gone.focus();
  NEU.shop.open(0);
  gone.remove();
  keyOn(w, stops()[0], 'Escape');
  ok('an opener that has left the page is not focused, and nothing throws',
     !doc.contains(gone) && doc.activeElement !== gone && NEU.shop.active === false);
}

/* ═══ 3. C11 — the settings panel: the same contract ═══════════════ */
console.log('\n3. the settings panel: focus moves in, wraps, and goes back to the opener');
{
  const { w, NEU, doc } = boot();
  const panel = doc.querySelector('.sett');
  const mute  = doc.getElementById('muteToggle');
  const gear  = doc.getElementById('settBtn');
  const stops = () => Array.prototype.slice.call(
    panel.querySelectorAll('button:not(:disabled), input:not(:disabled)'));

  mute.focus();
  NEU.settings.open();
  ok('open: the panel is up', !panel.hidden && NEU.settings.open_ === true);
  ok('>>> open: focus is inside the panel <<<', panel.contains(doc.activeElement));
  ok('open: focus is on the first switch, as it always was',
     doc.activeElement === doc.getElementById('settShake'));
  const list = stops();
  ok('the trap runs in DOM order: the close button first, the slider last',
     list[0].getAttribute('aria-label') === 'close settings' &&
     list[list.length - 1].id === 'settMusic');

  const tab = keyOn(w, list[list.length - 1], 'Tab');
  ok('>>> Tab on the last control wraps to the first <<<',
     doc.activeElement === list[0] && tab.defaultPrevented);
  const back = keyOn(w, list[0], 'Tab', { shiftKey: true });
  ok('>>> Shift+Tab on the first control wraps to the last <<<',
     doc.activeElement === list[list.length - 1] && back.defaultPrevented);
  /* quest.js binds Tab to the quest log on window, and the panel does
     not lock it. Before the trap owned Tab, a press in the middle of the
     panel opened the quest log behind it and left focus where it was. */
  const questLog = doc.getElementById('quest');
  /* Start shut. The wrap presses above toggled the log open and shut,
     so without this reset the check could pass on the parity of those
     toggles rather than on what the middle press did. */
  NEU.quest.hide();
  const mid = keyOn(w, list[3], 'Tab');
  ok('a Tab in the middle moves one control on', doc.activeElement === list[4] && mid.defaultPrevented);
  ok('>>> and does not open the quest log behind the panel <<<',
     !questLog.classList.contains('is-open'));
  const midBack = keyOn(w, list[3], 'Tab', { shiftKey: true });
  ok('a Shift+Tab in the middle moves one control back',
     doc.activeElement === list[2] && midBack.defaultPrevented);

  keyOn(w, list[1], 'Escape');
  ok('>>> Esc closes the panel <<<', panel.hidden === true && NEU.settings.open_ === false);
  ok('>>> and focus goes back to the element that opened it, not the gear <<<',
     doc.activeElement === mute);

  mute.blur();
  NEU.settings.open();
  NEU.settings.close();
  ok('opened with nothing focused: close lands on the gear', doc.activeElement === gear);

  const temp = doc.createElement('button');
  doc.body.appendChild(temp);
  temp.focus();
  NEU.settings.open();
  temp.remove();
  NEU.settings.close();
  ok('an opener that has left the page: focus falls back to the gear',
     doc.activeElement === gear);
}

/* ═══ 4. C6 — the touch carry, codified ══════════════════════════
   On a finger or a pen the sword is picked up by one tap; the press
   takes it into held, and the lift that closes that tap must not drop
   it. The sword then wears is-carried and rides bottom-centre. */
for (const type of ['touch', 'pen']) {
  console.log('\n4.' + (type === 'touch' ? '1' : '2') +
              ' a ' + type + ' tap picks the sword up, with no held drag');
  const ctx = boot();
  const { w, NEU, doc } = ctx;
  const sword = doc.getElementById('sword');
  await reachStuck(ctx);
  ok('[' + type + '] the sword is stuck in the top of the page', NEU.sans.state === 'stuck');

  pev(w, 'pointerdown', sword, { type, id: 41, x: 120, y: 120 });
  ok('[' + type + '] the press alone takes it into held', NEU.sans.state === 'held');
  pev(w, 'pointerup', doc.body, { type, id: 41, x: 120, y: 120 });
  ok('[' + type + '] the lift that closes the pickup does NOT drop it', NEU.sans.state === 'held');
  ok('>>> [' + type + '] it is carried: is-carried is on <<<',
     sword.classList.contains('is-carried'));
  await wait(40);
  ok('[' + type + '] it rides in the hand, bottom-centre',
     sword.style.transform.indexOf('translate3d(' + (w.innerWidth / 2) + 'px,' +
                                   (w.innerHeight - 76) + 'px') !== -1);
  pev(w, 'pointerup', doc.body, { type, id: 42, x: 500, y: 500 });
  ok('[' + type + '] a later tap that misses sans sends it home',
     NEU.sans.state === 'fly' && !sword.classList.contains('is-carried'));
}

for (const type of ['touch', 'pen']) {
  console.log('\n4.3 a ' + type + ' tap picks the key up, and a second tap drops it');
  const ctx = boot();
  const { w, NEU, doc } = ctx;
  const kel = doc.getElementById('keyObj');
  NEU.devSkip();
  await wait(40);
  ok('[' + type + '] the key is parked at rest', NEU.sans.keyState === 'rest');

  pev(w, 'pointerdown', kel, { type, id: 51, x: 300, y: 300 });
  ok('[' + type + '] the press takes the key into held', NEU.sans.keyState === 'held');
  pev(w, 'pointerup', doc.body, { type, id: 51, x: 300, y: 300 });
  ok('>>> [' + type + '] the stationary tap is a carry <<<',
     NEU.sans.keyState === 'carry' && NEU.sans.carried === true);
  ok('[' + type + '] the in-hand chip shows', doc.getElementById('keyChip').hidden === false);
  ok('[' + type + '] the key wears is-carried', kel.classList.contains('is-carried'));

  pev(w, 'pointerdown', kel, { type, id: 52, x: 300, y: 300 });
  pev(w, 'pointerup', doc.body, { type, id: 52, x: 300, y: 300 });
  ok('[' + type + '] a second stationary tap drops it',
     NEU.sans.keyState === 'thrown' && NEU.sans.carried === false);
}

console.log('\n4.4 the mouse: a press and a release never carries anything');
{
  const ctx = boot();
  const { w, NEU, doc } = ctx;
  const sword = doc.getElementById('sword');
  await reachStuck(ctx);
  pev(w, 'pointerdown', sword, { type: 'mouse', id: 61, x: 120, y: 120 });
  ok('[mouse] the press takes the sword into held', NEU.sans.state === 'held');
  ok('[mouse] and gives it no carried tell', !sword.classList.contains('is-carried'));
  pev(w, 'pointerup', doc.body, { type: 'mouse', id: 61, x: 500, y: 500 });
  ok('[mouse] a release off sans sends it home', NEU.sans.state === 'fly');
  ok('[mouse] and still no carried tell after the release',
     !sword.classList.contains('is-carried'));
}
{
  const ctx = boot();
  const { w, NEU, doc } = ctx;
  const kel = doc.getElementById('keyObj');
  NEU.devSkip();
  await wait(40);
  pev(w, 'pointerdown', kel, { type: 'mouse', id: 62, x: 300, y: 300 });
  pev(w, 'pointerup', doc.body, { type: 'mouse', id: 62, x: 300, y: 300 });
  ok('[mouse] a press and release on the key drops it, never carries it',
     NEU.sans.keyState === 'thrown' && NEU.sans.carried === false);
}

console.log('\n4.5 source-level: the tap-carry contract is in sans.js');
ok('tapCarry answers yes for touch and for pen',
   /if \(t === 'touch' \|\| t === 'pen'\) return true;/.test(SANS));
ok('tapCarry answers no for mouse', /if \(t === 'mouse'\) return false;/.test(SANS));
ok('the pickup pointerup is consumed by pointerId (grabTap && grabId !== null)',
   /grabTap && grabId !== null && e\.pointerId === grabId/.test(SANS));

console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `\nALL PASS (${pass})`);
process.exit(fail ? 1 : 0);
