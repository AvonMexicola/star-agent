import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import { createWorld } from '../server/world.js';import { createRoom } from '../server/room.js';import { createMemoryStore,createPostgresStore } from '../server/database.js';
import { startLocalDatabase } from '../server/local-database.js';import { mkdtemp,rm } from 'node:fs/promises';import { join } from 'node:path';import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { emptyCommerce,ensureAccount,commerceCommand } from '../src/trading/model.js';
const worldPromise=createWorld();
async function setup(t,store=createMemoryStore()){
 const world=await worldPromise;let now=10000;const room=createRoom({world,store,autoStart:false,now:()=>now}),accounts=[],messages=new Map();t.after(()=>room.close());
 for(let i=0;i<2;i++){const a=await store.createAccount({email:`cargo-${i}@example.test`,callsign:`Cargo_${i}`,passwordHash:'test-only'});accounts.push(a);messages.set(a.id,[]);await room.join(a,m=>messages.get(a.id).push(m));}
 let serial=0;
 return {room,world,store,accounts,messages,request:async(id,m)=>{await room.receive(id,{type:'request',requestId:`r-${++serial}`,action:'cargo',commandId:`command-${serial}`,revision:room.trading.state.revision,...m});return messages.get(id).findLast(m=>m.type==='ack');},terminal(p){const pod=world.pods[p.hangarId-1];p.nav.position.copy(pod.toWorld(new THREE.Vector3(-12,pod.interiorBox.min.y+1.75,20.7),new THREE.Vector3()));p.nav.mode='walk';p.nav.insideShip=false;p.nav.dockedAtStation=true;p.nav.velocity.set(0,0,0);},time:()=>{now+=500;}};
}
test('server validates docked ship/reach, delivers a physical manifest, carries only1SBU and persists theft',async t=>{
 const f=await setup(t),[a,b]=f.accounts.map(a=>f.room.players.get(a.id)),ship=`${a.id}:nomad`;
 const buy={op:'buy',ship,terminal:`station:${a.hangarId}`,resource:'basalt',sbu:1};
 assert.equal((await f.request(a.id,buy)).ok,false);f.terminal(a);assert.equal((await f.request(a.id,buy)).ok,true);assert.equal(f.room.trading.state.accounts[a.id].credits,1480);
 const c=f.room.trading.state.ships[ship].crates[0];assert.equal((await f.request(b.id,{op:'take',ship,crate:c.id,loot:true})).ok,false);
 a.nav.doorOpen=true;a.nav.doorProgress=1;b.nav.position.copy(a.nav.fromShipLocal(new THREE.Vector3(.3,2.75,2.7)));
 assert.equal((await f.request(b.id,{op:'take',ship,crate:c.id})).ok,true);assert.equal(f.room.trading.state.accounts[b.id].carried.id,c.id);
 assert.equal((await f.request(b.id,{op:'take',ship,crate:c.id})).ok,false);
 const saved=await f.store.loadCommerce();assert.equal(saved.accounts[b.id].carried.id,c.id);assert.equal(saved.ships[ship].crates.length,0);
});
test('failed database transaction grants neither crates nor credits and packing consumes resources once',async t=>{
 const f=await setup(t),a=f.room.players.get(f.accounts[0].id);f.terminal(a);const real=f.store.transactCommerce;
 f.store.transactCommerce=async()=>{throw Error('write failed');};const before=structuredClone(f.room.trading.state);assert.equal((await f.request(a.id,{op:'buy',ship:`${a.id}:nomad`,terminal:`station:${a.hangarId}`,resource:'basalt',sbu:1})).ok,false);assert.deepEqual(f.room.trading.state,before);f.store.transactCommerce=real;
 a.inventory.containers.pack={basalt:16};const command={op:'pack',ship:`${a.id}:nomad`,terminal:`station:${a.hangarId}`,resource:'basalt',sbu:1,commandId:'durable-pack',revision:f.room.trading.state.revision};
 assert.equal((await f.request(a.id,command)).ok,true);assert.equal(a.inventory.containers.pack.basalt,0);assert.equal((await f.request(a.id,command)).ok,true);assert.equal(f.room.trading.state.ships[`${a.id}:nomad`].crates.length,1);assert.equal((await f.store.loadPlayerState(a.id)).inventory.containers.pack.basalt,0);
});
test('server supports Atlas cargo hull and blocks2SBU hand pickup',async t=>{
 const f=await setup(t),a=f.room.players.get(f.accounts[0].id);f.terminal(a);
 assert.equal((await f.request(a.id,{action:'cargoHull',hull:'atlas'})).ok,true);assert.equal(a.nav.layout.floorY,4);assert.ok(a.nav.freighter);
 assert.equal((await f.request(a.id,{op:'buy',ship:`${a.id}:atlas`,terminal:`station:${a.hangarId}`,resource:'basalt',sbu:64})).ok,true);
 assert.equal(f.room.trading.state.ships[`${a.id}:atlas`].crates[0].sbu,64);
 assert.equal((await f.request(a.id,{op:'buy',ship:`${a.id}:atlas`,terminal:`station:${a.hangarId}`,resource:'basalt',sbu:2})).ok,true);
 const two=f.room.trading.state.ships[`${a.id}:atlas`].crates.find(c=>c.sbu===2);a.nav.position.copy(a.nav.fromShipLocal(new THREE.Vector3(-5,5.75,5.3)));a.nav.insideShip=true;
 const denied=await f.request(a.id,{op:'take',ship:`${a.id}:atlas`,crate:two.id});assert.equal(denied.ok,false);assert.match(denied.error,/Only a 1 SBU/);assert.equal(f.room.trading.state.accounts[a.id].carried,null);

});
test('isolated PostgreSQL migration, concurrent seller settlement and restart preserve cargo',async t=>{
 const root=await mkdtemp(join(tmpdir(),'star-agent-cargo-database-')),server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
 const db=await startLocalDatabase({XDG_DATA_HOME:root,DEV_DATABASE_NAME:'cargo-tests',DEV_DATABASE_PORT:String(port)});let store=await createPostgresStore({connectionString:db.connectionString});t.after(async()=>{await store.close();await db.close();await rm(root,{recursive:true,force:true});});await store.migrate();await store.migrate();
 const [a,b]=await Promise.all(['seller','buyer'].map(id=>store.createAccount({email:`${id}@example.test`,callsign:id,passwordHash:'test-only'})));
 await store.transactCommerce(()=>{const state=emptyCommerce();ensureAccount(state,a.id);ensureAccount(state,b.id);state.terminals['trade-1']={id:'trade-1',owner:a.id,position:[0,0,0],stock:{basalt:1},prices:{basalt:37}};return {state};});
 const ctx={terminal:()=>true,docked:()=>true};const messages=await Promise.allSettled([1,2].map(n=>store.transactCommerce(state=>commerceCommand(state,b.id,{op:'buy',ship:`${b.id}:nomad`,terminal:'trade-1',resource:'basalt',sbu:1,commandId:`sale-${n}`,revision:0},ctx))));assert.equal(messages.filter(m=>m.status==='fulfilled').length,1);
 let state=await store.loadCommerce();assert.equal(state.accounts[a.id].credits,1537);assert.equal(state.accounts[b.id].credits,1463);assert.equal(state.ships[`${b.id}:nomad`].crates.length,1);
 await assert.rejects(store.transactCommerce(s=>{s.accounts[b.id].credits=0;return {state:s,players:{'00000000-0000-0000-0000-000000000000':{version:1}}};}));assert.equal((await store.loadCommerce()).accounts[b.id].credits,1463);
 const crate=state.ships[`${b.id}:nomad`].crates[0];state=(await store.transactCommerce(current=>commerceCommand(current,b.id,{op:'tractor-grab',ship:`${b.id}:nomad`,crate:crate.id,commandId:'saved-tractor',revision:current.revision},{now:()=>1000,tractor:{grab:()=>({position:[25000000000.125,10,20],quaternion:[0,0,0,1]})}}))).state;assert.equal(state.loose[crate.id].position[0],25000000000.125);
 await store.close();store=await createPostgresStore({connectionString:db.connectionString});assert.deepEqual(await store.loadCommerce(),state);
});

test('player builds a shared surface trading pad, stocks it and earns from a visitor while disconnected',async t=>{
 const {SELENE,bodySurfacePoint}=await import('../src/celestial.js'),{MOON_LANDING_DIRECTION}=await import('../src/moon-world.js');
 const f=await setup(t),[a,b]=f.accounts.map(a=>f.room.players.get(a.id));f.terminal(a);
 assert.equal((await f.request(a.id,{op:'buy',ship:`${a.id}:nomad`,terminal:`station:${a.hangarId}`,resource:'basalt',sbu:1})).ok,true);
 const up=new THREE.Vector3(...MOON_LANDING_DIRECTION);a.nav.position.copy(bodySurfacePoint(up,SELENE,1.75));a.nav.mode='walk';a.nav.insideShip=false;a.nav.dockedAtStation=false;a.nav.orientation.setFromUnitVectors(new THREE.Vector3(0,1,0),up).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),12*Math.PI/8));
 const deployed=await f.request(a.id,{op:'deploy'});assert.equal(deployed.ok,true,deployed.error);const pad=Object.values(f.room.trading.state.terminals)[0],q=new THREE.Quaternion(...pad.quaternion),origin=new THREE.Vector3(...pad.origin);
 // Walk from the original surface approach to the newly built terminal using protocol inputs.
 let previous=a.nav.position.clone();for(let i=0;i<35;i++){f.time();f.room.receive(a.id,{type:'input',sequence:i+1,input:{forward:1}});f.room.tick();assert.ok(a.nav.position.distanceTo(previous)<.5,'pad approach remains continuous');previous.copy(a.nav.position);}
 const approach=a.nav.position.clone().sub(origin).applyQuaternion(q.clone().invert());assert.ok(approach.y>=1.99,`walked onto raised pad at ${approach.toArray()}`);
 assert.equal((await f.request(a.id,{op:'price',terminal:pad.id,resource:'basalt',price:45})).ok,true,'terminal reachable by walking');
 const park=p=>{p.nav.mode='walk';p.nav.insideShip=false;p.nav.dockedAtStation=false;p.nav.shipPosition=new THREE.Vector3(0,.25,0).applyQuaternion(q).add(origin);p.nav.shipOrientation.copy(q);p.nav.position.copy(new THREE.Vector3(0,2,17.5).applyQuaternion(q).add(origin));p.nav.velocity.set(0,0,0);};park(a);
 const crate=f.room.trading.state.ships[`${a.id}:nomad`].crates[0];assert.equal((await f.request(a.id,{op:'stock',ship:`${a.id}:nomad`,terminal:pad.id,resource:'basalt',sbu:1,crate:crate.id})).ok,true);
 assert.equal((await f.request(a.id,{op:'price',terminal:pad.id,resource:'basalt',price:45})).ok,true);const balance=f.room.trading.state.accounts[a.id].credits;await f.room.leave(a.id);park(b);
 const bought=await f.request(b.id,{op:'buy',ship:`${b.id}:nomad`,terminal:pad.id,resource:'basalt',sbu:1});assert.equal(bought.ok,true,bought.error);assert.equal(f.room.trading.state.accounts[a.id].credits,balance+45);assert.equal(f.room.trading.state.terminals[pad.id].stock.basalt,0);assert.equal(f.room.trading.state.ships[`${b.id}:nomad`].crates.length,1);
});

test('another pilot physically walks the open Nomad ramp with no teleport or closed-hatch pass-through',async t=>{
 const f=await setup(t),[a,b]=f.accounts.map(a=>f.room.players.get(a.id));const root=a.nav.shipPosition.clone(),q=a.nav.shipOrientation.clone();
 b.nav.position.copy(new THREE.Vector3(0,1.75,8).applyQuaternion(q).add(root));b.nav.orientation.copy(q);b.nav.mode='walk';b.nav.dockedAtStation=false;b.nav.insideShip=false;b.nav.velocity.set(0,0,0);
 a.nav.doorOpen=false;a.nav.doorProgress=0;for(let i=0;i<65;i++){f.time();f.room.receive(b.id,{type:'input',sequence:i+1,input:{forward:1}});f.room.tick();}assert.ok(b.nav.position.clone().sub(root).applyQuaternion(q.clone().invert()).z>=4.24,'closed hatch blocks entry');
 a.nav.doorOpen=true;a.nav.doorProgress=1;b.nav.position.copy(new THREE.Vector3(0,1.75,8).applyQuaternion(q).add(root));b.nav.velocity.set(0,0,0);let previous=b.nav.position.clone(),minHeight=Infinity;
 for(let i=0;i<65;i++){f.time();f.room.receive(b.id,{type:'input',sequence:i+100,input:{forward:1}});f.room.tick();assert.ok(b.nav.position.distanceTo(previous)<.5,'continuous physical movement');previous.copy(b.nav.position);const local=b.nav.position.clone().sub(root).applyQuaternion(q.clone().invert());if(local.z<4)minHeight=Math.min(minHeight,local.y);}
 const local=b.nav.position.clone().sub(root).applyQuaternion(q.clone().invert());assert.ok(local.z<3.8,`walked aboard at ${local.toArray()}`);assert.ok(minHeight>=2.74,`supported by real cabin floor (${minHeight})`);assert.equal(b.nav.mode,'walk');
});

test('authenticated sockets receive committed cargo and reconnect without another wallet grant',async t=>{
 const {createServer}=await import('../server/index.js'),{WebSocket}=await import('ws');
 const store=createMemoryStore(),world=await worldPromise,errors=[],room=createRoom({store,world,onError:e=>errors.push(e.message)}),origin='http://cargo.example.test';
 const app=await createServer({store,room,publicOrigin:origin,secureCookies:false}),address=await app.listen(0),url=`http://127.0.0.1:${address.port}`,sockets=[];
 t.after(async()=>{for(const ws of sockets)ws.terminate();await app.close();});
 const until=async fn=>{for(let i=0;i<120;i++){if(fn())return;await new Promise(r=>setTimeout(r,25));}assert.fail('Socket cargo result timed out');};
 const connect=async cookie=>{const messages=[],ws=new WebSocket(url.replace('http:','ws:')+'/ws',{headers:{Origin:origin,Cookie:cookie}});sockets.push(ws);ws.on('message',data=>messages.push(JSON.parse(data)));ws.on('error',e=>errors.push(e.message));await until(()=>messages.some(m=>m.type==='welcome'));return {ws,messages,id:messages.find(m=>m.type==='welcome').id};};
 const peers=[],cookies=[];for(let i=0;i<2;i++){
  const response=await fetch(url+'/api/auth/register',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:`socket-cargo-${i}@example.test`,callsign:`Freight_${i}`,password:'Disposable cargo test password 123!'})});assert.equal(response.status,201);const cookie=response.headers.get('set-cookie').split(';')[0];cookies.push(cookie);peers.push(await connect(cookie));
 }
 const [a,b]=peers;a.ws.send(JSON.stringify({type:'request',action:'hangar',requestId:'hangar'}));await until(()=>room.players.get(a.id).hangarId);
 // Explicit initial terminal pose; transaction and delivery use real authenticated sockets.
 const player=room.players.get(a.id),pod=world.pods[player.hangarId-1];player.nav.position.copy(pod.toWorld(new THREE.Vector3(-12,pod.interiorBox.min.y+1.75,20.7),new THREE.Vector3()));player.nav.mode='walk';player.nav.insideShip=false;player.nav.dockedAtStation=true;player.nav.velocity.set(0,0,0);
 a.ws.send(JSON.stringify({type:'request',requestId:'buy',action:'cargo',op:'buy',commandId:'socket-buy',revision:room.trading.state.revision,ship:`${a.id}:nomad`,terminal:`station:${player.hangarId}`,resource:'basalt',sbu:1}));
 await until(()=>a.messages.some(m=>m.type==='ack'&&m.requestId==='buy'));assert.equal(a.messages.find(m=>m.type==='ack'&&m.requestId==='buy').ok,true);
 await until(()=>b.messages.some(m=>m.type==='state'&&m.commerce.ships.some(s=>s.id===`${a.id}:nomad`&&s.crates.length===1)));
 const observer=b.messages.findLast(m=>m.type==='state');assert.equal(observer.commerce.account.credits,1500,'observer receives only its own wallet');
 a.ws.close();await until(()=>!room.players.has(a.id));const rejoined=await connect(cookies[0]);await until(()=>rejoined.messages.some(m=>m.type==='state'));
 const saved=rejoined.messages.findLast(m=>m.type==='state').commerce;assert.equal(saved.account.credits,1480);assert.equal(saved.ships.find(s=>s.id===`${a.id}:nomad`).crates.length,1);assert.deepEqual(errors,[]);
});

test('server tractor uses actual aim, saves detached2SBU, arbitrates locks and reconnects without loss',async t=>{
 const {crateCentre}=await import('../src/cargo/tractor-physics.js');
 const f=await setup(t),[a,b]=f.accounts.map(a=>f.room.players.get(a.id)),ship=`${a.id}:nomad`;f.terminal(a);
 assert.equal((await f.request(a.id,{op:'buy',ship,terminal:`station:${a.hangarId}`,resource:'basalt',sbu:2})).ok,true);
 const c=f.room.trading.state.ships[ship].crates[0],point=a.nav.fromShipLocal(crateCentre('nomad',c));
 for(const p of [a,b]){p.nav.position.copy(a.nav.fromShipLocal(new THREE.Vector3(0,2.75,2.7)));p.nav.orientation.setFromUnitVectors(new THREE.Vector3(0,0,-1),point.clone().sub(p.nav.position).normalize());p.nav.mode='walk';p.nav.insideShip=p===a;p.nav.velocity.set(0,0,0);await f.request(p.id,{action:'equip',weapon:'mining-laser-tool'});}
 const original=f.store.transactCommerce;f.store.transactCommerce=async()=>{throw Error('isolated write failure');};assert.equal((await f.request(a.id,{op:'tractor-grab',ship,crate:c.id})).ok,false);assert.equal(f.room.trading.state.ships[ship].crates.length,1);f.store.transactCommerce=original;
 const grabbed=await f.request(a.id,{op:'tractor-grab',ship,crate:c.id,position:[0,0,0]});assert.equal(grabbed.ok,true,grabbed.error);assert.equal(f.room.trading.state.ships[ship].crates.length,0);assert.ok(new THREE.Vector3(...f.room.trading.state.loose[c.id].position).distanceTo(point)<1e-6,'client position ignored');
 assert.equal((await f.request(b.id,{op:'tractor-grab',ship,crate:c.id})).ok,false);const snapshot=f.room.trading.snapshot(b);assert.equal(snapshot.loose[0].id,c.id);assert.equal(a.nav.carryingCargo,true);
 const inside=a.nav.insideShip;a.nav.insideShip=false;assert.equal((await f.request(a.id,{action:'cargoHull',hull:'atlas'})).ok,false,'cannot change hull while a tractor is holding cargo');assert.equal(a.nav.shipId,'nomad');a.nav.insideShip=inside;
 const before=structuredClone(f.room.trading.state.loose[c.id]);f.time();const moved=await f.request(a.id,{op:'tractor-move',crate:c.id,distance:3,position:[0,0,0]});assert.equal(moved.ok,true,moved.error);assert.ok(new THREE.Vector3(...f.room.trading.state.loose[c.id].position).distanceTo(new THREE.Vector3(...before.position))<1);
 await f.room.leave(a.id);for(let i=0;i<4;i++)f.time();const current=f.room.trading.state.loose[c.id];b.nav.orientation.setFromUnitVectors(new THREE.Vector3(0,0,-1),new THREE.Vector3(...current.position).sub(b.nav.position).normalize());const reclaimed=await f.request(b.id,{op:'tractor-grab',crate:c.id});assert.equal(reclaimed.ok,true,reclaimed.error);
 const saved=await f.store.loadCommerce();assert.equal(saved.loose[c.id].holder,b.id);assert.equal(saved.ships[ship].crates.length,0);assert.equal(validCargoCount(saved,c.id),1);
 await f.room.join(f.accounts[0],m=>f.messages.get(a.id).push(m));assert.equal(validCargoCount(f.room.trading.state,c.id),1);
});
function validCargoCount(state,id){return Object.values(state.ships).flatMap(s=>s.crates).filter(c=>c.id===id).length+Object.values(state.loose??{}).filter(c=>c.id===id).length;}
