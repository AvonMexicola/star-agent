"""Star Agent -- retarget the mannequin's animation clips onto another humanoid GLB.

    blender -b --python blender/retarget_clips.py -- source.glb target.glb out.glb \
        [--map mixamo|meshy|auto|MAP.json] [--no-align] [--keep-target-anims] [--fps 60] [--step 1]

    source.glb  animated rig, e.g. public/models/props/mannequin.glb (14 NLA clips)
    target.glb  humanoid with an armature (Meshy / Mixamo export), animations ignored
    out.glb     the target re-exported with every source clip embedded under the same name

Bone-name maps (source bone -> target bone):
    mixamo   target uses the Mixamo names with the "mixamorig:" prefix (also accepts
             "mixamorig_" / "mixamorig" / "mixamorig1:" style prefixes found in the target).
    meshy    exact names first (Meshy's auto-rig ships the Mixamo names without the prefix),
             then the mixamo prefix, then the auto matcher for anything still unmapped.
    auto     fuzzy matching: names are lowercased, prefixes up to ':' are dropped and
             separators removed; left/right is detected from "left"/"right"/"l_"/"_l"/".l"
             tokens; synonyms are recognised (pelvis/hips, upperarm/arm, lowerarm/forearm,
             thigh/upleg, calf/shin/leg, toe/toebase, clavicle/shoulder ...). Spine chains of a
             different length are spread evenly. Bones still unmapped are matched by rest
             position (normalised by character height). The final map is printed.
    MAP.json explicit map, written by hand when auto fails. Format:
                 {"Hips": "pelvis", "Spine": "spine_01", "LeftArm": "upperarm_l", ...}
             Keys are the mannequin's bone names, values the target's bone names. Source
             bones that are missing from the file are left unmapped (the target bone stays
             in its rest pose). Comments are not allowed (plain JSON).
    Default is `auto`.

How the transfer works (per clip, per sampled frame):
    * Both rigs get a "character frame" from their rest pose (right = RightUpLeg - LeftUpLeg,
      up = Head - Hips, forward = up x right), so a source facing -Z and a target facing +Z
      still transfer correctly.
    * For each mapped bone the source's rotation delta (posed vs rest, world space) is
      expressed in the character frame and applied on top of the TARGET's rest rotation, i.e.
      rest-pose differences between the two rigs are preserved instead of copied over.
    * Unless --no-align is given, an extra correction rotates each target bone so its rest
      direction matches the source bone's rest direction (fixes A-pose vs T-pose rigs).
    * Only the Hips translate: the source hips offset from rest is scaled by the ratio of
      leg lengths (UpLeg head -> Foot head) and added to the target hips rest position.
    * Unmapped target bones (fingers, twist bones, ...) are keyed once at rest.
    * The result is one action per clip, pushed onto an NLA track with the clip's name and
      exported with export_animation_mode='NLA_TRACKS' (one glTF animation per clip).
"""
import bpy, math, sys, json, struct, os, re, time
from mathutils import Vector, Matrix, Quaternion

T0 = time.time()
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(argv) < 3:
    raise SystemExit(__doc__)
SRC, TGT, OUT = (os.path.abspath(a) for a in argv[:3])
def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv and argv.index(name) + 1 < len(argv) else default
MAP_MODE = arg('--map', 'auto')
ALIGN = '--no-align' not in argv
KEEP_TARGET_ANIMS = '--keep-target-anims' in argv
FPS = int(arg('--fps', '60'))
STEP = int(arg('--step', '1'))

SOURCE_BONES = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
                'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
                'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
                'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
                'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase']

def log(*a):
    print('[retarget]', *a, flush=True)

# ----------------------------------------------------------------------------- import
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS
scene.unit_settings.system = 'METRIC'

def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    arms = [o for o in new if o.type == 'ARMATURE']
    if not arms:
        raise SystemExit(f'no armature in {path}')
    if len(arms) > 1:
        log(f'warning: {len(arms)} armatures in {path}, using {arms[0].name}')
    return arms[0], new

src, src_objs = import_glb(SRC)
tgt, tgt_objs = import_glb(TGT)
bpy.context.view_layer.update()
log(f'source {os.path.basename(SRC)}: {len(src.data.bones)} bones; target {os.path.basename(TGT)}: {len(tgt.data.bones)} bones')

def source_clips(arm):
    """(name, action, frame_start, frame_end) for every clip the importer created."""
    clips = []
    ad = arm.animation_data
    if not ad:
        raise SystemExit('source has no animation data')
    for tr in ad.nla_tracks:
        for st in tr.strips:
            if st.action:
                clips.append((st.action.name, st.action, st.action_frame_start, st.action_frame_end))
    if ad.action and ad.action not in [c[1] for c in clips]:
        fr = ad.action.frame_range
        clips.append((ad.action.name, ad.action, fr[0], fr[1]))
    if not clips:
        raise SystemExit('source has no animation clips')
    return clips

CLIPS = source_clips(src)
log('clips:', ', '.join(f'{n} ({(e - s) / FPS:.2f}s)' for n, _, s, e in CLIPS))

# Target: drop its own animation unless asked to keep it (the export would otherwise mix them in).
if tgt.animation_data and not KEEP_TARGET_ANIMS:
    for tr in list(tgt.animation_data.nla_tracks):
        tgt.animation_data.nla_tracks.remove(tr)
    tgt.animation_data.action = None
for o in tgt_objs:
    if o is not tgt and o.animation_data and not KEEP_TARGET_ANIMS:
        o.animation_data_clear()

# ----------------------------------------------------------------------------- bone map
def norm(name):
    n = name.lower()
    if ':' in n:
        n = n.rsplit(':', 1)[1]
    return re.sub(r'[^a-z0-9]', '', n)

def side_of(name):
    n = name.lower()
    if ':' in n:
        n = n.rsplit(':', 1)[1]
    if 'left' in n or re.search(r'(^|[_.\-\s])l([_.\-\s]|$)', n) or re.match(r'^l[A-Z_]', name.rsplit(':', 1)[-1] or ''):
        return 'Left'
    if 'right' in n or re.search(r'(^|[_.\-\s])r([_.\-\s]|$)', n) or re.match(r'^r[A-Z_]', name.rsplit(':', 1)[-1] or ''):
        return 'Right'
    return ''

SYNONYMS = {  # canonical (side-less) source bone -> normalised target name fragments
    'Hips': ['hips', 'hip', 'pelvis'],
    'Neck': ['neck'],
    'Head': ['head'],
    'Shoulder': ['shoulder', 'clavicle', 'collar'],
    'Arm': ['upperarm', 'uparm', 'arm', 'humerus'],
    'ForeArm': ['forearm', 'lowerarm', 'elbow', 'ulna'],
    'Hand': ['hand', 'wrist'],
    'UpLeg': ['upleg', 'upperleg', 'thigh', 'femur', 'hipjoint'],
    'Leg': ['leg', 'lowerleg', 'calf', 'shin', 'knee', 'tibia'],
    'Foot': ['foot', 'ankle'],
    'ToeBase': ['toebase', 'toe', 'toes', 'ball'],
}
EXCLUDE = ['twist', 'roll', 'ik', 'pole', 'ctrl', 'control', 'end', 'tip', 'thumb', 'index', 'middle', 'ring', 'pinky', 'eye', 'jaw', 'breast']

def auto_map(src_names, tgt_names):
    """Fuzzy source -> target bone map by names, then rest positions for the leftovers."""
    result = {}
    used = set()
    tnorm = {t: norm(t) for t in tgt_names}
    tside = {t: side_of(t) for t in tgt_names}
    def clean(t):
        return not any(x in tnorm[t] for x in EXCLUDE) or any(tnorm[t] == syn for syns in SYNONYMS.values() for syn in syns)
    def pick(canon, side, exact_first=True):
        cands = [t for t in tgt_names if t not in used and tside[t] == side and clean(t)]
        for syn in SYNONYMS[canon]:
            # exact (after stripping the side token) first, then containment
            exact = [t for t in cands if re.sub(r'left|right|^[lr](?=[a-z])|[lr]$', '', tnorm[t]) == syn]
            if exact:
                return exact[0]
        for syn in SYNONYMS[canon]:
            part = [t for t in cands if syn in tnorm[t]]
            if part:
                # the shortest name wins (avoids "forearm" matching "arm" when both exist)
                part.sort(key=lambda t: len(tnorm[t]))
                # prefer names that do NOT also contain a longer synonym of another bone
                others = [s for c, ss in SYNONYMS.items() if c != canon for s in ss if len(s) > len(syn)]
                part.sort(key=lambda t: any(o in tnorm[t] for o in others))
                return part[0]
        return None
    for s in src_names:
        if s.startswith('Spine'):
            continue
        side = side_of(s)
        canon = s[len(side):] if side else s
        if canon not in SYNONYMS:
            continue
        t = pick(canon, side)
        if t:
            result[s] = t
            used.add(t)
    # Spine chain: every unused centre bone named like a spine/chest, sorted bottom-up.
    spines = [t for t in tgt_names if t not in used and tside[t] == '' and
              any(k in tnorm[t] for k in ('spine', 'chest', 'torso', 'abdomen', 'upperbody')) and clean(t)]
    spines.sort(key=lambda t: (tgt.matrix_world @ tgt.data.bones[t].head_local).z)
    src_spines = [s for s in src_names if s.startswith('Spine')]
    if spines and src_spines:
        if len(spines) >= len(src_spines):
            idx = [round(i * (len(spines) - 1) / max(1, len(src_spines) - 1)) for i in range(len(src_spines))]
            for s, i in zip(src_spines, idx):
                result[s] = spines[i]
        else:
            result[src_spines[0]] = spines[0]
            if len(spines) > 1:
                result[src_spines[-1]] = spines[-1]
        used.update(result[s] for s in src_spines if s in result)
    # Positional fallback for the rest.
    def char_height(arm):
        zs = [(arm.matrix_world @ b.head_local).z for b in arm.data.bones] + [(arm.matrix_world @ b.tail_local).z for b in arm.data.bones]
        return max(zs) - min(zs) or 1.0
    hs, ht = char_height(src), char_height(tgt)
    for s in src_names:
        if s in result or s not in src.data.bones:
            continue
        ps = (src.matrix_world @ src.data.bones[s].head_local) / hs
        best, best_d = None, 0.08
        for t in tgt_names:
            if t in used or not clean(t):
                continue
            pt = (tgt.matrix_world @ tgt.data.bones[t].head_local) / ht
            d = (Vector((abs(ps.x), ps.y, ps.z)) - Vector((abs(pt.x), pt.y, pt.z))).length
            if side_of(s) and tside[t] and side_of(s) != tside[t]:
                continue
            if d < best_d:
                best, best_d = t, d
        if best:
            result[s] = best
            used.add(best)
    return result

def build_map(mode):
    tgt_names = [b.name for b in tgt.data.bones]
    src_names = [b.name for b in src.data.bones]
    if mode.endswith('.json'):
        with open(mode) as f:
            raw = json.load(f)
        m = {s: t for s, t in raw.items() if s in src_names and t in tgt_names}
        for s, t in raw.items():
            if s not in m:
                log(f'warning: map entry {s!r} -> {t!r} ignored (bone not found)')
        return m
    m = {}
    if mode in ('mixamo', 'meshy'):
        prefixes = sorted({n[:-len(n.rsplit(':', 1)[1])] for n in tgt_names if ':' in n} |
                          {n[:len('mixamorig_')] for n in tgt_names if n.lower().startswith('mixamorig_')} |
                          {n[:len('mixamorig')] for n in tgt_names if n.lower().startswith('mixamorig') and not n[len('mixamorig'):len('mixamorig') + 1] in ':_'})
        for s in src_names:
            if mode == 'meshy' and s in tgt_names:
                m[s] = s
                continue
            for p in prefixes:
                if p + s in tgt_names:
                    m[s] = p + s
                    break
    if mode == 'auto' or (mode == 'meshy' and len(m) < len(src_names)):
        auto = auto_map([s for s in src_names if s not in m], [t for t in tgt_names if t not in m.values()])
        m.update(auto)
    return m

BONE_MAP = build_map(MAP_MODE)
log(f'bone map ({MAP_MODE}), {len(BONE_MAP)}/{len(src.data.bones)} source bones mapped:')
for s in [b.name for b in src.data.bones]:
    log(f'    {s:16s} -> {BONE_MAP.get(s, "(unmapped)")}')
for req in ('Hips',):
    if req not in BONE_MAP:
        raise SystemExit(f'cannot retarget without a mapping for {req}')

# ----------------------------------------------------------------------------- frames & rest data
def rot_world(arm, mat):
    return (arm.matrix_world @ mat).to_3x3().normalized()

def rest_rot(arm, bone):
    return rot_world(arm, arm.data.bones[bone].matrix_local)

def rest_pos(arm, bone):
    return arm.matrix_world @ arm.data.bones[bone].head_local

def find(arm, names, mapping=None):
    for n in names:
        b = mapping.get(n) if mapping else n
        if b and b in arm.data.bones:
            return b
    return None

def character_frame(arm, mapping=None):
    """Orthonormal (right, forward, up) frame from the rest pose."""
    hips = find(arm, ['Hips'], mapping)
    head = find(arm, ['Head', 'Neck', 'Spine2', 'Spine1', 'Spine'], mapping)
    lleg = find(arm, ['LeftUpLeg', 'LeftLeg', 'LeftArm', 'LeftShoulder'], mapping)
    rleg = find(arm, ['RightUpLeg', 'RightLeg', 'RightArm', 'RightShoulder'], mapping)
    up = (rest_pos(arm, head) - rest_pos(arm, hips)).normalized() if head and hips else Vector((0, 0, 1))
    right = (rest_pos(arm, rleg) - rest_pos(arm, lleg)) if lleg and rleg else Vector((1, 0, 0))
    right = (right - up * right.dot(up)).normalized()
    fwd = up.cross(right).normalized()
    m = Matrix((right, fwd, up)).transposed()  # columns = axes
    return m

C_src = character_frame(src)
C_tgt = character_frame(tgt, BONE_MAP)
log('source frame fwd', tuple(round(v, 2) for v in C_src.col[1]), ' target frame fwd', tuple(round(v, 2) for v in C_tgt.col[1]))

def leg_length(arm, up, foot):
    if up and foot:
        return (rest_pos(arm, up) - rest_pos(arm, foot)).length
    return None
ls = leg_length(src, find(src, ['LeftUpLeg']), find(src, ['LeftFoot']))
lt = leg_length(tgt, BONE_MAP.get('LeftUpLeg'), BONE_MAP.get('LeftFoot'))
if not ls or not lt:  # fall back to hips height
    ls = rest_pos(src, 'Hips').z
    lt = rest_pos(tgt, BONE_MAP['Hips']).z
HIP_SCALE = lt / ls
log(f'leg length source {ls:.3f} m, target {lt:.3f} m -> hips translation scale {HIP_SCALE:.3f}')

SRC_REST = {s: rest_rot(src, s) for s in BONE_MAP}
TGT_REST = {t: rest_rot(tgt, t) for t in BONE_MAP.values()}
ALIGN_ROT = {}
for s, t in BONE_MAP.items():
    a_s = C_src.inverted() @ (SRC_REST[s] @ Vector((0, 1, 0)))
    a_t = C_tgt.inverted() @ (TGT_REST[t] @ Vector((0, 1, 0)))
    ALIGN_ROT[t] = (C_tgt @ a_t.rotation_difference(a_s).to_matrix() @ C_tgt.inverted()) if ALIGN else Matrix.Identity(3)
TGT_ORDER = []  # parents first
def walk_bones(b):
    TGT_ORDER.append(b.name)
    for c in b.children:
        walk_bones(c)
for b in tgt.data.bones:
    if b.parent is None:
        walk_bones(b)
T2S = {t: s for s, t in BONE_MAP.items()}
tgt_world_inv = tgt.matrix_world.inverted()
tgt_rot_world = tgt.matrix_world.to_3x3().normalized()
tgt_rot_world_inv = tgt_rot_world.inverted()
hips_t = BONE_MAP['Hips']
hips_rest_world_t = rest_pos(tgt, hips_t)
hips_rest_world_s = rest_pos(src, 'Hips')

def action_fcurves(act):
    return [fc for layer in act.layers for strip in layer.strips for cb in strip.channelbags for fc in cb.fcurves]

# ----------------------------------------------------------------------------- transfer
src.animation_data.use_nla = False
for tr in src.animation_data.nla_tracks:
    tr.mute = True
tgt.animation_data_create()
for pb in tgt.pose.bones:
    pb.rotation_mode = 'QUATERNION'
    pb.location = (0, 0, 0)
    pb.rotation_quaternion = (1, 0, 0, 0)
    pb.scale = (1, 1, 1)

for name, act, f0, f1 in CLIPS:
    src.animation_data.action = act
    if act.slots and src.animation_data.action_slot is None:
        src.animation_data.action_slot = act.slots[0]
    new_act = bpy.data.actions.new(name + '_tgt')
    tgt.animation_data.action = new_act
    frames = list(range(int(round(f0)), int(round(f1)) + 1, STEP))
    if frames[-1] != int(round(f1)):
        frames.append(int(round(f1)))
    prev_q = {}
    for f in frames:
        scene.frame_set(f)
        bpy.context.view_layer.update()
        pose_mats = {}  # target armature-space pose matrices, parents first
        for t in TGT_ORDER:
            tb = tgt.data.bones[t]
            if tb.parent is None:
                chain = tb.matrix_local.copy()
            else:
                chain = pose_mats[tb.parent.name] @ tb.parent.matrix_local.inverted() @ tb.matrix_local
            s = T2S.get(t)
            if s is None:
                pose_mats[t] = chain
                continue
            R_pose_s = rot_world(src, src.pose.bones[s].matrix)
            D = R_pose_s @ SRC_REST[s].inverted()                       # world delta on the source
            D_t = C_tgt @ (C_src.inverted() @ D @ C_src) @ C_tgt.inverted()  # same delta in the target's frame
            R_world = D_t @ ALIGN_ROT[t] @ TGT_REST[t]
            R_arm = tgt_rot_world_inv @ R_world
            M = R_arm.to_4x4()
            if s == 'Hips':
                d_world_s = (src.matrix_world @ src.pose.bones[s].matrix.translation) - hips_rest_world_s
                d_t = C_tgt @ ((C_src.inverted() @ d_world_s) * HIP_SCALE)
                M.translation = tgt_world_inv @ (hips_rest_world_t + d_t)
            else:
                M.translation = chain.translation
            pose_mats[t] = M
            basis = chain.inverted() @ M if tb.parent is None else (pose_mats[tb.parent.name] @ tb.parent.matrix_local.inverted() @ tb.matrix_local).inverted() @ M
            pb = tgt.pose.bones[t]
            q = basis.to_quaternion().normalized()
            if t in prev_q and prev_q[t].dot(q) < 0:
                q.negate()
            prev_q[t] = q
            pb.rotation_quaternion = q
            pb.keyframe_insert('rotation_quaternion', frame=f)
            if s == 'Hips':
                pb.location = basis.to_translation()
                pb.keyframe_insert('location', frame=f)
        if f == frames[0]:  # unmapped bones: hold rest
            for t in TGT_ORDER:
                if t not in T2S:
                    pb = tgt.pose.bones[t]
                    pb.rotation_quaternion = (1, 0, 0, 0)
                    pb.keyframe_insert('rotation_quaternion', frame=f)
    for fc in action_fcurves(new_act):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR' if STEP == 1 else 'BEZIER'
    new_act.use_frame_range = True
    new_act.frame_start, new_act.frame_end = int(round(f0)), int(round(f1))
    tgt.animation_data.action = None
    new_act.name = name  # free the name now that the source action is about to be deleted
    track = tgt.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, int(round(f0)), new_act)
    strip.name = name
    track.mute = True
    log(f'retargeted {name}: frames {int(round(f0))}-{int(round(f1))} ({(f1 - f0) / FPS:.2f}s)')

src.animation_data.action = None
for tr in tgt.animation_data.nla_tracks:
    tr.mute = False
    tr.is_solo = False
scene.frame_set(0)

# ----------------------------------------------------------------------------- export
for o in src_objs:
    bpy.data.objects.remove(o, do_unlink=True)
for _, act, _, _ in CLIPS:
    if act.users == 0:
        bpy.data.actions.remove(act)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', export_apply=False, export_yup=True,
    export_animations=True, export_animation_mode='NLA_TRACKS', export_nla_strips=True,
    export_force_sampling=True, export_frame_range=False, export_frame_step=1,
    export_optimize_animation_size=True, export_optimize_animation_keep_anim_armature=True,
    export_rest_position_armature=True, export_skins=True, export_def_bones=False,
    export_lights=False, export_cameras=False, export_extras=False,
    export_materials='EXPORT', export_image_format='AUTO', use_selection=False)

# --- GLB post-process (same helper as build_mannequin.py): drop the constant translation/scale
# channels the sampled export writes for every bone, keep rotations for all bones, repack.
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

strip_constant_channels(OUT, keep_translation=(hips_t,))
gltf, _ = read_glb(OUT)
anims = [(a['name'], max(gltf['accessors'][s['input']]['max'][0] for s in a['samplers'])) for a in gltf.get('animations', [])]
log(f'EXPORTED {OUT}: {os.path.getsize(OUT) / 1e6:.3f} MB, {len(anims)} animations, {time.time() - T0:.1f}s')
for n, d in anims:
    log(f'    {n:14s} {d:.3f}s')
