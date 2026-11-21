// The one map registry: scripts/cel/maps.json (paths relative to CELESTE_STUDY, default ~/celeste-study).
import { readFileSync } from 'node:fs';
export const STUDY = process.env.CELESTE_STUDY || process.env.HOME + '/celeste-study';
export function mapInfo(id) {
  const all = JSON.parse(readFileSync(new URL('./maps.json', import.meta.url), 'utf8')), m = all[id];
  if (!m) throw new Error('map "' + id + '" is not in scripts/cel/maps.json (known: ' + Object.keys(all).join(', ') + ')');
  const abs = p => p ? STUDY + '/' + p : null;
  return { id, bin: abs(m.bin), zip: abs(m.zip), tas: abs(m.tas), offset: m.offset };
}
