/* Verify the publishable artifact before Pages ever sees it. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const read = (p) => fs.readFileSync(path.join(DIST, p), 'utf8');
const source = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(DIST, p));
const fail = (msg) => { console.error('FAIL ' + msg); process.exitCode = 1; };
const ok = (msg) => console.log('ok   ' + msg);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out); else out.push(path.relative(DIST, p).split(path.sep).join('/'));
  }
  return out;
}

const files = walk(DIST);
const byName = (re) => files.filter((f) => re.test(f));

/* 1. Every public URL and PWA/SEO surface survives. */
const required = [
  'index.html', '404.html', 'CNAME', '.nojekyll', 'robots.txt', 'sitemap.xml',
  'manifest.json', 'apple-touch-icon.png', 'icon-512.png', 'og.png',
  'humans.txt', 'llms.txt', '.well-known/discord'
];
for (const f of required) if (!exists(f)) fail('missing public file ' + f);
if (read('CNAME').trim() !== source('CNAME').trim()) fail('CNAME changed');
for (const f of ['404.html', 'robots.txt', 'sitemap.xml', 'manifest.json', 'humans.txt', 'llms.txt']) {
  if (exists(f) && read(f) !== source(f)) fail('public file changed: ' + f);
}
if (required.every(exists)) ok('public files, CNAME, 404, sitemap, robots, PWA, .well-known');

/* 2. The normal visit gets the shell and the glass scene only. */
const html = read('index.html');
const scriptTags = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
const shell = byName(/^assets\/shell\.[a-f0-9]+\.js$/);
const game = byName(/^assets\/game\.[a-f0-9]+\.js$/);
const scene = byName(/^assets\/scene\.[A-Z0-9]+\.js$/);
if (shell.length !== 1) fail('expected one shell bundle, got ' + shell.length);
if (game.length !== 1) fail('expected one game bundle, got ' + game.length);
if (scene.length !== 1) fail('expected one scene entry, got ' + scene.length);
if (scriptTags.length !== 2 || scriptTags[0] !== shell[0] || scriptTags[1] !== scene[0])
  fail('initial script tags must be exactly shell + scene: ' + scriptTags.join(', '));
if (/<link\b[^>]*rel="?(?:modulepreload|preload)"?[^>]*(?:game|js\/)/i.test(html))
  fail('game code is preloaded in index.html');
if (/cdn\.jsdelivr/.test(html)) fail('jsDelivr still referenced');
if (!/type="module" src="assets\/scene\./.test(html)) fail('scene entry is not a module');
if (game[0] && !read(shell[0]).includes(path.basename(game[0]))) fail('shell does not name the game chunk');
if (shell[0] && game[0] && scriptTags.every((s) => s !== game[0])) ok('normal visit loads shell + scene, never the game chunk');

/* 3. Private material, source trees, and superseded runtimes stay out. */
const banned = files.filter((f) =>
  /^(tests|memory|_scripts|node_modules|\.git|\.github|\.opencode|bench)\//.test(f) ||
  /\.(?:md|wasm|wat|ts|map)$/.test(f) || /(?:^|\/)(?:README|AGENTS|opencode\.json)/.test(f) ||
  /pixi/i.test(f));
if (banned.length) fail('private/superseded files in artifact: ' + banned.join(', '));
else ok('artifact excludes tests, notes, scripts, node_modules, source maps, Wasm, Pixi');
if (!files.includes('assets/' + path.basename(game[0]))) fail('game chunk missing');
else ok('game chunk exists but is not in the initial HTML');

/* 4. HTML keeps every anchor, id, external link, and canonical URL. */
const ids = (s) => new Set([...s.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
const srcIds = ids(source('index.html'));
const lostIds = [...srcIds].filter((id) => !html.includes('id="' + id + '"'));
if (lostIds.length) fail('ids lost: ' + lostIds.join(', '));
const hashes = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
const dangling = hashes.filter((h) => !html.includes('id="' + h + '"'));
if (dangling.length) fail('dangling in-page anchors: ' + dangling.join(', '));
const srcExternal = [...source('index.html').matchAll(/href="(https:\/\/[^"]+)"/g)]
  .map((m) => m[1]).filter((u) => !u.startsWith('https://cdn.jsdelivr.net'));
const lostLinks = srcExternal.filter((u) => !html.includes('href="' + u + '"'));
if (lostLinks.length) fail('external links lost: ' + lostLinks.join(', '));
if (!lostIds.length && !dangling.length && !lostLinks.length)
  ok('all ids, anchors, external links, canonical URL preserved');

/* 5. Local hrefs resolve. */
const local = [...html.matchAll(/href="([^"#?:]+)"/g)].map((m) => m[1]);
for (const h of new Set(local)) {
  if (!exists(h) && !exists(h.replace(/\/$/, '') + '/index.html')) fail('broken local href: ' + h);
}
if (!process.exitCode) ok('every local href resolves inside dist');

/* 6. Manifest icons and saved-game schema are still real. */
const man = JSON.parse(read('manifest.json'));
for (const icon of man.icons || []) {
  const p = String(icon.src || '').replace(/^\//, '');
  if (!exists(p)) fail('manifest icon missing: ' + icon.src);
}
if (!/neu\.save\.v1/.test(read(shell[0]))) fail('save key missing from shell bundle');
else ok('manifest icons resolve; save key neu.save.v1 is in the shell bundle');

/* 7. Allowlist: nothing unknown, nothing huge. */
const rootAllowed = new Set(['index.html', '404.html', 'CNAME', '.nojekyll', 'og.png', 'robots.txt',
  'sitemap.xml', 'llms.txt', 'humans.txt', 'manifest.json', 'apple-touch-icon.png', 'icon-512.png']);
const unknown = files.filter((f) =>
  !rootAllowed.has(f) && !/^assets\/(?:shell|game)\.[a-f0-9]+\.js$/.test(f) &&
  !/^assets\/scene(?:-chunk)?[-.][A-Z0-9]+\.js$/.test(f) && !/^css\/[a-z]+\.[a-f0-9]+\.css$/.test(f) &&
  !/^(?:fonts|img|audio|\.well-known)\//.test(f));
if (unknown.length) fail('files outside the artifact allowlist: ' + unknown.join(', '));
else ok('artifact file allowlist clean (' + files.length + ' files)');

const gz = (f) => gzipSync(fs.readFileSync(path.join(DIST, f)), { level: 9 }).length;
const kb = (n) => (n / 1024).toFixed(1) + 'K';
for (const f of [shell[0], game[0], scene[0], 'index.html']) {
  if (!f) continue;
  console.log('     ' + f.padEnd(34) + kb(fs.statSync(path.join(DIST, f)).size).padStart(8) +
    ' raw  ' + kb(gz(f)).padStart(8) + ' gzip');
}
if (fs.statSync(path.join(DIST, game[0])).size > 1500 * 1024) fail('game chunk over 1.5MB');
if (fs.statSync(path.join(DIST, shell[0])).size > 400 * 1024) fail('shell chunk over 400KB');

if (process.exitCode) { console.error('\nARTIFACT VERIFY FAILED'); process.exit(1); }
console.log('\nARTIFACT VERIFY PASS');
