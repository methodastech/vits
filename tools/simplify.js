/* Quadric-error edge collapse, run directly on the source mesh.
   No clustering pre-pass: clustering merges vertices that are near each other
   but not connected, which welds the front and back walls of a pack together and
   tears holes. Measured at 18% holes on a source that is watertight. An edge
   collapse can only merge two vertices that already share an edge, so a closed
   surface stays closed by construction.
   Uses a binary heap with lazy deletion, so cost is n log n overall rather than
   a full re-sort per pass. */

function heapPush(h,x){ h.push(x); let i=h.length-1;
  while(i>0){ const p=(i-1)>>1; if(h[p].c<=h[i].c) break; const t=h[p]; h[p]=h[i]; h[i]=t; i=p; } }
function heapPop(h){ const top=h[0], last=h.pop();
  if(h.length){ h[0]=last; let i=0;
    for(;;){ const l=2*i+1,r=l+1; let m=i;
      if(l<h.length&&h[l].c<h[m].c) m=l;
      if(r<h.length&&h[r].c<h[m].c) m=r;
      if(m===i) break; const t=h[m]; h[m]=h[i]; h[i]=t; i=m; } }
  return top; }

function simplify(pos,uv,idx,targetTris,log,skipUV){
  /* ---- weld by position: the exporter splits vertices at UV seams, which would
     otherwise look like holes and stop the collapse dead ---- */
  const q=v=>Math.round(v*1e5)/1e5;
  const key=new Map(), remap=new Int32Array(pos.length/3), PX=[],PY=[],PZ=[];
  for(let i=0;i<pos.length/3;i++){
    const k=q(pos[i*3])+','+q(pos[i*3+1])+','+q(pos[i*3+2]);
    let r=key.get(k);
    if(r===undefined){ r=PX.length; key.set(k,r); PX.push(pos[i*3]); PY.push(pos[i*3+1]); PZ.push(pos[i*3+2]); }
    remap[i]=r;
  }
  const nv=PX.length;
  const fv=[], fuv=[];
  for(let t=0;t<idx.length;t+=3){
    const a=remap[idx[t]],b=remap[idx[t+1]],c=remap[idx[t+2]];
    if(a===b||b===c||a===c) continue;
    fv.push(a,b,c);
    fuv.push(uv[idx[t]*2],uv[idx[t]*2+1],uv[idx[t+1]*2],uv[idx[t+1]*2+1],uv[idx[t+2]*2],uv[idx[t+2]*2+1]);
  }
  let nf=fv.length/3;
  const dead=new Uint8Array(nf);
  if(log) log('welded : '+nv.toLocaleString()+' verts, '+nf.toLocaleString()+' tris');

  /* ---- adjacency ---- */
  const vf=Array.from({length:nv},()=>[]);
  for(let f=0;f<nf;f++) for(let e=0;e<3;e++) vf[fv[f*3+e]].push(f);

  /* ---- quadrics ---- */
  const Q=new Float64Array(nv*10);
  function facePlane(f){
    const a=fv[f*3],b=fv[f*3+1],c=fv[f*3+2];
    const ux=PX[b]-PX[a],uy=PY[b]-PY[a],uz=PZ[b]-PZ[a];
    const wx=PX[c]-PX[a],wy=PY[c]-PY[a],wz=PZ[c]-PZ[a];
    let nx=uy*wz-uz*wy, ny=uz*wx-ux*wz, nz=ux*wy-uy*wx;
    const L=Math.hypot(nx,ny,nz); if(L<1e-14) return null;
    nx/=L; ny/=L; nz/=L;
    return [nx,ny,nz,-(nx*PX[a]+ny*PY[a]+nz*PZ[a])];
  }
  for(let f=0;f<nf;f++){
    const p=facePlane(f); if(!p) continue;
    const [a,b,c,d]=p;
    for(let e=0;e<3;e++){ const o=fv[f*3+e]*10;
      Q[o]+=a*a; Q[o+1]+=a*b; Q[o+2]+=a*c; Q[o+3]+=a*d;
      Q[o+4]+=b*b; Q[o+5]+=b*c; Q[o+6]+=b*d;
      Q[o+7]+=c*c; Q[o+8]+=c*d; Q[o+9]+=d*d; }
  }

  /* ---- pin UV seams: collapsing across one drags the artwork over the seam.
     Only when the caller is keeping the source parameterisation. When it is
     baking a fresh atlas the seams are meaningless, and pinning them is
     actively harmful: the spinach pack has 212k of them, and constraining that
     many edges forced the collapse into degenerate folds -- 7,693 non-manifold
     edges out of a source with 1. ---- */
  const seam=new Set(), eu=new Map();
  for(let f=0;f<nf;f++) for(let e=0;e<3;e++){
    const a=fv[f*3+e], b=fv[f*3+(e+1)%3];
    const k=a<b?a*nv+b:b*nv+a;
    if(skipUV){ eu.set(k,1); continue; }          /* edge set only */
    const p1=Math.round(fuv[f*6+e*2]*4096)+','+Math.round(fuv[f*6+e*2+1]*4096);
    const p2=Math.round(fuv[f*6+((e+1)%3)*2]*4096)+','+Math.round(fuv[f*6+((e+1)%3)*2+1]*4096);
    const fwd=p1+'|'+p2, rev=p2+'|'+p1;
    const prev=eu.get(k);
    if(prev===undefined) eu.set(k,fwd);
    else if(prev!==fwd&&prev!==rev) seam.add(k);
  }
  if(log) log('seams  : '+seam.size.toLocaleString()+' pinned edges');

  /* UVs live per CORNER (fuv), not per vertex. A vertex on a seam has one
     coordinate per island it borders; caching one per welded vertex keeps
     whichever corner is seen first and hands every triangle on the other
     side of the seam the wrong island - the artwork drags across before a
     single edge has collapsed. Corners are updated through collapses and
     the output splits vertices by UV, which is what the GPU needs anyway. */
  const ver=new Int32Array(nv);           /* bumped on change, for lazy deletion */
  const alive=new Uint8Array(nv).fill(1);
  /* evaluated at the two endpoints only: a half-edge collapse keeps the
     survivor exactly where it was, so its corner UVs stay honest. A midpoint
     collapse moves the vertex under corners that keep endpoint UVs, dragging
     the artwork half an edge per collapse - measured as blotch. */
  function evalQ(g,x,y,z){
    return Math.abs(g(0)*x*x + 2*g(1)*x*y + 2*g(2)*x*z + 2*g(3)*x
      + g(4)*y*y + 2*g(5)*y*z + 2*g(6)*y
      + g(7)*z*z + 2*g(8)*z + g(9));
  }
  function cost(a,b){
    const oa=a*10, ob=b*10;
    const g=i=>Q[oa+i]+Q[ob+i];
    const ca=evalQ(g,PX[a],PY[a],PZ[a]);
    const cb=evalQ(g,PX[b],PY[b],PZ[b]);
    /* keep=1 collapses b into a; keep=0 the reverse */
    return ca<=cb ? {c:ca,keep:1} : {c:cb,keep:0};
  }
  const heap=[];
  for(const k of eu.keys()){
    if(seam.has(k)) continue;
    const a=Math.floor(k/nv), b=k%nv;
    const r=cost(a,b);
    heapPush(heap,{a,b,c:r.c,va:ver[a],vb:ver[b]});
  }
  if(log) log('heap   : '+heap.length.toLocaleString()+' candidate edges');

  /* The link condition. Collapsing an edge is only topologically safe when the
     one-ring neighbourhoods of its two endpoints meet in exactly the vertices
     opposite that edge. Skip the test and the surface quietly folds onto
     itself: measured on the spinach pack, 7,789 non-manifold edges out of a
     source that had 1. The tomato pack tolerated it, which is why this went
     unnoticed. */
  function linkOK(a,b){
    const na=new Set(), nb=new Set(), opp=new Set();
    for(const f of vf[a]){ if(dead[f]) continue;
      const v0=fv[f*3],v1=fv[f*3+1],v2=fv[f*3+2];
      if(v0!==a&&v1!==a&&v2!==a) continue;
      for(const v of [v0,v1,v2]) if(v!==a) na.add(v);
      if(v0===b||v1===b||v2===b) for(const v of [v0,v1,v2]) if(v!==a&&v!==b) opp.add(v);
    }
    for(const f of vf[b]){ if(dead[f]) continue;
      const v0=fv[f*3],v1=fv[f*3+1],v2=fv[f*3+2];
      if(v0!==b&&v1!==b&&v2!==b) continue;
      for(const v of [v0,v1,v2]) if(v!==b) nb.add(v);
    }
    let shared=0;
    for(const v of na){
      if(v===b) continue;
      if(nb.has(v)){ if(!opp.has(v)) return false; shared++; }
    }
    return shared===opp.size;
  }

  function flips(a,b,nx,ny,nz){
    for(const f of vf[a]){
      if(dead[f]) continue;
      const v0=fv[f*3],v1=fv[f*3+1],v2=fv[f*3+2];
      if(v0===b||v1===b||v2===b) continue;      /* dies in the collapse */
      const before=facePlane(f); if(!before) continue;
      const gx=i=>(i===a?nx:PX[i]), gy=i=>(i===a?ny:PY[i]), gz=i=>(i===a?nz:PZ[i]);
      const ux=gx(v1)-gx(v0),uy=gy(v1)-gy(v0),uz=gz(v1)-gz(v0);
      const wx=gx(v2)-gx(v0),wy=gy(v2)-gy(v0),wz=gz(v2)-gz(v0);
      let mx=uy*wz-uz*wy,my=uz*wx-ux*wz,mz=ux*wy-uy*wx;
      const L=Math.hypot(mx,my,mz); if(L<1e-14) return true;
      if((mx/L)*before[0]+(my/L)*before[1]+(mz/L)*before[2] < 0.1) return true;
    }
    return false;
  }

  /* When the heap drains, every entry left was stale or blocked. Rebuild it
     from the edges that actually survive and carry on; without this the collapse
     stops well short of the target. */
  function reseed(){
    heap.length=0;
    const seen2=new Set();
    for(let f=0;f<nf;f++){ if(dead[f]) continue;
      for(let e=0;e<3;e++){
        const a=fv[f*3+e], b=fv[f*3+(e+1)%3];
        if(a===b) continue;
        const k=a<b?a*nv+b:b*nv+a;
        if(seen2.has(k)||seam.has(k)) continue;
        seen2.add(k);
        const r=cost(a,b);
        heapPush(heap,{a,b,c:r.c,va:ver[a],vb:ver[b]});
      } }
    return heap.length;
  }
  let live=nf, guard=0, reseeds=0;
  while(live>targetTris && guard++ < 40e6){
    if(!heap.length){
      if(reseeds++>=6 || !reseed()) break;
      if(log) log('reseed : '+heap.length.toLocaleString()+' edges at '+live.toLocaleString()+' tris');
    }
    const e=heapPop(heap);
    const {a,b}=e;
    if(!alive[a]||!alive[b]) continue;
    if(ver[a]!==e.va||ver[b]!==e.vb) continue;      /* stale */
    const k=a<b?a*nv+b:b*nv+a;
    if(seam.has(k)) continue;
    const r0=cost(a,b);
    const A=r0.keep?a:b, B=r0.keep?b:a;   /* B collapses into A; A stays put */
    if(!linkOK(A,B)) continue;
    if(flips(B,A,PX[A],PY[A],PZ[A])) continue;
    const a2=A, b2=B;
    {
    const a=a2, b=b2;   /* shadow: the rest of the loop body reads a and b */
    /* collapse b into a: a keeps its position, so every corner UV already
       on a stays correct by construction */
    /* wedge remap: the faces that DIE in this collapse contain both a and b,
       one corner each, in the same UV island - they are the bridges between
       b's parameterisation and a's. For every island b touches, a dying face
       supplies (b's uv there -> a's uv there). Surviving corners on b pick
       the bridge nearest their own uv, so each island maps within itself and
       the artwork never crosses a seam. */
    if(!skipUV){
      const bridges=[];
      for(const f of vf[b]){
        if(dead[f]) continue;
        const v0=fv[f*3],v1=fv[f*3+1],v2=fv[f*3+2];
        if(v0!==a&&v1!==a&&v2!==a) continue;   /* survivor, not a bridge */
        let bu=0,bv2=0,au=0,av=0,hasB=false,hasA=false;
        for(let e2=0;e2<3;e2++){
          if(fv[f*3+e2]===b){ bu=fuv[f*6+e2*2]; bv2=fuv[f*6+e2*2+1]; hasB=true; }
          if(fv[f*3+e2]===a){ au=fuv[f*6+e2*2]; av=fuv[f*6+e2*2+1]; hasA=true; }
        }
        if(hasA&&hasB) bridges.push([bu,bv2,au,av]);
      }
      if(bridges.length){
        for(const f of vf[b]){
          if(dead[f]) continue;
          const v0=fv[f*3],v1=fv[f*3+1],v2=fv[f*3+2];
          if(v0===a||v1===a||v2===a) continue;   /* dies below */
          for(let e2=0;e2<3;e2++) if(fv[f*3+e2]===b){
            const u=fuv[f*6+e2*2], w=fuv[f*6+e2*2+1];
            let best=bridges[0], bd=1e9;
            for(const br of bridges){
              const d=(br[0]-u)*(br[0]-u)+(br[1]-w)*(br[1]-w);
              if(d<bd){ bd=d; best=br; }
            }
            fuv[f*6+e2*2]=best[2]; fuv[f*6+e2*2+1]=best[3];
          }
        }
      }
    }
    for(let i=0;i<10;i++) Q[a*10+i]+=Q[b*10+i];
    for(const f of vf[b]){
      if(dead[f]) continue;
      const v0=fv[f*3],v1=fv[f*3+1],v2=fv[f*3+2];
      if(v0===a||v1===a||v2===a){ dead[f]=1; live--; continue; }
      for(let e2=0;e2<3;e2++) if(fv[f*3+e2]===b) fv[f*3+e2]=a;
      vf[a].push(f);
    }
    alive[b]=0; ver[a]++; ver[b]++;
    /* re-price the edges around a */
    const nbr=new Set();
    for(const f of vf[a]){ if(dead[f]) continue;
      for(let e2=0;e2<3;e2++){ const v=fv[f*3+e2]; if(v!==a&&alive[v]) nbr.add(v); } }
    for(const v of nbr){
      const kk=a<v?a*nv+v:v*nv+a;
      if(seam.has(kk)) continue;
      const rr=cost(a,v);
      heapPush(heap,{a,b:v,c:rr.c,va:ver[a],vb:ver[v]});
    }
    }
  }
  if(log) log('collapsed to '+live.toLocaleString()+' tris');

  if(skipUV){
    /* the caller is baking a fresh atlas, so the source parameterisation is
       not needed. Emit positions and topology only. */
    const oP=[],oI=[],mm=new Map();
    for(let f=0;f<nf;f++){ if(dead[f]) continue;
      for(let e=0;e<3;e++){ const v=fv[f*3+e];
        let id=mm.get(v);
        if(id===undefined){ id=oP.length/3; mm.set(v,id); oP.push(PX[v],PY[v],PZ[v]); }
        oI.push(id); } }
    if(log) log(`geom   : ${(oP.length/3).toLocaleString()} verts`);
    return {positions:oP,uvs:null,indices:oI};
  }

  /* split output vertices on (vertex, uv): corners from different islands get
     different output vertices, so seams stay seams. Quantised so corners that
     differ only by float noise still weld. */
  const outPos=[],outUV=[],outIdx=[],m=new Map();
  for(let f=0;f<nf;f++){
    if(dead[f]) continue;
    for(let e=0;e<3;e++){
      const v=fv[f*3+e];
      const u=fuv[f*6+e*2], w=fuv[f*6+e*2+1];
      const k=v+'_'+Math.round(u*8192)+'_'+Math.round(w*8192);
      let id=m.get(k);
      if(id===undefined){ id=outPos.length/3; m.set(k,id);
        outPos.push(PX[v],PY[v],PZ[v]); outUV.push(u,w); }
      outIdx.push(id);
    }
  }
  if(log) log('uv     : per-corner, '+(outPos.length/3).toLocaleString()+' verts');
  return {positions:outPos,uvs:outUV,indices:outIdx};
}
module.exports={simplify};
