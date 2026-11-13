(function () {
'use strict';
var AB = window.AB;

function fit() {
  var cv = document.getElementById('game'), w = window.innerWidth, h = window.innerHeight;
  var s = Math.min(w / AB.W, h / AB.H), si = Math.floor(s);
  if (si >= 1 && s / si < 1.15) s = si;           // prefer crisp integer scaling when it costs little screen
  cv.style.width = Math.floor(AB.W * s) + 'px'; cv.style.height = Math.floor(AB.H * s) + 'px';
  var portrait = h > w * 1.05;
  document.getElementById('rotate').classList.toggle('hidden', !portrait);
}

AB.canFullscreen = function () {
  var e = document.documentElement;
  return !!(e.requestFullscreen || e.webkitRequestFullscreen) && !window.__noFullscreen;
};
AB.isFullscreen = function () { return !!(document.fullscreenElement || document.webkitFullscreenElement); };
AB.toggleFullscreen = function () {
  var d = document, e = d.documentElement;
  try {
    if (AB.isFullscreen()) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); }
    else { (e.requestFullscreen || e.webkitRequestFullscreen).call(e); }
  } catch (x) { /* ignore */ }
};

function boot() {
  AB.save.load();
  AB.input.refreshTouchMode();
  AB.initInput();
  var cv = document.getElementById('game');
  cv.width = AB.W; cv.height = AB.H;
  var game = new AB.Game(cv);
  fit();
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', function () { setTimeout(fit, 200); });
  document.addEventListener('fullscreenchange', fit);
  document.addEventListener('visibilitychange', function () { if (document.hidden) game.autoPause(); });
  window.addEventListener('blur', function () { game.autoPause(); });

  game.setScene('title');
  var step = 1000 / 60, acc = 0, last = performance.now();
  function frame(now) {
    acc += Math.min(100, now - last); last = now;
    var guard = 0;
    while (acc >= step && guard++ < 6) { game.tick(); acc -= step; }
    game.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  var ld = document.getElementById('loading'); if (ld) ld.remove();

  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* offline cache is optional */ });
  }
}
window.addEventListener('load', boot);
})();
