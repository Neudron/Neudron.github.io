#!/usr/bin/env node
/* badges.mjs — refresh the README status line (ultraplan H7).
   Runs tests/run-all.mjs, counts suites and checks from its own summary
   lines, and rewrites the block between <!-- badges:start --> and
   <!-- badges:end --> in README.md. Plain text, not shields.io images:
   no third-party request, and it reads fine on GitHub and in a terminal.
   A second run with the same results produces no diff. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = spawnSync(process.execPath, [path.join(ROOT, 'tests/run-all.mjs')], { encoding: 'utf8', cwd: ROOT, timeout: 900000 });
const out = (r.stdout || '') + (r.stderr || '');
const rows = out.split('\n').filter(l => /^\S+\.mjs\s+\d/.test(l));
let checks = 0;
for (const l of rows) {
  const m = l.match(/ALL PASS \((\d+)\)|passed (\d+)\/\d+|(\d+) ok, 0 fail|(\d+) passed, 0 failed/);
  if (m) checks += +(m[1] || m[2] || m[3] || m[4]);
}
const green = /ALL \d+ SUITES PASS/.test(out);
const line = `**tests:** ${rows.length} suites · ${checks}+ checks · ${green ? 'all green' : 'RED'} · ES5 gate ${/no ES5 or duplicate hits/.test(out) ? 'clean' : 'FAILING'}`;
const P = path.join(ROOT, 'README.md');
let doc = fs.readFileSync(P, 'utf8');
const block = `<!-- badges:start -->\n${line}\n<!-- badges:end -->`;
const re = /<!-- badges:start -->[\s\S]*?<!-- badges:end -->/;
doc = re.test(doc) ? doc.replace(re, block) : doc.replace(/^(# .*\n)/, `$1\n${block}\n`);
fs.writeFileSync(P, doc);
console.log(line);
process.exit(green ? 0 : 1);
