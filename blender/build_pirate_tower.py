"""Original Hush cylinder tower; shared floodlight authoring helpers, no external inputs."""
import bpy, math, json, struct, hashlib
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/pirate-tower'
OUT=ROOT/'public/models/pirate-tower.glb'
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
materials={}
objects=[]
def material(name,color,metal,rough,emission=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
 p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 if emission:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
 materials[name]=m
material('WhiteArmour',(.43,.47,.44),.18,.59)
material('EdgeSteel',(.14,.18,.19),.75,.36)
material('DarkPolymer',(.022,.032,.033),.05,.72)
material('AmberWarning',(1,.38,.07),.05,.45,1.2)
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
        mod.segments = 1
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
    return finish(o, name, mat, .002 if vertices>=32 else 0)

def anchor(name, point):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    o.location = game(point)
    o.empty_display_size = .15
    return o

# Reinforced cylinder, clamped armour bands and exposed service conduits.
cylinder('GroundBearing',(0,-.3,0),(0,.18,0),4.6,'EdgeSteel',48)
cylinder('CylindricalConcreteCore',(0,.18,0),(0,8.74,0),3.8,'WhiteArmour',48)
for y in [.45,2.65,5.35,8.6]:
 cylinder('ClampBand',(0,y-.10,0),(0,y+.10,0),3.91,'EdgeSteel',48)
cylinder('BatteryMountingDeck',(0,8.74,0),(0,9,0),4.25,'EdgeSteel',48)
for i in range(12):
 a=2*math.pi*i/12;x,z=math.sin(a)*3.83,math.cos(a)*3.83
 cylinder('VerticalArmourSeam',(x,.6,z),(x,8.4,z),.045,'DarkPolymer',6)
 for y in [.45,2.65,5.35,8.6]:
  cylinder('BandBolt',(x,y-.07,z),(x,y+.07,z),.105,'EdgeSteel',6)
for x in [-.66,.66]:
 cylinder('IsolatorConduit',(x,1.5,3.8),(x,8.7,3.8),.07,'EdgeSteel',8)
box('IsolatorHousing',(0,1.45,3.95),(1.16,1.3,.42),'WhiteArmour',.05)
box('PanelSeal',(0,1.45,4.17),(.98,1.12,.03),'DarkPolymer',.015)
box('PanelFace',(0,1.45,4.20),(.9,1.04,.035),'EdgeSteel',.015)
box('StatusStrip',(0,1.83,4.225),(.64,.10,.024),'AmberWarning',.008)
box('SwitchRecess',(0,1.28,4.23),(.4,.45,.03),'DarkPolymer',.01)
box('IsolatorHandle',(0,1.28,4.29),(.12,.30,.12),'WhiteArmour',.02)
for i in range(8):
 a=2*math.pi*i/8;x,z=math.sin(a)*3.84,math.cos(a)*3.84
 cylinder('HazardBeacon',(x,7.65,z),(x,8,z),.13,'AmberWarning',8)
for text,y,size in [('ISOLATE',1.62,.12),('HUSH / 07',.98,.095)]:
 bpy.ops.object.text_add(location=game((0,y,4.225)));o=bpy.context.object;o.data.body=text;o.data.size=size;o.data.align_x='CENTER';o.data.resolution_u=2;o.rotation_euler=(math.pi/2,0,0)
 bpy.ops.object.convert(target='MESH');finish(bpy.context.object,'PanelLabel_'+text,'WhiteArmour',0)
anchor('TowerMount',(0,9,0));anchor('ServicePanel',(0,1.45,4.25))
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'tower.blend'))
groups={n:[o for o in objects if o.data.materials[0]==m] for n,m in materials.items()}
for name,group in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in group:o.select_set(True)
 bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();o=bpy.context.object;o.name='Tower_'+name
 bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',export_yup=True,export_animations=False,export_vertex_color='ACTIVE')
data=OUT.read_bytes();g=json.loads(data[20:20+struct.unpack_from('<I',data,12)[0]])
primitives=[p for m in g['meshes'] for p in m['primitives']]
manifest={'source':'assets/pirate-tower/tower.blend','builder':'blender/build_pirate_tower.py','asset':'public/models/pirate-tower.glb','provenance':'Original deterministic Blender geometry; UV/finish helpers derived from project floodlight builder; no external assets/textures. Existing station battery is reused separately and unchanged at 0.35 scale.','units':'metres; +Y up; mounting surface y=9; +Z service face','triangles':sum(g['accessors'][p['indices']]['count']//3 for p in primitives),'draws':len(primitives),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'textures':0,'blender':bpy.app.version_string}
assert manifest['triangles']<=10000 and manifest['bytes']<=1000000,manifest
(SOURCE/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(manifest)
