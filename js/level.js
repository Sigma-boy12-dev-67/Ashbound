(function () {
'use strict';
var AB = window.AB;
var T = AB.T;
var TILE = AB.TILE = { AIR: 0, SOLID: 1, ONEWAY: 2, SPIKE: 3, GATE: 4 };

function Level(bi, stage, seed) {
  this.bi = bi; this.stage = stage; this.seed = seed;
  this.biome = AB.BIOMES[bi];
  this.build();
}
AB.Level = Level;

Level.prototype.tileAt = function (tx, ty) {
  if (tx < 0 || tx >= this.W || ty < 0) return TILE.SOLID;
  if (ty >= this.H) return TILE.SOLID;
  return this.tiles[ty * this.W + tx];
};
Level.prototype.solidAt = function (tx, ty) {
  var t = this.tileAt(tx, ty);
  return t === TILE.SOLID || t === TILE.GATE;
};
Level.prototype.setTile = function (tx, ty, v) {
  if (tx < 0 || tx >= this.W || ty < 0 || ty >= this.H) return;
  this.tiles[ty * this.W + tx] = v;
};
// y in px of ground surface directly below (x, y) scanning downward; returns y px or null
Level.prototype.groundBelow = function (px, py, maxTiles) {
  var tx = Math.floor(px / T), ty = Math.floor(py / T);
  for (var i = 0; i < (maxTiles || 40); i++) {
    var t = this.tileAt(tx, ty + i);
    if (t === TILE.SOLID || t === TILE.GATE || t === TILE.ONEWAY) return (ty + i) * T;
    if (t === TILE.SPIKE) return null;
  }
  return null;
};
Level.prototype.setGates = function (list, closed) {
  for (var i = 0; i < list.length; i++) {
    var g = list[i];
    for (var y = g.y0; y <= g.y1; y++) {
      if (closed) { if (this.tileAt(g.x, y) === TILE.AIR) this.setTile(g.x, y, TILE.GATE); }
      else if (this.tileAt(g.x, y) === TILE.GATE) this.setTile(g.x, y, TILE.AIR);
    }
  }
};

Level.prototype.build = function () {
  var R = AB.makeRng(this.seed), B = this.biome, stage = this.stage;
  var H = this.H = 40;
  var GY = [], CL = [], PIT = [];
  var clr = 13;
  var plats = [];          // {x0,x1,y} tile coords (one-way)
  var spawnPts = [];       // candidate patrol spawn points
  var npcs = [], arenas = [], chests = [], props = [], torches = [], golds = [];
  var self = this;
  var gy = 30;
  var boss = null;
  var ri = function (a, b) { return AB.ri(R, a, b); };

  function push(n, g, pit, clearance) {
    for (var i = 0; i < n; i++) {
      if (clearance) clr = clearance; else clr = AB.clamp(clr + ri(-1, 1) * (R() < 0.4 ? 1 : 0), 11, 15);
      GY.push(g); CL.push(Math.max(3, g - clr)); PIT.push(pit ? 1 : 0);
    }
  }
  function here() { return GY.length; }
  function torch(x) { torches.push({ x: x * T + 8, y: (gy - 5) * T }); }

  /* ---------- traversal ---------- */
  function travel(len) {
    var end = here() + len;
    while (here() < end) {
      var r = R(), x0 = here();
      if (r < 0.34) {
        var w = ri(5, 10);
        push(w, gy);
        spawnPts.push({ x: (x0 + w / 2) * T, gy: gy, w: w });
        if (R() < 0.5) plats.push({ x0: x0 + 1, x1: x0 + Math.min(w - 2, ri(3, 5)), y: gy - 4 });
      } else if (r < 0.52 && gy > 24) {
        var steps = ri(1, 2);
        for (var s = 0; s < steps; s++) { gy -= ri(1, 2); push(ri(3, 5), gy); }
        spawnPts.push({ x: (here() - 2) * T, gy: gy, w: 4 });
      } else if (r < 0.70 && gy < 31) {
        var st2 = ri(1, 2);
        for (var s2 = 0; s2 < st2; s2++) { gy += ri(1, 2); push(ri(3, 5), gy); }
      } else if (r < 0.88) {
        // spike pit; sometimes with floating stepping stones for wide pits
        var pw = ri(3, 4), wide = R() < 0.35;
        if (wide) pw = ri(5, 7);
        push(pw, gy, true);
        if (wide) { plats.push({ x0: x0 + 1, x1: x0 + 2, y: gy - 1 }); plats.push({ x0: x0 + pw - 3, x1: x0 + pw - 2, y: gy - 1 }); }
        else if (R() < 0.5) plats.push({ x0: x0, x1: x0 + pw - 1, y: gy - 4 });
        golds.push({ x: (x0 + pw / 2) * T, y: (gy - 3) * T });
        push(3, gy);
      } else {
        // raised ledge with gold above flat ground
        var lw = ri(6, 9);
        push(lw, gy);
        plats.push({ x0: x0 + 1, x1: x0 + lw - 2, y: gy - 4 });
        plats.push({ x0: x0 + 2, x1: x0 + 4, y: gy - 8 });
        golds.push({ x: (x0 + 3) * T, y: (gy - 9) * T });
        spawnPts.push({ x: (x0 + lw / 2) * T, gy: gy, w: lw });
      }
      if (R() < 0.3) props.push({ x: (here() - 2) * T, y: gy * T, kind: R() < 0.5 ? 'urn' : 'crate' });
      if (R() < 0.42) torch(here() - 2);
    }
  }

  /* ---------- events ---------- */
  function flat(n, clearance) { var x0 = here(); push(n, gy, false, clearance); return x0; }

  function arena() {
    gy = AB.clamp(gy, 26, 31);
    push(2, gy);
    var x0 = flat(36, 18), x1 = x0 + 35;
    var topRow = Math.max(3, gy - 18);
    plats.push({ x0: x0 + 5, x1: x0 + 9, y: gy - 4 });
    plats.push({ x0: x0 + 26, x1: x0 + 30, y: gy - 4 });
    plats.push({ x0: x0 + 15, x1: x0 + 20, y: gy - 7 });
    var waves = 2 + (stage >= 1 ? 1 : 0);
    arenas.push({
      x0: x0 * T, x1: (x1 + 1) * T, y: gy * T, top: topRow * T, waves: waves, state: 0,
      gates: [{ x: x0 + 1, y0: topRow, y1: gy - 1 }, { x: x1 - 1, y0: topRow, y1: gy - 1 }]
    });
    torch(x0 + 4); torch(x1 - 4); torch(x0 + 18);
    push(2, gy);
  }
  function treasure() {
    gy = AB.clamp(gy, 25, 31);
    var x0 = flat(20, 20);
    plats.push({ x0: x0 + 2, x1: x0 + 5, y: gy - 3 });
    plats.push({ x0: x0 + 8, x1: x0 + 11, y: gy - 6 });
    plats.push({ x0: x0 + 3, x1: x0 + 6, y: gy - 9 });
    plats.push({ x0: x0 + 9, x1: x0 + 15, y: gy - 12 });
    chests.push({ x: (x0 + 12) * T, y: (gy - 12) * T, kind: 'wood' });
    golds.push({ x: (x0 + 4) * T, y: (gy - 4) * T }, { x: (x0 + 9) * T, y: (gy - 7) * T }, { x: (x0 + 5) * T, y: (gy - 10) * T });
    spawnPts.push({ x: (x0 + 14) * T, gy: gy, w: 6 });
    torch(x0 + 1); torch(x0 + 17);
  }
  function npcRoom(kind, w) {
    var x0 = flat(w, 15);
    npcs.push({ kind: kind, x: (x0 + w / 2) * T, y: gy * T });
    torch(x0 + 2); torch(x0 + w - 3);
  }
  function bossRoom() {
    gy = AB.clamp(gy, 27, 31);
    push(3, gy);
    var x0 = flat(46, 20), x1 = x0 + 45;
    var topRow = Math.max(3, gy - 20);
    plats.push({ x0: x0 + 6, x1: x0 + 11, y: gy - 5 });
    plats.push({ x0: x0 + 34, x1: x0 + 39, y: gy - 5 });
    boss = {
      type: B.boss, x0: x0 * T, x1: (x1 + 1) * T, y: gy * T, top: topRow * T, state: 0,
      gates: [{ x: x0 + 1, y0: topRow, y1: gy - 1 }, { x: x1 - 1, y0: topRow, y1: gy - 1 }]
    };
    torch(x0 + 6); torch(x0 + 22); torch(x1 - 6);
    push(3, gy);
  }

  /* ---------- compose the stage ---------- */
  push(16, gy); // safe start
  torch(4); torch(11);
  var startX = 4 * T;
  var nT = 9, tl = Math.max(16, Math.round(B.len / nT));
  travel(tl); arena();
  travel(tl); treasure();
  travel(tl); npcRoom('altar', 12);
  travel(tl); if (B.arenas >= 3) arena(); else travel(tl);
  travel(tl); npcRoom('shop', 16);
  travel(tl); treasure();
  travel(tl); arena();
  travel(Math.round(tl * 0.8)); npcRoom(stage % 2 === 0 ? 'smith' : 'well', 12);
  push(4, gy); npcs.push({ kind: 'well', x: (here() - 2) * T, y: gy * T });
  bossRoom();

  /* ---------- fill tiles ---------- */
  var W = this.W = GY.length + 3;
  this.tiles = new Uint8Array(W * H);
  var x, y;
  for (x = 0; x < W; x++) {
    var g = x < GY.length ? GY[x] : GY[GY.length - 1];
    var c = x < CL.length ? CL[x] : CL[CL.length - 1];
    var pit = x < PIT.length ? PIT[x] : 0;
    var top = pit ? g + 2 : g;
    for (y = top; y < H; y++) this.tiles[y * W + x] = TILE.SOLID;
    for (y = 0; y < c; y++) this.tiles[y * W + x] = TILE.SOLID;
    if (pit) this.tiles[(g + 1) * W + x] = TILE.SPIKE;
    if (x < 2 || x >= W - 2) for (y = 0; y < H; y++) this.tiles[y * W + x] = TILE.SOLID;
  }
  for (var i = 0; i < plats.length; i++) {
    var p = plats[i];
    for (x = p.x0; x <= p.x1; x++) if (x > 1 && x < W - 2 && this.tiles[p.y * W + x] === TILE.AIR) this.tiles[p.y * W + x] = TILE.ONEWAY;
  }
  this.GY = GY; this.CL = CL; this.PIT = PIT;
  this.arenas = arenas; this.boss = boss; this.npcs = npcs; this.chests = chests;
  this.props = props; this.torches = torches; this.golds = golds; this.plats = plats;
  this.start = { x: startX, y: GY[4] * T };

  /* ---------- patrol spawns ---------- */
  var spawns = this.spawns = [];
  var pool = [];
  for (var k in B.pool) for (var n = 0; n < B.pool[k]; n++) pool.push(k);
  var eliteP = 0.07 + 0.05 * stage;
  for (var s = 0; s < spawnPts.length; s++) {
    var sp = spawnPts[s];
    if (sp.x < 22 * T) continue;
    if (R() < 0.25) continue;
    var cnt = R() < 0.35 ? 2 : 1;
    for (var q = 0; q < cnt; q++) {
      var type = AB.rpick(R, pool);
      var fly = type === 'bat';
      spawns.push({
        type: type, x: sp.x + (q - 0.5) * 28 + (R() - 0.5) * 20, y: fly ? sp.gy * T - ri(50, 90) : sp.gy * T,
        elite: R() < eliteP && type !== 'bomber'
      });
    }
  }
  this.px = { w: W * T, h: H * T };
};

/* enemy picks for arena waves (called by world at runtime) */
Level.prototype.waveList = function (wave, nWaves, rng) {
  var B = this.biome, pool = [];
  for (var k in B.pool) for (var n = 0; n < B.pool[k]; n++) pool.push(k);
  var count = 3 + wave + this.stage + (rng() < 0.4 ? 1 : 0);
  var out = [];
  for (var i = 0; i < count; i++) out.push({ type: AB.rpick(rng, pool), elite: wave === nWaves - 1 && i === 0 && this.stage >= 0 && rng() < 0.55 });
  return out;
};
})();
