/** Pack the five rigs and add crouch/directional motion to the expedition player.
 * Inputs: prepare_pirates.py and the documented retarget_clips.py commands.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {AvatarGLB} from './avatar-glb.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const root='assets/pirates';mkdirSync('public/models/pirates',{recursive:true});mkdirSync('/tmp/pirate-textures',{recursive:true});
globalThis.self??=globalThis;globalThis.ProgressEvent??=class{constructor(type,init){Object.assign(this,{type},init);}};
const byName=(g,name)=>g.json.animations.find(a=>a.name===name);
function replace(g,a,ch,rows,times){const sm=a.samplers[ch.sampler];sm.output=g.addRows(rows,g.json.accessors[sm.output].type);if(times)sm.input=g.addRows(times.map(t=>[t]),'SCALAR');sm.interpolation='LINEAR';}
function reverse(g,source,name){const a=structuredClone(source);a.name=name;for(const ch of a.channels){const sm=a.samplers[ch.sampler];replace(g,a,ch,g.rows(sm.output).reverse());}g.json.animations.push(a);return a;}
function pose(g,source,name,at){const a=structuredClone(source);a.name=name;for(const ch of a.channels){const sm=a.samplers[ch.sampler],times=g.rows(sm.input),values=g.rows(sm.output);let i=0;while(i<times.length-1&&times[i+1][0]<=at)i++;replace(g,a,ch,[values[i],values[i].slice()],[0,1]);}g.json.animations.push(a);return a;}
function inPlace(g,a){
 for(const ch of a.channels){if(g.json.nodes[ch.target.node].name!=='Hips'||ch.target.path!=='translation')continue;
 const sm=a.samplers[ch.sampler],times=g.rows(sm.input),values=g.rows(sm.output),first=values[0].slice(),last=values.at(-1).slice(),rest=g.json.nodes[ch.target.node].translation;
 values.forEach((p,i)=>{for(const axis of [0,2])p[axis]+=rest[axis]-first[axis]-(last[axis]-first[axis])*times[i][0]/times.at(-1)[0];});replace(g,a,ch,values);
 }
 // Blend the last 10% to the opening pose to close cyclic limbs.
 for(const ch of a.channels){const sm=a.samplers[ch.sampler],times=g.rows(sm.input),values=g.rows(sm.output),end=times.at(-1)[0];for(let i=0;i<times.length;i++){const t=THREE.MathUtils.clamp((times[i][0]/end-.9)*10,0,1);if(!t)continue;values[i]=ch.target.path==='rotation'?new THREE.Quaternion().fromArray(values[i]).slerp(new THREE.Quaternion().fromArray(values[0]),t).toArray():values[i].map((v,j)=>v+(values[0][j]-v)*t);}replace(g,a,ch,values);}
}
async function mirrored(g,source,name){
 // Reflect evaluated world rotations and swap left/right limbs. Simply negating
 // local quaternion components is wrong for differently oriented bone axes.
 const bytes=g.bytes({materials:false}),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
 const mixer=new THREE.AnimationMixer(gltf.scene),clip=gltf.animations.find(c=>c.name===source.name),action=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const bones={};gltf.scene.traverse(o=>{if(o.isBone)bones[o.name]=o;});
 const times=Array.from({length:Math.ceil(clip.duration*30)+1},(_,i)=>Math.min(clip.duration,i/30));
 const rows=Object.fromEntries(Object.keys(bones).map(n=>[n,[]]));const reflect=new THREE.Matrix4().makeScale(-1,1,1);
 for(const t of times){mixer.setTime(t);gltf.scene.updateMatrixWorld(true);const desired={};
  for(const name of Object.keys(bones)){const opposite=name.replace(/^Left/,'TEMP').replace(/^Right/,'Left').replace(/^TEMP/,'Right'),bone=bones[opposite]??bones[name];const matrix=new THREE.Matrix4().makeRotationFromQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()));matrix.premultiply(reflect).multiply(reflect);desired[name]=new THREE.Quaternion().setFromRotationMatrix(matrix).normalize();}
  for(const [name,bone] of Object.entries(bones)){const parent=bone.parent.isBone?desired[bone.parent.name]:bone.parent.getWorldQuaternion(new THREE.Quaternion());rows[name].push(parent.clone().invert().multiply(desired[name]).normalize().toArray());}
 }
 const a=structuredClone(source);a.name=name;
 for(const ch of a.channels){const n=g.json.nodes[ch.target.node].name;if(ch.target.path==='rotation'&&rows[n])replace(g,a,ch,rows[n],times);else if(ch.target.path==='translation'&&n==='Hips'){const sm=a.samplers[ch.sampler],values=g.rows(sm.output),rest=g.json.nodes[ch.target.node].translation;replace(g,a,ch,values.map(p=>[2*rest[0]-p[0],p[1],p[2]]));}}
 g.json.animations.push(a);mixer.uncacheRoot(gltf.scene);return a;
}
function transition(g,standing,crouched,name,reverse=false){
 const a=structuredClone(crouched);a.name=name;const start=new Map(standing.channels.map(ch=>[`${ch.target.node}:${ch.target.path}`,g.rows(standing.samplers[ch.sampler].output)[0]]));
 for(const ch of a.channels){const first=start.get(`${ch.target.node}:${ch.target.path}`)??g.rows(a.samplers[ch.sampler].output)[0],last=g.rows(a.samplers[ch.sampler].output)[0];replace(g,a,ch,reverse?[last,first]:[first,last],[0,.28]);}g.json.animations.push(a);
}
async function authorFootCycle(g,source,name,axis){
 const bytes=g.bytes({materials:false}),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
 const bones={};gltf.scene.traverse(o=>{if(o.isBone)bones[o.name]=o;});
 const mixer=new THREE.AnimationMixer(gltf.scene);mixer.clipAction(gltf.animations.find(c=>c.name===source.name)).play();mixer.setTime(0);gltf.scene.updateMatrixWorld(true);
 const base=Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,{p:b.position.clone(),q:b.quaternion.clone()}]));
 const feet=Object.fromEntries(['Left','Right'].map(s=>[s,bones[s+'Foot'].getWorldPosition(new THREE.Vector3())]));
 const rotations=Object.fromEntries(['Left','Right'].map(s=>[s,bones[s+'Foot'].getWorldQuaternion(new THREE.Quaternion())]));
 const hipOrigin=bones.Hips.getWorldPosition(new THREE.Vector3()),values=Object.fromEntries(Object.keys(bones).map(n=>[n,[]])),hipValues=[];
 const times=Array.from({length:31},(_,i)=>i/30);
 function point(bone,child,target){gltf.scene.updateMatrixWorld(true);const p=bone.getWorldPosition(new THREE.Vector3()),current=child.getWorldPosition(new THREE.Vector3()).sub(p).normalize(),desired=target.clone().sub(p).normalize(),delta=new THREE.Quaternion().setFromUnitVectors(current,desired),parent=bone.parent.getWorldQuaternion(new THREE.Quaternion());bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent)).normalize();gltf.scene.updateMatrixWorld(true);}
 for(const t of times){
  for(const [n,b] of Object.entries(bones)){b.position.copy(base[n].p);b.quaternion.copy(base[n].q);}
  const hip=hipOrigin.clone();hip.x+=Math.sin(t*Math.PI*2)*.012;hip.y+=Math.sin(t*Math.PI*2)**2*.012;bones.Hips.position.copy(bones.Hips.parent.worldToLocal(hip));gltf.scene.updateMatrixWorld(true);
  for(const [i,side] of ['Left','Right'].entries()){
   const phase=(t+i*.5)%1,target=feet[side].clone(),travel=phase<.5?.28-1.12*phase:-.28+1.12*(phase-.5),lift=phase<.5?0:Math.sin((phase-.5)*Math.PI*2)*.09;
   target.x+=axis[0]*travel;target.z+=axis[1]*travel;target.y+=lift;
   const thigh=bones[side+'UpLeg'],shin=bones[side+'Leg'],foot=bones[side+'Foot'];
   const a=thigh.getWorldPosition(new THREE.Vector3()),b=shin.getWorldPosition(new THREE.Vector3()),c=foot.getWorldPosition(new THREE.Vector3()),l1=a.distanceTo(b),l2=b.distanceTo(c),dir=target.clone().sub(a),distance=Math.min(dir.length(),(l1+l2)*.995);dir.normalize();target.copy(a).addScaledVector(dir,distance);
   const along=(l1*l1-l2*l2+distance*distance)/(2*distance),bend=new THREE.Vector3(0,0,1).addScaledVector(dir,-dir.z).normalize(),knee=a.clone().addScaledVector(dir,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
   point(thigh,shin,knee);point(shin,foot,target);foot.quaternion.copy(foot.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotations[side]));gltf.scene.updateMatrixWorld(true);
  }
  hipValues.push(bones.Hips.position.toArray());for(const [n,b] of Object.entries(bones))values[n].push(b.quaternion.toArray());
 }
 const result={name,channels:[],samplers:[]};const timeAccessor=g.addRows(times.map(t=>[t]),'SCALAR');
 for(const [n,rows] of Object.entries(values)){const node=g.json.nodes.findIndex(o=>o.name===n);result.channels.push({sampler:result.samplers.length,target:{node,path:'rotation'}});result.samplers.push({input:timeAccessor,output:g.addRows(rows,'VEC4'),interpolation:'LINEAR'});}
 result.channels.push({sampler:result.samplers.length,target:{node:g.json.nodes.findIndex(o=>o.name==='Hips'),path:'translation'}});result.samplers.push({input:timeAccessor,output:g.addRows(hipValues,'VEC3'),interpolation:'LINEAR'});
 g.json.animations=g.json.animations.filter(a=>a.name!==name);g.json.animations.push(result);return result;
}

async function extend(g,left){
 g.json.animations??=[];
 const existing=new Set(g.json.animations.map(a=>a.name));
 const imported=g.importAnimation(left,left.json.animations.find(a=>a.name==='crouch-left'));imported.name='crouch-strafe-left';inPlace(g,imported);
 await mirrored(g,imported,'crouch-strafe-right');
 reverse(g,byName(g,'walk'),'walk-backward');
 const idle=pose(g,imported,'crouch-idle',.25);
 const crouchWalk=await authorFootCycle(g,idle,'crouch-walk',[0,1]);reverse(g,crouchWalk,'crouch-backward');
 transition(g,byName(g,'idle'),idle,'stand-to-crouch');transition(g,byName(g,'idle'),idle,'crouch-to-stand',true);
 const standing=pose(g,byName(g,'idle'),'pirate-standing-reference',0);
 await authorFootCycle(g,standing,'strafe-left',[1,0]);await authorFootCycle(g,standing,'strafe-right',[-1,0]);
 g.json.animations=g.json.animations.filter(a=>a.name!=='pirate-standing-reference');
 return g.json.animations.filter(a=>!existing.has(a.name)).map(a=>a.name);
}
function packTextures(g,id){
 const extensions=new Set(g.json.extensionsUsed??[]),required=new Set(g.json.extensionsRequired??[]);
 for(let i=0;i<(g.json.images?.length??0);i++){
  const src=`/tmp/pirate-textures/${id}-${i}.png`,out=`/tmp/pirate-textures/${id}-${i}.webp`;writeFileSync(src,g.image(i));execFileSync('magick',[src,'-resize',i===0?'1024x1024>':'512x512>','-strip','-quality','88',out]);g.json.images[i]={name:`${id}-map-${i}`,mimeType:'image/webp',bufferView:g.addView(readFileSync(out))};
 }
 for(const t of g.json.textures??[]){const index=t.source??t.extensions?.EXT_texture_webp?.source;t.extensions={EXT_texture_webp:{source:index}};delete t.source;}
 extensions.add('EXT_texture_webp');required.add('EXT_texture_webp');g.json.extensionsUsed=[...extensions];g.json.extensionsRequired=[...required];
}
const common=new AvatarGLB(`${root}/rigged/combat-motions.glb`),left=new AvatarGLB(`${root}/rigged/crouch-retarget.glb`);
const additions=await extend(common,left);
const npcClips=new Set(['idle','walk','run','aim-rifle','fire-rifle','death','crouch-walk','crouch-idle','crouch-strafe-left','crouch-strafe-right','crouch-backward','walk-backward','stand-to-crouch','crouch-to-stand','reload-rifle','take-damage','interact','carry-walk','strafe-left','strafe-right','wounded-walk']);
common.json.animations=common.json.animations.filter(a=>npcClips.has(a.name));
const records=[];
for(const id of ['aeon-raider','aeon-leader','aeon-flanker','selene-leader','selene-adjutant']){
 const rig=new AvatarGLB(`${root}/rigged/${id}.glb`);rig.json.animations=[];
 // The retargeted export carries the imported target's canonical rest matrices.
 // Match its local bone transforms and inverse bind matrices to avoid importer
 // bone-axis reconstruction differences when copying animation channels.
 for(const node of rig.json.nodes){const source=common.json.nodes.find(n=>n.name===node.name);if(!source||!rig.json.skins[0].joints.includes(rig.json.nodes.indexOf(node)))continue;for(const k of ['rotation','translation','scale','matrix']){if(source[k])node[k]=structuredClone(source[k]);else delete node[k];}}
 const inverseRows=common.rows(common.json.skins[0].inverseBindMatrices);
 rig.json.skins[0].inverseBindMatrices=rig.addRows(rig.json.skins[0].joints.map(index=>{const name=rig.json.nodes[index].name;const at=common.json.skins[0].joints.findIndex(j=>common.json.nodes[j].name===name);if(at<0)throw Error('Missing joint '+name);return inverseRows[at];}),'MAT4');
 for(const clip of common.json.animations)rig.importAnimation(common,clip);
 packTextures(rig,id);rig.json.asset.extras={provenance:'assets/pirates/source-manifest.json',build:'assets/pirates/README.md',height:1.85,requiredClips:rig.json.animations.map(a=>a.name)};rig.compact();const path=`public/models/pirates/${id}.glb`;rig.save(path);
 const bytes=readFileSync(path),triangles=rig.json.meshes.reduce((n,m)=>n+m.primitives.reduce((n,p)=>n+rig.json.accessors[p.indices].count/3,0),0);
 records.push({id,path,bytes:bytes.length,sha256:hash(bytes),triangles,joints:rig.json.skins[0].joints.length,clips:rig.json.animations.map(a=>a.name)});
 if(bytes.length>2000000||triangles>20000)throw Error(`${id} exceeds character budget: ${bytes.length} bytes/${triangles} triangles`);
}
const player=new AvatarGLB(`${root}/source/player-expedition-base.glb`),playerLeft=new AvatarGLB(`${root}/rigged/player-crouch.glb`);
const playerClips=await extend(player,playerLeft);player.json.asset.extras.requiredClips=player.json.animations.map(a=>a.name);player.compact();player.save('public/models/props/player-expedition.glb');
const report={characters:records,player:{path:'public/models/props/player-expedition.glb',bytes:player.bytes().length,sha256:hash(player.bytes()),added:playerClips},derived:'Mirrored supplied crouch strafe, reversed backward locomotion, sampled deep crouch idle, interpolated stance transitions and authored two-bone IK foot cycles for crouch forward and upright sidesteps. Existing pickup/carry/reload clips retained.'};
writeFileSync(`${root}/build.json`,JSON.stringify(report,null,2)+'\n');writeFileSync('public/models/pirates/manifest.json',JSON.stringify(records,null,2)+'\n');
const propsPath='public/models/props/manifest.json',props=JSON.parse(readFileSync(propsPath,'utf8'));
const entry=props.find(p=>p.name==='player-expedition');entry.sha256=report.player.sha256;entry.file_mb=report.player.bytes/1000000;
entry.animations=player.json.animations.map(a=>({name:a.name,seconds:Math.max(...a.samplers.map(s=>player.rows(s.input).at(-1)[0]))}));
if(!entry.notes.includes('assets/pirates/README.md'))entry.notes+=' Pirate motion extension: assets/pirates/README.md.';
writeFileSync(propsPath,JSON.stringify(props,null,2)+'\n');
console.log(JSON.stringify(report));
