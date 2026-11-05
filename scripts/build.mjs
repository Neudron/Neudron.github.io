/* Build the publishable site.
   Source stays exactly as the game/tests know it; dist rewrites the shell so
   the portfolio paints from a small bundle and the game arrives on demand. */
import { build, transform } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const read = (p) => fs.readFile(path.join(ROOT, p), 'utf8');
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 10);
const exists = async (p) => { try { await fs.access(p); return true; } catch { return false; } };

const SHELL = [
  'js/core/motion.js', 'js/data/data.js', 'js/page/main.js', 'js/page/stars.js',
  'js/core/quest.js', 'js/core/save.js', 'js/core/keys.js', 'js/core/juice.js',
  'js/game/sword.js', 'js/game/sans.js', 'js/core/music.js', 'js/core/perf.js',
  'js/core/settings.js', 'js/core/touch.js', 'js/core/dev.js'
];
const GAME = [
  'js/core/danmaku.js', 'js/data/sheets.js', 'js/core/engine-look.js',
  'js/core/engine-doors.js', 'js/core/engine-kinds.js', 'js/core/engine.js',
  'js/game/bullet.js', 'js/game/dark.js', 'js/act4/act4.js',
  'js/act4/look-woods.js', 'js/act4/look-castle.js', 'js/act4/rooms-a.js',
  'js/act4/summon.js', 'js/act4/look-city.js', 'js/act4/rooms-d.js',
  'js/act4/shop.js', 'js/act4/scal-attacks.js', 'js/act4/boss-scal.js',
  'js/act4/scal-worm.js', 'js/act4/scal-seekers.js', 'js/act4/look-prize.js',
  'js/act4/rooms-g.js', 'js/act4/quiz.js', 'js/act4/rhythm.js',
  'js/act4/craft.js', 'js/act4/boss-polt.js', 'js/act4/crack.js',
  'js/act4/inventory.js', 'js/game/deck.js'
];
const FILES = [
  '404.html', 'CNAME', '.nojekyll', 'og.png', 'robots.txt', 'sitemap.xml',
  'llms.txt', 'humans.txt', 'manifest.json', 'apple-touch-icon.png', 'icon-512.png'
];
const DIRS = ['fonts', 'img', 'audio', '.well-known'];

async function concat(files) {
  const parts = [];
  for (const f of files) parts.push('/* ' + f + ' */\n' + await read(f));
  return parts.join('\n;\n');
}

function assertBundleCoverage(html) {
  const sourceScripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)]
    .map((m) => m[1].split(/[?#]/, 1)[0].replace(/^(?:\/|\.\/)+/, ''));
  const groups = [
    ['shell', SHELL],
    ['game', GAME],
    ['scene', ['js/page/scene.js']]
  ];
  const planned = groups.flatMap(([, files]) => files);
  const duplicates = (files) => files.filter((f, i) => files.indexOf(f) !== i);
  const issues = [];
  const duplicateTags = duplicates(sourceScripts);
  const duplicatePlan = duplicates(planned);
  const unassigned = sourceScripts.filter((f) => !planned.includes(f));
  const absent = planned.filter((f) => !sourceScripts.includes(f));

  if (duplicateTags.length) issues.push('duplicate script tags: ' + duplicateTags.join(', '));
  if (duplicatePlan.length) issues.push('listed more than once in build groups: ' + duplicatePlan.join(', '));
  if (unassigned.length) issues.push('not assigned to SHELL, GAME, or scene: ' + unassigned.join(', '));
  if (absent.length) issues.push('listed in build groups but absent from index.html: ' + absent.join(', '));

  for (const [name, files] of groups.slice(0, 2)) {
    const inSource = sourceScripts.filter((f) => files.includes(f));
    if (inSource.join('\n') !== files.join('\n'))
      issues.push(name + ' bundle order differs from index.html');
  }

  if (issues.length) {
    throw new Error('Source scripts and production bundle groups are out of sync:\n- ' +
      issues.join('\n- ') + '\nUpdate index.html and the SHELL/GAME lists in scripts/build.mjs.');
  }
}

async function writeAsset(dir, name, bytes) {
  await fs.mkdir(path.join(DIST, dir), { recursive: true });
  await fs.writeFile(path.join(DIST, dir, name), bytes);
  return name;
}

async function main() {
  let html = await read('index.html');
  assertBundleCoverage(html);

  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(path.join(DIST, 'assets'), { recursive: true });
  await fs.mkdir(path.join(DIST, 'css'), { recursive: true });

  /* code split at the two seams the browser needs */
  const gameSrc = await concat(GAME);
  const gameMin = (await transform(gameSrc, { minify: true, target: 'es2018', legalComments: 'none' })).code;
  const gameName = 'game.' + hash(gameMin) + '.js';
  await writeAsset('assets', gameName, gameMin);

  const prelude = await read('scripts/prelude.js');
  const shellSrc = 'window.__NEU_GAME_URL__ = "assets/' + gameName + '";\n' +
    prelude + '\n;\n' + await concat(SHELL);
  const shellMin = (await transform(shellSrc, { minify: true, target: 'es2018', legalComments: 'none' })).code;
  const shellName = 'shell.' + hash(shellMin) + '.js';
  await writeAsset('assets', shellName, shellMin);

  const scene = await build({
    absWorkingDir: ROOT,
    entryPoints: ['js/page/scene.js'],
    outdir: path.join(DIST, 'assets'),
    entryNames: 'scene.[hash]',
    chunkNames: 'scene-chunk-[hash]',
    bundle: true,
    splitting: true,
    format: 'esm',
    target: 'es2022',
    minify: true,
    legalComments: 'none',
    metafile: true,
    logLevel: 'silent'
  });
  const entry = Object.keys(scene.metafile.outputs).find((f) => /assets\/scene\.[A-Z0-9]+\.js$/.test(f));
  if (!entry) throw new Error('scene entry missing from esbuild output');
  const sceneName = path.basename(entry);

  /* css keeps its own directory so ../fonts and ../img still resolve */
  for (const [src, out] of [['css/style.css', 'style'], ['css/game.css', 'game']]) {
    const css = (await transform(await read(src), { loader: 'css', minify: true })).code;
    await writeAsset('css', out + '.' + hash(css) + '.css', css);
  }
  const styleName = (await fs.readdir(path.join(DIST, 'css'))).find((f) => f.startsWith('style.'));
  const gameCssName = (await fs.readdir(path.join(DIST, 'css'))).find((f) => f.startsWith('game.'));

  for (const f of FILES) if (await exists(path.join(ROOT, f))) await fs.cp(path.join(ROOT, f), path.join(DIST, f));
  await fs.writeFile(path.join(DIST, '.nojekyll'), '');
  /* Publish tracked web assets only: ignored notes (for example
     .well-known/README.md) must never reach Pages. */
  for (const d of DIRS) {
    if (!(await exists(path.join(ROOT, d)))) continue;
    const list = execFileSync('git', ['ls-files', '-z', '--', d], { cwd: ROOT, encoding: 'utf8' });
    for (const f of list.split('\0')) {
      if (!f) continue;
      await fs.mkdir(path.dirname(path.join(DIST, f)), { recursive: true });
      await fs.cp(path.join(ROOT, f), path.join(DIST, f));
    }
  }

  html = html.replace(/\n<link rel="preconnect" href="https:\/\/cdn\.jsdelivr[^>]*>\n/, '\n');
  const imStart = html.indexOf('<!-- integrity:');
  const imTag = html.indexOf('<script type="importmap">');
  if (imStart < 0 || imTag < 0) throw new Error('import map block not found');
  const imEnd = html.indexOf('</script>', imTag) + '</script>'.length;
  html = html.slice(0, imStart) + html.slice(imEnd);
  html = html.replace('href="css/style.css"', 'href="css/' + styleName + '"')
             .replace('href="css/game.css"', 'href="css/' + gameCssName + '"');
  const classicStart = html.indexOf('<script src="js/core/motion.js"></script>');
  const classicEndTag = '<script src="js/core/dev.js"></script>';
  const classicEnd = html.indexOf(classicEndTag);
  if (classicStart < 0 || classicEnd < 0) throw new Error('classic script block not found');
  html = html.slice(0, classicStart) +
    '<script src="assets/' + shellName + '"></script>' +
    html.slice(classicEnd + classicEndTag.length);
  if (!html.includes('<script type="module" src="js/page/scene.js"></script>')) throw new Error('scene tag not found');
  html = html.replace('<script type="module" src="js/page/scene.js"></script>',
    '<script type="module" src="assets/' + sceneName + '"></script>');
  await fs.writeFile(path.join(DIST, 'index.html'), html);

  console.log('dist ready');
  console.log('  shell', shellName, (shellMin.length / 1024).toFixed(1) + 'K raw');
  console.log('  game ', gameName, (gameMin.length / 1024).toFixed(1) + 'K raw');
  console.log('  scene', sceneName, ((await fs.stat(path.join(DIST, 'assets', sceneName))).size / 1024).toFixed(1) + 'K raw');
}

main().catch((e) => { console.error(e); process.exit(1); });
