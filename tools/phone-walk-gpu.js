// Headed walk on the real GPU: a still every STEP screens, named by the screen it landed on.
//   node tools/phone-walk-gpu.js <url> <outdir> [width] [height] [step]
const {chromium}=require('/private/tmp/claude-501/-Users-zieel-Bazil-Claude-3-Websites/4842f4cf-9888-44bf-970b-c41dfebe81ef/scratchpad/node_modules/playwright-core');
const fs=require('fs'), os=require('os'), path=require('path');
(async()=>{
  const [url,out,W='390',H='844',STEP='0.5']=process.argv.slice(2);
  fs.mkdirSync(out,{recursive:true});
  const exe=path.join(os.homedir(),'Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
  const b=await chromium.launch({headless:false,executablePath:fs.existsSync(exe)?exe:undefined,args:['--autoplay-policy=no-user-gesture-required','--window-position=40,40']});
  const ctx=await b.newContext({viewport:{width:+W,height:+H},deviceScaleFactor:2});
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e))); pg.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
  await pg.goto(url,{waitUntil:'load',timeout:60000});
  await pg.waitForFunction(()=>typeof window.__packFrame==='function'||document.body.classList.contains('no3d'),null,{timeout:90000});
  await pg.waitForTimeout(2500);
  await pg.mouse.move(+W/2,+H/2);
  const total=await pg.evaluate(()=>document.documentElement.scrollHeight);
  const stepPx=+STEP*+H; let n=0, y=0;
  await pg.screenshot({path:path.join(out,'000.png')});
  for(let target=stepPx; target<total-+H; target+=stepPx){
    while(y<target-10){ await pg.mouse.wheel(0,Math.min(200,Math.max(50,(target-y)*0.6))); await pg.waitForTimeout(110); y=await pg.evaluate(()=>scrollY); }
    let last=-1; for(let k=0;k<25;k++){ await pg.waitForTimeout(180); y=await pg.evaluate(()=>scrollY); if(Math.abs(y-last)<1) break; last=y; }
    await pg.waitForTimeout(900); y=await pg.evaluate(()=>scrollY); n++;
    await pg.screenshot({path:path.join(out,String(n).padStart(3,'0')+'-'+(y/+H).toFixed(1)+'.png')});
  }
  fs.writeFileSync(path.join(out,'log.json'),JSON.stringify({url,total,stops:n+1,errors:errs},null,1));
  console.log(JSON.stringify({total,stops:n+1,errors:errs.slice(0,5)}));
  await ctx.close(); await b.close();
})().catch(e=>{ console.error('FAIL',e); process.exit(1); });
