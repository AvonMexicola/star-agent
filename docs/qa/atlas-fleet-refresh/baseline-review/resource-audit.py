from pathlib import Path
import struct,json,hashlib,collections
ROOT=Path('/tmp/star-agent-atlas-refresh')
OUT=ROOT/'docs/qa/atlas-fleet-refresh/baseline-review'
OUT.mkdir(parents=True,exist_ok=True)
def read_asset(path):
    data=path.read_bytes(); n=struct.unpack_from('<I',data,12)[0]
    d=json.loads(data[20:20+n]); blob=data[28+n:]
    widths={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}
    comps={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
    accessor_bytes=lambda a:a['count']*widths[a['componentType']]*comps[a['type']]
    by_semantic=collections.defaultdict(set)
    meshes=[]
    material_tris=collections.Counter()
    parent={c:i for i,node in enumerate(d['nodes']) for c in node.get('children',[])}
    node_for_mesh={node['mesh']:i for i,node in enumerate(d['nodes']) if 'mesh' in node}
    group_tris=collections.Counter()
    for i,m in enumerate(d['meshes']):
        tri=0;verts=0;accessors=set();mats=[]
        for p in m['primitives']:
            t=d['accessors'][p['indices']]['count']//3 if 'indices'in p else d['accessors'][p['attributes']['POSITION']]['count']//3
            tri+=t;verts+=d['accessors'][p['attributes']['POSITION']]['count'];material_tris[d['materials'][p['material']]['name']]+=t;mats.append(d['materials'][p['material']]['name'])
            for sem,a in p['attributes'].items():by_semantic[sem].add(a);accessors.add(a)
            if 'indices'in p:by_semantic['INDICES'].add(p['indices']);accessors.add(p['indices'])
        nodeid=node_for_mesh[i];chain=[];cur=nodeid
        while cur in parent:cur=parent[cur];chain.append(d['nodes'][cur].get('name',str(cur)))
        group=chain[-2] if len(chain)>1 else chain[-1] if chain else 'scene'
        group_tris[group]+=tri
        meshes.append({'name':m['name'],'triangles':tri,'vertices':verts,'accessorPayloadBytes':sum(accessor_bytes(d['accessors'][a]) for a in accessors),'materials':mats,'parentChain':chain})
    imgs=[]
    for img in d.get('images',[]):
        v=d['bufferViews'][img['bufferView']]; raw=blob[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
        if raw[:8]==b'\x89PNG\r\n\x1a\n':size=list(struct.unpack_from('>II',raw,16))
        elif raw[:4]==b'RIFF' and raw[8:12]==b'WEBP':
            if raw[12:16]==b'VP8X':size=[int.from_bytes(raw[24:27],'little')+1,int.from_bytes(raw[27:30],'little')+1]
            elif raw[12:16]==b'VP8 ':size=[struct.unpack_from('<H',raw,26)[0]&16383,struct.unpack_from('<H',raw,28)[0]&16383]
            else:v=struct.unpack_from('<I',raw,21)[0];size=[(v&16383)+1,((v>>14)&16383)+1]
        else:size=None
        imgs.append({'name':img.get('name'),'mimeType':img.get('mimeType'),'bytes':len(raw),'size':size,'sha256':hashlib.sha256(raw).hexdigest()})
    semantic={k:{'accessors':len(v),'bytes':sum(accessor_bytes(d['accessors'][a]) for a in v),'componentTypes':sorted(set(d['accessors'][a]['componentType'] for a in v))} for k,v in by_semantic.items()}
    return {'file':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'jsonBytes':n,'binBytes':len(blob),'triangles':sum(m['triangles'] for m in meshes),'vertices':sum(m['vertices'] for m in meshes),'meshes':len(meshes),'drawPrimitives':sum(len(m['primitives']) for m in d['meshes']),'nodes':len(d['nodes']),'materials':len(d.get('materials',[])),'images':imgs,'totalImageBytes':sum(i['bytes'] for i in imgs),'attributePayload':semantic,'materialTriangles':dict(material_tris.most_common()),'groupTriangles':dict(group_tris.most_common()),'meshCosts':sorted(meshes,key=lambda m:m['triangles'],reverse=True),'animationClips':[a['name'] for a in d.get('animations',[])],'extensionsUsed':d.get('extensionsUsed',[]),'estimatedImageRGBA8BytesWithMips':sum(i['size'][0]*i['size'][1]*4*4/3 for i in imgs if i['size'])}
reports=[read_asset(ROOT/'public/models/atlas-mark-ii'/name) for name in ['atlas-mark-ii.glb','atlas-mark-ii-lod1.glb','atlas-mark-ii-lod2.glb']]
report={'lods':reports,'totalLodPayloadBytes':sum(r['bytes'] for r in reports),'budget':{'triangles':60000,'bytes':4000000,'textureEdge':1024,'runtimeFormat':'WebP'},'scope':'Actual binary accounting; encoded bytes and estimated decoded image storage are different quantities. No GPU memory/performance measurement.'}
(OUT/'resource-audit.json').write_text(json.dumps(report,indent=2)+'\n')
for r in reports:
    print(json.dumps({k:r[k] for k in ['file','triangles','vertices','bytes','drawPrimitives','nodes','materials','totalImageBytes','attributePayload','groupTriangles']}))
print('HERO TOP MESHES',json.dumps(reports[0]['meshCosts'][:12]));print('HERO IMAGES',json.dumps(reports[0]['images']))
