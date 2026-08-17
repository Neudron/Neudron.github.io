/* fixes16.mjs — the Act IV soundtrack (PLAN.md Phase 5b / Tier 2.5).
   Run: node fixes16.mjs

   `core/music.js` is the first module in the project that makes sound
   on its own schedule rather than in response to a single event, so
   the failure modes are different from everything else here. Four of
   them are worth naming, because each one is silent in source review:

   §2  AUTOPLAY. A track asked for before the user has touched
       anything must not construct a context, let alone play. This is
       both a browser rule and basic manners.
   §5  RESTART-ON-EVERY-DOOR. Two rooms of the same zone must not
       restart the music. Nothing throws if they do; the woods just
       stutter every eight seconds and the bug reads as "the loop is
       too short".
   §10 THE BACKGROUNDED TAB. setInterval stops firing in a hidden tab
       while the audio clock keeps running. A lookahead scheduler that
       "catches up" then dumps every missed note into one tenth of a
       second. This is the check that matters most.
   §12 THE LOOP RUN TWICE. woods → castle → woods. A crossfade that
       leaves the old voice in the array, or a curId that never
       clears, works exactly once.

   Everything is asserted through NEU.music's own accessors and a
   recording AudioContext stub — no audio device, no timing luck.   */

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };
const read = f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');

const M = read('core/music.js');
const S = read('core/settings.js');
const E = read('core/engine.js');

/* ── a recording AudioContext ────────────────────────────────────
   Richer than the stub in fixes12 on purpose: this one keeps every
   note that was start()ed with the time it was stamped with, and
   every linear ramp with the node it was asked of. Without that, a
   scheduler test can only assert "it did not throw", which is the
   assertion that let the bug in.

   currentTime is writable so the suite can drive the clock. */
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
    constructor(ctx) { super(ctx); this.gain = new Param(1); }
  }
  class Osc extends Node {
    constructor(ctx) {
      super(ctx);
      this.type = ''; this.frequency = new Param(0); this.detune = new Param(0);
    }
    start(t) { this.ctx.notes.push({ t, f: this.frequency.value, kind: 'tone' }); }
    stop() {}
  }
  class Src extends Node {
    constructor(ctx) { super(ctx); this.buffer = null; }
    start(t) { this.ctx.notes.push({ t, f: 0, kind: 'noise' }); }
    stop() {}
  }
  class Filt extends Node {
    constructor(ctx) { super(ctx); this.type = ''; this.frequency = new Param(0); this.Q = new Param(1); }
  }
  class AC {
    constructor() {
      this.state = 'running'; this.currentTime = 0; this.sampleRate = 44100;
      this.destination = new Node(this); this.notes = [];
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

const MODULES = [
  'core/quest.js', 'core/save.js', 'core/juice.js', 'core/danmaku.js',
  'data/sheets.js', 'core/engine.js', 'game/sword.js', 'game/sans.js',
  'game/bullet.js', 'game/dark.js', 'act4/act4.js', 'act4/rooms-a.js',
  'act4/rooms-d.js', 'act4/boss-scal.js', 'act4/rooms-g.js', 'act4/quiz.js',
  'act4/rhythm.js', 'act4/craft.js', 'act4/boss-polt.js', 'act4/crack.js',
  'game/deck.js', 'core/music.js', 'core/settings.js', 'core/touch.js'
];

function boot() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { pretendToBeVisual: true, url: 'https://www.neu.ac/',
                                runScripts: 'outside-only' });
  const w = dom.window;
  w.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe() {} disconnect() {} };
  w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
  audioStub(w);
  w.HTMLMediaElement.prototype.play = () => Promise.resolve();
  const noop = () => {};
  /* Must not be null — engine.js, both bosses and the deck bail out of
     their whole module if getContext fails, and the missing halves
     then look like site bugs. (neu-verify §2) */
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
  return { w, NEU: w.NEU, dom };
}

const gesture = w => w.dispatchEvent(new w.Event('pointerdown'));

/* ═══ 1. the module and its tracks ════════════════════════════════*/
console.log('\n1. the module');
{
  const { NEU } = boot();
  ok('music loaded', !!NEU.music);
  ok('exposes play/stop/setVolume',
     !!(NEU.music.play && NEU.music.stop && NEU.music.setVolume));
  ok('starts with no track', NEU.music.track === null);
  ok('starts unarmed', NEU.music.armed === false);

  /* Named, then counted. A bare count says "8" after someone deletes
     one track and adds another. (PLAN §1.8 trap 11) */
  const ids = Object.keys(NEU.music.tracks);
  for (const want of ['woods', 'castle', 'city', 'home', 'prize', 'storm', 'scal', 'polt'])
    ok('track: ' + want, ids.includes(want));
  ok('no unexpected tracks (' + ids.length + ')', ids.length === 8);

  for (const id of ids) {
    const t = NEU.music.tracks[id];
    ok(id + ': has bpm, root, scale, chords',
       t.bpm > 0 && t.root > 0 && t.scale.length === 7 && t.chords.length > 0);
    ok(id + ': every chord degree is in range',
       t.chords.every(c => c >= 0 && c < t.scale.length));
    /* A pattern that is not sixteen characters silently shifts the
       whole bar against the drums from bar two onward. */
    for (const layer of ['bass', 'lead', 'perc'])
      if (t[layer]) ok(id + '.' + layer + ': 16 steps', t[layer].pat.length === 16);
    ok(id + ': pad and bass exist (the bed never drops out)', !!t.pad && !!t.bass);
  }
}

/* ═══ 2. nothing sounds before a user gesture ═════════════════════*/
console.log('\n2. the gesture gate  ← autoplay');
{
  const { w, NEU } = boot();
  ok('no AudioContext constructed at load', !w.__actx);

  const started = NEU.music.play('woods');
  ok('play() before a gesture returns false', started === false);
  ok('...but remembers what was asked for', NEU.music.track === 'woods');
  ok('>>> still no AudioContext <<<', !w.__actx);
  ok('>>> no voice, so nothing is scheduled <<<', NEU.music.voices === 0);
  ok('playing is false while unarmed', NEU.music.playing === false);

  gesture(w);
  ok('a pointerdown arms it', NEU.music.armed === true);
  ok('the pending track starts', NEU.music.voices === 1);
  ok('playing is true now', NEU.music.playing === true);
  ok('a context now exists', !!w.__actx);

  w.__actx.currentTime = 0.5;
  NEU.music._tick();
  ok('>>> the scheduler produces notes <<<', w.__actx.notes.length > 0);
  ok('every note is stamped with a time, not left undefined',
     w.__actx.notes.every(n => typeof n.t === 'number' && isFinite(n.t)));
}

/* ═══ 3. the director picks the right track ═══════════════════════*/
console.log('\n3. the director');
{
  const { w, NEU } = boot();
  gesture(w);

  ok('silence outside act IV', NEU.music._pick() === null);

  NEU.engine = { running: true, zone: () => 'castle' };
  ok('a room plays its tileset', NEU.music._pick() === 'castle');

  NEU.craft = { running: true };
  ok('crafting keeps the home track', NEU.music._pick() === 'home');
  NEU.craft = { running: false };

  NEU.quiz = { running: true };
  ok('the quiz plays the prize floor', NEU.music._pick() === 'prize');
  NEU.quiz = { running: false };

  NEU.polt = { running: true };
  ok('polterghast overrides the room', NEU.music._pick() === 'polt');

  NEU.scal = { running: true };
  ok('calamitas outranks polterghast', NEU.music._pick() === 'scal');

  /* The rhythm game runs its own chart at its own BPM. A second tempo
     under it does not layer, it fights. */
  NEU.rhythm = { running: true };
  ok('>>> the rhythm game silences the bed <<<', NEU.music._pick() === null);
}

/* ═══ 4. the zone map has one source of truth ═════════════════════*/
console.log('\n4. tilesets are the zones');
{
  const { NEU } = boot();
  ok('engine exposes zone()', typeof NEU.engine.zone === 'function');
  ok('zone() is null outside a room', NEU.engine.zone() === null);

  const sets = Object.keys(NEU.engine.tilesets());
  /* Assert the collection is non-empty BEFORE looping over it. A scan
     that finds nothing and reports green is worse than a red one.
     (PLAN §1.8 trap 8 — it shipped once.) */
  ok('the engine has tilesets registered (' + sets.length + ')', sets.length >= 6);
  for (const z of sets)
    ok('>>> zone "' + z + '" has a track <<<', !!NEU.music.tracks[z]);

  ok('entering a room reports its zone',
     (NEU.engine.enter('a1_clearing', 'default'), NEU.engine.zone() === 'woods'));
  ok('and the director agrees', NEU.music._pick() === 'woods');
  ok('music.js does not carry its own room-id map', !/a1_|b7_|d1_/.test(M));
}

/* ═══ 5. the same zone does not restart ═══════════════════════════*/
console.log('\n5. two rooms of one zone  ← the stutter');
{
  const { w, NEU } = boot();
  gesture(w);
  NEU.music.play('woods');
  w.__actx.currentTime = 1.2;
  NEU.music._tick();

  const v = NEU.music._v()[0];
  const stepBefore = v.step;
  ok('the voice has advanced', stepBefore > 0);

  const again = NEU.music.play('woods');
  ok('play(same) is accepted', again === true);
  ok('>>> no second voice <<<', NEU.music.voices === 1);
  ok('>>> the same voice, not a replacement <<<', NEU.music._v()[0] === v);
  ok('>>> its step was not reset <<<', NEU.music._v()[0].step === stepBefore);
  ok('and it is not dying', v.dying !== true);
}

/* ═══ 6. crossfade ════════════════════════════════════════════════*/
console.log('\n6. crossfade between zones');
{
  const { w, NEU } = boot();
  gesture(w);
  NEU.music.play('woods');
  const old = NEU.music._v()[0];
  w.__actx.currentTime = 1;
  NEU.music._tick();

  NEU.music.play('castle');
  ok('two voices overlap', NEU.music.voices === 2);
  ok('the outgoing one is marked dying', old.dying === true);
  ok('the outgoing gain ramps down',
     old.g.gain.log.some(r => r.v <= 0.001));
  const fresh = NEU.music._v()[1];
  ok('the incoming gain ramps up', fresh.g.gain.log.some(r => r.v === 1));
  ok('the incoming voice starts at step 0', fresh.step === 0);
  ok('track reports the new zone', NEU.music.track === 'castle');
  /* Its own step counter, its own grid. Swapping the track on one
     voice puts the new bars on the old track's tempo. */
  ok('>>> the new voice has its own track object <<<', fresh.tr !== old.tr);
}

/* ═══ 7. ducking under dialogue ═══════════════════════════════════*/
console.log('\n7. ducking');
{
  const { w, NEU } = boot();
  gesture(w);
  NEU.engine = { running: true, zone: () => 'woods' };
  NEU.music._sync();
  ok('a track is playing', NEU.music.track === 'woods');
  ok('not ducked with the box down', NEU.music.ducked === false);

  const tbox = w.document.getElementById('tbox');
  ok('the textbox exists to read', !!tbox);
  tbox.hidden = false;
  NEU.music._sync();
  ok('>>> ducks while someone is talking <<<', NEU.music.ducked === true);

  tbox.hidden = true;
  NEU.music._sync();
  ok('comes back up afterwards', NEU.music.ducked === false);
  ok('reads #tbox rather than keeping its own talking flag',
     /getElementById\('tbox'\)/.test(M));
}

/* ═══ 8. adaptive intensity ═══════════════════════════════════════*/
console.log('\n8. layers arrive as the boss falls');
{
  const { w, NEU } = boot();
  gesture(w);
  NEU.scal = { running: true, phase: 1, hp: 24 };
  NEU.music._sync();
  ok('the boss track is playing', NEU.music.track === 'scal');

  w.__actx.currentTime = 0.4;
  NEU.music._tick();
  const start = NEU.music.intensity;
  const v = NEU.music._v()[0];
  ok('starts at the track resting level', Math.abs(start - 0.45) < 0.01);
  ok('the bed is up at rest', v.lgWant.pad === 1 && v.lgWant.bass === 1);
  ok('the drums are NOT up at rest', v.lgWant.perc === 0);

  /* Half health, still phase 1 — the ramp is smooth, not a step. */
  NEU.scal.hp = 12;
  w.__actx.currentTime = 0.8;
  NEU.music._tick();
  const mid = NEU.music.intensity;
  ok('>>> intensity rises as health falls <<<', mid > start);
  ok('the lead has come in', v.lgWant.lead === 1);

  NEU.scal.phase = 2; NEU.scal.hp = 3;
  w.__actx.currentTime = 1.2;
  NEU.music._tick();
  const end = NEU.music.intensity;
  ok('phase two pushes it further', end > mid);
  ok('>>> the drums arrive <<<', v.lgWant.perc === 1);
  ok('and it is clamped at 1', end <= 1);

  /* Max HP is never exposed by either boss; the first reading after
     open() IS the maximum, and it must be re-taken per fight or a
     second attempt starts at full intensity. */
  ok('a new fight re-takes the maximum', /hpMax\[TRACKS\[id\]\.boss\] = null/.test(M));

  /* Zones do not climb — nothing is escalating in a corridor. */
  const z = NEU.music.tracks.woods;
  ok('zone tracks have a fixed resting intensity', !z.boss && z.base > 0);
}

/* ═══ 9. weight ═══════════════════════════════════════════════════*/
console.log('\n9. weight  ← the whole reason it is synthesised');
{
  /* Match a quoted FILENAME, not a bare extension. The first version
     of this line was `/\.(ogg|mp3|wav|m4a|flac)/i` and it went red on
     `tr.pad.wave` — the regex hit ".wav" inside an identifier in the
     file it was auditing. (PLAN §1.8 trap 4, again.) */
  ok('>>> music.js requests no audio file <<<',
     !/['"][^'"]*\.(ogg|mp3|wav|m4a|flac)['"]/i.test(M));
  ok('>>> and no network at all <<<',
     !/\bfetch\s*\(|XMLHttpRequest|new Audio\b/.test(M));
  const kb = Buffer.byteLength(M, 'utf8') / 1024;
  ok('music.js is under 24 KB (' + kb.toFixed(1) + ' KB)', kb < 24);

  /* Nothing was added to audio/. Named, so a stray file is reported
     by name instead of as a number that moved. */
  const dir = path.join(ROOT, 'audio');
  const walk = d => fs.readdirSync(d, { withFileTypes: true })
    .flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(dir).map(f => path.relative(dir, f).replace(/\\/g, '/'));
  const expected = ['README.txt', 'totem.ogg', 'txtsans.wav', 'txtsans2.wav',
                    'act4/fireblast-hit.ogg', 'act4/fireblast.ogg', 'act4/giga-hit.ogg',
                    'act4/giga.ogg', 'act4/hellblast.ogg', 'act4/maelstrom.ogg'];
  for (const f of files) ok('audio/: expected ' + f, expected.includes(f));
  ok('no audio file was added (' + files.length + ')', files.length === expected.length);
  const bytes = walk(dir).reduce((a, f) => a + fs.statSync(f).size, 0);
  ok('audio/ still under 300 KB (' + (bytes / 1024).toFixed(0) + ' KB)', bytes < 300 * 1024);
}

/* ═══ 10. the backgrounded tab ════════════════════════════════════*/
console.log('\n10. a hidden tab must not dump a burst  ← the big one');
{
  const { w, NEU } = boot();
  gesture(w);
  NEU.music.play('woods');
  w.__actx.currentTime = 1;
  NEU.music._tick();
  const settled = w.__actx.notes.length;
  ok('a normal tick schedules a handful', settled > 0 && settled < 40);

  /* Four minutes pass with the interval frozen. A lookahead scheduler
     that catches up step by step would queue roughly 4*60/(60/76/4)
     ≈ 1200 sixteenth notes, all inside the next tenth of a second. */
  w.__actx.notes.length = 0;
  w.__actx.currentTime = 241;
  NEU.music._tick();
  const burst = w.__actx.notes.length;
  ok('>>> it realigns instead of catching up (' + burst + ' notes) <<<', burst < 40);
  ok('>>> nothing is stamped in the past <<<',
     w.__actx.notes.every(n => n.t >= 241 - 0.001));

  const v = NEU.music._v()[0];
  /* `v.step % 16 <= 16` was here first and is always true — a check
     that cannot fail is not a check. What is actually claimed is that
     the next step sits just ahead of now, inside one lookahead. */
  ok('the next step is ahead of the clock', v.at > 241);
  ok('and within one lookahead of it', v.at <= 241 + 0.2 + 0.3);
  ok('and keeps playing afterwards', v.dying !== true);

  w.__actx.notes.length = 0;
  w.__actx.currentTime = 241.4;
  NEU.music._tick();
  ok('the next tick is normal again', w.__actx.notes.length < 40);

  ok('the scheduler has a hard guard on the inner loop', /guard\+\+ < \d+/.test(M));
  ok('timing comes from currentTime, not an accumulator',
     /actx\.currentTime/.test(M) && /v\.at \+= sd/.test(M));
}

/* ═══ 11. the volume control ══════════════════════════════════════*/
console.log('\n11. volume, and that it persists');
{
  const { w, NEU } = boot();
  const rng = w.document.getElementById('settMusic');
  ok('the settings panel has a music row', !!rng);
  ok('it is a range, so zero is the mute', rng && rng.type === 'range');
  ok('it is labelled', !!rng && !!rng.getAttribute('aria-labelledby'));
  ok('range is 0..100', rng.min === '0' && rng.max === '100');

  /* The Tab trap collected only buttons. The moment a slider went in,
     Tab walked out of a dialog marked aria-modal. */
  ok('>>> the Tab trap includes inputs, not just buttons <<<',
     /querySelectorAll\('button, input'\)/.test(S));

  gesture(w);
  NEU.music.play('woods');
  NEU.music.setVolume(0);
  ok('setVolume(0) sticks', NEU.music.volume === 0);
  ok('it is written to the save file', NEU.save.flag('opt_music') === 0);

  NEU.music.setVolume(80);
  ok('and back up again', NEU.music.volume === 80);
  ok('clamped above 100', NEU.music.setVolume(500) === 100);
  ok('clamped below 0', NEU.music.setVolume(-9) === 0);

  /* Round-trip: serialise → wipe → restore → identical. */
  NEU.music.setVolume(35);
  const json = NEU.save.serialise();
  NEU.save.wipe();
  ok('wiped', NEU.save.flag('opt_music') === undefined);
  NEU.save.deserialise(json);
  ok('>>> volume survives a save round-trip <<<', NEU.music.volume === 35);
  ok('the panel reads it back on open',
     (NEU.settings.open(), w.document.getElementById('settMusic').value === '35'));
  NEU.settings.close();
}

/* ═══ 12. the loop, run twice ═════════════════════════════════════*/
console.log('\n12. woods → castle → woods  ← run it twice');
{
  const { w, NEU } = boot();
  gesture(w);

  for (let lap = 1; lap <= 2; lap++) {
    NEU.engine = { running: true, zone: () => 'woods' };
    NEU.music._sync();
    ok('lap ' + lap + ': in the woods', NEU.music.track === 'woods');
    let live = NEU.music._v().filter(v => !v.dying);
    ok('lap ' + lap + ': exactly one live voice', live.length === 1);

    w.__actx.currentTime += 1;
    NEU.music._tick();
    const before = w.__actx.notes.length;

    NEU.engine = { running: true, zone: () => 'castle' };
    NEU.music._sync();
    ok('lap ' + lap + ': in the castle', NEU.music.track === 'castle');

    w.__actx.currentTime += 1;
    NEU.music._tick();
    ok('lap ' + lap + ': still producing notes', w.__actx.notes.length > before);

    live = NEU.music._v().filter(v => !v.dying);
    ok('lap ' + lap + ': still exactly one live voice', live.length === 1);
  }

  /* Leaving act IV entirely, then coming back. */
  NEU.engine = { running: false, zone: () => null };
  NEU.music._sync();
  ok('leaving act IV stops it', NEU.music.track === null);
  NEU.engine = { running: true, zone: () => 'home' };
  NEU.music._sync();
  ok('>>> and it starts again on the way back in <<<', NEU.music.track === 'home');
  ok('with a live voice', NEU.music._v().some(v => !v.dying));
}

/* ═══ 13. house rules ═════════════════════════════════════════════*/
console.log('\n13. house rules');
{
  ok('ES5 only: no const/let', !/^\s*(const|let)\s/m.test(M));
  ok('ES5 only: no arrow functions', !/=>/.test(M));
  ok('ES5 only: no optional chaining', !/\?\./.test(M));
  ok('it is an IIFE hanging off NEU', /NEU\.music = \{/.test(M) && /^\(function \(\)/m.test(M));
  ok('it degrades when there is no AudioContext', /failed = true/.test(M));

  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  /* Positions, not adjacency. Demanding three consecutive lines fails
     the day someone inserts an unrelated script. (PLAN §1.8 trap 10) */
  const at = f => html.indexOf('js/' + f);
  ok('music.js is loaded', at('core/music.js') > 0);
  ok('after every scene it polls', at('core/music.js') > at('act4/boss-polt.js'));
  ok('after save.js, whose flags hold the volume', at('core/music.js') > at('core/save.js'));
  ok('before settings.js, which reads its volume',
     at('core/music.js') < at('core/settings.js'));
  ok('before dev.js, which stays last', at('core/music.js') < at('core/dev.js'));

  /* The substance, not the wording. zone() must READ the room's
     tileset — the moment it becomes a lookup table it is a second
     source of truth and drifts the first time a room is re-skinned. */
  ok('engine.zone() reads room.tileset directly',
     /zone: function \(\) \{ return room \? room\.tileset : null; \}/.test(E));
}

console.log('\n' + (fail ? 'FAILED ' : 'passed ') + pass + '/' + (pass + fail));
process.exit(fail ? 1 : 0);
