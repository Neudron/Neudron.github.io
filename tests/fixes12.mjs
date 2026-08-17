/* fixes12.mjs — the accessibility panel, boot restore, flash audit.
   Run: node fixes12.mjs

   Phase 3 of the plan. The juice backend existed first; this asserts
   the settings panel that makes it reachable, the save-restore-at-boot
   fix that makes persistence mean something, and the 3Hz flash audit
   that was promised but never measured. */

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ok   ' + n))
                         : (fail++, console.log('  FAIL ' + n)); };

function boot(reducedMotion = false) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { pretendToBeVisual: true, url: 'https://www.neu.ac/',
                                runScripts: 'outside-only' });
  const w = dom.window;
  w.IntersectionObserver = class { constructor(cb){this.cb=cb;} observe(){} disconnect(){} };
  w.matchMedia = q => ({ matches: reducedMotion && /reduce/.test(q),
                         addListener(){}, addEventListener(){} });
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
const wait = ms => new Promise(r => setTimeout(r, ms));
const read = f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
const S = read('core/settings.js');
const CSS = read('../css/style.css').replace(/^\uFEFF/, '');

/* ═══ 1. the module ═══════════════════════════════════════════════*/
console.log('\n1. the settings module');
{
  const { w, NEU } = boot();
  ok('settings loaded', !!NEU.settings);
  ok('panel element exists', !!w.document.querySelector('.sett'));
  ok('gear button exists', !!w.document.getElementById('settBtn'));
  /* Named, not counted. A count says "4" when someone adds a switch and
     deletes another, and it tells you nothing about which one broke. */
  {
    const ids = [...w.document.querySelectorAll('.sett [role="switch"]')].map(e => e.id);
    for (const want of ['settShake', 'settFlash', 'settText', 'settTouch'])
      ok('switch: ' + want, ids.includes(want));
    ok('no unexpected switches (' + ids.length + ')', ids.length === 4);
  }
  ok('close button exists', !!w.document.querySelector('.sett__x'));
  ok('dialog role + label', w.document.querySelector('.sett').getAttribute('role') === 'dialog');
  ok('starts closed', w.document.querySelector('.sett').hidden === true);
}

/* ═══ 2. open / close ═════════════════════════════════════════════*/
console.log('\n2. open and close');
{
  const { w, NEU } = boot();
  const panel = w.document.querySelector('.sett');
  w.dispatchEvent(new w.KeyboardEvent('keydown',
    { key: ',', code: 'Comma', ctrlKey: true, shiftKey: true }));
  ok('>>> Ctrl+Shift+, opens the panel <<<', panel.hidden === false);
  ok('and locks page scroll', w.document.body.classList.contains('is-playing'));
  ok('focus lands on a switch',
     (w.document.activeElement.getAttribute('role')) === 'switch');
  w.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
  ok('Escape closes it', panel.hidden === true);
  ok('and unlocks the page', !w.document.body.classList.contains('is-playing'));
  NEU.settings.open();
  ok('NEU.settings.open works', panel.hidden === false);
  NEU.settings.close();
  ok('NEU.settings.close works', panel.hidden === true);
  w.document.getElementById('settBtn').click();
  ok('gear button opens it', panel.hidden === false);
}

/* ═══ 3. toggles persist and apply ════════════════════════════════*/
console.log('\n3. toggles write through to the save file');
{
  const { w, NEU } = boot();
  ok('shake starts off', NEU.juice.noShake === false);
  w.document.getElementById('settShake').click();
  ok('switch flips', w.document.getElementById('settShake')
      .getAttribute('aria-checked') === 'true');
  ok('>>> juice is told <<<', NEU.juice.noShake === true);
  ok('>>> and the save file records it <<<', NEU.save.flag('opt_noShake') === 1);
  w.document.getElementById('settFlash').click();
  ok('flash toggle applies too', NEU.juice.noFlash === true);
  w.document.getElementById('settText').click();
  ok('larger text adds the class',
     w.document.documentElement.classList.contains('text-lg'));
  ok('and persists', NEU.save.flag('opt_largeText') === 1);
  w.document.getElementById('settText').click();
  ok('and turns off cleanly',
     !w.document.documentElement.classList.contains('text-lg') &&
     NEU.save.flag('opt_largeText') === 0);
}

/* ═══ 4. the settings survive a save round-trip ═══════════════════*/
console.log('\n4. round-trip: settings come back with the file');
{
  const { w, NEU } = boot();
  NEU.settings.set('opt_noFlash', 1);
  NEU.settings.set('opt_largeText', 1);
  const json = NEU.save.serialise();
  NEU.save.wipe();
  ok('wipe clears them', !NEU.settings.flash && !NEU.settings.text);
  NEU.save.deserialise(json);
  ok('>>> settings restored from the file <<<', NEU.settings.flash === true);
  ok('large text restored', NEU.settings.text === true);
  ok('and applied to the page',
     w.document.documentElement.classList.contains('text-lg'));
}

/* ═══ 5. boot restore — the file comes back on a fresh load ═══════*/
console.log('\n5. a seeded save is restored at boot');
{
  const save = { v: 1, act: 3, room: 'a1_clearing', spawn: 'default',
    flags: { scal_dead: 1, opt_noShake: 1, opt_largeText: 1 },
    items: [], quest: { done: {}, counts: {} }, quiz: null, best: {}, stamp: 0 };
  const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'),
    { pretendToBeVisual: true, url: 'https://www.neu.ac/',
      runScripts: 'outside-only' });
  const w = dom.window;
  w.localStorage.setItem('neu.save.v1', JSON.stringify(save));
  w.IntersectionObserver = class { constructor(cb){this.cb=cb;} observe(){} disconnect(){} };
  w.matchMedia = q => ({ matches: false, addListener(){}, addEventListener(){} });
  w.AudioContext = class {
    constructor(){ this.state='running'; this.currentTime=0; this.destination={}; this.sampleRate=44100; }
    createOscillator(){ return { type:'', frequency:{setValueAtTime(){}}, connect(){},start(){},stop(){} }; }
    createGain(){ return { gain:{value:0}, connect(){} }; }
    createBufferSource(){ return { buffer:null, connect(){},start(){},stop(){} }; }
    createBiquadFilter(){ return { connect(){} }; }
    createBuffer(){ return { getChannelData: () => new Float32Array(64) }; }
  };
  w.HTMLMediaElement.prototype.play = () => Promise.resolve();
  const noop = () => {};
  w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {
    get(_, k) { if (k === 'measureText') return () => ({ width: 10 }); return noop; },
    set(){ return true; }
  });
  w.requestAnimationFrame = cb => w.setTimeout(() => cb(Date.now()), 0);
  w.scrollTo = noop;
  w.Element.prototype.getBoundingClientRect = () =>
    ({ left:100, top:100, right:146, bottom:146, width:46, height:46, x:100, y:100 });
  for (const f of ['core/quest.js','core/save.js','core/juice.js','core/settings.js']) {
    w.eval(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'));
  }
  const NEU = w.NEU;
  ok('>>> the save file is loaded at boot <<<', NEU.save.data.room === 'a1_clearing');
  ok('flags came back', NEU.save.flagged('scal_dead') === true);
  ok('shake preference applied from the file', NEU.juice.noShake === true);
  ok('flash stays off (not set)', NEU.juice.noFlash === false);
  ok('large text applied from the file',
     w.document.documentElement.classList.contains('text-lg'));
}

/* ═══ 6. reduced motion forces the toggles ════════════════════════*/
console.log('\n6. prefers-reduced-motion still forces everything');
{
  const { w, NEU } = boot(true);
  ok('shake forced on', NEU.settings.shake === true);
  ok('flash forced on', NEU.settings.flash === true);
  ok('shake switch locked', w.document.getElementById('settShake').disabled === true);
  ok('flash switch locked', w.document.getElementById('settFlash').disabled === true);
  ok('text switch NOT locked', w.document.getElementById('settText').disabled === false);
  ok('the note explains', !!w.document.querySelector('.sett__note'));
  w.document.getElementById('settText').click();
  ok('larger text still works under reduced motion',
     w.document.documentElement.classList.contains('text-lg'));
  NEU.settings.open();
  ok('panel still opens', w.document.querySelector('.sett').hidden === false);
}

/* ═══ 7. the flash audit — nothing loops above 3Hz ════════════════*/
console.log('\n7. 3Hz audit, measured not assumed');
{
  /* Only infinite loops matter — a single brief flash is an event and
     is fine; a loop at 3Hz+ is a seizure trigger. The WCAG threshold
     is three flashes per second: a full cycle must take >= 0.333s. */
  const re = /animation:\s*([\w-]+)\s+([\d.]+s)[^;]*infinite/g;
  const found = [];
  let m;
  while ((m = re.exec(CSS))) found.push({ name: m[1], dur: parseFloat(m[2]) });
  ok('infinite animations were found to audit', found.length >= 5);
  const offenders = found.filter(f => f.dur < 0.333);
  ok('>>> nothing loops above 3Hz <<<', offenders.length === 0);
  found.forEach(f => console.log('      ' + f.name + '  ' + f.dur + 's/cycle'));

  const trip = CSS.split('body.is-trip')[1] || '';
  ok('is-trip is a static filter, not an animation',
     !/animation\s*:/.test(trip.split('}')[0]));
  ok('crackSpin is a rotation over 4s, not a luminance flash',
     /crackSpin 4s/.test(CSS) && /rotate\(360deg\)/.test(CSS));
  /* The one place the page blinks is the text cursor, at 1s — below
     the threshold, and it is a cursor. */
  ok('the fastest loop is the text cursor at 1s', /tblink 1s/.test(CSS));
}

/* ═══ 8. the ladder — settings below the dialogue box ═════════════*/
console.log('\n8. the z-index ladder holds');
{
  const sett = CSS.split('\n.sett {')[1].split('}')[0];
  const tbox = CSS.split('\n.tbox {')[1].split('}')[0];
  const zS = (sett.match(/z-index:\s*(\d+)/) || [])[1];
  const zT = (tbox.match(/z-index:\s*(\d+)/) || [])[1];
  ok('>>> .sett (z ' + zS + ') sits below .tbox (z ' + zT + ') <<<',
     parseInt(zS, 10) < parseInt(zT, 10));
  /* The rule is ORDER, not adjacency. The original regex demanded these
     three tags touch, so inserting core/touch.js between settings and
     dev reported a load-order break that had not happened. Anything
     that fails when an unrelated file is added is testing the wrong
     thing. */
  {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const at = f => html.indexOf('src="js/' + f + '"');
    const deck = at('game/deck.js'), sett = at('core/settings.js'), dev = at('core/dev.js');
    ok('all three script tags are present', deck > 0 && sett > 0 && dev > 0);
    ok('settings.js loads after deck.js', sett > deck);
    /* dev.js must be the last CLASSIC script. `page/scene.js` is a
       type="module" and therefore deferred until after parsing, so it
       sits below dev.js in the file without running before it. */
    const classic = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)];
    const lastClassic = classic[classic.length - 1];
    ok('>>> dev.js is the last classic script — it needs everything present <<<',
       dev > sett && lastClassic && lastClassic[1] === 'js/core/dev.js');
    ok('scene.js is a module, so its position does not matter',
       /<script type="module" src="js\/page\/scene\.js">/.test(html));
  }
}

/* ═══ 9. dev console reach ════════════════════════════════════════*/
console.log('\n9. the dev console can open it');
{
  const { w, NEU } = boot();
  const panel = w.document.querySelector('.sett');
  NEU.dev.run('set');
  ok('>>> `set` opens the settings panel <<<', panel.hidden === false);
  NEU.dev.run('help');
  const help = w.document.getElementById('devOut').textContent;
  ok('help mentions it', /set\s+open the settings panel/.test(help));
}

/* ═══ 10. harness honesty — the reduced check is not a tautology ══*/
console.log('\n10. the audit checks itself');
{
  /* Strip comments before scanning — the words "let" and "const"
     appear in prose, and matching those would be a test bug. */
  const code = S.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  ok('the settings file is ES5 (no arrow functions, no let/const)',
     !/=>/.test(code) && !/\blet\s+[A-Za-z_$]|\bconst\s+[A-Za-z_$]/.test(code));
  ok('and the panel never autoplays anything — no <audio> built',
     !/<audio/.test(code));
}

console.log('\nfixes12: ' + pass + ' ok, ' + fail + ' fail');
process.exit(fail ? 1 : 0);