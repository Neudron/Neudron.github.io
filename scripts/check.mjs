#!/usr/bin/env node
/*
 * check.mjs — Phase 0.5 ES5 syntax gate (strangler plan).
 *
 * Exact counterpart to tests/run-all.mjs's regex gate: parses js/ sources
 * with acorn ecmaVersion 5, so ANY non-ES5 syntax throws — not just the
 * tokens the regexes list (acorn sees real syntax, not comments or strings).
 * js/page/scene.js is excluded: it is the ES module holdout. In --check-skip
 * scratch mode the skip applies to every parse run (see probe below).
 *
 *   node scripts/check.mjs           # tracked files under js/ (CI has no tests/ dir)
 *   node scripts/check.mjs FILE JS   # explicit paths (tamper probes, scratch runs)
 *
 * npm run check. Wired into .github/workflows/deploy.yml between Install
 * and Build, so a bad commit fails before the artifact is built.
 *
 * Self-test on every invocation: the 6 rejection snippets below MUST throw
 * under ecmaVersion 5. If an acorn upgrade ever loosens ES5 mode, check
 * fails loudly instead of silently admitting syntax run-all's regexes miss.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['js/page/scene.js']);

const MUST_THROW = {
  'arrow function': 'go(() => {});',
  'let/const': 'let x = 1;',
  'class': 'class A {}',
  'template literal': 'var s = `t`;',
  'optional chain': 'var x = a?.b;',
  'call trailing comma': 'go(a, b,);',
};
const parseES5 = (src) => acorn.parse(src, { ecmaVersion: 5, sourceType: 'script' });

/* ── self-test: every snippet must throw under ecmaVersion 5 ─────────── */
const selfFail = [];
for (const [name, src] of Object.entries(MUST_THROW)) {
  try { parseES5(src); selfFail.push(`${name}: acorn accepted non-ES5 syntax`); } catch { /* ok */ }
}
try { parseES5('function f(a, b) { var c = a + b; return c; } f(1, 2);'); }
catch (e) { selfFail.push(`plain ES5 rejected by acorn: ${e.message}`); }
if (selfFail.length) {
  console.error('check: acorn ES5 self-test FAILED — results below are void');
  for (const l of selfFail) console.error('  ' + l);
  process.exit(2);
}

/* ── target list ─────────────────────────────────────────────────────── */
const args = process.argv.slice(2).filter(Boolean);
const rels = [];
if (args.length) {
  for (const raw of args) {
    const full = path.resolve(ROOT, raw);
    if (!fs.existsSync(full)) rels.push({ file: raw, missing: true });
    else rels.push({ file: path.relative(ROOT, full).split(path.sep).join('/') });
  }
} else {
  for (const rel of String(execFileSync('git', ['ls-files', 'js'], { cwd: ROOT }))
    .split('\n').filter(Boolean)) {
    if (!SKIP.has(rel)) rels.push({ file: rel });
  }
}

/* ── run ─────────────────────────────────────────────────────────────── */
const errors = [];
let checked = 0;
for (const { file, missing } of rels) {
  if (missing) { errors.push(`${file}: missing`); continue; }
  if (!file.endsWith('.js') || SKIP.has(file)) continue;
  let src;
  try { src = fs.readFileSync(path.join(ROOT, file), 'utf8'); }
  catch (e) { errors.push(`${file}: ${e.message}`); continue; }
  checked++;
  try { parseES5(src); }
  catch (e) {
    /* "Redefinition of property": acorn's EC5 enforces 2009 strict dup-key
       rules that engines stopped enforcing (ES2015 Annex B; verified on
       node 24 for data dupes AND data+accessor mixes). Gate matches 2026
       browsers, not 2009: ignore this one message (dev.js's double
       `take:` is therefore clean by decision — see ledger 2026-11-06). */
    if (/Redefinition of property/.test(e.message)) continue;
    const loc = e.loc ? `${e.loc.line}:${e.loc.column}` : '?';
    errors.push(`${file}:${loc}: ${e.message}`);
  }
}
if (!checked && !errors.length) {
  console.error('check: nothing to check (inputs gitignored or skipped?)');
  process.exit(3);
}
if (errors.length) {
  console.error(`check: ${errors.length} problem${errors.length === 1 ? '' : 's'} against ${checked} parsed file${checked === 1 ? '' : 's'}`);
  for (const l of errors) console.error('  ' + l);
  process.exit(1);
}
console.log(`check: ${checked} file${checked === 1 ? '' : 's'} parsed ES5-clean`);
