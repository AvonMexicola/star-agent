"""Strict additive Bastion07-to08 delta and full articulation-cylinder certificate.\nNo browser, Blender renderer, production edits or visual acceptance.\n"""
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
    bindings=[];vertices=[];total=0;bounds_min=[math.inf]*3;bounds_max=[-math.inf]*3
    for node_index,node in enumerate(doc['nodes']):
        if 'mesh' not in node:continue
        for primitive_index,primitive in enumerate(doc['meshes'][node['mesh']]['primitives']):
            assert primitive.get('mode',4)==4
            attributes={name:attribute(index) for name,index in primitive['attributes'].items()}
            lineage=[];current=node_index
            while True:
                lineage.append(doc['nodes'][current]['name'])
                if current not in parents:break
                current=parents[current]
            for vertex_index,value in enumerate(attributes['POSITION']):
                vertices.append({'node':node['name'],'index':vertex_index,'rest':point(world(node_index),value),
                    'pitch':'Bastion_Pitch' in lineage,'recoil':any(n.startswith('Bastion_Recoil_') and not n.endswith(('_PBR','_Powered')) for n in lineage)})
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
            'bounds':{'min':bounds_min,'max':bounds_max},'vertices':vertices}


before,after=load(a.before),load(a.after)
added=after['local']-before['local'];missing=before['local']-after['local']
added_by_mesh=Counter()
added_vertices=[]
for (prefix,points),count in added.items():
    added_by_mesh[prefix[0]]+=count
    added_vertices.extend({'node':prefix[0],'point':p} for p in points)
# Conservative handoff boxes apply only to the newly added vertices. They are
# not contact exemptions. Matching actual-triangle motion still checks all parts.
def allowed_addition(node,p):
    x,y,z=p
    if node=='Bastion_Yaw_PBR':
        return 8.5429<=abs(x)<=8.7041 and 5.3199<=y<=10.7201 and -1.7201<=z<=4.2401
    if node=='Bastion_Pitch_PBR':
        return 6.1679<=abs(x)<=6.3121 and -1.5001<=y<=1.5001 and -5.0201<=z<=-1.8799
    return False

# Exact continuous articulation envelope over all actual GLB vertices.
# For local pitch coordinates (x,y,z), recoil t translates z before +X rotation:
#   Y = 9 + y*cos(theta) - (z+t)*sin(theta)
#   Z = y*sin(theta) + (z+t)*cos(theta).
# Each scalar extremum occurs at an interval endpoint or its analytic stationary
# angle. At fixed theta Y is affine in t and radial distance is convex in t;
# therefore t endpoints certify the complete interval. Unlimited +Y yaw preserves
# sqrt(X^2+Z^2) and Y. A cylinder is convex, so its contained vertices contain the
# complete triangles, not only the sampled corners, at every articulated pose.
PITCH_MIN,PITCH_MAX=-.20,math.pi/2
limits={'radius':29.6,'minY':0.0,'maxY':38.1}
max_r={'value':-math.inf};min_y={'value':math.inf};max_y={'value':-math.inf}
angles_evaluated=0

def extrema_angles(cos_coeff,sin_coeff):
    base=math.atan2(sin_coeff,cos_coeff)
    return [PITCH_MIN,PITCH_MAX]+[t for k in range(-2,3) if PITCH_MIN<= (t:=base+k*math.pi) <=PITCH_MAX]

def measure(vertex,theta,travel,p):
    global max_r,min_y,max_y,angles_evaluated
    angles_evaluated+=1
    radius=math.hypot(p[0],p[2]);witness={'node':vertex['node'],'vertex':vertex['index'],
        'rest':vertex['rest'],'pitch':theta,'recoil':travel,'pointAtYawZero':p}
    if radius>max_r['value']:max_r={'value':radius,**witness}
    if p[1]<min_y['value']:min_y={'value':p[1],**witness}
    if p[1]>max_y['value']:max_y={'value':p[1],**witness}

for vertex in after['vertices']:
    x,y,z=vertex['rest']
    if not vertex['pitch']:
        measure(vertex,None,0,(x,y,z));continue
    y-=9
    for travel in ((0,.6) if vertex['recoil'] else (0,)):
        c=z+travel
        candidates=set(extrema_angles(y,-c)+extrema_angles(c,y))
        for theta in candidates:
            cosine,sine=math.cos(theta),math.sin(theta)
            measure(vertex,theta,travel,(x,9+y*cosine-c*sine,y*sine+c*cosine))
bound_pass=max_r['value']<=limits['radius'] and min_y['value']>=limits['minY'] and max_y['value']<=limits['maxY']
certificate={'result':'PASS' if bound_pass else 'FAIL','method':'All actual exported vertices; analytic pitch extrema, convex/affine recoil endpoints, yaw-invariant cylinder',
    'vertices':len(after['vertices']),'extremaEvaluations':angles_evaluated,'pitchInterval':[PITCH_MIN,PITCH_MAX],'recoilInterval':[0,.6],
    'yaw':'Unrestricted; cylinder invariant under +Y rotation','testedCylinder':limits,
    'maxRadius':max_r,'minY':min_y,'maxY':max_y,
    'margins':{'radial':limits['radius']-max_r['value'],'floor':min_y['value']-limits['minY'],'ceiling':limits['maxY']-max_y['value']},
    'limits':'Analytic enclosing-volume certificate, not a self-intersection or station placement test. Matching188 actual geometry poses and fresh station audit remain separate.'}
checks={
    'baseline07Identity':before['sha256']=='6a0bfd851bc35f4dcc2fc300ea3d2abd16325b506ad0521580dd019ca45c615b',
    'exactAdditiveCount':before['triangles']==9177 and after['triangles']==9877 and sum(added.values())==700,
    'allOriginalOrientedLocalTrianglesRetained':not missing,
    'allOriginalOrientedWorldTrianglesRetained':not (before['world']-after['world']),
    'allOriginalNormalsRetained':not (before['normalCorners']-after['normalCorners']),
    'allOriginalUVsRetained':not (before['uvCorners']-after['uvCorners']),
    'additionsOnlyInDeclaredParents':dict(added_by_mesh)=={'Bastion_Pitch_PBR':304,'Bastion_Yaw_PBR':396},
    'allAddedVerticesInDeclaredLocalRegions':all(allowed_addition(v['node'],v['point']) for v in added_vertices),
    'nodeRecordsIdentical':before['doc']['nodes']==after['doc']['nodes'],
    'sceneAnimationSkinCameraRecordsIdentical':all(before['doc'].get(k)==after['doc'].get(k) for k in ('scene','scenes','animations','skins','cameras')),
    'primitiveNamesMaterialBindingsAndAttributeSetsIdentical':before['bindings']==after['bindings'],
    'materialRecordsIdentical':before['doc']['materials']==after['doc']['materials'],
    'restBoundsIdentical':before['bounds']==after['bounds'],
    'continuousActualVertexCylinder':bound_pass,
    'byteBudget':after['bytes']<=1000000,
    'textureBudget':len(after['images'])==3 and all(image['dimensions']==[512,512] for image in after['images']),
}
report={'result':'PASS' if all(checks.values()) else 'FAIL','checks':checks,
    'before':{k:before[k] for k in ('sha256','bytes','triangles','bounds','images')},
    'after':{k:after[k] for k in ('sha256','bytes','triangles','bounds','images')},
    'additionsByMesh':dict(added_by_mesh),'addedTriangles':sum(added.values()),'missingOriginalTriangles':sum(missing.values()),
    'originalTrianglesWithChangedAO':before['triangles']-sum((before['fixedCorners']&after['fixedCorners']).values()),
    'articulationCylinder':certificate,
    'scope':'Exact additive07-to08 geometry/UV/normal/rig comparison. Contact AO may change from the new physically measured attachments and is counted explicitly. This is not native appearance approval, a continuous self-intersection proof, station placement approval or live firing-arc clearance.'}
a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'result':report['result'],'afterSHA256':after['sha256'],'checks':checks,'articulationCylinder':certificate},indent=2))
if report['result']!='PASS':raise SystemExit(1)
