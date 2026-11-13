const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('http://localhost:8123/index.html'); await p.waitForTimeout(1200);
  await p.evaluate(() => { AB.scenes.title.menu.items.forEach(i => { i.hidden = true; }); AB.game.t = 520; });
  await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/title-nomenu.png' });
  await b.close();
})();
