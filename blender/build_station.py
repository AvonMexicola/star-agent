"""Star Agent — orbital station with an animated hangar. Fully procedural bpy build.

    blender -b --python blender/build_station.py -- --out public/models/station.glb
    blender -b --python blender/build_station.py -- --out public/models/station_lod1.glb --lod
    blender -b --python blender/build_station.py -- --out public/models/station.glb --preview blender

Blender frame: X = station long axis, Z = "up" (away from the planet), the hangar opens
toward +Y. The glTF exporter converts Z-up to Y-up, so in three.js the hangar opens toward
local -Z and local +Y points away from the planet. All dimensions are metres.

Named objects the runtime depends on (src/station.js):
  HangarDoor_L / HangarDoor_R  sliding doors; the animation "DoorsOpen" (5 s) moves them ±22 m
  LandingDeck                  the only collision surface, top face at deck height
  LandingPad                   empty at the deck centre, local +Z (glTF) toward the opening
  ApproachPoint                empty 90 m outside the opening on the approach axis
  DoorTrigger                  empty 250 m outside the opening
Materials NavLight_Red / NavLight_Green / Beacon_White are found by name for blinking.
"""
import bpy, bmesh, math, sys, json, struct, os, time
from mathutils import Vector, Matrix, Euler

T0 = time.time()
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv and argv.index(name) + 1 < len(argv) else default
OUT = os.path.abspath(arg('--out', 'public/models/station.glb'))
LOD = '--lod' in argv
PREVIEW_DIR = arg('--preview')
DETAIL = not LOD
TAU = math.pi * 2

# ----------------------------------------------------------------------------- scene reset
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.curves, bpy.data.actions):
        for item in list(block):
            block.remove(item)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    scene.render.fps = 24
    scene.frame_start, scene.frame_end = 1, 121
    return scene

scene = reset_scene()
COLL = bpy.data.collections.new('Station')
scene.collection.children.link(COLL)

# ----------------------------------------------------------------------------- materials
MATS = {}
def material(name, color, metallic=0.0, roughness=0.5, emission=None, strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if emission is not None:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1.0)
        bsdf.inputs['Emission Strength'].default_value = strength
    # Viewport/workbench colour so previews without EEVEE still read.
    shown = emission if (emission is not None and strength > 0) else color
    mat.diffuse_color = (*[min(1.0, c) for c in shown], 1.0)
    mat.metallic, mat.roughness = metallic, roughness
    MATS[name] = mat
    return mat

MINT = (0.48, 0.86, 0.63)
AMBER = (1.0, 0.52, 0.10)
material('Hull', (0.78, 0.78, 0.78), 0.10, 0.55)
material('HullPanel', (0.62, 0.64, 0.66), 0.15, 0.50)
material('Gunmetal', (0.18, 0.18, 0.19), 0.80, 0.40)
material('Truss', (0.16, 0.17, 0.19), 0.85, 0.42)
material('Solar', (0.03, 0.05, 0.20), 0.45, 0.30)
material('SolarBack', (0.55, 0.55, 0.52), 0.30, 0.60)
material('Radiator', (0.90, 0.90, 0.93), 0.05, 0.30)
material('Deck', (0.26, 0.27, 0.28), 0.30, 0.68)
material('Rubber', (0.04, 0.04, 0.045), 0.0, 0.92)
material('Glass', (0.05, 0.08, 0.12), 0.9, 0.08)
material('Mint', MINT, 0.0, 0.4, MINT, 2.0)
material('MintPaint', (0.42, 0.78, 0.58), 0.0, 0.5, MINT, 0.35)
material('Amber', AMBER, 0.0, 0.4, AMBER, 2.0)
material('AmberSoft', AMBER, 0.0, 0.4, AMBER, 1.2)
material('HangarLight', (1.0, 1.0, 1.0), 0.0, 0.3, (1.0, 0.97, 0.90), 4.0)
material('Window', (1.0, 0.85, 0.6), 0.0, 0.3, (1.0, 0.80, 0.55), 3.0)
material('ControlGlass', (0.55, 0.75, 1.0), 0.0, 0.2, (0.55, 0.78, 1.0), 1.6)
material('NavLight_Red', (1.0, 0.05, 0.02), 0.0, 0.3, (1.0, 0.05, 0.02), 6.0)
material('NavLight_Green', (0.10, 1.0, 0.30), 0.0, 0.3, (0.10, 1.0, 0.30), 6.0)
material('Beacon_White', (1.0, 1.0, 1.0), 0.0, 0.3, (1.0, 1.0, 1.0), 8.0)
material('Thruster', (0.3, 0.6, 1.0), 0.0, 0.3, (0.3, 0.6, 1.0), 1.5)

# ----------------------------------------------------------------------------- geometry generators
def rot(x=0.0, y=0.0, z=0.0):
    return Euler((x, y, z), 'XYZ').to_matrix().to_4x4()

def place(loc=(0, 0, 0), R=None):
    return Matrix.Translation(Vector(loc)) @ (R if R is not None else Matrix.Identity(4))

def box_geo(sx, sy, sz, M):
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    verts = [M @ Vector((x, y, z)) for x in (-hx, hx) for y in (-hy, hy) for z in (-hz, hz)]
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    return verts, faces, [False] * 6

def cyl_geo(r1, r2, length, segs, M, caps=True):
    """Cylinder/cone along local Z, centred at the origin."""
    verts, faces, smooth = [], [], []
    for r, z in ((r1, -length / 2), (r2, length / 2)):
        for i in range(segs):
            a = TAU * i / segs
            verts.append(M @ Vector((r * math.cos(a), r * math.sin(a), z)))
    for i in range(segs):
        j = (i + 1) % segs
        faces.append((i, j, segs + j, segs + i)); smooth.append(True)
    if caps:
        faces.append(tuple(reversed(range(segs)))); smooth.append(False)
        faces.append(tuple(range(segs, 2 * segs))); smooth.append(False)
    return verts, faces, smooth

def lathe_geo(profile, segs, M, smooth=True):
    """Revolve a (radius, z) polyline about local Z. Zero radii become poles."""
    verts, faces, sm = [], [], []
    rings = []
    for r, z in profile:
        if r <= 1e-6:
            rings.append([len(verts)]); verts.append(M @ Vector((0, 0, z)))
        else:
            start = len(verts)
            for i in range(segs):
                a = TAU * i / segs
                verts.append(M @ Vector((r * math.cos(a), r * math.sin(a), z)))
            rings.append(list(range(start, start + segs)))
    for a, b in zip(rings, rings[1:]):
        for i in range(segs):
            j = (i + 1) % segs
            if len(a) == 1: faces.append((a[0], b[j], b[i]))
            elif len(b) == 1: faces.append((a[i], a[j], b[0]))
            else: faces.append((a[i], a[j], b[j], b[i]))
            sm.append(smooth)
    return verts, faces, sm

def sphere_geo(r, segs, rings, M):
    profile = [(r * math.sin(math.pi * k / rings), -r * math.cos(math.pi * k / rings)) for k in range(rings + 1)]
    return lathe_geo(profile, segs, M)

def torus_geo(R, r, segs, rings, M):
    verts, faces, sm = [], [], []
    for i in range(segs):
        a = TAU * i / segs
        for k in range(rings):
            b = TAU * k / rings
            verts.append(M @ Vector(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b))))
    for i in range(segs):
        i2 = (i + 1) % segs
        for k in range(rings):
            k2 = (k + 1) % rings
            faces.append((i * rings + k, i2 * rings + k, i2 * rings + k2, i * rings + k2)); sm.append(True)
    return verts, faces, sm

def prism_geo(points, thickness, M):
    """Extrude a planar polygon (x, y) along local Z, centred on z = 0."""
    n = len(points)
    verts = [M @ Vector((x, y, -thickness / 2)) for x, y in points] + [M @ Vector((x, y, thickness / 2)) for x, y in points]
    faces = [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, n + j, n + i))
    return verts, faces, [False] * len(faces)

def annulus_geo(r_in, r_out, segs, thickness, M, a0=0.0, a1=TAU):
    verts, faces = [], []
    closed = abs(a1 - a0 - TAU) < 1e-6
    count = segs if closed else segs + 1
    for i in range(count):
        a = a0 + (a1 - a0) * i / segs
        c, s = math.cos(a), math.sin(a)
        for r in (r_in, r_out):
            for z in (-thickness / 2, thickness / 2):
                verts.append(M @ Vector((r * c, r * s, z)))
    for i in range(segs):
        j = (i + 1) % count
        a, b = i * 4, j * 4
        faces.append((a + 1, a + 3, b + 3, b + 1))  # top
        faces.append((a + 0, b + 0, b + 2, a + 2))  # bottom
        faces.append((a + 2, b + 2, b + 3, a + 3))  # outer
        faces.append((a + 0, a + 1, b + 1, b + 0))  # inner
    return verts, faces, [False] * len(faces)

def strut_geo(a, b, radius, segs=6):
    a, b = Vector(a), Vector(b)
    d = b - a
    q = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    return cyl_geo(radius, radius, d.length, segs, place((a + b) / 2, q), caps=False)

# ----------------------------------------------------------------------------- batching into few objects
OBJECTS = []
class Batch:
    def __init__(self, name):
        self.name = name; self.verts = []; self.faces = []; self.smooth = []; self.mat_index = []; self.mats = []
    def add(self, geo, mat):
        verts, faces, smooth = geo
        mat = MATS[mat] if isinstance(mat, str) else mat
        if mat not in self.mats: self.mats.append(mat)
        mi = self.mats.index(mat)
        offset = len(self.verts)
        self.verts.extend(verts)
        self.faces.extend(tuple(i + offset for i in f) for f in faces)
        self.smooth.extend(smooth)
        self.mat_index.extend([mi] * len(faces))
        return self
    def build(self):
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata([tuple(v) for v in self.verts], [], self.faces)
        for m in self.mats: mesh.materials.append(m)
        for p, mi, sm in zip(mesh.polygons, self.mat_index, self.smooth):
            p.material_index = mi; p.use_smooth = sm
        mesh.validate(); mesh.update()
        obj = bpy.data.objects.new(self.name, mesh)
        COLL.objects.link(obj)
        OBJECTS.append(obj)
        return obj

def link(obj):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    COLL.objects.link(obj)
    OBJECTS.append(obj)
    return obj

def select_only(objs, active=None):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = active or objs[0]

# Hero pieces built with ops so they can carry a bevel modifier.
def hero_box(name, size, loc, mat, bevel=0.3, segments=2, R=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    obj = bpy.context.object; obj.name = name
    obj.scale = size
    select_only([obj]); bpy.ops.object.transform_apply(scale=True)
    if R is not None: obj.matrix_world = Matrix.Translation(Vector(loc)) @ R
    else: obj.location = loc
    obj.data.materials.append(MATS[mat])
    if DETAIL and bevel > 0: add_bevel(obj, bevel, segments)
    return link(obj)

def hero_cylinder(name, radius, depth, loc, mat, axis='X', segs=48, bevel=0.3, segments=2, r2=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=segs if DETAIL else max(12, segs // 3), radius=radius, depth=depth, location=(0, 0, 0))
    obj = bpy.context.object; obj.name = name
    if r2 is not None:  # simple taper: scale the top ring
        bm = bmesh.new(); bm.from_mesh(obj.data)
        for v in bm.verts:
            if v.co.z > 0: v.co.x *= r2 / radius; v.co.y *= r2 / radius
        bm.to_mesh(obj.data); bm.free()
    R = {'X': rot(0, math.pi / 2, 0), 'Y': rot(math.pi / 2, 0, 0), 'Z': Matrix.Identity(4)}[axis]
    obj.matrix_world = Matrix.Translation(Vector(loc)) @ R
    obj.data.materials.append(MATS[mat])
    for p in obj.data.polygons: p.use_smooth = True
    if DETAIL and bevel > 0: add_bevel(obj, bevel, segments)
    return link(obj)

def add_bevel(obj, width, segments):
    mod = obj.modifiers.new('Bevel', 'BEVEL')
    mod.width = width; mod.segments = segments; mod.limit_method = 'ANGLE'; mod.angle_limit = math.radians(40)
    mod.harden_normals = True
    for p in obj.data.polygons: p.use_smooth = True

def join(objs, name):
    select_only(objs)
    bpy.ops.object.convert(target='MESH')  # applies modifiers on every selected object
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = name; obj.data.name = name
    for o in objs:
        if o is not obj and o in OBJECTS: OBJECTS.remove(o)
    if obj not in OBJECTS: OBJECTS.append(obj)
    return obj

def set_origin(obj, point):
    point = Vector(point)
    obj.data.transform(Matrix.Translation(-point))
    obj.matrix_world = Matrix.Translation(point) @ obj.matrix_world
    return obj

def text_mesh(name, body, size, loc, R, mat, extrude=0.04):
    bpy.ops.object.text_add(location=(0, 0, 0))
    obj = bpy.context.object; obj.name = name
    obj.data.body = body; obj.data.size = size; obj.data.extrude = extrude
    obj.data.align_x = 'CENTER'; obj.data.align_y = 'CENTER'; obj.data.resolution_u = 3
    obj.data.materials.append(MATS[mat])
    obj.matrix_world = Matrix.Translation(Vector(loc)) @ R
    select_only([obj]); bpy.ops.object.convert(target='MESH')
    obj = bpy.context.view_layer.objects.active
    return link(obj)

def empty(name, loc, R=None):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = 'ARROWS'; obj.empty_display_size = 3
    obj.matrix_world = Matrix.Translation(Vector(loc)) @ (R if R is not None else Matrix.Identity(4))
    COLL.objects.link(obj); OBJECTS.append(obj)
    return obj

# ============================================================================= LAYOUT CONSTANTS
# Hangar block: interior clear volume 42 (x) x 15 (z) x 48 (y).
HX, HZ0, HZ1, HY0, HY1 = 21.0, -8.0, 7.0, -26.0, 22.0       # interior half-width, floor, ceiling, back, opening plane
WALL, SLAB = 4.0, 2.0                                       # side wall and slab thickness
OX, OZ0, OZ1, OY0 = HX + WALL, HZ0 - 3.0, HZ1 + SLAB, HY0 - 2.0  # exterior bounds
DOOR_W, DOOR_H, DOOR_T, DOOR_SLIDE = 21.4, 15.4, 1.2, 22.0
DOOR_Y = HY1 + DOOR_T / 2 + 0.05                            # doors ride just outside the opening plane
DOOR_Z = (HZ0 + HZ1) / 2 - 0.2
SPINE_Z, SPINE_R, SPINE_X = 13.6, 4.6, 64.0
TRUSS_X, TRUSS_Y = 54.0, 44.0
RING_X, RING_R, RING_TUBE = -40.0, 18.0, 3.0
DECK_TOP = HZ0
DECK_THICKNESS = 0.4
# The structural slab ends under the finished deck, never on its visible face.
FLOOR_TOP = DECK_TOP - DECK_THICKNESS
PAD = Vector((0.0, (HY0 + HY1) / 2, DECK_TOP))
HOVER = 3.2                                                  # ship hover height used by navigation.js

# ============================================================================= HANGAR HULL
hull_parts = []
hull_parts.append(hero_box('Hull_Floor', (2 * OX, HY1 - OY0, FLOOR_TOP - OZ0), (0, (OY0 + HY1) / 2, (OZ0 + FLOOR_TOP) / 2), 'Hull', 0.5))
hull_parts.append(hero_box('Hull_Ceiling', (2 * OX, HY1 - OY0, OZ1 - HZ1), (0, (OY0 + HY1) / 2, (HZ1 + OZ1) / 2), 'Hull', 0.5))
for s in (-1, 1):
    hull_parts.append(hero_box(f'Hull_Side{s}', (WALL, HY1 - OY0, OZ1 - OZ0), (s * (HX + WALL / 2), (OY0 + HY1) / 2, (OZ0 + OZ1) / 2), 'Hull', 0.5))
hull_parts.append(hero_box('Hull_Back', (2 * OX, HY0 - OY0, OZ1 - OZ0), (0, (OY0 + HY0) / 2, (OZ0 + OZ1) / 2), 'Hull', 0.5))
# Door frame lip: a thick collar around the opening face.
hull_parts.append(hero_box('Hull_Lintel', (2 * OX + 2, 2.4, OZ1 - HZ1 + 0.6), (0, HY1 - 1.2, (HZ1 + OZ1) / 2 + 0.3), 'HullPanel', 0.3))
hull_parts.append(hero_box('Hull_Sill', (2 * OX + 2, 2.4, HZ0 - OZ0 + 0.6), (0, HY1 - 1.2, (OZ0 + HZ0) / 2 - 0.3), 'HullPanel', 0.3))
for s in (-1, 1):
    hull_parts.append(hero_box(f'Hull_Jamb{s}', (WALL + 1.2, 2.4, OZ1 - OZ0 + 1.2), (s * (HX + WALL / 2 + 0.3), HY1 - 1.2, (OZ0 + OZ1) / 2), 'HullPanel', 0.3))
# Spine pylons and the main spine.
for x in (-16, 16):
    hull_parts.append(hero_box(f'Pylon{x}', (7, 12, 3.0), (x, -4, OZ1 + 1.4), 'HullPanel', 0.3))
hull_parts.append(hero_cylinder('Spine', SPINE_R, 2 * SPINE_X, (0, 0, SPINE_Z), 'Hull', segs=64, bevel=0.6))
# Spine ribs (thicker collars) every 8 m, skipping the hangar top.
rib_batch = Batch('SpineRibs')
if DETAIL:
    for i in range(-7, 8):
        x = i * 8.0
        rib_batch.add(cyl_geo(SPINE_R + 0.45, SPINE_R + 0.45, 1.1, 48, place((x, 0, SPINE_Z), rot(0, math.pi / 2, 0))), 'HullPanel')
    # Longitudinal service grooves on the spine.
    for a in (0.5, 1.9, 3.6, 5.0):
        R = rot(a, 0, 0)
        rib_batch.add(box_geo(2 * SPINE_X - 2, 0.35, 0.5, place((0, 0, SPINE_Z)) @ R @ Matrix.Translation((0, 0, SPINE_R))), 'Gunmetal')
    # Mint brand stripe along the spine flanks.
    for a in (1.15, 4.3):
        R = rot(a, 0, 0)
        rib_batch.add(box_geo(2 * SPINE_X - 10, 0.5, 0.25, place((0, 0, SPINE_Z)) @ R @ Matrix.Translation((0, 0, SPINE_R + 0.1))), 'MintPaint')
rib_batch.build() if rib_batch.faces else None
HULL = join(hull_parts, 'Hull')

# ============================================================================= HANGAR EXTERIOR DETAIL
ext = Batch('HullDetail')
if DETAIL:
    # Panel seams on the side and top faces: thin dark grooves.
    for s in (-1, 1):
        for y in range(int(OY0) + 4, int(HY1) - 2, 6):
            ext.add(box_geo(0.16, 0.3, OZ1 - OZ0 - 1.5, place((s * (OX + 0.02), y, (OZ0 + OZ1) / 2))), 'Gunmetal')
        for z in (-3.0, 3.5):
            ext.add(box_geo(0.16, HY1 - OY0 - 4, 0.3, place((s * (OX + 0.02), (OY0 + HY1) / 2, z))), 'Gunmetal')
        # Mint accent band along the side at deck height.
        ext.add(box_geo(0.22, HY1 - OY0 - 6, 0.7, place((s * (OX + 0.05), (OY0 + HY1) / 2 - 1, -6.0))), 'MintPaint')
        # Approach lights: red to port (-X), green to starboard (+X) on the jambs.
        for z in (OZ0 + 1.5, (OZ0 + OZ1) / 2, OZ1 - 1.5):
            ext.add(sphere_geo(0.35, 12, 6, place((s * (OX + 0.7), HY1 + 0.6, z))), 'NavLight_Red' if s < 0 else 'NavLight_Green')
    for x in range(-20, 21, 8):
        ext.add(box_geo(0.3, HY1 - OY0 - 4, 0.16, place((x, (OY0 + HY1) / 2, OZ1 + 0.02))), 'Gunmetal')
    # Roof tanks and pipework.
    for x, y in ((-20, -18), (20, -18), (-20, 12), (20, 12)):
        ext.add(sphere_geo(2.6, 32, 16, place((x, y, OZ1 + 2.8))), 'Hull')
        ext.add(cyl_geo(2.7, 2.7, 0.5, 32, place((x, y, OZ1 + 2.8))), 'Gunmetal')
        ext.add(cyl_geo(0.6, 0.6, 1.6, 12, place((x, y, OZ1 + 0.8))), 'Gunmetal')
    for x in (-20, 20):
        ext.add(cyl_geo(0.32, 0.32, 30, 12, place((x, -3, OZ1 + 0.5), rot(math.pi / 2, 0, 0))), 'Gunmetal')
    for y in (-18, 12):
        ext.add(cyl_geo(0.32, 0.32, 40, 12, place((0, y, OZ1 + 0.5), rot(0, math.pi / 2, 0))), 'Gunmetal')
    # Greeble crates and vents on the roof and flanks.
    for i, (x, y) in enumerate([(-8, -22), (8, -22), (-12, 4), (12, 4), (0, -12), (-4, 16), (4, 16)]):
        ext.add(box_geo(3 + i % 2, 2.2, 1.4, place((x, y, OZ1 + 0.7))), 'HullPanel')
        ext.add(box_geo(2.2, 1.6, 0.3, place((x, y, OZ1 + 1.55))), 'Gunmetal')
    for s in (-1, 1):
        for y in (-16, -4, 8):
            ext.add(box_geo(0.9, 4.0, 2.2, place((s * (OX + 0.45), y, 4.0))), 'Gunmetal')
            for k in range(4):
                ext.add(box_geo(1.0, 0.25, 1.8, place((s * (OX + 0.5), y - 1.5 + k, 4.0))), 'HullPanel')
    # RCS thruster quads at the four roof corners.
    for x, y in ((-OX + 1, OY0 + 1), (OX - 1, OY0 + 1), (-OX + 1, HY1 - 1), (OX - 1, HY1 - 1)):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            a = math.atan2(dy, dx)
            ext.add(cyl_geo(0.18, 0.42, 0.7, 10, place((x + dx * 0.9, y + dy * 0.9, OZ1 + 0.6), rot(0, math.pi / 2, a))), 'Gunmetal')
    # Door rails, end posts and diagonal braces (doors slide onto them when open).
    rail_x = DOOR_W + DOOR_SLIDE + 1.5
    for z, h in ((DOOR_Z + DOOR_H / 2 + 0.45, 0.7), (DOOR_Z - DOOR_H / 2 - 0.45, 0.7)):
        ext.add(box_geo(2 * rail_x, DOOR_T + 0.6, h, place((0, DOOR_Y, z))), 'Gunmetal')
    for s in (-1, 1):
        ext.add(box_geo(1.0, DOOR_T + 0.8, DOOR_H + 2.0, place((s * rail_x, DOOR_Y, DOOR_Z))), 'Gunmetal')
        for z in (DOOR_Z + DOOR_H / 2 + 0.45, DOOR_Z - DOOR_H / 2 - 0.45):
            ext.add(strut_geo((s * OX, HY1 - 3, z), (s * rail_x, DOOR_Y - 0.4, z), 0.28), 'Truss')
            ext.add(strut_geo((s * OX, HY1 - 10, z), (s * rail_x, DOOR_Y - 0.4, z), 0.22), 'Truss')
        ext.add(strut_geo((s * OX, HY1 - 6, (OZ0 + OZ1) / 2), (s * rail_x, DOOR_Y - 0.4, DOOR_Z), 0.22), 'Truss')
    # Runway-style approach lights along the sill (mint).
    for x in range(-20, 21, 4):
        ext.add(sphere_geo(0.22, 10, 5, place((x, HY1 + 0.9, OZ0 + 0.3))), 'Mint')
else:
    for x, y in ((-20, -18), (20, -18), (-20, 12), (20, 12)):
        ext.add(sphere_geo(2.6, 12, 6, place((x, y, OZ1 + 2.8))), 'Hull')
    rail_x = DOOR_W + DOOR_SLIDE + 1.5
    for z in (DOOR_Z + DOOR_H / 2 + 0.45, DOOR_Z - DOOR_H / 2 - 0.45):
        ext.add(box_geo(2 * rail_x, DOOR_T + 0.6, 0.7, place((0, DOOR_Y, z))), 'Gunmetal')
ext.build()

# Signage.
if DETAIL:
    text_mesh('Sign_Front', 'HANGAR 01', 1.25, (0, HY1 + 0.08, (HZ1 + OZ1) / 2 + 0.35), rot(math.pi / 2, 0, math.pi), 'Mint')
    text_mesh('Sign_Port', 'STAR AGENT', 3.2, (-OX - 0.08, -4, 2.0), rot(math.pi / 2, 0, -math.pi / 2), 'MintPaint')
    text_mesh('Sign_Starboard', 'STAR AGENT', 3.2, (OX + 0.08, -4, 2.0), rot(math.pi / 2, 0, math.pi / 2), 'MintPaint')

# ============================================================================= TRUSSES, SOLAR, RADIATORS
truss = Batch('Truss')
solar = Batch('SolarArrays')
for s in (-1, 1):
    x = s * TRUSS_X
    half = 1.6
    # Four chords along Y.
    for dx, dz in ((-half, -half), (half, -half), (-half, half), (half, half)):
        truss.add(box_geo(0.5, 2 * TRUSS_Y, 0.5, place((x + dx, 0, SPINE_Z + dz))), 'Truss')
    if DETAIL:
        bays = int(TRUSS_Y * 2 / 4)
        for b in range(bays):
            y0 = -TRUSS_Y + b * 4.0; y1 = y0 + 4.0
            for dx, dz in ((-half, -half), (half, -half), (-half, half), (half, half)):
                if b < bays:
                    truss.add(box_geo(0.24, 0.24, 2 * half, place((x + dx, y0, SPINE_Z))), 'Truss') if dz < 0 else None
                    truss.add(box_geo(2 * half, 0.24, 0.24, place((x, y0, SPINE_Z + dz))), 'Truss') if dx < 0 else None
            flip = 1 if b % 2 else -1
            for side_x in (-half, half):
                truss.add(strut_geo((x + side_x, y0, SPINE_Z - half * flip), (x + side_x, y1, SPINE_Z + half * flip), 0.11), 'Truss')
            for side_z in (-half, half):
                truss.add(strut_geo((x - half, y0, SPINE_Z + side_z), (x + half, y1, SPINE_Z + side_z), 0.11), 'Truss')
    # Hub joining truss and spine.
    truss.add(box_geo(6.5, 6.5, 6.5, place((x, 0, SPINE_Z))), 'HullPanel')
    truss.add(cyl_geo(3.2, 3.2, 1.2, 24, place((x, 0, SPINE_Z + 3.6))), 'Gunmetal')
    # Solar wings on both ends of the truss, rotated about the truss axis like ISS arrays.
    for e in (-1, 1):
        tilt = rot(0, math.radians(22) * e, 0) if False else rot(0, 0, 0)
        R = rot(0, 0, 0)
        y0, y1 = 10.0, TRUSS_Y - 1.0
        length = y1 - y0
        yc = e * (y0 + y1) / 2
        M = place((x, yc, SPINE_Z)) @ rot(0, math.radians(18) * s, 0)  # tilt about Y-ish axis via X rot? keep clean tilt about the truss axis
        M = place((x, yc, SPINE_Z)) @ Matrix.Rotation(math.radians(20) * s, 4, 'Y')
        # Mast (gimbal) from truss to wing root.
        truss.add(cyl_geo(0.9, 0.9, 6.0, 12, place((x, e * (y0 - 3.0), SPINE_Z), rot(math.pi / 2, 0, 0))), 'Gunmetal')
        truss.add(cyl_geo(1.4, 1.4, 2.0, 16, place((x, e * (y0 - 5.5), SPINE_Z), rot(math.pi / 2, 0, 0))), 'HullPanel')
        # Backing frame and blanket cells.
        wing_w = 9.4
        solar.add(box_geo(wing_w + 0.4, length + 0.4, 0.18, M), 'SolarBack')
        solar.add(box_geo(0.5, length + 0.4, 0.5, M), 'Truss')
        if DETAIL:
            cells = 12
            cell_len = (length - 0.6) / cells
            for k in range(cells):
                cy = -length / 2 + 0.3 + cell_len * (k + 0.5)
                for cx in (-wing_w / 4 - 0.15, wing_w / 4 + 0.15):
                    solar.add(box_geo(wing_w / 2 - 0.7, cell_len - 0.25, 0.12, M @ Matrix.Translation((cx, cy, 0.12))), 'Solar')
        else:
            solar.add(box_geo(wing_w - 0.8, length - 0.4, 0.12, M @ Matrix.Translation((0, 0, 0.12))), 'Solar')
    # Radiators hang below the truss hub.
    for k, y in enumerate((-9.0, 0.0, 9.0)):
        truss.add(box_geo(0.28, 7.4, 13.0, place((x, y, SPINE_Z - 10.5))), 'Radiator')
        truss.add(box_geo(0.6, 7.8, 0.6, place((x, y, SPINE_Z - 4.0))), 'Gunmetal')
        truss.add(cyl_geo(0.5, 0.5, 4.0, 10, place((x, y, SPINE_Z - 3.0))), 'Gunmetal')
    # Navigation light at truss tips.
    for e in (-1, 1):
        truss.add(sphere_geo(0.5, 12, 6, place((x, e * (TRUSS_Y + 0.3), SPINE_Z))), 'NavLight_Red' if s < 0 else 'NavLight_Green')
truss.build(); solar.build()

# ============================================================================= HABITAT RING
ring_parts = []
if DETAIL:
    bpy.ops.mesh.primitive_torus_add(major_radius=RING_R, minor_radius=RING_TUBE, major_segments=96, minor_segments=32, location=(0, 0, 0))
else:
    bpy.ops.mesh.primitive_torus_add(major_radius=RING_R, minor_radius=RING_TUBE, major_segments=24, minor_segments=8, location=(0, 0, 0))
ring = bpy.context.object; ring.name = 'HabitatRing'
ring.matrix_world = Matrix.Translation((RING_X, 0, SPINE_Z)) @ rot(0, math.pi / 2, 0)
ring.data.materials.append(MATS['Hull'])
for p in ring.data.polygons: p.use_smooth = True
link(ring)
ringd = Batch('HabitatRingDetail')
hub = place((RING_X, 0, SPINE_Z), rot(0, math.pi / 2, 0))
ringd.add(cyl_geo(SPINE_R + 1.6, SPINE_R + 1.6, 6.0, 48 if DETAIL else 16, hub), 'HullPanel')
for k in range(6):
    a = TAU * k / 6
    y, z = math.sin(a), math.cos(a)
    ringd.add(strut_geo((RING_X, y * (SPINE_R + 1.2), SPINE_Z + z * (SPINE_R + 1.2)), (RING_X, y * (RING_R - 1.5), SPINE_Z + z * (RING_R - 1.5)), 1.1, 16 if DETAIL else 8), 'Hull')
    ringd.add(strut_geo((RING_X + 1.6, y * (SPINE_R + 1.2), SPINE_Z + z * (SPINE_R + 1.2)), (RING_X + 1.6, y * (RING_R - 1.5), SPINE_Z + z * (RING_R - 1.5)), 0.3, 8), 'Gunmetal')
    ringd.add(strut_geo((RING_X - 1.6, y * (SPINE_R + 1.2), SPINE_Z + z * (SPINE_R + 1.2)), (RING_X - 1.6, y * (RING_R - 1.5), SPINE_Z + z * (RING_R - 1.5)), 0.3, 8), 'Gunmetal')
if DETAIL:
    # Ring segment seams and windows on both faces.
    for k in range(24):
        a = TAU * (k + 0.5) / 24
        Rk = place((RING_X, 0, SPINE_Z)) @ rot(a, 0, 0)  # rotate about X: (y, z) plane
        ringd.add(torus_geo(RING_TUBE + 0.12, 0.28, 24, 8, Rk @ Matrix.Translation((0, 0, RING_R)) @ rot(0, math.pi / 2, 0)), 'HullPanel') if k % 2 == 0 else None
        for s in (-1, 1):
            ringd.add(box_geo(0.12, 1.3, 0.7, Rk @ Matrix.Translation((s * (RING_TUBE - 0.02), 0, RING_R))), 'Window')
            ringd.add(box_geo(0.12, 1.3, 0.7, Rk @ rot(TAU / 48 * 0.5, 0, 0) @ Matrix.Translation((s * (RING_TUBE - 0.02), 0, RING_R))), 'Window')
        ringd.add(box_geo(0.7, 1.0, 0.16, Rk @ Matrix.Translation((0, 0, RING_R + RING_TUBE - 0.02))), 'MintPaint') if k % 3 == 0 else None
ringd.add(sphere_geo(0.5, 12, 6, place((RING_X, 0, SPINE_Z + RING_R + RING_TUBE + 0.3))), 'Beacon_White')
ringd.build()

# ============================================================================= END MODULES
ends = Batch('EndModules')
# +X: docking node with an androgynous ring and a tapered nose.
dock = place((SPINE_X, 0, SPINE_Z), rot(0, math.pi / 2, 0))
ends.add(lathe_geo([(0, -0.5), (SPINE_R + 0.9, -0.5), (SPINE_R + 0.9, 3.0), (SPINE_R - 0.4, 4.5), (SPINE_R - 0.4, 7.0), (2.6, 9.0), (2.6, 10.5), (0, 10.5)], 48 if DETAIL else 16, dock), 'HullPanel')
ends.add(torus_geo(2.9, 0.45, 32 if DETAIL else 12, 8 if DETAIL else 4, dock @ Matrix.Translation((0, 0, 10.6))), 'Gunmetal')
ends.add(cyl_geo(2.2, 2.2, 0.3, 24, dock @ Matrix.Translation((0, 0, 10.6))), 'Rubber')
for k in range(3 if DETAIL else 0):
    a = TAU * k / 3
    ends.add(box_geo(0.6, 1.2, 1.6, dock @ rot(0, 0, a) @ Matrix.Translation((3.6, 0, 10.2))), 'Gunmetal')
for k in range(8):
    a = TAU * k / 8
    ends.add(sphere_geo(0.22, 8, 4, dock @ rot(0, 0, a) @ Matrix.Translation((3.4, 0, 11.0))), 'Amber' if k % 2 else 'Mint')
ends.add(sphere_geo(0.55, 12, 6, place((SPINE_X + 11.2, 0, SPINE_Z))), 'NavLight_Green')
# -X: comms module with two dishes and a red nav light.
comm = place((-SPINE_X, 0, SPINE_Z), rot(0, -math.pi / 2, 0))
ends.add(lathe_geo([(0, -0.5), (SPINE_R + 0.6, -0.5), (SPINE_R + 0.6, 2.5), (3.4, 4.0), (3.4, 5.5), (1.2, 6.5), (1.2, 9.0), (0, 9.0)], 48 if DETAIL else 16, comm), 'HullPanel')
ends.add(sphere_geo(0.55, 12, 6, place((-SPINE_X - 9.6, 0, SPINE_Z))), 'NavLight_Red')
def dish(M, radius=3.6):
    bowl = [(0, 0)] + [(radius * t, 0.75 * radius * t * t) for t in (0.25, 0.5, 0.75, 1.0)]
    ends.add(lathe_geo(bowl, 32 if DETAIL else 12, M), 'Radiator')
    ends.add(lathe_geo([(radius * 1.0, 0.75 * radius), (radius * 1.0 - 0.05, 0.75 * radius - 0.35)], 32 if DETAIL else 12, M), 'Gunmetal')
    ends.add(cyl_geo(0.12, 0.12, radius * 0.75, 6, M @ Matrix.Translation((0, 0, radius * 0.375))), 'Gunmetal')
    ends.add(sphere_geo(0.35, 10, 5, M @ Matrix.Translation((0, 0, radius * 0.78))), 'Gunmetal')
dish(place((-SPINE_X - 5.5, 0, SPINE_Z + 7.5), rot(math.radians(-35), math.radians(-30), 0)))
dish(place((-SPINE_X - 5.5, 0, SPINE_Z - 7.5), rot(math.radians(35), math.radians(-30), math.pi)), 2.8)
ends.add(cyl_geo(0.5, 0.5, 7.0, 10, place((-SPINE_X - 5.5, 0, SPINE_Z + 4.0))), 'Gunmetal')
ends.add(cyl_geo(0.5, 0.5, 7.0, 10, place((-SPINE_X - 5.5, 0, SPINE_Z - 4.0))), 'Gunmetal')
# Beacon on the spine top and an antenna mast.
ends.add(cyl_geo(0.12, 0.12, 9.0, 6, place((30, 0, SPINE_Z + SPINE_R + 4.5))), 'Gunmetal')
ends.add(sphere_geo(0.45, 12, 6, place((30, 0, SPINE_Z + SPINE_R + 9.2))), 'Beacon_White')
if DETAIL:
    for x in (-24, 44):
        ends.add(cyl_geo(1.8, 1.8, 0.6, 24, place((x, 0, SPINE_Z + SPINE_R + 0.2))), 'Gunmetal')
        ends.add(cyl_geo(1.0, 1.0, 1.4, 16, place((x, 0, SPINE_Z + SPINE_R + 1.1))), 'HullPanel')
        ends.add(cyl_geo(0.1, 0.1, 5.0, 6, place((x, 0, SPINE_Z + SPINE_R + 4.0))), 'Gunmetal')
        ends.add(sphere_geo(0.3, 10, 5, place((x, 0, SPINE_Z + SPINE_R + 6.6))), 'NavLight_Red' if x < 0 else 'NavLight_Green')
ends.build()

# ============================================================================= LAB MODULES, CUPOLA, EXTERIOR WINDOWS
labs = Batch('LabModules')
LAB_X, LAB_Z, LAB_R, LAB_LEN = 39.0, SPINE_Z - 8.6, 2.8, 22.0
segs = 48 if DETAIL else 16
# Node cylinder across Y under the spine, a riser up to the spine, two labs alongside.
labs.add(cyl_geo(2.3, 2.3, 18.0, segs, place((LAB_X, 0, LAB_Z), rot(math.pi / 2, 0, 0))), 'HullPanel')
labs.add(cyl_geo(2.0, 2.0, SPINE_Z - LAB_Z, segs, place((LAB_X, 0, (SPINE_Z + LAB_Z) / 2))), 'HullPanel')
for e in (-1, 1):
    M = place((LAB_X, e * 8.0, LAB_Z), rot(0, math.pi / 2, 0))
    labs.add(lathe_geo([(0, -LAB_LEN / 2 - 1.2), (LAB_R - 1.0, -LAB_LEN / 2 - 1.2), (LAB_R, -LAB_LEN / 2), (LAB_R, LAB_LEN / 2), (LAB_R - 1.0, LAB_LEN / 2 + 1.2), (0, LAB_LEN / 2 + 1.2)], segs, M), 'Hull')
    if DETAIL:
        for k in range(-2, 3):
            labs.add(cyl_geo(LAB_R + 0.25, LAB_R + 0.25, 0.6, segs, M @ Matrix.Translation((0, 0, k * 5.0))), 'HullPanel')
        for k in range(-4, 5):
            for a in (0.0, math.pi):
                labs.add(box_geo(0.8, 0.14, 0.5, M @ Matrix.Translation((0, 0, k * 2.2 + 1.1)) @ rot(0, 0, a) @ Matrix.Translation((0, e * (LAB_R - 0.02), 0))), 'Window')
        labs.add(box_geo(LAB_LEN - 3, 0.3, 0.16, place((LAB_X, e * (8.0 + LAB_R - 0.1), LAB_Z + 0.9))), 'MintPaint')
        labs.add(box_geo(LAB_LEN - 3, 0.3, 0.16, place((LAB_X, e * (8.0 + LAB_R - 0.1), LAB_Z - 0.9))), 'MintPaint')
        # Grapple fixtures and handrails.
        for k in range(-3, 4):
            labs.add(box_geo(1.2, 0.08, 0.08, place((LAB_X + k * 3.0, e * 8.0, LAB_Z + LAB_R + 0.25))), 'Gunmetal')
            labs.add(cyl_geo(0.05, 0.05, 0.3, 6, place((LAB_X + k * 3.0 - 0.5, e * 8.0, LAB_Z + LAB_R + 0.1))), 'Gunmetal')
            labs.add(cyl_geo(0.05, 0.05, 0.3, 6, place((LAB_X + k * 3.0 + 0.5, e * 8.0, LAB_Z + LAB_R + 0.1))), 'Gunmetal')
# Cupola on the spine with a ring of windows.
CUP_X = 50.0
labs.add(cyl_geo(2.0, 2.0, 1.0, segs, place((CUP_X, 0, SPINE_Z + SPINE_R + 0.4))), 'HullPanel')
labs.add(sphere_geo(1.9, segs, 12, place((CUP_X, 0, SPINE_Z + SPINE_R + 0.9))), 'Hull')
if DETAIL:
    for k in range(8):
        a = TAU * k / 8
        labs.add(box_geo(0.9, 0.8, 0.12, place((CUP_X, 0, SPINE_Z + SPINE_R + 0.9)) @ rot(0, 0, a) @ rot(0, math.radians(-38), 0) @ Matrix.Translation((0, 0, 1.85))), 'Window')
    labs.add(cyl_geo(0.9, 0.9, 0.12, 24, place((CUP_X, 0, SPINE_Z + SPINE_R + 2.75))), 'Window')
# Pipe runs under the spine to the hangar roof, and rows of crew windows on the hangar block.
if DETAIL:
    for dy in (-1.4, 0.0, 1.4):
        labs.add(cyl_geo(0.22, 0.22, 2 * SPINE_X - 30, 10, place((0, dy, SPINE_Z - SPINE_R - 0.35), rot(0, math.pi / 2, 0))), 'Gunmetal')
    for s in (-1, 1):
        for y in range(int(OY0) + 3, int(HY1) - 3, 3):
            if (y - int(OY0)) % 6 == 3: continue  # skip where the seam grooves run
            labs.add(box_geo(0.14, 1.1, 0.7, place((s * (OX + 0.0), y, 5.6))), 'Window')
    for x in range(-18, 19, 4):
        labs.add(box_geo(1.1, 0.14, 0.7, place((x, OY0 - 0.0, 5.6))), 'Window')
        labs.add(box_geo(1.1, 0.14, 0.7, place((x, OY0 - 0.0, 1.6))), 'Window')
    # Aft thruster block on the back wall.
    for x in (-14, 0, 14):
        labs.add(box_geo(6.0, 1.6, 4.0, place((x, OY0 - 0.8, -6.0))), 'Gunmetal')
        for dx in (-1.8, 1.8):
            labs.add(cyl_geo(0.9, 1.3, 1.4, 20, place((x + dx, OY0 - 2.2, -6.0), rot(math.pi / 2, 0, 0))), 'Truss')
            labs.add(cyl_geo(0.7, 0.7, 0.1, 20, place((x + dx, OY0 - 2.9, -6.0), rot(math.pi / 2, 0, 0))), 'Thruster')
labs.build()

# ============================================================================= LANDING DECK + MARKINGS
deck = Batch('LandingDeck')
deck.add(box_geo(2 * HX, HY1 - HY0, DECK_THICKNESS, place((0, (HY0 + HY1) / 2, DECK_TOP - DECK_THICKNESS / 2))), 'Deck')
DECK = deck.build()
marks = Batch('DeckMarkings')
zm = DECK_TOP + 0.015
marks.add(annulus_geo(8.6, 9.2, 64 if DETAIL else 24, 0.03, place((PAD.x, PAD.y, zm))), 'Mint')
marks.add(annulus_geo(3.0, 3.35, 32 if DETAIL else 16, 0.03, place((PAD.x, PAD.y, zm))), 'Mint')
# "H" cross: two bars along the approach axis and one across.
for x in (-3.4, 3.4):
    marks.add(box_geo(0.6, 7.0, 0.03, place((PAD.x + x, PAD.y, zm))), 'Mint')
marks.add(box_geo(6.2, 0.6, 0.03, place((PAD.x, PAD.y, zm))), 'Mint')
# Chevrons on the centreline pointing out of the hangar toward the doors.
for k in range(3):
    y = PAD.y + 12 + k * 3.2
    for s in (-1, 1):
        marks.add(prism_geo([(0, 0), (s * 3.0, -2.0), (s * 3.0, -2.7), (0, -0.7)], 0.03, place((PAD.x, y, zm))), 'Amber')
# Edge strips and bay numbering.
for s in (-1, 1):
    marks.add(box_geo(0.5, HY1 - HY0 - 2, 0.03, place((s * (HX - 0.6), (HY0 + HY1) / 2, zm))), 'Mint')
    if DETAIL:
        for y in range(int(HY0) + 3, int(HY1) - 2, 4):
            marks.add(box_geo(1.6, 0.45, 0.03, place((s * (HX - 1.8), y, zm))), 'Amber' if (y // 4) % 2 else 'Mint')
marks.add(box_geo(2 * HX - 2, 0.6, 0.03, place((0, HY1 - 1.0, zm))), 'Amber')
if DETAIL:
    text_mesh('DeckNumber', '01', 4.0, (PAD.x, PAD.y - 12.5, zm + 0.01), rot(0, 0, math.pi), 'Mint', extrude=0.01)
marks.build()

# ============================================================================= HANGAR INTERIOR
interior = Batch('HangarInterior')
lights = Batch('HangarLights')
# Ceiling light bars, recessed in dark housings.
for x in (-14.0, -7.0, 0.0, 7.0, 14.0):
    interior.add(box_geo(1.6, HY1 - HY0 - 6, 0.5, place((x, (HY0 + HY1) / 2 - 1, HZ1 - 0.2))), 'Gunmetal')
    lights.add(box_geo(1.0, HY1 - HY0 - 7, 0.16, place((x, (HY0 + HY1) / 2 - 1, HZ1 - 0.42))), 'HangarLight')
# Ceiling structural beams across X.
for y in range(int(HY0) + 4, int(HY1) - 1, 6):
    interior.add(box_geo(2 * HX, 0.7, 0.7, place((0, y, HZ1 - 0.35))), 'Truss')
# Side walls: ribs, catwalks, railings, amber strips, cabinets.
for s in (-1, 1):
    xw = s * HX
    for y in range(int(HY0) + 3, int(HY1), 6):
        interior.add(box_geo(0.6, 0.6, HZ1 - HZ0, place((xw - s * 0.3, y, (HZ0 + HZ1) / 2))), 'Truss')
    # Catwalk at 5 m above the deck.
    zc = HZ0 + 5.0
    interior.add(box_geo(1.8, HY1 - HY0 - 3, 0.18, place((xw - s * 0.9, (HY0 + HY1) / 2 - 1.5, zc))), 'Gunmetal')
    interior.add(box_geo(0.08, HY1 - HY0 - 3, 0.08, place((xw - s * 1.8, (HY0 + HY1) / 2 - 1.5, zc + 1.1))), 'Gunmetal')
    if DETAIL:
        for y in range(int(HY0) + 2, int(HY1) - 2, 3):
            interior.add(cyl_geo(0.04, 0.04, 1.1, 6, place((xw - s * 1.8, y, zc + 0.55))), 'Gunmetal')
        interior.add(box_geo(0.05, HY1 - HY0 - 3, 0.05, place((xw - s * 1.8, (HY0 + HY1) / 2 - 1.5, zc + 0.55))), 'Gunmetal')
    lights.add(box_geo(0.12, HY1 - HY0 - 3, 0.12, place((xw - s * 1.0, (HY0 + HY1) / 2 - 1.5, zc - 0.2))), 'AmberSoft')
    lights.add(box_geo(0.12, HY1 - HY0 - 2, 0.12, place((xw - s * 0.1, (HY0 + HY1) / 2 - 1, HZ0 + 0.5))), 'AmberSoft')
    # Wall light panels (white) between ribs.
    for y in range(int(HY0) + 6, int(HY1) - 3, 12):
        lights.add(box_geo(0.1, 2.4, 0.5, place((xw - s * 0.08, y, HZ0 + 9.5))), 'HangarLight')
    # Fuel/service cabinets with hoses running to the deck.
    for y in (-14.0, -2.0, 10.0):
        interior.add(box_geo(1.4, 3.0, 2.6, place((xw - s * 0.7, y, HZ0 + 1.3))), 'HullPanel')
        lights.add(box_geo(0.1, 0.5, 0.2, place((xw - s * 1.42, y + 0.9, HZ0 + 2.2))), 'Amber')
        interior.add(cyl_geo(0.35, 0.35, 0.9, 12, place((xw - s * 1.3, y - 0.6, HZ0 + 1.6), rot(0, math.pi / 2, 0))), 'Gunmetal')
        if DETAIL:
            pts = [(xw - s * 1.5, y - 0.6, HZ0 + 1.6), (xw - s * 4.0, y - 1.2, HZ0 + 0.5), (xw - s * 9.0, y - 2.5, HZ0 + 0.25), (xw - s * 13.0, y - 3.0, HZ0 + 0.22)]
            for a, b in zip(pts, pts[1:]):
                interior.add(strut_geo(a, b, 0.14, 8), 'Rubber')
            interior.add(cyl_geo(0.22, 0.16, 0.6, 8, place(pts[-1], rot(0, s * math.pi / 2 * 0.9, 0))), 'Gunmetal')
    # Tool racks and crates along the walls.
    if DETAIL:
        for k, y in enumerate((-20.0, -8.0, 4.0, 16.0)):
            interior.add(box_geo(2.2, 2.2, 1.6, place((xw - s * 1.9, y, HZ0 + 0.8))), 'Gunmetal' if k % 2 else 'HullPanel')
            interior.add(box_geo(1.6, 1.6, 0.9, place((xw - s * 2.1, y + 0.2, HZ0 + 2.05))), 'HullPanel' if k % 2 else 'Gunmetal')
# Back wall: control room window strip with a lit interior, airlock and status lights.
yb = HY0
interior.add(box_geo(26.0, 1.4, 4.4, place((0, yb + 0.7, HZ0 + 10.0))), 'Gunmetal')
lights.add(box_geo(24.0, 0.3, 3.0, place((0, yb + 1.45, HZ0 + 10.0))), 'ControlGlass')
if DETAIL:
    for x in (-8.0, 0.0, 8.0):
        interior.add(box_geo(0.4, 0.5, 3.2, place((x, yb + 1.5, HZ0 + 10.0))), 'Gunmetal')
        interior.add(box_geo(2.4, 0.4, 1.0, place((x, yb + 1.8, HZ0 + 9.0))), 'Truss')
interior.add(box_geo(4.0, 0.6, 4.6, place((0, yb + 0.3, HZ0 + 2.3))), 'Gunmetal')
lights.add(box_geo(4.4, 0.1, 0.2, place((0, yb + 0.62, HZ0 + 4.7))), 'Amber')
for s in (-1, 1):
    lights.add(box_geo(0.2, 0.1, 4.6, place((s * 2.2, yb + 0.62, HZ0 + 2.3))), 'Amber')
    interior.add(box_geo(6.0, 1.2, 3.0, place((s * 12.0, yb + 0.6, HZ0 + 1.5))), 'HullPanel')
    lights.add(box_geo(5.0, 0.1, 0.4, place((s * 12.0, yb + 1.22, HZ0 + 2.6))), 'Mint')
if DETAIL:
    for x in range(-18, 19, 3):
        lights.add(sphere_geo(0.16, 8, 4, place((x, yb + 0.25, HZ0 + 13.0))), 'Mint' if (x // 3) % 2 == 0 else 'Amber')
# Gantry crane: rails along Y and a bridge across X with a hoist.
for x in (-11.0, 11.0):
    interior.add(box_geo(0.5, HY1 - HY0 - 4, 0.6, place((x, (HY0 + HY1) / 2 - 1, HZ1 - 1.0))), 'Truss')
interior.add(box_geo(24.0, 1.2, 0.9, place((0, PAD.y - 16.0, HZ1 - 1.6))), 'Gunmetal')
interior.add(box_geo(1.6, 1.6, 1.4, place((5.0, PAD.y - 16.0, HZ1 - 2.6))), 'Truss')
interior.add(cyl_geo(0.05, 0.05, 4.0, 6, place((5.0, PAD.y - 16.0, HZ1 - 5.3))), 'Rubber')
interior.add(box_geo(0.8, 0.3, 0.4, place((5.0, PAD.y - 16.0, HZ1 - 7.5))), 'Amber')
lights.add(box_geo(24.0, 0.1, 0.12, place((0, PAD.y - 16.0 + 0.62, HZ1 - 1.6))), 'AmberSoft')
# Door-jamb warning lights inside the opening.
for s in (-1, 1):
    lights.add(box_geo(0.2, 0.2, HZ1 - HZ0 - 1, place((s * (HX - 0.15), HY1 - 0.6, (HZ0 + HZ1) / 2))), 'Amber')
interior.build(); lights.build()

# ============================================================================= HANGAR DOORS
def build_door(side):
    name = 'HangarDoor_L' if side < 0 else 'HangarDoor_R'
    xc = side * DOOR_W / 2
    parts = [hero_box(f'{name}_slab', (DOOR_W, DOOR_T * 0.6, DOOR_H), (xc, DOOR_Y - DOOR_T * 0.2, DOOR_Z), 'HullPanel', 0.25)]
    if DETAIL:
        # Raised panel plates leave recessed grooves between them.
        cols, rows = 3, 4
        pw = (DOOR_W - 1.6 - 0.45 * (cols + 1)) / cols
        ph = (DOOR_H - 0.45 * (rows + 1)) / rows
        for c in range(cols):
            for r in range(rows):
                px = xc - side * DOOR_W / 2 + side * (1.6 + 0.45 * (c + 1) + pw * (c + 0.5))
                pz = DOOR_Z - DOOR_H / 2 + 0.45 * (r + 1) + ph * (r + 0.5)
                parts.append(hero_box(f'{name}_plate{c}{r}', (pw, DOOR_T * 0.4, ph), (px, DOOR_Y + DOOR_T * 0.1, pz), 'Hull', 0.18))
        # Horizontal rib beams on the inner (hangar) face.
        for r in range(rows + 1):
            pz = DOOR_Z - DOOR_H / 2 + 0.45 * r + ph * r + 0.2
            parts.append(hero_box(f'{name}_rib{r}', (DOOR_W - 0.4, 0.35, 0.45), (xc, DOOR_Y - DOOR_T * 0.5 - 0.15, pz), 'Gunmetal', 0.08, 1))
    det = Batch(f'{name}_detail')
    # Chevron warning band along the meeting edge (alternating mint/amber, emissive).
    band_x0 = xc - side * DOOR_W / 2 + side * 0.15
    stripes = 9 if DETAIL else 3
    sh = DOOR_H / stripes
    for k in range(stripes):
        z0 = DOOR_Z - DOOR_H / 2 + sh * k
        poly = [(0, 0), (side * 1.3, sh * 0.5), (side * 1.3, sh * 0.5 + sh * 0.45), (0, sh * 0.45)]
        poly = [(band_x0 + px, z0 + pz) for px, pz in poly]
        det.add(prism_geo(poly, 0.06, place((0, DOOR_Y + DOOR_T * 0.3 + 0.03, 0), rot(math.pi / 2, 0, 0))), 'Mint' if k % 2 == 0 else 'Amber')
    # Edge strip on the meeting face and a lit top edge.
    det.add(box_geo(0.2, DOOR_T * 0.5, DOOR_H - 0.4, place((xc - side * DOOR_W / 2 + side * 0.1, DOOR_Y, DOOR_Z))), 'Amber')
    det.add(box_geo(DOOR_W - 2.0, 0.2, 0.2, place((xc, DOOR_Y + DOOR_T * 0.3 + 0.1, DOOR_Z + DOOR_H / 2 - 0.5))), 'Mint')
    if DETAIL:
        # Hydraulic latch housings and rollers.
        for pz in (DOOR_Z - DOOR_H / 2 + 1.5, DOOR_Z, DOOR_Z + DOOR_H / 2 - 1.5):
            det.add(box_geo(1.6, DOOR_T * 0.5, 1.0, place((xc + side * (DOOR_W / 2 - 1.2), DOOR_Y, pz))), 'Gunmetal')
        for k in range(4):
            px = xc - side * DOOR_W / 2 + side * (2.5 + k * (DOOR_W - 5) / 3)
            det.add(cyl_geo(0.45, 0.45, 0.5, 12, place((px, DOOR_Y, DOOR_Z + DOOR_H / 2 + 0.2), rot(0, math.pi / 2, 0))), 'Gunmetal')
            det.add(cyl_geo(0.45, 0.45, 0.5, 12, place((px, DOOR_Y, DOOR_Z - DOOR_H / 2 - 0.2), rot(0, math.pi / 2, 0))), 'Gunmetal')
        # Big painted numeral + brand text.
        parts.append(text_mesh(f'{name}_text', '1' if side < 0 else '0', 8.0, (xc + side * 4.0, DOOR_Y + DOOR_T * 0.3 + 0.02, DOOR_Z - 0.6), rot(math.pi / 2, 0, math.pi), 'MintPaint', 0.03))
    parts.append(det.build())
    door = join(parts, name)
    set_origin(door, (xc, DOOR_Y, DOOR_Z))
    return door

door_l = build_door(-1)
door_r = build_door(+1)

# Door animation: closed at frame 1, fully open at frame 121 (5 s at 24 fps), Bezier ease-in-out.
for door, dx in ((door_l, -DOOR_SLIDE), (door_r, DOOR_SLIDE)):
    scene.frame_set(1)
    door.keyframe_insert(data_path='location', frame=1)
    door.location.x += dx
    door.keyframe_insert(data_path='location', frame=121)
    door.location.x -= dx
    if door.animation_data and door.animation_data.action:
        action = door.animation_data.action
        for fc in action.fcurves if hasattr(action, 'fcurves') else []:
            for kp in fc.keyframe_points:
                kp.interpolation = 'BEZIER'; kp.easing = 'EASE_IN_OUT'
scene.frame_set(1)

# ============================================================================= EMPTIES
# glTF +Z local = Blender -Y local, so a 180° turn about Z points glTF +Z toward the opening (+Y here).
FACE_OPENING = rot(0, 0, math.pi)
empty('LandingPad', (PAD.x, PAD.y, DECK_TOP), FACE_OPENING)
empty('ApproachPoint', (PAD.x, HY1 + 90.0, DECK_TOP + HOVER), FACE_OPENING)
empty('DoorTrigger', (PAD.x, HY1 + 250.0, DECK_TOP + HOVER), FACE_OPENING)

# ============================================================================= EXPORT
bpy.ops.object.select_all(action='DESELECT')
os.makedirs(os.path.dirname(OUT), exist_ok=True)
export_kwargs = dict(
    filepath=OUT, export_format='GLB', export_apply=True, export_yup=True,
    export_animations=True, export_animation_mode='ACTIVE_ACTIONS', export_nla_strips_merged_animation_name='DoorsOpen',
    export_force_sampling=True, export_frame_range=True, export_optimize_animation_size=False,
    export_lights=False, export_cameras=False, export_extras=False, export_skins=False, export_morph=False,
    export_texcoords=False, export_normals=True, export_materials='EXPORT', export_image_format='NONE',
    use_selection=False, export_gn_mesh=True)
bpy.ops.export_scene.gltf(**export_kwargs)

def normalize_animations(path):
    """Guarantee exactly one animation named DoorsOpen (merge if the exporter split them)."""
    with open(path, 'rb') as f: data = f.read()
    magic, version, length = struct.unpack_from('<III', data, 0)
    assert magic == 0x46546C67, 'not a GLB'
    json_len, json_type = struct.unpack_from('<II', data, 12)
    gltf = json.loads(data[20:20 + json_len])
    bin_chunk = data[20 + json_len:]
    anims = gltf.get('animations', [])
    if len(anims) == 0:
        print('WARNING: no animations exported'); return gltf
    merged = {'name': 'DoorsOpen', 'channels': [], 'samplers': []}
    for anim in anims:
        offset = len(merged['samplers'])
        merged['samplers'].extend(anim['samplers'])
        for ch in anim['channels']:
            ch = dict(ch); ch['sampler'] += offset; merged['channels'].append(ch)
    gltf['animations'] = [merged]
    gltf.setdefault('asset', {})['generator'] = 'Star Agent build_station.py (Blender %s)' % bpy.app.version_string
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    body = struct.pack('<II', len(js), 0x4E4F534A) + js + bin_chunk
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', magic, version, 12 + len(body)) + body)
    return gltf

gltf = normalize_animations(OUT)
tris = 0
for mesh in gltf.get('meshes', []):
    for prim in mesh['primitives']:
        acc = gltf['accessors'][prim['indices']] if 'indices' in prim else gltf['accessors'][prim['attributes']['POSITION']]
        tris += acc['count'] // 3
print(f'EXPORTED {OUT}: {os.path.getsize(OUT) / 1e6:.2f} MB, {tris} triangles, {len(gltf["nodes"])} nodes, {len(gltf.get("animations", []))} animation(s), {time.time() - T0:.1f}s')

# ============================================================================= PREVIEW RENDERS
if PREVIEW_DIR:
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = 1600, 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.eevee.taa_render_samples = 32
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = 0.3
    world = bpy.data.worlds.new('Space'); scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.004, 0.006, 0.012, 1.0); bg.inputs['Strength'].default_value = 1.0
    sun_data = bpy.data.lights.new('Sun', 'SUN'); sun_data.energy = 5.0; sun_data.angle = math.radians(0.6)
    sun_data.color = (1.0, 0.94, 0.86)
    sun = bpy.data.objects.new('Sun', sun_data); scene.collection.objects.link(sun)
    sun.rotation_euler = (Vector((0, 0, 0)) - Vector((90, 150, 120))).to_track_quat('-Z', 'Y').to_euler()
    # Faint blue planet-shine from below.
    fill_data = bpy.data.lights.new('Planetshine', 'SUN'); fill_data.energy = 0.6; fill_data.color = (0.55, 0.7, 1.0)
    fill = bpy.data.objects.new('Planetshine', fill_data); scene.collection.objects.link(fill)
    fill.rotation_euler = Euler((math.radians(160), 0, 0), 'XYZ')
    cam_data = bpy.data.cameras.new('Camera'); cam_data.lens = 35; cam_data.clip_end = 5000
    cam = bpy.data.objects.new('Camera', cam_data); scene.collection.objects.link(cam); scene.camera = cam
    def aim(cam, loc, target):
        cam.location = Vector(loc)
        direction = Vector(target) - cam.location
        cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    def render(path):
        scene.render.filepath = path
        try:
            bpy.ops.render.render(write_still=True)
            print('RENDERED', path)
        except Exception as e:
            print('EEVEE failed, falling back to WORKBENCH:', e)
            scene.render.engine = 'BLENDER_WORKBENCH'
            scene.display.shading.light = 'STUDIO'; scene.display.shading.color_type = 'MATERIAL'
            scene.display.shading.show_cavity = True; scene.display.shading.show_shadow = True
            bpy.ops.render.render(write_still=True)
            print('RENDERED (workbench)', path)
    # Exterior three-quarter view with the doors half open.
    scene.frame_set(75)
    aim(cam, (150, 190, 70), (-4, -6, 6))
    render(os.path.join(PREVIEW_DIR, 'preview_station.png'))
    # Looking into the open hangar from the approach axis.
    scene.frame_set(121)
    hangar_light = bpy.data.lights.new('HangarFill', 'AREA'); hangar_light.energy = 14000; hangar_light.size = 30; hangar_light.color = (1.0, 0.96, 0.9)
    hl = bpy.data.objects.new('HangarFill', hangar_light); scene.collection.objects.link(hl)
    hl.location = (0, -2, HZ1 - 0.6)
    cam_data.lens = 28
    aim(cam, (14, HY1 + 62, DECK_TOP + 9), (0, PAD.y + 4, DECK_TOP + 2))
    render(os.path.join(PREVIEW_DIR, 'preview_hangar.png'))
    scene.frame_set(1)
print(f'DONE in {time.time() - T0:.1f}s')
