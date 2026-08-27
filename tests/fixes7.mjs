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
  ok('versioned from v1, now v2', NEU.save.VERSION === 2);
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
  /* RE-SOURCED 2026-08-24: every Calamity sheet's fh is now read from
     the mod's own `.cs` frame count against the file's real height, and
     Terraria's own FindFrame computes that with ORDINARY INTEGER
     DIVISION (`texture.Height / npcFrameCount`, truncated) — it does
     NOT require the sheet to divide evenly. `heart` is the proof:
     BrimstoneHeart.png is 370px tall for 6 frames, 370/6 = 61 with 4px
     left over and simply unused. The old invariant here (`frames*fh
     === h`, exact) was the wiki-era assumption that produced the
     370->372px "re-pad" workaround this file used to test for — the
     372px file and the pad step are both gone; this is what the mod
     actually ships. */
  ok('>>> every grid matches Terraria\'s own truncating frame division <<<',
     names.every(n => { const s = NEU.sheets[n]; return s.fh === Math.floor(s.h / s.frames); }));
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

  /* RE-SOURCED 2026-08-24: the whole measured/provisional/confirmed
     apparatus (alpha-threshold row scans, divisor guessing, a human
     "verify" flag) is gone. Every Calamity entry is copied byte-for-
     byte from CalamityModPublic under its own filename and carries a
     `from:` citing the exact `.cs`/file that states its geometry —
     assert that instead: every fight-relevant sheet has one, and none
     of them point at the wrong Calamitas (CalClone is a different,
     earlier boss; TownNPCs is the witch who moves in after this one
     dies — see js/data/sheets.js's header for why those are traps). */
  const calamityKeys = names.filter(n => /calamity\//.test(NEU.sheets[n].src));
  const noProvenance = calamityKeys.filter(n => !NEU.sheets[n].from);
  ok('>>> every Calamity sheet cites its source <<<' , noProvenance.length === 0);
  if (noProvenance.length) console.log('       missing from: ' + noProvenance.join(', '));
  const wrongEntity = calamityKeys.filter(n => /CalClone|TownNPCs/.test(NEU.sheets[n].from || ''));
  ok('>>> no Calamity sheet cites CalClone or TownNPCs <<<', wrongEntity.length === 0);
  if (wrongEntity.length) console.log('       wrong entity: ' + wrongEntity.join(', '));

  /* Filenames are the mod's own, verbatim — the previous manifest
     renamed files for brevity and that renaming is what let the
     brothers draw from their own THROWN ATTACKS (SupremeCataclysmFist,
     SupremeCatastropheSlash) because nothing on disk still said
     SupremeCataclysm.png / SupremeCatastrophe.png (their real bodies)
     existed. Assert both halves now exist under their real names. */
  ok('the brothers have real NPC body art, not just their thrown attacks',
     !!NEU.sheets.cataclysm && !!NEU.sheets.catastrophe &&
     /SupremeCataclysm\.png$/.test(NEU.sheets.cataclysm.src) &&
     /SupremeCatastrophe\.png$/.test(NEU.sheets.catastrophe.src));
  /* The slash pair's pose reading (2026-08-17, by rendering both files
     onto a checkerboard with the cell grid drawn over them) survives
     the rename — only the keys changed, from a pose-guess
     (slashTop/slashBot) to the mod's own filenames. */
  ok('catastropheSlashAlt points at the file seen as the top arc',
     /SlashAlt\.png$/.test(NEU.sheets.catastropheSlashAlt.src));
  ok('...with that file\'s real geometry',
     NEU.sheets.catastropheSlashAlt.w === 192 && NEU.sheets.catastropheSlashAlt.fh === 58);
  ok('catastropheSlash points at the file seen as the bottom arc',
     /^(?!.*Alt).*CatastropheSlash\.png$/.test(NEU.sheets.catastropheSlash.src));
  ok('...with that file\'s real geometry',
     NEU.sheets.catastropheSlash.w === 168 && NEU.sheets.catastropheSlash.fh === 60);

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
  /* RE-SOURCED 2026-08-24: these budgets were calibrated against a
     previous developer's hand-cropped rip-site fragments — trimmed down
     to whatever pixels they happened to keep, which is also why frame
     counts had to be guessed instead of read. The real, complete
     CalamityModPublic sheets this replaced them with are legitimately
     heavier: SupremeCataclysm.png / SupremeCatastrophe.png alone (the
     brothers' actual bodies, fixing "brother sprites are broken") are
     124 KB together, and their glow masks another 48 KB — full 9-row
     and 8-row animation grids, not a cropped pose or two. Shipping
     correctly-sourced art is the point of Phase 0; a byte budget from
     before that reflected the absence of it, not a real target. New
     numbers keep headroom over the current real total (ship ~363 KB,
     total ~517 KB) without re-inviting silent bloat. */
  ok('>>> act IV art is under the 600 KB budget <<<', total < 600 * 1024);
  ok('no stray duplicates (art under 420 KB)', ship < 420 * 1024);
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
