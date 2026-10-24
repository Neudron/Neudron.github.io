/* fixes25.mjs — size budgets, and the deploy's allow-list.
   Run: node tests/fixes25.mjs

   G8. css/style.css stays under 100 KiB raw and every file under img/
   under 400 KB, so a page that gets heavy shows up as a red test rather
   than as a slow first load.

   A13. The gzip budgets. gzip is what the browser downloads, so the
   JS that matters is budgeted in gzip, measured with node:zlib's
   default level. Each budget is today's measured size times 1.10,
   rounded up. js/core/engine.js is the exception: it is about to be
   rewritten and will grow, so it gets a flat 40 KiB until that lands.

   H3. .github/workflows/deploy.yml stages the site with an explicit
   `cp -r` list, and the cp lines silence errors (`2>/dev/null || true`),
   so a missing name fails silently. The list must equal the web-facing
   top level exactly: a web file left out is a 404 on the live site,
   and a dev-only file put in is a leak (memory/ holds the walkthrough).
   Dev-only names are listed explicitly below; anything else that is
   not web-facing by pattern is an error, so a new top-level file cannot
   slip through unclassified. */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };
const info = n => console.log('  info ' + n);
const KIB = 1024;

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else out.push(p);
  }
  return out;
}
const gz = f => zlib.gzipSync(fs.readFileSync(f)).length;
const rel = f => path.relative(ROOT, f).split(path.sep).join('/');

/* ═══ 1. G8: css and image budgets ═════════════════════════════════*/
console.log('\n1. G8 css and image budgets');
const cssBytes = fs.statSync(path.join(ROOT, 'css/style.css')).size;
ok(`css/style.css is ${cssBytes} B (budget 100 KiB = ${100 * KIB} B)`, cssBytes <= 100 * KIB);

const IMG_LIMIT = 400 * 1000;
const imgs = walk(path.join(ROOT, 'img')).map(f => ({ name: rel(f), size: fs.statSync(f).size }));
const imgOver = imgs.filter(f => f.size > IMG_LIMIT);
ok(`every img/ file is <= 400 KB (${imgs.length} files; over budget: ${imgOver.map(f => f.name + ' ' + f.size + ' B').join(', ') || 'none'})`,
   imgOver.length === 0);
const imgTotal = imgs.reduce((n, f) => n + f.size, 0);
info(`img/ total ${(imgTotal / KIB).toFixed(1)} KiB over ${imgs.length} files (informational, not asserted)`);

/* ═══ 2. A13: gzip budgets ═════════════════════════════════════════
   Today's measured sizes are in the comments; the budgets are
   ceil(measured x 1.10), except engine.js. */
console.log('\n2. A13 gzip budgets (node:zlib gzipSync, default level)');
const BUDGETS = [
  { file: 'js/act4/boss-scal.js', budget: 31184, today: 28349 },   // 28349 x 1.10
  { file: 'js/game/sans.js',      budget: 26722, today: 24292 },   // 24292 x 1.10
  /* engine.js is about to be rewritten and will grow. A flat 40 KiB
     holds until that rewrite lands; then re-measure and set x 1.10. */
  { file: 'js/core/engine.js',    budget: 40 * KIB, today: 15258 },
  { file: 'js/act4/quiz.js',      budget: 16344, today: 14858 },   // 14858 x 1.10 (re-based for TV TIME v2: Tenna drawn in code, the finale)
  { file: 'js/page/scene.js',     budget: 10789, today: 9808 },    // 9808 x 1.10
];
for (const b of BUDGETS) {
  const p = path.join(ROOT, b.file);
  if (!fs.existsSync(p)) { ok(`${b.file} exists`, false); continue; }
  const size = gz(p);
  ok(`${b.file} gzip ${size} B <= ${b.budget} B (today ${b.today} B)`, size <= b.budget);
}

const jsFiles = walk(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).sort();
const jsTotal = jsFiles.reduce((n, f) => n + gz(f), 0);
/* re-based after engine v2 (two new engine files) and the fight-effects
   batch; it was 239253 on a measured 217502 B before them */
const JS_TOTAL_BUDGET = 265765;   // today 241604 B x 1.10, rounded up
ok(`all ${jsFiles.length} js/**/*.js gzip, summed: ${jsTotal} B <= ${JS_TOTAL_BUDGET} B (today 241604 B)`,
   jsTotal <= JS_TOTAL_BUDGET);

/* ═══ 3. H3: the deploy stages exactly the web-facing top level ════*/
console.log('\n3. H3 deploy staging matches the web-facing top level');
const WEB_EXPLICIT = ['index.html', '404.html', 'css', 'js', 'fonts', 'img', 'audio', 'CNAME',
  '.nojekyll', 'og.png', 'robots.txt', 'sitemap.xml', 'llms.txt', 'humans.txt', 'manifest.json',
  'apple-touch-icon.png', '.well-known'];
const WEB_PATTERN = /\.(html|txt|png|json|svg|ico)$/;
const DEV_EXPLICIT = ['README.md', 'AGENTS.md', 'memory', 'tests', '_scripts', '.opencode', '.kilo',
  'opencode.json', '.git', '.github', '.gitignore', '.claude', '.githooks'];
const DEV_PATTERN = /\.md$/;

/* Every `cp -r <names> _stage/` line; the names are the allow-list. */
const DEPLOY = fs.readFileSync(path.join(ROOT, '.github/workflows/deploy.yml'), 'utf8');
const staged = [];
for (const line of DEPLOY.split(/\r?\n/)) {
  const m = /\bcp -r\s+(.+?)\s+_stage\/?(?=\s|$)/.exec(line);
  if (m) staged.push(...m[1].trim().split(/\s+/));
}

const web = [], dev = [], unknown = [];
for (const name of fs.readdirSync(ROOT).sort()) {
  if (WEB_EXPLICIT.includes(name)) web.push(name);
  else if (DEV_EXPLICIT.includes(name) || DEV_PATTERN.test(name)) dev.push(name);
  else if (WEB_PATTERN.test(name)) web.push(name);
  else unknown.push(name);
}
info(`web-facing (${web.length}): ${web.join(' ')}`);
info(`dev-only (${dev.length}) excluded`);
info(`staged (${staged.length}): ${staged.join(' ')}`);

ok(`every top-level entry is classified (unclassified: ${unknown.join(', ') || 'none'})`,
   unknown.length === 0);
ok('the deploy workflow has a staging cp line', staged.length > 0);
const missing = staged.filter(n => !fs.existsSync(path.join(ROOT, n)));
ok(`every staged name exists on disk (missing: ${missing.join(', ') || 'none'})`, missing.length === 0);
const unstaged = web.filter(n => !staged.includes(n));
ok(`every web-facing entry is staged (unstaged: ${unstaged.join(', ') || 'none'})`, unstaged.length === 0);
const leaked = staged.filter(n => !web.includes(n));
ok(`nothing that is not web-facing is staged (extra: ${leaked.join(', ') || 'none'})`, leaked.length === 0);

console.log('\n' + (fail === 0 ? `ALL PASS (${pass})` : `${fail} FAILED, ${pass} passed`));
process.exit(fail === 0 ? 0 : 1);
