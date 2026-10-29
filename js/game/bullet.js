/* bullet.js — the room behind the door.
   ───────────────────────────────────────────────────────────────────
   A twenty-second encounter, Undertale's box with Calamity's feel: the
   thing at the far end is the clock, and its boss bar is the twenty
   seconds draining. Three short phases, each announced in the box
   before it fires:

     1  the voice      rings and aimed shots, red soul
     2  blue           your soul turns BLUE (gravity): bones along the
                       floor to jump, blasters from above to step out
                       of, and the electric one — stay on the ground in
                       its beam and it charges what you carry
     3  the last six   a spiral, walls with one gap, blasters, aimed

   Movement, dash (X or a double-tap), the HUD and the
   screen-reader line all come from danmaku.js, shared with the bosses.
   Bullets spawn OUTSIDE the box and are culled well beyond it, so
   nothing ever pops into existence on top of you. There is no focus
   key.                                                                */

(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};

  var wrap = document.getElementById('bh');
  var cv   = document.getElementById('bhCanvas');
  if (!wrap || !cv) { NEU.bullet = { open: function () {}, close: function () {} }; return; }
  var ctx = cv.getContext ? cv.getContext('2d') : null;
  if (!ctx) { NEU.bullet = { open: function () {}, close: function () {} }; return; }

  var msg  = document.getElementById('bhMsg');

  /* dm.hud keeps #bhLive on HP and phase; the death and the end lines
     are written here, after it, so they are the last thing said. */
  var live = document.getElementById('bhLive');
  function announce(s) { if (live) live.textContent = s; }

  var dm = NEU.danmaku;
  var SURVIVE   = 20;          // seconds
  var PLAYER_R  = dm.soul.R;   // the TRUE hitbox
  var MAX_B     = 700;
  var BL_HALF = 24; // was 17, matches visual beam width at game scale
  var BORDER = 4;              // Undertale's white box edge
  var TELE = 1.0;              // a phase's line shows this long before it fires

  var COL = { bone: '#EDE7DE', lilac: '#B892FF', blood: '#C2405F',
              dim: '#8A8598', soul: '#E23B55', void_: '#08080B', elec: '#4FC3F7' };
  var FONT = '16px "Determination Mono","Pixelify Sans",monospace';

  /* Each phase: where it starts, the soul it wants, its line, and its
     emitters [kind, every]. Emitters drift out of sync on purpose —
     synchronised ones make corridors you can stand in forever. */
  var PHASES = [
    { at: 0,  mode: 'red',  line: '* twenty seconds. that\'s the whole ask.',
      em: [['ring', 1.30], ['aimed', 0.95]] },
    { at: 7,  mode: 'blue', line: '* your SOUL is blue now. stay on the ground.',
      em: [['bone', 1.25], ['blaster', 2.2], ['elec', 2.6]] },
    { at: 13, mode: 'red',  line: '* the last six. it is still aiming.',
      em: [['spiral', 0.075], ['wall', 2.6], ['blaster', 3.1], ['aimed', 1.4]] }
  ];

  /* Undertale's blaster: 6 frames of 43x57, mouth down. 0 = charging,
     1-3 = opening, 4/5 alternate while it fires. The electric one is a
     blue-tinted copy made once the sheet loads, and keeps the bolt on
     its brow so it reads without colour too. */
  var GB_W = 43, GB_H = 57;
  var gb = null, gbBlue = null;
  function sheet() {
    if (!gb) { gb = new Image(); gb.src = 'img/act4/undertale/gasterblaster.png'; }
    if (!gbBlue && gb.complete && gb.naturalWidth) {
      gbBlue = document.createElement('canvas');
      gbBlue.width = gb.naturalWidth; gbBlue.height = gb.naturalHeight;
      var g = gbBlue.getContext && gbBlue.getContext('2d');
      if (g) {
        g.drawImage(gb, 0, 0);
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = 'rgba(79,195,247,0.6)';
        g.fillRect(0, 0, gbBlue.width, gbBlue.height);
      }
    }
  }
  var BOLT = [
    '..##.',
    '.##..',
    '####.',
    '.##..',
    '.#...'
  ];

  var blasters = [], bones = [];
  var BL_CHARGE = 0.85, BL_FIRE = 0.42;

  /* ── the electric blaster ─────────────────────────────────────────
     Its rule is INVERTED and that is the whole point: in the blue
     section it hurts you in the air and charges the console if you are
     on the ground. Charge survives between runs. */
  /* Read back from the save, so a full console is still full after a
     reload. A missing flag is undefined, and `| 0` makes that 0. */
  var charge = (NEU.save && NEU.save.flag('console_charge')) | 0, chargeFx = 0, emptyFx = 0;
  /* sans.js owns the console; this room only asks whether it is in
     your hands right now. */
  function carrying() { return !!(NEU.hasConsole && NEU.hasConsole()); }
  /* Only a full charge is written, and only as it arrives. A half charge
     is not kept: the console re-earns its battery on the next visit (the
     rule sans.js describes), and the objective's count is never lost, only
     reaching 100 writes the flag. fixes34 F5 pins this. */
  function keepCharge() {
    if (charge >= 100 && NEU.save) NEU.save.flag('console_charge', 100);
  }
  NEU.charge = function () { return charge; };
  NEU.devCharge = function (n) {
    charge = Math.max(0, Math.min(100, n | 0));
    keepCharge();
    if (NEU.quest) NEU.quest.bump('charge', charge / 50);
    if (NEU.tvState) NEU.tvState();
    return charge;
  };
  var dying = 0;

  var running = false, won = false;
  var t = 0, hp = 3, inv = 0, last = 0;
  var F = dm.fight(0, 0), keys = {};
  var bullets = [], emitters = [], phase = 0, phaseAt = 0;
  var AW = 0, AH = 0, AX = 0, AY = 0;     // box rect, canvas space
  var cheat = '';                          // the 69420 buffer

  /* ── layout ─────────────────────────────────────────────────────── */
  function layout() {
    var dpr = Math.min(devicePixelRatio || 1, 2);
    var w = innerWidth, h = innerHeight;
    cv.width = (w * dpr) | 0; cv.height = (h * dpr) | 0;
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    var ar = dm.arena(w, h, 640, 360, 22);
    AW = ar.AW; AH = ar.AH; AX = ar.AX; AY = ar.AY;
    F.x = Math.min(Math.max(F.x, AX + 12), AX + AW - 12);
    F.y = Math.min(Math.max(F.y, AY + 12), AY + AH - 12);
  }
  addEventListener('resize', function () { if (running) layout(); });

  function add(x, y, vx, vy, r, c) { dm.shot(bullets, x, y, vx, vy, r, c, 0, MAX_B); }

  /* Difficulty: 0 at the start, 1 at the end. Endless keeps climbing —
     the curve is the content once there is no finish line. */
  function ramp() {
    return endless ? Math.min(2.4, t / SURVIVE) : Math.min(1, t / SURVIVE);
  }

  /* Endless loops the three phases every twenty seconds. */
  function phaseFor() {
    var lt = endless ? t % SURVIVE : t, p = 0;
    for (var i = 0; i < PHASES.length; i++) if (lt >= PHASES[i].at) p = i;
    return p + 1;
  }
  function enterPhase(n) {
    var P = PHASES[n - 1];
    phase = n; phaseAt = t;
    dm.soulMode(F, P.mode);
    emitters = [];
    for (var i = 0; i < P.em.length; i++)
      emitters.push({ kind: P.em[i][0], every: P.em[i][1], next: t + TELE + i * 0.3, ang: 0 });
  }

  /* A blaster lines up on an edge, offset from where you are RIGHT NOW,
     so standing still is punished but the charge leaves time to move. */
  function blaster(elec, horiz, spread) {
    var bl = { horiz: horiz, t: 0, elec: elec, took: false };
    var off = (Math.random() - 0.5) * spread;
    if (horiz) {
      bl.lane = Math.min(Math.max(F.y + off, AY + 34), AY + AH - 34);
      bl.from = Math.random() < 0.5 ? 'l' : 'r';
    } else {
      bl.lane = Math.min(Math.max(F.x + off, AX + 34), AX + AW - 34);
      bl.from = (F.mode === 'blue' || Math.random() < 0.5) ? 't' : 'b';
    }
    blasters.push(bl);
  }

  function fire(e) {
    var k = ramp();
    var cx = AX + AW / 2, cy = AY + AH / 2;

    if (e.kind === 'ring') {
      var n = 10 + Math.round(k * 12);
      var sp = 78 + k * 52;
      e.ang += 0.31;
      for (var i = 0; i < n; i++) {
        var a = e.ang + i * (Math.PI * 2 / n);
        add(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14,
            Math.cos(a) * sp, Math.sin(a) * sp, 4, COL.lilac);
      }
    } else if (e.kind === 'aimed') {
      /* From a random edge point, spread around you: what stops you
         parking in a corner. */
      var side = (Math.random() * 4) | 0, sx, sy;
      if (side === 0) { sx = AX + Math.random() * AW; sy = AY - 16; }
      else if (side === 1) { sx = AX + AW + 16; sy = AY + Math.random() * AH; }
      else if (side === 2) { sx = AX + Math.random() * AW; sy = AY + AH + 16; }
      else { sx = AX - 16; sy = AY + Math.random() * AH; }
      var base = Math.atan2(F.y - sy, F.x - sx);
      var cnt = 3 + Math.round(k * 3), spd = 128 + k * 92;
      for (var j = 0; j < cnt; j++) {
        var o = (j - (cnt - 1) / 2) * 0.17;
        add(sx, sy, Math.cos(base + o) * spd, Math.sin(base + o) * spd, 4, COL.bone);
      }
    } else if (e.kind === 'spiral') {
      e.ang += 0.42;
      var arms = 2 + Math.round(k * 2), s2 = 96 + k * 44;
      for (var m = 0; m < arms; m++) {
        var a2 = e.ang + m * (Math.PI * 2 / arms);
        add(cx, cy, Math.cos(a2) * s2, Math.sin(a2) * s2, 3, COL.blood);
      }
    } else if (e.kind === 'blaster') {
      /* Blue: only from above, so the floor stays yours. */
      blaster(false, F.mode !== 'blue' && Math.random() < 0.5, 110);
    } else if (e.kind === 'elec') {
      if (charge >= 100) return;          // nothing left to charge
      blaster(true, false, 80);
    } else if (e.kind === 'bone') {
      /* Undertale's blue-soul bone: slides along the floor, jump it. */
      var left = (e.ang = 1 - e.ang) === 1;
      bones.push({ x: left ? AX - 8 : AX + AW + 8, vx: (left ? 1 : -1) * (150 + k * 60),
                   h: 18 + ((Math.random() * 12) | 0) });
    } else if (e.kind === 'wall') {
      /* A line with one gap. A wall with no gap is a cutscene. */
      var vertical = Math.random() < 0.5;
      var gap = 0.18 + Math.random() * 0.5;
      var cells = 16, sp3 = 104 + k * 46;
      for (var q = 0; q < cells; q++) {
        var f = q / (cells - 1);
        if (Math.abs(f - gap) < 0.13) continue;
        if (vertical) {
          var fromTop = Math.random() < 0.5;
          add(AX + f * AW, fromTop ? AY - 14 : AY + AH + 14, 0, fromTop ? sp3 : -sp3, 4, COL.dim);
        } else {
          var fromLeft = Math.random() < 0.5;
          add(fromLeft ? AX - 14 : AX + AW + 14, AY + f * AH, fromLeft ? sp3 : -sp3, 0, 4, COL.dim);
        }
      }
    }
  }

  /* One hit, from anything. Dash i-frames count. Returns true on death. */
  function hitPlayer(dx, dy) {
    if (inv > 0 || F.dashI > 0) return false;
    hp--; inv = dm.IFRAMES || 1.15;
    dm.hurt(F, F.x, F.y - 12);
    /* MEDIUM: felt, but never enough to make the pattern unreadable on
       the frame you most need to read it. Leans the way the hit went. */
    if (NEU.juice) { NEU.juice.hit('medium', { dx: dx, dy: dy }); NEU.juice.burst(F.x, F.y, 10, COL.soul); }
    if (NEU.sfx && NEU.sfx.locked) NEU.sfx.locked();
    if (hp <= 0) { startDeath(); return true; }
    return false;
  }

  /* ── loop ─────────────────────────────────────────────────────────*/
  /* frame time of the last heartbeat (sfx.heart). begin() puts it back to
     -Infinity, so a new run's first beat is not held up by the last one. */
  var beatAt = -Infinity;
  function step(now) {
    if (!running) return;
    requestAnimationFrame(step);

    var dt = Math.max(0, Math.min(0.033, (now - last) / 1000)); last = now;
    if (NEU.juice && NEU.juice.frozen()) { draw(); return; }
    t += dt;
    if (phaseFor() !== phase) enterPhase(phaseFor());

    dm.move(F, keys, dt, { AX: AX, AY: AY, AW: AW, AH: AH });
    dm.tick(F, dt, null);
    var bdt = dt * dm.slow(F);           // adrenaline's first beat slows the room

    for (var i = 0; i < emitters.length; i++) {
      var e = emitters[i];
      if (t >= e.next) { e.next = t + e.every; fire(e); }
    }

    if (inv > 0) inv -= dt;
    bullets = dm.step(bullets, bdt, { AX: AX, AY: AY, AW: AW, AH: AH });
    var b = dm.hits(bullets, F.x, F.y, PLAYER_R);
    if (b && hitPlayer(b.vx, b.vy)) return;

    var floor = AY + AH, kbo = [];
    for (var n = 0; n < bones.length; n++) {
      var bo = bones[n];
      bo.x += bo.vx * bdt;
      if (bo.x < AX - 20 || bo.x > AX + AW + 20) continue;
      kbo.push(bo);
      if (Math.abs(F.x - bo.x) < 4 + PLAYER_R && F.y + PLAYER_R > floor - bo.h &&
          hitPlayer(bo.vx, 0)) return;
    }
    bones = kbo;

    var kb = [];
    for (var q = 0; q < blasters.length; q++) {
      var bl = blasters[q];
      bl.t += bdt;
      if (bl.t > BL_CHARGE + BL_FIRE) continue;
      kb.push(bl);
      if (bl.t <= BL_CHARGE) continue;
      var off = bl.horiz ? Math.abs(F.y - bl.lane) : Math.abs(F.x - bl.lane);
      if (off >= BL_HALF + PLAYER_R) continue;
      if (!bl.elec) { if (hitPlayer(0, 0)) return; continue; }
      if (bl.took) continue;
      /* On the ground is safe AND is what charges it — but only what
         you actually brought in with you. */
      var held = F.ground;
      if (held && carrying()) {
        bl.took = true;
        charge = Math.min(100, charge + 50);
        keepCharge();
        chargeFx = performance.now();
        if (NEU.juice) { NEU.juice.hit('large', { colour: '#4FC3F7' });
                         NEU.juice.burst(F.x, F.y, 26, COL.elec, 190); }
        if (NEU.quest) NEU.quest.bump('charge', charge / 50);
        if (NEU.tvState) NEU.tvState();
      } else if (held) {
        /* Safe, but nothing happens. Said out loud, because "stood on
           the ground and got no charge" otherwise reads as a bug. */
        bl.took = true;
        emptyFx = performance.now();
      } else if (inv <= 0 && F.dashI <= 0) {
        bl.took = true;
        if (hitPlayer(0, 0)) return;
      }
    }
    blasters = kb;

    /* One hit from death, the soul beats about once a second. */
    if (hp === 1 && t - beatAt >= 0.9) {
      beatAt = t;
      if (NEU.sfx && NEU.sfx.heart) NEU.sfx.heart();
    }
    if (!endless && t >= SURVIVE) { finish(true); return; }
    draw();
  }

  /* ── drawing ──────────────────────────────────────────────────────*/
  function box() {
    ctx.fillStyle = 'rgba(8,8,11,0.92)';
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(AX - BORDER, AY - BORDER, AW + BORDER * 2, AH + BORDER * 2);
    ctx.fillStyle = '#000000';
    ctx.fillRect(AX, AY, AW, AH);
  }

  /* What you brought in with you: a small handheld with its battery,
     above the box's top-left corner where it cannot read as a bullet.
     Drawn even at 0% — an empty battery is information. */
  function drawCarried() {
    ctx.font = FONT; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    var x = AX, y = AY - BORDER - 34;
    if (!carrying()) {
      if (emptyFx && performance.now() - emptyFx < 2200) {
        ctx.fillStyle = COL.dim;
        ctx.fillText('nothing on you to charge', x, y + 6);
      }
      return;
    }
    var w = 74, h = 26;
    ctx.fillStyle = '#1B1B24'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = COL.elec; ctx.fillRect(x, y, w, 2);
    ctx.fillStyle = '#0B0B10'; ctx.fillRect(x + 12, y + 5, w - 24, h - 10);
    ctx.fillStyle = '#2A2A38';
    ctx.fillRect(x + 2, y + 4, 8, h - 8);
    ctx.fillRect(x + w - 10, y + 4, 8, h - 8);
    /* Red under 50: the dock wants 100 and half is a fail state. */
    var iw = w - 28, ih = h - 14, ix = x + 14, iy = y + 7;
    ctx.fillStyle = '#22222E'; ctx.fillRect(ix, iy, iw, ih);
    ctx.fillStyle = charge >= 100 ? '#7BE38A' : (charge >= 50 ? COL.elec : COL.blood);
    ctx.fillRect(ix, iy, (iw * charge / 100) | 0, ih);
    ctx.fillStyle = COL.bone;
    ctx.fillText(charge + '%' + (charge < 100 ? '  stay on the ground in the blue one' : ''),
                 x + w + 8, y + 5, Math.max(40, AW - w - 8));
  }

  function drawBlaster(bl) {
    sheet();
    var s = AY > 150 ? 2 : 1;
    var reach = (GB_H * s / 2) | 0;
    var charging = bl.t < BL_CHARGE;
    /* slides in during the charge; held still under reduced motion */
    var slide = charging && !(NEU.settings && NEU.settings.reduced) ? ((1 - bl.t / BL_CHARGE) * 24) | 0 : 0;
    var x, y, rot;
    if (bl.horiz) {
      x = bl.from === 'l' ? AX - BORDER - reach - slide : AX + AW + BORDER + reach + slide;
      y = bl.lane | 0; rot = bl.from === 'l' ? -Math.PI / 2 : Math.PI / 2;
    } else {
      x = bl.lane | 0; rot = bl.from === 't' ? 0 : Math.PI;
      y = bl.from === 't' ? AY - BORDER - reach - slide : AY + AH + BORDER + reach + slide;
    }
    var ec = bl.elec ? COL.elec : '#FFFFFF';

    if (charging) {
      /* the telegraph line: an untelegraphed beam is unreadable */
      ctx.fillStyle = bl.elec ? 'rgba(79,195,247,0.35)' : 'rgba(237,231,222,0.25)';
      if (bl.horiz) ctx.fillRect(AX, (bl.lane - 1) | 0, AW, 2);
      else          ctx.fillRect((bl.lane - 1) | 0, AY, 2, AH);
    } else {
      var f = 1 - (bl.t - BL_CHARGE) / BL_FIRE;      // beam narrows as it dies
      var hh = (BL_HALF * f) | 0, core = Math.max(2, (hh / 1.5) | 0);
      ctx.fillStyle = ec;
      if (bl.horiz) ctx.fillRect(Math.min(x, AX), (bl.lane - hh) | 0, Math.max(x, AX + AW) - Math.min(x, AX), hh * 2);
      else          ctx.fillRect((bl.lane - hh) | 0, Math.min(y, AY), hh * 2, Math.max(y, AY + AH) - Math.min(y, AY));
      ctx.fillStyle = bl.elec ? '#CFF3FF' : '#FFFFFF';
      if (bl.horiz) ctx.fillRect(AX, (bl.lane - core / 2) | 0, AW, core);
      else          ctx.fillRect((bl.lane - core / 2) | 0, AY, core, AH);
    }

    var img = bl.elec ? gbBlue : gb;
    if (img && (img.width || img.naturalWidth)) {
      var ft = bl.t - BL_CHARGE;
      var fr = charging ? 0 : ft < 0.12 ? 1 + ((ft / 0.04) | 0) : 4 + (((ft / 0.06) | 0) % 2);
      ctx.save();
      ctx.translate(x, y); ctx.rotate(rot);
      ctx.drawImage(img, fr * GB_W, 0, GB_W, GB_H, (-GB_W * s / 2) | 0, -reach, GB_W * s, GB_H * s);
      ctx.restore();
    }
    if (bl.elec) dm.soul.stamp(ctx, BOLT, x, y, 3, '#FFF06A');
  }

  function draw() {
    var w = innerWidth, h = innerHeight;
    var shook = NEU.juice ? NEU.juice.begin(ctx, w, h) : false;
    box();

    var floor = AY + AH;
    ctx.save();                          // bones and bullets stay inside the box
    ctx.beginPath(); ctx.rect(AX, AY, AW, AH); ctx.clip();
    ctx.fillStyle = '#FFFFFF';
    for (var n = 0; n < bones.length; n++) {
      var bo = bones[n], bx = bo.x | 0;
      ctx.fillRect(bx - 3, floor - bo.h, 6, bo.h);
      ctx.fillRect(bx - 5, floor - bo.h, 10, 4);
    }

    /* bullets — squares on integer coords over a soft glow */
    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i], s = (b.r * 2) | 0;
      dm.glow(ctx, b.x, b.y, b.r * 3, b.c, 0.35);
      ctx.fillStyle = b.c;
      ctx.fillRect((b.x - b.r) | 0, (b.y - b.r) | 0, s, s);
    }
    ctx.restore();

    for (var q = 0; q < blasters.length; q++) drawBlaster(blasters[q]);

    dm.drawFX(ctx, F, inv);

    /* the phase's line, Undertale-style, inside the box */
    if (phase && t - phaseAt < TELE + 0.6) {
      ctx.font = FONT; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(PHASES[phase - 1].line, AX + 16, AY + 16, AW - 32);
    }

    if (NEU.juice) { NEU.juice.drawParts(ctx, 1 / 60);
                     NEU.juice.end(ctx, shook);
                     NEU.juice.overlay(ctx, w, h); }

    /* The clock is the boss: its bar is the time left. Endless has no
       finish, so the bar drains with the difficulty and the name is
       the clock counting up. */
    dm.hud(ctx, F, { w: w, h: h, AY: AY, AH: AH,
                     name: endless ? t.toFixed(1) + 's, endless' : 'twenty seconds',
                     hp: endless ? 1 - ramp() / 2.4 : SURVIVE - t,
                     max: endless ? 1 : SURVIVE,
                     ticks: endless ? null : [1 - 7 / SURVIVE, 1 - 13 / SURVIVE],
                     php: hp, pmax: 3, phase: phase, rage: 0, rageOn: false });
    drawCarried();

    /* the charge cutscene: centre screen, unmissable, ~1.6s */
    if (chargeFx && performance.now() - chargeFx < 1600) {
      var e2 = (performance.now() - chargeFx) / 1600;
      var bw2 = 210, bh2 = 96;
      var bx2 = ((w - bw2) / 2) | 0, by2 = ((h - bh2) / 2) | 0;
      ctx.globalAlpha = e2 > 0.8 ? (1 - e2) / 0.2 : 1;
      ctx.fillStyle = COL.void_;  ctx.fillRect(bx2 - 10, by2 - 10, bw2 + 20, bh2 + 46);
      ctx.fillStyle = COL.elec;
      ctx.fillRect(bx2 - 10, by2 - 10, bw2 + 20, 3);
      ctx.fillRect(bx2 - 10, by2 + bh2 + 33, bw2 + 20, 3);
      ctx.fillStyle = '#22222E'; ctx.fillRect(bx2, by2, bw2, bh2);
      ctx.fillStyle = COL.elec;
      ctx.fillRect(bx2 + 6, by2 + 6, ((bw2 - 12) * (charge / 100) * Math.min(1, e2 * 3)) | 0, bh2 - 12);
      ctx.fillStyle = COL.bone;
      ctx.font = FONT; ctx.textBaseline = 'top';
      ctx.textAlign = 'center';
      ctx.fillText('CHARGING  ' + charge + '%', w / 2, by2 + bh2 + 12);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
  }

  /* ── start / finish ───────────────────────────────────────────────*/
  function begin() {
    dying = 0;                           /* a pending death animation is cancelled by restarting */
    t = 0; hp = 3; inv = 0; won = false; cheat = '';
    beatAt = -Infinity;
    F = dm.fight(0, 0);
    layout();
    F.x = AX + AW / 2; F.y = AY + AH - 60;
    bullets = []; blasters = []; bones = [];
    enterPhase(1);
    keys = {};
    sheet();
    running = true; last = performance.now();
    if (msg) msg.hidden = true;
    draw();
    requestAnimationFrame(step);
  }

  /* ── death ────────────────────────────────────────────────────────
     Undertale holds the cracked soul for a beat before it goes. */
  function startDeath() {
    running = false;                 // stops the main loop's next frame
    announce('ouch. the soul broke.');
    dying = performance.now();
    dm.resetDeath();
    if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
    requestAnimationFrame(deathStep);
  }

  function deathStep(now) {
    /* A stale frame from a run the player already left must never reach
       finish() — it would kill the fresh run behind it. */
    if (!dying || wrap.hidden) return;
    var ms = now - dying;
    box();
    if (!dm.death(ctx, F.x, F.y, ms, F.mode === 'blue' ? '#3C6BFF' : COL.soul)) { dying = 0; finish(false, true); return; }
    requestAnimationFrame(deathStep);
  }

  function finish(good, quiet) {
    running = false; won = good;
    if (!quiet) draw();

    if (endless) {
      /* No win out here: the number is how long you lasted. */
      var secs = Math.round(t * 10) / 10;
      var prev = NEU.save ? NEU.save.best('twenty') : 0;
      var pb = secs > prev;
      if (NEU.save) NEU.save.best('twenty', secs);
      if (msg) {
        msg.hidden = false;
        msg.innerHTML = '<b>' + secs.toFixed(1) + 's</b><br>' +
          (pb ? 'a new best.' : 'best ' + prev.toFixed(1) + 's') +
          '<br><small>enter to go again &middot; esc to leave</small>';
      }
      announce(secs.toFixed(1) + ' seconds. ' +
               (pb ? 'a new best.' : 'best ' + prev.toFixed(1) + ' seconds.'));
      return;
    }

    if (msg) {
      msg.hidden = false;
      msg.innerHTML = good
        ? '<b>you made it.</b><br>twenty seconds. take the dog food?<br><small>esc to leave</small>'
        : '<b>ouch.</b><br>enter to try again &middot; esc to leave';
    }
    if (good) {
      announce('you made it. twenty seconds. take the dog food?');
      if (NEU.quest) NEU.quest.mark('survive');
      if (NEU.grantDogFood) NEU.grantDogFood();
    }
  }

  /* ── input ────────────────────────────────────────────────────────*/
  addEventListener('keydown', function (e) {
    if (wrap.hidden || NEU.activeMinigame !== 'bullet') return;
    if (e.key === 'Escape') {
      if (NEU.engine && NEU.engine.confirmExit) {
        NEU.engine.confirmExit('Bullet Hell', close);
      } else { close(); }
      return;
    }
    if (!running && (e.key === 'Enter' || e.key === 'z' || e.key === 'Z')) {
      /* This fights SC's death screen for the Enter key: her handler
         owns the key while her fight is up, and the room's restart
         must not hear the retry meant for her. */
      if (NEU.activeMinigame !== 'bullet') return;
      e.preventDefault(); e.stopPropagation();
      begin(); return;
    }

    if (running && dm.key(F, e)) { e.preventDefault(); return; }
    var n = dm.keyName(e);
    if (n) { keys[n] = true; e.preventDefault(); }

    /* the code. buffered rather than matched per-key so it survives
       being typed while you are also dodging with the other hand. */
    if (running && /^[0-9]$/.test(e.key)) {
      cheat = (cheat + e.key).slice(-5);
      if (cheat === '69420') { t = SURVIVE; }
    }
  });
  addEventListener('keyup', function (e) {
    if (wrap.hidden) return;
    var n = dm.keyName(e);
    if (n) keys[n] = false;
  });

  /* ── endless ──────────────────────────────────────────────────────
     Launched from the console's library it has no cap: the phases loop,
     the ramp keeps climbing past 1.0, there is no win state, and the
     score is how long you lasted. Same module, one flag. */
  var endless = false;
  function open(opts) {
    if (running) return;                 /* already mid-run — never stack a second loop */
    endless = !!(opts && opts.endless);
    NEU.activeMinigame = 'bullet';
    wrap.hidden = false;
    document.body.classList.add('is-playing');
    if (NEU.quest) NEU.quest.lock(true);
    begin();
    announce('HP 3/3');
  }
  function close() {
    running = false;
    wrap.hidden = true;
    document.body.classList.remove('is-playing');
    if (NEU.quest) NEU.quest.lock(false);
    /* You came in here to charge the console; tell the dock on the way out. */
    if (NEU.tvState) NEU.tvState();
    NEU.activeMinigame = null;
  }

  var startBtn = document.getElementById('bhStart');
  if (startBtn) startBtn.addEventListener('click', open);
  /* The SC fight shares this button and this wrapper (#bh), so the
     handler must route by whichever game is actually up — and it must
     confirm like ESC does instead of vanishing without a word. */
  var quitBtn = document.getElementById('bhQuit');
  if (quitBtn) quitBtn.addEventListener('click', function () {
    if (NEU.activeMinigame !== 'bullet') return;
    if (NEU.engine && NEU.engine.confirmExit) NEU.engine.confirmExit('Bullet Hell', close);
    else close();
  });

  NEU.bullet = { open: open, close: close, get endless() { return endless; }, get running() { return running; },
                 get won() { return won; }, get phase() { return phase; }, get soul() { return F; },
                 set t(v) { t = +v || 0; } };   /* dev/screenshots: jump the clock */
})();
