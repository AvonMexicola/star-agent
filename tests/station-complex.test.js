import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { StationComplex } from '../src/station-complex.js';
import { createExterior, RING_RADIUS, RING_SPEED } from '../src/station-architecture.js';
import { SHIP_LAYOUT } from '../src/boarding.js';

async function create(decorateLod=()=>{}){
  const load=async name=>{const bytes=await readFile(new URL(`../public/models/${name}.glb`,import.meta.url));return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');};
  const [gltf,lod]=await Promise.all([load('station'),load('station_lod1')]);decorateLod(lod.scene);
  const station=new StationComplex(new THREE.Scene(),{gltf,lod});await station.readyPromise;return station;
}
test('ring paint sections retain the exterior footprint and instanced draw budget',()=>{
  const {group,rings}=createExterior();let meshes=0,triangles=0;
  group.traverse(mesh=>{
    if(!mesh.isMesh)return;meshes++;
    triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3*(mesh.isInstancedMesh?mesh.count:1);
  });
  assert.equal(meshes,93,'paint variation adds no render batches');
  assert.equal(triangles,22116,'the existing exterior geometry stays intact');
  const footprints=[{min:[-1150,-1476,-1476],max:[-1068.5,1476,1476]},{min:[1068.5,-1476,-1476],max:[1150,1476,1476]}];
  for(const [i,ring] of rings.entries()){
    const bounds=new THREE.Box3().setFromObject(ring);
    assert.deepEqual(bounds.min.toArray(),footprints[i].min);assert.deepEqual(bounds.max.toArray(),footprints[i].max);
    const panels=ring.children.find(mesh=>mesh.isInstancedMesh&&mesh.instanceColor);
    assert.equal(panels.count,120,'all collidable habitat panels remain instanced');
    const values=new Set(),matrix=new THREE.Matrix4(),position=new THREE.Vector3();
    for(let k=0;k<panels.count;k++){
      panels.getMatrixAt(k,matrix);position.setFromMatrixPosition(matrix);
      const angle=k*Math.PI*2/120;
      assert.ok(position.distanceTo(new THREE.Vector3(0,Math.cos(angle)*RING_RADIUS,Math.sin(angle)*RING_RADIUS))<.0001,'paint does not move the collision surface');
      values.add(panels.instanceColor.getX(k));
    }
    assert.ok(values.size>1,'section value variation is encoded without splitting the panel mesh');
    assert.equal(panels.material.emissive.getHex(),0,'habitat paint remains lit by the scene');
    if(i)assert.equal(panels.material,rings[0].children.find(mesh=>mesh.isInstancedMesh&&mesh.instanceColor).material,'both rings reuse the same finish');
  }
});
test('ring fill reuses the scene environment with independent intensity and planet-up orientation',()=>{
  const {rings}=createExterior(),scene=new THREE.Scene(),environment=new THREE.Texture();
  scene.environment=environment;scene.environmentIntensity=.04;scene.environmentRotation.set(.2,.6,.1);
  const panels=rings[0].children.find(mesh=>mesh.isInstancedMesh&&mesh.instanceColor),material=panels.material;
  panels.onBeforeRender(null,scene,null,panels.geometry,material);
  assert.equal(material.envMap,environment,'explicit reuse prevents Three from overriding the ring fill with the space-wide intensity');
  assert.ok(material.envMapIntensity>scene.environmentIntensity);
  assert.deepEqual(material.envMapRotation.toArray(),scene.environmentRotation.toArray());
  assert.equal(material.emissive.getHex(),0);
  const version=material.version;
  scene.environmentRotation.set(.7,.4,.2);
  panels.onBeforeRender(null,scene,null,panels.geometry,material);
  assert.equal(material.version,version,'the existing shared map does not trigger recompilation every frame');
  assert.deepEqual(material.envMapRotation.toArray(),scene.environmentRotation.toArray());
  assert.equal(scene.environmentIntensity,.04,'global space lighting stays unchanged');
  scene.environment=null;panels.onBeforeRender(null,scene,null,panels.geometry,material);
  assert.equal(material.envMap,null,'removing the environment releases the material reference');
  environment.dispose();
});
test('twenty transformed berths share geometry and collision while keeping independent doors',async()=>{
  const s=await create();assert.equal(s.pods.length,20);
  const centres=new Set(s.pods.map(p=>p.worldPosition.toArray().join(',')));assert.equal(centres.size,20);
  for(const pod of s.pods){
    assert.equal(pod.colliders,s.pods[0].colliders);
    assert.equal(pod.deck.geometry,s.pods[0].deck.geometry);
    const local=new THREE.Vector3(12.2,-6.25,20.7),world=pod.toWorld(local,new THREE.Vector3());
    assert.ok(pod.toLocal(world,new THREE.Vector3()).distanceTo(local)<1e-8);
    assert.ok(pod.canDock(pod.toWorld(new THREE.Vector3(0,-3,2),new THREE.Vector3())));
  }
  s.pods[0].openDoors();s.pods[0].doorMixer.update(6);assert.equal(s.pods[0].doorsOpen,1);assert.equal(s.pods[19].doorsOpen,0);
  s.update(s.pods[0].worldPosition,s.pods[0].worldPosition,new THREE.Vector3(1,0,0),10);
  assert.equal(s.pods.filter(p=>p.model.visible).length,1);
  assert.equal(s.exterior.rings[0].rotation.x,10*RING_SPEED);assert.equal(s.exterior.rings[1].rotation.x,-10*RING_SPEED);
  assert.equal(RING_RADIUS,1450);
  assert.ok(s.lodBatches.length<45,'twenty distant bays use fewer than 45 instanced geometry batches');
  const batch=s.lodBatches.find(b=>b.door===0),matrix=new THREE.Matrix4();
  // At a distant camera all berths use the instanced meshes; the first door retains its open pose.
  s.update(s.centre.clone().addScalar(5000),s.centre,new THREE.Vector3(1,0,0),0);
  batch.instances.getMatrixAt(0,matrix);
  const expected=batch.matrix.clone();expected.elements[12]+=s.pods[0].doors[0].position.x-batch.closedX;
  expected.premultiply(new THREE.Matrix4().compose(s.pods[0].offset,s.pods[0].yaw,new THREE.Vector3(1,1,1)));
  for(let i=0;i<16;i++)assert.ok(Math.abs(matrix.elements[i]-expected.elements[i])<.001);
  assert.ok(s.ringColliders[0].bounds.max.x>=40,'instanced habitat panels participate in collision');
  const other=s.pods[19],a=other.toWorld(new THREE.Vector3(-100,-3,0),new THREE.Vector3()),b=other.toWorld(new THREE.Vector3(0,-3,0),new THREE.Vector3());
  assert.equal(s.activeIndex,0);assert.equal(s.constrainStep(a,b,other.quaternion).hit,true,'a non-active berth still blocks flight');
});
test('clear walking aisles reach cargo and elevator; closed elevator blocks swept entry',async()=>{
  const s=await create(),q=s.quaternion,to=p=>s.toWorld(new THREE.Vector3(...p),new THREE.Vector3());
  for(const [a,b] of [[[12,-6.25,-16],[12,-6.25,19]],[[-12,-6.25,-16],[-12,-6.25,20]],[[-12,-6.25,20],[0,-6.25,20]]]){
    assert.equal(s.constrainStep(to(a),to(b),q,true).hit,false,`${a} -> ${b}`);
  }
  assert.equal(s.constrainStep(to([0,-6.25,20]),to([0,-6.25,24]),q,true).hit,true);
  s.lift.open=true;s.update(to([0,-6.25,20]),to([0,-6.25,20]),new THREE.Vector3(1,0,0),2);
  assert.equal(s.constrainStep(to([0,-6.25,20]),to([0,-6.25,24]),q,true).hit,false);
  const nav={mode:'walk',dockedAtStation:true,insideShip:false,layout:SHIP_LAYOUT,position:to([-12,-6.25,20])};
  assert.equal(s.interaction(nav).kind,'cargo');s.parkedPod=19;assert.equal(s.interaction(nav).kind,'unavailable');
  s.location='hub';s.lift.open=true;s.update(s.centre,s.centre,new THREE.Vector3(1,0,0),2);
  const hubA=to([0,-6.25,16]),hubB=to([0,-6.25,0]);
  assert.equal(s.constrainStep(hubA,hubB,s.quaternion,true).hit,false);
  assert.ok(s.deckPoint(hubB,1.75).distanceTo(hubB)<1e-8);
  assert.equal(s.constrainStep(to([20,-6.25,0]),to([25,-6.25,0]),s.quaternion,true).hit,true);
});
test('hero and LOD structural slabs stay below the visible deck',async()=>{
  const s=await create();
  for(const model of [s.active.model,s.active.lodModel]){
    model.updateMatrixWorld(true);
    for(const [x,z] of [[-6,0],[6,5],[12,16]]){
      const ray=new THREE.Raycaster(new THREE.Vector3(x,-6.25,z),new THREE.Vector3(0,-1,0),0,4);
      const hull=ray.intersectObject(model.getObjectByName('Hull'),true)[0];
      const deck=ray.intersectObject(model.getObjectByName('LandingDeck'),true)[0];
      assert.ok(hull&&deck,'ray intersects both surfaces');
      assert.ok(hull.distance-deck.distance>.39,'structural slab stays below the visible deck');
    }
  }
});

test('LOD material batching retains transformed triangles and attributes without changing sources or linking bay doors',async()=>{
  let source;const snapshots=new Map();
  const s=await create(root=>{
    source=root;
    const material=new THREE.MeshStandardMaterial({vertexColors:true});
    const geometry=new THREE.BoxGeometry(.4,.5,.6),colours=new Float32Array(geometry.attributes.position.count*3);
    for(let i=0;i<colours.length;i++)colours[i]=[1,.5,.25][i%3];
    geometry.setAttribute('color',new THREE.BufferAttribute(colours,3));
    const transformed=new THREE.Group();transformed.position.set(3,1,-4);transformed.rotation.set(.2,.4,.1);transformed.scale.set(1.2,.75,1.1);root.add(transformed);
    for(const x of [0,2]){const mesh=new THREE.Mesh(geometry,material);mesh.position.x=x;transformed.add(mesh);}
    // Same material, but incompatible colour storage and attribute sets must
    // remain separate batches. Compatible geometry beneath each door still
    // needs a separate moving batch from the static parts and opposite door.
    const bytes=geometry.clone();bytes.setAttribute('color',new THREE.Uint8BufferAttribute(Array.from(colours,v=>Math.round(v*255)),3,true));
    transformed.add(new THREE.Mesh(bytes,material));
    const plain=geometry.clone();plain.deleteAttribute('color');transformed.add(new THREE.Mesh(plain,material));
    transformed.add(new THREE.Mesh(geometry.toNonIndexed(),material));
    for(const name of ['HangarDoor_L','HangarDoor_R'])root.getObjectByName(name).add(new THREE.Mesh(geometry,material));
    root.traverse(mesh=>{if(!mesh.isMesh||snapshots.has(mesh.geometry))return;snapshots.set(mesh.geometry,{
      attributes:Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([name,a])=>[name,a.array.slice()])),
      index:mesh.geometry.index?.array.slice(),
    });});
  });
  source.updateMatrixWorld(true);
  const records=(geometry,matrix,door,material)=>{
    const transformed=geometry.clone().applyMatrix4(matrix),attributes=Object.entries(transformed.attributes).sort(([a],[b])=>a.localeCompare(b));
    const signature=attributes.map(([name,a])=>[name,a.itemSize,a.normalized,a.array.constructor.name,a.gpuType].join(':')).join('|');
    const vertices=Array.from({length:transformed.attributes.position.count},(_,i)=>attributes.flatMap(([,a])=>
      Array.from({length:a.itemSize},(_,component)=>Math.round(a.array[i*a.itemSize+component]*1e5))).join(','));
    const count=transformed.index?.count??vertices.length,out=[];
    for(let i=0;i<count;i+=3)out.push(`${door}/${material.uuid}/${signature}/`+[0,1,2].map(j=>vertices[transformed.index?transformed.index.getX(i+j):i+j]).join(';'));
    transformed.dispose();return out;
  };
  const before=[];
  source.traverse(mesh=>{
    if(!mesh.isMesh)return;let parent=mesh,door=-1;
    while(parent){if(parent.name==='HangarDoor_L')door=0;if(parent.name==='HangarDoor_R')door=1;parent=parent.parent;}
    before.push(...records(mesh.geometry,mesh.matrixWorld,door,mesh.material));
  });
  const after=s.lodBatches.flatMap(batch=>records(batch.instances.geometry,batch.matrix,batch.door,batch.instances.material));
  assert.deepEqual(after.sort(),before.sort(),'all rendered triangles retain material, door ownership, transformed position/normal, UV and colour data');
  assert.ok(s.lodBatches.some(batch=>batch.sourceCount>1),'compatible source meshes were actually merged');
  for(const [geometry,snapshot] of snapshots){
    for(const [name,values] of Object.entries(snapshot.attributes))assert.deepEqual(geometry.attributes[name].array,values,'source vertex attributes remain unchanged');
    assert.deepEqual(geometry.index?.array,snapshot.index,'source indices remain unchanged');
    assert.ok(s.lodBatches.every(batch=>batch.instances.geometry!==geometry),'merged geometry never replaces or mutates shared source geometry');
  }
  s.pods[0].beginOpening();s.pods[0].setOpeningProgress(.25);
  s.pods[19].beginOpening();s.pods[19].setOpeningProgress(.75);
  const camera=s.centre.clone().addScalar(5000);s.update(camera,camera,new THREE.Vector3(1,0,0),0);
  for(const batch of s.lodBatches){
    assert.equal(batch.instances.count,20);
    for(const index of [0,19]){
      const pod=s.pods[index],actual=new THREE.Matrix4();batch.instances.getMatrixAt(index,actual);
      const local=batch.matrix.clone();if(batch.door>=0)local.elements[12]+=pod.doors[batch.door].position.x-batch.closedX;
      const expected=new THREE.Matrix4().compose(pod.offset,pod.yaw,new THREE.Vector3(1,1,1)).multiply(local);
      for(let i=0;i<16;i++)assert.ok(Math.abs(actual.elements[i]-expected.elements[i])<.001,'each instance retains bay offset/yaw and its own left/right door pose');
    }
  }
});
