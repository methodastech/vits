// Find the empty bands. Walks the page on the real GPU and, at every stop, measures the tallest
// stretch of the frame with nothing in it: no text, no picture, no 3D pack, no bowl.
//   node tools/void-scan.js <url> [width] [height] [step]
const {chromium}=require('/private/tmp/claude-501/-Users-zieel-Bazil-Claude-3-Websites/4842f4cf-9888-44bf-970b-c41dfebe81ef/scratchpad/node_modules/playwright-core');
const fs=require('fs'), os=require('os'), path=require('path');
(async()=>{
  const [url,W='390',H='844',STEP='0.5']=process.argv.slice(2);
  const exe=path.join(os.homedir(),'Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
  const b=await chromium.launch({headless:false,executablePath:fs.existsSync(exe)?exe:undefined,args:['--window-position=460,40']});
  const ctx=await b.newContext({viewport:{width:+W,height:+H},deviceScaleFactor:1});
  const pg=await ctx.newPage();
  await pg.goto(url,{waitUntil:'load',timeout:60000});
  await pg.waitForFunction(()=>typeof window.__packFrame==='function'||document.body.classList.contains('no3d'),null,{timeout:90000});
  await pg.waitForTimeout(2500);
  await pg.mouse.move(+W/2,+H/2);
  const total=await pg.evaluate(()=>document.documentElement.scrollHeight);
  const step=+STEP*+H; const rows=[]; let y=0;
  for(let target=0; target<total-+H; target+=step){
    while(y<target-10){ await pg.mouse.wheel(0,Math.min(220,Math.max(60,(target-y)*0.6))); await pg.waitForTimeout(110); y=await pg.evaluate(()=>scrollY); }
    let last=-1; for(let k=0;k<22;k++){ await pg.waitForTimeout(160); y=await pg.evaluate(()=>scrollY); if(Math.abs(y-last)<1) break; last=y; }
    await pg.waitForTimeout(500);
    const r=await pg.evaluate(()=>{
      const H=innerHeight, W=innerWidth, BAND=6, n=Math.ceil(H/BAND);
      const filled=new Array(n).fill(false);
      const mark=(t,b)=>{ const a=Math.max(0,Math.floor(t/BAND)), z=Math.min(n-1,Math.ceil(b/BAND)); for(let i=a;i<=z;i++) filled[i]=true; };
      /* 12 Sep: the list was tags, so a <div> carrying a line of copy counted as empty: the footer's
         five link columns (all <a>) read as a 336px void, and the range's eyebrow (a .ln div) made the
         top of its frame read empty at 1440. Anything with its OWN text counts, plus the media tags. */
      const media=new Set(['IMG','SVG','VIDEO','CANVAS','INPUT','SELECT','TEXTAREA','BUTTON','FIGURE']);
      const els=[...document.querySelectorAll('body *')].filter(e=>{
        if(media.has(e.tagName)) return true;
        for(const n of e.childNodes) if(n.nodeType===3&&n.nodeValue.trim()) return true;
        return false;
      });
      for(const el of els){
        if(el.closest('.bmws')||el.closest('#pgBar')) continue;
        const cs=getComputedStyle(el);
        if(cs.visibility==='hidden'||cs.display==='none'||+cs.opacity<0.12) continue;
        const q=el.getBoundingClientRect();
        if(q.width<8||q.height<4||q.bottom<=0||q.top>=H) continue;
        /* a full-bleed background block is not content: it must be smaller than the frame */
        if(q.height>H*0.95&&q.width>W*0.95) continue;
        mark(q.top,q.bottom);
      }
      for(const k of ['__packBox','__bowlBox']){ const bx=window[k]; if(bx&&bx.w>8&&bx.h>8) mark(bx.y-bx.h/2,bx.y+bx.h/2); }
      let best=0,bestAt=0,run=0,runStart=0;
      for(let i=0;i<n;i++){
        if(!filled[i]){ if(run===0) runStart=i; run++; if(run>best){ best=run; bestAt=runStart; } }
        else run=0;
      }
      const sec=(()=>{ const mid=scrollY+H/2; for(const s of document.querySelectorAll('body > section')){ const t=s.getBoundingClientRect().top+scrollY; if(mid>=t&&mid<t+s.offsetHeight) return s.id||s.className.split(' ')[0]; } return '?'; })();
      return {sc:+(scrollY/H).toFixed(2),sec,voidPx:best*BAND,voidTop:bestAt*BAND,inkPct:Math.round(filled.filter(Boolean).length/n*100)};
    });
    rows.push(r);
    if(y>=total-+H-2) break;
  }
  const bad=rows.filter(r=>r.voidPx>=280).sort((a,b)=>b.voidPx-a.voidPx);
  console.log(JSON.stringify({stops:rows.length,worst:bad.slice(0,14),allVoids:rows.map(r=>r.sc+':'+r.voidPx)},null,1));
  await b.close();
})().catch(e=>{ console.error('FAIL',e); process.exit(1); });
