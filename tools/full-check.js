// One pass at one width on the real GPU: checklist, parallax audit, void scan, weight, errors.
//   node tools/full-check.js <url> <width> <height> [step]
const {chromium}=require('/private/tmp/claude-501/-Users-zieel-Bazil-Claude-3-Websites/4842f4cf-9888-44bf-970b-c41dfebe81ef/scratchpad/node_modules/playwright-core');
const fs=require('fs'), os=require('os'), path=require('path');
(async()=>{
  const [url,W='390',H='844',STEP='0.5']=process.argv.slice(2);
  const exe=path.join(os.homedir(),'Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
  const b=await chromium.launch({headless:false,executablePath:fs.existsSync(exe)?exe:undefined,args:['--window-position=460,40']});
  const ctx=await b.newContext({viewport:{width:+W,height:+H},deviceScaleFactor:1});
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,160))); pg.on('console',m=>{ if(m.type()==='error') errs.push(m.text().slice(0,160)); });
  await pg.goto(url,{waitUntil:'load',timeout:60000});
  await pg.waitForFunction(()=>typeof window.__packFrame==='function'||document.body.classList.contains('no3d'),null,{timeout:90000});
  await pg.waitForTimeout(2500);
  const has3d=await pg.evaluate(()=>typeof window.__packFrame==='function');
  await pg.addScriptTag({url:'/tools/site-check.js?v=9'});
  const chk=await pg.evaluate(async()=>await window.__siteCheck());
  await pg.mouse.move(+W/2,+H/2);
  const total=await pg.evaluate(()=>document.documentElement.scrollHeight);
  const step=+STEP*+H; let y=0; const voids=[]; let prev=null, jumps=[], overlaps=[], overflow=[];
  for(let target=0; target<total-+H; target+=step){
    while(y<target-10){ await pg.mouse.wheel(0,Math.min(220,Math.max(60,(target-y)*0.6))); await pg.waitForTimeout(100); y=await pg.evaluate(()=>scrollY); }
    let last=-1; for(let k=0;k<20;k++){ await pg.waitForTimeout(150); y=await pg.evaluate(()=>scrollY); if(Math.abs(y-last)<1) break; last=y; }
    await pg.waitForTimeout(420);
    const r=await pg.evaluate(()=>{
      const H=innerHeight, W=innerWidth, BAND=6, n=Math.ceil(H/BAND), filled=new Array(n).fill(false);
      const mark=(t,b)=>{ const a=Math.max(0,Math.floor(t/BAND)), z=Math.min(n-1,Math.ceil(b/BAND)); for(let i=a;i<=z;i++) filled[i]=true; };
      /* 12 Sep: a tag list missed anything that carries its own text in a div, so the footer's
         five columns of <a> and the range's .ln eyebrow counted as empty frame. Anything with a
         direct text node counts, plus the media tags. Same rule as tools/void-scan.js. */
      const media=new Set(['IMG','SVG','VIDEO','CANVAS','INPUT','SELECT','TEXTAREA','BUTTON','FIGURE']);
      const els=[...document.querySelectorAll('body *')].filter(e=>{
        if(media.has(e.tagName)) return true;
        for(const n of e.childNodes) if(n.nodeType===3&&n.nodeValue.trim()) return true;
        return false;
      });
      const text=[];
      for(const el of els){
        if(el.closest('.bmws')||el.closest('#pgBar')) continue;
        const cs=getComputedStyle(el); if(cs.visibility==='hidden'||cs.display==='none'||+cs.opacity<0.12) continue;
        const q=el.getBoundingClientRect(); if(q.width<8||q.height<4||q.bottom<=0||q.top>=H) continue;
        if(q.height>H*0.95&&q.width>W*0.95) continue;
        mark(q.top,q.bottom);
        if(/^(H1|H2|H3|H4|P|LI|LABEL|BUTTON)$/.test(el.tagName)&&(el.textContent||'').trim()){ q.__who=el.tagName+'.'+(el.className||'').toString().trim().split(/\s+/)[0]+' "'+(el.textContent||'').trim().slice(0,26)+'"'; text.push(q); }
      }
      const pb=window.__packBox, bb=window.__bowlBox;
      for(const bx of [pb,bb]) if(bx&&bx.w>8&&bx.h>8) mark(bx.y-bx.h/2,bx.y+bx.h/2);
      let best=0,bestAt=0,run=0,runStart=0; for(let i=0;i<n;i++){ if(!filled[i]){ if(run===0) runStart=i; run++; if(run>best){best=run;bestAt=runStart;} } else run=0; }
      let cov=0, covWho=null;
      /* a pack drawn at a tenth of its strength is not covering anything: the crossing between
         the hero and the anatomy rides back to 0.12 on purpose. Strength comes from __packAlpha. */
      if(pb&&pb.w>8&&(window.__packAlpha==null||window.__packAlpha>0.5)){ const P={l:pb.x-pb.w/2,r:pb.x+pb.w/2,t:pb.y-pb.h/2,b:pb.y+pb.h/2};
        for(const q of text){ const ox=Math.min(P.r,q.right)-Math.max(P.l,q.left), oy=Math.min(P.b,q.bottom)-Math.max(P.t,q.top);
          if(ox>6&&oy>6){ const c=(ox*oy)/(q.width*q.height); if(c>cov){ cov=c; covWho=q.__who||null; } } } }
      return {sc:+(scrollY/H).toFixed(2),voidPx:best*BAND,voidTop:bestAt*BAND,sec:(()=>{const m=scrollY+H/2;for(const s of document.querySelectorAll('body > section')){const t=s.getBoundingClientRect().top+scrollY;if(m>=t&&m<t+s.offsetHeight) return s.id||'?';}return '?';})(),packCover:+cov.toFixed(2),covWho:covWho,
        pack:(pb&&pb.w>8&&pb.y+pb.h/2>0&&pb.y-pb.h/2<H)?[Math.round(pb.x),Math.round(pb.y)]:null,   /* on screen only: an entry from above is not a teleport */
        over:document.documentElement.scrollWidth>W+1};
    });
    voids.push({px:r.voidPx,sc:r.sc,top:r.voidTop,sec:r.sec});   /* 12 Sep: the summary said HOW TALL the worst band was and never WHERE, so every hunt needed a second tool. It names the stop now. */
    if(r.packCover>0.35) overlaps.push({at:r.sc,cov:r.packCover,who:r.covWho});
    if(r.over) overflow.push(r.sc);
    if(prev&&r.pack&&prev.pack){ const d=Math.hypot(r.pack[0]-prev.pack[0],r.pack[1]-prev.pack[1]); if(d>+H*+STEP*2.2) jumps.push({at:r.sc,px:Math.round(d)}); }
    prev=r;
    if(y>=total-+H-2) break;
  }
  const res=await pg.evaluate(()=>{ const r=performance.getEntriesByType('resource');
    return {enc:r.reduce((a,x)=>a+(x.encodedBodySize||0),0), top:r.filter(x=>x.encodedBodySize>250000).sort((a,b)=>b.encodedBodySize-a.encodedBodySize).slice(0,8).map(x=>[x.name.split('/').pop().split('?')[0],Math.round(x.encodedBodySize/1024)])}; });
  const enc=res.enc;
  console.log(JSON.stringify({w:+W,h:+H,has3d,screens:+(total/+H).toFixed(1),check:{pass:chk.pass.length,fail:chk.fail},
    maxVoidPx:Math.max(...voids.map(v=>v.px)),voidsOver280:voids.filter(v=>v.px>280).length,
    worstVoids:voids.filter(v=>v.px>280).sort((a,b)=>b.px-a.px).slice(0,4),
    packOverText:overlaps.slice(0,4),teleports:jumps.slice(0,4),overflowAt:overflow.slice(0,3),
    weightMB:+(enc/1048576).toFixed(2),heaviest:res.top,errors:errs.slice(0,4)},null,1));
  await b.close();
})().catch(e=>{ console.error('FAIL',e); process.exit(1); });
