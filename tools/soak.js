const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  await p.goto('http://localhost:8123/index.html'); await p.waitForTimeout(800);
  await p.evaluate(() => { AB.game.startRun({ w0: 'ashblade', w1: 'hunterbow', sk: 'firebomb' }); });
  await p.waitForTimeout(1500);
  for (let stage = 0; stage < 3; stage++) {
    if (stage > 0) { await p.evaluate(() => AB.game.stageComplete()); await p.waitForTimeout(1800); }
    const r = await p.evaluate(() => {
      const g = AB.game, W = () => g.world, key = (c, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code: c }));
      const out = { maxX: 0, nan: 0, maxProj: 0, maxPart: 0, maxEnemies: 0, modals: 0, deaths: 0 };
      let dirKey = 'KeyD'; key(dirKey, true);
      for (let i = 0; i < 14000; i++) {
        const w = W(); if (!w) break;
        if (w.modal) { out.modals++; w.modal = null; }
        const p = w.player;
        if (i % 10 === 0) { let best = null, bd = 1e9; for (const e of w.enemies) { if (e.dead || e.boss && 0) continue; const d = Math.abs(e.x - p.x); if (d < bd) { bd = d; best = e; } } const want = (best && bd < 260 && bd > 18) ? (best.x < p.x ? 'KeyA' : 'KeyD') : 'KeyD'; if (want !== dirKey) { key(dirKey, false); dirKey = want; key(dirKey, true); } }
        p.hp = p.s.maxHp;                       // god mode: soak-test the simulation, not the balance
        if (i % 36 === 0) key('Space', true); if (i % 36 === 22) key('Space', false);
        if (i % 9 === 0) key('KeyJ', true); if (i % 9 === 4) key('KeyJ', false);
        if (i % 300 === 0) { key('KeyU', true); key('KeyU', false); }
        if (i % 90 === 45) { key('KeyE', true); key('KeyE', false); }
        if (i % 500 === 250) { key('ShiftLeft', true); key('ShiftLeft', false); }
        g.tick();
        if (!isFinite(p.x) || !isFinite(p.y)) out.nan++;
        out.maxX = Math.max(out.maxX, Math.round(p.x));
        out.maxProj = Math.max(out.maxProj, w.projs.length); out.maxPart = Math.max(out.maxPart, w.parts ? w.parts.length : 0); out.maxEnemies = Math.max(out.maxEnemies, w.enemies.length);
      }
      key('KeyD', false); key('KeyA', false); key('Space', false); key('KeyJ', false);
      const w = W(); out.levelW = w.level.W * 16; out.kills = w.run.kills; out.gold = w.run.gold; out.t = w.t; out.arena = w.level.arenas.map(a => a.state).join(''); out.boss = w.level.boss.state; out.maxXtiles = Math.round(out.maxX / 16); out.scene = g.name;
      return out;
    });
    console.log('STAGE', stage, JSON.stringify(r));
  }
  console.log(errs.length ? 'ERRORS:\n' + errs.slice(0, 6).join('\n') : 'NO ERRORS');
  await b.close();
})();
