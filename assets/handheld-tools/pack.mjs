// Install exact authored WebP maps in Blender's GLBs, discard PNG payloads and
// derive manifest counts from the shipped binary (not Blender's estimates).
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {AvatarGLB} from '../../blender/avatar-glb.mjs';
const root=new URL('../../',import.meta.url);
const source=new URL('./',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',source)));
const propsPath=new URL('public/models/props/manifest.json',root);
const props=JSON.parse(readFileSync(propsPath));
for(const [name,entry] of Object.entries(manifest)){
  const path=new URL(`public/models/props/${name}.glb`,root),glb=new AvatarGLB(path);
  for(const im of glb.json.images){
    const kind=['basecolor','orm','normal'].find(k=>im.name.includes(k));
    if(!kind)throw Error(`Unrecognized Blender image ${im.name}`);
    im.name=`HandheldAtlas-v1-${kind}`;
    im.bufferView=glb.addView(readFileSync(new URL(`textures/${kind}.webp`,source)));
    im.mimeType='image/webp';
  }
  for(const tex of glb.json.textures){
    tex.extensions={...tex.extensions,EXT_texture_webp:{source:tex.source}};
    delete tex.source;
  }
  for(const key of ['extensionsUsed','extensionsRequired'])glb.json[key]=[...new Set([...(glb.json[key]||[]),'EXT_texture_webp'])];
  glb.json.asset.extras={...glb.json.asset.extras,handheldFinish:1,units:'metres',barrel:'-X',up:'+Y'};
  glb.compact().save(path);
  const bytes=readFileSync(path);
  entry.bytes=bytes.length;entry.sha256=createHash('sha256').update(bytes).digest('hex');
  entry.triangles=glb.json.meshes.reduce((n,m)=>n+m.primitives.reduce((n,p)=>n+glb.json.accessors[p.indices].count/3,0),0);
  entry.drawPrimitives=glb.json.meshes.reduce((n,m)=>n+m.primitives.length,0);
  entry.materials=glb.json.materials.map(m=>m.name);entry.textures=glb.json.images.length;
  entry.textureSize=1024;entry.textureFormat='WebP';entry.textureResidencyMiB=16;
  entry.textureSharing='Three atlases shared across all four handhelds by equipment loader, ~16 MiB including mipmaps';
  entry.lod='Held hero asset; no new distant LOD. Material batches reduced from 5–7 to 3–4.';
  if(entry.triangles>10000||entry.bytes>1_000_000)throw Error(`${name} over prop budget: ${entry.triangles} tris / ${entry.bytes} bytes`);
  const p=props.find(p=>p.name===name)||{name,file:`${name}.glb`,category:'prop',credits:0,concept:null};
  if(!props.includes(p))props.push(p);
  Object.assign(p,{tris:entry.triangles,textures:entry.textures,texture_size:1024,texture_format:'webp',
    file_mb:entry.bytes/1e6,sha256:entry.sha256,height_m:entry.bounds.max[1]-entry.bounds.min[1],
    footprint_m:[entry.bounds.max[0]-entry.bounds.min[0],entry.bounds.max[2]-entry.bounds.min[2]],
    notes:'Original Blender handheld finish; assets/handheld-tools/{build.py,manifest.json}. UV PBR, contact AO, calibrated grips and fitted rifle stock.'});
  console.log(name,entry.triangles,entry.bytes,entry.drawPrimitives);
}
writeFileSync(new URL('manifest.json',source),JSON.stringify(manifest,null,2)+'\n');
writeFileSync(propsPath,JSON.stringify(props,null,2)+'\n');
