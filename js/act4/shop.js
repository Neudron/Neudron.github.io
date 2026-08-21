/* shop.js — the stall, as a real interface.
   ───────────────────────────────────────────────────────────────────
   The merchant was a text dump: a list read out over six seconds,
   then the Recall Potion was auto-given. The bug tracker asked for
   "an actual menu interface for the merchant with Graphics etc
   similar to undertale, MUST BE A GOOD UI with selectable option,
   price, dialogs etc."

   This is that interface. A board of selectable rows, each with a
   name, a price, and a quip. Arrow keys move a cursor; Enter
   selects; ESC leaves. The Recall Potion is the only thing worth
   buying, and its row glows — the same "lit = the game is pointing
   at this" language the rest of the site already speaks.

   The junk items each have a refusal line, because a shop where
   everything is useful is not a shop, it is a menu.             */

(function () {
  'use strict';
  var NEU = window.NEU = window.NEU || {};

  var wrap = document.getElementById('shop');
  if (!wrap) { NEU.shop = { open: function () {} }; return; }
  var boardEl = document.getElementById('shopBoard');
  var sayEl   = document.getElementById('shopSay');
  var goldEl  = document.getElementById('shopGold');

  var STOCK = [
    { name: 'a bent nail',           price: '2g',     quip: 'rusty. bent. yours.' },
    { name: 'half a map',            price: '5g',     quip: 'the other half is the half you need.' },
    { name: 'a jar of something',    price: '9g',     quip: 'do not open it in doors.' },
    { name: 'Recall Potion',         price: 'free',   glow: true, give: 'recall',
      quip: 'it pulls you back to the last place you were safe.' },
    { name: 'a chair leg',           price: '3g',     quip: 'from a chair that no longer needs it.' },
    { name: 'a working watch, wrong',price: '11g',    quip: 'it works. it is wrong. both are permanent.' },
    { name: 'a sock, dry',          price: '1g',      quip: 'one sock. the dry one.' },
    { name: 'a smaller stall',      price: '40g',     quip: 'a stall you can carry. to sell things. at a stall.' },
    { name: 'a promise',            price: 'free',   quip: 'no refunds on this one.' },
    { name: 'an axe',               price: 'not for sale', quip: 'behind the till. not on the board.' }
  ];

  var sel = 0;
  var active = false;

  function say(msg) {
    if (sayEl) sayEl.textContent = msg || '';
  }

  function render() {
    if (!boardEl) return;
    boardEl.innerHTML = '';
    for (var i = 0; i < STOCK.length; i++) {
      (function (n) {
        var item = STOCK[n];
        var row = document.createElement('button');
        row.className = 'shop__row';
        if (n === sel) row.classList.add('is-sel');
        if (item.glow) row.classList.add('is-glow');
        row.setAttribute('role', 'listitem');
        row.innerHTML = '<b>' + item.name + '</b><span class="shop__p">' + item.price + '</span>';
        row.addEventListener('click', function () { sel = n; render(); select(); });
        row.addEventListener('mouseenter', function () { sel = n; render(); });
        boardEl.appendChild(row);
      })(i);
    }
  }

  function select() {
    var item = STOCK[sel];
    if (item.give) {
      if (NEU.save && NEU.save.has(item.give)) {
        say('you already have it. the rest is atmosphere.');
        return;
      }
      if (NEU.save) NEU.save.give(item.give);
      if (NEU.quest) NEU.quest.mark('a4_recall');
      if (NEU.sfx && NEU.sfx.snap) NEU.sfx.snap();
      say('you take the ' + item.name + '. he does not stop you.');
      return;
    }
    say(item.quip);
  }

  function open(step) {
    active = true;
    wrap.hidden = false;
    document.body.classList.add('is-playing');
    if (NEU.quest) NEU.quest.lock(true);
    sel = 0;
    if (step === 0) {
      say("everything on the board, nothing behind it. don't ask about the axe.");
    } else {
      say('the board. take what you want. he does not care.');
    }
    render();
  }

  function close() {
    active = false;
    wrap.hidden = true;
    document.body.classList.remove('is-playing');
    if (NEU.quest) NEU.quest.lock(false);
    if (NEU.engine) NEU.engine.busy(false);
  }

  /* keyboard */
  addEventListener('keydown', function (e) {
    if (wrap.hidden || !active) return;
    if (e.key === 'Escape') { close(); e.preventDefault(); return; }
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      sel = (sel - 1 + STOCK.length) % STOCK.length; render(); e.preventDefault(); return;
    }
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      sel = (sel + 1) % STOCK.length; render(); e.preventDefault(); return;
    }
    if (e.key === 'Enter') { select(); e.preventDefault(); return; }
  });

  /* quit button */
  var quitBtn = document.getElementById('shopQuit');
  if (quitBtn) quitBtn.addEventListener('click', close);

  NEU.shop = { open: open, close: close, get active() { return active; } };
})();
