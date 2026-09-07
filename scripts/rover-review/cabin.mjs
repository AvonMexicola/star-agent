import {outputPath,isMain,HUMAN_ASSET,EXPECTED_HUMAN_SHA} from './config.mjs';
import fs from'node:fs';
import{readAsset,ray,T}from'./asset.mjs';
import{tri,tree,query,fromMesh}from'./triangles.mjs';
import{a,L,pose,plain,index}from'./candidate.mjs';
const human=readAsset('human',HUMAN_ASSET);
if(human.sha256!==EXPECTED_HUMAN_SHA)throw Error('Human identity changed');
export function skinnedFrame(clip='idle',progress=.5){
 const f=human.frame({[clip]:progress}),meshes=[];
 human.j.nodes.forEach((n,i)=>{if(n.mesh===undefined)return;const skin=human.j.skins[n.skin],bind=skin?human.access(skin.inverseBindMatrices).map(q=>new T.Matrix4().fromArray(q)):null,bones=skin?.joints.map((j,k)=>f.world[j].clone().multiply(bind[k]));
 for(const p of human.j.meshes[n.mesh].primitives){const positions=human.access(p.attributes.POSITION),joints=skin?human.access(p.attributes.JOINTS_0):null,weights=skin?human.access(p.attributes.WEIGHTS_0):null,vertices=positions.map((v,k)=>{if(!skin)return new T.Vector3(...v).applyMatrix4(f.world[i]);const sum=new T.Vector3();for(let q=0;q<4;q++)if(weights[k][q])sum.addScaledVector(new T.Vector3(...v).applyMatrix4(bones[joints[k][q]]),weights[k][q]);return sum;});meshes.push({name:n.name,vertices,indices:p.indices===undefined?vertices.map((_,k)=>k):human.access(p.indices).flat(),bounds:new T.Box3().setFromPoints(vertices)});}});
 const bounds=new T.Box3();meshes.forEach(m=>bounds.union(m.bounds));const bone=name=>new T.Vector3().setFromMatrixPosition(f.world[human.j.nodes.findIndex(n=>n.name===name)]),eye=bone('Head').add(new T.Vector3(0,.09,-.08));
 return{meshes,bounds,eye,bone};
}
const triangle=(m,k)=>new T.Triangle(...m.indices.slice(k,k+3).map(i=>m.vertices[i]));
function nearest(frame,point){let distance=Infinity,best;const q=new T.Vector3();for(const m of frame.meshes){if(m.bounds.distanceToPoint(point)>distance)continue;for(let k=0;k<m.indices.length;k+=3){triangle(m,k).closestPointToPoint(point,q);const d=q.distanceTo(point);if(d<distance){distance=d;best={mesh:m.name,triangle:k/3,point:q.toArray()};}}}return{distance,...best};}
function bodyHits(frame,body,offset){const staticTree=tree(frame.meshes.flatMap(m=>fromMesh(m,new T.Matrix4()))),counts={},samples=[];let pairs=0;for(const mesh of body.meshes)for(const t of fromMesh(mesh,new T.Matrix4().makeTranslation(...offset))){const qs=[];query(staticTree,t,qs);pairs+=qs.length;for(const q of qs){counts[q.name]=(counts[q.name]||0)+1;if(samples.length<10)samples.push({humanTriangle:t.index,rover:q.name,roverTriangle:q.index,bounds:plain(t.box.clone().intersect(q.box))});}}return{pairs,counts,samples};}
if(isMain(import.meta.url)){
 const open=pose({door:1.65,steps:0}),closed=pose(),path=[L.cabin.entryGround,...L.cabin.entryRoute],eye=[];
 for(let j=0;j<path.length-1;j++)for(let k=0;k<=24;k++){const t=k/24,p=new T.Vector3(...path[j]).lerp(new T.Vector3(...path[j+1]),t);eye.push({segment:j,t,eye:p.toArray(),...nearest(open,p)});}
 const samples=eye.filter(v=>v.distance<.12),idle=skinnedFrame('idle'),sit=skinnedFrame('sit-idle'),offset=new T.Vector3(...L.cabin.pilotEye).sub(sit.eye),seatedBounds=sit.bounds.clone().translate(offset);
 const seated={localPoseBounds:plain(sit.bounds),localEye:sit.eye.toArray(),offset:offset.toArray(),placedBounds:plain(seatedBounds),placedHips:sit.bone('Hips').add(offset).toArray(),placedFeet:['LeftFoot','RightFoot'].map(n=>sit.bone(n).add(offset).toArray()),...bodyHits(closed,sit,offset.toArray())};
 const seals=[];for(const z of[-1.1,-1,-.9,-.8])for(const y of[2.29,2.32,2.34,2.36])for(const side of[-1,1]){const start=new T.Vector3(0,y,z),hit=ray(closed,start,new T.Vector3(side,0,0),a,-1,1.2);seals.push({start:start.toArray(),side,hit});}
 const result={roverSHA:a.sha256,humanSHA:human.sha256,scope:'Actual skinned vertices evaluated with joint-world × inverse-bind matrices and authored sit-idle clip; no clone or undeformed Box3 shortcut. Pose aligned to runtime Head origin plus [0,.09,-.08] eye convention. Tests hypothetical seated placement, not an implemented animation/IK system.',idleBounds:plain(idle.bounds),idleEye:idle.eye.toArray(),eyeSphere:{radius:.12,samples:eye.length,minimum:eye.reduce((p,q)=>q.distance<p.distance?q:p),failures:samples},seated,seals};
 fs.writeFileSync(outputPath('cabin.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({roverSHA:a.sha256,humanSHA:human.sha256,idleBounds:result.idleBounds,idleEye:result.idleEye,eyeSphere:{...result.eyeSphere,failures:result.eyeSphere.failures.slice(0,8)},seated,unsealedRays:seals.filter(s=>!s.hit).length},null,2));
}
