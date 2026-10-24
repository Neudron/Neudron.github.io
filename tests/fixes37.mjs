/* fixes37.mjs — two small things in two files.
   Run: node tests/fixes37.mjs

   B6. Damage numbers. Every hit the player lands in the Calamitas fight
   pops its damage as a small number that rises and fades, so a fight
   whose health bar is too far away to read still says the strike landed
   and how hard. The drives below reach damageTarget the way a player
   does: f fires a shot, the shot homes onto a heart or onto her, and the
   hit runs through damageTarget. Nothing in the module is called
   directly. The twelve-number cap needs more hits inside 0.7 s than a
   tap can make, so that drive plays the fight through to her: it clears
   the hearts with heavy orbs while stepping around the incoming fire,
   then stands inside her hit radius and fires heavy orbs back to back.

   K5. Arenas above the touch pad. On a phone the pad covers the bottom
   of the window, and the arena (centred in the whole window) lost its
   bottom edge under it. danmaku.arena() now fits the arena into the
   window minus the pad, and leaves every desktop number exactly as it
   was.

   The page's own script list is read from index.html, in order, minus
   page/ (as fixes32 does). The Sepulcher's hearts come from scal-worm.js,
   which fixes30's list leaves out.

   The frame clock is a fake: performance.now() is pinned to the pumped
   time, so juice's hit-stop freeze (which reads performance.now) and the
   fight's own dt move with the frames, not with the wall clock. Nothing
   here awaits, so the setTimeout-based scheduled attacks never fire
   mid-drive and every run is the same run. The seed is fixed, so the
   drive that reaches her is the same drive every time. */

import { JSDOM } from 'jsdom';
import { seedRandom } from './lib/seed.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const PAGE = read('index.html');
const MODULES = [...PAGE.matchAll(/<script src="(js\/[^"]+)"/g)]
  .map(m => m[1].slice('js/'.length))
  .filter(f => !f.startsWith('page/'));
const SEED = 20261024;
const DT = 0.016;      /* one pumped frame, in seconds */
const LIFE = 0.7;      /* how long a number lives, in seconds */

/* The numbers in flight. Before the getter exists this reads as empty,
   so a missing hook fails the checks instead of throwing. */
const popsOf = NEU => (NEU.scal && NEU.scal._pops) || [];

/* A stub that answers the calls the modules make, enough to keep them
   booting. No recording: nothing here checks sound. */
function audioStub(w) {
  class Param { constructor(v) { this.value = v; }
    setValueAtTime(v) { this.value = v; return this; }
    exponentialRampToValueAtTime(v) { this.value = v; return this; }
    linearRampToValueAtTime(v) { this.value = v; return this; }
    cancelScheduledValues() { return this; } }
  class Node { constructor(ctx) { this.ctx = ctx; this.out = []; }
    connect(d) { this.out.push(d); return d; } disconnect() {} }
  class Gain extends Node { constructor(ctx) { super(ctx); this.gain = new Param(1); ctx.gains.push(this); } }
  class Osc extends Node { constructor(ctx) { super(ctx); this.type = ''; this.frequency = new Param(0); this.detune = new Param(0); }
    start() {} stop() {} }
  class Src extends Node { constructor(ctx) { super(ctx); this.buffer = null; this.playbackRate = new Param(1); }
    start() {} stop() {} }
  class Filt extends Node { constructor(ctx) { super(ctx); this.type = ''; this.frequency = new Param(0); this.Q = new Param(1); } }
  class AC { constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 44100;
    this.destination = new Node(this); this.gains = []; w.__actx = this; }
    resume() { return Promise.resolve(); }
    createOscillator() { return new Osc(this); } createGain() { return new Gain(this); }
    createBufferSource() { return new Src(this); } createBiquadFilter() { return new Filt(this); }
    createBuffer(ch, n) { return { getChannelData: () => new Float32Array(n) }; } }
  w.AudioContext = AC;
  w.webkitAudioContext = AC;
}

/* Same boot as fixes30: the page's own markup, <noscript> removed (under
   runScripts:'outside-only' it hides every panel), a Proxy canvas that is
   never null, and the page's scripts evaluated in order. The seed goes in
   before the first script, so the load-time draws are the same too. */
function boot() {
  const dom = new JSDOM(PAGE, { pretendToBeVisual: true, url: 'https://www.neu.ac/',
                                runScripts: 'outside-only' });
  const w = dom.window;
  w.document.querySelectorAll('noscript').forEach(n => n.remove());
  seedRandom(w, SEED);
  w.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe() {} disconnect() {} };
  w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
  audioStub(w);
  w.HTMLMediaElement.prototype.play = () => Promise.resolve();
  const noop = () => {};
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
  return { w, NEU: w.NEU };
}

/* The frame pump. Frames are queued by requestAnimationFrame and run only
   when the test asks, one clock step (16 ms) each. onFrame, if given, is
   called after every frame, so a check sees each step and not a batch. */
function driveClock(w, NEU, onFrame) {
  let clock = w.performance.now();
  w.performance.now = () => clock;
  let frames = [];
  w.requestAnimationFrame = cb => { frames.push(cb); return frames.length; };
  const pump1 = () => {
    clock += 16;
    const q = frames; frames = [];
    for (const cb of q) cb(clock);
    if (onFrame) onFrame();
  };
  const pump = n => { for (let i = 0; i < n; i++) pump1(); };
  const pumpUntil = (fn, max) => {
    for (let i = 0; i < max; i++) { if (fn()) return true; pump1(); }
    return fn();
  };
  const key = (ty, k) => w.dispatchEvent(new w.KeyboardEvent(ty, { key: k, bubbles: true }));
  /* A tap of f: charging starts on keydown and the shot leaves on keyup.
     One frame held is a plain bolt (power well under the heavy 0.35). The
     pump before it clears the 0.3 s shot cooldown. */
  const shoot = () => { pump(22); key('keydown', 'f'); pump(1); key('keyup', 'f'); };
  /* Opens the fight and plays it to the Sepulcher: intro, then wall 0,
     which ends by spawning the ten hearts. */
  const openToHearts = () => {
    NEU.scal.open();
    pump(163);
    pumpUntil(() => NEU.scal.hearts > 0, 800);
    return NEU.scal.hearts;
  };
  const hearts = () => NEU.scal.heartPos;
  return { pump, pump1, pumpUntil, shoot, openToHearts, hearts, key };
}

/* ── stepping around the fire ──────────────────────────────────────
   Only the cap drive needs this. A closing shot, dart or the worm's head
   inside its reach moves the soul across its path; the hit it would
   have taken is what ends a drive early, so the drive steps out of it. */
function dodger(NEU, d) {
  const soul = () => ({ x: NEU.scal.px, y: NEU.scal.py });
  const threat = R => {
    const s = soul();
    const bs = NEU.scal.bullets.concat(NEU.scal.wormDarts || [], NEU.scal.seekerDarts || []);
    let best = null, bd = Infinity;
    for (const b of bs) {
      const dx = b.x - s.x, dy = b.y - s.y, dist = Math.hypot(dx, dy);
      if (dist > R || dx * b.vx + dy * b.vy >= 0) continue;   /* not closing */
      if (dist < bd) { bd = dist; best = b; }
    }
    if (best) return { vx: best.vx, vy: best.vy };
    const hp = NEU.scal.wormPos;
    if (hp && Math.hypot(hp.x - s.x, hp.y - s.y) < 60) return { vx: s.x - hp.x, vy: s.y - hp.y };
    return null;
  };
  const run = (dx, dy, n) => {
    if (dx < 0) d.key('keydown', 'ArrowLeft'); else if (dx > 0) d.key('keydown', 'ArrowRight');
    if (dy < 0) d.key('keydown', 'ArrowUp'); else if (dy > 0) d.key('keydown', 'ArrowDown');
    d.pump(n);
    d.key('keyup', 'ArrowLeft'); d.key('keyup', 'ArrowRight');
    d.key('keyup', 'ArrowUp'); d.key('keyup', 'ArrowDown');
  };
  /* pump n frames, stepping out of any threat as it closes */
  const safe = (n, R = 90) => {
    for (let i = 0; i < n; i++) {
      const t = threat(R);
      if (!t) { d.pump1(); continue; }
      if (Math.abs(t.vx) > Math.abs(t.vy)) run(0, t.vy >= 0 ? -1 : 1, 4);
      else run(t.vx >= 0 ? -1 : 1, 0, 4);
    }
  };
  /* walk the soul to inside her hit radius, so each burst dart spawns on
     her and lands on the next frame */
  const approach = (near = 22) => {
    for (let k = 0; k < 200; k++) {
      const s = soul(), dx = NEU.scal.bx - s.x, dy = NEU.scal.by - s.y;
      if (Math.hypot(dx, dy) < near) return true;
      const ax = Math.abs(dx) > 3 ? (dx > 0 ? 1 : -1) : 0;
      const ay = Math.abs(dy) > 3 ? (dy > 0 ? 1 : -1) : 0;
      if (ax) d.key('keydown', ax > 0 ? 'ArrowRight' : 'ArrowLeft');
      if (ay) d.key('keydown', ay > 0 ? 'ArrowDown' : 'ArrowUp');
      d.pump1();
      d.key('keyup', 'ArrowLeft'); d.key('keyup', 'ArrowRight');
      d.key('keyup', 'ArrowUp'); d.key('keyup', 'ArrowDown');
    }
    return false;
  };
  /* a heavy orb: f held long enough for power 0.35 or more, then released */
  const orb = () => { safe(22); d.key('keydown', 'f'); safe(27); d.key('keyup', 'f'); };
  return { safe, approach, orb };
}

/* The pre-change arena formula, kept verbatim as the oracle the no-pad
   numbers are checked against. */
function oldArena(w, h, maxW, maxH, padY) {
  var winW = w || 800, winH = h || 600;
  var AW = Math.min(maxW || 760, winW - 48);
  var AH = Math.min(maxH || 520, winH - 190);
  var AX = ((winW - AW) / 2) | 0;
  var AY = ((winH - AH) / 2 + (padY !== undefined ? padY : 22)) | 0;
  return { AX: AX, AY: AY, AW: AW, AH: AH };
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const near = (a, b) => Math.abs(a - b) < 0.5;

/* ═══ 1. K5: arenas keep clear of the touch pad ═══════════════════*/
console.log('\n1. the arena fits above the touch pad (K5)');
{
  const { w, NEU } = boot();
  const arena = (...a) => NEU.danmaku.arena(...a);

  const a = arena(1280, 800, 760, 520, 22);
  ok('no pad: arena(1280,800,760,520,22) is unchanged (AX 260, AY 162, AW 760, AH 520)',
     a.AX === 260 && a.AY === 162 && a.AW === 760 && a.AH === 520);

  let grid = true;
  for (const [W, H] of [[1280, 800], [1920, 1080], [1024, 768], [800, 600], [390, 844], [844, 390]])
    for (const [mw, mh, py] of [[760, 520, 22], [700, 460, 24], [760, 500, 20], [620, 420, 22]])
      if (!same(arena(W, H, mw, mh, py), oldArena(W, H, mw, mh, py))) grid = false;
  ok('no pad: every size and caller setting matches the pre-change formula', grid);

  /* A phone, as the pad lays it out: 390 x 844, with the pad at top 644
     (200px tall, pinned to the bottom edge). The engine's measurePad()
     reads the same box, so the arena and the play area agree. */
  w.innerWidth = 390; w.innerHeight = 844;
  const pad = w.document.createElement('div');
  pad.className = 'tpad';
  pad.hidden = false;
  pad.getBoundingClientRect = () => ({ left: 0, top: 644, right: 390, bottom: 844,
                                       width: 390, height: 200, x: 0, y: 644 });
  w.document.body.appendChild(pad);

  const b = arena(390, 844, 700, 460, 24);   /* boss-scal's own call */
  ok('visible pad: the arena bottom clears the pad (AY + AH <= 644)', b.AY + b.AH <= 644);
  ok('visible pad: the arena still has height (AH > 0)', b.AH > 0);
  ok('visible pad: the arena stays inside the window width', b.AX >= 0 && b.AX + b.AW <= 390);

  pad.hidden = true;
  ok('a hidden pad is ignored, even with a box on it',
     same(arena(390, 844, 700, 460, 24), oldArena(390, 844, 700, 460, 24)));

  pad.hidden = false;
  pad.getBoundingClientRect = () => ({ left: 0, top: 644, right: 390, bottom: 644,
                                       width: 390, height: 0, x: 0, y: 644 });
  ok('a pad with no height is ignored (the engine skips it too)',
     same(arena(390, 844, 700, 460, 24), oldArena(390, 844, 700, 460, 24)));

  /* A phone held sideways: 844 x 390 with a 148px pad. Fitting above it
     would leave 242 - 190 = 52px of arena, so the arena keeps its old
     size there instead of collapsing. */
  w.innerWidth = 844; w.innerHeight = 390;
  pad.getBoundingClientRect = () => ({ left: 0, top: 242, right: 844, bottom: 390,
                                       width: 844, height: 148, x: 0, y: 242 });
  const side = arena(844, 390, 700, 460, 24);
  ok('>>> a sideways phone does not shrink the arena to a sliver (' + side.AH + 'px) <<<',
     side.AH >= 150 && same(side, oldArena(844, 390, 700, 460, 24)));
  w.innerWidth = 390; w.innerHeight = 844;
  w.document.body.removeChild(pad);
}

/* ═══ 2. B6: a hit pops its damage, rises, fades and expires ══════*/
console.log('\n2. a hit pops its damage, rises, fades and expires (B6)');
{
  const { w, NEU } = boot();
  const d = driveClock(w, NEU);
  NEU.settings.set('opt_particles', false);
  ok('the reduce-particles switch starts off', NEU.settings.particles === false);
  ok('the Sepulcher phase has its ten hearts', d.openToHearts() === 10);

  /* a hit that lands: one bolt at the nearest heart */
  d.shoot();
  ok('>>> a landed bolt pops a number <<<', d.pumpUntil(() => popsOf(NEU).length > 0, 300));
  const first = popsOf(NEU)[0];
  ok('the number is the damage dealt (1)', !!first && first.n === 1);
  ok('the number sits on the heart that was hit',
     !!first && d.hearts().some(h => near(h.x, first.x) && near(h.y, first.y0)));

  /* it rises: the drawn height moves up, the anchor does not */
  const y0 = first ? first.y0 : NaN;
  d.pump(6);
  const risen = popsOf(NEU)[0];
  ok('it rises as it ages', !!risen && risen.y < y0 && risen.y0 === y0);
  ok('and the rise stays inside 24 px', !!risen && y0 - risen.y <= 24);

  /* it expires at 0.7 s of fight time, not on a wall-clock timer */
  let lastAge = 0;
  for (let i = 0; i < 300 && popsOf(NEU).length > 0; i++) {
    lastAge = popsOf(NEU)[0].age;
    d.pump1();
  }
  ok('it is gone once its 0.7 s is up', popsOf(NEU).length === 0);
  ok('and it lived about 0.7 s (last seen at ' + lastAge.toFixed(3) + ' s)',
     lastAge >= 0.6 && lastAge < LIFE);

  /* closing the fight clears the numbers, and so does opening it again */
  d.shoot();
  d.pumpUntil(() => popsOf(NEU).length > 0, 300);
  ok('a second hit is in flight before the close', popsOf(NEU).length > 0);
  NEU.scal.close();
  ok('closing the fight clears the numbers', popsOf(NEU).length === 0);
  NEU.scal.open();
  d.pump1();
  ok('opening the fight starts with none', popsOf(NEU).length === 0);
}

/* ═══ 3. B6: the cap, in a fight played through to her ════════════*/
console.log('\n3. the cap holds at twelve and drops the oldest first (B6)');
{
  const { w, NEU } = boot();
  /* what each frame should look like, so the cap is seen without trusting
     the list's own length: a number that leaves while still young was
     dropped by the cap, not expired */
  let prev = [], peak = 0, youngDrops = 0, orderOk = true;
  const watch = () => {
    const now = popsOf(NEU);
    /* a frame where nothing aged (hit-stop holds the frame, so no number
       moves) cannot drop anything, and must not count its numbers as new */
    const still = now.length === prev.length && now.every((p, i) => p.age === prev[i].age);
    if (!still) {
      const newcomers = now.filter(p => Math.abs(p.age - DT) < 1e-6).length;
      const mustLive = prev.filter(p => p.age + DT < LIFE - 1e-6).length;
      const kept = now.length - newcomers;
      if (kept < mustLive) youngDrops += mustLive - kept;
    }
    if (now.length > peak) peak = now.length;
    for (let k = 1; k < now.length; k++) if (now[k].age > now[k - 1].age) orderOk = false;
    prev = now;
  };
  const d = driveClock(w, NEU, watch);
  NEU.settings.set('opt_particles', false);
  const g = dodger(NEU, d);
  d.openToHearts();

  /* clear the ten hearts with heavy orbs: each orb is four hits on the
     heart it lands on, and the dart burst reaches the next heart */
  let orbs = 0;
  while (NEU.scal.hearts > 0 && orbs < 14 && NEU.scal.soulHP > 0) {
    g.orb(); orbs++;
    for (let t = 0; t < 240 && NEU.scal.myShots.length > 0; t++) g.safe(1);
  }
  ok('the hearts fall to heavy orbs and the soul is still standing',
     NEU.scal.hearts === 0 && NEU.scal.soulHP > 0);
  /* stand inside her radius and fire orbs back to back: each one lands
     nine hits on her, and the next one lands before the first has aged out.
     The window after each orb steps around the fire like the rest. */
  g.approach(22);
  for (let o = 0; o < 4 && NEU.scal.soulHP > 0 && NEU.scal.mode === 'fight'; o++) {
    g.orb();
    for (let k = 0; k < 22; k++) g.safe(1);
  }
  ok('she takes the orb damage once the hearts are gone (her hp ' + NEU.scal.hp + ')',
     NEU.scal.hp < 240);
  ok('the cap engages: the list reaches twelve (peak ' + peak + ')', peak === 12);
  ok('and never goes past twelve', peak <= 12);
  ok('a number is dropped while still young, which only the cap does (' + youngDrops + ')',
     youngDrops > 0);
  ok('the list stays oldest-first, so the drop takes the oldest', orderOk);
}

/* ═══ 4. B6: particles on, no numbers at all ══════════════════════*/
console.log('\n4. with reduce particles on, no numbers spawn (B6)');
{
  const { w, NEU } = boot();
  const d = driveClock(w, NEU);
  NEU.settings.set('opt_particles', true);
  ok('>>> the reduce-particles switch reads on <<<', NEU.settings.particles === true);
  d.openToHearts();
  const before = NEU.scal.hearts;
  /* three bolts into the nearest heart (3 HP) break it. Sample every frame
     of every shot, so a number that spawns and is gone within one step
     still shows. */
  let peakSeen = 0;
  for (let i = 0; i < 3; i++) {
    d.shoot();
    for (let f = 0; f < 200 && NEU.scal.myShots.length > 0; f++) {
      d.pump1();
      peakSeen = Math.max(peakSeen, popsOf(NEU).length);
    }
  }
  ok('the hits still land: one heart breaks after three bolts', NEU.scal.hearts === before - 1);
  ok('>>> with particles on, no damage numbers spawn <<<', peakSeen === 0);
}

/* ═══ 5. B6: reduced motion keeps the number, and holds it still ══*/
console.log('\n5. under reduced motion the number stays where it was hit (B6)');
{
  const { w, NEU } = boot();
  const d = driveClock(w, NEU);
  Object.defineProperty(NEU.settings, 'reduced', { get: () => true, configurable: true });
  NEU.settings.set('opt_particles', false);
  ok('reduced motion is read as on', NEU.settings.reduced === true);
  d.openToHearts();
  d.shoot();
  ok('under reduced motion a hit still pops a number', d.pumpUntil(() => popsOf(NEU).length > 0, 300));
  const p = popsOf(NEU)[0];
  const y0 = p ? p.y0 : NaN;
  let moved = false, seenFrames = 0;
  for (let i = 0; i < 30 && popsOf(NEU).length > 0; i++) {
    const q = popsOf(NEU)[0];
    if (q.y !== y0) moved = true;
    seenFrames++;
    d.pump1();
  }
  ok('and it does not drift up while it is on screen (' + seenFrames + ' frames)', seenFrames > 0 && !moved);
  ok('and it still expires', d.pumpUntil(() => popsOf(NEU).length === 0, 300));
}

/* ═══ summary ═══════════════════════════════════════════════════════*/
console.log(fail ? `${fail} FAILED, ${pass} passed` : `ALL PASS (${pass})`);
process.exit(fail ? 1 : 0);
