/* fixes6.mjs — the deck, the carried console, and the z-order.
   Run: node fixes6.mjs */

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

function boot() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { pretendToBeVisual: true, url: 'https://www.neu.ac/',
                                runScripts: 'outside-only' });
  const w = dom.window;
  const obs = [];
  w.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; obs.push(this); }
    observe() {} disconnect() {}
  };
  w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener(){}, addEventListener(){} }));
  w.AudioContext = class {
    constructor() { this.state='running'; this.currentTime=0; this.destination={}; this.sampleRate=44100; }
    createOscillator(){ return { type:'', frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},
                                 connect(){}, start(){}, stop(){} }; }
    createGain(){ return { gain:{setValueAtTime(){},exponentialRampToValueAtTime(){},value:0}, connect(){} }; }
    createBufferSource(){ return { buffer:null, connect(){}, start(){}, stop(){} }; }
    createBiquadFilter(){ return { type:'', frequency:{value:0}, Q:{value:0}, connect(){} }; }
    createBuffer(){ return { getChannelData: () => new Float32Array(64) }; }
  };
  w.HTMLMediaElement.prototype.play = () => Promise.resolve();
  const noop = () => {};
  w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {
    get(_, k) {
      if (k === 'canvas') return {};
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      return typeof k === 'string' ? noop : undefined;
    }, set() { return true; }
  });
  w.scrollTo = noop;
  w.requestAnimationFrame = cb => w.setTimeout(() => cb(Date.now()), 0);
  w.Element.prototype.getBoundingClientRect = () =>
    ({ left:100, top:100, right:146, bottom:146, width:46, height:46, x:100, y:100 });

  for (const f of ['core/quest.js','core/danmaku.js','game/bullet.js','game/dark.js','game/sans.js','game/deck.js','core/dev.js']) {
    const p = path.join(ROOT, 'js', f);
    if (!fs.existsSync(p)) { console.log('  !! missing ' + f); continue; }
    try { w.eval(fs.readFileSync(p, 'utf8')); }
    catch (e) { console.log('  !! ' + f + ': ' + e.message); }
  }
  return { w, NEU: w.NEU,
           enter: () => obs.forEach(o => o.cb([{ isIntersecting: true }])),
           leave: () => obs.forEach(o => o.cb([{ isIntersecting: false }])) };
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const CSS  = fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* helper: pull a numeric z-index out of a named rule.
   The selector must start a LINE. Matching it anywhere found the
   phrase ".tbox { display: grid }" quoted inside an explanatory
   comment further up the file and read the z-index out of that — a
   test bug that reported working css as broken. */
function z(sel) {
  const i = CSS.indexOf('\n' + sel + ' {');
  if (i < 0) return null;
  const block = CSS.slice(i, CSS.indexOf('\n}', i));
  const m = block.match(/z-index:\s*(\d+)/);
  return m ? +m[1] : null;
}

/* ═══ 1. the dialog is on top of everything ═══════════════════════*/
console.log('\n1. the dialog outranks every other layer');
{
  const tbox = z('.tbox');
  const others = { '.pethand': z('.pethand'), '.panel': z('.panel'), '.dev': z('.dev'),
                   '.dk': z('.dk'), '.bh': z('.bh'), '.deck': z('.deck'),
                   '.chips': z('.chips'), '.swfly': z('.swfly') };
  ok('the textbox has a z-index', tbox !== null);
  for (const [k, v] of Object.entries(others)) {
    ok(`above ${k} (${v})`, v !== null && tbox > v);
  }
  ok('>>> nothing can bury it <<<',
     Object.values(others).every(v => v !== null && tbox > v));
}

/* ═══ 2. the console is carried, and gates the charge ═════════════*/
console.log('\n2. the console has to be on you to charge');
{
  const { w, NEU, enter, leave } = boot();
  enter(); NEU.fitClicker(); await wait(60); leave(); await wait(700); enter(); await wait(30);

  ok('not carrying it yet', NEU.hasConsole() === false);
  ok('the room can see that', /function carrying/.test(
        fs.readFileSync(path.join(ROOT,'js','game/bullet.js'),'utf8')));
  ok('the beam checks it', /if \(held && carrying\(\)\)/.test(
        fs.readFileSync(path.join(ROOT,'js','game/bullet.js'),'utf8')));
  ok('and says so when empty', /nothing on you to charge/.test(
        fs.readFileSync(path.join(ROOT,'js','game/bullet.js'),'utf8')));

  const carry = w.document.getElementById('panelCarry');
  ok('the inside panel has a carry line', !!carry);
  ok('hidden while empty-handed', carry.hidden === true);

  w.document.getElementById('sleepSwitch').click();
  await wait(30);
  ok('>>> picked up <<<', NEU.hasConsole() === true);
  ok('the inside panel now shows it', carry.hidden === false);

  const chipTxt = w.document.querySelector('#swChip span');
  ok('chip reads flat', chipTxt.textContent === 'a console, flat');
  NEU.devCharge(50);
  ok('chip carries the charge', chipTxt.textContent === 'a console, 50%');
  NEU.devCharge(100);
  ok('chip reads charged', chipTxt.textContent === 'a console, charged');

  ok('the tray sits above the rooms', z('.chips') > z('.bh'));
}

/* ═══ 3. the deck replaced the fight ══════════════════════════════*/
console.log('\n3. docking opens a console, not a fight');
{
  ok('boss.js is not loaded', !/js\/boss\.js/.test(HTML));
  ok('deck.js is', /js\/game\/deck\.js/.test(HTML));
  const sans = fs.readFileSync(path.join(ROOT,'js','game/sans.js'),'utf8');
  ok('nothing calls NEU.boss', !/NEU\.boss\.open/.test(sans));
  ok('>>> the dock opens the deck <<<', /NEU\.deck\.open\(\)/.test(sans));
  ok('the objective changed', /id: 'deck'/.test(
        fs.readFileSync(path.join(ROOT,'js','core/quest.js'),'utf8')));
  ok('no "finish the fight" step', !/finish the fight/.test(
        fs.readFileSync(path.join(ROOT,'js','core/quest.js'),'utf8')));

  const { w, NEU, enter, leave } = boot();
  const tv = w.document.getElementById('tv');
  enter(); NEU.fitClicker(); await wait(60); leave(); await wait(700); enter(); await wait(30);
  w.document.getElementById('sleepSwitch').click();
  NEU.devCharge(100); NEU.tvState();
  tv.click();
  await wait(1400);

  ok('docked', NEU.sans.docked === true);
  ok('>>> the deck is up <<<', NEU.deck.running === true);
  ok('objective ticked', NEU.quest.has('deck') === true);

  const shelf = w.document.getElementById('deckShelf');
  ok('the shelf is populated', shelf.children.length === NEU.deck.games);
  ok('seven titles — the woods was added', NEU.deck.games === 7);
  ok('starts on the first', NEU.deck.sel === 0);
  ok('first is playable', NEU.deck.title === 'twenty seconds');
  ok('first tile is selected', shelf.children[0].classList.contains('is-on'));

  /* arrow across */
  const key = k => w.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true }));
  key('ArrowRight');
  ok('arrow moves the selection', NEU.deck.sel === 1);
  ok('selection follows the tile', shelf.children[1].classList.contains('is-on'));
  key('ArrowLeft'); key('ArrowLeft');
  ok('>>> it wraps <<<', NEU.deck.sel === NEU.deck.games - 1);

  /* the broken ones fail, each in their own way */
  const err = w.document.getElementById('deckErr');
  key('Enter');
  ok('the last one refuses', err.hidden === false);
  ok('and says why', /already running/.test(err.textContent));
  ok('still on the deck', NEU.deck.running === true);

  const dead = [...shelf.children].filter(t => t.classList.contains('is-dead'));
  ok('four gag titles are greyed', dead.length === 4);

  /* a real one launches */
  key('ArrowRight');                        // wraps back to 0
  ok('back to the playable one', NEU.deck.sel === 0);
  key('Enter');
  await wait(500);
  ok('>>> the deck stepped aside <<<', NEU.deck.running === false);
  ok('and the room opened', NEU.bullet.running === true);
}

/* ═══ 4. the status bar shows the real charge ═════════════════════*/
console.log('\n4. the battery is the charge you earned');
{
  const { w, NEU, enter, leave } = boot();
  enter(); NEU.fitClicker(); await wait(60); leave(); await wait(700); enter(); await wait(30);
  w.document.getElementById('sleepSwitch').click();
  NEU.devCharge(100);
  NEU.deck.open(); await wait(40);
  ok('battery reads 100%', w.document.getElementById('deckBattTxt').textContent === '100%');
  const clock = w.document.getElementById('deckClock').textContent;
  ok('>>> real clock, not a placeholder <<<', /^\d\d:\d\d$/.test(clock));
}

console.log('\n' + (fail ? `${fail} FAILED, ${pass} passed` : `ALL PASS (${pass})`));
process.exit(fail ? 1 : 0);
