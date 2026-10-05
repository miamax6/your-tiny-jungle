/* Génère les icônes PNG à partir de icon.svg.
   - icon-192 / icon-512      : tuile arrondie, coins transparents ("any")
   - maskable-192 / -512      : fond plein + dessin réduit, pour que le
                                masque d'Android (cercle, goutte…) ne rogne
                                rien : zone de sécurité = disque central de
                                80 % de la largeur
   - apple-touch-icon (180)   : fond plein (iOS remplit le transparent en noir)
   Lancer depuis n'importe où : les chemins partent de ce fichier. */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SRC = __dirname, OUT = path.join(__dirname, '..', 'icons');
const raw = fs.readFileSync(path.join(SRC, 'icon.svg'), 'utf8');
const inner = raw.replace(/<metadata>[\s\S]*?<\/metadata>/, '')
                 .replace(/<svg[^>]*>/, '').replace('</svg>', '')
                 .replace(/<rect width="512" height="512"[^>]*\/>/, '');
/* Le dessin occupe x 118→378, y 62→486 : centre (248, 274). */
const tile = scale => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#f5ead8"/><g transform="translate(256 256) scale(${scale}) translate(-248 -274)">${inner}</g></svg>`;
const JOBS = [
  { name:'icon-192.png',        size:192, svg: raw,        transparent:true },
  { name:'icon-512.png',        size:512, svg: raw,        transparent:true },
  { name:'maskable-192.png',    size:192, svg: tile(0.80), transparent:false },
  { name:'maskable-512.png',    size:512, svg: tile(0.80), transparent:false },
  { name:'apple-touch-icon.png',size:180, svg: tile(0.86), transparent:false },
];
(async()=>{
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  for (const j of JOBS){
    const ctx = await b.newContext({viewport:{width:j.size,height:j.size}});
    const p = await ctx.newPage();
    await p.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${j.size}px;height:${j.size}px;display:block}</style>${j.svg}`);
    await p.waitForTimeout(250);
    await p.screenshot({path:path.join(OUT,j.name), omitBackground:j.transparent});
    await ctx.close();
  }
  await b.close(); console.log('icônes générées');
})();
