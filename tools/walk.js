// Walk a page the way a reader does: wheel-scroll in steps (Lenis listens to
// wheel, not scrollTo), wait for the motion to settle, screenshot each stop.
//   node tools/walk.js <url> <outdir> [width] [height] [step] [maxStops]
const {chromium}=require('/private/tmp/claude-501/-Users-zieel-Bazil-Claude-3-Websites/4842f4cf-9888-44bf-970b-c41dfebe81ef/scratchpad/node_modules/playwright-core');
const fs=require('fs'), os=require('os'), path=require('path');
(async()=>{
  const [url,out,W='1440',H='900',STEP='700',MAX='60']=process.argv.slice(2);
  fs.mkdirSync(out,{recursive:true});
  const exe=path.join(os.homedir(),'Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
  const b=await chromium.launch({executablePath:fs.existsSync(exe)?exe:undefined,args:process.env.NOGL?['--disable-webgl','--disable-webgl2','--disable-3d-apis']:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const pg=await b.newPage({viewport:{width:+W,height:+H},deviceScaleFactor:1});
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e))); pg.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
  await pg.goto(url,{waitUntil:'load',timeout:60000}); await pg.waitForTimeout(4000);
  const total=await pg.evaluate(()=>document.documentElement.scrollHeight);
  let n=0; await pg.screenshot({path:path.join(out,String(n).padStart(2,'0')+'.png')});
  await pg.mouse.move(+W/2,+H/2);
  for(let y=0;y<total-+H && n<+MAX;){
    await pg.mouse.wheel(0,+STEP); await pg.waitForTimeout(900);
    y=await pg.evaluate(()=>scrollY); n++;
    await pg.screenshot({path:path.join(out,String(n).padStart(2,'0')+'.png')});
    if(y+ +H>=total-2) break;
  }
  fs.writeFileSync(path.join(out,'log.json'),JSON.stringify({url,total,stops:n+1,errors:errs},null,1));
  console.log(JSON.stringify({total,stops:n+1,errors:errs.slice(0,6)}));
  await b.close();
})().catch(e=>{ console.error(e); process.exit(1); });
