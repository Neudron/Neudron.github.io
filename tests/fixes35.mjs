/* fixes35.mjs — engine v2: what the rebuild promised, proven.
   Run: node tests/fixes35.mjs

   fixes22 pins the contract the rebuild had to KEEP. This suite pins
   what it had to CHANGE (.opencode/plans/engine-v2.md §4):

     1. the view fits the screen — an integer scale from the viewport
     2. movement has weight, and corners forgive
     3. you interact with what you face
     4. the camera eases, leads, and leaves room for the touch pad
     5. the two v1 bugs: spent pickups respawned; resets were refused
        for four seconds after the page loaded
     6. api.later dies with the visit
     7. a dark room is lit around the player, not the screen
     8. every kind and every plain npc has a look; weather follows the
        zone and stops under reduced motion
     9. "Leave X?" takes focus, traps Tab, and gives focus back        */

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
const MODULES = [
  'core/quest.js', 'core/save.js', 'core/juice.js', 'core/danmaku.js', 'data/sheets.js',
  'core/engine-look.js', 'core/engine-kinds.js', 'core/engine.js',
  'game/sword.js', 'game/sans.js', 'act4/act4.js', 'act4/rooms-a.js', 'act4/rooms-d.js',
  'act4/rooms-g.js', 'core/touch.js'
];

/* Frames are pumped by hand: deterministic, and fast. */
function boot({ w: vw = 1280, h: vh = 800 } = {}) {
  const dom = new JSDOM(HTML, { pretendToBeVisual: true, url: 'https://www.neu.ac/', runScripts: 'outside-only' });
  const w = dom.window;
  w.document.querySelectorAll('noscript').forEach(n => n.remove());
  Object.defineProperty(w, 'innerWidth', { value: vw, configurable: true });
  Object.defineProperty(w, 'innerHeight', { value: vh, configurable: true });
  w.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe() {} disconnect() {} };
  w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
  w.AudioContext = class { constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    resume() {} createOscillator() { return { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, detune: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
    createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} }, connect() {} }; }
    createBufferSource() { return { connect() {}, start() {}, stop() {} }; } createBiquadFilter() { return { frequency: {}, Q: {}, connect() {} }; }
    createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; } };
  w.webkitAudioContext = w.AudioContext;
  w.HTMLMediaElement.prototype.play = () => Promise.resolve();
  const noop = () => {};
  w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {
    get(_, k) {
      if (k === 'canvas') return {};
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop: noop });
      if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (typeof k === 'string') return () => {};
      return undefined;
    }, set() { return true; }
  });
  w.scrollTo = noop;
  let frames = [], t = 1000;
  w.requestAnimationFrame = cb => { frames.push(cb); return frames.length; };
  const pump = n => { for (let i = 0; i < n; i++) { const q = frames; frames = []; t += 1000 / 60; for (const cb of q) cb(t); } };
  w.performance.now = () => t;
  for (const f of MODULES) {
    try { w.eval(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8')); }
    catch (e) { console.log('  !! ' + f + ': ' + e.message); }
  }
  const said = [];
  const real = w.NEU.talk;
  const spy = function (l, who) { said.push([].concat(l).join(' ')); return real.call(this, l, who); };
  for (const k of Object.keys(real)) spy[k] = real[k];
  w.NEU.talk = spy;
  const key = (k, type = 'keydown', extra = {}) =>
    w.dispatchEvent(new w.KeyboardEvent(type, { key: k, bubbles: true, cancelable: true, ...extra }));
  const hold = (k, n) => { key(k); pump(n); key(k, 'keyup'); };
  return { w, NEU: w.NEU, doc: w.document, pump, key, hold, said, now: () => t };
}

/* ═══ 1. the view fits the screen ═════════════════════════════════*/
console.log('\n1. viewport scale');
for (const [vw, vh, want] of [[1280, 800, 4], [1920, 1080, 5], [390, 844, 2], [1024, 768, 3], [3840, 2160, 6], [320, 480, 2]]) {
  const { NEU } = boot({ w: vw, h: vh });
  NEU.engine.enter('a1_clearing', 'default');
  ok(`${vw}x${vh} → scale ${NEU.engine.SCALE} (want ${want})`, NEU.engine.SCALE === want);
  const v = NEU.engine.debug.view;
  ok(`  …shows at least 12 tiles across (${(v.w / 16).toFixed(1)})`, v.w / 16 >= 12 || vw / 32 < 12);
  NEU.engine.leave();
}

/* ═══ 2. weight, and corners ══════════════════════════════════════*/
console.log('\n2. movement has weight; corners forgive');
{
  const { NEU, pump, key, hold } = boot();
  const E = NEU.engine;
  E.tileset('t35', { solid: '#', colours: {} });
  E.register('k_open', { tileset: 't35',
    tiles: ['##########', '#........#', '#........#', '#........#', '##########'].join('\n'),
    spawns: { default: { x: 2, y: 2, face: 'right' } } });
  E.enter('k_open', 'default'); pump(30);
  key('ArrowRight'); pump(1);
  const v1 = E.debug.vel.x;
  pump(3);
  const v4 = E.debug.vel.x;
  pump(10);
  const vTop = E.debug.vel.x;
  ok('>>> speed ramps up rather than snapping (' + v1.toFixed(1) + ' → ' + v4.toFixed(1) + ' → ' + vTop.toFixed(1) + ') <<<',
     v1 > 0 && v1 < 40 && v4 > v1 && Math.abs(vTop - E.SPEED) < 0.01);
  key('ArrowRight', 'keyup'); pump(1);
  const vr = E.debug.vel.x;
  pump(8);
  ok('and eases out to a stop (' + vr.toFixed(1) + ' → ' + E.debug.vel.x.toFixed(1) + ')', vr > 0 && vr < E.SPEED && E.debug.vel.x === 0);
  E.leave();

  /* a one-tile doorway in a wall, approached 4 units off-centre */
  const b = boot();
  const E2 = b.NEU.engine;
  E2.tileset('t35', { solid: '#', colours: {} });
  E2.register('k_door', { tileset: 't35',
    tiles: ['##########', '#........#', '#........#', '####.#####', '#........#', '#........#', '##########'].join('\n'),
    spawns: { default: { x: 4, y: 1, face: 'down' } } });
  E2.enter('k_door', 'default'); b.pump(30);
  /* shift the player 4u right of the doorway's centre line */
  b.hold('ArrowRight', 3); b.pump(20);
  const off = E2.api.player.x - 4.5 * 16;
  ok('player stands off-centre of the door (' + off.toFixed(1) + 'u)', off >= 2 && off <= 5);
  b.hold('ArrowDown', 90);
  const row = Math.floor((E2.api.player.y - 1) / 16);
  ok('>>> walking straight down slides through the one-tile door (row ' + row + ') <<<', row >= 4);
  E2.leave();

  /* forgiveness never lets you through a solid wall */
  const c = boot();
  const E3 = c.NEU.engine;
  E3.tileset('t35', { solid: '#', colours: {} });
  E3.register('k_wall', { tileset: 't35',
    tiles: ['##########', '#........#', '#........#', '##########', '#........#', '##########'].join('\n'),
    spawns: { default: { x: 4, y: 1 } } });
  E3.enter('k_wall', 'default'); c.pump(30);
  c.hold('ArrowDown', 120);
  ok('>>> …and never through a wall with no gap <<<', Math.floor((E3.api.player.y - 1) / 16) <= 2);
  E3.leave();
}

/* ═══ 3. what you face wins ═══════════════════════════════════════*/
console.log('\n3. facing-aware targeting');
{
  const { NEU, pump, key, hold, said } = boot();
  const E = NEU.engine;
  E.tileset('t35', { solid: '#', colours: {} });
  const log = [];
  E.register('k_two', { tileset: 't35',
    tiles: ['#######', '#.....#', '#.....#', '#.....#', '#######'].join('\n'),
    spawns: { default: { x: 3, y: 2, face: 'right' } },
    entities: [
      { t: 'npc', x: 2, y: 2, run: () => log.push('west') },
      { t: 'npc', x: 4, y: 2, run: () => log.push('east') }
    ] });
  E.enter('k_two', 'default'); pump(30);
  key('e'); key('e', 'keyup'); pump(2);
  ok('>>> facing east, e talks to the east one <<<', log[log.length - 1] === 'east');
  hold('ArrowLeft', 2); pump(20);
  ok('turned to face west (' + E.api.player.face + ')', E.api.player.face === 'left');
  key('e'); key('e', 'keyup'); pump(2);
  ok('>>> facing west, e talks to the west one <<<', log[log.length - 1] === 'west');
  ok('the prompt follows the same choice', E.nearest() && E.nearest().x === 2);
  E.leave();
}

/* ═══ 4. camera ═══════════════════════════════════════════════════*/
console.log('\n4. camera eases, leads, and clears the pad');
{
  const { NEU, pump, key, hold, doc } = boot({ w: 640, h: 480 });
  const E = NEU.engine;
  E.enter('g0_hall', 'default'); pump(60);       /* 30 tiles wide: it scrolls */
  const c0 = E.debug.cam.x;
  /* walk far enough that the camera's target leaves the room's left
     clamp, then compare where it is with where it is heading */
  key('ArrowRight'); pump(150);
  const c1 = E.debug.cam.x;
  pump(1);
  const c1b = E.debug.cam.x;
  const v0 = E.debug.view;
  const target = E.api.player.x + 12 - v0.w / 2;
  pump(60);
  key('ArrowRight', 'keyup');
  const c2 = E.debug.cam.x;
  ok('>>> the camera follows, but eases rather than snapping (' + c0.toFixed(1) + ' → ' + c1.toFixed(1) + ' → ' + c2.toFixed(1) + ') <<<',
     c2 - c0 > 40 && (c1b - c1) < (target - c1) * 0.5 && (c1b - c1) > 0);
  /* lead: in a room too wide to clamp, the view centre sits ahead of
     the player in whichever direction they face */
  E.tileset('t35w', { solid: '#', colours: {} });
  E.register('k_wide', { tileset: 't35w',
    tiles: ['#'.repeat(80), '#' + '.'.repeat(78) + '#', '#' + '.'.repeat(78) + '#', '#'.repeat(80)].join('\n'),
    spawns: { default: { x: 40, y: 1, face: 'right' } } });
  E.warp('k_wide', 'default'); pump(120);
  const lead = () => E.debug.cam.x + E.debug.view.w / 2 - E.api.player.x;
  const right = lead();
  hold('ArrowLeft', 2); pump(150);
  const left = lead();
  ok('>>> the view leads the way you face (right ' + right.toFixed(1) + 'u, left ' + left.toFixed(1) + 'u) <<<',
     right > 8 && left < -8);
  E.warp('g0_hall', 'default'); pump(30);

  /* the touch pad: show it, and the usable view shrinks */
  /* touch.js builds its pad lazily, on first touch; stand one in */
  let pad = doc.querySelector('.tpad');
  if (!pad) { pad = doc.createElement('div'); pad.className = 'tpad'; doc.body.appendChild(pad); }
  ok('a pad element is present', !!pad);
  if (pad) {
    pad.hidden = false;
    pad.getBoundingClientRect = () => ({ left: 0, top: 480 - 180, right: 640, bottom: 480, width: 640, height: 180, x: 0, y: 300 });
    pump(40);
    ok('>>> the camera measures the pad (' + E.debug.padH + 'px) <<<', E.debug.padH === 180);
    ok('and the usable view is the screen minus the pad', Math.abs(E.debug.view.uh - (480 - 180) / E.debug.scale) < 0.01);
    pump(120);
    const py = (E.api.player.y - E.debug.cam.y) * E.debug.scale;
    ok('>>> the player stands above the pad (screen y ' + py.toFixed(0) + ' < 300) <<<', py < 300);
  }
  E.leave();
}

/* ═══ 5. the two v1 bugs ══════════════════════════════════════════*/
console.log('\n5. v1 bugs, fixed');
{
  const { NEU, pump, key } = boot();
  NEU.save.wipe();
  const E = NEU.engine;
  E.tileset('t35', { solid: '#', colours: {} });
  E.register('k_gem', { tileset: 't35',
    tiles: ['#######', '#.....#', '#.....#', '#######'].join('\n'),
    spawns: { default: { x: 2, y: 1, face: 'right' } },
    entities: [{ t: 'pickup', x: 3, y: 1, item: 'k35-gem' }, { t: 'block', x: 3, y: 2, push: true }, { t: 'plate', x: 5, y: 2 }] });
  E.enter('k_gem', 'default'); pump(30);
  key('e'); key('e', 'keyup'); pump(2);
  ok('took the gem', NEU.save.has('k35-gem'));
  NEU.save.take('k35-gem');
  ok('spent the gem elsewhere', !NEU.save.has('k35-gem'));
  E.leave(); E.enter('k_gem', 'default'); pump(30);
  ok('>>> a pickup whose item was spent does NOT come back <<<',
     E.api.ents().find(e => e.t === 'pickup').dead === true);

  /* a reset is allowed the moment the page loads (v1: refused for 4s) */
  const b = boot();
  b.NEU.engine.enter('b2_blocks', 'west'); b.pump(5);
  const before = b.said.length;
  b.NEU.engine.api.reset();
  ok('>>> the first reset after load is honoured <<<', /resets itself/.test(b.said.slice(before).join(' ')));
  b.NEU.engine.api.reset();
  ok('a second one inside 4s is still refused', /still settling/.test(b.said.slice(before).join(' ')));
}

/* ═══ 6. api.later ════════════════════════════════════════════════*/
console.log('\n6. api.later dies with the visit');
{
  const { NEU, pump, w } = boot();
  const E = NEU.engine;
  E.enter('a1_clearing', 'default'); pump(10);
  let fired = 0;
  E.api.later(() => { fired++; }, 20);
  ok('a timer is pending', E.debug.timers === 1);
  E.warp('a2_path', 'default');
  ok('changing room clears it', E.debug.timers === 0);
  await new Promise(r => setTimeout(r, 60));
  ok('>>> and it never fires into the next room <<<', fired === 0);
  E.api.later(() => { fired++; }, 10);
  await new Promise(r => setTimeout(r, 40));
  ok('a timer that stays in its room does fire', fired === 1);
  E.leave();
}

/* ═══ 7. dark rooms ═══════════════════════════════════════════════*/
console.log('\n7. a dark room is lit around the player');
{
  const { NEU, pump } = boot();
  const E = NEU.engine;
  E.enter('b6_dark', 'west'); pump(20);
  const room = E.api.room;
  ok('b6 is dark until solved', room.dark(E.api) > 0);
  ok('and has no carried light yet', room.light(E.api) === null);
  ok('>>> the engine still lights the player (lights: ' + E.debug.lights + ') <<<', E.debug.lights >= 1);
  E.leave();
}

/* ═══ 8. looks ════════════════════════════════════════════════════*/
console.log('\n8. every kind and every npc has a look');
{
  const { NEU } = boot();
  const K = NEU.engineKinds, L = NEU.engineLook;
  ok('kinds registry loaded', !!K && !!L);
  const { rooms } = loadRooms(ROOT, ['rooms-a.js', 'rooms-d.js', 'rooms-g.js']);
  const looks = {}, figures = [];
  for (const [id, r] of Object.entries(rooms)) for (const e of r.entities || []) {
    const k = K.get(e);
    if (!k.hidden && e.t !== 'exit') ok(`${id}: ${e.t}@${e.x},${e.y} has a draw`, typeof k.draw === 'function');
    if (e.t === 'npc' && !e.sheet) {
      const lk = L.lookFor(e);
      looks[lk] = (looks[lk] || 0) + 1;
      if (lk === 'figure') figures.push(id + '@' + e.x + ',' + e.y);
    }
  }
  ok('>>> no plain npc falls back to the generic figure (' + (figures.join(', ') || 'none') + ') <<<', figures.length === 0);
  ok('the run-only characters have their own looks', looks.merchant === 1 && looks.sans === 1 && looks.witch === 1);
  ok('the prize rooms got nine different props', ['certificate', 'chair', 'vending', 'tank', 'poster', 'piano', 'shelf', 'smalldoor', 'stairs'].every(k => looks[k] >= 1));
  for (const [name, p] of Object.entries(L.props)) {
    const w0 = p.rows[0].length;
    ok(`prop ${name}: every row is ${w0} wide`, p.rows.every(r => r.length === w0));
  }

  /* weather follows the zone, and stops under reduced motion */
  const b = boot();
  b.NEU.engine.enter('h1_storm', 'default'); b.pump(5);
  ok('the storm room has weather (' + b.NEU.engineLook.weather.count + ' drops)', b.NEU.engineLook.weather.kind === 'storm' && b.NEU.engineLook.weather.count > 0);
  b.NEU.engine.warp('a1_clearing', 'default'); b.pump(5);
  ok('the woods have their own', b.NEU.engineLook.weather.kind === 'woods');
  b.NEU.engineLook.setReduced(true);
  b.NEU.engine.warp('h1_storm', 'default'); b.pump(5);
  ok('>>> under reduced motion nothing drifts <<<', b.NEU.engineLook.weather.count === 0);
  b.NEU.engineLook.setReduced(false);
  b.NEU.engine.leave();
}

/* ═══ 9. "Leave X?" ═══════════════════════════════════════════════*/
console.log('\n9. the confirm prompt manages focus');
{
  const { NEU, doc, w } = boot();
  const opener = doc.createElement('button'); doc.body.appendChild(opener); opener.focus();
  let yes = 0;
  NEU.engine.confirmExit('Test', () => { yes++; });
  const ov = doc.getElementById('confirmExit');
  ok('it is an alertdialog, modal', ov && ov.getAttribute('role') === 'alertdialog' && ov.getAttribute('aria-modal') === 'true');
  ok('>>> focus moves into it <<<', ov.contains(doc.activeElement));
  const tab = new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  w.dispatchEvent(tab);
  ok('Tab lands on a button inside', doc.activeElement && doc.activeElement.getAttribute('data-ans') === 'yes');
  w.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  ok('Tab again moves to the other button', doc.activeElement.getAttribute('data-ans') === 'no');
  w.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  ok('>>> Enter on a focused "no" declines <<<', yes === 0 && !doc.getElementById('confirmExit'));
  ok('>>> and focus goes back where it was <<<', doc.activeElement === opener);
  NEU.engine.confirmExit('Test', () => { yes++; });
  w.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  ok('Enter with nothing picked is still "yes" (as the prompt says)', yes === 1);
}

console.log('\n' + (fail === 0 ? `ALL PASS (${pass})` : `${fail} FAILED, ${pass} passed`));
process.exit(fail === 0 ? 0 : 1);
