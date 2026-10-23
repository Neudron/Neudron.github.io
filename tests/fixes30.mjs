/* fixes30.mjs — the sound switch, and three music fixes beside it.
   Run: node tests/fixes30.mjs

   M mutes the soundtrack from anywhere, and a switch in the top-right
   cluster does the same for touch. Mute is a save flag, not a volume:
   the slider keeps its number, so unmuting lands back where it was.

   Alongside it: the duck ramps are timed (0.12 s down, 0.5 s up), a
   faded voice is reaped on the audio clock instead of a wall-clock
   timer (a backgrounded tab throttles timers, not the audio clock),
   and the touch gesture gate is passive so a scroll never waits on it.

   Everything is asserted through NEU's own accessors and a recording
   AudioContext stub that keeps every gain node, so no audio device and
   no timing luck. The boot is the page's own index.html with the
   <noscript> fallback removed, as fixes21 does: under
   runScripts:'outside-only' that fallback hides .ctl and every panel. */

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const HTML = read('index.html');
const M = read('js/core/music.js');
const CSS = read('css/style.css');

/* ── a recording AudioContext ────────────────────────────────────
   Every gain node is kept, so a test can find the bus by what it is
   connected to rather than by its position in the build order. */
function audioStub(w) {
  class Param {
    constructor(v) { this.value = v; this.log = []; }
    setValueAtTime(v) { this.value = v; return this; }
    exponentialRampToValueAtTime(v) { this.value = v; return this; }
    linearRampToValueAtTime(v, t) { this.log.push({ v, t }); this.value = v; return this; }
    cancelScheduledValues() { return this; }
  }
  class Node {
    constructor(ctx) { this.ctx = ctx; this.out = []; }
    connect(d) { this.out.push(d); return d; }
    disconnect() {}
  }
  class Gain extends Node {
    constructor(ctx) { super(ctx); this.gain = new Param(1); ctx.gains.push(this); }
  }
  class Osc extends Node {
    constructor(ctx) {
      super(ctx);
      this.type = ''; this.frequency = new Param(0); this.detune = new Param(0);
    }
    start(t) { this.ctx.notes.push({ t, f: this.frequency.value }); }
    stop() {}
  }
  class Src extends Node {
    constructor(ctx) { super(ctx); this.buffer = null; this.playbackRate = new Param(1); }
    start(t) { this.ctx.notes.push({ t, f: 0 }); }
    stop() {}
  }
  class Filt extends Node {
    constructor(ctx) {
      super(ctx);
      this.type = ''; this.frequency = new Param(0); this.Q = new Param(1);
    }
  }
  class AC {
    constructor() {
      this.state = 'running'; this.currentTime = 0; this.sampleRate = 44100;
      this.destination = new Node(this); this.notes = []; this.gains = [];
      w.__actx = this;
    }
    resume() { this.state = 'running'; return Promise.resolve(); }
    createOscillator() { return new Osc(this); }
    createGain() { return new Gain(this); }
    createBufferSource() { return new Src(this); }
    createBiquadFilter() { return new Filt(this); }
    createBuffer(ch, n) { return { getChannelData: () => new Float32Array(n) }; }
  }
  w.AudioContext = AC;
  w.webkitAudioContext = AC;
}

/* The page's own script order, minus the dev console (which is last
   in index.html and only ever reads keys it is told about). */
const MODULES = [
  'core/quest.js', 'core/save.js', 'core/juice.js', 'core/danmaku.js',
  'data/sheets.js', 'core/engine-look.js', 'core/engine-kinds.js', 'core/engine.js', 'game/sword.js', 'game/sans.js',
  'game/bullet.js', 'game/dark.js', 'act4/act4.js', 'act4/rooms-a.js',
  'act4/rooms-d.js', 'act4/boss-scal.js', 'act4/rooms-g.js', 'act4/quiz.js',
  'act4/rhythm.js', 'act4/craft.js', 'act4/boss-polt.js', 'act4/crack.js',
  'game/deck.js', 'core/music.js', 'core/perf.js', 'core/settings.js', 'core/touch.js',
  'core/dev.js'
];

function boot({ save } = {}) {
  const dom = new JSDOM(HTML, { pretendToBeVisual: true, url: 'https://www.neu.ac/',
                                runScripts: 'outside-only' });
  const w = dom.window;
  w.document.querySelectorAll('noscript').forEach(n => n.remove());
  /* save.js reads this at load, so a flag set here is what the page
     "remembers" from last time. */
  if (save) w.localStorage.setItem('neu.save.v1', JSON.stringify(save));

  /* Every window listener the modules add, with its options and its
     function. The passive flag is not visible any other way. */
  w.__listeners = [];
  const addL = w.addEventListener.bind(w);
  w.addEventListener = (type, fn, opts) => {
    w.__listeners.push({ type, fn, opts });
    return addL(type, fn, opts);
  };

  w.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe() {} disconnect() {} };
  w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
  audioStub(w);
  w.HTMLMediaElement.prototype.play = () => Promise.resolve();
  const noop = () => {};
  /* Must not be null: engine.js and both bosses bail out of their whole
     module if getContext fails. (neu-verify section 2) */
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
  return { w, NEU: w.NEU, doc: w.document };
}

const gesture = w => w.dispatchEvent(new w.Event('pointerdown'));
const press = (w, k, mods = {}, target = w) => {
  const e = new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...mods });
  target.dispatchEvent(e);
  return e;
};
/* The bus is the gain that feeds the destination. The duck gain is the
   one that feeds the bus. Found by wiring, not by build order. */
const busOf = w => w.__actx.gains.find(g => g.out.includes(w.__actx.destination));
const duckOf = w => w.__actx.gains.find(g => g.out.includes(busOf(w)));
const near = (a, b) => Math.abs(a - b) < 1e-9;
const SAVE = { v: 2, act: 3, room: null, spawn: null,
               flags: {}, items: [], quest: { done: {}, counts: {} },
               quiz: null, best: {}, stamp: 0 };

/* ═══ 1. m mutes, and a second m gives it back ════════════════════*/
console.log('\n1. m mutes the music, and a second m gives it back');
{
  const { w, NEU, doc } = boot();
  gesture(w);
  NEU.music.play('woods');
  w.__actx.currentTime = 1;
  ok('starts unmuted, the bus at 55% of PEAK', near(busOf(w).gain.value, 0.11));
  ok('the document is not marked muted', doc.documentElement.dataset.muted === '');

  press(w, 'm');
  ok('>>> m sets the save flag <<<', NEU.save.flagged('opt_mute') === true);
  ok('>>> the bus goes to zero <<<', busOf(w).gain.value === 0);
  ok('music volume reads 0 while muted', NEU.music.volume === 0);
  ok('the document is marked muted', doc.documentElement.dataset.muted === '1');
  ok('the slider still shows the real level', doc.getElementById('settMusic').value === '55');
  ok('and the saved level is untouched', NEU.save.flag('opt_music') === 55);

  press(w, 'm');
  ok('>>> a second m clears the flag <<<', NEU.save.flagged('opt_mute') === false);
  ok('>>> unmuting restores the slider level <<<', near(busOf(w).gain.value, 0.11));
  ok('volume reads 55 again', NEU.music.volume === 55);
  ok('the document is unmarked', doc.documentElement.dataset.muted === '');

  press(w, 'M');
  ok('capital M toggles too', NEU.save.flagged('opt_mute') === true);
  press(w, 'M');
  ok('and back again', NEU.save.flagged('opt_mute') === false);
}

/* ═══ 2. not while typing, not with a modifier ═══════════════════*/
console.log('\n2. m is ignored while typing, and with a modifier held');
{
  const { w, NEU, doc } = boot();
  gesture(w);
  NEU.music.play('woods');

  for (const tag of ['input', 'textarea', 'select']) {
    const el = doc.createElement(tag);
    doc.body.appendChild(el);
    el.focus();
    ok('focus really landed on a ' + tag, doc.activeElement === el);
    press(w, 'm', {}, el);
    ok('>>> ignored in a focused ' + tag + ' <<<', NEU.save.flagged('opt_mute') === false);
    el.remove();
  }

  const ce = doc.createElement('div');
  ce.setAttribute('contenteditable', 'true');
  ce.tabIndex = 0;
  doc.body.appendChild(ce);
  ce.focus();
  ok('focus really landed on the contenteditable', doc.activeElement === ce);
  press(w, 'm', {}, ce);
  ok('>>> ignored in a contenteditable <<<', NEU.save.flagged('opt_mute') === false);
  ce.remove();

  for (const mods of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
    press(w, 'm', mods);
    ok('>>> ignored with ' + Object.keys(mods)[0] + ' held <<<',
       NEU.save.flagged('opt_mute') === false);
  }

  press(w, 'm', { repeat: true });
  ok('>>> an auto-repeat does not flicker it <<<', NEU.save.flagged('opt_mute') === false);

  press(w, 'm');
  ok('with nothing held and nothing focused it works', NEU.save.flagged('opt_mute') === true);
}

/* ═══ 3. the sound switch in the .ctl cluster ════════════════════*/
console.log('\n3. the sound switch');
{
  const { w, NEU, doc } = boot();
  /* A span stands in when the button is missing, so every check below
     reads FAIL instead of the suite throwing on the first null. */
  const btn = doc.getElementById('muteToggle') || doc.createElement('span');
  const cluster = doc.querySelector('.ctl');
  ok('the button exists', !!btn);
  ok('it sits in the same .ctl cluster as the light',
     !!btn && btn.parentElement === cluster &&
     doc.getElementById('lightsToggle').parentElement === cluster);
  ok('it is a sw button labelled Sound',
     !!btn && btn.classList.contains('sw') && btn.classList.contains('sw--mute') &&
     btn.getAttribute('aria-label') === 'Sound');
  ok('it is a real BUTTON', !!btn && btn.tagName === 'BUTTON');
  ok('starts pressed: sound is on', btn.getAttribute('aria-pressed') === 'true');

  btn.click();
  ok('>>> a click sets the same flag as m <<<', NEU.save.flagged('opt_mute') === true);
  ok('and aria-pressed goes false (muted)', btn.getAttribute('aria-pressed') === 'false');
  ok('and the document is marked', doc.documentElement.dataset.muted === '1');

  press(w, 'm');
  ok('m flips the switch back', btn.getAttribute('aria-pressed') === 'true' &&
     NEU.save.flagged('opt_mute') === false);

  btn.click();
  ok('and a click mutes again from there', btn.getAttribute('aria-pressed') === 'false' &&
     NEU.save.flagged('opt_mute') === true);

  /* No layout engine here, so the target size is read from the rule
     that sets it. Anchored to a line start, so a comment that quotes
     the selector cannot satisfy it. */
  ok('>>> the switch is at least 44px across, by rule <<<',
     /\n\.sw--mute \{[^}]*min-width: 44px/.test(CSS));
  ok('and at least 44px tall', /\n\.sw--mute \{[^}]*min-height: 44px/.test(CSS));
}

/* ═══ 4. the flag is read back on load ═══════════════════════════*/
console.log('\n4. a muted save loads muted');
{
  const save = { ...SAVE, flags: { opt_mute: 1, opt_music: 30 } };
  const { w, NEU, doc } = boot({ save });
  const sw = doc.getElementById('muteToggle') || doc.createElement('span');
  ok('the switch starts unpressed', sw.getAttribute('aria-pressed') === 'false');
  ok('the document starts muted', doc.documentElement.dataset.muted === '1');
  ok('the saved level is kept', NEU.settings.music === 30);
  gesture(w);
  NEU.music.play('woods');
  w.__actx.currentTime = 1;
  ok('>>> the bus is built silent <<<', busOf(w).gain.value === 0);
  ok('the slider starts at the saved 30', doc.getElementById('settMusic').value === '30');
}

/* ═══ 5. the mute survives a save round-trip ═════════════════════*/
console.log('\n5. the mute survives capture and restore');
{
  const { w, NEU, doc } = boot();
  gesture(w);
  NEU.music.play('woods');
  press(w, 'm');
  const json = NEU.save.serialise();
  ok('it is written into the save', JSON.parse(json).flags.opt_mute === 1);

  NEU.save.wipe();
  ok('a wipe clears it', NEU.save.flagged('opt_mute') === false);

  NEU.save.deserialise(json);
  ok('>>> the restore brings it back <<<', NEU.save.flagged('opt_mute') === true);
  ok('the saved level comes back with it', NEU.save.flag('opt_music') === 55);

  NEU.settings.apply();
  const sw = doc.getElementById('muteToggle') || doc.createElement('span');
  ok('the switch follows the restored flag', sw.getAttribute('aria-pressed') === 'false');
  if (NEU.music.refresh) NEU.music.refresh();
  ok('and the bus follows it', busOf(w).gain.value === 0);
}

/* ═══ 6. the duck: down in 0.12 s, back up in 0.5 s ══════════════*/
console.log('\n6. the duck ramps');
{
  const { w, NEU } = boot();
  gesture(w);
  NEU.music.play('woods');
  w.__actx.currentTime = 1;
  const g = duckOf(w);

  NEU.music.duck(true);
  const down = g.gain.log[g.gain.log.length - 1];
  ok('>>> ducks to DUCK (0.34) <<<', down.v === 0.34);
  ok('>>> in 0.12 s, not 0.3 <<<', near(down.t - 1, 0.12));

  NEU.music.duck(false);
  const up = g.gain.log[g.gain.log.length - 1];
  ok('>>> back to 1 <<<', up.v === 1);
  ok('>>> in 0.5 s, not 0.3 <<<', near(up.t - 1, 0.5));
}

/* ═══ 7. a faded voice is reaped on the audio clock ═══════════════*/
console.log('\n7. a faded voice is reaped by the audio clock');
{
  const { w, NEU } = boot();
  gesture(w);
  NEU.music.play('woods');
  w.__actx.currentTime = 1;
  NEU.music._tick();

  const delays = [];
  const st = w.setTimeout.bind(w);
  w.setTimeout = (f, ms, ...a) => { delays.push(ms); return st(f, ms, ...a); };
  NEU.music.play('castle');
  const old = NEU.music._v()[0];

  ok('the outgoing voice carries an end time on the audio clock',
     near(old.endAt, 1 + 1.1 + 0.2));
  ok('>>> and no wall-clock timer was set for it <<<',
     !delays.some(ms => Math.abs(ms - 1300) < 1));

  w.__actx.currentTime = 2.2;
  NEU.music._tick();
  ok('before its end time it is still there', NEU.music._v().length === 2);

  w.__actx.currentTime = 2.31;
  NEU.music._tick();
  ok('>>> past its end time the scheduler reaps it <<<', NEU.music._v().length === 1);
  ok('and the one left is the incoming zone', NEU.music._v()[0].tr === NEU.music.tracks.castle);
}

/* ═══ 8. the touch gate is passive ═══════════════════════════════*/
console.log('\n8. the touch gesture gate');
{
  const { w } = boot();
  const arm = w.__listeners.find(l => l.type === 'touchstart' && l.fn.name === 'arm');
  ok('the touchstart gate is registered', !!arm);
  ok('>>> on the capture phase <<<', !!arm && arm.opts && arm.opts.capture === true);
  ok('>>> and passive, so a scroll never waits on it <<<',
     !!arm && arm.opts && arm.opts.passive === true);

  const ev = new w.Event('touchstart', { cancelable: true });
  w.dispatchEvent(ev);
  ok('the gate never cancels a touch', ev.defaultPrevented === false);
}

/* ═══ 9. the settings panel reads the real level ═════════════════*/
console.log('\n9. the settings panel while muted');
{
  const { w, NEU, doc } = boot();
  gesture(w);
  NEU.music.play('woods');
  press(w, 'm');

  NEU.settings.open();
  ok('the panel opens while muted', NEU.music.volume === 0);
  ok('>>> and the slider shows the level, not zero <<<',
     doc.getElementById('settMusic').value === '55');
  ok('the settings getter agrees', NEU.settings.music === 55);
  ok('and the getter reports the mute', NEU.settings.muted === true);

  press(w, 'm');
  ok('m still works with the panel open (a switch has focus)',
     NEU.save.flagged('opt_mute') === false);

  press(w, 'm');
  const rg = doc.getElementById('settMusic');
  rg.value = '80';
  rg.dispatchEvent(new w.Event('input'));
  ok('>>> moving the slider while muted keeps it silent <<<',
     busOf(w).gain.value === 0 && NEU.save.flagged('opt_mute') === true);
  ok('and saves the new level', NEU.save.flag('opt_music') === 80);
  press(w, 'm');
  ok('>>> unmuting lands on the new level <<<', near(busOf(w).gain.value, 0.16));
  NEU.settings.close();
}

/* ═══ 10. the size gate, still ═══════════════════════════════════*/
console.log('\n10. music.js stays under its gate');
{
  const kb = Buffer.byteLength(M, 'utf8') / 1024;
  ok('music.js is under 24 KiB (' + kb.toFixed(2) + ' KiB)', kb < 24);
  ok('music.js has no arrow functions', !/=>/.test(M));
  ok('music.js has no let or const', !/\b(let|const)\s+[A-Za-z_$]/.test(M));
}

console.log('\n' + (fail ? 'FAILED ' : 'passed ') + pass + '/' + (pass + fail));
process.exit(fail ? 1 : 0);
