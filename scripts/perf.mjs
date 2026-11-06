#!/usr/bin/env node
/*
 * perf.mjs — Phase 0.2/2b frame-timing probe for the BUILT site (dist/).
 *
 * Serves dist/ over 127.0.0.1 (non-local connections aborted), drives each
 * scene the way a player reaches it (the dev console's `skip <section>` +
 * open commands; per-zone rooms via a save write, the skipTo trick), then
 * samples rAF deltas in-page for a fixed window plus a buffered
 * PerformanceObserver('longtask'). A console error, an uncaught throw or a
 * failed local request fails the scene.
 *
 *   export CHROME_PATH=/home/neu/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome
 *   npm run build                                  # the probe measures dist/, not source
 *   node scripts/perf.mjs                          # every scene, desktop, 4x throttle
 *   node scripts/perf.mjs --scene bullet           # one scene
 *   node scripts/perf.mjs --profile mobile         # 390x844 @2x touch
 *   node scripts/perf.mjs --rate 4 --ms 10000      # throttle / window per scene
 *   node scripts/perf.mjs --write                  # .parity/perf-baseline.json
 *
 * playwright-core comes from gitignored tests/node_modules. If missing:
 *   cd tests && npm i playwright-core
 *
 * Scene list: the fights the owner keeps retuning + one room per zone.
 * dark "endless" needs 300+ metres of scripted walking to reach — add a
 * driver command to dark.js before measuring it (ponytail: not now).
 *
 * # ponytail: no double-capture determinism gate — vsync/real-clock
 * variance would false-fail on real hardware quirks. Compare baselines
 * by hand (diff the JSON) until Phase 2 needs a gate.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const RATE = Number(flag('--rate') || 4);
const WINDOW_MS = Number(flag('--ms') || 10000);
const MOBILE = flag('--profile') === 'mobile';
const OUT = path.join(ROOT, '.parity', 'perf-baseline.json');
const WRITE = argv.includes('--write');
const ONLY = flag('--scene');

const SCENES = [
  { name: 'home' },
  { name: 'bullet', skip: 'act2 bullet', cmds: ['game'] },
  { name: 'dark', skip: 'act2 dark', cmds: ['dark'] },
  { name: 'deck', skip: 'tv', cmds: ['take', 'deck'] },
  { name: 'scal1', skip: 'scal p1' },
  { name: 'scal2', skip: 'scal p2' },
  { name: 'scal3', skip: 'scal p3' },
  { name: 'room-a1', room: 'a1_clearing', spawn: 'default' },
  { name: 'room-d1', room: 'd1_street', spawn: 'east' },
  { name: 'room-e4', room: 'e4_corridor', spawn: 'south' },
  { name: 'room-g1', room: 'g_1', spawn: 'default' },
  { name: 'room-h3', room: 'h3_trip', spawn: 'in' },
];

/* ── local server for dist/ (bench/renderers.mjs scaffold) ──────────── */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.json': 'application/json', '.txt': 'text/plain' };
const distOK = fs.existsSync(path.join(DIST, 'index.html'));
if (!distOK) {
  console.error('perf: dist/index.html missing — run npm run build first');
  process.exit(1);
}
const server = http.createServer((req, res) => {
  const remote = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  if (remote !== '127.0.0.1') { res.destroy(); return; } // local-only tool
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(DIST, p);
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); res.end('nope'); return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream',
    'cache-control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

/* ── playwright-core from gitignored tests/node_modules only ────────── */
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
const picked = ONLY ? SCENES.filter((s) => s.name === ONLY) : SCENES;
if (ONLY && !picked.length) {
  console.error('perf: no scene "' + ONLY + '". scenes: ' + SCENES.map((s) => s.name).join(' '));
  await browser.close(); server.close();
  process.exit(1);
}
const results = {};
let failCount = 0;

try {
  for (const sc of picked) {
    const vp = MOBILE
      ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
      : { width: 1280, height: 720, deviceScaleFactor: 1 };
    const page = await browser.newPage({ viewport: vp });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });

    const errs = [];
    let closed = false;
    page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    page.on('pageerror', (e) => errs.push('pageerror: ' + String(e)));
    page.on('requestfailed', (r) => {
      if (closed) return;
      const u = r.url();
      if (u.startsWith(base)) {
        const et = r.failure()?.errorText || '?';
        if (et === 'net::ERR_ABORTED') errs.push('(abort, noted not fatal: ' + u + ')');
        else errs.push('request failed: ' + u + ' (' + et + ')');
      } else errs.push('(cdn, noted not fatal: ' + u + ')');
    });

    /* scene state: skip section (page reloads itself) or save-write into a
       room (the skipTo trick: data.room + data.spawn + flush). */
    const reload = sc.room
      ? { run: () => page.evaluate(({ room, spawn }) => {
          NEU.save.data.room = room; NEU.save.data.spawn = spawn;
          NEU.save.flush(); location.reload();
        }, { room: sc.room, spawn: sc.spawn }) }
      : { run: () => page.evaluate((skip) => { NEU.dev.run('skip ' + skip); }, sc.skip) };

    await page.goto(base + '/', { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(() => { try { localStorage.clear(); } catch {} });
    if (sc.skip || sc.room) {
      await reload.run().catch(() => {}); // evaluate dies when the page navigates
      await page.waitForLoadState('load', { timeout: 30000 });
      await page.waitForFunction(() => typeof NEU !== 'undefined' && NEU.dev && typeof NEU.dev.run === 'function',
        { timeout: 15000 });
    }
    for (const cmd of sc.cmds || []) {
      await page.evaluate((c) => { NEU.dev.run(c); }, cmd);
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(1000); // settle: boot + first frames

    const res = await page.evaluate(async (windowMs) => {
      const deltas = [];
      const longs = [];
      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) longs.push(+e.duration.toFixed(1));
        }).observe({ type: 'longtask', buffered: true });
      } catch { longs.push(NaN); }
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
        longtaskMax: longs.reduce((m, d) => (d > (m || 0) ? d : m), 0),
        longtaskCount: longs.filter((d) => Number.isFinite(d)).length,
      };
    }, WINDOW_MS);

    closed = true;
    await page.close();
    const realErrs = errs.filter((e) => /^(console:|pageerror:|request failed:)/.test(e));
    const vert = realErrs.length ? [] : res.deltas;
    const sorted = [...vert].sort((a, b) => a - b);
    const pick = (q) => (sorted.length ? +sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))].toFixed(2) : null);
    const tail = sorted.slice(Math.floor(sorted.length * 0.99));
    const mean = (arr) => arr.reduce((s, v) => s + v, 0) / Math.max(1, arr.length);
    const out = realErrs.length
      ? { error: realErrs[0] }
      : {
          frames: vert.length,
          p50: pick(0.5),
          p95: pick(0.95),
          p01low: +mean(tail).toFixed(2),
          slow34: vert.filter((d) => d >= 34).length,
          longtaskMax: res.longtaskMax,
          longtaskCount: res.longtaskCount,
        };
    results[sc.name] = out;
    if (realErrs.length) failCount++;
    console.log(
      'perf: ' + sc.name.padEnd(9) +
      (realErrs.length
        ? ' FAIL ' + realErrs[0].slice(0, 90)
        : `frames=${out.frames} p50=${out.p50} p95=${out.p95} 1%low=${out.p01low} ` +
          `slow34=${out.slow34} longtasks=${out.longtaskCount} max=${out.longtaskMax}`));
  }
} finally {
  await browser.close();
  server.close();
}

if (WRITE && !failCount) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ v: 2, rate: RATE, ms: WINDOW_MS,
    profile: MOBILE ? 'mobile-390x844@2x' : 'desktop-1280x720', scenes: results }, null, 2) + '\n');
  console.log('perf: baseline written → .parity/perf-baseline.json');
}
if (failCount) {
  console.error(`perf: ${failCount} scene${failCount === 1 ? '' : 's'} failed`);
  process.exit(1);
}
