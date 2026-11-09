// Preparation checks only: no real agents, commits, or gameplay changes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'neu-v3-check-'));
const fixture = path.join(tmp, '.claude/worktrees/v3-integration');
fs.mkdirSync(fixture, { recursive: true });
function run(command, args) {
  const r = spawnSync(command, args, { cwd: fixture, encoding: 'utf8', timeout: 10000 });
  assert.equal(r.status, 0, r.stderr || r.stdout || String(r.error));
  return r.stdout.trim();
}
try {
  run('git', ['init', '-q']);
  run('git', ['config', 'user.name', 'V3 fixture']);
  run('git', ['config', 'user.email', 'fixture@example.invalid']);
  for (const dir of ['js', 'css', 'img', 'audio', 'scripts/v3', 'tests/node_modules']) {
    fs.mkdirSync(path.join(fixture, dir), { recursive: true });
  }
  fs.copyFileSync('scripts/v3/wo.sh', path.join(fixture, 'scripts/v3/wo.sh'));
  fs.writeFileSync(path.join(fixture, 'js/kept.js'), 'original\n');
  run('git', ['add', 'scripts/v3/wo.sh', 'js/kept.js']);
  run('git', ['-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'fixture']);
  fs.writeFileSync(path.join(fixture, 'tests/kept.mjs'), 'original test\n');
  fs.writeFileSync(path.join(fixture, 'tests/node_modules/kept'), 'dependency\n');
  run('sh', ['scripts/v3/wo.sh', 'begin', 'CHECK']);
  const out = path.join(fixture, 'scripts/v3/out');
  assert.ok(fs.existsSync(path.join(out, 'snap/CHECK-tests.tar')), 'checkpoint must use scripts/v3/out');
  assert.equal(run('git', ['check-ignore', 'scripts/v3/out/snap/CHECK-tests.tar']), 'scripts/v3/out/snap/CHECK-tests.tar');
  fs.writeFileSync(path.join(out, 'PLAN.md'), 'preserve output\n');
  fs.writeFileSync(path.join(fixture, 'js/kept.js'), 'changed\n');
  fs.writeFileSync(path.join(fixture, 'scripts/probe.mjs'), 'new script\n');
  fs.writeFileSync(path.join(fixture, 'tests/kept.mjs'), 'changed test\n');
  fs.writeFileSync(path.join(fixture, 'tests/probe.mjs'), 'new test\n');
  run('sh', ['scripts/v3/wo.sh', 'rollback', 'CHECK']);
  assert.equal(fs.readFileSync(path.join(fixture, 'js/kept.js'), 'utf8'), 'original\n');
  assert.equal(fs.readFileSync(path.join(fixture, 'tests/kept.mjs'), 'utf8'), 'original test\n');
  assert.ok(!fs.existsSync(path.join(fixture, 'scripts/probe.mjs')), 'rollback must remove new scripts');
  assert.ok(!fs.existsSync(path.join(fixture, 'tests/probe.mjs')));
  assert.equal(fs.readFileSync(path.join(out, 'PLAN.md'), 'utf8'), 'preserve output\n');
  assert.equal(fs.readFileSync(path.join(fixture, 'tests/node_modules/kept'), 'utf8'), 'dependency\n');
  console.log('PASS isolated checkpoint and rollback');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const workflow = new AsyncFunction('args', 'agent', 'parallel', 'phase', 'log',
  fs.readFileSync('scripts/v3/workflow.js', 'utf8').replace(/^export const meta/, 'const meta'));
async function dry(args, failedPhase) {
  const calls = [];
  const result = await workflow(args, async (prompt, opts) => {
    calls.push(opts.label);
    if (opts.phase === failedPhase) return null;
    const spec = /The spec is ([^,\n]+)/.exec(prompt);
    if (spec) assert.ok(fs.existsSync(path.join(root, spec[1])), 'missing plan: ' + spec[1]);
    assert.ok(!prompt.includes('.v3/'), 'prompt references obsolete output directory');
    if (opts.phase === 'Review') return { verdict: 'SHIP', failing: [] };
    if (opts.phase === 'Integrate') return { green: true, committed: false, commit: '', notes: '' };
    if (opts.phase === 'Docs') return { written: [], unknowns: [] };
    return { done: true, notes: '', files: [], suite: 'dry-run', shots: [] };
  }, tasks => Promise.all(tasks.map(f => f())), () => {}, () => {});
  return { result, calls };
}
for (const [batch, count] of [['B0', 1], ['B1', 14], ['B2', 1], ['B3', 1], ['B4', 1]]) {
  const { result } = await dry({ batch });
  assert.equal(result.length, count, batch + ' work-order count');
}
for (const batch of ['B5', 'B13', 'invalid']) {
  const { result, calls } = await dry({ batch });
  assert.ok(result.error);
  assert.equal(calls.length, 0, 'blocked batches must not launch agents');
}
const selected = await dry({ batch: 'B2', only: ['B2-01'] });
assert.equal(selected.result.length, 1);
assert.equal(selected.result[0].id, 'B2-01');
assert.equal(selected.result[0].status, 'READY_TO_COMMIT', 'workers must leave commits to the primary orchestrator');
assert.equal((await dry({ batch: 'B0' })).result.length, 1, 'stop before another builder until the primary commits');
for (const failedPhase of ['Build', 'Integrate']) {
  const failed = await dry({ batch: 'B0' }, failedPhase);
  assert.equal(failed.result.length, 1, 'failed work order must stop the batch');
  assert.equal(failed.result[0].status, 'BLOCKED');
  assert.equal(failed.calls.filter(label => label.startsWith('build:')).length, 1);
}
console.log('PASS workflow dry-run; no agents launched');
