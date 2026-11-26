/* Ashbound offline cache. Bump VERSION whenever any game file changes. */
var VERSION = 'ashbound-v1.6.2';
var FILES = ['./', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'js/util.js', 'js/save.js', 'js/input.js', 'js/audio.js', 'js/sprites.js', 'js/gfx.js', 'js/data.js', 'js/level.js', 'js/render.js',
  'js/entities.js', 'js/playerdraw.js', 'js/warrior.js', 'js/enemies.js', 'js/stages.js', 'js/bosses.js', 'js/malphas.js', 'js/bosses2.js', 'js/world.js', 'js/worlddraw.js', 'js/carpotion.js', 'js/adminconfig.js', 'js/admin.js',
  'js/hud.js', 'js/modals.js', 'js/ui.js', 'js/netconfig.js', 'js/net.js', 'js/online.js', 'js/onlineui.js', 'js/game.js', 'js/main.js'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return Promise.all(FILES.map(function (f) { return fetch(new Request(f, { cache: 'reload' })).then(function (r) { if (!r.ok) throw new Error(f); return c.put(f, r); }); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  /* adminconfig.js holds your admin password hash and gets edited without a game release: always try the network first */
  if (/\/js\/(adminconfig|netconfig)\.js$/.test(new URL(e.request.url).pathname)) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }).catch(function () { return caches.match(e.request); }));
    return;
  }
  e.respondWith(caches.match(e.request).then(function (hit) { return hit || fetch(e.request); }));
});
