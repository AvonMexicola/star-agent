"""Strict standard-library GLB geometry/rig delta for the Bastion finish pass.

python assets/station-defense/check_delta.py --before /archive/candidate-05.glb \
  --after public/models/station-defense.glb --out /qa/delta-05-06.json

Only normals, TEXCOORD_0 and embedded texture payloads may change. Expanded
oriented local/world triangles and every other corner attribute must agree.
"""
from pathlib import Path
import argparse
from collections import Counter
import hashlib
import json
import math
import struct

p=argparse.ArgumentParser()
p.add_argument('--before',type=Path,required=True)
p.add_argument('--after',type=Path,required=True)
p.add_argument('--out',type=Path,required=True)
a=p.parse_args()

def sha(data):return hashlib.sha256(data).hexdigest()
def identity():return [[1 if x==y else 0 for x in range(4)] for y in range(4)]
def multiply(a,b):return [[sum(a[y][k]*b[k][x] for k in range(4)) for x in range(4)] for y in range(4)]
def point(matrix,p):return tuple(sum(matrix[i][j]*p[j] for j in range(3))+matrix[i][3] for i in range(3))
def local_matrix(node):
    if 'matrix' in node:return [[node['matrix'][x*4+y] for x in range(4)] for y in range(4)]
    x,y,z,w=node.get('rotation',[0,0,0,1]);sx,sy,sz=node.get('scale',[1,1,1]);tx,ty,tz=node.get('translation',[0,0,0])
    return [[(1-2*(y*y+z*z))*sx,2*(x*y-z*w)*sy,2*(x*z+y*w)*sz,tx],
            [2*(x*y+z*w)*sx,(1-2*(x*x+z*z))*sy,2*(y*z-x*w)*sz,ty],
            [2*(x*z-y*w)*sx,2*(y*z+x*w)*sy,(1-2*(x*x+y*y))*sz,tz],
            [0,0,0,1]]

def load(path):
    raw=path.read_bytes()
    assert struct.unpack_from('<III',raw)==(0x46546c67,2,len(raw))
    size=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+size]);blob=raw[28+size:]
    parents={child:i for i,node in enumerate(doc['nodes']) for child in node.get('children',[])}
    matrices={}
    def world(i):
        if i not in matrices:matrices[i]=multiply(world(parents[i]) if i in parents else identity(),local_matrix(doc['nodes'][i]))
        return matrices[i]
    cache={}
    def attribute(index):
        if index in cache:return cache[index]
        accessor=doc['accessors'][index];view=doc['bufferViews'][accessor['bufferView']]
        components={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[accessor['type']]
        formats={5120:'b',5121:'B',5122:'h',5123:'H',5125:'I',5126:'f'}
        fmt='<'+formats[accessor['componentType']]*components;size=struct.calcsize(fmt)
        start=view.get('byteOffset',0)+accessor.get('byteOffset',0);stride=view.get('byteStride',size)
        values=[struct.unpack_from(fmt,blob,start+i*stride) for i in range(accessor['count'])]
        assert all(math.isfinite(value) for row in values for value in row)
        if accessor.get('normalized'):
            maximum={5120:127,5121:255,5122:32767,5123:65535,5125:4294967295}[accessor['componentType']]
            values=[tuple(max(-1,v/maximum) for v in row) for row in values]
        cache[index]=values
        return values
    local,global_,fixed,normals,uvs=Counter(),Counter(),Counter(),Counter(),Counter()
    bindings=[];total=0;bounds_min=[math.inf]*3;bounds_max=[-math.inf]*3
    for node_index,node in enumerate(doc['nodes']):
        if 'mesh' not in node:continue
        for primitive_index,primitive in enumerate(doc['meshes'][node['mesh']]['primitives']):
            assert primitive.get('mode',4)==4
            attributes={name:attribute(index) for name,index in primitive['attributes'].items()}
            indices=[v[0] for v in attribute(primitive['indices'])] if 'indices' in primitive else range(len(attributes['POSITION']))
            assert len(indices)%3==0
            prefix=(node.get('name',''),primitive_index,primitive.get('material'))
            bindings.append((prefix,tuple(sorted(attributes))))
            unchanged=sorted(set(attributes)-{'POSITION','NORMAL','TEXCOORD_0'})
            for i in range(0,len(indices),3):
                ids=list(indices[i:i+3]);positions=[attributes['POSITION'][index] for index in ids]
                # Cyclic rotations preserve triangle winding, unlike sorting its
                # three corners independently. Export vertex dedup is harmless.
                first=min(range(3),key=lambda k:tuple(positions[k:]+positions[:k]))
                ids=ids[first:]+ids[:first];positions=positions[first:]+positions[:first]
                posed=tuple(point(world(node_index),v) for v in positions)
                local_key=(prefix,tuple(positions));world_key=(prefix,posed)
                local[local_key]+=1;global_[world_key]+=1
                fixed[(local_key,tuple((name,tuple(attributes[name][index] for index in ids)) for name in unchanged))]+=1
                normals[(local_key,tuple(attributes['NORMAL'][index] for index in ids))]+=1
                uvs[(local_key,tuple(attributes['TEXCOORD_0'][index] for index in ids))]+=1
                for v in posed:
                    for axis in range(3):bounds_min[axis]=min(bounds_min[axis],v[axis]);bounds_max[axis]=max(bounds_max[axis],v[axis])
                total+=1
    images=[]
    for image in doc.get('images',[]):
        view=doc['bufferViews'][image['bufferView']];start=view.get('byteOffset',0);payload=blob[start:start+view['byteLength']]
        assert payload[:4]==b'RIFF' and payload[8:12]==b'WEBP'
        dimensions=None;cursor=12
        while cursor+8<=len(payload):
            tag=payload[cursor:cursor+4];length=struct.unpack_from('<I',payload,cursor+4)[0];chunk=payload[cursor+8:cursor+8+length]
            if tag==b'VP8L':
                assert chunk[0]==0x2f;bits=struct.unpack_from('<I',chunk,1)[0]
                dimensions=[(bits&0x3fff)+1,((bits>>14)&0x3fff)+1]
            if tag==b'VP8X':dimensions=[int.from_bytes(chunk[4:7],'little')+1,int.from_bytes(chunk[7:10],'little')+1]
            cursor+=8+length+(length%2)
        assert dimensions
        images.append({'name':image.get('name'),'mimeType':image['mimeType'],'bytes':len(payload),'dimensions':dimensions,'sha256':sha(payload)})
    return {'doc':doc,'sha256':sha(raw),'bytes':len(raw),'triangles':total,'local':local,'world':global_,
            'fixedCorners':fixed,'normalCorners':normals,'uvCorners':uvs,'bindings':bindings,'images':images,
            'bounds':{'min':bounds_min,'max':bounds_max}}

before,after=load(a.before),load(a.after)
checks={
    'baselineIdentity':before['sha256']=='ccc8f276dc07891aff056fded88367607a28d5f5aa2897e39b9ae973fca3472f',
    'triangleCount':before['triangles']==after['triangles']==9177,
    'orientedLocalTriangleMultisetIdentical':before['local']==after['local'],
    'orientedWorldTriangleMultisetIdentical':before['world']==after['world'],
    'allOtherCornerAttributesIdentical':before['fixedCorners']==after['fixedCorners'],
    'nodeRecordsIdentical':before['doc']['nodes']==after['doc']['nodes'],
    'sceneAnimationSkinCameraRecordsIdentical':all(before['doc'].get(k)==after['doc'].get(k) for k in ('scene','scenes','animations','skins','cameras')),
    'primitiveNamesMaterialBindingsAndAttributeSetsIdentical':before['bindings']==after['bindings'],
    'materialRecordsIdentical':before['doc']['materials']==after['doc']['materials'],
    'restBoundsIdentical':before['bounds']==after['bounds'],
    'byteBudget':after['bytes']<=1000000,
    'textureBudget':len(after['images'])==3 and all(max(image['dimensions'])<=1024 for image in after['images']),
}
report={'result':'PASS' if all(checks.values()) else 'FAIL','checks':checks,
        'before':{k:before[k] for k in ('sha256','bytes','triangles','bounds','images')},
        'after':{k:after[k] for k in ('sha256','bytes','triangles','bounds','images')},
        'trianglesWithChangedNormalCorners':after['triangles']-sum((before['normalCorners']&after['normalCorners']).values()),
        'trianglesWithChangedUVCorners':after['triangles']-sum((before['uvCorners']&after['uvCorners']).values()),
        'scope':'Exact expanded oriented triangle coordinates in local and world space, full rig records and non-normal/non-UV corner data. No browser or independent appearance acceptance.'}
a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'result':report['result'],'afterSHA256':after['sha256'],'checks':checks},indent=2))
if report['result']!='PASS':raise SystemExit(1)
