import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWorld} from '../server/world.js';
import {createRoom,playerSnapshot} from '../server/room.js';
import {createMemoryStore} from '../server/database.js';
import {transferInventory,initialInventory} from '../server/inventory.js';

const worldPromise=createWorld();
async function setup(t,count=1){
  const world=await worldPromise,store=createMemoryStore();let time=100000;
  const errors=[],room=createRoom({world,store,autoStart:false,now:()=>time,onError:e=>errors.push(e)});
  t.after(()=>room.close());
  const accounts=await Promise.all(Array.from({length:count},(_,i)=>store.createAccount({email:`pilot${i}@example.test`,callsign:`Pilot_${i}`,passwordHash:'test-only'})));
  const messages=new Map(accounts.map(a=>[a.id,[]]));
  await Promise.all(accounts.map(a=>room.join(a,m=>messages.get(a.id).push(m))));
  let requestId=0;
  return {room,store,world,accounts,errors,messages,advance(seconds){for(let i=0;i<seconds*30;i++){time+=1000/30;room.tick();}},async request(id,m){await room.receive(id,{type:'request',requestId:String(++requestId),...m});return messages.get(id).findLast(m=>m.type==='ack');}};
}
test('ten simultaneous joins reserve distinct hangars and spawn on the deck beside their ships',async t=>{
  const {room,store,accounts,world,advance,messages,errors}=await setup(t,10);
  assert.equal(new Set([...room.players.values()].map(p=>p.colorIndex)).size,10);
  assert.equal(new Set([...room.players.values()].map(p=>p.hangarId)).size,10);
  advance(5);
  for(const p of room.players.values()){
    const pod=world.pods[p.hangarId-1],local=pod.toLocal(p.nav.position,new THREE.Vector3());
    assert.equal(p.nav.mode,'walk');assert.equal(p.nav.insideShip,false);
    assert.ok(pod.isInsideHangar(p.nav.position));
    assert.ok(Math.abs(local.y-pod.interiorBox.min.y-p.nav.layout.eyeHeight)<1e-6);
    assert.ok(p.nav.shipPosition.distanceTo(pod.padWorldPosition)<1e-8);
    const welcome=messages.get(p.id).find(m=>m.type==='welcome');
    assert.equal(welcome.hangar.status,'occupied');
    assert.equal(welcome.players.find(peer=>peer.id===p.id).physicsFrame,`hangar:${p.hangarId}`);
  }
  assert.deepEqual(errors,[]);
  await assert.rejects(room.join(accounts[0],()=>{}),{code:'ACCOUNT_CONNECTED'});
  const extra=await store.createAccount({email:'extra@example.test',callsign:'extra',passwordHash:'x'});
  await assert.rejects(room.join(extra,()=>{}),{code:'ROOM_FULL'});
});
test('concurrent comms reservations open unique physical doors and release on disconnect',async t=>{
  const {room,accounts,request,advance,world,errors}=await setup(t,10);
  const replies=await Promise.all(accounts.map(a=>request(a.id,{action:'hangar'})));
  assert.ok(replies.every(a=>a.ok));assert.equal(room.leases.size,10);
  advance(3.5);
  for(const p of room.players.values()){assert.equal(world.pods[p.hangarId-1].doorsOpen,1);assert.deepEqual(room.state(p).hangar.pad,world.pods[p.hangarId-1].padWorldPosition.toArray());}
  const id=accounts[0].id,berth=room.players.get(id).hangarId;await room.leave(id);advance(3.5);
  assert.equal(room.leases.has(berth),false);assert.equal(world.pods[berth-1].doorsOpen,0);assert.deepEqual(errors,[]);
});
test('unassigned ship cannot dock in another player berth; correct lease permits authored pad docking',async t=>{
  const {room,accounts,request,advance,world}=await setup(t,2);
  const a=room.players.get(accounts[0].id),b=room.players.get(accounts[1].id);
  await request(a.id,{action:'hangar'});advance(3.2);
  const pod=world.pods[a.hangarId-1];
  a.nav.position.copy(pod.padWorldPosition).addScaledVector(pod.up,8);a.nav.orientation.copy(pod.padQuaternion);
  b.spawnPod=a.hangarId;b.nav.position.copy(a.nav.position);b.nav.orientation.copy(a.nav.orientation);
  assert.equal(a.nav.canDock,true);assert.equal(b.nav.canDock,false);
  a.nav.dock();assert.equal(a.nav.dockedAtStation,true);assert.equal(a.nav.mode,'landed');
  assert.equal((await request(a.id,{action:'cancelHangar'})).ok,false);
});
test('position/damage uploads cannot move or damage a player; bounded intent moves with shared flight simulation',async t=>{
  const {room,accounts,advance,errors}=await setup(t);const p=room.players.get(accounts[0].id),start=p.nav.position.clone();
  room.receive(p.id,{type:'position',position:[0,0,0],health:0});assert.deepEqual(p.nav.position,start);assert.equal(p.health,100);
  room.receive(p.id,{type:'input',sequence:1,input:{forward:999,mouseYaw:NaN},position:[0,0,0]});
  advance(.4);assert.ok(p.nav.position.distanceTo(start)>0);assert.ok(p.nav.speed<=35.01);assert.equal(p.input.forward,1);
  room.receive(p.id,{type:'input',sequence:1,input:{forward:-1}});assert.equal(p.input.forward,1);
  advance(1);assert.equal(p.input.forward,0);assert.deepEqual(errors,[]);
});
test('inventory transfers are revision checked, persistent and proximity gated',async t=>{
  const {room,accounts,request,store}=await setup(t);const p=room.players.get(accounts[0].id);
  const m={action:'transfer',from:'pack',to:'ship',item:'bandage',quantity:1,revision:0};
  const replies=await Promise.all([request(p.id,m),request(p.id,m)]);
  assert.equal(replies.filter(r=>r.ok).length,1);assert.equal(p.inventory.containers.pack.bandage,2);assert.equal(p.inventory.containers.ship.bandage,1);
  p.nav.position.addScaledVector(p.nav.station.up,200);
  assert.equal((await request(p.id,{...m,to:'station',revision:1})).ok,false);
  await room.leave(p.id);await room.join(accounts[0],()=>{});
  assert.equal(room.players.get(p.id).inventory.containers.pack.bandage,2);
  assert.equal((await store.loadPlayerState(p.id)).inventory.revision,1);
});
test('loose inventory requires reach and expires; repeated pickup never duplicates',async t=>{
  const {room,accounts,request,advance}=await setup(t,2);const a=room.players.get(accounts[0].id),b=room.players.get(accounts[1].id);
  a.nav.mode='eva';b.nav.mode='eva';
  assert.equal((await request(a.id,{action:'drop',item:'bandage',quantity:1,revision:0})).ok,true);
  const id=[...room.drops.keys()][0];assert.equal((await request(b.id,{action:'pickup',id})).ok,false);
  b.nav.position.copy(a.nav.position);
  assert.equal((await request(b.id,{action:'pickup',id})).ok,true);
  assert.equal((await request(b.id,{action:'pickup',id})).ok,false);
  assert.equal(b.inventory.containers.pack.bandage,4);
  await request(a.id,{action:'drop',item:'bandage',quantity:1,revision:1});advance(301);assert.equal(room.drops.size,0);
});
test('invalid quantities and prototype container names cannot corrupt inventory',()=>{
  const original=initialInventory();
  for(const patch of [{quantity:-1},{quantity:Infinity},{quantity:1.2},{from:'__proto__'},{to:'constructor'},{item:'imaginary'}])assert.throws(()=>transferInventory(original,{from:'pack',to:'ship',item:'bandage',quantity:1,revision:0,...patch}));
  assert.equal(original.containers.pack.bandage,3);assert.equal(original.revision,0);
});
test('failed durable write does not grant, remove or acknowledge inventory',async t=>{
  const {room,accounts,request,store}=await setup(t);const p=room.players.get(accounts[0].id),before=structuredClone(p.inventory);
  const save=store.savePlayerState;store.savePlayerState=async()=>{throw new Error('storage offline');};
  assert.equal((await request(p.id,{action:'transfer',from:'pack',to:'ship',item:'bandage',quantity:1,revision:0})).ok,false);
  assert.deepEqual(p.inventory,before);store.savePlayerState=save;
});

test('a fresh pilot can walk around the hull, board, launch and land using only protocol controls',async t=>{
  const {room,accounts,request,advance,errors}=await setup(t);const p=room.players.get(accounts[0].id);
  let sequence=0;
  const move=(input,until)=>{
    for(let i=0;i<600&&!until();i++){
      room.receive(p.id,{type:'input',sequence:++sequence,input});advance(1/30);
    }
    room.receive(p.id,{type:'input',sequence:++sequence,input:{}});advance(.4);
    assert.ok(until(),`physical path stopped at ${p.nav.toShipLocal()?.toArray()}`);
  };
  const action=action=>room.receive(p.id,{type:'action',action});
  move({strafe:1},()=>p.nav.toShipLocal().x>p.nav.layout.flightBounds.max[0]+.5);
  move({forward:-1},()=>p.nav.toShipLocal().z>8);
  move({strafe:-.5},()=>p.nav.toShipLocal().x<.15);
  move({forward:.5},()=>p.nav.toShipLocal().z<6);
  assert.match(p.nav.interaction,/OPEN HATCH/);
  action('interact');advance(1.2);
  move({forward:1},()=>p.nav.toShipLocal().z<-1.5);
  action('interact');assert.equal(p.nav.mode,'landed');
  action('land');advance(2);
  assert.equal(p.nav.mode,'flight');assert.equal(p.nav.stationLift,false);
  move({forward:1},()=>p.nav.stationLocal.z<p.nav.station.openingZ-12);
  move({forward:-1},()=>p.nav.canDock);
  action('land');advance(15);
  assert.equal(p.nav.mode,'landed');assert.equal(p.nav.dockedAtStation,true);assert.equal(room.state(p).hangar.status,'occupied');assert.deepEqual(errors,[]);
});

test('EVA entry falls onto another berth deck and walking out preserves position and returns to EVA',async t=>{
  const {room,accounts,world,advance,errors}=await setup(t,2),p=room.players.get(accounts[0].id);
  const pod=world.pods[room.players.get(accounts[1].id).hangarId-1],floor=pod.interiorBox.min.y;
  advance(3.2);
  p.nav.mode='eva';p.nav.dockedAtStation=false;p.nav.insideShip=false;
  p.nav.position.copy(pod.toWorld(new THREE.Vector3(10,floor+p.nav.layout.eyeHeight+3,pod.openingZ-1),new THREE.Vector3()));
  p.nav.velocity.set(0,0,2).applyQuaternion(pod.quaternion);
  p.nav.orientToward(pod.padWorldPosition,pod.up);
  const ownHangar=p.hangarId,ownShip=p.nav.shipPosition.clone();
  let entered=false,previous=p.nav.position.clone();
  for(let i=0;i<120;i++){
    advance(1/30);
    assert.ok(p.nav.position.distanceTo(previous)<.5,'no snap from space to deck or planet');
    previous.copy(p.nav.position);entered ||= p.nav.mode==='walk';
  }
  assert.ok(entered);assert.equal(p.nav.mode,'walk');
  assert.equal(p.nav.physicsFrame,`hangar:${pod.id}`);
  assert.ok(Math.abs(pod.toLocal(p.nav.position,new THREE.Vector3()).y-floor-p.nav.layout.eyeHeight)<1e-5);
  assert.equal(p.nav.dockedAtStation,false,'gravity does not dock or move the ship');
  assert.equal(p.hangarId,ownHangar);assert.deepEqual(p.nav.shipPosition,ownShip);
  p.nav.orientToward(pod.toWorld(new THREE.Vector3(10,floor+p.nav.layout.eyeHeight,pod.openingZ-10),new THREE.Vector3()),pod.up);
  let sequence=0;
  for(let i=0;i<90&&p.nav.mode==='walk';i++){
    room.receive(p.id,{type:'input',sequence:++sequence,input:{forward:1}});advance(1/30);
    assert.ok(p.nav.position.distanceTo(previous)<.5);previous.copy(p.nav.position);
  }
  assert.equal(p.nav.mode,'eva');assert.equal(p.nav.physicsFrame,null);
  assert.ok(p.nav.speed>0,'walking momentum carries through the gravity boundary');
  assert.deepEqual(errors,[]);
});

test('jumping in an assigned hangar returns to its local floor and respawn reserves a deck again',async t=>{
  const {room,accounts,advance,request,world,errors}=await setup(t),p=room.players.get(accounts[0].id);
  const pod=world.pods[p.hangarId-1],start=p.nav.position.clone();
  room.receive(p.id,{type:'input',sequence:1,input:{jump:true}});advance(.15);
  assert.ok(p.nav.position.clone().sub(start).dot(pod.up)>.3);
  room.receive(p.id,{type:'input',sequence:2,input:{}});advance(2);
  assert.ok(p.nav.position.distanceTo(start)<1e-5);
  p.health=0;p.shipHealth=0;p.nav.mode='crashed';
  assert.equal((await request(p.id,{action:'respawn'})).ok,true);advance(2);
  assert.equal(p.nav.mode,'walk');assert.equal(room.state(p).hangar.status,'occupied');
  assert.ok(world.pods[p.hangarId-1].isInsideHangar(p.nav.position));
  assert.deepEqual(errors,[]);
});

test('suit collision respects closed and open doors in an unassigned gravity frame',async t=>{
  const {room,accounts,world}=await setup(t),p=room.players.get(accounts[0].id),pod=world.pods[19];
  const point=z=>pod.toWorld(new THREE.Vector3(0,pod.interiorBox.min.y+4,z),new THREE.Vector3());
  const start=point(pod.openingZ-3),end=point(pod.openingZ+3);
  p.nav.mode='eva';p.nav.position.copy(start);
  world.doors({...room.doors,[pod.id]:0});
  const closed=p.nav.station.constrainStep(start,end,pod.quaternion,true);
  assert.equal(closed.hit,true);assert.ok(pod.toLocal(closed.point,new THREE.Vector3()).z<pod.openingZ);
  world.doors({...room.doors,[pod.id]:1});
  const open=p.nav.station.constrainStep(start,end,pod.quaternion,true);
  assert.equal(open.hit,false);assert.ok(open.point.distanceTo(end)<1e-8);
});

test('combat mode is server-owned and full braking retains momentum across room ticks',async t=>{
 const {room,accounts,advance}=await setup(t),p=room.players.get(accounts[0].id);
 p.nav.orbit();p.nav.velocity.set(0,0,-100);
 assert.equal(playerSnapshot(p).combatMode,true);
 await room.receive(p.id,{type:'action',action:'combat'});
 assert.equal(playerSnapshot(p).combatMode,false);
 await room.receive(p.id,{type:'action',action:'combat'});
 assert.equal(playerSnapshot(p).combatMode,true);
 await room.receive(p.id,{type:'input',sequence:1,input:{brake:true}});
 const before=p.nav.position.clone();advance(1/30);
 assert.ok(p.nav.speed>98&&p.nav.speed<100);assert.ok(p.nav.position.distanceTo(before)>3);
 for(let i=0;i<240;i++){await room.receive(p.id,{type:'input',sequence:i+2,input:{brake:true}});advance(1/30);}
 assert.ok(p.nav.speed<.01);
});
