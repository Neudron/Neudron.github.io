/* bullet.js — the room behind the door.
   ───────────────────────────────────────────────────────────────────
   A thirty-second encounter, Undertale's box with Calamity's feel: the
   thing at the far end is the clock, and its boss bar is the twenty
   seconds draining. Three short phases, each announced in the box
   before it fires:

     1  the voice      rings and aimed shots, red soul
     2  blue           your soul turns BLUE (gravity): bones along the
                       floor to jump, blasters from above to step out
                       of, and the electric one — stay on the ground in
                       its beam and it charges what you carry
     3  the last six   a spiral, walls with one gap, blasters, aimed

   Movement, dash (X), the HUD and the
   screen-reader line all come from danmaku.js, shared with the bosses.
   Bullets spawn OUTSIDE the box and are culled well beyond it, so
   nothing ever pops into existence on top of you. Shift focuses:
   slower, and the true hitbox shows.                                  */

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
  var SURVIVE   = 30;          // seconds
  var VLEN      = 20;          // Act III's seeded plan keeps its twenty seconds
  var PLAYER_R  = dm.soul.R;   // the TRUE hitbox
  var MAX_B     = 700;
  var BL_HALF = 24; // was 17, matches visual beam width at game scale
  /* Charge cell, per stage (0 while charge < 50, 1 after): a hit in the
     core adds gain (+perfect in the centre third), a miss in the beam
     fizzes, and the cell drains every second. Stage 1 is tighter. */
  var CELL = { gain: [0.55, 0.4], core: [13, 8], drain: [0.04, 0.08], perfect: 0.12, fizz: 0.2 };
  var BORDER = 4;              // Undertale's white box edge
  var TELE = 1.0;              // a phase's line shows this long before it fires

  /* PAL is the room's palette, in one place. A visual pass restyles it;
     every draw call below reads from it. Values are the shipped look. */
  var PAL = { bg: 'rgba(8,8,11,0.92)', box: '#FFFFFF', inner: '#000000',
              bone: '#FFFFFF', blaster: '#FFFFFF', elecCore: '#CFF3FF',
              ui: '#EDE7DE', lilac: '#B892FF', blood: '#C2405F', dim: '#8A8598',
              soul: '#E23B55', void_: '#08080B', elec: '#4FC3F7',
              panel: '#1B1B24', slot: '#22222E', full: '#7BE38A', meter: '#5CF08C' };
  /* Act III's variant: a warm amber console screen, so the room reads as
     a different visit and the strong blue blaster is the one cold thing
     in it. Every bullet colour is >= 4.5:1 on `inner` (fixes68). */
  var PAL_II = PAL, PAL_III = {
              bg: 'rgba(18,9,4,0.94)', box: '#FFB547', inner: '#0E0805',
              bone: '#FFE2B0', blaster: '#FFE2B0', elecCore: '#D6E8FF',
              ui: '#F6E6C8', lilac: '#FF9F43', blood: '#FF5D73', dim: '#D9A066',
              soul: '#E23B55', void_: '#0E0805', elec: '#2E8BFF',
              panel: '#24170F', slot: '#2E1F14', full: '#7BE38A', meter: '#FFC447' };
  var FONT = '16px "Determination Mono","Pixelify Sans",monospace';

  /* Each phase: where it starts, the soul it wants, its line, and its
     emitters [kind, every]. Emitters drift out of sync on purpose —
     synchronised ones make corridors you can stand in forever. */
  var PHASES = [
    { at: 0,  mode: 'red',  line: '* thirty seconds. that\'s the whole ask.',
      em: [['ring', 1.30], ['aimed', 0.95]] },
    { at: 9,  mode: 'blue', line: '* your SOUL is blue now. stay on the ground.',
      em: [['bone', 1.25], ['blaster', 2.2], ['elec', 2.6]] },
    { at: 19, mode: 'red',  line: '* it is still aiming.',
      em: [['spiral', 0.075], ['wall', 2.6], ['blaster', 3.1], ['aimed', 1.4]] },
    /* the 4th: the 3rd's spiral, a touch faster (third element = spin step) */
    { at: 25, mode: 'red',  line: '* the last few seconds. stay in the open.',
      em: [['spiral', 0.06, 0.44], ['wall', 1.8], ['aimed', 0.9]] }
  ];

  /* Undertale's blaster: 6 frames of 43x57, mouth down. 0 = charging,
     1-3 = opening, 4/5 alternate while it fires. The electric one is a
     blue-tinted copy made once the sheet loads, and keeps the bolt on
     its brow so it reads without colour too. */
  var GB_W = 43, GB_H = 57;
  var gb = null, gbBlue = null, gbTint = '';
  function sheet() {
    if (!gb) { gb = new Image(); gb.src = 'img/act4/undertale/gasterblaster.png'; }
    if (gbTint !== PAL.elec && gb.complete && gb.naturalWidth) {
      gbTint = PAL.elec;
      gbBlue = document.createElement('canvas');
      gbBlue.width = gb.naturalWidth; gbBlue.height = gb.naturalHeight;
      var g = gbBlue.getContext && gbBlue.getContext('2d');
      if (g) {
        g.drawImage(gb, 0, 0);
        g.globalCompositeOperation = 'source-atop';
        g.globalAlpha = 0.6; g.fillStyle = PAL.elec;
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
  var AIM_TELE = 0.45, aims = [];
  /* The beam's ghost: the last TELE_LEAD s of the charge show the real
     beam's width as a soft fill, faded in, held, faded out right before
     it fires. Low alpha and one per blaster, so it never reads as a flash. */
  var TELE_LEAD = 0.45, TELE_FADE = 0.1, TELE_PEAK = 0.3;
  function teleAlpha(bt) {
    var u = bt - (BL_CHARGE - TELE_LEAD);
    if (u < 0 || bt >= BL_CHARGE) return 0;
    return TELE_PEAK * Math.min(1, u / TELE_FADE, (BL_CHARGE - bt) / TELE_FADE);
  }

  /* ── the electric blaster ─────────────────────────────────────────
     Its rule is INVERTED and that is the whole point: in the blue
     section it hurts you in the air and charges the console if you are
     on the ground. Charge survives between runs. */
  /* Read back from the save, so a full console is still full after a
     reload. A missing flag is undefined, and `| 0` makes that 0. */
  var charge = (NEU.save && NEU.save.flag('console_charge')) | 0, chargeFx = 0, emptyFx = 0;
  var cell = 0, cellLostAt = 0;
  function stage() { return charge >= 50 ? 1 : 0; }
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
  /* Pure: what one beam hit at `off` from its centre adds to the cell. */
  function coreGain(off, st) {
    var c = CELL.core[st];
    if (off >= c) return -CELL.fizz;
    return CELL.gain[st] + (off < c / 3 ? CELL.perfect : 0);
  }
  /* Pure: x of each interference spark for a lane. Stage 0 flanks the core
     at 22 px, stage 1 adds an outer pair at 29 px. None is inside the core. */
  function sparkCols(lane, st) {
    var c = CELL.core[st], d = st ? [9, 21] : [9], out = [];
    for (var i = 0; i < d.length; i++) out.push(lane - c - d[i], lane + c + d[i]);
    return out;
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
  var outroF = 0;                          // frames left in the win's shatter

  var running = false, won = false;
  /* Act III variant: a seeded plan of blocks, and the graze meter. */
  var variant = false, plan = null, qi = 0, attempt = 0;
  var meter = 0, lastGz = -9;
  var t = 0, hp = 3, inv = 0, last = 0;
  var F = dm.fight(0, 0), keys = {};
  var bullets = [], emitters = [], phase = 0, phaseAt = 0;
  var AW = 0, AH = 0, AX = 0, AY = 0;     // box rect, canvas space
  var BAX = 0, BAW = 0;                    // the box's own rect, before the squeeze
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
    BAX = AX; BAW = AW; squeezeBox();
    F.x =Math.min(Math.max(F.x, AX + 12), AX + AW - 12);
    F.y = Math.min(Math.max(F.y, AY + 12), AY + AH - 12);
  }
  addEventListener('resize', function () { if (running) layout(); });

  /* Phase 4: the walls close in over 1.5 s, 13% a side, then hold. */
  function squeezeBox() {
    if (!running) return;                  // open() lays out before its plan exists
    var s =(phase && phase === table().length) ? Math.min(1, (t - phaseAt) / 1.5) : 0;
    s = s * s * (3 - 2 * s);
    var ins = (BAW * 0.13 * s) | 0; AX = BAX + ins; AW = BAW - ins * 2;
  }

  function add(x, y, vx, vy, r, c) { spot(x, y); dm.shot(bullets, x, y, vx, vy, r, c, 0, MAX_B); }

  /* Spawn markers: the first shot of each emitter leaves a 2px ring on the
     box's rim for 0.35 s, at its spawn point projected onto the rim. */
  var curE = null, marks = [], flashAt = -9, grazeFx = -9;
  function spot(x, y) {
    if (!curE || curE.shown) return;
    curE.shown = true;
    var cx = Math.min(Math.max(x, AX), AX + AW), cy = Math.min(Math.max(y, AY), AY + AH);
    var dl = cx - AX, dr = AX + AW - cx, dt = cy - AY, db = AY + AH - cy;
    var m = Math.min(dl, dr, dt, db), rx = cx, ry = cy;
    if (m === dl) rx = AX - BORDER / 2;
    else if (m === dr) rx = AX + AW + BORDER / 2;
    else if (m === dt) ry = AY - BORDER / 2;
    else ry = AY + AH + BORDER / 2;
    marks.push({ x: rx, y: ry, t0: t });
  }

  /* Difficulty: 0 at the start, 1 at the end. Endless keeps climbing —
     the curve is the content once there is no finish line. */
  /* The run's length: Act III's plan is twenty seconds, the room is thirty. */
  function span() { return variant ? VLEN : SURVIVE; }
  function ramp() {
    return endless ? Math.min(2.4, t / SURVIVE) : Math.min(1, t / span());
  }

  /* Endless loops the three phases every twenty seconds. */
  function phaseFor() {
    var lt = endless ? t % SURVIVE : t, p = 0;
    var T = table();
    for (var i = 0; i < T.length; i++) if (lt >= T[i].at) p = i;
    return p + 1;
  }
  function table() { return variant ? plan.phases : PHASES; }
  function enterPhase(n) {
    var P = table()[n - 1];
    phase = n; phaseAt = t;
    dm.soulMode(F, P.mode);
    emitters = [];
    for (var i = 0; i < (P.em || []).length; i++)
      emitters.push({ kind: P.em[i][0], every: P.em[i][1], next: t + TELE + i * 0.3, ang: 0,
                      spin: P.em[i][2], shown: false });
    /* a phase change: the box flashes white and the soul is hit "small" */
    if (n > 1) { flashAt = t; if (NEU.juice) NEU.juice.hit('small'); }
  }

  /* ── Act III variant: the plan ────────────────────────────────────
     A seeded timeline of blocks. Each block owns its own stretch of
     time and the next starts after it ends, so a blue blaster's beam
     can never land inside a bone run. The seed is the attempt count:
     each retry deals the middle blocks in a new order.
     Escalation: a red warm-up, a blue middle (pair, bone run, a plain
     blaster), a faster blue last-but-one (triple, pair), and a short
     red final pattern to the twenty-second mark. */
  var VGAP = 0.3, GRAZE_R = 7, GRAZE_GAIN = 4, GRAZE_GAP = 0.4;
  var PULSE_R = 72, pulseAt = -9;
  var VBLOCK = {
    ring:    { dur: 2.4, at: [0.5, 1.8], kind: 'ring' },
    aimed:   { dur: 2.4, at: [0.5, 1.1, 1.7, 2.3], kind: 'aimed' },
    pair:    { dur: 2.4, at: [0.5, 1.1], kind: 'elec' },
    bone:    { dur: 4.5, at: [0.5, 1.2, 1.9], kind: 'bone' },
    blaster: { dur: 2.0, at: [0.6], kind: 'blaster' },
    triple:  { dur: 3.0, at: [0.5, 1.1, 1.7], kind: 'elec' }
  };
  function rng(seed) {
    var s = (seed * 7919 + 13) % 233280;
    return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }
  function shuffle(list, r) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = (r() * (i + 1)) | 0, x = a[i];
      a[i] = a[j]; a[j] = x;
    }
    return a;
  }
  function buildPlan(seed) {
    var r = rng(seed), at = 0, events = [], phases = [];
    var LINES = ['* twenty seconds. it will not be quiet.',
                 '* your SOUL is blue. the electric one wants a charge.',
                 '* faster. the bones do not wait for you.',
                 '* the last few seconds. stay in the open.'];
    function blocks(names) {
      for (var i = 0; i < names.length; i++) {
        var B = VBLOCK[names[i]], o = { kind: B.kind, ang: 0 };
        for (var j = 0; j < B.at.length; j++)
          events.push({ t: at + B.at[j], e: o, blk: names[i], start: at, end: at + B.dur });
        at += B.dur + VGAP;
      }
    }
    phases.push({ at: 0, mode: 'red', line: LINES[0], em: [] });
    blocks(shuffle(['ring', 'aimed'], r).slice(0, 1));
    phases.push({ at: at, mode: 'blue', line: LINES[1], em: [] });
    blocks(shuffle(['pair', 'bone', 'blaster'], r));
    phases.push({ at: at, mode: 'blue', line: LINES[2], em: [] });
    blocks(shuffle(['triple', 'pair'], r));
    phases.push({ at: at, mode: 'red', line: LINES[3], em: [] });
    var fin = { kind: 'spiral', ang: 0 }, wall = { kind: 'wall', ang: 0 };
    events.push({ t: at + 0.6, e: wall, blk: 'final', start: at, end: VLEN });
    for (var s = at + 0.2; s < VLEN - 0.2; s += 0.4)
      events.push({ t: s, e: fin, blk: 'final', start: at, end: VLEN });
    return { phases: phases, events: events };
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
    spot(horiz ? (bl.from === 'l' ? AX : AX + AW) : bl.lane, horiz ? bl.lane : (bl.from === 't' ? AY : AY + AH));
    /* Interference sparks flank the core while you charge: only the core
       is safe. Stage 1 sparks land late, so you must already be settled. */
    if (elec && carrying() && charge < 100) {
      var st = stage(), cols = sparkCols(bl.lane, st), vy = AH / (BL_CHARGE * (st ? 0.75 : 1));
      for (var i = 0; i < cols.length; i++)
        if (cols[i] > AX + 4 && cols[i] < AX + AW - 4) add(cols[i], AY + 4, 0, vy, 3, '#FFF06A');
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
            Math.cos(a) * sp, Math.sin(a) * sp, 4, PAL.lilac);
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
      var kk = Math.min(k, 1.6);
      var cnt = 3 + Math.round(kk * 4), spd = 150 + kk * 130;
      spot(sx, sy);
      aims.push({ sx: sx, sy: sy, base: base, cnt: cnt, spd: spd, t0: t });
    } else if (e.kind === 'spiral') {
      e.ang += e.spin || 0.42;
      var arms = 2 + Math.round(k * 2), s2 = 96 + k * 44;
      for (var m = 0; m < arms; m++) {
        var a2 = e.ang + m * (Math.PI * 2 / arms);
        add(cx, cy, Math.cos(a2) * s2, Math.sin(a2) * s2, 3, PAL.blood);
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
      spot(left ? AX - 8 : AX + AW + 8, AY + AH);
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
          add(AX + f * AW, fromTop ? AY - 14 : AY + AH + 14, 0, fromTop ? sp3 : -sp3, 4, PAL.dim);
        } else {
          var fromLeft = Math.random() < 0.5;
          add(fromLeft ? AX - 14 : AX + AW + 14, AY + f * AH, fromLeft ? sp3 : -sp3, 0, 4, PAL.dim);
        }
      }
    }
  }

  /* One hit, from anything. Dash i-frames count. Returns true on death. */
  function hitPlayer(dx, dy) {
    if (inv > 0 || F.dashI > 0) return false;
    hp--; inv = dm.IFRAMES || 1.15;
    if (cell > 0) { cell = 0; cellLostAt = performance.now(); if (NEU.juice) NEU.juice.burst(F.x, F.y, 12, PAL.elec, 160); }
    dm.hurt(F, F.x, F.y - 12);
    /* MEDIUM: felt, but never enough to make the pattern unreadable on
       the frame you most need to read it. Leans the way the hit went. */
    if (NEU.juice) { NEU.juice.hit('medium', { dx: dx, dy: dy }); NEU.juice.burst(F.x, F.y, 10, PAL.soul); }
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
    squeezeBox();

    dm.move(F, keys, dt, { AX: AX, AY: AY, AW: AW, AH: AH });
    dm.tick(F, dt, null);
    var bdt = dt * dm.slow(F);           // adrenaline's first beat slows the room

    if (variant) {
      while (qi < plan.events.length && t >= plan.events[qi].t) fire(plan.events[qi++].e);
    }
    for (var i = 0; i < emitters.length; i++) {
      var e = emitters[i];
      if (t >= e.next) { e.next = t + e.every; curE = e; fire(e); curE = null; }
    }

    var ka = [];
    for (var ai = 0; ai < aims.length; ai++) {
      var a = aims[ai];
      if (t - a.t0 < AIM_TELE) { ka.push(a); continue; }
      for (var j = 0; j < a.cnt; j++) {
        var o = (j - (a.cnt - 1) / 2) * 0.17;
        add(a.sx, a.sy, Math.cos(a.base + o) * a.spd, Math.sin(a.base + o) * a.spd, 4, PAL.ui);
      }
    }
    aims = ka;

    if (inv > 0) inv -= dt;
    bullets = dm.step(bullets, bdt, { AX: AX, AY: AY, AW: AW, AH: AH });
    var b = dm.hits(bullets, F.x, F.y, PLAYER_R);
    if (b && hitPlayer(b.vx, b.vy)) return;
    /* graze: a bullet that passes close without touching fills the meter */
    for (var g = 0; g < bullets.length; g++) {
      var gbl = bullets[g];
      if (gbl.gz) continue;
      var gd = Math.sqrt((gbl.x - F.x) * (gbl.x - F.x) + (gbl.y - F.y) * (gbl.y - F.y)) - gbl.r;
      if (gd >= PLAYER_R && gd < PLAYER_R + GRAZE_R) { gbl.gz = true; grazed(); }
    }

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
        var gn = coreGain(off, stage());
        cell = Math.max(0, cell + gn);
        if (NEU.juice && gn > 0) {
          var perfect = gn > CELL.gain[stage()];
          NEU.juice.hit('small', { colour: PAL.elec });
          NEU.juice.burst(F.x, F.y, perfect ? 10 : 6, perfect ? '#FFF06A' : PAL.elecCore, 120);
        }
        if (cell >= 1) {
          cell = 0;
          charge = Math.min(100, charge + 50);
          keepCharge();
          chargeFx = performance.now();
          if (NEU.juice) {
            if (charge >= 100) {
              NEU.juice.hit('huge', { colour: PAL.full }); NEU.juice.burst(F.x, F.y, 44, PAL.full, 240);
              for (var fy = 0.25; fy < 1; fy += 0.25) NEU.juice.burst(bl.lane, AY + AH * fy, 8, PAL.elecCore, 120);
            } else { NEU.juice.hit('large', { colour: '#4FC3F7' }); NEU.juice.burst(F.x, F.y, 26, PAL.elec, 190); }
          }
          if (NEU.quest) NEU.quest.bump('charge', charge / 50);
          if (NEU.tvState) NEU.tvState();
        }
        if (gn < 0 && NEU.juice) NEU.juice.hit('tick');
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
    if (cell > 0) cell = Math.max(0, cell - CELL.drain[stage()] * bdt);

    /* One hit from death, the soul beats about once a second. */
    if (hp === 1 && t - beatAt >= 0.9) {
      beatAt = t;
      if (NEU.sfx && NEU.sfx.heart) NEU.sfx.heart();
    }
    if (!endless && t >= span()) { finish(true); return; }
    draw();
  }

  /* ── drawing ──────────────────────────────────────────────────────*/
  function box() {
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    ctx.fillStyle = PAL.box;
    ctx.fillRect(AX - BORDER, AY - BORDER, AW + BORDER * 2, AH + BORDER * 2);
    ctx.fillStyle = PAL.inner;
    ctx.fillRect(AX, AY, AW, AH);
  }

  /* What you brought in with you: a small handheld with its battery,
     above the box's top-left corner where it cannot read as a bullet.
     Drawn even at 0% — an empty battery is information. */
  function drawCarried() {
    ctx.font = FONT; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    var x = BAX, y = AY - BORDER - 34;
    if (!carrying()) {
      if (emptyFx && performance.now() - emptyFx < 2200) {
        ctx.fillStyle = PAL.dim;
        ctx.fillText('nothing on you to charge', x, y + 6);
      }
      return;
    }
    var w = 74, h = 26;
    ctx.fillStyle = '#1B1B24'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = PAL.elec; ctx.fillRect(x, y, w, 2);
    ctx.fillStyle = '#0B0B10'; ctx.fillRect(x + 12, y + 5, w - 24, h - 10);
    ctx.fillStyle = '#2A2A38';
    ctx.fillRect(x + 2, y + 4, 8, h - 8);
    ctx.fillRect(x + w - 10, y + 4, 8, h - 8);
    /* Red under 50: the dock wants 100 and half is a fail state. */
    var iw = w - 28, ih = h - 14, ix = x + 14, iy = y + 7;
    ctx.fillStyle = '#22222E'; ctx.fillRect(ix, iy, iw, ih);
    /* Two cells, one per stage. The current one fills by `cell` and pulses
       at 2 Hz; a lost cell jitters and outlines red for 400 ms. */
    var half = (iw / 2) | 0, now = performance.now(), jit = 0;
    if (cellLostAt && now - cellLostAt < 400 && !reducedFx())
      jit = Math.round(Math.sin((now - cellLostAt) * 0.09) * 3);
    for (var i = 0; i < 2; i++) {
      var cur = i === stage() && charge < 100, sx = ix + i * half + (cur ? jit : 0);
      if (charge >= 50 * (i + 1)) {
        ctx.fillStyle = charge >= 100 ? PAL.full : PAL.elec;
        ctx.fillRect(sx, iy, half - 1, ih);
      } else if (cur) {
        ctx.fillStyle = cell < 0.34 ? PAL.blood : cell < 0.67 ? PAL.lilac : PAL.elecCore;
        ctx.fillRect(sx, iy, ((half - 1) * cell) | 0, ih);
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * Math.PI * 4);
        ctx.fillRect(sx, iy, half - 1, 2);
        ctx.globalAlpha = 1;
      }
      if (cur && jit) { ctx.strokeStyle = PAL.blood; ctx.strokeRect(sx + 0.5, iy + 0.5, half - 2, ih - 1); }
      if (!i) { ctx.fillStyle = PAL.panel; ctx.fillRect(ix + half - 1, iy, 1, ih); }
    }
    ctx.fillStyle = PAL.ui;
    ctx.fillText(charge + '%' + (charge < 100 ? '  stay on the ground in the blue one' : ''),
                 x + w + 8, y + 5, Math.max(40, AW - w - 8));
  }

  /* Graze feedback. The meter is the same in Act II and III; the outline
     flash is one short pulse per GRAZE_GAP (about 2.5 Hz at most) and is
     skipped under reduced motion or the no-flash setting. */
  function reducedFx() {
    return !!((NEU.motion && NEU.motion.reduced && NEU.motion.reduced()) ||
              (NEU.juice && NEU.juice.noFlash));
  }
  function grazed() {
    meter = Math.min(100, meter + GRAZE_GAIN);
    if (meter >= 100) pulse();
    grazeFx = t;
    if (NEU.juice) NEU.juice.burst(F.x, F.y, 4, '#FFFFFF', 90);
    if (t - lastGz >= GRAZE_GAP) {
      lastGz = t;
      if (!reducedFx()) F.grazeFlashT = 0.12;
    }
  }
  /* A full meter clears the bullets around the soul, heals one HP. */
  function pulse() {
    meter = 0; pulseAt = t;
    var kept = [], gone = 0;
    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i];
      if (Math.sqrt((b.x - F.x) * (b.x - F.x) + (b.y - F.y) * (b.y - F.y)) >= PULSE_R) { kept.push(b); continue; }
      if (gone < 12 && NEU.juice) NEU.juice.burst(b.x, b.y, 3, b.c, 70);
      gone++;
    }
    bullets = kept;
    if (hp < 3) hp++;
    if (NEU.juice) NEU.juice.hit('small', { colour: PAL.meter });
  }
  function drawGraze() {
    var x = BAX + BAW - 120, y = AY - BORDER - 34;
    ctx.font = FONT; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    ctx.fillStyle = PAL.ui;
    ctx.fillText('graze', x - 64, y + 4);
    ctx.fillStyle = PAL.slot; ctx.fillRect(x, y + 7, 100, 12);
    ctx.fillStyle = meter >= 100 || (meter >= 80 && !reducedFx() && ((t / 0.25) | 0) % 2) ? PAL.full : PAL.meter;
    ctx.fillRect(x, y + 7, meter, 12);
    if (t - grazeFx < 0.3) { ctx.fillStyle = '#FFFFFF'; ctx.fillText('+1', x + 104, y + 4); }
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
    var ec = bl.elec ? PAL.elec : PAL.blaster;

    if (charging) {
      /* the telegraph line: an untelegraphed beam is unreadable */
      ctx.fillStyle = ec;
      ctx.globalAlpha = bl.elec ? 0.45 : 0.3;
      if (bl.horiz) ctx.fillRect(AX, (bl.lane - 1) | 0, AW, 2);
      else          ctx.fillRect((bl.lane - 1) | 0, AY, 2, AH);
      var ga = teleAlpha(bl.t);
      if (ga > 0) {
        ctx.globalAlpha = ga;                       // the beam's own footprint
        if (bl.horiz) ctx.fillRect(AX, (bl.lane - BL_HALF) | 0, AW, BL_HALF * 2);
        else          ctx.fillRect((bl.lane - BL_HALF) | 0, AY, BL_HALF * 2, AH);
        ctx.globalAlpha = Math.min(1, ga * 2.5);    // and its edges, crisper
        if (bl.horiz) { ctx.fillRect(AX, (bl.lane - BL_HALF) | 0, AW, 2); ctx.fillRect(AX, (bl.lane + BL_HALF - 2) | 0, AW, 2); }
        else          { ctx.fillRect((bl.lane - BL_HALF) | 0, AY, 2, AH); ctx.fillRect((bl.lane + BL_HALF - 2) | 0, AY, 2, AH); }
      }
      ctx.globalAlpha = 1;
      /* the jaws: they close from the beam's width onto the core */
      if (bl.elec && carrying() && charge < 100 && !bl.horiz) {
        var k = bl.t / BL_CHARGE, e = 1 - Math.pow(1 - k, 3), lane = bl.lane | 0, fl = AY + AH;
        var hw = (BL_HALF + (CELL.core[stage()] - BL_HALF) * e) | 0;
        ctx.fillStyle = PAL.elecCore;
        ctx.globalAlpha = Math.min(1, 0.35 + teleAlpha(bl.t) * 2);
        ctx.fillRect(lane - hw - 2, fl - 10, 2, 10);
        ctx.fillRect(lane + hw, fl - 10, 2, 10);
        ctx.fillRect(lane - hw, fl - 2, hw * 2, 2);
        ctx.globalAlpha = 1;
      }
    } else {
      var f = 1 - (bl.t - BL_CHARGE) / BL_FIRE;      // beam narrows as it dies
      var hh = (BL_HALF * f) | 0, core = Math.max(2, (hh / 1.5) | 0);
      ctx.fillStyle = ec;
      if (bl.horiz) ctx.fillRect(Math.min(x, AX), (bl.lane - hh) | 0, Math.max(x, AX + AW) - Math.min(x, AX), hh * 2);
      else          ctx.fillRect((bl.lane - hh) | 0, Math.min(y, AY), hh * 2, Math.max(y, AY + AH) - Math.min(y, AY));
      ctx.fillStyle = bl.elec ? PAL.elecCore : PAL.blaster;
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
    if (phase && phase === table().length && t - phaseAt < 1.5) {
      /* the walls' final stop, telegraphed */
      ctx.fillStyle = PAL.box; ctx.globalAlpha = 0.35;
      ctx.fillRect(BAX + BAW * 0.13 - 1, AY, 2, AH);
      ctx.fillRect(BAX + BAW * 0.87 - 1, AY, 2, AH);
      ctx.globalAlpha = 1;
    }

    /* blasters first: their telegraph and beam must never hide a bullet */
    for (var q = 0; q < blasters.length; q++) drawBlaster(blasters[q]);

    var floor = AY + AH;
    ctx.save();                          // bones and bullets stay inside the box
    ctx.beginPath(); ctx.rect(AX, AY, AW, AH); ctx.clip();
    ctx.fillStyle = PAL.bone;
    for (var n = 0; n < bones.length; n++) {
      var bo = bones[n], bx = bo.x | 0;
      ctx.fillRect(bx - 3, floor - bo.h, 6, bo.h);
      ctx.fillRect(bx - 5, floor - bo.h, 10, 4);
    }

    /* aimed telegraph: rays from the edge point, growing, fading in and out */
    for (var ax = 0; ax < aims.length; ax++) {
      var ag = aims[ax], u = (t - ag.t0) / AIM_TELE;
      var al = Math.max(0, Math.min(u / 0.08, 1, 1 - (u - 0.27) / 0.48));
      var L = 60 + 140 * Math.min(1, u * 4);
      ctx.strokeStyle = PAL.ui; ctx.lineWidth = 2; ctx.globalAlpha = al * 0.5;
      for (var r = 0; r < ag.cnt; r++) {
        var ro = (r - (ag.cnt - 1) / 2) * 0.17, ra = ag.base + ro;
        ctx.beginPath(); ctx.moveTo(ag.sx, ag.sy);
        ctx.lineTo(ag.sx + Math.cos(ra) * L, ag.sy + Math.sin(ra) * L); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    /* bullets — squares on integer coords over a soft glow */
    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i], s = (b.r * 2) | 0;
      dm.glow(ctx, b.x, b.y, b.r * 3, b.c, 0.35);
      ctx.fillStyle = b.c;
      ctx.fillRect((b.x - b.r) | 0, (b.y - b.r) | 0, s, s);
    }
    ctx.restore();
    /* spawn markers, on the rim only; the phase flash is the box's outline */
    marks = marks.filter(function (m) { return t - m.t0 < 0.35; });
    if (marks.length) {
      ctx.save();
      ctx.beginPath(); ctx.rect(AX - BORDER, AY - BORDER, AW + BORDER * 2, AH + BORDER * 2);
      ctx.rect(AX, AY, AW, AH); ctx.clip('evenodd');
      ctx.strokeStyle = PAL.box; ctx.lineWidth = 2;
      for (var k = 0; k < marks.length; k++) {
        ctx.beginPath(); ctx.arc(marks[k].x, marks[k].y, 3, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
    if (t - flashAt < 0.12) {
      ctx.lineWidth = 4; ctx.strokeStyle = PAL.box;
      ctx.strokeRect(AX - BORDER - 2, AY - BORDER - 2, AW + BORDER * 2 + 4, AH + BORDER * 2 + 4);
    }

    dm.drawFX(ctx, F, inv);
    if (t - pulseAt < 0.3) {
      var pk = (t - pulseAt) / 0.3;
      ctx.globalAlpha = 1 - pk; ctx.lineWidth = 3; ctx.strokeStyle = PAL.meter;
      ctx.beginPath();
      ctx.arc(F.x, F.y, 12 + (PULSE_R - 12) * (1 - Math.pow(1 - pk, 3)), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    /* the charge arc: wraps the soul as the current cell fills */
    if (carrying() && cell > 0 && charge < 100) {
      ctx.save(); ctx.globalAlpha = 0.85; ctx.strokeStyle = PAL.elec; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(F.x, F.y, 9, -Math.PI / 2, -Math.PI / 2 + cell * Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    /* the phase's line, Undertale-style, inside the box */
    if (phase && t - phaseAt < TELE + 0.6) {
      ctx.font = FONT; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(table()[phase - 1].line, AX + 16, AY + 16, AW - 32);
    }

    /* the win's soul ring: it grows out from the soul and fades */
    if (won && outroF > 0 && !reducedFx()) {
      var wk = 1 - outroF / 54;
      ctx.globalAlpha = 1 - wk; ctx.lineWidth = 4; ctx.strokeStyle = PAL.full;
      ctx.beginPath();
      ctx.arc(F.x, F.y, 10 + (AW / 2) * (1 - Math.pow(1 - wk, 3)), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (NEU.juice) { NEU.juice.drawParts(ctx, 1 / 60);
                     NEU.juice.end(ctx, shook);
                     NEU.juice.overlay(ctx, w, h); }

    /* The clock is the boss: its bar is the time left. Endless has no
       finish, so the bar drains with the difficulty and the name is
       the clock counting up. */
    dm.hud(ctx, F, { w: w, h: h, AY: AY, AH: AH,
                     name: endless ? t.toFixed(1) + 's, endless' : 'thirty seconds',
                     hp: endless ? 1 - ramp() / 2.4 : span() - t,
                     max: endless ? 1 : span(),
                     ticks: endless ? null : table().slice(1).map(function (p) { return 1 - p.at / span(); }),
                     php: hp, pmax: 3, phase: phase, rage: 0, rageOn: false });
    drawCarried();
    drawGraze();

    /* the charge cutscene: centre screen, unmissable, ~1.6s */
    if (chargeFx && performance.now() - chargeFx < 1600) {
      var e2 = (performance.now() - chargeFx) / 1600;
      var bw2 = 210, bh2 = 96;
      var bx2 = ((w - bw2) / 2) | 0, by2 = ((h - bh2) / 2) | 0;
      ctx.globalAlpha = e2 > 0.8 ? (1 - e2) / 0.2 : 1;
      ctx.fillStyle = PAL.void_;  ctx.fillRect(bx2 - 10, by2 - 10, bw2 + 20, bh2 + 46);
      ctx.fillStyle = PAL.elec;
      ctx.fillRect(bx2 - 10, by2 - 10, bw2 + 20, 3);
      ctx.fillRect(bx2 - 10, by2 + bh2 + 33, bw2 + 20, 3);
      ctx.fillStyle = PAL.slot; ctx.fillRect(bx2, by2, bw2, bh2);
      ctx.fillStyle = PAL.elec;
      ctx.fillRect(bx2 + 6, by2 + 6, ((bw2 - 12) * (charge / 100) * Math.min(1, e2 * 3)) | 0, bh2 - 12);
      ctx.fillStyle = PAL.ui;
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
    outroF = 0;
    t = 0; hp = 3; inv = 0; won = false; cheat = '';
    beatAt = -Infinity;
    F = dm.fight(0, 0);
    layout();
    F.x = AX + AW / 2; F.y = AY + AH - 60;
    bullets = []; blasters = []; bones = []; aims = [];
    meter = 0; lastGz = -9; grazeFx = -9; flashAt = -9; pulseAt = -9; marks = [];
    cell = 0; cellLostAt = 0;
    plan = variant ? buildPlan(attempt++) : null; qi = 0;
    PAL = variant ? PAL_III : PAL_II;
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
    if (!dm.death(ctx, F.x, F.y, ms, F.mode === 'blue' ? '#3C6BFF' : PAL.soul)) { dying = 0; finish(false, true); return; }
    requestAnimationFrame(deathStep);
  }

  function finish(good, quiet) {
    running = false; won = good;
    if (good && !endless && NEU.juice) {
      var every = Math.ceil(bullets.length / 40), i, b;
      for (i = 0; i < bullets.length; i += every) {
        b = bullets[i];
        NEU.juice.burst(b.x, b.y, 2, b.c, 60);
      }
    }
    if (good && !endless && NEU.juice) {
      bullets = []; blasters = []; bones = []; aims = [];
      NEU.juice.hit('large', { colour: PAL.full }); NEU.juice.burst(F.x, F.y, 22, PAL.soul, 150);
      outroF = 54; requestAnimationFrame(outro);
    }
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
        ? '<b>you made it.</b><br>thirty seconds. take the dog food?<br><small>esc to leave</small>'
        : '<b>ouch.</b><br>enter to try again &middot; esc to leave';
    }
    if (good) {
      announce('you made it. thirty seconds. take the dog food?');
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
      if (cheat === '69420') { t = span(); }
    }
  });
  addEventListener('keyup', function (e) {
    if (wrap.hidden) return;
    var n = dm.keyName(e);
    if (n) keys[n] = false;
  });
  /* A key let go outside the tab never sends keyup, so a Shift released
     there would leave the soul slow. Losing focus drops every held key. */
  addEventListener('blur', function () { keys = {}; });

  /* The win's shatter: the particles and shake decay, then it stops. */
  function outro() {
    if (running || !won || wrap.hidden || outroF <= 0) return;
    outroF--; draw();
    requestAnimationFrame(outro);
  }

  /* ── endless ──────────────────────────────────────────────────────
     Launched from the console's library it has no cap: the phases loop,
     the ramp keeps climbing past 1.0, there is no win state, and the
     score is how long you lasted. Same module, one flag. */
  var endless = false;
  function open(opts) {
    if (NEU.settings && NEU.settings.warnFlash) NEU.settings.warnFlash();
    if (running) return;                 /* already mid-run — never stack a second loop */
    endless = !!(opts && opts.endless);
    /* Act III passes { variant: true }. With no option the room asks the
       quest: once the console's step is done, this is the Act III room. */
    variant = !endless && (opts && 'variant' in opts ? !!opts.variant
                                                    : !!(NEU.quest && NEU.quest.has && NEU.quest.has('console')));
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
                 get variant() { return variant; }, get plan() { return plan; }, get meter() { return meter; }, get hp() { return hp; },
                 get phases() { return PHASES; }, get bullets() { return bullets; },
                 get aims() { return aims; },
                 get box() { return { AX: AX, AW: AW, BAW: BAW }; },
                 buildPlan: buildPlan, teleAlpha: teleAlpha, chargeTime: BL_CHARGE, cellCfg: CELL, coreGain: coreGain, sparkCols: sparkCols, get cell() { return cell; }, get pal() { return PAL; },
                 set t(v) { t = +v || 0; } };   /* dev/screenshots: jump the clock */
})();
