// Overlap probe: loads the page with REAL WebGL in headless Chromium and reports
// every place the 3D pack's projected box covers page content.
//   node tools/probe.js <url> <width> <height> [steps]
const SP='/private/tmp/claude-501/-Users-zieel-Bazil-Claude-3-Websites/4842f4cf-9888-44bf-970b-c41dfebe81ef/scratchpad/node_modules/playwright-core';
const {chromium}=require(SP);
const fs=require('fs'), os=require('os'), path=require('path');
(async()=>{
  const [url,W='1800',H='1000',STEPS='40']=process.argv.slice(2);
  const exe=path.join(os.homedir(),'Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
  const b=await chromium.launch({
    executablePath: fs.existsSync(exe)?exe:undefined,
    args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
          '--enable-webgl','--ignore-gpu-blocklist','--enable-gpu-rasterization']});
  const pg=await b.newPage({viewport:{width:+W,height:+H},deviceScaleFactor:1});
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,140)));
  pg.on('console',m=>{ if(m.type()==='error') errs.push(m.text().slice(0,140)); });
  await pg.goto(url,{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(6000);
  const gl=await pg.evaluate(()=>{ const c=document.createElement('canvas');
    const g=c.getContext('webgl2')||c.getContext('webgl'); return !!g; });
  const box0=await pg.evaluate(()=>window.__packBox||null);
  const out=await pg.evaluate(async (steps)=>{
    const L=window.__lenis, total=document.documentElement.scrollHeight-innerHeight;
    const CAND=[...document.querySelectorAll('h1,h2,h3,p,span,img,figure,li,b,em,button,input')].filter(el=>{
      if(el.closest('#stage3d')||el.closest('.bmws')||el.closest('.nav')) return false;
      if(el.querySelector('h1,h2,h3,p,img,figure,li')) return false;
      return (el.textContent||'').trim().length>0||el.tagName==='IMG'||el.tagName==='FIGURE';
    });
    const hits=[], trail=[];
    for(let i=0;i<=steps;i++){
      const pct=100*i/steps;
      if(L) L.scrollTo(Math.round(total*pct/100),{immediate:true}); else scrollTo(0,Math.round(total*pct/100));
      await new Promise(r=>setTimeout(r,180));
      const pb=window.__packBox;
      const sec=[...document.querySelectorAll('section[id]')].find(s=>{const r=s.getBoundingClientRect(); return r.top<=innerHeight*0.5&&r.bottom>innerHeight*0.5;});
      if(!pb||!pb.w||pb.w<8){ trail.push({pct:Math.round(pct),sec:sec?sec.id:'?',pack:null}); continue; }
      trail.push({pct:Math.round(pct),sec:sec?sec.id:'?',pack:[Math.round(pb.x),Math.round(pb.y),Math.round(pb.w),Math.round(pb.h)]});
      const P={l:pb.x-pb.w/2,r:pb.x+pb.w/2,t:pb.y-pb.h/2,b:pb.y+pb.h/2};
      if(P.r<0||P.l>innerWidth||P.b<0||P.t>innerHeight) continue;
      for(const el of CAND){
        const r=el.getBoundingClientRect();
        if(r.width<24||r.height<10||r.bottom<0||r.top>innerHeight) continue;
        const cs=getComputedStyle(el);
        if(cs.visibility==='hidden'||+cs.opacity<0.12) continue;
        const ox=Math.min(P.r,r.right)-Math.max(P.l,r.left), oy=Math.min(P.b,r.bottom)-Math.max(P.t,r.top);
        if(ox>6&&oy>6){ const f=(ox*oy)/(r.width*r.height);
          if(f>0.10) hits.push({pct:Math.round(pct),sec:sec?sec.id:'?',cls:String(el.className||'').split(' ')[0].slice(0,18)||el.tagName,txt:(el.textContent||'').trim().slice(0,32),cov:+f.toFixed(2)}); }
      }
    }
    const seen=new Set(), uniq=[];
    for(const h of hits){ const k=h.sec+'|'+h.cls+'|'+h.txt; if(seen.has(k))continue; seen.add(k); uniq.push(h); }
    return {uniq,trail};
  },+STEPS);
  console.log(JSON.stringify({w:+W,webgl:gl,boxAtLoad:box0,errors:errs.slice(0,4),overlaps:out.uniq.length,hits:out.uniq,trail:out.trail},null,1));
  await b.close();
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
