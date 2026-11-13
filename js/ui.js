(function () {
'use strict';
var AB = window.AB;
var S = AB.scenes = {};

/* ===================== MENU HELPER ===================== */
function Menu(items) { this.items = items; this.sel = 0; this.bump = 0; }
AB.Menu = Menu;
Menu.prototype.first = function () { for (var i = 0; i < this.items.length; i++) if (!this.items[i].hidden) return i; return 0; };
Menu.prototype.step = function (d) {
  var n = this.items.length, i = this.sel;
  for (var k = 0; k < n; k++) { i = (i + d + n) % n; if (!this.items[i].hidden) break; }
  if (i !== this.sel) { this.sel = i; AB.sfx('click'); }
};
Menu.prototype.update = function (I) {
  var P = AB.input.pointer, it = this.items[this.sel], i;
  if (I.pressed('up')) this.step(-1);
  if (I.pressed('down')) this.step(1);
  if (P.moved || P.clicked) {
    for (i = 0; i < this.items.length; i++) {
      var r = this.items[i].rect, m = this.items[i];
      if (m.hidden || !r) continue;
      if (P.x >= r.x && P.x < r.x + r.w && P.y >= r.y && P.y < r.y + r.h) {
        if (this.sel !== i) { this.sel = i; AB.sfx('click'); }
        if (P.clicked) {
          if (m.adj && P.x > r.x + r.w * 0.7) { m.adj(1); }
          else if (m.adj && P.x < r.x + r.w * 0.3 && !m.act) { m.adj(-1); }
          else if (m.act) { m.act(); }
          else if (m.adj) { m.adj(1); }
          return true;
        }
      }
    }
  }
  it = this.items[this.sel];
  if (!it) return false;
  if (I.pressed('left') && it.adj) { it.adj(-1); return true; }
  if (I.pressed('right') && it.adj) { it.adj(1); return true; }
  if (I.pressed('confirm') && it.act) { it.act(); return true; }
  return false;
};
// centred big menu
Menu.prototype.drawCentered = function (c, cx, y0, rowH, scale, wide) {
  var row = 0;
  for (var i = 0; i < this.items.length; i++) {
    var it = this.items[i]; if (it.hidden) { it.rect = null; continue; }
    var sel = i === this.sel, y = y0 + (row++) * rowH, label = typeof it.label === 'function' ? it.label() : it.label;
    var w = Math.max(AB.measure(label, scale), wide || 0) + 24;
    it.rect = { x: cx - w / 2, y: y - 3, w: w, h: scale * 8 + 6 };
    if (sel) {
      c.fillStyle = 'rgba(255,170,70,0.12)'; c.fillRect(cx - w / 2, y - 3, w, scale * 8 + 6);
      c.fillStyle = '#ffb04a'; c.fillRect(cx - w / 2, y - 3, 2, scale * 8 + 6); c.fillRect(cx + w / 2 - 2, y - 3, 2, scale * 8 + 6);
      AB.text(c, '>', cx - w / 2 + 8 + Math.round(Math.sin(AB.game.t * 0.15) * 1.5), y, '#ffb04a', scale, 'l', true);
    }
    AB.text(c, label, cx, y, it.disabled ? '#5a5068' : (sel ? '#fff0c8' : '#9a8f9e'), scale, 'c', true);
  }
};

/* ===================== SHARED BACKGROUND ===================== */
function bgParticles(game) {
  if (game.bgp) return game.bgp;
  game.bgp = [];
  for (var i = 0; i < 50; i++) game.bgp.push({ x: Math.random() * AB.W, y: Math.random() * AB.H, z: 0.3 + Math.random(), p: Math.random() * 6 });
  return game.bgp;
}
function drawBg(c, game, bi, dim) {
  var B = AB.BIOMES[bi];
  AB.drawBackdrop(c, B, game.t * 0.35, 40 + Math.sin(game.t * 0.004) * 20, game.t);
  var ps = bgParticles(game), i, q;
  for (i = 0; i < ps.length; i++) {
    q = ps[i]; q.y -= 0.25 * q.z; q.x += Math.sin(game.t * 0.02 + q.p) * 0.25;
    if (q.y < -4) { q.y = AB.H + 4; q.x = Math.random() * AB.W; }
    c.fillStyle = AB.rgba(B.torch, 0.5 + 0.4 * Math.sin(game.t * 0.1 + q.p)); c.fillRect(Math.round(q.x), Math.round(q.y), q.z > 0.9 ? 2 : 1, q.z > 0.9 ? 2 : 1);
  }
  c.fillStyle = 'rgba(4,2,8,' + (dim === undefined ? 0.4 : dim) + ')'; c.fillRect(0, 0, AB.W, AB.H);
  c.drawImage(AB.vignette(), 0, 0);
}
function header(c, title, sub) {
  AB.text(c, title, 24, 16, '#f0dcb0', 2, 'l', true);
  if (sub) AB.text(c, sub, 24, 36, '#8a7f90', 1, 'l', true);
  c.fillStyle = '#6b5a48'; c.fillRect(24, 48, AB.W - 48, 1);
}
function embersTag(c) {
  AB.drawIcon(c, 'ember', AB.W - 100, 14, 1, '#ff9040');
  AB.text(c, AB.save.data.embers, AB.W - 24, 19, '#ffb070', 1, 'r', true);
  AB.text(c, 'EMBERS', AB.W - 104, 19, '#8a7f90', 1, 'r', true);
}
function hintBar(c, str) { AB.text(c, str, AB.W / 2, AB.H - 14, '#6a6078', 1, 'c', true); }
function backBtn(c, scene) {
  scene.backRect = { x: 8, y: AB.H - 24, w: 44, h: 16 };
  AB.panel(c, 8, AB.H - 24, 44, 16, '#1c1420', '#6b5a48'); AB.text(c, 'BACK', 30, AB.H - 20, '#d8cfc0', 1, 'c', true);
}
function backClicked(scene) {
  var P = AB.input.pointer, r = scene.backRect;
  return P.clicked && r && P.x >= r.x && P.x < r.x + r.w && P.y >= r.y && P.y < r.y + r.h;
}
var kbHint = function () { return AB.input.lastDevice === 'touch' ? '' : (AB.input.lastDevice === 'pad' ? 'STICK select   A confirm   B back' : 'ARROWS select   ENTER confirm   ESC back'); };

/* ===================== TITLE ===================== */
S.title = {
  enter: function (game) {
    var self = this; this.game = game;
    AB.audio.musicPlay('title'); AB.audio.setIntensity(0.2);
    this.menu = new Menu([
      { label: 'DESCEND', act: function () { game.go('loadout'); AB.sfx('confirm'); } },
      { label: 'THE FORGE', act: function () { game.go('forge'); AB.sfx('confirm'); } },
      { label: 'OPTIONS', act: function () { game.go('options', { from: 'title' }); AB.sfx('confirm'); } },
      { label: 'CHRONICLE', act: function () { game.go('stats'); AB.sfx('confirm'); } }
    ]);
    if (AB.canFullscreen && AB.canFullscreen()) this.menu.items.push({ label: 'FULLSCREEN', act: function () { AB.toggleFullscreen(); } });
    this.sparks = [];
  },
  update: function (I) { this.menu.update(I); },
  draw: function (c) {
    var g = this.game, t = g.t;
    drawBg(c, g, 0, 0.3);
    var fl = 0.5 + 0.12 * Math.sin(t * 0.07) + 0.06 * Math.sin(t * 0.23);
    AB.glow(c, AB.W / 2, 74, 150, '#ff6a1a', fl);
    AB.glow(c, AB.W / 2, 78, 80, '#ffd070', fl * 0.5);
    AB.text(c, 'ASHBOUND', AB.W / 2, 50, '#fff0c8', 6, 'c', '#8a2a08');
    AB.text(c, 'ASHBOUND', AB.W / 2, 50, '#ffd9a0', 6, 'c', false);
    c.fillStyle = '#ff9a3a'; c.fillRect(AB.W / 2 - 90, 104, 180, 1);
    AB.text(c, 'A ROGUELITE OF ASH AND EMBERS', AB.W / 2, 112, '#b89a80', 1, 'c', true);
    this.menu.drawCentered(c, AB.W / 2, 134, 20, 2, 120);
    AB.text(c, 'EMBERS ' + AB.save.data.embers, 10, AB.H - 14, '#ffb070', 1, 'l', true);
    AB.text(c, 'V' + AB.VERSION, AB.W - 10, AB.H - 14, '#5a5068', 1, 'r', true);
  }
};

/* ===================== FORGE ===================== */
var TABS = ['UPGRADES', 'ARSENAL', 'SKILLS'];
S.forge = {
  enter: function (game) { this.game = game; this.tab = 0; this.sel = 0; this.msg = ''; this.msgT = 0; this.rows = []; AB.audio.musicPlay('title'); },
  list: function () {
    var sv = AB.save.data, out = [], i;
    if (this.tab === 0) {
      for (i = 0; i < AB.FORGE.length; i++) {
        var f = AB.FORGE[i], l = AB.save.level(f.id), maxed = l >= f.max;
        out.push({ name: f.name, icon: f.icon, color: f.color, desc: f.desc, level: l, max: f.max, cost: maxed ? 0 : f.cost(l), done: maxed, kind: 'upg', id: f.id });
      }
    } else if (this.tab === 1) {
      for (i = 0; i < AB.WEAPON_ORDER.length; i++) {
        var id = AB.WEAPON_ORDER[i], w = AB.WEAPONS[id];
        out.push({ name: w.name, icon: w.icon, color: w.color, desc: w.desc, cost: w.cost, done: !!sv.wUnlock[id], kind: 'weapon', id: id });
      }
    } else {
      for (i = 0; i < AB.SKILL_ORDER.length; i++) {
        var sid = AB.SKILL_ORDER[i], s = AB.SKILLS[sid];
        out.push({ name: s.name, icon: s.icon, color: s.color, desc: s.desc, cost: s.cost, done: !!sv.sUnlock[sid], kind: 'skill', id: sid });
      }
    }
    return out;
  },
  buy: function () {
    var rows = this.list(), r = rows[this.sel], sv = AB.save.data;
    if (!r) return;
    if (r.done) { AB.sfx('error'); this.say(r.kind === 'upg' ? 'Fully upgraded' : 'Already unlocked'); return; }
    if (sv.embers < r.cost) { AB.sfx('error'); this.say('Not enough embers'); return; }
    sv.embers -= r.cost;
    if (r.kind === 'upg') sv.upg[r.id] = (sv.upg[r.id] || 0) + 1;
    else if (r.kind === 'weapon') sv.wUnlock[r.id] = 1;
    else sv.sUnlock[r.id] = 1;
    AB.save.write(); AB.sfx('buy'); this.say(r.kind === 'upg' ? 'Upgraded!' : 'Unlocked!'); this.flash = 12;
  },
  say: function (m) { this.msg = m; this.msgT = 90; },
  update: function (I) {
    var g = this.game, P = AB.input.pointer, n = this.list().length, i;
    if (this.msgT > 0) this.msgT--;
    if (this.flash > 0) this.flash--;
    if (I.pressed('back') || backClicked(this)) { g.go('title'); AB.sfx('click'); return; }
    if (I.pressed('up')) { this.sel = (this.sel + n - 1) % n; AB.sfx('click'); }
    if (I.pressed('down')) { this.sel = (this.sel + 1) % n; AB.sfx('click'); }
    if (I.pressed('left')) { this.tab = (this.tab + 2) % 3; this.sel = 0; AB.sfx('click'); }
    if (I.pressed('right')) { this.tab = (this.tab + 1) % 3; this.sel = 0; AB.sfx('click'); }
    if (P.moved || P.clicked) {
      for (i = 0; i < 3; i++) { var tr = this.tabRects && this.tabRects[i]; if (tr && P.clicked && P.x >= tr.x && P.x < tr.x + tr.w && P.y >= tr.y && P.y < tr.y + tr.h) { this.tab = i; this.sel = 0; AB.sfx('click'); return; } }
      for (i = 0; i < this.rows.length; i++) {
        var r = this.rows[i];
        if (P.x >= r.x && P.x < r.x + r.w && P.y >= r.y && P.y < r.y + r.h) {
          if (this.sel !== i) { this.sel = i; AB.sfx('click'); }
          else if (P.clicked) this.buy();
          if (P.clicked) this.sel = i;
        }
      }
      var b = this.buyRect;
      if (P.clicked && b && P.x >= b.x && P.x < b.x + b.w && P.y >= b.y && P.y < b.y + b.h) this.buy();
    }
    if (I.pressed('confirm')) this.buy();
  },
  draw: function (c) {
    var g = this.game, sv = AB.save.data, i;
    drawBg(c, g, 1, 0.62);
    header(c, 'THE FORGE', 'Spend embers to grow stronger between descents');
    embersTag(c);
    this.tabRects = [];
    for (i = 0; i < 3; i++) {
      var tx = 24 + i * 96, on = i === this.tab;
      this.tabRects.push({ x: tx, y: 54, w: 92, h: 16 });
      AB.panel(c, tx, 54, 92, 16, on ? '#2a2030' : '#15101a', on ? '#e8c880' : '#4a4054');
      AB.text(c, TABS[i], tx + 46, 58, on ? '#ffe9a8' : '#8a7f90', 1, 'c', true);
    }
    var rows = this.list(), rh = 18; this.rows = [];
    for (i = 0; i < rows.length; i++) {
      var r = rows[i], y = 76 + i * (rh + 2), sel = i === this.sel;
      this.rows.push({ x: 24, y: y, w: 220, h: rh });
      c.fillStyle = sel ? 'rgba(255,170,70,0.16)' : 'rgba(255,255,255,0.03)'; c.fillRect(24, y, 220, rh);
      if (sel) { c.fillStyle = '#ffb04a'; c.fillRect(24, y, 2, rh); }
      c.globalAlpha = r.done && r.kind !== 'upg' ? 0.6 : 1;
      AB.drawIcon(c, r.icon, 30, y + 1, 1, r.color);
      AB.text(c, r.name, 52, y + 5, sel ? '#fff0c8' : '#b8aea6', 1, 'l', true);
      c.globalAlpha = 1;
      if (r.kind === 'upg') {
        for (var p = 0; p < r.max; p++) { c.fillStyle = p < r.level ? r.color : '#2a2430'; c.fillRect(160 + p * 6, y + 3, 4, 6); }
        if (!r.done) { AB.drawIcon(c, 'ember', 196, y + 4, 0.6, '#ff9040'); AB.text(c, r.cost, 238, y + 6, sv.embers >= r.cost ? '#ffb070' : '#ff6a6a', 1, 'r', true); }
        else AB.text(c, 'MAX', 238, y + 6, '#7affb0', 1, 'r', true);
      } else if (r.done) AB.text(c, 'OWNED', 238, y + 6, '#7affb0', 1, 'r', true);
      else { AB.drawIcon(c, 'ember', 196, y + 4, 0.6, '#ff9040'); AB.text(c, r.cost, 238, y + 6, sv.embers >= r.cost ? '#ffb070' : '#ff6a6a', 1, 'r', true); }
    }
    // detail
    var cur = rows[this.sel], dx = 262, dw = 194;
    AB.panel(c, dx, 76, dw, 150, '#15101a', '#6b5a48');
    if (cur) {
      if (this.flash > 0) AB.glow(c, dx + 36, 106, 50, cur.color, this.flash / 12 * 0.6);
      AB.drawIcon(c, cur.icon, dx + 12, 88, 3, cur.color);
      AB.paragraph(c, cur.name, dx + 70, 92, 18, '#f0e4d0', 1, 10);
      if (cur.kind === 'upg') AB.text(c, 'LEVEL ' + cur.level + '/' + cur.max, dx + 70, 112, cur.color, 1, 'l', true);
      else AB.text(c, cur.kind.toUpperCase(), dx + 70, 112, '#8a7f90', 1, 'l', true);
      var ln = AB.paragraph(c, cur.desc, dx + 12, 142, 29, '#c8beb0', 1, 10);
      if (cur.kind === 'weapon') {
        var ls = AB.weaponLines(AB.makeWeapon(cur.id, 0));
        for (i = 0; i < ls.length; i++) AB.text(c, ls[i], dx + 12, 142 + ln * 10 + 6 + i * 10, '#d8e8c0', 1, 'l', true);
      } else if (cur.kind === 'skill') AB.text(c, 'COOLDOWN ' + (AB.SKILLS[cur.id].cd / 60).toFixed(0) + 'S', dx + 12, 142 + ln * 10 + 6, '#d8e8c0', 1, 'l', true);
      this.buyRect = { x: dx + 12, y: 204, w: dw - 24, h: 16 };
      var can = !cur.done && sv.embers >= cur.cost;
      AB.panel(c, dx + 12, 204, dw - 24, 16, can ? '#3a2410' : '#1c1420', can ? '#ffb04a' : '#4a4054');
      AB.text(c, cur.done ? (cur.kind === 'upg' ? 'FULLY UPGRADED' : 'UNLOCKED') : (can ? 'BUY' : 'NEED ' + cur.cost + ' EMBERS'), dx + dw / 2, 208, can ? '#ffe9a8' : '#6a6078', 1, 'c', true);
    }
    if (this.msgT > 0) AB.text(c, this.msg, 359, 232, '#ffd0a0', 1, 'c', true);
    hintBar(c, AB.input.lastDevice === 'touch' ? '' : 'UP/DOWN select   LEFT/RIGHT tab   ENTER buy   ESC back');
    backBtn(c, this);
  }
};

/* ===================== LOADOUT ===================== */
S.loadout = {
  enter: function (game) {
    var self = this; this.game = game; var sv = AB.save.data;
    this.w0 = sv.lastW0 && sv.wUnlock[sv.lastW0] ? sv.lastW0 : 'ashblade';
    this.w1 = sv.lastW1 && sv.wUnlock[sv.lastW1] && sv.lastW1 !== this.w0 ? sv.lastW1 : 'hunterbow';
    this.sk = sv.lastSk && sv.sUnlock[sv.lastSk] ? sv.lastSk : 'firebomb';
    this.maxAsc = Math.min(5, sv.stats.wins);
    if (sv.asc > this.maxAsc) sv.asc = this.maxAsc;
    function cyc(list, cur, d, skip) {
      var i = list.indexOf(cur), n = list.length;
      for (var k = 0; k < n; k++) { i = (i + d + n) % n; if (!skip || list[i] !== skip) break; }
      return list[i];
    }
    function owned(order, tbl) { return order.filter(function (id) { return tbl[id]; }); }
    this.menu = new Menu([
      { label: function () { return 'PRIMARY    < ' + AB.WEAPONS[self.w0].name.toUpperCase() + ' >'; }, adj: function (d) { self.w0 = cyc(owned(AB.WEAPON_ORDER, sv.wUnlock), self.w0, d, self.w1); AB.sfx('click'); } },
      { label: function () { return 'SECONDARY  < ' + AB.WEAPONS[self.w1].name.toUpperCase() + ' >'; }, adj: function (d) { self.w1 = cyc(owned(AB.WEAPON_ORDER, sv.wUnlock), self.w1, d, self.w0); AB.sfx('click'); } },
      { label: function () { return 'SKILL      < ' + AB.SKILLS[self.sk].name.toUpperCase() + ' >'; }, adj: function (d) { self.sk = cyc(owned(AB.SKILL_ORDER, sv.sUnlock), self.sk, d); AB.sfx('click'); } },
      { label: function () { return 'ASCENSION  < ' + sv.asc + ' >'; }, hidden: this.maxAsc < 1, adj: function (d) { sv.asc = AB.clamp(sv.asc + d, 0, self.maxAsc); AB.sfx('click'); } },
      { label: 'BEGIN DESCENT', act: function () { sv.lastW0 = self.w0; sv.lastW1 = self.w1; sv.lastSk = self.sk; AB.save.write(); AB.sfx('confirm'); game.startRun({ w0: self.w0, w1: self.w1, sk: self.sk }); } }
    ]);
    this.menu.sel = 4;
    AB.audio.musicPlay('title');
  },
  update: function (I) {
    if (I.pressed('back') || backClicked(this)) { this.game.go('title'); AB.sfx('click'); return; }
    this.menu.update(I);
  },
  draw: function (c) {
    var g = this.game, sv = AB.save.data;
    drawBg(c, g, 2, 0.6);
    header(c, 'PREPARE', 'Choose your arms before the descent');
    this.menu.drawCentered(c, AB.W / 2, 58, 17, 1, 240);
    var cur = [this.w0, this.w1], i;
    for (i = 0; i < 2; i++) {
      var wp = AB.makeWeapon(cur[i], 0), x = 60 + i * 190;
      AB.panel(c, x, 140, 170, 78, '#15101a', '#4a4054');
      AB.drawIcon(c, wp.icon, x + 10, 148, 2.4, wp.color);
      AB.text(c, wp.name, x + 56, 148, '#f0e4d0', 1, 'l', true);
      var ls = AB.weaponLines(wp);
      for (var k = 0; k < ls.length && k < 4; k++) AB.text(c, ls[k], x + 56, 161 + k * 10, '#c8beb0', 1, 'l', true);
      AB.paragraph(c, wp.desc, x + 10, 190, 26, '#7a7088', 1, 9);
    }
    var s = AB.SKILLS[this.sk];
    AB.panel(c, 60, 226, 360, 20, '#15101a', '#4a4054');
    AB.drawIcon(c, s.icon, 66, 227, 1, s.color); AB.text(c, s.name + ': ' + s.desc, 88, 232, '#c8beb0', 1, 'l', true);
    if (sv.asc > 0) AB.text(c, 'ASCENSION ' + sv.asc + ': ' + AB.ASCENSIONS[Math.min(5, sv.asc)], AB.W - 24, 36, '#ff8a6a', 1, 'r', true);
    hintBar(c, AB.input.lastDevice === 'touch' ? '' : 'UP/DOWN select   LEFT/RIGHT change   ENTER begin   ESC back');
    backBtn(c, this);
  }
};

/* ===================== OPTIONS ===================== */
S.options = {
  enter: function (game, arg) {
    var self = this, o = AB.save.data.opt; this.game = game; this.from = (arg && arg.from) || 'title'; this.confirmReset = 0;
    function pct(k) { return function () { return Math.round(o[k] * 100) + '%'; }; }
    function slider(k, d) { o[k] = AB.clamp(Math.round((o[k] + d * 0.1) * 10) / 10, 0, 1); AB.audio.applyVol(); AB.sfx('click'); AB.save.write(); }
    var shakeV = [0, 0.5, 1], touchV = ['auto', 'on', 'off'];
    this.menu = new Menu([
      { label: function () { return 'MUSIC      < ' + pct('music')() + ' >'; }, adj: function (d) { slider('music', d); } },
      { label: function () { return 'EFFECTS    < ' + pct('sfx')() + ' >'; }, adj: function (d) { slider('sfx', d); } },
      { label: function () { return 'SCREEN SHAKE < ' + (o.shake === 0 ? 'OFF' : (o.shake < 1 ? 'LOW' : 'FULL')) + ' >'; }, adj: function (d) { var i = shakeV.indexOf(o.shake); if (i < 0) i = 2; o.shake = shakeV[(i + d + 3) % 3]; AB.sfx('click'); AB.save.write(); } },
      { label: function () { return 'SCREEN FLASH < ' + (o.flash ? 'ON' : 'OFF') + ' >'; }, adj: function () { o.flash = o.flash ? 0 : 1; AB.sfx('click'); AB.save.write(); } },
      { label: function () { return 'DAMAGE NUMBERS < ' + (o.dmgnum ? 'ON' : 'OFF') + ' >'; }, adj: function () { o.dmgnum = o.dmgnum ? 0 : 1; AB.sfx('click'); AB.save.write(); } },
      { label: function () { return 'TOUCH CONTROLS < ' + o.touch.toUpperCase() + ' >'; }, adj: function (d) { var i = touchV.indexOf(o.touch); o.touch = touchV[(i + d + 3) % 3]; AB.input.refreshTouchMode(); AB.sfx('click'); AB.save.write(); } },
      { label: function () { return 'VIBRATION < ' + (o.vib ? 'ON' : 'OFF') + ' >'; }, adj: function () { o.vib = o.vib ? 0 : 1; AB.sfx('click'); AB.save.write(); } },
      { label: function () { return self.confirmReset ? 'PRESS AGAIN TO ERASE SAVE' : 'RESET PROGRESS'; }, act: function () {
        if (!self.confirmReset) { self.confirmReset = 240; AB.sfx('error'); } else { AB.save.reset(); self.confirmReset = 0; AB.sfx('die'); }
      } },
      { label: 'BACK', act: function () { self.exit(); } }
    ]);
    if (AB.canFullscreen && AB.canFullscreen()) this.menu.items.splice(7, 0, { label: function () { return 'FULLSCREEN < ' + (AB.isFullscreen() ? 'ON' : 'OFF') + ' >'; }, adj: function () { AB.toggleFullscreen(); }, act: function () { AB.toggleFullscreen(); } });
  },
  exit: function () { AB.save.write(); AB.sfx('click'); this.game.go(this.from === 'pause' ? 'resume' : 'title'); },
  update: function (I) {
    if (this.confirmReset > 0) this.confirmReset--;
    if (I.pressed('back') || I.pressed('pause') && this.from === 'pause') { this.exit(); return; }
    this.menu.update(I);
  },
  draw: function (c) {
    var g = this.game;
    if (this.from === 'pause' && g.world) { g.world.draw(c); c.fillStyle = 'rgba(6,3,10,0.8)'; c.fillRect(0, 0, AB.W, AB.H); }
    else drawBg(c, g, 0, 0.6);
    header(c, 'OPTIONS');
    this.menu.drawCentered(c, AB.W / 2, 62, 19, 1, 260);
    hintBar(c, AB.input.lastDevice === 'touch' ? '' : 'UP/DOWN select   LEFT/RIGHT change   ESC back');
  }
};

/* ===================== STATS ===================== */
S.stats = {
  enter: function (game) { this.game = game; },
  update: function (I) { if (I.pressed('back') || I.pressed('confirm') || backClicked(this)) { this.game.go('title'); AB.sfx('click'); } },
  draw: function (c) {
    var st = AB.save.data.stats;
    drawBg(c, this.game, 1, 0.65);
    header(c, 'CHRONICLE', 'The tale of your descents so far');
    var rows = [['Descents begun', st.runs], ['Victories', st.wins], ['Deaths', st.deaths], ['Foes slain', st.kills], ['Guardians felled', st.bossKills],
      ['Deepest stage', st.bestStage || '-'], ['Fastest victory', st.bestTime ? AB.fmtTime(st.bestTime) : '-'], ['Time in the dark', AB.fmtTime(st.totalTime)]];
    AB.panel(c, 100, 64, 280, rows.length * 18 + 16, '#15101a', '#6b5a48');
    for (var i = 0; i < rows.length; i++) {
      AB.text(c, rows[i][0], 118, 76 + i * 18, '#a89e98', 1, 'l', true);
      AB.text(c, rows[i][1], 362, 76 + i * 18, '#ffe9a8', 1, 'r', true);
    }
    hintBar(c, AB.input.lastDevice === 'touch' ? '' : 'ESC back');
    backBtn(c, this);
  }
};

/* ===================== RESULTS ===================== */
S.results = {
  enter: function (game, arg) {
    var self = this; this.game = game; this.r = arg; this.t = 0; this.count = 0;
    this.tip = AB.pick(AB.TIPS);
    AB.audio.musicPlay('title'); AB.audio.setIntensity(0.1);
    if (arg.win) AB.sfx('win');
    this.menu = new Menu([
      { label: 'DESCEND AGAIN', act: function () { game.go('loadout'); AB.sfx('confirm'); } },
      { label: 'THE FORGE', act: function () { game.go('forge'); AB.sfx('confirm'); } },
      { label: 'TITLE', act: function () { game.go('title'); AB.sfx('click'); } }
    ]);
  },
  update: function (I) {
    this.t++;
    if (this.count < this.r.earned && this.t > 40) { this.count = Math.min(this.r.earned, this.count + Math.max(1, Math.ceil(this.r.earned / 90))); if (this.t % 3 === 0) AB.sfx('ember'); }
    if (this.t > 60) this.menu.update(I);
  },
  draw: function (c) {
    var r = this.r, g = this.game;
    drawBg(c, g, r.win ? 2 : 1, 0.62);
    if (r.win) AB.glow(c, AB.W / 2, 44, 120, '#ffd070', 0.5);
    AB.text(c, r.win ? 'VICTORY' : 'YOU DIED', AB.W / 2, 22, r.win ? '#ffe9a8' : '#ff5a5a', 4, 'c', r.win ? '#7a4a08' : '#4a0808');
    AB.text(c, r.win ? 'The Frost Sovereign falls. The ash settles.' : (r.where || ''), AB.W / 2, 58, '#a89e98', 1, 'c', true);
    var rows = [['Time', AB.fmtTime(r.time)], ['Foes slain', r.kills], ['Guardians felled', r.bossKills], ['Gold gathered', r.gold], ['Damage taken', r.damage]];
    AB.panel(c, 130, 74, 220, rows.length * 14 + 40, '#15101a', '#6b5a48');
    for (var i = 0; i < rows.length; i++) {
      AB.text(c, rows[i][0], 144, 84 + i * 14, '#a89e98', 1, 'l', true);
      AB.text(c, rows[i][1], 336, 84 + i * 14, '#f0e4d0', 1, 'r', true);
    }
    var ey = 84 + rows.length * 14 + 6;
    c.fillStyle = '#4a4054'; c.fillRect(144, ey - 3, 192, 1);
    AB.drawIcon(c, 'ember', 144, ey + 2, 1, '#ff9040');
    AB.text(c, 'EMBERS BANKED', 164, ey + 6, '#ffb070', 1, 'l', true);
    AB.text(c, '+' + this.count, 336, ey + 6, '#ffd0a0', 1, 'r', true);
    this.menu.drawCentered(c, AB.W / 2, 194, 17, 1, 160);
    AB.paragraph(c, 'TIP: ' + this.tip, AB.W / 2, 250, 70, '#6a6078', 1, 10, 'c');
  }
};
})();
