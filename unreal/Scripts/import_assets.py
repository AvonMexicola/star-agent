"""Batch-import Star Agent glTF/GLB assets into Unreal Engine 5.8 from asset-manifest.json.

=====================================================================================
UNTESTED. The UE 5.8.2 editor is still being built on the development machine, so
this script has never been executed inside an Unreal Python session. It was written
against the documented 5.x Interchange Python surface and guards every engine call
with hasattr / try-except so that a wrong attribute name fails ONE asset, not the
whole batch. Run it with --dry-run first; read the summary; then fix names here.
=====================================================================================

Run inside the editor (Python Editor Script Plugin enabled):

    # Output Log / Python console
    import importlib, sys; sys.argv = ['import_assets.py', '--dry-run']
    exec(open('/abs/path/star-agent/unreal/Scripts/import_assets.py').read())

    # Commandlet style, from a shell
    UnrealEditor-Cmd StarAgent.uproject -run=pythonscript \
        -script="/abs/path/star-agent/unreal/Scripts/import_assets.py --all"

Options
    --manifest PATH   asset-manifest.json (default: next to this script)
    --repo PATH       repository root that the manifest's `source` paths are relative
                      to (default: two levels above this script, i.e. <repo>/unreal/Scripts)
    --all             also import entries whose loaded_by is empty (studio / library only)
    --category NAME   restrict to one manifest category (repeatable)
    --id ID           restrict to one manifest id (repeatable)
    --dry-run         list what would be imported, touch nothing
    --no-save         do not save the imported packages
    --report PATH     write a JSON report of the run

What it does, and deliberately does not do
    * Only .glb / .gltf sources with a ue_content_path are handled here. Textures,
      audio, fonts, .blend files and JSON contracts are listed by the manifest but
      need their own converters (see README.md).
    * No manual scale or rotation is applied. The Interchange glTF translator already
      converts glTF metres / +Y-up into Unreal centimetres / +Z-up.
    * Mesh combining is switched OFF so that every named glTF node (ramps, gear,
      muzzles, HP_* sockets, MFD quads, ...) survives as its own asset / component.
      The manifest's named_nodes list is printed per asset so the result can be
      checked in the editor.
    * Interchange first, unreal.AssetImportTask as the fallback.
"""

import json
import os
import sys
import time

try:
    import unreal  # type: ignore
except ImportError:  # running outside the editor, e.g. for --dry-run on a shell
    unreal = None


# --------------------------------------------------------------------------- logging
def log(message):
    text = '[star-agent import] ' + str(message)
    if unreal is not None and hasattr(unreal, 'log'):
        unreal.log(text)
    else:
        print(text)


def warn(message):
    text = '[star-agent import] ' + str(message)
    if unreal is not None and hasattr(unreal, 'log_warning'):
        unreal.log_warning(text)
    else:
        print('WARNING ' + text)


# --------------------------------------------------------------------------- arguments
def parse_args(argv):
    """Tiny argv parser; argparse is avoided because -run=pythonscript may hand the
    script a single joined string and we want to be tolerant of unknown flags."""
    opts = {'manifest': None, 'repo': None, 'all': False, 'categories': [], 'ids': [],
            'dry_run': False, 'save': True, 'report': None}
    tokens = []
    for item in argv:
        tokens.extend(str(item).split())
    i = 0
    while i < len(tokens):
        tok = tokens[i]
        nxt = tokens[i + 1] if i + 1 < len(tokens) else None
        if tok == '--manifest' and nxt:
            opts['manifest'] = nxt; i += 2
        elif tok == '--repo' and nxt:
            opts['repo'] = nxt; i += 2
        elif tok == '--category' and nxt:
            opts['categories'].append(nxt); i += 2
        elif tok == '--id' and nxt:
            opts['ids'].append(nxt); i += 2
        elif tok == '--report' and nxt:
            opts['report'] = nxt; i += 2
        elif tok == '--all':
            opts['all'] = True; i += 1
        elif tok == '--dry-run':
            opts['dry_run'] = True; i += 1
        elif tok == '--no-save':
            opts['save'] = False; i += 1
        else:
            i += 1
    return opts


def script_dir():
    try:
        return os.path.dirname(os.path.abspath(__file__))
    except NameError:  # exec()'d from the console: __file__ is undefined
        return os.getcwd()


# --------------------------------------------------------------------------- selection
def select_entries(manifest, opts):
    chosen, skipped = [], []
    for entry in manifest.get('assets', []):
        source = entry.get('source', '')
        reason = None
        if not source.lower().endswith(('.glb', '.gltf')):
            reason = 'not glTF (handled elsewhere)'
        elif not entry.get('ue_content_path'):
            reason = 'no ue_content_path (source-only file)'
        elif not entry.get('loaded_by') and not opts['all']:
            reason = 'not loaded by the game (pass --all to include)'
        elif opts['categories'] and entry.get('category') not in opts['categories']:
            reason = 'category filtered out'
        elif opts['ids'] and entry.get('id') not in opts['ids']:
            reason = 'id filtered out'
        if reason:
            skipped.append((entry.get('id'), reason))
        else:
            chosen.append(entry)
    return chosen, skipped


# --------------------------------------------------------------------------- interchange
def set_if_present(obj, name, value):
    """Set a property only if the object exposes it; report what happened."""
    if obj is None:
        return False
    try:
        if hasattr(obj, 'set_editor_property'):
            obj.set_editor_property(name, value)
            return True
    except Exception as error:  # property missing or wrong type on this engine version
        log('  pipeline.%s not applied (%s)' % (name, error))
        return False
    if hasattr(obj, name):
        try:
            setattr(obj, name, value)
            return True
        except Exception as error:
            log('  pipeline.%s not applied (%s)' % (name, error))
    return False


def build_pipeline(entry):
    """A generic assets pipeline that keeps node names and does not merge meshes.
    Returns None when the class is unavailable; Interchange then uses project defaults."""
    if unreal is None or not hasattr(unreal, 'InterchangeGenericAssetsPipeline'):
        return None
    try:
        pipeline = unreal.InterchangeGenericAssetsPipeline()
    except Exception as error:
        log('  cannot instantiate InterchangeGenericAssetsPipeline: %s' % error)
        return None
    set_if_present(pipeline, 'use_source_name_for_asset', False)
    set_if_present(pipeline, 'asset_name', os.path.basename(entry['ue_content_path']))
    # Sub-pipelines are properties of the generic pipeline in 5.x; each is optional.
    mesh = getattr(pipeline, 'mesh_pipeline', None) if hasattr(pipeline, 'mesh_pipeline') else None
    set_if_present(mesh, 'combine_static_meshes', False)        # keep every named node
    set_if_present(mesh, 'combine_skeletal_meshes', False)
    set_if_present(mesh, 'import_static_meshes', True)
    set_if_present(mesh, 'import_skeletal_meshes', True)
    set_if_present(mesh, 'build_nanite', False)                 # decide per asset later
    common = getattr(pipeline, 'common_meshes_properties', None) if hasattr(pipeline, 'common_meshes_properties') else None
    set_if_present(common, 'bake_meshes', False)                # transforms stay on nodes/pivots
    set_if_present(common, 'recompute_normals', False)
    set_if_present(common, 'use_full_precision_uvs', False)
    anim = getattr(pipeline, 'animation_pipeline', None) if hasattr(pipeline, 'animation_pipeline') else None
    set_if_present(anim, 'import_animations', True)             # walk/death/idle/DoorsOpen/CanopyOpen...
    material = getattr(pipeline, 'material_pipeline', None) if hasattr(pipeline, 'material_pipeline') else None
    set_if_present(material, 'import_materials', True)
    textures = getattr(material, 'texture_pipeline', None) if material is not None and hasattr(material, 'texture_pipeline') else None
    set_if_present(textures, 'import_textures', True)
    set_if_present(textures, 'flip_normal_map_green_channel', False)  # glTF normals are already +Y (OpenGL); Interchange handles it
    return pipeline


def import_with_interchange(source_abs, dest_folder, entry, opts):
    """Return (ok: bool, detail: str). Raises nothing; every failure is reported."""
    if unreal is None or not hasattr(unreal, 'InterchangeManager'):
        return False, 'unreal.InterchangeManager unavailable'
    try:
        manager = unreal.InterchangeManager.get_interchange_manager_scripted()
    except Exception as error:
        return False, 'get_interchange_manager_scripted failed: %s' % error
    try:
        source_data = manager.create_source_data(source_abs)
    except Exception as error:
        return False, 'create_source_data failed: %s' % error
    if source_data is None:
        return False, 'create_source_data returned None (unsupported file?)'
    try:
        params = unreal.ImportAssetParameters()
    except Exception as error:
        return False, 'ImportAssetParameters unavailable: %s' % error
    set_if_present(params, 'is_automated', True)
    set_if_present(params, 'reimport_asset', None)
    pipeline = build_pipeline(entry)
    if pipeline is not None:
        try:
            params.override_pipelines = [pipeline]
        except Exception as error:
            try:
                params.set_editor_property('override_pipelines', [pipeline])
            except Exception as error2:
                log('  override_pipelines not applied (%s / %s); project default pipeline will be used' % (error, error2))
    # Prefer the call that returns results, fall back to the boolean one.
    try:
        if hasattr(manager, 'import_asset_with_result'):
            result = manager.import_asset_with_result(dest_folder, source_data, params)
            return True, 'import_asset_with_result -> %s' % (result,)
        if hasattr(manager, 'import_asset'):
            ok = manager.import_asset(dest_folder, source_data, params)
            return bool(ok), 'import_asset -> %s' % ok
        return False, 'InterchangeManager has neither import_asset_with_result nor import_asset'
    except Exception as error:
        return False, 'Interchange import raised: %s' % error


def import_with_asset_task(source_abs, dest_folder, entry, opts):
    """Legacy fallback: AssetImportTask through AssetTools (uses the glTF factory if present)."""
    if unreal is None or not hasattr(unreal, 'AssetImportTask') or not hasattr(unreal, 'AssetToolsHelpers'):
        return False, 'AssetImportTask / AssetToolsHelpers unavailable'
    try:
        task = unreal.AssetImportTask()
        task.filename = source_abs
        task.destination_path = dest_folder
        task.destination_name = os.path.basename(entry['ue_content_path'])
        task.automated = True
        task.replace_existing = True
        task.save = bool(opts['save'])
        tools = unreal.AssetToolsHelpers.get_asset_tools()
        tools.import_asset_tasks([task])
        imported = []
        try:
            imported = list(task.imported_object_paths)
        except Exception:
            pass
        if imported:
            return True, 'AssetImportTask -> %d objects' % len(imported)
        return False, 'AssetImportTask produced no objects'
    except Exception as error:
        return False, 'AssetImportTask raised: %s' % error


def save_folder(dest_folder):
    if unreal is None or not hasattr(unreal, 'EditorAssetLibrary'):
        return
    try:
        unreal.EditorAssetLibrary.save_directory(dest_folder, only_if_is_dirty=True, recursive=True)
    except Exception as error:
        log('  save_directory(%s) failed: %s' % (dest_folder, error))


# --------------------------------------------------------------------------- main
def main(argv):
    opts = parse_args(argv)
    here = script_dir()
    manifest_path = opts['manifest'] or os.path.join(here, 'asset-manifest.json')
    repo = opts['repo'] or os.path.abspath(os.path.join(here, '..', '..'))
    log('manifest: %s' % manifest_path)
    log('repo root: %s' % repo)
    if unreal is None:
        warn('the unreal module is not importable; only --dry-run makes sense here')
        opts['dry_run'] = True

    with open(manifest_path, 'r') as handle:
        manifest = json.load(handle)
    chosen, skipped = select_entries(manifest, opts)
    log('selected %d glTF entries, skipped %d' % (len(chosen), len(skipped)))

    results = []
    started = time.time()
    for entry in chosen:
        asset_id = entry.get('id')
        source_abs = os.path.normpath(os.path.join(repo, entry['source']))
        dest_folder = entry['ue_content_path'].rstrip('/')
        nodes = entry.get('named_nodes') or []
        log('%s: %s -> %s' % (asset_id, entry['source'], dest_folder))
        if nodes:
            log('  named nodes that must survive (%d): %s' % (len(nodes), ', '.join(nodes[:12]) + (' ...' if len(nodes) > 12 else '')))
        record = {'id': asset_id, 'source': entry['source'], 'destination': dest_folder, 'status': None, 'detail': None}
        if not os.path.exists(source_abs):
            record.update(status='missing', detail='source file not found: %s' % source_abs)
            warn('  MISSING %s' % source_abs)
            results.append(record)
            continue
        if opts['dry_run']:
            record.update(status='dry-run', detail='would import')
            results.append(record)
            continue
        ok, detail = import_with_interchange(source_abs, dest_folder, entry, opts)
        method = 'interchange'
        if not ok:
            log('  Interchange failed (%s); trying AssetImportTask' % detail)
            ok, detail = import_with_asset_task(source_abs, dest_folder, entry, opts)
            method = 'asset-task'
        if ok and opts['save']:
            save_folder(dest_folder)
        record.update(status='imported' if ok else 'failed', detail='%s: %s' % (method, detail))
        (log if ok else warn)('  %s %s' % (record['status'].upper(), detail))
        results.append(record)

    # ---- summary
    counts = {}
    for record in results:
        counts[record['status']] = counts.get(record['status'], 0) + 1
    log('---------------------------------------------------------------')
    log('summary after %.1f s: %s' % (time.time() - started, ', '.join('%s=%d' % kv for kv in sorted(counts.items())) or 'nothing selected'))
    for record in results:
        if record['status'] in ('failed', 'missing'):
            warn('  %s: %s (%s)' % (record['status'], record['id'], record['detail']))
    if skipped:
        by_reason = {}
        for asset_id, reason in skipped:
            by_reason.setdefault(reason, []).append(asset_id)
        for reason, ids in sorted(by_reason.items()):
            log('skipped %d: %s' % (len(ids), reason))
    if opts['report']:
        try:
            with open(opts['report'], 'w') as handle:
                json.dump({'manifest': manifest_path, 'repo': repo, 'options': opts, 'results': results,
                           'skipped': skipped}, handle, indent=2)
            log('report written to %s' % opts['report'])
        except Exception as error:
            warn('could not write report: %s' % error)
    return results


if __name__ == '__main__' or unreal is not None:
    main(sys.argv[1:])
