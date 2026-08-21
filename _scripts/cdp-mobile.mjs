/* cdp-mobile.mjs — TEMP mobile-emulation probe over raw CDP (Windows-safe;
   opensteer needs AF_UNIX). Boots Edge headless at iPhone-ish metrics,
   drives the real page, collects console errors + runtime answers.
   Every await is raced against a timeout so nothing can wedge. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = process.env.CDP_BROWSER ||
  path.join(process.env.TEMP, 'opencode', 'browsers', 'chrome-headless-shell',
            'win64-152.0.7977.54', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const PORT = 9223;
const URL_ = process.argv[2] || 'http://localhost:8901/index.html';
const SHOT = process.argv[3] || null;

const withTimeout = (p, ms, what) => Promise.race([
  p,
  new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT ' + what)), ms)),
]);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── launch edge ─────────────────────────────────────────────────── */
const profile = path.join(process.env.TEMP, 'opencode', 'edge-cdp');
fs.mkdirSync(profile, { recursive: true });
const proc = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`, '--no-first-run', '--window-size=390,844',
  'about:blank',
], { stdio: 'ignore' });
proc.on('error', e => { console.error('edge spawn failed:', e.message); process.exit(1); });

try {
  /* wait for the debugger endpoint */
  let targets = null;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await withTimeout(fetch(`http://127.0.0.1:${PORT}/json/list`), 2000, 'debugger list');
      targets = await res.json();
      if (targets.length) break;
    } catch (e) { /* not up yet */ }
    await sleep(250);
  }
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await withTimeout(new Promise((res, rej) => {
    ws.onopen = res; ws.onerror = () => rej(new Error('ws open failed'));
  }), 5000, 'websocket');

  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) events.push(m);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, m => m.error ? reject(new Error(method + ': ' + JSON.stringify(m.error))) : resolve(m.result));
    ws.send(JSON.stringify({ id: mid, method, params }));
    setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); reject(new Error('TIMEOUT cdp ' + method)); } }, 8000);
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable').catch(() => {});
  /* iPhone-ish: 390x844 dpr3, touch, coarse pointer */
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });

  const errors = [];
  events.length = 0;
  await send('Page.navigate', { url: URL_ });
  await sleep(3500);

  const evalJs = async expr => {
    try {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
      if (r.exceptionDetails) return 'EVAL-ERR: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result && r.result.value;
    } catch (e) { return 'SEND-ERR: ' + e.message; }
  };

  console.log('title:', await evalJs('document.title'));
  console.log('viewport:', await evalJs('innerWidth + "x" + innerHeight'));
  console.log('coarse pointer:', await evalJs('matchMedia("(pointer: coarse)").matches'));

  /* the room + thumb pad */
  console.log('enter room:', await evalJs('String(NEU.engine.enter("a1_clearing","default"))'));
  await sleep(900);
  console.log('touch mode:', await evalJs('NEU.touch.mode'));
  console.log('manual _sync:', await evalJs('(function(){try{NEU.touch._sync();return "ok"}catch(e){return "THREW "+e.message}})()'));
  console.log('touch scene:', await evalJs('String(NEU.touch.scene)'));
  console.log('pad visible:', await evalJs('String(NEU.touch.visible)'));
  console.log('pad scene attr:', await evalJs('document.querySelector(".tpad") && document.querySelector(".tpad").getAttribute("data-scene")'));

  /* shop claims input + pad follows */
  console.log('open shop:', await evalJs('NEU.shop.open(0), !document.getElementById("shop").hidden'));
  await sleep(700);
  console.log('touch scene under shop (want shop):', await evalJs('NEU.touch.scene'));
  console.log('engine still running under shop:', await evalJs('NEU.engine.running'));
  console.log('board fits viewport:', await evalJs('(b=>b? b.scrollWidth<=innerWidth : null)(document.getElementById("shopBoard"))'));
  console.log('shop row height >=44:', await evalJs('(r=>r? Math.round(r.getBoundingClientRect().height):null)(document.querySelector(".shop__row"))'));

  /* tap a row like a thumb would (touch point) */
  const rowBox = await evalJs('(r=>{const b=r.getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]})(document.querySelectorAll(".shop__row")[0])');
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rowBox[0], y: rowBox[1], id: 1 }] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(400);
  console.log('row tap produced quip:', await evalJs('document.getElementById("shopSay").textContent.slice(0,40)'));

  /* craft grid fits */
  console.log('open craft:', await evalJs('NEU.shop.close(); NEU.craft.open(); !document.getElementById("craft").hidden'));
  await sleep(400);
  console.log('craft grid fits:', await evalJs('(function(){var g=document.querySelector(".craft__grid");return g? g.scrollWidth<=innerWidth : null})()'));
  console.log('craft cell px:', await evalJs('(function(){var c=document.querySelector(".craft__cell");return c? Math.round(c.getBoundingClientRect().width):null})()'));

  console.log('runtime errors:', JSON.stringify(
    events.filter(e => /Exception|error/i.test(e.method))
          .map(e => (e.params.exceptionDetails && e.params.exceptionDetails.exception && e.params.exceptionDetails.exception.description) || e.params.text || e.method)));

  if (SHOT) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(SHOT, Buffer.from(shot.data, 'base64'));
    console.log('screenshot:', SHOT);
  }
  ws.close();
} finally {
  proc.kill();
}
process.exit(0);
