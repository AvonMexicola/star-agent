"""Star Agent -- rigged, animated PLACEHOLDER player mannequin. Fully procedural bpy build.

    blender -b --python blender/build_mannequin.py -- [--out public/models/props/mannequin.glb]
                                                       [--preview DIR] [--check]

A stylised space-suited humanoid (1.80 m, <= 8k tris, 3 untextured materials) skinned
rigidly (one bone per part) to a standard humanoid armature with Mixamo bone names
WITHOUT the "mixamorig:" prefix, so the 14 clips can later be retargeted onto the real
Meshy/Mixamo astronaut with blender/retarget_clips.py.

Blender frame: Z up, the character faces +Y, its left side is -X. The glTF exporter's
Y-up conversion maps Blender (x, y, z) -> glTF (x, z, -y), so in three.js the character
faces -Z and its left side is -X. Armature object origin at the feet (0, 0, 0), the Hips
bone head at the pelvis (0, 0, 0.97). Rest pose is an A-pose.

Animation: every clip is its own Action, pushed to its own NLA track (track == clip
name) and exported with export_animation_mode='NLA_TRACKS', so each becomes one glTF
animation with that name. Locomotion clips are in place (no root translation) -- the
character controller moves the root. Hips carry only vertical/fore-aft offsets.

Pose notation used below (armature axes, degrees, applied about each bone's head,
relative to its parent):
    rx  rotation about X (the character's left-right axis):
        +rx swings a hanging limb forward, tilts the torso/head backward, lifts toes.
    ry  rotation about Y (the forward axis):
        +ry tilts the top of the torso toward the character's right (+X);
        for HANGING arms: +ry moves the hand toward -X (out for the left arm, in for the
        right). Once an arm is raised forward (rx ~ 90) ry is only a twist -- use rz then.
    rz  rotation about Z (yaw): +rz turns "forward" toward the character's left, so a
        raised right arm comes inward with +rz and a raised left arm with -rz.
    Euler order is XYZ (X applied first), all about the parent's rest axes.
    'Hips.loc' = (x, y, z) world offset in metres; 'ground' = auto-drop the hips so the
    lowest body point sits at that height (feet on the floor, or lying on the ground).
"""
import bpy, bmesh, math, sys, json, struct, os, time
from mathutils import Vector, Matrix, Euler, Quaternion

T0 = time.time()
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv and argv.index(name) + 1 < len(argv) else default
OUT = os.path.abspath(arg('--out', 'public/models/props/mannequin.glb'))
PREVIEW_DIR = arg('--preview')
CHECK = '--check' in argv or PREVIEW_DIR is not None
FPS = 60  # every clip duration below is an integer number of frames at 60 fps

# ----------------------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
for block in (bpy.data.meshes, bpy.data.materials, bpy.data.actions, bpy.data.armatures):
    for item in list(block):
        block.remove(item)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 0, 180

# ----------------------------------------------------------------------------- materials
def material(name, grey_or_rgb, roughness=0.6, metallic=0.0, emission=None, strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    rgb = (grey_or_rgb,) * 3 if isinstance(grey_or_rgb, float) else grey_or_rgb
    bsdf.inputs['Base Color'].default_value = (*rgb, 1.0)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if emission is not None:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1.0)
        bsdf.inputs['Emission Strength'].default_value = strength
    mat.diffuse_color = (*rgb, 1.0)  # Workbench preview colour
    return mat

MINT = (0xb6 / 255, 0xef / 255, 0xd1 / 255)
MAT_SUIT = material('Suit', 0.75, roughness=0.55)
MAT_DARK = material('Joints', 0.15, roughness=0.7)
MAT_ACCENT = material('Accent', MINT, roughness=0.3, emission=MINT, strength=1.5)
MATS = [MAT_SUIT, MAT_DARK, MAT_ACCENT]
SUIT, DARK, ACCENT = 0, 1, 2

# ----------------------------------------------------------------------------- skeleton
# name: (parent, head, tail). {s} is replaced by the side sign: Left = -1 (-X), Right = +1.
def side(v, s):
    return Vector((v[0] * s, v[1], v[2]))

BONES = [  # order matters: parents before children
    ('Hips',   None,     (0, 0, 0.97), (0, 0, 1.07)),
    ('Spine',  'Hips',   (0, 0, 1.07), (0, 0, 1.19)),
    ('Spine1', 'Spine',  (0, 0, 1.19), (0, 0, 1.31)),
    ('Spine2', 'Spine1', (0, 0, 1.31), (0, 0, 1.45)),
    ('Neck',   'Spine2', (0, 0, 1.45), (0, 0, 1.53)),
    ('Head',   'Neck',   (0, 0, 1.53), (0, 0, 1.70)),
]
LIMBS = [  # (name without side, parent without side, head, tail) -- x is the |x| for the right side
    ('Shoulder', 'Spine2',   (0.03, 0, 1.43),  (0.18, 0, 1.45)),
    ('Arm',      'Shoulder', (0.18, 0, 1.45),  (0.32, 0, 1.19)),
    ('ForeArm',  'Arm',      (0.32, 0, 1.19),  (0.44, 0, 0.955)),
    ('Hand',     'ForeArm',  (0.44, 0, 0.955), (0.48, 0, 0.87)),
    ('UpLeg',    'Hips',     (0.10, 0, 0.95),  (0.10, 0, 0.52)),
    ('Leg',      'UpLeg',    (0.10, 0, 0.52),  (0.10, 0, 0.09)),
    ('Foot',     'Leg',      (0.10, 0, 0.09),  (0.10, 0.12, 0.02)),
    ('ToeBase',  'Foot',     (0.10, 0.12, 0.02), (0.10, 0.22, 0.02)),
]
for prefix, s in (('Left', -1), ('Right', 1)):
    for name, parent, head, tail in LIMBS:
        p = parent if parent in ('Spine2', 'Hips') else prefix + parent
        BONES.append((prefix + name, p, tuple(side(head, s)), tuple(side(tail, s))))
BONE_NAMES = [b[0] for b in BONES]
REST = {b[0]: (Vector(b[2]), Vector(b[3])) for b in BONES}

arm_data = bpy.data.armatures.new('Mannequin')
arm_obj = bpy.data.objects.new('Mannequin', arm_data)
scene.collection.objects.link(arm_obj)
bpy.context.view_layer.objects.active = arm_obj
bpy.ops.object.mode_set(mode='EDIT')
for name, parent, head, tail in BONES:
    eb = arm_data.edit_bones.new(name)
    eb.head, eb.tail = head, tail
    eb.roll = 0.0
    if parent:
        eb.parent = arm_data.edit_bones[parent]
        eb.use_connect = False
bpy.ops.object.mode_set(mode='OBJECT')

# ----------------------------------------------------------------------------- mesh parts
mesh = bpy.data.meshes.new('MannequinMesh')
body = bpy.data.objects.new('MannequinBody', mesh)
scene.collection.objects.link(body)
for m in MATS:
    mesh.materials.append(m)
GROUPS = {name: body.vertex_groups.new(name=name).index for name in BONE_NAMES}
bm = bmesh.new()
deform = bm.verts.layers.deform.verify()

def add_part(part_bm, bone, mat, matrix, smooth):
    """Append a primitive (built around the origin) into the main bmesh, rigidly weighted to `bone`."""
    part_bm.transform(matrix)
    for f in part_bm.faces:
        f.material_index = mat
        f.smooth = smooth
    tmp = bpy.data.meshes.new('tmp')
    part_bm.to_mesh(tmp)
    part_bm.free()
    for m in MATS:
        tmp.materials.append(m)
    before = len(bm.verts)
    bm.from_mesh(tmp)
    bpy.data.meshes.remove(tmp)
    bm.verts.ensure_lookup_table()
    for v in bm.verts[before:]:
        v[deform].clear()
        v[deform][GROUPS[bone]] = 1.0

def place(center, direction=None):
    """Matrix moving the local origin to `center`, local +Z along `direction` (default: world Z)."""
    rot = Vector(direction).normalized().to_track_quat('Z', 'Y').to_matrix().to_4x4() if direction else Matrix.Identity(4)
    return Matrix.Translation(Vector(center)) @ rot

def sphere(center, radius, bone, mat, scale=(1, 1, 1), seg=12, rings=8, direction=None):
    b = bmesh.new()
    bmesh.ops.create_uvsphere(b, u_segments=seg, v_segments=rings, radius=1.0)
    add_part(b, bone, mat, place(center, direction) @ Matrix.Diagonal((*[radius * k for k in scale], 1.0)), True)

def capsule(head, tail, radius, bone, mat, seg=12, rings=8, shrink=0.0):
    """Capsule between two points, ends shortened by `shrink` so joints show."""
    head, tail = Vector(head), Vector(tail)
    d = tail - head
    length = max(d.length - 2 * shrink, 0.01)
    center = (head + tail) / 2
    b = bmesh.new()
    bmesh.ops.create_uvsphere(b, u_segments=seg, v_segments=rings, radius=radius)
    for v in b.verts:
        v.co.z += (length / 2) if v.co.z > 1e-6 else (-(length / 2) if v.co.z < -1e-6 else 0)
    add_part(b, bone, mat, place(center, d), True)

def box(center, size, bone, mat, bevel=0.015, direction=None, segments=2):
    b = bmesh.new()
    bmesh.ops.create_cube(b, size=1.0)
    bmesh.ops.scale(b, vec=Vector(size), verts=b.verts)
    if bevel > 0:
        bmesh.ops.bevel(b, geom=b.verts[:] + b.edges[:], offset=min(bevel, min(size) * 0.45),
                        segments=segments, affect='EDGES', clamp_overlap=True)
    add_part(b, bone, mat, place(center, direction), False)

def torus(center, major, minor, bone, mat, seg=24, rings=6):
    b = bmesh.new()
    verts = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        ring = []
        for j in range(rings):
            t = 2 * math.pi * j / rings
            r = major + minor * math.cos(t)
            ring.append(b.verts.new((r * math.cos(a), r * math.sin(a), minor * math.sin(t))))
        verts.append(ring)
    for i in range(seg):
        for j in range(rings):
            b.faces.new((verts[i][j], verts[(i + 1) % seg][j], verts[(i + 1) % seg][(j + 1) % rings], verts[i][(j + 1) % rings]))
    add_part(b, bone, mat, place(center), True)

# Head / helmet (top of the helmet defines the 1.80 m height).
sphere((0, 0, 1.645), 0.155, 'Head', SUIT, seg=24, rings=12)
sphere((0, 0.075, 1.645), 0.125, 'Head', DARK, scale=(1.0, 0.8, 0.85), seg=16, rings=8)    # visor (protrudes 1.5 cm)
torus((0, 0, 1.585), 0.150, 0.010, 'Head', ACCENT)                                          # helmet ring
capsule((0, 0, 1.44), (0, 0, 1.54), 0.055, 'Neck', DARK, seg=12, rings=6)
# Torso
box((0, 0, 1.385), (0.40, 0.26, 0.19), 'Spine2', SUIT, bevel=0.03)         # chest plate
box((0, 0.14, 1.40), (0.22, 0.012, 0.02), 'Spine2', ACCENT, bevel=0.0)     # chest strip
box((0, -0.205, 1.32), (0.30, 0.15, 0.36), 'Spine2', SUIT, bevel=0.025)    # backpack
box((-0.08, -0.285, 1.32), (0.02, 0.012, 0.26), 'Spine2', ACCENT, bevel=0.0)
box((0.08, -0.285, 1.32), (0.02, 0.012, 0.26), 'Spine2', ACCENT, bevel=0.0)
box((0, 0, 1.245), (0.34, 0.22, 0.13), 'Spine1', SUIT, bevel=0.03)         # upper abdomen
box((0, 0, 1.13), (0.30, 0.20, 0.12), 'Spine', DARK, bevel=0.03)           # belly joint band
box((0, 0, 1.005), (0.36, 0.24, 0.16), 'Hips', SUIT, bevel=0.035)          # pelvis
box((0, 0.125, 1.02), (0.20, 0.012, 0.02), 'Hips', ACCENT, bevel=0.0)      # belt strip
for prefix, s in (('Left', -1), ('Right', 1)):
    P = lambda v: side(v, s)
    R = lambda n: REST[prefix + n]
    sphere(P((0.18, 0, 1.45)), 0.085, prefix + 'Arm', SUIT)                                 # shoulder pad
    capsule(*R('Arm'), 0.058, prefix + 'Arm', SUIT, shrink=0.03)                            # upper arm
    box(P((0.25, 0, 1.32)), (0.03, 0.012, 0.12), prefix + 'Arm', ACCENT, bevel=0.0,
        direction=(R('Arm')[1] - R('Arm')[0]).cross(Vector((0, 1, 0))))                     # arm strip (outer side)
    sphere(R('ForeArm')[0], 0.058, prefix + 'ForeArm', DARK)                                # elbow
    capsule(*R('ForeArm'), 0.050, prefix + 'ForeArm', SUIT, shrink=0.03)                    # forearm
    box((R('Hand')[0] + R('Hand')[1]) / 2 + Vector((0, 0, -0.02)), (0.085, 0.07, 0.15),
        prefix + 'Hand', DARK, bevel=0.02, direction=R('Hand')[1] - R('Hand')[0])           # glove
    capsule(*R('UpLeg'), 0.082, prefix + 'UpLeg', SUIT, shrink=0.02)                        # thigh
    sphere(R('Leg')[0], 0.072, prefix + 'Leg', DARK)                                        # knee
    capsule(*R('Leg'), 0.066, prefix + 'Leg', SUIT, shrink=0.03)                            # shin
    box(P((0.10 + 0.07 * s, 0, 0.30)), (0.012, 0.03, 0.14), prefix + 'Leg', ACCENT, bevel=0.0)   # shin strip
    box(P((0.10, 0.02, 0.05)), (0.13, 0.20, 0.10), prefix + 'Foot', DARK, bevel=0.02)       # boot
    box(P((0.10, 0.165, 0.04)), (0.12, 0.11, 0.08), prefix + 'ToeBase', DARK, bevel=0.02)   # toe cap

bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
bm.to_mesh(mesh)
bm.free()
mesh.update()
TRIS = sum(len(p.vertices) - 2 for p in mesh.polygons)

mod = body.modifiers.new('Armature', 'ARMATURE')
mod.object = arm_obj
body.parent = arm_obj

# ----------------------------------------------------------------------------- pose maths
# Bone rest rotations (armature space) map "armature-axes" rotations into bone-local space.
REST_ROT = {b.name: b.matrix_local.to_3x3() for b in arm_data.bones}
REST_INV = {n: m.inverted() for n, m in REST_ROT.items()}

def local_quat(bone, rx, ry, rz):
    R = Euler((math.radians(rx), math.radians(ry), math.radians(rz)), 'XYZ').to_matrix()
    return (REST_INV[bone] @ R @ REST_ROT[bone]).to_quaternion()

def local_loc(bone, world_offset):
    return REST_INV[bone] @ Vector(world_offset)

# Rest-space contact points used for auto-grounding: (bone, point in armature rest space).
# Feet: boot heel/toe undersides; others: lowest surface of the part when the body lies down.
CONTACT = []
for prefix, s in (('Left', -1), ('Right', 1)):
    x = 0.10 * s
    CONTACT += [(prefix + 'Foot', Vector((x, -0.08, 0.0))), (prefix + 'Foot', Vector((x, 0.10, 0.0))),
                (prefix + 'ToeBase', Vector((x, 0.22, 0.0))), (prefix + 'Leg', Vector((x, -0.07, 0.52))),
                (prefix + 'UpLeg', Vector((x, -0.08, 0.75))), (prefix + 'Hand', Vector((x * 4.6, 0, 0.87))),
                (prefix + 'ForeArm', Vector((x * 3.8, 0, 1.07)))]
CONTACT += [('Hips', Vector((0, -0.12, 0.97))), ('Spine2', Vector((0, -0.28, 1.32))),
            ('Head', Vector((0, -0.155, 1.645))), ('Head', Vector((0, 0, 1.80)))]

def lowest_point():
    """World Z of the lowest contact point in the current evaluated pose."""
    bpy.context.view_layer.update()
    z = 1e9
    for bone, p in CONTACT:
        pb = arm_obj.pose.bones[bone]
        w = arm_obj.matrix_world @ pb.matrix @ arm_data.bones[bone].matrix_local.inverted() @ p
        z = min(z, w.z)
    return z

def mirror(pose):
    """Swap left/right and mirror the rotations across the sagittal plane."""
    out = {}
    for k, v in pose.items():
        if k == 'Hips.loc':
            out[k] = (-v[0], v[1], v[2])
        elif k == 'ground':
            out[k] = v
        else:
            nk = k.replace('Left', '@').replace('Right', 'Left').replace('@', 'Right')
            out[nk] = (v[0], -v[1], -v[2])
    return out

def merge(*poses):
    out = {}
    for p in poses:
        out.update(p)
    return out

# ----------------------------------------------------------------------------- clip builder
CLIPS = []

def action_fcurves(act):
    """All F-curves of a (layered, slotted) Blender 4.4+/5.x action."""
    return [fc for layer in act.layers for strip in layer.strips for cb in strip.channelbags for fc in cb.fcurves]

def clip(name, duration, keys, loop):
    """keys: list of (time_s, pose). Every bone is keyed at every key time (unlisted = rest)."""
    act = bpy.data.actions.new(name)
    arm_obj.animation_data_create()
    arm_obj.animation_data.action = act
    frames = [(round(t * FPS), pose) for t, pose in keys]
    if loop:  # ghost keys outside the strip range so the Bezier handles are continuous at the seam
        assert abs(keys[0][0]) < 1e-6 and abs(keys[-1][0] - duration) < 1e-6, name
        ghost_before = (frames[-2][0] - round(duration * FPS), frames[-2][1])
        ghost_after = (frames[1][0] + round(duration * FPS), frames[1][1])
        frames = [ghost_before] + frames + [ghost_after]
    prev_q = {}
    for frame, pose in frames:
        hips = arm_obj.pose.bones['Hips']
        for bone in BONE_NAMES:
            pb = arm_obj.pose.bones[bone]
            pb.rotation_mode = 'QUATERNION'
            q = local_quat(bone, *pose.get(bone, (0, 0, 0)))
            if bone in prev_q and prev_q[bone].dot(q) < 0:
                q.negate()
            prev_q[bone] = q
            pb.rotation_quaternion = q
            pb.keyframe_insert('rotation_quaternion', frame=frame)
        offset = Vector(pose.get('Hips.loc', (0, 0, 0)))
        hips.location = local_loc('Hips', offset)
        hips.keyframe_insert('location', frame=frame)
        if 'ground' in pose:
            scene.frame_set(frame)
            offset.z += pose['ground'] - lowest_point()
            hips.location = local_loc('Hips', offset)
            hips.keyframe_insert('location', frame=frame)
    for fc in action_fcurves(act):
        for kp in fc.keyframe_points:
            kp.interpolation = 'BEZIER'
            kp.handle_left_type = kp.handle_right_type = 'AUTO_CLAMPED'
    act.use_frame_range = True
    act.frame_start, act.frame_end = 0, round(duration * FPS)
    act.use_cyclic = loop
    arm_obj.animation_data.action = None
    track = arm_obj.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, 0, act)
    strip.name = name
    track.mute = True  # keep finished clips out of the pose evaluation while building the next ones
    CLIPS.append((name, duration, loop))
    return act

# ----------------------------------------------------------------------------- poses
REST_POSE = {}
RELAX = {  # arms slightly in from the A-pose, elbows soft
    'LeftArm': (2, -8, 0), 'RightArm': (2, 8, 0),
    'LeftForeArm': (8, 0, 0), 'RightForeArm': (8, 0, 0),
    'ground': 0.0,
}

def arms_swing(right_fwd, elbow_fwd=25, elbow_back=10):
    """Right arm forward by `right_fwd` degrees, left arm back by the same."""
    return {'RightArm': (right_fwd, 8, 0), 'LeftArm': (-right_fwd, -8, 0),
            'RightForeArm': (elbow_fwd if right_fwd > 0 else elbow_back, 0, 0),
            'LeftForeArm': (elbow_back if right_fwd > 0 else elbow_fwd, 0, 0)}

# ---- idle (2 s loop): breathing + slight sway
idle_a = merge(RELAX, {'Spine': (0, 0.8, 0), 'Head': (0, 0, 2)})
idle_b = merge(RELAX, {'Spine': (-1.5, -0.8, 0), 'Spine2': (-1.5, 0, 0), 'Head': (2, 0, -2),
                       'LeftArm': (4, -9, 0), 'RightArm': (4, 9, 0), 'Hips.loc': (0, 0, -0.008)})
clip('idle', 2.0, [(0, idle_a), (1.0, idle_b), (2.0, idle_a)], loop=True)

# ---- walk (1.0 s loop): left foot contact at t=0, right at 0.5. ~1.4 m/s implied.
def walk_contact(amp=25):
    return merge({
        'LeftUpLeg': (amp, 0, 0), 'LeftLeg': (-6, 0, 0), 'LeftFoot': (12, 0, 0),
        'RightUpLeg': (-amp * 0.8, 0, 0), 'RightLeg': (-18, 0, 0), 'RightFoot': (-18, 0, 0), 'RightToeBase': (10, 0, 0),
        'Hips': (0, 0, -5), 'Spine': (-3, 0, 2), 'Spine2': (0, 0, 3), 'Head': (3, 0, 0),
    }, arms_swing(amp * 1.1), {'ground': 0.0})
def walk_pass(amp=25):
    return merge({
        'LeftUpLeg': (-2, 0, 0), 'LeftLeg': (-8, 0, 0), 'LeftFoot': (2, 0, 0),          # stance leg (left)
        'RightUpLeg': (amp * 0.3, 0, 0), 'RightLeg': (-amp * 2.0, 0, 0), 'RightFoot': (8, 0, 0),  # swinging through
        'Hips': (0, 2, 0), 'Spine': (-3, -1, 0), 'Head': (3, 0, 0),
    }, arms_swing(0, elbow_fwd=18, elbow_back=18), {'ground': 0.0})
clip('walk', 1.0, [(0, walk_contact()), (0.25, walk_pass()), (0.5, mirror(walk_contact())),
                   (0.75, mirror(walk_pass())), (1.0, walk_contact())], loop=True)

# ---- run (0.7 s loop): bigger stride, forward lean, flight phase between contacts
def run_contact():
    return merge({
        'LeftUpLeg': (38, 0, 0), 'LeftLeg': (-22, 0, 0), 'LeftFoot': (5, 0, 0),
        'RightUpLeg': (-28, 0, 0), 'RightLeg': (-45, 0, 0), 'RightFoot': (-20, 0, 0), 'RightToeBase': (12, 0, 0),
        'Hips': (0, 0, -8), 'Spine': (-12, 0, 3), 'Spine1': (-4, 0, 3), 'Spine2': (0, 0, 4), 'Head': (12, 0, 0),
        'RightArm': (48, 10, 0), 'RightForeArm': (85, 0, 0), 'LeftArm': (-35, -10, 0), 'LeftForeArm': (70, 0, 0),
    }, {'ground': 0.0})
def run_flight():
    return merge({
        'LeftUpLeg': (2, 0, 0), 'LeftLeg': (-25, 0, 0), 'LeftFoot': (-12, 0, 0),
        'RightUpLeg': (18, 0, 0), 'RightLeg': (-95, 0, 0), 'RightFoot': (5, 0, 0),
        'Hips': (0, 2, 0), 'Spine': (-12, -1, 0), 'Spine1': (-4, 0, 0), 'Head': (12, 0, 0),
        'RightArm': (10, 10, 0), 'RightForeArm': (80, 0, 0), 'LeftArm': (5, -10, 0), 'LeftForeArm': (80, 0, 0),
    }, {'ground': 0.06})
clip('run', 0.7, [(0, run_contact()), (0.175, run_flight()), (0.35, mirror(run_contact())),
                  (0.525, mirror(run_flight())), (0.7, run_contact())], loop=True)

# ---- jump (1.2 s): crouch -> extend -> airborne tuck -> land
jump_stand = merge(RELAX)
jump_crouch = merge({
    'LeftUpLeg': (55, 0, 0), 'RightUpLeg': (55, 0, 0), 'LeftLeg': (-100, 0, 0), 'RightLeg': (-100, 0, 0),
    'LeftFoot': (40, 0, 0), 'RightFoot': (40, 0, 0), 'Spine': (-25, 0, 0), 'Spine1': (-10, 0, 0), 'Head': (20, 0, 0),
    'LeftArm': (-35, -8, 0), 'RightArm': (-35, 8, 0), 'LeftForeArm': (10, 0, 0), 'RightForeArm': (10, 0, 0),
}, {'ground': 0.0})
jump_extend = merge({
    'LeftUpLeg': (-5, 0, 0), 'RightUpLeg': (-5, 0, 0), 'LeftFoot': (-30, 0, 0), 'RightFoot': (-30, 0, 0),
    'LeftToeBase': (15, 0, 0), 'RightToeBase': (15, 0, 0), 'Spine': (5, 0, 0), 'Head': (5, 0, 0),
    'LeftArm': (140, -20, 0), 'RightArm': (140, 20, 0), 'LeftForeArm': (10, 0, 0), 'RightForeArm': (10, 0, 0),
}, {'ground': 0.12})
jump_tuck = merge({
    'LeftUpLeg': (60, 0, 0), 'RightUpLeg': (60, 0, 0), 'LeftLeg': (-95, 0, 0), 'RightLeg': (-95, 0, 0),
    'LeftFoot': (-10, 0, 0), 'RightFoot': (-10, 0, 0), 'Spine': (-8, 0, 0), 'Head': (5, 0, 0),
    'LeftArm': (60, -35, 0), 'RightArm': (60, 35, 0), 'LeftForeArm': (30, 0, 0), 'RightForeArm': (30, 0, 0),
}, {'ground': 0.55})
jump_reach = merge({
    'LeftUpLeg': (15, 0, 0), 'RightUpLeg': (15, 0, 0), 'LeftLeg': (-15, 0, 0), 'RightLeg': (-15, 0, 0),
    'LeftFoot': (-25, 0, 0), 'RightFoot': (-25, 0, 0), 'Spine': (-5, 0, 0),
    'LeftArm': (25, -30, 0), 'RightArm': (25, 30, 0), 'LeftForeArm': (20, 0, 0), 'RightForeArm': (20, 0, 0),
}, {'ground': 0.18})
jump_land = merge({
    'LeftUpLeg': (40, 0, 0), 'RightUpLeg': (40, 0, 0), 'LeftLeg': (-70, 0, 0), 'RightLeg': (-70, 0, 0),
    'LeftFoot': (28, 0, 0), 'RightFoot': (28, 0, 0), 'Spine': (-20, 0, 0), 'Spine1': (-8, 0, 0), 'Head': (18, 0, 0),
    'LeftArm': (35, -25, 0), 'RightArm': (35, 25, 0), 'LeftForeArm': (30, 0, 0), 'RightForeArm': (30, 0, 0),
}, {'ground': 0.0})
clip('jump', 1.2, [(0, jump_stand), (0.25, jump_crouch), (0.4, jump_extend), (0.6, jump_tuck),
                   (0.85, jump_reach), (1.0, jump_land), (1.2, jump_stand)], loop=False)

# ---- crouch-walk (1.2 s loop): hips ~0.35 m lower, careful steps
def crouch_pose(step):  # step in [-1, 1]: +1 left leg forward
    return merge({
        'LeftUpLeg': (68 + 14 * step, 0, 0), 'LeftLeg': (-100 - 4 * step, 0, 0), 'LeftFoot': (34 - 10 * step, 0, 0),
        'RightUpLeg': (68 - 14 * step, 0, 0), 'RightLeg': (-100 + 4 * step, 0, 0), 'RightFoot': (34 + 10 * step, 0, 0),
        'Spine': (-22, 0, -3 * step), 'Spine1': (-10, 0, 0), 'Spine2': (-5, 0, 0), 'Head': (30, 0, 0),
        'Hips': (0, 0, -4 * step),
        'LeftArm': (35 - 15 * step, -12, 0), 'RightArm': (35 + 15 * step, 12, 0),
        'LeftForeArm': (60, 0, 0), 'RightForeArm': (60, 0, 0),
    }, {'ground': 0.0})
clip('crouch-walk', 1.2, [(0, crouch_pose(1)), (0.3, crouch_pose(0)), (0.6, crouch_pose(-1)),
                          (0.9, crouch_pose(0)), (1.2, crouch_pose(1))], loop=True)

# ---- sit-down / sit-idle / stand-up: seat height 0.45 m, hips move back 0.30 m
SEATED = merge({
    'LeftUpLeg': (88, 0, 0), 'RightUpLeg': (88, 0, 0), 'LeftLeg': (-88, 0, 0), 'RightLeg': (-88, 0, 0),
    'LeftFoot': (0, 0, 0), 'RightFoot': (0, 0, 0),
    'Spine': (-4, 0, 0), 'Spine2': (-2, 0, 0), 'Head': (4, 0, 0),
    'LeftArm': (40, -14, 0), 'RightArm': (40, 14, 0), 'LeftForeArm': (35, 0, 0), 'RightForeArm': (35, 0, 0),
    'LeftHand': (-30, 0, 0), 'RightHand': (-30, 0, 0),
}, {'Hips.loc': (0, -0.30, -0.44)})
SIT_MID = merge({
    'LeftUpLeg': (45, 0, 0), 'RightUpLeg': (45, 0, 0), 'LeftLeg': (-55, 0, 0), 'RightLeg': (-55, 0, 0),
    'LeftFoot': (12, 0, 0), 'RightFoot': (12, 0, 0),
    'Spine': (-25, 0, 0), 'Spine1': (-10, 0, 0), 'Head': (25, 0, 0),
    'LeftArm': (45, -12, 0), 'RightArm': (45, 12, 0), 'LeftForeArm': (20, 0, 0), 'RightForeArm': (20, 0, 0),
}, {'Hips.loc': (0, -0.16, 0), 'ground': 0.0})
SEATED_BREATH = merge(SEATED, {'Spine2': (-4, 0, 0), 'Spine1': (-1, 0, 0), 'Head': (6, 0, 1)})
clip('sit-down', 1.5, [(0, merge(RELAX)), (0.6, SIT_MID), (1.2, SEATED), (1.5, SEATED)], loop=False)
clip('sit-idle', 3.0, [(0, SEATED), (1.5, SEATED_BREATH), (3.0, SEATED)], loop=True)
clip('stand-up', 1.5, [(0, SEATED), (0.3, SEATED), (0.9, SIT_MID), (1.5, merge(RELAX))], loop=False)

# ---- carry-walk (1.1 s loop): walk with both arms forward holding an invisible 0.5 m box
CARRY_ARMS = {'LeftArm': (52, 0, -26), 'RightArm': (52, 0, 26), 'LeftForeArm': (32, 0, -4), 'RightForeArm': (32, 0, 4),
              'LeftHand': (0, 0, -25), 'RightHand': (0, 0, 25), 'Spine': (4, 0, 0), 'Spine2': (2, 0, 0)}
def carry(pose):
    p = merge(pose, CARRY_ARMS)
    p['Head'] = (0, 0, 0)
    return p
clip('carry-walk', 1.1, [(0, carry(walk_contact(20))), (0.275, carry(walk_pass(20))), (0.55, carry(mirror(walk_contact(20)))),
                         (0.825, carry(mirror(walk_pass(20)))), (1.1, carry(walk_contact(20)))], loop=True)

# ---- wounded-walk (1.4 s loop): stiff right leg, hunched torso, left hand pressed to the side
WOUND_BASE = {'Spine': (-22, 0, 0), 'Spine1': (-10, 0, 0), 'Spine2': (-4, 4, 0), 'Head': (28, -6, 0),
              'LeftArm': (-12, -24, 0), 'LeftForeArm': (105, 0, -55), 'LeftHand': (0, 0, -20),   # hand pressed to the left side
              'RightArm': (10, 8, 0), 'RightForeArm': (15, 0, 0)}
def wounded(phase):  # phase 0: left foot forward, 1: mid, 2: right (stiff) foot forward, 3: mid
    legs = [
        {'LeftUpLeg': (28, 0, 0), 'LeftLeg': (-10, 0, 0), 'LeftFoot': (10, 0, 0), 'RightUpLeg': (-12, 0, 0),
         'RightLeg': (0, 0, 0), 'RightFoot': (-12, 0, 0), 'RightToeBase': (8, 0, 0), 'Hips': (0, -2, -4)},
        {'LeftUpLeg': (0, 0, 0), 'LeftLeg': (-25, 0, 0), 'LeftFoot': (0, 0, 0), 'RightUpLeg': (10, 0, 0),
         'RightLeg': (0, 0, 0), 'RightFoot': (5, 0, 0), 'Hips': (0, -3, 0)},
        {'LeftUpLeg': (-15, 0, 0), 'LeftLeg': (-25, 0, 0), 'LeftFoot': (-12, 0, 0), 'RightUpLeg': (18, 0, 0),
         'RightLeg': (0, 0, 0), 'RightFoot': (5, 0, 0), 'Hips': (0, 5, 4)},
        {'LeftUpLeg': (18, 0, 0), 'LeftLeg': (-50, 0, 0), 'LeftFoot': (5, 0, 0), 'RightUpLeg': (2, 0, 0),
         'RightLeg': (0, 0, 0), 'RightFoot': (0, 0, 0), 'Hips': (0, 4, 0)},
    ][phase]
    return merge(WOUND_BASE, legs, {'ground': 0.0})
clip('wounded-walk', 1.4, [(0, wounded(0)), (0.35, wounded(1)), (0.7, wounded(2)), (1.05, wounded(3)), (1.4, wounded(0))], loop=True)

# ---- aim-rifle (2 s loop) / fire-rifle (0.6 s): rifle at the right shoulder, body bladed
AIM = merge({
    'LeftUpLeg': (10, 0, 0), 'RightUpLeg': (-8, 0, 0), 'LeftLeg': (-8, 0, 0), 'RightLeg': (-6, 0, 0),
    'Hips': (0, 0, -8), 'Spine': (-4, 0, -8), 'Spine1': (0, 0, -6), 'Spine2': (-3, 0, -4), 'Head': (-5, 10, 22),
    'RightArm': (28, 0, 12), 'RightForeArm': (112, 0, 30), 'RightHand': (0, 0, 0),        # trigger hand at the shoulder
    'LeftArm': (78, 0, -56), 'LeftForeArm': (24, 0, -10), 'LeftHand': (0, 0, 0),          # foregrip hand forward-right
}, {'ground': 0.0})
AIM_SWAY = merge(AIM, {'Spine2': (-4.5, 0.6, -4), 'Head': (-4, 10, 22), 'RightArm': (29, 0, 12), 'LeftArm': (79, 0, -56)})
clip('aim-rifle', 2.0, [(0, AIM), (1.0, AIM_SWAY), (2.0, AIM)], loop=True)
RECOIL = merge(AIM, {'Spine2': (4, 0, -4), 'Spine1': (3, 0, -6), 'Head': (0, 10, 22),
                     'RightArm': (18, 0, 12), 'RightForeArm': (120, 0, 30), 'LeftArm': (70, 0, -54), 'LeftForeArm': (32, 0, -10)})
RECOVER = merge(AIM, {'Spine2': (-1, 0, -4), 'RightArm': (25, 0, 12), 'LeftArm': (75, 0, -55)})
clip('fire-rifle', 0.6, [(0, AIM), (0.08, RECOIL), (0.3, RECOVER), (0.6, AIM)], loop=False)

# ---- fire-pistol (0.8 s): right arm extended forward, muzzle flip and recovery
PISTOL = merge({
    'LeftUpLeg': (8, 0, 0), 'RightUpLeg': (-6, 0, 0), 'LeftLeg': (-6, 0, 0), 'RightLeg': (-4, 0, 0),
    'Hips': (0, 0, -6), 'Spine': (-3, 0, -6), 'Spine1': (0, 0, -4), 'Spine2': (0, 0, -2), 'Head': (-2, 3, 14),
    'RightArm': (90, 0, 38), 'RightForeArm': (2, 0, 0), 'RightHand': (0, 0, 0),           # extended, hand on the centreline
    'LeftArm': (72, 0, -48), 'LeftForeArm': (48, 0, -15), 'LeftHand': (0, 0, 0),          # supporting hand under the grip
}, {'ground': 0.0})
PISTOL_KICK = merge(PISTOL, {'RightArm': (102, 0, 38), 'RightForeArm': (8, 0, 0), 'RightHand': (25, 0, 0),
                             'Spine2': (3, 0, -2), 'Head': (2, 3, 14), 'LeftArm': (68, 0, -47)})
PISTOL_SETTLE = merge(PISTOL, {'RightArm': (93, 0, 38), 'RightHand': (5, 0, 0)})
clip('fire-pistol', 0.8, [(0, PISTOL), (0.1, PISTOL_KICK), (0.4, PISTOL_SETTLE), (0.8, PISTOL)], loop=False)

# ---- death (1.6 s): stagger, collapse backwards, lie still (hold the last frame)
D_STAGGER = merge({
    'Hips': (6, 0, 0), 'Spine': (10, 0, 0), 'Spine1': (5, 0, 0), 'Head': (12, 0, 0),
    'LeftUpLeg': (-5, 0, 0), 'RightUpLeg': (5, 0, 0), 'LeftLeg': (-20, 0, 0), 'RightLeg': (-30, 0, 0),
    'LeftFoot': (15, 0, 0), 'RightFoot': (20, 0, 0),
    'LeftArm': (35, -15, 0), 'RightArm': (35, 15, 0), 'LeftForeArm': (40, 0, 0), 'RightForeArm': (40, 0, 0),
}, {'Hips.loc': (0, -0.05, 0), 'ground': 0.0})
D_FALL = merge({
    'Hips': (55, 0, 0), 'Spine': (12, 0, 0), 'Spine1': (5, 0, 0), 'Head': (-15, 0, 0),
    'LeftUpLeg': (20, 0, 0), 'RightUpLeg': (28, 0, 0), 'LeftLeg': (-35, 0, 0), 'RightLeg': (-50, 0, 0),
    'LeftFoot': (-10, 0, 0), 'RightFoot': (-15, 0, 0),
    'LeftArm': (60, -40, 0), 'RightArm': (60, 40, 0), 'LeftForeArm': (30, 0, 0), 'RightForeArm': (30, 0, 0),
}, {'Hips.loc': (0, -0.22, 0), 'ground': 0.04})
D_IMPACT = merge({
    'Hips': (92, 0, 0), 'Spine': (2, 0, 0), 'Spine1': (0, 0, 0), 'Head': (12, 0, 0),
    'LeftUpLeg': (10, 4, 0), 'RightUpLeg': (14, -4, 0), 'LeftLeg': (-12, 0, 0), 'RightLeg': (-18, 0, 0),
    'LeftFoot': (-25, 0, 0), 'RightFoot': (-25, 0, 0),
    'LeftArm': (6, -55, 0), 'RightArm': (6, 55, 0), 'LeftForeArm': (15, 0, 0), 'RightForeArm': (15, 0, 0),
}, {'Hips.loc': (0, -0.36, 0), 'ground': 0.0})
D_BOUNCE = merge(D_IMPACT, {'Hips': (88, 0, 0), 'Head': (4, 0, 0), 'LeftArm': (8, -60, 0), 'RightArm': (8, 60, 0)},
                 {'Hips.loc': (0, -0.36, 0), 'ground': 0.02})
D_REST = merge(D_IMPACT, {'Head': (14, 12, 0), 'LeftArm': (5, -62, 0), 'RightArm': (5, 60, 0)})
clip('death', 1.6, [(0, merge(RELAX)), (0.35, D_STAGGER), (0.8, D_FALL), (1.15, D_IMPACT), (1.35, D_BOUNCE), (1.6, D_REST)], loop=False)

scene.frame_set(0)
EXPECTED = ['idle', 'walk', 'run', 'jump', 'crouch-walk', 'sit-down', 'sit-idle', 'stand-up',
            'carry-walk', 'wounded-walk', 'aim-rifle', 'fire-rifle', 'fire-pistol', 'death']
assert [c[0] for c in CLIPS] == EXPECTED, [c[0] for c in CLIPS]

# ----------------------------------------------------------------------------- export
bpy.ops.object.select_all(action='DESELECT')
os.makedirs(os.path.dirname(OUT), exist_ok=True)
for tr in arm_obj.animation_data.nla_tracks:
    tr.is_solo = False
    tr.mute = False
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', export_apply=True, export_yup=True,
    export_animations=True, export_animation_mode='NLA_TRACKS', export_nla_strips=True,
    export_force_sampling=True, export_frame_range=False, export_frame_step=1,
    export_optimize_animation_size=True, export_optimize_animation_keep_anim_armature=True,
    export_rest_position_armature=True, export_skins=True, export_def_bones=False,
    export_lights=False, export_cameras=False, export_extras=False, export_morph=False,
    export_texcoords=False, export_normals=True, export_materials='EXPORT', export_image_format='NONE',
    use_selection=False)

def read_glb(path):
    with open(path, 'rb') as f:
        data = f.read()
    assert struct.unpack_from('<I', data, 0)[0] == 0x46546C67, 'not a GLB'
    json_len = struct.unpack_from('<I', data, 12)[0]
    gltf = json.loads(data[20:20 + json_len])
    bin_len = struct.unpack_from('<I', data, 20 + json_len)[0]
    return gltf, data[28 + json_len:28 + json_len + bin_len]

def write_glb(path, gltf, blob):
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    blob += b'\0' * (-len(blob) % 4)
    gltf['buffers'][0]['byteLength'] = len(blob)
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    total = 12 + 8 + len(js) + 8 + len(blob)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
        f.write(struct.pack('<II', len(blob), 0x004E4942) + blob)

def strip_constant_channels(path, keep_translation=('Hips',)):
    """Drop the constant translation/scale channels the sampled export writes for every bone
    (rotation channels are kept for all bones so mixer blends stay deterministic), then garbage
    collect the accessors / bufferViews they used and repack the GLB."""
    gltf, blob = read_glb(path)
    node_names = [n.get('name', '') for n in gltf['nodes']]
    for anim in gltf.get('animations', []):
        keep = []
        for ch in anim['channels']:
            path_ = ch['target']['path']
            name = node_names[ch['target']['node']]
            if path_ == 'scale' or (path_ == 'translation' and name not in keep_translation):
                continue
            keep.append(ch)
        used = sorted({ch['sampler'] for ch in keep})
        remap = {old: new for new, old in enumerate(used)}
        anim['samplers'] = [anim['samplers'][i] for i in used]
        for ch in keep:
            ch['sampler'] = remap[ch['sampler']]
        anim['channels'] = keep
    # Accessor GC.
    refs = []
    for m in gltf.get('meshes', []):
        for prim in m['primitives']:
            refs += list(prim['attributes'].values()) + ([prim['indices']] if 'indices' in prim else [])
            for t in prim.get('targets', []):
                refs += list(t.values())
    for sk in gltf.get('skins', []):
        if 'inverseBindMatrices' in sk:
            refs.append(sk['inverseBindMatrices'])
    for anim in gltf.get('animations', []):
        for smp in anim['samplers']:
            refs += [smp['input'], smp['output']]
    used_acc = sorted(set(refs))
    acc_map = {old: new for new, old in enumerate(used_acc)}
    gltf['accessors'] = [gltf['accessors'][i] for i in used_acc]
    for m in gltf.get('meshes', []):
        for prim in m['primitives']:
            prim['attributes'] = {k: acc_map[v] for k, v in prim['attributes'].items()}
            if 'indices' in prim:
                prim['indices'] = acc_map[prim['indices']]
            for t in prim.get('targets', []):
                for k in t:
                    t[k] = acc_map[t[k]]
    for sk in gltf.get('skins', []):
        if 'inverseBindMatrices' in sk:
            sk['inverseBindMatrices'] = acc_map[sk['inverseBindMatrices']]
    for anim in gltf.get('animations', []):
        for smp in anim['samplers']:
            smp['input'], smp['output'] = acc_map[smp['input']], acc_map[smp['output']]
    # BufferView GC + repack.
    used_bv = sorted({a['bufferView'] for a in gltf['accessors'] if 'bufferView' in a} |
                     {im['bufferView'] for im in gltf.get('images', []) if 'bufferView' in im})
    bv_map, new_views, out = {}, [], bytearray()
    for old in used_bv:
        bv = dict(gltf['bufferViews'][old])
        start = bv.get('byteOffset', 0)
        chunk = blob[start:start + bv['byteLength']]
        out += b'\0' * (-len(out) % 4)
        bv['byteOffset'] = len(out)
        bv['buffer'] = 0
        out += chunk
        bv_map[old] = len(new_views)
        new_views.append(bv)
    gltf['bufferViews'] = new_views
    for a in gltf['accessors']:
        if 'bufferView' in a:
            a['bufferView'] = bv_map[a['bufferView']]
    for im in gltf.get('images', []):
        if 'bufferView' in im:
            im['bufferView'] = bv_map[im['bufferView']]
    write_glb(path, gltf, bytes(out))

strip_constant_channels(OUT)
gltf, _ = read_glb(OUT)
tris = 0
for m in gltf['meshes']:
    for prim in m['primitives']:
        acc = gltf['accessors'][prim['indices']] if 'indices' in prim else gltf['accessors'][prim['attributes']['POSITION']]
        tris += acc['count'] // 3
anims = [(a['name'], max(gltf['accessors'][s['input']]['max'][0] for s in a['samplers'])) for a in gltf.get('animations', [])]
print(f'EXPORTED {OUT}: {os.path.getsize(OUT) / 1e6:.3f} MB, {tris} triangles ({TRIS} in Blender), '
      f'{len(gltf["nodes"])} nodes, {len(anims)} animations, {time.time() - T0:.1f}s')
for name, dur in anims:
    print(f'  {name:14s} {dur:.3f}s')

# ----------------------------------------------------------------------------- checks / previews
def solo(name):
    """Evaluate only the named clip's NLA track (all tracks unmuted again when name is '')."""
    for tr in arm_obj.animation_data.nla_tracks:
        tr.is_solo = False
        tr.mute = bool(name) and tr.name != name
    for pb in arm_obj.pose.bones:  # NLA REPLACE strips only touch keyed channels; reset the rest
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
    arm_obj.update_tag()
    bpy.context.view_layer.update()

if CHECK:
    # Foot-contact report: lowest contact point per clip, sampled every 1/12 s.
    for name, duration, loop in CLIPS:
        solo(name)
        zs = []
        for f in range(0, round(duration * FPS) + 1, 5):
            scene.frame_set(f)
            zs.append(lowest_point())
        scene.frame_set(0)
        bpy.context.view_layer.update()
        hands = ' '.join(f'{h[0]}Hand=({v.x:+.2f},{v.y:+.2f},{v.z:+.2f})' for h in ('Left', 'Right')
                         for v in [arm_obj.pose.bones[h + 'Hand'].matrix.translation])
        print(f'CHECK {name:14s} lowest point over clip: min {min(zs):+.3f}  max {max(zs):+.3f} m; t=0 {hands}')
    solo('')

if PREVIEW_DIR:
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.render.resolution_x, scene.render.resolution_y = 900, 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'MATERIAL'
    scene.display.shading.show_cavity = True
    scene.display.shading.show_shadows = True
    scene.display.shading.show_object_outline = True
    scene.view_settings.view_transform = 'Standard'
    # Ground grid so foot contact is readable.
    gb = bmesh.new()
    n = 8
    for i in range(-n, n):
        for j in range(-n, n):
            if (i + j) % 2 == 0:
                continue
            vs = [gb.verts.new((i * 0.25, j * 0.25, 0)), gb.verts.new(((i + 1) * 0.25, j * 0.25, 0)),
                  gb.verts.new(((i + 1) * 0.25, (j + 1) * 0.25, 0)), gb.verts.new((i * 0.25, (j + 1) * 0.25, 0))]
            gb.faces.new(vs)
    gm = bpy.data.meshes.new('Ground'); gb.to_mesh(gm); gb.free()
    gm.materials.append(material('GroundTile', 0.35))
    ground = bpy.data.objects.new('Ground', gm); scene.collection.objects.link(ground)
    cam_data = bpy.data.cameras.new('Camera'); cam_data.lens = 50
    cam = bpy.data.objects.new('Camera', cam_data); scene.collection.objects.link(cam); scene.camera = cam
    def aim(loc, target):
        cam.location = Vector(loc)
        cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    def render(name, t, path, view='front-right'):
        solo(name)
        scene.frame_set(round(t * FPS))
        if view == 'front-right':
            aim((1.9, 3.6, 1.5), (0, -0.1, 0.9))     # camera in front (+Y), a little to the character's right (+X)
        elif view == 'side':
            aim((4.2, 0.0, 1.2), (0, -0.1, 0.8))     # camera on the character's right, looking at the profile
        elif view == 'front':
            aim((0.0, 4.2, 1.2), (0, 0, 0.9))
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        print('RENDERED', path)
    render('walk', 0.0, os.path.join(PREVIEW_DIR, 'preview_walk.png'))
    render('sit-idle', 0.0, os.path.join(PREVIEW_DIR, 'preview_sit-idle.png'))
    render('aim-rifle', 0.0, os.path.join(PREVIEW_DIR, 'preview_aim-rifle.png'))
    render('death', 1.6, os.path.join(PREVIEW_DIR, 'preview_death.png'))
    for extra in argv[argv.index('--extra') + 1:] if '--extra' in argv else []:
        name, t, view = (extra.split(':') + ['front-right'])[:3]
        render(name, float(t), os.path.join(PREVIEW_DIR, f'extra_{name}_{t}_{view}.png'), view)
    solo('')
    scene.frame_set(0)
print(f'DONE {time.time() - T0:.1f}s')
