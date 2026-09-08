"""Pack original rover textures as WebP and finalize actual exported asset counts."""
from pathlib import Path
import hashlib
import io
import json
import struct
import sys
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'blender'))
from pack_rigid_geometry import pack_geometry
path=ROOT/'public/models/mining-rover.glb'
packing=pack_geometry(path,maximum_error=.001)
b=path.read_bytes();jn=struct.unpack_from('<I',b,12)[0]
j=json.loads(b[20:20+jn]);binary=bytearray(b[28+jn:])
for img in j.get('images',[]):
    view=j['bufferViews'][img['bufferView']];start=view.get('byteOffset',0)
    image=Image.open(io.BytesIO(binary[start:start+view['byteLength']]))
    image=image.convert('RGBA' if 'A' in image.getbands() else 'RGB')
    out=io.BytesIO();image.save(out,format='WEBP',lossless=True);encoded=out.getvalue()
    while len(binary)%4:binary.append(0)
    img['bufferView']=len(j['bufferViews']);img['mimeType']='image/webp'
    j['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':len(encoded)})
    binary.extend(encoded)
for tex in j.get('textures',[]):
    source=tex.pop('source',None)
    if source is not None:tex.setdefault('extensions',{})['EXT_texture_webp']={'source':source}
for key in ('extensionsUsed','extensionsRequired'):
    if 'EXT_texture_webp' not in j.setdefault(key,[]):j[key].append('EXT_texture_webp')
# Drop stale embedded PNG bytes: repack only buffer views referenced by accessors/images.
needed=set()
for a in j['accessors']:
    if 'bufferView' in a:needed.add(a['bufferView'])
for img in j.get('images',[]):needed.add(img['bufferView'])
packed=bytearray();views=[];mapping={}
for old in sorted(needed):
    view=j['bufferViews'][old];start=view.get('byteOffset',0)
    while len(packed)%4:packed.append(0)
    copy={**view,'byteOffset':len(packed)}
    packed.extend(binary[start:start+view['byteLength']]);mapping[old]=len(views);views.append(copy)
for a in j['accessors']:
    if 'bufferView' in a:a['bufferView']=mapping[a['bufferView']]
for img in j.get('images',[]):img['bufferView']=mapping[img['bufferView']]
j['bufferViews']=views
while len(packed)%4:packed.append(0)
j['buffers'][0]['byteLength']=len(packed)
js=json.dumps(j,separators=(',',':')).encode()
js+=b' '*((-len(js))%4)
data=struct.pack('<III',0x46546c67,2,28+len(js)+len(packed))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(packed),0x004e4942)+packed
path.write_bytes(data)
manifest_path=ROOT/'assets/mining-rover/manifest.json'
m=json.loads(manifest_path.read_text())
m.update({'asset':'public/models/mining-rover.glb','sha256':hashlib.sha256(data).hexdigest(),
          'bytes':len(data),'triangles':sum(j['accessors'][p['indices']]['count']//3 for mesh in j['meshes'] for p in mesh['primitives']),
          'packing':packing,'textureFormat':'WebP: three original 1024x1024 PBR swatches and approved 512x512 Meridian emblem (RGBA)',
          'textures':len(j.get('images',[]))})
manifest_path.write_text(json.dumps(m,indent=2)+'\n')
print(json.dumps({k:m[k] for k in ['bytes','triangles','textures','sha256']}))
