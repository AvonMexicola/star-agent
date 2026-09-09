"""Fit a common human skeleton to the five retained T-pose pirates.
blender -b -t 4 --python blender/prepare_pirates.py
Runtime packing/animations: node blender/prepare-pirate-motions.mjs
"""
import bpy,json,math
from pathlib import Path
from mathutils import Vector, kdtree
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/pirates/rigged';OUT.mkdir(parents=True,exist_ok=True)
IDS=['aeon-raider','aeon-leader','aeon-flanker','selene-leader','selene-adjutant']
# Transfer the supplied human skin in its evaluated bind pose. Meshy adds an
# unskinned Icosphere helper: exclude it from all bounds and weighting queries.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/pirates/source/aeon-rig.glb'))
for o in bpy.context.scene.objects:
 if o.animation_data:o.animation_data_clear()
bpy.context.view_layer.update()
source_arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
source_mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH' and len(o.vertex_groups))
evaluated=source_mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
points=[evaluated.matrix_world@v.co for v in evaluated.data.vertices]
H=1.85;low=min(p.z for p in points);scale=H/(max(p.z for p in points)-low)
rename=lambda n:{'Spine02':'Spine','Spine01':'Spine1','Spine':'Spine2','neck':'Neck','head_end':'Head','headfront':'Head'}.get(n,n)
HEADS={rename(b.name):tuple((source_arm.matrix_world@b.head_local-Vector((0,0,low)))*scale) for b in source_arm.data.bones if b.name not in ('head_end','headfront')}
PARENTS={rename(b.name):rename(b.parent.name) if b.parent else None for b in source_arm.data.bones if b.name not in ('head_end','headfront')}
source_weights=[];tree=kdtree.KDTree(len(points))
for i,(p,vert) in enumerate(zip(points,source_mesh.data.vertices)):
 tree.insert((p-Vector((0,0,low)))*scale,i)
 weights={}
 for group in vert.groups:
  name=rename(source_mesh.vertex_groups[group.group].name);weights[name]=weights.get(name,0)+group.weight
 source_weights.append(weights)
tree.balance()
CHILD={p:n for n,p in PARENTS.items() if p}
CHILD.update({'Hips':'Spine','Spine2':'Neck'})
report=[]
for ident in IDS:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/pirates/source'/f'{ident}.glb'))
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];assert len(meshes)==1
 mesh=meshes[0];bpy.context.view_layer.objects.active=mesh;bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True)
 # Bake world coordinates, normalize measured height and put soles at zero.
 coords=[mesh.matrix_world@v.co for v in mesh.data.vertices];low=min(p.z for p in coords);high=max(p.z for p in coords)
 factor=H/(high-low);cx=(min(p.x for p in coords)+max(p.x for p in coords))*.5
 for vert,p in zip(mesh.data.vertices,coords):vert.co=((p.x-cx)*factor,p.y*factor,(p.z-low)*factor)
 mesh.parent=None;mesh.matrix_world.identity();mesh.name=ident
 dec=mesh.modifiers.new('Runtime triangle budget','DECIMATE');dec.ratio=min(1,18000/(sum(len(p.vertices)-2 for p in mesh.data.polygons)))
 bpy.ops.object.modifier_apply(modifier=dec.name)
 data=bpy.data.armatures.new('Pirate humanoid');arm=bpy.data.objects.new('Armature',data);bpy.context.collection.objects.link(arm)
 bpy.context.view_layer.objects.active=arm;arm.select_set(True);mesh.select_set(False);bpy.ops.object.mode_set(mode='EDIT')
 for name,head in HEADS.items():
  b=data.edit_bones.new(name);b.head=head
  if name in CHILD:b.tail=HEADS[CHILD[name]]
  elif name=='Head':b.tail=(0,0,1.81)
  elif name.endswith('Hand'):b.tail=(head[0]+(.16 if name.startswith('Left') else -.16),head[1],head[2]-.015)
  else:b.tail=(head[0],-.23,head[2])
  if PARENTS[name]:b.parent=data.edit_bones[PARENTS[name]]
  b.use_connect=False
 bpy.ops.object.mode_set(mode='OBJECT');mesh.select_set(True);bpy.context.view_layer.objects.active=arm
 mesh.parent=arm
 modifier=mesh.modifiers.new('Pirate skin','ARMATURE');modifier.object=arm
 for name in HEADS:mesh.vertex_groups.new(name=name)
 for vertex in mesh.data.vertices:
  weights={}
  nearest=tree.find_n(vertex.co,4)
  for _,index,distance in nearest:
   influence=1/(distance+.006)**3
   for name,weight in source_weights[index].items():weights[name]=weights.get(name,0)+weight*influence
  strongest=sorted(weights.items(),key=lambda p:p[1],reverse=True)[:4];total=sum(w for _,w in strongest)
  if not total:raise RuntimeError('Source skin contains unweighted vertices')
  for name,w in strongest:mesh.vertex_groups[name].add([vertex.index],w/total,'REPLACE')
 corrected=0
 # Source material is scene-lit; emissive glow on skin is never accepted.
 for mat in mesh.data.materials:
  if mat and mat.use_nodes:
   for node in mat.node_tree.nodes:
    if node.type=='BSDF_PRINCIPLED':
     if 'Emission Strength' in node.inputs:node.inputs['Emission Strength'].default_value=0
 arm.select_set(True);bpy.context.view_layer.objects.active=arm
 bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'{ident}.blend'),check_existing=False)
 bpy.ops.export_scene.gltf(filepath=str(OUT/f'{ident}.glb'),export_format='GLB',use_selection=True,export_animations=False,export_yup=True)
 record={'id':ident,'height':H,'triangles':sum(len(p.vertices)-2 for p in mesh.data.polygons),'bones':len(data.bones),'unweightedVerticesRepaired':corrected,'skin':'4-neighbour inverse-distance transfer from user-supplied Aeon skin; <=4 normalized weights','sourceBoundsZ':[low,high]};report.append(record);print('PIRATE',json.dumps(record),flush=True)
(OUT/'rig-build.json').write_text(json.dumps(report,indent=2)+'\n')
# Some host audio backends leave a shutdown thread waiting even in background.
# The files are explicitly flushed before ending this batch process.
import os,sys
sys.stdout.flush();sys.stderr.flush();os._exit(0)
