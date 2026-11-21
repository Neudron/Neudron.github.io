// One command per map: convert, export the TAS, check TAS sync. node scripts/cel/port.mjs <id>
// Exit 0 = every room exits on its TAS frame (or the map has no TAS). Exit 1 = something to fix; the output says what.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mapInfo } from './maps.mjs';
import { run, parseTas } from '../../tests/cel-tas.mjs';
const id = process.argv[2]; if (!id) { console.log('usage: node scripts/cel/port.mjs <id>   (id = a key in scripts/cel/maps.json)'); process.exit(2); }
const info = mapInfo(id), root = new URL('../../', import.meta.url).pathname;
console.log('== 1/3 convert');
try { console.log(execFileSync('node', ['scripts/cel/convert.mjs', id], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()); }
catch (e) { console.log(String(e.stdout || '') + String(e.stderr || '')); console.log('STOP: unknown entities. Add each one (references/add-entity.md), then rerun.'); process.exit(1); }
if (!info.tas) { console.log('no TAS for this map: physics unverified. Next: screenshots.'); process.exit(0); }
let off = info.offset;
if (off == null) {
  console.log('== 2/3 find TAS start offset (sweep 0..140)');
  let best = null;
  for (let o = 0; o <= 140; o++) { const r = run(id, o), ok = r.rows.findIndex(x => x.delta !== 0); const n = ok < 0 ? r.rows.length : ok; if (!best || n > best.n) best = { o, n }; }
  console.log('best offset', best.o, '(first', best.n, 'rooms synced). Write  "offset": ' + best.o + '  for "' + id + '" in scripts/cel/maps.json, then rerun.');
  process.exit(1);
}
console.log('== 2/3 tas export'); console.log(execFileSync('node', ['scripts/cel/tas-export.mjs', id], { cwd: root, encoding: 'utf8' }).trim());
console.log('== 3/3 TAS sync (offset ' + off + ')');
const r = run(id, off);
console.table(r.rows);
const bad = r.rows.find(x => x.delta !== 0 && x.want != null), last = r.rows[r.rows.length - 1];
if (!bad && (r.done || last.want == null)) { console.log('PASS: every room exits on its TAS frame' + (r.done ? ', heart collected' : '') + '. deaths ' + r.deaths); process.exit(0); }
console.log('FAIL: first divergent room', bad ? bad.room + ' (delta ' + bad.delta + ')' : last.room, '. deaths', r.deaths);
for (const e of r.events.filter(e => e[0] === 'death').slice(0, 3)) console.log('  death', e.join(' '));
console.log('Next: references/bisect.md');
process.exit(1);
