// CelesteTAS file -> cel/<id>.tas.js for in-browser replay (local-only data). Needs "tas" and "offset" in maps.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { parseTas } from '../../tests/cel-tas.mjs';
import { mapInfo } from './maps.mjs';
const id = process.argv[2] || 'forest-path', m = mapInfo(id);
if (!m.tas || m.offset == null) { console.log(id, 'no tas/offset in maps.json: skipped tas export'); process.exit(0); }
const t = parseTas(readFileSync(m.tas, 'utf8')), first = t.marks.find(k => k.name.startsWith('lvl_')).at;
writeFileSync(new URL('../../cel/' + id + '.tas.js', import.meta.url), '(function () { var N = window.NEU = window.NEU || {}; N.celTas = N.celTas || {}; N.celTas[' + JSON.stringify(id) + '] = '
  + JSON.stringify({ start: first - m.offset, frames: t.frames }) + '; })();\n');
console.log(id, 'tas frames', t.frames.length, 'start', first - m.offset);
