(function () {
'use strict';
var AB = window.AB;

/* ---------- 5x7 pixel font (column bytes, bit0 = top row) ---------- */
var RAW = {
  ' ': '0000000000', '!': '00005F0000', '"': '0007000700', '#': '147F147F14', '$': '242A7F2A12',
  '%': '2313086462', '&': '3649562050', "'": '0005030000', '(': '001C224100', ')': '0041221C00',
  '*': '14083E0814', '+': '08083E0808', ',': '0050300000', '-': '0808080808', '.': '0060600000',
  '/': '2010080402', '0': '3E5149453E', '1': '00427F4000', '2': '4261514946', '3': '2141454B31',
  '4': '1814127F10', '5': '2745454539', '6': '3C4A494930', '7': '0171090503', '8': '3649494936',
  '9': '064949291E', ':': '0036360000', ';': '0056360000', '<': '0814224100', '=': '1414141414',
  '>': '0041221408', '?': '0201510906', '@': '324979413E', 'A': '7E1111117E', 'B': '7F49494936',
  'C': '3E41414122', 'D': '7F4141221C', 'E': '7F49494941', 'F': '7F09090901', 'G': '3E4149497A',
  'H': '7F0808087F', 'I': '00417F4100', 'J': '2040413F01', 'K': '7F08142241', 'L': '7F40404040',
  'M': '7F020C027F', 'N': '7F0408107F', 'O': '3E4141413E', 'P': '7F09090906', 'Q': '3E4151215E',
  'R': '7F09192946', 'S': '4649494931', 'T': '01017F0101', 'U': '3F4040403F', 'V': '1F2040201F',
  'W': '3F4038403F', 'X': '6314081463', 'Y': '0708700807', 'Z': '6151494543', '[': '007F414100',
  ']': '0041417F00', '_': '4040404040', '^': '0402010204', '|': '0000770000', '~': '0201020402'
};
var GLYPH = {};
Object.keys(RAW).forEach(function (ch) {
  var s = RAW[ch], cols = [];
  for (var i = 0; i < 5; i++) cols.push(parseInt(s.substr(i * 2, 2), 16));
  GLYPH[ch] = cols;
});

var tcache = {}, tcount = 0;
function bakeText(str, color, scale, shadow) {
  var key = str + '|' + color + '|' + scale + '|' + (shadow || '');
  var c = tcache[key];
  if (c) return c;
  if (tcount > 800) { tcache = {}; tcount = 0; }
  var w = str.length * 6 * scale + scale * 2, h = 9 * scale + scale;
  c = document.createElement('canvas'); c.width = w; c.height = h;
  var g = c.getContext('2d');
  var pass = shadow ? [[scale, scale, shadow], [0, 0, color]] : [[0, 0, color]];
  for (var p = 0; p < pass.length; p++) {
    g.fillStyle = pass[p][2];
    for (var i = 0; i < str.length; i++) {
      var gl = GLYPH[str[i].toUpperCase()] || GLYPH['?'];
      for (var cx = 0; cx < 5; cx++) {
        var col = gl[cx];
        for (var r = 0; r < 7; r++) {
          if (col & (1 << r)) g.fillRect(pass[p][0] + (i * 6 + cx) * scale, pass[p][1] + r * scale, scale, scale);
        }
      }
    }
  }
  tcache[key] = c; tcount++;
  return c;
}

/* text(c, str, x, y, color, scale, align('l'|'c'|'r'), shadow(true|css color|false)) */
AB.text = function (c, str, x, y, color, scale, align, shadow) {
  str = String(str); scale = scale || 1;
  var w = str.length * 6 * scale - scale;
  if (align === 'c' || align === 'center') x -= Math.floor(w / 2); else if (align === 'r' || align === 'right') x -= w;
  var sh = shadow === true || shadow === undefined ? '#000000' : (shadow || null);
  c.drawImage(bakeText(str, color || '#ffffff', scale, sh), Math.round(x), Math.round(y));
};
AB.measure = function (str, scale) { str = String(str); scale = scale || 1; return str.length * 6 * scale - scale; };
AB.wrap = function (str, maxChars) {
  var words = String(str).split(' '), lines = [], cur = '';
  words.forEach(function (w) {
    if ((cur + ' ' + w).trim().length > maxChars) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  });
  if (cur) lines.push(cur);
  return lines;
};
// paragraph(c, str, x, y, maxChars, color, scale, lineHeight, align) -> line count
AB.paragraph = function (c, str, x, y, maxChars, color, scale, lh, align) {
  var lines = AB.wrap(str, maxChars);
  for (var i = 0; i < lines.length; i++) AB.text(c, lines[i], x, y + i * (lh || 10), color, scale || 1, align || 'l');
  return lines.length;
};

/* ---------- additive glow ---------- */
var glowCache = {};
function glowSprite(color, r) {
  r = Math.max(2, Math.round(r));
  var k = color + '|' + r, s = glowCache[k];
  if (s) return s;
  s = document.createElement('canvas'); s.width = s.height = r * 2;
  var g = s.getContext('2d'), gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, AB.rgba(color, 1)); gr.addColorStop(0.35, AB.rgba(color, 0.5)); gr.addColorStop(1, AB.rgba(color, 0));
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
  glowCache[k] = s; return s;
}
AB.glow = function (c, x, y, r, color, alpha) {
  var q = Math.max(4, Math.round(r / 2) * 2); // quantise radius to keep the cache small
  var old = c.globalAlpha, oc = c.globalCompositeOperation;
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = old * (alpha === undefined ? 1 : alpha);
  c.drawImage(glowSprite(color, q), Math.round(x - q), Math.round(y - q));
  c.globalAlpha = old; c.globalCompositeOperation = oc;
};

/* ---------- bars & panels ---------- */
AB.bar = function (c, x, y, w, h, val, max, color, bg) {
  var f = AB.clamp(val / max, 0, 1);
  c.fillStyle = '#000'; c.fillRect(x - 1, y - 1, w + 2, h + 2);
  c.fillStyle = bg || '#3a1418'; c.fillRect(x, y, w, h);
  c.fillStyle = color; c.fillRect(x, y, Math.round(w * f), h);
  if (h > 2) { c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillRect(x, y, Math.round(w * f), 1); }
};
AB.panel = function (c, x, y, w, h, fill, border) {
  border = border || '#7a6650';
  c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(x + 2, y + 2, w, h);
  c.fillStyle = '#000'; c.fillRect(x - 1, y - 1, w + 2, h + 2);
  c.fillStyle = border; c.fillRect(x, y, w, h);
  c.fillStyle = fill || '#16111c'; c.fillRect(x + 1, y + 1, w - 2, h - 2);
  c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(x + 1, y + 1, w - 2, 1);
  c.fillStyle = border;
  c.fillRect(x - 2, y - 2, 4, 2); c.fillRect(x - 2, y - 2, 2, 4);
  c.fillRect(x + w - 2, y - 2, 4, 2); c.fillRect(x + w, y - 2, 2, 4);
  c.fillRect(x - 2, y + h, 4, 2); c.fillRect(x - 2, y + h - 2, 2, 4);
  c.fillRect(x + w - 2, y + h, 4, 2); c.fillRect(x + w, y + h - 2, 2, 4);
};

/* ---------- 8x8 pixel icons, drawn into 16x16 sprites ----------
   a = main colour, b = dark shade, c = light shade. Held weapons point straight up with the grip at the bottom. */
var ICONS = {
  sword:   ['...cc...', '...ca...', '...ca...', '...ca...', '...ca...', '.bbbbbb.', '...bb...', '...bb...'],
  axe:     ['...bbaa.', '...bacaa', '...bacaa', '...bbaa.', '...bb...', '...bb...', '...bb...', '...bb...'],
  spear:   ['...cc...', '..caac..', '...bb...', '...bb...', '...bb...', '...bb...', '...bb...', '...bb...'],
  dagger:  ['..c..c..', '..c..c..', '..a..a..', '..a..a..', '.bbb.bbb', '..b..b..', '..b..b..', '........'],
  hammer:  ['.bbbbbb.', '.baaaac.', '.baaaac.', '.bbbbbb.', '...bb...', '...bb...', '...bb...', '...bb...'],
  bow:     ['..bbb...', '.c...b..', 'c.....b.', 'c.....b.', 'c.....b.', '.c...b..', '..bbb...', '........'],
  bolt:    ['..cac...', '..cac...', '...c....', '...b....', '...b....', '...b....', '...b....', '...b....'],
  shield:  ['.bbbbbb.', 'baaaaaab', 'bacccaab', 'bacaaaab', 'baccaaab', '.baaaab.', '..baab..', '...bb...'],
  bomb:    ['.....c..', '....c...', '..bbbb..', '.baaaab.', '.bacaab.', '.baaaab.', '..bbbb..', '........'],
  nova:    ['...c....', '.c.c.c..', '..ccc...', 'ccccccc.', '..ccc...', '.c.c.c..', '...c....', '........'],
  warcry:  ['..b..b..', '.ba..ab.', 'baa..aab', 'baaccaab', 'baaaaaab', '.baaaab.', '..b..b..', '........'],
  shadow:  ['....b...', 'c..bab..', 'cc.baab.', 'ccbaaab.', 'cc.baab.', 'c..bab..', '....b...', '........'],
  chain:   ['....cc..', '...cc...', '..cccc..', '...cc...', '..cc....', '.cc.....', 'c.......', '........'],
  turret:  ['..bbbb..', '.baaaab.', '.bacaab.', '.baaaab.', 'bbbbbbbb', '.b.bb.b.', 'b..bb..b', '........'],
  heart:   ['.bb..bb.', 'baabbaab', 'baaaaaab', 'baaaaaab', '.baaaab.', '..baab..', '...bb...', '........'],
  coin:    ['..bbbb..', '.baaaab.', 'bacaaaab', 'bacaaaab', 'baaaaaab', 'baaaaaab', '.baaaab.', '..bbbb..'],
  ember:   ['...c....', '..cac...', '..caac..', '.caaaac.', '.caaaac.', '.baaaab.', '..baab..', '...bb...'],
  star:    ['...c....', '...c....', '.cccccc.', '..cacc..', '..cccc..', '.cc..cc.', '.c....c.', '........'],
  skull:   ['..aaaa..', '.aaaaaa.', 'aabaabaa', 'aabaabaa', '.aaaaaa.', '..abba..', '..a..a..', '........'],
  flask:   ['..bbbb..', '...bb...', '..baab..', '.baaaab.', '.baccab.', '.baaaab.', '..bbbb..', '........'],
  drop:    ['...b....', '..bab...', '..baab..', '.baaaab.', '.bacaab.', '.baaaab.', '..bbbb..', '........'],
  key:     ['..bbb...', '.b...b..', '.b...b..', '..bbb...', '...b....', '...bb...', '...b....', '...bb...'],
  fist:    ['.bbbbb..', 'baaaaab.', 'baaaaaab', 'baaaaaab', 'baaaaaab', '.baaaab.', '..bbbb..', '........'],
  boot:    ['..bbb...', '..baab..', '..baab..', '..baab..', '.baaaab.', 'baaaaaab', 'bbbbbbbb', '........'],
  wing:    ['.......c', '.....cca', '...ccaa.', '.ccaaa..', 'ccaa....', '.ca.....', '........', '........'],
  anvil:   ['bbbbbbbb', 'baaaaaac', '.bbaabb.', '...baab.', '..baaab.', '.bbbbbbb', '........', '........'],
  lock:    ['..bbbb..', '.b....b.', '.b....b.', 'bbbbbbbb', 'baaccaab', 'baaccaab', 'baaaaaab', 'bbbbbbbb']
};
AB.ICONS = ICONS;
var iconCache = {};
/* Image icons (the warrior's sword and bow, from AB.SPRITES.icons): a 16px and a 32px version of each. */
var imgIcons = {};
(function () {
  var D = AB.SPRITES && AB.SPRITES.icons; if (!D) return;
  Object.keys(D).forEach(function (id) {
    imgIcons[id] = {};
    Object.keys(D[id]).forEach(function (sz) { var im = new Image(); im.onload = function () { im.ok = true; }; im.src = D[id][sz]; imgIcons[id][sz] = im; });
  });
})();
AB.iconImage = function (id, big) { var o = imgIcons[id]; if (!o) return null; var im = big ? o[32] : o[16]; return im && im.ok ? im : null; };
function iconSprite(id, color) {
  var im = AB.iconImage(id, false); if (im) return im;
  var k = id + '|' + color, s = iconCache[k];
  if (s) return s;
  var m = ICONS[id] || ICONS.star;
  var col = color || '#e8d9b8', dark = AB.mix(col, '#000000', 0.55), light = AB.mix(col, '#ffffff', 0.6);
  s = document.createElement('canvas'); s.width = s.height = 16;
  var g = s.getContext('2d');
  for (var r = 0; r < 8; r++) for (var q = 0; q < 8; q++) {
    var ch = m[r][q];
    if (ch === '.') continue;
    g.fillStyle = ch === 'a' ? col : (ch === 'b' ? dark : light);
    g.fillRect(q * 2, r * 2, 2, 2);
  }
  iconCache[k] = s; return s;
}
// drawIcon(c, id, x, y, scale, color): top-left at x,y; 16px at scale 1
AB.drawIcon = function (c, id, x, y, scale, color) {
  scale = scale || 1;
  var big = scale >= 1.8 ? AB.iconImage(id, true) : null;
  if (big) { c.drawImage(big, Math.round(x), Math.round(y), Math.round(16 * scale), Math.round(16 * scale)); return; }
  c.drawImage(iconSprite(id, color), Math.round(x), Math.round(y), Math.round(16 * scale), Math.round(16 * scale));
};
})();

(function () {
  var AB = window.AB, vig = null;
  AB.vignette = function () {
    if (vig) return vig;
    vig = document.createElement('canvas'); vig.width = AB.W; vig.height = AB.H;
    var g = vig.getContext('2d'), gr = g.createRadialGradient(AB.W / 2, AB.H / 2, AB.H * 0.32, AB.W / 2, AB.H / 2, AB.W * 0.62);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.8)');
    g.fillStyle = gr; g.fillRect(0, 0, AB.W, AB.H);
    return vig;
  };
})();
