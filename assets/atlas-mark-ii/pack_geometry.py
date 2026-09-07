"""Loss-bounded integer storage for the Atlas's static rigid mesh batches.

No topology reduction, decoder download or new runtime dependency. The existing
Three.js GLTFLoader supports KHR_mesh_quantization. Named rig nodes retain their
exact transforms; added leaf nodes decode their mesh positions with uniform scale.
https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_mesh_quantization
"""
import json,math,struct

FORMATS={5120:'b',5121:'B',5122:'h',5123:'H',5125:'I',5126:'f'}
COUNTS={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}


def pack_geometry(path):
    data=path.read_bytes();json_size=struct.unpack_from('<I',data,12)[0]
    doc=json.loads(data[20:20+json_size]);binary=data[28+json_size:]
    if doc.get('skins') or doc.get('animations'):
        raise ValueError('Atlas rigid-batch packer does not accept skins or animation accessors')
    old_views=doc['bufferViews'];old_accessors=doc['accessors']
    def read(index):
        a=old_accessors[index]
        if a.get('sparse'):raise ValueError('Sparse accessors need an explicit packing path')
        v=old_views[a['bufferView']];fmt='<'+FORMATS[a['componentType']]*COUNTS[a['type']]
        size=struct.calcsize(fmt);stride=v.get('byteStride',size)
        start=v.get('byteOffset',0)+a.get('byteOffset',0)
        values=[struct.unpack_from(fmt,binary,start+i*stride) for i in range(a['count'])]
        if a.get('normalized'):
            divisor={5120:127,5121:255,5122:32767,5123:65535}[a['componentType']]
            values=[tuple(max(-1,n/divisor) for n in p) for p in values]
        return values
    positions={};normals=set();colours=set();mesh_frames={};max_position_error=0;max_normal_degrees=0
    for mi,mesh in enumerate(doc['meshes']):
        indices={p['attributes']['POSITION'] for p in mesh['primitives']}
        if any(p.get('targets') for p in mesh['primitives']):raise ValueError('Morph targets are unsupported')
        values={i:read(i) for i in indices};all_positions=[v for group in values.values() for v in group]
        origin=[min(v[k] for v in all_positions) for k in range(3)]
        extent=max(max(v[k] for v in all_positions)-origin[k] for k in range(3)) or 1
        mesh_frames[mi]=(origin,extent)
        for i,source in values.items():
            encoded=[tuple(round((v[k]-origin[k])/extent*65535) for k in range(3)) for v in source]
            if i in positions and positions[i][0]!=encoded:raise ValueError('Shared position accessor has incompatible mesh frames')
            positions[i]=(encoded,origin,extent)
            max_position_error=max(max_position_error,max(math.dist(v,[origin[k]+q[k]/65535*extent for k in range(3)]) for v,q in zip(source,encoded)))
        for p in mesh['primitives']:
            if 'NORMAL' in p['attributes']:normals.add(p['attributes']['NORMAL'])
            if 'COLOR_0' in p['attributes']:colours.add(p['attributes']['COLOR_0'])
    if max_position_error>.001:raise ValueError(f'Position storage error exceeds 1 mm: {max_position_error}')
    result=bytearray();views=[];accessors=[]
    def append(payload,target=None,stride=None):
        while len(result)%4:result.append(0)
        v={'buffer':0,'byteOffset':len(result),'byteLength':len(payload)}
        if target:v['target']=target
        if stride:v['byteStride']=stride
        index=len(views);views.append(v);result.extend(payload);return index
    for i,original in enumerate(old_accessors):
        a=dict(original);a.pop('byteOffset',None)
        view=old_views[original['bufferView']];target=view.get('target')
        values=read(i);count=COUNTS[a['type']]
        if i in positions:
            values=positions[i][0];a.update(componentType=5123,normalized=True)
            a['min']=[min(p[k] for p in values) for k in range(3)]
            a['max']=[max(p[k] for p in values) for k in range(3)]
        elif i in normals:
            source=values;values=[tuple(round(max(-1,min(1,n))*127) for n in p) for p in source]
            for p,q in zip(source,values):
                length=math.sqrt(sum(n*n for n in q));pl=math.sqrt(sum(n*n for n in p))
                if length and pl:
                    angle=math.degrees(math.acos(max(-1,min(1,sum(a*b for a,b in zip(p,q))/length/pl))))
                    max_normal_degrees=max(max_normal_degrees,angle)
            a.update(componentType=5120,normalized=True)
        elif i in colours:
            values=[tuple(round(max(0,min(1,n))*255) for n in p) for p in values]
            a.update(componentType=5121,normalized=True)
        elif original.get('normalized'):
            # Preserve all other accessor encodings exactly.
            div={5120:127,5121:255,5122:32767,5123:65535}[original['componentType']]
            values=[tuple(round(n*div) for n in p) for p in values]
        fmt='<'+FORMATS[a['componentType']]*count;size=struct.calcsize(fmt)
        stride=(size+3)//4*4 if target==34962 else size
        payload=b''.join(struct.pack(fmt,*v)+bytes(stride-size) for v in values)
        a['bufferView']=append(payload,target,stride if stride!=size else None);accessors.append(a)
    for image in doc.get('images',[]):
        if 'bufferView' not in image:raise ValueError('Runtime Atlas images must be embedded')
        v=old_views[image['bufferView']];start=v.get('byteOffset',0)
        image['bufferView']=append(binary[start:start+v['byteLength']])
    for node in list(doc['nodes']):
        if 'mesh' not in node:continue
        mi=node.pop('mesh');origin,extent=mesh_frames[mi]
        leaf={'name':node.get('name','Atlas batch')+' Geometry','mesh':mi,'translation':origin,'scale':[extent]*3}
        node.setdefault('children',[]).append(len(doc['nodes']));doc['nodes'].append(leaf)
    for field in ('extensionsUsed','extensionsRequired'):
        doc[field]=sorted(set(doc.get(field,[])+['KHR_mesh_quantization']))
    doc['bufferViews']=views;doc['accessors']=accessors;doc['buffers']=[{'byteLength':len(result)}]
    doc['asset']['generator']+='; Atlas rigid mesh packer 1'
    encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
    result+=b'\0'*((-len(result))%4)
    packed=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(result))
    packed+=struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(result),0x004e4942)+result
    path.write_bytes(packed)
    return {'inputBytes':len(data),'outputBytes':len(packed),'maximumPositionErrorMetres':max_position_error,'maximumNormalErrorDegrees':max_normal_degrees,'method':'KHR_mesh_quantization: unsigned-normalized 16-bit positions, signed-normalized 8-bit normals, 8-bit colours; unchanged UVs and indices; uniform mesh leaf decoding'}
