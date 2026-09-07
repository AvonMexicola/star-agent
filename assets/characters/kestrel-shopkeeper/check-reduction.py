import importlib.util,json,math
from pathlib import Path
import bpy
from mathutils.bvhtree import BVHTree
p=Path.cwd()/'blender/finish_kestrel_shopkeeper.py';spec=importlib.util.spec_from_file_location('merchant',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
manifest=json.loads(m.OUT.with_name('kestrel-shopkeeper-manifest.json').read_text())
clips=[(c['name'],c['duration'])for c in manifest['idleClips']]
scale=manifest['normalization']['scale']
doc,binary=m.read_glb(m.PACK/'source/combined-idles.glb');binary=bytearray(binary);m.relaxed_arm_tracks(doc,binary,manifest['idleClips']);reference=m.PACK/'reference-corrected.glb';m.write_glb(reference,doc,binary)
source={};arm,mesh=m.load_scene(reference)
for name,duration in clips:
 m.activate(name)
 for phase in [0,.25,.5,.75,1]:m.frame(duration*phase);source[(name,phase)]=m.points(mesh)
arm,mesh=m.load_scene(m.PACK/'derived-unfitted.glb');mesh.data.calc_loop_triangles();faces=[tuple(t.vertices)for t in mesh.data.loop_triangles];results=[]
for name,duration in clips:
 m.activate(name)
 for phase in [0,.25,.5,.75,1]:
  m.frame(duration*phase);ps=m.points(mesh);tree=BVHTree.FromPolygons(ps,faces,all_triangles=True);errors=[tree.find_nearest(v)[3]for v in source[(name,phase)]]
  results.append({'name':name,'phase':phase,'surfaceErrorMaxMetres':max(errors)*scale,'surfaceErrorP95Metres':float(m.np.percentile(errors,95))*scale,'boundsSpace':'source metres before normalization, identical corrected arm tracks on both meshes', 'source':m.bounds(source[(name,phase)]),'derived':m.bounds(ps)})
(m.PACK/'animated-reduction-comparison.json').write_text(json.dumps(results,indent=2)+'\n');print('MAX',max(r['surfaceErrorMaxMetres']for r in results));print('ROWS',json.dumps(results))

assert max(r["surfaceErrorMaxMetres"] for r in results)<.01, "Animated reduction exceeds 1 cm surface gate"
