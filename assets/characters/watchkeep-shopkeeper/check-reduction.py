import importlib.util,json,math
from pathlib import Path
import bpy
from mathutils.bvhtree import BVHTree
p=Path.cwd()/'blender/finish_watchkeep_shopkeeper.py';spec=importlib.util.spec_from_file_location('merchant',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
clips=[('idle-15',7.0333333),('idle-04',14),('idle-06',7.4333333),('idle-07',8.8)]
source={};arm,mesh=m.load_scene(m.PACK/'source/combined-idles.glb')
for name,duration in clips:
 m.activate(name)
 for phase in [0,.25,.5,.75,1]:m.frame(duration*phase);source[(name,phase)]=m.points(mesh)
arm,mesh=m.load_scene(m.PACK/'derived-reduced-source-idles.glb');mesh.data.calc_loop_triangles();faces=[tuple(t.vertices)for t in mesh.data.loop_triangles];results=[]
for name,duration in clips:
 m.activate(name)
 for phase in [0,.25,.5,.75,1]:
  m.frame(duration*phase);ps=m.points(mesh);tree=BVHTree.FromPolygons(ps,faces,all_triangles=True);errors=[tree.find_nearest(v)[3]for v in source[(name,phase)]]
  results.append({'name':name,'phase':phase,'surfaceErrorMaxMetres':max(errors),'surfaceErrorP95Metres':float(m.np.percentile(errors,95)),'source':m.bounds(source[(name,phase)]),'derived':m.bounds(ps)})
(m.PACK/'animated-reduction-comparison.json').write_text(json.dumps(results,indent=2)+'\n');print('MAX',max(r['surfaceErrorMaxMetres']for r in results));print('ROWS',json.dumps(results))

(m.PACK/'animated-reduction-comparison-context.json').write_text(json.dumps({'purpose':'Topology/reduction comparison under identical original source idle poses BEFORE intentional resting-arm retarget','source':m.identity(m.PACK/'source/combined-idles.glb'),'derived':m.identity(m.PACK/'derived-reduced-source-idles.glb'),'intentionalArmCorrectionAppliedToEitherSide':False,'poseCount':20,'normalizationScaleAppliedInQA':json.loads(m.OUT.with_name('watchkeep-shopkeeper-manifest.json').read_text())['normalization']['scale'],'result':'animated-reduction-comparison.json'},indent=2)+'\n')
