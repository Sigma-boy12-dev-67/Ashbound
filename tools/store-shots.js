const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, '..', 'store'); require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8123/index.html'); await p.waitForTimeout(1000);
  const shot = async n => { await p.waitForTimeout(250); await p.screenshot({ path: OUT + '/' + n + '.png' }); };
  const go = async (s, a) => { await p.evaluate(([s, a]) => AB.game.go(s, a), [s, a]); await p.waitForTimeout(1000); };
  const key = (c, d) => p.evaluate(([c, d]) => window.dispatchEvent(new KeyboardEvent(d ? 'keydown' : 'keyup', { code: c })), [c, d]);
  await p.evaluate(() => { AB.save.data.embers = 420; AB.save.data.stats.wins = 1; AB.save.data.seenTut = true; });
  await shot('screenshot-1-title');
  const start = async (st) => {
    await p.evaluate(() => AB.game.startRun({ w0: 'ashblade', w1: 'hunterbow', sk: 'firebomb' })); await p.waitForTimeout(1500);
    await p.evaluate((st) => { const g = AB.game; g.world.modal = null; g.run.gold = 340; g.run.embers = 24; g.run.stats.crit = 0.1; for (let i = 0; i < st; i++) { g.world = new AB.World(g, g.run, i + 1); } g.world.modal = null; g.world.pendingOffer = null; g.world.t = 5000; }, st);
    await p.waitForTimeout(800);
  };
  const god = () => p.evaluate(() => { window.__god = setInterval(() => { const w = AB.game.world; if (w) { w.player.hp = Math.max(w.player.hp, w.player.s.maxHp * 0.7); } }, 16); });
  // stage 1 combat
  await start(0); await god();
  await p.evaluate(() => { const w = AB.game.world, T = 16; w.player.x = 60 * T; w.player.y = 20 * T; });
  await key('KeyD', true); for (let i = 0; i < 30; i++) { await key('KeyJ', true); await p.waitForTimeout(90); await key('KeyJ', false); await p.waitForTimeout(60); if (i % 8 === 0) { await key('Space', true); await p.waitForTimeout(200); await key('Space', false); } }
  await key('KeyD', false); await shot('screenshot-2-crypt');
  // altar modal
  await p.evaluate(() => { const w = AB.game.world; const offers = AB.BOONS.filter(b => ['searing', 'exec', 'phoenix'].includes(b.id)); w.modal = { type: 'altar', it: { offers: offers, free: false }, sel: 1, t: 20 }; });
  await shot('screenshot-3-boons'); await p.evaluate(() => { AB.game.world.modal = null; });
  // each boss
  const names = ['4-gravewarden', '5-smelter', '6-sovereign'];
  for (let st = 0; st < 3; st++) {
    await p.evaluate(() => clearInterval(window.__god));
    await start(st); await god();
    await p.evaluate(() => { const w = AB.game.world, bs = w.level.boss; w.player.x = bs.x0 + 150; w.player.y = bs.y - 60; });
    await p.waitForTimeout(3800);
    await key('KeyD', true); for (let i = 0; i < 10; i++) { await key('KeyJ', true); await p.waitForTimeout(100); await key('KeyJ', false); await p.waitForTimeout(80); }
    await key('KeyD', false); await key('KeyA', true); await p.waitForTimeout(250); await key('KeyA', false);
    await shot('screenshot-' + names[st]);
  }
  await p.evaluate(() => clearInterval(window.__god));
  await go('forge'); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(300); await shot('screenshot-7-forge');
  await go('title'); await p.waitForTimeout(600); await shot('title-raw');
  console.log(errs.length ? 'ERRORS ' + errs.join('|') : 'NO ERRORS'); await b.close();
})();
