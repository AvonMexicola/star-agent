"""Original outdoor mast, rebuilt without external assets or textures.
blender --background --factory-startup --python-exit-code 1 --python blender/build_floodlight.py
Editable source is saved before static export batching. Game metres/Y-up.
"""
import bpy
import hashlib
import json
import math
import os
import struct
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/build-floodlight'
OUT = ROOT / 'public/models/base/floodlight.glb'
SOURCE.mkdir(parents=True, exist_ok=True)
OUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
materials = {}

def material(name, color, metal, rough, emission=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rough
    if emission:
        p.inputs['Emission Color'].default_value = (*color, 1)
        p.inputs['Emission Strength'].default_value = emission
    materials[name] = m

material('WhiteArmour', (.65, .69, .68), .18, .43)
material('EdgeSteel', (.21, .25, .26), .75, .31)
material('DarkPolymer', (.025, .038, .042), .05, .66)
material('MintStatus', (.47, .86, .65), .1, .35, .7)
material('WarmTaskLight', (1, .88, .71), .05, .25, 3)
objects = []

def game(v):
    return Vector((v[0], -v[2], v[1]))

def finish(o, name, mat, bevel=.012):
    o.name = name
    o.data.materials.append(materials[mat])
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new('Manufactured edge bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    uv = o.data.uv_layers.active or o.data.uv_layers.new(name='MetreUV')
    colors = o.data.color_attributes.new(name='SurfaceFinish', type='FLOAT_COLOR', domain='CORNER')
    for poly in o.data.polygons:
        axes = [i for i in range(3) if i != max(range(3), key=lambda i: abs(poly.normal[i]))]
        for index in poly.loop_indices:
            pos = o.matrix_world @ o.data.vertices[o.data.loops[index].vertex_index].co
            uv.data[index].uv = (pos[axes[0]], pos[axes[1]])
            # Mild footing grime and geometric recess variation; no painted-on light.
            shade = 1 if mat in ['MintStatus', 'WarmTaskLight'] else max(.72, min(1, .95 - .13 * math.exp(-max(0, pos.z) * 3) + .035 * math.sin(pos.x * 17 + pos.z * 11)))
            colors.data[index].color = (shade, shade, shade, 1)
    objects.append(o)
    return o

def box(name, center, size, mat='WhiteArmour', bevel=.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=game(center))
    o = bpy.context.object
    o.scale = (size[0], size[2], size[1])
    return finish(o, name, mat, bevel)

def cylinder(name, a, b, radius, mat='EdgeSteel', vertices=12):
    aa, bb = game(a), game(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=(bb-aa).length, location=(aa+bb)/2)
    o = bpy.context.object
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = (bb-aa).to_track_quat('Z', 'Y')
    return finish(o, name, mat, .003)

def anchor(name, point):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    o.location = game(point)
    o.empty_display_size = .15
    return o

# Anchored steel shoe and serviceable mast sections.
box('FootSeal', (0, .026, 0), (1.12, .052, 1.12), 'DarkPolymer', .025)
box('AnchorPlate', (0, .09, 0), (1.16, .076, 1.16), 'EdgeSteel', .025)
box('PostSocket', (0, .21, 0), (.40, .25, .40), 'WhiteArmour', .025)
for x in [-.43, .43]:
    for z in [-.43, .43]:
        cylinder('FootWasher', (x, .13, z), (x, .145, z), .076)
        cylinder('AnchorBolt', (x, .145, z), (x, .18, z), .045, vertices=6)
for low, high in [(.25, 2.85), (2.93, 5.50)]:
    cylinder('OctagonalMast', (0, low, 0), (0, high, 0), .145, 'WhiteArmour', vertices=8)
for y in [.35, 2.88, 5.40]:
    box('MastCollar', (0, y, 0), (.33, .09, .33), 'EdgeSteel', .01)
box('RearCableConduit', (0, 2.93, .163), (.075, 5.03, .052), 'DarkPolymer', .006)
box('CrossArm', (0, 5.49, 0), (2.18, .15, .20), 'EdgeSteel', .012)

# Walking-height isolation panel, facing away from the useful beam.
box('SwitchHousing', (0, 1.18, .26), (.52, .76, .27), 'WhiteArmour', .025)
box('PanelSeal', (0, 1.19, .400), (.45, .64, .018), 'DarkPolymer', .008)
box('ServicePanel', (0, 1.19, .413), (.41, .60, .012), 'EdgeSteel', .006)
box('IsolatorRecess', (0, 1.12, .424), (.18, .22, .013), 'DarkPolymer', .005)
box('IsolatorPaddle', (0, 1.12, .442), (.08, .13, .025), 'WhiteArmour', .009)
box('PowerStatus', (0, 1.38, .427), (.20, .034, .014), 'MintStatus', .004)
for x in [-.16, .16]:
    for y in [.94, 1.43]:
        cylinder('PanelFastener', (x, y, .420), (x, y, .432), .013, vertices=6)
for text, y, size in [('FLOOD', 1.27, .052), ('600 W', .97, .037)]:
    bpy.ops.object.text_add(location=game((0, y, .430)))
    o = bpy.context.object
    o.name = 'PanelLabel_' + text
    o.data.body = text
    o.data.size = size
    o.data.align_x = 'CENTER'
    o.data.resolution_u = 2
    o.rotation_euler = (math.pi/2, 0, 0)
    bpy.ops.object.convert(target='MESH')
    finish(bpy.context.object, o.name, 'WhiteArmour', 0)

# Two pitched, sealed projector heads with individual yokes and cooling fins.
tilt = -math.atan2(5.55, 18)
for side in [-1, 1]:
    cx, cy, cz = side * .68, 5.55, -.15
    first = len(objects)
    box('HeatSinkBody', (cx, cy, cz), (1.19, .42, .52), 'EdgeSteel', .038)
    box('HeadSeal', (cx, cy, cz-.269), (1.10, .34, .020), 'DarkPolymer', .013)
    box('ReflectorRim', (cx, cy, cz-.293), (1.07, .33, .038), 'WhiteArmour', .017)
    box('OpticalRecess', (cx, cy, cz-.317), (.97, .25, .016), 'DarkPolymer', .009)
    for i in range(6):
        box('LEDLens', (cx-.394+i*.1576, cy, cz-.330), (.132, .20, .018), 'WarmTaskLight', .008)
    for i in range(9):
        box('CoolingFin', (cx-.50+i*.125, cy, cz+.296), (.043, .39, .155), 'EdgeSteel', .005)
    box('UpperWeatherLip', (cx, cy+.225, cz-.23), (1.22, .045, .35), 'WhiteArmour', .007)
    pivot = game((cx, cy, cz))
    from mathutils import Matrix
    rotate = Matrix.Rotation(tilt, 4, 'X')
    for o in objects[first:]:
        o.matrix_world = Matrix.Translation(pivot) @ rotate @ Matrix.Translation(-pivot) @ o.matrix_world
    for x in [cx-.62, cx+.62]:
        box('AdjustableYoke', (x, 5.50, .015), (.075, .54, .11), 'WhiteArmour', .014)
        cylinder('TiltPivot', (x-.025, 5.55, -.15), (x+.025, 5.55, -.15), .088)
    cylinder('HeadCable', (cx, 5.25, .23), (cx, 5.48, .25), .031, 'DarkPolymer', 8)

anchor('LightEmitter', (0, 5.55, -.45))
anchor('LightTarget', (0, 0, -18))
anchor('SwitchTarget', (0, 1.2, .40))
bpy.context.scene['asset_contract'] = 'Original outdoor 600 W mast; metres/Y-up runtime; beam local -Z; support surface y=0.'
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'floodlight.blend'))

# Keep five shared material draws. Anchors survive as explicit runtime contracts.
groups = {name: [o for o in objects if o.data.materials[0] == mat] for name, mat in materials.items()}
for name, group in groups.items():
    if not group:
        continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in group:
        o.select_set(True)
    bpy.context.view_layer.objects.active = group[0]
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = 'Floodlight_' + name
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
bpy.ops.export_scene.gltf(filepath=str(OUT), export_format='GLB', export_yup=True,
    export_animations=False, export_extras=False, export_vertex_color='ACTIVE', export_all_vertex_colors=False)
data = OUT.read_bytes()
length = struct.unpack_from('<I', data, 12)[0]
gltf = json.loads(data[20:20+length])
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
points = [(v.x, v.z, -v.y) for o in meshes for v in [o.matrix_world @ Vector(c) for c in o.bound_box]]
primitives = [p for m in gltf['meshes'] for p in m['primitives']]
manifest = {
    'builder': 'blender/build_floodlight.py', 'nativeSource': 'assets/build-floodlight/floodlight.blend',
    'runtime': 'public/models/base/floodlight.glb', 'provenance': 'Original deterministic Blender authorship; no external assets or textures.',
    'coordinates': 'Metres, Y up, origin mounting surface; beam -Z; switch +Z.',
    'triangles': sum(gltf['accessors'][p['indices']]['count']//3 for p in primitives),
    'drawPrimitives': len(primitives), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
    'bounds': {'min': [min(p[i] for p in points) for i in range(3)], 'max': [max(p[i] for p in points) for i in range(3)]},
    'materials': sorted(m.name for m in materials.values()), 'textures': 0,
    'anchors': {'LightEmitter': [0, 5.55, -.45], 'LightTarget': [0, 0, -18], 'SwitchTarget': [0, 1.2, .40]},
}
assert manifest['triangles'] < 10000 and len(data) < 1000000, manifest
(SOURCE/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
print(json.dumps(manifest, indent=2))
