/* ============================================================
   Ashbound online layer 2: co-op rooms (2-4 players).

   HOW IT WORKS
   - Everybody runs their OWN character locally, so movement and attacks feel instant.
   - The HOST also runs every monster and boss. It sends a snapshot ~10 times a second
     (monsters, enemy projectiles, arena/boss state, everybody's position) and a list of events.
   - Clients send their own character ~15 times a second plus events (hits they landed,
     arrows they fired, "I stepped into the portal").
   - A monster that attacks YOUR character sends you a 'hurt' event, and YOUR screen applies it
     (so blocks, parries and dodge-rolls work as normal).
   - Loot is personal: when a monster dies every player gets their own drops. There are no coins online.
   ============================================================ */
(function () {
'use strict';
var AB = window.AB, N = AB.net, T = AB.T;
var O = AB.online = { S: null, MAXP: 4 };

/* ---------- compact player pack / unpack ---------- */
var PK = ['x', 'y', 'vx', 'vy', 'face', 'state', 'anim', 't', 'rollT', 'rollDir', 'iframes', 'hurtT', 'guard', 'guardSlot', 'parryT', 'drinkT', 'flash', 'buffT', 'landSq', 'deadT', 'hp'];
function r1(v) { return Math.round(v * 10) / 10; }
function packPlayer(p) {
  var a = [], i, v;
  for (i = 0; i < PK.length; i++) { v = p[PK[i]]; a.push(typeof v === 'number' ? r1(v) : v); }
  a.push(p.dead ? 1 : 0, p.s.maxHp);
  a.push(p.atk ? [p.atk.slot, p.atk.t, p.atk.dur, p.atk.combo, p.atk.fired ? 1 : 0] : 0);
  var w = p.run.weapons;
  a.push([w[0] ? w[0].id : 0, w[0] ? w[0].tier : 0, w[1] ? w[1].id : 0, w[1] ? w[1].tier : 0]);
  return a;
}
function mkGhost(S, uid) {
  var info = S.players[uid] || {}, st = AB.newStats(); st.maxHp = info.maxHp || 100;
  var run = { stats: st, hp: st.maxHp, weapons: [AB.makeWeapon(info.w0 || 'ashblade', 0), AB.makeWeapon(info.w1 || 'hunterbow', 0)], skills: [null, null], flasks: 0, gold: 0, embers: 0, kills: 0 };
  var g = new AB.Player(run, 0, 0);
  g.remote = uid; g.name = info.name || 'Player'; g.netIf = 0; g.fresh = true; g.noHurtT = 0;
  return g;
}
function unpackInto(g, a) {
  var i, n = PK.length;
  g.tx = a[0]; g.ty = a[1];
  if (g.fresh) { g.x = a[0]; g.y = a[1]; g.fresh = false; }
  for (i = 2; i < n; i++) g[PK[i]] = a[i];
  g.dead = !!a[n]; g.s.maxHp = a[n + 1] || 100;
  var ws = a[n + 3];
  if (ws && (!g.run.weapons[0] || g.run.weapons[0].id !== ws[0] || g.run.weapons[0].tier !== ws[1])) g.run.weapons[0] = ws[0] ? AB.makeWeapon(ws[0], ws[1]) : null;
  if (ws && (!g.run.weapons[1] || g.run.weapons[1].id !== ws[2] || g.run.weapons[1].tier !== ws[3])) g.run.weapons[1] = ws[2] ? AB.makeWeapon(ws[2], ws[3]) : null;
  var at = a[n + 2];
  g.atk = at ? { slot: at[0], wp: g.run.weapons[at[0]] || g.run.weapons[0], t: at[1], dur: at[2], combo: at[3], fired: !!at[4], hit: [] } : null;
}

/* ---------- enemy / projectile pack ---------- */
function packEnemy(e) {
  var o = { i: e.id, t: e.type, x: r1(e.x), y: r1(e.y), f: e.face, h: Math.round(e.hp), M: e.maxHp, s: e.state, q: e.st, k: e.t };
  if (e.vx) o.vx = r1(e.vx); if (e.vy) o.vy = r1(e.vy);
  if (e.tele) o.tl = 1; if (e.flash) o.fl = e.flash; if (e.hitF) o.hf = e.hitF; if (e.freezeT) o.fz = 1; if (e.burn) o.bn = 1;
  if (e.alpha !== 1) o.al = r1(e.alpha); if (e.spawnT) o.sp = e.spawnT; if (e.invuln) o.iv = e.invuln; if (e.hitDone) o.hd = 1;
  if (e.wing !== undefined) o.wg = r1(e.wing); if (e.ph !== undefined) o.ph = e.ph; if (e.dir) o.dr = e.dir;
  if (e.onGround) o.og = 1; if (e.slow) o.sl = 1; if (e.elite) o.el = e.elite; if (e.boss) o.b = 1;
  if (e.hp < e.maxHp) o.lh = 1;
  if (e.aux) { var n = 0, k; for (k in e.aux) n++; if (n) { try { o.ax = JSON.parse(JSON.stringify(e.aux)); } catch (x) { /* skip */ } } }
  return o;
}

/* ===================== SESSION ===================== */
function Session(role, code) {
  this.role = role; this.code = code; this.uid = N.user.uid; this.name = N.user.name; this.base = 'rooms/' + code;
  this.players = {}; this.meta = null; this.ghosts = {}; this.unsubs = []; this.evOut = []; this.evSeq = 0; this.evSeen = 0;
  this.seq = 0; this.hostSeq = 0; this.cSeq = {}; this.cEv = {}; this.lastP = {}; this.world = null; this.capturing = false;
  this.hostRaw = null; this.cRaw = {}; this.lastHostAt = Date.now(); this.started = false; this.closed = false; this.nextAt = 0; this.wipeT = 0;
  this.error = ''; this.setup = null; this.onStart = null; this.onChange = null; this.bytes = 0; this.snaps = 0;
}
O.Session = Session;

function genCode() { var c = 'ABCDEFGHJKMNPQRSTUVWXYZ', s = ''; for (var i = 0; i < 5; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }
O.cleanCode = function (s) { return String(s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5); };

O.create = function (setup) {
  return N.init().then(function () {
    if (!N.user) throw new Error('Sign in or choose "Play as guest" first.');
    var tries = 0;
    function attempt() {
      var code = genCode();
      return N.db.get('rooms/' + code + '/meta').then(function (m) {
        if (m && tries++ < 6) return attempt();
        var S = new Session('host', code); S.setup = setup;
        var meta = { host: S.uid, hostName: S.name, state: 'lobby', stage: 0, seed: Math.floor(Math.random() * 1e9), created: Date.now(), max: O.MAXP };
        return N.db.set(S.base + '/meta', meta).then(function () {
          N.db.onDisc(S.base);
          return S.enter();
        }).then(function () { O.S = S; return S; });
      });
    }
    return attempt();
  });
};
O.join = function (code, setup) {
  code = O.cleanCode(code);
  if (code.length !== 5) return Promise.reject(new Error('A room code has 5 letters.'));
  return N.init().then(function () {
    if (!N.user) throw new Error('Sign in or choose "Play as guest" first.');
    return N.db.get('rooms/' + code + '/meta');
  }).then(function (m) {
    if (!m) throw new Error('No room with code ' + code + '.');
    if (m.state !== 'lobby') throw new Error('That descent has already begun.');
    return N.db.get('rooms/' + code + '/players').then(function (pl) {
      var n = pl ? Object.keys(pl).length : 0;
      if (n >= (m.max || O.MAXP) && !(pl && pl[N.user.uid])) throw new Error('That room is full.');
      var S = new Session('client', code); S.setup = setup;
      return S.enter().then(function () { O.S = S; return S; });
    });
  });
};

Session.prototype.selfInfo = function () {
  var s = this.setup || {};
  return { name: this.name, w0: s.w0 || 'ashblade', w1: s.w1 || 'hunterbow', sk: s.sk || 'firebomb', resume: s.resume ? 1 : 0, maxHp: s.maxHp || 100, ready: this.role === 'host' ? 1 : 0, joined: Date.now() };
};
Session.prototype.enter = function () {
  var self = this, b = this.base;
  N.db.onDisc(b + '/players/' + this.uid); N.db.onDisc(b + '/c/' + this.uid);
  this.unsubs.push(N.db.watch(b + '/meta', function (m) {
    if (self.closed) return;
    self.meta = m;
    if (!m) { self.hostGone('The host closed the room.'); return; }
    if (m.state === 'playing' && !self.started) { self.started = true; if (self.onStart) self.onStart(self); }
    if (self.onChange) self.onChange();
  }));
  this.unsubs.push(N.db.watch(b + '/players', function (p) {
    if (self.closed) return;
    var old = self.players; self.players = p || {};
    self.syncGhosts(old);
    if (self.onChange) self.onChange();
  }));
  if (this.role === 'host') this.unsubs.push(N.db.watch(b + '/c', function (c) { self.cRaw = c || {}; }));
  else this.unsubs.push(N.db.watch(b + '/h', function (h) { if (h) { self.hostRaw = h; self.lastHostAt = Date.now(); } }));
  return N.db.set(b + '/players/' + this.uid, this.selfInfo());
};
Session.prototype.setSelf = function (fields) {
  for (var k in fields) { if (!this.setup) this.setup = {}; }
  return N.db.update(this.base + '/players/' + this.uid, fields);
};
Session.prototype.count = function () { return Object.keys(this.players).length; };
/* host: begin the descent for everyone */
Session.prototype.start = function (stage) {
  if (this.role !== 'host') return Promise.resolve();
  return N.db.update(this.base + '/meta', { state: 'playing', stage: stage || 0, startedAt: Date.now() });
};
Session.prototype.hostGone = function (msg) {
  if (this.closed) return;
  this.error = msg;
  if (this.world && AB.game && AB.game.world === this.world) { AB.game.finishRun(false, true); } else if (this.onChange) this.onChange();
};
Session.prototype.leave = function () {
  if (this.closed) return; this.closed = true;
  for (var i = 0; i < this.unsubs.length; i++) { try { this.unsubs[i](); } catch (e) { /* ignore */ } }
  this.unsubs = [];
  var b = this.base;
  if (this.role === 'host') N.db.remove(b); else { N.db.remove(b + '/players/' + this.uid); N.db.remove(b + '/c/' + this.uid); }
  if (O.S === this) O.S = null;
};
Session.prototype.syncGhosts = function (old) {
  var uid;
  for (uid in this.players) {
    if (uid === this.uid) continue;
    if (!this.ghosts[uid] && this.world) { this.ghosts[uid] = mkGhost(this, uid); }
    else if (this.ghosts[uid]) { this.ghosts[uid].name = this.players[uid].name || 'Player'; }
  }
  for (uid in this.ghosts) {
    if (!this.players[uid]) {
      if (this.world) this.world.toast((this.ghosts[uid].name || 'A player') + ' left the descent.', 'skull', '#ff8a6a');
      delete this.ghosts[uid]; delete this.lastP[uid];
    }
  }
};

/* ---------- world hooks ---------- */
Session.prototype.attach = function (w) {
  this.world = w; this.nextAt = 0; this.wipeT = 0; this.portalSent = false; this.ghosts = {};
  for (var uid in this.players) if (uid !== this.uid) this.ghosts[uid] = mkGhost(this, uid);
};
Session.prototype.playersOf = function (w) {
  if (this.role !== 'host') return [w.player];
  var a = [w.player];
  for (var uid in this.ghosts) a.push(this.ghosts[uid]);
  return a;
};
Session.prototype.targetFor = function (w, e) { return w.nearestPlayer(e.x + e.w / 2, e.y + e.h / 2); };
Session.prototype.spectateTarget = function (w) {
  for (var uid in this.ghosts) if (!this.ghosts[uid].dead && !this.ghosts[uid].fresh) return this.ghosts[uid];
  return null;
};
Session.prototype.partyList = function () {
  var a = [];
  for (var uid in this.ghosts) { var g = this.ghosts[uid]; a.push({ name: g.name, hp: g.hp, max: g.s.maxHp, dead: g.dead }); }
  return a;
};
Session.prototype.emit = function (ev) {
  ev.i = ++this.evSeq; ev.sg = this.world ? this.world.stage : 0; ev.z = this.world ? this.world.t : 0;
  this.evOut.push(ev);
};
Session.prototype.shareProj = function (w, o) {
  if (o.kind === 'bomb' || o.noHit) return;
  var q = { k: 'pj', u: this.uid, x: r1(o.x), y: r1(o.y), vx: r1(o.vx || 0), vy: r1(o.vy || 0), kd: o.kind || 'orb', w: o.w || 6, h: o.h || 6, l: o.life || 60, g: o.grav || 0 };
  if (o.color) q.c = o.color;
  this.emit(q);
};
Session.prototype.onLocalDeath = function (w) { w.toast('You have fallen. Your party fights on...', 'skull', '#ff6a6a'); this.sendNow = true; };
Session.prototype.requestPortal = function (w) {
  if (this.role === 'host') { if (!this.nextAt) { this.nextAt = w.t + 150; w.toast('The party descends in 3 seconds...', 'portal', '#b08aff'); this.emit({ k: 'toast', m: 'The party descends in 3 seconds...', ic: 'portal', c: '#b08aff' }); } return; }
  if (!this.portalSent) { this.portalSent = true; this.emit({ k: 'portal' }); w.toast('Waiting for the host...', 'portal', '#b08aff'); AB.sfx('portal'); }
};
Session.prototype.hurtRemote = function (w, g, dmg, srcX, o) {
  if (g.dead || g.iframes > 0 || g.netIf > 0) return 'ignored';
  g.netIf = 14;
  this.emit({ k: 'hurt', to: g.remote, d: Math.round(dmg), sx: Math.round(srcX), sp: o.spike ? 1 : 0, ex: o.explosion ? 1 : 0, pr: o.proj ? 1 : 0, st: o.status || 0 });
  return 'hit';
};
Session.prototype.reportHit = function (w, e, dmg, o) {
  var d = Math.max(1, Math.round(dmg)), dir = o.dir || 1;
  if (e.dead) return false;
  e.flash = 5; e.hurtT = 10; e.lastHit = w.t; e.hp = Math.max(1, e.hp - d);
  var col = o.crit ? '#ffe84a' : (o.src === 'dot' ? '#ff9a4a' : '#ffffff');
  if (o.src !== 'dot' || (w.t % 30 === 0)) w.text(e.x + e.w / 2, e.y - 2, d, col, o.crit);
  w.burst(e.x + e.w / 2, e.y + e.h / 2, e.blood || '#b02a3a', o.crit ? 8 : 4, { vx: 2, vy: 2, life: 18, size: 2, dx: dir * 0.8 });
  if (o.src !== 'dot') {
    AB.sfx(o.crit ? 'crit' : 'hit');
    if (o.crit || o.heavy) w.shake(2.5);
    w.burst(e.x + e.w / 2, e.y + e.h / 2, '#fff', 3, { vx: 2.5, vy: 2.5, life: 8, size: 1, g: 0 });
    AB.input.vibrate(o.crit ? 18 : 8);
  }
  if (o.ignite) e.burn = 180;
  if (e.boss) e.hitF = 6;
  this.emit({ k: 'hit', e: e.id, d: d, kb: o.kb || 0, dr: dir, cr: o.crit ? 1 : 0, sn: o.stun || 0, ig: o.ignite ? 1 : 0, fr: o.freeze ? 1 : 0, sr: o.src || 'weapon', hv: o.heavy ? 1 : 0 });
  return true;
};

/* ---------- per-tick ---------- */
function parse(raw) { try { return JSON.parse(raw); } catch (e) { return null; } }
Session.prototype.preTick = function (w) {
  var uid, g;
  if (this.role === 'host') {
    for (uid in this.cRaw) {
      if (uid === this.uid || !this.players[uid]) continue;
      var raw = this.cRaw[uid]; if (!raw || raw === this.cRaw['_' + uid]) continue;
      this.cRaw['_' + uid] = raw;
      var pk = parse(raw); if (!pk || pk.n <= (this.cSeq[uid] || 0)) continue;
      this.cSeq[uid] = pk.n;
      if (!this.ghosts[uid]) this.ghosts[uid] = mkGhost(this, uid);
      if (pk.s === w.stage && pk.p) { this.lastP[uid] = pk.p; unpackInto(this.ghosts[uid], pk.p); }
      if (pk.ev) this.hostEvents(w, uid, pk.ev);
    }
    for (uid in this.ghosts) { g = this.ghosts[uid]; if (g.netIf > 0) g.netIf--; }
  } else if (this.hostRaw && this.hostRaw !== this.lastRaw) {
    this.lastRaw = this.hostRaw;
    var s = parse(this.hostRaw); if (s && s.n > this.hostSeq) this.applySnap(w, s);
  }
  for (uid in this.ghosts) {   // smooth teammates between updates
    g = this.ghosts[uid]; if (g.tx === undefined) continue;
    if (Math.abs(g.tx - g.x) > 160 || Math.abs(g.ty - g.y) > 160) { g.x = g.tx; g.y = g.ty; } else { g.x += (g.tx - g.x) * 0.4; g.y += (g.ty - g.y) * 0.4; }
  }
};
Session.prototype.postTick = function (w) {
  var host = this.role === 'host', now = Date.now();
  if (host) {
    if (w.t % 6 === 0) this.sendSnap(w);
    if (this.nextAt && w.t >= this.nextAt) { this.nextAt = 0; this.advance(w); return; }
    var all = this.playersOf(w), dead = true, i;
    for (i = 0; i < all.length; i++) if (!all[i].dead) dead = false;
    if (dead && this.count() > 0) { if (++this.wipeT > 120) { this.emit({ k: 'wipe' }); this.sendSnap(w); AB.game.finishRun(false); } } else this.wipeT = 0;
  } else {
    if (w.t % 4 === 0 || this.sendNow) { this.sendNow = false; this.sendPacket(w); }
    if (now - this.lastHostAt > 12000 && !this.closed) this.hostGone('Lost connection to the host.');
  }
};
Session.prototype.advance = function (w) {
  if (w.stage >= AB.BIOMES.length - 1) { this.emit({ k: 'win' }); this.sendSnap(w); AB.game.finishRun(true); return; }
  var n = w.stage + 1;
  this.emit({ k: 'stage', n: n }); this.sendSnap(w);
  AB.game.onlineStage(n);
};

/* ---------- host: build + send snapshot ---------- */
Session.prototype.sendSnap = function (w) {
  var all = this.playersOf(w), P = {}, E = [], J = [], i, e, pr, uid;
  P[this.uid] = packPlayer(w.player);
  for (uid in this.ghosts) if (this.lastP[uid]) P[uid] = this.lastP[uid];
  function near(o) {
    for (var k = 0; k < all.length; k++) if (Math.abs(all[k].x - o.x) < 540 && Math.abs(all[k].y - o.y) < 360) return true;
    return false;
  }
  for (i = 0; i < w.enemies.length; i++) { e = w.enemies[i]; if (!e.dead && (e.boss || near(e))) E.push(packEnemy(e)); }
  for (i = 0; i < w.projs.length; i++) {
    pr = w.projs[i];
    if (pr.team === 'e' && !pr.dead && near(pr)) J.push([pr.id, r1(pr.x), r1(pr.y), r1(pr.vx), r1(pr.vy), pr.kind, pr.color || 0, pr.w, pr.h, pr.grav || 0, pr.small ? 1 : 0, pr.life]);
  }
  var A = [], L = w.level;
  for (i = 0; i < L.arenas.length; i++) A.push(L.arenas[i].state);
  var keep = [], cut = w.t - 240;
  for (i = 0; i < this.evOut.length; i++) if (this.evOut[i].z >= cut) keep.push(this.evOut[i]);
  this.evOut = keep;
  var snap = { n: ++this.seq, s: w.stage, P: P, E: E, J: J, A: A, B: L.boss ? L.boss.state : 0, ev: this.evOut };
  var str = JSON.stringify(snap); this.bytes += str.length; this.snaps++;
  N.db.set(this.base + '/h', str);
};
/* ---------- client: send own state ---------- */
Session.prototype.sendPacket = function (w) {
  var keep = [], cut = w.t - 240, i;
  for (i = 0; i < this.evOut.length; i++) if (this.evOut[i].z >= cut) keep.push(this.evOut[i]);
  this.evOut = keep;
  var str = JSON.stringify({ n: ++this.seq, s: w.stage, p: packPlayer(w.player), ev: this.evOut });
  this.bytes += str.length; this.snaps++;
  N.db.set(this.base + '/c/' + this.uid, str);
};

/* ---------- host: events from a client ---------- */
Session.prototype.hostEvents = function (w, uid, evs) {
  var seen = this.cEv[uid] || 0, mx = seen, i, ev, e, g = this.ghosts[uid];
  evs.sort(function (a, b) { return a.i - b.i; });
  for (i = 0; i < evs.length; i++) {
    ev = evs[i]; if (ev.i <= seen) continue; mx = Math.max(mx, ev.i);
    if (ev.sg !== w.stage) continue;
    if (ev.k === 'hit') {
      for (var q = 0; q < w.enemies.length; q++) if (w.enemies[q].id === ev.e) { e = w.enemies[q]; break; }
      if (e && !e.dead) { w.damageEnemy(e, ev.d, { kb: ev.kb, dir: ev.dr, crit: !!ev.cr, stun: ev.sn, ignite: !!ev.ig, freeze: !!ev.fr, src: ev.sr, heavy: !!ev.hv, remote: true }); }
      e = null;
    } else if (ev.k === 'pj') {
      this.visualProj(w, ev); this.emit(ev.k === 'pj' ? { k: 'pj', u: uid, x: ev.x, y: ev.y, vx: ev.vx, vy: ev.vy, kd: ev.kd, w: ev.w, h: ev.h, l: ev.l, g: ev.g, c: ev.c } : ev);
    } else if (ev.k === 'portal') {
      if (!this.nextAt) { this.nextAt = w.t + 150; var m = ((g && g.name) || 'A player') + ' entered the portal. Descending in 3 seconds...'; w.toast(m, 'portal', '#b08aff'); this.emit({ k: 'toast', m: m, ic: 'portal', c: '#b08aff' }); }
    }
  }
  this.cEv[uid] = mx;
};
Session.prototype.visualProj = function (w, ev) {
  var kind = ev.kd === 'bomb' ? 'fire' : ev.kd;
  var p = w.spawnProj({ x: ev.x, y: ev.y, vx: ev.vx, vy: ev.vy, w: ev.w, h: ev.h, life: ev.l, grav: ev.g, kind: kind, color: ev.c, team: 'p', ghost: true, dmg: 0 });
  p.ghost = true;
};

/* ---------- client: apply snapshot ---------- */
Session.prototype.applySnap = function (w, s) {
  this.hostSeq = s.n;
  var evs = s.ev || [], i, ev;
  evs.sort(function (a, b) { return a.i - b.i; });
  var top = this.evSeen;
  for (i = 0; i < evs.length; i++) {
    ev = evs[i]; if (ev.i <= this.evSeen) continue; top = Math.max(top, ev.i);
    this.clientEvent(w, ev);
    if (AB.game.world !== w) { this.evSeen = top; return; }   // the world was replaced (next stage / run over)
  }
  this.evSeen = top;
  if (s.s !== w.stage) return;
  var uid;
  for (uid in s.P) {
    if (uid === this.uid) continue;
    if (!this.ghosts[uid]) this.ghosts[uid] = mkGhost(this, uid);
    unpackInto(this.ghosts[uid], s.P[uid]);
  }
  var L = w.level, k;
  for (k = 0; k < s.A.length && k < L.arenas.length; k++) {
    var a = L.arenas[k];
    if (a.state !== s.A[k]) { var was = a.state; if (s.A[k] === 1 && was === 0) w.arenaOpen(k); else if (s.A[k] === 2) { if (was === 0) w.arenaOpen(k); w.arenaClear(k); } a.state = s.A[k]; }
  }
  if (L.boss && L.boss.state !== s.B) {
    if (s.B === 1 && L.boss.state === 0) w.bossBegin();
    else if (s.B === 2) { if (L.boss.state === 0) w.bossBegin(); w.bossEnd(); }
    L.boss.state = s.B;
  }
  this.applyEnemies(w, s.E); this.applyProjs(w, s.J);
};
Session.prototype.applyEnemies = function (w, E) {
  var map = {}, i, e, o, seen = {};
  for (i = 0; i < w.enemies.length; i++) map[w.enemies[i].id] = w.enemies[i];
  for (i = 0; i < E.length; i++) {
    o = E[i]; seen[o.i] = 1; e = map[o.i];
    if (!e) {
      if (!AB.ENEMY[o.t] && !AB.BOSSES[o.t]) continue;
      e = AB.spawnEnemy(w, o.t, 0, 0, {}); e.id = o.i; e.x = o.x; e.y = o.y; e.net = true;
      e.elite = o.el || null; w.enemyId = Math.max(w.enemyId, o.i);
      if (o.b) w.bossRef = e;
    }
    e.tx = o.x; e.ty = o.y; e.face = o.f;
    if (o.h < e.hp && e.net) e.lastHit = w.t;
    e.hp = o.h; e.maxHp = o.M; e.state = o.s; e.st = o.q; e.t = o.k; e.vx = o.vx || 0; e.vy = o.vy || 0;
    e.tele = !!o.tl; e.flash = o.fl || 0; e.hitF = o.hf || 0; e.freezeT = o.fz ? 5 : 0; e.burn = o.bn ? 5 : 0;
    e.alpha = o.al === undefined ? 1 : o.al; e.spawnT = o.sp || 0; e.invuln = o.iv || 0; e.hitDone = !!o.hd;
    if (o.wg !== undefined) e.wing = o.wg; if (o.ph !== undefined) e.ph = o.ph; e.dir = o.dr || e.dir; e.onGround = !!o.og; e.slow = o.sl ? 5 : 0;
    if (o.ax) e.aux = o.ax;
  }
  for (i = w.enemies.length - 1; i >= 0; i--) { e = w.enemies[i]; if (!seen[e.id] && !e.dead) { e.dead = true; w.enemies.splice(i, 1); } }
};
Session.prototype.applyProjs = function (w, J) {
  var map = {}, i, p, o, seen = {};
  for (i = 0; i < w.projs.length; i++) if (w.projs[i].net) map[w.projs[i].id] = w.projs[i];
  for (i = 0; i < J.length; i++) {
    o = J[i]; seen[o[0]] = 1; p = map[o[0]];
    if (!p) { p = new AB.Proj({ x: o[1], y: o[2], vx: o[3], vy: o[4], kind: o[5], color: o[6] || null, w: o[7], h: o[8], grav: o[9], team: 'e', life: 400 }); p.id = o[0]; p.net = true; p.small = !!o[10]; w.projs.push(p); }
    p.x = o[1]; p.y = o[2]; p.vx = o[3]; p.vy = o[4]; p.life = Math.max(8, o[11] || 8);
  }
  for (i = 0; i < w.projs.length; i++) { p = w.projs[i]; if (p.net && !seen[p.id]) p.dead = true; }
};
/* client: monsters animate on their own between snapshots */
Session.prototype.updateProxies = function (w) {
  for (var i = 0; i < w.enemies.length; i++) {
    var e = w.enemies[i];
    if (e.tx === undefined) continue;
    e.t++; e.st++;
    if (e.flash > 0) e.flash--; if (e.hitF > 0) e.hitF--; if (e.spawnT > 0 && e.spawnT-- === 1) w.burst(e.x + e.w / 2, e.y + e.h / 2, e.pal.glow, 12, { life: 18, size: 2 });
    e.tx += e.vx * 0.8; if (!e.onGround) e.ty += e.vy * 0.5;
    if (Math.abs(e.tx - e.x) > 140 || Math.abs(e.ty - e.y) > 140) { e.x = e.tx; e.y = e.ty; } else { e.x += (e.tx - e.x) * 0.35; e.y += (e.ty - e.y) * 0.35; }
    if (e.aux && e.aux.strikes) for (var k = 0; k < e.aux.strikes.length; k++) e.aux.strikes[k].t++;
  }
};

/* ---------- client: events ---------- */
Session.prototype.clientEvent = function (w, ev) {
  if (ev.k !== 'stage' && ev.k !== 'wipe' && ev.k !== 'win' && ev.sg !== w.stage) return;
  var i;
  switch (ev.k) {
    case 'hurt':
      if (ev.to === this.uid && !w.player.dead) w.hurtPlayer(ev.d, ev.sx, { spike: !!ev.sp, explosion: !!ev.ex, proj: ev.pr ? { vx: 0, vy: 0, hit: [] } : undefined, status: ev.st || undefined });
      break;
    case 'death': {
      var e = null;
      for (i = 0; i < w.enemies.length; i++) if (w.enemies[i].id === ev.id) { e = w.enemies[i]; break; }
      if (e) { e.dead = true; w.enemies.splice(w.enemies.indexOf(e), 1); }
      if (w.bossRef && w.bossRef.id === ev.id) w.bossRef.dead = true;
      w.personalKill({ x: ev.x, y: ev.y, w: ev.w, h: ev.h, boss: !!ev.b, elite: ev.el || null, gold: ev.g, blood: ev.bl }, null);
      break; }
    case 'sfx': AB.sfx(ev.n); break;
    case 'shk': w.shake(ev.a); break;
    case 'toast': w.toast(ev.m, ev.ic, ev.c); break;
    case 'x': w.explode(ev.x, ev.y, ev.r, 0, 'fx', { color: ev.c || undefined }); break;
    case 'pj': if (ev.u !== this.uid) this.visualProj(w, ev); break;
    case 'stage': if (ev.n > w.stage) AB.game.onlineStage(ev.n); break;
    case 'win': AB.game.finishRun(true); break;
    case 'wipe': AB.game.finishRun(false); break;
  }
};

/* ---------- sound / effect forwarding: what the monsters do should be heard by everyone ---------- */
var QUIET = { hit: 1, crit: 1, swing: 1, swingHeavy: 1, coin: 1, pickup: 1, heal: 1, click: 1, parry: 1, block: 1, hurt: 1, die: 1, jump: 1, djump: 1, roll: 1, bow: 1, buy: 1, error: 1, ember: 1, chest: 1, confirm: 1 };
var sfx0 = AB.sfx;
AB.sfx = function (name) {
  sfx0(name);
  var S = O.S;
  if (S && S.capturing && S.role === 'host' && !QUIET[name]) {
    var last = S.lastSfx || {}; S.lastSfx = last;
    if (!last[name] || S.world.t - last[name] > 3) { last[name] = S.world.t; S.emit({ k: 'sfx', n: name }); }
  }
};
var shake0 = AB.World.prototype.shake;
AB.World.prototype.shake = function (a) {
  shake0.call(this, a);
  var S = this.online; if (S && S.capturing && S.role === 'host' && a >= 5) S.emit({ k: 'shk', a: a });
};
var toast0 = AB.World.prototype.toast;
AB.World.prototype.toast = function (m, ic, c) {
  toast0.call(this, m, ic, c);
  var S = this.online; if (S && S.capturing && S.role === 'host') S.emit({ k: 'toast', m: m, ic: ic, c: c });
};

/* ---------- drawing teammates ---------- */
AB.World.prototype.drawGhosts = function (c, cx, cy, t) {
  var S = this.online; if (!S) return;
  for (var uid in S.ghosts) {
    var g = S.ghosts[uid]; if (g.fresh) continue;
    AB.drawPlayer(c, g, cx, cy, t);
    var x = Math.round(g.x + 5 - cx), y = Math.round(g.y - cy);
    AB.text(c, g.name, x, y - 19, g.dead ? '#8a8096' : '#9ae8ff', 1, 'c', true);
    if (!g.dead) AB.bar(c, x - 9, y - 9, 18, 2, Math.max(0, g.hp), g.s.maxHp, '#6ad86a');
  }
};

/* ---------- checkpoints: signed-in players save their descent at the start of every stage ---------- */
AB.cloud.worldStart = function (w) {
  if (!N.canSave()) return;
  AB.cloud.saveCheckpoint(AB.cloud.packRun(w.run, w.stage, w.player.hp, w.online ? 'coop' : 'solo'));
};
})();
