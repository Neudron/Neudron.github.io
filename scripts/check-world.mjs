/* check-world.mjs — static gate for the nonvisual world-graph seam work.
   Checks module syntax/ES5, index.html wiring without reordering existing
   tags, hard graph problems, and that the module itself is a pure, disabled
   advisory API over the real room data. Run: node scripts/check-world.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { buildGraph, validate } from './worldgraph.mjs';
import { loadRooms } from '../tests/reach.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
};

/* 1. module exists and is strict ES5 (same parser the repo gate uses). */
const modPath = path.join(ROOT, 'js', 'core', 'world-graph.js');
let src = '';
try { src = fs.readFileSync(modPath, 'utf8'); } catch (e) { check('world-graph.js exists', false, e.message); }
if (src) {
  check('world-graph.js exists', true);
  let es5 = true;
  try { parse(src, { ecmaVersion: 5 }); } catch (e) { es5 = false; check('world-graph.js parses as ES5', false, e.message); }
  if (es5) check('world-graph.js parses as ES5', true);
}

/* 2. wiring: one tag, inserted between two existing core tags. */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const tags = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map(m => m[1]);
const hits = tags.filter(t => t === 'js/core/world-graph.js');
const at = tags.indexOf('js/core/world-graph.js');
check('exactly one world-graph script tag', hits.length === 1, hits);
check('inserted after engine-doors.js and before engine-kinds.js',
  at > 0 && tags[at - 1] === 'js/core/engine-doors.js' && tags[at + 1] === 'js/core/engine-kinds.js',
  { at, before: tags[at - 1], after: tags[at + 1] });

/* The deploy build has its own explicit bundle list. This checker cannot
   edit it (out of scope), so it reports the gap as an advisory note. */
const buildSrc = fs.readFileSync(path.join(ROOT, 'scripts', 'build.mjs'), 'utf8');
if (!/['"]js\/core\/world-graph\.js['"]/.test(buildSrc))
  console.log('  note build: add js/core/world-graph.js to GAME in scripts/build.mjs (fixes160 / npm run build)');

/* 3. real graph: hard problems fail, known advisory findings are listed. */
const graph = buildGraph(ROOT);
const problems = validate(graph, ROOT);
const HARD = /^(missing-target|missing-spawn|alias-|unresolved-alias|solid-or-missing-spawn|missing-source|missing-or-invalid-via)/;
const hard = problems.filter(p => HARD.test(p));
const advisory = problems.filter(p => !HARD.test(p));
check('no hard graph problems (' + graph.roomIds.length + ' rooms, ' + graph.edges.length + ' edges)',
  hard.length === 0, hard);
if (advisory.length) console.log('  note advisory: ' + advisory.join('; '));

/* 4. the shipped module itself: pure, disabled, API-complete. */
if (src) {
  const fakeWindow = {};
  new Function('window', src)(fakeWindow);
  const WG = fakeWindow.NEU && fakeWindow.NEU.worldGraph;
  check('module publishes NEU.worldGraph', !!WG);
  if (WG) {
    check('module exposes the four required APIs',
      ['get', 'resolveExit', 'isSeamEligible', 'validate'].every(k => typeof WG[k] === 'function'));
    check('module disabled by default', WG.enabled === false, WG.enabled);
    const roomFiles = fs.readdirSync(path.join(ROOT, 'js', 'act4'))
      .filter(f => /^rooms-.*\.js$/.test(f));
    const { rooms } = loadRooms(ROOT, roomFiles);
    const snap = JSON.stringify(rooms);
    const found = WG.validate(rooms);
    check('validate(real rooms) returns an array', Array.isArray(found));
    check('validate(real rooms) does not mutate input', JSON.stringify(rooms) === snap);
  }
}

console.log('\ncheck-world: ' + pass + ' pass, ' + fail + ' fail');
process.exit(fail ? 1 : 0);
