/* Lazy-game prelude: the portfolio shell keeps Sans, the sword and the
   save/quest data, but the 1.6 MB game bundle is only fetched when the
   visitor actually enters the game. Every entry point queues its call and
   the queue replays once the real module has defined its API. */
(function () {
  var NEU = window.NEU = window.NEU || {};
  if (NEU.__gameLazy) return;
  NEU.__gameLazy = true;

  var queue = [], loading = false, loaded = false;
  var URL = window.__NEU_GAME_URL__;

  function real(name, method, args) {
    var api = NEU[name];
    if (api && typeof api[method] === 'function') api[method].apply(api, args);
  }

  function replay() {
    var q = queue; queue = [];
    for (var i = 0; i < q.length; i++) real(q[i][0], q[i][1], q[i][2]);
  }

  function load() {
    if (loaded) { replay(); return; }
    if (loading) return;
    loading = true;
    var s = document.createElement('script');
    s.src = URL;
    s.async = true;
    s.onload = function () {
      loaded = true; loading = false;
      window.__NEU_GAME_READY__ = true;
      replay();
    };
    s.onerror = function () {
      loading = false;
      window.__NEU_GAME_ERROR__ = true;
      if (window.console) console.error('game bundle failed to load:', URL);
    };
    document.head.appendChild(s);
  }
  window.__NEU_GAME_LOAD__ = load;

  function stub(name, state, entries, methods, rets) {
    var api = {}, i;
    rets = rets || {};
    for (i in state) if (Object.prototype.hasOwnProperty.call(state, i)) {
      (function (key, val) {
        Object.defineProperty(api, key, { get: function () { return val; }, enumerable: true });
      })(i, state[i]);
    }
    function call(method, isEntry) {
      return function () {
        var args = Array.prototype.slice.call(arguments);
        if (loaded) { real(name, method, args); return; }
        if (!isEntry && !loading) {
          return Object.prototype.hasOwnProperty.call(rets, method) ? rets[method] : undefined;
        }
        queue.push([name, method, args]);
        if (isEntry) load();
      };
    }
    for (i = 0; i < entries.length; i++) api[entries[i]] = call(entries[i], true);
    for (i = 0; i < methods.length; i++) api[methods[i]] = call(methods[i], false);
    NEU[name] = api;
  }

  /* the only sheets the portfolio shell reads: Sans's two poses */
  NEU.sheets = {
    sansIdle:  { src: 'img/act123/sans-idle.png' },
    sansShrug: { src: 'img/act123/sans-shrug.png' }
  };

  stub('dark',   { running: false, mode: 'off' },
       ['open', 'warp', 'warpSw'], ['close', 'reset']);
  stub('bullet', { running: false, endless: false },
       ['open'], ['close']);
  stub('quiz',   { running: false },
       ['open'], ['close', 'opens']);
  stub('deck',   { running: false },
       ['open'], ['close']);
  stub('act4',   {}, ['install', 'open'], []);
  stub('engine', { running: false },
       ['enter'], ['leave', 'where', 'zone'], { where: null, zone: null });
  stub('scal',   { running: false, active: false, hp: 0, soulHP: 0, tp: 0, box: null },
       ['open'], ['close', 'setHp', 'heal', 'setTp']);
  stub('polt',   { running: false }, ['open'], ['close']);
  stub('rhythm', { running: false }, ['open'], ['close']);
  stub('craft',  { running: false }, ['open'], ['close']);
  stub('shop',   { active: false }, ['open'], ['close']);
})();
