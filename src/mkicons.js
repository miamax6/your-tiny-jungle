const { chromium } = require('playwright');
const fs = require('fs');
(async()=>{
 const svg = fs.readFileSync('icon.svg','utf8');
 const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 for (const size of [192,512,180]){
   const ctx = await b.newContext({viewport:{width:size,height:size}});
   const p = await ctx.newPage();
   await p.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`);
   await p.waitForTimeout(250);
   const name = size===180 ? 'apple-touch-icon.png' : `icon-${size}.png`;
   await p.screenshot({path:'icons/'+name, omitBackground:true});
   await ctx.close();
 }
 await b.close(); console.log('icônes générées');
})();
