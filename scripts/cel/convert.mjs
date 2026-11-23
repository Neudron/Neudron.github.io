// Map .bin -> cel/<id>.js (ES5 data for js/core/cel.js). Local-only: mod map data, not cleared for public reuse.
import { readMap, rooms, kids, kid } from './bin.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mapInfo } from './maps.mjs';
let ZIP = null, zipSet = null;   // the mod pack zip of the map being converted (from maps.json)
const norm = p => p ? String(p).replace(/\\/g, '/') : p;   // Celeste stores these paths with backslashes
const zip = (p, enc) => execFileSync('unzip', ['-p', ZIP, norm(p)], { maxBuffer: 1 << 26, encoding: enc });
const inZip = p => { if (!zipSet) zipSet = new Set(execFileSync('unzip', ['-Z1', ZIP], { maxBuffer: 1 << 26, encoding: 'utf8' }).split('\n')); return zipSet.has(norm(p)); };

/* ---- autotiler (Celeste Autotiler.TileHandler semantics) ---- */
function parseTilesets(xml) {
  const out = {}, re = /<Tileset\s([^>]*?)(\/>|>([\s\S]*?)<\/Tileset>)/g; let m;
  const attr = (s, k) => { const r = new RegExp('\\b' + k + '="([^"]*)"').exec(s); return r ? r[1] : null; };
  while ((m = re.exec(xml))) {
    const a = m[1], id = attr(a, 'id'), body = m[3] || '', sets = [];
    let s, sr = /<set\s([^>]*?)\/>/g;
    while ((s = sr.exec(body))) sets.push({ mask: attr(s[1], 'mask'), tiles: (attr(s[1], 'tiles') || '').split(';').filter(Boolean).map(t => t.split(',').map(Number)) });
    out[id] = { id, path: attr(a, 'path'), copy: attr(a, 'copy'), ignores: attr(a, 'ignores'), sets };
  }
  for (const t of Object.values(out)) {
    const src = t.copy ? out[t.copy] : t, masked = [];
    t.center = []; t.padded = [];
    for (const st of (t.copy ? src.sets : t.sets)) {
      if (st.mask === 'center') t.center = st.tiles; else if (st.mask === 'padding') t.padded = st.tiles;
      else masked.push({ mask: st.mask.replace(/-/g, '').split('').map(c => c === 'x' ? 2 : +c), tiles: st.tiles });
    }
    t.masked = masked;
    t.ign = !t.ignores ? [] : t.ignores === '*' ? '*' : t.ignores.split(',').map(s => s.trim());
  }
  return out;
}
class NetRandom {   // System.Random (legacy .NET Framework subtractive generator)
  constructor(seed) {
    const MBIG = 2147483647, MSEED = 161803398, a = new Array(56).fill(0);
    let mj = MSEED - Math.abs(seed | 0), mk = 1; a[55] = mj;
    for (let i = 1; i < 55; i++) { const ii = (21 * i) % 55; a[ii] = mk; mk = mj - mk; if (mk < 0) mk += MBIG; mj = a[ii]; }
    for (let k = 1; k < 5; k++) for (let i = 1; i < 56; i++) { a[i] -= a[1 + (i + 30) % 55]; if (a[i] < 0) a[i] += MBIG; }
    Object.assign(this, { a, inext: 0, inextp: 21, MBIG });
  }
  sample() { let i = this.inext, j = this.inextp; if (++i >= 56) i = 1; if (++j >= 56) j = 1; let r = this.a[i] - this.a[j]; if (r === this.MBIG) r--; if (r < 0) r += this.MBIG; this.a[i] = r; this.inext = i; this.inextp = j; return r * (1 / this.MBIG); }
  next(n) { return Math.floor(this.sample() * n); }
}
function autotile(map, layer, sets, beh, roomOf) {
  const { ox, oy, w, h } = map, get = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) { if (!beh.edgesExtend) return '0'; x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y)); } return layer[y * w + x]; };
  const empty = c => c === '0' || c === undefined;
  const check = (t, x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return beh.edgesExtend; const c = layer[y * w + x]; if (empty(c)) return false; return !(t.ign === '*' ? c !== t.id : t.ign.includes(c)); };
  const same = (x1, y1, x2, y2) => { const r = roomOf(x1, y1); return !!r && r === roomOf(x2, y2); };
  const rnd = new NetRandom(0), out = new Map();   // shortcut: seed 0 picks the tile variants; the game's load seed is unverified, so variants can differ from the original
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
    const c = get(x, y); if (empty(c)) continue; const t = sets[c]; if (!t) continue;
    let all = true; const adj = [];
    for (let i = -1; i < 2; i++) for (let j = -1; j < 2; j++) { let b = check(t, x + j, y + i); if (!b && beh.edgesIgnoreOut && !same(x, y, x + j, y + i)) b = true; adj.push(b ? 1 : 0); if (!b) all = false; }
    let tiles = null;
    if (all) {
      const pad = beh.paddingIgnoreOut
        ? ((!check(t, x - 2, y) && same(x, y, x - 2, y)) || (!check(t, x + 2, y) && same(x, y, x + 2, y)) || (!check(t, x, y - 2) && same(x, y, x, y - 2)) || (!check(t, x, y + 2) && same(x, y, x, y + 2)))
        : (!check(t, x - 2, y) || !check(t, x + 2, y) || !check(t, x, y - 2) || !check(t, x, y + 2));
      tiles = pad ? t.padded : t.center;
    } else for (const mk of t.masked) { let ok = true; for (let k = 0; k < 9 && ok; k++) if (mk.mask[k] !== 2 && mk.mask[k] !== adj[k]) ok = false; if (ok) { tiles = mk.tiles; break; } }
    if (!tiles || !tiles.length) continue;
    out.set(y * w + x, tiles[rnd.next(tiles.length)]);
  }
  return out;
}
const DECOR = new Set(('bird towerviewer cobweb hanginglamp lamp lightbeam floatingDebris foregroundDebris pandorasBox/coloredWaterfall flutterbird '
  + 'wire soundSource everest/coreMessage ContortHelper/LightSource FrostHelper/ColoredLightbeam MaxHelpingHand/SetFlagOnSpawnController '
  + 'fakeBlock bonfire playbackBillboard').split(' '));
const SPIN = new Set(['spinner', 'FrostHelper/IceSpinner']);
const num = v => +v || 0;
export function ent(e, rx, ry) {
  const x = rx + num(e.x), y = ry + num(e.y), w = num(e.width), h = num(e.height), n = e.__name;
  const nodes = (e.__children || []).filter(c => c.__name === 'node').map(c => [rx + num(c.x), ry + num(c.y)]);
  if (SPIN.has(n)) return { t: 'spinner', x, y, tint: e.tint || e.color || '' };
  if (n === 'refill') return { t: 'refill', x, y, two: !!e.twoDash, once: !!e.oneUse };
  if (n === 'CommunalHelper/DreamRefill') return { t: 'dreamRefill', x, y, once: !!e.oneUse };
  if (n === 'spring') return { t: 'spring', o: 'F', x, y, use: e.playerCanUse !== false };
  if (n === 'wallSpringLeft') return { t: 'spring', o: 'L', x, y, use: e.playerCanUse !== false };
  if (n === 'wallSpringRight') return { t: 'spring', o: 'R', x, y, use: e.playerCanUse !== false };
  if (n === 'jumpThru') return { t: 'jumpThru', x, y, w };
  if (n === 'water' || n === 'pandorasBox/coloredWater') return { t: 'water', x, y, w, h, color: e.color || '' };
  if (n === 'strawberry' || n === 'CollabUtils2/SilverBerry' || n === 'goldenBerry') return { t: 'berry', x, y, kind: n };
  if (n === 'exitBlock') return { t: 'exitBlock', x, y, w, h, tile: e.tileType || '' };
  if (n === 'CollabUtils2/MiniHeart') return { t: 'heart', x, y };
  if (n === 'invisibleBarrier') return { t: 'barrier', x, y, w, h };
  // base-game solids: floatySpaceBlock stays static in normal gravity (these maps have no low-gravity trigger)
  if (n === 'floatySpaceBlock') return { t: 'floaty', x, y, w, h };
  if (n === 'crumbleBlock') return { t: 'crumble', x, y, w, h: num(e.height) || 8, rumble: false };
  if (n === 'crumbleWallOnRumble') return { t: 'crumble', x, y, w, h, rumble: true };
  if (n === 'blockField') return { t: 'blockField', x, y, w, h };
  if (n === 'killbox') return { t: 'killbox', x, y, w };
  if (/^spikes(Up|Down|Left|Right)$/.test(n)) return { t: 'spikes', d: n.slice(6)[0], x, y, w, h };
  const nd = nodes[0] || [x, y];
  /* Spring Collab 2020 / base-game entities: each tier kernel owns the behaviour for its own subset. */
  if (n === 'floatySpaceBlock') return { t: 'floaty', x, y, w, h };
  if (n === 'crumbleBlock') return { t: 'crumble', x, y, w, h: num(e.height) || 8, rumble: false };
  if (n === 'crumbleWallOnRumble') return { t: 'crumbleWall', x, y, w, h, persistent: !!e.persistent };
  if (n === 'blockField') return { t: 'blockField', x, y, w, h };
  if (n === 'fakeWall') return { t: 'fakeWall', x, y, w, h };
  if (n === 'fallingBlock') return { t: 'fallingBlock', x, y, w, h, climb: e.climbFall !== false };
  if (n === 'wallBooster') return { t: 'wallBooster', x, y, w: 8, h: num(e.height) || 8, ice: !!e.notCoreMode, left: !!e.left };
  if (n === 'dreamBlock') return { t: 'dreamBlock', x, y, w, h, oneUse: !!e.oneUse, fast: !!e.fastMoving, nodes };
  if (n === 'swapBlock') return { t: 'swapBlock', x, y, w, h, nx: nd[0], ny: nd[1] };
  if (n === 'booster') return { t: 'booster', x, y, red: !!e.red };
  if (n === 'dashSwitchH') return { t: 'dashSwitch', x, y, w: 8, h: 8, dir: 'H', left: !!e.leftSide, persistent: !!e.persistent, all: !!e.allGates };
  if (n === 'dashSwitchV') return { t: 'dashSwitch', x, y, w: 8, h: 8, dir: 'V', left: !!e.ceiling, persistent: !!e.persistent, all: !!e.allGates };
  if (n === 'seeker') return { t: 'seeker', x, y, nx: nd[0], ny: nd[1] };
  if (n === 'seekerBarrier') return { t: 'seekerBarrier', x, y, w, h };
  if (n === 'templeGate') return { t: 'templeGate', x, y, w: 8, h: num(e.height) || 48, type: e.type || 'CloseBehindPlayer' };
  if (n === 'templeCrackedBlock') return { t: 'templeCrackedBlock', x, y, w, h, persistent: !!e.persistent };
  /* shortcut: spinner names follow the expert kernel (trk/rot); the beginner kernel names them track/rotate.
     Reconverting cat-in-box-01 needs those two names swapped; existing cel/ data is already correct. */
  if (n === 'trackSpinner') return { t: 'trkSpinner', x, y, nx: nd[0], ny: nd[1], speed: e.speed || 'Normal', spin: 'track', look: e.star ? 'star' : e.dust ? 'dust' : 'blade' };
  if (n === 'rotateSpinner') return { t: 'rotSpinner', x, y, nx: nd[0], ny: nd[1], cw: !!e.clockwise, spin: 'rotate', look: e.star ? 'star' : e.dust ? 'dust' : 'blade' };
  if (n === 'lockBlock') return { t: 'lockBlock', x, y, sprite: e.sprite || '' };
  if (n === 'key') return { t: 'key', x, y, nodes };
  if (n === 'colorSwitch') return { t: 'colorSwitch', x, y, col: String(e.type || 'red') };
  if (n === 'clutterDoor') return { t: 'clutterDoor', x, y, w, h, type: String(e.type || 'red') };
  if (n === 'clutterCabinet') return { t: 'clutterCabinet', x, y: y - 8, w: 16, h: 16 };
  if (n === 'door') return { t: 'door', x, y };
  if (n === 'movingPlatform') return { t: 'movingPlatform', x, y, w, h, nx: nd[0], ny: nd[1] };
  if (n === 'cloud') return { t: 'cloud', x, y, small: !!e.small, fragile: !!e.fragile };
  if (n === 'lightning') return { t: 'lightning', x, y, w, h, moveTime: e.moveTime == null ? 5 : +e.moveTime, perLevel: !!e.perLevel };
  if (/^triggerSpikes(Up|Down|Left|Right)$/.test(n)) return { t: 'triggerSpikes', d: n.slice(13, 14), x, y, w, h };
  if (n === 'lightningBlock') return { t: 'lightningBlock', x, y };
  if (n === 'badelineBoost') return { t: 'badelineBoost', x, y, nodes, lock: !!e.lockCamera };
  if (n === 'resortLantern') return { t: 'vanillaDecor', x, y: y - 8, w: 8, h: 16 };
  if (n === 'clothesline') return { t: 'vanillaDecor', x, y, w: Math.max(16, Math.abs((nodes[0] || [x + 16, y])[0] - x)), h: 8 };
  if (n === 'introCar') return { t: 'vanillaDecor', x: x - 16, y: y - 16, w: 32, h: 16 };
  if (n === 'zipMover') return { t: 'zipMover', x, y, w, h, nx: nd[0], ny: nd[1] };
  if (n === 'dashBlock') return { t: 'dashBlock', x, y, w, h, canDash: e.canDash !== false, perm: !!e.permanent, tile: String(e.tiletype || '') };
  if (n === 'touchSwitch') return { t: 'touchSwitch', x, y, flag: '' };
  if (n === 'MaxHelpingHand/FlagTouchSwitch') return { t: 'touchSwitch', x, y, flag: e.flag || '', inverted: !!e.inverted, persistent: !!e.persistent };
  if (n === 'switchGate') return { t: 'switchGate', x, y, w, h, nx: nd[0], ny: nd[1], flag: '', moveTime: 1.8, shake: 0.5, eased: true };
  if (n === 'MaxHelpingHand/FlagSwitchGate') return { t: 'switchGate', x, y, w, h, nx: nd[0], ny: nd[1], flag: e.flag || '', inverted: !!e.inverted,
    moveTime: e.moveTime == null ? 1.8 : +e.moveTime, shake: e.shakeTime == null ? 0.5 : +e.shakeTime, eased: e.moveEased !== false };
  if (n === 'MaxHelpingHand/SidewaysJumpThru') return { t: 'sideJT', x, y, h, allowLR: !e.left, climb: e.allowClimbing !== false, wj: e.allowWallJumping !== false };
  if (n === 'CommunalHelper/PlayerBubbleRegion') return { t: 'bubbleRegion', x, y, w, h, ctrl: nodes[0], end: nodes[1] };
  if (DECOR.has(n) || n === 'CollabUtils2/GoldenBerryPlayerRespawnPoint' || n === 'CollabUtils2/SpeedBerry') return null;
  return { t: '?', n, x, y };
}
export function convert(id) {
  const info = mapInfo(id); ZIP = info.zip; zipSet = null;
  const m = readMap(info.bin), out = { id, rooms: [] }, unknown = {};
  const meta = kid(m, 'meta') || {};
  out.intro = meta.IntroType || 'WalkInRight';
  for (const r of rooms(m)) {
    const rx = num(r.x), ry = num(r.y), room = { name: r.name, x: rx, y: ry, w: num(r.width), h: num(r.height),
      fg: String((kid(r, 'solids') || {}).innerText || '').replace(/\r/g, '').split('\n'),
      bg: String((kid(r, 'bg') || {}).innerText || '').replace(/\r/g, '').split('\n'),
      dark: !!r.dark, down: !r.disableDownTransition, spawns: [], ents: [], trig: [] };
    for (const e of kids(r, 'entities')) {
      if (e.__name === 'player') { room.spawns.push([rx + num(e.x), ry + num(e.y)]); continue; }
      const o = ent(e, rx, ry); if (!o) continue;
      if (o.t === '?') { unknown[o.n] = (unknown[o.n] || 0) + 1; continue; }
      room.ents.push(o);
    }
    for (const t of kids(r, 'triggers')) {
      const { __name, __children, id: _i, x, y, width, height, ...a } = t;
      room.trig.push({ t: __name, x: rx + num(x), y: ry + num(y), w: num(width), h: num(height), a,
        nodes: (__children || []).filter(c => c.__name === 'node').map(c => [rx + num(c.x), ry + num(c.y)]) });
    }
    out.rooms.push(room);
    room.decals = [];
    for (const [k, fg] of [['bgdecals', 0], ['fgdecals', 1]]) for (const d of kids(r, k))
      room.decals.push({ tex: String(d.texture).replace(/\.png$/, ''), x: rx + num(d.x), y: ry + num(d.y), sx: d.scaleX == null ? 1 : num(d.scaleX), sy: d.scaleY == null ? 1 : num(d.scaleY), rot: num(d.rotation), color: d.color || '', fg });
  }
  bakeArt(id, m, meta, out);
  return { out, unknown };
}
function bakeArt(id, m, meta, out) {
  const tx0 = Math.min(...out.rooms.map(r => r.x)) / 8, ty0 = Math.min(...out.rooms.map(r => r.y)) / 8;
  const w = Math.max(...out.rooms.map(r => r.x + r.w)) / 8 - tx0, h = Math.max(...out.rooms.map(r => r.y + r.h)) / 8 - ty0;
  const owner = new Int32Array(w * h).fill(-1), files = new Map(), tsIndex = new Map();
  out.rooms.forEach((r, i) => { for (let y = 0; y < r.h / 8; y++) for (let x = 0; x < r.w / 8; x++) owner[(r.y / 8 - ty0 + y) * w + r.x / 8 - tx0 + x] = i; });
  const roomOf = (x, y) => x < 0 || y < 0 || x >= w || y >= h ? null : (owner[y * w + x] < 0 ? null : owner[y * w + x] + 1);
  const grid = key => { const g = new Array(w * h).fill('0'); for (const r of out.rooms) r[key].forEach((row, y) => { for (let x = 0; x < row.length && x < r.w / 8; x++) if (y < r.h / 8) g[(r.y / 8 - ty0 + y) * w + r.x / 8 - tx0 + x] = row[x]; }); return g; };
  const tex = (p) => { const z = 'Graphics/Atlases/Gameplay/' + p + '.png'; if (!inZip(z)) return null; const f = 'cel/img/' + id + '/' + p.replace(/[^\w/.-]+/g, '_') + '.png'; files.set(f, z); return f; };
  out.tilesets = []; out.placeholder = {};
  for (const [layer, xmlKey, beh] of [['fg', 'ForegroundTiles', { edgesExtend: true, edgesIgnoreOut: false, paddingIgnoreOut: true }], ['bg', 'BackgroundTiles', { edgesExtend: true, edgesIgnoreOut: false, paddingIgnoreOut: false }]]) {
    const sets = meta[xmlKey] && inZip(meta[xmlKey]) ? parseTilesets(zip(meta[xmlKey], 'utf8')) : {};   // no custom XML: every tile is a vanilla placeholder
    const g = grid(layer), art = autotile({ w, h }, g, sets, beh, roomOf);
    for (const r of out.rooms) r[layer + 'Art'] = [];
    for (let k = 0; k < g.length; k++) if (g[k] !== '0' && !sets[g[k]] && owner[k] >= 0) art.set(k, [0, 0]);
    for (const [k, t] of art) {
      const x = k % w, y = (k / w) | 0, ri = owner[k]; if (ri < 0) continue;
      const r = out.rooms[ri], c = g[k], set = sets[c], lx = x + tx0 - r.x / 8, ly = y + ty0 - r.y / 8;
      let ti = -1;
      if (set && set.path && set.path.indexOf('/') >= 0) {
        const key = layer + ':' + set.path;
        if (!tsIndex.has(key)) { const f = tex('tilesets/' + set.path); tsIndex.set(key, f ? out.tilesets.push(f) - 1 : -1); }
        ti = tsIndex.get(key);
      }
      if (ti < 0) { out.placeholder[layer + c] = (set && set.path) || '?'; r[layer + 'Art'].push(lx, ly, -1, c.charCodeAt(0), 0); }   // vanilla-owned tileset: flat placeholder
      else r[layer + 'Art'].push(lx, ly, ti, t[0], t[1]);
    }
  }
  for (const r of out.rooms) r.decals = r.decals.map(d => { const f = d.tex.indexOf('/') >= 0 ? tex('decals/' + d.tex) : null; return f ? { ...d, f } : null; }).filter(Boolean);
  out.styles = [];
  const st = kid(m, 'Style');
  for (const g of st ? st.__children : []) for (const s of g.__children) {
    if (s.__name !== 'parallax') continue;
    const f = /^bgs\/[^/]+\//.test(String(s.texture)) ? tex(s.texture) : null; if (!f) continue;
    out.styles.push({ f, fg: g.__name === 'Foregrounds', x: num(s.x), y: num(s.y), scx: num(s.scrollx), scy: num(s.scrolly), spx: num(s.speedx), spy: num(s.speedy),
      lx: !!s.loopx, ly: !!s.loopy, a: s.alpha == null ? 1 : num(s.alpha), color: s.color || 'FFFFFF', only: s.only || '*', exclude: s.exclude || '' });
  }
  for (const [f, z] of files) { mkdirSync(new URL('../../' + f.replace(/[^/]+$/, ''), import.meta.url), { recursive: true }); writeFileSync(new URL('../../' + f, import.meta.url), zip(z)); }
  out.files = [...files.keys()];
}
if (import.meta.url === 'file://' + process.argv[1]) {
  const id = process.argv[2] || 'forest-path', { out, unknown } = convert(id);
  console.log('placeholder tilesets', JSON.stringify(out.placeholder), 'files', out.files.length);
  if (Object.keys(unknown).length) { console.error('unknown entities', unknown); if (!process.env.CEL_ALLOW_UNKNOWN) process.exit(1); }
  mkdirSync(new URL('../../cel/', import.meta.url), { recursive: true });
  const js = '/* generated by scripts/cel/convert.mjs from a mod map (local-only, not cleared for public reuse) */\n'
    + '(function () { var NEU = window.NEU = window.NEU || {}; NEU.celMaps = NEU.celMaps || {}; NEU.celMaps[' + JSON.stringify(id) + '] = ' + JSON.stringify(out) + '; })();\n';
  writeFileSync(new URL('../../cel/' + id + '.js', import.meta.url), js);
  console.log(id, 'rooms', out.rooms.length, 'bytes', js.length);
}
