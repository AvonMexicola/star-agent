/** Rebuild the supplied pirate sources, common motions, props and player additions. */
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {AvatarGLB} from './avatar-glb.mjs';

const root='assets/pirates';
mkdirSync(`${root}/rigged`,{recursive:true});
const blender=process.env.BLENDER_PATH||'blender';
const run=(executable,args)=>execFileSync(executable,args,{stdio:'inherit'});
run(blender,['-b','-t','4','--python','blender/prepare_pirates.py']);
for(const name of ['crouch-left','crouch-look']){
 const source=new AvatarGLB(`${root}/source/${name}.glb`);
 for(const node of source.json.nodes)node.name=({Spine02:'Spine',Spine01:'Spine1',Spine:'Spine2',neck:'Neck'})[node.name]??node.name;
 source.json.animations[0].name=name;
 source.save(`${root}/rigged/${name}-canonical.glb`);
}
// Flush and exit after export: this host's Blender extension shutdown can hang
// after successful background exports. Export exceptions still fail the command.
const expression="import runpy,os,sys; runpy.run_path('blender/retarget_clips.py',run_name='__main__'); sys.stdout.flush(); sys.stderr.flush(); os._exit(0)";
function retarget(source,target,out){run(blender,['-b','-t','4','--python-expr',expression,'--',source,target,out,'--fps','30']);}
retarget(`${root}/source/player-expedition-base.glb`,`${root}/rigged/aeon-raider.glb`,`${root}/rigged/combat-motions.glb`);
retarget(`${root}/rigged/crouch-left-canonical.glb`,`${root}/rigged/aeon-raider.glb`,`${root}/rigged/crouch-retarget.glb`);
retarget(`${root}/rigged/crouch-left-canonical.glb`,`${root}/source/player-expedition-base.glb`,`${root}/rigged/player-crouch.glb`);
run(process.execPath,['blender/prepare-pirate-motions.mjs']);
run(blender,['-b','-t','4','--python','blender/build_pirate_camp.py']);
