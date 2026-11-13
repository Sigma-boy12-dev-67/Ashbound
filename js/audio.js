(function () {
'use strict';
var AB = window.AB;
var ac = null, master, sfxG, musG, nbuf;
var last = {};

function init() {
  if (ac) return true;
  var C = window.AudioContext || window.webkitAudioContext;
  if (!C) return false;
  try { ac = new C(); } catch (e) { ac = null; return false; }
  master = ac.createGain(); master.gain.value = 0.9;
  var comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 6;
  sfxG = ac.createGain(); musG = ac.createGain();
  sfxG.connect(comp); musG.connect(comp); comp.connect(master); master.connect(ac.destination);
  nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  var d = nbuf.getChannelData(0);
  for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVol();
  return true;
}
function applyVol() {
  if (!ac) return;
  var o = AB.save.data.opt;
  sfxG.gain.value = o.sfx;
  musG.gain.value = o.music * 0.5;
}
function resume() {
  init();
  if (ac && ac.state === 'suspended') ac.resume();
  if (M.want && !M.cur) musicPlay(M.want);
}
function tone(f, d, type, v, slide, delay, dest) {
  if (!ac) return;
  var t = ac.currentTime + (delay || 0);
  var o = ac.createOscillator(), g = ac.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + d);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v || 0.2, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(dest || sfxG);
  o.start(t); o.stop(t + d + 0.03);
}
function noise(d, v, hp, lp, delay, dest) {
  if (!ac) return;
  var t = ac.currentTime + (delay || 0);
  var s = ac.createBufferSource(); s.buffer = nbuf;
  var f1 = ac.createBiquadFilter(); f1.type = 'highpass'; f1.frequency.value = hp || 100;
  var f2 = ac.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lp || 8000;
  var g = ac.createGain();
  g.gain.setValueAtTime(v || 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(f1); f1.connect(f2); f2.connect(g); g.connect(dest || sfxG);
  s.start(t, Math.random() * 0.5); s.stop(t + d + 0.03);
}

var S = {
  swing: function () { noise(0.1, 0.16, 1200, 7000); tone(320, 0.09, 'sawtooth', 0.04, -200); },
  swingHeavy: function () { noise(0.2, 0.2, 400, 4000); tone(180, 0.18, 'sawtooth', 0.06, -110); },
  hit: function () { noise(0.1, 0.28, 300, 3500); tone(150, 0.1, 'square', 0.16, -100); },
  crit: function () { noise(0.14, 0.3, 500, 6000); tone(520, 0.12, 'square', 0.14, 300); tone(260, 0.16, 'sawtooth', 0.12, -150); },
  hurt: function () { noise(0.2, 0.3, 100, 2000); tone(200, 0.25, 'sawtooth', 0.2, -150); },
  die: function () { tone(300, 0.7, 'sawtooth', 0.22, -260); noise(0.7, 0.3, 60, 1500); },
  jump: function () { tone(300, 0.13, 'square', 0.08, 280); },
  djump: function () { tone(420, 0.14, 'square', 0.08, 380); },
  land: function () { noise(0.07, 0.12, 80, 700); },
  roll: function () { noise(0.2, 0.1, 400, 3000); },
  coin: function () { tone(988, 0.07, 'square', 0.07); tone(1319, 0.14, 'square', 0.07, 0, 0.06); },
  ember: function () { tone(660, 0.1, 'triangle', 0.1, 400); tone(990, 0.16, 'triangle', 0.08, 300, 0.05); },
  pickup: function () { tone(520, 0.1, 'triangle', 0.12, 200); tone(780, 0.15, 'triangle', 0.1, 200, 0.08); },
  heal: function () { tone(440, 0.2, 'sine', 0.14, 260); tone(660, 0.25, 'sine', 0.12, 330, 0.1); },
  chest: function () { noise(0.15, 0.2, 200, 2500); tone(240, 0.2, 'square', 0.1, 200, 0.05); tone(480, 0.3, 'triangle', 0.1, 0, 0.15); },
  door: function () { noise(0.5, 0.25, 40, 600); tone(70, 0.5, 'sawtooth', 0.15, -30); },
  shoot: function () { noise(0.08, 0.15, 1500, 8000); tone(700, 0.1, 'triangle', 0.08, -400); },
  bow: function () { noise(0.1, 0.12, 800, 6000); tone(240, 0.12, 'triangle', 0.1, 220); },
  explode: function () { noise(0.55, 0.45, 40, 1200); tone(80, 0.45, 'sawtooth', 0.28, -55); },
  fire: function () { noise(0.3, 0.2, 300, 3000); tone(200, 0.3, 'sawtooth', 0.08, 200); },
  ice: function () { noise(0.3, 0.14, 3000, 9000); tone(1200, 0.3, 'triangle', 0.09, -500); },
  zap: function () { noise(0.25, 0.3, 1000, 9000); tone(900, 0.2, 'sawtooth', 0.14, -700); tone(120, 0.3, 'square', 0.14, 0); },
  warcry: function () { tone(110, 0.5, 'sawtooth', 0.22, 60); tone(165, 0.5, 'square', 0.1, 50); noise(0.4, 0.15, 100, 1500); },
  parry: function () { tone(1400, 0.18, 'square', 0.12, -400); tone(900, 0.3, 'triangle', 0.14, 0, 0.04); noise(0.12, 0.2, 2000, 9000); },
  block: function () { noise(0.1, 0.2, 500, 3000); tone(300, 0.08, 'square', 0.1, -100); },
  slam: function () { noise(0.5, 0.4, 40, 900); tone(60, 0.5, 'sine', 0.35, -30); },
  boss: function () { tone(70, 1.1, 'sawtooth', 0.25, -25); tone(105, 1.1, 'square', 0.1, -40); noise(0.9, 0.2, 50, 700); },
  click: function () { tone(520, 0.04, 'square', 0.05); },
  confirm: function () { tone(660, 0.07, 'square', 0.08); tone(990, 0.1, 'square', 0.08, 0, 0.06); },
  error: function () { tone(150, 0.15, 'square', 0.1, -40); },
  buy: function () { tone(784, 0.07, 'square', 0.08); tone(1047, 0.07, 'square', 0.08, 0, 0.07); tone(1568, 0.14, 'square', 0.08, 0, 0.14); },
  altar: function () { tone(330, 0.5, 'sine', 0.14, 330); tone(495, 0.5, 'sine', 0.12, 330, 0.1); tone(660, 0.6, 'sine', 0.1, 330, 0.2); },
  portal: function () { tone(200, 1.0, 'sine', 0.2, 600); noise(1.0, 0.1, 500, 6000); },
  win: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.4, 'triangle', 0.14, 0, i * 0.15); }); }
};
AB.sfx = function (name) {
  if (!ac || !S[name]) return;
  var now = Date.now();
  if (last[name] && now - last[name] < 35) return;
  last[name] = now;
  S[name]();
};

/* ---------------- generative music ---------------- */
var TRACKS = {
  title:   { bpm: 76,  root: 45, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 4] },
  crypt:   { bpm: 96,  root: 43, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 6] },
  foundry: { bpm: 112, root: 41, scale: [0, 1, 4, 5, 7, 8, 11], prog: [0, 1, 0, 5] },
  spire:   { bpm: 100, root: 45, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 3, 5, 4] },
  boss:    { bpm: 138, root: 40, scale: [0, 1, 3, 5, 6, 8, 10], prog: [0, 1, 0, 6] }
};
var M = { want: null, cur: null, track: null, step: 0, bar: 0, next: 0, timer: null, intensity: 0, walk: 3 };
function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function degNote(tr, deg, oct) {
  var n = tr.scale.length;
  var o = Math.floor(deg / n), d = ((deg % n) + n) % n;
  return tr.root + tr.scale[d] + 12 * (o + (oct || 0));
}
function playStep(st, t) {
  var tr = M.track, k = st % 16, deg = tr.prog[Math.floor(st / 16) % 4], it = M.intensity;
  var dt = t - ac.currentTime;
  var beat = 60 / tr.bpm;
  if (k === 0) {
    [0, 2, 4].forEach(function (i) { tone(mtof(degNote(tr, deg + i, 1)), beat * 3.8, 'sine', 0.05, 0, dt, musG); });
  }
  if ([0, 3, 6, 8, 10, 13].indexOf(k) >= 0) {
    var f = mtof(degNote(tr, deg, -1));
    tone(f, beat * 0.4, 'sawtooth', 0.07, 0, dt, musG);
    tone(f / 2, beat * 0.45, 'sine', 0.12, 0, dt, musG);
  }
  if (k % 2 === 0 && Math.random() < 0.3 + 0.45 * it) {
    M.walk = AB.clamp(M.walk + AB.randi(-2, 2), 0, 11);
    tone(mtof(degNote(tr, deg + M.walk, 1)), beat * 0.5, 'triangle', 0.06, 0, dt, musG);
  }
  if (k === 0 || k === 8 || (it > 0.5 && (k === 6 || k === 14))) {
    tone(130, 0.14, 'sine', 0.3, -90, dt, musG);
  }
  if ((k === 4 || k === 12) && it > 0.15) noise(0.12, 0.1, 1500, 7000, dt, musG);
  if (k % 2 === 0 || it > 0.7) noise(0.03, 0.03 + 0.03 * it, 6000, 12000, dt, musG);
}
function sched() {
  if (!ac || !M.track || ac.state !== 'running') return;
  var spb = 60 / M.track.bpm / 4;
  if (M.next < ac.currentTime - 0.5) M.next = ac.currentTime + 0.05;
  while (M.next < ac.currentTime + 0.16) {
    playStep(M.step, M.next);
    M.next += spb;
    M.step++;
  }
}
function musicPlay(name) {
  M.want = name;
  if (!ac || !TRACKS[name]) return;
  if (M.cur === name) return;
  M.cur = name; M.track = TRACKS[name]; M.step = 0; M.next = ac.currentTime + 0.1;
  if (!M.timer) M.timer = setInterval(sched, 30);
}
function musicStop() { M.want = null; M.cur = null; M.track = null; }
function setIntensity(v) { M.intensity = AB.clamp(v, 0, 1); }

document.addEventListener('visibilitychange', function () {
  if (!ac) return;
  if (document.hidden) ac.suspend(); else ac.resume();
});

AB.audio = { init: init, resume: resume, applyVol: applyVol, tone: tone, noise: noise, musicPlay: musicPlay, musicStop: musicStop, setIntensity: setIntensity };
})();
