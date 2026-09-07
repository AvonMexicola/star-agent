"""Read-only GLB inspection with three labelled Blender studio renders.

blender -b --python blender/review_shop_soft_props.py -- \
    --source assets/path/source.glb --out /tmp/soft-prop-studio

The source is never exported or saved. Import orientation, geometry and PBR maps
are retained. A parent transform uniformly fits the longest extent to one studio
unit and moves the base centre to zero, solely for framing. These images are
Blender studio evidence, not game-renderer, runtime-scale or acceptance evidence.
"""

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


ROOT = Path(__file__).resolve().parents[1]


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--resolution', type=int, default=768)
    parser.add_argument('--samples', type=int, default=24)
    parser.add_argument('--threads', type=int, default=4)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    args.source, args.out = args.source.resolve(), args.out.resolve()
    if not args.source.is_file() or args.source.suffix.lower() != '.glb':
        parser.error('--source must be an existing GLB')
    if args.out.is_relative_to((ROOT / 'public').resolve()):
        parser.error('Studio evidence must be written outside public/')
    if min(args.resolution, args.samples, args.threads) < 1:
        parser.error('Resolution, samples and threads must be positive')
    return args


def identity(path):
    data = path.read_bytes()
    return {'path': str(path), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def rows(matrix):
    return [list(row) for row in matrix]


def bounds(points):
    lo = [min(point[i] for point in points) for i in range(3)]
    hi = [max(point[i] for point in points) for i in range(3)]
    return {'min': lo, 'max': hi, 'size': [hi[i] - lo[i] for i in range(3)]}


def inspect_source(objects):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mesh_rows, points = [], []
    materials = set()
    for obj in objects:
        if obj.type != 'MESH':
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh(preserve_all_data_layers=True, depsgraph=depsgraph)
        try:
            mesh.calc_loop_triangles()
            world_points = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
            if any(not all(math.isfinite(v) for v in point) for point in world_points):
                raise RuntimeError(f'Non-finite geometry in {obj.name}')
            points.extend(world_points)
            uv_rows = []
            for layer in mesh.uv_layers:
                coords = [list(loop.uv) for loop in layer.data]
                finite = [uv for uv in coords if all(math.isfinite(v) for v in uv)]
                uv_rows.append({
                    'name': layer.name, 'loopCount': len(coords),
                    'nonFiniteLoops': len(coords) - len(finite),
                    'min': [min(uv[i] for uv in finite) for i in range(2)] if finite else None,
                    'max': [max(uv[i] for uv in finite) for i in range(2)] if finite else None,
                })
            assigned = [slot.material for slot in obj.material_slots if slot.material]
            materials.update(assigned)
            mesh_rows.append({
                'name': obj.name, 'vertices': len(mesh.vertices),
                'polygons': len(mesh.polygons), 'triangles': len(mesh.loop_triangles),
                'materialSlots': [slot.material.name if slot.material else None for slot in obj.material_slots],
                'usedMaterialSlotIndices': sorted({polygon.material_index for polygon in mesh.polygons}),
                'uvLayers': uv_rows,
                'boundsBlenderWorld': bounds(world_points) if world_points else None,
                'modifiers': [{'name': mod.name, 'type': mod.type} for mod in obj.modifiers],
            })
        finally:
            evaluated.to_mesh_clear()
    if not points:
        raise RuntimeError('The GLB has no inspectable mesh vertices')
    material_rows, images = [], set()
    for material in sorted(materials, key=lambda item: item.name):
        nodes = list(material.node_tree.nodes) if material.use_nodes else []
        image_nodes = []
        for node in nodes:
            if node.type == 'TEX_IMAGE' and node.image:
                images.add(node.image)
                image_nodes.append({'node': node.name, 'image': node.image.name})
        principled = []
        for node in nodes:
            if node.type != 'BSDF_PRINCIPLED':
                continue
            inputs = {}
            for name in ['Base Color', 'Metallic', 'Roughness', 'Alpha', 'Normal']:
                socket = node.inputs.get(name)
                if socket is None:
                    continue
                value = socket.default_value
                inputs[name] = {'linked': socket.is_linked,
                                'default': float(value) if isinstance(value, (int, float)) else list(value)}
            principled.append({'node': node.name, 'inputs': inputs})
        material_rows.append({'name': material.name, 'useNodes': material.use_nodes,
                              'backfaceCulling': material.use_backface_culling,
                              'imageNodes': image_nodes, 'principled': principled})
    source_bounds = bounds(points)
    lo, hi = source_bounds['min'], source_bounds['max']
    return {
        'coordinateSystem': 'Imported Blender world XYZ, Z up. glTF XYZ = Blender X,Z,-Y.',
        'meshCount': len(mesh_rows), 'triangles': sum(row['triangles'] for row in mesh_rows),
        'materialCount': len(material_rows), 'meshes': mesh_rows, 'materials': material_rows,
        'boundsBlenderWorld': source_bounds,
        'boundsGltfWorld': {'min': [lo[0], lo[2], -hi[1]], 'max': [hi[0], hi[2], -lo[1]],
                            'size': [hi[0]-lo[0], hi[2]-lo[2], hi[1]-lo[1]]},
        'images': [{'name': image.name, 'width': image.size[0], 'height': image.size[1],
                    'channels': image.channels, 'colorSpace': image.colorspace_settings.name,
                    'packed': bool(image.packed_file)} for image in sorted(images, key=lambda item: item.name)],
        'objects': [{'name': obj.name, 'type': obj.type, 'parent': obj.parent.name if obj.parent else None,
                     'matrixLocal': rows(obj.matrix_local), 'matrixWorld': rows(obj.matrix_world),
                     'hideRender': obj.hide_render} for obj in objects],
        'animationActions': [action.name for action in bpy.data.actions],
    }, points


def area_light(name, position, energy, size, target):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.shape, data.size = energy, 'DISK', size
    data.color = (1, 1, 1)
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (target - obj.location).to_track_quat('-Z', 'Y').to_euler()
    return obj


def main():
    args = arguments()
    original = identity(args.source)
    args.out.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(args.source))
    scene = bpy.context.scene
    bpy.context.view_layer.update()
    imported = list(scene.objects)
    metadata, source_points = inspect_source(imported)

    lo, hi = (Vector(metadata['boundsBlenderWorld'][key]) for key in ('min', 'max'))
    largest = max(hi - lo)
    if largest <= 1e-9:
        raise RuntimeError('Degenerate asset bounds cannot be fitted')
    factor = 1 / largest
    anchor = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    fit = Matrix.Scale(factor, 4) @ Matrix.Translation(-anchor)
    wrapper = bpy.data.objects.new('Studio framing only', None)
    scene.collection.objects.link(wrapper)
    for obj in imported:
        if obj.parent is None:
            world = obj.matrix_world.copy()
            obj.parent = wrapper
            obj.matrix_world = world
        if obj.type in {'LIGHT', 'CAMERA'}:
            obj.hide_render = True
    wrapper.matrix_world = fit
    bpy.context.view_layer.update()
    fitted_points = [fit @ point for point in source_points]
    target = Vector((0, 0, (hi.z - lo.z) * factor / 2))

    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = args.samples
    scene.cycles.use_denoising = True
    scene.cycles.seed = 7291
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = args.threads
    scene.render.resolution_x = scene.render.resolution_y = args.resolution
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    scene.world = bpy.data.worlds.new('Neutral studio world')
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get('Background')
    background.inputs['Color'].default_value = (.18, .18, .18, 1)
    background.inputs['Strength'].default_value = .5
    area_light('Neutral key', (-3, -4, 5), 450, 4, target)
    area_light('Neutral fill', (4, -1, 3), 250, 4, target)
    area_light('Neutral rear fill', (1, 4, 3), 350, 3, target)
    underside_light = area_light('Underside inspection fill', (1, -3, -4), 400, 4, target)

    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.006))
    floor = bpy.context.object
    floor.name = 'Studio support plane (removed for underside view)'
    material = bpy.data.materials.new('Neutral studio floor')
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (.18, .18, .18, 1)
    shader.inputs['Roughness'].default_value = .85
    floor.data.materials.append(material)
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.name = 'Studio inspection camera'
    camera.data.type = 'ORTHO'
    scene.camera = camera
    scene.render.use_stamp = True
    for flag in ['date', 'time', 'render_time', 'frame', 'frame_range', 'memory', 'hostname',
                 'camera', 'lens', 'scene', 'marker', 'filename', 'sequence_strip']:
        if hasattr(scene.render, f'use_stamp_{flag}'):
            setattr(scene.render, f'use_stamp_{flag}', False)
    scene.render.use_stamp_note = True
    scene.render.stamp_font_size = 14
    scene.render.stamp_foreground = (1, 1, 1, 1)
    scene.render.stamp_background = (0, 0, 0, .8)

    report = {'status': 'rendering', 'evidenceType': 'Blender studio; not game evidence or asset acceptance',
              'source': original, 'sourceMetadata': metadata,
              'reviewTransform': {'uniformScale': factor, 'sourceBaseCentreBlender': list(anchor),
                                  'matrixBlender': rows(fit), 'rotationApplied': False,
                                  'boundsBlender': bounds(fitted_points),
                                  'purpose': 'Framing only; original proportions and import orientation retained'},
              'render': {'blender': bpy.app.version_string, 'engine': 'Cycles', 'device': 'CPU',
                         'threads': args.threads, 'samples': args.samples, 'denoising': True,
                         'resolution': [args.resolution, args.resolution], 'viewTransform': 'AgX',
                         'exposure': 0, 'seed': 7291}, 'views': []}
    report_path = args.out / 'inspection.json'

    def write_report():
        report_path.write_text(json.dumps(report, indent=2, allow_nan=False) + '\n')

    write_report()
    for name, direction in [('front-oblique', (2, -3, 2)),
                            ('opposite-oblique', (-2, 3, 2)),
                            ('underside', (1.2, -2, -3))]:
        camera.location = target + Vector(direction).normalized() * 4
        camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        projected = [camera.matrix_world.inverted() @ point for point in fitted_points]
        # Symmetric framing about the actual bounds centre leaves padding for
        # the source silhouette and the studio-evidence stamp.
        camera.data.ortho_scale = max(max(abs(point.x), abs(point.y)) for point in projected) * 2.65
        floor.hide_render = name == 'underside'
        underside_light.hide_render = name != 'underside'
        scene.render.stamp_note_text = f'BLENDER STUDIO / {name} / NOT GAME EVIDENCE'
        path = args.out / f'{name}.png'
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        report['views'].append({'name': name, 'image': path.name, 'sha256': identity(path)['sha256'],
                                'cameraPositionBlender': list(camera.location), 'lookAtBlender': list(target),
                                'orthographicScale': camera.data.ortho_scale,
                                'supportPlaneVisible': not floor.hide_render,
                                'undersideFillEnabled': not underside_light.hide_render})
        write_report()
    report['sourceUnchanged'] = identity(args.source) == original
    if not report['sourceUnchanged']:
        raise RuntimeError('Input source changed during inspection')
    report['status'] = 'studio-rendered-unreviewed'
    write_report()
    print(json.dumps({'report': str(report_path), 'triangles': metadata['triangles'],
                      'materials': metadata['materialCount'], 'sourceUnchanged': True}, indent=2))


if __name__ == '__main__':
    main()
