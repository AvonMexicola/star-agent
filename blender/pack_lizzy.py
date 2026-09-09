import bpy,os,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'assets/characters/lizzy/.staging'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(root/'animated.glb'))
for o in list(bpy.data.objects):
 if o.type=='MESH' and not o.find_armature():bpy.data.objects.remove(o,do_unlink=True)
for o in bpy.data.objects:
 if o.type!='MESH':continue
 bpy.context.view_layer.objects.active=o;o.select_set(True);m=o.modifiers.new('Guide triangle budget','DECIMATE');m.ratio=18000/sum(len(p.vertices)-2 for p in o.data.polygons);bpy.ops.object.modifier_apply(modifier=m.name)
bpy.ops.export_scene.gltf(filepath=str(root/'decimated.glb'),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_yup=True)
sys.stdout.flush();sys.stderr.flush();os._exit(0)
