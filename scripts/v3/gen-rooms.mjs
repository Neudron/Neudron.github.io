#!/usr/bin/env node
/* gen-rooms.mjs — W3 tooling. Expand the committed wex/recipe.json into
   deterministic ES5 IIFE room registrations under scripts/v3/out/wex/.

   Importable: readRecipe / buildDistricts / validate / renderDistrict /
   renderManifest / diffText. CLI: full write, or --dry-run 5-room slice diff.
   No shipped js/ is read or written here. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const OUT = path.join(HERE, 'out', 'wex');
export const RECIPE = path.join(OUT, 'recipe.json');

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const OPP = { east: 'west', west: 'east', north: 'south', south: 'north' };
/* Exit sits in the outer wall; the landing is one tile inside the wall the
   traveller actually comes through, facing away from that threshold. */
const WALL = { east: { x: 14, y: 5 }, west: { x: 0, y: 5 }, north: { x: 7, y: 0 }, south: { x: 7, y: 10 } };
const ENTER = {
  west: { x: 1, y: 5, face: 'right' }, east: { x: 13, y: 5, face: 'left' },
  north: { x: 7, y: 1, face: 'down' }, south: { x: 7, y: 9, face: 'up' }
};
const TOTAL = 25, SLICE = 5;

export function readRecipe(file) {
  return JSON.parse(fs.readFileSync(file || RECIPE, 'utf8'));
}

/* mulberry32: own generator, pinned first outputs in fixes915. No Date/Math.random. */
export function rng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Topology is variance BEFORE dressing: additive carving on a shared cross,
   so every layout stays connected no matter which pattern is chosen. */
function carve(topology) {
  const W = 15, H = 11;
  const g = [];
  for (let y = 0; y < H; y++) g.push(Array(W).fill('#'));
  const put = (x, y, ch) => { if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = ch; };
  for (let x = 1; x < W - 1; x++) put(x, 5, ',');
  for (let y = 1; y < H - 1; y++) put(7, y, ',');
  const dot = (x, y) => put(x, y, '.');
  if (topology === 'loop' || topology === 'switchback') {
    for (let y = 2; y <= 8; y++) { dot(4, y); dot(10, y); }
    for (let x = 4; x <= 10; x++) { dot(x, 2); dot(x, 8); }
    if (topology === 'switchback') { for (let y = 1; y <= 9; y++) { dot(4, y); dot(10, y); } }
  } else if (topology === 'split') {
    for (let x = 1; x <= 13; x++) { dot(x, 3); dot(x, 7); }
  } else if (topology === 'courtyard') {
    for (let y = 3; y <= 7; y++) for (let x = 4; x <= 10; x++) dot(x, y);
  } else if (topology === 'overlook') {
    for (let x = 1; x <= 13; x++) dot(x, 2);
    for (let y = 2; y <= 9; y++) dot(11, y);
  }
  return g.map(row => row.join(''));
}

function walkable(tiles, x, y) {
  const row = tiles[y];
  return !!row && x >= 0 && x < row.length && row[x] !== '#';
}

export function buildDistricts(recipe) {
  const seen = new Set();
  return recipe.districts.map(d => {
    const rooms = [];
    for (let i = 0; i < TOTAL; i++) {
      const col = i % recipe.grid.cols, row = Math.floor(i / recipe.grid.cols);
      const landmark = (i + 1) % SLICE === 0;
      const li = landmark ? Math.floor(i / SLICE) : -1;
      const id = landmark ? d.landmarks[li].id : d.prefix + '_' + String(i + 1).padStart(2, '0');
      if (seen.has(id)) throw new Error('duplicate room id in recipe: ' + id);
      seen.add(id);
      /* Offsets by (col,row) keep every 4-neighbour pair distinct; landmarks
         use the col=4 column of the same formulas, so their neighbours differ
         too. validate() re-checks this rather than trusting the arithmetic. */
      const silhouette = landmark ? d.landmarkSilhouettes[li] : d.silhouettes[(col + row) % 5];
      const beat = landmark ? recipe.beats[(4 + 2 * row) % 5] : recipe.beats[(col + 2 * row) % 5];
      const topology = landmark ? recipe.topologies[(4 + row) % 5] : recipe.topologies[(2 * col + row) % 5];
      const mask = landmark ? recipe.masks[(4 + 3 * row) % 5] : recipe.masks[(col + 3 * row) % 5];
      rooms.push({
        id: id, index: i, col: col, row: row, landmark: landmark,
        silhouette: silhouette, beat: beat, topology: topology, mask: mask, focal: landmark ? d.landmarks[li].focal : '',
        tiles: carve(topology),
        spawns: { default: { x: 7, y: 5, face: 'right' } }, exits: []
      });
    }
    const edges = [];
    for (let r = 0; r < recipe.grid.rows; r++)
      for (let c = 0; c < recipe.grid.cols - 1; c++) edges.push({ a: r * 5 + c, b: r * 5 + c + 1, dir: 'east' });
    for (let c = 0; c < recipe.grid.cols; c++)
      for (let r = 0; r < recipe.grid.rows - 1; r++) edges.push({ a: r * 5 + c, b: (r + 1) * 5 + c, dir: 'south' });
    edges.forEach(e => {
      const A = rooms[e.a], B = rooms[e.b], back = OPP[e.dir];
      const aSpawn = 'from_' + A.id + '_' + e.dir, bSpawn = 'from_' + B.id + '_' + back;
      const edgeStyle = d.styles[(e.a + e.b) % d.styles.length];
      A.exits.push({ x: WALL[e.dir].x, y: WALL[e.dir].y, to: B.id, spawn: aSpawn, style: edgeStyle });
      B.spawns[aSpawn] = Object.assign({}, ENTER[back]);
      B.exits.push({ x: WALL[back].x, y: WALL[back].y, to: A.id, spawn: bSpawn, style: edgeStyle });
      A.spawns[bSpawn] = Object.assign({}, ENTER[e.dir]);
      e.aSpawn = aSpawn; e.bSpawn = bSpawn;
    });
    return { key: d.key, tileset: d.tileset, colours: d.colours, rooms: rooms, edges: edges };
  });
}

function flood(tiles, sx, sy) {
  const seen = new Set([sx + ',' + sy]), q = [[sx, sy]];
  while (q.length) {
    const p = q.pop();
    for (const n of N4) {
      const x = p[0] + n[0], y = p[1] + n[1], k = x + ',' + y;
      if (seen.has(k) || !walkable(tiles, x, y)) continue;
      seen.add(k); q.push([x, y]);
    }
  }
  return seen;
}

/* Throws on the first broken invariant. Callers that want a boolean wrap it. */
export function validate(districts, baselineIds) {
  const base = new Set(baselineIds || []);
  const ids = [];
  districts.forEach(d => {
    if (d.rooms.length !== TOTAL) throw new Error(d.key + ': expected 25 rooms, got ' + d.rooms.length);
    const landmarks = d.rooms.filter(r => r.landmark);
    if (landmarks.length !== 5 || d.rooms.some((r, i) => r.landmark !== ((i + 1) % 5 === 0)))
      throw new Error(d.key + ': landmarks must be every fifth room');
    d.rooms.forEach(r => {
      ids.push(r.id);
      if (base.has(r.id)) throw new Error('room id collides with baseline: ' + r.id);
      if (!/^wex_[a-z0-9_]+$/.test(r.id)) throw new Error('unstable room id: ' + r.id);
      if (r.tiles.length !== 11 || r.tiles.some(t => t.length !== 15)) throw new Error(r.id + ': bad footprint');
      if (r.exits.length < 2) throw new Error(r.id + ': fewer than two reciprocal exits');
      Object.keys(r.spawns).forEach(name => {
        const s = r.spawns[name];
        if (!walkable(r.tiles, s.x, s.y)) throw new Error(r.id + ':' + name + ' spawns on a wall');
        if (name !== 'default' && !/^from_wex_[a-z0-9_]+_(east|west|north|south)$/.test(name))
          throw new Error(r.id + ': bad reciprocal spawn name ' + name);
        const area = flood(r.tiles, s.x, s.y);
        r.exits.forEach(e => {
          const near = area.has(e.x + ',' + e.y) || N4.some(n => area.has((e.x + n[0]) + ',' + (e.y + n[1])));
          if (!near) throw new Error(r.id + ':' + name + ' cannot reach exit to ' + e.to);
        });
      });
    });
    /* adjacency: silhouette and traversal beat never repeat across a wall */
    d.rooms.forEach(r => {
      for (const n of N4) {
        const nr = d.rooms.find(x => x.col === r.col + n[0] && x.row === r.row + n[1]);
        if (!nr) continue;
        if (nr.silhouette === r.silhouette) throw new Error(r.id + '/' + nr.id + ': repeated silhouette');
        if (nr.beat === r.beat) throw new Error(r.id + '/' + nr.id + ': repeated traversal beat');
      }
    });
    /* one socket pair = two exits + two reciprocal landings */
    d.edges.forEach(e => {
      const A = d.rooms[e.a], B = d.rooms[e.b], back = OPP[e.dir];
      const out = A.exits.find(x => x.to === B.id && x.spawn === e.aSpawn);
      const ret = B.exits.find(x => x.to === A.id && x.spawn === e.bSpawn);
      if (!out || !ret) throw new Error(A.id + '<->' + B.id + ': missing reciprocal exit');
      const landInB = B.spawns[e.aSpawn], landInA = A.spawns[e.bSpawn];
      if (!landInB || landInB.x !== ENTER[back].x || landInB.y !== ENTER[back].y || landInB.face !== ENTER[back].face)
        throw new Error(B.id + ': bad landing for ' + e.aSpawn);
      if (!landInA || landInA.x !== ENTER[e.dir].x || landInA.y !== ENTER[e.dir].y || landInA.face !== ENTER[e.dir].face)
        throw new Error(A.id + ': bad landing for ' + e.bSpawn);
    });
    /* BFS from the district entry reaches every room and can return */
    const seen = new Set([d.rooms[0].id]), q = [0];
    while (q.length) {
      const i = q.pop();
      d.edges.forEach(e => {
        if (e.a === i && !seen.has(d.rooms[e.b].id)) { seen.add(d.rooms[e.b].id); q.push(e.b); }
        if (e.b === i && !seen.has(d.rooms[e.a].id)) { seen.add(d.rooms[e.a].id); q.push(e.a); }
      });
    }
    if (seen.size !== TOTAL) throw new Error(d.key + ': only ' + seen.size + '/25 rooms reachable from entry');
  });
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (dup.length) throw new Error('duplicate generated ids: ' + dup.join(','));
  if (ids.length !== 100) throw new Error('expected 100 generated rooms, got ' + ids.length);
  return true;
}

const q = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

function renderRoom(room, ts) {
  let s = '  E.register(' + q(room.id) + ', {\n';
  s += '    tileset: ' + q(ts) + ',\n';
  s += '    tiles: [\n' + room.tiles.map(t => '      ' + q(t)).join(',\n') + '\n    ].join(\'\\n\'),\n';
  s += '    spawns: {\n' + Object.keys(room.spawns).map(n => {
    const p = room.spawns[n];
    return '      ' + q(n) + ': { x: ' + p.x + ', y: ' + p.y + ', face: ' + q(p.face) + ' }';
  }).join(',\n') + '\n    },\n';
  const ents = room.exits.map(e => '      { t: \'exit\', x: ' + e.x + ', y: ' + e.y + ', to: ' + q(e.to) +
    ', spawn: ' + q(e.spawn) + ', style: ' + q(e.style) + ' }');
  ents.push('      { t: \'sign\', x: 3, y: 5, lines: [' + q('silhouette: ' + room.silhouette + ' / mask: ' + room.mask) + '] }');
  ents.push('      { t: \'sign\', x: 11, y: 5, lines: [' + q('beat: ' + room.beat + ' / topology: ' + room.topology) + '] }');
  ents.push('      { t: \'npc\', x: 7, y: 3, colour: \'#7E3E78\', look: \'wex\', lines: [' +
    q(room.landmark ? room.focal : 'a room made for walking through, not staying in.') + '] }');
  s += '    entities: [\n' + ents.join(',\n') + '\n    ]\n  });\n';
  return s;
}

export function renderDistrict(d, slice) {
  const rooms = slice == null ? d.rooms : d.rooms.slice(slice * SLICE, slice * SLICE + SLICE);
  const arr = 'act4RoomsWex' + cap(d.key) + (slice == null ? '' : 'Preview');
  let s = '/* ' + d.key + (slice == null ? '' : ' slice ' + slice) +
    ' — generated by scripts/v3/gen-rooms.mjs from wex/recipe.json. DO NOT EDIT.\n' +
    '   Tooling output only: W4 owners import this; no shipped js/ is touched. */\n';
  s += '(function () {\n  \'use strict\';\n';
  s += '  var NEU = window.NEU = window.NEU || {};\n  var E = NEU.engine;\n';
  s += '  if (!E || !E.register) return;\n\n';
  s += '  E.tileset(' + q(d.tileset) + ', { solid: \'#\', colours: { ' +
    Object.keys(d.colours).map(k => q(k) + ': ' + q(d.colours[k])).join(', ') + ' } });\n\n';
  s += '  NEU.act4RoomsWex = NEU.act4RoomsWex || [];\n\n';
  rooms.forEach(r => { s += renderRoom(r, d.tileset) + '\n'; });
  s += '  NEU.' + arr + ' = [' + rooms.map(r => q(r.id)).join(', ') + '];\n';
  s += '  NEU.act4RoomsWex = NEU.act4RoomsWex.concat(NEU.' + arr + ');\n';
  s += '})();\n';
  return s;
}

export function renderManifest(districts) {
  const m = {
    version: 1, total: 100, perDistrict: 25,
    districts: districts.map(d => ({
      key: d.key, tileset: d.tileset, count: d.rooms.length,
      edges: d.edges.length,
      rooms: d.rooms.map(r => ({
        id: r.id, index: r.index, landmark: r.landmark, col: r.col, row: r.row,
        topology: r.topology, silhouette: r.silhouette, beat: r.beat, mask: r.mask,
        spawns: Object.keys(r.spawns), exits: r.exits.map(e => ({ to: e.to, spawn: e.spawn }))
      }))
    }))
  };
  return JSON.stringify(m, null, 2) + '\n';
}

/* Tiny LCS line diff: enough for a human to review one 5-room slice. */
export function diffText(oldText, newText, labelOld, labelNew) {
  const A = oldText.split('\n'), B = newText.split('\n'), n = A.length, m = B.length;
  const dp = [];
  for (let i = 0; i <= n; i++) dp.push(new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  let out = '--- ' + labelOld + '\n+++ ' + labelNew + '\n';
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) { out += '  ' + A[i] + '\n'; i++; j++; }
    else if (j < m && (i === n || dp[i][j + 1] >= dp[i + 1][j])) { out += '+ ' + B[j] + '\n'; j++; }
    else { out += '- ' + A[i] + '\n'; i++; }
  }
  return out;
}

/* Pull just the five E.register blocks of one slice out of a district source,
   so a dry-run diff shows the rooms an owner must approve and nothing else. */
export function sliceBlocks(src, slice) {
  const blocks = src.match(/  E\.register\('[^']+', \{[\s\S]*?\n  \}\);\n/g) || [];
  return blocks.slice(slice * SLICE, slice * SLICE + SLICE).join('');
}

function main() {
  const args = process.argv.slice(2);
  const recipe = readRecipe();
  const districts = buildDistricts(recipe);
  const dry = args.indexOf('--dry-run') >= 0;
  const di = args.indexOf('--district'), key = di >= 0 ? args[di + 1] : null;
  const si = args.indexOf('--slice'), sliceArg = si >= 0 ? args[si + 1] : null;
  if (dry) {
    if (!key || sliceArg == null) throw new Error('--dry-run needs --district <key> --slice <0..4>');
    const slice = Number(sliceArg);
    const d = districts.find(x => x.key === key);
    if (!d || !Number.isInteger(slice) || slice < 0 || slice > 4)
      throw new Error('unknown district or slice: ' + key + ' ' + sliceArg);
    const file = path.join(OUT, key + '.js');
    const oldText = fs.existsSync(file) ? sliceBlocks(fs.readFileSync(file, 'utf8'), slice) : '';
    const newText = sliceBlocks(renderDistrict(d), slice);
    process.stdout.write(diffText(oldText, newText,
      (fs.existsSync(file) ? file + ' slice ' + slice : '(no district file yet)'),
      'generated ' + key + ' slice ' + slice));
    return;
  }
  validate(districts);
  fs.mkdirSync(OUT, { recursive: true });
  let rooms = 0;
  for (const d of districts) {
    fs.writeFileSync(path.join(OUT, d.key + '.js'), renderDistrict(d));
    rooms += d.rooms.length;
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), renderManifest(districts));
  console.log('gen-rooms: wrote ' + districts.length + ' district files, ' + rooms +
    ' ES5 room registrations, manifest.json to ' + path.relative(HERE, OUT));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
