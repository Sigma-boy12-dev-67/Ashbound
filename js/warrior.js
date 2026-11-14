/* ============================================================================
   The Warrior - sprite-based player renderer + procedural animation.
   Poses come from AB.SPRITES (built by tools/make-sprites.py from assets/source/):
     idle, walk, lunge (sword pose, sword removed), draw (bow pose, bow removed), dead.
   Everything else (walk cycle, breathing, attack wind-up/lunge/recover, roll, hurt, drink, death fall)
   is animated here by moving, rotating and squashing those poses. Weapons are drawn in the hand at runtime,
   using the sword/bow images (or the normal icon for other weapons).
   Falls back to the old procedural drawing (AB.drawPlayerLegacy) until the images have loaded.
   ========================================================================== */
(function () {
'use strict';
var AB = window.AB, D2R = Math.PI / 180, PI = Math.PI;
var DATA = AB.SPRITES && AB.SPRITES.frames, F = {}, ready = false, tints = {};
if (DATA) {
  var left = Object.keys(DATA).length;
  Object.keys(DATA).forEach(function (n) {
    var im = new Image(), m = DATA[n];
    im.onload = function () { if (--left === 0) ready = true; };
    im.src = m.src; F[n] = { img: im, w: m.w, h: m.h, ax: m.ax, hand: m.hand, hand2: m.hand2 };
  });
}
function tinted(n, col) {
  var k = n + col, c = tints[k]; if (c) return c;
  var f = F[n]; c = document.createElement('canvas'); c.width = f.w; c.height = f.h;
  var g = c.getContext('2d'); g.drawImage(f.img, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, f.w, f.h);
  return (tints[k] = c);
}
function ease(x) { return x < 0 ? 0 : (x > 1 ? 1 : x * x * (3 - 2 * x)); }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

/* draw frame n with its feet-anchor at the origin (already translated/mirrored). dx,dy offset, rot radians around the feet, sx/sy scale */
function put(c, n, o) {
  o = o || {}; var f = F[n], img = o.flash ? tinted(n, '#ffffff') : f.img;
  c.save(); c.translate(o.dx || 0, o.dy || 0);
  if (o.rot) c.rotate(o.rot);
  c.scale(o.sx || 1, o.sy || 1);
  if (!o.flash && !o.noRim) { // faint cool rim light so the dark armour reads against dark stone
    var rim = tinted(n, '#7a6c9c'); c.globalAlpha *= 0.45;
    c.drawImage(rim, -f.ax - 1, -f.h); c.drawImage(rim, -f.ax, -f.h - 1);
    c.globalAlpha /= 0.45;
  }
  c.drawImage(img, -f.ax, -f.h);
  c.restore();
}
function handOf(n, ox, oy) { var f = F[n]; return [f.hand[0] - f.ax + (ox || 0), f.hand[1] - f.h + (oy || 0)]; }

/* a weapon icon with its grip at the origin, rotated so the blade points along `deg` (screen degrees, 0 = right, -90 = up) */
function weaponIcon(c, wp, deg, size) {
  var img = AB.iconImage(wp.icon, false) || null, S = size || 16;
  c.save(); c.rotate((deg + 45) * D2R);
  if (img) c.drawImage(img, -0.22 * S, -0.78 * S, S, S);
  else AB.drawIcon(c, wp.icon, -0.22 * S, -0.78 * S, S / 16, wp.color);
  c.restore();
}

AB.drawPlayer = function (c, p, cx, cy, t) {
  if (!ready) return AB.drawPlayerLegacy(c, p, cx, cy, t);
  var f = p.face, ox = Math.round(p.x + 5 - cx), oy = Math.round(p.y + 22 - cy);
  var fl = p.flash > 0, st = p.state, run = p.run, a = p.atk, wp = a ? a.wp : null;
  var rolling = st === 'roll';
  var blink = (p.iframes > 0 && !rolling && p.hurtT === 0 && !p.dead && ((t >> 2) & 1)) ? 0.4 : 1;

  c.save(); c.globalAlpha = blink; c.translate(ox, oy); c.scale(f, 1);

  /* ---------------- dead: fall back, then lie there ---------------- */
  if (p.dead) {
    var dt = p.deadT;
    if (dt < 12) { var e = ease(dt / 12); put(c, 'idle', { rot: -e * 85 * D2R, dx: -e * 5, flash: dt < 4 }); }
    else { var bounce = dt < 18 ? -Math.sin((dt - 12) / 6 * PI) * 2 : 0; put(c, 'dead', { dy: bounce, noRim: true }); }
    c.restore(); return;
  }

  AB.glow(c, 0, -15, 15, p.buffT > 0 ? '#ff5a3a' : '#ffb04a', p.buffT > 0 ? 0.3 + Math.sin(t * 0.3) * 0.1 : 0.14);

  /* ---------------- roll: tuck into a ball and spin ---------------- */
  if (rolling) {
    var ang = (1 - p.rollT / 20) * PI * 2 * (p.rollDir === p.face ? 1 : -1);
    c.translate(0, -9); c.rotate(ang); c.translate(0, 9);
    put(c, 'idle', { sx: 0.62, sy: 0.62, dy: -1, flash: fl, noRim: true });
    c.restore(); return;
  }

  var sq = p.landSq > 0 ? p.landSq * 0.03 : 0;      // landing squash
  var sx = 1 + sq, sy = 1 - sq;

  /* ---------------- attacks ---------------- */
  if (a && wp && (wp.type === 'melee' || wp.type === 'ranged')) {
    var pr = clamp(a.t / a.dur, 0, 1), hand;
    if (wp.type === 'melee') {
      var rev = a.combo % 2 === 1, thrust = !!wp.thrust, slam = !!wp.slam;
      var wind = slam ? 0.4 : 0.25, hit = slam ? 0.62 : 0.65;
      if (pr < wind) { // wind-up: lean back, weapon cocked behind
        var w = ease(pr / wind);
        put(c, 'idle', { rot: -w * 0.16, dx: -w * 2, flash: fl });
        hand = handOf('idle', -w * 2 - 0.5, 0);
        c.save(); c.translate(hand[0], hand[1]);
        weaponIcon(c, wp, slam ? -100 - w * 30 : (rev ? 30 : -150) + (rev ? w * -10 : w * -10), 16 * (slam ? 1.25 : 1));
        c.restore();
      } else { // strike + follow through
        var s = ease((pr - wind) / (hit - wind)), rec = ease((pr - hit) / (1 - hit));
        var lunge = (thrust ? 5 : 3) * s * (1 - rec * 0.7) + (a.combo === 2 ? 1.5 : 0);
        put(c, 'lunge', { dx: lunge, rot: rev ? 0.05 : -0.03, flash: fl, sx: 1, sy: 1 - rec * 0.03 });
        hand = handOf('lunge', lunge, 0);
        var angle, bd;
        if (thrust) bd = 6 + (1 - s) * -12;
        else { var a0 = -115, a1 = 65, e2 = pr < 0.25 ? pr / 0.25 * 0.15 : (pr < 0.65 ? 0.15 + (pr - 0.25) / 0.4 * 0.85 : 1); angle = rev ? a1 + (a0 - a1) * e2 : a0 + (a1 - a0) * e2; bd = angle - 45; }
        var ext = thrust ? (pr < 0.6 ? 1 : 1 - (pr - 0.6) / 0.4 * 0.6) * 5 : 0;
        c.save(); c.translate(hand[0] + ext, hand[1]);
        weaponIcon(c, wp, bd, 16 * (wp.id === 'warhammer' || wp.id === 'emberaxe' ? 1.25 : 1) * (thrust ? 1.35 : 1));
        c.restore();
        if (thrust && pr > 0.3 && pr < 0.7) { c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(hand[0] + 6, hand[1], 28, 1); AB.glow(c, hand[0] + 32, hand[1], 14, wp.color, 0.5); }
        if (!thrust && pr > 0.18 && pr < 0.8) { // slash arc
          var al = 1 - Math.abs(pr - 0.45) * 2.2; if (al < 0) al = 0;
          c.save(); c.translate(hand[0] - 1, hand[1] - 2); c.lineCap = 'butt';
          var rad = wp.reach * 0.78 + (a.combo === 2 ? 6 : 0), as = rev ? a1 : a0, ae = angle;
          c.globalAlpha = blink * al * 0.55; c.strokeStyle = wp.color; c.lineWidth = wp.combo >= 3 && a.combo === 2 ? 9 : 6;
          c.beginPath(); c.arc(0, 0, rad, as * D2R, ae * D2R, rev); c.stroke();
          c.globalAlpha = blink * al; c.strokeStyle = '#ffffff'; c.lineWidth = 2;
          c.beginPath(); c.arc(0, 0, rad + 1, as * D2R, ae * D2R, rev); c.stroke();
          c.restore();
        }
      }
    } else { // ranged: draw the bow, hold, release
      var rc = a.fired ? Math.max(0, 2.5 - (a.t - a.dur * 0.3) * 0.35) : 0;
      put(c, 'draw', { dx: -rc * 0.6, flash: fl });
      hand = handOf('draw', -rc * 0.6, 0);
      var isBow = wp.icon === 'bow';
      c.save(); c.translate(hand[0], hand[1]);
      if (isBow) {
        c.save(); c.translate(1, 0); c.scale(-1, 1); c.rotate(-43 * D2R); // string vertical, belly toward the target
        var bi = AB.iconImage('bow', true) || AB.iconImage('bow', false);
        if (bi) c.drawImage(bi, -8, -8, 16, 16); else AB.drawIcon(c, 'bow', -8, -8, 1, wp.color);
        c.restore();
        if (!a.fired) { // nocked arrow + drawn string
          var h2 = F.draw.hand2, bx = h2[0] - F.draw.ax - hand[0], by = h2[1] - F.draw.h - hand[1];
          c.fillStyle = '#d8c8a8'; c.fillRect(bx, by, -bx + 6, 1); c.fillStyle = '#ffffff'; c.fillRect(6, by, 2, 1);
          c.strokeStyle = 'rgba(230,218,200,0.8)'; c.lineWidth = 1; c.beginPath(); c.moveTo(1, -9); c.lineTo(bx, by); c.lineTo(1, 9); c.stroke();
        }
      } else AB.drawIcon(c, wp.icon, -8, -10, 1, wp.color);
      c.restore();
    }
    if (p.buffT > 0) AB.glow(c, 0, -12, 22, '#ff5a3a', 0.35 + Math.sin(t * 0.3) * 0.1);
    c.restore(); return;
  }

  /* ---------------- guard ---------------- */
  if (st === 'guard') {
    put(c, 'idle', { dx: 1, rot: 0.04, flash: fl, sx: sx, sy: sy });
    var sh = run.weapons[p.guardSlot], gh = handOf('idle', 3, -2);
    c.save(); c.translate(gh[0] + 3, gh[1] - 2);
    AB.drawIcon(c, 'shield', -8, -9, 1, p.parryT > 0 ? '#ffffff' : (sh ? sh.color : '#7ac8ff'));
    c.restore();
    if (p.parryT > 0) AB.glow(c, gh[0] + 6, gh[1], 22, '#bfe8ff', 0.8);
    c.restore(); return;
  }

  /* ---------------- drinking a flask ---------------- */
  if (st === 'drink') {
    var dk = Math.sin(clamp(1 - p.drinkT / 30, 0, 1) * PI);
    put(c, 'idle', { sy: 1 - 0.05 * dk, rot: -0.05 * dk, flash: fl });
    c.save(); c.translate(F.idle.hand[0] - F.idle.ax - 1, F.idle.hand[1] - F.idle.h - 10 * dk);
    AB.drawIcon(c, 'flask', -6, -8, 0.75, '#7affb0'); c.restore();
    c.restore(); return;
  }

  /* ---------------- hurt ---------------- */
  if (st === 'hurt') {
    put(c, 'idle', { dx: -2, rot: -0.14, flash: fl || (t >> 1 & 1) });
    c.restore(); return;
  }

  /* ---------------- air ---------------- */
  if (st === 'jump') { put(c, 'walk', { rot: -0.04, sy: 1.03, sx: 0.98, flash: fl }); c.restore(); return; }
  if (st === 'fall') { put(c, 'idle', { rot: 0.05, sy: 1.04, sx: 0.97, dx: 0.5, flash: fl }); c.restore(); return; }

  /* ---------------- run: step cycle (walk pose <-> passing pose) with a bounce ---------------- */
  if (st === 'run') {
    var ph = p.anim * 1.7, k = Math.floor(ph / (PI / 2)) & 3, sw = Math.abs(Math.sin(ph));
    var bob = -Math.round(sw * 1.4 * 2) / 2;
    if (k === 0 || k === 2) put(c, 'walk', { dy: bob * 0.4, dx: k === 2 ? -0.5 : 0.5, rot: 0.03, flash: fl, sx: sx, sy: sy });
    else put(c, 'idle', { dy: bob, rot: 0.1, dx: 1, flash: fl, sx: sx, sy: sy });
    c.restore(); return;
  }

  /* ---------------- idle: breathing ---------------- */
  var br = Math.sin(p.anim * 2);
  put(c, 'idle', { sy: sy * (1 + br * 0.012), sx: sx * (1 - br * 0.006), dx: br * 0.15, flash: fl });
  c.restore();
};
})();
