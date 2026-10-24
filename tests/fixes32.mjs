/* fixes32.mjs — the audio-only pass: the blade's rise, the stinger, the
   soul's heartbeat at one HP, the telegraph's tone, and the pitch
   scatter on Calamitas's voice.
   Run: node tests/fixes32.mjs

   Every change in this pass is sound, or the timing of sound. The checks
   assert what the synth is TOLD to do — oscillator frequencies, gain
   envelopes, start and stop times, the playbackRate a voice is played
   at — and never what a speaker would make of it. Nothing here touches a
   fight's damage, HP, pattern or balance value.

   The page's own script list is read from index.html, in order, so the
   suite loads exactly what a player loads. page/ is left out, as fixes21
   leaves it out: it is the page shell, not the game.

   The frame clock is performance.now(), as in a real browser. The
   jsdom default passes Date.now(), which makes every frame look 33 ms
   long and runs frame time at twice the wall clock. */

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };

const PAGE = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MODULES = [...PAGE.matchAll(/<script src="(js\/[^"]+)"/g)]
  .map(m => m[1].slice('js/'.length))
  .filter(f => !f.startsWith('page/'));

/* A recording AudioContext. Every oscillator and gain node is kept, with
   each frequency and gain event (set or ramp) and each start and stop
   time, so a test can read back exactly what a helper scheduled. */
function installAudio(w, rec) {
  w.AudioContext = class {
    constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 44100; this.destination = {}; }
    resume() {}
    createOscillator() {
      const o = { type: '', freq: [], starts: [], stops: [] };
      o.frequency = {
        value: 0,
        setValueAtTime(v, t) { o.freq.push({ op: 'set', v, t }); },
        exponentialRampToValueAtTime(v, t) { o.freq.push({ op: 'ramp', v, t }); },
      };
      o.detune = { setValueAtTime() {} };
      o.connect = () => {};
      o.start = t => { o.starts.push(t); };
      o.stop = t => { o.stops.push(t); };
      rec.oscs.push(o);
      return o;
    }
    createGain() {
      const g = { ev: [] };
      g.gain = {
        value: 0,
        setValueAtTime(v, t) { g.ev.push({ op: 'set', v, t }); },
        exponentialRampToValueAtTime(v, t) { g.ev.push({ op: 'ramp', v, t }); },
        linearRampToValueAtTime() {}, cancelScheduledValues() {},
      };
      g.connect = () => {};
      rec.gains.push(g);
      return g;
    }
    createBufferSource() { return { buffer: null, connect() {}, start() {}, stop() {} }; }
    createBiquadFilter() { return { type: '', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, Q: { value: 0 }, connect() {} }; }
    createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
  };
  w.webkitAudioContext = w.AudioContext;
}

function boot({ audio = true, fastClock = false } = {}) {
  const dom = new JSDOM(PAGE, { pretendToBeVisual: true, url: 'https://www.neu.ac/',
                                runScripts: 'outside-only' });
  const w = dom.window;
  /* runScripts: 'outside-only' makes the parser treat scripting as off, so
     the <noscript> fallback hides .quiz. A real browser never applies it. */
  w.document.querySelectorAll('noscript').forEach(n => n.remove());
  const st = w.setTimeout.bind(w);
  w.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe() {} disconnect() {} };
  w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
  const rec = { oscs: [], gains: [], plays: [] };
  if (audio) installAudio(w, rec);
  /* Voice clips. The fight preloads these pools in open(), so the stub is
     read at call time. play() records the playbackRate in force at the
     moment of the call. */
  w.Audio = class {
    constructor(src) { this.src = src; this.preload = ''; this.volume = 1; this.currentTime = 0; this.playbackRate = 1; }
    play() { rec.plays.push({ src: this.src, rate: this.playbackRate }); return Promise.resolve(); }
    pause() {}
  };
  w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {
    get(_, k) {
      if (k === 'canvas') return {};
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'createRadialGradient' || k === 'createLinearGradient')
        return () => ({ addColorStop() {} });
      if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (typeof k === 'string') return () => {};
      return undefined;
    }, set() { return true; }
  });
  w.scrollTo = () => {};
  /* Real frames at 16 ms, stamped with performance.now(). fastClock is for
     the one section that counts voice clips: each frame stands for 33 ms
     of frame time at a 1 ms tick, so a wait for the intro costs ~80 ms
     instead of 2.6 s. The fight's own clock is the frame clock, so it
     runs the same logic on a faster schedule. */
  if (fastClock) {
    let fake = 0;
    w.requestAnimationFrame = cb => st(() => { fake += 33; cb(fake); }, 1);
  } else {
    w.requestAnimationFrame = cb => st(() => cb(w.performance.now()), 16);
  }
  w.Element.prototype.getBoundingClientRect = () =>
    ({ left: 100, top: 100, right: 146, bottom: 146, width: 46, height: 46, x: 100, y: 100 });

  for (const f of MODULES) {
    const p = path.join(ROOT, 'js', f);
    if (!fs.existsSync(p)) { console.log('  !! missing ' + f); continue; }
    try { w.eval(fs.readFileSync(p, 'utf8')); }
    catch (e) { console.log('  !! ' + f + ': ' + e.message); }
  }
  return { w, NEU: w.NEU, doc: w.document, rec };
}

const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return true; await wait(5); }
  return !!fn();
}

/* helpers over what the recording saw */
const topHz = oscs => Math.max(...oscs.map(o => Math.max(...o.freq.map(e => e.v))));
const peakGain = gains => Math.max(...gains.map(g => Math.max(...g.ev.map(e => e.v))));
const inOrder = oscs => oscs.length === 3 &&
  oscs.slice().sort((a, b) => a.starts[0] - b.starts[0])
      .every((o, i, arr) => i === 0 || o.freq[0].v > arr[i - 1].freq[0].v);

/* ═══ 1. rise: a tone that climbs, and can be cut short ═══════════*/
console.log('\n1. NEU.sfx.rise — a tone that climbs, and can be cut short');
try {
  const { NEU, rec } = boot();
  ok('NEU.sfx exposes rise, stinger and heart',
     !!NEU.sfx && typeof NEU.sfx.rise === 'function' &&
     typeof NEU.sfx.stinger === 'function' && typeof NEU.sfx.heart === 'function');
  const o0 = rec.oscs.length, g0 = rec.gains.length;
  const stop = NEU.sfx.rise(900);
  const osc = rec.oscs.slice(o0), gn = rec.gains.slice(g0);
  ok('rise() makes exactly one oscillator', osc.length === 1);
  const fr = osc.length ? osc[0].freq : [];
  const start = fr.length ? fr[0].v : 0, end = fr.length ? fr[fr.length - 1].v : 0;
  ok('>>> the frequency ramps up (end > start) <<<', end > start);
  ok('...180 Hz to 620 Hz on an exponential sweep',
     start === 180 && end === 620 && fr.length > 1 && fr[fr.length - 1].op === 'ramp');
  ok('...across the 900 ms it was asked for',
     osc.length === 1 && Math.abs(osc[0].stops[0] - 0.9) < 1e-9);
  const ge = gn.length ? gn[0].ev : [];
  ok('its gain runs 0.04 -> 0.0001, under the whoosh peak of 0.20',
     ge.length > 1 && ge[0].v === 0.04 && ge[ge.length - 1].v === 0.0001 && peakGain(gn) <= 0.20);
  ok('stop() is a function', typeof stop === 'function');

  const before = osc.length ? osc[0].stops.length : 0;
  let threw = false;
  try { stop(); } catch (e) { threw = true; }
  const mid = osc.length ? osc[0].stops.length : 0;
  const lastStop = osc.length ? osc[0].stops[osc[0].stops.length - 1] : Infinity;
  ok('>>> stop() cuts the tone short (it schedules its own stop, before 900 ms) <<<',
     !threw && mid === before + 1 && lastStop < 0.9);
  try { stop(); stop(); } catch (e) { threw = true; }
  const after = osc.length ? osc[0].stops.length : 0;
  ok('>>> stop() is idempotent: the second and third calls schedule nothing <<<',
     !threw && after === mid);
} catch (e) { fail++; console.log('  FAIL threw: ' + e.message); }

/* ═══ 2. stinger: a short rising figure; kind 3 sits higher ═══════*/
console.log('\n2. NEU.sfx.stinger — a short rising figure, higher for kind 3');
try {
  const { NEU, rec } = boot();
  const grab = fn => { const o0 = rec.oscs.length, g0 = rec.gains.length; fn();
                       return { oscs: rec.oscs.slice(o0), gains: rec.gains.slice(g0) }; };
  const s2 = grab(() => NEU.sfx.stinger(2));
  const s3 = grab(() => NEU.sfx.stinger(3));
  ok('stinger(2) plays three notes', s2.oscs.length === 3);
  ok('stinger(3) plays three notes', s3.oscs.length === 3);
  ok('>>> the notes rise, note by note <<<', inOrder(s2.oscs) && inOrder(s3.oscs));
  ok('all three are sines', s2.oscs.concat(s3.oscs).every(o => o.type === 'sine'));
  ok('>>> kind 3 tops out higher than kind 2 <<<', topHz(s3.oscs) > topHz(s2.oscs));
  const starts = s2.oscs.map(o => o.starts[0]), stops = s2.oscs.map(o => o.stops[0]);
  const span = Math.max(...stops) - Math.min(...starts);
  ok('it is short: about a quarter of a second (' + span.toFixed(2) + ' s)',
     span >= 0.2 && span <= 0.35);
  ok('it is quiet (peak gain under the whoosh 0.20)',
     peakGain(s2.gains) <= 0.20 && peakGain(s3.gains) <= 0.20);
} catch (e) { fail++; console.log('  FAIL threw: ' + e.message); }

/* ═══ 3. heart: two low thumps, 180 ms apart ══════════════════════*/
console.log('\n3. NEU.sfx.heart — two low thumps, 180 ms apart');
try {
  const { NEU, rec } = boot();
  const o0 = rec.oscs.length, g0 = rec.gains.length;
  NEU.sfx.heart();
  const th = rec.oscs.slice(o0), gn = rec.gains.slice(g0);
  ok('>>> heart() makes two thumps <<<', th.length === 2);
  ok('both are 60 Hz sines',
     th.length === 2 && th.every(o => o.type === 'sine' && o.freq.every(e => e.v === 60)));
  ok('>>> the second lands 180 ms after the first <<<',
     th.length === 2 && Math.abs((th[1].starts[0] - th[0].starts[0]) - 0.18) < 1e-9);
  ok('each thump is about 40 ms',
     th.length === 2 && th.every(o => o.stops[0] - o.starts[0] >= 0.03 && o.stops[0] - o.starts[0] <= 0.06));
  ok('it is quiet (peak gain under the whoosh 0.20)', gn.length > 0 && peakGain(gn) <= 0.20);
} catch (e) { fail++; console.log('  FAIL threw: ' + e.message); }

/* ═══ 4. no AudioContext: every helper is a silent no-op ══════════*/
console.log('\n4. no AudioContext — nothing throws');
try {
  const { w, NEU } = boot({ audio: false });
  ok('(precondition) the window has no AudioContext',
     typeof w.AudioContext === 'undefined' && typeof w.webkitAudioContext === 'undefined');
  let threw = false, stop = null;
  try {
    stop = NEU.sfx.rise(900);
    NEU.sfx.stinger(2); NEU.sfx.stinger(3); NEU.sfx.heart();
    stop(); stop();
  } catch (e) { threw = true; }
  ok('>>> rise, stinger and heart all return quietly without a context <<<', !threw);
  ok('rise() still hands back a callable stop', typeof stop === 'function');
} catch (e) { fail++; console.log('  FAIL threw: ' + e.message); }

/* ═══ 5. Calamitas's voice is pitched a little differently each time */
console.log('\n5. Calamitas — each voice clip is played at a scattered pitch');
try {
  const { NEU, rec } = boot({ fastClock: true });
  const voice = () => rec.plays.filter(p => /audio\/act4\//.test(p.src));
  /* Each open() runs the intro, and the intro's end is the wall-start
     voice clip (sfxPlay('maelstrom')). A fight that dies early is closed
     and opened again, so this is ten sfxPlay calls, not one fight. */
  for (let k = 0; k < 40 && voice().length < 10; k++) {
    const n0 = voice().length;
    NEU.scal.close();
    NEU.scal.open();
    await until(() => voice().length > n0, 3000);
  }
  const plays = voice().slice(0, 10);
  ok('the fight played her voice ten times (' + plays.length + ' seen)', plays.length === 10);
  const rates = plays.map(p => p.rate);
  ok('>>> every clip is played between 0.95x and 1.05x <<<',
     rates.length === 10 && rates.every(r => r >= 0.95 && r <= 1.05));
  ok('>>> and the ten are not all the same pitch <<<', new Set(rates).size > 1);
  NEU.scal.close();
} catch (e) { fail++; console.log('  FAIL threw: ' + e.message); }

/* ═══ 6. Polterghast: the telegraph's rise, and the phase stingers ═*/
console.log('\n6. Polterghast — the telegraph tone, and one stinger per phase');
try {
  const { w, NEU } = boot();
  const rises = [], stingers = [];
  const realRise = NEU.sfx.rise, realStinger = NEU.sfx.stinger;
  NEU.sfx.rise = function (ms) {
    const r = { ms, stopCalls: 0, at: w.performance.now() };
    rises.push(r);
    const s = realRise ? realRise(ms) : function () {};
    return function () { r.stopCalls++; return s(); };
  };
  NEU.sfx.stinger = function (kind) {
    stingers.push(kind);
    if (realStinger) realStinger(kind);
  };
  const kd = key => w.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true }));

  /* (a) the telegraph starts a 900 ms rise; leaving the fight stops it */
  NEU.polt.open();
  const sawRise = await until(() => rises.length > 0, 12000);
  ok('>>> the charge telegraph starts a rise <<<', sawRise);
  ok('...for the 900 ms telegraph', sawRise && rises[0].ms === 900);
  const beforeClose = sawRise ? rises[0].stopCalls : -1;
  NEU.polt.close();
  ok('>>> leaving the fight stops the rise <<<',
     sawRise && rises[0].stopCalls === beforeClose + 1);
  await wait(1200);
  ok('...and no charge fires after the leave (the rise count does not grow)',
     rises.length === 1);

  /* (b) a fresh fight: phase 2 and 3 each stinger once; every telegraph
     that fires is stopped by its own charge */
  NEU.polt.open();
  ok('no stinger on the way in', stingers.length === 0);
  const pressUntil = async (cond, ms) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms && !cond()) { kd('z'); await wait(8); }
    return cond();
  };
  const atTwo = await pressUntil(() => NEU.polt.phase === 2, 30000);
  ok('phase 2 reached', atTwo);
  ok('>>> one stinger for phase 2 <<<', stingers.join() === '2');
  const atThree = await pressUntil(() => NEU.polt.phase === 3, 30000);
  ok('phase 3 reached', atThree);
  ok('>>> one stinger for phase 3, after the phase-2 one <<<', stingers.join() === '2,3');
  for (let i = 0; i < 3; i++) { kd('z'); await wait(8); }
  ok('>>> hitting on in phase 3 adds no more stingers <<<', stingers.join() === '2,3');
  /* a telegraph comes about every 3.4 s in phase 3; wait for one that is
     old enough to have fired, then judge every one that has. One started
     less than 900 ms ago is still legitimately pending, so it is skipped. */
  await until(() => rises.slice(1).some(r => w.performance.now() - r.at > 1100), 9000);
  const fired = rises.slice(1).filter(r => w.performance.now() - r.at > 1000);
  ok('>>> every telegraph that fired was stopped by its charge (' + fired.length + ' judged) <<<',
     fired.length >= 1 && fired.every(r => r.stopCalls === 1));
  NEU.polt.close();
} catch (e) { fail++; console.log('  FAIL threw: ' + e.message); }

/* ═══ 7. the soul beats at one HP, and nowhere else ═══════════════*/
console.log('\n7. bullet hell — the soul beats at one HP, and nowhere else');
try {
  const { w, NEU } = boot();
  const beats = [], hits = [];
  const realHeart = NEU.sfx.heart, realLocked = NEU.sfx.locked;
  NEU.sfx.heart = function () { beats.push(w.performance.now()); if (realHeart) realHeart(); };
  NEU.sfx.locked = function () { hits.push(w.performance.now()); if (realLocked) realLocked(); };
  NEU.bullet.open();
  ok('the bullet hell is running', NEU.bullet.running === true);
  /* stand still and let the pattern find the soul. Every hit calls
     sfx.locked exactly once, so the hit count is the HP lost: the second
     hit leaves one HP, the third is death. */
  await until(() => hits.length >= 3 || !NEU.bullet.running, 40000);
  ok('>>> the soul took two hits and is at one HP <<<', hits.length >= 2);
  if (hits.length >= 2) {
    ok('>>> no beat at three HP or two HP <<<', beats.every(b => b >= hits[1]));
  }
  /* the one-HP window runs from the second hit to the third (death), or
     to now if the run ended some other way */
  const windowEnd = hits.length >= 3 ? hits[2] : w.performance.now();
  const windowMs = hits.length >= 2 ? windowEnd - hits[1] : 0;
  ok('>>> a beat sounds while at one HP once the window is over a second (' +
     beats.length + ' beats in ' + Math.round(windowMs) + ' ms) <<<',
     windowMs < 1000 || beats.length >= 1);
  const gaps = [];
  for (let i = 1; i < beats.length; i++) gaps.push(beats[i] - beats[i - 1]);
  /* 5 ms of slack: the frame clock and the timer clock are read at
     slightly different moments, and no beat can be closer than 900 ms
     of frame time, so no wall gap can be meaningfully under 895. */
  ok('>>> never more often than every 900 ms <<<', gaps.every(g => g >= 895));
  if (hits.length >= 3) {
    const n = beats.length;
    await wait(1200);
    ok('>>> no beat once death has started <<<', beats.length === n);
  }
  NEU.bullet.close();
} catch (e) { fail++; console.log('  FAIL threw: ' + e.message); }

/* ═══ 8. source: the two places a behaviour test cannot reach ═════*/
console.log('\n8. source — the Calamitas stinger and the beat reset');
try {
  /* The phase-2 switch sits behind the brothers' death routine, which
     fixes8's drive reaches only by piloting homing bolts; that drive is
     flaky by its own account, so the line is checked where it stands. */
  const scalSrc = fs.readFileSync(path.join(ROOT, 'js/act4/boss-scal.js'), 'utf8');
  const lines = scalSrc.split('\n');
  const L = lines.findIndex(l => /phase = 2; mode = 'fight';/.test(l));
  const near = lines.slice(L, L + 3).join('\n');
  ok('>>> Calamitas phase 2 calls the guarded stinger(2) <<<',
     L >= 0 && /NEU\.sfx && NEU\.sfx\.stinger/.test(near) && /stinger\(2\)/.test(near));
  ok('...and the figure is called from exactly one place', (scalSrc.match(/stinger\(2\)/g) || []).length === 1);

  const bl = fs.readFileSync(path.join(ROOT, 'js/game/bullet.js'), 'utf8');
  const bIdx = bl.indexOf('function begin()'), sIdx = bl.indexOf('function startDeath()');
  ok('>>> a new run puts the beat timer back (begin, which open() calls) <<<',
     bIdx > -1 && sIdx > bIdx && bl.slice(bIdx, sIdx).indexOf('beatAt = -Infinity') > -1);
} catch (e) { fail++; console.log('  FAIL threw: ' + e.message); }

console.log('\n' + (fail === 0 ? `ALL PASS (${pass})` : `${fail} FAILED, ${pass} passed`));
process.exit(fail === 0 ? 0 : 1);
