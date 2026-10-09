"""Actual Blender adapter checks; creates only temporary fixtures/reports.

blender -b -noaudio --factory-startup --disable-autoexec --python-exit-code 1 \
  --python tests/mesh_scan/blender_integration.py
"""

import hashlib
import json
from pathlib import Path
import sys
import tempfile

import bpy

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'blender'))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from mesh_scan import extract_object, main, scan_scene
from mesh_scan_select import select_report
from test_mesh_scan import pyramid


def add(data):
    mesh = bpy.data.meshes.new(data['name'])
    mesh.from_pydata(data['vertices'], [], data['faces'])
    mesh.update()
    obj = bpy.data.objects.new(data['name'], mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def rejected(callback, fragment):
    try:
        callback()
    except ValueError as error:
        assert fragment in str(error), str(error)
    else:
        raise AssertionError('Expected rejection: '+fragment)


def test_blender():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    obj = add(pyramid(4))
    result = scan_scene()
    assert result['objects'][0]['simple_shapes'][0]['shape'] == 'pyramid'
    assert result['objects'][0]['counts']['triangles'] == 96
    assert result['overlaps']['triangle_pair_counts'] == {}
    # Scale/rotation and parenting participate in world-space scans.
    parent = bpy.data.objects.new('Parent', None)
    bpy.context.collection.objects.link(parent)
    obj.parent = parent
    parent.scale = (2, 3, 4)
    parent.rotation_euler = (0.2, 0.3, 0.4)
    parent.location = (100, 200, 300)
    bpy.context.view_layer.update()
    result = scan_scene()
    assert result['objects'][0]['simple_shapes'][0]['shape'] == 'pyramid'
    bpy.context.scene.unit_settings.scale_length = 0.01
    unit_scale = bpy.context.scene.unit_settings.scale_length
    scaled = extract_object(obj)
    bpy.context.scene.unit_settings.scale_length = 1
    normal = extract_object(obj)
    assert abs(scaled['vertices'][0][0]/unit_scale-normal['vertices'][0][0]) < 1e-9
    with tempfile.TemporaryDirectory(prefix='mesh-scan-test-') as directory:
        directory = Path(directory)
        source = directory/'fixture.blend'
        bpy.ops.wm.save_as_mainfile(filepath=str(source))
        initial = hashlib.sha256(source.read_bytes()).hexdigest()
        sys.argv = ['blender', '--', str(source), '--output', str(directory/'reports')]
        main()
        assert hashlib.sha256(source.read_bytes()).hexdigest() == initial
        index = json.loads((directory/'reports/index.json').read_text())
        path = directory/'reports'/index[0]['json']
        row = json.loads(path.read_text())['objects'][0]
        obj = bpy.context.scene.objects['Pyramid']  # open_mainfile invalidates old references
        selected = select_report(path, 'Pyramid', 'overbuilt_simple_shape')
        assert len(selected) == 96 and bpy.context.mode == 'EDIT_MESH'
        bpy.ops.object.mode_set(mode='OBJECT')
        obj.data.vertices[0].co.x += 0.02
        rejected(lambda: select_report(path, 'Pyramid'), 'Stale')
        obj.data.vertices[0].co.x -= 0.02
        # A topology-changing modifier produces explicitly evaluated face IDs.
        mod = obj.modifiers.new('Subdivision', 'SUBSURF')
        mod.levels = 1
        evaluated = scan_scene(evaluated=True)
        assert evaluated['objects'][0]['counts']['triangles'] > row['counts']['triangles']
        evaluated_path = directory/'evaluated.json'
        evaluated_path.write_text(json.dumps(evaluated))
        rejected(lambda: select_report(evaluated_path, 'Pyramid'), 'Evaluated')
        obj.modifiers.remove(mod)
        # Test glTF round trip and scene scope through the real importer.
        bpy.ops.object.select_all(action='SELECT')
        glb = directory/'fixture.glb'
        bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB')
        glb_initial = hashlib.sha256(glb.read_bytes()).hexdigest()
        sys.argv = ['blender', '--', str(glb), '--output', str(directory/'glb-reports')]
        main()
        assert hashlib.sha256(glb.read_bytes()).hexdigest() == glb_initial
        assert len(scan_scene(patterns=['Pyr*'])['objects']) == 1
        rejected(lambda: scan_scene(patterns=['Missing']), 'No mesh')
        rejected(lambda: scan_scene(expectations={'Missing': 'box'}), 'outside')
        # A bad asset does not prevent scanning the remaining batch, but fails
        # the command and is retained in the inventory.
        broken = directory/'broken.glb'
        broken.write_bytes(b'not glTF')
        sys.argv = ['blender', '--', str(broken), str(glb), '--output', str(directory/'mixed')]
        try:
            main()
        except RuntimeError:
            pass
        else:
            raise AssertionError('Mixed batch must fail')
        mixed = json.loads((directory/'mixed/index.json').read_text())
        assert len(mixed) == 2 and 'error' in mixed[0] and mixed[1]['complete']
        assert (directory/'mixed/index.md').is_file()
        # Same-polygon n-gon tessellation must not flag itself.
        bpy.ops.wm.read_factory_settings(use_empty=True)
        add({'name':'Concave', 'vertices':[(0,0,0),(2,0,0),(2,1,0),(1,0.5,0),(0,1,0)], 'faces':[(0,1,2,3,4)]})
        assert scan_scene()['overlaps']['triangle_pair_counts'] == {}
        twin = bpy.data.objects.new('ConcaveTwin', bpy.data.objects['Concave'].data.copy())
        bpy.context.collection.objects.link(twin)
        bpy.context.view_layer.update()
        assert scan_scene()['overlaps']['triangle_pair_counts']['coplanar_overlap'] > 0
        # Opt-in gate reports the complete findings before raising.
        sys.argv = ['blender', '--', '--current-scene', '--fail-on-overlap', '--output', str(directory/'gate')]
        try:
            main()
        except RuntimeError:
            pass
        else:
            raise AssertionError('Overlap gate must fail')
        assert json.loads((directory/'gate/index.json').read_text())[0]['complete']
        # Move only the duplicate object: world-space transforms affect the gap.
        twin.location.z = 0.0002
        bpy.context.view_layer.update()
        assert scan_scene()['overlaps']['triangle_pair_counts'].get('near_coplanar_overlap', 0) > 0
        twin.location.z = 0.01
        bpy.context.view_layer.update()
        assert scan_scene()['overlaps']['triangle_pair_counts'] == {}
    print('BLENDER_MESH_SCAN_INTEGRATION_PASS', flush=True)


test_blender()
