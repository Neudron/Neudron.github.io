#!/usr/bin/env node
/* scripts/dev.mjs — Phase 1 live-reload dev server (strangler plan).
 *
 * Static server over the repo root on 127.0.0.1, with SSE-driven live reload:
 *   - fs.watch (recursive) debounces ~200 ms, then broadcasts 'reload'.
 *   - 20 s heartbeat keeps the EventSource alive through proxies.
 *   - The reload snippet is injected ONLY into the served index.html.
 *   - On reload, the current scene + URL params are stashed in sessionStorage
 *     and re-applied after the page boots (best-effort via NEU.dev.run).
 *
 *   npm run dev            # http://127.0.0.1:3000 (PORT env overrides)
 *   PORT=4000 npm run dev
 *
 * Local-only: never shipped (not in build SHELL/GAME lists, not in CI).
 * # ponytail: no websocket, no HMR module graph — full page reload. Good
 * enough until Phase 2's kernel owns scene state.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 3000);
const IGNORE = new Set(['node_modules', '.git', 'dist', '.parity', 'memory']);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon', '.map': 'application/json' };

const clients = new Set();
let debounce = null;
function broadcast() {
  for (const res of clients) {
    try { res.write('event: reload\ndata: 1\n\n'); } catch { /* drop */ }
  }
}
function scheduleReload() {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => { debounce = null; broadcast(); }, 200);
}

// recursive watcher, pruned to ignored dirs
function watchDir(dir) {
  try { fs.watch(dir, { recursive: true }, (ev, name) => {
    if (!name) return;
    const parts = name.split(path.sep);
    if (parts.some((p) => IGNORE.has(p))) return;
    if (name.endsWith('.timings.json')) return;
    scheduleReload();
  }); } catch { /* platform without recursive watch: fall back below */ }
}
watchDir(ROOT);

const SNIPPET = `<script>
(function(){
  try {
    var scene = (window.NEU && (NEU.scene && NEU.scene.name) || (NEU.dark && NEU.dark.running && 'dark') || (NEU.bullet && NEU.bullet.running && 'bullet') || (NEU.deck && NEU.deck.running && 'deck'));
    if (scene) sessionStorage.setItem('neu:dev:scene', scene);
    sessionStorage.setItem('neu:dev:url', location.pathname + location.search + location.hash);
  } catch (e) {}
  var es = new EventSource('/__reload');
  es.addEventListener('reload', function () {
    try {
      var s = sessionStorage.getItem('neu:dev:scene');
      if (s) sessionStorage.setItem('neu:dev:pending', s);
    } catch (e) {}
    location.reload();
  });
  es.addEventListener('open', function () { /* connected */ });
  // restore best-effort after boot
  window.addEventListener('load', function () {
    setTimeout(function () {
      try {
        var pending = sessionStorage.getItem('neu:dev:pending');
        if (!pending) return;
        sessionStorage.removeItem('neu:dev:pending');
        if (window.NEU && NEU.dev && typeof NEU.dev.run === 'function') NEU.dev.run(pending);
      } catch (e) {}
    }, 400);
  });
  // 20s heartbeat is server-side; client just keeps the connection open.
})();
</script>`;

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/__reload') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache',
      'connection': 'keep-alive', 'access-control-allow-origin': '*' });
    res.write('retry: 1000\n\n');
    clients.add(res);
    const hb = setInterval(() => { try { res.write(': hb\n\n'); } catch { /* */ } }, 20000);
    req.on('close', () => { clearInterval(hb); clients.delete(res); });
    return;
  }
  let p = decodeURIComponent(url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return;
  }
  const ext = path.extname(f).toLowerCase();
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'no-store' });
  if (ext === '.html') {
    let src = fs.readFileSync(f, 'utf8');
    src = src.replace('</head>', SNIPPET + '</head>');
    res.end(src);
  } else {
    fs.createReadStream(f).pipe(res);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`dev: http://127.0.0.1:${PORT}  (SSE live reload on, Ctrl+C to stop)`);
});
server.on('error', (e) => { console.error('dev: ' + e.message); process.exit(1); });
process.on('SIGINT', () => { server.close(); process.exit(0); });
process.on('SIGTERM', () => { server.close(); process.exit(0); });
