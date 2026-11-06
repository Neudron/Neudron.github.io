#!/usr/bin/env node
/*
 * parity.mjs — content manifest for the strangler plan (Phase 0.1, Phase 5 gates).
 *
 * Records what the site's content ACTUALLY is: rooms + tilesets (via a node:vm
 * sandbox with a recording stand-in NEU.engine, the tests/reach.mjs trick),
 * sheet keys, scal attack names, quest ids, shop stock, save-flag call sites,
 * and a sha256 inventory of every file under js/, img/, audio/, fonts/.
 *
 *   node scripts/parity.mjs                        # write .parity/baseline.json
 *   node scripts/parity.mjs --against FILE         # diff capture vs FILE
 *
 * Determinism: the manifest is captured twice and byte-compared internally;
 * exit 2 if a capture differs. No timestamps in the JSON on purpose.
 *
 * # ponytail: quest/shop/flags lanes are regex over source (STEPS/STOCK are
 * closure vars), so counts of exact literals only; dynamic keys (`rank:*`,
 * `solved:*`, `gone:*`, `p:`, `t:` templates) appear as prefixes or not at
 * all. Upgrade a lane to a vm capture when its scene migrates (Phase 2+).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, '.parity', 'baseline.json');

/* ── hashing ─────────────────────────────────────────────────────────── */
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

/* ── static source-parsed lanes (closure tables never reach a sandbox) ─ */
function scanRegex(rel, re, keep) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const out = [];
  for (let m; (m = re.exec(src)); ) out.push(keep(m));
  return out;
}

/* sha scalar/object values (functions become "fn"), so a tileset recolor
   shows up in the diff without dragging its draw functions into JSON */
function hashValues(o) {
  const out = {};
  for (const k of Object.keys(o || {})) out[k] = hashOne(o[k]);
  return out;
}
function hashOne(v) {
  const t = typeof v;
  if (v === null || t === 'string' || t === 'number' || t === 'boolean') return sha(String(v));
  if (t === 'function') return 'fn';
  if (Array.isArray(v)) return sha(v.map(hashOne).join('|'));
  return sha(JSON.stringify(hashValues(v)));
}

/* ── vm lane: rooms + tilesets, engine stood in (reach.mjs trick) ────── */
const VM_FILES = [
  'js/data/data.js',
  'js/data/sheets.js',
  'js/core/quest.js',
  'js/act4/look-woods.js',
  'js/act4/look-castle.js',
  'js/act4/look-city.js',
  'js/act4/look-prize.js',
  'js/act4/rooms-a.js',
  'js/act4/rooms-d.js',
  'js/act4/rooms-g.js',
  'js/act4/scal-attacks.js',
];

function capture() {
  const rooms = {}, tilesets = {}, errors = [];
  const engine = {
    register: (id, def) => {
      def.id = id;
      rooms[id] = {
        id,
        zone: id.slice(0, id.indexOf('_')) || id,
        ts: def.tileset || '',
        th: sha(String(def.tiles || '')),
        sp: Object.keys(def.spawns || {}).sort(),
        ex: (def.entities || [])
          .filter((e) => e.t === 'exit')
          .map((e) => ({ x: e.x, y: e.y, to: e.to, sp: e.spawn, st: e.style })),
        kinds: (def.entities || []).reduce((acc, e) => {
          acc[e.t] = (acc[e.t] || 0) + 1;
          return acc;
        }, {}),
      };
      return def;
    },
    tileset: (name, def) => {
      tilesets[name] = { keys: Object.keys(def || {}).sort(), v: hashValues(def) };
      return def;
    },
  };
  const host = { NEU: { engine } };
  const ctx = vm.createContext({
    window: host,
    addEventListener: () => {},
    document: { getElementById: () => null, addEventListener: () => {} },
    requestAnimationFrame: () => 0,
    performance: { now: () => 0 },
    matchMedia: () => ({ matches: false }),
    Image: function () {},
    localStorage: { getItem: () => null, setItem: () => {} },
    Audio: function () {},
  });
  for (const f of VM_FILES) {
    const file = path.join(ROOT, f);
    try {
      const src = fs.readFileSync(file, 'utf8');
      new vm.Script(src, { filename: f }).runInContext(ctx, { timeout: 5000 });
    } catch (e) {
      errors.push(`${f}: ${e.message}`);
    }
  }

  /* sheets + scal attack names, straight off the host object */
  const sheets = Object.keys(host.NEU.sheets || {}).sort();
  const atk = host.NEU.scalAtk && host.NEU.scalAtk.names()
    ? host.NEU.scalAtk.names().slice().sort()
    : [];

  const man = {
    v: 1,
    rooms,
    tilesets,
    sheets,
    atk,
    steps: scanRegex('js/core/quest.js', /\{\s*id:\s*'([^']+)',/g, (m) => m[1]),
    marks: scanJs(/\b(?:mark|bump)\(\s*'([^']+)'/g, (m) => m[1]),
    shop: scanRegex('js/act4/shop.js', /\{\s*name:\s*'([^']+)',\s*price:\s*'([^']+)'/g, (m) => m[1] + ' ' + m[2]),
    flags: scanJs(/\bflag(?:ged)?\(\s*'([^']+)'/g, (m) => m[1]),
    js: scanJsDir('js', (src) => ({
      h: sha(src),
      d: (src.match(/lines\s*:\s*\[/g) || []).length,
    })),
    assets: scanAssets(),
    errors,
  };
  return man;
}

/* generic per-file scan over a whole dir tree (sorted paths) */
function scanJsDir(dir, transform) {
  const out = [];
  const walk = (d) => {
    for (const name of fs.readdirSync(d).sort()) {
      const p = path.join(d, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (name.endsWith('.js')) {
        const rel = path.relative(ROOT, p);
        const src = fs.readFileSync(p, 'utf8');
        const base = transform(src);
        out.push({ p: rel.split(path.sep).join('/'), h: base.h, d: base.d });
      }
    }
  };
  walk(path.join(ROOT, dir));
  return out;
}

/* flags + marks regexes across all js files */
function scanJs(re, keep) {
  const out = [];
  walkJs(path.join(ROOT, 'js'), (rel, src) => {
    for (let m; (m = re.exec(src)); ) out.push(keep(m));
  });
  return out.sort();
  function walkJs(d, fn) {
    for (const name of fs.readdirSync(d).sort()) {
      const p = path.join(d, name);
      if (fs.statSync(p).isDirectory()) walkJs(p, fn);
      else if (name.endsWith('.js')) fn(path.relative(ROOT, p).split(path.sep).join('/'), fs.readFileSync(p, 'utf8'));
    }
  }
}

/* ── assets lane: every file under img/ audio/ fonts/ ───────────────── */
function scanAssets() {
  const out = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const name of fs.readdirSync(d).sort()) {
      const p = path.join(d, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (name !== 'README.txt') {
        const rel = path.relative(ROOT, p).split(path.sep).join('/');
        out.push({ p: rel, h: sha(fs.readFileSync(p)), b: st.size });
      }
    }
  };
  for (const g of ['img', 'audio', 'fonts']) walk(path.join(ROOT, g));
  return out;
}

/* ── diff ────────────────────────────────────────────────────────────── */
function diff(a, b, at, out) {
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b)) {
    out.push(`${at}: ${short(a)} => ${short(b)}`);
    return;
  }
  if (Array.isArray(a)) {
    if (a.length !== b.length) out.push(`${at}: [${a.length}] => [${b.length}]`);
    for (let i = 0; i < Math.min(a.length, b.length); i++) diff(a[i], b[i], `${at}[${i}]`, out);
    return;
  }
  if (a && typeof a === 'object') {
    for (const k of Object.keys(a).concat(Object.keys(b)).sort().filter(dupFilter)) {
      diff(a[k], b[k], `${at}.${k}`, out);
    }
    return;
  }
  if (a !== b) out.push(`${at}: ${short(a)} => ${short(b)}`);
  function dupFilter(k, i, arr) { return arr.indexOf(k) === i; }
}
const short = (v) => (v === undefined ? '(absent)' : JSON.stringify(v).slice(0, 60));

/* ── main ────────────────────────────────────────────────────────────── */
const againstIdx = process.argv.indexOf('--against');
const man = capture();
if (JSON.stringify(man) !== JSON.stringify(capture())) {
  console.error('parity: capture is nondeterministic — fix before baselining');
  process.exit(2);
}
const json = JSON.stringify(man, null, 2) + '\n';

if (againstIdx > 0 && process.argv.length > againstIdx + 1) {
  const other = JSON.parse(fs.readFileSync(path.resolve(process.argv[againstIdx + 1]), 'utf8'));
  const out = [];
  diff(other, man, '', out);
  if (!out.length) {
    console.log('parity: identical');
    process.exit(0);
  }
  console.log(`parity: ${out.length} diff${out.length === 1 ? '' : 's'}`);
  for (const line of out.slice(0, 40)) console.log('  ' + line);
  if (out.length > 40) console.log(`  ... ${out.length - 40} more`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, json);
const rooms = Object.keys(man.rooms).length;
console.log(
  `parity: baseline written (${rooms} rooms, ${Object.keys(man.tilesets).length} tilesets, ` +
  `${man.sheets.length} sheets, ${man.atk.length} attacks, ${man.steps.length} steps, ` +
  `${man.marks.length} marks, ${man.shop.length} stock, ${man.flags.length} flags, ` +
  `${man.js.length} js files, ${man.assets.length} assets)`
);
if (man.errors.length) {
  console.error('parity: load errors (recorded in JSON):');
  for (const e of man.errors) console.error('  ' + e);
  process.exit(1);
}
