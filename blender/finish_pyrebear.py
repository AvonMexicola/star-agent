"""Rig-preserving Pyrebear intake, exact source retention and CPU studio evidence.

ALSOFT_DRIVERS=null blender -b --python-exit-code 1 --python blender/finish_pyrebear.py -- \
    --shoulder-height 1.65

Requires the existing Blender and ImageMagick tools. Nothing is fetched/generated.
Blender measures the evaluated skin and saves the editable normalized rig. Runtime
GLB emission deliberately preserves every non-image bufferView byte-for-byte;
only a non-animated parent wrapper, material settings, clip name and WebP change.
Studio images are not game evidence or independent acceptance.
"""
import argparse
import copy
import hashlib
import json
import math
import statistics
import struct
import subprocess
import sys
from pathlib import Path

import bpy
sys.path.insert(0, str(Path(__file__).resolve().parent))
from creature_motion import author_death, append_motion, set_clip
from mathutils import Matrix, Vector, Quaternion

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'assets/creatures/pyrebear'
SOURCE = PACK / 'source/pyrebear-walking.glb'
OUTPUT = ROOT / 'public/models/creatures/pyrebear.glb'
SPECIES = 'pyrebear'
SOURCE_SHA = 'b6125970f013a62ee02b294308ff4dbf4de6c0e28915efc7d1e18ab0e31d9dd8'
FEET = ['frontleg2', 'R_frontleg2', 'backleg2', 'R_backleg2']


def identity(path):
    data = path.read_bytes()
    return {'path': str(path.relative_to(ROOT)), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def read_glb(path):
    raw = path.read_bytes()
    magic, version, total = struct.unpack_from('<4sII', raw)
    assert magic == b'glTF' and version == 2 and total == len(raw)
    size, kind = struct.unpack_from('<II', raw, 12)
    assert kind == 0x4e4f534a
    doc = json.loads(raw[20:20+size])
    length, kind = struct.unpack_from('<II', raw, 20+size)
    assert kind == 0x004e4942
    return doc, raw[28+size:28+size+length]


def view_bytes(doc, binary, index):
    view = doc['bufferViews'][index]
    assert view.get('buffer', 0) == 0
    start = view.get('byteOffset', 0)
    return binary[start:start+view['byteLength']]


def gltf_vector(v):
    return [v[0], v[2], -v[1]]


def bounds(points):
    return {'min': [min(p[i] for p in points) for i in range(3)],
            'max': [max(p[i] for p in points) for i in range(3)]}


def skin_points(mesh):
    deps = bpy.context.evaluated_depsgraph_get()
    evaluated = mesh.evaluated_get(deps)
    data = evaluated.to_mesh(preserve_all_data_layers=True, depsgraph=deps)
    try:
        return [evaluated.matrix_world @ v.co for v in data.vertices]
    finally:
        evaluated.to_mesh_clear()


def load_scene(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.view_layer.update()
    arms = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)]
    assert len(arms) == len(meshes) == 1, 'Expected one skinned mesh and one rig'
    # The importer creates an Icosphere custom bone-display helper. It is not a
    # source GLB primitive and must not enter visible bounds, exports or renders.
    helpers = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o not in meshes]
    for helper in helpers:
        helper.hide_render = True
    return arms[0], meshes[0], [o.name for o in helpers]


def sample_walk(arm, mesh, count=61):
    scene = bpy.context.scene
    action = arm.animation_data.action
    start, end = action.frame_range
    groups = {g.index: g.name for g in mesh.vertex_groups}
    foot_indices = {name: [] for name in FEET}
    for vertex in mesh.data.vertices:
        for item in vertex.groups:
            name = groups[item.group]
            if name in foot_indices and item.weight >= .25:
                foot_indices[name].append(vertex.index)
    samples = []
    for i in range(count):
        frame = start + (end-start)*i/(count-1)
        scene.frame_set(math.floor(frame), subframe=frame % 1)
        points = skin_points(mesh)
        feet = {}
        for name, indices in foot_indices.items():
            selected = [points[index] for index in indices]
            assert selected, f'Missing weighted foot region {name}'
            lowest = min(p.z for p in selected)
            extent = max(p.z for p in selected)-lowest
            sole = [p for p in selected if p.z <= lowest + extent*.15]
            centre = sum(sole, Vector())/len(sole)
            feet[name] = {'soleMinY': lowest, 'soleCentre': gltf_vector(centre),
                          'joint': gltf_vector(arm.matrix_world @ arm.pose.bones[name].head)}
        samples.append({'time': (frame-start)/scene.render.fps, 'phase': i/(count-1),
                        'bounds': bounds([gltf_vector(p) for p in points]),
                        'hips': gltf_vector(arm.matrix_world @ arm.pose.bones['Hips'].head),
                        'chest': gltf_vector(arm.matrix_world @ arm.pose.bones['chest'].head), 'feet': feet})
    scene.frame_set(math.floor(start), subframe=start % 1)
    return samples


def union_bounds(samples):
    return {'min': [min(s['bounds']['min'][i] for s in samples) for i in range(3)],
            'max': [max(s['bounds']['max'][i] for s in samples) for i in range(3)]}


def write_runtime(doc, binary, image, factor, anchor, walk_samples, death):
    result = copy.deepcopy(doc)
    image_view = result['images'][0]['bufferView']
    output = bytearray()
    preserved = {}
    for i, view in enumerate(result['bufferViews']):
        data = image if i == image_view else view_bytes(doc, binary, i)
        output.extend(b'\0' * (-len(output) % 4))
        view['byteOffset'] = len(output)
        view['byteLength'] = len(data)
        output.extend(data)
        if i != image_view:
            preserved[str(i)] = hashlib.sha256(data).hexdigest()
    result['buffers'][0]['byteLength'] = len(output)
    result['images'][0]['mimeType'] = 'image/webp'
    for texture in result['textures']:
        source = texture.pop('source')
        texture['extensions'] = {'EXT_texture_webp': {'source': source}}
    material = result['materials'][0]
    material['name'] = SPECIES+' dry hide'
    material.pop('emissiveTexture', None)
    material['emissiveFactor'] = [0, 0, 0]
    material.pop('extensions', None)
    material['pbrMetallicRoughness']['metallicFactor'] = 0
    material['pbrMetallicRoughness']['roughnessFactor'] = .85
    result['extensionsUsed'] = ['EXT_texture_webp']
    result['extensionsRequired'] = ['EXT_texture_webp']
    for animation in result['animations']:
        animation['name'] = 'walk'
    # glTF is Y-up. The source faces +Z; a Y half-turn points it toward -Z.
    # Translation equals -R*anchor*scale, matching Blender R*S*T(-anchor).
    ag = gltf_vector(anchor)
    wrapper = {'name': SPECIES+'Root', 'children': list(result['scenes'][0]['nodes']),
               'rotation': [0, 1, 0, 0], 'scale': [factor]*3,
               'translation': [ag[0]*factor, -ag[1]*factor, ag[2]*factor],
               'extras': {'origin': 'base-centre over full sampled walk', 'front': '-Z',
                          'units': 'metres', 'assetStatus': 'development-candidate'}}
    result['scenes'][0]['nodes'] = [len(result['nodes'])]
    result['nodes'].append(wrapper)
    append_motion(result, output, wrapper, walk_samples, death)
    result['buffers'][0]['byteLength'] = len(output)
    encoded = json.dumps(result, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    output += b'\0' * (-len(output) % 4)
    glb = struct.pack('<4sII', b'glTF', 2, 28+len(encoded)+len(output))
    glb += struct.pack('<II', len(encoded), 0x4e4f534a)+encoded
    glb += struct.pack('<II', len(output), 0x004e4942)+output
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(glb)
    check, check_binary = read_glb(OUTPUT)
    for key, digest in preserved.items():
        assert hashlib.sha256(view_bytes(check, check_binary, int(key))).hexdigest() == digest
    assert check['skins'] == doc['skins']
    assert check['meshes'] == doc['meshes']
    assert check['accessors'][:len(doc['accessors'])] == doc['accessors']
    for old, new in zip(doc['animations'], check['animations']):
        assert old['channels'] == new['channels'][:len(old['channels'])] and old['samplers'] == new['samplers'][:len(old['samplers'])]
    return preserved, wrapper


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
    target = Vector((0, 0, .85 if SPECIES=='pyrebear' else .5))
    for name, position, energy in [('key', (4, 4, 6), 800), ('fill', (-4, 1, 3), 500), ('rim', (1, -4, 4), 650)]:
        data = bpy.data.lights.new(name, 'AREA'); data.energy = energy; data.size = 4
        obj = bpy.data.objects.new(name, data); scene.collection.objects.link(obj)
        obj.location = position; obj.rotation_euler = (target-obj.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.003))
    floor = bpy.context.object
    material = bpy.data.materials.new('Studio neutral floor'); material.diffuse_color = (.16, .16, .16, 1)
    floor.data.materials.append(material)
    bpy.ops.object.camera_add(); camera = bpy.context.object; scene.camera = camera
    camera.data.type = 'ORTHO'; camera.data.ortho_scale = 4.5 if SPECIES=='pyrebear' else 2.8
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
    return outputs


def main():
    global PACK, SOURCE, OUTPUT, SOURCE_SHA, SPECIES
    parser = argparse.ArgumentParser()
    parser.add_argument('--species', choices=['pyrebear', 'suloher-dog'], default='pyrebear')
    parser.add_argument('--shoulder-height', type=float)
    parser.add_argument('--skip-renders', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    SPECIES = args.species
    PACK = ROOT / 'assets/creatures' / SPECIES
    SOURCE = PACK / 'source' / (SPECIES+'-walking.glb')
    OUTPUT = ROOT / 'public/models/creatures' / (SPECIES+'.glb')
    SOURCE_SHA = {'pyrebear': 'b6125970f013a62ee02b294308ff4dbf4de6c0e28915efc7d1e18ab0e31d9dd8', 'suloher-dog': 'ef480bbc3142bc9dbb7b620ecfc4bf109a81f56d1dcfb99edabf22ea4592cc0d'}[SPECIES]
    args.shoulder_height = args.shoulder_height or (1.65 if SPECIES=='pyrebear' else .85)
    assert .5 <= args.shoulder_height <= 1.8
    assert identity(SOURCE)['sha256'] == SOURCE_SHA
    PACK.mkdir(parents=True, exist_ok=True)
    review = PACK / 'review'; review.mkdir(exist_ok=True)
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
    death = author_death(arm, mesh, doc, fit, duration=1.8 if SPECIES=='pyrebear' else 1.2)
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
    manifest = {'id': SPECIES, 'status': 'development-candidate; independent/game review pending',
        'source': identity(SOURCE), 'runtime': identity(OUTPUT), 'builder': 'blender/finish_pyrebear.py',
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
            'sampleCount': len(output_samples), 'denseSampleCount':len(dense_walk),
            'denseGroundMinimumMetres': min(s['bounds']['min'][1] for s in dense_walk),
            'denseGroundMaximumMetres': max(s['bounds']['min'][1] for s in dense_walk)},
        'normalization': {'uniformScale': factor, 'sourceBaseBlender': list(anchor), 'sourceShoulderTopBlenderZ': shoulder_top,
                          'wrapperNode': runtime_wrapper, 'sourceObjectTransforms': original_transforms},
        'validation': {'allNonImageBufferViewsPreservedSha256': preserved, 'allSourceSkinsAccessorsMeshJointChannelsSamplersUnchanged': True,
            'blenderRuntimeReimportMaxBoundsErrorMetres': max_error, 'helperExcludedFromBounds': helpers,
            'actualSampleReport': 'assets/creatures/'+SPECIES+'/deformation-samples.json'},
        'limitations': ['One supplied walk and one Blender-authored death; no attack/idle animation authored.',
                       'Studio renders do not establish browser shading, gameplay, performance or independent visual acceptance.',
                       'Gait ground clearance is sampled, not continuously proven; terrain placement belongs to runtime.']}
    (PACK/'deformation-samples.json').write_text(json.dumps({'source': source_samples, 'runtime': output_samples, 'deathAuthored': death['samples']}, indent=2)+'\n')
    set_clip('death')
    death_samples = sample_walk(arm, mesh)
    death_error = max(abs(a['bounds'][side][axis]-b['bounds'][side][axis]) for a,b in zip(death['samples'],death_samples) for side in ['min','max'] for axis in range(3))
    assert death_error < .002, f'Death reimport mismatch {death_error}'
    dense_death = sample_walk(arm, mesh, count=121)
    assert min(s['bounds']['min'][1] for s in dense_death) >= -.03, 'Death contact exceeds documented30mm tolerance'
    manifest['death'] = {'name':'death', 'durationSeconds':death['duration'], 'loop':False, 'holdFinalPose':True, 'authoring':'Blender forward-kneel/belly collapse, 12-degree lean, folded joint-length-constrained limbs, lowered chest/head/pelvis and relaxed tail; broad torso support with small measured local contact intersections', 'boundsMetres':union_bounds(death_samples), 'finalBoundsMetres':death_samples[-1]['bounds'], 'groundMinimumMetres':min(s['bounds']['min'][1] for s in death_samples), 'reimportBoundsErrorMetres':death_error, 'denseSampleCount':len(dense_death), 'denseGroundMinimumMetres':min(s['bounds']['min'][1] for s in dense_death)}
    set_clip('walk')
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(PACK/(SPECIES+'.blend')))
    if not args.skip_renders:
        manifest['studio'] = {'renderer': 'Blender '+bpy.app.version_string+' Cycles CPU', 'samples': 12,
                              'threads': 4, 'resolution': [800, 600], 'views': studio(arm, mesh, review)}
    assert identity(SOURCE)['sha256'] == SOURCE_SHA
    (PACK/'intake.json').write_text(json.dumps(manifest, indent=2)+'\n')
    (OUTPUT.parent/(SPECIES+'-manifest.json')).write_text(json.dumps(manifest, indent=2)+'\n')
    print(json.dumps({key: manifest[key] for key in ['runtime', 'sizeMetres', 'collision', 'animation', 'normalization']}, indent=2))


if __name__ == '__main__':
    sys.modules['finish_pyrebear'] = sys.modules[__name__]
    main()
