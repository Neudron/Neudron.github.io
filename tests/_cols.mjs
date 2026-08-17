/* _cols.mjs — lay both columns of a grid sheet out side by side, magnified,
   so a human can see which half is which. Scratch tool. */
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || '/tmp/cols';
fs.mkdirSync(OUT, { recursive: true });

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const p = path.join(ROOT, rel);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  const t = { '.html':'text/html', '.js':'text/javascript', '.png':'image/png', '.css':'text/css' }[path.extname(p)] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': t });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, r));
const base = 'http://127.0.0.1:' + server.address().port + '/';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 1 });
await page.goto(base + 'index.html');

for (const [file, fh, rows] of [['img/act4/calamity/SupremeCalamitas.png', 60, 21],
                                ['img/act4/calamity/SupremeCalamitasHooded.png', 62, 21]]) {
  const name = path.basename(file, '.png');
  await page.evaluate(async ([src, fh, rows]) => {
    document.body.innerHTML = '';
    document.body.style.background = '#08080B';
    const im = new Image();
    im.src = src;
    await im.decode();
    const S = 3, PICK = [0, 4, 8, 12, 16, 20], FW = im.width / 2;
    const c = document.createElement('canvas');
    c.width = PICK.length * (FW * S + 10) + 10;
    c.height = 2 * (fh * S + 26) + 10;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.fillStyle = '#08080B'; x.fillRect(0, 0, c.width, c.height);
    x.font = '14px monospace'; x.fillStyle = '#EDE7DE';
    for (let col = 0; col < 2; col++) {
      const oy = 10 + col * (fh * S + 26);
      x.fillText('col ' + col, 10, oy + 14);
      PICK.forEach((fr, i) => {
        const ox = 10 + i * (FW * S + 10);
        x.strokeStyle = '#2A2238'; x.strokeRect(ox, oy + 20, FW * S, fh * S);
        x.drawImage(im, col * FW, fr * fh, FW, fh, ox, oy + 20, FW * S, fh * S);
        x.fillStyle = '#8A8598'; x.fillText('f' + fr, ox, oy + 18); x.fillStyle = '#EDE7DE';
      });
    }
    document.body.appendChild(c);
  }, [base + file, fh, rows]);
  await page.waitForTimeout(250);
  await page.locator('canvas').screenshot({ path: path.join(OUT, name + '-columns.png') });
  console.log('  ' + name + '-columns.png');
}
await browser.close();
server.close();
