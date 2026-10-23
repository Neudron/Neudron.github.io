/* newfix.mjs — start the next fixesN suite from the template.
   ────────────────────────────────────────────────────────────────
     node tests/newfix.mjs "<title>"          write tests/fixes<N>.mjs
     node tests/newfix.mjs "<title>" --dry    print the path and content, write nothing

   N is one more than the highest existing tests/fixesN.mjs. The file is
   created exclusively (flag wx), so an existing suite is never
   overwritten, even if two runs race.

   The new name is picked up by run-all.mjs the moment it exists. This
   script's own name does not match fixesN, so it never runs as a suite. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const title = args.filter(a => !a.startsWith('--')).join(' ').trim();

if (!title) {
  console.error('usage: node tests/newfix.mjs "<title>" [--dry]');
  process.exit(2);
}

const taken = fs.readdirSync(HERE)
  .map(f => f.match(/^fixes(\d+)\.mjs$/))
  .filter(Boolean)
  .map(m => +m[1]);
const n = (taken.length ? Math.max(...taken) : 0) + 1;
const file = path.join(HERE, `fixes${n}.mjs`);

/* A title is free text, but it sits inside a block comment: it must not
   be able to close that comment early. */
const safe = title.replace(/\*\//g, '* /');

/* The template. Joined from lines, not a template literal, so nothing in
   it is interpolated by accident. The placeholder check is real: it
   fails if index.html is missing, so an unedited suite is not a false pass. */
const content = [
  `/* fixes${n}.mjs — ${safe}`,
  `   Run: node tests/fixes${n}.mjs`,
  '',
  '   Why: <the bug or rule this suite protects, in one or two sentences>.',
  '',
  '   Replace the placeholder section with the real checks. */',
  '',
  "import fs from 'node:fs';",
  "import path from 'node:path';",
  "import { fileURLToPath } from 'node:url';",
  '',
  "const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');",
  'let pass = 0, fail = 0;',
  "const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))",
  "                         : (fail++, console.log('  FAIL ' + n)); };",
  "const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');",
  '',
  '/* ── 1. placeholder: replace with the real checks ─────────────── */',
  "console.log('\\n1. the section');",
  "ok('index.html is readable', read('index.html').length > 0);",
  '',
  "console.log('\\n' + (fail === 0 ? 'ALL PASS (' + pass + ')' : fail + ' FAILED, ' + pass + ' passed'));",
  'process.exit(fail === 0 ? 0 : 1);',
  '',
].join('\n');

if (dry) {
  console.log('would write: ' + file);
  console.log('─'.repeat(60));
  process.stdout.write(content);
  console.log('─'.repeat(60));
  console.log('(dry run: nothing written)');
  process.exit(0);
}

try {
  fs.writeFileSync(file, content, { flag: 'wx' });
} catch (e) {
  if (e.code === 'EEXIST') {
    console.error('refusing to overwrite ' + file);
    process.exit(1);
  }
  throw e;
}
console.log('wrote ' + file);
