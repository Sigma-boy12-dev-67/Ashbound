/* ============================================================================
   Car Potion - an ultra rare consumable.
   Drink it and a car is hurled across the level. Everything it touches dies:
   every enemy, any ambush arena, and the stage boss (even if not yet awoken).
   The car runs to the far end, ricochets and sweeps the whole level back.
   The sprite (assets/car.png, 55x16) is embedded below as a data URI so it can
   never fail to load or go missing from the offline cache.
   ========================================================================== */
(function () {
'use strict';
var AB = window.AB, T = AB.T, World = AB.World;

var CAR_SRC = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADcAAAAQCAYAAACycufIAAACNElEQVR4Xr1WTUtCQRQdwV1UGtFCi9CSNn1QiyB4i6BFRf6DFuLCZZtWLlpGf0MSgoqWBrULfBC0KLJVKM+i3ESgFNHSuDfvY94485zR7ICoz5l75sw5c8cA+0OMJaymSbm3sh0wGW+KnoqLYmbXdtr4w9F55ZqK+UxfBQZNdsNPTKP6gK9X50q75Hh8FcY2++VgkBYsI9ARwwOEQR2Yp7ngpo7AmZV0W9wfr3MdU4fOEYG45XzMyBkVSJi2bYzRhioFkqiBoahJWRduLFsCPQBB/wGKspiU+nsZ6emdh6x5iWnxnLmYtS3VUq+VpM/5ZgFzi/mM676MXIbhkRgbDE0quVGcBn/VPsLzSxwgFM9HeDTBogsbSpNUHU9F+nJXYBOLSa16pcKB71iACT+MBaGQBte52v2FNNvgCAy+vdz3LHZpfc/9TQa+c4qRp7iHYnM41S/+pvx8LU8svz5qSEYHmC9sWZZHg90SS2NkkJ1jE3TLT80NuxudD4gnDxAJjsXjcXzsOA6+k1DbtqGjSR3/bDzjWfIDOAcR9hvXDT+JQ+e4LoMHkkSSkyTs7PiEVZ6qLJvNepwUHdeFKo48LwE21o+f0sZfSZ5YiiJFTMV+HeQBbXo3tcly5xVcVHprmp0Wv9ENcK8TeNdEUeIVoOIHM2QbonPpNsVYwvdIJIKxZIxhx00ll9lh4Qa18J97QWuztfiJh7/rdMQBXAI+JiCsl8UboCt+k8WJf89M5v4FjPl/AC/eUgV/8eOrAAAAAElFTkSuQmCC';
var carImg = new Image(), carReady = false;
carImg.onload = function () { carReady = true; };
carImg.src = CAR_SRC;
var CAR_W = 55, CAR_H = 16, KILL_R = 34;

/* drop chances (a run can only ever drop ONE) */
AB.CAR_DROP = { chest: 0.006, bigChest: 0.02, elite: 0.006, normal: 0.0002 };

World.prototype.rollCarPotion = function (chance, x, y) {
  var r = this.run;
  if (r.carFound || r.carPotions > 0) return false;
  if (Math.random() >= chance) return false;
  r.carFound = true;
  this.pickups.push(this.mkPickup('carpotion', x, y, 1, { vy: -4.5 }));
  return true;
};

World.prototype.collectCarPotion = function () {
  var r = this.run;
  r.carPotions = (r.carPotions || 0) + 1;
  AB.sfx('altar'); AB.sfx('portal');
  this.flashScreen('#e0a0ff', 0.45); this.shake(3);
  this.ring(this.player.x + 5, this.player.y + 10, 70, '#e0a0ff');
  this.toast('ULTRA RARE! Car Potion found', 'flask', '#e0a0ff');
  this.toast(AB.input.lastDevice === 'touch' ? 'Tap CAR to drink it' : 'Press ' + (AB.input.lastDevice === 'pad' ? 'L3' : 'C') + ' to drink it', 'flask', '#d8cfc0');
};

/* ---------- drinking ---------- */
World.prototype.canDrinkCar = function () {
  var p = this.player;
  return (this.run.carPotions || 0) > 0 && !this.car && !p.dead && !this.over && !this.modal;
};
World.prototype.startCarPotion = function () {
  if (!this.canDrinkCar()) { if ((this.run.carPotions || 0) > 0) AB.sfx('error'); return; }
  var p = this.player;
  this.run.carPotions--;
  p.atk = null; p.guard = 0; p.iframes = Math.max(p.iframes, 70);
  this.car = { phase: 'drink', t: 0, dir: p.face || 1, x: 0, y: 0, vx: 0, leg: 0, ang: 0, sndT: 0, kills: 0, gold: 0, embers: 0 };
  AB.sfx('altar'); this.flashScreen('#e0a0ff', 0.5); this.shake(2);
  this.toast('You drink the Car Potion...', 'flask', '#e0a0ff');
};

/* ---------- loot for mass kills: banked straight into the run (no pickup spam) ---------- */
World.prototype.carLoot = function (e) {
  var s = this.player.s, c = this.car;
  var gv = Math.max(1, Math.round((e.gold || 3) * s.goldMul * (e.elite ? 2.2 : 1)));
  var em = Math.round((e.elite ? 3 : 0.45) * s.emberMul);
  this.run.gold += gv; this.run.embers += em;
  if (c) { c.gold += gv; c.embers += em; }
};

/* ---------- car terrain following ---------- */
function surfaceY(w, x, curY) {
  var L = w.level, tx = Math.floor(AB.clamp(x, 0, L.W * T - 1) / T), ty = Math.floor((curY + CAR_H) / T), i;
  if (L.solidAt(tx, ty - 1)) { // inside a wall: climb out
    for (i = 1; i < 12; i++) if (!L.solidAt(tx, ty - 1 - i)) return (ty - i) * T - CAR_H;
    return curY;
  }
  for (i = 0; i < 6; i++) if (L.solidAt(tx, ty + i)) return (ty + i) * T - CAR_H;
  return null; // pit: fly straight across
}

/* ---------- sweep kills ---------- */
function crush(w, e) {
  if (e.dead) return;
  var c = w.car;
  w.killEnemy(e, { car: true });
  c.kills++;
  w.burst(e.x + e.w / 2, e.y + e.h / 2, '#ffd8ff', 6, { vx: 3, vy: 3, life: 18, size: 2, glow: true });
  if (c.sndT <= 0) { AB.sfx('hit'); c.sndT = 3; }
}
function touchBoss(w, x) {
  var L = w.level, b = L.boss;
  if (!b || b.state === 2) return;
  if (b.state === 0 && x > b.x0 - T) { // boss not awake yet: wake it only to be flattened
    b.state = 1;
    var bd = AB.BOSSES[b.type];
    w.bossRef = AB.spawnEnemy(w, b.type, (b.x0 + b.x1) / 2 + 120, b.y - 100, { boss: true });
    w.bossRef.spawnT = 0; w.bossRef.invuln = 0;
    w.banner = { title: bd.title, sub: 'Flattened by a car', t: 0, max: 120, boss: true };
    AB.sfx('boss'); w.shake(8);
  }
}
function touchArenas(w, x) {
  var L = w.level;
  for (var i = 0; i < L.arenas.length; i++) {
    var a = L.arenas[i];
    if (a.state < 2 && x > a.x0 - T && x < a.x1 + T) { a.wave = a.waves; a.wait = 0; if (a.state === 0) a.state = 1; }
  }
}
function sweepAt(w, x) {
  var i, e;
  touchArenas(w, x); touchBoss(w, x);
  for (i = 0; i < w.enemies.length; i++) {
    e = w.enemies[i];
    if (!e.dead && Math.abs(e.x + e.w / 2 - x) < KILL_R + e.w / 2) crush(w, e);
  }
  for (i = 0; i < w.projs.length; i++) if (w.projs[i].team === 'e') w.projs[i].dead = true;
}
function finishCar(w) {
  var c = w.car, i, e;
  for (i = 0; i < w.enemies.length; i++) { e = w.enemies[i]; if (!e.dead) crush(w, e); } // failsafe: nobody survives
  var L = w.level;
  for (i = 0; i < L.arenas.length; i++) if (L.arenas[i].state < 2) { L.arenas[i].wave = L.arenas[i].waves; L.arenas[i].wait = 0; if (L.arenas[i].state === 0) L.arenas[i].state = 1; }
  w.toast(c.kills + ' crushed   +' + c.gold + ' gold   +' + c.embers + ' embers', 'skull', '#ffd24a');
  w.car = null;
}

/* ---------- per-tick ---------- */
World.prototype.updateCar = function () {
  var c = this.car, p = this.player, L = this.level;
  var has = (this.run.carPotions || 0) > 0 && !c; // show the touch button only while a potion is held
  if (has !== this._carBtn) { this._carBtn = has; var el = document.getElementById('t-car'); if (el) el.classList.toggle('hidden', !has); }
  if (!c) return;
  c.t++; if (c.sndT > 0) c.sndT--;

  if (c.phase === 'drink') { // 40 ticks of rising power
    p.iframes = Math.max(p.iframes, 20);
    if (c.t % 3 === 0) this.burst(p.x + 5, p.y + 8, '#e0a0ff', 3, { vx: 1.2, vy: 1.5, life: 24, size: 2, glow: true, g: -0.03 });
    if (c.t === 20) { AB.sfx('boss'); this.shake(5); this.ring(p.x + 5, p.y + 10, 90, '#e0a0ff'); }
    if (c.t >= 40) {
      c.phase = 'run'; c.t = 0; c.leg = 0;
      c.x = p.x + 5 + c.dir * 8; c.y = p.y + 22 - CAR_H; c.vx = 6 * c.dir;
      AB.sfx('explode'); this.flashScreen('#ffffff', 0.5); this.shake(8);
      this.ring(c.x, c.y + 8, 80, '#ffd8ff');
    }
    return;
  }

  // run: accelerate to full speed, follow the terrain, flatten everything in the column
  var top = 46, ax = Math.min(top, Math.abs(c.vx) + 2.2);
  c.vx = c.dir * ax;
  var steps = Math.ceil(ax / 10), k;
  for (k = 0; k < steps; k++) { c.x += c.vx / steps; sweepAt(this, c.x); }
  var sy = surfaceY(this, c.x, c.y);
  if (sy !== null) c.y += (sy - c.y) * 0.4;
  c.ang = Math.sin(c.t * 0.7) * 0.03 + (c.t < 14 ? -0.35 * (1 - c.t / 14) : 0);
  if (c.t % 1 === 0) {
    this.burst(c.x - c.dir * 26, c.y + 12, '#ffb04a', 2, { vx: 1, vy: 1, life: 18, size: 3, glow: true, g: -0.02 });
    this.burst(c.x - c.dir * 22, c.y + 14, '#ff5a1a', 1, { vx: 1, vy: 0.6, life: 22, size: 2 });
    this.burst(c.x, c.y + 15, '#bbb', 1, { vx: 1.5, vy: 0.6, life: 12, size: 1 });
  }
  this.shake(1.2);

  var W = L.W * T;
  if ((c.dir > 0 && c.x >= W - 20) || (c.dir < 0 && c.x <= 20)) {
    if (c.leg === 0) { // wall hit: explode and ricochet back through the whole level
      c.leg = 1; c.dir = -c.dir; c.vx = c.dir * 8; c.t = 0;
      this.explode(c.x - c.dir * 10, c.y + 6, 60, 0, 'x', { color: '#ffd8ff' });
      this.flashScreen('#ffffff', 0.6); this.shake(10);
    } else { // far wall: the car goes out in a blaze
      this.explode(c.x, c.y + 6, 80, 0, 'x', { color: '#ffd8ff' });
      this.burst(c.x, c.y + 8, '#ffd8ff', 40, { vx: 6, vy: 6, life: 50, size: 3, glow: true });
      this.flashScreen('#ffffff', 0.7); this.shake(12);
      finishCar(this);
    }
  }
};

/* camera: follow the car while it runs */
World.prototype.carCamera = function () {
  var c = this.car; if (!c || c.phase !== 'run') return false;
  var L = this.level, cam = this.cam;
  var tx = AB.clamp(c.x + c.dir * 60 - AB.W / 2, 0, L.W * T - AB.W), ty = AB.clamp(c.y - AB.H * 0.58, 0, L.H * T - AB.H);
  cam.x += (tx - cam.x) * 0.5; cam.y += (ty - cam.y) * 0.25;
  return true;
};

/* ---------- drawing ---------- */
World.prototype.drawCar = function (c, cx, cy, t) {
  var car = this.car;
  if (!car || car.phase !== 'run') return;
  var x = Math.round(car.x - cx), y = Math.round(car.y - cy);
  AB.glow(c, x, y + 8, 70, '#e0a0ff', 0.55);
  AB.glow(c, x - car.dir * 34, y + 12, 40, '#ff8a2a', 0.6);
  c.save();
  c.translate(x, y + CAR_H / 2); c.scale(car.dir, 1); c.rotate(car.ang);
  if (carReady) c.drawImage(carImg, -CAR_W / 2, -CAR_H / 2);
  else { c.fillStyle = '#35497e'; c.fillRect(-CAR_W / 2, -CAR_H / 2, CAR_W, CAR_H); }
  c.restore();
};

World.prototype.drawCarPickup = function (c, pk, x, y, t) {
  var bob = Math.sin(t * 0.08 + pk.id) * 2;
  AB.glow(c, x + 4, y + 2, 40, '#e0a0ff', 0.7 + Math.sin(t * 0.2) * 0.15);
  c.fillStyle = 'rgba(224,160,255,0.35)'; c.fillRect(x + 3, y - 40 + bob, 2, 38);
  AB.drawIcon(c, 'flask', x - 8, y - 14 + bob, 1.5, '#e0a0ff');
  if ((t >> 3 + pk.id) & 1) { c.fillStyle = '#fff'; c.fillRect(x - 6 + ((t >> 2) % 12), y - 12 + bob + ((t >> 3) % 9), 1, 1); }
};
})();
