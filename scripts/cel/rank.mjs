// Rank SJ Beginner maps that have a TAS by entities the cel kernel does not know yet.
import { readMap, rooms, kids } from './bin.mjs';
import { readFileSync, readdirSync } from 'node:fs';
const S = process.env.CELESTE_STUDY || process.env.HOME + '/celeste-study';
import { ent } from './convert.mjs';
const handled = n => n === 'player' || (() => { const o = ent({ __name: n, x: 0, y: 0, __children: [] }, 0, 0); return !o || o.t !== '?'; })();   // same table the converter uses
const dir = S + '/tas/StrawberryJamTAS/1_Beginner', out = [];
for (const f of readdirSync(dir).filter(f => f.endsWith('.tas'))) {
  const t = readFileSync(dir + '/' + f, 'utf8'), m = /console load (\S+)/.exec(t);
  if (!m) continue;
  const bin = S + '/mods/strawberry-jam/Maps/' + m[1] + '.bin';
  let map; try { map = readMap(bin); } catch (e) { out.push({ f, err: e.message }); continue; }
  const unk = {}; let n = 0, rs = rooms(map);
  for (const r of rs) for (const e of kids(r, 'entities')) if (!handled(e.__name)) { unk[e.__name] = (unk[e.__name] || 0) + 1; n++; }
  const trig = {}; for (const r of rs) for (const e of kids(r, 'triggers')) trig[e.__name] = (trig[e.__name] || 0) + 1;
  out.push({ f, bin: m[1], rooms: rs.length, unknown: n, kinds: Object.keys(unk).length, unk, trig, frames: (t.match(/^\s*(\d+)/gm) || []).reduce((a, x) => a + +x, 0) });
}
out.sort((a, b) => (a.kinds - b.kinds) || (a.unknown - b.unknown));
for (const o of out) console.log(o.err ? o.f + ' ERR ' + o.err : [o.f, o.bin.split('/').pop(), 'rooms', o.rooms, 'frames', o.frames, 'unk', o.unknown, o.kinds, JSON.stringify(o.unk), 'T', JSON.stringify(o.trig)].join(' '));
