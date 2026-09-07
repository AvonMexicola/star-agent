import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SHIP_LAYOUT} from '../src/boarding.js';
import {FREIGHTER_LAYOUT} from '../src/freighter-layout.js';
import {capturePeerMotion,createRammingResolver,sweptBoxes,sweptSuit,segmentBoxDistance,boxSeparation} from '../server/ramming.js';
import {shipPose} from '../server/combat.js';
import {createStationSecurity} from '../server/security.js';

const base=new THREE.Vector3(25_000_000_000,1_900_000,0),bounds={min:[-1,-1,-1],max:[1,1,1]};
const pose=(x,z=0,extra={})=>({position:base.clone().add(new THREE.Vector3(x,0,z)),rotation:new THREE.Quaternion(),bounds,...extra});
const near=(a,b,tolerance=1e-5)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
function pilot(id,x,layout={...SHIP_LAYOUT,flightBounds:bounds}) {
  return {id,account:{id},health:100,shipHealth:100,nav:{mode:'flight',layout,shipId:'nomad',position:base.clone().add(new THREE.Vector3(x,0,0)).add(new THREE.Vector3(...layout.seatEye)),
    orientation:new THREE.Quaternion(),shipOrientation:new THREE.Quaternion(),velocity:new THREE.Vector3(),shipVelocity:new THREE.Vector3(),angularVelocity:new THREE.Vector3(),shipAngularVelocity:new THREE.Vector3()}};
}
const UP=new THREE.Vector3(0,1,0),identity=new THREE.Quaternion();
const tiny={min:[-.02,-.02,-.02],max:[.02,.02,.02]};
function placeHull(player,root,rotation=identity) {
  player.nav.orientation.copy(rotation);
  player.nav.position.copy(root).add(new THREE.Vector3(...player.nav.layout.seatEye).applyQuaternion(rotation));
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

test('captured flight and parked attitudes remain immutable across navigation mutation',()=>{
  const flight=pilot('flight',0),parked=pilot('parked',40);
  parked.nav.mode='walk';parked.nav.shipPosition=base.clone().add(new THREE.Vector3(40,0,0));
  const players=new Map([[flight.id,flight],[parked.id,parked]]),before=capturePeerMotion(players);
  assert.notEqual(before.get(flight.id).hull.rotation,flight.nav.orientation);
  assert.notEqual(before.get(parked.id).hull.rotation,parked.nav.shipOrientation);
  flight.nav.orientation.setFromAxisAngle(UP,.25);parked.nav.shipOrientation.setFromAxisAngle(UP,-.4);
  near(before.get(flight.id).hull.rotation.angleTo(identity),0);
  near(before.get(parked.id).hull.rotation.angleTo(identity),0);
});

test('a real Nomad rotation contacts a previously clear hull and stops its angular motion',()=>{
  // The old padded-midpoint test called this an initial overlap, even though
  // the actual start has a 4 cm gap. Exercise it at both local and stellar roots.
  const results=[];
  for(const origin of [new THREE.Vector3(),base]) {
    const a=pilot('a',0,SHIP_LAYOUT),b=pilot('b',0,{...SHIP_LAYOUT,flightBounds:tiny});
    placeHull(a,origin);placeHull(b,origin.clone().add(new THREE.Vector3(-6.11,2.14,-5)));
    const players=new Map([[a.id,a],[b.id,b]]),before=capturePeerMotion(players),events=[];
    const victim=shipPose(b),start=before.get(a.id).hull;
    assert.equal(sweptBoxes(start,start,victim,victim),null);
    placeHull(a,origin,new THREE.Quaternion().setFromAxisAngle(UP,.02));
    a.nav.angularVelocity.set(0,1.2,0);a.nav.shipAngularVelocity.copy(a.nav.angularVelocity);
    a.nav.travel={phase:'cruise'};
    const end=shipPose(a);assert.equal(sweptBoxes(end,end,victim,victim)?.initialOverlap,true);
    createRammingResolver().step(players,before,1/60,event=>events.push(event));
    assert.equal(events.length,1);assert.equal(events[0].attacker,a);assert.equal(events[0].victim,b);
    assert.ok(events[0].closingSpeed>5);assert.ok(events[0].damage>1);
    const clipped=shipPose(a),angle=clipped.rotation.angleTo(identity);
    assert.ok(angle>0&&angle<.02);assert.equal(sweptBoxes(clipped,clipped,victim,victim),null);
    assert.equal(a.nav.angularVelocity.length(),0);assert.equal(a.nav.shipAngularVelocity.length(),0);
    assert.equal(a.nav.travel,null);assert.ok(clipped.position.distanceTo(origin)<1e-5);
    results.push({angle,speed:events[0].closingSpeed});
  }
  near(results[0].angle,results[1].angle,1e-5);near(results[0].speed,results[1].speed,1e-3);
});

test('angular near misses and exits from exact initial overlaps remain free',()=>{
  for(const [offset,yaw,initialOverlap] of [[[-6.21,2.14,-5],.02,false],[[-6.04,2.14,-5],-.02,true]]) {
    const a=pilot('a',0,SHIP_LAYOUT),b=pilot('b',0,{...SHIP_LAYOUT,flightBounds:tiny});
    placeHull(a,base);placeHull(b,base.clone().add(new THREE.Vector3(...offset)));
    const players=new Map([[a.id,a],[b.id,b]]),before=capturePeerMotion(players),events=[];
    const start=before.get(a.id).hull,victim=shipPose(b);
    assert.equal(Boolean(sweptBoxes(start,start,victim,victim)?.initialOverlap),initialOverlap);
    const endRotation=new THREE.Quaternion().setFromAxisAngle(UP,yaw);placeHull(a,base,endRotation);
    const end=shipPose(a);assert.equal(sweptBoxes(end,end,victim,victim),null);
    a.nav.angularVelocity.set(0,yaw*60,0);
    createRammingResolver().step(players,before,1/60,event=>events.push(event));
    assert.deepEqual(events,[]);near(a.nav.orientation.angleTo(endRotation),0);
    near(a.nav.angularVelocity.y,yaw*60);
  }
});

test('angular sweep catches a corner crossing even when both endpoint hulls are clear',()=>{
  const a=pilot('a',0,{...SHIP_LAYOUT,flightBounds:{min:[-1,-1,-5],max:[1,1,5]}}),b=pilot('b',0,{...SHIP_LAYOUT,flightBounds:tiny});
  placeHull(a,base);placeHull(b,base.clone().add(new THREE.Vector3(-3,0,-3)));
  const players=new Map([[a.id,a],[b.id,b]]),before=capturePeerMotion(players),events=[];
  const victim=shipPose(b),start=shipPose(a);assert.equal(sweptBoxes(start,start,victim,victim),null);
  placeHull(a,base,new THREE.Quaternion().setFromAxisAngle(UP,Math.PI/2));
  const end=shipPose(a);assert.equal(sweptBoxes(end,end,victim,victim),null);
  createRammingResolver().step(players,before,.2,event=>events.push(event));
  assert.equal(events.length,1);assert.equal(events[0].attacker,a);
  assert.ok(a.nav.orientation.angleTo(identity)>0&&a.nav.orientation.angleTo(identity)<Math.PI/4);
  const clipped=shipPose(a);assert.equal(sweptBoxes(clipped,clipped,victim,victim),null);
});

test('a gentle angular contact stops rotation without causing a security incident',()=>{
  const a=pilot('a',0,SHIP_LAYOUT),b=pilot('b',0,{...SHIP_LAYOUT,flightBounds:tiny});
  placeHull(a,base);placeHull(b,base.clone().add(new THREE.Vector3(-6.11,2.14,-5)));
  const players=new Map([[a.id,a],[b.id,b]]),before=capturePeerMotion(players),events=[];
  placeHull(a,base,new THREE.Quaternion().setFromAxisAngle(UP,.02));a.nav.angularVelocity.set(0,.02,0);
  createRammingResolver().step(players,before,1,event=>events.push(event));
  assert.deepEqual(events,[]);assert.ok(a.nav.orientation.angleTo(identity)<.02);assert.equal(a.nav.angularVelocity.length(),0);
});

test('rotating hull edge hits a real suit capsule without blaming the stationary walker',()=>{
  const a=pilot('a',0,SHIP_LAYOUT),walker=pilot('walker',0);
  placeHull(a,base);walker.nav.mode='walk';walker.nav.normal=UP.clone();
  walker.nav.position.copy(base).add(new THREE.Vector3(-6.34,2.8,-5));
  const players=new Map([[a.id,a],[walker.id,walker]]),before=capturePeerMotion(players),events=[];
  placeHull(a,base,new THREE.Quaternion().setFromAxisAngle(UP,.02));
  a.nav.angularVelocity.set(0,1.2,0);
  const originalEye=walker.nav.position.clone();
  createRammingResolver().step(players,before,1/60,event=>events.push(event));
  assert.equal(events.length,1);assert.equal(events[0].kind,'player');assert.equal(events[0].attacker,a);
  assert.equal(events[0].victim,walker);assert.ok(events[0].closingSpeed>5);
  assert.ok(a.nav.orientation.angleTo(identity)<.02);assert.equal(a.nav.angularVelocity.length(),0);
  assert.deepEqual(walker.nav.position.toArray(),originalEye.toArray());
});

test('clipping a moving cabin keeps its occupant position and orientation in the ship frame',()=>{
  const a=pilot('a',0,SHIP_LAYOUT),b=pilot('b',0,{...SHIP_LAYOUT,flightBounds:tiny});
  const localEye=new THREE.Vector3(.6,2.4,-1),localRotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(.1,-.4,.05));
  a.nav.mode='walk';a.nav.cabinFlight=true;a.nav.shipPosition=base.clone();
  a.nav.position.copy(base).add(localEye);a.nav.orientation.copy(localRotation);
  placeHull(b,base.clone().add(new THREE.Vector3(-6.11,2.14,-5)));
  const players=new Map([[a.id,a],[b.id,b]]),before=capturePeerMotion(players),events=[];
  a.nav.shipPosition.add(new THREE.Vector3(.01,0,0));a.nav.shipOrientation.setFromAxisAngle(UP,.02);
  a.nav.position.copy(localEye).applyQuaternion(a.nav.shipOrientation).add(a.nav.shipPosition);
  a.nav.orientation.copy(a.nav.shipOrientation).multiply(localRotation);
  a.nav.shipVelocity.set(.6,0,0);a.nav.velocity.copy(a.nav.shipVelocity);
  a.nav.shipAngularVelocity.set(0,1.2,0);a.nav.angularVelocity.copy(a.nav.shipAngularVelocity);
  createRammingResolver().step(players,before,1/60,event=>events.push(event));
  assert.equal(events.length,1);assert.ok(a.nav.shipOrientation.angleTo(identity)<.02);
  const inverse=a.nav.shipOrientation.clone().invert();
  const recoveredEye=a.nav.position.clone().sub(a.nav.shipPosition).applyQuaternion(inverse);
  assert.ok(recoveredEye.distanceTo(localEye)<1e-5);
  near(inverse.multiply(a.nav.orientation).angleTo(localRotation),0);
  for(const velocity of [a.nav.velocity,a.nav.shipVelocity,a.nav.angularVelocity,a.nav.shipAngularVelocity])assert.equal(velocity.length(),0);
  const clipped=shipPose(a),victim=shipPose(b);assert.equal(sweptBoxes(clipped,clipped,victim,victim),null);
});

test('an authorized hub passenger transfer has no swept suit but retains the parked hull',()=>{
  const visitor=pilot('visitor',0),rammer=pilot('rammer',-20);
  visitor.nav.mode='walk';visitor.nav.stationHubTransit={phase:'travel'};
  visitor.nav.shipPosition=base.clone();visitor.nav.position.copy(base).add(new THREE.Vector3(0,50,0));
  const players=new Map([[visitor.id,visitor],[rammer.id,rammer]]),before=capturePeerMotion(players),events=[];
  assert.equal(before.get(visitor.id).suit,null);assert.ok(before.get(visitor.id).hull);
  const destination=base.clone().add(new THREE.Vector3(0,500,100));visitor.nav.position.copy(destination);
  rammer.nav.position.x+=40;
  createRammingResolver().step(players,before,1/30,event=>events.push(event));
  assert.equal(events.length,1);assert.equal(events[0].kind,'ship');assert.equal(events[0].victim,visitor);
  assert.deepEqual(visitor.nav.position.toArray(),destination.toArray());
});

test('all same-frame hull stops are resolved before impact callbacks can mutate a participant',()=>{
  const a=pilot('a',-20),b=pilot('b',0),c=pilot('c',-20),d=pilot('d',0);
  c.nav.position.z+=10;d.nav.position.z+=10;
  const players=new Map([a,b,c,d].map(p=>[p.id,p])),before=capturePeerMotion(players),events=[];
  a.nav.position.x+=40;c.nav.position.x+=40;
  createRammingResolver().step(players,before,1/30,event=>{
    // Both independent contacts must already be clipped, even in callback #1.
    assert.ok(shipPose(a).position.x<base.x-2);assert.ok(shipPose(c).position.x<base.x-2);
    events.push(event);event.victim.health=0;
  });
  assert.equal(events.length,2);assert.deepEqual(new Set(events.map(e=>e.attacker.id)),new Set(['a','c']));
});

test('simultaneous lethal rams are admitted in either player order inside and outside the station zone',async()=>{
  for(const protectedZone of [false,true])for(const reversed of [false,true]) {
    const origin=base.clone().add(new THREE.Vector3(protectedZone?0:40000,0,0));
    const a=pilot('a',0),b=pilot('b',0);placeHull(a,origin.clone().add(new THREE.Vector3(-3,0,0)));placeHull(b,origin.clone().add(new THREE.Vector3(3,0,0)));
    const players=new Map((reversed?[b,a]:[a,b]).map(p=>[p.id,p])),before=capturePeerMotion(players),tasks=[];
    const security=createStationSecurity({world:{center:base},areFriends:async()=>false});
    a.nav.position.x+=20;b.nav.position.x-=20;
    createRammingResolver().step(players,before,1,attack=>tasks.push(security.submit(attack)));
    assert.equal(tasks.length,2);
    const results=await Promise.all(tasks);assert.ok(results.every(r=>r.accepted));
    assert.deepEqual([a.shipHealth,b.shipHealth],[0,0]);
    await security.close();
  }
});

test('intersecting slabs have zero distance and a contact shared by both boxes without contained vertices',()=>{
  const a=pose(0,0,{bounds:{min:[-4,-4,-.5],max:[4,4,.5]}}),b=pose(0,0,{bounds:{min:[-.5,-6,-4],max:[.5,6,4]}});
  const contains=(shape,world)=>{
    const local=world.clone().sub(shape.position).applyQuaternion(shape.rotation.clone().invert());
    return new THREE.Box3(new THREE.Vector3(...shape.bounds.min),new THREE.Vector3(...shape.bounds.max)).containsPoint(local);
  };
  for(const [shape,other] of [[a,b],[b,a]])for(let i=0;i<8;i++){
    const corner=new THREE.Vector3(...[0,1,2].map(axis=>shape.bounds[i&(1<<axis)?'max':'min'][axis])).add(shape.position);
    assert.equal(contains(other,corner),false);
  }
  const result=boxSeparation(a,b);assert.equal(result.distance,0);near(result.normal.length(),1);
  const pointA=result.offsetA.clone().add(a.position),pointB=result.offsetB.clone().add(b.position);
  assert.ok(contains(a,pointA));assert.ok(contains(b,pointA));assert.ok(pointA.distanceTo(pointB)<1e-5);
});

test('a fast rotating hull cannot skip a thin target through a minimum time jump',()=>{
  const a=pilot('a',-50),b=pilot('b',0),players=new Map([[a.id,a],[b.id,b]]),before=capturePeerMotion(players),events=[];
  const end=base.clone().add(new THREE.Vector3(1e9-50,0,0));
  placeHull(a,end,new THREE.Quaternion().setFromAxisAngle(UP,.02));
  createRammingResolver().step(players,before,1/30,event=>events.push(event));
  assert.equal(events.length,1);assert.equal(events[0].attacker,a);assert.equal(events[0].damage,100);
  assert.ok(shipPose(a).position.x<base.x-2);
  const suit={position:base.clone().add(new THREE.Vector3(0,.75,0)),up:UP.clone()};
  const hit=sweptSuit(pose(-50),pose(1e9-50,0,{rotation:new THREE.Quaternion().setFromAxisAngle(UP,.02)}),suit,suit);
  assert.ok(hit);near(hit.time,48.75/1e9,1e-12);
});
