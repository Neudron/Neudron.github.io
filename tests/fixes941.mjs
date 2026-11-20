/* fixes941.mjs — DL-ASSETS: the downloaded Deltarune/FNF fan art is recorded
   as OWNER-ACCEPTED-FAN-USE, never as cleared, and the turnbattle jar stays
   out of the artifact.

   Run after `npm run build`: node tests/fixes941.mjs

   Three things have to stay true together, and each one is a silent
   failure in source review:

   §1 CREDITS. `img/act4/CREDITS.md` is gitignored, so nothing in the build
       forces it to describe the `img/act4/fan/**` files at all. A credits
       file that stops naming a group is indistinguishable from a group
       that was never added. Every fan group is looked up by its path and
       must carry both OWNER-ACCEPTED-FAN-USE and NOT CLEARED on its row.
   §2 NO CLEARANCE CLAIM. The repo already has one owner risk decision; the
       risk is that a later edit softens "NOT CLEARED" into "CLEARED" and the
       file still reads well. Checked by deleting every "NOT CLEARED" from the
       fan rows and asserting no "CLEARED" survives.
   §3 THE JAR. `turnbattle-2.0.29.jar` was analysed for its fighting-box
       mechanics. Its code is MIT; its 52 OGG/WAV files and 298 textures are
       UNKNOWN. dist/ is public: the jar, its audio and its textures must not
       be there, and no audio file may appear under dist/img/. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const CREDITS = path.join(ROOT, 'img/act4/CREDITS.md');
const FAN = path.join(ROOT, 'img/act4/fan');

let pass = 0, fail = 0;
const ok = (n, c, d) => {
  if (c) { pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); }
};
const walk = (dir, out = [], root = dir) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out, root); else out.push(path.relative(root, p).split(path.sep).join('/'));
  }
  return out;
};

/* The groups CREDITS must name. A path ending in "/" is a prefix group. */
const GROUPS = [
  { id: 'deltarune HUD + battle menu', path: 'img/act4/fan/deltarune/hud.png' },
  { id: 'battle menu sheet', path: 'img/act4/fan/deltarune/battle-menu.png' },
  { id: 'battle background sequence', path: 'img/act4/fan/deltarune/bg/' },
  { id: 'battle box sequence', path: 'img/act4/fan/deltarune/box/' },
  { id: 'chapter 3 intro sequence', path: 'img/act4/fan/deltarune/intro/' },
  { id: "Tenna's Funny Text sequences", path: 'img/act4/fan/deltarune/funny-text/' },
  { id: 'Tenna sheet', path: 'img/act4/fan/deltarune/tenna.png' },
  { id: 'Sans sheet', path: 'img/act4/fan/deltarune/sans.png' },
  { id: 'Spelling Bee crowd', path: 'img/act4/fan/deltarune/spelling-bee-crowd.png' },
  { id: 'Weird Route FX', path: 'img/act4/fan/deltarune/weird-route-fx.png' },
  { id: 'effects sheet', path: 'img/act4/fan/deltarune/effects.png' },
  { id: 'explosion sheet', path: 'img/act4/fan/deltarune/explosion.png' },
  { id: 'Week 4-only FNF arrow crop', path: 'img/act4/fan/fnf-week4/' }
];
const inGroup = (file, p) => (p.endsWith('/') ? file.startsWith(p) : file === p);
const fanFiles = fs.existsSync(FAN) ? walk(FAN).map((f) => 'img/act4/fan/' + f) : [];

console.log('\n1. CREDITS.md records every fan group as fan-use, not cleared');
ok('img/act4/CREDITS.md exists', fs.existsSync(CREDITS));
if (!fs.existsSync(CREDITS)) {
  console.log('\nf0 failed, ' + pass + ' passed');
  process.exit(1);
}
const credits = fs.readFileSync(CREDITS, 'utf8');
const rows = credits.split('\n').filter((l) => /^\s*\|/.test(l));
const rowFor = (p) => rows.filter((r) => r.includes(p));
for (const g of GROUPS) {
  const rs = rowFor(g.path);
  ok('row names ' + g.id, rs.length > 0, g.path);
  for (const r of rs) {
    ok('  ' + g.id + ': OWNER-ACCEPTED-FAN-USE', /OWNER-ACCEPTED-FAN-USE/.test(r));
    ok('  ' + g.id + ': NOT CLEARED', /NOT\s+CLEARED/.test(r));
    /* strip the negation first: only then is a remaining CLEARED a claim */
    ok('  ' + g.id + ': no bare CLEARED', !/\bCLEARED\b/.test(r.replace(/NOT\s+CLEARED/g, 'NOT')));
  }
}
ok('CREDITS names the rightsholders',
  /Toby Fox/.test(credits) && /Funkin' Crew/.test(credits));
ok('CREDITS claims no rightsholder licence for the fan art',
  /no rightsholder licence is claimed/i.test(credits));
ok('CREDITS never marks a fan group CLEARED',
  rows.every((r) => !/^\s*\|.*img\/act4\/fan\//.test(r) || !/\bCLEARED\b/.test(r.replace(/NOT\s+CLEARED/g, 'NOT'))));

console.log('\n2. every staged fan file falls under a named group');
const orphans = fanFiles.filter((f) => !GROUPS.some((g) => inGroup(f, g.path)));
ok('no fan file is missing from CREDITS', orphans.length === 0, orphans.slice(0, 5));
ok('fan art is staged (' + fanFiles.length + ' files)', fanFiles.length > 1000, fanFiles.length);
ok('fan art is PNG only, no audio smuggled into img/',
  fanFiles.every((f) => /\.png$/i.test(f)),
  fanFiles.filter((f) => !/\.png$/i.test(f)).slice(0, 5));

console.log('\n3. dist ships the fan art and nothing from the jar');
ok('dist exists (run npm run build first)', fs.existsSync(DIST));
if (fs.existsSync(DIST)) {
  const files = walk(DIST);
  const shippedFan = files.filter((f) => f.startsWith('img/act4/fan/'));
  ok('dist ships the fan art (' + shippedFan.length + ' files)',
    shippedFan.length === fanFiles.length && fanFiles.length > 0, shippedFan.length);
  const missing = fanFiles.filter((f) => !files.includes(f));
  ok('dist ships every fan file byte-for-byte', missing.length === 0, missing.slice(0, 5));
  const jars = files.filter((f) => /\.jar$/i.test(f));
  ok('dist contains no .jar', jars.length === 0, jars);

  /* Names taken from turnbattle-2.0.29.jar assets/turnbattle/sounds/. A new
     audio file with one of these names in dist means jar content leaked. */
  const jarSounds = ['mus_battle_lightner', 'mus_battle_mob', 'mus_battle_psi',
    'mus_faint_courage', 'mus_intronoise', 'battle_start', 'defeatsfx', 'slash',
    'snd_dtrans_drone', 'snd_dtrans_flip', 'snd_dtrans_lw', 'snd_dtrans_square',
    'snd_dtrans_twinkle', 'snd_mercyadd', 'snd_removesoul', 'snd_removesoul_world',
    'snd_fountain_make', 'snd_fountain_target', 'snd_rudebuster_swing', 'snd_chargejump_1',
    'snd_chargeshot_charge', 'snd_chargeshot_fire', 'snd_graze', 'snd_petrify',
    'snd_ominous', 'snd_ominous_cancel', 'snd_power', 'snd_swoon', 'snd_usefountain',
    'snd_levelupmix', 'snd_great_shine', 'snd_deathnoise', 'snd_revival', 'snd_save'];
  const audio = files.filter((f) => /\.(?:ogg|wav|mp3|flac)$/i.test(f));
  const leaked = audio.filter((f) => jarSounds.some((n) => path.basename(f).startsWith(n)));
  ok('dist plays none of the jar audio', leaked.length === 0, leaked.slice(0, 5));
}

console.log('\nfixes941: ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;