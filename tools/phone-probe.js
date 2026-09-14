// Headed probe: load at a phone size and DPR 2, scroll to a screen, dump items past the frame.
//   node tools/phone-probe.js <url> <screens> [width] [height]
const {chromium}=require('/private/tmp/claude-501/-Users-zieel-Bazil-Claude-3-Websites/4842f4cf-9888-44bf-970b-c41dfebe81ef/scratchpad/node_modules/playwright-core');
const fs=require('fs'), os=require('os'), path=require('path');
(async()=>{
  const [url,SC='7.7',W='390',H='844',SHOT='']=process.argv.slice(2);
  const exe=path.join(os.homedir(),'Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
  const b=await chromium.launch({headless:false,executablePath:fs.existsSync(exe)?exe:undefined,args:['--window-position=460,40']});
  const ctx=await b.newContext({viewport:{width:+W,height:+H},deviceScaleFactor:2});
  const pg=await ctx.newPage();
  await pg.goto(url,{waitUntil:'load',timeout:60000});
  await pg.waitForFunction(()=>typeof window.__packFrame==='function',null,{timeout:90000});
  await pg.waitForTimeout(2500);
  await pg.mouse.move(+W/2,+H/2);
  const target=Math.round(+SC*+H); let y=0;
  while(y<target-10){ await pg.mouse.wheel(0,Math.min(200,Math.max(50,(target-y)*0.6))); await pg.waitForTimeout(110); y=await pg.evaluate(()=>scrollY); }
  await pg.waitForTimeout(1800);
  const out=await pg.evaluate(()=>{
    const W=innerWidth, R=el=>{const q=el.getBoundingClientRect(); return [Math.round(q.left),Math.round(q.right),Math.round(q.width),Math.round(q.top)];};
    const items=[...document.querySelectorAll('.bPile>.bItem')].filter(el=>!el.classList.contains('bBatten'));
    const bad=[];
    for(const el of items){ const q=el.getBoundingClientRect(); if(q.width<4||q.bottom<0||q.top>innerHeight) continue; const im=el.querySelector('img'); const qi=im?im.getBoundingClientRect():q; const l=Math.min(q.left,qi.left), r=Math.max(q.right,qi.right); if(l<0||r>W){ bad.push({cls:el.className.slice(0,22),cap:((el.querySelector('figcaption')||{}).textContent||'').trim().slice(0,20),el:R(el),img:im?R(im):null,fit:el.style.getPropertyValue('--fit'),w:getComputedStyle(el).width,imgW:im?getComputedStyle(im).width:null,tf:getComputedStyle(el).transform.slice(0,50)}); } }
    return {W,dpr:devicePixelRatio,y:scrollY,bad};
  });
  if(SHOT) await pg.screenshot({path:SHOT});
  console.log(JSON.stringify(out,null,1));
  await b.close();
})().catch(e=>{ console.error('FAIL',e); process.exit(1); });
