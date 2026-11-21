/* kit.js — reusable, item-driven player combat kit. */
(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};

  function create(opts) {
    opts = opts || {};
    var MAXH = opts.maxHp || 6, HEALCD = opts.healCd || 30;
    var F = opts.F || (NEU.danmaku && NEU.danmaku.fight ? NEU.danmaku.fight(0, 0) : { x: 0, y: 0, fx: 0, fy: -1, swings: [] });
    var box = opts.box || { AX: 0, AY: 0, AW: 800, AH: 600 };
    var adapter = opts.adapter || {};
    var tp = 0, shield = false, stripOpen = false, stripSel = 0, stripAt = 0, stripShake = -1e9;
    /* TP bar ghosts. Deltarune's obj_tensionbar_Draw_0: apparent chases the
       real value by 20 internal units a frame, current follows apparent
       after 15 frames. TP ceiling here is 250 units, so 20/250 = 0.08. */
    var TP_UNITS = 250, TP_CHASE = 20 / TP_UNITS;
    var tpApp = 0, tpCur = 0, tpChange = 0, gaugeLast = 0, gaugeCv = null, gaugeCtx = null;
    /* strip colours: Scal's brimstone by default, a fight passes its own */
    var th = opts.theme || {};
    var T = { rim: th.rim || '#8C1A22', acc: th.acc || '#FF9E30', hot: th.hot || '192,20,10', hotLine: th.hotLine || '#FF3A1A',
      soul: th.soul || '#E23B55', title: th.title || 'TP  ACTIONS', well: th.well || '#3A1016' };
    var FONT_UI = '16px "Determination Mono","Pixelify Sans",monospace';
    var ICON = {
      heal:   ['..#..', '..#..', '#####', '..#..', '..#..'],
      buster: ['..#....', '.##..#.', '.###.#.', '######.', '#######', '.#####.', '..###..'],
      shield: ['#######', '#######', '#######', '.#####.', '.#####.', '..###..', '...#...'],
      nova:   ['#..#..#', '.#.#.#.', '..###..', '#######', '..###..', '.#.#.#.', '#..#..#']
    };
    var HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
    var charge = false, chargeT = 0, meleeCd = 0, rangedCd = 0, healCd = 0;
    /* hold Z this long and the release also swings a charged melee arc */
    var CHARGE_FULL = 1.0;
    var shots = [], swings = [], beam = null, dash = null, hp = MAXH, casts = [];
    var grazePts = 8 / 250, grazePad = 8, playerR = 4;
    var GRAZE_TEXT = 'GRAZE';

    function item(id) { return NEU.items && NEU.items.get ? NEU.items.get(id) : null; }
    function equipped(slot) {
      return NEU.save && NEU.save.equipped ? NEU.save.equipped(slot) :
        (slot === 'melee' ? 'blade' : slot === 'ranged' ? 'soulfire' : slot === 'spell1' ? 'brimstone' : 'soulshield');
    }
    function targets() { return adapter.targets ? adapter.targets() || [] : []; }
    function sfx(name) { if (adapter.sfx) adapter.sfx(name); }
    function swingSound(charged) {
      var name = charged ? 'snap' : 'whoosh';
      if (NEU.sfx && NEU.sfx[name]) NEU.sfx[name]();
      else sfx(name);
    }
    function distance(x, y) { return Math.sqrt(x * x + y * y); }
    function facing() {
      var x = F.fx || 0, y = F.fy || 0;
      if (!x && !y) y = -1;
      return Math.atan2(y, x);
    }
    function nearest() {
      var list = targets(), best = null, bd = Infinity, i, d;
      for (i = 0; i < list.length; i++) {
        d = distance(list[i].x - F.x, list[i].y - F.y);
        if (d < bd) { best = list[i]; bd = d; }
      }
      return best;
    }
    function damage(t, n, kind) { if (adapter.damage) adapter.damage(t, n, kind); }
    var tpEvents = [];
    function addTp(n) {
      var before = tp;
      tp = Math.max(0, Math.min(1, tp + n));
      if (tp !== before) tpEvents.push(tp - before);
      return tp;
    }
    function drainTp() { var e = tpEvents; tpEvents = []; return e; }
    /* Advance the two displayed values by n 60 Hz frames. Called from the
       strip's draw (real time, not the fight's 0.2x slow-motion dt) and
       directly by tests. */
    function stepGauge(n) {
      n = Math.max(0, Math.min(8, Math.round(Number(n) || 0)));
      while (n-- > 0) {
        var diff = tp - tpApp, d, step, ad;
        if (Math.abs(diff) < TP_CHASE) tpApp = tp;
        else tpApp += diff > 0 ? TP_CHASE : -TP_CHASE;
        d = (tpApp - tpCur) * TP_UNITS;
        ad = Math.abs(d);
        if (ad < 1e-6) { tpChange = 0; continue; }
        if (++tpChange <= 15) continue;
        if (ad < 3) step = ad;
        else {
          step = 2;
          if (ad > 10) step += 2;
          if (ad > 25) step += 3;
          if (ad > 50) step += 4;
          if (ad > 100) step += 5;
        }
        step = Math.min(step, ad);
        tpCur += (d > 0 ? step : -step) / TP_UNITS;
        if (Math.abs(tpApp - tpCur) < 3 / TP_UNITS) tpCur = tpApp;
      }
    }
    function heal(n) { hp = Math.min(MAXH, hp + n); }
    function melee() {
      if (meleeCd > 0 || opts.noMelee) return;
      var it = item(equipped('melee'));
      if (!it) return;
      var st = it.stats || {}, tg = nearest(), a = tg ? Math.atan2(tg.y - F.y, tg.x - F.x) : facing();
      meleeCd = st.cd || 0.3;
      if (it.fx === 'dashstrike') {
        dash = { t: 0.18, ang: facing(), hit: [] };
        F.dashI = Math.max(F.dashI || 0, 0.18);
      } else if (tg && distance(tg.x - F.x, tg.y - F.y) <= (st.r || 56) + (tg.r || 0)) {
        damage(tg, st.dmg || 0, 'melee'); addTp(0.01);
      }
      swings.push({ x: F.x, y: F.y, ang: a, t: 0, dur: 0.15, r: st.r || 56 });
      swingSound(false);
    }
    /* the full-charge payoff: a wider, longer arc that hits everything in it for double damage */
    function chargedMelee() {
      if (meleeCd > 0 || opts.noMelee) return;
      var it = item(equipped('melee'));
      if (!it) return;
      var st = it.stats || {}, r = (st.r || 56) * 1.5, list = targets(), i, d, dx, dy, a = facing();
      meleeCd = Math.max(meleeCd, (st.cd || 0.3) * 1.5);
      swings.push({ x: F.x, y: F.y, ang: facing(), t: 0, dur: 0.24, r: r, charged: true });
      for (i = 0; i < list.length; i++) {
        dx = list[i].x - F.x; dy = list[i].y - F.y; d = distance(dx, dy);
        if (d <= r + (list[i].r || 0) && dx * Math.cos(a) + dy * Math.sin(a) >= d * 0.2675 - (list[i].r || 0)) { damage(list[i], (st.dmg || 0) * 2, 'melee'); addTp(0.02); }
      }
      swingSound(true);
    }
    function fireRanged() {
      if (rangedCd > 0) return;
      var it = item(equipped('ranged'));
      if (!it) return;
      var st = it.stats || {}, target = nearest(), base = target ? Math.atan2(target.y - F.y, target.x - F.x) : facing();
      var n = it.fx === 'shot' ? Math.max(1, st.n || 1) : 1, spread = st.spread || 0, i;
      rangedCd = st.cd || 1;
      casts.push({ x: F.x, y: F.y - 8, t: 0.35, d: 0.35, k: 'fxGigCast' });
      for (i = 0; i < n; i++) {
        var ang = base + (n > 1 ? (i - (n - 1) / 2) * spread : 0);
        shots.push({ kind: it.fx === 'split' ? 'fireball' : it.fx, x: F.x, y: F.y,
          vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260, r: 9, dmg: st.dmg || 1,
          age: 0, life: 4, hit: [], split: it.fx === 'split', pierce: it.fx === 'pierce', turn: it.fx === 'homing' ? 3 : 0 });
      }
      sfx('tick');
    }
    function release() {
      if (!charge) return;
      charge = false;
      var it = item(equipped('ranged')), threshold = it && it.stats && it.stats.hold !== undefined ? it.stats.hold : 0.45;
      var full = chargeT >= CHARGE_FULL;
      if (chargeT < threshold) melee(); else fireRanged();
      if (full) chargedMelee();
      chargeT = 0;
    }
    function stripItems() {
      var out = [{ kind: 'heal-free', name: 'HEAL', cost: 0 }];
      var a = item(equipped('spell1')), b = item(equipped('spell2'));
      out.push({ kind: 'spell', slot: 'spell1', data: a, name: a ? a.name.toUpperCase() : 'SPELL I' });
      out.push({ kind: 'spell', slot: 'spell2', data: b, name: b ? b.name.toUpperCase() : 'SPELL II' });
      if (NEU.items && NEU.items.list && NEU.save && NEU.save.count) {
        var heals = NEU.items.list('heal'), i;
        for (i = 0; i < heals.length; i++) if (NEU.save.count(heals[i].id) > 0)
          out.push({ kind: 'consumable', data: heals[i], name: heals[i].name.toUpperCase() });
      }
      return out;
    }
    /* what a row looks like and whether it can be used now */
    function rowState(row) {
      var d = row.data, st = d && d.stats || {}, fx = d && d.fx, cost = (st.tp || 0) / 100, pct = Math.round(cost * 100);
      if (row.kind === 'heal-free') return { icon: 'heal', col: '#5CF08C', cost: 0, ok: !opts.noHeal && healCd <= 0 && hp < MAXH, tag: 'FREE',
        why: opts.noHeal ? 'NO HEALS' : healCd > 0 ? 'WAIT ' + Math.ceil(healCd) + 's' : 'HP FULL' };
      if (row.kind === 'consumable') return { icon: 'heal', col: '#5CF08C', cost: 0, ok: true,
        tag: 'x' + (NEU.save && NEU.save.count ? NEU.save.count(d.id) : 1), why: '' };
      if (!d) return { icon: 'buster', col: '#5A5668', cost: 0, ok: false, tag: '', why: 'EMPTY' };
      var up = fx === 'shield' && shield;
      return { icon: fx === 'shield' ? 'shield' : fx === 'nova' ? 'nova' : fx === 'heal' ? 'heal' : 'buster',
        col: fx === 'shield' ? '#8FD8FF' : fx === 'heal' ? '#5CF08C' : '#FF6A2A', cost: cost,
        ok: tp + 0.00001 >= cost && !up, tag: pct + '% TP', why: up ? 'ALREADY UP' : 'NEED ' + pct + '%' };
    }
    function useStrip() {
      var rows = stripItems(), row = rows[stripSel], def, cost, st, fx, i, a, n;
      if (!row) return;
      if (!rowState(row).ok) { stripShake = performance.now(); sfx('tick'); return; }
      if (row.kind === 'heal-free') {
        if (healCd > 0 || hp >= MAXH || opts.noHeal) return;
        heal(2); healCd = HEALCD; stripOpen = false; return;
      }
      def = row.data;
      if (!def) return;
      st = def.stats || {}; fx = def.fx; cost = (st.tp || 0) / 100;
      if (tp + 0.00001 < cost) return;
      if (fx === 'shield' && shield) return;
      var tpBefore = tp;
      tp = Math.max(0, tp - cost);
      if (tp !== tpBefore) tpEvents.push(tp - tpBefore);
      if (fx === 'beam') {
        var tg = nearest();
        beam = { x: F.x, y: F.y, ang: tg ? Math.atan2(tg.y - F.y, tg.x - F.x) : facing(), charge: 0, fire: 0, ticks: 0 };
      } else if (fx === 'shield') shield = true;
      else if (fx === 'nova') {
        n = Math.max(1, st.n || 16);
        for (i = 0; i < n; i++) { a = i * Math.PI * 2 / n; shots.push({ kind: 'nova', x: F.x, y: F.y,
          vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, r: 6, dmg: st.dmg || 1, age: 0, life: 2, hit: [], pierce: false }); }
      } else if (fx === 'heal') heal(st.heal === 'full' ? 6 : Number(st.heal) || 0);
      else { var rb = tp; tp += cost; if (tp !== rb) tpEvents.push(tp - rb); return; }
      var CF = { beam: 'fxGigBrim', shield: 'fxGigWard', nova: 'fxGigNova', heal: 'fxGigMend' };
      if (CF[fx]) casts.push({ x: F.x, y: F.y - 8, t: 0.45, d: 0.45, k: CF[fx] });
      if (row.kind === 'consumable' && NEU.save) NEU.save.take(def.id);
      stripOpen = false;
    }
    function keydown(key) {
      key = String(key || '');
      if (stripOpen) {
        var n = stripItems().length, moved = true;
        if (key === 'ArrowUp' || key === 'Up' || key === 'w' || key === 'W') stripSel = (stripSel + n - 1) % n;
        else if (key === 'ArrowDown' || key === 'Down' || key === 's' || key === 'S') stripSel = (stripSel + 1) % n;
        else if (key.toLowerCase() === 'z' || key === 'Enter') { useStrip(); moved = false; }
        else if (key.toLowerCase() === 'x' || key.toLowerCase() === 'c' || key === 'Escape') { stripOpen = false; moved = false; }
        else moved = false;
        if (moved) sfx('tick');
        return;
      }
      if (key.toLowerCase() === 'c') { stripOpen = true; stripSel = 0; stripAt = performance.now(); return; }
      if (key.toLowerCase() === 'z' && !charge) { charge = true; chargeT = 0; }
    }
    function keyup(key) { if (String(key || '').toLowerCase() === 'z') release(); }
    function spawnMinis(s) {
      var i, a;
      for (i = 0; i < 4; i++) { a = i * Math.PI / 2; shots.push({ kind: 'mini', x: s.x, y: s.y,
        vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, r: 5, dmg: 1, age: 0, life: 1.2, hit: [], pierce: false }); }
    }
    function tick(dt) {
      var i, j, s, list, t, dx, dy, d, desired, current, turn, due;
      dt = Math.max(0, Number(dt) || 0);
      meleeCd = Math.max(0, meleeCd - dt); rangedCd = Math.max(0, rangedCd - dt); healCd = Math.max(0, healCd - dt);
      if (charge) chargeT += dt;
      if (!opts.danmakuMovement && F.dashI > 0) F.dashI = Math.max(0, F.dashI - dt);
      if (dash) {
        var speed = 90, nx = F.x + Math.cos(dash.ang) * speed * dt, ny = F.y + Math.sin(dash.ang) * speed * dt;
        F.x = Math.max(box.AX, Math.min(box.AX + box.AW, nx)); F.y = Math.max(box.AY, Math.min(box.AY + box.AH, ny));
        dash.t -= dt;
        list = targets();
        for (i = 0; i < list.length; i++) if (dash.hit.indexOf(list[i]) < 0 && distance(list[i].x - F.x, list[i].y - F.y) <= 18 + (list[i].r || 0)) {
          dash.hit.push(list[i]); damage(list[i], ((item(equipped('melee')) || {}).stats || {}).dmg || 1, 'melee');
        }
        if (dash.t <= 0) dash = null;
      }
      for (i = swings.length - 1; i >= 0; i--) { swings[i].t += dt; if (swings[i].t >= swings[i].dur) swings.splice(i, 1); }
      for (i = casts.length - 1; i >= 0; i--) { casts[i].t -= dt; if (casts[i].t <= 0) casts.splice(i, 1); }
      if (beam) {
        beam.x = F.x; beam.y = F.y;
        list = targets();
        if (list.length) {
          t = list[0]; desired = Math.atan2(t.y - F.y, t.x - F.x); current = beam.ang;
          turn = desired - current; while (turn > Math.PI) turn -= Math.PI * 2; while (turn < -Math.PI) turn += Math.PI * 2;
          beam.ang += Math.max(-2 * dt, Math.min(2 * dt, turn));
        }
        beam.charge = Math.min(0.25, beam.charge + dt);
        if (beam.charge >= 0.25) {
          beam.fire += dt; due = Math.min(10, Math.floor(beam.fire / 0.095));
          while (beam.ticks < due) {
            beam.ticks++;
            list = targets();
            for (j = 0; j < list.length; j++) {
              dx = list[j].x - beam.x; dy = list[j].y - beam.y;
              d = Math.max(0, Math.min(900, dx * Math.cos(beam.ang) + dy * Math.sin(beam.ang)));
            if (distance(beam.x + Math.cos(beam.ang) * d - list[j].x, beam.y + Math.sin(beam.ang) * d - list[j].y) <= (list[j].r || 0) + 8) damage(list[j], 7, 'spell');
            }
          }
          if (beam.fire >= 0.95) beam = null;
        }
      }
      for (i = shots.length - 1; i >= 0; i--) {
        s = shots[i]; s.age += dt; if (s.age >= s.life) { shots.splice(i, 1); continue; }
        s.trail = s.trail || [];
        s.trail.push({ x: s.x, y: s.y });
        if (s.trail.length > (s.kind === 'mini' ? 4 : 7)) s.trail.shift();
        if (s.turn) {
          t = nearest();
          if (t) {
            desired = Math.atan2(t.y - s.y, t.x - s.x); current = Math.atan2(s.vy, s.vx);
            turn = desired - current; while (turn > Math.PI) turn -= Math.PI * 2; while (turn < -Math.PI) turn += Math.PI * 2;
            current += Math.max(-s.turn * dt, Math.min(s.turn * dt, turn));
            var speed0 = distance(s.vx, s.vy); s.vx = Math.cos(current) * speed0; s.vy = Math.sin(current) * speed0;
          }
        }
        s.x += s.vx * dt; s.y += s.vy * dt;
        list = targets(); var dead = false;
        for (j = 0; j < list.length; j++) if (s.hit.indexOf(list[j]) < 0 && distance(list[j].x - s.x, list[j].y - s.y) <= (list[j].r || 0) + s.r) {
          s.hit.push(list[j]); damage(list[j], s.dmg, 'ranged');
          if (s.split && s.kind !== 'mini') spawnMinis(s);
          if (!s.pierce) { dead = true; break; }
        }
        if (dead) shots.splice(i, 1);
      }
    }
    function stamp(ctx, rows, cx, cy, s, col) {
      var sd = NEU.danmaku && NEU.danmaku.soul;
      if (sd && sd.stamp) { sd.stamp(ctx, rows, cx, cy, s, col); return; }
      var x0 = (cx - rows[0].length * s / 2) | 0, y0 = (cy - rows.length * s / 2) | 0, r, c;
      ctx.fillStyle = col;
      for (r = 0; r < rows.length; r++) for (c = 0; c < rows[r].length; c++) if (rows[r][c] === '#') ctx.fillRect(x0 + c * s, y0 + r * s, s, s);
    }
    /* The gauge is painted on a cached strip so the cell slits and the two
       phase gates can be CUT OUT with destination-out, as Deltarune does
       with bm_subtract, without punching holes in the fight behind it.
       Without a 2D context the same geometry is painted as dark slits. */
    function paintGauge(g, w, cost, blink, sub) {
      var cells = 25, cw = w / cells;
      var curX = Math.max(0, Math.min(w, Math.round(tpCur * w)));
      var appX = Math.max(0, Math.min(w, Math.round(tpApp * w)));
      var gold = tp >= 1 ? '#FFD200' : T.acc, i, x, ad;
      if (appX < curX) {                      /* spend: red/blue undershoot */
        g.fillStyle = gold; g.fillRect(0, 0, appX, 12);
        g.fillStyle = '#E0405A'; g.fillRect(appX, 0, curX - appX, 12);
        g.fillStyle = '#3A72D0'; g.fillRect(appX, 0, Math.min(3, curX - appX), 12);
      } else if (appX > curX) {               /* gain: white overshoot */
        g.fillStyle = '#FFFFFF'; g.fillRect(curX, 0, appX - curX, 12);
        g.fillStyle = gold; g.fillRect(0, 0, curX, 12);
      } else { g.fillStyle = gold; g.fillRect(0, 0, curX, 12); }
      ad = Math.min(curX, appX);
      g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(0, 0, ad, 3);
      g.fillStyle = 'rgba(90,0,0,0.35)'; g.fillRect(0, 9, ad, 3);
      if (cost > 0 && blink > 0 && tpCur > cost) {
        x = Math.max(0, Math.round((tpCur - cost) * w));
        g.globalAlpha = blink * 0.85;
        g.fillStyle = '#FFFFFF'; g.fillRect(x, 0, curX - x, 12);
        g.globalAlpha = 1;
      }
      g.fillStyle = sub ? '#000000' : '#050104';
      if (sub) g.globalCompositeOperation = 'destination-out';
      for (i = 1; i < cells; i++) {
        x = Math.round(i * cw) - 1;
        if (x > 0 && x < w) g.fillRect(x, 0, 2, 12);
      }
      /* phase gates at 0.35 / 0.65, the same numbers the boss bar uses */
      for (i = 0; i < 2; i++) g.fillRect(Math.round(w * (i ? 0.65 : 0.35)) - 1, 0, 3, 12);
      if (sub) g.globalCompositeOperation = 'source-over';
      if (tp >= 1) {                          /* plated gold at MAX */
        g.fillStyle = '#FFF3B0'; g.fillRect(0, 0, w, 2);
        g.fillStyle = '#B87900'; g.fillRect(0, 10, w, 2);
      }
    }

    /* Scal's TP menu, shared: double rim, title tab, icon + name + cost per row,
       stepped highlight with the bobbing soul, HP hearts, TP gauge that previews
       the selected cost. Drops in with a small overshoot; reduced motion skips it. */
    function drawStrip(ctx) {
      var now = performance.now(), u = Math.min(1, (now - stripAt) / 140), reduce = !!(NEU.juice && NEU.juice.reduced);
      if (!gaugeLast) gaugeLast = now;
      stepGauge((now - gaugeLast) * 60 / 1000);
      gaugeLast = now;
      var rows = stripItems(), rowH = 40, bw = Math.min(box.AW - 48, 464) | 0, bh = rowH * rows.length + 132;
      var bx = (box.AX + (box.AW - bw) / 2) | 0, by = (box.AY + Math.max(40, (box.AH - bh) / 2) - (reduce ? 0 : (1 - u) * 24)) | 0;
      var ease = 1 + 0.12 * Math.sin(u * Math.PI) * (1 - u), i, st, y, sel, tw, fy, gx, gy, gw, cost, blink, c0, c1;
      if (now - stripShake < 180 && !reduce) bx += Math.round(Math.sin((now - stripShake) * 0.12) * 4);
      ctx.fillStyle = 'rgba(4,0,2,' + (0.62 * u).toFixed(2) + ')'; ctx.fillRect(box.AX, box.AY, box.AW, box.AH);
      ctx.save();
      if (!reduce && ease !== 1) { ctx.translate(bx + bw / 2, by + bh / 2); ctx.scale(ease, ease); ctx.translate(-(bx + bw / 2), -(by + bh / 2)); }
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx + 6, by + 6, bw, bh);
      ctx.fillStyle = '#050104'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(bx, by, bw, 3); ctx.fillRect(bx, by + bh - 3, bw, 3); ctx.fillRect(bx, by, 3, bh); ctx.fillRect(bx + bw - 3, by, 3, bh);
      ctx.fillStyle = T.rim; ctx.fillRect(bx + 6, by + 6, bw - 12, 2); ctx.fillRect(bx + 6, by + bh - 8, bw - 12, 2);
      ctx.fillRect(bx + 6, by + 6, 2, bh - 12); ctx.fillRect(bx + bw - 8, by + 6, 2, bh - 12);
      ctx.fillStyle = T.acc; ctx.fillRect(bx + 6, by + 6, 4, 4); ctx.fillRect(bx + bw - 10, by + 6, 4, 4);
      ctx.fillRect(bx + 6, by + bh - 10, 4, 4); ctx.fillRect(bx + bw - 10, by + bh - 10, 4, 4);
      ctx.font = FONT_UI; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      tw = (ctx.measureText ? ctx.measureText(T.title).width : 120) + 24 | 0;
      ctx.fillStyle = '#050104'; ctx.fillRect(bx + 20, by - 12, tw, 24);
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(bx + 20, by - 12, tw, 2); ctx.fillRect(bx + 20, by - 12, 2, 14); ctx.fillRect(bx + 18 + tw, by - 12, 2, 14);
      ctx.fillStyle = T.acc; ctx.fillText(T.title, bx + 32, by - 8);
      for (i = 0; i < rows.length; i++) {
        st = rowState(rows[i]); y = by + 28 + i * rowH; sel = i === stripSel;
        if (sel) {
          c0 = ((bw - 24) * 0.34) | 0; c1 = ((bw - 24) * 0.33) | 0;
          ctx.fillStyle = 'rgba(' + T.hot + ',0.42)'; ctx.fillRect(bx + 12, y - 4, c0, 32);
          ctx.fillStyle = 'rgba(' + T.hot + ',0.24)'; ctx.fillRect(bx + 12 + c0, y - 4, c1, 32);
          ctx.fillStyle = 'rgba(' + T.hot + ',0.12)'; ctx.fillRect(bx + 12 + c0 + c1, y - 4, bw - 24 - c0 - c1, 32);
          ctx.fillStyle = st.ok ? T.hotLine : '#5A5668'; ctx.fillRect(bx + 12, y - 4, 2, 32);
          stamp(ctx, HEART, bx + 28 + (reduce ? 0 : Math.round(Math.sin(now * 0.008) * 2)), y + 12, 2, T.soul);
        }
        ctx.fillStyle = st.ok ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)'; ctx.fillRect(bx + 46, y - 1, 22, 22);
        stamp(ctx, ICON[st.icon], bx + 57, y + 10, 2, st.ok ? st.col : '#3E3A48');
        ctx.fillStyle = st.ok ? (sel ? '#FFFF00' : '#FFFFFF') : '#5A5668'; ctx.fillText(rows[i].name, bx + 80, y + 2);
        ctx.textAlign = 'right'; ctx.fillStyle = st.ok ? T.acc : '#6A6480'; ctx.fillText(st.ok ? st.tag : st.why, bx + bw - 24, y + 2); ctx.textAlign = 'left';
        if (rows[i].kind === 'heal-free' && healCd > 0) {
          ctx.fillStyle = '#1A3A24'; ctx.fillRect(bx + 80, y + 21, 128, 3);
          ctx.fillStyle = '#5CF08C'; ctx.fillRect(bx + 80, y + 21, Math.round(128 * (1 - healCd / HEALCD)), 3);
        }
      }
      fy = by + 28 + rows.length * rowH + 4;
      ctx.fillStyle = T.well; ctx.fillRect(bx + 16, fy, bw - 32, 2);
      ctx.fillStyle = '#C0BCC8'; if (NEU.glyph && NEU.glyph.compact()) NEU.glyph.draw(ctx, 'heart', bx + 24, fy + 10);
      else ctx.fillText('HP', bx + 24, fy + 14);
      for (i = 0; i < MAXH; i++) stamp(ctx, HEART, bx + 66 + i * 16, fy + 22, 2, i < hp ? T.soul : '#2A1A20');
      ctx.textAlign = 'right'; ctx.fillStyle = T.acc; ctx.fillText((NEU.glyph && NEU.glyph.compact() ? '' : 'TP ') + (tp >= 1 && !(NEU.glyph && NEU.glyph.compact()) ? 'MAX' : Math.floor(tp * 100) + '%'), bx + bw - 24, fy + 14);
      gx = bx + 24; gy = fy + 40; gw = bw - 48;
      st = rowState(rows[stripSel] || rows[0]); cost = st.ok ? st.cost : 0;
      blink = reduce ? 1 : (Math.floor(now / 260) % 2 ? 1 : 0.55);
      ctx.fillStyle = T.well; ctx.fillRect(gx - 2, gy - 2, gw + 2, 16);
      if (!gaugeCv || gaugeCv.width !== gw) {
        gaugeCv = typeof document !== 'undefined' && document.createElement ? document.createElement('canvas') : null;
        if (gaugeCv) { gaugeCv.width = Math.max(1, gw); gaugeCv.height = 12; }
        gaugeCtx = gaugeCv && gaugeCv.getContext ? gaugeCv.getContext('2d') : null;
      }
      if (gaugeCtx) {
        gaugeCtx.clearRect(0, 0, gaugeCv.width, 12);
        paintGauge(gaugeCtx, gw, cost, blink, true);
        ctx.drawImage(gaugeCv, gx, gy);
      } else {
        ctx.save(); ctx.translate(gx, gy);
        paintGauge(ctx, gw, cost, blink, false);
        ctx.restore();
      }
      var kn = function (d) { return NEU.keys && NEU.keys.label ? NEU.keys.label(d) : d; };
      ctx.textAlign = 'left'; ctx.fillStyle = '#8A8598'; ctx.fillText(NEU.glyph && NEU.glyph.compact() ? NEU.glyph.key('z') + '  ·  ' + NEU.glyph.key('x') : kn('z') + ' use  ·  ' + kn('x') + ' back', bx + 24, fy + 64);
      ctx.textAlign = 'right'; ctx.fillStyle = '#5A5668'; if (NEU.glyph && NEU.glyph.compact()) NEU.glyph.draw(ctx, 'graze', bx + bw - 40, fy + 61);
      else ctx.fillText('graze bullets for TP', bx + bw - 24, fy + 64); ctx.textAlign = 'left';
      ctx.restore();
    }
    function draw(ctx) {
      var i, j, s, sw, x, y, p, k, a, radius;
      if (!ctx) return;
      for (i = 0; i < shots.length; i++) {
        s = shots[i];
        for (j = 0; j < (s.trail || []).length; j++) {
          p = s.trail[j]; k = (j + 1) / s.trail.length;
          ctx.fillStyle = s.kind === 'mini' ? '#7FE6FF' : 'rgba(160,240,255,' + (0.6 * k).toFixed(2) + ')';
          ctx.fillRect((p.x - (s.kind === 'mini' ? 1 : 2)) | 0, (p.y - 1) | 0, s.kind === 'mini' ? 2 : 3, 2);
        }
        ctx.fillStyle = s.kind === 'mini' ? '#FFFFFF' : '#7FE6FF';
        if (s.kind === 'mini') ctx.fillRect((s.x - 1) | 0, (s.y - 1) | 0, 2, 2);
        else {
          a = Math.atan2(s.vy, s.vx); x = Math.cos(a); y = Math.sin(a);
          ctx.fillRect((s.x + x * 8 - y * 3) | 0, (s.y + y * 8 + x * 3) | 0, 4, 4);
          ctx.fillRect((s.x - x * 6 - y * 3) | 0, (s.y - y * 6 + x * 3) | 0, 4, 4);
          ctx.fillRect((s.x - x * 6 + y * 3) | 0, (s.y - y * 6 - x * 3) | 0, 4, 4);
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect((s.x - 1) | 0, (s.y - 1) | 0, 2, 2);
        }
      }
      for (i = 0; i < swings.length; i++) {
        sw = swings[i];
        var sn = sw.charged ? 12 : 8;
        for (j = 0; j < sn; j++) {
          a = sw.ang - 1.15 + j * (sw.charged ? 0.22 : 0.16) + Math.min(1, sw.t / sw.dur) * (sw.charged ? 0.6 : 0.4);
          radius = sw.r * (sw.charged ? 1.45 : 1) * (0.78 + j * (sw.charged ? 0.02 : 0.018));
          x = (sw.x + Math.cos(a) * radius) | 0; y = (sw.y + Math.sin(a) * radius) | 0;
          ctx.fillStyle = sw.charged ? (j < 4 ? '#FFD36A' : j < 8 ? '#FF9E30' : '#FFFFFF') : (j < 3 ? '#30AFFF' : '#7FE6FF');
          ctx.fillRect(x - 2, y - 2, 4, 4);
          if (j > sn - 3) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x - 1, y - 1, 2, 2); }
        }
      }
      /* the hold-Z charge: an arc centred on the facing that fills to white at full charge */
      if (charge) {
        var ck = Math.min(1, chargeT / CHARGE_FULL), cn = 12;
        for (j = 0; j < cn; j++) {
          a = facing() - 1.1 + (j / (cn - 1)) * 2.2;
          x = (F.x + Math.cos(a) * 20) | 0; y = (F.y + Math.sin(a) * 20) | 0;
          var on = (j + 0.5) / cn <= ck;
          ctx.fillStyle = !on ? 'rgba(48,175,255,0.22)' : ck >= 1 ? '#FFFFFF' : (j % 4 === 0 ? '#FFD36A' : '#30AFFF');
          ctx.fillRect(x - 1, y - 1, 3, 3);
        }
      }
      if (beam) {
        ctx.fillStyle = beam.charge < 0.25 ? '#6F335A' : '#FF3A1A';
        for (i = 0; i < 32; i++) { x = (beam.x + Math.cos(beam.ang) * i * 28) | 0; y = (beam.y + Math.sin(beam.ang) * i * 28) | 0; ctx.fillRect(x - 2, y - 2, 5, 5); }
        ctx.fillStyle = '#FFF4D0'; ctx.fillRect((beam.x - 1) | 0, (beam.y - 1) | 0, 3, 3);
      }
      for (i = 0; i < casts.length; i++) if (NEU.fxBurst) NEU.fxBurst(ctx, casts[i].k, casts[i].x, casts[i].y, 1 - casts[i].t / casts[i].d, 1.6);
      if (stripOpen) drawStrip(ctx);
    }
    function graze(bullet) {
      if (!bullet || bullet.grazed) return false;
      var dx = bullet.x - F.x, dy = bullet.y - F.y, r = (bullet.r || 0) + playerR + grazePad;
      if (dx * dx + dy * dy > r * r) return false;
      bullet.grazed = true; addTp(grazePts); F.grazes = F.grazes || []; F.grazes.push({ x: bullet.x, y: bullet.y, t: 0, label: GRAZE_TEXT });
      return true;
    }
    function hit(n) {
      if (shield) { shield = false; sfx('snap'); return true; }
      if (adapter.hurtPlayer) adapter.hurtPlayer(n);
      return false;
    }

    function cdFrac(cd, max) { return max > 0 ? Math.max(0, Math.min(1, cd / max)) : 0; }
    /* Remaining cooldown as a 0..1 fraction for the TP bar's chips. */
    function cooldowns() {
      var m = item(equipped('melee')), r = item(equipped('ranged'));
      var ms = (m && m.stats && m.stats.cd) || 0.3, rs = (r && r.stats && r.stats.cd) || 1;
      return { melee: cdFrac(meleeCd, ms), ranged: cdFrac(rangedCd, rs), heal: cdFrac(healCd, HEALCD) };
    }

    var api = {
      keydown: keydown, keyup: keyup, tick: tick, draw: draw,
      addTp: addTp, graze: graze, hit: hit, cooldowns: cooldowns, drainTp: drainTp,
      stepGauge: stepGauge, paintGauge: paintGauge,
      get gauge() { return { current: tpCur, apparent: tpApp, target: tp, chase: TP_CHASE, units: TP_UNITS }; },
      get tp() { return tp; },
      get stripOpen() { return stripOpen; },
      get slow() { return stripOpen ? 0.2 : 1; },
      get noMelee() { return !!opts.noMelee; },
      shots: shots, casts: casts, swings: swings,
      get beam() { return beam; },
      /* 0..1 charge progress while Z is held, 0 otherwise */
      get charge() { return charge ? Math.min(1, chargeT / CHARGE_FULL) : 0; },
      get hp() { return hp; },
      /* a host that owns the HP (the dungeon) writes it in so HEAL and the strip read true */
      set hp(v) { hp = Math.max(0, Math.min(MAXH, Number(v) || 0)); }
    };
    /* The TP bar shows the newest kit while its fight (or the dungeon) is live. */
    api._mini = NEU.activeMinigame || '';
    NEU.kitLive = api;
    return api;
  }

  /* ponytail: Scal keeps its inline copy until its gzip budget allows the later merge. */
  NEU.kit = { create: create };
})();
