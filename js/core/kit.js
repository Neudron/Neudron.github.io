/* kit.js — reusable, item-driven player combat kit. */
(function () {
  'use strict';

  var NEU = window.NEU = window.NEU || {};

  function create(opts) {
    opts = opts || {};
    var F = opts.F || (NEU.danmaku && NEU.danmaku.fight ? NEU.danmaku.fight(0, 0) : { x: 0, y: 0, fx: 0, fy: -1, swings: [] });
    var box = opts.box || { AX: 0, AY: 0, AW: 800, AH: 600 };
    var adapter = opts.adapter || {};
    var tp = 0, shield = false, stripOpen = false, stripSel = 0;
    var charge = false, chargeT = 0, meleeCd = 0, rangedCd = 0, healCd = 0;
    var shots = [], swings = [], beam = null, dash = null, hp = 6;
    var grazePts = 8 / 250, grazePad = 8, playerR = 4;
    var GRAZE_TEXT = 'GRAZE';

    function item(id) { return NEU.items && NEU.items.get ? NEU.items.get(id) : null; }
    function equipped(slot) {
      return NEU.save && NEU.save.equipped ? NEU.save.equipped(slot) :
        (slot === 'melee' ? 'blade' : slot === 'ranged' ? 'soulfire' : slot === 'spell1' ? 'brimstone' : 'soulshield');
    }
    function targets() { return adapter.targets ? adapter.targets() || [] : []; }
    function sfx(name) { if (adapter.sfx) adapter.sfx(name); }
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
    function addTp(n) { tp = Math.max(0, Math.min(1, tp + n)); return tp; }
    function heal(n) { hp = Math.min(6, hp + n); }
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
      sfx('tick');
    }
    function fireRanged() {
      if (rangedCd > 0) return;
      var it = item(equipped('ranged'));
      if (!it) return;
      var st = it.stats || {}, target = nearest(), base = target ? Math.atan2(target.y - F.y, target.x - F.x) : facing();
      var n = it.fx === 'shot' ? Math.max(1, st.n || 1) : 1, spread = st.spread || 0, i;
      rangedCd = st.cd || 1;
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
      if (chargeT < threshold) melee(); else fireRanged();
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
    function useStrip() {
      var rows = stripItems(), row = rows[stripSel], def, cost, st, fx, i, a, n;
      if (!row) return;
      if (row.kind === 'heal-free') {
        if (healCd > 0 || hp >= 6) return;
        heal(2); healCd = 30; stripOpen = false; return;
      }
      def = row.data;
      if (!def) return;
      st = def.stats || {}; fx = def.fx; cost = (st.tp || 0) / 100;
      if (tp + 0.00001 < cost) return;
      if (fx === 'shield' && shield) return;
      tp = Math.max(0, tp - cost);
      if (fx === 'beam') {
        var tg = nearest();
        beam = { x: F.x, y: F.y, ang: tg ? Math.atan2(tg.y - F.y, tg.x - F.x) : facing(), charge: 0, fire: 0, ticks: 0 };
      } else if (fx === 'shield') shield = true;
      else if (fx === 'nova') {
        n = Math.max(1, st.n || 16);
        for (i = 0; i < n; i++) { a = i * Math.PI * 2 / n; shots.push({ kind: 'nova', x: F.x, y: F.y,
          vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, r: 6, dmg: st.dmg || 1, age: 0, life: 2, hit: [], pierce: false }); }
      } else if (fx === 'heal') heal(st.heal === 'full' ? 6 : Number(st.heal) || 0);
      else { tp += cost; return; }
      if (row.kind === 'consumable' && NEU.save) NEU.save.take(def.id);
      stripOpen = false;
    }
    function keydown(key) {
      key = String(key || '');
      if (stripOpen) {
        if (key === 'ArrowUp' || key === 'Up' || key === 'w' || key === 'W') stripSel = (stripSel + stripItems().length - 1) % stripItems().length;
        else if (key === 'ArrowDown' || key === 'Down' || key === 's' || key === 'S') stripSel = (stripSel + 1) % stripItems().length;
        else if (key.toLowerCase() === 'z' || key === 'Enter') useStrip();
        else if (key.toLowerCase() === 'x' || key.toLowerCase() === 'c' || key === 'Escape') stripOpen = false;
        return;
      }
      if (key.toLowerCase() === 'c') { stripOpen = true; stripSel = 0; return; }
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
      if (F.dashI > 0) F.dashI = Math.max(0, F.dashI - dt);
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
    function draw(ctx) {
      var i, j, s, sw, x, y, rows, panel, rw, ry, p, k, a, radius;
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
        for (j = 0; j < 8; j++) {
          a = sw.ang - 1.15 + j * 0.16 + Math.min(1, sw.t / sw.dur) * 0.4;
          radius = sw.r * (0.78 + j * 0.018);
          x = (sw.x + Math.cos(a) * radius) | 0; y = (sw.y + Math.sin(a) * radius) | 0;
          ctx.fillStyle = j < 3 ? '#30AFFF' : '#7FE6FF'; ctx.fillRect(x - 2, y - 2, 4, 4);
          if (j > 4) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x - 1, y - 1, 2, 2); }
        }
      }
      if (beam) {
        ctx.fillStyle = beam.charge < 0.25 ? '#6F335A' : '#FF3A1A';
        for (i = 0; i < 32; i++) { x = (beam.x + Math.cos(beam.ang) * i * 28) | 0; y = (beam.y + Math.sin(beam.ang) * i * 28) | 0; ctx.fillRect(x - 2, y - 2, 5, 5); }
        ctx.fillStyle = '#FFF4D0'; ctx.fillRect((beam.x - 1) | 0, (beam.y - 1) | 0, 3, 3);
      }
      if (!stripOpen) return;
      rows = stripItems(); panel = Math.min(box.AW - 24, 464); rw = 40;
      x = (box.AX + (box.AW - panel) / 2) | 0; y = (box.AY + Math.max(8, (box.AH - (rows.length * rw + 96)) / 2)) | 0;
      ctx.fillStyle = 'rgba(4,0,2,0.7)'; ctx.fillRect(box.AX, box.AY, box.AW, box.AH);
      ctx.fillStyle = '#050104'; ctx.fillRect(x, y, panel, rows.length * rw + 96);
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, panel, 3); ctx.fillRect(x, y + rows.length * rw + 93, panel, 3); ctx.fillRect(x, y, 3, rows.length * rw + 96); ctx.fillRect(x + panel - 3, y, 3, rows.length * rw + 96);
      ctx.font = '16px monospace'; ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillStyle = '#FF9E30'; ctx.fillText('TP  ACTIONS', x + 20, y + 12);
      for (i = 0; i < rows.length; i++) {
        ry = y + 40 + i * rw;
        if (i === stripSel) { ctx.fillStyle = 'rgba(192,20,10,0.35)'; ctx.fillRect(x + 12, ry - 4, panel - 24, 30); }
        ctx.fillStyle = i === stripSel ? '#FFFF00' : '#FFFFFF'; ctx.fillText((i === stripSel ? '♥  ' : '   ') + rows[i].name, x + 24, ry);
      }
      ctx.fillStyle = '#FF9E30'; ctx.fillText('HP ' + hp + '       TP ' + Math.floor(tp * 100) + '%', x + 24, y + rows.length * rw + 54);
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

    return {
      keydown: keydown, keyup: keyup, tick: tick, draw: draw,
      addTp: addTp, graze: graze, hit: hit,
      get tp() { return tp; },
      get stripOpen() { return stripOpen; },
      get slow() { return stripOpen ? 0.2 : 1; },
      shots: shots,
      get beam() { return beam; },
      get hp() { return hp; },
      /* a host that owns the HP (the dungeon) writes it in so HEAL and the strip read true */
      set hp(v) { hp = Math.max(0, Math.min(6, Number(v) || 0)); }
    };
  }

  /* ponytail: Scal keeps its inline copy until its gzip budget allows the later merge. */
  NEU.kit = { create: create };
})();
