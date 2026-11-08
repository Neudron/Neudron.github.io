/* shop.js — the stall, as a scene.
   ───────────────────────────────────────────────────────────────
   The merchant stands behind his counter in the look he has outside
   (NEU.engineLook.drawProp), so he stays on screen while the menu is
   up. Under the picture: BUY, TALK, SELL, MORE, EXIT. Arrows move,
   Z selects, X goes back (from the top menu, X leaves the stall).

   The axe is never an instant grant. handover() walks him behind the
   counter, has him stoop for it, brings it up, and passes it across
   the counter. The item is given when the hand-off lands.            */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};

  var wrap = document.getElementById('shop');
  if (!wrap) {
    NEU.shop = {
      open: function () {}, close: function () {},
      buy: function () { return false; }, sell: function () { return false; },
      handover: function (id, cb) { if (NEU.save) NEU.save.give(id); if (cb) cb(); }
    };
    return;
  }
  var boardEl = document.getElementById('shopBoard');
  var sayEl = document.getElementById('shopSay');
  var goldEl = document.getElementById('shopGold');
  var keysEl = wrap.querySelector('.shop__keys');
  var quitBtn = document.getElementById('shopQuit');

  var KINDS = { melee: 1, ranged: 1, spell: 1, heal: 1 };
  var MENU = [
    { id: 'buy', label: 'BUY' }, { id: 'talk', label: 'TALK' }, { id: 'sell', label: 'SELL' },
    { id: 'more', label: 'MORE' }, { id: 'exit', label: 'EXIT' }
  ];
  var TALK = [
    'he says the canal is not a canal. he is sure of it.',
    'the weather here is always about to rain. he has stopped being disappointed by it.',
    'do not ask him about the axe. he will tell you about the axe.'
  ];
  var MORE = [
    'rusty. bent. yours.',
    'the other half of the map is the half you need.',
    'do not open the jar in doors.',
    'it pulls you back to the last place you were safe.',
    'one sock. the dry one.',
    'no refunds on the promise. none on the stall either.'
  ];
  var OPEN_LINE = 'the board. take what you want. he does not care.';
  var FIRST_LINE = "everything on the board, nothing behind it. don't ask about the axe.";
  var HANDED_LINE = 'he hands you the axe. the stall is open, if you have coins.';

  /* ── scene geometry (320 x 180 logical pixels) ───────────────── */
  var W = 320, H = 180, COUNTER_Y = 120;
  var HOME = { x: 128, y: 152 };         /* merchant's feet, behind the counter (head clears the top) */
  var STOOP = { x: 236, dip: 14 };       /* where he crouches for the axe */
  var AXE_ON = { x: 268, y: 105 };       /* the axe on the counter, right of the till */
  var HOLD = { x: 34, y: -62 };          /* the axe in his right hand, from his feet */
  var HAND = { x: 190, y: 100 };         /* where the axe is passed across */
  var DONE_AT = 3.4;                     /* seconds, the hand-off */

  var canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  canvas.className = 'shop__scene';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'the merchant behind his counter');
  if (sayEl) wrap.querySelector('.shop__win').insertBefore(canvas, sayEl);
  var g = canvas.getContext ? canvas.getContext('2d') : null;
  var axeImg = new Image();
  axeImg.src = 'img/act4/terraria/axe.png';
  var plantImg = new Image();
  plantImg.src = 'img/act4/undertale/plant.png';

  var sel = 0;
  var mode = 'main';
  var moreI = 0, talkI = 0;
  var active = false;
  /* The element that had focus when the board opened. close() hands focus
     back to it, so a keyboard player lands where they came from. */
  var returnTo = null;
  /* the input claim the stall displaced (the rhythm fight, when the hand-over runs there) */
  var prevClaim = null;
  /* the key event that opened the stall (the Z that talked to him). It is still
     being dispatched when the stall's own listener sees it, so it must not act. */
  var openedBy = null;
  /* the hand-off in progress: { t, id, cb } or null */
  var anim = null;
  var last = 0;

  function reduced() {
    try {
      if (NEU.motion && NEU.motion.reduced) return !!NEU.motion.reduced();
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  function say(msg) {
    if (sayEl) sayEl.textContent = msg || '';
  }

  function ease(u) { u = u < 0 ? 0 : (u > 1 ? 1 : u); return u * u * (3 - 2 * u); }
  function lerp(a, b, u) { return a + (b - a) * u; }

  function rect(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); }

  function bottle(x, y, c) {
    rect(x, y, 8, 10, '#0A0810');
    rect(x + 1, y + 1, 6, 8, c);
    rect(x + 2, y, 4, 1, '#0A0810');
    rect(x + 1, y + 2, 1, 5, '#FFFFFF');
  }
  function shelf(x, y, w) {
    var k, cols = ['#9FE0FF', '#7BE38A', '#E4C46A', '#FF8ACF'];
    rect(x, y, w, 3, '#6B4423');
    rect(x, y + 3, w, 1, '#3A2414');
    for (k = 0; k + 12 <= w; k += 12) bottle(x + 3 + k, y - 9, cols[(k / 12 + x) % 4]);
  }

  /* His sleeve, a stepped line of 5px blocks from the shoulder to the grip, with a
     bare hand at the end. Drawn before the counter so the counter hides its root. */
  function arm(x0, y0, x1, y1) {
    var n = Math.max(2, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / 4)), i, x, y;
    for (i = 0; i <= n; i++) {
      x = x0 + (x1 - x0) * i / n; y = y0 + (y1 - y0) * i / n;
      rect(x - 4, y - 4, 8, 8, '#120F18');
    }
    for (i = 0; i <= n; i++) {
      x = x0 + (x1 - x0) * i / n; y = y0 + (y1 - y0) * i / n;
      rect(x - 3, y - 3, 6, 6, i === n ? '#E8DCC8' : '#B8923E');
    }
  }

  /* The merchant, drawn at scene resolution. It is the man from the room (rooms-d,
     look 'merchant'): gold brimmed hat, pale face with the two pale eyes, gold cloak
     over a brown front panel, dark outline. (cx, fy) is the centre of his feet. */
  var M = { k: '#2A1E14', hat: '#E4C46A', hatHi: '#F4DE92', hatLo: '#A8842E', band: '#8A2E40',
            skin: '#E8DCC8', skinLo: '#BFAF98', eye: '#FFF2C4', pupil: '#2A1E14', stache: '#6B4F2F',
            cloak: '#E4C46A', cloakMid: '#C4A24A', cloakLo: '#8E6E2A', front: '#6B4F2F', frontLo: '#4A3620' };
  function merchant(cx, fy) {
    function R(x, y, w, h, c) { rect(cx + x, fy + y, w, h, c); }
    /* shoulders and cloak */
    R(-42, -52, 84, 56, M.k);
    R(-40, -50, 80, 54, M.cloakMid);
    R(-40, -50, 80, 6, M.cloak);
    R(-40, -50, 6, 54, M.cloak);
    R(30, -44, 10, 48, M.cloakLo);
    R(-14, -52, 28, 56, M.k);
    R(-12, -50, 24, 54, M.front);
    R(-12, -50, 24, 4, M.frontLo);
    R(-2, -50, 4, 54, M.frontLo);
    R(-22, -46, 8, 10, M.cloakLo);
    R(14, -46, 8, 10, M.cloakLo);
    /* neck and head */
    R(-14, -56, 28, 8, M.k);
    R(-12, -56, 24, 6, M.skinLo);
    R(-20, -92, 40, 38, M.k);
    R(-18, -90, 36, 34, M.skin);
    R(-18, -64, 36, 8, M.skinLo);
    R(-18, -90, 36, 8, M.skinLo);
    /* eyes: pale, with a dark pupil each, looking at the player */
    R(-14, -81, 10, 2, M.k); R(-13, -79, 8, 8, M.eye); R(-10, -77, 4, 4, M.pupil);
    R(4, -81, 10, 2, M.k);   R(5, -79, 8, 8, M.eye);   R(8, -77, 4, 4, M.pupil);
    R(-2, -72, 4, 6, M.skinLo);
    /* moustache and mouth */
    R(-12, -64, 24, 6, M.stache);
    R(-12, -64, 24, 2, M.k);
    R(-4, -58, 8, 2, M.k);
    /* the hat: brim, crown, band */
    R(-34, -98, 68, 10, M.k);
    R(-32, -96, 64, 6, M.hat);
    R(-32, -96, 64, 2, M.hatHi);
    R(-32, -92, 64, 2, M.hatLo);
    R(-22, -122, 44, 26, M.k);
    R(-20, -120, 40, 22, M.hat);
    R(-20, -120, 40, 4, M.hatHi);
    R(-20, -120, 4, 22, M.hatHi);
    R(12, -118, 8, 20, M.hatLo);
    R(-20, -104, 40, 6, M.band);
    R(-20, -104, 40, 2, '#B2455A');
    R(-4, -104, 8, 6, '#E4C46A');
  }

  /* The room: wall, bunting, lamp, shelves, merchant, counter, bell. The
     merchant is drawn before the counter so the counter hides his legs. */
  function drawScene(p) {
    var i, j, x, c, bunt = ['#E0304A', '#E4C46A', '#7BE38A', '#4AC2E0'];
    var brick = ['#2C2244', '#302649', '#281E3C'];
    if (!g) return;
    g.imageSmoothingEnabled = false;
    /* wall: stone courses, a mortar base and bricks in three tones */
    rect(0, 0, W, COUNTER_Y, '#15102A');
    for (j = 0; j < 13; j++) {
      for (x = -(j % 2) * 10; x < W; x += 20) {
        c = brick[(j * 2 + ((x + 20) / 20 | 0)) % 3];
        rect(x + 1, 16 + j * 8, 18, 7, c);
      }
    }
    /* the bunting hangs from a rope under the top edge */
    rect(0, 14, W, 1, '#3A2A20');
    for (i = 0; i < W; i += 12) rect(i, 8, 1, 6, '#3A2A20');
    for (i = 0; i < W / 12; i++) { rect(i * 12 + 2, 15, 8, 3, bunt[i % 4]); rect(i * 12 + 5, 18, 2, 1, bunt[i % 4]); }
    /* shelves on each wall: the left pair clears the plant and the merchant, the right pair clears his stoop */
    shelf(46, 40, 48); shelf(256, 40, 48);
    shelf(46, 72, 48); shelf(256, 72, 48);
    /* the lamp: a pendant over the till and three dithered rings of light */
    rect(199, 16, 2, 8, '#3A2A20');
    rect(192, 24, 16, 4, '#5A3418');
    rect(194, 28, 12, 2, '#8A5A32');
    rect(198, 30, 4, 2, '#FFE080');
    var lg = g.createRadialGradient(200, 32, 2, 200, 32, 52);
    lg.addColorStop(0, 'rgba(255,208,96,0.30)');
    lg.addColorStop(0.5, 'rgba(255,208,96,0.12)');
    lg.addColorStop(1, 'rgba(255,208,96,0)');
    g.fillStyle = lg; g.fillRect(140, 0, 120, 90);
    merchant(p.mx, p.my);
    if (p.hold) arm(p.mx + 28, p.my - 40, p.ax + 3, p.ay + 7);
    /* the counter: a cloth valance over planks with seams, nails and knots */
    rect(0, COUNTER_Y, W, 2, '#B07A4A');
    rect(0, COUNTER_Y + 2, W, 3, '#8A5A32');
    for (x = 0; x < W; x += 16) {
      rect(x, COUNTER_Y + 5, 16, 4, '#8A2E40');
      rect(x + 12, COUNTER_Y + 5, 4, 4, '#5E1E2C');
      rect(x + 4, COUNTER_Y + 9, 8, 2, '#8A2E40');
    }
    for (x = 0; x < W; x += 20) {
      rect(x, COUNTER_Y + 11, 20, 46, (x / 20) % 2 ? '#5A3418' : '#4E2D14');
      rect(x + 19, COUNTER_Y + 11, 1, 46, '#2E1A0C');
      rect(x + 2, COUNTER_Y + 14, 1, 1, '#C8A04A');
      rect(x + 16, COUNTER_Y + 14, 1, 1, '#C8A04A');
      rect(x + 5 + (x / 20 % 3), COUNTER_Y + 30 + (x / 20 % 2) * 8, 3, 1, '#3E2410');
    }
    rect(0, 168, W, 3, '#2E1A0C');
    /* the floor: a checker of worn tiles */
    for (x = 0; x < W; x += 16) rect(x, 171, 16, 9, (x / 16) % 2 ? '#1E161A' : '#241C20');
    /* goods on the counter: the plant, two jars and the till */
    if (plantImg.complete && plantImg.naturalWidth) g.drawImage(plantImg, 8, COUNTER_Y - 68, 32, 68);
    bottle(52, COUNTER_Y - 10, '#9FE0FF');
    bottle(66, COUNTER_Y - 10, '#7BE38A');
    rect(224, COUNTER_Y - 8, 12, 8, '#5A3418');
    rect(226, COUNTER_Y - 8, 8, 3, '#E4C46A');
    rect(228, COUNTER_Y - 10, 4, 2, '#FFE080');
    if (p.show) {
      if (axeImg.complete && axeImg.naturalWidth) g.drawImage(axeImg, p.ax | 0, p.ay | 0, 17, 15);
      else { rect(p.ax, p.ay + 6, 14, 3, '#8A5A32'); rect(p.ax + 2, p.ay, 6, 13, '#C8C8D0'); }
    }
  }

  /* Where everything is at time t of the hand-off. */
  function pose(t) {
    var p = { mx: HOME.x, my: HOME.y, ax: AXE_ON.x, ay: AXE_ON.y, show: true, hold: false };
    if (t < 0.8) p.mx = lerp(HOME.x, STOOP.x, ease(t / 0.8));
    else if (t < 1.4) { p.mx = STOOP.x; p.my = HOME.y + STOOP.dip * ease((t - 0.8) / 0.6); }
    else if (t < 2.0) { p.mx = STOOP.x; p.my = HOME.y + STOOP.dip * (1 - ease((t - 1.4) / 0.6)); }
    else if (t < 2.8) p.mx = lerp(STOOP.x, HOME.x, ease((t - 2.0) / 0.8));
    if (t >= 1.2) { p.ax = p.mx + HOLD.x; p.ay = p.my + HOLD.y; p.hold = true; }
    if (t >= 2.8) {
      p.hold = true;
      var u = ease((t - 2.8) / 0.6);
      p.ax = lerp(HOME.x + HOLD.x, HAND.x, u);
      p.ay = lerp(HOME.y + HOLD.y, HAND.y, u);
    }
    return p;
  }

  function draw() {
    var have = NEU.save ? NEU.save.has('axe') : false;
    var p = anim ? pose(anim.t) : { mx: HOME.x, my: HOME.y, ax: AXE_ON.x, ay: AXE_ON.y, show: !have, hold: false };
    drawScene(p);
  }

  /* The rows of the current menu. */
  function rowsFor() {
    var out = [], i, all, ids, def;
    if (mode === 'main') return MENU.map(function (m) { return { id: m.id, name: m.label, price: '' }; });
    if (mode === 'buy') {
      if (!NEU.save) return out;
      if (!NEU.save.has('recall')) out.push({ id: 'recall', name: 'Recall Potion', price: 'free' });
      all = (NEU.items && NEU.items.all) ? NEU.items.all : [];
      for (i = 0; i < all.length; i++) {
        def = all[i];
        if (KINDS[def.kind] && def.price > 0) out.push({ id: def.id, name: def.name, price: def.price + 'g' });
      }
      return out;
    }
    if (mode === 'sell') {
      if (!NEU.save || !NEU.items || !NEU.items.get) return out;
      ids = NEU.save.items();
      for (i = 0; i < ids.length; i++) {
        def = NEU.items.get(ids[i]);
        if (def && KINDS[def.kind] && def.sell > 0 && !isEquipped(def.id)) out.push({ id: def.id, name: def.name, price: def.sell + 'g' });
      }
      return out;
    }
    return out;
  }

  function isEquipped(id) {
    var eq, k;
    if (!NEU.save || !NEU.save.data) return false;
    eq = NEU.save.data.equip || {};
    for (k in eq) if (eq[k] === id) return true;
    return false;
  }

  /* Rebuilding the rows throws away the focused one. Focus was on the board
     before the rebuild, so it goes back on the cursor row afterwards; an
     arrow key must not drop focus to the body. */
  function render() {
    var list, i, b, name, price, hadFocus;
    if (!boardEl) return;
    list = rowsFor();
    if (sel >= list.length || sel < 0) sel = 0;
    if (goldEl) goldEl.textContent = (NEU.save ? NEU.save.coins() : 0) + 'g';
    if (keysEl) keysEl.textContent = '↑↓ choose · Z select · X back';
    hadFocus = boardEl.contains(document.activeElement);
    boardEl.innerHTML = '';
    for (i = 0; i < list.length; i++) {
      (function (n) {
        b = document.createElement('button');
        b.type = 'button';
        b.className = 'shop__row' + (n === sel ? ' is-sel' : '');
        b.setAttribute('role', 'option');
        name = document.createElement('b');
        name.textContent = list[n].name;
        price = document.createElement('span');
        price.className = 'shop__p';
        price.textContent = list[n].price;
        b.appendChild(name);
        b.appendChild(price);
        b.addEventListener('click', function () { sel = n; confirm(); });
        b.addEventListener('mouseenter', function () { sel = n; markSel(); });
        /* A row that takes focus becomes the cursor. Enter acts on the row the
           player can see focused, so Tab cannot leave the cursor behind. */
        b.addEventListener('focus', function () { if (sel !== n) { sel = n; markSel(); } });
        boardEl.appendChild(b);
      })(i);
    }
    if (hadFocus && boardEl.children[sel]) boardEl.children[sel].focus();
    else if (boardEl.children[sel] && boardEl.children[sel].scrollIntoView) boardEl.children[sel].scrollIntoView({ block: 'nearest' });
    draw();
  }

  /* Moves the highlight without rebuilding the rows, so a focus change
     does not destroy the element that is being focused. */
  function markSel() {
    for (var i = 0; i < boardEl.children.length; i++) {
      if (i === sel) boardEl.children[i].classList.add('is-sel');
      else boardEl.children[i].classList.remove('is-sel');
    }
  }

  function enter(m, line) {
    mode = m; sel = 0;
    say(line);
    render();
  }

  function buy(id) {
    var def;
    if (!NEU.save) return false;
    if (id === 'recall') {
      if (NEU.save.has('recall')) { say('you already have it. the rest is atmosphere.'); return false; }
      NEU.save.give('recall');
      if (NEU.quest) NEU.quest.mark('a4_recall');
      if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
      say('you take the Recall Potion. he does not stop you.');
      return true;
    }
    def = NEU.items && NEU.items.get ? NEU.items.get(id) : null;
    if (!def || !KINDS[def.kind] || !(def.price > 0)) return false;
    if (def.kind !== 'heal' && NEU.save.count(id) > 0) { say('you already carry that.'); return false; }
    if (NEU.save.coins() < def.price || !NEU.save.spend(def.price)) { say('not enough coins.'); return false; }
    NEU.save.give(id);
    say('bought. ' + def.name + '.');
    return true;
  }

  function sell(id) {
    var def, pay;
    def = NEU.items && NEU.items.get ? NEU.items.get(id) : null;
    if (!def || !KINDS[def.kind] || !NEU.save || NEU.save.count(id) < 1) return false;
    if (isEquipped(id)) { say('equipped. unequip first.'); return false; }
    pay = def.sell || 0;
    NEU.save.take(id);
    NEU.save.addCoins(pay);
    say('sold. ' + pay + ' coins.');
    return true;
  }

  function confirm() {
    var list = rowsFor(), row;
    if (anim) return;
    row = list[sel];
    if (!row) { if (mode !== 'main') say('nothing on this shelf.'); render(); return; }
    if (mode === 'main') {
      if (row.id === 'buy') enter('buy', 'what will you buy?');
      else if (row.id === 'sell') enter('sell', 'what will you sell?');
      else if (row.id === 'talk') { say(TALK[talkI % TALK.length]); talkI++; render(); }
      else if (row.id === 'more') { say(MORE[moreI % MORE.length]); moreI++; render(); }
      else close();
      return;
    }
    if (mode === 'buy') buy(row.id);
    else if (mode === 'sell') sell(row.id);
    render();
  }

  function back() {
    if (mode === 'main') { close(); return; }
    mode = 'main'; sel = 0;
    say(OPEN_LINE);
    render();
  }

  function move(d) {
    var n = rowsFor().length;
    if (!n) return;
    sel = (sel + d + n) % n;
    render();
  }

  /* The hand-off. The stall is open while it plays; the item is given at its end. */
  function handover(id, cb) {
    if (anim) return;
    if (!NEU.save || NEU.save.has(id)) { if (cb) cb(); return; }
    if (reduced()) { finish(id, cb); return; }
    if (!active) open(1);
    anim = { t: 0, id: id, cb: cb };
    last = 0;
    say('he goes behind the counter. the axe is back there.');
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(frame);
    else setTimeout(function () { frame(Date.now()); }, 16);
    draw();
  }

  function finish(id, cb) {
    anim = null;
    if (NEU.save) NEU.save.give(id);
    if (NEU.quest && id === 'axe') NEU.quest.mark('a4_axe');
    say(HANDED_LINE);
    render();
    if (cb) cb();
  }

  function tick(dt) {
    var a;
    if (!anim) return;
    if (!(dt >= 0)) dt = 0;
    if (dt > 0.05) dt = 0.05;
    anim.t += dt;
    if (anim.t >= DONE_AT) { a = anim; finish(a.id, a.cb); return; }
    draw();
  }

  /* the clock is read here, not taken from the frame argument: some hosts hand
     every frame the same timestamp, and the hand-off would never move on */
  function frame() {
    var now = performance.now();
    var dt = last ? (now - last) / 1000 : 0;
    last = now;
    tick(dt);
    if (!anim) return;
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(frame);
    else setTimeout(function () { frame(Date.now()); }, 16);
  }

  function open(step) {
    if (!active) { returnTo = document.activeElement; prevClaim = NEU.activeMinigame; openedBy = window.event || null; }
    active = true;
    /* Claim input the same way the fights do: while the stall is up the room
       underneath must not take a step or answer Escape. */
    NEU.activeMinigame = 'shop';
    wrap.hidden = false;
    document.body.classList.add('is-playing');
    if (NEU.quest) NEU.quest.lock(true);
    mode = 'main'; sel = 0;
    say(step === 0 ? FIRST_LINE : OPEN_LINE);
    render();
    /* Focus lands on the first row, where the cursor starts. */
    var first = boardEl.children[0];
    if (first) first.focus();
  }

  function close() {
    var fight = prevClaim === 'rhythm' && NEU.rhythm && NEU.rhythm.close ? NEU.rhythm : null;
    active = false;
    if (NEU.activeMinigame === 'shop') NEU.activeMinigame = null;
    prevClaim = null;
    wrap.hidden = true;
    document.body.classList.remove('is-playing');
    if (NEU.quest) NEU.quest.lock(false);
    /* Focus goes back to the opener if it is still on the page. */
    var back = returnTo;
    returnTo = null;
    if (back && back.focus && document.contains(back)) back.focus();
    /* The post-fight stall was the fight's last screen: leaving it ends the fight
       (rhythm.close hands the room back), with no second menu and no exit prompt. */
    if (fight) { fight.close(); return; }
    /* The stall paused the engine (rooms-d.js calls c.leave() before open).
       Bring it back now, so closing the stall resumes the room. */
    if (NEU.engine && !NEU.engine.running) {
      var w = NEU.engine.where ? NEU.engine.where() : null;
      if (w && w.room) NEU.engine.enter(w.room, w.spawn);
    }
  }

  /* Tab stays on the stall. This is a CAPTURE listener that stops the press,
     the way engine.js confirmExit does. The settings panel owns Tab while open. */
  addEventListener('keydown', function (e) {
    if (e.key === 'Tab') {
      if (wrap.hidden || !active) return;
      if (NEU.settings && NEU.settings.open_) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      var els = Array.prototype.slice.call(wrap.querySelectorAll('button:not(:disabled)'));
      if (!els.length) return;
      var i = Array.prototype.indexOf.call(els, document.activeElement);
      var nx = e.shiftKey ? (i <= 0 ? els.length - 1 : i - 1) : (i + 1) % els.length;
      els[nx].focus();
    }
  }, true);

  addEventListener('keydown', function (e) {
    if (wrap.hidden || !active || e === openedBy) return;
    /* the stall is modal: no key reaches the fight or the room under it */
    e.stopImmediatePropagation();
    if (e.key === 'Escape') { close(); e.preventDefault(); return; }
    if (anim) { e.preventDefault(); return; }
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { move(-1); e.preventDefault(); return; }
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { move(1); e.preventDefault(); return; }
    if (e.key === 'Enter' || e.key === 'z' || e.key === 'Z') { confirm(); e.preventDefault(); return; }
    if (e.key === 'x' || e.key === 'X') { back(); e.preventDefault(); return; }
  });

  if (quitBtn) quitBtn.addEventListener('click', function (e) { if (e) { e.preventDefault(); e.stopPropagation(); } close(); });

  NEU.shop = {
    open: open, close: close, buy: buy, sell: sell, handover: handover, tick: tick, pose: pose,
    get active() { return active; },
    /* same contract as the other scenes — core/touch.js polls it */
    get running() { return active; }
  };
})();
