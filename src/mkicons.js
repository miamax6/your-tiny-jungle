/* Génère toutes les icônes à partir du logo de la page (celui du héros :
   3 feuilles, tige, pot carré aux coins arrondis) — même dessin, mêmes
   couleurs, mêmes coordonnées que dans part2_body.html.

   Sorties (relatives à ce fichier) :
   - ../icons/icon-192.png, icon-512.png   tuile arrondie, coins transparents ("any")
   - ../icons/maskable-192.png, -512.png   fond plein, dessin dans le disque central
                                           (zone de sécurité Android = 40 % du côté
                                           de rayon ; on vise 30 % pour les masques
                                           serrés type Samsung One UI)
   - ../icons/apple-touch-icon.png (180)   fond plein (iOS remplit le transparent en noir)
   - icon.svg, ../icons/icon.svg           version vectorielle de la tuile "any"
   - favicon-data-uri.txt                  à recoller dans <link rel="icon"> */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SRC = __dirname, OUT = path.join(__dirname, '..', 'icons');

/* Dessin du héros, viewBox 144 24 96 172. Centre visuel ≈ (192, 110). */
const ART = `
<path d="M190 140 L190 65" stroke="#272e1b" stroke-width="5" fill="none"/>
<path d="M190 102 Q148 80 154 28 Q197 39 190 102 Z" fill="#56633f"/>
<path d="M190 118 Q230 102 236 62 Q197 67 190 118 Z" fill="#8fa073"/>
<path d="M190 123 Q160 108 152 78 Q184 84 190 123 Z" fill="#728157"/>
<rect x="160" y="130" width="60" height="62" rx="20" fill="#3d472b"/>`;
const BG = '#f5ead8';
/* scale : hauteur du dessin (164 unités) ≈ scale*164 px sur 512. */
const tile = (scale, rx) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512"${rx ? ` rx="${rx}"` : ''} fill="${BG}"/><g transform="translate(256 256) scale(${scale}) translate(-192 -110)">${ART}</g></svg>`;

const ANY = tile(2.1, 112);      // dessin ≈ 67 % de la hauteur
const MASK = tile(1.7, 0);       // rayon max ≈ 0.30 du côté
const APPLE = tile(2.0, 0);

fs.writeFileSync(path.join(SRC, 'icon.svg'), ANY + '\n');
fs.writeFileSync(path.join(OUT, 'icon.svg'), ANY + '\n');
/* Favicon : onglet de navigateur, dessin plus grand pour rester lisible à 16 px. */
fs.writeFileSync(path.join(SRC, 'favicon-data-uri.txt'),
  'data:image/svg+xml,' + encodeURIComponent(tile(2.5, 112).replace(/\s*\n\s*/g, '')) + '\n');

const JOBS = [
  { name:'icon-192.png',         size:192, svg: ANY,   transparent:true  },
  { name:'icon-512.png',         size:512, svg: ANY,   transparent:true  },
  { name:'maskable-192.png',     size:192, svg: MASK,  transparent:false },
  { name:'maskable-512.png',     size:512, svg: MASK,  transparent:false },
  { name:'apple-touch-icon.png', size:180, svg: APPLE, transparent:false },
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
