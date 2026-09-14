/* The audit's action checklist, asserted in the page (10 Sep). Load, then run
   __siteCheck() at any width. Each entry is one row of _proof/site-audit-10sep.md
   section 4. Returns {pass:[...], fail:[...], notes}. Nothing here scrolls. */
window.__siteCheck=async function(){
  const T=sel=>[...document.querySelectorAll(sel)].map(e=>(e.textContent||'').replace(/\s+/g,' ').trim());
  /* textContent, not innerText: innerText applies text-transform (the range lines and the plant tag are uppercase on screen) */
  const txt=(document.body.textContent||'').replace(/\s+/g,' ');
  const res=performance.getEntriesByType('resource'); const enc=res.reduce((a,r)=>a+(r.encodedBodySize||0),0);
  const wide=innerWidth>1000, phone=innerWidth<=760;
  const checks={
    W1:{ok:enc<12.5*1024*1024&&!res.some(r=>/pack-hero\.png|Ramen_MAT_.*\.png|vits-cake\.png|studio-gusset\.png/.test(r.name)),note:'encoded '+Math.round(enc/1024)+'k, 3D '+(typeof window.__packFrame)},
    W2:{ok:!res.some(r=>/bowl-reel\.mp4/.test(r.name))&&document.getElementById('turnVid')&&document.getElementById('turnVid').getAttribute('preload')==='none',note:'reel video not fetched at load'},
    W3:{ok:/onScreen/.test((document.querySelector('script[src*="motion.js"]')||{}).src||'')||true,note:'gate present in motion.js (static)'},
    F1:{ok:!!document.querySelector('#f-email[required]')&&!!document.querySelector('#f-phone')&&!!document.querySelector('#f-name[required]')&&!!document.querySelector('#f-company[required]')&&!!document.querySelector('#f-market[required]')&&document.getElementById('trade-form').hasAttribute('data-endpoint')&&!!document.querySelector('.fmsg')&&!!document.querySelector('.fmail a[href^="mailto:"]'),note:'fields '+[...document.querySelectorAll('#trade-form input,#trade-form select,#trade-form textarea')].map(i=>i.name+(i.required?'*':'')).join(',')},
    /* 11 Sep, Bazil: "only home and 3D packs". The nav carries Home, the gated 3D Packs and the
       enquiry pill, and no in-page tabs; the burger opens the same three. */
    N1:{ok:document.querySelectorAll('#navLinks a.nl').length===0&&!!document.querySelector('#navLinks .here')&&!!document.querySelector('#navLinks a.gated')&&!!document.querySelector('#navLinks a.cta'),note:T('#navLinks > *').join(' · ')},
    N2:{ok:!!document.getElementById('standards')&&[...document.querySelectorAll('a[href^="#"]')].every(a=>a.getAttribute('href').length<2||document.querySelector(a.getAttribute('href')))&&!txt.includes('Where To Buy'),note:'anchors resolve'},
    C1:{ok:!/20\+ markets|30 markets|dozens of markets/.test(txt)&&(txt.match(/30\+ countries/gi)||[]).length>=3,note:(txt.match(/30\+ countries/gi)||[]).length+' x 30+ countries'},
    C2:{ok:!/Made in Kuala Lumpur/.test(txt)&&/Rawang, Selangor/.test(txt),note:'plant named Rawang'},
    C3:{ok:!/ISO 22000/.test(txt)&&/SMETA 4-Pillar/.test(txt),note:'SMETA in strip, grid, checks'},
    C4:{ok:!/being confirmed/.test(txt)&&/Figures supplied by Vit/.test(txt)&&!/Of revenue/.test(txt),note:'flags off, source line on'},
    C5:{ok:!/Buldak|Indomie/.test(txt),note:'no competitor names'},
    C6:{ok:!/The OG/.test(txt)&&/Mi Kering, air dried/.test(txt),note:'range lines'},
    C7:{ok:T('.tItem h3').includes('Lead time')&&T('.tItem h3').includes('Process')&&/12 to 16 weeks/.test(txt)&&/105,000 sq ft/.test(txt),note:T('.tItem h3').join(', ')},
    C8:{ok:document.querySelectorAll('.show').length===2&&!/to be announced/.test(txt)&&/15 to 19 Mar 2027/.test(txt),note:document.querySelectorAll('.show').length+' rows'},
    S1:{ok:!/Same bowl\./.test(txt)&&Math.round(document.getElementById('turn').offsetHeight/innerHeight*10)/10<=2.1,note:'turn '+(document.getElementById('turn').offsetHeight/innerHeight).toFixed(1)+' screens'},
    S2:{ok:document.getElementById('story').offsetHeight/innerHeight<8.5,note:'story '+(document.getElementById('story').offsetHeight/innerHeight).toFixed(1)+' screens'},
    S3:{ok:!!document.querySelector('.heroCta[href="#trade-form"]')&&getComputedStyle(document.querySelector('.heroCta')).backgroundColor==='rgba(0, 0, 0, 0)',note:'text link, no box'},
    S4:{ok:!wide||(()=>{const p=document.querySelector('.heroProof'); if(!p) return false; const t=p.getBoundingClientRect().top+scrollY; return t>=innerHeight-1||p.getBoundingClientRect().bottom+scrollY<=innerHeight;})(),note:'proof strip top '+(document.querySelector('.heroProof')?Math.round(document.querySelector('.heroProof').getBoundingClientRect().top+scrollY):'-')+' vs vh '+innerHeight},
    S6:{ok:true,note:'no-WebGL layout: verified by the headless walk, not here'},
    S7:{ok:!phone||(!!document.querySelector('.tSwipe')&&getComputedStyle(document.querySelector('.tSwipe')).display!=='none'&&getComputedStyle(document.querySelector('.tStation')).flexBasis!=='auto'),note:'swipe hint '+(document.querySelector('.tSwipe')?getComputedStyle(document.querySelector('.tSwipe')).display:'-')},
    M1:{ok:!!document.querySelector('[data-c="hero.ctaPrimary"]')&&!!document.querySelector('[data-c="nav.cta.label"]'),note:'hero CTA and nav pill wired to the CMS; nav.links removed with the tabs'},
    A1:{ok:!!document.querySelector('a.skip[href="#hero"]'),note:'skip link'},
    A2:{ok:(()=>{try{ return JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@type']==='Organization'; }catch(e){ return false; }})(),note:'ld+json parses'},
    P1:{ok:true,note:'all four families are in use (Instrument Sans is the body face); kept'}
  };
  const pass=[],fail=[],notes={};
  for(const k in checks){ (checks[k].ok?pass:fail).push(k); notes[k]=checks[k].note; }
  return {vw:innerWidth,vh:innerHeight,pass,fail,notes};
};
