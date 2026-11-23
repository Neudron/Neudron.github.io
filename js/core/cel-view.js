/* cel-view.js: draws NEU.cel at native 320x180 and scales it up by whole pixels (work order CEL-1, local-only).
   Mapper-shipped art renders from its own PNGs. Game-owned visuals (player, spinners, refills, springs, vanilla tilesets)
   are flat placeholders drawn on the exact hitboxes. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var VW = 320, VH = 180, imgs = {}, buf = null, bx = null, out = null, ox = null, styleT = 0;
  var PH = { fg9: '#7a5230', bg1: '#2a2033' };
  function img(src) {
    if (!imgs[src]) { imgs[src] = new Image(); imgs[src].src = src; }
    return imgs[src].complete && imgs[src].naturalWidth ? imgs[src] : null;
  }
  function attach(canvas) {
    out = canvas; ox = canvas.getContext('2d');
    buf = document.createElement('canvas'); buf.width = VW; buf.height = VH; bx = buf.getContext('2d');
    resize(); window.addEventListener('resize', resize);
  }
  function resize() {
    var s = Math.max(1, Math.floor(Math.min(window.innerWidth / VW, window.innerHeight / VH)));
    out.width = VW * s; out.height = VH * s; ox.imageSmoothingEnabled = false;
  }
  function visibleRooms(M, cx, cy) {
    var a = [], i, r;
    for (i = 0; i < M.rooms.length; i++) { r = M.rooms[i]; if (r.x < cx + VW && r.x + r.w > cx && r.y < cy + VH && r.y + r.h > cy) a.push(r); }
    return a;
  }
  function onlyMatch(s, name) {
    if (s.exclude && s.exclude.split(',').indexOf(name) >= 0) return false;
    if (!s.only || s.only === '*') return true;
    var list = s.only.split(','), i;
    for (i = 0; i < list.length; i++) { var o = list[i].trim(); if (o === name || (o.charAt(o.length - 1) === '*' && name.indexOf(o.slice(0, -1)) === 0)) return true; }
    return false;
  }
  function styles(M, fg, cx, cy, room) {
    var i, s, im, x, y, w, h;
    for (i = 0; i < M.styles.length; i++) {
      s = M.styles[i]; if (s.fg !== fg || !onlyMatch(s, room.name) || !(im = img(s.f))) continue;
      w = im.width; h = im.height;
      x = Math.floor(s.x + s.spx * styleT - cx * s.scx); y = Math.floor(s.y + s.spy * styleT - cy * s.scy);
      if (s.lx) { while (x < 0) x += w; while (x > 0) x -= w; }
      if (s.ly) { while (y < 0) y += h; while (y > 0) y -= h; }
      bx.globalAlpha = s.a;
      for (var xx = x; xx < VW; xx += w) { for (var yy = y; yy < VH; yy += h) { bx.drawImage(im, xx, yy); if (!s.ly) break; } if (!s.lx) break; }
      bx.globalAlpha = 1;
    }
  }
  function tiles(M, rooms, layer, cx, cy) {
    var i, j, r, a, ts, im, px, py;
    for (i = 0; i < rooms.length; i++) {
      r = rooms[i]; a = r[layer + 'Art']; if (!a) continue;
      for (j = 0; j < a.length; j += 5) {
        px = r.x + a[j] * 8 - cx; py = r.y + a[j + 1] * 8 - cy;
        if (px <= -8 || py <= -8 || px >= VW || py >= VH) continue;
        ts = a[j + 2];
        if (ts < 0) { bx.fillStyle = PH[layer + String.fromCharCode(a[j + 3])] || 'hsl(' + (a[j + 3] * 47 % 360) + ',25%,' + (layer === 'fg' ? 38 : 18) + '%)'; bx.fillRect(px, py, 8, 8); continue; }
        if ((im = img(M.tilesets[ts]))) bx.drawImage(im, a[j + 3] * 8, a[j + 4] * 8, 8, 8, px, py, 8, 8);
      }
    }
  }
  function decals(rooms, fg, cx, cy) {
    var i, j, d, im;
    for (i = 0; i < rooms.length; i++) for (j = 0; j < rooms[i].decals.length; j++) {
      d = rooms[i].decals[j]; if (!!d.fg !== fg || !(im = img(d.f))) continue;
      bx.save(); bx.translate(Math.floor(d.x - cx), Math.floor(d.y - cy)); if (d.rot) bx.rotate(d.rot * Math.PI / 180); bx.scale(d.sx, d.sy);
      bx.drawImage(im, -im.width / 2, -im.height / 2); bx.restore();
    }
  }
  function entities(ents, cx, cy) {
    var i, e, x, y;
    for (i = 0; i < ents.length; i++) {
      e = ents[i]; x = e.x - cx; y = e.y - cy;
      if (e.t === 'water') { bx.fillStyle = 'rgba(80,160,255,0.35)'; bx.fillRect(x, y, e.w, e.h); bx.fillStyle = 'rgba(200,235,255,0.8)'; bx.fillRect(x, y, e.w, 1); }
      else if (e.t === 'spinner') { bx.fillStyle = e.vis && e.coll ? '#7fe0ff' : '#4a7f99'; bx.beginPath(); bx.arc(x, y, 6, 0, Math.PI * 2); bx.fill(); bx.fillRect(x - 8, y - 3, 16, 4); }
      else if (e.t === 'refill' || e.t === 'dreamRefill') {
        if (!e.coll) { bx.strokeStyle = 'rgba(255,255,255,0.3)'; bx.strokeRect(x - 4, y - 4, 8, 8); continue; }
        bx.fillStyle = e.t === 'dreamRefill' ? '#ffd23a' : e.two ? '#ff6def' : '#5ef05e';
        bx.beginPath(); bx.moveTo(x, y - 6); bx.lineTo(x + 5, y); bx.lineTo(x, y + 6); bx.lineTo(x - 5, y); bx.closePath(); bx.fill();
      }
      else if (e.t === 'spring') { bx.fillStyle = e.flash > 0 ? '#fff' : '#e8b42a'; bx.fillRect(e.box.x - cx, e.box.y - cy, e.box.w, e.box.h); }
      else if (e.t === 'jumpThru') { bx.fillStyle = '#c9a56b'; bx.fillRect(x, y, e.w, 2); }
      else if (e.t === 'berry' && !e.got) { bx.fillStyle = e.kind === 'strawberry' ? '#e23b3b' : '#cfd6e0'; bx.beginPath(); bx.arc(x, y, 5, 0, Math.PI * 2); bx.fill(); }
      else if (e.t === 'heart' && e.coll) { bx.fillStyle = '#5ab8ff'; bx.fillRect(x - 6, y - 6, 12, 12); }
      else if (e.t === 'zipMover' || e.t === 'switchGate') { bx.strokeStyle = 'rgba(255,255,255,0.25)'; bx.beginPath(); bx.moveTo(e.x0 + e.w / 2 - cx, e.y0 + e.h / 2 - cy); bx.lineTo(e.nx + e.w / 2 - cx, e.ny + e.h / 2 - cy); bx.stroke();
        bx.fillStyle = e.t === 'zipMover' ? '#3d3329' : '#5a4d6e'; bx.fillRect(x, y, e.w, e.h); bx.fillStyle = e.t === 'zipMover' ? (e.cs > 0 ? '#e85d3a' : '#69d16b') : (e.cs !== 0 ? '#f141df' : '#5fcde4'); bx.fillRect(x + e.w / 2 - 2, y + e.h / 2 - 2, 4, 4); }
      else if (e.t === 'dashBlock' && !e.broken) { bx.fillStyle = '#7a6a58'; bx.fillRect(x, y, e.w, e.h); bx.strokeStyle = '#c9b79a'; bx.strokeRect(x + 0.5, y + 0.5, e.w - 1, e.h - 1); }
      else if (e.t === 'touchSwitch') { bx.strokeStyle = e.on ? '#f141df' : '#5fcde4'; bx.strokeRect(x - 7.5, y - 7.5, 15, 15); bx.fillStyle = bx.strokeStyle; bx.fillRect(x - 2, y - 2, 4, 4); }
      else if (e.t === 'sideJT') { bx.fillStyle = '#c9a56b'; bx.fillRect(e.allowLR ? x + 2 : x, y, 2, e.h); }
      else if (e.t === 'bubbleRegion') { bx.strokeStyle = 'rgba(255,120,220,0.6)'; bx.beginPath(); bx.arc(x + e.w / 2, y + e.h / 2, e.w / 2, 0, Math.PI * 2); bx.stroke(); }
      else if (e.t === 'spikes') { if (e.gone) continue; var b = e.box, n2, k2, s2 = 8; bx.fillStyle = '#d8dde6'; bx.beginPath();
        if (e.d === 'U' || e.d === 'D') { n2 = Math.max(1, Math.round(b.w / s2)); for (k2 = 0; k2 < n2; k2++) { var x0 = b.x - cx + k2 * s2, yb = e.d === 'U' ? b.y + b.h - cy : b.y - cy, yt = e.d === 'U' ? yb - 4 : yb + 4; bx.moveTo(x0, yb); bx.lineTo(x0 + 4, yt); bx.lineTo(x0 + 8, yb); } }
        else { n2 = Math.max(1, Math.round(b.h / s2)); for (k2 = 0; k2 < n2; k2++) { var y0 = b.y - cy + k2 * s2, xb = e.d === 'L' ? b.x + b.w - cx : b.x - cx, xt = e.d === 'L' ? xb - 4 : xb + 4; bx.moveTo(xb, y0); bx.lineTo(xt, y0 + 4); bx.lineTo(xb, y0 + 8); } }
        bx.fill(); }
      else if ((e.t === 'exitBlock' || e.t === 'barrier') && e.coll && e.t === 'exitBlock') { bx.fillStyle = '#6b5f7a'; bx.fillRect(x, y, e.w, e.h); }
      /* Spring Collab 2020: base-game entities, flat placeholders on exact hitboxes */
      else if (e.t === 'dreamBlock' && e.coll) { bx.fillStyle = '#3a3a5c'; bx.fillRect(x, y, e.w, e.h); bx.strokeStyle = '#7a6ad0'; bx.strokeRect(x + 0.5, y + 0.5, e.w - 1, e.h - 1); }
      else if (e.t === 'blockField') { bx.strokeStyle = 'rgba(255,200,80,0.4)'; bx.strokeRect(x + 0.5, y + 0.5, e.w - 1, e.h - 1); }
      else if (e.t === 'swapBlock' && !e.gone) { bx.fillStyle = '#7a5a8a'; bx.fillRect(x, y, e.w, e.h); bx.strokeStyle = '#d0a0e0'; bx.strokeRect(x + 0.5, y + 0.5, e.w - 1, e.h - 1); }
      else if (e.t === 'booster' && !e.gone) { bx.fillStyle = e.red ? '#ff5a5a' : '#5ab8ff'; bx.beginPath(); bx.arc(x, y, 7, 0, Math.PI * 2); bx.fill(); }
      else if (e.t === 'dashSwitch') { bx.fillStyle = e.on ? '#ffd23a' : '#88a0b0'; bx.fillRect(x, y, e.w, e.h); }
      else if (e.t === 'seeker' && !e.gone) { bx.fillStyle = '#ff8a3a'; bx.beginPath(); bx.arc(x, y, 6, 0, Math.PI * 2); bx.fill(); bx.fillStyle = '#fff'; bx.beginPath(); bx.arc(x, y, 2, 0, Math.PI * 2); bx.fill(); }
      else if (e.t === 'seekerBarrier') { bx.fillStyle = 'rgba(120,180,255,0.25)'; bx.fillRect(x, y, e.w, e.h); }
      else if (e.t === 'templeGate' && !e.gone) { bx.fillStyle = '#5a4d3a'; bx.fillRect(x, y, e.w, e.h); bx.fillStyle = '#d0b070'; bx.fillRect(x, y, 4, e.h); }
      else if (e.t === 'templeCrackedBlock' && !e.gone) { bx.fillStyle = '#8a7050'; bx.fillRect(x, y, e.w, e.h); bx.strokeStyle = '#c0a070'; bx.strokeRect(x + 0.5, y + 0.5, e.w - 1, e.h - 1); }
      else if ((e.t === 'trackSpinner' || e.t === 'rotateSpinner') && !e.gone) { bx.fillStyle = '#7fe0ff'; bx.beginPath(); bx.arc(x, y, 6, 0, Math.PI * 2); bx.fill(); }
      else if (e.t === 'fakeWall' && !e.gone) { bx.fillStyle = '#6a6a7a'; bx.fillRect(x, y, e.w, e.h); bx.strokeStyle = '#9090a0'; bx.strokeRect(x + 0.5, y + 0.5, e.w - 1, e.h - 1); }
      else if (e.t === 'lockBlock' && !e.gone) { bx.fillStyle = e.open ? 'rgba(150,150,100,0.3)' : '#b0a050'; bx.fillRect(x, y, 16, 16); }
      else if (e.t === 'key' && !e.gone) { bx.fillStyle = '#ffd23a'; bx.fillRect(x - 5, y - 7, 10, 14); }
    }
  }
  function player(p, cx, cy, S) {
    var hb = p.hb, x = p.x + hb[2] - cx, y = p.y + hb[3] - cy;
    bx.fillStyle = p.dead ? 'rgba(255,80,80,0.4)' : p.st === S.TUNNEL ? '#ffe46b' : p.dashes > 1 ? '#ff6def' : p.dashes ? '#ac3232' : '#44b7ff';
    bx.fillRect(x, y, hb[0], hb[1]);
    bx.fillStyle = '#fff'; bx.fillRect(p.facing > 0 ? x + hb[0] - 2 : x + 1, y + 2, 1, 1);
  }
  function draw(dt) {
    var C = NEU.cel, M = C.map, L = C.level, p = C.player;
    if (!M || !out) return;
    styleT += dt || 0;
    var cx = Math.floor(L.cam.x), cy = Math.floor(L.cam.y), rooms = visibleRooms(M, cx, cy), room = C.room;
    bx.fillStyle = '#0b0a12'; bx.fillRect(0, 0, VW, VH);
    styles(M, false, cx, cy, room);
    tiles(M, rooms, 'bg', cx, cy);
    decals(rooms, false, cx, cy);
    entities(C.ents, cx, cy);
    player(p, cx, cy, C.STATES);
    tiles(M, rooms, 'fg', cx, cy);
    decals(rooms, true, cx, cy);
    styles(M, true, cx, cy, room);
    ox.drawImage(buf, 0, 0, out.width, out.height);
  }
  NEU.celView = { attach: attach, draw: draw };
})();
