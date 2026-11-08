/* fixes186.mjs: final-finish batch 1, the telegraph rubric over every attack.
   Run: node tests/fixes186.mjs

   Every attack of every pool shows a telegraph at least 24 frames (0.4 s)
   before its first hurting thing, at phase 0 and phase 2. Excluded, with
   the reason: the final all-out has none by spec 3B; the summons and the
   transition are invulnerable set pieces with their own checks; the shadow
   flames fly a visible 32 f to their ringed burst point. */
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedRandom } from './lib/seed.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MODULES = [
  'core/quest.js', 'core/save.js', 'core/keys.js', 'core/juice.js', 'core/danmaku.js',
  'data/sheets.js', 'core/engine-look.js', 'core/engine-kinds.js', 'core/engine.js',
  'act4/act4.js', 'core/rand.js', 'act4/scal-attacks.js', 'act4/boss-scal.js', 'act4/scal-worm.js',
  'act4/scal-seekers.js', 'core/settings.js', 'core/keys.js'
];
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };
const EPS = 0.5;
/* a segment is out when either end is out */
const far = (s, a) => !inside({ x: s.x0, y: s.y0 }, a) || !inside({ x: s.x1, y: s.y1 }, a);

function boot(store) {
  const dom = new JSDOM(HTML, { pretendToBeVisual: true, url: 'https://www.neu.ac/', runScripts: 'outside-only' });
  const w = dom.window;
  w.document.querySelectorAll('noscript').forEach(n => n.remove());
  const st = w.setTimeout.bind(w), si = w.setInterval.bind(w);
  w.setTimeout  = (f, ms, ...a) => st(f, (ms || 0) * 0.05, ...a);
  w.setInterval = (f, ms, ...a) => si(f, Math.max(1, (ms || 0) * 0.05), ...a);
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
  w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {
    get(_, k) {
      if (k === 'canvas') return {};
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop: () => {} });
      if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (typeof k === 'string') return () => {};
      return undefined;
    }, set() { return true; }
  });
  w.scrollTo = () => {};
  w.requestAnimationFrame = cb => w.setTimeout(() => cb(Date.now()), 16);
  w.Element.prototype.getBoundingClientRect = () =>
    ({ left: 100, top: 100, right: 146, bottom: 146, width: 46, height: 46, x: 100, y: 100 });
  seedRandom(w, 185);
  if (store) for (const k of Object.keys(store)) w.localStorage.setItem(k, store[k]);
  for (const f of MODULES) {
    const p = path.join(ROOT, 'js', f);
    if (!fs.existsSync(p)) { console.log('  !! missing ' + f); continue; }
    try { w.eval(fs.readFileSync(p, 'utf8')); }
    catch (e) { console.log('  !! ' + f + ': ' + e.message); }
  }
  w.NEU.__w = w;
  return w.NEU;
}


/* ArenaShrinkFlameWalls: no telegraphs, spec 3B. The summons and the transition are invulnerable set pieces with their own checks (fixes45/47/51).
   ShadowDemon_ReleaseExplodingShadowBlasts: each flame is itself the telegraph, a visible 32 f flight to its ringed burst point. */
const SPECIAL = new Set(['ArenaShrinkFlameWalls', 'SummonSepulcher', 'SummonBrothers', 'SummonSeekers', 'PhaseTransition',
                         'ShadowDemon_ReleaseExplodingShadowBlasts']);
function fresh(store) {
  const NEU = boot(store);
  NEU.scal.invincible(true);
  NEU.scal.open();
  NEU.scal.simulate(3.0);
  return NEU;
}
/* a recording 2d context: every stroke() and fillRect() with the width / colour in force */
function rec() {
  const log = { strokes: [], fills: [] };
  const c = {
    lineWidth: 1, strokeStyle: '', fillStyle: '', globalAlpha: 1, globalCompositeOperation: 'source-over', lineCap: 'butt',
    save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, rect() {}, clip() {}, closePath() {},
    translate() {}, rotate() {}, scale() {}, fill() {}, setLineDash() {}, drawImage() {}, fillText() {}, strokeText() {},
    createLinearGradient() { return { addColorStop() {} }; }, createRadialGradient() { return { addColorStop() {} }; },
    stroke() { log.strokes.push({ w: c.lineWidth, s: String(c.strokeStyle) }); },
    strokeRect() { log.strokes.push({ w: c.lineWidth, s: String(c.strokeStyle), rect: true }); },
    fillRect(x, y, w, h) { log.fills.push({ x, y, w, h, f: String(c.fillStyle) }); }
  };
  return { c, log };
}
const alphaOf = f => { const m = /rgba\([^)]*,\s*([\d.]+)\)/.exec(f); return m ? +m[1] : 1; };

console.log('\n1. every attack telegraphs at least 24 frames before it hurts');
{
  const NEU = fresh(), S = NEU.scal, A = NEU.scalAtk;
  const names = [].concat.apply([], A.pools).filter((n, i, a) => a.indexOf(n) === i && !SPECIAL.has(n));
  names.push('DesperationPhase');
  const bad = [];
  let checked = 0;
  for (const L of [0, 2]) for (const name of names) {
    S.open(); S.simulate(3.0);
    S.force(name); A.setLevel(L); S.force(name);
    let teleAt = -1, harmAt = -1;
    for (let f = 0; f < 900 && S.attack === name && harmAt < 0; f++) {
      S.simulate(1 / 60);
      const fr = A.frame();
      const bm = A.beam();
      const tele = A.debug.warns.length + A.teles().length + A.hexes().length + (A.lanes() ? 1 : 0) +
        A.lasers().filter(l => fr < l.at).length + A.rend().filter(r => r.phase === 'tele').length +
        A.bolts().filter(b => fr < b.at).length + A.bones().filter(b => fr < b.at).length +
        A.lava().filter(b => fr < b.at).length + (bm && bm.phase === 'charge' ? 1 : 0);
      const harm = S.bullets.length + A.lasers().filter(l => fr >= l.at).length + A.rend().filter(r => r.phase !== 'tele').length +
        A.bolts().filter(b => fr >= b.at).length + A.bones().filter(b => fr >= b.at).length +
        A.lava().filter(b => fr >= b.at).length + (bm && bm.phase !== 'charge' ? 1 : 0);
      if (teleAt < 0 && tele > 0) teleAt = f;
      if (harm > 0) harmAt = f;
    }
    checked++;
    const lead = harmAt < 0 ? 999 : (teleAt < 0 ? -1 : harmAt - teleAt);
    if (lead < 24) bad.push(name + '@L' + L + ' lead ' + lead);
  }
  ok('all ' + checked + ' attack runs show a telegraph >= 24 f ahead of their first hurt' + (bad.length ? ' (' + bad.join(', ') + ')' : ''), bad.length === 0);
}


console.log('\n' + pass + ' passed, ' + fail + ' failed');
console.log(fail ? 'SOME FAIL' : 'ALL PASS');
process.exit(fail ? 1 : 0);
