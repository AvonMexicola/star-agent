"""CPU-only contact sheet of user-supplied GLBs, without modifying source files."""
from pathlib import Path
import bpy, math, json, hashlib, shutil
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
FILES=['Meshy_AI__0908191353_texture.glb','Meshy_AI_Industrial_Tripod_Wor_0908191206_texture.glb','Meshy_AI__0908191153_texture.glb','Meshy_AI_Crimson_Skull_Crate_0908191136_texture.glb']
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
records=[]
for i,name in enumerate(FILES):
 p=ROOT/'assets/pirate-props/source'/name
 if not p.exists():shutil.copy2(Path('/home/cees/Downloads')/name,p)
 old=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(p));obs=list(set(bpy.data.objects)-old);meshes=[o for o in obs if o.type=='MESH'];coords=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box];lo=Vector([min(v[a] for v in coords) for a in range(3)]);hi=Vector([max(v[a] for v in coords) for a in range(3)]);extent=hi-lo
 factor=3.6/max(extent);centre=Vector(((i%2)*5-2.5,(i//2)*4.5-2.25,0));shift=Vector((-(hi.x+lo.x)/2,-(hi.y+lo.y)/2,-lo.z))
 # Root transform leaves texture/material/geometry identity intact.
 parent=bpy.data.objects.new('Display_'+str(i+1),None);bpy.context.collection.objects.link(parent)
 for o in obs:
  if o.parent not in obs:o.parent=parent
 parent.scale=(factor,)*3;parent.location=centre+shift*factor
 records.append({'index':i+1,'file':name,'sourceSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'sourceBytes':p.stat().st_size,'boundsBlenderZUp':{'min':list(lo),'max':list(hi)},'displayScale':factor})
 bpy.ops.object.text_add(location=(centre.x,centre.y-2,0));text=bpy.context.object;text.data.body=str(i+1)+' / '+name.replace('Meshy_AI_','').replace('_texture.glb','');text.data.size=.22;text.data.align_x='CENTER';text.data.extrude=0;text.rotation_euler=(0,0,0)
world=bpy.context.scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.7,.75,.8,1);world.node_tree.nodes['Background'].inputs[1].default_value=.6
bpy.ops.object.light_add(type='AREA',location=(0,-4,10));bpy.context.object.data.energy=2200;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=8
bpy.ops.object.camera_add(location=(11,-16,16));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=13;bpy.context.scene.camera=cam
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.render.threads_mode='FIXED';scene.render.threads=2;scene.render.resolution_x=1200;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ROOT/'assets/pirate-props/review/intake.png');scene.view_settings.view_transform='AgX';bpy.ops.render.render(write_still=True)
(ROOT/'assets/pirate-props/review/intake.json').write_text(json.dumps(records,indent=2)+'\n')
