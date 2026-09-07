import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const ROOT=process.env.STATION_REVIEW_SOURCE||'/home/cees/projects/star-agent-dev';
const T=await import(pathToFileURL(path.join(ROOT,'node_modules/three/build/three.module.js')));
const {createExterior,POD_LAYOUT,RING_RADIUS,RING_SPEED}=await import(pathToFileURL(path.join(ROOT,'src/station-architecture.js')));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const plain=b=>({min:b.min.toArray(),max:b.max.toArray(),size:b.getSize(new T.Vector3()).toArray()});
function glb(file){
 const bytes=fs.readFileSync(path.join(ROOT,'public/models',file));
 const j=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12))),bin=28+bytes.readUInt32LE(12);
 const bounds=new T.Box3(),nodes=[];let triangles=0,primitives=0;
 function visit(i,parent){
  const n=j.nodes[i],local=n.matrix?new T.Matrix4().fromArray(n.matrix):new T.Matrix4().compose(new T.Vector3().fromArray(n.translation||[0,0,0]),new T.Quaternion().fromArray(n.rotation||[0,0,0,1]),new T.Vector3().fromArray(n.scale||[1,1,1]));
  const matrix=parent.clone().multiply(local),own=new T.Box3();
  if(n.mesh!==undefined)for(const p of j.meshes[n.mesh].primitives){
   const a=j.accessors[p.attributes.POSITION],v=j.bufferViews[a.bufferView];
   if(a.componentType!==5126||a.sparse)throw Error('Unsupported position encoding');
   for(let k=0;k<a.count;k++){const o=bin+(v.byteOffset||0)+(a.byteOffset||0)+k*(v.byteStride||12);const q=new T.Vector3(bytes.readFloatLE(o),bytes.readFloatLE(o+4),bytes.readFloatLE(o+8)).applyMatrix4(matrix);bounds.expandByPoint(q);own.expandByPoint(q);}
   triangles+=(p.indices!==undefined?j.accessors[p.indices].count:a.count)/3;primitives++;
  }
  if(/Landing|Approach|DoorTrigger|HangarDoor/.test(n.name||''))nodes.push({name:n.name,origin:new T.Vector3().setFromMatrixPosition(matrix).toArray(),bounds:own.isEmpty()?null:plain(own)});
  for(const c of n.children||[])visit(c,matrix);
 }
 for(const i of j.scenes[j.scene||0].nodes)visit(i,new T.Matrix4());
 return {file,sha256:sha(bytes),bytes:bytes.length,triangles,primitives,meshes:j.meshes.length,materials:j.materials.length,bounds:plain(bounds),contractNodes:nodes,animations:(j.animations||[]).map(a=>({name:a.name,channels:a.channels.length}))};
}
const exterior=createExterior();exterior.group.updateMatrixWorld(true);
function auditGroup(group,filter=()=>true){
 let meshes=0,draws=0,triangles=0,vertices=0;const materials=new Set(),bounds=new T.Box3(),points=[];
 group.traverse(o=>{if(!o.isMesh||!filter(o))return;meshes++;draws+=Array.isArray(o.material)?o.geometry.groups.length:1;for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m.uuid);const count=o.isInstancedMesh?o.count:1;const pos=o.geometry.attributes.position;triangles+=(o.geometry.index?.count??pos.count)*count/3;vertices+=pos.count*count;for(let instance=0;instance<count;instance++){const matrix=o.matrixWorld.clone();if(o.isInstancedMesh){const m=new T.Matrix4();o.getMatrixAt(instance,m);matrix.multiply(m);}for(let k=0;k<pos.count;k++){const q=new T.Vector3().fromBufferAttribute(pos,k).applyMatrix4(matrix);bounds.expandByPoint(q);points.push(q.toArray());}}});
 return {meshes,nominalColourPassDrawsBeforeCulling:draws,instancedTriangleSum:triangles,expandedPositionCount:vertices,materials:materials.size,bounds:plain(bounds),points};
}
const all=auditGroup(exterior.group),rings=exterior.rings.map(r=>{const q=auditGroup(r);let radialMax=0,xMin=Infinity,xMax=-Infinity;for(const [x,y,z] of q.points){xMin=Math.min(xMin,x-r.position.x);xMax=Math.max(xMax,x-r.position.x);radialMax=Math.max(radialMax,Math.hypot(y,z));}delete q.points;return {centre:r.position.toArray(),...q,allRotationSweep:{localMinX:xMin,localMaxX:xMax,maxRadiusYZ:radialMax}};});
const fixed=auditGroup(exterior.group,o=>{for(let p=o;p;p=p.parent)if(exterior.rings.includes(p))return false;return true;});delete fixed.points;delete all.points;
const files={};for(const n of ['src/station-architecture.js','src/station-complex.js','src/station.js','src/station-collision.js','QUALITY.md','STATION-PIPELINE-MEMORY.md']){const b=fs.readFileSync(path.join(ROOT,n));files[n]={bytes:b.length,sha256:sha(b)};}
const result={sourceRoot:ROOT,gitHead:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),sourceFiles:files,units:'metres; station-complex +Y up; each pod has its own yaw frame',exterior:{all,fixed,rings,radius:RING_RADIUS,radiansPerSecond:RING_SPEED,rotationPeriodSeconds:2*Math.PI/RING_SPEED},podLayout:POD_LAYOUT,assets:[glb('station.glb'),glb('station_lod1.glb')],scope:'Read-only vertex and resource audit of base8576e99. No swept ship/door clearance certification; material counts are authored nodes, not prepared runtime material stats.'};
console.log(JSON.stringify(result,null,2));
