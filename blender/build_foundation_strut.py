"""Rebuild the original concrete deck with independently articulated steel braces.
ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python blender/build_foundation_strut.py
Game metres/Y up. Braces have unit Y length; runtime sets length and 45-degree tilt.
"""
import bpy, pathlib, json, hashlib
from mathutils import Vector
root=pathlib.Path(__file__).resolve().parents[1]
out=root/'public/models/base/foundation-strut.glb'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(root/'public/models/base/foundation.glb'))
steel=bpy.data.materials.new('BraceSteel');steel.use_nodes=True
p=steel.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.22,.27,.28,1);p.inputs['Metallic'].default_value=.75;p.inputs['Roughness'].default_value=.36
for i in range(2):
 for name,size in [(f'CliffBrace{i}',(.18,.18,1)),(f'CliffFoot{i}',(.6,.6,.2))]:
  bpy.ops.mesh.primitive_cube_add(size=1)
  obj=bpy.context.object;obj.name=name;obj.scale=size
  bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
  obj.data.materials.append(steel)
  bevel=obj.modifiers.new('Fabricated edge bevel','BEVEL');bevel.width=.012;bevel.segments=2
  bpy.ops.object.modifier_apply(modifier=bevel.name)
  top=Vector(((-1.45,1.45)[i],1.7,-.6));foot=Vector((top.x,-1.3,-3.6))
  if name.startswith('CliffBrace'):
   obj.location=(top+foot)/2;obj.rotation_mode='QUATERNION';obj.rotation_quaternion=(top-foot).to_track_quat('Z','Y');obj.scale.z=(top-foot).length
  else:obj.location=foot
# Unit members are deliberately separate named nodes, positioned by foundations.js.
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_yup=True,export_animations=False)
manifest={'builder':'blender/build_foundation_strut.py','source':'Original scripted braces; inherited original base foundation deck','coordinates':'metres, Y up; deck top Y0; unit-Y braces and centred shoes transformed in runtime','bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'triangles':sum(len(o.data.loop_triangles) for o in bpy.data.objects if o.type=='MESH'),'nodes':['CliffBrace0','CliffBrace1','CliffFoot0','CliffFoot1']}
(root/'docs/qa/terrain-foundations').mkdir(parents=True,exist_ok=True)
(root/'docs/qa/terrain-foundations/asset.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest))

raw=out.read_bytes();glb=json.loads(raw[20:20+int.from_bytes(raw[12:16],'little')])
path=root/'public/models/base/manifest.json';kit=json.loads(path.read_text())
kit['pieces']['foundation-strut']={**manifest,'drawPrimitives':sum(len(m['primitives']) for m in glb['meshes']),'bounds':{'min':[-2,-3.7,-2],'max':[2,.002,2]},'materials':sorted(m['name'] for m in glb['materials']),'configuration':'Default 3.6m assembly; runtime foundationDepth adjusts articulated members.'}
kit['aggregateBytes']=sum(p['bytes'] for p in kit['pieces'].values());kit['aggregateTriangles']=sum(p['triangles'] for p in kit['pieces'].values())
path.write_text(json.dumps(kit,indent=2)+'\n')
