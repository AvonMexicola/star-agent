"""Nine original Meridian ship guns. Mount +Y; bore -Z; dimensions in metres.

python3 blender/ship_weapon_textures.py
ALSOFT_DRIVERS=null blender -b --factory-startup -noaudio --python-exit-code 1 \
  --python blender/build_ship_weapons.py
python3 blender/pack_ship_weapons.py
"""
from pathlib import Path
import hashlib
import json
import math
import sys
import bpy
import bmesh
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/ship-weapons'
OUT = ROOT / 'public/models/ship-weapons.glb'
SOURCE.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
TAU = math.tau
C = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))
def xyz(p): return C @ Vector(p)

surface = bpy.data.materials.new('Meridian weapon / baked PBR')
surface.use_nodes = True
bs = surface.node_tree.nodes.get('Principled BSDF')
nodes, links = surface.node_tree.nodes, surface.node_tree.links
def texture(name, data=False):
    node = nodes.new('ShaderNodeTexImage')
    node.image = bpy.data.images.load(str(SOURCE / 'textures' / (name + '.png')))
    if data: node.image.colorspace_settings.name = 'Non-Color'
    return node
base = texture('surface-basecolor')
orm = texture('surface-orm', True)
norm = texture('surface-normal', True)
split = nodes.new('ShaderNodeSeparateColor')
links.new(orm.outputs['Color'], split.inputs['Color'])
links.new(split.outputs['Green'], bs.inputs['Roughness'])
links.new(split.outputs['Blue'], bs.inputs['Metallic'])
normal = nodes.new('ShaderNodeNormalMap')
normal.inputs['Strength'].default_value = .45
links.new(norm.outputs['Color'], normal.inputs['Color'])
links.new(normal.outputs['Normal'], bs.inputs['Normal'])
colour = nodes.new('ShaderNodeVertexColor')
colour.layer_name = 'Col'
mix = nodes.new('ShaderNodeMix')
mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
mix.inputs['Factor'].default_value = 1
links.new(base.outputs['Color'], mix.inputs[6])
links.new(colour.outputs['Color'], mix.inputs[7])
links.new(mix.outputs[2], bs.inputs['Base Color'])

FAMILIES = {'pulse': ('Cobalt pulse', (85, 190, 255)),
            'laser': ('Solar lance', (255, 120, 45)),
            'void': ('Singularity', (193, 106, 255))}
glows = {}
for key, (_, rgb) in FAMILIES.items():
    m = bpy.data.materials.new(key + ' / emitter')
    m.use_nodes = True
    c = tuple((v / 255 / 12.92 if v / 255 <= .04045 else ((v / 255 + .055) / 1.055) ** 2.4) for v in rgb)
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*c, 1)
    p.inputs['Emission Color'].default_value = (*c, 1)
    p.inputs['Emission Strength'].default_value = 1.4
    p.inputs['Roughness'].default_value = .3
    glows[key] = m

manifest = {'stage': 'authored candidate; review pending', 'units': 'metres',
            'mountNormal': '+Y', 'bore': '-Z', 'builder': 'blender/build_ship_weapons.py',
            'textureBuilder': 'blender/ship_weapon_textures.py', 'variants': []}
CURRENT = None
BATCHES = {}
PARTS = []

def stock(name, verts, faces, tile=0, bevel=0, glow=False):
    mesh = bpy.data.meshes.new('working stock')
    mesh.from_pydata([xyz(v) for v in verts], [], faces)
    bm = bmesh.new(); bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2,
                       affect='EDGES', clamp_overlap=True)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh); bm.free(); mesh.update()
    batch = BATCHES.setdefault(glow, {'verts': [], 'faces': [], 'tiles': []})
    offset = len(batch['verts'])
    batch['verts'].extend(v.co.copy() for v in mesh.vertices)
    batch['faces'].extend(tuple(offset + i for i in p.vertices) for p in mesh.polygons)
    batch['tiles'].extend([tile] * len(mesh.polygons))
    points = [Vector(v) for v in verts]
    PARTS.append({'name': name, 'min': [min(p[i] for p in points) for i in range(3)],
                  'max': [max(p[i] for p in points) for i in range(3)]})
    bpy.data.meshes.remove(mesh)

def box(name, p, size, tile=0, bevel=.012, glow=False):
    a, b, c = [s / 2 for s in size]
    verts = [(p[0]+x, p[1]+y, p[2]+z) for x in (-a,a) for y in (-b,b) for z in (-c,c)]
    faces = [(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)]
    stock(name, verts, faces, tile, min(bevel, min(size) * .19), glow)

def tube(name, p, inner, outer, length, tile=2, segments=12, axis='Z', glow=False):
    verts = []
    for i in range(segments):
        a = i * TAU / segments
        for z, r in ((-length/2,inner),(-length/2,outer),(length/2,inner),(length/2,outer)):
            v = Vector((math.cos(a)*r, math.sin(a)*r, z))
            if axis == 'Y': v = Vector((v.x, v.z, v.y))
            verts.append(tuple(v + Vector(p)))
    faces = []
    for i in range(segments):
        a, b = i*4, ((i+1)%segments)*4
        faces.extend([(a,a+1,b+1,b),(a+2,b+2,b+3,a+3),
                      (a,b,b+2,a+2),(a+1,a+3,b+3,b+1)])
    stock(name, verts, faces, tile, 0, glow)

def empty(name, parent=None, position=(0,0,0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent; obj.location = xyz(position)
    return obj

def finish_meshes(root, key, family, size):
    meshes = []
    for glow, batch in BATCHES.items():
        mesh = bpy.data.meshes.new(key + ('_emitter' if glow else '_surface'))
        mesh.from_pydata(batch['verts'], [], batch['faces']); mesh.update()
        obj = bpy.data.objects.new(mesh.name, mesh)
        bpy.context.collection.objects.link(obj); obj.parent = root
        mesh.materials.append(glows[family] if glow else surface)
        uv = mesh.uv_layers.new(name='UVMap')
        for poly, tile in zip(mesh.polygons, batch['tiles']):
            axes = sorted(range(3), key=lambda i: abs(poly.normal[i]))[:2]
            positions = [mesh.vertices[mesh.loops[li].vertex_index].co for li in poly.loop_indices]
            lo = [min(p[a] for p in positions) for a in axes]
            hi = [max(p[a] for p in positions) for a in axes]
            for li in poly.loop_indices:
                v = mesh.vertices[mesh.loops[li].vertex_index].co
                u, t = [(v[a]-lo[j])/max(1e-5,hi[j]-lo[j]) for j,a in enumerate(axes)]
                uv.data[li].uv = ((tile%2+.025+u*.95)/2, (3-tile//2+.025+t*.95)/4)
        if not glow:
            col = mesh.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='CORNER')
            tree = BVHTree.FromPolygons([v.co for v in mesh.vertices],
                [tuple(p.vertices) for p in mesh.polygons],all_triangles=False)
            for poly in mesh.polygons:
                n = poly.normal.normalized()
                for li in poly.loop_indices:
                    p = mesh.vertices[mesh.loops[li].vertex_index].co+n*.002
                    hit = tree.ray_cast(p,n,.17*size)
                    shade = 1 if hit[0] is None else max(.68,.77+.23*hit[3]/(.17*size))
                    col.data[li].color = (shade,shade,shade,1)
        meshes.append(obj)
    return meshes

for size, diameter, length, height, width in [
    (1, .5, 1.65, .45, .50), (2, .8, 2.40, .62, .80), (3, 1.25, 3.75, .95, 1.25)]:
    for family, (label, colour) in FAMILIES.items():
        BATCHES = {}; PARTS = []
        key = f'{family}-s{size}'
        root = empty('Weapon_' + key)
        root['weaponType'] = family; root['weaponSize'] = size
        root['manufacturer'] = 'Meridian Shipworks'; root['kind'] = 'ship-weapon'
        root['bore'] = '-Z'; root['mountNormal'] = '+Y'
        h, w, L = height, width, length
        y = h * .62
        # Stationary keyed mating foot, reinforced neck and replaceable receiver.
        tube('Keyed mating foot', (0,.025,0), .025, diameter/2, .05, 2, 12 if size<3 else 16, 'Y')
        box('Docking neck', (0,h*.18,-.045), (w*.43,h*.24,.28*L), 1, .018)
        box('Receiver lower tray', (0,h*.40,-L*.26), (w*.70,h*.24,L*.60), 1, .026)
        box('Chamfered receiver armor', (0,h*.67,-L*.25), (w*.76,h*.38,L*.51), 0, .045)
        box('Rear service cap', (0,h*.62,L*.025), (w*.68,h*.47,L*.11), 2, .024)
        box('Access panel', (0,h*.875,-L*.21), (w*.49,h*.025,L*.25), 4, .008)
        for side in (-1,1):
            box('Recessed side joint', (side*w*.385,h*.61,-L*.25), (.014,h*.10,L*.35), 3, .002)
            box('Receiver longitudinal rail', (side*w*.34,h*.38,-L*.30), (w*.07,h*.11,L*.56), 2, .009)
            for i in range(3+size):
                box('Cooling louver', (side*w*.39,h*.66,-L*(.11+i*.064)),
                    (.013,h*.16,L*.022), 3, .002)
            box('Size identification band', (side*w*.397,h*.79,-L*.37),
                (.01,h*.075,L*.11), 5, .001)
        muzzle_z = -L
        if family == 'pulse':
            # Exposed ribbed accelerator, open steel bore and ceramic heat shields.
            radius = h*.20
            tube('Accelerator barrel', (0,y,-L*.65), radius*.55, radius, L*.69, 2, 12)
            for i in range(4+size):
                tube('Accelerator cooling collar', (0,y,-L*(.46+i*.062)),
                     radius*.99,radius*1.29,L*.024,1,12)
            for side in (-1,1):
                box('Ceramic barrel guard', (side*w*.20,y,-L*.66),
                    (w*.115,h*.31,L*.46),0,.018)
            tube('Muzzle crown', (0,y,-L*.98),radius*.56,radius*1.2,L*.04,2,12)
            tube('Recessed cobalt emitter', (0,y,-L*.965),radius*.57,radius*.78,L*.018,2,12,glow=True)
        elif family == 'laser':
            # Long optical bench and pointed split shroud; visible aperture at end.
            radius = h*.17
            tube('Optical bore', (0,y,-L*.66),radius*.55,radius,L*.68,2,12)
            for side in (-1,1):
                box('Tapered optical shield', (side*w*.145,y,-L*.65),
                    (w*.14,h*.38,L*.66),0,.027)
                box('Optical focus rail', (side*w*.232,y,-L*.70),
                    (w*.035,h*.12,L*.45),2,.006)
            for i in range(2+size):
                tube('Focus lens housing', (0,y,-L*(.57+i*.073)),
                     radius*.99,radius*1.4,L*.026,1,12)
            tube('Optical aperture', (0,y,-L*.985),radius*.50,radius*1.14,L*.03,2,12)
            tube('Recessed solar emitter', (0,y,-L*.972),radius*.52,radius*.78,L*.012,2,12,glow=True)
        else:
            # Heavier annular magnetic emitter; hollow central path remains visible.
            radius = h*.25
            tube('Coil-lined bore', (0,y,-L*.64),radius*.52,radius*.71,L*.69,3,12)
            for i in range(3+size):
                z = -L*(.43+i*(.49/(2+size)))
                tube('Armored containment collar',(0,y,z),radius*.91,radius*1.30,L*.047,0,12)
                tube('Violet containment coil',(0,y,z-L*.032),radius*.73,radius*.94,L*.027,2,12,glow=True)
            for side in (-1,1):
                box('Magnetic coil spine',(side*w*.29,y,-L*.69),
                    (w*.08,h*.21,L*.60),2,.012)
            tube('Containment muzzle',(0,y,-L*.98),radius*.53,radius*1.3,L*.04,2,12)
            tube('Recessed violet emitter',(0,y,-L*.965),radius*.54,radius*.72,L*.013,2,12,glow=True)
        # Larger guns gain a second/split power bus and additional cooling saddles.
        for i in range(size):
            xx = (i-(size-1)/2)*w*.15
            box('Power bus',(xx,h*.93,-L*.23),(w*.085,h*.055,L*.29),2,.004)
        for side in (-1,1):
            box('Powered status line',(side*w*.31,h*.856,-L*.13),
                (w*.04,h*.02,L*.13),2,.001,True)
        muzzle = empty('Muzzle_' + key, root, (0,y,muzzle_z))
        muzzle['role'] = 'muzzle'; muzzle['bore'] = '-Z'
        muzzle['weaponType'] = family; muzzle['weaponSize'] = size
        meshes = finish_meshes(root, key, family, size)
        bpy.context.view_layer.update()
        bounds = [[min((C.inverted()@v.co)[i] for o in meshes for v in o.data.vertices),
                   max((C.inverted()@v.co)[i] for o in meshes for v in o.data.vertices)] for i in range(3)]
        manifest['variants'].append({'id':key,'type':family,'label':label,'size':size,
            'root':root.name,'muzzle':muzzle.name,'muzzlePosition':[0,y,muzzle_z],
            'min':[v[0] for v in bounds],'max':[v[1] for v in bounds],
            'materialDraws':len(meshes),'parts':PARTS})

# Hull-specific foundations. Every fork keeps the centre gear channel open.
manifest['adapters'] = []
def profiled_foot(name, samples, burial, bottom=0):
    xs=sorted(set(p[0] for p in samples)); zs=sorted(set(p[2] for p in samples))
    heights={(p[0],p[2]):p[1] for p in samples}
    verts=[(x, heights[x,z]-burial, z) for x in xs for z in zs]
    count=len(verts); verts += [(x,bottom,z) for x in xs for z in zs]
    faces=[]; nz=len(zs)
    for i in range(len(xs)-1):
        for j in range(nz-1):
            a=i*nz+j; q=(a,a+1,a+nz+1,a+nz)
            faces += [q,tuple(v+count for v in q)]
    boundary=list(range(nz))+[i*nz+nz-1 for i in range(1,len(xs))]+list(range(count-2,count-nz-1,-1))+[i*nz for i in range(len(xs)-2,0,-1)]
    for i,a in enumerate(boundary):
        b=boundary[(i+1)%len(boundary)];faces.append((a,b,b+count,a+count))
    stock(name,verts,faces,2,.001)

skin=json.loads((SOURCE/'foundations.json').read_text())['samples']
for name in ['Adapter_Nomad', 'Adapter_Kestrel_Nose', 'Adapter_Kestrel_WingL', 'Adapter_Kestrel_WingR', 'Adapter_Atlas_Front', 'Adapter_Atlas_Aft']:
    BATCHES = {}; PARTS = []
    root = empty(name)
    root['kind'] = 'weapon-foundation'
    if name == 'Adapter_Nomad':
        tube('Connector clearance spacer',(0,.0075,0),.14,.25,.015,2,12,'Y')
    elif name == 'Adapter_Kestrel_Nose':
        for side in (-1,1):
            box('Outboard fork rail', (side*.34,.0025,-.60), (.10,.045,1.24), 2, .009)
            samples=[p for p in skin['HP_Nose'] if p[0]*side>0]
            profiled_foot('Nose chine return post',samples,.008,.02)
    elif name.startswith('Adapter_Kestrel_Wing'):
        profiled_foot('Wing skin footing',skin['HP_'+name.split('_')[-1]],.005)
    elif name == 'Adapter_Atlas_Front':
        tube('Roof footing', (0,-.031,0), .025,.625,.062,2,16,'Y')
    else:
        tube('Radiator bridge plate', (0,-.0125,0), .025,.625,.025,2,16,'Y')
        for side in (-1,1):
            box('Between-fin stand', (side*.35,-.0665,0), (.18,.083,.55),2,.006)
    finish_meshes(root,name,'pulse',2)
    manifest['adapters'].append({'root': name, 'parts': PARTS})

# The editable source opens as a readable lineup. Export all attachment roots at
# their mating origin so clones can be used directly on the ship sockets.
roots = [o for o in bpy.context.scene.objects if o.parent is None]
for i, root in enumerate(roots):
    root.location = xyz(((i % 3)*5, 0, (i//3)*5))
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'ship-weapons.blend'),compress=True)
for root in roots: root.location = (0,0,0)
bpy.context.view_layer.update()

bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',export_extras=True,
    export_yup=True,export_apply=True,export_animations=False,export_cameras=False,
    export_lights=False,export_materials='EXPORT')
(SOURCE/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Weapon geometry exported; run pack_ship_weapons.py to finalize WebP payload and manifest.')
