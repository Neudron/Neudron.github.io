/* fixes19.mjs — the touch carry contract, for the sword and the key.
   Run: node fixes19.mjs   (needs jsdom)

   On a phone one finger cannot hold an object AND scroll the page, so
   both carries are STATES you tap into rather than holds you keep down.
   This suite drives the real pointer-event wiring with synthetic events
   and checks the state machine behind it:

     · the tap that PICKS UP must not also read as the tap that DROPS —
       they are the same gesture, one event apart
     · a carried thing pins to the SCREEN while the page scrolls under it
     · the modal dialogue box swallows taps meant as "advance the text"
     · a mouse keeps the old press-and-hold contract untouched

   matchMedia is stubbed to ALWAYS false — including (pointer: coarse).
   Deliberate: the contract must follow each gesture's pointerType, not
   a media query frozen at page load. If these tests only passed with a
   coarse stub, the fix would not be doing what it claims. */

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };

/* ── the fake page ────────────────────────────────────────────────*/
function boot() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { pretendToBeVisual: true, url: 'https://www.neu.ac/',
                                runScripts: 'outside-only' });
  const w = dom.window;

  const obs = [];
  w.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; obs.push(this); }
    observe(el) { this.el = el; }
    disconnect() {}
  };
  /* Always false, including (pointer: coarse). See the header: if the
     carry contract needed this stub to be TRUE it would still be the
     load-time query wearing a costume. */
  w.matchMedia = () => ({ matches: false, addListener(){}, addEventListener(){} });
  w.AudioContext = class {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    createOscillator() { return { type:'', frequency:{ setValueAtTime(){}, exponentialRampToValueAtTime(){} },
                                  connect(){}, start(){}, stop(){} }; }
    createGain() { return { gain:{ setValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(){} }; }
  };
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  const noop = () => {};
  w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {
    get(_, k) {
      if (k === 'canvas') return {};
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient')
        return () => ({ addColorStop: noop });
      if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      return typeof k === 'string' ? noop : undefined;
    },
    set() { return true; }
  });
  w.scrollTo = function () { w.__scrolled = (w.__scrolled || 0) + 1; };
  w.requestAnimationFrame = cb => w.setTimeout(() => cb(Date.now()), 0);

  /* Every element reports a real box; overSans() needs a rect that has
     edges, and (120,120) must be ON sans while (500,500) is not. */
  w.Element.prototype.getBoundingClientRect = function () {
    return { left: 100, top: 100, right: 146, bottom: 146, width: 46, height: 46, x: 100, y: 100 };
  };

  /* jsdom defines scrollY as a getter, so a plain assignment silently
     does nothing — and sans.js reads bare scrollY every frame it pins a
     carried thing to the screen. The suite owns it instead. */
  let _sy = 0;
  Object.defineProperty(w, 'scrollY', { get: () => _sy, configurable: true });

  for (const f of ['core/quest.js', 'core/save.js', 'game/sword.js', 'game/sans.js']) {
    const code = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
    try { w.eval(code); } catch (e) { console.log('  !! ' + f + ': ' + e.message); }
  }
  return { w, NEU: w.NEU,
           enter: () => obs.forEach(o => o.cb([{ isIntersecting: true }])),
           leave: () => obs.forEach(o => o.cb([{ isIntersecting: false }])),
           setScroll: y => { _sy = y; } };
}
const wait = ms => new Promise(r => setTimeout(r, ms));

/* Always dispatched on a real ELEMENT, never on window: a browser
   retargets pointer events to the element under the pointer, so
   e.target is always an Element. Dispatching on window would make
   e.target the Window and the tbox guard would be testing a case
   that cannot happen in a browser. */
function pev(w, type, el, o) {
  o = o || {};
  const e = new w.Event(type, { bubbles: true, cancelable: true });
  e.pointerId   = o.id   === undefined ? 1 : o.id;
  e.pointerType = o.type === undefined ? 'touch' : o.type;
  e.clientX     = o.x    === undefined ? 0 : o.x;
  e.clientY     = o.y    === undefined ? 0 : o.y;
  el.dispatchEvent(e);
  return e;
}

/* Walk one boot to the moment sans has thrown the sword into the top
   of the document: enter the contact section, click him, and outwait
   SP_GO (1560ms of spawn choreography). */
async function reachStuck(ctx) {
  ctx.enter();
  ctx.w.document.getElementById('sansBtn').click();
  await wait(1700);
}

/* ═══ 1. the pickup tap does not drop the sword ════════════════════
   THE regression. The pointerup that closes the pickup tap used to be
   read as a drop, so on any touch device the sword flew home the
   instant you lifted your finger and could never be carried at all.
   It must be consumed by pointerId, and the sword must then ride in
   the hand at bottom-centre. */
console.log('\n1. the pickup tap does not drop the sword');
{
  const ctx = boot();
  const { w, NEU } = ctx;
  const d = w.document;
  await reachStuck(ctx);
  ok('spawn lands the sword at stuck', NEU.sans.state === 'stuck');

  pev(w, 'pointerdown', d.getElementById('sword'), { id: 7, x: 120, y: 120 });
  ok('touch pickup puts it in held', NEU.sans.state === 'held');
  pev(w, 'pointerup', d.body, { id: 7, x: 120, y: 120 });
  ok('the closing pointerup does NOT drop it', NEU.sans.state === 'held');
  await wait(40);
  ok('it rides in the hand, bottom-centre',
     d.getElementById('sword').style.transform.indexOf('translate3d(512px,692px') !== -1);

/* ═══ 2. a carried sword is pinned to the screen ═══════════════════
   A held sword used to track only while the finger was down; once it
   became a carried STATE its position had to survive the page moving
   underneath it. No scroll listener exists — the loop re-derives the
   hand anchor every frame, and that is what these asserts watch. */
console.log('\n2. a carried sword is pinned to the screen');
  const t0 = d.getElementById('sword').style.transform;
  ctx.setScroll(400);
  await wait(40);
  ok('a 400px scroll leaves it exactly where it was',
     NEU.sans.state === 'held' && d.getElementById('sword').style.transform === t0);
  ctx.setScroll(900);
  await wait(40);
  ok('another 500px, still unchanged',
     d.getElementById('sword').style.transform === t0);

/* ═══ 3. a later tap on sans still swings ══════════════════════════
   Consuming the PICKUP tap must not eat the whole contract: the next
   deliberate tap over sans is a swing, as it always was. */
console.log('\n3. a later tap on sans still swings');
  pev(w, 'pointerup', d.body, { id: 9, x: 120, y: 120 });
  ok('the second tap lands the swing', NEU.sans.state === 'swing');
}

/* ═══ 4. a later stray tap still goes home ═════════════════════════
   The other half of the original CARRY fix: a tap that misses sans
   must still send the sword home, or the blade strands mid-scroll with
   no way to re-grab it. And going home clears the carried tell. */
console.log('\n4. a later stray tap still goes home');
{
  const ctx = boot();
  const { w, NEU } = ctx;
  const d = w.document;
  await reachStuck(ctx);
  pev(w, 'pointerdown', d.getElementById('sword'), { id: 3, x: 120, y: 120 });
  pev(w, 'pointerup', d.body, { id: 3, x: 120, y: 120 });
  ok('carried after the pickup tap', NEU.sans.state === 'held' &&
     d.getElementById('sword').classList.contains('is-carried'));
  pev(w, 'pointerup', d.body, { id: 4, x: 500, y: 500 });
  ok('a stray tap sends it home', NEU.sans.state === 'fly');
  ok('is-carried cleared on the way home',
     !d.getElementById('sword').classList.contains('is-carried'));
}

/* ═══ 5. the dialogue box is not a drop ════════════════════════════
   The hint that explains tap-to-carry opens the modal text box — and
   tapping THAT used to fall through to attempt() and flyHome(). The
   line teaching the mechanic was what made you drop the sword, on the
   very first pickup, for every phone player. */
console.log('\n5. the dialogue box is not a drop');
{
  const ctx = boot();
  const { w, NEU } = ctx;
  const d = w.document;
  const tbox = d.getElementById('tbox');
  await reachStuck(ctx);
  pev(w, 'pointerdown', d.getElementById('sword'), { id: 5, x: 120, y: 120 });
  ok('pickup holds', NEU.sans.state === 'held');
  ok('the carry hint opened the box', tbox.hidden === false);
  pev(w, 'pointerup', tbox, { id: 5, x: 130, y: 130 });
  ok('closing the pickup ON the box: still held', NEU.sans.state === 'held');
  pev(w, 'pointerup', tbox, { id: 6, x: 130, y: 130 });
  ok('a tap to advance the text never drops the sword', NEU.sans.state === 'held');
}

/* ═══ 6. desktop press-and-hold is unchanged ═══════════════════════
   One press-release on a mouse is a DROP wherever it happens — even
   over the dialogue box. That is why the tbox guard carries the
   grabTap prefix, and why no mouse gesture ever gains is-carried. */
console.log('\n6. desktop press-and-hold is unchanged');
{
  const ctx = boot();
  const { w, NEU } = ctx;
  const d = w.document;
  await reachStuck(ctx);
  pev(w, 'pointerdown', d.getElementById('sword'), { type: 'mouse', x: 120, y: 120 });
  ok('mouse pickup -> held', NEU.sans.state === 'held');
  pev(w, 'pointerup', d.body, { type: 'mouse', x: 500, y: 500 });
  ok('one release off-sans drops it', NEU.sans.state === 'fly');
  ok('the mouse path never gains the carried tell',
     !d.getElementById('sword').classList.contains('is-carried'));
}

/* ═══ 7. a tap picks the key up ════════════════════════════════════
   devSkip parks the key at rest without replaying the whole fight. On
   touch, a stationary tap on it must become the carried state — class,
   flag and in-hand chip all agreeing. */
console.log('\n7. a tap picks the key up');
{
  const ctx = boot();
  const { w, NEU } = ctx;
  const d = w.document;
  NEU.devSkip();
  await wait(40);
  ok('devSkip parks the key at rest', NEU.sans.keyState === 'rest');
  const kel = d.getElementById('keyObj');
  pev(w, 'pointerdown', kel, { x: 300, y: 400 });
  pev(w, 'pointerup', kel, { x: 300, y: 400 });
  ok('tap -> carry', NEU.sans.keyState === 'carry');
  ok('carried flag exposed', NEU.sans.carried === true);
  ok('is-carried on the element', kel.classList.contains('is-carried'));
  ok('the in-hand chip is showing', d.getElementById('keyChip').hidden === false);

/* ═══ 8. a carried key is pinned to the screen ══════════════════════
   THE fix that makes the door reachable on a phone at all: ky stayed a
   DOCUMENT coordinate, so a carried key slid off-screen the moment you
   scrolled towards the door. Now every frame rebuilds it from scrollY,
   so its SCREEN y is constant no matter how far you have scrolled. */
console.log('\n8. a carried key is pinned to the screen');
  await wait(40);
  const s1 = NEU.sans.keyScreenY;
  ctx.setScroll(500);
  await wait(40);
  ok('screen y steady across a 500px scroll',
     Math.abs(NEU.sans.keyScreenY - s1) < 2);
  ctx.setScroll(1100);
  await wait(40);
  ok('steady again at another scroll',
     Math.abs(NEU.sans.keyScreenY - s1) < 2);
  ok('pinned at hand height (692)', Math.abs(NEU.sans.keyScreenY - 692) < 2);

/* ═══ 9. a flick throws it ══════════════════════════════════════════
   Carry would be useless without a way out that aims: travel beyond
   TAP_SLOP is a throw even when weak, and throwing must clear every
   carried tell — including the chip, which is the uncarryKey fix. */
console.log('\n9. a flick throws it');
  pev(w, 'pointerdown', kel, { x: 200, y: 300 });
  pev(w, 'pointermove', d.body, { x: 200, y: 140 });
  await wait(15);
  pev(w, 'pointerup', d.body, { x: 200, y: 100 });
  ok('flick -> thrown', NEU.sans.keyState === 'thrown');
  ok('no longer carried', NEU.sans.carried === false);
  ok('pulse tell removed', !kel.classList.contains('is-carried'));
  await wait(600);                       // the chip's fade-out timer is 520ms
  ok('the in-hand chip went away', d.getElementById('keyChip').hidden === true);
}

/* ═══ 10. a stationary tap puts it down, it does not throw it ═══════
   The mirror of section 9: within TAP_SLOP and below THROW_MIN, a tap
   on a carried key is "put it down" — zero velocity, gravity takes it
   from the hand, and nothing stays lit as if you were still holding it. */
console.log('\n10. a stationary tap puts it down');
{
  const ctx = boot();
  const { w, NEU } = ctx;
  const d = w.document;
  NEU.devSkip();
  await wait(40);
  const kel = d.getElementById('keyObj');
  pev(w, 'pointerdown', kel, { x: 300, y: 400 });
  pev(w, 'pointerup', kel, { x: 300, y: 400 });
  pev(w, 'pointerdown', kel, { x: 300, y: 400 });
  pev(w, 'pointerup', kel, { x: 300, y: 400 });
  ok('put down: thrown with gravity from the hand',
     NEU.sans.keyState === 'thrown' && NEU.sans.carried === false);
  ok('is-carried gone', !kel.classList.contains('is-carried'));
  await wait(600);
  ok('chip hidden', d.getElementById('keyChip').hidden === true);
}

/* ═══ 11. the loop is replayable — run it twice ════════════════════
   Three dead ends in this repo's history were "works once". The whole
   pick-up / put-down / pick-up / flick cycle must produce identical
   states the second time, starting even from a key still mid-fall. */
console.log('\n11. the loop is replayable — run it twice');
{
  const ctx = boot();
  const { w, NEU } = ctx;
  const d = w.document;
  NEU.devSkip();
  await wait(40);
  const kel = d.getElementById('keyObj');
  const seq = [];
  async function tapPick() {
    pev(w, 'pointerdown', kel, { x: 300, y: 400 });
    pev(w, 'pointerup', kel, { x: 300, y: 400 });
    seq.push(NEU.sans.keyState);
    await wait(20);
  }
  async function flick() {
    pev(w, 'pointerdown', kel, { x: 200, y: 300 });
    pev(w, 'pointermove', d.body, { x: 200, y: 140 });
    await wait(15);
    pev(w, 'pointerup', d.body, { x: 200, y: 100 });
    seq.push(NEU.sans.keyState);
    await wait(20);
  }
  await tapPick();                       // cycle one: carry
  await tapPick();                       //          then put down
  ok('cycle one: pick up, put down', seq.join(',') === 'carry,thrown');
  await tapPick();                       // cycle two, from a falling key
  await flick();
  ok('cycle two identical: carry, flick-throw',
     seq.join(',') === 'carry,thrown,carry,thrown');
}

/* ═══ 12. the key on a mouse is unchanged ══════════════════════════
   kGrabTap gates the tap branch, so a mouse can never stumble into
   carry: stationary release is the old weak throw, drag-release the
   old strong one, and carried stays false throughout. */
console.log('\n12. the key on a mouse is unchanged');
{
  const ctx = boot();
  const { w, NEU } = ctx;
  const d = w.document;
  NEU.devSkip();
  await wait(40);
  const kel = d.getElementById('keyObj');
  pev(w, 'pointerdown', kel, { type: 'mouse', x: 300, y: 400 });
  pev(w, 'pointerup', kel, { type: 'mouse', x: 300, y: 400 });
  ok('stationary mouse release is a throw, never a carry',
     NEU.sans.keyState === 'thrown' && NEU.sans.carried === false);
  NEU.devSkip();                          // park it again for the drag
  await wait(40);
  pev(w, 'pointerdown', kel, { type: 'mouse', x: 200, y: 300 });
  pev(w, 'pointermove', d.body, { type: 'mouse', x: 200, y: 140 });
  await wait(15);
  pev(w, 'pointerup', d.body, { type: 'mouse', x: 200, y: 100 });
  ok('drag-release throws, as always', NEU.sans.keyState === 'thrown');
  ok('and the mouse never entered carry', NEU.sans.carried === false);
}

/* ═══ 13. the hint is said once, not every time ════════════════════
   tellCarry exists to teach an unguessable contract exactly once; if
   it fired on every pickup it would be spam wearing a personality. */
console.log('\n13. the hint is said once, not every time');
{
  const ctx = boot();
  const { w, NEU } = ctx;
  const d = w.document;
  const tbox = d.getElementById('tbox');
  NEU.devSkip();
  await wait(40);
  const kel = d.getElementById('keyObj');
  pev(w, 'pointerdown', kel, { x: 300, y: 400 });
  pev(w, 'pointerup', kel, { x: 300, y: 400 });
  ok('first pickup opens his mouth', tbox.hidden === false);
  tbox.hidden = true;                     // pretend the player dismissed it
  pev(w, 'pointerdown', kel, { x: 300, y: 400 });   // put it down
  pev(w, 'pointerup', kel, { x: 300, y: 400 });
  pev(w, 'pointerdown', kel, { x: 300, y: 400 });   // pick it up again
  pev(w, 'pointerup', kel, { x: 300, y: 400 });
  ok('the second pickup stays quiet', tbox.hidden === true);
  ok('and is still a proper carry', NEU.sans.keyState === 'carry');
}

/* ═══ 14. the television is a throw target ═════════════════════════
   The old click handler demanded the sword be HELD, but the sword ends
   as the broken hero key — held was unreachable, so nothing could ever
   break the TV. The fix throws the KEY at it, the same swept-segment
   contract as the door. Driven with mouse events on purpose: a mouse
   never tap-carries, so no tellCarry hint can open his mouth and
   masquerade as the nag. The weak throw runs BEFORE the strong one —
   once broken, tvScreenPos returns null and there is nothing left to
   nag at. */
console.log('\n14. the television is a throw target');
{
  const ctx = boot();
  const { w, NEU } = ctx;
  const d = w.document;
  const tbox = d.getElementById('tbox');
  const ttxt = d.getElementById('tboxTxt');
  ok('not breakable before he says so', NEU.tvBreakable() === false);
  NEU.save.flag('tv_breakable', 1);
  ok('breakable once he has said so', NEU.tvBreakable() === true);

  /* The stub box for every element is (100,100)-(146,146), so the TV's
     centre is (123,123) and its hit radius is max(30, 46/2)+20 = 50.
     Unhidden here because hiddenness must gate the target in real code,
     not in the stubbed geometry. */
  const tv = d.getElementById('tv');
  tv.hidden = false;
  const kel = d.getElementById('keyObj');

  /* Park the key like every other section does: until devSkip, kstate
     is still 'off' and the pointer wiring ignores it by design. */
  NEU.devSkip();
  await wait(40);

  /* A soft upward flick: ~617 px/s, under THROW_MIN. It still sweeps
     straight through the target zone, so only the speed gate stands
     between the player and a wasted television. */
  pev(w, 'pointerdown', kel, { type: 'mouse', x: 123, y: 180 });
  pev(w, 'pointermove', d.body, { type: 'mouse', x: 123, y: 150 });
  await wait(60);
  pev(w, 'pointerup', d.body, { type: 'mouse', x: 123, y: 113 });
  await wait(1400);                      // outwait the typewriter
  ok('a weak throw through it nags instead', tbox.hidden === false &&
     ttxt.textContent.indexOf('put some') !== -1);
  ok('and the weak throw did not break it',
     !NEU.save.flagged('tv_broken') && !tv.classList.contains('is-broke'));

  /* A hard drag-release: ~(420-260)/15ms ≈ 10600 px/s, far over
     THROW_MIN. The flight sweeps through y=123 within frames. */
  NEU.devSkip();                          // park the key again
  await wait(40);
  pev(w, 'pointerdown', kel, { type: 'mouse', x: 123, y: 600 });
  pev(w, 'pointermove', d.body, { type: 'mouse', x: 123, y: 420 });
  await wait(15);
  pev(w, 'pointerup', d.body, { type: 'mouse', x: 123, y: 260 });
  await wait(400);
  ok('a hard throw puts the key through it',
     NEU.save.flagged('tv_broken') && tv.classList.contains('is-broke'));
  ok('the module owns up to its own smash', NEU.sans.tvBroken === true);

  /* Reboot the module over the same window: the flag persists, so the
     boot re-arm block must read it back and keep the show closed. On
     the old code tvBroken reset to false and the TV went live again. */
  w.eval(fs.readFileSync(path.join(ROOT, 'js', 'game/sans.js'), 'utf8'));
  await wait(20);
  ok('after a reload it stays broken', NEU.tvBreakable() === false);
  ok('and the re-arm read the flag back', NEU.sans.tvBroken === true &&
     !!NEU.save.flagged('tv_broken'));
}

console.log('\n' + (fail ? `${fail} FAILED, ${pass} passed` : `ALL PASS (${pass})`));
process.exit(fail ? 1 : 0);
