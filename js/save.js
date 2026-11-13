(function () {
'use strict';
var AB = window.AB;
var KEY = 'ashbound_save_v1';

function defaults() {
  return {
    embers: 0,
    upg: {},
    wUnlock: { ashblade: 1, hunterbow: 1 },
    sUnlock: { firebomb: 1 },
    stats: { runs: 0, wins: 0, kills: 0, deaths: 0, bossKills: 0, bestStage: 0, bestTime: 0, totalTime: 0 },
    opt: { music: 0.6, sfx: 0.8, shake: 1, flash: 1, dmgnum: 1, touch: 'auto', vib: 1 },
    asc: 0,
    seenTut: false
  };
}

function merge(base, over) {
  for (var k in over) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object') merge(base[k], over[k]);
    else base[k] = over[k];
  }
  return base;
}

var S = AB.save = {
  data: defaults(),
  load: function () {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (raw) S.data = merge(defaults(), JSON.parse(raw));
    } catch (e) { S.data = defaults(); }
    return S.data;
  },
  write: function () {
    try { window.localStorage.setItem(KEY, JSON.stringify(S.data)); } catch (e) { /* storage unavailable */ }
  },
  reset: function () {
    var opt = S.data.opt;
    S.data = defaults();
    S.data.opt = opt;
    S.write();
  },
  level: function (id) { return S.data.upg[id] || 0; }
};
})();
