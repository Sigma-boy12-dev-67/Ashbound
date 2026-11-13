// Renders the app icons with headless Chromium: node tools/make-icons.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  const draw = (size, maskable) => `(() => {
    const S=${size}, c=document.createElement('canvas'); c.width=c.height=S; const g=c.getContext('2d');
    const bg=g.createRadialGradient(S/2,S*0.62,S*0.05,S/2,S/2,S*0.75); bg.addColorStop(0,'#5a1c08'); bg.addColorStop(0.5,'#1a0a10'); bg.addColorStop(1,'#06030a');
    g.fillStyle=bg; g.fillRect(0,0,S,S);
    const k=${maskable ? 0.62 : 0.8}, u=S*k/16, ox=(S-16*u)/2, oy=(S-16*u)/2;
    // flame
    const F=['.......##.......','......###.......','.....####.......','.....#####......','....#######.....','...#########....','...##########...','..############..','..############..','..############..','..############..','...##########...','...##########...','....########....','.....######.....','......####......'];
    for(let r=0;r<16;r++)for(let q=0;q<16;q++){ if(F[r][q]!=='#')continue; const t=r/15;
      g.fillStyle=t<0.35?'#ffd070':(t<0.65?'#ff8a30':'#d23a14'); g.fillRect(ox+q*u,oy+r*u,Math.ceil(u),Math.ceil(u)); }
    // core
    g.fillStyle='#fff3c8'; for(let r=9;r<14;r++)for(let q=6;q<10;q++) g.fillRect(ox+q*u,oy+r*u,Math.ceil(u),Math.ceil(u));
    // blade
    g.fillStyle='#1a0a10'; g.fillRect(S*0.47,S*0.12,S*0.06,S*0.76);
    return c.toDataURL('image/png').split(',')[1];
  })()`;
  for (const [name, size, m] of [['icon-192.png',192,false],['icon-512.png',512,false],['icon-maskable-512.png',512,true]]) {
    const data = await p.evaluate(draw(size, m));
    require('fs').writeFileSync(path.join(__dirname, '..', 'icons', name), Buffer.from(data, 'base64'));
  }
  await b.close(); console.log('icons written');
})();
