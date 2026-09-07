import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ROVER_LAYOUT } from '../src/rover-layout.js';
import { createRoverPhysics,roverSweptBounds,roverFootprint,roverFitsPlatform } from '../src/rover-physics.js';

const UP=new THREE.Vector3(0,1,0),FORWARD=new THREE.Vector3(0,0,-1);
const plane=(height=0)=>(point)=>({point:new THREE.Vector3(point.x,height,point.z),normal:UP.clone(),source:'deck'});
const make=options=>createRoverPhysics({sampleSupport:plane(),...options});
function run(rover,seconds,controls={throttle:1},dt=1/60){for(let i=0;i<Math.round(seconds/dt);i++)rover.step(dt,controls);return rover.state;}
function near(a,b,tolerance=1e-8){assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b} by ${Math.abs(a-b)}`);}

test('canonical speed limits, braking and inactive frames never replay accumulated motion',()=>{
  let calls=0;const rover=make({sampleSupport:p=>{calls++;return plane()(p);}});
  const state=run(rover,5);near(state.speed,12);assert.ok(state.position.z<0);assert.equal(state.supported,true);
  const stoppingAt=state.position.clone();run(rover,2,{throttle:1,brake:true});near(state.speed,0);
  near(state.position.distanceTo(stoppingAt),9,1e-6);
  const stopped=state.position.clone(),spins=state.wheels.map(w=>w.spin),contacts=state.wheels.map(w=>w.contact.toArray()),beforeCalls=calls;
  rover.step(.003,{throttle:1});rover.step(30,{active:false,throttle:1,steer:1});
  assert.deepEqual(state.position,stopped);assert.deepEqual(state.wheels.map(w=>w.spin),spins);assert.equal(calls,beforeCalls);assert.deepEqual(state.wheels.map(w=>w.contact.toArray()),contacts);
  rover.step(.004,{throttle:1});assert.deepEqual(state.position,stopped);
  run(rover,3,{throttle:-1});near(state.speed,-4);assert.ok(state.position.z>stopped.z);
});

test('right-positive steering turns forward travel right and reverses yaw when backing',()=>{
  const forward=make(),reverse=make();run(forward,1.5,{throttle:1,steer:1});run(reverse,1.5,{throttle:-1,steer:1});
  assert.ok(forward.state.position.x>.1);assert.ok(FORWARD.clone().applyQuaternion(forward.state.quaternion).x>0);
  assert.ok(FORWARD.clone().applyQuaternion(reverse.state.quaternion).x<0);
  near(forward.state.steer,ROVER_LAYOUT.driving.wheelSteerLimit);
  forward.state.wheels.forEach((wheel,i)=>near(wheel.steer,ROVER_LAYOUT.wheels[i].front?-forward.state.steer:0));
  assert.ok(forward.state.wheels.every(w=>Number.isFinite(w.spin)&&Math.abs(w.spin)>.01));
  assert.notEqual(forward.state.wheels[0].spin,forward.state.wheels[1].spin,'inside/outside wheel distances differ');
});

test('fixed substeps produce the same curved drive at 30, 60 and 120 Hz and irregular frame partitions',()=>{
  const options={throttle:.65,steer:.7},states=[30,60,120].map(hz=>run(make(),4,options,1/hz));
  const irregular=make();for(let i=0;i<120;i++){irregular.step(1/120,options);irregular.step(1/40,options);}states.push(irregular.state);
  for(const state of states.slice(1)){
    near(state.position.distanceTo(states[0].position),0,1e-9);near(state.quaternion.angleTo(states[0].quaternion),0,5e-8);near(state.speed,states[0].speed);
    state.wheels.forEach((wheel,i)=>near(wheel.spin,states[0].wheels[i].spin));near(state.droppedTime,0);
  }
});

test('long or invalid dt cannot leap across the world or poison the state',()=>{
  const rover=make(),expected=make();rover.step(10,{throttle:1});run(expected,.25);
  near(rover.state.position.distanceTo(expected.state.position),0);near(rover.state.speed,.75);near(rover.state.droppedTime,9.75);
  const position=rover.state.position.clone();for(const dt of [-1,NaN,Infinity])assert.throws(()=>rover.step(dt),/Invalid rover dt/);
  assert.deepEqual(rover.state.position,position);rover.step(.1,{throttle:NaN,steer:Infinity});assert.ok(rover.state.position.toArray().every(Number.isFinite));
});

test('centimetre-scale motion is retained at stellar origins without Float32 transforms',()=>{
  const offset=new THREE.Vector3(25e9,-17e9,8e9),local=make(),distant=make({position:offset,sampleSupport:plane(offset.y)});
  run(local,5,{throttle:.8,steer:.3});run(distant,5,{throttle:.8,steer:.3});
  const error=distant.state.position.clone().sub(offset).distanceTo(local.state.position);assert.ok(error<.002,`large-origin drift ${error} m`);
  near(distant.state.speed,local.state.speed);assert.equal(distant.state.supported,true);assert.equal(distant.state.blocked,false);
  assert.ok(distant.state.wheels.every(w=>w.contact.x>24e9&&w.source==='deck'));
});

test('four wheels follow a curved support surface and its radial reference up at a large origin',()=>{
  const center=new THREE.Vector3(25e9,1e9,-2e9),radius=60,radial=p=>p.clone().sub(center).normalize();
  const rover=make({position:center.clone().addScaledVector(UP,radius),referenceUp:radial,sampleSupport:p=>{const normal=radial(p);return {point:normal.clone().multiplyScalar(radius).add(center),normal,source:'curved body'};}});
  run(rover,10,{throttle:1});const state=rover.state;
  assert.equal(state.supported,true);assert.equal(state.blocked,false);assert.ok(state.distance>90);
  const currentUp=UP.clone().applyQuaternion(state.quaternion);assert.ok(currentUp.dot(radial(state.position))>.9999);assert.ok(currentUp.dot(UP)<.5,'travel changed the local up substantially');
  assert.ok(Math.abs(state.position.distanceTo(center)-radius)<.06);
  for(const wheel of state.wheels){near(wheel.contact.distanceTo(center),radius,.00001);assert.equal(wheel.source,'curved body');assert.ok(Math.abs(wheel.suspension)<=ROVER_LAYOUT.driving.suspensionTravel);}
});

test('surface normals and the complete support plane both enforce the absolute slope limit',()=>{
  for(const [angle,allowed,normalLies] of [[.4,true,false],[.6,false,false],[.6,false,true]]){
    const normal=new THREE.Vector3(0,Math.cos(angle),Math.sin(angle));
    const rover=make({quaternion:new THREE.Quaternion().setFromUnitVectors(UP,normal),referenceUp:()=>UP,sampleSupport:p=>({point:new THREE.Vector3(p.x,-p.z*Math.tan(angle),p.z),normal:normalLies?UP:normal,source:'incline'})});
    run(rover,1,{throttle:1});assert.equal(rover.state.blocked,!allowed);
    if(allowed){assert.ok(rover.state.position.y>.2);assert.equal(rover.state.reason,'grounded');}else{assert.equal(rover.state.reason,'slope');near(rover.state.position.length(),0);near(rover.state.speed,0);}
  }
});

test('a climbable curb settles all four wheels while higher steps and drops retain the last safe pose',()=>{
  for(const height of [.2,.27,-.27]){
    const rover=make({sampleSupport:p=>({point:new THREE.Vector3(p.x,p.z< -3?height:0,p.z),normal:UP,source:'curb'})});
    run(rover,4);const state=rover.state;
    if(height===.2){assert.equal(state.blocked,false);assert.ok(state.position.z< -8);near(state.position.y,.2);}
    else{assert.equal(state.reason,'step');near(state.speed,0);assert.ok(state.wheels.every(w=>w.contact.z>=-3));const p=state.position.clone(),q=state.quaternion.clone(),spin=state.wheels.map(w=>w.spin);run(rover,.2);assert.deepEqual(state.position,p);assert.deepEqual(state.quaternion,q);assert.deepEqual(state.wheels.map(w=>w.spin),spin);}
  }
});

test('one unsupported leading wheel blocks an edge and a wholly missing surface never creates a floor',()=>{
  const rover=make({sampleSupport:p=>p.z< -3?null:plane()(p)});run(rover,3);
  assert.equal(rover.state.reason,'unsupported');near(rover.state.speed,0);assert.ok(rover.state.wheels.every(w=>w.contact.z>=-3));
  const missing=make({position:new THREE.Vector3(0,40,0),sampleSupport:()=>null});run(missing,2);
  assert.equal(missing.state.supported,false);assert.equal(missing.state.position.y,40);assert.equal(missing.state.position.z,0);assert.ok(missing.state.wheels.every(w=>w.contact===null&&w.spin===0));
});

test('the collision callback can sweep the whole assembly and reject without spinning through an obstacle',()=>{
  let collisions=0,maxStep=0;const rover=make({constrain:({previous,proposed,previousCorners,corners,dt})=>{
    assert.equal(previousCorners.length,8);assert.equal(corners.length,8);near(dt,1/120);maxStep=Math.max(maxStep,proposed.position.distanceTo(previous.position));
    if(Math.min(...corners.map(p=>p.z))< -4){collisions++;return {blocked:true};}return true;
  }});
  run(rover,3);assert.equal(rover.state.reason,'collision');assert.ok(collisions>0);assert.ok(maxStep<=.101);near(rover.state.speed,0);
  assert.ok(Math.min(...roverFootprint(rover.state.position,rover.state.quaternion).map(p=>p.z))>=-4);
  const position=rover.state.position.clone(),spin=rover.state.wheels.map(w=>w.spin);run(rover,.1);assert.deepEqual(rover.state.position,position);assert.deepEqual(rover.state.wheels.map(w=>w.spin),spin);
});

test('uneven wheel support produces bounded, signed suspension offsets from real contacts',()=>{
  const rover=make({sampleSupport:p=>({point:new THREE.Vector3(p.x,p.x>0&&p.z<0?.2:0,p.z),normal:UP,source:'uneven pads'})});rover.step(1/60);
  assert.equal(rover.state.supported,true);const offsets=rover.state.wheels.map(w=>w.suspension);assert.ok(Math.min(...offsets)<-.02);assert.ok(Math.max(...offsets)>.02);
  const up=UP.clone().applyQuaternion(rover.state.quaternion);
  rover.state.wheels.forEach((wheel,i)=>{const foot=new THREE.Vector3(...ROVER_LAYOUT.wheels[i].position).addScaledVector(UP,-ROVER_LAYOUT.wheelRadius+wheel.suspension).applyQuaternion(rover.state.quaternion).add(rover.state.position);near(wheel.contact.clone().sub(foot).dot(up),0,1e-8);assert.ok(Math.abs(wheel.suspension)<=.22);near(wheel.spin,0);});
});

test('the complete animated envelope fits Atlas with margin in every heading, but rejects overhang and low ceilings',()=>{
  const bounds=roverSweptBounds();assert.ok(bounds.max[0]>1.51);assert.ok(bounds.min[0]<-1.51);near(bounds.min[1],-.22);
  const carrierPosition=new THREE.Vector3(25e9,1e9,-3e9),carrierQuaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(.55,.7,1.2));
  const platform={position:carrierPosition,quaternion:carrierQuaternion,minX:-4,maxX:4,minZ:0,maxZ:10,ceiling:9.2};
  const park=new THREE.Vector3(...ROVER_LAYOUT.atlas.park),centered=new THREE.Vector3(0,4,5),world=point=>point.clone().applyQuaternion(carrierQuaternion).add(carrierPosition);
  for(let i=0;i<32;i++){const q=carrierQuaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP,i*Math.PI/16));assert.equal(roverFitsPlatform(world(centered),q,platform),true,`centered heading ${i}`);}
  const parkedRotation=carrierQuaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP,ROVER_LAYOUT.atlas.heading));
  assert.equal(roverFitsPlatform(world(park),parkedRotation,platform),true,'the actual offset unloading pose has the canonical margin');
  assert.equal(roverFitsPlatform(world(new THREE.Vector3(2.6,4,5)),carrierQuaternion,platform,{margin:0}),false,'tyre sweep projects outside although wheel centres remain on the platform');
  assert.equal(roverFitsPlatform(world(new THREE.Vector3(0,4,8.5)),carrierQuaternion,platform,{margin:0}),false,'rear body projects outside although wheel centres remain on the platform');
  assert.equal(roverFitsPlatform(world(park),carrierQuaternion,{...platform,ceiling:6.4}),false);
  assert.deepEqual(ROVER_LAYOUT.bounds.min,[-1.72,0,-2.55],'canonical static layout was not mutated');
});

test('explicit carrying preserves motion and rigidly transforms contacts; ordinary placement resets them',()=>{
  const rover=make();run(rover,.5,{throttle:1,steer:.3});const {state}=rover;
  const oldPosition=state.position.clone(),oldRotation=state.quaternion.clone(),contacts=state.wheels.map(w=>w.contact.clone()),spin=state.wheels.map(w=>w.spin),suspension=state.wheels.map(w=>w.suspension),speed=state.speed;
  const position=new THREE.Vector3(25e9,20,500),quaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(.3,.7,.1)),delta=quaternion.clone().multiply(oldRotation.clone().invert());
  rover.setPose(position,quaternion,{preserveMotion:true});near(state.speed,speed);assert.deepEqual(state.wheels.map(w=>w.spin),spin);assert.deepEqual(state.wheels.map(w=>w.suspension),suspension);
  state.wheels.forEach((wheel,i)=>{near(wheel.contact.distanceTo(contacts[i].sub(oldPosition).applyQuaternion(delta).add(position)),0);near(wheel.normal.distanceTo(UP.clone().applyQuaternion(delta)),0,1e-8);assert.equal(wheel.source,'deck');});
  rover.setPose(new THREE.Vector3(),new THREE.Quaternion());near(state.speed,0);near(state.steer,0);assert.equal(state.supported,false);assert.ok(state.wheels.every(w=>w.contact===null&&w.source===null&&w.spin===0));
});
