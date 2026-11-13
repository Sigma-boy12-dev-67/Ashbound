/* Ashbound offline cache. Bump VERSION whenever any game file changes. */
var VERSION = 'ashbound-v1.0.0';
var FILES = ['./', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'js/util.js', 'js/save.js', 'js/input.js', 'js/audio.js', 'js/gfx.js', 'js/data.js', 'js/level.js', 'js/render.js',
  'js/entities.js', 'js/playerdraw.js', 'js/enemies.js', 'js/bosses.js', 'js/world.js', 'js/worlddraw.js',
  'js/hud.js', 'js/modals.js', 'js/ui.js', 'js/game.js', 'js/main.js'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(function (hit) { return hit || fetch(e.request); }));
});
