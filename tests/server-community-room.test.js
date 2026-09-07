import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWorld} from '../server/world.js';
import {createRoom} from '../server/room.js';
import {createMemoryStore} from '../server/database.js';
import {shipPose} from '../server/combat.js';
import {WEAPON_RULES} from '../src/multiplayer/protocol.js';

const worldPromise=createWorld();
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};

async function setup(t){
  const world=await worldPromise,store=createMemoryStore(),messages=[],errors=[];
  let time=100_000,sequence=0,requestId=0;
  const room=createRoom({world,store,autoStart:false,now:()=>time,onError:e=>errors.push(e)});
  t.after(()=>room.close());
  const accounts=await Promise.all(['a','b'].map(id=>store.createAccount({email:`${id}@hub.test`,callsign:`Hub_${id}`,passwordHash:'fixture'})));
  for(const account of accounts)await room.join(account,m=>messages.push(m));
  const [a,b]=accounts.map(account=>room.players.get(account.id));
  // Authoritative fixture setup in a real, authored hangar. Normal room ticks,
  // navigation, hit occlusion, pack ownership and protocol cleaning still run.
  const pod=world.pods[0],floor=pod.interiorBox.min.y;
  for(const [p,z] of [[a,-8],[b,-18]]){
    p.nav.position.copy(pod.toWorld(new THREE.Vector3(12,floor+p.nav.layout.eyeHeight,z),new THREE.Vector3()));
    p.nav.orientation.copy(pod.quaternion);p.nav.insideShip=false;p.nav.mode='walk';p.nav.velocity.set(0,0,0);
  }
  const input=(p,input)=>room.receive(p.id,{type:'input',sequence:++sequence,input});
  const tick=()=>{time+=1000/30;room.tick();};
  const fire=async()=>{time+=1000;input(a,{fire:true});tick();await room.security.settle(a);input(a,{});await flush();};
  const request=async(p,fields)=>{const id=String(++requestId);await room.receive(p.id,{type:'request',requestId:id,...fields});return messages.findLast(m=>m.type==='ack'&&m.requestId===id);};
  return {world,store,room,accounts,messages,errors,a,b,input,tick,fire,request};
}

test('real room hit kills a nonfriend aggressor; pending requests confer no exemption and death survives reconnect',async t=>{
  const f=await setup(t),{room,store,a,b,accounts,fire,messages,request}=f;
  await store.socialChange(a.id,b.id,'request');
  await fire();
  assert.equal(b.health,100-WEAPON_RULES['rifle-laser'].damage);
  assert.equal(a.health,0);assert.equal(a.shipHealth,0);assert.equal(a.weapon,null);
  const event=messages.find(m=>m.event==='stationStrike');
  assert.equal(event.attackerId,a.id);assert.equal(event.victimId,b.id);assert.equal(event.stationId,'aeon-orbital');
  assert.equal(messages.find(m=>m.event==='fire').targetId,b.id);
  await room.leave(a.id);await room.join(accounts[0],m=>messages.push(m));
  const rejoined=room.players.get(a.id);assert.equal(rejoined.health,0);
  assert.equal((await request(rejoined,{action:'respawn'})).ok,true);
  assert.equal(rejoined.health,100);assert.ok(f.world.pods[rejoined.hangarId-1].isInsideHangar(rejoined.nav.position));
  assert.deepEqual(f.errors,[]);
});

test('accepted friendship preserves ordinary damage, while a later authoritative block removes the exemption',async t=>{
  const {store,a,b,fire,messages,errors}=await setup(t);
  await store.socialChange(a.id,b.id,'request');await store.socialChange(b.id,a.id,'accept');
  await fire();
  assert.equal(a.health,100);assert.equal(b.health,75);assert.equal(messages.some(m=>m.event==='stationStrike'),false);
  await store.socialChange(b.id,a.id,'block');await fire();
  assert.equal(a.health,0);assert.equal(b.health,50);assert.deepEqual(errors,[]);
});

test('incoming unresolved damage holds victim departure and rejoin until the old life is durably saved',async t=>{
  const {store,room,a,b,accounts,input,tick,request,errors,messages}=await setup(t),gate=deferred();
  store.areFriends=()=>gate.promise;
  input(a,{fire:true});tick();
  assert.equal(room.security.pending(a),true);assert.equal(room.security.pending(b),true);
  let left=false,joined=false;
  const leave=room.leave(b.id).then(()=>{left=true;});
  const join=room.join(accounts[1],m=>messages.push(m)).then(()=>{joined=true;});
  await flush();assert.equal(left,false);assert.equal(joined,false);
  gate.resolve(false);await Promise.all([leave,join]);
  const fresh=room.players.get(b.id);assert.notEqual(fresh,b);assert.equal(fresh.health,75);
  assert.equal((await request(fresh,{action:'transfer',from:'pack',to:'ship',item:'carbine-charge',quantity:1,revision:0})).ok,true);
  await flush();const saved=await store.loadPlayerState(b.id);
  assert.equal(saved.health,75);assert.equal(saved.inventory.revision,1);assert.equal(saved.inventory.containers.pack['carbine-charge'],59);
  assert.deepEqual(errors,[]);
});

test('flight hull protection at 29999 metres uses the physical hull root, including a shooter outside the sphere',async t=>{
  const {world,a,b,fire,messages,errors}=await setup(t);
  // Isolate the exact boundary from station collision/flight motion. These are
  // server-created poses; no corresponding position field exists in the wire.
  for(const p of [a,b]){p.nav.update=()=>{};p.nav.beginFrame=()=>{};p.nav.shipPosition=null;p.nav.dockedAtStation=false;}
  const root=world.center.clone().add(new THREE.Vector3(0,0,29999));
  b.nav.mode='flight';b.nav.orientation.setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI);
  b.nav.position.copy(root).add(new THREE.Vector3(...b.nav.layout.seatEye).applyQuaternion(b.nav.orientation));
  a.nav.mode='eva';a.nav.orientation.identity();a.nav.position.copy(root).add(new THREE.Vector3(0,2.3,100));
  assert.ok(b.nav.position.distanceTo(world.center)>30000);assert.ok(shipPose(b).position.distanceTo(world.center)<30000);
  await fire();assert.equal(b.shipHealth,75);assert.equal(a.health,0);
  assert.ok(messages.some(m=>m.event==='stationStrike'));assert.deepEqual(errors,[]);
});

test('a hit outside Aeon station protection does not create a moving player bubble',async t=>{
  const {world,a,b,fire,messages,errors}=await setup(t);
  for(const [p,z] of [[a,40100],[b,40090]]){
    p.nav.update=()=>{};p.nav.beginFrame=()=>{};p.nav.shipPosition=null;p.nav.dockedAtStation=false;
    p.nav.mode='eva';p.nav.orientation.identity();p.nav.position.copy(world.center).add(new THREE.Vector3(0,0,z));
  }
  await fire();assert.equal(b.health,75);assert.equal(a.health,100);
  assert.equal(messages.some(m=>m.event==='stationStrike'),false);assert.deepEqual(errors,[]);
});

for(const transition of ['hub entry','defense death'])test(`equipment save completing after ${transition} cannot rearm the pilot`,async t=>{
  const {store,room,world,a,b,request,errors}=await setup(t),entered=deferred(),gate=deferred();
  const save=store.savePlayerState.bind(store);let held=false;
  store.savePlayerState=async(id,data)=>{
    if(id===a.id&&data.weapon==='sidearm-pistol'&&!held){held=true;entered.resolve();await gate.promise;}
    return save(id,data);
  };
  const equip=request(a,{action:'equip',weapon:'sidearm-pistol'});await entered.promise;
  if(transition==='hub entry')a.nav.position.copy(world.station.hub.toWorld(new THREE.Vector3(0,-6.25,0),new THREE.Vector3()));
  else room.security.submit({id:'ram:fixture',attacker:a,victim:b,kind:'player',cause:'ram',damage:5,point:b.nav.position.clone()});
  await flush();gate.resolve();const ack=await equip;await room.security.settle(a);assert.equal(ack.ok,false);assert.equal(a.weapon,null);
  await flush();assert.equal((await store.loadPlayerState(a.id)).weapon,null);
  assert.match(ack.error,transition==='hub entry'?/remain stowed/:/Respawn/);assert.deepEqual(errors,[]);
});

test('a strike checkpoint waits for an already saving victim transfer to publish its new revision',async t=>{
  const {store,room,a,b,input,tick,request,errors}=await setup(t),entered=deferred(),gate=deferred();
  b.nav.shipPosition.copy(b.nav.position).add(new THREE.Vector3(8,0,0).applyQuaternion(b.nav.orientation));
  b.nav.shipOrientation.copy(b.nav.orientation);
  const save=store.savePlayerState.bind(store);let held=false;
  store.savePlayerState=async(id,data)=>{
    if(id===b.id&&data.inventory.revision===1&&!held){held=true;entered.resolve();await gate.promise;}
    return save(id,data);
  };
  const transfer=request(b,{action:'transfer',from:'pack',to:'ship',item:'carbine-charge',quantity:1,revision:0});
  await entered.promise;input(a,{fire:true});tick();await flush();
  assert.equal(b.health,75);assert.equal(b.inventory.revision,0);
  gate.resolve();assert.equal((await transfer).ok,true);await room.security.settle(a);
  const saved=await store.loadPlayerState(b.id);
  assert.equal(saved.health,75);assert.equal(saved.inventory.revision,1);
  assert.equal(saved.inventory.containers.pack['carbine-charge'],59);assert.equal(saved.inventory.containers.ship['carbine-charge'],1);
  assert.deepEqual(errors,[]);
});
