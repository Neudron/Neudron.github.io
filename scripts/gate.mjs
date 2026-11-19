#!/usr/bin/env node
/* gate.mjs — one command for the whole local gate.
   Suites read source, not dist, so they overlap check / check-world /
   build→verify instead of waiting on them. First non-zero gate kills the
   rest; one summary block at the end. run-all.mjs stays authoritative for
   suite pass/fail; this file is only the parallel wrapper. */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NODE = process.execPath;
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = new Set();
const killedByUs = new WeakSet();
let aborted = false;

function runStep(cmd, args, env) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const child = spawn(cmd, args, {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.add(child);
    let out = '';
    const eat = d => {
      out += d;
      for (const line of String(d).split(/\r?\n/)) if (line) console.log('  ' + line);
    };
    child.stdout.on('data', eat);
    child.stderr.on('data', eat);
    let settled = false;
    const done = code => {
      if (settled) return;
      settled = true;
      children.delete(child);
      const secs = (Date.now() - t0) / 1000;
      if (code !== 0 && !aborted) {
        aborted = true;
        for (const c of children) { killedByUs.add(c); c.kill('SIGKILL'); }
        children.clear();
      }
      resolve({ code, secs, out, killed: killedByUs.has(child) });
    };
    child.on('error', e => {
      out += '\nspawn error: ' + e.message + '\n';
      console.log('  spawn error: ' + e.message);
      done(1);
    });
    child.on('close', done);
  });
}

/* verify reads dist, so it must follow build; both run beside the suites. */
async function buildAndVerify() {
  const a = await runStep(NPM, ['run', 'build']);
  const b = a.code === 0
    ? await runStep(NPM, ['run', 'verify'])
    : { code: a.code, secs: 0, out: '', skipped: true };
  return { code: b.code, secs: a.secs + b.secs, out: a.out + b.out, killed: a.killed || b.killed };
}

const t0 = Date.now();
const jobs = {
  check: runStep(NODE, [path.join(ROOT, 'scripts', 'check.mjs')]),
  'check-world': runStep(NODE, [path.join(ROOT, 'scripts', 'check-world.mjs')]),
  'build+verify': buildAndVerify(),
  suites: runStep(NODE, [path.join(ROOT, 'tests', 'run-all.mjs')], { NEU_SKIP_CHECK: '1' }),
};
const names = Object.keys(jobs);
const results = {};
await Promise.all(names.map(async n => { results[n] = await jobs[n]; }));

const wall = (Date.now() - t0) / 1000;
let bad = 0;
console.log('\n' + '═'.repeat(52));
for (const n of names) {
  const r = results[n];
  const ok = r.code === 0 && !r.killed;
  if (!ok) bad++;
  const tag = r.skipped ? 'SKIP' : r.killed ? 'KILLED' : ok ? 'PASS' : 'FAIL';
  console.log('  ' + n.padEnd(14) + tag.padEnd(7) + r.secs.toFixed(1) + 's');
}
console.log('═'.repeat(52));
console.log(`GATE ${bad === 0 ? 'PASS' : 'FAIL'} — ${names.length - bad}/${names.length} gates ok, ${wall.toFixed(1)}s wall`);
process.exit(bad === 0 ? 0 : 1);
