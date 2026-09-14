import * as THREE from 'three';
/* every flavour pack that wears a painted front registers here, on either page, so a
   photograph landing late can repaint it (declared first: the loads can fire before
   the packs below exist) */
let skuPacksRef=[];
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
const RM = matchMedia('(prefers-reduced-motion:reduce)').matches;
/* ---------- pack typeface ----------
   Canvas does not report an unknown font, it just draws in the default sans.
   So the chosen family has to be loaded and confirmed BEFORE any texture is
   drawn, or the client picks a face, sees no change and calls it broken.
   Only Inter ships in the page's own font link; anything else is pulled in
   on demand, so choosing nothing costs nothing. */
function packFontReady(){
  const fam=(window.VITS&&window.VITS.pack&&window.VITS.pack.fonts&&window.VITS.pack.fonts.family)||'Inter';
  if(fam!=='Inter'){
    const id='packfont-'+fam.replace(/\W+/g,'-');
    if(!document.getElementById(id)){
      const l=document.createElement('link');
      l.id=id; l.rel='stylesheet';
      l.href='https://fonts.googleapis.com/css2?family='+fam.trim().replace(/\s+/g,'+')
            +':ital,wght@0,400;0,600;0,700;0,800;1,700;1,800&display=swap';
      document.head.appendChild(l);
    }
  }
  if(!document.fonts||!document.fonts.load) return Promise.resolve();
  const weights=[400,600,700,800];
  const wanted=weights.map(w=>document.fonts.load(w+' 100px "'+fam+'"'))
    .concat(weights.slice(2).map(w=>document.fonts.load('italic '+w+' 100px "'+fam+'"')));
  /* Never let a slow or blocked font CDN hold the hero hostage — draw regardless. */
  return Promise.race([
    Promise.all(wanted).catch(()=>{}),
    new Promise(r=>setTimeout(r,2500))
  ]);
}

/* wait for content.json so the pack draws its artwork from the CMS on first paint */
(window.VITS_READY||Promise.resolve()).then(packFontReady).then(function(){
  /* 7 Sep, the section sweep: below 720 the pack was being drawn over the copy in six
     sections, because no phone gate existed. The page already carries a complete flat path
     under body.no3d (hero, label and cook posters, the range fallbacks, the board's strays
     pulled home), so a phone takes that path and never boots WebGL at all. */
  /* 9 Sep, Bazil, found on opening the desktop build: this gate read innerWidth at boot and
     committed FOREVER. A tab laid out late reports innerWidth 0 (measured it doing exactly
     that in the preview pane), 0 is less than 720, so a 1280px desktop was permanently
     taking the phone path: no canvas, and body.mpack on top of it hiding the flat posters
     too, which is how the hero ended up with no pack at all.
     A width of 0 is not a narrow screen, it is a screen nobody has measured yet, so it no
     longer counts as one. A real narrow viewport still takes the flat path exactly as
     before; only the unmeasured case changes, and it now boots 3D and lets the phone route
     stand itself down on its own width check. */
  var w0=innerWidth||document.documentElement.clientWidth||0;
  /* 10 Sep, Bazil on his phone: "I still can't turn the packaging like 3D". The flat phone
     route (#mPack) is now only the fallback for a frame with no WebGL; every width boots the
     layer. The stacked branches below (1000 and under) already carry the phone journey. */
  void w0;
  /* 7 Sep, Bazil: "make sure the loading screen is smooth". Measured under the plate: 20 long
     tasks totalling 4.0s, the biggest 2.1s, 31 animation frames in a 5.9s hold. That was
     this boot running while the plate was up. The plate now leaves on fonts and content
     and the 3D boots one frame after it starts to go, so the hold is short and its frames
     are its own. The hero's pack fades in when the stage is ready, as it always did. */
  function fail(e){ console.error('3D failed',e); document.body.classList.add('no3d');
              try{ document.dispatchEvent(new CustomEvent('vits:3dfail')); }catch(_){} }
  function boot(){ try{ init3D().catch(fail); } catch(e){ fail(e); } }
  /* the module itself is imported after the plate leaves (index.html), so it boots at
     once. Waiting here for vits:loaded again would wait for an event already fired. */
  if(!RM) boot();
});

async function init3D(){
const __breath=()=>new Promise(r=>setTimeout(r,0));   /* 8 Sep, Bazil: "make sure the loading screen is smooth". The heavy builds below used to run as one 2 to 4 second task right after the plate; now each yields to the page between steps. */
/* ---------- the pack reads its printed artwork from content.json ----------
   pk('variety.en','INSTANT NOODLES') returns the CMS value, or the fallback
   when the field is missing or blank, so the pack never renders empty. */
const PACKC=(window.VITS&&window.VITS.pack)||{};
function pk(path,fb){
  const v=path.split('.').reduce((o,k)=>(o==null?undefined:o[k]),PACKC);
  return (v==null||v==='')?fb:v;
}
const PCOL=PACKC.colours||{};
const CF=PCOL.field||'#FFE000', CR=PCOL.red||'#E30613',
      CR_ROOF='#D2121C', CR_ROOF2='#E6151F', CR_TAIL='#A00D15', CR_FOLD='#7A0810',
      CRD=PCOL.redDeep||'#C1121F', CIK=PCOL.ink||'#1A1A1A',
      /* the border scrolls print in a deeper rust than the roundel red —
         sampled off the client's studio photo */
      CMEA=PCOL.meander||'#C13908';
/* Every word printed on the pack is set in this family. Quoted, because the
   CMS list offers multi-word names like "Barlow Condensed"; sans-serif tail so
   a family that failed to load degrades to something rather than nothing. */
const PF='"'+pk('fonts.family','Inter')+'",sans-serif';

/* ---------- quality tier: full rig on desktop, trimmed on phones and weak GPUs ---------- */
const COARSE=matchMedia('(pointer:coarse)').matches, NARROW=innerWidth<900;
const CORES=navigator.hardwareConcurrency||8, MEM=navigator.deviceMemory||8;
const HI=!(COARSE||NARROW||CORES<=4||MEM<=4);
const Q={ tex:HI?2:1, dpr:HI?2:1.5, aniso:HI?16:4,
          seg:HI?[40,56,16]:[20,28,8], shadows:HI, normals:HI };
const DPR=Math.min(devicePixelRatio||1,Q.dpr);

/* ---------- shared textures, all drawn in code: zero image payload ---------- */
function canv(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }
/* panels are authored in a fixed coordinate space and rendered at Q.tex resolution */
function panel(w,h){
  const c=document.createElement('canvas');
  c.width=Math.round(w*Q.tex); c.height=Math.round(h*Q.tex);
  const x=c.getContext('2d'); x.scale(Q.tex,Q.tex);
  return [c,x];
}
/* The printed border, matched to the client's production bag (not the old
   marketing render): a FIELD-YELLOW band edged with thin red rules, carrying a
   row of outlined square-scroll spirals in red. Every figure is a fraction of
   the band height, so the same call draws correctly at any panel scale. */
function meander(ctx,x,y,w,rowH0,color,fieldCol){
  const field=fieldCol||CF;
  ctx.save();
  ctx.fillStyle=field; ctx.fillRect(x,y,w,rowH0);
  /* the printed ink sits INSIDE the band with clear field above and below it:
     measured against ref-05 the ink runs 23px of the 40px band, starting 9px
     down. Drawing edge to edge made the border a third too heavy. */
  y += rowH0*0.225;
  const rowH = rowH0*0.72;
  /* The exact printed module, traced off a 5x grid of the client photo:
     a thin rule along the top, then square-spiral glyphs whose feet join
     into one continuous baseline near the band's foot. */
  /* THE PRINTED MODULE, read off the plate at 4x on 3 Sep: a plain repeat of
     two parts, a VERTICAL BAR and then a SQUARE SPIRAL of one and a half
     turns, clear yellow between them and no rule along the top. The spiral
     opens at its lower left; the stroke is about an eighth of the ink height. */
  const pitch=rowH0*0.887, n=Math.ceil(w/pitch);
  ctx.strokeStyle=color; ctx.lineWidth=rowH*0.165; ctx.lineJoin='miter'; ctx.lineCap='butt';   /* the plate's stroke at 4x is a sixth of the ink height */
  for(let i=0;i<n;i++){
    const mx=x+i*pitch, P=pitch, H=rowH;
    ctx.beginPath();                          /* the bar */
    ctx.moveTo(mx+P*0.12, y+H*0.06); ctx.lineTo(mx+P*0.12, y+H*0.96);
    ctx.stroke();
    ctx.beginPath();                          /* the spiral, from its open foot */
    ctx.moveTo(mx+P*0.34, y+H*0.96);
    ctx.lineTo(mx+P*0.34, y+H*0.06);
    ctx.lineTo(mx+P*0.90, y+H*0.06);
    ctx.lineTo(mx+P*0.90, y+H*0.96);
    ctx.lineTo(mx+P*0.55, y+H*0.96);
    ctx.lineTo(mx+P*0.55, y+H*0.36);
    ctx.lineTo(mx+P*0.72, y+H*0.36);
    ctx.lineTo(mx+P*0.72, y+H*0.68);
    ctx.stroke();
  }
  ctx.restore();
}
/* text laid to an exact printed width, so the lockup matches the bag whatever
   the chosen family measures */
function fitText(x,str,cx,cy,targetW,font,fill){
  if(!str) return;
  x.save(); x.font=font; x.textAlign='center'; x.textBaseline='alphabetic';
  x.fillStyle=fill;
  const m=x.measureText(str).width;
  if(m>0){ x.translate(cx,cy); x.scale(targetW/m,1); x.fillText(str,0,0); }
  x.restore();
}
/* the real mark artwork, with the cut-out bottom; falls back to a drawn oval */
let logoImg=null, logoMask=null, phxImg=null, halalImg=null, roundelImg=null, cakeImg=null, windowImg=null, winTypeImg=null, refFrontImg=null, refSideL=null, refSideR=null, ovalPhoto=null, gussetCake=null;
/* The bag prints the classic ellipse roundel, not the notched web logo.
   The real artwork (lifted from the scan) is laid over a drawn red base
   that completes the bottom lobe the window hides in the scan. */
/* the mark's printed aspect: half-height / half-width, measured off the
   client studio photo of the production bag (the old scan squashed it) */
/* The mark is FLAT: 1.82 wide per tall. Two independent readings agree and the
   drawing did not. ref-05, the rectified front, gives a solid ellipse 505 by
   273 (1.85). The studio three-quarter gives 259 by 154, which is 1.79 once
   the view's foreshortening is taken out. It was drawn at 1.38, round enough
   that it read as a circle in every render, and the parts sheet is what put
   the two side by side. */
const MARK_AR=0.458;
/* the small yellow four-point stars flanking the Chinese on the real bag */
function star4(x,cx,cy,r){
  x.save(); x.fillStyle=CF; x.beginPath();
  for(let i=0;i<8;i++){
    const rr=i%2?r*0.38:r, a=-Math.PI/2+i*Math.PI/4;
    x.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);
  }
  x.closePath(); x.fill(); x.restore();
}
/* The pack's mark is not a pure ellipse: its top and bottom run noticeably flatter than
   an ellipse's and the sides turn faster, which is what makes it read as a printed badge
   rather than a drawn oval. n=2.6 traces that; n=2 is the ellipse it used to be. */
function superPath(x,cx,cy,rx,ry,n){
  x.beginPath();
  const N=160;
  for(let i=0;i<=N;i++){
    const t=i/N*Math.PI*2, c=Math.cos(t), s2=Math.sin(t);
    const px=cx+rx*Math.sign(c)*Math.pow(Math.abs(c),2/n);
    const py=cy+ry*Math.sign(s2)*Math.pow(Math.abs(s2),2/n);
    if(i===0) x.moveTo(px,py); else x.lineTo(px,py);
  }
  x.closePath();
}
/* THE MARK, rebuilt 3 Sep on Bazil's note: "remove the weird red line surrounding it",
   "put vits logo there", "then under it the bowl".

   It used to be the vits-roundel scan drawn whole and then patched: a red band over its
   torn lower ring, its Chinese lifted and shifted on a scratch canvas, three rings stroked
   to hide the posterised rim, and one of those rings stood OUTSIDE the mark at 1.055 of
   its axes, which is the red line Bazil saw.

   Now the mark is composed from crisp parts instead of repaired:
     the oval      drawn, so its edge is as clean as the print
     the wordmark  cut out of assets/vits-logo.webp, the corporate artwork
     the Chinese   cut out of the roundel scan, which carries the real brush glyphs
   Both cut-outs are keyed once into cached canvases, unrotated and 1:1, because reading
   pixels through a panel context that may be scaled by Q.tex or rotated 90 degrees for a
   gusset has failed twice before.

   Proportions measured on the face-on retail photograph, where nothing is foreshortened:
   Proportions read off a gridded crop of that photograph, because the colour masks kept
   catching the noodle window behind the mark and gave nonsense:
     mark            0.61 tall per wide
     wordmark        0.75 of the mark wide, 0.446 of it tall, centre 0.302 of a half-height
                     ABOVE centre
     Chinese         0.315 wide, 0.174 of the mark tall, centre 0.395 of a half-height below
     white keyline   0.95 of the half-width, 0.915 of the half-height, so it hugs the rim as
                     the pack's does rather than leaving a thick red band inside it */
let markWordC=null, markGlyphC=null;
function markPart(img, inside, keep, paint){
  /* Key one part out of a source image into its own tight canvas. `inside` narrows the
     search to a band of the image, `keep` says which pixels belong, `paint` is the colour
     they become. Returns null until the image has actually decoded. */
  if(!(img&&img.complete&&img.naturalWidth)) return null;
  const w=img.naturalWidth, h=img.naturalHeight;
  const src=canv(w,h), sg=src.getContext('2d');
  sg.drawImage(img,0,0);
  const id=sg.getImageData(0,0,w,h), d=id.data;
  let x0=w,y0=h,x1=-1,y1=-1;
  for(let p=0;p<w*h;p++){
    const px=p%w, py=(p/w)|0, i=p*4;
    if(!inside(px/w,py/h) || !keep(d[i],d[i+1],d[i+2],d[i+3])){ d[i+3]=0; continue; }
    d[i]=paint[0]; d[i+1]=paint[1]; d[i+2]=paint[2]; d[i+3]=255;
    if(px<x0)x0=px; if(px>x1)x1=px; if(py<y0)y0=py; if(py>y1)y1=py;
  }
  if(x1<x0||y1<y0) return null;
  sg.putImageData(id,0,0);
  /* Keep only the biggest BLOCK of rows. The corporate logo carries a scallop arc below
     the lettering, separated from it by a clean band of empty rows; taking the whole kept
     set stretched the box down over that arc, and drawn back at the mark's size it became
     the stray white line between Vit's and the Chinese. Rows are grouped into runs, the
     heaviest run wins, and the columns are re-measured inside it. */
  const rowCount=new Int32Array(h);
  for(let py=0;py<h;py++){
    let n=0;
    for(let px=x0;px<=x1;px++) if(d[(py*w+px)*4+3]>128) n++;
    rowCount[py]=n;
  }
  let bestS=-1,bestE=-1,bestN=-1, rs=-1, rn=0;
  for(let py=0;py<=h;py++){
    const on = py<h && rowCount[py]>0;
    if(on){ if(rs<0){ rs=py; rn=0; } rn+=rowCount[py]; }
    else if(rs>=0){ if(rn>bestN){ bestN=rn; bestS=rs; bestE=py-1; } rs=-1; }
  }
  if(bestS>=0){
    y0=bestS; y1=bestE;
    let nx0=w, nx1=-1;
    for(let py=y0;py<=y1;py++)
      for(let px=0;px<w;px++)
        if(d[(py*w+px)*4+3]>128){ if(px<nx0)nx0=px; if(px>nx1)nx1=px; }
    if(nx1>nx0){ x0=nx0; x1=nx1; }
  }
  const cw=x1-x0+1, ch=y1-y0+1;
  const out=canv(cw,ch); out.getContext('2d').drawImage(src,x0,y0,cw,ch,0,0,cw,ch);
  return out;
}
function buildMarkParts(){
  if(!markWordC && logoImg && logoImg.complete && logoImg.naturalWidth){
    /* the wordmark is the white INSIDE the logo's red body. The logo also carries a white
       keyline around its rim, so the search is narrowed to an ellipse at 0.87 of the red
       body's own axes, which is what separated them when this was measured. */
    const w=logoImg.naturalWidth, h=logoImg.naturalHeight;
    const t=canv(w,h), tg=t.getContext('2d'); tg.drawImage(logoImg,0,0);
    const td=tg.getImageData(0,0,w,h).data;
    let rx0=w,ry0=h,rx1=-1,ry1=-1;
    for(let p=0;p<w*h;p++){
      const i=p*4;
      if(td[i+3]>128 && td[i]>120 && td[i]-td[i+1]>60 && td[i]-td[i+2]>60){
        const px=p%w, py=(p/w)|0;
        if(px<rx0)rx0=px; if(px>rx1)rx1=px; if(py<ry0)ry0=py; if(py>ry1)ry1=py;
      }
    }
    if(rx1>rx0){
      const ccx=(rx0+rx1)/2/w, ccy=(ry0+ry1)/2/h;
      const cax=(rx1-rx0)/2/w*0.87, cay=(ry1-ry0)/2/h*0.87;
      markWordC=markPart(logoImg,
        function(u,v){ const a=(u-ccx)/cax, b=(v-ccy)/cay; return a*a+b*b<1; },
        function(r,g,b,a){ return a>128 && r>200 && g>200 && b>200; },
        [255,255,255]);
    }
  }
  if(!markGlyphC && roundelImg && roundelImg.complete && roundelImg.naturalWidth){
    /* the roundel's yellow is only the three glyphs, as long as the torn rim is kept out;
       the band below is where they sit on that scan, measured 3 Sep */
    markGlyphC=markPart(roundelImg,
      function(u,v){ return u>0.15 && u<0.85 && v>0.44 && v<0.80; },
      function(r,g,b,a){ return a>128 && r>170 && g>110 && b<110; },
      [255,214,0]);
  }
}
function drawLogo(x,cx,cy,w,ar){
  const rx=w/2, ry=rx*(ar||MARK_AR);
  buildMarkParts();
  x.save();
  x.fillStyle=CR;
  superPath(x,cx,cy,rx,ry,2.05); x.fill();   /* 3 Sep, Bazil: 2.6 read as a squircle; the printed mark is an ellipse */
  /* the keyline hugs the rim on the pack: a thin red margin outside it, not the wide band
     an inset ellipse left. Its bottom has to clear the Chinese, which an ry of 0.915 did
     not: the arc ran between the wordmark and the glyphs. */
  x.strokeStyle=CF; x.lineWidth=Math.max(1.4,ry*0.042);   /* the keyline is the pack's yellow showing through, not white */
  superPath(x,cx,cy,rx*0.955,ry*0.945,2.05); x.stroke();
  if(markWordC){
    /* fitted to the pack, not to the asset: on the retail photograph the wordmark is 0.79
       of the mark wide AND 0.50 of it tall, which is 9% flatter than the corporate logo
       draws it. Sizing by the asset's own aspect instead put it over the oval's rim. */
    const ww=w*0.68, wh=ry*0.80;
    x.drawImage(markWordC, cx+rx*0.02-ww/2, cy-ry*0.30-wh/2, ww, wh);
  }
  if(markGlyphC){
    const gw=w*0.33, gh=ry*0.36;
    x.drawImage(markGlyphC, cx-rx*0.02-gw/2, cy+ry*0.36-gh/2, gw, gh);
  }
  x.restore();
}
function drawLogoSil(x,cx,cy,w){        /* white silhouette, for the die-cut mask */
  x.beginPath(); x.ellipse(cx,cy,w/2,w/2*MARK_AR,0,0,Math.PI*2); x.fill();
}
/* the Vit's mark as printed on the bag: red ellipse, inset yellow keyline,
   white wordmark, the Chinese lockup in yellow, TM at the shoulder */
function vitsOval(x,cx,cy,rx,ry){
  x.save();
  x.fillStyle=CR;
  x.beginPath(); x.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); x.fill();
  x.strokeStyle=CF; x.lineWidth=ry*0.055;
  x.beginPath(); x.ellipse(cx,cy,rx*0.91,ry*0.87,0,0,Math.PI*2); x.stroke();
  x.textAlign='center'; x.fillStyle='#fff';
  x.font='italic 800 '+(ry*1.02)+'px Inter,Helvetica,Arial,sans-serif';
  x.fillText("Vit's",cx,cy+ry*0.26);
  x.fillStyle=CF;
  x.font='700 '+(ry*0.44)+'px "Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif';
  x.fillText(pk("mark.chinese","唯一麵"),cx,cy+ry*0.76);
  x.fillStyle=CR;
  x.font='700 '+(ry*0.20)+'px Inter,Helvetica,Arial,sans-serif';
  x.fillText('TM',cx+rx*1.06,cy-ry*0.72);
  x.restore();
}
/* text set along a circular arc, for the certification ring */
function arcText(x,cx,cy,r,txt,mid,size,flip,fam){
  x.save(); x.textAlign='center'; x.textBaseline='middle';
  const per=size*(fam?1.16:0.92)/r, start=mid-(txt.length-1)*per/2;
  x.font='600 '+size+'px '+(fam||PF);
  for(let i=0;i<txt.length;i++){ const a=start+i*per;
    x.save(); x.translate(cx+Math.cos(a)*r, cy+Math.sin(a)*r);
    x.rotate(a+(flip?-Math.PI/2:Math.PI/2)); x.fillText(txt[i],0,0); x.restore(); }
  x.restore();
}
function star5(x,cx,cy,r){
  x.beginPath();
  for(let i=0;i<10;i++){
    const rr=i%2?r*0.42:r, a=-Math.PI/2+i*Math.PI/5;
    x.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);
  }
  x.closePath(); x.fill();
}
/* JAKIM Malaysia halal certification mark */
function jakimMark(x,cx,cy,R){
  const SER='"Times New Roman",Georgia,serif';
  x.save(); x.textAlign='center'; x.textBaseline='alphabetic';
  x.fillStyle='#111'; x.strokeStyle='#111';
  /* outer ring and the hairline that closes the lettering band */
  x.lineWidth=R*0.070; x.beginPath(); x.arc(cx,cy,R*0.962,0,Math.PI*2); x.stroke();
  x.lineWidth=R*0.026; x.beginPath(); x.arc(cx,cy,R*0.778,0,Math.PI*2); x.stroke();
  arcText(x,cx,cy,R*0.868,'MALAYSIA',-Math.PI/2,R*0.150,false,SER);
  /* the Arabic is set as one run so the letters stay joined */
  x.font='600 '+(R*0.150)+'px "Noto Naskh Arabic","Traditional Arabic",'+SER;
  x.fillText('ماليزيا',cx,cy+R*0.918);
  star5(x,cx-R*0.866,cy,R*0.074);
  star5(x,cx+R*0.866,cy,R*0.074);
  /* black disc carrying the eight-point star */
  x.beginPath(); x.arc(cx,cy,R*0.742,0,Math.PI*2); x.fill();
  x.fillStyle='#fff';
  for(const rot of [0,Math.PI/4]){ x.save(); x.translate(cx,cy); x.rotate(rot);
    const s=R*0.522; x.fillRect(-s,-s,s*2,s*2); x.restore(); }
  x.fillStyle='#111';
  x.font='600 '+(R*0.44)+'px "Noto Naskh Arabic","Traditional Arabic",'+SER;
  x.fillText('حلال',cx,cy+R*0.10);
  if('letterSpacing' in x) x.letterSpacing=(R*0.055)+'px';
  x.font='600 '+(R*0.135)+'px '+SER;
  x.fillText('HALAL',cx,cy+R*0.38);
  if('letterSpacing' in x) x.letterSpacing='0px';
  x.restore();
}
/* a tapered feather blade, used for the phoenix wings, crest and tail */
function feather(x,x0,y0,ang,len,w0,w1,bow){
  const cx=Math.cos(ang),cy=Math.sin(ang),px=-cy,py=cx,b=bow||0;
  const mx=x0+cx*len*0.5+px*b, my=y0+cy*len*0.5+py*b;
  const ex=x0+cx*len, ey=y0+cy*len;
  x.beginPath();
  x.moveTo(x0+px*w0,y0+py*w0);
  x.quadraticCurveTo(mx+px*w1,my+py*w1,ex,ey);
  x.quadraticCurveTo(mx-px*w1,my-py*w1,x0-px*w0,y0-py*w0);
  x.closePath(); x.fill();
}
/* the Vit's phoenix: crest, curved neck, spread wings of radiating feathers, flowing tail */
function phoenix(x,cx,cy,k){
  x.save(); x.translate(cx,cy); x.scale(k,k); x.fillStyle=CR;
  for(const s of [-1,1]){
    for(let i=0;i<7;i++){                       /* primaries, swept up and out */
      const t=i/6, a=-0.15-t*0.74;
      feather(x,s*16,-4,s>0?a:Math.PI-a,62+t*64,7-t*3,9.5-t*4.5,s*(7+t*12));
    }
    for(let i=0;i<3;i++){                       /* coverts under the wing */
      const t=i/2, a=0.10+t*0.22;
      feather(x,s*14,12,s>0?a:Math.PI-a,44+t*30,6.5,7.5,s*5);
    }
  }
  for(let i=-3;i<=3;i++){                       /* tail, longest in the middle */
    const t=Math.abs(i)/3;
    feather(x,0,50,Math.PI/2+i*0.25,78+(1-t)*46,6.5-t*2,7.5-t*3,i*8);
  }
  x.beginPath(); x.ellipse(0,18,20,40,0,0,Math.PI*2); x.fill();          /* breast */
  x.beginPath();                                                         /* neck */
  x.moveTo(-13,4); x.quadraticCurveTo(-17,-34,-5,-52);
  x.lineTo(10,-45); x.quadraticCurveTo(2,-28,9,2); x.closePath(); x.fill();
  x.beginPath(); x.ellipse(1,-57,12,14,0.2,0,Math.PI*2); x.fill();       /* head */
  x.beginPath(); x.moveTo(11,-59);                                       /* beak */
  x.lineTo(27,-55); x.lineTo(11,-51); x.closePath(); x.fill();
  for(let i=0;i<3;i++) feather(x,-3,-67,-1.95-i*0.24,26+i*11,3.5,4.5,-5-i*4);
  x.restore();
}
/* front panel geometry, shared with the die-cut mask so they cannot drift apart */
const FW=1024,FH=1147;                      /* 250mm x 280mm face */
/* ---- every figure below is measured off a perspective-rectified CLIENT STUDIO
   PHOTO of the current production bag (grid-measured 21 Aug), expressed in this
   canvas's own coordinates. Do not eyeball these. */
/* Border band, re-measured 1 Sep against studio-3q AND ref-05 together.
   ref-05 is a CROP of the front (its border is cut at both edges), so its
   1024 is about 0.92 of the face, not the face — reading it as the full face
   is what halved this. On the plate the printed module repeats 23 times
   across the face and the ink runs 45 of the canvas's 1024; it was drawing 46
   modules in a 25px band, a border half the size at twice the frequency. */
/* BAND_BOT re-solved 1 Sep off the gusset plate, read on a tenths grid: the
   printed bottom border runs 0.937 to 0.988 of the pack height, which is art
   y 1079-1134 once the piecewise fold mapping is applied. It was at 990,
   putting the border 7% of the pack too high and leaving a band of bare
   yellow under it that the pack does not have. */
/* BAND_BOT again, 2 Sep: the 3q plate puts the bottom ink at 88-94% of the
   true height and the gusset plate (its tail taken out) at 90.5-95.5, so the
   ink belongs at 89-95: 1040 here, with the rounded base curling under it. */
const BAND_H=50, BAND_TOP=281, BAND_BOT=976;   /* 3 Sep, rows read off the plate at the matched silhouette: top band 1.0% of the box high of 292, bottom 2.0% high of 997, both 20% shorter than 63 */
/* LAID TO THE PLATE, 1 Sep. Every front element was measured on studio-3q as a
   fraction of the face width and of the wall height (crease to base), and the
   same fractions on this canvas put it here. The mark's ry is set so that, after
   the panel mapping stretches the canvas 1.2x vertically, it renders at the
   plate's 1.8, not the 1.5 it was rendering at. */
const OVAL={cx:564,cy:659,rx:269,ry:115};   /* 3 Sep: against the studio plate in the same frame, with the solid red bodies isolated by erosion so keylines and waves could not contaminate them, the mark measured 0.348 of the box wide against the pack's 0.386, and 0.005 of the box left of it. rx 245 -> 269, cx +6. */
const WIN ={cx:563,cy:877,rx:272,ry:92,lw:9};              /* 2 Sep, studio-3q standing: 40% of the box wide, 17.5% tall, top at 66% */
/* re-measured off the rectified photo 22 Aug: strand pitch 40 not 35, and the
   white is FATTER than the yellow gap (w22), so the column reads white-led */
/* The wave column, measured in a band clear of the roundel: on the plate it
   starts at 0.662 of the face and runs to the edge, ten strands at a pitch of
   0.0359 of the face. It was drawing eight at 0.042 — too few, too coarse,
   and stopping short of the fold. */
const WAVE={x0:678,pitch:37,n:10,w:17,amp:6.5,period:126,top:350,bot:974};   /* 3 Sep: the plate's white share across the column is 0.47, 20 gave 0.54 */   /* 3 Sep: the judge had the wave column sitting 1.9% of the box high */   /* bot sits above BAND_BOT (997): at 1071 the round caps printed a row of white dots under the border */
const OVAL_RY=OVAL.ry;
/* The cake behind the film. The tone comes from the real pack (the window
   photo, with the printed type inpainted out); crinkled strands are drawn over
   it to put back the crisp structure the inpaint could not recover. */
/* Instant-noodle cake texture, tuned against the client window photo:
   layered crinkle strands (shadow / body / highlight), soft light blobs
   sandwiched between passes, broken accent segments and loose curls.
   Deterministic rand, canvas primitives only. */
function noodlePrint(x,cx,cy,rx,ry){
  var frac=function(v){ return v-Math.floor(v); };
  var rnd=function(i){ return frac(Math.sin(i*12.9898)*43758.5453); };
  var rgba=function(r,g,b,a){ return "rgba("+r+","+g+","+b+","+(a/255)+")"; };

  /* fixed print scale: strand size is constant on the bag whatever the
     window, so the gusset shows the same noodles as the front */
  var sc=1.08;
  var RW=(2*rx)/sc, RH=(2*ry)/sc;
  var density=RW/520;

  x.save();
  x.beginPath();
  x.rect(cx-rx,cy-ry,2*rx,2*ry);
  x.clip();
  x.translate(cx-rx,cy-ry);
  x.scale(sc,sc);
  x.lineCap="round"; x.lineJoin="round";

  x.fillStyle="rgb(207,152,95)";
  x.fillRect(0,0,RW,RH);

  function polyline(pts,color,width){
    x.strokeStyle=color; x.lineWidth=width;
    x.beginPath(); x.moveTo(pts[0][0],pts[0][1]);
    for(var i=1;i<pts.length;i++) x.lineTo(pts[i][0],pts[i][1]);
    x.stroke();
  }
  function arcStroke(ax,ay,r,a0deg,a1deg,color,width){
    x.strokeStyle=color; x.lineWidth=width;
    x.beginPath(); x.arc(ax,ay,r,a0deg*Math.PI/180,a1deg*Math.PI/180); x.stroke();
  }

  var SH=[110,78,42], HI=[255,248,226];

  function strand(s,x0,ytop,ybot,tilt,bodies,bw,hiA,shA){
    var phase=rnd(s+1)*Math.PI*2;
    var period=28*(0.85+rnd(s+2)*0.4);
    var amp=3.2*(0.75+rnd(s+3)*0.6);
    var pts=[];
    for(var y=ytop;y<=ybot;y+=3){
      var xx=x0+Math.sin(y*2*Math.PI/period+phase)*amp
            +Math.tan(tilt)*(y-(ytop+ybot)/2)
            +Math.sin(y*0.012+phase*3)*5;
      pts.push([xx,y]);
    }
    var body=bodies[Math.min(bodies.length-1,Math.floor(rnd(s+7)*bodies.length))];
    var sh=pts.map(function(p){ return [p[0]+2,p[1]+2]; });
    var hi=pts.map(function(p){ return [p[0]-1.5,p[1]-2]; });
    polyline(sh,rgba(SH[0],SH[1],SH[2],Math.floor(shA*0.55)),bw+6);
    polyline(sh,rgba(SH[0],SH[1],SH[2],shA),bw+1);
    polyline(pts,rgba(body[0],body[1],body[2],110),bw+4);
    polyline(pts,rgba(body[0],body[1],body[2],235),bw);
    polyline(hi,rgba(255,246,220,Math.floor(hiA*0.5)),Math.max(3,Math.floor(bw*0.5)));
    polyline(hi,rgba(HI[0],HI[1],HI[2],hiA),Math.max(2,Math.floor(bw*0.28)));
  }

  function strandPass(seedbase,pitch,bodies,hiA,shA,skip){
    var ncols=Math.floor(RW/pitch)+3;
    for(var c=0;c<ncols;c++){
      var s=seedbase+c*13;
      if(rnd(s+11)<skip) continue;
      var cl=Math.floor(c/5);
      var tilt=(rnd(cl*91+seedbase)-0.5)*2*(20*Math.PI/180);
      var x0=c*pitch-pitch+(rnd(s)-0.5)*pitch*1.2;
      var bw=12+Math.floor(rnd(s+4)*5);
      var ytop=-16+(rnd(s+5)-0.5)*12;
      var ybot=RH+16+(rnd(s+6)-0.5)*12;
      strand(s,x0,ytop,ybot,tilt,bodies,bw,hiA,shA);
    }
  }

  strandPass(100,16,[[244,196,144],[248,204,152],[240,188,136]],85,100,0.0);

  var nBlobs=Math.round(24*density);
  for(var i=0;i<nBlobs;i++){
    var s=1500+i*23;
    var bx=rnd(s)*RW, by=rnd(s+1)*RH;
    var ang=rnd(s+2)*Math.PI;
    var ln=70+rnd(s+3)*120;
    var bpts=[[bx-Math.cos(ang)*ln/2,by-Math.sin(ang)*ln/2],
              [bx+Math.cos(ang)*ln/2,by+Math.sin(ang)*ln/2]];
    var col=rnd(s+4)<0.45?rgba(150,105,60,20):rgba(255,242,214,22);
    polyline(bpts,col,Math.floor(50+rnd(s+5)*70));
  }

  strandPass(900,24,[[250,214,162],[252,221,172],[246,207,154]],110,110,0.25);

  var nAcc=Math.round(40*density);
  for(i=0;i<nAcc;i++){
    s=3000+i*29;
    var ax0=rnd(s)*RW;
    var ay0=rnd(s+8)*RH;
    var ln2=30+rnd(s+9)*45;
    var tilt2=(rnd(s+10)-0.5)*2*(25*Math.PI/180);
    var bw2=10+Math.floor(rnd(s+4)*4);
    strand(s,ax0,ay0-ln2/2,ay0+ln2/2,tilt2,
           [[251,217,166],[245,203,150],[253,224,176]],bw2,120,110);
  }

  var nCurl=Math.round(24*density);
  for(i=0;i<nCurl;i++){
    s=500+i*17;
    var ax=rnd(s)*RW, ay=rnd(s+1)*RH;
    var r=16+rnd(s+2)*14;
    var a0=rnd(s+3)*360;
    var a1=a0+100+rnd(s+4)*160;
    var bw3=13+Math.floor(rnd(s+5)*3);
    arcStroke(ax+2,ay+2,r,a0,a1,rgba(SH[0],SH[1],SH[2],100),bw3+3);
    var body=rnd(s+6)<0.5?[250,212,158]:[244,199,146];
    arcStroke(ax,ay,r,a0,a1,rgba(body[0],body[1],body[2],120),bw3+4);
    arcStroke(ax,ay,r,a0,a1,rgba(body[0],body[1],body[2],235),bw3);
    arcStroke(ax-1,ay-2,r,a0+25,a1-25,rgba(255,247,222,110),Math.max(2,Math.floor(bw3*0.3)));
  }

  x.fillStyle=rgba(248,205,158,20);
  x.fillRect(0,0,RW,RH);

  /* the film glare: the studio photo washes the upper half of the window in a
     broad soft white reflection, so the cake reads pale at the top and only
     shows its full colour along the lower lobe */
  var hz=x.createRadialGradient(RW*0.38,RH*0.12,RH*0.10,RW*0.40,RH*0.15,RH*1.35);
  hz.addColorStop(0,'rgba(255,255,255,0.26)');
  hz.addColorStop(0.55,'rgba(255,255,255,0.14)');
  hz.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=hz; x.fillRect(0,0,RW,RH);

  x.restore();
}
/* a line of type bowed along a shallow arc, letterspaced to fill the chord —
   the way INSTANT NOODLES follows the window's top curve on the real bag */
function arcLine(x,str,cx,apexY,chordW,bow,font,fill,strokeW,spaceK){
  if(!str) return;
  const R=(chordW*chordW/4+bow*bow)/(2*bow);    /* circle through ends and apex */
  const cy=apexY+R;
  x.save(); x.font=font; x.fillStyle=fill;
  /* the real print is a heavy grot; a same-colour stroke under the fill
     fattens the letters the way the press does */
  if(strokeW){ x.strokeStyle=fill; x.lineWidth=strokeW; x.lineJoin='round'; }
  x.textAlign='center'; x.textBaseline='alphabetic';
  /* spaceK widens the word gap: the real print's INSTANT|NOODLES gap is near
     twice a normal space, which shifts every NOODLES letter rightward */
  const g=[...String(str)], wid=g.map(ch=>x.measureText(ch).width*(ch===' '?(spaceK||1):1));
  const total=wid.reduce((a,b)=>a+b,0)||1;
  const half=Math.asin(Math.min(0.999,chordW/2/R));
  let acc=0;
  for(let i=0;i<g.length;i++){
    const mid=acc+wid[i]/2; acc+=wid[i];
    const a=-Math.PI/2-half+2*half*(mid/total);
    x.save();
    x.translate(cx+Math.cos(a)*R,cy+Math.sin(a)*R);
    x.rotate(a+Math.PI/2);
    if(strokeW) x.strokeText(g[i],0,0);
    x.fillText(g[i],0,0);
    x.restore();
  }
  x.restore();
}
/* The three window lines, measured off the client studio photo: INSTANT
   NOODLES arcs over a 520px chord, 快熟麵 is letterspaced across 310px,
   MI SEGERA fills 350px. The whole lockup prints ~10px left of the window's
   geometric centre on the real bag, and the yellow stars flank the Chinese
   ON THE FILM, over the fill. */
function windowType(x){
  /* The variety lines are the pack's own lettering, lifted from ref-05 and laid
     back at the coordinates they came from. Setting them in Inter was the last
     visible tell: the geometry measured right while the letterforms did not
     match. The drawn version below still runs if the artwork is missing. */
  if(winTypeImg&&winTypeImg.complete&&winTypeImg.naturalWidth){
    /* laid for a 113 ry at cy 907; scaled with the window's height since */
    const k=WIN.ry/113;
    x.drawImage(winTypeImg,WIN.cx+(299-538),WIN.cy+(834-907)*k,winTypeImg.naturalWidth,winTypeImg.naturalHeight*k);
    return;
  }
  /* each line has its own measured centre on the real print. The blend against
     the rectified photo showed the print is BOLDER and TIGHTER than the first
     pass: chord 480 not 520, stroked-under-fill weight, MI SEGERA a size up. */
  arcLine(x,pk('variety.en','INSTANT NOODLES'),WIN.cx+2,WIN.cy-38,460,34,'900 46px '+PF,CR,2.0,1.9);
  const zh=String(pk('variety.zh','快熟麵'));
  /* the bag prints the Chinese in a BOLD brush (kai) face; kai fonts ship in
     one weight, so the bold is built with a stroked outline under the fill.
     Grid-measured 22 Aug: the chars are 52px and TIGHT (spread 172, centre 8px
     left of the window's), not the wide letterspaced row of the first pass. */
  x.save(); x.font='50px "Kaiti SC","STKaiti","KaiTi","DFKai-SB","BiauKai","Noto Serif SC",serif';
  x.fillStyle=CR; x.strokeStyle=CR; x.lineWidth=2.4; x.lineJoin='round'; x.textAlign='center';
  const zc=WIN.cx-9, zn=zh.length||1, zp=zn>1?150/(zn-1):0;
  for(let i=0;i<zn;i++){
    const px=zc-75+(zn>1?i*zp:75);
    x.strokeText(zh[i],px,WIN.cy+24); x.fillText(zh[i],px,WIN.cy+24);
  }
  x.restore();
  /* MI SEGERA is letterspaced across its width like the lines above it, so it
     rides a near-flat arc rather than being stretched glyph-by-glyph */
  arcLine(x,pk('variety.ms','MI SEGERA'),WIN.cx-13,WIN.cy+73,298,3,'900 50px '+PF,CR,1.4);
  star4(x,450,WIN.cy-96,11);
  star4(x,718,WIN.cy-98,11);
}
/* THE CLAIM IS A RIBBON. Not a bar with arrowheads on it, which is what a
   notched rectangle gives you and what this drew for two rounds.

   A banner is built the way a real ribbon hangs. The centre band runs between
   two FOLD lines. At each fold the ribbon turns back on itself, and the piece
   beyond hangs outward and DOWN, showing its underside, which is darker
   because it is in shadow. The swallowtail notch is cut into the outer end of
   that hanging tail, never into the band. The band flares a little at the
   folds, because the ribbon is under tension there, and it sags between them,
   because a banner pinned at two points does.

   Get those four things right and it reads as ribbon at any size. Miss the
   hanging tails and it is a bar. */
function claimRibbon(x,bx,by,bw,bh,tk){
  tk=tk||1;                          /* tail scale: the 5-pack's banner curls its tails larger than the range packs' */
  const flare=bh*0.15, sag=bh*0.16;
  const tw=bh*1.25*tk, drop=bh*0.62*tk, notch=bh*0.52*tk;
  x.save();
  /* the two hanging tails, drawn first so the band laps over their folds */
  x.fillStyle=CR_TAIL;
  for(const s of [-1,1]){
    const ex = s<0 ? bx : bx+bw;
    x.beginPath();
    x.moveTo(ex, by-flare);                                  /* the fold, top    */
    x.lineTo(ex+s*tw, by-flare+drop);                        /* out and down     */
    x.lineTo(ex+s*(tw-notch*0.62), by-flare+drop+bh*0.46);   /* into the notch   */
    x.lineTo(ex+s*tw, by-flare+drop+bh*1.02);                /* the second point */
    x.lineTo(ex, by+bh+flare);                               /* the fold, bottom */
    x.closePath(); x.fill();
  }
  /* the crease where the ribbon turns: a slim dark wedge inside each fold */
  x.fillStyle=CR_FOLD;
  for(const s of [-1,1]){
    const ex = s<0 ? bx : bx+bw;
    x.beginPath();
    x.moveTo(ex, by-flare);
    x.lineTo(ex+s*bh*0.30, by+bh*0.16);
    x.lineTo(ex+s*bh*0.30, by+bh*0.86);
    x.lineTo(ex, by+bh+flare);
    x.closePath(); x.fill();
  }
  /* the band itself: flared at the folds, sagging between them */
  const g=x.createLinearGradient(0,by-flare,0,by+bh+flare);
  g.addColorStop(0,CR_ROOF); g.addColorStop(0.35,CR_ROOF2); g.addColorStop(0.82,CR_ROOF2); g.addColorStop(1,CR_ROOF);   /* 3 Sep: the Chinese line sat in the dark foot of the band and vanished */
  x.fillStyle=g;
  x.beginPath();
  x.moveTo(bx, by-flare);
  x.quadraticCurveTo(bx+bw/2, by+sag, bx+bw, by-flare);      /* the top edge   */
  x.lineTo(bx+bw, by+bh+flare);
  x.quadraticCurveTo(bx+bw/2, by+bh+sag, bx, by+bh+flare);   /* the foot       */
  x.closePath(); x.fill();
  x.restore();
}
function drawFront(v2){
  const [c,x]=panel(FW,FH);
  const A=v2?V2A:1;
  x.fillStyle=CF; x.fillRect(0,0,FW,FH);
  /* the wave column: 8 white strands down the right of the face, running from
     the top band to the bottom one. Pitch, width, amplitude and period are all
     measured off the rectified scan, and they run in phase as printed. */
  x.strokeStyle='#fff'; x.lineWidth=WAVE.w; x.lineCap='round';
  const kw=Math.PI*2/WAVE.period;
  for(let i=0;i<WAVE.n;i++){
    const ox=WAVE.x0+i*WAVE.pitch;
    x.beginPath();
    for(let y=WAVE.top;y<=WAVE.bot;y+=3) x.lineTo(ox+Math.sin(y*kw)*WAVE.amp,y);
    x.stroke();
  }
  x.lineCap='butt';
  /* the shoulder above the print: yellow with a SLIM row of the red script at
     the very fold, matching the real crimp; the rest of the shoulder is clean */
  x.fillStyle=CR; x.textAlign='center';
  x.font='italic 800 24px Inter,Helvetica,Arial,sans-serif';
  for(let i=0;i<14;i++) x.fillText(pk("sealRepeat","Vit's"),40+i*74,28);
  /* the no-preservatives claim rides the FRONT shoulder too: the studio shot
     shows it in red just under the seal, above the border */
  x.save();
  /* 2 Sep, off studio-3q: the ribbon spans 62% of the box (it rendered 70%)
     and its centre sits 3% of the box RIGHT of the face centre, which is 40px
     here, not on the axis */
  claimRibbon(x,124,120,778,80,1.2);   /* 3 Sep: the plate's banner is 8.7% of the box tall (80 here) and sits above the roof's crease shadow, which ate its Chinese line at 141 */
  x.textAlign='center'; x.fillStyle=CF;
  /* 3 Sep, ribbon pair: the plate's line fills 0.88 of the banner; centred at its natural width it filled 0.38
     and read as a label on a bar rather than a printed ribbon. fitText stretches it to the band. */
  /* on the plate the Malay line is 0.40 of the band tall and 70% of it wide, the
     Chinese 0.28 tall under it; both in the pack's yellow */
  fitText(x,pk('claim.en','Tiada Pengawet Tambahan'),513,161,560,'italic 800 32px '+PF,CF);
  fitText(x,pk('claim.zh','不添加防腐剂'),513,186,260,'700 22px "Noto Sans SC","Microsoft YaHei",sans-serif',CF);
  x.restore();
  meander(x,0,BAND_TOP,FW,BAND_H,CMEA);
  meander(x,0,BAND_BOT,FW,BAND_H,CMEA);
  /* the phoenix, lifted from the pack artwork; drawn bird as fallback.
     It sits on the mark's axis, right of the face centre as printed. */
  if(phxImg&&phxImg.complete&&phxImg.naturalWidth){
    /* the plate: centre (0.544, 0.179) of face and wall, 0.189 of the face wide */
    const pw=200, ph=pw*phxImg.naturalHeight/phxImg.naturalWidth;   /* 2 Sep element pass: 14.7% wide vs the plate's 13.9; 3 Sep at the matched silhouette 13.6 x 9.2 vs 13.9 x 9.8, 1.4% of the box right */
    x.drawImage(phxImg,551-pw/2,424-ph/2,pw,ph);   /* 3 Sep: measured as a solid body the printed bird is heavier than this artwork draws it, so it goes up a size and back onto the plate's axis */   /* 3 Sep, at W=0.93: 1.4% of the box left */ /* the ® is part of this artwork */
  } else {
    phoenix(x,557,432,0.71);   /* 3 Sep: the judge put the bird 1.4% of the box right of the plate's and 4% small */
    x.fillStyle=CR; x.font='700 24px '+PF; x.textAlign='left';
    x.fillText('®',OVAL.cx+118,366);
  }
  /* JAKIM halal mark, top left against the fold, lifted from the pack artwork.
     The cert lines beneath print small and light on the real bag. */
  if(halalImg&&halalImg.complete&&halalImg.naturalWidth){
    /* the printed chop is smaller and lighter than the first pass: 128 wide,
       eased to grey so it sits back the way the fine print does */
    /* the printed chop is a touch WIDER than tall (132x124 on the photo) */
    /* the plate: centre (0.117, 0.192), 0.110 of the face wide. The re-cut
       artwork carries the Arabic line under the ring, so it is sized by width */
    /* 2 Sep: this canvas lands on a face 1.27x taller per wide than the
       canvas itself, so the chop is drawn wide and short to come out round:
       measured 8.2 x 10.8 percent of the box at 113 x natural, the plate
       reads 11.1 x 10.1, centre (29.5, 36.7) of the box */
    /* 7 Sep, Bazil: "the halal is oval". Measured on the specimen at the hero's rest
       turn (-0.34 rad, fov 16 so no perspective in it): straight-on the chop is round,
       turned it reads ~1.15 wide, because the print sits where the front starts to
       curve toward the fold. Drawn 8% narrower it is round where everyone sees it and
       0.92 straight-on, which the eye does not catch. */
    const hw=v2?139:153, hh=v2?Math.round(151*0.985/A):Math.round(hw*halalImg.naturalHeight/halalImg.naturalWidth);   /* 3 Sep: at 0.72 the chop rendered 1.20 wide per tall once the view angle was taken out; the plate's is round */
    x.save(); x.globalAlpha=0.92;
    x.drawImage(halalImg,(v2?137:124)-hw/2,(v2?433:452)-hh/2,hw,hh);   /* 3 Sep, at W=0.93: the judge had the chop 2.5% of the box left of the plate's, and 1% of the box is 11.9 canvas px on this face */   /* 3 Sep: the plate's chop sits 2.1% of the box higher and 1.3% further from the crease than 124,452 gave */
    x.restore();
  } else jakimMark(x,120,443,54);
  /* the cert lines barely register on the plate: small and light */
  x.fillStyle='#8f7f3a'; x.font='400 11px '+PF; x.textAlign='left';
  x.fillText(pk('halal.certLine1','MS 1500'),70,530);
  x.fillText(pk('halal.certLine2','1 001-01/2005'),70,545);
  /* the mark sits BEHIND the window on the real bag, so it is laid first */
  /* standing, studio-3q reads the outer mark at 1.54 wide per tall */
  drawLogo(x,OVAL.cx,OVAL.cy,OVAL.rx*2,v2?0.572:undefined);   /* 3 Sep: the mark's own aspect, so widening it does not also make it taller. 1/(1.54*A) gave 0.629 and read round beside the pack's oval. */
  /* the die-cut window over it: cake behind the film, ONE red keyline as on
     the production bag, variety type printed on the film */
  x.save();
  x.beginPath(); x.ellipse(WIN.cx,WIN.cy,WIN.rx-4,WIN.ry-4,0,0,Math.PI*2);
  x.save(); x.clip();
  const realOval=v2&&ovalPhoto&&ovalPhoto.complete&&ovalPhoto.naturalWidth;
  if(realOval){
    /* the client's own window, photographed: cake, film sheen and the printed
       type, stretched onto the oval's box (its keyline lands on ours) */
    x.drawImage(ovalPhoto,WIN.cx-WIN.rx-6,WIN.cy-WIN.ry-4,WIN.rx*2+12,WIN.ry*2+8);
  } else {
    noodlePrint(x,WIN.cx,WIN.cy,WIN.rx-4,WIN.ry-4);
    /* the REAL cake, lifted from the rectified studio photo: honest pixels keep
       full alpha, the zones under the printed type are feathered out so the
       matched procedural print above fills them. Exactly the window's box. */
    if(windowImg&&windowImg.complete&&windowImg.naturalWidth)
      x.drawImage(windowImg,WIN.cx-WIN.rx,WIN.cy-WIN.ry,WIN.rx*2,WIN.ry*2);
  }
  x.restore();
  x.strokeStyle=CR; x.lineWidth=WIN.lw;
  x.beginPath(); x.ellipse(WIN.cx,WIN.cy,WIN.rx,WIN.ry,0,0,Math.PI*2); x.stroke();
  if(!realOval) windowType(x);
  x.restore();
  /* Mini pack count, bottom left, as printed: "Mini" in white bubble letters
     with a black outline (no lozenge), the Chinese stacked small in black, then
     the box: black outline, solid black cell behind a white 5 that breaks the
     box foot, and the units on the bare yellow field */
  x.textAlign='left'; x.lineJoin='round';
  /* the real Mini is an UPRIGHT fat rounded letterform, wide-set: the word
     spans 190px from the fold. Drawn at natural width then scaled to fit. */
  x.save();
  /* THE COUNT BLOCK, laid to the plate. The black cell behind the 5 measures
     0.096 of the wall on the pack, which is 84px here; it was drawn 139 tall,
     and every line inside it was scaled to that. The whole lockup comes down
     to the cell: Mini above it at 44px, the 5 at 74px, the three unit lines
     at 21px. */
  /* ELEMENT 3, the count block, re-laid 2 Sep off the render-vs-plate pair at
     the solved camera. Printed: the frame is 1.43 wide per tall (it was drawn
     2.02), the black cell 0.46 of the frame width, the 5 filling 0.83 of the
     cell height, Mini 0.36 of the frame height by 0.62 of its width under a
     heavy outline, and the whole block 1.8% of the box higher than it sat.
     The frame ends at 274 with the oval starting at 291, and its foot at 993
     clears the bottom border's ink at 1011. */
  /* second pass at the solved camera: Mini taller under a heavier outline,
     the 5 filling its cell to the top, the units a size up on tighter leading,
     the block 10px right of where the judge put it.
     Third pass, 3 Sep, against the plate pair at the matched silhouette (v=195): Mini 7% smaller and 12px lower,
     the frame 7px lower and 7px shorter, the whole block 22px left, the 5 in Arial Black.
     Fourth pass, same pair at v=196: the frame measured 429 tile px against the plate's 360, so 115 tall, not 135;
     the 5 at 75% of its cell (120px, 12px off the cell floor), the units on 30px leading, Mini 4% wider. */
  x.font='800 65px "Arial Rounded MT Bold",'+PF;
  const miniStr=pk('count.prefix','Mini');
  const miniW=x.measureText(miniStr).width||1;
  x.translate(74,852); x.scale(133/miniW,1);
  x.strokeStyle=CIK; x.lineWidth=10*miniW/133;
  x.strokeText(miniStr,0,0);
  x.fillStyle='#fff'; x.fillText(miniStr,0,0);
  x.restore();
  const pfs=String(pk('count.prefixSmall','迷你'));
  x.fillStyle=CIK; x.font='700 27px "Noto Sans SC","Microsoft YaHei",sans-serif';
  x.fillText(pfs.charAt(0),217,824);
  if(pfs.length>1) x.fillText(pfs.charAt(1),217,851);
  x.strokeStyle=CIK; x.lineWidth=4; x.strokeRect(79,858,204,115);   /* 3 Sep, at W=0.93: the block sat 1.8% of the box left */
  x.fillStyle=CIK; x.fillRect(79,858,92,115);     /* the cell behind the 5 */
  x.fillStyle='#fff'; x.font='900 120px "Arial Black",'+PF; x.fillText(pk('count.number','5'),83,961);
  x.fillStyle=CIK;
  x.font='700 30px '+PF;    x.fillText(pk('count.unit1','Cakes'),181,894);
  x.font='700 30px "Noto Sans SC","Microsoft YaHei",sans-serif';
  x.fillText(pk('count.unit2','塊'),181,924);
  x.font='italic 700 30px '+PF; x.fillText(pk('count.unit3','Keping'),181,954);
  /* net weight, hard against the right edge over the wave column as printed:
     two small labels, the value in condensed bold, the Arabic line tiny */
  /* ELEMENT 5, the net weight, off the floor photo and the per-element judge:
     the printed block reads BERAT BERSIH / then NET WEIGHT / 淨重 in small
     caps, the value bold beneath, the Arabic a size down, all tightly leaded
     into 6.9% of the box. It rendered 13.2% tall with the two labels in the
     wrong order and the wrong words. */
  /* second pass off the render-vs-plate pair: the labels print at a regular
     weight, the value at twice their height in a condensed bold, and the block
     sits 12px higher. The judge's 12.3% height on this element was the dark
     gusset edge inside its window, not the block.
     Third pass off the pair at v=195: the value matched, the two captions and the Arabic printed lighter and
     smaller than the plate's, so 700 at 15px and 13px.
     Fourth pass, pair at v=197: the block stood 1.3% of the box above the plate's and the value printed 14%
     narrower than its condensed bold, so 14px down, the value 152 wide at 50px, the Arabic 150 wide. */
  x.fillStyle=CIK; x.textAlign='left';
  x.font='700 15px '+PF; x.fillText(pk('netWeight.line1','BERAT BERSIH /'),876,880);
  fitText(x,pk('netWeight.line2','NET WEIGHT / 淨重'),941,897,130,'700 15px '+PF,CIK);
  fitText(x,pk('netWeight.value','350g/12.35oz'),948,933,152,'800 50px '+PF,CIK);
  x.textAlign='center';
  fitText(x,pk('netWeight.arabic','الوزن الصافي : 350 غرام / 12.35 أونس'),944,952,150,
          '700 13px "Noto Naskh Arabic","Traditional Arabic",serif','#222');
  x.textAlign='left';
  /* the measured bag's face is the client's photograph, not a painting of it:
     laid over the wall from the crease down; the roof strip above keeps the
     painted ribbon and film. 278 is the wall's first row on this canvas. */
  if(v2&&refFrontImg&&refFrontImg.complete&&refFrontImg.naturalWidth){
    /* 8 Sep, Bazil, after a day of proportion work: "go back to its original, stretched looks
       better". This is the 7 Sep form exactly: the plate laid across the full canvas width. */
    x.save(); x.filter='saturate(1.16) contrast(1.05)';   /* 8 Sep, Bazil: "a bit vibrant" */
    x.drawImage(refFrontImg,0,278,FW,1078-278);
    x.restore();
  }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t;
}
/* back panel: cooking steps and the legal block, so the 360 has a real reverse */
function drawBack(){
  /* THE BACK, rebuilt 1 Sep off the client's own photograph after three
     independent readings of it agreed on the layout. What was there before was
     four centred red-headed paragraphs and a barcode, which is not what the
     pack has. What it has:

       left of the back seam    the mark, then two bilingual sections in BLACK
                                (they read warm brown on yellow film, but they
                                are black ink, not red), then the Arabic pair,
                                the best-before line, the barcode and the
                                address block
       the yellow strip         HACCP, product of Malaysia, the tidyman mark
                                and the storage lines
       right of the seam        a tall RED PANEL with a WAVY left edge, about
                                ten cycles down its height, carrying the
                                vegetarian mark and a pale information box with
                                the nutrition table, the allergen block and its
                                Chinese translation

     Anything the readings could not resolve on that crumpled shot is left out
     rather than invented; the nutrition figures are the pack's own where they
     were legible. */
  const [c,x]=panel(FW,FH);
  x.fillStyle=CF; x.fillRect(0,0,FW,FH);
  x.fillStyle=CR; x.textAlign='center';
  x.font='italic 800 24px Inter,Helvetica,Arial,sans-serif';
  for(let i=0;i<14;i++) x.fillText(pk("sealRepeat","Vit's"),40+i*74,28);
  claimRibbon(x,180,96,FW-360,84);
  x.fillStyle=CF; x.textAlign='center';
  /* the BACK's ribbon is the English claim with Arabic under it, read off desk-back.webp (3 Sep) */
  x.font='italic 700 30px '+PF; x.fillText(pk('claimBack.en','No Preservatives Added'),512,132);
  x.font='700 24px "Noto Sans SC","Microsoft YaHei",sans-serif';
  x.fillText(pk('claimBack.ar','بدون مواد حافظة مضافة'),512,164);
  meander(x,0,BAND_TOP,FW,BAND_H,CMEA);
  meander(x,0,BAND_BOT,FW,BAND_H,CMEA);

  /* ---- the red panel, right of the seam, its left edge a shallow wave ---- */
  const PX=728, PY0=470, PY1=986, AMP=21, CYC=10;   /* the photograph's panel is narrower: its wave sits at 0.71 of the width */
  x.save();
  x.beginPath();
  x.moveTo(FW,PY0);
  for(let yy=PY0; yy<=PY1; yy+=4){
    const t=(yy-PY0)/(PY1-PY0);
    x.lineTo(PX+Math.sin(t*Math.PI*2*CYC)*AMP, yy);
  }
  x.lineTo(FW,PY1); x.closePath();
  x.fillStyle=CR; x.fill();
  x.restore();

  /* the vegetarian mark, reversed out of the panel */
  x.save();
  x.strokeStyle=CF; x.lineWidth=3; x.translate(800,540);
  for(let i=0;i<8;i++){
    x.save(); x.rotate(i*Math.PI/4);
    x.beginPath(); x.ellipse(0,-19,8,19,0,0,Math.PI*2); x.stroke(); x.restore();
  }
  x.fillStyle=CF; x.font='700 22px "Noto Sans SC","Microsoft YaHei",sans-serif';
  x.textAlign='center'; x.fillText('齋',0,8);
  x.font='700 13px '+PF; x.fillText('VEGETARIAN',0,44);
  x.restore();

  /* the pale information box on the panel */
  const BX=768, BY=592, BW=232, BH=368;
  x.fillStyle='#F7EFD8'; x.fillRect(BX,BY,BW,BH);
  x.textAlign='left';
  x.fillStyle=CIK; x.font='700 13px '+PF;
  x.fillText('MAKLUMAT PEMAKANAN /',BX+10,BY+20);
  x.fillText('NUTRITION INFORMATION',BX+10,BY+36);
  /* set on its own lines: as one line it ran 13px past the box and printed
     the ": 5" on the red panel */
  x.font='400 8.5px '+PF;
  x.fillText('Hidangan Setiap Bungkusan /',BX+10,BY+50);
  x.fillText('Serving Per Package : 5',BX+10,BY+60);
  x.fillText('Saiz Hidangan / Serving size : 70g',BX+10,BY+70);
  /* the ruled grid: three columns, six rows, as printed */
  const rows=[['Tenaga / Energy','1352 kJ','1932 kJ'],
              ['Protein','7.2 g','10.3 g'],
              ['Jumlah Lemak / Total Fat','12.5 g','17.9 g'],
              ['Karbohidrat / Carbohydrate','47.1 g','67.3 g'],
              ['Jumlah Gula / Total Sugars','1.1 g','1.6 g'],
              ['Natrium / Sodium','611 mg','873 mg']];
  /* the grid drops below the serving lines, and the column heads are set
     small enough to sit inside their own columns: at 9px "Per Serving 70g" ran
     over "Per 100g" and both sat on the serving-size line above */
  const GX=BX+10, GY=BY+90, GW=BW-20, RH=15, C2=GW*0.55, C3=GW*0.79;
  x.strokeStyle='#8A7A55'; x.lineWidth=0.8;
  x.font='400 7.5px '+PF; x.fillStyle=CIK;
  x.fillText('Per Serving 70g',GX+C2,GY-3);
  x.fillText('Per 100g',GX+C3,GY-3);
  rows.forEach(function(r,i){
    const yy=GY+i*RH;
    x.strokeRect(GX,yy,GW,RH);
    x.beginPath(); x.moveTo(GX+C2,yy); x.lineTo(GX+C2,yy+RH);
    x.moveTo(GX+C3,yy); x.lineTo(GX+C3,yy+RH); x.stroke();
    x.fillText(r[0],GX+3,yy+12); x.fillText(r[1],GX+C2+3,yy+12); x.fillText(r[2],GX+C3+3,yy+12);
  });
  /* the allergen block, then a red rule, then its Chinese translation */
  let ay=GY+rows.length*RH+18;
  x.font='700 12px '+PF;
  x.fillText('MAKLUMAT ALERGEN /',GX,ay); ay+=14;
  x.fillText('ALLERGEN INFORMATION',GX,ay); ay+=16;
  x.font='400 10px '+PF;
  [ 'Mengandungi gandum (gluten).',
    'Mungkin mengandungi unsur-unsur',
    'krustasea, susu, moluska, ikan, bijan,',
    'soya, seleri, sulfur dioksida dan sulfit.','',
    'Contains wheat (gluten).',
    'May contains traces of crustacean, milk,',
    'mollusc, fish, sesame, soy, celery, sulphur',
    'dioxide and sulphite.' ].forEach(function(l){ x.fillText(l,GX,ay); ay+=11; });
  x.fillStyle=CR; x.fillRect(GX,ay,GW*0.62,3); ay+=16;
  x.fillStyle=CIK; x.font='400 10px "Noto Sans SC","Microsoft YaHei",sans-serif';
  [ '过敏原信息','含有麸质。可能含有微量的甲壳类','动物、牛奶、软体动物、鱼、芝麻、大豆、',
    '芹菜、二氧化硫和亚硫酸盐。' ].forEach(function(l){ x.fillText(l,GX,ay); ay+=12; });

  /* ---- the yellow strip: the certification furniture ---- */
  x.textAlign='center'; x.fillStyle=CIK;
  x.save();
  x.strokeStyle=CIK; x.lineWidth=3;
  x.beginPath(); x.arc(596,600,30,0,Math.PI*2); x.stroke();
  x.font='700 15px '+PF; x.fillText('HACCP',596,606);
  x.restore();
  x.font='700 12px '+PF;
  x.fillText('PRODUCT OF MALAYSIA',596,668);
  x.fillText('PRODUK MALAYSIA',596,684);
  x.font='400 12px '+PF; x.fillText('صنع في ماليزيا',596,700);
  x.font='400 12px "Noto Sans SC","Microsoft YaHei",sans-serif';
  x.fillText('马来西亚制造',596,716);
  /* the tidyman: a figure putting waste in a bin */
  x.save();
  x.strokeStyle=CIK; x.lineWidth=2.4;
  x.strokeRect(572,742,48,48);
  x.beginPath();
  x.arc(590,756,4,0,Math.PI*2);                       /* head  */
  x.moveTo(590,761); x.lineTo(590,774);                /* body  */
  x.moveTo(590,764); x.lineTo(600,760);                /* arm   */
  x.moveTo(590,774); x.lineTo(585,784); x.moveTo(590,774); x.lineTo(595,784);
  x.stroke();
  x.strokeRect(602,764,10,20);                         /* bin   */
  x.restore();
  x.font='700 10px '+PF;
  ['KEEP OUR COUNTRY','CLEAN','JAGA KEBERSIHAN','NEGARA KITA'].forEach(function(l,i){
    x.fillText(l,596,806+i*12);
  });
  x.font='400 10px "Noto Sans SC","Microsoft YaHei",sans-serif';
  x.fillText('保持国家清洁卫生',596,868);
  x.textAlign='left'; x.font='400 10px '+PF;
  ['Cara Penyimpanan:','Simpan di tempat dingin','dan kering, jauhkan dari','cahaya matahari','',
   'Storage Condition:','Keep in cool and dry place,','away from sunlight'
  ].forEach(function(l,i){ x.fillText(l,536,894+i*12); });

  /* ---- left of the seam: the mark, then the copy ---- */
  if(phxImg&&phxImg.complete&&phxImg.naturalWidth){
    /* below the top border, whose ink ends at 351: it was straddling it */
    const pw=100, ph=pw*phxImg.naturalHeight/phxImg.naturalWidth;
    x.drawImage(phxImg,200-pw/2,405-ph/2,pw*0.8,ph*0.8);   /* the photograph's mark is small and in the corner */
  } else phoenix(x,262,418,0.30);
  drawLogo(x,200,472,132);

  const L=48, WRAPW=58;
  function wrap(txt,max){
    const words=String(txt).split(/\s+/), lines=[]; let ln='';
    words.forEach(function(w){
      if((ln+' '+w).trim().length>max){ lines.push(ln.trim()); ln=w; } else ln+=' '+w;
    });
    if(ln.trim()) lines.push(ln.trim());
    return lines;
  }
  let sy=575;
  function section(head,body,zh){
    x.fillStyle=CIK; x.font='700 16px '+PF; x.textAlign='left';
    /* the headings are bilingual and long; set on one line they ran out of the
       column and over the certification strip beside it */
    String(head).split('|').forEach(function(h){ x.fillText(h.trim(),L,sy); sy+=18; });
    sy+=2;
    /* the whole column is set tight: at 15px the two sections, the Arabic pair
       and the foot block did not fit between the mark and the bottom border,
       and the address ran under the fold */
    x.font='400 12.5px '+PF;
    body.forEach(function(b){ wrap(b,WRAPW).forEach(function(l){ x.fillText(l,L,sy); sy+=14.5; }); sy+=3; });
    if(zh){
      x.font='400 12px "Noto Sans SC","Microsoft YaHei",sans-serif';
      zh.forEach(function(l){ x.fillText(l,L,sy); sy+=14; });
    }
    sy+=13;
  }
  /* THE COLUMN FITS ITS SPACE. Everything from the first heading to the
     barcode is laid once with no ink to find its height, then again squeezed
     vertically (never more than it needs) so the foot block ends above the
     bottom border. Before this the barcode printed through the border. */
  const COL_TOP=540, COL_LIMIT=992;
  function column(){
  sy=COL_TOP;
  section(pk('back.ingredientsHeading','RAMUAN / INGREDIENTS|成分：'),
    [ pk('back.ingredientsMs','Mi: Tepung Gandum, Air, Minyak Kelapa Sawit, Garam, Pemekat (INS 412), Humektan (INS 451 (i)), Pengawal Asid (INS 500 (i), INS 501 (i)).'),
      pk('back.ingredients','Noodles: Wheat Flour, Water, Palm Oil, Salt, Thickener (INS 412), Humectant (INS 451 (i)), Acidity Regulator (INS 500 (i), INS 501 (i)).') ],
    String(pk('back.ingredientsZh','面：面粉、水、棕榈油、食用盐、增稠剂 (INS 412)、|保湿剂 (INS 451 (i))、酸度调节剂 (INS 500 (i), INS 501 (i))。')).split('|'));
  section(pk('back.methodHeading','CARA PENYEDIAAN / PREPARATION METHOD|烹饪方法：'),
    [ pk('back.methodMs','Masukkan mi ke dalam 400ml air mendidih dan masak selama 3 minit. Kacau perlahan-lahan. Keluarkan mi dan tuskan. Hidangkan serta merta atau masukkan hiasan mengikut selera.'),
      pk('back.method','Put noodles into 400ml of boiling water. Simmer for 3 minutes with gentle stirring. Drain the water away. Serve immediately or may add with garnishing for taste.') ],
    String(pk('back.methodZh','将面条放入400毫升沸水中。用小火慢煮3分钟，轻轻搅拌。|把水滤干后，趁热享用或可以添加调味料增添口味。')).split('|'));

  /* the Arabic pair, set right to left against the seam */
  x.textAlign='right'; x.fillStyle=CIK; x.font='400 12px '+PF;
  x.fillText('مكونات المعكرون',462,sy); sy+=13;
  x.font='400 10px '+PF;
  x.fillText('ماء، زيت نخيل، ملح طعام، مثخن (INS 412)، مرطب (INS 451 (i))',462,sy); sy+=12;
  x.fillText('منظم الحموضة (INS 500 (i)، INS 501 (i)).',462,sy); sy+=16;
  x.font='400 12px '+PF; x.fillText('طريقة التحضير:',462,sy); sy+=13;
  x.font='400 10px '+PF;
  x.fillText('ماء مغلي ٤٠٠ مل، ٣ دقائق، تحريك خفيف.',462,sy); sy+=4;

  /* best before, then the barcode and the address block */
  /* the cap has to sit ABOVE the worst case the column can reach, or the
     Math.max never fires and the address prints through the Arabic */
  const FOOT=sy+14;
  x.textAlign='left'; x.fillStyle=CIK; x.font='700 13px '+PF;
  x.fillText(pk('back.bestBefore','BAIK SEBELUM / BEST BEFORE /'),L,FOOT);
  x.font='400 12px "Noto Sans SC","Microsoft YaHei",sans-serif';
  x.fillText('期前最佳：',L,FOOT+17);
  x.fillStyle='#fff'; x.fillRect(L,FOOT+26,200,62);
  x.fillStyle='#111';
  for(let i=0,bx=L+10;bx<L+190;i++){ const w=2+(i*7%4)*2;
    bx+=w+2+((i*5)%3); x.fillRect(bx,FOOT+31,w,40); }
  x.font='600 12px '+PF; x.textAlign='center';
  x.fillText(pk('back.barcode','9 556354 000605'),L+100,FOOT+82);
  x.textAlign='left'; x.fillStyle=CIK; x.font='400 11px '+PF;
  [ pk('back.mfrHeading','Dikilangkan Oleh / Manufactured by :'),
    pk('back.manufacturer','VIT MAKANAN (KUALA LUMPUR) SDN BHD'),
    pk('back.addr1','Lot 126, Taman Industri Rawang,'),
    pk('back.addr2','Selangor Darul Ehsan, Malaysia.')
  ].forEach(function(l,i){ x.fillText(l,268,FOOT+34+i*13); });
  sy=FOOT+90;
  }
  x.save(); x.globalAlpha=0; column(); x.restore();
  const need=sy-COL_TOP, k=Math.min(1,(COL_LIMIT-COL_TOP)/need);
  x.save(); x.translate(0,COL_TOP); x.scale(1,k); x.translate(0,-COL_TOP); column(); x.restore();
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t;
}
/* Side panel. The bundle holds five cakes on edge, so the gusset is ~0.6 of
   the face width, not the 0.4 this was drawn at: a bag that deep reads as a
   bundle rather than a flat slab. The layout below scales with it. */
const SW=614,SH=1147;
/* The window has to CLEAR both bands. At ry 368 it spanned 322..1058 against
   bands whose ink runs 296..341 and 1079..1124, so the cake and its keyline
   printed straight through the border at each end. */
const SWIN={cx:307,cy:700,rx:240,ry:315};   /* rx is 0.39 of the panel width; drawSideAt scales it */
/* Gusset layout, off the real pack: mark and variety type sit side by
   side at the panel's vertical centre, both reading bottom-to-top. */
const SOVAL={cx:427,cy:690,w:270};       /* the gusset mark comes down with the front one */
function sideType(x,tx,v2){
  /* v2 (2 Sep): the plate's three lines run 34% of the height long on a pitch
     a quarter of the depth apart, twice the size the first pass set them */
  /* the plate sets the three lines at three sizes: the English at 31, the
     Chinese as three spaced glyphs at 52 on an 85 pitch, MI SEGERA at 43;
     the lines sit 67 apart */
  const fs=v2?40:34, fz=v2?55:34, fm=v2?44:30, p=v2?54:36, cy=v2?622:690;   /* 3 Sep, side-on: the plate's three lines run about 12% larger than 36/50/40 */   /* 3 Sep, gusset pair: 38/52/42 ran 12% over the plate's lines, 30/42/34 ran 16% under */   /* 3 Sep, gusset pair at the matched silhouette: the three lines ran 20% larger than the plate's */   /* the plate's type is twice what 30 gave, cut side by side on 2 Sep */   /* gusset lockup: the plate's is 15.1 wide x 38 tall, this was 10.8 x 48 and 3.1% low */
  x.save(); x.translate(tx,cy); x.rotate(Math.PI/2); x.textAlign='center';
  x.font='700 '+fs+'px '+PF; x.fillText(pk('variety.en','INSTANT NOODLES'),0,v2?-p+12:-22);
  x.font='700 '+fz+'px "Kaiti SC","STKaiti","KaiTi","DFKai-SB","BiauKai","Noto Serif SC",serif';
  if(v2){
    const zh=String(pk('variety.zh','快熟麵')), n=zh.length;
    for(let i=0;i<n;i++) x.fillText(zh.charAt(i),(i-(n-1)/2)*85,18);
  } else x.fillText(pk('variety.zh','快熟麵'),0,16);
  x.font='700 '+fm+'px '+PF; x.fillText(pk('variety.ms','MI SEGERA'),0,v2?p+16:52);
  x.restore();
}
/* The gusset is painted at whatever width the bag actually is. A deeper bag
   does not enlarge the printed roundel, so the layout keeps its real size and
   re-centres; only the field, the two bands and the seal repeats run wider. */
function drawSide(){ return drawSideAt(SW); }
/* MIRRORED PAIR. The film runs back | gusset | FRONT | gusset | back, and the
   roundel sits against the FRONT edge on BOTH gusset panels — so the two are
   laid out as mirror images while the type itself stays the right way round.
   The plates show it plainly: on the left gusset the mark is right of the
   variety lines, on the right gusset it is left of them. Drawing one panel for
   both put the mark against the back seam on the right-hand side. */
function drawSideAt(w,flip){
  const [c,x]=panel(w,SH), mid=w/2, v2=(w!==SW);
  /* 3 Sep, side-on against studio-gusset: the whole gusset print sits about a tenth of the panel
     toward the FRONT crease, window included; centred, it rendered a tenth back. GSH carries that
     shift and mirrors between the two gussets, so the pair stays a pair. Moving the window alone
     did nothing until it was narrowed: at 0.76 of the panel wide the ellipse just clipped at both
     edges. */
  const GSH=0;   /* measured both ways on 3 Sep and left at zero. By eye on the side-on pair the print looks
     a tenth of the panel back from the plate's, but that is the render box counting the front and back
     slivers either side of the gusset. +0.10 scored left 65.0 / right 56.3, -0.10 scored 63.3 / 58.2,
     0 scores 65.0 / 60.0. The lever is kept because the reading is worth repeating against a cleaner plate. */
  const winX=(w!==SW) ? w*(flip ? 0.5+GSH : 0.5-GSH) : mid;
  /* v2: everything as a fraction of the depth, read off studio-gusset with
     the front edge at the right on the unflipped (left) gusset */
  /* 2 Sep, settled on the STRAIGHT-ON renders, never the three-quarter (its
     foreshortening once made the front look like the back): on the gusset
     plate the mark's centre sits 0.32 of the panel in from the front crease
     and the type column 0.62 in, mirrored on the other side */
  const ovX = v2 ? (flip ? w*(0.335+GSH) : w*(0.665-GSH)) : (flip ? mid-(SOVAL.cx-SW/2) : mid+(SOVAL.cx-SW/2));
  const typX= v2 ? (flip ? w*(0.605+GSH) : w*(0.395-GSH)) : (flip ? mid-(264-SW/2)      : mid+(264-SW/2));
  const wrx = v2 ? Math.round(w*0.31) : SWIN.rx, ovCy = v2 ? 622 : SOVAL.cy;   /* 3 Sep: the judge put the gusset lockup 3.3% of the box low; 600 overshot and cost the left panel five points, 622 splits it */
  const ovW = v2 ? 258 : SOVAL.w, ovAR = v2 ? (0.40*w)/258 : null;   /* 3 Sep, side-on: the plate's roundel is 0.36 of the panel across, 0.30 rendered 0.22 */   /* 3 Sep, gusset pair */   /* 3 Sep, gusset pair at the matched silhouette: the plate's roundel runs 0.25 of the box along the bag and 0.30 of the gusset across; 340 at 0.44 rendered 0.34 and 0.51 */   /* on the gusset the mark is nearly round: 0.44 of the panel across, 0.30 of the height long (cut from the plate, 2 Sep) */   /* the plate's gusset mark: 0.30 of the height long, 0.30 of the width across */   /* short axis 0.26 of the depth, over the 320 long axis */
  x.fillStyle=CF; x.fillRect(0,0,w,SH);
  x.fillStyle=CR; x.textAlign='center';
  x.font='italic 800 24px Inter,Helvetica,Arial,sans-serif';
  for(let i=0;i*74<w;i++) x.fillText(pk("sealRepeat","Vit's"),36+i*74,28);
  meander(x,0,BAND_TOP,w,BAND_H,CMEA);
  meander(x,0,BAND_BOT,w,BAND_H,CMEA);
  /* window: the cakes show through the film */
  x.save();
  x.beginPath(); x.ellipse(winX,SWIN.cy,wrx,SWIN.ry,0,0,Math.PI*2);
  x.save(); x.clip();
  noodlePrint(x,winX,SWIN.cy,wrx,SWIN.ry);
  /* the same photographed cake the front window shows, so the two windows
     read as one bundle behind one film; the print fills the feathered zones */
  if(windowImg&&windowImg.complete&&windowImg.naturalWidth){
    if(v2){
      /* the cake at the plate's own strand density: the gusset plate shows
         about 28 strands across its window, the stock photograph a dozen
         across its width, so it is laid as small mirrored tiles (seamless)
         and then warmed and deepened to the plate's (215,181,143) with a
         multiply of the film colour. The print goes on top as before. */
      const sc=0.40, tw=Math.round(windowImg.naturalWidth*sc), th=Math.round(windowImg.naturalHeight*sc);   /* 0.22 read as woven cloth; 0.40 keeps single strands */
      const x0=winX-wrx, y0=SWIN.cy-SWIN.ry, x1=winX+wrx, y1=SWIN.cy+SWIN.ry;
      for(let j=0, yy=y0; yy<y1; j++, yy+=th) for(let i=0, xx=x0; xx<x1; i++, xx+=tw){
        x.save(); x.translate(xx+(i%2?tw:0), yy+(j%2?th:0)); x.scale(i%2?-1:1, j%2?-1:1);
        x.drawImage(windowImg,0,0,tw,th); x.restore();
      }
      x.save(); x.globalCompositeOperation='multiply'; x.fillStyle='rgba(236,204,150,.42)';
      x.fillRect(x0,y0,x1-x0,y1-y0); x.restore();
      /* a soft sheen down the film, as the plate's window has */
      x.save(); const g=x.createLinearGradient(x0,0,x1,0);
      g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(0.38,'rgba(255,255,255,.14)');
      g.addColorStop(0.5,'rgba(255,255,255,.02)'); g.addColorStop(1,'rgba(255,255,255,0)');
      x.fillStyle=g; x.fillRect(x0,y0,x1-x0,y1-y0); x.restore();
    } else if(v2){
      /* the photograph is a wide crop of the front window; blown up to cover
         this tall window its strands came out three times the size of the
         front's. Turned on its side it covers the window's height at close to
         its own scale, and its long edges feather into the matched print. */
      const nw=windowImg.naturalWidth, nh=windowImg.naturalHeight;
      const k=(2*SWIN.ry)/nw*1.02, dw=nw*k, dh=nh*k;
      const o=canv(Math.ceil(dh),Math.ceil(dw)), ox=o.getContext('2d');
      ox.translate(dh/2,dw/2); ox.rotate(Math.PI/2); ox.drawImage(windowImg,-dw/2,-dh/2,dw,dh);
      ox.setTransform(1,0,0,1,0,0); ox.globalCompositeOperation='destination-in';
      const g=ox.createLinearGradient(0,0,dh,0);
      g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(0.22,'rgba(0,0,0,1)');
      g.addColorStop(0.78,'rgba(0,0,0,1)'); g.addColorStop(1,'rgba(0,0,0,0)');
      ox.fillStyle=g; ox.fillRect(0,0,dh,dw);
      x.drawImage(o,winX-dh/2,SWIN.cy-dw/2);
    } else {
      const k=Math.max((2*wrx)/windowImg.naturalWidth,(2*SWIN.ry)/windowImg.naturalHeight);
      const dw=windowImg.naturalWidth*k, dh=windowImg.naturalHeight*k;
      x.drawImage(windowImg,winX-dw/2,SWIN.cy-dh/2,dw,dh);
    }
  }
  x.restore();
  x.strokeStyle='rgba(255,255,255,.5)'; x.lineWidth=7; x.beginPath();
  x.ellipse(winX,SWIN.cy,wrx,SWIN.ry,0,0,Math.PI*2); x.stroke();
  x.restore();
  /* mark and vertical lockup, printed over the film */
  /* On the real pack the wordmark runs up the gusset rather than sitting
     upright, which is what the scan's own artwork shows. The type beside it is
     already turned by sideType, so the mark has to turn with it. */
  x.save(); x.translate(ovX,ovCy); x.rotate(Math.PI/2);
  drawLogo(x,0,0,ovW,ovAR);
  x.restore();
  x.fillStyle=CR; sideType(x,typX,v2);
  /* the measured bag's gussets are the client's photographs too: the unflipped
     panel lands on the LEFT gusset (settled on straight-on renders, 3 Sep),
     the flipped one on the right. Laid over the wall rows like the front. */
  if(v2){
    const ph=flip?refSideR:refSideL;
    if(ph&&ph.complete&&ph.naturalWidth) x.drawImage(ph,0,278,w,1078-278);
  }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t;
}
function drawCrimp(){
  /* The seal is a RED band carrying the script in YELLOW. A pixel count inside
     the band said otherwise and it was drawn yellow-on-red for a round; the
     count was picking up the roof's own yellow either side of the crimp. Look
     at the plate and it is red. */
  const c=canv(1024,64),x=c.getContext('2d');
  x.fillStyle=CF; x.fillRect(0,0,1024,64);
  x.fillStyle=CR; x.fillRect(0,17,1024,47);   /* the plate's red band is 3.8% of the box tall under a yellow film edge; full-height red read 5.2 */
  for(let i=0;i<1024;i+=6){
    x.fillStyle=(i/6)%2?'rgba(0,0,0,.10)':'rgba(255,255,255,.07)'; x.fillRect(i,0,6,64);
  }
  x.fillStyle=CF; x.textAlign='center';
  x.font='italic 800 26px Inter,Helvetica,Arial,sans-serif';
  for(let i=0;i<8;i++) x.fillText(pk('sealRepeat',"Vit's"),64+i*128,41);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}
function drawCrimpPlain(){
  /* the pinched shoulder of the bag: crinkled field yellow with NO script —
     on the real pack the red repeats live only on the sealed fin, and tiling
     them across the whole top face read as rows of noise in 3D */
  const c=canv(1024,64),x=c.getContext('2d');
  x.fillStyle=CF; x.fillRect(0,0,1024,64);
  for(let i=0;i<1024;i+=6){
    x.fillStyle=(i/6)%2?'rgba(0,0,0,.07)':'rgba(255,255,255,.10)'; x.fillRect(i,0,6,64);
  }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}
function drawNoodle(){
  /* the cake surface: tight vertical crinkles, matched to the window print.
     8px pitch and 24 sine cycles so the texture tiles cleanly both ways */
  const c=canv(512,512),x=c.getContext('2d');
  const F=Math.PI*2*24/512;
  x.fillStyle='#F5EDD8'; x.fillRect(0,0,512,512);
  for(let i=0;i<=64;i++){
    const ox=i*8;
    x.strokeStyle=i%2?'#E8DAB6':'#D9C79D'; x.lineWidth=4.2;
    x.beginPath(); for(let y=-8;y<=520;y+=3) x.lineTo(ox+Math.sin(y*F+i*1.7)*4.2,y); x.stroke();
    x.strokeStyle='rgba(255,250,235,.5)'; x.lineWidth=1.5;
    x.beginPath(); for(let y=-8;y<=520;y+=3) x.lineTo(ox-1.5+Math.sin(y*F+i*1.7)*4.2,y); x.stroke();
  }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}
function blobShadow(){
  const c=canv(256,256),x=c.getContext('2d');
  const g=x.createRadialGradient(128,128,10,128,128,120);
  g.addColorStop(0,'rgba(26,19,14,.34)'); g.addColorStop(1,'rgba(26,19,14,0)');
  x.fillStyle=g; x.fillRect(0,0,256,256);
  const t=new THREE.CanvasTexture(c); return t;
}
/* a soft curling plume rather than a round blob, so wisps read as steam not smoke balls */
function steamTex(){
  const S=256,c=canv(S,S),x=c.getContext('2d');
  x.filter='blur('+(S/18)+'px)';
  for(let i=0;i<16;i++){
    const t=i/15;
    const r=S*(0.10+0.11*Math.sin(t*Math.PI));
    const cx=S/2+Math.sin(t*4.6)*S*0.11;
    const cy=S*(0.92-t*0.84);
    x.fillStyle='rgba(255,255,255,'+(0.34*Math.sin(t*Math.PI)).toFixed(3)+')';
    x.beginPath(); x.arc(cx,cy,r,0,Math.PI*2); x.fill();
  }
  x.filter='none';
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}

/* soft creases in the film: a height field, reused for gloss and surface normals */
function crinkleCanvas(){
  const S=HI?1024:512;
  const c=canv(S,S),x=c.getContext('2d'); const k=S/512;
  x.fillStyle='#808080'; x.fillRect(0,0,S,S);
  x.filter='blur('+(3*k)+'px)'; x.lineCap='round';
  for(let i=0;i<110;i++){
    const x0=Math.random()*S, y0=Math.random()*S,
          a=Math.random()*Math.PI, len=(60+Math.random()*230)*k;
    x.strokeStyle=Math.random()>0.5?'rgba(255,255,255,.32)':'rgba(0,0,0,.32)';
    x.lineWidth=(1.5+Math.random()*4.5)*k;
    x.beginPath(); x.moveTo(x0,y0);
    x.lineTo(x0+Math.cos(a)*len,y0+Math.sin(a)*len); x.stroke();
  }
  x.filter='none';
  return c;
}
/* derive a tangent-space normal map from that height field (Sobel on the red channel) */
async function normalFromHeight(src,strength){   /* 8 Sep: chunked, a breath every 96 rows, so no single task holds the page */
  const w=src.width,h=src.height;
  const s=src.getContext('2d').getImageData(0,0,w,h).data;
  const out=canv(w,h), ox=out.getContext('2d');
  const img=ox.createImageData(w,h), d=img.data;
  /* 8 Sep: the same Sobel, written flat. The closure-per-sample version was the single
     biggest task after the loading plate (0.9s of a 10s profile); this is about a quarter of it. */
  const k=strength/255;
  for(let y=0;y<h;y++){
    if(y&&(y%96)===0) await __breath();
    const ru=((y-1+h)%h)*w, rd=((y+1)%h)*w, rc=y*w;
    for(let x2=0;x2<w;x2++){
      const xl=(x2-1+w)%w, xr=(x2+1)%w;
      const dx=(s[(rc+xl)<<2]-s[(rc+xr)<<2])*k;
      const dy=(s[(ru+x2)<<2]-s[(rd+x2)<<2])*k;
      const inv=1/Math.sqrt(dx*dx+dy*dy+1), i=(rc+x2)<<2;
      d[i]=(dx*inv*0.5+0.5)*255; d[i+1]=(dy*inv*0.5+0.5)*255; d[i+2]=(inv*0.5+0.5)*255; d[i+3]=255;
    }
  }
  ox.putImageData(img,0,0);
  const t=new THREE.CanvasTexture(out); t.colorSpace=THREE.NoColorSpace;
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(2,2);
  return t;
}

/* broth surface: fat droplets and a fine ripple, as a height field for normals */
function brothHeight(){
  const S=HI?1024:512, c=canv(S,S), x=c.getContext('2d');
  x.fillStyle='#808080'; x.fillRect(0,0,S,S);
  x.filter='blur('+(S/380)+'px)';
  for(let i=0;i<260;i++){                       /* oil droplets */
    const r=(2+Math.random()*11)*(S/512);
    const gx=Math.random()*S, gy=Math.random()*S;
    const g=x.createRadialGradient(gx,gy,0,gx,gy,r);
    g.addColorStop(0,'rgba(255,255,255,.55)');
    g.addColorStop(0.65,'rgba(255,255,255,.16)');
    g.addColorStop(1,'rgba(120,120,120,0)');
    x.fillStyle=g; x.beginPath(); x.arc(gx,gy,r,0,Math.PI*2); x.fill();
  }
  x.filter='blur('+(S/256)+'px)';
  for(let i=0;i<26;i++){                        /* slow concentric ripple */
    x.strokeStyle='rgba(255,255,255,.05)'; x.lineWidth=(2+Math.random()*5)*(S/512);
    x.beginPath(); x.arc(S/2,S/2,(i+1)*(S/54),0,Math.PI*2); x.stroke();
  }
  x.filter='none';
  return c;
}
/* noodle skin: pale wheat with a faint lengthwise grain */
function noodleSkin(){
  const S=512, c=canv(S,S), x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,0,S);
  g.addColorStop(0,'#F2DFAE'); g.addColorStop(0.5,'#E8CE94'); g.addColorStop(1,'#DFC084');
  x.fillStyle=g; x.fillRect(0,0,S,S);
  x.filter='blur(1px)';
  for(let i=0;i<200;i++){
    x.strokeStyle=Math.random()>0.5?'rgba(255,246,214,.30)':'rgba(150,116,60,.16)';
    x.lineWidth=0.6+Math.random()*2.2;
    const y=Math.random()*S;
    x.beginPath(); x.moveTo(0,y); x.lineTo(S,y+(Math.random()-0.5)*10); x.stroke();
  }
  x.filter='none';
  const t=new THREE.CanvasTexture(c);
  t.colorSpace=THREE.SRGBColorSpace;
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(6,1);
  return t;
}
/* faint glaze mottling on the ceramic */
function glazeHeight(){
  const S=512, c=canv(S,S), x=c.getContext('2d');
  x.fillStyle='#808080'; x.fillRect(0,0,S,S);
  x.filter='blur(6px)';
  for(let i=0;i<70;i++){
    x.fillStyle=Math.random()>0.5?'rgba(255,255,255,.10)':'rgba(0,0,0,.08)';
    x.beginPath(); x.ellipse(Math.random()*S,Math.random()*S,
      8+Math.random()*40,8+Math.random()*40,Math.random()*3,0,Math.PI*2); x.fill();
  }
  x.filter='none';
  return c;
}

/* ---------- die-cut masks: black is film removed, white stays printed ---------- */
function alphaTex(w,h,draw){
  const [c,x]=panel(w,h);
  x.fillStyle='#fff'; x.fillRect(0,0,w,h);
  draw(x);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.NoColorSpace; return t;
}
function drawFrontAlpha(){
  /* 23 Aug: the windows are no longer die-cut holes. The interiors carry the
     REAL photographed cake (front) and the matched print (gusset), which reads
     far closer to the studio shot than the tinted GLB ever did, so the film
     stays opaque and the masks are solid. */
  return alphaTex(FW,FH,()=>{});
}
function drawSideAlpha(){
  return alphaTex(SW,SH,()=>{});
}

/* ---------- the pack mesh (shared builder) ---------- */
/* ============================================================
   THE YELLOW PACK, VERSION 2
   A redesign, not a variant: the equity stays (field yellow, the red, the
   roundel, the phoenix, the chop, the cake in the window) and the ARCHITECTURE
   changes. v1 is the centred, bordered, arced production bag. v2 is a
   left-hand grid: one full-bleed red claim bar, the mark set on the margin,
   the variety lockup ranged left in three flat lines, the wave column turned
   on its side into a divider, a wide radiused window instead of the ellipse,
   and a single spec strip along the foot. Nothing here overwrites v1 — the
   two stand side by side on the 3D page.
   ============================================================ */
const V2={ dims:[2.5,2.9,1.05], bulge:0.30, M:64 };
function v2Track(x,px){ if('letterSpacing' in x) x.letterSpacing=px+'px'; }
/* the divider: the pack's wave column laid horizontally, full bleed */
function v2Waves(x,w,y0,n,pitch){
  x.save();
  x.strokeStyle='#fff'; x.lineWidth=17; x.lineCap='round';
  const k=Math.PI*2/150;
  for(let i=0;i<n;i++){
    const oy=y0+i*pitch;
    x.beginPath();
    for(let px=-20;px<=w+20;px+=4) x.lineTo(px,oy+Math.sin(px*k)*7);
    x.stroke();
  }
  x.restore();
}
function v2Round(x,rx,ry,rw,rh,r){
  x.beginPath();
  x.moveTo(rx+r,ry);
  x.lineTo(rx+rw-r,ry); x.quadraticCurveTo(rx+rw,ry,rx+rw,ry+r);
  x.lineTo(rx+rw,ry+rh-r); x.quadraticCurveTo(rx+rw,ry+rh,rx+rw-r,ry+rh);
  x.lineTo(rx+r,ry+rh); x.quadraticCurveTo(rx,ry+rh,rx,ry+rh-r);
  x.lineTo(rx,ry+r); x.quadraticCurveTo(rx,ry,rx+r,ry);
  x.closePath();
}
/* the claim bar both v2 panels share, so front and gusset line up in 3D */
function v2Bar(x,w){
  x.fillStyle=CR; x.fillRect(0,150,w,80);
  x.save();
  x.fillStyle=CF; x.textAlign='left'; x.textBaseline='middle';
  v2Track(x,2.4);
  x.font='800 24px '+PF;
  x.fillText(String(pk('claim.en','Tiada Pengawet Tambahan')).toUpperCase(),V2.M,191);
  v2Track(x,0);
  x.textAlign='right';
  x.font='700 22px "Noto Sans SC","Microsoft YaHei",sans-serif';
  x.fillText(pk('claim.zh','不添加防腐剂'),w-V2.M,192);
  x.restore();
  x.textBaseline='alphabetic';
}
function drawFrontV2(){
  const [c,x]=panel(FW,FH), M=V2.M;
  x.fillStyle=CF; x.fillRect(0,0,FW,FH);
  v2Bar(x,FW);
  /* the mark ranges left off the margin instead of sitting on the centre axis */
  drawLogo(x,M+221,368,442);
  /* the phoenix answers it across the column, small and high */
  if(phxImg&&phxImg.complete&&phxImg.naturalWidth){
    const pw=156, ph=pw*phxImg.naturalHeight/phxImg.naturalWidth;
    x.drawImage(phxImg,FW-M-pw,368-ph/2,pw,ph);
  } else phoenix(x,FW-M-78,368,0.48);
  /* the variety lockup: three flat lines, no arc, no keyline, all ranged left */
  x.textAlign='left';
  v2Track(x,7);
  x.fillStyle=CIK; x.font='800 40px '+PF;
  x.fillText(String(pk('variety.en','INSTANT NOODLES')).toUpperCase(),M,536);
  v2Track(x,1.5);
  x.fillStyle=CR; x.font='900 74px '+PF;
  x.fillText(String(pk('variety.ms','MI SEGERA')).toUpperCase(),M,614);
  v2Track(x,0);
  x.fillStyle=CIK; x.font='700 42px "Noto Serif SC","Noto Sans SC","Microsoft YaHei",serif';
  x.fillText(pk('variety.zh','快熟麵'),M,674);
  /* the wave column, turned on its side: the divider between word and product */
  v2Waves(x,FW,690,3,30);
  /* one wide radiused window, the real cake behind the film, filled to cover */
  const wx=M, wy=784, ww=FW-M*2, wh=218, wr=30;
  x.save();
  v2Round(x,wx,wy,ww,wh,wr);
  x.save(); x.clip();
  noodlePrint(x,wx+ww/2,wy+wh/2,ww/2,wh/2);
  if(windowImg&&windowImg.complete&&windowImg.naturalWidth){
    const k=Math.max(ww/windowImg.naturalWidth,wh/windowImg.naturalHeight)*1.04;
    const dw=windowImg.naturalWidth*k, dh=windowImg.naturalHeight*k;
    x.drawImage(windowImg,wx+ww/2-dw/2,wy+wh/2-dh/2,dw,dh);
  }
  x.restore();
  x.strokeStyle=CR; x.lineWidth=8; x.stroke();
  x.restore();
  /* the foot: one rule, the count lockup, the chop, the weight ranged right */
  x.strokeStyle=CR; x.lineWidth=3;
  x.beginPath(); x.moveTo(M,1036); x.lineTo(FW-M,1036); x.stroke();
  x.fillStyle=CR; x.font='900 84px '+PF; x.textAlign='left';
  x.fillText(pk('count.number','5'),M,1102);
  x.fillStyle=CIK;
  v2Track(x,2);
  x.font='800 21px '+PF; x.fillText(String(pk('count.unit1','Cakes')).toUpperCase(),M+62,1085);
  x.font='700 19px '+PF; x.fillText(String(pk('count.unit3','Keping')).toUpperCase(),M+62,1109);
  v2Track(x,0);
  if(halalImg&&halalImg.complete&&halalImg.naturalWidth){
    x.save(); x.globalAlpha=.92; x.drawImage(halalImg,470,1046,68,64); x.restore();
  } else jakimMark(x,504,1078,32);
  x.textAlign='right'; x.fillStyle=CIK;
  v2Track(x,2.6);
  x.font='700 17px '+PF;
  x.fillText(String(pk('netWeight.line1','Net Wt. /')).toUpperCase(),FW-M,1072);
  v2Track(x,0);
  x.font='900 40px '+PF;
  x.fillText(pk('netWeight.value','350g/12.35oz'),FW-M,1112);
  x.textAlign='left';
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t;
}
function drawSideV2(){
  const [c,x]=panel(SW,SH), M=44;
  x.fillStyle=CF; x.fillRect(0,0,SW,SH);
  v2Bar(x,SW);
  drawLogo(x,SW/2,356,340);
  v2Waves(x,SW,500,3,30);
  x.textAlign='center'; x.fillStyle=CIK;
  v2Track(x,5);
  x.font='800 26px '+PF;
  x.fillText(String(pk('variety.en','INSTANT NOODLES')).toUpperCase(),SW/2,620);
  v2Track(x,1.2);
  x.fillStyle=CR; x.font='900 46px '+PF;
  x.fillText(String(pk('variety.ms','MI SEGERA')).toUpperCase(),SW/2,678);
  v2Track(x,0);
  x.fillStyle=CIK; x.font='700 34px "Noto Serif SC","Noto Sans SC",serif';
  x.fillText(pk('variety.zh','快熟麵'),SW/2,730);
  if(phxImg&&phxImg.complete&&phxImg.naturalWidth){
    const pw=118, ph=pw*phxImg.naturalHeight/phxImg.naturalWidth;
    x.drawImage(phxImg,SW/2-pw/2,830,pw,ph);
  } else phoenix(x,SW/2,880,0.36);
  x.strokeStyle=CR; x.lineWidth=3;
  x.beginPath(); x.moveTo(M,1024); x.lineTo(SW-M,1024); x.stroke();
  x.textAlign='center';
  x.fillStyle=CIK; v2Track(x,3); x.font='800 20px '+PF;
  x.fillText('5 '+String(pk('count.unit1','Cakes')).toUpperCase(),SW/2,1068);
  x.fillStyle=CR; x.font='900 32px '+PF; v2Track(x,0);
  x.fillText(pk('netWeight.value','350g/12.35oz'),SW/2,1112);
  x.textAlign='left';
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t;
}
function drawBackV2(){
  const [c,x]=panel(FW,FH), M=V2.M;
  x.fillStyle=CF; x.fillRect(0,0,FW,FH);
  v2Bar(x,FW);
  const head=function(str,y){
    x.fillStyle=CR; x.font='900 34px '+PF; v2Track(x,3);
    x.fillText(String(str).toUpperCase(),M,y); v2Track(x,0);
    x.strokeStyle=CR; x.lineWidth=3;
    x.beginPath(); x.moveTo(M,y+16); x.lineTo(FW-M,y+16); x.stroke();
  };
  x.textAlign='left';
  head(pk('back.h1','How to cook'),268);
  const steps=[
    'Boil 400ml of water. Add the noodle cake and cook for 3 minutes.',
    'Empty the seasoning into a bowl while the noodles cook.',
    'Pour the noodles and the water in, stir, and serve hot.'
  ];
  steps.forEach(function(t,i){
    const y=336+i*86;
    x.fillStyle=CR; x.font='900 40px '+PF; x.fillText(String(i+1),M,y+8);
    x.fillStyle=CIK; x.font='500 22px '+PF;
    const words=String(t).split(' ');
    let line='', ln=0;
    words.forEach(function(w){
      const test=line?line+' '+w:w;
      if(x.measureText(test).width>FW-M*2-64&&line){ x.fillText(line,M+64,y+ln*30); line=w; ln++; }
      else line=test;
    });
    if(line) x.fillText(line,M+64,y+ln*30);
  });
  head(pk('back.h2','Ingredients'),652);
  x.fillStyle=CIK; x.font='500 21px '+PF;
  x.fillText('Wheat flour, palm oil, salt, mineral salts.',M,712);
  x.fillText('Tepung gandum, minyak sawit, garam, garam galian.',M,746);
  v2Waves(x,FW,812,2,30);
  head('Made in Malaysia',924);
  x.fillStyle=CIK; x.font='500 20px '+PF;
  x.fillText('Vit Makanan (K.L.) Sdn. Bhd., Kuala Lumpur, Malaysia',M,976);
  x.fillText(pk('halal.certLine1','MS 1500')+'  ·  '+pk('halal.certLine2','1 001-01/2005'),M,1010);
  /* a drawn barcode block, so the reverse reads as a real pack in 3D */
  x.fillStyle='#fff'; x.fillRect(M,1046,300,86);
  x.fillStyle=CIK;
  for(let i=0,px=M+12;px<M+286;i++){
    const w=1+(i*37%4);
    x.fillRect(px,1054,w,62); px+=w+2+(i*17%3);
  }
  x.font='500 13px '+PF; x.fillText('9 555555 123456',M+12,1128);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t;
}
function drawCrimpV2(){
  /* The sealed fin as the plate shows it (2 Sep): a yellow film margin across
     the top third, then the red band carrying the script in the field yellow,
     eight repeats, bold italic, standing about 0.7 of the band. The crimp
     ribbing is faint. */
  /* ELEMENT 4, the fin band, off the per-element judge at the solved camera:
     the red band rendered 8.0% of the box tall against the plate's 3.8%. The
     red is HALF the seal, not the lower two thirds, with film yellow above and
     below it, and the script sits inside it a size down. */
  const c=canv(1024,96),x=c.getContext('2d');
  /* second pass off the render-vs-plate pair: the band height now matches,
     but the printed script stands nearly the full band and mine stood under
     half of it. Up to 44px in the 48px band. The ribbing is barely there on
     the plate, so it comes down to a whisper.
     Third pass off the pair at the matched silhouette (v=195): the plate's script stands 25% taller than mine
     and its film margins are thinner, so the band is 58 of 96 and the script 52px. */
  x.fillStyle=CF; x.fillRect(0,0,1024,96);
  x.fillStyle=CR; x.fillRect(0,20,1024,58);
  for(let i=0;i<1024;i+=8){
    x.fillStyle=(i/8)%2?'rgba(0,0,0,.02)':'rgba(255,255,255,.02)'; x.fillRect(i,0,8,96);
  }
  x.fillStyle=CF; x.textAlign='center';
  x.font='italic 800 52px Inter,Helvetica,Arial,sans-serif';
  for(let i=0;i<8;i++) x.fillText(pk('sealRepeat',"Vit's"),64+i*128,68);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}

/* ============================================================
   The range, as five real packs rather than five flat cut-outs.
   Each entry carries its own proportions, palette and furniture; the
   painters below read the spec, so a new SKU is a data row, not new code.
   dims are the real carton in metres/10: [width, height, depth].
   bulge is how much the film pillows out — a printed carton barely moves,
   a pillow pack moves a lot, which is most of what tells them apart in 3D.
   ============================================================ */
/* the client's own artwork for the four flavour packs (4 Sep, Bazil: "improve and detail the
   other packaging"): each product photograph rectified into a flat front panel, worn on
   the face the way the yellow pack wears its studio front. Painters stay for the rest. */
const skuPhoto={};
const RANGE_SKUS=[
  /* The classic yellow pack is the brand itself, so its palette comes from the
     CMS. The flavour SKUs below keep their own, being per-variety artwork. */
  { key:'mini',   dims:[2.5,2.8,1.0], bulge:0.30, crimp:true,
    field:CF, band:CR, ink:CIK, accent:CRD,
    kicker:'', title:'', window:true, phoenix:true, meander:true,
    countBox:true, weight:'350g (12.5oz)' },
  { key:'penang', dims:[2.6,2.9,1.05], bulge:0.30, crimp:true,
    field:'#F0C9C2', band:'#B4232B', ink:'#4A1418', accent:'#B4232B',
    kicker:'Taste of Malaysia', title:'Penang\nWhite Curry',
    sub:'Mi Segera Perisa Kari Putih', zh:'檳城白咖哩',
    window:false, phoenix:true, meander:true, bowl:'#E9C9A6',
    countBox:false, count:'4', countLabel:'4 PACK', weight:'4 x 105g' },
  { key:'tomato', dims:[2.1,3.0,0.95], bulge:0.06, crimp:false,
    field:'#EFE2CB', band:'#C4342A', ink:'#3A2A18', accent:'#C4342A',
    kicker:'Air Dried · Trans Fat Free', title:'Mi Kering\nTomato',
    sub:'Tomato Noodles', zh:'蕃茄麵',
    window:false, phoenix:false, meander:false, bowl:'#D8503C',
    countBox:false, count:'5', countLabel:'AIR DRIED', weight:'300g' },
  { key:'bayam',  dims:[2.1,3.0,0.95], bulge:0.06, crimp:false,
    field:'#EBE6D2', band:'#4E7A3A', ink:'#27351C', accent:'#4E7A3A',
    kicker:'Air Dried · High Fibre', title:'Mi Kering\nBayam',
    sub:'Spinach Noodles', zh:'菠菜麵',
    window:false, phoenix:false, meander:false, bowl:'#6E9B4B',
    countBox:false, count:'5', countLabel:'HIGH FIBRE', weight:'300g' },
  { key:'carbo',  dims:[2.9,2.5,0.9],  bulge:0.24, crimp:true,
    field:'#F6E3A8', band:'#C8102E', ink:'#3A2B10', accent:'#1A7A3C',
    kicker:'Vit’s Mi Segera Perisa', title:'Carbonara',
    sub:'Mi Goreng · Creamy', zh:'卡邦尼',
    window:false, phoenix:false, meander:false,
    /* a real carbonara is cream on cream, which vanished against the field —
       pushed warmer so the dish still reads at pack size */
    bowl:'#DCBF7E', tricolour:true,
    countBox:false, count:'5', countLabel:'MIFT GOLD 2025', weight:'5 x 80g' }
];

/* a soft product bowl, so each front has something appetising rather than
   flat type. Drawn, not photographed, to match how the mini pack is made. */
function skuBowl(x,cx,cy,r,col){
  x.save();
  x.fillStyle='rgba(0,0,0,.10)';
  x.beginPath(); x.ellipse(cx,cy+r*0.52,r*0.94,r*0.20,0,0,Math.PI*2); x.fill();
  x.fillStyle='#fff';
  x.beginPath(); x.ellipse(cx,cy,r,r*0.72,0,0,Math.PI*2); x.fill();
  x.strokeStyle='rgba(0,0,0,.14)'; x.lineWidth=3; x.stroke();
  x.save();
  x.beginPath(); x.ellipse(cx,cy,r*0.9,r*0.64,0,0,Math.PI*2); x.clip();
  x.fillStyle=col;
  x.fillRect(cx-r,cy-r,r*2,r*2);
  /* noodle strands catching the light */
  x.strokeStyle='rgba(255,255,255,.55)'; x.lineWidth=r*0.075; x.lineCap='round';
  for(let i=0;i<9;i++){
    x.beginPath();
    for(let t=-r;t<=r;t+=6) x.lineTo(cx+t,cy-r*0.42+i*r*0.13+Math.sin(t*0.05+i)*r*0.05);
    x.stroke();
  }
  x.restore();
  x.lineCap='butt';
  x.restore();
}

/* Each panel's canvas must match the aspect of the FACE it lands on, or the
   artwork is stretched to fit — a 1024x1147 canvas on the carbonara's wide face
   pulled its wordmark sideways. So every painter derives its own height from the
   SKU's dims and lays out in fractions of it rather than fixed pixels. */
function faceH(s){ return Math.round(FW*(s.dims[1]/s.dims[0])); }

/* the generic front. The mini pack keeps its own bespoke painter above;
   everything else is composed from the spec. */
function drawSkuFront(s){
  const FH2=faceH(s), U=FH2/1147;             /* U scales the vertical rhythm */
  const [c,x]=panel(FW,FH2);
  const ph=skuPhoto[s.key];
  if(ph&&ph.naturalWidth){
    x.fillStyle=s.field; x.fillRect(0,0,FW,FH2);
    const sc=Math.max(FW/ph.naturalWidth,FH2/ph.naturalHeight), w=ph.naturalWidth*sc, h=ph.naturalHeight*sc;
    x.drawImage(ph,(FW-w)/2,(FH2-h)/2,w,h);
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=Q.aniso; return t;
  }
  x.fillStyle=s.field; x.fillRect(0,0,FW,FH2);
  const band=Math.round(64*U);
  x.fillStyle=s.band; x.fillRect(0,0,FW,band);
  x.fillStyle='#fff'; x.textAlign='center';
  x.font='italic 800 '+Math.round(38*U)+'px Inter,Helvetica,Arial,sans-serif';
  for(let i=0;i<9;i++) x.fillText("Vit's",68+i*114,band*0.72);
  if(s.tricolour){ /* the Italian flag flash the carbonara pack carries */
    const th=Math.round(26*U);
    x.fillStyle='#1A7A3C'; x.fillRect(0,band,FW/3,th);
    x.fillStyle='#fff';    x.fillRect(FW/3,band,FW/3,th);
    x.fillStyle='#C8102E'; x.fillRect(FW*2/3,band,FW/3,th);
  }
  if(s.meander){ meander(x,0,206*U,FW,44*U,s.band,s.field); meander(x,0,FH2-64*U,FW,44*U,s.band,s.field); }
  /* the mark */
  drawLogo(x,512,(s.phoenix?372:330)*U,(s.phoenix?300:340));
  if(s.phoenix) phoenix(x,512,585*U,0.52);
  /* Everything below the mark flows off a single cursor rather than sitting at
     fixed offsets. On a short wide face like the carbonara the fixed layout
     stacked the kicker straight through the title. */
  let ty=(s.phoenix? 690*U : (330*U + 340*0.655*0.5 + 62*U));
  if(s.kicker){
    x.fillStyle=s.accent; x.textAlign='center';
    const ks=Math.round(26*U);
    x.font='700 '+ks+'px '+PF;
    x.fillText(s.kicker.toUpperCase(),512,ty);
    ty+=ks*1.9;
  }
  if(s.title){
    x.fillStyle=s.ink; x.textAlign='center';
    const lines=s.title.split('\n');
    const size=Math.round((lines.length>1?76:92)*U);
    x.font='800 '+size+'px '+PF;
    lines.forEach(function(l){ ty+=size*0.86; x.fillText(l.toUpperCase(),512,ty); });
    if(s.zh){ const zs=Math.round(40*U);
      x.font='700 '+zs+'px "Noto Sans SC","Microsoft YaHei",sans-serif';
      x.fillStyle=s.accent; ty+=zs*1.15; x.fillText(s.zh,512,ty); }
    if(s.sub){ const ss=Math.round(27*U);
      x.font='600 '+ss+'px '+PF; x.fillStyle=s.ink;
      ty+=ss*1.5; x.fillText(s.sub,512,ty); }
  }
  /* the dish takes whatever room is genuinely left between the type and the foot,
     and is dropped entirely if that gap is too small to hold a legible bowl */
  if(s.bowl){
    const footY=FH2-190*U;
    const gap=footY-ty;
    const r=Math.min(200*U, gap*0.46, FW*0.26);
    if(r>34*U) skuBowl(x,512,ty+gap*0.52,r,s.bowl);
  }
  /* JAKIM mark and the weight, along the foot */
  jakimMark(x,104,FH2-176*U,46);
  x.fillStyle=s.ink; x.font='600 '+Math.round(15*U)+'px '+PF; x.textAlign='center';
  x.fillText('MS 1500 : 2009',104,FH2-108*U);
  x.textAlign='right';
  x.fillStyle=s.ink; x.font='800 '+Math.round(34*U)+'px '+PF;
  x.fillText(s.weight,FW-46,FH2-118*U);
  if(s.countLabel){
    x.font='700 '+Math.round(17*U)+'px '+PF; x.fillStyle=s.accent;
    x.fillText(s.countLabel,FW-46,FH2-152*U);
  }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=Q.aniso; return t;
}

/* the gusset. Sized off depth-to-height so the vertical wordmark is not squashed. */
function drawSkuSide(s){
  const SW=420, SH=Math.round(SW*(s.dims[1]/s.dims[2]));
  const [c,x]=panel(SW,SH);
  const band=Math.round(SH*0.055);
  x.fillStyle=s.field; x.fillRect(0,0,SW,SH);
  x.fillStyle=s.band; x.fillRect(0,0,SW,band); x.fillRect(0,SH-band,SW,band);
  x.save(); x.translate(SW/2,SH/2); x.rotate(-Math.PI/2);
  x.fillStyle=s.ink; x.textAlign='center'; x.font='800 62px '+PF;
  x.fillText((s.title||"Vit's").replace('\n',' ').toUpperCase(),0,-14);
  x.font='600 26px '+PF; x.fillStyle=s.accent;
  x.fillText(s.sub||'Instant Noodles',0,30);
  x.restore();
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=Q.aniso; return t;
}

/* the reverse: cooking steps, so a full turn has somewhere to land */
function drawSkuBack(s){
  const FH=faceH(s);
  const [c,x]=panel(FW,FH);
  x.fillStyle=s.field; x.fillRect(0,0,FW,FH);
  x.fillStyle=s.band; x.fillRect(0,0,FW,64);
  x.fillStyle=s.ink; x.textAlign='left';
  x.font='800 44px '+PF; x.fillText('COOKING INSTRUCTIONS',64,168);
  x.font='600 26px '+PF; x.fillStyle=s.accent;
  x.fillText('CARA MEMASAK · 烹調方法',64,214);
  const steps=[['1','Boil 400ml of water.'],['2','Add the noodle cake, 3 minutes.'],['3','Drain, season, serve hot.']];
  let y=300;
  steps.forEach(function(st){
    x.fillStyle=s.accent; x.beginPath(); x.arc(88,y-10,26,0,Math.PI*2); x.fill();
    x.fillStyle='#fff'; x.textAlign='center'; x.font='800 28px '+PF; x.fillText(st[0],88,y);
    x.fillStyle=s.ink; x.textAlign='left'; x.font='600 27px '+PF; x.fillText(st[1],136,y);
    y+=96;
  });
  x.fillStyle=s.ink; x.font='800 26px '+PF; x.fillText('INGREDIENTS / RAMUAN',64,y+40);
  x.font='500 23px '+PF; x.fillText('Wheat flour, palm oil, salt, mineral salts.',64,y+80);
  x.font='500 20px '+PF;
  x.fillText('Vit Makanan (K.L.) Sdn. Bhd., Kuala Lumpur, Malaysia.',64,y+124);
  /* barcode block */
  x.fillStyle='#fff'; x.fillRect(FW-330,FH-260,266,150);
  let bx=FW-314;
  for(let i=0;i<52;i++){ const w=(i%4===0)?5:2; x.fillStyle='#1A1A1A';
    x.fillRect(bx,FH-246,w,108); bx+=w+3; if(bx>FW-96) break; }
  x.fillStyle='#1A1A1A'; x.font='600 19px '+PF; x.textAlign='center';
  x.fillText('9 555555 123456',FW-197,FH-122);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=Q.aniso; return t;
}

/* the crimped seal at head and foot */
function drawSkuCrimp(s){
  const [c,x]=panel(512,128);
  x.fillStyle=s.band; x.fillRect(0,0,512,128);
  x.strokeStyle='rgba(0,0,0,.20)'; x.lineWidth=3;
  for(let i=0;i<64;i++){ x.beginPath(); x.moveTo(i*8,0); x.lineTo(i*8,128); x.stroke(); }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}

/* ============================================================
   V2 — CLEAN START (Bazil, 30 Aug: "start new. plain white plastic
   first"). Nothing borrowed from the production pack: no painters, no
   textures, no box builder. One lofted shape in bare white film, to be
   judged against the studio photos on the reference wall below the
   cards. Proportions measured off ref-01b:
   body H ≈ 1.13 W, depth ≈ 0.44 W, walls straight to ~76%% height,
   then a planar roof folding to a fin ≈ 0.55 W, flat full base.
   ============================================================ */
/* ?white strips the print back to bare film — the shape rounds were judged
   that way and it stays available for the next one */
const V2WHITE=/[?&]white\b/.test(location.search);

function buildBagV2(){
  /* ROUND 3 — the reference, not an impression of it.
     Two studio plates CROSS-SOLVE the box instead of one plate being guessed
     at. The front three-quarter gives D*sin(t)=92 and W*cos(t)=576 against
     H=768; the gusset plate gives D/H against the same height. Solve the pair
     and the view angle falls out at 12.2 degrees, with the bag at W=0.767H and
     D=0.568H. Round 2 assumed D/W=0.44. It is 0.73 — the bag is nearly square
     in plan, which is why every version before this read as a slab.
     Heights off the same plates: seal 7.6% of the standing height, shoulder
     11.9%, straight wall the rest, flat base. Seal 0.940 of the width — it
     runs nearly the full face, with an ear folded at each end.
     THE CREASES HAVE TO BE FOUND BY EYE, NOT BY THRESHOLD. A luminance scan
     put the front plate's fold at x=158; enlarging the corner shows it at 207,
     and the 50 pixels between were the window's edge. That one number sets the
     view angle and through it the whole box: 158 gives a 12-degree view and a
     bag 0.81H wide, 207 gives 19.7 degrees and 0.734H. The blend caught it —
     the print came out 10% oversized because the render was showing too
     little gusset for its own geometry. */
  const HT=2.83;                     /* the standing height, seal included */
  const W=V2W*HT, D=V2D*HT;         /* see V2W/V2D above */
  /* 2 Sep: on studio-3q the sealed fin is rows 0-6.4% of the box, the red
     band only rows 2.1-6.4 (a yellow film margin rides above the print); it
     was 7.6% and read as a slab on top. Its red spans 72.7% of the box, which
     is 0.905 of the width once the view angle is taken out; it was 0.94. */
  const FINH=0.064*HT;
  const H=HT-FINH;                   /* the lofted body: wall + roof        */
  const YS=1-(0.130*HT)/H;           /* the shoulder crease. 7 Sep: 0.119 put the gable's start at row 18; the gusset plate folds from row 20 */
  const ROOFW=0.89;   /* 3 Sep: at n=12 the fin boxed 0.69 of the width against the plate's 0.735 */                  /* width that survives to the seal: the plate's red band spans 80.7% of the box, it rendered 86.5 at 0.905 */
  const TF=0.062;                    /* half the seal's thickness           */
  /* the wall only — the roof is folded, not lofted */
  function prof(v){
    let a=W/2, b=D/2, n=12.0;        /* 3 Sep, Bazil: 'especially the 3d corners'. The studio plate's vertical folds and shoulder ears are crisp; 7 rendered them as pillow rounds. 12 keeps a small radius; 17 read as a carton */
    a*=1+0.012*Math.sin(v*Math.PI);  /* a full bag, not a slack one; enough belly for the film to shade. 3 Sep: 0.028 narrowed the silhouette 4% from mid-height to the base row; the plate loses 1% */
    b*=0.945+0.085*Math.sin(v*Math.PI); /* the front pillows out: the plate's mark region catches the softbox */
    /* the base is a rounded pillow, not a plate edge: over the last 8% of the
       wall the section pulls in on a quarter-circle, depth by 0.30 and width
       by 0.045 at the ground (2 Sep, off the 3q and gusset plates' base rows) */
    /* the plate's base is a real pillow: its silhouette is 67% of the box wide
       at 92.5% down and 39% at 95%; a flat base reads as a carton beside it */
    if(v<0.07){ const k=1-v/0.07, q=k*k; b*=1-0.75*q; a*=1-0.70*q; n-=1.4*k; }   /* 7 Sep: a harder roll was tried and put back; the gusset plate stands full depth to its last rows (0.96 at row 96) */
    /* 3 Sep: the plate's own bottom rows want a harder cut (0.68 of the box wide at 94% down, 0.44 at 96%),
       but taking the fold up to v<0.11 shortened the bag itself: the silhouette box went 1.090 tall per wide
       against the plate's 1.131 and every row fraction moved with it, dropping the front from 69.3 to 63.9.
       This curve keeps the box at 1.130 and leaves the last three rows about a tenth wide. */
    /* the gusset starts folding in BELOW the crease: side on, the plate only
       reaches full depth at 24% down while the front reaches full width at
       20%, so the last tenth of the wall pulls in */
    if(v>YS-0.07){ const t=(v-(YS-0.07))/0.07; b*=1-0.16*t; }   /* 7 Sep: linear, so the side shows a shoulder crease, not a dome; 0.83 of the depth at the crease, which is the gusset plate's row 20 */
    return [a,Math.max(b,0.010),Math.max(n,2.4)];
  }
  function sect(t,v){
    const p=prof(v), th=t*Math.PI*2;
    const c=Math.cos(th), si=Math.sin(th);
    return [p[0]*Math.sign(c)*Math.pow(Math.abs(c),2/p[2]),
            p[1]*Math.sign(si)*Math.pow(Math.abs(si),2/p[2])];
  }
  /* FOUR PANELS, not one tube. The column run starts at the front-right crease
     and every panel owns its own copy of the two creases it sits between, so
     each gets its own u AND its own normals — that is what puts a real fold
     down the corners instead of a soft roll. */
  const AR=128, SEG=AR/4, COLS=4*(SEG+1), NW=76, NR=24;
  function ring(v){
    const out=[];
    for(let s=0;s<4;s++) for(let k=0;k<=SEG;k++)
      out.push(sect((((s*SEG+k)/AR)+0.125)%1, v));
    return out;
  }
  /* WHERE THE ART SITS ON THE FOLD.
     The panel canvas is not a picture of the front face: it is a piece of the
     printed web, and its top 24.2% is the roof and the film that folds into
     the seal. ref-05, the client's rectified FRONT, is 869 of the canvas's
     1147 tall — the other 278 is that top matter, with the meander border
     straddling the boundary at y=276.
     Mapping the canvas evenly over the loft put the border 8% of the pack
     BELOW the crease and left the claim ribbon stranded on the wall, which
     the blend against studio-3q showed at a glance. So v is piecewise: the
     wall carries the canvas up to the border, and the roof carries the strip
     above it, split with the seal by their true heights. */
  const ART_EDGE=1-276/1147;                 /* the border, from the canvas top */
  const ART_ROOF=(1-ART_EDGE)*((1-YS)*H)/((1-YS)*H+FINH);
  const pos=[], uvs=[], rowV=[];
  function pushRow(r,y,vTex){
    for(let c=0;c<COLS;c++){ pos.push(r[c][0],y,r[c][1]); }
    /* u by ARC LENGTH inside the panel, so the print does not bunch at a fold */
    for(let s=0;s<4;s++){
      const o=s*(SEG+1), d=[0];
      for(let k=1;k<=SEG;k++){
        const A=r[o+k-1], B=r[o+k];
        d.push(d[k-1]+Math.hypot(B[0]-A[0],B[1]-A[1]));
      }
      const tot=d[SEG]||1;
      for(let k=0;k<=SEG;k++) uvs.push(1-d[k]/tot, vTex);
    }
    rowV.push(vTex);
  }
  /* 1. the wall, up to and including the crease row */
  for(let r=0;r<=NW;r++){
    const v=YS*r/NW, y=-H/2+v*H;
    pushRow(ring(v), y, (v/YS)*ART_EDGE);
  }
  /* 2. the roof. Every point runs in a STRAIGHT LINE from the crease to the
     seal, so the front and back come out as flat panels and the gusset corners
     fold into real dog ears. Round 2 lofted a shrinking superellipse up there
     and it rounded into a hood — the tell Bazil spotted from the side. The
     crease row is emitted twice so the wall and the roof own separate normals;
     smoothed across, the photo's hard fold renders as a roll. */
  const crease=ring(YS), aS=prof(YS)[0], aT=aS*ROOFW, roofH=(1-YS)*H;
  /* 7 Sep, Bazil: "from the side". The gusset plate's gable, read off its rows and used as
     the depth's share of the taper from the crease (u=0) to the fin (u=1): slow at first,
     then it closes fast just under the fin, where the film gathers. Rows 10/13/16/20 of
     the plate are 0.13/0.41/0.59/0.82 of the depth; a straight loft gave 0.30/0.49/0.69/0.86. */
  const GABLE=[[0,0],[0.26,0.32],[0.49,0.56],[0.72,0.92],[0.86,0.98],[1,1]];
  function gable(u){ for(let i=1;i<GABLE.length;i++){ if(u<=GABLE[i][0]){ const a=GABLE[i-1], b=GABLE[i]; return a[1]+(b[1]-a[1])*(u-a[0])/(b[0]-a[0]); } } return 1; }
  for(let r=0;r<=NR;r++){
    const u=r/NR, y=-H/2+YS*H+u*roofH, row=[];
    for(let c=0;c<COLS;c++){
      const xc=crease[c][0], zc=crease[c][1];
      const xf=xc*(aT/aS), zf=(zc>=0?TF:-TF);
      /* 7 Sep, Bazil: "from the side". The gusset plate tapers as a gable that pulls in
         FASTER than a straight line: 0.32 of the depth at row 12 and 0.09 at row 8 where a
         linear loft gave 0.45 and 0.17. A 0.62 power on u is that curve. x stays linear. */
      let x=xc+(xf-xc)*u, z=zc+(zf-zc)*gable(u);
      /* 7 Sep: the roof is not one flat plane. The plate's front and back slopes bow out a
         little between crease and seal (the film is full), fading to nothing at the gusset
         corners so the gable's silhouette keeps its measured line. */
      z+=Math.sign(zc||1)*0.03*Math.sin(Math.PI*u)*Math.max(0,1-Math.pow(Math.abs(xc)/aS,2));
      if(u>0.55){                    /* film only gathers close to the seal */
        const k=Math.pow((u-0.55)/0.45,1.6), w=Math.sin(c*2.03)*Math.cos(u*17);
        x+=w*0.006*k; z+=Math.sign(z||1)*w*0.014*k;
      }
      row.push([x,z]);
    }
    pushRow(row, y, ART_EDGE+u*ART_ROOF);
  }
  /* the print runs base to seal in one piece, as the film does */
  const segIdx=[[],[],[],[]];
  for(let r=0;r<rowV.length-1;r++){
    if(rowV[r]===rowV[r+1]) continue; /* the doubled crease row carries no face */
    for(let s=0;s<4;s++){
      const o=s*(SEG+1);
      for(let k=0;k<SEG;k++){
        const a=r*COLS+o+k, b=a+1, c=(r+1)*COLS+o+k, d=c+1;
        segIdx[s].push(a,c,b, b,c,d);
      }
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  const idx=[]; const MAT=[0,1,2,3];   /* front, left gusset, back, right gusset */
  for(let s=0;s<4;s++){
    g.addGroup(idx.length,segIdx[s].length,MAT[s]);
    for(const v of segIdx[s]) idx.push(v);
  }
  g.setIndex(idx); g.computeVertexNormals();
  /* the same printed film the audited pack wears, so the two specimens can be
     compared on shape alone */
  /* Measured against the plates: the field yellow came back (246,231,61) on
     the front and (252,245,48) on the gusset, against (242,215,18),
     (218,197,45) and (205,176,40) on the three photographs. Too bright, and
     too much blue in it — the blue is the room probe and the clearcoat, which
     the map's colour cannot touch, so those come down rather than the tint. */
  /* 2 Sep: the studio room is dark, so the coat can come up to a real film
     gloss without paling the flat field; the crinkle normal comes down from
     .42, which drew a white web across the roof the plate does not have. The
     tint is fitted so the flat front-left field reads the plate's (246,227,2). */
  const film={metalness:0,roughness:.42,roughnessMap:texCrinkle,
    clearcoat:.62,clearcoatRoughness:.20,envMapIntensity:0.55,   /* 4 Sep, Bazil: "make the 3d look high quality". Printed film is glossy: the clearcoat is its wet sheen, the room is what that sheen reflects as the pack turns */
    color:new THREE.Color(0xfbffea)};   /* 2 Sep colour step: the front read (242,218,34) against (246,227,2); less red and blue in the tint, key 1.36, room 0.35 */
  if(texCrinkleN){ film.normalMap=texCrinkleN; film.normalScale=new THREE.Vector2(.16,.16); }
  const bare=()=>new THREE.MeshPhysicalMaterial({color:0xf1eee6,metalness:0,
    roughness:.58,clearcoat:.30,clearcoatRoughness:.50,envMapIntensity:.26});
  const mFront=V2WHITE?bare():new THREE.MeshPhysicalMaterial({...film,map:texFrontV2,side:THREE.DoubleSide});
  const mSide =V2WHITE?bare():new THREE.MeshPhysicalMaterial({...film,map:texSideV2,side:THREE.DoubleSide});
  const mSideR=V2WHITE?bare():new THREE.MeshPhysicalMaterial({...film,map:texSideV2R,side:THREE.DoubleSide});
  const mBack =V2WHITE?bare():new THREE.MeshPhysicalMaterial({...film,map:texBack,side:THREE.DoubleSide});
  const mSeal =V2WHITE?bare():new THREE.MeshPhysicalMaterial({...film,map:texCrimpV2,roughness:.7});
  const mFoot =V2WHITE?bare():new THREE.MeshPhysicalMaterial({...film,map:texCrimpPlain,roughness:.7});
  const mesh=new THREE.Mesh(g,[mFront,mSide,mBack,mSideR]); mesh.castShadow=Q.shadows;
  const grp=new THREE.Group(); grp.add(mesh);
  /* the flat base the bag stands on */
  {
    const r0=ring(0), cg=[0,-H/2,0], cu=[0.5,0.5], ci=[];
    for(let c=0;c<COLS;c++){
      cg.push(r0[c][0],-H/2,r0[c][1]);
      cu.push(0.5+r0[c][0]/W, 0.5+r0[c][1]/D);
      if(c<COLS-1) ci.push(0,c+1,c+2);
    }
    ci.push(0,COLS,1);
    const cgeo=new THREE.BufferGeometry();
    cgeo.setAttribute('position',new THREE.Float32BufferAttribute(cg,3));
    cgeo.setAttribute('uv',new THREE.Float32BufferAttribute(cu,2));
    cgeo.setIndex(ci); cgeo.computeVertexNormals();
    grp.add(new THREE.Mesh(cgeo,mFoot));
  }
  /* the sealed fin: two plies of film with the ears folded into it, so it is a
     strip edge-on, not a needle. Its top edge runs flat across — the studio
     mask holds full width from the very first row of the band. */
  {
    const fw=aT*2;
    const fg=new THREE.BoxGeometry(fw,FINH,TF*2,72,3,1);
    const fp=fg.attributes.position;
    for(let i=0;i<fp.count;i++){
      const px=fp.getX(i), nx=Math.min(1,Math.abs(px)/(fw/2));
      fp.setY(i, fp.getY(i)-Math.pow(nx,2.2)*0.012);   /* 3 Sep: 0.046 arched the band in the fin pair; the plate's top edge is straight */
      fp.setZ(i, fp.getZ(i)*(1-nx*nx*0.42));
    }
    fg.computeVertexNormals();
    const fin=new THREE.Mesh(fg,mSeal);
    fin.position.y=-H/2+H+FINH/2-0.012;
    fin.castShadow=Q.shadows;
    grp.add(fin);
    grp.userData.finT=fin; grp.userData.finHome=fin.position.y;
  }
  /* 7 Sep, Bazil: the ears. The plate's seal does not stop at the body: each end folds down
     onto the gusset gable as a small triangular flap of plain film, hanging from the fin's
     end with its apex down the ridge. It stands in the gusset's mid plane, so side on it
     is a line, and from the front it is the little wing at each top corner. */
  {
    const yBase=-H/2+H-0.012, yTop=yBase+FINH;
    [-1,1].forEach(function(sg){
      /* the flap, in the fin end's own frame: it hangs from x=0 (the fin end) and its apex
         reaches past the shoulder (the plate's ear clears the body by a few percent) and
         most of the way down the gable. Folded a little toward the front, as a real ear
         lies, so the three quarter sees its face rather than its edge. */
      /* 7 Sep, Bazil: "repair the weird left and right top protruding outward". The apex
         used to clear the body by five percent and the flap was swung well toward the
         front, so each corner read as a wing standing off the pack. The ear is now a fold
         that stays inside the shoulder line: apex a little over half way to the shoulder,
         and only a slight turn to the front. */
      const ex=(aS-aT)*0.55, ey=roofH*0.72;
      const eg=new THREE.BufferGeometry();
      eg.setAttribute('position',new THREE.Float32BufferAttribute([0,yTop,0, 0,yBase-0.02,0, sg*ex,yBase-ey,0],3));
      eg.setAttribute('uv',new THREE.Float32BufferAttribute([0.1,0.9, 0.1,0.1, 0.9,0.5],2));
      eg.setIndex([0,1,2]); eg.computeVertexNormals();
      const ear=new THREE.Mesh(eg,V2WHITE?bare():new THREE.MeshPhysicalMaterial({...film,map:texCrimpPlain,roughness:.7,side:THREE.DoubleSide}));
      ear.material.side=THREE.DoubleSide;
      ear.position.x=sg*aT;
      ear.rotation.y=sg*0.22;    /* a slight turn to the front, no longer a wing */
      ear.rotation.z=sg*-0.05;
      /* 7 Sep, Bazil: "you still haven't fixed the sharp sides". The tucked ear still read
         as a spike at each top corner. The real pack's fin ends are soft folds, so the
         flaps are not added at all. */
      // grp.add(ear);
    });
  }
  /* the lap seam down the back, which the desk plate shows plainly */
  {
    const v0=0.03, v1=YS-0.02, sh=H*(v1-v0);
    const sg=new THREE.BoxGeometry(0.055,sh,0.05,1,30,1);
    const sp=sg.attributes.position;
    for(let i=0;i<sp.count;i++){
      const v=v0+(sp.getY(i)/sh+0.5)*(v1-v0);
      sp.setZ(i, -(prof(v)[1]+0.008)+sp.getZ(i)*0.5);
    }
    sg.computeVertexNormals();
    const seam=new THREE.Mesh(sg,mFoot);
    seam.position.y=-H/2+(v0+(v1-v0)/2)*H;
    grp.add(seam);
  }
  /* 7 Sep, Bazil: five percent less thick. Done on the group, not the profile: thinning the
     profile re-spread the perimeter UVs and stretched the front art (the halal roundel went oval). */
  grp.scale.z=0.95;
  return grp;
}

function buildPack(front,side,crimp,aFront,aSide,back,dims,bulge,hasCrimp,crimpPlain){
  const W=(dims&&dims[0])||2.5, H=(dims&&dims[1])||2.8, D=(dims&&dims[2])||1.5;
  const BU=(bulge==null)?0.34:bulge;   /* a fuller belly, as the bag sits */
  const CRIMP=(hasCrimp==null)?true:hasCrimp;
  const g=new THREE.BoxGeometry(W,H,D,Q.seg[0],Q.seg[1],Q.seg[2]);
  const pos=g.attributes.position;
  for(let i=0;i<pos.count;i++){
    let x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
    const ny=Math.abs(y)/(H/2), nx=Math.abs(x)/(W/2), nz=Math.abs(z)/(D/2);
    /* pillow bulge on faces. A printed carton uses a tiny value here and keeps
       its edges, which is what separates the kraft boxes from the film packs. */
    z += Math.sign(z)*BU*Math.cos(nx*Math.PI/2)*Math.cos(ny*Math.PI/2)*(Math.abs(z)/(D/2));
    /* the gussets swell too: the real bag is squat and fat, not a slab, so the
       sides get a smaller sympathetic bulge of their own */
    x += Math.sign(x)*BU*0.34*Math.cos(ny*Math.PI/2)*Math.cos(nz*Math.PI/2)*(Math.abs(x)/(W/2));
    /* the seal pinch. A pillow bag draws IN ON BOTH AXES toward the fin: the
       shoulders slope from about 72% of the height and the width comes in with
       the depth. Pinching depth alone (the old 8% on x) left a full-width flat
       top, which is what made this read as a printed box rather than a bag. */
    if(CRIMP){
      const cr=(ny-0.72)/0.28;
      if(cr>0){ const k=Math.pow(Math.min(cr,1),1.35); z*=(1-k*0.94); x*=(1-k*0.30); }
    }
    pos.setXYZ(i,x,y,z);
  }
  g.computeVertexNormals();
  /* glossy printed polypropylene film */
  const film={metalness:0,roughness:.62,roughnessMap:texCrinkle,
    clearcoat:.17,clearcoatRoughness:.52,envMapIntensity:.14,
    color:new THREE.Color(0xfff3e4)};   /* the studio shot's warmth */
  if(texCrinkleN){ film.normalMap=texCrinkleN; film.normalScale=new THREE.Vector2(.42,.42); }
  else { film.bumpMap=texCrinkle; film.bumpScale=.04; }
  const mFront=new THREE.MeshPhysicalMaterial({...film,map:front,
    alphaMap:aFront,alphaTest:.5,side:THREE.DoubleSide});
  const mSide=new THREE.MeshPhysicalMaterial({...film,map:side,
    alphaMap:aSide,alphaTest:.5,side:THREE.DoubleSide});
  /* the box's pinched top and bottom faces wear the plain crinkle when one is
     supplied; the scripted repeats stay on the sealed fin only */
  const mCr=new THREE.MeshPhysicalMaterial({...film,map:crimp,roughness:.7});
  const mCrBox=crimpPlain?new THREE.MeshPhysicalMaterial({...film,map:crimpPlain,roughness:.7}):mCr;
  /* the reverse is printed, not die-cut, so it needs no mask */
  const mBack=new THREE.MeshPhysicalMaterial({...film,map:back||front,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(g,[mSide,mSide,mCrBox,mCrBox,mFront,mBack]);
  mesh.castShadow=Q.shadows;
  const grp=new THREE.Group(); grp.add(mesh);
  /* crimp fins — film packs only. A printed carton has folded flaps, not a
     sealed fin, so giving it one made it read as a pouch. */
  if(CRIMP){
    /* the crimp stands proud at the centre but FOLLOWS the pinched shoulder:
       it narrows, droops toward its ends and thins out, so it reads as a
       sealed seam rather than a straight banner floating clear of the bag at
       the corners, which is what a flat box gives you */
    const finG=new THREE.BoxGeometry(W*0.74,0.12,0.03,24,1,1);
    {
      const fp=finG.attributes.position;
      for(let i=0;i<fp.count;i++){
        const nx=Math.abs(fp.getX(i))/(W*0.37);
        fp.setY(i, fp.getY(i)-Math.pow(nx,1.8)*0.16);
        fp.setZ(i, fp.getZ(i)*(1-nx*nx*0.5));
      }
      finG.computeVertexNormals();
    }
    const finT=new THREE.Mesh(finG,mCr); finT.position.y=H/2+0.045; grp.add(finT);
    /* NO bottom fin: the real bag seals with a fin at the TOP only and folds
       flat at the base, so a second fin down there was inventing a seam */
    grp.userData.finT=finT;
    grp.userData.finHome=H/2+0.045;  /* the cook rig restores it here, never a stale constant */
  }
  return grp;
}

const crinkleCv=crinkleCanvas();
const texCrinkle=(()=>{ const t=new THREE.CanvasTexture(crinkleCv);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(2,2); return t; })();
await __breath();
const texCrinkleN=Q.normals?await normalFromHeight(crinkleCv,2.2):null;
await __breath();
const texBrothN=await normalFromHeight(brothHeight(),HI?2.6:1.8);
await __breath();
const texGlazeN=await normalFromHeight(glazeHeight(),0.7);
const texNoodleSkin=noodleSkin();
await __breath();
buildMarkParts();           /* the logo cut-outs first, on their own, so the front paint that follows is a shorter task */
await __breath();
const texFront=drawFront();
await __breath();
const texBack=drawBack();
await __breath();
const texSide=drawSide(),texCrimp=drawCrimp(),texCrimpPlain=drawCrimpPlain();
await __breath();
const texNoodle=drawNoodle();
/* the v2 bag is 0.726 as deep as it is wide, not the 0.60 the gusset panel was
   drawn for, so it gets its own wider plate rather than a 21% stretch */
/* THE BAG'S PLAN, in one place. buildBagV2 reads these and so does the gusset
   plate below, so the painted panel can never drift from the panel it lands on
   again.
   Set against the photographs, measured as bag height over bag width in each:
   the marketing render reads 1.062, the retail bag on the floor 1.016, the
   studio three-quarter 1.135. 0.950 rendered 0.963 — wider than every one of
   them, which the side-by-side section on the page shows at a glance. 0.864
   lands on 1.06, the middle of the three. */
/* SOLVED 2 Sep 2026 from the three studio plates TOGETHER, not from one:
   studio-3q boxes 674x766 with the front/gusset crease at 21.4% of the box;
   studio-gusset boxes 443x730 side-on. Same bag height, so D = 0.607H, then
   D*sin(t) = 0.214*width gives t = 18.7 degrees and W = 0.755H (D/W 0.80).
   0.864 came from a retail bag lying on a floor and the client's own CGI,
   neither of which is the product photograph Bazil measures against. */
const V2W=0.891, V2D=0.607;   /* 8 Sep, Bazil, settled after going both ways: 0.99 less a tenth ("compress the 3D and the graphic by 10% only"), the plate still across the full face. */
/* THE WIDTH, settled 3 Sep. The references do not agree with each other, and the
   disagreement is real, not a measurement error:

     studio-3q      three-quarter, studio    box 1.131 tall per wide   implies 0.78
     studio-gusset  side-on, studio          0.632 wide per tall       fixes the depth
     real-floor     face-on, retail bag      0.961 tall per wide       implies about 1.0
     client CGI     face-on                  1.062 tall per wide       implies about 0.94

   The two face-on references, which are the view a shopper and this site's hero both
   take, say the bag is nearly as wide as it is tall. The three-quarter studio plate
   says it is a third narrower. A bag photographed lying on a floor splays its gussets
   open, which widens it, so some of that gap is real; not all of it.

   Bazil has asked for wider three times, looking at the hero face-on, and 0.93 is his
   number. At 0.93 the render reads 1.024 tall per wide face-on, between the retail
   bag's 0.961 and the client's own 1.062. The cost is the three-quarter silhouette,
   which boxes 0.990 against that plate's 1.131.

   What this does NOT cost: the front's overall match, which measured 69.5 at 0.93 and
   69.3 at 0.78, because the print realigns with the width. The pre-stretch V2A below
   is derived from V2W, so round things stay round at any width.

   To go back to the plate-derived width, this one number: 0.78. */

/* 2 Sep, later: Bazil asked for wider against the retail photographs (the bag
   in hand reads 1.016 tall per wide, the marketing render 1.062) and the
   studio solve above (0.755) stood 10% narrower than both. Then, side by
   side with the studio plate it read wrong for a moment and went to 0.79;
   Bazil: the width was correct, the plate looks thinner because of the angle.
   0.93 stays. Compare at the angle that gives the plate's gusset share, 22.6 degrees. The depth stays the gusset plate's 0.607.
   The front canvas lands on a face taller per wide than the canvas itself;
   V2A is that stretch, and drawFront(true) draws the round things wide by it. */
const V2A=(FW/(V2W*2.83))/(871/2.312);
const SW2=Math.round(FW*(V2D/V2W));
await __breath();
const texSideV2=drawSideAt(SW2), texSideV2R=drawSideAt(SW2,true), texCrimpV2=drawCrimpV2(), texFrontV2=drawFront(true);
const texFrontA=drawFrontAlpha(),texSideA=drawSideAlpha();
const texShadow=blobShadow(),texSteam=steamTex();

/* print QA: ?flatpack lays the raw panels out flat, front, back and gusset,
   so they can be proofed against the photographed pack without 3D distortion */
function showFlat(){
  const m=location.search.match(/flatpack=?(\w*)/);
  if(!m) return;
  const pick={front:[texFront],back:[texBack],side:[texSide]}[m[1]]||[texFront,texBack,texSide];
  const old=document.getElementById('flatproof');
  const wrap=document.createElement('div'); wrap.id='flatproof';
  wrap.style.cssText='position:fixed;left:10px;top:10px;bottom:10px;right:10px;z-index:99999;display:flex;gap:10px;align-items:flex-start;overflow:auto';
  pick.forEach(function(t){
    const el=t.image;
    el.style.cssText='height:96vh;width:auto;box-shadow:0 10px 40px rgba(0,0,0,.45);flex:none';
    wrap.appendChild(el);
  });
  if(old) old.replaceWith(wrap); else document.body.appendChild(wrap);
}
/* repaint the panels and their masks whenever a late asset lands */
function refreshPanels(){
  markWordC=null; markGlyphC=null;   /* the mark's cut-outs are rebuilt when their source images land */
  const nf=drawFront();  texFront.image =nf.image; texFront.needsUpdate =true;
  const nk=drawBack();   texBack.image  =nk.image; texBack.needsUpdate  =true;
  const ns=drawSide();   texSide.image  =ns.image; texSide.needsUpdate  =true;
  const na=drawFrontAlpha(); texFrontA.image=na.image; texFrontA.needsUpdate=true;
  const nb=drawSideAlpha();  texSideA.image =nb.image; texSideA.needsUpdate =true;
  /* the v2 gusset plates repaint too. They are painted once at module-eval,
     before assets/vits-roundel.webp has loaded, so without this the v2 bag wears
     the photographic mark on its front and the drawn fallback on both gussets. */
  if(typeof texSideV2!=='undefined'&&texSideV2){
    const nv=drawSideAt(SW2);      texSideV2.image =nv.image; texSideV2.needsUpdate =true;
    const nw=drawSideAt(SW2,true); texSideV2R.image=nw.image; texSideV2R.needsUpdate=true;
    const nf2=drawFront(true);     texFrontV2.image=nf2.image; texFrontV2.needsUpdate=true;
  }
  showFlat();
}
showFlat();
/* fonts may land after the first draw */
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(refreshPanels);
/* the real mark artwork, with its cut-out bottom */
(function(){
  const img=new Image();
  img.onload=function(){
    logoImg=img;
    const m=canv(img.naturalWidth,img.naturalHeight),mx=m.getContext('2d');
    mx.drawImage(img,0,0);
    mx.globalCompositeOperation='source-in';
    mx.fillStyle='#fff'; mx.fillRect(0,0,m.width,m.height);
    logoMask=m;
    refreshPanels();
  };
  img.onerror=function(){
    /* Without this the drawn Vit's oval quietly stands in and an uploaded
       logo looks like it was ignored. */
    console.warn('Pack logo failed to load, using the drawn mark:', img.src);
  };
  img.src=pk('mark.image','assets/vits-logo.webp');
})();
/* the phoenix and the JAKIM halal chop, lifted from the pack artwork */
[['assets/vits-phoenix.webp',function(i){phxImg=i;}],
 ['assets/vits-halal.webp',  function(i){halalImg=i;}],
 ['assets/vits-roundel.webp',function(i){roundelImg=i;}],
 ['assets/vits-cake.webp',   function(i){cakeImg=i;}],
 /* the cake as it reads THROUGH THE FILM: vits-window.png tone-mapped onto
    the reference wall's window-interior plate, see tools notes in the commit */
 ['assets/vits-window-film.webp', function(i){windowImg=i;}],
 /* 2 Sep, Bazil: "realistic noodle inside". The stock strand photo above is
    magnified far past the real cake (a dozen strands across the window
    against forty). ref/window-interior.webp IS the client's front window,
    print and all, so v2 lays it straight into the oval; the gusset takes a
    print-free strip of the real cake from the gusset plate, mirror-tiled. */
 ['assets/ref/window-interior.webp', function(i){ovalPhoto=i;}],
 ['assets/ref/studio-gusset.webp', function(i){
    const w=i.naturalWidth,h=i.naturalHeight, sx=w*0.23, sy=h*0.30, sw=w*0.58, sh=h*0.15;
    const c=canv(Math.round(sw),Math.round(sh*4)),x=c.getContext('2d');
    for(let k=0;k<4;k++){ x.save(); x.translate(0,sh*k+(k%2?sh:0)); x.scale(1,k%2?-1:1);
      x.drawImage(i,sx,sy,sw,sh,0,0,sw,sh); x.restore(); }
    gussetCake=c; }],
 ['assets/vits-wintype.webp',function(i){winTypeImg=i;}],
 /* THE CLIENT'S OWN FRONT: ref-05, the studio front rectified into painter
    coordinates (1024 x 869 = the wall below the shoulder). Bazil, 3 Sep:
    "you already have the exact reference, copy and paste". The measured bag
    wears this photograph on its face; the painters stay for the roof, the
    seal, the gussets, the back and the four flavour packs. */
 ['assets/pack-front-photo.webp',function(i){refFrontImg=i;}]   /* 4 Sep: 4K upscale (Higgsfield) fitted to 2560, so the face texture is drawn from more pixels than it shows */,
 /* the gussets the same way: the right from the straight-on studio gusset
    plate, the left rectified out of the three-quarter plate's gusset */
 ['assets/sku-penang-front.webp?v=2',function(i){ skuPhoto.penang=i; reskinSku('penang'); }],
 ['assets/sku-tomato-front.webp?v=2',function(i){ skuPhoto.tomato=i; reskinSku('tomato'); }],
 ['assets/sku-bayam-front.webp?v=2', function(i){ skuPhoto.bayam=i;  reskinSku('bayam'); }],
 ['assets/sku-carbo-front.webp?v=2', function(i){ skuPhoto.carbo=i;  reskinSku('carbo'); }],
 ['assets/pack-side-right-photo.webp',function(i){refSideR=i;}],
 ['assets/pack-side-left-photo.webp',function(i){refSideL=i;}]].forEach(function(p){
  const img=new Image();
  img.onload=function(){ p[1](img); refreshPanels(); };
  img.onerror=function(){ console.warn('Pack artwork missing, using the drawn fallback:',p[0]); };
  img.src=p[0];
});

function makeRenderer(holder){
  const r=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  r.setPixelRatio(DPR); r.outputColorSpace=THREE.SRGBColorSpace;
  if(Q.shadows){ r.shadowMap.enabled=true; r.shadowMap.type=THREE.PCFSoftShadowMap; }
  r.localClippingEnabled=true;   /* the ramen model is cut off at the broth line */
  r.setSize(holder.clientWidth,holder.clientHeight);
  holder.appendChild(r.domElement);
  return r;
}
/* an invisible plane that catches the real shadow, over a transparent canvas */
function shadowCatcher(scene,y){
  if(!Q.shadows) return null;
  const p=new THREE.Mesh(new THREE.PlaneGeometry(16,16),
    new THREE.ShadowMaterial({opacity:.22}));
  p.rotation.x=-Math.PI/2; p.position.y=y; p.receiveShadow=true; scene.add(p);
  return p;
}
/* one room probe PER RENDERER: a PMREM target belongs to the context that
   baked it, so the 3D page's second canvas needs its own copy or its film
   loses the env term and the yellow goes olive */
const _envRTs=new WeakMap();
function envMap(renderer){
  let _envRT=_envRTs.get(renderer);
  if(!_envRT){
    const pmrem=new THREE.PMREMGenerator(renderer); pmrem.compileEquirectangularShader();
    _envRT=pmrem.fromScene(new RoomEnvironment(),0.04);
    _envRTs.set(renderer,_envRT);
  }
  return _envRT.texture;
}
/* THE STUDIO (2 Sep). The room probe lights every direction, so a film bag
   reflects it everywhere: at the roof's grazing angle Fresnel pushed the
   yellow to (254,203,129), and the flat front carried 46 of blue against the
   plate's 2. A product photograph is shot in a DARK room with one softbox: the
   gloss lands where the box reflects and nowhere else. The equirect below is
   that room: near-black, a large soft panel front-right-above (the plate's
   highlight runs down the right of the front and across the roof), a small
   fill front-left. Used by the v2 slot only; the printed packs keep the room
   they were colour-matched in. */
const _studioRTs=new WeakMap();
function studioEnv(renderer){
  let rt=_studioRTs.get(renderer);
  if(!rt){
    const W=1024,H=512,c=canv(W,H),x=c.getContext('2d');
    /* a grey room with a dark camera side: the flat front reflects straight
       back toward the camera and reads (246,227,2) with no lift; the gusset,
       seen at 70 degrees, reflects the side of the room and reads (224,183,57) */
    x.fillStyle='#4a4a4a'; x.fillRect(0,0,W,H);
    panel( 0.0,-0.1, 1.0, 300, 200, 1.0, '#060606');
    /* equirect: u = atan2(dir.z,dir.x)/2pi + 0.5, v = asin(dir.y)/pi + 0.5,
       canvas row 0 is v = 1 (flipY). A panel at direction (px,py,pz): */
    function panel(px,py,pz,rw,rh,a,col){
      const L=Math.hypot(px,py,pz); px/=L; py/=L; pz/=L;
      const u=(Math.atan2(pz,px)/(Math.PI*2)+0.5)*W, v=(1-(Math.asin(py)/Math.PI+0.5))*H;
      const g=x.createRadialGradient(u,v,0,u,v,Math.max(rw,rh));
      const c=col||'255,250,240'; const rgb=col?col.replace('#','').match(/../g).map(h=>parseInt(h,16)).join(','):c;
      g.addColorStop(0,'rgba('+rgb+','+a+')'); g.addColorStop(0.55,'rgba('+rgb+','+(a*0.85)+')');
      g.addColorStop(1,'rgba('+rgb+',0)');
      x.save(); x.translate(u,v); x.scale(rw/Math.max(rw,rh),rh/Math.max(rw,rh)); x.translate(-u,-v);
      x.fillStyle=g; x.fillRect(u-rw*1.2,v-rh*1.2,rw*2.4,rh*2.4); x.restore();
    }
    panel( 2.2, 2.4, 3.0, 150, 95, 1.0);   /* the softbox, front-right-above */
    panel(-3.0, 0.8, 2.6,  70, 50, 0.35);  /* a fill card, front-left */
    panel( 0.0, 6.0,-1.0,  90, 40, 0.10);  /* a faint ceiling bounce */
    const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
    tex.mapping=THREE.EquirectangularReflectionMapping;
    const pmrem=new THREE.PMREMGenerator(renderer);
    rt=pmrem.fromEquirectangular(tex); _studioRTs.set(renderer,rt);
  }
  return rt.texture;
}
function lights(scene,renderer,studio){
  if(studio){
    scene.environment=studioEnv(renderer);
    /* the diffuse comes from the lights, the gloss from the room above */
    /* neutral lamps: the print's own colour is fitted in the film tint, so
       the lamps do not tint it twice. Levels measured against the plate's
       flat front-left field (246,227,2): the first pass at 0.30/0.62/0.20
       came back 2.9x short in linear light. */
    /* the roof rendered (254,231,21) against the plate's (243,209,9): the sky
       half of the hemisphere was lighting it; less sky, more key */
    scene.add(new THREE.HemisphereLight(0xffffff,0x8a8070,0.70));
    const k=new THREE.DirectionalLight(0xffffff,1.52); k.position.set(2.2,1.4,6.0); scene.add(k);   /* the fuller front catches more of the box: 1.72 read (254,231,48) */   /* the second fill adds to the front; measured (255,250,38) at 2.40 against the plate's (246,227,2) */   /* lower: the roof was still 8% over the front, the plate has it 8% under */
    /* the fill is warm and GRAZING: the plate's gusset reads (224,183,57),
       as bright as the front and more orange. From (-4,1.2,4.6) at 0.7 the
       gusset came back at 0.79 of the front; from the side at 2.0 it lifts
       the gusset by 1.4 and the front by only 0.1 */
    const f=new THREE.DirectionalLight(0xffe6c4,1.8); f.position.set(-6.0,1.2,2.0); scene.add(f);
    /* the right gusset sat in the dark at the card's resting angle; the plates light both sides */
    const f2=new THREE.DirectionalLight(0xffe4c0,1.3); f2.position.set(6.0,1.0,2.4); scene.add(f2);
    return;
  }
  scene.environment=envMap(renderer);
  /* Lighting was summing to 2.84 with no tone mapping, so every value over 1.0
     clipped to white and took the saturation with it: the pink Penang read as
     off-white and the kraft cartons went flat. Down to ~1.80 total, which keeps
     the packs inside the displayable range and lets the print colour show. */
  /* studio-shot balance: one warm key from the upper LEFT (the client photo's
     light), less ambient so the pillow reads as form, not as a flat cutout */
  scene.add(new THREE.HemisphereLight(0xfff6e0,0x8a6238,0.40));
  const d=new THREE.DirectionalLight(0xfff2dd,0.40); d.position.set(-3.2,4.4,7.2); scene.add(d);
  /* shadow comes from straight overhead so the pack is grounded, not slabbed sideways */
  if(Q.shadows){
    const sl=new THREE.DirectionalLight(0xffffff,0);
    sl.position.set(0.8,10,1.6); sl.castShadow=true;
    sl.shadow.mapSize.set(1024,1024);
    const sc=sl.shadow.camera;
    sc.left=-5; sc.right=5; sc.top=5; sc.bottom=-5; sc.near=0.5; sc.far=26;
    sl.shadow.bias=-0.0012; sl.shadow.normalBias=0.035; sl.shadow.radius=4;
    scene.add(sl);
  }
  const f=new THREE.DirectionalLight(0xffe2b0,0.14); f.position.set(-5,2,-4); scene.add(f);
  const r=new THREE.DirectionalLight(0xffffff,0.16); r.position.set(3.4,1.2,6.2); scene.add(r);
}


/* ============================================================
   The stage: ONE renderer, ONE scene, ONE pack.
   The mini pack travels the whole page — hero, story, trade,
   the range turntable, then the cook where it tips and pours.
   A single instance means it can never double up on itself.
   ============================================================ */
/* ---------- standalone specimens (the 3D page) ----------
   The travelling stage below assumes one canvas and the scroll channels. The
   3D page has neither: every [data-pack3d] slot gets its own renderer, camera
   and pack, so two designs can stand side by side. Every painter above is
   reused verbatim — nothing here re-draws artwork. */
function mountSpecimens(){
  const slots=Array.prototype.slice.call(document.querySelectorAll('[data-pack3d]'));
  if(!slots.length) return;
  function sizeView(v){
    const w=v.slot.clientWidth,h=v.slot.clientHeight; if(!w||!h) return;
    v.r.setSize(w,h); v.cam.aspect=w/h; v.cam.updateProjectionMatrix();
    /* frame the pack from the slot's own shape: a narrow slot dollies back so
       the pillow never crops, which is the same trick the hero uses */
    const d=(3.6/2)/Math.tan(v.cam.fov*Math.PI/360);
    v.dist=d*(1+Math.max(0,0.95-v.cam.aspect)*1.6);
    /* the studio plates were shot from about 6.5 degrees above eye level: the
       roof reads 15.6% of the box against an 11.9% shoulder, the base edge
       rises to the right, and every front element sits lower than an
       eye-level render puts it. The v2 slot takes that camera. */
    v.elev=v.slot.getAttribute('data-pack3d')==='mini2'?4*Math.PI/180:0;   /* 8 read as a carton lid on the card; 4 keeps the roof without it */
    v.cam.position.set(0,0.05+v.dist*Math.sin(v.elev),v.dist*Math.cos(v.elev));
    v.cam.lookAt(0,0,0);
  }
  const views=slots.map(function(slot){
    const r=makeRenderer(slot);
    const key=slot.getAttribute('data-pack3d');
    /* A white bag has nowhere to go in a rig with no tone curve: measured, the
       roof planes come back 2.27x the front face, so the whole top clipped to
       paper and the shape vanished. In ?white the v2 canvas gets the neutral
       (PBR) curve — the product-photography one, which keeps hue while it
       rolls the highlight off. PRINTED packs never get it: they were
       colour-matched in the untouched pipeline. */
    if(key==='mini2' && V2WHITE && THREE.NeutralToneMapping!=null){
      /* exposure measured on the canvas, not guessed: at 1.0 the whole bag
         compressed into six levels of near-paper; 0.60 puts the front face at
         220, the gusset at 172 and the roof at 245, which is where a white
         pack sits in a studio frame. */
      r.toneMapping=THREE.NeutralToneMapping; r.toneMappingExposure=0.60;
    }
    const mx=Math.min(Q.aniso,r.capabilities.getMaxAnisotropy());
    [texFront,texBack,texSide,texCrimp,texFrontA,texSideA,texCrimpPlain,texFrontV2,texSideV2,texSideV2R]
      .forEach(function(t){ if(t){ t.anisotropy=mx; t.needsUpdate=true; } });
    const scene=new THREE.Scene();
    /* the reference plates were shot on a long lens: near-orthographic. At
       fov 32 the v2 render came back 9% taller per wide than the studio mask
       purely from perspective, so its slot gets a 16 and dollies twice as far
       back for the same framing. The printed packs keep the 32 they were
       staged in. */
    const cam=new THREE.PerspectiveCamera(key==='mini2'?16:32,1,0.1,60);
    lights(scene,r,key==='mini2');
    let pack,hUnits;
    if(key==='mini2'){
      /* clean start: bare white film, shape only */
      pack=buildBagV2();
      hUnits=2.83;
    }else{
      const sk=RANGE_SKUS.filter(function(s){ return s.key===key; })[0]||RANGE_SKUS[0];
      if(sk.key==='mini'){
        pack=buildPack(texFront,texSide,texCrimp,texFrontA,texSideA,texBack,null,null,null,texCrimpPlain);
      }else{
        const ft=drawSkuFront(sk);
        pack=buildPack(ft,drawSkuSide(sk),drawSkuCrimp(sk),null,null,drawSkuBack(sk),sk.dims,sk.bulge,sk.crimp);
        pack.userData.frontTex=ft; pack.userData.sku=sk; skuPacksRef.push(pack);
      }
      hUnits=sk.dims[1];
    }
    pack.scale.setScalar(2.8/hUnits);   /* every specimen stands the same height */
    scene.add(pack);
    /* data-pack3d-set="penang,tomato,..." builds the flavour packs into the SAME
       scene, hidden, and slot.__show(key) swaps which one stands: one renderer,
       one WebGL context, the reel shows each bowl its own pack (7 Sep) */
    const packs={}; packs[key]=pack;
    const setAttr=slot.getAttribute('data-pack3d-set');
    if(setAttr) setAttr.split(',').map(function(k){ return k.trim(); }).forEach(function(k){
      if(!k||packs[k]) return;
      const sk=RANGE_SKUS.filter(function(s){ return s.key===k; })[0]; if(!sk) return;
      let q;
      if(sk.key==='mini'){ q=buildPack(texFront,texSide,texCrimp,texFrontA,texSideA,texBack,null,null,null,texCrimpPlain); }
      else{
        const ft=drawSkuFront(sk);
        q=buildPack(ft,drawSkuSide(sk),drawSkuCrimp(sk),null,null,drawSkuBack(sk),sk.dims,sk.bulge,sk.crimp);
        q.userData.frontTex=ft; q.userData.sku=sk; skuPacksRef.push(q);
      }
      q.scale.setScalar(2.8/sk.dims[1]); q.visible=false; scene.add(q); packs[k]=q;
    });
    /* data-pack3d-still: no idle turn, the pack eases back to its home angle
       after a drag, so the front is what a reader sees */
    const still=slot.hasAttribute('data-pack3d-still');
    const st={y:-0.34,x:0.05,vy:0,drag:false,px:0,py:0,idle:0,home:-0.34};
    bindSpin(slot,st);
    const v={slot:slot,r:r,scene:scene,cam:cam,pack:pack,st:st,live:true,packs:packs,still:still};
    slot.__show=function(k){
      const q=packs[k]||packs[key]; if(!q||q===v.pack) return;
      q.rotation.copy(v.pack.rotation); v.pack.visible=false; q.visible=true; v.pack=q;
    };
    if(window.IntersectionObserver) new IntersectionObserver(function(en){ v.live=en[0].isIntersecting; },{rootMargin:'120px 0px'}).observe(slot);
    sizeView(v);
    slot.classList.add('is3d');
    return v;
  });
  window.__specimens=views;            /* a handle for measuring the framing */
  addEventListener('resize',function(){ views.forEach(sizeView); });
  let last=performance.now();
  (function loop(now){
    requestAnimationFrame(loop);
    const dt=Math.min(0.05,(now-last)/1000); last=now;
    views.forEach(function(v){
      if(!v.live) return;   /* off screen, no render */
      const st=v.st;
      /* let go and it eases back to a slow turn, so a still page still moves */
      if(!st.drag){
        st.idle+=dt; st.vy*=0.94; st.y+=st.vy;
        if(v.still){ if(st.idle>0.6) st.y+=(st.home-st.y)*0.05; }
        else if(st.idle>1.1) st.y+=dt*0.26*Math.min(1,(st.idle-1.1)*1.5);
        st.x+=(0.05-st.x)*0.04;
      }
      v.pack.rotation.y=st.y;
      v.pack.rotation.x=st.x;
      v.pack.position.y=Math.sin(now*0.0009)*0.05;
      v.r.render(v.scene,v.cam);
    });
  })(performance.now());
}

const holder=document.getElementById('stage3d');
mountSpecimens();   /* 4 Sep: the home page carries one too (the reel's pack) */
if(!holder) return;
await __breath();
const renderer=makeRenderer(holder);
/* 4 Sep: Khronos PBR Neutral on the page stage. Without a mapper every lit value over 1.0 clipped to
   white and took the saturation with it; Neutral keeps the print's hue and only rolls the highlights.
   The compare card on 3d.html keeps its calibrated pipeline. */
if(THREE.NeutralToneMapping!=null){ renderer.toneMapping=THREE.NeutralToneMapping; renderer.toneMappingExposure=1.12; }   /* 8 Sep, Bazil: "a bit vibrant": 1.05 to 1.12 */
(function(){
  const mx=Math.min(Q.aniso,renderer.capabilities.getMaxAnisotropy());
  [texFront,texBack,texSide,texCrimp,texFrontA,texSideA,texCrinkle,texCrinkleN]
    .forEach(t=>{ if(t){ t.anisotropy=mx; t.needsUpdate=true; } });
})();
const scene=new THREE.Scene();
const cam=new THREE.PerspectiveCamera(34,holder.clientWidth/holder.clientHeight,0.1,60);
const BASEZ=9.6;
cam.position.set(0,0.1,BASEZ);
lights(scene,renderer);

/* THE ONE MINI PACK IS THE V2 BAG (Bazil, 2 Sep: "choose the best version").
   It was staged and colour-matched under the studio rig, not the room probe
   the rest of this scene uses, so it brings its own lamps on LAYER 1: a
   three.js light only reaches objects that share a layer with it, so the
   bowl, the ramen and the four flavour packs keep the room they were matched
   in, and the yellow pack keeps the studio. Its film reflects the studio
   room explicitly, not the scene's probe. */
const packMini=buildBagV2(); window.__packMini=packMini;   /* measuring hook */
packMini.traverse(function(o){
  o.layers.set(1);
  if(o.isMesh){ const ms=Array.isArray(o.material)?o.material:[o.material];
    ms.forEach(function(m){ if(m&&m.isMeshPhysicalMaterial){ m.envMap=studioEnv(renderer); m.needsUpdate=true; } }); }
});
cam.layers.enable(1);
(function(){
  const g=new THREE.Group(); g.layers.set(1);
  const h=new THREE.HemisphereLight(0xffffff,0x8a8070,0.70); h.layers.set(1); g.add(h);
  const k=new THREE.DirectionalLight(0xffffff,1.30); k.position.set(2.2,1.4,6.0); k.layers.set(1); g.add(k);
  const f=new THREE.DirectionalLight(0xffe6c4,1.8); f.position.set(-6.0,1.2,2.0); f.layers.set(1); g.add(f);
  const f2=new THREE.DirectionalLight(0xffe4c0,1.3); f2.position.set(6.0,1.0,2.4); f2.layers.set(1); g.add(f2);
  scene.add(g);
})();
scene.add(packMini);
/* the other four best sellers, shown only on the range runway */
await __breath();
const skuPacks=RANGE_SKUS.slice(1).map(function(sk){
  const ft=drawSkuFront(sk);
  const g=buildPack(ft,drawSkuSide(sk),drawSkuCrimp(sk),null,null,drawSkuBack(sk),
                    sk.dims,sk.bulge,sk.crimp);
  g.userData.frontTex=ft; g.userData.sku=sk; skuPacksRef.push(g);
  g.userData.fit=2.8/sk.dims[1];        /* standardise height against the mini pack */
  g.visible=false;
  scene.add(g);
  return g;
});
function hideSkus(){ for(const g of skuPacks) g.visible=false; }
/* the range hands the cook scene its last specimen: the carbonara pack ends the
   runway, so that is the pack that flies over the bowl and pours. Falls back to
   the mini pack if the SKU list is ever shortened to one. */
/* when a flavour pack's photograph lands, its face is repainted in place */
function reskinSku(key){
  skuPacksRef.forEach(function(g){
    const sk=g.userData.sku; if(!sk||sk.key!==key) return;
    const nt=drawSkuFront(sk); let n=0;
    g.traverse(function(o){
      const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];
      ms.forEach(function(m){ if(m.map===g.userData.frontTex){ m.map=nt; m.needsUpdate=true; n++; } });
    });
    if(!n) console.warn('reskinSku: no face carried the old texture for',key);
    g.userData.frontTex=nt;
  });
}
window.__reskinSku=reskinSku;   /* verification hook */
function cookPack(){ return packMini; }   /* 4 Sep, Bazil: "the original packaging needs to pour, not this one". The yellow pack cooks; the range specimens stay on their rail. */

/* The blob shadow is GONE (5 Sep, Bazil: "remove the shadow"). It read as a grey
   ellipse floating on the cream, not as contact. The mesh is kept and simply
   never shown, so the opacity lines through the frame branches stay valid and
   the turntable's grounding logic needs no rewrite; only the ellipse is gone. */
const shA=new THREE.Mesh(new THREE.PlaneGeometry(4.6,4.6),
  new THREE.MeshBasicMaterial({map:texShadow,transparent:true,depthWrite:false}));
shA.rotation.x=-Math.PI/2; shA.position.y=-2.35; shA.visible=false; scene.add(shA);
/* 4 Sep, Bazil: "lower down the bowl". Every bowl-relative constant hangs off BOWL_Y, so the
   dish, its broth clip, its shadow plane and the cake's landing mark all move together. The
   giant cook line sits at the top of the stage and the dish must clear it. */
const BOWL_Y=-2.80, BOWL_DY=BOWL_Y+1.75;   /* 7 Sep, Bazil: the bowl lower, clear of the pouring pack */
const catcher=shadowCatcher(scene,-2.34+BOWL_DY);
/* bowl: the blue-and-white porcelain from the serving video, a flared cone
   with a dense cobalt pattern, not a red-rim enamel bowl */
await __breath();
const bowlGrp=new THREE.Group(); scene.add(bowlGrp); bowlGrp.position.set(0,BOWL_Y,0);
/* one function drives the wall, the broth radius and the ramen cut, so they always agree */
const BOWL_H=1.78;   /* 5 Sep, Bazil: bigger, more iconic. 1.30 against a 3.68 mouth was 2.8 wide per tall, which is a dish. A noodle bowl is nearer 2.1. */
/* THE PROFILE IS WHAT MAKES IT A BOWL (5 Sep). t^0.90 is very nearly a straight
   line, so the wall came out as a cone and read as a wide shallow dish on a
   pedestal. A noodle bowl carries its belly LOW: the radius opens quickly off a
   narrow foot, then eases as it climbs, and turns out again into a lip at the
   rim. t^0.62 gives that belly, the sine adds the swell, and the last term is
   the everted lip which is the detail the eye actually reads as porcelain. */
/* 4 Sep, Bazil: "why doesn't the bowl look like a bowl". t^0.62 still reads as a flared cone.
   A donburi is CONVEX: a wide foot, the wall bellies out fast low down, then straightens toward
   the rim and turns out into a lip. 1-(1-t)^1.8 bends the wall the right way. */
const bowlR=t=>0.72+1.20*Math.pow(1-Math.pow(1-t,1.8),0.85)+0.06*Math.pow(t,12);
const BROTH_Y=BOWL_H*0.862;                           /* soup sits high in the bowl, as a share of its depth */
const BROTH_R=bowlR(BROTH_Y/BOWL_H)*0.994;            /* meets the wall, no cream gap */
const bowlPts=[];
for(let i=0;i<=44;i++){ const t=i/44;
  bowlPts.push(new THREE.Vector2(bowlR(t), t*BOWL_H)); }
/* the cobalt pattern, painted: rosette medallions in offset rows, ring lines, blue lip */
function porcelainTex(){
  /* 5 Sep, Bazil: "this kind of bowl with the logo of the brand on it, like a red bowl,
     would be great". The blue and white pattern was a generic chinaware; a solid brand red
     bowl carrying the Vit's mark is the product's own bowl and it reads at any size. */
  const W=2048,H=1024,c=canv(W,H),x=c.getContext('2d');
  x.fillStyle='#C8151C'; x.fillRect(0,0,W,H);   /* a shade under the print red: the glaze lifts it back */
  /* the rim: a cream lip, then a hairline, the way a glazed bowl is banded */
  x.fillStyle='#FBF3E2'; x.fillRect(0,0,W,26);
  x.fillStyle='rgba(251,243,226,.32)'; x.fillRect(0,54,W,5);
  /* a deeper red under the lip so the wall has some shading of its own */
  const g=x.createLinearGradient(0,26,0,H);
  g.addColorStop(0,'rgba(0,0,0,.13)'); g.addColorStop(.30,'rgba(0,0,0,0)');
  g.addColorStop(.86,'rgba(0,0,0,.10)'); x.fillStyle=g; x.fillRect(0,26,W,H-26);
  /* the mark, twice around, so one always faces the reader whatever the turn. Drawn here
     rather than through drawLogo, which fills in the brand red (invisible on a red bowl)
     and depends on the pack's mark parts having loaded. */
  /* u 0.25 and 0.75 put the mark on the bowl's left and right edges; the reader faces
     u 0.5, and u 0 is the wrap, drawn as two halves so the back mark is not cut. */
  [W*0.5, 0, W].forEach(function(cx){
    /* low on the outside wall: high up it dominated the bowl and the back mark read
       backwards through the mouth, because the glaze is drawn on both sides */
    const cy=H*0.63, rx=W*0.082, ry=rx*0.58;
    x.save();
    x.fillStyle='#FBF3E2';
    x.beginPath(); x.ellipse(cx,cy,rx*1.13,ry*1.13,0,0,Math.PI*2); x.fill();
    x.fillStyle=CR;
    x.beginPath(); x.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); x.fill();
    x.strokeStyle='#FBF3E2'; x.lineWidth=rx*0.055;
    x.beginPath(); x.ellipse(cx,cy,rx*0.90,ry*0.90,0,0,Math.PI*2); x.stroke();
    x.fillStyle='#FBF3E2'; x.textAlign='center'; x.textBaseline='middle';
    x.font='italic 800 '+Math.round(ry*0.94)+'px '+PF;
    x.fillText("Vit's",cx,cy-ry*0.06);
    x.restore();
  });
  /* the foot band */
  x.fillStyle='rgba(251,243,226,.26)'; x.fillRect(0,H-84,W,4);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
  t.anisotropy=Q.aniso;
  t.wrapS=THREE.RepeatWrapping; t.repeat.set(1,1);
  return t;
}
const glazed={color:0xFFFFFF,roughness:.13,metalness:0,
  clearcoat:1,clearcoatRoughness:.15,envMapIntensity:.80,
  normalMap:texGlazeN,normalScale:new THREE.Vector2(.12,.12)};
const bowl=new THREE.Mesh(new THREE.LatheGeometry(bowlPts,Q.shadows?96:48),
  new THREE.MeshPhysicalMaterial({...glazed,color:0xffffff,map:porcelainTex(),side:THREE.DoubleSide}));
bowl.castShadow=Q.shadows; bowl.receiveShadow=Q.shadows;
bowlGrp.add(bowl);
/* 7 Sep: the glaze was drawn on both sides, so the back mark read backwards through the
   mouth while the bowl rose. The outside keeps the print; the inside is plain red. */
bowl.material.side=THREE.FrontSide;
const bowlIn=new THREE.Mesh(bowl.geometry,new THREE.MeshPhysicalMaterial({...glazed,color:0xC8151C,side:THREE.BackSide}));
bowlGrp.add(bowlIn);
/* the rim highlight (was a cobalt lip, 5 Sep: the bowl is brand red now) */
const rim=new THREE.Mesh(new THREE.TorusGeometry(bowlR(1),0.034,16,120),
  new THREE.MeshPhysicalMaterial({color:0xFBF3E2,roughness:.14,metalness:0,
    clearcoat:1,clearcoatRoughness:.06,envMapIntensity:1.1}));
rim.rotation.x=Math.PI/2; rim.position.y=BOWL_H; rim.castShadow=Q.shadows; bowlGrp.add(rim);   /* was a hard 1.30 and would have floated once the bowl deepened */
/* a foot ring, not a pedestal: 0.60/0.72 under a 0.30 base stood the bowl on a
   saucer. It tucks under the belly now and reads as thrown, not stacked. */
const foot=new THREE.Mesh(new THREE.CylinderGeometry(0.56,0.60,0.15,48),   /* a wider ring under the wider base */
  new THREE.MeshPhysicalMaterial({...glazed}));
foot.position.y=-0.06; foot.castShadow=Q.shadows; bowlGrp.add(foot);
const shB=new THREE.Mesh(new THREE.PlaneGeometry(6.5,6.5),
  new THREE.MeshBasicMaterial({map:texShadow,transparent:true,depthWrite:false}));
shB.rotation.x=-Math.PI/2; shB.position.y=-0.12; shB.visible=false; bowlGrp.add(shB);   /* 5 Sep: no ground shadow anywhere */
/* broth */
const broth=new THREE.Mesh(new THREE.CircleGeometry(BROTH_R,96),
  new THREE.MeshPhysicalMaterial({color:0xA83A14,roughness:.16,metalness:0,
    clearcoat:1,clearcoatRoughness:.10,envMapIntensity:1.35,
    normalMap:texBrothN,normalScale:new THREE.Vector2(.55,.55),
    transparent:true,opacity:0}));
broth.receiveShadow=Q.shadows;
broth.rotation.x=-Math.PI/2; broth.position.y=BROTH_Y; bowlGrp.add(broth);
/* noodle cake: the supplied model is dropped in once it loads */
const cake=new THREE.Group();
cake.visible=false; scene.add(cake);
function setOpacity(root,o){
  root.traverse(n=>{ if(n.isMesh&&n.material){
    (Array.isArray(n.material)?n.material:[n.material]).forEach(m=>{
      m.transparent=o<0.999; m.opacity=o; });
  }});
}
/* strands: spirals that grow when cooking */
const strandGrp=new THREE.Group(); strandGrp.position.y=1.06; strandGrp.visible=false; bowlGrp.add(strandGrp);
/* wet cooked noodle: pale wheat skin, broth-slicked so it catches a highlight */
const strandMat=new THREE.MeshPhysicalMaterial({map:texNoodleSkin,roughness:.30,metalness:0,
  clearcoat:.7,clearcoatRoughness:.22,envMapIntensity:.85,
  sheen:.4,sheenColor:new THREE.Color(0xFFE9BE)});
const NST=HI?26:14;
for(let s=0;s<NST;s++){
  const pts=[]; const a0=s/NST*Math.PI*2*1.7, r0=0.26+(s%6)*0.22;
  const kink=0.5+Math.random()*0.9;
  for(let i=0;i<=34;i++){ const t=i/34;
    const r=r0*(1-t*0.20)+Math.sin(t*7+s)*0.07+Math.sin(t*19+s*2)*0.022*kink;
    pts.push(new THREE.Vector3(
      Math.cos(a0+t*5.6)*r,
      t*0.32+Math.sin(t*9+s)*0.05+Math.sin(t*23+s)*0.014,
      Math.sin(a0+t*5.6)*r)); }
  const tube=new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),HI?70:40,0.034+Math.random()*0.008,HI?10:7),
    strandMat);
  tube.castShadow=Q.shadows;
  strandGrp.add(tube);
}
/* the ramen itself comes from the Sketchfab model; its own bowl is clipped off at the
   broth line so only the noodles and toppings sit inside ours.
   "Classic Ramen" by Polypus_yum, CC-BY-4.0 — credited in the footer. */
const ramenGrp=new THREE.Group(); ramenGrp.visible=false; bowlGrp.add(ramenGrp);
/* the model ships with its own bowl. A flat cut cannot separate it, because its rim sits
   at the same height as the food, so cut radially too: the wall lives at r 0.87-1.25,
   the food inside 0.87. One floor plane plus a ring of side planes isolates the food. */
/* the food is scaled to exactly fill this, so their bowl wall falls outside the cut.
   sized off the ceramic so the noodles run right out to it. safe below the broth too,
   because the floor plane removes everything down there, where the bowl narrows. */
/* The overhead finish shows the whole surface of the dish at once, so both the
   roundness of the cut and how far the food reaches now read. A 10-sided cut
   left visible straight chords, and stopping short of the wall left a ring of
   bare broth around the food. */
const RAMEN_N=HI?20:12;                        /* sides of the cut */
const RAMEN_OUTER=BROTH_R*0.99;                /* widest the food may reach, inside the wall */
/* planes sit at the apothem, so the polygon CORNERS land on RAMEN_OUTER rather than past it */
const RAMEN_R=RAMEN_OUTER*Math.cos(Math.PI/RAMEN_N);
const ramenClips=[new THREE.Plane(new THREE.Vector3(0,1,0),-(BROTH_Y+BOWL_Y)+0.04)];
for(let i=0;i<RAMEN_N;i++){ const a=i/RAMEN_N*Math.PI*2;
  ramenClips.push(new THREE.Plane(new THREE.Vector3(-Math.cos(a),0,-Math.sin(a)),RAMEN_R)); }
/* Material clipping planes live in WORLD space: they do not follow the object.
   The constants above are written for the bowl at rest, so the moment the bowl
   travels, the stationary cut starts slicing the food off - the noodles look
   like they are being eaten away by nothing. Re-seat the planes on the bowl
   every frame it moves. Translating a plane by t is c' = c - n.t */
const RAMEN_REST=new THREE.Vector3(0,BOWL_Y,0);
const clipBase=ramenClips.map(p=>p.constant);
const clipT=new THREE.Vector3();
function syncRamenClips(){
  clipT.copy(bowlGrp.position).sub(RAMEN_REST);
  for(let i=0;i<ramenClips.length;i++){
    ramenClips[i].constant=clipBase[i]-ramenClips[i].normal.dot(clipT);
  }
}
new GLTFLoader().load('assets/classic_ramen/scene.gltf',gltf=>{ setTimeout(function(){ warmGPU(); warmRun(); },0);
  const m=gltf.scene;                                 /* the glTF export is already Y-up */
  m.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(m);
  const sz=box.getSize(new THREE.Vector3()), ctr=box.getCenter(new THREE.Vector3());
  const holder=new THREE.Group();
  holder.add(m);
  m.position.set(-ctr.x,-box.min.y,-ctr.z);           /* stand it on its own base */
  let mesh=null; m.traverse(n=>{ if(n.isMesh) mesh=n; });
  const pa=mesh.geometry.attributes.position, v=new THREE.Vector3();
  const pct=(arr,f)=>arr.slice().sort((a,b)=>a-b)[Math.floor(f*(arr.length-1))];
  /* holder has no parent yet, so these read in bowl-local space, same frame as BROTH_Y */
  const sample=()=>{ holder.updateMatrixWorld(true);
    const ys=[],rs=[];
    for(let i=0;i<pa.count;i++){ v.fromBufferAttribute(pa,i).applyMatrix4(mesh.matrixWorld);
      ys.push(v.y); rs.push(Math.hypot(v.x,v.z)); }
    return {ys,rs}; };
  /* first pass fits the whole thing, then we measure where the food ends and the wall begins */
  const s0=Math.min(2.85/sz.x,2.85/sz.z);
  holder.scale.setScalar(s0);
  holder.position.y=0;
  const a1=sample();
  /* 0.88 measured the food's own outer edge and grew it to just touch the cut,
     which left the gaps between its lobes bare. Reading further in overfills
     the cut instead, so the clip trims a full surface at the wall. */
  const foodR=pct(a1.rs,0.76);                          /* well inside the food, not its edge */
  const grow=RAMEN_R/foodR;                             /* until the food overfills the cut */
  /* flatter in Y: filling the bowl width would otherwise tower it above the rim */
  holder.scale.set(s0*grow,s0*grow*0.46,s0*grow);
  /* the bbox top is a stray raised prop, so place by where the geometry actually is:
     most verts sit in a thin band that is the noodle layer. Rest that on the broth. */
  const a2=sample();
  holder.position.y=(BROTH_Y+0.06)-pct(a2.ys,0.55);
  m.traverse(n=>{ if(n.isMesh){
    n.castShadow=Q.shadows; n.receiveShadow=Q.shadows;
    const mats=Array.isArray(n.material)?n.material:[n.material];
    mats.forEach(mt=>{ mt.clippingPlanes=ramenClips; mt.clipShadows=true;
      mt.envMapIntensity=1.0; mt.side=THREE.DoubleSide; });
  }});
  ramenGrp.add(holder);
  ramenGrp.userData.holder=holder;
  window.__dbg={THREE,bowlGrp,ramenGrp,holder,model:m,clips:ramenClips};
},undefined,err=>console.warn('classic_ramen did not load:',err));

/* garnish: the dressed bowl, piled toward the middle like the serving shot */
const garnishGrp=new THREE.Group(); garnishGrp.position.y=1.38; garnishGrp.scale.setScalar(1.25);
garnishGrp.visible=false; bowlGrp.add(garnishGrp);
/* everything in the bowl is wet, so each gets a clearcoat and reads off the probe */
const wet=(o)=>new THREE.MeshPhysicalMaterial({metalness:0,clearcoat:.85,
  clearcoatRoughness:.14,envMapIntensity:1.0,...o});
const matChilli  =wet({color:0xD4241A,roughness:.20});
const matChilliIn=wet({color:0xF3D3AC,roughness:.42,clearcoat:.5});
const matOnion   =wet({color:0xA06BB2,roughness:.22,
  sheen:.6,sheenColor:new THREE.Color(0xE6C7F0)});
const matHerb    =wet({color:0x3C8F35,roughness:.30,
  sheen:.5,sheenColor:new THREE.Color(0xBFE9A8)});
const matStrip   =wet({color:0xF3D451,roughness:.26});
const matSambal  =wet({color:0x8A4718,roughness:.52,clearcoat:.55});
/* sambal mound at the centre */
for(let i=0;i<16;i++){
  const s=0.055+Math.random()*0.055;
  const b=new THREE.Mesh(new THREE.DodecahedronGeometry(s,0),matSambal);
  const a=Math.random()*Math.PI*2, r=Math.random()*0.34;
  b.position.set(Math.cos(a)*r,0.055+Math.random()*0.05,Math.sin(a)*r);
  b.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3);
  garnishGrp.add(b);
}
/* yellow strips fanned under the pile */
for(let i=0;i<6;i++){
  const st=new THREE.Mesh(new THREE.BoxGeometry(0.085,0.055,0.62),matStrip);
  const a=-0.5+i*0.30;
  st.position.set(Math.sin(a)*0.30-0.05,0.055,Math.cos(a)*0.16+0.16);
  st.rotation.set(0.06,a*0.9,0.05);
  garnishGrp.add(st);
}
/* chilli slices: red rings with a pale core */
for(let i=0;i<5;i++){
  const g=new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.095,0.032,8,18),matChilli));
  const core=new THREE.Mesh(new THREE.CircleGeometry(0.068,16),matChilliIn);
  core.position.z=0.001; g.add(core);
  const a=1.5+i*0.85, r=0.34+Math.random()*0.26;
  g.position.set(Math.cos(a)*r,0.11+Math.random()*0.05,Math.sin(a)*r);
  g.rotation.set(-Math.PI/2+0.5+Math.random()*0.5,0,Math.random()*Math.PI);
  garnishGrp.add(g);
}
/* onion rings, standing proud of the pile */
for(let i=0;i<5;i++){
  const o=new THREE.Mesh(new THREE.TorusGeometry(0.20+Math.random()*0.07,0.016,7,22,2.2+Math.random()),matOnion);
  const a=-0.2+i*0.5;
  o.position.set(Math.cos(a)*0.42+0.06,0.17+Math.random()*0.09,Math.sin(a)*0.34-0.10);
  o.rotation.set(-0.9-Math.random()*0.5,Math.random()*Math.PI,Math.random()*0.6);
  garnishGrp.add(o);
}
/* herb leaves on top */
for(let i=0;i<3;i++){
  const lf=new THREE.Mesh(new THREE.SphereGeometry(0.13,10,8),matHerb);
  lf.scale.set(1,0.14,0.62);
  lf.position.set(-0.10+i*0.13,0.20+i*0.03,-0.02-i*0.10);
  lf.rotation.set(-0.25+i*0.2,0.7-i*0.6,0.25);
  garnishGrp.add(lf);
}
/* steam: wisps that rise off the broth surface, each on its own loop */
const STEAM_N=HI?16:8;
const steam=[];
for(let i=0;i<STEAM_N;i++){
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:texSteam,transparent:true,
    opacity:0,depthWrite:false}));
  sp.userData={ph:i/STEAM_N+Math.random()*0.05, ang:Math.random()*Math.PI*2,
    rad:0.15+Math.random()*1.25, sway:0.6+Math.random()*0.9, rate:0.85+Math.random()*0.4};
  sp.scale.set(1,1,1);
  bowlGrp.add(sp); steam.push(sp);
}
/* splash ring */
const splash=new THREE.Mesh(new THREE.TorusGeometry(0.7,0.05,8,40),
  new THREE.MeshBasicMaterial({color:0xE8A54B,transparent:true,opacity:0}));
splash.rotation.x=Math.PI/2; splash.position.y=1.1; bowlGrp.add(splash);/* the noodle block that sits inside the bag, seen through the die-cut windows */
new GLTFLoader().load('noodle.glb',gltf=>{ setTimeout(function(){ warmGPU(); warmRun(); },0);
  const raw=gltf.scene;
  /* the supplied cake reads pale and flat next to the client photos — warm the
     base tint and roughen it so the window shows bread-warm matte strands */
  raw.traverse(n=>{ if(n.isMesh&&n.material){
    if(n.material.color) n.material.color.set(0xE2C892);
    if('roughness' in n.material) n.material.roughness=0.88;
  }});
  /* inside the bag: stood upright so it faces the die-cut windows */
  const proto=new THREE.Group();
  const up=raw.clone(true); up.rotation.x=-Math.PI/2;
  proto.add(up); proto.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(proto);
  const sz=box.getSize(new THREE.Vector3()), ctr=box.getCenter(new THREE.Vector3());
  /* fill the bag: width and depth uniform, height stretched to span both windows */
  const s=Math.min(2.20/sz.x,0.86/sz.z), sy=s*(2.00/(sz.y*s));
  for(const grp of [packMini]){
    if(!grp) continue;
    const m=proto.clone(true);
    m.scale.set(s,sy,s);
    m.position.set(-ctr.x*s,-ctr.y*sy-0.20,-ctr.z*s);
    grp.add(m); grp.userData.noodle=m;
  }
  /* in the bowl: left flat, the way the cake drops out of the pack */
  const flat=raw.clone(true);
  flat.traverse(n=>{ if(n.isMesh&&n.material)                 /* own materials, it fades */
    n.material=Array.isArray(n.material)?n.material.map(m=>m.clone()):n.material.clone(); });
  flat.updateMatrixWorld(true);
  const fb=new THREE.Box3().setFromObject(flat);
  const fz=fb.getSize(new THREE.Vector3()), fc=fb.getCenter(new THREE.Vector3());
  const k=Math.min(2.10/fz.x,2.10/fz.z);
  flat.scale.setScalar(k);
  flat.position.set(-fc.x*k,-fc.y*k,-fc.z*k);
  cake.add(flat);
},undefined,err=>console.warn('noodle.glb did not load:',err));
/* ---------- drag-to-spin: the range turntable, and the hero pack ---------- */
function bindSpin(el,st){
  if(!el) return;
  el.style.cursor='grab';
  el.style.touchAction='pan-y';
  el.addEventListener('pointerdown',e=>{
    st.drag=true; st.px=e.clientX; st.py=e.clientY; st.vy=0; st.idle=0;
    try{ el.setPointerCapture(e.pointerId); }catch(_){ /* synthetic or stale pointer: no capture, the drag still works */ }
    el.style.cursor='grabbing';
  });
  el.addEventListener('pointermove',e=>{
    if(!st.drag) return;
    const dx=e.clientX-st.px, dy=e.clientY-st.py;
    st.px=e.clientX; st.py=e.clientY;
    st.vy=dx*0.009; st.y+=st.vy;
    st.x=Math.max(-0.5,Math.min(0.5,st.x+dy*0.005));
    st.idle=0;
  });
  const release=e=>{
    if(!st.drag) return;
    st.drag=false; el.style.cursor='grab';
    if(e.pointerId!=null&&el.hasPointerCapture(e.pointerId))
      el.releasePointerCapture(e.pointerId);
  };
  el.addEventListener('pointerup',release);
  el.addEventListener('pointercancel',release);
}
const spin={y:-0.34,x:0.04,vy:0,drag:false,px:0,py:0,idle:0};
bindSpin(document.querySelector('.specHit'),spin);
/* the hero pack takes the same drag; its offset relaxes home when left alone */
const hspin={y:0,x:0,vy:0,drag:false,px:0,py:0,idle:0};
/* THE ANATOMY (4 Sep): the labelling runway turns the pack and moves in on its features.
   Keyframes over the runway progress: [p, yaw, zoom, lift]. Front, window close-up, the
   right gusset, the back, and round to the phoenix. A full turn lands on 0 again, so the
   travel that follows starts where this ends. */
/* third cut, 4 Sep: the pack holds still and front on for the callouts */
const ANAT_K=[[0,0,1,0],[1,0,1,0]];
let labelM=0;
function anatPlan(p){
  for(let i=1;i<ANAT_K.length;i++){ const a=ANAT_K[i-1], b=ANAT_K[i];
    if(p<=b[0]){ let t=(p-a[0])/(b[0]-a[0]); t=t*t*(3-2*t);
      return {yaw:a[1]+(b[1]-a[1])*t, zoom:a[2]+(b[2]-a[2])*t, lift:a[3]+(b[3]-a[3])*t}; } }
  const l=ANAT_K[ANAT_K.length-1]; return {yaw:l[1],zoom:l[2],lift:l[3]};
}
/* the five points the beats lead to, as fractions of the pack's own box (u,v,w) plus the
   face normal they sit on, so a point that faces away is dropped */
const ANAT_HOT={roundel:[0.31,0.47,1,0,0,1],window:[0.40,0.19,1,0,0,1],halal:[0.15,0.74,1,0,0,1],phoenix:[0.60,0.72,1,0,0,1],weight:[0.84,0.27,1,0,0,1],gusset:[1,0.55,0.5,1,0,0],back:[0.5,0.55,0,0,0,-1]};
let _lbox=null; const _hv=new THREE.Vector3(), _hn=new THREE.Vector3(), _cd=new THREE.Vector3();
function publishHotspots(obj){
  if(!_lbox){
    obj.updateMatrixWorld(true);
    const inv=obj.matrixWorld.clone().invert(); const box=new THREE.Box3();
    obj.traverse(o=>{ if(o.isMesh&&o.geometry){ if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const bb=o.geometry.boundingBox; if(!bb||!isFinite(bb.min.x)||!isFinite(bb.max.x)) return;   /* empty or unloaded geometry */
      box.union(bb.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld))); } });
    if(box.isEmpty()||!isFinite(box.min.x)||!isFinite(box.max.y)) return; _lbox=box; window.__anatBox={min:box.min.toArray(),max:box.max.toArray()};
  }
  const out={}; _cd.copy(cam.position).normalize();
  for(const k in ANAT_HOT){ const h=ANAT_HOT[k];
    _hv.set(_lbox.min.x+(_lbox.max.x-_lbox.min.x)*h[0], _lbox.min.y+(_lbox.max.y-_lbox.min.y)*h[1], _lbox.min.z+(_lbox.max.z-_lbox.min.z)*h[2]);
    obj.localToWorld(_hv);
    _hn.set(h[3],h[4],h[5]).applyQuaternion(obj.quaternion).normalize();
    const f=_hn.dot(_cd);
    _hv.project(cam);
    const sx=(_hv.x*0.5+0.5)*holder.clientWidth, sy=(0.5-_hv.y*0.5)*holder.clientHeight;
    if(!isFinite(sx)||!isFinite(sy)) continue;
    out[k]={x:sx, y:sy, f:f};
  }
  window.__packHot=out;
}
bindSpin(document.querySelector('.heroHit'),hspin);
/* TURN IT WHILE IT TRAVELS (5 Sep, Bazil: "i want to be able to turn and play
   with the 3d while it is parlax down"). The canvas is a background layer with
   no pointer events, so grabbing it anywhere would swallow every link and every
   text selection on the page. Instead a hit layer is parked on the pack's own
   published box each frame: it is exactly as big as the pack, so the rest of
   the page keeps working, and touch-action pan-y leaves vertical scrolling to
   the page on a phone. The drag adds an OFFSET on top of the scripted rotation
   and unwinds when let go, so the flight plan still owns where the pack is. */
const tspin={y:0,x:0,vy:0,drag:false,px:0,py:0,idle:0};
const packHit=document.createElement('div');
packHit.id='packHit'; packHit.setAttribute('aria-hidden','true');
packHit.style.cssText='position:fixed;left:0;top:0;width:0;height:0;z-index:91;'+
  'pointer-events:auto;touch-action:pan-y;display:none';
document.body.appendChild(packHit);
bindSpin(packHit,tspin);
function placePackHit(on){
  const b=window.__packBox;
  if(!on||!b||!b.w||b.w<24){ packHit.style.display='none'; return; }
  /* inset a little so the very edge of the box does not steal clicks from
     anything sitting right beside the pack */
  const pad=Math.min(28,b.w*0.08);
  packHit.style.display='block';
  packHit.style.left=Math.round(b.x-b.w/2+pad)+'px';
  packHit.style.top=Math.round(b.y-b.h/2+pad)+'px';
  packHit.style.width=Math.round(Math.max(0,b.w-pad*2))+'px';
  packHit.style.height=Math.round(Math.max(0,b.h-pad*2))+'px';
}

/* ---------- sizing ---------- */
let mf=1;   /* narrow-aspect dolly factor so the pack fits phones */
let bowlPre=0;   /* 12 Sep: how far the bowl has already risen across the range-to-cook seam (phones) */
/* THE COOK'S CLEAR BAND (5 Sep). The overhead finish ran on a fixed rig, so on an
   1800x1000 window the served dish opened from y=62 to y=938 and swallowed the step
   caption whole. The pack's own box never showed this, because the pack has faded by
   the time the camera swings over and __packBox is the only thing published. The band
   is read off the page rather than guessed, so a longer caption, a type change or a
   new viewport cannot put the dish back on the words. Computed style plus offsetWidth
   and offsetHeight, not getBoundingClientRect: the stage is sticky at top:0 and both
   elements are absolute inside it, so this reads correctly whatever the page is
   scrolled to, and nothing is measured during a scroll. */
const COOK_CLEAR=34;   /* air the copy keeps above and below the dish, in CSS px */
const CAP_RIDE=14;     /* js/motion.js rides each caption up to 14px above its slot while it is still lit */
const DISH_R=1.98;     /* the rim is 1.84 across the radius, 1.874 with the lip; this adds the steam halo */
let cookHalf=0.26;     /* half the dish's allowed screen height, as a fraction of the viewport */
function measureCookBand(){
  const w=holder.clientWidth||1, h=holder.clientHeight||1;
  /* the widest the dish can ever be, measured on the un-dollied rig. topFit below
     only ever pulls the camera back, so nothing outside this column can be covered
     by the dish, and nothing outside it gets a say in how big the dish may be. */
  const reach=DISH_R*h/(2*6.995*mf*Math.tan(cam.fov*Math.PI/360));
  let top=0, bot=h;
  /* the kicker stands on the left rail, clear of the centred dish, so on a desktop
     window it imposes nothing. It is measured anyway and applied only when its own
     box reaches the dish's column, which is what happens on a phone: that way moving
     it back to centre can never silently stop the band protecting it. */
  const k=document.querySelector('#cook .k');
  if(k){ const cs=getComputedStyle(k), kt=parseFloat(cs.top), kl=parseFloat(cs.left);
         const kx0=isFinite(kl)?kl:0, kx1=kx0+k.offsetWidth;
         if(isFinite(kt)&&kx1>w/2-reach&&kx0<w/2+reach) top=kt+k.offsetHeight; }
  /* the captions are centred and always under the dish, so they always rule. The
     reserve carries their ride, because each one lifts off its slot as it leaves. */
  const caps=document.querySelector('#cook .cookCaps');
  if(caps){ const cb=parseFloat(getComputedStyle(caps).bottom);
            let capH=0;
            caps.querySelectorAll('.ccap').forEach(function(c){ capH=Math.max(capH,c.offsetHeight); });
            if(isFinite(cb)) bot=h-cb-capH-CAP_RIDE; }
  /* the dish stays centred on the frame, so the tighter of the two sides rules.
     The floor keeps a squat window from shrinking it to a coin. */
  cookHalf=Math.max(0.16,Math.min((bot-COOK_CLEAR)/h-0.5, 0.5-(top+COOK_CLEAR)/h));
}
function sizeAll(){
  const w=holder.clientWidth,h=holder.clientHeight; if(!w||!h) return;
  renderer.setSize(w,h); cam.aspect=w/h; cam.updateProjectionMatrix();
  mf=1+Math.max(0,0.95-cam.aspect)*1.7;
  measureCookBand();   /* after mf: the band's own reach test uses it */
}
addEventListener('resize',sizeAll); sizeAll();
/* the captions are set in Anton: measure again once the face lands, or the band is
   read off fallback metrics and the dish is framed a little too generously. init3D
   waits on VITS_READY and the pack fonts, so load has usually fired already. */
if(document.readyState!=='complete') addEventListener('load',measureCookBand);
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(measureCookBand,function(){});

/* ---------- choreography ---------- */
/* channels from js/motion.js, mirrored with a rate cap so fast flings stay smooth */
const T={hero:0,travel:0,range:0,cook:0};
const M={hero:0,travel:0,range:0,cook:0};
function ch(p,a,b){ return Math.max(0,Math.min(1,(p-a)/(b-a))); }
const EZ=t=>t*t*(3-2*t);
/* world position from a fraction of the half-frustum, so paths scale with the window */
/* 10 Sep, THE PHONE WAS BEING DRAWN AT THE WRONG SCALE. mf dollies the camera back on narrow
   frames (1.83 at 390x844), so the frame at z=0 is mf times taller than BASEZ says, and every
   frame-unit (NDC) position or size computed here landed at 1/mf of where it was meant: a slot
   at 0.54 drew at 0.30, "above the frame" at 1.6 drew inside it, and every pack came out at
   half its slot. The helpers carry mf now; on a desktop frame mf is 1 and nothing moves. */
function fx(f){ return f*Math.tan(cam.fov*Math.PI/360)*BASEZ*mf*cam.aspect; }
function fy(f){ return f*Math.tan(cam.fov*Math.PI/360)*BASEZ*mf; }
/* world units per screen pixel. The canvas fills the viewport and the frustum
   is symmetric, so one number serves both axes. */
function wpp(){ return (2*fy(1))/Math.max(1,holder.clientHeight); }
/* the specimen dock: the pack is sized to the slot the layout measured rather
   than to a fixed number, so a wide window cannot blow it up past its column.
   PACK_H/PACK_W are the mini pack box; every SKU is normalised to that height
   by userData.fit, and the yaw adds a sliver of depth to the silhouette. */
const PACK_H=2.95, PACK_W=3.2;   /* 3 Sep: the 0.99-wide bag at its resting turn (W cos 0.34 + D sin 0.34) is 3.2 across; 2.75 was the old box and let the pack cover the label callouts */
/* fill is how much of the slot's height the pack should take. Width is given a
   little more room because the yaw only ever shows a sliver of the depth. */
function fitScale(b,fill){
  if(!b||!b.w||!b.h) return 1.06;
  const u=wpp();
  const s=Math.min((b.h*fill*u)/PACK_H,(b.w*(fill+0.14)*u)/PACK_W);
  return Math.max(innerWidth<=760?0.30:0.55,Math.min(1.35,s));   /* 10 Sep: a phone slot is a third of a desktop one; the floor kept the pack bigger than its slot there */
}
/* 12 Sep: every SKU is normalised to the mini pack's HEIGHT, so a wide one (the carbonara zip
   pack) renders far wider. At 800 that put it at 845px in an 800px frame. The stacked band above
   the phone takes a smaller fill so the widest pack still fits its column. */
function dockScale(){ return fitScale((window.__ph||{}).dockBox,innerWidth<=760?0.78:(innerWidth<=1000?0.58:0.80)); }   /* phones: the slot is the pack's whole stage */
/* the hero slot is the pack's own stage, so it fills more of it than the
   specimen slot does, and stands inside the ring the page draws */
function heroScale(){
  const hb=(window.__ph||{}).heroBox;
  /* the drawn silhouette runs past the nominal box (bulge, fins, perspective),
     so filling 0.86 of the slot put the pack over the fact strip below it */
  /* the drawn silhouette is wider than the nominal box, so a fill that fits the
     slot on paper still spills into the copy column beside it */
  /* 5 Sep, Bazil: "why is the placement awkward". Measured at 1756x1241 the
     drawn pack came out 809px wide inside a 729px column, 1.109 times its slot,
     with its right edge at 1729 against a 1756 screen: it was running off the
     page rather than sitting in its half. fitScale works from the NOMINAL box,
     and the drawn silhouette is wider than nominal, so the fill carries the
     correction instead of the constant, which the range and the label share. */
  /* 7 Sep, Bazil: "must fit one shot when people land". Measured at 1926x1319:
     fill 1.02 drew the pack 1.26x its slot (834px in a 660px slot) and put its
     foot 61px under the fold. The drawn silhouette runs 1.24x per unit of fill,
     so 0.78 keeps the whole pack inside the slot, and the slot now takes the
     whole of the hero's second row, so it is no smaller on screen. */
  /* 12 Sep, Bazil on an iPad: at 768x1024 innerHeight is over 900, so the tall-screen fill of
     1.10 applied to a narrow stacked hero. The drawn pack came out 598px tall, box [63,390,674,988],
     and the lede starts at 924: its first line was under the pack's foot. The stacked band fills
     0.84, the same as the phone, and the slot is the whole of the hero's second row there. */
  return fitScale(hb&&hb.px,innerWidth<=760?0.84:(innerWidth<=1000?0.84:(innerHeight<=900?0.94:1.10)));   /* 7 Sep: a 900 tall screen lands the whole pack; taller screens keep the full fill */   /* 7 Sep, Bazil: bigger again; the proof strip leaves the middle open for its foot */   /* 7 Sep, Bazil: "20% bigger packaging" */
}
/* Where the pack actually lands on screen, corner by corner. Deriving the box
   from position and scale alone was out by more than a tenth of the width: the
   bulge, the crimp fins and the perspective on the near face all push the
   silhouette past the nominal 2.5 x 2.8 box. The labelling stage hangs its
   rings off this, so it has to be the drawn shape, not the nominal one. */
const _pbBox=new THREE.Box3(), _pbV=new THREE.Vector3();
function publishPackBox(obj){
  _pbBox.setFromObject(obj);
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(let i=0;i<8;i++){
    _pbV.set((i&1)?_pbBox.max.x:_pbBox.min.x,
             (i&2)?_pbBox.max.y:_pbBox.min.y,
             (i&4)?_pbBox.max.z:_pbBox.min.z).project(cam);
    const sx=(_pbV.x*0.5+0.5)*holder.clientWidth;
    const sy=(0.5-_pbV.y*0.5)*holder.clientHeight;
    if(sx<x0)x0=sx; if(sx>x1)x1=sx; if(sy<y0)y0=sy; if(sy>y1)y1=sy;
  }
  window.__packBox={x:(x0+x1)/2,y:(y0+y1)/2,w:x1-x0,h:y1-y0};
}
/* the labelling stage is the pack's close-up, so it fills its slot hardest */
function labelScale(){
  const lb=(window.__ph||{}).labelBox;
  /* reads the same size as the hero: front on it shows one face where the turned hero pack
     shows two, so it carries 18% more scale, unless the stage cannot hold it */
  /* 11 Sep: on a phone the hero cap (heroScale x 1.18) held the close-up BELOW the hero pack,
     which is the opposite of what this stage is for. The phone slot alone sizes it. */
  if(innerWidth<=760) return fitScale(lb&&lb.px,0.90);   /* the drawn silhouette runs about 40px past its slot, so 0.90 fills the stage without reaching the heading or beat 1 */   /* 12 Sep, Bazil: the stage has empty red either side, so the close-up takes it */
  return Math.min(heroScale()*1.18,fitScale(lb&&lb.px,1.0));
}

/* the travel flight plan between the hero and the range. The section fractions
   (marks) are measured by motion.js on every ScrollTrigger refresh, so each leg
   lands exactly on its scene whatever the copy or viewport does to the layout. */
function travelWaypoints(){
  const PH=window.__ph||{};
  const mk=PH.marks||{storyIn:0.10,storyOut:0.42,tradeIn:0.55,tradeOut:0.92};
  const dockX=(PH.dockX!=null)?PH.dockX:0.46;
  /* the factory frame is sticky, so its live box is measured by motion.js;
     without it the pack parked on the section top, which is the copy */
  const tb=PH.tradeBox||{x:-0.56,y:0.05,s:0.46};
  /* the story lane is the empty right column of the heritage timeline, also
     measured live. The pack rides it while the milestones pass on the left. */
  const sb=PH.storyBox||{x:0.05,y:-0.02,s:0.66};
  const mb=PH.mapBox||tb, qb=PH.quoteBox||tb, hb2=PH.headBox||tb;
  /* BELT AND BRACES ON THE FLIGHT PLAN. A waypoint's value is measured live by
     motion.js while its parameter was frozen at the last refresh, so a lane that
     has scrolled out of the frame can hand back a y of several half frustums and
     drag the pack whole screens above the page on the run into the range.
     motion.js bounds the two lane centres at source; this keeps the 3D layer
     honest on its own and against an older motion.js. The bound is a quarter of a
     screen past either edge, so the pack may still leave the top with its lane
     and is never pulled back down into the copy the lane has left behind. Only
     the map and quote lanes are bounded here: the trade box is the trade zone's
     to fix, and on a restacked narrow layout that band is meant to travel. */
  const capY=v=>Math.max(-1.5,Math.min(1.5,v));
  /* ONE HEIGHT THROUGH THE TRADE LEG (5 Sep, Bazil: "flow all over the place").
     Each knot used to take its own lane's live centre, and those three lanes sit
     at different places on the page, so the pack chased a height that was itself
     sweeping down the screen and then snapped to the next lane. Measured at
     1800x1000 the pack's centre ran 364, 789, 240, 561 within eight per cent of
     scroll: two reversals of over four hundred pixels, which is the bobbing.
     The LANE STILL OWNS X, because that is what keeps the pack out of the copy.
     Only the height is calmed, eased most of the way onto the trade band so the
     pack holds its line and the section travels past it. */
  const HOLD=0.10;                       /* just above the middle of the frame */
  /* The band is a WIDE LAYOUT idea. It holds the pack at one height so the trade
     section travels past it, which needs an empty column beside the copy to hold
     it in. Under 1000 the layout is a single column and there is no such column:
     holding the pack still there just parks it on the copy and lets every line
     scroll through it, which took the phone from 26 content overlaps to 60. On
     narrow the pack keeps riding its lane's own centre and leaves with it. */
  /* 10 Sep: css/site.css collapses every lane at max-width:1000px, which INCLUDES 1000, and
     this file used to call 1000 wide: measured at 1000x700 the pack held its band over a single
     column for the whole trade section (60 overlaps). Wide is strictly over 1000, everywhere. */
  const wide=innerWidth>1000;
  const band=y=>wide?(HOLD+(capY(y)-HOLD)*0.26):capY(y);
  /* yaw plan: the front faces the reader while the pack is parked at a scene;
     the full show-off twist happens in the fast transit across the mark strip */
  return [
    [0.00,        (PH.labelBox?PH.labelBox.x:0.0), (PH.labelBox?PH.labelBox.y:0.10),
                  labelScale(), 0.0],  /* leaves the callout stage exactly where it stood */
    [mk.storyIn,  sb.x, sb.y+0.13, sb.s,      0.12],  /* down the story lane, front out */
    [mk.storyOut, sb.x, sb.y-0.13, sb.s*0.95,-0.16],
    /* The credentials strip runs edge to edge, so no lane clears it on x: the pack
       lets go with the page and sinks under the fold while the red band crosses,
       then rises into the trade lane. Above 1000px the live tradeBox already pulls
       the pack down and this knot is belt and braces. Below 720 it is the whole
       fix: the lane is display:none there, storyBox is null, sb falls back to the
       fixed mid screen box and nothing else takes the pack out of the strip's way.
       Measured at 700x800 without this knot: HACCP 0.93, FSSC 22000 0.69. */
    /* 5 Sep, Bazil: "don't teleport the package, just continue scrolling down". The dive
       under the fold was written for narrow layouts, where the credentials strip runs edge
       to edge and no lane clears it. On a wide screen there IS room: the pack rides across
       the strip in full view and the journey never breaks. Below 1000 the dive stays,
       because there the alternative is the pack sitting on HACCP and ISO 22000. */
    [mk.stripUnder!=null?mk.stripUnder:(mk.storyOut+mk.tradeIn)*0.5,
     sb.x*0.55, (innerWidth<=1000? -1.22 : -0.54), sb.s*(innerWidth<=1000?0.94:0.74), 1.93],   /* 7 Sep: below the strip's marks while it crosses */
    /* 4 Sep: the full show-off turn happens crossing the credentials strip, and the pack lands
       big beside the trade headline before it takes the split's lane */
    [mk.headIn!=null?mk.headIn:(mk.stripUnder!=null?mk.stripUnder:mk.storyOut)+0.02,  hb2.x, hb2.y, hb2.s, 6.28-0.20],
    [mk.headOut!=null?mk.headOut:(mk.stripUnder!=null?mk.stripUnder:mk.storyOut)+0.04, hb2.x, hb2.y, hb2.s, 6.28-0.10],
    /* 10 Sep: the band comment above promised ONE height through the trade leg, but only
       the map and quote knots took it; these two still used the lane's raw centre, so the
       pack snapped in y at the split-to-globe hand-off (measured 541px at 1440, 904 at
       1920, off screen for a whole screen between). The trade knots band too. */
    [mk.tradeIn,  tb.x, band(tb.y), tb.s, 6.06],  /* one full twist crossing the strip, then parks on the frame */
    [mk.tradeOut, tb.x, band(tb.y), tb.s, 6.17],
    /* 4 Sep: on through the section. Beside the globe, then beside the quote, front out. */
    [mk.mapIn!=null?mk.mapIn:mk.tradeOut+0.02,   mb.x, band(mb.y), mb.s, 6.22],
    [mk.mapOut!=null?mk.mapOut:mk.tradeOut+0.04, mb.x, band(mb.y), mb.s, 6.30],
    [mk.quoteIn!=null?mk.quoteIn:mk.tradeOut+0.06,  qb.x, band(qb.y), qb.s, 6.36],
    [mk.quoteOut!=null?mk.quoteOut:mk.tradeOut+0.08,qb.x, band(qb.y), qb.s, 6.20],
    /* 6.28 is a full turn, which is front on. The runway then rested the pack
       at -0.34, so the pack snapped twenty degrees the frame the section took
       over and read as a different pack being swapped in. Land on the rest
       angle itself: 2PI - 0.34. */
    [1.00,        dockX, (PH.dockY||0), dockScale(), 5.94]  /* lands on the specimen slot, at its rest angle */
  ];
}

/* The travel channel is smoothed towards the scroll, so on the frame the
   runway takes over, the pack can still be short of the dock. The runway rig
   is not smoothed, so cutting straight to the mark jumped the pack and read as
   a different pack being swapped in. Capture where it actually is and ease
   from there. Reverse needs nothing: the travel rig is smoothed already. */
/* cubic Hermite through non-uniform knots (the marks), finite-difference tangents:
   passes through every waypoint and keeps moving between them */
function splineAt(W,p,ch){
  const n=W.length; if(n===1) return W[0][ch];
  let k=0; while(k<n-2&&p>W[k+1][0]) k++;
  const p0=W[k][0], p1=W[k+1][0], span=Math.max(1e-4,p1-p0);
  const u=Math.max(0,Math.min(1,(p-p0)/span));
  const vA=W[k][ch], vB=W[k+1][ch];
  const pm=W[Math.max(0,k-1)], pn=W[Math.min(n-1,k+2)];
  const mA=(k>0)?(vB-pm[ch])/Math.max(1e-4,p1-pm[0])*span:(vB-vA);
  const mB=(k<n-2)?(pn[ch]-vA)/Math.max(1e-4,pn[0]-p0)*span:(vB-vA);
  const u2=u*u,u3=u2*u;
  return (2*u3-3*u2+1)*vA+(u3-2*u2+u)*mA+(-2*u3+3*u2)*vB+(u3-u2)*mB;
}
const dockEase={t:1,x:0,y:0,s:1,ry:0,rz:0};
function captureDock(g){
  dockEase.t=0; dockEase.x=g.position.x; dockEase.y=g.position.y;
  dockEase.s=g.scale.x; dockEase.ry=g.rotation.y; dockEase.rz=g.rotation.z;
}
/* shortest way round, so a yaw near a full turn does not unwind backwards */
function angTo(from,to){ const d=to-from; return from+Math.atan2(Math.sin(d),Math.cos(d)); }

let shown=true;
function show(v){ if(shown!==v){ shown=v; holder.style.visibility=v?'visible':'hidden'; } }
let lastMode='';

const clock=new THREE.Clock();
/* WARM THE GPU ONCE AT LOAD. Measured on the pane at DPR 2: the first scroll
   into the range and the cook stalled 100 to 140 ms on shader compiles and
   texture uploads, and a second pass had none. So every material is compiled
   and every texture uploaded before the reader gets there; the hidden packs
   and the bowl are shown to the compiler for one call and hidden again. */
function warmGPU(){
  try{
    const shown=[]; scene.traverse(function(o){ if(o.visible===false){ shown.push(o); o.visible=true; } });
    renderer.compile(scene,cam);
    scene.traverse(function(o){
      if(!o.isMesh) return;
      const ms=Array.isArray(o.material)?o.material:[o.material];
      ms.forEach(function(m){ if(!m) return;
        ['map','alphaMap','roughnessMap','normalMap','bumpMap','emissiveMap','metalnessMap'].forEach(function(k){
          if(m[k]&&m[k].isTexture) renderer.initTexture(m[k]); }); });
    });
    shown.forEach(function(o){ o.visible=false; });
  }catch(e){ console.warn('warm-up skipped',e); }
}
warmGPU();
/* THE WARM RUN. Compiling materials is not enough: the cook's clipped cake,
   the bowl under shadow and the range specimens all reach shader variants
   that only exist once their mode has rendered. So at load the stage runs
   seven frames of the range and the cook with the canvas hidden, then hands
   the real scroll state back with the smoothing reset. Measured: the first
   scroll into the range and the cook stalled 75 to 140 ms without this. */
function warmRun(){
  const real=window.__ph, vis=holder.style.visibility;
  holder.style.visibility='hidden';
  const fake=Object.assign({},real||{},{snap:true});
  window.__ph=fake;
  /* the beats read the SMOOTHED progress (M), which the frame only nudges
     toward the target by 18% a frame: eight faked frames left M.cook at 0.52
     and the pour, the ramen and the clipped cake never rendered, so their
     eight programs still linked on the reader's first scroll (measured:
     createProgram x8 at the slide beat, 100 to 170 ms). M is set directly. */
  function at(state,m){ Object.assign(fake,state); Object.assign(M,m); step(); }
  try{
    for(let i=0;i<5;i++){
      at({heroOn:false,hero:1,labelOn:false,travelOn:false,travel:1,rangeOn:true,range:0.5,idx:i,cookOn:false,cook:0,rangePast:0,cookPast:0},
         {hero:1,travel:1,range:0.5,cook:0});
    }
    /* every beat of the cook: approach, open, tilt, the clipped slide, the
       drop (splash, ripple, crumbs), the pour and the overhead finish */
    [0.05,0.15,0.25,0.36,0.42,0.47,0.52,0.58,0.65,0.75,0.86,0.95].forEach(function(p){
      at({rangeOn:false,range:1,cookOn:true,cook:p},{hero:1,travel:1,range:1,cook:p});
    });
  }catch(e){ console.warn('warm run skipped',e); }
  window.__ph=real; holder.style.visibility=vis; shown=undefined;
  for(const k in M) M[k]=0;
  lastMode=null;
}
function frame(){
  requestAnimationFrame(frame);
  step();
}
function step(){
  const t=clock.getElapsedTime();
  const PH=window.__ph||{};
  T.hero=PH.hero||0; T.travel=PH.travel||0; T.range=PH.range||0; T.cook=PH.cook||0;
  for(const k in T){
    /* 11 Sep: a phone scrolls natively, so the only lag left is this smoothing; at 0.09 the pack
       arrived a full second after the thumb stopped (seen in the recorded walk). Tighter there. */
    const gap=Math.abs(T[k]-M[k]), ph=innerWidth<=760; M[k]+=(T[k]-M[k])*(gap>0.4?(ph?0.32:0.18):(ph?0.17:0.09));
  }
  /* the run between the range bottom and the cook top belongs to no trigger.
     Falling back to 'hero' there put the yellow mini pack back on screen over
     the last range slide, so that stretch is now its own empty mode. */
  /* The travel trigger ends and the runway trigger starts at the same scroll
     position, and on that frame neither reports itself active. The fallback
     used to be the hero, which teleported the pack back to the top of the page
     for a frame: the flash that read as a second, different pack. A finished
     travel holds the travel rig instead, which already rests on the dock. */
  const mode=PH.cookOn?'cook' : PH.rangeOn?'range' : PH.labelOn?'hero' : PH.travelOn?'travel'
           : PH.heroOn?'hero'
           : (T.cook>=0.5?'done' : (T.range>=0.5?'gap'
           : (T.travel>=0.999?'travel':'hero')));
  if(mode!==lastMode){
    if(mode==='range'){ spin.y=-0.34; spin.x=0.04; spin.vy=0; spin.idle=0;
      if((PH.idx||0)===0) captureDock(packMini); else dockEase.t=1; }
    lastMode=mode;
  }
  /* past the cook the bowl does not blink out. The closing frame is held while
     the page scrolls under it, then the dish rides up out of the top the way a
     sticky page element leaves. cookPast is measured by motion.js across one
     screen after the cook section releases. */
  const past=Math.max(0,Math.min(1,PH.cookPast||0));
  const leaving=(mode==='done');
  /* 11 Sep: the warm run steps the cook at p=1 before the reader has scrolled, which left the
     phone's .parked class on the cook stage and its display type showing from the range down.
     Outside the cook the class is cleared. */
  if(innerWidth<=760&&mode!=='cook'&&!leaving){ const stg=window.__cookStage||(window.__cookStage=document.querySelector('#cook .stage')); if(stg&&stg.classList.contains('parked')) stg.classList.remove('parked'); }
  /* 4 Sep: the cook now pours the yellow pack and fades it out at the end. The warm run
     and the 'done' hold leave it at opacity 0, so every other mode restores it first. */
  if(mode!=='cook'&&!leaving&&packMini.userData.dimmed){ setOpacity(packMini,1); packMini.userData.dimmed=false; }
  if(leaving&&past>=0.999){ show(false); return; }
  /* the run between the range and the cook: the docked pack holds its slot and
     rides up with the page, the same way the bowl leaves after the cook */
  const gapping=(mode==='gap');
  const gpast=Math.max(0,Math.min(1,PH.rangePast||0));
  if(gapping&&gpast>=0.999){ show(false); return; }
  show(true);

  /* camera: the travel rig everywhere, the cook rig over the bowl. The cook rig
     is a fixed position, never scrubbed: the dish held one size the whole way
     through the pour instead of swelling as the reader scrolls. The stage is
     blank either side of the cook, so the change of rig is never seen. */
  if(!tspin.drag&&mode!=='travel'){ tspin.y+=tspin.vy; tspin.vy*=0.94; tspin.idle++;
    if(tspin.idle>90){ tspin.y*=0.972; tspin.x*=0.972; } }   /* 7 Sep: the grab unwinds wherever it happened */
  const camIn=(mode==='cook'||leaving)?1:0;
  /* the finish: once the bowl is dressed the camera swings overhead for the
     top view, the way a served bowl is photographed, and holds it while the
     dish leaves. The distance is solved, not set: seen close to plan the dish's
     screen height is DISH_R/(tan(fov/2) * dist) of the frame, so the distance
     that fits the measured clear band falls straight out of that. The old fixed
     6.9/1.15 rig (6.995 along the aim) is the floor and never the answer, so the
     narrow screens that already dolly past it on mf keep their framing exactly. */
  const topv=leaving?1:((mode==='cook')?EZ(ch(M.cook,0.84,0.99)):0);
  const camY=0.1+camIn*(2.0-0.62), camZ=(BASEZ+camIn*0.6)*mf;
  const lookY=0.1+camIn*(-0.5-0.62);
  const topFit=Math.max(1,DISH_R/(2*cookHalf*Math.tan(cam.fov*Math.PI/360)*6.995*mf));
  const TOPY=-0.45+6.9*mf*topFit, TOPZ=1.15*mf*topFit, TOPLOOK=-0.45;
  cam.position.x=0;
  cam.position.y=camY+(TOPY-camY)*topv;
  cam.position.z=camZ+(TOPZ-camZ)*topv;
  cam.lookAt(0,lookY+(TOPLOOK-lookY)*topv,0);
  /* how far the camera actually sits from the dish, for the exit distance */
  const camDist=Math.hypot(cam.position.y-TOPLOOK,cam.position.z);

  if(mode==='hero'){
    const p=M.hero;
    /* the drift into the travel belongs to whichever slot the pack is standing
       in. Reading it off the hero while the pack was docked on the labelling
       stage pushed it a tenth of the frustum off centre, and the labels wait
       for it to be centred, so they never came. */
    /* 4 Sep, Bazil: "don't go to the right and remain the same size": on the callout stage the
       pack holds its place and its size; the travel and the hold take it on from there */
    const tail=(PH.handoff>0.5)?0:EZ(ch(p,0.75,1));
    hideSkus(); bowlGrp.visible=false; cake.visible=false;
    packMini.visible=true;
    if(!hspin.drag){
      hspin.y+=hspin.vy; hspin.vy*=0.94; hspin.idle++;
      if(hspin.idle>200){ hspin.y*=0.985; hspin.x*=0.985; }
    }
    /* the hero is a two column layout: the pack stands in the empty slot in the
       right column, measured live by motion.js, so it sits inside the drawn
       ring on the page instead of floating over the middle of the screen. */
    /* two page slots, one pack: the hero's right column and the labelling
       stage's middle. handoff glides between them as the second scrolls up, so
       the pack is never cut from one place to the other. On the labelling stage
       it settles square to the reader, because the dots on the page are placed
       against the artwork and a turned pack would slide out from under them. */
    const hb=PH.heroBox||{x:0.46,y:-0.02};
    const lb=PH.labelBox;
    const hand=lb?Math.max(0,Math.min(1,PH.handoff||0)):0;
    const mix=(a,b)=>a+(b-a)*hand;
    /* x waits: the yellow facts band crosses while the pack is still in its hero column, so the
       facts are never covered; the slide to the stage centre happens over the second half */
    const handX=lb?Math.max(0,Math.min(1,((PH.handoff||0)-0.52)/0.48)):0;
    const mixX=(a,b)=>a+(b-a)*EZ(handX);
    const spinOff=1-hand;                       /* the drag pad is the hero's */
    packMini.rotation.z=-0.05*spinOff;
    packMini.rotation.x=(0.05+hspin.x)*spinOff;
    packMini.rotation.y=(-0.34+Math.sin(t*0.5)*0.06+hspin.y+tspin.y)*spinOff;
    packMini.scale.setScalar(mix(heroScale(),labelScale())*(1-tail*0.18));
    packMini.position.x=mixX(fx(hb.x),fx(lb?lb.x:0))+tail*fx(0.10);
    packMini.position.y=mix(fy(hb.y),fy(lb?lb.y:0))+Math.sin(t*1.1)*0.025*spinOff+tail*fy(0.12);
    /* 10 Sep, NARROW: THE PACK STAYS IN ITS SLOT. At 1000 and under the hero is one column,
       copy, slot, facts, and the callout stage stacks the same way, so the two slots sit one
       above the other with the fact rows between them. Mixing the two live centres by the
       hand-off progress drew the pack straight through those rows: measured at 1000x700 it
       covered "50 Years", "30 Countries", "202m" and "5000+" on the way. Same rule as the
       trade leg: the pack rides the hero slot at the page's speed until that slot has left
       the top, then rides the label slot up from the fold. labelLead (motion.js) is how far
       the label slot is already inside the frame at that moment; the pack starts that much
       lower and closes the gap by the time the slot is near the middle. */
    let crossU=0;
    if(innerWidth<=1000&&lb&&hb.px&&lb.px){
      const pbx=window.__packBox;
      const halfN=((pbx&&pbx.h>8)?pbx.h:lb.px.h)/innerHeight;   /* NDC half height, one frame stale */
      /* 12 Sep, Bazil: "don't just appear, come from the top scrolling". ONE expression for the
         whole stacked hand-off, because the two branches below it were a hard switch: the pack
         rode the hero slot until that slot's bottom was 0.37 of a frame above the top edge, then
         cut to the label slot at mid frame. Measured at 768x1024 that was an 1100px jump between
         two stops, which is exactly the "appears" he is pointing at.
         It rides the hero slot while the slot is on screen, HOLDS at the top edge once the slot
         has gone past it, and from there travels DOWN into the label slot as that slot climbs.
         u is zero until the label slot's centre reaches the fold, so the hold is real and the
         descent starts where the reader can see it. Continuous at both ends by construction. */
      const EDGE=1+halfN+0.06;
      const held=Math.min(hb.y,EDGE);
      /* the descent's window, in the label slot's own NDC. labelLead gave a window about four
         tenths of a frame wide, so the pack covered 1.58 NDC of travel in 0.4 of a screen: a
         459px step between two stops at 768x1024, which reads as a drop rather than a descent.
         A full frame and three quarters puts it at about nine tenths of the page's own speed. */
      const uIn=EZ(ch(lb.y,-1.9,-0.15));
      crossU=uIn;
      packMini.position.y=fy(held+(lb.y-held)*uIn)+(uIn<0.001?(Math.sin(t*1.1)*0.025*spinOff+tail*fy(0.12)):0);
    }
    /* THE CROSSING. On its way from the hero slot to the anatomy slot the pack passes over the
       hero's own proof rows, and a solid pack sitting on "50 years of noodle experience" is the
       fault the 10 Sep audit measured (it came back at 1024x768, where the two slots stack but
       the layout is still the wide one: cov 0.49 on the lede). It reads as DEPTH instead: while
       it is travelling and still over the cream it is small and far back, and it comes forward
       to full size and full strength as it crosses into the red. Never below 0.16, so it is
       always a thing travelling rather than a thing that blinked out, and never dimmed at rest
       in the hero, because the gate is the hand-off's own progress. */
    if(PH.labelSecTop!=null&&lb){
      const kY=fy(1)||1;
      const pyNow=packMini.position.y/kY;
      const halfNow=((window.__packBox&&window.__packBox.h>8)?window.__packBox.h:(lb.px?lb.px.h:innerHeight*0.3))/innerHeight;
      const inRed=EZ(ch(PH.labelSecTop-pyNow,-halfNow*0.7,halfNow*1.1));
      /* the recede SATURATES as soon as the pack leaves its slot, rather than ramping with the
         whole hand-off: at 1024x768 a linear ramp still had it at 0.62 halfway across, solid
         enough to swallow "1980, halal certified". By a third of the way it is as far back as
         it goes, and inRed is the only thing that brings it forward again. */
      const moving=EZ(ch((innerWidth<=1000)?crossU:hand,0.05,0.30));
      const near=1-0.88*moving*(1-inRed);
      setOpacity(packMini,near); packMini.userData.dimmed=near<0.999;
      packMini.scale.multiplyScalar(1-0.20*moving*(1-inRed));
    }
    packMini.position.z=0;
    /* the anatomy: once parked, the runway turns the pack and moves in on its features */
    labelM+=((PH.label||0)-labelM)*0.12;
    const A=anatPlan(labelM);
    packMini.rotation.y+=A.yaw*hand+tspin.y*hand;   /* 7 Sep: the grab works on the callouts stage too */
    /* 10 Sep: the zoom and the lift move in on a feature while the stage is pinned beside its
       callouts. Stacked, the slot scrolls away with the page and the beats sit right under it,
       so the lift put the pack's foot on beat 4 (cov 0.34 at 800x900). The turn stays. */
    const az=innerWidth<=1000?0:hand;
    packMini.scale.multiplyScalar(1+(A.zoom-1)*az);
    packMini.position.y+=A.lift*az*fy(1);
    /* only while the labelling stage is anywhere near: this walks the geometry */
    if(hand>0.02){ publishPackBox(packMini); publishHotspots(packMini); }
    /* no ground shadow: the page draws the ring the pack stands in */
    shA.material.opacity=0;
    if(catcher) catcher.visible=false;
  }
  else if(mode==='travel'){
    const p=M.travel;
    hideSkus(); bowlGrp.visible=false; cake.visible=false;
    packMini.visible=true;
    /* NARROW: THE PACK DOES NOT RIDE OVER THE COPY (5 Sep).
       The travelling pack needs an empty column beside the text to ride in, and
       under 1000 the layout is a single column: there is no such thing. Measured
       settled at 390x844 the pack crossed 57 separate pieces of copy on the way
       down, covering HACCP, ISO 22000 and United Kingdom outright. An earlier
       reading of 26 was my own instrument lagging, not the page being better.
       So on narrow the pack sinks away over the first part of the leg and comes
       back up for the range, which has a real slot of its own. It leaves as a
       move the reader can follow rather than blinking out: opacity and height
       go together, and it is only skipped once it is genuinely invisible.
       Wide layouts are untouched and keep the full ride. */
    let stick=null, stickW=0;   /* 10 Sep: on wide frames the trade leg's height is the lane's, see below */
    let narrowY=null, narrowDock=false;   /* 10 Sep: stacked frames, see below */
    if(innerWidth<=1000){
      /* 10 Sep, measured at 1000x700 with the smoothing settled: the pack left the top with
         the callout slot, then the flight plan's first leg drew it back DOWN into the frame
         while it faded (over "1 family recipe"), and at the far end it faded in at mid
         frame on top of the certificates, the quote and the CTA before the range had
         arrived. Stacked, the pack has two homes on this leg and nothing in between: it
         stays above the frame while it fades, and it comes back riding the specimen slot
         itself up from the fold, solid, at the page's speed, the way every other stacked
         hand-off now works. */
      /* 11 Sep, Bazil: "I want the packaging through here" (the board, on a phone). The phone
         board carries the same right lane the desktop one does now, so the pack RIDES IT the
         whole way down and only leaves when the credentials strip arrives. Above 760 the board
         has no lane and the old behaviour stands: away early, back at the dock. */
      const phoneRide=innerWidth<=760;
      const mkN=PH.marks||{};
      const rideEnd=phoneRide?(mkN.storyOut!=null?mkN.storyOut:0.42):0.02;
      const away=EZ(ch(p,rideEnd,rideEnd+0.07));   /* gone before the strip's first mark */
      const dl=PH.dockLive;
      const pbx=window.__packBox;
      const halfN=((pbx&&pbx.h>8)?pbx.h:innerHeight*0.3)/innerHeight;
      narrowDock=!!(dl&&p>0.5&&dl.y>-1-halfN);   /* the slot is entering from below */
      const riding=phoneRide&&!narrowDock&&p<rideEnd+0.07;
      const showN=narrowDock?1:Math.max(0,1-away);
      if(showN<=0.02){
        /* clear the published box on the way out: an early return that skips the
           publish leaves the LAST box standing, and anything measuring it then
           compares a ghost against live content. That is the same trap the
           hero-only publish set, so it is closed here too. */
        packMini.visible=false; window.__packBox=null; renderer.render(scene,cam); return;
      }
      setOpacity(packMini,showN);
      /* riding: the flight plan's own lane y, see travelWaypoints; else above the frame, or on the slot */
      narrowY=narrowDock?fy(dl.y):(riding?null:fy(1.6));
    } else {
      /* 10 Sep, ONE RULE FOR THE WIDE TRADE LEG: THE PACK STAYS INSIDE THE LANE THAT OWNS IT.
         Three generations of doors, bands and glides lived here, each written for a layout
         the section no longer has. Measured settled at 1440 the pack still reversed 104px
         against the scroll at the head-to-trade knot, sat on the QC bench photograph (cov
         1.00) because tradeOut was read off a split that has no lane any more, then left
         the top at three times the page's speed. This is position:sticky, done by hand:
         the lane's top edge carries the pack up from below the fold at the page's own
         speed, it holds at the dock's height while the lane is around it, and the lane's
         bottom edge pushes it out through the top, again at the page's speed. It is never
         outside its lane, so nothing beside or after the lane can be under it, and there
         is no reversal because every term is monotonic in the scroll. The map lane is not
         allowed to push it out (8 Sep, Bazil: "let it continue, the map travels up under
         it, and the quote arrives under it"): from the map lane on it holds at the dock's
         height, which is where the range then finds it. The hand-off between lanes is at
         mk.mapIn, measured by motion.js as the first scroll where the head lane has left
         the frame; mapLead delays the entry so it always starts from the fold. */
      const mk=PH.marks||{};
      const hb=PH.headBox, mb=PH.mapBox;
      if(hb&&hb.t!=null&&mk.headIn!=null&&p>=mk.headIn){
        const holdY=fy(PH.dockY||0);
        /* the pack's half height in world units, from last frame's published box (one
           frame stale, smooth); the model's own box before the first publish */
        const pb=window.__packBox;
        let half=pb&&pb.h>8 ? (pb.h/holder.clientHeight)*fy(1) : 0;
        if(!half){
          if(!packMini.userData.halfH){ const bb=new THREE.Box3().setFromObject(packMini); packMini.userData.halfH=(bb.max.y-bb.min.y)/2/Math.max(1e-3,packMini.scale.y); }
          half=packMini.userData.halfH*packMini.scale.y;
        }
        half*=1.04;   /* a little air under the caption that follows */
        if(mk.mapIn!=null&&p>=mk.mapIn&&mb&&mb.t!=null){
          stick=Math.min(fy(mb.t-(PH.mapLead||0))-half, holdY);
        } else {
          stick=Math.max(Math.min(fy(hb.t)-half, holdY), fy(hb.b)+half);
        }
        /* eased in over a sliver of the leg from the strip dive, whose knot sits within a
           few px of the lane's first value anyway */
        stickW=EZ(ch(p,mk.headIn,mk.headIn+0.015));
      }
    }
    /* 4 Sep: one continuous curve through every mark. Easing each leg to a
       stop at its mark made the pack dart from slot to slot and settle, which is
       the "teleport" Bazil saw; a Catmull-Rom through the same marks glides past
       them, and the smoothing mirror above is the only ease left. */
    const W=travelWaypoints();
    const L=i=>splineAt(W,p,i);
    packMini.position.x=fx(L(1));
    /* same float as the runway rig, so the hand-off does not jump phase */
    packMini.position.y=fy(L(2))+Math.sin(t*0.85)*0.02;
    if(stick!=null&&stickW>0){ packMini.position.y+=(stick-fy(L(2)))*stickW; }
    if(narrowY!=null) packMini.position.y=Math.max(narrowY,narrowDock?narrowY:fy(L(2)));   /* never below the plan while leaving, never off the slot while arriving */
    packMini.position.z=0;
    if(!tspin.drag){ tspin.y+=tspin.vy; tspin.vy*=0.94; tspin.idle++;
      if(tspin.idle>90){ tspin.y*=0.972; tspin.x*=0.972; } }   /* unwinds back to the plan */
    packMini.rotation.y=L(4)+Math.sin(t*0.6)*0.03+tspin.y;
    /* the travelling roll settles onto the runway's -0.04 over the last leg */
    const landZ=EZ(ch(p,0.90,1));
    packMini.rotation.z=Math.sin(p*6.5)*0.09*(1-landZ)+(-0.04)*landZ;
    packMini.rotation.x=0.04+tspin.x;
    packMini.scale.setScalar(L(3));
    if(narrowDock){ packMini.position.x=fx((PH.dockX!=null)?PH.dockX:0.46); packMini.scale.setScalar(dockScale()*(packMini.userData.fit||1)); }   /* 10 Sep: on the slot, at the slot's size, after the plan has had its say */
    shA.material.opacity=0;
    if(catcher) catcher.visible=false;
  }
  else if(mode==='range'||gapping){
    const p=gapping?1:M.range;
    /* 11 Sep: the rail's progress is remapped on phones so the fifth SKU lands inside the pinned
       stage; the EXIT fade still keys off the section's raw progress, or the pack disappeared for
       the last fifth of the section. */
    const pRaw=(PH.rangeRaw!=null)?PH.rangeRaw:p;
    const out=gapping?0:EZ(ch(pRaw,0.96,1));
    bowlGrp.visible=false; cake.visible=false;
    /* 4 Sep: THE RAIL. The five specimens used to swap visibility on a slide
       index, which cut from one pack to the next in the dock: five of the hard
       cuts Bazil called teleporting. They sit on one rail now, spaced along x,
       and the rail slides through the dock as the runway scrolls, so the next
       pack arrives from the right while the last leaves to the left, turning
       away as it goes. r is the rail position in pack units; the nearest pack
       is the one the copy, dots and drag belong to. */
    const packs=[packMini].concat(skuPacks);
    const n=packs.length, r=Math.max(0,Math.min(n-1,p*(n-1)));
    const near=Math.round(r);
    if(!spin.drag){
      spin.y+=spin.vy; spin.vy*=0.94;
      spin.idle++;
      if(spin.idle>90&&Math.abs(spin.vy)<0.0015){
        const target=-0.34+Math.sin(t*0.32)*0.15;
        let d=target-spin.y;
        d=Math.atan2(Math.sin(d),Math.cos(d));
        spin.y+=d*0.035;
      }
      spin.x+=(0.04-spin.x)*0.03;
    }
    const land=EZ(ch(p,0,0.05));
    /* one screen of scroll-rate lift once the runway releases, so the specimen
       exits with the section instead of being switched off under the reader */
    const glift=gapping?gpast*1.15*2*Math.tan(cam.fov*Math.PI/360)*cam.position.z:0;
    const dockX=fx((PH.dockX!=null)?PH.dockX:0.46);
    /* 4 Sep, second cut: the rail is VERTICAL and the packs stay solid. A sideways
       rail sent the leaving pack across the copy column as a translucent ghost;
       here it rises off the top of its own column while the next comes up from
       below, turning as it passes, and nothing is ever see-through. */
    const RAILY=fy(innerWidth<=1000?2.6:1.7);   /* 8 Sep: on a narrow frame the copy sits above the dock, so the neighbour parks a whole frame away, out of sight */
    /* 10 Sep, STACKED FRAMES RUN THE RAIL SIDEWAYS. Parking the neighbour a frame away up the
       page kept it out of sight at rest, but every change of specimen still drove the leaving
       pack UP THROUGH THE COPY that sits above the dock there: measured at 800x900 the pack
       covered "Penang White Curry" 0.65 and its line 0.78 halfway through each swap. The 4 Sep
       objection to a sideways rail was the copy COLUMN beside the dock on a wide frame; stacked,
       the copy is above, the sides are empty, so the leaving pack goes out to the left and the
       next comes in from the right, at the dock's own height. Two half-frames clears it whole. */
    const sideRail=innerWidth<=1000, RAILX=fx(2.0);
    /* 12 Sep, void scan: the seam between the range and the cook was a DEAD FRAME on a phone.
       The range had released its pack above the top, the cook had not started, and the screen
       carried nothing but the headline: 630px of empty cream. The bowl now arrives across that
       seam, so the scene is already forming when the cook takes over (the cook's own rise picks
       up from bowlPre rather than starting again from below). */
    if(gapping){   /* 12 Sep: the whole stacked band has the same seam */   /* 12 Sep, second pass: and so does the desktop. The void scan found the identical dead frame at 1440, 396px of empty cream under "3 minutes to sedap" while the range had let go and the cook had not taken hold. The seam carries the bowl at every width now. */
      bowlPre=EZ(ch(gpast,0.08,0.78));
      bowlGrp.visible=true;
      ramenGrp.visible=false;   /* it arrives EMPTY: the pour is the cook's job, not the seam's */
      bowlGrp.position.x=0; bowlGrp.position.z=0;
      bowlGrp.position.y=BOWL_Y-(1-bowlPre)*4.2;
      syncRamenClips();
    } else if(!gapping) bowlPre=0;
    const ds=dockScale();
    const e=(dockEase.t<1)?EZ(dockEase.t):1, inv=1-e;
    packs.forEach((g,i)=>{
      const d=i-r, ad=Math.abs(d);
      const a=(ad<1.15?1:0)*(1-out);
      g.visible=a>0.004;
      if(!g.visible) return;
      setOpacity(g,a);           /* the cook shares these groups, so reset every frame */
      /* 11 Sep: the side rail HOLDS the pack centred for most of its unit and swaps over the last
         four tenths, so a phone frame is not watching a pack slide the whole time */
      const dd=sideRail?(Math.abs(d)<0.3?0:Math.sign(d)*(Math.abs(d)-0.3)/0.4):d;
      g.position.x=dockX+(sideRail?dd*RAILX:0);
      g.position.y=fy(PH.dockY||0)+Math.sin(t*0.85)*0.02+glift-(sideRail?0:d*RAILY);
      g.position.z=-ad*0.35;
      g.scale.setScalar(ds*(g.userData.fit||1)*(1-0.08*Math.min(1,ad)));
      g.rotation.y=spin.y+d*0.55;
      g.rotation.x=spin.x;
      g.rotation.z=-0.04;
      /* the mini pack arrives off the travel curve: ease from where it actually
         was into its rail slot over a few frames, the way the dock always did */
      if(i===0&&e<1){
        g.position.x=dockEase.x*inv+g.position.x*e;
        g.position.y=dockEase.y*inv+g.position.y*e;
        g.scale.setScalar(dockEase.s*inv+g.scale.x*e);
        g.rotation.y=dockEase.ry+(angTo(dockEase.ry,g.rotation.y)-dockEase.ry)*e;
        g.rotation.z=dockEase.rz*inv+g.rotation.z*e;
      }
    });
    if(dockEase.t<1) dockEase.t=Math.min(1,dockEase.t+0.10);
    shA.material.opacity=0.75*land*(1-out)*(1-gpast)*e*Math.max(0,1-Math.abs(near-r)*1.6);
    shA.position.x=dockX;
    if(catcher){ catcher.visible=false; }   /* 5 Sep: no ground shadow anywhere, blob or cast */
  }
  else if(mode==='cook'||leaving){
    /* the leaving frame is the cook at its end, held still and lifted */
    const p=leaving?1:M.cook;
    /* 10 Sep: the entry takes 0.26 of the pin, not 0.20. Measured at 1440 the pack's centre
       came down at twice the page's speed over the first fifth; the extra room and the lower
       start (inY, below) bring its peak to about the page's own speed. The pour follows on. */
    /* 11 Sep, phones: a 3.3 screen pin made the entry 0.86 screens long, most of it an empty cream
       frame between the range and the first bowl. The pack and the bowl arrive in the first 0.4. */
    const phoneT=innerWidth<=760;
    /* 11 Sep: at 0.12 the mid-entry frame was a typeless cream screen with the pack at the top and
       the bowl at the foot, a third of a screen apart. The two meet in 0.08 now and the display
       type arrives with them (the .parked flag below), so there is no empty in-between. */
    const enter=EZ(ch(p,0.00,phoneT?0.08:0.26));   /* carries on down from the range lane */
    let rise =EZ(ch(p,phoneT?0.005:0.04,phoneT?0.08:0.26));   /* the BOWL is what travels: up to the pack */
    rise=Math.max(rise,bowlPre);   /* it may already be most of the way up, see the gap branch */
    const tilt =EZ(ch(p,phoneT?0.16:0.27,phoneT?0.30:0.40));   /* the pack tips where it stands */
    const slide=EZ(ch(p,0.39,0.54));   /* cake out, drops in */
    const cookc=EZ(ch(p,0.56,0.80));   /* broth, ramen, steam */
    const leave=EZ(ch(p,0.54,0.74));   /* 8 Sep, Bazil: the empty pack leaves by the top of the frame, the way it came in, not by fading */
    /* the pack that cooks is the one the range ended on, the last SKU on the
       runway. The journey reads as one object: the yellow pack travels down the
       page, becomes the range, and the final specimen is what pours the bowl. */
    const CK=cookPack();
    skuPacks.forEach(function(g){ g.visible=(g===CK); });
    packMini.visible=(CK===packMini);
    /* the pack is not a new object here: it carries on down the same lane it
       left the range on, entering from above the frame with the scroll and
       settling on its pour mark. From there it holds, and the bowl rising to
       meet it plus the pour are the only movement. */
    const inX=fx((PH.dockX!=null)?PH.dockX:0.46);
    /* 10 Sep: the cook used to begin at y 6.1, five and a half half-frustums above the
       frame, and closed that in a fifth of the pin: measured 560 to 665px per quarter
       screen, a whoosh. The range's last specimen has just left through the top with its
       section (the gap lift), so the pack comes back down from just above the frame,
       0.6 of a screen of scroll for a screen's height, and its size eases from the dock's. */
    const inY=fy(1.36);   /* the cook camera sees 1.6x the travel camera's scale: 1.36 puts the pack's top edge a few px above the frame at the dock's size */
    const dsc=dockScale();
    /* 10 Sep: at 800 the tipped pack's box is 585px wide against a 295px display type; four
       fifths of the size and the 0.40 mark keep the tip inside the frame and off the type */
    const stackedCook=innerWidth<=860, phoneCook=innerWidth<=760;
    /* 10 Sep, phones: the display type sits centred under the bar, so the pack parks under it,
       centred, at just over half size; the bowl still rises to meet it */
    { const fit=(CK.userData.fit||1)*(phoneCook?0.9:(stackedCook?0.8:1)); CK.scale.setScalar(fit*(dsc+(1-dsc)*enter)); }
    /* phones: the display type sits under the bar, in the pack's way in; it shows once the pack has parked */
    if(phoneCook){ const stg=document.querySelector('#cook .stage'); if(stg) stg.classList.toggle('parked',enter>0.5); }
    /* 10 Sep: at 800 the pack is 460px wide and the display type 295, and 0.50 put the pack's
       right edge past the frame while its left still crossed "3 minutes" on the way down. 0.35
       fits both, and stacked the pack starts the descent already at its mark: the slide from
       the dock's centre used to happen inside the type's row. */
    /* 11 Sep, Bazil: "package should be more to the right to successfully put noodles inside" */
    const parkX=phoneCook?fx(0.42):(stackedCook?fx(0.40):(innerWidth<=1000?fx(0.50):(innerWidth<1500?Math.max(1.62,fx(0.48)):1.62)));
    const parkY=phoneCook?0.34:0.6;   /* 12 Sep, Bazil: the pack pours from higher above the bowl */   /* 8 Sep: on smaller frames the pour mark moves right, clear of the headline */
    const inX0=stackedCook?parkX:inX;
    CK.position.set(inX0+(parkX-inX0)*enter, inY+(parkY-inY)*enter+(6.1-parkY)*leave, 0);   /* 7 Sep: 2.02 put half the pouring pack above the frame; 0.6 brings its top to the bar */
    CK.rotation.z=-0.06+tilt*(Math.PI*0.55);
    CK.rotation.y=-0.22+Math.sin(t*0.5)*0.05+tspin.y;   /* the reader's spin rides the pour too */
    CK.rotation.x=0;
    /* no fade-in: it arrives from off the top of the frame, so it is simply
       there, solid, the way it left the runway. Only the empty pack fades. */
    const packA=1;
    CK.visible=leave<0.995;
    setOpacity(CK,packA); CK.userData.dimmed=packA<0.999;
    const fin=CK.userData.finT;
    /* 8 Sep: an opening seal was tried (folded back as the pack tips); it read as a strip
       floating off the bag. Bazil: "close it back". The seal stays shut through the pour. */
    if(fin){ fin.rotation.x=0; fin.position.y=CK.userData.finHome; }
    if(catcher) catcher.visible=false;   /* 5 Sep: no ground shadow anywhere */
    /* the bowl rises with the scene rather than popping into the fixed stage */
    bowlGrp.visible=true;
    /* the dish holds for the first third of the leave, then clears the top of
       the frame over the rest, its floor shadow travelling with it */
    const lift=leaving?Math.max(0,(past-0.12)/0.88)*1.15*2*Math.tan(cam.fov*Math.PI/360)*camDist:0;
    /* screen-up is world +Y from the side and world -Z from overhead, so the
       exit follows whichever view the camera is in. By the time the dish
       leaves the camera is overhead, so it slides off the top of the frame. */
    bowlGrp.position.y=BOWL_Y-(1-rise)*4.2+lift*(1-topv);
    bowlGrp.position.z=-lift*topv;
    syncRamenClips();          /* the cut travels with the dish, see RAMEN_REST */
    if(catcher){ catcher.position.y=-2.34+BOWL_DY+lift*(1-topv); catcher.position.z=-lift*topv; }
    shA.material.opacity=0;

    /* cake: emerges from the pack mouth, then ballistic drop into the bowl */
    cake.visible=slide>0.001&&cookc<0.999;
    if(cake.visible){
      const outc=Math.min(slide/0.45,1), drop=EZ(ch(slide,0.45,1));
      const mx=CK.position.x-Math.sin(CK.rotation.z)*1.9;
      const my=CK.position.y+Math.cos(CK.rotation.z)*1.9;
      const bx=0, by=-0.55+BOWL_DY;   /* the cake lands in the mouth wherever the dish stands */
      const ex=CK.position.x+(mx-CK.position.x)*outc;
      const ey=CK.position.y+(my-CK.position.y)*outc;
      cake.position.x=ex+(bx-ex)*drop;
      cake.position.y=ey+(by-ey)*drop - Math.sin(drop*Math.PI)*-0.6;
      cake.position.z=-1.7*(1-drop);   /* 8 Sep, Bazil: "put the noodle at the back of the package": the cake leaves BEHIND the bag, hidden by it until it clears the mouth, then drops forward into the bowl */
      cake.rotation.z=(1-drop)*(CK.rotation.z+Math.PI/2);
      cake.rotation.x=drop*0.15;
      const sink=cookc;
      cake.position.y-=sink*0.13;
      cake.scale.set(1.25*(1+sink*0.16),1.3*Math.max(0.18,1-sink*0.82),1.25*(1+sink*0.16));   /* 1.45 overhung the bowl's rim on landing */   /* 8 Sep, Bazil: "the noodle not that small" */
      setOpacity(cake,1-sink*0.92);
    }
    /* splash on entry */
    const sp=ch(slide,0.9,1)*(1-ch(cookc,0,0.25));
    splash.material.opacity=Math.sin(Math.min(sp,1)*Math.PI)*0.55;
    splash.scale.setScalar(0.4+sp*1.6);

    broth.material.opacity=Math.min(1,slide*0.4+cookc*1);
    broth.scale.setScalar(0.72+cookc*0.28);
    strandGrp.visible=false;
    garnishGrp.visible=false;
    ramenGrp.visible=cookc>0.02;
    if(ramenGrp.visible){
      const g=Math.max(0.001,Math.min(1,cookc*1.2));
      ramenGrp.scale.set(1,g,1);
      ramenGrp.rotation.y=-0.35+t*0.06;
    }
    steam.forEach((s,i)=>{
      const u=s.userData;
      const life=(t*0.20*u.rate+u.ph)%1;
      const drift=Math.sin(t*0.55*u.sway+i)*0.20*life;
      const r=u.rad*(1-life*0.25);
      s.position.set(Math.cos(u.ang)*r+drift, BROTH_Y+0.04+life*1.75, Math.sin(u.ang)*r);
      const g=0.55+life*1.75;
      s.scale.set(g,g*1.4,1);
      s.material.opacity=cookc*0.42*Math.sin(life*Math.PI);
    });
  }
  /* THE PACK'S SCREEN BOX, EVERY FRAME (5 Sep). It used to be published only
     from the hero/label branch, so window.__packBox stayed frozen at the hero
     position for the whole rest of the page: any overlap check against it was
     measuring a ghost. Publishing the visible pack here makes the pack's real
     footprint measurable in every mode, which is what the lane work needs. */
  (function(){
    /* THE BOX MUST BE THE PACK THE READER IS LOOKING AT. On the range rail up to
       three specimens are visible at once, and because g.position.y is set from
       d = i - r above, a LOWER index is always HIGHER on the rail. Taking the
       first visible one therefore always measured the pack leaving off the top,
       never the docked specimen: _proof/overlap-baseline.md reads 54% as y -48
       and calls the range half off the screen, while the specimen the copy, the
       dots and the drag all belong to was sitting near +600, in frame. Publish
       the visible pack nearest the middle of the frame instead. Every other mode
       has exactly one pack visible (hero and travel both call hideSkus, the cook
       shows only cookPack), so it is the same pack it always was there. */
    /* 12 Sep: the pick was "nearest the middle by HEIGHT", which was right when the range rail
       ran vertically. Under 1000 the rail runs SIDEWAYS, so the neighbours differ in x, not y,
       and this chose a pack parked a whole frame off to the left: measured at 800, the published
       box sat at x -988 for a full screen of scroll while the pack the reader was looking at sat
       at 588. Everything that reads the box (this audit, the drag pad, the hero tag) followed the
       wrong one. Distance from the middle of the frame, both axes. */
    let vis=null, best=1e9;
    if(packMini.visible){ vis=packMini; best=Math.hypot(packMini.position.x,packMini.position.y); }
    for(const g of skuPacks){
      if(!g.visible) continue;
      const d=Math.hypot(g.position.x,g.position.y);
      if(d<best){ best=d; vis=g; }
    }
    if(vis){ vis.updateMatrixWorld(true); publishPackBox(vis); window.__packScale=vis.scale.x;
      /* 12 Sep: the box is the box whatever the pack's strength, so an audit reading it counted a
         0.12 ghost crossing the hero's figures as a collision. The strength is published with it. */
      let _a=1; vis.traverse(o=>{ if(o.material&&o.material.opacity!=null&&o.material.transparent) _a=Math.min(_a,o.material.opacity); });
      window.__packAlpha=_a;
    }
    else { window.__packBox=null; window.__packAlpha=0; }
    /* THE BOWL IS MEASURABLE TOO (10 Sep). Through the pour the pack has gone and
       the bowl IS the section, but a density probe reading the DOM cannot see
       anything drawn on the canvas: the cook read as an empty yellow field when
       it was in fact carrying the whole dish. Publishing the bowl's screen box
       the same way the pack's is published lets the audit count what is really
       on screen instead of guessing. Costs one box projection a frame. */
    if(bowlGrp.visible){
      bowlGrp.updateMatrixWorld(true);
      const keep=window.__packBox; publishPackBox(bowlGrp);
      window.__bowlBox=window.__packBox; window.__packBox=keep;
    } else window.__bowlBox=null;
    /* the grab area follows the pack wherever the flight plan puts it */
    placePackHit(!!vis&&mode!=='range');   /* 7 Sep, Bazil: why can't I touch and turn it. Everywhere but the dock, which has its own pad. */   /* 7 Sep, Bazil: always able to grab and spin it */   /* 7 Sep: in the range the dock's own .specHit turns the pack; the travel layer over it ate the drag */
  })();
  renderer.render(scene,cam);
}
warmRun();
window.__warmRun=warmRun;   /* a handle for measuring it on the pane */
/* MEASUREMENT HOOK (5 Sep). The pack's screen box is only refreshed inside the
   rAF loop, and a hidden or backgrounded pane pauses rAF entirely — which made
   every live overlap reading a stale ghost. This runs one frame synchronously
   and hands back the fresh box, so the layout can be measured whatever the
   pane is doing. Rendering-only: it changes no state the scroll does not. */
window.__packFrame=function(){ try{ step(); }catch(e){ return {error:String(e).slice(0,120)}; } return window.__packBox; };
await __breath();
frame();
/* THE STAGE IS LIVE. frame() is requestAnimationFrame(frame) followed by a
   synchronous step(), so by the time it returns the pack has rendered once.
   The loading plate waits on this, and on nothing else from 3D: it carries its
   own 2.6s cap, so a stage that never arrives only makes the plate leave on
   time. Purely a signal, it changes no state the scroll does not. */
try{ document.dispatchEvent(new CustomEvent('vits:3dready')); }catch(e){}
}
