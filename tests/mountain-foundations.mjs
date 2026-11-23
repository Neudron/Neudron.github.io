/* Headless regression checks for mountain engine foundations.
 * These tests exercise the real js/core/plat.js movement controller.
 * They do NOT verify that any of the three authored rooms can be completed;
 * input recordings / real gameplay still required to pass the design gate. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let checks = 0;
function check(name, fn) {
  try { fn(); checks++; console.log('ok - ' + name); }
  catch (err) { console.error('FAIL - ' + name); throw err; }
}
function makeGraphics() {
  const obj = {
    createRadialGradient() { return { addColorStop() {} }; },
    createLinearGradient() { return { addColorStop() {} }; },
    measureText() { return { width: 24 }; },
    getImageData() { return { data: new Uint8ClampedArray(4) }; }
  };
  return new Proxy(obj, {
    get(target, key) { return key in target ? target[key] : () => {}; },
    set(target, key, value) { target[key] = value; return true; }
  });
}
function makeCanvas() {
  return { width: 640, height: 360, hidden: false, style: {}, getContext: () => makeGraphics() };
}
const canvas = makeCanvas(), overlay = makeCanvas();
const fakeWindow = {
  NEU: {}, innerWidth: 640, innerHeight: 360, devicePixelRatio: 1,
  addEventListener() {}, matchMedia() { return { matches: false }; },
  performance: { now() { return 12345; } }
};
const fakeDocument = {
  getElementById(id) { return id === 'platCanvas' ? canvas : id === 'plat' ? overlay : null; },
  createElement() { return makeCanvas(); },
  addEventListener() {}
};
const realm = vm.createContext({
  window: fakeWindow, document: fakeDocument, performance: fakeWindow.performance,
  setTimeout() {}, clearTimeout() {}, Date, Math, console
});
for (const rel of ['js/core/plat.js', 'js/act4/mountain.js', 'js/act4/look-mountain.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), realm, { filename: rel });
}
const neu = fakeWindow.NEU, p = neu.plat;
assert.ok(p, 'platformer registered');

check('legacy ascent and descent rooms are still registered', () => {
  for (let n = 0; n < 8; n++) assert.ok(p.levels['m' + n]);
  for (let n = 0; n < 4; n++) {
    assert.ok(p.levels['h' + n]);
    assert.ok(p.levels['v' + n]);
  }
});
check('three original, tall, explicitly provisional prototype levels are authored', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const def = p.levels['mtest_' + difficulty];
    assert.ok(def, difficulty + ' exists');
    assert.ok(def.h > 18 && def.w >= 24, 'tall geometry');
    assert.equal(def.cameraMode, 'mountain');
    assert.equal(def.chunked, true);
    assert.equal(def.testing.status, 'simulated-route-passed');
    assert.ok(def.entities.some(e => e.t === 'exit'));
    assert.ok(def.grid.every(line => line.length === def.w), 'rectangular authored tile grid');
  }
});
check('camera stays finite and tracks tall room with no crash', () => {
  assert.ok(neu.mountain.openPrototype('hard'));
  const before = p.cam();
  for (let n = 0; n < 20; n++) p.step(1 / 60, 'jump');
  p.snap();
  const after = p.cam();
  assert.ok(Number.isFinite(before.x) && Number.isFinite(before.y));
  assert.ok(Number.isFinite(after.x) && Number.isFinite(after.y));
  assert.ok(after.y >= 0 && after.y <= p.level0().h * 16);
});
check('restart restores moved blocks, consumed refills and broken tiles', () => {
  assert.ok(neu.mountain.openPrototype('hard'));
  const room = p.level0();
  const zip = room.entities.find(e => e.t === 'zip');
  const refill = room.entities.find(e => e.t === 'refill');
  zip.x += 5; zip.go = true;
  refill.dead = true; refill.t0 = 2;
  room.broken = { '3,3': true };
  for (let n = 0; n < 6; n++) p.step(1 / 60, '');
  assert.ok(p.time() > 0);
  assert.equal(p.restartRoom(), true);
  const again = p.level0();
  assert.equal(again.entities.find(e => e.t === 'zip').x, p.levels.mtest_hard.entities.find(e => e.t === 'zip').x);
  assert.notEqual(again.entities.find(e => e.t === 'zip').go, true);
  assert.equal(again.entities.find(e => e.t === 'refill').dead, false);
  assert.equal(again.entities.find(e => e.t === 'refill').t0, 0);
  assert.equal(again.broken['3,3'], undefined);
  assert.equal(p.time(), 0);
});
check('checkpoint selection survives deterministic restart', () => {
  assert.ok(neu.mountain.openPrototype('medium'));
  const room = p.level0();
  const checkpoint = room.entities.find(e => e.t === 'checkpoint');
  room.spawn = { x: checkpoint.x, y: checkpoint.y - 1 };
  checkpoint.active = true;
  p.restartRoom();
  assert.equal(p.state.x, (checkpoint.x + 0.5) * 16);
  assert.equal(p.state.y, checkpoint.y * 16);
  assert.equal(p.level0().entities.find(e => e.t === 'checkpoint').active, true);
});
check('checkpoint revisits select spawn in legacy and prototype rooms', () => {
  for (const id of ['m0', 'mtest_medium']) {
    assert.ok(p.open(id));
    const room = p.level0();
    const a = room.entities.find(e => e.t === 'checkpoint') || { t: 'checkpoint', x: 4, y: 11 };
    if (!room.entities.includes(a)) room.entities.push(a);
    const b = { t: 'checkpoint', x: a.x + 5, y: a.y };
    room.entities.push(b);
    const callbacks = [];
    room.onCheckpoint = e => callbacks.push(e);
    for (const checkpoint of [a, b, a]) {
      const hero = p.hero();
      hero.x = (checkpoint.x + 0.5) * 16;
      hero.y = (checkpoint.y + 1) * 16;
      hero.vx = hero.vy = 0;
      p.step(1 / 60, '');
      assert.equal(room.spawn.x, checkpoint.x, id + ': touch selects spawn x');
      assert.equal(room.spawn.y, checkpoint.y - 1, id + ': touch selects spawn y');
    }
    assert.deepEqual(callbacks, [a, b], id + ': callback fires only on first activation');
    p.restartRoom();
    assert.equal(p.state.x, (a.x + 0.5) * 16, id + ': restart uses revisited checkpoint');
    assert.equal(p.state.y, a.y * 16, id + ': restart uses revisited checkpoint');
  }
});
check('author-configured wind accelerates an airborne player reproducibly', () => {
  function run(noWind) {
    assert.ok(neu.mountain.openPrototype('medium'));
    if (noWind) p.level0().wind = null;
    const velocities = [];
    p.step(1 / 60, 'jump');
    for (let n = 0; n < 14; n++) {
      p.step(1 / 60, 'jump');
      velocities.push(p.state.vx);
    }
    return velocities;
  }
  const calm = run(true), windy = run(false), again = run(false);
  assert.equal(calm[calm.length - 1], 0, 'no horizontal input in calm air');
  assert.ok(windy[windy.length - 1] > calm[calm.length - 1], 'wind moves player');
  assert.deepEqual(windy, again, 'fresh room produces same movement frames');
});
/* Gameplay simulation on the actual controller, not graph reachability.
 * This sequence was discovered by deterministic input-timing enumeration. */
check('easy prototype has a committed, deathless controller replay', () => {
  const def = p.levels.mtest_easy;
  assert.ok(Array.isArray(def.recording));
  const outcome = p.replay('mtest_easy', def.recording);
  assert.equal(outcome.reached, true);
  assert.equal(outcome.deaths, 0);
  assert.equal(outcome.frames, 94);
  assert.equal(def.testing.successFrames, outcome.frames);
  console.log('  easy valid input: ' + JSON.stringify(def.recording) +
    ' frames=' + outcome.frames + ' deaths=' + outcome.deaths);
});
check('headless replay does not corrupt the active mountain room identity', () => {
  assert.ok(neu.mountain.openPrototype('medium'));
  const before = neu.mountain.here();
  const result = p.replay('mtest_easy', p.levels.mtest_easy.recording);
  assert.equal(result.reached, true);
  assert.equal(neu.mountain.here(), before);
  assert.equal(p.levelId(), before);
});
check('quick death recovery retains a valid spawn', () => {
  assert.ok(neu.mountain.openPrototype('easy'));
  const initial = { ...p.state };
  p.die();
  for (let n = 0; n < 25; n++) p.step(1 / 60, '');
  assert.ok(!p.state.dead, 'respawn completed');
  assert.equal(p.state.x, initial.x);
  assert.equal(p.state.y, initial.y);
});
check('legacy scrolling respawn preserves camera easing', () => {
  assert.ok(p.open('h0'));
  const room = p.level0();
  room.view = 'terraria';
  p.hero().x = 600;
  p.snap();
  const displaced = p.cam();
  assert.ok(displaced.x > 0, 'room camera displaced from spawn');
  p.die();
  for (let n = 0; n < 36; n++) p.step(1 / 60, '');
  assert.ok(!p.state.dead, 'respawn completed');
  assert.deepEqual(p.cam(), displaced, 'respawn does not teleport camera to spawn');
  const now = fakeWindow.performance.now;
  fakeWindow.performance.now = () => now() + 1000 / 60;
  p.tick(1000 / 60);
  fakeWindow.performance.now = now;
  assert.ok(p.cam().x < displaced.x, 'legacy camera eases toward respawned player');
});
check('opt-in transition momentum carries into next mountain prototype', () => {
  assert.ok(neu.mountain.openPrototype('easy'));
  for (let n = 0; n < 9; n++) p.step(1 / 60, 'right');
  const previous = p.state;
  assert.ok(previous.vx > 0);
  assert.ok(p.open('mtest_medium', { carry: true }));
  assert.equal(p.state.vx, previous.vx);
  assert.equal(p.state.dashes, previous.dashes);
  assert.ok(p.open('h0'));
  assert.equal(p.state.vx, 0, 'legacy default room entry resets momentum');
});
check('non-mountain rooms keep preexisting entity persistence semantics', () => {
  assert.ok(p.open('h0'));
  const entity = p.level0().entities[0];
  const old = entity.x;
  entity.x += 2;
  entity.dead = true;
  p.restartRoom();
  assert.equal(p.level0().entities[0].x, old + 2);
  assert.equal(p.level0().entities[0].dead, true);
});
check('non-mountain platformer camera mode remains unchanged', () => {
  assert.ok(p.open('h0'));
  assert.notEqual(p.level0().cameraMode, 'mountain');
});

/* Advanced room: original geometry, real-controller replay, ablations, timing and reset.
   These checks exercise the real movement controller, not graph reachability. */
const ADV = 'mtest_reference';
function advPlay(rec, mutate) {
  p.open(ADV);
  const L = p.level0();
  if (mutate) mutate(L);
  const refill = L.entities.find(e => e.t === 'refill' && e.y === 18);
  const summit = L.entities.find(e => e.id === 'summit');
  let f = 0, deaths = 0, wasDead = false, refillTouched = false, cpTouched = false;
  for (const seg of rec) {
    for (let j = 0; j < seg[0]; j++) {
      const s = p.step(1 / 60, seg[1]);
      f++;
      if (s.dead && !wasDead) deaths++;
      wasDead = s.dead;
      if (refill && refill.t0 > 0) refillTouched = true;
      if (summit && summit.active) cpTouched = true;
      if (L.exited) break;
    }
    if (L.exited) break;
  }
  return { reached: !!L.exited, deaths, frames: f, end: { ...p.state }, refillTouched, cpTouched };
}
const advRec = () => p.levels[ADV].recording.map(pair => pair.slice());
const advSub = (idx, input) => advRec().map((pair, i) => i === idx ? [pair[0], input] : pair);

check('advanced room is an original, wider, isolated prototype with authored geometry', () => {
  const def = p.levels[ADV];
  assert.ok(def, 'advanced room exists');
  assert.equal(def.w, 112);
  assert.equal(def.h, 34);
  assert.equal(def.cameraMode, 'mountain');
  assert.equal(def.chunked, true);
  assert.equal(def.provenance, 'reference-informed, original implementation');
  assert.ok(neu.mountain.prototypes.indexOf(ADV) >= 0);
  assert.ok(def.w > 40, 'wider cinematic framing than the old 40-tile room');
  assert.equal(def.grid[30].substring(0, 17), '#################', 'start ground');
  assert.equal(def.grid[30].substring(17, 112), '^'.repeat(95), 'spike death floor');
  assert.equal(def.grid[25].substring(29, 47), '='.repeat(18), 'raised landing');
  assert.equal(def.grid[13].substring(56, 67), '^'.repeat(11), 'upper-shelf spikes');
  assert.equal(def.grid[5].substring(50, 67), '#'.repeat(17), 'reversal ceiling');
  assert.equal(def.grid[8].substring(36, 47), '='.repeat(11), 'exit shelf');
  assert.ok(def.entities.some(e => e.t === 'exit'));
});
check('advanced room has a deathless deterministic controller replay with earned checkpoint and airborne refill', () => {
  const def = p.levels[ADV];
  assert.ok(Array.isArray(def.recording));
  const outcome = p.replay(ADV, def.recording);
  assert.equal(outcome.reached, true);
  assert.equal(outcome.deaths, 0);
  assert.equal(outcome.frames, 356);
  assert.equal(def.testing.successFrames, outcome.frames);
  assert.ok(outcome.end.x > 690 && outcome.end.x < 715, 'exit reached on left exit shelf');
  const traced = advPlay(def.recording);
  assert.equal(traced.reached, true);
  assert.equal(traced.cpTouched, true, 'mid checkpoint earned on canonical route');
  assert.equal(traced.refillTouched, true, 'airborne refill consumed on canonical route');
});
check('advanced room defeats all-right, no-dash, no-reversal and refill-removal ablations', () => {
  const base = advRec();
  const noDashMap = { 'up right dash': 'right', 'up left dash': 'left', 'up dash': 'up', 'right dash': 'right' };
  const noDash = base.map(pair => [pair[0], noDashMap[pair[1]] || pair[1]]);
  const rightOnly = base.map(pair => [pair[0],
    ({ 'up right dash': 'right dash', 'up left dash': 'right dash', 'up dash': 'right dash' })[pair[1]] || pair[1]]);
  assert.equal(advPlay([[400, 'right']]).reached, false, 'careless running dies');
  assert.equal(advPlay(noDash).reached, false, 'no-dash bypass fails');
  assert.equal(advPlay(rightOnly).reached, false, 'simple right-dash bypass fails');
  assert.equal(advPlay(advSub(3, 'right')).reached, false, 'pit-1 up-right dash required');
  assert.equal(advPlay(advSub(14, 'up dash')).reached, false, 'no-reversal bypass fails');
  assert.equal(advPlay(advSub(9, 'right')).reached, false, 'second up-dash required');
  assert.equal(advPlay(base, L => {
    const r = L.entities.find(e => e.t === 'refill' && e.y === 18);
    r.dead = true; r.t0 = 999;
  }).reached, false, 'airborne refill is required before the second up-dash');
});
check('advanced room dash timings are multi-frame windows, not single-frame brittle', () => {
  const vary = (idx, value) => { const r = advRec(); r[idx][0] = value; return advPlay(r).reached; };
  assert.equal(vary(3, 8), true, 'adjacent up-right dash succeeds');
  assert.equal(vary(3, 10), true, 'late up-right dash succeeds');
  assert.equal(vary(3, 5), false, 'too-short up-right dash fails');
  assert.equal(vary(3, 14), false, 'too-long up-right dash fails');
  assert.equal(vary(14, 7), true, 'adjacent reversal dash succeeds');
  assert.equal(vary(14, 11), true, 'long reversal dash succeeds');
});
check('advanced room resets velocity and resource state after a death without a softlock', () => {
  assert.ok(p.open(ADV));
  let dead = false, respawned = false;
  for (let n = 0; n < 200 && !respawned; n++) {
    const s = p.step(1 / 60, 'right');
    if (s.dead) dead = true;
    if (dead && !s.dead) respawned = true;
  }
  assert.equal(dead, true, 'missed jump hits pit 1');
  assert.equal(respawned, true, 'quick respawn completes');
  assert.equal(p.state.vx, 0);
  assert.equal(p.state.vy, 0);
  assert.equal(p.state.dashes, 1);
  assert.equal(p.levelId(), ADV);
  assert.equal(p.replay(ADV, p.levels[ADV].recording).reached, true, 'room remains completable after a death');
});

console.log('mountain foundation: ' + checks + ' checks passed; advanced room route, ablations and reset verified');
