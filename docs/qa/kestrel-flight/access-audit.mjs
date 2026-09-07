import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {fileURLToPath} from 'node:url';
const ROOT=fileURLToPath(new URL('../../../',import.meta.url)).replace(/\/$/,'');
const bytes=await fs.readFile(ROOT+'/assets/kestrel/kestrel.glb');
const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
assert.equal(sha256,'c48ed4e94b823f1f585e5d389ba8c88776731034025a7620162c8c3a5eb13b8a');
const n=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+n)),bin=bytes.subarray(28+n);
doc.buffers[0].uri='data:application/octet-stream;base64,'+bin.toString('base64');
for(const m of doc.materials||[]){delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;if(m.pbrMetallicRoughness){delete m.pbrMetallicRoughness.baseColorTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture;}}
globalThis.ProgressEvent??=class{constructor(type,init={}){this.type=type;Object.assign(this,init);}};
const gltf=await new GLTFLoader().parseAsync(JSON.stringify(doc),'');
const scene=gltf.scene,mixer=new THREE.AnimationMixer(scene),actions={};
for(const clip of gltf.animations){const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();action.paused=true;actions[clip.name]=action;}
function pose({canopy=0,gear=1,ladder=0}={}){for(const[name,value]of Object.entries({CanopyOpen:canopy,GearDown:gear,LadderDown:ladder})){actions[name].time=value*actions[name].getClip().duration;}mixer.update(0);scene.updateMatrixWorld(true);}
function ancestry(o,name){for(;o;o=o.parent)if(o.name===name)return true;return false;}
const physical=o=>o.isMesh&&!o.name.startsWith('AB_')&&!o.userData.initiallyHidden;
const v=new THREE.Vector3();
function bounds(root=scene,filter=physical){const b=new THREE.Box3();let vertices=0;root.traverse(o=>{if(!filter(o))return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){b.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld));vertices++;}});return {min:b.min.toArray(),max:b.max.toArray(),vertices};}
function mergeBounds(a,b){if(!a)return structuredClone(b);for(let i=0;i<3;i++){a.min[i]=Math.min(a.min[i],b.min[i]);a.max[i]=Math.max(a.max[i],b.max[i]);}return a;}
function meshInventory(){const list=[];scene.traverse(o=>{if(physical(o))list.push({name:o.name,parent:o.parent.name,...bounds(o)});});return list;}
pose();const defaultClosed=bounds(),closedMeshes=meshInventory();
pose({gear:0});const gearStowed=bounds();
const gearNames=['Gear_Nose','Gear_L','Gear_R'],gearUnion={},gearPoseSamples=[];
for(let i=0;i<=1200;i++){
 const fraction=i/1200;pose({gear:fraction});
 for(const name of gearNames)gearUnion[name]=mergeBounds(gearUnion[name],bounds(scene.getObjectByName(name)));
 if(i%300===0)gearPoseSamples.push({fraction,parts:Object.fromEntries(gearNames.map(name=>[name,bounds(scene.getObjectByName(name))]))});
}
// Every transform in this rig is rigid. Bound continuous motion between dense
// samples from each ancestor track's maximum angular/linear velocity and a
// conservative descendant radius. This is deliberately a conservative envelope,
// separate from the exact vertex bounds at each sampled pose.
const gearClip=actions.GearDown.getClip();
const rates=new Map();
for(const track of gearClip.tracks){
 const split=track.name.lastIndexOf('.'),name=track.name.slice(0,split),property=track.name.slice(split+1),arity=track.getValueSize();let maximum=0;
 for(let i=0;i<track.times.length-1;i++){
  const dt=track.times[i+1]-track.times[i];if(dt<=0)continue;
  const a=Array.from(track.values.slice(i*arity,(i+1)*arity)),b=Array.from(track.values.slice((i+1)*arity,(i+2)*arity));
  const delta=property==='quaternion'?new THREE.Quaternion(...a).normalize().angleTo(new THREE.Quaternion(...b).normalize()):new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b));
  maximum=Math.max(maximum,delta/dt);
 }
 const r=rates.get(name)||{};r[property]=maximum;rates.set(name,r);
}
const continuousGearBounds={};
for(const name of gearNames){
 const root=scene.getObjectByName(name);let speedBound=0;
 root.traverse(o=>{
  if(!physical(o))return;const p=o.geometry.attributes.position;let radius=0;
  for(let i=0;i<p.count;i++)radius=Math.max(radius,v.fromBufferAttribute(p,i).length());
  let speed=0;
  for(let node=o;node;node=node.parent){
   const rate=rates.get(node.name);if(rate){speed+=(rate.quaternion||0)*radius+(rate.position||0);}
   let maximumPosition=node.position.length();
   const track=gearClip.tracks.find(t=>t.name===node.name+'.position');
   if(track)for(let i=0;i<track.values.length;i+=3)maximumPosition=Math.max(maximumPosition,Math.hypot(...track.values.slice(i,i+3)));
   radius+=maximumPosition;
   if(node===root)break;
  }
  speedBound=Math.max(speedBound,speed);
 });
 const interval=gearClip.duration/1200,error=speedBound*interval/2+1e-6;
 continuousGearBounds[name]={min:gearUnion[name].min.map(x=>x-error),max:gearUnion[name].max.map(x=>x+error),method:'1201 exact sampled mesh bounds plus a conservative maximum ancestor-track speed × half sample interval margin',maximumVertexSpeedBound:speedBound,sampleInterval:interval,paddingMetres:error};
}
pose({canopy:1,gear:1,ladder:1});
const accessBounds=bounds(),accessMeshes=meshInventory(),accessFrames={};
for(const name of ['PilotEye','Seat','Cockpit','Canopy','Ladder','Ladder_Upper','Ladder_Middle','Ladder_Lower',...gearNames]){
 const o=scene.getObjectByName(name);if(o)accessFrames[name]={worldOrigin:o.getWorldPosition(new THREE.Vector3()).toArray(),worldQuaternion:o.getWorldQuaternion(new THREE.Quaternion()).toArray(),bounds:bounds(o)};
}
function verticalHits(x,z){const ray=new THREE.Raycaster(new THREE.Vector3(x,7,z),new THREE.Vector3(0,-1,0),0,8);return ray.intersectObject(scene,true).filter(h=>physical(h.object)).map(h=>({y:h.point.y,normalY:h.face.normal.clone().transformDirection(h.object.matrixWorld).y,mesh:h.object.name,parent:h.object.parent.name})).filter((h,i,a)=>!a.slice(0,i).some(k=>k.mesh===h.mesh&&Math.abs(k.y-h.y)<1e-5));}
const accessColumns=[[-2.08,-1.75],[-1.766,-1.75],[-1.67,-1.75],[-1.49,-1.75],[-1.31,-1.75],[-1.13,-1.75],[-.95,-1.75],[-.75,-1.75],[-.55,-1.75],[-.425,-1.75],[-.25,-1.90],[0,-1.90]].map(([x,z])=>({x,z,hits:verticalHits(x,z)}));
const cameraClearance=[];
const cameraPath=[[-2.08,1.75,-1.75],[-2.08,2.8394,-1.75],[-2.08,3.961,-1.75],[-1.74,4.0425,-1.75],[-1.31,4.0425,-1.75],[-.95,4.0425,-1.75],[-.75,3.945,-1.75],[-.40,3.75,-1.83],[0,3.45,-1.9],[0,2.49,-1.9]];
for(let i=0;i<cameraPath.length-1;i++){
 const a=new THREE.Vector3(...cameraPath[i]),b=new THREE.Vector3(...cameraPath[i+1]),d=b.clone().sub(a),length=d.length();
 const ray=new THREE.Raycaster(a,d.normalize(),.001,length-.001);
 cameraClearance.push({from:a.toArray(),to:b.toArray(),hits:ray.intersectObject(scene,true).filter(h=>physical(h.object)).map(h=>({point:h.point.toArray(),mesh:h.object.name}))});
}
// Closed static skin split into six longitudinal slabs; full wing span starts
// only near the aft wing, so no solid rectangle fills the empty underbody.
pose();
const boundaries=[-6.76,-4.0,-2.5,0,2.8,5.5,6.76],staticSlabs=[];
for(let i=0;i<boundaries.length-1;i++){
 const z0=boundaries[i],z1=boundaries[i+1],b=new THREE.Box3();let triangles=0;
 scene.traverse(o=>{
  if(!physical(o)||gearNames.some(name=>ancestry(o,name)))return;
  const p=o.geometry.attributes.position,idx=o.geometry.index,count=idx?idx.count:p.count;
  for(let j=0;j<count;j+=3){
   const triangle=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(j+k):j+k).applyMatrix4(o.matrixWorld));
   let poly=triangle;
   for(const [limit,keepAbove]of [[z0,true],[z1,false]]){
    const next=[];for(let k=0;k<poly.length;k++){
     const a=poly[k],c=poly[(k+1)%poly.length],ia=keepAbove?a.z>=limit:a.z<=limit,ic=keepAbove?c.z>=limit:c.z<=limit;
     if(ia)next.push(a);if(ia!==ic)next.push(a.clone().lerp(c,(limit-a.z)/(c.z-a.z)));
    }poly=next;if(!poly.length)break;
   }
   if(poly.length){for(const point of poly)b.expandByPoint(point);triangles++;}
  }
 });
 staticSlabs.push({id:'closed-static-'+i,zRange:[z0,z1],min:b.min.toArray(),max:b.max.toArray(),contributingTriangles:triangles});
}
const contactPads={};
for(const name of gearNames){const root=scene.getObjectByName(name),points=[];root.traverse(o=>{if(!physical(o))return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);if(Math.abs(v.y)<1e-5)points.push(v.toArray());}});contactPads[name]={points,projection:{minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minZ:Math.min(...points.map(p=>p[2])),maxZ:Math.max(...points.map(p=>p[2]))}};}
function triangles(root=scene,filter=physical){const list=[];root.traverse(o=>{if(!filter(o))return;const p=o.geometry.attributes.position,idx=o.geometry.index,count=idx?idx.count:p.count;for(let i=0;i<count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i):i).applyMatrix4(o.matrixWorld),b=new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i+1):i+1).applyMatrix4(o.matrixWorld),c=new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i+2):i+2).applyMatrix4(o.matrixWorld);list.push({triangle:new THREE.Triangle(a,b,c),min:[Math.min(a.x,b.x,c.x),Math.min(a.y,b.y,c.y),Math.min(a.z,b.z,c.z)],max:[Math.max(a.x,b.x,c.x),Math.max(a.y,b.y,c.y),Math.max(a.z,b.z,c.z)],mesh:o.name});}});return list;}
// Quarter-metre source-geometry slabs keep the narrow cockpit station from
// inheriting the much wider wing box several metres aft. Exclude mechanisms
// here; add parked gear and actual open ladder separately.
const groundStaticTriangles=triangles(scene,o=>physical(o)&&!gearNames.some(name=>ancestry(o,name))&&!ancestry(o,'Canopy')&&!ancestry(o,'Ladder'));
const walkingStaticSlabs=[];
for(let z0=-6.76;z0<6.75;z0+=.25){const z1=Math.min(6.76,z0+.25),b=new THREE.Box3();
 for(const {triangle,min,max}of groundStaticTriangles){if(min[2]>z1||max[2]<z0)continue;let poly=[triangle.a,triangle.b,triangle.c];
  for(const [limit,keepAbove]of [[z0,true],[z1,false]]){const next=[];for(let k=0;k<poly.length;k++){const a=poly[k],c=poly[(k+1)%poly.length],ia=keepAbove?a.z>=limit:a.z<=limit,ic=keepAbove?c.z>=limit:c.z<=limit;if(ia)next.push(a);if(ia!==ic)next.push(a.clone().lerp(c,(limit-a.z)/(c.z-a.z)));}poly=next;if(!poly.length)break;}
  for(const p of poly)b.expandByPoint(p);
 }
 if(!b.isEmpty())walkingStaticSlabs.push({min:b.min.toArray(),max:b.max.toArray()});
}
const parkedGear=Object.fromEntries(gearNames.map(name=>[name,bounds(scene.getObjectByName(name))]));
pose({canopy:1,gear:1,ladder:1});
const accessTriangles=triangles();
function sphereProximity(centre,list,radius=.12){let minDistance=.5,closest=null;const a=centre.toArray(),q=new THREE.Vector3();
 for(const t of list){if(a.some((n,i)=>n<t.min[i]-.5||n>t.max[i]+.5))continue;t.triangle.closestPointToPoint(centre,q);const distance=centre.distanceTo(q);if(distance<minDistance){minDistance=distance;closest={point:q.toArray(),mesh:t.mesh};}}
 return {distance:minDistance,penetration:radius-minDistance,closest};
}
const accessSource=await fs.readFile(ROOT+'/src/kestrel-access.js');
const {KestrelAccess}=await import(ROOT+'/src/kestrel-access.js');
const nav={shipPosition:new THREE.Vector3(),shipOrientation:new THREE.Quaternion(),mode:'landed',gearProgress:1,dockedAtStation:true,position:new THREE.Vector3(0,2.49,-1.9),velocity:new THREE.Vector3(),angularVelocity:new THREE.Vector3(),keys:new Set(),notify(){},fromShipLocal(p){return p.clone();},toShipLocal(p=this.position){return p.clone();},station:{deckPoint(p,height){return new THREE.Vector3(p.x,height,p.z);}}};
const access=new KestrelAccess();access.interact(nav);const route=access.route.map(p=>p.toArray()),routeSegments=[];
for(let i=0;i<route.length-1;i++){
 const a=new THREE.Vector3(...route[i]),b=new THREE.Vector3(...route[i+1]),length=a.distanceTo(b),steps=Math.max(1,Math.ceil(length/.01));let nearest={distance:Infinity},collisions=0;
 for(let j=0;j<=steps;j++){const centre=a.clone().lerp(b,j/steps),found=sphereProximity(centre,accessTriangles,.12);if(found.distance<nearest.distance)nearest={...found,centre:centre.toArray()};if(found.distance<.12)collisions++;}
 routeSegments.push({from:a.toArray(),to:b.toArray(),samples:steps+1,maximumSampleSpacing:length/steps,minDistance:nearest.distance,clearAtRadiusPoint12:nearest.distance>=.12,continuousClearAtRadiusPoint12:nearest.distance>=.12+length/steps/2,collidingSamples:collisions,nearest});
}
const waitingLadderChecks=[];
for(const x of [-2.45,-2.65,-2.8,-3.1]){const centre=new THREE.Vector3(x,1.75,-1.75);let nearest={distance:Infinity};
 for(let i=0;i<=360;i++){pose({canopy:1,gear:1,ladder:i/360});const found=sphereProximity(centre,triangles(scene.getObjectByName('Ladder')),.12);if(found.distance<nearest.distance)nearest={...found,progress:i/360};}
 waitingLadderChecks.push({centre:centre.toArray(),samples:361,nearest});
}
const meshCache=new Map();
function sceneSphere(centre){let nearest={distance:.5,penetration:-.38,closest:null};scene.traverse(o=>{
 if(!physical(o))return;if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();const box=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);if(box.distanceToPoint(centre)>.5)return;
 let cached=meshCache.get(o);if(!cached||!cached.matrix.equals(o.matrixWorld)){cached={matrix:o.matrixWorld.clone(),triangles:triangles(o)};meshCache.set(o,cached);}
 const found=sphereProximity(centre,cached.triangles);if(found.distance<nearest.distance)nearest=found;
 });return nearest;}
const simulatedSequences=[];
for(const direction of ['in','out']){
 const a=new KestrelAccess(),mock={...nav,position:new THREE.Vector3(...(direction==='in'?[-2.45,1.75,-1.75]:[0,2.49,-1.9])),mode:direction==='in'?'walk':'landed',orientation:new THREE.Quaternion(),velocity:new THREE.Vector3(),angularVelocity:new THREE.Vector3(),keys:new Set()};
 a.interact(mock);const phaseChanges=[],samples=[],dt=1/120;let prevPhase=null,nearest={distance:.5},maxEyeStep=0,time=0;
 for(let i=0;i<10000&&a.busy;i++){
  const previous=mock.position.clone();a.update(dt,mock);time+=dt;maxEyeStep=Math.max(maxEyeStep,previous.distanceTo(mock.position));
  pose({canopy:a.canopy,gear:1,ladder:a.ladder});const found=sceneSphere(mock.position);
  if(found.distance<nearest.distance)nearest={...found,time,phase:a.phase,canopy:a.canopy,ladder:a.ladder,eye:mock.position.toArray()};
  if(found.distance<.12)samples.push({time,phase:a.phase,canopy:a.canopy,ladder:a.ladder,eye:mock.position.toArray(),...found});
  if(a.phase!==prevPhase){phaseChanges.push({time,phase:a.phase,canopy:a.canopy,ladder:a.ladder,eye:mock.position.toArray()});prevPhase=a.phase;}
 }
 assert.equal(a.busy,false,direction+' access sequence terminates');assert.ok(maxEyeStep<=.9*dt+1e-8,'continuous speed-bounded eye movement');
 simulatedSequences.push({direction,dt,time,phaseChanges,maxEyeStep,nearest,collidingSamples:samples.length,firstCollisions:samples.slice(0,10),finalState:a.snapshot,finalEye:mock.position.toArray()});
}
// Ground-only body check. The cockpit route deliberately changes posture; do
// not pretend this standing capsule certifies an articulated climb or seat.
function segmentSegmentDistance(p0,p1,q0,q1){
 const d1=p1.clone().sub(p0),d2=q1.clone().sub(q0),r=p0.clone().sub(q0),a=d1.dot(d1),e=d2.dot(d2),f=d2.dot(r);let s,t;
 if(a<=1e-16&&e<=1e-16)return p0.distanceTo(q0);
 if(a<=1e-16){s=0;t=THREE.MathUtils.clamp(f/e,0,1);}else{const c=d1.dot(r);if(e<=1e-16){t=0;s=THREE.MathUtils.clamp(-c/a,0,1);}else{const b=d1.dot(d2),denom=a*e-b*b;s=denom!==0?THREE.MathUtils.clamp((b*f-c*e)/denom,0,1):0;t=(b*s+f)/e;if(t<0){t=0;s=THREE.MathUtils.clamp(-c/a,0,1);}else if(t>1){t=1;s=THREE.MathUtils.clamp((b-c)/a,0,1);}}}
 return p0.clone().addScaledVector(d1,s).distanceTo(q0.clone().addScaledVector(d2,t));
}
function segmentTriangleDistance(a,b,t){
 const d=b.clone().sub(a),normal=t.getNormal(new THREE.Vector3()),denom=normal.dot(d);
 if(Math.abs(denom)>1e-14){const f=normal.dot(t.a.clone().sub(a))/denom;if(f>=0&&f<=1&&t.containsPoint(a.clone().addScaledVector(d,f)))return 0;}
 const qa=t.closestPointToPoint(a,new THREE.Vector3()),qb=t.closestPointToPoint(b,new THREE.Vector3());
 return Math.min(a.distanceTo(qa),b.distanceTo(qb),segmentSegmentDistance(a,b,t.a,t.b),segmentSegmentDistance(a,b,t.b,t.c),segmentSegmentDistance(a,b,t.c,t.a));
}
function standingCapsule(eye){
 const radius=.25,a=eye.clone().add(new THREE.Vector3(0,-1.75+radius,0)),b=eye.clone().add(new THREE.Vector3(0,.12-radius,0));let nearest={distance:.5,penetration:radius-.5,mesh:null};
 const candidateBox=new THREE.Box3().setFromPoints([a,b]).expandByScalar(.5);
 scene.traverse(o=>{if(!physical(o))return;if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();const box=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);if(!box.intersectsBox(candidateBox))return;
  let cached=meshCache.get(o);if(!cached||!cached.matrix.equals(o.matrixWorld)){cached={matrix:o.matrixWorld.clone(),triangles:triangles(o)};meshCache.set(o,cached);}
  for(const t of cached.triangles){if(t.min.some((v,i)=>v>candidateBox.max.getComponent(i))||t.max.some((v,i)=>v<candidateBox.min.getComponent(i)))continue;const distance=segmentTriangleDistance(a,b,t.triangle);if(distance<nearest.distance)nearest={distance,penetration:radius-distance,mesh:t.mesh};}
 });return nearest;
}
const groundCapsuleChecks=[];
pose({canopy:0,gear:1,ladder:0});
let stagingNearest={distance:.5},stagingCollisions=0;
for(let i=0;i<=65;i++){const eye=new THREE.Vector3(-2.45-.65*i/65,1.75,-1.75),found=standingCapsule(eye);if(found.distance<stagingNearest.distance)stagingNearest={...found,eye:eye.toArray()};if(found.distance<.25)stagingCollisions++;}
groundCapsuleChecks.push({test:'Closed-mechanism approach from entry to safe staging point',samples:66,maxEyeSpacing:.01,nearest:stagingNearest,collidingSamples:stagingCollisions,continuousClearanceWithHalfSampleGuard:stagingNearest.distance-.25-.005});
for(const x of [-2.45,-3.1]){let nearest={distance:.5},collisions=0;for(let i=0;i<=480;i++){const t=i/100;pose({canopy:Math.min(1,t/3),gear:1,ladder:Math.max(0,(t-3)/1.8)});const found=standingCapsule(new THREE.Vector3(x,1.75,-1.75));if(found.distance<nearest.distance)nearest={...found,time:t};if(found.distance<.25)collisions++;}groundCapsuleChecks.push({test:'Standing at x = '+x+' during staged canopy and ladder deployment',samples:481,timeSpacing:.01,nearest,collidingSamples:collisions});}
pose({canopy:1,gear:1,ladder:1});let approachNearest={distance:.5},approachCollisions=0;
for(let i=0;i<=65;i++){const eye=new THREE.Vector3(-3.1+.65*i/65,1.75,-1.75),found=standingCapsule(eye);if(found.distance<approachNearest.distance)approachNearest={...found,eye:eye.toArray()};if(found.distance<.25)approachCollisions++;}
groundCapsuleChecks.push({test:'Fully deployed approach from staging to entry',samples:66,maxEyeSpacing:.01,nearest:approachNearest,collidingSamples:approachCollisions,continuousClearanceWithHalfSampleGuard:approachNearest.distance-.25-.005});
const accessRuntimeAudit={sourceSha256:crypto.createHash('sha256').update(accessSource).digest('hex'),route,method:'Actual exported KestrelAccess.interact() route, flat authored station ground; sphere radius .12 m, <=.01 m path steps. Nearest triangle distance >= .12 + half spacing certifies between-step clearance for linear segments. Distances are capped at .5 m (a lower bound when no closer triangle exists). Full actual update() sequences additionally sampled at 120 Hz against contemporaneous GLB mechanism poses.',routeSegments,waitingLadderChecks,simulatedSequences};
accessRuntimeAudit.groundCapsuleAudit={method:'Standing ground-only capsule: radius .25 m, total height 1.87 m, foot at eyeY - 1.75 m. Exact triangle-to-capsule-axis distances. Ground approaches sampled every .01 m, mechanism deployment every .01 s. Distances capped at .5 m. Does not apply the standing body to the crouched/climbing/seated interior route.',checks:groundCapsuleChecks};
const report={sha256,bytes:bytes.length,coordinates:'metres; +Y up; -Z nose; origin authored ground-contact plane',method:'Original GLB loaded without image-map references, all mechanism tracks evaluated together by AnimationMixer; exact transformed vertices and triangle-clipped static envelopes. No geometry/source changes.',closedGearDownBounds:defaultClosed,closedGearStowedBounds:gearStowed,closedMeshes,gearSampledUnion:gearUnion,continuousGearBounds,gearPoseSamples,contactPads,accessBounds,accessFrames,accessMeshes,accessColumns,cameraPath,cameraSegmentRayChecks:cameraClearance,accessRuntimeAudit,walkingStaticSlabs,parkedGear,proposedFlightParts:[...staticSlabs,...Object.entries(continuousGearBounds).map(([name,b])=>({id:name,min:b.min,max:b.max}))],limitations:['Camera centre-line rays are not standing capsule or articulated pilot clearance certification.','Static parts are conservative AABBs clipped from triangles by longitudinal slab; gear unions conservatively include every pose.','Afterburner emission geometry excluded from physical collision.','Seated cockpit needs a seated/climb posture, not Nomad standing-floor fallback.']};
await fs.writeFile('/tmp/kestrel-access-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sha256,closedGearDownBounds:defaultClosed,walkingStaticSlabs:walkingStaticSlabs.length,accessRuntimeAudit},null,2));
