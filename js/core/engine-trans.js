/* engine-trans.js — small registry and the woods room slide. */
(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};
  var kinds = {}, enabled = { woods: 1 }, active = null;
  function kind(name, def) { kinds[name] = def; return def; }
  function get(name) { return kinds[name] || null; }
  function start(name, canvas, dir, reduced, incoming) {
    var k = get(name), snapshot;
    if (reduced) { active = null; return null; }
    if (!k) return null;
    if (name === 'mode' && !canvas) {
      snapshot = NEU.kernel && NEU.kernel.bridge && NEU.kernel.bridge();
      if (!snapshot) { active = null; return null; }
      canvas = snapshot;
    }
    active = { name: name, def: k, canvas: canvas, incoming: incoming || null, dir: dir || 'right', t: 0, ms: k.ms };
    if (k.pre) k.pre(active);
    if (k.cover) k.cover(active);
    return active;
  }
  function step(dt) {
    if (!active) return false;
    active.t = Math.min(1, active.t + dt * 1000 / active.ms);
    if (active.t >= 1) { var a = active; active = null; if (a.def.post) a.def.post(a); return false; }
    return true;
  }
  function motion(w, h, scale) {
    if (!active) return null;
    var t = 1 - Math.pow(1 - active.t, 3), d = active.dir;
    var x = d === 'right' ? w : d === 'left' ? -w : 0;
    var y = d === 'down' ? h : d === 'up' ? -h : 0;
    return { t: t, x: Math.round(x * (1 - t) / scale) * scale,
      y: Math.round(y * (1 - t) / scale) * scale,
      oldX: Math.round(-x * t / scale) * scale, oldY: Math.round(-y * t / scale) * scale };
  }
  function draw(ctx, w, h, scale) {
    if (!active || !active.canvas) return;
    var m = motion(w, h, scale);
    ctx.save(); ctx.imageSmoothingEnabled = false;
    if (active.incoming) ctx.drawImage(active.incoming, m.x, m.y, w, h);
    ctx.drawImage(active.canvas, m.oldX, m.oldY, w, h);
    ctx.restore();
  }
  kind('slide', { ms: 320 });
  kind('mode', { ms: 320 });
  kind('portal:d1_street>b7_altar', { ms: 380 });
  kind('portal:d1_street>h3_trip', { ms: 380 });
  kind('cine:rooms-g-trip', { ms: 320 });
  kind('cine:crack-sky', { ms: 320 });
  NEU.engineTrans = { kind: kind, get: get, enabled: enabled, start: start, step: step, draw: draw, motion: motion,
    get active() { return active; }, cut: function () { active = null; } };
})();
