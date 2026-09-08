import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWorld} from '../server/world.js';
import {createStationHub} from '../server/station-hub.js';
import {stationPhysicsAt} from '../src/station-physics.js';
import {updateElevator} from '../src/station-architecture.js';
import {assetCollisionBoxes} from '../src/station-concourse.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {readFile} from 'node:fs/promises';

const worldPromise=createWorld();
async function setup(count=1){
  const world=await worldPromise,players=new Map(),messages=[];
  for(const frame of [...world.pods,world.station.hub]){frame.lift.open=false;frame.lift.progress=0;updateElevator(frame.lift,0);}
  const service=createStationHub({world,players,send:(p,message)=>messages.push({id:p.id,...message})});
  for(let i=0;i<count;i++){
    const p={id:`p${i}`,nav:world.createNavigation(i,()=>{}),hangarId:i+1,spawnPod:i+1,health:100,shipHealth:100,weapon:'rifle-laser',sequence:1,input:{fire:false}};
    p.nav.station=world.adapter(p);players.set(p.id,p);
  }
  const tick=seconds=>{for(let i=0;i<Math.ceil(seconds*30);i++){service.tick(1/30);for(const p of players.values())service.update(p,1/30);}};
  const cabin=(p,frame=world.pods[p.hangarId-1])=>{frame.toWorld(new THREE.Vector3(0,frame.lift.floor+p.nav.layout.eyeHeight,frame.lift.z+1.65),p.nav.position);p.nav.orientation.copy(frame.quaternion);p.nav.mode='walk';p.nav.insideShip=false;};
  return {world,players,service,messages,tick,cabin,p:players.get('p0')};
}

test('authoritative world loads current exterior and exactly the visible cabin/concourse collision boxes',async()=>{
  const {world}=await setup();assert.notEqual(world.station.exteriorStatus,'legacy');
  const load=async name=>{const bytes=await readFile(new URL(`../public/models/${name}.glb`,import.meta.url));return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');};
  const [concourse,elevator]=await Promise.all(['station-concourse','station-elevator'].map(load));
  assert.deepEqual(world.station.hub.staticBoxes,assetCollisionBoxes(concourse.scene));
  for(const frame of [...world.pods,world.station.hub])assert.deepEqual(frame.lift.staticBoxes,assetCollisionBoxes(elevator.scene,new THREE.Vector3(0,frame.lift.floor,frame.lift.z)));
});

test('all twenty cabins require physical entry through leaves, not an arbitrary position request',async()=>{
  const {world,service,p,messages}=await setup(),station=world.station;
  for(const frame of world.pods){
    const eye=frame.lift.floor+p.nav.layout.eyeHeight;
    const start=frame.toWorld(new THREE.Vector3(0,eye,frame.lift.z-2),new THREE.Vector3()),end=frame.toWorld(new THREE.Vector3(0,eye,frame.lift.z+1.65),new THREE.Vector3());
    p.nav.position.copy(start);p.nav.orientation.copy(frame.quaternion);p.nav.mode='walk';p.nav.insideShip=false;
    assert.equal(station.constrainStep(start,end,p.nav.orientation,true,p.nav.layout).hit,true,'closed physical leaves block entry');
    assert.throws(()=>service.request(p,{destination:'hub',position:end.toArray()}),/Walk fully inside/);
    assert.equal(service.action(p),true);for(let i=0;i<30;i++)service.tick(1/30);
    assert.equal(frame.lift.progress,1);
    assert.equal(station.constrainStep(start,end,p.nav.orientation,true,p.nav.layout).hit,false,'full body passes the real open cabin');
    p.nav.position.copy(end);assert.equal(service.action(p),true);
    assert.equal(messages.at(-1).action,'destinations');assert.equal(messages.at(-1).frame,`hangar:${frame.id}`);
    frame.lift.open=false;frame.lift.progress=0;updateElevator(frame.lift,0);
  }
  p.nav.mode='flight';assert.throws(()=>service.request(p,{destination:'hub'}),/on foot/);
  assert.equal(service.action(p),false);
});

test('door closure, travel and arrival sequence preserves parked ship and berth while holding movement',async()=>{
  const {world,service,p,cabin,tick}=await setup();const pod=world.pods[0];cabin(p);
  pod.lift.open=true;pod.lift.progress=1;updateElevator(pod.lift,0);
  const before=p.nav.position.clone(),ship=p.nav.shipPosition.clone(),orientation=p.nav.shipOrientation.clone();
  p.input.fire=true;
  assert.equal(service.request(p,{destination:'hub'}).ok,true);assert.equal(p.weapon,null);assert.equal(service.canFire(p),false);
  assert.throws(()=>service.request(p,{destination:20}),/already in progress/);
  tick(.5);assert.equal(p.nav.stationHubTransit.phase,'closing');assert.ok(p.nav.position.equals(before));
  tick(.5);assert.equal(p.nav.stationHubTransit.phase,'travel');assert.ok(p.nav.position.equals(before));
  p.nav.position.addScalar(2);p.nav.velocity.set(10,8,4);tick(.1);assert.ok(p.nav.position.equals(before));assert.equal(p.nav.velocity.length(),0);
  tick(3);assert.equal(p.nav.stationHubTransit,null);assert.equal(p.nav.physicsFrame,'station:hub');
  assert.ok(p.nav.shipPosition.equals(ship));assert.ok(p.nav.shipOrientation.equals(orientation));assert.equal(p.hangarId,1);
  assert.equal(service.snapshot(p).handsFree,true);assert.equal(service.snapshot(p).elevators.length,21);
  assert.equal(p.nav.station.location,'hub');assert.equal(p.nav.station.parkedPod,0);
  assert.equal(service.request(p,{destination:20}).ok,true);tick(4);
  assert.equal(p.nav.physicsFrame,'hangar:20');assert.equal(p.nav.station.location,'hangar');assert.equal(p.nav.station.activeIndex,19);assert.equal(p.nav.station.parkedPod,0);
  assert.ok(p.nav.shipPosition.equals(ship));assert.equal(p.hangarId,1);assert.equal(service.canFire(p),false);
  p.sequence++;p.input.fire=true;service.input(p);p.input.fire=false;
  assert.equal(service.canFire(p),false,'timeout-neutral is rejected');
  p.sequence++;service.input(p);assert.equal(service.canFire(p),true,'new neutral after arrival rearms');
});

test('concurrent travellers cannot share a destination and occupied frame stays per player',async()=>{
  const {world,service,p,players,cabin,tick}=await setup(3),other=players.get('p1'),observer=players.get('p2');
  cabin(p);cabin(other);service.request(p,{destination:'hub'});
  assert.throws(()=>service.request(other,{destination:'hub'}),/occupied/);
  assert.equal(observer.nav.physicsFrame,'hangar:3');tick(4);
  assert.equal(p.nav.physicsFrame,'station:hub');assert.equal(observer.nav.physicsFrame,'hangar:3');
  assert.equal(p.nav.station.location,'hub');assert.equal(observer.nav.station.location,'hangar');assert.equal(p.nav.station.location,'hub');
  assert.throws(()=>service.request(other,{destination:'hub'}),/occupied/);
  world.station.hub.toWorld(new THREE.Vector3(0,-6.25,10),p.nav.position);
  service.request(other,{destination:'hub'});tick(4);
  assert.equal(other.nav.physicsFrame,'station:hub');assert.equal(observer.nav.physicsFrame,'hangar:3');
});

test('a close approach opens closed passenger doors while occupied doors cannot close',async()=>{
  const {world,service,p,tick,messages}=await setup(),frame=world.pods[0];
  frame.toWorld(new THREE.Vector3(0,frame.lift.floor+p.nav.layout.eyeHeight,frame.lift.z-.34),p.nav.position);
  p.nav.mode='walk';p.nav.insideShip=false;
  assert.equal(service.action(p),true);assert.equal(frame.lift.open,true);
  tick(1);assert.equal(frame.lift.progress,1,'the doorway interlock must not stop opening');
  assert.equal(service.action(p),true);assert.equal(frame.lift.open,true,'the body still prevents closing');
  assert.match(messages.at(-1).message,/Step clear/);
});

test('door threshold interlock and disconnect cancel do not crush or strand another passenger',async()=>{
  const {world,service,p,players,cabin,tick}=await setup(2),other=players.get('p1'),frame=world.pods[0];
  cabin(p);frame.lift.open=true;frame.lift.progress=1;updateElevator(frame.lift,0);service.request(p,{destination:'hub'});
  frame.toWorld(new THREE.Vector3(0,frame.lift.floor+other.nav.layout.eyeHeight,frame.lift.z),other.nav.position);
  tick(1);assert.equal(frame.lift.progress,1);assert.equal(p.nav.stationHubTransit.phase,'closing');
  other.nav.position.addScaledVector(frame.up,1);tick(.5);assert.equal(frame.lift.progress,1,'jumping bystander still holds the door');
  players.delete(p.id);service.tick(1/30);assert.equal(p.nav.stationHubTransit,null);assert.equal(frame.lift.open,true);
  cabin(other);assert.equal(service.request(other,{destination:'hub'}).ok,true);tick(4);assert.equal(other.nav.physicsFrame,'station:hub');
});

test('hub furniture and cabin walls constrain actual server walking and shot obstruction',async()=>{
  const {world,p}=await setup(),frame=world.station.hub;
  const point=(x,z)=>frame.toWorld(new THREE.Vector3(x,-8+p.nav.layout.eyeHeight,z),new THREE.Vector3());
  for(const [a,b,blocked] of [[[0,0],[10.7,0],false],[[10.7,0],[13,0],true],[[6,8],[6,12],true],[[0,15.95],[0,18.4],true]]){
    const result=world.station.constrainStep(point(...a),point(...b),frame.quaternion,true,p.nav.layout);assert.equal(result.hit,blocked);
  }
  const start=frame.toWorld(new THREE.Vector3(10.7,-7.4,0),new THREE.Vector3()),direction=new THREE.Vector3(1,0,0).applyQuaternion(frame.quaternion);
  assert.ok(world.occludes(start,direction,3)<3,'counter blocks a real world-space ray');
  assert.equal(stationPhysicsAt(world.station,point(0,0)).id,'station:hub');
});

test('Navigation walks out of the arrival cabin on the real hub gravity grid',async()=>{
  const {world,service,p,cabin,tick}=await setup();cabin(p);service.request(p,{destination:'hub'});tick(4);
  const ship=p.nav.shipPosition.clone();p.nav.keys.add('KeyW');
  for(let i=0;i<90;i++){p.nav.beginFrame(1/30);p.nav.update(1/30);}
  const local=world.station.hub.toLocal(p.nav.position,new THREE.Vector3());
  assert.equal(p.nav.mode,'walk');assert.equal(p.nav.physicsFrame,'station:hub');
  assert.ok(Math.abs(local.y+8-p.nav.layout.eyeHeight)<1e-7);assert.ok(local.z<4&&local.z>1,'walks the cabin and central aisle');
  assert.ok(p.nav.shipPosition.equals(ship));
});

test('authoritative render state selects hub without losing the parked berth or predicting elevator leaves',async()=>{
  const {world}=await setup(),station=world.station;
  const state={hangar:{id:7},physicsFrame:'station:hub',hub:{frame:'station:hub',transit:{phase:'opening'},elevators:[{frame:'station:hub',open:true,progress:.42},{frame:'hangar:7',open:false,progress:.8}]}};
  station.setMultiplayerState(state);
  assert.equal(station.location,'hub');assert.equal(station.parkedPod,6);assert.equal(station.frame,station.hub);
  assert.equal(station.hub.lift.progress,.42);assert.ok(Math.abs(station.hub.lift.leaves[0].position.x-(-1.04-.42*2.05))<1e-10);
  station.update(station.centre,station.centre,new THREE.Vector3(1,0,0),.25);
  assert.equal(station.hub.lift.progress,.42);assert.equal(station.pods[6].lift.progress,.8);
  station.setMultiplayerState({...state,physicsFrame:'hangar:19',hub:{...state.hub,frame:'hangar:19'}});
  assert.equal(station.activeIndex,18);assert.equal(station.parkedPod,6);
  station.setMultiplayerState(null);
});

test('hub service stays optional for small existing room fixtures',()=>{
  const players=new Map(),service=createStationHub({world:{pods:[]},players});
  const p={id:'stub',nav:{position:new THREE.Vector3()},input:{fire:true},sequence:1};
  assert.equal(service.action(p),false);assert.equal(service.update(p,.1),false);service.tick(.1);
  assert.equal(service.canFire(p),true);assert.deepEqual(service.snapshot(p),{frame:null,transit:null,handsFree:false,elevators:[]});
});

test('original equipment retailers require actual reach and only emit an availability event online',async()=>{
  const {world,service,p,messages}=await setup(),frame=world.station.hub;
  for(const [x,id] of [[-10.7,'weapons'],[10.7,'equipment']]){
    frame.toWorld(new THREE.Vector3(x,-6.25,0),p.nav.position);
    assert.equal(service.action(p),true);assert.deepEqual(messages.at(-1),{id:p.id,type:'event',event:'stationHub',action:'equipmentRetail',shopId:id});
  }
  const count=messages.length;frame.toWorld(new THREE.Vector3(0,-6.25,0),p.nav.position);
  assert.equal(service.action(p),false);assert.equal(messages.length,count);
});

test('stalled ticks and respawn input resets cannot stand in for a received neutral packet',async()=>{
  const {world,service,p,cabin}=await setup();cabin(p,world.station.hub);service.update(p,1/30);
  cabin(p);p.sequence++;p.input.fire=true;service.input(p);
  // A stalled first tick resets the held packet before its frame simulation.
  p.input.fire=false;assert.equal(service.canFire(p),false);
  service.leave(p,{preserveGate:true});p.input.fire=false;assert.equal(service.canFire(p),false);
  p.sequence++;service.input(p);assert.equal(service.canFire(p),true);
});
