/* ============================================================================
   Admin menu - password protected cheats for the game owner.
   Open: press ` (backquote) or F9, or tap the top-middle of the screen 5 times quickly.
   Password check uses PBKDF2-SHA256 against the salted hash in js/adminconfig.js (the password itself is never stored).
   Honest limit: this is a browser game, so the code is public. The password keeps casual players out; it is not
   bank-grade security. Use a long password. To remove the admin menu from a store build: NO_ADMIN=1 node tools/build-www.js
   ========================================================================== */
(function () {
'use strict';
var AB = window.AB, CFG = AB.ADMIN || { salt: '', iter: 150000, hash: '' };
AB.cheat = AB.cheat || { god: false, oneHit: false };
AB.adminOpen = false;
var unlocked = false, root = null, fails = 0, lockUntil = 0, msgEl = null;
var subtle = (window.crypto && window.crypto.subtle) || null;

/* ---------- crypto ---------- */
function toHex(buf) { var a = new Uint8Array(buf), s = ''; for (var i = 0; i < a.length; i++) s += ('0' + a[i].toString(16)).slice(-2); return s; }
function fromHex(h) { var a = new Uint8Array(h.length / 2); for (var i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; }
function derive(pw, saltHex, iter) {
  return subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']).then(function (k) {
    return subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations: iter }, k, 256);
  }).then(toHex);
}

/* ---------- tiny DOM helpers ---------- */
function el(tag, props, kids) {
  var e = document.createElement(tag), k;
  for (k in (props || {})) { if (k === 'style') e.style.cssText = props[k]; else if (k === 'text') e.textContent = props[k]; else e[k] = props[k]; }
  (kids || []).forEach(function (c) { e.appendChild(c); });
  return e;
}
function injectCss() {
  if (document.getElementById('ab-admin-css')) return;
  var s = document.createElement('style'); s.id = 'ab-admin-css';
  s.textContent = '#ab-admin{position:fixed;inset:0;z-index:1000;background:rgba(8,4,14,.94);color:#e8d9b8;font:14px/1.4 monospace;overflow:auto;-webkit-overflow-scrolling:touch}' +
    '#ab-admin .box{max-width:560px;margin:0 auto;padding:16px}#ab-admin h2{margin:0 0 4px;color:#ffb04a;letter-spacing:2px}#ab-admin h3{margin:16px 0 6px;color:#9aa;font-size:12px;letter-spacing:2px}' +
    '#ab-admin button,#ab-admin select,#ab-admin input,#ab-admin textarea{font:inherit;color:#e8d9b8;background:#2a2238;border:1px solid #5a4a78;border-radius:6px;padding:10px 12px;margin:3px 3px 3px 0}' +
    '#ab-admin button{cursor:pointer}#ab-admin button:active{background:#4a3a68}#ab-admin button.on{background:#7a2a2a;border-color:#ff6a6a}#ab-admin button.x{background:#3a1a1a}' +
    '#ab-admin input[type=password],#ab-admin input[type=text]{width:100%;box-sizing:border-box}#ab-admin textarea{width:100%;box-sizing:border-box;height:96px}' +
    '#ab-admin .msg{min-height:20px;margin:8px 0;color:#8fffb0}#ab-admin .err{color:#ff7a7a}#ab-admin small{color:#9a90a8}';
  document.head.appendChild(s);
}
function say(t, bad) { if (msgEl) { msgEl.textContent = t; msgEl.className = 'msg' + (bad ? ' err' : ''); } }

/* ---------- open / close ---------- */
function close() {
  if (root && root.parentNode) root.parentNode.removeChild(root);
  root = null; AB.adminOpen = false; msgEl = null;
  if (AB.input && AB.input.clearAll) AB.input.clearAll();
}
function show(view) {
  if (AB.online && AB.online.S && AB.online.S.world) return;   // no cheating in co-op
  injectCss(); if (root && root.parentNode) root.parentNode.removeChild(root);
  root = el('div', { id: 'ab-admin' }); var box = el('div', { className: 'box' }); root.appendChild(box);
  msgEl = el('div', { className: 'msg' });
  view(box); document.body.appendChild(root); AB.adminOpen = true;
  var f = root.querySelector('input,select,button'); if (f && view !== panelView) setTimeout(function () { f.focus(); }, 30);
}
function toggle() {
  if (root) { close(); return; }
  if (!subtle) { alert('Admin needs a secure (https) page.'); return; }
  if (!CFG.hash) show(setupView); else if (!unlocked) show(loginView); else show(panelView);
}

/* ---------- first-time setup: make a hash to paste into js/adminconfig.js ---------- */
function setupView(box) {
  var pw = el('input', { type: 'password', placeholder: 'Choose a long admin password', autocomplete: 'off' }), out = el('textarea', { readOnly: true, style: 'display:none' });
  var go = el('button', { text: 'Create my admin password', onclick: function () {
    if (pw.value.length < 8) { say('Use at least 8 characters (longer is safer).', true); return; }
    var salt = toHex(crypto.getRandomValues(new Uint8Array(16))); say('Working...');
    derive(pw.value, salt, 150000).then(function (h) {
      out.value = "AB.ADMIN = { salt: '" + salt + "', iter: 150000, hash: '" + h + "' };"; out.style.display = 'block'; out.select();
      say('Done. Copy the line below, paste it over the "AB.ADMIN = ..." line in js/adminconfig.js, save, and reload the game.');
    });
  } });
  var copy = el('button', { text: 'Copy', onclick: function () { out.select(); try { navigator.clipboard.writeText(out.value); say('Copied.'); } catch (e) { document.execCommand('copy'); } } });
  box.appendChild(el('h2', { text: 'ADMIN SETUP' }));
  box.appendChild(el('small', { text: 'No admin password is set yet. Create one here; nothing is saved by this screen.' }));
  box.appendChild(el('div', { style: 'margin-top:12px' }, [pw, go])); box.appendChild(msgEl); box.appendChild(out); box.appendChild(copy);
  box.appendChild(el('div', {}, [el('button', { text: 'Close', onclick: close })]));
  pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') go.click(); });
}

/* ---------- login ---------- */
function loginView(box) {
  var pw = el('input', { type: 'password', placeholder: 'Admin password', autocomplete: 'off' });
  var go = el('button', { text: 'Enter', onclick: function () {
    var now = Date.now(); if (now < lockUntil) { say('Too many tries. Wait ' + Math.ceil((lockUntil - now) / 1000) + 's.', true); return; }
    say('Checking...');
    derive(pw.value, CFG.salt, CFG.iter || 150000).then(function (h) {
      if (h === CFG.hash) { unlocked = true; fails = 0; show(panelView); }
      else { fails++; pw.value = ''; if (fails >= 5) { lockUntil = Date.now() + 30000; fails = 0; say('Wrong password. Locked for 30s.', true); } else say('Wrong password.', true); }
    });
  } });
  box.appendChild(el('h2', { text: 'ADMIN' })); box.appendChild(el('div', { style: 'margin-top:12px' }, [pw, go]));
  box.appendChild(msgEl); box.appendChild(el('div', {}, [el('button', { text: 'Close', onclick: close })]));
  pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') go.click(); });
}

/* ---------- the cheats ---------- */
function ctx() { var g = AB.game; return (g && g.run && g.world && g.world.player) ? { g: g, r: g.run, w: g.world, p: g.world.player } : null; }
function needRun(fn) { return function () { var c = ctx(); if (!c) return say('Start a run first (this works during a level).', true); fn(c); }; }
function toast(c, m, icon, col) { try { c.w.toast(m, icon || 'star', col || '#ffd24a'); } catch (e) { /* ignore */ } }
var A = {
  car: function (c) { c.r.carPotions = (c.r.carPotions || 0) + 1; c.r.carFound = true; toast(c, 'Car Potion added', 'flask', '#e0a0ff'); say('Car Potion added. Close this and press C (or tap CAR).'); },
  carNow: function (c) { c.r.carPotions = (c.r.carPotions || 0) + 1; c.r.carFound = true; close(); c.w.startCarPotion(); },
  gold: function (c) { c.r.gold += 9999; c.r.embers += 500; say('+9,999 gold, +500 embers (this run).'); },
  heal: function (c) { c.p.hp = c.r.stats.maxHp; c.r.flasks = Math.max(c.r.stats.flasks, 5); c.p.hp = c.r.stats.maxHp; say('Full health, flasks refilled.'); },
  boons: function (c) { AB.BOONS.forEach(function (b) { AB.applyBoon(c.r, b, c.p); }); c.p.hp = c.r.stats.maxHp; say('All ' + AB.BOONS.length + ' boons applied.'); },
  skip: function (c) { close(); c.g.stageComplete(); },
  weapon: function (c, slot, id, tier) { var w = AB.makeWeapon(id, tier, AB.AFFIXES[Math.floor(Math.random() * AB.AFFIXES.length)].id); c.r.weapons[slot] = w; c.p.atk = null; c.p.guard = 0; say(w.name + ' equipped in slot ' + (slot + 1) + '.'); },
  skill: function (c, slot, id) { c.r.skills[slot] = id; c.p.cd[slot] = 0; say(AB.SKILLS[id].name + ' equipped in skill slot ' + (slot + 1) + '.'); }
};
function meta() {
  var d = AB.save.data;
  return {
    embers: function () { d.embers += 99999; AB.save.write(); say('+99,999 embers in your forge.'); },
    unlock: function () { AB.WEAPON_ORDER.forEach(function (i) { d.wUnlock[i] = 1; }); AB.SKILL_ORDER.forEach(function (i) { d.sUnlock[i] = 1; }); AB.save.write(); say('All weapons and skills unlocked.'); },
    forge: function () { AB.FORGE.forEach(function (f) { d.upg[f.id] = f.max; }); AB.save.write(); say('Every forge upgrade maxed (applies to your next run).'); }
  };
}
function everything() {
  var m = meta(); m.embers(); m.unlock(); m.forge();
  var c = ctx(); if (c) { A.car(c); A.gold(c); A.boons(c); A.heal(c); AB.cheat.god = true; }
  say(c ? 'Everything granted, god mode ON.' : 'Meta stuff granted. Start a run, then press this again for the in-run goodies.');
  if (root) show(panelView);
}

function panelView(box) {
  var M = meta(), keep = msgEl;
  function row(items) { var d = el('div'); items.forEach(function (i) { d.appendChild(i); }); box.appendChild(d); }
  function btn(t, fn, cls) { return el('button', { text: t, className: cls || '', onclick: fn }); }
  function sel(list, fmt) { var s = el('select'); list.forEach(function (x) { s.appendChild(el('option', { value: x, text: fmt(x) })); }); return s; }
  box.appendChild(el('h2', { text: 'ADMIN' })); box.appendChild(el('small', { text: 'Game is paused while this is open.' })); box.appendChild(msgEl);
  row([btn('GIVE ME EVERYTHING', everything)]);
  box.appendChild(el('h3', { text: 'IN THIS RUN' }));
  row([btn('+1 Car Potion', needRun(A.car)), btn('Throw the car NOW', needRun(A.carNow))]);
  row([btn('+9,999 gold  +500 embers', needRun(A.gold)), btn('Full heal + flasks', needRun(A.heal))]);
  row([btn('All boons', needRun(A.boons)), btn('Skip to next stage', needRun(A.skip))]);
  row([btn('God mode: ' + (AB.cheat.god ? 'ON' : 'off'), function () { AB.cheat.god = !AB.cheat.god; show(panelView); }, AB.cheat.god ? 'on' : ''),
       btn('Damage x100: ' + (AB.cheat.oneHit ? 'ON' : 'off'), function () { AB.cheat.oneHit = !AB.cheat.oneHit; show(panelView); }, AB.cheat.oneHit ? 'on' : '')]);
  var ws = sel(AB.WEAPON_ORDER, function (i) { return AB.WEAPONS[i].name; }), ts = sel([4, 3, 2, 1, 0], function (i) { return AB.TIER_NAMES[i]; });
  box.appendChild(el('h3', { text: 'WEAPONS (free, random affix)' }));
  row([ws, ts]); row([btn('Equip slot 1 (J)', needRun(function (c) { A.weapon(c, 0, ws.value, +ts.value); })), btn('Equip slot 2 (K)', needRun(function (c) { A.weapon(c, 1, ws.value, +ts.value); }))]);
  var ss = sel(AB.SKILL_ORDER, function (i) { return AB.SKILLS[i].name; });
  row([ss, btn('Skill slot 1 (U)', needRun(function (c) { A.skill(c, 0, ss.value); })), btn('Skill slot 2 (I)', needRun(function (c) { A.skill(c, 1, ss.value); }))]);
  box.appendChild(el('h3', { text: 'PERMANENT (saved)' }));
  row([btn('+99,999 embers', M.embers), btn('Unlock all weapons + skills', M.unlock), btn('Max forge upgrades', M.forge)]);
  row([btn('Lock admin again', function () { unlocked = false; AB.cheat.god = false; AB.cheat.oneHit = false; close(); }, 'x'), btn('Close', close)]);
  if (keep && keep.textContent) say(keep.textContent);
}

/* ---------- how it opens ---------- */
window.addEventListener('keydown', function (e) {
  if (e.code === 'Backquote' || e.code === 'F9') { e.preventDefault(); toggle(); }
  else if (e.code === 'Escape' && root) { e.preventDefault(); close(); }
}, true);
var taps = [];
window.addEventListener('pointerdown', function (e) {
  if (root) return;
  var w = window.innerWidth, h = window.innerHeight;
  if (e.clientY > h * 0.12 || Math.abs(e.clientX - w / 2) > w * 0.12) { taps.length = 0; return; }
  var n = Date.now(); taps.push(n); taps = taps.filter(function (t) { return n - t < 2500; });
  if (taps.length >= 5) { taps.length = 0; toggle(); }
}, true);
})();
