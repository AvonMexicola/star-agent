import {outputPath,isMain,HUMAN_ASSET,EXPECTED_HUMAN_SHA} from './config.mjs';
import fs from 'node:fs';
import {a,L,pose,index,plain,hits} from './candidate.mjs';
import {readAsset,T,envelope} from './asset.mjs';
import {fromMesh,tree,query} from './triangles.mjs';
import {components} from './components.mjs';
const I=new T.Matrix4(),f=pose();
const parts=f.meshes.flatMap(m=>components(m).all.map(c=>({...c,mesh:m,centre:c.bounds.getCenter(new T.Vector3())})));
const closest=(p,root=null)=>parts.filter(c=>root===null||a.under(c.mesh.node,index(root))).map(c=>({c,d:c.centre.distanceTo(new T.Vector3(...p))})).sort((a,b)=>a.d-b.d)[0].c;
const submesh=c=>({...c.mesh,indices:c.triangles.flatMap(k=>c.mesh.indices.slice(k*3,k*3+3)),bounds:c.bounds});
const triangles=c=>fromMesh(submesh(c),I),record=c=>({mesh:c.name,node:c.mesh.node,triangles:c.triangles.length,bounds:plain(c.bounds)});
function pairCount(a,b){const bt=tree(triangles(b));let count=0;for(const t of triangles(a)){const q=[];query(bt,t,q);count+=q.length;}return count;}
const treads=[[-1.55,.16],[-1.19,.34],[-.94,.44]].map(([x,y])=>closest([x,y,-.1],'BoardingSteps'));
const stringers=[-.31,.11].map(z=>closest([-1.235,.282,z],'BoardingSteps')),attachments=[-.31,.11].map(z=>closest([-.825,.41,z],'BoardingSteps')),floor=closest([0,.42,.005]);
const stairs=[];
for(let j=0;j<2;j++)for(let i=0;i<3;i++){
 const s=stringers[j],t=treads[i],above=envelope({meshes:[submesh(s)]},I,{min:[t.bounds.min.x,t.bounds.max.y,t.bounds.min.z],max:[t.bounds.max.x,1,t.bounds.max.z]},{under:()=>false});
 stairs.push({stringer:j,tread:i,surfaceIntersectionPairs:pairCount(s,t),treadTop:t.bounds.max.y,aboveTreadTriangles:above.triangles,aboveTreadBounds:above.clippedBounds,maximumAboveTread:above.clippedBounds?above.clippedBounds.max[1]-t.bounds.max.y:0});
}
const bases={front:closest([0,.89,-1.59]),port:closest([-.872,.895,-.12],'CabinDoor'),starboard:closest([.86,.89,-.005])},gaskets={front:closest([0,.88,-1.631]),port:closest([-.906,.88,-.105],'CabinDoor'),starboard:closest([.863,.88,-.105])},covers={front:closest([0,.88,-1.646]),port:closest([-.916,.88,-.105],'CabinDoor'),starboard:closest([.873,.88,-.105])};
const frontFastener=closest([-.35,.72,-1.663]),latches={port:closest([-.926,.88,-.36],'CabinDoor'),starboard:closest([.883,.88,-.36])};
const attachmentsReview={baseBounds:Object.fromEntries(Object.entries(bases).map(([k,c])=>[k,record(c)])),gasketBounds:Object.fromEntries(Object.entries(gaskets).map(([k,c])=>[k,record(c)])),gasketToBaseGap:{front:bases.front.bounds.min.z-gaskets.front.bounds.max.z,port:bases.port.bounds.min.x-gaskets.port.bounds.max.x,starboard:gaskets.starboard.bounds.min.x-bases.starboard.bounds.max.x},coverToGasketPairs:Object.fromEntries(Object.keys(bases).map(k=>[k,pairCount(covers[k],gaskets[k])])),frontFastenerToCoverGap:covers.front.bounds.min.z-frontFastener.bounds.max.z,latchToCoverGap:{port:covers.port.bounds.min.x-latches.port.bounds.max.x,starboard:latches.starboard.bounds.min.x-covers.starboard.bounds.max.x}};
const text={scope:'Historical 04-to-05 exported text-basis delta is retained in the archived review; current text/emblem orientation is judged in native renders.'};
const changedPartBounds={roof:record(closest([0,2.42,-.215])),roofInset:record(closest([0,2.483,-.215])),fenderReturns:[-1,1].map(s=>record(closest([s*1.272,1.325,1.35]))),fenderShoulders:[-1,1].map(s=>record(closest([s*.866,1.305,1.35]))),cassetteSeals:[-1,1].map(s=>record(closest([s*.43,1.819,1.365])))};
const door=[];for(let k=0;k<=12;k++){const angle=1.65*k/12,frame=pose({door:angle});door.push({angle,...hits(frame,'CabinDoor')});}
const cutter=[];for(const yaw of[-.4,0,.4])for(const pitch of[-.48,0,.18]){const frame=pose({yaw,pitch,steer:.52,suspension:.22});for(const c of L.cutters)cutter.push({id:c.id,yaw,pitch,...hits(frame,c.pivot)});}
const output={afterSHA:a.sha256,bytes:a.bytes,triangles:f.triangles,newBounds:plain(f.bounds),stairs,stairToChassis:stringers.map((s,i)=>({stringer:i,stringerToAttachmentPairs:pairCount(s,attachments[i]),attachmentToFloorPairs:pairCount(attachments[i],floor)})),attachmentsReview,text,changedPartBounds,door,cutter,scope:'Actual exported component geometry, triangle-surface connections and explicit sampled poses. Positive scalar attachment gaps prove separation in that axis. Surface contacts are not load/strength certificates. No material score or gameplay claim.'};
fs.writeFileSync(outputPath('structure.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({sha:a.sha256,bounds:output.newBounds,stairs,stairToChassis:output.stairToChassis,gaps:attachmentsReview.gasketToBaseGap,frontFastenerGap:attachmentsReview.frontFastenerToCoverGap,latchGaps:attachmentsReview.latchToCoverGap,text,door:door.filter(x=>x.pairs).map(({angle,pairs,bounds,byName})=>({angle,pairs,bounds,byName})),cutters:cutter.filter(x=>x.pairs).map(({id,yaw,pitch,pairs,bounds,byName})=>({id,yaw,pitch,pairs,bounds,byName}))},null,2));
