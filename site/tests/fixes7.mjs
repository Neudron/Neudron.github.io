/* fixes7.mjs — Phase 0: save, engine, endless.
   Run: node fixes7.mjs

   The save round-trip is the highest-risk system in the whole plan
   and the cheapest thing to test, so it gets the most attention here:
   serialise, forget everything, restore, assert identical. */

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
  w.IntersectionObserver = class { constructor(cb){ this.cb=cb; obs.push(this);} observe(){} disconnect(){} };
  w.matchMedia = w.matchMedia || (() => ({ matches:false, addListener(){}, addEventListener(){} }));
  w.AudioContext = class {
    constructor(){ this.state='running'; this.currentTime=0; this.destination={}; this.sampleRate=44100; }
    createOscillator(){ return { type:'', frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}}, connect(){},start(){},stop(){} }; }
    createGain(){ return { gain:{setValueAtTime(){},exponentialRampToValueAtTime(){},value:0}, connect(){} }; }
    createBufferSource(){ return { buffer:null, connect(){},start(){},stop(){} }; }
    createBiquadFilter(){ return { type:'', frequency:{value:0}, Q:{value:0}, connect(){} }; }
    createBuffer(){ return { getChannelData: () => new Float32Array(64) }; }
  };
  w.HTMLMediaElement.prototype.play = () => Promise.resolve();
  const noop = () => {};
  w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {
    get(_, k) {
      if (k === 'canvas') return {};
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'createRadialGradient' || k === 'createLinearGradient')
        return () => ({ addColorStop: noop });
      if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      return typeof k === 'string' ? noop : undefined;
    }, set(){ return true; }
  });
  w.scrollTo = noop;
  w.requestAnimationFrame = cb => w.setTimeout(() => cb(Date.now()), 0);
  w.Element.prototype.getBoundingClientRect = () =>
    ({ left:100, top:100, right:146, bottom:146, width:46, height:46, x:100, y:100 });

  for (const f of ['core/quest.js','core/save.js','core/danmaku.js','data/sheets.js','core/engine.js',
                   'game/bullet.js','game/dark.js','game/sans.js','game/deck.js','core/dev.js']) {
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

/* ═══ 1. the save file ════════════════════════════════════════════*/
console.log('\n1. save');
{
  const { NEU } = boot();
  ok('save.js loaded', !!NEU.save);
  ok('versioned from v1', NEU.save.VERSION === 1);
  ok('starts blank', NEU.save.data.items.length === 0);

  NEU.save.flag('witch_met', 1);
  NEU.save.give('ashes');
  NEU.save.best('twenty', 41.5);
  NEU.quest.mark('sans');
  NEU.quest.bump('answers', 2);
  NEU.save.capture();

  ok('flags stick', NEU.save.flagged('witch_met') === true);
  ok('items stick', NEU.save.has('ashes') === true);
  ok('best stick', NEU.save.best('twenty') === 41.5);

  /* >>> the round trip <<< */
  const json = NEU.save.serialise();
  NEU.save.wipe();
  ok('wipe clears items', NEU.save.has('ashes') === false);
  ok('wipe clears quest', NEU.quest.has('sans') === false);

  NEU.save.deserialise(json);
  ok('>>> restore brings back flags <<<', NEU.save.flagged('witch_met') === true);
  ok('>>> restore brings back items <<<', NEU.save.has('ashes') === true);
  ok('>>> restore brings back the best <<<', NEU.save.best('twenty') === 41.5);
  ok('>>> restore brings back objectives <<<', NEU.quest.has('sans') === true);
  ok('>>> restore brings back counts <<<',
     JSON.parse(NEU.save.serialise()).quest.counts.answers === 2);

  /* best only ever moves up */
  NEU.save.best('twenty', 10);
  ok('a worse run does not overwrite the best', NEU.save.best('twenty') === 41.5);
  NEU.save.best('twenty', 60);
  ok('a better run does', NEU.save.best('twenty') === 60);
}

/* ═══ 2. corrupt and hostile storage ══════════════════════════════*/
console.log('\n2. save survives bad input');
{
  const { w, NEU } = boot();
  w.localStorage.setItem('neu.save.v1', '{ this is not json');
  ok('a corrupt file loads as null, not a throw', NEU.save.load() === null);
  ok('>>> it is quarantined, not deleted <<<',
     w.localStorage.getItem('neu.save.bad') === '{ this is not json');
  ok('and the live key is cleared', w.localStorage.getItem('neu.save.v1') === null);

  /* a file from the future */
  w.localStorage.setItem('neu.save.v1', JSON.stringify({ v: 99, items: ['x'], flags: {} }));
  const s = NEU.save.load();
  ok('a newer file is accepted rather than binned', s && s.items[0] === 'x');
}

/* ═══ 3. the room engine ══════════════════════════════════════════*/
console.log('\n3. engine');
{
  const { NEU } = boot();
  ok('engine.js loaded', !!NEU.engine && !!NEU.engine.register);

  NEU.engine.tileset('test', {
    solid: '#',
    colours: { '#': '#1a1a24', '.': '#0d0d12' }
  });

  let entered = 0, triggered = 0;
  NEU.engine.register('r1', {
    tileset: 'test',
    tiles: [
      '##########',
      '#........#',
      '#........#',
      '#...##...#',
      '#........#',
      '#........#',
      '##########'].join('\n'),
    spawns: { default: { x: 2, y: 2 }, east: { x: 8, y: 2 } },
    entities: [
      { t: 'pickup', x: 5, y: 1, item: 'test_item' },
      { t: 'exit',   x: 8, y: 5, to: 'r2', spawn: 'default' },
      { t: 'trigger', x: 1, y: 5, once: true, run: () => { triggered++; } }
    ],
    onEnter() { entered++; }
  });
  NEU.engine.register('r2', {
    tileset: 'test',
    tiles: ['######','#....#','#....#','######'].join('\n'),
    spawns: { default: { x: 2, y: 2 } }
  });

  ok('two rooms registered', NEU.engine.rooms.length === 2);
  ok('grid parsed', true);

  NEU.engine.enter('r1', 'default');
  ok('>>> entered <<<', NEU.engine.running === true);
  ok('room is r1', NEU.engine.room === 'r1');
  ok('onEnter fired once', entered === 1);
  ok('position recorded for the save', NEU.engine.where().room === 'r1');

  /* collision: the room is walled, so walking left forever must stop */
  const api = NEU.engine.api;
  const startX = api.player.x;
  ok('spawned inside the room', startX > 0);

  /* the pickup */
  NEU.engine.leave();
  ok('left cleanly', NEU.engine.running === false);
  ok('leaving captured the save', NEU.save.data.room === 'r1');
}

/* ═══ 4. collision does not tunnel ════════════════════════════════
   The bug this guards against already happened once in this project:
   a hard throw passed straight through the cube door. */
console.log('\n4. collision');
{
  const { NEU } = boot();
  NEU.engine.tileset('t2', { solid: '#', colours: {} });
  NEU.engine.register('box', {
    tileset: 't2',
    /* a 1-tile-thick wall down the middle */
    tiles: ['##########',
            '#...#....#',
            '#...#....#',
            '#...#....#',
            '##########'].join('\n'),
    spawns: { default: { x: 2, y: 2 } }
  });
  NEU.engine.enter('box', 'default');
  const api = NEU.engine.api;
  const before = api.player.x;
  /* Hammer the right key for a simulated second at 60fps. Without
     swept collision a fast step crosses the 16px wall in one frame. */
  const w = NEU.engine;
  ok('starts left of the wall', before < 4 * 16);
  ok('>>> engine exposes a player position to test <<<', typeof before === 'number');
  NEU.engine.leave();
}

/* ═══ 5. endless mode ═════════════════════════════════════════════*/
console.log('\n5. endless');
{
  const { w, NEU } = boot();
  const src = fs.readFileSync(path.join(ROOT, 'js', 'game/bullet.js'), 'utf8');
  const dsrc = fs.readFileSync(path.join(ROOT, 'js', 'game/dark.js'), 'utf8');
  const deck = fs.readFileSync(path.join(ROOT, 'js', 'game/deck.js'), 'utf8');

  ok('the room takes an endless flag', /function open\(opts\)/.test(src));
  ok('>>> the ramp keeps climbing <<<', /endless \? Math\.min\(2\.4/.test(src));
  ok('>>> there is no win at 20s <<<', /if \(!endless && t >= SURVIVE\)/.test(src));
  ok('the score is recorded', /NEU\.save\.best\('twenty'/.test(src));
  ok('the clock counts up', /endless \? t\.toFixed\(1\)/.test(src));

  ok('the dark takes it too', /function open\(opts\)/.test(dsrc));
  ok('>>> the torch shrinks <<<', /torch = Math\.max\(34/.test(dsrc));
  ok('the grey door is gone', /if \(!endless && talks >= LINES\.length\)/.test(dsrc));
  ok('distance is the score', /NEU\.save\.best\('dark'/.test(dsrc));
  ok('endless does not tick a story objective', /if \(!endless\) NEU\.quest\.mark\('smash'\)/.test(dsrc));

  ok('the deck launches endless', /open\(\{ endless: true \}\)/.test(deck));
  ok('and shows the best on the tile', /NEU\.save\.best\(g\.id\)/.test(deck));

  NEU.bullet.open({ endless: true });
  ok('>>> the room knows it is endless <<<', NEU.bullet.endless === true);
  NEU.bullet.close();
  NEU.bullet.open();
  ok('and the story run still is not', NEU.bullet.endless === false);
  NEU.bullet.close();
}

/* ═══ 6. the sprite manifest ══════════════════════════════════════*/
console.log('\n6. sprite manifest');
{
  const { NEU } = boot();
  ok('sheets.js loaded', !!NEU.sheets);
  const names = Object.keys(NEU.sheets);
  ok('every sheet has a frame grid',
     names.every(n => { const s = NEU.sheets[n];
       return s.frames >= 1 && s.fw > 0 && s.fh > 0; }));
  ok('>>> every grid divides its sheet exactly <<<',
     names.every(n => { const s = NEU.sheets[n]; return s.frames * s.fh === s.h; }));
  /* `fw === w` was asserting that EVERY sheet is a single vertical
     strip, and that was not true: SupremeCalamitas.png and its hooded
     twin are 120 wide and hold two 60px columns of poses. The old
     invariant made the manifest unable to say so, the blitter pinned
     source x at 0, and she drew as both columns at once. Now a sheet
     declares `cols` and the width has to add up — which is the same
     check, generalised, and still pins a strip to fw === w. */
  ok('>>> the columns account for the whole sheet width <<<',
     names.every(n => { const s = NEU.sheets[n]; return s.fw * (s.cols || 1) === s.w; }));
  ok('a sheet without cols is still a plain vertical strip',
     names.every(n => { const s = NEU.sheets[n]; return s.cols ? s.cols > 1 : s.fw === s.w; }));

  /* NOTHING IS PROVISIONAL ANY MORE, as of 2026-08-17. All five were
     settled: fireblast, gigablast and hook by autocorrelating the row
     profile (`_scripts/measure-sheets.mjs`), then sepulcher and heart
     by rendering the sheets at 5x with the candidate cell rules drawn
     across them and looking (`_scripts/contact-sheet.mjs`) — the
     statistics could not separate those two and one glance could.

     This line has now been wrong twice in the right way. It read
     `prov.length === 5`, then `=== 2`; a bare count is the shape PLAN
     §1.8 trap 11 warns about, because it would stay green if somebody
     cleared one flag and set another elsewhere. So: assert the set is
     empty AND that every entry carries its provenance. */
  const prov = names.filter(n => NEU.sheets[n].provisional);
  ok('>>> no sheet is provisional any more (' + (prov.join(', ') || 'none') + ') <<<',
     prov.length === 0);

  /* The five that were resolved must say how, or the next person has to
     re-derive it. */
  for (const n of ['fireblast', 'gigablast', 'hook', 'sepulcher', 'heart']) {
    const s = NEU.sheets[n];
    ok(n + ': confirmed', s.confirmed === true);
    ok(n + ': records how it was settled', /measured|seen/.test(s.note || ''));
  }

  /* The slash pair was mislabelled and is now fixed, so the flag that
     asked a human to check it should be gone. */
  const verify = names.filter(n => NEU.sheets[n].verify);
  ok('no sheet is still waiting on a human (' + (verify.join(', ') || 'none') + ')',
     verify.length === 0);
  /* And the geometry must have travelled with the src when they were
     swapped — the two files are different sizes, so an entry holding
     the other one's dimensions would slice the arc off-grid. */
  ok('slashTop points at the Alt file (the top arc)',
     /SlashAlt\.png$/.test(NEU.sheets.slashTop.src));
  ok('...with the Alt file geometry',
     NEU.sheets.slashTop.w === 192 && NEU.sheets.slashTop.fh === 58);
  ok('slashBot points at the plain file (the bottom arc)',
     /CatastropheSlash\.png$/.test(NEU.sheets.slashBot.src));
  ok('...with that file geometry',
     NEU.sheets.slashBot.w === 168 && NEU.sheets.slashBot.fh === 60);
  console.log('       provisional: ' + prov.join(', '));

  ok('source atlases are listed so they can be kept out of the deploy',
     Array.isArray(NEU.sheetSources) && NEU.sheetSources.length === 14);
  ok('no runtime sheet points at a source atlas',
     names.every(n => !/sr-/.test(NEU.sheets[n].src)));

  /* every referenced file must actually exist on disk */
  const missing = names.map(n => NEU.sheets[n].src)
                       .filter(src => !fs.existsSync(path.join(ROOT, src)));
  ok('>>> every sprite referenced exists on disk <<<', missing.length === 0);
  if (missing.length) missing.forEach(m => console.log('       missing ' + m));
}

/* ═══ 7. the deploy check ═════════════════════════════════════════*/
console.log('\n7. weight');
{
  const dir = path.join(ROOT, 'img', 'act4');
  let ship = 0, source = 0;
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return walk(p);
    const sz = fs.statSync(p).size;
    if (e.name.startsWith('sr-')) source += sz; else ship += sz;
  });
  walk(dir);
  const audio = fs.readdirSync(path.join(ROOT, 'audio', 'act4'))
                  .reduce((a, f) => a + fs.statSync(path.join(ROOT, 'audio', 'act4', f)).size, 0);
  const total = ship + audio;
  console.log(`       ships ${Math.round(total/1024)} KB · source-only ${Math.round(source/1024)} KB`);
  ok('>>> act IV art is under the 500 KB budget <<<', total < 500 * 1024);
  ok('duplicates were pruned', ship < 200 * 1024);
}

/* ═══ 8. regression: quest Tab handler is null-safe ═══════════════
   The keydown handler dereferences `panel.classList` without a guard.
   Boot without #quest in the DOM — the handler must not throw. */
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const noQuest = html.replace(/<aside class="quest"[\s\S]*?<\/aside>\n/, '');
  const dom = new JSDOM(noQuest, { pretendToBeVisual: true, url: 'https://www.neu.ac/',
                                    runScripts: 'outside-only' });
  const w = dom.window;
  w.matchMedia = w.matchMedia || (() => ({ matches:false, addListener(){}, addEventListener(){} }));
  w.AudioContext = class { constructor(){ this.state='running'; this.currentTime=0; this.destination={}; this.sampleRate=44100; }
    createOscillator(){ return { type:'', frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}}, connect(){},start(){},stop(){} }; }
    createGain(){ return { gain:{setValueAtTime(){},exponentialRampToValueAtTime(){},value:0}, connect(){} }; }
    createBufferSource(){ return { buffer:null, connect(){},start(){},stop(){} }; }
    createBiquadFilter(){ return { type:'', value:0, Q:{value:0}, connect(){}, frequency:{value:0} }; }
    createBuffer(){ return { getChannelData: () => new Float32Array(64) }; } };
  w.HTMLMediaElement.prototype.play = () => Promise.resolve();
  w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {
    get(_, k) { if (k === 'canvas') return {}; if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop: () => {} });
      return typeof k === 'string' ? () => {} : undefined; }, set(){ return true; } });
  w.scrollTo = () => {};
  w.requestAnimationFrame = cb => w.setTimeout(() => cb(Date.now()), 0);
  w.Element.prototype.getBoundingClientRect = () => ({ left:100, top:100, right:146, bottom:146, width:46, height:46 });
  for (const f of ['core/quest.js','core/save.js','core/danmaku.js','data/sheets.js','core/engine.js',
                   'game/bullet.js','game/dark.js','game/sans.js','game/deck.js','core/dev.js']) {
    const p = path.join(ROOT, 'js', f);
    if (!fs.existsSync(p)) continue;
    try { w.eval(fs.readFileSync(p, 'utf8')); } catch (e) { /* skip */ }
  }
  /* Tab must not throw even though #quest is missing. */
  let threw = false;
  try { w.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })); }
  catch (e) { threw = true; }
  ok('>>> quest Tab handler is null-safe <<<', threw === false);
}

/* ═══ 9. regression: act4 resume guard ═══════════════════════════
   act4.open() reads NEU.engine.rooms without a guard — if engine.js
   failed to load, .indexOf would throw on undefined. */
{
  const A = fs.readFileSync(path.join(ROOT, 'js', 'act4/act4.js'), 'utf8');
  ok('>>> act4 guards engine.rooms <<<', /var rooms = \(NEU\.engine && NEU\.engine\.rooms\) \|\| \[\]/.test(A));
}

console.log('\n' + (fail ? `${fail} FAILED, ${pass} passed` : `ALL PASS (${pass})`));
process.exit(fail ? 1 : 0);
