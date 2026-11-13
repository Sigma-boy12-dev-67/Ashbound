(function () {
'use strict';
var AB = window.AB;
var RC = ['', '#c8c8d0', '#6ab0ff', '#c070ff'], RN = ['', 'COMMON', 'RARE', 'LEGENDARY'];

function weaponLines(wp) {
  var L = [];
  if (wp.type === 'shield') { L.push('Block + parry'); L.push('Counter DMG ' + wp.dmg); }
  else {
    L.push('DMG ' + wp.dmg + (wp.type === 'melee' ? '' : '  RANGED'));
    if (wp.rate) L.push('Speed ' + (60 / wp.rate).toFixed(1) + '/s');
  }
  var f = [];
  if (wp.crit) f.push('Crit +' + Math.round(wp.crit * 100) + '%');
  if (wp.ignite) f.push('Ignite ' + Math.round(wp.ignite * 100) + '%');
  if (wp.freeze) f.push('Freeze ' + Math.round(wp.freeze * 100) + '%');
  if (wp.shock) f.push('Shock ' + Math.round(wp.shock * 100) + '%');
  if (wp.leech) f.push('Leech ' + wp.leech);
  if (wp.backstab) f.push('Backstab x' + wp.backstab);
  if (wp.thrust) f.push('Long reach');
  if (wp.cleave) f.push('Wide arc');
  if (wp.slam) f.push('Shockwave');
  if (wp.stun) f.push('Stuns');
  if (wp.pierce) f.push('Pierces');
  for (var i = 0; i < f.length; i += 2) L.push(f.slice(i, i + 2).join('  '));
  return L;
}
AB.weaponLines = weaponLines;

function nameColor(wp) { return AB.TIER_COLORS[wp.tier]; }

function hit(m, I) {
  var P = AB.input.pointer, i, r;
  if (!m.rects) return -1;
  if (P.moved || P.clicked) {
    for (i = 0; i < m.rects.length; i++) { r = m.rects[i]; if (P.x >= r.x && P.x < r.x + r.w && P.y >= r.y && P.y < r.y + r.h) return i; }
  }
  return -1;
}
function closeHit(m) {
  var P = AB.input.pointer, r = m.closeRect;
  return AB.input.pointer.clicked && r && P.x >= r.x && P.x < r.x + r.w && P.y >= r.y && P.y < r.y + r.h;
}

AB.Modal = {
  close: function (w) { w.modal = null; },
  update: function (w, I) {
    var m = w.modal, run = w.run, p = w.player, n, h;
    m.t++;
    if (m.t < 8) return;
    var back = I.pressed('back') || I.pressed('pause') || closeHit(m);
    if (m.type === 'altar') {
      n = m.it.offers.length;
      if (I.pressed('left')) { m.sel = (m.sel + n - 1) % n; AB.sfx('click'); }
      if (I.pressed('right')) { m.sel = (m.sel + 1) % n; AB.sfx('click'); }
      h = hit(m); if (h >= 0) { if (m.sel !== h) AB.sfx('click'); m.sel = h; }
      if (I.pressed('confirm') || (h >= 0 && AB.input.pointer.clicked)) {
        var b = m.it.offers[m.sel];
        AB.applyBoon(run, b, p);
        AB.sfx('pickup'); AB.sfx('altar');
        w.ring(p.x + 5, p.y + 11, 50, b.color); w.burst(p.x + 5, p.y + 8, b.color, 20, { vx: 2.5, vy: 2.5, life: 30, size: 2, glow: true });
        w.toast(b.name + ' gained', b.icon, b.color);
        if (!m.it.free) m.it.used = true;
        w.modal = null;
      } else if (back && !m.it.free) { w.modal = null; }
    } else if (m.type === 'shop') {
      var st = m.it.stock; n = st.length;
      if (I.pressed('up')) { m.sel = (m.sel + n - 1) % n; AB.sfx('click'); }
      if (I.pressed('down')) { m.sel = (m.sel + 1) % n; AB.sfx('click'); }
      h = hit(m); if (h >= 0) { if (m.sel !== h) AB.sfx('click'); m.sel = h; }
      if (I.pressed('confirm') || (h >= 0 && AB.input.pointer.clicked)) AB.Modal.buy(w, m, st[m.sel]);
      else if (back) w.modal = null;
    } else if (m.type === 'smith') {
      n = 2;
      if (I.pressed('up') || I.pressed('down')) { m.sel = 1 - m.sel; AB.sfx('click'); }
      h = hit(m); if (h >= 0) { if (m.sel !== h) AB.sfx('click'); m.sel = h; }
      if (I.pressed('confirm') || (h >= 0 && AB.input.pointer.clicked)) {
        var wp = run.weapons[m.sel];
        if (!wp) AB.sfx('error');
        else if (wp.tier >= 4) { AB.sfx('error'); m.msg = 'Already at its peak'; }
        else {
          var cost = AB.Modal.smithCost(wp);
          if (run.gold < cost) { AB.sfx('error'); m.msg = 'Not enough gold'; }
          else {
            run.gold -= cost; run.weapons[m.sel] = AB.upgradeWeapon(wp);
            AB.sfx('buy'); AB.sfx('slam'); w.shake(3); w.burst(p.x + 5, p.y + 8, '#ffb04a', 14, { vx: 2.5, vy: 2.5, life: 24, size: 2, glow: true });
            m.msg = 'Tempered to ' + AB.TIER_NAMES[wp.tier + 1];
          }
        }
      } else if (back) w.modal = null;
    } else if (m.type === 'swap') {
      if (I.pressed('left') || I.pressed('right')) { m.sel = 1 - m.sel; AB.sfx('click'); }
      h = hit(m); if (h >= 0) { if (m.sel !== h) AB.sfx('click'); m.sel = h; }
      if (I.pressed('confirm') || (h >= 0 && AB.input.pointer.clicked)) AB.Modal.doSwap(w, m);
      else if (back) {
        if (m.pk.fromShop) AB.Modal.dropPk(w, m.pk);
        w.modal = null;
      }
    }
  },
  smithCost: function (wp) { return 70 + 60 * wp.tier; },
  dropPk: function (w, pk) {
    var p = w.player;
    w.pickups.push(w.mkPickup(pk.kind, p.x + 5, p.y, 1, { vy: -3, weapon: pk.weapon, skill: pk.skill }));
  },
  doSwap: function (w, m) {
    var run = w.run, p = w.player, pk = m.pk, i = m.sel;
    if (pk.kind === 'weapon') {
      var old = run.weapons[i]; run.weapons[i] = pk.weapon;
      if (old) w.pickups.push(w.mkPickup('weapon', p.x + 5, p.y - 4, 1, { vy: -3, vx: -p.face, weapon: old }));
      w.toast('Equipped ' + pk.weapon.name, pk.weapon.icon, pk.weapon.color);
    } else {
      var os = run.skills[i]; run.skills[i] = pk.skill; p.cd[i] = 0;
      if (os) w.pickups.push(w.mkPickup('skill', p.x + 5, p.y - 4, 1, { vy: -3, vx: -p.face, skill: os }));
      w.toast('Learned ' + AB.SKILLS[pk.skill].name, AB.SKILLS[pk.skill].icon, AB.SKILLS[pk.skill].color);
    }
    if (!pk.fromShop) w.removePickup(pk);
    AB.sfx('pickup'); w.modal = null;
  },
  buy: function (w, m, item) {
    var run = w.run, p = w.player, s = p.s;
    if (item.sold) { AB.sfx('error'); m.msg = 'Sold out'; return; }
    if (run.gold < item.price) { AB.sfx('error'); m.msg = 'Not enough gold'; return; }
    var ok = true;
    switch (item.kind) {
      case 'weapon':
        run.gold -= item.price; item.sold = true; AB.sfx('buy');
        w.modal = { type: 'swap', pk: { kind: 'weapon', weapon: item.weapon, fromShop: true }, sel: 0, t: 0 }; return;
      case 'skill':
        run.gold -= item.price; item.sold = true; AB.sfx('buy');
        if (!run.skills[0] || !run.skills[1]) {
          var slotI = run.skills[0] ? 1 : 0; run.skills[slotI] = item.skill;
          w.toast('Learned ' + AB.SKILLS[item.skill].name, AB.SKILLS[item.skill].icon, AB.SKILLS[item.skill].color); m.msg = 'Learned!';
        } else { w.modal = { type: 'swap', pk: { kind: 'skill', skill: item.skill, fromShop: true }, sel: 0, t: 0 }; }
        return;
      case 'boon':
        run.gold -= item.price; item.sold = true; AB.sfx('buy'); AB.applyBoon(run, item.boon, p);
        w.toast(item.boon.name + ' gained', item.boon.icon, item.boon.color); m.msg = 'Purchased'; return;
      case 'heal':
        if (p.hp >= s.maxHp) { AB.sfx('error'); m.msg = 'You are unharmed'; ok = false; break; }
        run.gold -= item.price; item.sold = true; p.heal(w, Math.round(s.maxHp * 0.5)); AB.sfx('buy'); AB.sfx('heal'); m.msg = 'Restored'; return;
      case 'flask':
        if (run.flasks >= s.flasks) { AB.sfx('error'); m.msg = 'Flasks are full'; ok = false; break; }
        run.gold -= item.price; item.sold = true; run.flasks++; AB.sfx('buy'); m.msg = 'Flask refilled'; return;
    }
  },

  draw: function (c, w) {
    var m = w.modal, run = w.run, i, x, y;
    c.fillStyle = 'rgba(6,3,10,0.72)'; c.fillRect(0, 0, AB.W, AB.H);
    m.rects = [];
    var fade = Math.min(1, m.t / 8);
    c.globalAlpha = fade;
    // close button
    m.closeRect = null;
    var canClose = !(m.type === 'altar' && m.it.free);
    if (canClose) {
      m.closeRect = { x: AB.W - 28, y: 8, w: 20, h: 16 };
      AB.panel(c, AB.W - 28, 8, 20, 16, '#2a1418', '#8a4a4a'); AB.text(c, 'X', AB.W - 18, 12, '#ffb0a0', 1, 'c', true);
    }
    AB.text(c, 'GOLD', AB.W - 70, 14, '#8a8096', 1, 'r', true);
    if (m.type === 'altar' || m.type === 'shop' || m.type === 'smith') {
      AB.drawIcon(c, 'coin', AB.W - 66, 11, 0.7, '#ffd24a'); AB.text(c, run.gold, AB.W - 34, 14, '#ffe08a', 1, 'r', true);
    }
    var hint = AB.input.lastDevice === 'touch' ? 'TAP TO CHOOSE' : 'ARROWS select   ' + (AB.input.lastDevice === 'pad' ? 'A' : 'ENTER') + ' confirm   ' + (canClose ? (AB.input.lastDevice === 'pad' ? 'B' : 'ESC') + ' leave' : '');
    AB.text(c, hint, AB.W / 2, AB.H - 14, '#7a7088', 1, 'c', true);

    if (m.type === 'altar') {
      AB.text(c, m.it.free ? 'A BLESSING OF EMBERS' : 'THE ALTAR OFFERS', AB.W / 2, 22, '#f0dcb0', 2, 'c', true);
      AB.text(c, 'Choose one boon to carry on your descent', AB.W / 2, 42, '#9a8e80', 1, 'c', true);
      var n = m.it.offers.length, cw = 130, gap = 14, x0 = Math.round(AB.W / 2 - (n * cw + (n - 1) * gap) / 2);
      for (i = 0; i < n; i++) {
        var b = m.it.offers[i], sel = i === m.sel, cx = x0 + i * (cw + gap), cy = 62 - (sel ? 4 : 0);
        m.rects.push({ x: cx, y: cy, w: cw, h: 150 });
        AB.panel(c, cx, cy, cw, 150, sel ? '#241a2c' : '#15101a', sel ? RC[b.rarity] : '#4a4054');
        if (sel) AB.glow(c, cx + cw / 2, cy + 50, 60, b.color, 0.35);
        AB.drawIcon(c, b.icon, cx + cw / 2 - 24, cy + 14, 3, b.color);
        AB.text(c, RN[b.rarity], cx + cw / 2, cy + 68, RC[b.rarity], 1, 'c', true);
        AB.paragraph(c, b.name, cx + cw / 2, cy + 82, 20, '#f0e4d0', 1, 10, 'c');
        AB.paragraph(c, b.desc, cx + cw / 2, cy + 98, 20, '#b0a698', 1, 10, 'c');
        var own = run.boonIds && run.boonIds[b.id];
        if (own) AB.text(c, 'OWNED x' + own, cx + cw / 2, cy + 136, '#7a7088', 1, 'c', true);
      }
    } else if (m.type === 'shop') {
      AB.text(c, 'THE WANDERING MERCHANT', AB.W / 2, 20, '#f0dcb0', 2, 'c', true);
      var st = m.it.stock, lx = 30, rw = 200;
      for (i = 0; i < st.length; i++) {
        var it = st[i], sel2 = i === m.sel, ry = 52 + i * 34;
        m.rects.push({ x: lx, y: ry, w: rw, h: 30 });
        AB.panel(c, lx, ry, rw, 30, sel2 ? '#2a2030' : '#15101a', sel2 ? '#e8c880' : '#4a4054');
        var nm, ic, col;
        if (it.kind === 'weapon') { nm = it.weapon.name; ic = it.weapon.icon; col = it.weapon.color; }
        else if (it.kind === 'skill') { nm = AB.SKILLS[it.skill].name; ic = AB.SKILLS[it.skill].icon; col = AB.SKILLS[it.skill].color; }
        else if (it.kind === 'boon') { nm = it.boon.name; ic = it.boon.icon; col = it.boon.color; }
        else if (it.kind === 'heal') { nm = 'Healing Draught'; ic = 'heart'; col = '#ff6070'; }
        else { nm = 'Flask Refill'; ic = 'flask'; col = '#7affb0'; }
        c.globalAlpha = fade * (it.sold ? 0.35 : 1);
        AB.drawIcon(c, ic, lx + 6, ry + 7, 1, col);
        AB.text(c, nm, lx + 28, ry + 7, it.kind === 'weapon' ? nameColor(it.weapon) : '#f0e4d0', 1, 'l', true);
        AB.text(c, it.kind.toUpperCase(), lx + 28, ry + 17, '#7a7088', 1, 'l', true);
        AB.drawIcon(c, 'coin', lx + rw - 46, ry + 8, 0.7, '#ffd24a');
        AB.text(c, it.sold ? 'SOLD' : it.price, lx + rw - 8, ry + 11, it.sold ? '#8a8096' : (run.gold >= it.price ? '#ffe08a' : '#ff6a6a'), 1, 'r', true);
        c.globalAlpha = fade;
      }
      var cur = st[m.sel], dx = 250, dw = 200;
      AB.panel(c, dx, 52, dw, 166, '#15101a', '#6b5a48');
      if (cur.kind === 'weapon') {
        var wp = cur.weapon;
        AB.drawIcon(c, wp.icon, dx + 10, 62, 2, wp.color);
        AB.paragraph(c, wp.name, dx + 50, 62, 20, nameColor(wp), 1, 10);
        AB.text(c, AB.TIER_NAMES[wp.tier].toUpperCase(), dx + 50, 82, nameColor(wp), 1, 'l', true);
        var ls = weaponLines(wp);
        for (i = 0; i < ls.length; i++) AB.text(c, ls[i], dx + 12, 104 + i * 11, '#d8cfc0', 1, 'l', true);
        if (wp.affix) { var af = AB.affixById[wp.affix]; AB.text(c, af.name.toUpperCase() + ': ' + af.desc, dx + 12, 104 + ls.length * 11 + 6, af.color, 1, 'l', true); }
        AB.paragraph(c, wp.desc, dx + 12, 160, 30, '#8a8096', 1, 10);
      } else if (cur.kind === 'skill') {
        var sk = AB.SKILLS[cur.skill];
        AB.drawIcon(c, sk.icon, dx + 10, 62, 2, sk.color); AB.text(c, sk.name, dx + 50, 66, sk.color, 1, 'l', true);
        AB.text(c, 'COOLDOWN ' + (sk.cd / 60).toFixed(0) + 'S', dx + 50, 80, '#8a8096', 1, 'l', true);
        AB.paragraph(c, sk.desc, dx + 12, 104, 30, '#d8cfc0', 1, 11);
      } else if (cur.kind === 'boon') {
        AB.drawIcon(c, cur.boon.icon, dx + 10, 62, 2, cur.boon.color); AB.text(c, cur.boon.name, dx + 50, 66, cur.boon.color, 1, 'l', true);
        AB.text(c, RN[cur.boon.rarity], dx + 50, 80, RC[cur.boon.rarity], 1, 'l', true);
        AB.paragraph(c, cur.boon.desc, dx + 12, 104, 30, '#d8cfc0', 1, 11);
      } else if (cur.kind === 'heal') {
        AB.drawIcon(c, 'heart', dx + 10, 62, 2, '#ff6070'); AB.text(c, 'Healing Draught', dx + 50, 66, '#ff8090', 1, 'l', true);
        AB.paragraph(c, 'Restores half of your maximum health instantly.', dx + 12, 104, 30, '#d8cfc0', 1, 11);
      } else {
        AB.drawIcon(c, 'flask', dx + 10, 62, 2, '#7affb0'); AB.text(c, 'Flask Refill', dx + 50, 66, '#7affb0', 1, 'l', true);
        AB.paragraph(c, 'Refills one used flask charge.', dx + 12, 104, 30, '#d8cfc0', 1, 11);
      }
      if (m.msg) AB.text(c, m.msg, AB.W / 2, AB.H - 28, '#ffd0a0', 1, 'c', true);
    } else if (m.type === 'smith') {
      AB.text(c, 'THE EMBER SMITH', AB.W / 2, 20, '#f0dcb0', 2, 'c', true);
      AB.text(c, 'Temper a weapon to raise its tier', AB.W / 2, 42, '#9a8e80', 1, 'c', true);
      for (i = 0; i < 2; i++) {
        var wp2 = run.weapons[i], sel3 = i === m.sel, sy = 64 + i * 66, sw2 = 360, sx2 = Math.round(AB.W / 2 - sw2 / 2);
        m.rects.push({ x: sx2, y: sy, w: sw2, h: 58 });
        AB.panel(c, sx2, sy, sw2, 58, sel3 ? '#2a2030' : '#15101a', sel3 ? '#e8c880' : '#4a4054');
        if (!wp2) { AB.text(c, 'EMPTY SLOT', AB.W / 2, sy + 24, '#5a5068', 1, 'c', true); continue; }
        AB.drawIcon(c, wp2.icon, sx2 + 12, sy + 12, 2.2, wp2.color);
        AB.text(c, wp2.name, sx2 + 56, sy + 10, nameColor(wp2), 1, 'l', true);
        AB.text(c, AB.TIER_NAMES[wp2.tier] + (wp2.tier < 4 ? '  >  ' + AB.TIER_NAMES[wp2.tier + 1] : '  (MAX)'), sx2 + 56, sy + 22, '#b0a698', 1, 'l', true);
        var nw = wp2.tier < 4 ? AB.upgradeWeapon(wp2) : wp2;
        AB.text(c, 'DMG ' + wp2.dmg + (wp2.tier < 4 ? '  >  ' + nw.dmg : ''), sx2 + 56, sy + 36, '#d8e8c0', 1, 'l', true);
        if (wp2.tier < 4) {
          var cost = AB.Modal.smithCost(wp2);
          AB.drawIcon(c, 'coin', sx2 + sw2 - 60, sy + 22, 0.8, '#ffd24a');
          AB.text(c, cost, sx2 + sw2 - 10, sy + 26, run.gold >= cost ? '#ffe08a' : '#ff6a6a', 1, 'r', true);
        }
      }
      if (m.msg) AB.text(c, m.msg, AB.W / 2, AB.H - 28, '#ffd0a0', 1, 'c', true);
    } else if (m.type === 'swap') {
      var pk = m.pk, isW = pk.kind === 'weapon';
      AB.text(c, isW ? 'REPLACE WHICH WEAPON?' : 'REPLACE WHICH SKILL?', AB.W / 2, 20, '#f0dcb0', 2, 'c', true);
      // new item card
      var nm2 = isW ? pk.weapon.name : AB.SKILLS[pk.skill].name, ic2 = isW ? pk.weapon.icon : AB.SKILLS[pk.skill].icon, col2 = isW ? pk.weapon.color : AB.SKILLS[pk.skill].color;
      AB.panel(c, 140, 48, 200, 54, '#1a1420', isW ? nameColor(pk.weapon) : col2);
      AB.drawIcon(c, ic2, 150, 58, 2.2, col2);
      AB.text(c, nm2, 192, 56, isW ? nameColor(pk.weapon) : col2, 1, 'l', true);
      if (isW) { AB.text(c, AB.TIER_NAMES[pk.weapon.tier] + '  DMG ' + pk.weapon.dmg, 192, 68, '#b0a698', 1, 'l', true); if (pk.weapon.affix) AB.text(c, AB.affixById[pk.weapon.affix].desc, 192, 80, AB.affixById[pk.weapon.affix].color, 1, 'l', true); }
      else AB.text(c, 'NEW SKILL', 192, 68, '#b0a698', 1, 'l', true);
      AB.text(c, 'VS', AB.W / 2, 112, '#7a7088', 1, 'c', true);
      for (i = 0; i < 2; i++) {
        var cx2 = 90 + i * 160, sel4 = i === m.sel;
        var cur2 = isW ? run.weapons[i] : (run.skills[i] ? AB.SKILLS[run.skills[i]] : null);
        m.rects.push({ x: cx2, y: 126, w: 140, h: 96 });
        AB.panel(c, cx2, 126, 140, 96, sel4 ? '#2a2030' : '#15101a', sel4 ? '#e8c880' : '#4a4054');
        AB.text(c, (isW ? (i ? 'SECONDARY' : 'PRIMARY') : 'SKILL ' + (i + 1)), cx2 + 70, 132, '#7a7088', 1, 'c', true);
        if (!cur2) { AB.text(c, 'EMPTY', cx2 + 70, 170, '#5a5068', 1, 'c', true); continue; }
        AB.drawIcon(c, cur2.icon, cx2 + 54, 146, 2, isW ? cur2.color : cur2.color);
        AB.paragraph(c, cur2.name, cx2 + 70, 182, 22, isW ? nameColor(cur2) : cur2.color, 1, 10, 'c');
        if (isW) AB.text(c, AB.TIER_NAMES[cur2.tier] + '  DMG ' + cur2.dmg, cx2 + 70, 204, '#b0a698', 1, 'c', true);
      }
    }
    c.globalAlpha = 1;
  }
};
})();
