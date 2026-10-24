/* cdp-probe.mjs — a real-browser boot check. Opt-in.
   Run: NEU_CDP=1 node tests/cdp-probe.mjs      (no NEU_CDP: exits 0 at once)

   The jsdom suites never run the page in a real engine. This one does:
   it serves the repo root on 127.0.0.1, opens it in headless Chromium at
   desktop and phone sizes, and checks that the page boots (body gets
   is-ready), that no page error was thrown, that NEU.engine exists, and
   that the JS heap after boot is under 150 MB.

   Not in run-all's default list. run-all picks up only fixes<N>.mjs and
   playthrough.mjs, so this file is never run by it. The env gate keeps
   it a no-op for anyone who runs it without NEU_CDP=1.

   Network: every request that is not 127.0.0.1 is aborted. The sandbox
   proxy is not trusted by Chromium, and a boot must not depend on a
   CDN or a font server to pass. */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

if (process.env.NEU_CDP !== '1') {
  console.log('cdp-probe: skipped (set NEU_CDP=1)');
  process.exit(0);
}

const require = createRequire(new URL('./package.json', import.meta.url));
const { chromium } = require('playwright-core');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const HEAP_LIMIT = 150 * 1024 * 1024;
const BOOT_MS = 90000;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };

/* A static server for the repo root. Anything that resolves outside the
   root is refused, so the probe cannot read files it was not asked for. */
function serve() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let p;
      try { p = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); }
      catch { res.writeHead(400).end(); return; }
      let file = path.normalize(path.join(ROOT, p === '/' ? 'index.html' : p));
      if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403).end(); return; }
      try {
        if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
        const body = fs.readFileSync(file);
        res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(body);
      } catch { res.writeHead(404).end(); }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/* Only the probe's own origin may load. Everything else is refused, and
   data: and blob: URLs are the page's own and pass through. */
async function lockNetwork(context) {
  await context.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    if (u.hostname === '127.0.0.1') return route.continue();
    return route.abort();
  });
}

/* Opens the page in a fresh context and waits for it to boot. Returns
   what the probe checks. Errors are collected from the first script. */
async function bootIn(browser, base, opts, label) {
  const context = await browser.newContext(opts);
  await lockNetwork(context);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/', { waitUntil: 'load', timeout: BOOT_MS });
  const booted = await page.waitForFunction(() => document.body.classList.contains('is-ready'),
                                            undefined, { timeout: BOOT_MS })
    .then(() => true, () => false);
  const hasEngine = await page.evaluate(() => !!(window.NEU && window.NEU.engine));
  return { context, page, errors, booted, hasEngine, label };
}

async function main() {
  if (!fs.existsSync(CHROME)) {
    console.log('  FAIL no Chromium at ' + CHROME);
    return 1;
  }
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    /* root in a sandbox container: Chromium will not start without this */
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    /* desktop */
    const d = await bootIn(browser, base, { viewport: { width: 1280, height: 800 } }, 'desktop');
    ok('desktop: the page boots (body is-ready)', d.booted === true);
    ok('desktop: no page errors', d.errors.length === 0);
    if (d.errors.length) console.log('    ' + d.errors.join('\n    '));
    ok('desktop: NEU.engine exists', d.hasEngine === true);
    const cdp = await d.context.newCDPSession(d.page);
    await cdp.send('Performance.enable');
    const { metrics } = await cdp.send('Performance.getMetrics');
    const heap = (metrics.find(m => m.name === 'JSHeapUsedSize') || {}).value;
    ok(`desktop: JS heap after boot ${(heap / 1048576).toFixed(1)} MB < 150 MB`,
       typeof heap === 'number' && heap < HEAP_LIMIT);
    await d.context.close();

    /* phone */
    const m = await bootIn(browser, base,
      { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, 'phone');
    ok('phone: the page boots (body is-ready)', m.booted === true);
    ok('phone: no page errors', m.errors.length === 0);
    if (m.errors.length) console.log('    ' + m.errors.join('\n    '));
    ok('phone: NEU.engine exists', m.hasEngine === true);
    await m.context.close();
  } finally {
    await browser.close();
    await new Promise(r => server.close(r));
  }
  return 0;
}

const watchdog = setTimeout(() => {
  console.log('  FAIL watchdog: the probe ran past 170s');
  process.exit(1);
}, 170000);

main().then(() => {
  clearTimeout(watchdog);
  console.log(fail ? `${fail} FAILED, ${pass} passed` : `ALL PASS (${pass})`);
  process.exit(fail ? 1 : 0);
}, err => {
  clearTimeout(watchdog);
  console.log('  FAIL ' + (err && err.message ? err.message : err));
  console.log(fail ? `${fail} FAILED, ${pass} passed` : `${pass + 1} FAILED, ${pass} passed`);
  process.exit(1);
});
