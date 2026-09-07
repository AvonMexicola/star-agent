"""Rebuildable Aeon exterior massing kit. Game metres, Y up, origin at port centre.

  env ALSOFT_DRIVERS=null blender -b --factory-startup -noaudio \
    --python-exit-code 1 --python blender/build_station_exterior.py

The existing bay and concourse assets are untouched. One fixed assembly plus one
ring template: runtime clones the ring at X +/-1110 with independent rotation.
This geometry checkpoint uses local metre UVs and baked vertex contact shading;
unique Meshy painting and final art acceptance are separate, pending gates.
"""
import argparse
import hashlib
import json
import math
import re
import sys
from collections import defaultdict
from pathlib import Path
import bpy
import bmesh
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
LOD = '--lod' in sys.argv
OUT = ROOT / ('public/models/station-exterior-lod1.glb' if LOD else 'public/models/station-exterior.glb')
SOURCE = ROOT / 'assets/station/exterior'
TAU = math.tau
CSS = (ROOT / 'src/style.css').read_text()
BATCHES = {}
CACHE = {}
PARTS = []
ASSEMBLY = 'FixedStructure'
MATS = {}

def xyz(p): return Vector((p[0], -p[2], p[1]))
def rgb(token):
    h = re.search(r'--'+token+r':\s*#([0-9a-fA-F]{6})', CSS).group(1)
    c = [int(h[i:i+2],16)/255 for i in (0,2,4)]
    return [v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]

def material(name, token, metallic, roughness, emission=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    c=rgb(token); m.diffuse_color=(*c,1)
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*c,1)
    bs.inputs['Metallic'].default_value=metallic
    bs.inputs['Roughness'].default_value=roughness
    if emission:
        bs.inputs['Emission Color'].default_value=(*c,1)
        bs.inputs['Emission Strength'].default_value=emission
    else:
        attr=m.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='Col'
        # The export carries per-vertex contact and panel value, multiplied by
        # this base coat by glTF's native COLOR_0 path.
        mix=m.node_tree.nodes.new('ShaderNodeMix');mix.data_type='RGBA';mix.blend_type='MULTIPLY'
        mix.inputs['Factor'].default_value=1;mix.inputs[6].default_value=(*c,1)
        m.node_tree.links.new(attr.outputs['Color'],mix.inputs[7])
        m.node_tree.links.new(mix.outputs[2],bs.inputs['Base Color'])
    MATS[name]=m

for spec in [('ExteriorIvory','station-ivory',.12,.68),
             ('ExteriorDark','station-dark',.24,.7),
             ('ExteriorSteel','station-steel',.52,.44),
             ('ExteriorPetrol','station-petrol',.12,.65),
             ('ExteriorOchre','station-ochre',.14,.72),
             ('ExteriorMint','mint',0,.55,1.25),
             ('ExteriorWindow','station-warm',0,.6,.7)]: material(*spec)


def transformed_geometry(verts,faces,bevel):
    if LOD:bevel=0
    key=(tuple(tuple(v) for v in verts),tuple(tuple(f) for f in faces),bevel)
    if key in CACHE: return CACHE[key]
    mesh=bpy.data.meshes.new('Temporary stock')
    mesh.from_pydata([xyz(v) for v in verts],[],faces)
    bm=bmesh.new();bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    if bevel:
        bmesh.ops.bevel(bm,geom=list(bm.edges),offset=bevel,segments=2 if bevel>=1 else 1,affect='EDGES',clamp_overlap=True)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(mesh);bm.free();mesh.update()
    result=([v.co.copy() for v in mesh.vertices], [tuple(p.vertices) for p in mesh.polygons])
    bpy.data.meshes.remove(mesh);CACHE[key]=result
    return result

def add(name, verts, faces, mat, p=(0,0,0), rotation=None, bevel=0, tone=1, detail=False):
    points,polys=transformed_geometry(verts,faces,bevel)
    R=rotation or Matrix.Identity(3)
    # Rotation is authored in game axes; convert through Blender axes once.
    C=Matrix(((1,0,0),(0,0,-1),(0,1,0)))
    transform=C @ R @ C.inverted()
    points=[transform @ v+xyz(p) for v in points]
    key=(ASSEMBLY,mat,detail)
    batch=BATCHES.setdefault(key,{'verts':[],'faces':[],'tones':[]})
    offset=len(batch['verts']);batch['verts'].extend(points)
    batch['faces'].extend(tuple(offset+i for i in face) for face in polys)
    batch['tones'].extend([tone]*len(points))
    bounds=[[min(v[i] for v in points),max(v[i] for v in points)] for i in range(3)]
    PARTS.append({'name':name,'assembly':ASSEMBLY,'material':mat,'collision':not detail,
        'min':[bounds[0][0],bounds[2][0],-bounds[1][1]],
        'max':[bounds[0][1],bounds[2][1],-bounds[1][0]]})

def box(name,p,size,mat='ExteriorIvory',bevel=.6,rotation=None,tone=1,detail=False):
    x,y,z=[v/2 for v in size]
    verts=[(a,b,c) for a in (-x,x) for b in (-y,y) for c in (-z,z)]
    faces=[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)]
    add(name,verts,faces,mat,p,rotation,min(bevel,min(size)*.22),tone,detail)

def beam(name,a,b,width,depth,mat='ExteriorSteel',bevel=.5):
    a,b=Vector(a),Vector(b);delta=b-a
    R=Vector((0,1,0)).rotation_difference(delta.normalized()).to_matrix()
    box(name,(a+b)/2,(width,delta.length,depth),mat,bevel,R)

def profile(name,outline,lo,hi,mat='ExteriorIvory',bevel=.8):
    # Horizontal X/Z plan, tapered/chamfered ends are silhouette, not decals.
    n=len(outline)
    verts=[(x,y,z) for y in (lo,hi) for x,z in outline]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    add(name,verts,faces,mat,bevel=bevel)

def sleeve(name,inner,outer,x0,x1,mat='ExteriorSteel',segments=64,a0=0,a1=TAU):
    full=abs(a1-a0-TAU)<1e-5;count=segments if full else segments+1
    verts=[]
    for i in range(count):
        a=a0+(a1-a0)*i/segments
        verts.extend((x,math.cos(a)*r,math.sin(a)*r) for x,r in ((x0,inner),(x0,outer),(x1,inner),(x1,outer)))
    faces=[]
    for i in range(segments):
        j=(i+1)%count;a=i*4;b=j*4
        faces.extend([(a,a+1,b+1,b),(a+2,b+2,b+3,a+3),(a,b,b+2,a+2),(a+1,a+3,b+3,b+1)])
    if not full:faces.extend([(0,2,3,1),tuple((count-1)*4+i for i in (0,1,3,2))])
    add(name,verts,faces,mat)

def windowpane(angle,radius,dx,width=12,height=4):
    verts=[(0,-height/2,-width/2),(0,-height/2,width/2),(0,height/2,width/2),(0,height/2,-width/2)]
    add('Warm habitat aperture',verts,[(0,1,2,3)],'ExteriorWindow',
        (dx,math.cos(angle)*radius,math.sin(angle)*radius),Matrix.Rotation(angle,3,'X'),detail=True)

def ringbox(name,angle,radius,dx,size,mat='ExteriorIvory',bevel=.5,tone=1,detail=False):
    R=Matrix.Rotation(angle,3,'X')
    box(name,(dx,math.cos(angle)*radius,math.sin(angle)*radius),size,mat,bevel,R,tone,detail)

# Clear the default camera/cube; materials survive.
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

# FIXED STRUCTURE: tapered longitudinal pressure blocks with a lower open truss.
# The central service core sits beneath, never through, the occupied concourse.
profile('Reactor keel',[(-200,-76),(-154,-124),(154,-124),(200,-76),(200,76),(154,124),(-154,124),(-200,76)],-166,-42,'ExteriorDark',3)
profile('Core shoulder armour',[(-174,-68),(-126,-100),(126,-100),(174,-68),(174,68),(126,100),(-126,100),(-174,68)],-72,-29,'ExteriorIvory',2)
profile('Underslung reactor neck',[(-95,-58),(-62,-87),(62,-87),(95,-58),(95,58),(62,87),(-62,87),(-95,58)],-227,-142,'ExteriorSteel',2)
for side in (-1,1):
    box('Reactor cooling recess',(0,-133,side*125),(190,32,4),'ExteriorPetrol',1)
    for x in range(-84,85,14): box('Reactor louver',(x,-134,side*129),(3.2,28,7),'ExteriorSteel',.4)
    for x in (-138,138):
        beam('Core load frame',(x,-161,side*76),(x,-43,side*101),12,13,'ExteriorSteel',1)
    box('Core service stripe',(0,-79,side*101.5),(135,6,2.3),'ExteriorOchre',.3)
    box('Core light recess',(0,-94,side*124.5),(110,3.8,2),'ExteriorDark',.4)
    box('Core locator strip',(0,-94,side*126),(90,1.1,.6),'ExteriorMint',0,detail=True)

# Ten aligned stations along each spine, with chamfered separate pressure cassettes.
for i in range(10):
    x=(i-4.5)*190
    outline=[(x-89,-28),(x-76,-42),(x+76,-42),(x+89,-28),(x+89,28),(x+76,42),(x-76,42),(x-89,28)]
    profile('Spine pressure cassette',outline,-59,-18,'ExteriorIvory',.9)
    for z in (-44,44):
        box('Spine rub rail',(x,-48,z),(178,7,6),'ExteriorDark',.8)
        box('Spine service trunk',(x,-28,z),(136,9,3),'ExteriorPetrol',.5)
        box('Spine access lid',(x,-28,z*1.04),(35,7,2),'ExteriorOchre',.3)
        beam('Spine Warren web',(x-92,-85,z),(x,-59,z),6,6)
        beam('Spine Warren web',(x,-59,z),(x+92,-85,z),6,6)
    box('Lower spine chord',(x,-87,0),(191,10,72),'ExteriorSteel',.8)
    if i<9: box('Pressure coupling',(x+95,-36,0),(16,49,66),'ExteriorDark',1)

# Every berth keeps its exact original placement and unobstructed outward lane.
# Each arm attaches to the rear/underside, behind the existing hangar envelope.
for i in range(20):
    x=((i%10)-4.5)*190;side=-1 if i<10 else 1
    z=lambda v:side*v
    box('Passenger/service pressure arm',(x,-23,z(266)),(18,18,460),'ExteriorPetrol',.8)
    for dx in (-10.6,10.6):
        box('Arm protective rail',(x+dx,-18,z(268)),(2.2,4,450),'ExteriorIvory',.35)
    # Heavy fork tapers from a wide heel into the bay support cradle.
    for dx in (-1,1):
        beam('Tapered berth load fork',(x+dx*30,-64,z(52)),(x+dx*13,-28,z(492)),7,10,'ExteriorSteel',.7)
        for distance in (132,226,320,414):
            t=(distance-52)/440;spread=30+(13-30)*t;height=-64+36*t
            beam('Arm triangulation',(x+dx*spread,height,z(distance)),(x+dx*10,-21,z(distance+48)),3.3,4,'ExteriorSteel',.3)
    for distance in (106,202,298,394,484):
        box('Arm expansion saddle',(x,-23,z(distance)),(25,25,7),'ExteriorIvory',.7)
        box('Saddle service stripe',(x,-9.9,z(distance)),(17,1.1,5),'ExteriorOchre',.15)
    box('Bay docking cradle',(x,-20,z(494)),(40,23,28),'ExteriorDark',.9)
    box('Cradle upper cap',(x,-10.3,z(488)),(35,2.3,17),'ExteriorIvory',.4)

# Reactor heat rejection: pairs of planar radiator wings with structural trunks.
for side in (-1,1):
    for front in (-1,1):
        for k in range(3):
            x=side*(230+k*98);z=front*138
            box('Radiator wing bed',(x,-141,z),(90,7,118),'ExteriorDark',.9)
            box('Radiator ceramic face',(x,-136.9,z),(85,1.4,111),'ExteriorIvory',.2)
            for dx in (-31,-10,10,31):
                box('Radiator fin seam',(x+dx,-136.12,z),(1.15,.22,108),'ExteriorSteel',0,detail=True)
            box('Radiator edge clamp',(x,-135.5,z+front*54),(78,2.5,4),'ExteriorSteel',.4)
        beam('Radiator header',(side*158,-153,front*138),(side*473,-153,front*138),11,15,'ExteriorSteel',.8)
        beam('Radiator diagonal brace',(side*162,-202,front*42),(side*425,-147,front*138),7,7,'ExteriorDark',.6)

# Central concourse proxy has the same occupied volume and same visibility swap.
ASSEMBLY='HubShellDetail'
box('Concourse exterior proxy',(0,-3.5,0),(44,9,38),'ExteriorPetrol',.8,detail=True)
# Everything else around the hub stays below or outside its windowed envelope.
ASSEMBLY='FixedStructure'
for side in (-1,1):
    box('Concourse support',(side*26,-20.5,0),(5,23,46),'ExteriorSteel',.5)
    beam('Concourse root brace',(side*57,-41,0),(side*26,-12,0),7,11)

box('Concourse floor cradle',(0,-9.1,0),(54,1.0,40),'ExteriorSteel',.2)

# Separate fixed bearing housings have an axial throat for rotating spokes.
# The ring template's hub shoulders lie inside these, with 8 m radial clearance.
for centre in (-1110,1110):
    for dx in (-96,96):
        sleeve('Fixed bearing housing',108,137,centre+dx-13,centre+dx+13,'ExteriorIvory')
        sleeve('Bearing service belt',134,141,centre+dx-4,centre+dx+4,'ExteriorOchre')
        for k in range(8):
            a=k*TAU/8
            box('Bearing retention pad',(centre+dx,math.cos(a)*137,math.sin(a)*137),(30,12,20),'ExteriorSteel',1,Matrix.Rotation(a,3,'X'))
    # Fixed torque tube passes through the rotor's hollow centre. Bearing
    # supports sit on the OUTSIDE axial faces, never across the spoke sweep.
    box('Fixed central torque tube',(centre,0,0),(294,72,72),'ExteriorSteel',2)
    side=1 if centre<0 else -1
    beam('Bearing spine root',(centre+side*155,-37,0),(centre+side*144,0,0),72,74,'ExteriorDark',2)
    for dx in (-130,130):
        for k in range(4):
            a=k*TAU/4+TAU/8
            beam('Bearing stationary end support',
                 (centre+dx,math.cos(a)*42,math.sin(a)*42),
                 (centre+dx,math.cos(a)*125,math.sin(a)*125),10,11,'ExteriorSteel',.8)
            beam('Bearing outer axial bracket',
                 (centre+dx,math.cos(a)*125,math.sin(a)*125),
                 (centre+math.copysign(108,dx),math.cos(a)*125,math.sin(a)*125),10,11,'ExteriorSteel',.8)

# RING TEMPLATE, local X rotation origin. Assembled twice by the runtime.
ASSEMBLY='RingTemplate'
sleeve('Rotor central axle',64,92,-117,117,'ExteriorDark')
for dx in (-96,96):
    sleeve('Rotor bearing race',91,100,dx-16,dx+16,'ExteriorSteel')
    sleeve('Rotor collar marking',90,94,dx-18,dx-15,'ExteriorOchre')
sleeve('Spoke root flange',85,158,-48,48,'ExteriorSteel')
for dx in (-51,51):sleeve('Flange armour segments',126,160,dx-3,dx+3,'ExteriorIvory',48)

# Six forked structural spokes: deep roots, separated chords and intermediate ties.
for k in range(6):
    a=k*TAU/6
    for dx in (-31,31):
        def at(rad,tangent=0):
            return (dx,math.cos(a)*rad-math.sin(a)*tangent,math.sin(a)*rad+math.cos(a)*tangent)
        for edge in (-1,1):
            beam('Spoke taper chord',at(145,edge*35),at(1395,edge*17),12,14,'ExteriorSteel',.8)
        for radius in (286,495,704,913,1122,1331):
            t=(radius-145)/1250;spread=35-18*t
            beam('Spoke web cross',at(radius,-spread),at(radius+104,spread-1.5),5,6,'ExteriorDark',.5)
            ringbox('Spoke transverse tie',a,radius,dx,(16,9,spread*2+10),'ExteriorIvory',.6)
    ringbox('Spoke root armour',a,224,0,(108,162,68),'ExteriorIvory',2)
    ringbox('Root access recess',a,247,56,(2,67,43),'ExteriorPetrol',.4)
    ringbox('Root service panel',a,247,57.5,(1.2,39,28),'ExteriorOchre',.2)
    ringbox('Habitat load collar',a,1438,0,(128,84,92),'ExteriorSteel',2)
    ringbox('Collar outer armour',a,1484,0,(118,13,82),'ExteriorIvory',1.1)
    ringbox('Ring sector marker',a,1492,0,(80,1.2,19),'ExteriorOchre',.2)

# Continuous pressure annulus with segmented manufactured skins. The connected
# inner belt remains readable between modules, instead of separated toy beads.
sleeve('Pressure ring core',1417,1475,-46,46,'ExteriorDark',192)
for dx in (-49,49):sleeve('Habitat rim seal',1416,1477,dx-2.5,dx+2.5,'ExteriorSteel',192)
for k in range(96):
    a=k*TAU/96;half=TAU/96*.455
    tone=(1,.94,.86,1,.94,1)[(k//4)%6]
    # A wedge follows the actual circular ring, with narrow mechanical seams.
    sleeve('Ring pressure cladding',1420,1490,-56,56,'ExteriorIvory' if k%8<6 else 'ExteriorPetrol',2,a-half,a+half)
    ringbox('Ring exterior access lid',a,1491.6,0,(61,2.8,39),'ExteriorSteel',.4 if k%4==0 else 0,tone)
    for dx in (-58,58):
        ringbox('Habitat window recess',a,1458,dx,(3,13,57),'ExteriorDark',0)
        for tangent in (-18,0,18):
            # Three human-scale bands per 95 m sector, split by real mullions.
            aa=a+tangent/1458
            windowpane(aa,1458,dx+math.copysign(1.7,dx))
        ringbox('Habitat lower service plate',a,1434,dx,(3,9,46),'ExteriorSteel',0)
    if k%4==0:
        for dx in (-39,39):ringbox('Outer rim locator',a,1493.5,dx,(5,1.1,13),'ExteriorMint',0,detail=True)

SOURCE.mkdir(parents=True,exist_ok=True);OUT.parent.mkdir(parents=True,exist_ok=True)
parents={}
for name in ('FixedStructure','HubShellDetail','RingTemplate'):
    obj=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(obj);parents[name]=obj

# Save contact shading in the actual export, independent for each moving group.
# Conservative short reach avoids imprinting a fixed yoke shadow onto a rotor.
objects=[]
for (assembly,mat,detail),data in BATCHES.items():
    mesh=bpy.data.meshes.new(assembly+'_'+mat)
    mesh.from_pydata(data['verts'],[],data['faces']);mesh.update()
    obj=bpy.data.objects.new(assembly+('_Detail_' if detail else '_')+mat,mesh)
    bpy.context.collection.objects.link(obj);obj.parent=parents[assembly]
    mesh.materials.append(MATS[mat]);objects.append(obj)
    uv=mesh.uv_layers.new(name='MetreUV')
    for f in mesh.polygons:
        axis=max(range(3),key=lambda j:abs(f.normal[j]));axes=[j for j in range(3) if j!=axis]
        for li in f.loop_indices:
            v=mesh.vertices[mesh.loops[li].vertex_index].co
            uv.data[li].uv=(v[axes[0]]/2,v[axes[1]]/2)
    if not detail:
        col=mesh.color_attributes.new(name='Col',type='BYTE_COLOR',domain='CORNER')
        # Contact shading is added after all physical surfaces are assembled.
        obj['tone_values']=data['tones']

for assembly in parents:
    members=[o for o in objects if o.parent==parents[assembly] and 'Detail_' not in o.name]
    verts=[];faces=[]
    for obj in members:
        offset=len(verts);verts.extend(v.co.copy() for v in obj.data.vertices)
        faces.extend(tuple(offset+i for i in f.vertices) for f in obj.data.polygons)
    if not verts:continue
    tree=BVHTree.FromPolygons(verts,faces,all_triangles=False)
    for obj in members:
        mesh=obj.data;col=mesh.color_attributes.get('Col');tones=obj['tone_values'];cache={}
        for poly in mesh.polygons:
            n=poly.normal.normalized()
            ref=Vector((1,0,0)) if abs(n.x)<.85 else Vector((0,1,0))
            u=n.cross(ref).normalized();v=n.cross(u)
            dirs=[n]+[(n*.7+(u*math.cos(a)+v*math.sin(a))*.714).normalized() for a in (0,TAU/3,TAU*2/3)]
            for li in poly.loop_indices:
                vi=mesh.loops[li].vertex_index;key=(vi,tuple(round(c,3) for c in n))
                if key not in cache:
                    p=mesh.vertices[vi].co+n*.09;occlusion=0
                    for d in dirs:
                        hit=tree.ray_cast(p,d,5.5)
                        if hit[0] is not None:occlusion+=max(0,1-hit[3]/5.5)/len(dirs)
                    cache[key]=max(.62,1-.34*occlusion)*tones[vi]
                value=cache[key];col.data[li].color=(value,value,value,1)
        del obj['tone_values']

bpy.context.view_layer.update()
# Complete editable source, no scene cameras or user machine settings.
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/('station-exterior-lod1.blend' if LOD else 'station-exterior.blend')),compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',export_animations=False,
    export_cameras=False,export_lights=False,export_extras=True,export_yup=True,
    export_apply=True,export_texcoords=False,export_normals=True,export_materials='EXPORT')
# Station-wide batches span kilometres; 4 cm is below their authored smallest
# solid feature (0.22 m) and independent of protected bay/door/room geometry.
sys.path.insert(0,str(ROOT/'blender'))
from pack_rigid_geometry import pack_geometry
packing=pack_geometry(OUT,maximum_error=.04)
# Read actual glTF primitive counts, not authoring polygon guesses.
data=OUT.read_bytes();length=int.from_bytes(data[12:16],'little');gltf=json.loads(data[20:20+length])
records=[]
for mesh in gltf.get('meshes',[]):
    tris=sum(gltf['accessors'][p['indices']]['count']//3 for p in mesh['primitives'])
    records.append({'name':mesh.get('name'),'triangles':tris,'primitives':len(mesh['primitives'])})
fixed=sum(r['triangles'] for r in records if not r['name'].startswith('RingTemplate'))
ring=sum(r['triangles'] for r in records if r['name'].startswith('RingTemplate'))
manifest={'stage':'geometry checkpoint; final painting and acceptance pending',
    'builder':'blender/build_station_exterior.py','units':'metres','axes':'Y up',
    'asset':str(OUT.relative_to(ROOT)),'sha256':hashlib.sha256(data).hexdigest(),
    'bytes':len(data),'packing':packing,'storedTriangles':fixed+ring,'assembledTriangles':fixed+ring*2,
    'fixedTriangles':fixed,'ringTriangles':ring,'storedPrimitives':sum(r['primitives'] for r in records),
    'assembledPrimitives':sum(r['primitives']*(2 if r['name'].startswith('RingTemplate') else 1) for r in records),
    'ringCentres':[[-1110,0,0],[1110,0,0]],'ringRadius':1450,'meshes':records,'assemblies':PARTS,
    'uv':'metre UVs retained in blend; runtime reconstructs local projection from decoded positions/normals, avoiding repeated tile-UV payload; not a unique painting atlas',
    'colour':'CSS-derived sRGB tokens converted to linear material constants; short-range vertex contact shading',
    'noExternalGeometry':True}
(SOURCE/('lod1-manifest.json' if LOD else 'manifest.json')).write_text(json.dumps(manifest,indent=2)+'\n')
print('EXPORTED',json.dumps({k:v for k,v in manifest.items() if k in ['bytes','storedTriangles','assembledTriangles','assembledPrimitives','sha256']}))
