import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {AtlasMarkIISystems} from '../src/atlas-mark-ii-systems.js';
const base=new URL('..',import.meta.url).pathname.replace(/\/$/,''),bytes=await fs.readFile(base+'/public/models/atlas-mark-ii/atlas-mark-ii.glb');
const n=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+n)),bin=bytes.subarray(28+n);
doc.buffers[0].uri='data:application/octet-stream;base64,'+bin.toString('base64');
for(const mesh of doc.meshes)for(const p of mesh.primitives)delete p.material;
for(const key of ['materials','textures','images','samplers'])delete doc[key];
globalThis.ProgressEvent??=class{constructor(type,init={}){this.type=type;Object.assign(this,init);}};
const {scene}=await new GLTFLoader().parseAsync(JSON.stringify(doc),'');
scene.traverse(o=>{if(o.isMesh)o.material.side=T.DoubleSide;});
const systems=new AtlasMarkIISystems().bind(scene),report={sha256:crypto.createHash('sha256').update(bytes).digest('hex'),gear:[],ramps:[],cargo:[],scope:'41 sampled positions per gear leg and door pair against actual exported static triangles. Trunnion and door hinge contact volumes explicitly excluded; not a continuous collision proof, actuator dynamics model, art gate or performance result.'};
function triangles(root){const out=[];root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,idx=o.geometry.index;for(let i=0;i<(idx?.count??p.count);i+=3){const vs=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(o.matrixWorld));const tri=new T.Triangle(...vs),box=new T.Box3().setFromPoints(vs);out.push({tri,box,mesh:o.name});}});return out;}
function triHit(a,b){if(!a.box.intersectsBox(b.box))return false;const av=[a.tri.a,a.tri.b,a.tri.c],bv=[b.tri.a,b.tri.b,b.tri.c],ae=av.map((v,i)=>av[(i+1)%3].clone().sub(v)),be=bv.map((v,i)=>bv[(i+1)%3].clone().sub(v));const an=ae[0].clone().cross(ae[1]),bn=be[0].clone().cross(be[1]);const axes=[an,bn,...ae.flatMap(e=>be.map(f=>e.clone().cross(f))),...ae.map(e=>e.clone().cross(an)),...be.map(e=>e.clone().cross(bn))];for(const axis of axes){if(axis.lengthSq()<1e-15)continue;axis.normalize();const aa=av.map(v=>v.dot(axis)),bb=bv.map(v=>v.dot(axis));if(Math.max(...aa)<Math.min(...bb)-1e-5||Math.max(...bb)<Math.min(...aa)-1e-5)return false;}return true;}
const grid=new Map(),cell=2;
function keys(box){const k=[];for(let x=Math.floor(box.min.x/cell);x<=Math.floor(box.max.x/cell);x++)for(let y=Math.floor(box.min.y/cell);y<=Math.floor(box.max.y/cell);y++)for(let z=Math.floor(box.min.z/cell);z<=Math.floor(box.max.z/cell);z++)k.push(`${x},${y},${z}`);return k;}
const dynamic=new Set(systems.gear.legs.flatMap(l=>[l.node,...l.doors.map(d=>d.node)]));
scene.updateMatrixWorld(true);
const staticTris=[];scene.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(dynamic.has(p.name))return;const list=triangles(o);for(const t of list){const id=staticTris.length;staticTris.push(t);for(const key of keys(t.box)){if(!grid.has(key))grid.set(key,[]);grid.get(key).push(id);}}});
for(let i=0;i<=40;i++){
 systems.gear.progress=i/40;systems.applyTransforms();
 for(const leg of systems.gear.legs){
  const pose={id:leg.id,progress:i/40,padPivotError:leg.footObject.position.distanceTo(new T.Vector3(0,leg.padPivotY-leg.pivot[1],0)),minY:Infinity,hits:[],hitCount:0};
  const joint=new T.Box3(new T.Vector3(leg.pivot[0]-1.08,leg.pivot[1]-.65,leg.pivot[2]-.7),new T.Vector3(leg.pivot[0]+1.08,leg.pivot[1]+.65,leg.pivot[2]+.7));
  for(const node of [leg.nodeObject,...leg.doors.map(d=>d.nodeObject)])for(const tri of triangles(node)){
   pose.minY=Math.min(pose.minY,tri.box.min.y);
   const candidates=new Set(keys(tri.box).flatMap(k=>grid.get(k)??[]));
   for(const id of candidates){const b=staticTris[id];if(!triHit(tri,b))continue;
    const overlap=tri.box.clone().intersect(b.box);
    // Bearings and hinge pins intentionally mate inside these local joints.
    if(joint.containsBox(overlap))continue;
    if(node!==leg.nodeObject){const door=leg.doors.find(d=>d.nodeObject===node);const [x,y]=door.pivot;if(overlap.min.x>=x-.18&&overlap.max.x<=x+.18&&overlap.min.y>=y-.23&&overlap.max.y<=y+.18)continue;}
    pose.hitCount++;if(pose.hits.length<8)pose.hits.push({moving:tri.mesh,static:b.mesh,min:overlap.min.toArray(),max:overlap.max.toArray()});
   }
  }
  report.gear.push(pose);
 }
}
for(const ramp of systems.ramps){for(let i=0;i<=100;i++){ramp.angle=T.MathUtils.lerp(ramp.closedAngle,ramp.openAngle,i/100);ramp.tipAngle=Math.PI*(1-i/100);systems.applyTransforms();let minY=Infinity,mesh;for(const tri of triangles(ramp.nodeObject))if(tri.box.min.y<minY){minY=tri.box.min.y;mesh=tri.mesh;}if(i%25===0||minY<-.00001)report.ramps.push({id:ramp.id,progress:i/100,minY,mesh});}}
for(const x of [-3.9,-3.52,-3.38,-3.25,0,3.25,3.38,3.52,3.9])for(const z of [-24,-23.8,-22,-20,-3,0,4,21,23.8,24]){const hits=new T.Raycaster(new T.Vector3(x,7,z),new T.Vector3(0,1,0),0,3).intersectObject(scene,true);report.cargo.push({x,z,y:hits[0]?.point.y,mesh:hits[0]?.object.name});}
await fs.writeFile(process.env.ATLAS_MOTION_OUT || '/tmp/atlas-refresh-motion.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({gearPoses:report.gear.length,gearFailures:report.gear.filter(p=>p.hitCount||p.minY<-.00001).map(p=>({id:p.id,p:p.progress,hits:p.hitCount,minY:p.minY,first:p.hits[0]})),rampMinimum:Math.min(...report.ramps.map(p=>p.minY)),laneIntrusions:report.cargo.filter(p=>p.y<8.8-.00001)},null,2));
assert.ok(report.gear.every(p=>p.hitCount===0&&p.minY>=-.00001&&p.padPivotError<.00001),'Gear geometry, pins or sampled static clearance failed');
assert.ok(report.ramps.every(p=>p.minY>=-.00001),'Ramp stock crosses the true landing plane');
assert.ok(report.cargo.every(p=>Number.isFinite(p.y)&&p.y>=8.8-.00001),'A cargo clearance ray misses the roof or hits below its declared height');
