/* ============================================================
   DOM motion: Lenis, nav, marquees, reveals, parallax planes,
   the section steppers, and the scroll channels the 3D stage
   reads from window.__ph. Content stays visible if any of this
   fails: nothing is pre-hidden outside a proven-live trigger.
   ============================================================ */
(function(){
  'use strict';
  /* pinned-scroll page: the browser must not restore deep scroll before triggers measure */
  if('scrollRestoration' in history){ try{ history.scrollRestoration='manual'; }catch(e){} }

  var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* the channels the 3D layer reads */
  window.__ph={heroOn:false,hero:0,travelOn:false,travel:0,rangeOn:false,range:0,
               cookOn:false,cook:0,idx:0,cookPast:0,rangePast:0,marks:null,dockX:0.46,dockBox:null,heroBox:null,labelBox:null,labelOn:false,label:0,handoff:0,
               storyBox:null,tradeBox:null};

  /* Lenis buttery scroll, wheel-only, native touch */
  (function(){
    if(!window.Lenis||RM) return;
    var lenis=new Lenis({lerp:0.11,smoothWheel:true,wheelMultiplier:1.6});
    document.documentElement.style.scrollBehavior='auto';
    if(window.gsap){
      if(window.ScrollTrigger) lenis.on('scroll',ScrollTrigger.update);
      gsap.ticker.add(function(t){lenis.raf(t*1000);});
      gsap.ticker.lagSmoothing(0);
    } else {
      requestAnimationFrame(function raf(t){ lenis.raf(t); requestAnimationFrame(raf); });
    }
    document.addEventListener('click',function(e){
      var a=e.target.closest&&e.target.closest('a[href^="#"]'); if(!a) return;
      var id=a.getAttribute('href'); if(!id||id==='#') return;
      var el=document.querySelector(id); if(!el) return;
      e.preventDefault(); lenis.scrollTo(el,{offset:-90});
      try{ history.pushState(null,'',id); }catch(_){}
    });
    window.__lenis=lenis;
  })();

  /* nav solidifies; the admin bar wraps taller on narrow screens, so measure it */
  var nav=document.getElementById('siteNav');
  /* hide the bar on the way down, bring it back on the way up. Exposed so the
     ScrollTrigger below can drive it too: Lenis owns the scroll, and native
     scroll events are not a reliable feed under it. */
  var navLastY=scrollY;
  /* 9 Sep, Bazil: "when scrolling the navigation bar is still there". The site nav has
     always ridden away on the way down, but the workspace bar above it is 82px of fixed
     demo chrome that never moved: a tenth of a 844px phone, gone for the whole read. It
     travels with the nav now, and comes back with it the moment you scroll up. Phones
     only: on a desktop the bar is the workspace furniture and stays put. */
  var wsBar=document.querySelector('.bmws');
  function updateNav(y,dir){
    nav.classList.toggle('solid',y>40);
    var away=(dir>0&&y>260);
    if(away) nav.classList.add('hide');
    else if(dir<0) nav.classList.remove('hide');
    if(wsBar&&innerWidth<=1000) wsBar.classList.toggle('away',away&&y>260);
  }
  addEventListener('scroll',function(){
    var y=scrollY, dy=y-navLastY;
    if(Math.abs(dy)<5) return;
    updateNav(y,dy>0?1:-1); navLastY=y;
  },{passive:true});
  /* ============ THE PHONE JOURNEY ============
     9 Sep, Bazil: "the packaging must have the same journey like the one in the website".
     Below 720px pack3d.js never boots, so the pack was five separate pictures sitting in
     five separate slots. #mPack is the flat twin of the #stage3d canvas: ONE pack, fixed,
     that stays on screen from the hero to the pour and moves between its stations as you
     scroll, which is what the 3D one does (measured on a desktop: over the first 1680px of
     scroll the pack itself moves 95px, so it is very nearly held and drifting).
     The route is in VIEWPORT space, not page space, for exactly that reason: a page anchor
     would scroll away with its section and the pack would leave the screen between stations.
     It only reveals itself once it is running (body.mpack), and the in-flow posters only
     hide behind that same flag, so a phone that never runs this keeps the pictures it had. */
  (function(){
    var layer=document.getElementById('mPack'); if(!layer||RM) return;
    var img=layer.querySelector('img'); if(!img) return;
    /* MEASUREMENT HOOK (10 Sep). The route renders inside rAF, and a hidden or
       backgrounded pane pauses rAF outright, so an audit reading #mPack there saw
       display:none and opacity 0 for the whole page: nothing was wrong, nothing had
       drawn. This runs one frame synchronously. frame() is a declaration in this
       scope, so it is hoisted and callable from here. */
    window.__mpFrame=function(t){ try{ frame(t!=null?t:performance.now()); }catch(e){ return {error:String(e).slice(0,120)}; } return true; };   /* t: the audit advances its own clock, the lerps here are time based */

    /* THE ROUTE, rebuilt 9 Sep after Bazil asked for premium and I went and measured what
       premium actually does. Apple's AirPods page on a phone: 14 sticky sections, 16 videos,
       zero canvases, and almost nothing transforms while you scroll. A section pins at top 0,
       HOLDS for about a thousand pixels while a paused video scrubs from 0 to 4.9s on scroll
       position alone, then releases. The object holds still and the content around it changes.
       One thing moving at a time.
       The first version of this route did the opposite: the pack wandered the viewport, x
       going 0.90 to 0.10 to 0.90, which reads as busy rather than expensive. So now it HOLDS,
       centred, at each station that matters, moves once between them, and gets out of the way
       entirely where the page itself is the story. o is opacity: on the heritage board and
       through the trade section the pack steps out, because that wall of photographs is the
       content there and a pack floating over it is decoration. */
    /* 9 Sep, Bazil: "pushed to the right and be smaller". The layer's own width is the
       hero column now (see --packCol in the stylesheet), so the hero station needs no
       scale of its own: the pack IS the right hand column. Every station AFTER the hero
       had its scale multiplied by 1.56, which is the exact inverse of the width cut
       (293px to 188px on a 375 screen), so the callouts, the SKU rail and the pour show
       the same size of pack they were tuned to. Shrinking the hero must not shrink the
       journey. */
    var ST=[
      {t0:0.00, sel:'.packSlot',   s:1.00, o:1},
      {t0:0.11, sel:'.packSlot',   tsel:'.heroShow', tedge:'bottom', tat:0.55, s:1.00, o:1},   /* hold: the hero */
      /* the way out of the hero. Measured after the two column hero landed: the hold
         itself was clean, but the leg to the callouts drifted the pack back to the
         middle of the screen exactly while the lede, the seal, the fact rows and the
         proof numbers were scrolling through that middle, so it crossed all four of
         them (35,930px2 on the lede alone). A crossing has to happen SOMEWHERE, so it
         happens above the words instead of through them: the pack rises into the top
         right corner, holds the right hand column it has held all along, and only takes
         the centre once the callout slot is the thing on screen. mid:0.45 places it
         between its measured neighbours, so it stays in step at any copy length. */
      /* 10 Sep, Bazil: "dead space". The parked pack was full size in the top right, so
         the whole right lane under it had to stay empty all the way down the hero. It
         parks SMALL now (0.55) hard against the right edge and below the nav row, which
         frees the lane for the seal, and fast:0.2 brings it there in the first fifth of
         the leg so the seal never scrolls up under a pack that is still big. */
      {t0:0.14, wp:1, fast:0.2, tsel:'.anatRun', tedge:'top', tat:0.06, x:0.885, y:0.23, s:0.50, o:1},
      {t0:0.17, sel:'.anatSlot',   tsel:'.anatRun', tedge:'top', tat:-0.02, s:1.16, o:1},
      {t0:0.27, sel:'.anatSlot',   s:1.16, o:1},   /* hold: the callouts read the pack */
      /* 9 Sep, Bazil: "why is it at the top and behind". The out station parked the pack
         in the MIDDLE of the screen (y 0.42) to fade there, so on the way out it sat at
         half strength directly on the callout copy and then on the story lede: measured
         2,586px2 of type under a ghost. A pack that is leaving leaves through the top,
         which is what the 3D pack does on desktop. It fades as it rises, so by the time
         it is faint it is already above the fold. */
      {t0:0.33, t:0.33, x:0.50, y:-0.32,   s:1.09, o:0},
      /* 10 Sep: the second out station used to sit above the frame too, so the leg to the rail
         brought the pack DOWN through the whole frame, over "The Mini Pack" (cov 0.55 at 390),
         to reach a slot that was still at the fold. It waits below the fold instead and rises
         with the slot, which is what the 3D pack does on every stacked frame now. */
      {t0:0.63, t:0.63, x:0.50, y:1.30,    s:1.09, o:0},   /* out: the board and the trade are the story */
      {t0:0.71, sel:'.specStage',  s:1.15, o:1},
      /* the hold has to cover the WHOLE rail, all five SKUs. Timed off .specStage's own
         box it ended early and the fifth card, Mi Goreng Carbonara, was the one SKU on the
         page with no pack on it: the pack had already set off for the pour. Anchored to
         the section instead, which is what the rail actually runs on. */
      {t0:0.83, sel:'.specStage', tsel:'#range', tedge:'bottom', tat:0.62, s:1.15, o:1},   /* hold: it becomes each SKU */
      {t0:0.88, sel:'.cookPoster', s:1.37, o:1},
      {t0:0.96, sel:'.cookPoster', s:1.37, o:1},   /* hold: the pour */
      {t0:1.00, t:1.00, x:0.50, y:-0.34,   s:1.37, o:1}    /* and it leaves through the top, as the 3D one does */
    ];
    var A=null, B=null, W=0, H=0, pw=0, raf=null, live=false, HOME=img.getAttribute('src');
    var SKU_IN=0, SKU_OUT=1;   /* the stretch of the route on which the pack wears each SKU */

    function measure(){
      var hero=document.getElementById('hero'), cook=document.getElementById('cook');
      if(!hero||!cook) return false;
      A=hero.getBoundingClientRect().top+scrollY;
      B=cook.getBoundingClientRect().top+scrollY+cook.offsetHeight;
      W=innerWidth; H=innerHeight;
      /* the pack is the hero's right hand column, not a poster laid over the page.
         Matches --packCol in the stylesheet: 50% under 400px, 56% above it. */
      pw=Math.min(224, W*(W<=380?0.46:0.50)); layer.style.width=pw+'px';
      if(!(B>A)) return false;
      /* 9 Sep: the station times are MEASURED, never guessed. A pair of stations sharing a
         selector is that box's hold, and it should last exactly as long as the box is on
         screen: it opens when the box's top reaches the bottom of the viewport and closes
         when its bottom passes the top. Guessed fractions had the callouts hold sitting
         beside its box rather than on it, so the pack was absent for the whole scene. */
      var span=B-A, i, prev=null;
      for(i=0;i<ST.length;i++){
        var st=ST[i];
        /* tsel is the explicit anchor: this station happens when tsel's top (or bottom)
           reaches tat of the way down the screen. 9 Sep, and the reason it exists: the
           generic rule below times a station off the box the pack SITS in, and .anatSlot
           lives inside a pinned stage, so its unpinned rect put the arrival a screen and
           a half early. The pack then set off toward a target that was still below the
           fold and dived to the bottom of the screen to chase it, which is the jump Bazil
           kept calling a teleport. Anchoring the arrival to the RUNWAY reaching the top of
           the screen (which is the moment the stage pins) is the same measurement the
           scene itself uses, so the pack and the scene agree. */
        if(st.tsel){
          var te=document.querySelector(st.tsel);
          if(te){ var tr=te.getBoundingClientRect();
            var edge=(st.tedge==='bottom'?tr.bottom:tr.top)+scrollY;
            st.t=Math.max(0,Math.min(1,((edge-H*(st.tat!=null?st.tat:0))-A)/span));
            prev=st.sel||prev; continue; }
        }
        if(!st.sel){ st.t=st.t0; continue; }
        var el=document.querySelector(st.sel);
        if(!el){ st.t=st.t0; continue; }
        var r=el.getBoundingClientRect(), top=r.top+scrollY, bot=top+r.height;
        var isFirst=(prev!==st.sel);
        st.t=Math.max(0,Math.min(1,((isFirst? top-H*0.92 : bot-H*0.08)-A)/span));
        prev=st.sel;
      }
      /* a mid station is placed as a share of the gap its measured neighbours leave,
         so a waypoint cannot drift out of order when the copy above it changes length */
      for(i=1;i<ST.length-1;i++) if(ST[i].mid!=null&&ST[i].tsel==null){
        var pa=ST[i-1].t, nb=null, j;
        for(j=i+1;j<ST.length;j++) if(ST[j].mid==null){ nb=ST[j].t; break; }
        if(nb!=null&&nb>pa) ST[i].t=pa+(nb-pa)*ST[i].mid;
      }
      /* the out stations sit in whatever gap the measured holds leave */
      for(i=1;i<ST.length-1;i++) if(ST[i].t<ST[i-1].t) ST[i].t=ST[i-1].t;
      /* the SKU reskin window, by name: it opens as the pack sets off for the rail and
         closes when the pour takes over */
      var iSpec=-1,iCook=-1;
      for(i=0;i<ST.length;i++){
        if(iSpec<0&&ST[i].sel==='.specStage') iSpec=i;
        if(iCook<0&&ST[i].sel==='.cookPoster') iCook=i;
      }
      SKU_IN =(iSpec>0)?ST[iSpec-1].t:0;
      SKU_OUT=(iCook>=0)?ST[iCook].t:1;
      return true;
    }
    /* the hand off curve. A station pair is a HOLD (both ends the same place) or a MOVE, and
       a move waits, then goes, then settles: nothing drifts for the whole length of a leg,
       which is the difference between a considered hand off and a wander. */
    function ease(t){ return t<0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }
    /* THE LANE, 9 Sep, after Bazil: "still not parallax". He was right and the measurement
       said so plainly: the pack was travelling 0.93px per pixel of scroll. Tracking a box's
       centre exactly IS moving at page speed, so the pack was glued to the page and merely
       teleporting between anchors, which on screen is an ordinary inline picture.
       So the pack is now pulled toward the centre of the SCREEN, which makes it travel
       slower than the page, and that pull is clamped to the slack left inside its own box.
       It reads as a plane at a different depth, and it still cannot reach the copy above or
       below its box, which is the part the clamp I removed on 9 Sep got wrong: that one was
       unbounded and put body text under the pack. Bounded by the box, both things are true. */
    var LANE=0.62;
    function target(st,ph){
      if(st.sel){
        var el=document.querySelector(st.sel);
        if(el){ var r=el.getBoundingClientRect();
          /* ox nudges a station off its box centre, as a fraction of the box width: the range
             card carries its copy beside the picture, so the pack sits to the outside of it */
          if(r.width>0){
            var cy=r.top+r.height/2;
            var slack=Math.max(0,(r.height-(ph||0))*0.5);
            if(slack>6){
              var off=-(cy-H*0.5)*LANE;
              if(off>slack) off=slack; else if(off<-slack) off=-slack;
              cy+=off;
            }
            return [r.left+r.width*(0.5+(st.ox||0)), cy];
          } }
      }
      return [(st.x!=null?st.x:0.5)*W, (st.y!=null?st.y:0.5)*H];
    }
    /* 9 Sep, Bazil: "the parallax not smooth and like the web". Correct, and the reason is
       structural. On desktop every scroll driven value runs through ScrollTrigger's scrub,
       which is an inertial ease: the value CHASES the scroll over about a second, so the
       pack always glides. This module did neither of the two things that makes that work.
       It read raw scrollY, so it snapped straight to the scroll position with no easing at
       all, and it asked for exactly one frame per scroll EVENT, so between events there was
       no frame in which anything could ease even if it wanted to. On a phone, where Lenis
       leaves touch scrolling native and scroll events arrive in irregular bursts, that is
       the whole difference between gliding and stepping.
       So the rendered position is smoothed with the same exponential ease a scrub uses, and
       the loop keeps running under its own power until it has settled. TAU is the time
       constant in seconds: desktop scrub is 1.1, which on a 390px screen reads as lag, so
       this sits nearer the 0.55 the phone's parallax planes already use. */
    /* MAXLAG is the safety rail on the ease. A smoothed value trails the target in
       proportion to scroll SPEED, and a hard flick on a phone is very fast: measured
       with the ease unbounded, copy sitting under the pack went from 3 overlaps to 38,
       one of them total, because the pack was still crossing a paragraph it should
       already have left. The ease may lag, but never by more than this, so the glide
       survives at reading speed and the pack can still never be parked on the words. */
    var TAU=0.30, MAXLAG=70, scx=null, scy=null, ssc=null, sop=null, lastT=0;
    function frame(now){
      raf=null;
      /* 9 Sep: caught on a 1280 desktop tab that had lost its WebGL context. body.mpack
         hides the in-flow posters, and it was only being cleared here when the route had
         already gone live, so a page that started narrow (or started this module and then
         widened) could sit at desktop width with mpack on, no canvas, and therefore NO
         PACK ANYWHERE. The flag belongs to the route, so it comes off whenever the route
         is not the thing driving, live or not. */
      if(!narrow()){ live=false; layer.style.opacity='0';
        document.body.classList.remove('mpack'); lastT=0; return; }
      if(!document.body.classList.contains('mpack')) document.body.classList.add('mpack');
      if(A===null&&!measure()) return;
      var p=(scrollY-A)/(B-A);
      if(p<-0.03||p>1.08){ if(live){ live=false; layer.style.opacity='0'; } lastT=0; return; }
      var waking=!live; if(!live){ live=true; }
      p=Math.max(0,Math.min(1,p));
      var i=1; while(i<ST.length-1 && ST[i].t<p) i++;
      var a=ST[i-1], b=ST[i], sp=b.t-a.t;
      var tr=sp<=0?0:Math.max(0,Math.min(1,(p-a.t)/sp));
      if(b.fast) tr=Math.min(1,tr/b.fast);   /* a fast leg finishes its move in the first b.fast of its length, then holds */
      var t=ease(tr);
      /* leg readout, for measuring this route instead of guessing at it */
      window.__ph.mSt={i:i,from:a.sel||('xy '+a.x+','+a.y),to:b.sel||('xy '+b.x+','+b.y),
                       p:+p.toFixed(3),at:+ST[i-1].t.toFixed(3),bt:+ST[i].t.toFixed(3),t:+t.toFixed(3)};
      /* on the range rail the pack IS the SKU being read, exactly as the 3D pack reskins
         itself there: without this the mini pack floats over the Penang and Bayam cards. */
      /* 9 Sep: this window used to be written as ST[5] to ST[8], and inserting the corner
         waypoint shifted every index after it, so the pack stopped reskinning part way
         along the SKU rail and showed the classic yellow pack under a "Mi Kering Tomato"
         headline. Found by walking the frames, not by the audit, which does not know what
         a pack is meant to look like. The window is read by NAME now, so a future station
         can be inserted anywhere without silently unpicking this. */
      var sku=document.querySelector('.specStage img.fallback.act');
      var want=(sku&&p>SKU_IN&&p<SKU_OUT)?(sku.currentSrc||sku.src):HOME;
      if(want&&img.getAttribute('src')!==want) img.setAttribute('src',want);
      var ph=pw*(img.naturalHeight&&img.naturalWidth ? img.naturalHeight/img.naturalWidth : 1);
      var ta=target(a,ph), tb=target(b,ph);
      var cx=ta[0]+(tb[0]-ta[0])*t, cy=ta[1]+(tb[1]-ta[1])*t, s=a.s+(b.s-a.s)*t;
      /* the corner leg, and ONLY the corner leg, keeps its top edge on screen. The hero
         slot is flying up out of the page while this leg runs, so interpolating from it
         to the corner sent the path 7px above the top and back down again: a bounce, on
         the one journey Bazil asked to be continuous. This is not the viewport clamp the
         note above rejects (that one held the pack over the copy for whole sections); it
         is a floor on a single hand off, and it cannot pull the pack down onto anything
         because it only ever raises cy. The exits are untouched, so the pack still leaves
         through the top when it is meant to. */
      if(a.wp||b.wp){ var top0=ph*0.5+100; if(cy<top0) cy=top0; }   /* 100: under the logo row when it is showing */
      /* 9 Sep: NO viewport clamp. Holding the pack at a fixed spot on screen sounds like
         the sticky sections Apple uses, but theirs works because the WHOLE section is stuck,
         so the copy holds with the product. Clamping only the pack here left the copy free to
         scroll underneath it, and body text went back to 92 per cent covered. The pack sits in
         its box and leaves with its box: the sections take turns, which is the same grammar,
         and the page is never wearing the pack over its words. */
      var oa=(a.o==null?1:a.o), ob=(b.o==null?1:b.o), o=oa+(ob-oa)*t;
      /* a leg between two DIFFERENT anchors is a journey across the page, and on a phone
         the copy runs full width, so there is nothing to travel past except the words. The
         pack recedes while it crosses and comes back to full weight when it arrives. Holds
         are untouched: both ends share a selector there, so the dip never fires on one. */
      /* the dip says "this is a journey" on a leg that crosses the page. The rise into
         the corner is not that leg: it is the hero pack holding its own column while the
         words go by, so dipping it there just made the product look like it was failing
         to load. No dip on a leg that starts or ends at a waypoint. */
      if(a.sel!==b.sel && !a.wp && !b.wp) o*=1-0.42*Math.sin(Math.PI*t);
      /* 9 Sep, Bazil: "why is it at the top and behind" and "its invisible cant even see
         it". A leg that ENDS at zero was fading linearly across the whole crossing, so the
         pack spent that leg parked at half strength on top of the story copy: too faint to
         read as a product, solid enough to grey out the words under it. A pack that is
         leaving should leave. The fade now finishes in the first quarter of the leg,
         and the arrival half of a leg that comes back from zero is treated the same way,
         so the pack is either present or gone, never a ghost over type. */
      if(a.sel!==b.sel){
        if((b.o!=null?b.o:1)===0 && oa>0) o=oa*Math.max(0,1-t/0.16);
        else if(oa===0 && (b.o!=null?b.o:1)>0) o=ob*Math.max(0,(t-0.84)/0.16);
      }

      /* the ease. Framerate independent, so a 120Hz phone and a 60Hz one settle over the
         same amount of TIME rather than the same number of frames. */
      var nowMs=(typeof now==='number')?now:(window.performance?performance.now():0);
      var dt=lastT?Math.min(0.05,(nowMs-lastT)/1000):0.016; lastT=nowMs;
      if(scx===null||waking){ scx=cx; scy=cy; ssc=s; sop=o; }
      else { var k=1-Math.exp(-dt/TAU);
             scx+=(cx-scx)*k; scy+=(cy-scy)*k; ssc+=(s-ssc)*k; sop+=(o-sop)*k;
             if(scy-cy>MAXLAG) scy=cy+MAXLAG; else if(cy-scy>MAXLAG) scy=cy-MAXLAG;
             if(scx-cx>MAXLAG) scx=cx+MAXLAG; else if(cx-scx>MAXLAG) scx=cx-MAXLAG; }

      layer.style.transform='translate3d('+(scx-pw/2).toFixed(1)+'px,'+(scy-ph/2).toFixed(1)+'px,0) scale('+ssc.toFixed(3)+')';
      layer.style.opacity=sop.toFixed(3);

      /* keep going under our own power while there is still distance to close: this is the
         half of the fix that a scroll listener alone can never provide. */
      if(Math.abs(cx-scx)>0.15||Math.abs(cy-scy)>0.15||Math.abs(s-ssc)>0.0015||Math.abs(o-sop)>0.004){
        if(!raf) raf=requestAnimationFrame(frame);
      } else { lastT=0; }
    }
    function tick(){ if(!raf) raf=requestAnimationFrame(frame); }

    /* 9 Sep: no3d alone is NOT the test. body.no3d is also set when WebGL fails for any
       reason, and a desktop that loses its context would then run this route, which is tuned
       to a 390px column: stations sized for a phone, spread across a 1440px screen. Caught it
       happening in a headless run where the GPU gave out. The width is the real gate. */
    function narrow(){ return innerWidth<=760; }
    /* 10 Sep, later: one journey at every width now (the 3D layer boots on phones too), so
       nothing needs a reload when a frame crosses 760; ScrollTrigger's refresh re-measures. */
    function start(){
      if(!document.body.classList.contains('no3d')||!narrow()) return;
      if(!measure()) return;
      /* 10 Sep: the poster is hidden by the FIRST FRAME THAT DRAWS THE LAYER (the mpack
         add at the top of frame()), not here. Seen in the preview pane with rAF frozen:
         this add ran, the poster went, the layer never drew, and the hero had no pack at
         all. Until the layer has painted once, the in-flow poster is the pack. */
      layer.style.opacity='0';
      addEventListener('scroll',tick,{passive:true});
      addEventListener('resize',function(){ measure(); tick(); });
      /* 9 Sep, Bazil: "i told u not to make it teleport". Reproduced: the layer only
         repaints on a scroll event and on its own rAF chain, and rAF is FROZEN while the
         tab is backgrounded or the preview pane is hidden. Scroll while it is frozen and
         the layer keeps the transform it had, so the pack is left parked wherever it was,
         which on the way back is off screen entirely, and the next scroll walks it in from
         nowhere. That is the teleport, and it is not the route: it is the wake.
         So every wake re-measures and RESEATS the smoothing (scx=null makes the next frame
         snap to the true target instead of easing toward it from a stale one), and the same
         goes for a bfcache restore. Cheap: it fires on wake, not per frame. */
      var wake=function(){ if(document.hidden) return; measure(); scx=scy=ssc=sop=null; lastT=0; tick(); };
      document.addEventListener('visibilitychange',wake);
      addEventListener('pageshow',wake);
      addEventListener('focus',wake);
      if(window.ScrollTrigger) ScrollTrigger.addEventListener('refresh',function(){ measure(); tick(); });
      tick();
    }
    if(document.body.classList.contains('no3d')&&narrow()) start();
    else document.addEventListener('vits:3dfail',start);
  })();

  function fitBar(){ var b=document.querySelector('.bmws'); if(!b) return;
    document.documentElement.style.setProperty('--barh',b.offsetHeight+'px'); }
  fitBar(); addEventListener('resize',fitBar); addEventListener('load',fitBar);

  /* BrandMethod ribbon: the animated fabric signature, ported VERBATIM from the
     IAQ build (Footer.jsx initRibbon). Blue cloth, Inter glyphs riding the wave,
     highlight and shadow hems, draped tails. Reduced motion = one frame. */
  (function(){
    var cv=document.getElementById('demoRibbon'); if(!cv) return;
    var ctx; try{ ctx=cv.getContext('2d'); }catch(e){}
    var fb=document.getElementById('demoRibbonFb');
    if(!ctx){ cv.style.display='none'; if(fb) fb.hidden=false; return; }
    var W=460,H=110,dpr=Math.min(devicePixelRatio||1,2);
    cv.width=W*dpr; cv.height=H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
    var X0=40,X1=420,BH=32,BY=40;
    var running=false,looping=false,t=0;
    var SEGS=[
      {t:'DEMO BY',f:'600 12px Inter,sans-serif',sp:3.6,a:1,dy:0,gap:8},
      {star:true,w:13,gap:9},
      {t:'BRAND',f:'600 12px Inter,sans-serif',sp:3.6,a:0.98,dy:0},
      {t:'METHOD.CO',f:'600 12px Inter,sans-serif',sp:3.6,a:0.98,dy:0}
    ];
    var GLYPHS=null;
    function buildGlyphs(){
      GLYPHS=[];
      SEGS.forEach(function(sg){
        if(sg.star){ GLYPHS.push({star:true,w:sg.w}); if(sg.gap) GLYPHS.push({gap:sg.gap}); return; }
        if(!sg.t){ if(sg.gap) GLYPHS.push({gap:sg.gap}); return; }
        ctx.font=sg.f;
        for(var i=0;i<sg.t.length;i++){
          var chr=sg.t[i];
          if(chr===' '){ GLYPHS.push({gap:6.5}); continue; }
          GLYPHS.push({ch:chr,f:sg.f,a:sg.a,dy:sg.dy||0,w:ctx.measureText(chr).width+sg.sp});
        }
        if(sg.gap) GLYPHS.push({gap:sg.gap});
      });
    }
    function wave(x,tt){return 4.0*Math.sin(x*0.0135+tt*0.0011)+2.4*Math.sin(x*0.029-tt*0.00068)+1.2*Math.sin(x*0.055+tt*0.0016);}
    function slope(x,tt){return (wave(x+2,tt)-wave(x-2,tt))/4;}
    function lerp(a,b,pp){return a+(b-a)*pp;}
    function shade(pp){return 'rgb('+Math.round(lerp(18,86,pp))+','+Math.round(lerp(28,116,pp))+','+Math.round(lerp(158,255,pp))+')';}
    function tail(xEdge,dir,tt){
      var y=BY+wave(xEdge,tt)*0.7+9;
      var x2=xEdge-dir*40;
      ctx.beginPath();
      ctx.moveTo(xEdge,y); ctx.lineTo(x2,y+7); ctx.lineTo(x2+dir*13,y+7+BH/2);
      ctx.lineTo(x2,y+7+BH); ctx.lineTo(xEdge,y+BH); ctx.closePath();
      ctx.fillStyle='#101C96'; ctx.fill();
      ctx.fillStyle='rgba(0,0,0,.22)'; ctx.fill();
    }
    function draw(tt){
      if(!GLYPHS) buildGlyphs();
      ctx.clearRect(0,0,W,H);
      tail(X0+6,1,tt); tail(X1-6,-1,tt);
      var x,y,sl;
      for(x=X0;x<=X1;x+=2){
        y=BY+wave(x,tt); sl=slope(x,tt);
        var pp=Math.max(0,Math.min(1,0.52+sl*5.5+0.14*Math.sin(x*0.006-tt*0.00042)));
        ctx.fillStyle=shade(pp);
        ctx.fillRect(x-1,y,2.4,BH);
      }
      ctx.beginPath();
      for(x=X0;x<=X1;x+=4){ y=BY+wave(x,tt); x===X0?ctx.moveTo(x,y+0.6):ctx.lineTo(x,y+0.6); }
      ctx.strokeStyle='rgba(255,255,255,.28)'; ctx.lineWidth=1.1; ctx.stroke();
      ctx.beginPath();
      for(x=X0;x<=X1;x+=4){ y=BY+wave(x,tt)+BH; x===X0?ctx.moveTo(x,y-0.6):ctx.lineTo(x,y-0.6); }
      ctx.strokeStyle='rgba(0,10,60,.4)'; ctx.lineWidth=1.2; ctx.stroke();
      ctx.textAlign='left'; ctx.textBaseline='middle';
      var total=0; GLYPHS.forEach(function(g){ total+=g.w||g.gap||0; });
      var xs=(X0+X1)/2-total/2;
      GLYPHS.forEach(function(g){
        if(g.gap){ xs+=g.gap; return; }
        var cxx=xs+(g.w||0)/2;
        var yy=BY+wave(cxx,tt)+BH/2+0.5, an=Math.atan(slope(cxx,tt));
        ctx.save(); ctx.translate(cxx,yy); ctx.rotate(an);
        if(g.star){
          ctx.strokeStyle='rgba(255,255,255,.97)'; ctx.lineWidth=1.5; ctx.lineCap='round';
          for(var sp2=0;sp2<4;sp2++){
            var a2=sp2*Math.PI/4;
            ctx.beginPath(); ctx.moveTo(-Math.cos(a2)*4.6,-Math.sin(a2)*4.6); ctx.lineTo(Math.cos(a2)*4.6,Math.sin(a2)*4.6); ctx.stroke();
          }
        } else {
          ctx.font=g.f;
          ctx.fillStyle='rgba(2,8,40,.4)'; ctx.fillText(g.ch,-((g.w||0)/2)+0.7,(g.dy||0)+1.1);
          ctx.fillStyle='rgba(255,255,255,'+g.a+')'; ctx.fillText(g.ch,-((g.w||0)/2),g.dy||0);
        }
        ctx.restore();
        xs+=g.w||0;
      });
    }
    function frame(){ if(!running){ looping=false; return; } looping=true; t+=16; draw(t); requestAnimationFrame(frame); }
    draw(0);
    if(document.fonts&&document.fonts.ready) document.fonts.ready.then(function(){ GLYPHS=null; draw(t); });
    if(!RM){
      if(window.IntersectionObserver){
        new IntersectionObserver(function(es){ es.forEach(function(en){
          running=en.isIntersecting; if(running&&!looping) requestAnimationFrame(frame);
        });}).observe(cv);
      } else { running=true; requestAnimationFrame(frame); }
      document.addEventListener('visibilitychange',function(){
        if(document.hidden){ running=false; }
        else{ var r=cv.getBoundingClientRect();
          if(r.top<innerHeight&&r.bottom>0){ running=true; if(!looping) requestAnimationFrame(frame); } }
      });
    }
  })();


  /* the mobile menu. Under 760px every link is display:none with no way to
     open them, so the phone had no navigation at all. */
  (function(){
    var burger=document.getElementById('navBurger');
    if(!burger) return;
    function setOpen(v){
      document.body.classList.toggle('navOpen',v);
      burger.setAttribute('aria-expanded',v?'true':'false');
      burger.setAttribute('aria-label',v?'Close menu':'Open menu');
      /* Lenis keeps running under a fixed sheet, so stop it while open */
      if(window.__lenis){ v?window.__lenis.stop():window.__lenis.start(); }
    }
    burger.addEventListener('click',function(){
      setOpen(!document.body.classList.contains('navOpen'));
    });
    document.querySelectorAll('#navLinks a').forEach(function(a){
      a.addEventListener('click',function(){ setOpen(false); });
    });
    addEventListener('keydown',function(e){
      if(e.key==='Escape'&&document.body.classList.contains('navOpen')) setOpen(false);
    });
    addEventListener('resize',function(){
      if(innerWidth>760&&document.body.classList.contains('navOpen')) setOpen(false);
    });
  })();

  /* the hero headline is CMS copy set as a slab: every line is sized to span the
     copy column exactly, so three lines of different word lengths read as one
     block whatever the CMS puts in them. */
  function fitHero(){
    var wrap=document.querySelector('.heroTitle');
    var lines=wrap?[].slice.call(wrap.querySelectorAll('.l')):[];
    if(!lines.length) return;
    var col=wrap.parentElement.getBoundingClientRect().width;
    if(!col) return;
    /* narrow layouts let the lines wrap, and a fitted size would fight that */
    if(getComputedStyle(lines[0]).whiteSpace!=='nowrap'){
      lines.forEach(function(l){ l.style.fontSize=''; });
      return;
    }
    lines.forEach(function(l){
      l.style.fontSize='';
      var base=parseFloat(getComputedStyle(l).fontSize);
      var w=l.getBoundingClientRect().width;   /* the line is width:max-content */
      /* 7 Sep, Bazil: the hero lands in one shot. The fit is also capped by the
         viewport's height, so three lines never push the pack under the fold. */
      if(w>0) l.style.fontSize=Math.min(base*col/w,base*1.9,innerHeight*0.112)+'px';   /* 7 Sep: bigger, the pack rises into the title's right */
    });
  }
  fitHero();
  addEventListener('resize',fitHero);
  document.addEventListener('vits:content',fitHero);
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(fitHero);

  /* marquees loop by translating a track of two identical rows, so clone each row */
  document.querySelectorAll('.markTrack,.fmTrack').forEach(function(track){
    var row=track.firstElementChild; if(!row) return;
    var copy=row.cloneNode(true);
    copy.setAttribute('aria-hidden','true');
    track.appendChild(copy);
  });

  if(RM||!window.gsap||!window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  /* 9 Sep, Bazil: "make vits scrollable in the mobile view". The stages stay pinned on a
     phone (the unpin block in the sheet is reduced motion only, never a width query), and
     iOS fires a resize every time the URL bar collapses. That re-measured every pin mid
     scroll, which is the lurch that reads as the page fighting the thumb. ScrollTrigger
     only honours this flag when it detects touch, so the desktop build is untouched. */
  ScrollTrigger.config({ignoreMobileResize:true});
  var coarse=matchMedia('(pointer:coarse)').matches;
  /* 9 Sep: live on a phone for the first time now that the parallax below runs on touch.
     Touch scroll stays native and unlerped, so the scrub tail is the only smoothing in the
     chain; 0.9s of it read as the layer trailing the thumb rather than moving with it. */
  var SCRUB=coarse?0.55:1.1;

  /* 9 Sep, Bazil: the flat understudy. Below 720px pack3d.js never boots (its own gate),
     so the scroll channels window.__ph.hero, .label, .range and .cook were written every
     frame and read by nobody, while the stages still pinned. That is why a phone scrolled
     four screens of cook and two of range past a poster that never moved. flat() drives
     the poster the phone shows from the same progress the 3D pack would have used, so the
     journey survives without WebGL. It is transform only, so it stays on the compositor.
     The hero and callout packs are NOT driven here: they are [data-plx] planes, because a
     phase driven nudge inside a scene reads as nothing next to a plane that travels the
     whole section. One owner per transform either way. */
  function flatOn(){ return document.body.classList.contains('no3d'); }
  function flat(el,t){ if(el&&flatOn()) el.style.transform=t; }

  /* the reliable feed: ScrollTrigger ticks off Lenis, so the bar tracks the
     scroll even where native scroll events do not arrive */
  ScrollTrigger.create({start:0,end:'max',
    onUpdate:function(self){ updateNav(self.scroll(),self.direction); }});

  /* scroll progress hairline */
  gsap.to('#pgBar i',{scaleX:1,ease:'none',immediateRender:false,
    scrollTrigger:{trigger:document.body,start:'top top',end:'bottom bottom',scrub:0.3,invalidateOnRefresh:true}});

  /* continuous parallax: tagged planes drift at their own rate.
     9 Sep, Bazil: "with all the parallax effect". This ran on desktop only, so every touch
     device got a page with no depth in it at all: six planes, all static. It runs everywhere
     now. Two things are deliberate. The amplitude is scaled on a phone, because a phone
     stacks these blocks tall (the markets row becomes one column) and the same yPercent
     walks far more pixels there, which at full strength shoves copy into its neighbour. And
     a plane may opt out with data-plx-m="0": the enquiry form does, since a form that drifts
     under the thumb while you are typing into it is worse than no parallax at all. */
  (function(){
    var narrow=innerWidth<=760, phone=(coarse||narrow), amp=phone?0.55:1;
    /* 12 Sep, Bazil on an iPad: "no parallax". Two separate causes, both here.
       One: the opt-outs. data-plx-m is a PHONE compensation, written because a 390px column
       has no room beside its copy, and four of the fourteen planes carry m="0": the hero
       poster, the label poster, the story heading and its lede. A real iPad reports
       pointer:coarse, so phone was true and those four were switched off outright.
       Two: the unit. A tablet frame scrolls further per section than a phone, so the same
       26px per unit reads as less depth, and several planes were under the ~40px the eye
       needs to see a plane move at all (measured at 768x1024: the proof rail 15px, the
       lede 13px).
       761 to 1000 is its own band now: no opt-outs, its own unit, and the same clamp, so
       nothing may travel further than the room it has to its section's edges. It is
       width-based, so a browser at 768 and an iPad at 768 behave identically. */
    /* the band is the LAYOUT's (761 to 1000, where the page is stacked but not a phone); the
       opt-outs and the clamp additionally follow the POINTER, so an iPad in landscape at 1024
       is not handed the desktop treatment: without this its enquiry form drifted 240px under
       the thumb while you typed into it, which is the exact thing data-plx-m="0" was written
       to prevent, and the two no-3D poster fallbacks were flung 1300px. */
    var tab=!narrow&&innerWidth<=1000, touchWide=coarse&&!narrow, soft=tab||touchWide;
    /* 9 Sep: measured on a 390px phone, every plane drifted too little to read as
       depth at all: the trade map 25px across four screens, the finale 13px, the
       hero proof 4.4px. The cause is yPercent, which is a share of the ELEMENT, so
       a short heading gets a short drift however far you scroll. Phones translate
       in PIXELS instead, off one constant, so a heading and a map get the same
       travel and the page reads at a single depth. Desktop keeps percent. */
    /* 10 Sep: measured the actual travel of every plane on a 375 screen and the page
       had almost no depth in it: the hero backdrop moved 9px across its whole section
       and the proof rail 11px. Below roughly 40px of differential the eye reads a plane
       as glued to the page, so six of the seven live planes were doing nothing at all.
       18 gives a data-plx="3" plane 108px of travel and a "4" 144px, which reads as two
       distinct depths without any plane reaching its neighbour (verified after: zero
       pixels of type under a moved plane, and no new horizontal overflow). */
    /* 11 Sep, Bazil: "make parallax awesome and premium". 18 read as present but timid on a
       phone: a data-plx="3" plane travelled 108px across a whole section, about a tenth of the
       scroll. 26 gives it 156px and a "4" 208px, which is the depth the desktop build has at
       its own scale, with the same guard: nothing may reach its neighbour (re-audited after). */
    var PXU=26, PXU_TAB=34, PXU_DESK=30;
    document.querySelectorAll('[data-plx]').forEach(function(el){
      var sp=parseFloat(el.getAttribute('data-plx'))||0; if(!sp) return;
      var m=el.getAttribute('data-plx-m'), mt=el.getAttribute('data-plx-t');
      /* data-plx-m is the PHONE share, data-plx-t the tablet one; a plane with no -t keeps its
         phone share in the tablet band, because an opt-out there is usually a real intent (the
         enquiry form must not drift under the thumb, and the two no-3D poster fallbacks carry
         raw speeds of -22 and -20, which in pixel mode would fling them 1400px). A plane that
         only wanted the room back says so with -t. Width-based: a browser at 768 and an iPad
         at 768 resolve the same share. */
      if(soft) sp*=(mt!=null?(parseFloat(mt)||0):(m!=null?(parseFloat(m)||0):1));
      else if(m!=null&&phone) sp*=parseFloat(m)||0;
      else if(!phone) sp*=amp;
      if(!sp) return;
      var sec=el.closest('section')||el.parentElement;
      /* 10 Sep: desktop measured at 1440 across each plane's full trigger window: the
         proof rail travelled 2.3px, the headings 13 to 26px, the hero backdrop 38px.
         yPercent is a share of the ELEMENT, so a two line heading drifts two per cent
         of its own height however far the page scrolls. The phone build left percent
         for pixels on 9 Sep for exactly this reason and desktop was never followed.
         Desktop takes pixels too, off its own constant: a wider screen scrolls further
         per section, so the same plane needs more travel to read at the same depth. */
      var U=narrow?PXU:(tab?PXU_TAB:PXU_DESK);
      /* 11 Sep, Bazil: "no overlap and why empty space". A plane travels from +sp*U to -sp*U,
         so one that sits near the top of its section climbs OUT of it at the end of the scroll
         (his screenshot: "1 FAMILY RECIPE" half inside the red section above) and is pushed
         down into a hole at the start. Every plane is clamped to its own room: it may never
         travel further than the gap it has to its section's top or bottom edge. */
      /* 12 Sep: the clamp exists to stop a plane CARRYING COPY from climbing out of its section
         into its neighbour. It was cutting two things it has no business cutting: a backdrop
         with no text in it (the hero photograph's room to its own section edges is nil, so it
         was pinned to a 20px crawl), and anything inside a PINNED stage, which is full bleed and
         fixed while the section scrolls, so it cannot reach a neighbour at all. Measured at
         768x1024 the clamp took the hero backdrop from 81px to 26 and "3 minutes to sedap" from
         118 to 39. Both are unclamped now; every plane that carries copy on a scrolling section
         still is. */
      var freePlane=!(el.textContent||'').trim()||!!el.closest('.stage');
      if((phone||soft)&&!freePlane){
        var er=el.getBoundingClientRect(), sr2=sec.getBoundingClientRect();
        var room=Math.max(0,Math.min(er.top-sr2.top, sr2.bottom-er.bottom)-10);
        var maxSp=room/U;
        if(Math.abs(sp)>maxSp) sp=(sp<0?-1:1)*Math.max(0.6,maxSp);
      }
      var to={y:-sp*U};
      /* 11 Sep: a plane that only translates reads flat. The deepest planes (|speed| >= 3) take
         a whisper of scale with their travel, which is what separates a parallax that feels
         built from one that feels applied. Under a tenth of a per cent per pixel, so nothing
         moves against its own box enough to touch a neighbour. */
      if((phone||soft)&&Math.abs(sp)>=3){ to.scale=1+Math.min(0.03,Math.abs(sp)*0.006); gsap.set(el,{transformOrigin:'50% 50%'}); }
      to.ease='none'; to.immediateRender=false;
      to.scrollTrigger={trigger:sec,start:'top bottom',end:'bottom top',scrub:SCRUB,invalidateOnRefresh:true};
      gsap.fromTo(el, {y:sp*U}, to);
      /* what this plane was actually GIVEN, after the opt-out, the band's unit and the clamp.
         Walking the page and watching transforms under-samples a plane whose section is eight
         screens tall, so the plan is published instead of inferred. */
      (window.__plxPlan=window.__plxPlan||[]).push({el:el.tagName+'.'+(el.className||'').toString().trim().split(/\s+/)[0],
        raw:el.getAttribute('data-plx'),m:el.getAttribute('data-plx-m'),sp:+sp.toFixed(2),u:U,travelPx:Math.round(Math.abs(sp)*U*2),clamp:((phone||soft)&&!freePlane)?'clamped':'free'});
    });
  })();

  /* SCRAMBLE: characters cycle glyphs then settle left to right. Shared by the
     heritage years and the section kickers. Never hides anything: the element
     keeps its text throughout and is restored on the last tick. */
  function scramble(el,dur,glyphs){
    var fin=el.getAttribute('data-fin')||el.textContent; el.setAttribute('data-fin',fin);
    if(el.__dec) clearInterval(el.__dec);
    var t0=performance.now(); dur=dur||620; glyphs=glyphs||'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    el.__dec=setInterval(function(){
      var p=Math.min(1,(performance.now()-t0)/dur), out='';
      for(var k=0;k<fin.length;k++){
        var ch=fin.charAt(k);
        out+= (ch===' '||ch==='\u00b7'||k<p*fin.length*1.15-1) ? ch : glyphs.charAt(Math.floor(Math.random()*glyphs.length));
      }
      el.textContent=out;
      if(p>=1){ el.textContent=fin; clearInterval(el.__dec); el.__dec=null; }
    },36);
  }
  window.__scramble=scramble;
  /* the section kickers decode in as they arrive, once */
  if(!RM) document.querySelectorAll('section .k').forEach(function(k){
    if(k.closest('.nav')||k.closest('#hero')) return;
    ScrollTrigger.create({trigger:k,start:'top 90%',once:true,onEnter:function(){ scramble(k,520); }});
  });
  /* the hero headline racks into focus on load. Opacity never moves, so a
     throttled tab or a mid-flight error still leaves it readable.
     THE LOADING PLATE OWNS THE FIRST SECOND, so the intro waits for its
     handover rather than burning itself off behind the yellow. No plate, or a
     plate already gone, and it runs at once; and a 5.2s fallback runs it even
     if the event never lands, so the headline can never stay blurred. */
  if(!RM){
    var hl=document.querySelectorAll('.heroTitle .l');
    if(hl.length){
      var heroRan=false;
      var heroIntro=function(){
        if(heroRan) return; heroRan=true;
        gsap.fromTo(hl,{filter:'blur(16px)',scale:1.035,transformOrigin:'0% 50%'},
          {filter:'blur(0px)',scale:1,duration:1.15,stagger:.11,ease:'power3.out',delay:.05,
           onComplete:function(){ gsap.set(hl,{clearProps:'filter,transform'}); }});
        setTimeout(function(){ gsap.set(hl,{clearProps:'filter,transform'}); },2600);
      };
      var plate=window.__vitsLoader;
      if(plate&&!plate.done()){
        document.addEventListener('vits:loaded',heroIntro,{once:true});
        setTimeout(heroIntro,5200);
      } else heroIntro();
    }
  }

  /* ============================================================
     ONE RHYTHM FOR EVERY SECTION (3 Sep). Split each display
     heading on its <br> into lines, then run kicker, lines, lede
     and meta on one timeline as the section arrives. Nothing is
     hidden in CSS, and the hidden start state is only painted
     once the trigger is live, so a missed trigger or a dead
     script leaves the whole page readable.
     ============================================================ */
  function splitLines(h){
    if(h.__split||!h.childNodes.length) return [];
    var lines=[], cur=[];
    [].slice.call(h.childNodes).forEach(function(n){
      if(n.nodeName==='BR'){ if(cur.length) lines.push(cur); cur=[]; }
      else cur.push(n);
    });
    if(cur.length) lines.push(cur);
    if(lines.length<1) return [];
    var frag=document.createDocumentFragment(), inners=[];
    lines.forEach(function(group){
      var outer=document.createElement('span'); outer.className='ln';
      var inner=document.createElement('span'); inner.className='lnI';
      group.forEach(function(n){ inner.appendChild(n); });
      outer.appendChild(inner); frag.appendChild(outer); inners.push(inner);
    });
    h.innerHTML=''; h.appendChild(frag); h.__split=true;
    return inners;
  }
  function sectionRhythm(){
    document.querySelectorAll('section[id]').forEach(function(sec){
      if(sec.__rhythm) return;
      if(sec.id==='hero') return;                 /* the hero has its own load intro */
      var head=sec.querySelector('h2.disp');
      var kick=sec.querySelector('.k');
      var lede=sec.querySelector('.lede');
      if(!head&&!lede&&!kick) return;
      sec.__rhythm=true;
      /* ONE OWNER PER ELEMENT. The generic .rv reveal also targets these
         headings and ledes; two tweens on one element left them stranded at
         opacity 0 when both fired on the same frame. */
      if(head) head.classList.remove('rv');
      if(lede) lede.classList.remove('rv');
      var inners=head?splitLines(head):[];
      /* every tween is immediateRender:false, so the hidden start state is
         never painted until its trigger is genuinely live: a missed trigger,
         a dead script or reduced motion all leave the finished page standing */
      if(inners.length){
        gsap.from(inners,{yPercent:112,duration:1.0,stagger:.085,ease:'power3.out',
          immediateRender:false,scrollTrigger:{trigger:head,start:'top 84%',once:true},
          /* the clip is only needed while the line is travelling: once it has
             arrived the wrapper stops clipping, so a long line can never be cut */
          onComplete:function(){ inners.forEach(function(i){ if(i.parentNode) i.parentNode.classList.add('shown'); }); }});
      }
      if(lede){
        /* y only, never opacity: a fade that is interrupted mid-flight leaves
           the copy stranded translucent, which is exactly what happened. */
        gsap.from(lede,{y:26,duration:.9,ease:'power3.out',delay:.15,
          immediateRender:false,scrollTrigger:{trigger:lede,start:'top 88%',once:true}});
      }
      if(kick&&window.__scramble){
        ScrollTrigger.create({trigger:kick,start:'top 90%',once:true,
          onEnter:function(){ window.__scramble(kick,520); }});
      }
    });
    ScrollTrigger.refresh();
  }
  /* the split has to happen AFTER content.js binds: data-c-html rewrites a
     heading's innerHTML and would throw the line wrappers away. */
  if(!RM&&window.gsap&&window.ScrollTrigger){
    document.addEventListener('vits:content',sectionRhythm);
    addEventListener('load',sectionRhythm);        /* if the event never fires */
    setTimeout(sectionRhythm,1200);
  }

  /* reveals: visible by default; immediateRender:false so a missed trigger leaves them shown */
  document.querySelectorAll('.rv').forEach(function(el){
    gsap.from(el,{y:34,opacity:0,duration:.9,ease:'power3.out',immediateRender:false,
      scrollTrigger:{trigger:el,start:'top 88%'}});
  });
  addEventListener('load',function(){ setTimeout(function(){
    document.querySelectorAll('.rv').forEach(function(el){
      var o=getComputedStyle(el).opacity;
      if(+o<0.05) gsap.set(el,{clearProps:'all'});
    });
  },8000); });

  /* ---------- scene 1: the hero ----------
     The hero is one screen of layout now, not a runway: the pack parks in the
     empty slot in the right column and rides the page until the travel takes
     over. The slot is measured live, so the pack sits in it at any viewport. */
  (function(){
    var slot=document.getElementById('packSlot');
    function measureSlot(){
      if(!slot||!slot.offsetParent){ window.__ph.heroBox=null; return; }
      var r=slot.getBoundingClientRect();
      if(!r.width||!r.height){ window.__ph.heroBox=null; return; }
      window.__ph.heroBox={
        x:((r.left+r.width*0.5)/innerWidth)*2-1,
        /* 0.34, not the middle: the drawn silhouette hangs well below the
           nominal box, and centring it dropped the pack onto the fact strip */
        /* 4 Sep, Bazil: "the main product is not in line": the pack's centre now follows
           the copy block (title, lede, seal), not the slot, so the two read as one row */
        /* 7 Sep, the responsiveness pass: below 1100 the hero is one column and the copy
           block sits UNDER the slot, so following the copy dropped the pack onto the
           lede (measured 274 x 153px over it at 390). One column: the pack sits in its slot. */
        y:(function(){ var c=document.querySelector('#hero .heroCopy'); if(!c||innerWidth<=1100) return 1-((r.top+r.height*(innerWidth<=1100?0.50:0.35))/innerHeight)*2;
             var b=c.getBoundingClientRect(); return 1-((b.top+b.height*0.50)/innerHeight)*2+(window.__heroAdj||0); })(),
        px:{w:r.width,h:r.height}      /* the 3D layer fits the pack to this */
      };
      placeTags();
    }
    /* the product tag and the sticker ride the pack's published box, so the picture says
       what it is (Bazil, 4 Sep: "no badges or information at the picture") */
    var tag=document.getElementById('heroTag'), stick=document.getElementById('heroSticker');
    function placeTags(){
      var b=window.__packBox, on=!window.__ph.travelOn&&(window.__ph.hero||0)<0.22&&b&&b.w>40;
      window.__tagDbg={on:on,travelOn:window.__ph.travelOn,hero:window.__ph.hero,bw:b&&b.w};
      /* the drawn silhouette hangs below its nominal box, so the slot's centre is not the
         pack's. Once the pack has settled after load, the offset between its drawn centre
         and the copy's centre is measured ONCE and folded into heroBox.y (a per-frame servo
         chased its own lag and saturated). */
      if(on&&(window.__ph.hero||0)<0.02&&!window.__heroAdjDone){
        var st=window.__heroSettle||{y:0,n:0};
        st.n=(Math.abs(b.y-st.y)<0.6)?st.n+1:0; st.y=b.y; window.__heroSettle=st;
        if(st.n>=14){
          var c=document.querySelector('#hero .heroCopy');
          if(c&&innerWidth>1100){ var cc=c.getBoundingClientRect();   /* the copy servo is a desktop row idea */ window.__heroAdj=Math.max(-0.8,Math.min(0.8,(window.__heroAdj||0)+(b.y-(cc.top+cc.height*0.5))/innerHeight*2)); }
          window.__heroAdjDone=true; measureSlot();
        }
      }
      [tag,stick].forEach(function(el){ if(el) el.style.opacity=on?1:0; });
      if(!on) return;
      if(tag){ tag.style.left=(b.x-b.w/2+b.w*0.04)+'px'; tag.style.top=(b.y+b.h/2-10)+'px'; }
      if(stick){ stick.style.left=(b.x+b.w/2-58)+'px'; stick.style.top=(b.y-b.h/2-30)+'px'; }
    }
    (function tagTick(){ requestAnimationFrame(tagTick); if(window.__ph.heroOn||(window.__ph.hero||0)<0.3) placeTags(); })();
    addEventListener('resize',function(){ window.__heroAdjDone=false; window.__heroSettle=null; });
    measureSlot();
    addEventListener('resize',measureSlot);
    /* 10 Sep: the proof strip is the hero's second beat. At 1440x900 its top sat 18px above the
       fold, so the tops of the four figures peeked at the bottom of the first screen and read as
       a cut. It is pushed to start at the fold, never higher; on tall frames nothing changes. */
    (function(){
      var pr=document.querySelector('.heroProof'), hero=document.getElementById('hero'); if(!pr||!hero) return;
      function push(){
        if(innerWidth<=1000){ hero.style.removeProperty('--proofPush'); return; }
        hero.style.setProperty('--proofPush','0px');
        var top=pr.getBoundingClientRect().top+scrollY;
        var need=innerHeight+8-top;
        hero.style.setProperty('--proofPush',(need>0?Math.round(need):0)+'px');
      }
      push(); addEventListener('resize',push); addEventListener('load',push);
    })();
    ScrollTrigger.create({trigger:'#hero',start:'top top',end:'bottom top',
      /* 9 Sep: the hero pack is owned by its [data-plx] plane now, not by flat(): two
         writers on one transform is the bug this file warns about everywhere else. */
      onUpdate:function(self){ window.__ph.hero=self.progress; measureSlot(); },
      onRefresh:measureSlot,
      onToggle:function(self){ window.__ph.heroOn=self.isActive; },
      onLeave:function(){ window.__ph.hero=1; },
      onLeaveBack:function(){ window.__ph.hero=0; measureSlot(); }
    });
  })();

  /* ---------- the travel: hero end to range start ---------- */
  /* the flight-plan marks are measured on every refresh, so each leg of the
     pack's journey lands exactly on its scene at any viewport or copy length */
  (function(){
    var jRun=document.querySelector('#story .jRun');
    var trade=document.getElementById('trade');
    var specStage=document.querySelector('.specStage');
    var tFrame=document.querySelector('#trade .tFrame');
    var tLane=document.querySelector('#trade .tLane');
    /* the credentials strip is full bleed: no column on the page clears it, so the
       flight plan has to know where it is and take the pack under the fold while
       the red band crosses. Measuring it is the only way the marks can be right. */
    var strip=document.querySelector('.markStrip');
    function absTop(el){ return el.getBoundingClientRect().top+scrollY; }
    /* the pack parks in the empty middle lane, between the factory photo and
       the buyer checks, covering neither. The lane is sticky, so its viewport
       box is measured live. Narrow viewports drop the lane and fall back to
       the frame corner as before. */
    var mapLane=document.querySelector('#trade .mapLane'), quoteLane=document.querySelector('#trade .quoteLane'), tSplit=document.querySelector('#trade .tSplit'), headLane=document.querySelector('#trade .tHeadLane');
    /* A LANE'S CENTRE MAY NOT RUN AWAY WITH THE PAGE. .mapLane and .quoteLane
       are ordinary blocks, not sticky the way .tLane is at css/site.css:604, so
       once they pass the top of the screen their centre keeps climbing: measured
       at 1800x1000, mapBox.y reached +4.18 and quoteBox.y +2.09, which is 2090px
       and 1045px above the middle of the frame. Those two numbers are the VALUES
       of the last four travel waypoints, while the waypoints' own PARAMETERS were
       fixed at the last refresh, so the run into the range was being drawn from
       knots two to four screens above the viewport. The pack left the top of the
       page, captureDock then caught that off screen transform on the handover
       frame, and the range eased in from nowhere: the section reading as empty.
       The centre is bounded to a quarter of a screen past either edge. It stays
       inert while the lane is on screen, which is the whole time the pack is
       meant to be riding it, and the pack still leaves the top WITH its lane
       rather than being held in a band that .mapLegend and .tStats scroll into. */
    function laneY(b){
      var c=b.top+b.height*0.5;
      return 1-(Math.max(-innerHeight*0.25,Math.min(innerHeight*1.25,c))/innerHeight)*2;
    }
    function laneBox(el,cap){
      if(!el||!el.offsetParent) return null;
      var b=el.getBoundingClientRect(); if(!b.width||!b.height) return null;
      if(innerWidth<=1000) cap=Math.min(cap,0.62);   /* stacked lanes: the pack must not reach the rows around it */
      /* 10 Sep: the edges too, uncapped, so the 3D layer can keep the pack INSIDE its lane
         (top edge brings it in from below, bottom edge pushes it out through the top) */
      return {x:((b.left+b.width*0.5)/innerWidth)*2-1, y:laneY(b),
              t:1-(b.top/innerHeight)*2, b:1-(b.bottom/innerHeight)*2,
              s:Math.max(0.40,Math.min(cap,(b.width/innerWidth)*2.4))};
    }
    function measureFrame(){
      /* 10 Sep: the specimen slot's LIVE frame position, uncapped. dockX and dockY are read
         inside the sticky stage and say nothing about where the slot is on the page before
         the range pins; the stacked layouts ride the pack in from below on this. */
      if(specStage){ var q=specStage.getBoundingClientRect(); if(q.height) window.__ph.dockLive={y:1-((q.top+q.height*0.5)/innerHeight)*2,t:1-(q.top/innerHeight)*2}; }
      /* 4 Sep, Bazil: "the packaging should travel to here too": the markets and the quote
         each carry a lane the pack rides down before it heads for the range */
      window.__ph.mapBox=laneBox(mapLane,innerWidth<1500?0.72:0.80); window.__ph.quoteBox=laneBox(quoteLane,0.82); window.__ph.headBox=laneBox(headLane,0.84);
      var lane=tLane&&tLane.offsetParent&&tLane.getBoundingClientRect().width>0;
      var el=lane?tLane:tFrame;
      /* 7 Sep: the line has no lane and no frame any more. The trade leg holds the
         pack where the head lane put it, so there is nothing to teleport to. */
      if(!el){ if(window.__ph.headBox) window.__ph.tradeBox=window.__ph.headBox; return; }
      var r=el.getBoundingClientRect();
      if(!r.width) return;
      /* .tLane is sticky, but only while its section is on screen: once #trade
         releases it, its centre climbs with the page exactly as the other two
         lanes did. Measured at 1800x1000 tradeBox.y ran -1.45 to +4.65 while
         mapBox and quoteBox, already bounded above, held at 1.50. It is the one
         lane still writing an unbounded value, and every trade waypoint reads
         it, so it is bounded here with the same quarter screen rule. */
      window.__ph.tradeBox=lane?{
        x:((r.left+r.width*0.50)/innerWidth)*2-1,
        y:laneY({top:r.top+r.height*(0.48-0.5),height:r.height}),
        s:Math.max(0.60,Math.min(innerWidth<1500?0.80:0.90,(r.width/innerWidth)*2.6))   /* Bazil, 4 Sep: the pack cannot look small, and it clears the print and the checks */
      }:{
        x:((r.left+r.width*0.62)/innerWidth)*2-1,
        y:1-((r.top+r.height*0.30)/innerHeight)*2,
        s:Math.max(0.40,Math.min(0.80,(r.width/innerWidth)*1.32))
      };
    }
    /* the hero is one screen, so its bottom is already above the fold at rest:
       starting the travel there handed the pack over on the first pixel of
       scroll and it left the slot immediately. It hands over when the hero has
       actually scrolled off the top instead. */
    ScrollTrigger.create({trigger:'#label',start:'bottom top',endTrigger:'#range',end:'top top',
      onUpdate:function(self){ window.__ph.travel=self.progress; measureFrame(); },
      onToggle:function(self){ window.__ph.travelOn=self.isActive; },
      onRefresh:function(self){
        var span=self.end-self.start; if(span<=0||!jRun||!trade) return;
        function f(px){ return Math.max(0.01,Math.min(0.99,(px-self.start)/span)); }
        var vh=innerHeight;
        var stripTop=strip?absTop(strip):null;
        var mk={
          storyIn:  f(absTop(jRun)),
          /* The lane ride ENDS half a screen before the credentials strip reaches
             the fold, so the pack has runway to sink clear of it. Measured off the
             strip, not off the run: jRun's bottom is only the foot note away from
             the strip, about 73px of scroll, which left the pack no room at all and
             it rode straight over the marquee (measured JAKIM 0.83, Halal since
             1980 0.67 at scroll 6000). This gives the exit about 480px of runway.
             Falls back to the old mark if the strip is ever removed. */
          storyOut: stripTop!=null? f(stripTop-vh*1.10) : f(absTop(jRun)+jRun.offsetHeight-vh),
          tradeIn:  f(absTop(tFrame||trade)-vh*0.55),
          tradeOut: tSplit? f(absTop(tSplit)+tSplit.offsetHeight-vh*0.7) : f(absTop(trade)+trade.offsetHeight-vh)
        };
        if(headLane){ mk.headIn=f(absTop(headLane)-vh*0.55); mk.headOut=f(absTop(headLane)+headLane.offsetHeight-vh*0.40); }
        if(mapLane){ mk.mapIn=f(absTop(mapLane)-vh*0.45); mk.mapOut=f(absTop(mapLane)+mapLane.offsetHeight-vh*0.45); }
        if(quoteLane){ mk.quoteIn=f(absTop(quoteLane)-vh*0.55); mk.quoteOut=f(absTop(quoteLane)+quoteLane.offsetHeight-vh*0.35); }
        /* the knots must climb, whatever the layout does */
        /* the moment the strip's top touches the fold: the pack must already be
           fully under it by here, or the marquee crosses the pack */
        if(stripTop!=null) mk.stripUnder=f(stripTop-vh);
        /* 10 Sep, THE LINE HAS NO LANE. Since 7 Sep the split is five full-width station
           photographs and the checks sheet, and tradeOut was still measured off its bottom:
           the pack held its band while the QC bench photograph and its caption scrolled
           through it (measured cov 1.00 at 1440), then shot off the top at three times the
           page's speed. With no .tLane the trade knots collapse onto the head lane, and the
           pack is handed to the map lane at the first scroll where the head lane has fully
           left the top: on a wide frame the 3D layer keeps the pack inside whichever lane
           owns it, so that hand-off is the one moment neither lane can show it. mapLead is
           how far, in frame units, the map lane's top is already inside the frame at that
           moment (lanes closer than a screen), and the pack enters that much later, from
           the fold, so it never pops in mid frame. */
        var noLane=!(tLane&&tLane.offsetParent)&&!tFrame;
        if(noLane&&mk.headOut!=null){ mk.tradeIn=mk.headOut+0.006; mk.tradeOut=mk.headOut+0.012; }
        window.__ph.mapLead=0;
        if(mapLane&&headLane){
          var headBot=absTop(headLane)+headLane.offsetHeight, mapTop=absTop(mapLane);
          var sw=Math.max(headBot+2,mapTop-vh);
          mk.mapIn=f(sw);
          window.__ph.mapLead=Math.max(0,(headBot+2)-(mapTop-vh))*2/vh;
        }
        var order=['storyIn','storyOut','stripUnder','headIn','headOut','tradeIn','tradeOut','mapIn','mapOut','quoteIn','quoteOut'], last=0;
        order.forEach(function(k){ if(mk[k]==null) return; mk[k]=Math.min(0.99,Math.max(last+0.006,mk[k])); last=mk[k]; });
        window.__ph.marks=mk;
        if(specStage){
          var r=specStage.getBoundingClientRect();
          window.__ph.dockX=((r.left+r.width/2)/innerWidth)*2-1;
          /* and its height, read INSIDE the sticky stage (the page position is meaningless
             at refresh time): on phones the slot sits under the copy, not at the centre */
          var stg=specStage.closest('.stage'), sb=stg?stg.getBoundingClientRect():null;
          window.__ph.dockY=sb&&sb.height ? 1-(((r.top-sb.top)+r.height/2)/sb.height)*2 : 0;
          /* the slot box in px: the 3D pack sizes itself to the specimen slot
             instead of a fixed scale, so it can never outgrow the column it
             is docked in whatever the viewport does. */
          window.__ph.dockBox={w:r.width,h:r.height};
        }
        measureFrame();
      }});
  })();

  /* ---------- scene 1b: the callouts (4 Sep, third cut) ----------
     Bazil: the diagram concept was right, do it premium. The pack holds still, front on,
     in a pinned stage; five notes reveal one by one as a function of scroll distance, each
     drawing an elbow leader to a numbered pin on the real point of the 3D pack (hotspots
     from pack3d every frame). Hover a note or a pin and the rest quiets. Nothing switches
     on a threshold. */
  (function(){
    var sec=document.getElementById('label'), run=sec&&sec.querySelector('.anatRun'), slot=document.getElementById('labelSlot');
    if(!sec||!run||!slot) return;
    var stage=sec.querySelector('.anatStage'), svg=sec.querySelector('.anatLines');
    var beats=[].slice.call(sec.querySelectorAll('.beat'));
    var NS='http://www.w3.org/2000/svg';
    var parts=beats.map(function(el,i){
      var g=document.createElementNS(NS,'g'), pl=document.createElementNS(NS,'polyline'), pin=document.createElementNS(NS,'circle'), tx=document.createElementNS(NS,'text');
      pin.setAttribute('r',13); pin.setAttribute('class','apin');   /* not .pin: the flat map owns that class and translates it */ tx.textContent='0'+(i+1);
      g.appendChild(pl); g.appendChild(pin); g.appendChild(tx); svg.appendChild(g);
      return {el:el,g:g,pl:pl,pin:pin,tx:tx,hot:el.getAttribute('data-hot'),left:el.closest('.anatL')!=null};
    });
    sec.classList.add('live');
    var hover=-1;
    function pick(i){ hover=i; sec.classList.toggle('picking',i>=0); parts.forEach(function(p,j){ p.el.classList.toggle('on',j===i); p.g.classList.toggle('on',j===i); p.pin.classList.toggle('on',j===i); }); }
    parts.forEach(function(p,i){
      [p.el,p.pin].forEach(function(t){
        /* 7 Sep: hover picks only for a mouse. A finger used to fire enter (pick) and then
           click (un-pick) on the same tap, so touch could never open a note. */
        t.addEventListener('pointerenter',function(e){ if(e.pointerType==='mouse') pick(i); });
        t.addEventListener('pointerleave',function(e){ if(e.pointerType==='mouse') pick(-1); });
        t.addEventListener('click',function(){ pick(hover===i?-1:i); });
      });
    });
    function place(){
      var p=window.__ph.label||0, hand=window.__ph.handoff||0, hot=window.__packHot;
      var lines=getComputedStyle(svg).display!=='none';
      var st=stage.getBoundingClientRect();
      /* the moment the stage unpins, or the pack lets go of the slot for the story, the
         leaders and pins go: otherwise they stretch between notes that scroll away and a
         pack that holds its height (Bazil, 4 Sep: "this part looks weird") */
      var held=(window.__ph.labelBox&&window.__ph.labelBox.held)||0;
      var vis=Math.max(0,1-Math.max(held*4, -st.top/(innerHeight*0.10)));
      parts.forEach(function(q,i){
        /* each note arrives on its own stretch of the runway, one after the other */
        var t=Math.max(0,Math.min(1,(p-(0.04+i*0.11))/0.12));
        if(hand<0.98) t=0;
        q.el.style.opacity=t;
        q.el.style.transform='translateX('+((1-t)*(q.left?14:-14)).toFixed(1)+'px)';
        var h=hot&&hot[q.hot];
        if(!lines||!h||!isFinite(h.x)||!isFinite(h.y)||h.f<0.2||t<=0||vis<=0){ q.g.style.opacity=0; return; }
        var n=q.el.querySelector('.n').getBoundingClientRect();
        var x1=(q.left?n.right+8:n.left-8)-st.left, y1=n.top+n.height/2-st.top, x2=h.x-st.left, y2=h.y-st.top;
        var pb=window.__packBox, edge=(pb&&isFinite(pb.x)&&isFinite(pb.w))?(q.left?pb.x-pb.w/2:pb.x+pb.w/2)-st.left:x2;
        if(!isFinite(x1)||!isFinite(y1)){ q.g.style.opacity=0; return; }
        var xb=q.left?Math.min(edge-22,x2-30):Math.max(edge+22,x2+30);
        q.pl.setAttribute('points',x1+','+y1+' '+xb+','+y1+' '+x2+','+y2);
        var L=Math.abs(xb-x1)+Math.hypot(x2-xb,y2-y1);
        q.pl.style.strokeDasharray=L; q.pl.style.strokeDashoffset=L*(1-t);
        q.pin.setAttribute('cx',x2); q.pin.setAttribute('cy',y2); q.tx.setAttribute('x',x2); q.tx.setAttribute('y',y2);
        q.pin.style.opacity=t; q.tx.style.opacity=t; q.g.style.opacity=vis;
      });
    }
    /* the 3D pack parks in the slot for the length of the runway */
    function measureSlot(){
      if(!slot.offsetParent){ window.__ph.labelBox=null; return; }
      var r=slot.getBoundingClientRect();
      if(!r.width||!r.height){ window.__ph.labelBox=null; return; }
      /* Bazil, 4 Sep: "the packaging should continue scrolling even from here". Once the
         slot's centre rises past 42% of the viewport the pack lets go of it, holds that
         height and drifts to the story lane's x, so it never leaves the screen. */
      /* 10 Sep: stacked, the slot's centre is read at 0.38, not the middle: the drawn pack
         hangs about 60px under its own origin (see the hero's 0.34), and centred it put its
         foot 29px past the slot onto beat 4 (cov 0.34 at 800x900). */
      var yc=r.top+r.height*(innerWidth<=760?0.5:(innerWidth<=1000?0.38:0.5)), holdY=innerHeight*0.42;
      /* 10 Sep: the hold is a wide idea too. At 1000 and under the beats stack right under the
         slot, so a pack held at 42% while its slot rose hung over beat 4 (cov 1.00 at 1000x700).
         Stacked, the pack rides its slot up and out, and the travel brings it back for the range. */
      var stacked=innerWidth<=1000;
      var k=stacked?0:Math.max(0,Math.min(1,(holdY-yc)/(innerHeight*0.45)));
      var sbx=(window.__ph.storyBox&&window.__ph.storyBox.x!=null)?window.__ph.storyBox.x:0.45;
      var x0=((r.left+r.width*0.5)/innerWidth)*2-1;
      window.__ph.labelBox={
        /* 10 Sep: the drift to the story lane's x is a wide idea; at 1000 and under there is
           no lane (storyBox is null, sbx fell back to 0.45) and the drift carried the pack
           right over its own callout ("On every pack since 1975", cov 0.69 at 1000x700). */
        x:x0+(sbx-x0)*(innerWidth<=1000?0:k),
        y:1-((stacked?yc:Math.max(yc,holdY))/innerHeight)*2,
        px:{w:r.width*(innerWidth<=1000?(innerWidth<=760?1:0.82):1),h:r.height*(innerWidth<=1000?(innerWidth<=760?1:0.82):1)},   /* phones: the whole slot */
        held:k
      };
      /* 10 Sep, for the stacked layouts: how far the label slot's top is already inside the
         frame at the moment the hero slot has fully left it (slots closer than a screen),
         in frame units. The 3D layer keeps the pack inside one slot or the other on narrow
         frames, and this is what lets the second entry start at the fold. */
      var hs=document.getElementById('packSlot');
      if(hs){ var hr=hs.getBoundingClientRect(); window.__ph.labelLead=Math.max(0,innerHeight-(r.top-hr.bottom))*2/innerHeight; }
      /* 12 Sep, Bazil: "don't just appear, come from the top scrolling". On a stacked frame the
         pack used to ride the hero slot out of the top and then come back UP from the fold with
         this slot, which reads as an arrival out of nowhere. To bring it DOWN through the frame
         instead, the 3D layer needs to know when the red field owns the whole frame, because
         that is the only stretch it can cross without passing over the facts strip above. This
         is the section's own top edge in the same NDC the boxes use. */
      var secR=sec.getBoundingClientRect();
      window.__ph.labelSecTop=1-(secR.top/innerHeight)*2;
      sec.classList.toggle('held',k>0.02);
    }
    measureSlot();
    addEventListener('resize',measureSlot);
    ScrollTrigger.create({trigger:sec,start:'top bottom',end:'top top',
      onUpdate:function(self){ window.__ph.handoff=self.progress; measureSlot(); },
      onRefresh:function(){ measureSlot(); place(); },
      onLeave:function(){ window.__ph.handoff=1; },
      onLeaveBack:function(){ window.__ph.handoff=0; }
    });
    ScrollTrigger.create({trigger:run,start:'top top',end:'bottom bottom',
      onUpdate:function(self){ window.__ph.label=self.progress; measureSlot(); place(); },
      onToggle:function(self){ window.__ph.labelOn=self.isActive; document.body.classList.toggle('anatOn',self.isActive); },   /* 8 Sep: the hover cue lives under the 3D layer now and shows only while the callouts run */
      onLeave:function(){ window.__ph.label=1; window.__ph.handoff=1; },
      onLeaveBack:function(){ window.__ph.label=0; }
    });
    (function tick(){
      requestAnimationFrame(tick);
      var r=sec.getBoundingClientRect();
      if(r.bottom>-200&&r.top<innerHeight+200){ measureSlot(); place(); }
    })();
    window.__labelMeasure=measureSlot;   /* 10 Sep: the audit runs without frames; it measures the slot itself */
    place();
  })();

  /* ---------- scene 2: the board, re-hung (5 Sep) ----------
     Bazil, 4 Sep: the board "reads flat and literal. A wall of photos sliding up."
     The cause was in the markup, not in the light: 20 of the 31 items sat at three
     distances from centre, sides alternated strictly, data-t stepped by exactly
     0.20, nothing overlapped anything. This moves FIVE PILE BOXES and lets
     site.css arrange what is inside each one.

     WHAT THIS FILE MAY NOT DO, EVER:
       no el.style.width in a frame (it invalidated layout 31 times a frame)
       no getBoundingClientRect in the item loop (11 forced layouts a frame)
       no el.style.zIndex in a frame (z is authored as --z)
       no second travel number and no second sin(): boardY is computed and
         rounded ONCE, and the cork, the piles, the ruler and the route all take
         that exact integer, so the photographs cannot drift on the cardboard.
     Every value is written inline from the runway's progress, so the wall
     reverses exactly under the hand and nothing switches on a threshold. */
  (function(){
    var board=document.getElementById('storyBoard'); if(!board) return;
    var stage=board.querySelector('.boardStage'),
        cork=board.querySelector('.bCork'),
        gut=board.querySelector('.bGut'),
        brk=board.querySelector('.bBracket'),
        svgS=board.querySelector('.bString'),
        packSh=board.querySelector('.bPackShade');
    if(!cork||!gut) return;
    board.classList.add('live');

    var TRAV=innerWidth<=760?4.4:(innerWidth<=1000?5.2:6.3);   /* screen heights of wall per unit of t */   /* 12 Sep: at 768x1024 a 6.3 wall put 968px between piles on a 1024 frame, so every pile arrived alone with a third of a screen of bare cork behind it. 5.2 closes the gap to about 140px, which is the overlap the composition was drawn with */

    /* the five piles and the two batten rails. knots are the PINS the red route
       detours around, in the pile's own u,v units, so the thread lands on real
       pins and never in empty cork. Only .bPinned items appear here. */
    var PILES=[
      {t:0.165,ax:-0.58,knots:[[ -5,-45],[ -6,  0]]},   /* the shophouse    */
      {t:0.315,ax: 0.66,knots:[[  4,-45],[  4, -3]]},   /* the paperwork    */
      {t:0.465,ax:-0.50,knots:[[ -9,-45],[-10,  0]]},   /* the home kitchen */
      {t:0.615,ax: 0.72,knots:[[  1,-45],[  1, -3]]},   /* the export       */
      {t:0.765,ax:-0.62,knots:[[ -3,-45],[ -4,  0]]},   /* the circuit      */
      {t:0.915,ax: 0.55,knots:[[ 8.5,-45],[9.5, 18]]}   /* today            */
    ];   /* 7 Sep: every knot is a pin. First the main print's, then the era card's,
            read off the placed layout (u in vw, v in vh from the pile anchor). */
    var GRP=[].slice.call(board.querySelectorAll('.bPile')).map(function(el){
      return {el:el,t:+el.getAttribute('data-t'),ax:+el.getAttribute('data-ax'),
              rail:el.classList.contains('bRail'),f:-1,pz:1e9};
    });
    /* wire each pile's knots onto its group by t, so a re-ordered markup cannot
       silently thread the route through the wrong pile */
    GRP.forEach(function(g){ for(var i=0;i<PILES.length;i++)
      if(Math.abs(PILES[i].t-g.t)<1e-6) g.knots=PILES[i].knots; });

    function cl(v){ return v<0?0:(v>1?1:v); }
    /* smootherstep: zero first AND second derivative at both ends, so a value
       arrives and leaves with no acceleration edge. Ordinary ease-out has a
       detectable corner at the settle and it is the standard tell of a scrubbed
       animation. (COPY STAND's one genuinely free idea.) */
    function sm5(q){ q=cl(q); return q*q*q*(q*(q*6-15)+10); }

    /* THE PACE MAP. One monotone remap of scroll s to board progress P: the wall
       slows across each pile and lets the empty cork pass faster, so 34vh of
       nothing becomes PACE instead of dead scroll. This is COPY STAND's dwell
       without its dwell HOLDS, which is the judged difference: a hold freezes u,
       and with u frozen every channel on screen freezes with it, which the audit
       certifies and the hand reads as a jammed page. Here the rate floor is 0.55
       of the unbraked rate, so something is always moving. Measured over 512
       samples: min dP/ds 0.662, max 1.203, ratio 1.82, strictly increasing at
       every sample. Built once as an integral, read with one lerp per frame. */
    var PN=512, PMAP=new Float64Array(PN+1);
    (function(){
      var rate=new Float64Array(PN+1), i, k, u, r, acc=0;
      for(i=0;i<=PN;i++){
        r=1;
        for(k=0;k<PILES.length;k++){
          u=1-Math.abs(i/PN-PILES[k].t)/0.075;
          if(u>0) r-=0.45*(u*u*(3-2*u));
        }
        rate[i]=r;
      }
      for(i=1;i<=PN;i++){ acc+=(rate[i]+rate[i-1])*0.5; PMAP[i]=acc; }
      for(i=0;i<=PN;i++) PMAP[i]/=acc;
      /* 7 Sep: the normalised integral drifts, so at S=t the first pile had
         already climbed to 40% of the screen and the last was still at 55%. The
         dwell and the centring were not the same frame. Subtract the error at
         every pile, linear in between, so P(t)=t at each stop: the pile is at
         mid screen exactly where the scroll is slowest. Max correction slope is
         0.09 against a rate floor of 0.66, so the map stays strictly increasing. */
      var E=[[0,0]], j, a, b, sN;
      for(k=0;k<PILES.length;k++){ u=PILES[k].t*PN; i=u|0; E.push([PILES[k].t,PMAP[i]+(PMAP[i+1]-PMAP[i])*(u-i)-PILES[k].t]); }
      E.push([1,0]);
      for(i=0;i<=PN;i++){
        sN=i/PN; j=1; while(j<E.length-1&&E[j][0]<sN) j++;
        a=E[j-1]; b=E[j]; PMAP[i]-=a[1]+(b[1]-a[1])*(sN-a[0])/(b[0]-a[0]);
      }
    })();
    function pace(s){
      s=cl(s); var f=s*PN, i=f|0; if(i>=PN) return 1;
      return PMAP[i]+(PMAP[i+1]-PMAP[i])*(f-i);
    }

    /* THE CORK STOPS REPAINTING. board-cork.jpg is 2200x1228, so at a 640px tile
       it renders 357.24px tall. The tile is seamless, so wrapping the layer by an
       exact multiple of that is pixel identical, and a full viewport background
       repaint every frame becomes one compositor transform. Read from the LOADED
       image, never hardcoded, so a re-export cannot introduce a creeping seam. */
    var TH=640*1228/2200;
    (function(){ var im=new Image();
      im.onload=function(){ if(im.naturalWidth) TH=640*im.naturalHeight/im.naturalWidth; };
      im.src='assets/board-cork.jpg'; })();

    /* the chinagraph rings: getTotalLength is read ONCE per path here and never
       on a frame. If the CMS ever swaps a path node, this cache must be cleared
       with it. */
    [].slice.call(board.querySelectorAll('.bMark path')).forEach(function(p){
      try{ p.style.setProperty('--len',p.getTotalLength().toFixed(1)); }catch(e){}
    });

    var gRoute=svgS&&svgS.querySelector('.bRouteG'),
        route =svgS&&svgS.querySelector('.bRoute'),
        ghost =svgS&&svgS.querySelector('.bGhostLine'), rlen=1;

    /* THE ROUTE, built once in BOARD space. It runs the gutter, detours into pile
       one and comes back, then goes pile to pile. It reaches the two right hand
       piles by crossing the pack's corridor and returns the same way: EXACTLY
       FOUR crossings, verified as four sign changes of x about W/2. It ends on a
       KNOT at pile five's bottom left pin rather than running off the edge,
       because the badge and the flag card in that pile were pinned later and were
       never on the route. NOTE: the concept asked for two crossings; two is
       geometrically impossible with alternating pile anchors, so this is four
       and the count is a measured invariant instead of a wish. */
    /* 10 Sep, Bazil: "no bleeding". On a phone the far items of a pile reached past the
       frame's edge. After every layout each item is measured once and pulled back inside
       by --fit (see the .bItem transform); zero on any item that already fits. */
    function fitItems(){
      var W=innerWidth, M=8;
      var items=[].slice.call(board.querySelectorAll('.bPile>.bItem'));
      items.forEach(function(el){ el.style.setProperty('--fit','0px'); });
      items.forEach(function(el){
        if(el.classList.contains('bBatten')) return;
        var r=el.getBoundingClientRect(); if(!r.width) return;
        /* the print inside a figure can run wider than the figure; measure the widest child too */
        var kids=el.querySelectorAll('img,span,figcaption'), l=r.left, rt=r.right;
        for(var i=0;i<kids.length;i++){ var k=kids[i].getBoundingClientRect(); if(k.width){ if(k.left<l) l=k.left; if(k.right>rt) rt=k.right; } }
        /* 12 Sep: the only rule left is the frame itself. Cards may sit anywhere across the board;
           the pack passes over them, which is what Bazil asked for. */
        var RIGHT=W-M;
        var dx=0;
        if(l<M) dx=M-l; else if(rt>RIGHT) dx=RIGHT-rt;
        if(dx&&l+dx<M) dx=M-l;
        if(dx) el.style.setProperty('--fit',dx.toFixed(1)+'px');
      });
    }
    window.__fitItems=fitItems;
    /* the first pass ran before the prints had a width (lazy images), so nothing was pulled in */
    addEventListener('load',function(){ fitItems(); setTimeout(fitItems,1500); setTimeout(fitItems,4000); });
    if(window.ScrollTrigger) ScrollTrigger.addEventListener('refresh',function(){ setTimeout(fitItems,50); });
    function buildRoute(){
      if(!route) return;
      var W=innerWidth, Hh=innerHeight, gx=W*0.085, k=[[gx,-0.06*Hh*TRAV]], i, pl, cx, y, p, q, mx, my, d;
      for(i=0;i<PILES.length;i++){
        pl=PILES[i]; cx=W*0.5+pl.ax*W*0.5; y=pl.t*Hh*TRAV;
        if(i<2) k.push([gx,y-0.34*Hh]);
        k.push([cx+pl.knots[0][0]*W/100, y+pl.knots[0][1]*Hh/100]);
        k.push([cx+pl.knots[1][0]*W/100, y+pl.knots[1][1]*Hh/100]);
        if(i===0) k.push([gx,y+0.40*Hh]);
      }
      d='M'+k[0][0].toFixed(1)+','+k[0][1].toFixed(1);
      for(i=1;i<k.length;i++){
        p=k[i]; q=k[i-1];
        /* string sags: the control point drops with the span, the way real string does */
        mx=(q[0]+p[0])/2;
        my=(q[1]+p[1])/2+Math.min(84,Math.hypot(p[0]-q[0],p[1]-q[1])*0.11);   /* 7 Sep: more sag, it is thread */
        d+=' Q'+mx.toFixed(1)+','+my.toFixed(1)+' '+p[0].toFixed(1)+','+p[1].toFixed(1);
      }
      route.setAttribute('d',d); if(ghost) ghost.setAttribute('d',d);
      rlen=route.getTotalLength(); route.style.strokeDasharray=rlen.toFixed(1);
      /* the ruler: fifty one years, the pitch set once, the ticks one gradient */
      gut.style.setProperty('--yearpx',(Hh*TRAV/51).toFixed(3));
      gut.style.setProperty('--boardpx',(Hh*TRAV*1.02).toFixed(0));
      /* 46 unbroken years drawn as 46 years of red down the gutter: the claim
         stops being a sentence and becomes a length the reader has to scroll */
      if(brk){
        var y80=(5/51)*Hh*TRAV;
        brk.style.top=y80.toFixed(0)+'px';
        brk.style.height=(Hh*TRAV-y80).toFixed(0)+'px';
      }
    }

    var S=0, P=0, lastP=0, swing=0, swingV=0, lastSw=1e9;

    var lastBY=null, lastPP=null, lastW=0, lastH=0;   /* place() memo, 10 Sep */
    function place(){
      var W=innerWidth, Hh=innerHeight, i, g, cx, f;
      var vel=P-lastP; lastP=P;
      swingV+=(Math.max(-7,Math.min(7,vel*900))-swing)*0.16-swingV*0.22; swing+=swingV;

      /* ONE OFFSET, ROUNDED ONCE, at its single site. Four things could drift
         against each other and none of them can, because they are literally the
         same number (Bazil, 4 Sep: the photos are stuck on the cardboard, so the
         cardboard moves too). Never add a second sin() below this line. */
      /* 10 Sep, phones: the wall starts 0.45 of a frame higher, so the first pile is in view
         with the intro instead of a screen of empty cork (measured 0.64 screens of it at 390) */
      /* the lift fades out over the board so the wall ENDS with the frame too: a constant lift left
         a screen and a half of empty cork after the last pile (second walk, 11 Sep) */
      /* 12 Sep, void scan: the start lift existed ONLY under 760, so every wider frame opened the
         wall on bare cork. Measured: 414px of it at 800 (first batten at y 875 of a 900 frame),
         306px at 1440, 282px at 1920. Every width lifts now, sized to its own band and fading
         over P exactly as the phone's does, so the tail still ends with the frame. 0.55 above
         1000 is the value that clears 1280, 1440 and 1920 together: 0.45 left 1440 short and
         0.62 opened a band at 1920. */
      var boardY=Math.round(Hh*0.5-P*Hh*TRAV-(W<=760?Hh*0.9*(1-P):(W<=1000?Hh*0.88*(1-P):Hh*0.55*(1-P)))+Math.sin(performance.now()/1000*0.7)*2.5);
      /* 10 Sep, measured with Chrome's own counters: this function ran on every frame
         the board was in view and restyled 127 var() readers each time, 360ms of style
         recalc per screen against 41ms for the cook. But everything below writes from
         three numbers: boardY (already rounded to the pixel), P, and the swing spring.
         If none of the three has moved, every write below would be the value already
         on the element, so the frame is skipped BEFORE it touches a style. The breath
         still breathes: boardY changes integer value a few times a second at most,
         and that is exactly as often as the screen could show it. */
      /* 0.08 degrees, not 0.01: the spring rings for dozens of frames after every scroll
         step and each ring wrote --sw to every pile, a full subtree restyle per frame for
         a change of a hundredth of a degree. On a 110px card 0.08 degrees is 0.15px. */
      var write=Math.abs(swing-lastSw)>0.08;
      if(boardY===lastBY && P===lastPP && !write && W===lastW && Hh===lastH) return;
      lastBY=boardY; lastPP=P; lastW=W; lastH=Hh;

      var cy0=boardY-Hh*0.5, wrap=cy0-Math.floor(cy0/TH)*TH;
      cork.style.setProperty('--corky',(wrap-TH).toFixed(1)+'px');
      gut.style.transform='translate3d(0,'+boardY+'px,0)';
      if(gRoute) gRoute.setAttribute('transform','translate(0,'+boardY+')');

      /* setting a custom property invalidates the pile's whole subtree, so the
         swing is written only when it actually changed. On a still page the
         spring is at rest and this writes nothing at all. The guarded value is
         identical either way, so no visible quantity switches. */
      if(write) lastSw=swing;
      /* 9 Sep: depth amplitude. A phone lost this board's depth three ways at once: the
         lateral spread is halved twice (--u at .5vw and ax*0.60 below), the 19 proudest
         props are culled, and the pack's keyline and cast shadow go with the pack under
         body.no3d. So it comes back on the one axis a 390px frame still has, the vertical.
         Desktop keeps its real spread and needs none of it. */
      var PZA=(W<=760)?0.055:0, PZCAP=Hh*0.155;

      for(i=0;i<GRP.length;i++){
        /* 11 Sep: on a phone the wall centres on the half left of the pack's lane, and spreads
           inside it, so the pack travels down a column of its own instead of over the cards */
        /* 12 Sep, Bazil: "I like this paper all over the place, a bit more like previous, it's ok
           for Vit's to pass through it". The wall takes the whole frame again and the pack rides
           over it; the reserved lane is gone. */
        g=GRP[i]; cx=(W<=760? W*0.47 : W*0.5)+g.ax*W*0.5*(W<=760?0.58:(W<=1000?0.66:1))   /* 7 Sep: 0.86 ran the right hand cards past a 390 frame */   /* 12 Sep, Bazil on an iPad: the wall read empty. Item offsets are vw across and vh down, so a 768x1024 frame spread them 47 per cent less across and 14 per cent more down: the collage became two thin columns at the edges with a cork hole in the middle. The piles come in off the edges here and the items spread wider inside them (site.css) */;
        var gy=boardY+g.t*Hh*TRAV;   /* 9 Sep: named, the depth write below reads it */
        g.el.style.transform='translate3d('+cx.toFixed(1)+'px,'+gy.toFixed(1)+'px,0)';
        if(g.rail) continue;
        /* nearness to the reading band, smootherstepped. UNQUANTISED on purpose:
           it drives a stroke-dashoffset on a ~400px path, and quantising that to
           twentieths draws the ring in twenty visible jerks, which the audit
           would read as twenty small cuts. It drives NOTHING ELSE: no group
           opacity and no group scale, because a pile is a box of nine
           overlapping children and grading it as a group forces an offscreen
           buffer every frame and flattens the overlap this concept is for. */
        f=sm5(1-Math.abs(P-g.t)/0.115);
        if(f!==g.f){ g.f=f; g.el.style.setProperty('--f',f.toFixed(4)); }
        /* 9 Sep: the depth. One custom property per pile per frame, on the SAME element
           the --f write above already invalidates, so this adds no new subtree work.
           Quantised to a tenth of a pixel and guarded, so a still page writes nothing.
           Clamped, or a pile far off screen would fling its proudest props across it. */
        if(PZA){
          /* 9 Sep: the hard clamp pinned every far pile to the same 84px, so the
             back third of the board went flat exactly where depth should read
             deepest. tanh keeps the near piles linear and eases the far ones into
             the ceiling instead of stacking them on it. */
          var pz=PZCAP*Math.tanh(-(gy-Hh*0.5)*PZA/PZCAP);
          pz=Math.round(pz*10)/10;
          if(pz!==g.pz){ g.pz=pz; g.el.style.setProperty('--pz',pz+'px'); }
        }
        if(write) g.el.style.setProperty('--sw',(swing*(0.72+i*0.05)).toFixed(3)+'deg');
      }

      /* the thread leads the reader by four and a half per cent of the run */
      if(route) route.style.strokeDashoffset=(rlen*(1-cl((P+0.045)/0.97))).toFixed(1);

      /* the pack stands in FRONT of the wall, so its contact shadow holds the
         centre with it and does not ride the board. The wall's own reserved patch
         (.bKey) is the thing that rides: two elements, two physics, because one
         element cannot both stay under the pack and travel with the cork. */
      if(packSh){
        var sb=window.__ph.storyBox;
        packSh.style.transform='translate3d(-47%,'+
          ((sb?-sb.y:0)*Hh*0.5+Hh*0.5-Hh*0.10).toFixed(1)+'px,0)';
      }
    }

    ScrollTrigger.create({trigger:board,start:'top top',end:'bottom bottom',
      onUpdate:function(self){ S=self.progress; P=pace(S); place(); },
      onRefresh:function(){ buildRoute(); place(); fitItems(); }});
    /* a measuring hook: the pane cannot screenshot a scrolled board, so a
       verifier parks the run at a pile's t and shoots it at scroll 0 */
    window.__board={set:function(s){ S=s; P=pace(S); place(); }};
    addEventListener('resize',function(){
      TRAV=innerWidth<=760?4.4:6.3; buildRoute(); place(); fitItems();
    });
    buildRoute(); place(); fitItems();
    /* one rAF, one rect read, gated on the board being in frame AND on something
       having actually moved. 10 Sep, measured with Chrome's own counters: this loop
       was calling place() on every single frame the board was on screen, and place()
       rewrites the custom properties that 127 rules in the stylesheet read through
       var(). The result was a full restyle of the board subtree 60 times a second,
       plus a SECOND one in the same frame whenever ScrollTrigger's onUpdate fired
       too. That is why story cost 360ms of style recalc against 41ms for cook while
       running only 1.4x as many recalcs: each one was six times more expensive.
       place() is a pure function of the scroll progress and the board's position, so
       if neither has changed there is nothing to place. Keyed to the integer pixel
       and 1/10000th of progress: fine enough that no movement is ever skipped, coarse
       enough that a still page costs nothing. */
    (function breathe(){ requestAnimationFrame(breathe);
      var r=board.getBoundingClientRect(); if(r.bottom>0&&r.top<innerHeight) place(); })();

    /* ---- the 3D pack holds the centre lane, UNCHANGED (4 Sep) ----
       .board .jLane is still left:34% width:32%, so storyBox.x still measures 0
       and the flight plan is untouched. The scale ceiling stays at 0.70: a board
       effect is not a reason to widen the spine's scale envelope. */
    var lane=board.querySelector('.jLane');
    function measureLane(){
      /* 11 Sep: __phoneBox went with the old flat phone route; the lane below is measured on
         every width now, and under 760 it is the right column the wall is kept out of. */
      if(!lane||!lane.offsetParent||!lane.getBoundingClientRect().width){ window.__ph.storyBox=null; return; }
      var r=lane.getBoundingClientRect(); if(!r.width){ window.__ph.storyBox=null; return; }
      window.__ph.storyBox={ x:((r.left+r.width*0.5)/innerWidth)*2-1, y:-0.04,
        s:Math.max(0.42,Math.min(innerWidth<=760?0.76:(innerWidth<=1000?0.56:0.70),(r.width/innerWidth)*2.3)) };   /* 11 Sep: on a phone the pack rides a 34% lane, so its scale is capped to it */
    }
    measureLane(); addEventListener('resize',measureLane);
    ScrollTrigger.create({trigger:board,start:'top bottom',end:'bottom top',onUpdate:measureLane,onRefresh:measureLane});
  })();

  /* ---------- scene 3: the pinned trade frame ---------- */
  (function(){
    var items=[].slice.call(document.querySelectorAll('#trade .tItem'));
    if(!items.length) return;
    var shots=[].slice.call(document.querySelectorAll('#trade .tShot'));
    var ticks=[].slice.call(document.querySelectorAll('#trade .tRail i'));
    var stepNo=document.querySelector('#trade .tStep b');
    var cur=-1;
    function set(i){
      if(i===cur) return; cur=i;
      items.forEach(function(el,j){ el.classList.toggle('act',j===i); });
      shots.forEach(function(el,j){ el.classList.toggle('act',j===i); });
      ticks.forEach(function(el,j){ el.classList.toggle('act',j<=i); });
      if(stepNo) stepNo.textContent=('0'+(i+1)).slice(-2);
    }
    var hover=-1;
    items.forEach(function(el,j){
      el.addEventListener('mouseenter',function(){ hover=j; blend(); });
      el.addEventListener('mouseleave',function(){ hover=-1; blend(); });
    });
    function blend(){
        var mid=innerHeight*0.5,best=0,bd=1e9;
        items.forEach(function(el,j){
          var r=el.getBoundingClientRect(),d=Math.abs(r.top+r.height/2-mid);
          if(d<bd){bd=d;best=j;}
          /* 4 Sep: the photograph and the line blend by how far the line is from
             the middle of the screen, scrubbed, instead of switching at a rail */
          var sg=(r.top+r.height/2-mid)/innerHeight, f=Math.abs(sg);
          /* incoming (below mid) arrives over 0.30 of a screen; outgoing (above) leaves
             over 0.18, so two photographs share the frame only briefly */
          var a=sg>=0 ? Math.max(0,1-Math.max(0,f-0.14)/0.30) : Math.max(0,1-Math.max(0,f-0.10)/0.18);
          if(hover>=0){ a=(j===hover)?1:0; best=hover; }   /* the pointer wins while it is on a line */
          else if(j===best) a=1;   /* the nearest line's photograph is always there: with every line far from mid the frame went black */
          if(shots[j]){ shots[j].style.transition='none'; shots[j].style.opacity=a.toFixed(3);
            shots[j].style.transform='translateY('+((1-a)*(sg>=0?4:-3)).toFixed(2)+'%) scale('+(1+0.04*(1-a)).toFixed(3)+')'; }
          el.style.transition='none'; el.style.opacity=(0.34+0.66*a).toFixed(3);
        });
        set(best);
    }
    blend();
    ScrollTrigger.create({trigger:'#trade',start:'top bottom',end:'bottom top',
      onUpdate:blend,onRefresh:blend});
  })();

  /* ---------- the export map ----------
     The basemap is an equirectangular crop: longitude is linear across the full
     width, and latitude is linear down it at the same degrees-per-pixel, from
     84N at the top edge. Those two numbers are all a pin needs to land on its
     own country at any width, so the markers are placed from real coordinates
     rather than from percentages someone eyeballed once. */
  (function(){
    var wrap=document.getElementById('mapPins');
    if(!wrap) return;
    var VB={w:1000,h:394};
    var PXDEG=1000/360;                 /* 2.778px per degree of longitude */
    var TOPLAT=84.0;                    /* the latitude the crop starts at */
    function xPct(lon){ return ((lon+180)/360)*100; }
    function yPct(lat){ return (((TOPLAT-lat)*PXDEG)/VB.h)*100; }

    var C=(window.VITS&&window.VITS.trade)||{};
    var home=C.mapHome||{name:"Kuala Lumpur",role:"HQ / Factory",lat:3.14,lon:101.7};
    var list=Array.isArray(C.mapMarkets)?C.mapMarkets:[];

    var card=document.createElement('div');
    card.className='mapCard';
    wrap.parentNode.appendChild(card);

    function show(pin,m){
      /* the date line is dropped rather than invented when the CMS has none */
      card.innerHTML='<b></b><i></i>'+(m.since?'<u></u>':'');
      card.querySelector('b').textContent=m.name||'';
      card.querySelector('i').textContent=m.role||'Export market';
      if(m.since) card.querySelector('u').textContent='Since '+m.since;
      card.style.left=pin.style.left;
      card.style.top='calc('+pin.style.top+' - 22px)';
      card.classList.add('on');
    }
    function hide(){ card.classList.remove('on'); }

    function addPin(m,isHome){
      var x=xPct(+m.lon), y=yPct(+m.lat);
      var pin=document.createElement('div');
      /* the label sits away from the map edge by default, but the far east
         is a cluster: Japan, Korea and China would stack their labels on the
         same side and read as one smear, so the data can name a side. */
      var side=(m.side==='left'||m.side==='right')?m.side:(x>62?'left':'right');
      pin.className='pin'+(isHome?' home':'')+(side==='left'?' left':'');
      pin.style.left=x+'%'; pin.style.top=y+'%';
      pin.innerHTML='<span class="dot"></span>'+
        (isHome
          ? '<span class="tag">'+esc(m.name)+'<em>'+esc(m.role||'')+'</em></span>'
          : '<span class="lbl">'+esc(m.name)+'</span>')+
        '<span class="hit" tabindex="0" role="button" aria-label="'+esc(m.name)+'"></span>';
      var hit=pin.querySelector('.hit');
      function on(){ pin.classList.add('on'); show(pin,m); }
      function off(){ pin.classList.remove('on'); hide(); }
      hit.addEventListener('mouseenter',on);
      hit.addEventListener('mouseleave',off);
      hit.addEventListener('focus',on);
      hit.addEventListener('blur',off);
      hit.addEventListener('click',function(){ pin.classList.contains('on')?off():on(); });
      wrap.appendChild(pin);
    }
    function esc(v){ return String(v==null?'':v).replace(/[&<>"]/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

    function build(){
      wrap.innerHTML='';
      var c=(window.VITS&&window.VITS.trade)||{};
      home=c.mapHome||home;
      list=Array.isArray(c.mapMarkets)?c.mapMarkets:list;
      list.forEach(function(m){ if(m&&m.name&&isFinite(+m.lat)&&isFinite(+m.lon)) addPin(m,false); });
      if(home&&isFinite(+home.lat)) addPin({name:home.name,role:home.role,lat:home.lat,lon:home.lon},true);
    }
    build();
    /* the CMS can rewrite the whole list, so rebuild when content lands */
    document.addEventListener('vits:content',build);
  })();

  /* the trade numbers count up once the beat arrives; a missed trigger leaves
     the real values standing because the text is only touched inside onEnter */
  (function(){
    var els=[].slice.call(document.querySelectorAll('.tstat b, .hpNum'));   /* 7 Sep: the hero proof strip counts up on arrival too */
    els.forEach(function(el){
      ScrollTrigger.create({trigger:el,start:'top 88%',once:true,onEnter:function(){
        var m=el.textContent.trim().match(/^(\d+)(.*)$/); if(!m) return;
        var n=+m[1], suf=m[2]||'';
        var o={v:n>1000?n-75:0};
        gsap.to(o,{v:n,duration:1.6,ease:'power3.out',onUpdate:function(){
          el.textContent=Math.round(o.v)+suf;
        }});
      }});
    });
  })();

  /* ---------- scene 4: the range specimens (4 Sep: a rail, not a deck) ----------
     r is the rail position in pack units (0..4), written by the runway. Every
     line of copy and every world photograph takes its opacity from its distance
     to r, so the change is scrubbed with the scroll and reverses under the
     hand; nothing toggles. The dots and the flat fallbacks still follow the
     nearest pack, which is a state, and the 3D rail reads the same channel. */
  (function(){
    var specs=[].slice.call(document.querySelectorAll('#range .spec'));
    var flats=[].slice.call(document.querySelectorAll('#range .specStage img.fallback'));
    var dots=[].slice.call(document.querySelectorAll('#range .dots i'));
    var photos=[].slice.call(document.querySelectorAll('#range .heritagePhoto'));
    var stage=document.querySelector('#range .stage');
    var worlds=['mini','penang','tomato','bayam','carbonara'];
    var cur=-1;
    function set(i){
      if(i===cur) return; cur=i;
      window.__ph.idx=i;
      flats.forEach(function(s,j){ s.classList.toggle('act',j===i); });
      dots.forEach(function(s,j){ s.classList.toggle('act',j===i); });
      if(stage) worlds.forEach(function(w,j){ stage.classList.toggle(w,j===i); });
    }
    function place(r){
      specs.forEach(function(s,i){
        var d=i-r, ad=Math.abs(d);
        /* the copy rides the rail with its pack: 60vw per pack unit, so the
           block leaving to the left is off the column before the next one is
           readable, and a blend never prints one line over another */
        /* the copy rides with its pack, up and out, in from below: 70vh per pack
           unit on a runway that gives 50vh per unit, so it leads the scroll a
           touch and never overprints the next block */
        /* 7 Sep, Bazil: states blended two at a time. Each block now HOLDS for most of
           its unit and hands over inside a short window, so one thing is on screen. */
        /* 9 Sep, Bazil, after walking the phone build frame by frame: this handover was
           the last hard cut on the page. A block held to |d|=0.40 then fell to zero over
           0.18 of a unit, which is 95px of scroll, and BOTH neighbours were part way
           through that window at the same time. Two things followed: the audit read a
           1.00 opacity jump inside one 120px step, and on screen the swap printed one
           headline and one pack over the other. The fade is longer now (0.28 of a unit,
           148px) and, more importantly, it is SEQUENTIAL: a block reaches zero exactly at
           the midpoint between two packs, which is the same instant its neighbour leaves
           zero. One card is legible at a time and nothing is ever double exposed. */
        var a=ad<0.12?1:Math.max(0,1-(ad-0.12)/0.38);
        s.style.transition='none'; s.style.opacity=a.toFixed(3);
        /* 10 Sep: on a phone the slot sits 220px under the copy, and a 70vh rail brought the next
           block's last line into the pack while it was still fading in ("Spinach in the noodle",
           cov 0.30 at 390x844). 42vh still takes the leaving block clear of the top. */
        /* 10 Sep, phones again: the copy block is about 330px tall and the flat pack sits 38px
           under it, so ANY downward offset on the arriving block put its last line into the
           pack while it faded in (cov 0.42 at 390x844, measured settled). On a phone the
           arriving block fades in where it will sit; only the leaving block travels, up. */
        /* 12 Sep: 761 to 1000 is stacked too, copy above dock, so the desktop rail drove the
           arriving block straight down into the pack: measured at 800x900 the active spec
           carried translateY(+150px) and its meta row sat 30px above the pack's top edge.
           The stacked branch is the whole stacked band, not just the phone. */
        var dy=(innerWidth<=1000)?Math.min(d,0)*42:d*70;
        s.style.transform='translateY('+dy.toFixed(2)+'vh)';   /* +d: the next block waits BELOW and rises, the last leaves off the top, the same way as its pack */
        s.style.pointerEvents=a>0.6?'auto':'none';
        s.classList.toggle('act',a>0.6);
      });
      photos.forEach(function(ph,i){
        var ad=Math.abs(i-r);
        ph.style.transition='none'; ph.style.opacity=(ad<0.12?0.72:Math.max(0,0.72*(1-(ad-0.12)/0.38))).toFixed(3);
      });
      set(Math.round(r));
    }
    place(0);
    ScrollTrigger.create({trigger:'#range',start:'top top',end:'bottom bottom',
      /* 11 Sep, phones: the section is 2.6 screens and its stage is 1, so the last third of the
         scroll is the stage LEAVING. Mapped straight, the fifth SKU (Carbonara) arrived while the
         stage was already sliding off the top: the reader met it as a squashed dark band. The rail
         now finishes inside the pinned part and the last pack holds while the stage leaves. */
      onUpdate:function(self){ var rp2=self.progress; window.__ph.rangeRaw=self.progress; if(innerWidth<=760) rp2=Math.min(1,rp2/0.78); window.__ph.range=rp2; place(rp2*4);
        /* each SKU sits on a fifth of the run: lift the one being read, so the rail moves */
        var b=rp2*4, seat=b-Math.floor(b);
        flat(document.querySelector('.specStage img.fallback.act'),
             'translateY('+(10-20*seat).toFixed(1)+'px) scale('+(0.98+0.04*seat).toFixed(3)+')'); },
      onToggle:function(self){ window.__ph.rangeOn=self.isActive; },
      onLeave:function(){ place(4); window.__ph.range=1; window.__ph.rangeRaw=1; },
      onLeaveBack:function(){ place(0); window.__ph.range=0; window.__ph.rangeRaw=0; }
    });
    /* the runway trigger ends a quarter of a section before the cook begins.
       This channel covers that run so the docked specimen can ride up with the
       page instead of vanishing on the frame the trigger closes. */
    ScrollTrigger.create({trigger:'#range',start:'bottom bottom',end:'+=100%',
      onUpdate:function(self){ window.__ph.rangePast=self.progress; },
      onLeave:function(){ window.__ph.rangePast=1; },
      onLeaveBack:function(){ window.__ph.rangePast=0; }
    });
  })();

  /* ---------- scene 5: the cook captions ---------- */
  (function(){
    var caps=[].slice.call(document.querySelectorAll('.ccap'));
    /* 4 Sep: each caption has a beat on the runway and rides through it with the
       scroll, rising in, holding, and lifting out, all by distance to the beat;
       the old five thresholds flipped them on and off. */
    /* 12 Sep: on a phone the first caption arrived a whole screen into the pin, so the frame
       under the bowl was empty cream for that stretch (588px of nothing, measured). It comes in
       with the pour there. */
    var BEATS=innerWidth<=760?[0.10,0.30,0.50,0.70,0.88]:[0.29,0.42,0.57,0.74,0.91];   /* 7 Sep: the first caption used to be covered by the rising bowl */   /* 12 Sep: 0.22 still sat inside the rise, which ends at 0.26 in pack3d, so "open the pack" was drawn behind the bowl at 1440. The first beat waits for the dish to stand. */
    /* 9 Sep, Bazil: "make vits scrollable in the mobile view". On a phone there is no 3D,
       so the cook pinned for about 2000px while the reader looked at a static list. The
       beats run there now, but they cannot move the captions OUT of the column the phone
       reads them in, so the phone branch lifts the passing step and sits its neighbours
       back instead of sliding them across the screen. Nothing is ever fully hidden: if
       this never ran, every caption stays legible at full strength. */
    var PHONE=coarse||innerWidth<=720;
    function ride(p){
      caps.forEach(function(c,i){
        var d=(p-BEATS[i])/0.14, ad=Math.abs(d);
        /* the runway is 300vh of travel, so 120px is 4.4% of progress; a 0.75 ramp
           keeps any single wheel tick under a 0.45 change in a caption */
        var a=Math.max(0,1-Math.max(0,ad-0.25)/0.75);
        c.style.transition='none';
        if(PHONE){
          c.style.opacity=(0.46+0.54*a).toFixed(3);   /* the floor stays legible: a step you have not reached yet is still readable copy, not decoration */
          c.style.transform='translateX('+(-d*6).toFixed(2)+'px)';
        } else {
          c.style.opacity=a.toFixed(3);
          c.style.transform='translate('+(-d*24).toFixed(2)+'vw,'+(-d*14).toFixed(1)+'px)';
        }
        c.classList.toggle('act',a>0.5);
      });
      if(PHONE&&ckPoster){
        /* the pack answers the beats: it rises and leans as the steps pass, so the pinned
           stage reads as one move rather than a still frame held for four screens */
        var e=p<0.5?p/0.5:1, f=p<0.5?0:(p-0.5)/0.5;
        ckPoster.style.transform='translateY('+(10-24*e).toFixed(1)+'px) rotate('+(-7*f).toFixed(2)+'deg) scale('+(1+0.05*e).toFixed(3)+')';
      }
    }
    var ckPoster=document.querySelector('.cookPoster img');
    /* the giant words slide sideways against the scroll, behind the bowl: the
       reference sites run a word behind the product this way */
    var ct=document.querySelector('#cook .cookType .l');
    /* 9 Sep: the sideways word ran on desktop only. On a phone it is the one piece of
       counter motion the cook scene has left, so it runs there too, at a shorter throw:
       16% of the phone line size reads as a jolt rather than as drift. */
    var CTX=coarse?9:16;
    if(ct) gsap.fromTo(ct,{xPercent:CTX},{xPercent:-CTX,ease:'none',immediateRender:false,
      scrollTrigger:{trigger:'#cook',start:'top bottom',end:'bottom top',scrub:SCRUB,invalidateOnRefresh:true}});
    ScrollTrigger.create({trigger:'#cook',start:'top top',end:'bottom bottom',
      onUpdate:function(self){ var p=self.progress; window.__ph.cook=p; ride(p); },
      onToggle:function(self){ window.__ph.cookOn=self.isActive; },
      onLeave:function(){ window.__ph.cook=1; ride(1); },
      onLeaveBack:function(){ window.__ph.cook=0; ride(0); }
    });
    /* the finished bowl used to vanish the instant the section released. This
       channel runs one screen past that point so the 3D stage can hold the dish
       for a beat and then carry it off the top with the scroll. */
    ScrollTrigger.create({trigger:'#cook',start:'bottom bottom',end:'+=100%',
      onUpdate:function(self){ window.__ph.cookPast=self.progress; },
      onLeave:function(){ window.__ph.cookPast=1; },
      onLeaveBack:function(){ window.__ph.cookPast=0; }
    });
  })();

  /* ---------- the hero's moving field (7 Sep) ----------
     Three ambient clips behind the pack, one player fading into the other every
     few seconds. Only on wide screens, never under reduced motion, and never
     before the loader has left: a clip that fails to load simply never shows and
     the photograph stays. */
  (function(){
    var vids=[].slice.call(document.querySelectorAll('.heroClip'));
    if(vids.length<2||innerWidth<=1000||matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    var clips=(vids[0].getAttribute('data-clips')||'').split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    if(!clips.length) return;
    var i=0, cur=0, timer=null;
    function load(v,src){ return new Promise(function(res,rej){
      v.oncanplay=function(){ v.oncanplay=null; res(); }; v.onerror=function(){ v.onerror=null; rej(); };
      v.src=src; v.load();
    }); }
    function next(){
      var v=vids[cur^1], src=clips[i%clips.length]; i++;
      load(v,src).then(function(){
        var p=v.play(); if(p&&p.catch) p.catch(function(){});
        v.classList.add('on'); vids[cur].classList.remove('on'); cur^=1;
        /* one picture at a time: the poster photograph steps out once a clip is live */
        v.parentElement.classList.add('playing');
        timer=setTimeout(next,5400);
      }).catch(function(){ timer=setTimeout(next,2000); });
    }
    /* 10 Sep: the cycle used to run for the whole visit, re-fetching a clip every 5.4s while the
       reader was twenty screens down (2,666 range requests logged in one session). It runs only
       while the hero is on screen; off screen the players pause and the timer stops. */
    var onScreen=true;
    function start(){ if(!timer&&onScreen&&!document.hidden) next(); }
    function stop(){ clearTimeout(timer); timer=null; vids.forEach(function(v){ try{ v.pause(); }catch(_){} }); }
    if(document.getElementById('vLoad')&&!document.getElementById('vLoad').hidden) document.addEventListener('vits:loaded',start,{once:true});
    else start();
    document.addEventListener('visibilitychange',function(){ if(document.hidden) stop(); else start(); });
    if('IntersectionObserver' in window){
      var hero=vids[0].closest('section')||vids[0].parentElement;
      new IntersectionObserver(function(es){ es.forEach(function(e){ onScreen=e.isIntersecting; if(onScreen) start(); else stop(); }); },{threshold:0.05}).observe(hero);
    }
  })();

  /* ---------- scene 6: the reel, chosen not scrubbed (7 Sep) ----------
     Five plates, five tabs. Hover or click lights a plate and carries the
     stage colour with it. Whenever any of the stage is on screen it turns
     itself over every 3.4s, reduced motion or not (a content change is not
     motion; the crossfade is what reduced motion removes in CSS). A click
     stops the cycle for good. */
  (function(){
    var stage=document.querySelector('#reel .stage');
    var plates=[].slice.call(document.querySelectorAll('#reel .reelFlav'));
    var tabs=[].slice.call(document.querySelectorAll('#reel .reelNames button'));
    if(!stage||!plates.length) return;
    var cur=-1,timer=null,touched=false;
    function show(i){
      if(i===cur) return; cur=i;
      plates.forEach(function(p,k){ p.classList.toggle('act',k===i); });
      tabs.forEach(function(t,k){
        t.classList.toggle('act',k===i);
        t.setAttribute('aria-selected',k===i?'true':'false');
        t.tabIndex=k===i?0:-1;
      });
      var bg=plates[i].getAttribute('data-bg'), ink=plates[i].getAttribute('data-ink'), em=plates[i].getAttribute('data-em');
      if(bg){ stage.style.backgroundColor=bg; stage.style.setProperty('--reelCol',bg); }
      stage.style.setProperty('--reelEm', em||'');
      stage.style.setProperty('--reelGlow', plates[i].getAttribute('data-glow')||'rgba(255,203,5,.3)');
      /* 8 Sep, Bazil: "improve backgrounds". A painted plate per flavour under the bowl, on two
         layers that swap, so one fades in over the other and nothing flashes. */
      (function(){
        var src=plates[i].getAttribute('data-bgimg'); if(!src) return;
        var L=stage.__bgL; if(!L){ L=stage.__bgL=[0,1].map(function(k){ var d=document.createElement('div'); d.className='reelBg'; d.setAttribute('aria-hidden','true'); stage.insertBefore(d,stage.firstChild); return d; }); L.cur=0; var sc=document.createElement('div'); sc.className='reelScrim'; sc.setAttribute('aria-hidden','true'); stage.insertBefore(sc,L[1].nextSibling); }
        var nxt=L[1-L.cur], cur=L[L.cur];
        if(cur.dataset.src===src){ cur.classList.add('on'); return; }
        nxt.style.backgroundImage='url("'+src+'")'; nxt.dataset.src=src;
        requestAnimationFrame(function(){ nxt.classList.add('on'); cur.classList.remove('on'); });
        L.cur=1-L.cur;
      })();   /* 7 Sep: a supporting ground behind the bowl, per flavour */   /* 7 Sep: the headline em and the active bar were red on the tomato red */
      if(ink) stage.style.color=ink;
    }
    function stop(){ if(timer){ clearInterval(timer); timer=null; } }
    function start(){ if(!touched&&!timer) timer=setInterval(function(){ show((cur+1)%plates.length); },3400); }
    /* 7 Sep, Bazil: "it needs to change as it's scrolled". On wide screens the
       section pins for five steps and the scroll picks the plate, in whole steps,
       never a blend. Narrow screens keep the timer. */
    /* 9 Sep: a phone measured reelPlate0 for all seven samples: 1105px of scroll
       that changed nothing, while a 3.4s timer swapped flavours against the
       reader's hand. The section pins on phones now too, so scroll picks the
       plate at every width and the timer only runs where nothing pins. */
    var SCRUB=!!window.ScrollTrigger&&innerWidth>760;   /* 10 Sep: phones play it, they do not scrub it */
    if(SCRUB){
      ScrollTrigger.create({trigger:'#reel',start:'top top',end:'bottom bottom',
        onUpdate:function(self){ var n=plates.length; show(Math.max(0,Math.min(n-1,Math.floor(self.progress*n*0.999)))); }});
    }
    tabs.forEach(function(t,k){
      t.addEventListener('click',function(){ touched=true; stop(); show(k); });
      t.addEventListener('mouseenter',function(){ show(k); });
      t.addEventListener('keydown',function(e){
        var n=null;
        if(e.key==='ArrowDown'||e.key==='ArrowRight') n=(k+1)%tabs.length;
        if(e.key==='ArrowUp'||e.key==='ArrowLeft') n=(k-1+tabs.length)%tabs.length;
        if(e.key==='Home') n=0;
        if(e.key==='End') n=tabs.length-1;
        if(n!=null){ e.preventDefault(); touched=true; stop(); show(n); tabs[n].focus(); }
      });
    });
    show(0);
    if(!SCRUB){
      if(window.IntersectionObserver){
        new IntersectionObserver(function(en){ if(en[0].isIntersecting) start(); else stop(); },{threshold:.15}).observe(stage);
      } else start();
    }
  })();

  /* ---------- scene 6b: the bowl, turned (4 Sep, restored as an extra) ----------
     The bowl video scrubbed by scroll, eased on rAF with a scroll-driven fallback when
     rAF goes quiet. The decoder is primed at load so the first frame never stalls. */
  (function(){
    var v=document.getElementById('turnVid');
    if(!v) return;
    var ticks=[].slice.call(document.querySelectorAll('.turnRail i'));
    var target=0,cur=0,lastTick=0;
    function dur(){ return (v.duration&&isFinite(v.duration))?v.duration:0; }
    function seek(p){
      var d=dur(); if(!d) return;
      var want=p*(d-0.06);
      if(Math.abs(v.currentTime-want)>0.008){ try{ v.currentTime=want; }catch(e){} }
      if(ticks.length){
        var i=Math.min(ticks.length-1,Math.floor(p*ticks.length));
        for(var j=0;j<ticks.length;j++) ticks[j].classList.toggle('act',j===i);
      }
    }
    v.pause();
    function prime(){ if(v.__primed||v.readyState<2) return; v.__primed=true; try{ v.currentTime=0.02; }catch(e){} }
    v.addEventListener('loadeddata',prime); v.addEventListener('canplay',prime); prime();
    /* 10 Sep: 6.5 MB of video was preload="auto" on every visit, for a scene near the end of the
       page. It now loads once the section is within a screen and a half of the fold. */
    if('IntersectionObserver' in window){
      var sec=document.getElementById('turn')||v;
      var io=new IntersectionObserver(function(en){ if(en[0].isIntersecting){ v.preload='auto'; try{ v.load(); }catch(e){} io.disconnect(); } },{rootMargin:'150% 0px'});
      io.observe(sec);
    } else { v.preload='auto'; v.load(); }
    /* 11 Sep, Bazil: "why isn't this working". On a phone the section is unpinned (auto height),
       so its scrub range is a few hundred pixels and the bowl barely moved: the reader met a
       still. Phones PLAY it, on loop, while it is on screen; the scrub is a wide-frame idea. */
    if(innerWidth<=900){   /* 12 Sep: the whole stacked band plays it; only wide frames scrub */
      v.loop=true; v.muted=true; v.setAttribute('playsinline','');
      var playing=false;
      var run=function(on){ if(on===playing) return; playing=on; if(on){ var pr=v.play(); if(pr&&pr.catch) pr.catch(function(){}); } else v.pause(); };
      if('IntersectionObserver' in window){
        new IntersectionObserver(function(en){ run(en[0].isIntersecting&&!document.hidden); },{threshold:0.2}).observe(document.getElementById('turn')||v);
      } else run(true);
      document.addEventListener('visibilitychange',function(){ if(document.hidden) run(false); });
      return;
    }
    ScrollTrigger.create({trigger:'#turn',start:'top top',end:'bottom bottom',
      onUpdate:function(self){ target=self.progress; if(performance.now()-lastTick>250){ cur=target; seek(cur); } }});
    (function tick(){
      requestAnimationFrame(tick);
      lastTick=performance.now();
      if(!dur()) return;
      cur+=(target-cur)*0.14;
      seek(cur);
    })();
  })();

  addEventListener('load',function(){ ScrollTrigger.refresh(); });
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(function(){ ScrollTrigger.refresh(); });
  document.addEventListener('vits:content',function(){ ScrollTrigger.refresh(); });
})();

/* ---------- the phone on the wall (7 Sep) ----------
   Three clips as a story. It plays only while the board is on screen (an
   IntersectionObserver, not a scroll listener), advances on `ended`, fills the
   progress segment from timeupdate (a few writes a second, never per frame),
   and never starts under reduced motion: the first frame stands as a still. */
(function(){
  var ph=document.querySelector('.bPhone'); if(!ph) return;
  var v=ph.querySelector('.phVid'), bars=[].slice.call(ph.querySelectorAll('.phBars b'));
  var clips=(ph.getAttribute('data-clips')||'').split(',').filter(Boolean); if(!clips.length||!v) return;
  var RM=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches);
  var i=0, on=false;
  function load(k){ i=k%clips.length; v.src=clips[i]; bars.forEach(function(b,j){ b.classList.toggle('done',j<i); b.style.setProperty('--p',0); }); }
  function play(){ if(RM) return; var p=v.play(); if(p&&p.catch) p.catch(function(){}); }
  v.addEventListener('ended',function(){ load(i+1); if(on) play(); });
  v.addEventListener('timeupdate',function(){ if(v.duration&&bars[i]) bars[i].style.setProperty('--p',(v.currentTime/v.duration).toFixed(3)); });
  v.addEventListener('error',function(){ load(i+1); if(on) play(); });
  load(0); v.load();
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(es){ es.forEach(function(e){ on=e.isIntersecting; if(on) play(); else v.pause(); }); },{threshold:0.15}).observe(ph);
  } else { on=true; play(); }
  document.addEventListener('visibilitychange',function(){ if(document.hidden) v.pause(); else if(on) play(); });
})();

/* ---------- the enquiry form's sent state (7 Sep) ----------
   A demo form whose submit did nothing visible reads as broken. It now confirms in place. */
(function(){
  var f=document.querySelector('.fform'); if(!f) return;
  /* 10 Sep: a trade desk cannot reply to a form with no email, and "Sent" used to fire on an empty
     sheet. Name, company, market and a working email are required; the browser's own validity
     checks run first and the message line says what is missing. data-endpoint, when set, gets
     the entry as JSON; empty, this is the demo and the sent state is just the button. */
  var msg=f.querySelector('.fmsg');
  function say(k,fallback){ var c=(window.__content&&window.__content.finale&&window.__content.finale.form)||{}; if(msg) msg.textContent=c[k]||fallback; }
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var b=f.querySelector('button[type=submit]'); if(!b) return;
    if(!f.checkValidity()){
      say('invalid','Name, company, market and a working email, then it goes.');
      var bad=f.querySelector(':invalid'); if(bad&&bad.focus) bad.focus();
      f.classList.add('shake'); setTimeout(function(){ f.classList.remove('shake'); },600);
      return;
    }
    if(msg) msg.textContent='';
    var done=function(){ b.textContent=((window.__content||{}).finale||{}).form&&window.__content.finale.form.sentLine||'Sent. We reply within one business day.'; b.disabled=true; b.classList.add('sent'); };
    var ep=f.getAttribute('data-endpoint');
    if(ep){
      var data={}; [].forEach.call(f.elements,function(el){ if(el.name) data[el.name]=el.value; });
      b.disabled=true;
      fetch(ep,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(data)})
        .then(function(r){ if(!r.ok) throw new Error(r.status); done(); })
        .catch(function(){ b.disabled=false; say('failLine','It did not send. Email the trade desk instead.'); });
    } else done();
  });
})();

/* ---------- the line as steps, the checks as moving marks (7 Sep) ----------
   Bazil: "show like a process flow, maybe do like steps", "add icons for each", and for the
   buyer checks "animated visuals, not yellow lines". Icons are inline SVG so their parts can
   move; every animation is transform only and runs on the compositor. */
(function(){
  var ST=[
    '<path d="M4 20h24M4 24h24"/><circle cx="10" cy="14" r="3"/><circle cx="18" cy="14" r="3"/><circle cx="26" cy="14" r="3"/>',
    '<path d="M6 18c0 6 4.5 10 10 10s10-4 10-10z"/><path class="stm" d="M12 12c0-3 2-3 2-6M18 12c0-3 2-3 2-6"/>',
    '<path d="M6 24h20M16 8v14"/><path d="M8 14l8-6 8 6"/><path class="pan" d="M4 14h8l-4 6zM20 14h8l-4 6z"/>',
    '<path d="M4 22h18v-10H4zM22 16h6l2 4v2h-8"/><circle cx="9" cy="25" r="2.2"/><circle cx="25" cy="25" r="2.2"/>',
    '<circle cx="16" cy="16" r="11"/><path d="M5 16h22M16 5c-4 4-4 18 0 22M16 5c4 4 4 18 0 22"/>'
  ];
  var st=document.querySelectorAll('.tLine .tStation .tSt');
  st.forEach(function(el,i){
    if(el.querySelector('.tStIco')) return;
    var s=document.createElementNS('http://www.w3.org/2000/svg','svg');
    s.setAttribute('class','tStIco'); s.setAttribute('viewBox','0 0 32 32'); s.setAttribute('aria-hidden','true');
    s.innerHTML=ST[i%ST.length]; el.insertBefore(s, el.querySelector('span'));
  });
  var CK=[
    '<g class="ckA"><rect x="3" y="9" width="11" height="14" rx="2"/></g><g class="ckB"><rect x="12" y="6" width="8" height="20" rx="2"/></g><g class="ckC"><path d="M22 10h7l-1 13h-5z"/></g>',
    '<circle cx="16" cy="16" r="12"/><path class="ckHand" d="M16 16V8"/><path d="M16 16l5 3"/>',
    '<circle class="ckRing" cx="16" cy="16" r="12"/><circle cx="16" cy="16" r="8"/><path d="M12 16l3 3 5-6"/>',
    '<g class="ckTag"><path d="M6 6h11l9 9-11 11-9-9z"/><circle cx="11" cy="11" r="1.6"/></g>'
  ];
  var ck=document.querySelectorAll('.tSheet .tItem');
  ck.forEach(function(el,i){
    if(el.querySelector('.ckIco')) return;
    var s=document.createElementNS('http://www.w3.org/2000/svg','svg');
    s.setAttribute('class','ckIco ck'+i); s.setAttribute('viewBox','0 0 32 32'); s.setAttribute('aria-hidden','true');
    s.innerHTML=CK[i%CK.length]; el.insertBefore(s, el.firstChild);
  });
})();

/* ---------- flags on the show rows (7 Sep) ---------- */
(function(){
  var F=[['circuit','🌏'],['Dubai','🇦🇪'],['Gulfood','🇦🇪'],['United States','🇺🇸'],['Bangkok','🇹🇭'],['Thailand','🇹🇭'],['United Kingdom','🇬🇧'],['London','🇬🇧'],['Chicago','🇺🇸']];
  document.querySelectorAll('.show .w').forEach(function(w){
    if(w.querySelector('.flag')) return;
    var txt=w.textContent||'', hit=F.filter(function(f){return txt.indexOf(f[0])>-1})[0]; if(!hit) return;
    var s=document.createElement('span'); s.className='flag'; s.setAttribute('aria-hidden','true'); s.textContent=hit[1]; w.insertBefore(s,w.firstChild);
  });
})();
/* 8 Sep, Bazil: "grey out 3D Packs and need password vit321 to enter". The link stays in the
   nav, greyed; a click asks for the password and only the right one opens the page. The page
   itself checks the same word, so the address bar is no shortcut. */
(function(){
  document.querySelectorAll('a.gated[data-gate]').forEach(function(a){
    a.addEventListener('click',function(e){
      e.preventDefault();
      var want=a.getAttribute('data-gate')||'';
      var got=window.prompt('3D Packs is a private preview. Password:');
      if(got==null) return;
      if(got.trim()===want){ try{ sessionStorage.setItem('vits3d','ok'); }catch(_){} location.href=a.getAttribute('href'); }
      else{ a.classList.add('shake'); setTimeout(function(){ a.classList.remove('shake'); },600); }
    });
  });
})();
