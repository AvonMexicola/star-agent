import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createShopkeeperAnimator,createStationShopkeeper,SHOPKEEPER_IDLES,SHOPKEEPER_PLACEMENT,STATION_SHOPKEEPERS} from '../src/station-shopkeeper.js';
import {constrainStationSweep} from '../src/station-collision.js';

function asset(idles=SHOPKEEPER_IDLES){
  const scene=new THREE.Group(),body=new THREE.Mesh(new THREE.BoxGeometry(.5,1.7,.5),new THREE.MeshStandardMaterial());
  body.name='Body';scene.add(body);
  const animations=idles.map((name,i)=>new THREE.AnimationClip(name,2,[new THREE.NumberKeyframeTrack('Body.position[x]',[0,1,2],[i*.03,i*.03+.01,i*.03])]));
  return {scene,animations,body};
}

test('idle selection blends all four actual actions without moving the placement root',()=>{
  const model=asset(),animation=createShopkeeperAnimator(model.scene,model.animations),seen=new Set();
  let last=model.body.position.x,maxStep=0;
  for(let i=0;i<600;i++){
    animation.update(1/60);seen.add(animation.state.currentClip);
    maxStep=Math.max(maxStep,Math.abs(model.body.position.x-last));last=model.body.position.x;
  }
  assert.deepEqual([...seen].sort(),[...SHOPKEEPER_IDLES].sort());assert.ok(animation.state.transitions>=4);
  assert.ok(maxStep<.005,'different idle poses blend instead of snapping');assert.deepEqual(model.scene.position.toArray(),[0,0,0]);
  const before=animation.state;animation.update(NaN);animation.update(-1);animation.update(0);assert.deepEqual(animation.state,before);
  animation.update(10);assert.ok(animation.state.time-before.time<=.100001,'long pauses cannot advance a whole clip');animation.dispose();
});

test('one merchant loads on hub visibility, freezes when hidden/paused and retains authored materials',async()=>{
  let loads=0;const model=asset(),merchant=createStationShopkeeper({loadAsset:async()=>{loads++;return model;}});
  merchant.update(1,{visible:false});assert.equal(loads,0);assert.equal(merchant.readyPromise,null);
  merchant.update(.05,{visible:true});merchant.update(.05,{visible:true});await merchant.readyPromise;
  assert.equal(loads,1);assert.equal(merchant.state.status,'ready');assert.equal(merchant.group.children.length,1);
  assert.deepEqual(merchant.group.position.toArray(),SHOPKEEPER_PLACEMENT.position);assert.equal(model.body.material.metalness,0);
  merchant.update(.05,{visible:true});const before=merchant.state.time;
  merchant.update(.1,{visible:false});merchant.update(.1,{visible:true,paused:true});assert.equal(merchant.state.time,before);
  merchant.update(.05,{visible:true});assert.ok(merchant.state.time>before);assert.equal(loads,1);
  let geometryDisposals=0,materialDisposals=0;model.body.geometry.addEventListener('dispose',()=>geometryDisposals++);model.body.material.addEventListener('dispose',()=>materialDisposals++);
  merchant.dispose();merchant.dispose();assert.equal(geometryDisposals,1);assert.equal(materialDisposals,1);assert.equal(merchant.collisionBoxes.length,0);
});

test('failed or late optional loads neither retry every frame nor leak a disposed actor',async()=>{
  let attempts=0;const unavailable=createStationShopkeeper({loadAsset:async()=>{attempts++;throw new Error('offline asset');}});
  unavailable.update(.1,{visible:true});await unavailable.readyPromise;unavailable.update(.1,{visible:true});
  assert.equal(attempts,1);assert.equal(unavailable.state.status,'unavailable');assert.equal(unavailable.state.error,'offline asset');assert.equal(unavailable.collisionBoxes.length,0);
  unavailable.dispose();
  const model=asset();let resolve,disposed=0;model.body.geometry.addEventListener('dispose',()=>disposed++);
  const late=createStationShopkeeper({loadAsset:()=>new Promise(r=>resolve=r)});
  late.update(.1,{visible:true});await Promise.resolve();late.dispose();resolve(model);await late.readyPromise;
  assert.equal(late.state.status,'disposed');assert.equal(late.group.children.length,0);assert.equal(disposed,1);
});

test('merchant torso blocks staff-side traversal while the existing customer approach stays clear',async()=>{
  const merchant=createStationShopkeeper({loadAsset:async()=>asset()});merchant.update(0,{visible:true});await merchant.readyPromise;
  const min=new THREE.Vector3(-.25,-1.75,-.25),max=new THREE.Vector3(.25,.15,.25),v=(x,z)=>new THREE.Vector3(x,-6.25,z);
  const blocked=constrainStationSweep(null,merchant.collisionBoxes,v(-13.35,2),v(-13.35,-2),min,max);
  assert.equal(blocked.hit,true);assert.ok(blocked.point.z>0);
  const customer=constrainStationSweep(null,merchant.collisionBoxes,v(-8,0),v(-10.7,0),min,max);
  assert.equal(customer.hit,false);assert.deepEqual(customer.point.toArray(),v(-10.7,0).toArray());merchant.dispose();
});


test('opposite shop actors have independent animation, loading and mirrored clearance',async()=>{
  const merchants=Object.entries(STATION_SHOPKEEPERS).map(([id,definition])=>({id,actor:createStationShopkeeper({definition,loadAsset:async()=>asset(definition.idles)})}));
  for(const {actor} of merchants)actor.update(0,{visible:true});
  await Promise.all(merchants.map(({actor})=>actor.readyPromise));
  const [female,male]=merchants.map(({actor})=>actor);
  female.update(.1,{visible:true});assert.equal(male.state.time,0);assert.equal(female.state.currentClip,'idle-04');assert.equal(male.state.currentClip,'idle-02');
  const direction=new THREE.Vector3(0,0,-1).applyQuaternion(male.group.quaternion);assert.ok(direction.x<-.999);
  const min=new THREE.Vector3(-.25,-1.75,-.25),max=new THREE.Vector3(.25,.15,.25),v=(x,z)=>new THREE.Vector3(x,-6.25,z);
  assert.equal(constrainStationSweep(null,male.collisionBoxes,v(13.35,2),v(13.35,-2),min,max).hit,true);
  assert.equal(constrainStationSweep(null,male.collisionBoxes,v(8,0),v(10.7,0),min,max).hit,false);
  female.dispose();male.update(.1,{visible:true});assert.equal(male.state.status,'ready');assert.equal(male.state.time,.1);male.dispose();
});
