/* Close the holes a decimation pass tears open.

   Clustering welds vertices that are near each other but not connected, so the
   front and back walls of a pack fuse and the surface rips. The rips are real
   boundary: on a closed mesh every edge is shared by exactly two triangles, so
   an edge used once is a hole.

   This finds those edges, walks them into closed loops, and fans each loop to a
   centroid vertex. The centroid takes the average position, normal and UV of the
   loop it closes, so the patch picks up the artwork around the tear rather than
   showing as a flat plate.

   Runs on the finished GLB, so it composes with whatever produced it.

     node tools/hole-fill.js <in.glb> <out.glb>
*/
const fs=require('fs');
const SRC=process.argv[2], OUT=process.argv[3];
if(!SRC||!OUT){ console.error('usage: node tools/hole-fill.js <in.glb> <out.glb>'); process.exit(1); }

const buf=fs.readFileSync(SRC);
const jl=buf.readUInt32LE(12);
const J=JSON.parse(buf.slice(20,20+jl).toString('utf8'));
const BIN=buf.slice(20+jl+8);
const CT={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}, NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
function readAcc(i){
  const a=J.accessors[i], bv=J.bufferViews[a.bufferView];
  const sz=CT[a.componentType], n=NC[a.type];
  const start=(bv.byteOffset||0)+(a.byteOffset||0), stride=bv.byteStride||sz*n;
  const out=new (a.componentType===5126?Float32Array:Uint32Array)(a.count*n);
  for(let e=0;e<a.count;e++){ const o=start+e*stride;
    for(let c=0;c<n;c++){ const p=o+c*sz;
      out[e*n+c]= a.componentType===5126?BIN.readFloatLE(p)
                : a.componentType===5125?BIN.readUInt32LE(p)
                : a.componentType===5123?BIN.readUInt16LE(p) : BIN.readUInt8(p); } }
  return out;
}
const prim=J.meshes[0].primitives[0];
const POS=Array.from(readAcc(prim.attributes.POSITION));
const NOR=Array.from(readAcc(prim.attributes.NORMAL));
const UV =Array.from(readAcc(prim.attributes.TEXCOORD_0));
const IDX=Array.from(readAcc(prim.indices));
/* carry whatever the source material is: some models are textured, others are a
   flat baseColorFactor with no image at all */
const srcMat=(J.materials&&J.materials[prim.material!==undefined?prim.material:0])||{};
const srcPbr=srcMat.pbrMetallicRoughness||{};
const hasTex=!!(J.images&&J.images.length&&srcPbr.baseColorTexture);
let TEX=null, texMime='image/jpeg';
if(hasTex){
  const ti=srcPbr.baseColorTexture.index;
  const im=J.images[(J.textures&&J.textures[ti]&&J.textures[ti].source)||0];
  texMime=im.mimeType||'image/jpeg';
  const tv=J.bufferViews[im.bufferView];
  TEX=BIN.slice(tv.byteOffset||0,(tv.byteOffset||0)+tv.byteLength);
}
const nv0=POS.length/3, nt0=IDX.length/3;
console.log('in  : '+nt0.toLocaleString()+' tris, '+nv0.toLocaleString()+' verts');

/* weld by position so UV seams are not mistaken for holes */
const q=v=>Math.round(v*1e5)/1e5;
const key=new Map(), remap=new Int32Array(nv0), rep=[];
for(let i=0;i<nv0;i++){
  const k=q(POS[i*3])+','+q(POS[i*3+1])+','+q(POS[i*3+2]);
  let r=key.get(k);
  if(r===undefined){ r=rep.length; key.set(k,r); rep.push(i); }
  remap[i]=r;
}

/* directed edges: a boundary edge is one whose reverse never appears */
const dir=new Set();
for(let t=0;t<IDX.length;t+=3){
  const a=remap[IDX[t]],b=remap[IDX[t+1]],c=remap[IDX[t+2]];
  if(a===b||b===c||a===c) continue;
  dir.add(a+'_'+b); dir.add(b+'_'+c); dir.add(c+'_'+a);
}
/* keep the ORIGINAL vertex ids alongside, so patches reuse real UVs */
const out=new Map();                       /* welded a -> [{b, oa, ob}] */
let boundary=0;
for(let t=0;t<IDX.length;t+=3){
  const o=[IDX[t],IDX[t+1],IDX[t+2]];
  const w=[remap[o[0]],remap[o[1]],remap[o[2]]];
  if(w[0]===w[1]||w[1]===w[2]||w[0]===w[2]) continue;
  for(let e=0;e<3;e++){
    const a=w[e], b=w[(e+1)%3];
    if(dir.has(b+'_'+a)) continue;         /* shared, not a hole */
    boundary++;
    if(!out.has(a)) out.set(a,[]);
    out.get(a).push({b, oa:o[e], ob:o[(e+1)%3]});
  }
}
console.log('    boundary edges : '+boundary.toLocaleString());

/* walk the boundary into loops, consuming each edge once */
const loops=[];
for(const [start,list] of out){
  while(list.length){
    const loop=[]; let cur=start, guard=0;
    for(;;){
      const l=out.get(cur);
      if(!l||!l.length) break;
      const e=l.shift();
      loop.push(e);
      cur=e.b;
      if(cur===start) break;
      if(++guard>200000) break;
    }
    /* two-edge slits are the commonest residue on a badly torn mesh: a pair of
       edges closing back on itself. A centroid fan shuts them just as well, and
       skipping them left thousands open. One lone edge cannot be closed. */
    if(loop.length>=2) loops.push(loop);
  }
}
console.log('    loops          : '+loops.length.toLocaleString());

/* fan each loop to a centroid that averages the loop's own position/normal/uv */
let added=0;
for(const loop of loops){
  let px=0,py=0,pz=0,nx=0,ny=0,nz=0,u=0,v=0;
  for(const e of loop){
    px+=POS[e.oa*3]; py+=POS[e.oa*3+1]; pz+=POS[e.oa*3+2];
    nx+=NOR[e.oa*3]; ny+=NOR[e.oa*3+1]; nz+=NOR[e.oa*3+2];
    u+=UV[e.oa*2];  v+=UV[e.oa*2+1];
  }
  const n=loop.length;
  const len=Math.hypot(nx,ny,nz)||1;
  const C=POS.length/3;
  POS.push(px/n,py/n,pz/n); NOR.push(nx/len,ny/len,nz/len); UV.push(u/n,v/n);
  /* the hole lies across a->b, so the patch runs b->a to keep winding outward */
  for(const e of loop){ IDX.push(e.ob,e.oa,C); added++; }
}
console.log('fill: +'+added.toLocaleString()+' tris, +'+loops.length.toLocaleString()+' verts');

/* --- write GLB, same shape the pipeline emits --- */
const pos=Float32Array.from(POS), nor=Float32Array.from(NOR), uvA=Float32Array.from(UV), idx=Uint32Array.from(IDX);
const M=pos.length/3;
const pad=n=>(4-(n%4))%4;
const parts=[Buffer.from(pos.buffer),Buffer.from(nor.buffer),Buffer.from(uvA.buffer),Buffer.from(idx.buffer)];
if(hasTex) parts.push(TEX);
let off=0; const views=parts.map(p=>{const v={byteOffset:off,byteLength:p.length}; off+=p.length+pad(p.length); return v;});
const bin=Buffer.concat(parts.flatMap(p=>[p,Buffer.alloc(pad(p.length))]));
let lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];
for(let i=0;i<M;i++) for(let a=0;a<3;a++){const val=pos[i*3+a]; if(val<lo[a])lo[a]=val; if(val>hi[a])hi[a]=val;}
const g={
  asset:{version:'2.0',generator:'vits hole-fill'},
  scene:0, scenes:[{nodes:[0]}], nodes:[{mesh:0,name:'pack'}],
  meshes:[{name:'pack',primitives:[{attributes:{POSITION:0,NORMAL:1,TEXCOORD_0:2},indices:3,material:0,mode:4}]}],
  materials:[{name:'mesh',doubleSided:srcMat.doubleSided!==false,
    pbrMetallicRoughness:Object.assign(
      {metallicFactor:srcPbr.metallicFactor!==undefined?srcPbr.metallicFactor:0,
       roughnessFactor:srcPbr.roughnessFactor!==undefined?srcPbr.roughnessFactor:0.72},
      hasTex?{baseColorTexture:{index:0}}
           :{baseColorFactor:srcPbr.baseColorFactor||[1,1,1,1]})}],
  ...(hasTex?{textures:[{sampler:0,source:0}],samplers:[{magFilter:9729,minFilter:9987}],
              images:[{mimeType:texMime,bufferView:4}]}:{}),
  accessors:[
    {bufferView:0,componentType:5126,count:M,type:'VEC3',min:lo,max:hi},
    {bufferView:1,componentType:5126,count:M,type:'VEC3'},
    {bufferView:2,componentType:5126,count:M,type:'VEC2'},
    {bufferView:3,componentType:5125,count:idx.length,type:'SCALAR'}
  ],
  bufferViews:views.map((v,i)=>Object.assign({buffer:0},v,i<3?{target:34962}:i===3?{target:34963}:{})),
  buffers:[{byteLength:bin.length}]
};
const js=Buffer.from(JSON.stringify(g),'utf8');
const jp=Buffer.concat([js,Buffer.alloc(pad(js.length),0x20)]);
const bp=Buffer.concat([bin,Buffer.alloc(pad(bin.length),0)]);
const h=Buffer.alloc(12); h.write('glTF',0); h.writeUInt32LE(2,4); h.writeUInt32LE(12+8+jp.length+8+bp.length,8);
const jc=Buffer.alloc(8); jc.writeUInt32LE(jp.length,0); jc.write('JSON',4);
const bc=Buffer.alloc(8); bc.writeUInt32LE(bp.length,0); bc.write('BIN\0',4);
fs.writeFileSync(OUT,Buffer.concat([h,jc,jp,bc,bp]));
console.log('glb : '+OUT+'  '+(fs.statSync(OUT).size/1048576).toFixed(2)+' MB, '+(idx.length/3).toLocaleString()+' tris');
