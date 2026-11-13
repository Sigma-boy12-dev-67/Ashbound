// Copies the game into ./www (the folder Capacitor packages). Run: node tools/build-www.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'www');
const items = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons'];
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
for (const it of items) fs.cpSync(path.join(root, it), path.join(out, it), { recursive: true });
// verify every script referenced by index.html exists
const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
const missing = [...html.matchAll(/src="([^"]+)"/g)].map(m => m[1]).filter(f => !fs.existsSync(path.join(out, f)));
if (missing.length) { console.error('MISSING:', missing.join(', ')); process.exit(1); }
let n = 0; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : n++; } })(out);
console.log('www ready: ' + n + ' files');
