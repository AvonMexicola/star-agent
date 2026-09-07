"""Source-preserving Aeon grazer intake and relaxed joint-authored collapse.

ALSOFT_DRIVERS=null blender -b --python-exit-code 1 --python blender/finish_aeon_grazer.py --
Original paint, geometry, skin and walk remain intact; CPU-only studio evidence.
"""
import argparse, hashlib, json, math, statistics, subprocess, sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector, Quaternion
sys.path.insert(0,str(Path(__file__).resolve().parent))
import finish_pyrebear as shared
from finish_pyrebear import (identity, read_glb, view_bytes, gltf_vector, bounds,
    skin_points, load_scene, sample_walk, union_bounds, write_runtime, FEET)
from creature_motion import source_worlds, set_clip
ROOT=Path(__file__).resolve().parents[1]
PACK=SOURCE=OUTPUT=None
SPECIES='aeon-grazer'
SOURCE_SHA='8edeacf0cdb52013d50f1ce2210acc996cfa661fc7adc1f2f8631884296576fd'

def author_death(arm, mesh, doc, fit, duration):
    from finish_pyrebear import sample_walk, skin_points
    scene = bpy.context.scene
    scene.frame_set(0)
    walk_action = arm.animation_data.action
    walk_action.use_fake_user = True
    arm.animation_data.action = None
    arm.animation_data.use_nla = False
    hips = arm.pose.bones['Hips']
    low = min(point.z for point in skin_points(mesh))
    hips.matrix = arm.matrix_world.inverted() @ Matrix.Translation(Vector((0,0,-low))) @ arm.matrix_world @ hips.matrix
    bpy.context.view_layer.update()
    initial = {bone.name: (bone.location.copy(), bone.rotation_quaternion.copy(), bone.scale.copy()) for bone in arm.pose.bones}
    hips_world = arm.matrix_world @ hips.matrix
    pivot = hips_world.translation.copy()
    first_points = skin_points(mesh)
    body_height = max(point.z for point in first_points)
    body_width = max(point.x for point in first_points)-min(point.x for point in first_points)
    groups = {group.index:group.name for group in mesh.vertex_groups}
    torso = []
    head_vertices = []
    foot_vertices = {name:[] for name in ['frontleg2','R_frontleg2','backleg2','R_backleg2']}
    for vertex in mesh.data.vertices:
        weights = {groups[g.group]:g.weight for g in vertex.groups}
        if weights.get('head', 0) > .7: head_vertices.append(vertex.index)
        # Source belly weights span the rigid proximal leg roots as well as
        # Hips/chest. Excluding them mistakes the upper barrel for its support.
        rigid_weight = sum(weights.get(name,0) for name in
          ['Hips','chest','frontleg','R_frontleg','backleg','R_backleg'])
        if rigid_weight > .65 and abs(first_points[vertex.index].x-pivot.x) < body_width*.24:
            torso.append(vertex.index)
        for name in foot_vertices:
            if weights.get(name,0) >= .25: foot_vertices[name].append(vertex.index)
    assert len(torso)>100
    original_feet = {name:arm.matrix_world @ arm.pose.bones[name].matrix for name in foot_vertices}
    sole_offsets = {name:min(first_points[i].z-original_feet[name].translation.z for i in indices) for name,indices in foot_vertices.items()}
    source, parents = source_worlds(doc)
    by_name = {node['name']:i for i,node in enumerate(doc['nodes']) if node.get('name')}
    basis = Matrix.Rotation(math.pi/2,4,'X')
    source_b = {i:fit @ basis @ matrix for i,matrix in source.items()}
    corrections = {bone.name:(arm.matrix_world @ bone.bone.matrix_local).inverted() @ source_b[by_name[bone.name]] for bone in arm.pose.bones}
    tracks = {bone.name:{'translation':[],'rotation':[],'scale':[]} for bone in arm.pose.bones}
    times = []
    def ease(value,start,end):
        t=min(1,max(0,(value-start)/(end-start)))
        return t*t*(3-2*t)
    def turn_bone(bone, rotation):
        world=arm.matrix_world @ bone.matrix
        at=world.translation.copy()
        bone.matrix=arm.matrix_world.inverted() @ Matrix.Translation(at) @ rotation @ Matrix.Translation(-at) @ world
        bpy.context.view_layer.update()
    pole_angles = {}
    def solve_chain(chain, target, side, bend, influence, relaxed_paw=0):
        points=[arm.matrix_world @ bone.head for bone in chain]
        lengths=[(b-a).length for a,b in zip(points,points[1:])]
        anchor=points[0].copy()
        # Exact two-segment distal IK. Keep its bend plane continuous while
        # rotating toward the relaxed outward pole; iterative near-straight
        # solves previously flipped the right foreleg around phase.26.
        delta=target-anchor
        direction=delta.normalized()
        a,b=lengths
        reach=max(abs(a-b)+1e-7,min(delta.length,a+b-1e-7))
        along=(a*a-b*b+reach*reach)/(2*reach)
        height=math.sqrt(max(0,a*a-along*along))
        original_pole=points[1]-anchor
        original_pole-=direction*original_pole.dot(direction)
        desired_pole=Vector((side*body_height*.25,bend*body_height*.12,body_height*.17))
        desired_pole-=direction*desired_pole.dot(direction)
        if original_pole.length<1e-8: original_pole=desired_pole.copy()
        original_pole.normalize();desired_pole.normalize()
        angle=math.atan2(direction.dot(original_pole.cross(desired_pole)),original_pole.dot(desired_pole))
        previous=pole_angles.get(chain[0].name,angle)
        while angle-previous>math.pi:angle-=2*math.pi
        while angle-previous<-math.pi:angle+=2*math.pi
        pole_angles[chain[0].name]=angle
        pole=Quaternion(direction,angle*influence)@original_pole
        solved=[anchor,anchor+direction*along+pole*height,anchor+direction*reach]
        for j,bone in enumerate(chain[:-1]):
            at=arm.matrix_world @ bone.head
            child=arm.matrix_world @ chain[j+1].head
            rotation=(child-at).normalized().rotation_difference((solved[j+1]-solved[j]).normalized())
            turn_bone(bone,rotation.to_matrix().to_4x4())
        foot=chain[-1]
        at=arm.matrix_world @ foot.head
        _,rotation,scale=original_feet[foot.name].decompose()
        if relaxed_paw:
            rotation = (Matrix.Rotation(-side*.65*relaxed_paw,4,'Z') @ Matrix.Rotation(side*.25*relaxed_paw,4,'Y') @ rotation.to_matrix().to_4x4()).to_quaternion()
        foot.matrix=arm.matrix_world.inverted() @ Matrix.LocRotScale(at,rotation,scale)
        bpy.context.view_layer.update()
    for i in range(61):
        phase=i/60;frame=phase*duration*scene.render.fps
        scene.frame_set(math.floor(frame),subframe=frame%1)
        for bone in arm.pose.bones:
            bone.rotation_mode='QUATERNION'
            bone.location,bone.rotation_quaternion,bone.scale=initial[bone.name]
        collapse=ease(phase,.08,.80)
        settle=ease(phase,.58,1)
        fold=ease(phase,.06,.72)
        turn=Matrix.Rotation(math.radians(8)*collapse,4,'Y') @ Matrix.Rotation(.05*collapse,4,'X')
        hips.matrix=arm.matrix_world.inverted() @ Matrix.Translation(pivot) @ turn @ Matrix.Translation(-pivot) @ hips_world
        bpy.context.view_layer.update()
        turn_bone(arm.pose.bones['chest'],Matrix.Rotation(-.42*collapse,4,'X'))
        turn_bone(arm.pose.bones['head'],Matrix.Rotation(-.70*collapse-.16*settle,4,'X'))
        turn_bone(arm.pose.bones['head'],Matrix.Rotation(.22*settle,4,'Y') @ Matrix.Rotation(-.10*settle,4,'Z'))
        # This sparse rig has no separate neck joint. Arc the head origin about
        # the chest pivot, retaining neck length and barrel volume while letting
        # the jaw settle without further rotation of the whole chest.
        neck_base=arm.matrix_world@arm.pose.bones['chest'].head
        head=arm.pose.bones['head']
        head.matrix=arm.matrix_world.inverted() @ Matrix.Translation(neck_base) @ Matrix.Rotation(-.45*settle,4,'X') @ Matrix.Translation(-neck_base) @ arm.matrix_world @ head.matrix
        bpy.context.view_layer.update()
        # Retain the natural curled tail, with a slight relaxed lateral turn.
        tail_pitch=0
        turn_bone(arm.pose.bones['tail'],Matrix.Rotation(tail_pitch,4,'X') @ Matrix.Rotation(.20*collapse,4,'Z'))
        for name in ['tailstart','tail1','tail2','tail3']:
            turn_bone(arm.pose.bones[name],Matrix.Rotation((.30 if name in ['tail1','tail2','tail3'] else .15)*settle,4,'X'))
        points=skin_points(mesh)
        heights=sorted(points[index].z for index in torso)
        # Broad central belly support, excluding peripheral plate tips. A small
        # tolerated hard-tip intersection is preferable to levitating the mass.
        support=heights[max(0,int(len(heights)*.005))]
        drop=(support-.025)*collapse
        hips.matrix=arm.matrix_world.inverted() @ Matrix.Translation(Vector((0,0,-drop))) @ arm.matrix_world @ hips.matrix
        bpy.context.view_layer.update()
        # Relieve head contact locally without lifting the supported torso.
        points = skin_points(mesh)
        head_min = min(points[index].z for index in head_vertices)
        if head_min < -.012:
            head = arm.pose.bones['head']
            head.matrix = arm.matrix_world.inverted() @ Matrix.Translation(Vector((0,0,-.012-head_min))) @ arm.matrix_world @ head.matrix
            bpy.context.view_layer.update()
        for prefix in ['frontleg','R_frontleg','backleg','R_backleg']:
            foot_name=prefix+'2';old=original_feet[foot_name].translation
            side=1 if old.x>pivot.x else -1
            chest=arm.matrix_world @ arm.pose.bones['chest'].head
            hip=arm.matrix_world @ hips.head
            front='front' in prefix
            fore_width = .43 if side > 0 else .34
            front_reach = .13
            relaxed_paw = 0
            goal=Vector((pivot.x+side*body_width*(fore_width if front else .30),
                         chest.y+body_height*front_reach if front else hip.y-body_height*.28,
                         -sole_offsets[foot_name]+.006+.01*relaxed_paw))
            target=old.lerp(goal,fold)
            # Proximal leg weights include the barrel torso. Preserve those bones
            # and fold only distal elbow/knee chains, avoiding body flattening.
            chain=[arm.pose.bones[prefix+suffix] for suffix in ['0','1','2']]
            solve_chain(chain,target,side,1 if front else -1,fold,relaxed_paw)
        for bone in arm.pose.bones:
            for path in ['location','rotation_quaternion','scale']:
                bone.keyframe_insert(data_path=path,frame=frame,group=bone.name)
        posed={by_name[bone.name]:arm.matrix_world @ bone.matrix @ corrections[bone.name] for bone in arm.pose.bones}
        for bone in arm.pose.bones:
            index=by_name[bone.name];parent=parents[index]
            local=(posed[parent] if parent in posed else source_b[parent]).inverted() @ posed[index]
            location,rotation,scale=local.decompose()
            values=[rotation.x,rotation.y,rotation.z,rotation.w]
            previous=tracks[bone.name]['rotation']
            if previous and sum(a*b for a,b in zip(values,previous[-1]))<0: values=[-v for v in values]
            tracks[bone.name]['translation'].append(list(location));tracks[bone.name]['rotation'].append(values);tracks[bone.name]['scale'].append(list(scale))
        times.append(phase*duration)
    action=arm.animation_data.action;action.name='death';action.use_fake_user=True
    samples=sample_walk(arm,mesh)
    return {'duration':duration,'times':times,'tracks':tracks,'samples':samples,'nodeIndices':by_name}

def studio(arm, mesh, out):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 12
    scene.cycles.use_denoising = True
    scene.cycles.seed = 7291
    scene.render.threads_mode = 'FIXED'; scene.render.threads = 4
    scene.render.resolution_x = 800; scene.render.resolution_y = 600
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.exposure = 0
    scene.world = bpy.data.worlds.new('Neutral creature studio')
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes['Background']
    background.inputs['Color'].default_value = (.16, .16, .16, 1)
    background.inputs['Strength'].default_value = .5
    target = Vector((0, 0, 1.15))
    for name, position, energy in [('key', (4, 4, 6), 800), ('fill', (-4, 1, 3), 500), ('rim', (1, -4, 4), 650)]:
        data = bpy.data.lights.new(name, 'AREA'); data.energy = energy; data.size = 4
        obj = bpy.data.objects.new(name, data); scene.collection.objects.link(obj)
        obj.location = position; obj.rotation_euler = (target-obj.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.003))
    floor = bpy.context.object
    material = bpy.data.materials.new('Studio neutral floor'); material.diffuse_color = (.16, .16, .16, 1)
    floor.data.materials.append(material)
    bpy.ops.object.camera_add(); camera = bpy.context.object; scene.camera = camera
    camera.data.type = 'ORTHO'; camera.data.ortho_scale = 6.0
    scene.render.use_stamp = True; scene.render.use_stamp_note = True
    for flag in ['date', 'time', 'render_time', 'frame', 'frame_range', 'memory', 'hostname', 'camera', 'lens', 'scene', 'marker', 'filename']:
        if hasattr(scene.render, 'use_stamp_'+flag): setattr(scene.render, 'use_stamp_'+flag, False)
    scene.render.stamp_font_size = 14
    scene.render.stamp_foreground = (1,1,1,1)
    scene.render.stamp_background = (0,0,0,.8)
    outputs = []
    for name, clip, phase, direction in [('front', 'walk', 0, (0, 6, 1.5)), ('side', 'walk', 0, (6, 0, 1.3)),
                                    ('walk-000', 'walk', 0, (4, 5, 2.6)), ('walk-025', 'walk', .25, (4, 5, 2.6)),
                                    ('walk-050', 'walk', .5, (4, 5, 2.6)), ('walk-075', 'walk', .75, (4, 5, 2.6)),
                                    ('death-mid', 'death', .5, (4, 5, 2.6)), ('death-final', 'death', 1, (4, 5, 2.6)),
                                    ('death-side', 'death', 1, (6, 0, 1.3))]:
        set_clip(clip)
        start, end = arm.animation_data.action.frame_range
        frame = start+(end-start)*phase; scene.frame_set(math.floor(frame), subframe=frame % 1)
        camera.location = target+Vector(direction)
        camera.rotation_euler = (target-camera.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.stamp_note_text = f'BLENDER STUDIO / {SPECIES.upper()} / {name} / NOT GAME EVIDENCE'
        path = out / (name+'.png'); scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        webp = path.with_suffix('.webp')
        subprocess.run(['magick', str(path), '-quality', '90', str(webp)], check=True)
        path.unlink()
        outputs.append({'path': str(webp.relative_to(ROOT)), 'phase': phase, 'cameraBlender': list(camera.location)})
    # Bounded sampled-pose evidence, never represented as a game recording.
    walk_frames=[str(out/(name+'.webp')) for name in ['walk-000','walk-025','walk-050','walk-075']]
    subprocess.run(['magick','-delay','25',*walk_frames,'-loop','0',str(out/'walk-sampled.gif')],check=True)
    subprocess.run(['magick','montage',*walk_frames,'-tile','4x1','-geometry','320x240+2+2','-quality','90',str(out/'walk-strip.webp')],check=True)
    death_frames=[str(out/(name+'.webp')) for name in ['walk-000','death-mid','death-final']]
    subprocess.run(['magick','montage',*death_frames,'-tile','3x1','-geometry','400x300+2+2','-quality','90',str(out/'death-strip.webp')],check=True)
    return outputs


def main():
    global PACK, SOURCE, OUTPUT, SOURCE_SHA, SPECIES
    parser = argparse.ArgumentParser()
    parser.add_argument('--species', choices=['aeon-grazer'], default='aeon-grazer')
    parser.add_argument('--shoulder-height', type=float)
    parser.add_argument('--skip-renders', action='store_true')
    parser.add_argument('--render-only', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    SPECIES = args.species
    PACK = ROOT / 'assets/creatures' / SPECIES
    SOURCE = PACK / 'source' / (SPECIES+'-walking.glb')
    OUTPUT = ROOT / 'public/models/creatures' / (SPECIES+'.glb')
    SOURCE_SHA = '8edeacf0cdb52013d50f1ce2210acc996cfa661fc7adc1f2f8631884296576fd'
    shared.SPECIES, shared.OUTPUT = SPECIES, OUTPUT
    args.shoulder_height = args.shoulder_height or 2.0
    assert 1.5 <= args.shoulder_height <= 3.0
    assert identity(SOURCE)['sha256'] == SOURCE_SHA
    PACK.mkdir(parents=True, exist_ok=True)
    review = PACK / 'review'; review.mkdir(exist_ok=True)
    if args.render_only:
        manifest = json.loads((PACK/'intake.json').read_text())
        assert manifest['runtime'] == identity(OUTPUT), 'Stale studio manifest'
        arm, mesh, _ = load_scene(OUTPUT)
        manifest['studio'] = {'renderer': 'Blender '+bpy.app.version_string+' Cycles CPU',
          'samples': 12, 'threads': 4, 'resolution': [800, 600], 'views': studio(arm, mesh, review)}
        (PACK/'intake.json').write_text(json.dumps(manifest,indent=2)+'\n')
        (OUTPUT.parent/(SPECIES+'-manifest.json')).write_text(json.dumps(manifest,indent=2)+'\n')
        return
    doc, binary = read_glb(SOURCE)
    assert len(doc['meshes']) == len(doc['skins']) == len(doc['animations']) == len(doc['images']) == 1
    arm, mesh, helpers = load_scene(SOURCE)
    source_samples = sample_walk(arm, mesh)
    source_bounds = union_bounds(source_samples)
    original_transforms = [{'name': o.name, 'matrixWorldBlender': [list(row) for row in o.matrix_world]} for o in [arm, mesh]]
    points = skin_points(mesh)
    chest = arm.matrix_world @ arm.pose.bones['chest'].head
    width = source_bounds['max'][0]-source_bounds['min'][0]
    depth = source_bounds['max'][2]-source_bounds['min'][2]
    dorsal = [p for p in points if abs(p.x-chest.x) < width*.2 and abs(p.y-chest.y) < depth*.075]
    assert dorsal
    shoulder_top = max(p.z for p in dorsal)
    lowest = source_bounds['min'][1]
    factor = args.shoulder_height/(shoulder_top-source_samples[0]['bounds']['min'][1])
    centre_x = (source_bounds['min'][0]+source_bounds['max'][0])/2
    centre_y = -(source_bounds['min'][2]+source_bounds['max'][2])/2
    anchor = Vector((centre_x, centre_y, lowest))
    fit = Matrix.Rotation(math.pi, 4, 'Z') @ Matrix.Scale(factor, 4) @ Matrix.Translation(-anchor)
    roots = [o for o in bpy.context.scene.objects if o.parent is None and o.type != 'MESH']
    assert arm in roots
    wrapper = bpy.data.objects.new(SPECIES+'Root', None); bpy.context.scene.collection.objects.link(wrapper)
    for obj in roots:
        matrix = obj.matrix_world.copy(); obj.parent = wrapper; obj.matrix_world = matrix
    wrapper.matrix_world = fit
    bpy.context.view_layer.update()
    # Natural dry hide: source albedo remains authored; the erroneously linked
    # full-albedo emission and metallic defaults are removed, no maps invented.
    for material in mesh.data.materials:
        material.name = SPECIES+' dry hide'
        for shader in material.node_tree.nodes:
            if shader.type != 'BSDF_PRINCIPLED': continue
            emission = shader.inputs.get('Emission Color') or shader.inputs.get('Emission')
            if emission:
                for link in list(emission.links): material.node_tree.links.remove(link)
                emission.default_value = (0, 0, 0, 1)
            shader.inputs['Metallic'].default_value = 0
            shader.inputs['Roughness'].default_value = .85
            if shader.inputs.get('IOR'): shader.inputs['IOR'].default_value = 1.5
            if shader.inputs.get('Specular IOR Level'): shader.inputs['Specular IOR Level'].default_value = .5
    arm.animation_data.action.name = 'walk'
    normalized_samples = sample_walk(arm, mesh, count=241)
    death = author_death(arm, mesh, doc, fit, duration=2.4)
    png = PACK/'source/albedo.png'
    png.write_bytes(view_bytes(doc, binary, doc['images'][0]['bufferView']))
    webp = PACK/(SPECIES+'-albedo.webp')
    subprocess.run(['magick', str(png), '-resize', '1024x1024>', '-quality', '88', str(webp)], check=True)
    preserved, runtime_wrapper = write_runtime(doc, binary, webp.read_bytes(), factor, anchor, normalized_samples, death)
    assert OUTPUT.stat().st_size <= 2_000_000, 'Runtime GLB exceeds character download budget'
    # Reimport actual output to verify skin, animation binding, axes and bounds.
    arm, mesh, output_helpers = load_scene(OUTPUT)
    set_clip('walk')
    output_samples = sample_walk(arm, mesh, count=241)
    max_error = max(abs(a['bounds'][side][axis]-(a['bounds']['min'][1] if axis==1 else 0)-b['bounds'][side][axis])
                    for a, b in zip(normalized_samples, output_samples)
                    for side in ['min', 'max'] for axis in range(3))
    assert max_error < .001, f'Runtime reimport deformation mismatch {max_error}'
    dense_walk = sample_walk(arm, mesh, count=481)
    walk_start=skin_points(mesh)
    scene=bpy.context.scene
    scene.frame_set(round(output_samples[-1]['time']*scene.render.fps))
    walk_end=skin_points(mesh)
    loop_error=max((a-b).length for a,b in zip(walk_start,walk_end))
    # Preserve the supplied walk's small endpoint discrepancy, measured at
    # 3.985mm at2m shoulder. Report it; do not imply a mathematically closed loop.
    assert loop_error < .005, f'Source walk seam exceeds5mm intake ceiling: {loop_error}'
    assert min(s['bounds']['min'][1] for s in dense_walk) >= -.002
    full_bounds = union_bounds(output_samples)
    size = [full_bounds['max'][i]-full_bounds['min'][i] for i in range(3)]
    hips = [s['hips'] for s in output_samples]
    root_span = [max(p[i] for p in hips)-min(p[i] for p in hips) for i in range(3)]
    # Estimate travel speed from backward planted-foot motion in the in-place
    # gait. Low-foot intervals only; this is an estimate, not root displacement.
    stance_speeds = []
    for name in FEET:
        heights = [s['feet'][name]['soleMinY'] for s in output_samples]
        limit = min(heights)+(max(heights)-min(heights))*.35
        for a, b in zip(output_samples, output_samples[1:]):
            if max(a['feet'][name]['soleMinY'], b['feet'][name]['soleMinY']) > limit: continue
            speed = (b['feet'][name]['soleCentre'][2]-a['feet'][name]['soleCentre'][2])/(b['time']-a['time'])
            if speed > 0: stance_speeds.append(speed)
    gait_speed = statistics.median(stance_speeds)
    primitive = doc['meshes'][0]['primitives'][0]
    manifest = {'id': SPECIES, 'displayName': 'Mallow grazer', 'status': 'development-candidate; independent/game review pending',
        'source': identity(SOURCE), 'runtime': identity(OUTPUT), 'builder': 'blender/finish_aeon_grazer.py',
        'coordinates': 'glTF Y-up, metres, front -Z; base-centre across the sampled walk envelope',
        'triangles': doc['accessors'][primitive['indices']]['count']//3,
        'vertices': doc['accessors'][primitive['attributes']['POSITION']]['count'],
        'materials': 1, 'drawPrimitives': 1, 'joints': len(doc['skins'][0]['joints']),
        'texture': {'file': '/models/creatures/'+SPECIES+'.glb (embedded)', 'format': 'WebP', 'maxEdge': 1024,
                    'maps': ['authored baseColor only'], 'roughness': .85, 'metalness': 0, 'emissive': 0},
        'shoulderHeightMetres': args.shoulder_height,
        'shoulderMeasurement': 'Phase-0 dorsal skin maximum within 20% total width and 7.5% depth of chest joint, relative to grounded phase-0 skin minimum; root base uses full61-sample envelope with per-phase grounding',
        'boundsMetres': full_bounds, 'sizeMetres': size,
        'dimensions': {'width':size[0], 'height':size[1], 'length':size[2]},
        'gaitSpeed': round(gait_speed, 1), 'deathDuration': death['duration'],
        'collision': {'halfWidth': max(abs(full_bounds['min'][0]), abs(full_bounds['max'][0])),
                      'halfLength': max(abs(full_bounds['min'][2]), abs(full_bounds['max'][2])), 'height': full_bounds['max'][1]},
        'animation': {'name': 'walk', 'sourceName': doc['animations'][0]['name'], 'durationSeconds': output_samples[-1]['time'],
            'channels': len(doc['animations'][0]['channels'])+1, 'sourceJointChannels': len(doc['animations'][0]['channels']), 'inPlace': True,
            'horizontalRootSpanMetres': [root_span[0], root_span[2]], 'verticalRootBobMetres': root_span[1],
            'rootMotionEdit': 'Source is horizontally in-place. One new wrapper translation track grounds each sampled pose; all81 source joint channels/samplers and non-image buffer data remain intact.',
            'estimatedWalkSpeedMetresPerSecond': gait_speed, 'recommendedWalkSpeedMetresPerSecond': round(gait_speed, 1),
            'speedMethod': 'Median positive backward sole-centre speed across samples in the lowest35% of each weighted foot region height range',
            'footMinYRange': [min(s['bounds']['min'][1] for s in output_samples), max(s['bounds']['min'][1] for s in output_samples)],
            'sampleCount': len(output_samples), 'denseSampleCount':len(dense_walk), 'loopMaxVertexErrorMetres':loop_error,
            'denseGroundMinimumMetres': min(s['bounds']['min'][1] for s in dense_walk),
            'denseGroundMaximumMetres': max(s['bounds']['min'][1] for s in dense_walk)},
        'normalization': {'uniformScale': factor, 'sourceBaseBlender': list(anchor), 'sourceShoulderTopBlenderZ': shoulder_top,
                          'wrapperNode': runtime_wrapper, 'sourceObjectTransforms': original_transforms},
        'validation': {'allNonImageBufferViewsPreservedSha256': preserved, 'allSourceSkinsAccessorsMeshJointChannelsSamplersUnchanged': True,
            'blenderRuntimeReimportMaxBoundsErrorMetres': max_error, 'helperExcludedFromBounds': helpers,
            'actualSampleReport': 'assets/creatures/'+SPECIES+'/deformation-samples.json'},
        'limitations': ['One supplied walk and one Blender-authored death; no attack/idle animation authored.',
                       'The preserved source walk has a measured3.985mm endpoint seam at2m shoulder; not an exact closed loop.',
                       'Studio renders do not establish browser shading, gameplay, performance or independent visual acceptance.',
                       'Gait ground clearance is sampled, not continuously proven; terrain placement belongs to runtime.']}
    (PACK/'deformation-samples.json').write_text(json.dumps({'source': source_samples, 'runtime': output_samples, 'deathAuthored': death['samples']}, indent=2)+'\n')
    set_clip('death')
    death_samples = sample_walk(arm, mesh)
    death_error = max(abs(a['bounds'][side][axis]-b['bounds'][side][axis]) for a,b in zip(death['samples'],death_samples) for side in ['min','max'] for axis in range(3))
    assert death_error < .002, f'Death reimport mismatch {death_error}'
    dense_death = sample_walk(arm, mesh, count=121)
    chains = [[prefix+suffix for suffix in ['', '0', '1', '2']]
              for prefix in ['frontleg','R_frontleg','backleg','R_backleg']]
    def lengths():
        return [(arm.matrix_world@arm.pose.bones[b].head-arm.matrix_world@arm.pose.bones[a].head).length
                for chain in chains for a,b in zip(chain,chain[1:])]
    set_clip('walk'); walk_zero = skin_points(mesh); initial_lengths = lengths()
    set_clip('death'); death_zero = skin_points(mesh)
    start_error = max((a-b).length for a,b in zip(walk_zero,death_zero))
    length_error = step_error = 0; previous = death_zero
    for i in range(121):
        frame = death['duration']*bpy.context.scene.render.fps*i/120
        bpy.context.scene.frame_set(int(frame),subframe=frame%1)
        length_error = max(length_error,max(abs(a-b) for a,b in zip(initial_lengths,lengths())))
        points = skin_points(mesh)
        step_error = max(step_error,max((a-b).length for a,b in zip(previous,points)))
        previous = points
    assert start_error < .002 and length_error < .002
    assert step_error < .1, f'Death sampled vertex step exceeds10cm: {step_error}'
    manifest['validation']['deathMotion'] = {'sampleCount':121,
      'sampleIntervalSeconds':death['duration']/120, 'walkZeroToDeathZeroMaxVertexMetres':start_error,
      'maxLimbJointDistanceChangeMetres':length_error,'maxAdjacentSampleVertexDisplacementMetres':step_error}
    death_minimum = min(s['bounds']['min'][1] for s in dense_death)
    assert death_minimum >= -.03, f'Death contact exceeds30mm tolerance: {death_minimum}'
    manifest['death'] = {'name':'death', 'durationSeconds':death['duration'], 'loop':False, 'holdFinalPose':True, 'authoring':'Blender forward-kneel/belly collapse, 8-degree lean, folded joint-length-constrained limbs, lowered head and relaxed tail; broad torso support with small measured local contact intersections', 'boundsMetres':union_bounds(death_samples), 'finalBoundsMetres':death_samples[-1]['bounds'], 'groundMinimumMetres':min(s['bounds']['min'][1] for s in death_samples), 'reimportBoundsErrorMetres':death_error, 'denseSampleCount':len(dense_death), 'denseGroundMinimumMetres':min(s['bounds']['min'][1] for s in dense_death)}
    set_clip('walk')
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(PACK/(SPECIES+'.blend')))
    if not args.skip_renders:
        manifest['studio'] = {'renderer': 'Blender '+bpy.app.version_string+' Cycles CPU', 'samples': 12,
                              'threads': 4, 'resolution': [800, 600], 'views': studio(arm, mesh, review)}
    elif (PACK/'intake.json').exists():
        previous=json.loads((PACK/'intake.json').read_text())
        # Numerical rebuilds may retain evidence only for the identical GLB.
        if previous.get('runtime') == manifest['runtime'] and 'studio' in previous:
            manifest['studio']=previous['studio']
    assert identity(SOURCE)['sha256'] == SOURCE_SHA
    (PACK/'intake.json').write_text(json.dumps(manifest, indent=2)+'\n')
    (OUTPUT.parent/(SPECIES+'-manifest.json')).write_text(json.dumps(manifest, indent=2)+'\n')
    print(json.dumps({key: manifest[key] for key in ['runtime', 'sizeMetres', 'collision', 'animation', 'normalization']}, indent=2))


if __name__ == '__main__':main()
