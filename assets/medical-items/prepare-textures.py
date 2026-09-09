"""Preserve each supplied GLB; normalize its existing three PBR maps to 1K WebP."""
from pathlib import Path
from PIL import Image
import struct,json,io
OUT=Path(__file__).resolve().parent
for item in ['bandage','stim']:
    data=(OUT/'source'/f'{item}-original.glb').read_bytes();offset=12
    while offset<len(data):
        size,kind=struct.unpack_from('<II',data,offset);chunk=data[offset+8:offset+8+size]
        if kind==0x4e4f534a:doc=json.loads(chunk)
        if kind==0x004e4942:binary=chunk
        offset+=8+size
    target=OUT/'textures'/item;target.mkdir(parents=True,exist_ok=True)
    record=[]
    for index,image in enumerate(doc['images']):
        view=doc['bufferViews'][image['bufferView']];start=view.get('byteOffset',0)
        im=Image.open(io.BytesIO(binary[start:start+view['byteLength']])).convert('RGB')
        original=im.size;im.thumbnail((1024,1024),Image.Resampling.LANCZOS)
        # Each original is a normal tangent-space RGB map; keep the source's
        # OpenGL orientation and use near-lossless quality for vector channels.
        im.save(target/f'{index}.webp',quality=98 if index==2 else 92,method=6)
        record.append({'index':index,'originalSize':original,'size':im.size,'file':f'{index}.webp'})
    (target/'manifest.json').write_text(json.dumps(record,indent=2)+'\n')
