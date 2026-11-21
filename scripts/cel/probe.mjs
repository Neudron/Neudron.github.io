// Divergence finder. Replays the map's TAS to frame F (frames since sim start, the first column of --trace),
// snapshots, then tries every player override in RANGE and reports which ones make the room exit on the TAS frame.
// node scripts/cel/probe.mjs <id> <F> ['{"x":[a,b,step],"y":[a,b,step],"sx":[...],"sy":[...],"dashes":[...],"duck":[0,1,1]}'] [--trace]
import { readFileSync } from 'node:fs';
import { parseTas, load } from '../../tests/cel-tas.mjs';
import { mapInfo } from './maps.mjs';
const [id, Fs, rangeArg] = process.argv.slice(2), F = +Fs, info = mapInfo(id), TRACE = process.argv.includes('--trace');
if (info.offset == null) throw new Error('set "offset" for ' + id + ' in maps.json first (node tests/cel-tas.mjs ' + id + ' --sweep)');
const tas = parseTas(readFileSync(info.tas, 'utf8')), rooms = tas.marks.filter(m => m.name.startsWith('lvl_'));
const cel = load(id), ev = [], t0 = rooms[0].at - info.offset;
cel.start(id, { log: (...a) => ev.push(a) });
for (let i = t0; i < t0 + F; i++) cel.step(tas.frames[i]);
const snap = cel.snapshot(), ki = rooms.findIndex(r => r.name === 'lvl_' + cel.room.name), want = rooms[ki + 1] ? rooms[ki + 1].at - 41 : null;
function probe(over) {
  cel.restore(snap); for (const k in over) { if (k === 'duck') cel.setDuck(over[k]); else cel.player[k] = over[k]; }
  const n0 = ev.length;
  for (let i = t0 + F; i < t0 + F + 400 && i < tas.frames.length; i++) {
    cel.step(tas.frames[i]);
    if (TRACE) { const p = cel.player; console.log(i - t0, p.st, p.x, p.y, p.sx.toFixed(2), p.sy.toFixed(2), p.dashes, cel.level.freeze > 0 ? 'F' : '', JSON.stringify(tas.frames[i])); }
    if (ev.slice(n0).some(e => e[0] === 'exit' || e[0] === 'death')) break;
  }
  const out = ev.slice(n0); ev.length = n0;
  const ex = out.find(e => e[0] === 'exit');
  return ex ? ex[1] - 1 + t0 - want : out.some(e => e[0] === 'death') ? 'death' : null;
}
const p = snap.p;
console.log('frame', F, 'room', snap.room, 'state', JSON.stringify({ x: p.x, y: p.y, sx: p.sx, sy: p.sy, st: p.st, dashes: p.dashes, duck: p.hb === 'duck' }), 'exit delta as-is:', probe({}));
const R = JSON.parse(rangeArg && !rangeArg.startsWith('--') ? rangeArg : '{}'), keys = Object.keys(R), hits = [];
function rec(d, st) {
  if (d === keys.length) { if (probe(st) === 0) hits.push(JSON.stringify(st)); return; }
  const [a, b, s] = R[keys[d]]; for (let v = a; v <= b + 1e-9; v += s) rec(d + 1, { ...st, [keys[d]]: Math.fround(v) });
}
if (keys.length) { rec(0, {}); console.log('hits', hits.length, hits.slice(0, 20).join(' ')); }
