/* run-all.mjs — pre-pass gates, then every suite under a hard per-suite timeout.
   ────────────────────────────────────────────────────────────────
   Pre-pass, before any suite runs (a hit fails the run):
     ES5 gate    every .js file under js/ except js/page/scene.js (the one module)
                 must stay ES5: no arrows, let/const, template literals,
                 `?.`, class, spread/rest, for-of, async/await, 0b/0o.
     dup check   a NAME declared twice at IIFE top level (`  var NAME` or
                 `  function NAME(`, two-space indent) is a hit, unless it
                 is in DUP_ALLOW, where it is a WARN.
   fixes5 and fixes18 legitimately take ~30s (they boot most of the game
   into jsdom), so a bare `node suite.mjs | grep` pipeline kept getting
   killed by shell timeouts. This runner gives every suite 60 seconds and
   kills anything that wedges (boot-check once did).
   Suites run two at a time; NEU_JOBS=1 forces sequential.
   Every run appends its timings to tests/.timings.json (last 20 runs). A
   suite slower than 2x its median over earlier runs gets a WARN, never a
   failure.
     node tests/run-all.mjs          everything
     node tests/run-all.mjs fixes9   one suite by name
   ──────────────────────────────────────────────────────────────── */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const TIMEOUT_MS = 60_000;
const JOBS = Math.max(1, parseInt(process.env.NEU_JOBS, 10) || 2);
const SUITE_MS = /(\d+)\s*(?:passed|\/\d+|ok)|(\d+)\s*fail/i;
const TIMINGS = path.join(HERE, '.timings.json');
const TIMINGS_KEEP = 20;
const SLOW_MIN_RUNS = 3;
const SLOW_FACTOR = 2;

const GATE_EXEMPT = ['js/page/scene.js'];

/* Top-level names that are knowingly declared twice. They WARN instead of
   failing; any other duplicate fails the gate. Empty: no duplicates on
   today's tree, so nothing needs the allowance. */
const DUP_ALLOW = [];

/* ── pre-pass: ES5 gate and duplicate check ───────────────────── */

const ES5_RULES = [
  ['arrow function', /=>/],
  ['let/const declaration', /(?<![\w$.])(?:let|const)\s+[A-Za-z_${[]/],
  ['template literal', /`/],
  ['optional chaining', /\?\.(?!\d)/],
  ['class declaration', /(?<![\w$.])class\s+[A-Za-z_$]/],
  ['spread/rest', /\.\.\./],
  ['for-of loop', /(?<![\w$.])for\s*\([^;)]*(?<![\w$.])of(?![\w$])/],
  ['async/await', /(?<![\w$.])async\s+function\b|(?<![\w$.])await\s+[\w$(\[]/],
  ['0b/0o literal', /(?<![\w$.])0[bBoO][0-9A-Za-z_]/],
];

const VALUE = '\u0001';
const KEYWORDS_BEFORE_EXPR = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new',
  'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
const PUNCT_BEFORE_EXPR = '(,=:[!&|?{};*%<>~^+-';

/* Index just past a quoted literal that starts at i. A '…' or "…" literal
   ends at a newline if it was never closed. */
function literalEnd(src, i, q) {
  let j = i + 1;
  while (j < src.length && src[j] !== q) {
    if (q !== '`' && src[j] === '\n') break;
    j += src[j] === '\\' ? 2 : 1;
  }
  return Math.min(j + 1, src.length);
}

/* Index just past a regex literal that starts at i, or -1 if the slash
   does not close on the same line (then it was a division after all). */
function regexEnd(src, i) {
  let inClass = false;
  for (let j = i + 1; j < src.length; j++) {
    const ch = src[j];
    if (ch === '\n') return -1;
    if (ch === '\\') { j++; continue; }
    if (inClass) { if (ch === ']') inClass = false; }
    else if (ch === '[') inClass = true;
    else if (ch === '/') {
      let k = j + 1;
      while (k < src.length && /\w/.test(src[k])) k++;
      return k;
    }
  }
  return -1;
}

/* Could a '/' after this token start a regex (rather than divide)? */
function regexAllowed(last, prev) {
  if (last === '') return true;
  if (last === VALUE || last === ')' || last === ']') return false;
  if (last === '+' || last === '-') return prev !== last; // `a++ / b` divides
  if (/^[\w$]/.test(last)) return KEYWORDS_BEFORE_EXPR.has(last);
  return PUNCT_BEFORE_EXPR.includes(last);
}

/* Same-length-in-lines copy of src with comments, string bodies and regex
   bodies blanked. Template literals keep one backtick so the rule can see
   them. Newlines survive, so line numbers match the file. */
function stripCode(src) {
  const out = [];
  const n = src.length;
  const blank = s => s.replace(/[^\n]/g, ' ');
  let last = '', prev = '';
  const token = t => { prev = last; last = t; };
  let i = 0;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end < 0 ? n : end + 2;
      out.push(blank(src.slice(i, stop)));
      i = stop;
    } else if (c === '/' && d === '/') {
      const nl = src.indexOf('\n', i);
      const stop = nl < 0 ? n : nl;
      out.push(' '.repeat(stop - i));
      i = stop;
    } else if (c === '"' || c === "'") {
      const stop = literalEnd(src, i, c);
      out.push(blank(src.slice(i, stop)));
      token(VALUE);
      i = stop;
    } else if (c === '`') {
      const stop = literalEnd(src, i, '`');
      out.push('`' + blank(src.slice(i + 1, stop)));
      token(VALUE);
      i = stop;
    } else if (c === '/' && regexAllowed(last, prev) && regexEnd(src, i) > 0) {
      const stop = regexEnd(src, i);
      out.push(blank(src.slice(i, stop)));
      token(VALUE);
      i = stop;
    } else if (/[\w$]/.test(c)) {
      let j = i + 1;
      while (j < n && /[\w$]/.test(src[j])) j++;
      out.push(src.slice(i, j));
      token(src.slice(i, j));
      i = j;
    } else {
      out.push(c);
      if (!/\s/.test(c)) token(c);
      i++;
    }
  }
  return out.join('');
}

/* Every .js file under ROOT/js, as forward-slash paths relative to ROOT. */
function jsFiles(dir = path.join(ROOT, 'js'), found = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) jsFiles(p, found);
    else if (e.name.endsWith('.js')) found.push(path.relative(ROOT, p).split(path.sep).join('/'));
  }
  return found;
}

function preflight() {
  const hits = [];
  const warns = [];
  const files = jsFiles().filter(f => !GATE_EXEMPT.includes(f)).sort();
  for (const rel of files) {
    const lines = stripCode(fs.readFileSync(path.join(ROOT, rel), 'utf8')).split('\n');
    lines.forEach((line, i) => {
      for (const [rule, re] of ES5_RULES) if (re.test(line)) hits.push(`${rel}:${i + 1} ${rule}`);
    });
    const first = new Set();
    lines.forEach((line, i) => {
      const m = /^  (?:var\s+([A-Za-z_$][\w$]*)|function\s+([A-Za-z_$][\w$]*)\s*\()/.exec(line);
      if (!m) return;
      const name = m[1] || m[2];
      if (!first.has(name)) { first.add(name); return; }
      if (DUP_ALLOW.includes(name)) warns.push(`WARN ${rel}:${i + 1} duplicate top-level ${name} (allowlisted)`);
      else hits.push(`${rel}:${i + 1} duplicate top-level ${name}`);
    });
  }
  return { files: files.length, hits, warns };
}

/* ── timing history ───────────────────────────────────────────── */

function loadTimings() {
  try {
    const v = JSON.parse(fs.readFileSync(TIMINGS, 'utf8'));
    return Array.isArray(v) ? v.filter(e => e && typeof e === 'object') : [];
  } catch {
    return [];
  }
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/* A suite is slow when it takes more than SLOW_FACTOR x its median over
   at least SLOW_MIN_RUNS earlier runs. Warns only. */
function slowWarnings(history, current) {
  const out = [];
  for (const [suite, secs] of Object.entries(current)) {
    const prior = history.map(run => run[suite]).filter(v => typeof v === 'number');
    if (prior.length < SLOW_MIN_RUNS) continue;
    const m = median(prior);
    if (secs > SLOW_FACTOR * m) out.push(`WARN slow: ${suite} ${secs.toFixed(1)}s (median ${m.toFixed(1)}s)`);
  }
  return out;
}

function saveTimings(runs) {
  try {
    fs.writeFileSync(TIMINGS, JSON.stringify(runs.slice(-TIMINGS_KEEP), null, 1) + '\n');
  } catch (e) {
    console.log(`WARN could not write ${path.basename(TIMINGS)}: ${e.message}`);
  }
}

/* ── suites ───────────────────────────────────────────────────── */

/* Resolves with the suite's exit status and buffered output. Never rejects. */
function runSuite(f) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const child = spawn(process.execPath, [path.join(HERE, f)], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    let timedOut = false, settled = false;
    let timer = null, grace = null;
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    const finish = (status, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(grace);
      if (error) stderr += `spawn error: ${error.message}\n`;
      resolve({
        f,
        secs: ((Date.now() - t0) / 1000).toFixed(1),
        timedOut,
        status,
        out: stdout + stderr,
      });
    };
    timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
      /* a grandchild can hold the pipes open, so stop waiting after a grace period */
      grace = setTimeout(() => finish(null), 2000);
    }, TIMEOUT_MS);
    child.on('error', err => finish(null, err));
    child.on('close', code => finish(code));
  });
}

/* Prints one table row (plus failing lines). Returns true on pass. */
function report(r) {
  const f = r.f;
  if (r.timedOut) {
    console.log(`${f.padEnd(16)}  ${r.secs}s >${TIMEOUT_MS / 1000}s  TIMEOUT (killed)`);
    return false;
  }
  const out = r.out;
  /* Suites print their own totals in five different shapes. Trust the
     suite's own summary: use the last line that contains a number. */
  let summary = null;
  for (const line of out.split(/\r?\n/)) {
    const t = line.trim();
    if (t && /\d/.test(t) && !/^ok\b/i.test(t) && !/^\s*─/.test(t)) summary = t;
  }
  const bad = [...out.matchAll(/(?:^|\s)(\d+)\s*(?:failed|fail\b)/ig)].reduce((m, x) => m + +x[1], 0);

  const ok = r.status === 0 && bad === 0;
  console.log(`${f.padEnd(16)}  ${r.secs}s  ${ok ? 'PASS' : 'FAIL'}${summary ? '  ' + summary : ''}`);
  if (!ok) {
    for (const line of out.split(/\r?\n/)) if (/FAIL|not ok|Error/i.test(line)) console.log('    ' + line.trim());
  }
  return ok;
}

/* ── main ─────────────────────────────────────────────────────── */

const gate = preflight();
for (const w of gate.warns) console.log(w);
if (gate.hits.length) {
  console.log('ES5 GATE FAILED');
  for (const h of gate.hits) console.log('  ' + h);
  process.exit(1);
}
console.log(`gate: ${gate.files} js files checked, no ES5 or duplicate hits`);

let files = fs.readdirSync(HERE)
  .filter(f => /^fixes\d+\.mjs$|^playthrough\.mjs$/.test(f))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
if (process.argv[2]) files = files.filter(f => f.startsWith(process.argv[2]));

const history = loadTimings();
const rows = new Array(files.length);
let next = 0, printed = 0, failed = 0;
const flush = () => {
  while (printed < files.length && rows[printed]) {
    if (!report(rows[printed++])) failed++;
  }
};
const lane = async () => {
  while (next < files.length) {
    const i = next++;
    rows[i] = await runSuite(files[i]);
    flush();
  }
};

console.log('suite             time    result');
console.log('─'.repeat(46));
await Promise.all(Array.from({ length: Math.min(JOBS, files.length) }, lane));
flush();
console.log('─'.repeat(46));

const current = {};
for (const r of rows) if (!r.timedOut) current[r.f] = +r.secs;
if (files.length) {
  for (const w of slowWarnings(history, current)) console.log(w);
  if (Object.keys(current).length) saveTimings([...history, current]);
}
console.log(failed === 0 ? `ALL ${files.length} SUITES PASS` : `${failed}/${files.length} SUITES FAILED`);
process.exit(failed === 0 ? 0 : 1);
