const { chromium } = require('playwright');
const SHOT = process.argv[2] || '/tmp/shots2';
require('fs').mkdirSync(SHOT, { recursive: true });
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('http://localhost:8123/index.html');
  await p.waitForTimeout(800);
  const shot = async n => { await p.screenshot({ path: SHOT + '/' + n + '.png' }); };
  const go = async (scene, arg) => { await p.evaluate(([s, a]) => AB.game.go(s, a), [scene, arg]); await p.waitForTimeout(900); };
  // menu scenes
  await p.evaluate(() => { AB.save.data.embers = 400; AB.save.data.stats.wins = 2; });
  await go('title'); await shot('a-title');
  await go('forge'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await p.waitForTimeout(200); await shot('b-forge');
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(200); await shot('b2-forge-arsenal');
  await go('options', { from: 'title' }); await shot('c-options');
  await go('stats'); await shot('d-stats');
  await go('loadout'); await shot('e-loadout');

  // full run with god mode, visit each boss
  const startRun = async () => {
    await p.evaluate(() => { AB.game.startRun({ w0: 'ashblade', w1: 'hunterbow', sk: 'firebomb' }); });
    await p.waitForTimeout(1200);
    await p.evaluate(() => { const w = AB.game.world; w.modal = null; w.pendingOffer = null; });
  };
  await startRun();
  await p.evaluate(() => { window.__god = setInterval(() => { const w = AB.game.world; if (w) { w.player.hp = w.player.s.maxHp; w.player.invuln = 30; } }, 16); });
  for (let st = 0; st < 3; st++) {
    if (st > 0) {
      await p.evaluate(() => AB.game.stageComplete()); await p.waitForTimeout(1600);
      await p.evaluate(() => { const w = AB.game.world; w.modal = null; });
    }
    await shot('s' + st + '-level');
    // walk through level quickly: teleport near mid and screenshot a middle area
    await p.evaluate(() => { const w = AB.game.world, L = w.level; w.player.x = L.W * 16 * 0.5; w.player.y = 100; });
    await p.waitForTimeout(1500); await shot('s' + st + '-mid');
    // boss
    const info = await p.evaluate(() => { const w = AB.game.world, bs = w.level.boss; w.player.x = bs.x0 + 150; w.player.y = bs.y - 60; return { x0: bs.x0, x1: bs.x1, type: bs.type }; });
    await p.waitForTimeout(2600); await shot('s' + st + '-boss-intro');
    await p.waitForTimeout(2500); await shot('s' + st + '-boss-fight');
    await p.evaluate(() => { const w = AB.game.world; if (w.bossRef) { w.bossRef.hp = w.bossRef.maxHp * 0.45; } });
    await p.waitForTimeout(2800); await shot('s' + st + '-boss-phase2');
    const hp = await p.evaluate(() => { const w = AB.game.world; return w.bossRef ? { hp: Math.round(w.bossRef.hp), ph: w.bossRef.aux && w.bossRef.aux.phase, st: w.bossRef.state } : null; });
    console.log('BOSS', st, info.type, JSON.stringify(hp));
    await p.evaluate(() => { const w = AB.game.world; w.damageEnemy(w.bossRef, 999999, { kx: 0 }); });
    await p.waitForTimeout(1800); await shot('s' + st + '-boss-dead');
    const pr = await p.evaluate(() => { const w = AB.game.world; return { exitOpen: w.exitOpen, bossKills: w.run.bossKills }; });
    console.log('AFTER BOSS', st, JSON.stringify(pr));
  }
  // finish run -> victory
  await p.evaluate(() => AB.game.stageComplete()); await p.waitForTimeout(2200);
  await shot('v-victory');
  console.log('SCENE', await p.evaluate(() => AB.game.name), JSON.stringify(await p.evaluate(() => AB.save.data.stats)));
  // death flow
  await p.evaluate(() => clearInterval(window.__god));
  await go('loadout'); await startRun();
  await p.evaluate(() => { const w = AB.game.world; w.modal = null; w.player.s.revive = 0; w.hurtPlayer(99999, w.player.x, {}); });
  await p.waitForTimeout(3500); await shot('x-death');
  await p.waitForTimeout(3500); await shot('y-results');
  console.log('SCENE', await p.evaluate(() => AB.game.name));
  console.log(errs.length ? 'ERRORS:\n' + errs.slice(0, 10).join('\n') : 'NO ERRORS');
  await b.close();
})();
