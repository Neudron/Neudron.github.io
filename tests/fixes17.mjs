/* fixes17.mjs — Phase 7 polish: focus, the fps meter, cover art, sprites.
   Run: node fixes17.mjs

   A grab-bag suite on purpose. Each section here closes one row of the
   outstanding-work table rather than one module, and splitting them
   into four suites would mean four copies of the same 60-line jsdom
   harness.

   §1 is the one that was actually broken. `quiz.js` was the last scene
   in the game with no focus management at all: a modal overlay at
   z-index 76 that one Tab press walked out of, into the page behind
   it, while a twelve-second timer kept answering questions for you. */

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
  /* Never null: engine, both bosses and the deck bail out of their
     whole module if getContext fails. (neu-verify §2) */
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

const tab = (w, shift = false) => {
  const e = new w.KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true });
  w.dispatchEvent(e);
  return e;
};
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ═══ 1. the quiz traps Tab ═══════════════════════════════════════*/
console.log('\n1. quiz focus  <- the last unmanaged overlay');
{
  const { w, NEU } = boot();
  const doc = w.document;
  const Q = read('act4/quiz.js');

  ok('the overlay is marked as a modal dialog',
     /id="quiz"[^>]*role="dialog"/.test(HTML) && /id="quiz"[^>]*aria-modal="true"/.test(HTML));

  /* Something outside the overlay to be sent back to afterwards. */
  const outside = doc.getElementById('lightsToggle') || doc.querySelector('button');
  ok('there is a control outside the overlay', !!outside);
  outside.focus();

  NEU.quiz.fast(true);
  NEU.quiz.open();
  ok('quiz is running', NEU.quiz.running === true);
  ok('focus moved into the overlay on open',
     doc.getElementById('quiz').contains(doc.activeElement));

  await wait(40);   /* fast() collapses the pacing, but not to zero ticks */
  const opts = [...doc.querySelectorAll('#quizOpts .quiz__o')];
  ok('four options were built (' + opts.length + ')', opts.length === 4);
  ok('>>> the caret lands on option A <<<', doc.activeElement === opts[0]);

  /* Walk forward off the end. The trap must bring it back to the top
     of the overlay, never out of it. */
  const quit = doc.getElementById('quizQuit');
  const all = [...doc.querySelectorAll('#quiz button')].filter(b => !b.hidden && !b.disabled);
  ok('focusable set is options + quit (' + all.length + ')', all.length === 5);

  all[all.length - 1].focus();
  let e = tab(w);
  ok('>>> Tab off the last control is prevented <<<', e.defaultPrevented === true);
  ok('>>> and wraps back inside the overlay <<<',
     doc.getElementById('quiz').contains(doc.activeElement));
  ok('specifically to the first control', doc.activeElement === all[0]);

  all[0].focus();
  e = tab(w, true);
  ok('shift+Tab off the first is prevented', e.defaultPrevented === true);
  ok('and wraps to the last', doc.activeElement === all[all.length - 1]);

  /* From nowhere (focus outside) Tab must pull it back in, not push
     it further away. */
  outside.focus();
  tab(w);
  ok('>>> Tab from outside pulls focus back in <<<',
     doc.getElementById('quiz').contains(doc.activeElement));

  /* The list must be live. The option buttons are rebuilt every
     question, so a cached list points at detached nodes by Q2. */
  ok('the list is recomputed, not cached', /function focusables\(\)/.test(Q));
  ok('...and it is called inside the Tab branch',
     /if \(e\.key === 'Tab'\)[\s\S]{0,120}focusables\(\)/.test(Q));

  NEU.quiz.close();
  ok('closing returns focus where it came from', doc.activeElement === outside);
  ok('quiz stopped', NEU.quiz.running === false);
}

/* 1b. no phantom show. A pending "next question" timer must not
   survive close(). Before the fix, closing mid-show left the
   setTimeout alive: ask() kept rebuilding the board on a hidden
   wrapper, ran the whole show to a phantom "D-" finish, and marked
   a4_rank behind the player's back. Fresh boot, first show, closed
   before the first question even renders. */
console.log('\n1b. closing kills the pending ask timer');
{
  const { w, NEU } = boot();
  const doc = w.document;
  NEU.quiz.fast(true);
  NEU.quiz.open();
  NEU.quiz.close();
  await wait(80);   /* any stale timer would have fired by now */
  ok('>>> closing mid-show kills the pending ask timer <<<',
     doc.querySelectorAll('#quizOpts .quiz__o').length === 0);
  ok('...and nothing was auto-marked behind the player\'s back',
     !NEU.save.flagged('quiz_rank'));
  ok('...and the show never started', NEU.quiz.index === 0);
}

/* ═══ 2. every modal overlay traps, not just this one ═════════════*/
console.log('\n2. no overlay is left unmanaged');
{
  /* Take the WHOLE `if (e.key === 'Tab') { ... }` block by counting
     brace depth, not a fixed character window. The first version of
     this used `Tab'\)[\s\S]{0,400}preventDefault` and went red on
     settings.js purely because a four-line explanatory comment pushed
     the call past 400 characters. A window that a comment can break is
     measuring the comment. (PLAN §1.8 trap 2 is the same lesson about
     the other kind of brace.) */
  function tabBlock(src) {
    const at = src.indexOf("e.key === 'Tab'");
    if (at < 0) return null;
    const open = src.indexOf('{', at);
    if (open < 0) return null;
    let d = 0;
    for (let k = open; k < src.length; k++) {
      if (src[k] === '{') d++;
      else if (src[k] === '}') { d--; if (d === 0) return src.slice(open, k + 1); }
    }
    return null;
  }

  /* Named, then counted. "three traps" passes just as happily when
     someone deletes one and adds another. (PLAN §1.8 trap 11) */
  const TRAPS = [['act4/quiz.js', 'quiz'], ['game/deck.js', 'deck'],
                 ['core/settings.js', 'settings']];
  for (const [f, name] of TRAPS) {
    const blk = tabBlock(read(f));
    ok(name + ": handles e.key === 'Tab'", !!blk);
    ok(name + ': prevents the default inside that block',
       !!blk && /preventDefault\(\)/.test(blk));
    ok(name + ': and moves focus rather than only blocking',
       !!blk && /\.focus\(\)/.test(blk));
    /* shift+Tab is half the keyboard users. Trapping forward only
       leaves the back door open, which is the same bug. */
    ok(name + ': handles shift+Tab too', !!blk && /shiftKey/.test(blk));
  }
  ok('exactly three overlays trap (' + TRAPS.length + ')', TRAPS.length === 3);
}

/* ═══ 3. the settings trap behaves, not just reads right ══════════*/
console.log('\n3. settings trap, driven');
{
  const { w, NEU } = boot();
  const doc = w.document;
  const outside = doc.getElementById('settBtn');
  NEU.settings.open();
  ok('panel is open', doc.querySelector('.sett').hidden === false);
  const els = [...doc.querySelectorAll('.sett button, .sett input')];
  ok('focusables include the slider',
     els.some(e => e.id === 'settMusic'), true);
  els[els.length - 1].focus();
  const e1 = tab(w);
  ok('>>> Tab off the end is prevented <<<', e1.defaultPrevented === true);
  ok('>>> and stays inside the panel <<<', doc.querySelector('.sett').contains(doc.activeElement));
  NEU.settings.close();
  ok('closing returns focus to the gear', doc.activeElement === outside);
}

/* ═══ 4. the sprite manifest tells the truth about itself ═════════*/
console.log('\n4. manifest honesty');
{
  const { NEU } = boot();
  const S = read('data/sheets.js');
  const keys = Object.keys(NEU.sheets);
  ok('the manifest is non-empty (' + keys.length + ')', keys.length > 10);

  /* A sheet cannot be both measured and guessed. The pair drifted
     apart once already: two entries carried `confirmed: true` AND a
     `verify:` flag, which reads as "we checked it" and means "we did
     not". */
  for (const k of keys) {
    const s = NEU.sheets[k];
    if (s.provisional) ok(k + ': provisional, so not also confirmed', !s.confirmed);
  }

  /* NOTHING is provisional any more. The last two, sepulcher and heart,
     were settled by rendering them at 5x with the candidate cell rules
     drawn on and looking: sepulcher is one head, not two frames, and
     heart is six beats on a 62px grid, not five on 74. */
  const prov = keys.filter(k => NEU.sheets[k].provisional);
  ok('>>> nothing is provisional (' + (prov.join(', ') || 'none') + ') <<<', prov.length === 0);

  for (const want of ['fireblast', 'gigablast', 'hook', 'sepulcher', 'heart']) {
    const s = NEU.sheets[want];
    ok(want + ': confirmed', s.confirmed === true && !s.provisional);
    ok(want + ': records how it was settled', /measured|seen/.test(s.note || ''));
  }
  ok('sepulcher is one frame, not two', NEU.sheets.sepulcher.frames === 1);
  ok('...and fps 0, because there is nothing to animate', NEU.sheets.sepulcher.fps === 0);
  ok('heart is six frames on a 62px grid',
     NEU.sheets.heart.frames === 6 && NEU.sheets.heart.fh === 62);
  ok('...and its sheet was re-padded so the grid is exact',
     NEU.sheets.heart.h === 372 && 6 * 62 === 372);

  /* Geometry must be self-consistent whatever the provenance. */
  for (const k of keys) {
    const s = NEU.sheets[k];
    if (!s.h || !s.frames || !s.fh) continue;
    ok(k + ': frames x fh accounts for the sheet (' + s.frames + 'x' + s.fh + '=' +
       (s.frames * s.fh) + ' of ' + s.h + ')', s.frames * s.fh <= s.h);
  }

  /* The slash pair was mislabelled and has been swapped, so nothing is
     waiting on a human any more. */
  const orient = keys.filter(k => NEU.sheets[k].verify);
  ok('>>> no sheet is still flagged for a human (' + (orient.join(', ') || 'none') + ') <<<',
     orient.length === 0);
  ok('slashTop is the top arc (the Alt file)', /SlashAlt\.png$/.test(NEU.sheets.slashTop.src));
  ok('slashBot is the bottom arc (the plain file)',
     /CatastropheSlash\.png$/.test(NEU.sheets.slashBot.src));
  /* The geometry had to travel with the src — the files are different
     sizes, so an entry left holding the other one's dimensions would
     slice the arc off-grid. This is the check for that mistake. */
  ok('>>> geometry moved with the src, not just the string <<<',
     NEU.sheets.slashTop.w === 192 && NEU.sheets.slashTop.fh === 58 &&
     NEU.sheets.slashBot.w === 168 && NEU.sheets.slashBot.fh === 60);
  ok('and sheets.js records that swapping only the strings was wrong',
     /describe the FILE, not the role/.test(S));
}

/* ═══ 5. the frame-time meter ═════════════════════════════════════*/
console.log('\n5. fps meter and the budget');
{
  const { w, NEU } = boot();
  const P = read('core/perf.js');
  ok('perf loaded', !!NEU.perf);

  /* The whole design rests on this: a meter that samples all the time
     is part of the cost it claims to be reporting. */
  ok('>>> it samples nothing until asked <<<', NEU.perf.running === false);
  ok('>>> and builds no overlay until asked <<<', !w.document.querySelector('.fps'));
  ok('no data before it runs', NEU.perf.stats().n === 0);
  ok('and it says so rather than reporting 0 fps', /no frames sampled/.test(NEU.perf.line()));

  ok('the budget is three named numbers, not one',
     NEU.perf.TARGET > 16 && NEU.perf.TARGET < 17 &&
     NEU.perf.WARN === 20 && NEU.perf.FAIL > 33 && NEU.perf.FAIL < 34);

  NEU.perf.start();
  ok('starting builds the overlay', !!w.document.querySelector('.fps'));
  ok('and shows it', w.document.querySelector('.fps').hidden === false);
  ok('the overlay is hidden from assistive tech',
     w.document.querySelector('.fps').getAttribute('aria-hidden') === 'true');

  /* A steady 60. 16.0, not 16.7: a frame that lands ON the 16.67
     budget is not a useful test of "comfortably inside it", and the
     first version of this line fed 16.7 and went amber by 0.03ms. */
  for (let i = 0; i < 200; i++) NEU.perf._push(16.0);
  let s = NEU.perf.stats();
  ok('reads ~62 fps on a steady 16ms feed', Math.round(s.fps) === 63 || Math.round(s.fps) === 62);
  ok('verdict ok', s.verdict === 'ok');
  ok('window is capped (' + s.n + ')', s.n === NEU.perf.WINDOW);

  /* THE CASE THAT MATTERS, and the one that changed the design.
     Steady 60 with one hitch a second. The average stays near budget;
     the thing you feel is the hitch. Written against p95 this passed
     as "15.0ms, fine" — three bad frames in 180 is 1.7%, inside p95's
     discard. That is why the meter reports the 1% low. */
  NEU.perf.stop(); NEU.perf.start();
  for (let i = 0; i < 180; i++) NEU.perf._push(i % 60 === 0 ? 90 : 15);
  s = NEU.perf.stats();
  ok('mean alone would call this fine (' + s.mean.toFixed(1) + 'ms)', s.mean < 20);
  ok('p50 alone would too (' + s.p50.toFixed(1) + 'ms)', s.p50 < 20);
  ok('>>> but the 1% low catches the hitch (' + s.p99.toFixed(1) + 'ms) <<<', s.p99 > 33);
  ok('>>> so the verdict is fail, not ok <<<', s.verdict === 'fail');
  ok('and the worst frame is reported (' + s.worst + 'ms)', s.worst === 90);
  ok('the meter is judged on the 1% low, and says so', /Judged on the 1% low/.test(P));
  ok('and records why p95 was rejected', /AND WHY NOT p95/.test(P));

  /* A backgrounded tab returns one enormous frame. That is a gap, not
     a stutter, and letting it in poisons the window for 3 seconds. */
  NEU.perf.stop(); NEU.perf.start();
  for (let i = 0; i < 100; i++) NEU.perf._push(16);
  NEU.perf._push(4000);
  s = NEU.perf.stats();
  ok('>>> a 4-second gap is not counted as a frame <<<', s.worst < 100);
  ok('and the verdict survives it', s.verdict === 'ok');

  /* Attribution. A frame time with no scene name tells you something
     is slow and nothing about what. */
  ok('reports which scene it measured', NEU.perf.scene() === 'page');
  NEU.scal = { running: true };
  ok('and follows the running scene', NEU.perf.scene() === 'scal');

  ok('the readout names the scene', /scene\(\)/.test(P));
  ok('the DOM is written 4x a second, not 60', /DRAW_EVERY/.test(P));

  NEU.perf.stop();
  ok('stopping hides the overlay', w.document.querySelector('.fps').hidden === true);
  ok('and cancels the loop', NEU.perf.running === false);

  const D = read('core/dev.js');
  ok('dev console has an fps command', /CMDS\.fps = function/.test(D));
  ok('...and help lists it', /log\('fps/.test(D));
  ok('"fps off" stops it', /'off'/.test(D));

  /* Ladder: 84 sits above dev (80) and below the sprite inspector (88)
     and the dialogue box (96). Burying the box was a real bug. */
  const CSS = fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8');
  const blk = CSS.slice(CSS.indexOf('\n.fps {'), CSS.indexOf('\n.fps {') + 400);
  ok('the overlay sits at z-index 84', /z-index:\s*84/.test(blk));
  ok('below the dialogue box', 84 < 96);
  ok('and it never eats a click', /pointer-events:\s*none/.test(blk));

  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok('perf.js loads before dev.js',
     html.indexOf('js/core/perf.js') < html.indexOf('js/core/dev.js'));
}

/* ═══ 6. the deck has cover art ═══════════════════════════════════*/
console.log('\n6. deck covers');
{
  const { w, NEU } = boot();
  const D = read('game/deck.js');
  const doc = w.document;

  NEU.deck.open();
  const tiles = [...doc.querySelectorAll('#deckShelf .deck__tile')];
  ok('the shelf built (' + tiles.length + ' tiles)', tiles.length === 7);

  /* Named, then counted. */
  const IDS = ['twenty', 'dark', 'woods', 'skele', 'wax', 'dog2', 'neu'];
  for (const id of IDS) ok('sigil defined: ' + id, new RegExp('\\n    ' + id + ': function').test(D));

  const arts = [...doc.querySelectorAll('#deckShelf .deck__art')];
  ok('>>> every tile draws a sigil, none falls back to letters <<<',
     arts.length === 7 && arts.every(a => a.classList.contains('is-sigil')));
  ok('and none of them is empty',
     arts.every(a => (a.querySelector('svg') || { innerHTML: '' }).innerHTML.length > 40));
  ok('no tile is still two letters', !doc.querySelector('#deckShelf .deck__art b'));

  /* One visual language, or it reads as seven clip-art downloads. */
  const svgs = arts.map(a => a.querySelector('svg'));
  ok('every sigil uses the same 48x48 grid',
     svgs.every(s => s.getAttribute('viewBox') === '0 0 48 48'));
  ok('every sigil is hidden from assistive tech',
     svgs.every(s => s.getAttribute('aria-hidden') === 'true'));
  ok('every sigil renders crisp, not antialiased',
     svgs.every(s => s.getAttribute('shape-rendering') === 'crispEdges'));
  ok('no gradients inside a sigil (the box behind is the gradient)',
     svgs.every(s => !/gradient/i.test(s.innerHTML)));
  ok('uniform stroke weight', svgs.every(s => !/stroke-width="(?!2")/.test(s.innerHTML)));

  /* Two colours each, both declared as data rather than hardcoded in
     the drawing, so a cover cannot drift from its own box. */
  ok('colours come from the game entry, not the sigil',
     /SIGILS\[g\.id\]\(g\.ink/.test(D));
  const hard = [...D.matchAll(/#[0-9A-Fa-f]{6}/g)].length;
  ok('sigils reference ink/hi rather than literal hex (' + hard + ' literals, all in data)',
     !/stroke="#[0-9A-Fa-f]{6}"/.test(D.slice(D.indexOf('var SIGILS'), D.indexOf('var GAMES'))));

  /* The fallback must survive. It is dead code today, which is exactly
     when it gets deleted and exactly when that is wrong. */
  ok('the initials fallback is still there', /mark\.textContent/.test(D));
  ok('...and is documented as deliberate', /THE FALLBACK, kept deliberately/.test(D));
  ok('presence in SIGILS is the switch, no second flag', !/sigil:\s*true/.test(D));

  NEU.deck.close();
}

/* ═══ 7. the sprites ══════════════════════════════════════════════*/
console.log('\n7. sprites');
{
  const IMG = path.join(ROOT, 'img');
  const ALL = ['dog', 'hammer', 'clicker', 'hand', 'blanket', 'switch2', 'tv', 'sword'];
  const svg = {};
  for (const n of ALL) {
    const f = path.join(IMG, n + '.svg');
    ok(n + '.svg exists', fs.existsSync(f));
    if (fs.existsSync(f)) svg[n] = fs.readFileSync(f, 'utf8');
  }

  /* Sizes are load-bearing: call sites size these in CSS assuming the
     current aspect. A redraw that changes the viewBox silently
     restretches the sprite wherever it appears. */
  const BOX = { dog: '0 0 16 14', hammer: '0 0 10 14', clicker: '0 0 9 7',
                hand: '0 0 11 10', blanket: '0 0 18 5', switch2: '0 0 16 7',
                tv: '0 0 14 9', sword: '0 0 12 30' };
  for (const n of ALL)
    ok(n + ': viewBox unchanged (' + BOX[n] + ')',
       (svg[n].match(/viewBox="([^"]+)"/) || [])[1] === BOX[n]);

  /* House style: integer pixel rects, crisp, labelled. */
  for (const n of ALL) {
    ok(n + ': renders crisp', /shape-rendering="crispEdges"/.test(svg[n]));
    ok(n + ': is labelled for assistive tech', /role="img" aria-label="/.test(svg[n]));
    ok(n + ': integer rects only', !/(x|y|width|height)="[\d]*\.[\d]+"/.test(svg[n]));
  }

  /* No sprite may introduce a colour the rest of the art does not use.
     This is the check that stops a redraw drifting the palette. */
  const PALETTE = new Set(['#191426', '#F4F2FA', '#9C97B2', '#2A2230', '#6B4A2A',
                           '#B892FF', '#EDE7DE', '#E8DCC8', '#5E3350', '#8C2F4A',
                           '#C2405F', '#22222E', '#14141C', '#C9A227', '#8F7016',
                           /* ONE addition, 2026-08-17: a warm skin shadow. The
                              only mid-tone was #9C97B2, a cool grey, and on
                              skin that reads as dirt rather than shade. */
                           '#BFA98C']);
  ok('the palette is 16 colours (one warm skin shadow added)', PALETTE.size === 16);
  for (const n of ALL) {
    const used = [...new Set([...svg[n].matchAll(/fill="(#[0-9A-Fa-f]{6})"/g)].map(m => m[1].toUpperCase()))];
    ok(n + ': no colour outside the site palette (' + used.length + ' used)',
       used.every(c => PALETTE.has(c)));
  }

  /* Every one of the seven is shaded now: more than one tone inside its
     own outline. A flat two-tone sprite next to `sword.svg` is what
     made these read as placeholders in the first place. */
  const SEVEN = ['dog', 'hammer', 'clicker', 'hand', 'blanket', 'switch2', 'tv'];
  for (const n of SEVEN) {
    const tones = new Set([...svg[n].matchAll(/fill="(#[0-9A-Fa-f]{6})"/g)]
      .map(m => m[1].toUpperCase()));
    tones.delete('#191426');                       /* the outline is not shading */
    ok(n + ': shaded, not one flat fill (' + tones.size + ' tones)', tones.size >= 2);
  }
  /* The hand is the reason the palette grew. If the warm shadow ever
     goes missing, the sprite is flat again and nobody notices. */
  ok('>>> the hand uses the warm shadow, not the cool grey <<<',
     /#BFA98C/i.test(svg.hand) && !/#9C97B2/i.test(svg.hand));

  const A = fs.readFileSync(path.join(ROOT, 'memory', 'assets.md'), 'utf8');
  ok('assets.md no longer calls any of them placeholders',
     !/\| \*\*placeholders\*\* \|/.test(A));
  ok('...and records the one palette addition', /BFA98C/.test(A));

  /* The generator owns all seven now: the grid is the source, the rects
     are built. Named, then counted. */
  const G = fs.readFileSync(path.join(ROOT, '..', '_scripts', 'make-sprites.mjs'), 'utf8');
  ok('the generator exists', /const SPRITES = \{/.test(G));
  for (const n of SEVEN) ok('generator owns ' + n, new RegExp('\\n  ' + n + ': \\[').test(G));
  const owned = [...G.matchAll(/\n  ([a-z0-9]+): \[/g)].map(m => m[1]);
  ok('and owns nothing else (' + owned.join(', ') + ')', owned.length === SEVEN.length);
  ok('it refuses to change a viewBox', /viewBox changed/.test(G));
  ok('it records why the hand kept its original shape',
     /read as a stool/.test(G));
}

/* ═══ 8. the README works for a stranger ══════════════════════════*/
console.log('\n8. README');
{
  const R = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const lines = R.split('\n').length;
  ok('it is readable in one sitting (' + lines + ' lines, was 772)', lines < 200);

  /* The three questions a stranger actually has. */
  ok('says what it is', /personal site/i.test(R));
  ok('says how to run it', /http\.server/.test(R));
  ok('says how to test it', /node fixes/.test(R) && /jsdom/.test(R));
  ok('says how to deploy it', /deploy\.ps1/.test(R));

  /* It documented the PRE-REORG tree for months. Every path it names
     must exist, or it is worse than no README. */
  const paths = [...R.matchAll(/`((?:js|css|img|audio|memory|tests|_scripts)\/[A-Za-z0-9_./*-]+)`/g)]
    .map(m => m[1]).filter(p => !p.includes('*'));
  ok('it names some paths (' + paths.length + ')', paths.length >= 6);
  for (const p of new Set(paths)) {
    const abs = p.startsWith('_scripts/') ? path.join(ROOT, '..', p) : path.join(ROOT, p);
    ok('path exists: ' + p, fs.existsSync(abs));
  }
  ok('>>> no pre-reorg flat js/ paths survive <<<',
     !/`js\/(main|scene|stars|sans|sword|bullet|dark|deck|quest|save|engine)\.js`/.test(R));

  /* The constraints are the interesting part of this codebase and the
     thing a newcomer will break first. */
  for (const [what, re] of [['no build step', /no build step/i],
                            ['ES5 in js/', /ES5/],
                            ['16px font grid', /16px/],
                            ['one source of truth', /source of truth/i],
                            ['the art budget', /500 KB/]])
    ok('it states: ' + what, re.test(R));

  ok('it points at memory/ for the rest', /memory\/PLAN\.md/.test(R));
  ok('it credits the sprite and font sources', /Toby Fox|Calamity/.test(R));

  /* Nothing was thrown away to get it short. */
  const B = path.join(ROOT, 'memory', 'build-notes.md');
  ok('the old README was preserved, not deleted', fs.existsSync(B));
  ok('...and it says where it came from',
     /the old README, preserved/.test(fs.readFileSync(B, 'utf8')));

  /* A README that spoils the game on line five is a bug in the game. */
  ok('>>> it does not spoil the way in <<<',
     !/contact section.{0,80}(click|press|swing|sword)/i.test(R));
}

/* ═══ 9. what is allowed to be published ══════════════════════════*/
console.log('\n9. the deploy boundary');
{
  const GI = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');

  /* THE ONE THAT MATTERS. memory/story.md is the complete walkthrough
     of a game whose first puzzle is finding the way in. It was shipping
     because memory/ lives inside site/ and the mirror took everything. */
  ok('>>> memory/ is excluded from the deploy <<<', /^memory\/$/m.test(GI));
  ok('...and the reason is written down, not just the rule',
     /walkthrough/i.test(GI) && /story\.md/.test(GI));
  ok('...and it says how to revert', /TO REVERT/.test(GI));
  /* The folder, not a list of four files: a rule that names files goes
     stale the first time somebody writes a fifth, silently. */
  ok('it excludes the folder rather than naming files',
     !/^memory\/story\.md$/m.test(GI));

  /* Nothing shipped may reference it, or excluding it 404s. */
  for (const f of ['index.html']) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    ok(f + ': does not link into memory/', !/["'(]memory\//.test(s));
  }
  for (const f of ['core/dev.js', 'core/quest.js', 'data/data.js'])
    ok(f + ': does not fetch from memory/', !/memory\//.test(read(f)));

  /* The README has to admit the gap, or a reader on the web sees a
     table of files that are not there. */
  const R = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  ok('the README says memory/ is not published', /not published/.test(R));

  /* .orig backups must never ship either — pad-sheet.mjs writes them,
     and the first run of it dropped one next to a sprite. */
  ok('.orig files are excluded', /^\*\.orig$/m.test(GI));
  const strays = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else if (/\.orig$/.test(e.name)) strays.push(p);
    }
  })(ROOT);
  ok('>>> no .orig backup is sitting inside site/ (' + strays.length + ') <<<', strays.length === 0);
}

/* ═══ 10. the discord verification is back ════════════════════════*/
console.log('\n10. .well-known');
{
  const wk = path.join(ROOT, '.well-known', 'discord');
  ok('.well-known/discord exists', fs.existsSync(wk));
  const body = fs.existsSync(wk) ? fs.readFileSync(wk, 'utf8').trim() : '';
  ok('it is a single dh= token', /^dh=[0-9a-f]{40}$/.test(body));
  ok('.nojekyll exists as insurance', fs.existsSync(path.join(ROOT, '.nojekyll')));

  /* The obvious explanation for the original loss is wrong for THIS
     repo, and the note has to say so or the next person "fixes" a
     problem that is not there. */
  const note = fs.readFileSync(path.join(ROOT, '.well-known', 'README.md'), 'utf8');
  ok('the note explains that Jekyll does not run here', /No Jekyll runs/.test(note));
  ok('...and why .nojekyll is kept anyway', /insurance/.test(note));

  /* Ground that claim in the actual workflow rather than in a comment. */
  const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy.yml'), 'utf8');
  ok('the workflow uploads the repo as-is (no Jekyll build)',
     /upload-pages-artifact/.test(wf) && !/jekyll/i.test(wf));

  /* And it must not be caught by any ignore rule. */
  const GI = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  ok('no ignore rule swallows .well-known',
     !GI.split('\n').some(l => l.trim() && !l.startsWith('#') && /well-known/.test(l)));
}

console.log('\n11. the docs have a backup, and it actually reaches them');
{
  /* Excluding memory/ from the Pages repo (§9) and removing the stray
     root .git were each right on their own. Together they left 3,600
     lines of documentation with no history and no off-machine copy.
     The workshop repo at Documents\neu closes that.

     THE TRAP THIS SECTION EXISTS FOR. Git gives a lower-level
     .gitignore precedence over a parent's, so `memory/` in
     site/.gitignore ALSO hides memory/ from the repo one level up —
     the repo whose only job is to back it up. No warning; `git add -A`
     just skips it. It has to be force-added, and a NEW file inside
     memory/ has to be force-added again.

     A backup that silently backs up nothing is worse than none, so
     this asserts the mechanism rather than trusting it. */
  const S  = path.join(ROOT, '..', '_scripts', 'backup-docs.ps1');
  const RG = path.join(ROOT, '..', '.gitignore');

  ok('a backup script exists', fs.existsSync(S));
  ok('the workshop repo has its own .gitignore', fs.existsSync(RG));

  if (fs.existsSync(S)) {
    const B = fs.readFileSync(S, 'utf8');
    ok('>>> it force-adds memory/, or it backs up nothing <<<',
       /git add -f\s+site\\memory/.test(B));
    ok('it explains WHY the force-add is needed',
       /lower-level \.gitignore/i.test(B) && /precedence/i.test(B));
    /* the guard against the failure being silent next time */
    ok('>>> it fails loudly if the docs stop being tracked <<<',
       /ls-files site\\memory/.test(B) && /\.Count -lt/.test(B));
    ok('it warns before a remote makes the walkthrough public',
       /PRIVATE/.test(B) && /remote/i.test(B));
  }

  if (fs.existsSync(RG)) {
    const R2 = fs.readFileSync(RG, 'utf8');
    ok('the workshop repo does not swallow the Pages clone',
       /^_deploy\/$/m.test(R2));
    ok('it does not track node_modules', /node_modules/.test(R2));
    ok('it does not track the sprite source rips', /deltarune/.test(R2));
    /* If someone ever writes `memory/` in here it would be belt AND
       braces against the backup working at all. */
    ok('>>> it does NOT re-exclude memory <<<',
       !R2.split('\n').some(l => l.trim() && !l.startsWith('#') &&
                                 /(^|\/)memory\/?$/.test(l.trim())));
  }

  /* And the decision is written down where the next session looks. */
  const P = fs.readFileSync(path.join(ROOT, 'memory', 'pending.md'), 'utf8');
  ok('pending.md records how the docs are backed up',
     /backup-docs/.test(P));
}

console.log('\n12. deploy.ps1 — the only path to production');
{
  /* Nothing tested this script until now, which is backwards: it is the
     one file that can put something wrong in front of the world, and
     GitHub Pages has no staging step to catch it afterwards.

     It cannot be executed here (no PowerShell, and it pushes), so these
     are source assertions. They cover the properties whose absence is
     silent — the failures you would not notice until the site was
     already wrong, or already unchanged when you needed it changed. */
  const D = path.join(ROOT, '..', '_scripts', 'deploy.ps1');
  ok('deploy.ps1 exists', fs.existsSync(D));

  if (fs.existsSync(D)) {
    const S2 = fs.readFileSync(D, 'utf8');

    /* THE ONE THAT MATTERS MOST. A clean working tree does not mean
       there is nothing to deploy — work can be committed and unpushed,
       which is exactly what a session leaves when told to commit but
       not push. The script used to answer "already in sync" and exit,
       doing nothing at the one moment it was needed. */
    ok('>>> a clean tree still pushes existing commits <<<',
       /rev-list origin\/main\.\.HEAD/.test(S2) &&
       /ahead\.Count -eq 0/.test(S2));
    ok('it distinguishes "nothing staged" from "nothing to do"',
       /hasStaged/.test(S2));
    ok('it does not commit when there is nothing to commit',
       /if \(\$hasStaged\) \{[\s\S]*?git commit/.test(S2));

    /* it must never push without being told to, twice over */
    ok('>>> it asks before going live <<<',
       /Read-Host/.test(S2) && /-ne 'deploy'/.test(S2));
    ok('it has a dry run', /\$DryRun/.test(S2));
    ok('it warns about PR #1 at the moment of the push',
       /PR #1/i.test(S2));

    /* Stale .lock files under .git make every later git command refuse
       with "Another git process seems to be running". A crashed process
       leaves them, and so does any environment that can create files
       but not delete them. Clearing them is the difference between the
       script running and the script refusing on a Tuesday for reasons
       nobody remembers. */
    ok('it clears stale git locks before starting',
       /\*\.lock/.test(S2) && /Remove-Item/.test(S2));
    ok('>>> but only OLD locks, so it cannot interrupt a live git <<<',
       /AddMinutes\(-\d+\)/.test(S2) && /LastWriteTime -lt/.test(S2));

    /* the gates that stop a bad tree reaching the CDN */
    ok('it checks the tree shape before staging', /the tree is wrong/.test(S2));
    ok('it detects a pre-reorg flat js/ tree', /flat js/.test(S2));
    ok('>>> it blocks memory/ from shipping <<<', /\^memory\//.test(S2));
    ok('it blocks node_modules and the sprite rips',
       /node_modules/.test(S2) && /deltarune/.test(S2));
    ok('it blocks secrets', /\\\.env|\.pem|\.key/.test(S2));

    /* mirroring, not copying — the bug that once shipped 2,284 KB */
    ok('it mirrors rather than copies (robocopy /MIR)', /\/MIR/.test(S2));
    ok('it keeps .git and node_modules out of the mirror',
       /\/XD/.test(S2) && /'\.git'/.test(S2));

    /* verifying against the CDN, not an API that lies earlier */
    ok('it verifies against the live file', /neu\.ac\/js\//.test(S2));
    ok('it cache-busts the verification', /cb=/.test(S2));
  }
}

console.log('\n' + (fail ? 'FAILED ' : 'passed ') + pass + '/' + (pass + fail));
process.exit(fail ? 1 : 0);
