"""Read-only actual-GLB motion/axes audit; run under CPU Blender.

  env ALSOFT_DRIVERS=null blender -b --factory-startup -noaudio \
    --python-exit-code 1 --python assets/station-defense/check_motion.py

Writes motion-audit.json beside the asset source (or --out). Never changes GLB,
.blend, layout or runtime. BVH broad phase is followed by triangle SAT and exact
segment/triangle intersections. Boundary contact has an explicit narrow scope.
"""
from pathlib import Path
import argparse, hashlib, json, math, sys, time
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

p=argparse.ArgumentParser();p.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[2]);p.add_argument('--out',type=Path)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
ROOT=a.root.resolve();ASSET=ROOT/'public/models/station-defense.glb';SOURCE=ROOT/'assets/station-defense'
OUT=a.out or SOURCE/'motion-audit.json';before=ASSET.read_bytes();started=time.monotonic()
LAYOUT=json.loads((SOURCE/'layout.json').read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ASSET))
C=Matrix(((1,0,0),(0,0,-1),(0,1,0)));CI=C.inverted()
def vg(v):return CI@Vector(v)
root=bpy.data.objects['Bastion'];base=bpy.data.objects['Bastion_Base'];yaw=bpy.data.objects['Bastion_Yaw'];pitch=bpy.data.objects['Bastion_Pitch']
recoil=[bpy.data.objects['Bastion_Recoil_'+s] for s in ('Port','Starboard')]
muzzles=[bpy.data.objects[m['node']] for m in LAYOUT['muzzles']]
assert yaw.parent==root and pitch.parent==yaw
assert (vg(pitch.location)-Vector((0,9,0))).length<1e-6
for obj,contract in zip(muzzles,LAYOUT['muzzles']):
    assert obj.parent==pitch
    assert (vg(obj.location)-Vector(contract['position'])).length<1e-6
    assert obj.rotation_euler.to_matrix().to_quaternion().angle<1e-5
# The glTF importer uses quaternion mode. Euler assignment alone silently leaves
# those objects at rest; explicitly select XYZ and verify actual mesh/world poses.
yaw.rotation_mode='XYZ';pitch.rotation_mode='XYZ'

# glTF may insert material wrapper nodes; walk ancestors rather than assuming
# every mesh is a direct child of the named DOF.
def below(obj,parent):
    while obj:
        if obj==parent:return True
        obj=obj.parent
    return False
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
groups={'base':[],'yaw':[],'pitch':[],'port':[],'starboard':[]}
for obj in objects:
    key='port' if below(obj,recoil[0]) else 'starboard' if below(obj,recoil[1]) else 'pitch' if below(obj,pitch) else 'yaw' if below(obj,yaw) else 'base'
    groups[key].append(obj)
assert all(groups.values()),'Every mechanical assembly must contain exported geometry'
for obj in objects:obj.data.calc_loop_triangles()
bpy.context.view_layer.update()
rest_probes={key:(members[0],members[0].data.vertices[0].co.copy(),
                  vg(members[0].matrix_world@members[0].data.vertices[0].co))
             for key,members in groups.items()}

def geometry(members):
    verts=[];faces=[];names=[]
    for obj in members:
        offset=len(verts);verts.extend(obj.matrix_world@v.co for v in obj.data.vertices)
        faces.extend(tuple(offset+i for i in t.vertices) for t in obj.data.loop_triangles)
        names.extend([obj.name]*len(obj.data.loop_triangles))
    return verts,faces,names,BVHTree.FromPolygons(verts,faces,all_triangles=True)

EPS=2e-6

def triangle_sat(a,b):
    ea=[a[(i+1)%3]-a[i] for i in range(3)];eb=[b[(i+1)%3]-b[i] for i in range(3)]
    na=ea[0].cross(ea[1]);nb=eb[0].cross(eb[1])
    axes=[na,nb]+[u.cross(v) for u in ea for v in eb]+[na.cross(u) for u in ea]+[nb.cross(v) for v in eb]
    for axis in axes:
        if axis.length_squared<1e-18:continue
        axis.normalize();pa=[v.dot(axis) for v in a];pb=[v.dot(axis) for v in b]
        if max(pa)<min(pb)-EPS or max(pb)<min(pa)-EPS:return False
    return True


def sub(a,b):return tuple(float(a[i])-float(b[i]) for i in range(3))
def dot(a,b):return sum(float(a[i])*float(b[i]) for i in range(3))
def cross(a,b):return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])


def segment_triangle(p,q,tri):
    # Python floats preserve double precision through the near-coplanar test;
    # mathutils Vector arithmetic otherwise rounds intermediate barycentrics.
    d=sub(q,p);e1=sub(tri[1],tri[0]);e2=sub(tri[2],tri[0]);h=cross(d,e2);det=dot(e1,h)
    if abs(det)<1e-10*math.sqrt(dot(d,d)*dot(e1,e1)*dot(e2,e2)):return None
    inv=1/det;s=sub(p,tri[0]);u=dot(s,h)*inv
    if u < -EPS or u>1+EPS:return None
    c=cross(s,e1);v=dot(d,c)*inv
    if v < -EPS or u+v>1+EPS:return None
    t=dot(e2,c)*inv
    return tuple(float(p[i])+d[i]*t for i in range(3)) if -EPS<=t<=1+EPS else None


def inside(point,tri):
    e0=sub(tri[1],tri[0]);e1=sub(tri[2],tri[0]);n=cross(e0,e1);length=math.sqrt(dot(n,n))
    if length<1e-10 or abs(dot(sub(point,tri[0]),n))/length>EPS:return False
    v=sub(point,tri[0]);a=dot(e0,e0);b=dot(e0,e1);c=dot(e1,e1);d=dot(v,e0);e=dot(v,e1);den=a*c-b*b
    if abs(den)<1e-14:return False
    u=(c*d-b*e)/den;w=(a*e-b*d)/den
    return u>=-EPS and w>=-EPS and u+w<=1+EPS


def coplanar_clip(a,b,normal):
    # Convex clipping finds edge/edge crossings even when neither triangle has a
    # vertex inside the other. Projection keeps the original 3D intersection.
    axes=[i for i in range(3) if i!=max(range(3),key=lambda j:abs(normal[j]))]
    def xy(v):return (float(v[axes[0]]),float(v[axes[1]]))
    def turn(p,q,r):return (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])
    winding=1 if turn(*[xy(v) for v in b])>=0 else -1
    polygon=[tuple(float(v[i]) for i in range(3)) for v in a]
    for j in range(3):
        edge0,edge1=xy(b[j]),xy(b[(j+1)%3]);epsilon=EPS*math.dist(edge0,edge1)
        def side(v):return winding*turn(edge0,edge1,xy(v))
        output=[]
        for i,point in enumerate(polygon):
            previous=polygon[i-1];fp,fq=side(previous),side(point);ip,iq=fp>=-epsilon,fq>=-epsilon
            if ip!=iq:
                t=max(0,min(1,fp/(fp-fq)))
                output.append(tuple(previous[k]+(point[k]-previous[k])*t for k in range(3)))
            if iq:output.append(point)
        polygon=output
        if not polygon:break
    return polygon


def intersections(a,b):
    normal=cross(sub(a[1],a[0]),sub(a[2],a[0]));length=math.sqrt(dot(normal,normal))
    if length>1e-10 and all(abs(dot(sub(v,a[0]),normal))<=EPS*length for v in b):
        points=coplanar_clip(a,b,normal)
    else:
        points=[]
        for first,second in ((a,b),(b,a)):
            for i in range(3):
                hit=segment_triangle(first[i],first[(i+1)%3],second)
                if hit is not None:points.append(hit)
            points.extend(v for v in first if inside(v,second))
    # Every contact point used by an exemption must actually belong to BOTH
    # triangles. An empty unresolved intersection still fails conservatively.
    return [Vector(v) for v in points if inside(v,a) and inside(v,b)]


# Regression: crossing coplanar triangles without any mutually contained vertex
# form a six-corner overlap. A disjoint coplanar pair has no intersection at all.
star_a=[(0,2,0),(-2,-1,0),(2,-1,0)];star_b=[(0,-2,0),(-2,1,0),(2,1,0)]
star_points=intersections(star_a,star_b)
assert len(star_points)==6 and all(inside(v,star_a) and inside(v,star_b) for v in star_points)
assert not intersections(star_a,[(8,2,0),(6,-1,0),(10,-1,0)])


def expected_contact(keya,keyb,points):
    if not points:return False
    if {keya,keyb}=={'yaw','pitch'}:
        # Intentional trunnion sleeve engagement only. Transform back through yaw
        # so the narrow journal region remains correctly located at every yaw.
        inv=yaw.matrix_world.inverted();p=[vg(inv@v) for v in points]
        if all(6.195<=abs(v.x)<=6.345 and math.hypot(v.y-9,v.z)<=1.65+EPS for v in p):
            return 'trunnion sleeve / fixed journal overlap X[6.20,6.34]'
    if keya=='pitch' and keyb in ('port','starboard') or keyb=='pitch' and keya in ('port','starboard'):
        inv=pitch.matrix_world.inverted();p=[vg(inv@v) for v in points]
        if all(abs(v.z+5.4)<5e-5 and abs(abs(v.x)-4.2)<=1.71 and abs(v.y)<=1.71 for v in p):
            return 'barrel rear end stop at maximum0.6m recoil; boundary only'
    return False

rows=[];failures=[];contacts={};candidate_pairs=0;tested_triangle_pairs=0
pose_assertions=0;max_pose_error=0.0
PAIRS=[('base','yaw'),('base','pitch'),('base','port'),('base','starboard'),('yaw','pitch'),('yaw','port'),('yaw','starboard'),('pitch','port'),('pitch','starboard'),('port','starboard')]
# Pitch41 stations includes exact arc endpoints; recoil0/.3/.6 independently
# samples alternate barrels. Separate24-yaw sweep covers the asymmetric plinth.
poses=[]
for i in range(41):
    angle=-.2+(math.pi/2+.2)*i/40
    for r in (0,.3,.6):poses.append((0,angle,r,0))
    poses.append((0,angle,0,.6))
for i in range(24):poses.append((math.tau*i/24,.1,0,0))
for index,(y,p,r0,r1) in enumerate(poses):
    yaw.rotation_euler=(0,0,y);pitch.rotation_euler=(p,0,0)
    for node,muzzle,r,contract in zip(recoil,muzzles,(r0,r1),LAYOUT['muzzles']):
        node.location=C@Vector((0,0,r));muzzle.location=C@Vector((contract['position'][0],0,-29+r))
    bpy.context.view_layer.update()
    game_yaw=Matrix.Rotation(y,3,'Y');game_pitch=Matrix.Rotation(p,3,'X');pivot=Vector(LAYOUT['pitchPivot'])
    for key,(obj,local,rest) in rest_probes.items():
        expected=rest.copy()
        if key in ('pitch','port','starboard'):
            offset=Vector((0,0,r0 if key=='port' else r1 if key=='starboard' else 0))
            expected=pivot+game_pitch@(expected-pivot+offset)
        if key!='base':expected=game_yaw@expected
        error=(vg(obj.matrix_world@local)-expected).length
        assert error<5e-5, f'Actual {key} mesh did not follow requested pose: {error}'
        max_pose_error=max(max_pose_error,error);pose_assertions+=1
    muzzle_world=[]
    for muzzle,r,contract in zip(muzzles,(r0,r1),LAYOUT['muzzles']):
        point=Vector(contract['position'])+Vector((0,0,r))
        expected=game_yaw@(pivot+game_pitch@point)
        actual=vg(muzzle.matrix_world.translation);error=(actual-expected).length
        direction=vg(muzzle.matrix_world.to_3x3()@C@Vector((0,0,-1))).normalized()
        expected_direction=(game_yaw@game_pitch@Vector((0,0,-1))).normalized()
        assert error<5e-5 and direction.dot(expected_direction)>1-1e-6, 'Muzzle pose assertion failed'
        max_pose_error=max(max_pose_error,error);pose_assertions+=1
        muzzle_world.append({'position':list(actual),'direction':list(direction)})
    cache={key:geometry(members) for key,members in groups.items()}
    frame_hits=0
    for keya,keyb in PAIRS:
        av,af,an,at=cache[keya];bv,bf,bn,bt=cache[keyb]
        candidates=at.overlap(bt);candidate_pairs+=len(candidates)
        for ia,ib in candidates:
            ta=[av[v] for v in af[ia]];tb=[bv[v] for v in bf[ib]]
            tested_triangle_pairs+=1
            if not triangle_sat(ta,tb):continue
            pts=intersections(ta,tb);contact=expected_contact(keya,keyb,pts)
            if contact:
                contacts[contact]=contacts.get(contact,0)+1;continue
            frame_hits+=1
            if len(failures)<32:
                failures.append({'pose':index,'yaw':y,'pitch':p,'recoil':[r0,r1],'assemblies':[keya,keyb],
                                 'meshes':[an[ia],bn[ib]],'triangleIndices':[ia,ib],
                                 'intersectionPoints':[list(vg(v)) for v in pts[:6]],
                                 'triangleA':[list(vg(v)) for v in ta], 'triangleB':[list(vg(v)) for v in tb]})
    # Both bore-centre forward rays must be clear of every assembly. This verifies
    # actual posed exported geometry at the exact named emitter positions.
    allgeom=geometry(objects);verts,faces,names,tree=allgeom
    ray_hits=[]
    for muzzle in muzzles:
        direction=muzzle.matrix_world.to_3x3()@C@Vector((0,0,-1));direction.normalize()
        origin=muzzle.matrix_world.translation
        hit=tree.ray_cast(origin+direction*.002,direction,100)
        if hit[0] is not None:ray_hits.append({'muzzle':muzzle.name,'mesh':names[hit[2]],'distance':hit[3]})
    if ray_hits:failures.append({'pose':index,'forwardRayHits':ray_hits})
    rows.append({'yaw':y,'pitch':p,'recoil':[r0,r1],'muzzleWorld':muzzle_world,
                 'unexpectedCrossingPairs':frame_hits,'forwardRayHits':len(ray_hits)})
    if index%20==0:print('Bastion actual GLB sweep',index+1,'/',len(poses),'unexpected',frame_hits,flush=True)
    # Bound diagnosis on a defective candidate rather than grinding on hundreds
    # of already-invalid poses; the report explicitly records incomplete scope.
    if len(failures)>=32:break
assert ASSET.read_bytes()==before,'Input GLB changed during read-only motion audit'
report={'asset':'public/models/station-defense.glb','sha256':hashlib.sha256(before).hexdigest(),
        'method':'Imported actual GLB triangles; BVH candidate pairs screened by triangle SAT and intersection points',
        'plannedPoses':len(poses),'evaluatedPoses':len(rows),'complete':len(rows)==len(poses),
        'pitchLimits':[-.2,math.pi/2],'recoilRange':[0,.6],'yawSamples':24,
        'triangles':sum(len(o.data.loop_triangles) for o in objects),
        'candidatePairs':candidate_pairs,'exactTrianglePairsTested':tested_triangle_pairs,
        'poseAssertions':pose_assertions,'maximumPoseErrorMetres':max_pose_error,
        'poseValidation':'Explicit XYZ mode; independent game-space matrix checks against actual mesh vertices and both muzzle world poses at every sample',
        'intentionalContacts':contacts,'failures':failures,'rows':rows,'elapsedSeconds':time.monotonic()-started,
        'result':'PASS' if not failures and len(rows)==len(poses) else 'FAIL',
        'limits':['Finite pose sample, not a continuous sweep theorem','Includes triangle crossing and bore-centre forward rays, not arbitrary closed-solid containment or station mounting geometry','No visual, runtime, material or performance acceptance']}
OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(report,indent=2)+'\n')
print('BASTION_MOTION '+json.dumps({k:report[k] for k in ('result','sha256','plannedPoses','evaluatedPoses','candidatePairs','elapsedSeconds')}))
if report['result']!='PASS':raise RuntimeError('Bastion actual-geometry motion audit failed; inspect '+str(OUT))
