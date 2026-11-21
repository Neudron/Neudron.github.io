import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/* tests/ is local-only. In the public checkout reach.mjs is absent, so a
   static import would throw ERR_MODULE_NOT_FOUND before any useful output. */
if (!fs.existsSync(path.join(ROOT, 'tests', 'reach.mjs'))) {
  console.log('BLOCKED: local-only tests/reach.mjs absent');
  process.exit(2);
}
const { loadRooms } = await import('../tests/reach.mjs');
const ROOM_FILES = ['rooms-a.js', 'rooms-d.js', 'rooms-e.js', 'rooms-g.js', 'rooms-p.js', 'rooms-s.js',
  'gen-wex-woods.js', 'gen-wex-city.js', 'gen-wex-savanna.js', 'gen-wex-lab.js'];
const PLAT_FILES = ['mountain.js', 'dungeon.js'];
const MODE_EDGES = [
  { from: 'p1_tavern', to: 'm0', spawn: null, via: 'mode', mode: 'platform' },
  { from: 'm7', to: 'p1_tavern', spawn: null, via: 'mode', mode: 'platform' },
  { from: 'd_city', to: 'dgn', spawn: null, via: 'mode', mode: 'dungeon' },
  { from: 'dgn', to: 'd_city', spawn: null, via: 'mode', mode: 'dungeon' }
];
// One-way routes are intentional: d3_square is the park-gate entry to the city end (rooms-d.js:290-294); e1_hall routes there (rooms-d.js:407).
// The bed exit changes from woods to hall after home is reached (rooms-e.js:298-301); that redirect is the declared `alt` on the exit (rooms-e.js:334).
// The way down to the storm is the stairs in g_8, the rank T room, reached only through the g0_hall T door; the trapdoor explicitly drops shut behind you (rooms-g.js:251-255).
// The Exo arena is entered by the scripted fight sequence (rooms-s.js:776); its hatch exits to the foyer (rooms-s.js:871).
// Platform ascent and the tavern exits intentionally move forward or return to the woods.
const ONE_WAY = new Set([
  'p1_tavern>m0', 'm7>p1_tavern',
  'p1_tavern>a_woods',
  'e1_hall>d3_square', 'e6_room>a_woods', 'e6_room>e3_hall',
  'g_0>a_woods', 'x2_arena>x0_foyer',
  ...Array.from({ length: 7 }, (_, i) => `m${i}>m${i + 1}`),
  ...Array.from({ length: 3 }, (_, i) => `h${i}>h${i + 1}`),
  ...Array.from({ length: 3 }, (_, i) => `v${i}>v${i + 1}`)
]);
export function buildGraph(root = ROOT) {
  const { rooms, tilesets, aliases: roomAliases } = loadRooms(root, ROOM_FILES);
  const levels = {};
  const plat = { levels, painters: [], _kinds: {}, level(id, def) { return levels[id] = { id, ...def }; }, kind() {} };
  const fake = { NEU: { plat }, engine: null };
  for (const f of PLAT_FILES) new Function('window', fs.readFileSync(path.join(root, 'js/act4', f), 'utf8'))(fake);
  for (let i = 0; i <= 10; i++) if (levels[`d${i}`]) levels[`d${i}`] = levels.dgn;
  const aliases = Object.fromEntries(Object.entries(levels).filter(([id, level]) => /^d(?:[0-9]|10)$/.test(id) && level === levels.dgn).map(([id]) => [id, 'dgn']));
  for (const id of Object.keys(roomAliases)) aliases[id] = roomAliases[id].id;
  const levelIds = Object.keys(levels).filter(id => !/^d(?:[0-9]|10)$/.test(id) && (levels[id]?.tiles || levels[id]?.rows));
  const roomIds = Object.keys(rooms);
  const edges = [];
  for (const from of roomIds) for (const e of rooms[from].entities || []) if (e.t === 'exit') {
    const resolved = resolveRoomAlias(roomAliases, e.to, e.spawn || null);
    edges.push({ from, to: resolved.id, originalTo: e.to, spawn: resolved.spawn, originalSpawn: e.spawn || null,
      aliasError: resolved.error, via: styleVia(e.style), lock: e.locked || null, kind: 'room' });
    if (e.alt && e.alt.to) {
      const alt = resolveRoomAlias(roomAliases, e.alt.to, e.alt.spawn || null);
      edges.push({ from, to: alt.id, originalTo: e.alt.to, spawn: alt.spawn, originalSpawn: e.alt.spawn || null,
        aliasError: alt.error, via: styleVia(e.style), lock: e.locked || null, cond: e.alt.when || null, kind: 'room' });
    }
  }
  for (let i = 0; i < 7; i++) edges.push({ from: `m${i}`, to: `m${i + 1}`, spawn: null, via: 'mode', kind: 'platform' });
  for (const [prefix] of [['h'], ['v']]) for (let i = 0; i < 3; i++) edges.push({ from: `${prefix}${i}`, to: `${prefix}${i + 1}`, spawn: null, via: 'mode', kind: 'platform' });
  edges.push(...MODE_EDGES.map(e => ({ ...e, kind: 'mode' })));
  return { rooms, tilesets, levels, roomIds, levelIds, edges, aliases, roomAliases };
}

function resolveRoomAlias(aliases, id, spawn) {
  const seen = new Set();
  while (aliases[id]) {
    if (seen.has(id)) return { id, spawn, error: `alias-cycle:${id}` };
    seen.add(id);
    const alias = aliases[id];
    if (spawn != null && Object.keys(alias.spawns || {}).length) {
      if (!Object.prototype.hasOwnProperty.call(alias.spawns, spawn) || typeof alias.spawns[spawn] !== 'string')
        return { id: alias.id, spawn, error: `missing-alias-spawn:${id}:${spawn}` };
      spawn = alias.spawns[spawn];
    }
    id = alias.id;
  }
  return { id, spawn };
}

function styleVia(style) {
  if (/^(door|gate|curtain|alley)$/.test(style || '')) return 'door';
  if (/^(lift|stairs)$/.test(style || '')) return 'stairs';
  if (style === 'hatch') return 'fall';
  if (/^(path|tunnel|arch|ridge)$/.test(style || '')) return 'slide';
  if (/^(portal|rift|frame)$/.test(style || '')) return 'portal';
  return null;
}

export function validate(graph, root = ROOT) {
  const problems = [];
  const sourceFiles = graph.setterSource == null
    ? fs.readdirSync(path.join(root, 'js'), { recursive: true }).filter(f => String(f).endsWith('.js')).map(f => fs.readFileSync(path.join(root, 'js', f), 'utf8'))
    : (Array.isArray(graph.setterSource) ? graph.setterSource : [graph.setterSource]);
  const setters = setterEvidence(sourceFiles);
  const { rooms, tilesets, levels, edges } = graph;
  const roomAliases = graph.roomAliases || {};
  for (const id of Object.keys(rooms)) {
    const room = rooms[id], rows = room.tiles.split('\n').filter(Boolean), ts = tilesets[room.tileset];
    for (const [name, spawn] of Object.entries(room.spawns || {})) {
      const cell = rows[spawn.y]?.[spawn.x];
      if (cell === undefined || !ts || ts.solid.includes(cell)) problems.push(`solid-or-missing-spawn:${id}:${name}`);
    }
  }
  for (const id of graph.levelIds) {
    const l = levels[id];
    if (!l?.spawn) continue;
    const rows = Array.isArray(l.rows) ? l.rows : String(l.tiles || '').split('\n').filter(Boolean), cell = rows[l.spawn.y]?.[l.spawn.x];
    if (cell === undefined || '#x'.includes(cell) || (l.solid || '').includes(cell)) problems.push(`solid-or-missing-spawn:${id}:start`);
  }
  for (const e of edges) {
    const key = `${e.from}>${e.originalTo || e.to}`;
    if (e.originalTo && roomAliases[e.originalTo]) {
      const mapped = resolveRoomAlias(roomAliases, e.originalTo, e.originalSpawn || null);
      if (mapped.error) problems.push(`${mapped.error}:${key}`);
      else if (mapped.id !== e.to || mapped.spawn !== e.spawn) problems.push(`alias-edge-mismatch:${key}`);
    } else if (e.aliasError) problems.push(`${e.aliasError}:${key}`);
    if (!(rooms[e.from] || levels[e.from])) problems.push(`missing-source:${key}`);
    if (!(rooms[e.to] || levels[e.to])) problems.push(`missing-target:${key}`);
    if (!['door', 'stairs', 'fall', 'slide', 'portal', 'mode'].includes(e.via) && !/^(portal|cine):/.test(e.via || '')) problems.push(`missing-or-invalid-via:${key}:${e.via || ''}`);
    const destination = rooms[e.to];
    if (destination && e.spawn && !(destination.spawns || {})[e.spawn]) problems.push(`missing-spawn:${key}:${e.spawn}`);
    if (levels[e.to] && e.spawn && e.spawn !== 'start' && e.spawn !== levels[e.to].spawnName) problems.push(`missing-plat-spawn:${key}:${e.spawn}`);
    if (e.lock && !hasSetter(e.lock, setters, rooms))
      problems.push(`lock-setter-unproven:${key}:${e.lock}`);
    const canonicalKey = `${e.from}>${e.to}`;
    const allowedOneWay = [...ONE_WAY].some(allowed => {
      const [from, to] = allowed.split('>');
      return resolveRoomAlias(roomAliases, from, null).id + '>' + resolveRoomAlias(roomAliases, to, null).id === canonicalKey;
    });
    if ((rooms[e.to] || levels[e.to]) && !edges.some(back => back.from === e.to && back.to === e.from) && !allowedOneWay)
      problems.push(`one-way-edge:${key}`);
  }
  for (const id of Object.keys(rooms)) {
    const as = rooms[id].areas || [];
    for (let i = 0; i < as.length; i++) for (let j = i + 1; j < as.length; j++) {
      const a = as[i], b = as[j];
      if (a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1) problems.push(`area-overlap:${id}:${a.id}:${b.id}`);
    }
  }
  for (const [oldId, newId] of Object.entries(graph.aliases)) {
    const resolved = roomAliases[oldId] ? resolveRoomAlias(roomAliases, oldId, null) : { id: newId };
    if (!resolved.error && !(rooms[resolved.id] || levels[resolved.id])) problems.push(`unresolved-alias:${oldId}:${resolved.id}`);
  }
  for (const oldId of Object.keys(roomAliases)) {
    const resolved = resolveRoomAlias(roomAliases, oldId, null);
    if (resolved.error) problems.push(`${resolved.error}:${oldId}`);
    else if (!rooms[resolved.id]) problems.push(`unresolved-alias:${oldId}:${resolved.id}`);
  }
  return problems;
}

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const child of node) walk(child, visit); return; }
  if (typeof node.type === 'string') visit(node);
  for (const value of Object.values(node)) if (value && typeof value === 'object') walk(value, visit);
}
function propertyName(node) {
  return node && (node.type === 'Identifier' ? node.name : node.type === 'Literal' ? node.value : null);
}
function callName(callee) {
  return callee.type === 'Identifier' ? callee.name :
    callee.type === 'MemberExpression' ? propertyName(callee.property) : null;
}
function setterEvidence(sources) {
  const literal = new Set(), solved = new Set(), prefixes = new Set(), ranks = new Set();
  let gives = false;
  for (const source of sources) {
    let ast;
    try { ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true }); }
    catch (_) { continue; }
    walk(ast, node => {
      if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.id.name === 'RANKS' && node.init?.type === 'ArrayExpression') {
        for (const item of node.init.elements) if (item?.type === 'ArrayExpression' && item.elements[0]?.type === 'Literal' && typeof item.elements[0].value === 'string') ranks.add(item.elements[0].value);
      }
      if (node.type !== 'CallExpression') return;
      const name = callName(node.callee);
      if (name === 'markSolved' && node.arguments[0]?.type === 'Literal' && typeof node.arguments[0].value === 'string') solved.add(node.arguments[0].value);
      if (name !== 'flag' && name !== 'setFlag') return;
      if (node.arguments.length < (name === 'setFlag' ? 1 : 2)) return;
      const key = node.arguments[0];
      if (key.type === 'Literal' && typeof key.value === 'string') literal.add(key.value);
      else if (key.type === 'BinaryExpression' && key.operator === '+' && key.left.type === 'Literal' && typeof key.left.value === 'string') prefixes.add(key.left.value);
      else if (key.type === 'MemberExpression' && key.object.type === 'Identifier' && key.object.name === 'e' && propertyName(key.property) === 'gives') gives = true;
    });
  }
  return { literal, solved, prefixes, ranks, gives };
}
function hasSetter(lock, setters, rooms) {
  if (setters.literal.has(lock)) return true;
  if (lock.startsWith('rank:') && setters.prefixes.has('rank:') && setters.ranks.has(lock.slice(5))) return true;
  if (lock.startsWith('solved:')) {
    const id = lock.slice(7), room = rooms[id];
    if (setters.solved.has(id)) return true;
    if (!setters.prefixes.has('solved:')) return false;
    if (room && typeof room.onSolved === 'function') {
      try {
        const ast = parse(`(${room.onSolved.toString()})`, { ecmaVersion: 'latest', sourceType: 'script' });
        let match = false;
        walk(ast, node => {
          if (node.type === 'CallExpression' && callName(node.callee) === 'markSolved' &&
              node.arguments[0]?.type === 'Literal' && node.arguments[0].value === id) match = true;
        });
        if (match) return true;
      } catch (_) { /* unresolved callback stays unproven */ }
    }
  }
  return setters.gives && Object.values(rooms).some(room => (room.entities || []).some(e => e.gives === lock));
}

export function criticalPath(graph, { start, goal, complete = false, flags: knownFlags = [] }) {
  if (!complete || !start || !goal) return { status: 'UNKNOWN', reached: [], flags: [], reason: 'missing complete start/goal/grant metadata' };
  const starts = asList(start), goals = asList(goal), reached = new Set(), flags = new Set(asList(knownFlags));
  if (starts.some(id => !(graph.rooms[id] || graph.levels[id])) || goals.some(id => !(graph.rooms[id] || graph.levels[id])))
    return { status: 'UNKNOWN', reached: [], flags: [], reason: 'start or goal is absent from graph' };
  for (const id of starts) reached.add(id);
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of reached) for (const grant of asList((graph.rooms[id] || graph.levels[id]).grants))
      if (!flags.has(grant)) { flags.add(grant); changed = true; }
    for (const edge of graph.edges) {
      if (!reached.has(edge.from)) continue;
      const needs = asList(edge.needs).concat(asList(edge.lock));
      if (needs.every(flag => flags.has(flag)) && !reached.has(edge.to) && (graph.rooms[edge.to] || graph.levels[edge.to])) {
        reached.add(edge.to); changed = true;
      }
    }
  }
  return { status: goals.every(id => reached.has(id)) ? 'REACHABLE' : 'UNREACHABLE', reached: [...reached], flags: [...flags],
    reason: 'start/goal/grants derived from graph data' };
}
/* All three fields come from sources the tool already owns: entry rooms from
   act4.js (entries(), :234), gated targets from exit locks (buildGraph, :49),
   and obtainable flags from the setter evidence validate() uses (:90, :166).
   No hand-maintained room id or flag list. Locks with no proven setter remain
   reported by validate() and are excluded from the path's goal set. */
export function criticalPathMetadata(graph, root = ROOT, problems = null) {
  const findings = problems || validate(graph, root);
  const unproven = new Set(findings.filter(p => p.startsWith('lock-setter-unproven:'))
    .map(p => p.slice(p.lastIndexOf(':') + 1)));
  const start = entries(graph, root).filter(id => graph.rooms[id] || graph.levels[id]);
  const gated = graph.edges.filter(e => e.lock || e.needs);
  const flags = [...new Set(gated.flatMap(e => asList(e.lock).concat(asList(e.needs))))]
    .filter(f => !unproven.has(f));
  const goal = [...new Set(gated.filter(e => asList(e.lock).concat(asList(e.needs))
    .every(f => flags.includes(f))).map(e => e.to))];
  return { complete: !!(start.length && goal.length), start, goal, flags };
}
/* Real entry points: act4.js START/HOME plus every literal enter/warp/go('id') under js/. */
export function entries(graph, root = ROOT) {
  const out = new Set(), add = id => {
    const c = resolveRoomAlias(graph.roomAliases || {}, id, null).id;
    if (graph.roomIds.includes(c)) out.add(c);
  };
  const act4 = fs.readFileSync(path.join(root, 'js/act4/act4.js'), 'utf8');
  for (const m of act4.matchAll(/var (?:START|HOME) = '([^']+)'/g)) add(m[1]);
  for (const f of fs.readdirSync(path.join(root, 'js'), { recursive: true }).filter(f => String(f).endsWith('.js')))
    for (const m of fs.readFileSync(path.join(root, 'js', f), 'utf8').matchAll(/\b(?:enter|warp|go)\('([a-z0-9_]+)'/g)) add(m[1]);
  return [...out];
}
/* BFS over every edge, locks ignored; unreached covers rooms only. */
export function reachability(graph, starts) {
  const seen = new Set(starts), q = [...starts];
  while (q.length) {
    const id = q.pop();
    for (const e of graph.edges) if (e.from === id && !seen.has(e.to)) { seen.add(e.to); q.push(e.to); }
  }
  return { reached: [...seen], unreached: graph.roomIds.filter(id => !seen.has(id)) };
}
function asList(value) { return value == null ? [] : Array.isArray(value) ? value : [value]; }

/* Pure markdown for plans/neu-v3/WORLD_GRAPH.md. root is where entry points were read from. */
export function worldGraphMd(graph, problems, reach, root = ROOT) {
  const list = a => (a.length ? a.map(x => `- ${x}`) : ['- None']).join('\n');
  const sheet = graph.roomIds.map(id => {
    const r = graph.rooms[id], t = String(r.tiles).split('\n').filter(Boolean), es = r.entities || [], ex = es.filter(e => e.t === 'exit');
    return { id, tileset: r.tileset, w: Math.max(0, ...t.map(l => l.length)), h: t.length, spawns: Object.keys(r.spawns || {}).length,
      exits: ex.length, locks: ex.filter(e => e.locked).length, areas: (r.areas || []).length, ia: es.filter(e => e.lines || e.run).length };
  });
  return `# World graph

Rooms: ${graph.roomIds.length}; edges: ${graph.edges.length}. Entries: ${entries(graph, root).join(', ')}.

## Edges

| From | To | Spawn | Via | Lock |
|---|---|---|---|---|
${graph.edges.map(e => `| ${e.from} | ${e.to} | ${e.spawn || ''} | ${e.via || 'MISSING'} | ${e.lock || ''} |`).join('\n')}

## Dynamic exits

| From | To | Spawn | When |
|---|---|---|---|
${graph.edges.filter(e => e.cond).map(e => `| ${e.from} | ${e.to} | ${e.spawn || ''} | ${e.cond} |`).join('\n')}

## Unreached from entries

${list(reach.unreached)}

## Validation findings

${list(problems)}

## Design limits

- seamless scope: woods areas a1-a3 of a_woods only (R19: wider seams wait for owner GO)
- critical path: UNKNOWN (grants/goal are story content, not in room data)

## Room sheet

| id | tileset | w | h | spawns | exits | locks | areas | ia |
|---|---|---|---|---|---|---|---|---|
${sheet.map(r => `| ${r.id} | ${r.tileset} | ${r.w} | ${r.h} | ${r.spawns} | ${r.exits} | ${r.locks} | ${r.areas} | ${r.ia} |`).join('\n')}

## Savanna rooms with ia < 6

${list(sheet.filter(r => /^s(\d+)?_/.test(r.id) && r.ia < 6).map(r => `${r.id} (ia ${r.ia})`))}

## Not derivable from room data

Camera, sound, save and focal point/sightline stay with art direction (D-AB-12, D-LD-10 PARTIAL). ia = entities with lines or run.
`;
}

export function render(root = ROOT) {
  const graph = buildGraph(root), problems = validate(graph, root);
  const pathProof = criticalPath(graph, criticalPathMetadata(graph, root, problems));
  const out = path.join(root, 'scripts/v3/out/design');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'world-graph.json'), JSON.stringify({
    rooms: graph.roomIds.map(id => ({ id, tileset: graph.rooms[id].tileset, spawns: graph.rooms[id].spawns })),
    levels: graph.levelIds.map(id => ({ id, spawn: graph.levels[id].spawn })),
    edges: graph.edges, aliases: graph.aliases, problems, criticalPath: pathProof
  }, null, 2) + '\n');
  fs.writeFileSync(path.join(out, 'WORLD_GRAPH.md'), `# World graph\n\nRooms: ${graph.roomIds.length}; edges: ${graph.edges.length}.\n\n| From | To | Spawn | Via | Lock |\n|---|---|---|---|---|\n${graph.edges.map(e => `| ${e.from} | ${e.to} | ${e.spawn || ''} | ${e.via || 'MISSING'} | ${e.lock || ''} |`).join('\n')}\n\n## Validation findings\n\n${problems.length ? problems.map(p => `- ${p}`).join('\n') : '- None'}\n\nCritical-path start = entries(), goal = locked-exit targets, grants = setter evidence over js/ (validate's authority). Locks without a proven setter stay in Validation findings and are excluded from the goal set.\n`);
  fs.appendFileSync(path.join(out, 'WORLD_GRAPH.md'), `\nCritical-path checker status: ${pathProof.status} (${pathProof.reason || 'derived from graph data'}).\n`);
  const md = path.join(root, 'plans/neu-v3');
  fs.mkdirSync(md, { recursive: true });
  fs.writeFileSync(path.join(md, 'WORLD_GRAPH.md'), worldGraphMd(graph, problems, reachability(graph, entries(graph, root)), root));
  return { graph, problems };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { graph, problems } = render();
  console.log(`rooms=${graph.roomIds.length} edges=${graph.edges.length} findings=${problems.length}`);
}
