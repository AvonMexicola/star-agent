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
import {bodySurfacePoint,SELENE,AEON} from '../src/celestial.js';
import {Navigation} from '../src/navigation.js';
import {ROTATING_BODIES,ROTATION_DOMAIN_RADII,rotationFrameAt,planetRotation,fromInertial,toInertial} from '../src/planet-rotation.js';
import {sentryFrame} from '../src/sentry/frames.js';
import {MOON_LANDING_DIRECTION,LANDING_FRAME} from '../src/moon-world.js';

const up=new Vector3(...MOON_LANDING_DIRECTION),north=new Vector3(...LANDING_FRAME.north).projectOnPlane(up).normalize(),right=north.clone().cross(up).normalize();
const surface=()=>({position:bodySurfacePoint(up,SELENE),quaternion:new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right,up,north.clone().negate()))});
function fixture(systems=new FreighterSystems(),expectFit=true,{clock=null,players=new Map()}={}){
  const frame=surface(),carrier={id:'ship',frame,planetFrame:SELENE.id,systems,inFlight:false},rovers=[];
  let rover;const env=createSentryEnvironment({getFrame:clock?()=>rover?sentryFrame(rover.state.planetFrame):SELENE:null,getTime:()=>clock?.seconds??0,getCarriers:()=>[carrier],getRovers:()=>rovers}),start=roverCarrierStart(systems);
  rover=createSentrySimulation({getPlayer:id=>players.get(id),getTime:()=>clock?.seconds??0,id:'test',ownerId:'pilot',position:start.position.clone().applyQuaternion(frame.quaternion).add(frame.position),quaternion:frame.quaternion.clone().multiply(start.quaternion),sampleSupport:env.support,referenceUp:env.up,constrain:movement=>env.constrain(movement,'test'),accessClear:env.accessClear,getCarriers:env.carriers});
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


test('Atlas carries the complete Sentry and both Navigation riders through every body chart boundary',()=>{
  globalThis.document??={hidden:false,addEventListener(){},querySelector(){return null;},body:{classList:{toggle(){}}}};globalThis.window??={addEventListener(){}};
  const clock={seconds:900},players=new Map();
  for(const id of ['pilot','gunner']){const nav=new Navigation({addEventListener(){}},()=>{});nav.rotationClock=clock;players.set(id,{id,health:100,nav});}
  const {carrier,rover,frame}=fixture(new FreighterSystems(),true,{clock,players}),local=roverShipLocal(rover.physics.state.position,frame),q=frame.quaternion.clone().invert().multiply(rover.physics.state.quaternion);
  // The physical boarding paths are covered separately; isolate moving deck
  // inheritance with occupied real Navigation instances at each boundary.
  for(const role of ['pilot','gunner'])Object.assign(rover.seats[role],{id:role,phase:'seated'});
  carrier.inFlight=true;
  for(const body of ROTATING_BODIES)for(const offset of [-10,-.2,.2,10,.2,-.2,-10]){
    const inertial=new Vector3(...body.center).add(new Vector3(body.radius*ROTATION_DOMAIN_RADII+offset,0,0)),chart=rotationFrameAt(inertial);
    carrier.planetFrame=chart?.id??null;fromInertial(inertial,chart,clock.seconds,frame.position);frame.quaternion.copy(planetRotation(chart,clock.seconds).invert());
    // Local solo order: Sentry ticks inside Navigation.update, whose outer
    // frame pin must not apply a second conversion after the seat placement.
    const pilot=players.get('pilot').nav;pilot.vehicle={step:dt=>{rover.tick(dt);return true;}};pilot.update(1/30);
    assert.equal(rover.state.planetFrame,carrier.planetFrame);assert.equal(rover.state.carrier,'ship');assert.equal(rover.physics.state.supported,true);assert.equal(rover.physics.state.blocked,false,JSON.stringify({body:body.id,offset,snapshot:rover.snapshot(),carrier:carrier.planetFrame}));
    assert.ok(roverShipLocal(rover.physics.state.position,frame).distanceTo(local)<.00001);
    assert.ok(rover.physics.state.quaternion.angleTo(frame.quaternion.clone().multiply(q))<1e-6);
    for(const [role,{nav}]of players){
      const expected=toInertial(rover.world(L.seats[role].eye),chart,clock.seconds);
      assert.ok(nav.inertialPosition.distanceTo(expected)<.00002,`${body.id} ${offset} ${role} position`);
      const feet=toInertial(new Vector3(...nav.sentryFeet),nav.rotationFrame,clock.seconds),expectedFeet=toInertial(rover.world(L.seats[role].feet),chart,clock.seconds);
      assert.ok(feet.distanceTo(expectedFeet)<.00002,`${role} feet`);
      const bodyQ=planetRotation(nav.rotationFrame,clock.seconds).multiply(new Quaternion(...nav.sentryBodyOrientation)),expectedQ=planetRotation(chart,clock.seconds).multiply(rover.physics.state.quaternion);
      assert.ok(bodyQ.angleTo(expectedQ)<1e-6,`${role} body`);
    }
  }
});

test('repeated Sentry environments retain one live Atlas ramp guard',()=>{
  const systems=new FreighterSystems(),carrier={id:'ship',frame:surface(),planetFrame:SELENE.id,systems},carrierGuards=new WeakSet(),rovers=[];
  let guard;
  for(let i=0;i<30;i++){
    const env=createSentryEnvironment({carrierGuards,getCarriers:()=>[carrier],getRovers:()=>rovers});env.carriers();
    if(i===0)guard=systems.rampObstructed;else assert.equal(systems.rampObstructed,guard);
  }
});


test('Sentry occupied volume sees nearby foreign-chart rovers, walkers and parked hulls',()=>{
  const seconds=900,boundary=AEON.radius*ROTATION_DOMAIN_RADII,origin=new Vector3(boundary-.1,0,0),position=fromInertial(origin,AEON,seconds),quaternion=planetRotation(AEON,seconds).invert();
  const other=new Vector3(boundary+.1,0,0),foreign={id:'other',planetFrame:null,position:other,quaternion:new Quaternion(),wheels:[]};
  const common={getFrame:()=>AEON,getTime:()=>seconds};
  assert.equal(createSentryEnvironment({...common,getRovers:()=>[foreign]}).peersClear(position,quaternion,'own'),false);
  const nav={position:other.clone().add(new Vector3(0,1.75,0)),rotationFrame:null,mode:'walk'};
  assert.equal(createSentryEnvironment({...common,getWalkers:()=>[{nav}]}).peersClear(position,quaternion,'own'),false);
  assert.equal(createSentryEnvironment({...common,getHulls:()=>[{...foreign,bounds:L.bounds}]}).clearPose(position,quaternion,'own'),false);
  foreign.position=new Vector3(boundary+20,0,0);nav.position=foreign.position.clone().add(new Vector3(0,1.75,0));
  assert.equal(createSentryEnvironment({...common,getRovers:()=>[foreign],getWalkers:()=>[{nav}]}).peersClear(position,quaternion,'own'),true);
});
