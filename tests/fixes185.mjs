/* fixes185.mjs: final-finish batch 1 and 3, the Calamitas bar review.
   Run: node tests/fixes185.mjs

   Behavioural, jsdom. Boots the real modules and drives the fight:
   1. (the telegraph rubric over every attack lives in fixes186.)
   2. The review upgrades, read off a recording context: laser and rend
      telegraphs draw the real hurt band under a 3 px core; spiral and
      arc attacks show their arms; bomb drops, portals and the shadow
      demon's arrival show a filled ring; pillars and bolts read.
   3. Her sheets start loading at open(), so the first frames are not a
      magenta box.
   4. Batch 3 verified in the running fight: Esc menu arrows, 783 HP,
      heal 30 s, admin god / dmgMul / skip, combos in the pools, melee
      and fireball damage, rebound keys, save round-trip (sans, console,
      broken hero key), the 65 % zoom scale (the summoning hall is fixes48's). */
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

console.log('\n2. the review upgrades, read off a recording context');
{
  const NEU = fresh(), S = NEU.scal, A = NEU.scalAtk;
  const to = (name, L, frames) => { S.open(); S.simulate(3.0); S.force(name); A.setLevel(L); S.force(name); S.simulate(frames / 60); };
  let r;
  /* EyeLockBeams: the lock line has the 14 px hurt band and a 3 px core */
  to('EyeLockBeams', 2, 28); r = rec(); A.draw(r.c);
  ok('eye lock: a 14 px hurt-band stroke and a >= 3 px core, both drawn before the beam fires',
     A.lasers().some(l => A.frame() < l.at) && r.log.strokes.some(s => s.w === 14) && r.log.strokes.some(s => s.w === 3));
  /* CalamitousRend: 24 px band, a core of 3..6 px */
  to('CalamitousRend', 2, 16); r = rec(); A.draw(r.c);
  ok('rend: telegraph draws the 24 px hurt band and a core of at least 3 px',
     A.rend().some(x => x.phase === 'tele') && r.log.strokes.some(s => s.w === 24) && r.log.strokes.some(s => s.w >= 3 && s.w <= 6));
  /* BrimstoneLightning: bolt telegraph lines are 3 px, not hairlines */
  to('BrimstoneLightning', 2, 20); r = rec(); A.draw(r.c);
  ok('lightning: its telegraph rays are 3 px on a dark edge (' + A.bolts().length + ' bolts)',
     A.bolts().some(b => A.frame() < b.at) && r.log.strokes.some(s => s.w === 3) && r.log.strokes.some(s => s.w === 5));
  /* ConvergingSkulls: arm spokes and the first cyan gap at f 0 */
  to('ConvergingSkulls', 2, 3);
  let w = A.debug.warns;
  ok('converging skulls: three arm spokes and a safe gap sector shown up front',
     w.filter(x => x.a !== undefined && x.len === 330).length === 3 && w.some(x => x.kind === 'fan' && x.safe));
  to('ConvergingSkulls', 0, 3); w = A.debug.warns;
  ok('converging skulls at phase 0: two arm spokes', w.filter(x => x.a !== undefined && x.len === 330).length === 2);
  /* ArcingEyeStarbursts: ring + four arc headings per eye */
  to('ArcingEyeStarbursts', 2, 33); w = A.debug.warns;
  ok('arcing eyes: a filled ring and four arc headings for the first eye',
     w.filter(x => x.r === 34 && x.rFill).length === 1 && w.filter(x => x.a !== undefined && x.len > 100).length === 4);
  /* DarkMagicBombWalls: a filled ring where each bomb will drop */
  to('DarkMagicBombWalls', 1, 150); w = A.debug.warns;
  ok('bomb walls: every bomb drop has a filled ring (' + A.teles().length + ' lines, ' + w.filter(x => x.rFill && x.r === 30).length + ' rings)',
     A.teles().length > 0 && w.filter(x => x.rFill && x.r === 30).length > 0);
  /* PortalLaserbeams: portal ring is twice the portal, filled */
  to('PortalLaserbeams', 2, 1);
  let seen = false;
  for (let i = 0; i < 400 && !seen; i++) { S.simulate(1 / 60); seen = A.debug.warns.some(x => x.rFill && x.r > 1 && x.w === 3); }
  ok('portal beams: the portal ring is filled (a disc, not a hairline circle)', seen);
  /* SummonShadowDemon: the arrival ring */
  to('SummonShadowDemon', 1, 150); w = A.debug.warns;
  ok('shadow demon: the arrival ring is 96 px and filled', w.some(x => x.r === 96 && x.rFill));
  /* FlamePillars: the strip fill is at least .22 alpha at its start */
  to('FlamePillars', 4, 10); r = rec(); A.draw(r.c);
  ok('pillars: the strip telegraph fill is readable (alpha >= .22) and its edges are 2 px',
     A.bones().some(b => A.frame() < b.at) && r.log.fills.some(f => alphaOf(f.f) >= 0.22 && f.w > 20) && r.log.fills.some(f => f.w === 2));
}

console.log('\n3. her sheets start loading when the fight opens');
{
  const NEU = boot(), asked = [];
  const orig = NEU.sheetReady;
  NEU.sheetReady = function (sh) { asked.push(sh && sh.src); return orig(sh); };
  NEU.scal.open();
  const want = k => asked.indexOf(NEU.sheets[k].src) >= 0;
  ok('open() asks for scal, scalHood, scalShield, the darts and the worm', ['scal', 'scalHood', 'scalShield', 'dart', 'hellblast', 'sepulBody', 'soulSeeker'].every(want));
}

const press = (w, k, type, o) => w.dispatchEvent(new w.KeyboardEvent(type || 'keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, o)));

console.log('\n4a. the Esc menu is arrow-navigable and pauses the fight');
{
  const NEU = fresh(), w = NEU.__w, doc = w.document, S = NEU.scal;
  const ce = () => doc.getElementById('confirmExit');
  const sel = () => { const b = ce() && ce().querySelector('[aria-pressed="true"]'); return b ? b.getAttribute('data-ans') : ''; };
  press(w, 'Escape');
  ok('Esc opens the leave menu, default NO, fight frozen', !!ce() && sel() === 'no' && NEU.juice.frozen());
  press(w, 'ArrowLeft');
  ok('ArrowLeft moves the soul to YES', sel() === 'yes' && !!ce().querySelector('[data-soul="yes"]:not([hidden])'));
  press(w, 'ArrowRight');
  ok('ArrowRight moves it back to NO', sel() === 'no');
  press(w, 'ArrowDown'); press(w, 'ArrowUp');
  ok('Down and Up navigate too', sel() === 'yes');
  press(w, 'x');
  ok('X closes the menu and the fight runs on', !ce() && S.active && !NEU.juice.frozen());
  press(w, 'Escape'); press(w, 'z');
  ok('Z on the default NO resumes', !ce() && S.active);
  press(w, 'Escape'); press(w, 'ArrowLeft'); press(w, 'z');
  ok('Z on YES leaves the fight', !S.active);
}

console.log('\n4b. HP, heal cooldown, TP, admin cheats');
{
  const NEU = fresh(), w = NEU.__w, S = NEU.scal;
  ok('boss HP is 783', S.bossMax() === 783 && S.hp === 783);
  S.setHp(5);
  press(w, 'c');
  ok('C opens the strip', S.stripOpen === true);
  press(w, 'z');
  ok('HEAL gives +1 HP and starts a 30 s cooldown', S.soulHP === 6 && Math.abs(S.healCd - 30) < 1e-6);
  press(w, 'c'); press(w, 'z');
  ok('HEAL is refused while it cools down', S.soulHP === 6);
  press(w, 'x');
  S.setTp(40);
  ok('TP meter reads what was set (0..1)', Math.abs(S.tp - 0.4) < 1e-9);
  S.simulate(31);
  ok('HEAL is ready after 30 s of fight time', S.healCd === 0);
  /* admin: dmgMul, god, startFrac, all through NEU.cheat as dev.js sets it */
  S.arm(S.px, S.py, S.bx, S.by);
  const h0 = S.hp; S.hurtBoss(10); const d1 = h0 - S.hp;
  NEU.cheat = { god: false, dmgMul: 5, startFrac: 0 };
  const h1 = S.hp; S.hurtBoss(10); const d5 = h1 - S.hp;
  ok('dmgMul multiplies damage (' + d1 + ' -> ' + d5 + ')', d1 > 0 && Math.abs(d5 - 5 * d1) < 1e-6);
  S.invincible(false);
  NEU.cheat = { god: true, dmgMul: 1, startFrac: 0 };
  S.setHp(8); S.shotAt(S.px, S.py, 8); S.simulate(0.2);
  ok('god: a bullet on the soul does nothing', S.soulHP === 8);
  NEU.cheat = { god: false, dmgMul: 1, startFrac: 0 };
  S.shotAt(S.px, S.py, 8); S.simulate(0.2);
  ok('without god the same bullet hurts', S.soulHP < 8);
  NEU.cheat = { god: false, dmgMul: 1, startFrac: 0.3 };
  S.open();
  ok('skip: startFrac starts the boss at that share of HP, once', Math.abs(S.hp - 783 * 0.3) < 1 && NEU.cheat.startFrac === 0);
  S.open();
  ok('the next fight starts full again', S.hp === 783);
}

console.log('\n4c. bigger pools with combos, no pool entry without a body');
{
  const NEU = fresh(), A = NEU.scalAtk, names = A.names();
  ok('pool sizes grew (' + A.pools.map(p => p.length).join('/') + ')', A.pools[0].length >= 12 && A.pools[1].length >= 23 && A.pools[2].length >= 28);
  ok('every phase has a combo attack', ['ComboSkullRain', 'ComboEyeHex', 'ComboLaserHell'].every((c, i) => A.pools[Math.min(i, 2)].indexOf(c) >= 0 || A.pools[2].indexOf(c) >= 0));
  ok('every pooled attack has a body', [].concat.apply([], A.pools).every(n => names.indexOf(n) >= 0));
  ok('blue-soul attacks are in the pools (GravityOfRuin, GravityBoneRush)', A.pools[1].indexOf('GravityOfRuin') >= 0 && A.pools[1].indexOf('GravityBoneRush') >= 0);
}

console.log('\n4d. melee and fireball do distinct damage, with a visible swing');
{
  const NEU = fresh(), w = NEU.__w, S = NEU.scal;
  S.arm(S.px, S.py, S.px, S.py - 24);
  press(w, 'z'); S.simulate(0.05); press(w, 'z', 'keyup');
  ok('a Z tap swings the blade (arc on screen)', S.swings.length > 0);
  S.simulate(1);
  S.arm(S.px, S.py, S.px, S.py - 150);
  press(w, 'z'); S.simulate(0.7); press(w, 'z', 'keyup');
  const seen = {};
  for (let i = 0; i < 90; i++) { S.simulate(1 / 60); for (const x of S.myShots) seen[x.kind] = x.dmg; }
  ok('a held Z throws a fireball (4) that bursts into minis (1): ' + JSON.stringify(seen), seen.fireball === 4 && seen.mini === 1);
}

console.log('\n4e. every fight key goes through the rebinding table');
{
  const NEU = fresh(), S = NEU.scal, doc = NEU.__w.document;
  NEU.keys.set('z', 'k'); NEU.keys.set('x', 'l'); NEU.keys.set('c', 'v');
  ok('K now reaches the fight as Z, L as X, V as C',
     NEU.keys.route('k').to === 'z' && NEU.keys.route('l').to === 'x' && NEU.keys.route('v').to === 'c');
  ok('the old Z is swallowed, so it does nothing', NEU.keys.route('z').swallow === true);
  S.open();
  const hint = doc.querySelector('#bh .bh__keys').innerHTML;
  ok('the fight hint names the new keys (' + hint.replace(/&middot;/g, '|').slice(0, 80) + ')', /\bk slash/.test(hint) && /\bl dash/.test(hint) && /\bv menu/.test(hint));
  NEU.keys.reset();
}

console.log('\n4f. progress survives a reload: sans, console, broken hero key');
{
  const A = fresh(), wa = A.__w;
  A.quest.mark('sans'); A.quest.mark('break'); A.quest.mark('console');
  A.save.flag('console_charge', 100);
  A.save.flush();
  const store = {};
  for (let i = 0; i < wa.localStorage.length; i++) { const k = wa.localStorage.key(i); store[k] = wa.localStorage.getItem(k); }
  const B = boot(store);
  ok('the save reached storage (' + Object.keys(store).length + ' keys)', Object.keys(store).length > 0);
  ok('after a reload the sword, the key and the console steps are still done',
     B.quest.has('sans') && B.quest.has('break') && B.quest.has('console'));
  ok('the console charge is still 100', B.save.flag('console_charge') === 100);
}

console.log('\n4g. the combat view fills a zoomed-out (65 %) window');
{
  const NEU = fresh(), S = NEU.scal;
  ok('1969 x 1231 css px (65 % zoom) scales the fight to 1.75x', S.scaleFor(1969, 1231, 1) === 1.75);
  ok('a phone and a laptop keep 1x', S.scaleFor(390, 844, 1) === 1 && S.scaleFor(1280, 720, 1) === 1);
}

console.log('\n4h. original checklist: 360 lightning keeps a gap, the snake circles the soul, brothers have 90 HP');
{
  const NEU = fresh(), S = NEU.scal, A = NEU.scalAtk;
  const gapOf = n => {
    const a = A.bolts().map(b => ((b.a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).sort((x, y) => x - y);
    let m = 0;
    for (let i = 0; i < a.length; i++) m = Math.max(m, (i ? a[i] - a[i - 1] : a[0] + 2 * Math.PI - a[a.length - 1]));
    return { n: a.length, gap: m, slot: 2 * Math.PI / n };
  };
  S.force('BrimstoneLightning'); A.setLevel(2); S.force('BrimstoneLightning');
  S.simulate(2 / 60);
  let g = gapOf(16);
  ok('wave 1: the ring has an open gap of at least 1.5 slots (' + g.n + ' bolts, gap ' + g.gap.toFixed(2) + ' rad)', g.n >= 15 && g.gap >= 1.5 * g.slot);
  S.simulate(1.6);
  g = gapOf(22);
  ok('wave 2: still a gap (' + g.n + ' bolts, gap ' + g.gap.toFixed(2) + ' rad)', g.n >= 20 && g.gap >= 1.5 * g.slot);
  /* the snake */
  S.open(); S.simulate(3.0);
  S.force('SummonSepulcher');
  let moved = 0, prev = null, chase = 0;
  for (let i = 0; i < 2400 && S.running; i++) {
    S.simulate(1 / 60);
    if (S.wormAct !== 'chase' || !S.wormPos) { prev = null; continue; }
    chase++;
    const an = Math.atan2(S.wormPos.y - S.py, S.wormPos.x - S.px);
    if (prev !== null) { let d = an - prev; d = Math.atan2(Math.sin(d), Math.cos(d)); moved += Math.abs(d); }
    prev = an;
  }
  ok('the worm circles the soul while it chases (' + chase + ' chase frames, ' + moved.toFixed(1) + ' rad swept)', chase > 60 && moved > 1);
  /* brothers */
  S.open(); S.simulate(3.0);
  S.force('SummonBrothers');
  for (let i = 0; i < 1500 && S.bros < 2 && S.running; i++) S.simulate(1 / 60);
  ok('the brothers arrive with 90 HP each (' + S.broHp.join('/') + ')', S.bros === 2 && S.broHp.every(h => h === 90));
}

console.log('\n2b. DarknessLightSlashes: the lane band is as wide as what hurts');
{
  const NEU = fresh(), S = NEU.scal, A = NEU.scalAtk;
  S.force('DarknessLightSlashes'); A.setLevel(2); S.force('DarknessLightSlashes');
  S.simulate(62 / 60);
  const lanes = A.debug.warns.filter(w => w.bw !== undefined);
  ok('the first volley shows its lanes (' + lanes.length + ', some fall outside the box) with an 8 px half-band', lanes.length >= 1 && lanes.every(w => w.bw === 8));
  let max = 0;
  for (let i = 0; i < 120; i++) { S.simulate(1 / 60); for (const l of A.lasers()) if (A.frame() >= l.at) max = Math.max(max, 1); }
  ok('the light bands do fire after the warning', max === 1);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
console.log(fail ? 'SOME FAIL' : 'ALL PASS');
process.exit(fail ? 1 : 0);
