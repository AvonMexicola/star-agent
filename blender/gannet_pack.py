"""Stage Gannet GLB packing and budgets before publishing source/runtime files.
Rigid position encoding is loss-bounded to 1 mm; UVs, indices and rig transforms
are preserved by the shared pure packer. No geometry optimization/decimation.
"""
from pathlib import Path
import hashlib, io, json, struct, sys
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'blender'))
from pack_rigid_geometry import pack_geometry
SOURCE=ROOT/'assets/gannet';STAGE=SOURCE/'.staging'

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def publish():
    runtime=STAGE/'gannet.glb'
    layout=json.loads((SOURCE/'layout.json').read_text())
    source=json.loads((STAGE/'source-manifest.json').read_text())
    if source['layoutSha256']!=digest(SOURCE/'layout.json'):raise ValueError('Layout changed after Blender export')
    if source['builderSha256']!=digest(ROOT/'blender/build_gannet.py') or source['geometryHelperSha256']!=digest(ROOT/'blender/fighter_geometry.py'):raise ValueError('Builder or geometry helper changed after Blender export')
    for name,expected in source['inputHashes'].items():
        if digest(ROOT/name)!=expected:raise ValueError(f'Authored input changed after export: {name}')
    for axis in range(3):
        if source['sourceBounds']['min'][axis]<layout['flightBounds']['min'][axis]-.00001 or source['sourceBounds']['max'][axis]>layout['flightBounds']['max'][axis]+.00001:
            raise ValueError(f'Authored closed assembly exceeds flight envelope on axis {axis}')
    packing=pack_geometry(runtime,maximum_error=.001)
    data=runtime.read_bytes();length=struct.unpack_from('<I',data,12)[0]
    doc=json.loads(data[20:20+length]);binary=data[28+length:]
    image_payloads={}
    for i,img in enumerate(doc.get('images',[])):
        view=doc['bufferViews'][img['bufferView']];start=view.get('byteOffset',0)
        image=Image.open(io.BytesIO(binary[start:start+view['byteLength']]))
        if max(image.size)>layout['budgets']['textureEdge']:raise ValueError('Oversized runtime texture')
        image=image.convert('RGBA' if 'A' in image.getbands() else 'RGB')
        out=io.BytesIO();image.save(out,format='WEBP',lossless=True)
        image_payloads[i]=out.getvalue();img['mimeType']='image/webp'
    for tex in doc.get('textures',[]):
        source_index=tex.pop('source',None)
        if source_index is not None:tex.setdefault('extensions',{})['EXT_texture_webp']={'source':source_index}
    for key in ('extensionsUsed','extensionsRequired'):
        doc[key]=sorted(set(doc.get(key,[])+['EXT_texture_webp']))
    # Only retained geometry/accessor and new WebP bytes enter the final buffer.
    result=bytearray();views=[];mapping={}
    def append(payload,extra=None):
        result.extend(b'\0'*(-len(result)%4));index=len(views)
        views.append({**(extra or {}),'buffer':0,'byteOffset':len(result),'byteLength':len(payload)});result.extend(payload);return index
    for old in sorted({a['bufferView'] for a in doc['accessors']}):
        view=doc['bufferViews'][old];start=view.get('byteOffset',0)
        mapping[old]=append(binary[start:start+view['byteLength']],{k:v for k,v in view.items() if k not in ('buffer','byteOffset','byteLength')})
    for a in doc['accessors']:a['bufferView']=mapping[a['bufferView']]
    for i,img in enumerate(doc.get('images',[])):img['bufferView']=append(image_payloads[i])
    doc['bufferViews']=views;result.extend(b'\0'*(-len(result)%4));doc['buffers']=[{'byteLength':len(result)}]
    encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4)
    output=struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(result))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(result),0x004e4942)+result
    triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
    if len(output)>layout['budgets']['glbBytes'] or triangles>layout['budgets']['triangles']:raise ValueError(f'Gannet budget exceeded: {len(output)} bytes / {triangles} triangles')
    runtime.write_bytes(output)
    collision={'source':'Actual applied Blender mesh bounds before material batching','layoutSha256':source['layoutSha256'],'parts':source.pop('collisionParts')}
    (STAGE/'collision.json').write_text(json.dumps(collision,indent=2)+'\n')
    manifest={**source,'asset':'public/models/gannet.glb','bytes':len(output),'triangles':triangles,'meshPrimitives':sum(len(m['primitives']) for m in doc['meshes']),
        'nodes':len(doc['nodes']),'images':len(doc.get('images',[])),'textureFormat':'WebP','sha256':hashlib.sha256(output).hexdigest(),
        'sourceSha256':digest(STAGE/'gannet.blend'),'collisionSha256':digest(STAGE/'collision.json'),'packing':packing}
    (STAGE/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    # All budgets/inputs are checked before replacing any final file. Individual
    # rename operations are atomic; this is not a multi-file filesystem transaction.
    (ROOT/'public/models').mkdir(parents=True,exist_ok=True)
    for name in ('gannet.blend','collision.json','manifest.json'):(STAGE/name).replace(SOURCE/name)
    runtime.replace(ROOT/'public/models/gannet.glb')
    print(json.dumps({k:manifest[k] for k in ('bytes','triangles','meshPrimitives','images','sha256')},indent=2))

if __name__=='__main__':publish()
