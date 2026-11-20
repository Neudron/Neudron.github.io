/* Fan paths actually referenced by NEU.sheets path literals in js/css/html.
   Shared by the build (what to copy) and verify-dist (what may ship).
   A `%03d` seq template matches every tracked frame with that prefix. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export function fanRefs(root) {
  const out = [];
  const list = execFileSync('git', ['ls-files', '-z', '--', 'js', 'css', 'index.html'],
    { cwd: root, encoding: 'utf8' });
  for (const f of list.split('\0')) {
    if (!f) continue;
    const text = fs.readFileSync(path.join(root, f), 'utf8');
    for (const m of text.matchAll(/['"]fan\/[^'"]+\.png['"]/g)) out.push(m[0].slice(1, -1));
  }
  return out;
}

export function isReferencedFan(rel, refs) {
  if (!rel.startsWith('img/act4/fan/')) return false;
  const short = rel.slice('img/act4/'.length);
  return refs.some((ref) => {
    const p = ref.indexOf('%03d');
    return p < 0 ? short === ref : short.slice(0, p) === ref.slice(0, p) && /\.png$/.test(short);
  });
}
