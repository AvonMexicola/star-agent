import bpy,json,sys
from pathlib import Path
from mathutils import Vector,Matrix
sys.path.insert(0,str(Path.cwd()/'blender'))
import clean_asset as c
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(Path.cwd()/'assets/creatures/aeon-amphibian/source/aeon-amphibian-walking.glb'))
s=bpy.context.scene;meshes=[o for o in c.mesh_objects() if any(m.type=='ARMATURE' for m in o.modifiers)];arm=c.armature_objects()[0]
for o in c.mesh_objects():
 if o not in meshes: o.hide_render=True
print('OBJECTS',[(o.name,o.type,list(o.location),list(o.rotation_euler),list(o.scale)) for o in s.objects])
print('ACTIONS',[(a.name,list(a.frame_range)) for a in bpy.data.actions]); print('FPS',s.render.fps)
print('BONES',[(b.name,list(arm.matrix_world@b.head_local),list(arm.matrix_world@b.tail_local)) for b in arm.data.bones])
action=arm.animation_data.action;start,end=action.frame_range
samples=[]
for i in range(21):
 f=start+(end-start)*i/20;s.frame_set(int(f),subframe=f-int(f));lo,hi=c.world_bbox(meshes)
 samples.append({'phase':i/20,'bounds':{'min':list(lo),'max':list(hi)},'hips':list(arm.matrix_world@arm.pose.bones['Hips'].head),'chest':list(arm.matrix_world@arm.pose.bones['chest'].head),'head':list(arm.matrix_world@arm.pose.bones['head'].head),'feet':{n:list(arm.matrix_world@arm.pose.bones[n].head) for n in ['frontleg2','R_frontleg2','backleg2','R_backleg2']}})
Path('assets/creatures/aeon-amphibian/source/skinned-samples.json').write_text(json.dumps(samples,indent=2));print('SAMPLES',json.dumps([samples[0],samples[10],samples[-1]]))
s.frame_set(int(start));lo,hi=c.world_bbox(meshes);factor=3/max(hi-lo);anchor=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
roots=[o for o in s.objects if o.parent is None];wrap=bpy.data.objects.new('ReviewFit',None);s.collection.objects.link(wrap)
for o in roots: world=o.matrix_world.copy();o.parent=wrap;o.matrix_world=world
wrap.matrix_world=Matrix.Scale(factor,4)@Matrix.Translation(-anchor);bpy.context.view_layer.update();lo,hi=c.world_bbox(meshes);target=(lo+hi)/2
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=12;s.cycles.use_denoising=True;s.render.threads_mode='FIXED';s.render.threads=4;s.render.resolution_x=800;s.render.resolution_y=640;s.render.resolution_percentage=100;s.world=bpy.data.worlds.new('Studio');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.12,.12,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.5
for pos,power in [((3,-4,5),700),((-4,2,4),500),((1,4,3),500)]:
 d=bpy.data.lights.new('studio','AREA');d.energy=power;d.size=4;o=bpy.data.objects.new('studio',d);s.collection.objects.link(o);o.location=pos;o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();camera=bpy.context.object;s.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=4.3
s.render.use_stamp=True;s.render.use_stamp_note=True;s.render.stamp_note_text='BLENDER SOURCE INSPECTION / NOT GAME EVIDENCE'
for name,direction in [('oblique',(3,-4,2)),('opposite',(-3,4,2))]:
 camera.location=target+Vector(direction);camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();s.render.filepath='assets/creatures/aeon-amphibian/source/inspection-'+name+'.png';bpy.ops.render.render(write_still=True)
