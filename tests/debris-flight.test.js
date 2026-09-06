import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {Navigation,debrisSpeedLimit,DEBRIS_SPEED_LIMIT} from '../src/navigation.js';
import {MiningField,ringSurveyPoint} from '../src/mining/field.js';
import {RING_NORMAL,RING_ROTATION,RING_RADIUS,RING_WIDTH,RING_THICKNESS} from '../src/ring-world.js';
import {MOON_POSITION} from '../src/moon-world.js';
const center=new Vector3(...MOON_POSITION);
const beltPoint=(radius=RING_RADIUS,height=0)=>new Vector3(radius,0,height).applyQuaternion(RING_ROTATION).add(center);
function navigation(t){
  const oldDocument=Object.getOwnPropertyDescriptor(globalThis,'document'),oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
  const events={addEventListener(){}};
  Object.defineProperty(globalThis,'document',{configurable:true,value:{...events,querySelector:()=>null,body:{classList:{toggle(){}}}}});
  Object.defineProperty(globalThis,'window',{configurable:true,value:events});
  t.after(()=>{if(oldDocument)Object.defineProperty(globalThis,'document',oldDocument);else delete globalThis.document;if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else delete globalThis.window;});
  const notices=[],nav=new Navigation(events,message=>notices.push(message));
  // Exercise the real swept-entry brake in an otherwise empty flight corridor.
  // Actual asteroid collision has independent geometry/streaming regressions.
  nav.surfaceObstacles={constrainFlight:MiningField.prototype.constrainFlight,constrainSurface:(_method,_a,b)=>({point:b,hit:false}),constrainSpace:(_a,b)=>({point:b,hit:false})};
  return {nav,notices};
}

test('debris speed limit covers only the padded finite ring, not Selene or its inner void',()=>{
  for(const point of [beltPoint(),beltPoint(RING_RADIUS,RING_THICKNESS/2+450),beltPoint(RING_RADIUS+RING_WIDTH/2+450)])assert.equal(debrisSpeedLimit(point),400);
  for(const point of [center,beltPoint(RING_RADIUS,RING_THICKNESS/2+900),beltPoint(RING_RADIUS-RING_WIDTH/2-900),beltPoint(RING_RADIUS+RING_WIDTH/2+900),new Vector3()])assert.equal(debrisSpeedLimit(point),Infinity);
});

test('default assisted thrust continuously moves inside the ring at 30, 40, 60 and 144 Hz without brake oscillation',t=>{
  const {nav,notices}=navigation(t),distances=[];
  for(const hz of [30,40,60,144]){
    nav.orbit();nav.position.copy(beltPoint());const up=new Vector3(...RING_NORMAL),tangent=up.clone().cross(nav.position.clone().sub(center)).normalize();
    nav.orientToward(nav.position.clone().add(tangent),up);nav.keys.add('KeyW');nav.keys.add('ShiftLeft');nav.speedScale=8;
    const start=nav.position.clone();
    for(let i=0;i<hz*2;i++){const before=nav.position.clone();nav.update(1/hz);assert.ok(nav.position.distanceTo(before)>0,'held thrust never freezes at debris brake');assert.ok(nav.speed<=DEBRIS_SPEED_LIMIT+1e-9);}
    assert.ok(nav.speed>395);distances.push(nav.position.distanceTo(start));nav.keys.clear();
  }
  assert.ok(Math.max(...distances)-Math.min(...distances)<7,'coarse and fine frame rates cover similar distance');
  assert.equal(notices.filter(message=>message.includes('Debris proximity')).length,0);
});

test('inertial and incoming travel retain the local cap and can resume after the swept entry brake',t=>{
  const {nav}=navigation(t),target=ringSurveyPoint(),normal=new Vector3(...RING_NORMAL);
  nav.position.copy(target).addScaledVector(normal,20000);nav.orientToward(target,nav.normal);nav.velocity.copy(normal).multiplyScalar(-1000000);
  nav.update(.025);assert.ok(nav.surfaceObstacles.debrisBrake,'high-speed approach still invokes swept entry brake');assert.equal(nav.speed,0);assert.equal(nav.debrisSpeedLimit,400,'stopped position lies inside the maneuvering margin');
  nav.keys.add('KeyW');const stopped=nav.position.clone();nav.update(.025);assert.ok(nav.position.distanceTo(stopped)>0,'same thrust resumes after the entry brake');
  nav.position.copy(beltPoint());nav.flightAssist=false;nav.velocity.set(100000,100000,100000);nav.keys.add('ShiftLeft');nav.update(.025);assert.ok(nav.speed<=400+1e-9);
});
