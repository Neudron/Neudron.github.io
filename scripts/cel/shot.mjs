// Real-browser screenshot of cel.html. node scripts/cel/shot.mjs <out.png> "<query>" [untilFrame=0] [w=1280] [h=720]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire((process.env.PW_ROOT || process.env.HOME + '/git/Neudron.github.io') + '/tests/');
const { chromium } = require('playwright-core');
const [out, query = 'map=forest-path', until = '0', w = '1280', h = '720'] = process.argv.slice(2);
const cache = process.env.HOME + '/.cache/ms-playwright', exe = fs.readdirSync(cache).find(d => d.startsWith('chromium_headless_shell'));
const b = await chromium.launch({ executablePath: cache + '/' + exe + '/chrome-linux/headless_shell' });
const p = await b.newPage({ viewport: { width: +w, height: +h } }), errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://127.0.0.1:' + (process.env.PORT || 3017) + '/cel.html?' + query, { waitUntil: 'load', timeout: 8000 });
await p.waitForFunction(n => window.NEU && NEU.cel && NEU.cel.level && NEU.cel.level.frame >= n, +until || 1, { timeout: 60000 });
await p.waitForTimeout(300);
const info = await p.evaluate(() => ({ room: NEU.cel.room.name, frame: NEU.cel.level.frame, x: NEU.cel.player.x, y: NEU.cel.player.y, hud: document.getElementById('hud').textContent }));
await p.screenshot({ path: out });
console.log('shot', out, JSON.stringify(info), errs.length ? 'ERRORS: ' + errs.slice(0, 5).join(' | ') : 'no errors');
await b.close(); process.exit(errs.length ? 1 : 0);
