/* One-scroll parallax audit, run inside the page (10 Sep). Steps the page with Lenis,
   settles the 3D layer's smoothing (60 synchronous step() calls per sample, the lerp is
   0.09 per call), and reports pack jumps, pack-over-copy overlaps, horizontal overflow,
   and which parallax planes actually moved. Hidden-pane safe: no rAF, no screenshots.
   Usage: await import('/tools/plx-audit.js?v=N'); await __plxWait(); __plxAudit(0.25) */
window.__plxWait=async function(ms){ ms=ms||55000; const t0=performance.now();
  const ok=()=>((typeof window.__packFrame==='function'&&window.__ph&&window.__ph.marks)||document.body.classList.contains('no3d'))&&!document.body.classList.contains('pre3d');
  while(!ok()&&performance.now()-t0<ms){ await new Promise(r=>setTimeout(r,500)); }
  return {ready:ok(), no3d:document.body.classList.contains('no3d'), waitedMs:Math.round(performance.now()-t0), vw:innerWidth, vh:innerHeight, mp:typeof window.__mpFrame}; };
window.__plxAudit=function(step,settle){
  step=step||0.25; settle=settle||60;
  const vh=innerHeight,vw=innerWidth,L=window.__lenis; const H=document.documentElement.scrollHeight; const mp=document.getElementById('mPack');
  /* under 720 the flat twin (#mPack) is the pack; its own frame function places it (display
     is none until that has run once, so display is not the test) */
  const mobile=!!(mp&&document.body.classList.contains('no3d'));
  const secs=[...document.querySelectorAll('body > section, main > section')];
  const secAt=(y)=>{const mid=y+vh/2; for(const e of secs){const r=e.getBoundingClientRect();const t=r.top+scrollY,b=r.bottom+scrollY; if(mid>=t&&mid<b) return e.id||'?';} return '?';};
  const els=[...document.querySelectorAll('h1,h2,h3,h4,p,span,b,em,li,dt,dd,button,input,label,img,figure')].filter(el=>!el.closest('.bmws')&&!el.closest('.nav')&&!el.closest('#mPack')&&!el.closest('.markStrip')&&!el.closest('#heroSticker')&&!el.closest('#heroTag')&&!el.classList.contains('heroBack')&&!el.querySelector('h1,h2,h3,h4,p,img,figure,li,input,button'));
  const tracked=[...document.querySelectorAll('[data-plx], .reelFlav, .jPlate, .tShot, .spec, .ccap')];
  const packSecs=new Set(['hero','label','story','trade','range','cook']);
  /* an element's own opacity is not what the eye sees: the range's copy blocks fade as a whole */
  const effOp=el=>{ let o=1,a=el,n=0; while(a&&a!==document.body&&n++<6){ o*=+getComputedStyle(a).opacity; if(o<0.12) return o; a=a.parentElement; } return o; };
  const trail=[],overlaps=[],cuts=[]; let prevBox=null,maxJump=0,absent=[],overflowAt=[],plxMoved=0,errs=[]; const plxStart=new Map();
  for(let y=0;y<=H-vh;y+=Math.round(vh*step)){
    if(L) L.scrollTo(y,{immediate:true}); else scrollTo(0,y); if(window.ScrollTrigger) ScrollTrigger.update();
    /* the page's own scroll listeners (label slot, board) never hear a synchronous scrollTo */
    try{ window.dispatchEvent(new Event('scroll')); }catch(e){}
    if(window.__labelMeasure) try{ window.__labelMeasure(); }catch(e){}
    let pb=null;
    if(mobile){ if(window.__mpFrame){ for(let i=0;i<settle;i++){ window.__mpClock=(window.__mpClock||performance.now())+16; window.__mpFrame(window.__mpClock); } } const r=mp.getBoundingClientRect(); const cs=getComputedStyle(mp); if(r.width>8&&+cs.opacity>0.1&&cs.visibility!=='hidden'&&cs.display!=='none') pb={x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}; }
    else if(window.__packFrame){ for(let i=0;i<settle;i++) pb=window.__packFrame(); if(pb&&pb.error){ errs.push({at:+(y/vh).toFixed(2),e:pb.error}); pb=null; } }
    const sec=secAt(y); const sc=+(y/vh).toFixed(2);
    if(document.documentElement.scrollWidth>vw+1) overflowAt.push(sc);
    const on=pb&&pb.w>8&&pb.x+pb.w/2>12&&pb.x-pb.w/2<vw-12&&pb.y+pb.h/2>12&&pb.y-pb.h/2<vh-12;
    if(on){ if(prevBox&&sec!=='range'){const j=Math.hypot(pb.x-prevBox.x,pb.y-prevBox.y); if(j>maxJump)maxJump=j; if(j>vh*step*2.2) cuts.push({at:sc,sec,jumpPx:Math.round(j),from:[Math.round(prevBox.x),Math.round(prevBox.y)],to:[Math.round(pb.x),Math.round(pb.y)]});} prevBox={x:pb.x,y:pb.y};
      const P={l:pb.x-pb.w/2,r:pb.x+pb.w/2,t:pb.y-pb.h/2,b:pb.y+pb.h/2};
      for(const el of els){const r=el.getBoundingClientRect(); if(r.width<24||r.height<10||r.bottom<0||r.top>vh)continue; const cs=getComputedStyle(el); if(cs.visibility==='hidden'||+cs.opacity<0.12)continue; if(effOp(el)<0.12)continue; const ox=Math.min(P.r,r.right)-Math.max(P.l,r.left),oy=Math.min(P.b,r.bottom)-Math.max(P.t,r.top); if(ox>6&&oy>6){const f=(ox*oy)/(r.width*r.height); if(f>0.15) overlaps.push({at:sc,sec,txt:((el.textContent||'').trim().slice(0,22))||((el.getAttribute('src')||el.tagName).split('/').pop()),cov:+f.toFixed(2)});}}
    } else { prevBox=null; if(packSecs.has(sec)) absent.push(sc); }
    for(const t of tracked){const r=t.getBoundingClientRect(); if(r.bottom<0||r.top>vh)continue; const ty=r.top-scrollY; if(!plxStart.has(t)) plxStart.set(t,{a:ty}); else plxStart.get(t).b=ty;}
    trail.push({sc,sec,on:on?1:0,y:pb?Math.round(pb.y):null,x:pb?Math.round(pb.x):null,h:pb?Math.round(pb.h):null});
  }
  for(const [k,v] of plxStart){ if(v.b!=null&&Math.abs(v.b-v.a)>4) plxMoved++; }
  const seen=new Set(),uniq=[]; for(const o of overlaps){const key=o.sec+'|'+o.txt; if(seen.has(key))continue; seen.add(key); uniq.push(o);}
  window.__plxTrail=trail;
  const seg=(a,b)=>trail.filter(t=>t.sc>=a&&t.sc<=b).map(t=>t.sc+':'+(t.y==null?'-':t.y)).join(' ');
  return {vw,vh,mobileMode:mobile,screens:+(H/vh).toFixed(1),samples:trail.length,packOnScreen:trail.filter(t=>t.on).length,maxJumpPx:Math.round(maxJump),teleports:cuts,absentInPackSections:absent.slice(0,24),overlaps:uniq.slice(0,14),overlapCount:uniq.length,horizOverflowAt:overflowAt.slice(0,5),planesTracked:plxStart.size,planesMoved:plxMoved,errs:errs.slice(0,3),marks:window.__ph&&window.__ph.marks,mapLead:window.__ph&&window.__ph.mapLead,seg};
};
