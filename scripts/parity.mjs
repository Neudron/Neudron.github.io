#!/usr/bin/env node
/*
 * parity.mjs — content manifest for the strangler plan (Phase 0.1/1b, Phase 5 gates).
 *
 * Records what the site's content ACTUALLY is: rooms + tilesets (via a node:vm
 * sandbox with a recording stand-in NEU.engine, the tests/reach.mjs trick),
 * sheet + attack tables, quest ids, shop stock, save-flag call sites, a sha256
 * inventory of every file under js/, img/, audio/, fonts/, and of the shipped
 * html/css + root files.
 *
 *   node scripts/parity.mjs                        # write .parity/baseline.json
 *   node scripts/parity.mjs --against FILE         # diff capture vs FILE
 *   node scripts/parity.mjs --ref R --against FILE # diff capture AT GIT REF vs FILE
 *
 * Arrays are diffed as multisets (add/remove only — no positional index noise).
 * Room entities + spawns and sheet values are hashed, so a dialogue edit or a
 * hitRadius change shows up without the full JSON in the manifest.
 *
 * Determinism: the manifest is captured twice and byte-compared internally;
 * exit 2 if a capture differs. No timestamps in the JSON on purpose.
 *
 * # ponytail: quest/shop/flags lanes are regex over source (STEPS/STOCK are
 * closure vars), so counts of exact literals only; dynamic keys (`rank:*`,
 * `solved:*`, `gone:*`, `p:`, `t:` templates) appear as prefixes or not at
 * all. VM_FILES is a fixed list: a room file added without registering here is
 * silently uncaptured — keep the list in sync (fix when scenes migrate, P2).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.parity', 'baseline.json');

/* ── hashing ─────────────────────────────────────────────────────────── */
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

/* ── file access: worktree fs, or a git ref ──────────────────────────── */
function gitOut(args) {
  return execFileSync('git', args, { cwd: ROOT, maxBuffer: 1 << 26 });
}
function sourcing(ref) {
  if (!ref) return {
    readText: (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8'),
    readBin: (rel) => fs.readFileSync(path.join(ROOT, rel)),
    list: (prefixes) => fsList(prefixes),
  };
  return {
    readText: (rel) => gitShow(ref, rel).toString('utf8'),
    readBin: (rel) => gitShow(ref, rel),
    list: (prefixes) => String(gitOut(['ls-tree', '-r', '--name-only', ref, ...prefixes]))
      .split('\n').filter(Boolean),
  };
}
function gitShow(ref, rel) {
  try {
    return gitOut(['show', `${ref}:${rel}`]);
  } catch (e) {
    e.rel = rel;
    throw e;
  }
}
function fsList(prefixes) {
  const out = [];
  for (const dir of prefixes) {
    const root = path.join(ROOT, dir);
    if (!fs.existsSync(root)) continue;
    const walk = (d) => {
      const rel = path.relative(ROOT, d);
      if (fs.statSync(d).isFile()) { out.push(rel.split(path.sep).join('/')); return; }
      for (const name of fs.readdirSync(d).sort()) {
        const p = path.join(d, name);
        if (fs.statSync(p).isDirectory()) walk(p);
        else out.push(path.relative(ROOT, p).split(path.sep).join('/'));
      }
    };
    walk(root);
  }
  return out;
}

/* ── static source-parsed lanes (closure tables never reach a sandbox) ─ */
function scanRegex(S, rel, re, keep, errors) {
  let src;
  try { src = S.readText(rel); } catch (e) { errors.push(`${rel}: ${e.message}`); return []; }
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

function capture(S) {
  const rooms = {}, tilesets = {}, errors = [];
  const engine = {
    register: (id, def) => {
      def.id = id;
      const u = id.indexOf('_');
      rooms[id] = {
        id,
        zone: u < 0 ? id : id.slice(0, u),
        ts: def.tileset || '',
        th: sha(String(def.tiles || '')),
        sp: Object.keys(def.spawns || {}).sort(),
        /* value hash of spawns + entities: a dialogue/trigger/props edit shows as `sh` */
        sh: sha(String(hashOne(def.spawns || {})) + String(hashOne(def.entities || []))),
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
    try {
      const src = S.readText(f);
      new vm.Script(src, { filename: f }).runInContext(ctx, { timeout: 5000 });
    } catch (e) {
      errors.push(`${f}: ${e.message}`);
    }
  }

  /* sheets as key → value hash (recolor/collision edits are visible), attacks as names */
  const sheets = hashValues(host.NEU.sheets);
  const atk = host.NEU.scalAtk && host.NEU.scalAtk.names()
    ? host.NEU.scalAtk.names().slice().sort()
    : [];

  const man = {
    v: 2,
    rooms,
    tilesets,
    sheets,
    atk,
    steps: scanRegex(S, 'js/core/quest.js', /\{\s*id:\s*'([^']+)',/g, (m) => m[1], errors),
    marks: scanRegJs(S, /\b(?:mark|bump)\(\s*'([^']+)'/g, (m) => m[1], errors),
    shop: scanRegex(S, 'js/act4/shop.js', /\{\s*name:\s*'([^']+)',\s*price:\s*'([^']+)'/g, (m) => m[1] + ' ' + m[2], errors),
    flags: scanRegJs(S, /\bflag(?:ged)?\(\s*'([^']+)'/g, (m) => m[1], errors),
    js: laneFiles(S, ['js'], /\.js$/, (src) => ({
      h: sha(src),
      d: (src.match(/lines\s*:\s*\[/g) || []).length,
    }), errors, null),
    text: laneFiles(S, FS_PREFIXES, /.*/, (src) => ({ h: sha(src) }), errors, (p) => TEXT_ROOTS.includes(p) || /^css\//.test(p)),
    assets: laneAssets(S, errors),
    errors,
  };
  for (const lane of [man.js, man.text, man.assets]) bypSort(lane);
  return man;
}

/* files under prefixes, shaped by transform, filtered by optional filter */
function laneFiles(S, prefixes, extRe, transform, errors, keepFilter) {
  const out = [];
  for (const rel of S.list(prefixes)) {
    if (!extRe.test(rel)) continue;
    if (keepFilter && !keepFilter(rel)) continue;
    try {
      const src = S.readText(rel);
      out.push({ p: rel, ...transform(src, rel) });
    } catch (e) {
      errors.push(`${rel}: ${e.message}`);
    }
  }
  return out;
}
const TEXT_ROOTS = ['index.html', 'CNAME', 'robots.txt', 'sitemap.xml', 'manifest.json', 'README.md', 'package.json'];
const FS_PREFIXES = ['js', 'img', 'audio', 'fonts', 'css', ...TEXT_ROOTS];

/* assets lane: sha256 of RAW bytes (utf8 decode is lossy, no sha on strings) */
function laneAssets(S, errors) {
  const out = [];
  for (const rel of S.list(['img', 'audio', 'fonts'])) {
    if (/README\.txt$/.test(rel)) continue;
    try {
      const buf = S.readBin(rel);
      out.push({ p: rel, h: sha(buf), b: buf.length });
    } catch (e) {
      errors.push(`${rel}: ${e.message}`);
    }
  }
  return bypSort(out);
}
const bypSort = (arr) => {
  if (arr.length && typeof arr[0] === 'object') arr.sort((r, s) => String(r.p).localeCompare(String(s.p)));
  return arr;
};

/* flags + marks regexes across all js files */
function scanRegJs(S, re, keep, errors) {
  const out = [];
  for (const rel of S.list(['js'])) {
    if (!rel.endsWith('.js')) continue;
    try {
      const src = S.readText(rel);
      for (let m; (m = re.exec(src)); ) out.push(keep(m));
    } catch (e) {
      errors.push(`${rel}: ${e.message}`);
    }
  }
  return out.sort();
}

/* ── diff ────────────────────────────────────────────────────────────── */
function diff(a, b, at, out) {
  if (a == null || b == null) {
    if (short(a) !== short(b)) out.push(`${at}: ${short(a)} => ${short(b)}`);
    return;
  }
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b)) {
    out.push(`${at}: ${short(a)} => ${short(b)}`);
    return;
  }
  if (Array.isArray(a)) {
    const lines = [], cntA = multiset(a), cntB = multiset(b);
    for (const [k, n] of cntA) if (n > (cntB.get(k) || 0)) lines.push(`${at}: removed ${k.slice(0, 76)}`);
    for (const [k, n] of cntB) if (n > (cntA.get(k) || 0)) lines.push(`${at}: added ${k.slice(0, 76)}`);
    out.push(...lines.sort());
    return;
    function multiset(arr) {
      const m = new Map();
      for (const v of arr) { const k = JSON.stringify(v); m.set(k, (m.get(k) || 0) + 1); }
      return m;
    }
  }
  if (typeof a === 'object') {
    for (const k of Object.keys(a).concat(Object.keys(b)).sort().filter(dup)) {
      diff(a[k], b[k], at ? `${at}.${k}` : k, out);
    }
    return;
  }
  if (a !== b) out.push(`${at}: ${short(a)} => ${short(b)}`);
  function dup(k, i, arr) { return arr.indexOf(k) === i; }
}
const short = (v) => (v === undefined || v == null ? '(absent)' : JSON.stringify(v).slice(0, 76));

/* ── main ────────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const take = (flag) => {
  const i = argv.indexOf(flag);
  return i < 0 ? null : argv[i + 1] || null;
};
const ref = take('--ref');
const againstFile = take('--against');

if (ref && !againstFile) {
  console.error('usage: node scripts/parity.mjs [--ref <git-ref>] [--against FILE]\n  --ref requires --against');
  process.exit(3);
}

const man = capture(sourcing(ref));
if (JSON.stringify(man) !== JSON.stringify(capture(sourcing(ref)))) {
  console.error('parity: capture is nondeterministic — fix before baselining');
  process.exit(2);
}

let other = null;
if (againstFile) {
  other = JSON.parse(fs.readFileSync(path.resolve(againstFile), 'utf8'));
}

if (other) {
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
fs.writeFileSync(OUT, JSON.stringify(man, null, 2) + '\n');
console.log(
  `parity: baseline written (${Object.keys(man.rooms).length} rooms, ` +
  `${Object.keys(man.tilesets).length} tilesets, ${Object.keys(man.sheets).length} sheets, ` +
  `${man.atk.length} attacks, ${man.steps.length} steps, ${man.marks.length} marks, ` +
  `${man.shop.length} stock, ${man.flags.length} flags, ${man.js.length} js files, ` +
  `${man.text.length} html/css/root files, ${man.assets.length} assets)`
);
if (man.errors.length) {
  console.error('parity: load errors (recorded in JSON):');
  for (const e of man.errors) console.error('  ' + e);
  process.exit(1);
}
