(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var TILE = 16, SCALE = 2, STEP = 1 / 60, MAX_STEPS = 8;
  var levels = {}, kinds = {}, current = null, live = false, paused = false, replaying = false;
  var canvas = document.getElementById('platCanvas'), overlay = document.getElementById('plat');
  var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  var keys = {}, accumulator = 0, camera = { x: 0, y: 0 }, baked = null, afterimages = [], bakeCache = {};
  var reduced = redNow(), view = { w: 640, h: 360, scale: 1 }, area = { x0: 0, y0: 0, x1: 640, y1: 360 };
  var painters = [], padB = {}, sprCache = {}, lastDraw = 0;
  function redNow() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  var player = fresh();

  function fresh() {
    return { x: 0, y: 0, vx: 0, vy: 0, face: 1, dashes: 1, onGround: false,
      stamina: 110, dead: 0, coyote: 0, jumpBuffer: 0, varJump: 0,
      dashTime: 0, dashCooldown: 0, dashX: 0, dashY: 0,
      wallTime: 0, forceX: 0, forceDir: 0, pogo: false, squash: 0, stretch: 0, walked: 0 };
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function approach(v, target, delta) { return v < target ? Math.min(target, v + delta) : Math.max(target, v - delta); }
  function grid(text) { return String(text || '').split('\n').filter(function (r) { return r.length; }); }
  function level(id, def) {
    def = def || {};
    def.id = id; def.grid = grid(def.tiles); def.h = def.grid.length;
    def.w = def.grid.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    def.entities = (def.entities || []).map(function (e, i) {
      var v = {}, k;
      for (k in e) if (Object.prototype.hasOwnProperty.call(e, k)) v[k] = e[k];
      v.id = v.id || id + ':' + v.t + ':' + v.x + ',' + v.y + ':' + i;
      v.t0 = 0; v.dead = false; v.solid = v.t === 'zip';
      return v;
    });
    levels[id] = def; return def;
  }
  function cell(x, y) {
    if (!current || y < 0 || y >= current.h || x < 0 || x >= current.w) return '#';
    if (current.broken && current.broken[x + ',' + y]) return '.';
    return (current.grid[y] || '')[x] || '.';
  }
  function solidChar(c, dy, oldBottom) {
    return c === '#' || c === 'x' || (c === '=' && dy > 0 && oldBottom <= Math.floor(oldBottom / TILE) * TILE + 0.01);
  }
  function overlapsTile(x, y, c) {
    var x0 = Math.floor((x - 12) / TILE), x1 = Math.floor((x + 12 - 0.01) / TILE);
    var y0 = Math.floor((y - 32) / TILE), y1 = Math.floor((y - 0.01) / TILE), tx, ty;
    for (ty = y0; ty <= y1; ty++) for (tx = x0; tx <= x1; tx++) if (cell(tx, ty) === c) return true;
    return false;
  }
  function blocked(x, y, dy, oldBottom) {
    var x0 = Math.floor((x - 12) / TILE), x1 = Math.floor((x + 12 - 0.01) / TILE);
    var y0 = Math.floor((y - 32) / TILE), y1 = Math.floor((y - 0.01) / TILE), tx, ty, c, i, e;
    for (ty = y0; ty <= y1; ty++) for (tx = x0; tx <= x1; tx++) {
      c = cell(tx, ty); if (c === '#' || c === 'x' || (c === '=' && dy > 0 && oldBottom <= ty * TILE + 0.01)) return true;
      for (i = 0; i < current.entities.length; i++) {
        e = current.entities[i];
        if (e.solid && !e.dead && Math.floor(e.x) === tx && Math.floor(e.y) === ty) return true;
      }
    }
    return false;
  }
  function sweep(dx, dy) {
    var n = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy) / 8)), sx = dx / n, sy = dy / n;
    var i, nx, ny, oldBottom, hitX = false, hitY = false;
    for (i = 0; i < n; i++) {
      nx = player.x + sx;
      if (!blocked(nx, player.y, 0, player.y)) player.x = nx;
      else { hitX = true; player.vx = 0; }
      oldBottom = player.y; ny = player.y + sy;
      if (!blocked(player.x, ny, sy, oldBottom)) player.y = ny;
      else { hitY = true; player.vy = 0; }
    }
    return { x: hitX, y: hitY };
  }
  function nearbyWall(dir) { return blocked(player.x + dir * 13, player.y - 8, 0, player.y); }
  function doJump(dir) {
    player.vy = -210; player.varJump = 0.2; player.coyote = 0; player.jumpBuffer = 0;
    player.onGround = false; player.vx += dir * 80; player.face = dir || player.face;
    player.stretch = 0.12;
  }
  function refill() { player.dashes = 1; }
  function die() {
    if (player.dead > 0) return;
    player.dead = 0.35; player.vx = 0; player.vy = 0;
    if (NEU.juice && NEU.juice.burst && !reduced) NEU.juice.burst(player.x, player.y - 16, 12, '#FF5577', 140);
  }
  function parseInput(input) {
    var out = {}, k, parts;
    if (typeof input === 'string') {
      parts = input.toLowerCase().split(/[ ,+]+/);
      for (var i = 0; i < parts.length; i++) out[parts[i]] = true;
      out.left = out.left || out.a; out.right = out.right || out.d;
      out.up = out.up || out.w; out.down = out.down || out.s;
      out.jump = out.jump || out.space; out.grab = out.grab || out.shift;
    } else if (input) for (k in input) if (Object.prototype.hasOwnProperty.call(input, k)) out[k.toLowerCase()] = !!input[k];
    return out;
  }
  function hitSpike(px, py, down) {
    var x0 = Math.floor((px - 12) / TILE), x1 = Math.floor((px + 12) / TILE);
    var y0 = Math.floor((py - 32) / TILE), y1 = Math.floor(py / TILE), tx, ty, ch;
    var top = py - 32, left, right, mid, reach, contact;
    for (ty = y0; ty <= y1; ty++) for (tx = x0; tx <= x1; tx++) {
      ch = cell(tx, ty); contact = false;
      if (ch === '^') {
        reach = py - ty * TILE; mid = (tx + 0.5) * TILE;
        contact = reach >= 2 && reach <= TILE && px + 12 >= mid - reach / 2 && px - 12 <= mid + reach / 2;
      } else if (ch === 'v') {
        reach = (ty + 1) * TILE - top; mid = (tx + 0.5) * TILE;
        contact = reach >= 2 && reach <= TILE && px + 12 >= mid - reach / 2 && px - 12 <= mid + reach / 2;
      } else if (ch === '<') {
        reach = px + 12 - tx * TILE; mid = (ty + 0.5) * TILE;
        contact = reach >= 2 && reach <= TILE && py >= mid - reach / 2 && top <= mid + reach / 2;
      } else if (ch === '>') {
        reach = (tx + 1) * TILE - (px - 12); mid = (ty + 0.5) * TILE;
        contact = reach >= 2 && reach <= TILE && py >= mid - reach / 2 && top <= mid + reach / 2;
      }
      if (ch === '^' && (player.vy < 0 || (player.vy === 0 && !player.onGround))) contact = false;
      if (contact) {
        if (down && ch === '^' && player.vy >= 0) { player.vy = -280; player.pogo = true; refill(); return true; }
        die(); return true;
      }
    }
    return false;
  }
  function touchEntities(input, melee) {
    var i, e, ex, ey, dx, dy, k, kind;
    for (i = 0; i < current.entities.length; i++) {
      e = current.entities[i]; if (e.dead || (e.t === 'refill' && e.t0 > 0)) continue;
      ex = (e.x + 0.5) * TILE; ey = (e.y + 1) * TILE;
      dx = Math.abs(player.x - ex); dy = Math.abs((player.y - 16) - (ey - 8));
      if (dx > 22 || dy > 24) continue;
      kind = kinds[e.t]; if (kind && kind.touch) kind.touch(e, input, melee, dx, dy);
    }
  }
  function step(dt, raw) {
    var input = parseInput(raw), dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    var pressedJump = !!input.jump, pressedDash = !!input.dash, pressedMelee = !!input.melee;
    var oldGround, target, accel, dashDirX, dashDirY, hit, downStrike, i, broke;
    if (!current || current.exited) return getState();
    dt = clamp(Number(dt) || STEP, 0, 0.1);
    if (player.dead > 0) {
      player.dead = Math.max(0, player.dead - dt);
      if (!player.dead) respawn();
      return getState();
    }
    player.coyote = player.onGround ? 0.1 : Math.max(0, player.coyote - dt);
    player.jumpBuffer = pressedJump ? 0.08 : Math.max(0, player.jumpBuffer - dt);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.wallTime = Math.max(0, player.wallTime - dt);
    player.forceX = Math.max(0, player.forceX - dt);
    oldGround = player.onGround;
    if (oldGround) { refill(); player.stamina = 110; }
    if (pressedMelee) player.swing = 0.12;
    else player.swing = Math.max(0, (player.swing || 0) - dt);
    downStrike = pressedMelee && input.down;

    if (input.grab && (nearbyWall(-1) || nearbyWall(1)) && !oldGround && player.stamina > 0) {
      if (input.up) { player.vy = -90; player.stamina = Math.max(0, player.stamina - 45.45 * dt); }
      else if (input.down) { player.vy = 160; }
      else { player.vy = Math.min(player.vy, 40); player.stamina = Math.max(0, player.stamina - 10 * dt); }
      if (pressedJump) { player.stamina = Math.max(0, player.stamina - 27.5); doJump(nearbyWall(-1) ? 1 : -1); }
    } else {
      if (player.dashTime <= 0 && pressedDash && player.dashes > 0 && player.dashCooldown <= 0) {
        dashDirX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        dashDirY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
        if (!dashDirX && !dashDirY) dashDirX = player.face;
        var len = Math.sqrt(dashDirX * dashDirX + dashDirY * dashDirY) || 1;
        player.dashX = dashDirX / len; player.dashY = dashDirY / len;
        player.vx = player.dashX * 480; player.vy = player.dashY * 480;
        player.dashes--; player.onGround = false; player.dashTime = 0.15; player.dashCooldown = 0.2;
      }
      if (player.dashTime > 0) {
        player.dashTime = Math.max(0, player.dashTime - dt);
        if (player.dashTime < 0.000001) player.dashTime = 0;
        if (!reduced) {
          afterimages.push({ x: player.x, y: player.y, t: 0.12 });
          while (afterimages.length > 3) afterimages.shift();
        }
        broke = false;
        var bx0 = Math.floor((player.x + player.vx * dt - 12) / TILE);
        var bx1 = Math.floor((player.x + player.vx * dt + 12) / TILE);
        var by0 = Math.floor((player.y + player.vy * dt - 32) / TILE);
        var by1 = Math.floor((player.y + player.vy * dt - 1) / TILE), tx, ty;
        for (ty = by0; ty <= by1; ty++) for (tx = bx0; tx <= bx1; tx++)
          if (cell(tx, ty) === 'x') { if (!current.broken) current.broken = {}; current.broken[tx + ',' + ty] = true; broke = true; }
        if (broke) { delete bakeCache[current.id]; bake(); }
        hit = sweep(player.vx * dt, player.vy * dt);
        if (hit.x || hit.y) player.dashTime = 0;
        if (player.dashTime === 0) { player.vx = player.dashX * 320; player.vy = player.dashY * 320 * (player.dashY < 0 ? 0.75 : 1); }
      } else {
        if (dir) player.face = dir;
        target = dir * 180;
        accel = oldGround ? (dir && player.vx * dir < 0 ? 800 : 2000) : 1300;
        if (dir) player.vx = approach(player.vx, target, accel * dt);
        else player.vx = approach(player.vx, 0, 800 * dt);
        if (player.forceX > 0) player.vx = player.forceDir * 260;
        if (player.jumpBuffer > 0 && (player.coyote > 0 || player.onGround)) doJump(dir);
        else if (player.jumpBuffer > 0 && (nearbyWall(-1) || nearbyWall(1))) {
          doJump(nearbyWall(-1) ? 1 : -1); player.vx = (nearbyWall(-1) ? 1 : -1) * 260;
          player.forceX = 0.16; player.forceDir = player.vx > 0 ? 1 : -1;
        }
        if (player.vy < 0 && player.varJump > 0 && input.jump) player.vy = Math.max(player.vy, -210);
        player.vy += 1800 * (Math.abs(player.vy) < 80 && input.jump && player.varJump > 0 ? 0.5 : 1) * dt;
        player.vy = Math.min(player.vy, input.down ? 480 : 320);
        if (player.varJump > 0) player.varJump = Math.max(0, player.varJump - dt);
        hit = sweep(player.vx * dt, player.vy * dt);
        if (hit.x && player.vy < 0) { for (i = 1; i <= 8; i++) if (!blocked(player.x, player.y - i, 0, player.y)) { player.y -= i; break; } }
        player.onGround = hit.y && player.vy >= 0;
        if (!player.onGround && (nearbyWall(-1) || nearbyWall(1)) && player.vy > 40) player.vy = 40;
        if (hit.y && player.vy < 0) player.varJump = 0;
        if (player.onGround) { player.coyote = 0.1; player.squash = 0.12; if (!oldGround) refill(); }
      }
    }
    if (downStrike && hitSpike(player.x, player.y, true)) {}
    else if (!downStrike) hitSpike(player.x, player.y, false);
    touchEntities(input, pressedMelee);
    for (i = 0; i < current.entities.length; i++) if (kinds[current.entities[i].t] && kinds[current.entities[i].t].tick) kinds[current.entities[i].t].tick(current.entities[i], dt);
    if (player.x < -24 || player.y > current.h * TILE + 64) die();
    player.squash = Math.max(0, player.squash - dt); player.stretch = Math.max(0, player.stretch - dt);
    if (player.onGround && Math.abs(player.vx) > 8) player.walked += Math.abs(player.vx) * dt;
    for (i = afterimages.length - 1; i >= 0; i--) { afterimages[i].t -= dt; if (afterimages[i].t <= 0) afterimages.splice(i, 1); }
    return getState();
  }
  function getState() { return { x: player.x, y: player.y, vx: player.vx, vy: player.vy,
    dashes: player.dashes, onGround: player.onGround, stamina: player.stamina, dead: player.dead > 0 }; }
  function respawn() {
    player.x = (current.spawn.x + 0.5) * TILE; player.y = (current.spawn.y + 1) * TILE;
    player.vx = 0; player.vy = 0; player.onGround = false; player.dashes = 1;
  }
  function bake() {
    if (!current || !document.createElement) return;
    var tall = (padB[current.tileset] | 0), c, x, y, ch, px, py, i, done = false;
    api._baking = true;
    baked = document.createElement('canvas');
    api._baking = false;
    baked.width = current.w * TILE; baked.height = current.h * TILE + tall;
    c = baked.getContext('2d'); if (!c) return;
    c.imageSmoothingEnabled = false;
    if (c.clearRect) c.clearRect(0, 0, baked.width, baked.height);
    for (i = 0; i < painters.length && !done; i++) done = !!painters[i](c, current);
    if (done) return;
    var colors = ['#181725', '#51455c', '#b892ff'];
    c.fillStyle = colors[0]; c.fillRect(0, 0, baked.width, baked.height);
    for (y = 0; y < current.h; y++) for (x = 0; x < current.w; x++) {
      ch = cell(x, y); px = x * TILE; py = y * TILE;
      if (ch === '#' || ch === 'x') { c.fillStyle = ch === 'x' ? '#9a4263' : colors[1]; c.fillRect(px, py, TILE, TILE); c.fillStyle = colors[2]; c.fillRect(px, py, TILE, 2); }
      else if (ch === '=') { c.fillStyle = colors[2]; c.fillRect(px, py, TILE, 3); }
      else if (ch === '^' || ch === 'v' || ch === '<' || ch === '>') spikeTile(c, px, py, ch);
    }
  }
  function spikeTile(c, px, py, ch) {
    var body = '#FF5577', tip = '#FFD0DC';
    if (ch === '^') {
      c.fillStyle = tip; c.fillRect(px + 7, py + 2, 2, 4);
      c.fillStyle = body; c.fillRect(px + 4, py + 6, 8, 4); c.fillRect(px + 2, py + 10, 12, 6);
    } else if (ch === 'v') {
      c.fillStyle = body; c.fillRect(px + 2, py, 12, 6); c.fillRect(px + 4, py + 6, 8, 4);
      c.fillStyle = tip; c.fillRect(px + 7, py + 10, 2, 4);
    } else if (ch === '<') {
      c.fillStyle = tip; c.fillRect(px + 2, py + 7, 4, 2);
      c.fillStyle = body; c.fillRect(px + 6, py + 4, 4, 8); c.fillRect(px + 10, py + 2, 6, 12);
    } else {
      c.fillStyle = body; c.fillRect(px, py + 2, 6, 12); c.fillRect(px + 6, py + 4, 4, 8);
      c.fillStyle = tip; c.fillRect(px + 10, py + 7, 4, 2);
    }
  }
  /* a stepped steel spike pair in any of four directions; pal = { ink, dark, mid, light, tip, base } */
  var STEEL = { ink: '#12081E', dark: '#5A6470', mid: '#9AA0A8', light: '#E4E4EC', tip: '#FFFFFF', base: '#3A4048' };
  function spikeShape(c, px, py, ch, pal) {
    var q = pal || STEEL, W = [2, 2, 2, 4, 4, 4, 6, 6, 6, 8, 8, 8], k, n, cx, wd, v, u;
    function R(uu, vv, ww, hh, col) {
      c.fillStyle = col;
      if (ch === '^') c.fillRect(px + uu, py + vv, ww, hh);
      else if (ch === 'v') c.fillRect(px + uu, py + 16 - vv - hh, ww, hh);
      else if (ch === '<') c.fillRect(px + vv, py + uu, hh, ww);
      else c.fillRect(px + 16 - vv - hh, py + uu, hh, ww);
    }
    R(0, 13, 16, 3, q.ink); R(1, 13, 14, 2, q.dark); R(1, 13, 14, 1, q.mid);
    for (n = 0; n < 2; n++) {
      cx = 4 + n * 8;
      for (k = 0; k < 12; k++) {
        wd = W[k]; u = cx - (wd >> 1); v = 2 + k;
        R(u - 1, v, wd + 2, 1, q.ink);
      }
      for (k = 0; k < 12; k++) {
        wd = W[k]; u = cx - (wd >> 1); v = 2 + k;
        R(u, v, wd, 1, q.mid);
        R(u, v, Math.max(1, wd >> 1), 1, q.light);
        R(u + wd - 1, v, 1, 1, q.dark);
      }
      R(cx - 1, 2, 1, 1, q.tip);
    }
  }
  function placeCamera() {
    var worldH = current.h * TILE, worldW = current.w * TILE;
    camera.x = clamp(player.x - view.w / 2, 0, Math.max(0, worldW - view.w));
    if (worldH < view.h) camera.y = (worldH - view.h) / 2;
    else camera.y = clamp(player.y - view.h / 2, 0, Math.max(0, worldH - view.h));
  }
  function mod(a, n) { return ((a % n) + n) % n; }
  /* one cached 1x sprite; fn(R, g) paints it, R(x, y, w, h, colour) is an integer fillRect */
  function spr(key, w, h, fn) {
    var s = sprCache[key], cv, g;
    if (s) return s;
    cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    g = cv.getContext && cv.getContext('2d');
    s = sprCache[key] = { cv: cv, w: w, h: h };
    if (g) { g.imageSmoothingEnabled = false; fn(function (x, y, ww, hh, col) { g.fillStyle = col; g.fillRect(x, y, ww, hh); }, g); }
    return s;
  }
  function rowsOf(R, rows, pal, x, y) {
    var r, i, ch;
    for (r = 0; r < rows.length; r++) for (i = 0; i < rows[r].length; i++) {
      ch = rows[r].charAt(i);
      if (ch !== '.' && pal[ch]) R(x + i, y + r, 1, 1, pal[ch]);
    }
  }
  function put(c, s, x, y) { if (s && s.cv) c.drawImage(s.cv, x | 0, y | 0); }
  function glow(c, x, y, r, col, a) {
    var L = NEU.engineLook;
    if (L && L.glow && c.createRadialGradient) L.glow(c, x, y, r, col, a);
  }
  function draw() {
    if (!ctx || !current || !live) return;
    var dpr = window.devicePixelRatio || 1, w = Math.round(window.innerWidth * dpr), h = Math.round(window.innerHeight * dpr);
    var now, dtf, ox, oy, shook = false, ai, i, e, J = NEU.juice, L = current;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    reduced = redNow();
    now = reduced ? 0 : (window.performance && performance.now ? performance.now() : Date.now());
    dtf = clamp((now - lastDraw) / 1000, 0, 0.05); lastDraw = now;
    view.h = 360; view.w = clamp(Math.round(360 * w / h), 240, 640);
    view.scale = Math.min(w / view.w, h / view.h);
    ox = Math.round((w - view.w * view.scale) / 2); oy = Math.round((h - view.h * view.scale) / 2);
    area.x0 = Math.floor(-ox / view.scale) - 1; area.y0 = Math.floor(-oy / view.scale) - 1;
    area.x1 = Math.ceil((w - ox) / view.scale) + 1; area.y1 = Math.ceil((h - oy) / view.scale) + 1;
    placeCamera();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!api.backdrop) { ctx.fillStyle = '#0b0a12'; ctx.fillRect(0, 0, w, h); }
    ctx.setTransform(view.scale, 0, 0, view.scale, ox, oy); ctx.imageSmoothingEnabled = false;
    /* begin() wraps save/rotate; only a live shake needs it, so a still frame paints with no transform */
    if (J && J.begin && !reduced && J.trauma > 0) shook = !!J.begin(ctx, view.w, view.h);
    if (api.backdrop) api.backdrop(ctx, camera.x, camera.y, L, now, area);
    if (baked) ctx.drawImage(baked, -camera.x | 0, -camera.y | 0);
    if (api.live) api.live(ctx, camera.x, camera.y, L, now, area);
    if (!reduced) for (ai = 0; ai < afterimages.length; ai++) {
      ctx.save();
      ctx.globalAlpha = (afterimages[ai].t / 0.12) * 0.28;
      drawHero(ctx, afterimages[ai].x - camera.x, afterimages[ai].y - camera.y, player.face, false);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (i = 0; i < L.entities.length; i++) {
      e = L.entities[i];
      if (e.dead) continue;
      if (e.x * TILE - camera.x < area.x0 - 48 || e.x * TILE - camera.x > area.x1 + 16) continue;
      drawEntity(e, ctx, camera.x, camera.y, now);
    }
    if (player.dead <= 0) {
      if (player.onGround) {
        ctx.globalAlpha = 0.4; ctx.fillStyle = '#000000';
        ctx.fillRect((player.x - camera.x - 10) | 0, (player.y - camera.y) | 0, 20, 1);
        ctx.fillRect((player.x - camera.x - 7) | 0, (player.y - camera.y + 1) | 0, 14, 1);
        ctx.globalAlpha = 1;
      }
      drawHero(ctx, player.x - camera.x, player.y - camera.y, player.face, player.onGround);
    }
    if (player.dead <= 0 && player.swing > 0) {
      ctx.fillStyle = '#fff0a6'; ctx.globalAlpha = Math.min(1, player.swing / 0.12);
      ctx.fillRect(player.x - camera.x + player.face * 12, player.y - camera.y - 24, player.face * 12, 3);
      ctx.fillRect(player.x - camera.x + player.face * 17, player.y - camera.y - 18, player.face * 3, 8);
      ctx.globalAlpha = 1;
    }
    if (J && J.drawParts) { ctx.save(); ctx.translate(-camera.x, -camera.y); J.drawParts(ctx, dtf || 0.016); ctx.restore(); }
    if (api.foreground) api.foreground(ctx, camera.x, camera.y, L, now, area);
    if (J && J.end) J.end(ctx, shook);
  }
  var INK = '#12081E', DEF = { key: 'def', ink: INK, deep: '#3A2418', base: '#6A4030', light: '#C4846A', rim: '#E8B090' };
  function skin() { return (api.skin && api.skin(current)) || DEF; }
  function fr(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
  function ell(g, ox, oy, cx, cy, rx, ry, col) {
    var y, k, hw;
    g.fillStyle = col;
    for (y = -ry; y <= ry; y++) {
      k = 1 - (y * y) / ((ry + 0.5) * (ry + 0.5));
      if (k <= 0) continue;
      hw = Math.round(rx * Math.sqrt(k));
      g.fillRect(ox + cx - hw, oy + cy + y, hw * 2 + 1, 1);
    }
  }
  /* an arched opening: two stepped shoulders, then the straight sides */
  function archFill(c, x, y, w, h, col) {
    c.fillStyle = col;
    c.fillRect(x + 2, y, w - 4, 1); c.fillRect(x + 1, y + 1, w - 2, 1); c.fillRect(x, y + 2, w, h - 2);
  }
  var COIN_W = [10, 8, 4, 8];
  function coinSpr(f) {
    var wd = COIN_W[f];
    return spr('coin' + f, 10, 10, function (R) {
      var x0 = (10 - wd) >> 1, y, ins;
      for (y = 0; y < 10; y++) {
        ins = Math.min((y === 0 || y === 9) ? 2 : (y === 1 || y === 8) ? 1 : 0, Math.max(0, (wd >> 1) - 1));
        R(x0 + ins, y, wd - ins * 2, 1, '#6A4A08');
        if (y > 0 && y < 9) R(x0 + 1 + (ins ? 1 : 0), y, Math.max(1, wd - 2 - (ins ? 2 : 0)), 1, '#C89A1A');
      }
      if (wd >= 8) { R(x0 + 2, 2, wd - 5, 1, '#FFE35A'); R(x0 + 2, 3, 1, 3, '#FFE35A'); R(x0 + 3, 3, 2, 2, '#FFF6C0'); R(x0 + 2, 8, wd - 4, 1, '#A07810'); }
      else R(x0 + 1, 2, 1, 6, '#FFE35A');
    });
  }
  function refillSpr() {
    return spr('refill', 10, 14, function (R) {
      var W = [2, 4, 6, 8, 10, 10, 10, 10, 10, 10, 8, 6, 4, 2], y, wd, x0;
      for (y = 0; y < 14; y++) {
        wd = W[y]; x0 = (10 - wd) >> 1;
        R(x0, y, wd, 1, INK);
        if (wd > 2) {
          R(x0 + 1, y, wd - 2, 1, '#2AA8C0');
          R(x0 + 1, y, Math.max(1, (wd - 2) >> 1), 1, '#64E8FF');
          R(x0 + wd - 2, y, 1, 1, '#146878');
        }
      }
      R(4, 2, 2, 2, '#E8FFFF'); R(3, 5, 1, 2, '#E8FFFF'); R(5, 12, 4, 1, '#146878');
    });
  }
  function crumbleSpr(s) {
    return spr('crumble' + s.key, 16, 16, function (R, g) {
      var y, i;
      R(0, 0, 16, 16, INK); R(1, 1, 14, 14, s.base);
      R(1, 1, 14, 1, s.light); R(1, 1, 1, 14, s.light); R(1, 14, 14, 1, s.deep); R(14, 1, 1, 14, s.deep);
      R(1, 7, 14, 1, s.deep); R(8, 1, 1, 6, s.deep); R(4, 8, 1, 6, s.deep); R(11, 8, 1, 6, s.deep);
      R(3, 3, 3, 1, s.rim); R(10, 9, 3, 1, s.rim);
      R(6, 5, 2, 1, INK); R(7, 6, 2, 1, INK); R(8, 7, 1, 2, INK); R(9, 9, 2, 1, INK);
    });
  }
  function checkpointSpr() {
    return spr('checkpoint', 12, 24, function (R) {
      R(1, 21, 10, 3, INK); R(2, 21, 8, 2, '#5C4030'); R(2, 21, 8, 1, '#8A6040');
      R(4, 4, 4, 17, INK); R(5, 4, 2, 17, '#3A2A20'); R(5, 4, 1, 17, '#5C4030');
      R(4, 1, 4, 4, INK); R(5, 2, 2, 2, '#FFD36A');
    });
  }
  function skullSpr() {
    return spr('skull', 16, 14, function (R, g) {
      ell(g, 0, 0, 8, 6, 7, 6, INK); ell(g, 0, 0, 8, 6, 6, 5, '#C4A882'); ell(g, 0, 0, 7, 5, 5, 4, '#E8D2B0');
      R(4, 5, 3, 3, '#1A120C'); R(9, 5, 3, 3, '#1A120C'); R(7, 8, 2, 2, '#1A120C');
      R(3, 11, 10, 3, INK); R(4, 11, 8, 2, '#C4A882'); R(5, 11, 1, 2, '#F4E4CC'); R(7, 11, 1, 2, '#F4E4CC'); R(9, 11, 1, 2, '#F4E4CC');
      R(4, 13, 8, 1, '#8A7456');
    });
  }
  function exitSpr(s) {
    return spr('exit' + s.key, 24, 32, function (R) {
      var y;
      archFill2(R, 0, 0, 24, 32, INK);
      archFill2(R, 1, 1, 22, 31, s.base);
      R(1, 6, 3, 26, s.light); R(20, 6, 3, 26, s.deep); R(2, 3, 2, 3, s.light); R(8, 1, 8, 2, s.light);
      R(10, 0, 4, 3, s.rim); R(11, 3, 2, 1, INK);
      for (y = 8; y < 32; y += 8) { R(1, y, 3, 1, s.deep); R(20, y + 4, 3, 1, s.base); }
      R(0, 31, 24, 1, INK); R(0, 30, 24, 1, s.deep);
    });
  }
  function archFill2(R, x, y, w, h, col) { R(x + 2, y, w - 4, 1, col); R(x + 1, y + 1, w - 2, 1, col); R(x, y + 2, w, h - 2, col); }

  var ENT = {
    coin: function (c, px, py, e, now) {
      put(c, coinSpr(reduced ? 0 : ((now / 120) | 0) & 3), px + 3, py + 3);
    },
    refill: function (c, px, py, e, now) {
      var on = !(e.t0 > 0), dy = (on && !reduced) ? (((now / 400) | 0) & 1) : 0, k;
      if (!on) c.globalAlpha = 0.3;
      else glow(c, px + 8, py + 8, 20, '#64E8FF', 0.15);
      put(c, refillSpr(), px + 3, py + 1 + dy);
      c.globalAlpha = 1;
      if (on) { k = reduced ? 0 : ((now / 400) | 0) & 3; fr(c, px + [1, 13, 12, 2][k], py + [3, 5, 12, 11][k], 1, 1, '#64E8FF'); }
    },
    crumble: function (c, px, py, e, now) {
      var s = skin(), j = (e.breakAt > 0 && !reduced) ? ((((now / 40) | 0) & 1) ? 1 : -1) : 0;
      put(c, crumbleSpr(s), px + j, py);
      fr(c, px + 3 + j, py + 2, 4, 1, s.light);
    },
    checkpoint: function (c, px, py, e, now) {
      var f = reduced ? 0 : ((now / 160) | 0) % 3, i, top = py - 22 + 3, off, up = e.active ? 0 : 6;
      put(c, checkpointSpr(), px + 2, py - 22);
      for (i = 0; i < 8; i++) {
        off = (((i + f) % 3) === 0) ? 1 : 0;
        fr(c, px + 8 + i, top + up + off, 1, 6 - (i >> 2), '#802048');
        fr(c, px + 8 + i, top + up + off + 1, 1, 3 - (i >> 2), '#C83A7A');
        fr(c, px + 8 + i, top + up + off, 1, 1, '#FF8AC8');
      }
      if (e.active) glow(c, px + 8, py - 12, 18, '#FF8AC8', 0.14);
    },
    skull: function (c, px, py, e, now) {
      put(c, skullSpr(), px, py + 1);
      fr(c, px + 5, py + 2, 3, 1, '#F4E4CC');
      fr(c, px + 5, py + 6, 1, 1, '#FF5577'); fr(c, px + 10, py + 6, 1, 1, '#FF5577');
    },
    exit: function (c, px, py, e, now) {
      var s = skin(), ix = px - 4 + 4, iy = py - 16 + 4, p = reduced ? 0 : ((now / 400) | 0) & 1;
      glow(c, px + 8, py - 2, 26, '#5AC85A', 0.12);
      put(c, exitSpr(s), px - 4, py - 16);
      archFill(c, ix, iy, 16, 28, '#1A4020');
      archFill(c, ix + 2, iy + 3, 12, 25, '#5AC85A');
      archFill(c, ix + 4 + p, iy + 6 + p, 8 - p * 2, 22 - p, '#A9FF8A');
    },
    spring: function (c, px, py, e) {
      var cmp = (e.flash > 0 && !reduced) ? 4 : 0, t = py + 4 + cmp, k, yy, gap = ((9 - cmp) / 3) | 0;
      fr(c, px + 1, py + 13, 14, 3, INK); fr(c, px + 2, py + 14, 12, 2, '#8A6410'); fr(c, px + 2, py + 13, 12, 1, '#B8861A');
      for (k = 0; k < 3; k++) {
        yy = t + 4 + k * gap;
        fr(c, px + 4, yy, 8, 2, INK); fr(c, px + 5, yy, 6, 1, '#FFCF4A'); fr(c, px + 5, yy + 1, 6, 1, '#8A6410');
      }
      fr(c, px + 1, t, 14, 4, INK); fr(c, px + 2, t + 1, 12, 2, '#FFCF4A'); fr(c, px + 2, t + 1, 12, 1, '#FFF0A0');
    },
    zip: function (c, px, py, e, now) {
      var a = reduced ? 0 : ((now / 400) | 0) & 1;
      fr(c, px, py, 16, 16, INK); fr(c, px + 1, py + 1, 14, 14, '#1A3058');
      fr(c, px + 1, py + 1, 14, 1, '#7AA2FF'); fr(c, px + 1, py + 1, 1, 14, '#7AA2FF');
      fr(c, px + 14, py + 2, 1, 13, '#0E1C38'); fr(c, px + 2, py + 14, 13, 1, '#0E1C38');
      fr(c, px + 4, py + 4, 8, 8, '#7AA2FF'); fr(c, px + 5, py + 5, 6, 6, '#26407A');
      fr(c, px + 7, py + 6 + a, 2, 4 - a, '#E8F0FF'); fr(c, px + 6, py + 7 + a, 4, 1, '#E8F0FF');
      fr(c, px + 2, py + 2, 1, 1, '#E8F0FF'); fr(c, px + 13, py + 2, 1, 1, '#E8F0FF');
    },
    barrier: function (c, px, py) {
      var i;
      for (i = 0; i < 6; i++) { fr(c, px + 2 + i * 2, py + 2 + i * 2, 4, 3, INK); fr(c, px + 12 - i * 2, py + 2 + i * 2, 4, 3, INK); }
      for (i = 0; i < 6; i++) { fr(c, px + 3 + i * 2, py + 3 + i * 2, 2, 2, '#E23B4A'); fr(c, px + 13 - i * 2, py + 3 + i * 2, 2, 2, '#E23B4A'); }
      fr(c, px + 3, py + 3, 1, 1, '#FFD0D4'); fr(c, px + 13, py + 3, 1, 1, '#FFD0D4');
    },
    pogo: function (c, px, py, e, now) {
      var b = reduced ? 0 : ((now / 400) | 0) & 1;
      glow(c, px + 8, py + 8, 16, '#3DDC97', 0.12);
      ell(c, px, py + b, 8, 8, 6, 6, INK); ell(c, px, py + b, 8, 8, 5, 5, '#146848'); ell(c, px, py + b, 7, 7, 3, 3, '#3DDC97');
      fr(c, px + 5, py + 5 + b, 2, 2, '#C8FFE4'); fr(c, px + 4, py + 14, 8, 2, INK); fr(c, px + 5, py + 14, 6, 1, '#146848');
    },
    door: function (c, px, py) {
      fr(c, px + 1, py, 14, 16, INK); fr(c, px + 2, py + 1, 12, 15, '#8A5A32');
      fr(c, px + 2, py + 1, 12, 1, '#B07A4A'); fr(c, px + 5, py + 1, 1, 15, '#3A2418'); fr(c, px + 10, py + 1, 1, 15, '#3A2418');
      fr(c, px + 11, py + 8, 2, 2, '#E8C878'); fr(c, px + 2, py + 4, 12, 1, '#3A2418'); fr(c, px + 2, py + 12, 12, 1, '#3A2418');
    },
    spike: function (c, px, py) { api.spike(c, px, py, '^', null); }
  };
  function drawEntity(e, c, x, y, now) {
    var px = (e.x * TILE - x) | 0, py = (e.y * TILE - y) | 0, kind = kinds[e.t];
    if (kind && kind.draw) { kind.draw(c, px, py, e, now); return; }
    if (ENT[e.t]) { ENT[e.t](c, px, py, e, now || 0); return; }
    c.fillStyle = '#FF00FF';
    c.fillRect(px, py, 16, 16);
  }
  function drawHero(c, wx, wy, face, moving) {
    var look = NEU.engineLook;
    if (look && look.drawPlayer) {
      look.drawPlayer(c, wx, wy, face > 0 ? 'right' : 'left', player.walked || 0, !!moving && !reduced, 2, 1000, { settle: player.squash > 0 && !reduced });
      return;
    }
    c.fillStyle = '#FF00FF';
    c.fillRect((wx - 12) | 0, (wy - 32) | 0, 24, 32);
  }
  function open(id, opts) {
    if (!levels[id]) return false;
    if (live) close();
    current = cloneLevel(levels[id]); player = fresh(); opts = opts || {};
    if (opts.spawn) current.spawn = opts.spawn;
    player.x = (current.spawn.x + 0.5) * TILE; player.y = (current.spawn.y + 1) * TILE;
    accumulator = 0; afterimages = []; live = true; paused = false; reduced = redNow(); if (overlay) overlay.hidden = false;
    /* ponytail: per-room bake cache, dropped when a crumble breaks; a room bakes on its first open only (prebake warms d0 and m0 at boot) */
    if (bakeCache[id]) baked = bakeCache[id]; else { bake(); bakeCache[id] = baked; }
    draw();
    NEU.activeMinigame = 'plat';
    if (NEU.kernel) NEU.kernel.push('plat'); return true;
  }
  function cloneLevel(src) {
    var out = {}, k;
    for (k in src) if (Object.prototype.hasOwnProperty.call(src, k) && k !== 'entities') out[k] = src[k];
    out.entities = src.entities.map(function (e) { var v = {}, p; for (p in e) if (Object.prototype.hasOwnProperty.call(e, p)) v[p] = e[p]; return v; });
    return out;
  }
  function close() {
    if (!live) return;
    live = false;
    if (overlay) overlay.hidden = true;
    if (NEU.activeMinigame === 'plat') NEU.activeMinigame = null;
    if (NEU.kernel && NEU.kernel.current() === 'plat') NEU.kernel.pop();
  }
  function tick(dt) {
    if (!live || paused) return;
    /* dt arrives in ms (kernel rAF delta); convert to seconds before the 0.25 s clamp, or every frame adds 0.00025 s and the hero never moves */
    accumulator += Math.min(0.25, Math.max(0, dt) / 1000);
    var n = 0;
    while (accumulator >= STEP && n++ < MAX_STEPS) { step(STEP, keys); accumulator -= STEP; }
    draw();
  }
  function replay(id, recording) {
    var oldLevel = current, oldPlayer = player, oldLive = live, oldPaused = paused;
    var oldAccumulator = accumulator, oldImages = afterimages, oldBaked = baked;
    var oldStack = NEU.kernel ? NEU.kernel.stack.slice() : null;
    var oldMini = NEU.activeMinigame;
    if (!open(id)) return { reached: false, deaths: 0, frames: 0 };
    replaying = true;
    var frames = 0, deaths = 0, i, j, pair, state, wasDead = false;
    for (i = 0; i < recording.length; i++) {
      pair = recording[i];
      for (j = 0; j < pair[0]; j++) { state = step(STEP, pair[1]); frames++; if (state.dead && !wasDead) deaths++; wasDead = state.dead; if (current.exited) break; }
      if (current.exited) break;
    }
    var reached = !!current.exited;
    replaying = false;
    live = oldLive; current = oldLevel; player = oldPlayer; paused = oldPaused;
    accumulator = oldAccumulator; afterimages = oldImages; baked = oldBaked;
    if (oldStack && NEU.kernel) { NEU.kernel.stack.length = 0; for (i = 0; i < oldStack.length; i++) NEU.kernel.stack.push(oldStack[i]); }
    NEU.activeMinigame = oldMini;
    if (overlay) overlay.hidden = !live; return { reached: reached, deaths: deaths, frames: frames };
  }
  function getStateSafe() { return live ? getState() : null; }
  function routed(e) {
    var r = (NEU.keys && NEU.keys.route) ? NEU.keys.route(e.key, {}) : { to: e.key, swallow: false };
    if (r.swallow) return null;
    return r.to;
  }
  function onTop() { return !NEU.kernel || NEU.kernel.current() === 'plat'; }
  function onKey(e) {
    var k, down;
    if (!live || !onTop()) return;
    k = routed(e);
    if (k == null) return;
    down = e.type === 'keydown';
    if (k === 'Escape' && down) { close(); e.preventDefault(); return; }
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = down;
    if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = down;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') keys.up = down;
    if (k === 'ArrowDown' || k === 's' || k === 'S') keys.down = down;
    if (k === ' ' || k === 'Space' || k === 'Spacebar') keys.jump = down;
    if (k === 'x' || k === 'X') keys.dash = down;
    if (k === 'Shift') keys.grab = down;
    if (k === 'z' || k === 'Z') keys.melee = down;
    if (down && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'x', 'X'].indexOf(k) >= 0) e.preventDefault();
  }
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  kinds.refill = { touch: function (e) { if (!(e.t0 > 0)) { refill(); e.t0 = 2.5; } }, tick: function (e, dt) { if (e.t0 > 0) { e.t0 -= dt; if (e.t0 <= 0) e.t0 = 0; } } };
  kinds.spring = { touch: function (e) { if (player.vy >= 0) { player.vy = -370; player.varJump = 0.2; refill(); e.flash = 0.2; } } };
  kinds.zip = { touch: function (e) { if (!e.go) { e.go = true; e.returning = false; e.wait = 0.2; e.sx = e.x; e.sy = e.y; } }, tick: function (e, dt) { if (!e.go) return; if (e.wait > 0) e.wait -= dt; else { var tx = e.returning ? e.sx : (e.targetX == null ? e.sx : e.targetX), ty = e.returning ? e.sy : (e.targetY == null ? e.sy - 4 : e.targetY); e.x = approach(e.x, tx, dt * 3); e.y = approach(e.y, ty, dt * 3); if (Math.abs(e.x - tx) < 0.05 && Math.abs(e.y - ty) < 0.05) { if (e.returning) e.go = false; else e.returning = true; } } } };
  kinds.crumble = { touch: function (e) { if (!e.breakAt) e.breakAt = 0.4; }, tick: function (e, dt) { if (e.breakAt > 0) { e.breakAt -= dt; if (e.breakAt <= 0) { e.dead = true; e.returnAt = 2; } } else if (e.returnAt > 0) { e.returnAt -= dt; if (e.returnAt <= 0) e.dead = false; } } };
  kinds.pogo = { touch: function (e, input, melee) { if (melee && input.down && player.vy > 0) { player.vy = -280; refill(); e.dead = e.once ? true : e.dead; } } };
  kinds.checkpoint = { touch: function (e) { current.spawn = { x: e.x, y: e.y - 1 }; e.active = true; } };
  kinds.exit = { touch: function () { current.exited = true; if (!replaying && typeof current.onExit === 'function') current.onExit(); } };
  kinds.coin = { touch: function (e) { e.dead = true; if (!replaying && NEU.save && NEU.save.addCoins && !NEU.save.flagged('plat_coin:' + e.id)) { NEU.save.addCoins(1); NEU.save.flag('plat_coin:' + e.id, 1); } } };
  kinds.npc = { touch: function (e, input, melee) { if (melee && NEU.talk) NEU.talk(e.lines || [e.text || '...'], e.who || 'narr'); } };
  kinds.door = { touch: function (e, input, melee) { if (!melee) return; var ok = !e.locked || (NEU.save && (NEU.save.flagged(e.locked) || NEU.save.has(e.locked))); if (ok) { e.dead = true; } else if (NEU.talk) NEU.talk([e.waits || ('It waits for ' + e.locked + '.')], 'narr'); } };
  kinds.barrier = { touch: function () {} };

  var api = { level: level, open: open, close: close, running: function () { return live; },
    painters: painters, pad: padB, spr: spr, rows: rowsOf, ell: ell, mod: mod, spike: spikeShape, glow: glow, fr: fr, steel: STEEL,
    mk: function (w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; },
    hash: function (x, y, z) {
      var h = (x * 374761393 + y * 668265263 + (z || 0) * 2147483647) | 0;
      h = (h ^ (h >>> 13)) * 1274126177 | 0;
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    },
    mix: function (a, b, t) {
      var x = [parseInt(a.substr(1, 2), 16), parseInt(a.substr(3, 2), 16), parseInt(a.substr(5, 2), 16)];
      var y = [parseInt(b.substr(1, 2), 16), parseInt(b.substr(3, 2), 16), parseInt(b.substr(5, 2), 16)], i, v, o = '#';
      for (i = 0; i < 3; i++) { v = Math.round(x[i] + (y[i] - x[i]) * t); o += (v < 16 ? '0' : '') + v.toString(16); }
      return o.toUpperCase();
    },
    reduced: redNow, bakedCanvas: function () { return baked; }, rebake: function () { bake(); },
    /* bake a room into the cache without opening it; restores the live level */
    prebake: function (id) {
      var keepLevel = current, keepBaked = baked;
      if (levels[id] && !bakeCache[id]) { current = cloneLevel(levels[id]); bake(); bakeCache[id] = baked; }
      current = keepLevel; baked = keepBaked;
    },
    view: function () { return { w: view.w, h: view.h, scale: view.scale }; },
    backdrop: null, live: null, foreground: null, skin: null,
    get state() { return getStateSafe(); }, step: step, replay: replay, tick: tick,
    levelId: function () { return current ? current.id : ''; },
    get levels() { return levels; }, _kinds: kinds,
    cam: function () { return { x: camera.x, y: camera.y }; } };
  NEU.plat = api;
  if (NEU.kernel) NEU.kernel.register('plat', { tick: tick, open: open, close: close, running: function () { return live; } });
  document.addEventListener('keydown', function (e) {
    var k;
    if (!live || !onTop()) return;
    k = routed(e);
    if (k === 'Escape') paused = true;
  });
})();
