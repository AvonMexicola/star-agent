"""Rebuild the original Nomad utility ship, retaining its authored rig and UVs.

    blender --background --python assets/ship/build_ship.py

Design coordinates are metres, Y up, nose -Z. The export converts Blender's
Z-up coordinates back to the game's convention. Cabin, hatch and MFDs remain
runtime geometry so their physical and interactive contracts stay explicit.
"""
import math
import sys
import json
import subprocess
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
LAYOUT = json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {SHIP_LAYOUT} from './src/boarding.js';process.stdout.write(JSON.stringify(SHIP_LAYOUT))"],cwd=ROOT,text=True))
MOUNT_STANDARD = json.loads((ROOT/'assets/atlas-mark-ii/mount-standard.json').read_text())
IDENTITY = json.loads((ROOT/'assets/ship/identity.json').read_text())
MANUFACTURER = json.loads((ROOT/f'assets/brands/{IDENTITY["manufacturer"]}/identity.json').read_text())
sys.path.insert(0, str(Path(__file__).resolve().parent))
from nomad_cabin import build_cabin
from nomad_finish import finish_nomad
from nomad_details import detail_nomad
# This is a complete rebuild, including when invoked with an existing .blend.
# Deleting only objects leaves orphan materials/images and silently creates
# suffixed atlas names that no longer satisfy the texture import contract.
bpy.ops.wm.read_factory_settings(use_empty=True)

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
        # Small manufactured edges need two segments; retain broader silhouettes.
        # The pilot chair explicitly overrides its bevels to six below.
        mod.segments = 1 if bevel <= .02 else 2
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

def rod(name, a, b, radius, mat, vertices=12):
    va, vb = Vector(xyz(a)), Vector(xyz(b))
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=(vb-va).length, location=(va+vb)/2)
    obj = bpy.context.object
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = (vb-va).to_track_quat('Z', 'Y')
    return finish(obj, name, mat, .012)

def ring(name, p, radius, tube, mat):
    bpy.ops.mesh.primitive_torus_add(major_segments=32, minor_segments=6,
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

# The exterior is a purpose-built utility tender around the shared cabin.
from nomad_hull import build_hull
build_hull(globals())

# Accessible cargo chest on the starboard wall, clear of the central aisle.
# Bounds are shared with boarding.js: x .98..1.65, z .35..1.95.
box('Cargo / tray floor',(1.315,1.06,1.15),(.67,.12,1.60),dark,.04)
for x in [1.02,1.60]:
    box('Cargo / tray wall',(x,1.54,1.15),(.10,.90,1.60),dark,.035)
for z in [.40,1.90]:
    box('Cargo / tray end',(1.315,1.54,z),(.62,.90,.10),dark,.035)
for z in [.79,1.50]:
    box('Cargo / padded divider',(1.32,1.36,z),(.44,.49,.04),rubber,.012)
box('Cargo / face plate',(.965,1.51,1.15),(.03,.69,1.41),teal,.035)
for z in [.49,1.81]:
    box('Cargo / corner protector',(.951,1.53,z),(.055,.91,.13),metal,.025)
box('Cargo / status strip',(.939,1.75,1.15),(.02,.04,.50),mint,.008)
label('Cargo / placard','CARGO / 120 kg',(.925,1.51,1.15),.092,ivory,(math.pi/2,0,-math.pi/2))
bpy.ops.object.empty_add(type='PLAIN_AXES',location=xyz((1.65,1.98,1.15)))
lid = bpy.context.object
lid.name = 'CargoLid'
for obj in [box('Cargo / hinged lid',(1.315,2.01,1.15),(.67,.06,1.60),orange,.025),
            box('Cargo / lid insert',(1.30,2.048,1.15),(.43,.016,1.31),dark,.012),
            box('Cargo / handle',(.985,2.05,1.15),(.045,.06,.30),metal,.016)]:
    obj.parent = lid
    obj.matrix_parent_inverse = lid.matrix_world.inverted()

# Sculpted bucket seat: shaped shell, separate upholstery, harness and articulated arms.
# Keep the seat behind the existing eye at (0,2.55,-2.8), with clear rear aisle.
harness=material('Seat / restraint webbing',(.42,.12,.035),.02,.9)
fabric=material('Seat / woven charcoal',(.025,.046,.048),.03,.94)
seat_start=set(bpy.context.scene.objects)
rod('Seat / pedestal',(0,1.03,-2.8),(0,1.36,-2.8),.18,metal,32)
ring('Seat / pedestal collar',(0,1.19,-2.8),.22,.045,dark)
box('Seat / base shell',(0,1.38,-2.78),(.88,.20,.84),dark,.09)
box('Seat / seat cushion',(0,1.49,-2.84),(.63,.18,.68),fabric,.08)

def seat_back(name,outline,front,depth,mat):
    # Extrude a tailored silhouette in the x/y plane with a slight recline.
    n=len(outline)
    vertices=[xyz((x,y,front+(y-1.5)*.13+d)) for d in [0,depth] for x,y in outline]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    return finish(obj,name,mat,.045)

seat_back('Seat / contoured outer shell',[(-.35,1.44),(.35,1.44),(.43,1.9),(.49,2.16),(.35,2.36),(.25,2.41),(-.25,2.41),(-.35,2.36),(-.49,2.16),(-.43,1.9)],-2.49,.14,dark)
seat_back('Seat / lumbar upholstery',[(-.26,1.55),(.26,1.55),(.30,1.84),(.22,1.94),(-.22,1.94),(-.30,1.84)],-2.56,.07,fabric)
seat_back('Seat / shoulder upholstery',[(-.22,1.97),(.22,1.97),(.35,2.17),(.24,2.30),(-.24,2.30),(-.35,2.17)],-2.56,.07,fabric)
box('Seat / headrest support',(0,2.40,-2.28),(.16,.26,.10),metal,.03)
box('Seat / rounded headrest',(0,2.48,-2.35),(.48,.28,.20),fabric,.09)
box('Seat / headrest accent',(0,2.49,-2.456),(.30,.035,.014),teal,.006)
for s in [-1,1]:
    box('Seat / thigh bolster',(s*.35,1.57,-2.82),(.14,.23,.67),fabric,.065)
    seat_back('Seat / shoulder wing',[(s*x,y) for x,y in [(.28,1.60),(.39,1.68),(.47,2.16),(.35,2.27),(.28,2.14)]],-2.60,.13,teal)
    rod('Seat / articulated arm',(s*.42,1.40,-2.44),(s*.51,1.72,-2.62),.042,metal)
    box('Seat / arm shell',(s*.51,1.75,-2.82),(.18,.12,.66),dark,.055)
    box('Seat / arm pad',(s*.51,1.82,-2.79),(.15,.06,.48),fabric,.025)
    surface('Seat / harness webbing',[(s*.19-.035,2.25,-2.49),(s*.19+.035,2.25,-2.49),(s*.15+.035,1.65,-2.54),(s*.15-.035,1.65,-2.54)],harness,.012)
    box('Seat / harness buckle',(s*.12,1.61,-2.58),(.10,.10,.055),metal,.014)
    box('Seat / base rail',(s*.28,1.08,-2.8),(.06,.12,.9),dark,.025)
box('Seat / rear service panel',(0,1.88,-2.27),(.39,.43,.04),metal,.04)
label('Seat / rear insignia',f'{IDENTITY["name"][0]} / {IDENTITY["revision"]}',(0,1.93,-2.24),.085,ivory,(math.pi/2,0,0))
seat_parts=set(bpy.context.scene.objects)-seat_start
bpy.ops.object.empty_add(type='PLAIN_AXES',location=(0,0,0));chair=bpy.context.object;chair.name='PilotChair'
for obj in seat_parts:
    obj.parent=chair
    for mod in obj.modifiers:
        if mod.type=='BEVEL':mod.segments=2

cabin, cargo_boxes = build_cabin(globals())
detail_nomad(globals(), cabin)

# Apply edge modifiers and consolidate static parts by finish for runtime cost.
for obj in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
    bpy.context.view_layer.objects.active = obj
    for mod in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)
for parent in [None,chair,cabin,*cargo_boxes,*[bpy.data.objects[leg['name']] for leg in LAYOUT['gear']['legs']]]:
    for mat in bpy.data.materials:
        objects = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.parent == parent and o.data.materials and o.data.materials[0] == mat]
        if not objects:
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        if len(objects)>1:bpy.ops.object.join()
        objects[0].name = mat.name.split(' / ')[0] + ' / static batch'
        # Bake positions to the ship origin; no large world coordinates in the asset.
        bpy.context.scene.cursor.location = (0,0,0)
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')

if '--geometry-only' not in sys.argv:
    finish_nomad(cabin, chair, lid)
    if (ROOT/'assets/ship/textures/meshy-source/source.json').exists():
        from pack_nomad_textures import pack as pack_textures
        pack_textures()
bpy.context.scene['shipIdentity'] = {**IDENTITY, 'manufacturerName': MANUFACTURER['name']}
bpy.context.preferences.filepaths.save_version = 0
from pack_nomad import publish
report=publish(ROOT,
    lambda path:bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_image_format='WEBP',export_image_quality=88,export_yup=True,export_apply=True,export_extras=True),
    None if '--runtime-only' in sys.argv else lambda path:bpy.ops.wm.save_as_mainfile(filepath=str(path),copy=True,relative_remap=False))
print('NOMAD: saved runtime GLB' if '--runtime-only' in sys.argv else 'NOMAD: saved editable Blender source and runtime GLB')
