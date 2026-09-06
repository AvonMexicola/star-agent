"""Star Agent — orbital station with an animated hangar. Fully procedural bpy build.

    blender -b --python blender/build_station.py -- --out public/models/station.glb
    blender -b --python blender/build_station.py -- --out public/models/station_lod1.glb --lod
    blender -b --python blender/build_station.py -- --out public/models/station.glb --preview <dir>
    (--no-ao skips the Cycles ambient-occlusion vertex bake; --ao-samples N, default 24)

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

Detail pass (2026-09): the hangar block is one manifold shell with EXACT-boolean panel seams,
access hatches, a grooved plate spine with a dark trim band, three hull shades, mint accent strips,
greebles at three scales, recessed ceiling light coffers and 2 m deck-plate seams. Ambient occlusion
and wear are baked into a per-vertex colour attribute exported as COLOR_0 (three's GLTFLoader sets
`vertexColors = true` on any material used by a primitive that carries COLOR_0).
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
BAKE_AO = DETAIL and '--no-ao' not in argv
AO_SAMPLES = int(arg('--ao-samples', '24'))
TAU = math.pi * 2
import random
RNG = random.Random(7291)

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
def material(name, color, metallic=0.0, roughness=0.5, emission=None, strength=0.0, vcol=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if vcol:
        # Baked AO / wear lives in the 'Col' vertex colour: Base Color = colour x Col. The glTF exporter
        # recognises this multiply and writes baseColorFactor = colour plus a COLOR_0 attribute.
        attr = nodes.new('ShaderNodeVertexColor'); attr.layer_name = 'Col'
        mix = nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.0
        mix.inputs[6].default_value = (*color, 1.0)
        links.new(attr.outputs['Color'], mix.inputs[7])
        links.new(mix.outputs[2], bsdf.inputs['Base Color'])
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
MINT_STRIP = (0.714, 0.937, 0.820)      # #b6efd1, the faction accent
AMBER = (1.0, 0.52, 0.10)
# Three hull shades with slightly different roughness, assigned per plate. All hull-ish materials
# multiply the baked 'Col' attribute (AO + wear).
material('Hull', (0.78, 0.78, 0.78), 0.10, 0.50, vcol=True)
material('HullMid', (0.70, 0.71, 0.73), 0.12, 0.57, vcol=True)
material('HullDark', (0.62, 0.63, 0.65), 0.15, 0.46, vcol=True)
material('HullPanel', (0.62, 0.64, 0.66), 0.15, 0.50, vcol=True)
material('Trim', (0.16, 0.16, 0.17), 0.05, 0.75, vcol=True)          # matte dark polymer band
material('Recess', (0.10, 0.10, 0.11), 0.55, 0.60, vcol=True)        # exposed structure in seams/coffers
material('Gunmetal', (0.18, 0.18, 0.19), 0.80, 0.40, vcol=True)
material('Metal', (0.60, 0.60, 0.62), 0.65, 0.35, vcol=True)          # brushed rails, struts, pipes
material('Truss', (0.16, 0.17, 0.19), 0.85, 0.42)
material('Solar', (0.03, 0.05, 0.20), 0.45, 0.30)
material('SolarBack', (0.55, 0.55, 0.52), 0.30, 0.60)
material('Radiator', (0.90, 0.90, 0.93), 0.05, 0.30, vcol=True)
material('Deck', (0.26, 0.27, 0.28), 0.30, 0.68, vcol=True)
material('DeckB', (0.30, 0.31, 0.32), 0.30, 0.62, vcol=True)
material('Rubber', (0.04, 0.04, 0.045), 0.0, 0.92)
material('Glass', (0.05, 0.08, 0.12), 0.9, 0.08)
material('Mint', MINT, 0.0, 0.4, MINT, 2.0)
material('MintPaint', (0.42, 0.78, 0.58), 0.0, 0.5, MINT, 0.35)
material('MintStrip', MINT_STRIP, 0.0, 0.4, MINT_STRIP, 1.2)           # accent strips (x2 in station.js)
material('Amber', AMBER, 0.0, 0.4, AMBER, 2.0)
material('AmberSoft', AMBER, 0.0, 0.4, AMBER, 1.2)
# Station.prepareMaterials doubles authored emissives: target 1.4 for diffusers,
# 1.2 for lettering, leaving the navigation-light calibration unchanged.
material('HangarLight', (0.86, 0.82, 0.72), 0.0, 0.55, (1.0, 0.97, 0.90), .7)
material('WayfindingInk', MINT, 0.0, 0.65, MINT, .6)
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

def decal_frame(origin, normal, along, lift=0.025):
    """Matrix with local +Z = surface normal and local +Y = `along`, lifted off the surface."""
    n = Vector(normal).normalized(); y = Vector(along).normalized(); x = y.cross(n).normalized()
    M = Matrix((( x.x, y.x, n.x, 0), (x.y, y.y, n.y, 0), (x.z, y.z, n.z, 0), (0, 0, 0, 1)))
    return Matrix.Translation(Vector(origin) + n * lift) @ M

def fan_geo(ru, rv, segs, M, c0, c1=1.0, inner=0.6):
    """Elliptical scorch/stain disc: dark centre `c0`, still dark at `inner` of the radius, fading to `c1`
    at the rim (vertex colours)."""
    ring = lambda f: [M @ Vector((f * ru * math.cos(TAU * i / segs), f * rv * math.sin(TAU * i / segs), 0)) for i in range(segs)]
    verts = [M @ Vector((0, 0, 0))] + ring(inner) + ring(1.0)
    faces = [(0, 1 + i, 1 + (i + 1) % segs) for i in range(segs)]
    for i in range(segs):
        j = (i + 1) % segs
        faces.append((1 + i, 1 + segs + i, 1 + segs + j, 1 + j))
    cm = c0 + (c1 - c0) * 0.3
    colors = [(c0, c0, c0, 1.0)] + [(cm, cm, cm, 1.0)] * segs + [(c1, c1, c1, 1.0)] * segs
    return (verts, faces, [True] * len(faces)), colors

def streak_geo(w, L, M, c0, rows=4, taper=0.45):
    """Streak along local +Y: dark centre line at the source fading out along its length and to the sides."""
    verts, colors, faces = [], [], []
    for r in range(rows + 1):
        t = r / rows; wf = 1.0 - taper * t
        for cx in (-1, 0, 1):
            verts.append(M @ Vector((cx * w / 2 * wf, t * L, 0)))
            c = 1.0 if cx else c0 + (1.0 - c0) * t * t
            colors.append((c, c, c, 1.0))
    for r in range(rows):
        for c in range(2):
            a = r * 3 + c
            faces.append((a, a + 1, a + 4, a + 3))
    return (verts, faces, [True] * len(faces)), colors

# ----------------------------------------------------------------------------- batching into few objects
OBJECTS = []
class Batch:
    def __init__(self, name):
        self.name = name; self.verts = []; self.faces = []; self.smooth = []; self.mat_index = []; self.mats = []
        self.colors = []; self.has_colors = False
    def _mi(self, mat):
        mat = MATS[mat] if isinstance(mat, str) else mat
        if mat not in self.mats: self.mats.append(mat)
        return self.mats.index(mat)
    def add(self, geo, mat, colors=None):
        verts, faces, smooth = geo
        mi = self._mi(mat)
        offset = len(self.verts)
        self.verts.extend(verts)
        self.faces.extend(tuple(i + offset for i in f) for f in faces)
        self.smooth.extend(smooth)
        self.mat_index.extend([mi] * len(faces))
        if colors is not None: self.has_colors = True
        self.colors.extend(colors if colors is not None else [None] * len(verts))
        return self
    def add_multi(self, verts, faces, smooth, mats):
        """Like add() but with one material name per face."""
        offset = len(self.verts)
        self.verts.extend(verts)
        self.faces.extend(tuple(i + offset for i in f) for f in faces)
        self.smooth.extend(smooth)
        self.mat_index.extend(self._mi(m) for m in mats)
        self.colors.extend([None] * len(verts))
        return self
    def build(self):
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata([tuple(v) for v in self.verts], [], self.faces)
        for m in self.mats: mesh.materials.append(m)
        for p, mi, sm in zip(mesh.polygons, self.mat_index, self.smooth):
            p.material_index = mi; p.use_smooth = sm
        if self.has_colors:   # authored tone; bake_ao() multiplies it with the baked AO into 'Col'
            ca = mesh.color_attributes.new('Tint', 'FLOAT_COLOR', 'POINT')
            flat = []
            for c in self.colors: flat.extend(c if c is not None else (1.0, 1.0, 1.0, 1.0))
            ca.data.foreach_set('color', flat)
            mesh.color_attributes.active_color = ca
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

CUTTERS = []
def cut(obj, geos, mat='Recess', name='Cutter', first=False):
    """EXACT boolean-subtract a list of (disjoint, parallel) box geometries from `obj`. Cut faces take
    `mat`. `first=True` puts the cut before the bevel so the new edges get bevelled (interior fillets);
    otherwise it runs after the bevel, so a 0.5 m hull bevel is not clamped by 4 cm seams."""
    b = Batch(name)
    for g in geos: b.add(g, mat)
    cutter = b.build(); OBJECTS.remove(cutter)
    cutter.hide_render = True; cutter.hide_viewport = True; cutter.display_type = 'WIRE'
    CUTTERS.append(cutter)
    mod = obj.modifiers.new(name, 'BOOLEAN')
    mod.operation = 'DIFFERENCE'; mod.solver = 'EXACT'; mod.object = cutter; mod.material_mode = 'TRANSFER'
    if first:
        with bpy.context.temp_override(object=obj):
            bpy.ops.object.modifier_move_to_index(modifier=mod.name, index=0)
    return obj

def drop_cutters():
    for c in CUTTERS:
        bpy.data.objects.remove(c, do_unlink=True)
    CUTTERS.clear()

def clean_normals(obj, angle=40.0):
    """After booleans: sharp edges by angle, everything else smooth, and area-weighted normals so the
    big plates stay flat while the bevels still catch light."""
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
        try: bpy.ops.mesh.customdata_custom_splitnormals_clear()
        except Exception: pass
    bm = bmesh.new(); bm.from_mesh(obj.data)
    limit = math.radians(angle)
    for f in bm.faces: f.smooth = True
    for e in bm.edges:
        e.smooth = e.is_manifold and e.calc_face_angle(0.0) < limit
    bm.to_mesh(obj.data); bm.free()
    wn = obj.modifiers.new('WeightedNormal', 'WEIGHTED_NORMAL')
    wn.keep_sharp = True; wn.mode = 'FACE_AREA'; wn.weight = 50
    return obj

def shade_plates(obj, cell=5.0, mats=('Hull', 'HullMid', 'HullDark'), weights=(0.58, 0.27, 0.15), seed=1):
    """Hash each face of material mats[0] to a plate cell and pick one of the three hull shades."""
    mesh = obj.data
    idx = {}
    for m in mats:
        if MATS[m] not in list(mesh.materials): mesh.materials.append(MATS[m])
        idx[m] = list(mesh.materials).index(MATS[m])
    base = idx[mats[0]]
    for p in mesh.polygons:
        if p.material_index != base: continue
        c = p.center
        key = (math.floor(c.x / cell + 0.013), math.floor(c.y / cell + 0.017), math.floor(c.z / cell + 0.011), seed)
        r = (hash(key) & 0xffff) / 65536.0
        acc = 0.0
        for m, w in zip(mats, weights):
            acc += w
            if r < acc: p.material_index = idx[m]; break

def face_grooves(lo, hi, axis, sign, u_pos, v_pos, w=0.05, d=0.04, major=(), major_w=0.14):
    """Groove boxes on the face of AABB [lo, hi] whose outward normal is +/-axis. Returns three lists
    keyed by the groove's long axis (0/1/2) so parallel grooves never overlap inside one cutter."""
    u, v = [a for a in (0, 1, 2) if a != axis]
    f = hi[axis] if sign > 0 else lo[axis]
    out = {0: [], 1: [], 2: []}
    def groove(long_axis, across_axis, p):
        size = [0, 0, 0]; c = [0, 0, 0]
        size[axis] = 2 * d; c[axis] = f
        size[long_axis] = hi[long_axis] - lo[long_axis] + 0.3; c[long_axis] = (lo[long_axis] + hi[long_axis]) / 2
        size[across_axis] = major_w if p in major else w; c[across_axis] = p
        out[long_axis].append(box_geo(*size, place(c)))
    for p in v_pos: groove(u, v, p)      # runs along u at v = p
    for p in u_pos: groove(v, u, p)      # runs along v at u = p
    return out

def merge_grooves(*dicts):
    out = {0: [], 1: [], 2: []}
    for d in dicts:
        for k in out: out[k].extend(d[k])
    return out

def grooved_tube(batch, R, length, segs, M, plate, gw, gd, trim_test=None, shades=('Hull', 'HullMid', 'HullDark'), weights=(0.6, 0.25, 0.15)):
    """Cylinder along local Z made of plate bands separated by recessed seams; each band gets one of the
    hull shades, faces passing trim_test(direction) get the dark Trim band. Seam faces are 'Recess'."""
    n = max(1, int(round(length / plate))); plate = length / n
    prof = [(R, -length / 2, 'plate')]
    for k in range(1, n):
        g = -length / 2 + k * plate
        prof += [(R, g - gw / 2, 'wall'), (R - gd, g - gw / 2, 'floor'), (R - gd, g + gw / 2, 'wall'), (R, g + gw / 2, 'plate')]
    prof.append((R, length / 2, 'end'))
    verts, faces, smooth, mats = [], [], [], []
    for r, z, _ in prof:
        for i in range(segs):
            a = TAU * i / segs
            verts.append(M @ Vector((r * math.cos(a), r * math.sin(a), z)))
    band_mat = None
    for k in range(len(prof) - 1):
        kind = prof[k][2]
        if kind == 'plate':
            r = RNG.random(); acc = 0.0; band_mat = shades[-1]
            for m, w in zip(shades, weights):
                acc += w
                if r < acc: band_mat = m; break
        a, b = k * segs, (k + 1) * segs
        for i in range(segs):
            j = (i + 1) % segs
            faces.append((a + i, a + j, b + j, b + i)); smooth.append(True)
            if kind == 'plate':
                am = TAU * (i + 0.5) / segs
                d = M.to_3x3() @ Vector((math.cos(am), math.sin(am), 0))
                mats.append('Trim' if (trim_test and trim_test(d)) else band_mat)
            else:
                mats.append('Recess')
    faces.append(tuple(reversed(range(segs)))); smooth.append(False); mats.append(shades[0])
    last = (len(prof) - 1) * segs
    faces.append(tuple(range(last, last + segs))); smooth.append(False); mats.append(shades[0])
    batch.add_multi(verts, faces, smooth, mats)

def hatch(batch, M, size=1.4, bolts=6, mat='HullDark'):
    """Raised access hatch with a bolt ring and a recessed grab handle; M: local +Z = surface normal."""
    batch.add(box_geo(size, size, 0.08, M @ Matrix.Translation((0, 0, 0.04))), mat)
    batch.add(box_geo(size - 0.5, size - 0.5, 0.03, M @ Matrix.Translation((0, 0, 0.095))), 'Recess')
    batch.add(box_geo(0.36, 0.1, 0.06, M @ Matrix.Translation((0, 0, 0.11))), 'Metal')
    for k in range(bolts):
        a = TAU * (k + 0.5) / bolts; rr = size / 2 - 0.13
        batch.add(cyl_geo(0.05, 0.05, 0.05, 4, M @ Matrix.Translation((rr * math.cos(a), rr * math.sin(a), 0.1))), 'Metal')

def bolt_ring(batch, M, radius, count, z=0.0, r=0.06):
    for k in range(count):
        a = TAU * (k + 0.5) / count
        batch.add(cyl_geo(r, r, 0.06, 4, M @ Matrix.Translation((radius * math.cos(a), radius * math.sin(a), z))), 'Metal')

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
    wayfinding = name.startswith(('Sign_Service_', 'Sign_Warehouse_', 'Sign_Freight',
                                 'Sign_Hub', 'Sign_Transit', 'Sign_Wayfinding_'))
    obj.data.materials.append(MATS['WayfindingInk' if wayfinding else mat])
    obj.matrix_world = Matrix.Translation(Vector(loc)) @ R
    select_only([obj]); bpy.ops.object.convert(target='MESH')
    obj = bpy.context.view_layer.objects.active
    if wayfinding:
        # Fit the sign in its own local plane: the backing stays behind the
        # lettering on either wall and shares two batched materials throughout.
        corners = [Vector(corner) for corner in obj.bound_box]
        x0, x1 = min(c.x for c in corners), max(c.x for c in corners)
        y0, y1 = min(c.y for c in corners), max(c.y for c in corners)
        padding = size * .25
        width, height = x1 - x0 + padding * 2, y1 - y0 + padding * 2
        centre = ((x0 + x1) / 2, (y0 + y1) / 2, -.055)
        sign_backplates.add(box_geo(width, height, .08,
                            obj.matrix_world @ place(centre)), 'ServiceTeal')
        sign_backplates.add(box_geo(.045, height, .016,
                            obj.matrix_world @ place((x0 - padding + .0225, centre[1], -.008))), 'ServiceOchre')
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
PAD = Vector((0.0, (HY0 + HY1) / 2, DECK_TOP))
HOVER = 3.2                                                  # ship hover height used by navigation.js

# ============================================================================= HANGAR HULL
# One manifold shell: exterior box minus the interior clear volume (cut before the bevel, so the
# interior corners get 0.5 m fillets). The deck slab sits in a 0.42 m recess so its top face at
# DECK_TOP is the only surface at that height (no z-fighting with the floor).
hull_parts = []
SHELL_LO = Vector((-OX, OY0, OZ0)); SHELL_HI = Vector((OX, HY1, OZ1))
shell = hero_box('Hull_Shell', (2 * OX, HY1 - OY0, OZ1 - OZ0), (0, (OY0 + HY1) / 2, (OZ0 + OZ1) / 2), 'Hull', 0.5)
cut(shell, [box_geo(2 * HX + 0.04, HY1 + 6.0 - HY0, HZ1 - (HZ0 - 0.42), place((0, (HY0 + HY1 + 6.0) / 2, (HZ0 - 0.42 + HZ1) / 2)))], 'Hull', 'Interior', first=True)
if DETAIL:
    # Panel seams: 5 x 6 m plates on the roof and floor, 6 m bays on the flanks, one wider expansion
    # joint ringing the block at y = -4. Interior wall/back-wall panels get the same treatment.
    top = face_grooves(SHELL_LO, SHELL_HI, 2, +1, [x for x in range(-20, 21, 5)], [y for y in range(-22, 21, 6)] + [-4.0], major=(-4.0,))
    bottom = face_grooves(SHELL_LO, SHELL_HI, 2, -1, [-15, 0, 15], [y for y in range(-22, 21, 6)] + [-4.0], major=(-4.0,))
    sides = merge_grooves(*[face_grooves(SHELL_LO, SHELL_HI, 0, sgn, [y for y in range(-24, 13, 6)] + [-4.0], [-3.0, 3.5], major=(-4.0,)) for sgn in (-1, 1)])
    back = face_grooves(SHELL_LO, SHELL_HI, 1, -1, [-21, -7, 7, 21], [-3.0, 3.5])
    inner_lo, inner_hi = Vector((-HX, HY0, HZ0 - 0.42)), Vector((HX, HY1, HZ1))
    walls = merge_grooves(*[face_grooves(inner_lo, inner_hi, 0, sgn, [y for y in range(-20, 17, 6)], [HZ0 + 1.2, HZ0 + 3.2, HZ0 + 6.4, HZ0 + 9.6, HZ0 + 12.8]) for sgn in (1, -1)])
    innerback = face_grooves(inner_lo, inner_hi, 1, +1, [-15, -5, 5, 15], [HZ0 + 1.2, HZ0 + 3.2, HZ0 + 6.4, HZ0 + 9.6, HZ0 + 12.8])
    grooves = merge_grooves(top, bottom, sides, back, walls, innerback)
    for axis in (0, 1, 2):
        if grooves[axis]: cut(shell, grooves[axis], 'Recess', f'Seams{axis}')
    # Ceiling light coffers between the structural beams (5 lanes x 7 bays).
    COFFERS = [(x, y) for x in (-14.0, -7.0, 0.0, 7.0, 14.0) for y in (-19.0, -13.0, -7.0, -1.0, 5.0, 11.0, 17.0)]
    cut(shell, [box_geo(1.9, 4.6, 0.8, place((x, y, HZ1))) for x, y in COFFERS], 'Recess', 'Coffers')
hull_parts.append(shell)
# Door frame lip: a thick collar around the opening face.
hull_parts.append(hero_box('Hull_Lintel', (2 * OX + 2, 2.4, OZ1 - HZ1 + 0.6), (0, HY1 - 1.2, (HZ1 + OZ1) / 2 + 0.3), 'HullPanel', 0.3))
hull_parts.append(hero_box('Hull_Sill', (2 * OX + 2, 2.4, HZ0 - OZ0 + 0.6), (0, HY1 - 1.2, (OZ0 + HZ0) / 2 - 0.3), 'HullPanel', 0.3))
for s in (-1, 1):
    hull_parts.append(hero_box(f'Hull_Jamb{s}', (WALL + 1.2, 2.4, OZ1 - OZ0 + 1.2), (s * (HX + WALL / 2 + 0.3), HY1 - 1.2, (OZ0 + OZ1) / 2), 'HullPanel', 0.3))
# Spine pylons and the main spine.
for x in (-16, 16):
    hull_parts.append(hero_box(f'Pylon{x}', (7, 12, 3.0), (x, -4, OZ1 + 1.4), 'HullPanel', 0.3))
if DETAIL:
    # Plate spine: 3.2 m bands with recessed seams, three shades, a dark polymer trim band on both flanks.
    spine_batch = Batch('Spine')
    grooved_tube(spine_batch, SPINE_R, 2 * SPINE_X, 36, place((0, 0, SPINE_Z), rot(0, math.pi / 2, 0)), 4.0, 0.06, 0.05,
                 trim_test=lambda d: abs(d.y) > 0.975)
    hull_parts.append(spine_batch.build())
else:
    hull_parts.append(hero_cylinder('Spine', SPINE_R, 2 * SPINE_X, (0, 0, SPINE_Z), 'Hull', segs=64, bevel=0.6))
# Spine ribs (thicker collars) every 8 m, with bolt rings.
rib_batch = Batch('SpineRibs')
if DETAIL:
    for i in range(-7, 8):
        x = i * 8.0
        Mr = place((x, 0, SPINE_Z), rot(0, math.pi / 2, 0))
        rib_batch.add(cyl_geo(SPINE_R + 0.45, SPINE_R + 0.45, 1.1, 36, Mr), 'HullDark')
        bolt_ring(rib_batch, Mr, SPINE_R + 0.45, 8, 0.0, 0.08)
    # Service runs along the spine: two cable trays and two pipe bundles with clamps.
    for a in (0.5, 3.6):
        R = place((0, 0, SPINE_Z)) @ rot(a, 0, 0) @ Matrix.Translation((0, 0, SPINE_R))
        rib_batch.add(box_geo(2 * SPINE_X - 2, 0.9, 0.12, R @ Matrix.Translation((0, 0, 0.06))), 'Gunmetal')
        for dy in (-0.42, 0.42):
            rib_batch.add(box_geo(2 * SPINE_X - 2, 0.06, 0.34, R @ Matrix.Translation((0, dy, 0.17))), 'Gunmetal')
        for k in range(-7, 8):
            rib_batch.add(box_geo(0.2, 0.96, 0.4, R @ Matrix.Translation((k * 8.0 + 4.0, 0, 0.2))), 'Metal')
        for k in range(-7, 8):  # bundled cables lying in the tray
            rib_batch.add(cyl_geo(0.07, 0.07, 7.6, 6, R @ Matrix.Translation((k * 8.0 + 1.0, -0.15 + 0.1 * (k % 3), 0.2)) @ rot(0, math.pi / 2, 0), caps=False), 'Rubber')
    for a in (1.9, 5.0):
        R = place((0, 0, SPINE_Z)) @ rot(a, 0, 0) @ Matrix.Translation((0, 0, SPINE_R))
        for dy, r in ((-0.36, 0.16), (0.0, 0.22), (0.36, 0.16)):
            rib_batch.add(cyl_geo(r, r, 2 * SPINE_X - 4, 8, R @ Matrix.Translation((0, dy, 0.28)) @ rot(0, math.pi / 2, 0), caps=False), 'Metal')
        for k in range(-7, 8):
            rib_batch.add(box_geo(0.3, 1.1, 0.52, R @ Matrix.Translation((k * 8.0, 0, 0.26))), 'Gunmetal')
    # Mint brand stripe along the spine flanks, just above the trim band.
    for a in (1.15, 4.3):
        R = rot(a, 0, 0)
        rib_batch.add(box_geo(2 * SPINE_X - 10, 0.5, 0.25, place((0, 0, SPINE_Z)) @ R @ Matrix.Translation((0, 0, SPINE_R + 0.1))), 'MintStrip')
rib_batch.build() if rib_batch.faces else None
HULL = join(hull_parts, 'Hull')
drop_cutters()
if DETAIL:
    shade_plates(HULL, 5.0)
    clean_normals(HULL, 40.0)

# ============================================================================= HANGAR EXTERIOR DETAIL
ext = Batch('HullDetail')
greeb = Batch('HullGreebles')     # hatches, bolt rings, masts (colliders; all outside the bay)
decals = Batch('HullDecals')      # wear: vertex-coloured patches in the hull material, 2.5 cm proud
def plate_material(point, normal):
    """Material of the hull plate under a decal, so the decal's clean rim matches its plate shade."""
    inv = HULL.matrix_world.inverted()
    origin = inv @ (Vector(point) + Vector(normal) * 0.5)
    direction = (inv.to_3x3() @ (-Vector(normal))).normalized()
    hit, _, _, face = HULL.ray_cast(origin, direction, distance=2.0)
    if not hit: return 'Hull'
    name = HULL.data.materials[HULL.data.polygons[face].material_index].name
    return name if name in ('Hull', 'HullMid', 'HullDark', 'HullPanel') else 'Hull'
if DETAIL:
    for s in (-1, 1):
        # Mint accent band along the side at deck height.
        ext.add(box_geo(0.22, HY1 - OY0 - 6, 0.7, place((s * (OX + 0.05), (OY0 + HY1) / 2 - 1, -6.0))), 'MintStrip')
        # Approach lights: red to port (-X), green to starboard (+X) on the jambs.
        for z in (OZ0 + 1.5, (OZ0 + OZ1) / 2, OZ1 - 1.5):
            ext.add(sphere_geo(0.35, 12, 6, place((s * (OX + 0.7), HY1 + 0.6, z))), 'NavLight_Red' if s < 0 else 'NavLight_Green')
        # Access hatches on the flanks (between seams, clear of the sign, windows and vents).
        for y, z in ((-21.0, -0.5), (15.0, -0.5), (-9.0, -9.5), (9.0, -9.5)):
            hatch(greeb, decal_frame((s * OX, y, z), (s, 0, 0), (0, 0, 1), 0.0))
        # Vent streaks: dark deposits trailing planet-ward (-Z) from the flank vents.
        for y in (-16, -4, 8):
            g, c = streak_geo(3.2, 4.6, decal_frame((s * OX, y, 2.85), (s, 0, 0), (0, 0, -1)), 0.5)
            decals.add(g, plate_material((s * OX, y, 1.0), (s, 0, 0)), c)
    # Roof and floor hatches.
    for x, y in ((-12.5, -25.0), (7.5, -25.0), (-2.5, -7.0), (12.5, -1.0), (-17.5, 5.0), (7.5, 11.0)):
        hatch(greeb, decal_frame((x, y, OZ1), (0, 0, 1), (0, 1, 0), 0.0))
    for x, y in ((-12.0, -20.0), (12.0, -20.0), (-6.0, 8.0), (6.0, 8.0), (0.0, -4.0 + 3.0)):
        hatch(greeb, decal_frame((x, y, OZ0), (0, 0, -1), (0, 1, 0), 0.0), 1.6, 8)
    # Roof tanks and pipework.
    for x, y in ((-20, -18), (20, -18), (-20, 12), (20, 12)):
        ext.add(sphere_geo(2.6, 24, 12, place((x, y, OZ1 + 2.8))), 'Hull')
        ext.add(cyl_geo(2.7, 2.7, 0.5, 24, place((x, y, OZ1 + 2.8))), 'Gunmetal')
        ext.add(cyl_geo(0.6, 0.6, 1.6, 12, place((x, y, OZ1 + 0.8))), 'Gunmetal')
        for k in range(4):  # tank saddle straps
            ext.add(box_geo(0.5, 0.5, 1.0, place((x + 1.9 * math.cos(TAU * k / 4), y + 1.9 * math.sin(TAU * k / 4), OZ1 + 0.5))), 'Gunmetal')
    for x in (-20, 20):
        ext.add(cyl_geo(0.32, 0.32, 30, 12, place((x, -3, OZ1 + 0.5), rot(math.pi / 2, 0, 0))), 'Metal')
        for k in range(-3, 4):
            ext.add(box_geo(0.9, 0.4, 0.7, place((x, -3 + k * 4.5, OZ1 + 0.35))), 'Gunmetal')
    for y in (-18, 12):
        ext.add(cyl_geo(0.32, 0.32, 40, 12, place((0, y, OZ1 + 0.5), rot(0, math.pi / 2, 0))), 'Metal')
        for k in range(-4, 5):
            ext.add(box_geo(0.4, 0.9, 0.7, place((k * 4.5, y, OZ1 + 0.35))), 'Gunmetal')
    # Greeble crates and vents on the roof and flanks, with stains trailing aft of the roof vents.
    for i, (x, y) in enumerate([(-8, -22), (8, -22), (-12, 4), (12, 4), (0, -12), (-4, 16), (4, 16)]):
        ext.add(box_geo(3 + i % 2, 2.2, 1.4, place((x, y, OZ1 + 0.7))), 'HullPanel')
        ext.add(box_geo(2.2, 1.6, 0.3, place((x, y, OZ1 + 1.55))), 'Gunmetal')
        for k in range(3):
            ext.add(box_geo(2.0, 0.22, 0.12, place((x, y - 0.5 + k * 0.5, OZ1 + 1.72))), 'Recess')
        if y - 1.1 - 3.5 > OY0 + 0.5:
            g, c = streak_geo(2.4, 3.5, decal_frame((x, y - 1.15, OZ1), (0, 0, 1), (0, -1, 0)), 0.55)
            decals.add(g, plate_material((x, y - 2.5, OZ1), (0, 0, 1)), c)
    for s in (-1, 1):
        for y in (-16, -4, 8):
            ext.add(box_geo(0.9, 4.0, 2.2, place((s * (OX + 0.45), y, 4.0))), 'Gunmetal')
            for k in range(4):
                ext.add(box_geo(1.0, 0.25, 1.8, place((s * (OX + 0.5), y - 1.5 + k, 4.0))), 'HullPanel')
    # RCS thruster quads at the four roof corners, with scorch fans where a nozzle fires across the roof.
    for x, y in ((-OX + 1, OY0 + 1), (OX - 1, OY0 + 1), (-OX + 1, HY1 - 1), (OX - 1, HY1 - 1)):
        ext.add(box_geo(2.4, 2.4, 0.5, place((x, y, OZ1 + 0.25))), 'HullDark')
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            a = math.atan2(dy, dx)
            ext.add(cyl_geo(0.18, 0.42, 0.7, 10, place((x + dx * 0.9, y + dy * 0.9, OZ1 + 0.6), rot(0, math.pi / 2, a))), 'Gunmetal')
            cx, cy = x + dx * 2.4, y + dy * 2.4
            if -OX + 0.8 < cx < OX - 0.8 and OY0 + 0.8 < cy < HY1 - 0.8:
                g, c = fan_geo(1.7, 1.05, 14, decal_frame((cx, cy, OZ1), (0, 0, 1), (dx, dy, 0)) @ rot(0, 0, -math.pi / 2), 0.16)
                decals.add(g, plate_material((cx, cy, OZ1), (0, 0, 1)), c)
    # Roof comms mast: tube, cross arms, blade and a small dish.
    mx, my = 8.0, -24.0
    greeb.add(cyl_geo(0.55, 0.55, 0.4, 16, place((mx, my, OZ1 + 0.2))), 'Gunmetal')
    greeb.add(cyl_geo(0.22, 0.18, 6.6, 10, place((mx, my, OZ1 + 3.5))), 'Metal')
    for z, L in ((OZ1 + 4.4, 2.6), (OZ1 + 5.6, 1.8)):
        greeb.add(box_geo(L, 0.1, 0.1, place((mx, my, z))), 'Metal')
        for e in (-1, 1):
            greeb.add(cyl_geo(0.04, 0.04, 1.4, 4, place((mx + e * L / 2, my, z + 0.7))), 'Metal')
    greeb.add(box_geo(0.08, 0.9, 1.6, place((mx, my, OZ1 + 7.4))), 'HullDark')
    greeb.add(sphere_geo(0.16, 8, 4, place((mx, my, OZ1 + 8.3))), 'NavLight_Red')
    # Door rails, end posts and diagonal braces (doors slide onto them when open).
    rail_x = DOOR_W + DOOR_SLIDE + 1.5
    for z, h in ((DOOR_Z + DOOR_H / 2 + 0.45, 0.7), (DOOR_Z - DOOR_H / 2 - 0.45, 0.7)):
        ext.add(box_geo(2 * rail_x, DOOR_T + 0.6, h, place((0, DOOR_Y, z))), 'Gunmetal')
        ext.add(box_geo(2 * rail_x - 0.4, 0.12, 0.2, place((0, DOOR_Y + DOOR_T / 2 + 0.36, z))), 'Metal')
    for s in (-1, 1):
        ext.add(box_geo(1.0, DOOR_T + 0.8, DOOR_H + 2.0, place((s * rail_x, DOOR_Y, DOOR_Z))), 'Gunmetal')
        for z in (DOOR_Z + DOOR_H / 2 + 0.45, DOOR_Z - DOOR_H / 2 - 0.45):
            ext.add(strut_geo((s * OX, HY1 - 3, z), (s * rail_x, DOOR_Y - 0.4, z), 0.28), 'Metal')
            ext.add(strut_geo((s * OX, HY1 - 10, z), (s * rail_x, DOOR_Y - 0.4, z), 0.22), 'Metal')
        ext.add(strut_geo((s * OX, HY1 - 6, (OZ0 + OZ1) / 2), (s * rail_x, DOOR_Y - 0.4, DOOR_Z), 0.22), 'Metal')
    # Runway-style approach lights along the sill (mint).
    for x in range(-20, 21, 4):
        ext.add(sphere_geo(0.22, 10, 5, place((x, HY1 + 0.9, OZ0 + 0.3))), 'Mint')
else:
    for x, y in ((-20, -18), (20, -18), (-20, 12), (20, 12)):
        ext.add(sphere_geo(2.6, 12, 6, place((x, y, OZ1 + 2.8))), 'Hull')
    rail_x = DOOR_W + DOOR_SLIDE + 1.5
    for z in (DOOR_Z + DOOR_H / 2 + 0.45, DOOR_Z - DOOR_H / 2 - 0.45):
        ext.add(box_geo(2 * rail_x, DOOR_T + 0.6, 0.7, place((0, DOOR_Y, z))), 'Gunmetal')
# Mint frame around the hangar mouth on the lintel, sill and jambs (also in the LOD).
ext.add(box_geo(2 * OX + 1.6, 0.06, 0.35, place((0, HY1 + 0.03, 9.2))), 'MintStrip')
ext.add(box_geo(2 * OX + 1.6, 0.06, 0.35, place((0, HY1 + 0.03, -11.05))), 'MintStrip')
for s in (-1, 1):
    ext.add(box_geo(0.35, 0.06, 20.6, place((s * 24.9, HY1 + 0.03, -0.925))), 'MintStrip')
ext.build()
if greeb.faces: greeb.build()
if decals.faces: decals.build()

# Signage.
if DETAIL:
    text_mesh('Sign_Front', 'AEON / FREIGHT', 1.25, (0, HY1 + 0.08, (HZ1 + OZ1) / 2 + 0.35), rot(math.pi / 2, 0, math.pi), 'Mint')
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
                truss.add(strut_geo((x + side_x, y0, SPINE_Z - half * flip), (x + side_x, y1, SPINE_Z + half * flip), 0.12, 4), 'Truss')
            for side_z in (-half, half):
                truss.add(strut_geo((x - half, y0, SPINE_Z + side_z), (x + half, y1, SPINE_Z + side_z), 0.12, 4), 'Truss')
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
        truss.add(box_geo(0.16, 7.4, 13.0, place((x, y, SPINE_Z - 10.5))), 'Radiator')
        truss.add(box_geo(0.6, 7.8, 0.6, place((x, y, SPINE_Z - 4.0))), 'Gunmetal')
        truss.add(cyl_geo(0.5, 0.5, 4.0, 10, place((x, y, SPINE_Z - 3.0))), 'Gunmetal')
        if DETAIL:
            # Coolant fins across the panel and header pipes top and bottom.
            for f in range(9):
                truss.add(box_geo(0.9, 0.05, 12.4, place((x, y - 3.4 + f * 0.85, SPINE_Z - 10.5))), 'Radiator')
            for z in (SPINE_Z - 4.4, SPINE_Z - 16.8):
                truss.add(cyl_geo(0.18, 0.18, 7.6, 8, place((x, y, z), rot(math.pi / 2, 0, 0))), 'Metal')
    # Navigation light at truss tips.
    for e in (-1, 1):
        truss.add(sphere_geo(0.5, 12, 6, place((x, e * (TRUSS_Y + 0.3), SPINE_Z))), 'NavLight_Red' if s < 0 else 'NavLight_Green')
truss.build(); solar.build()

# ============================================================================= END MODULES
ends = Batch('EndModules')
# +X: docking node with an androgynous ring and a tapered nose.
dock = place((SPINE_X, 0, SPINE_Z), rot(0, math.pi / 2, 0))
ends.add(lathe_geo([(0, -0.5), (SPINE_R + 0.9, -0.5), (SPINE_R + 0.9, 3.0), (SPINE_R - 0.4, 4.5), (SPINE_R - 0.4, 7.0), (2.6, 9.0), (2.6, 10.5), (0, 10.5)], 48 if DETAIL else 16, dock), 'HullPanel')
ends.add(torus_geo(2.9, 0.45, 32 if DETAIL else 12, 8 if DETAIL else 4, dock @ Matrix.Translation((0, 0, 10.6))), 'Gunmetal')
# Docking ring accents: mint strips on the collar and nose, a ring of lamp housings, bolt ring.
ends.add(cyl_geo(SPINE_R + 0.96, SPINE_R + 0.96, 0.35, 48 if DETAIL else 16, dock @ Matrix.Translation((0, 0, 1.6)), caps=False), 'MintStrip')
ends.add(cyl_geo(2.66, 2.66, 0.25, 32 if DETAIL else 12, dock @ Matrix.Translation((0, 0, 9.8)), caps=False), 'MintStrip')
if DETAIL:
    ends.add(cyl_geo(SPINE_R - 0.34, SPINE_R - 0.34, 0.2, 48, dock @ Matrix.Translation((0, 0, 5.75)), caps=False), 'Trim')
    for k in range(12):
        a = TAU * k / 12
        Mk = dock @ rot(0, 0, a) @ Matrix.Translation((SPINE_R - 0.4, 0, 5.75))
        ends.add(box_geo(0.5, 0.5, 0.55, Mk @ Matrix.Translation((0.15, 0, 0))), 'Gunmetal')
        ends.add(box_geo(0.12, 0.3, 0.32, Mk @ Matrix.Translation((0.41, 0, 0))), 'MintStrip')
    bolt_ring(ends, dock, SPINE_R + 0.9, 16, 2.6, 0.07)
    bolt_ring(ends, dock, SPINE_R + 0.9, 16, -0.2, 0.07)
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
if DETAIL:
    # Antenna cluster on the comms module: base plate, three whips, a small tracking dish, mint markers.
    ax = -SPINE_X + 1.5
    ends.add(cyl_geo(1.3, 1.3, 0.3, 16, place((ax, 0, SPINE_Z + SPINE_R + 0.75))), 'Gunmetal')
    for k, (dx, dy, L) in enumerate(((0.0, 0.0, 5.5), (0.7, 0.6, 3.8), (-0.6, -0.7, 4.6))):
        top = SPINE_Z + SPINE_R + 0.9 + L
        ends.add(strut_geo((ax + dx, dy, SPINE_Z + SPINE_R + 0.9), (ax + dx * 1.8, dy * 1.8, top), 0.05, 4), 'Metal')
        ends.add(sphere_geo(0.1, 6, 3, place((ax + dx * 1.8, dy * 1.8, top))), 'MintStrip' if k else 'NavLight_Red')
    ends.add(cyl_geo(0.12, 0.12, 2.0, 6, place((ax + 1.6, -1.2, SPINE_Z + SPINE_R + 1.8))), 'Metal')
    ends.add(lathe_geo([(0, 0), (0.5, 0.05), (1.0, 0.25), (1.0, 0.0)], 20, place((ax + 1.6, -1.2, SPINE_Z + SPINE_R + 2.9), rot(math.radians(-40), math.radians(35), 0))), 'Radiator')
    ends.add(cyl_geo(SPINE_R + 0.66, SPINE_R + 0.66, 0.3, 48, comm @ Matrix.Translation((0, 0, 1.2)), caps=False), 'MintStrip')
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
segs = 36 if DETAIL else 16
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
            labs.add(box_geo(1.2, 0.08, 0.08, place((LAB_X + k * 3.0, e * 8.0, LAB_Z + LAB_R + 0.25))), 'Metal')
            labs.add(cyl_geo(0.05, 0.05, 0.3, 6, place((LAB_X + k * 3.0 - 0.5, e * 8.0, LAB_Z + LAB_R + 0.1))), 'Metal')
            labs.add(cyl_geo(0.05, 0.05, 0.3, 6, place((LAB_X + k * 3.0 + 0.5, e * 8.0, LAB_Z + LAB_R + 0.1))), 'Metal')
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
DECK = hero_box('LandingDeck', (2 * HX, HY1 - HY0, 0.4), (0, (HY0 + HY1) / 2, DECK_TOP - 0.2), 'Deck', 0.0)
if DETAIL:
    # 2 m deck plates: a dark sub-floor 3 cm below the plate tops with a 5 cm seam between plates, in two
    # plate tones. One material (station.js/tests need a single-primitive mesh 42 x 0.4 x 48 with its top
    # at DECK_TOP); the sub-floor darkness and the plate tones ride in a 'Tint' attribute that the AO
    # bake multiplies into COLOR_0.
    DECK.data.transform(Matrix.Scale(0.37 / 0.4, 4, (0, 0, 1)) @ Matrix.Translation((0, 0, -0.015 / (0.37 / 0.4))))
    plates = Batch('LandingDeckPlates')
    # The 2 m grid is offset by 0.5 m so seams fall on x = ±0.5 + 2k / y = 0.5 + 2k: the walkable
    # regression ray at (17, 12) and the pad centre land on plate tops, never in a seam.
    for i in range(23):
        for j in range(26):
            x0, y0 = -HX - 1.5 + i * 2.0, HY0 - 1.5 + j * 2.0
            xa, xb = max(x0 + 0.025, -HX + 0.025), min(x0 + 1.975, HX - 0.025)
            ya, yb = max(y0 + 0.025, HY0 + 0.025), min(y0 + 1.975, HY1 - 0.025)
            if xb - xa < 0.2 or yb - ya < 0.2: continue
            verts = [Vector((xa, ya, DECK_TOP)), Vector((xb, ya, DECK_TOP)), Vector((xb, yb, DECK_TOP)), Vector((xa, yb, DECK_TOP))]
            plates.add((verts, [(0, 1, 2, 3)], [False]), 'Deck')
    DECK = join([DECK, plates.build()], 'LandingDeck')
    tint = DECK.data.color_attributes.new('Tint', 'FLOAT_COLOR', 'CORNER')
    vals = []
    for poly in DECK.data.polygons:
        c = poly.center
        if c.z < DECK_TOP - 0.005: t = 0.30
        else:
            r = (hash((math.floor(c.x / 2.0), math.floor(c.y / 2.0), 5)) & 0xffff) / 65536.0
            t = 0.84 if r < 0.3 else 1.0
        vals.extend([t, t, t, 1.0] * len(poly.loop_indices))
    tint.data.foreach_set('color', vals)
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
# Ceiling light bars: recessed fixtures inside the coffers cut into the ceiling (one per bay), with a
# gunmetal reflector frame; the LOD keeps the old flush bars.
if DETAIL:
    for x, y in COFFERS:
        interior.add(box_geo(1.5, 4.2, 0.06, place((x, y, HZ1 + 0.37))), 'Gunmetal')
        lights.add(box_geo(1.1, 3.8, 0.08, place((x, y, HZ1 + 0.30))), 'HangarLight')
else:
    for x in (-14.0, -7.0, 0.0, 7.0, 14.0):
        lights.add(box_geo(1.0, HY1 - HY0 - 7, 0.16, place((x, (HY0 + HY1) / 2 - 1, HZ1 - 0.1))), 'HangarLight')
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
    interior.add(box_geo(0.08, HY1 - HY0 - 3, 0.08, place((xw - s * 1.8, (HY0 + HY1) / 2 - 1.5, zc + 1.1))), 'Metal')
    if DETAIL:
        # Handrail posts, mid rail, kickplate and grating ribs on the catwalk; EVA grab rails on the wall.
        for y in range(int(HY0) + 2, int(HY1) - 2, 3):
            interior.add(cyl_geo(0.04, 0.04, 1.1, 6, place((xw - s * 1.8, y, zc + 0.55))), 'Metal')
        interior.add(box_geo(0.05, HY1 - HY0 - 3, 0.05, place((xw - s * 1.8, (HY0 + HY1) / 2 - 1.5, zc + 0.55))), 'Metal')
        interior.add(box_geo(0.04, HY1 - HY0 - 3, 0.16, place((xw - s * 1.78, (HY0 + HY1) / 2 - 1.5, zc + 0.17))), 'HullDark')
        for y in (-17, -11, -5, 1, 7, 13, 19):
            interior.add(cyl_geo(0.04, 0.04, 1.4, 6, place((xw - s * 0.16, y, HZ0 + 3.3), rot(math.pi / 2, 0, 0)), caps=False), 'Metal')
            for dy in (-0.6, 0.6):
                interior.add(box_geo(0.16, 0.08, 0.08, place((xw - s * 0.08, y + dy, HZ0 + 3.3))), 'Metal')
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
            # Hose reels stay on the wall; nothing lies across the walking deck.
            interior.add(torus_geo(.62,.085,24,8,place((xw-s*1.47,y-.6,HZ0+1.8),rot(0,math.pi/2,0))),'Rubber')
            interior.add(box_geo(.18,1.45,.18,place((xw-s*1.5,y-.6,HZ0+.85))),'Gunmetal')
    # Tool racks and crates along the walls.
    if DETAIL:
        for k, y in enumerate((-20.0, -8.0, 4.0, 16.0)):
            interior.add(box_geo(2.2, 2.2, 1.6, place((xw - s * 1.9, y, HZ0 + 0.8))), 'Gunmetal' if k % 2 else 'HullPanel')
            interior.add(box_geo(1.6, 1.6, 0.9, place((xw - s * 2.1, y + 0.2, HZ0 + 2.05))), 'HullPanel' if k % 2 else 'Gunmetal')
# Dark kick plate along the foot of the walls.
if DETAIL:
    for s in (-1, 1):
        interior.add(box_geo(0.12, HY1 - HY0, 0.45, place((s * (HX - 0.06), (HY0 + HY1) / 2, HZ0 + 0.225))), 'Trim')
    interior.add(box_geo(2 * HX, 0.12, 0.45, place((0, HY0 + 0.06, HZ0 + 0.225))), 'Trim')
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
# ----------------------------------------------------------------------------- Service architecture and layered detail
# All low furniture stays in the wall-side service lanes (|x| > 17) or aft of the pad.
if DETAIL:
    material('ServiceOchre',(.43,.24,.075),.35,.58)
    material('ServiceTeal',(.045,.15,.18),.35,.55)
    sign_backplates = Batch('Sign_Backplates')
    # Recessed wall panels, service numbers, vents, fasteners and overhead utilities.
    for side in [-1,1]:
        for j,y in enumerate(range(-19,19,6)):
            interior.add(box_geo(.18,4.8,3.2,place((side*20.55,y,HZ0+7.1))),'ServiceTeal')
            interior.add(box_geo(.12,4.3,.18,place((side*20.43,y,HZ0+8.65))),'ServiceOchre')
            for k in range(9):interior.add(box_geo(.16,.18,1.1,place((side*20.40,y-1.8+k*.45,HZ0+7.2))),'Gunmetal')
            for dy in [-2.0,2.0]:
                for z in [HZ0+5.7,HZ0+8.4]:interior.add(cyl_geo(.07,.07,.08,8,place((side*20.3,y+dy,z),rot(0,math.pi/2,0))),'HullPanel')
            text_mesh(f'Sign_Service_{side}_{j}',f'SERVICE {j+1:02d}',.34,(side*20.25,y,HZ0+4.0),rot(math.pi/2,0,-side*math.pi/2),'MintPaint',.005)
        for h in [10.6,11.1,11.6]:
            interior.add(cyl_geo(.16,.16,HY1-HY0-3,12,place((side*19.0,-1,HZ0+h),rot(math.pi/2,0,0))),'ServiceOchre' if h==11.1 else 'Gunmetal')
        for y in range(-22,21,4):interior.add(box_geo(.5,.15,1.6,place((side*19,y,HZ0+11.1))),'Truss')
        # Maintenance benches and tools face into the side aisles.
        for y in [-14,4]:
            interior.add(box_geo(2.5,3.7,.18,place((side*18.6,y,HZ0+1.2))),'Gunmetal')
            for dy in [-1.55,1.55]:interior.add(box_geo(.20,.20,1.2,place((side*18.6,y+dy,HZ0+.6))),'Truss')
            interior.add(box_geo(.20,3.6,1.5,place((side*19.75,y,HZ0+2))),'ServiceTeal')
            for k in range(6):
                interior.add(box_geo(.11,.07,.6,place((side*19.58,y-1.2+k*.45,HZ0+2.1))),'HullPanel')
                interior.add(cyl_geo(.095,.095,.07,10,place((side*19.55,y-1.2+k*.45,HZ0+2.43),rot(0,math.pi/2,0))),'ServiceOchre')
        # Flush deck seams and maintenance-lane markings never create a raised floor.
        for y in range(-22,21,3):lights.add(box_geo(3.0,.025,.005,place((side*16.8,y,DECK_TOP+.004))),'Gunmetal')
        lights.add(box_geo(.04,43,.04,place((side*16.3,-1,DECK_TOP+.022))),'AmberSoft')
    # Layered aft bulkhead: recessed access plates, structural ribs and utility rails.
    for x in range(-18,19,6):
        for h in [6.2,10.0,13.4]:
            interior.add(box_geo(5.65,.13,2.9,place((x,HY0+.43,HZ0+h))),'HullPanel')
            interior.add(box_geo(5.25,.09,.09,place((x,HY0+.55,HZ0+h-1.2))),'Gunmetal')
            for dx in [-2.45,2.45]:
                for dz in [-1.1,1.1]:interior.add(cyl_geo(.065,.065,.06,8,place((x+dx,HY0+.57,HZ0+h+dz),rot(math.pi/2,0,0))),'Gunmetal')
    for x in [-20,-14,-7,7,14,20]:
        interior.add(box_geo(.14,.24,10.6,place((x,HY0+.65,HZ0+10.1))),'Gunmetal')
    # Ceiling coffers, cross-beams and suspended warm service lighting.
    for y in range(-20,23,6):
        interior.add(box_geo(39,.18,.23,place((0,y,HZ1-.45))),'Gunmetal')
        for x in [-15,-8,0,8,15]:
            interior.add(box_geo(5.8,4.9,.06,place((x,y,HZ1-.2))),'HullPanel')
            if x != 0:
                interior.add(box_geo(2.58,.28,.09,place((x,y,HZ1-.49))), 'Gunmetal')
                lights.add(box_geo(2.4,.13,.07,place((x,y,HZ1-.52))), 'HangarLight')
    # Aft warehouse shutters, ribbed storage modules and cargo restraint frames.
    for x in [-17,17]:
        interior.add(box_geo(5.5,.35,5.0,place((x,HY0+1.5,HZ0+2.5))),'ServiceTeal')
        for k in range(13):interior.add(box_geo(5.1,.08,.11,place((x,HY0+1.72,HZ0+.3+k*.35))),'Gunmetal')
        text_mesh(f'Sign_Warehouse_{x}','WAREHOUSE / 10T' if x<0 else 'ENGINEERING',.36,(x,HY0+1.8,HZ0+5.6),rot(math.pi/2,0,math.pi),'MintPaint',.006)
    # Cargo terminal: an angled display, card reader, recessed keyboard and service pedestal.
    interior.add(box_geo(1.7,1.0,1.05,place((-12,-22.5,HZ0+.525))),'ServiceTeal')
    interior.add(box_geo(1.85,.95,.12,place((-12,-22.4,HZ0+1.1))),'Gunmetal')
    interior.add(box_geo(1.85,.18,1.3,place((-12,-22.8,HZ0+1.72))),'Gunmetal')
    for k in range(8):interior.add(box_geo(.12,.13,.025,place((-12.65+k*.18,-22.15,HZ0+1.18))),'HullPanel')
    lights.add(box_geo(.12,.15,.07,place((-11.25,-22.1,HZ0+1.20))),'Amber')
    text_mesh('Sign_Freight','FREIGHT TRANSFER',.42,(-12,-23.5,HZ0+3.6),rot(math.pi/2,0,math.pi),'MintPaint',.005)
    # A real 4 m wide elevator vestibule behind its runtime sliding leaves.
    for side in [-1,1]:
        interior.add(box_geo(.18,3.4,3.3,place((side*2.15,-24,HZ0+1.65))),'HullPanel')
        lights.add(box_geo(.04,2.8,.04,place((side*1.95,-24,HZ0+3.1))),'HangarLight')
    interior.add(box_geo(4.5,.25,.35,place((0,-22.35,HZ0+3.35))),'ServiceOchre')
    interior.add(box_geo(4.4,3.4,.18,place((0,-24,HZ0+3.5))),'Gunmetal')
    text_mesh('Sign_Hub','CENTRAL HUB',.50,(0,-22.16,HZ0+4.15),rot(math.pi/2,0,math.pi),'MintPaint',.006)
    text_mesh('Sign_Transit','ELEVATOR / CONCOURSE',.21,(0,-22.16,HZ0+3.65),rot(math.pi/2,0,math.pi),'MintPaint',.003)
    # Suspended wayfinding and hazard decals, away from the walking capsule.
    for x,label in [(-15,'CARGO  <'),(15,'>  CREW SERVICES')]:
        interior.add(box_geo(7,.25,1.1,place((x,-15,HZ0+12.0))),'ServiceTeal')
        text_mesh(f'Sign_Wayfinding_{x}',label,.40,(x,-14.84,HZ0+12.0),rot(math.pi/2,0,math.pi),'MintPaint',.005)
    sign_backplates.build()
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
                parts.append(hero_box(f'{name}_plate{c}{r}', (pw, DOOR_T * 0.4, ph), (px, DOOR_Y + DOOR_T * 0.1, pz), ('Hull', 'HullMid', 'Hull', 'HullDark')[(c * 3 + r * 2) % 4], 0.18))
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
        det.add(prism_geo(poly, 0.06, place((0, DOOR_Y + DOOR_T * 0.3 + 0.03, 0), rot(math.pi / 2, 0, 0))), 'Amber' if k % 2 == 0 else 'Trim')
    # Edge strip on the meeting face and a lit top edge.
    det.add(box_geo(0.2, DOOR_T * 0.5, DOOR_H - 0.4, place((xc - side * DOOR_W / 2 + side * 0.1, DOOR_Y, DOOR_Z))), 'Amber')
    det.add(box_geo(DOOR_W - 2.0, 0.2, 0.2, place((xc, DOOR_Y + DOOR_T * 0.3 + 0.1, DOOR_Z + DOOR_H / 2 - 0.5))), 'MintStrip')
    det.add(box_geo(0.2, 0.2, DOOR_H - 1.6, place((xc + side * (DOOR_W / 2 - 0.4), DOOR_Y + DOOR_T * 0.3 + 0.1, DOOR_Z))), 'MintStrip')
    if DETAIL:
        # Hydraulic latch housings and rollers.
        for pz in (DOOR_Z - DOOR_H / 2 + 1.5, DOOR_Z, DOOR_Z + DOOR_H / 2 - 1.5):
            det.add(box_geo(1.6, DOOR_T * 0.5, 1.0, place((xc + side * (DOOR_W / 2 - 1.2), DOOR_Y, pz))), 'Gunmetal')
        for k in range(4):
            px = xc - side * DOOR_W / 2 + side * (2.5 + k * (DOOR_W - 5) / 3)
            det.add(cyl_geo(0.45, 0.45, 0.5, 12, place((px, DOOR_Y, DOOR_Z + DOOR_H / 2 + 0.2), rot(0, math.pi / 2, 0))), 'Gunmetal')
            det.add(cyl_geo(0.45, 0.45, 0.5, 12, place((px, DOOR_Y, DOOR_Z - DOOR_H / 2 - 0.2), rot(0, math.pi / 2, 0))), 'Gunmetal')
        # Big painted numeral + brand text.
        # Bay numbers are applied per reusable pod at runtime.
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

# ============================================================================= AMBIENT OCCLUSION BAKE
AO_SKIP = ('SolarArrays', 'DeckMarkings', 'HangarLights', 'DeckNumber', 'Sign_')   # only non-vcol materials
def bake_ao(samples=24, distance=6.0):
    """Cycles AO baked per face corner (so a plate corner sees the whole hemisphere while the seam walls and
    floors next to it do not), remapped and multiplied with any authored 'Tint' into the 'Col' attribute every
    hull material multiplies. Corners that share a split normal are averaged so the exporter does not split
    smooth vertices. Meshes in AO_SKIP use only non-vertex-colour materials and get no colour data (bytes)."""
    import numpy as np
    t = time.time()
    meshes = [o for o in OBJECTS if o.type == 'MESH' and len(o.data.polygons) and 'Col' not in o.data.color_attributes
              and not o.name.startswith(AO_SKIP)]
    for o in meshes:
        ca = o.data.color_attributes.new('AO', 'FLOAT_COLOR', 'CORNER')
        o.data.color_attributes.active_color = ca
    scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = samples
    scene.cycles.use_denoising = False
    scene.render.bake.target = 'VERTEX_COLORS'; scene.render.bake.use_selected_to_active = False
    world = scene.world or bpy.data.worlds.new('Bake'); scene.world = world
    world.light_settings.distance = distance
    doors = [o for o in meshes if o.name.startswith('HangarDoor')]
    for o in doors: o.hide_render = True
    select_only([o for o in meshes if o not in doors])
    bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
    for o in doors: o.hide_render = False
    select_only(doors)
    bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
    for o in meshes:
        mesh = o.data; nl = len(mesh.loops)
        buf = np.empty(nl * 4, dtype=np.float32); mesh.color_attributes['AO'].data.foreach_get('color', buf)
        occ = np.clip(buf.reshape(nl, 4)[:, :3].mean(axis=1), 0.0, 1.0)
        vi = np.empty(nl, dtype=np.int64); mesh.loops.foreach_get('vertex_index', vi)
        # Corners buried inside neighbouring solids (lintel over the roof strip, pylons over groove
        # crossings) bake to 0 and would drag a whole 6 m plate dark: give them their polygon's visible mean.
        npoly = len(mesh.polygons)
        ltot = np.empty(npoly, dtype=np.int64); mesh.polygons.foreach_get('loop_total', ltot)
        poly_of = np.repeat(np.arange(npoly), ltot)
        buried = occ < 0.03
        vis_cnt = np.bincount(poly_of, ~buried, minlength=npoly)
        vis_mean = np.bincount(poly_of, occ * ~buried, minlength=npoly) / np.maximum(vis_cnt, 1)
        occ = np.where(buried & (vis_cnt[poly_of] > 0), vis_mean[poly_of], occ)
        nrm = np.empty(nl * 3, dtype=np.float32); mesh.corner_normals.foreach_get('vector', nrm)
        q = np.round((nrm.reshape(nl, 3) + 1.0) * 40).astype(np.int64)
        key = ((vi * 100 + q[:, 0]) * 100 + q[:, 1]) * 100 + q[:, 2]
        _, inv = np.unique(key, return_inverse=True)
        occ = (np.bincount(inv, occ) / np.bincount(inv))[inv]
        # Open surfaces stay white; seam floors, coffers and inside corners darken to ~0.35.
        col = 0.30 + 0.70 * occ ** 1.5
        if 'Tint' in mesh.color_attributes:   # authored tone (deck sub-floor, plate tones, wear decals)
            ta = mesh.color_attributes['Tint']; cnt = len(ta.data)
            tb = np.empty(cnt * 4, dtype=np.float32); ta.data.foreach_get('color', tb)
            tb = tb.reshape(cnt, 4)[:, 0]
            col = col * (tb if ta.domain == 'CORNER' else tb[vi])
            mesh.color_attributes.remove(ta)
        out = np.ones((nl, 4), dtype=np.float32); out[:, 0] = out[:, 1] = out[:, 2] = col
        cc = mesh.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
        cc.data.foreach_set('color', out.ravel())
        mesh.color_attributes.remove(mesh.color_attributes['AO'])
        mesh.color_attributes.active_color = mesh.color_attributes['Col']
        mesh.color_attributes.render_color_index = mesh.color_attributes.active_color_index
        print(f'  AO {o.name:18s} corners={nl:6d} occ mean={occ.mean():.2f} p10={np.percentile(occ, 10):.2f} p90={np.percentile(occ, 90):.2f}')
    bpy.ops.object.select_all(action='DESELECT')
    print(f'AO baked into {len(meshes)} meshes in {time.time() - t:.1f}s')

def split_by_material(skip=('HangarDoor',)):
    """Blender 5.2's glTF exporter keeps COLOR_0 only for the first material of a multi-material mesh
    (it records the attribute name instead of 'COLOR_0' for the others and then forces them to white).
    One object per material sidesteps that; three.js draws one call per primitive either way. The
    animated, name-bound doors stay whole (their secondary materials lose AO, which is minor)."""
    for o in [o for o in OBJECTS if o.type == 'MESH' and 'Col' in o.data.color_attributes and not o.name.startswith(skip)]:
        if len(o.data.materials) < 2: continue
        before = set(bpy.data.objects)
        select_only([o])
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.separate(type='MATERIAL')
        bpy.ops.object.mode_set(mode='OBJECT')
        # Preserve the authored node as a hierarchy: runtime bounds and floor
        # checks address Hull by name and must include every material section.
        name = o.name
        parts = [o] + sorted(set(bpy.data.objects) - before, key=lambda part: part.name)
        parent = bpy.data.objects.new(name + '_parts', None)
        bpy.context.collection.objects.link(parent)
        parent.parent = o.parent
        parent.matrix_world = o.matrix_world.copy()
        for n in parts:
            if len(n.data.polygons):   # separate() keeps every slot; name the part after the slot it uses
                n.name = f'{name}_{n.data.materials[n.data.polygons[0].material_index].name}'
            world = n.matrix_world.copy()
            n.parent = parent
            n.matrix_world = world
            if n not in OBJECTS: OBJECTS.append(n)
        parent.name = name
        OBJECTS.append(parent)
    bpy.ops.object.select_all(action='DESELECT')

if BAKE_AO:
    bake_ao(AO_SAMPLES)
    split_by_material()

# ============================================================================= EXPORT
bpy.ops.object.select_all(action='DESELECT')
os.makedirs(os.path.dirname(OUT), exist_ok=True)
export_kwargs = dict(
    filepath=OUT, export_format='GLB', export_apply=True, export_yup=True,
    export_animations=True, export_animation_mode='ACTIVE_ACTIONS', export_nla_strips_merged_animation_name='DoorsOpen',
    export_force_sampling=True, export_frame_range=True, export_optimize_animation_size=False,
    export_lights=False, export_cameras=False, export_extras=False, export_skins=False, export_morph=False,
    export_texcoords=False, export_normals=True, export_materials='EXPORT', export_image_format='NONE',
    export_vertex_color='ACTIVE', export_all_vertex_colors=False, export_active_vertex_color_when_no_material=False,
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
    def shot(name, loc, target, lens=35, frame=75):
        scene.frame_set(frame); cam_data.lens = lens
        aim(cam, loc, target); render(os.path.join(PREVIEW_DIR, name))
    # 1. Exterior three-quarter view with the doors half open.
    shot('preview_station.png', (150, 190, 70), (-4, -6, 6))
    # 2. Docking ring close-up.
    shot('preview_dock.png', (SPINE_X + 26, 20, SPINE_Z + 11), (SPINE_X + 3, 0, SPINE_Z), lens=40)
    # 2b. Roof corner: seams, hatches, RCS scorch, vent streaks.
    shot('preview_roof.png', (OX + 16, HY1 + 20, OZ1 + 15), (OX - 12, HY1 - 12, OZ1 + 0.5), lens=35)
    # 3/4 need light inside the bay: an area light under the ceiling stands in for station.js's point lights.
    scene.frame_set(121)
    hangar_light = bpy.data.lights.new('HangarFill', 'AREA'); hangar_light.energy = 14000; hangar_light.size = 30; hangar_light.color = (1.0, 0.96, 0.9)
    hl = bpy.data.objects.new('HangarFill', hangar_light); scene.collection.objects.link(hl)
    hl.location = (0, -2, HZ1 - 0.6)
    # 3. Hangar mouth head-on with the doors open.
    shot('preview_hangar.png', (14, HY1 + 62, DECK_TOP + 9), (0, PAD.y + 4, DECK_TOP + 2), lens=28, frame=121)
    # 4. Inside, standing on the pad looking at the starboard wall and the mouth.
    shot('preview_interior.png', (PAD.x - 9, PAD.y + 9, DECK_TOP + 1.8), (10, HY0 + 2, DECK_TOP + 5.5), lens=24, frame=121)
    scene.frame_set(1)
print(f'DONE in {time.time() - T0:.1f}s')
