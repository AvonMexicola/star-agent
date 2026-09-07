"""Read-only runtime skin/limb sampling; writes source-pack validation receipts.
Run headless from the repository with ALSOFT_DRIVERS=null and python-exit-code1.
"""
import argparse,bpy,sys,json
from pathlib import Path
sys.path.insert(0,str(Path.cwd()/'blender'))
from finish_pyrebear import load_scene,skin_points
from creature_motion import set_clip
parser=argparse.ArgumentParser()
parser.add_argument('--species', choices=['pyrebear','suloher-dog'])
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
for species,duration in [('pyrebear',1.8),('suloher-dog',1.2)]:
 if args.species and species != args.species: continue
 arm,mesh,_=load_scene(Path.cwd()/f'public/models/creatures/{species}.glb')
 set_clip('walk');walk0=skin_points(mesh)
 chains=[[p+x for x in ['', '0','1','2']]for p in ['frontleg','R_frontleg','backleg','R_backleg']]
 def lengths():
  return [(arm.matrix_world@arm.pose.bones[b].head-arm.matrix_world@arm.pose.bones[a].head).length for c in chains for a,b in zip(c,c[1:])]
 baseline=lengths();set_clip('death');death0=skin_points(mesh)
 start_error=max((a-b).length for a,b in zip(walk0,death0));error=0;step=0;previous=death0
 for i in range(121):
  f=duration*bpy.context.scene.render.fps*i/120;bpy.context.scene.frame_set(int(f),subframe=f%1)
  error=max(error,max(abs(a-b)for a,b in zip(baseline,lengths())))
  points=skin_points(mesh);step=max(step,max((a-b).length for a,b in zip(previous,points)));previous=points
 result={'runtime':f'/models/creatures/{species}.glb','samples':121,'walkZeroToDeathZeroMaxVertexDisplacementMetres':start_error,'maxLimbJointDistanceChangeMetres':error,'maxAdjacentSampleVertexDisplacementMetres':step,'sampleIntervalSeconds':duration/120,'limits':'Sampling checks continuity and limb length, not physical contact or anatomical realism.'}
 assert start_error<.002,result
 assert error<.002,result
 assert step<.1,result
 print('MOTION_CHECK',species,json.dumps(result))
 (Path.cwd()/f'assets/creatures/{species}/motion-validation.json').write_text(json.dumps(result,indent=2)+'\n')
