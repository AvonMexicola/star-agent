import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {AvatarGLB} from '../../blender/avatar-glb.mjs';
const root=new URL('../../',import.meta.url),source=new URL('./',import.meta.url);
const glb=new AvatarGLB(new URL('.staging/mining-laser-tool.glb',source));
const entry=JSON.parse(readFileSync(new URL('.staging/manifest.json',source)));
const hash=b=>createHash('sha256').update(b).digest('hex'),kinds=new Map();
for(const m of glb.json.materials)for(const [kind,slot] of [['normal',m.normalTexture],['basecolor',m.pbrMetallicRoughness?.baseColorTexture],['orm',m.pbrMetallicRoughness?.metallicRoughnessTexture]])if(slot)kinds.set(glb.json.textures[slot.index].source,kind);
entry.maps={};
for(const [index,image] of glb.json.images.entries()){
  const kind=kinds.get(index);if(!kind)throw Error(`Unknown image ${image.name}`);
  const path=`assets/${kind==='basecolor'?'field-cutter':'handheld-tools'}/textures/${kind}.webp`;
  const bytes=readFileSync(new URL(path,root)),name=`${kind==='basecolor'?'FieldCutterAtlas':'HandheldAtlas'}-v1-${kind}`;
  Object.assign(image,{name,bufferView:glb.addView(bytes),mimeType:'image/webp'});
  entry.maps[kind]={path,name,sha256:hash(bytes),bytes:bytes.length,size:1024};
}
for(const tex of glb.json.textures){tex.extensions={...tex.extensions,EXT_texture_webp:{source:tex.source}};delete tex.source;}
for(const key of ['extensionsUsed','extensionsRequired'])glb.json[key]=[...new Set([...(glb.json[key]||[]),'EXT_texture_webp'])];
let removed=0,rewound=0;
for(const mesh of glb.json.meshes)for(const p of mesh.primitives){
  const positions=glb.rows(p.attributes.POSITION),normals=glb.rows(p.attributes.NORMAL),indices=glb.rows(p.indices).flat(),clean=[];
  for(let i=0;i<indices.length;i+=3){
    const ids=indices.slice(i,i+3),[a,b,c]=ids.map(j=>positions[j]),u=b.map((v,j)=>v-a[j]),v=c.map((v,j)=>v-a[j]);
    const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    if(Math.hypot(...cross)/2<=1e-10){removed++;continue;}
    const n=[0,1,2].map(j=>ids.reduce((s,k)=>s+normals[k][j],0));
    if(n.reduce((s,x,j)=>s+x*cross[j],0)<-1e-10){[ids[1],ids[2]]=[ids[2],ids[1]];rewound++;}
    clean.push(...ids.map(j=>[j]));
  }
  p.indices=glb.addRows(clean,'SCALAR',glb.json.accessors[p.indices].componentType);
}
entry.cleanup={zeroAreaTrianglesRemoved:removed,outwardWindingRepaired:rewound,areaThreshold:1e-10};
glb.json.asset.extras={...glb.json.asset.extras,handheldFinish:1,units:'metres',barrel:'-X',up:'+Y',headMount:'K17-M30'};
glb.compact();
entry.triangles=glb.json.meshes.reduce((n,m)=>n+m.primitives.reduce((n,p)=>n+glb.json.accessors[p.indices].count/3,0),0);
entry.drawPrimitives=glb.json.meshes.reduce((n,m)=>n+m.primitives.length,0);
const bytes=glb.bytes();
if(entry.triangles>10000||entry.drawPrimitives>6||bytes.length>1e6)throw Error(`Over cutter budget: ${entry.triangles} triangles / ${entry.drawPrimitives} draws / ${bytes.length} bytes`);
Object.assign(entry,{bytes:bytes.length,sha256:hash(bytes),nodes:glb.json.nodes.length,materials:glb.json.materials.map(m=>m.name),textures:glb.json.images.length,
  textureSize:1024,textureFormat:'WebP',textureResidencyMiB:16,sourceSHA256:hash(readFileSync(new URL('mining-tool-mk1.blend',source))),
  textureSharing:'Normal/ORM byte-identical to handheld atlas; one shared cutter-specific basecolor (~5.33 MiB additional GPU residency with mipmaps)',
  lod:'Held hero prop; hidden when not in use. Separate body and rotor batches preserve articulation.'});
writeFileSync(new URL('public/models/props/mining-laser-tool.glb',root),bytes);
writeFileSync(new URL('manifest.json',source),JSON.stringify(entry,null,2)+'\n');
const handPath=new URL('assets/handheld-tools/manifest.json',root),hand=JSON.parse(readFileSync(handPath));
hand['mining-laser-tool']=entry;writeFileSync(handPath,JSON.stringify(hand,null,2)+'\n');
const propPath=new URL('public/models/props/manifest.json',root),props=JSON.parse(readFileSync(propPath));
Object.assign(props.find(p=>p.name==='mining-laser-tool'),{tris:entry.triangles,textures:entry.textures,texture_size:1024,texture_format:'webp',file_mb:entry.bytes/1e6,sha256:entry.sha256,
  height_m:entry.bounds.max[1]-entry.bounds.min[1],footprint_m:[entry.bounds.max[0]-entry.bounds.min[0],entry.bounds.max[2]-entry.bounds.min[2]],
  notes:'K-17 Mk1: fixed optical bore, rotating three-lobed head. User reference and editable Blender source in assets/field-cutter.'});
writeFileSync(propPath,JSON.stringify(props,null,2)+'\n');
console.log(JSON.stringify(entry,null,2));
