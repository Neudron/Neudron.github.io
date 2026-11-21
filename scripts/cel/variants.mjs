// A/B engine rules against the TAS. Wrap the rule under test in cel.js as  if (FL.myRule) {...} else {...}  then:
// node scripts/cel/variants.mjs <id> '[{}, {"myRule": true}]'   -> rooms synced per variant (higher = closer to the game)
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parseTas } from '../../tests/cel-tas.mjs';
import { mapInfo } from './maps.mjs';
const [id, json] = process.argv.slice(2), info = mapInfo(id), root = new URL('../../', import.meta.url);
const tas = parseTas(readFileSync(info.tas, 'utf8')), rooms = tas.marks.filter(m => m.name.startsWith('lvl_'));
for (const flags of JSON.parse(json || '[{}]')) {
  const ctx = { window: { NEU: { celFlags: flags } }, Math, Uint8Array, console, JSON }; vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('js/cel/' + id + '.js', root), 'utf8'), ctx); vm.runInContext(readFileSync(new URL('js/core/cel.js', root), 'utf8'), ctx);
  const cel = ctx.window.NEU.cel, ev = [], t0 = rooms[0].at - info.offset;
  cel.start(id, { log: (...a) => ev.push(a) });
  for (let i = t0; i < tas.frames.length; i++) { cel.step(tas.frames[i]); if (cel.level.deaths || cel.level.done) break; }
  const d = [];
  for (let k = 0; k + 1 < rooms.length; k++) { const ex = ev.find(e => e[0] === 'exit' && e[2] === rooms[k].name.slice(4)); const dd = ex ? ex[1] - 1 + t0 - (rooms[k + 1].at - 41) : null; d.push(dd); if (dd !== 0) break; }
  console.log(JSON.stringify(flags), 'synced', d.filter(x => x === 0).length, 'deltas', JSON.stringify(d), 'deaths', cel.level.deaths);
}
