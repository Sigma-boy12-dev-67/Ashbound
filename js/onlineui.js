/* ============================================================
   Ashbound online layer 3: screens (online hub, sign-in panel, co-op lobby).
   ============================================================ */
(function () {
'use strict';
var AB = window.AB, S = AB.scenes, N = AB.net, O = AB.online, U = AB.ui, Menu = AB.Menu;

/* ---------- small DOM dialogs (real text boxes work on phones and PCs) ---------- */
function el(tag, css, txt) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (txt) e.textContent = txt; return e; }
var BOX = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(340px,92vw);background:#15101a;border:2px solid #6b5a48;padding:16px;color:#e8dcc8;font:14px monospace;z-index:99999;box-shadow:0 0 0 9999px rgba(6,3,10,.82)';
var INP = 'display:block;width:100%;box-sizing:border-box;margin:6px 0;padding:9px;background:#0b0810;border:1px solid #5a4a40;color:#fff0c8;font:15px monospace;border-radius:0';
var BTN = 'margin:4px 4px 0 0;padding:9px 12px;background:#2a1e22;border:1px solid #ff9a3a;color:#ffd9a0;font:13px monospace;cursor:pointer;border-radius:0';
var dlg = null;
function closeDlg() { if (dlg && dlg.parentNode) dlg.parentNode.removeChild(dlg); dlg = null; AB.dialogOpen = false; }
function openDlg(node) { closeDlg(); dlg = node; AB.dialogOpen = true; document.body.appendChild(node); }

function authPanel(done) {
  var box = el('div', BOX);
  box.appendChild(el('div', 'font-size:18px;color:#ffd9a0;margin-bottom:4px', 'SIGN IN'));
  box.appendChild(el('div', 'color:#9a8f9e;font-size:12px;margin-bottom:8px', 'Signed-in players have unfinished descents saved and recorded. Guests are never saved.'));
  var email = el('input', INP); email.type = 'email'; email.placeholder = 'email'; email.autocomplete = 'email';
  var pw = el('input', INP); pw.type = 'password'; pw.placeholder = 'password (6+ characters)'; pw.autocomplete = 'current-password';
  var nm = el('input', INP); nm.type = 'text'; nm.placeholder = 'display name (new accounts)'; nm.maxLength = 14;
  var msg = el('div', 'min-height:18px;color:#ff8a8a;font-size:12px;margin:6px 0');
  function busy(b) { msg.style.color = '#9ae8ff'; if (b) msg.textContent = 'Please wait...'; }
  function run(p) { busy(true); p.then(function () { closeDlg(); if (done) done(); }, function (e) { msg.style.color = '#ff8a8a'; msg.textContent = N.errMsg(e); }); }
  var bIn = el('button', BTN, 'SIGN IN'), bUp = el('button', BTN, 'CREATE ACCOUNT'), bG = el('button', BTN, 'GOOGLE'), bX = el('button', BTN.replace('#ff9a3a', '#5a4a40'), 'CANCEL');
  bIn.onclick = function () { run(N.signInEmail(email.value.trim(), pw.value)); };
  bUp.onclick = function () { run(N.signUpEmail(email.value.trim(), pw.value, nm.value.trim())); };
  bG.onclick = function () { run(N.signInGoogle()); };
  bX.onclick = closeDlg;
  [email, pw, nm, msg, bIn, bUp, bG, bX].forEach(function (n) { box.appendChild(n); });
  openDlg(box); setTimeout(function () { email.focus(); }, 50);
}
function codePrompt(done) {
  var box = el('div', BOX);
  box.appendChild(el('div', 'font-size:18px;color:#ffd9a0;margin-bottom:8px', 'JOIN A ROOM'));
  var inp = el('input', INP + ';text-transform:uppercase;letter-spacing:6px;font-size:22px;text-align:center'); inp.maxLength = 5; inp.placeholder = 'CODE'; inp.autocapitalize = 'characters';
  var go = el('button', BTN, 'JOIN'), x = el('button', BTN.replace('#ff9a3a', '#5a4a40'), 'CANCEL');
  go.onclick = function () { var c = O.cleanCode(inp.value); if (c.length === 5) { closeDlg(); done(c); } else inp.style.borderColor = '#ff5a5a'; };
  inp.onkeydown = function (e) { if (e.key === 'Enter') go.onclick(); };
  x.onclick = closeDlg;
  box.appendChild(inp); box.appendChild(go); box.appendChild(x);
  openDlg(box); setTimeout(function () { inp.focus(); }, 50);
}
AB.ui.closeDialog = closeDlg;

function fmtAgo(ts) { var d = Math.floor((Date.now() - ts) / 60000); if (d < 1) return 'just now'; if (d < 60) return d + 'm ago'; if (d < 1440) return Math.floor(d / 60) + 'h ago'; return Math.floor(d / 1440) + 'd ago'; }
var RES = { victory: ['VICTORY', '#7affb0'], died: ['DIED', '#ff7a7a'], incomplete: ['SAVED', '#ffd24a'] };

/* ===================== ONLINE HUB ===================== */
S.online = {
  enter: function (game, arg) {
    var self = this; this.game = game; this.busy = ''; this.err = ''; this.hist = []; this.cp = null;
    this.mode = arg && arg.mode === 'pvp' ? 'pvp' : 'coop';
    AB.audio.musicPlay('title');
    function needUser(next) {
      self.busy = 'Connecting...'; self.err = '';
      N.init().then(function () { return N.user ? null : N.guest(); }).then(function () {
        // wait for the auth callback to fill N.user
        var n = 0; (function w() { if (N.user || n++ > 60) { self.busy = ''; if (N.user) next(); else self.err = 'Could not sign in.'; } else setTimeout(w, 100); })();
      }).catch(function (e) { self.busy = ''; self.err = N.errMsg(e); });
    }
    this.needUser = needUser;
    this.menu = new Menu([
      { label: 'CREATE ROOM', act: function () { needUser(function () { game.go('lobby', { create: true, mode: self.mode }); }); } },
      { label: 'JOIN ROOM', act: function () { codePrompt(function (code) { needUser(function () { game.go('lobby', { join: code }); }); }); } },
      { label: function () { return N.user && !N.user.guest ? 'SIGN OUT' : 'SIGN IN / CREATE ACCOUNT'; }, act: function () {
        if (N.user && !N.user.guest) { N.signOut().then(function () { self.refresh(); }); return; }
        self.busy = 'Connecting...'; N.init().then(function () { self.busy = ''; authPanel(function () { self.refresh(); }); }, function (e) { self.busy = ''; self.err = N.errMsg(e); });
      } }
    ]);
    if (N.available()) N.init().then(function () { N.onAuth(function () { self.refresh(); }); }, function (e) { self.err = N.errMsg(e); });
  },
  refresh: function () {
    var self = this;
    if (N.canSave()) {
      AB.cloud.history(5).then(function (h) { self.hist = h; });
      AB.cloud.loadCheckpoint().then(function (cp) { self.cp = cp; });
    } else { this.hist = []; this.cp = null; }
  },
  update: function (I) {
    if (AB.dialogOpen) return;
    if (I.pressed('back') || U.backClicked(this)) { this.game.go('title'); AB.sfx('click'); return; }
    if (!N.available()) return;
    if (!this.busy) this.menu.update(I);
  },
  draw: function (c) {
    var g = this.game, y = 150;
    U.drawBg(c, g, 3, 0.6);
    var pvp = this.mode === 'pvp';
    U.header(c, pvp ? 'PVP CORNER' : 'ONLINE CO-OP', pvp ? 'Fight other players. You pick the teams. No monsters, no coins.' : 'Any number of players descend together. No coins online.');
    if (!N.available()) {
      AB.text(c, 'ONLINE PLAY IS NOT SET UP YET', AB.W / 2, 90, '#ffb070', 1, 'c', true);
      AB.paragraph(c, 'The game owner needs to add a free Firebase project. Steps are in ONLINE-SETUP.md, then fill in js/netconfig.js.', 90, 108, 50, '#9a8f9e', 1, 10);
    } else {
      var u = N.user;
      AB.text(c, u ? (u.guest ? 'PLAYING AS ' + u.name + (pvp ? ' (GUEST)' : ' (GUEST: NOTHING IS SAVED)') : 'SIGNED IN AS ' + u.name + (pvp ? '' : ' (DESCENTS ARE SAVED)')) : 'NOT SIGNED IN (YOU CAN STILL PLAY AS A GUEST)', AB.W / 2, 58, u && !u.guest ? '#7affb0' : '#c8beb0', 1, 'c', true);
      this.menu.drawCentered(c, AB.W / 2, 76, 18, 1, 220);
      if (this.cp && !pvp) AB.text(c, 'Saved descent: stage ' + (this.cp.stage + 1) + ' (choose "Saved" gear in the lobby, or RESUME on the title)', AB.W / 2, 134, '#ffd24a', 1, 'c', true);
      if (pvp) AB.paragraph(c, 'CREATE a room and share the code, or JOIN a friend. In the lobby everyone picks a team: RED, BLUE, GREEN or GOLD (same colour = allies), or SOLO to fight everybody. Nothing is saved from PvP.', 60, 146, 60, '#9a8f9e', 1, 10);
      else if (N.canSave()) {
        AB.text(c, 'YOUR RECENT DESCENTS', 24, y, '#8a7f90', 1, 'l', true);
        if (!this.hist.length) AB.text(c, 'none yet', 24, y + 12, '#6a6078', 1, 'l', true);
        for (var i = 0; i < this.hist.length; i++) {
          var h = this.hist[i], r = RES[h.result] || ['?', '#aaa'];
          AB.text(c, r[0], 24, y + 12 + i * 11, r[1], 1, 'l', true);
          AB.text(c, 'stage ' + h.stage + '/' + h.of + '   ' + AB.fmtTime(h.time) + '   ' + h.kills + ' kills   ' + (h.mode === 'coop' ? h.party + ' players' : 'solo') + '   ' + fmtAgo(h.ts), 90, y + 12 + i * 11, '#c8beb0', 1, 'l', true);
        }
      }
    }
    if (this.busy) AB.text(c, this.busy, AB.W / 2, 250, '#9ae8ff', 1, 'c', true);
    if (this.err) AB.text(c, this.err, AB.W / 2, 238, '#ff7a7a', 1, 'c', true);
    U.backBtn(c, this);
  }
};

/* ===================== LOBBY ===================== */
S.lobby = {
  enter: function (game, arg) {
    var self = this; this.game = game; this.sess = null; this.err = ''; this.busy = 'Opening room...'; this.menu = null; this.cp = null;
    var sv = AB.save.data;
    this.setup = { w0: sv.lastW0 && sv.wUnlock[sv.lastW0] ? sv.lastW0 : 'ashblade', w1: sv.lastW1 && sv.wUnlock[sv.lastW1] && sv.lastW1 !== sv.lastW0 ? sv.lastW1 : 'hunterbow', sk: sv.lastSk && sv.sUnlock[sv.lastSk] ? sv.lastSk : 'firebomb', resume: false };
    this.setup.maxHp = game.makeRun(this.setup).stats.maxHp;
    this.setup.team = 0; this.setup.wins = 3;
    var p = arg && arg.create ? O.create(this.setup, arg.mode) : O.join(arg && arg.join, this.setup);
    p.then(function (sess) {
      self.sess = sess; self.busy = ''; self.pvp = !!sess.pvp;
      if (self.pvp) { self.setup.maxHp = 100; }
      sess.onChange = function () { self.sync(); };
      sess.onStart = function () { if (sess.pvp) game.startPvp(sess); else game.startOnline(sess); };
      self.buildMenu();
      if (N.canSave() && !sess.pvp) AB.cloud.loadCheckpoint().then(function (cp) { self.cp = cp; self.buildMenu(); });
    }, function (e) { self.busy = ''; self.err = N.errMsg(e); });
  },
  cyc: function (list, cur, d, skip) { var i = list.indexOf(cur), n = list.length; for (var k = 0; k < n; k++) { i = (i + d + n) % n; if (!skip || list[i] !== skip) break; } return list[i]; },
  push: function () {
    var s = this.setup, sess = this.sess;
    if (sess.pvp) { s.maxHp = 100; s.resume = false; }
    else if (s.resume && this.cp) { s.maxHp = this.cp.stats.maxHp; }
    else s.maxHp = this.game.makeRun(s).stats.maxHp;
    sess.setup = s;
    var wc = s.resume && this.cp ? this.cp.weapons : null;
    sess.setSelf({ w0: wc ? wc[0].id : s.w0, w1: wc && wc[1] ? wc[1].id : s.w1, sk: s.sk, resume: s.resume ? 1 : 0, maxHp: s.maxHp, team: sess.pvp ? s.team | 0 : 0 });
    var sv = AB.save.data; sv.lastW0 = s.w0; sv.lastW1 = s.w1; sv.lastSk = s.sk; AB.save.write();
  },
  buildMenu: function () {
    var self = this, sv = AB.save.data, s = this.setup, sess = this.sess, G = this.game;
    function owned(order, tbl) { return order.filter(function (id) { return tbl[id]; }); }
    var items = [
      { label: function () { return 'PRIMARY    < ' + AB.WEAPONS[s.w0].name.toUpperCase() + ' >'; }, adj: function (d) { s.w0 = self.cyc(owned(AB.WEAPON_ORDER, sv.wUnlock), s.w0, d, s.w1); AB.sfx('click'); self.push(); } },
      { label: function () { return 'SECONDARY  < ' + AB.WEAPONS[s.w1].name.toUpperCase() + ' >'; }, adj: function (d) { s.w1 = self.cyc(owned(AB.WEAPON_ORDER, sv.wUnlock), s.w1, d, s.w0); AB.sfx('click'); self.push(); } },
      { label: function () { return 'SKILL      < ' + AB.SKILLS[s.sk].name.toUpperCase() + ' >'; }, adj: function (d) { s.sk = self.cyc(owned(AB.SKILL_ORDER, sv.sUnlock), s.sk, d); AB.sfx('click'); self.push(); } }
    ];
    if (sess.pvp) {
      items.push({ label: function () { return 'TEAM       < ' + O.TEAMS[s.team | 0].n + ' >'; }, adj: function (d) { s.team = ((s.team | 0) + d + 5) % 5; AB.sfx('click'); self.err = ''; self.push(); } });
      if (sess.role === 'host') items.push({ label: function () { return 'FIRST TO   < ' + s.wins + ' >'; }, adj: function (d) { s.wins = AB.clamp(s.wins + d, 1, 9); AB.sfx('click'); self.push(); } });
    } else if (this.cp) {
      s.resumeCp = this.cp;
      items.push({ label: function () { return 'GEAR       < ' + (s.resume ? 'SAVED (STAGE ' + (self.cp.stage + 1) + ')' : 'NEW') + ' >'; }, adj: function () { s.resume = !s.resume; AB.sfx('click'); self.push(); } });
    }
    if (sess.role === 'host' && sess.pvp) items.push({ label: 'START MATCH', act: function () {
      if (!sess.canStartPvp()) { AB.sfx('error'); self.err = 'Need two sides: pick different teams (or SOLO) so somebody has an opponent.'; return; }
      AB.sfx('confirm'); self.err = ''; self.push(); sess.start(0); } });
    else if (sess.role === 'host') items.push({ label: 'START DESCENT', act: function () { AB.sfx('confirm'); self.push(); sess.start(s.resume && self.cp ? self.cp.stage : 0); } });
    items.push({ label: 'LEAVE ROOM', act: function () { self.leave(); } });
    var keep = this.menu ? this.menu.sel : 0;
    this.menu = new Menu(items); this.menu.sel = Math.min(keep, items.length - 1);
    this.push();
  },
  sync: function () { if (this.sess && this.sess.error && !this.err) this.err = this.sess.error; },
  leave: function () { if (this.sess) this.sess.leave(); this.sess = null; this.game.go('online', { mode: this.pvp ? 'pvp' : 'coop' }); AB.sfx('click'); },
  update: function (I) {
    if (this.sess && this.sess.started) return;
    if (I.pressed('back') || U.backClicked(this)) { this.leave(); return; }
    if (this.err && !this.sess) return;
    if (this.sess && this.sess.error) { this.err = this.sess.error; this.sess.leave(); this.sess = null; this.game.go('online', { mode: this.pvp ? 'pvp' : 'coop' }); return; }
    if (this.menu) this.menu.update(I);
  },
  draw: function (c) {
    var g = this.game, sess = this.sess;
    U.drawBg(c, g, 4, 0.6);
    U.header(c, sess && sess.pvp ? 'PVP ROOM' : 'CO-OP ROOM', sess ? (sess.pvp ? (sess.role === 'host' ? 'Share the code. Everyone picks a team, then you start the match.' : 'Pick your gear and your team. The host starts the match.') : sess.role === 'host' ? 'You are the host. Share the code, then start whenever you like.' : 'Pick your gear. The host starts the descent.') : '');
    if (sess) {
      AB.text(c, 'ROOM CODE', AB.W - 24, 14, '#8a7f90', 1, 'r', true);
      AB.text(c, sess.code, AB.W - 24, 24, '#9ae8ff', 2, 'r', true);
      this.menu && this.menu.drawCentered(c, AB.W / 2, sess.pvp ? 50 : 58, sess.pvp ? 14 : 17, 1, 250);
      var uid, ids = Object.keys(sess.players), many = ids.length > (sess.pvp ? 3 : 6), y0 = sess.pvp ? 160 : 150, colW = many ? 216 : 0, k = 0;
      AB.text(c, 'PARTY (' + ids.length + ')', 24, y0, '#8a7f90', 1, 'l', true);
      for (k = 0; k < ids.length; k++) {
        uid = ids[k];
        var p = sess.players[uid], isH = sess.meta && sess.meta.host === uid;
        var col = many ? (k % 2) : 0, row = many ? Math.floor(k / 2) : k, x0 = 24 + col * colW, y = y0 + 12 + row * 11;
        if (y > AB.H - 34) { AB.text(c, '+' + (ids.length - k) + ' more', 24, AB.H - 40, '#8a7f90', 1, 'l', true); break; }
        var tm = O.TEAMS[p.team | 0];
        AB.text(c, (isH ? '* ' : '  ') + p.name + (uid === sess.uid ? ' (you)' : ''), x0, y, sess.pvp ? tm.c : '#f0e4d0', 1, 'l', true);
        if (sess.pvp) AB.text(c, tm.n, many ? x0 + 150 : 140, y, tm.c, 1, 'l', true);
        if (!many) AB.text(c, (AB.WEAPONS[p.w0] ? AB.WEAPONS[p.w0].name : '?') + ' / ' + (AB.WEAPONS[p.w1] ? AB.WEAPONS[p.w1].name : '?') + ' / ' + (AB.SKILLS[p.sk] ? AB.SKILLS[p.sk].name : '?'), (sess.pvp ? 190 : 170), y, '#9a8f9e', 1, 'l', true);
        if (isH) AB.text(c, 'HOST', AB.W - 24, y, '#7affb0', 1, 'r', true);
      }
      if (sess.pvp) AB.text(c, 'Same colour = allies. SOLO = fight everybody. Nothing is saved.', AB.W / 2, AB.H - 30, '#9a8f9e', 1, 'c', true);
      else AB.text(c, N.canSave() ? 'Signed in: your descent is saved if it is cut short.' : 'Guest: nothing is saved.', AB.W / 2, AB.H - 30, N.canSave() ? '#7affb0' : '#8a8096', 1, 'c', true);
    }
    if (this.busy) AB.text(c, this.busy, AB.W / 2, 110, '#9ae8ff', 1, 'c', true);
    if (this.err) AB.text(c, this.err, AB.W / 2, 120, '#ff7a7a', 1, 'c', true);
    U.backBtn(c, this);
  }
};

/* ===================== PVP: MATCH OVER ===================== */
S.pvpend = {
  enter: function (game, res) {
    var self = this; this.game = game; this.res = res || {};
    AB.audio.musicPlay('title'); AB.audio.setIntensity(0.2);
    this.menu = new Menu([
      { label: 'PLAY AGAIN', act: function () { game.go('online', { mode: 'pvp' }); AB.sfx('confirm'); } },
      { label: 'TITLE', act: function () { game.go('title'); AB.sfx('click'); } }
    ]);
  },
  update: function (I) { this.menu.update(I); },
  draw: function (c) {
    var r = this.res, g = this.game, i;
    U.drawBg(c, g, 4, 0.6);
    var title = r.abandoned ? 'YOU LEFT THE MATCH' : (r.error ? 'MATCH ENDED' : (r.winner ? (r.won ? 'VICTORY' : 'DEFEAT') : 'MATCH OVER'));
    U.header(c, title, r.error || (r.winner && !r.abandoned ? r.winner + ' win the match' : ''));
    var y = 70;
    AB.text(c, 'FINAL SCORE (ROUND WINS)', AB.W / 2, y, '#8a7f90', 1, 'c', true); y += 14;
    var sides = r.sides || [];
    for (i = 0; i < sides.length && y < 190; i++) {
      var sd = sides[i];
      AB.text(c, sd.label + (sd.label === r.winner ? '   (WINNER)' : ''), AB.W / 2 - 70, y, sd.color, 1, 'l', true);
      AB.text(c, String((r.scores || {})[sd.key] || 0), AB.W / 2 + 70, y, '#f0e4d0', 1, 'r', true); y += 12;
    }
    this.menu.drawCentered(c, AB.W / 2, 200, 20, 2, 140);
  }
};
})();
