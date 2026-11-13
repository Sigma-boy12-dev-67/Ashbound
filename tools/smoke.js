const { chromium } = require('playwright');
const SHOT = process.argv[2] || '/tmp/shots';
require('fs').mkdirSync(SHOT, { recursive: true });
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('http://localhost:8123/index.html');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: SHOT + '/01-title.png' });
  const key = async (k, n = 1, d = 60) => { for (let i = 0; i < n; i++) { await p.keyboard.press(k); await p.waitForTimeout(d); } };
  await key('Enter'); await p.waitForTimeout(700);           // -> loadout
  await p.screenshot({ path: SHOT + '/02-loadout.png' });
  await key('ArrowDown', 4); await key('Enter'); await p.waitForTimeout(1200); // begin
  await p.screenshot({ path: SHOT + '/03-play-start.png' });
  await p.waitForTimeout(2500);
  await p.keyboard.press('Enter'); await p.waitForTimeout(400);  // maybe free boon modal
  await p.screenshot({ path: SHOT + '/04-after-offer.png' });
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  // run right and fight
  await p.keyboard.down('KeyD');
  for (let i = 0; i < 40; i++) { await p.keyboard.press('Space'); await p.keyboard.press('KeyJ'); await p.waitForTimeout(150); if (i % 7 === 0) await p.keyboard.press('ShiftLeft'); }
  await p.screenshot({ path: SHOT + '/05-play-moving.png' });
  for (let i = 0; i < 60; i++) { await p.keyboard.press('KeyJ'); await p.keyboard.press('KeyU'); await p.waitForTimeout(120); }
  await p.keyboard.up('KeyD');
  await p.screenshot({ path: SHOT + '/06-play-fight.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await p.screenshot({ path: SHOT + '/07-pause.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  const st = await p.evaluate(() => { const g = AB.game, w = g.world; return w ? { stage: w.stage, hp: w.player.hp, x: Math.round(w.player.x), enemies: w.enemies.length, t: w.t, scene: g.name } : { scene: g.name }; });
  console.log('STATE', JSON.stringify(st));
  console.log(errs.length ? 'ERRORS:\n' + errs.slice(0, 8).join('\n') : 'NO ERRORS');
  await b.close();
})();
