import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { stepEVA, constrainEVAShip, canAttachRamp, EVA } from '../src/eva.js';
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z), q=new THREE.Quaternion();
test('EVA thrust and coasting are frame-rate independent in all local axes',()=>{
  const run=(hz,translation,orientation=q)=>{
    let velocity=v(),position=v();
    for(let i=0;i<hz*2;i++){const step=stepEVA(velocity,orientation,translation,1/hz);velocity=step.velocity;position.add(step.displacement);}
    return {position,velocity};
  };
  for(const axis of [v(1),v(0,1),v(0,0,-1),v(1,1,1)]){
    const a=run(30,axis),b=run(144,axis);assert.ok(a.position.distanceTo(b.position)<1e-8);assert.ok(a.velocity.distanceTo(b.velocity)<1e-8);
    assert.ok(a.velocity.length()<=EVA.maxSpeed);
  }
  const rotated=run(60,v(0,0,-1),new THREE.Quaternion().setFromAxisAngle(v(0,1),Math.PI/2));assert.ok(rotated.velocity.x<-6.9);
  const coast=stepEVA(v(1,2,3),q,v(),.2);assert.deepEqual(coast.velocity.toArray(),[1,2,3]);assert.ok(coast.displacement.distanceTo(v(.2,.4,.6))<1e-9);
});
test('EVA brake is exponential, overrides thrust and speed cap contains boosted flight',()=>{
  let velocity=v();for(let i=0;i<1000;i++)velocity=stepEVA(velocity,q,v(1,1,1),.1,{boost:true}).velocity;
  assert.ok(velocity.length()<=EVA.boostSpeed+1e-9);
  const brake=stepEVA(velocity,q,v(1,1,1),.2,{brake:true});assert.ok(Math.abs(brake.velocity.length()-velocity.length()*Math.exp(-1.2))<1e-9);
});
test('EVA ship collision blocks high-speed hull crossings and admits only the open rear hatch',()=>{
  assert.ok(constrainEVAShip(v(0,2.75,8),v(0,2.75,2),false).hit);
  assert.equal(constrainEVAShip(v(0,2.75,8),v(0,2.75,2),true).hit,false);
  assert.ok(constrainEVAShip(v(10,2.75,0),v(0,2.75,0),true).hit);
  assert.ok(constrainEVAShip(v(0,10,0),v(0,2.75,0),true).hit);
  assert.equal(constrainEVAShip(v(-10,10,0),v(10,10,0),false).hit,false,'cabin walls do not extend infinitely into space');
  assert.equal(canAttachRamp(v(0,1.85,7),true,2),true);
  assert.equal(canAttachRamp(v(0,1.85,7),true,10),false);
  assert.equal(canAttachRamp(v(0,1.85,7),false,2),false);
  assert.equal(canAttachRamp(v(0,10,7),true,2),false);
});
