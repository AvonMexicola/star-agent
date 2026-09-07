import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion,Euler} from 'three';
import {Navigation} from '../src/navigation.js';
import {ringSurveyPoint} from '../src/mining/field.js';
const up=new Vector3(0,1,0),forward=new Vector3(0,0,-1);
function setup(t){
  const oldDocument=Object.getOwnPropertyDescriptor(globalThis,'document'),oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),events={addEventListener(){}};
  Object.defineProperty(globalThis,'document',{configurable:true,value:{...events,querySelector:()=>null,body:{classList:{toggle(){}}}}});Object.defineProperty(globalThis,'window',{configurable:true,value:events});
  t.after(()=>{if(oldDocument)Object.defineProperty(globalThis,'document',oldDocument);else delete globalThis.document;if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else delete globalThis.window;});
  const nav=new Navigation(events,()=>{}),pad={id:'Xbox space steering',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
  nav.gamepad.read=()=>[pad];
  const reset=()=>{pad.axes.fill(0);nav.orbit();nav.position.copy(ringSurveyPoint()).add(new Vector3(0,0,42));nav.orientToward(ringSurveyPoint(),up);nav.update(0);};reset();return {nav,pad,reset};
}

test('Xbox horizontal stick yaws the ship sideways in Ring Survey, radial and rolled space attitudes',t=>{
  const {nav,pad,reset}=setup(t);
  for(const attitude of ['survey','radial','rolled'])for(const input of [-1,1]){
    reset();if(attitude==='radial')nav.orientToward(nav.position.clone().add(nav.normal),up);
    if(attitude==='rolled')nav.orientation.setFromEuler(new Euler(.8,-1.2,1.1));
    const before=nav.orientation.clone(),inverse=before.clone().invert(),beforeUp=up.clone().applyQuaternion(before);
    pad.axes[2]=input;for(let frame=0;frame<20;frame++)nav.update(.025);
    const nose=forward.clone().applyQuaternion(nav.orientation).applyQuaternion(inverse);
    assert.ok(nose.x*input>.4,`${attitude}: horizontal input moves nose in the requested screen direction`);
    assert.ok(Math.abs(nose.y)<1e-8,`${attitude}: pure yaw adds no pitch`);
    assert.ok(beforeUp.distanceTo(up.clone().applyQuaternion(nav.orientation))<1e-8,`${attitude}: pure yaw adds no roll`);
  }
});

test('Xbox vertical stick pitches around ship right, and mouse look uses the same local axes',t=>{
  const {nav,pad,reset}=setup(t);
  for(const input of [-1,1]){
    reset();nav.orientation.setFromEuler(new Euler(1.1,.7,-.9));const inverse=nav.orientation.clone().invert();
    pad.axes[3]=input;for(let frame=0;frame<20;frame++)nav.update(.025);
    const nose=forward.clone().applyQuaternion(nav.orientation).applyQuaternion(inverse);
    assert.ok(nose.y*(-input)>.4);assert.ok(Math.abs(nose.x)<1e-8);
  }
  reset();nav.orientation.setFromEuler(new Euler(.6,-.5,1.2));const expected=nav.orientation.clone().multiply(new Quaternion().setFromAxisAngle(up,-.2)).multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.1));
  nav.look(-.2,.1);assert.ok(nav.orientation.angleTo(expected)<1e-7);
});

test('space travel does not rotate the ship toward lunar gravity and inertial controller torque remains local',t=>{
  const {nav,pad,reset}=setup(t);const before=nav.orientation.clone();nav.velocity.set(200,0,0);const position=nav.position.clone();
  for(let frame=0;frame<20;frame++)nav.update(.025);
  assert.ok(nav.position.distanceTo(position)>20);assert.ok(nav.orientation.angleTo(before)<1e-7,'translation alone preserves space attitude');
  reset();nav.flightAssist=false;nav.orientToward(nav.position.clone().add(nav.normal),up);const inverse=nav.orientation.clone().invert();pad.axes[2]=1;
  for(let frame=0;frame<20;frame++)nav.update(.025);
  const nose=forward.clone().applyQuaternion(nav.orientation).applyQuaternion(inverse);assert.ok(nose.x>.15);assert.ok(Math.abs(nose.y)<1e-7);assert.ok(nav.angularVelocity.y<-.7);
});

test('ground walking still yaws around gravity and clamps pitch',t=>{
  const {nav,reset}=setup(t);reset();nav.transitMoon(2);nav.mode='walk';nav.orientation.setFromEuler(new Euler(.3,.5,.7));
  const normal=nav.normal,before=nav.orientation.clone(),expected=new Quaternion().setFromAxisAngle(normal,.25).multiply(before);
  nav.look(.25,0);assert.ok(nav.orientation.angleTo(expected)<1e-7);
  nav.orientToward(nav.position.clone().add(new Vector3(1,0,0).projectOnPlane(normal)),normal);
  for(let frame=0;frame<200;frame++)nav.look(0,.04);
  assert.ok(Math.abs(forward.clone().applyQuaternion(nav.orientation).dot(normal))<=.985+1e-8);
});

test('Xbox triggers translate assisted space flight along ship up/down after rolling',t=>{
  const {nav,pad,reset}=setup(t);
  for(const attitude of ['survey','rolled'])for(const [button,sign] of [[7,1],[6,-1]]){
    pad.buttons.forEach(button=>{button.pressed=false;button.value=0;});reset();
    if(attitude==='rolled')nav.orientation.setFromEuler(new Euler(.7,-.9,1.3));
    const shipUp=up.clone().applyQuaternion(nav.orientation),before=nav.position.clone();
    pad.buttons[button]={pressed:true,value:1};
    for(let frame=0;frame<20;frame++)nav.update(.025);
    const movement=nav.position.clone().sub(before);
    assert.ok(movement.dot(shipUp)*sign>2,`${attitude}: trigger moves along ship-local vertical`);
    assert.ok(movement.clone().projectOnPlane(shipUp).length()<1e-6,'vertical thrust adds no sideways translation');
    assert.ok(nav.velocity.clone().normalize().dot(shipUp)*sign>.999999);
  }
});

test('assisted atmospheric vertical thrust retains radial ascent after rolling the ship',t=>{
  const {nav,pad,reset}=setup(t);reset();nav.transit([0,1,0],1000);nav.orientation.setFromEuler(new Euler(.5,.7,1.2));
  const radial=nav.normal,start=nav.position.clone();pad.buttons[7]={pressed:true,value:1};
  for(let frame=0;frame<20;frame++)nav.update(.025);
  assert.equal(nav.flightEnvironment.regime,'ATMOSPHERE');
  const movement=nav.position.clone().sub(start);assert.ok(movement.dot(radial)>2);assert.ok(movement.clone().projectOnPlane(radial).length()<1e-6);
});

test('holding Xbox brake still allows yaw/pitch/roll while blocking thrust and inertial spin',t=>{
  const {nav,pad,reset}=setup(t);
  for(const assist of [true,false]){
    pad.buttons.forEach(button=>{button.pressed=false;button.value=0;});reset();nav.flightAssist=assist;
    nav.velocity.set(100,200,300);nav.angularVelocity.set(1,2,3);const position=nav.position.clone(),before=nav.orientation.clone();
    pad.buttons[1]={pressed:true,value:1};pad.buttons[7]={pressed:true,value:1};pad.buttons[10]={pressed:true,value:1};pad.axes[1]=-1;pad.axes[2]=1;
    for(let frame=0;frame<20;frame++)nav.update(.025);
    const nose=forward.clone().applyQuaternion(nav.orientation).applyQuaternion(before.clone().invert());
    assert.ok(nose.x>.4,'braked ship yaws at normal manual rate');assert.ok(nav.position.distanceTo(position)>100,'brakes preserve translation while reducing speed');
    assert.ok(nav.speed>300&&nav.speed<Math.hypot(100,200,300));assert.equal(nav.angularVelocity.length(),0);assert.equal(nav.boost,false);
    pad.axes[2]=0;pad.axes[3]=-1;const yawed=nav.orientation.clone();for(let frame=0;frame<20;frame++)nav.update(.025);
    assert.ok(forward.clone().applyQuaternion(nav.orientation).applyQuaternion(yawed.clone().invert()).y>.4,'braked ship pitches');
    pad.axes[3]=0;pad.buttons[4]={pressed:true,value:1};const pitched=nav.orientation.clone();for(let frame=0;frame<20;frame++)nav.update(.025);
    assert.ok(nav.orientation.angleTo(pitched)>.39,'braked ship rolls');assert.ok(nav.position.distanceTo(position)>100);
    const rolled=nav.orientation.clone();nav.look(-.2,0);assert.ok(nav.orientation.angleTo(rolled)>.19,'mouse look also remains available under held brake');
    pad.buttons.forEach(button=>{button.pressed=false;button.value=0;});pad.axes.fill(0);const final=nav.orientation.clone();nav.update(.025);
    assert.ok(nav.orientation.angleTo(final)<1e-7,'releasing brake does not resume discarded angular drift');assert.equal(nav.angularVelocity.length(),0);
  }
});
