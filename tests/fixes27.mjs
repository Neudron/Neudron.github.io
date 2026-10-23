/* fixes27.mjs — B1 juice scale, and L6 the music scheduler.
   Run: node tests/fixes27.mjs

   B1. A hit is a sentence and a burst is its punctuation. juice.js
   names five tiers and gives each a particle budget (TIER.parts). A
   call site that asks for a 'small' hit and then throws twelve
   sparks has quietly promoted itself to a medium, and nothing else
   in the code says so. This suite pairs every juice.hit('<tier>')
   with the juice.burst( that follows it within twelve lines, reads
   the burst's count, and holds it to twice the tier's budget: a burst
   may run to double its tier before it is flagged. Anything over that
   is either a bug or belongs on the allowlist with a reason written
   next to it.

   L6. music.js plays on its own once a pointer or key has armed it, and
   its failure modes are silent: a bar with no bass or pad is a dropout
   nobody reports, and a note stamped earlier than the one before it is
   a click. Both are checked here by driving the real scheduler with a
   recording AudioContext — the notes it asks for are the notes it would
   play. */

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };
const read = f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* ── the allowlist ───────────────────────────────────────────────
   Every entry is file:line of the juice.hit call and must still be a
   real outlier — an exemption that stops being needed is removed,
   not left to rot (see the stale-entry check below). */
const ALLOWLIST = [
  /* boss-scal.js:875 — hitPlayer(), the path where the standing barrier
     absorbs a hit. It asks for a 'small' hit and throws 12 sparks, where
     the small budget is 4 (cap 8). No comment in the code explains the
     12. It is exempted here rather than the code changed, until someone
     decides whether the barrier pop is meant to be bigger than a small
     hit. Remove the entry if the count is brought down to 8. */
  'js/act4/boss-scal.js:875',
];

/* ═══ B1. hit → burst, within the tier budget ════════════════════*/
console.log('\nB1. every hit is followed by a burst its tier can carry');

/* juice.js TIER table — read from the source, so a retuned budget is
   picked up without touching this suite. */
const JUICE = read('core/juice.js');
const tierStart = JUICE.indexOf('var TIER = {');
const tierBlock = JUICE.slice(tierStart, JUICE.indexOf('};', tierStart) + 1);
const TIER = {};
for (const m of tierBlock.matchAll(/(\w+):\s*\{[^}]*?parts:\s*(\d+)/g)) TIER[m[1]] = +m[2];
ok('juice.js TIER table has tick/small/medium/large/huge with a parts budget',
   ['tick', 'small', 'medium', 'large', 'huge'].every(t => Number.isFinite(TIER[t])));
console.log('       parts: ' + Object.entries(TIER).map(([k, v]) => `${k} ${v}`).join(', '));

/* Blank out comments but keep every newline and character offset, so
   line numbers in the report are the file's real line numbers and a
   commented-out juice call is not counted. */
function stripComments(src) {
  const blank = s => s.replace(/[^\n]/g, ' ');
  let out = src.replace(/\/\*[\s\S]*?\*\//g, blank);
  out = out.replace(/^([ \t]*)\/\/[^\n]*/gm, (m, ws) => ws + blank(m.slice(ws.length)));
  out = out.replace(/([;}])([ \t]*)\/\/[^\n]*/g,
                    (m, p, ws) => p + ws + blank(m.slice(p.length + ws.length)));
  return out;
}

/* The argument list starting at the '(' at openIdx, split at top-level
   commas. Strings and nested brackets are respected, so a colour
   literal or an object argument does not shift the count argument. */
function callArgs(text, openIdx) {
  const args = [];
  let depth = 0, cur = '', q = null;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (q) {
      cur += c;
      if (c === '\\') { cur += text[++i]; continue; }
      if (c === q) q = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { q = c; cur += c; continue; }
    if (c === '(' || c === '[' || c === '{') { depth++; if (depth === 1) continue; }
    else if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth === 0) { args.push(cur.trim()); return args; }
    }
    else if (c === ',' && depth === 1) { args.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  return args;
}

const FILES = ['js/game/bullet.js', 'js/act4/boss-scal.js',
               'js/act4/scal-worm.js', 'js/act4/boss-polt.js'];
const WINDOW = 12;   /* lines: a burst this far after the hit belongs to it */

const pairs = [], unpaired = [];
let nonLiteral = 0, hitCalls = 0, burstCalls = 0;
for (const f of FILES) {
  const src = stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r/g, ''));
  const lineOf = off => src.slice(0, off).split('\n').length;
  const bursts = [...src.matchAll(/juice\.burst\(/g)]
    .map(m => ({ off: m.index, open: m.index + m[0].length - 1, line: lineOf(m.index) }));
  const hits = [...src.matchAll(/juice\.hit\(\s*'([a-z]+)'/g)]
    .map(m => ({ off: m.index, tier: m[1], line: lineOf(m.index) }));
  hitCalls += (src.match(/juice\.hit\(/g) || []).length;
  burstCalls += bursts.length;
  /* A hit whose tier is not a literal would slip past the regex. Count
     the raw calls and insist every one was read. */
  ok(`${f}: every juice.hit names its tier as a literal`,
     hits.length === (src.match(/juice\.hit\(/g) || []).length);

  for (const h of hits) {
    const b = bursts.find(x => x.off > h.off && x.line - h.line <= WINDOW);
    if (!b) { unpaired.push(`${f}:${h.line} ${h.tier}`); continue; }
    const args = callArgs(src, b.open);
    const raw = args[2] || '';
    if (!/^\d+$/.test(raw)) { nonLiteral++; continue; }
    pairs.push({ file: f, hitLine: h.line, tier: h.tier, burstLine: b.line, count: +raw });
  }
}

ok(`found ${pairs.length} hit→burst pairs (floor 15, from ${hitCalls} hits and ${burstCalls} bursts)`,
   pairs.length >= 15);
console.log(`       hits with no burst in reach: ${unpaired.length}` +
            (unpaired.length ? ' (' + unpaired.join(', ') + ')' : ''));
console.log(`       burst counts not a numeric literal (skipped): ${nonLiteral}`);

const key = p => `${p.file}:${p.hitLine}`;
const cap = p => (TIER[p.tier] === undefined ? NaN : 2 * TIER[p.tier]);

for (const p of pairs) {
  const limit = cap(p);
  const allowed = ALLOWLIST.includes(key(p));
  const pass_ = Number.isFinite(limit) && (p.count <= limit || allowed);
  ok(`${key(p)} ${p.tier} → burst ${p.count} at line ${p.burstLine} (cap ${limit})` +
     (allowed && p.count > limit ? '  [allowlisted]' : ''), pass_);
}

ok('every allowlist entry is still a real outlier (no stale exemptions)',
   ALLOWLIST.every(k => pairs.some(p => key(p) === k && p.count > cap(p))));

/* ═══ L6. music.js, every track, two full chord cycles ═══════════*/
console.log('\nL6. every track plays two chord cycles with no silent bar');

/* A recording AudioContext. Each oscillator records the layer gain it
   was routed into (osc → envelope gain → layer gain), so a note can be
   attributed to the pad, bass, lead or perc bus rather than guessed at
   from its pitch. currentTime is writable: the suite drives the clock. */
function audioStub(w) {
  class Node {
    constructor(ctx) { this.ctx = ctx; this.out = []; }
    connect(d) { this.out.push(d); return d; }
    disconnect() {}
  }
  class Param {
    constructor(v) { this.value = v; }
    setValueAtTime(v) { this.value = v; return this; }
    exponentialRampToValueAtTime(v) { this.value = v; return this; }
    linearRampToValueAtTime(v) { this.value = v; return this; }
    cancelScheduledValues() { return this; }
  }
  class Gain extends Node { constructor(ctx) { super(ctx); this.gain = new Param(1); } }
  class Osc extends Node {
    constructor(ctx) {
      super(ctx);
      this.type = ''; this.frequency = new Param(0); this.detune = new Param(0);
    }
    start(t) {
      /* osc.out[0] is the envelope gain; its out[0] is the layer gain. */
      const env = this.out[0];
      this.ctx.notes.push({ t, f: this.frequency.value,
                            layer: env && env.out ? env.out[0] : undefined });
    }
    stop() {}
  }
  class Src extends Node {
    constructor(ctx) { super(ctx); this.buffer = null; }
    start(t) { this.ctx.notes.push({ t, f: 0, layer: undefined }); }
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

const dom = new JSDOM(HTML, { pretendToBeVisual: true, url: 'https://www.neu.ac/',
                              runScripts: 'outside-only' });
const w = dom.window;
w.document.querySelectorAll('noscript').forEach(n => n.remove());
w.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe() {} disconnect() {} };
w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
audioStub(w);
/* music.js alone: it reads save and engine only through guarded
   checks, so nothing else needs to exist for it to run. */
w.eval(read('core/music.js'));
const NEU = w.NEU;

/* The gesture gate: nothing is built, and nothing sounds, until a
   pointer goes down. Arming builds the one AudioContext. */
w.dispatchEvent(new w.Event('pointerdown'));
const ctx = w.__actx;
ok('a gesture arms music.js and builds one AudioContext', !!ctx && NEU.music.armed === true);

const ids = Object.keys(NEU.music.tracks);
ok(`NEU.music.tracks exposes ${ids.length} tracks (floor 8)`, ids.length >= 8);
console.log('       ' + ids.join(', '));

const SPB = 16;             /* steps per bar — music.js's own constant */
let clock = 1000;           /* a clock well clear of zero, moved on per track */

for (const id of ids) {
  const tr = NEU.music.tracks[id];
  const sd = (60 / tr.bpm) / 4;            /* one 16th, as music.js counts it */
  const barLen = SPB * sd;
  const bars = 2 * tr.chords.length;       /* two full chord cycles */
  const target = bars * SPB;

  /* Judge each track alone: mark whatever is sounding dead, and let the
     next pass drop it before anything new is scheduled. */
  for (const v of NEU.music._v()) v.dead = true;
  ctx.currentTime = clock;
  NEU.music._tick();

  const i0 = ctx.notes.length;
  NEU.music.play(id);
  const v = NEU.music._v().find(x => x.id === id);
  if (!v) { ok(`${id}: starts a voice`, false); clock += 1000; continue; }
  const v0 = v.at;                          /* when step 0 is stamped */

  /* Drive the clock forward in small steps. Each pass schedules notes up
     to LOOK seconds ahead, exactly as the real interval would. */
  let now = clock;
  for (let g = 0; v.step < target && g < 200000; g++) {
    now += 0.05;
    ctx.currentTime = now;
    NEU.music._tick();
  }
  const notes = ctx.notes.slice(i0);
  ok(`${id}: scheduled all ${bars} bars (${notes.length} notes)`, v.step >= target && notes.length > 0);

  /* Note start times never go backwards. */
  const backwards = notes.findIndex((n, i) => i > 0 && !(n.t >= notes[i - 1].t));
  ok(`${id}: note start times are monotonic non-decreasing`,
     backwards === -1 && notes.every(n => Number.isFinite(n.t)));

  /* Each bar has a pad or bass note at (or within half a 16th of) its
     first step. A silent bar is a dropout, and it is silent in the
     literal sense. */
  const bed = n => n.layer === v.lg.pad || n.layer === v.lg.bass;
  const pad = n => n.layer === v.lg.pad;
  const atStep = (n, t0) => Math.abs(n.t - t0) < sd / 2;
  const silent = [], sig = [];
  for (let k = 0; k < bars; k++) {
    const t0 = v0 + k * barLen;
    if (!notes.some(n => bed(n) && atStep(n, t0))) silent.push(k);
    sig.push(notes.filter(n => pad(n) && atStep(n, t0))
                  .map(n => n.f.toFixed(2)).sort().join(','));
  }
  ok(`${id}: no silent bar (pad or bass on every bar's first step)` +
     (silent.length ? ' — silent bars ' + silent.join(',') : ''),
     silent.length === 0);

  /* The progression repeats: bar k voices the same chord as bar k - n,
     where n is the number of chords in the cycle. */
  const n_ = tr.chords.length;
  const repeats = sig.slice(n_).every((s, i) => s === sig[i]);
  ok(`${id}: the second chord cycle repeats the first`, repeats && sig.slice(0, n_).every(s => s.length > 0));

  clock += 1000;
}

/* ── summary ─────────────────────────────────────────────────────*/
console.log('\n' + (fail === 0 ? `ALL PASS (${pass})` : `${fail} FAILED, ${pass} passed`));
process.exit(fail === 0 ? 0 : 1);
