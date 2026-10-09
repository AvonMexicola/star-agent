"""Select report polygon samples in an unchanged SOURCE mesh, in memory only.

Blender Python console: import mesh_scan_select; mesh_scan_select.select_report(...)
"""

import json
from pathlib import Path
import bpy
from mesh_scan import mesh_fingerprint


def select_report(report_path, object_name, kind=None):
    report = json.loads(Path(report_path).read_text())
    row = next(o for o in report['objects'] if o['name'] == object_name)
    obj = bpy.context.scene.objects.get(object_name)
    if obj is None or obj.type != 'MESH':
        raise ValueError('Report object is not a mesh in the current scene.')
    if obj.name not in bpy.context.view_layer.objects:
        raise ValueError('Object is excluded from the active view layer; enable its collection first.')
    if bpy.context.mode != 'OBJECT':
        raise ValueError('Switch to Object Mode before selecting report faces.')
    if row['metadata']['face_id_space'] != 'source':
        raise ValueError('Evaluated face IDs cannot be selected on a source mesh; rescan source mode.')
    if mesh_fingerprint(obj, obj.data, bpy.context.scene.unit_settings.scale_length) != row['metadata']['geometry_sha256']:
        raise ValueError('Stale/different geometry or transform; rescan before selecting.')
    ids = set()
    for finding in row['findings']:
        if kind is None or kind == finding['kind']:
            ids.update(finding['faces']['sample'])
    for item in report['overlaps']['samples']:
        if kind is None or kind == item['kind']:
            ids.update(item[side]['face'] for side in ('a', 'b') if item[side]['object'] == object_name)
    if not ids:
        raise ValueError('No sampled faces for that object/kind.')
    if obj.hide_get() or obj.hide_viewport:
        raise ValueError('Make the review object visible first.')
    # Shared datablocks would propagate selection into other objects. Require a
    # deliberate review copy instead of silently changing all linked instances.
    if obj.data.users > 1:
        raise ValueError('Linked mesh: make a single-user review copy before selecting.')
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    for v in obj.data.vertices:
        v.select = False
    for e in obj.data.edges:
        e.select = False
    for p in obj.data.polygons:
        p.select = p.index in ids
    bpy.context.tool_settings.mesh_select_mode = (False, False, True)
    bpy.ops.object.mode_set(mode='EDIT')
    print(f'Selected {len(ids)} sampled faces; no model saved. Truncated findings require further inspection.')
    return sorted(ids)
