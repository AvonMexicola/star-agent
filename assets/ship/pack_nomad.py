"""Pack the local Nomad GLB without changing positions, rig or surface indices.

Normal components use normalized signed 16-bit values; atlas coordinates use
normalized unsigned 16-bit values (at most .008 pixel error at 1024px). No decoder
dependency is needed: Three.js supports KHR_mesh_quantization directly.
"""
import hashlib
import json
import math
from pathlib import Path
import struct
import tempfile


def publish(root, export_scene, save_source=None, max_bytes=4_000_000):
    """Validate staged exports before replacing the known-good runtime/source.

    Each final file is replaced only after export, packing, budget validation and
    source saving succeed. This is not a multi-file filesystem transaction.
    """
    source_dir = root/'assets/ship'
    with tempfile.TemporaryDirectory(prefix='.nomad-export-', dir=source_dir) as temporary:
        stage = Path(temporary)
        runtime = stage/'nomad.glb'
        export_scene(runtime)
        report = pack(runtime)
        if report['bytes'] > max_bytes:
            raise ValueError(f'Nomad exceeds the {max_bytes}-byte runtime budget: {report["bytes"]}')
        if save_source:
            save_source(stage/'nomad.blend')
        manifest = stage/'runtime-manifest.json'
        manifest.write_text(json.dumps(report, indent=2)+'\n')
        if save_source:
            (stage/'nomad.blend').replace(source_dir/'nomad.blend')
        runtime.replace(root/'public/models/nomad.glb')
        manifest.replace(source_dir/'runtime-manifest.json')
    return report


def pack(path):
    original=path.read_bytes()
    if struct.unpack_from('<4sII',original)!=(b'glTF',2,len(original)):raise ValueError('Expected a complete glTF2 binary')
    length,kind=struct.unpack_from('<II',original,12)
    if kind!=0x4e4f534a:raise ValueError('Expected JSON first')
    doc=json.loads(original[20:20+length]);binary=memoryview(original)[28+length:]
    def raw(view):
        start=view.get('byteOffset',0);return bytes(binary[start:start+view['byteLength']])
    changes={};seen=set();errors={'normal':0,'uv':0}
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            for semantic in ['NORMAL','TEXCOORD_0']:
                number=primitive['attributes'].get(semantic)
                if number is None or number in seen:continue
                seen.add(number);item=doc['accessors'][number];view=doc['bufferViews'][item['bufferView']]
                if item['componentType']!=5126:continue
                width=3 if semantic=='NORMAL' else 2
                if item.get('byteOffset',0) or view.get('byteStride',width*4)!=width*4:raise ValueError('Expected plain Blender attributes')
                values=list(struct.iter_unpack('<'+'f'*width,raw(view)))
                if len(values)!=item['count'] or any(not math.isfinite(v) for row in values for v in row):raise ValueError('Invalid attribute')
                maximum=32767 if width==3 else 65535
                lower=-1 if width==3 else 0
                if any(v<lower-1e-6 or v>1+1e-6 for row in values for v in row):raise ValueError('Attribute outside normalized range')
                quantized=[tuple(round(max(lower,min(1,v))*maximum) for v in row) for row in values]
                error=max(abs(a-b/maximum) for va,vb in zip(values,quantized) for a,b in zip(va,vb))
                key='normal' if width==3 else 'uv';errors[key]=max(errors[key],error)
                fmt='<3hxx' if width==3 else '<2H'
                changes[item['bufferView']]=b''.join(struct.pack(fmt,*row) for row in quantized)
                item['componentType']=5122 if width==3 else 5123;item['normalized']=True
                item.pop('min',None);item.pop('max',None)
                view['byteStride']=8 if width==3 else 4
    if changes:
        for key in ['extensionsUsed','extensionsRequired']:
            doc.setdefault(key,[])
            if 'KHR_mesh_quantization' not in doc[key]:doc[key].append('KHR_mesh_quantization')
    for node in doc['nodes']:
        if node.get('name','').startswith('HP_Weapon_'):
            node.setdefault('extras',{})['installedWeapon']=None
    new=bytearray()
    for i,view in enumerate(doc['bufferViews']):
        data=changes.get(i,raw(view));new.extend(b'\0'*(-len(new)%4));view['byteOffset']=len(new);view['byteLength']=len(data);new.extend(data)
    doc['buffers'][0]['byteLength']=len(new);new.extend(b'\0'*(-len(new)%4))
    encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4)
    output=struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(new))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(new),0x004e4942)+new
    path.write_bytes(output)
    triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
    return {'bytes':len(output),'beforeBytes':len(original),'triangles':triangles,'images':len(doc.get('images',[])),
        'meshPrimitives':sum(len(mesh['primitives']) for mesh in doc['meshes']),
        'materials':[material.get('name','') for material in doc['materials']],
        'rigRoots':[node['name'] for node in doc['nodes'] if node.get('name','').startswith(('Gear_','HP_Weapon_'))],
        'coordinateSystem':{'units':'metres','up':'+Y','nose':'-Z','origin':'Hull datum at deployed foot contact plane'},
        'builder':'assets/ship/build_ship.py','collisionAuthority':'src/boarding.js',
        'runtimeAssembly':'src/ship-walkable.js adds the working hatch, folding ramp, MFDs and live cargo screen; its complete cost is measured separately',
            'sha256':hashlib.sha256(output).hexdigest(),'maxNormalComponentError':errors['normal'],'maxUVError':errors['uv'],
            'positionAndIndexBuffers':'unchanged','scope':'runtime packing only; authored texture/painting UVs retained in Blender'}


if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('path',type=Path);args=parser.parse_args()
    print(json.dumps(pack(args.path),indent=2))
