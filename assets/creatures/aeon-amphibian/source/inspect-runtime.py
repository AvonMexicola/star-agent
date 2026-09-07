import bpy,sys
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path.cwd()/'blender'))
from finish_pyrebear import load_scene
from creature_motion import set_clip
species=sys.argv[-1]
arm,mesh,_=load_scene(Path.cwd()/f'public/models/creatures/{species}.glb');set_clip('death')
s=bpy.context.scene
frame=38.4
s.frame_set(int(frame),subframe=frame%1)
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=8;s.cycles.use_denoising=True;s.render.threads_mode='FIXED';s.render.threads=4;s.render.resolution_x=700;s.render.resolution_y=550;s.render.resolution_percentage=100
s.world=bpy.data.worlds.new('studio');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.2,.2,.2,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.5
target=Vector((0,0,.6 if species=='pyrebear' else .3))
for pos,power in [((3,4,5),800),((-3,-3,4),500)]:
 d=bpy.data.lights.new('studio','AREA');d.energy=power;d.size=4;o=bpy.data.objects.new('studio',d);s.collection.objects.link(o);o.location=pos;o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,0))
bpy.ops.object.camera_add();camera=bpy.context.object;s.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=4.6 if species=='pyrebear' else 2.8;camera.location=(4,5,3.5);camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();s.render.use_stamp=True;s.render.use_stamp_note=True;s.render.stamp_note_text='BLENDER STUDIO / DEATH POSE CANDIDATE / NOT GAME EVIDENCE'
for name,pos in [('oblique',(4,5,3.5)),('side',(6,0,1.5))]:
 camera.location=pos;camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(Path.cwd()/f'assets/creatures/{species}/source/prototype-{name}.png');bpy.ops.render.render(write_still=True)
