(function () {
'use strict';
var AB = window.AB, T = AB.T;

function keyLabel(action) {
  var d = AB.input.lastDevice;
  var kb = { attack: 'J', secondary: 'K', skill1: 'U', skill2: 'I', interact: 'E', heal: 'H', roll: 'SHIFT', jump: 'SPACE' };
  var pad = { attack: 'X', secondary: 'Y', skill1: 'RB', skill2: 'RT', interact: 'LB', heal: 'LT', roll: 'B', jump: 'A' };
  if (d === 'pad') return pad[action] || '';
  if (d === 'touch') return '';
  return kb[action] || '';
}
AB.keyLabel = keyLabel;

function slot(c, x, y, wp, col, label) {
  c.fillStyle = '#000'; c.fillRect(x - 1, y - 1, 30, 30);
  c.fillStyle = col || '#4a4054'; c.fillRect(x, y, 28, 28);
  c.fillStyle = '#17121c'; c.fillRect(x + 1, y + 1, 26, 26);
  c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(x + 1, y + 1, 26, 1);
  if (label) AB.text(c, label, x + 14, y + 20, '#d8cfc0', 1, 'c', true);
}

AB.drawHUD = function (c, w, game) {
  var p = w.player, s = p.s, run = w.run, i, t = w.t;

  /* ---- vitals ---- */
  AB.panel(c, 6, 6, 128, 58, 'rgba(14,10,18,0.78)', '#5a4a40');
  AB.drawIcon(c, 'heart', 10, 9, 0.75, '#ff6070');
  AB.bar(c, 24, 11, 104, 8, Math.max(0, p.hp), s.maxHp, p.hp / s.maxHp < 0.3 ? '#ff3a3a' : '#d8384a');
  AB.text(c, Math.ceil(Math.max(0, p.hp)) + '/' + s.maxHp, 76, 11, '#fff', 1, 'c', true);
  for (i = 0; i < s.flasks; i++) {
    var have = i < run.flasks;
    c.globalAlpha = have ? 1 : 0.28;
    AB.drawIcon(c, 'flask', 10 + i * 13, 23, 0.8, have ? '#7affb0' : '#556');
  }
  c.globalAlpha = 1;
  if (p.drinkT > 0) AB.bar(c, 10, 38, 70, 2, 32 - p.drinkT, 32, '#7affb0');
  AB.drawIcon(c, 'coin', 10, 40, 0.7, '#ffd24a'); AB.text(c, run.gold, 24, 43, '#ffe08a', 1, 'l', true);
  AB.drawIcon(c, 'ember', 70, 40, 0.7, '#ff9040'); AB.text(c, run.embers, 84, 43, '#ffb070', 1, 'l', true);
  AB.text(c, AB.fmtTime(run.time), 10, 54, '#8a8096', 1, 'l', true);
  AB.text(c, 'STAGE ' + (w.stage + 1) + '/3', 126, 54, '#8a8096', 1, 'r', true);

  /* ---- weapon & skill slots ---- */
  var bx = Math.round(AB.W / 2 - 62), by = AB.H - 36;
  for (i = 0; i < 2; i++) {
    var wp = run.weapons[i], x = bx + i * 32;
    slot(c, x, by, wp, wp ? AB.TIER_COLORS[wp.tier] : null, keyLabel(i ? 'secondary' : 'attack'));
    if (wp) {
      AB.drawIcon(c, wp.icon, x + 6, by + 1, 1, wp.color);
      if (wp.affix) { c.fillStyle = AB.affixById[wp.affix].color; c.fillRect(x + 22, by + 2, 3, 3); }
    }
    if (p.atk && p.atk.slot === i || (p.guard > 0 && p.guardSlot === i)) { c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x + 1, by + 1, 26, 26); }
  }
  for (i = 0; i < 2; i++) {
    var sk = run.skills[i] ? AB.SKILLS[run.skills[i]] : null, sx = bx + 68 + i * 32;
    slot(c, sx, by, null, sk ? sk.color : '#2a2430', keyLabel(i ? 'skill2' : 'skill1'));
    if (sk) {
      var cdv = p.cd[i], mx = (p.cdMax && p.cdMax[i]) || sk.cd;
      c.globalAlpha = cdv > 0 ? 0.4 : 1;
      AB.drawIcon(c, sk.icon, sx + 6, by + 1, 1, sk.color);
      c.globalAlpha = 1;
      if (cdv > 0) {
        c.fillStyle = 'rgba(0,0,0,0.6)'; var hh = Math.round(26 * cdv / mx); c.fillRect(sx + 1, by + 1, 26, hh);
        AB.text(c, Math.ceil(cdv / 60), sx + 14, by + 8, '#fff', 1, 'c', true);
      } else if ((t >> 3 & 1) && p.cd[i] === 0 && p.cdReady !== false) { c.fillStyle = 'rgba(255,255,255,0.04)'; c.fillRect(sx + 1, by + 1, 26, 26); }
    }
  }
  if (p.buffT > 0) { AB.drawIcon(c, 'warcry', bx + 138, by + 6, 1, '#ff5a5a'); AB.text(c, Math.ceil(p.buffT / 60), bx + 146, by + 22, '#ff8a8a', 1, 'c', true); }

  /* ---- progress strip ---- */
  var L = w.level, px = AB.W - 108, py = 12, pw = 96;
  c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(px - 2, py - 3, pw + 4, 9);
  c.fillStyle = '#2a2430'; c.fillRect(px, py, pw, 3);
  var total = L.W * T, mk = function (xx, col, hgt) { c.fillStyle = col; c.fillRect(px + Math.round(xx / total * pw), py - (hgt || 2), 2, 3 + (hgt || 2) * 2 - 2); };
  for (i = 0; i < L.arenas.length; i++) mk((L.arenas[i].x0 + L.arenas[i].x1) / 2, L.arenas[i].state === 2 ? '#5a5a66' : '#ff6a4a');
  for (i = 0; i < L.npcs.length; i++) mk(L.npcs[i].x, L.npcs[i].kind === 'shop' ? '#ffd24a' : (L.npcs[i].kind === 'altar' ? '#c08aff' : '#7affb0'));
  if (L.boss) mk((L.boss.x0 + L.boss.x1) / 2, '#ff2a4a', 3);
  c.fillStyle = '#fff'; c.fillRect(px + Math.round(p.x / total * pw) - 1, py - 2, 3, 7);

  /* ---- boss bar ---- */
  var bo = w.bossRef;
  if (bo && !bo.dead && w.bossArena && w.bossArena.state === 1) {
    var bw = 200, bX = Math.round(AB.W / 2 - bw / 2);
    AB.text(c, bo.def.title, AB.W / 2, 10, '#ffd0c0', 1, 'c', true);
    AB.bar(c, bX, 22, bw, 7, bo.hp, bo.maxHp, '#c8283a', '#2a1014');
    c.fillStyle = 'rgba(255,255,255,0.2)'; c.fillRect(bX + Math.round(bw / 2), 22, 1, 7);
    c.fillStyle = '#7a5a4a'; c.fillRect(bX - 3, 20, 3, 11); c.fillRect(bX + bw, 20, 3, 11);
  }

  /* ---- kill streak ---- */
  if (w.killCombo >= 3) {
    var ca = Math.min(1, w.comboT / 40);
    c.globalAlpha = ca;
    AB.text(c, w.killCombo + ' KILL STREAK', AB.W / 2, bo && !bo.dead ? 36 : 14, '#ffd24a', 1, 'c', true);
    c.globalAlpha = 1;
  }

  /* ---- toasts ---- */
  for (i = 0; i < w.toasts.length; i++) {
    var q = w.toasts[i], a = Math.min(1, (150 - q.t) / 30, q.t / 8 + 0.2);
    c.globalAlpha = Math.max(0, a);
    var tw = AB.measure(q.msg) + 26, ty = 28 + i * 16;
    c.fillStyle = 'rgba(10,6,14,0.72)'; c.fillRect(AB.W - tw - 6, ty, tw, 14);
    c.fillStyle = q.color; c.fillRect(AB.W - tw - 6, ty, 2, 14);
    if (q.icon) AB.drawIcon(c, q.icon, AB.W - tw - 3, ty - 1, 0.9, q.color);
    AB.text(c, q.msg, AB.W - 10, ty + 4, '#ece4d6', 1, 'r', true);
  }
  c.globalAlpha = 1;

  /* ---- interaction prompt ---- */
  var f = w.focus;
  if (f && w.lastCam) {
    var fx = Math.round(f.x + f.w / 2 - w.lastCam.x), fy = Math.round(f.y - w.lastCam.y - 14 + Math.sin(t * 0.12) * 1.5);
    var label = { chest: 'OPEN', altar: 'PRAY', shop: 'TRADE', smith: 'FORGE', well: 'DRINK', portal: 'ENTER PORTAL', pick: 'TAKE' }[f.kind] || 'USE';
    if (f.kind === 'altar' && f.used) label = 'SPENT';
    if (f.kind === 'well' && f.used) label = 'DRY';
    var line2 = null, col2 = '#fff', kl = keyLabel('interact');
    if (f.kind === 'pick') {
      var pk = f.pk;
      if (pk.kind === 'weapon') { line2 = pk.weapon.name + '  DMG ' + pk.weapon.dmg; col2 = AB.TIER_COLORS[pk.weapon.tier]; }
      else { line2 = AB.SKILLS[pk.skill].name; col2 = AB.SKILLS[pk.skill].color; }
    }
    var txt = (kl ? '[' + kl + '] ' : '') + label, ww = Math.max(AB.measure(txt), line2 ? AB.measure(line2) : 0) + 10, hh = line2 ? 24 : 14;
    fx = AB.clamp(fx, ww / 2 + 4, AB.W - ww / 2 - 4);
    c.fillStyle = 'rgba(10,6,14,0.82)'; c.fillRect(fx - ww / 2, fy - hh, ww, hh);
    c.fillStyle = '#7a6650'; c.fillRect(fx - ww / 2, fy - hh, ww, 1); c.fillRect(fx - ww / 2, fy - 1, ww, 1);
    AB.text(c, txt, fx, fy - hh + 4, '#ffe9a8', 1, 'c', true);
    if (line2) AB.text(c, line2, fx, fy - hh + 14, col2, 1, 'c', true);
  }

  /* ---- first-run controls hint ---- */
  if (!AB.save.data.seenTut && w.stage === 0 && w.t < 900 && !w.modal) {
    var hints = AB.input.lastDevice === 'touch' ? ['Left stick moves. JUMP twice for a double jump.', 'ROLL dodges attacks. Swipe-free combat: tap ATK.', 'Open chests and altars with USE.']
      : (AB.input.lastDevice === 'pad' ? ['Stick moves. A jumps (twice in the air). B rolls.', 'X attacks, Y uses your second weapon. RB / RT use skills.', 'LB interacts. LT drinks a flask.']
        : ['A / D move. SPACE jumps (twice in the air). SHIFT rolls.', 'J attacks, K uses your second weapon. U / I cast skills.', 'E interacts. H drinks a flask. DOWN + SPACE drops through platforms.']);
    var ha = Math.min(1, (900 - w.t) / 60, w.t / 30);
    c.globalAlpha = Math.max(0, ha);
    for (i = 0; i < hints.length; i++) AB.text(c, hints[i], AB.W / 2, AB.H - 78 + i * 11, '#d8cfc0', 1, 'c', true);
    c.globalAlpha = 1;
    if (w.t === 899) { AB.save.data.seenTut = true; AB.save.write(); }
  }

  /* ---- banner ---- */
  var b = w.banner;
  if (b) {
    var k = b.t / b.max, al = k < 0.12 ? k / 0.12 : (k > 0.78 ? (1 - k) / 0.22 : 1);
    c.globalAlpha = Math.max(0, Math.min(1, al));
    var by2 = b.small ? 58 : 82, col = b.boss ? '#ff6a5a' : '#f0e0c0';
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, by2 - 10, AB.W, b.small ? 30 : 50);
    var ex = Math.round(AB.W / 2 * (1 - Math.min(1, k * 6)) + 60);
    c.fillStyle = b.boss ? '#ff4a3a' : '#c8a060'; c.fillRect(AB.W / 2 - 100 - ex * 0.2, by2 - 10, 200 + ex * 0.4, 1); c.fillRect(AB.W / 2 - 100 - ex * 0.2, by2 + (b.small ? 19 : 39), 200 + ex * 0.4, 1);
    AB.text(c, b.title, AB.W / 2, by2, col, b.small ? 2 : 3, 'c', true);
    if (b.sub) AB.text(c, b.sub, AB.W / 2, by2 + (b.small ? 18 : 28), '#b8a890', 1, 'c', true);
    c.globalAlpha = 1;
  }
};
})();
