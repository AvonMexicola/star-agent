import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoverPower} from '../src/rover-power.js';
import {ROVER_LAYOUT as L} from '../src/rover-layout.js';

test('twin cutters last two continuous minutes, require release, then recharge in thirty seconds',()=>{
  const p=createRoverPower();for(let i=0;i<1190;i++)p.step(.1,{trigger:true});
  assert.equal(p.state.active,true);assert.ok(p.state.charge>0);
  for(let i=0;i<10;i++)p.step(.1,{trigger:true});
  assert.equal(p.state.charge,0);assert.equal(p.state.active,false);assert.equal(p.state.depleted,true);
  for(let i=0;i<300;i++)p.step(.1,{trigger:true});assert.equal(p.state.charge,0);
  for(let i=0;i<300;i++)p.step(.1);assert.ok(p.state.charge>.999999);assert.equal(p.state.depleted,false);
  p.step(.1,{trigger:true});assert.equal(p.state.active,true);
});
test('paused, malformed and long frames cannot silently exhaust or recharge a rover battery',()=>{
  const p=createRoverPower();p.step(.2,{trigger:true});const before=p.state.charge;
  p.step(10,{trigger:true,allowed:false});assert.equal(p.state.charge,before);assert.equal(p.state.active,false);
  for(const dt of [NaN,Infinity,-3])p.step(dt,{trigger:true});assert.equal(p.state.charge,before);
  p.step(10,{trigger:true});assert.ok(Math.abs(p.state.charge-(before-.25/L.mining.continuousSeconds))<1e-12);
});

import {Vector3,Quaternion} from 'three';
import {roverLiftMayMove} from '../src/rover-support.js';
import {createRoverPhysics} from '../src/rover-physics.js';
import {RoverCuttingBeam} from '../src/rover-cutting-beam.js';
import {Scene} from 'three';
const frame={position:new Vector3(25e9,2000,3000),quaternion:new Quaternion()};
const world=p=>new Vector3(...p).add(frame.position);
test('the legacy platform guard rejects a straddling or underneath rover but permits fully carried parking',()=>{
  const lift={id:'main',minX:-4,maxX:4,minZ:0,maxZ:10,low:0,high:4};let p=world(L.atlas.park);
  const state={position:p,quaternion:new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI),wheels:Array.from({length:4},()=>({source:'atlas-lift:main'})),speed:0};
  assert.equal(roverLiftMayMove(state,lift,frame),true);
  state.position=world([-1.6,4,9]);assert.equal(roverLiftMayMove(state,lift,frame),false);
  state.position=world([-1.6,0,5]);state.wheels.forEach(w=>w.source='terrain');assert.equal(roverLiftMayMove(state,lift,frame),false);
  state.position=world([-1.6,0,15]);assert.equal(roverLiftMayMove(state,lift,frame),true);
});
test('substep time survives stationary carrier rebasing at 240 Hz',()=>{
  const up=new Vector3(0,1,0),p=createRoverPhysics({sampleSupport:q=>({point:new Vector3(q.x,0,q.z),normal:up,source:'atlas-lift:main'})});
  for(let i=0;i<240;i++){p.setPose(p.state.position,p.state.quaternion,{preserveMotion:true});p.step(1/240,{throttle:1});}
  assert.ok(p.state.distance>1.4);assert.ok(p.state.speed>2.9);
});

test('cutter effects follow real endpoints across a stellar render-origin change and stop without a hit',()=>{
  const scene=new Scene(),beam=new RoverCuttingBeam(scene);
  const start=new Vector3(25e9+.125,300,.5),end=start.clone().add(new Vector3(4,1,-20));
  for(const origin of [new Vector3(25e9,299,0),new Vector3(25e9+3,298,-10)]){
    beam.set(start,end,origin,7,{hit:true,normal:new Vector3(0,1,0)});
    beam.mesh.updateMatrixWorld(true);
    const visualStart=beam.ribbon.localToWorld(new Vector3()).add(origin);
    // The shader places the ribbon's 0..1 longitudinal coordinate on local Z.
    const visualEnd=beam.ribbon.localToWorld(new Vector3(0,0,1)).add(origin);
    assert.ok(visualStart.distanceTo(start)<1e-7);assert.ok(visualEnd.distanceTo(end)<1e-7);
    assert.ok(beam.mesh.position.length()<30);assert.equal(beam.contact.visible,true);
  }
  beam.set(start,end,new Vector3(25e9,0,0),8,{reducedMotion:true});
  assert.equal(beam.contact.visible,false);assert.equal(beam.material.uniforms.time.value,0);
  beam.set(start,start,start,9);assert.equal(beam.mesh.visible,false);
  let disposed=0;for(const resource of [beam.material,beam.glowMaterial,beam.ribbon.geometry,beam.glowGeometry])resource.addEventListener('dispose',()=>disposed++);
  beam.dispose();assert.equal(scene.children.length,0);assert.equal(disposed,4);
});
