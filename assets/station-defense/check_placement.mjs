import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const ROOT=path.resolve(process.env.BASTION_PLACEMENT_ROOT||fileURLToPath(new URL('../..',import.meta.url)));
const OUT=path.resolve(process.env.BASTION_PLACEMENT_OUT||'/tmp/star-agent-bastion-placement-08');
const mod=relative=>import(pathToFileURL(path.join(ROOT,relative)).href);
const THREE=await mod('node_modules/three/build/three.module.js');
const {GLTFLoader}=await mod('node_modules/three/examples/jsm/loaders/GLTFLoader.js');
const {createAuthoredExterior}=await mod('src/station-exterior.js');
const {createExterior,createHub,POD_LAYOUT}=await mod('src/station-architecture.js');
const {STATION_DEFENSE_MOUNTS}=await mod('src/station-security-policy.js');
const {buildStationColliders}=await mod('src/station-collision.js');
const {assetCollisionBoxes}=await mod('src/station-concourse.js');
const {fleetHangarAsset,FLEET_HANGAR}=await mod('src/station-fleet-hangar.js');
const {createPressureElevator,attachPressureElevator}=await mod('src/station-elevator.js');
const {updateElevator}=await mod('src/station-architecture.js');
const {createStationShopProps}=await mod('src/station-shop-props.js');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const identities={};
async function readCommit(){
  const entry=path.join(ROOT,'.git'),stat=await fs.stat(entry);
  const gitdir=stat.isDirectory()?entry:path.resolve(ROOT,(await fs.readFile(entry,'utf8')).trim().replace(/^gitdir: /,''));
  const head=(await fs.readFile(path.join(gitdir,'HEAD'),'utf8')).trim();if(!head.startsWith('ref: '))return head;
  const ref=head.slice(5);let common=gitdir;
  try{common=path.resolve(gitdir,(await fs.readFile(path.join(gitdir,'commondir'),'utf8')).trim());}catch{}
  for(const base of [gitdir,common])try{return (await fs.readFile(path.join(base,ref),'utf8')).trim();}catch{}
  const packed=await fs.readFile(path.join(common,'packed-refs'),'utf8');return packed.split('\n').find(line=>line.endsWith(' '+ref))?.split(' ')[0]??null;
}
async function load(name){
  const relative=`public/models/${name}.glb`,raw=await fs.readFile(path.join(ROOT,relative));
  identities[relative]={sha256:hash(raw),bytes:raw.length};
  const loader=new GLTFLoader();
  loader.register(parser=>{parser.loadTextureImage=async index=>{
    const texture=new THREE.Texture();parser.associations.set(texture,{textures:index});return texture;
  };return {name:'ReadOnlyPlacementGeometry'};});
  const asset=await loader.parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
  asset.scene.updateMatrixWorld(true);return asset;
}
const [defenseAsset,exteriorAsset,sourceBay,propsAsset,concourseAsset,elevatorAsset,counterAsset]=await Promise.all(
  ['station-defense','station-exterior','station','station-props','station-concourse','station-elevator','props/kestrel-maintenance-roll'].map(load));
const bayAsset=fleetHangarAsset(sourceBay);
bayAsset.scene.updateMatrixWorld(true);
if(identities['public/models/station-defense.glb'].sha256!=='8d0dcbb6395479ad083cd609217833b97c74008acdd15b72ed9182ced46b64ae')throw Error('Frozen candidate08 identity changed');
if(identities['public/models/station-exterior.glb'].sha256!=='5b39b183030d529a710de0b2dad308a36a8e597b067d3061d82f01bb721b76e6')throw Error('Checked authored exterior identity changed');
for(const relative of ['src/station-security-policy.js','src/station-security.js','src/station-complex.js','src/station-collision.js',
  'src/station-exterior.js','src/station-architecture.js','src/station-concourse.js','src/station-fleet-hangar.js','src/station-elevator.js',
  'src/station-shop-props.js','src/station-shopkeeper.js','src/atlas-gameplay.js','src/main.js','server/world.js','assets/station-defense/layout.json',
  'assets/station-defense/check_placement.mjs']){
  const bytes=await fs.readFile(path.join(ROOT,relative));identities[relative]={sha256:hash(bytes),bytes:bytes.length};
}
function collect(root){
  root.updateMatrixWorld(true);const rows=[],p=new THREE.Vector3(),m=new THREE.Matrix4(),instance=new THREE.Matrix4();
  root.traverse(mesh=>{if(!mesh.isMesh)return;
    const pos=mesh.geometry.attributes.position,index=mesh.geometry.index,count=index?.count??pos.count;
    for(let n=0;n<(mesh.isInstancedMesh?mesh.count:1);n++){
      m.copy(mesh.matrixWorld);if(mesh.isInstancedMesh){mesh.getMatrixAt(n,instance);m.multiply(instance);}
      for(let i=0;i<count;i+=3){const tri=[];
        for(let j=0;j<3;j++)tri.push(p.fromBufferAttribute(pos,index?index.getX(i+j):i+j).applyMatrix4(m).toArray());
        rows.push({mesh:mesh.name,triangle:i/3,instance:n,tri,collider:!/Door|Markings|Number|Sign_|Lights|Detail/.test(mesh.name)});
      }
    }
  });return rows;
}
function bounds(rows){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const row of rows)for(const p of row.tri)for(let i=0;i<3;i++){min[i]=Math.min(min[i],p[i]);max[i]=Math.max(max[i],p[i]);}
  return {min,max};
}
function unionBounds(...boxes){return {min:[0,1,2].map(i=>Math.min(...boxes.map(b=>b.min[i]))),max:[0,1,2].map(i=>Math.max(...boxes.map(b=>b.max[i])))};}
// Both authored door tracks are piecewise-linear translation. Their complete
// keyframe bounds enclose every intermediate pose, not just sampled open/closed.
const doorMotion={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]},doorTracks=[];
const clip=THREE.AnimationClip.findByName(bayAsset.animations,'DoorsOpen');
if(clip?.tracks.length!==2)throw Error('Expected the two authored hangar door tracks');
for(const track of clip.tracks){
  if(!/^HangarDoor_[LR]\.position$/.test(track.name)||track.getInterpolation()!==THREE.InterpolateLinear||track.getValueSize()!==3)throw Error('Door motion is not bounded linear translation');
  const node=bayAsset.scene.getObjectByName(track.name.split('.')[0]),original=node.position.clone();
  const all=new THREE.Box3();all.union(new THREE.Box3().setFromObject(node));
  for(let i=0;i<track.times.length;i++){
    node.position.fromArray(track.values,i*3);bayAsset.scene.updateMatrixWorld(true);all.union(new THREE.Box3().setFromObject(node));
  }
  node.position.copy(original);bayAsset.scene.updateMatrixWorld(true);
  const box={min:all.min.toArray(),max:all.max.toArray()};Object.assign(doorMotion,unionBounds(doorMotion,box));
  doorTracks.push({name:track.name,keyframes:track.times.length,bounds:box});
}
function passengerBounds(z){
  const parent=new THREE.Group(),lift=createPressureElevator(parent,z,-8);
  attachPressureElevator(lift,elevatorAsset,{sign(){}});
  const all=new THREE.Box3();
  for(const progress of [0,1]){lift.progress=progress;updateElevator(lift,0);parent.updateMatrixWorld(true);all.union(new THREE.Box3().setFromObject(parent));}
  return {min:all.min.toArray(),max:all.max.toArray()};
}
const berthPassengerBounds=passengerBounds(22.3),hubPassengerBounds=passengerBounds(14.3);
const counterProps=collect(createStationShopProps({scenes:{'kestrel-maintenance-roll':counterAsset.scene},status:{'kestrel-maintenance-roll':'ready'}}));
const exterior=createAuthoredExterior(exteriorAsset,null),rings=exterior.rings;
for(const ring of rings)ring.removeFromParent();
const fixed=collect(exterior.group),legacy=createExterior();for(const ring of legacy.rings)ring.removeFromParent();
const legacyFixed=collect(legacy.group),hub=collect(createHub().group),concourse=collect(concourseAsset.scene);
const bay=collect(bayAsset.scene),props=collect(propsAsset.scene),elevator=collect(elevatorAsset.scene),defense=collect(defenseAsset.scene);
const R=29.6,H=38.1,EPS=1e-5;
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function area(poly){let a=0;for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length];a+=p[0]*q[1]-q[0]*p[1];}return Math.abs(a)*.5;}
function signedArea(poly){let a=0;for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length];a+=p[0]*q[1]-q[0]*p[1];}return a*.5;}
function clipY(poly,y,positive){const out=[];for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],fa=positive?a[1]-y:y-a[1],fb=positive?b[1]-y:y-b[1];
  if(fa>=0)out.push(a);if((fa>=0)!==(fb>=0)){const t=fa/(fa-fb);out.push(a.map((v,k)=>v+t*(b[k]-v)));}
}return out;}
function clip2D(poly,tri){let out=poly.slice(),sign=Math.sign(signedArea(tri));if(!sign)return [];
  for(let j=0;j<tri.length&&out.length;j++){
    const p=tri[j],q=tri[(j+1)%tri.length],input=out;out=[];
    for(let i=0;i<input.length;i++){
      const a=input[i],b=input[(i+1)%input.length],fa=sign*cross(p,q,a),fb=sign*cross(p,q,b);
      if(fa>=-1e-9)out.push(a);if((fa>=-1e-9)!==(fb>=-1e-9)){const t=fa/(fa-fb);out.push(a.map((v,k)=>v+t*(b[k]-v)));}
    }
  }return out;
}
function distance2D(poly){if(!poly.length)return Infinity;
  let distance=Infinity,positive=false,negative=false;
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
    const t=den?Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dy)/den)):0;
    distance=Math.min(distance,Math.hypot(a[0]+t*dx,a[1]+t*dy));
    const c=cross(a,b,[0,0]);positive||=c>1e-9;negative||=c< -1e-9;
  }
  if(poly.length>=3&&area(poly)>1e-12&&!(positive&&negative))return 0;return distance;
}
const predicateControls={
  identicalTriangleArea:Math.abs(area(clip2D([[0,0],[2,0],[0,2]],[[0,0],[2,0],[0,2]]))-2)<1e-12,
  disjointTriangles:area(clip2D([[0,0],[2,0],[0,2]],[[3,3],[4,3],[3,4]]))===0,
  crossingTrianglesWithoutContainedCorners:area(clip2D([[-2,-1],[2,-1],[0,2]],[[-2,1],[2,1],[0,-2]]))>0,
  insideRadiusProjection:distance2D([[-1,-1],[1,-1],[0,1]])===0,
  outsideRadiusProjection:Math.abs(distance2D([[2,-1],[3,-1],[3,1],[2,1]])-2)<1e-12,
  entirelyBelowClip:clipY([[0,-2,0],[1,-2,0],[0,-1,1]],0,true).length===0,
};
if(!Object.values(predicateControls).every(Boolean))throw Error('Placement predicate control failed');
function mountPoint(p,mount){const v=new THREE.Vector3(...p).sub(new THREE.Vector3(...mount.position));
  return v.applyQuaternion(new THREE.Quaternion(...mount.rotation).invert()).toArray();}
const floor=defense.filter(r=>r.tri.every(p=>Math.abs(p[1])<EPS)).map(r=>({mesh:r.mesh,triangle:r.triangle,poly:r.tri.map(p=>[p[0],p[2]])}));
const floorArea=floor.reduce((sum,r)=>sum+area(r.poly),0);
if(!floor.length||floor.some(r=>!r.mesh.startsWith('Bastion_Base')))throw Error('Contact exemption is not exclusively the fixed foundation');
let minimumNonFoundationY=Infinity,minimumNonFoundationWitness=null;
for(const row of defense){
  if(row.mesh.startsWith('Bastion_Base'))continue;
  const object=defenseAsset.scene.getObjectByName(row.mesh);let pitched=false,recoils=false;
  for(let node=object;node;node=node.parent){pitched||=node.name==='Bastion_Pitch';recoils||=node.name.startsWith('Bastion_Recoil_');}
  for(const vertex of row.tri)for(const recoil of recoils?[0,.6]:[0]){
    const a=vertex[1]-9,b=-(vertex[2]+recoil),angles=pitched?[-.2,Math.PI/2]:[0];
    if(pitched)for(let k=-2;k<=2;k++){const t=Math.atan2(b,a)+k*Math.PI;if(t>=-.2&&t<=Math.PI/2)angles.push(t);}
    for(const pitch of angles){const y=pitched?9+a*Math.cos(pitch)+b*Math.sin(pitch):vertex[1];
      if(y<minimumNonFoundationY){minimumNonFoundationY=y;minimumNonFoundationWitness={mesh:row.mesh,vertex,pitch,recoil};}}
  }
}
function inspectStation(rows,mount){
  let minRadial=Infinity,nearest=null,minColliderRadial=Infinity,colliderNearest=null;const potential=[],contact=[];
  for(const row of rows){const local=row.tri.map(p=>mountPoint(p,mount));
    const lo=Math.min(...local.map(p=>p[1])),hi=Math.max(...local.map(p=>p[1]));
    if(hi>EPS&&lo<H){
      const poly=clipY(clipY(local,EPS,true),H,false),distance=distance2D(poly.map(p=>[p[0],p[2]]));
      if(distance<minRadial){minRadial=distance;nearest={mesh:row.mesh,triangle:row.triangle,tri:row.tri};}
      if(distance<=R+EPS)potential.push({mesh:row.mesh,triangle:row.triangle,radialDistance:distance,localTriangle:local});
      if(row.collider){const xs=local.map(p=>p[0]),zs=local.map(p=>p[2]),x=Math.max(Math.min(...xs),Math.min(0,Math.max(...xs))),z=Math.max(Math.min(...zs),Math.min(0,Math.max(...zs)));
        const d=Math.hypot(x,z);if(d<minColliderRadial){minColliderRadial=d;colliderNearest={mesh:row.mesh,triangle:row.triangle};}}
    }
    if(local.every(p=>Math.abs(p[1])<=EPS)){
      const poly=local.map(p=>[p[0],p[2]]);let supportArea=0;
      for(const f of floor)supportArea+=area(clip2D(f.poly,poly));
      if(supportArea>1e-8)contact.push({mesh:row.mesh,triangle:row.triangle,supportArea,poly});
    }
  }
  const covered=floor.map(f=>({triangle:f.triangle,area:area(f.poly),coveredArea:contact.reduce((s,r)=>s+area(clip2D(f.poly,r.poly)),0)}));
  let maximumContactTriangleOverlapArea=0;
  for(let i=0;i<contact.length;i++)for(let j=i+1;j<contact.length;j++)maximumContactTriangleOverlapArea=Math.max(maximumContactTriangleOverlapArea,area(clip2D(contact[i].poly,contact[j].poly)));
  return {triangles:rows.length,colliderTriangles:rows.filter(r=>r.collider).length,
    openCylinderPotentialTriangleCount:potential.length,potentialTriangles:potential.slice(0,12),
    minRadialAboveMountPlane:Number.isFinite(minRadial)?minRadial:null,radialSeparationFromKeepout:Number.isFinite(minRadial)?minRadial-R:null,nearest,
    colliderAabbMinRadialAboveMountPlane:Number.isFinite(minColliderRadial)?minColliderRadial:null,colliderAabbSeparation:Number.isFinite(minColliderRadial)?minColliderRadial-R:null,colliderNearest,
    foundationContact:{baseBottomTriangles:floor.length,baseBottomArea:floorArea,stationCoplanarContactTriangles:contact.map(({poly,...r})=>r),covered,
      maximumContactTriangleOverlapArea,
      everyBaseTriangleAreaCovered:maximumContactTriangleOverlapArea<1e-6&&covered.every(r=>Math.abs(r.coveredArea-r.area)<1e-4)}};
}
// Runtime uses one conservative AABB per non-excluded triangle. Count the actual
// collider output as a guard against silently auditing a different inclusion rule.
const fixedTree=buildStationColliders(exterior.group);
function countTree(n){return n.boxes?n.boxes.length:countTree(n.left)+countTree(n.right);}
if(countTree(fixedTree)!==fixed.filter(r=>r.collider).length)throw Error('Runtime collider inclusion mismatch');
const rawBayBounds=unionBounds(bounds([...bay,...props]),doorMotion,berthPassengerBounds);
const hubBounds=unionBounds(bounds([...hub,...concourse,...counterProps]),hubPassengerBounds),elevatorBounds=bounds(elevator);
const p=new THREE.Vector3();
function transformedBounds(b,matrix){const out=new THREE.Box3();for(let i=0;i<8;i++)out.expandByPoint(p.set(...[0,1,2].map(k=>b[(i&(1<<k))?'max':'min'][k])).applyMatrix4(matrix));return {min:out.min.toArray(),max:out.max.toArray()};}
function boxDistance(a,b){return Math.hypot(...[0,1,2].map(i=>Math.max(0,a.min[i]-b.max[i],b.min[i]-a.max[i])));}
const deck=bounds(collect(bayAsset.scene.getObjectByName('LandingDeck'))),door=bounds(collect(bayAsset.scene.getObjectByName('HangarDoor_L')));
if(Math.abs(deck.max[1]-FLEET_HANGAR.deckMin[1])>EPS||Math.abs(deck.min[2]-FLEET_HANGAR.deckMin[2])>EPS||Math.abs(deck.max[2]-FLEET_HANGAR.deckMax[2])>EPS)throw Error('Audited bay does not match the playable fleet deck');
const approach=bayAsset.scene.getObjectByName('ApproachPoint').getWorldPosition(new THREE.Vector3()).toArray();
const podBounds=POD_LAYOUT.map(spec=>{
  const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...spec.offset),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),spec.yaw),new THREE.Vector3(1,1,1));
  return {...spec,bounds:transformedBounds(rawBayBounds,matrix),approachPoint:new THREE.Vector3(...approach).applyMatrix4(matrix).toArray(),
    corridor:transformedBounds({min:[deck.min[0],deck.max[1],-1000000],max:[deck.max[0],door.max[1],deck.min[2]]},matrix)};
});
const ringBounds=rings.map(ring=>{ring.updateMatrixWorld(true);const b=bounds(collect(ring));
  return {center:ring.position.toArray(),xInterval:[b.min[0],b.max[0]],note:'X interval is invariant under every runtime ring rotation about local X'};});
const mounts=STATION_DEFENSE_MOUNTS.map(mount=>{
  const local={min:[-R,0,-R],max:[R,H,R]},matrix=new THREE.Matrix4().compose(new THREE.Vector3(...mount.position),new THREE.Quaternion(...mount.rotation),new THREE.Vector3(1,1,1));
  const keepoutBounds=transformedBounds(local,matrix);
  const authoredFixed=inspectStation(fixed,mount),potential=authoredFixed.potentialTriangles;
  const alreadyAligned=authoredFixed.openCylinderPotentialTriangleCount===0&&authoredFixed.foundationContact.everyBaseTriangleAreaCovered;
  if(!alreadyAligned&&(authoredFixed.openCylinderPotentialTriangleCount!==2||potential.length!==2))throw Error('Expected exactly two measured support-plane triangles; inspect before changing probe');
  const supportPlaneLocalY=alreadyAligned?0:potential[0].localTriangle[0][1];
  if(!alreadyAligned&&(!(supportPlaneLocalY>0&&supportPlaneLocalY<.01)||!potential.every(r=>r.localTriangle.every(v=>Math.abs(v[1]-supportPlaneLocalY)<1e-8))))throw Error('Candidate contact is not a single narrowly measured plane');
  const adjusted={...mount,position:new THREE.Vector3(...mount.position).add(new THREE.Vector3(0,supportPlaneLocalY,0).applyQuaternion(new THREE.Quaternion(...mount.rotation))).toArray()};
  const aligned=inspectStation(fixed,adjusted);
  return {...mount,matrix:matrix.toArray(),keepoutBounds,
    authoredFixed,legacyFallback:inspectStation(legacyFixed,mount),
    recommendedPlaneAlignedMount:adjusted,planeAlignedInspection:aligned,
    nominalFoundationEmbeddingMetres:supportPlaneLocalY,
    nominalMovingPartClearanceAboveMeasuredSupport:minimumNonFoundationY-supportPlaneLocalY,
    hubSeparation:boxDistance(keepoutBounds,hubBounds),
    ringAxialSeparation:ringBounds.map(b=>Math.max(0,keepoutBounds.min[0]-b.xInterval[1],b.xInterval[0]-keepoutBounds.max[0])),
    berthSeparation:podBounds.map(b=>({id:b.id,visibleBoundsSeparation:boxDistance(keepoutBounds,b.bounds),outwardMouthCorridorSeparation:boxDistance(keepoutBounds,b.corridor)}))};
});
const firingRays=[];
for(const mount of STATION_DEFENSE_MOUNTS.slice(0,2))for(const pose of [{yaw:0,pitch:-.2},{yaw:0,pitch:0},{yaw:Math.PI/2,pitch:0}]){
  const rig=defenseAsset.scene.clone(true);rig.position.fromArray(mount.position);rig.quaternion.fromArray(mount.rotation);
  rig.getObjectByName('Bastion_Yaw').rotation.set(0,pose.yaw,0);rig.getObjectByName('Bastion_Pitch').rotation.set(pose.pitch,0,0);rig.updateMatrixWorld(true);
  for(const side of ['Port','Starboard']){
    const node=rig.getObjectByName('Bastion_Muzzle_'+side),origin=node.getWorldPosition(new THREE.Vector3());
    const direction=new THREE.Vector3(0,0,-1).transformDirection(node.matrixWorld),ray=new THREE.Ray(origin,direction);let nearest=null;
    const hit=new THREE.Vector3(),vertices=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
    for(const row of fixed){const result=ray.intersectTriangle(...row.tri.map((v,i)=>vertices[i].fromArray(v)),false,hit);
      if(result){const distance=origin.distanceTo(hit);if(distance<2000&&(!nearest||distance<nearest.distance))nearest={mesh:row.mesh,triangle:row.triangle,distance,point:hit.toArray(),collider:row.collider};}}
    firingRays.push({mount:mount.id,...pose,side,origin:origin.toArray(),direction:direction.toArray(),range:2000,nearestFixedTriangle:nearest});
  }
}
const report={role:'Bastion author-side read-only CPU station-placement audit; not independent visual approval',root:ROOT,
  sourceCommit:await readCommit(),identities,
  method:'Actual GLB triangles transformed with native Three GLTFLoader; shared runtime exterior assembly and mount constants. Textures replaced by inert placeholders only in memory. Each station triangle is clipped to the open conservative full-motion cylinder height, then its exact convex XZ projection is tested against radius 29.6. Actual runtime collider triangle-AABB inclusion/count is cross-checked separately. Only the fixed foundation bottom at local Y0 is treated as intended station contact, with area coverage by actual coplanar station triangles. No other contact exemption.',
  envelope:{radius:R,minY:0,maxY:H,pitch:[-.2,Math.PI/2],recoil:[0,.6],yaw:'all',minimumNonFoundationY,minimumNonFoundationWitness,
    provenance:'candidate08 check_additive_delta.py analytic extrema of all19001 actual vertices, pitch endpoints/stationary points and recoil endpoints; maxR29.574313216244338, Y0..38.04410439446006; cylinder overapproximates occupied space'},
  counts:{defenseTriangles:defense.length,fixedVisualTriangles:fixed.length,fixedRuntimeColliderTriangles:countTree(fixedTree),
    hubAndConcourseTriangles:hub.length+concourse.length,shippedCounterPropTriangles:counterProps.length,bayAndPropsTriangles:bay.length+props.length,elevatorTriangles:elevator.length},
  fleetHangar:FLEET_HANGAR,doorMotion:{bounds:doorMotion,tracks:doorTracks,coverage:'Every linear position keyframe; convex union encloses the complete continuous translation'},
  bounds:{rawBayWithProps:rawBayBounds,hubWithConcourse:hubBounds,elevator:elevatorBounds,berthPassenger:berthPassengerBounds,hubPassenger:hubPassengerBounds,landingDeck:deck,doorLeft:door},
  mountPlaneToleranceMetres:EPS,predicateControls,foundation:floor.map(({poly,...r})=>({...r,area:area(poly)})),ringBounds,podBounds,mounts,firingRays,
  limitations:['No GPU, material, native-image, animation-quality, FPS or independent acceptance claim',
    'The all-motion cylinder may flag false positives; an empty result certifies separation for geometry inside that bound, within numerical tolerance',
    'Foundation support uses actual projected triangle clipping with a separate pairwise overlap-area guard; no station surface is excluded outside the measured support plane',
    'All phases of ring rotation are covered only by invariant axial separation; no ring-pose sampling was needed',
    'All 20 enlarged bay shell, unscaled prop, full hangar-door translation and passenger cabin/door bounds and outward mouth corridors were compared. The corridor is a measured mouth cross-section extended outward, not a guarantee for arbitrary ship trajectories or approach yaw',
    'Passenger leaves translate linearly between measured endpoints. Small shipped counter dressing is included; shopkeeper skeletal animation, signs, arbitrary user objects and ship movement are not certified by this station assembly audit',
    'Twelve diagnostic muzzle rays use exact authored fixed triangles at three poses per upper/lower mount on one spine. This does not cover all targets, all station assemblies, selection or authoritative strike policy',
    'Legacy fallback is deliberately audited separately and must not inherit authored-exterior support claims']};
report.pass=mounts.every(m=>m.authoredFixed.openCylinderPotentialTriangleCount===0&&m.authoredFixed.foundationContact.everyBaseTriangleAreaCovered&&
  m.authoredFixed.radialSeparationFromKeepout>0&&m.authoredFixed.colliderAabbSeparation>0&&m.hubSeparation>0&&
  m.ringAxialSeparation.every(gap=>gap>0)&&m.berthSeparation.every(b=>b.visibleBoundsSeparation>0&&b.outwardMouthCorridorSeparation>0));
await fs.mkdir(OUT,{recursive:true});await fs.writeFile(path.join(OUT,'audit.json'),JSON.stringify(report,null,2)+'\n');
if(!report.pass)throw Error('Actual refit station fails Bastion placement; inspect audit.json before changing geometry');
console.log(JSON.stringify({asset:identities['public/models/station-defense.glb'],counts:report.counts,mounts:mounts.map(m=>({id:m.id,
  authoredPotential:m.authoredFixed.openCylinderPotentialTriangleCount,authoredRadialGap:m.authoredFixed.radialSeparationFromKeepout,
  colliderGap:m.authoredFixed.colliderAabbSeparation,support:m.authoredFixed.foundationContact.everyBaseTriangleAreaCovered,
  proposedPosition:m.recommendedPlaneAlignedMount.position,alignedPotential:m.planeAlignedInspection.openCylinderPotentialTriangleCount,
  alignedSupport:m.planeAlignedInspection.foundationContact.everyBaseTriangleAreaCovered,alignedRadialGap:m.planeAlignedInspection.radialSeparationFromKeepout,
  alignedColliderGap:m.planeAlignedInspection.colliderAabbSeparation,nominalMovingClearance:m.nominalMovingPartClearanceAboveMeasuredSupport,
  legacyPotential:m.legacyFallback.openCylinderPotentialTriangleCount,legacySupport:m.legacyFallback.foundationContact.everyBaseTriangleAreaCovered,
  hubGap:m.hubSeparation,ringGap:Math.min(...m.ringAxialSeparation),bayGap:Math.min(...m.berthSeparation.map(b=>b.visibleBoundsSeparation)),
  approachGap:Math.min(...m.berthSeparation.map(b=>b.outwardMouthCorridorSeparation))}))},null,2));
