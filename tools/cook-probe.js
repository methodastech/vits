const {chromium}=require('/private/tmp/claude-501/-Users-zieel-Bazil-Claude-3-Websites/4842f4cf-9888-44bf-970b-c41dfebe81ef/scratchpad/node_modules/playwright-core');
const fs=require('fs'), os=require('os'), path=require('path');
(async()=>{
  const [url,W='390',H='844']=process.argv.slice(2);
  const exe=path.join(os.homedir(),'Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
  const b=await chromium.launch({headless:false,executablePath:fs.existsSync(exe)?exe:undefined,args:['--window-position=460,40']});
  const ctx=await b.newContext({viewport:{width:+W,height:+H},deviceScaleFactor:1});
  const pg=await ctx.newPage();
  await pg.goto(url,{waitUntil:'load',timeout:60000});
  await pg.waitForFunction(()=>typeof window.__packFrame==='function',null,{timeout:90000});
  await pg.waitForTimeout(2500);
  const cookTop=await pg.evaluate(()=>(document.getElementById('cook').getBoundingClientRect().top+scrollY)/innerHeight);
  await pg.mouse.move(+W/2,+H/2);
  const out=[]; let y=0;
  for(const d of [-0.4,-0.1,0.05,0.2,0.4,0.7,1.0]){
    const target=Math.round((cookTop+d)*+H);
    while(Math.abs(y-target)>12){ await pg.mouse.wheel(0,Math.max(-240,Math.min(240,(target-y)*0.6))); await pg.waitForTimeout(110); y=await pg.evaluate(()=>scrollY); }
    let last=-1; for(let k=0;k<20;k++){ await pg.waitForTimeout(150); y=await pg.evaluate(()=>scrollY); if(Math.abs(y-last)<1) break; last=y; }
    await pg.waitForTimeout(500);
    out.push(await pg.evaluate(d=>{
      const R=el=>{ if(!el) return null; const q=el.getBoundingClientRect(); return [Math.round(q.top),Math.round(q.bottom)]; };
      const bx=k=>{ const b=window[k]; return (b&&b.w>8)?[Math.round(b.y-b.h/2),Math.round(b.y+b.h/2)]:null; };
      const cap=[...document.querySelectorAll('.ccap')].map(c=>[+getComputedStyle(c).opacity.slice(0,4),R(c)]).filter(c=>c[0]>0.1);
      return {d,sc:+(scrollY/innerHeight).toFixed(2),cook:+(+window.__ph.cook).toFixed(3),cookOn:window.__ph.cookOn,pack:bx('__packBox'),bowl:bx('__bowlBox'),type:R(document.querySelector('.cookType .l')),caps:cap};
    },d));
  }
  console.log(JSON.stringify({cookTop:+cookTop.toFixed(2),out},null,1));
  await b.close();
})().catch(e=>{ console.error('FAIL',e); process.exit(1); });
