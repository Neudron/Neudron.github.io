/* fixes22.mjs — the room engine's contract, pinned before the rebuild.
   Run: node tests/fixes22.mjs

   Engine v2 (.opencode/plans/engine-v2.md) replaces the internals of
   js/core/engine.js: the loop, the camera, the renderer and the two
   long if-chains that decide what an entity does. Every room file and
   every other scene talks to it through a small surface, and this
   suite is that surface, written down as behaviour:

     1. the public API and the hook API rooms receive
     2. every entity kind the shipped rooms use is one the engine knows
     3. each kind does what it did: exits (open + locked), pickups that
        stay taken, saves, signs, npc resume, altars, triggers
     4. blocks push one cell, ice carries them, plates solve the room,
        a reset puts everything back
     5. walking moves you, walls stop you, nothing tunnels
     6. TILE / REACH / PLAYER_H agree with tests/reach.mjs
     7. the engine files stay ES5

   It must pass on the OLD engine first — that is what makes it a
   characterisation and not a wish list. */

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRooms } from './reach.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* The engine files, in load order. engine-look / engine-kinds are
   optional so this suite runs unchanged on the v1 engine and the v2. */
const ENGINE_FILES = ['core/engine-look.js', 'core/engine-kinds.js', 'core/engine.js']
  .filter(f => fs.existsSync(path.join(ROOT, 'js', f)));
const MODULES = [
  'core/quest.js', 'core/save.js', 'core/juice.js', 'core/danmaku.js',
  'data/sheets.js', ...ENGINE_FILES, 'game/sword.js', 'game/sans.js',
  'act4/act4.js', 'act4/rooms-a.js', 'act4/rooms-d.js', 'act4/rooms-g.js',
  'core/touch.js'
];

function boot() {
  const dom = new JSDOM(HTML, { pretendToBeVisual: true, url: 'https://www.neu.ac/',
                                runScripts: 'outside-only' });
  const w = dom.window;
  w.document.querySelectorAll('noscript').forEach(n => n.remove());
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
      if (k === 'createRadialGradient' || k === 'createLinearGradient' || k === 'createPattern')
        return () => ({ addColorStop: noop });
      if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (typeof k === 'string') return () => {};
      return undefined;
    }, set() { return true; }
  });
  w.scrollTo = noop;
  w.requestAnimationFrame = cb => w.setTimeout(() => cb(w.performance.now()), 16);
  w.Element.prototype.getBoundingClientRect = () =>
    ({ left: 100, top: 100, right: 146, bottom: 146, width: 46, height: 46, x: 100, y: 100 });
  for (const f of MODULES) {
    try { w.eval(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8')); }
    catch (e) { console.log('  !! ' + f + ': ' + e.message); }
  }
  /* Spy on dialogue: every line the engine asks for lands here. */
  const said = [];
  const real = w.NEU.talk;
  const spy = function (lines, who) { said.push({ lines: [].concat(lines), who }); return real.call(this, lines, who); };
  for (const k of Object.keys(real)) spy[k] = real[k];
  w.NEU.talk = spy;
  return { w, NEU: w.NEU, doc: w.document, said };
}

const wait = ms => new Promise(r => setTimeout(r, ms));
const key = (w, k, type = 'keydown') =>
  w.dispatchEvent(new w.KeyboardEvent(type, { key: k, bubbles: true, cancelable: true }));
async function until(fn, ms = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return true; await wait(10); }
  return !!fn();
}
/* Press e and let the 500ms re-interact cooldown expire before the next. */
async function press(w, k = 'e') { key(w, k); key(w, k, 'keyup'); await wait(30); }

/* One test room holding every kind, each with the player able to stand
   beside it. Spawns are named for what they face. */
function testRooms(NEU) {
  const E = NEU.engine;
  E.tileset('t22', { solid: '#', colours: {} });
  E.tileset('t22b', { solid: '#', colours: {} });
  const log = { entered: 0, exited: 0, solved: 0, reset: 0, ran: 0, trig: 0 };
  E.register('k_all', {
    tileset: 't22',
    tiles: [
      '####################',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '####################'
    ].join('\n'),
    spawns: {
      default:  { x: 2,  y: 2, face: 'right' },
      exitOpen: { x: 2,  y: 1, face: 'left' },
      pickup:   { x: 5,  y: 2, face: 'right' },
      save:     { x: 8,  y: 2, face: 'right' },
      sign:     { x: 11, y: 2, face: 'right' },
      npc:      { x: 14, y: 2, face: 'right' },
      altar:    { x: 17, y: 2, face: 'right' },
      run:      { x: 2,  y: 5, face: 'right' },
      block:    { x: 7,  y: 5, face: 'right' },
      walk:     { x: 3,  y: 4, face: 'right' }
    },
    entities: [
      { t: 'exit', x: 1, y: 1, to: 'k_two', spawn: 'in' },
      { t: 'pickup', x: 6, y: 2, item: 'k22-gem', lines: ['a gem.'] },
      { t: 'save', x: 9, y: 2 },
      { t: 'sign', x: 12, y: 2, lines: ['a sign that says sign.'] },
      { t: 'npc', x: 15, y: 2, who: 'narr', lines: ['one.', 'two.', 'three.'] },
      { t: 'altar', x: 18, y: 2, needs: 'k22-gem', gives: 'k22-lit', lines: ['it takes the gem.'], empty: ['it wants a gem.'] },
      { t: 'npc', x: 3, y: 5, run: () => { log.ran++; } },
      { t: 'block', x: 8, y: 5, push: true },
      { t: 'plate', x: 10, y: 5 },
      { t: 'trigger', x: 5, y: 4, w: 1, h: 1, run: () => { log.trig++; } }
    ],
    onEnter: () => { log.entered++; },
    onExit: () => { log.exited++; },
    onSolved: () => { log.solved++; },
    onReset: () => { log.reset++; }
  });
  E.register('k_two', {
    tileset: 't22b',
    tiles: ['#####', '#...#', '#...#', '#####'].join('\n'),
    spawns: { in: { x: 2, y: 1 }, default: { x: 2, y: 2 } },
    entities: [
      { t: 'exit', x: 3, y: 1, to: 'k_all', spawn: 'default', locked: 'k22-key', lines: ['locked. it wants a key.'] }
    ]
  });
  return log;
}

/* ═══ 1. the surface ═════════════════════════════════════════════*/
console.log('\n1. the public API and the hook API');
{
  const { NEU } = boot();
  const E = NEU.engine;
  for (const k of ['register', 'tileset', 'enter', 'leave', 'go', 'confirmExit', 'where',
                   'zone', 'tilesets', 'warp', 'drawPlayer'])
    ok('engine.' + k + ' is a function', typeof E[k] === 'function');
  ok('engine.running is a boolean', typeof E.running === 'boolean');
  ok('engine.rooms lists the shipped rooms', Array.isArray(E.rooms) && E.rooms.length >= 20);
  ok('engine.TILE is 16', E.TILE === 16);
  ok('engine.SCALE is a positive whole number', Number.isInteger(E.SCALE) && E.SCALE > 0);
  ok('engine.api is an object', !!E.api && typeof E.api === 'object');
  for (const k of ['say', 'flag', 'flagged', 'give', 'has', 'go', 'leave', 'busy', 'entHere',
                   'reset', 'check', 'ents', 'solved', 'markSolved'])
    ok('api.' + k + ' is a function', typeof E.api[k] === 'function');
  ok('room is null before entering', E.room === null && E.api.room === null);
  ok('zone is null before entering', E.zone() === null);
}

/* ═══ 2. every kind the rooms use is handled ═════════════════════*/
console.log('\n2. the shipped rooms only use kinds the engine knows');
{
  const KNOWN = ['exit', 'pickup', 'save', 'sign', 'npc', 'altar', 'block', 'plate', 'brazier', 'trigger'];
  const { rooms } = loadRooms(ROOT, ['rooms-a.js', 'rooms-d.js', 'rooms-g.js']);
  const unknown = [];
  let n = 0;
  for (const [id, r] of Object.entries(rooms)) {
    for (const e of (r.entities || [])) {
      n++;
      if (!KNOWN.includes(e.t) && typeof e.run !== 'function') unknown.push(id + ':' + e.t);
    }
  }
  ok('the loader saw the entities (' + n + ')', n > 60);
  ok('>>> every entity is a known kind or carries a run hook <<<', unknown.length === 0);
  if (unknown.length) console.log('       ' + unknown.join(', '));
}

/* ═══ 3. what each kind does ═════════════════════════════════════*/
console.log('\n3. kinds behave');
{
  const { w, NEU, said } = boot();
  NEU.save.wipe();
  const log = testRooms(NEU);
  const E = NEU.engine;
  const lastSaid = () => (said[said.length - 1] || { lines: [] }).lines.join(' ');

  ok('entering returns true', E.enter('k_all', 'default') === true);
  ok('running, in the room, onEnter once', E.running && E.room === 'k_all' && log.entered === 1);
  ok('zone() is the tileset name', E.zone() === 't22');
  ok('where() reports room + spawn', E.where().room === 'k_all' && E.where().spawn === 'default');
  ok('api.room is the live definition', E.api.room && E.api.room.id === 'k_all');
  const p0 = E.api.player;
  ok('spawn lands at the cell centre, feet on the cell bottom',
     p0.x === 2.5 * 16 && p0.y === 3 * 16 && p0.face === 'right');

  /* pickup */
  E.warp('k_all', 'pickup'); await wait(20);
  await press(w);
  ok('>>> a pickup gives its item <<<', NEU.save.has('k22-gem'));
  ok('and says its lines', /a gem/.test(lastSaid()));
  ok('and is gone from the room', E.api.ents().some(e => e.t === 'pickup' && e.dead));

  /* save */
  E.warp('k_all', 'save'); await wait(600);
  NEU.save.data.room = null;
  await press(w);
  ok('>>> a save point captures the room <<<', NEU.save.data.room === 'k_all');
  ok('and says so', /saved/.test(lastSaid()));

  /* sign */
  E.warp('k_all', 'sign'); await wait(600);
  if (NEU.talk.close) NEU.talk.close();
  await press(w);
  ok('>>> a sign reads its lines <<<', /sign that says sign/.test(lastSaid()));

  /* npc */
  E.warp('k_all', 'npc'); await wait(600);
  if (NEU.talk.close) NEU.talk.close();
  await press(w);
  ok('>>> an npc says its lines <<<', /one\..*two\..*three\./.test(lastSaid()));

  /* pickups stay taken across a re-entry — while you still hold the
     item. (v1 keys "taken" off the inventory, so a pickup whose item
     was later spent at an altar comes back: a v2 target, see §8.) */
  E.leave();
  E.enter('k_all', 'altar'); await wait(30);
  ok('>>> a taken pickup stays taken after re-entering <<<',
     E.api.ents().some(e => e.t === 'pickup' && e.dead));

  /* altar: needs the gem we picked up */
  E.warp('k_all', 'altar'); await wait(600);
  if (NEU.talk.close) NEU.talk.close();
  await press(w);
  ok('>>> an altar takes what it needs <<<', !NEU.save.has('k22-gem'));
  ok('and sets what it gives', NEU.save.flagged('k22-lit'));
  await wait(600);
  if (NEU.talk.close) NEU.talk.close();
  await press(w);
  ok('a second offer with nothing in hand says it is empty', /wants a gem/.test(lastSaid()));

  /* run hook beats lines */
  E.warp('k_all', 'run'); await wait(600);
  await press(w);
  ok('>>> an npc with a run hook runs it <<<', log.ran === 1);

  /* the 500ms re-interact guard */
  await press(w);
  ok('pressing again inside 500ms does not fire twice', log.ran === 1);
  await wait(560);
  await press(w);
  ok('after the cooldown it fires again', log.ran === 2);

  /* exits */
  E.warp('k_all', 'exitOpen'); await wait(600);
  await press(w);
  ok('>>> an open exit takes you through <<<', await until(() => E.room === 'k_two'));
  ok('onExit ran for the room you left', log.exited >= 1);
  ok('you land on the spawn the exit named', E.where().spawn === 'in');
  ok('zone follows the room', E.zone() === 't22b');
  await until(() => !E.api.room || true, 400);
  await wait(500);
  if (NEU.talk.close) NEU.talk.close();
  await press(w);
  await wait(400);
  ok('>>> a locked exit stays shut <<<', E.room === 'k_two');
  ok('and says what it wants', /wants a key/.test(lastSaid()));
  NEU.save.flag('k22-key', 1);
  await wait(560);
  await press(w);
  ok('>>> once its flag is set, it opens <<<', await until(() => E.room === 'k_all'));
  E.leave();
  ok('leave() stops the engine', E.running === false);
  ok('and hides the room', w.document.getElementById('eng').hidden === true);
}

/* ═══ 4. blocks, plates, reset ═══════════════════════════════════*/
console.log('\n4. push, solve, reset');
{
  const { w, NEU } = boot();
  NEU.save.wipe();
  const log = testRooms(NEU);
  const E = NEU.engine;
  E.enter('k_all', 'block'); await wait(30);
  const blk = () => E.api.ents().find(e => e.t === 'block');
  ok('the block starts at 8,5', blk().x === 8 && blk().y === 5);
  await press(w);
  ok('>>> e against a block pushes it one cell <<<', blk().x === 9 && blk().y === 5);
  ok('not solved yet', log.solved === 0);
  /* the player is still at 7,5 facing right; the block is at 9 — walk
     up to it (warp would respawn the entities and undo the push) */
  key(w, 'ArrowRight');
  await until(() => Math.floor(E.api.player.x / 16) >= 8, 2000);
  key(w, 'ArrowRight', 'keyup');
  await wait(30);
  await wait(520);
  await press(w);
  ok('>>> the block reaches the plate <<<', blk().x === 10);
  ok('>>> and the room is solved <<<', log.solved === 1);
  ok('api.entHere finds it on the plate', !!E.api.entHere(10, 5, 'block'));
  /* v1 refuses any reset in the first 4s after page load (lastReset
     starts at 0, not -Infinity) — a v2 target. Wait it out here. */
  await until(() => w.performance.now() > 4100, 6000);
  E.api.reset();
  ok('>>> a reset puts the block back <<<', blk().x === 8 && blk().y === 5);
  ok('and calls the room\'s onReset', log.reset === 1);
  E.api.reset();
  ok('a second reset inside 4s is refused', log.reset === 1);
  E.leave();

  /* ice: a block pushed onto ice keeps going */
  const { w: w2, NEU: N2 } = boot();
  const E2 = N2.engine;
  E2.tileset('ice22', { solid: '#', colours: {} });
  E2.register('k_ice', {
    tileset: 'ice22',
    tiles: ['##########', '#..iiii..#', '##########'].join('\n'),
    spawns: { default: { x: 1, y: 1, face: 'right' } },
    entities: [{ t: 'block', x: 2, y: 1, push: true }]
  });
  E2.enter('k_ice', 'default'); await wait(30);
  await press(w2);
  const b2 = E2.api.ents()[0];
  ok('>>> a block on ice slides to the end of the ice <<<', b2.x === 7, 'x=' + b2.x);
  E2.leave();
}

/* ═══ 5. walking ═════════════════════════════════════════════════*/
console.log('\n5. walking, walls, triggers');
{
  const { w, NEU } = boot();
  NEU.save.wipe();
  const log = testRooms(NEU);
  const E = NEU.engine;
  E.enter('k_all', 'walk'); await wait(30);
  const x0 = E.api.player.x;
  /* Wait for the outcome, not a fixed time: under load the RAF stub
     delivers fewer frames and v1 caps each frame's dt, so a fixed hold
     simulates less walking on a slow machine. */
  key(w, 'ArrowRight');
  await until(() => E.api.player.x - x0 > 30 && log.trig >= 1, 4000);
  key(w, 'ArrowRight', 'keyup');
  await wait(60);
  const x1 = E.api.player.x;
  ok('>>> holding right walks right <<<', x1 - x0 > 30);
  ok('and faces right', E.api.player.face === 'right');
  ok('>>> walking over a trigger runs it <<<', log.trig >= 1);
  const x2 = E.api.player.x;
  await wait(200);
  ok('releasing stops you (within a few units)', Math.abs(E.api.player.x - x2) < 4);

  /* walls: hold up for a long time, you stop at the wall */
  key(w, 'ArrowUp');
  await until(() => E.api.player.y <= 16 + 8 + 1, 4000);
  await wait(300);                     /* keep pushing: it must not go further */
  key(w, 'ArrowUp', 'keyup');
  await wait(60);
  const y = E.api.player.y;
  /* feet box is PLAYER_H tall: its top stops at row 0's bottom edge —
     never inside it, and no further away than one frame's travel (a
     sub-step that would enter the wall is refused whole, and v1 caps a
     frame at 33ms ≈ 3.2u, so a loaded machine stops a little short) */
  ok('>>> walls stop you <<< (y=' + y.toFixed(2) + ')', y >= 16 + 8 && y < 16 + 8 + 3.5);
  ok('faces up', E.api.player.face === 'up');

  /* busy() freezes input */
  E.api.busy(true);
  const xb = E.api.player.x;
  key(w, 'ArrowLeft'); await wait(300); key(w, 'ArrowLeft', 'keyup');
  ok('>>> api.busy(true) freezes the player <<<', E.api.player.x === xb);
  E.api.busy(false);
  E.leave();

  /* no tunnelling: a 1-tile wall, a long hold */
  const { w: w3, NEU: N3 } = boot();
  const E3 = N3.engine;
  E3.tileset('tw', { solid: '#', colours: {} });
  E3.register('k_wall', {
    tileset: 'tw',
    tiles: ['##########', '#...#....#', '#...#....#', '#...#....#', '##########'].join('\n'),
    spawns: { default: { x: 2, y: 2 } }
  });
  E3.enter('k_wall', 'default'); await wait(30);
  key(w3, 'ArrowRight');
  await until(() => E3.api.player.x >= 4 * 16 - 6, 3000);   /* reached the wall… */
  await wait(800);                                           /* …and kept pushing */
  key(w3, 'ArrowRight', 'keyup');
  ok('>>> holding into a 1-tile wall never tunnels <<<', E3.api.player.x < 4 * 16);
  E3.leave();
}

/* ═══ 6. reach.mjs agrees with the engine ════════════════════════*/
console.log('\n6. the walkability proof uses the engine\'s numbers');
{
  const R = fs.readFileSync(path.join(ROOT, 'tests', 'reach.mjs'), 'utf8');
  const src = ENGINE_FILES.map(f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8')).join('\n');
  const num = (re, s) => { const m = s.match(re); return m ? +m[1] : NaN; };
  const rT = num(/TILE\s*=\s*(\d+)/, R), rR = num(/REACH\s*=\s*(\d+)/, R), rH = num(/PLAYER_H\s*=\s*(\d+)/, R);
  ok('TILE agrees (' + rT + ')', rT === num(/\bTILE\s*=\s*(\d+)/, src));
  ok('REACH agrees (' + rR + ')', rR === num(/\bREACH\s*=\s*(\d+)/, src));
  ok('PLAYER_H agrees (' + rH + ')', rH === num(/PLAYER_H\s*=\s*(\d+)/, src));
}

/* ═══ 7. ES5 ═════════════════════════════════════════════════════*/
console.log('\n7. the engine files are ES5');
{
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1')
                      .replace(/'(?:\\.|[^'\\\n])*'/g, "''").replace(/"(?:\\.|[^"\\\n])*"/g, '""');
  for (const f of ENGINE_FILES) {
    const s = strip(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'));
    const hits = [];
    if (/\b(const|let)\s+[A-Za-z_$]/.test(s)) hits.push('let/const');
    if (/=>/.test(s)) hits.push('arrow');
    if (/`/.test(s)) hits.push('template literal');
    if (/\?\./.test(s)) hits.push('optional chaining');
    if (/\bclass\s+[A-Z]/.test(s)) hits.push('class');
    ok(f + ' is ES5' + (hits.length ? ' (' + hits.join(', ') + ')' : ''), hits.length === 0);
  }
}

console.log('\n' + (fail === 0 ? `ALL PASS (${pass})` : `${fail} FAILED, ${pass} passed`));
process.exit(fail === 0 ? 0 : 1);
