import test from 'node:test';import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {createWorld} from '../server/world.js';import {createRoom} from '../server/room.js';
import {createMemoryStore} from '../server/database.js';import {baseFixture} from './helpers/base-commerce.js';
import {hydrateBaseCommerce} from '../src/trading/base-stock.js';
const source='build-crate-5';
async function setup(t){
 const store=createMemoryStore(),world=await createWorld(),room=createRoom({store,world,autoStart:false}),messages=new Map();t.after(()=>room.close());
 const accounts=[];for(let i=0;i<3;i++){const a=await store.createAccount({email:`base${i}@example.test`,callsign:`Base_${i}`,passwordHash:'fixture'});accounts.push(a);messages.set(a.id,[]);await room.join(a,m=>messages.get(a.id).push(m));}
 const f=baseFixture();t.after(()=>f.build.dispose());let serial=0;
 const request=async(p,m)=>{const requestId=`request-${++serial}`;await room.receive(p.id,{type:'request',requestId,action:'cargo',commandId:`command-${serial}`,revision:room.trading.state.revision,...m});return messages.get(p.id).findLast(m=>m.type==='ack'&&m.requestId===requestId);};
 function station(p){const pod=world.pods[p.hangarId-1];p.nav.position.copy(pod.toWorld(new Vector3(-12,pod.interiorBox.min.y+1.75,20.7),new Vector3()));p.nav.mode='walk';p.nav.insideShip=false;p.nav.dockedAtStation=true;p.nav.velocity.set(0,0,0);}
 function base(p){p.nav.position.copy(f.nav.position);p.nav.orientation.copy(f.nav.orientation);p.nav.shipPosition.copy(f.build.toWorld(new Vector3(0,.5,0),f.claim));p.nav.shipOrientation.fromArray(f.claim.quaternion);p.nav.mode='walk';p.nav.insideShip=false;p.nav.dockedAtStation=false;p.nav.cabinFlight=false;p.nav.travel=null;p.nav.velocity.set(0,0,0);p.nav.shipVelocity.set(0,0,0);}
 const [seller,buyer,other]=accounts.map(a=>room.players.get(a.id));
 station(seller);const bought=await request(seller,{op:'buy',ship:`${seller.id}:nomad`,terminal:`station:${seller.hangarId}`,resource:'copper',sbu:2});assert.ok(bought.ok,bought.error);
 base(seller);const registered=await request(seller,{op:'base-register',claim:f.claim,terminalPiece:'build-piece-4'});assert.ok(registered.ok,registered.error);
 const id=Object.keys(room.trading.state.terminals).find(id=>id.startsWith('base-shop'));
 const crate=room.trading.state.ships[`${seller.id}:nomad`].crates[0];const deposited=await request(seller,{op:'base-deposit',terminal:id,ship:`${seller.id}:nomad`,source,resource:'copper',sbu:2,crate:crate.id});assert.ok(deposited.ok,deposited.error);
 return {store,world,room,messages,request,seller,buyer,other,base,id,accounts};
}
test('real server validates registration/deposit, publishes only offers and sells while owner is offline',async t=>{
 const f=await setup(t),{room,seller,buyer,id,request}=f;
 assert.equal(room.trading.state.terminals[id].stock.copper??0,0);assert.equal(room.trading.state.terminals[id].base.storage[source].items.copper,32);
 assert.ok((await request(seller,{op:'base-offer',terminal:id,source,resource:'copper',quantity:1,price:48})).ok);
 assert.ok((await request(seller,{op:'base-settings',terminal:id,setting:'public',value:true})).ok);
 const remote=room.trading.snapshot(buyer);assert.ok(remote.terminals.some(t=>t.id===id));assert.equal(remote.terminals.find(t=>t.id===id).base.storage,undefined);
 f.base(buyer);const first=room.trading.snapshot(buyer),second=room.trading.snapshot(buyer);assert.ok(first.baseLayouts?.length);assert.equal(second.baseLayouts,undefined);assert.equal(second.terminals[0].base.claim.pieces.length,0);assert.equal(hydrateBaseCommerce(first,second).terminals[0].base.claim.pieces.length,4);
 const credits=room.trading.state.accounts[seller.id].credits;await room.leave(seller.id);
 const buy={op:'buy',terminal:id,ship:`${buyer.id}:nomad`,resource:'copper',sbu:1,commandId:'offline-owner-buy',revision:room.trading.state.revision};assert.ok((await request(buyer,buy)).ok);
 assert.ok((await request(buyer,buy)).ok);const saved=await f.store.loadCommerce();assert.equal(saved.terminals[id].base.storage[source].items.copper,16);assert.equal(saved.terminals[id].stock.copper,0);assert.equal(saved.accounts[seller.id].credits,credits+48);assert.equal(saved.ships[`${buyer.id}:nomad`].crates.length,1);
 await room.join(f.accounts[0],()=>{});assert.equal(room.trading.state.accounts[seller.id].credits,credits+48);
});
test('server rejects remote purchases and forged edits; last-unit race and failed commit preserve conservation',async t=>{
 const f=await setup(t),{room,seller,buyer,other,id,request}=f;
 assert.ok((await request(seller,{op:'base-offer',terminal:id,source,resource:'copper',quantity:1,price:48})).ok);
 const buy=p=>({op:'buy',terminal:id,ship:`${p.id}:nomad`,resource:'copper',sbu:1});
 assert.equal((await request(buyer,buy(buyer))).ok,false);
 f.base(buyer);f.base(other);assert.equal((await request(buyer,{op:'base-offer',terminal:id,source,resource:'copper',quantity:2,price:1})).ok,false);
 const before=structuredClone(room.trading.state),real=f.store.transactCommerce;f.store.transactCommerce=async()=>{throw Error('test write failure');};assert.equal((await request(buyer,buy(buyer))).ok,false);assert.deepEqual(room.trading.state,before);f.store.transactCommerce=real;
 const revision=room.trading.state.revision;const results=await Promise.all([request(buyer,{...buy(buyer),revision}),request(other,{...buy(other),revision})]);assert.equal(results.filter(r=>r.ok).length,1);assert.equal(room.trading.state.terminals[id].stock.copper,0);assert.equal(room.trading.state.terminals[id].base.storage[source].items.copper,16);
});

test('isolated PostgreSQL saves source reservations and payment atomically across reopen',async t=>{
 const {mkdtemp}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{createServer}=await import('node:net');
 const {startLocalDatabase}=await import('../server/local-database.js'),{createPostgresStore}=await import('../server/database.js'),{emptyCommerce,ensureAccount,commerceCommand}=await import('../src/trading/model.js'),{registerBase}=await import('../src/trading/base-site.js');
 const root=await mkdtemp(join(tmpdir(),'base-commerce-sql-')),probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const db=await startLocalDatabase({XDG_DATA_HOME:root,DEV_DATABASE_NAME:'base-commerce-test',DEV_DATABASE_PORT:String(port)});let store;t.after(async()=>{await store?.close();await db.close();});store=await createPostgresStore({connectionString:db.connectionString});await store.migrate();
 const accounts=await Promise.all(['owner','visitor'].map(id=>store.createAccount({email:`${id}@example.test`,callsign:id,passwordHash:'test-only'})));const [owner,buyer]=accounts.map(a=>a.id),fixture=baseFixture();t.after(()=>fixture.build.dispose());
 let state=emptyCommerce();ensureAccount(state,owner);ensureAccount(state,buyer);const registered=registerBase(state,owner,{claim:fixture.claim,terminalPiece:'build-piece-4'},{nav:fixture.nav,shared:true});state=registered.state;const id=registered.terminal;
 // Seed authoritative deposited cargo for the SQL transaction fixture; physical
 // server registration/deposit is exercised in the separate room tests above.
 state.terminals[id].base.storage[source].items.copper=32;
 state=commerceCommand(state,owner,{op:'base-offer',commandId:'sql-offer',revision:state.revision,terminal:id,source,resource:'copper',quantity:1,price:51},{terminal:()=>true}).state;
 await store.transactCommerce(()=>({state}));const before=await store.loadCommerce(),order={op:'buy',commandId:'sql-buy',revision:state.revision,terminal:id,ship:`${buyer}:nomad`,resource:'copper',sbu:1},ctx={terminal:()=>true,docked:()=>true};
 await assert.rejects(store.transactCommerce(current=>({...commerceCommand(current,buyer,order,ctx),players:{'00000000-0000-0000-0000-000000000000':{version:1}}})));
 assert.deepEqual(await store.loadCommerce(),before);
 const raced=await Promise.allSettled([1,2].map(n=>store.transactCommerce(current=>commerceCommand(current,buyer,{...order,commandId:`sql-race-${n}`},ctx))));assert.equal(raced.filter(r=>r.status==='fulfilled').length,1);
 const saved=await store.loadCommerce();assert.equal(saved.terminals[id].stock.copper,0);assert.equal(saved.terminals[id].base.storage[source].items.copper,16);assert.equal(saved.accounts[owner].credits,1051);
 await store.close();store=await createPostgresStore({connectionString:db.connectionString});assert.deepEqual(await store.loadCommerce(),saved);
});
