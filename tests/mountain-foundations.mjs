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
    assert.equal(def.testing.status, 'not-playtested');
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
check('quick death recovery retains a valid spawn', () => {
  assert.ok(neu.mountain.openPrototype('easy'));
  const initial = { ...p.state };
  p.die();
  for (let n = 0; n < 25; n++) p.step(1 / 60, '');
  assert.ok(!p.state.dead, 'respawn completed');
  assert.equal(p.state.x, initial.x);
  assert.equal(p.state.y, initial.y);
});
check('non-mountain platformer camera mode remains unchanged', () => {
  assert.ok(p.open('h0'));
  assert.notEqual(p.level0().cameraMode, 'mountain');
});

console.log('mountain foundation: ' + checks + ' checks passed; full movement-route evidence remains pending');
