/* run-all.mjs — run every suite with a hard per-suite timeout.
   ────────────────────────────────────────────────────────────────
   fixes5 and fixes18 legitimately take ~30s (they boot most of the
   game into jsdom), so a bare `node suite.mjs | grep` pipeline kept
   getting killed by 15s shell timeouts and the failures looked like
   hangs. This runner gives every suite 60 seconds, kills anything
   that actually wedges (boot-check once did), prints a timing table,
   and exits non-zero if any suite fails or times out.
     node tests/run-all.mjs          everything
     node tests/run-all.mjs fixes9   one suite by name
   ──────────────────────────────────────────────────────────────── */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TIMEOUT_MS = 60_000;
const SUITE_MS = /(\d+)\s*(?:passed|\/\d+|ok)|(\d+)\s*fail/i;

let files = fs.readdirSync(HERE)
  .filter(f => /^fixes\d+\.mjs$|^playthrough\.mjs$/.test(f))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
if (process.argv[2]) files = files.filter(f => f.startsWith(process.argv[2]));

let failed = 0;
console.log('suite             time    result');
console.log('─'.repeat(46));
for (const f of files) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(HERE, f)], {
    timeout: TIMEOUT_MS,
    encoding: 'utf8',
    cwd: path.dirname(HERE),
  });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  if (r.error && r.error.killed) {
    console.log(`${f.padEnd(16)}  ${secs}s >${TIMEOUT_MS / 1000}s  TIMEOUT (killed)`);
    failed++;
    continue;
  }
  const out = (r.stdout || '') + (r.stderr || '');
  /* Suites print their own totals in five different shapes. Trust the
     suite's own summary: use the last line that contains a number. */
  let summary = null;
  for (const line of out.split(/\r?\n/)) {
    const t = line.trim();
    if (t && /\d/.test(t) && !/^ok\b/i.test(t) && !/^\s*─/.test(t)) summary = t;
  }
  const bad = [...out.matchAll(/(?:^|\s)(\d+)\s*(?:failed|fail\b)/ig)].reduce((m, x) => m + +x[1], 0);

  const ok = r.status === 0 && bad === 0;
  console.log(`${f.padEnd(16)}  ${secs}s  ${ok ? 'PASS' : 'FAIL'}${summary ? '  ' + summary : ''}`);
  if (!ok) {
    failed++;
    for (const line of out.split(/\r?\n/)) if (/FAIL|not ok|Error/i.test(line)) console.log('    ' + line.trim());
  }
}
console.log('─'.repeat(46));
console.log(failed === 0 ? `ALL ${files.length} SUITES PASS` : `${failed}/${files.length} SUITES FAILED`);
process.exit(failed === 0 ? 0 : 1);
