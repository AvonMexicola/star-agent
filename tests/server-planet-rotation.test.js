import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Quaternion } from 'three';
import { Navigation } from '../src/navigation.js';
import { AEON } from '../src/celestial.js';
import { ROTATION_DOMAIN_RADII, frameVelocity, rotationFrameAt, planetRotation, fromInertial, toInertial } from '../src/planet-rotation.js';
import { shoot, shipPose } from '../server/combat.js';
import { capturePeerMotion, createRammingResolver } from '../server/ramming.js';
import { PlanetRotationClock, ROTATION_EPOCH_MS } from '../src/planet-rotation.js';
import { createWorld } from '../server/world.js';
import { createRoom } from '../server/room.js';
import { createMemoryStore } from '../server/database.js';
import { applyAuthoritativePeer, MultiplayerClient } from '../src/multiplayer/client.js';
import { reframeNavigation } from '../src/navigation-rotation.js';
import { createStationSecurity } from '../server/security.js';
import { SHIP_LAYOUT } from '../src/boarding.js';

globalThis.document={hidden:false,addEventListener(){},querySelector(){return null;},body:{classList:{toggle(){}}}};
globalThis.window={addEventListener(){}};
const seconds=900,boundary=AEON.radius*ROTATION_DOMAIN_RADII;
function pilot(id,position,orientation=new Quaternion()){
  const nav=new Navigation({addEventListener(){}},()=>{});
  nav.rotationClock={seconds};nav.mode='eva';
  place(nav,position,orientation);
  return {id,account:{id},nav,health:100,shipHealth:100,weapon:'rifle-laser',lastShotAt:-Infinity,
    inventory:{revision:0,containers:{pack:{'rifle-laser':1,'carbine-charge':10}}}};
}
function place(nav,position,orientation=new Quaternion()){
  const frame=rotationFrameAt(position);
  fromInertial(position,frame,seconds,nav.position);
  nav.orientation.copy(planetRotation(frame,seconds).invert()).multiply(orientation);
}

test('authoritative hitscan crosses a rotating chart boundary in both directions',()=>{
  for(const sign of [-1,1]){
    const origin=new Vector3(boundary+sign*10,0,0),target=new Vector3(boundary-sign*10,0,0);
    const direction=target.clone().sub(origin).normalize();
    const look=new Quaternion().setFromUnitVectors(new Vector3(0,0,-1),direction);
    const a=pilot('a',origin,look),b=pilot('b',target,look);
    assert.notEqual(a.nav.rotationFrame,b.nav.rotationFrame);
    const hit=shoot({shooter:a,players:[a,b],world:{},now:1000});
    assert.equal(hit.targetId,'b');assert.equal(hit.kind,'player');
    assert.ok(hit.distance>19&&hit.distance<20);
    assert.equal(b.health,75);assert.equal(a.inventory.containers.pack['carbine-charge'],9);
  }
});

test('a hull crossing the boundary hits another hull without a chart teleport or tunnelling',()=>{
  const layout={...SHIP_LAYOUT,flightBounds:{min:[-1,-1,-1],max:[1,1,1]}};
  const eye=root=>root.clone().add(new Vector3(...layout.seatEye));
  const rootA=new Vector3(boundary-30,0,0),rootB=new Vector3(boundary+10,0,0);
  const a=pilot('a',eye(rootA)),b=pilot('b',eye(rootB));
  for(const p of [a,b]){p.nav.mode='flight';p.nav.layout=layout;}
  const players=new Map([[a.id,a],[b.id,b]]),before=capturePeerMotion(players);
  place(a.nav,eye(new Vector3(boundary+40,0,0)));
  const events=[];createRammingResolver().step(players,before,1,event=>events.push(event));
  const physical=toInertial(shipPose(a).position,a.nav.rotationFrame,seconds);
  assert.ok(physical.x<rootB.x-2&&physical.x>rootA.x);
  assert.equal(events.length,1);assert.equal(events[0].attacker.id,'a');
});

test('peer chart changes snap the attitude even at the pole where positions nearly coincide',()=>{
  const own=pilot('a',new Vector3(0,boundary-.01,0));
  const peer=pilot('b',new Vector3(0,boundary+.01,0));
  // Rotate the observer in its old body chart. The authoritative inertial
  // orientation must replace it fully, not blend a false frame-turn into play.
  own.nav.orientation.setFromAxisAngle(new Vector3(0,1,0),.7);
  applyAuthoritativePeer(own.nav,{position:peer.nav.position.toArray(),orientation:[0,0,0,1],planetFrame:null,mode:'eva'},{blend:.1});
  assert.ok(own.nav.orientation.angleTo(new Quaternion())<1e-8);
  assert.equal(own.nav.position.y,peer.nav.position.y);
});


test('a ram near the rotating station retains its protected canonical impact point',async()=>{
  const center=new Vector3(AEON.radius+150_000,0,0);
  const layout={...SHIP_LAYOUT,flightBounds:{min:[-1,-1,-1],max:[1,1,1]}};
  const rootA=center.clone().add(new Vector3(0,0,40)),rootB=center.clone();
  const eye=root=>toInertial(root.clone().add(new Vector3(...layout.seatEye)),AEON,seconds);
  const rotation=planetRotation(AEON,seconds);
  const a=pilot('a',eye(rootA),rotation),b=pilot('b',eye(rootB),rotation);
  for(const p of [a,b]){p.nav.mode='flight';p.nav.layout=layout;}
  const players=new Map([[a.id,a],[b.id,b]]),before=capturePeerMotion(players);
  place(a.nav,eye(center.clone().add(new Vector3(0,0,-10))),rotation);
  const events=[];createRammingResolver().step(players,before,1,event=>events.push(event));
  assert.equal(events.length,1);assert.ok(events[0].point.distanceTo(center)<.001);
  const security=createStationSecurity({world:{center}});
  const result=await security.submit(events[0]);
  assert.equal(result.protected,true);assert.equal(a.health,0);assert.ok(b.shipHealth<100);
  await security.close();
});


test('an EVA chart crossing preserves a nearby parked hull and cabin-relative coordinates',()=>{
  const nav=pilot('walker',new Vector3(boundary-10,0,0)).nav;
  nav.cabinFlight=true;nav.spaceParked=true; // Actual parked-cabin flags survive EVA exit.
  nav.shipPosition=fromInertial(new Vector3(boundary-20,0,0),AEON,seconds);
  nav.shipOrientation.copy(planetRotation(AEON,seconds).invert());
  const parked=nav.shipPosition.clone();
  // Integrate the walker across the boundary in the old chart, then convert.
  fromInertial(new Vector3(boundary+1,0,0),AEON,seconds,nav.position);
  reframeNavigation(nav,AEON,seconds);
  assert.deepEqual(nav.shipPosition.toArray(),parked.toArray());
  assert.ok(nav.toShipLocal().distanceTo(new Vector3(21,0,0))<1e-6);
  assert.ok(Math.abs(nav.evaState.shipDistance-21)<1e-6);
  assert.equal(shipPose({nav}).frame,AEON);
  assert.ok(nav.fromShipLocal(new Vector3(21,0,0)).distanceTo(nav.position)<1e-6);
});


test('real room snapshots synchronize skewed clients through a day without moving station anchors',async t=>{
  const world=await createWorld(),store=createMemoryStore();let time=ROTATION_EPOCH_MS;
  world.rotationClock.now=()=>time;world.rotationClock.synchronize(0);
  const errors=[],room=createRoom({world,store,autoStart:false,now:()=>time,onError:e=>errors.push(e)});
  t.after(()=>room.close());
  const clients=[];
  for(const [i,skew] of [420_000,-210_000].entries()){
    const account=await store.createAccount({email:`rotation-room-${i}@example.test`,callsign:`Rotation_Room_${i}`,passwordHash:'test-only'});
    const client=new MultiplayerClient({url:'ws://127.0.0.1/unused'});
    client.nav=new Navigation({addEventListener(){}},()=>{});
    client.nav.rotationClock=new PlanetRotationClock({now:()=>time+skew});
    await room.join(account,message=>client._message(JSON.stringify(message)));
    assert.equal(client.connected,true);assert.equal(client.nav.rotationTime,0);
    clients.push(client);
  }
  const anchors=clients.map(c=>c.nav.position.clone()),hulls=clients.map(c=>c.nav.shipPosition.clone());
  for(const phase of [900,1800,2700,3600]){
    time=ROTATION_EPOCH_MS+phase*1000;room.tick();room.tick(); // Room publishes at 15 Hz.
    for(const [i,client] of clients.entries()){
      assert.equal(client.nav.rotationTime,phase);assert.equal(client.nav.rotationFrame,AEON);
      assert.ok(client.nav.position.distanceTo(anchors[i])<1e-6);
      assert.ok(client.nav.shipPosition.distanceTo(hulls[i])<1e-6);
      const physical=toInertial(anchors[i],AEON,phase);
      assert.ok(client.nav.inertialPosition.distanceTo(physical)<1e-6);
    }
  }
  assert.deepEqual(errors,[]);
});


test('boarding a parked hull across the chart boundary preserves the physical seat and attitude',()=>{
  const nav=pilot('walker',new Vector3(boundary+10,0,0)).nav;
  const root=new Vector3(boundary-1,0,0),look=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),-Math.PI/2);
  nav.shipPosition=fromInertial(root,AEON,seconds);
  nav.shipOrientation.copy(planetRotation(AEON,seconds).invert()).multiply(look);
  nav.cabinFlight=true;nav.spaceParked=true;nav.mode='walk';nav.insideShip=true;
  const seat=root.clone().add(new Vector3(...nav.layout.seatEye).applyQuaternion(look));
  place(nav,seat,look);assert.equal(nav.rotationFrame,null);
  assert.equal(nav.shipInteraction(nav.toShipLocal()),'seat');
  nav.embark();assert.equal(nav.mode,'flight');assert.equal(nav.shipPosition,null);
  assert.ok(nav.inertialPosition.distanceTo(seat)<1e-6);
  assert.ok(nav.inertialOrientation.angleTo(look)<1e-7);
  const expected=frameVelocity(fromInertial(seat,AEON,seconds),AEON).applyQuaternion(planetRotation(AEON,seconds));
  assert.ok(nav.velocity.distanceTo(expected)<1e-6);
});


test('a stopped moving cabin keeps its eye and root coherent on opposite sides of a chart boundary',()=>{
  const layout={...SHIP_LAYOUT,flightBounds:{min:[-5,-5,-5],max:[5,5,5]}};
  const look=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),-Math.PI/2);
  const eye=root=>root.clone().add(new Vector3(...layout.seatEye).applyQuaternion(look));
  const rootA=new Vector3(boundary-30,0,0),rootB=new Vector3(boundary+9,0,0);
  const a=pilot('a',eye(rootA),look),b=pilot('b',eye(rootB),look);
  for(const p of [a,b])p.nav.layout=layout;
  a.nav.mode='walk';a.nav.cabinFlight=true;a.nav.spaceParked=false;a.nav.insideShip=true;b.nav.mode='flight';
  const movingRoot=root=>{place(a.nav,eye(root),look);a.nav.shipPosition=fromInertial(root,a.nav.rotationFrame,seconds);a.nav.shipOrientation.copy(planetRotation(a.nav.rotationFrame,seconds).invert()).multiply(look);};
  movingRoot(rootA);
  const players=new Map([[a.id,a],[b.id,b]]),before=capturePeerMotion(players);
  movingRoot(new Vector3(boundary+15,0,0));
  createRammingResolver().step(players,before,1,()=>{});
  const pose=shipPose(a),physical=toInertial(pose.position,pose.frame,seconds);
  assert.ok(physical.x<boundary&&physical.x>boundary-2);
  assert.equal(a.nav.rotationFrame,null);
  assert.ok(a.nav.inertialPosition.distanceTo(eye(physical))<1e-6);
  assert.ok(a.nav.inertialOrientation.angleTo(look)<1e-7);
});
