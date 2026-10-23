/* fixes34.mjs — four small things a player would notice.
   Run: node tests/fixes34.mjs

   F2  A death that was interrupted before 1700ms never cleared the
       shard cache, so the next death at the same spot replayed the
       identical burst. Shards are only built after the 420ms held
       heart, so any frame inside that window belongs to a new death.

   F5  The console's charge lived only in a module variable, so a full
       console was empty again after a reload. Reaching 100 is written
       to the save and read back on load. Partial charge is not written:
       the blaster re-earns it, as it always did.

   F6  The merchant's first-visit line was a closure variable, so a
       reload replayed it. It is the 'shop_seen' save flag now.

   K1  A fight held upright is a tall narrow box. touch.js marks the
       body while a fight is live in portrait, and style.css draws a
       short hint from body.is-portrait-fight::before.

   Boot is fixes21's boot() with normal timers (nothing is warped here),
   plus a stored save seeded before save.js reads it, as fixes23 does,
   and a record of every room the page registers, so the merchant's
   run() can be called the way the engine calls it. */

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };

const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SAVE_JS = fs.readFileSync(path.join(ROOT, 'js/core/save.js'), 'utf8');
const SANS_JS = fs.readFileSync(path.join(ROOT, 'js/game/sans.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');

/* The key is read from the source, so a renamed key shows up here as a
   failure instead of a test quietly reading an empty slot. */
const KEY = SAVE_JS.match(/var KEY = '([^']+)'/)[1];

/* serialise() stamps the file on every flush, so compare without it. */
const noStamp = s => JSON.stringify(Object.assign(JSON.parse(s), { stamp: 0 }));

/* The text between the braces of the block that opens at `at`, counting
   depth, so a nested rule does not end the search early. */
function bodyOf(src, at) {
  const open = src.indexOf('{', at);
  let d = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}' && --d === 0) return src.slice(open + 1, i);
  }
  return '';
}

const MODULES = [
  'core/quest.js', 'core/save.js', 'core/juice.js', 'core/danmaku.js',
  'data/sheets.js', 'core/engine-look.js', 'core/engine-kinds.js', 'core/engine.js', 'game/sword.js', 'game/sans.js',
  'game/bullet.js', 'game/dark.js', 'act4/act4.js', 'act4/rooms-a.js',
  'act4/rooms-d.js', 'act4/shop.js', 'act4/boss-scal.js', 'act4/rooms-g.js', 'act4/quiz.js',
  'act4/rhythm.js', 'act4/craft.js', 'act4/boss-polt.js', 'act4/crack.js',
  'game/deck.js', 'core/music.js', 'core/perf.js', 'core/settings.js', 'core/touch.js',
  'core/dev.js'
];

/* fixes21's boot(), with normal timers. */
function boot({ stored = null } = {}) {
  const dom = new JSDOM(HTML, { pretendToBeVisual: true, url: 'https://www.neu.ac/',
                                runScripts: 'outside-only' });
  const w = dom.window;
  /* runScripts: 'outside-only' means scripting is OFF as far as the
     parser knows, so the <noscript> fallback style applies and hides
     .quiz — and jsdom 30 will not focus anything inside display:none.
     A real browser running the page never applies that block. */
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
      if (k === 'createRadialGradient' || k === 'createLinearGradient')
        return () => ({ addColorStop: noop });
      if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (typeof k === 'string') return () => {};
      return undefined;
    }, set() { return true; }
  });
  w.scrollTo = noop;
  w.requestAnimationFrame = cb => w.setTimeout(() => cb(Date.now()), 16);
  w.Element.prototype.getBoundingClientRect = () =>
    ({ left: 100, top: 100, right: 146, bottom: 146, width: 46, height: 46, x: 100, y: 100 });

  /* The save is read when save.js loads, so the stored file must be
     there before the modules run (as fixes23 does). */
  if (stored !== null) w.localStorage.setItem(KEY, stored);

  const rooms = {};
  for (const f of MODULES) {
    const p = path.join(ROOT, 'js', f);
    if (!fs.existsSync(p)) { console.log('  !! missing ' + f); continue; }
    try { w.eval(fs.readFileSync(p, 'utf8')); }
    catch (e) { console.log('  !! ' + f + ': ' + e.message); }
    if (f === 'core/engine.js' && w.NEU.engine) {
      /* Keep every room definition the page registers. Wrapped before
         rooms-*.js load, so nothing is missed. */
      const reg = w.NEU.engine.register;
      w.NEU.engine.register = (id, def) => { rooms[id] = def; return reg(id, def); };
    }
  }
  return { w, NEU: w.NEU, doc: w.document, store: w.localStorage, rooms };
}

/* ═══ 1. F2 — a new death never replays the last death's shards ═══*/
console.log('\n1. F2 — a new death at the same spot does not replay the last burst');
{
  const { NEU } = boot();
  /* A ctx that records every rectangle the death draws. The shard
     phase starts at 420ms, so 900ms is well inside it. */
  const frame = sinceMs => {
    const rects = [];
    const ctx = { fillStyle: '', globalAlpha: 1,
                  fillRect(x, y, w, h) { rects.push([x, y, w, h]); } };
    NEU.danmaku.death(ctx, 300, 300, sinceMs);
    return JSON.stringify(rects);
  };
  const burst = frame(900);
  ok('the burst is drawn at all', burst.length > 20);
  ok('the same death, same frame: shards are cached, not rebuilt', frame(900) === burst);
  /* The first death is interrupted at 900ms and never reaches 1700,
     so nothing cleared the cache. The next death starts at 0. */
  frame(0);
  const next = frame(900);
  ok('>>> a new death at the same coordinates builds fresh shards <<<', next !== burst);
}

/* ═══ 2. F5 — a full console survives a reload ════════════════════*/
console.log('\n2. F5 — the charge is saved at 100 and read back on load');
{
  const { NEU } = boot();
  ok('a fresh page starts flat', NEU.charge() === 0);
  NEU.devCharge(50);
  ok('half charge is not written', NEU.save.flag('console_charge') === undefined);
  NEU.devCharge(100);
  ok('reaching 100 is written to the save', NEU.save.flag('console_charge') === 100);

  const before = NEU.save.serialise();
  NEU.save.wipe();
  ok('wipe forgets it', NEU.save.flag('console_charge') === undefined);
  NEU.save.deserialise(before);
  ok('serialise -> wipe -> restore is identical',
     noStamp(NEU.save.serialise()) === noStamp(before));

  /* The real round trip: a page that loads that save. */
  const again = boot({ stored: before });
  ok('>>> a page loaded with that save starts charged <<<', again.NEU.charge() === 100);
  ok('the save file itself still reads 100 after that load',
     again.NEU.save.flag('console_charge') === 100);

  /* The dock is only reachable at 100, and its block writes the same
     value as the crossing did. Source check, anchored to the dock
     callback so the same text elsewhere does not count. */
  const a = SANS_JS.indexOf('\n      docked = true;\n');
  const b = SANS_JS.indexOf('setTimeout(function () { if (NEU.deck) NEU.deck.open(); }, 420);', a);
  ok('the dock callback is found', a > 0 && b > a);
  const dock = a > 0 && b > a ? SANS_JS.slice(a, b) : '';
  ok('>>> the dock block writes the charge to the save <<<',
     /NEU\.save\.flag\('console_charge', 100\)/.test(dock));

  /* The blaster's gain: the crossing is written right after the gain,
     not in the per-frame path. bullet.js is CRLF, hence \r?\n. */
  const BULLET_JS = fs.readFileSync(path.join(ROOT, 'js/game/bullet.js'), 'utf8');
  ok('the blaster writes the crossing right after it gains charge',
     /charge = Math\.min\(100, charge \+ 50\);\r?\n\s*keepCharge\(\);/.test(BULLET_JS));
}

/* ═══ 3. F6 — the merchant remembers he has greeted you ═══════════*/
console.log('\n3. F6 — the merchant opens on the first-visit line once');
{
  const { NEU, rooms } = boot();
  const calls = [];
  NEU.shop.open = s => calls.push(s);
  const merchant = rooms.d1_street && rooms.d1_street.entities
    .find(e => e.look === 'merchant');
  ok('the merchant stands in d1_street', !!merchant && typeof merchant.run === 'function');

  NEU.engine.enter('d1_street', 'fire');
  merchant.run(NEU.engine.api);
  ok('the first visit opens the board on step 0', calls[0] === 0);
  ok('the visit is recorded in the save', NEU.save.flagged('shop_seen'));

  NEU.engine.enter('d1_street', 'fire');
  merchant.run(NEU.engine.api);
  ok('a second visit in the same session opens on step 1', calls[1] === 1);

  /* The reload: a page that loads the save the visits wrote. */
  const reloaded = boot({ stored: NEU.save.serialise() });
  const calls2 = [];
  reloaded.NEU.shop.open = s => calls2.push(s);
  reloaded.NEU.engine.enter('d1_street', 'fire');
  const m2 = reloaded.rooms.d1_street.entities.find(e => e.look === 'merchant');
  m2.run(reloaded.NEU.engine.api);
  ok('>>> after a reload the merchant opens on step 1 <<<', calls2[0] === 1);
}

/* ═══ 4. K1 — a fight held upright is told to turn the phone ══════*/
console.log('\n4. K1 — the portrait-fight class follows a live fight');
{
  const { w, NEU } = boot();
  const body = w.document.body;
  /* touch.js polls every 200ms on the page clock, which is normal here,
     so each step waits a little longer than one poll. */
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const hinted = () => body.classList.contains('is-portrait-fight');
  w.innerWidth = 390; w.innerHeight = 844;          /* a phone, upright */

  /* No touch seen yet and no coarse pointer: a tall desktop window. */
  NEU.bullet = { running: true };
  await wait(260);
  ok('>>> a tall window with no touch gets no hint (no phone to turn) <<<', !hinted());
  w.dispatchEvent(new w.Event('touchstart'));        /* now a thumb is on it */

  NEU.bullet = { running: false };
  await wait(260);
  ok('portrait, nothing running: no class', !hinted());

  NEU.bullet = { running: true };
  await wait(260);
  ok('>>> portrait + bullet fight: class set <<<', hinted());

  NEU.bullet = { running: false };
  NEU.polt = { running: true };
  await wait(260);
  ok('portrait + polt fight: class set', hinted());

  NEU.polt = { running: false };
  NEU.scal = { running: true };
  await wait(260);
  ok('portrait + scal fight: class set', hinted());

  NEU.scal = { running: false };
  NEU.deck = { running: true };
  await wait(260);
  ok('portrait but a menu (the deck) is up: no class', !hinted());

  NEU.deck = { running: false };
  NEU.bullet = { running: true };
  w.innerWidth = 844; w.innerHeight = 390;          /* turned sideways */
  await wait(260);
  ok('>>> landscape fight: no class <<<', !hinted());

  w.innerWidth = 390; w.innerHeight = 844;
  await wait(260);
  ok('back to portrait mid-fight: class returns', hinted());

  NEU.bullet = { running: false };
  await wait(260);
  ok('the fight ends: class goes', !hinted());
}

/* ═══ 5. K1 — the hint is one CSS rule, under the dialogue box ════*/
console.log('\n5. K1 — the hint is one CSS rule, under the dialogue box');
{
  const SEL = 'body.is-portrait-fight::before';
  /* Anchored to the start of a line, so a mention inside a comment is
     not taken for the rule itself. */
  const at = CSS.indexOf('\n' + SEL + ' {');
  const rule = at < 0 ? '' : CSS.slice(at, CSS.indexOf('}', at) + 1);
  ok('the hint is a ::before on body.is-portrait-fight', at >= 0);
  ok('it says what it should',
     rule.includes('content: "turn your phone sideways for more room"'));
  ok('16px text', /font-size:\s*16px/.test(rule));
  ok('fixed and top-centred',
     /position:\s*fixed/.test(rule) && /\btop:/.test(rule) &&
     /left:\s*50%/.test(rule) && /translateX\(-50%\)/.test(rule));
  ok('pointer-events: none', /pointer-events:\s*none/.test(rule));

  const z = +((rule.match(/z-index:\s*(\d+)/) || [])[1]);
  const dAt = CSS.indexOf('\n.tbox {');
  const dz = +((bodyOf(CSS, dAt).match(/z-index:\s*(\d+)/) || [])[1]);
  ok(`>>> z-index ${z} sits just below the dialogue box (${dz}) <<<`,
     z > 0 && dz > z && dz - z <= 3);

  const dur = +((rule.match(/animation:[^;]*?(\d+(?:\.\d+)?)s\b/) || [])[1]);
  ok(`it fades out after a few seconds (${dur}s)`, dur >= 2 && dur <= 8);
  ok('the fade is a named keyframe block',
     CSS.includes('\n@keyframes ' + (rule.match(/animation:\s*([\w-]+)/) || [])[1] + ' {'));

  /* Reduced motion: the same length, but a cut rather than a fade. */
  const rmBodies = [];
  let rm = CSS.indexOf('\n@media (prefers-reduced-motion: reduce) {');
  while (rm >= 0) {
    rmBodies.push(bodyOf(CSS, rm));
    rm = CSS.indexOf('\n@media (prefers-reduced-motion: reduce) {', rm + 1);
  }
  const rmRule = rmBodies.find(b => b.includes(SEL)) || '';
  ok('a reduced-motion rule covers the hint', rmRule.length > 0);
  ok('...and it cuts the hint (step-end) rather than fading it',
     /step-end/.test(rmRule.slice(rmRule.indexOf(SEL))));

  /* The hint is CSS only: no element was added to the page for it. */
  ok('no markup was added for the hint',
     !HTML.includes('turn your phone sideways') && !HTML.includes('is-portrait-fight'));
}

console.log('\n' + (fail === 0 ? `ALL PASS (${pass})` : `${fail} FAILED, ${pass} passed`));
process.exit(fail === 0 ? 0 : 1);
