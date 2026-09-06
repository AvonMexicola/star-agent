"""Star Agent — the five equippable gear props, built procedurally with bpy (hard-surface,
no textures, materials only). Replaces the Meshy versions that src/equipment.js attaches.

    blender -b --python blender/build_gear.py -- --out public/models/props
    blender -b --python blender/build_gear.py -- --out public/models/props --only rifle-laser
    blender -b --python blender/build_gear.py -- --out public/models/props --preview /tmp/gear

Blender frame while building: X = barrel axis (muzzle at -X), Z = up, Y = sideways. The glTF
exporter turns that into the runtime frame (Y up): glTF (x, y, z) = Blender (x, z, -y), so the
barrel still points -X and up is +Y, matching `barrelAxis: [-1, 0, 0]` in src/equipment.js.
The backpack extends toward Blender -Y (glTF +Z, the Meshy convention: the pack's outer face
looks along +Z and the plate along -Z); the helmet visor faces Blender -Y (glTF +Z).

Origins (equipment-sockets.json offsets are measured from these):
  rifle-laser / sidearm-pistol / mining-laser-tool   palm point of the (rear) pistol grip
  backpack-life-support                              centre of the flat back-plate contact face
  helmet-standalone                                  centre of the neck-ring base

All dimensions are metres. Each item exports as one mesh object per material (4–6 draw calls).
"""
import bpy, bmesh, math, sys, json, os, time
from mathutils import Vector, Matrix, Euler

T0 = time.time()
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv and argv.index(name) + 1 < len(argv) else default
OUT_DIR = os.path.abspath(arg('--out', 'public/models/props'))
ONLY = arg('--only')
PREVIEW_DIR = arg('--preview')
TAU = math.pi * 2
D = math.radians

MINT = (0.714, 0.937, 0.820)          # #b6efd1
MINT_GLOW = (0.45, 0.92, 0.70)        # emission colour: saturated so tone mapping keeps it mint
AMBER = (1.0, 0.55, 0.12)

# ----------------------------------------------------------------------------- scene / materials
MATS = {}
OBJECTS = []
CUTTERS = []
COLL = None

def reset_scene():
    global COLL
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.objects):
        for item in list(block):
            block.remove(item)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    COLL = bpy.data.collections.new('Gear')
    scene.collection.children.link(COLL)
    MATS.clear(); OBJECTS.clear(); CUTTERS.clear()
    return scene

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
    shown = emission if (emission is not None and strength > 0) else color
    mat.diffuse_color = (*[min(1.0, c) for c in shown], 1.0)
    mat.metallic, mat.roughness = metallic, roughness
    MATS[name] = mat
    return mat

def faction_materials():
    """One faction language: white armour, dark polymer, brushed metal, mint light."""
    material('Polymer', (0.16, 0.165, 0.175), 0.0, 0.62)
    material('Metal', (0.56, 0.57, 0.59), 0.65, 0.35)
    material('White', (0.80, 0.81, 0.80), 0.05, 0.42)
    material('Mint', MINT, 0.0, 0.4, MINT_GLOW, 1.6)
    material('MintDim', (0.55, 0.78, 0.66), 0.0, 0.4, MINT_GLOW, 0.5)
    material('Amber', AMBER, 0.0, 0.4, AMBER, 2.0)
    material('Glass', (0.02, 0.03, 0.05), 0.0, 0.08)
    material('Rubber', (0.05, 0.05, 0.055), 0.0, 0.9)

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

def span_box(x0, x1, y0, y1, z0, z1, R=None):
    """Axis-aligned box between two corners (optionally rotated about its centre)."""
    c = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    return box_geo(abs(x1 - x0), abs(y1 - y0), abs(z1 - z0), place(c, R))

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

def lathe_geo(profile, segs, M, smooth=True, a0=0.0, a1=TAU):
    """Revolve a (radius, z) polyline about local Z. Zero radii become poles."""
    verts, faces, sm = [], [], []
    rings = []
    closed = abs(a1 - a0 - TAU) < 1e-6
    count = segs if closed else segs + 1
    for r, z in profile:
        if r <= 1e-6:
            rings.append([len(verts)]); verts.append(M @ Vector((0, 0, z)))
        else:
            start = len(verts)
            for i in range(count):
                a = a0 + (a1 - a0) * i / segs
                verts.append(M @ Vector((r * math.cos(a), r * math.sin(a), z)))
            rings.append(list(range(start, start + count)))
    for a, b in zip(rings, rings[1:]):
        for i in range(segs):
            j = (i + 1) % count
            if len(a) == 1: faces.append((a[0], b[j], b[i]))
            elif len(b) == 1: faces.append((a[i], a[j], b[0]))
            else: faces.append((a[i], a[j], b[j], b[i]))
            sm.append(smooth)
    return verts, faces, sm

def sphere_geo(r, segs, rings, M):
    profile = [(r * math.sin(math.pi * k / rings), -r * math.cos(math.pi * k / rings)) for k in range(rings + 1)]
    return lathe_geo(profile, segs, M)

def cap_geo(r, theta, segs, rings, M):
    """Spherical cap around local +Z, opening half-angle `theta` (open rim)."""
    profile = [(r * math.sin(theta * k / rings), r * math.cos(theta * k / rings)) for k in range(rings + 1)]
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
        faces.append((a + 1, a + 3, b + 3, b + 1))
        faces.append((a + 0, b + 0, b + 2, a + 2))
        faces.append((a + 2, b + 2, b + 3, a + 3))
        faces.append((a + 0, a + 1, b + 1, b + 0))
    if not closed:
        faces.append((0, 2, 3, 1))
        e = segs * 4
        faces.append((e + 1, e + 3, e + 2, e + 0))
    return verts, faces, [False] * len(faces)

def tube_geo(points, radius, segs=8, caps=True):
    """Round tube swept along a polyline (parallel-transport frames)."""
    pts = [Vector(p) for p in points]
    tangents = []
    for i in range(len(pts)):
        if i == 0: t = pts[1] - pts[0]
        elif i == len(pts) - 1: t = pts[-1] - pts[-2]
        else: t = (pts[i + 1] - pts[i]).normalized() + (pts[i] - pts[i - 1]).normalized()
        tangents.append(t.normalized())
    up = Vector((0, 0, 1)) if abs(tangents[0].z) < 0.9 else Vector((1, 0, 0))
    n = (up - tangents[0] * up.dot(tangents[0])).normalized()
    verts, faces, sm = [], [], []
    for i, (p, t) in enumerate(zip(pts, tangents)):
        n = n - t * n.dot(t)
        if n.length < 1e-6: n = Vector((0, 0, 1)).cross(t)
        n.normalize()
        b = t.cross(n)
        for k in range(segs):
            a = TAU * k / segs
            verts.append(p + (n * math.cos(a) + b * math.sin(a)) * radius)
    for i in range(len(pts) - 1):
        for k in range(segs):
            k2 = (k + 1) % segs
            faces.append((i * segs + k, i * segs + k2, (i + 1) * segs + k2, (i + 1) * segs + k)); sm.append(True)
    if caps:
        faces.append(tuple(reversed(range(segs)))); sm.append(False)
        n0 = (len(pts) - 1) * segs
        faces.append(tuple(range(n0, n0 + segs))); sm.append(False)
    return verts, faces, sm

def arc_points(centre, radius, a0, a1, n, axis='y'):
    """Points on a circular arc in the plane perpendicular to `axis`."""
    out = []
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        c, s = math.cos(a) * radius, math.sin(a) * radius
        if axis == 'y': out.append((centre[0] + c, centre[1], centre[2] + s))
        elif axis == 'x': out.append((centre[0], centre[1] + c, centre[2] + s))
        else: out.append((centre[0] + c, centre[1] + s, centre[2]))
    return out

# ----------------------------------------------------------------------------- objects
def mesh_object(name, geo, mat):
    verts, faces, smooth = geo
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in verts], [], faces)
    mesh.materials.append(MATS[mat])
    for p, sm in zip(mesh.polygons, smooth):
        p.use_smooth = sm
    mesh.validate(); mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    COLL.objects.link(obj)
    return obj

def add_bevel(obj, width, segments=2, angle=40):
    mod = obj.modifiers.new('Bevel', 'BEVEL')
    mod.width = width; mod.segments = segments
    mod.limit_method = 'ANGLE'; mod.angle_limit = math.radians(angle)
    mod.harden_normals = True; mod.miter_outer = 'MITER_ARC'
    for p in obj.data.polygons: p.use_smooth = True
    return mod

def hero(name, geo, mat, bevel=0.002, segments=2):
    """A single piece that carries a bevel modifier (crisp catch-light edges)."""
    obj = mesh_object(name, geo, mat)
    if bevel > 0: add_bevel(obj, bevel, segments)
    OBJECTS.append(obj)
    return obj

def cut(obj, geo, name='Cutter'):
    """Boolean-subtract `geo` from `obj` (before its bevel, so the recess edges get bevelled too)."""
    cutter = mesh_object(name, geo, 'Polymer')
    cutter.hide_render = True; cutter.display_type = 'WIRE'
    CUTTERS.append(cutter)
    mod = obj.modifiers.new('Cut', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'; mod.solver = 'EXACT'; mod.object = cutter
    # keep the bevel last in the stack
    for i, m in enumerate(obj.modifiers):
        if m.type == 'BEVEL':
            bpy.context.view_layer.objects.active = obj
            with bpy.context.temp_override(object=obj):
                bpy.ops.object.modifier_move_to_index(modifier=m.name, index=len(obj.modifiers) - 1)
            break
    return obj

class Batch:
    """Many small unbevelled greebles of one material in a single mesh."""
    def __init__(self, name):
        self.name = name; self.verts = []; self.faces = []; self.smooth = []; self.mat_index = []; self.mats = []
    def add(self, geo, mat):
        verts, faces, smooth = geo
        m = MATS[mat]
        if m not in self.mats: self.mats.append(m)
        mi = self.mats.index(m)
        offset = len(self.verts)
        self.verts.extend(verts)
        self.faces.extend(tuple(i + offset for i in f) for f in faces)
        self.smooth.extend(smooth)
        self.mat_index.extend([mi] * len(faces))
        return self
    def build(self):
        if not self.faces: return None
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

def select_only(objs, active=None):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = active or objs[0]

def finalize(item):
    """Apply modifiers, drop cutters, join into one object per material, name them."""
    select_only(OBJECTS)
    bpy.ops.object.convert(target='MESH')
    for c in CUTTERS:
        bpy.data.objects.remove(c, do_unlink=True)
    CUTTERS.clear()
    # Split every object by material so the join below groups by material.
    select_only(OBJECTS)
    bpy.ops.mesh.separate(type='MATERIAL')
    parts = [o for o in COLL.objects if o.type == 'MESH']
    by_mat = {}
    for o in parts:
        # separate() leaves unused slots behind; the mesh now uses one material
        used = {p.material_index for p in o.data.polygons}
        mat = o.data.materials[next(iter(used))] if used else None
        if mat is None:
            bpy.data.objects.remove(o, do_unlink=True); continue
        o.data.materials.clear(); o.data.materials.append(mat)
        by_mat.setdefault(mat.name, []).append(o)
    result = []
    for mat_name, objs in by_mat.items():
        select_only(objs)
        if len(objs) > 1: bpy.ops.object.join()
        obj = bpy.context.view_layer.objects.active
        obj.name = f'{item}_{mat_name}'; obj.data.name = obj.name
        result.append(obj)
    OBJECTS.clear(); OBJECTS.extend(result)
    return result

def tri_count(objs):
    return sum(len(p.vertices) - 2 for o in objs for p in o.data.polygons)

def bounds(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector([min(p[i] for p in pts) for i in range(3)])
    hi = Vector([max(p[i] for p in pts) for i in range(3)])
    return lo, hi

def to_gltf(v):
    """Blender (x, y, z) -> glTF (x, z, -y)."""
    return (round(v[0], 4), round(v[2], 4), round(-v[1], 4))

# ----------------------------------------------------------------------------- shared greebles
def screws(batch, points, r=0.0025, depth=0.002, axis='Y', mat='Metal'):
    R = {'X': rot(0, math.pi / 2, 0), 'Y': rot(math.pi / 2, 0, 0), 'Z': Matrix.Identity(4)}[axis]
    for p in points:
        batch.add(cyl_geo(r, r, depth, 6, place(p, R)), mat)

def grooves(batch, x0, x1, y, z0, z1, n, w=0.0025, t=0.0015, mat='Polymer', along='x'):
    """n thin dark ridges on a side face (at y), proud by `t`, evenly spaced between x0..x1."""
    for i in range(n):
        f = (i + 0.5) / n
        if along == 'x':
            x = x0 + (x1 - x0) * f
            batch.add(box_geo(w, t, z1 - z0, place((x, y, (z0 + z1) / 2))), mat)
        else:
            z = z0 + (z1 - z0) * f
            batch.add(box_geo(x1 - x0, t, w, place(((x0 + x1) / 2, y, z))), mat)

def grip_texture(batch, x, y_half, z0, z1, depth_x, cols=3, rows=5, mat='Polymer'):
    """Checker-inset panels on both faces of a pistol grip: small dark tiles 1.5 mm proud."""
    for s in (-1, 1):
        for r in range(rows):
            for c in range(cols):
                z = z0 + (z1 - z0) * (r + 0.5) / rows
                xx = x - depth_x / 2 + depth_x * (c + 0.5) / cols
                batch.add(box_geo(depth_x / cols * 0.72, 0.0015, (z1 - z0) / rows * 0.72,
                                  place((xx, s * (y_half + 0.00075), z))), mat)

# ============================================================================= RIFLE
def build_rifle():
    """Bullpup laser carbine, 1.10 m: muzzle at x = -0.55, butt pad at x = +0.55. Origin at the
    pistol-grip palm point; bore axis z = 0.115."""
    Y = 0.034                       # receiver half-width
    BORE = 0.115
    g = Batch('RifleGreebles')
    # --- receiver: white armour upper with dark inset side panels, dark polymer lower band
    body = hero('Receiver', span_box(-0.14, 0.44, -Y, Y, 0.082, 0.155), 'White', 0.004)
    cut(body, span_box(0.18, 0.30, -Y - 0.01, Y + 0.01, 0.145, 0.175))      # top notch behind the optic (display well)
    for s in (-1, 1):
        cut(body, span_box(-0.10, 0.27, s * (Y - 0.008), s * (Y + 0.02), 0.095, 0.135))
        hero(f'Inset{s}', span_box(-0.098, 0.268, s * (Y - 0.010), s * (Y - 0.0025), 0.096, 0.134), 'Polymer', 0.0015)
        g.add(span_box(-0.09, 0.26, s * (Y - 0.0025), s * (Y - 0.001), 0.099, 0.104), 'Mint')
        grooves(g, -0.07, 0.10, s * (Y - 0.0018), 0.11, 0.13, 4, w=0.003, mat='Metal')
        screws(g, [(-0.125, s * (Y + 0.001), 0.09), (0.29, s * (Y + 0.001), 0.09), (-0.125, s * (Y + 0.001), 0.145), (0.29, s * (Y + 0.001), 0.145),
                   (0.43, s * (Y + 0.001), 0.09), (0.43, s * (Y + 0.001), 0.145)])
    hero('Lower', span_box(-0.14, 0.44, -Y - 0.0025, Y + 0.0025, 0.058, 0.084), 'Polymer', 0.003)
    hero('FrontBlock', span_box(-0.20, -0.135, -Y + 0.004, Y - 0.004, 0.07, 0.15), 'Polymer', 0.004)
    # charge display in the top-rear well
    hero('DisplayFrame', span_box(0.19, 0.29, -Y + 0.004, Y - 0.004, 0.14, 0.152), 'Metal', 0.0015)
    g.add(span_box(0.20, 0.28, -Y + 0.012, Y - 0.012, 0.149, 0.1545), 'Mint')
    for i in range(4):
        g.add(span_box(0.205 + i * 0.019, 0.22 + i * 0.019, -Y + 0.010, -Y + 0.011, 0.1548, 0.1558), 'Polymer')
    # --- top rail with cross slots, running -0.22 .. 0.30
    hero('Rail', span_box(-0.22, 0.18, -0.012, 0.012, 0.155, 0.170), 'Metal', 0.0015)
    for i in range(18):
        x = -0.21 + i * 0.0215
        g.add(span_box(x, x + 0.007, -0.0125, 0.0125, 0.163, 0.1715), 'Polymer')
    # --- optic: compact reflex box with a glass lens and a mint dot
    hero('OpticClamp', span_box(0.06, 0.15, -0.017, 0.017, 0.170, 0.182), 'Polymer', 0.002)
    hero('Optic', span_box(0.05, 0.16, -0.018, 0.018, 0.182, 0.222), 'Metal', 0.0025)
    cut(bpy.data.objects['Optic'], span_box(0.045, 0.062, -0.013, 0.013, 0.188, 0.216))
    g.add(span_box(0.062, 0.066, -0.0125, 0.0125, 0.1885, 0.2155), 'Glass')
    g.add(cyl_geo(0.003, 0.003, 0.003, 8, place((0.161, 0, 0.212), rot(0, math.pi / 2, 0))), 'Mint')
    hero('OpticKnob', cyl_geo(0.006, 0.006, 0.006, 12, place((0.10, 0.021, 0.20), rot(math.pi / 2, 0, 0))), 'Polymer', 0.001)
    # --- pistol grip (raked 14°), trigger and guard
    RG = rot(0, D(-14), 0)
    hero('Grip', box_geo(0.034, 0.030, 0.135, place((0.012, 0, -0.005), RG)), 'Polymer', 0.004)
    grip_texture(g, 0.012, 0.015, -0.06, 0.03, 0.024)
    hero('GripCap', box_geo(0.038, 0.034, 0.008, place((0.0265, 0, -0.072), RG)), 'Metal', 0.0015)
    hero('GuardFront', span_box(-0.075, -0.066, -0.006, 0.006, -0.02, 0.06), 'Polymer', 0.0015)
    hero('GuardBottom', span_box(-0.075, -0.01, -0.006, 0.006, -0.028, -0.02), 'Polymer', 0.0015)
    hero('Trigger', box_geo(0.006, 0.010, 0.036, place((-0.036, 0, 0.022), rot(0, D(12), 0))), 'Metal', 0.001)
    # --- magazine / power cell behind the grip (bullpup)
    RM = rot(0, D(-8), 0)
    hero('Cell', box_geo(0.065, 0.05, 0.13, place((0.20, 0, -0.005), RM)), 'Polymer', 0.004)
    hero('CellPlate', box_geo(0.07, 0.054, 0.009, place((0.209, 0, -0.072), RM)), 'Metal', 0.0015)
    for s in (-1, 1):
        g.add(box_geo(0.045, 0.002, 0.06, place((0.20, s * 0.026, 0.0), RM)), 'White')
        g.add(box_geo(0.006, 0.002, 0.05, place((0.20, s * 0.0272, 0.0), RM)), 'Mint')
    # --- foregrip
    hero('Foregrip', cyl_geo(0.016, 0.013, 0.085, 16, place((-0.29, 0, 0.02))), 'Polymer', 0.002)
    hero('ForegripCap', cyl_geo(0.017, 0.017, 0.008, 16, place((-0.29, 0, -0.026))), 'Metal', 0.001)
    hero('ForegripMount', span_box(-0.31, -0.27, -0.02, 0.02, 0.055, 0.078), 'Polymer', 0.002)
    # --- handguard / vented barrel shroud: octagonal collars on rails over a mint emitter core
    core = hero('EmitterCore', cyl_geo(0.014, 0.014, 0.33, 12, place((-0.30, 0, BORE), rot(0, math.pi / 2, 0))), 'Mint', 0)
    # octagonal collars on eight thin rails: the core shows through the gaps (no boolean needed)
    R8 = rot(0, math.pi / 2, 0) @ rot(0, 0, math.pi / 8)
    for i in range(7):
        x = -0.155 - i * 0.05
        hero(f'Collar{i}', annulus_geo(0.019, 0.036, 8, 0.016, place((x, 0, BORE), R8)), 'Polymer' if i % 2 else 'White', 0.002)
    for a in (D(22.5), D(67.5), D(112.5), D(157.5), D(202.5), D(247.5), D(292.5), D(337.5)):
        g.add(box_geo(0.31, 0.006, 0.004, place((-0.305, 0, BORE)) @ rot(a, 0, 0) @ Matrix.Translation((0, 0, 0.0335))), 'Metal')
    # --- muzzle device + emitter lens
    hero('MuzzleBase', cyl_geo(0.028, 0.028, 0.03, 16, place((-0.47, 0, BORE), rot(0, math.pi / 2, 0))), 'Metal', 0.002)
    hero('Muzzle', cyl_geo(0.022, 0.024, 0.07, 16, place((-0.515, 0, BORE), rot(0, math.pi / 2, 0))), 'Polymer', 0.0025)
    g.add(cyl_geo(0.016, 0.016, 0.004, 16, place((-0.549, 0, BORE), rot(0, math.pi / 2, 0))), 'Metal')
    g.add(cyl_geo(0.011, 0.011, 0.004, 12, place((-0.5505, 0, BORE), rot(0, math.pi / 2, 0))), 'Mint')
    for i in range(3):
        g.add(annulus_geo(0.0245, 0.027, 16, 0.004, place((-0.50 - i * 0.017, 0, BORE), rot(0, math.pi / 2, 0))), 'Metal')
    # --- charge lever on the left side, in a slot
    g.add(span_box(0.02, 0.12, Y + 0.0036, Y + 0.0056, 0.118, 0.126), 'Polymer')
    hero('Lever', cyl_geo(0.008, 0.008, 0.012, 12, place((0.09, Y + 0.011, 0.122), rot(math.pi / 2, 0, 0))), 'Metal', 0.0015)
    hero('LeverArm', span_box(0.05, 0.095, Y + 0.006, Y + 0.012, 0.119, 0.125), 'Metal', 0.001)
    # --- stock with cheek rest and butt pad
    hero('Stock', span_box(0.43, 0.53, -0.028, 0.028, 0.04, 0.14), 'Polymer', 0.004)
    cut(bpy.data.objects['Stock'], span_box(0.45, 0.515, -0.04, 0.04, 0.06, 0.10))
    g.add(span_box(0.452, 0.513, -0.018, 0.018, 0.062, 0.098), 'Metal')
    hero('CheekRest', span_box(0.36, 0.52, -0.024, 0.024, 0.14, 0.152), 'White', 0.003)
    hero('ButtPad', span_box(0.53, 0.55, -0.031, 0.031, 0.035, 0.145), 'Rubber', 0.004)
    for i in range(5):                     # ribs across the butt pad face
        z = 0.05 + i * 0.02
        g.add(span_box(0.55, 0.5515, -0.026, 0.026, z - 0.003, z + 0.003), 'Polymer')
    # --- status LED and a cable from the cell to the receiver
    g.add(cyl_geo(0.004, 0.004, 0.003, 8, place((0.44, -0.024, 0.13), rot(math.pi / 2, 0, 0))), 'Mint')
    g.add(tube_geo([(0.16, -0.02, 0.09), (0.15, -0.045, 0.07), (0.17, -0.05, 0.03), (0.19, -0.03, 0.01)], 0.004, 8), 'Rubber')
    g.build()
    return {'muzzle': (-0.55, 0, BORE), 'leftGrip': (-0.29, 0, 0.012)}

# ============================================================================= PISTOL
def build_pistol():
    """Compact energy sidearm, 0.30 m: muzzle at x = -0.15, slide rear at x = +0.15. Origin at the
    grip palm point; bore axis z = 0.055."""
    Y = 0.015
    BORE = 0.055
    g = Batch('PistolGreebles')
    # --- slide (white armour top over a metal core), rear serrations
    hero('SlideCore', span_box(-0.15, 0.13, -Y, Y, 0.035, 0.078), 'Metal', 0.0025)
    hero('SlideTop', span_box(-0.14, 0.15, -Y + 0.002, Y - 0.002, 0.06, 0.082), 'White', 0.0025)
    cut(bpy.data.objects['SlideTop'], span_box(-0.11, 0.02, -0.006, 0.006, 0.075, 0.09))   # top sight channel
    for s in (-1, 1):
        grooves(g, 0.06, 0.125, s * (Y + 0.0007), 0.04, 0.074, 6, w=0.003)
        g.add(span_box(-0.13, 0.04, s * (Y + 0.0002), s * (Y + 0.0022), 0.063, 0.067), 'Mint')
        screws(g, [(-0.12, s * (Y + 0.001), 0.045), (0.05, s * (Y + 0.001), 0.045)], r=0.0018)
    hero('SlideNose', span_box(-0.15, -0.135, -Y + 0.003, Y - 0.003, 0.033, 0.08), 'Polymer', 0.002)
    # --- emitter lens at the muzzle
    g.add(cyl_geo(0.010, 0.010, 0.004, 14, place((-0.150, 0, BORE), rot(0, math.pi / 2, 0))), 'Metal')
    g.add(cyl_geo(0.007, 0.007, 0.003, 12, place((-0.1515, 0, BORE), rot(0, math.pi / 2, 0))), 'Mint')
    # sights
    g.add(span_box(-0.135, -0.128, -0.003, 0.003, 0.082, 0.090), 'Polymer')
    g.add(span_box(0.10, 0.11, -0.010, 0.010, 0.082, 0.090), 'Polymer')
    g.add(cyl_geo(0.002, 0.002, 0.003, 8, place((0.11, 0, 0.0865), rot(0, math.pi / 2, 0))), 'Mint')
    # --- frame with a small rail + light, trigger + guard
    hero('Frame', span_box(-0.12, 0.09, -Y + 0.001, Y - 0.001, 0.006, 0.037), 'Polymer', 0.0025)
    hero('RailLight', span_box(-0.115, -0.07, -0.011, 0.011, -0.012, 0.006), 'Polymer', 0.002)
    g.add(cyl_geo(0.006, 0.006, 0.003, 12, place((-0.1155, 0, -0.003), rot(0, math.pi / 2, 0))), 'Glass')
    hero('GuardFront', span_box(-0.062, -0.055, -0.004, 0.004, -0.024, 0.006), 'Polymer', 0.001)
    hero('GuardBottom', span_box(-0.062, 0.0, -0.004, 0.004, -0.030, -0.024), 'Polymer', 0.001)
    hero('Trigger', box_geo(0.005, 0.007, 0.024, place((-0.033, 0, -0.008), rot(0, D(14), 0))), 'Metal', 0.0008)
    # --- grip (raked 18°) with textured insets and a base plate + status LED
    RG = rot(0, D(-18), 0)
    hero('Grip', box_geo(0.03, 0.027, 0.10, place((0.028, 0, -0.03), RG)), 'Polymer', 0.003)
    grip_texture(g, 0.026, 0.0135, -0.062, 0.0, 0.02, cols=3, rows=4)
    for s in (-1, 1):
        g.add(box_geo(0.026, 0.002, 0.018, place((0.032, s * 0.0135, 0.014), RG)), 'White')
    hero('GripPlate', box_geo(0.034, 0.03, 0.007, place((0.042, 0, -0.082), RG)), 'Metal', 0.0012)
    g.add(cyl_geo(0.0025, 0.0025, 0.003, 8, place((0.13, -Y - 0.0008, 0.05), rot(math.pi / 2, 0, 0))), 'Mint')
    # slide release / thumb lever
    hero('Release', span_box(0.03, 0.06, -Y - 0.004, -Y, 0.03, 0.036), 'Metal', 0.001)
    g.build()
    return {'muzzle': (-0.15, 0, BORE), 'leftGrip': None}

# ============================================================================= MINING LASER
def build_mining():
    """Two-handed industrial mining laser, 0.80 m: emitter face at x = -0.60, battery block at
    x = +0.20. Origin at the rear grip palm point; emitter axis z = 0.14."""
    Y = 0.055
    AX = 0.14
    g = Batch('MiningGreebles')
    RX = rot(0, math.pi / 2, 0)
    # --- main body: polymer chassis, white armour side shells, recessed vent panel
    body = hero('Body', span_box(-0.34, 0.14, -Y, Y, 0.07, 0.21), 'Polymer', 0.006)
    cut(body, span_box(-0.30, -0.02, Y - 0.008, Y + 0.02, 0.10, 0.18))
    cut(body, span_box(-0.30, -0.02, -Y - 0.02, -Y + 0.008, 0.10, 0.18))
    for s in (-1, 1):
        hero(f'Shell{s}', span_box(-0.32, 0.12, s * (Y - 0.006), s * (Y + 0.004), 0.075, 0.098), 'White', 0.003)
        hero(f'ShellTop{s}', span_box(-0.32, 0.12, s * (Y - 0.006), s * (Y + 0.004), 0.184, 0.205), 'White', 0.003)
        grooves(g, -0.28, -0.04, s * (Y - 0.0075), 0.105, 0.175, 8, w=0.006, t=0.003, mat='Metal')
        g.add(span_box(-0.31, 0.11, s * (Y + 0.001), s * (Y + 0.003), 0.099, 0.104), 'Mint')
        screws(g, [(-0.31, s * (Y + 0.005), 0.086), (0.11, s * (Y + 0.005), 0.086), (-0.31, s * (Y + 0.005), 0.195), (0.11, s * (Y + 0.005), 0.195)], r=0.0035)
    # --- battery block at the rear with a handle loop and LED
    hero('Battery', span_box(0.14, 0.20, -0.045, 0.045, 0.085, 0.20), 'Metal', 0.004)
    cut(bpy.data.objects['Battery'], span_box(0.16, 0.19, -0.03, 0.03, 0.11, 0.17))
    g.add(span_box(0.163, 0.187, -0.026, 0.026, 0.113, 0.167), 'Polymer')
    for i in range(3):
        g.add(span_box(0.201, 0.204, -0.02, 0.02, 0.12 + i * 0.016, 0.128 + i * 0.016), 'Mint' if i < 2 else 'Amber')
    hero('Latch', span_box(0.12, 0.16, -0.03, 0.03, 0.205, 0.215), 'Polymer', 0.002)
    # --- rear pistol grip (palm at the origin) and trigger
    RG = rot(0, D(-15), 0)
    hero('Grip', box_geo(0.036, 0.032, 0.15, place((0.012, 0, 0.0), RG)), 'Polymer', 0.004)
    grip_texture(g, 0.012, 0.016, -0.06, 0.035, 0.026, cols=3, rows=5)
    hero('GripCap', box_geo(0.04, 0.036, 0.008, place((0.031, 0, -0.072), RG)), 'Metal', 0.0015)
    hero('GuardFront', span_box(-0.08, -0.07, -0.006, 0.006, -0.02, 0.07), 'Polymer', 0.0015)
    hero('GuardBottom', span_box(-0.08, -0.012, -0.006, 0.006, -0.028, -0.02), 'Polymer', 0.0015)
    hero('Trigger', box_geo(0.007, 0.012, 0.04, place((-0.04, 0, 0.03), rot(0, D(12), 0))), 'Metal', 0.001)
    # --- forward vertical grip
    hero('Foregrip', cyl_geo(0.018, 0.015, 0.10, 16, place((-0.30, 0, 0.02))), 'Polymer', 0.002)
    hero('ForegripCap', cyl_geo(0.019, 0.019, 0.008, 16, place((-0.30, 0, -0.034))), 'Metal', 0.001)
    # --- emitter head: thick metal barrel, radial heat fins, bezel and mint focusing lens
    hero('HeadNeck', cyl_geo(0.05, 0.05, 0.06, 24, place((-0.37, 0, AX), RX)), 'Polymer', 0.003)
    hero('Head', cyl_geo(0.068, 0.068, 0.20, 24, place((-0.50, 0, AX), RX)), 'Metal', 0.004)
    for i in range(6):
        x = -0.42 - i * 0.026
        g.add(annulus_geo(0.06, 0.098, 24, 0.006, place((x, 0, AX), RX)), 'Metal')
    for a in range(8):
        g.add(box_geo(0.19, 0.008, 0.014, place((-0.50, 0, AX)) @ rot(D(22.5 + a * 45), 0, 0) @ Matrix.Translation((0, 0, 0.098))), 'Polymer')
    hero('Bezel', cyl_geo(0.075, 0.07, 0.03, 24, place((-0.585, 0, AX), RX)), 'Polymer', 0.003)
    g.add(cyl_geo(0.052, 0.052, 0.006, 24, place((-0.597, 0, AX), RX)), 'Metal')
    g.add(cyl_geo(0.042, 0.042, 0.004, 20, place((-0.6, 0, AX), RX)), 'Mint')
    g.add(cyl_geo(0.018, 0.018, 0.004, 12, place((-0.6015, 0, AX), RX)), 'Glass')
    # --- coolant tank on top with bands, end caps, gauge strip and a readout
    hero('Tank', cyl_geo(0.048, 0.048, 0.30, 24, place((-0.06, 0, 0.27), RX)), 'Metal', 0.004)
    for x in (-0.19, -0.11, 0.03, 0.08):
        g.add(annulus_geo(0.046, 0.053, 24, 0.014, place((x, 0, 0.27), RX)), 'Polymer')
    hero('TankCapF', cyl_geo(0.03, 0.04, 0.03, 16, place((-0.225, 0, 0.27), RX)), 'Polymer', 0.002)
    hero('TankCapR', cyl_geo(0.04, 0.03, 0.03, 16, place((0.105, 0, 0.27), RX)), 'Polymer', 0.002)
    hero('TankSaddle', span_box(-0.20, 0.09, -0.04, 0.04, 0.205, 0.235), 'Polymer', 0.003)
    hero('Valve', cyl_geo(0.012, 0.012, 0.03, 12, place((-0.24, 0, 0.27), RX)), 'Metal', 0.001)
    hero('Readout', span_box(-0.08, 0.0, -0.03, 0.03, 0.31, 0.322), 'Polymer', 0.002)
    g.add(span_box(-0.075, -0.005, -0.024, 0.024, 0.3205, 0.3235), 'Mint')
    for s in (-1, 1):                      # heat gauge: 8 segments, the last three amber
        for i in range(8):
            x = -0.185 + i * 0.024
            g.add(box_geo(0.016, 0.004, 0.012, place((x, s * 0.0495, 0.27), rot(math.pi / 2 * (1 if s > 0 else -1), 0, 0) @ rot(0, 0, 0))), 'Mint' if i < 5 else 'Amber')
    # --- coolant cable: tank rear -> down into the battery block, and one to the head
    g.add(tube_geo([(0.10, 0.03, 0.26), (0.16, 0.06, 0.25), (0.2, 0.06, 0.20), (0.2, 0.04, 0.16)], 0.007, 8), 'Rubber')
    g.add(tube_geo([(-0.22, -0.035, 0.26), (-0.33, -0.07, 0.25), (-0.40, -0.075, 0.20), (-0.42, -0.05, 0.17)], 0.007, 8), 'Rubber')
    g.add(cyl_geo(0.01, 0.01, 0.02, 10, place((-0.42, -0.05, 0.17), rot(0, 0, 0))), 'Metal')
    g.add(cyl_geo(0.009, 0.009, 0.02, 10, place((0.2, 0.04, 0.16), rot(0, 0, 0))), 'Metal')
    g.build()
    return {'muzzle': (-0.60, 0, AX), 'leftGrip': (-0.30, 0, 0.01)}

# ============================================================================= BACKPACK
def build_backpack():
    """Life-support backpack, 0.60 m tall: contact face y = 0 (the origin), the pack extends
    toward -Y (glTF +Z, the Meshy convention). Two tanks, regulator, status bar, rifle rail."""
    g = Batch('PackGreebles')
    RZ = Matrix.Identity(4)
    RY = rot(math.pi / 2, 0, 0)            # cylinder axis along -Y
    # --- back plate (white armour) with a polymer cushion on the contact side
    hero('Plate', span_box(-0.21, 0.21, -0.03, -0.004, -0.27, 0.27), 'White', 0.006)
    hero('Cushion', span_box(-0.17, 0.17, -0.006, 0.0, -0.24, 0.24), 'Rubber', 0.004)
    for s in (-1, 1):
        g.add(span_box(-0.15, 0.15, -0.0005, 0.0, s * 0.10 - 0.003, s * 0.10 + 0.003), 'Polymer')
    # --- main shell (polymer) with a white outer cover and recessed rail channel
    shell = hero('Shell', span_box(-0.16, 0.16, -0.19, -0.03, -0.25, 0.25), 'Polymer', 0.008)
    cover = hero('Cover', span_box(-0.14, 0.14, -0.205, -0.185, -0.23, 0.23), 'White', 0.004)
    cut(cover, span_box(-0.09, 0.09, -0.22, -0.19, -0.12, 0.10))
    for s in (-1, 1):
        # side vent grilles on the shell flanks
        for i in range(6):
            z = -0.16 + i * 0.03
            g.add(span_box(s * 0.1605, s * 0.163, -0.15, -0.07, z - 0.008, z + 0.008), 'Metal')
    # panel lines and screws on the cover
    for z in (-0.18, 0.16):
        g.add(span_box(-0.12, 0.12, -0.2075, -0.205, z - 0.0015, z + 0.0015), 'Polymer')
    screws(g, [(-0.125, -0.206, -0.215), (0.125, -0.206, -0.215), (-0.125, -0.206, 0.215), (0.125, -0.206, 0.215)], r=0.004, depth=0.003)
    # --- rifle magnetic mount rail (0.5 m, tilted 20° from vertical) in the recess
    RR = rot(0, D(20), 0)
    hero('Rail', box_geo(0.036, 0.014, 0.50, place((0.0, -0.196, -0.01), RR)), 'Metal', 0.002)
    for k in (-0.17, 0.0, 0.17):
        p = RR @ Vector((0, 0, k))
        g.add(box_geo(0.024, 0.003, 0.05, place((p.x, -0.2045, -0.01 + p.z), RR)), 'Mint')
        hero(f'Clamp{k}', box_geo(0.05, 0.02, 0.02, place((p.x, -0.201, -0.01 + p.z + 0.04), RR)), 'Polymer', 0.002)
    # --- tanks (metal) with bands, valves and hoses to the regulator
    for s in (-1, 1):
        x = s * 0.205
        hero(f'Tank{s}', cyl_geo(0.052, 0.052, 0.42, 24, place((x, -0.12, -0.02))), 'Metal', 0.006)
        hero(f'TankTop{s}', cyl_geo(0.052, 0.036, 0.03, 24, place((x, -0.12, 0.205))), 'Metal', 0.003)
        hero(f'TankBot{s}', cyl_geo(0.036, 0.052, 0.03, 24, place((x, -0.12, -0.245))), 'Metal', 0.003)
        hero(f'Valve{s}', cyl_geo(0.018, 0.018, 0.035, 12, place((x, -0.12, 0.235))), 'Polymer', 0.002)
        hero(f'Knob{s}', cyl_geo(0.022, 0.022, 0.01, 12, place((x, -0.12, 0.257))), 'Metal', 0.001)
        for z in (-0.15, 0.10):
            hero(f'Band{s}{z}', annulus_geo(0.050, 0.058, 24, 0.03, place((x, -0.12, z))), 'Polymer', 0.002)
            hero(f'Cradle{s}{z}', span_box(s * 0.16, s * 0.20, -0.14, -0.10, z - 0.02, z + 0.02), 'Polymer', 0.002)
        g.add(span_box(x - 0.004, x + 0.004, -0.173, -0.171, -0.12, 0.06), 'Mint')
        g.add(tube_geo([(x, -0.12, 0.262), (x, -0.13, 0.30), (s * 0.12, -0.13, 0.31), (s * 0.06, -0.11, 0.30)], 0.008, 8), 'Rubber')
    # --- regulator block on top with gauges and a status LED
    hero('Regulator', span_box(-0.08, 0.08, -0.15, -0.05, 0.25, 0.31), 'Polymer', 0.004)
    hero('RegCap', span_box(-0.06, 0.06, -0.14, -0.06, 0.31, 0.325), 'White', 0.003)
    for i, x in enumerate((-0.045, 0.0, 0.045)):
        hero(f'Gauge{i}', cyl_geo(0.014, 0.014, 0.01, 14, place((x, -0.155, 0.28), RY)), 'Metal', 0.001)
        g.add(cyl_geo(0.010, 0.010, 0.003, 12, place((x, -0.1615, 0.28), RY)), 'Glass')
    g.add(cyl_geo(0.005, 0.005, 0.003, 8, place((0.0, -0.1615, 0.30), RY)), 'Mint')
    # --- status light bar on the cover
    hero('BarFrame', span_box(-0.11, 0.11, -0.214, -0.203, 0.17, 0.20), 'Polymer', 0.002)
    g.add(span_box(-0.10, 0.10, -0.2165, -0.213, 0.176, 0.194), 'Mint')
    for i in range(6):
        g.add(span_box(-0.09 + i * 0.033, -0.087 + i * 0.033, -0.2175, -0.2165, 0.176, 0.194), 'Polymer')
    # --- straps: shoulder loops over the top, a waist belt stub at the bottom (thin webbing)
    for s in (-1, 1):
        x = s * 0.10
        pts = [(x, 0.0, 0.20), (x, 0.03, 0.24), (x, 0.08, 0.255), (x, 0.13, 0.24), (x, 0.16, 0.19), (x, 0.17, 0.12)]
        g.add(tube_geo(pts, 0.012, 8), 'Rubber')
        g.add(box_geo(0.035, 0.006, 0.05, place((x, -0.001, 0.18))), 'Polymer')
        g.add(box_geo(0.035, 0.006, 0.05, place((x, -0.001, -0.20))), 'Polymer')
        g.add(tube_geo([(x, 0.0, -0.20), (x, 0.03, -0.22), (x, 0.07, -0.23), (s * 0.14, 0.09, -0.235)], 0.010, 8), 'Rubber')
    g.build()
    return {}

# ============================================================================= HELMET
def build_helmet():
    """Sealed helmet, 0.35 m tall: neck-ring base at z = 0 (the origin), visor facing -Y (glTF +Z)."""
    g = Batch('HelmetGreebles')
    C = (0, 0.0, 0.195)                   # shell centre
    R_SH = 0.148
    RV = rot(math.pi / 2, 0, 0)            # local Z -> -Y
    # --- neck ring (metal) with latches, polymer collar
    hero('NeckRing', annulus_geo(0.095, 0.128, 32, 0.028, place((0, 0, 0.014))), 'Metal', 0.003)
    hero('Collar', lathe_geo([(0.10, 0.028), (0.125, 0.028), (0.14, 0.055), (0.142, 0.085), (0.12, 0.085), (0.10, 0.06)], 32, place((0, 0, 0))), 'Polymer', 0.003)
    for a in (D(35), D(145), D(215), D(325)):
        M = rot(0, 0, a) @ Matrix.Translation((0.128, 0, 0.014))
        hero(f'Latch{a:.2f}', box_geo(0.016, 0.03, 0.022, M), 'Polymer', 0.002)
        g.add(box_geo(0.004, 0.012, 0.014, M @ Matrix.Translation((0.009, 0, 0))), 'Metal')
    # --- shell: slightly elongated ellipsoid (white armour) and a helper to mount parts on it
    AX_ = (R_SH, R_SH * 1.06, R_SH * 1.05)
    shell = hero('Shell', sphere_geo(R_SH, 40, 24, place(C) @ Matrix.Diagonal((1.0, 1.06, 1.05, 1.0))), 'White', 0)
    def on_shell(d, lift=0.0):
        """Matrix at the ellipsoid surface in direction d, local Z along the outward normal."""
        d = Vector(d).normalized()
        k = 1 / math.sqrt(sum((d[i] / AX_[i]) ** 2 for i in range(3)))
        p = Vector(C) + d * k
        n = Vector([(p[i] - C[i]) / AX_[i] ** 2 for i in range(3)]).normalized()
        return Matrix.Translation(p + n * lift) @ n.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    hero('Crest', annulus_geo(0.150, 0.163, 14, 0.03, place(C, rot(0, math.pi / 2, 0)), a0=D(110), a1=D(235)), 'Polymer', 0.003)
    # rear service panel with screws and a cable down to the ring
    hero('RearPanel', box_geo(0.09, 0.07, 0.02, on_shell((0, 1, -0.15), -0.006)), 'Polymer', 0.003)
    for sx in (-1, 1):
        g.add(cyl_geo(0.003, 0.003, 0.003, 6, on_shell((sx * 0.25, 1, -0.30), 0.0055)), 'Metal')
    back = on_shell((0, 1, -0.45), 0.004).to_translation()
    g.add(tube_geo([tuple(back), (0.0, 0.165, 0.10), (0.0, 0.125, 0.05)], 0.006, 8), 'Rubber')
    # --- visor: a spherical cap proud of the shell, ringed by a metal frame; faint HUD strip along its top
    VC = (0, -0.012, 0.205)
    hero('Visor', cap_geo(0.150, D(58), 40, 10, place(VC, RV)), 'Glass', 0)
    hero('VisorFrame', lathe_geo([(0.150 * math.sin(D(56)), 0.150 * math.cos(D(56))), (0.150 * math.sin(D(61)), 0.150 * math.cos(D(61))),
                                  (0.156 * math.sin(D(61)), 0.156 * math.cos(D(61))), (0.156 * math.sin(D(56)), 0.156 * math.cos(D(56)))], 40, place(VC, RV), smooth=True), 'Metal', 0)
    g.add(lathe_geo([(0.1515 * math.sin(D(44)), 0.1515 * math.cos(D(44))), (0.1515 * math.sin(D(48)), 0.1515 * math.cos(D(48)))], 16, place(VC, RV), a0=D(50), a1=D(130)), 'MintDim')
    # --- chin guard (white) with dark vents
    hero('Chin', annulus_geo(0.118, 0.140, 12, 0.05, place((0, 0, 0.10)), a0=D(232), a1=D(308)), 'White', 0.004)
    for i in range(5):
        a = D(255 + i * 7.5)
        g.add(box_geo(0.003, 0.010, 0.03, place((0.1405 * math.cos(a), 0.1405 * math.sin(a), 0.10), rot(0, 0, a))), 'Polymer')
    # --- temple pods with mint LEDs, ear modules, comm box + antenna, all seated on the shell
    for s in (-1, 1):
        M = on_shell((s * 1.0, -0.42, 0.12), -0.006)
        hero(f'Pod{s}', cyl_geo(0.024, 0.022, 0.022, 16, M), 'Polymer', 0.002)
        hero(f'PodRing{s}', cyl_geo(0.017, 0.017, 0.008, 16, M @ Matrix.Translation((0, 0, 0.014))), 'Metal', 0.001)
        g.add(cyl_geo(0.010, 0.010, 0.003, 12, M @ Matrix.Translation((0, 0, 0.0185))), 'Mint')
        ME = on_shell((s * 1.0, 0.25, -0.15), -0.008)
        hero(f'Ear{s}', box_geo(0.06, 0.05, 0.018, ME), 'Polymer', 0.003)
        g.add(box_geo(0.05, 0.010, 0.003, ME @ Matrix.Translation((0, 0.0, 0.0105))), 'Metal')
        g.add(box_geo(0.05, 0.010, 0.003, ME @ Matrix.Translation((0, -0.014, 0.0105))), 'Metal')
    MC = on_shell((1.0, 0.55, 0.45), -0.006)
    hero('Comm', box_geo(0.05, 0.03, 0.014, MC), 'Metal', 0.002)
    hero('Antenna', cyl_geo(0.004, 0.0025, 0.07, 8, MC @ Matrix.Translation((0.0, 0.0, 0.04)) @ rot(D(15), 0, 0)), 'Metal', 0.0005)
    g.build()
    return {}

# ============================================================================= EXPORT / PREVIEW
ITEMS = {
    'rifle-laser': build_rifle,
    'sidearm-pistol': build_pistol,
    'mining-laser-tool': build_mining,
    'backpack-life-support': build_backpack,
    'helmet-standalone': build_helmet,
}

def export(item, objs):
    path = os.path.join(OUT_DIR, f'{item}.glb')
    select_only(objs)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', export_apply=True, export_yup=True,
        export_animations=False, export_skins=False, export_morph=False,
        export_lights=False, export_cameras=False, export_extras=False,
        export_texcoords=False, export_normals=True, export_materials='EXPORT', export_image_format='NONE',
        use_selection=True)
    return path

def preview(item, objs, path):
    scene = bpy.context.scene
    scene.render.resolution_x, scene.render.resolution_y = 900, 600
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    world = bpy.data.worlds.new('Studio'); scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.32, 0.36, 0.40, 1.0); bg.inputs['Strength'].default_value = 1.0
    lo, hi = bounds(objs)
    ctr = (lo + hi) / 2
    radius = (hi - lo).length / 2
    cam_data = bpy.data.cameras.new('Camera'); cam_data.lens = 50; cam_data.sensor_width = 36
    cam = bpy.data.objects.new('Camera', cam_data); scene.collection.objects.link(cam); scene.camera = cam
    # ¾ view from the front-left-above (muzzle side / visor / the pack's outer face)
    d = Vector((-0.45, -1.0, 0.45)).normalized()
    if item == 'backpack-life-support': d = Vector((-0.6, -1.0, 0.45)).normalized()
    if item == 'helmet-standalone': d = Vector((-0.7, -1.0, 0.5)).normalized()
    fov = 2 * math.atan(cam_data.sensor_width / 2 / cam_data.lens) * (600 / 900)
    fit = 0.66 if radius > 0.35 else 0.72
    cam.location = ctr + d * radius / math.sin(fov / 2) * fit
    cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z', 'Y').to_euler()
    # key from the camera's left-above, cool rim from behind
    key_data = bpy.data.lights.new('Key', 'SUN'); key_data.energy = 4.0; key_data.angle = D(4)
    key = bpy.data.objects.new('Key', key_data); scene.collection.objects.link(key)
    key.rotation_euler = (Vector((0, 0, 0)) - Vector((-1.0, -0.6, 1.4))).to_track_quat('-Z', 'Y').to_euler()
    rim_data = bpy.data.lights.new('Rim', 'SUN'); rim_data.energy = 2.0; rim_data.color = (0.7, 0.85, 1.0)
    rim = bpy.data.objects.new('Rim', rim_data); scene.collection.objects.link(rim)
    rim.rotation_euler = (Vector((0, 0, 0)) - Vector((0.8, 1.0, 0.6))).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = path
    try:
        scene.render.engine = 'BLENDER_EEVEE'
        scene.eevee.taa_render_samples = 32
        bpy.ops.render.render(write_still=True)
    except Exception as e:
        print('EEVEE failed, falling back to WORKBENCH:', e)
        scene.render.engine = 'BLENDER_WORKBENCH'
        sh = scene.display.shading
        sh.light = 'STUDIO'; sh.color_type = 'MATERIAL'; sh.show_cavity = True; sh.show_shadows = True
        bpy.ops.render.render(write_still=True)
    print('PREVIEW', path)

REPORT = {}
for item, build in ITEMS.items():
    if ONLY and item != ONLY: continue
    reset_scene()
    faction_materials()
    points = build()
    objs = finalize(item)
    lo, hi = bounds(objs)
    tris = tri_count(objs)
    path = export(item, objs)
    info = {
        'tris': tris,
        'size_gltf': (round(hi.x - lo.x, 4), round(hi.z - lo.z, 4), round(hi.y - lo.y, 4)),
        'min_gltf': to_gltf(Vector((lo.x, hi.y, lo.z))), 'max_gltf': to_gltf(Vector((hi.x, lo.y, hi.z))),
        'materials': sorted(o.data.materials[0].name for o in objs),
        'muzzle_gltf': to_gltf(points['muzzle']) if points.get('muzzle') else None,
        'leftGrip_gltf': to_gltf(points['leftGrip']) if points.get('leftGrip') else None,
        'file_mb': round(os.path.getsize(path) / 1e6, 3),
    }
    REPORT[item] = info
    print('BUILT', item, json.dumps(info))
    if PREVIEW_DIR:
        os.makedirs(PREVIEW_DIR, exist_ok=True)
        preview(item, objs, os.path.join(PREVIEW_DIR, f'{item}.png'))

print('REPORT', json.dumps(REPORT))
print(f'DONE in {time.time() - T0:.1f}s')
