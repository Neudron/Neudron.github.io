/* fixes18.mjs — SC Calamitas fight fixes + minigame exit consistency.
   Run: node fixes18.mjs

   Closes the outstanding rows from the 19-bug sweep:
    - the worm had no body (unregistered sheets, head-only render)
    - hearts orbited the head instead of the body
    - every wall beat fired the first wall's triple (dirs[wallN])
    - the sepulcher drifted instead of charging; no telegraph
    - no contact damage anywhere (SC or worm)
    - dart bursts were one per attack with a static gap (stand-still safe)
    - the fireblast never paused before bursting
    - the brothers' barrage never paused or swapped sides
    - getScalAnim showed invented poses (real bands: 6 frames per FrameType)
    - the witch wore Sans's face (FACE lacked witch; unknown speakers kept
      the previous face), dialogs restarted on re-press, ESC was blocked
      mid-fight, quit buttons bypassed the confirm ESC asks for, and the
      dead engQuit button did nothing. */

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };
const read = f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const MODULES = [
  'core/quest.js', 'core/save.js', 'core/juice.js', 'core/danmaku.js',
  'data/sheets.js', 'core/engine.js', 'game/sword.js', 'game/sans.js',
  'game/bullet.js', 'game/dark.js', 'act4/act4.js', 'act4/rooms-a.js',
  'act4/rooms-d.js', 'act4/boss-scal.js', 'act4/rooms-g.js', 'act4/quiz.js',
  'act4/rhythm.js', 'act4/craft.js', 'act4/boss-polt.js', 'act4/crack.js',
  'game/deck.js', 'core/music.js', 'core/perf.js', 'core/settings.js', 'core/touch.js',
  'core/dev.js'
];

function boot() {
  const dom = new JSDOM(HTML, { pretendToBeVisual: true, url: 'https://www.neu.ac/',
                                runScripts: 'outside-only' });
  const w = dom.window;
  w.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe() {} disconnect() {} };
  w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
  w.AudioContext = class {
    constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 44100; this.destination = {}; }
    resume() {}
    createOscillator() { return { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, detune: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
    createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} }, connect() {} }; }
    createBufferSource() { return { buffer: null, connect() {}, start() {}, stop() {} }; }
    createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {} }; }
    createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
  };
  w.webkitAudioContext = w.AudioContext;
  w.HTMLMediaElement.prototype.play = () => Promise.resolve();
  const noop = () => {};
  w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {
    get(_, k) {
      if (k === 'canvas') return {};
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'createRadialGradient' || k === 'createLinearGradient')
        return () => ({ addColorStop: noop });
      if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (typeof k === 'string') return () => {};
      return undefined;
    }, set() { return true; }
  });
  w.scrollTo = noop;
  w.requestAnimationFrame = cb => w.setTimeout(() => cb(Date.now()), 0);
  w.Element.prototype.getBoundingClientRect = () =>
    ({ left: 100, top: 100, right: 146, bottom: 146, width: 46, height: 46, x: 100, y: 100 });

  for (const f of MODULES) {
    const p = path.join(ROOT, 'js', f);
    if (!fs.existsSync(p)) { console.log('  !! missing ' + f); continue; }
    try { w.eval(fs.readFileSync(p, 'utf8')); }
    catch (e) { console.log('  !! ' + f + ': ' + e.message); }
  }
  return { w, NEU: w.NEU, dom };
}

const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 9000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (fn()) return true;
    await wait(25);
  }
  return false;
};
/* dispatched on document so it reaches document-level listeners
     (the confirm overlay) and bubbles up to the window handlers */
const key = (w, k) => w.document.dispatchEvent(new w.KeyboardEvent('keydown',
  { key: k, bubbles: true, cancelable: true }));
/* IHDR: width/height live at fixed offsets in any PNG */
const pngDims = p => {
  const b = fs.readFileSync(path.join(ROOT, p));
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

/* ═══ 1. the worm has a body now ═══════════════════════════════════*/
console.log('\n1. sepulcher sheets + worm body');
{
  const S = read('data/sheets.js');
  ok('sepulBody registered', /sepulBody:\s*\{[^}]*SepulcherBody\.png/.test(S));
  ok('sepulBodyAlt registered', /sepulBodyAlt:\s*\{[^}]*SepulcherBodyAlt\.png/.test(S));
  ok('sepulTail registered', /sepulTail:\s*\{[^}]*SepulcherTail\.png/.test(S));
  const [bw, bh] = pngDims('img/act4/calamity/SepulcherBody.png');
  const [aw, ah] = pngDims('img/act4/calamity/SepulcherBodyAlt.png');
  const [tw, th] = pngDims('img/act4/calamity/SepulcherTail.png');
  ok('Body file is 82x72', bw === 82 && bh === 72);
  ok('BodyAlt file is 86x82', aw === 86 && ah === 82);
  ok('Tail file is 54x54', tw === 54 && th === 54);

  const B = read('act4/boss-scal.js');
  ok('spawn seeds a trail (initial straight body)',
     /sep\.trail\.push\(\{ x: sep\.x, y: sep\.y - k \* 1\.5 \}\)/.test(B));
  ok('trail records only while moving', /hypot\(sep\.vx, sep\.vy\) > 1/.test(B));
  ok('wormSegments walks the trail at 66px spacing', /budget = 66/.test(B));
  ok('segments computed every tick', /sep\.segs = wormSegments\(\)/.test(B));
  ok('draw renders alternating body sprites', /sKey = s % 2 \? 'sepulBodyAlt' : 'sepulBody'/.test(B));
  ok('tail drawn at the trail end', /sprite\('sepulTail'/.test(B));
}

/* ═══ 2. hearts on the body, not the head ═════════════════════════*/
console.log('\n2. hearts orbit a body segment');
{
  const B = read('act4/boss-scal.js');
  ok('hearts anchor to body segments 1..3, not the head', /si = Math\.min\(4, 2 \+ \(\(h\.offset \/ 2\) \| 0\)\)/.test(B));
  ok('>>> hearts never referenced the head position <<<',
     !/h\.x = sep\.x \+ Math\.cos\(hang\) \* hrad/.test(B));
}

/* ═══ 3. the wall fires per-beat, not per-wall ════════════════════*/
console.log('\n3. wallTick dirs[beat]');
{
  const B = read('act4/boss-scal.js');
  ok('>>> wall patterns keyed on the beat <<<',
     /\[\['d','r','l'\], \['u','r'\], \['d','l','r'\]\]\[beat\]/.test(B));
  ok('the wallN indexing is gone', !/\]\[wallN\]/.test(B));
}

/* ═══ 4. the fight actually plays ═════════════════════════════════*/
console.log('\n4. SC fight flow: intro -> wall -> sepulcher');
{
  const { w, NEU } = boot();
  NEU.scal.open();
  ok('starts in intro', NEU.scal.mode === 'intro');
  ok('>>> intro ends and the wall starts <<<', await until(() => NEU.scal.mode === 'wall'));
  ok('>>> the wall ends and the sepulcher spawns with 6 hearts <<<',
     await until(() => NEU.scal.mode === 'fight' && NEU.scal.hearts === 6));
  NEU.scal.close();
}

/* ═══ 5. ESC mid-fight now confirms (it used to be dead) ══════════*/
console.log('\n5. ESC works mid-fight, with a confirm');
{
  const { w, NEU } = boot();
  const doc = w.document;
  NEU.scal.open();
  await until(() => NEU.scal.mode === 'fight' && NEU.scal.hearts === 6);
  key(w, 'Escape');
  ok('>>> ESC mid-fight raises the confirm overlay <<<', !!doc.getElementById('confirmExit'));
  key(w, 'Enter');
  ok('Enter accepts: overlay gone', !doc.getElementById('confirmExit'));
  ok('and the fight is closed', NEU.scal.active === false);
  ok('>>> the wrapper is hidden <<<', doc.getElementById('bh').hidden === true);
}

/* ═══ 6. the shared quit button routes by game ════════════════════*/
console.log('\n6. bhQuit belongs to whoever is playing');
{
  const { w, NEU } = boot();
  const doc = w.document;
  const quit = doc.getElementById('bhQuit');

  /* SC up: the bullet minigame's handler must stand down and SC's must
     confirm, not close straight out. */
  NEU.scal.open();
  await until(() => NEU.scal.mode === 'fight' && NEU.scal.hearts === 6);
  quit.click();
  ok('>>> SC fight: bhQuit raises the confirm overlay <<<', !!doc.getElementById('confirmExit'));
  ok('and does NOT close the fight behind it', NEU.scal.active === true);
  key(w, 'Escape');
  ok('Escape declines: no overlay', !doc.getElementById('confirmExit'));
  ok('fight still up', NEU.scal.active === true);
  NEU.scal.close();

  /* Bullet up: its own handler confirms like ESC. */
  NEU.bullet.open();
  quit.click();
  ok('bullet: bhQuit raises the confirm overlay', !!doc.getElementById('confirmExit'));
  ok('bullet is still running behind it', NEU.bullet.running === true);
  key(w, 'Enter');
  ok('bullet: Enter accepts and closes', NEU.bullet.running === false);
}

/* ═══ 7. the hint follows the fight ═══════════════════════════════*/
console.log('\n7. bh__keys says what the active game does');
{
  const { w, NEU } = boot();
  const doc = w.document;
  const hint = doc.querySelector('#bh .bh__keys');
  NEU.scal.open();
  await until(() => NEU.scal.mode === 'fight' && NEU.scal.hearts === 6);
  ok('>>> SC fight: no "survive 20s" on her wrapper <<<', !/survive 20s/.test(hint.textContent));
  ok('and her controls are listed', /f to strike/.test(hint.textContent) && /z for rage/.test(hint.textContent) && /x to shield/.test(hint.textContent) && /esc to leave/.test(hint.textContent));
  NEU.scal.close();
  ok('>>> the bullet hint comes back <<<', /survive 20s/.test(hint.textContent));
}

/* ═══ 8. the sepulcher charges, and contact damage exists ═════════*/
console.log('\n8. charge + contact damage');
{
  const B = read('act4/boss-scal.js');
  ok('sepulcher telegraphs before dashing', /sep\.telegraph = 0\.35/.test(B));
  ok('the dash is a lunge, not a drift', /Math\.cos\(a2\) \* 340/.test(B));
  ok('>>> a shared hitPlayer exists <<<', /function hitPlayer\(\)/.test(B));
  ok('bullets route through hitPlayer', /rr \* rr && hitPlayer\(\)\) return;/.test(B));
  ok('>>> SC contact damage only while telegraph/dash <<<',
     /\(chargeTelegraph > 0 \|\| chargeT > 0\)/.test(B) && /Math\.hypot\(px - bx, py - by\) < 34/.test(B));
  ok('sepulcher contact only while dashing', /sep && sep\.chargeT > 0/.test(B));
  ok('>>> no contact damage while idle: the touch radius check is guarded <<<',
     !/&& \|\| true/.test(B));
}

/* ═══ 9. dart bursts: 3-4 per attack, gap walks ═══════════════════*/
console.log('\n9. dart pattern is no longer stand-still-safe');
{
  const B = read('act4/boss-scal.js');
  ok('>>> 3-4 bursts per attack <<<', /var bursts = 3 \+ \(Math\.random\(\) \* 2 \| 0\)/.test(B));
  ok('bursts are spaced ~340ms apart', /b \* 340/.test(B));
  ok('>>> the gap moves deterministically between bursts <<<',
     /var hole = Math\.floor\(span \/ n \* 1\.5 \* k\) % n/.test(B));
  ok('the random-hole version is gone', !/if \(i === \(Math\.random\(\) \* n\) \| 0\) continue/.test(B));
}

/* ═══ 10. fireblast pauses before it bursts ═══════════════════════*/
console.log('\n10. fireblast holds the beat');
{
  const B = read('act4/boss-scal.js');
  ok('>>> fireblast enters a pause state at range <<<', /b\.pauseT = 0\.55 \+ Math\.random\(\) \* 0\.25/.test(B));
  ok('>>> and stands still while paused <<<', /if \(b\.pauseT\) \{/.test(B) && /b\.vx = 0; b\.vy = 0;/.test(B));
  ok('gigablast still bursts on proximity', /b\.k === 2/.test(B) && /dist < reach/.test(B));
}

/* ═══ 11. brothers barrage, pause, swap sides ═════════════════════*/
console.log('\n11. brothers take a breath');
{
  const B = read('act4/boss-scal.js');
  ok('>>> volleys are counted and capped <<<', /b\.volley >= \(b\.enraged \? 2 : 5\)/.test(B));
  ok('>>> and end in a pause <<<', /b\.barrageCd = b\.enraged \? 0\.9 : 1\.2/.test(B));
  ok('>>> the pause swaps their sides <<<', /b\.side \*= -1/.test(B) && /AX \+ AW - 60/.test(B));
  ok('brothers still enrage', /bros\[0\]\.enraged = true/.test(B));
  ok('>>> phase 2 still arrives after they fall <<<', /phase = 2; mode = 'fight'/.test(B));
  ok('>>> and the cycle pauses for the laugh <<<', /stepT = 1\.0; \/\* the laugh is the interlude/.test(B));
}

/* ═══ 12. getScalAnim uses the real row bands ═════════════════════*/
console.log('\n12. frame mapping follows the mod source');
{
  const B = read('act4/boss-scal.js');
  ok('>>> bands table carries all seven FrameTypes <<<',
     /idle:.*\{ t: 0, fps: 4 \}/.test(B) &&
     /gigablast:.*\{ t: 3, fps: 10 \}/.test(B) &&
     /gigablast_p2:.*\{ t: 4, fps: 10 \}/.test(B) &&
     /hellblast:.*\{ t: 5, fps: 10 \}/.test(B) &&
     /hellblast_p2:.*\{ t: 6, fps: 10 \}/.test(B));
  ok('>>> band 3 wraps into column 1 (frame.Y 21-41) <<<',
     /var fy = b\.t \* 6 \+ c;\s*var fy = b\.t \* 6 \+ c/.test(B) ||
     /return \{ frame: fy % 21, col: \(fy \/ 21\) \| 0 \}/.test(B));
  ok('the invented switch mapping is gone', !/f = 4 \+ \(\(scalAnimTimer \* fps\) % 4\); col = 1/.test(B));
  ok('attacks name their pose: gigablast', /scalAnimState = 'gigablast'/.test(B));
  ok('attacks name their pose: hellblast', /scalAnimState = 'hellblast'/.test(B));
  ok('attacks name their pose: casting', /scalAnimState = 'casting'/.test(B));
  ok('phase 2 swaps to the punch poses', /st === 'gigablast' && phase === 2/.test(B));
}

/* ═══ 13. the witch has a face and strangers have none ════════════*/
console.log('\n13. faces follow the voice');
{
  const { w, NEU } = boot();
  const doc = w.document;
  const face = doc.getElementById('tboxFace');
  const img = doc.getElementById('tboxFaceImg');

  const [fw, fh] = pngDims('img/act4/witch-face.png');
  ok('>>> the witch face crop exists (40x40) <<<', fw === 40 && fh === 40);
  ok('FACE knows the witch', /witch: 'img\/act4\/witch-face\.png'/.test(read('game/sans.js')));

  NEU.talk(['a line from the witch.'], 'witch');
  ok('>>> the witch shows her face <<<', face.hidden === false);
  ok('and the image is hers', /witch-face\.png/.test(img.getAttribute('src') || ''));

  NEU.talk(['narration.'], 'narr');
  ok('>>> narration shows nothing <<<', face.hidden === true);

  NEU.talk(['a stranger speaks.'], 'stranger');
  ok('>>> an unknown speaker no longer wears Sans\'s face <<<', face.hidden === true);
}

/* ═══ 14. talkWatch: progress out, silence on interrupt ═══════════*/
console.log('\n14. dialogue progress is observable');
{
  const { w, NEU } = boot();
  const seen = [];
  NEU.talkWatch((i, t) => seen.push([i, t]));
  NEU.talk(['one.', 'two.', 'three.'], 'narr');
  await wait(120);
  ok('>>> the watcher is told which line is showing <<<', seen.length >= 1 && seen[0][1] === 3);
  NEU.hush();
  await wait(10);
  ok('>>> and that the talk was cut short <<<', seen[seen.length - 1][0] === -1);
  ok('tboxOpen reports the closed box', NEU.tboxOpen() === false);
}

/* ═══ 15. dialogs resume where they were abandoned ════════════════*/
console.log('\n15. dialog resume + E-during-talk is dead');
{
  const E = read('core/engine.js');
  ok('>>> re-interacting mid-talk is a no-op <<<', /NEU\.tboxOpen && NEU\.tboxOpen\(\)\) return/.test(E));
  ok('>>> progress is keyed per room and entity <<<', /var dk = 'd:' \+ room\.id \+ ':' \+ e\.x \+ ',' \+ e\.y/.test(E));
  ok('>>> resumed talks start at the abandoned line <<<', /base\.slice\(at\)\.concat\(e\.close \|\| \['\.\.\.'\]\)/.test(E));
  ok('>>> fully-read talks replay whole <<<', /seen >= total \? 0 : seen/.test(E));
}

/* ═══ 16. every quit button matches its ESC ═══════════════════════*/
console.log('\n16. quit buttons agree with ESC');
{
  const bullet = read('game/bullet.js');
  ok('>>> bullet: bhQuit confirms like ESC <<<', /confirmExit\('Bullet Hell', close\)/.test(bullet));
  ok('bullet: bhQuit steps down when SC is up',
     /if \(NEU\.activeMinigame !== 'bullet'\) return/.test(bullet));
  const polt = read('act4/boss-polt.js');
  ok('>>> polt: poltQuit confirms like ESC <<<', /confirmExit\('Polterghast', close\)/.test(polt));
  const quiz = read('act4/quiz.js');
  ok('>>> quiz: quizQuit confirms like ESC <<<', /confirmExit\('Quiz', close\)/.test(quiz));
  const rhythm = read('act4/rhythm.js');
  ok('>>> rhythm: fnfQuit confirms like ESC <<<', /confirmExit\('Rhythm Game', close\)/.test(rhythm));
  const craft = read('act4/craft.js');
  ok('craft stays direct (nothing lost)', /engine\.enter\('h3_trip'/.test(craft) && !/confirmExit/.test(craft));
  const dark = read('game/dark.js');
  ok('dark stays direct (nothing lost)', !/confirmExit/.test(dark));
  const deck = read('game/deck.js');
  ok('deck stays direct (nothing lost)', !/confirmExit/.test(deck));
  const E = read('core/engine.js');
  ok('>>> the dead engQuit button is wired to leave <<<',
     /engQuitBtn\.addEventListener\('click'/.test(E) && /leave\(\)/.test(E));
}

/* ═══ 17. regression: shared-#bh guard, Enter never crosses games ══*/
console.log('\n17. game routing guard');
{
  const B = read('act4/boss-scal.js');
  ok('>>> SC listens only while it is the active minigame <<<',
     /NEU\.activeMinigame !== 'scal'\) return/.test(B));
  ok('>>> SC wires its own bhQuit handler <<<', /bhQuitBtn\.addEventListener/.test(B));
  const b2 = read('game/bullet.js');
  ok('>>> bullet close no longer bleeds into SC <<<', /NEU\.activeMinigame !== 'bullet'\) return/.test(b2));
}

/* ═══ 17b. regression: every room-level overlay claims the input ══*/
/* The shop, rhythm, craft, and polt overlays all open while the room
   is still running. Without a claim, one Escape reached BOTH handlers:
   the overlay asked "leave?" while the engine had already left the
   room underneath — declining stranded you in a dead room, and shop's
   close() crashed on an API that only rooms get (engine.busy). */
console.log('\n17b. overlays claim activeMinigame');
{
  const S = read('act4/shop.js');
  ok('>>> shop claims input on open <<<', /NEU\.activeMinigame = 'shop'/.test(S));
  ok('shop releases its own claim on close',
     /NEU\.activeMinigame === 'shop'\) NEU\.activeMinigame = null/.test(S));
  ok('>>> shop close no longer calls the rooms-only busy() <<<', !/engine\.busy/.test(S));

  const R = read('act4/rhythm.js');
  ok('>>> rhythm claims input on open <<<', /NEU\.activeMinigame = 'rhythm'/.test(R));
  ok('rhythm releases before re-entering the room',
     R.indexOf("=== 'rhythm') NEU.activeMinigame = null") < R.indexOf("engine.enter('d1_street'"));

  const C = read('act4/craft.js');
  ok('>>> craft claims input on open <<<', /NEU\.activeMinigame = 'craft'/.test(C));
  ok('craft releases its own claim on close',
     /NEU\.activeMinigame === 'craft'\) NEU\.activeMinigame = null/.test(C));

  const P = read('act4/boss-polt.js');
  ok('>>> polt claims input on open <<<', /NEU\.activeMinigame = 'polt'/.test(P));
  ok('polt releases its own claim on close',
     /NEU\.activeMinigame === 'polt'\) NEU\.activeMinigame = null/.test(P));

  /* the two that already did it stay honest */
  ok('bullet still sets its claim', /NEU\.activeMinigame = 'bullet';/.test(read('game/bullet.js')));
  ok('scal still sets its claim', /NEU\.activeMinigame = 'scal';/.test(read('act4/boss-scal.js')));
}

/* ═══ 18. regression: the five already-fixed bugs stay fixed ══════*/
console.log('\n18. no regressions in the earlier fixes');
{
  const B = read('act4/boss-scal.js');
  ok('no-sprite: the blitter honours cols', /var col = \(\(o\.col \|\| 0\) % cols \+ cols\) % cols/.test(read('data/sheets.js')));
  ok('homing+rotation: fireblast still homes before its pause', /sp = 140/.test(B));
  ok('multi-charge burst still queues dashes', /chargeBurstMax > 0/.test(B));
  ok('>>> her cycle stays fixed, not randomised <<<', /CYCLE\[step_ % CYCLE\.length\]/.test(B) &&
     /THE ONLY RANDOMNESS/.test(B));
}

/* ═══ 19. wave-A sweep: loop, panel, and timer hygiene ════════════*/
console.log('\n19. wave-A sweep');
{
  /* W1 — rhythm/craft legitimately call engine.enter() mid-room now;
     a second unconditional rAF spawn ticks the room at double speed. */
  const E = read('core/engine.js');
  ok('>>> enter() spawns its loop only when not already running <<<',
     /if \(!running\) \{\s*running = true; last = performance\.now\(\);\s*requestAnimationFrame\(step\);\s*\}/.test(E));
  const b1 = boot();
  let rafs = 0;
  const origRaf = b1.w.requestAnimationFrame;
  b1.w.requestAnimationFrame = cb => { rafs++; return origRaf(cb); };
  b1.NEU.engine.enter('d1_street');
  const first = rafs; rafs = 0;
  b1.NEU.engine.enter('d1_street');
  ok('>>> a second enter() adds no second loop <<<', first >= 1 && rafs === 0);

  /* W2 — settings opens over live rooms; close() must give the room
     its is-playing back instead of stripping it unconditionally. */
  const S = read('core/settings.js');
  ok('settings.open() captures the body state before claiming it',
     /wasPlaying = document\.body\.classList\.contains\('is-playing'\);\s*document\.body\.classList\.add\('is-playing'\)/.test(S));
  ok('>>> settings.close() only strips is-playing if it added it <<<',
     /if \(!wasPlaying\) document\.body\.classList\.remove\('is-playing'\)/.test(S));
  const b2 = boot();
  N2_open_close(b2);
  ok('settings alone leaves no is-playing behind',
     !b2.w.document.body.classList.contains('is-playing'));
  b2.w.document.body.classList.add('is-playing');   // a live room underneath
  N2_open_close(b2);
  ok('>>> closing over a live room keeps its is-playing <<<',
     b2.w.document.body.classList.contains('is-playing'));

  /* W3 — a panel that consumed Escape must not let it also reach the
     engine's window handler and quit the room underneath. */
  ok('>>> settings Escape claims the event <<<',
     /e\.key === 'Escape'\) \{ e\.preventDefault\(\); e\.stopImmediatePropagation\(\); close\(\); return; \}/.test(S));
  const D = read('core/dev.js');
  ok('>>> dev console Escape claims the event <<<',
     /e\.key === 'Escape'\) \{\s*e\.preventDefault\(\);\s*e\.stopImmediatePropagation\(\);[\s\S]{0,200}?hide\(\);/.test(D));

  /* W4 — dying mid multi-charge then retrying hit an early-return
     forever: open() reset everything except the charge vars. */
  const B = read('act4/boss-scal.js');
  ok('>>> open() zeroes every charge var alongside diveT <<<',
     /diveT = 0;[\s\S]{0,200}?chargeT = 0; chargeTelegraph = 0; chargeBurst = 0; chargeBurstMax = 0; chargeGap = 0;/.test(B));

  /* W5 — the 900ms charge telegraph outlived close(); reopening inside
     the window fired it into the new fight untelegraphed. */
  const P = read('act4/boss-polt.js');
  ok('polt tracks its charge timer', /chargeTimer = setTimeout\(doCharge, 900\)/.test(P));
  ok('>>> close() clears the pending charge <<<', /clearTimeout\(chargeTimer\)/.test(P));

  /* W6 — the call→response concat timeout survived close/reopen and
     duplicated notes onto the fresh round. */
  const R = read('act4/rhythm.js');
  ok('rhythm tracks its phase timer', /phaseTimer = setTimeout\(function \(\) \{/.test(R));
  ok('>>> startRound() clears any stale phase timer <<<',
     /function startRound\(\) \{\s*if \(phaseTimer\) \{ clearTimeout\(phaseTimer\); phaseTimer = 0; \}/.test(R));
  ok('>>> close() clears the phase timer too <<<',
     /function close\(\) \{\s*running = false;\s*if \(phaseTimer\) \{ clearTimeout\(phaseTimer\); phaseTimer = 0; \}/.test(R));
}

/* settings open/close over a body, for section 19's W2 checks */
function N2_open_close(b) {
  b.NEU.settings.open();
  b.NEU.settings.close();
}

/* ═══ 20. wave-C sweep: gates, guards, and one-shot actions ════════*/
console.log('\n20. wave-C sweep');
{
  /* D1 — a library-launched blackout must not be able to finish the
     story chain: no grey door out there, so E near it does nothing. */
  const D = read('game/dark.js');
  ok('>>> dark: interact() gates the door on endless <<<',
     /function interact\(\)[\s\S]{0,500}?if \(endless\) return;\s*if \(!near\(DOOR\)\) return;/.test(D));

  /* D2 — a stale death rAF after Enter-restart flipped finish(false)
     on the fresh run. */
  const B = read('game/bullet.js');
  ok('>>> bullet: deathStep stands down when not dying or hidden <<<',
     /function deathStep\(now\) \{[\s\S]{0,200}?if \(!dying \|\| wrap\.hidden\) return;/.test(B));
  ok('>>> bullet: begin() clears dying so the stale frame exits <<<',
     /function begin\(\) \{\s*dying = 0;[\s\S]{0,160}?won = false; cheat = '';/.test(B));

  /* D3 — line 90's redeclaration silently reverted the beam width. */
  ok('>>> bullet: BL_HALF declared exactly once <<<',
     (B.match(/BL_HALF\s*=/g) || []).length === 1);
  ok('and it is the tuned 24', /var BL_HALF = 24;/.test(B));

  /* D4 — chip-spam or double-click started two step loops. */
  ok('>>> deck: open() re-entry guard <<<',
     /function open\(\) \{\s*if \(open_\) return;/.test(read('game/deck.js')));
  ok('>>> bullet: open() re-entry guard <<<',
     /function open\(opts\) \{\s*if \(running\) return;/.test(B));
  ok('>>> dark: open() re-entry guard <<<',
     /function open\(opts\) \{\s*if \(running\) return;/.test(D));

  /* D5 — reload with crack_clicks>=3 left an inert portal, and every
     knock leaked an AudioContext. */
  const C = read('act4/crack.js');
  ok('>>> crack: clicking an opened portal re-raises Polterghast unless dead <<<',
     /if \(!\(NEU\.save && NEU\.save\.flagged\('polt_dead'\)\) && NEU\.polt && NEU\.polt\.open\) NEU\.polt\.open\(\);/.test(C));
  ok('crack: opened clicks return either way',
     /if \(!armed\) return;[\s\S]{0,300}?if \(opened\) \{/.test(C));
  ok('>>> crack: exactly one AudioContext construction site <<<',
     (C.match(/new \(window\.AudioContext/g) || []).length === 1);
  ok('>>> crack: the context is lazily created once and reused <<<',
     /var [^\n]*\bactx = null/.test(C) && /if \(!actx\) actx = new \(window\.AudioContext/.test(C));

  /* D6 — take() re-ran during the close delay: duplicate soup,
     mushrooms taken twice, stacked timers. */
  const K = read('act4/craft.js');
  ok('>>> craft: module-level taken flag <<<', /var taken = false;/.test(K));
  ok('>>> craft: take() is one-shot per grid <<<',
     /if \(taken \|\| !matches\(\)\) return;\s*taken = true;/.test(K));
  ok('>>> craft: open() resets taken <<<', /taken = false;[\s\S]{0,900}?render\(\);/.test(K));

  /* D7 — tripping=1 persists in the save but only eat() applied the
     body class; a refresh mid-trip played the finale visually sober. */
  const A4 = read('act4/act4.js');
  ok('>>> act4 boot re-arms is-trip from the saved flag <<<',
     /flagged\('tripping'\)\) \{\s*document\.body\.classList\.add\('is-trip'\);/.test(A4));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
