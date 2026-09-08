import fs from 'node:fs';
import crypto from 'node:crypto';
import {readAsset,T} from './asset.mjs';
import {ASSET,LAYOUT,EXPECTED_SHA,outputPath} from './config.mjs';
const previous=process.env.ROVER_BEFORE_GLB,previousLayout=process.env.ROVER_BEFORE_LAYOUT;
if(!previous||!previousLayout)throw Error('Set ROVER_BEFORE_GLB and ROVER_BEFORE_LAYOUT to archived candidate 08 files for the historical panel delta.');
const a=readAsset('rover',previous),b=readAsset('rover',ASSET),af=a.frame(),bf=b.frame();
if(a.sha256!=='504e7d0d7ea832fab2b135897f1edd6bdc767f971bbf67fa017b3d0c541000e8'||b.sha256!==EXPECTED_SHA)throw Error('Historical delta input identity mismatch');
let compared=0,changed=0,sameTopology=true,maxOutsideError=0;const changes=[];
if(af.meshes.length!==bf.meshes.length)throw Error('Mesh count changed');
for(let k=0;k<af.meshes.length;k++){
 const x=af.meshes[k],y=bf.meshes[k];
 if(x.name!==y.name||x.vertices.length!==y.vertices.length||JSON.stringify(x.indices)!==JSON.stringify(y.indices)){sameTopology=false;changes.push({mesh:x.name,topologyChanged:true,oldVertices:x.vertices.length,newVertices:y.vertices.length});continue;}
 for(let i=0;i<x.vertices.length;i++){
  compared++;const d=y.vertices[i].clone().sub(x.vertices[i]);if(d.length()<=1e-7)continue;
  changed++;const v=x.vertices[i],inside=x.name==='MiningRover_Surface Geometry'&&v.x>=.8249&&v.x<=.8601&&v.y>=.4699&&v.y<=1.3101&&v.z>=-.6501&&v.z<=.6401;
  if(!inside)maxOutsideError=Math.max(maxOutsideError,d.length());
  changes.push({mesh:x.name,index:i,insidePanel:inside,old:v.toArray(),new:y.vertices[i].toArray(),delta:d.toArray()});
 }
}
function images(path,asset){const bytes=fs.readFileSync(path),base=28+bytes.readUInt32LE(12);return asset.j.images.map(im=>{const v=asset.j.bufferViews[im.bufferView],payload=bytes.subarray(base+(v.byteOffset||0),base+(v.byteOffset||0)+v.byteLength);return {mimeType:im.mimeType,bytes:payload.length,sha256:crypto.createHash('sha256').update(payload).digest('hex')};});}
const beforeImages=images(previous,a),afterImages=images(ASSET,b);
function triangleBag(frame){const bag=new Map();for(const m of frame.meshes)for(let k=0;k<m.indices.length;k+=3){const p=m.indices.slice(k,k+3).map(i=>m.vertices[i]),vs=p.map(v=>v.toArray().map(x=>x.toFixed(8)).join(',')),cyclic=[0,1,2].map(s=>[vs[s],vs[(s+1)%3],vs[(s+2)%3]].join('|')).sort()[0],key=m.name+'|'+cyclic;if(!bag.has(key))bag.set(key,[]);bag.get(key).push({mesh:m.name,triangle:k/3,vertices:p.map(v=>v.toArray())});}return bag;}
const ab=triangleBag(af),bb=triangleBag(bf),removed=[],added=[];let identicalTriangles=0;
for(const key of new Set([...ab.keys(),...bb.keys()])){const aa=ab.get(key)||[],ba=bb.get(key)||[],n=Math.min(aa.length,ba.length);identicalTriangles+=n;removed.push(...aa.slice(n));added.push(...ba.slice(n));}
const outside=(t,rear)=>t.mesh!=='MiningRover_Surface Geometry'||t.vertices.some(([x,y,z])=>x<.8249||x>.8601||y<.4699||y>1.3101||z<-.6501||z>rear);
const outsideChanges=[...removed.filter(t=>outside(t,.6401)),...added.filter(t=>outside(t,.6701))];
const geometricDelta={method:'Winding-preserving world-space triangle multiset at1e-8m coordinate serialization, independent of vertex welding/index reorder.',identicalTriangles,removedTriangles:removed.length,addedTriangles:added.length,outsidePanelChanges:outsideChanges,removed,added};
const r={beforeSHA:a.sha256,afterSHA:b.sha256,bytes:b.bytes,triangles:bf.triangles,directlyComparableVertices:compared,changedDirectlyComparableVertices:changed,packedTopologyIdentical:sameTopology,maxOutsideErrorInDirectComparison:maxOutsideError,geometricDelta,materialsIdentical:JSON.stringify(a.j.materials)===JSON.stringify(b.j.materials),nodesIdentical:JSON.stringify(a.j.nodes)===JSON.stringify(b.j.nodes),layoutIdentical:fs.readFileSync(previousLayout,'utf8')===fs.readFileSync(LAYOUT,'utf8'),embeddedImagesIdentical:JSON.stringify(beforeImages)===JSON.stringify(afterImages),beforeImages,afterImages,directComparison:changes,scope:'Every world-space triangle compared between immutable08 and09, preserving winding and duplicate triangle counts. Changed triangles must belong to the fixed starboard lower panel. Packed vertex welding may differ; it does not itself establish a geometry change elsewhere. No new whole-mechanism run.'};
fs.writeFileSync(outputPath('delta-08-09.json'),JSON.stringify(r,null,2)+'\n');
console.log(JSON.stringify({...r,beforeImages:undefined,afterImages:undefined,geometricDelta:{...geometricDelta,removed:removed.slice(0,2),added:added.slice(0,2),outsidePanelChanges:outsideChanges.slice(0,2)},directComparison:r.directComparison.slice(0,8)},null,2));

if(outsideChanges.length)throw Error('Geometry changed outside the historical lower-panel closure; inspect delta-08-09.json');
