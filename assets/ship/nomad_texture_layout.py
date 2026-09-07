"""Bind a painting upload to the authored Blender hull and its UV layout."""
import hashlib
import json


def layout_signature():
    import bpy
    material = bpy.data.materials.get('Nomad / hull manufactured PBR')
    if not material:
        raise ValueError('Missing authored hull PBR material')
    objects = sorted((obj for obj in bpy.context.scene.objects
                      if obj.type == 'MESH' and material in list(obj.data.materials)),
                     key=lambda obj: obj.name)
    if not objects:
        raise ValueError('The hull painting set is empty')
    values = []
    for obj in objects:
        if not obj.data.uv_layers.active:
            raise ValueError('Missing original hull UVs')
        values.append({
            'name': obj.name,
            'vertices': [[round(v, 7) for v in obj.matrix_world @ p.co] for p in obj.data.vertices],
            'uv': [[round(v, 7) for v in uv.uv] for uv in obj.data.uv_layers.active.data],
            'polygons': [list(p.vertices) for p in obj.data.polygons],
        })
    return hashlib.sha256(json.dumps(values, separators=(',', ':')).encode()).hexdigest()


def require_signature(record, signature):
    previous = record.get('blenderHullLayoutSha256')
    if not previous:
        raise ValueError('Painting upload has no Blender hull signature; prepare a new upload')
    if previous != signature:
        raise ValueError('Hull geometry/UVs changed after painting; reprepare and validate a new source')
