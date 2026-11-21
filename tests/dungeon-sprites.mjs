/* Dungeon sprite rendering regression tests.
   Run: node tests/dungeon-sprites.mjs (no browser or extra dependencies). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lookSource = fs.readFileSync(path.join(ROOT, 'js/act4/look-dungeon.js'), 'utf8');
const foesSource = fs.readFileSync(path.join(ROOT, 'js/act4/dgn-foes.js'), 'utf8');
new vm.Script(lookSource);
new vm.Script(foesSource);

// Fake a same-origin PNG and a 2D canvas with a pixel buffer.
function picture(w, h, fill = [0, 0, 0, 255]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) data.set(fill, i);
  return { naturalWidth: w, naturalHeight: h, width: w, height: h, data };
}
function pixel(im, x, y, value) {
  im.data.set(value, (y * im.width + x) * 4);
}
function at(im, x, y) {
  return [...im.data.slice((y * im.width + x) * 4, (y * im.width + x) * 4 + 4)];
}
function canvas() {
  const cv = { width: 0, height: 0, data: null };
  cv.getContext = () => ({
    drawImage(im) { cv.data = im.data.slice(); },
    getImageData() { return { data: cv.data.slice() }; },
    putImageData(im) { cv.data = im.data.slice(); }
  });
  return cv;
}

const im = picture(7, 7);
for (let y = 1; y <= 5; y++) for (let x = 1; x <= 5; x++) pixel(im, x, y, [215, 72, 51, 255]);
pixel(im, 3, 3, [0, 0, 0, 255]); // protected interior outline/eye
const tiled = picture(7, 7);
const prepared = picture(7, 7, [0, 0, 0, 0]);
pixel(prepared, 3, 3, [255, 0, 0, 255]);
const images = { actor: im, tile: tiled, prepared };
const plat = {
  _kinds: {}, painters: [], spr() {}, reduced() { return false; },
  dropChunks() {}
};
const window = { NEU: {
  plat,
  dgSheets: {
    dgSkull: { src: 'actor', fw: 7, fh: 7, frames: 1 },
    dgBlue: { src: 'tile', fw: 7, fh: 7, frames: 1 },
    dgFxBullet: { src: 'prepared', fw: 7, fh: 7, frames: 1 }
  },
  sheetImg(src) { return images[src]; },
  sheetReady(sh) { return images[sh.src]; }
} };
vm.runInNewContext(lookSource, { window, document: { createElement: canvas } });
const look = window.NEU.dungeonLook;
assert.ok(look);
const cleaned = look.sheet('dgSkull');
assert.notEqual(cleaned, im, 'opaque matte is baked into a transparent canvas');
assert.equal(at(cleaned, 0, 0)[3], 0, 'black border becomes transparent');
assert.equal(at(cleaned, 3, 3)[3], 255, 'interior black features stay opaque');
assert.deepEqual(at(cleaned, 1, 1), [215, 72, 51, 255], 'sprite body is unchanged');
assert.equal(look.sheet('dgSkull'), cleaned, 'cleaning is cached');
assert.equal(look.sheet('dgBlue'), tiled, 'solid tile black is never removed');
assert.equal(look.sheet('dgFxBullet'), prepared, 'already transparent art is unchanged');

const calls = [];
const ctx = {
  imageSmoothingEnabled: true,
  save() {}, restore() {},
  translate(...args) { calls.push(['translate', ...args]); },
  rotate(angle) { calls.push(['rotate', angle]); },
  scale(...args) { calls.push(['scale', ...args]); },
  drawImage(...args) { calls.push(['drawImage', ...args]); },
  fillRect() {}
};
assert.equal(look.cut(ctx, 'dgSkull', 0, 0, 7, 7, 20, 30, false, Math.PI), true);
assert.equal(calls.filter(c => c[0] === 'rotate').length, 1, 'rotation is applied');
assert.equal(calls.filter(c => c[0] === 'drawImage').length, 1, 'one atlas frame is drawn');
assert.equal(look.cut(ctx, 'dgSkull', 10, 0, 7, 7, 20, 30), false, 'out-of-bounds frame is rejected');

const foeWindow = { NEU: { plat: { levels: { dgn: { spawners: [] } } } } };
vm.runInNewContext(foesSource, { window: foeWindow });
const frameOf = foeWindow.NEU.dgnFoes.frameOf;
assert.equal(typeof frameOf, 'function');
for (const [ai, count] of [
  ['fighter', 20], ['fighter', 1], ['warlock', 4], ['ranged', 21],
  ['ranged', 1], ['caster', 3], ['skull', 6], ['spirit', 5], ['wheel', 4]
]) {
  for (let i = 0; i < 100; i++) {
    const f = { d: { ai }, walked: i * 4, vx: i % 2 ? 60 : 0,
      ground: i % 3 !== 0, warn: i % 5 === 0, t: (i % 10) / 10,
      aim: { x: 100, y: i * 3 }, x: 10, y: 30, glow: i % 2, st: i % 3 };
    const fr = frameOf(f, { frames: count }, i * 160);
    assert.ok(Number.isInteger(fr) && fr >= 0 && fr < count,
      ai + ' frame ' + fr + ' is outside ' + count + ' frames');
  }
}
console.log('dungeon sprites: matte removal, alpha preservation, rotation, atlas bounds and animation windows pass');
