// Open the mobile menu on the real GPU and shoot it.
const {chromium}=require('/private/tmp/claude-501/-Users-zieel-Bazil-Claude-3-Websites/4842f4cf-9888-44bf-970b-c41dfebe81ef/scratchpad/node_modules/playwright-core');
const fs=require('fs'), os=require('os'), path=require('path');
(async()=>{
  const [url,out,W='390',H='844']=process.argv.slice(2);
  const exe=path.join(os.homedir(),'Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
  const b=await chromium.launch({headless:false,executablePath:fs.existsSync(exe)?exe:undefined,args:['--window-position=460,40']});
  const ctx=await b.newContext({viewport:{width:+W,height:+H},deviceScaleFactor:2});
  const pg=await ctx.newPage();
  await pg.goto(url,{waitUntil:'load',timeout:60000});
  await pg.waitForTimeout(4000);
  await pg.mouse.move(+W/2,+H/2); await pg.mouse.wheel(0,900); await pg.waitForTimeout(1200);
  await pg.click('#navBurger'); await pg.waitForTimeout(900);
  await pg.screenshot({path:out});
  const st=await pg.evaluate(()=>{
    const R=el=>{const q=el.getBoundingClientRect(); return [Math.round(q.left),Math.round(q.top),Math.round(q.width),Math.round(q.height)];};
    const links=[...document.querySelectorAll('#navLinks > *')].map(e=>({t:(e.textContent||'').trim().slice(0,16),cls:e.className,r:R(e)}));
    const sh=document.getElementById('navLinks');
    return {open:document.body.classList.contains('navOpen'),sheet:R(sh),bg:getComputedStyle(sh).backgroundColor,navBg:getComputedStyle(document.getElementById('siteNav')).backgroundColor,links};
  });
  console.log(JSON.stringify(st,null,1));
  await pg.click('#navBurger'); await pg.waitForTimeout(700);
  console.log('closed:',await pg.evaluate(()=>!document.body.classList.contains('navOpen')));
  await b.close();
})().catch(e=>{ console.error('FAIL',e); process.exit(1); });
