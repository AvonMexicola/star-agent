import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {createWorld} from '../server/world.js';
import {createRoom} from '../server/room.js';
import {createMemoryStore} from '../server/database.js';
import {createSettlementLayouts} from '../src/settlements/layout.js';
import {transportCargo} from '../src/transport/catalog.js';
import {placeCrate} from '../src/cargo/grid.js';
const v=a=>new Vector3(...a);
const worldPromise=createWorld();

// Authoritative integration fixture uses explicit physical poses. Full input-
// only travel is a separate browser journey, never inferred from these tests.
test('server binds contract and crate to authenticated owner, actual terminal and parked ship; reload preserves it',async t=>{
 const world=await worldPromise,store=createMemoryStore();let now=Date.now(),serial=0;
 const room=createRoom({world,store,autoStart:false,now:()=>now});t.after(()=>room.close());
 const messages=new Map(),accounts=[];
 for(const callsign of ['Freight_A','Freight_B']){const a=await store.createAccount({email:`${callsign}@example.test`,callsign,passwordHash:'test-only'});accounts.push(a);messages.set(a.id,[]);await room.join(a,m=>messages.get(a.id).push(m));}
 const [alice,bob]=accounts.map(a=>room.players.get(a.id)),sites=createSettlementLayouts(),pickup=sites.find(s=>s.body==='aeon'),destination=sites.find(s=>s.body==='pyre');
 const request=async(p,fields)=>{const requestId=`r-${++serial}`,m={type:'request',action:'cargo',requestId,commandId:`freight-${serial}`,revision:room.trading.state.revision,...fields};await room.receive(p.id,m);return messages.get(p.id).findLast(m=>m.requestId===requestId);};
 const park=(p,site)=>{const q=new Quaternion(...site.claim.quaternion),origin=v(site.claim.origin),n=p.nav;n.mode='walk';n.insideShip=false;n.dockedAtStation=false;n.cabinFlight=false;n.shipPosition=v(site.pad.position).applyQuaternion(q).add(origin);n.shipOrientation.copy(q);n.orientation.copy(q);n.position=v([-2,site.pad.position[1]+1.75,-19.8]).applyQuaternion(q).add(origin);n.velocity.set(0,0,0);n.shipVelocity.set(0,0,0);n.doorOpen=true;n.doorProgress=1;};
 const accept={op:'transport-accept',route:'freight-aeon-pyre'};
 const accepted=await request(alice,accept);assert.equal(accepted.ok,true,accepted.error);const mission=structuredClone(room.trading.state.accounts[alice.id].transport.active);
 assert.equal(Object.keys(room.trading.state.loose??{}).length,0);
 const order={op:'transport-order',mission:mission.id,terminal:pickup.id,ship:`${alice.id}:nomad`};
 assert.equal((await request(bob,{...order,owner:alice.id})).ok,false);
 assert.equal((await request(alice,{...order,position:pickup.claim.origin,terminalReach:true,docked:true})).ok,false,'submitted reach/pose cannot order remotely');
 park(alice,pickup);park(bob,pickup);bob.nav.shipPosition.addScaledVector(new Vector3(1,0,0).applyQuaternion(bob.nav.shipOrientation),100);
 const real=store.transactCommerce,before=structuredClone(room.trading.state);store.transactCommerce=async()=>{throw Error('simulated failed commit');};assert.equal((await request(alice,order)).ok,false);assert.deepEqual(room.trading.state,before);store.transactCommerce=real;
 const ordered=await request(alice,order);assert.equal(ordered.ok,true,ordered.error);
 const active=room.trading.state.accounts[alice.id].transport.active,crate=room.trading.state.loose[active.crate];assert.equal(crate.transport.owner,alice.id);
 assert.equal(room.trading.snapshot(alice).loose.some(c=>c.id===crate.id),true);assert.equal(room.trading.snapshot(bob).loose.some(c=>c.id===crate.id),false);assert.equal(room.trading.snapshot(bob).account.transport,undefined);
 assert.equal((await request(alice,order)).ok,false,'fresh duplicate request cannot issue a second crate');
 assert.equal((await request(bob,{op:'tractor-grab',crate:crate.id,owner:alice.id,loot:true})).ok,false);
 assert.equal((await request(bob,{op:'transport-deposit',mission:active.id,crate:crate.id,terminal:destination.id,ship:`${alice.id}:nomad`})).ok,false);
 const persisted=await store.loadCommerce();await room.leave(alice.id);await room.join(accounts[0],m=>messages.get(alice.id).push(m));const rejoined=room.players.get(alice.id);
 assert.deepEqual(room.trading.state.accounts[alice.id].transport,persisted.accounts[alice.id].transport);assert.equal(Object.keys(room.trading.state.loose).length,1);
 // The trusted fixture moves only the original issued crate onto the grid, so
 // authoritative deposit can separately exercise destination/reach/rollback.
 await store.transactCommerce(s=>{const h=s.ships[`${alice.id}:nomad`];h.crates.push(placeCrate(h.hull,h.crates,transportCargo(s.loose[crate.id])));delete s.loose[crate.id];return {state:s};});await room.trading.join(rejoined);
 assert.equal(room.trading.snapshot(bob).ships.find(s=>s.owner===alice.id&&s.hull==='nomad').crates.length,0,'private mission manifest not exposed');
 // Execute the new online drive request against actual navigation state.
 park(rejoined,pickup);const n=rejoined.nav,up=new Vector3(0,1,0).applyQuaternion(n.shipOrientation);n.mode='flight';n.shipPosition=null;n.position=v(pickup.pad.position).applyQuaternion(new Quaternion(...pickup.claim.quaternion)).add(v(pickup.claim.origin)).addScaledVector(up,20500);n.gearDeployed=false;n.gearProgress=0;n.enabled=true;n.orientToward(v(destination.pad.position).applyQuaternion(new Quaternion(...destination.claim.quaternion)).add(v(destination.claim.origin)),up);
 const drive=await request(rejoined,{op:'transport-drive',target:destination.id,position:[0,0,0],end:[0,0,0]});assert.equal(drive.ok,true,drive.error);assert.equal(n.travel.targetId,destination.id);assert.ok(n.travel.plan.start.distanceTo(n.position)<.001);assert.ok(n.travel.plan.distance>1000000);assert.equal(room.trading.state.accounts[alice.id].transport.completed,0);const flightStart=n.position.clone();for(let i=0;i<90;i++){now+=1000/30;room.tick();}assert.ok(n.position.distanceTo(flightStart)>1000,'server integrator flies continuously after committed plan revival');assert.ok(n.travel);n.travel=null;
 const deposit={op:'transport-deposit',mission:active.id,crate:crate.id,terminal:destination.id,ship:`${alice.id}:nomad`};
 park(rejoined,pickup);assert.equal((await request(rejoined,deposit)).ok,false);park(rejoined,destination);
 const credits=room.trading.state.accounts[alice.id].credits,revision=room.trading.state.revision;
 const delivery={...deposit,commandId:'finish-transport',revision};const paid=await request(rejoined,delivery);assert.equal(paid.ok,true,paid.error);assert.equal(room.trading.state.accounts[alice.id].credits,credits+800);assert.equal(room.trading.state.accounts[alice.id].transport.completed,1);
 assert.equal((await request(rejoined,delivery)).ok,true,'same receipt is safely replayed');assert.equal(room.trading.state.accounts[alice.id].credits,credits+800);assert.equal((await store.loadCommerce()).accounts[alice.id].transport.completed,1);
});

test('isolated PostgreSQL restart retains the owner, original sealed crate and single-use payment receipt',async t=>{
 const {createPostgresStore}=await import('../server/database.js'),{startLocalDatabase}=await import('../server/local-database.js'),{mkdtemp,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{createServer}=await import('node:net'),{emptyCommerce,ensureAccount,commerceCommand}=await import('../src/trading/model.js');
 const root=await mkdtemp(join(tmpdir(),'star-agent-transport-database-')),portServer=createServer();await new Promise(r=>portServer.listen(0,'127.0.0.1',r));const port=portServer.address().port;await new Promise(r=>portServer.close(r));
 const db=await startLocalDatabase({XDG_DATA_HOME:root,DEV_DATABASE_NAME:'transport-tests',DEV_DATABASE_PORT:String(port)});let store;t.after(async()=>{try{await store?.close();}finally{try{await db.close();}finally{await rm(root,{recursive:true,force:true});}}});store=await createPostgresStore({connectionString:db.connectionString});await store.migrate();
 const account=await store.createAccount({email:'freight-db@example.test',callsign:'Freight_DB',passwordHash:'test-only'}),owner=account.id,ship=`${owner}:nomad`;
 const ctx={terminal:()=>true,docked:()=>true,transportAvailable:()=>true,transportPickup:()=>({position:[25000000000.125,3,0],quaternion:[0,0,0,1]}),now:()=>1000};let serial=0;
 const command=fields=>store.transactCommerce(current=>{const s=current??emptyCommerce();ensureAccount(s,owner);return commerceCommand(s,owner,{commandId:`sql-${++serial}`,revision:s.revision,ship,...fields},ctx);});
 let result=await command({op:'transport-accept',route:'freight-aeon-pyre'});const id=result.state.accounts[owner].transport.active.id;
 const revision=result.state.revision;const attempts=await Promise.allSettled([1,2].map(i=>command({op:'transport-order',mission:id,terminal:'settlement-aeon',revision,commandId:`concurrent-${i}`})));assert.equal(attempts.filter(a=>a.status==='fulfilled').length,1);
 const issued=await store.loadCommerce(),crate=Object.values(issued.loose)[0];assert.equal(crate.transport.owner,owner);
 await store.close();store=await createPostgresStore({connectionString:db.connectionString});assert.deepEqual(await store.loadCommerce(),issued);
 await assert.rejects(store.transactCommerce(s=>{delete s.loose[crate.id];throw Error('interrupted transaction');}));assert.deepEqual(await store.loadCommerce(),issued);
 await store.transactCommerce(s=>{const h=s.ships[ship];h.crates.push(placeCrate(h.hull,h.crates,transportCargo(s.loose[crate.id])));delete s.loose[crate.id];return {state:s};});
 const finalRevision=(await store.loadCommerce()).revision,deposit={op:'transport-deposit',mission:id,crate:crate.id,terminal:'settlement-pyre',revision:finalRevision,commandId:'durable-freight-payment'};
 result=await command(deposit);assert.equal(result.state.accounts[owner].credits,2300);const complete=result.state;await store.close();store=await createPostgresStore({connectionString:db.connectionString});assert.deepEqual(await store.loadCommerce(),complete);
 const repeat=await command(deposit);assert.equal(repeat.replayed,true);assert.equal(repeat.state.accounts[owner].credits,2300);assert.equal(repeat.state.accounts[owner].transport.completed,1);
});
