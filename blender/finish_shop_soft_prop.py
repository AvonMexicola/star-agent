"""Normalise a Meshy textile export using the shared Blender asset cleaner.

env ALSOFT_DRIVERS=null blender -b --python-exit-code 1 --python blender/finish_shop_soft_prop.py -- --id ID --source FILE.glb
Writes a processed GLB, editable blend and measured intake receipt outside public.
Source is retained unchanged. Visual acceptance remains a separate game review.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path
import bpy
from mathutils import Matrix

sys.path.insert(0, str(Path(__file__).resolve().parent))
import clean_asset as clean

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'assets/station-shop/soft-props'
p = argparse.ArgumentParser()
p.add_argument('--id', required=True)
p.add_argument('--source', required=True)
a = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
brief = json.loads((PACK / 'brief.json').read_text())
spec = next((item for item in brief['props'] if item['id'] == a.id), None)
if spec is None:
    p.error('Unknown prop ID')
source = Path(a.source).resolve()
output = PACK / 'processed' / a.id
output.mkdir(parents=True, exist_ok=True)
clean.reset_scene()
meshes = clean.do_import(str(source))
if clean.armature_objects():
    raise RuntimeError('Textile dressing must be static; inspect the unexpected rig.')
for mesh in meshes:
    world = mesh.matrix_world.copy()
    mesh.parent = None
    mesh.matrix_world = world
meshes = clean.do_join(meshes)
clean.apply_transforms(meshes)
if len(meshes) != 1:
    raise RuntimeError('Expected a single joined mesh.')
mesh = meshes[0]
mesh.name = a.id
materials = {slot.material for slot in mesh.material_slots if slot.material}
if len(materials) != 1:
    raise RuntimeError('Expected one authored PBR atlas; bake multiple materials before intake.')
if not mesh.data.uv_layers:
    raise RuntimeError('Missing UVs; cannot preserve generated textile maps.')

# These flat textile samples use their thinnest AABB axis as vertical and longest
# as depth. Save the exact transform and inspect the result; this is not a general
# orientation rule for characters or arbitrarily shaped props.
lo, hi = clean.world_bbox(meshes)
source_size = hi - lo
axes = sorted(range(3), key=lambda i: source_size[i])
vertical, across, length = axes
rows = []
for axis in (across, length, vertical):
    rows.append([1 if i == axis else 0 for i in range(3)])
rotation = Matrix(rows)
if rotation.determinant() < 0:
    for i in range(3):
        rotation[0][i] *= -1
mesh.matrix_world = rotation.to_4x4() @ mesh.matrix_world
clean.apply_transforms(meshes)
lo, hi = clean.world_bbox(meshes)
size = hi - lo
# Uniformly fit all three limits, preserving fabric/strap proportions.
limits = spec['targetSizeMetres']
factor = min(limits[0] / size.x, limits[2] / size.y, limits[1] / size.z)
mesh.scale *= factor
bpy.context.view_layer.update()
clean.apply_transforms(meshes)
# Preserve the selected source topology when it already meets the cap.
# Trim small provider overshoot to the cap rather than applying the
# original aspirational target again and discarding already reviewed folds.
source_triangles = clean.count_tris(meshes)
if source_triangles > spec['maxTriangles'] * 1.1:
    raise RuntimeError(
        f'{source_triangles} triangles exceed the {spec["maxTriangles"]} cap by more than 10%. '
        'Review the source and budget before cleanup; automatic reduction only trims small overshoot.')
budget = min(source_triangles, spec['maxTriangles'])
before, after = clean.do_decimate(meshes, budget)
clean.set_origin(meshes, 'base')
clean.clamp_textures(brief['intake']['maxTextureEdge'])
for mat in materials:
    mat.name = a.id + '-textile'
    mat['stationFinished'] = True
    mat['unweathered'] = True
clean.select_only(meshes)
lo, hi = clean.world_bbox(meshes)
size = hi - lo
if after > spec['maxTriangles']:
    raise RuntimeError('Triangle budget exceeded after cleanup.')
mesh['sourceProvider'] = 'Meshy'
mesh['propId'] = a.id
mesh['originConvention'] = 'base-centre, metres, glTF Y-up'
mesh['intakeStatus'] = 'measured-unreviewed'
glb = output / (a.id + '.glb')
bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', use_selection=True,
    export_yup=True, export_apply=True, export_materials='EXPORT',
    export_image_format='WEBP', export_image_quality=86,
    export_image_webp_fallback=False, export_animations=False, export_skins=False,
    export_extras=True)
bpy.ops.wm.save_as_mainfile(filepath=str(output / (a.id + '.blend')))

def identity(path):
    data = path.read_bytes()
    return {'file':str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path),
            'bytes':len(data), 'sha256':hashlib.sha256(data).hexdigest()}

report = {'id':a.id, 'status':'measured-unreviewed', 'source':identity(source),
          'runtimeCandidate':identity(glb), 'trianglesBefore':before, 'triangles':after,
          'cleanupTriangleTarget':budget, 'providerTriangleTarget':spec['targetTriangles'],
          'triangleCap':spec['maxTriangles'],
          'materials':len(materials), 'uniformScale':factor,
          'sourceBlenderSize':list(source_size), 'orientationMatrix':list(map(list, rotation)),
          'sizeMetres':[size.x,size.z,size.y],
          'boundsMetres':{'min':[lo.x,lo.z,-hi.y], 'max':[hi.x,hi.z,-lo.y]},
          'textures':[{'name':image.name,'width':image.size[0],'height':image.size[1]}
                      for image in bpy.data.images if image.size[0] and image.name != 'Render Result'],
          'proposedHubBasePosition':spec['proposedHubBasePosition'],
          'notes':'Native source preserved; WEBP PBR export and geometry reduction require visual verification.'}
(output / 'intake.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
if glb.stat().st_size > brief['intake']['maxGlbBytesPerProp']:
    raise RuntimeError('GLB exceeds byte budget; candidate was retained for diagnosis, not accepted.')
