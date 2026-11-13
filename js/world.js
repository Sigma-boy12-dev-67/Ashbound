(function () {
'use strict';
var AB = window.AB;
var T = AB.T, TILE = AB.TILE;

function World(game, run, stageIdx) {
  this.game = game; this.run = run; this.stage = stageIdx;
  this.biome = AB.BIOMES[stageIdx];
  this.level = new AB.Level(stageIdx, stageIdx, run.seed + stageIdx * 7919);
  this.level.renderStatic();
  var L = this.level;
  this.player = new AB.Player(run, L.start.x, L.start.y);
  this.enemies = []; this.projs = []; this.particles = []; this.pickups = []; this.texts = [];
  this.props = []; this.inter = []; this.allies = []; this.bolts = []; this.rings = [];
  this.t = 0; this.freeze = 0; this.trauma = 0; this.flashA = 0; this.flashC = '#fff';
  this.cam = { x: 0, y: 0 }; this.slowmo = 0;
  this.banner = null; this.focus = null; this.modal = null; this.killCombo = 0; this.comboT = 0;
  this.toasts = []; this.bossRef = null; this.over = false; this.exitOpen = false;
  this.rng = AB.makeRng(run.seed * 31 + stageIdx);
  this.ash = [];
  for (var i = 0; i < 46; i++) this.ash.push({ x: Math.random() * AB.W, y: Math.random() * AB.H, z: 0.3 + Math.random() * 0.9, ph: Math.random() * 6 });
  this.pickupId = 0;
  this.setup();
  var p = this.player;
  this.cam.x = AB.clamp(p.x - AB.W / 2, 0, L.W * T - AB.W);
  this.cam.y = AB.clamp(p.y - AB.H * 0.62, 0, L.H * T - AB.H);
  this.banner = { title: this.biome.name, sub: this.biome.sub, t: 0, max: 170 };
}
AB.World = World;

World.prototype.setup = function () {
  var L = this.level, i, o;
  for (i = 0; i < L.spawns.length; i++) {
    o = L.spawns[i];
    AB.spawnEnemy(this, o.type, o.x, o.y, { elite: o.elite, patrol: true });
  }
  for (i = 0; i < L.props.length; i++) { o = L.props[i]; this.props.push({ x: o.x - 6, y: o.y - 14, w: 12, h: 14, kind: o.kind, hp: 1, flash: 0 }); }
  for (i = 0; i < L.golds.length; i++) { o = L.golds[i]; for (var k = 0; k < 3; k++) this.pickups.push(this.mkPickup('gold', o.x + (k - 1) * 8, o.y, 4 + this.stage * 2, { still: true })); }
  for (i = 0; i < L.chests.length; i++) { o = L.chests[i]; this.inter.push({ kind: 'chest', x: o.x - 10, y: o.y - 16, w: 20, h: 16, used: false, anim: 0, tier: 0 }); }
  for (i = 0; i < L.npcs.length; i++) {
    o = L.npcs[i];
    var it = { kind: o.kind, x: o.x - 14, y: o.y - 32, w: 28, h: 32, used: false, anim: 0 };
    if (o.kind === 'shop') it.stock = this.makeStock();
    if (o.kind === 'altar') it.offers = this.makeOffers();
    this.inter.push(it);
  }
  if (L.boss) {
    var b = L.boss;
    this.inter.push({ kind: 'portal', x: (b.x0 + b.x1) / 2 - 16, y: b.y - 44, w: 32, h: 44, used: false, hidden: true, anim: 0 });
  }
  if (this.run.freeOffer && this.stage === 0) {
    this.run.freeOffer = false;
    this.pendingOffer = true;
  }
};

/* ---------- offers / stock ---------- */
World.prototype.makeOffers = function () {
  var pool = AB.BOONS.slice(), out = [], rg = this.rng;
  AB.shuffle(pool, rg);
  var have = this.run.boonIds || {};
  for (var i = 0; i < pool.length && out.length < 3; i++) {
    var b = pool[i];
    if ((b.id === 'phoenix' || b.id === 'skyborne') && have[b.id]) continue;
    if (b.rarity === 3 && rg() < 0.6) continue;
    out.push(b);
  }
  return out;
};
World.prototype.randomWeapon = function (tierBonus) {
  var ids = [], sv = AB.save.data;
  for (var i = 0; i < AB.WEAPON_ORDER.length; i++) if (sv.wUnlock[AB.WEAPON_ORDER[i]]) ids.push(AB.WEAPON_ORDER[i]);
  var id = ids[Math.floor(this.rng() * ids.length)];
  var tier = AB.clamp(this.stage + (tierBonus || 0) + (this.rng() < 0.25 ? 1 : 0), 0, 4);
  return AB.makeWeapon(id, tier, this.rng() < 0.55 ? AB.AFFIXES[Math.floor(this.rng() * AB.AFFIXES.length)].id : null);
};
World.prototype.randomSkill = function () {
  var ids = [], sv = AB.save.data;
  for (var i = 0; i < AB.SKILL_ORDER.length; i++) if (sv.sUnlock[AB.SKILL_ORDER[i]] && this.run.skills.indexOf(AB.SKILL_ORDER[i]) < 0) ids.push(AB.SKILL_ORDER[i]);
  return ids.length ? ids[Math.floor(this.rng() * ids.length)] : null;
};
World.prototype.makeStock = function () {
  var s = this.stage, out = [];
  var wp = this.randomWeapon(0);
  out.push({ kind: 'weapon', weapon: wp, price: 90 + wp.tier * 55 + s * 25 });
  var sk = this.randomSkill();
  if (sk) out.push({ kind: 'skill', skill: sk, price: 110 + s * 30 });
  var boon = this.makeOffers()[0];
  out.push({ kind: 'boon', boon: boon, price: 140 + s * 40 });
  out.push({ kind: 'heal', price: 45 + s * 12 });
  out.push({ kind: 'flask', price: 80 + s * 20 });
  return out;
};

/* ---------- helpers ---------- */
World.prototype.shake = function (a) { this.trauma = Math.min(1, this.trauma + a * 0.055 * AB.save.data.opt.shake); };
World.prototype.hitstop = function (n) { this.freeze = Math.max(this.freeze, n); };
World.prototype.flashScreen = function (c, a) { if (AB.save.data.opt.flash) { this.flashC = c; this.flashA = Math.max(this.flashA, a); } };
World.prototype.text = function (x, y, str, color, big) {
  if (!AB.save.data.opt.dmgnum && !big) return;
  if (this.texts.length > 40) this.texts.shift();
  this.texts.push({ x: x + AB.rand(-4, 4), y: y, vy: -0.9, life: big ? 50 : 36, max: big ? 50 : 36, str: str, color: color || '#fff', big: !!big });
};
World.prototype.toast = function (msg, icon, color) { this.toasts.push({ msg: msg, icon: icon, color: color || '#fff', t: 0 }); if (this.toasts.length > 4) this.toasts.shift(); };
World.prototype.burst = function (x, y, color, n, o) {
  o = o || {};
  if (this.particles.length > 650) this.particles.splice(0, 60);
  for (var i = 0; i < n; i++) {
    var a = Math.random() * 6.283, sp = Math.random();
    this.particles.push({
      x: x + (o.spread ? AB.rand(-o.spread, o.spread) : 0), y: y + (o.spread ? AB.rand(-o.spread, o.spread) : 0),
      vx: Math.cos(a) * sp * (o.vx === undefined ? 2 : o.vx) + (o.dx || 0), vy: Math.sin(a) * sp * (o.vy === undefined ? 2 : o.vy) + (o.dy || 0),
      g: o.g === undefined ? 0.08 : o.g, life: (o.life || 24) * (0.6 + Math.random() * 0.6), max: o.life || 24, size: o.size || 2, color: color, glow: !!o.glow, fric: o.fric || 0.96
    });
  }
};
World.prototype.dust = function (x, y, n) { this.burst(x, y, '#9a96a8', n, { vx: 1.1, vy: 0.5, g: -0.01, life: 16, size: 2, fric: 0.9 }); };
World.prototype.ring = function (x, y, r, color) { this.rings.push({ x: x, y: y, r: r, t: 0, max: 16, color: color }); };
World.prototype.spawnProj = function (o) { var p = new AB.Proj(o); this.projs.push(p); return p; };
World.prototype.enemiesNear = function (x, y, r, cb) {
  for (var i = 0; i < this.enemies.length; i++) {
    var e = this.enemies[i]; if (e.dead || e.spawnT > 0) continue;
    if (AB.dist(x, y, e.x + e.w / 2, e.y + e.h / 2) < r + Math.max(e.w, e.h) / 2) cb(e);
  }
};
World.prototype.deflectProj = function (x, y, r) {
  for (var i = 0; i < this.projs.length; i++) {
    var p = this.projs[i];
    if (p.team === 'e' && !p.dead && p.small && AB.dist(x, y, p.x, p.y) < r) { p.dead = true; this.burst(p.x, p.y, p.col(), 6, { life: 14, size: 1 }); }
  }
};
World.prototype.explode = function (x, y, r, dmg, team, o) {
  o = o || {};
  this.shake(7); AB.sfx('explode'); this.hitstop(3);
  this.ring(x, y, r, o.color || '#ff8a3a'); this.flashScreen('#ffb04a', 0.15);
  this.burst(x, y, '#ffb04a', 26, { vx: 3.5, vy: 3.5, life: 30, size: 3, glow: true });
  this.burst(x, y, '#ff5a1a', 14, { vx: 2.5, vy: 2.5, life: 26, size: 4 });
  this.burst(x, y, '#444050', 10, { vx: 1.5, vy: 1.8, g: -0.03, life: 40, size: 4 });
  var i;
  if (team === 'p') {
    for (i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i]; if (e.dead || e.spawnT > 0) continue;
      var d = AB.dist(x, y, e.x + e.w / 2, e.y + e.h / 2);
      if (d < r + e.w / 2) this.damageEnemy(e, dmg * (1 - d / (r * 2.2)), { kb: 4, dir: AB.sign(e.x + e.w / 2 - x) || 1, ignite: !!o.ignite, src: 'skill', color: '#ffb04a', stun: 25 });
    }
    this.hitProps({ x: x - r / 2, y: y - r / 2, w: r, h: r });
  } else {
    var p = this.player;
    if (!p.dead && AB.dist(x, y, p.x + 5, p.y + 11) < r + 6) this.hurtPlayer(dmg, x, { explosion: true });
  }
};

/* ---------- player offense ---------- */
World.prototype.playerMelee = function (p, hb, atk) {
  var wp = atk.wp, i, e, mult = 1;
  if (wp.combo >= 3 && atk.combo === 2) mult = 1.5;
  else if (wp.combo === 2 && atk.combo === 1) mult = 1.1;
  for (i = 0; i < this.enemies.length; i++) {
    e = this.enemies[i];
    if (e.dead || e.spawnT > 0 || atk.hit.indexOf(e) >= 0 || !AB.overlap(hb, e)) continue;
    atk.hit.push(e);
    this.playerHit(e, wp.dmg * p.dmgMul() * mult, { kb: wp.kb * (atk.combo === 2 && wp.combo >= 3 ? 1.6 : 1), dir: p.face, wp: wp, src: 'weapon', heavy: wp.dmg > 30 || mult > 1 });
  }
  this.hitProps(hb);
  for (i = 0; i < this.projs.length; i++) {
    var pr = this.projs[i];
    if (pr.team === 'e' && !pr.dead && pr.small && AB.overlap(hb, pr)) {
      pr.dead = true; AB.sfx('parry'); this.burst(pr.x, pr.y, '#fff', 8, { life: 12, size: 1 });
    }
  }
};
World.prototype.slamWave = function (x, y, dir, dmg, wp) {
  var self = this;
  this.ring(x, y - 2, 40, '#ffd24a');
  this.burst(x, y, '#c8b890', 16, { vx: 2.5, vy: 1.5, life: 22, size: 2 });
  var box = { x: dir > 0 ? x - 10 : x - 90, y: y - 20, w: 100, h: 24 };
  for (var i = 0; i < this.enemies.length; i++) {
    var e = this.enemies[i];
    if (e.dead || e.spawnT > 0 || !AB.overlap(box, e)) continue;
    this.playerHit(e, dmg, { kb: 5, dir: AB.sign(e.x + e.w / 2 - x) || dir, wp: wp, src: 'weapon', heavy: true, stun: wp.stun });
  }
  this.hitProps(box);
  for (var k = 1; k < 6; k++) (function (k) { self.burst(x + dir * k * 14, y, '#b8a888', 3, { vx: 0.6, vy: 1.4, life: 18, size: 2, g: 0.1 }); })(k);
};
World.prototype.playerHit = function (e, base, o) {
  var p = this.player, s = p.s, wp = o.wp || {}, src = o.src;
  var dmg = base * AB.rand(0.93, 1.07);
  var crit = Math.random() < s.crit + (wp.crit || 0);
  if (wp.backstab && e.face === p.face) { dmg *= wp.backstab; o.back = true; }
  if (crit) dmg *= s.critDmg;
  var procs = src === 'weapon' || src === 'proj';
  var ign = procs && Math.random() < (wp.ignite || 0) + s.procBurn;
  var frz = procs && Math.random() < (wp.freeze || 0) + s.procFreeze;
  var shk = procs && Math.random() < (wp.shock || 0) + s.procShock;
  var ok = this.damageEnemy(e, dmg, { kb: o.kb, dir: o.dir, crit: crit, stun: o.stun || 0, ignite: ign, freeze: frz, src: src || 'weapon', heavy: o.heavy, color: o.color || (wp.color || '#fff'), back: o.back });
  if (!ok) return false;
  if (wp.leech) { p.hp = Math.min(s.maxHp, p.hp + wp.leech); }
  if (shk) this.chain(e, dmg * 0.5, 2);
  if (wp.type === 'melee') { p.vx -= p.face * 0.3; }
  return true;
};
World.prototype.chain = function (from, dmg, n) {
  var cur = from, seen = [from], pts = [{ x: from.x + from.w / 2, y: from.y + from.h / 2 }];
  for (var i = 0; i < n; i++) {
    var best = null, bd = 90;
    for (var k = 0; k < this.enemies.length; k++) {
      var e = this.enemies[k]; if (e.dead || seen.indexOf(e) >= 0) continue;
      var d = AB.dist(cur.x, cur.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) break;
    seen.push(best); pts.push({ x: best.x + best.w / 2, y: best.y + best.h / 2 });
    this.damageEnemy(best, dmg, { kb: 1, dir: AB.sign(best.x - cur.x) || 1, src: 'skill', color: '#ffe84a', stun: 14 });
    cur = best;
  }
  if (pts.length > 1) { this.bolts.push({ pts: pts, t: 12 }); AB.sfx('zap'); }
};

World.prototype.damageEnemy = function (e, dmg, o) {
  if (e.dead || e.spawnT > 0 || e.invuln > 0) return false;
  o = o || {};
  if (e.def.mitigate) { dmg = e.def.mitigate(e, dmg, o, this); if (dmg <= 0) return false; }
  if (e.armor) dmg *= (1 - e.armor);
  dmg = Math.max(1, Math.round(dmg));
  e.hp -= dmg; e.flash = 5; e.hurtT = 10; e.lastHit = this.t;
  var dir = o.dir || 1;
  if (!e.boss && !e.noKb && o.kb) { e.vx = dir * o.kb * (1 - (e.kbRes || 0)); if (o.kb > 1.5) e.vy = -Math.min(o.kb * 0.5, 2.5); }
  if (o.stun && !e.boss && !e.noStun) { e.stun = Math.max(e.stun || 0, o.stun); e.cancel && e.cancel(this); }
  if (o.ignite) e.burn = 180;
  if (o.freeze) { if (e.boss) e.slow = 120; else e.freezeT = Math.max(e.freezeT || 0, 100); }
  var col = o.crit ? '#ffe84a' : (o.src === 'dot' ? '#ff9a4a' : '#ffffff');
  if (o.src !== 'dot' || (this.t % 30 === 0)) this.text(e.x + e.w / 2, e.y - 2, dmg, col, o.crit);
  this.burst(e.x + e.w / 2, e.y + e.h / 2, e.blood || '#b02a3a', o.crit ? 8 : 4, { vx: 2, vy: 2, life: 18, size: 2, dx: dir * 0.8 });
  if (o.src !== 'dot') {
    AB.sfx(o.crit ? 'crit' : 'hit');
    this.hitstop(o.crit ? 4 : (o.heavy ? 4 : 2));
    if (o.crit || o.heavy) this.shake(2.5);
    this.burst(e.x + e.w / 2, e.y + e.h / 2, '#fff', 3, { vx: 2.5, vy: 2.5, life: 8, size: 1, g: 0 });
    AB.input.vibrate(o.crit ? 18 : 8);
  }
  if (e.boss) { e.hitF = 6; }
  if (e.hp <= 0) this.killEnemy(e, o);
  return true;
};

World.prototype.killEnemy = function (e, o) {
  if (e.dead) return;
  e.dead = true; e.hp = 0;
  var p = this.player, r = this.run, s = p.s;
  r.kills++; AB.save.data.stats.kills++;
  this.killCombo++; this.comboT = 150;
  if (s.killHeal && !p.dead) { p.hp = Math.min(s.maxHp, p.hp + s.killHeal); }
  var cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  this.burst(cx, cy, e.blood || '#b02a3a', 14, { vx: 3, vy: 3, life: 28, size: 3 });
  this.burst(cx, cy, '#fff', 6, { vx: 3, vy: 3, life: 10, size: 1, g: 0 });
  this.ring(cx, cy, 20, '#fff');
  if (!e.boss) { AB.sfx('die'); this.hitstop(4); this.shake(2); }
  if (e.def.onDeath) e.def.onDeath(e, this);
  if (e.elite === 'volatile') this.explode(cx, cy, 44, 18 * this.biome.dmgMul, 'e', { color: '#ff5a3a' });
  this.dropLoot(e);
};

World.prototype.mkPickup = function (kind, x, y, val, o) {
  o = o || {};
  return { id: ++this.pickupId, kind: kind, x: x, y: y, w: 8, h: 8, vx: o.vx || 0, vy: o.vy || 0, val: val || 1, t: 0, still: !!o.still, onGround: false, weapon: o.weapon, skill: o.skill, bounce: 0 };
};
World.prototype.dropLoot = function (e) {
  var cx = e.x + e.w / 2, cy = e.y + e.h / 2, s = this.player.s, n, i;
  var gv = Math.max(1, Math.round((e.gold || 3) * s.goldMul * (e.elite ? 2.2 : 1)));
  n = Math.min(e.boss ? 24 : 5, Math.max(1, Math.ceil(gv / 4)));
  var per = Math.max(1, Math.round(gv / n));
  for (i = 0; i < n; i++) this.pickups.push(this.mkPickup('gold', cx, cy, per, { vx: AB.rand(-2, 2), vy: AB.rand(-4, -1.5) }));
  var em = e.boss ? 25 + this.stage * 10 : (e.elite ? 3 : (Math.random() < 0.45 ? 1 : 0));
  em = Math.round(em * s.emberMul);
  for (i = 0; i < em; i++) this.pickups.push(this.mkPickup('ember', cx, cy, 1, { vx: AB.rand(-2.5, 2.5), vy: AB.rand(-4.5, -1.5) }));
  if (Math.random() < (e.elite ? 0.3 : 0.06) || e.boss) this.pickups.push(this.mkPickup('heart', cx, cy, 25, { vx: AB.rand(-1, 1), vy: -3 }));
  if (e.elite && Math.random() < 0.18) {
    var wp = this.randomWeapon(1);
    this.pickups.push(this.mkPickup('weapon', cx, cy - 6, 1, { vy: -3, weapon: wp }));
  }
};
World.prototype.addGold = function (n) { this.run.gold += n; };

World.prototype.hitProps = function (box) {
  for (var i = 0; i < this.props.length; i++) {
    var pr = this.props[i];
    if (pr.hp > 0 && AB.overlap(box, pr)) {
      pr.hp = 0; AB.sfx('hit');
      this.burst(pr.x + 6, pr.y + 7, pr.kind === 'urn' ? '#8a5a4a' : '#8a6a3a', 10, { vx: 2, vy: 2, life: 26, size: 2, g: 0.15 });
      var n = AB.randi(1, 3);
      for (var k = 0; k < n; k++) this.pickups.push(this.mkPickup('gold', pr.x + 6, pr.y + 4, 3 + this.stage * 2, { vx: AB.rand(-1.5, 1.5), vy: AB.rand(-3, -1) }));
      if (Math.random() < 0.06) this.pickups.push(this.mkPickup('heart', pr.x + 6, pr.y + 4, 20, { vy: -2.5 }));
    }
  }
};

/* ---------- player defence ---------- */
// returns 'hit' | 'ignored' | 'parried' | 'blocked'
World.prototype.hurtPlayer = function (dmg, srcX, o) {
  var p = this.player, s = p.s; o = o || {};
  if (p.dead || p.iframes > 0 || this.over) return 'ignored';
  if (p.noHurtT > 0 && !o.spike) return 'ignored';
  // shield
  if (p.guard > 0 && !o.spike && !o.explosion) {
    var front = (srcX >= p.x + 5) === (p.face > 0);
    if (front || o.proj) {
      if (p.parryT > 0) {
        AB.sfx('parry'); this.shake(6); this.hitstop(8); this.flashScreen('#bfe8ff', 0.3);
        this.ring(p.x + 5 + p.face * 10, p.y + 11, 50, '#bfe8ff');
        this.burst(p.x + 5 + p.face * 10, p.y + 11, '#ffffff', 16, { vx: 3.5, vy: 3.5, life: 16, size: 2, g: 0 });
        this.text(p.x + 5, p.y - 8, 'PARRY!', '#bfe8ff', true);
        var pw = p.run.weapons[p.guardSlot];
        this.enemiesNear(p.x + 5, p.y + 11, 60, function (e) { e.stun = Math.max(e.stun || 0, e.boss ? 20 : 90); e.cancel && e.cancel(); });
        var self = this;
        this.enemiesNear(p.x + 5, p.y + 11, 60, function (e) { self.damageEnemy(e, (pw ? pw.dmg : 12) * p.dmgMul() * 1.5, { kb: 5, dir: p.face, src: 'skill', color: '#bfe8ff' }); });
        if (o.proj) { var pj = o.proj; pj.team = 'p'; pj.vx *= -1.4; pj.vy *= -1.4; pj.dmg = dmg * 3 * p.dmgMul(); pj.reflected = true; pj.hit = []; pj.life = 80; pj.pierce = 1; pj.small = false; }
        p.iframes = 20;
        return 'parried';
      }
      AB.sfx('block'); this.shake(2);
      this.burst(p.x + 5 + p.face * 8, p.y + 10, '#bfe8ff', 5, { life: 10, size: 1 });
      dmg *= 0.2; p.vx -= p.face * 1.6; o.blocked = true;
    }
  }
  dmg = dmg * (1 - AB.clamp(s.armor, -0.6, 0.7));
  dmg = Math.max(1, Math.round(dmg));
  p.hp -= dmg; this.run.damageTaken += dmg;
  p.flash = 6; p.iframes = o.blocked ? 25 : 55; p.hurtT = o.blocked ? 0 : 14; p.drinkT = 0; p.atk = null;
  if (!o.blocked) {
    var dir = p.x + 5 >= srcX ? 1 : -1;
    p.vx = dir * 2.6; p.vy = -2.8;
  }
  this.killCombo = 0;
  this.text(p.x + 5, p.y - 4, dmg, '#ff5a6a', true);
  this.shake(o.blocked ? 3 : 6); this.hitstop(o.blocked ? 2 : 5);
  this.flashScreen('#ff2a3a', 0.28); AB.sfx('hurt'); AB.input.vibrate(40);
  this.burst(p.x + 5, p.y + 10, '#c02a3a', 10, { vx: 2.5, vy: 2.5, life: 22, size: 2 });
  if (s.thorns && !o.spike) {
    this.ring(p.x + 5, p.y + 11, 46, '#b0b0c0');
    var me = this;
    this.enemiesNear(p.x + 5, p.y + 11, 46, function (e) { me.damageEnemy(e, 16 * s.thorns * p.dmgMul(), { kb: 3, dir: AB.sign(e.x - p.x) || 1, src: 'skill', color: '#b0b0c0' }); });
  }
  if (o.status === 'burn') p.burnHurt = 1;
  if (p.hp <= 0) this.killPlayer();
  return 'hit';
};
World.prototype.killPlayer = function () {
  var p = this.player, s = p.s;
  if (s.revive > 0) {
    s.revive--; p.hp = Math.round(s.maxHp * 0.5); p.iframes = 120;
    this.ring(p.x + 5, p.y + 11, 120, '#ffb04a'); this.flashScreen('#ffb04a', 0.6); AB.sfx('altar');
    this.burst(p.x + 5, p.y + 11, '#ffb04a', 40, { vx: 4, vy: 4, life: 40, size: 3, glow: true });
    this.text(p.x + 5, p.y - 14, 'PHOENIX ASH!', '#ffb04a', true);
    var me = this;
    this.enemiesNear(p.x + 5, p.y + 11, 120, function (e) { me.damageEnemy(e, 60, { kb: 7, dir: AB.sign(e.x - p.x) || 1, src: 'skill', stun: 60 }); });
    return;
  }
  p.dead = true; p.deadT = 0; p.hp = 0; p.vy = -4;
  AB.sfx('die'); this.slowmo = 90; this.shake(9);
  this.over = true; this.overT = 0;
};

/* ---------- interaction ---------- */
World.prototype.findFocus = function () {
  var p = this.player, best = null, bd = 9999, i, it, pb = { x: p.x - 6, y: p.y - 6, w: p.w + 12, h: p.h + 12 };
  for (i = 0; i < this.inter.length; i++) {
    it = this.inter[i];
    if (it.hidden || (it.used && it.kind !== 'portal' && it.kind !== 'altar' && it.kind !== 'shop' && it.kind !== 'smith')) continue;
    if (!AB.overlap(pb, it)) continue;
    var d = Math.abs(it.x + it.w / 2 - (p.x + 5));
    if (d < bd) { bd = d; best = it; }
  }
  for (i = 0; i < this.pickups.length; i++) {
    var pk = this.pickups[i];
    if ((pk.kind === 'weapon' || pk.kind === 'skill') && AB.overlap(pb, pk)) {
      var d2 = Math.abs(pk.x - (p.x + 5)) - 6;
      if (d2 < bd) { bd = d2; best = { kind: 'pick', pk: pk, x: pk.x, y: pk.y, w: 8, h: 8 }; }
    }
  }
  return best;
};
World.prototype.activate = function (it) {
  var p = this.player, i;
  switch (it.kind) {
    case 'chest': {
      if (it.used) return;
      it.used = true; AB.sfx('chest'); this.shake(2);
      this.burst(it.x + 10, it.y + 4, '#ffd24a', 18, { vx: 2.5, vy: 3, life: 30, size: 2, glow: true });
      var cx = it.x + 10, cy = it.y, r = Math.random();
      for (i = 0; i < AB.randi(7, 12); i++) this.pickups.push(this.mkPickup('gold', cx, cy, 5 + this.stage * 3, { vx: AB.rand(-2.5, 2.5), vy: AB.rand(-5, -2) }));
      if (r < 0.62) this.pickups.push(this.mkPickup('weapon', cx, cy - 6, 1, { vy: -4, weapon: this.randomWeapon(it.big ? 1 : 0) }));
      else if (r < 0.85) {
        var sk = this.randomSkill();
        if (sk) this.pickups.push(this.mkPickup('skill', cx, cy - 6, 1, { vy: -4, skill: sk }));
        else this.pickups.push(this.mkPickup('weapon', cx, cy - 6, 1, { vy: -4, weapon: this.randomWeapon(0) }));
      } else this.pickups.push(this.mkPickup('heart', cx, cy - 6, 40, { vy: -4 }));
      var em = Math.round((3 + this.stage * 2) * p.s.emberMul);
      for (i = 0; i < em; i++) this.pickups.push(this.mkPickup('ember', cx, cy, 1, { vx: AB.rand(-2, 2), vy: AB.rand(-5, -2) }));
      break; }
    case 'altar':
      if (it.used) { this.toast('The altar is spent.', 'skull', '#aaa'); return; }
      AB.sfx('altar'); this.modal = { type: 'altar', it: it, sel: 0, t: 0 }; break;
    case 'shop':
      AB.sfx('click'); this.modal = { type: 'shop', it: it, sel: 0, t: 0 }; break;
    case 'smith':
      AB.sfx('click'); this.modal = { type: 'smith', it: it, sel: 0, t: 0 }; break;
    case 'well':
      if (it.used) return;
      it.used = true; AB.sfx('heal');
      p.heal(this, Math.round(p.s.maxHp * 0.6));
      if (this.run.flasks < p.s.flasks) this.run.flasks++;
      this.ring(it.x + 14, it.y + 20, 60, '#7affb0');
      this.toast('The Ashen Well restores you.', 'drop', '#7affb0'); break;
    case 'portal':
      if (this.over) return;
      AB.sfx('portal'); this.over = true; this.overT = 0; this.portalDone = true; this.game.stageComplete(); break;
    case 'pick':
      this.openSwap(it.pk); break;
  }
};
World.prototype.openSwap = function (pk) {
  AB.sfx('pickup');
  if (pk.kind === 'weapon') {
    var r = this.run;
    if (!r.weapons[1]) { r.weapons[1] = pk.weapon; this.removePickup(pk); this.toast('Equipped ' + pk.weapon.name, pk.weapon.icon, pk.weapon.color); return; }
    this.modal = { type: 'swap', pk: pk, sel: 0, t: 0 };
  } else {
    var sk = this.run.skills;
    if (!sk[0]) { sk[0] = pk.skill; this.removePickup(pk); return; }
    if (!sk[1]) { sk[1] = pk.skill; this.removePickup(pk); this.toast('Learned ' + AB.SKILLS[pk.skill].name, AB.SKILLS[pk.skill].icon, AB.SKILLS[pk.skill].color); return; }
    this.modal = { type: 'swap', pk: pk, sel: 0, t: 0 };
  }
};
World.prototype.removePickup = function (pk) { var i = this.pickups.indexOf(pk); if (i >= 0) this.pickups.splice(i, 1); };

/* ---------- arenas & boss ---------- */
World.prototype.updateArenas = function () {
  var L = this.level, p = this.player, i, a;
  for (i = 0; i < L.arenas.length; i++) {
    a = L.arenas[i];
    if (a.state === 0) {
      if (p.x > a.x0 + 5 * T && p.x < a.x1 - 5 * T && Math.abs(p.y - a.y) < 60 && !p.dead) {
        a.state = 1; a.wave = 0; a.wait = 30; L.setGates(a.gates, true); AB.sfx('door'); this.shake(3);
        this.banner = { title: 'AMBUSH', sub: 'Defeat all foes to proceed', t: 0, max: 100, small: true };
        AB.audio.setIntensity(1);
      }
    } else if (a.state === 1) {
      var alive = 0;
      for (var k = 0; k < this.enemies.length; k++) if (this.enemies[k].arena === i && !this.enemies[k].dead) alive++;
      if (alive === 0) {
        if (a.wait > 0) { a.wait--; continue; }
        if (a.wave < a.waves) {
          var list = L.waveList(a.wave, a.waves, this.rng), n = list.length;
          for (var q = 0; q < n; q++) {
            var d = list[q], fly = d.type === 'bat';
            var side = q % 2 ? 1 : -1, cx = (a.x0 + a.x1) / 2 + side * AB.rand(80, 240);
            AB.spawnEnemy(this, d.type, cx, fly ? a.y - AB.rand(70, 130) : a.y, { elite: d.elite, arena: i, spawnFx: true });
          }
          a.wave++; a.wait = 40;
          this.toast('Wave ' + a.wave + ' / ' + a.waves, 'skull', '#ff8a6a');
        } else {
          a.state = 2; L.setGates(a.gates, false); AB.sfx('door'); AB.sfx('chest'); this.shake(3);
          this.toast('Arena cleared!', 'skull', '#ffd24a'); AB.audio.setIntensity(0.2);
          var mx = (a.x0 + a.x1) / 2;
          this.inter.push({ kind: 'chest', x: mx - 10, y: a.y - 16, w: 20, h: 16, used: false, anim: 0, big: true });
          this.burst(mx, a.y - 10, '#ffd24a', 24, { vx: 3, vy: 3, life: 30, size: 2, glow: true });
          this.pickups.push(this.mkPickup('heart', mx - 24, a.y - 20, 30, { vy: -3 }));
        }
      }
    }
  }
  var b = L.boss;
  if (b && b.state === 0 && !p.dead && p.x > b.x0 + 9 * T) {
    b.state = 1; L.setGates(b.gates, true); AB.sfx('door'); AB.sfx('boss'); this.shake(7);
    var bd = AB.BOSSES[b.type];
    this.bossRef = AB.spawnEnemy(this, b.type, (b.x0 + b.x1) / 2 + 120, b.y - 100, { boss: true, spawnFx: true });
    this.banner = { title: bd.title, sub: bd.sub, t: 0, max: 200, boss: true };
    AB.audio.musicPlay('boss'); AB.audio.setIntensity(0.9);
    this.bossArena = b;
  }
  if (b && b.state === 1 && this.bossRef && this.bossRef.dead) {
    b.state = 2; L.setGates(b.gates, false);
    this.slowmo = 100; this.flashScreen('#ffffff', 0.7); this.shake(10); AB.sfx('explode');
    var pr = null;
    for (i = 0; i < this.inter.length; i++) if (this.inter[i].kind === 'portal') pr = this.inter[i];
    if (pr) { pr.hidden = false; this.ring(pr.x + 16, pr.y + 22, 100, '#b08aff'); AB.sfx('portal'); }
    this.exitOpen = true; this.run.bossKills++; AB.save.data.stats.bossKills++;
    this.toast('Guardian defeated! The way onward is open.', 'skull', '#ffd24a');
    AB.audio.musicPlay(this.biome.music); AB.audio.setIntensity(0.2);
    for (i = 0; i < 3; i++) this.pickups.push(this.mkPickup('heart', (b.x0 + b.x1) / 2 + (i - 1) * 30, b.y - 50, 40, { vy: -4 }));
    // guaranteed rare reward
    var wp = this.randomWeapon(1);
    this.pickups.push(this.mkPickup('weapon', (b.x0 + b.x1) / 2, b.y - 60, 1, { vy: -4, weapon: AB.makeWeapon(wp.id, AB.clamp(this.stage + 1, 0, 4), AB.AFFIXES[Math.floor(Math.random() * AB.AFFIXES.length)].id) }));
  }
};

/* ---------- main update ---------- */
World.prototype.update = function (I) {
  var p = this.player, L = this.level, i;
  this.t++;
  if (this.pendingOffer && this.t > 40) {
    this.pendingOffer = false;
    this.modal = { type: 'altar', it: { offers: this.makeOffers(), used: false, free: true }, sel: 0, t: 0 };
    return;
  }
  if (this.freeze > 0) { this.freeze--; this.updateFx(true); return; }
  if (this.slowmo > 0) { this.slowmo--; if (this.slowmo % 3 !== 0) { this.updateFx(true); return; } }

  p.update(this, I);
  if (this.over && p.dead) { this.overT++; }

  // enemies
  for (i = this.enemies.length - 1; i >= 0; i--) {
    var e = this.enemies[i];
    AB.updateEnemy(e, this);
    if (e.dead) { this.enemies.splice(i, 1); }
  }
  for (i = this.projs.length - 1; i >= 0; i--) { this.projs[i].update(this); if (this.projs[i].dead) this.projs.splice(i, 1); }
  for (i = this.allies.length - 1; i >= 0; i--) { this.allies[i].update(this); if (this.allies[i].dead) this.allies.splice(i, 1); }
  this.updatePickups();
  for (i = this.props.length - 1; i >= 0; i--) { var pr = this.props[i]; if (pr.hp <= 0) this.props.splice(i, 1); else if (pr.flash > 0) pr.flash--; }
  this.updateArenas();
  this.focus = (!p.dead && !this.modal) ? this.findFocus() : null;
  if (this.focus && I.pressed('interact')) { AB.input.consume('interact'); this.activate(this.focus); }

  // combo timer, run time
  if (this.comboT > 0 && --this.comboT === 0) this.killCombo = 0;
  this.run.time++;
  for (i = 0; i < this.inter.length; i++) this.inter[i].anim++;
  AB.audio.setIntensity(this.enemies.length ? Math.min(1, 0.25 + this.enemiesAwake() * 0.12) : 0.1);
  this.updateFx(false);
  this.updateCamera();
};
World.prototype.enemiesAwake = function () {
  var p = this.player, n = 0;
  for (var i = 0; i < this.enemies.length; i++) { var e = this.enemies[i]; if (Math.abs(e.x - p.x) < 260 && !e.dead) n++; }
  return n;
};

World.prototype.updatePickups = function () {
  var p = this.player, i, pk, L = this.level, pb = { x: p.x - 3, y: p.y - 3, w: p.w + 6, h: p.h + 6 };
  for (i = this.pickups.length - 1; i >= 0; i--) {
    pk = this.pickups[i]; pk.t++;
    var mag = pk.kind === 'gold' ? 48 : (pk.kind === 'ember' ? 90 : (pk.kind === 'heart' ? 24 : 0));
    var d = AB.dist(pk.x + 4, pk.y + 4, p.x + 5, p.y + 11);
    if (mag && d < mag && pk.t > 14 && !p.dead) {
      var ax = (p.x + 5 - pk.x - 4) / (d || 1), ay = (p.y + 11 - pk.y - 4) / (d || 1);
      pk.vx += ax * 0.5; pk.vy += ay * 0.5; pk.vx *= 0.9; pk.vy *= 0.9; pk.still = false; pk.mag = true;
    } else if (!pk.still) {
      pk.vy = Math.min(pk.vy + 0.22, 6);
    }
    if (!pk.still) {
      if (pk.mag) { pk.x += pk.vx; pk.y += pk.vy; }
      else {
        pk.vx *= 0.97;
        var land = AB.moveBody(pk, L);
        if (pk.onGround && Math.abs(pk.vy) < 0.1) { pk.vx *= 0.8; }
        if (land) { pk.vy = -2; pk.onGround = false; pk.vx *= 0.6; pk.bounce++; if (pk.bounce > 2 || true) { pk.y -= 0; } }
        if (pk.hitWall) pk.vx = -pk.vx * 0.5;
      }
    }
    if (pk.t > 14 && !p.dead && AB.overlap(pb, pk)) {
      if (pk.kind === 'gold') { this.run.gold += pk.val; AB.sfx('coin'); this.burst(pk.x + 4, pk.y + 4, '#ffd24a', 3, { life: 10, size: 1, g: 0 }); }
      else if (pk.kind === 'ember') { this.run.embers += pk.val; AB.sfx('ember'); this.burst(pk.x + 4, pk.y + 4, '#ffb04a', 4, { life: 12, size: 1, g: 0, glow: true }); }
      else if (pk.kind === 'heart') { p.heal(this, pk.val); AB.sfx('heal'); }
      else continue;
      this.pickups.splice(i, 1);
    }
  }
};

World.prototype.updateFx = function (frozen) {
  var i, q;
  for (i = this.particles.length - 1; i >= 0; i--) {
    q = this.particles[i];
    if (frozen && !q.glow) { continue; }
    q.x += q.vx; q.y += q.vy; q.vy += q.g; q.vx *= q.fric; q.vy *= q.fric > 0.95 ? 0.99 : q.fric;
    if (--q.life <= 0) this.particles.splice(i, 1);
  }
  if (frozen) return;
  for (i = this.texts.length - 1; i >= 0; i--) { q = this.texts[i]; q.y += q.vy; q.vy *= 0.94; if (--q.life <= 0) this.texts.splice(i, 1); }
  for (i = this.rings.length - 1; i >= 0; i--) { this.rings[i].t++; if (this.rings[i].t > this.rings[i].max) this.rings.splice(i, 1); }
  for (i = this.bolts.length - 1; i >= 0; i--) { this.bolts[i].t--; if (this.bolts[i].t <= 0) this.bolts.splice(i, 1); }
  for (i = this.toasts.length - 1; i >= 0; i--) { this.toasts[i].t++; if (this.toasts[i].t > 150) this.toasts.splice(i, 1); }
  if (this.banner) { this.banner.t++; if (this.banner.t > this.banner.max) this.banner = null; }
  if (this.trauma > 0) this.trauma = Math.max(0, this.trauma - 0.018);
  if (this.flashA > 0) this.flashA = Math.max(0, this.flashA - 0.03);
  for (i = 0; i < this.ash.length; i++) {
    q = this.ash[i]; q.y += 0.15 * q.z; q.x += Math.sin(this.t * 0.02 + q.ph) * 0.2 * q.z - 0.1;
    if (q.y > AB.H + 4) { q.y = -4; q.x = Math.random() * AB.W; } if (q.x < -4) q.x = AB.W + 4;
  }
};

World.prototype.updateCamera = function () {
  var p = this.player, L = this.level, c = this.cam;
  var tx = p.x + 5 + p.face * 26 - AB.W / 2, ty = p.y + 11 - AB.H * 0.58;
  if (this.bossArena && this.bossArena.state === 1) { tx = AB.clamp(tx, this.bossArena.x0 - 24, this.bossArena.x1 - AB.W + 24); }
  tx = AB.clamp(tx, 0, L.W * T - AB.W); ty = AB.clamp(ty, 0, L.H * T - AB.H);
  c.x += (tx - c.x) * 0.1; c.y += (ty - c.y) * (p.onGround ? 0.12 : 0.07);
};
World.prototype.camPos = function () {
  var s = this.trauma * this.trauma * 9;
  var ox = s ? (Math.random() * 2 - 1) * s : 0, oy = s ? (Math.random() * 2 - 1) * s : 0;
  return { x: Math.round(this.cam.x + ox), y: Math.round(this.cam.y + oy) };
};
})();
