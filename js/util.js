(function () {
'use strict';
var AB = window.AB = window.AB || {};

AB.W = 480; AB.H = 270; AB.T = 16;

AB.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
AB.lerp = function (a, b, t) { return a + (b - a) * t; };
AB.sign = function (v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); };
AB.rand = function (a, b) { return a + Math.random() * (b - a); };
AB.randi = function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); };
AB.chance = function (p) { return Math.random() < p; };
AB.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };

// Seeded RNG (mulberry32) used for level generation
AB.makeRng = function (seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
AB.ri = function (R, a, b) { return a + Math.floor(R() * (b - a + 1)); };
AB.rpick = function (R, arr) { return arr[Math.floor(R() * arr.length)]; };
AB.shuffle = function (arr, R) {
  R = R || Math.random;
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(R() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
};

AB.overlap = function (a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
};
AB.dist = function (ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); };
AB.cx = function (o) { return o.x + o.w / 2; };
AB.cy = function (o) { return o.y + o.h / 2; };

AB.hex = function (h) {
  if (h[0] === '#') h = h.slice(1);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
AB.rgba = function (h, a) { var c = AB.hex(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; };
AB.mix = function (h1, h2, t) {
  var a = AB.hex(h1), b = AB.hex(h2);
  var r = Math.round(a[0] + (b[0] - a[0]) * t), g = Math.round(a[1] + (b[1] - a[1]) * t), bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
};
AB.fmtTime = function (f) {
  var s = Math.floor(f / 60), m = Math.floor(s / 60); s %= 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
};
AB.noise2 = function (x, y) {
  var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
})();
