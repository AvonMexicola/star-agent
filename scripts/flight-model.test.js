import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Quaternion } from 'three';
import { FLIGHT, environmentAt, aerodynamics, step } from '../src/flight-model.js';
import { Navigation } from '../src/navigation.js';
import { RADIUS } from '../src/world.js';

const state = () => ({ velocity: new Vector3(), orientation: new Quaternion(), angularVelocity: new Vector3() });
const vacuum = { density: 0, gravity: new Vector3() };
const near = (a,b,eps=1e-8) => assert.ok(Math.abs(a-b)<eps, `${a} != ${b}`);

test('vacuum coasting preserves world momentum and does not mutate input', () => {
  const initial = state(); initial.velocity.set(120,-35,900); initial.angularVelocity.set(.1,.2,-.3);
  const saved = structuredClone(initial);
  let next = initial;
  for(let i=0;i<600;i++) next=step(next,{},vacuum,1/60);
  assert.deepEqual(next.velocity,initial.velocity);
  assert.deepEqual(next.angularVelocity,initial.angularVelocity);
  assert.deepEqual(structuredClone(initial),saved);
  near(next.orientation.length(),1);
  assert.ok(next.orientation.angleTo(initial.orientation)>.1);
  assert.deepEqual(step(initial,{},vacuum,0),{...initial,engineAcceleration:new Vector3(),...aerodynamics(initial.velocity,initial.orientation,0)});
  assert.throws(()=>step(initial,{},vacuum,NaN),RangeError);
});

test('RCS acts on all ship axes, including after a 90 degree rotation', () => {
  for(const axis of [new Vector3(1,0,0),new Vector3(0,1,0),new Vector3(0,0,-1)]) {
    const initial=state();initial.orientation.setFromAxisAngle(new Vector3(0,1,0),Math.PI/2);
    const actual=step(initial,{translation:axis},vacuum,1).velocity;
    const expected=axis.clone().multiplyScalar(axis.z?FLIGHT.thrustAcceleration:FLIGHT.rcsAcceleration).applyQuaternion(initial.orientation);
    near(actual.distanceTo(expected),0);
  }
  const spun=step(state(),{rotation:new Vector3(0,1,0)},vacuum,1);
  near(spun.angularVelocity.y,FLIGHT.angularAcceleration);
  assert.ok(spun.orientation.angleTo(new Quaternion())>.5);
});

test('density and force approach zero continuously at 70 km; gravity follows inverse square', () => {
  const env=h=>environmentAt(new Vector3(0,RADIUS+h,0),RADIUS);
  assert.equal(env(0).regime,'ATMOSPHERE');assert.equal(env(20000).regime,'TRANSITION');assert.equal(env(70000).regime,'SPACE');
  near(env(45000).atmosphereFraction,.5);
  near(env(0).density,FLIGHT.seaLevelDensity);
  assert.ok(env(69999).density<1e-10);assert.equal(env(70000).density,0);assert.equal(env(100000).density,0);
  near(env(RADIUS).gravity.length(),FLIGHT.surfaceGravity/4);
  const falling=step(state(),{},env(100000),1);
  near(falling.velocity.y,env(100000).gravity.y);
});

test('wings lose lift past stall AoA and bank the lift vector', () => {
  const velocityFor=angle=>new Vector3(0,-200*Math.sin(angle),-200*Math.cos(angle));
  const attached=aerodynamics(velocityFor(.25),new Quaternion(),1.225);
  const separated=aerodynamics(velocityFor(.65),new Quaternion(),1.225);
  assert.ok(attached.liftCoefficient>separated.liftCoefficient*2);
  assert.equal(attached.stalled,false);assert.equal(separated.stalled,true);
  assert.equal(aerodynamics(new Vector3(0,0,-25),new Quaternion(),1.225).stalled,true);
  near(attached.liftAcceleration.dot(velocityFor(.25)),0,1e-6);
  const bank=new Quaternion().setFromAxisAngle(new Vector3(0,0,-1),Math.PI/2);
  const banked=aerodynamics(velocityFor(.25).applyQuaternion(bank),bank,1.225);
  near(banked.liftAcceleration.distanceTo(attached.liftAcceleration.clone().applyQuaternion(bank)),0,1e-6);
});

test('quadratic drag converges to terminal speed without energy gain or reversal', () => {
  const env={density:1.225,gravity:new Vector3(0,-9.81,0)};
  const expected=Math.sqrt(9.81/(.5*env.density*FLIGHT.wingArea*FLIGHT.dragCoefficient/FLIGHT.mass));
  let falling=state();
  for(let i=0;i<120*60;i++)falling=step(falling,{},env,1/60);
  near(falling.velocity.length(),expected,.1);
  let fast=state();fast.velocity.set(0,-100000,-200000);
  for(let i=0;i<30;i++) {
    const next=step(fast,{}, {...env,gravity:new Vector3()},1/30);
    assert.ok(next.velocity.length()<=fast.velocity.length());
    assert.ok(Number.isFinite(next.velocity.length())); fast=next;
  }
});

test('integration is stable across simulation rates and assist brakes explicitly', () => {
  const simulate=dt=>{
    let s=state();s.velocity.set(0,-20,-180);
    for(let i=0;i<Math.round(2/dt);i++)s=step(s,{translation:new Vector3(0,0,-1)}, {density:.4,gravity:new Vector3(0,-9.81,0)},dt);
    return s;
  };
  near(simulate(1/30).velocity.distanceTo(simulate(1/120).velocity),0,1e-6);
  const initial=state();initial.velocity.set(100,0,0);
  near(step(initial,{assist:true},vacuum,1).velocity.x,100*Math.exp(-3.5));
});

test('V toggles inertial navigation, preserves coasting and gates changes while landed', t => {
  const oldDocument=globalThis.document,oldWindow=globalThis.window,listeners={};
  globalThis.document={addEventListener(type,fn){listeners[type]=fn;},querySelector(){return null;},body:{classList:{toggle(){}}}};
  globalThis.window={addEventListener(){}};
  t.after(()=>{globalThis.document=oldDocument;globalThis.window=oldWindow;});
  const nav=new Navigation({addEventListener(){}},()=>{});
  const press=code=>{listeners.keydown({code,preventDefault(){}});listeners.keyup({code});};
  nav.position.set(0,RADIUS+100000,0);nav.orientation.identity();nav.velocity.set(120,0,-300);
  press('KeyV');assert.equal(nav.flightAssist,false);
  const before=nav.position.clone();nav.update(1/60);
  near(nav.velocity.x,120);near(nav.velocity.z,-300);assert.ok(nav.velocity.y<0);
  assert.ok(nav.position.distanceTo(before)>0);near(nav.orientation.angleTo(new Quaternion()),0);
  nav.keys.add('ArrowLeft');nav.update(1/60);nav.keys.clear();
  assert.ok(nav.angularVelocity.y>0);
  press('KeyX');near(nav.speed,0);near(nav.angularVelocity.length(),0);
  nav.velocity.set(120,0,0);press('KeyV');nav.update(1/60);assert.ok(nav.velocity.x<120);
  nav.mode='landed';press('KeyV');assert.equal(nav.flightAssist,true);
  // Landing automation must stop rotation, not hide it until L is cancelled.
  nav.mode='flight';nav.flightAssist=false;nav.position.set(0,RADIUS+5000,0);nav.angularVelocity.set(0,1,0);
  press('KeyB');assert.equal(nav.autoland,true);near(nav.angularVelocity.length(),0);
  nav.update(1/60);press('KeyB');assert.equal(nav.autoland,false);
  const attitude=nav.orientation.clone();nav.update(1/60);near(nav.orientation.angleTo(attitude),0);
  nav.station={ready:true,worldPosition:nav.position.clone(),canDock:()=>true};nav.angularVelocity.set(0,1,0);
  press('KeyB');assert.equal(nav.autoland,true);near(nav.angularVelocity.length(),0);
  nav.station=null;nav.autoland=false;
  // The new force path must cross the atmosphere without a transit or state reset.
  nav.mode='flight';nav.flightAssist=false;nav.toggleGear();for(let i=0;i<120;i++)nav.update(1/60);assert.equal(nav.gearLimited,false);nav.position.set(0,RADIUS+70010,0);nav.velocity.set(0,-300,0);
  nav.transit=nav.orbit=()=>assert.fail('inertial descent invoked a teleport');
  assert.equal(nav.flightEnvironment.regime,'SPACE');
  for(let i=0;i<120;i++){
    const previous=nav.position.clone();nav.update(1/60);
    assert.ok(nav.position.distanceTo(previous)<6);
    assert.equal(nav.mode,'flight');assert.equal(nav.flightAssist,false);
  }
  assert.equal(nav.flightEnvironment.regime,'TRANSITION');
  assert.ok(nav.flightEnvironment.density>0);assert.ok(nav.velocity.y<-300);
});
