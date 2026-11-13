(function () {
'use strict';
var AB = window.AB;
var ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'secondary', 'skill1', 'skill2', 'roll', 'interact', 'heal', 'potion', 'pause', 'confirm', 'back'];
var held = {}, pressed = {}, released = {};
ACTIONS.forEach(function (a) { held[a] = {}; pressed[a] = false; released[a] = false; });

function isDown(a) { var h = held[a]; return !!(h.kb || h.pad || h.touch); }
function setSrc(a, src, v) {
  var prev = isDown(a);
  held[a][src] = v;
  var now = isDown(a);
  if (!prev && now) pressed[a] = true;
  if (prev && !now) released[a] = true;
}

var KEYS = {
  ArrowLeft: ['left'], KeyA: ['left'], ArrowRight: ['right'], KeyD: ['right'],
  ArrowUp: ['up', 'jump'], KeyW: ['up', 'jump'], ArrowDown: ['down'], KeyS: ['down'],
  Space: ['jump', 'confirm'], Enter: ['confirm'],
  KeyJ: ['attack', 'confirm'], KeyZ: ['attack', 'confirm'],
  KeyK: ['secondary'], KeyX: ['secondary'],
  KeyU: ['skill1'], KeyQ: ['skill1'], KeyI: ['skill2'], KeyR: ['skill2'],
  ShiftLeft: ['roll'], ShiftRight: ['roll'], KeyL: ['roll'], KeyV: ['roll'],
  KeyE: ['interact'], KeyF: ['interact'], KeyH: ['heal'], KeyG: ['heal'], KeyC: ['potion'], KeyB: ['potion'],
  Escape: ['pause', 'back'], KeyP: ['pause'], Backspace: ['back']
};

var I = AB.input = {
  pointer: { x: 0, y: 0, down: false, clicked: false, moved: false },
  lastDevice: 'kb',
  touchOn: false,
  isDown: isDown,
  pressed: function (a) { return pressed[a]; },
  released: function (a) { return released[a]; },
  consume: function (a) { pressed[a] = false; },
  endStep: function () {
    for (var i = 0; i < ACTIONS.length; i++) { pressed[ACTIONS[i]] = false; released[ACTIONS[i]] = false; }
    I.pointer.clicked = false; I.pointer.moved = false;
  },
  clearAll: function () {
    ACTIONS.forEach(function (a) { held[a] = {}; pressed[a] = false; released[a] = false; });
  },
  poll: function () {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    var gp = null;
    for (var i = 0; i < pads.length; i++) { if (pads[i] && pads[i].connected) { gp = pads[i]; break; } }
    var st = {};
    if (gp) {
      var b = function (n) { return gp.buttons[n] && gp.buttons[n].pressed; };
      var ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      st.left = ax < -0.4 || b(14); st.right = ax > 0.4 || b(15);
      st.up = ay < -0.55 || b(12); st.down = ay > 0.55 || b(13);
      st.jump = b(0); st.confirm = b(0); st.roll = b(1); st.back = b(1) || b(8);
      st.attack = b(2); st.secondary = b(3); st.interact = b(4); st.skill1 = b(5);
      st.heal = b(6); st.skill2 = b(7); st.pause = b(9); st.potion = b(10) || b(11);
      var any = false;
      for (var k in st) if (st[k]) any = true;
      if (any) I.lastDevice = 'pad';
    }
    for (var j = 0; j < ACTIONS.length; j++) setSrc(ACTIONS[j], 'pad', !!st[ACTIONS[j]]);
  },
  vibrate: function (ms) {
    try { if (AB.save.data.opt.vib && navigator.vibrate && I.touchOn) navigator.vibrate(ms); } catch (e) { /* ignore */ }
  },
  setTouchVisible: function (v) {
    var el = document.getElementById('touch');
    if (!el) return;
    var show = v && I.touchOn;
    el.classList.toggle('hidden', !show);
  },
  refreshTouchMode: function () {
    var mode = AB.save.data.opt.touch;
    var coarse = false;
    try { coarse = (window.matchMedia && window.matchMedia('(pointer:coarse)').matches) || ('ontouchstart' in window); } catch (e) { /* ignore */ }
    I.touchOn = mode === 'on' || (mode === 'auto' && coarse);
    if (I.touchOn) I.lastDevice = 'touch';
  }
};

function onKey(e, v) {
  var acts = KEYS[e.code];
  if (!acts) return;
  e.preventDefault();
  if (v && e.repeat) return;
  I.lastDevice = 'kb';
  for (var i = 0; i < acts.length; i++) setSrc(acts[i], 'kb', v);
}
window.addEventListener('keydown', function (e) { onKey(e, true); if (AB.audio) AB.audio.resume(); });
window.addEventListener('keyup', function (e) { onKey(e, false); });
window.addEventListener('blur', function () { I.clearAll(); });

function canvasPos(e) {
  var c = document.getElementById('game');
  var r = c.getBoundingClientRect();
  I.pointer.x = (e.clientX - r.left) / r.width * AB.W;
  I.pointer.y = (e.clientY - r.top) / r.height * AB.H;
}

AB.initInput = function () {
  var c = document.getElementById('game');
  c.addEventListener('pointerdown', function (e) {
    if (AB.audio) AB.audio.resume();
    canvasPos(e); I.pointer.down = true; I.pointer.clicked = true;
    if (e.pointerType === 'touch') I.lastDevice = 'touch';
  });
  c.addEventListener('pointermove', function (e) { canvasPos(e); I.pointer.moved = true; });
  window.addEventListener('pointerup', function () { I.pointer.down = false; });

  var root = document.getElementById('touch');
  if (!root) return;
  var btns = root.querySelectorAll('[data-a]');
  Array.prototype.forEach.call(btns, function (el) {
    var a = el.getAttribute('data-a');
    var on = function (e) {
      e.preventDefault();
      if (AB.audio) AB.audio.resume();
      try { el.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      el.classList.add('on'); setSrc(a, 'touch', true); I.lastDevice = 'touch';
    };
    var off = function (e) { e.preventDefault(); el.classList.remove('on'); setSrc(a, 'touch', false); };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('lostpointercapture', off);
  });

  var stick = document.getElementById('stick'), knob = document.getElementById('knob');
  var sid = null, ox = 0, oy = 0, R = 40;
  function sMove(e) {
    var nx = (e.clientX - ox) / R, ny = (e.clientY - oy) / R;
    var len = Math.sqrt(nx * nx + ny * ny);
    if (len > 1) { nx /= len; ny /= len; }
    knob.style.transform = 'translate(' + (nx * R * 0.7) + 'px,' + (ny * R * 0.7) + 'px)';
    setSrc('left', 'touch', nx < -0.28); setSrc('right', 'touch', nx > 0.28);
    setSrc('up', 'touch', ny < -0.6); setSrc('down', 'touch', ny > 0.6);
  }
  function sEnd() {
    sid = null; knob.style.transform = 'translate(0,0)';
    setSrc('left', 'touch', false); setSrc('right', 'touch', false);
    setSrc('up', 'touch', false); setSrc('down', 'touch', false);
  }
  stick.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (AB.audio) AB.audio.resume();
    sid = e.pointerId;
    try { stick.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    var r = stick.getBoundingClientRect();
    ox = r.left + r.width / 2; oy = r.top + r.height / 2; R = r.width / 2;
    I.lastDevice = 'touch'; sMove(e);
  });
  stick.addEventListener('pointermove', function (e) { if (e.pointerId === sid) { e.preventDefault(); sMove(e); } });
  stick.addEventListener('pointerup', sEnd);
  stick.addEventListener('pointercancel', sEnd);
  stick.addEventListener('lostpointercapture', sEnd);
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
};
})();
