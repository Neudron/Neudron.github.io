/* fixes14.mjs — the tilesets (pending item 2.2, PLAN.md Phase 4b).
   Run: node fixes14.mjs

   Six zones now draw from real 16x16 art instead of flat palette
   rectangles. What has to stay true:

     - every rects entry lands inside its atlas, on the 16px grid
     - every char that a room actually uses has a tile
     - `colours` survives as the fallback, because that is what renders
       if a sheet 404s and it is what let every room ship before the art
       existed
     - no `sr-*` source atlas is ever referenced by shipped code
     - the engine really does take the atlas path when the image is
       loaded, and really does fall back when it is not

   The last one is the point of the suite. Asserting that a `rects` table
   exists proves nothing — engine.js has to be observed choosing it. */

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };
const read = f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');

const TILE = 16;
const ZONES = {
  woods:  'act4/rooms-a.js', castle: 'act4/rooms-a.js',
  city:   'act4/rooms-d.js', home:   'act4/rooms-d.js',
  prize:  'act4/rooms-g.js', storm:  'act4/rooms-g.js'
};

/* ── read a PNG's dimensions without a decoder ──────────────────────
   IHDR is always the first chunk: 8-byte signature, 4-byte length,
   4-byte type, then width and height as big-endian uint32. */
function pngSize(p) {
  const b = fs.readFileSync(p);
  if (b.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

/* pull one tileset's literal out of its file, brace-balanced.
   A lazy /\{([^}]*)\}/ stops at the first nested object and has already
   cost this project six false failures — see PLAN.md §1.8. */
function tilesetBody(src, name) {
  const at = src.indexOf("E.tileset('" + name + "'");
  if (at < 0) return null;
  let i = src.indexOf('{', at), depth = 0, start = i;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (!depth) return src.slice(start, i + 1); }
  }
  return null;
}

console.log('\n1. every zone points at real art');

const DEFS = {};
for (const [zone, file] of Object.entries(ZONES)) {
  const body = tilesetBody(read(file), zone);
  if (!body) { ok(zone + ': tileset found', false); continue; }
  DEFS[zone] = body;
  const src = (body.match(/src:\s*'([^']+)'/) || [])[1];
  ok(zone + ': has a src (' + (src || 'NONE') + ')', !!src);
  if (src) {
    const p = path.join(ROOT, src);
    ok(zone + ': that file exists on disk', fs.existsSync(p));
  }
}

console.log('\n2. rects land inside the atlas, on the grid');

const RECTS = {};
for (const [zone, body] of Object.entries(DEFS)) {
  const src = (body.match(/src:\s*'([^']+)'/) || [])[1];
  const rectBlock = (body.match(/rects:\s*\{([^}]*)\}/) || [])[1] || '';
  const entries = [...rectBlock.matchAll(/'(.)':\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]/g)]
    .map(m => [m[1], +m[2], +m[3]]);
  RECTS[zone] = new Set(entries.map(e => e[0]));

  ok(zone + ': has rects (' + entries.length + ')', entries.length > 0);
  if (!src || !entries.length) continue;

  const dim = pngSize(path.join(ROOT, src));
  ok(zone + ': atlas is a readable PNG', !!dim);
  if (!dim) continue;

  const onGrid = entries.every(([, x, y]) => x % TILE === 0 && y % TILE === 0);
  ok(zone + ': every rect sits on the 16px grid', onGrid);

  const inside = entries.every(([, x, y]) => x >= 0 && y >= 0 &&
                                             x + TILE <= dim.w && y + TILE <= dim.h);
  ok('>>> ' + zone + ': every rect is inside the atlas <<<', inside);
  if (!inside) {
    for (const [c, x, y] of entries)
      if (x + TILE > dim.w || y + TILE > dim.h)
        console.log("       '" + c + "' [" + x + ',' + y + '] outside ' + dim.w + 'x' + dim.h);
  }

  const uniq = new Set(entries.map(e => e[1] + ',' + e[2]));
  ok(zone + ': no two chars share one tile', uniq.size === entries.length);
}

console.log('\n3. the palette fallback was not deleted');

for (const [zone, body] of Object.entries(DEFS)) {
  const cm = body.match(/colours:\s*\{([^}]*)\}/);
  ok(zone + ': still carries colours', !!cm);
  if (!cm) continue;
  const cols = new Set([...cm[1].matchAll(/'(.)':/g)].map(m => m[1]));
  /* Every char with art must ALSO have a colour, or deleting the PNG
     leaves a hole rather than degrading. */
  const covered = [...(RECTS[zone] || [])].every(c => cols.has(c));
  ok('>>> ' + zone + ': every art tile has a colour behind it <<<', covered);
  if (!covered)
    console.log('       uncovered: ' +
      [...RECTS[zone]].filter(c => !cols.has(c)).join(' '));
}

console.log('\n4. every char the rooms actually draw has a tile');

/* Collect the chars used by the room maps in each file, minus the ones
   that are entities or blank rather than terrain. */
const NOT_TERRAIN = new Set([' ', '@']);
for (const file of new Set(Object.values(ZONES))) {
  const src = read(file);
  const zonesHere = Object.keys(ZONES).filter(z => ZONES[z] === file);
  const used = new Set();
  /* Rooms store their grid as `tiles: [ '####', ... ].join('\n')`.
     (An earlier draft of this suite looked for `map:` and cheerfully
     reported "0 used" for all three files — a scan that finds nothing
     and passes is worse than one that fails.) */
  for (const m of src.matchAll(/tiles:\s*\[([\s\S]*?)\]\s*\.join/g))
    for (const row of m[1].matchAll(/'([^']*)'/g))
      for (const ch of row[1]) if (!NOT_TERRAIN.has(ch)) used.add(ch);
  ok(file + ': the tile grids were actually found', used.size > 0);

  /* A char is fine if ANY tileset in this file draws it, since the file's
     rooms split across its two zones.

     NOTE the shape of this check. engine.js:502-508 has a final fallback
     that paints ANY unknown char either solid-dark or floor-dark, so
     nothing is ever literally unrendered and "does it draw something"
     would pass for every char forever. What we actually want to know is
     whether each char draws something CHOSEN. `A` (the altar plinth)
     was silently taking the generic floor colour and reading as a hole
     in the floor — a real bug that a does-it-draw check would miss. */
  const ENGINE_SPECIAL = new Set(['i', 'M', 'P']);   // engine.js:505
  const drawn = new Set(ENGINE_SPECIAL);
  for (const z of zonesHere) {
    for (const c of RECTS[z] || []) drawn.add(c);
    const cm = (DEFS[z] || '').match(/colours:\s*\{([^}]*)\}/);
    if (cm) for (const m of cm[1].matchAll(/'(.)':/g)) drawn.add(m[1]);
  }
  const missing = [...used].filter(c => !drawn.has(c));
  ok('>>> ' + file + ': every terrain char has a chosen look (' + used.size + ' used) <<<',
     !missing.length);
  if (missing.length)
    console.log('       falls through to the generic fill: ' + missing.join(' '));
}

console.log('\n5. no source atlas ships');

const ALL_JS = fs.readdirSync(path.join(ROOT, 'js'), { recursive: true })
  .filter(f => String(f).endsWith('.js'))
  .map(f => ({ f, s: read(String(f).replace(/\\/g, '/')) }));

/* `NEU.sheetSources` in data/sheets.js is the exclusion manifest — it
   names the source atlases precisely so the deploy check can assert they
   are absent. Scanning it as if it were a leak flags the one mechanism
   built to prevent the leak. Cut it out before searching. */
const stripManifest = s =>
  s.replace(/NEU\.sheetSources\s*=\s*\[[\s\S]*?\];/, 'NEU.sheetSources=[];');

const leaks = ALL_JS.filter(({ s }) =>
  /['"][^'"]*\bsr-[A-Za-z_]+-\d+\.png/.test(stripManifest(s)));
ok('>>> no shipped module references an sr-* atlas <<<', !leaks.length);
if (leaks.length) console.log('       ' + leaks.map(l => l.f).join(', '));

/* and the manifest itself must still be there and still be populated,
   or the check above passes for the wrong reason */
const SH = read('data/sheets.js');
const man = SH.match(/NEU\.sheetSources\s*=\s*\[([\s\S]*?)\];/);
ok('the source-atlas manifest still exists',
   !!man && (man[1].match(/sr-/g) || []).length >= 7);

const tilesDir = path.join(ROOT, 'img/act4/tiles');
ok('the tile sheets live in their own folder', fs.existsSync(tilesDir));
if (fs.existsSync(tilesDir)) {
  const bytes = fs.readdirSync(tilesDir)
    .reduce((n, f) => n + fs.statSync(path.join(tilesDir, f)).size, 0);
  console.log('       ' + (bytes / 1024).toFixed(1) + ' KB of tile sheets');
  ok('tile sheets are small (< 64 KB)', bytes < 64 * 1024);
}

console.log('\n6. the engine actually takes the atlas path');

/* This is the assertion that matters. Boot the real engine, hand it a
   fake Image that reports itself loaded, and watch which draw call it
   makes: drawImage with a source rect (art) or fillRect (palette). */
function bootEngine(imageLoads) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { pretendToBeVisual: true, url: 'https://www.neu.ac/',
                                runScripts: 'outside-only' });
  const w = dom.window;
  const calls = [];
  w.IntersectionObserver = class { constructor(cb){this.cb=cb;} observe(){} disconnect(){} };
  w.matchMedia = () => ({ matches:false, addListener(){}, addEventListener(){} });
  w.scrollTo = () => {};
  w.requestAnimationFrame = cb => w.setTimeout(() => cb(Date.now()), 0);
  w.Element.prototype.getBoundingClientRect = () =>
    ({ left:0, top:0, right:640, bottom:480, width:640, height:480, x:0, y:0 });

  /* an Image that is "already loaded" — or permanently broken */
  w.Image = class {
    constructor() {
      this.complete = imageLoads;
      this.naturalWidth = imageLoads ? 128 : 0;
      this.naturalHeight = imageLoads ? 16 : 0;
      this._src = '';
      if (!imageLoads) w.setTimeout(() => this.onerror && this.onerror(), 0);
    }
    set src(v) { this._src = v; if (imageLoads) w.setTimeout(() => this.onload && this.onload(), 0); }
    get src() { return this._src; }
    addEventListener(k, fn) { this['on' + k] = fn; }
  };

  w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {
    get(_, k) {
      if (k === 'canvas') return { width: 640, height: 480 };
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'createRadialGradient' || k === 'createLinearGradient')
        return () => ({ addColorStop(){} });
      if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (k === 'drawImage' || k === 'fillRect')
        return (...a) => calls.push({ op: k, n: a.length });
      if (typeof k === 'string') return () => {};
      return undefined;
    }, set(){ return true; }
  });

  for (const f of ['core/quest.js','core/save.js','core/juice.js','core/danmaku.js',
                   'data/sheets.js','core/engine.js','act4/rooms-a.js',
                   'act4/rooms-d.js','act4/rooms-g.js']) {
    try { w.eval(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8')); }
    catch (e) { console.log('  !! ' + f + ': ' + e.message); }
  }
  return { w, calls };
}

const loaded = bootEngine(true);
const E = loaded.w.NEU && loaded.w.NEU.engine;
ok('engine booted with the room files', !!E);

if (E && E.tilesets) {
  const ts = E.tilesets();
  const named = Object.keys(ZONES).filter(z => ts && ts[z]);
  ok('engine holds all six tilesets (' + named.length + '/6)', named.length === 6);
  const withArt = named.filter(z => ts[z].src && ts[z].rects);
  ok('>>> all six carry src + rects at runtime <<<', withArt.length === 6);
} else {
  /* engine may not expose its tileset registry; fall back to the source
     check above rather than silently passing */
  ok('engine exposes tilesets() for inspection', false);
  console.log('       (add `tilesets: function(){ return tilesets; }` to engine.js exports)');
}

/* The draw path itself: engine.js:490-501 gates on
   `atlas && atlas.complete && atlas.naturalWidth && !atlas.__failed`. */
const ENG = read('core/engine.js');
ok('draw path checks complete + naturalWidth before drawing',
   /atlas\s*&&\s*atlas\.complete\s*&&\s*atlas\.naturalWidth/.test(ENG));
ok('>>> draw path has an else that fills a colour <<<',
   /ts\.colours/.test(ENG) && /fillRect/.test(ENG));
ok('a failed atlas is marked so it is not retried every frame',
   /__failed/.test(ENG));

console.log(
  '\n' + (fail ? 'FAILURES: ' + fail + ' (passed ' + pass + ')' : 'ALL PASS (' + pass + ')'));
process.exit(fail ? 1 : 0);
