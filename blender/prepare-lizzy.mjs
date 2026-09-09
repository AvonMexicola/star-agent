/** Keep Lizzy's supplied gait; correct shoulder abduction without replacing her skin. */
import {AvatarGLB} from './avatar-glb.mjs';
import * as THREE from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
globalThis.self??=globalThis;globalThis.ProgressEvent??=class{constructor(type,init){Object.assign(this,{type},init);}};
const root='assets/characters/lizzy',g=new AvatarGLB(`${root}/source-walk.glb`),running=new AvatarGLB(`${root}/source-run.glb`);
g.json.animations[0].name='walk';const run=g.importAnimation(running,running.json.animations[0]);run.name='run';
const bytes=g.bytes({materials:false}),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
const bones={};gltf.scene.traverse(o=>{if(o.isBone)bones[o.name]=o;});
const rest=Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,{p:b.position.clone(),q:b.quaternion.clone()}]));
const mixer=new THREE.AnimationMixer(gltf.scene),position=b=>b.getWorldPosition(new THREE.Vector3());
function reset(){mixer.stopAllAction();for(const[n,b]of Object.entries(bones)){b.position.copy(rest[n].p);b.quaternion.copy(rest[n].q);}gltf.scene.updateMatrixWorld(true);}
function point(bone,child,direction){gltf.scene.updateMatrixWorld(true);const delta=new THREE.Quaternion().setFromUnitVectors(position(child).sub(position(bone)).normalize(),direction.normalize()),parent=bone.parent.getWorldQuaternion(new THREE.Quaternion());bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent)).normalize();gltf.scene.updateMatrixWorld(true);}
function record(name,times,pose){const rotations=Object.fromEntries(Object.keys(bones).map(n=>[n,[]])),hips=[];for(const t of times){pose(t);gltf.scene.updateMatrixWorld(true);for(const[n,b]of Object.entries(bones))rotations[n].push(b.quaternion.toArray());hips.push(bones.Hips.position.toArray());}
 const a={name,channels:[],samplers:[]},time=g.addRows(times.map(t=>[t]),'SCALAR');
 for(const[n,values]of Object.entries(rotations)){a.channels.push({sampler:a.samplers.length,target:{node:g.json.nodes.findIndex(o=>o.name===n),path:'rotation'}});a.samplers.push({input:time,output:g.addRows(values,'VEC4'),interpolation:'LINEAR'});}
 a.channels.push({sampler:a.samplers.length,target:{node:g.json.nodes.findIndex(o=>o.name==='Hips'),path:'translation'}});a.samplers.push({input:time,output:g.addRows(hips,'VEC3'),interpolation:'LINEAR'});return a;
}
const output=[];
for(const name of ['walk','run']){const clip=gltf.animations.find(c=>c.name===name);reset();const action=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const times=Array.from({length:Math.ceil(clip.duration*30)+1},(_,i)=>Math.min(i/30,clip.duration));
 output.push(record(name,times,t=>{mixer.setTime(t);gltf.scene.updateMatrixWorld(true);for(const side of ['Left','Right']){const arm=bones[side+'Arm'],elbow=bones[side+'ForeArm'],d=position(elbow).sub(position(arm)),length=d.length();d.x*=.25;d.y=-Math.sqrt(Math.max(.0001,length*length-d.x*d.x-d.z*d.z));point(arm,elbow,d);}}));}
function relaxed(t){reset();for(const side of ['Left','Right'])point(bones[side+'Arm'],bones[side+'ForeArm'],new THREE.Vector3(side==='Left'?.16:-.16,-1,.03));bones.Spine01.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.sin(t*Math.PI)*.008));}
output.push(record('idle',Array.from({length:61},(_,i)=>i/30),relaxed));
output.push(record('wave',Array.from({length:91},(_,i)=>i/30),t=>{relaxed(t);const ease=Math.sin(Math.PI*Math.min(t/.4,1)*.5)*Math.sin(Math.PI*Math.min((3-t)/.4,1)*.5);const arm=bones.RightArm,elbow=bones.RightForeArm,hand=bones.RightHand;const base=position(elbow).sub(position(arm)),target=new THREE.Vector3(-.6,-.65,.13).normalize();point(arm,elbow,base.normalize().lerp(target,ease));const fore=position(hand).sub(position(elbow)).normalize();point(elbow,hand,fore.lerp(new THREE.Vector3(-.15+Math.sin(t*8)*.15,.94,.2).normalize(),ease));}));
for(const a of output){const ch=a.channels.find(ch=>ch.target.path==='translation'),sm=a.samplers[ch.sampler],rows=g.rows(sm.output),times=g.rows(sm.input),first=rows[0],last=rows.at(-1),base=rest.Hips.p;
 const corrected=rows.map((p,i)=>[p[0]-first[0]+base.x-(last[0]-first[0])*times[i][0]/times.at(-1)[0],p[1],p[2]-first[2]+base.z-(last[2]-first[2])*times[i][0]/times.at(-1)[0]]);sm.output=g.addRows(corrected,'VEC3');}
g.json.animations=output;mkdirSync(`${root}/.staging`,{recursive:true});g.save(`${root}/.staging/animated.glb`);
execFileSync(process.env.BLENDER_PATH||'blender',['-b','-t','2','--python','blender/pack_lizzy.py'],{stdio:'inherit'});
const packed=new AvatarGLB(`${root}/.staging/decimated.glb`);
for(let i=0;i<packed.json.images.length;i++){const source=`${root}/.staging/texture-${i}.png`,out=`${root}/.staging/texture-${i}.webp`;writeFileSync(source,packed.image(i));execFileSync('magick',[source,'-resize','1024x1024>','-strip','-quality','90',out]);packed.json.images[i]={mimeType:'image/webp',bufferView:packed.addView(readFileSync(out))};}
for(const t of packed.json.textures){t.extensions={EXT_texture_webp:{source:t.source}};delete t.source;}packed.json.extensionsUsed=['EXT_texture_webp'];packed.json.extensionsRequired=['EXT_texture_webp'];
for(const n of packed.json.nodes)n.name=({Spine02:'Spine',Spine01:'Spine1',Spine:'Spine2',neck:'Neck'})[n.name]??n.name;
packed.json.asset.extras={requiredClips:output.map(a=>a.name),provenance:`${root}/README.md`,role:'Tutorial guide asset; tutorial behavior is not implemented by this export'};packed.compact();mkdirSync('public/models/guides',{recursive:true});packed.save('public/models/guides/lizzy.glb');
const final=readFileSync('public/models/guides/lizzy.glb'),triangles=packed.json.meshes.reduce((n,m)=>n+m.primitives.reduce((n,p)=>n+packed.json.accessors[p.indices].count/3,0),0);
if(triangles>20000||final.length>2000000)throw Error('Lizzy exceeds character budget');
writeFileSync(`${root}/build.json`,JSON.stringify({path:'public/models/guides/lizzy.glb',bytes:final.length,sha256:createHash('sha256').update(final).digest('hex'),triangles,clips:output.map(a=>a.name),method:'Supplied gait, reduced shoulder abduction, authored relaxed idle and greeting; original skin retained'},null,2)+'\n');
