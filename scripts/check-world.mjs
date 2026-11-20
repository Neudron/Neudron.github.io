/* check-world.mjs — static gate for the nonvisual world-graph seam work.
   Checks module syntax/ES5, index.html wiring without reordering existing
   tags, hard graph problems, and that the module itself is a pure, disabled
   advisory API over the real room data. Run: node scripts/check-world.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { buildGraph, validate } from './worldgraph.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/* tests/ is local-only: fail with a clear, single line instead of a
   module-resolution stack when the checkout has no reach.mjs. */
if (!fs.existsSync(path.join(ROOT, 'tests', 'reach.mjs'))) {
  console.log('BLOCKED: local-only tests/reach.mjs absent');
  process.exit(2);
}
const { loadRooms } = await import('../tests/reach.mjs');
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
const HARD = /^(missing-target|missing-spawn|alias-|unresolved-alias|solid-or-missing-spawn|missing-source|missing-or-invalid-via|area-overlap)/;
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

    /* The seven named world-graph cases (WG.validate above built the index). */
    const open = { flagged() { return true; } }, shut = { flagged() { return false; } };
    const r1 = WG.resolveExit('d_city', { to: 'nowhere' }, open);
    check('case 1 missing target falls back', r1.ok === false && r1.fallback === true && r1.reason === 'missing-target', r1);
    const r2 = WG.resolveExit('d_city', { to: 'e3_hall', spawn: 'nope' }, open);
    check('case 2 missing spawn falls back', r2.reason === 'missing-spawn' && r2.fallback === true, r2);
    const gate = { to: 'e5_dad', spawn: 'door', locked: 'dad_door' };
    const g1 = WG.resolveExit('e3_hall', gate, shut), g2 = WG.resolveExit('e3_hall', gate, open);
    check('case 3 locked gate holds then opens', g1.reason === 'locked-gate' && g2.ok === true, [g1.reason, g2.reason]);
    const d1 = WG.resolveExit('e6_room', { to: 'e3_hall', spawn: 'dad' }, open);
    const d2 = WG.resolveExit('e6_room', { to: 'd_city', spawn: 'fire' }, open);
    check('case 4 story redirect is declared, other targets dynamic', d1.dynamic === false && d2.dynamic === true, [d1.dynamic, d2.dynamic]);
    const o1 = WG.resolveExit('e3_hall', gate, {});
    check('case 5 old save without flagged() does not throw and stays closed', o1.reason === 'locked-gate' && o1.fallback === true, o1);
    let frozen = null;
    try { frozen = WG.resolveExit('e3_hall', Object.freeze({ to: 'e5_dad', spawn: 'door', locked: 'dad_door' }), Object.freeze({ flagged() { return true; } })); } catch (e) { frozen = e.message; }
    check('case 6 inputs are not mutated', !!frozen && frozen.ok === true, frozen);
    const o7 = WG.resolveExit('e3_hall', gate, shut);
    check('case 7 no console bypass', !/NEU\.dev|console\.|\.go\(/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')) && WG.enabled === false && o7.fallback === true,
      { enabled: WG.enabled, fallback: o7.fallback });
    const gaps = [];
    for (const rid of ['a_woods', 'd_city']) {
      const as = graph.rooms[rid].areas.slice().sort((a, b) => a.x0 - b.x0);
      for (let i = 1; i < as.length; i++) if (as[i].x0 !== as[i - 1].x1 + 1) gaps.push(rid + ':' + as[i].id);
      for (const a of as) {
        const al = graph.roomAliases[a.id];
        if (!al || al.id !== rid) gaps.push('noalias:' + a.id);
        else for (const sp of Object.keys(al.spawns || {})) if (!(al.spawns[sp] in graph.rooms[rid].spawns)) gaps.push('spawn:' + a.id + ':' + sp);
      }
    }
    check('merged areas are contiguous and alias spawns resolve', gaps.length === 0, gaps);
  }
}

console.log('\ncheck-world: ' + pass + ' pass, ' + fail + ' fail');
process.exit(fail ? 1 : 0);
