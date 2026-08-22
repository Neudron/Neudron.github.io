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

  var START = 'a1_clearing';

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
    var room = resume ? s.room : START;
    var spawn = resume ? (s.spawn || 'default') : 'default';

    if (room !== START && NEU.talk) {
      NEU.talk(['you were already somewhere. you are there again.'], 'narr');
    }
    return NEU.engine.enter(room, spawn);
  }

  /* ── waking up ──────────────────────────────────────────────────
     The soup ends the trip. You come round on the page, next to the
     two of them, and they tell you what you did — which is the only
     time in the whole act anyone summarises anything, and it works
     because you were not entirely present for most of it. */
  function wake() {
    document.body.classList.remove('is-trip');
    if (NEU.save) NEU.save.flag('tripping', 0);
    if (NEU.quest) NEU.quest.mark('a4_wake');
    var lines = [
      ["you're awake.", 'sans'],
      ["you've been out about four hours. toby sat with you.", 'sans'],
      ["you fought a witch. you took her ashes. you went through a door made of fire.", 'sans'],
      ["you bought a potion off a man who doesn't own a shop.", 'sans'],
      ["you went home. you broke a television. you did a quiz.", 'sans'],
      ["then you punched a vending machine and ate something you found in it.", 'sans'],
      ["the soup was your idea. i want that on the record.", 'sans'],
      ["anyway. i'm going to sit down.", 'sans']
    ];
    if (NEU.talk) NEU.talk(lines.map(function (l) { return l[0]; }), 'sans');
    setTimeout(settle, lines.length * 3200);
  }

  /* The dog leaves, he takes the chair, and the console becomes
     available — the object you spent an act charging is finally his,
     which is the small joke the whole chain has been walking toward. */
  function settle() {
    if (NEU.save) { NEU.save.flag('dog_gone', 1); NEU.save.flag('sans_sits', 1); }
    if (NEU.quest) NEU.quest.mark('a4_chair');
    var dog = document.getElementById('dog');
    if (dog) { dog.classList.remove('is-in'); setTimeout(function () { dog.hidden = true; }, 520); }
    var chair = document.getElementById('armchair');
    if (chair) { chair.hidden = false; requestAnimationFrame(function () { chair.classList.add('is-in'); }); }
    if (NEU.crack) NEU.crack.arm();
    if (NEU.talk) {
      NEU.talk(['toby gets up and goes. he does not look back, because he is a dog.',
                'he sits down in a chair that was not there a minute ago and turns the console on.',
                'there is a crack in the corner of the panel inside the cube.',
                'there was probably always a crack.'], 'narr');
    }
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

  NEU.act4 = {
    open: open, wake: wake, settle: settle, ending: ending,
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
