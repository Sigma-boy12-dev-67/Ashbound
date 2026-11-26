/* ============================================================
   Ashbound online layer 1: backend, sign-in and cloud saves.
   - Real backend: Firebase (Auth + Realtime Database), loaded lazily from Google's CDN
     the first time online features are used, so the offline game never depends on it.
   - Test backend: AB.net.useMock() (BroadcastChannel between tabs) used by tools/online-test.js.
   Only people signed in with an account (not guests) can save: enforced here AND by database.rules.json.
   ============================================================ */
(function () {
'use strict';
var AB = window.AB;
var FB_VER = '10.12.5';
var N = AB.net = { mode: 'none', ready: false, user: null, db: null, error: '', _cbs: [], _initP: null };

function cfg() { return AB.NETCFG || {}; }
N.configured = function () {
  var c = cfg(), f = c.firebase || {};
  return !!(c.enabled && f.apiKey && f.databaseURL && f.projectId && f.apiKey.indexOf('PASTE') < 0);
};
N.available = function () { return N.mode === 'mock' || N.configured(); };
N.onAuth = function (fn) { N._cbs.push(fn); fn(N.user); };
function fireAuth() { for (var i = 0; i < N._cbs.length; i++) { try { N._cbs[i](N.user); } catch (e) { /* ignore */ } } }
N.canSave = function () { return !!(N.db && N.user && !N.user.guest); };

function loadScript(src) {
  return new Promise(function (res, rej) {
    var s = document.createElement('script'); s.src = src; s.async = false;
    s.onload = res; s.onerror = function () { rej(new Error('Could not load ' + src.split('/').pop() + ' (offline?)')); };
    document.head.appendChild(s);
  });
}
function mkUser(u) {
  if (!u) return null;
  var nm = u.displayName || (u.email ? u.email.split('@')[0] : '');
  if (!nm || u.isAnonymous) nm = 'Guest' + String(u.uid).slice(0, 4).toUpperCase();
  return { uid: u.uid, name: nm.slice(0, 14), guest: !!u.isAnonymous, email: u.email || '' };
}

/* ---------------- Firebase backend ---------------- */
function fbBackend() {
  var root = firebase.database().ref(cfg().root || 'ashbound');
  return {
    set: function (p, v) { return root.child(p).set(v); },
    update: function (p, v) { return root.child(p).update(v); },
    remove: function (p) { return root.child(p).remove(); },
    push: function (p, v) { return root.child(p).push(v); },
    get: function (p) { return root.child(p).once('value').then(function (s) { return s.val(); }); },
    last: function (p, n) { return root.child(p).orderByKey().limitToLast(n).once('value').then(function (s) { var o = []; s.forEach(function (c) { o.push(c.val()); }); return o; }); },
    watch: function (p, cb) { var r = root.child(p), f = r.on('value', function (s) { cb(s.val()); }); return function () { r.off('value', f); }; },
    onDisc: function (p) { root.child(p).onDisconnect().remove(); }
  };
}

N.init = function () {
  if (N._initP) return N._initP;
  if (N.mode === 'mock') { N.ready = true; N._initP = Promise.resolve(); return N._initP; }
  if (!N.configured()) { N._initP = Promise.reject(new Error('Online play is not set up yet (see ONLINE-SETUP.md).')); N._initP.catch(function () { N._initP = null; }); return N._initP; }
  var base = 'https://www.gstatic.com/firebasejs/' + FB_VER + '/firebase-';
  N._initP = loadScript(base + 'app-compat.js').then(function () { return loadScript(base + 'auth-compat.js'); })
    .then(function () { return loadScript(base + 'database-compat.js'); })
    .then(function () {
      if (!firebase.apps.length) firebase.initializeApp(cfg().firebase);
      N.mode = 'firebase'; N.db = fbBackend(); N.ready = true;
      firebase.auth().onAuthStateChanged(function (u) {
        N.user = mkUser(u); fireAuth();
        try { localStorage.setItem('ab_signed', u && !u.isAnonymous ? '1' : ''); } catch (e) { /* ignore */ }
      });
    }).catch(function (e) { N._initP = null; N.error = e.message; throw e; });
  return N._initP;
};
/* called at game start: if the player signed in earlier, silently reconnect so cloud saves keep working */
N.autoInit = function () {
  var was = false; try { was = localStorage.getItem('ab_signed') === '1'; } catch (e) { /* ignore */ }
  if (was && N.configured() && navigator.onLine !== false) N.init().catch(function () { /* offline: fine */ });
};

function errMsg(e) {
  var c = (e && e.code) || '';
  var map = { 'auth/invalid-email': 'That email address looks wrong.', 'auth/user-not-found': 'No account with that email.', 'auth/wrong-password': 'Wrong password.',
    'auth/invalid-credential': 'Wrong email or password.', 'auth/email-already-in-use': 'That email already has an account. Sign in instead.',
    'auth/weak-password': 'Password needs at least 6 characters.', 'auth/popup-closed-by-user': 'Sign-in cancelled.', 'auth/network-request-failed': 'No connection.',
    'auth/operation-not-allowed': 'That sign-in method is not enabled in your Firebase project.', 'auth/unauthorized-domain': 'This website is not on your Firebase authorized-domains list.',
    'auth/too-many-requests': 'Too many tries. Wait a minute.' };
  return map[c] || (e && e.message) || 'Something went wrong.';
}
N.errMsg = errMsg;
N.signInGoogle = function () { return N.init().then(function () { return firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider()); }); };
N.signInEmail = function (em, pw) { return N.init().then(function () { return firebase.auth().signInWithEmailAndPassword(em, pw); }); };
N.signUpEmail = function (em, pw, name) {
  return N.init().then(function () { return firebase.auth().createUserWithEmailAndPassword(em, pw); })
    .then(function (cr) { if (name) return cr.user.updateProfile({ displayName: name.slice(0, 14) }).then(function () { N.user = mkUser(firebase.auth().currentUser); fireAuth(); }); });
};
N.guest = function () {
  return N.init().then(function () { if (N.mode === 'mock') return; return firebase.auth().currentUser ? null : firebase.auth().signInAnonymously(); });
};
N.signOut = function () { if (N.mode === 'mock') { N.user = null; fireAuth(); return Promise.resolve(); } return N.init().then(function () { return firebase.auth().signOut(); }); };
N.myName = function () { return N.user ? N.user.name : 'Guest'; };

/* ---------------- Mock backend (tests only) ---------------- */
N.useMock = function (name, guest) {
  var tree = {}, watchers = [], ch = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('ab-mock-net') : null;
  var uid = 'u' + Math.random().toString(36).slice(2, 8);
  function seg(p) { return p.split('/').filter(Boolean); }
  function getAt(p) { var o = tree, s = seg(p); for (var i = 0; i < s.length; i++) { if (o == null || typeof o !== 'object') return null; o = o[s[i]]; } return o === undefined ? null : o; }
  function putAt(p, v) {
    var s = seg(p), o = tree;
    if (!s.length) { tree = v || {}; return; }
    for (var i = 0; i < s.length - 1; i++) { if (o[s[i]] == null || typeof o[s[i]] !== 'object') o[s[i]] = {}; o = o[s[i]]; }
    if (v === null || v === undefined) delete o[s[s.length - 1]]; else o[s[s.length - 1]] = JSON.parse(JSON.stringify(v));
  }
  function overlap(a, b) { return a.indexOf(b) === 0 || b.indexOf(a) === 0; }
  function notify(p) {
    for (var i = 0; i < watchers.length; i++) {
      var w = watchers[i]; if (!overlap(w.p + '/', p + '/')) continue;
      var v = getAt(w.p), j = JSON.stringify(v); if (j === w.last) continue; w.last = j;
      (function (cb, val) { setTimeout(function () { cb(val === null ? null : JSON.parse(JSON.stringify(val))); }, 0); })(w.cb, v);
    }
  }
  function apply(op) { if (op.t === 'set') putAt(op.p, op.v); else if (op.t === 'rm') putAt(op.p, null); else if (op.t === 'upd') { for (var k in op.v) putAt(op.p + '/' + k, op.v[k]); } notify(op.p); }
  function send(op) { if (ch) ch.postMessage(op); }
  if (ch) ch.onmessage = function (m) {
    var d = m.data;
    if (d.t === 'hello') { ch.postMessage({ t: 'dump', tree: tree }); }
    else if (d.t === 'dump') { if (!Object.keys(tree).length) { tree = d.tree; notify(''); } }
    else if (N.mockLag) setTimeout(function () { apply(d); }, N.mockLag);   // test only: simulated network delay
    else apply(d);
  };
  if (ch) ch.postMessage({ t: 'hello' });
  var disc = [];
  N.mockDisconnect = function () { for (var i = 0; i < disc.length; i++) { var op = { t: 'rm', p: disc[i] }; apply(op); send(op); } disc = []; };
  N.mode = 'mock'; N.ready = true; N._initP = Promise.resolve();
  N.user = { uid: uid, name: name || 'Tester', guest: !!guest, email: '' };
  N.db = {
    set: function (p, v) { var op = { t: 'set', p: p, v: v }; apply(op); send(op); return Promise.resolve(); },
    update: function (p, v) { var op = { t: 'upd', p: p, v: v }; apply(op); send(op); return Promise.resolve(); },
    remove: function (p) { var op = { t: 'rm', p: p }; apply(op); send(op); return Promise.resolve(); },
    push: function (p, v) { var k = Date.now().toString(36) + Math.random().toString(36).slice(2, 5); return N.db.set(p + '/' + k, v); },
    get: function (p) { return Promise.resolve(getAt(p)); },
    last: function (p, n) { var o = getAt(p) || {}, ks = Object.keys(o).sort().slice(-n); return Promise.resolve(ks.map(function (k) { return o[k]; })); },
    watch: function (p, cb) { var w = { p: p, cb: cb, last: JSON.stringify(getAt(p)) }; watchers.push(w); setTimeout(function () { cb(getAt(p)); }, 0); return function () { var i = watchers.indexOf(w); if (i >= 0) watchers.splice(i, 1); }; },
    onDisc: function (p) { disc.push(p); }
  };
  window.addEventListener('beforeunload', N.mockDisconnect);
  setTimeout(fireAuth, 0);
};

/* ---------------- Cloud saves (signed-in accounts only) ---------------- */
var C = AB.cloud = {};
function me() { return 'users/' + N.user.uid; }
/* weapons are stored as ids (+tier, affix, upgrades) so the save stays small and function-free */
function packWeapon(w) { return w ? { id: w.id, tier: w.tier || 0, affix: w.affix ? w.affix.id : null, up: w.upgrades || 0 } : null; }
function unpackWeapon(o) {
  if (!o || !AB.WEAPONS[o.id]) return null;
  var w = AB.makeWeapon(o.id, o.tier || 0, o.affix || undefined);
  for (var i = 0; i < (o.up || 0) && AB.upgradeWeapon; i++) w = AB.upgradeWeapon(w);
  return w;
}
C.packRun = function (run, stage, hp, mode) {
  return { v: 1, ts: Date.now(), mode: mode || 'solo', stage: stage, hp: Math.round(hp), seed: run.seed, stats: run.stats,
    weapons: [packWeapon(run.weapons[0]), packWeapon(run.weapons[1])], skills: run.skills.slice(), flasks: run.flasks, embers: run.embers,
    kills: run.kills, time: run.time, bossKills: run.bossKills, damageTaken: run.damageTaken, boonIds: run.boonIds, gold: run.gold };
};
C.unpackRun = function (cp) {
  var s = cp.stats || AB.newStats();
  return { seed: cp.seed, stats: s, hp: Math.max(1, cp.hp || s.maxHp), weapons: [unpackWeapon(cp.weapons && cp.weapons[0]) || AB.makeWeapon('ashblade', 0), unpackWeapon(cp.weapons && cp.weapons[1])],
    skills: (cp.skills || [null, null]).slice(), flasks: cp.flasks || 1, gold: cp.gold || 0, embers: cp.embers || 0, kills: cp.kills || 0, time: cp.time || 0,
    bossKills: cp.bossKills || 0, damageTaken: cp.damageTaken || 0, boonIds: cp.boonIds || {}, freeOffer: false, turretLife: 480, carPotions: 0, carFound: false };
};
C.saveCheckpoint = function (cp) { if (!N.canSave()) return Promise.resolve(false); return N.db.set(me() + '/checkpoint', JSON.stringify(cp)).then(function () { return true; }, function () { return false; }); };
C.loadCheckpoint = function () {
  if (!N.canSave()) return Promise.resolve(null);
  return N.db.get(me() + '/checkpoint').then(function (s) { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }, function () { return null; });
};
C.clearCheckpoint = function () { if (!N.canSave()) return Promise.resolve(); return N.db.remove(me() + '/checkpoint').catch(function () { /* ignore */ }); };
C.record = function (rec) { if (!N.canSave()) return Promise.resolve(false); rec.ts = Date.now(); return N.db.push(me() + '/history', rec).then(function () { return true; }, function () { return false; }); };
C.history = function (n) { if (!N.canSave()) return Promise.resolve([]); return N.db.last(me() + '/history', n || 12).then(function (a) { return a.reverse(); }, function () { return []; }); };
})();
