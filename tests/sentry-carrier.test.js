import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion,Matrix4} from 'three';
import {FreighterSystems} from '../src/freighter-layout.js';
import {GannetGameplaySystems} from '../src/medium-ship-gameplay.js';
import {roverCarrierStart} from '../src/rover-carrier.js';
import {roverShipLocal} from '../src/rover-support.js';
import {roverFootprint} from '../src/rover-physics.js';
import {createSentrySimulation} from '../src/sentry/simulation.js';
import {createSentryEnvironment} from '../src/sentry/environment.js';
import {SENTRY_LAYOUT as L} from '../src/sentry/layout.js';
import {bodySurfacePoint,SELENE} from '../src/celestial.js';
import {MOON_LANDING_DIRECTION,LANDING_FRAME} from '../src/moon-world.js';

const up=new Vector3(...MOON_LANDING_DIRECTION),north=new Vector3(...LANDING_FRAME.north).projectOnPlane(up).normalize(),right=north.clone().cross(up).normalize();
const surface=()=>({position:bodySurfacePoint(up,SELENE),quaternion:new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right,up,north.clone().negate()))});
function fixture(systems=new FreighterSystems(),expectFit=true){
  const frame=surface(),carrier={id:'ship',frame,systems,inFlight:false},rovers=[];
  const env=createSentryEnvironment({getCarriers:()=>[carrier],getRovers:()=>rovers}),start=roverCarrierStart(systems);
  const rover=createSentrySimulation({id:'test',ownerId:'pilot',position:start.position.clone().applyQuaternion(frame.quaternion).add(frame.position),quaternion:frame.quaternion.clone().multiply(start.quaternion),sampleSupport:env.support,referenceUp:env.up,constrain:movement=>env.constrain(movement,'test'),accessClear:env.accessClear,getCarriers:env.carriers});
  rovers.push(rover);rover.tick(1/60);if(expectFit){assert.equal(rover.physics.state.supported,true);assert.equal(rover.physics.state.blocked,false,rover.physics.state.reason);}
  return {frame,carrier,rover,systems,env};
}
test('the Sentry inherits moving Atlas carrier position and rotation in world doubles without wheel drift',()=>{
  const f=fixture(),s=f.rover.physics.state,relative=roverShipLocal(s.position,f.frame),rotation=f.frame.quaternion.clone().invert().multiply(s.quaternion);
  assert.equal(f.rover.state.carrier,'ship');
  f.carrier.inFlight=true;
  for(let i=0;i<90;i++){
    f.frame.position.add(new Vector3(12300,910,-8990));f.frame.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(.2,1,.3).normalize(),.004));
    f.rover.tick(1/30);
    assert.ok(roverShipLocal(s.position,f.frame).distanceTo(relative)<.0001);assert.ok(s.quaternion.angleTo(f.frame.quaternion.clone().multiply(rotation))<.00001);
    assert.equal(s.blocked,false);assert.equal(s.supported,true);assert.ok(s.wheels.every(w=>w.source==='carrier:ship:atlas-deck'));
  }
});
test('the complete Sentry drives down the authored Atlas aft ramp and reverses aboard; ramp closure is vetoed',()=>{
  const f=fixture(),{systems,rover,frame}=f;assert.equal(systems.operate('ramp:aft',null).ok,true);
  for(let i=0;i<100;i++)systems.update(.1,null);
  const physics=rover.physics;
  function drive(z,throttle){const seen=new Set();for(let i=0;i<4000;i++){
    physics.step(1/120,{throttle});assert.equal(physics.state.blocked,false,`${physics.state.reason}: ${roverShipLocal(physics.state.position,frame).toArray()}`);
    for(const w of physics.state.wheels)seen.add(w.source);
    if((roverShipLocal(physics.state.position,frame).z-z)*throttle>=0)return seen;
  }assert.fail('drive did not finish');}
  const out=drive(37,1);assert.deepEqual([...out].sort(),['carrier:ship:atlas-deck','carrier:ship:atlas-ramp:aft','terrain']);
  for(let i=0;i<240;i++)physics.step(1/120,{brake:1});
  drive(27,-1);assert.equal(systems.operate('ramp:aft',null).ok,false,'turret variant blocks the actual moving ramp envelope');
  drive(17,-1);for(let i=0;i<240;i++)physics.step(1/120,{brake:1});rover.tick(1/60);
  assert.equal(rover.state.carrier,'ship');assert.ok(physics.state.wheels.every(w=>w.source==='carrier:ship:atlas-deck'));
  assert.equal(systems.operate('ramp:aft',null).ok,true);
});
test('closed Atlas ramp stops the complete taller envelope before the door',()=>{
  const {rover,frame}=fixture();for(let i=0;i<1500&&!rover.physics.state.blocked;i++)rover.physics.step(1/120,{throttle:1});
  assert.equal(rover.physics.state.reason,'collision');
  assert.ok(Math.max(...roverFootprint(rover.physics.state.position,rover.physics.state.quaternion,{layout:L}).map(p=>roverShipLocal(p,frame).z))<24);
});
test('the taller complete turret sweep is rejected at the Gannet lift ceiling',()=>{
  const f=fixture(new GannetGameplaySystems(),false);
  assert.equal(f.rover.physics.state.blocked,true);assert.equal(f.rover.physics.state.reason,'collision');
  assert.ok(f.systems.lift.high+L.bounds.max[1]>f.systems.lift.ceiling);
});
