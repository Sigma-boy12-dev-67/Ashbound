(function () {
'use strict';
var AB = window.AB;
var T = AB.T, B = AB.BOSSES, eh = AB.eh, K0 = AB.bossKit;
var pdx = eh.pdx, pdy = eh.pdy, face = eh.face, walk = eh.walk, stand = eh.stand, atkBox = eh.atkBox;
var R = K0.R, Kf = K0.Kf, arena = K0.arena, aim = K0.aim, bossBegin = K0.bossBegin, teleMark = K0.teleMark,
  cleanup = K0.cleanup, roar = K0.roar, hitBox = K0.hitBox, choose = K0.choose;

/* ---------- shared helpers ---------- */
function pickEnd(e, cd) { e.state = 'idle'; e.st = 0; e.aux.cd = cd != null ? cd : (e.aux.phase >= 2 ? 24 : 50); e.tele = false; e.hitDone = false; }
/* phase change when hp falls under a fraction list; returns true on the frame it triggers */
function phaseUp(e, w, fracs) {
  var ph = e.aux.phase;
  if (ph <= fracs.length && e.hp <= e.maxHp * fracs[ph - 1]) {
    e.aux.phase = ph + 1; e.invuln = 70; e.state = 'roar'; e.st = 0; e.tele = false; e.vx = 0; e.hitDone = false;
    return true;
  }
  return false;
}
function jump(e, w, vx, vy) { e.vx = vx; e.vy = vy; e.onGround = false; }
function air(e, w) { e.vy = Math.min(e.vy + 0.4, 9); AB.moveBody(e, w.level); }
function flyHover(e, w, tx, ty, k, mx) {
  var cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  e.vx += (tx - cx) * k; e.vy += (ty - cy) * k; e.vx *= 0.9; e.vy *= 0.9;
  var m = Math.sqrt(e.vx * e.vx + e.vy * e.vy); mx = mx || 3.2;
  if (m > mx) { e.vx *= mx / m; e.vy *= mx / m; }
  AB.moveFly(e, w);
}
/* vertical strike columns: telegraph then hit. s = {x, t, tel, dur, w} */
function addStrike(e, x, tel, w2) { (e.aux.strikes = e.aux.strikes || []).push({ x: x, t: 0, tel: tel || 40, dur: 14, w: w2 || 22 }); }
function runStrikes(e, w, col, dmgMul) {
  var S = e.aux.strikes; if (!S) return; var A = arena(w), p = w.player;
  for (var i = S.length - 1; i >= 0; i--) {
    var s = S[i]; s.t++;
    if (s.t === s.tel) { AB.sfx('zap'); w.shake(3); w.burst(s.x, A.y - 4, col, 10, { vx: 3, vy: 3, life: 20, size: 2, glow: true }); }
    if (s.t >= s.tel && s.t < s.tel + s.dur && !s.hit) {
      if (AB.overlap({ x: s.x - s.w / 2, y: A.top || A.y - 260, w: s.w, h: (A.y - (A.top || A.y - 260)) }, p)) {
        if (w.hurtPlayer(e.dmg * (dmgMul || 0.9), s.x, {}) !== 'ignored') s.hit = true;
      }
    }
    if (s.t > s.tel + s.dur) S.splice(i, 1);
  }
}
function drawStrikes(e, c, cx, cy, col, core) {
  var S = e.aux.strikes; if (!S || !S.length) return; var A = e.arenaRef; if (!A) return;
  var top = (A.top || A.y - 260) - cy, bot = A.y - cy;
  for (var i = 0; i < S.length; i++) {
    var s = S[i], x = Math.round(s.x - cx - s.w / 2);
    if (s.t < s.tel) {
      c.globalAlpha = 0.25 + 0.3 * Math.abs(Math.sin(s.t * 0.4)); R(c, col, x + s.w / 2 - 1, top, 2, bot - top);
      R(c, col, x, bot - 3, s.w, 3); c.globalAlpha = 1;
    } else {
      var k = 1 - (s.t - s.tel) / s.dur;
      c.globalAlpha = Math.max(0, k); R(c, col, x, top, s.w, bot - top); R(c, core || '#ffffff', x + 5, top, s.w - 10, bot - top);
      AB.glow(c, x + s.w / 2, bot - 10, 30, col, 0.6 * k); c.globalAlpha = 1;
    }
  }
}
function fan(e, w, sx, sy, n, spread, sp, o) {
  var base = Math.atan2(w.player.y + 10 - sy, w.player.x + 5 - sx);
  for (var i = 0; i < n; i++) {
    var a = base + (i - (n - 1) / 2) * spread;
    var q = { x: sx, y: sy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, team: 'e', life: 200, w: 8, h: 8 };
    for (var k in o) q[k] = o[k];
    w.spawnProj(q);
  }
}
function ring(e, w, sx, sy, n, sp, off, o) {
  for (var i = 0; i < n; i++) {
    var a = off + i / n * Math.PI * 2;
    var q = { x: sx, y: sy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, team: 'e', life: 200, w: 8, h: 8 };
    for (var k in o) q[k] = o[k];
    w.spawnProj(q);
  }
}
function wrapDraw(fn) {
  return function (e, c, cx, cy, t) {
    e.arenaRef = e.arenaRef || (AB.game && AB.game.world && AB.game.world.bossArena);
    drawStrikes(e, c, cx, cy, e.strikeCol || '#9aeaff', e.strikeCore);
    fn(e, c, cx, cy, t);
  };
}
function eyeGlow(c, x, y, col, s) { R(c, col, x, y, s, s); AB.glow(c, x + s / 2, y + s / 2, 9, col, 0.7); }

/* ======================= 4. THE BOGMOTHER ======================= */
B.bogmother = {
  title: 'THE BOGMOTHER', sub: 'Matron of the Drowned Mire', boss: true, name: 'Bogmother',
  w: 40, h: 36, hp: 3800, dmg: 36, gold: 140, superArmor: true, noKb: true, noStun: true,
  init: function (e) { e.invuln = 70; e.aux = { phase: 1, cd: 40, last: '' }; e.face = -1; e.strikeCol = '#7aff4a'; },
  onDeath: cleanup,
  update: function (e, w) {
    var adx = Math.abs(pdx(e, w)), ph = e.aux.phase, A = arena(w);
    e.st++; if (e.invuln > 0) e.invuln--;
    e.spd = ph === 2 ? 1.3 : 1;
    if (e.state !== 'roar' && phaseUp(e, w, [0.5])) { /* roar */ }
    if (e.state === 'idle') {
      face(e, w);
      if (adx > 60) walk(e, w, e.face, 0.6); else stand(e, w);
      if (--e.aux.cd <= 0) {
        var a = choose(e, adx < 80 ? ['smash', 'smash', 'leap'] : ['spit', 'leap', 'spit', 'tide']);
        if (w.enemies.length < 4 && Math.random() < (ph === 2 ? 0.3 : 0.15)) a = 'spawn';
        e.state = a; e.st = 0; e.tele = true; e.hitDone = false; face(e, w);
      }
    } else if (e.state === 'roar') { if (roar(e, w, 'The Bogmother bursts with rot!')) pickEnd(e); }
    else if (e.state === 'smash') {
      stand(e, w);
      if (e.st === 36) { e.tele = false; AB.sfx('slam'); w.shake(6); w.dust(e.x + e.w / 2 + e.face * 26, e.y + e.h, 10); }
      if (e.st > 36 && e.st < 46) hitBox(e, w, atkBox(e, 64, 34, 4), 1.1);
      if (e.st > 70) pickEnd(e);
    } else if (e.state === 'spit') {
      stand(e, w);
      if (e.st === 30 || (ph === 2 && (e.st === 46 || e.st === 62))) {
        e.tele = false; AB.sfx('fire');
        fan(e, w, e.x + e.w / 2 + e.face * 14, e.y + 8, ph === 2 ? 5 : 3, 0.2, 2.8, { kind: 'orb', color: '#9aff4a', dmg: e.dmg * 0.55, grav: 0.02 });
      }
      if (e.st > (ph === 2 ? 84 : 66)) pickEnd(e);
    } else if (e.state === 'leap') {
      if (e.st < 28) stand(e, w);
      else if (e.st === 28) { e.tele = false; AB.sfx('jump'); jump(e, w, e.face * Math.min(4.6, adx / 22 + 1.6), -9.6); e.hitDone = false; }
      else {
        air(e, w);
        if (!e.onGround) hitBox(e, w, { x: e.x, y: e.y, w: e.w, h: e.h }, 1.0);
        if (e.onGround && e.st > 34) {
          AB.sfx('slam'); w.shake(8); w.dust(e.x + e.w / 2, e.y + e.h, 14); e.vx = 0;
          for (var s = -1; s <= 1; s += 2) w.spawnProj({ x: e.x + e.w / 2 + s * 18, y: e.y + e.h - 10, vx: s * 3.2, vy: 0, team: 'e', kind: 'orb', color: '#9aff4a', dmg: e.dmg * 0.6, w: 10, h: 10, life: 100 });
          e.state = 'stagger'; e.st = 0;
        }
      }
    } else if (e.state === 'tide') {
      stand(e, w);
      if (e.st === 34) { e.tele = false; AB.sfx('boss'); w.toast('Toxic tide!', 'skull', '#7aff4a'); }
      if (e.st >= 34 && e.st < 110 && e.st % (ph === 2 ? 14 : 22) === 0) addStrike(e, AB.clamp(w.player.x + 5 + AB.rand(-50, 50), A.x0 + 40, A.x1 - 40), 36, 26);
      if (e.st > 140) pickEnd(e);
    } else if (e.state === 'spawn') {
      stand(e, w);
      if (e.st === 40) { e.tele = false; AB.sfx('altar'); for (var k = 0; k < 2; k++) AB.spawnEnemy(w, k ? 'bomber' : 'husk', AB.clamp(e.x + (k ? 110 : -110), A.x0 + 60, A.x1 - 60), e.y + e.h, { spawnFx: true }); }
      if (e.st > 70) pickEnd(e);
    } else if (e.state === 'stagger') { stand(e, w); if (e.st > (ph === 2 ? 26 : 50)) pickEnd(e); }
    else pickEnd(e);
    runStrikes(e, w, '#7aff4a');
    e.x = AB.clamp(e.x, A.x0 + 20, A.x1 - 20 - e.w);
  },
  draw: wrapDraw(function (e, c, cx, cy) {
    var o = bossBegin(e, c, cx, cy), K = Kf(e), P = e.pal;
    R(c, 'rgba(0,0,0,0.3)', o.x - 22, o.y - 2, 44, 3);
    c.translate(o.x, o.y); c.scale(e.face, 1);
    var bob = Math.round(Math.sin(e.t * 0.08) * 1.5), sm = e.state === 'smash' && e.st > 30 ? 6 : 0, air2 = e.state === 'leap' && e.st > 28 ? -4 : 0;
    // body
    R(c, K('#1a2a14'), -20, -26 + bob + air2, 40, 26); R(c, K('#3a5a24'), -19, -25 + bob + air2, 38, 23); R(c, K('#5a8a34'), -19, -25 + bob + air2, 38, 4);
    R(c, K('#1a2a14'), -14, -36 + bob + air2, 28, 14); R(c, K('#4a7a2c'), -13, -35 + bob + air2, 26, 11);
    for (var i = 0; i < 6; i++) R(c, K('#8aff4a'), -16 + i * 6, -20 + bob + air2 + (i % 2) * 5, 3, 3);
    // eyes + maw
    eyeGlow(c, -6, -32 + bob + air2, '#ffe24a', 4); eyeGlow(c, 4, -32 + bob + air2, '#ffe24a', 4);
    R(c, K('#0a1408'), -10, -24 + bob + air2, 20, 6); for (i = 0; i < 5; i++) R(c, K(P.bone), -9 + i * 4, -24 + bob + air2, 2, 3);
    // arms
    R(c, K('#2a4a1c'), 12 + sm, -22 + bob + air2, 14, 9); R(c, K('#3a5a24'), 24 + sm, -20 + bob + air2, 8, 11);
    R(c, K('#2a4a1c'), -26, -20 + bob, 12, 8);
    // moss drips
    for (i = 0; i < 4; i++) R(c, K('#2a5a1a'), -16 + i * 9, -3 + ((e.t >> 3) + i) % 3, 3, 3);
    if (e.aux.phase === 2) AB.glow(c, 0, -20, 36, '#7aff4a', 0.25 + Math.sin(e.t * 0.2) * 0.1);
    teleMark(c, e, 0, 0);
    c.restore(); c.setTransform(1, 0, 0, 1, 0, 0);
  })
};

/* ======================= 5. THE ARCHBISHOP ======================= */
B.archbishop = {
  title: 'THE ARCHBISHOP OF BONES', sub: 'Choirmaster of the Bone Cathedral', boss: true, name: 'Archbishop', fly: true,
  w: 28, h: 44, hp: 4600, dmg: 38, gold: 160, superArmor: true, noKb: true, noStun: true,
  init: function (e) { e.invuln = 70; e.aux = { phase: 1, cd: 50, last: '', n: 0 }; e.face = -1; e.strikeCol = '#d8d0b8'; e.strikeCore = '#ffffff'; },
  onDeath: cleanup,
  update: function (e, w) {
    var p = w.player, ph = e.aux.phase, A = arena(w), cxb = e.x + e.w / 2, cyb = e.y + e.h / 2, fl = A.y;
    e.st++; if (e.invuln > 0) e.invuln--;
    if (e.state !== 'roar') phaseUp(e, w, [0.5]);
    face(e, w);
    if (e.state === 'idle') {
      flyHover(e, w, AB.clamp(p.x + 5 + Math.sin(e.t * 0.02) * 140, A.x0 + 50, A.x1 - 50), fl - 88 + Math.sin(e.t * 0.04) * 14, 0.012);
      if (--e.aux.cd <= 0) {
        var l = ['skulls', 'spikes', 'choir', 'blink']; if (ph === 2) l.push('rain');
        e.state = choose(e, l); e.st = 0; e.tele = e.state !== 'blink'; e.aux.n = 0;
      }
    } else if (e.state === 'roar') { e.vx *= 0.8; e.vy *= 0.8; if (roar(e, w, 'The choir of the dead rises!')) pickEnd(e); }
    else if (e.state === 'skulls') {
      flyHover(e, w, cxb, cyb, 0.02);
      var shots = ph === 2 ? [30, 44, 58] : [34, 52];
      if (shots.indexOf(e.st) >= 0) { e.tele = false; AB.sfx('shoot'); fan(e, w, cxb, cyb, ph === 2 ? 7 : 5, 0.24, 3.0, { kind: 'bone', dmg: e.dmg * 0.5, homing: 0 }); }
      if (e.st > 84) pickEnd(e);
    } else if (e.state === 'spikes') {
      flyHover(e, w, cxb, fl - 120, 0.03);
      if (e.st === 30) { e.tele = false; AB.sfx('boss'); }
      if (e.st >= 30 && e.st < 90 && e.st % (ph === 2 ? 10 : 15) === 0) addStrike(e, AB.clamp(p.x + 5 + (e.aux.n++ % 2 ? 1 : -1) * AB.rand(0, 70), A.x0 + 40, A.x1 - 40), 34, 20);
      if (e.st > 120) pickEnd(e);
    } else if (e.state === 'choir') {
      flyHover(e, w, (A.x0 + A.x1) / 2, fl - 110, 0.03);
      if (e.st === 34) { e.tele = false; AB.sfx('altar'); }
      if (e.st >= 34 && e.st < 120 && e.st % 12 === 0) { ring(e, w, cxb, cyb, ph === 2 ? 10 : 7, 2.2, e.st * 0.11, { kind: 'bone', dmg: e.dmg * 0.45 }); AB.sfx('shoot'); }
      if (e.st > 140) pickEnd(e);
    } else if (e.state === 'rain') {
      flyHover(e, w, cxb, fl - 140, 0.03);
      if (e.st === 26) e.tele = false;
      if (e.st >= 26 && e.st < 120 && e.st % 5 === 0) w.spawnProj({ x: AB.rand(A.x0 + 40, A.x1 - 40), y: (A.top || fl - 260) + 20, vx: 0, vy: 3.6, team: 'e', kind: 'bone', dmg: e.dmg * 0.45, w: 8, h: 8, life: 160 });
      if (e.st > 140) pickEnd(e);
    } else if (e.state === 'blink') {
      e.vx = e.vy = 0;
      if (e.st === 14) { w.burst(cxb, cyb, '#d8d0b8', 16, { vx: 3, vy: 3, life: 20, size: 2, glow: true }); e.alpha = 0.2; }
      if (e.st === 26) { e.x = AB.clamp(p.x + (Math.random() < 0.5 ? -90 : 90), A.x0 + 40, A.x1 - 60); e.y = fl - 100; e.alpha = 1; AB.sfx('zap'); fan(e, w, e.x + e.w / 2, e.y + 20, ph === 2 ? 5 : 3, 0.3, 3.2, { kind: 'bone', dmg: e.dmg * 0.5 }); }
      if (e.st > 46) pickEnd(e, ph === 2 ? 14 : 30);
    } else pickEnd(e);
    runStrikes(e, w, '#d8d0b8', 0.9);
  },
  draw: wrapDraw(function (e, c, cx, cy) {
    var o = bossBegin(e, c, cx, cy), K = Kf(e), P = e.pal;
    c.translate(o.x, o.y); c.scale(e.face, 1);
    var bob = Math.round(Math.sin(e.t * 0.08) * 2), arm = e.state === 'choir' || e.state === 'spikes' ? -8 : 0;
    // robe
    R(c, K('#2a1a30'), -14, -34 + bob, 28, 34); R(c, K('#4a2a58'), -13, -33 + bob, 26, 30);
    for (var i = 0; i < 5; i++) R(c, K('#2a1a30'), -13 + i * 6, -3 + bob + (i % 2) * 3, 4, 5);
    R(c, K('#e8d8a0'), -2, -33 + bob, 4, 30); R(c, K('#e8d8a0'), -8, -26 + bob, 16, 3);
    // mitre skull
    R(c, K('#1a1020'), -9, -50 + bob, 18, 18); R(c, K(P.bone), -8, -45 + bob, 16, 12); R(c, K('#0a0610'), -6, -42 + bob, 5, 5); R(c, K('#0a0610'), 2, -42 + bob, 5, 5);
    eyeGlow(c, -5, -41 + bob, '#7aff9a', 2); eyeGlow(c, 3, -41 + bob, '#7aff9a', 2);
    R(c, K('#e8d8a0'), -6, -58 + bob, 12, 10); R(c, K('#c8a84a'), -1, -57 + bob, 2, 8);
    // arms / crook
    R(c, K('#4a2a58'), 10, -30 + bob + arm, 6, 14); R(c, K(P.bone), 14, -18 + bob + arm, 4, 4);
    R(c, K('#c8a84a'), 17, -52 + bob + arm, 3, 40); R(c, K('#c8a84a'), 11, -54 + bob + arm, 9, 3);
    AB.glow(c, 0, -26 + bob, 30, '#8aff9a', 0.2 + Math.sin(e.t * 0.1) * 0.1);
    teleMark(c, e, 0, 0);
    c.restore(); c.setTransform(1, 0, 0, 1, 0, 0);
  })
};

/* ======================= 6. THE COLOSSUS ======================= */
B.colossus = {
  title: 'THE CRYSTAL COLOSSUS', sub: 'Heart of the Deep', boss: true, name: 'Colossus',
  w: 50, h: 66, hp: 5400, dmg: 40, gold: 180, superArmor: true, noKb: true, noStun: true,
  init: function (e) { e.invuln = 70; e.aux = { phase: 1, cd: 44, last: '' }; e.face = -1; e.strikeCol = '#7ad8ff'; e.strikeCore = '#ffffff'; },
  onDeath: cleanup,
  update: function (e, w) {
    var adx = Math.abs(pdx(e, w)), ph = e.aux.phase, A = arena(w), cxb = e.x + e.w / 2;
    e.st++; if (e.invuln > 0) e.invuln--;
    e.spd = ph === 2 ? 1.25 : 0.9;
    if (e.state !== 'roar') phaseUp(e, w, [0.5]);
    if (e.state === 'idle') {
      face(e, w);
      if (adx > 70) walk(e, w, e.face, 0.5); else stand(e, w);
      if (--e.aux.cd <= 0) {
        var a = choose(e, adx < 90 ? ['punch', 'punch', 'quake'] : ['quake', 'shards', 'spray', 'roll']);
        e.state = a; e.st = 0; e.tele = true; e.hitDone = false; face(e, w);
      }
    } else if (e.state === 'roar') { if (roar(e, w, 'The Colossus shatters its shell!')) pickEnd(e); }
    else if (e.state === 'punch') {
      stand(e, w);
      if (e.st === 40) { e.tele = false; AB.sfx('swingHeavy'); w.shake(6); }
      if (e.st > 40 && e.st < 52) hitBox(e, w, atkBox(e, 78, 52, 6), 1.15);
      if (e.st > 76) pickEnd(e);
    } else if (e.state === 'quake') {
      stand(e, w);
      if (e.st === 44) {
        e.tele = false; AB.sfx('slam'); w.shake(10); w.dust(cxb, e.y + e.h, 14);
        for (var s = -1; s <= 1; s += 2) for (var j = 0; j < (ph === 2 ? 3 : 2); j++) w.spawnProj({ x: cxb + s * (20 + j * 6), y: e.y + e.h - 10, vx: s * (2.6 + j * 0.8), vy: 0, team: 'e', kind: 'shard', dmg: e.dmg * 0.6, w: 10, h: 14, life: 100 });
      }
      if (e.st > 44 && e.st < 54) hitBox(e, w, { x: e.x - 14, y: e.y + e.h - 24, w: e.w + 28, h: 24 }, 1.1);
      if (e.st > 84) pickEnd(e);
    } else if (e.state === 'shards') {
      stand(e, w);
      if (e.st === 34) { e.tele = false; AB.sfx('ice'); }
      if (e.st >= 34 && e.st < 100 && e.st % (ph === 2 ? 6 : 9) === 0) addStrike(e, AB.clamp(AB.rand(A.x0 + 40, A.x1 - 40), A.x0 + 40, A.x1 - 40), 30, 18);
      if (e.st > 130) pickEnd(e);
    } else if (e.state === 'spray') {
      stand(e, w);
      if (e.st === 30) e.tele = false;
      if (e.st >= 30 && e.st < 80 && e.st % 10 === 0) { AB.sfx('ice'); fan(e, w, cxb, e.y + 14, ph === 2 ? 5 : 3, 0.22, 3.0, { kind: 'shard', dmg: e.dmg * 0.5 }); }
      if (e.st > 96) pickEnd(e);
    } else if (e.state === 'roll') {
      if (e.st < 30) stand(e, w);
      else {
        if (e.st === 30) { e.tele = false; AB.sfx('roll'); }
        e.vx = e.face * (ph === 2 ? 4.4 : 3.6); e.vy = Math.min(e.vy + 0.4, 8); AB.moveBody(e, w.level);
        if (e.st % 4 === 0) w.dust(cxb, e.y + e.h, 2);
        hitBox(e, w, { x: e.x - 2, y: e.y + 6, w: e.w + 4, h: e.h - 6 }, 1.1);
        if (e.hitWall || e.st > 84) { if (e.hitWall) { w.shake(8); AB.sfx('slam'); fan(e, w, cxb, e.y + 10, 5, 0.3, 2.8, { kind: 'shard', dmg: e.dmg * 0.5 }); } e.vx = 0; e.state = 'stagger'; e.st = 0; }
      }
    } else if (e.state === 'stagger') { stand(e, w); if (e.st > (ph === 2 ? 30 : 60)) pickEnd(e); }
    else pickEnd(e);
    runStrikes(e, w, '#7ad8ff');
    e.x = AB.clamp(e.x, A.x0 + 20, A.x1 - 20 - e.w);
  },
  draw: wrapDraw(function (e, c, cx, cy) {
    var o = bossBegin(e, c, cx, cy), K = Kf(e), P = e.pal;
    R(c, 'rgba(0,0,0,0.3)', o.x - 28, o.y - 2, 56, 3);
    c.translate(o.x, o.y); c.scale(e.face, 1);
    var mv = Math.abs(e.vx) > 0.2, sw = mv ? Math.round(Math.sin(e.t * 0.12) * 3) : 0, bob = Math.round(Math.sin(e.t * 0.05));
    var pu = e.state === 'punch' ? (e.st < 40 ? -10 : 22) : 0, ro = e.state === 'roll' && e.st > 30;
    // legs
    R(c, K('#1c3a5a'), -20 + sw, -18, 14, 18); R(c, K('#3a7aaa'), -19 + sw, -18, 12, 15);
    R(c, K('#1c3a5a'), 6 - sw, -18, 14, 18); R(c, K('#3a7aaa'), 7 - sw, -18, 12, 15);
    // torso (crystal)
    R(c, K('#14304a'), -24, -52 + bob, 48, 36); R(c, K('#2c6a9a'), -23, -51 + bob, 46, 33); R(c, K('#7ad8ff'), -23, -51 + bob, 46, 4);
    for (var i = 0; i < 5; i++) { R(c, K('#aaf0ff'), -18 + i * 9, -46 + bob + (i % 2) * 8, 2, 10 - (i % 2) * 3); }
    R(c, K('#0a1c2c'), -8, -42 + bob, 16, 16);
    AB.glow(c, 0, -34 + bob, 24, '#7ad8ff', 0.55 + Math.sin(e.t * 0.1) * 0.15);
    R(c, K('#cff6ff'), -3, -38 + bob, 6, 8);
    // head spires
    R(c, K('#14304a'), -10, -64 + bob, 20, 14); R(c, K('#4a9ac8'), -9, -63 + bob, 18, 11);
    R(c, K('#aaf0ff'), -12, -72 + bob, 4, 10); R(c, K('#aaf0ff'), 8, -72 + bob, 4, 10); R(c, K('#cff6ff'), -2, -76 + bob, 4, 14);
    eyeGlow(c, -5, -58 + bob, '#ffffff', 3); eyeGlow(c, 3, -58 + bob, '#ffffff', 3);
    // shoulders / arms
    R(c, K('#14304a'), -34, -52 + bob, 14, 16); R(c, K('#4a9ac8'), -33, -51 + bob, 12, 12); R(c, K('#aaf0ff'), -30, -62 + bob, 4, 10);
    R(c, K('#14304a'), 20 + pu, -52 + bob, 14, 16); R(c, K('#4a9ac8'), 21 + pu, -51 + bob, 12, 12);
    R(c, K('#14304a'), 24 + pu, -38 + bob, 14, 24); R(c, K('#3a7aaa'), 25 + pu, -37 + bob, 12, 22); R(c, K('#7ad8ff'), 28 + pu, -16 + bob, 12, 10);
    if (ro) AB.glow(c, 0, -30, 44, '#7ad8ff', 0.3);
    teleMark(c, e, 0, 0);
    c.restore(); c.setTransform(1, 0, 0, 1, 0, 0);
  })
};

/* ======================= 7. THE STORMLORD ======================= */
B.stormlord = {
  title: 'THE STORMLORD', sub: 'Tyrant of the Thunder Bastion', boss: true, name: 'Stormlord', fly: true,
  w: 34, h: 48, hp: 6300, dmg: 42, gold: 200, superArmor: true, noKb: true, noStun: true,
  init: function (e) { e.invuln = 70; e.aux = { phase: 1, cd: 46, last: '', n: 0, dx: 0, dy: 0 }; e.face = -1; e.strikeCol = '#ffe24a'; e.strikeCore = '#ffffff'; },
  onDeath: cleanup,
  update: function (e, w) {
    var p = w.player, ph = e.aux.phase, A = arena(w), cxb = e.x + e.w / 2, cyb = e.y + e.h / 2, fl = A.y;
    e.st++; if (e.invuln > 0) e.invuln--;
    if (e.state !== 'roar') phaseUp(e, w, [0.5]);
    face(e, w);
    if (e.state === 'idle') {
      flyHover(e, w, AB.clamp(p.x + 5 + Math.sin(e.t * 0.025) * 160, A.x0 + 50, A.x1 - 50), fl - 100 + Math.sin(e.t * 0.04) * 16, 0.013, 3.6);
      if (--e.aux.cd <= 0) {
        var l = ['bolts', 'forks', 'dash', 'orbs']; if (ph === 2) l.push('storm', 'dash');
        e.state = choose(e, l); e.st = 0; e.tele = true; e.aux.n = 0; e.hitDone = false;
      }
    } else if (e.state === 'roar') { e.vx *= 0.8; e.vy *= 0.8; if (roar(e, w, 'The Stormlord calls the tempest!')) pickEnd(e); }
    else if (e.state === 'bolts') {
      flyHover(e, w, cxb, cyb, 0.02);
      if (e.st === 30) e.tele = false;
      if (e.st >= 30 && e.st < 100 && e.st % (ph === 2 ? 9 : 14) === 0) addStrike(e, AB.clamp(p.x + 5 + AB.rand(-30, 30), A.x0 + 40, A.x1 - 40), 34, 22);
      if (e.st > 130) pickEnd(e);
    } else if (e.state === 'forks') {
      flyHover(e, w, cxb, cyb, 0.02);
      if (e.st === 28) { e.tele = false; AB.sfx('zap'); }
      if (e.st >= 28 && e.st < 28 + (ph === 2 ? 5 : 3) * 14 && (e.st - 28) % 14 === 0) { var k = (e.st - 28) / 14; for (var s = -1; s <= 1; s += 2) addStrike(e, AB.clamp(cxb + s * (40 + k * 52), A.x0 + 40, A.x1 - 40), 30, 20); }
      if (e.st > 140) pickEnd(e);
    } else if (e.state === 'dash') {
      if (e.st < 34) { flyHover(e, w, cxb, cyb - 6, 0.02); if (e.st === 33) { var a2 = aim(e, w, cxb, cyb, ph === 2 ? 6.4 : 5.6); e.aux.dx = a2.vx; e.aux.dy = a2.vy; e.tele = false; AB.sfx('roll'); } }
      else {
        e.vx = e.aux.dx; e.vy = e.aux.dy; AB.moveFly(e, w);
        if (e.st % 3 === 0) w.burst(cxb, cyb, '#ffe24a', 2, { vx: 1, vy: 1, life: 14, size: 2, glow: true });
        hitBox(e, w, { x: e.x - 2, y: e.y - 2, w: e.w + 4, h: e.h + 4 }, 1.2);
        if (e.st > 64) { e.vx *= 0.3; e.vy *= 0.3; e.state = 'stagger'; e.st = 0; }
      }
    } else if (e.state === 'orbs') {
      flyHover(e, w, cxb, cyb, 0.02);
      if (e.st === 30 || e.st === 46 || (ph === 2 && e.st === 62)) { e.tele = false; AB.sfx('zap'); ring(e, w, cxb, cyb, ph === 2 ? 12 : 8, 2.4, e.st * 0.2, { kind: 'orb', color: '#ffe24a', dmg: e.dmg * 0.5 }); }
      if (e.st > 86) pickEnd(e);
    } else if (e.state === 'storm') {
      flyHover(e, w, (A.x0 + A.x1) / 2, fl - 120, 0.03);
      if (e.st === 30) { e.tele = false; AB.sfx('boss'); }
      if (e.st >= 30 && e.st < 150) {
        if (e.st % 8 === 0) addStrike(e, AB.rand(A.x0 + 40, A.x1 - 40), 36, 20);
        if (e.st % 18 === 0) fan(e, w, cxb, cyb, 5, 0.25, 3, { kind: 'orb', color: '#ffe24a', dmg: e.dmg * 0.45 });
      }
      if (e.st > 180) pickEnd(e);
    } else if (e.state === 'stagger') { e.vx *= 0.9; e.vy *= 0.9; AB.moveFly(e, w); if (e.st > (ph === 2 ? 22 : 44)) pickEnd(e); }
    else pickEnd(e);
    runStrikes(e, w, '#ffe24a', 1.0);
  },
  draw: wrapDraw(function (e, c, cx, cy) {
    var o = bossBegin(e, c, cx, cy), K = Kf(e), P = e.pal;
    c.translate(o.x, o.y); c.scale(e.face, 1);
    var bob = Math.round(Math.sin(e.t * 0.09) * 2);
    // cloud cloak
    for (var i = 0; i < 7; i++) R(c, K(i % 2 ? '#2a3a5a' : '#3a4a6a'), -20 + i * 6, -14 + bob + (i % 3) * 3, 8, 12);
    R(c, K('#1a2440'), -16, -40 + bob, 32, 28); R(c, K('#34508a'), -15, -39 + bob, 30, 25); R(c, K('#5a7ac0'), -15, -39 + bob, 30, 3);
    for (i = 0; i < 3; i++) R(c, K('#ffe24a'), -10 + i * 8, -34 + bob + i * 3, 3, 8 - i);
    // head
    R(c, K('#1a2440'), -9, -54 + bob, 18, 16); R(c, K('#b0c4ee'), -8, -53 + bob, 16, 13);
    eyeGlow(c, -5, -49 + bob, '#ffe24a', 3); eyeGlow(c, 3, -49 + bob, '#ffe24a', 3);
    R(c, K('#ffe24a'), -10, -60 + bob, 3, 8); R(c, K('#ffe24a'), 7, -60 + bob, 3, 8); R(c, K('#fff6b0'), -1, -62 + bob, 3, 9);
    // arms with orbs
    var up = e.tele ? -10 : 0;
    R(c, K('#34508a'), 13, -38 + bob + up, 6, 16); R(c, K('#34508a'), -19, -38 + bob + up, 6, 16);
    AB.glow(c, 18, -40 + bob + up, 14, '#ffe24a', 0.8); AB.glow(c, -18, -40 + bob + up, 14, '#ffe24a', 0.8);
    R(c, '#ffffff', 17, -42 + bob + up, 3, 3); R(c, '#ffffff', -19, -42 + bob + up, 3, 3);
    AB.glow(c, 0, -28 + bob, 36, '#7aa8ff', 0.2 + Math.sin(e.t * 0.3) * 0.1);
    teleMark(c, e, 0, 0);
    c.restore(); c.setTransform(1, 0, 0, 1, 0, 0);
  })
};

/* ======================= 8. THE VOIDWATCHER ======================= */
B.voidwatcher = {
  title: 'THE VOIDWATCHER', sub: 'The Eye That Never Closes', boss: true, name: 'Voidwatcher', fly: true,
  w: 40, h: 40, hp: 7200, dmg: 44, gold: 230, superArmor: true, noKb: true, noStun: true,
  init: function (e) { e.invuln = 70; e.aux = { phase: 1, cd: 46, last: '', n: 0, ang: 0, dx: 0, dy: 0 }; e.face = -1; e.strikeCol = '#b06aff'; e.strikeCore = '#f0d8ff'; },
  onDeath: cleanup,
  update: function (e, w) {
    var p = w.player, ph = e.aux.phase, A = arena(w), cxb = e.x + e.w / 2, cyb = e.y + e.h / 2, fl = A.y;
    e.st++; if (e.invuln > 0) e.invuln--;
    if (e.state !== 'roar') phaseUp(e, w, [0.5]);
    face(e, w);
    if (e.state === 'idle') {
      flyHover(e, w, AB.clamp(p.x + 5 + Math.sin(e.t * 0.02) * 120, A.x0 + 50, A.x1 - 50), fl - 96 + Math.sin(e.t * 0.035) * 20, 0.012);
      if (--e.aux.cd <= 0) {
        var l = ['spiral', 'gaze', 'rift', 'blink']; if (ph === 2) l.push('collapse', 'spiral');
        e.state = choose(e, l); e.st = 0; e.tele = e.state !== 'blink'; e.aux.n = 0; e.aux.ang = 0;
      }
    } else if (e.state === 'roar') { e.vx *= 0.8; e.vy *= 0.8; if (roar(e, w, 'The Voidwatcher opens its true eye!')) pickEnd(e); }
    else if (e.state === 'spiral') {
      flyHover(e, w, cxb, cyb, 0.02);
      if (e.st === 26) e.tele = false;
      if (e.st >= 26 && e.st < 110 && e.st % 4 === 0) {
        e.aux.ang += ph === 2 ? 0.5 : 0.36;
        ring(e, w, cxb, cyb, ph === 2 ? 3 : 2, 2.3, e.aux.ang, { kind: 'orb', color: '#b06aff', dmg: e.dmg * 0.45, w: 7, h: 7 });
        if (e.st % 8 === 0) AB.sfx('shoot');
      }
      if (e.st > 130) pickEnd(e);
    } else if (e.state === 'gaze') {
      flyHover(e, w, cxb, cyb, 0.02);
      if (e.st === 40) { e.tele = false; var a = aim(e, w, cxb, cyb, 1); e.aux.dx = a.vx; e.aux.dy = a.vy; AB.sfx('boss'); }
      if (e.st >= 40 && e.st < 76 && e.st % 3 === 0) {
        w.spawnProj({ x: cxb, y: cyb, vx: e.aux.dx * 5.2, vy: e.aux.dy * 5.2, team: 'e', kind: 'orb', color: '#f0d8ff', dmg: e.dmg * 0.6, w: 9, h: 9, life: 140 });
        if (ph === 2) for (var s = -1; s <= 1; s += 2) w.spawnProj({ x: cxb, y: cyb, vx: (e.aux.dx * Math.cos(s * 0.3) - e.aux.dy * Math.sin(s * 0.3)) * 4.6, vy: (e.aux.dx * Math.sin(s * 0.3) + e.aux.dy * Math.cos(s * 0.3)) * 4.6, team: 'e', kind: 'orb', color: '#b06aff', dmg: e.dmg * 0.5, w: 8, h: 8, life: 140 });
      }
      if (e.st > 100) pickEnd(e);
    } else if (e.state === 'rift') {
      flyHover(e, w, cxb, fl - 130, 0.03);
      if (e.st === 30) { e.tele = false; AB.sfx('boss'); }
      if (e.st >= 30 && e.st < 100 && e.st % (ph === 2 ? 8 : 12) === 0) addStrike(e, AB.clamp(p.x + 5 + AB.rand(-80, 80), A.x0 + 40, A.x1 - 40), 36, 24);
      if (e.st > 130) pickEnd(e);
    } else if (e.state === 'collapse') {
      flyHover(e, w, (A.x0 + A.x1) / 2, fl - 120, 0.03);
      if (e.st === 40) { e.tele = false; AB.sfx('explode'); w.shake(6); w.flashScreen('#a04aff', 0.2); ring(e, w, cxb, cyb, 18, 1.9, 0, { kind: 'orb', color: '#b06aff', dmg: e.dmg * 0.5 }); }
      if (e.st === 70) ring(e, w, cxb, cyb, 18, 2.4, 0.17, { kind: 'orb', color: '#f0d8ff', dmg: e.dmg * 0.5 });
      if (e.st === 100) ring(e, w, cxb, cyb, 18, 2.9, 0, { kind: 'orb', color: '#b06aff', dmg: e.dmg * 0.5 });
      if (e.st > 130) pickEnd(e);
    } else if (e.state === 'blink') {
      e.vx = e.vy = 0;
      if (e.st === 12) { w.burst(cxb, cyb, '#b06aff', 18, { vx: 3, vy: 3, life: 22, size: 2, glow: true }); e.alpha = 0.15; }
      if (e.st === 26) { e.x = AB.clamp(p.x + AB.rand(-110, 110), A.x0 + 40, A.x1 - 60); e.y = fl - AB.rand(90, 130); e.alpha = 1; AB.sfx('zap'); fan(e, w, e.x + e.w / 2, e.y + 20, ph === 2 ? 7 : 5, 0.26, 3.2, { kind: 'orb', color: '#b06aff', dmg: e.dmg * 0.5 }); }
      if (e.st > 48) pickEnd(e, ph === 2 ? 12 : 28);
    } else pickEnd(e);
    runStrikes(e, w, '#b06aff', 1.0);
  },
  draw: wrapDraw(function (e, c, cx, cy) {
    var o = bossBegin(e, c, cx, cy), K = Kf(e), P = e.pal;
    c.translate(o.x, o.y - 20); c.scale(e.face, 1);
    var bob = Math.round(Math.sin(e.t * 0.07) * 2), op = e.state === 'gaze' || e.state === 'collapse' ? 1 : 0;
    AB.glow(c, 0, bob, 44, '#7a2aff', 0.35 + Math.sin(e.t * 0.1) * 0.1);
    // tendrils
    for (var i = 0; i < 6; i++) { var tx = -22 + i * 9, sw = Math.round(Math.sin(e.t * 0.1 + i) * 3); R(c, K('#1a0a30'), tx, 10 + bob, 4, 12 + (i % 3) * 4); R(c, K('#4a1a8a'), tx + sw, 22 + bob + (i % 3) * 4, 3, 8); }
    // eyeball
    R(c, K('#1a0a30'), -20, -20 + bob, 40, 40); R(c, K('#2a1250'), -18, -22 + bob, 36, 44); R(c, K('#2a1250'), -22, -16 + bob, 44, 32);
    R(c, K('#e8dcff'), -16, -16 + bob, 32, 32); R(c, K('#e8dcff'), -19, -12 + bob, 38, 24);
    var px = AB.clamp(pdx(e, w2()) * 0.06, -5, 5) * e.face, py = AB.clamp(pdy(e, w2()) * 0.06, -4, 4);
    R(c, K('#7a2aff'), -8 + px, -8 + py + bob, 16, 16); R(c, K('#0a0418'), -4 + px, -4 + py + bob - op, 8, 8 + op * 2);
    R(c, '#ffffff', -6 + px, -7 + py + bob, 3, 3);
    // veins
    for (i = 0; i < 4; i++) R(c, K('#b0309a'), -18 + i * 3, -12 + i * 8 + bob, 6, 1);
    // crown spikes
    R(c, K('#2a1250'), -16, -30 + bob, 4, 10); R(c, K('#2a1250'), 12, -30 + bob, 4, 10); R(c, K('#4a1a8a'), -2, -32 + bob, 4, 12);
    teleMark(c, e, 0, 20);
    c.restore(); c.setTransform(1, 0, 0, 1, 0, 0);
  })
};
function w2() { return AB.game.world; }

/* ============================================================
   9. MALPHAS, SOVEREIGN OF HELL — the final boss.
   Huge, three phases, a full moveset that gets faster and
   meaner with every phase. Intended as the hardest fight.
   ============================================================ */
B.hellsovereign = {
  title: 'MALPHAS THE SOVEREIGN', sub: 'Sovereign of Hell, Lord of the Nine Pits', boss: true, name: 'Malphas', phases: 3,
  w: 52, h: 108, hp: 15000, dmg: 48, gold: 600, superArmor: true, noKb: true, noStun: true,
  init: function (e) { e.invuln = 90; e.aux = { phase: 1, cd: 36, last: '', n: 0, dx: 0, dy: 0, combo: 0 }; e.face = -1; e.strikeCol = '#ff5a1a'; e.strikeCore = '#fff2b0'; },
  onDeath: function (e, w) { cleanup(e, w); w.flashScreen('#ff3a10', 0.9); w.shake(16); for (var i = 0; i < 6; i++) w.explode(e.x + AB.rand(0, e.w), e.y + AB.rand(0, e.h), 36, 0, 'e', {}); },
  update: function (e, w) {
    var adx = Math.abs(pdx(e, w)), ph = e.aux.phase, A = arena(w), p = w.player, cxb = e.x + e.w / 2, fl = A.y;
    e.st++; if (e.invuln > 0) e.invuln--;
    e.spd = ph === 1 ? 1.0 : (ph === 2 ? 1.3 : 1.6);
    if (e.state !== 'roar' && phaseUp(e, w, [0.66, 0.33])) { e.aux.cd = 0; }
    if (e.state === 'idle') {
      face(e, w);
      if (adx > 64) walk(e, w, e.face, 0.75); else stand(e, w);
      if (--e.aux.cd <= 0) {
        var near = adx < 100, l;
        if (near) l = ['cleave', 'cleave', 'slam', 'stomp'];
        else l = ['fireball', 'leap', 'meteors', 'pillars', 'charge'];
        if (ph >= 2) l.push('pillars', 'infernoRing');
        if (ph >= 3) l.push('beam', 'meteors', 'leap');
        e.state = choose(e, l); e.st = 0; e.tele = true; e.hitDone = false; e.aux.n = 0; face(e, w);
        if (w.enemies.length < 3 && Math.random() < (ph === 1 ? 0.12 : 0.25)) e.state = 'summon';
      }
    } else if (e.state === 'roar') {
      stand(e, w);
      if (e.st === 1) { AB.sfx('boss'); w.shake(12); w.flashScreen('#ff3a10', 0.35); w.ring(cxb, e.y + 30, 160, '#ff5a1a'); w.toast(e.aux.phase === 2 ? 'MALPHAS IGNITES THE PIT!' : 'MALPHAS UNLEASHES HIS TRUE FORM!', 'skull', '#ff6a3a'); }
      if (e.st % 6 === 0) w.burst(cxb, e.y + 10, '#ff7a2a', 6, { vx: 3, vy: 3, life: 26, size: 2, glow: true });
      if (e.st === 30 || e.st === 50) ring(e, w, cxb, e.y + 40, 14, 2.6, e.st * 0.1, { kind: 'orb', color: '#ff5a1a', dmg: e.dmg * 0.45 });
      if (e.st > 84) pickEnd(e);
    }
    else if (e.state === 'cleave') {
      stand(e, w);
      var wind = ph === 3 ? 24 : 34;
      if (e.st === wind) { e.tele = false; AB.sfx('swingHeavy'); w.shake(5); }
      if (e.st > wind && e.st < wind + 11) hitBox(e, w, atkBox(e, 96, 62, 8), 1.1);
      if (ph >= 2 && e.st === wind + 14) { AB.sfx('swingHeavy'); e.hitDone = false; face(e, w); }
      if (ph >= 2 && e.st > wind + 14 && e.st < wind + 24) hitBox(e, w, atkBox(e, 96, 62, 8), 1.1);
      if (ph === 3 && e.st === wind + 8) fan(e, w, cxb + e.face * 40, e.y + 50, 3, 0.18, 3.4, { kind: 'fire', color: '#ff5a1a', dmg: e.dmg * 0.5 });
      if (e.st > wind + (ph >= 2 ? 40 : 26)) pickEnd(e);
    } else if (e.state === 'slam') {
      stand(e, w);
      var sw = ph === 3 ? 30 : 42;
      if (e.st === sw) {
        e.tele = false; AB.sfx('slam'); w.shake(10); w.dust(cxb + e.face * 40, e.y + e.h, 14);
        for (var s = -1; s <= 1; s += 2) for (var j = 0; j < (ph === 1 ? 1 : 2); j++) w.spawnProj({ x: cxb + s * (30 + j * 8), y: e.y + e.h - 12, vx: s * (3 + j * 1.0), vy: 0, team: 'e', kind: 'fire', color: '#ff5a1a', dmg: e.dmg * 0.6, w: 12, h: 12, life: 110 });
      }
      if (e.st > sw && e.st < sw + 9) hitBox(e, w, atkBox(e, 80, 40, 40), 1.15);
      if (e.st > sw + 32) pickEnd(e);
    } else if (e.state === 'stomp') {
      stand(e, w);
      if (e.st === 30 || (ph >= 2 && e.st === 48) || (ph === 3 && e.st === 66)) {
        e.tele = false; AB.sfx('slam'); w.shake(9);
        for (var q = -2; q <= 2; q++) if (q) addStrike(e, AB.clamp(cxb + q * 44, A.x0 + 40, A.x1 - 40), 20, 20);
        hitBox(e, w, { x: e.x - 24, y: e.y + e.h - 26, w: e.w + 48, h: 26 }, 1.0); e.hitDone = false;
      }
      if (e.st > 96) pickEnd(e);
    } else if (e.state === 'fireball') {
      stand(e, w);
      var times = ph === 1 ? [34, 52] : (ph === 2 ? [30, 44, 58] : [24, 36, 48, 60]);
      if (times.indexOf(e.st) >= 0) { e.tele = false; AB.sfx('fire'); fan(e, w, cxb + e.face * 22, e.y + 30, ph === 1 ? 5 : 7, 0.2, 3.1, { kind: 'fire', color: '#ff5a1a', dmg: e.dmg * 0.55, w: 10, h: 10 }); }
      if (e.st > 84) pickEnd(e);
    } else if (e.state === 'leap') {
      if (e.st < 26) stand(e, w);
      else if (e.st === 26) { e.tele = false; AB.sfx('jump'); jump(e, w, e.face * Math.min(5.4, adx / 20 + 1.8), -10.6); }
      else {
        air(e, w);
        if (!e.onGround) hitBox(e, w, { x: e.x, y: e.y + 10, w: e.w, h: e.h - 10 }, 1.0);
        if (e.onGround && e.st > 32) {
          AB.sfx('slam'); w.shake(12); w.dust(cxb, e.y + e.h, 16); e.vx = 0;
          for (var s2 = -1; s2 <= 1; s2 += 2) for (var k2 = 0; k2 < (ph === 3 ? 3 : 2); k2++) w.spawnProj({ x: cxb + s2 * 24, y: e.y + e.h - 10, vx: s2 * (2.8 + k2 * 0.9), vy: 0, team: 'e', kind: 'fire', color: '#ff5a1a', dmg: e.dmg * 0.6, w: 12, h: 12, life: 110 });
          if (ph >= 2) addStrike(e, p.x + 5, 22, 22);
          e.state = 'stagger'; e.st = 0;
        }
      }
    } else if (e.state === 'meteors') {
      stand(e, w);
      if (e.st === 34) { e.tele = false; AB.sfx('boss'); }
      var step = ph === 1 ? 7 : (ph === 2 ? 5 : 3);
      if (e.st >= 34 && e.st < 110 && e.st % step === 0) w.spawnProj({ x: AB.rand(A.x0 + 40, A.x1 - 40), y: (A.top || fl - 260) + 10, vx: AB.rand(-0.6, 0.6), vy: 3.6, team: 'e', kind: 'fire', color: '#ff7a2a', dmg: e.dmg * 0.55, w: 12, h: 12, life: 200 });
      if (e.st > 130) pickEnd(e);
    } else if (e.state === 'pillars') {
      stand(e, w);
      if (e.st === 34) { e.tele = false; AB.sfx('fire'); }
      if (e.st >= 34 && e.st < 120 && e.st % (ph === 3 ? 8 : (ph === 2 ? 11 : 16)) === 0) {
        var base = p.x + 5, n = e.aux.n++;
        addStrike(e, AB.clamp(base + (n % 2 ? 1 : -1) * (n * 14), A.x0 + 40, A.x1 - 40), 34, 24);
        if (ph >= 2) addStrike(e, AB.clamp(AB.rand(A.x0 + 40, A.x1 - 40), A.x0 + 40, A.x1 - 40), 34, 24);
      }
      if (e.st > 150) pickEnd(e);
    } else if (e.state === 'charge') {
      if (e.st < 30) stand(e, w);
      else {
        if (e.st === 30) { e.tele = false; AB.sfx('roll'); }
        e.vx = e.face * (ph === 1 ? 4.2 : (ph === 2 ? 5.0 : 5.8)); e.vy = Math.min(e.vy + 0.4, 8); AB.moveBody(e, w.level);
        if (e.st % 3 === 0) { w.dust(cxb, e.y + e.h, 2); w.burst(cxb, e.y + e.h - 4, '#ff5a1a', 2, { vx: 1, vy: 1, life: 14, size: 2, glow: true }); }
        hitBox(e, w, { x: e.x - 2, y: e.y + 8, w: e.w + 4, h: e.h - 8 }, 1.15);
        if (e.hitWall || e.st > 80) {
          if (e.hitWall) { w.shake(10); AB.sfx('slam'); if (ph >= 2) ring(e, w, cxb, e.y + 40, 8, 2.8, 0, { kind: 'fire', color: '#ff5a1a', dmg: e.dmg * 0.5 }); }
          e.vx = 0; e.state = 'stagger'; e.st = 0;
        }
      }
    } else if (e.state === 'infernoRing') {
      stand(e, w);
      if (e.st === 30) e.tele = false;
      if (e.st >= 30 && e.st < 100 && e.st % 14 === 0) { AB.sfx('fire'); ring(e, w, cxb, e.y + 36, ph === 3 ? 16 : 12, 2.2 + (e.st - 30) * 0.012, e.st * 0.13, { kind: 'fire', color: '#ff5a1a', dmg: e.dmg * 0.5, w: 9, h: 9 }); }
      if (e.st > 116) pickEnd(e);
    } else if (e.state === 'beam') {
      /* a sweeping curtain of fire from his chest across the whole arena */
      stand(e, w);
      if (e.st === 40) { e.tele = false; AB.sfx('explode'); w.shake(8); e.aux.dx = e.face; }
      if (e.st >= 40 && e.st < 120 && e.st % 3 === 0) {
        var a = (e.st - 40) / 80, ang = e.aux.dx > 0 ? -0.2 + a * 1.2 : Math.PI + 0.2 - a * 1.2;
        w.spawnProj({ x: cxb, y: e.y + 34, vx: Math.cos(ang) * 4.4, vy: Math.sin(ang) * 4.4, team: 'e', kind: 'fire', color: '#ffb02a', dmg: e.dmg * 0.5, w: 10, h: 10, life: 160 });
      }
      if (e.st > 140) pickEnd(e);
    } else if (e.state === 'summon') {
      stand(e, w);
      if (e.st === 40) {
        e.tele = false; AB.sfx('altar'); w.flashScreen('#ff3a10', 0.15);
        var kinds = ['brute', 'hexer', 'archer', 'bomber'];
        for (var m = 0; m < (ph === 1 ? 2 : 3); m++) AB.spawnEnemy(w, kinds[(m + (Math.random() * 3 | 0)) % 4], AB.clamp(cxb + (m - 1) * 130, A.x0 + 60, A.x1 - 60), e.y + e.h, { spawnFx: true });
      }
      if (e.st > 74) pickEnd(e);
    } else if (e.state === 'stagger') { stand(e, w); if (e.st > (ph === 3 ? 16 : (ph === 2 ? 30 : 56))) pickEnd(e); }
    else pickEnd(e);
    runStrikes(e, w, '#ff5a1a', 1.0);
    e.x = AB.clamp(e.x, A.x0 + 20, A.x1 - 20 - e.w);
  },
  draw: wrapDraw(function (e, c, cx, cy) {
    var o = bossBegin(e, c, cx, cy), ph = e.aux.phase, M = AB.malphas;
    var fire = ph === 1 ? '#ff3a1a' : (ph === 2 ? '#ff6a1a' : '#ffb02a');
    var flash = (e.flash > 0 || e.hitF > 0) && M.flash;
    R(c, 'rgba(0,0,0,0.4)', o.x - 36, o.y - 2, 72, 4);
    var SH = 124, SW = Math.round(SH * M.w / M.h);
    var mv = Math.abs(e.vx) > 0.2, bob = Math.sin(e.t * 0.07) * 1.5, sq = 0, lean = 0, rise = 0;
    if (mv) bob += Math.abs(Math.sin(e.t * 0.2)) * -2;
    if (e.state === 'cleave') lean = e.st < 34 ? -0.08 : 0.14;
    else if (e.state === 'slam') { lean = e.st < 42 ? -0.12 : 0.1; sq = e.st >= 42 && e.st < 50 ? 0.08 : 0; }
    else if (e.state === 'charge' && e.st > 30) lean = 0.16;
    else if (e.state === 'leap' && e.st > 26 && !e.onGround) rise = -4;
    else if (e.state === 'roar') lean = -0.06 + Math.sin(e.t * 0.9) * 0.02;
    AB.glow(c, o.x, o.y - SH * 0.5, 70 + ph * 12, fire, 0.16 + ph * 0.07 + Math.sin(e.t * 0.2) * 0.05);
    c.translate(o.x, o.y + rise); c.scale(e.face, 1); c.rotate(lean);
    if (M.img.complete && M.img.naturalWidth) {
      c.imageSmoothingEnabled = false;
      c.drawImage(flash ? M.flash : M.img, -SW / 2, -SH * (1 + sq) + bob, SW, SH * (1 + sq));
    } else R(c, '#5a1018', -22, -90, 44, 90);
    // fire swell on the blade side while attacking
    if (e.state === 'cleave' && e.st >= 34 && e.st < 46) { AB.glow(c, 46, -50, 52, fire, 0.7); }
    if (e.state === 'slam' && e.st >= 42 && e.st < 52) AB.glow(c, 40, -6, 50, fire, 0.7);
    teleMark(c, e, 0, 0);
    c.restore(); c.setTransform(1, 0, 0, 1, 0, 0);
  })
};
})();
