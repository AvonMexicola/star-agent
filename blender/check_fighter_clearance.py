"""Sample authored ladder edges against the static ship at every export frame.

blender -b assets/kestrel/kestrel.blend --python blender/check_fighter_clearance.py
The hinge mounting step is an intentional contact; the open canopy is excluded.
"""
import bpy,json,sys,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

scene=bpy.context.scene
def ancestry(o,name):
    while o:
        if o.name==name:return True
        o=o.parent
    return False

static=[];moving=[]
for o in scene.objects:
    if o.type=='MESH':
        if ancestry(o,'Ladder'):moving.append(o)
        elif not ancestry(o,'Canopy') and not o.name.startswith(('AB_','Entry | fixed sill step')):static.append(o)
    if o.animation_data:
        for track in o.animation_data.nla_tracks:
            if track.name=='LadderDown':
                # Evaluate the action/slot explicitly, as the ACTIONS glTF
                # exporter does. Muted authoring NLA tracks retain the rest pose.
                strip=track.strips[0];track.mute=True
                o.animation_data.action=strip.action
                o.animation_data.action_slot=strip.action_slot or strip.action.slots[0]
scene.frame_set(0)
deps=bpy.context.evaluated_depsgraph_get();verts=[];faces=[];owners=[]
for o in static:
    evaluated=o.evaluated_get(deps);mesh=evaluated.to_mesh();mesh.calc_loop_triangles();offset=len(verts)
    verts.extend(o.matrix_world@v.co for v in mesh.vertices)
    for tri in mesh.loop_triangles:faces.append(tuple(offset+i for i in tri.vertices));owners.append(o.name)
    evaluated.to_mesh_clear()
bvh=BVHTree.FromPolygons(verts,faces,all_triangles=True,epsilon=1e-6)
geometry={}
for o in moving:
    evaluated=o.evaluated_get(deps);mesh=evaluated.to_mesh()
    geometry[o.name]=([v.co.copy() for v in mesh.vertices],[tuple(e.vertices) for e in mesh.edges]);evaluated.to_mesh_clear()
hits=[];tested=0;poses=[]
for frame in range(55):
    scene.frame_set(frame);bpy.context.view_layer.update()
    if frame in [0,15,30,45,54]:poses.append({'frame':frame,'rotations':{name:list(bpy.data.objects[name].rotation_euler) for name in ['Ladder','Ladder_Upper','Ladder_Middle','Ladder_Lower'] if name in bpy.data.objects}})
    for o in moving:
        local,edges=geometry[o.name];world=[o.matrix_world@v for v in local]
        for a,b in edges:
            start,end=world[a],world[b];direction=end-start;length=direction.length
            if length<.006:continue
            direction.normalize();tested+=1
            hit,normal,index,distance=bvh.ray_cast(start+direction*.002,direction,length-.004)
            if hit is not None:
                hits.append({'frame':frame,'moving':o.name,'static':owners[index],'at':[round(v,4) for v in (hit.x,hit.z,-hit.y)]})
                break
report={'sourceSha256':hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),'method':'Every Blender export frame, moving mesh edges vs static triangulated ship; 2 mm endpoint tolerance; intended sill contact and open canopy excluded.','frames':55,'testedEdges':tested,'poses':poses,'intersections':hits}
path=Path(sys.argv[sys.argv.index('--out')+1] if '--out' in sys.argv else '/tmp/kestrel-ladder-clearance.json');path.write_text(json.dumps(report,indent=2)+'\n')
print('KESTREL_CLEARANCE '+json.dumps({'frames':55,'testedEdges':tested,'intersections':len(hits),'first':hits[:12]}))
if hits:raise RuntimeError('Ladder sweep intersects the static ship; see '+str(path))
for name in poses[0]['rotations']:
    if sum(abs(a-b) for a,b in zip(poses[0]['rotations'][name],poses[-1]['rotations'][name]))<1e-5:raise RuntimeError('Animation did not evaluate for '+name)
