"""Blender entry point: blender -b --python blender/mesh_scan.py -- ...

See docs/mesh-cleanup.md. Imports/opens inputs in memory; never saves a model.
"""

import argparse
from collections import Counter
from dataclasses import fields
import fnmatch
import hashlib
import json
import math
from pathlib import Path
import struct
import sys
import time

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mesh_scan_core import Settings, scan


def mesh_fingerprint(obj, mesh, unit_scale):
    digest = hashlib.sha256()
    digest.update(struct.pack('<d', unit_scale))
    for row in obj.matrix_world:
        digest.update(struct.pack('<4d', *row))
    for vertex in mesh.vertices:
        digest.update(struct.pack('<3d', *vertex.co))
    for polygon in mesh.polygons:
        digest.update(struct.pack('<I', len(polygon.vertices)))
        for index in polygon.vertices:
            digest.update(struct.pack('<I', index))
    return digest.hexdigest()


def extract_object(obj, evaluated=False, expect_shape=None):
    scale = bpy.context.scene.unit_settings.scale_length
    owner = obj.evaluated_get(bpy.context.evaluated_depsgraph_get()) if evaluated else obj
    mesh = owner.to_mesh(preserve_all_data_layers=True,
                         depsgraph=bpy.context.evaluated_depsgraph_get()) if evaluated else obj.data
    try:
        mesh.calc_loop_triangles()
        matrix = [tuple(row) for row in owner.matrix_world]
        # Python doubles rather than converting world-space positions to float32.
        points = [tuple(scale * (sum(matrix[k][j]*v.co[j] for j in range(3))+matrix[k][3])
                        for k in range(3)) for v in mesh.vertices]
        if not all(math.isfinite(x) for p in points for x in p):
            raise ValueError(f'{obj.name}: non-finite coordinates')
        return {"name": obj.name, "vertices": points,
                "faces": [tuple(p.vertices) for p in mesh.polygons],
                "triangles": [(tuple(t.vertices), t.polygon_index) for t in mesh.loop_triangles],
                "edges": [tuple(e.vertices) for e in mesh.edges], "expect_shape": expect_shape,
                "metadata": {"mesh": mesh.name, "parent": obj.parent.name if obj.parent else None,
                             "geometry_sha256": mesh_fingerprint(owner, mesh, scale),
                             "face_id_space": "evaluated" if evaluated else "source",
                             "materials": [m.name if m else None for m in mesh.materials],
                             "uv_layers": list(mesh.uv_layers.keys()),
                             "color_attributes": [{"name": a.name, "domain": a.domain,
                                                   "data_type": a.data_type} for a in mesh.color_attributes],
                             "custom_normals": mesh.has_custom_normals,
                             "shape_keys": bool(obj.data.shape_keys),
                             "vertex_groups": len(obj.vertex_groups),
                             "modifiers": [{"name": m.name, "type": m.type,
                                            "viewport": m.show_viewport, "render": m.show_render}
                                           for m in obj.modifiers],
                             "hide_render": obj.hide_render, "hide_viewport": obj.hide_viewport}}
    finally:
        if evaluated:
            owner.to_mesh_clear()


def scan_scene(cfg=None, evaluated=False, patterns=(), selected=False, expectations=None):
    if bpy.context.mode != 'OBJECT':
        raise ValueError('Scan in Object Mode so face IDs refer to synchronized source meshes.')
    objects = [o for o in bpy.context.scene.objects if o.type == 'MESH'
               and (not selected or o.select_get())
               and (not patterns or any(fnmatch.fnmatchcase(o.name, p) for p in patterns))]
    if not objects:
        raise ValueError('No mesh objects match the scan scope.')
    expectations = expectations or {}
    missing = set(expectations)-{o.name for o in objects}
    if missing:
        raise ValueError(f'Expected-shape object names are outside the scan scope: {sorted(missing)}')
    result = scan([extract_object(o, evaluated, expectations.get(o.name)) for o in objects], cfg)
    result['scene'] = {"blender_version": bpy.app.version_string, "frame": bpy.context.scene.frame_current,
                       "unit_scale_metres": bpy.context.scene.unit_settings.scale_length,
                       "mode": "evaluated_viewport" if evaluated else "source",
                       "scope": {"objects": list(patterns), "selected_only": selected},
                       "instance_policy": "Scene mesh objects only; collection/Geometry Nodes instances must be realized in a review copy.",
                       "visibility_policy": "Includes hidden mesh objects in scope; compare their runtime visibility before repair."}
    return result


def markdown(report):
    lines = ['# Blender mesh scan', '', f"Source: `{report.get('source', {}).get('path', '<current scene>')}`",
             f"Scan: **{'complete' if report['complete'] else 'INCOMPLETE — candidate limit reached'}**",
             f"Geometry: {report['scene']['mode']}; frame {report['scene']['frame']}; Blender {report['scene']['blender_version']}",
             '', 'Read-only findings for inspection. A scan does not establish art acceptance or visible Z-fighting.', '',
             '| Object | Triangles | Welded boundary / non-manifold edges | Findings |',
             '| --- | ---: | ---: | --- |']
    for obj in report['objects']:
        name = obj['name'].replace('|', '\\|').replace('\n', ' ')
        topology = obj['welded_topology']
        kinds = ', '.join(sorted({f['kind'] for f in obj['findings']})) or '—'
        lines.append(f"| {name} | {obj['counts']['triangles']} | {topology['boundary']['count']} / {topology['non_manifold']['count']} | {kinds} |")
    lines += ['', '## Overlapping surfaces', '',
              f"Triangle pairs: {report['overlaps']['triangle_pair_counts'] or 'none detected'}. "
              f"Broad-phase candidates checked: {report['overlaps']['candidate_pairs_checked']}.", '',
              'Counts are triangle pairs, not unique defects. JSON samples retain both object names, polygon IDs, separation and overlap area.', '']
    for item in report['overlaps']['samples']:
        lines.append(f"- {item['kind']}: `{item['a']['object']}` face {item['a']['face']} ↔ "
                     f"`{item['b']['object']}` face {item['b']['face']}; gap {item['separation_metres']:.6g} m.")
    for obj in report['objects']:
        if obj['findings']:
            lines += ['', f"## {obj['name']}", '']
            for finding in obj['findings']:
                ids = finding['faces']
                detail = {k: v for k, v in finding.items() if k not in ('kind', 'faces')}
                lines.append(f"- **{finding['kind']}**: {ids['count']} faces; sample `{ids['sample']}`"
                             f"{' (truncated)' if ids['truncated'] else ''}. {json.dumps(detail, sort_keys=True)}")
    lines += ['', '## Review order', '',
              '1. Confirm the input hash, frame, source/evaluated mode, visibility and thresholds.',
              '2. Inspect exact overlap and degenerate geometry first; classify intentional shells/decals.',
              '3. Inspect boundary/winding/sliver warnings against the intended construction.',
              '4. Simplify one flat region or primitive at a time, preserving silhouette and asset contracts.',
              '5. Re-scan source and final GLB, then inspect the actual game renderer in motion.', '',
              'Instructions: `docs/mesh-cleanup.md`. Samples may be capped; full counts remain in JSON.', '']
    return '\n'.join(lines)


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('inputs', nargs='*', help='.blend/.glb/.gltf files or directories')
    parser.add_argument('--output', required=True, type=Path, help='Report directory, outside model sources')
    parser.add_argument('--recursive', action='store_true', help='Recurse through input directories')
    parser.add_argument('--current-scene', action='store_true', help='Scan already open scene instead of input files')
    parser.add_argument('--selected', action='store_true', help='Only selected mesh objects')
    parser.add_argument('--object', action='append', default=[], help='Object-name glob; repeatable')
    parser.add_argument('--evaluated', action='store_true', help='Viewport modifier/pose snapshot; face IDs differ from source')
    parser.add_argument('--expect', action='append', default=[], metavar='OBJECT=SHAPE', help='Known intent: pyramid, box or wedge')
    parser.add_argument('--fail-on-overlap', action='store_true', help='Raise after reporting any exact coplanar overlaps')
    defaults = Settings()
    for field in fields(Settings):
        default = getattr(defaults, field.name)
        parser.add_argument('--'+field.name.replace('_', '-'), type=type(default), default=default)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if bool(args.inputs) == args.current_scene:
        parser.error('Provide input paths or --current-scene, exclusively.')
    for field in fields(Settings):
        value = getattr(args, field.name)
        if not math.isfinite(value) or value <= 0:
            parser.error(f'{field.name} must be finite and positive')
    if args.angle_degrees >= 90:
        parser.error('angle-degrees must be below 90')
    if args.overlap_distance < args.weld_distance:
        parser.error('overlap-distance must be at least weld-distance')
    expectations = {}
    for item in args.expect:
        name, separator, shape = item.rpartition('=')
        if not separator or not name or shape not in ('pyramid', 'box', 'wedge'):
            parser.error('--expect requires OBJECT=pyramid|box|wedge')
        expectations[name] = shape
    return args, Settings(**{f.name: getattr(args, f.name) for f in fields(Settings)}), expectations


def input_paths(inputs, recursive):
    paths = set()
    for item in inputs:
        path = Path(item).resolve()
        if path.is_dir():
            paths.update(p.resolve() for p in (path.rglob('*') if recursive else path.iterdir())
                         if p.is_file() and p.suffix.lower() in ('.blend', '.glb', '.gltf'))
        elif path.is_file() and path.suffix.lower() in ('.blend', '.glb', '.gltf'):
            paths.add(path)
        else:
            raise ValueError(f'Unsupported/missing input: {path}')
    if not paths:
        raise ValueError('No supported model files found.')
    return sorted(paths)


def scan_input(path, args, cfg, expectations):
    if path:
        if path.suffix.lower() == '.blend':
            bpy.ops.wm.open_mainfile(filepath=str(path), load_ui=False, use_scripts=False)
        else:
            bpy.ops.wm.read_factory_settings(use_empty=True)
            bpy.ops.import_scene.gltf(filepath=str(path))
    return scan_scene(cfg, args.evaluated, args.object, args.selected, expectations)


def index_markdown(index):
    lines = ['# Mesh scan inventory', '',
             'Inspect candidates before repair. Counts refer to triangle pairs and sampled findings.', '',
             '| Model | Complete | Triangles | Coplanar / nearby pairs | Findings |',
             '| --- | --- | ---: | ---: | --- |']
    for row in index:
        name = Path(row['source']['path']).name if row['source']['path'] else 'current scene'
        name = name.replace('|', '\\|')
        if 'error' in row:
            lines.append(f"| {name} | ERROR | — | — | {row['error'].replace('|', '/').replace(chr(10), ' ')} |")
            continue
        counts = row['overlap_triangle_pairs']
        findings = ', '.join(f'{k}: {v}' for k, v in sorted(row['finding_counts'].items())) or '—'
        lines.append(f"| [{name}]({row['markdown']}) | {'yes' if row['complete'] else 'INCOMPLETE'} | "
                     f"{row['triangles']} | {counts.get('coplanar_overlap', 0)} / "
                     f"{counts.get('near_coplanar_overlap', 0)} | {findings} |")
    return '\n'.join(lines)+'\n'


def main():
    args, cfg, expectations = parse_args()
    paths = [None] if args.current_scene else input_paths(args.inputs, args.recursive)
    args.output.mkdir(parents=True, exist_ok=True)
    index, failure = [], False
    for path in paths:
        started = time.monotonic()
        try:
            result = scan_input(path, args, cfg, expectations)
        except Exception as error:
            index.append({"source": {"path": str(path) if path else None}, "complete": False,
                          "error": f'{type(error).__name__}: {error}'})
            failure = True
            print(f"MESH_SCAN_ERROR {path or '<current scene>'}: {error}", flush=True)
            continue
        source_hash = None
        if path:
            with path.open('rb') as source_file:
                source_hash = hashlib.file_digest(source_file, 'sha256').hexdigest()
        result['source'] = {"path": str(path) if path else bpy.data.filepath or None,
                            "sha256": source_hash,
                            "identity_note": "For .gltf, file hash excludes external buffers/textures; geometry hashes cover scanned meshes."}
        result['elapsed_seconds'] = round(time.monotonic()-started, 3)
        key = (path.name+'.'+hashlib.sha256(str(path).encode()).hexdigest()[:8]) if path else 'current-scene'
        json_path, md_path = args.output/(key+'.json'), args.output/(key+'.md')
        json_path.write_text(json.dumps(result, indent=2, sort_keys=True)+'\n')
        md_path.write_text(markdown(result))
        counts = result['overlaps']['triangle_pair_counts']
        index.append({"source": result['source'], "json": json_path.name, "markdown": md_path.name,
                      "complete": result['complete'], "triangles": sum(o['counts']['triangles'] for o in result['objects']),
                      "overlap_triangle_pairs": counts,
                      "finding_counts": dict(Counter(f['kind'] for o in result['objects'] for f in o['findings']))})
        failure |= not result['complete'] or (args.fail_on_overlap and counts.get('coplanar_overlap', 0) > 0)
        print(f"MESH_SCAN {path or '<current scene>'}: {index[-1]['triangles']} triangles; "
              f"complete={result['complete']}; reports={json_path}", flush=True)
    (args.output/'index.json').write_text(json.dumps(index, indent=2, sort_keys=True)+'\n')
    (args.output/'index.md').write_text(index_markdown(index))
    if failure:
        raise RuntimeError('Mesh scan incomplete, input failed or --fail-on-overlap triggered. Reports were written; inspect index.json.')


if __name__ == '__main__':
    main()
