// Record the phone journey with WebGL on: video + stills + a drag on the pack.
//   node tools/phone-record.js <url> <outdir> [width] [height]
const {chromium}=require('/private/tmp/claude-501/-Users-zieel-Bazil-Claude-3-Websites/4842f4cf-9888-44bf-970b-c41dfebe81ef/scratchpad/node_modules/playwright-core');
const fs=require('fs'), os=require('os'), path=require('path');
(async()=>{
  const [url,out,W='390',H='844']=process.argv.slice(2);
  fs.mkdirSync(out,{recursive:true});
  const exe=path.join(os.homedir(),'Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
  /* headed: the machine's own GPU and a real frame loop; SwiftShader in headless never finished loading the page */
  const b=await chromium.launch({headless:false,executablePath:fs.existsSync(exe)?exe:undefined,args:['--autoplay-policy=no-user-gesture-required','--window-position=40,40']});
  const ctx=await b.newContext({viewport:{width:+W,height:+H},deviceScaleFactor:2,recordVideo:{dir:out,size:{width:+W,height:+H}}});
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e))); pg.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
  const log=(m)=>{ console.log(new Date().toISOString().slice(11,19),m); };
  await pg.goto(url,{waitUntil:'load',timeout:60000}); log('loaded');
  try{ await pg.waitForFunction(()=>typeof window.__packFrame==='function',null,{timeout:120000}); }catch(e){ const st=await pg.evaluate(()=>({body:document.body.className,canvas:!!document.querySelector('#stage3d canvas')})); console.log('NOT READY',JSON.stringify(st),errs.slice(0,3)); throw e; } log('3D ready');
  await pg.waitForTimeout(2500);
  await pg.screenshot({path:path.join(out,'01-hero.png')});
  const box=await pg.evaluate(()=>window.__packBox);
  log('pack box '+JSON.stringify(box&&{x:Math.round(box.x),y:Math.round(box.y),w:Math.round(box.w),h:Math.round(box.h)}));
  if(box&&box.w){
    await pg.mouse.move(box.x-box.w*0.3,box.y); await pg.mouse.down();
    for(let i=1;i<=18;i++){ await pg.mouse.move(box.x-box.w*0.3+i*9,box.y+Math.sin(i/3)*2); await pg.waitForTimeout(40); }
    await pg.mouse.up(); await pg.waitForTimeout(700);
    await pg.screenshot({path:path.join(out,'02-turned.png')}); log('dragged');
  }
  await pg.mouse.move(+W/2,+H/2);
  const total=await pg.evaluate(()=>document.documentElement.scrollHeight);
  const stops={label:1.7,story:4.6,story2:6.5,trade:10.9,range:15.5,cook:18.2,cook2:19.2,cook3:19.9,reel:21.5,turn:24.7,form:26.2};
  let y=0, n=3;
  for(const [name,s] of Object.entries(stops)){
    const target=Math.round(s*+H);
    /* smaller wheel steps, then wait until Lenis has actually stopped (it overshoots a wheel burst) */
    while(y<target-20){ await pg.mouse.wheel(0,Math.min(240,Math.max(60,(target-y)*0.6))); await pg.waitForTimeout(120); y=await pg.evaluate(()=>scrollY); if(y>=total-+H-2) break; }
    let last=-1; for(let k=0;k<30;k++){ await pg.waitForTimeout(200); y=await pg.evaluate(()=>scrollY); if(Math.abs(y-last)<1) break; last=y; }
    await pg.waitForTimeout(1200); y=await pg.evaluate(()=>scrollY);
    await pg.screenshot({path:path.join(out,String(n).padStart(2,'0')+'-'+name+'-'+(y/+H).toFixed(1)+'.png')}); n++; log('stop '+name+' at '+(y/+H).toFixed(2)+' screens');
    if(y>=total-+H-2) break;
  }
  const vid=await pg.video();
  await ctx.close();
  const vpath=await vid.path(); fs.renameSync(vpath,path.join(out,'phone-walk.webm'));
  fs.writeFileSync(path.join(out,'log.json'),JSON.stringify({url,total,errors:errs},null,1));
  console.log(JSON.stringify({total,errors:errs.slice(0,5)}));
  await b.close();
})().catch(e=>{ console.error('FAIL',e); process.exit(1); });
