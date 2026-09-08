"""Stratum adapter of pack_rigid_geometry.py (existing Burrow/Gannet workflow).

Only static opaque batches are encoded; protected geometry attributes stay exact.
An all-white COLOR_0 may be omitted: glTF's default vertex color is exactly white.
Loss-bounded integer storage for static rigid mesh batches.

No topology reduction, decoder download or new runtime dependency. The existing
Three.js GLTFLoader supports KHR_mesh_quantization. Named rig nodes retain their
exact transforms; added leaf nodes decode their mesh positions with uniform scale.
https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_mesh_quantization
"""
# Generalized from assets/atlas-mark-ii/pack_geometry.py at d875a49.
# A caller must explicitly set and record any coarser tolerance than 1 mm.
import json,math,struct

FORMATS={5120:'b',5121:'B',5122:'h',5123:'H',5125:'I',5126:'f'}
COUNTS={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}


def compact_identical_static_vertices(doc, binary, protected_meshes):
    """Lossless vertex indexing after quantization, before GLB serialization.

    Only complete byte-identical attribute tuples are merged. Index order and
    every rendered triangle corner stay unchanged, including UV/normal/color
    seams. Named moving rigs, glazing and display buffers remain untouched.
    """
    references={}
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            for index in [primitive['indices'],*primitive['attributes'].values()]:
                references[index]=references.get(index,0)+1
    replacements={};merged=[]
    for mi,mesh in enumerate(doc['meshes']):
        if mi in protected_meshes:continue
        for primitive in mesh['primitives']:
            attributes=list(primitive['attributes'].values())
            owned=[primitive['indices'],*attributes]
            if primitive.get('targets') or any(references[i]!=1 for i in owned):continue
            count=doc['accessors'][attributes[0]]['count'];streams=[]
            for index in attributes:
                a=doc['accessors'][index];view=doc['bufferViews'][a['bufferView']]
                if a['count']!=count or a.get('sparse'):raise ValueError('Nonparallel vertex attributes')
                width=struct.calcsize('<'+FORMATS[a['componentType']]*COUNTS[a['type']])
                stride=view.get('byteStride',width);start=view.get('byteOffset',0)+a.get('byteOffset',0)
                streams.append((index,start,stride,width))
            unique={};keep=[];mapping=[]
            for i in range(count):
                key=b''.join(binary[start+i*stride:start+i*stride+width] for _,start,stride,width in streams)
                new_index=unique.get(key)
                if new_index is None:
                    new_index=len(keep);unique[key]=new_index;keep.append(i)
                mapping.append(new_index)
            if len(keep)==count:continue
            for index,start,stride,width in streams:
                a=doc['accessors'][index]
                replacements[a['bufferView']]=b''.join(binary[start+i*stride:start+(i+1)*stride] for i in keep)
                a['count']=len(keep)
            a=doc['accessors'][primitive['indices']];view=doc['bufferViews'][a['bufferView']]
            if a['type']!='SCALAR' or a['componentType'] not in (5121,5123,5125):raise ValueError('Invalid triangle index encoding')
            fmt='<'+FORMATS[a['componentType']];width=struct.calcsize(fmt);start=view.get('byteOffset',0)+a.get('byteOffset',0)
            old_indices=[struct.unpack_from(fmt,binary,start+i*width)[0] for i in range(a['count'])]
            if any(i>=count for i in old_indices):raise ValueError('Out-of-range triangle index')
            indices=[mapping[i] for i in old_indices]
            replacements[a['bufferView']]=b''.join(struct.pack(fmt,i) for i in indices)
            if 'min' in a:a['min']=[min(indices)]
            if 'max' in a:a['max']=[max(indices)]
            merged.append({'mesh':mesh.get('name',str(mi)),'verticesBefore':count,'verticesAfter':len(keep),
                           'triangles':a['count']//3,'exactCompleteAttributeTuples':True})
    result=bytearray()
    for i,view in enumerate(doc['bufferViews']):
        while len(result)%4:result.append(0)
        old_start=view.get('byteOffset',0)
        payload=replacements.get(i,binary[old_start:old_start+view['byteLength']])
        view.update(byteOffset=len(result),byteLength=len(payload));result.extend(payload)
    doc['buffers']=[{'byteLength':len(result)}]
    return result,{'meshes':len(merged),'verticesRemoved':sum(x['verticesBefore']-x['verticesAfter'] for x in merged),
                   'bufferBytesSaved':len(binary)-len(result),'details':merged,
                   'proof':'Every final encoded attribute byte at every ordered triangle corner is unchanged; protected meshes excluded'}


def pack_geometry(path, maximum_error=.001, protected_meshes=()):
    data=path.read_bytes();json_size=struct.unpack_from('<I',data,12)[0]
    doc=json.loads(data[20:20+json_size]);binary=data[28+json_size:]
    if doc.get('skins') or doc.get('animations'):
        raise ValueError('Rigid-batch packer does not accept skins or animation accessors')
    # The Stratum's four display faces must remain actual named meshes. Moving
    # mechanisms and transparent glazing also retain their exact float buffers.
    protected_meshes=set(protected_meshes)
    def uses_secondary(value):
        if isinstance(value,dict):return value.get('texCoord',0)>0 or any(uses_secondary(v) for v in value.values())
        if isinstance(value,list):return any(uses_secondary(v) for v in value)
        return False
    neutral_colours={}
    for mi,mesh in enumerate(doc['meshes']):
        for primitive in mesh['primitives']:
            index=primitive['attributes'].get('COLOR_0')
            if index is None or primitive.get('targets'):continue
            a=doc['accessors'][index]
            if a.get('sparse') or a['type'] not in ('VEC3','VEC4'):continue
            if a['componentType'] not in (5121,5123,5126):continue
            view=doc['bufferViews'][a['bufferView']]
            fmt='<'+FORMATS[a['componentType']]*COUNTS[a['type']]
            size=struct.calcsize(fmt);stride=view.get('byteStride',size)
            start=view.get('byteOffset',0)+a.get('byteOffset',0)
            one={5121:255,5123:65535,5126:1}[a['componentType']]
            if a['componentType']!=5126 and not a.get('normalized'):continue
            # Exact equality, including alpha; no nearly-white approximation.
            if all(all(v==one for v in struct.unpack_from(fmt,binary,start+k*stride)) for k in range(a['count'])):
                primitive['attributes'].pop('COLOR_0')
                neutral_colours[index]={'vertices':a['count'],'sourceBytes':a['count']*stride}
    if not uses_secondary(doc.get('materials',[])):
        # Blender joins font UVMap and manufactured UVs into a second unused
        # layer. Its absence is checked from every textureInfo before removal.
        for mesh in doc['meshes']:
            for p in mesh['primitives']:
                for name in list(p['attributes']):
                    if name.startswith('TEXCOORD_') and name!='TEXCOORD_0':p['attributes'].pop(name)
    used=sorted({i for mesh in doc['meshes'] for p in mesh['primitives'] for i in [p['indices'],*p['attributes'].values()]})
    mapping={old:new for new,old in enumerate(used)}
    doc['accessors']=[doc['accessors'][i] for i in used]
    for mesh in doc['meshes']:
        for p in mesh['primitives']:
            p['indices']=mapping[p['indices']]
            p['attributes']={k:mapping[v] for k,v in p['attributes'].items()}
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
        if mi in protected_meshes:continue
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
    if max_position_error>maximum_error:raise ValueError(f'Position storage error exceeds {maximum_error} m: {max_position_error}')
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
        if 'bufferView' not in image:raise ValueError('Runtime images must be embedded')
        v=old_views[image['bufferView']];start=v.get('byteOffset',0)
        image['bufferView']=append(binary[start:start+v['byteLength']])
    for node in list(doc['nodes']):
        if 'mesh' not in node:continue
        mi=node['mesh']
        if mi in protected_meshes:continue
        node.pop('mesh');origin,extent=mesh_frames[mi]
        leaf={'name':node.get('name','Rigid batch')+' Geometry','mesh':mi,'translation':origin,'scale':[extent]*3}
        node.setdefault('children',[]).append(len(doc['nodes']));doc['nodes'].append(leaf)
    for field in ('extensionsUsed','extensionsRequired'):
        doc[field]=sorted(set(doc.get(field,[])+['KHR_mesh_quantization']))
    doc['bufferViews']=views;doc['accessors']=accessors;doc['buffers']=[{'byteLength':len(result)}]
    result,identical_vertices=compact_identical_static_vertices(doc,result,protected_meshes)
    doc['asset']['generator']+='; Star Agent rigid mesh packer 1'
    encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
    result+=b'\0'*((-len(result))%4)
    packed=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(result))
    packed+=struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(result),0x004e4942)+result
    path.write_bytes(packed)
    return {'inputBytes':len(data),'outputBytes':len(packed),'maximumPositionErrorMetres':max_position_error,'maximumNormalErrorDegrees':max_normal_degrees,'protectedMeshCount':len(protected_meshes),
            'identicalStaticVertices':identical_vertices,
            'neutralColorsOmitted':{'accessors':len(neutral_colours),'sourceBytes':sum(v['sourceBytes'] for v in neutral_colours.values()),'proof':'Every component including alpha equals the exact glTF default white; no geometry/normal/UV/index change'},
            'method':'Static opaque batches only; KHR_mesh_quantization: unsigned-normalized 16-bit positions, signed-normalized 8-bit normals, 8-bit colours; unchanged per-corner UVs and triangle order; uniform mesh leaf decoding; exact neutral vertex colors omitted; complete identical encoded static vertex tuples indexed once'}
