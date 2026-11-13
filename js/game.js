(function () {
'use strict';
var AB = window.AB;
var S = AB.scenes;
AB.VERSION = '1.0.0';

function Game(canvas) {
  this.cv = canvas; this.c = canvas.getContext('2d');
  this.c.imageSmoothingEnabled = false;
  this.t = 0; this.scene = null; this.name = ''; this.fade = 1; this.fadeDir = -1; this.pending = null;
  this.world = null; this.run = null;
  AB.game = this;
}
AB.Game = Game;

/* ---------- scene flow ---------- */
Game.prototype.go = function (name, arg) {
  if (this.pending) return;
  this.pending = { name: name, arg: arg }; this.fadeDir = 1;
};
Game.prototype.later = function (fn) {
  if (this.pending) return;
  this.pending = { fn: fn }; this.fadeDir = 1;
};
Game.prototype.setScene = function (name, arg) {
  if (name === 'resume') { this.scene = S.play; this.name = 'play'; S.play.resume(); AB.input.setTouchVisible(true); return; }
  this.scene = S[name]; this.name = name;
  AB.input.setTouchVisible(name === 'play');
  if (this.scene.enter) this.scene.enter(this, arg);
};
Game.prototype.tick = function () {
  var I = AB.input;
  this.t++; I.poll();
  if (this.fadeDir > 0) {
    this.fade += 0.09;
    if (this.fade >= 1) {
      this.fade = 1; var p = this.pending; this.pending = null; this.fadeDir = -1;
      if (p.fn) p.fn(); else this.setScene(p.name, p.arg);
    }
  } else if (this.fade > 0) this.fade = Math.max(0, this.fade - 0.06);
  if (this.scene && !(this.fadeDir > 0 && this.name !== 'play')) this.scene.update(I);
  I.endStep();
};
Game.prototype.render = function () {
  var c = this.c;
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#000'; c.fillRect(0, 0, AB.W, AB.H);
  if (this.scene) this.scene.draw(c);
  if (this.fade > 0) { c.globalAlpha = this.fade; c.fillStyle = '#06030a'; c.fillRect(0, 0, AB.W, AB.H); c.globalAlpha = 1; }
};
Game.prototype.autoPause = function () {
  if (this.name === 'play' && S.play.pauseMenu === null && this.world && !this.world.modal && !this.world.player.dead) S.play.openPause();
};

/* ---------- runs ---------- */
Game.prototype.startRun = function (lo) {
  var sv = AB.save.data, L = AB.save.level, s = AB.newStats();
  s.maxHp += 12 * L('vit'); s.dmg += 0.05 * L('might'); s.spd += 0.04 * L('nimble');
  s.emberMul += 0.1 * L('lore'); s.revive += L('ash');
  s.flasks = Math.max(1, 2 + L('flask') - (sv.asc >= 3 ? 1 : 0));
  var tier = L('temper');
  this.run = {
    seed: Math.floor(Math.random() * 1e9), stats: s, hp: s.maxHp,
    weapons: [AB.makeWeapon(lo.w0, tier), AB.makeWeapon(lo.w1, tier)], skills: [lo.sk, null],
    flasks: s.flasks, gold: 60 * L('fortune'), embers: 0, kills: 0, time: 0, damageTaken: 0, bossKills: 0,
    boonIds: {}, freeOffer: true, turretLife: 480
  };
  this.go('play', { fresh: true });
};
Game.prototype.stageComplete = function () {
  var self = this, w = this.world, r = this.run;
  if (w.stage >= 2) { this.later(function () { self.finishRun(true); }); return; }
  r.hp = Math.min(r.stats.maxHp, Math.round(w.player.hp + r.stats.maxHp * 0.3));
  r.flasks = Math.min(r.stats.flasks, r.flasks + 1);
  var next = w.stage + 1;
  this.later(function () {
    self.world = new AB.World(self, r, next);
    AB.audio.musicPlay(AB.BIOMES[next].music); AB.audio.setIntensity(0.2);
  });
};
Game.prototype.finishRun = function (win, abandoned) {
  var r = this.run, w = this.world, sv = AB.save.data, st = sv.stats;
  if (!r) { this.go('title'); return; }
  var cleared = win ? 3 : w.stage;
  var earned = r.embers + cleared * 10 + (win ? 150 * (1 + sv.asc) : 0);
  sv.embers += earned; st.runs++; st.totalTime += r.time;
  st.bestStage = Math.max(st.bestStage, win ? 3 : w.stage + 1);
  if (win) { st.wins++; if (!st.bestTime || r.time < st.bestTime) st.bestTime = r.time; } else st.deaths++;
  AB.save.write();
  var res = { win: win, time: r.time, kills: r.kills, bossKills: r.bossKills, gold: r.gold, damage: r.damageTaken, earned: earned,
    where: abandoned ? 'You abandoned the descent' : 'Fallen in ' + AB.BIOMES[Math.min(2, w.stage)].name };
  this.world = null; this.run = null;
  this.pending = null; this.fadeDir = 1; this.pending = { name: 'results', arg: res };
};

/* ===================== PLAY SCENE ===================== */
S.play = {
  pauseMenu: null,
  enter: function (game, arg) {
    this.game = game; this.pauseMenu = null;
    if (arg && arg.fresh) {
      game.world = new AB.World(game, game.run, 0);
      AB.audio.musicPlay(AB.BIOMES[0].music); AB.audio.setIntensity(0.2);
    }
  },
  resume: function () { this.pauseMenu = null; },
  openPause: function () {
    var self = this, g = this.game;
    AB.sfx('click');
    this.pauseMenu = new AB.Menu([
      { label: 'RESUME', act: function () { self.pauseMenu = null; AB.sfx('click'); } },
      { label: 'OPTIONS', act: function () { g.setScene('options', { from: 'pause' }); } },
      { label: 'ABANDON RUN', act: function () { g.finishRun(false, true); } }
    ]);
  },
  update: function (I) {
    var g = this.game, w = g.world;
    if (!w) return;
    if (this.pauseMenu) {
      if (I.pressed('pause') || I.pressed('back')) { this.pauseMenu = null; AB.sfx('click'); return; }
      this.pauseMenu.update(I); return;
    }
    if (w.modal) { AB.Modal.update(w, I); return; }
    if (I.pressed('pause') && !w.player.dead) { this.openPause(); return; }
    w.update(I);
    if (w.over && w.player.dead && w.overT > 170) g.finishRun(false);
  },
  draw: function (c) {
    var g = this.game, w = g.world;
    if (!w) return;
    w.draw(c);
    if (!w.modal) AB.drawHUD(c, w, g);
    if (w.over && w.player.dead && w.overT > 30) {
      var a = Math.min(1, (w.overT - 30) / 90);
      c.fillStyle = 'rgba(20,0,4,' + (a * 0.6) + ')'; c.fillRect(0, 0, AB.W, AB.H);
      c.globalAlpha = a; AB.text(c, 'YOU DIED', AB.W / 2, AB.H / 2 - 16, '#ff4a4a', 5, 'c', '#3a0508'); c.globalAlpha = 1;
    }
    if (w.modal) AB.Modal.draw(c, w);
    if (this.pauseMenu) {
      c.fillStyle = 'rgba(6,3,10,0.7)'; c.fillRect(0, 0, AB.W, AB.H);
      AB.text(c, 'PAUSED', AB.W / 2, 70, '#f0dcb0', 4, 'c', true);
      this.pauseMenu.drawCentered(c, AB.W / 2, 120, 26, 2, 140);
      var r = g.run;
      AB.text(c, 'STAGE ' + (w.stage + 1) + '   ' + AB.fmtTime(r.time) + '   ' + r.kills + ' KILLS', AB.W / 2, AB.H - 24, '#6a6078', 1, 'c', true);
    }
  }
};
})();
