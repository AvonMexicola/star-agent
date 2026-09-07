import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SHIP_LAYOUT} from '../src/boarding.js';
import {FREIGHTER_LAYOUT} from '../src/freighter-layout.js';
import {capturePeerMotion,createRammingResolver,sweptBoxes,sweptSuit,segmentBoxDistance} from '../server/ramming.js';

const base=new THREE.Vector3(25_000_000_000,1_900_000,0),bounds={min:[-1,-1,-1],max:[1,1,1]};
const pose=(x,z=0,extra={})=>({position:base.clone().add(new THREE.Vector3(x,0,z)),rotation:new THREE.Quaternion(),bounds,...extra});
const near=(a,b,tolerance=1e-5)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
function pilot(id,x,layout={...SHIP_LAYOUT,flightBounds:bounds}) {
  return {id,account:{id},health:100,shipHealth:100,nav:{mode:'flight',layout,shipId:'nomad',position:base.clone().add(new THREE.Vector3(x,0,0)).add(new THREE.Vector3(...layout.seatEye)),
    orientation:new THREE.Quaternion(),shipOrientation:new THREE.Quaternion(),velocity:new THREE.Vector3(),shipVelocity:new THREE.Vector3(),angularVelocity:new THREE.Vector3(),shipAngularVelocity:new THREE.Vector3()}};
}

test('swept OBB contact catches complete high-speed tunnelling in doubles',()=>{
  const hit=sweptBoxes(pose(-50),pose(50),pose(0),pose(0));
  near(hit.time,.48);assert.deepEqual(hit.normal.toArray(),[1,0,0]);assert.equal(hit.initialOverlap,false);
  assert.equal(sweptBoxes(pose(-50,2.001),pose(50,2.001),pose(0),pose(0)),null);
});

test('rotated canonical Atlas and Nomad hulls retain their own dimensions',()=>{
  const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2);
  const a0=pose(-100,0,{bounds:FREIGHTER_LAYOUT.flightBounds,rotation}),a1=pose(100,0,{bounds:FREIGHTER_LAYOUT.flightBounds,rotation});
  const b=pose(0,0,{bounds:SHIP_LAYOUT.flightBounds});
  const hit=sweptBoxes(a0,a1,b,b);
  assert.ok(hit.time>.3&&hit.time<.5);
  assert.equal(sweptBoxes({...a0,position:a0.position.clone().add(new THREE.Vector3(0,50,0))},{...a1,position:a1.position.clone().add(new THREE.Vector3(0,50,0))},b,b),null);
});

test('parallel co-motion and separating contact do not manufacture ram damage',()=>{
  const a=pilot('a',-5),b=pilot('b',5),players=new Map([[a.id,a],[b.id,b]]),before=capturePeerMotion(players),events=[];
  a.nav.position.x+=100;b.nav.position.x+=100;
  createRammingResolver().step(players,before,1,e=>events.push(e));assert.deepEqual(events,[]);
  const overlapping=sweptBoxes(pose(0),pose(-5),pose(1),pose(1));assert.equal(overlapping.initialOverlap,true);
});

test('stationary hulls cannot be blamed when a walker enters them',()=>{
  const hull=pilot('h',0),walker=pilot('w',3);walker.nav.mode='walk';walker.nav.position.copy(base).add(new THREE.Vector3(3,.75,0));walker.nav.normal=new THREE.Vector3(0,1,0);
  const players=new Map([[hull.id,hull],[walker.id,walker]]),before=capturePeerMotion(players),events=[];
  walker.nav.position.x-=4;
  createRammingResolver().step(players,before,.2,e=>events.push(e));assert.deepEqual(events,[]);assert.equal(hull.shipHealth,100);
});

test('true capsule sweep catches ship/suit impact without filling rounded head corners',()=>{
  const suit={position:base.clone().add(new THREE.Vector3(0,.75,0)),up:new THREE.Vector3(0,1,0)};
  const hit=sweptSuit(pose(-10),pose(10),suit,suit);
  near(hit.time,.4375);near(hit.normal.x,1);
  const tiny={min:[-.01,-.01,-.01],max:[.01,.01,.01]};
  const eye={position:base.clone(),up:new THREE.Vector3(0,1,0)};
  const a=pose(.24,-2,{bounds:tiny});a.position.y+=.18;
  const b={...a,position:a.position.clone().add(new THREE.Vector3(0,0,4))};
  assert.equal(sweptSuit(a,b,eye,eye),null);
  near(segmentBoxDistance(new THREE.Vector3(2,0,0),new THREE.Vector3(2,3,0),bounds).distance,1);
});

test('a ram is attributed to closing ships, stops penetration and reports one incident',()=>{
  const a=pilot('a',-20),b=pilot('b',0),players=new Map([[a.id,a],[b.id,b]]),resolver=createRammingResolver(),events=[];
  const before=capturePeerMotion(players);a.nav.position.x+=40;a.nav.velocity.set(1200,0,0);
  resolver.step(players,before,1/30,e=>events.push(e));
  assert.equal(events.length,1);assert.equal(events[0].attacker,a);assert.equal(events[0].victim,b);assert.equal(events[0].damage,100);
  assert.ok(a.nav.position.x<base.x-2);assert.equal(a.nav.velocity.length(),0);
  // Keep pressing against the same contact. The persistent pair cannot deal a
  // fresh damage transaction every frame, even when a client keeps its intent.
  const next=capturePeerMotion(players);a.nav.position.x+=10;
  resolver.step(players,next,1/30,e=>events.push(e));assert.equal(events.length,1);
});

test('head-on ships can both initiate harmful contact; slow docking does no damage',()=>{
  for(const speed of [2,20]) {
    const a=pilot('a',-3),b=pilot('b',3),players=new Map([[a.id,a],[b.id,b]]),before=capturePeerMotion(players),events=[];
    a.nav.position.x+=speed;b.nav.position.x-=speed;
    createRammingResolver().step(players,before,1,e=>events.push(e));
    assert.equal(events.length,speed===2?0:2);
    if(events.length)assert.deepEqual(new Set(events.map(e=>e.attacker.id)),new Set(['a','b']));
  }
});

test('an enclosed passenger is not a ram victim of their carrier',()=>{
  const a=pilot('a',0,FREIGHTER_LAYOUT),b=pilot('b',0);b.nav.mode='walk';b.nav.position.copy(base).add(new THREE.Vector3(0,5.75,3));b.nav.normal=new THREE.Vector3(0,1,0);
  const players=new Map([[a.id,a],[b.id,b]]),before=capturePeerMotion(players),events=[];
  a.nav.position.x+=100;b.nav.position.x+=100;
  createRammingResolver().step(players,before,1/30,e=>events.push(e));assert.deepEqual(events,[]);
});
