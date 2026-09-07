import bpy,json,sys,math
from pathlib import Path
from mathutils import Vector,Matrix
root=Path.cwd();pack=root/'assets/characters/watchkeep-shopkeeper'
def points(mesh):
 deps=bpy.context.evaluated_depsgraph_get();evaluated=mesh.evaluated_get(deps);data=evaluated.to_mesh()
 try:return [evaluated.matrix_world@v.co for v in data.vertices]
 finally:evaluated.to_mesh_clear()
def bounds(ps):return {'min':[min(p[i]for p in ps)for i in range(3)],'max':[max(p[i]for p in ps)for i in range(3)]}
reports=[]
for label in ['15','4','6','7']:
 bpy.ops.wm.read_factory_settings(use_empty=True);path=pack/f'source/Meshy_AI_Crimson_Outrider_biped_Animation_Idle_{label}_withSkin.glb';bpy.ops.import_scene.gltf(filepath=str(path));scene=bpy.context.scene
 arm=next(o for o in scene.objects if o.type=='ARMATURE');mesh=next(o for o in scene.objects if o.type=='MESH'and any(m.type=='ARMATURE'for m in o.modifiers))
 for o in scene.objects:
  if o.type=='MESH'and o!=mesh:o.hide_render=True
 start,end=arm.animation_data.action.frame_range;samples=[];first=None
 for i in range(31):
  frame=start+(end-start)*i/30;scene.frame_set(int(frame),subframe=frame%1);ps=points(mesh)
  if first is None:first=ps
  samples.append({'phase':i/30,'boundsBlender':bounds(ps),'hipsBlender':list(arm.matrix_world@arm.pose.bones['Hips'].head)})
 loop=max((a-b).length for a,b in zip(first,ps))
 report={'id':f'idle-{int(label):02d}','duration':(end-start)/scene.render.fps,'samples':samples,'loopMaxVertexErrorBlender':loop,'bones':list(arm.pose.bones.keys())};reports.append(report)
 if label!='15':continue
 scene.frame_set(int(start));ps=points(mesh);b=bounds(ps);lo=Vector(b['min']);hi=Vector(b['max']);factor=1.72/(hi.z-lo.z);anchor=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z));wrap=bpy.data.objects.new('InspectionFit',None);scene.collection.objects.link(wrap)
 for o in list(scene.objects):
  if o!=wrap and o.parent is None:world=o.matrix_world.copy();o.parent=wrap;o.matrix_world=world
 wrap.matrix_world=Matrix.Scale(factor,4)@Matrix.Translation(-anchor);bpy.context.view_layer.update()
 scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=4;scene.render.resolution_x=700;scene.render.resolution_y=800;scene.render.resolution_percentage=100
 scene.world=bpy.data.worlds.new('Source studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.16,.16,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
 target=Vector((0,0,.9))
 for pos,energy in [((3,-4,5),700),((-3,2,4),500)]:
  d=bpy.data.lights.new('Source studio','AREA');d.energy=energy;d.size=4;o=bpy.data.objects.new('Source studio',d);scene.collection.objects.link(o);o.location=pos;o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.002));bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=2.2
 scene.render.use_stamp=True;scene.render.use_stamp_note=True;scene.render.stamp_note_text='BLENDER SOURCE INSPECTION / NOT GAME EVIDENCE'
 for name,direction in [('front-oblique',(2,-5,1)),('back-oblique',(-2,5,1))]:
  cam.location=target+Vector(direction);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(pack/f'source/inspection-{name}.png');bpy.ops.render.render(write_still=True)
(pack/'source/motion-inspection.json').write_text(json.dumps(reports,indent=2)+'\n');print('INSPECTED',json.dumps([{k:r[k]for k in ['id','duration','loopMaxVertexErrorBlender']}for r in reports]))
print('DECIMATE_RNA',[(p.identifier,p.description)for p in bpy.types.DecimateModifier.bl_rna.properties if 'vertex_group'in p.identifier])
