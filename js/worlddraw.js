(function () {
'use strict';
var AB = window.AB, World = AB.World, T = AB.T;
function R(c, col, x, y, w, h) { c.fillStyle = col; c.fillRect(x, y, w, h); }
function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

var lightSprite = null, vig = null, lightCv = null, lightCtx = null;
function initGfx() {
  if (lightSprite) return;
  lightSprite = mk(128, 128);
  var c = lightSprite.getContext('2d'), g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.65)'); g.addColorStop(0.75, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  vig = mk(AB.W, AB.H);
  var v = vig.getContext('2d'), vg = v.createRadialGradient(AB.W / 2, AB.H / 2, AB.H * 0.35, AB.W / 2, AB.H / 2, AB.W * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  v.fillStyle = vg; v.fillRect(0, 0, AB.W, AB.H);
  lightCv = mk(AB.W, AB.H); lightCtx = lightCv.getContext('2d');
}
AB.vignette = function () { initGfx(); return vig; };

/* ---------- interactables ---------- */
function drawChest(c, it, x, y, t) {
  var big = it.big, open = it.used;
  var body = big ? '#6a3a8a' : '#7a4a22', band = big ? '#e8c8ff' : '#8a8aa0', lid = big ? '#8a4ab0' : '#9a5a2a';
  R(c, '#1a1420', x - 1, y + 4, 22, 13);
  R(c, body, x, y + 6, 20, 10); R(c, '#00000033', x, y + 12, 20, 4);
  R(c, band, x + 2, y + 6, 2, 10); R(c, band, x + 16, y + 6, 2, 10); R(c, band, x, y + 9, 20, 1);
  if (!open) {
    R(c, '#1a1420', x - 1, y, 22, 8); R(c, lid, x, y + 1, 20, 6); R(c, band, x + 2, y + 1, 2, 6); R(c, band, x + 16, y + 1, 2, 6);
    R(c, '#ffd24a', x + 8, y + 5, 4, 4); R(c, '#1a1420', x + 9, y + 7, 2, 2);
    AB.glow(c, x + 10, y + 8, 22 + Math.sin(t * 0.1) * 3, big ? '#c08aff' : '#ffd24a', 0.45);
  } else {
    R(c, '#1a1420', x - 1, y - 6, 22, 6); R(c, lid, x, y - 5, 20, 4); R(c, '#2a1a10', x + 1, y + 2, 18, 5);
    AB.glow(c, x + 10, y + 2, 20, '#ffd24a', 0.3);
  }
}
function drawAltar(c, it, x, y, t) {
  var col = it.used ? '#4a4460' : '#b08aff';
  R(c, '#1a1420', x + 3, y + 22, 22, 10); R(c, '#4a4860', x + 4, y + 23, 20, 9); R(c, '#6a6888', x + 4, y + 23, 20, 2);
  R(c, '#1a1420', x + 7, y + 14, 14, 9); R(c, '#5a5878', x + 8, y + 15, 12, 8);
  if (!it.used) {
    var f = Math.sin(t * 0.12) * 2;
    R(c, col, x + 11, y + 4 + f, 6, 11); R(c, '#e8d8ff', x + 12, y + 6 + f, 4, 8); R(c, '#fff', x + 13, y + 8 + f, 2, 4);
    AB.glow(c, x + 14, y + 10, 40 + Math.sin(t * 0.1) * 4, '#b08aff', 0.55);
    if (t % 6 === 0) { /* sparkle handled in world */ }
  } else R(c, '#2a2438', x + 11, y + 12, 6, 3);
}
function drawShop(c, it, x, y, t) {
  // table of wares
  R(c, '#1a1420', x - 14, y + 20, 56, 13); R(c, '#6a4a2a', x - 13, y + 21, 54, 11); R(c, '#8a6a3a', x - 13, y + 21, 54, 2);
  AB.drawIcon(c, 'sword', x - 8, y + 8, 0.8, '#cfd8ff'); AB.drawIcon(c, 'flask', x + 32, y + 8, 0.8, '#7affb0');
  // merchant
  var b = Math.round(Math.sin(t * 0.05) * 1);
  R(c, '#1a1420', x + 6, y + 2 + b, 16, 22); R(c, '#4a2a5a', x + 7, y + 8 + b, 14, 16); R(c, '#6a3a7a', x + 8, y + 9 + b, 4, 12);
  R(c, '#2a1a3a', x + 7, y + 1 + b, 14, 10); R(c, '#0a0810', x + 10, y + 4 + b, 8, 6); R(c, '#ffd24a', x + 11, y + 6 + b, 2, 1); R(c, '#ffd24a', x + 15, y + 6 + b, 2, 1);
  // lantern
  R(c, '#1a1420', x + 22, y + 12 + b, 6, 8); R(c, '#ffb04a', x + 23, y + 13 + b, 4, 6);
  AB.glow(c, x + 25, y + 16, 34, '#ffb04a', 0.5);
  R(c, '#ffd24a', x + 11, y - 8 + b + Math.round(Math.sin(t * 0.1) * 1), 6, 6); R(c, '#a87818', x + 12, y - 7 + b, 4, 4);
}
function drawSmith(c, it, x, y, t) {
  R(c, '#1a1420', x + 2, y + 22, 24, 10); R(c, '#3a3a4a', x + 3, y + 23, 22, 9);
  R(c, '#1a1420', x + 5, y + 14, 18, 9); R(c, '#6a6a7a', x + 6, y + 15, 16, 4); R(c, '#4a4a5a', x + 8, y + 19, 12, 4);
  R(c, '#1a1420', x + 20, y + 12, 8, 4); R(c, '#6a6a7a', x + 21, y + 13, 7, 2);
  R(c, '#1a1420', x - 14, y + 16, 14, 16); R(c, '#3a2a28', x - 13, y + 17, 12, 15);
  R(c, '#ff6a1a', x - 11, y + 22, 8, 7); R(c, '#ffb04a', x - 9, y + 24, 4, 4);
  AB.glow(c, x - 7, y + 24, 44 + Math.sin(t * 0.2) * 4, '#ff8a2a', 0.6);
  AB.drawIcon(c, 'hammer', x + 8, y - 4 + Math.round(Math.sin(t * 0.08) * 1), 0.9, '#aab');
}
function drawWell(c, it, x, y, t) {
  var col = it.used ? '#3a4a44' : '#7affb0';
  R(c, '#1a1420', x + 2, y + 14, 24, 18); R(c, '#5a5878', x + 3, y + 15, 22, 17); R(c, '#7a7898', x + 3, y + 15, 22, 2);
  R(c, '#0a0810', x + 6, y + 15, 16, 4); R(c, col, x + 7, y + 16, 14, 2);
  R(c, '#1a1420', x + 3, y + 2, 3, 14); R(c, '#1a1420', x + 22, y + 2, 3, 14); R(c, '#1a1420', x + 1, y, 26, 4); R(c, '#6a4a2a', x + 2, y + 1, 24, 2);
  if (!it.used) AB.glow(c, x + 14, y + 14, 36 + Math.sin(t * 0.1) * 3, '#7affb0', 0.5);
}
function drawPortal(c, it, x, y, t) {
  var cx = x + 16, cy = y + 22;
  AB.glow(c, cx, cy, 70, '#b08aff', 0.7);
  for (var i = 0; i < 4; i++) {
    var a = t * 0.05 + i * 1.57, rr = 16 - i * 3;
    c.strokeStyle = i % 2 ? '#d8c0ff' : '#8a5af0'; c.lineWidth = 3 - i * 0.5;
    c.beginPath(); c.ellipse(cx, cy, rr * 0.7 + Math.sin(a) * 1.5, rr * 1.4, 0, 0, 6.283); c.stroke();
  }
  R(c, '#fff', cx - 1, cy - 4 + Math.sin(t * 0.1) * 3, 2, 8);
}
World.prototype.drawInter = function (c, cx, cy, t) {
  for (var i = 0; i < this.inter.length; i++) {
    var it = this.inter[i];
    if (it.hidden) continue;
    var x = Math.round(it.x - cx), y = Math.round(it.y - cy);
    if (x < -70 || x > AB.W + 70 || y < -70 || y > AB.H + 70) continue;
    switch (it.kind) {
      case 'chest': drawChest(c, it, x, y, t); break;
      case 'altar': drawAltar(c, it, x, y, t); break;
      case 'shop': drawShop(c, it, x, y, t); break;
      case 'smith': drawSmith(c, it, x, y, t); break;
      case 'well': drawWell(c, it, x, y, t); break;
      case 'portal': drawPortal(c, it, x, y, t); break;
    }
  }
};

World.prototype.drawProps = function (c, cx, cy) {
  for (var i = 0; i < this.props.length; i++) {
    var p = this.props[i], x = Math.round(p.x - cx), y = Math.round(p.y - cy);
    if (x < -20 || x > AB.W + 20) continue;
    if (p.kind === 'urn') {
      R(c, '#1a1420', x + 1, y + 1, 10, 13); R(c, '#8a5a4a', x + 2, y + 3, 8, 10); R(c, '#aa7a6a', x + 3, y + 4, 2, 7);
      R(c, '#1a1420', x + 3, y, 6, 3); R(c, '#6a3a2a', x + 3, y + 7, 6, 1);
    } else {
      R(c, '#1a1420', x, y + 1, 12, 13); R(c, '#8a6a3a', x + 1, y + 2, 10, 11); R(c, '#5a3a1a', x + 1, y + 6, 10, 1); R(c, '#5a3a1a', x + 5, y + 2, 1, 11);
      R(c, '#aa8a5a', x + 1, y + 2, 10, 1);
    }
  }
};

World.prototype.drawPickups = function (c, cx, cy, t) {
  for (var i = 0; i < this.pickups.length; i++) {
    var pk = this.pickups[i], x = Math.round(pk.x - cx), y = Math.round(pk.y - cy);
    if (x < -20 || x > AB.W + 20 || y < -20 || y > AB.H + 20) continue;
    if (pk.kind === 'gold') {
      var w = Math.abs(Math.sin((t + pk.id * 7) * 0.12)) * 4 + 1;
      R(c, '#7a5a10', x + 4 - w / 2 - 1, y + 1, w + 2, 7); R(c, '#e8b830', x + 4 - w / 2, y + 2, w, 5); R(c, '#fff0a0', x + 4 - w / 2, y + 2, Math.max(1, w / 3), 3);
    } else if (pk.kind === 'ember') {
      var f = Math.sin((t + pk.id * 5) * 0.2);
      R(c, '#ff6a1a', x + 2, y + 1 + f, 4, 6); R(c, '#ffb04a', x + 3, y + 2 + f, 2, 4); R(c, '#fff', x + 3, y + 3 + f, 1, 2);
      AB.glow(c, x + 4, y + 4, 12, '#ff8a2a', 0.6);
    } else if (pk.kind === 'heart') {
      AB.drawIcon(c, 'heart', x - 4, y - 4 + Math.round(Math.sin(t * 0.1 + pk.id) * 1.5), 1, '#ff5a6a');
      AB.glow(c, x + 4, y + 4, 22, '#ff5a6a', 0.5);
    } else if (pk.kind === 'weapon') {
      var wp = pk.weapon, bob = Math.sin(t * 0.08 + pk.id) * 2;
      var tc = AB.TIER_COLORS[wp.tier];
      AB.glow(c, x + 4, y + 2, 28, tc, 0.6);
      R(c, AB.rgba(tc, 0.35), x + 3, y - 36 + bob, 2, 34);
      AB.drawIcon(c, wp.icon, x - 4, y - 10 + bob, 1, wp.color);
    } else if (pk.kind === 'skill') {
      var sk = AB.SKILLS[pk.skill], b2 = Math.sin(t * 0.08 + pk.id) * 2;
      AB.glow(c, x + 4, y + 2, 28, sk.color, 0.6);
      AB.drawIcon(c, sk.icon, x - 4, y - 10 + b2, 1, sk.color);
    }
  }
};

World.prototype.drawFx = function (c, cx, cy, t) {
  var i, q;
  // projectiles
  for (i = 0; i < this.projs.length; i++) this.projs[i].draw(c, cx, cy, t);
  // bolts
  for (i = 0; i < this.bolts.length; i++) {
    var b = this.bolts[i], pts = b.pts;
    c.globalAlpha = b.t / 12;
    for (var pass = 0; pass < 2; pass++) {
      c.strokeStyle = pass ? '#ffffff' : '#ffe84a'; c.lineWidth = pass ? 1 : 3;
      c.beginPath(); c.moveTo(pts[0].x - cx, pts[0].y - cy);
      for (var k = 1; k < pts.length; k++) {
        var ax = pts[k - 1].x, ay = pts[k - 1].y, bx = pts[k].x, by = pts[k].y;
        for (var s = 1; s <= 5; s++) {
          var f = s / 5, jx = s < 5 ? (Math.random() - 0.5) * 10 : 0, jy = s < 5 ? (Math.random() - 0.5) * 10 : 0;
          c.lineTo(ax + (bx - ax) * f + jx - cx, ay + (by - ay) * f + jy - cy);
        }
      }
      c.stroke();
    }
    c.globalAlpha = 1;
    for (var m = 0; m < pts.length; m++) AB.glow(c, pts[m].x - cx, pts[m].y - cy, 22, '#ffe84a', 0.7 * b.t / 12);
  }
  // rings
  for (i = 0; i < this.rings.length; i++) {
    var r = this.rings[i], f2 = r.t / r.max, e = 1 - (1 - f2) * (1 - f2);
    c.globalAlpha = (1 - f2) * 0.9; c.strokeStyle = r.color; c.lineWidth = 3 * (1 - f2) + 1;
    c.beginPath(); c.arc(r.x - cx, r.y - cy, r.r * e, 0, 6.283); c.stroke();
    c.globalAlpha = (1 - f2) * 0.25; c.fillStyle = r.color; c.fill(); c.globalAlpha = 1;
  }
  // particles
  for (i = 0; i < this.particles.length; i++) {
    q = this.particles[i];
    var al = Math.min(1, q.life / (q.max * 0.6)), sz = Math.max(1, Math.round(q.size * (0.4 + 0.6 * al)));
    var px = Math.round(q.x - cx), py = Math.round(q.y - cy);
    if (px < -8 || px > AB.W + 8 || py < -8 || py > AB.H + 8) continue;
    if (q.glow) { c.globalAlpha = al; c.globalCompositeOperation = 'lighter'; }
    else c.globalAlpha = al;
    c.fillStyle = q.color; c.fillRect(px, py, sz, sz);
    if (q.glow) c.globalCompositeOperation = 'source-over';
  }
  c.globalAlpha = 1;
};

/* ---------- lighting ---------- */
World.prototype.drawLighting = function (c, cx, cy, t) {
  initGfx();
  var B = this.biome, L = this.level, lc = lightCtx, i;
  lc.globalCompositeOperation = 'source-over'; lc.globalAlpha = 1;
  lc.clearRect(0, 0, AB.W, AB.H);
  lc.fillStyle = AB.rgba(AB.mix(B.bg1, '#000000', 0.55), B.ambient + 0.18);
  lc.fillRect(0, 0, AB.W, AB.H);
  lc.globalCompositeOperation = 'destination-out';
  var lit = function (x, y, r, a) {
    if (x < -r || x > AB.W + r || y < -r || y > AB.H + r) return;
    lc.globalAlpha = a; lc.drawImage(lightSprite, x - r, y - r, r * 2, r * 2);
  };
  var p = this.player;
  if (!p.dead) lit(p.x + 5 - cx, p.y + 10 - cy, 120, 0.95);
  for (i = 0; i < L.torches.length; i++) {
    var tr = L.torches[i];
    lit(tr.x - cx, tr.y - cy, 120 + Math.sin(t * 0.2 + tr.x) * 6, 0.9);
  }
  for (i = 0; i < this.projs.length; i++) lit(this.projs[i].x - cx, this.projs[i].y - cy, 46, 0.8);
  for (i = 0; i < this.enemies.length; i++) {
    var e = this.enemies[i];
    var el = e.boss ? 140 : (e.elite ? 56 : (e.burn > 0 ? 50 : 34));
    lit(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy, el, e.boss ? 0.85 : 0.6);
  }
  for (i = 0; i < this.pickups.length; i++) { var pk = this.pickups[i]; lit(pk.x - cx, pk.y - cy, pk.kind === 'weapon' || pk.kind === 'skill' ? 50 : 22, 0.7); }
  for (i = 0; i < this.inter.length; i++) {
    var it = this.inter[i]; if (it.hidden) continue;
    lit(it.x + it.w / 2 - cx, it.y + it.h / 2 - cy, it.kind === 'portal' ? 130 : (it.kind === 'chest' ? 56 : 86), 0.9);
  }
  for (i = 0; i < this.allies.length; i++) lit(this.allies[i].x - cx, this.allies[i].y - 9 - cy, 60, 0.8);
  for (i = 0; i < this.rings.length; i++) lit(this.rings[i].x - cx, this.rings[i].y - cy, this.rings[i].r * 1.6, 0.9 * (1 - this.rings[i].t / this.rings[i].max));
  for (i = 0; i < L.pitRects.length; i++) { var pr = L.pitRects[i]; lit(pr.x * T + pr.w * 8 - cx, (pr.y + 1) * T - cy, pr.w * 12 + 20, B.id === 'foundry' ? 0.9 : 0.35); }
  for (i = 0; i < this.particles.length; i += 3) { var q = this.particles[i]; if (q.glow) lit(q.x - cx, q.y - cy, 20, 0.6); }
  lc.globalAlpha = 1; lc.globalCompositeOperation = 'source-over';
  c.drawImage(lightCv, 0, 0);
  // warm additive tint on torches
  for (i = 0; i < L.torches.length; i++) {
    var tt = L.torches[i], x = tt.x - cx, y = tt.y - cy;
    if (x < -90 || x > AB.W + 90) continue;
    AB.glow(c, x, y, 70 + Math.sin(t * 0.25 + tt.x) * 5, B.torch, 0.28);
  }
};

World.prototype.drawAsh = function (c, t) {
  var B = this.biome;
  c.fillStyle = B.ash;
  for (var i = 0; i < this.ash.length; i++) {
    var a = this.ash[i]; c.globalAlpha = 0.25 + a.z * 0.45;
    c.fillRect(Math.round(a.x), Math.round(a.y), a.z > 0.8 ? 2 : 1, a.z > 0.8 ? 2 : 1);
  }
  c.globalAlpha = 1;
};

/* ---------- main draw ---------- */
World.prototype.draw = function (c) {
  initGfx();
  var cam = this.camPos(), cx = cam.x, cy = cam.y, t = this.t, L = this.level, B = this.biome, i;
  AB.drawBackdrop(c, B, cx, cy, t);
  L.drawTiles(c, cx, cy);
  for (i = 0; i < L.torches.length; i++) {
    var tr = L.torches[i], x = tr.x - cx, y = tr.y - cy;
    if (x > -10 && x < AB.W + 10) AB.drawTorch(c, Math.round(x), Math.round(y), t, B.torch);
  }
  L.drawDynamic(c, cx, cy, t);
  this.drawProps(c, cx, cy);
  this.drawInter(c, cx, cy, t);
  this.drawPickups(c, cx, cy, t);
  for (i = 0; i < this.allies.length; i++) this.allies[i].draw(c, cx, cy, t);
  for (i = 0; i < this.enemies.length; i++) AB.drawEnemy(this.enemies[i], c, cx, cy, t);
  AB.drawPlayer(c, this.player, cx, cy, t);
  this.drawFx(c, cx, cy, t);
  this.drawLighting(c, cx, cy, t);
  this.drawAsh(c, t);
  c.drawImage(vig, 0, 0);
  // low health pulse
  var p = this.player, hpf = p.hp / p.s.maxHp;
  if (hpf < 0.3 && !p.dead) {
    c.globalAlpha = (0.3 - hpf) * (0.8 + Math.sin(t * 0.15) * 0.4);
    c.fillStyle = '#ff1a2a'; c.fillRect(0, 0, AB.W, 6); c.fillRect(0, AB.H - 6, AB.W, 6); c.fillRect(0, 0, 6, AB.H); c.fillRect(AB.W - 6, 0, 6, AB.H);
    c.globalAlpha = 1;
  }
  // damage numbers
  for (i = 0; i < this.texts.length; i++) {
    var q = this.texts[i];
    c.globalAlpha = Math.min(1, q.life / (q.max * 0.5));
    AB.text(c, q.str, Math.round(q.x - cx), Math.round(q.y - cy), q.color, q.big ? 2 : 1, 'c', true);
  }
  c.globalAlpha = 1;
  if (this.flashA > 0) { c.globalAlpha = this.flashA; c.fillStyle = this.flashC; c.fillRect(0, 0, AB.W, AB.H); c.globalAlpha = 1; }
  this.lastCam = cam;
};
})();
