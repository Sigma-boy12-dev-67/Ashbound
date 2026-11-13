const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('http://localhost:8123/index.html'); await p.waitForTimeout(800);
  const r = await p.evaluate(() => {
    const out = [];
    for (let bi = 0; bi < 3; bi++) {
      const s = { bi, n: 0, maxUp: 0, maxDown: 0, maxPit: 0, minHead: 99, unplatPits: 0, pits: 0, genMs: 0, maxW: 0, noBoss: 0, errs: 0 };
      for (let k = 0; k < 300; k++) {
        const t0 = performance.now();
        let L; try { L = new AB.Level(bi, bi, 1000 + k * 7919); } catch (e) { s.errs++; continue; }
        s.genMs += performance.now() - t0; s.n++; s.maxW = Math.max(s.maxW, L.W);
        if (!L.boss) s.noBoss++;
        // scan columns using real tiles: surface row = first solid/oneway-free ground
        const T = AB.TILE; let prevTop = null, run = 0;
        const surf = x => { for (let y = 0; y < L.H; y++) { const t = L.tileAt(x, y); if (t === T.SOLID && y > 0 && L.tileAt(x, y - 1) !== T.SOLID && L.tileAt(x, y - 1) !== T.GATE) { if (y > 6) return y; } } return null; };
        for (let x = 3; x < L.W - 3; x++) {
          const g = L.GY[x], pit = L.PIT[x], cl = L.CL[x];
          if (g !== undefined && cl !== undefined) s.minHead = Math.min(s.minHead, g - cl);
          if (g !== undefined && L.GY[x - 1] !== undefined && !pit && !L.PIT[x - 1]) { const d = L.GY[x - 1] - g; if (d > 0) s.maxUp = Math.max(s.maxUp, d); else s.maxDown = Math.max(s.maxDown, -d); }
          if (pit) { run++; } else { if (run) { s.pits++; s.maxPit = Math.max(s.maxPit, run); // is there a one-way platform within the pit span?
              let has = false; for (const pl of L.plats) if (pl.x0 <= x && pl.x1 >= x - run - 1 || (pl.x1 >= x - run - 1 && pl.x0 <= x)) { if (Math.abs(pl.y - L.GY[x]) <= 6) { has = true; break; } }
              if (!has) s.unplatPits++; run = 0; } }
        }
      }
      s.genMs = Math.round(s.genMs / Math.max(1, s.n)); out.push(s);
    }
    return out;
  });
  r.forEach(s => console.log(JSON.stringify(s)));
  await b.close();
})();
