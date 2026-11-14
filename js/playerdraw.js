(function () {
'use strict';
var AB = window.AB;
function R(c, col, x, y, w, h) { c.fillStyle = col; c.fillRect(x, y, w, h); }
var D2R = Math.PI / 180;

AB.drawPlayerLegacy = function (c, p, cx, cy, t) {
  if (p.dead && p.deadT > 90) return;
  var ox = Math.round(p.x + 5 - cx), oy = Math.round(p.y + 22 - cy), f = p.face;
  var fl = p.flash > 0;
  var K = function (col) { return fl ? '#ffffff' : col; };
  var rolling = p.state === 'roll';
  var blink = (p.iframes > 0 && !rolling && p.hurtT === 0 && ((t >> 2) & 1)) ? 0.4 : 1;

  c.save();
  c.globalAlpha = blink;

  // ---- scarf (world space, behind body) ----
  if (!p.dead) {
    for (var i = p.scarf.length - 1; i >= 0; i--) {
      var s = p.scarf[i], sx = Math.round(s.x - cx), sy = Math.round(s.y - cy);
      var wd = Math.max(1, 3 - (i >> 1));
      R(c, K(i % 2 ? '#a8281a' : '#d8442a'), sx - 1, sy, wd + 1, 2);
    }
  }

  c.translate(ox, oy);
  if (p.dead) { c.rotate(Math.min(1, p.deadT / 14) * f * 1.5); c.translate(0, -2 + Math.min(p.deadT / 14, 1) * 4); }
  var sq = p.landSq > 0 ? 1 - p.landSq * 0.025 : 1;
  c.scale(f, sq);

  var st = p.state, ph = p.anim * 3, bob = st === 'idle' ? Math.round(Math.sin(p.anim * 2) * 0.7) : 0;
  var cloak = K('#37344a'), cloakD = K('#25222f'), cloakL = K('#4e4a68'), boot = K('#1a1824'), trim = K('#7a7494');

  if (rolling) {
    var ang = (1 - p.rollT / 20) * Math.PI * 2 * (p.rollDir === p.face ? 1 : -1);
    c.translate(0, -7); c.rotate(ang);
    R(c, cloakD, -6, -6, 12, 12); R(c, cloak, -5, -5, 10, 10); R(c, cloakL, -4, -5, 4, 3);
    R(c, K('#c8a23c'), -5, 1, 10, 1); R(c, K('#ffb04a'), 2, -3, 2, 2);
    c.restore(); return;
  }

  // ---- legs ----
  var la = 0, lb = 0, ly = 0, lyb = 0;
  if (st === 'run') { la = Math.round(Math.sin(ph) * 3.2); lb = -la; ly = Math.max(0, Math.round(-Math.cos(ph) * 2)); lyb = Math.max(0, Math.round(Math.cos(ph) * 2)); }
  else if (st === 'jump') { la = 2; lb = -2; ly = 2; lyb = 0; }
  else if (st === 'fall') { la = 1; lb = -1; }
  else if (st === 'attack' || st === 'guard') { la = 2; lb = -2; }
  var crouch = st === 'drink' ? 1 : 0;
  R(c, boot, -3 + lb, -7 - lyb + crouch, 3, 7 + lyb - crouch); R(c, K('#3a3548'), -3 + lb, -7 - lyb + crouch, 2, 4);
  R(c, boot, -4 + lb, -2, 5, 2);
  R(c, boot, 0 + la, -7 - ly + crouch, 3, 7 + ly - crouch); R(c, K('#4a4560'), 0 + la, -7 - ly + crouch, 2, 4);
  R(c, boot, 0 + la, -2, 5, 2); R(c, trim, 3 + la, -2, 2, 1);

  // ---- body / cloak ----
  var tilt = st === 'hurt' ? -2 : (st === 'attack' ? 1 : 0);
  var by = bob + crouch;
  R(c, cloakD, -6 + tilt, -16 + by, 11, 11);
  R(c, cloak, -5 + tilt, -15 + by, 9, 10);
  R(c, cloakL, -1 + tilt, -14 + by, 3, 7);
  // tattered hem
  R(c, cloak, -6, -6, 12, 2);
  R(c, cloakD, -6, -4, 2, 2); R(c, cloakD, -2, -4, 3, 1); R(c, cloakD, 2, -4, 2, 2);
  // belt
  R(c, K('#6a4a2a'), -5 + tilt, -9 + by, 9, 2); R(c, K('#ffb04a'), 0 + tilt, -9 + by, 2, 2);
  // shoulder pad
  R(c, trim, -2 + tilt, -16 + by, 5, 2);

  // ---- head / hood ----
  var hy = by + (st === 'drink' ? -1 : 0), hx = tilt;
  R(c, cloakD, -5 + hx, -24 + hy, 10, 10);
  R(c, cloak, -4 + hx, -23 + hy, 8, 8);
  R(c, cloakL, -3 + hx, -23 + hy, 4, 2);
  R(c, cloakD, -7 + hx, -20 + hy, 3, 4); // hood tip
  R(c, K('#0a0810'), 0 + hx, -21 + hy, 5, 5);
  var eyeC = fl ? '#fff' : (p.buffT > 0 ? '#ff5a5a' : '#ffb04a');
  R(c, eyeC, 1 + hx, -19 + hy, 1, 2); R(c, eyeC, 3 + hx, -19 + hy, 1, 2);
  c.restore(); c.save(); c.globalAlpha = blink;
  AB.glow(c, ox + f * 2.5 + (f > 0 ? 0 : 0) + hx * f, oy - 18 + hy, 9, p.buffT > 0 ? '#ff5a5a' : '#ffb04a', 0.5);
  c.translate(ox, oy); c.scale(f, sq);

  // ---- arm + weapon ----
  var run = p.run, a = p.atk, wp = a ? a.wp : null;
  var handX = 4, handY = -11 + by;
  if (st === 'guard') {
    var sh = run.weapons[p.guardSlot];
    R(c, K('#2a2838'), 0, -14 + by, 4, 4);
    c.save(); c.translate(6, -12 + by);
    AB.drawIcon(c, 'shield', -8, -8, 1, p.parryT > 0 ? '#ffffff' : (sh ? sh.color : '#7ac8ff'));
    c.restore();
    if (p.parryT > 0) AB.glow(c, 6, -12, 22, '#bfe8ff', 0.8);
  } else if (a && wp.type === 'melee') {
    var pr = AB.clamp(a.t / a.dur, 0, 1), e = pr < 0.25 ? pr / 0.25 * 0.15 : (pr < 0.65 ? 0.15 + (pr - 0.25) / 0.4 * 0.85 : 1);
    var a0 = -115, a1 = 65, rev = a.combo % 2 === 1;
    var angle = (rev ? a1 + (a0 - a1) * e : a0 + (a1 - a0) * e);
    if (wp.thrust) {
      var ext = pr < 0.25 ? -6 * (pr / 0.25) : (pr < 0.6 ? -6 + 24 * ((pr - 0.25) / 0.35) : 18 - 12 * ((pr - 0.6) / 0.4));
      c.save(); c.translate(handX + ext, handY); c.rotate(90 * D2R);
      AB.drawIcon(c, wp.icon, -8, -14, 1.2, wp.color); c.restore();
      if (pr > 0.3 && pr < 0.7) { R(c, 'rgba(255,255,255,0.5)', 6, -12 + by, 34, 1); AB.glow(c, 36, -11, 16, wp.color, 0.5); }
    } else {
      c.save(); c.translate(handX, handY); c.rotate((angle + 0) * D2R);
      AB.drawIcon(c, wp.icon, -8, -15, wp.id === 'warhammer' || wp.id === 'emberaxe' ? 1.25 : 1, wp.color); c.restore();
      // slash arc
      if (pr > 0.18 && pr < 0.8) {
        var al = 1 - Math.abs(pr - 0.45) * 2.2; if (al < 0) al = 0;
        c.save(); c.translate(handX - 1, handY - 2);
        c.lineCap = 'butt';
        var rad = wp.reach * 0.78 + (a.combo === 2 ? 6 : 0);
        var as = rev ? a1 : a0, ae = angle;
        c.globalAlpha = blink * al * 0.55; c.strokeStyle = wp.color; c.lineWidth = wp.combo >= 3 && a.combo === 2 ? 9 : 6;
        c.beginPath(); c.arc(0, 0, rad, as * D2R, ae * D2R, rev); c.stroke();
        c.globalAlpha = blink * al; c.strokeStyle = '#ffffff'; c.lineWidth = 2;
        c.beginPath(); c.arc(0, 0, rad + 1, as * D2R, ae * D2R, rev); c.stroke();
        c.restore();
      }
    }
    R(c, K('#2a2838'), 0, -14 + by, 5, 3);
  } else if (a && wp.type === 'ranged') {
    R(c, K('#2a2838'), 0, -14 + by, 6, 3);
    var rec = a.fired ? Math.max(0, 2 - (a.t - a.dur * 0.3) * 0.3) : 0;
    c.save(); c.translate(8 - rec, -12 + by); AB.drawIcon(c, wp.icon, -6, -8, 1, wp.color); c.restore();
  } else {
    // idle / run: weapon on back, arm swinging
    var sw = st === 'run' ? Math.round(Math.sin(ph + Math.PI) * 2) : 0;
    R(c, K('#2a2838'), 0 + sw, -14 + by, 3, 6);
    if (st === 'drink') { c.save(); c.translate(5, -17 + by); AB.drawIcon(c, 'flask', -6, -8, 0.75, '#7affb0'); c.restore(); }
    else {
      var w0 = run.weapons[0];
      if (w0) { c.save(); c.translate(-4, -13 + by); c.rotate(-30 * D2R); AB.drawIcon(c, w0.icon, -8, -15, 0.8, w0.color); c.restore(); }
    }
  }
  if (p.buffT > 0) AB.glow(c, 0, -12, 22, '#ff5a3a', 0.35 + Math.sin(t * 0.3) * 0.1);
  c.restore();
};

// Telegraph "!" marker & dust helpers are in world.js
})();
