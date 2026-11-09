// node scripts/v3/shot.mjs <out.png> "<js to eval after boot>" [waitMs=2500] [w=1280] [h=720]
// Real Chromium (playwright headless shell), fresh profile per run. Run from the worktree root after
// `sh scripts/v3/wo.sh serve`. Reach a room with NEU.dev.run("tp <id>"), a mode with NEU.<mode>.open().
// SHOT_PORT overrides 8766. Exit code 1 when the page threw.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(process.cwd() + '/tests/');
const { chromium } = require('playwright-core');
const [out, js = '', wait = '2500', w = '1280', h = '720'] = process.argv.slice(2);
if (!out) { console.error('usage: shot.mjs <out.png> "<js>" [waitMs] [w] [h]'); process.exit(2); }
const cache = process.env.HOME + '/.cache/ms-playwright';
const exe = fs.readdirSync(cache).find(d => d.startsWith('chromium_headless_shell'));
const b = await chromium.launch({ executablePath: `${cache}/${exe}/chrome-linux/headless_shell` });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = [];
p.on('pageerror', e => errs.push(e.message));
const ok = () => document.querySelectorAll('button').forEach(x => { if (x.textContent.trim() === 'ok') x.click(); });
await p.goto('http://127.0.0.1:' + (process.env.SHOT_PORT || 8766) + '/', { waitUntil: 'load', timeout: 8000 });
await p.waitForTimeout(700);
await p.evaluate(ok);                       // the first-run motion notice covers the bottom of the frame
if (js) { try { await p.evaluate(js); } catch (e) { errs.push('eval: ' + e.message); } }
await p.waitForTimeout(+wait);
await p.evaluate(ok);
await p.screenshot({ path: out });
console.log('shot', out, errs.length ? 'ERRORS: ' + errs.slice(0, 5).join(' | ') : 'no errors');
await b.close();
process.exit(errs.length ? 1 : 0);
