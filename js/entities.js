(function () {
'use strict';
var AB = window.AB;
var T = AB.T, TILE = AB.TILE;
var GRAV = 0.4, MAXFALL = 8.6;

/* ===================== PHYSICS ===================== */
// Moves body with axis-separated tile collision. body: x,y,w,h,vx,vy
AB.moveBody = function (b, lvl) {
  var tx0, tx1, ty0, ty1, tx, ty, t;
  b.hitWall = 0; b.hitCeil = false;
  var wasGround = b.onGround;
  b.onGround = false;
  // ---- X ----
  b.x += b.vx;
  ty0 = Math.floor(b.y / T); ty1 = Math.floor((b.y + b.h - 0.01) / T);
  if (b.vx > 0) {
    tx = Math.floor((b.x + b.w - 0.01) / T);
    for (ty = ty0; ty <= ty1; ty++) if (lvl.solidAt(tx, ty)) { b.x = tx * T - b.w; b.vx = 0; b.hitWall = 1; break; }
  } else if (b.vx < 0) {
    tx = Math.floor(b.x / T);
    for (ty = ty0; ty <= ty1; ty++) if (lvl.solidAt(tx, ty)) { b.x = (tx + 1) * T; b.vx = 0; b.hitWall = -1; break; }
  }
  // ---- Y ----
  var prevBottom = b.y + b.h;
  b.y += b.vy;
  tx0 = Math.floor((b.x + 0.01) / T); tx1 = Math.floor((b.x + b.w - 0.01) / T);
  if (b.vy >= 0) {
    ty = Math.floor((b.y + b.h) / T);
    for (tx = tx0; tx <= tx1; tx++) {
      t = lvl.tileAt(tx, ty);
      if (t === TILE.SOLID || t === TILE.GATE || (t === TILE.ONEWAY && prevBottom <= ty * T + 0.5 && !(b.dropT > 0))) {
        b.y = ty * T - b.h; b.vy = 0; b.onGround = true; break;
      }
    }
  } else {
    ty = Math.floor(b.y / T);
    for (tx = tx0; tx <= tx1; tx++) if (lvl.solidAt(tx, ty)) { b.y = (ty + 1) * T; b.vy = 0; b.hitCeil = true; break; }
  }
  if (b.dropT > 0) b.dropT--;
  return b.onGround && !wasGround;
};
AB.touchesTile = function (b, lvl, type) {
  var tx0 = Math.floor(b.x / T), tx1 = Math.floor((b.x + b.w - 0.01) / T), ty0 = Math.floor(b.y / T), ty1 = Math.floor((b.y + b.h - 0.01) / T);
  for (var y = ty0; y <= ty1; y++) for (var x = tx0; x <= tx1; x++) if (lvl.tileAt(x, y) === type) return true;
  return false;
};
// is there floor ahead (for patrol AI)
AB.floorAhead = function (b, lvl, dir, dist) {
  var x = dir > 0 ? b.x + b.w + dist : b.x - dist;
  var tx = Math.floor(x / T), ty = Math.floor((b.y + b.h + 2) / T);
  for (var i = 0; i < 3; i++) {
    var t = lvl.tileAt(tx, ty + i);
    if (t === TILE.SOLID || t === TILE.ONEWAY || t === TILE.GATE) return true;
    if (t === TILE.SPIKE) return false;
  }
  return false;
};
AB.wallAhead = function (b, lvl, dir) {
  var x = dir > 0 ? b.x + b.w + 2 : b.x - 2;
  var tx = Math.floor(x / T);
  return lvl.solidAt(tx, Math.floor((b.y + b.h - 4) / T)) || lvl.solidAt(tx, Math.floor((b.y + 4) / T));
};

/* ===================== STATS ===================== */
AB.newStats = function () {
  return { maxHp: 100, dmg: 1, crit: 0.05, critDmg: 1.8, spd: 1, atkSpd: 1, cdr: 0, killHeal: 0, thorns: 0,
           goldMul: 1, emberMul: 1, armor: 0, jumps: 1, procBurn: 0, procFreeze: 0, procShock: 0,
           lastStand: 0, revive: 0, flasks: 1, flaskHeal: 0, rollI: 14 };
};

/* ===================== PLAYER ===================== */
function Player(run, x, y) {
  this.run = run; this.s = run.stats;
  this.x = x; this.y = y - 22; this.w = 10; this.h = 22;
  this.vx = 0; this.vy = 0; this.face = 1;
  this.hp = run.hp; this.onGround = false;
  this.state = 'idle'; this.anim = 0; this.t = 0;
  this.coyote = 0; this.jumpBuf = 0; this.jumpsLeft = this.s.jumps; this.dropT = 0;
  this.rollT = 0; this.rollCd = 0; this.rollDir = 1;
  this.iframes = 0; this.hurtT = 0; this.flash = 0;
  this.atk = null; this.atkCd = 0; this.combo = 0; this.comboT = 0; this.buf = { slot: -1, t: 0 };
  this.guard = 0; this.guardSlot = 0; this.parryT = 0; this.drinkT = 0;
  this.cd = [0, 0]; this.buffT = 0; this.dead = false; this.deadT = 0;
  this.safeX = x; this.safeY = y - 22; this.safeT = 0;
  this.scarf = []; for (var i = 0; i < 7; i++) this.scarf.push({ x: x, y: y - 16 });
  this.landSq = 0; this.runDust = 0; this.fallV = 0;
  this.noHurtT = 60;
}
AB.Player = Player;

Player.prototype.dmgMul = function () {
  var s = this.s, m = s.dmg;
  if (this.hp / s.maxHp < 0.35) m += s.lastStand;
  if (this.buffT > 0) m += 0.35;
  return m;
};
Player.prototype.weapon = function (slot) { return this.run.weapons[slot]; };

Player.prototype.update = function (w, I) {
  var s = this.s, lvl = w.level, dir = (I.isDown('right') ? 1 : 0) - (I.isDown('left') ? 1 : 0);
  this.t++;
  if (this.dead) { this.deadT++; this.vx *= 0.9; this.vy = Math.min(this.vy + GRAV, MAXFALL); AB.moveBody(this, lvl); return; }
  if (this.iframes > 0) this.iframes--;
  if (this.noHurtT > 0) this.noHurtT--;
  if (this.hurtT > 0) this.hurtT--;
  if (this.flash > 0) this.flash--;
  if (this.rollCd > 0) this.rollCd--;
  if (this.atkCd > 0) this.atkCd--;
  if (this.comboT > 0) { this.comboT--; if (this.comboT === 0) this.combo = 0; }
  if (this.buffT > 0) this.buffT--;
  if (this.landSq > 0) this.landSq--;
  for (var c = 0; c < 2; c++) if (this.cd[c] > 0) this.cd[c]--;
  if (this.buf.t > 0) this.buf.t--;

  var rolling = this.rollT > 0, attacking = !!this.atk, guarding = this.guard > 0, drinking = this.drinkT > 0;
  var spd = 1.75 * s.spd * (this.buffT > 0 ? 1.2 : 1);
  var locked = this.hurtT > 6;

  // ---- inputs: roll ----
  if (!locked && I.pressed('roll') && this.rollCd === 0 && !rolling) {
    this.rollT = 20; this.rollCd = 34; this.rollDir = dir || this.face; this.face = this.rollDir;
    this.iframes = Math.max(this.iframes, s.rollI); this.atk = null; this.guard = 0; this.drinkT = 0;
    AB.sfx('roll'); w.dust(this.x + 5, this.y + 22, 5);
    rolling = true; attacking = false; guarding = false; drinking = false;
  }
  // ---- jump ----
  if (I.pressed('jump') && !(I.isDown('down') && this.onGround && lvl.tileAt(Math.floor((this.x + 5) / T), Math.floor((this.y + 23) / T)) === TILE.ONEWAY)) this.jumpBuf = 7;
  else if (this.jumpBuf > 0) this.jumpBuf--;
  if (this.onGround) { this.coyote = 6; this.jumpsLeft = s.jumps; } else if (this.coyote > 0) this.coyote--;
  // drop through one-way
  if (I.isDown('down') && I.pressed('jump') && this.onGround && lvl.tileAt(Math.floor((this.x + 5) / T), Math.floor((this.y + 23) / T)) === TILE.ONEWAY) {
    this.dropT = 10; this.y += 2; this.onGround = false; this.jumpBuf = 0;
  }
  if (!locked && this.jumpBuf > 0 && !drinking && !guarding) {
    if (this.coyote > 0) {
      this.vy = -6.9; this.coyote = 0; this.jumpBuf = 0; this.onGround = false; AB.sfx('jump'); w.dust(this.x + 5, this.y + 22, 4);
      if (rolling) { this.rollT = 0; this.vx = this.face * spd * 1.5; }
    } else if (this.jumpsLeft > 0) {
      this.vy = -6.3; this.jumpsLeft--; this.jumpBuf = 0; AB.sfx('djump');
      w.burst(this.x + 5, this.y + 22, '#cfd8ff', 8, { vy: 1, vx: 1.4, life: 18, size: 2 });
      if (attacking) { /* keep swing */ }
    }
  }
  if (!I.isDown('jump') && this.vy < -2.8 && this.rollT === 0) this.vy = -2.8; // variable height

  // ---- horizontal movement ----
  if (rolling) {
    var rp = this.rollT / 20;
    this.vx = this.rollDir * (3.5 * (0.45 + 0.55 * rp) + (s.spd - 1) * 2);
    this.rollT--; this.state = 'roll';
    if (this.t % 4 === 0) w.dust(this.x + 5, this.y + 22, 1);
    if (this.rollT === 0) this.vx *= 0.4;
  } else if (!locked) {
    var mult = attacking ? 0.4 : (guarding ? 0.25 : (drinking ? 0.5 : 1));
    var acc = this.onGround ? 0.45 : 0.28;
    var target = dir * spd * mult;
    if (dir !== 0 && !attacking && !guarding) this.face = dir;
    if (dir !== 0 || !attacking) {
      if (this.vx < target) this.vx = Math.min(target, this.vx + acc); else if (this.vx > target) this.vx = Math.max(target, this.vx - acc);
    }
    if (dir === 0 && this.onGround) this.vx *= 0.78;
  }
  if (this.hurtT > 0) this.vx *= 0.97;

  // ---- weapons ----
  if (!locked && !rolling && !drinking) {
    var slots = ['attack', 'secondary'];
    for (var sl = 0; sl < 2; sl++) {
      var wp = this.run.weapons[sl];
      if (!wp) continue;
      if (wp.type === 'shield') {
        if (I.isDown(slots[sl]) && !attacking && this.atkCd === 0 && (this.guard > 0 || I.pressed(slots[sl]))) {
          if (this.guard === 0) { this.guardSlot = sl; this.parryT = 12; AB.sfx('block'); }
          if (this.guard < 90) this.guard++; else this.guard = 0;
        } else if (this.guard > 0 && this.guardSlot === sl) { this.guard = 0; this.atkCd = 12; }
      } else if (I.pressed(slots[sl])) { this.buf.slot = sl; this.buf.t = 9; }
    }
    if (this.buf.t > 0 && !attacking && this.atkCd === 0 && !guarding) this.startAttack(w, this.buf.slot, I);
    if (this.parryT > 0) this.parryT--;
    if (this.guard === 0) this.parryT = 0;
    // skills
    if (I.pressed('skill1')) this.useSkill(w, 0);
    if (I.pressed('skill2')) this.useSkill(w, 1);
    if (I.pressed('heal')) this.startDrink(w);
  }
  if (this.atk) this.updateAttack(w, I);
  if (drinking) {
    this.drinkT--;
    if (this.t % 6 === 0) w.burst(this.x + 5, this.y + 6, '#7affb0', 2, { vy: -1, life: 24, size: 2 });
    if (this.drinkT === 0) {
      var amt = Math.round(s.maxHp * (0.4 + s.flaskHeal));
      this.heal(w, amt); AB.sfx('heal');
    }
  }

  // ---- physics ----
  this.vy = Math.min(this.vy + GRAV, MAXFALL);
  if (this.vy > 2) this.fallV = this.vy;
  var landed = AB.moveBody(this, lvl);
  if (landed) {
    this.landSq = 6; AB.sfx('land');
    if (this.fallV > 4) w.dust(this.x + 5, this.y + 22, 5);
    this.fallV = 0;
  }
  // ---- hazards ----
  if (AB.touchesTile(this, lvl, TILE.SPIKE) && this.iframes <= 0 && this.noHurtT <= 0) {
    w.hurtPlayer(Math.max(12, Math.round(s.maxHp * 0.12)), this.x, { spike: true });
    this.x = this.safeX; this.y = this.safeY; this.vx = 0; this.vy = 0; this.iframes = 50;
  } else if (AB.touchesTile(this, lvl, TILE.SPIKE)) { this.x = this.safeX; this.y = this.safeY; this.vx = 0; this.vy = 0; }
  if (this.onGround && !this.dead) {
    this.safeT++;
    if (this.safeT > 8) {
      var cx = Math.floor((this.x + 5) / T), fy = Math.floor((this.y + 23) / T);
      if (lvl.tileAt(cx - 1, fy) !== TILE.SPIKE && lvl.tileAt(cx + 1, fy) !== TILE.SPIKE && lvl.tileAt(cx - 2, fy) !== TILE.SPIKE && lvl.tileAt(cx + 2, fy) !== TILE.SPIKE &&
          lvl.tileAt(cx - 1, fy) !== TILE.AIR && lvl.tileAt(cx + 1, fy) !== TILE.AIR && lvl.tileAt(cx - 2, fy) !== TILE.AIR && lvl.tileAt(cx + 2, fy) !== TILE.AIR) { this.safeX = this.x; this.safeY = this.y; }
    }
  } else this.safeT = 0;

  // ---- state / anim ----
  if (!rolling) {
    if (this.hurtT > 0) this.state = 'hurt';
    else if (guarding) this.state = 'guard';
    else if (attacking) this.state = 'attack';
    else if (drinking) this.state = 'drink';
    else if (!this.onGround) this.state = this.vy < 0 ? 'jump' : 'fall';
    else this.state = Math.abs(this.vx) > 0.3 ? 'run' : 'idle';
  }
  this.anim += this.state === 'run' ? Math.abs(this.vx) * 0.16 : 0.07;
  if (this.state === 'run' && this.onGround && this.t % 9 === 0) w.dust(this.x + 5, this.y + 22, 1);

  // scarf physics
  var hx = this.x + 5 - this.face * 3, hy = this.y + 7;
  var prev = { x: hx, y: hy };
  for (var i = 0; i < this.scarf.length; i++) {
    var sc = this.scarf[i];
    sc.x += (prev.x - this.face * 1.8 - sc.x) * 0.4 - this.vx * 0.12;
    sc.y += (prev.y + 0.9 + Math.sin(this.t * 0.18 + i) * 0.35 - sc.y) * 0.4 + Math.min(this.vy, 3) * -0.12;
    prev = sc;
  }
};

Player.prototype.heal = function (w, amt) {
  var before = this.hp;
  this.hp = Math.min(this.s.maxHp, this.hp + amt);
  if (this.hp > before) w.text(this.x + 5, this.y - 4, '+' + Math.round(this.hp - before), '#7affb0');
  w.burst(this.x + 5, this.y + 10, '#7affb0', 10, { vy: -1.2, vx: 1.2, life: 30, size: 2 });
};
Player.prototype.startDrink = function (w) {
  if (this.drinkT > 0 || this.run.flasks <= 0 || this.hp >= this.s.maxHp || this.rollT > 0 || this.atk) {
    if (this.run.flasks <= 0 || this.hp >= this.s.maxHp) AB.sfx('error');
    return;
  }
  this.run.flasks--; this.drinkT = 32; this.guard = 0;
};

/* ---------- attacks ---------- */
Player.prototype.startAttack = function (w, slot, I) {
  var wp = this.run.weapons[slot]; if (!wp) return;
  this.buf.t = 0;
  var rate = Math.max(6, Math.round(wp.rate / this.s.atkSpd));
  this.atk = { slot: slot, wp: wp, t: 0, dur: rate, hit: [], combo: 0, fired: false, up: I.isDown('up') };
  if (wp.type === 'melee') {
    if (wp.combo > 1) { this.atk.combo = this.comboT > 0 ? this.combo % wp.combo : 0; this.combo = this.atk.combo + 1; this.comboT = rate + 22; }
    if (this.atk.combo === wp.combo - 1 && wp.combo >= 3) this.atk.dur = Math.round(rate * 1.3);
    this.vx += this.face * (wp.thrust ? 1.8 : 1.1);
    AB.sfx(wp.dmg > 30 ? 'swingHeavy' : 'swing');
  } else AB.sfx(wp.id === 'stormbolt' ? 'shoot' : 'bow');
  this.atkCd = 0;
};
Player.prototype.updateAttack = function (w, I) {
  var a = this.atk, wp = a.wp; a.t++;
  var p = a.t / a.dur;
  if (wp.type === 'melee') {
    // active window
    if (p > 0.2 && p < 0.65) {
      var hb = this.meleeBox(a);
      w.playerMelee(this, hb, a);
    }
    if (wp.slam && !a.fired && a.t === Math.round(a.dur * 0.4)) {
      a.fired = true;
      w.shake(5); AB.sfx('slam');
      w.slamWave(this.x + 5 + this.face * 18, this.y + 22, this.face, wp.dmg * this.dmgMul() * 0.7, wp);
    }
  } else if (wp.type === 'ranged') {
    if (!a.fired && p >= 0.3) {
      a.fired = true;
      var ay = I.isDown('up') ? -0.55 : (I.isDown('down') && !this.onGround ? 0.55 : 0);
      var sp = wp.speed, len = Math.sqrt(1 + ay * ay);
      var arrow = w.spawnProj({
        x: this.x + 5 + this.face * 8, y: this.y + 10, vx: this.face * sp / len, vy: ay * sp / len, team: 'p',
        kind: wp.id === 'stormbolt' ? 'bolt' : 'arrow', dmg: wp.dmg * this.dmgMul(), pierce: wp.pierce, kb: wp.kb, w: 6, h: 4, life: 70,
        wp: wp, grav: wp.id === 'stormbolt' ? 0 : 0.03
      });
      this.vx -= this.face * 0.9;
      w.burst(this.x + 5 + this.face * 10, this.y + 10, wp.color, 4, { vx: 1.2, vy: 0.6, life: 10, size: 1 });
    }
  }
  if (a.t >= a.dur) { this.atk = null; this.atkCd = wp.type === 'melee' ? 0 : 2; }
};
Player.prototype.meleeBox = function (a) {
  var wp = a.wp, f = this.face, reach = wp.reach, cx = this.x + 5;
  var bw = reach, bh = 26, by = this.y - 1;
  if (wp.thrust) { bh = 12; by = this.y + 5; bw = reach + 4; }
  else if (wp.cleave || wp.slam) { bh = 36; by = this.y - 8; bw = reach + 6; }
  else if (a.combo === 2) { bh = 32; by = this.y - 5; bw = reach + 8; }
  if (wp.id === 'twinfang') { bh = 20; by = this.y + 2; }
  var bx = f > 0 ? cx + 2 : cx - 2 - bw;
  return { x: bx, y: by, w: bw, h: bh };
};

/* ---------- skills ---------- */
Player.prototype.useSkill = function (w, i) {
  var id = this.run.skills[i];
  if (!id || this.cd[i] > 0 || this.drinkT > 0) { if (id && this.cd[i] > 0) AB.sfx('error'); return; }
  var sk = AB.SKILLS[id];
  var ok = AB.skillFx[id](w, this, sk);
  if (ok === false) return;
  this.cd[i] = Math.round(sk.cd * (1 - Math.min(0.6, this.s.cdr)));
  this.cdMax = this.cdMax || [1, 1]; this.cdMax[i] = this.cd[i];
  this.atk = null;
};

AB.skillFx = {
  firebomb: function (w, p, sk) {
    AB.sfx('shoot');
    w.spawnProj({ x: p.x + 5 + p.face * 6, y: p.y + 6, vx: p.face * 3.2 + p.vx * 0.4, vy: -3.8, grav: 0.22, team: 'p', kind: 'bomb', dmg: sk.dmg * p.dmgMul(),
                  w: 7, h: 7, life: 120, bounce: 0.35, fuse: 55, radius: 44, ignite: 1, pierce: 99, noHit: true });
  },
  frostnova: function (w, p, sk) {
    AB.sfx('ice'); w.shake(3);
    var cx = p.x + 5, cy = p.y + 11;
    w.ring(cx, cy, 80, '#8ae0ff');
    w.enemiesNear(cx, cy, 80, function (e) {
      w.damageEnemy(e, sk.dmg * p.dmgMul(), { kb: 2.5, dir: AB.sign(e.x - p.x) || 1, freeze: 1, src: 'skill', color: '#8ae0ff' });
    });
    w.burst(cx, cy, '#cfeeff', 24, { vx: 3, vy: 3, life: 30, size: 2 });
    w.deflectProj(cx, cy, 80);
  },
  turret: function (w, p, sk) {
    AB.sfx('pickup');
    var t = new Turret(p.x + 5 + p.face * 14, p.y + 22, sk.dmg * p.dmgMul(), p.run.turretLife || 480);
    w.allies.push(t);
    w.burst(t.x, t.y - 6, '#9aff9a', 10, { vx: 1.5, vy: 1.5, life: 24, size: 2 });
  },
  chainbolt: function (w, p, sk) {
    var cx = p.x + 5, cy = p.y + 8, hits = [], seen = [];
    var cur = { x: cx, y: cy };
    for (var i = 0; i < 5; i++) {
      var best = null, bd = 150;
      for (var k = 0; k < w.enemies.length; k++) {
        var e = w.enemies[k]; if (e.dead || seen.indexOf(e) >= 0) continue;
        var d = AB.dist(cur.x, cur.y, e.x + e.w / 2, e.y + e.h / 2);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) break;
      seen.push(best); hits.push(best); cur = { x: best.x + best.w / 2, y: best.y + best.h / 2 };
    }
    if (!hits.length) { AB.sfx('error'); return false; }
    AB.sfx('zap'); w.shake(3);
    var pts = [{ x: cx, y: cy }];
    for (var j = 0; j < hits.length; j++) {
      var h = hits[j];
      pts.push({ x: h.x + h.w / 2, y: h.y + h.h / 2 });
      w.damageEnemy(h, sk.dmg * p.dmgMul() * (1 - j * 0.08), { kb: 1.5, dir: AB.sign(h.x - p.x) || 1, src: 'skill', color: '#ffe84a', stun: 20 });
    }
    w.bolts.push({ pts: pts, t: 14 });
  },
  warcry: function (w, p, sk) {
    AB.sfx('warcry'); w.shake(6); p.buffT = 360;
    w.ring(p.x + 5, p.y + 11, 70, '#ff5a5a');
    w.enemiesNear(p.x + 5, p.y + 11, 70, function (e) {
      w.damageEnemy(e, sk.dmg * p.dmgMul(), { kb: 6, dir: AB.sign(e.x - p.x) || 1, src: 'skill', color: '#ff5a5a', stun: 30 });
    });
    w.deflectProj(p.x + 5, p.y + 11, 70);
    w.burst(p.x + 5, p.y + 11, '#ff7a5a', 22, { vx: 3, vy: 2, life: 28, size: 2 });
  },
  shadowstep: function (w, p, sk) {
    AB.sfx('roll');
    var dir = p.face, dist = 0, ox = p.x;
    var box = { x: p.x, y: p.y, w: p.w, h: p.h };
    for (var i = 0; i < 12; i++) {
      var nx = box.x + dir * 8;
      var tx = Math.floor((dir > 0 ? nx + box.w : nx) / T), blocked = false;
      for (var ty = Math.floor(box.y / T); ty <= Math.floor((box.y + box.h - 1) / T); ty++) if (w.level.solidAt(tx, ty)) blocked = true;
      if (blocked) break;
      box.x = nx; dist += 8;
      w.burst(box.x + 5, box.y + 11, '#b08aff', 2, { vx: 0.3, vy: 0.3, life: 20, size: 3 });
    }
    var hb = { x: Math.min(ox, box.x) - 4, y: p.y - 4, w: Math.abs(box.x - ox) + 18, h: 30 };
    for (var k = 0; k < w.enemies.length; k++) {
      var e = w.enemies[k];
      if (!e.dead && AB.overlap(hb, e)) w.damageEnemy(e, sk.dmg * p.dmgMul(), { kb: 3, dir: dir, src: 'skill', color: '#b08aff', stun: 20 });
    }
    p.x = box.x; p.iframes = Math.max(p.iframes, 20); p.vx = dir * 1.2;
  }
};

/* ===================== PROJECTILES ===================== */
function Proj(o) {
  this.x = o.x; this.y = o.y; this.vx = o.vx || 0; this.vy = o.vy || 0;
  this.w = o.w || 6; this.h = o.h || 6; this.team = o.team; this.kind = o.kind || 'orb';
  this.dmg = o.dmg || 1; this.life = o.life || 120; this.pierce = o.pierce || 0; this.grav = o.grav || 0;
  this.kb = o.kb === undefined ? 2 : o.kb; this.wp = o.wp; this.hit = [];
  this.bounce = o.bounce || 0; this.fuse = o.fuse || 0; this.radius = o.radius || 0; this.ignite = o.ignite || 0;
  this.small = o.small !== false && this.team === 'e'; this.dead = false; this.t = 0;
  this.color = o.color || null; this.noHit = !!o.noHit; this.homing = o.homing || 0; this.spin = 0;
  this.status = o.status || null; this.reflected = false;
}
AB.Proj = Proj;
var PCOL = { arrow: '#e8c070', bolt: '#7ad8ff', orb: '#c070ff', fire: '#ff8a3a', bomb: '#ff8a3a', bone: '#e8e0d0', shard: '#9ae8ff', needle: '#ff5a5a', ember: '#ffb04a', laser: '#ff4a6a' };
Proj.prototype.col = function () { return this.color || PCOL[this.kind] || '#fff'; };

Proj.prototype.update = function (w) {
  this.t++;
  if (this.homing && w.player && !w.player.dead) {
    var dx = w.player.x + 5 - this.x, dy = w.player.y + 10 - this.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    var sp = Math.sqrt(this.vx * this.vx + this.vy * this.vy) || 1;
    this.vx += dx / d * this.homing; this.vy += dy / d * this.homing;
    var ns = Math.sqrt(this.vx * this.vx + this.vy * this.vy) || 1;
    this.vx = this.vx / ns * sp; this.vy = this.vy / ns * sp;
  }
  this.vy += this.grav;
  this.x += this.vx; this.y += this.vy;
  this.spin += 0.3;
  if (--this.life <= 0) { this.die(w, false); return; }
  if (this.kind === 'bomb' && this.fuse > 0 && --this.fuse <= 0) { this.die(w, true); return; }
  // world collision
  var tx = Math.floor((this.x + this.w / 2) / T), ty = Math.floor((this.y + this.h / 2) / T);
  if (w.level.solidAt(tx, ty)) {
    if (this.bounce) {
      var up = !w.level.solidAt(tx, Math.floor((this.y + this.h / 2 - this.vy) / T));
      if (up) { this.y -= this.vy; this.vy *= -this.bounce; this.vx *= 0.7; } else { this.x -= this.vx; this.vx *= -this.bounce; }
    } else { this.die(w, true); return; }
  }
  if (this.kind === 'bomb' || this.noHit) { if (this.kind !== 'bomb') {} else {
    // bombs detonate on enemy contact
    for (var q = 0; q < w.enemies.length; q++) { var en = w.enemies[q]; if (!en.dead && AB.overlap(this, en)) { this.die(w, true); return; } }
    return; } }
  if (this.team === 'p') {
    for (var i = 0; i < w.enemies.length; i++) {
      var e = w.enemies[i];
      if (e.dead || this.hit.indexOf(e) >= 0 || !AB.overlap(this, e)) continue;
      this.hit.push(e);
      var dir = AB.sign(this.vx) || 1;
      w.playerHit(e, this.dmg, { kb: this.kb, dir: dir, wp: this.wp, src: 'proj', color: this.col(), fromX: this.x - this.vx * 2, ranged: true });
      if (this.pierce-- <= 0) { this.die(w, false); return; }
    }
    w.hitProps(this);
  } else {
    var p = w.player;
    if (p && !p.dead && AB.overlap(this, p)) {
      var res = w.hurtPlayer(this.dmg, this.x, { proj: this, status: this.status });
      if (res === 'parried') return;
      if (res !== 'ignored' || !this.small) this.die(w, false);
    }
  }
};
Proj.prototype.die = function (w, hitWorld) {
  if (this.dead) return; this.dead = true;
  if (this.kind === 'bomb') {
    w.explode(this.x + this.w / 2, this.y + this.h / 2, this.radius || 40, this.dmg, this.team, { ignite: this.ignite, color: this.col() });
  } else if (hitWorld || this.team === 'e') {
    w.burst(this.x, this.y, this.col(), 5, { vx: 1.5, vy: 1.5, life: 12, size: 1 });
  }
};
Proj.prototype.draw = function (c, cx, cy, t) {
  var x = Math.round(this.x - cx), y = Math.round(this.y - cy), col = this.col();
  switch (this.kind) {
    case 'arrow': {
      var ang = Math.atan2(this.vy, this.vx);
      c.save(); c.translate(x + 3, y + 2); c.rotate(ang);
      c.fillStyle = '#c8b090'; c.fillRect(-8, -1, 14, 2); c.fillStyle = '#fff'; c.fillRect(4, -1, 4, 2);
      c.fillStyle = '#ddd'; c.fillRect(-9, -2, 3, 1); c.fillRect(-9, 1, 3, 1);
      c.restore(); break; }
    case 'bolt': {
      var a2 = Math.atan2(this.vy, this.vx);
      c.save(); c.translate(x + 3, y + 2); c.rotate(a2);
      c.fillStyle = col; c.fillRect(-12, -2, 18, 4); c.fillStyle = '#fff'; c.fillRect(-8, -1, 16, 2); c.restore();
      AB.glow(c, x + 3, y + 2, 16, col, 0.7); break; }
    case 'bomb':
      c.fillStyle = '#1a1420'; c.fillRect(x, y, 7, 7); c.fillStyle = col; c.fillRect(x + 1, y + 1, 5, 5);
      c.fillStyle = (t >> 2) & 1 ? '#fff' : '#ffb04a'; c.fillRect(x + 3, y - 2, 2, 2);
      AB.glow(c, x + 3, y + 3, 14, col, 0.6); break;
    case 'bone':
      c.save(); c.translate(x + 3, y + 3); c.rotate(this.spin);
      c.fillStyle = '#e8e0d0'; c.fillRect(-5, -1, 10, 2); c.fillRect(-5, -2, 2, 4); c.fillRect(3, -2, 2, 4); c.restore(); break;
    case 'shard': {
      var a3 = Math.atan2(this.vy, this.vx);
      c.save(); c.translate(x + 3, y + 3); c.rotate(a3);
      c.fillStyle = col; c.fillRect(-6, -2, 12, 4); c.fillStyle = '#fff'; c.fillRect(0, -1, 7, 2); c.restore();
      AB.glow(c, x + 3, y + 3, 10, col, 0.5); break; }
    case 'laser':
      c.fillStyle = col; c.fillRect(x - 2, y - 1, 10, 6); c.fillStyle = '#fff'; c.fillRect(x, y + 1, 6, 2);
      AB.glow(c, x + 3, y + 3, 14, col, 0.6); break;
    default: { // orb / fire / ember / needle
      var r = this.kind === 'fire' ? 5 : 4, pul = 1 + Math.sin(t * 0.4 + this.x) * 0.5;
      c.fillStyle = col; c.fillRect(x + 3 - r, y + 3 - r + 1, r * 2, r * 2 - 2); c.fillRect(x + 3 - r + 1, y + 3 - r, r * 2 - 2, r * 2);
      c.fillStyle = '#fff'; c.fillRect(x + 2, y + 2, 2, 2);
      AB.glow(c, x + 3, y + 3, 14 + pul * 3, col, 0.7);
    }
  }
};

/* ===================== ALLY TURRET ===================== */
function Turret(x, y, dmg, life) { this.x = x; this.y = y; this.dmg = dmg; this.life = life; this.cd = 20; this.face = 1; this.t = 0; this.dead = false; }
Turret.prototype.update = function (w) {
  this.t++; if (--this.life <= 0) { this.dead = true; w.burst(this.x, this.y - 6, '#9aff9a', 8, { life: 20, size: 2 }); return; }
  if (--this.cd > 0) return;
  var best = null, bd = 190;
  for (var i = 0; i < w.enemies.length; i++) {
    var e = w.enemies[i]; if (e.dead) continue;
    var d = AB.dist(this.x, this.y - 8, e.x + e.w / 2, e.y + e.h / 2);
    if (d < bd) { bd = d; best = e; }
  }
  if (best) {
    var dx = best.x + best.w / 2 - this.x, dy = best.y + best.h / 2 - (this.y - 8), d2 = Math.sqrt(dx * dx + dy * dy) || 1;
    this.face = dx >= 0 ? 1 : -1;
    w.spawnProj({ x: this.x - 3, y: this.y - 11, vx: dx / d2 * 6, vy: dy / d2 * 6, team: 'p', kind: 'bolt', dmg: this.dmg, w: 5, h: 4, life: 40, pierce: 0, kb: 0.8, color: '#9aff9a' });
    AB.sfx('shoot'); this.cd = 22;
  } else this.cd = 6;
};
Turret.prototype.draw = function (c, cx, cy, t) {
  var x = Math.round(this.x - cx), y = Math.round(this.y - cy);
  c.fillStyle = '#1a1420'; c.fillRect(x - 7, y - 6, 14, 6); c.fillStyle = '#6a6a7a'; c.fillRect(x - 6, y - 5, 12, 4);
  c.fillStyle = '#1a1420'; c.fillRect(x - 5, y - 14, 10, 9); c.fillStyle = '#9aff9a'; c.fillRect(x - 4, y - 13, 8, 7);
  c.fillStyle = '#1a1420'; c.fillRect(this.face > 0 ? x + 3 : x - 11, y - 11, 8, 3);
  c.fillStyle = '#fff'; c.fillRect(x - 1 + this.face * 2, y - 11, 2, 2);
  AB.glow(c, x, y - 9, 18, '#9aff9a', 0.35 + Math.sin(t * 0.2) * 0.1);
  if (this.life < 90 && (t >> 2) & 1) { c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(x - 5, y - 14, 10, 9); }
};
AB.Turret = Turret;
})();
