import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { loadRooms } from '../tests/reach.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOM_FILES = ['rooms-a.js', 'rooms-d.js', 'rooms-e.js', 'rooms-g.js', 'rooms-p.js', 'rooms-s.js'];
const PLAT_FILES = ['mountain.js', 'dungeon.js'];
const MODE_EDGES = [
  { from: 'p1_tavern', to: 'm0', spawn: null, via: 'mode', mode: 'platform' },
  { from: 'm7', to: 'p1_tavern', spawn: null, via: 'mode', mode: 'platform' },
  { from: 'd2_alley', to: 'dgn', spawn: null, via: 'mode', mode: 'dungeon' },
  { from: 'dgn', to: 'd2_alley', spawn: null, via: 'mode', mode: 'dungeon' }
];
// Platform ascent and the tavern exits intentionally move forward or return to the woods.
const ONE_WAY = new Set([
  'p1_tavern>m0', 'm7>p1_tavern',
  'p1_tavern>a1_clearing',
  ...Array.from({ length: 7 }, (_, i) => `m${i}>m${i + 1}`),
  ...Array.from({ length: 3 }, (_, i) => `h${i}>h${i + 1}`),
  ...Array.from({ length: 3 }, (_, i) => `v${i}>v${i + 1}`)
]);
export function buildGraph(root = ROOT) {
  const { rooms, tilesets } = loadRooms(root, ROOM_FILES);
  const levels = {};
  const plat = { levels, painters: [], _kinds: {}, level(id, def) { return levels[id] = { id, ...def }; }, kind() {} };
  const fake = { NEU: { plat }, engine: null };
  for (const f of PLAT_FILES) new Function('window', fs.readFileSync(path.join(root, 'js/act4', f), 'utf8'))(fake);
  for (let i = 0; i <= 10; i++) if (levels[`d${i}`]) levels[`d${i}`] = levels.dgn;
  const aliases = Object.fromEntries(Object.entries(levels).filter(([id, level]) => /^d(?:[0-9]|10)$/.test(id) && level === levels.dgn).map(([id]) => [id, 'dgn']));
  const levelIds = Object.keys(levels).filter(id => !/^d(?:[0-9]|10)$/.test(id) && (levels[id]?.tiles || levels[id]?.rows));
  const roomIds = Object.keys(rooms);
  const edges = [];
  for (const from of roomIds) for (const e of rooms[from].entities || []) if (e.t === 'exit') {
    edges.push({ from, to: e.to, spawn: e.spawn || null, via: styleVia(e.style), lock: e.locked || null, kind: 'room' });
  }
  for (let i = 0; i < 7; i++) edges.push({ from: `m${i}`, to: `m${i + 1}`, spawn: null, via: 'mode', kind: 'platform' });
  for (const [prefix] of [['h'], ['v']]) for (let i = 0; i < 3; i++) edges.push({ from: `${prefix}${i}`, to: `${prefix}${i + 1}`, spawn: null, via: 'mode', kind: 'platform' });
  edges.push(...MODE_EDGES.map(e => ({ ...e, kind: 'mode' })));
  return { rooms, tilesets, levels, roomIds, levelIds, edges, aliases };
}

function styleVia(style) {
  if (/^(door|gate|curtain|alley)$/.test(style || '')) return 'door';
  if (style === 'stairs') return 'stairs';
  if (style === 'hatch') return 'fall';
  if (/^(path|tunnel|arch)$/.test(style || '')) return 'slide';
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
    const key = `${e.from}>${e.to}`;
    if (!(rooms[e.from] || levels[e.from])) problems.push(`missing-source:${key}`);
    if (!(rooms[e.to] || levels[e.to])) problems.push(`missing-target:${key}`);
    if (!['door', 'stairs', 'fall', 'slide', 'portal', 'mode'].includes(e.via) && !/^(portal|cine):/.test(e.via || '')) problems.push(`missing-or-invalid-via:${key}:${e.via || ''}`);
    const destination = rooms[e.to];
    if (destination && e.spawn && !(destination.spawns || {})[e.spawn]) problems.push(`missing-spawn:${key}:${e.spawn}`);
    if (levels[e.to] && e.spawn && e.spawn !== 'start' && e.spawn !== levels[e.to].spawnName) problems.push(`missing-plat-spawn:${key}:${e.spawn}`);
    if (e.lock && !hasSetter(e.lock, setters, rooms))
      problems.push(`lock-setter-unproven:${key}:${e.lock}`);
    if ((rooms[e.to] || levels[e.to]) && !edges.some(back => back.from === e.to && back.to === e.from) && !ONE_WAY.has(key))
      problems.push(`one-way-edge:${key}`);
  }
  for (const [oldId, newId] of Object.entries(graph.aliases)) if (!(rooms[newId] || levels[newId])) problems.push(`unresolved-alias:${oldId}:${newId}`);
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
function setterEvidence(sources) {
  const literal = new Set(), prefixes = new Set();
  let gives = false;
  for (const source of sources) {
    let ast;
    try { ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true }); }
    catch (_) { continue; }
    walk(ast, node => {
      if (node.type !== 'CallExpression') return;
      const callee = node.callee, name = callee.type === 'Identifier' ? callee.name :
        callee.type === 'MemberExpression' ? propertyName(callee.property) : null;
      if (name !== 'flag' && name !== 'setFlag') return;
      if (node.arguments.length < (name === 'setFlag' ? 1 : 2)) return;
      const key = node.arguments[0];
      if (key.type === 'Literal' && typeof key.value === 'string') literal.add(key.value);
      else if (key.type === 'BinaryExpression' && key.operator === '+' && key.left.type === 'Literal' && typeof key.left.value === 'string') prefixes.add(key.left.value);
      else if (key.type === 'MemberExpression' && key.object.type === 'Identifier' && key.object.name === 'e' && propertyName(key.property) === 'gives') gives = true;
    });
  }
  return { literal, prefixes, gives };
}
function hasSetter(lock, setters, rooms) {
  if (setters.literal.has(lock)) return true;
  if (['solved:', 'rank:'].some(prefix => lock.startsWith(prefix) && setters.prefixes.has(prefix))) return true;
  return setters.gives && Object.values(rooms).some(room => (room.entities || []).some(e => e.gives === lock));
}

export function criticalPath(graph, { start, goal, complete = false }) {
  if (!complete || !start || !goal) return { status: 'UNKNOWN', reached: [], flags: [], reason: 'missing complete start/goal/grant metadata' };
  const reached = new Set(), flags = new Set();
  if (!(graph.rooms[start] || graph.levels[start]) || !(graph.rooms[goal] || graph.levels[goal]))
    return { status: 'UNKNOWN', reached: [], flags: [], reason: 'start or goal is absent from graph' };
  reached.add(start);
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
  return { status: reached.has(goal) ? 'REACHABLE' : 'UNREACHABLE', reached: [...reached], flags: [...flags] };
}
function asList(value) { return value == null ? [] : Array.isArray(value) ? value : [value]; }

export function render(root = ROOT) {
  const graph = buildGraph(root), problems = validate(graph, root);
  const pathProof = criticalPath(graph, {});
  const out = path.join(root, 'scripts/v3/out/design');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'world-graph.json'), JSON.stringify({
    rooms: graph.roomIds.map(id => ({ id, tileset: graph.rooms[id].tileset, spawns: graph.rooms[id].spawns })),
    levels: graph.levelIds.map(id => ({ id, spawn: graph.levels[id].spawn })),
    edges: graph.edges, aliases: graph.aliases, problems, criticalPath: pathProof
  }, null, 2) + '\n');
  fs.writeFileSync(path.join(out, 'WORLD_GRAPH.md'), `# World graph\n\nRooms: ${graph.roomIds.length}; edges: ${graph.edges.length}.\n\n| From | To | Spawn | Via | Lock |\n|---|---|---|---|---|\n${graph.edges.map(e => `| ${e.from} | ${e.to} | ${e.spawn || ''} | ${e.via || 'MISSING'} | ${e.lock || ''} |`).join('\n')}\n\n## Validation findings\n\n${problems.length ? problems.map(p => `- ${p}`).join('\n') : '- None'}\n\nCritical-path flag grants are not encoded in room registration data; automatic story-path proof is unavailable from these sources.\n`);
  fs.appendFileSync(path.join(out, 'WORLD_GRAPH.md'), `\nCritical-path checker status: ${pathProof.status} (${pathProof.reason}).\n`);
  return { graph, problems };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { graph, problems } = render();
  console.log(`rooms=${graph.roomIds.length} edges=${graph.edges.length} findings=${problems.length}`);
}
