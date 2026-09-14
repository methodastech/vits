/* js/globe.js: the export globe. 8 Sep 2026, Bazil: "globe still looks too messy, just copy
   Tenthpin but use correct animation and specifically for Vit's".

   So this is Tenthpin's About globe, ported (react-app/src/lib/globe.js there): Canvas 2D, no
   library. A matte sphere with soft shading, land as a fine dot grid, the footprint country in
   the brand colour with one thin outline, the markets as nodes that ping in turn, hub arcs
   from the home city with light running along them, labels drawn on the canvas. No graticule,
   no halo, no beads. The sphere sways five degrees over half a minute and the reader can turn
   it by hand. Framed as the horizon Bazil asked for on 7 Sep: the sphere rises from the bottom
   of the band and its crown is the region Vit's ships from. Colours are the pack's: kraft body,
   cream land, yellow Malaysia, red Kuala Lumpur. */
import { landBytes, landAt } from './landMask.js';
import { OUTLINES } from './outlines.js';

(function(){
  const fig=document.querySelector('.tMap'), holder=document.getElementById('globeHolder');
  if(!fig||!holder) return;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas=document.createElement('canvas'); holder.appendChild(canvas);
  const ctx=canvas.getContext('2d'); if(!ctx) return;
  const bytes=landBytes();

  const CREAM='242,233,221', YELLOW='255,203,5', RED='216,35,42';
  const FOOT=['MYS'];
  /* 8 Sep, Bazil: "put country flags". A flag per market, by name; content.json can carry its
     own `flag` on a market to override. Canvas draws colour emoji on every current browser. */
  const FLAGS={'united states':'\u{1F1FA}\u{1F1F8}','usa':'\u{1F1FA}\u{1F1F8}','united kingdom':'\u{1F1EC}\u{1F1E7}','uk':'\u{1F1EC}\u{1F1E7}','europe':'\u{1F1EA}\u{1F1FA}','uae':'\u{1F1E6}\u{1F1EA}','india':'\u{1F1EE}\u{1F1F3}','china':'\u{1F1E8}\u{1F1F3}','south korea':'\u{1F1F0}\u{1F1F7}','korea':'\u{1F1F0}\u{1F1F7}','japan':'\u{1F1EF}\u{1F1F5}','australia':'\u{1F1E6}\u{1F1FA}','singapore':'\u{1F1F8}\u{1F1EC}','thailand':'\u{1F1F9}\u{1F1ED}','indonesia':'\u{1F1EE}\u{1F1E9}','philippines':'\u{1F1F5}\u{1F1ED}','vietnam':'\u{1F1FB}\u{1F1F3}','saudi arabia':'\u{1F1F8}\u{1F1E6}','malaysia':'\u{1F1F2}\u{1F1FE}','kuala lumpur':'\u{1F1F2}\u{1F1FE}','canada':'\u{1F1E8}\u{1F1E6}','germany':'\u{1F1E9}\u{1F1EA}','france':'\u{1F1EB}\u{1F1F7}','netherlands':'\u{1F1F3}\u{1F1F1}','hong kong':'\u{1F1ED}\u{1F1F0}','taiwan':'\u{1F1F9}\u{1F1FC}','new zealand':'\u{1F1F3}\u{1F1FF}'};
  function flagOf(m){ if(m&&m.flag) return m.flag; const k=String((m&&m.name)||'').trim().toLowerCase(); return FLAGS[k]||''; }
  const EMOJI='"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  const D2R=Math.PI/180;
  /* the view centre sits below the band, so the crown of the visible cap is the home region */
  const LAT0=-35;
  let home={name:'Kuala Lumpur',role:'HQ / Factory',lat:3.14,lon:101.7}, markets=[], LON0=105;

  function readContent(){
    const C=(window.VITS&&window.VITS.trade)||{};
    if(C.mapHome&&isFinite(+C.mapHome.lat)&&isFinite(+C.mapHome.lon)) home=Object.assign({},home,C.mapHome);
    markets=(Array.isArray(C.mapMarkets)?C.mapMarkets:[]).filter(function(m){ return m&&m.name&&isFinite(+m.lat)&&isFinite(+m.lon); });
    LON0=+home.lon+3;
  }
  readContent();
  document.addEventListener('vits:content',function(){ readContent(); });

  /* is a point inside one of the footprint rings (lat, lon, even-odd) */
  function inFoot(lat,lon){
    for(const k of FOOT){ const rings=OUTLINES[k]||[]; for(const ring of rings){
      let inside=false;
      for(let i=0,j=ring.length-1;i<ring.length;j=i++){
        const yi=ring[i][0],xi=ring[i][1],yj=ring[j][0],xj=ring[j][1];
        if(((yi>lat)!==(yj>lat))&&(lon<(xj-xi)*(lat-yi)/(yj-yi)+xi)) inside=!inside;
      }
      if(inside) return true;
    } }
    return false;
  }

  let W=0,H=0,dpr=1,cx=0,cy=0,R=1,dot=2;
  let ux=null,uy=null,uz=null,bk=null,sx=null,sy=null,sz=null,N=0;
  let raf=null,vis=false,t0=performance.now(),on=false;
  let yaw=0,vel=0,down=false,px=0;

  /* land cells as unit vectors: bucket 1 land, 2 land inside the footprint */
  function build(){
    const out=[];
    const G=W>=1100?6:W>=700?5.5:5;
    const sLat=G/(R*D2R);
    for(let lat=-88;lat<=88;lat+=sLat){
      const la=lat*D2R,cl=Math.cos(la),sl=Math.sin(la);
      const sLon=sLat/Math.max(0.08,cl);
      for(let lon=-180;lon<180;lon+=sLon){
        if(!landAt(lon,lat,bytes)) continue;
        if(inFoot(lat,lon)) continue;           /* the footprint gets its own, finer pass */
        const lo=lon*D2R;
        out.push(cl*Math.sin(lo),sl,cl*Math.cos(lo),1);
      }
    }
    /* the footprint at half pitch: Malaysia is small, and at the coarse pitch it was three dots wide */
    for(let lat=-6;lat<=9;lat+=sLat*0.5){
      const la=lat*D2R,cl=Math.cos(la),sl=Math.sin(la);
      const sLon=sLat*0.5/Math.max(0.08,cl);
      for(let lon=98;lon<121;lon+=sLon){
        if(!landAt(lon,lat,bytes)||!inFoot(lat,lon)) continue;
        const lo=lon*D2R;
        out.push(cl*Math.sin(lo),sl,cl*Math.cos(lo),2);
      }
    }
    N=out.length/4;
    ux=new Float32Array(N);uy=new Float32Array(N);uz=new Float32Array(N);bk=new Uint8Array(N);
    for(let i=0;i<N;i++){ ux[i]=out[i*4];uy[i]=out[i*4+1];uz[i]=out[i*4+2];bk[i]=out[i*4+3]; }
    sx=new Float32Array(N);sy=new Float32Array(N);sz=new Float32Array(N);
  }

  function size(){
    const r=holder.getBoundingClientRect();
    if(!r.width||!r.height) return false;
    dpr=Math.min(2,window.devicePixelRatio||1);
    W=r.width;H=r.height;
    canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
    canvas.style.width=W+'px';canvas.style.height=H+'px';
    /* the horizon: a big sphere whose centre sits below the band. About a third of its
       height shows, the crown a little under the top edge */
    R=Math.min(W*0.40,H*1.10);
    cx=W/2;
    cy=H*0.18+R;
    dot=W>=1100?2.6:W>=700?2.2:1.9;
    build();
    return true;
  }

  function project(lat,lon,lon0,lift){
    const la=lat*D2R,lo=(lon-lon0)*D2R;
    const x=Math.cos(la)*Math.sin(lo),y0=Math.sin(la),z0=Math.cos(la)*Math.cos(lo);
    const c=Math.cos(LAT0*D2R),s=Math.sin(LAT0*D2R);
    const y=y0*c-z0*s,z=y0*s+z0*c;
    if(z<0) return null;
    const r=R*(1+(lift||0));
    return {x:cx+x*r,y:cy-y*r,d:z};
  }

  function arc(a,b,lon0,n){
    const A=[Math.cos(a.lat*D2R)*Math.cos(a.lon*D2R),Math.sin(a.lat*D2R),Math.cos(a.lat*D2R)*Math.sin(a.lon*D2R)];
    const B=[Math.cos(b.lat*D2R)*Math.cos(b.lon*D2R),Math.sin(b.lat*D2R),Math.cos(b.lat*D2R)*Math.sin(b.lon*D2R)];
    const om=Math.acos(Math.max(-1,Math.min(1,A[0]*B[0]+A[1]*B[1]+A[2]*B[2])));
    const pts=[];
    for(let i=0;i<=n;i++){
      const t=i/n;
      const s1=om<1e-4?1-t:Math.sin((1-t)*om)/Math.sin(om),s2=om<1e-4?t:Math.sin(t*om)/Math.sin(om);
      const x=A[0]*s1+B[0]*s2,y=A[1]*s1+B[1]*s2,z=A[2]*s1+B[2]*s2;
      const lat=Math.atan2(y,Math.hypot(x,z))/D2R,lon=Math.atan2(z,x)/D2R;
      const lift=Math.sin(Math.PI*t)*0.07*Math.min(1,om/0.45);
      const p=project(lat,lon,lon0,lift);
      if(!p) break;              /* the route drops over the horizon and stays there */
      pts.push(p);
    }
    return pts;
  }

  var coarse=!!(window.matchMedia&&matchMedia('(pointer:coarse)').matches), lastDraw=0;
  function frame(now){
    raf=null;
    if(!W&&!size()){ if(vis) raf=requestAnimationFrame(frame); return; }
    /* 10 Sep: on a phone this was the one continuous full-canvas redraw on the page,
       every frame, for a globe that turns five degrees in twenty six seconds. Half the
       frames carry the same picture to the eye, so a phone draws at 30. Desktop keeps 60. */
    if(coarse && now-lastDraw<30){ if(vis) raf=requestAnimationFrame(frame); return; }
    lastDraw=now;
    const t=Math.max(0,(now-t0)/1000);
    if(!down){ yaw+=vel; vel*=0.94; }
    const lon0=LON0+(reduce?0:5*Math.sin(t/26))-yaw;
    const readIdx=markets.length?((Math.floor(t/3.2)%markets.length)+markets.length)%markets.length:-1;

    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,W,H);

    /* the body: a matte kraft sphere, lit from the upper left, the rim a shade darker so it
       turns away from the page */
    let g=ctx.createRadialGradient(cx-R*0.30,cy-R*0.62,R*0.05,cx,cy,R);
    g.addColorStop(0,'#3E2A12');g.addColorStop(0.45,'#33210E');g.addColorStop(0.80,'#2A1A0B');g.addColorStop(1,'#231708');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.fill();

    /* rotate every land vector: yaw by the view longitude, tilt by LAT0 */
    const ca=Math.cos(-lon0*D2R),sa=Math.sin(-lon0*D2R);
    const ct=Math.cos(LAT0*D2R),st=Math.sin(LAT0*D2R);
    for(let i=0;i<N;i++){
      const x=ux[i]*ca+uz[i]*sa,z1=-ux[i]*sa+uz[i]*ca;
      const y=uy[i]*ct-z1*st,z=uy[i]*st+z1*ct;
      sz[i]=z; if(z<0) continue;
      sx[i]=cx+x*R;sy[i]=cy-y*R;
    }
    const passes=[null,'rgba('+CREAM+',.62)','rgba('+YELLOW+',.96)'];
    for(let b=1;b<3;b++){
      ctx.fillStyle=passes[b];
      for(let i=0;i<N;i++){
        if(bk[i]!==b||sz[i]<0||sy[i]>H+4||sy[i]<-4) continue;
        const z=sz[i];
        ctx.globalAlpha=0.42+0.58*Math.pow(z,0.5);
        const s=dot*(b===2?0.62:0.78+0.32*z);
        ctx.fillRect(sx[i]-s/2,sy[i]-s/2,s,s);
      }
    }
    ctx.globalAlpha=1;

    /* the footprint outline: one thin yellow line */
    ctx.strokeStyle='rgba('+YELLOW+',.7)';ctx.lineWidth=1;ctx.lineJoin='round';
    ctx.beginPath();
    for(const k of FOOT){ const rings=OUTLINES[k]||[]; for(const ring of rings){
      let first=true;
      for(let i=0;i<=ring.length;i++){
        const q=ring[i%ring.length]; const p=project(q[0],q[1],lon0,0.002);
        if(!p){ first=true; continue; }
        if(first){ ctx.moveTo(p.x,p.y); first=false; } else ctx.lineTo(p.x,p.y);
      }
    } }
    ctx.stroke();

    /* hub arcs with light running home to market */
    const hub={lat:+home.lat,lon:+home.lon};
    markets.forEach(function(m,i){
      const dest=project(+m.lat,+m.lon,lon0,0); if(!dest) return;   /* over the horizon: no route, no stub */
      const pts=arc(hub,{lat:+m.lat,lon:+m.lon},lon0,56); if(pts.length<2) return;
      /* the route itself: a hairline that fades toward the middle of its span, so the eye
         reads the two ends rather than a web of lines (8 Sep, Bazil: "make the line transfer
         more beautiful") */
      const a0=pts[0], a1=pts[pts.length-1];
      const lg=ctx.createLinearGradient(a0.x,a0.y,a1.x,a1.y);
      lg.addColorStop(0,'rgba('+YELLOW+',.42)'); lg.addColorStop(0.5,'rgba('+YELLOW+',.14)'); lg.addColorStop(1,'rgba('+YELLOW+',.42)');
      ctx.strokeStyle=lg;ctx.lineWidth=1;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let k=1;k<pts.length;k++) ctx.lineTo(pts[k].x,pts[k].y);ctx.stroke();
      if(reduce) return;
      /* the transfer: a comet, its tail fading in steps behind a soft glowing head, one
         every few seconds per route, staggered */
      const ph=((t/4.6)+i*0.137)%1;
      const head=Math.floor(ph*(pts.length-1)),tail=Math.max(0,head-14);
      if(head>tail){
        for(let k=tail;k<head;k++){
          const f=(k-tail)/(head-tail);
          ctx.strokeStyle='rgba('+YELLOW+','+(0.08+0.82*f*f)+')';ctx.lineWidth=0.8+1.4*f;
          ctx.beginPath();ctx.moveTo(pts[k].x,pts[k].y);ctx.lineTo(pts[k+1].x,pts[k+1].y);ctx.stroke();
        }
        const hp=pts[head];
        const glow=ctx.createRadialGradient(hp.x,hp.y,0,hp.x,hp.y,9);
        glow.addColorStop(0,'rgba('+YELLOW+',.55)'); glow.addColorStop(1,'rgba('+YELLOW+',0)');
        ctx.fillStyle=glow;ctx.beginPath();ctx.arc(hp.x,hp.y,9,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='rgba(255,246,214,1)';ctx.beginPath();ctx.arc(hp.x,hp.y,2.2,0,Math.PI*2);ctx.fill();
      }
    });

    /* the markets: core, ping ring, label */
    const fs=W>=1100?11:W>=700?10:8.5;
    ctx.font='700 '+fs+'px Archivo, "Instrument Sans", sans-serif';
    try{ ctx.letterSpacing='0.12em'; }catch(e){}
    ctx.textBaseline='middle';
    const placed=[];
    function settle(x,y,w,h){ /* step the label down until it clears every label already placed */
      for(let k=0;k<4;k++){
        let hit=false;
        for(const r of placed){ if(x<r.x+r.w&&x+w>r.x&&y<r.y+r.h&&y+h>r.y){ hit=true; break; } }
        if(!hit) break; y+=h+2;
      }
      placed.push({x:x,y:y,w:w,h:h}); return y;
    }
    /* 9 Sep: on a phone the UAE marker landed on top of KUALA LUMPUR. Every market
       label goes through settle(), but the home label was drawn afterwards at a
       fixed offset and never reserved its space, so nothing knew to avoid it.
       Home is the anchor of this map: it books its box first and the markets
       step around it. */
    (function(){
      const hp0=project(+home.lat,+home.lon,lon0,0); if(!hp0||hp0.y>=H-8||hp0.y<=8) return;
      const sd=home.side==='right'?1:-1;
      ctx.font='700 '+(fs+1)+'px Archivo, "Instrument Sans", sans-serif';
      const hn0=String(home.name).toUpperCase();
      const hf0=flagOf(Object.assign({name:'Malaysia'},home.flag?{flag:home.flag}:{}));
      const hfw0=hf0?(fs+1)*1.5:0, hw0=ctx.measureText(hn0).width+hfw0;
      const hx0=sd<0?hp0.x-14-hw0:hp0.x+14;
      /* the name sits at hp.y-6 and the role at hp.y+8, so the block is both lines */
      placed.push({x:hx0,y:hp0.y-6-(fs+1),w:hw0,h:(fs+1)+14+fs});
    })();
    markets.forEach(function(m,i){
      const p=project(+m.lat,+m.lon,lon0,0); if(!p||p.y>H-8||p.y<8) return;
      const onI=i===readIdx;
      if(!reduce){
        const ph=((t/2.8)+i*0.19)%1;
        ctx.strokeStyle='rgba('+YELLOW+','+((1-ph)*.6)+')';ctx.lineWidth=1;
        ctx.beginPath();ctx.arc(p.x,p.y,4+ph*(onI?30:18),0,Math.PI*2);ctx.stroke();
      }
      ctx.fillStyle='rgba('+CREAM+',1)';ctx.beginPath();ctx.arc(p.x,p.y,onI?5:4.2,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba('+YELLOW+',1)';ctx.beginPath();ctx.arc(p.x,p.y,onI?3.2:2.6,0,Math.PI*2);ctx.fill();
      const side=m.side==='left'?-1:1;
      ctx.textAlign=side<0?'right':'left';
      ctx.fillStyle=onI?'rgba('+YELLOW+',1)':'rgba('+CREAM+',.82)';
      const txt=String(m.name).toUpperCase(), fl=flagOf(m);
      ctx.font='700 '+fs+'px Archivo, "Instrument Sans", sans-serif';
      const tw=ctx.measureText(txt).width, fw=fl?fs*1.5:0;
      const lx=side<0?p.x-12-tw-fw:p.x+12;
      const ly=settle(lx,p.y-fs*0.75+(m.dy?13:0),tw+fw,fs*1.5)+fs*0.75;
      if(fl){ ctx.save(); ctx.font=(fs*1.15)+'px '+EMOJI; ctx.textAlign='left'; ctx.fillStyle='#fff'; ctx.fillText(fl,lx,ly); ctx.restore(); ctx.font='700 '+fs+'px Archivo, "Instrument Sans", sans-serif'; }
      ctx.textAlign='left';
      ctx.fillText(txt,lx+fw,ly);
    });

    /* home: red core, cream ring, name and role */
    const hp=project(+home.lat,+home.lon,lon0,0);
    if(hp&&hp.y<H-8&&hp.y>8){
      if(!reduce){ const ph=(t/2.4)%1; ctx.strokeStyle='rgba('+RED+','+((1-ph)*.7)+')';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(hp.x,hp.y,5+ph*26,0,Math.PI*2);ctx.stroke(); }
      ctx.fillStyle='rgba('+CREAM+',1)';ctx.beginPath();ctx.arc(hp.x,hp.y,6,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba('+RED+',1)';ctx.beginPath();ctx.arc(hp.x,hp.y,4,0,Math.PI*2);ctx.fill();
      const side=home.side==='right'?1:-1;   /* the name sits over the Indian Ocean, not over Borneo */
      ctx.textAlign=side<0?'right':'left';
      ctx.font='700 '+(fs+1)+'px Archivo, "Instrument Sans", sans-serif';
      const hn=String(home.name).toUpperCase(), hf=flagOf(Object.assign({name:'Malaysia'},home.flag?{flag:home.flag}:{})), hfw=hf?(fs+1)*1.5:0, hw=ctx.measureText(hn).width;
      const hx=side<0?hp.x-14-hw-hfw:hp.x+14;
      if(hf){ ctx.save(); ctx.font=((fs+1)*1.15)+'px '+EMOJI; ctx.textAlign='left'; ctx.fillStyle='#fff'; ctx.fillText(hf,hx,hp.y-6); ctx.restore(); ctx.font='700 '+(fs+1)+'px Archivo, "Instrument Sans", sans-serif'; }
      ctx.textAlign='left'; ctx.fillStyle='rgba('+CREAM+',1)';
      ctx.fillText(hn,hx+hfw,hp.y-6);
      ctx.textAlign=side<0?'right':'left';
      ctx.font='600 '+(fs-1.5)+'px Archivo, "Instrument Sans", sans-serif';
      ctx.fillStyle='rgba('+CREAM+',.62)';
      ctx.fillText(String(home.role||'').toUpperCase(),hp.x+side*14,hp.y+8);
    }

    if(!on){ on=true; fig.classList.add('globeOn'); }
    if(!reduce&&vis) raf=requestAnimationFrame(frame);
  }

  /* the reader can turn it: a drag yaws the view, with a little inertia */
  holder.addEventListener('pointerdown',function(e){ down=true; px=e.clientX; vel=0; try{ holder.setPointerCapture(e.pointerId); }catch(_){} });
  holder.addEventListener('pointermove',function(e){ if(!down) return; const dx=e.clientX-px; px=e.clientX; vel=dx*0.22; yaw+=vel; if(!raf) frame(performance.now()); });
  function up(){ down=false; }
  holder.addEventListener('pointerup',up); holder.addEventListener('pointercancel',up); holder.addEventListener('lostpointercapture',up);

  if(window.ResizeObserver) new ResizeObserver(function(){ if(size()&&(reduce||!raf)) frame(performance.now()); }).observe(holder);
  else addEventListener('resize',function(){ if(size()) frame(performance.now()); });
  if(window.IntersectionObserver){
    new IntersectionObserver(function(es){ vis=es[0].isIntersecting; if(vis&&!raf&&!reduce) raf=requestAnimationFrame(frame); },{rootMargin:'120px 0px',threshold:0.02}).observe(fig);
  }else{ vis=true; raf=requestAnimationFrame(frame); }
  /* a still frame straight away, so the fallback swap does not wait on the first scroll */
  if(size()) frame(performance.now());
  /* verification hook: the pane pauses rAF while hidden, so a frame can be forced by hand */
  window.__globeFrame=function(){ frame(performance.now()); };
  window.__globeState=function(){ return {W:W,H:H,R:Math.round(R),n:N,loop:!!raf,vis:vis,lon0:LON0,yaw:yaw}; };
})();
