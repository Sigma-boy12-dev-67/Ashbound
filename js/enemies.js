(function () {
'use strict';
var AB = window.AB;
var T = AB.T, TILE = AB.TILE;
function R(c, col, x, y, w, h) { c.fillStyle = col; c.fillRect(x, y, w, h); }

var PALS = [
  { skin: '#8a9a7a', cloth: '#4a4660', dark: '#22202e', glow: '#9aff9a', bone: '#d8d0b8', blood: '#6a8a4a' },
  { skin: '#7a5444', cloth: '#4a2a26', dark: '#1a0e0c', glow: '#ff8a2a', bone: '#c8a888', blood: '#ff6a2a' },
  { skin: '#9ab0d0', cloth: '#3a4a78', dark: '#14182a', glow: '#7ae0ff', bone: '#d0e8f8', blood: '#9ae8ff' }
];
AB.PALS = PALS;
AB.ENEMY = {};
AB.BOSSES = {};
var E = AB.ENEMY;

/* ===================== FRAMEWORK ===================== */
AB.spawnEnemy = function (w, type, x, y, o) {
  o = o || {};
  var def = AB.ENEMY[type] || AB.BOSSES[type], B = w.biome, asc = 1 + 0.15 * (AB.save.data.asc || 0);
  var e = {
    type: type, def: def, w: def.w, h: def.h, vx: 0, vy: 0, face: -1, onGround: false, flash: 0, stun: 0, freezeT: 0, burn: 0, slow: 0,
    hurtT: 0, t: 0, state: 'idle', st: 0, dead: false, boss: !!def.boss, arena: o.arena, tele: false, alpha: 1,
    gold: def.gold, blood: PALS[w.stage].blood, pal: PALS[w.stage], kbRes: def.kbRes || 0, noKb: !!def.noKb, noStun: !!def.noStun,
    armor: 0, elite: null, spd: 1, atkMul: 1, lastHit: -999, bi: w.stage, aux: {}
  };
  if (def.fly) { e.x = x - e.w / 2; e.y = y - e.h / 2; } else { e.x = x - e.w / 2; e.y = y - e.h; }
  var hpMul = def.boss ? 1 : B.hpMul;
  e.maxHp = e.hp = Math.round(def.hp * hpMul * asc * (def.boss ? 1 + (AB.save.data.asc || 0) * 0.2 : 1));
  e.dmg = def.dmg * (def.boss ? 1 + w.stage * 0.0 : B.dmgMul) * (1 + 0.1 * (AB.save.data.asc || 0));
  if (o.elite && !def.boss) {
    e.elite = AB.pick(['frenzied', 'armored', 'volatile']);
    e.maxHp = e.hp = Math.round(e.maxHp * 1.8);
    if (e.elite === 'frenzied') { e.spd = 1.3; e.atkMul = 0.7; }
    if (e.elite === 'armored') { e.armor = 0.3; e.maxHp = e.hp = Math.round(e.maxHp * 1.3); }
    e.dmg *= 1.15; e.gold = (e.gold || 3) + 3;
  }
  e.home = e.x; e.dir = AB.chance(0.5) ? 1 : -1;
  if (o.spawnFx) { e.spawnT = 36; w.ring(e.x + e.w / 2, e.y + e.h / 2, 30, def.boss ? '#ff4a4a' : e.pal.glow); }
  e.cancel = function () { if (!def.superArmor) { e.tele = false; if (e.state !== 'dead') { e.state = 'chase'; e.st = 0; } } };
  if (def.init) def.init(e, w);
  w.enemies.push(e);
  return e;
};

AB.updateEnemy = function (e, w) {
  if (e.spawnT > 0) { e.spawnT--; if (e.spawnT === 0) { w.burst(e.x + e.w / 2, e.y + e.h / 2, e.pal.glow, 12, { life: 18, size: 2 }); } return; }
  var p = w.player;
  var far = Math.abs(e.x - p.x) > 480 || Math.abs(e.y - p.y) > 330;
  if (far && !e.boss && e.arena === undefined) { if (!e.def.fly) { e.vy = Math.min(e.vy + 0.4, 8); AB.moveBody(e, w.level); } return; }
  e.t++;
  if (e.flash > 0) e.flash--;
  if (e.hitF > 0) e.hitF--;
  if (e.burn > 0) {
    e.burn--;
    if (e.burn % 30 === 0) w.damageEnemy(e, Math.max(3, Math.round(6 * (1 + 0.3 * w.stage) * (1 + p.s.dmg * 0.2))), { src: 'dot', kb: 0 });
    if (e.burn % 4 === 0) w.burst(e.x + e.w / 2 + AB.rand(-4, 4), e.y + AB.rand(0, e.h * 0.6), '#ff8a2a', 1, { vx: 0.2, vy: 0.2, dy: -0.8, g: -0.02, life: 16, size: 2, glow: true });
    if (e.dead) return;
  }
  if (e.freezeT > 0) { e.freezeT--; physicsOnly(e, w); if (e.freezeT === 0) w.burst(e.x + e.w / 2, e.y + e.h / 2, '#cfeeff', 10, { life: 16, size: 2 }); return; }
  if (e.stun > 0) { e.stun--; e.tele = false; physicsOnly(e, w); return; }
  if (e.hurtT > 0 && !e.boss && !e.def.superArmor) { e.hurtT--; if (e.state === 'windup' || e.state === 'strike' || e.state === 'cast') e.cancel(); physicsOnly(e, w); return; }
  if (e.slow > 0) e.slow--;
  e.def.update(e, w);
  if (e.elite === 'volatile' && e.t % 20 === 0) w.burst(e.x + e.w / 2, e.y + 4, '#ff5a1a', 1, { life: 14, size: 2, glow: true, g: -0.03 });
};
function physicsOnly(e, w) {
  if (e.def.fly) { e.vx *= 0.9; e.vy *= 0.9; moveFly(e, w); return; }
  e.vy = Math.min(e.vy + 0.4, 8); AB.moveBody(e, w.level); if (e.onGround) e.vx *= 0.8;
}
function moveFly(e, w) {
  var L = w.level, nx = e.x + e.vx, ny = e.y + e.vy;
  var cx = Math.floor((nx + e.w / 2) / T), cy = Math.floor((e.y + e.h / 2) / T);
  if (L.solidAt(cx, cy)) { e.vx = -e.vx * 0.5; } else e.x = nx;
  cx = Math.floor((e.x + e.w / 2) / T); cy = Math.floor((ny + e.h / 2) / T);
  if (L.solidAt(cx, cy)) { e.vy = -e.vy * 0.5; } else e.y = ny;
}
AB.moveFly = moveFly;
function pdx(e, w) { return (w.player.x + 5) - (e.x + e.w / 2); }
function pdy(e, w) { return (w.player.y + 11) - (e.y + e.h / 2); }
AB.pdx = pdx; AB.pdy = pdy;
function face(e, w) { var d = pdx(e, w); if (Math.abs(d) > 2) e.face = d > 0 ? 1 : -1; }
function walk(e, w, dir, sp) {
  sp *= e.spd * (e.slow > 0 ? 0.5 : 1);
  if (e.onGround) { if (Math.abs(e.vx) < sp * 1.3) e.vx = dir * sp; } else e.vx += dir * 0.05;
  e.vy = Math.min(e.vy + 0.4, 8); AB.moveBody(e, w.level);
}
function stand(e, w) { e.vy = Math.min(e.vy + 0.4, 8); AB.moveBody(e, w.level); if (e.onGround) e.vx *= 0.75; }
function atkBox(e, reach, h, yoff) { return { x: e.face > 0 ? e.x + e.w - 2 : e.x - reach + 2, y: e.y + (yoff || 2), w: reach, h: h }; }
function canSee(e, w, range) {
  var dx = Math.abs(pdx(e, w)), dy = Math.abs(pdy(e, w));
  return dx < range && dy < 70 && !w.player.dead;
}
function patrol(e, w, sp) {
  if (!AB.floorAhead(e, w.level, e.dir, 4) || AB.wallAhead(e, w.level, e.dir) || Math.abs(e.x - e.home) > 90) { e.dir = -e.dir; if (Math.abs(e.x - e.home) > 90) e.dir = e.x > e.home ? -1 : 1; }
  e.face = e.dir; walk(e, w, e.dir, sp * 0.6);
}
AB.eh = { pdx: pdx, pdy: pdy, face: face, walk: walk, stand: stand, atkBox: atkBox, canSee: canSee, patrol: patrol };

/* ---- shared drawing helpers ---- */
function begin(e, c, cx, cy, t) {
  var x = Math.round(e.x + e.w / 2 - cx), y = Math.round(e.y + e.h - cy);
  c.save();
  if (e.spawnT > 0) c.globalAlpha = 1 - e.spawnT / 36 * 0.85;
  else if (e.alpha < 1) c.globalAlpha = e.alpha;
  return { x: x, y: y };
}
function colorFn(e) {
  var fl = e.flash > 0, fz = e.freezeT > 0;
  return function (col) { return fl ? '#ffffff' : (fz ? AB.mix(col, '#9ad8ff', 0.55) : col); };
}
function tele(c, e, x, y) {
  if (!e.tele) return;
  var b = Math.sin(e.t * 0.5) * 1.5;
  R(c, '#1a0000', x - 2, y - e.h - 14 + b, 5, 9); R(c, '#ff3a2a', x - 1, y - e.h - 13 + b, 3, 5); R(c, '#ff3a2a', x - 1, y - e.h - 6 + b, 3, 2);
  AB.glow(c, x, y - e.h - 8, 14, '#ff3a2a', 0.6);
}
function finish(e, c, x, y, t) {
  if (e.elite) {
    var ec = e.elite === 'frenzied' ? '#ff4a4a' : (e.elite === 'armored' ? '#8ab0ff' : '#ff9a2a');
    AB.glow(c, x, y - e.h / 2, e.w + 16, ec, 0.45 + Math.sin(t * 0.2) * 0.12);
    R(c, ec, x - 2, y - e.h - 8, 4, 4); R(c, '#fff', x - 1, y - e.h - 7, 2, 1);
  }
  if (e.burn > 0) AB.glow(c, x, y - e.h / 2, e.w + 10, '#ff8a2a', 0.5);
  if (e.freezeT > 0) { c.globalAlpha = 0.5; R(c, '#bfe8ff', x - e.w / 2 - 1, y - e.h, e.w + 2, e.h); c.globalAlpha = 1; R(c, '#fff', x - e.w / 2, y - e.h, 2, e.h * 0.4); }
  tele(c, e, x, y);
  if (!e.boss && e.t > 0 && e.hp < e.maxHp && e.hp > 0 && (e.lastHit > 0)) {
    var show = (t - (e.lastHit || 0)) < 150 || e.elite;
    if (show) { var bw = Math.max(14, e.w + 4); AB.bar(c, x - bw / 2, y - e.h - 5, bw, 2, e.hp, e.maxHp, e.elite ? '#ff9a4a' : '#d83a4a'); }
  }
  c.restore();
}
// ground shadow
function shadow(c, x, y, wd) { c.globalAlpha = 0.25; R(c, '#000', x - wd / 2, y - 1, wd, 2); c.globalAlpha = 1; }

/* ===================== HUSK ===================== */
E.husk = {
  name: 'Husk', w: 12, h: 20, hp: 44, dmg: 13, gold: 4,
  update: function (e, w) {
    var p = w.player, dx = pdx(e, w), adx = Math.abs(dx);
    e.st++;
    if (e.state === 'idle' || e.state === 'chase') {
      if (canSee(e, w, 170)) {
        e.state = 'chase'; face(e, w);
        if (adx > 22) {
          if (AB.floorAhead(e, w.level, e.face, 6) && !AB.wallAhead(e, w.level, e.face)) walk(e, w, e.face, 0.9); else stand(e, w);
          if (AB.wallAhead(e, w.level, e.face) && e.onGround && e.st % 40 === 0) e.vy = -5.2;
        } else { e.state = 'windup'; e.st = 0; e.tele = true; stand(e, w); }
      } else { e.state = 'idle'; patrol(e, w, 0.8); }
    } else if (e.state === 'windup') {
      stand(e, w);
      if (e.st >= Math.round(24 * e.atkMul)) { e.state = 'strike'; e.st = 0; e.tele = false; e.vx = e.face * 1.8; AB.sfx('swing'); }
    } else if (e.state === 'strike') {
      stand(e, w);
      if (e.st < 8) { var box = atkBox(e, 22, 16, 3); if (AB.overlap(box, p) && !e.hitDone) { if (w.hurtPlayer(e.dmg, e.x + e.w / 2, {}) !== 'ignored') e.hitDone = true; } }
      if (e.st > 18) { e.state = 'recover'; e.st = 0; e.hitDone = false; }
    } else if (e.state === 'recover') { stand(e, w); if (e.st > 24 * e.atkMul) { e.state = 'chase'; e.st = 0; } }
  },
  draw: function (e, c, cx, cy, t) {
    var o = begin(e, c, cx, cy, t), K = colorFn(e), P = e.pal;
    shadow(c, o.x, o.y, 14);
    c.translate(o.x, o.y); c.scale(e.face, 1);
    var moving = Math.abs(e.vx) > 0.2 && e.onGround, ph = e.t * 0.2, sw = moving ? Math.round(Math.sin(ph) * 3) : 0;
    var wind = e.state === 'windup', strike = e.state === 'strike';
    R(c, K(P.dark), -4 + sw, -8, 3, 8); R(c, K(P.dark), 1 - sw, -8, 3, 8);
    R(c, K(P.cloth), -5, -16, 10, 10); R(c, K('#00000033'), -5, -9, 10, 3);
    R(c, K(P.skin), -3, -20 + (moving ? Math.round(Math.sin(ph * 2)) : 0), 7, 6);
    R(c, K(P.dark), 1, -19, 3, 2); R(c, K(P.glow), 2, -18, 2, 1);
    R(c, K(P.cloth), -2, -14, 2, 5);
    // arms
    var ay = wind ? -22 : (strike ? -8 : -13), ax = strike ? 10 : 5;
    R(c, K(P.skin), 3, ay, ax - 2, 3); R(c, K(P.dark), ax, ay - 1, 3, 5);
    if (strike && e.st < 8) { c.globalAlpha = 0.5; R(c, '#fff', 8, -14, 14, 2); c.globalAlpha = 1; }
    finish(e, c, 0, 0, t);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }
};

/* ===================== ARCHER ===================== */
E.archer = {
  name: 'Bonewright', w: 12, h: 22, hp: 30, dmg: 11, gold: 5,
  update: function (e, w) {
    var p = w.player, dx = pdx(e, w), adx = Math.abs(dx);
    e.st++;
    if (e.state === 'idle' || e.state === 'chase') {
      if (canSee(e, w, 230)) {
        face(e, w); e.state = 'chase';
        if (adx < 80 && AB.floorAhead(e, w.level, -e.face, 6) && !AB.wallAhead(e, w.level, -e.face)) walk(e, w, -e.face, 1.1);
        else if (adx > 160 && AB.floorAhead(e, w.level, e.face, 6)) walk(e, w, e.face, 0.8);
        else stand(e, w);
        if (adx < 40 && e.onGround && e.st % 50 === 0) { e.vy = -5; e.vx = -e.face * 2.2; }
        if (e.st > 70 * e.atkMul) { e.state = 'windup'; e.st = 0; e.tele = true; }
      } else { e.state = 'idle'; patrol(e, w, 0.6); }
    } else if (e.state === 'windup') {
      stand(e, w); face(e, w);
      if (e.st >= 26 * e.atkMul) {
        e.tele = false;
        var ox = e.x + e.w / 2 + e.face * 8, oy = e.y + 9, tx = w.player.x + 5, ty = w.player.y + 10;
        var d = Math.sqrt((tx - ox) * (tx - ox) + (ty - oy) * (ty - oy)) || 1, sp = 3.4;
        w.spawnProj({ x: ox, y: oy, vx: (tx - ox) / d * sp, vy: (ty - oy) / d * sp - 0.2, grav: 0.02, team: 'e', kind: 'arrow', dmg: e.dmg, w: 8, h: 4, life: 130, kb: 1 });
        AB.sfx('bow'); e.state = 'recover'; e.st = 0; e.vx = -e.face * 1;
      }
    } else if (e.state === 'recover') { stand(e, w); if (e.st > 18) { e.state = 'chase'; e.st = 0; } }
  },
  draw: function (e, c, cx, cy, t) {
    var o = begin(e, c, cx, cy, t), K = colorFn(e), P = e.pal;
    shadow(c, o.x, o.y, 14);
    c.translate(o.x, o.y); c.scale(e.face, 1);
    var moving = Math.abs(e.vx) > 0.2 && e.onGround, ph = e.t * 0.25, sw = moving ? Math.round(Math.sin(ph) * 3) : 0;
    R(c, K(P.bone), -3 + sw, -9, 2, 9); R(c, K(P.bone), 1 - sw, -9, 2, 9);
    R(c, K(P.dark), -4, -11, 8, 3);
    for (var i = 0; i < 3; i++) { R(c, K(P.bone), -3, -17 + i * 2, 7, 1); }
    R(c, K(P.dark), -1, -17, 1, 7);
    R(c, K(P.bone), -3, -23, 7, 6); R(c, K(P.dark), 0, -21, 4, 2); R(c, K(P.glow), 2, -21, 1, 1);
    var draw = e.state === 'windup' ? Math.min(1, e.st / 26) : 0;
    c.save(); c.translate(5, -14); AB.drawIcon(c, 'bow', -4, -8, 1, P.glow); c.restore();
    R(c, K(P.bone), 2, -15, 4, 2);
    if (e.state === 'windup') { R(c, P.glow, 4 + 4 * draw, -14, 8 - 4 * draw, 1); }
    finish(e, c, 0, 0, t);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }
};

/* ===================== BAT ===================== */
E.bat = {
  name: 'Cinderbat', w: 14, h: 10, hp: 20, dmg: 10, gold: 3, fly: true, kbRes: 0.2,
  init: function (e) { e.home = e.x; e.homeY = e.y; e.ph = Math.random() * 6; },
  update: function (e, w) {
    var p = w.player, dx = pdx(e, w), dy = pdy(e, w), d = Math.sqrt(dx * dx + dy * dy);
    e.st++;
    if (e.state === 'idle') {
      e.vx = Math.cos(e.t * 0.03 + e.ph) * 0.4; e.vy = Math.sin(e.t * 0.06 + e.ph) * 0.4; moveFly(e, w);
      if (d < 190 && !p.dead) { e.state = 'hover'; e.st = 0; }
    } else if (e.state === 'hover') {
      var tx = p.x + 5 + (e.aux.side || 1) * 60, ty = p.y - 42;
      if (e.st === 1) e.aux.side = AB.chance(0.5) ? 1 : -1;
      e.vx += (tx - (e.x + 7)) * 0.003 * e.spd; e.vy += (ty - (e.y + 5)) * 0.004 * e.spd; e.vx *= 0.94; e.vy *= 0.94;
      e.face = dx > 0 ? 1 : -1; moveFly(e, w);
      if (e.st > 55 * e.atkMul) { e.state = 'windup'; e.st = 0; e.tele = true; e.vx = 0; e.vy = -0.6; }
    } else if (e.state === 'windup') {
      e.vx *= 0.8; e.vy *= 0.9; moveFly(e, w);
      if (e.st >= 18) {
        e.tele = false; e.state = 'dive'; e.st = 0;
        var sp = 3.6 * e.spd; e.vx = dx / (d || 1) * sp; e.vy = dy / (d || 1) * sp; e.face = e.vx > 0 ? 1 : -1; AB.sfx('swing');
      }
    } else if (e.state === 'dive') {
      var ox = e.x, oy = e.y; moveFly(e, w);
      if (AB.overlap(e, p) && !e.hitDone) { if (w.hurtPlayer(e.dmg, e.x + 7, {}) !== 'ignored') e.hitDone = true; }
      if ((e.vx === 0 || e.vy === 0 || e.st > 38) || (ox === e.x && oy === e.y)) { e.state = 'retreat'; e.st = 0; e.hitDone = false; }
    } else if (e.state === 'retreat') {
      e.vy += -0.05; e.vx *= 0.95; e.vy *= 0.96; moveFly(e, w);
      if (e.st > 40) { e.state = 'hover'; e.st = 0; }
    } else { e.state = 'idle'; }
    e.wing = (e.wing || 0) + (e.state === 'dive' ? 0.6 : 0.35);
  },
  draw: function (e, c, cx, cy, t) {
    var o = begin(e, c, cx, cy, t), K = colorFn(e), P = e.pal;
    c.translate(o.x, o.y - 5); c.scale(e.face, 1);
    var fl = Math.sin(e.wing || 0) * 5;
    R(c, K(P.dark), -9, -2 + fl, 7, 2); R(c, K(P.cloth), -11, 0 + fl, 8, 2); R(c, K(P.dark), -12, 2 + fl * 0.6, 5, 2);
    R(c, K(P.dark), 2, -2 + fl, 7, 2); R(c, K(P.cloth), 4, 0 + fl, 8, 2);
    R(c, K(P.dark), -4, -4, 9, 9); R(c, K(P.cloth), -3, -3, 7, 7);
    R(c, K(P.dark), -3, -6, 2, 3); R(c, K(P.dark), 2, -6, 2, 3);
    R(c, K(P.glow), 1, -1, 2, 2);
    AB.glow(c, 2, 0, 10, P.glow, 0.4);
    var yy = -(e.h / 2 - 5);
    c.translate(0, 5);
    finish(e, c, 0, 0, t);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }
};

/* ===================== BRUTE ===================== */
E.brute = {
  name: 'Ironhide', w: 20, h: 30, hp: 150, dmg: 26, gold: 12, kbRes: 0.8, superArmor: true,
  mitigate: function (e, dmg, o, w) {
    // shield on the front; vulnerable while winding up/recovering
    var front = o.dir === -e.face;
    if (front && e.state !== 'strike' && e.state !== 'recover' && !(e.stun > 0)) {
      AB.sfx('block'); w.burst(e.x + (e.face > 0 ? e.w : 0), e.y + 12, '#ffffff', 6, { vx: 2, vy: 2, life: 10, size: 1, g: 0 });
      w.text(e.x + e.w / 2, e.y - 4, 'BLOCK', '#9ab0d0');
      return dmg * 0.2;
    }
    return dmg;
  },
  update: function (e, w) {
    var p = w.player, dx = pdx(e, w), adx = Math.abs(dx);
    e.st++;
    if (e.state === 'idle' || e.state === 'chase') {
      if (canSee(e, w, 200)) {
        e.state = 'chase'; face(e, w);
        if (adx > 34) { if (AB.floorAhead(e, w.level, e.face, 6) && !AB.wallAhead(e, w.level, e.face)) walk(e, w, e.face, 0.55); else stand(e, w); }
        else { e.state = 'windup'; e.st = 0; e.tele = true; stand(e, w); }
      } else { e.state = 'idle'; patrol(e, w, 0.5); }
    } else if (e.state === 'windup') {
      stand(e, w);
      if (e.st >= 46 * e.atkMul) { e.state = 'strike'; e.st = 0; e.tele = false; w.shake(4); AB.sfx('slam'); w.dust(e.x + e.w / 2 + e.face * 24, e.y + e.h, 8); }
    } else if (e.state === 'strike') {
      stand(e, w);
      if (e.st < 8) { var box = atkBox(e, 40, 24, 6); if (AB.overlap(box, p) && !e.hitDone) { if (w.hurtPlayer(e.dmg, e.x + e.w / 2, {}) !== 'ignored') e.hitDone = true; } }
      if (e.st > 14) { e.state = 'recover'; e.st = 0; e.hitDone = false; }
    } else if (e.state === 'recover') { stand(e, w); if (e.st > 46 * e.atkMul) { e.state = 'chase'; e.st = 0; } }
  },
  draw: function (e, c, cx, cy, t) {
    var o = begin(e, c, cx, cy, t), K = colorFn(e), P = e.pal;
    shadow(c, o.x, o.y, 24);
    c.translate(o.x, o.y); c.scale(e.face, 1);
    var moving = Math.abs(e.vx) > 0.2, sw = moving ? Math.round(Math.sin(e.t * 0.14) * 2) : 0;
    R(c, K(P.dark), -7 + sw, -10, 5, 10); R(c, K(P.dark), 2 - sw, -10, 5, 10);
    R(c, K('#2a2838'), -9, -22, 18, 14); R(c, K('#4a4860'), -8, -21, 16, 12); R(c, K('#6a6888'), -8, -21, 16, 2);
    R(c, K(P.cloth), -8, -11, 16, 4);
    R(c, K('#2a2838'), -6, -30, 12, 10); R(c, K('#5a5878'), -5, -29, 10, 8); R(c, K(P.dark), 0, -26, 5, 2); R(c, K(P.glow), 3, -26, 2, 1);
    var wind = e.state === 'windup', strike = e.state === 'strike';
    var pr = wind ? Math.min(1, e.st / 46) : 0;
    // hammer
    c.save(); c.translate(6, -18);
    c.rotate(wind ? (-100 + (-10 * pr)) * Math.PI / 180 : (strike ? 70 * Math.PI / 180 : -20 * Math.PI / 180));
    AB.drawIcon(c, 'hammer', -8, -14, 1.3, P.glow); c.restore();
    // tower shield (front)
    var up = wind ? -3 : 0;
    R(c, K('#1a1420'), 6, -26 + up, 8, 22); R(c, K('#7a7898'), 7, -25 + up, 6, 20); R(c, K('#aab0c8'), 7, -25 + up, 2, 20); R(c, K(P.glow), 9, -17 + up, 2, 4);
    finish(e, c, 0, 0, t);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }
};

/* ===================== HEXER ===================== */
E.hexer = {
  name: 'Hexer', w: 12, h: 24, hp: 36, dmg: 15, gold: 8,
  init: function (e) { e.aux.tp = 120; e.aux.cast = 0; },
  update: function (e, w) {
    var p = w.player, dx = pdx(e, w), adx = Math.abs(dx);
    e.st++;
    if (e.state === 'idle') {
      stand(e, w); if (canSee(e, w, 260)) { e.state = 'chase'; e.st = 0; }
      e.face = e.dir;
    } else if (e.state === 'chase') {
      face(e, w);
      if (adx < 70 && AB.floorAhead(e, w.level, -e.face, 6)) walk(e, w, -e.face, 0.8); else stand(e, w);
      if (--e.aux.tp <= 0 || (e.lastHit > w.t - 4)) { e.state = 'fade'; e.st = 0; }
      else if (e.st > 66 * e.atkMul) { e.state = 'windup'; e.st = 0; e.tele = true; e.aux.cast++; }
    } else if (e.state === 'windup') {
      stand(e, w); face(e, w);
      if (e.st >= 32 * e.atkMul) {
        e.tele = false;
        var n = e.aux.cast % 3 === 0 ? 3 : 1;
        for (var i = 0; i < n; i++) {
          var ang = (i - (n - 1) / 2) * 0.35, sp = 2.1;
          var bx = Math.cos(ang) * e.face, by = Math.sin(ang) - 0.1;
          w.spawnProj({ x: e.x + e.w / 2 + e.face * 8, y: e.y + 8, vx: bx * sp, vy: by * sp, team: 'e', kind: 'orb', dmg: e.dmg, w: 8, h: 8, life: 170, homing: 0.05, color: e.pal.glow, kb: 1.5 });
        }
        AB.sfx('fire'); e.state = 'recover'; e.st = 0;
      }
    } else if (e.state === 'recover') { stand(e, w); if (e.st > 24) { e.state = 'chase'; e.st = 0; } }
    else if (e.state === 'fade') {
      stand(e, w); e.alpha = Math.max(0, 1 - e.st / 12);
      if (e.st === 1) w.burst(e.x + 6, e.y + 12, e.pal.glow, 10, { life: 16, size: 2, glow: true });
      if (e.st >= 12) {
        // relocate near the player on solid ground
        for (var tries = 0; tries < 12; tries++) {
          var nx = p.x + 5 + AB.rand(70, 160) * (AB.chance(0.5) ? 1 : -1), g = w.level.groundBelow(nx, p.y - 50, 20);
          if (g !== null && !w.level.solidAt(Math.floor(nx / T), Math.floor((g - 20) / T)) && Math.abs(g - (p.y + 22)) < 70) { e.x = nx - e.w / 2; e.y = g - e.h; break; }
        }
        e.state = 'appear'; e.st = 0; e.aux.tp = AB.randi(150, 260); e.vx = 0; e.vy = 0;
        w.burst(e.x + 6, e.y + 12, e.pal.glow, 10, { life: 16, size: 2, glow: true });
      }
    } else if (e.state === 'appear') {
      stand(e, w); e.alpha = Math.min(1, e.st / 12); face(e, w);
      if (e.st >= 12) { e.alpha = 1; e.state = 'chase'; e.st = 40; }
    } else e.state = 'idle';
  },
  draw: function (e, c, cx, cy, t) {
    var o = begin(e, c, cx, cy, t), K = colorFn(e), P = e.pal;
    var hov = Math.round(Math.sin(e.t * 0.1) * 1.5);
    shadow(c, o.x, o.y, 12);
    c.translate(o.x, o.y - 2 + hov); c.scale(e.face, 1);
    R(c, K(P.dark), -6, -16, 12, 16); R(c, K(P.cloth), -5, -15, 10, 14); R(c, K('#00000033'), -5, -6, 10, 6);
    R(c, K(P.dark), -5, -24, 10, 9); R(c, K(P.cloth), -4, -23, 8, 7); R(c, K('#0a0810'), -1, -21, 5, 5); R(c, K(P.glow), 1, -19, 2, 1); R(c, K(P.glow), 3, -19, 1, 1);
    R(c, K(P.glow), -4, -10, 8, 1);
    // staff
    R(c, K('#4a3a2a'), 6, -26, 2, 26); R(c, K(P.glow), 4, -30, 6, 6); R(c, '#fff', 6, -28, 2, 2);
    var cast = e.state === 'windup' ? e.st / 32 : 0;
    AB.glow(c, 7, -27, 12 + cast * 14, P.glow, 0.5 + cast * 0.4);
    finish(e, c, 0, 2 - hov, t);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }
};

/* ===================== BOMBER ===================== */
E.bomber = {
  name: 'Powder Imp', w: 12, h: 14, hp: 24, dmg: 30, gold: 4,
  onDeath: function (e, w) {
    w.explode(e.x + e.w / 2, e.y + e.h / 2, 40, e.dmg * 0.7, 'e', { color: '#ff6a1a' });
  },
  update: function (e, w) {
    var p = w.player, dx = pdx(e, w), adx = Math.abs(dx);
    e.st++;
    if (e.state === 'idle') {
      patrol(e, w, 0.8);
      if (canSee(e, w, 190)) { e.state = 'chase'; e.st = 0; }
    } else if (e.state === 'chase') {
      face(e, w);
      if (AB.floorAhead(e, w.level, e.face, 6) && !AB.wallAhead(e, w.level, e.face)) walk(e, w, e.face, 1.55);
      else { stand(e, w); if (AB.wallAhead(e, w.level, e.face) && e.onGround) e.vy = -5.4; }
      if (AB.wallAhead(e, w.level, e.face) && e.onGround && e.st % 20 === 0) e.vy = -5.4;
      if (adx < 26 && Math.abs(pdy(e, w)) < 26) { e.state = 'fuse'; e.st = 0; e.tele = true; }
      if (!canSee(e, w, 260)) { e.state = 'idle'; }
    } else if (e.state === 'fuse') {
      stand(e, w); e.vx *= 0.5;
      if (e.st % 6 === 0) AB.sfx('click');
      if (e.st >= 30 * e.atkMul) { e.tele = false; e.hp = 0; w.killEnemy(e, {}); }
    }
  },
  draw: function (e, c, cx, cy, t) {
    var o = begin(e, c, cx, cy, t), K = colorFn(e), P = e.pal;
    shadow(c, o.x, o.y, 12);
    c.translate(o.x, o.y); c.scale(e.face, 1);
    var fuse = e.state === 'fuse', blink = fuse && ((e.t >> 2) & 1);
    var moving = Math.abs(e.vx) > 0.2, sw = moving ? Math.round(Math.sin(e.t * 0.5) * 2) : 0;
    R(c, K(P.dark), -4 + sw, -4, 3, 4); R(c, K(P.dark), 1 - sw, -4, 3, 4);
    R(c, K(blink ? '#ff4a3a' : P.cloth), -5, -11, 10, 8);
    R(c, K(blink ? '#ffcaa0' : P.skin), -4, -14, 8, 6); R(c, K('#0a0810'), 0, -12, 3, 2); R(c, K(P.glow), 1, -12, 1, 1);
    R(c, K(P.dark), -7, -9, 3, 3);
    // bomb pack
    R(c, '#1a1420', -9, -12, 7, 7); R(c, blink ? '#ff6a4a' : '#4a4a58', -8, -11, 5, 5);
    R(c, '#ffb04a', -7, -15, 1, 3); R(c, '#fff', -7, -16 - ((e.t >> 1) & 1), 1, 1);
    AB.glow(c, -6, -15, fuse ? 20 : 8, '#ff8a2a', fuse ? 0.8 : 0.4);
    finish(e, c, 0, 0, t);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }
};

AB.drawEnemy = function (e, c, cx, cy, t) {
  var sx = e.x - cx;
  if (sx < -120 || sx > AB.W + 120 || e.y - cy < -140 || e.y - cy > AB.H + 140) return;
  c.save();
  e.def.draw(e, c, cx, cy, t);
  c.restore();
};
})();
