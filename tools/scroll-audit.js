/* Scroll continuity audit. Paste into the console of index.html (or run via the
   browser pane). Walks the page in 120px steps with ScrollTrigger driven by hand
   and reads the INLINE opacities the scroll handlers write; a hard cut is any
   single-step change over 0.5, which is what the eye reads as a switch.
   No waits per step: the hidden pane times out at 45s with them. */
(async function(){
  document.documentElement.style.scrollBehavior='auto';
  if(window.__lenis){ try{ window.__lenis.stop(); }catch(e){} }
  const H=document.documentElement.scrollHeight, vh=innerHeight, STEP=120;
  const secs=[...document.querySelectorAll('body > section, main > section')].map(e=>({id:e.id||e.className.split(' ')[0], top:Math.round(e.getBoundingClientRect().top+scrollY), bot:Math.round(e.getBoundingClientRect().bottom+scrollY)}));
  const tracked=[...document.querySelectorAll('#trade .tShot, #trade .tItem, #range .spec, #range .heritagePhoto, .ccap, #storyBoard .bPile, #storyBoard .bItem, #storyBoard .bMark path')];
  const per={}; let prev=null; const cuts=[]; let total=0, maxJump=0;
  for(let y=0;y<=H-vh;y+=STEP){
    window.scrollTo(0,y); if(window.ScrollTrigger) ScrollTrigger.update();
    const o=tracked.map(e=>+(e.style.opacity||getComputedStyle(e).opacity));
    const sec=secs.find(x=>y+vh*0.5>=x.top&&y+vh*0.5<x.bot); const id=sec?sec.id:'?';
    per[id]=per[id]||{steps:0,cuts:0,max:0}; per[id].steps++; total++;
    if(prev){ let big=0; o.forEach((v,i)=>{ const j=Math.abs(v-prev[i]); if(j>big) big=j; });
      if(big>per[id].max) per[id].max=big; if(big>maxJump) maxJump=big;
      if(big>0.5){ per[id].cuts++; cuts.push({screen:+(y/vh).toFixed(1),in:id,jump:+big.toFixed(2)}); } }
    prev=o;
  }
  window.scrollTo(0,0); if(window.ScrollTrigger) ScrollTrigger.update();
  if(window.__lenis){ try{ window.__lenis.start(); }catch(e){} }
  const out=[{totalScreens:+(H/vh).toFixed(1), steps:total, hardCuts:cuts.length, biggestStepJump:+maxJump.toFixed(2)},
    Object.entries(per).map(([id,v])=>({section:id,screens:+(v.steps*STEP/vh).toFixed(1),hardCuts:v.cuts,maxJump:+v.max.toFixed(2)})), cuts];
  console.table(out[1]); console.log(out[0], cuts); return out;
})();
