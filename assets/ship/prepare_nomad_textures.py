"""Export one opaque painting shell with the original hull atlas, without a rig.

blender -b assets/ship/nomad.blend --python-exit-code 1 --python assets/ship/prepare_nomad_textures.py
Only the upload copy is joined. Runtime geometry and its animation hierarchy are
never replaced by a generated mesh. The saved .blend is left untouched.
"""
from pathlib import Path
import hashlib
import json
import struct
import sys
import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from nomad_texture_layout import layout_signature

ROOT=Path(__file__).resolve().parents[2]
# Bind the original authored hierarchy/UVs before creating the disposable copy.
signature=layout_signature()
material=bpy.data.materials.get('Nomad / hull manufactured PBR')
if not material:raise ValueError('Rebuild the textured Nomad before preparing its painting shell')
albedo=next(node.image for node in material.node_tree.nodes if node.type=='TEX_IMAGE' and node.image.name.endswith('/ albedo'))
paint=bpy.data.materials.new('Nomad painting shell / authored basecolour');paint.use_nodes=True
p=paint.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.55;p.inputs['Metallic'].default_value=0
image=paint.node_tree.nodes.new('ShaderNodeTexImage');image.image=albedo
paint.node_tree.links.new(image.outputs['Color'],p.inputs['Base Color'])
source=[obj for obj in bpy.context.scene.objects if obj.type=='MESH' and material in list(obj.data.materials)]
if not source:raise ValueError('The hull painting set is empty')
copies=[]
for obj in source:
    duplicate=obj.copy();duplicate.data=obj.data.copy();bpy.context.collection.objects.link(duplicate)
    matrix=obj.matrix_world.copy();duplicate.parent=None;duplicate.matrix_world=matrix
    duplicate.data.materials.clear();duplicate.data.materials.append(paint);copies.append(duplicate)
bpy.ops.object.select_all(action='DESELECT')
for obj in copies:obj.select_set(True)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();shell=bpy.context.object;shell.name='NomadPaintingShell'
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'assets/ship/nomad-meshy-input.glb'),export_format='GLB',use_selection=True,
    export_image_format='AUTO',export_yup=True,export_apply=True,export_extras=False,export_animations=False)
path=ROOT/'assets/ship/nomad-meshy-input.glb';raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+length]);binary=memoryview(raw)[28+length:]
if len(doc['meshes'])!=1 or len(doc['materials'])!=1 or len(doc['images'])!=1:raise ValueError('Expected one painting mesh/material/image')
primitive=doc['meshes'][0]['primitives'][0];uv=doc['accessors'][primitive['attributes']['TEXCOORD_0']];view=doc['bufferViews'][uv['bufferView']]
uv_bytes=bytes(binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']])
record={'source':'nomad.blend','sourceSha256':hashlib.sha256((ROOT/'assets/ship/nomad.blend').read_bytes()).hexdigest(),
    'upload':path.name,'uploadSha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'uvSha256':hashlib.sha256(uv_bytes).hexdigest(),
    'vertices':uv['count'],'triangles':doc['accessors'][primitive['indices']]['count']//3,'scope':'Opaque hull/gear painting copy; original UVs, no cabin, no rig',
    'blenderHullLayoutSha256':signature}
(ROOT/'assets/ship/texture-layout.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record,indent=2))
