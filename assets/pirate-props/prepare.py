"""Preserve user GLB geometry/UVs; produce bounded embedded WebP derivatives."""
from pathlib import Path
import struct,json,hashlib,io,subprocess,os,math
ROOT=Path(__file__).resolve().parents[2]
FILES=['Meshy_AI__0908191353_texture.glb','Meshy_AI_Industrial_Tripod_Wor_0908191206_texture.glb','Meshy_AI__0908191153_texture.glb','Meshy_AI_Crimson_Skull_Crate_0908191136_texture.glb']
IDS=['generator','floodlight','workbench','crate']
OUT=ROOT/'public/models/pirate-props';OUT.mkdir(parents=True,exist_ok=True)
records=[]
for serial,name in enumerate(FILES,1):
 path=ROOT/'assets/pirate-props/source'/name;data=path.read_bytes();size=struct.unpack_from('<I',data,12)[0];g=json.loads(data[20:20+size]);binary=bytearray(data[28+size:]);buffer=bytearray();images=[];normal_repairs=[]
 # Meshy lamp/workbench each contain two nondegenerate, opposite-winding
 # triangles with zero normals. Repair only those unusable entries, preserving
 # all positions, indices, UVs and already-valid authored normals exactly.
 def accessor_values(index):
  a=g['accessors'][index];view=g['bufferViews'][a['bufferView']];count={'SCALAR':1,'VEC3':3}[a['type']];fmt={5123:'H',5125:'I',5126:'f'}[a['componentType']];width=struct.calcsize(fmt)*count;offset=view.get('byteOffset',0)+a.get('byteOffset',0)
  return [struct.unpack_from('<'+fmt*count,binary,offset+i*view.get('byteStride',width)) for i in range(a['count'])]
 for primitive in [p for mesh in g['meshes'] for p in mesh['primitives']]:
  normal_id=primitive['attributes']['NORMAL'];normals=accessor_values(normal_id);positions=accessor_values(primitive['attributes']['POSITION']);indices=[v[0] for v in accessor_values(primitive['indices'])]
  for vertex,normal in enumerate(normals):
   assert all(math.isfinite(v) for v in normal)
   if sum(v*v for v in normal)>1e-12:continue
   faces=[indices[i:i+3] for i in range(0,len(indices),3) if vertex in indices[i:i+3]];assert len(faces)==1,(name,vertex,faces)
   a,b,c=[positions[i] for i in faces[0]];u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)];cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];length=math.sqrt(sum(v*v for v in cross));assert length>1e-10,(name,vertex)
   value=[v/length for v in cross];a=g['accessors'][normal_id];view=g['bufferViews'][a['bufferView']];offset=view.get('byteOffset',0)+a.get('byteOffset',0)+vertex*view.get('byteStride',12);struct.pack_into('<fff',binary,offset,*value)
   normal_repairs.append({'accessor':normal_id,'bufferView':a['bufferView'],'vertex':vertex,'source':list(normal),'value':list(struct.unpack_from('<fff',binary,offset)),'face':faces[0],'faceArea2':length})
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
 record['normalRepairs']=normal_repairs
 if normal_repairs:record['geometryPolicy']='All original non-image bytes preserved except the explicitly listed zero-length NORMAL entries, replaced with unit normals from their isolated nondegenerate face winding. Positions, indices, UVs and all other normals remain byte-identical.'
 assert len(runtime)<=1000000,record
 records.append(record);print(record['id'],record['triangles'],record['bytes'])
(ROOT/'assets/pirate-props/manifest.json').write_text(json.dumps({'provenance':'User supplied Meshy GLBs on2026-09-08; original files retained with hashes. No new paid generation or invented provenance. Game uses independent lossless WebP texture derivatives. Source scale/semantic identity must be inspected before placement.','builder':'python3 assets/pirate-props/prepare.py','assets':records},indent=2)+'\n')
