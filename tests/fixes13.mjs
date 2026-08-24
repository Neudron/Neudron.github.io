/* fixes13.mjs — Calamitas's art and her six sounds, plus the danmaku seam.
   Run: node fixes13.mjs

   Phase 4a + 5a of the plan. 2.1: every projectile, both brothers, the
   Sepulcher and the hearts come from the real sheets, drawn through a
   shared rotated sprite() helper, with the coloured-square fallback
   kept so a missing file degrades to the old look. 2.3: the six
   Calamity .ogg files are wired through the pooled-Audio pattern from
   sans.js. Also closes the deferred Phase 1 assertion and item 3.6. */

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };

function boot() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { pretendToBeVisual: true, url: 'https://www.neu.ac/',
                                runScripts: 'outside-only' });
  const w = dom.window;
  w.IntersectionObserver = class { constructor(cb){this.cb=cb;} observe(){} disconnect(){} };
  w.matchMedia = q => ({ matches: false, addListener(){}, addEventListener(){} });
  w.AudioContext = class {
    constructor(){ this.state='running'; this.currentTime=0; this.destination={}; this.sampleRate=44100; }
    createOscillator(){ return { type:'', frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}}, connect(){},start(){},stop(){} }; }
    createGain(){ return { gain:{setValueAtTime(){},exponentialRampToValueAtTime(){},value:0}, connect(){} }; }
    createBufferSource(){ return { buffer:null, connect(){},start(){},stop(){} }; }
    createBiquadFilter(){ return { type:'', frequency:{value:0}, Q:{value:0}, connect(){} }; }
    createBuffer(){ return { getChannelData: () => new Float32Array(64) }; }
  };
  w.HTMLMediaElement.prototype.play = () => Promise.resolve();
  const noop = () => {};
  w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {
    get(_, k) {
      if (k === 'canvas') return {};
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'createRadialGradient' || k === 'createLinearGradient')
        return () => ({ addColorStop: noop });
      if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (typeof k === 'string') return (...a) => {};
      return undefined;
    }, set(){ return true; }
  });
  w.scrollTo = noop;
  w.requestAnimationFrame = cb => w.setTimeout(() => cb(Date.now()), 0);
  w.Element.prototype.getBoundingClientRect = () =>
    ({ left:100, top:100, right:146, bottom:146, width:46, height:46, x:100, y:100 });

  for (const f of ['core/quest.js','core/save.js','core/juice.js','core/danmaku.js','data/sheets.js','core/engine.js',
                   'game/bullet.js','game/dark.js','game/sans.js','act4/act4.js','act4/rooms-a.js',
                   'act4/rooms-d.js','act4/rooms-g.js','act4/boss-scal.js','act4/quiz.js',
                   'act4/rhythm.js','act4/craft.js','act4/boss-polt.js','act4/crack.js',
                   'game/deck.js','core/settings.js','core/dev.js']) {
    const p = path.join(ROOT, 'js', f);
    if (!fs.existsSync(p)) { console.log('  !! missing ' + f); continue; }
    try { w.eval(fs.readFileSync(p, 'utf8')); }
    catch (e) { console.log('  !! ' + f + ': ' + e.message); }
  }
  return { w, NEU: w.NEU };
}
const read = f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
const SCAL = read('act4/boss-scal.js');
const BULL = read('game/bullet.js');

/* ═══ 1. the danmaku seam (deferred from Phase 1) ═════════════════*/
console.log('\n1. all three fights live on NEU.danmaku');
{
  ok('danmaku.js exists', fs.existsSync(path.join(ROOT, 'js', 'core', 'danmaku.js')));
  ok('danmaku exposes IFRAMES', /IFRAMES: 1\.1/.test(read('core/danmaku.js')));
  for (const f of ['game/bullet.js', 'act4/boss-scal.js', 'act4/boss-polt.js']) {
    const src = read(f);
    ok(f + ' has no local HEART array', !/var HEART\s*=/.test(src));
    ok(f + ' no local death-shatter', !/heartShatter|shatterHeart/.test(src));
  }
  ok('>>> bullet.js keeps no local IFRAMES <<<',
     !/var IFRAMES\s*=/.test(BULL));
  ok('it reads the shared one instead',
     /inv = dm\.IFRAMES \|\| 1\.15;/.test(BULL) &&
     (BULL.match(/inv = dm\.IFRAMES \|\| 1\.15;/g) || []).length === 3);
  ok('danmaku loads before bullet.js',
     read('../index.html').indexOf('danmaku.js') <
     read('../index.html').indexOf('bullet.js'));
}

/* ═══ 2. the art wiring ═══════════════════════════════════════════*/
console.log('\n2. Calamitas draws from her sheets');
{
  const { NEU } = boot();
  const keys = ['dart', 'hellblast', 'fireblast', 'gigablast',
                'cataclysm', 'catastrophe', 'sepulcher', 'heart', 'ashes'];
  keys.forEach(k => {
    ok('the sheet key "' + k + '" is referenced', SCAL.indexOf("'" + k + "'") >= 0);
  });
  ok('the projectile mapping names all four kinds',
     /var key = b\.k === 1 \? 'fireblast' : b\.k === 2 \? 'gigablast'\s*: b\.k === 3 \? 'hellblast' : 'dart'/.test(SCAL));
  ok('her body picks hooded in intro, body in fight',
     /var bodyKey = mode === 'intro' \? 'scalHood' : 'scal'/.test(SCAL));
  /* RE-SOURCED 2026-08-24: they draw their real NPC bodies now
     (SupremeCataclysm.png / SupremeCatastrophe.png), not their own
     thrown attacks — 'fist'/'slashTop' pointed at
     SupremeCataclysmFist.png / SupremeCatastropheSlashAlt.png, the
     PROJECTILES each brother throws, because the actual body art
     (confirmed present in the mod repo the whole time) had never been
     copied into the manifest under any key at all. That was the whole
     "brother attack sprites are broken" bug. */
  ok('the brothers pick cataclysm vs catastrophe body art by kind',
     /bKey = br\.kind === 'fist' \? 'cataclysm' : 'catastrophe'/.test(SCAL));
  ok('...with their own glow masks, additive, same as Polterghast',
     /bGlow = br\.kind === 'fist' \? \['cataclysmGlow'\] : \['catastropheGlow'\]/.test(SCAL));
  /* The blitter these three describe moved into data/sheets.js when
     three identical copies of it were collapsed into one — the copies
     were why a two-column sheet could not be declared, since each
     hardcoded source x to 0. The behaviour is unchanged, so each check
     now spans both halves: boss-scal still ASKS for rotation and glow,
     and the shared blitter still honours them. Grepping boss-scal.js
     alone would report all three gone because the lines live elsewhere. */
  const SHEETS = fs.readFileSync(path.join(ROOT, 'js', 'data', 'sheets.js'), 'utf8');
  ok('>>> the sprite helper exists <<<',
     /function sprite\(key, x, y, scale, rot, glow, col, frame, alpha, glowKeys\)/.test(SCAL) &&
     /NEU\.sheetDraw = function/.test(SHEETS));
  ok('it rotates to face travel', /ctx\.rotate\(o\.rot\)/.test(SHEETS) &&
     /Math\.atan2\(b\.vy, b\.vx\)/.test(SCAL));
  ok('the brothers rotate toward the player', /Math\.atan2\(py - br\.y, px - br\.x\)/.test(SCAL));
  ok('phase 2 still gets the additive glow',
     /globalCompositeOperation = 'lighter'/.test(SHEETS) && /if \(o\.glow\)/.test(SHEETS) &&
     /glow: glow/.test(SCAL));
  /* and the column that started all of this is addressable */
  ok('>>> a two-column sheet can say so <<<', /cols: 2/.test(SHEETS) &&
     /col \* sh\.fw/.test(SHEETS));

  /* the fallback: a missing sheet must draw the OLD squares, not
     nothing — a silent absence is mistaken for a logic bug. */
  ok('>>> the coloured-square fallback survives <<<',
     /if \(!sprite\(key, b\.x, b\.y/.test(SCAL) &&
     /ctx\.fillRect\(\(b\.x - b\.r\) \| 0/.test(SCAL));
  ok('hearts fall back to their square', /!sprite\('heart'/.test(SCAL) && /#C2405F/.test(SCAL));
  ok('sepulcher falls back', /!sprite\('sepulcher'/.test(SCAL));
  ok('her body falls back to MAGENTA', /#FF00A0/.test(SCAL));
  ok('the drop draws in won mode', /mode !== 'won'/.test(SCAL) &&
     /sprite\('ashes'/.test(SCAL));
  ok('the old drawSheet-by-object helper is gone', !/function drawSheet\(sh/.test(SCAL));

  /* every key resolves to a file on disk, via the booted manifest */
  keys.concat(['scal', 'scalHood']).forEach(k => {
    const sh = NEU.sheets && NEU.sheets[k];
    if (!sh) { ok('manifest has "' + k + '"', false); return; }
    ok('sheet "' + k + '" exists on disk (' + path.basename(sh.src) + ')',
       fs.existsSync(path.join(ROOT, sh.src)));
  });
}

/* ═══ 3. the six sounds ═══════════════════════════════════════════*/
console.log('\n3. her voice');
{
  const oggs = ['hellblast', 'fireblast', 'fireblast-hit', 'giga', 'giga-hit', 'maelstrom'];
  ok('the audio prefix is referenced', SCAL.indexOf("'audio/act4/'") >= 0);
  oggs.forEach(n => {
    ok('"' + n + '" is in the preload list', SCAL.indexOf("'" + n + "'") >= 0);
    ok('the file exists', fs.existsSync(path.join(ROOT, 'audio', 'act4', n + '.ogg')));
  });
  ok('>>> one pooled call site, four copies each <<<',
     (SCAL.match(/new Audio\(/g) || []).length === 1 &&
     /for \(var i = 0; i < 4; i\+\+\)[\s\S]{0,120}new Audio/.test(SCAL));
  ok('volume is set and modest', /a\.volume = 0\.5/.test(SCAL));
  ok('preload is auto', /a\.preload = 'auto'/.test(SCAL));
  ok('construction is guarded (no Audio in jsdom)', /catch \(e\) \{ pool = \[\]; \}/.test(SCAL));
  ok('play is guarded too', /catch \(e\) \{\}/.test(SCAL));

  /* each attack plays its own family */
  ok('fireblast plays its charge', /sfxPlay\('fireblast'\);[\s\S]{0,80}var b = \{ x: bx/.test(SCAL));
  ok('gigablast plays its charge', /sfxPlay\('giga'\)/.test(SCAL));
  ok('hellbarrage plays its charge', /sfxPlay\('hellblast'\)/.test(SCAL));
  ok('the walls play the maelstrom', /sfxPlay\('maelstrom'\)/.test(SCAL));
  ok('the ring burst plays the hit', /sfxPlay\('giga-hit'\)/.test(SCAL) &&
     /sfxPlay\('fireblast-hit'\)/.test(SCAL));
  ok('>>> pools are built when the fight opens, not at boot <<<',
     /preloadSfx\(\);/.test(SCAL) &&
     SCAL.indexOf('preloadSfx();') > SCAL.indexOf('function open()'));
  ok('sfxPlay is the only .play() in the file',
     (SCAL.match(/\.play\(/g) || []).length === 1);
}

/* ═══ 4. it still runs ════════════════════════════════════════════*/
console.log('\n4. the fight still boots and steps');
{
  const { w, NEU } = boot();
  ok('scal module present', !!NEU.scal);
  NEU.scal.open();
  ok('opens without throwing', NEU.scal.running === true);
  /* drive the frame loop a little — draw() now hits the sprite()
     path for bullets, hearts and brothers */
  for (let i = 0; i < 20; i++) {
    w.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'd' }));
    w.dispatchEvent(new w.KeyboardEvent('keyup', { key: 'd' }));
  }
  NEU.scal.close();
  ok('closes cleanly', NEU.scal.running === false);
}

/* ═══ 5. regression: phase transitions clear pending timers ═══════
   A gigablast mid-spread when she phases out would keep dropping
   bullets into the wall interlude without the clearSched() calls. */
{
  ok('>>> startWall clears pending timers <<<', /function startWall\(n\)\s*\{[\s\S]*?clearSched\(\)/.test(SCAL));
  ok('>>> win clears pending timers <<<', /function win\(\)[\s\S]*?clearSched\(\)/.test(SCAL));
  ok('>>> startDeath clears pending timers <<<', /function startDeath\(\)[\s\S]*?clearSched\(\)/.test(SCAL));
  ok('>>> startBrothers clears pending timers <<<', /function startBrothers\(\)[\s\S]*?clearSched\(\)/.test(SCAL));
  ok('later() replaces setTimeout in attack schedulers',
     /later\(function/.test(SCAL) && SCAL.indexOf('later(') < SCAL.indexOf('setTimeout(') || !/setTimeout\(function/.test(SCAL));
}

/* ═══ 6. regression: phase-2 charge is not a coin flip ═════════════
   The cycle is fixed ("twenty steps, exactly as in the game"). A
   Math.random() in the charge branch randomizes it. */
{
  /* The charge branch itself must stay deterministic; the fireblast
     pause later in the file legitimately rolls Math.random, so the
     lookahead is bounded to the branch. */
  ok('>>> no Math.random in the charge branch <<<',
     !/else if \(k === 'c'\) \{[\s\S]{0,600}?Math\.random/.test(SCAL));
}

console.log('\nfixes13: ' + pass + ' ok, ' + fail + ' fail');
process.exit(fail ? 1 : 0);