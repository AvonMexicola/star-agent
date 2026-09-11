import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {AvatarGLB} from '../../blender/avatar-glb.mjs';
const root = new URL('../../', import.meta.url), source = new URL('./', import.meta.url);
const glb = new AvatarGLB(new URL('.staging/builder-tool.glb', source));
const entry = JSON.parse(readFileSync(new URL('.staging/manifest.json', source)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const imageKinds = new Map();
for (const material of glb.json.materials) {
  for (const [kind, slot] of [['normal',material.normalTexture],['basecolor',material.pbrMetallicRoughness?.baseColorTexture],['orm',material.pbrMetallicRoughness?.metallicRoughnessTexture]]) {
    if (slot) imageKinds.set(glb.json.textures[slot.index].source, kind);
  }
}
entry.maps = {};
for (const [index, image] of glb.json.images.entries()) {
  const kind = imageKinds.get(index);
  if (!kind) throw Error(`Unrecognized image ${image.name}`);
  const path = `assets/handheld-tools/textures/${kind}.webp`, bytes = readFileSync(new URL(path,root));
  Object.assign(image,{name:`HandheldAtlas-v1-${kind}`,bufferView:glb.addView(bytes),mimeType:'image/webp'});
  entry.maps[kind] = {path,sha256:hash(bytes),bytes:bytes.length,size:1024};
}
for (const texture of glb.json.textures) {
  texture.extensions = {...texture.extensions, EXT_texture_webp:{source:texture.source}};
  delete texture.source;
}
for (const key of ['extensionsUsed','extensionsRequired']) glb.json[key] = [...new Set([...(glb.json[key]||[]),'EXT_texture_webp'])];
glb.json.asset.extras = {...glb.json.asset.extras,handheldFinish:1,units:'metres',barrel:'-X',up:'+Y'};
const path = new URL('public/models/props/builder-tool.glb', root);
glb.compact();
entry.triangles=glb.json.meshes.reduce((n,m)=>n+m.primitives.reduce((n,p)=>n+glb.json.accessors[p.indices].count/3,0),0);
entry.drawPrimitives=glb.json.meshes.reduce((n,m)=>n+m.primitives.length,0);
if(entry.triangles>10000||entry.drawPrimitives>4)throw Error('Builder exceeds geometry/material budget');
glb.save(new URL('.staging/packed.glb',source));
const bytes = readFileSync(new URL('.staging/packed.glb',source));
if(bytes.length>1e6)throw Error('Builder exceeds download budget');
Object.assign(entry,{bytes:bytes.length,sha256:hash(bytes),nodes:glb.json.nodes.length,materials:glb.json.materials.map(m=>m.name),textures:glb.json.images.length,
  runtimeScreen:{size:[256,128],bytesRGBA:256*128*4,draws:1},sourceSHA256:hash(readFileSync(new URL('builder-tool.blend',source))),
  textureSharing:'Existing three HandheldAtlas-v1 maps shared by equipment loader; one private live screen',lod:'Held hero prop; hidden when not in use'});
writeFileSync(path,bytes);
writeFileSync(new URL('manifest.json',source),JSON.stringify(entry,null,2)+'\n');
const propPath=new URL('public/models/props/manifest.json',root),props=JSON.parse(readFileSync(propPath));
const prop={name:'builder-tool',file:'builder-tool.glb',category:'prop',credits:0,concept:null,tris:entry.triangles,textures:entry.textures,texture_size:1024,texture_format:'webp',file_mb:entry.bytes/1e6,sha256:entry.sha256,height_m:entry.bounds.max[1]-entry.bounds.min[1],footprint_m:[entry.bounds.max[0]-entry.bounds.min[0],entry.bounds.max[2]-entry.bounds.min[2]],notes:'Original compact Meridian builder; editable source and measured contract in assets/builder-tool.'};
const index=props.findIndex(p=>p.name===prop.name);
if(index<0)props.push(prop);else props[index]=prop;
writeFileSync(propPath,JSON.stringify(props,null,2)+'\n');
console.log(JSON.stringify(entry,null,2));
