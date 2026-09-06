import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { StationComplex } from '../src/station-complex.js';
import { RING_RADIUS, RING_SPEED } from '../src/station-architecture.js';
import { SHIP_LAYOUT } from '../src/boarding.js';

async function create(){
  const load=async name=>{const bytes=await readFile(new URL(`../public/models/${name}.glb`,import.meta.url));return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');};
  const station=new StationComplex(new THREE.Scene(),{gltf:await load('station'),lod:await load('station_lod1')});await station.readyPromise;return station;
}
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
