import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWorld} from '../server/world.js';
import {createRoom} from '../server/room.js';
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
test('ten simultaneous joins have ten distinct server colours; eleventh and duplicate account rejected',async t=>{
  const {room,store,accounts}=await setup(t,10);
  assert.equal(new Set([...room.players.values()].map(p=>p.colorIndex)).size,10);
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

test('a fresh pilot can fly level through assigned open doors and land using only protocol controls',async t=>{
  const {room,accounts,request,advance,errors}=await setup(t);const p=room.players.get(accounts[0].id);
  await request(p.id,{action:'hangar'});advance(3.2);
  let sequence=0;
  for(let i=0;i<400&&!p.nav.canDock;i++){
    room.receive(p.id,{type:'input',sequence:++sequence,input:{forward:.72}});advance(.1);
  }
  assert.equal(p.nav.canDock,true,'the initial approach must not aim the hull into the deck lip');
  room.receive(p.id,{type:'input',sequence:++sequence,input:{}});
  room.receive(p.id,{type:'action',action:'land'});advance(15);
  assert.equal(p.nav.mode,'landed');assert.equal(p.nav.dockedAtStation,true);assert.equal(room.state(p).hangar.status,'occupied');assert.deepEqual(errors,[]);
});
