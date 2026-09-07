import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion,Matrix4} from 'three';
import {FreighterSystems} from '../src/freighter-layout.js';
import {roverCarrierStart,roverCarrierClear,roverObstructsRamp,guardRoverCarrier} from '../src/rover-carrier.js';
import {sampleRoverSupport,roverShipLocal} from '../src/rover-support.js';
import {createRoverPhysics,roverFootprint} from '../src/rover-physics.js';
import {ROVER_LAYOUT} from '../src/rover-layout.js';
import {bodySurfacePoint,bodyOffset,bodyAltitude,SELENE} from '../src/celestial.js';
import {MOON_LANDING_DIRECTION,LANDING_FRAME} from '../src/moon-world.js';
import {constrainShipAttachments} from '../src/ship-attachment-collision.js';

const up=new Vector3(...MOON_LANDING_DIRECTION);
const north=new Vector3(...LANDING_FRAME.north).projectOnPlane(up).normalize(),right=north.clone().cross(up).normalize();
const terrainFrame=()=>({position:bodySurfacePoint(up,SELENE),quaternion:new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right,up,north.clone().negate()))});
const world=(point,frame)=>new Vector3(...point).applyQuaternion(frame.quaternion).add(frame.position);
const settle=f=>{for(let i=0;i<100;i++)f.update(.1,null);assert.ok(f.ramps.every(r=>!r.moving));};
const near=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`${a} differs from ${b}`);
function vehicle(f,frame){
  const start=roverCarrierStart(f),sample=p=>sampleRoverSupport(p,{freighter:f,frame});
  const physics=createRoverPhysics({position:world(start.position.toArray(),frame),quaternion:frame.quaternion.clone().multiply(start.quaternion),sampleSupport:sample,
    referenceUp:p=>sample(p)?.source.startsWith('atlas')?new Vector3(0,1,0).applyQuaternion(frame.quaternion):bodyOffset(p).normalize(),
    constrain:state=>roverCarrierClear(state,f,frame)});
  physics.step(1/60,{brake:1});assert.equal(physics.state.supported,true);assert.equal(physics.state.blocked,false);
  return physics;
}
function driveTo(physics,frame,z,throttle){
  const sources=new Set();
  for(let i=0;i<2400;i++){
    physics.step(1/120,{throttle});
    assert.equal(physics.state.blocked,false,`${physics.state.reason} at ${roverShipLocal(physics.state.position,frame).toArray()}`);
    for(const wheel of physics.state.wheels){
      sources.add(wheel.source);assert.ok(Math.abs(wheel.suspension)<=ROVER_LAYOUT.driving.suspensionTravel+1e-6);
      if(wheel.source==='terrain')near(bodyAltitude(wheel.contact,SELENE),0,.001);
    }
    if((roverShipLocal(physics.state.position,frame).z-z)*throttle>=0)return sources;
  }
  assert.fail('rover did not reach its target');
}

test('64 m Atlas support uses authored ramp normals beyond 30 m and leaves the raised crew shaft empty',()=>{
  const f=new FreighterSystems(),frame={position:new Vector3(25e9,2000,3000),quaternion:new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.38)};
  const query=p=>sampleRoverSupport(world(p,frame),{freighter:f,frame});
  assert.deepEqual(roverCarrierStart(f).position.toArray(),[0,2.6,17]);
  assert.equal(query([0,2.6,17]).source,'atlas-deck');assert.equal(query([5.5,2.6,-4]).source,'atlas-lift:crew');
  f.elevator.y=f.elevator.target=f.elevator.high;
  assert.equal(query([5.5,2.6,-4]),null);assert.equal(query([5.5,9.5,-4]).source,'atlas-lift:crew');
  assert.equal(query([0,0,31.4]),null,'a closed loading door cannot create a ramp floor');
  f.operate('ramp:aft',null);settle(f);
  const ramp=f.ramps.find(r=>r.id==='aft'),y=ramp.pivot[1]-(31.4-ramp.pivot[2])*Math.tan(ramp.openAngle),support=query([0,y,31.4]);
  assert.equal(support.source,'atlas-ramp:aft');near(roverShipLocal(support.point,frame).y,y);
  const expected=new Vector3(0,1,Math.tan(ramp.openAngle)).normalize().applyQuaternion(frame.quaternion);
  near(support.normal.distanceTo(expected),0);assert.ok(support.normal.angleTo(new Vector3(0,1,0).applyQuaternion(frame.quaternion))>.3);
  delete f.lifts;assert.equal(query([0,2.6,17]).source,'atlas-deck','support does not require a legacy lift array');
});

test('Burrow drives from the new cargo deck down the real aft ramp onto Selene and reverses back aboard',()=>{
  const f=new FreighterSystems(),frame=terrainFrame();f.operate('ramp:aft',null);settle(f);
  const physics=vehicle(f,frame),out=driveTo(physics,frame,37,1);
  assert.deepEqual([...out].sort(),['atlas-deck','atlas-ramp:aft','terrain']);
  for(let i=0;i<240;i++)physics.step(1/120,{brake:1});
  assert.ok(physics.state.wheels.every(w=>w.source==='terrain'));
  const back=driveTo(physics,frame,17,-1);
  assert.deepEqual([...back].sort(),['atlas-deck','atlas-ramp:aft','terrain']);
  assert.ok(physics.state.wheels.every(w=>w.source==='atlas-deck'));
  near(roverShipLocal(physics.state.position,frame).y,2.6,.0001);
});

test('closed and moving loading ramps stop the complete rover before its body crosses the door',()=>{
  for(const moving of [false,true]){
    const f=new FreighterSystems(),frame=terrainFrame();if(moving)f.operate('ramp:aft',null);
    const physics=vehicle(f,frame);
    for(let i=0;i<900&&!physics.state.blocked;i++)physics.step(1/120,{throttle:1});
    assert.equal(physics.state.reason,'collision');
    const nose=Math.max(...roverFootprint(physics.state.position,physics.state.quaternion).map(p=>roverShipLocal(p,frame).z));
    assert.ok(nose<24,'the whole rover stops inside the closed ramp');
  }
});

test('ramp safety sees an unoccupied or straddling rover and preserves crew-lift and existing ramp vetoes',()=>{
  const f=new FreighterSystems(),frame=terrainFrame(),physics=vehicle(f,frame),aft=f.ramps.find(r=>r.id==='aft');
  const crewGuard=()=>false;f.canMove=crewGuard;f.rampObstructed=id=>id==='front';
  let spawned=true;guardRoverCarrier(f,()=>({state:physics.state,frame,spawned,busy:false}));
  assert.equal(f.canMove,crewGuard);assert.equal(f.operate('elevator:crew',new Vector3(5.5,4.35,-4)).ok,false);
  assert.equal(f.operate('ramp:front',null).ok,false,'an earlier ramp veto survives');
  assert.equal(f.operate('ramp:aft',null).ok,true);settle(f);
  for(const point of [[0,2.6,23],[0,1.2,28],[0,0,32]]){
    physics.setPose(world(point,frame),frame.quaternion);
    assert.equal(roverObstructsRamp(physics.state,aft,frame),true);assert.equal(f.operate('ramp:aft',null).ok,false);
  }
  spawned=false;assert.equal(f.operate('ramp:aft',null).ok,true,'an absent rover does not block the carrier');
});

test('authored furniture and loaded single-cell cargo stop the rover while the central lane stays clear',()=>{
  const f=new FreighterSystems(),frame=terrainFrame();
  const pose=point=>({position:world(point,frame),quaternion:frame.quaternion});
  const move=(a,b,options)=>roverCarrierClear({previous:pose(a),proposed:pose(b)},f,frame,options);
  const crates=[{min:[-3.7,2.625,3],max:[-3.1,3.225,3.6]},{min:[2.5,2.625,3],max:[3.1,3.225,3.6]}];
  const cargoConstrain=(a,b)=>constrainShipAttachments(a,b,crates);
  assert.equal(move([0,2.6,12],[0,2.6,1],{cargoConstrain}),true,'loaded rows leave the central drive lane clear');
  assert.equal(move([0,2.6,3],[-2,2.6,3],{cargoConstrain}),false,'port tyre/body meets a smallest-cell crate');
  assert.equal(move([0,2.6,3],[2,2.6,3],{cargoConstrain}),false,'starboard tyre/body meets a smallest-cell crate');
  const prop=f.colliders.find(c=>c.min[1]===f.layout.cargo.floor);
  assert.ok(prop);assert.equal(move([0,2.6,17],[(prop.min[0]+prop.max[0])/2,2.6,(prop.min[2]+prop.max[2])/2]),false);
});

test('cargo-deck wheel contacts remain aboard while the carrier translates and rotates in double precision',()=>{
  const f=new FreighterSystems(),frame={position:new Vector3(25e9,2000,3000),quaternion:new Quaternion()},physics=vehicle(f,frame);
  const anchor=roverShipLocal(physics.state.position,frame),rotation=frame.quaternion.clone().invert().multiply(physics.state.quaternion);
  const contacts=physics.state.wheels.map(w=>roverShipLocal(w.contact,frame));
  frame.position.add(new Vector3(1200,830,-900));frame.quaternion.setFromAxisAngle(new Vector3(.2,1,.3).normalize(),.73);
  physics.setPose(anchor.clone().applyQuaternion(frame.quaternion).add(frame.position),frame.quaternion.clone().multiply(rotation),{preserveMotion:true});
  physics.step(1/60,{brake:1});assert.equal(physics.state.blocked,false);assert.equal(physics.state.supported,true);
  physics.state.wheels.forEach((w,i)=>{assert.equal(w.source,'atlas-deck');near(roverShipLocal(w.contact,frame).distanceTo(contacts[i]),0,.00002);});
});
