import sys,json,math,subprocess
from pathlib import Path
sys.path.insert(0,str(Path.cwd()/'blender'))
import bpy
import finish_kestrel_shopkeeper as h
from mathutils import Matrix,Vector
pack=Path.cwd()/'assets/characters/kestrel-shopkeeper';path=pack/'source/Meshy_AI_Cybertech_Mechanic_biped_Animation_Idle_02_withSkin.glb'
h.ensure_sources();doc,_=h.read_glb(path);arm,mesh=h.load_scene(path);h.activate(doc['animations'][0]['name']);h.frame(0)
ps=h.points(mesh);b=h.bounds(ps);scale=1.8/(b['max'][1]-b['min'][1]);cx=(b['min'][0]+b['max'][0])/2;cy=-(b['min'][2]+b['max'][2])/2
wrapper=bpy.data.objects.new('Source inspection fit',None);bpy.context.scene.collection.objects.link(wrapper)
for o in [o for o in bpy.context.scene.objects if o.parent is None and o!=wrapper]:
 m=o.matrix_world.copy();o.parent=wrapper;o.matrix_world=m
wrapper.matrix_world=Matrix.Rotation(math.pi,4,'Z')@Matrix.Scale(scale,4)@Matrix.Translation(Vector((-cx,-cy,-b['min'][1])));bpy.context.view_layer.update()
print('NORMALIZED',json.dumps(h.bounds(h.points(mesh))))
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=16;s.cycles.use_denoising=True;s.render.threads_mode='FIXED';s.render.threads=4;s.render.resolution_x=800;s.render.resolution_y=900;s.render.resolution_percentage=100;s.view_settings.view_transform='AgX';s.view_settings.exposure=0
s.world=bpy.data.worlds.new('Source studio');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.13,.15,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.45
target=Vector((0,0,.9))
for pos,energy,size in [((3,4,5),650,4),((-3,1,3),400,3),((1,-3,4),500,3)]:
 d=bpy.data.lights.new('Studio','AREA');d.energy=energy;d.size=size;o=bpy.data.objects.new('Studio',d);s.collection.objects.link(o);o.location=pos;o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.001));bpy.ops.object.camera_add();camera=bpy.context.object;s.camera=camera;camera.data.type='ORTHO'
s.render.use_stamp=True;s.render.use_stamp_note=True;s.render.stamp_note_text='BLENDER SOURCE / RAW MATERIAL / NOT GAME';s.render.use_stamp_filename=False
review=pack/'review';review.mkdir(exist_ok=True)
for name,target,direction,size in [('source-oblique',Vector((0,0,.9)),Vector((2,5,1)),2.2),('source-face',Vector((0,0,1.61)),Vector((1,5,.25)),.58)]:
 camera.data.ortho_scale=size;camera.location=target+direction;camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();png=review/(name+'.png');s.render.filepath=str(png);bpy.ops.render.render(write_still=True);subprocess.run(['magick',str(png),'-quality','91',str(png.with_suffix('.webp'))],check=True);png.unlink()
