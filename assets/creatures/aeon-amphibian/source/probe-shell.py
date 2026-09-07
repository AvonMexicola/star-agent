from pathlib import Path
import sys,bpy,json
sys.path.insert(0,str(Path.cwd()/'blender'))
from finish_pyrebear import load_scene,skin_points
from creature_motion import set_clip
arm,mesh,_=load_scene(Path.cwd()/'public/models/creatures/aeon-amphibian.glb');set_clip('walk');a=skin_points(mesh)
def local(points):
 m=arm.matrix_world@arm.pose.bones['Hips'].matrix;q=m.to_quaternion().inverted();return [q@(p-m.translation) for p in points]
a_local=local(a);set_clip('death');bpy.context.scene.frame_set(38,subframe=.4);b=skin_points(mesh);b_local=local(b)
rows=[]
for v in mesh.data.vertices:
 if a[v.index].z<.65 or abs(a[v.index].x)>.30:continue
 weights={mesh.vertex_groups[g.group].name:g.weight for g in v.groups}
 rows.append({'index':v.index,'motion':(a_local[v.index]-b_local[v.index]).length,'weights':weights,'position':list(a[v.index])})
print('SHELL',json.dumps(sorted(rows,key=lambda r:r['motion'],reverse=True)[:12]))
set_clip('walk')
print('LEGHEADS',[(b.name,list(arm.matrix_world@b.head))for b in arm.pose.bones if 'frontleg'in b.name])
