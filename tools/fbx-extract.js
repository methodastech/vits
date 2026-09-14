/* Minimal FBX 7400 binary reader — enough to pull one mesh out of a Meshy export.
   Written here rather than pulling a dependency: the format's record layout is
   small and this only needs Vertices, PolygonVertexIndex and Normals. */
const fs=require('fs'), zlib=require('zlib');

function readProp(b,p){
  const t=String.fromCharCode(b[p]); p++;
  const arr=(bytes,get)=>{
    const len=b.readUInt32LE(p), enc=b.readUInt32LE(p+4), comp=b.readUInt32LE(p+8);
    let d=b.slice(p+12,p+12+comp);
    if(enc===1) d=zlib.inflateSync(d);
    const a=new Array(len);
    for(let i=0;i<len;i++) a[i]=get(d,i*bytes);
    return {v:a,next:p+12+comp};
  };
  switch(t){
    case 'Y': return {v:b.readInt16LE(p),next:p+2};
    case 'C': return {v:b[p],next:p+1};
    case 'I': return {v:b.readInt32LE(p),next:p+4};
    case 'F': return {v:b.readFloatLE(p),next:p+4};
    case 'D': return {v:b.readDoubleLE(p),next:p+8};
    case 'L': return {v:Number(b.readBigInt64LE(p)),next:p+8};
    case 'f': return arr(4,(d,o)=>d.readFloatLE(o));
    case 'd': return arr(8,(d,o)=>d.readDoubleLE(o));
    case 'l': return arr(8,(d,o)=>Number(d.readBigInt64LE(o)));
    case 'i': return arr(4,(d,o)=>d.readInt32LE(o));
    case 'b': return arr(1,(d,o)=>d[o]);
    case 'S': case 'R': { const n=b.readUInt32LE(p); return {v:b.slice(p+4,p+4+n).toString('binary'),next:p+4+n}; }
    default: throw new Error('unknown FBX prop type: '+t);
  }
}
function collect(b,start,end,found){
  let p=start;
  while(p<end-13){
    const endOff=b.readUInt32LE(p); if(endOff===0) break;
    const numProps=b.readUInt32LE(p+4), nameLen=b[p+12];
    const name=b.slice(p+13,p+13+nameLen).toString('binary');
    let q=p+13+nameLen; const props=[];
    for(let i=0;i<numProps;i++){ const r=readProp(b,q); props.push(r.v); q=r.next; }
    if(!found[name] && Array.isArray(props[0]) && props[0].length>100) found[name]=props[0];
    if(q<endOff) collect(b,q,endOff,found);
    p=endOff;
  }
  return found;
}

module.exports.load=function(file){
  const b=fs.readFileSync(file);
  if(b.slice(0,20).toString('binary')!=='Kaydara FBX Binary  ') throw new Error('not a binary FBX');
  const f=collect(b,27,b.length,{});
  const pos=f.Vertices, pvi=f.PolygonVertexIndex;
  if(!pos||!pvi) throw new Error('no geometry found');
  /* FBX marks the last index of each polygon by bitwise NOT, so a run ends when
     an index is negative. Everything here is a fan-triangulated polygon. */
  const tris=[]; let face=[];
  for(let i=0;i<pvi.length;i++){
    let v=pvi[i], last=false;
    if(v<0){ v=~v; last=true; }
    face.push(v);
    if(last){
      for(let k=1;k+1<face.length;k++) tris.push(face[0],face[k],face[k+1]);
      face=[];
    }
  }
  return {positions:pos, indices:tris, vertexCount:pos.length/3, triCount:tris.length/3};
};
