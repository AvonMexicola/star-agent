import importlib.util,json
from pathlib import Path
p=Path.cwd()/'blender/finish_watchkeep_shopkeeper.py';s=importlib.util.spec_from_file_location('merchant',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
arm,mesh=m.load_scene(m.PACK/'source/combined-idles.glb');out=[]
for name,duration in [('idle-04',14),('idle-06',7.4333334),('idle-07',8.8),('idle-15',7.0333333)]:
 m.activate(name)
 for phase in [0,.25,.5,.75,1]:
  m.frame(duration*phase);out.append({'clip':name,'phase':phase,'bones':{n:{'head':list(arm.matrix_world@arm.pose.bones[n].head),'tail':list(arm.matrix_world@arm.pose.bones[n].tail)}for n in ['Hips','Spine','neck','LeftShoulder','LeftArm','LeftForeArm','LeftHand','RightShoulder','RightArm','RightForeArm','RightHand']}})
(m.PACK/'arm-source-inspection.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out[:2],indent=2))
