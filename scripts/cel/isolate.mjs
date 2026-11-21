// Isolated room check: for room R, search entry states on the edge shared with the previous TAS room
// and report the ones whose replay exits R on its TAS frame. Usage: node scripts/cel/isolate.mjs <id> <room> [shard/of]
// A hit is "isolated sync": not exact, because the entry state was searched, not reached.
import { readFileSync } from 'node:fs';
import { load, parseTas } from '../../tests/cel-tas.mjs';
import { mapInfo } from './maps.mjs';
const [id, roomName, shardArg] = process.argv.slice(2);
const [shard, of] = (shardArg || '0/1').split('/').map(Number);
const cel = load(id), M = cel.start(id, { intro: false }).map;
const { frames, marks } = parseTas(readFileSync(mapInfo(id).tas, 'utf8'));
const rm = marks.filter(m => m.name.startsWith('lvl_'));
const k = rm.findIndex(m => m.name.slice(4) === roomName);
if (k < 1) { console.log('STOP: room', roomName, k < 0 ? 'has no TAS marker' : 'is the first room (use port.mjs)'); process.exit(1); }
const R = M.rooms.find(r => r.name === roomName), P = M.rooms.find(r => r.name === rm[k - 1].name.slice(4));
const want = rm[k + 1] ? rm[k + 1].at - 41 : null;
// shared edge, entry side of R, pushed in like the transition (pad 4, 12 going down: player feet must be inside)
let side, cand = [];
if (P.x + P.w === R.x) side = 'L'; else if (R.x + R.w === P.x) side = 'R'; else if (P.y + P.h === R.y) side = 'T'; else if (R.y + R.h === P.y) side = 'B';
if (!side) { console.log('STOP: rooms', P.name, R.name, 'do not share an edge'); process.exit(1); }
const lo = (a, b) => Math.max(a, b), hi = (a, b) => Math.min(a, b);
if (side === 'L' || side === 'R') { const x = side === 'L' ? R.x + 4 : R.x + R.w - 4; for (let y = lo(P.y, R.y) + 11; y <= hi(P.y + P.h, R.y + R.h); y++) cand.push([x, y]); }
else { const y = side === 'T' ? R.y + 12 : R.y + R.h - 4; for (let x = lo(P.x, R.x) + 4; x <= hi(P.x + P.w, R.x + R.w) - 4; x++) cand.push([x, y]); }
const SX = [], SY = [];
const STEP = +(process.env.ISO_STEP || 30), PSTEP = +(process.env.ISO_PSTEP || 2);
if (process.env.ISO_SX) SX.push(...process.env.ISO_SX.split(',').map(Number)); else for (let v = -330; v <= 330; v += STEP) SX.push(v);
if (process.env.ISO_SY) SY.push(...process.env.ISO_SY.split(',').map(Number)); else for (let v = -330; v <= 240; v += STEP) SY.push(v);
cand = cand.filter((c, i) => i % PSTEP === 0);
const end = Math.min(frames.length, (want ?? rm[k].at + 600) + 90);
let n = 0, hits = [];
function tryOne(x, y, sx, sy) {
  n++; const ev = []; cel.start(id, { room: roomName, intro: false, spawn: [x, y], state: { sx, sy }, log: (...a) => ev.push(a) });
  for (let f = rm[k].at; f < end; f++) { cel.step(frames[f]); const e = ev.find(e => e[0] === 'exit'); if (e) return rm[k].at + e[1] - 1; if (cel.level.deaths) return -(f - rm[k].at); }
  return -(end - rm[k].at);
}
const score = at => at == null || want == null ? 1e9 : at < 0 ? 1e6 + at : Math.abs(at - want);   // no exit: rank by frames survived
let best = [];
function consider(c, at) { const s = score(at); if (s === 0) hits.push(c); best.push([s, c]); best.sort((a, b) => a[0] - b[0]); best = best.slice(0, 4); }
for (let i = 0; i < cand.length; i++) { if (i % of !== shard) continue;
  for (const sx of SX) for (const sy of SY) consider({ x: cand[i][0], y: cand[i][1], sx, sy }, tryOne(cand[i][0], cand[i][1], sx, sy)); }
// coarse-to-fine: refine around the closest exits (speed-sensitive rooms rarely hit on a coarse grid)
for (const [d, s] of [[25, 5], [4, 1]]) {
  if (hits.length) break;
  for (const [sc, c] of best.slice()) { if (sc >= 1e9) continue;
    for (let dy = -2; dy <= 2; dy++) for (let a = -d; a <= d; a += s) for (let b = -d; b <= d; b += s) {
      const q = { x: c.x, y: c.y + dy, sx: c.sx + a, sy: c.sy + b }; consider(q, tryOne(q.x, q.y, q.sx, q.sy)); } }
}
console.log('room', roomName, 'from', P.name, 'side', side, 'want', want, 'tried', n, 'hits', hits.length, 'best', best[0] ? best[0][0] : 'none');
for (const h of hits.slice(0, 8)) console.log(JSON.stringify(h));
