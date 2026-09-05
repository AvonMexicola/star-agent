"""Original Atlas freighter. Game coordinates in metres, Y up, -Z forward.
Run Blender background with --python assets/ship/build_freighter.py.
Moving lift origins are their deck surfaces; never batch them into the hull.
"""
import math
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def xyz(p):
    return (p[0], -p[2], p[1])

def material(name, color, metallic=0.0, roughness=0.4, glow=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = roughness
    if glow:
        p.inputs['Emission Color'].default_value = (*color, 1)
        p.inputs['Emission Strength'].default_value = glow
    return m

ivory = material('Ceramic / warm ivory', (.68, .73, .69), .48, .32)
dark = material('Titanium / graphite', (.026, .046, .054), .65, .39)
metal = material('Machined alloy', (.22, .30, .32), .8, .29)
teal = material('Survey / deep petrol', (.018, .16, .17), .5, .34)
orange = material('Rescue / vermilion', (.85, .15, .046), .28, .38)
rubber = material('Gaskets / rubber', (.007, .013, .017), .05, .85)
mint = material('Position / ice', (.26, .85, .72), .2, .3, 2)
amber = material('Caution / amber', (1, .29, .045), .2, .3, 1.8)
engine = material('Drive / ion blue', (.07, .48, 1), .15, .3, 3)

def finish(obj, name, mat, bevel=0):
    obj.name = name
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Manufactured edge radii', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        mod = obj.modifiers.new('Weighted panel normals', 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
    return obj

def box(name, p, size, mat, bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(p))
    obj = bpy.context.object
    obj.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, bevel)

def poly(name, points, top, thickness, mat, bevel=.025):
    n = len(points)
    vertices = [xyz((x, y, z)) for y in [top-thickness, top] for x, z in points]
    faces = [tuple(range(n-1, -1, -1)), tuple(range(n, n*2))]
    faces += [(i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    # Mirrored planforms need outward normals too.
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.select_set(False)
    return finish(obj, name, mat, bevel)

def rod(name, a, b, radius, mat, vertices=16):
    va, vb = Vector(xyz(a)), Vector(xyz(b))
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=(vb-va).length, location=(va+vb)/2)
    obj = bpy.context.object
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = (vb-va).to_track_quat('Z', 'Y')
    return finish(obj, name, mat, .012)

def ring(name, p, radius, tube, mat):
    bpy.ops.mesh.primitive_torus_add(major_segments=40, minor_segments=8,
        location=xyz(p), major_radius=radius, minor_radius=tube, rotation=(math.pi/2, 0, 0))
    return finish(bpy.context.object, name, mat)

def label(name, words, p, size, mat, rotation):
    bpy.ops.object.text_add(location=xyz(p), rotation=rotation)
    obj = bpy.context.object
    obj.data.body = words
    obj.data.size = size
    obj.data.extrude = .0008
    obj.data.space_character = 1.15
    obj.data.align_x = 'CENTER'
    obj.data.materials.append(mat)
    bpy.ops.object.convert(target='MESH')
    obj.name = name

def surface(name, points, mat, thickness=.06):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([xyz(p) for p in points], [], [tuple(range(len(points)))])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    mod = obj.modifiers.new('Panel thickness', 'SOLIDIFY');mod.thickness = thickness
    return finish(obj, name, mat, .025)

# A broad industrial lifting body, a low panoramic bridge and twin outboard drives.
# All walkable floors, lift openings and upper landings match freighter-layout.js.
box('Forward cargo deck', (0,3.85,-6), (12,.3,12), dark)
for s in [-1,1]:
    box('Cargo bypass aisle', (s*5,3.85,5), (2,.3,10),dark)
    # Cut the two 2.2 x 3 lift shafts out of the forward floor with exact booleans.
deck = bpy.data.objects.get('Forward cargo deck')
for s in [-1,1]:
    cutter=box('Lift aperture',(s*4.8,3.85,-4.5),(2.2,1,3),dark,0)
    mod=deck.modifiers.new('Physical lift shaft','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.context.view_layer.objects.active=deck;bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter,do_unlink=True)

for s in [-1,1]:
    box('Cargo inner wall',(s*6.12,6.7,1),( .24,5.4,18),dark,.09)
    box('Cargo roof',(s*3.1,9.35,1),(6.2,.3,18),ivory,.12)
    # Segmented ceramic armor and exposed steel ribs keep the large surfaces readable.
    for z in [-6.5,-3, .5,4,7.5]:
        box('Hull floating armor',(s*6.33,6.9,z),(.4,4.55,3.28),ivory,.17)
        box('Petrol armor inset',(s*6.55,7.65,z),(.05,1.3,2.95),teal,.06)
        box('Caution sill',(s*6.57,4.9,z),(.08,.25,2.75),orange,.03)
        box('Interior structural rib',(s*5.93,6.55,z),(.12,4.95,.14),metal,.025)
        box('Cargo wall uplight',(s*5.83,8.95,z),(.05,.09,2.55),mint,.01)
        for dz in [-1.1,1.1]:
            box('Armor fastener',(s*6.59,6,z+dz),(.035,.11,.11),dark,.015)
    # Deep twin nacelles: little swept outriggers, large four-ring exhausts.
    poly('Drive shoulder',[(s*x,z) for x,z in [(6,-5),(8.9,-2),(9.2,10.5),(6,10)]],5.2,.7,dark,.1)
    box('Drive armored body',(s*7.9,5.3,4.1),(2.5,3.1,15.6),dark,.45)
    box('Drive top ceramic',(s*7.9,6.6,3.8),(2.55,.65,14.5),ivory,.2)
    box('Drive outer petrol',(s*9.13,5.4,4),(.2,1.6,13),teal,.08)
    for z in range(-2,11):
        box('Drive heat exchanger',(s*7.9,6.94,z),(1.7,.06,.27),dark,.025)
    box('Drive intake frame',(s*7.9,5.25,-3.7),(2.4,2.8,.4),metal,.25)
    box('Drive intake shadow',(s*7.9,5.25,-3.93),(1.9,2.25,.1),rubber,.18)
    for i in range(7):
        box('Drive intake stator',(s*7.9,4.35+i*.3,-4),(1.8,.09,.06),metal,.025)
    rod('Drive throat',(s*7.9,5.3,11.3),(s*7.9,5.3,13.3),1.05,rubber,32)
    for z in [11.6,12.1,12.6,13.2]:
        ring('Drive machined collar',(s*7.9,5.3,z),1.1,.13,metal)
    rod('Drive blue emitter',(s*7.9,5.3,13.25),(s*7.9,5.3,13.30),.91,engine,32)
    box('Aft navigation lamp',(s*8.8,6.8,11.3),(.16,.12,1.6),amber if s<0 else mint)
    # A tapered, raked bridge, with actual windows above its opaque sill.
    poly('Bridge cheek',[(s*x,z) for x,z in [(0,-15.8),(2.7,-15),(4.1,-12),(0,-12)]],4.65,.85,ivory,.09)
    surface('Bridge side sill',[(s*6,4,-8),(s*6,5,-8),(s*2.7,4.9,-15),(s*2.7,4,-15)],teal)
    rod('Canopy rear frame',(s*6,4.65,-8),(s*5.5,7.6,-8),.13,ivory)
    rod('Canopy front frame',(s*2.7,4.9,-15),(s*2.4,6.9,-13),.1,ivory)
    rod('Canopy upper rail',(s*2.4,6.9,-13),(s*5.5,7.6,-8),.12,ivory)
    rod('Canopy diagonal mullion',(s*4.25,4.9,-11.5),(s*3.95,7.25,-10.5),.05,metal)
    surface('Bridge swept roof',[(0,7.6,-8),(s*5.5,7.6,-8),(s*2.4,6.9,-13),(0,6.9,-13)],ivory,.15)
    # Heavy landing gear: feet at local y=0, cargo elevator shares that plane.
    for z in [-8,8]:
        rod('Gear oleo',(s*6.8,4.3,z),(s*7.6,.6,z+.7),.23,dark)
        rod('Gear polished piston',(s*7.2,2.3,z+.4),(s*7.6,.55,z+.7),.14,metal)
        rod('Gear diagonal brace',(s*6.1,3.6,z+1.9),(s*7.6,.55,z+.7),.12,metal)
        box('Gear foot',(s*7.6,.18,z+.7),(1.7,.36,2.3),rubber,.12)
        box('Gear hazard cap',(s*7.6,.42,z+.7),(1.3,.12,1.9),orange,.05)
    # Internal mezzanine shelves and their matching railings.
    box('Upper cargo landing',(s*4.8,6.85,-7),(2.2,.3,2),metal)
    for x in [s*3.7,s*5.9]:
        rod('Shelf rail',(x,8,-8),(x,8,-6),.045,orange)
        for z in [-8,-6]:rod('Shelf post',(x,7,z),(x,8,z),.04,metal)
    rod('Shelf rear rail',(s*3.7,8,-8),(s*5.9,8,-8),.045,orange)
    for z in [-6,-3]:
        box('Cargo lift guide',(s*5.98,5.65,z),(.09,3.3,.15),metal,.015)
    for z in [0,10]:
        box('Belly elevator guide',(s*4.1,2,z),(.16,4,.22),metal,.025)
    # Warning markings around the main shaft; gates are animated at runtime.
    box('Main lift aisle stripe',(s*4.28,4.014,5),(.10,.02,9.8),orange,.005)
    for i in range(18):
        box('Aisle tread seam',(s*5,4.013,.25+i*.54),(1.65,.02,.025),metal,.003)
    label('Hull registry','A T L A S   /   0 2',(s*6.585,6.75,.5),.45,dark,(math.pi/2,0,s*math.pi/2))
    label('Hull capacity','LOGISTICS / 2400 KG',(s*6.585,5.6,4),.21,ivory,(math.pi/2,0,s*math.pi/2))

rod('Front canopy brow',(-2.4,6.9,-13),(2.4,6.9,-13),.1,metal)
rod('Front split screen',(0,4.9,-15),(0,6.9,-13),.045,metal)
box('Rear lintel',(0,9.05,10),(12.5,.7,.55),teal,.12)
label('Rear registry','ATLAS  /  HEAVY LOGISTICS',(0,8.94,10.29),.36,ivory,(math.pi/2,0,0))
box('Roof raised spine',(0,9.62,1),(2,.25,16),teal,.10)
for z in range(-6,9):box('Roof radiator',(0,9.77,z),(1.6,.04,.28),dark,.01)
for x in [-1.5,1.5]: box('Forward lamps',(x,4.7,-15.2),(.3,.15,.12),mint)

# Transparent bridge panes, authored independently so no opaque face covers view.
glass=material('Canopy glass',(.12,.35,.4),.1,.12)
glass.diffuse_color=(.12,.35,.4,.18)
glass.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.18
glass.surface_render_method='DITHERED'
surface('Front windscreen',[(-2.7,4.9,-15),(2.7,4.9,-15),(2.4,6.9,-13),(-2.4,6.9,-13)],glass,.01)
for s in [-1,1]:surface('Side windscreen',[(s*2.7,4.9,-15),(s*6,5,-8),(s*5.5,7.6,-8),(s*2.4,6.9,-13)],glass,.01)

# Familiar four-screen flight station stays at human scale in a much larger bridge.
box('Pilot console',(0,4.9,-11.9),(3.3,.8,.6),dark,.08)
box('Pilot seat',(0,4.45,-10.5),(.85,.25,.8),teal,.1)
box('Pilot seat back',(0,5,-10.08),(.85,1,.18),teal,.09)
rod('Pilot pedestal',(0,4,-10.5),(0,4.4,-10.5),.25,metal)
for x in [-.62,.62]:box('Pilot armrest',(x,4.7,-10.5),(.3,.25,1.2),dark,.06)

# Hinged inventory container. Its volume matches the solid collision box.
box('Inventory chest',(2.8,4.55,-7.5),(1,1.1,1.8),teal,.07)
box('Inventory status',(2.285,4.8,-7.5),(.02,.05,.9),mint,.008)

def moving(name, origin, parts):
    bpy.ops.object.empty_add(type='PLAIN_AXES',location=xyz(origin))
    root=bpy.context.object;root.name=name
    for obj in parts:
        obj.parent=root;obj.matrix_parent_inverse=root.matrix_world.inverted()
    return root

moving('CargoLid',(3.3,5.1,-7.5),[box('Storage lid',(2.8,5.14,-7.5),(1,.08,1.8),orange,.035)])
for name,x,z,w,d,y in [('MainLift',0,5,8,10,4),('PortLift',-4.8,-4.5,2.2,3,4),('StarboardLift',4.8,-4.5,2.2,3,4)]:
    parts=[box('Lift reinforced deck',(x,y-.13,z),(w,.26,d),metal,.04)]
    for side in [-1,1]:
        parts.append(box('Lift edge marking',(x+side*(w/2-.12),y+.012,z),(.09,.02,d-.15),orange,.004))
    for i in range(int(d*2)):
        parts.append(box('Lift grip tread',(x,y+.012,z-d/2+.18+i*.5),(w-.35,.02,.035),dark,.004))
    # The two small lifts physically carry sealed cargo cases, leaving a rider lane.
    if name!='MainLift':
        parts.append(box('Lift secured freight',(x,y+.38,z+.72),(1.25,.76,.9),orange,.09))
        parts.append(box('Freight top inset',(x,y+.77,z+.72),(.95,.04,.67),dark,.02))
    # Platform control console travels with the rider.
    cx,cz=(0,1) if name=='MainLift' else (x,-3.8)
    parts.append(box('Lift control pedestal',(cx+.65,y+.55,cz),(.12,1.1,.12),dark,.02))
    parts.append(box('Lift control screen',(cx+.65,y+1.14,cz),(.32,.14,.25),mint,.03))
    moving(name,(0,y,0),parts)

# Fixed lift-call panels at the two ends of the main elevator and upper landings.
for x,y,z in [(0,4,-1),(0,0,11),(-4.8,4,-6.7),(4.8,4,-6.7),(-4.8,7,-6.7),(4.8,7,-6.7)]:
    box('Call station',(x+.65,y+.55,z),(.1,1.1,.12),metal)
    box('Call screen',(x+.65,y+1.14,z),(.28,.15,.23),mint)

for obj in [o for o in bpy.context.scene.objects if o.type=='MESH']:
    bpy.context.view_layer.objects.active=obj
    for mod in list(obj.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
# Batch each moving assembly independently, retaining its required parent name.
for parent in [None]+[o for o in bpy.context.scene.objects if o.type=='EMPTY']:
    for mat in bpy.data.materials:
        objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==parent and o.data.materials and o.data.materials[0]==mat]
        if not objects:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
        objects[0].name=(parent.name if parent else 'Hull')+' / '+mat.name
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/ship/atlas.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/atlas.glb'),export_format='GLB',export_yup=True,export_apply=True,export_extras=True)
print('ATLAS: saved editable Blender source and runtime GLB')
