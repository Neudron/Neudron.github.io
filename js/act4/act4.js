/* act4.js — the way in, and the way back.
   ───────────────────────────────────────────────────────────────────
   The console's library has a sixth tile. This is what is behind it.

   Its only jobs are: decide where you resume, hand control to the
   engine, and add Act IV's steps to the objectives panel. Everything
   else lives in the room files.

   ONE DECISION WORTH ARGUING ABOUT: entering does NOT always start at
   the beginning. If the save file has a room, you resume there. A
   three-hour chain that restarts from the forest every time you close
   a tab is not long, it is unfinishable — and a "continue?" prompt on
   a tile you just deliberately clicked is a question with one sensible
   answer, which is not a question worth asking.                     */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};

  var START = 'a1_clearing';         /* the recall potion lands here */
  var HOME = 'e6_room';             /* a fresh boot starts in your bedroom, sans at your left */

  /* ── NEU.activeMinigame: a stack behind the old global ──────────
     The ~25 modes that claim input still assign and read it as before.
     A name pushes, a falsy value pops (so a mode closed over another
     hands the claim back), a name already on the stack truncates to it
     (plat.replay restores the old value that way). closeModes sweeps it. */
  var claims = [];
  var preClaim = NEU.activeMinigame;
  Object.defineProperty(NEU, 'activeMinigame', {
    configurable: true, enumerable: true,
    get: function () { return claims.length ? claims[claims.length - 1] : null; },
    set: function (v) {
      var i;
      if (!v) { claims.pop(); return; }
      i = claims.indexOf(v);
      if (i >= 0) claims.length = i + 1; else claims.push(v);
    }
  });
  if (preClaim) claims.push(preClaim);

  /* Act IV's objectives are grouped, because a flat list of forty-five
     is not a list, it is wallpaper. quest.js shows one act at a time. */
  var STEPS = [
    { id: 'a4_in',    text: 'find the sixth tile' },
    { id: 'a4_witch', text: 'hear her out' },
    { id: 'a4_rooms', text: 'unlock the castle', count: 5 },
    { id: 'a4_scal',  text: 'meet what was really back there' },
    { id: 'a4_ashes', text: 'put the ashes where they go' },
    { id: 'a4_recall',text: 'find the one item that is lit' },
    { id: 'a4_home',  text: 'go home' },
    { id: 'a4_told',  text: 'hear what he has been sitting on' },
    { id: 'a4_smash', text: 'break the television' },
    { id: 'a4_tenna', text: 'meet whatever was inside it' },
    { id: 'a4_rank',  text: 'get a grade' },
    { id: 'a4_prizes',text: 'open the doors you earned', count: 9 },
    { id: 'a4_nutz',  text: 'get something out of the machine' },
    { id: 'a4_trip',  text: 'regret it' },
    { id: 'a4_axe',   text: 'win the argument' },
    { id: 'a4_mush',  text: 'cut all five', count: 5 },
    { id: 'a4_pot',   text: 'bring the mushrooms to the pot' },
    { id: 'a4_soup',  text: 'make the soup' },
    { id: 'a4_wake',  text: 'wake up' },
    { id: 'a4_chair', text: 'let him sit down' },
    { id: 'a4_crack', text: 'notice the crack' },
    { id: 'a4_polt',  text: 'whatever that was' },
    { id: 'a4_end',   text: 'take the hotdog' }
  ];

  function install() {
    if (!NEU.quest || !NEU.quest.add) return;
    STEPS.forEach(function (s) { NEU.quest.add(s, 'IV the woods'); });
  }

  function open() {
    if (!NEU.engine || !NEU.engine.enter) return false;
    install();
    if (NEU.quest) NEU.quest.mark('a4_in');

    /* Resume where the file says, but only if that room still exists —
       a room id can be renamed during development and a save file
       pointing at a deleted room would otherwise be a hard lock. */
    var s = (NEU.save && NEU.save.data) || {};
    var rooms = (NEU.engine && NEU.engine.rooms) || [];
    var resume = s.room && rooms.indexOf(s.room) >= 0;
    var room = resume ? s.room : HOME;
    var spawn = resume ? (s.spawn || 'default') : 'default';

    if (room !== HOME && NEU.talk) {
      NEU.talk(['you were already somewhere. you are there again.'], 'narr');
    }
    return NEU.engine.enter(room, spawn);
  }

  /* ── the recall potion ─────────────────────────────────────────
     One sequence for both ways to drink it — the C menu and the chalk
     circle in d3_square. Its beats are the portal:recall kind in
     engine-trans.js (ms 2850); busy holds every control until the last:
       0     850  the soul raises the flask (engine api.act)
       850  1250  a ring grows from the feet; the room dims 30 %
       1250 1550  the player dissolves upward, row by row
       1550 1950  the screen folds shut in six strips
       1950 2350  e6_room loads under the strips and unfolds
       2350 2650  the player re-forms by the bed; the ring recedes
       2850       control returns
     Always e6_room at the bed, never a corridor. Reduced motion keeps
     the order and drops the motion: a static ring, then a cut. */
  var recalling = false;
  function reducedMotion() {
    return !!(NEU.motion && NEU.motion.reduced ? NEU.motion.reduced() : window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ||
      !!(NEU.settings && NEU.settings.reduced);
  }
  /* The feet on screen, in CSS px: the engine draws world px at
     (px - cam) * SCALE, scaled into the canvas box. */
  function onScreen() {
    var cv = document.getElementById('engCanvas'), r = cv.getBoundingClientRect(), E = NEU.engine;
    var k = E.SCALE * r.width / cv.width, p = E.api.player, c = E.debug.cam;
    return { x: r.left + (p.x - c.x) * k, y: r.top + (p.y - c.y) * k, k: k };
  }
  /* Overlay blocks sit over the room (z 74); every one is in parts and goes at the end. */
  var parts = [];
  function block(css) {
    var el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true'); el.className = 'recall-part';
    el.style.cssText = 'position:fixed;pointer-events:none;z-index:74;' + css;
    document.body.appendChild(el); parts.push(el);
    return el;
  }
  function ring(f) {
    var el = block('left:' + (f.x - 60) + 'px;top:' + (f.y - 60) + 'px;width:120px;height:120px;border-radius:50%;' +
      'border:4px solid #7FE6FF;box-shadow:0 0 28px rgba(127,230,255,.8),inset 0 0 28px rgba(127,230,255,.5)');
    el.id = 'recallRing';
    return el;
  }
  /* Web Animations where there is one; otherwise the end frame at once. */
  function tween(el, frames, ms, delay, easing) {
    if (!el.animate) { var last = frames[frames.length - 1]; for (var k in last) el.style[k] = last[k]; return; }
    el.animate(frames, { duration: ms, delay: delay || 0, easing: easing || 'ease-out', fill: 'both' });
  }
  function drop(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }
  /* Every mode that can sit over the room, closed in one place: the kernel
     stack (top down, never the engine), the platformer (dungeon and
     mountain), cards, the rhythm overlay, then the claims the engine's own
     Escape list knows. Each close is guarded by "is it open": rhythm's
     close walks to the street, so a stray call would warp the player.
     Returns true when nothing but the room is left. */
  var ESC = ['quiz', 'craft', 'shop', 'dark', 'bullet', 'deck'];
  function closeModes() {
    var K = NEU.kernel, names = K && K.stack ? K.stack.slice().reverse() : [], i, s, m;
    function open(sc) { return sc && (typeof sc.running === 'function' ? sc.running() : sc.running); }
    for (i = 0; i < names.length; i++) {
      s = K.scenes[names[i]];
      if (names[i] !== 'engine' && s && s.close && open(s)) s.close();
    }
    if (NEU.plat && NEU.plat.running && NEU.plat.running() && NEU.plat.close) NEU.plat.close();
    if (NEU.cards && NEU.cards.running && NEU.cards.running() && NEU.cards.close) NEU.cards.close();
    if (NEU.rhythm && NEU.rhythm.running && NEU.rhythm.close) NEU.rhythm.close();
    for (i = 0; i < ESC.length; i++) {
      m = NEU[ESC[i]];
      if (NEU.activeMinigame === ESC[i] && m && m.close) m.close();
    }
    /* a won duel or a won rhythm round closes on an animation: not down yet */
    if (K && K.stack.some(function (n) { return n !== 'engine'; })) return false;
    claims.length = 0;
    return true;
  }
  /* the only claims the potion may close; every fight and story scene refuses */
  var CLOSEABLE = { plat: 1, rhythm: 1, shop: 1, craft: 1, dark: 1, deck: 1 };
  function refuse() {
    if (NEU.talk) NEU.talk(["the potion won't open here."], 'narr');
    return false;
  }
  function where() { var w = NEU.engine.where(); return w ? w.room : null; }   /* the area, not the shared physical room */
  function recall() {
    var E = NEU.engine;
    if (!E || !E.enter || !E.running) return false;
    if (!NEU.save || !NEU.save.has('recall')) return false;
    if (E.rooms && E.rooms.indexOf('e6_room') < 0) return false;
    if (recalling || E.debug.cine || (NEU.engineTrans && NEU.engineTrans.active) ||
        (NEU.activeMinigame && !CLOSEABLE[NEU.activeMinigame])) return refuse();
    /* before busy, the drawPlayer patch and the room snapshot: closing a
       mode can change the room and enter() resets busy */
    if (!closeModes()) return refuse();
    recalling = true;
    NEU.save.flag('used_recall', 1);
    if (NEU.quest) NEU.quest.mark('a4_home');
    var api = E.api, cv = document.getElementById('engCanvas'), end = NEU.engineTrans && NEU.engineTrans.get('portal:recall');
    var ringEl = null, strips = [], started = Date.now(), look = NEU.engineLook, drawPlayer = look && look.drawPlayer;
    var ids = [], watch = 0, expect = where(), irisMs = 400;
    if (drawPlayer && !reducedMotion()) look.drawPlayer = function (ctx, x, y, face, walked, moving, scale, now, extra) {
      var t = Date.now() - started, rows = t < 1250 ? 18 : t < 1550 ? Math.ceil(18 * (1550 - t) / 300) : t < 2350 ? 0 : Math.min(18, Math.floor(18 * (t - 2350) / 300));
      if (!rows) return;
      ctx.save(); ctx.beginPath(); ctx.rect(x - 12 * scale, y - 18 * scale, 24 * scale, rows * scale); ctx.clip();
      drawPlayer(ctx, x, y, face, walked, moving, scale, now, extra); ctx.restore();
    };
    if (api && api.busy) api.busy(true);
    if (api && api.act) api.act('drink', 0.85);
    /* Every exit (the end, a room change, a throw) comes through here once. */
    function finish() {
      if (!recalling) return;
      recalling = false;
      ids.forEach(clearTimeout); ids = [];
      clearInterval(watch);
      parts.forEach(drop); parts = [];
      cv.style.transition = ''; cv.style.filter = '';
      if (look) look.drawPlayer = drawPlayer;
      if (api && api.busy) api.busy(false);
    }
    function at(ms, fn) {
      ids.push(setTimeout(function () {
        try { fn(); } catch (e) { finish(); if (window.console) console.error('recall', e); }
      }, ms));
    }
    /* A room change that is not ours ends the sequence: engine.js has no
       event for it, and api.later dies with the visit, so we poll. */
    watch = setInterval(function () { if (!E.running || where() !== expect) finish(); }, 50);
    function home(iris) {
      /* enter(), not go(): go() silently no-ops while another iris is
         still running, which would leave busy held forever. enter()
         always lands and releases the lock itself, so busy is re-taken. */
      E.enter('e6_room', 'bed', { iris: iris });
      expect = where();
      irisMs = Math.round(E.debug.iris * 1000);
      if (api && api.busy) api.busy(true);
    }
    if (reducedMotion()) {
      /* control comes back after the iris has ended, not while it runs */
      at(250, function () {
        ring(onScreen()); if (NEU.sfx && NEU.sfx.whoosh) NEU.sfx.whoosh(); home(0.4);
        at(irisMs + 50, finish);
      });
      return true;
    }
    at(850, function () {
      ringEl = ring(onScreen());
      tween(ringEl, [{ transform: 'scale(.15)' }, { transform: 'scale(1)' }], 400);
      cv.style.transition = 'filter 400ms'; cv.style.filter = 'brightness(.7)';
    });
    at(1550, function () {
      var r = cv.getBoundingClientRect(), w = r.width / 6;
      for (var i = 0; i < 6; i++) {
        var s = block('left:' + (r.left + i * w) + 'px;top:' + r.top + 'px;width:' + (w + 1) + 'px;height:' + r.height + 'px;background:#16141E;transform-origin:bottom');
        strips.push(s);
        tween(s, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], 240, i * 32);
      }
    });
    at(1950, function () {
      cv.style.transition = ''; cv.style.filter = '';
      home(0.4);
      var f = onScreen();   /* the ring comes along to the bed */
      ringEl.style.left = (f.x - 60) + 'px'; ringEl.style.top = (f.y - 60) + 'px';
      strips.forEach(function (s, i) { tween(s, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], 240, i * 32); });
    });
    at(2350, function () {
      tween(ringEl, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0)', opacity: 0 }], 300);
    });
    at(2650, function () { parts.forEach(drop); parts = []; });
    at(end ? end.ms : 2850, finish);
    return true;
  }

  /* ── waking up ──────────────────────────────────────────────────
     The soup ends the trip. You come round on the page, next to the
     two of them, and they tell you what you did — which is the only
     time in the whole act anyone summarises anything, and it works
     because you were not entirely present for most of it. */
  function wake() {
    /* Already woken (the timer and a room entry can both call this): the
       writes below are idempotent, so every call re-arms the save, but
       only the first narration, is-trip removal and settle timer run. */
    var already = NEU.save && !NEU.save.flagged('tripping');
    /* Everything the save needs is written now, not in settle() 26s
       later: a reload in that window would leave the crack unarmed and
       the boss unreachable. Only the DOM and the narration wait. The
       writes never depend on tripping — a bare wake on a fresh boot
       must still arm the crack, chair and dog. */
    if (NEU.save) {
      NEU.save.flag('tripping', 0);
      NEU.save.flag('dog_gone', 1); NEU.save.flag('sans_sits', 1); NEU.save.flag('crack_armed', 1);
    }
    /* The dream is over; the set you put a key through comes back. */
    if (NEU.restoreTV) NEU.restoreTV();
    if (NEU.quest) { NEU.quest.mark('a4_wake'); NEU.quest.mark('a4_chair'); }
    if (already) return;
    document.body.classList.remove('is-trip');
    document.body.classList.add('is-awake');
    /* The soup drops you in your own bed. The door stays shut (must_leave)
       until you power the console off at the desk: that is rooms-e's job,
       and it calls settle() when it is done. */
    if (NEU.save) NEU.save.flag('must_leave', 1);
    if (NEU.cut && NEU.engine) NEU.cut(function () { NEU.engine.enter('e6_room', 'bed'); });
    else if (NEU.engine) NEU.engine.enter('e6_room', 'bed');
  }

  /* After the soup the page used to say nothing about what came next. A
     small card names the next open objective at the top of the screen; it
     stays until clicked or for twelve seconds. Reduced motion: no fade. */
  function cue() {
    var text = NEU.quest && NEU.quest.nextText ? NEU.quest.nextText() : null;
    if (!text || !document.body) return;
    var old = document.getElementById('w3Cue');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var el = document.createElement('div');
    el.id = 'w3Cue';
    el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:80;' +
      'font:400 16px/1.3 var(--font, monospace);color:#FFFFFF;background:#170D1F;' +
      'border:3px solid #FFD84A;padding:16px 24px;max-width:90vw;text-align:center;cursor:pointer';
    el.textContent = 'next: ' + text;
    var gone = function () { if (el.parentNode) el.parentNode.removeChild(el); };
    el.addEventListener('click', gone);
    document.body.appendChild(el);
    if (el.animate && !document.documentElement.classList.contains('rm')) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'steps(4)' });
    }
    setTimeout(gone, 12000);
  }

  /* The dog leaves, he takes the chair, and the console becomes
     available — the object you spent an act charging is finally his,
     which is the small joke the whole chain has been walking toward. */
  var settled = false;
  function settle() {
    var dog = document.getElementById('dog');
    /* The sleep path hid #dog long before this beat runs, so is-leave on
       its own animated an element nobody could see. Bring him back for
       a beat (is-in), then let him go (is-leave), then hide — once. */
    /* Only a dog that was actually fed ever appears — the 'dog' quest
       mark is what sans.js sets on the first feed. */
    var fedDog = !!(NEU.quest && NEU.quest.has && NEU.quest.has('dog'));
    if (dog && fedDog && !settled) {
      settled = true;
      dog.hidden = false;
      dog.classList.remove('is-leave');
      requestAnimationFrame(function () { dog.classList.add('is-in'); });
      setTimeout(function () {
        dog.classList.remove('is-in');
        dog.classList.add('is-leave');
      }, 400);
      setTimeout(function () {
        dog.hidden = true;
        dog.classList.remove('is-leave', 'is-in');
      }, 400 + 520);
    }
    var sleepDog = document.querySelector('.sleep__dog');
    if (sleepDog) sleepDog.hidden = true;
    var chair = document.getElementById('armchair');
    if (chair) { chair.hidden = false; requestAnimationFrame(function () { chair.classList.add('is-in'); }); }
    if (NEU.crack) NEU.crack.arm();
    if (NEU.sans && NEU.sans.openPanel) NEU.sans.openPanel();
    if (NEU.talk) {
      NEU.talk(['toby gets up and goes. he does not look back, because he is a dog.',
                'he sits down in a chair that was not there a minute ago and turns the console on.',
                'there is a crack in the corner of the panel inside the cube.',
                'there was probably always a crack.'], 'narr');
    }
    cue();
  }

  /* ── the last thing ─────────────────────────────────────────────*/
  function ending() {
    if (NEU.save) NEU.save.flag('act4_done', 1);
    if (NEU.quest) NEU.quest.mark('a4_end');
    if (NEU.talk) {
      NEU.talk([
        "you're back. you've got wall in your hair.",
        "i finished the game while you were in there. it was fine. six out of ten.",
        "got you a hotdog. it's cold. that's not on me, you were gone a while.",
        "so that's the site. that's all of it.",
        "there's nothing else. genuinely. you can stop clicking things now.",
        "...",
        "you're not going to stop clicking things, are you."
      ], 'sans');
    }
  }

  /* A refresh mid-trip must not quietly sober the page up: the flag
     gates progression (rooms-g's axe answers to it), so on load the
     visuals re-arm with the state the file already remembers. */
  if (NEU.save && NEU.save.flagged('tripping')) {
    document.body.classList.add('is-trip');
  }

  /* A refresh after the wake restores the settled scene without
     replaying the narration: the flags are the source of truth. */
  if (NEU.save && NEU.save.flagged('dog_gone')) {
    var _dog = document.getElementById('dog');
    if (_dog) _dog.hidden = true;
    var _sleepDog = document.querySelector('.sleep__dog');
    if (_sleepDog) _sleepDog.hidden = true;
  }
  if (NEU.save && NEU.save.flagged('sans_sits')) {
    var _chair = document.getElementById('armchair');
    if (_chair) { _chair.hidden = false; _chair.classList.add('is-in'); }
  }

  NEU.act4 = {
    open: open, wake: wake, settle: settle, ending: ending, install: install, recall: recall, closeModes: closeModes,
    get start() { return START; },
    get done() { return !!(NEU.save && NEU.save.flagged('act4_done')); },
    steps: STEPS
  };

  /* dev: jump straight in without the console */
  NEU.devAct4 = function (roomId) {
    install();
    NEU.engine.enter(roomId || START, 'default');
  };
})();
