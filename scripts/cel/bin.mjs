// Celeste .bin map reader (BinaryWriter tree). Local-only tool: reads map files from ~/celeste-study.
import { readFileSync } from 'node:fs';

export function readMap(path) {
  const b = readFileSync(path); let o = 0;
  const u8 = () => b[o++], i16 = () => { const v = b.readInt16LE(o); o += 2; return v; };
  const str = () => { let n = 0, s = 0, c; do { c = u8(); n |= (c & 127) << s; s += 7; } while (c & 128); const v = b.toString('utf8', o, o + n); o += n; return v; };
  if (str() !== 'CELESTE MAP') throw new Error('not a Celeste map: ' + path);
  const pkg = str(), look = []; for (let n = i16(); n > 0; n--) look.push(str());
  const val = t => {
    switch (t) {
      case 0: return u8() !== 0;
      case 1: return u8();
      case 2: return i16();
      case 3: { const v = b.readInt32LE(o); o += 4; return v; }
      case 4: { const v = b.readFloatLE(o); o += 4; return v; }
      case 5: return look[i16()];
      case 6: return str();
      case 7: { const n = i16(), e = o + n; let s = ''; while (o < e) { const k = u8(), ch = String.fromCharCode(u8()); s += ch.repeat(k); } return s; }
      case 8: { const v = Number(b.readBigInt64LE(o)); o += 8; return v; }
      default: throw new Error('attr type ' + t + ' at ' + o);
    }
  };
  const el = () => {
    const node = { __name: look[i16()] };
    for (let n = u8(); n > 0; n--) { const k = look[i16()]; node[k] = val(u8()); }
    const kids = []; for (let n = i16(); n > 0; n--) kids.push(el());
    node.__children = kids; return node;
  };
  const root = el(); root.package = pkg;
  root.trailing = b.length - o;   // some packers append bytes after the tree; the game ignores them
  return root;
}
export const kid = (n, name) => (n.__children || []).find(c => c.__name === name);
export const kids = (n, name) => { const k = kid(n, name); return k ? k.__children : []; };
export function rooms(root) { return kids(root, 'levels'); }
