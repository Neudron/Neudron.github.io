/* coverage-matrix.mjs — which suite touches which source. Informational.
   ────────────────────────────────────────────────────────────────
     node tests/coverage-matrix.mjs
   Exits 0 always. Nothing here is a gate.

   Two kinds of evidence are counted per suite, in code only (comments
   are stripped first, so a commented-out call is not counted):
     readFileSync(   a suite that reads source text and asserts on it
                     (the static checks)
     read('…')       the same, through a suite's local read() helper,
                     counted by its literal path argument
     NEU.            a suite that boots the page and asks it things
                     (the runtime probes)
   A suite that only does one of these is still useful; the matrix is
   about shape, not a score.

   Then every file under js/ that no suite names is listed. "Names" is a
   plain text match on the file's basename, comments included: a suite
   that mentions a file in a comment has at least thought about it. A
   file nobody names is a file no suite can break on purpose. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

/* Suites are the fixesN files plus the two playthrough-style drivers. The
   runner, this script, the scaffold and lib/ are tooling, not suites. */
const SUITE = /^(fixes\d+|playthrough|reach)\.mjs$/;
const suites = fs.readdirSync(HERE)
  .filter(f => SUITE.test(f))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

/* Blank out comments but keep the code's shape. */
function stripComments(src) {
  const blank = s => s.replace(/[^\n]/g, ' ');
  let out = src.replace(/\/\*[\s\S]*?\*\//g, blank);
  out = out.replace(/^([ \t]*)\/\/[^\n]*/gm, (m, ws) => ws + blank(m.slice(ws.length)));
  out = out.replace(/([;}])([ \t]*)\/\/[^\n]*/g,
                    (m, p, ws) => p + ws + blank(m.slice(p.length + ws.length)));
  return out;
}

/* Every js/ file, relative to js/ (e.g. core/juice.js). */
const jsFiles = [];
(function walk(dir, rel) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(p, r);
    else if (e.name.endsWith('.js')) jsFiles.push(r);
  }
})(path.join(ROOT, 'js'), '');
jsFiles.sort();

const rows = [];
const raw = new Map();
for (const f of suites) {
  const text = fs.readFileSync(path.join(HERE, f), 'utf8');
  const code = stripComments(text);
  raw.set(f, text);
  rows.push({
    suite: f,
    readFileSync: (code.match(/readFileSync\(/g) || []).length,
    helperReads: (code.match(/\bread\(\s*['"`]/g) || []).length,
    neu: (code.match(/\bNEU\./g) || []).length,
  });
}

/* ── the table ───────────────────────────────────────────────────*/
const pad = (s, n) => String(s).padEnd(n);
const num = (s, n) => String(s).padStart(n);
console.log('coverage matrix — ' + suites.length + ' suites, ' + jsFiles.length + ' js/ files\n');
console.log(pad('suite', 18) + num('readFileSync(', 14) + num("read('…')", 11) + num('NEU. refs', 12));
console.log('─'.repeat(55));
for (const r of rows) {
  console.log(pad(r.suite, 18) + num(r.readFileSync, 14) + num(r.helperReads, 11) + num(r.neu, 12));
}
console.log('─'.repeat(55));
const tot = k => rows.reduce((a, r) => a + r[k], 0);
console.log(pad('total', 18) + num(tot('readFileSync'), 14) + num(tot('helperReads'), 11) + num(tot('neu'), 12));

/* ── files no suite names ───────────────────────────────────────*/
const mentions = text => f => {
  const base = path.basename(f).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[^A-Za-z0-9_-])' + base + '(?![A-Za-z0-9_-])').test(text);
};
const named = f => mentions([...raw.values()].join('\n'))(f);
const unnamed = jsFiles.filter(f => !named(f));

/* fixes26 pins the load order, and its fixture names every classic script,
   so for those files a mention is not a behaviour check. Report the files
   that only the order fixture names. */
const outside26 = [...raw.entries()].filter(([f]) => f !== 'fixes26.mjs').map(([, t]) => t).join('\n');
const orderOnly = jsFiles.filter(f => named(f) && !mentions(outside26)(f));

console.log(`\njs/ files named by at least one suite: ${jsFiles.length - unnamed.length} of ${jsFiles.length}`);
if (unnamed.length) {
  console.log('never named by any suite (' + unnamed.length + '):');
  for (const f of unnamed) console.log('  js/' + f);
} else {
  console.log('every js/ file is named by at least one suite');
}
if (orderOnly.length) {
  console.log('named only by fixes26 (load-order fixture, no behavioural suite names it) (' + orderOnly.length + '):');
  for (const f of orderOnly) console.log('  js/' + f);
}

process.exit(0);
