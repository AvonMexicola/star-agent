"""Rebuild the original Nomad surveyor asset with Blender (no external assets).

    blender --background --python assets/ship/build_ship.py

Design coordinates are metres, Y up, nose -Z. The export converts Blender's
Z-up coordinates back to the game's convention. Cabin, hatch and MFDs remain
runtime geometry so their physical and interactive contracts stay explicit.
"""
import math
import sys
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
        # Small manufactured edges need two segments; retain broader silhouettes.
        # The pilot chair explicitly overrides its bevels to six below.
        mod.segments = 2 if bevel <= .04 else 3
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

# Broad tapered prow, split paint panels, inset avionics and seam lines.
poly('Prow / lower keel', [(-1.87,-4.48),(-.50,-6.77),(.50,-6.77),(1.87,-4.48)], 1.22, .43, dark)
poly('Prow / ceramic upper', [(-1.89,-4.50),(-.56,-6.68),(.56,-6.68),(1.89,-4.50)], 1.39, .25, ivory, .055)
poly('Prow / central survey stripe', [(-.42,-4.49),(-.23,-6.66),(.23,-6.66),(.42,-4.49)], 1.405, .014, teal, .005)
for s in [-1,1]:
    mirror = lambda pts: [(s*x,z) for x,z in pts]
    poly('Prow / inset sensor', mirror([(.62,-4.65),(1.51,-4.65),(.67,-6.04),(.41,-6.04)]), 1.408, .018, metal)
    box('Forward landing lamp', (s*.40,1.18,-6.755), (.19,.11,.035), mint, .012)
    box('Cockpit lower brow', (s*1.40,1.31,-4.64), (.71,.28,.28), ivory)
    # Angled shoulders make a chamfered silhouette around the hollow cabin.
    for z,length in [(-.6,2.2),(1.65,2.15),(3.35,1.12)]:
        box('Cabin armor / gasket', (s*1.954,2.46,z), (.24,2.76,length), dark, .10)
        box('Cabin armor / floating ceramic', (s*2.045,2.51,z), (.27,2.40,length-.10), ivory, .12)
        box('Upper hull / petrol flash', (s*2.192,3.34,z), (.018,.44,length-.27), teal, .008)
        box('Lower hull / rub rail', (s*2.16,1.55,z), (.08,.22,length-.15), metal)
        for zz in [z-length*.32,z+length*.32]:
            box('Armor captive fastener', (s*2.191,2.95,zz), (.025,.075,.075), dark, .012)
    # Raked panoramic canopy: its glass encloses the unchanged pilot position.
    rod('Canopy / raked front spar',(s*.87,1.48,-6.36),(s*1.76,3.43,-4.18),.063,ivory)
    rod('Canopy / swept upper rail',(s*1.76,3.43,-4.18),(s*1.84,3.96,-1.8),.067,ivory)
    rod('Canopy / rear frame',(s*1.84,1.72,-1.8),(s*1.84,3.96,-1.8),.055,metal)
    rod('Canopy / sill edge',(s*.87,1.48,-6.36),(s*1.84,1.72,-1.8),.056,teal)
    rod('Canopy / side mullion',(s*1.30,1.60,-4.36),(s*1.80,3.69,-3.0),.032,metal)
    surface('Canopy / lower sculpted cheek',[(s*.87,1.48,-6.36),(s*1.84,1.72,-1.8),(s*1.84,1.0,-1.8),(s*1.80,1.0,-4.45)],ivory,.07)
    # Swept, multi-layer lifting body. Tips and gear stay within flightBounds.
    wing = mirror([(1.96,-2.06),(3.0,-1.02),(6.0,1.60),(5.47,3.63),(2.0,3.16)])
    poly('Wing / graphite substructure',wing,1.88,.34,dark,.06)
    poly('Wing / floating upper skin',mirror([(2.12,-1.85),(2.98,-.87),(5.91,1.67),(5.39,3.47),(2.12,3.04)]),1.955,.13,ivory,.035)
    poly('Wing / petrol inset',mirror([(3.4,.02),(5.70,1.86),(5.30,3.20),(3.42,2.96)]),1.972,.014,teal,.008)
    poly('Wing / vermilion tip',mirror([(5.36,1.36),(5.91,1.70),(5.45,3.42),(5.02,3.38)]),1.99,.025,orange,.008)
    for i in range(7):
        box('Wing cooling slot',(s*4.28,1.991,1.27+i*.20),(.74,.025,.065),dark,.012)
    rod('Wing / leading edge spar',(s*3.17,1.93,-.64),(s*5.81,1.93,1.63),.035,metal)
    box('Wingtip position light',(s*5.79,2.01,2.10),(.10,.075,.52),amber if s<0 else mint,.02)
    poly('Forward swept canard',mirror([(1.88,-4.37),(3.34,-3.20),(2.96,-2.43),(1.9,-2.88)]),1.75,.17,ivory)
    poly('Canard inset',mirror([(2.05,-4.14),(3.18,-3.22),(2.92,-2.83),(2.04,-3.09)]),1.77,.014,teal,.006)
    # Chamfered engine cowl and exposed rings give real depth to the drive units.
    box('Drive / main armored nacelle',(s*2.85,2.00,1.16),(1.29,1.35,4.53),dark,.25)
    box('Drive / ceramic top cowl',(s*2.85,2.48,1.12),(1.30,.51,3.94),ivory,.16)
    box('Drive / outboard fairing',(s*3.48,2.05,1.01),(.16,.69,3.37),teal,.065)
    box('Drive / intake surround',(s*2.85,2.02,-1.16),(1.16,1.13,.28),metal,.19)
    box('Drive / intake recess',(s*2.85,2.02,-1.315),(.87,.78,.04),rubber,.15)
    for i in range(5):
        box('Intake stator',(s*2.85,1.73+i*.145,-1.342),(.77,.033,.024),metal,.008)
    for i in range(8):
        box('Nacelle heat exchanger',(s*2.85,2.753,-.36+i*.39),(.82,.035,.13),dark,.016)
    rod('Drive / recessed chamber',(s*2.85,2.02,3.33),(s*2.85,2.02,3.89),.47,rubber,40)
    for z,r,t in [(3.40,.54,.10),(3.64,.55,.075),(3.91,.53,.085)]:
        ring('Drive / nozzle collar',(s*2.85,2.02,z),r,t,metal)
    rod('Drive / luminous core',(s*2.85,2.02,3.87),(s*2.85,2.02,3.90),.40,engine,40)
    for a in range(0,360,45):
        x,y = s*2.85+math.cos(math.radians(a))*.51, 2.02+math.sin(math.radians(a))*.51
        rod('Nozzle / ceramic petal',(x,y,3.45),(x,y,3.98),.055,dark)
    # Four oleo legs; feet are exactly on the existing y=0 landing plane.
    for z in [-2.72,2.80]:
        gear_before = set(bpy.context.scene.objects)
        rod('Gear / upper shock',(s*1.96,1.25,z),(s*2.34,.59,z+.16),.13,dark)
        rod('Gear / polished piston',(s*2.27,.75,z+.12),(s*2.51,.23,z+.23),.082,metal)
        rod('Gear / trailing brace',(s*1.95,1.12,z+.58),(s*2.51,.23,z+.23),.057,metal)
        box('Gear / sole',(s*2.51,.08,z+.23),(.78,.16,1.02),rubber,.055)
        box('Gear / landing shoe',(s*2.51,.18,z+.23),(.62,.12,.83),metal,.065)
        box('Gear / warning flash',(s*2.51,.247,z+.23),(.38,.014,.41),orange,.005)
        gear_parts = set(bpy.context.scene.objects) - gear_before
        bpy.ops.object.empty_add(type='PLAIN_AXES', location=xyz((s*1.96,1.3,z)))
        gear_root=bpy.context.object; gear_root.name=f'LandingGear_{s}_{z}'
        for obj in gear_parts:
            obj.parent=gear_root; obj.matrix_parent_inverse=gear_root.matrix_world.inverted()
    # Rear jamb plating leaves the 1.8 metre physical doorway completely clear.
    box('Aft portal armor',(s*1.45,2.46,4.14),(1.02,2.87,.19),ivory,.10)
    box('Aft portal rescue stripe',(s*1.45,3.40,4.242),(.73,.23,.014),orange,.005)
    box('Rear position lamp',(s*1.13,2.79,4.247),(.055,.47,.015),amber,.008)
    label('Hull registration','N O M A D  /  0 1',(s*2.196,2.5,1.68),.18,dark,(math.pi/2,0,s*math.pi/2))

box('Roof / aft ceramic shell',(0,4.10,1.15),(3.98,.20,5.8),ivory,.10)
surface('Canopy / swept roof',[(-1.87,3.98,-1.78),(-1.77,3.45,-4.20),(1.77,3.45,-4.20),(1.87,3.98,-1.78)],ivory,.12)
rod('Canopy / front brow',(-1.77,3.45,-4.20),(1.77,3.45,-4.20),.075,dark)
# Uninterrupted panoramic windscreen: its perimeter frame carries the canopy.
box('Roof / survey spine',(0,4.24,1.37),(1.19,.04,3.08),teal,.015)
for i in range(9):
    box('Roof / radiator fin',(0,4.264,.21+i*.27),(.82,.012,.10),dark,.004)
box('Rear lintel',(0,3.94,4.1),(1.83,.31,.29),dark,.035)
label('Rear ship name','N O M A D',(0,3.80,4.254),.19,ivory,(math.pi/2,0,0))
label('Prow registry','SA / 01',(0,1.426,-5.39),.23,ivory,(0,0,math.pi))

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
label('Seat / rear insignia','N / 01',(0,1.93,-2.24),.085,ivory,(math.pi/2,0,0))
seat_parts=set(bpy.context.scene.objects)-seat_start
bpy.ops.object.empty_add(type='PLAIN_AXES',location=(0,0,0));chair=bpy.context.object;chair.name='PilotChair'
for obj in seat_parts:
    obj.parent=chair
    for mod in obj.modifiers:
        if mod.type=='BEVEL':mod.segments=6

# Apply edge modifiers and consolidate static parts by finish for runtime cost.
for obj in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
    bpy.context.view_layer.objects.active = obj
    for mod in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)
for parent in [None,chair]:
    for mat in bpy.data.materials:
        objects = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.parent == parent and o.data.materials and o.data.materials[0] == mat]
        if not objects:
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        objects[0].name = mat.name.split(' / ')[0] + ' / static batch'
        # Bake positions to the ship origin; no large world coordinates in the asset.
        bpy.context.scene.cursor.location = (0,0,0)
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')

bpy.context.preferences.filepaths.save_version = 0
if '--runtime-only' not in sys.argv:
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/ship/nomad.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/nomad.glb'),
    export_format='GLB',export_yup=True,export_apply=True,export_extras=True)
print('NOMAD: saved runtime GLB' if '--runtime-only' in sys.argv else 'NOMAD: saved editable Blender source and runtime GLB')
