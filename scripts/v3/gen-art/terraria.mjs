#!/usr/bin/env node
/*
 * terraria.mjs — deterministic ORIGINAL pixel-art generator for the Terraria-family
 * rights_pending slots. Reads the source PNG headers for exact dimensions, then draws
 * generic original shapes (hooded travellers, a floating eye, a rusty axe, a recall
 * stone, stepped brick/wood/metal/earth tiles) into RGBA PNGs.
 *
 * No source pixels, palettes, silhouettes, names or logos are copied. Only filenames,
 * pixel dimensions and frame strides are preserved so the integrator can repoint
 * js/data/sheets.js without changing any layout code.
 *
 * Usage: node scripts/v3/gen-art/terraria.mjs
 *        NEU_ART_OUT=/tmp/x node scripts/v3/gen-art/terraria.mjs   (test override)
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SRC_T = path.join(ROOT, 'img/act4/terraria');
const SRC_Z = path.join(ROOT, 'img/act4/tiles');
const OUT_BASE = process.env.NEU_ART_OUT || path.join(ROOT, 'img/act4/original');

/* ── tiny PNG codec (built-ins only, fully deterministic) ─────────────── */
const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRCT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRCT[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(w, h, rgba) {
  const stride = w * 4, raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
function header(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), depth: b[24], color: b[25] };
}

/* ── deterministic helpers ────────────────────────────────────────────── */
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function h2(x, y, s) { let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(s + 1, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; }

class Canvas {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8Array(w * h * 4); }
  px(x, y, c, a = 255) {
    x = x | 0; y = y | 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    if (a >= 255) { this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = 255; }
    else if (a > 0) { const old = this.d[i + 3] / 255, k = a / 255, oa = old + k * (1 - old); this.d[i] = (c[0] * k + this.d[i] * old * (1 - k)) / oa; this.d[i + 1] = (c[1] * k + this.d[i + 1] * old * (1 - k)) / oa; this.d[i + 2] = (c[2] * k + this.d[i + 2] * old * (1 - k)) / oa; this.d[i + 3] = oa * 255; }
  }
  rect(x, y, w, h, c, a) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c, a); }
  box(x, y, w, h, c) { this.rect(x, y, w, 1, c); this.rect(x, y + h - 1, w, 1, c); this.rect(x, y, 1, h, c); this.rect(x + w - 1, y, 1, h, c); }
  hline(x, y, w, c) { this.rect(x, y, w, 1, c); }
  vline(x, y, h, c) { this.rect(x, y, 1, h, c); }
}

/* ── palettes: original, stepped dark→light ──────────────────────────── */
const P = {
  stoneB: ['#1A1F36', '#28304F', '#39456D', '#52608F', '#7484B4'],
  stoneG: ['#14261F', '#1D3B30', '#2A5544', '#3D7159', '#5C9377'],
  stoneP: ['#28182E', '#3C2342', '#563258', '#784871', '#A06796'],
  storm:  ['#0A0C1A', '#141A34', '#202A4C', '#31406B', '#4A5C90'],
  wood:   ['#231C1C', '#332822', '#47372B', '#5F4A38', '#7C6249'],
  metal:  ['#1B2028', '#2A333F', '#3C4A59', '#546577', '#71899C'],
  earth:  ['#1B1A16', '#2A2A20', '#3B3B2B', '#52513A', '#6E6B4D'],
  moss:   ['#14231E', '#1E362B', '#2B4C3A', '#3C674E', '#568867'],
  cloth:  ['#17122A', '#241C42', '#362C5C', '#4E407E', '#7767A8'],
  bone:   ['#2A2636', '#413B52', '#5E5673', '#817897', '#ADA3BF'],
  ember:  ['#2A1318', '#46201F', '#693126', '#8E4A2C', '#C98345'],
  gold:   ['#2C2114', '#453419', '#614C22', '#87672F', '#B9944A'],
  eye:    ['#191426', '#2E2442', '#4A3A6B', '#8D7FC0', '#DFD6F5'],
  ink:    ['#0B0912', '#141020', '#1E1830', '#2A2240', '#3B3154']
};
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const CP = {}; for (const k in P) CP[k] = P[k].map(hex);

/* ── seamless tile: 16px art, edges forced equal ──────────────────────── */
function seamlessTile(C, ox, oy, n, pal, seed, style) {
  const bs = 4, m = n / bs, g = (x, y) => h2((x % m + m) % m, (y % m + m) % m, seed);
  const pal0 = pal[0], pal1 = pal[1];
  for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) {
    const edge = x === 0 || y === 0 || x === m - 1 || y === m - 1;
    let k = 2 + (g(x, y) % (pal.length - 2));
    if (style === 'metal') k = (x + y) % 2 ? Math.max(3, k) : k;
    if (style === 'wood') k = y % 2 ? 3 : 2;
    if (style === 'moss') k = 2 + (g(x, y) % 3);
    C.rect(ox + x * bs, oy + y * bs, bs, bs, edge ? pal0 : pal[k]);
  }
  /* sparse interior chips, always clear of the wrap edges */
  const r = rng(seed);
  for (let i = 0; i < m; i++) {
    const x = 4 + ((r() * (n - 8)) | 0), y = 4 + ((r() * (n - 8)) | 0);
    if (style === 'earth' || style === 'moss') C.rect(ox + x, oy + y, 2, 2, pal[3]);
    else if (style === 'metal') C.px(ox + x, oy + y, pal[4]);
    else if (style === 'wood') C.hline(ox + 4, oy + y, n - 8, pal1);
  }
  if (style === 'brick') {
    C.hline(ox, oy + 7, n, pal0); C.hline(ox, oy + 8, n, pal0);
    C.vline(ox + 7, oy + 1, 6, pal0); C.vline(ox + 7, oy + 9, 6, pal0);
    C.vline(ox, oy, n, pal0); C.vline(ox + n - 1, oy, n, pal0);
    C.hline(ox, oy, n, pal0); C.hline(ox, oy + n - 1, n, pal0);
  }
  if (style === 'crack') {
    const sx = 4 + (seed % 5), sy = 3 + ((seed >>> 3) % 8);
    C.px(ox + sx, oy + sy, pal0); C.px(ox + sx + 1, oy + sy + 1, pal0);
    C.px(ox + sx + 2, oy + sy + 2, pal0); C.px(ox + sx + 1, oy + sy + 3, pal0);
  }
}

/* ── generic original silhouettes ─────────────────────────────────────── */
function humanoid(C, ox, oy, fw, fh, pal, seed, f, style) {
  const cx = (fw / 2) | 0, foot = fh - 1, phase = f % 4;
  const bob = phase % 2, sway = phase < 2 ? 1 : -1;
  const d = pal[0], m = pal[2], l = pal[3], hi = pal[4];
  if (style === 'wisp') {
    const w = Math.max(12, (fw * 0.6) | 0), hh = Math.max(12, (fh * 0.55) | 0), top = 2 + bob;
    C.rect(ox + cx - (w / 2 | 0), oy + top, w, hh, m);
    C.rect(ox + cx - (w / 2 | 0) + 2, oy + top + 2, w - 4, hh - 4, l);
    C.rect(ox + cx - 2, oy + top - 2, 5, 4, hi);
    C.px(ox + cx - 3, oy + top + hh / 2 | 0, d); C.px(ox + cx + 3, oy + top + hh / 2 | 0, d);
    C.rect(ox + cx - (w / 2 | 0) + 2, oy + top + hh, w - 4, 2, d, 150);
    return;
  }
  if (style === 'eye') {
    const w = Math.max(16, (fw * 0.78) | 0), hh = Math.max(12, (fh * 0.55) | 0), top = 2 + bob;
    C.rect(ox + cx - (w / 2 | 0), oy + top, w, hh, pal[1]);
    C.rect(ox + cx - (w / 2 | 0) + 1, oy + top + 1, w - 2, hh - 2, l);
    C.rect(ox + cx - (w / 4 | 0), oy + top + 2, w / 2 | 0, hh - 4, hi);
    C.rect(ox + cx - 3 + sway, oy + top + 3, 6, hh - 6, pal[0]);
    C.px(ox + cx + 1 + sway, oy + top + 5, l);
    return;
  }
  if (style === 'gear') {
    const r = Math.min(fw, fh) / 2 - 2, cy = (fh / 2) | 0;
    C.rect(ox + cx - r, oy + cy - r, r * 2 + 1, r * 2 + 1, d);
    C.rect(ox + cx - r + 2, oy + cy - r + 2, r * 2 - 3, r * 2 - 3, m);
    C.rect(ox + cx - 4, oy + cy - 4, 9, 9, hi);
    C.rect(ox + cx - 1 + (f % 2), oy + cy - 1, 3, 3, d);
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; C.px(ox + cx + Math.round(Math.cos(a) * (r + 1)), oy + cy + Math.round(Math.sin(a) * (r + 1)), l); }
    return;
  }
  /* hooded / cloaked humanoid: feet anchored at the bottom of each frame */
  const bw = Math.max(6, (fw * 0.30) | 0), hw = Math.max(7, (fw * 0.34) | 0);
  const hh = Math.max(6, Math.min(14, (fh * 0.26) | 0)), top = 1 + bob;
  const bs = top + hh + 2, bh = foot - bs;
  C.rect(ox + cx - 2, oy + foot - 4, 2, 4, d);
  C.rect(ox + cx + 1 + sway, oy + foot - 4, 2, 4, d);
  C.rect(ox + cx - bw, oy + bs, bw * 2 + 1, bh, d);
  C.rect(ox + cx - bw + 1, oy + bs + 1, bw * 2 - 1, bh - 2, m);
  C.rect(ox + cx - bw + 1, oy + foot - 5, bw * 2 - 1, 4, l);
  C.rect(ox + cx - bw + 2, oy + bs + 2, 2, bh - 7, l);
  C.rect(ox + cx - bw - 2, oy + bs + 3 + (phase < 2 ? 0 : 2), 3, bh - 8, d);
  C.rect(ox + cx + bw - 1, oy + bs + 3 + (phase < 2 ? 2 : 0), 3, bh - 8, d);
  C.rect(ox + cx - (hw / 2 | 0) - 1, oy + top, hw + 2, hh + 2, d);
  C.rect(ox + cx - (hw / 2 | 0), oy + top + 1, hw, hh, l);
  C.rect(ox + cx - (hw / 2 | 0) + 2, oy + top + 2, hw - 4, Math.max(3, hh - 6), m);
  if (style === 'skull') {
    C.rect(ox + cx - 2, oy + top + hh / 2 | 0, 5, 3, d);
    C.px(ox + cx - 1, oy + top + (hh / 2 | 0), hi); C.px(ox + cx + 1, oy + top + (hh / 2 | 0), hi);
  } else {
    C.px(ox + cx - 2, oy + top + 3, hi); C.px(ox + cx + 1, oy + top + 3, hi);
  }
  if (style === 'blade') { C.rect(ox + cx + bw + 2, oy + bs + 2, 3, bh - 3, hi); C.rect(ox + cx + bw + 1, oy + bs + bh - 4, 5, 3, d); }
  if (style === 'wide') { C.rect(ox + cx - bw - 4, oy + bs + 6, 5, 6, l); C.rect(ox + cx + bw, oy + bs + 6, 5, 6, m); }
}

/* ── prop / item shapes ───────────────────────────────────────────────── */
function prop(C, ox, oy, w, h, pal, seed, kind) {
  const cx = (w / 2) | 0, d = pal[0], m = pal[2], l = pal[3], hi = pal[4];
  if (kind === 'brick' || kind === 'wall' || kind === 'grass' || kind === 'crack' || kind === 'spike' || kind === 'chain' || kind === 'shelf') {
    const art = w === 18 ? 16 : w === 36 ? 32 : w;
    seamlessTile(C, ox, oy, art, pal, seed, kind === 'wall' ? 'brick' : kind === 'grass' ? 'moss' : kind === 'brick' || kind === 'crack' ? 'brick' : kind === 'spike' ? 'metal' : kind === 'chain' ? 'metal' : 'wood');
    if (kind === 'spike') { for (let i = 2; i < w - 4; i += 4) for (let y = 0; y < 7; y++) C.rect(ox + i + (6 - y) / 2 | 0, oy + y + 6, 2, 1, y > 3 ? hi : l); }
    if (kind === 'chain') { C.box(ox + 5, oy + 5, 6, 6, l); C.box(ox + 4, oy + 4, 6, 6, d); }
    if (kind === 'grass') { for (let i = 1; i < w - 2; i += 3) C.rect(ox + i, oy + 1 + ((seed + i) % 3), 1, 3, hi); }
    return;
  }
  if (kind === 'pot') {
    C.rect(ox + 6, oy + 4, w - 12, 4, d); C.rect(ox + 7, oy + 3, w - 14, 2, l);
    C.rect(ox + 4, oy + 8, w - 8, h - 14, m); C.rect(ox + 5, oy + 9, w - 10, h - 17, l);
    C.rect(ox + 4, oy + h - 8, w - 8, 3, d); C.hline(ox + 5, oy + 11, w - 10, hi);
    return;
  }
  if (kind === 'book') {
    C.rect(ox + 2, oy + 4, w - 4, h - 8, d); C.rect(ox + 3, oy + 5, w - 6, h - 10, m);
    for (let i = 6; i < w - 6; i += 5) C.rect(ox + i, oy + 8 + ((i % 3)), 3, h - 14, pal[(i + seed) % pal.length]);
    C.hline(ox + 2, oy + 18, w - 4, l);
    return;
  }
  if (kind === 'banner') {
    C.rect(ox + 3, oy + 2, w - 6, h - 4, d); C.rect(ox + 4, oy + 4, w - 8, h - 8, m);
    C.rect(ox + cx - 2, oy + 10, 5, 12, l); C.rect(ox + cx - 4, oy + 13, 9, 4, hi);
    C.hline(ox + 2, oy + 2, w - 4, pal[3]);
    return;
  }
  if (kind === 'lantern' || kind === 'candle') {
    const ly = Math.max(4, h - 20);
    if (kind === 'lantern') { C.vline(ox + cx, oy + 1, ly - 4, d); C.box(ox + cx - 5, oy + ly, 11, 14, d); C.rect(ox + cx - 3, oy + ly + 2, 7, 10, pal[3]); C.rect(ox + cx - 1, oy + ly + 4, 3, 6, hi); }
    else { C.rect(ox + 5, oy + 6, w - 10, h - 8, m); C.rect(ox + 6, oy + 4, w - 12, 3, l); C.rect(ox + cx - 1, oy + 1, 2, 4, hi); }
    return;
  }
  if (kind === 'sign') { C.rect(ox + 3, oy + 8, w - 6, h - 16, d); C.rect(ox + 4, oy + 9, w - 8, h - 18, l); C.hline(ox + 6, oy + 14, w - 12, d); C.vline(ox + cx, oy + 12, 6, d); return; }
  if (kind === 'link') { C.box(ox + 2, oy + 2, w - 4, h - 4, l); C.box(ox + 4, oy + 4, w - 8, h - 8, d); return; }
  if (kind === 'hammer') { C.rect(ox + cx - 1, oy + 8, 3, h - 14, m); C.rect(ox + 8, oy + 4, w - 16, 8, d); C.rect(ox + 9, oy + 5, w - 18, 5, l); C.rect(ox + 6, oy + 6, 4, 5, m); return; }
  if (kind === 'axe') {
    C.rect(ox + cx - 1, oy + 8, 3, h - 11, CP.wood[3]); C.rect(ox + cx, oy + 9, 1, h - 13, CP.wood[4]);
    C.rect(ox + 4, oy + 4, 13, 15, d); C.rect(ox + 5, oy + 5, 10, 13, CP.metal[3]);
    C.rect(ox + 5, oy + 5, 3, 13, CP.metal[4]); C.rect(ox + 17, oy + 7, 5, 9, CP.metal[4]);
    C.rect(ox + 15, oy + 5, 3, 14, CP.metal[2]); return;
  }
  if (kind === 'mushroom') {
    C.rect(ox + cx - 3, oy + 10, 6, h - 11, CP.bone[3]); C.rect(ox + cx - 2, oy + 11, 2, h - 13, CP.bone[4]);
    C.rect(ox + 1, oy + 5, w - 2, 9, d); C.rect(ox + 2, oy + 4, w - 4, 8, CP.ember[4]);
    C.rect(ox + 3, oy + 6, 3, 2, CP.bone[4]); C.rect(ox + w - 6, oy + 8, 3, 2, CP.bone[4]);
    C.px(ox + cx, oy + 5, CP.bone[4]); return;
  }
  if (kind === 'potion') {
    C.rect(ox + 5, oy + 1, 6, 3, CP.gold[3]); C.rect(ox + 4, oy + 4, 8, 2, d);
    C.rect(ox + 2, oy + 5, w - 4, h - 6, d); C.rect(ox + 3, oy + 6, w - 6, h - 8, CP.eye[3]);
    C.rect(ox + 3, oy + h - 6, w - 6, 3, CP.ember[4]); C.rect(ox + 4, oy + 7, 2, h - 11, CP.eye[4]);
    C.px(ox + w - 5, oy + 9, CP.bone[4]); return;
  }
  if (kind === 'stone') {
    C.rect(ox + 9, oy + 5, w - 18, h - 10, CP.ink[0]); C.rect(ox + 11, oy + 7, w - 22, h - 14, CP.stoneB[2]);
    C.rect(ox + 13, oy + 9, w - 26, h - 18, CP.stoneB[3]); C.rect(ox + cx - 3, oy + 13, 7, 3, CP.gold[4]);
    C.rect(ox + cx - 1, oy + 9, 3, 12, CP.gold[3]); C.box(ox + 10, oy + 12, w - 20, 9, CP.stoneB[4]); return;
  }
}

/* ── file specs: layout from js/data/sheets.js, never from source pixels ─ */
const T = {
  'Chain.png': ['link', 'metal', 12, 12],
  'NPC_269.png': ['ragged', 'bone', 46, 42], 'NPC_273.png': ['ragged', 'cloth', 40, 42], 'NPC_277.png': ['ragged', 'moss', 50, 42],
  'NPC_281.png': ['hood', 'cloth', 40, 56], 'NPC_283.png': ['hood', 'bone', 40, 56], 'NPC_285.png': ['hood', 'ember', 42, 56],
  'NPC_287.png': ['blade', 'metal', 44, 56], 'NPC_288.png': ['wisp', 'eye', 28, 34], 'NPC_289.png': ['skull', 'bone', 52, 64],
  'NPC_290.png': ['wide', 'gold', 66, 48], 'NPC_291.png': ['tall', 'cloth', 68, 60], 'NPC_292.png': ['tall', 'stoneB', 60, 60], 'NPC_293.png': ['tall', 'stoneG', 60, 60],
  'NPC_34.png': ['skull', 'bone', 28, 30], 'NPC_37.png': ['tall', 'gold', 40, 56],
  'NPC_70.png': ['eye', 'eye', 34, 34], 'NPC_72.png': ['gear', 'metal', 34, 36],
  'Projectile_300.png': ['hammer', 'metal', 38, 38],
  'Tiles_101.png': ['book', 'wood', 1996, 71], 'Tiles_19.png': ['shelf', 'wood', 18, 18], 'Tiles_2.png': ['grass', 'moss', 18, 18],
  'Tiles_214.png': ['chain', 'metal', 18, 18], 'Tiles_28.png': ['pot', 'earth', 36, 36],
  'Tiles_41.png': ['brick', 'stoneB', 18, 18], 'Tiles_42.png': ['lantern', 'gold', 70, 36], 'Tiles_43.png': ['brick', 'stoneG', 18, 18], 'Tiles_44.png': ['brick', 'stoneP', 18, 18],
  'Tiles_48.png': ['spike', 'metal', 18, 18], 'Tiles_481.png': ['crack', 'stoneB', 18, 18], 'Tiles_482.png': ['crack', 'stoneG', 18, 18], 'Tiles_483.png': ['crack', 'stoneP', 18, 18],
  'Tiles_49.png': ['candle', 'ember', 18, 22], 'Tiles_55.png': ['sign', 'wood', 36, 36], 'Tiles_91.png': ['banner', 'stoneP', 18, 54],
  'Wall_7.png': ['wall', 'stoneB', 36, 36], 'Wall_97.png': ['wall', 'stoneP', 36, 36], 'Wall_98.png': ['wall', 'stoneG', 36, 36],
  'axe.png': ['axe', 'metal', 34, 30], 'mushroom.png': ['mushroom', 'moss', 22, 24], 'recall-potion.png': ['potion', 'eye', 16, 16], 'slot.png': ['stone', 'gold', 52, 52]
};
const Z = { castle: 'stoneP', city: 'metal', home: 'wood', prize: 'earth', storm: 'storm', woods: 'moss' };
const ZK = { castle: 'brick', city: 'brick', home: 'shelf', prize: 'grass', storm: 'brick', woods: 'grass' };

const FILES = [];
for (const name of Object.keys(T).sort()) FILES.push({ name, src: path.join(SRC_T, name), out: path.join(OUT_BASE, 'terraria', name), spec: T[name] });
for (const name of Object.keys(Z).sort()) { const f = name + '.png'; FILES.push({ name: f, src: path.join(SRC_Z, f), out: path.join(OUT_BASE, 'tiles', f), spec: [ZK[name], Z[name], 16, 16] }); }

function draw(file) {
  const h = header(file.src), [kind, palName, cw, ch] = file.spec, pal = CP[palName];
  const C = new Canvas(h.w, h.h), cols = Math.max(1, Math.round(h.w / cw));
  for (let y = 0; y < h.h; y += ch) for (let x = 0; x < h.w; x += cw) {
    const idx = (y / ch) * cols + (x / cw), seed = (hashStr(file.name) ^ Math.imul(idx + 1, 2654435761)) >>> 0;
    if (kind === 'ragged' || kind === 'hood' || kind === 'tall' || kind === 'wide' || kind === 'skull' || kind === 'blade' || kind === 'wisp' || kind === 'eye' || kind === 'gear')
      humanoid(C, x, y, cw, ch, pal, seed, (y / ch) | 0, kind);
    else prop(C, x, y, cw, ch, pal, seed, kind);
  }
  fs.mkdirSync(path.dirname(file.out), { recursive: true });
  fs.writeFileSync(file.out, encodePNG(h.w, h.h, C.d));
  return h;
}

let n = 0;
for (const f of FILES) { draw(f); n++; }
console.log('generated ' + n + ' original PNGs -> ' + OUT_BASE);
