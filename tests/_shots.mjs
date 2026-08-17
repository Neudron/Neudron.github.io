/* _shots.mjs — drive the real page in Chromium and photograph every sprite.
   Scratch tool, not a suite. Usage: node _shots.mjs <outdir>

   Static tests cannot tell you a boss is cycling through clipped poses.
   This serves the repo over http (file:// would break the importmap and
   the module script), reaches into NEU directly the way dev.js does, and
   writes one PNG per subject. */
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || '/tmp/shots';
fs.mkdirSync(OUT, { recursive: true });

const TYPES = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript',
  '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml', '.webp':'image/webp',
  '.gif':'image/gif', '.ogg':'audio/ogg', '.woff2':'font/woff2', '.ttf':'font/ttf',
  '.json':'application/json' };

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const p = path.join(ROOT, rel);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    res.writeHead(404); res.end('no'); return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, r));
const base = 'http://127.0.0.1:' + server.address().port + '/';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 720 }, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction(() => window.NEU && window.NEU.engine && window.NEU.sheets, null, { timeout: 15000 });

/* the boot screen and the page itself sit over everything; hide them so a
   scene canvas is what we photograph */
await page.evaluate(() => {
  var b = document.querySelector('.boot'); if (b) b.hidden = true;
  document.body.classList.add('is-booted');
});

async function shot(name) {
  await page.waitForTimeout(180);
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  process.stdout.write('  ' + name + '.png\n');
}

/* ── rooms ───────────────────────────────────────────────────────── */
for (const [room, spawn] of [['a1_clearing','default'], ['a2_path','west'],
                             ['b2_blocks','west'], ['b6_dark','west'],
                             ['b7_altar','east'], ['b8_arena','west'],
                             ['e4_corridor','south'], ['h1_storm','top']]) {
  const ok = await page.evaluate(([r, s]) => {
    if (!NEU.engine || !NEU.engine.enter) return false;
    return NEU.engine.enter(r, s) !== false;
  }, [room, spawn]);
  if (!ok) { console.log('  !! could not enter ' + room); continue; }
  await shot('room-' + room);
}
await page.evaluate(() => NEU.engine && NEU.engine.leave && NEU.engine.leave());

/* ── the bosses, stepped through their frames ─────────────────────── */
async function bossFrames(mod, label, count) {
  const opened = await page.evaluate((m) => {
    if (!window.NEU[m] || !NEU[m].open) return false;
    NEU[m].open(); return true;
  }, mod);
  if (!opened) { console.log('  !! ' + mod + ' has no open()'); return; }
  for (let i = 0; i < count; i++) {
    /* freeze the clock so a known frame index is on screen */
    await page.evaluate((i) => {
      const real = window.__realNow || (window.__realNow = performance.now.bind(performance));
      const fps = 12, per = 1000 / fps;
      performance.now = () => i * per + 1;
    }, i);
    await shot(label + '-frame' + String(i).padStart(2, '0'));
  }
  await page.evaluate(() => {
    if (window.__realNow) performance.now = window.__realNow;
    const m = window.__mod; if (m && NEU[m] && NEU[m].close) NEU[m].close();
  });
}
await page.evaluate(() => { window.__mod = 'scal'; });
await bossFrames('scal', 'scal', 21);
await page.evaluate(() => { if (NEU.scal && NEU.scal.close) NEU.scal.close(); });
await page.evaluate(() => { window.__mod = 'polt'; });
await bossFrames('polt', 'polt', 12);
await page.evaluate(() => { if (NEU.polt && NEU.polt.close) NEU.polt.close(); });

/* ── quiz and craft ──────────────────────────────────────────────── */
for (const [mod, label] of [['quiz','quiz'], ['craft','craft']]) {
  const opened = await page.evaluate((m) => {
    if (!window.NEU[m] || !NEU[m].open) return false;
    NEU[m].open(); return true;
  }, mod);
  if (!opened) { console.log('  !! ' + mod + ' has no open()'); continue; }
  await shot(label);
  await page.evaluate((m) => { if (NEU[m] && NEU[m].close) NEU[m].close(); }, mod);
}

console.log('\npage errors: ' + (errs.length ? '\n  ' + errs.slice(0, 12).join('\n  ') : 'none'));
await browser.close();
server.close();
