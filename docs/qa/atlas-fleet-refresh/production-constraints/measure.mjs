import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import * as THREE from '/tmp/star-agent-kestrel/node_modules/three/build/three.module.js';
import {GLTFLoader} from '/tmp/star-agent-kestrel/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const OUT=path.dirname(fileURLToPath(import.meta.url)),ROOT=path.resolve(OUT,'../../../..');
const baselineCommit='7b97f5a';
const baselineFile=p=>execFileSync('git',['show',`${baselineCommit}:${p}`],{cwd:ROOT,maxBuffer:64*1024*1024});
const assetPath='public/models/atlas-mark-ii/atlas-mark-ii.glb';
const bytes=baselineFile(assetPath),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
assert.equal(sha256,'a3b6e095060b965fbc51bb7e87dea4f985521d114efeaf5493d18bfe9ea434aa','This audit measures the frozen baseline, not a new candidate');
const n=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+n)),bin=bytes.subarray(28+n);
doc.buffers[0].uri='data:application/octet-stream;base64,'+bin.toString('base64');
for(const mesh of doc.meshes)for(const p of mesh.primitives)delete p.material;
for(const key of ['materials','textures','images','samplers'])delete doc[key];
globalThis.ProgressEvent??=class{constructor(type,init={}){this.type=type;Object.assign(this,init);}};
const {scene}=await new GLTFLoader().parseAsync(JSON.stringify(doc),'');scene.updateMatrixWorld(true);
const layoutBytes=baselineFile('assets/atlas-mark-ii/layout.json'),layout=JSON.parse(layoutBytes);
let source=baselineFile('src/atlas-mark-ii-systems.js').toString('utf8');
assert.equal(crypto.createHash('sha256').update(source).digest('hex'),'9608ad830255483c68682f69435c7faa5be2514c0ab38cdcff1c1379a87b281d','Use the original baseline systems for this baseline-only audit');
assert.equal(crypto.createHash('sha256').update(layoutBytes).digest('hex'),'73d760ef2d1100d4958e6708f73d8dba07fae0d0eba86509d91e896d58aa2c5a','Use the original baseline layout for this baseline-only audit');
const dataSource=(p,mime)=>`'data:${mime};base64,${baselineFile(p).toString('base64')}'`;
for(const [a,b]of Object.entries({"'three'":"'file:///tmp/star-agent-kestrel/node_modules/three/build/three.module.js'","'../assets/atlas-mark-ii/layout.json'":dataSource('assets/atlas-mark-ii/layout.json','application/json'),"'../assets/atlas-mark-ii/interior-colliders.json'":dataSource('assets/atlas-mark-ii/interior-colliders.json','application/json'),"'./boarding.js'":dataSource('src/boarding.js','text/javascript')}))source=source.replaceAll(a,b);
const {AtlasMarkIISystems}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const systems=new AtlasMarkIISystems().bind(scene),v=new THREE.Vector3();
function box(root,frame=null){const b=new THREE.Box3();let triangles=0,vertices=0;const inverse=frame?.matrixWorld.clone().invert();root.traverse(o=>{if(!o.isMesh)return;const m=inverse?inverse.clone().multiply(o.matrixWorld):o.matrixWorld,p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m);b.expandByPoint(v);vertices++;}triangles+=(o.geometry.index?.count??p.count)/3;});return {min:b.min.toArray(),max:b.max.toArray(),triangles,vertices};}
function union(a,b){if(!a)return structuredClone(b);for(let i=0;i<3;i++){a.min[i]=Math.min(a.min[i],b.min[i]);a.max[i]=Math.max(a.max[i],b.max[i]);}return a;}
function lowest(root){let found=null;root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){const world=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);if(!found||world.y<found.world[1])found={mesh:o.name,vertex:i,local:[p.getX(i),p.getY(i),p.getZ(i)],world:world.toArray()};}});return found;}
const groups=Object.fromEntries(['Interior','InteriorCargo','InteriorUpper','InteriorBridge','InteriorCrew','InteriorGalley','InteriorHygiene','PressureBridge','PortDrive','StarboardDrive','LoadingBow','AftEngineering'].map(name=>[name,box(scene.getObjectByName(name))]));
const ramps=[];
for(const ramp of systems.ramps){let swept;const poses=[];
 for(let i=0;i<=400;i++){const p=i/400;ramp.angle=THREE.MathUtils.lerp(ramp.closedAngle,ramp.openAngle,p);ramp.tipAngle=Math.PI*(1-p);systems.applyTransforms();const bounds=box(ramp.nodeObject);swept=union(swept,bounds);if(i%100===0)poses.push({progress:p,...bounds,lowestVertex:lowest(ramp.nodeObject)});}
 // World X is invariant under both X-axis hinge rotations. For Y/Z, the
 // maximum vertex radius from the main and toe pivots bounds speed per unit
 // progress. Half the 1/400 interval then conservatively covers missing time.
 ramp.angle=ramp.closedAngle;ramp.tipAngle=Math.PI;systems.applyTransforms();
 let maxMainRadius=0,maxTipRadius=0;const invMain=ramp.nodeObject.matrixWorld.clone().invert(),invTip=ramp.tipNodeObject.matrixWorld.clone().invert();
 ramp.nodeObject.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;let isTip=false;for(let a=o;a;a=a.parent)if(a===ramp.tipNodeObject)isTip=true;for(let i=0;i<p.count;i++){const world=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld),main=world.clone().applyMatrix4(invMain);maxMainRadius=Math.max(maxMainRadius,Math.hypot(main.y,main.z));if(isTip){const tip=world.clone().applyMatrix4(invTip);maxTipRadius=Math.max(maxTipRadius,Math.hypot(tip.y,tip.z));}}});
 // Include the whole 6 m main link plus toe radius even in the folded pose.
 maxMainRadius=Math.max(maxMainRadius,Math.hypot(ramp.hingeLength,ramp.tipHingeHeight)+maxTipRadius);
 const speedBound=Math.abs(ramp.openAngle-ramp.closedAngle)*maxMainRadius+Math.PI*maxTipRadius,margin=speedBound/800+1e-6;
 const conservative={min:swept.min.map((n,i)=>n-(i===0?0:margin)),max:swept.max.map((n,i)=>n+(i===0?0:margin))};
 ramps.push({name:ramp.node,pivot:ramp.pivot,poses,sampledUnion:swept,conservativeContinuousUnion:conservative,marginYZ:margin,maximumPointSpeedPerUnitProgressBound:speedBound,method:'401 exact transformed-vertex poses plus derivative-radius half-interval padding in Y/Z; X invariant'});
}
systems.applyTransforms();const lift={};
for(const y of [layout.elevator.low,layout.elevator.high]){systems.elevator.y=y;systems.applyTransforms();lift[y]=box(systems.elevator.nodeObject);}
const liftUnion=union(structuredClone(lift[layout.elevator.low]),lift[layout.elevator.high]);
const gates=[];for(const gate of systems.gates){let swept;for(const z of [-4,-2.25]){gate.z=z;systems.applyTransforms();swept=union(swept,box(gate.nodeObject));}gates.push({name:gate.node,translationOnlyUnion:swept});}
// Actual lane overhead, isolated to the baseline interior cargo group. This
// intentionally avoids exterior roof/upper-deck hits beyond the cargo ceiling.
const laneOverhead=[];const cargoRoot=scene.getObjectByName('InteriorCargo');
for(const [x,z]of [[0,0],[0,-3],[0,-20],[3.25,0],[3.52,0],[-3.52,0],[3.38,4],[3.9,0]]){
 const ray=new THREE.Raycaster(new THREE.Vector3(x,7,z),new THREE.Vector3(0,1,0),0,2);
 const hit=ray.intersectObject(cargoRoot,true).sort((a,b)=>a.distance-b.distance)[0];laneOverhead.push({x,z,firstUpwardHitY:hit?.point.y??null,mesh:hit?.object.name??null,declaredCeiling:8.8,intrusion:hit?8.8-hit.point.y:null});
}
const upperSlab=[9.28,9.5];
const protectedVolumes=[
 {id:'cargo-space',min:[-7.2,2.6,-24],max:[7.2,8.8,24],kind:'authoritative occupied/circulation volume'},
 {id:'vehicle-lane',min:[-4,2.6,-24],max:[4,8.8,24],kind:'full lane; existing floor/overhead defects require local closure'},
 {id:'cargo-pressure-bed',min:[-7.65,2.13,-24],max:[7.65,2.57,24],kind:'protected physical shell'},
 ...[-1,1].map(s=>({id:s<0?'port-pressure-wall':'starboard-pressure-wall',min:[s<0?-7.62:7.34,2.6,-24],max:[s<0?-7.34:7.62,8.84,24],kind:'protected physical shell'})),
 {id:'upper-rectangular-room-envelope',min:[-7.2,9.28,-17.8],max:[7.2,13.1,18],kind:'conservative occupied/ceiling envelope; exact bridge/room sections in layout/source'},
 {id:'crew-pressurized-room',min:[-7.2,9.5,.92],max:[-1.28,12.77,17.16],kind:'protected layout and enclosure'},
 {id:'galley-hygiene-pressurized-room',min:[1.28,9.5,.92],max:[7.2,12.77,17.16],kind:'protected layout and enclosure'},
 {id:'upper-central-aisle',min:[-1.3,9.5,-12],max:[1.3,12.75,18],kind:'protected continuous access route'},
 {id:'bridge-shell',...groups.PressureBridge,kind:'existing raked shell; use actual wedge, not this loose box when changing silhouette'},
 {id:'crew-lift-swept',...liftUnion,kind:'exact translation-only moving geometry'},
 ...gates.map(g=>({id:g.name,...g.translationOnlyUnion,kind:'exact gate translation sweep'})),
];
const proposedGear=[];
for(const s of [-1,1])for(const [station,z,direction]of [['fore',-21,1],['middle',3,1],['aft',19,-1]]){
 const x=s*9.6,root=[x,4.3,z],leg=3.95,pad={size:[2.7,.32,3.3],deployedCentre:[x,.16,z]},toeZ=z+direction*leg;
 const minZ=Math.min(z,toeZ)-1.65,maxZ=Math.max(z,toeZ)+1.65;
 const idealSweep={min:[x-1.35,0,minZ],max:[x+1.35,4.6,maxZ]};
 const pocket={min:[x-1.6,3.75,Math.min(z,toeZ)-.35-(direction<0?1.5:0)],max:[x+1.6,4.85,Math.max(z,toeZ)+.35+(direction>0?1.5:0)]};
 // This proposal is a dimensional allocation, not final mechanism geometry.
 assert.ok(idealSweep.min[0]>=-18&&idealSweep.max[0]<=18&&idealSweep.min[2]>=-32&&idealSweep.max[2]<=32);
 const sideGap=Math.min(Math.abs(idealSweep.min[0]),Math.abs(idealSweep.max[0]))-7.65;
 assert.ok(sideGap>.59);
 const doorRadius=Math.hypot(3.2,.06),doorOuter=s*11.2;
 const doorSweep={min:[s<0?doorOuter-.06:doorOuter-doorRadius,3.75-doorRadius,pocket.min[2]],max:[s<0?doorOuter+doorRadius:doorOuter+.06,3.81,pocket.max[2]]};
 proposedGear.push({id:(s<0?'port-':'starboard-')+station,pivot:root,foldAxis:'local X',foldToward:direction>0?'+Z / aft':'-Z / forward',rotationRadians:direction>0?-Math.PI/2:Math.PI/2,pad,shoeJointDeployed:[x,.35,z],shoeCounterRotation:'inverse root X rotation; preserve horizontal contact pad',stowedPadCentre:[x,4.11,toeZ],idealMechanismSweptReservation:idealSweep,proposedStowagePocket:pocket,minimumGapToPressureBedAndWalls:sideGap,proposedBayDoor:{hinge:[doorOuter,3.75,(pocket.min[2]+pocket.max[2])/2],axis:'local Z',openRotationRadians:s*Math.PI/2,width:3.2,thickness:.12,length:pocket.max[2]-pocket.min[2],conservativeDoorOnlySweep:doorSweep,sequence:'open door fully, then deploy leg; fully stow leg, then close door',status:'ideal rectangular leaf only; hinges/latches/actual skin are not yet measured'},status:'proposed construction envelope only; not an implemented or collision-certified rig'});
}
const sources=['assets/atlas-mark-ii/layout.json','assets/atlas-mark-ii/build_atlas.py','assets/atlas-mark-ii/drive_pods.py','assets/atlas-mark-ii/armour_forms.py','assets/atlas-mark-ii/bridge_shell.py','assets/atlas-mark-ii/interior.py','assets/atlas-mark-ii/upper_deck.py','src/atlas-mark-ii-systems.js'];
const sourceHashes=Object.fromEntries(sources.map(p=>[p,crypto.createHash('sha256').update(baselineFile(p)).digest('hex')]));
const report={scope:'Independent CPU constraints audit of unchanged baseline GLB; no production edits, fresh GPU captures, new silhouette score or final rig-clearance approval.',baselineCommit,assetPath,sha256,sourceHashes,groups,protectedVolumes,ramps,lift:{poses:lift,translationOnlyUnion:liftUnion,upperSlabY:upperSlab,apertureXZ:{min:[4.1,-5.8],max:[6.9,-2.2]},gates},laneOverhead,proposedGear,limits:['Gear pockets intentionally replace parts of the existing exterior fairing; they are not empty bays already present in the baseline. Exact final strut/actuator/door sweeps must be checked after construction.','The production working asset changed during the audit. This reproducible script reads the original asset and systems from Git 7b97f5a, asserts their identity, and does not assess the new candidate.','Using installed Three.js from the Kestrel worktree; no Atlas dependencies or source were installed/changed.']};
await fs.writeFile(path.join(OUT,'measurements.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sha256,output:path.join(OUT,'measurements.json'),rampCount:ramps.length,laneRayCount:laneOverhead.length,proposedGearCount:proposedGear.length}));
