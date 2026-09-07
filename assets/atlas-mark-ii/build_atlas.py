"""Original Atlas Mark II — manufactured heavy logistics spacecraft.
Blender 5.2: blender -b --factory-startup -noaudio --python-exit-code 1 --python assets/atlas-mark-ii/build_atlas.py
Authoring coordinates metres, Y up, -Z forward. Layout JSON owns moving geometry.
"""
import sys,math,json,time,hashlib
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
sys.path.insert(0,str(HERE))
import geo as g
g.DEFER_MODIFIERS=True
import materials

bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
bpy.context.scene.unit_settings.system='METRIC'
layout=json.loads((HERE/'layout.json').read_text())
print('ATLAS: materials', flush=True)
m=materials.create(ROOT)
ship=g.empty('AtlasMarkII')
exterior=g.empty('ExteriorStructure',parent=ship)

# Hollow pressure vessel: bed and thin pressure walls, not a filled fuselage.
g.box('Cargo pressure bed',(0,2.35,0),(15.3,.44,48),m['dark'],.065,exterior)
# Replaceable, flush loading-lane plates carry the deck material and real seams.
for x in [-2,2]:
    for z in [-21,-15,-9,-3,3,9,15,21]:
        g.box('Central cargo loading plate',(x,2.585,z),(3.96,.03,5.96),m['deck'],.007,exterior)
for side in [-1,1]:
    g.box('Cargo pressure wall',(side*7.48,5.72,0),(.28,6.24,48),m['dark'],.055,exterior)
    g.box('Upper pressure wall',(side*7.43,11.125,0),(.26,3.25,36),m['dark'],.045,exterior)
    g.box('Continuous structural spine',(side*8.25,9.08,3.4),(1.3,.64,42.4),m['dark'],.09,exterior)
    g.box('Belly load longeron',(side*5.8,1.8,0),(.55,.65,49),m['steel'],.07,exterior)
    for z in [-21,-13,-5,3,11,19]:
        g.box('Transverse chassis frame',(0,1.92,z),(14.8,.48,.42),m['dark'],.055,exterior)
        if z >= -17.8: g.rod('Outrigger spine web',(side*7.65,8.7,z-2),(side*9.25,9.12,z+2),.11,m['steel'],12,exterior)
    from armour_forms import build_bow_cheek
    from fleet_hull import build_load_shoulder
    build_bow_cheek(g,m,exterior,side)
    build_load_shoulder(g,m,exterior,side)
    from drive_pods import build_drive_pod
    build_drive_pod(g,m,exterior,side)

from landing_gear import build_landing_gear
build_landing_gear(g,m,ship,layout)

from drive_pods import build_loading_bow
from fleet_hull import build_bow_deck,build_dorsal_shell
build_loading_bow(g,m,exterior)
build_bow_deck(g,m,exterior)

# Pressure-room envelope above the dark structural spine.
roof=g.empty('UpperHull',parent=ship)
build_dorsal_shell(g,m,roof)
for side in [-1,1]:
    for za,zb,height in [(-18,-11,13.1),(-11,18,12.75)]:
        g.box('Upper ceiling inner liner',(side*3.65,height+.145,(za+zb)/2),(7.25,.25,zb-za),m['dark'],0,roof)
        g.box('Upper pressure edge cap',(side*7.3,height+.08,(za+zb)/2),(.30,.3,zb-za+.2),m['dark'],0,roof)
    g.box('Bridge aft wall pressure header',(side*7.43,12.925,-14.5),(.3,.4,7.2),m['dark'],0,roof)
for za,zb,height in [(-18,-11,13.1),(-11,18,12.75)]:
    g.box('Continuous central pressure seam',(0,height+.139,(za+zb)/2),(.24,.25,zb-za+.1),m['dark'],0,roof)
g.box('Ceiling step pressure header',(0,13.05,-11),(14.6,.6,.2),m['dark'],0,roof)
from armour_forms import build_aft_fairing
build_aft_fairing(g,m,roof)
from bridge_shell import build_bridge_shell
build_bridge_shell(g,m,roof)

# Attitude jets and radiator banks are fitted to the shoulder frame by its
# builder; their old world-X placements floated after reshaping the hull.

# Front/rear apertures are clear. Portal webs live OUTSIDE the 11.6m loading span.
for ramp in layout['ramps']:
    z=ramp['pivot'][2]
    for side in [-1,1]:
        g.box('Loading portal jamb',(side*6.8,5.8,z),(1.55,6.4,.62),m['dark'],.09,exterior)
        g.box('Loading portal ceramic facing',(side*6.8,5.8,z+ramp['outward']*.35),(1.25,5.9,.18),m['ivory'],.04,exterior)
        g.box('Loading door compressed side seal',(side*5.91,5.70,z),(.28,6.24,.36),m['rubber'],0,exterior)
        g.box('Portal amber beacon',(side*6.0,5.6,z+ramp['outward']*.43),(.12,.85,.12),m['amber'],.02,exterior)
    g.box('Loading portal lintel',(0,9.14,z),(12.1,.58,.72),m['dark'],.07,exterior)
    g.box('Portal work light',(0,8.93,z),(8.8,.08,.12),m['mint'],.015,exterior)
    pivot=g.empty(ramp['node'],ramp['pivot'],ship)
    # The pressure gasket lowers onto the closed 6 m leaf, then retracts above
    # 8.8 m for loading. A fixed low seal used to shrink the clear aperture.
    seal=ramp['headerSeal'];seal_root=g.empty(seal['node'],(0,seal['closedY'],z),ship)
    g.box('Loading door retracting upper seal',(0,seal['closedY'],z),(11.65,.26,.32),m['dark'],.025,seal_root)
    seal_root['role']='ramp-header-seal'
    d=ramp['outward'];length=ramp['length'];width=ramp['width']
    hinge=ramp['hingeLength']
    tip=g.empty(ramp['tipNode'],(0,2.6+ramp['tipHingeHeight'],z+d*hinge),pivot)
    # A two-piece ramp folds within the 6.2 m loading aperture. Raised hinge
    # keeps the folded stock separate from the main panel instead of z-fighting.
    for parent,start,span in [(pivot,0,hinge),(tip,hinge,length-hinge)]:
        centre=z+d*(start+span/2)
        from ramp_stock import build_ramp_deck
        build_ramp_deck(g,m,parent,ramp,start,span)
        for i in range(round(span/.5)):
            rz=z+d*(start+.22+i*.50)
            g.box('Ramp traction bar',(0,2.63,rz),(width-.4,.06,.11),m['steel'],.014,parent)
        for side in [-1,1]:
            g.box('Ramp edge rail',(side*(width/2-.12),2.75,centre),(.18,.3,span-.05),m['dark'],.035,parent)
            g.box('Ramp shoulder safety',(side*(width/2-.3),2.64,centre),(.09,.025,span-.2),m['warning'],.008,parent)
            for q in range(round(span)):
                g.box('Ramp amber edge marker',(side*(width/2-.15),2.94,z+d*(start+.45+q)),(.09,.035,.28),m['amber'],.009,parent)
        for x in [-3.0,3.0]:g.box('Ramp tyre wear strip',(x,2.635,centre),(1.8,.025,span-.15),m['deck'],.006,parent)
    for side in [-1,1]:
        g.rod('Ramp hinge axle',(side*(width/2-.9),2.57,z),(side*(width/2+.28),2.57,z),.16,m['steel'],16,pivot)
        g.rod('Ramp torque arm',(side*(width/2-.2),2.42,z+d*.7),(side*(width/2-.2),2.12,z+d*3.2),.095,m['steel'],12,pivot)
        g.rod('Folding toe hinge',(side*(width/2-.85),2.78,z+d*hinge),(side*(width/2-.25),2.78,z+d*hinge),.10,m['steel'],16,pivot)
    tip['role']='folding-ramp-tip'
    g.rotate_game(tip,(math.pi,0,0))
    pivot['role']='loading-ramp';pivot['rampId']=ramp['id'];pivot['closedAngle']=ramp['closedAngle'];pivot['openAngle']=ramp['openAngle']
    g.rotate_game(pivot,(ramp['closedAngle'],0,0))

# Crew lift moves as one rigid group; upper slab hole belongs to interior builder.
e=layout['elevator'];x,z=e['centre'];lift=g.empty(e['node'],(x,e['low'],z),ship)
g.box('Lift load platform',(x,e['low']-.16,z),(e['width'],.32,e['length']),m['steel'],.06,lift)
g.box('Lift nonslip inset',(x,e['low']+.025,z),(e['width']-.24,.05,e['length']-.24),m['deck'],.02,lift)
for sx in [-1,1]:
    xx=x+sx*(e['width']/2-.1)
    for zz in [z-e['length']/2+.2,z+e['length']/2-.2]:g.rod('Lift guard upright',(xx,e['low']+.1,zz),(xx,e['low']+1.1,zz),.045,m['steel'],10,lift)
    spans=[(-1.6,-.75),(.75,1.6)] if sx<0 else [(-1.6,1.6)]
    for za,zb in spans:
        g.rod('Lift guard handrail',(xx,e['low']+1.1,z+za),(xx,e['low']+1.1,z+zb),.06,m['warning'],12,lift)
    if sx<0:
        for zz in [z-.75,z+.75]:g.rod('Lift entry upright',(xx,e['low']+.1,zz),(xx,e['low']+1.1,zz),.045,m['steel'],10,lift)
for zz in [z-e['length']/2+.2,z+e['length']/2-.2]:
    g.rod('Lift end safety rail',(x-e['width']/2+.1,e['low']+1.1,zz),(x+e['width']/2-.1,e['low']+1.1,zz),.06,m['warning'],12,lift)
g.box('Lift rider control housing',(x,e['low']+1.12,z-1.52),(.46,.40,.16),m['steel'],.035,lift)
g.box('Lift rider control face',(x,e['low']+1.13,z-1.42),(.32,.27,.025),m['mint'],.01,lift)
for xx in [x+e['width']/2+.12]:
    for zz in [z-e['length']/2,z+e['length']/2]:
        g.box('Elevator guide channel',(xx,6.2,zz),(.18,8,.22),m['dark'],.035,ship)
        g.rod('Elevator polished guide',(xx-.04,2.6,zz),(xx-.04,10.65,zz),.045,m['steel'],12,ship)
for floor in [e['low'],e['high']]:
    px,pz=e['callPanel']['centre']
    g.box('Lift call panel stand',(px,floor+.67,pz),(.16,1.34,.28),m['dark'],.03,ship)
    g.box('Lift call panel housing',(px,floor+1.32,pz),(.45,.44,.16),m['steel'],.035,ship)
    g.box('Lift call panel touchface',(px,floor+e['callPanel']['touchHeight'],pz+e['callPanel']['touchOffsetZ']),(.30,.28,.025),m['mint'],.01,ship)
for floor,node_name in zip([e['low'],e['high']],e['gateNodes']):
    gate=g.empty(node_name,(4.2,floor,z),ship)
    g.rod('Landing interlocked safety bar',(4.2,floor+.95,z-.75),(4.2,floor+.95,z+.75),.065,m['warning'],12,gate)
    g.box('Landing gate centre sign',(4.2,floor+.95,z),(.10,.24,.34),m['dark'],.025,gate)
    gate['role']='lift-landing-gate'
lift['role']='crew-elevator';lift['lowerDeck']=e['low'];lift['upperDeck']=e['high']

# Standardized weapon mating plates: future weapon models attach to the EMPTY,
# never the plate mesh centre. The exact plane and bolt pattern are shared JSON.
standard=json.loads((HERE/'mount-standard.json').read_text())
for mount in layout['mounts']:
    definition=next(s for s in standard['geometrySlots'] if s['size']==mount['size'])
    x,y,z=mount['position'];socket=g.empty(mount['node'],mount['position'],ship)
    socket['mountSize']=mount['size'];socket['mountId']=mount['id'];socket['standardVersion']=standard['version'];socket['role']='weapon-mount'
    radius=definition['dockingDiameter']/2
    g.rod('Hardpoint foundation',(x,y-.50,z),(x,y-.20,z),radius+.30,m['dark'],32,socket)
    g.rod('Machined mating flange',(x,y-.18,z),(x,y-.035,z),radius,m['steel'],32,socket)
    g.ring('Mount sealing gasket',(x,y-.012,z),radius-.08,.025,m['rubber'],'y',socket)
    g.rod('Blanking cap',(x,y-.03,z),(x,y-.004,z),radius-.13,m['petrol'],24,socket)
    bolt=definition['boltPattern']
    for i in range(bolt['count']):
        a=2*math.pi*i/bolt['count'];r=bolt['pitchCircleDiameter']/2
        g.rod('Hardpoint captive fixing',(x+math.cos(a)*r,y-.04,z+math.sin(a)*r),(x+math.cos(a)*r,y+.015,z+math.sin(a)*r),bolt['holeDiameter']*.65,m['dark'],6,socket)
    g.text('Mount size stencil',f"S{mount['size']}",(x,y+.018,z+.27),.16,m['warning'],parent=socket)
    g.rotate_game(socket,mount['rotation'])

# Registration, rescue markings and service handles are placed where used.
for side in [-1,1]:
    # Registration follows the final fitted surface pass. The old roof label
    # was buried underneath this new shell and is not retained as hidden stock.
    for z in [-15,-8,0,8,15]:
        for xx in [7.84,8.40]:g.rod('Service handhold',(side*xx,9.52,z-.34),(side*xx,9.52,z+.34),.033,m['steel'],8,exterior)
        g.rod('Handhold bridge',(side*7.84,9.52,z+.34),(side*8.40,9.52,z+.34),.033,m['steel'],8,exterior)
# Interior authoring is independent but consumes the same authoritative contract.
print('ATLAS: interior', flush=True)
from interior import build_interior
build_interior(g,m,layout)
for obj in list(bpy.context.scene.objects):
    if obj.parent is None and obj!=ship: g.parent_keep(obj,ship)

# Build renderable batches inside each top-level subsystem, preserving all pivots.
def apply_modifiers():
    # Snapshot evaluated meshes once. Repeated modifier_apply operators update
    # the whole dependency graph thousands of times on a detailed asset.
    for obj in bpy.context.scene.objects:
        for mod in obj.modifiers if obj.type=='MESH' else []:mod.show_viewport=True
    bpy.context.view_layer.update()
    dg=bpy.context.evaluated_depsgraph_get()
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.modifiers]
    snapshots=[(o,bpy.data.meshes.new_from_object(o.evaluated_get(dg),preserve_all_data_layers=True,depsgraph=dg)) for o in meshes]
    for obj,mesh in snapshots:
        obj.modifiers.clear()
        obj.data=mesh

def batch():
    groups={}
    for obj in list(bpy.context.scene.objects):
        if obj.type!='MESH':continue
        key=(obj.parent.name if obj.parent else '',tuple(m.name for m in obj.data.materials))
        groups.setdefault(key,[]).append(obj)
    # Merge directly in each parent's coordinates. Repeated bpy.ops.join forces
    # scene dependency updates for every batch and hides expensive rebuild work.
    # Preserve evaluated split normals so machined bevels retain flat faces.
    from mathutils import Matrix
    for (parent,mats),objects in groups.items():
        if len(objects)<2:continue
        owner=bpy.data.objects.get(parent)
        inverse=owner.matrix_world.inverted() if owner else Matrix.Identity(4)
        vertices=[];faces=[];normals=[];smooth=[]
        for obj in objects:
            mesh=obj.data;transform=inverse@obj.matrix_world
            normal_matrix=transform.to_3x3().inverted().transposed()
            base=len(vertices)
            vertices.extend(tuple(transform@v.co) for v in mesh.vertices)
            faces.extend(tuple(base+i for i in p.vertices) for p in mesh.polygons)
            smooth.extend(p.use_smooth for p in mesh.polygons)
            normals.extend(tuple((normal_matrix@n.vector).normalized()) for n in mesh.corner_normals)
        mesh=bpy.data.meshes.new(parent+' batch')
        mesh.from_pydata(vertices,[],faces);mesh.update()
        for material in objects[0].data.materials:mesh.materials.append(material)
        for face,flag in zip(mesh.polygons,smooth):face.use_smooth=flag
        mesh.normals_split_custom_set(normals)
        obj=bpy.data.objects.new(f"{parent}_{mats[0].split('/')[-1].strip()}",mesh)
        bpy.context.collection.objects.link(obj);obj.parent=owner
        for old in objects:bpy.data.objects.remove(old,do_unlink=True)
    bpy.context.view_layer.update()

print('ATLAS: applying modifiers', len(bpy.context.scene.objects), flush=True)
apply_modifiers()
print('ATLAS: batching', flush=True)
batch()
print('ATLAS: batches ready',flush=True)
if '--atlas-quick' not in sys.argv:
    from bake_contact import bake_contact
    bake_contact()
else:
    print('ATLAS: silhouette iteration, contact bake deferred',flush=True)
from export_atlas import export_asset
export_asset()
