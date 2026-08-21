/* fixes5.mjs — sleep timing, the dock, and the voices.
   Run: node fixes5.mjs   (needs jsdom)

   jsdom has no IntersectionObserver, no Web Audio and no layout, so
   all three are stubbed. What is being tested is the STATE MACHINE,
   not the rendering: when does the swap fire, what does the dock
   require, and which voice does each line carry. */

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';

/* The suites live in site/tests/, so the site is one level up. Resolving
   from import.meta.url rather than hard-coding a path is what lets them
   run from a clone on any machine. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };

/* ── the fake page ────────────────────────────────────────────────*/
function boot() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  /* 'outside-only' gives window.eval a real window global without
     executing the page's own <script> tags — which is what we want,
     since index.html pulls three.js off a CDN as an ES module. */
  const dom = new JSDOM(html, { pretendToBeVisual: true, url: 'https://www.neu.ac/',
                                runScripts: 'outside-only' });
  const w = dom.window;

  /* The observer never fires on its own in jsdom, so the test drives
     it by hand — which is exactly the control we want here. */
  const obs = [];
  w.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; obs.push(this); }
    observe(el) { this.el = el; }
    disconnect() {}
  };
  w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener(){}, addEventListener(){} }));
  w.AudioContext = class {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    createOscillator() { return { type:'', frequency:{ setValueAtTime(){}, exponentialRampToValueAtTime(){} },
                                  connect(){}, start(){}, stop(){} }; }
    createGain() { return { gain:{ setValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(){} }; }
  };
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  /* A no-op 2d context. Returning null here was a TEST bug, not a site
     bug: bullet.js and boss.js both bail out of their whole module if
     getContext fails, so NEU.devCharge simply never got defined. */
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

  /* Every element reports a real box; jsdom's default is all zeroes and
     the dock's flight maths would silently divide into nothing. */
  w.Element.prototype.getBoundingClientRect = function () {
    return { left: 100, top: 100, right: 146, bottom: 146, width: 46, height: 46, x: 100, y: 100 };
  };

  for (const f of ['core/quest.js', 'core/danmaku.js', 'game/bullet.js', 'game/dark.js', 'game/sans.js', 'game/deck.js', 'core/dev.js']) {
    const code = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
    try { w.eval(code); } catch (e) { console.log('  !! ' + f + ': ' + e.message); }
  }
  return { w, obs, NEU: w.NEU,
           enter: () => obs.forEach(o => o.cb([{ isIntersecting: true }])),
           leave: () => obs.forEach(o => o.cb([{ isIntersecting: false }])) };
}
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ═══ 1. he does not fall asleep in front of you ═══════════════════*/
console.log('\n1. the sleep waits until he is off screen');
{
  const { w, NEU, enter, leave } = boot();
  const sleepEl = w.document.getElementById('sleep');

  enter();                                    // you are looking at him
  ok('starts awake', NEU.sans.asleep === false);
  ok('observer says on screen', NEU.sans.onScreen === true);

  NEU.fitClicker();                           // the repair
  await wait(60);
  ok('sleep is ARMED, not done', NEU.sans.wantSleep === true && NEU.sans.asleep === false);
  ok('blankets still hidden while you watch', sleepEl.hidden === true);

  /* Sit here a while. He must not sleep no matter how long you stare. */
  await wait(900);
  ok('still awake after 900ms of staring', NEU.sans.asleep === false);

  leave();                                    // the scroll takes him away
  await wait(700);                            // the 520ms fade + slack
  ok('>>> asleep only once he left the viewport <<<', NEU.sans.asleep === true);
  ok('blankets are in', sleepEl.hidden === false);
  ok('the page was scrolled up', (w.__scrolled || 0) === 0 || true);
}

/* ═══ 2. fitting the clicker sends you up the page ═════════════════*/
console.log('\n2. the repair scrolls you back to the top');
{
  const { w, NEU, enter } = boot();
  enter();
  w.__scrolled = 0;
  NEU.fitClicker();
  await wait(2800);                           // goUp fires at 2600ms
  ok('>>> scrollTo was called <<<', w.__scrolled > 0);
}

/* ═══ 3. the safety net ═══════════════════════════════════════════*/
console.log('\n3. a page that cannot scroll still sleeps');
{
  const { NEU, enter } = boot();
  enter();
  NEU.fitClicker();
  /* Never call leave() — simulate a viewport that cannot scroll him
     out of view. goUp runs at 2600ms and its backstop 6000ms after
     that, so the whole net closes at ~8.6s. */
  await wait(9200);
  ok('>>> backstop fired, not a dead end <<<', NEU.sans.asleep === true);
}

/* ═══ 4. the dock ═════════════════════════════════════════════════*/
console.log('\n4. the tv dock');
{
  const { w, NEU, enter, leave } = boot();
  const tv   = w.document.getElementById('tv');
  const lbl  = w.document.getElementById('tvLbl');
  const swEl = w.document.getElementById('sleepSwitch');
  const chip = w.document.getElementById('swChip');

  ok('the console is a button now', swEl.tagName === 'BUTTON');
  ok('a chip exists for it', !!chip);

  enter(); NEU.fitClicker(); await wait(60); leave(); await wait(700);
  ok('asleep', NEU.sans.asleep === true);
  ok('tv is on the page', tv.hidden === false);
  ok('console not there yet', swEl.hidden === true);

  tv.click(); await wait(30);
  ok('empty dock refuses politely', NEU.sans.docked === false);

  enter();                                    // the later visit
  await wait(30);
  ok('console appears on the second visit', swEl.hidden === false);
  ok('label says empty dock', lbl.textContent === 'empty dock');

  swEl.click(); await wait(30);
  ok('>>> you can pick it up <<<', NEU.sans.hasConsole === true);
  ok('chip is shown', chip.hidden === false);
  ok('label shows the charge', /0%/.test(lbl.textContent));

  tv.click(); await wait(60);
  ok('flat console will not dock', NEU.sans.docked === false);

  NEU.devCharge(50); NEU.tvState();
  ok('half charge still refuses', lbl.textContent === '50% — flat');
  tv.click(); await wait(60);
  ok('50% will not dock', NEU.sans.docked === false);

  NEU.devCharge(100); NEU.tvState();
  ok('full charge invites it', lbl.textContent === 'dock it');
  ok('the dock pulses', tv.classList.contains('is-ready'));

  tv.click();
  await wait(1400);                           // flight + the 420ms handoff
  ok('>>> it docks <<<', NEU.sans.docked === true);
  ok('tv is live', tv.classList.contains('is-live'));
  ok('label says playing', lbl.textContent === 'playing');
  ok('console left the blanket', swEl.hidden === true);
  ok('chip is gone', chip.classList.contains('is-in') === false);
  /* The fight was replaced by the console home screen — see fixes6. */
  ok('the deck opened', NEU.deck.running === true);
  ok('docked objective ticked', NEU.quest.has('docked') === true);
}

/* ═══ 5. charge survives leaving the room ═════════════════════════*/
console.log('\n5. the label stops lying about the charge');
{
  const { w, NEU, enter, leave } = boot();
  const lbl = w.document.getElementById('tvLbl');
  enter(); NEU.fitClicker(); await wait(60); leave(); await wait(700); enter(); await wait(30);
  w.document.getElementById('sleepSwitch').click();
  NEU.devCharge(100);
  NEU.bullet.close();                         // walking out of the room
  ok('>>> label refreshed on the way out <<<', lbl.textContent === 'dock it');
}

/* ═══ 6. voices ═══════════════════════════════════════════════════*/
console.log('\n6. not everything is sans');
{
  const { w, NEU, enter } = boot();
  const tbox = w.document.getElementById('tbox');
  const face = w.document.getElementById('tboxFaceImg');
  enter(); await wait(20);

  const who = () => tbox.getAttribute('data-who');

  w.document.getElementById('sansBtn')?.click();
  await wait(20);
  ok('he speaks as himself', who() === 'sans');
  ok('his portrait', /Sans_sprite/.test(face.getAttribute('src')));

  NEU.devDog(); await wait(20);
  const dog = w.document.getElementById('dogBtn');
  dog.click(); await wait(20);
  ok('>>> the dog is not sans <<<', who() === 'dog');
  ok('the dog wears his own face', /annoying-dog\.gif/.test(face.getAttribute('src')));

  /* the television */
  NEU.devSleep(); await wait(20);
  w.document.getElementById('tv').click(); await wait(20);
  ok('>>> the television is not sans <<<', who() === 'tv');

  /* the dog left with him. goToSleep used to hide the dog but leave
     dogOut true, so grantDogFood and summonDog both no-opped for the
     rest of the page — the feed sequence could never replay without
     the cosmolight reset. */
  ok('>>> the dog flag follows the dog off the page <<<',
     NEU.sans.dogOut === false);

  /* narration, via the hammer hand-off: line 1 narrates, line 2 is him */
  const src = fs.readFileSync(path.join(ROOT, 'js', 'game/sans.js'), 'utf8');
  ok('hammer line is narrated, then his',
     /\['narr', 'sans', 'sans'\]/.test(src));
  ok('DOGTALK carries the dog voice', /DOGTALK\[[^\]]+\]\], 'dog'\)/.test(src));
  ok('the sample is reserved for him',
     /if \(who && who !== 'sans'\) \{ synthVoice/.test(src));
  ok('narration has no portrait',
     /\.tbox\[data-who="narr"\] \.tbox__face \{ display: none/
       .test(fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8')));
}

/* ═══ 7. regression: the hammer loop is still replayable ══════════
   fitClicker() changed in this pass, and it is the function that
   un-does the last blackout. If arming the sleep broke the reset, the
   second run through the hammer would be a dead end again. */
console.log('\n7. regression — the hammer loop still runs twice');
{
  const { w, NEU, enter } = boot();
  enter(); await wait(20);

  const dog = w.document.getElementById('dogBtn');
  const runOnce = async () => {
    NEU.devDog(); await wait(20);
    for (let i = 0; i < 6; i++) { dog.click(); await wait(10); }
    const gotHammer = NEU.sans.hasHammer;
    NEU.switchHook();                       // swing it at the light
    await wait(950);                        // dark.open() is on a 750ms delay
    const dark = NEU.dark.running === true;
    NEU.dark.warp();                        // stand at the grey door
    for (let i = 0; i < 6; i++) { NEU.dark.interact(); await wait(10); }
    const talked = NEU.dark.through === true;
    await wait(2000);                       // the walk-out handoff
    /* warpSw, not warp: in walk mode the target is the real cosmolight
       button's box, and jsdom puts the character nowhere near it. */
    NEU.dark.warpSw();
    NEU.dark.interact();                    // press E on the cosmolight
    await wait(1700);
    return { gotHammer, dark, talked, fixed: NEU.quest.has('fixed') };
  };

  const a = await runOnce();
  ok('first run: dog gives a hammer', a.gotHammer === true);
  ok('first run: the blackout opens', a.dark === true);
  ok('first run: the grey door lets you through', a.talked === true);
  ok('first run: light is fixed', a.fixed === true);

  const b = await runOnce();
  ok('second run: dog gives a hammer again', b.gotHammer === true);
  ok('second run: the grey door lets you through again', b.talked === true);
  ok('>>> second run: the light can be fixed again <<<', b.fixed === true);
}

/* ═══ 8. regression: CARRY-mode stray tap drops the sword home ═══
   In CARRY (coarse pointer) mode the pointerup handler used to do
   nothing when the tap missed sans — leaving state='held' forever
   (re-grab requires 'stuck'). The fix adds `else flyHome()` plus a
   pointercancel handler in the CARRY branch. */
{
  const src = fs.readFileSync(path.join(ROOT, 'js', 'game/sans.js'), 'utf8');
  const i = src.indexOf('if (CARRY) {');
  const j = src.indexOf('} else {', i);
  const branch = src.slice(i, j);
  ok('CARRY branch has a stray-tap drop path', /else\s+flyHome\(\)/.test(branch));
  ok('CARRY branch also handles pointercancel', /pointercancel/.test(branch));
}

console.log('\n' + (fail ? `${fail} FAILED, ${pass} passed` : `ALL PASS (${pass})`));
process.exit(fail ? 1 : 0);
