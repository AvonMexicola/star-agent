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
import {FreighterSystems} from '../src/freighter-layout.js';
import {sampleRoverSupport,roverLiftMayMove} from '../src/rover-support.js';
import {createRoverPhysics} from '../src/rover-physics.js';
const frame={position:new Vector3(25e9,2000,3000),quaternion:new Quaternion()};
const world=p=>new Vector3(...p).add(frame.position);
test('rover support agrees with all three actual Atlas lifts and never fills a raised lift hole',()=>{
  const freighter=new FreighterSystems(),query=p=>sampleRoverSupport(world(p),{freighter,frame});
  assert.equal(query([0,4,5]).source,'atlas-lift:main');
  assert.equal(query([4.8,4,-4.5]).source,'atlas-lift:starboard');
  assert.equal(query([-4.8,4,-4.5]).source,'atlas-lift:port');
  const side=freighter.lifts.find(l=>l.id==='starboard');side.y=7;side.target=7;
  assert.equal(query([4.8,4,-4.5]),null);assert.equal(query([4.8,7,-4.5]).source,'atlas-lift:starboard');
  assert.equal(query([0,4,-3]).source,'atlas-deck');assert.equal(query([0,3,5]),null);
});
test('every lift caller rejects a straddling or underneath rover, while fully carried parking and a clear platform work',()=>{
  const f=new FreighterSystems(),lift=f.lifts[0];let p=world(L.atlas.park);
  const state={position:p,quaternion:new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI),wheels:Array.from({length:4},()=>({source:'atlas-lift:main'})),speed:0};
  f.canMove=l=>roverLiftMayMove(state,l,frame);
  assert.equal(f.toggle('main',new Vector3(0,5.75,-1)),true);lift.target=lift.y;
  state.position=world([-1.6,4,9]);assert.equal(f.toggle('main',new Vector3(0,5.75,-1)),false);
  state.position=world([-1.6,0,5]);state.wheels.forEach(w=>w.source='terrain');assert.equal(f.toggle('main',null),false);
  state.position=world([-1.6,0,15]);assert.equal(f.toggle('main',null),true);
});
test('substep time survives stationary carrier rebasing at 240 Hz',()=>{
  const up=new Vector3(0,1,0),p=createRoverPhysics({sampleSupport:q=>({point:new Vector3(q.x,0,q.z),normal:up,source:'atlas-lift:main'})});
  for(let i=0;i<240;i++){p.setPose(p.state.position,p.state.quaternion,{preserveMotion:true});p.step(1/240,{throttle:1});}
  assert.ok(p.state.distance>1.4);assert.ok(p.state.speed>2.9);
});
