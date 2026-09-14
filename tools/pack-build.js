/* FBX -> web-ready GLB for one pack.
   The Meshy export is raw geometry: ~2M triangles, no UVs, no materials. This
   decimates by vertex clustering, rotates Z-up to Y-up, splits faces into six
   panel groups by dominant normal, box-projects a UV per group (fine for a
   carton, which is mostly flat panels) and writes a GLB.
   Group order matches THREE.BoxGeometry: +X, -X, +Y, -Y, +Z, -Z, so the same
   material array the coded packs use drops straight on. */
const fs=require('fs');
const {load}=require('./fbx-extract.js');

const SRC=process.argv[2], OUT=process.argv[3], GRID=parseInt(process.argv[4]||'56',10);
const g=load(SRC);
console.log('in  : '+g.triCount.toLocaleString()+' tris');

const P=g.positions;
let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
for(let i=0;i<P.length;i+=3) for(let a=0;a<3;a++){const v=P[i+a]; if(v<mn[a])mn[a]=v; if(v>mx[a])mx[a]=v;}
const maxDim=Math.max(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2]);

/* ---- decimate: snap to a grid, average each cell, rebuild faces ---- */
const cellOf=new Int32Array(g.vertexCount), cells=new Map();
for(let v=0;v<g.vertexCount;v++){
  const k=[0,1,2].map(a=>Math.min(GRID-1,Math.floor((P[v*3+a]-mn[a])/maxDim*GRID)));
  const key=(k[0]*GRID+k[1])*GRID+k[2];
  let c=cells.get(key);
  if(!c){c={i:cells.size,s:[0,0,0],n:0}; cells.set(key,c);}
  c.s[0]+=P[v*3]; c.s[1]+=P[v*3+1]; c.s[2]+=P[v*3+2]; c.n++;
  cellOf[v]=c.i;
}
const cp=new Float64Array(cells.size*3);
for(const c of cells.values()) for(let a=0;a<3;a++) cp[c.i*3+a]=c.s[a]/c.n;

const faces=[]; const seen=new Set();
for(let t=0;t<g.indices.length;t+=3){
  const a=cellOf[g.indices[t]],b=cellOf[g.indices[t+1]],c=cellOf[g.indices[t+2]];
  if(a===b||b===c||a===c) continue;
  const key=[a,b,c].slice().sort((x,y)=>x-y).join(',');
  if(seen.has(key)) continue; seen.add(key);
  faces.push([a,b,c]);
}
console.log('dec : '+faces.length.toLocaleString()+' tris (grid '+GRID+')');

/* ---- Z-up to Y-up, and centre on the origin ---- */
const rot=i=>[cp[i*3], cp[i*3+2], -cp[i*3+1]];
let rmn=[1e9,1e9,1e9],rmx=[-1e9,-1e9,-1e9];
for(let i=0;i<cells.size;i++){ const p=rot(i); for(let a=0;a<3;a++){ if(p[a]<rmn[a])rmn[a]=p[a]; if(p[a]>rmx[a])rmx[a]=p[a]; } }
const ctr=[0,1,2].map(a=>(rmn[a]+rmx[a])/2), ext=[0,1,2].map(a=>rmx[a]-rmn[a]);
const V=i=>{const p=rot(i); return [p[0]-ctr[0],p[1]-ctr[1],p[2]-ctr[2]];};

/* ---- group by dominant face normal, flat-shaded, box-projected UVs ---- */
const G=[[],[],[],[],[],[]];   /* +X -X +Y -Y +Z -Z */
for(const f of faces){
  const a=V(f[0]),b=V(f[1]),c=V(f[2]);
  const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]], w=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
  const n=[u[1]*w[2]-u[2]*w[1], u[2]*w[0]-u[0]*w[2], u[0]*w[1]-u[1]*w[0]];
  const L=Math.hypot(...n)||1; const nn=n.map(v=>v/L);
  const ax=[Math.abs(nn[0]),Math.abs(nn[1]),Math.abs(nn[2])];
  const d=ax.indexOf(Math.max(...ax));
  const gi=d*2+(nn[d]<0?1:0);
  G[gi].push({a,b,c,n:nn});
}
/* UV axes per group: the two axes that are not the dominant one */
const UVAX=[[2,1],[2,1],[0,2],[0,2],[0,1],[0,1]];
const posA=[],norA=[],uvA=[],idxA=[],prims=[];
let base=0;
G.forEach((grp,gi)=>{
  if(!grp.length){ prims.push(null); return; }
  const [ua,va]=UVAX[gi]; const start=base;
  for(const f of grp){
    for(const p of [f.a,f.b,f.c]){
      posA.push(p[0],p[1],p[2]);
      norA.push(f.n[0],f.n[1],f.n[2]);
      let u=(p[ua]+ext[ua]/2)/ext[ua], v=(p[va]+ext[va]/2)/ext[va];
      if(gi===1||gi===5) u=1-u;          /* mirror the back-facing panels */
      uvA.push(u,1-v);
      idxA.push(base++);
    }
  }
  prims.push({start,count:base-start});
});
console.log('grp : '+prims.map((p,i)=>p?('['+i+']'+(p.count/3)):null).filter(Boolean).join(' '));

/* ---- write GLB ---- */
function pad4(n){return (4-(n%4))%4;}
const pos=Float32Array.from(posA), nor=Float32Array.from(norA), uv=Float32Array.from(uvA);
const idx=Uint32Array.from(idxA);
const parts=[Buffer.from(pos.buffer),Buffer.from(nor.buffer),Buffer.from(uv.buffer),Buffer.from(idx.buffer)];
let off=0; const views=parts.map(p=>{const v={buffer:0,byteOffset:off,byteLength:p.length}; off+=p.length+pad4(p.length); return v;});
const bin=Buffer.concat(parts.flatMap((p,i)=>[p,Buffer.alloc(pad4(p.length))]));
function bounds(arr,stride){
  const lo=new Array(stride).fill(Infinity), hi=new Array(stride).fill(-Infinity);
  for(let i=0;i<arr.length;i+=stride) for(let a=0;a<stride;a++){ const v=arr[i+a]; if(v<lo[a])lo[a]=v; if(v>hi[a])hi[a]=v; }
  return {lo,hi};
}
const pb=bounds(pos,3);
const json={
  asset:{version:'2.0',generator:'vits pack-build (fbx decimate + box UV)'},
  scenes:[{nodes:[0]}], scene:0,
  nodes:[{mesh:0,name:'pack'}],
  meshes:[{name:'pack',primitives:prims.map((p,i)=>p&&({
    attributes:{POSITION:0,NORMAL:1,TEXCOORD_0:2},
    indices:3+i+1, material:i, mode:4
  })).filter(Boolean)}],
  materials:prims.map((p,i)=>p&&({name:'panel'+i,pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:0.75},doubleSided:true})).filter(Boolean),
  accessors:[
    {bufferView:0,componentType:5126,count:pos.length/3,type:'VEC3',min:pb.lo,max:pb.hi},
    {bufferView:1,componentType:5126,count:nor.length/3,type:'VEC3'},
    {bufferView:2,componentType:5126,count:uv.length/2,type:'VEC2'}
  ],
  bufferViews:[
    {buffer:0,byteOffset:views[0].byteOffset,byteLength:views[0].byteLength,target:34962},
    {buffer:0,byteOffset:views[1].byteOffset,byteLength:views[1].byteLength,target:34962},
    {buffer:0,byteOffset:views[2].byteOffset,byteLength:views[2].byteLength,target:34962}
  ],
  buffers:[{byteLength:bin.length}]
};
/* one index accessor + view per primitive */
prims.forEach((p,i)=>{
  if(!p) return;
  json.bufferViews.push({buffer:0,byteOffset:views[3].byteOffset+p.start*4,byteLength:p.count*4,target:34963});
  json.accessors.push({bufferView:json.bufferViews.length-1,componentType:5125,count:p.count,type:'SCALAR'});
});
/* remap primitive index accessors to the ones just appended */
let ai=3;
json.meshes[0].primitives.forEach(pr=>{ pr.indices=ai++; });
const js=Buffer.from(JSON.stringify(json),'utf8');
const jsPad=Buffer.concat([js,Buffer.alloc(pad4(js.length),0x20)]);
const binPad=Buffer.concat([bin,Buffer.alloc(pad4(bin.length),0)]);
const header=Buffer.alloc(12); header.write('glTF',0); header.writeUInt32LE(2,4);
header.writeUInt32LE(12+8+jsPad.length+8+binPad.length,8);
const jc=Buffer.alloc(8); jc.writeUInt32LE(jsPad.length,0); jc.write('JSON',4);
const bc=Buffer.alloc(8); bc.writeUInt32LE(binPad.length,0); bc.write('BIN\0',4);
fs.writeFileSync(OUT,Buffer.concat([header,jc,jsPad,bc,binPad]));
console.log('glb : '+OUT+'  '+(fs.statSync(OUT).size/1048576).toFixed(2)+' MB');
