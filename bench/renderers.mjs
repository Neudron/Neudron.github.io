/* Representative Canvas2D vs PixiJS WebGL2 workload.
   Serves the repo, drives the same scene through both renderers at real and
   overloaded entity counts, on desktop and on a 4x-throttled mobile profile.
   Run: node bench/renderers.mjs   (writes /tmp/opencode/renderer-bench.json) */
import { chromium } from '../tests/node_modules/playwright-core/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.json': 'application/json', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nope'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const chrome = '/home/neu/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: chrome, headless: true,
  args: ['--use-angle=vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-dev-shm-usage', '--no-sandbox'] });

const profiles = [
  { id: 'desktop-rtx4070', viewport: { width: 1440, height: 900 }, dsf: 1, throttle: 1 },
  { id: 'mobile-390x844-4x', viewport: { width: 390, height: 844 }, dsf: 2, throttle: 4, mobile: true }
];
const levels = [1, 2, 4];
const kinds = ['canvas', 'pixi'];
const results = { gpu: null, profiles: {}, bytes: {} };

async function one(profile, kind, level) {
  const context = await browser.newContext({ viewport: profile.viewport, deviceScaleFactor: profile.dsf,
    isMobile: !!profile.mobile, hasTouch: !!profile.mobile });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) route.continue(); else route.abort();
  });
  if (profile.throttle > 1) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.throttle });
  }
  const t0 = Date.now();
  await page.goto(base + '/bench/renderers.html', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.BENCH && window.BENCH.out, null, { timeout: 30000 });
  const boot = await page.evaluate(() => window.BENCH.out);
  await page.evaluate(() => window.BENCH.run('canvas', 1, 1)); /* warm JIT + raster paths */
  const r = await page.evaluate(({ kind, level }) => window.BENCH.run(kind, level, 6), { kind, level });
  await context.close();
  return { ...r, readyMs: boot.readyMs, wallReadyMs: Date.now() - t0, errors,
    gpu: boot.gpu, webgl2: boot.webgl2 };
}

for (const profile of profiles) {
  const rows = [];
  for (const level of levels) {
    for (const kind of kinds) {
      const r = await one(profile, kind, level);
      r.kind = kind; r.level = level;
      rows.push(r);
      console.log(profile.id, 'x' + level, kind, JSON.stringify({ fps: r.fps, submit: r.submit, interval: r.interval, dropped25: r.dropped25, missed50: r.missed50, readyMs: r.readyMs }));
    }
  }
  results.profiles[profile.id] = rows;
}
const pixi = fs.readFileSync(path.join(ROOT, 'node_modules/pixi.js/dist/pixi.min.mjs'));
results.bytes = { pixiMinGzip: zlib.gzipSync(pixi).length, pixiMinRaw: pixi.length };
fs.writeFileSync('/tmp/opencode/renderer-bench.json', JSON.stringify(results, null, 2));
await browser.close();
server.close();
console.log('bytes', JSON.stringify(results.bytes));
