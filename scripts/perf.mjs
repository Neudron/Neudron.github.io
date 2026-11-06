#!/usr/bin/env node
/*
 * perf.mjs — Phase 0.2 frame-timing probe for the neu landing page.
 *
 * Local-only tool: launches desktop Chrome with playwright-core (NOT a
 * repo dependency), applies Emulation.setCPUThrottlingRate over CDP,
 * settles ~1 s, then samples rAF deltas in-page for a fixed window plus a
 * buffered PerformanceObserver('longtask'). Prints p50/p95/1%-low deltas,
 * long-task count/max. --write stores .parity/perf-baseline.json
 * (gitignored). No CI and no `npm run check` interact with this script.
 *
 *   export CHROME_PATH=/home/neu/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome
 *   node scripts/perf.mjs                       # measure + print
 *   node scripts/perf.mjs --write               # measure + save baseline
 *   node scripts/perf.mjs --rate 4 --ms 10000   # tune throttle / window
 *
 * playwright-core comes from tests/node_modules (gitignored). If missing:
 *   cd tests && npm i playwright-core
 *
 * # ponytail: vsync variance means no double-capture gate here — the
 * parity-style determinism check would false-fail on real hardware quirks.
 * Compare baselines by hand (diff the JSON) until Phase 2 needs a gate.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const RATE = Number(flag('--rate') || 4);
const WINDOW_MS = Number(flag('--ms') || 10000);
const OUT = path.join(ROOT, '.parity', 'perf-baseline.json');
const WRITE = argv.includes('--write');

/* playwright-core must come from the gitignored tests workspace, never as
   a tracked dependency: dynamic import + createRequire scoped there.      */
let pw;
try {
  const { createRequire } = await import('node:module');
  const req = createRequire(path.join(ROOT, 'tests', 'noop.js'));
  pw = req('playwright-core');
} catch (e) {
  console.error('perf: playwright-core not loadable: ' + e.message);
  console.error('perf: install it in tests/ →  cd tests && npm i playwright-core');
  process.exit(1);
}
const CHROME = process.env.CHROME_PATH;
if (!CHROME || !fs.existsSync(CHROME)) {
  console.error('perf: CHROME_PATH missing or not a file: ' + (CHROME || '(unset)'));
  console.error('perf: e.g. export CHROME_PATH=/home/neu/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome');
  process.exit(1);
}

const browser = await pw.chromium.launch({ executablePath: CHROME, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  const index = 'file://' + path.join(ROOT, 'index.html');
  await page.goto(index, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1000); // settle: first frames + warmup

  const res = await page.evaluate(async (windowMs) => {
    const deltas = [];
    const longs = [];
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) longs.push({ d: +e.duration.toFixed(1), t: e.startTime });
      }).observe({ type: 'longtask', buffered: true });
    } catch { longs.push({ d: NaN }); }
    const t0 = performance.now();
    let last = t0;
    while (performance.now() - t0 < windowMs) {
      await new Promise((r) => requestAnimationFrame(r));
      const now = performance.now();
      deltas.push(+(now - last).toFixed(2));
      last = now;
    }
    return {
      deltas: deltas.slice(1),
      longtaskMax: longs.reduce((m, e) => (e.d > (m || 0) ? e.d : m), 0),
      longtaskCount: longs.filter((e) => Number.isFinite(e.d)).length,
    };
  }, WINDOW_MS);

  const deltas = res.deltas; // first frame incl. warmup dropped
  const sorted = [...deltas].sort((a, b) => a - b);
  const pick = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  const tail = sorted.slice(Math.floor(sorted.length * 0.99));
  const mean = (arr) => arr.reduce((s, v) => s + v, 0) / Math.max(1, arr.length);
  const slow = deltas.filter((d) => d >= 34); // >2 missed vsyncs at 60Hz
  const out = {
    v: 1,
    rate: RATE,
    ms: WINDOW_MS,
    frames: deltas.length,
    p50: +pick(0.5).toFixed(2),
    p95: +pick(0.95).toFixed(2),
    p01low: +mean(tail).toFixed(2),
    slow34: slow.length,
    longtaskMax: res.longtaskMax,
    longtaskCount: res.longtaskCount,
  };

  console.log(
    `perf: rate=${out.rate} ms=${out.ms} frames=${out.frames} ` +
    `p50=${out.p50} p95=${out.p95} 1%low=${out.p01low} ` +
    `slow34=${out.slow34} longtasks=${out.longtaskCount} max=${out.longtaskMax}`
  );
  if (WRITE) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
    console.log('perf: baseline written → .parity/perf-baseline.json');
  }
} finally {
  await browser.close();
}
