/* Shrink a Meshy image-to-3D GLB into something shippable.
   The export is ~2M triangles with 21MB of embedded JPEGs. This keeps the UVs
   (which is the whole point of the textured export) by clustering on position
   AND uv together, so vertices either side of a UV seam never merge and the
   texture does not smear across the seam. Textures are re-encoded smaller;
   the metallicRoughness and normal maps are dropped because at the size these
   packs are shown they cost megabytes and buy almost nothing. */
const fs=require('fs'), path=require('path'), {execFileSync}=require('child_process');

const SRC=process.argv[2], OUT=process.argv[3];
const GRID=parseInt(process.argv[4]||'56',10);
const TEX=parseInt(process.argv[5]||'1024',10);
const TMP=require('os').tmpdir();

const buf=fs.readFileSync(SRC);
const jl=buf.readUInt32LE(12);
const J=JSON.parse(buf.slice(20,20+jl).toString('utf8'));
const binOff=20+jl+8;
const BIN=buf.slice(binOff);

const CT={5120:[Int8Array,1],5121:[Uint8Array,1],5122:[Int16Array,2],5123:[Uint16Array,2],5125:[Uint32Array,4],5126:[Float32Array,4]};
const NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
function readAcc(i){
  const a=J.accessors[i], bv=J.bufferViews[a.bufferView];
  const [Ctor,sz]=CT[a.componentType], n=NC[a.type];
  const start=(bv.byteOffset||0)+(a.byteOffset||0);
  const stride=bv.byteStride||sz*n;
  const out=new (a.componentType===5126?Float32Array:Uint32Array)(a.count*n);
  for(let e=0;e<a.count;e++){
    const o=start+e*stride;
    for(let c=0;c<n;c++){
      const p=o+c*sz;
      out[e*n+c]= a.componentType===5126?BIN.readFloatLE(p)
                : a.componentType===5125?BIN.readUInt32LE(p)
                : a.componentType===5123?BIN.readUInt16LE(p)
                : BIN.readUInt8(p);
    }
  }
  return out;
}
const prim=J.meshes[0].primitives[0];
const POS=readAcc(prim.attributes.POSITION);
const NOR=prim.attributes.NORMAL!==undefined?readAcc(prim.attributes.NORMAL):null;
const UV =readAcc(prim.attributes.TEXCOORD_0);
const IDX=readAcc(prim.indices);
const nv=POS.length/3;
console.log('in  : '+(IDX.length/3).toLocaleString()+' tris, '+nv.toLocaleString()+' verts');

/* --- bounds --- */
let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
for(let i=0;i<nv;i++) for(let a=0;a<3;a++){const v=POS[i*3+a]; if(v<mn[a])mn[a]=v; if(v>mx[a])mx[a]=v;}
const maxDim=Math.max(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2]);

/* --- decimate: cluster on position AND uv --- */
const UVG=24;
const cellOf=new Int32Array(nv), cells=new Map();
for(let v=0;v<nv;v++){
  const k=[0,1,2].map(a=>Math.min(GRID-1,Math.floor((POS[v*3+a]-mn[a])/maxDim*GRID)));
  const ug=Math.min(UVG-1,Math.floor(UV[v*2]*UVG)), vg=Math.min(UVG-1,Math.floor(UV[v*2+1]*UVG));
  const key=k[0]+'_'+k[1]+'_'+k[2]+'_'+ug+'_'+vg;
  let c=cells.get(key);
  if(!c){ c={i:cells.size,p:[0,0,0],n:[0,0,0],uv:[0,0],c:0}; cells.set(key,c); }
  for(let a=0;a<3;a++){ c.p[a]+=POS[v*3+a]; if(NOR) c.n[a]+=NOR[v*3+a]; }
  c.uv[0]+=UV[v*2]; c.uv[1]+=UV[v*2+1]; c.c++;
  cellOf[v]=c.i;
}
const M=cells.size;
const pos=new Float32Array(M*3), nor=new Float32Array(M*3), uv=new Float32Array(M*2);
for(const c of cells.values()){
  for(let a=0;a<3;a++){ pos[c.i*3+a]=c.p[a]/c.c; nor[c.i*3+a]=c.n[a]/c.c; }
  uv[c.i*2]=c.uv[0]/c.c; uv[c.i*2+1]=c.uv[1]/c.c;
}
for(let i=0;i<M;i++){ const L=Math.hypot(nor[i*3],nor[i*3+1],nor[i*3+2])||1;
  nor[i*3]/=L; nor[i*3+1]/=L; nor[i*3+2]/=L; }

const tri=[]; const seen=new Set();
for(let t=0;t<IDX.length;t+=3){
  const a=cellOf[IDX[t]],b=cellOf[IDX[t+1]],c=cellOf[IDX[t+2]];
  if(a===b||b===c||a===c) continue;
  const k=[a,b,c].slice().sort((x,y)=>x-y).join(',');
  if(seen.has(k)) continue; seen.add(k);
  tri.push(a,b,c);
}
console.log('dec : '+(tri.length/3).toLocaleString()+' tris, '+M.toLocaleString()+' verts  (grid '+GRID+')');

/* --- baseColor texture, re-encoded smaller --- */
const img=J.images[J.textures[J.materials[0].pbrMetallicRoughness.baseColorTexture.index].source];
const ibv=J.bufferViews[img.bufferView];
const raw=BIN.slice(ibv.byteOffset||0,(ibv.byteOffset||0)+ibv.byteLength);
const inJ=path.join(TMP,'pack-src.jpg'), outJ=path.join(TMP,'pack-out.jpg');
fs.writeFileSync(inJ,raw);
execFileSync('ffmpeg',['-y','-loglevel','error','-i',inJ,'-vf','scale='+TEX+':'+TEX+':flags=lanczos','-q:v','4',outJ]);
const tex=fs.readFileSync(outJ);
console.log('tex : '+(raw.length/1048576).toFixed(2)+' MB -> '+(tex.length/1024).toFixed(0)+' KB at '+TEX+'px');

/* --- write GLB --- */
const idx=Uint32Array.from(tri);
const pad=n=>(4-(n%4))%4;
const parts=[Buffer.from(pos.buffer),Buffer.from(nor.buffer),Buffer.from(uv.buffer),Buffer.from(idx.buffer),tex];
let off=0; const views=parts.map(p=>{const v={byteOffset:off,byteLength:p.length}; off+=p.length+pad(p.length); return v;});
const bin=Buffer.concat(parts.flatMap(p=>[p,Buffer.alloc(pad(p.length))]));
let lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];
for(let i=0;i<M;i++) for(let a=0;a<3;a++){const v=pos[i*3+a]; if(v<lo[a])lo[a]=v; if(v>hi[a])hi[a]=v;}
const out={
  asset:{version:'2.0',generator:'vits glb-optimise (uv-preserving decimate)'},
  scene:0, scenes:[{nodes:[0]}], nodes:[{mesh:0,name:'pack'}],
  meshes:[{name:'pack',primitives:[{attributes:{POSITION:0,NORMAL:1,TEXCOORD_0:2},indices:3,material:0,mode:4}]}],
  materials:[{name:'pack',doubleSided:true,pbrMetallicRoughness:{
    baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:0.72}}],
  textures:[{sampler:0,source:0}], samplers:[{magFilter:9729,minFilter:9987}],
  images:[{mimeType:'image/jpeg',bufferView:4}],
  accessors:[
    {bufferView:0,componentType:5126,count:M,type:'VEC3',min:lo,max:hi},
    {bufferView:1,componentType:5126,count:M,type:'VEC3'},
    {bufferView:2,componentType:5126,count:M,type:'VEC2'},
    {bufferView:3,componentType:5125,count:idx.length,type:'SCALAR'}
  ],
  bufferViews:[
    {buffer:0,byteOffset:views[0].byteOffset,byteLength:views[0].byteLength,target:34962},
    {buffer:0,byteOffset:views[1].byteOffset,byteLength:views[1].byteLength,target:34962},
    {buffer:0,byteOffset:views[2].byteOffset,byteLength:views[2].byteLength,target:34962},
    {buffer:0,byteOffset:views[3].byteOffset,byteLength:views[3].byteLength,target:34963},
    {buffer:0,byteOffset:views[4].byteOffset,byteLength:views[4].byteLength}
  ],
  buffers:[{byteLength:bin.length}]
};
const js=Buffer.from(JSON.stringify(out),'utf8');
const jp=Buffer.concat([js,Buffer.alloc(pad(js.length),0x20)]);
const bp=Buffer.concat([bin,Buffer.alloc(pad(bin.length),0)]);
const h=Buffer.alloc(12); h.write('glTF',0); h.writeUInt32LE(2,4); h.writeUInt32LE(12+8+jp.length+8+bp.length,8);
const jc=Buffer.alloc(8); jc.writeUInt32LE(jp.length,0); jc.write('JSON',4);
const bc=Buffer.alloc(8); bc.writeUInt32LE(bp.length,0); bc.write('BIN\0',4);
fs.writeFileSync(OUT,Buffer.concat([h,jc,jp,bc,bp]));
console.log('glb : '+OUT+'  '+(fs.statSync(OUT).size/1048576).toFixed(2)+' MB');
