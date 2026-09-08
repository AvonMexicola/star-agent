"""Preserve user GLB geometry/UVs; produce bounded embedded WebP derivatives."""
from pathlib import Path
import struct,json,hashlib,io,subprocess,os
ROOT=Path(__file__).resolve().parents[2]
FILES=['Meshy_AI__0908191353_texture.glb','Meshy_AI_Industrial_Tripod_Wor_0908191206_texture.glb','Meshy_AI__0908191153_texture.glb','Meshy_AI_Crimson_Skull_Crate_0908191136_texture.glb']
IDS=['generator','floodlight','workbench','crate']
OUT=ROOT/'public/models/pirate-props';OUT.mkdir(parents=True,exist_ok=True)
records=[]
for serial,name in enumerate(FILES,1):
 path=ROOT/'assets/pirate-props/source'/name;data=path.read_bytes();size=struct.unpack_from('<I',data,12)[0];g=json.loads(data[20:20+size]);binary=data[28+size:];buffer=bytearray();images=[]
 image_views={im['bufferView']:i for i,im in enumerate(g.get('images',[]))}
 base_images={g['textures'][m['pbrMetallicRoughness']['baseColorTexture']['index']]['source'] for m in g['materials'] if 'baseColorTexture' in m.get('pbrMetallicRoughness',{})}
 for i,view in enumerate(g['bufferViews']):
  old=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
  if i in image_views:
   idx=image_views[i];env={**os.environ,'MAGICK_THREAD_LIMIT':'2'};original=list(map(int,subprocess.check_output(['magick','identify','-format','%w,%h','-'],input=old,env=env).decode().split(',')));limit=512;payload=subprocess.check_output(['magick','-','-resize',f'{limit}x{limit}>','-strip','-define','webp:lossless=true','-define','webp:method=6','webp:-'],input=old,env=env);actual=list(map(int,subprocess.check_output(['magick','identify','-format','%w,%h','-'],input=payload,env=env).decode().split(',')));g['images'][idx]['mimeType']='image/webp';images.append({'index':idx,'originalSize':original,'size':actual,'bytes':len(payload),'sha256':hashlib.sha256(payload).hexdigest(),'colorspace':'sRGB basecolor' if idx in base_images else 'linear data'})
  else:payload=old
  while len(buffer)%4:buffer.append(0)
  view['byteOffset']=len(buffer);view['byteLength']=len(payload);buffer+=payload
 # Explicit standard webp extension for embedded maps.
 for texture in g['textures']:
  source=texture.pop('source');texture.setdefault('extensions',{})['EXT_texture_webp']={'source':source}
 g['extensionsUsed']=list(dict.fromkeys(g.get('extensionsUsed',[])+['EXT_texture_webp']));g['extensionsRequired']=list(dict.fromkeys(g.get('extensionsRequired',[])+['EXT_texture_webp']))
 while len(buffer)%4:buffer.append(0)
 g['buffers'][0]['byteLength']=len(buffer);text=json.dumps(g,separators=(',',':')).encode();text+=b' ' *((-len(text))%4);runtime=struct.pack('<III',0x46546c67,2,12+8+len(text)+8+len(buffer))+struct.pack('<II',len(text),0x4E4F534A)+text+struct.pack('<II',len(buffer),0x004E4942)+buffer
 target=OUT/f'{IDS[serial-1]}.glb';target.write_bytes(runtime);primitives=[p for m in g['meshes'] for p in m['primitives']];bounds=[g['accessors'][p['attributes']['POSITION']] for p in primitives]
 record={'id':IDS[serial-1],'source':str(path.relative_to(ROOT)),'sourceSha256':hashlib.sha256(data).hexdigest(),'sourceBytes':len(data),'runtime':str(target.relative_to(ROOT)),'sha256':hashlib.sha256(runtime).hexdigest(),'bytes':len(runtime),'triangles':sum(g['accessors'][p['indices']]['count']//3 for p in primitives),'draws':len(primitives),'textures':images,'rawMeshBounds':{'min':[min(a['min'][i] for a in bounds) for i in range(3)],'max':[max(a['max'][i] for a in bounds) for i in range(3)]},'geometryPolicy':'All original non-image buffer payloads, mesh indices, vertices, UVs and normals preserved byte-for-byte.'}
 assert len(runtime)<=1000000,record
 records.append(record);print(record['id'],record['triangles'],record['bytes'])
(ROOT/'assets/pirate-props/manifest.json').write_text(json.dumps({'provenance':'User supplied Meshy GLBs on2026-09-08; original files retained with hashes. No new paid generation or invented provenance. Game uses independent lossless WebP texture derivatives. Source scale/semantic identity must be inspected before placement.','builder':'python3 assets/pirate-props/prepare.py','assets':records},indent=2)+'\n')
