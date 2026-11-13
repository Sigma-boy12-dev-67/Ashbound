(function () {
'use strict';
var AB = window.AB;
var T = AB.T, B = AB.BOSSES, eh = AB.eh;
var pdx = eh.pdx, pdy = eh.pdy, face = eh.face, walk = eh.walk, stand = eh.stand, atkBox = eh.atkBox;
function R(c, col, x, y, w, h) { c.fillStyle = col; c.fillRect(x, y, w, h); }
function Kf(e) { var f = e.flash > 0 || e.hitF > 0; return function (col) { return f ? '#ffffff' : col; }; }
function arena(w) { return w.bossArena || { x0: 0, x1: w.level.W * T, y: 0, top: 0 }; }
function aim(e, w, sx, sy, sp) {
  var dx = w.player.x + 5 - sx, dy = w.player.y + 10 - sy, d = Math.sqrt(dx * dx + dy * dy) || 1;
  return { vx: dx / d * sp, vy: dy / d * sp };
}
function bossBegin(e, c, cx, cy) {
  var x = Math.round(e.x + e.w / 2 - cx), y = Math.round(e.y + e.h - cy);
  c.save();
  if (e.spawnT > 0) c.globalAlpha = 1 - e.spawnT / 36 * 0.85;
  else if (e.alpha < 1) c.globalAlpha = e.alpha;
  return { x: x, y: y };
}
function teleMark(c, e, x, y) {
  if (!e.tele) return;
  var b = Math.sin(e.t * 0.5) * 1.5;
  R(c, '#1a0000', x - 3, y - e.h - 22 + b, 7, 13); R(c, '#ff3a2a', x - 2, y - e.h - 21 + b, 5, 8); R(c, '#ff3a2a', x - 2, y - e.h - 11 + b, 5, 3);
  AB.glow(c, x, y - e.h - 14, 22, '#ff3a2a', 0.7);
}
function cleanup(e, w) {
  for (var i = 0; i < w.projs.length; i++) if (w.projs[i].team === 'e') w.projs[i].dead = true;
  for (i = 0; i < w.enemies.length; i++) { var m = w.enemies[i]; if (!m.boss && !m.dead) { m.hp = 0; w.killEnemy(m, {}); } }
  w.burst(e.x + e.w / 2, e.y + e.h / 2, e.pal.glow, 50, { vx: 5, vy: 5, life: 50, size: 3, glow: true });
}
function enrage(e, w, msg) {
  if (e.aux.phase !== 1 || e.hp > e.maxHp * 0.5) return false;
  e.aux.phase = 2; e.invuln = 60; e.state = 'roar'; e.st = 0; e.tele = false; e.vx = 0;
  return msg;
}
function roar(e, w, msg) {
  stand(e, w);
  if (e.st === 1) { AB.sfx('boss'); w.shake(8); w.flashScreen('#ff3a2a', 0.25); w.ring(e.x + e.w / 2, e.y + e.h / 2, 120, e.pal.glow); w.toast(msg, 'skull', '#ff8a6a'); }
  if (e.st % 6 === 0) w.burst(e.x + e.w / 2, e.y + 6, e.pal.glow, 4, { vx: 2, vy: 2, life: 22, size: 2, glow: true });
  return e.st > 60;
}
function hitBox(e, w, box, mul, fx) {
  var p = w.player;
  if (!e.hitDone && AB.overlap(box, p)) { if (w.hurtPlayer(e.dmg * mul, e.x + e.w / 2, fx || {}) !== 'ignored') e.hitDone = true; }
}
function choose(e, list) {
  var opts = list.filter(function (a) { return a !== e.aux.last; });
  var a = opts[Math.floor(Math.random() * opts.length)];
  e.aux.last = a; return a;
}
function pickEnd(e) { e.state = 'idle'; e.st = 0; e.aux.cd = e.aux.phase === 2 ? 26 : 52; e.tele = false; e.hitDone = false; }

/* ======================= 1. THE GRAVEWARDEN ======================= */
B.gravewarden = {
  title: 'THE GRAVEWARDEN', sub: 'Keeper of the Sunken Crypt', boss: true, name: 'Gravewarden',
  w: 26, h: 44, hp: 1500, dmg: 24, gold: 70, superArmor: true, noKb: true, noStun: true,
  init: function (e) { e.invuln = 70; e.aux = { phase: 1, cd: 40, last: '' }; e.face = -1; },
  onDeath: cleanup,
  update: function (e, w) {
    var adx = Math.abs(pdx(e, w)), ph = e.aux.phase, A = arena(w);
    e.st++; if (e.invuln > 0) e.invuln--;
    e.spd = ph === 2 ? 1.3 : 1;
    var en = enrage(e, w); if (en !== false) en = 'The Gravewarden rages!';
    if (e.state === 'idle' || e.state === 'chase') {
      face(e, w);
      if (adx > 46) walk(e, w, e.face, 0.7); else stand(e, w);
      if (--e.aux.cd <= 0) {
        var a = choose(e, adx < 70 ? ['cleave', 'cleave', 'slam'] : (adx < 190 ? ['slam', 'volley', 'charge'] : ['volley', 'charge', 'volley']));
        if (ph === 2 && w.enemies.length < 3 && Math.random() < 0.35) a = 'summon';
        e.state = a; e.st = 0; e.tele = true; e.hitDone = false; face(e, w);
      }
    } else if (e.state === 'roar') { if (roar(e, w, 'The Gravewarden rages!')) pickEnd(e); }
    else if (e.state === 'cleave') {
      stand(e, w);
      if (e.st === 34) { e.tele = false; AB.sfx('swingHeavy'); w.shake(3); }
      if (e.st > 34 && e.st < 44) hitBox(e, w, atkBox(e, 62, 40, 4), 1);
      if (e.st > 64) pickEnd(e);
    } else if (e.state === 'slam') {
      stand(e, w);
      if (e.st === 40) {
        e.tele = false; w.shake(7); AB.sfx('slam'); w.dust(e.x + e.w / 2 + e.face * 30, e.y + e.h, 10);
        for (var s = -1; s <= 1; s += 2) w.spawnProj({ x: e.x + e.w / 2 + s * 20, y: e.y + e.h - 12, vx: s * 2.8, vy: 0, team: 'e', kind: 'orb', color: '#9aff9a', dmg: e.dmg * 0.7, w: 10, h: 10, life: 90, small: false });
      }
      if (e.st > 40 && e.st < 48) hitBox(e, w, atkBox(e, 54, 30, 14), 1.1);
      if (e.st > 74) pickEnd(e);
    } else if (e.state === 'volley') {
      stand(e, w);
      if (e.st === 32) {
        e.tele = false; AB.sfx('shoot');
        var n = ph === 2 ? 7 : 5;
        for (var i = 0; i < n; i++) w.spawnProj({ x: e.x + e.w / 2, y: e.y + 6, vx: e.face * (1.4 + i * 0.55), vy: -3.6 - (i % 3) * 0.5, grav: 0.16, team: 'e', kind: 'bone', dmg: e.dmg * 0.6, w: 8, h: 8, life: 140 });
      }
      if (e.st > 62) pickEnd(e);
    } else if (e.state === 'charge') {
      if (e.st < 26) stand(e, w);
      else {
        if (e.st === 26) { e.tele = false; AB.sfx('roll'); }
        e.vx = e.face * (ph === 2 ? 4.6 : 3.8); e.vy = Math.min(e.vy + 0.4, 8); AB.moveBody(e, w.level);
        if (e.st % 4 === 0) w.dust(e.x + e.w / 2, e.y + e.h, 2);
        hitBox(e, w, { x: e.x - 2, y: e.y + 4, w: e.w + 4, h: e.h - 4 }, 1.1);
        if (e.hitWall || e.st > 70) { if (e.hitWall) { w.shake(6); AB.sfx('slam'); } e.vx = 0; e.state = 'stagger'; e.st = 0; }
      }
    } else if (e.state === 'stagger') { stand(e, w); if (e.st > (ph === 2 ? 30 : 56)) pickEnd(e); }
    else if (e.state === 'summon') {
      stand(e, w);
      if (e.st === 40) {
        e.tele = false; AB.sfx('altar');
        for (var k = 0; k < 2; k++) AB.spawnEnemy(w, 'husk', AB.clamp(e.x + (k ? 120 : -120), A.x0 + 60, A.x1 - 60), e.y + e.h, { spawnFx: true });
      }
      if (e.st > 70) pickEnd(e);
    } else pickEnd(e);
    e.x = AB.clamp(e.x, A.x0 + 20, A.x1 - 20 - e.w);
  },
  draw: function (e, c, cx, cy, t) {
    var o = bossBegin(e, c, cx, cy), K = Kf(e), P = e.pal;
    R(c, 'rgba(0,0,0,0.3)', o.x - 16, o.y - 2, 32, 3);
    c.translate(o.x, o.y); c.scale(e.face, 1);
    var moving = Math.abs(e.vx) > 0.2, sw = moving ? Math.round(Math.sin(e.t * 0.16) * 3) : 0, bob = Math.round(Math.sin(e.t * 0.07));
    var cl = e.state === 'cleave', sl = e.state === 'slam', ch = e.state === 'charge', vo = e.state === 'volley';
    var lean = ch && e.st > 26 ? 4 : 0;
    // cape
    R(c, K('#1a1e28'), -14 - lean, -36 + bob, 8, 30); R(c, K('#2a3040'), -13 - lean, -34 + bob, 6, 26);
    for (var i = 0; i < 4; i++) R(c, K('#1a1e28'), -14 - lean + i * 2, -6 + (i % 2) * 3, 2, 5);
    // legs
    R(c, K('#1a1c24'), -9 + sw, -12, 7, 12); R(c, K('#2e3444'), -8 + sw, -12, 5, 10);
    R(c, K('#1a1c24'), 2 - sw, -12, 7, 12); R(c, K('#2e3444'), 3 - sw, -12, 5, 10);
    // torso
    R(c, K('#1a1c24'), -12 + lean, -34 + bob, 24, 24); R(c, K('#46546a'), -11 + lean, -33 + bob, 22, 22); R(c, K('#6a7a94'), -11 + lean, -33 + bob, 22, 3);
    R(c, K('#0a0c12'), -6 + lean, -28 + bob, 12, 12);
    for (i = 0; i < 3; i++) R(c, K(P.bone), -5 + lean, -27 + i * 4 + bob, 10, 1);
    AB.glow(c, lean, -22 + bob, 16, P.glow, 0.4 + Math.sin(e.t * 0.1) * 0.12);
    // pauldrons
    R(c, K('#1a1c24'), -15 + lean, -36 + bob, 8, 9); R(c, K('#5a6a84'), -14 + lean, -35 + bob, 6, 7);
    R(c, K('#1a1c24'), 7 + lean, -36 + bob, 8, 9); R(c, K('#5a6a84'), 8 + lean, -35 + bob, 6, 7);
    // helm
    R(c, K('#1a1c24'), -8 + lean, -46 + bob, 16, 13); R(c, K(P.bone), -7 + lean, -45 + bob, 14, 11); R(c, K('#0a0c12'), -5 + lean, -42 + bob, 11, 5);
    R(c, K(P.glow), 0 + lean, -41 + bob, 3, 2); R(c, K(P.glow), 5 + lean, -41 + bob, 2, 2);
    R(c, K(P.bone), -9 + lean, -49 + bob, 3, 5); R(c, K(P.bone), 6 + lean, -49 + bob, 3, 5);
    AB.glow(c, 3 + lean, -40 + bob, 10, P.glow, 0.6);
    // tombstone cleaver
    c.save(); c.translate(9 + lean, -28 + bob);
    var ang = cl ? (e.st < 34 ? -120 + e.st * 0.5 : 70) : (sl ? (e.st < 40 ? -150 : 40) : (vo ? -80 : (ch ? -40 : -25 + Math.sin(e.t * 0.07) * 3)));
    c.rotate(ang * Math.PI / 180);
    R(c, '#1a1c24', -2, -4, 5, 18); R(c, '#4a3a2a', -1, -2, 3, 15);
    R(c, '#1a1c24', -8, -34, 17, 31); R(c, K('#8a92a6'), -7, -33, 15, 29); R(c, K('#b0b8cc'), -7, -33, 15, 3); R(c, K('#6a728a'), -7, -10, 15, 6);
    R(c, K('#3a4256'), -2, -28, 5, 1); R(c, K('#3a4256'), -4, -25, 9, 1); R(c, K('#3a4256'), 0, -30, 1, 8);
    c.restore();
    if (e.aux.phase === 2) AB.glow(c, 0, -22, 34, '#ff3a2a', 0.25 + Math.sin(e.t * 0.2) * 0.1);
    teleMark(c, e, 0, 0);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }
};

/* ======================= 2. THE SMELTER ======================= */
B.smelter = {
  title: 'THE SMELTER', sub: 'Colossus of the Cinder Foundry', boss: true, name: 'Smelter',
  w: 34, h: 46, hp: 2200, dmg: 30, gold: 90, superArmor: true, noKb: true, noStun: true,
  init: function (e) { e.invuln = 70; e.aux = { phase: 1, cd: 40, last: '', rain: 0, lasers: 0 }; e.face = -1; },
  onDeath: cleanup,
  update: function (e, w) {
    var adx = Math.abs(pdx(e, w)), ph = e.aux.phase, A = arena(w);
    e.st++; if (e.invuln > 0) e.invuln--;
    e.spd = ph === 2 ? 1.2 : 0.9;
    enrage(e, w);
    if (e.t % 14 === 0) w.burst(e.x + 8 + (e.face > 0 ? 0 : 18), e.y - 2, '#4a4650', 1, { vx: 0.3, vy: 0.3, dy: -1, g: -0.03, life: 40, size: 3 });
    if (e.state === 'idle' || e.state === 'chase') {
      face(e, w);
      if (adx > 58) walk(e, w, e.face, 0.6); else stand(e, w);
      if (--e.aux.cd <= 0) {
        var list = adx < 80 ? ['hammer', 'hammer', 'spit'] : ['spit', 'rain', 'charge', 'hammer'];
        if (ph === 2) list.push('laser');
        e.state = choose(e, list); e.st = 0; e.tele = true; e.hitDone = false; e.aux.lasers = 0; face(e, w);
      }
    } else if (e.state === 'roar') { if (roar(e, w, 'The Smelter overheats!')) pickEnd(e); }
    else if (e.state === 'hammer') {
      stand(e, w);
      if (e.st === 44) {
        e.tele = false; w.shake(9); AB.sfx('slam'); w.dust(e.x + e.w / 2 + e.face * 36, e.y + e.h, 12);
        for (var s = -1; s <= 1; s += 2) w.spawnProj({ x: e.x + e.w / 2 + s * 30, y: e.y + e.h - 12, vx: s * 3.2, vy: 0, team: 'e', kind: 'fire', dmg: e.dmg * 0.7, w: 12, h: 12, life: 80, small: false });
      }
      if (e.st > 44 && e.st < 52) hitBox(e, w, atkBox(e, 66, 40, 8), 1.2);
      if (e.st > 84) pickEnd(e);
    } else if (e.state === 'spit') {
      stand(e, w);
      if (e.st === 30 || (ph === 2 && e.st === 44)) {
        e.tele = false; AB.sfx('fire');
        for (var i = -1; i <= 1; i++) w.spawnProj({ x: e.x + e.w / 2 + e.face * 10, y: e.y + 8, vx: e.face * (2.2 + i * 0.6) * Math.min(1.6, 0.6 + adx / 140), vy: -4.2, grav: 0.2, team: 'e', kind: 'fire', dmg: e.dmg * 0.6, w: 10, h: 10, life: 120 });
      }
      if (e.st > 70) pickEnd(e);
    } else if (e.state === 'rain') {
      stand(e, w);
      if (e.st === 30) { e.tele = false; AB.sfx('boss'); e.aux.rain = ph === 2 ? 110 : 80; }
      if (e.aux.rain > 0) {
        e.aux.rain--;
        if (e.aux.rain % (ph === 2 ? 6 : 9) === 0) w.spawnProj({ x: AB.rand(A.x0 + 40, A.x1 - 40), y: (A.top || A.y - 260) + 24, vx: 0, vy: 2.4, grav: 0.05, team: 'e', kind: 'ember', dmg: e.dmg * 0.55, w: 8, h: 8, life: 160 });
      } else if (e.st > 40) pickEnd(e);
    } else if (e.state === 'charge') {
      if (e.st < 30) stand(e, w);
      else {
        if (e.st === 30) { e.tele = false; AB.sfx('roll'); }
        e.vx = e.face * (ph === 2 ? 4 : 3.2); e.vy = Math.min(e.vy + 0.4, 8); AB.moveBody(e, w.level);
        if (e.st % 3 === 0) w.burst(e.x + e.w / 2, e.y + e.h, '#ffb04a', 2, { vx: 1, vy: 1, life: 14, size: 2, glow: true });
        hitBox(e, w, { x: e.x - 2, y: e.y + 4, w: e.w + 4, h: e.h - 4 }, 1.15);
        if (e.hitWall || e.st > 80) { if (e.hitWall) { w.shake(7); AB.sfx('slam'); } e.vx = 0; e.state = 'stagger'; e.st = 0; }
      }
    } else if (e.state === 'stagger') { stand(e, w); if (e.st > (ph === 2 ? 30 : 56)) pickEnd(e); }
    else if (e.state === 'laser') {
      stand(e, w); face(e, w);
      if (e.st >= 50 && (e.st - 50) % 9 === 0 && e.aux.lasers < 4) {
        e.tele = false; e.aux.lasers++; AB.sfx('zap');
        w.spawnProj({ x: e.x + e.w / 2 + e.face * 18, y: e.y + 14, vx: e.face * 7.5, vy: 0, team: 'e', kind: 'laser', dmg: e.dmg * 0.7, w: 10, h: 6, life: 80, small: false });
      }
      if (e.st > 100) pickEnd(e);
    } else pickEnd(e);
    e.x = AB.clamp(e.x, A.x0 + 20, A.x1 - 20 - e.w);
  },
  draw: function (e, c, cx, cy, t) {
    var o = bossBegin(e, c, cx, cy), K = Kf(e), P = e.pal;
    R(c, 'rgba(0,0,0,0.3)', o.x - 20, o.y - 2, 40, 3);
    c.translate(o.x, o.y); c.scale(e.face, 1);
    var moving = Math.abs(e.vx) > 0.2, sw = moving ? Math.round(Math.sin(e.t * 0.14) * 3) : 0, bob = Math.round(Math.sin(e.t * 0.06));
    var hm = e.state === 'hammer', ch = e.state === 'charge', lean = ch && e.st > 30 ? 5 : 0;
    var heat = 0.5 + 0.5 * Math.sin(e.t * 0.12), hot = e.aux.phase === 2 ? 1 : 0.5;
    // legs
    R(c, K('#1c1412'), -13 + sw, -14, 11, 14); R(c, K('#4a3a34'), -12 + sw, -14, 9, 12);
    R(c, K('#1c1412'), 2 - sw, -14, 11, 14); R(c, K('#4a3a34'), 3 - sw, -14, 9, 12);
    // body
    R(c, K('#1c1412'), -16 + lean, -38 + bob, 32, 26); R(c, K('#5a463c'), -15 + lean, -37 + bob, 30, 24); R(c, K('#7a6458'), -15 + lean, -37 + bob, 30, 3);
    for (var r = 0; r < 3; r++) { R(c, K('#2a1e1a'), -14 + lean, -30 + r * 6 + bob, 28, 1); }
    // furnace window
    R(c, '#0a0404', -8 + lean, -34 + bob, 16, 14);
    R(c, K(AB.mix('#ff5a10', '#ffd070', heat * hot)), -7 + lean, -33 + bob, 14, 12);
    R(c, K('#fff0b0'), -4 + lean, -31 + bob, 8, 4 + Math.round(heat * 2));
    AB.glow(c, lean, -27 + bob, 30, '#ff7a20', 0.4 + heat * 0.25 * hot);
    // head + stacks
    R(c, K('#1c1412'), -9 + lean, -46 + bob, 18, 10); R(c, K('#6a5448'), -8 + lean, -45 + bob, 16, 8);
    R(c, K('#0a0404'), -5 + lean, -43 + bob, 11, 3); R(c, K(P.glow), -3 + lean, -42 + bob, 3, 1); R(c, K(P.glow), 3 + lean, -42 + bob, 3, 1);
    R(c, K('#1c1412'), -14 + lean, -50 + bob, 5, 14); R(c, K('#4a3a34'), -13 + lean, -49 + bob, 3, 12);
    R(c, K('#1c1412'), 9 + lean, -50 + bob, 5, 14); R(c, K('#4a3a34'), 10 + lean, -49 + bob, 3, 12);
    // back arm claw
    R(c, K('#2a1e1a'), -22 + lean, -34 + bob, 7, 18); R(c, K('#4a3a34'), -21 + lean, -33 + bob, 5, 16); R(c, K('#2a1e1a'), -24 + lean, -18 + bob, 10, 5);
    // hammer arm
    c.save(); c.translate(15 + lean, -32 + bob);
    var ang = hm ? (e.st < 44 ? -130 + e.st * 0.3 : 70) : (e.state === 'spit' ? -60 : -15 + Math.sin(e.t * 0.06) * 3);
    c.rotate(ang * Math.PI / 180);
    R(c, '#1c1412', -4, -2, 8, 26); R(c, K('#5a463c'), -3, -1, 6, 24);
    R(c, '#1c1412', -11, 20, 22, 18); R(c, K('#7a6a62'), -10, 21, 20, 16); R(c, K('#a09088'), -10, 21, 20, 3);
    R(c, K('#ff7a20'), -6, 28, 12, 2);
    c.restore();
    teleMark(c, e, 0, 0);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }
};

/* ======================= 3. THE FROST SOVEREIGN ======================= */
B.sovereign = {
  title: 'THE FROST SOVEREIGN', sub: 'Last King of the Spire', boss: true, name: 'Sovereign', fly: true,
  w: 26, h: 40, hp: 3000, dmg: 34, gold: 120, superArmor: true, noKb: true, noStun: true,
  init: function (e, w) { e.invuln = 70; e.aux = { phase: 1, cd: 50, last: '', n: 0, dx: 0, dy: 0 }; e.face = -1; },
  onDeath: cleanup,
  update: function (e, w) {
    var p = w.player, ph = e.aux.phase, A = arena(w);
    var cxb = e.x + e.w / 2, cyb = e.y + e.h / 2, floorY = A.y || (p.y + 40);
    e.st++; if (e.invuln > 0) e.invuln--;
    enrage(e, w);
    function hover(tx, ty, k) { e.vx += (tx - cxb) * k; e.vy += (ty - cyb) * k; e.vx *= 0.9; e.vy *= 0.9; var m = Math.sqrt(e.vx * e.vx + e.vy * e.vy); if (m > 3.2) { e.vx *= 3.2 / m; e.vy *= 3.2 / m; } AB.moveFly(e, w); }
    face(e, w);
    if (e.state === 'idle' || e.state === 'chase') {
      var tx = p.x + 5 + Math.sin(e.t * 0.02) * 150, ty = floorY - 92 + Math.sin(e.t * 0.035) * 18;
      hover(AB.clamp(tx, A.x0 + 50, A.x1 - 50), ty, 0.012);
      if (--e.aux.cd <= 0) {
        var list = ['fan', 'rain', 'dive', 'blink'];
        if (ph === 2) list.push('spiral', 'nova');
        e.state = choose(e, list); e.st = 0; e.tele = e.state !== 'blink'; e.hitDone = false; e.aux.n = 0;
      }
    } else if (e.state === 'roar') { e.vx *= 0.8; e.vy *= 0.8; if (roar(e, w, 'The Sovereign unleashes the blizzard!')) pickEnd(e); }
    else if (e.state === 'fan') {
      hover(cxb, cyb, 0.02);
      if (e.st === 34 || (ph === 2 && e.st === 50)) {
        e.tele = false; AB.sfx('ice');
        var n = ph === 2 ? 9 : 5, base = Math.atan2(p.y + 10 - cyb, p.x + 5 - cxb);
        for (var i = 0; i < n; i++) { var a = base + (i - (n - 1) / 2) * 0.22; w.spawnProj({ x: cxb, y: cyb, vx: Math.cos(a) * 3.2, vy: Math.sin(a) * 3.2, team: 'e', kind: 'shard', dmg: e.dmg * 0.55, w: 8, h: 8, life: 140 }); }
      }
      if (e.st > 74) pickEnd(e);
    } else if (e.state === 'rain') {
      hover(AB.clamp(cxb, A.x0 + 50, A.x1 - 50), floorY - 130, 0.03);
      if (e.st === 26) { e.tele = false; AB.sfx('boss'); }
      if (e.st >= 26 && e.st < 100 && e.st % (ph === 2 ? 5 : 8) === 0) {
        var sx = AB.rand(A.x0 + 40, A.x1 - 40);
        w.spawnProj({ x: sx, y: (A.top || floorY - 260) + 20, vx: 0, vy: 3.4, team: 'e', kind: 'shard', dmg: e.dmg * 0.5, w: 7, h: 12, life: 160 });
      }
      if (e.st > 120) pickEnd(e);
    } else if (e.state === 'dive') {
      if (e.st < 36) { hover(cxb, cyb - 10 * Math.sin(e.st / 36 * 3), 0.02); if (e.st === 35) { var a2 = aim(e, w, cxb, cyb, 5.8); e.aux.dx = a2.vx; e.aux.dy = a2.vy; e.tele = false; AB.sfx('roll'); } }
      else {
        e.vx = e.aux.dx; e.vy = e.aux.dy; AB.moveFly(e, w);
        if (e.st % 3 === 0) w.burst(cxb, cyb, '#cfeeff', 2, { vx: 1, vy: 1, life: 14, size: 2, glow: true });
        hitBox(e, w, { x: e.x - 2, y: e.y - 2, w: e.w + 4, h: e.h + 4 }, 1.2);
        if (e.st > 66) { e.vx *= 0.3; e.vy *= 0.3; e.state = 'stagger'; e.st = 0; }
      }
    } else if (e.state === 'stagger') { hover(cxb, floorY - 70, 0.01); if (e.st > (ph === 2 ? 16 : 40)) pickEnd(e); }
    else if (e.state === 'blink') {
      e.vx = e.vy = 0;
      e.alpha = Math.max(0, 1 - e.st / 14);
      if (e.st === 14) {
        w.burst(cxb, cyb, '#cfeeff', 16, { vx: 3, vy: 3, life: 22, size: 2, glow: true });
        e.x = AB.clamp(p.x + 5 + (Math.random() < 0.5 ? -1 : 1) * AB.rand(90, 170), A.x0 + 50, A.x1 - 50) - e.w / 2; e.y = floorY - AB.rand(80, 130);
      }
      if (e.st > 14) e.alpha = Math.min(1, (e.st - 14) / 14);
      if (e.st > 30) { e.alpha = 1; e.state = 'fan'; e.st = 20; e.tele = true; }
    } else if (e.state === 'spiral') {
      hover(AB.clamp(cxb, A.x0 + 80, A.x1 - 80), floorY - 100, 0.03);
      if (e.st === 26) { e.tele = false; AB.sfx('ice'); }
      if (e.st >= 26 && e.st < 110 && e.st % 3 === 0) {
        var ang = (e.st - 26) * 0.3;
        for (var k = 0; k < 2; k++) w.spawnProj({ x: cxb, y: cyb, vx: Math.cos(ang + k * Math.PI) * 2.6, vy: Math.sin(ang + k * Math.PI) * 2.6, team: 'e', kind: 'shard', dmg: e.dmg * 0.45, w: 7, h: 7, life: 150 });
      }
      if (e.st > 130) pickEnd(e);
    } else if (e.state === 'nova') {
      hover(cxb, cyb, 0.03);
      if (e.st === 40) {
        e.tele = false; AB.sfx('explode'); w.shake(6); w.ring(cxb, cyb, 90, '#cfeeff');
        for (var q = 0; q < 18; q++) { var an = q / 18 * Math.PI * 2; w.spawnProj({ x: cxb, y: cyb, vx: Math.cos(an) * 2.8, vy: Math.sin(an) * 2.8, team: 'e', kind: 'shard', dmg: e.dmg * 0.5, w: 8, h: 8, life: 150 }); }
      }
      if (e.st > 76) pickEnd(e);
    } else pickEnd(e);
  },
  draw: function (e, c, cx, cy, t) {
    var o = bossBegin(e, c, cx, cy), K = Kf(e), P = e.pal;
    var hov = Math.round(Math.sin(e.t * 0.08) * 2);
    c.translate(o.x, o.y + hov); c.scale(e.face, 1);
    var p2 = e.aux.phase === 2;
    // aura
    AB.glow(c, 0, -22, 44, p2 ? '#ff8aff' : '#8ae0ff', 0.35 + Math.sin(e.t * 0.1) * 0.1);
    // cloak
    R(c, K('#10182c'), -14, -30, 28, 6); R(c, K('#1c2a4a'), -13, -29, 26, 4);
    R(c, K('#10182c'), -12, -24, 24, 8); R(c, K('#26386a'), -11, -23, 22, 6);
    R(c, K('#10182c'), -10, -16, 20, 8); R(c, K('#2c4278'), -9, -15, 18, 6);
    R(c, K('#10182c'), -8, -9, 16, 6); R(c, K('#26386a'), -7, -8, 14, 4);
    for (var i = 0; i < 4; i++) { var wv = Math.round(Math.sin(e.t * 0.12 + i) * 2); R(c, K('#1c2a4a'), -7 + i * 4, -3 + wv, 3, 6 - wv); }
    // chest rune
    R(c, K('#cfeeff'), -1, -26, 2, 8); R(c, K('#cfeeff'), -4, -23, 8, 2);
    // head
    R(c, K('#10182c'), -7, -42, 14, 13); R(c, K('#d8f0ff'), -6, -41, 12, 11); R(c, K('#0a1020'), -4, -38, 9, 5);
    R(c, K(p2 ? '#ff8aff' : '#7ae0ff'), -1, -37, 3, 2); R(c, K(p2 ? '#ff8aff' : '#7ae0ff'), 4, -37, 2, 2);
    AB.glow(c, 2, -36, 10, p2 ? '#ff8aff' : '#7ae0ff', 0.6);
    // crown
    var cr = [[-7, 6], [-3, 9], [1, 11], [5, 8]];
    for (i = 0; i < cr.length; i++) { R(c, K('#9ad8ff'), cr[i][0], -42 - cr[i][1], 3, cr[i][1]); R(c, K('#ffffff'), cr[i][0], -42 - cr[i][1], 1, cr[i][1]); }
    // hands
    var cast = e.tele ? 1 : 0;
    R(c, K('#d8f0ff'), 12, -22 - cast * 8, 5, 5); R(c, K('#d8f0ff'), -17, -22 - cast * 8, 5, 5);
    AB.glow(c, 14, -20 - cast * 8, 8 + cast * 8, '#8ae0ff', 0.7); AB.glow(c, -14, -20 - cast * 8, 8 + cast * 8, '#8ae0ff', 0.7);
    // orbiting shards
    for (i = 0; i < 3; i++) {
      var a = e.t * 0.05 + i * 2.094, sx = Math.round(Math.cos(a) * 24), sy = Math.round(Math.sin(a) * 8) - 20;
      R(c, K('#cfeeff'), sx - 2, sy - 4, 4, 8); R(c, '#ffffff', sx - 1, sy - 4, 1, 6);
    }
    c.save(); c.scale(e.face, 1); c.translate(0, 0); c.restore();
    teleMark(c, e, 0, 18);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }
};
})();
