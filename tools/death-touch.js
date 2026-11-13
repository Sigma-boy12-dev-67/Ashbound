const { chromium, devices } = require('playwright');
const SHOT = '/tmp/shots3'; require('fs').mkdirSync(SHOT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const errs = [];
  // ---- desktop: death flow + fixed screens
  let p = await b.newPage({ viewport: { width: 960, height: 540 } });
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await p.goto('http://localhost:8123/index.html'); await p.waitForTimeout(800);
  const go = async (s, a) => { await p.evaluate(([s, a]) => AB.game.go(s, a), [s, a]); await p.waitForTimeout(900); };
  await p.evaluate(() => { AB.save.data.stats.wins = 2; AB.save.data.embers = 300; });
  await go('title'); await p.screenshot({ path: SHOT + '/title.png' });
  await go('forge'); await p.screenshot({ path: SHOT + '/forge.png' });
  await go('loadout'); await p.screenshot({ path: SHOT + '/loadout.png' });
  await p.evaluate(() => AB.game.startRun({ w0: 'ashblade', w1: 'hunterbow', sk: 'firebomb' })); await p.waitForTimeout(1500);
  await p.evaluate(() => { const w = AB.game.world; w.modal = null; w.player.invuln = 0; w.player.s.revive = 0; w.over = false; });
  await p.waitForTimeout(600);
  await p.evaluate(() => { const w = AB.game.world; w.player.invuln = 0; w.player.hp = 1; w.hurtPlayer(99999, w.player.x - 20, {}); });
  await p.waitForTimeout(3000); await p.screenshot({ path: SHOT + '/death.png' });
  await p.waitForTimeout(4000);
  console.log('after death scene =', await p.evaluate(() => AB.game.name), 'stats', JSON.stringify(await p.evaluate(() => AB.save.data.stats)));
  await p.screenshot({ path: SHOT + '/results.png' });
  await p.close();

  // ---- phone landscape with touch controls
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  p = await ctx.newPage();
  p.on('pageerror', e => errs.push('TOUCH PAGEERROR ' + e.message));
  await p.goto('http://localhost:8123/index.html'); await p.waitForTimeout(900);
  await p.screenshot({ path: SHOT + '/phone-title.png' });
  const tap = async (x, y) => { await p.touchscreen.tap(x, y); await p.waitForTimeout(400); };
  const box = await p.locator('#game').boundingBox();
  const cx = box.x + box.width / 2, sy = (v) => box.y + v / 270 * box.height;
  await tap(cx, sy(134 + 6));                 // DESCEND
  await p.waitForTimeout(800); await p.screenshot({ path: SHOT + '/phone-loadout.png' });
  await tap(cx, sy(58 + 17 * 3 + 6));         // BEGIN
  await p.waitForTimeout(2500); await p.screenshot({ path: SHOT + '/phone-play.png' });
  const vis = await p.evaluate(() => ({ touchVisible: !document.getElementById('touch').classList.contains('hidden'), touchOn: AB.input.touchOn, scene: AB.game.name, modal: !!(AB.game.world && AB.game.world.modal) }));
  console.log('PHONE', JSON.stringify(vis));
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'NO ERRORS');
  await b.close();
})();
