import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {AvatarGLB} from '../../blender/avatar-glb.mjs';
const root=new URL('../../',import.meta.url),source=new URL('./',import.meta.url),records=[];
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const [item,name,scale] of [['bandage','bandage-medical',.11],['stim','med-stim',.16]]){
  const glb=new AvatarGLB(new URL(`source/${item}-original.glb`,source));
  let triangles=0;const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const mesh of glb.json.meshes)for(const p of mesh.primitives){
    const positions=glb.rows(p.attributes.POSITION),minY=Math.min(...positions.map(p=>p[1]));
    const scaled=positions.map(p=>p.map((v,i)=>(v-(i===1?minY:0))*scale));
    p.attributes.POSITION=glb.addRows(scaled,'VEC3');
    for(const p of scaled)for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],p[i]);hi[i]=Math.max(hi[i],p[i]);}
    triangles+=glb.rows(p.indices).length/3;
  }
  for(const [i,image] of glb.json.images.entries())Object.assign(image,{name:`${name}-PBR-${i}`,bufferView:glb.addView(readFileSync(new URL(`textures/${item}/${i}.webp`,source))),mimeType:'image/webp'});
  for(const texture of glb.json.textures){texture.extensions={...texture.extensions,EXT_texture_webp:{source:texture.source}};delete texture.source;}
  for(const key of ['extensionsUsed','extensionsRequired'])glb.json[key]=[...new Set([...(glb.json[key]||[]),'EXT_texture_webp'])];
  glb.json.nodes[0].name=name;
  glb.json.materials[0].name=`${name}-PBR`;
  glb.json.asset.extras={...glb.json.asset.extras,units:'metres',origin:'base centre',source:`assets/medical-items/source/${item}-original.glb`,providedBy:'Cees'};
  glb.compact();const bytes=glb.bytes();
  if(bytes.length>1e6||triangles>1000)throw Error(`Medical prop over budget: ${name}`);
  writeFileSync(new URL(`public/models/props/${name}.glb`,root),bytes);
  records.push({name,file:`${name}.glb`,category:'prop',credits:0,concept:null,tris:triangles,textures:glb.json.images.length,texture_size:1024,texture_format:'webp',file_mb:bytes.length/1e6,sha256:hash(bytes),height_m:hi[1]-lo[1],footprint_m:[hi[0]-lo[0],hi[2]-lo[2]],bounds:{min:lo,max:hi},sourceScale:scale,notes:'Cees-supplied Meshy medical model. Original geometry/UV/PBR preserved, 1K WebP and metre scale. Prop library asset; no new healing mechanics or use animation.'});
}
writeFileSync(new URL('manifest.json',source),JSON.stringify(records,null,2)+'\n');
const propsPath=new URL('public/models/props/manifest.json',root),props=JSON.parse(readFileSync(propsPath));
for(const record of records){const i=props.findIndex(p=>p.name===record.name);if(i<0)props.push(record);else props[i]=record;}
writeFileSync(propsPath,JSON.stringify(props,null,2)+'\n');console.log(JSON.stringify(records,null,2));
