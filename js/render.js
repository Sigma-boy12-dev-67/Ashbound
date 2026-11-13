(function () {
'use strict';
var AB = window.AB;
var T = AB.T, TILE = AB.TILE, Level = AB.Level;

function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function shade(hex, f) { return f >= 0 ? AB.mix(hex, '#ffffff', f) : AB.mix(hex, '#000000', -f); }

/* ===================== STATIC TILE LAYER ===================== */
Level.prototype.renderStatic = function () {
  var B = this.biome, W = this.W, H = this.H;
  var cv = this.canvas = mk(W * T, H * T), c = cv.getContext('2d');
  var wallA = AB.mix(B.bg2, '#000000', 0.25), wallB = AB.mix(B.bg2, '#000000', 0.45), x, y;
  var self = this;
  var solid = function (tx, ty) { return self.tileAt(tx, ty) === TILE.SOLID; };

  // back wall bricks (semi-transparent so parallax peeks through)
  c.globalAlpha = 0.86;
  for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
    if (solid(x, y)) continue;
    var n = AB.noise2(x, y);
    c.fillStyle = n > 0.5 ? wallA : wallB;
    c.fillRect(x * T, y * T, T, T);
    c.fillStyle = 'rgba(0,0,0,0.28)';
    c.fillRect(x * T, y * T + 7, T, 1); c.fillRect(x * T, y * T + 15, T, 1);
    var off = (y % 2) ? 4 : 12;
    c.fillRect(x * T + off, y * T, 1, 8); c.fillRect(x * T + ((off + 8) % 16), y * T + 8, 1, 8);
    if (n > 0.93) { c.fillStyle = 'rgba(255,255,255,0.04)'; c.fillRect(x * T + 2, y * T + 2, 5, 4); }
  }
  c.globalAlpha = 1;

  // solid tiles
  for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
    if (!solid(x, y)) continue;
    var px = x * T, py = y * T, h = AB.noise2(x * 1.7, y * 2.3);
    var up = solid(x, y - 1), dn = solid(x, y + 1), lf = solid(x - 1, y), rt = solid(x + 1, y);
    var deep = 0;
    for (var d = 1; d < 4; d++) if (solid(x, y - d)) deep++; else break;
    var base = AB.mix(B.tile, B.tile2, h * 0.7);
    base = shade(base, -0.12 * deep + (h - 0.5) * 0.08);
    c.fillStyle = base; c.fillRect(px, py, T, T);
    // masonry
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.fillRect(px, py + 7, T, 1); c.fillRect(px, py + 15, T, 1);
    var o2 = ((x + y) % 2) ? 5 : 11;
    c.fillRect(px + o2, py, 1, 7); c.fillRect(px + ((o2 + 7) % 16), py + 8, 1, 7);
    c.fillStyle = 'rgba(255,255,255,0.05)';
    c.fillRect(px, py + 8, T, 1); c.fillRect(px, py, T, 1);
    // chips
    if (h > 0.82) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(px + 3 + Math.floor(h * 20) % 8, py + 3, 3, 2); }
    if (B.id === 'foundry' && h < 0.07) { c.fillStyle = B.accent; c.fillRect(px + 4, py + 5, 1, 5); c.fillRect(px + 5, py + 9, 3, 1); }
    if (B.id === 'spire' && h > 0.9) { c.fillStyle = 'rgba(190,240,255,0.35)'; c.fillRect(px + 3, py + 3, 1, 6); c.fillRect(px + 4, py + 3, 3, 1); }
    // edges
    if (!up) {
      c.fillStyle = B.top; c.fillRect(px, py, T, 3);
      c.fillStyle = shade(B.top, 0.28); c.fillRect(px, py, T, 1);
      c.fillStyle = shade(B.top, -0.35); c.fillRect(px, py + 3, T, 1);
      if (!lf) { c.fillStyle = shade(B.top, -0.2); c.fillRect(px, py, 1, 4); }
      if (!rt) { c.fillStyle = shade(B.top, -0.2); c.fillRect(px + T - 1, py, 1, 4); }
      if (B.id === 'crypt' && h > 0.35) { // moss
        c.fillStyle = B.moss; c.fillRect(px, py - 1, T, 2);
        c.fillStyle = shade(B.moss, 0.25); c.fillRect(px + 2, py - 2, 3, 1); c.fillRect(px + 9, py - 2, 4, 1);
        if (h > 0.7) { c.fillStyle = B.moss; c.fillRect(px + 6, py + 4, 2, 3); }
      }
    }
    if (!dn) {
      c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(px, py + T - 3, T, 3);
      c.fillStyle = shade(B.tile, -0.5); c.fillRect(px, py + T - 1, T, 1);
    }
    if (!lf) { c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(px, py, 1, T); c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(px + 1, py, 1, T); }
    if (!rt) { c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(px + T - 1, py, 1, T); }
  }

  // stalactites & hanging chains under ceilings
  for (x = 2; x < W - 2; x++) {
    var cl = this.CL[Math.min(x, this.CL.length - 1)];
    if (cl < 3) continue;
    var hh = AB.noise2(x * 3.1, 9.7);
    if (hh > 0.72) {
      var len = 4 + Math.floor(hh * 22);
      for (var i = 0; i < len; i++) {
        var wd = Math.max(1, Math.round((1 - i / len) * 6));
        c.fillStyle = i < 2 ? shade(B.tile, -0.2) : shade(B.tile2, -0.15 - i * 0.01);
        c.fillRect(x * T + 8 - Math.floor(wd / 2), cl * T + i, wd, 1);
      }
      if (B.id === 'spire') { c.fillStyle = 'rgba(190,240,255,0.5)'; c.fillRect(x * T + 7, cl * T + 1, 1, len - 3); }
    } else if (hh < 0.12) {
      var ch = 20 + Math.floor(hh * 200);
      for (var j = 0; j < ch; j += 3) {
        c.fillStyle = '#5a5a6a'; c.fillRect(x * T + 8, cl * T + j, 2, 2);
        c.fillStyle = '#2a2a38'; c.fillRect(x * T + 8, cl * T + j + 2, 2, 1);
      }
    }
  }

  // one-way platforms
  for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
    if (this.tileAt(x, y) !== TILE.ONEWAY) continue;
    var ox = x * T, oy = y * T;
    var l = this.tileAt(x - 1, y) !== TILE.ONEWAY, r = this.tileAt(x + 1, y) !== TILE.ONEWAY;
    c.fillStyle = '#1a1420'; c.fillRect(ox, oy, T, 6);
    c.fillStyle = shade(B.top, -0.15); c.fillRect(ox + (l ? 1 : 0), oy + 1, T - (l ? 1 : 0) - (r ? 1 : 0), 4);
    c.fillStyle = shade(B.top, 0.25); c.fillRect(ox + (l ? 1 : 0), oy + 1, T - (l ? 1 : 0) - (r ? 1 : 0), 1);
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(ox + 4, oy + 5, 1, 4); c.fillRect(ox + 11, oy + 5, 1, 3);
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(ox, oy + 6, T, 2);
  }

  // spikes
  for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
    if (this.tileAt(x, y) !== TILE.SPIKE) continue;
    var sx = x * T, sy = y * T;
    for (var k = 0; k < 4; k++) {
      var bx = sx + k * 4;
      c.fillStyle = '#2a2430'; c.fillRect(bx, sy + 8, 4, 8);
      c.fillStyle = '#9a98ac'; c.fillRect(bx + 1, sy + 6, 2, 10);
      c.fillStyle = '#d8d6ea'; c.fillRect(bx + 1, sy + 4, 2, 3); c.fillRect(bx + 1, sy + 6, 1, 8);
      c.fillStyle = '#ffffff'; c.fillRect(bx + 1, sy + 3, 1, 2);
    }
  }
  // pit rects for dynamic glow
  this.pitRects = [];
  var run = null;
  for (x = 0; x < this.PIT.length; x++) {
    if (this.PIT[x]) { if (!run) run = { x: x, w: 0, y: this.GY[x] }; run.w++; }
    else if (run) { this.pitRects.push(run); run = null; }
  }
  if (run) this.pitRects.push(run);
};

Level.prototype.drawTiles = function (ctx, cx, cy) {
  var sw = AB.W, sh = AB.H;
  var sx = AB.clamp(cx, 0, this.canvas.width - sw), sy = AB.clamp(cy, 0, this.canvas.height - sh);
  ctx.drawImage(this.canvas, sx, sy, sw, sh, sx - cx, sy - cy, sw, sh);
};

// animated hazards: pit glow / lava, and closed gates
Level.prototype.drawDynamic = function (ctx, cx, cy, t) {
  var B = this.biome, i, pr;
  for (i = 0; i < this.pitRects.length; i++) {
    pr = this.pitRects[i];
    var x0 = pr.x * T - cx, y0 = (pr.y + 1) * T - cy, w = pr.w * T;
    if (x0 > AB.W || x0 + w < 0) continue;
    var col = B.id === 'foundry' ? '#ff5a10' : (B.id === 'spire' ? '#6ae0ff' : '#8a6aff');
    ctx.fillStyle = AB.rgba(col, B.id === 'foundry' ? 0.8 : 0.22);
    if (B.id === 'foundry') {
      ctx.fillRect(x0, y0 + 6, w, T - 4);
      for (var k = 0; k < w; k += 2) {
        var hgt = 3 + Math.sin(t * 0.08 + (k + pr.x * 16) * 0.35) * 2;
        ctx.fillStyle = k % 4 ? '#ffb04a' : '#ff7a20'; ctx.fillRect(x0 + k, y0 + 6 - hgt + 3, 2, hgt);
      }
    } else {
      ctx.fillRect(x0, y0, w, T);
    }
    AB.glow(ctx, x0 + w / 2, y0 + 6, w * 0.6 + 14, col, B.id === 'foundry' ? 0.5 : 0.22);
  }
  var gl = [];
  for (i = 0; i < this.arenas.length; i++) gl = gl.concat(this.arenas[i].gates);
  if (this.boss) gl = gl.concat(this.boss.gates);
  for (i = 0; i < gl.length; i++) {
    var g = gl[i];
    if (this.tileAt(g.x, g.y1) !== TILE.GATE) continue;
    var gx = g.x * T - cx, gy0 = g.y0 * T - cy, gh = (g.y1 - g.y0 + 1) * T;
    if (gx < -20 || gx > AB.W + 4) continue;
    ctx.fillStyle = 'rgba(20,10,30,0.85)'; ctx.fillRect(gx, gy0, T, gh);
    for (var yy = 0; yy < gh; yy += 6) {
      var a = 0.45 + 0.35 * Math.sin(t * 0.15 + yy * 0.3 + g.x);
      ctx.fillStyle = AB.rgba(B.accent, a); ctx.fillRect(gx + 2, gy0 + yy, 12, 2);
    }
    ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.5; ctx.fillRect(gx + 7, gy0, 2, gh); ctx.globalAlpha = 1;
    ctx.fillStyle = B.accent; ctx.fillRect(gx, gy0, 2, gh); ctx.fillRect(gx + 14, gy0, 2, gh);
  }
};

/* ===================== PARALLAX BACKDROPS ===================== */
var backdropCache = {};
AB.getBackdrop = function (biome) {
  if (backdropCache[biome.id]) return backdropCache[biome.id];
  var Wd = 960, Hd = 420, layers = [], rng = AB.makeRng(biome.id.length * 977 + biome.id.charCodeAt(0));
  var rr = function (a, b) { return a + rng() * (b - a); };

  // sky layer, screen-sized
  var sky = mk(AB.W, AB.H), sc = sky.getContext('2d');
  var g = sc.createLinearGradient(0, 0, 0, AB.H);
  g.addColorStop(0, biome.bg1); g.addColorStop(1, biome.bg2);
  sc.fillStyle = g; sc.fillRect(0, 0, AB.W, AB.H);
  var rg = sc.createRadialGradient(AB.W * 0.6, AB.H * 0.55, 10, AB.W * 0.6, AB.H * 0.55, 240);
  rg.addColorStop(0, AB.rgba(biome.fog, 0.4)); rg.addColorStop(1, AB.rgba(biome.fog, 0));
  sc.fillStyle = rg; sc.fillRect(0, 0, AB.W, AB.H);
  for (var s = 0; s < 60; s++) {
    sc.fillStyle = 'rgba(255,255,255,' + rr(0.05, 0.3).toFixed(2) + ')';
    sc.fillRect(Math.floor(rr(0, AB.W)), Math.floor(rr(0, AB.H * 0.7)), 1, 1);
  }
  layers.push({ cv: sky, fx: 0, fy: 0, y: 0, still: true });

  function wrapDraw(c, fn) { fn(0); fn(-Wd); fn(Wd); }
  function layer(color, fx, fy, yBase, shapes, glowCol) {
    var cv = mk(Wd, Hd), c = cv.getContext('2d');
    for (var i = 0; i < shapes; i++) {
      (function (i) {
        var x = rr(0, Wd), w, h, y;
        wrapDraw(c, function (ox) {
          var shapeX = x + ox;
          if (biome.id === 'crypt') {
            w = 40 + (i * 37 % 60); h = 160 + (i * 53 % 160);
            c.fillStyle = color;
            c.fillRect(shapeX, Hd - h, w, h);
            c.fillRect(shapeX - 4, Hd - h, w + 8, 8);
            // arch cutout
            if (i % 3 === 0) {
              c.fillStyle = AB.rgba(biome.fog, 0.25); c.beginPath();
              c.arc(shapeX + w / 2, Hd - h * 0.55, w * 0.28, Math.PI, 0); c.lineTo(shapeX + w / 2 + w * 0.28, Hd - h * 0.25); c.lineTo(shapeX + w / 2 - w * 0.28, Hd - h * 0.25); c.fill();
            }
          } else if (biome.id === 'foundry') {
            w = 36 + (i * 41 % 50); h = 120 + (i * 61 % 220);
            c.fillStyle = color; c.fillRect(shapeX, Hd - h, w, h);
            c.fillRect(shapeX - 5, Hd - h, w + 10, 10);
            if (glowCol) {
              c.fillStyle = AB.rgba(glowCol, 0.55);
              for (var q = 0; q < 4; q++) c.fillRect(shapeX + 6, Hd - h + 24 + q * 22, w - 12, 3);
            }
            if (i % 4 === 0) { c.fillStyle = color; c.fillRect(shapeX + w, Hd - 70, 80, 8); }
          } else {
            w = 14 + (i * 29 % 26); h = 140 + (i * 67 % 260);
            c.fillStyle = color; c.beginPath();
            c.moveTo(shapeX, Hd); c.lineTo(shapeX + w * 0.4, Hd - h); c.lineTo(shapeX + w, Hd); c.fill();
            c.fillStyle = AB.rgba(biome.accent, 0.18);
            c.beginPath(); c.moveTo(shapeX + w * 0.4, Hd - h); c.lineTo(shapeX + w, Hd); c.lineTo(shapeX + w * 0.5, Hd); c.fill();
            if (i % 5 === 0) { c.fillStyle = color; c.fillRect(shapeX - 6, 40 + (i * 13 % 80), 20, 8); }
          }
        });
      })(i);
    }
    var fg = c.createLinearGradient(0, Hd * 0.45, 0, Hd);
    fg.addColorStop(0, AB.rgba(biome.fog, 0)); fg.addColorStop(1, AB.rgba(biome.fog, 0.55));
    c.fillStyle = fg; c.fillRect(0, 0, Wd, Hd);
    layers.push({ cv: cv, fx: fx, fy: fy, y: yBase });
  }
  layer(AB.mix(biome.bg2, biome.fog, 0.35), 0.12, 0.10, 40, 14, null);
  layer(AB.mix(biome.bg1, biome.fog, 0.25), 0.26, 0.20, 70, 11, biome.id === 'foundry' ? biome.accent : null);
  layer(AB.mix(biome.bg1, '#000000', 0.35), 0.45, 0.32, 100, 9, biome.id === 'foundry' ? biome.torch : null);
  backdropCache[biome.id] = { layers: layers };
  return backdropCache[biome.id];
};

AB.drawBackdrop = function (ctx, biome, cx, cy, t) {
  var bd = AB.getBackdrop(biome), i, L;
  for (i = 0; i < bd.layers.length; i++) {
    L = bd.layers[i];
    if (L.still) { ctx.drawImage(L.cv, 0, 0); continue; }
    var x = -((cx * L.fx) % 960); if (x > 0) x -= 960;
    var y = Math.round(L.y - cy * L.fy - 80);
    ctx.drawImage(L.cv, Math.round(x), y);
    ctx.drawImage(L.cv, Math.round(x) + 960, y);
  }
};

/* ===================== TORCHES & PROPS ===================== */
AB.drawTorch = function (ctx, x, y, t, color) {
  ctx.fillStyle = '#1a1420'; ctx.fillRect(x - 2, y + 4, 4, 9); ctx.fillRect(x - 4, y + 2, 8, 3);
  ctx.fillStyle = '#6a5a4a'; ctx.fillRect(x - 1, y + 5, 2, 7); ctx.fillRect(x - 3, y + 3, 6, 1);
  var f = Math.sin(t * 0.3 + x) * 1.2, f2 = Math.sin(t * 0.47 + x * 2) * 1.2;
  ctx.fillStyle = '#ff6a1a'; ctx.fillRect(x - 2, y - 3 + f, 4, 6);
  ctx.fillStyle = color || '#ffb04a'; ctx.fillRect(x - 1, y - 6 + f2, 2, 7);
  ctx.fillStyle = '#fff4c0'; ctx.fillRect(x - 1, y - 2, 2, 3);
};
})();
