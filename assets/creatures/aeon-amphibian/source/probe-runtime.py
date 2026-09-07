import sys,bpy
from pathlib import Path
sys.path.insert(0,str(Path.cwd()/'blender'))
from finish_pyrebear import load_scene,skin_points
from creature_motion import set_clip
arm,mesh,_=load_scene(Path.cwd()/'public/models/creatures/aeon-amphibian.glb');set_clip('death');bpy.context.scene.frame_set(23,subframe=.04)
points=skin_points(mesh);idx=min(range(len(points)),key=lambda i:points[i].z);print('MIN',idx,list(points[idx]),[(mesh.vertex_groups[g.group].name,g.weight)for g in mesh.data.vertices[idx].groups])
for name in ['Hips','chest','head','tail','tailstart','tail1','tail2','tail3']:
 print('JOINT',name,list(arm.matrix_world@arm.pose.bones[name].head))

for prefix in ['head','tail','chest','Hips','frontleg','R_frontleg','backleg','R_backleg']:
 indices=[v.index for v in mesh.data.vertices if any(mesh.vertex_groups[g.group].name.startswith(prefix) and g.weight>.6 for g in v.groups)]
 print('REGION',prefix,min(points[i].z for i in indices))

from finish_pyrebear import sample_walk,union_bounds
set_clip('walk');walk=sample_walk(arm,mesh,241);print('WALK_BOUNDS',union_bounds(walk));set_clip('death');samples=sample_walk(arm,mesh,121);print('DEATH_MIN',min(samples,key=lambda x:x['bounds']['min'][1]))
