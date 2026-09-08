import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyCommerce,ensureAccount,commerceCommand,validCommerce} from '../src/trading/model.js';
import {TRANSPORT_ROUTES,transportCargo,cargoVisibleTo} from '../src/transport/catalog.js';
import {placeCrate} from '../src/cargo/grid.js';
import {LocalTrading} from '../src/trading/local.js';
import {MiningStore} from '../src/mining/store.js';
const route=TRANSPORT_ROUTES.find(r=>r.id==='freight-aeon-pyre');
const pose={position:[1592800.125,3,20],quaternion:[0,0,0,1]};
const ctx={now:()=>1000,transportAvailable:()=>true,terminal:()=>true,docked:()=>true,transportPickup:()=>pose,grid:()=>true,crate:()=>true,loot:()=>true,tractor:{grab:(_c,ship)=>ship?pose:true,stow:(c,ship)=>placeCrate(ship.hull,ship.crates,transportCargo(c))}};
function fixture(){let state=emptyCommerce(),serial=0;ensureAccount(state,'alice');ensureAccount(state,'bob');
 return {get state(){return state;},set state(s){state=s;},command(fields,context=ctx,owner='alice'){const m={commandId:`test-${++serial}`,revision:state.revision,ship:`${owner}:nomad`,...fields};const result=commerceCommand(state,owner,m,context);state=result.state;return {...result,command:m};},accept(owner='alice'){return this.command({op:'transport-accept',route:route.id},ctx,owner);},order(owner='alice'){return this.command({op:'transport-order',mission:state.accounts[owner].transport.active.id,terminal:route.from},ctx,owner);},load(owner='alice'){const id=state.accounts[owner].transport.active.crate;this.command({op:'tractor-grab',crate:id},ctx,owner);return this.command({op:'tractor-stow',crate:id},ctx,owner);}};}

test('twelve distinct cross-world routes accept without spawning cargo or changing market stock',()=>{
 assert.equal(TRANSPORT_ROUTES.length,12);assert.equal(new Set(TRANSPORT_ROUTES.map(r=>r.id)).size,12);
 const f=fixture(),before=structuredClone(f.state);f.accept();
 assert.equal(f.state.accounts.alice.transport.active.phase,'accepted');assert.equal(f.state.accounts.alice.transport.active.crate,null);
 assert.equal(Object.keys(f.state.loose??{}).length,0);assert.deepEqual(f.state.ships,before.ships);assert.deepEqual(f.state.markets,before.markets);assert.equal(f.state.accounts.alice.credits,1500);
 assert.throws(()=>f.accept(),/current transport/);assert.equal(validCommerce(f.state),true);
});
test('only the accepter can order once at pickup with a physically docked owned ship',()=>{
 const f=fixture();f.accept();const mission=f.state.accounts.alice.transport.active.id,before=structuredClone(f.state),m={op:'transport-order',mission,terminal:route.from};
 for(const [fields,context,owner,pattern] of [[m,ctx,'bob',/not yours/],[{...m,terminal:route.to},ctx,'alice',/pickup site/],[m,{...ctx,terminal:()=>false},'alice',/Walk up/],[m,{...ctx,docked:()=>false},'alice',/Land/],[{...m,ship:'bob:nomad'},ctx,'alice',/own cargo/],[m,{...ctx,transportPickup:()=>null},'alice',/apron is blocked/]]){
  assert.throws(()=>f.command(fields,context,owner),pattern);assert.deepEqual(f.state,before);
 }
 const order=f.order(),crate=f.state.loose[f.state.accounts.alice.transport.active.crate];assert.deepEqual(crate.position,pose.position);assert.equal(crate.transport.owner,'alice');assert.equal(f.state.ships['alice:nomad'].crates.length,0);
 const saved=structuredClone(f.state);assert.equal(commerceCommand(f.state,'alice',order.command,ctx).replayed,true);assert.deepEqual(f.state,saved);assert.throws(()=>f.order(),/already been issued/);
});
test('two pilots accepting the same route receive different private crates and cannot claim each other’s mission',()=>{
 const f=fixture();f.accept();f.accept('bob');f.order();f.order('bob');
 const a=f.state.accounts.alice.transport.active,b=f.state.accounts.bob.transport.active;assert.notEqual(a.id,b.id);assert.notEqual(a.crate,b.crate);assert.equal(Object.keys(f.state.loose).length,2);
 assert.equal(cargoVisibleTo(f.state.loose[a.crate],'bob'),false);assert.equal(cargoVisibleTo(f.state.loose[a.crate],'alice'),true);
 assert.throws(()=>f.command({op:'tractor-grab',crate:a.crate},ctx,'bob'),/another pilot/);
 assert.throws(()=>f.command({op:'transport-abandon',mission:a.id},ctx,'bob'),/not yours/);assert.equal(validCommerce(f.state),true);
});
test('seal survives tractor, hand carry and stow; theft, resale and ordinary substitutes cannot complete freight',()=>{
 const f=fixture();f.accept();f.order();f.load();const m=f.state.accounts.alice.transport.active,c=f.state.ships['alice:nomad'].crates[0];
 assert.deepEqual(c.transport,{id:m.id,owner:'alice'});assert.throws(()=>f.command({op:'take',ship:'alice:nomad',crate:c.id},ctx,'bob'),/another pilot/);
 assert.throws(()=>f.command({op:'tractor-grab',ship:'alice:nomad',crate:c.id},ctx,'bob'),/another pilot/);
 for(const op of ['sell','stock','base-deposit'])assert.throws(()=>f.command({op,crate:c.id,terminal:route.to,resource:c.resource,sbu:1}),/sealed|Sealed|owner|base/i);
 f.command({op:'take',crate:c.id});assert.deepEqual(f.state.accounts.alice.carried.transport,c.transport);assert.throws(()=>f.command({op:'transport-deposit',mission:m.id,crate:c.id,terminal:route.to}),/cargo grid/);f.command({op:'stow'});
 assert.throws(()=>f.command({op:'transport-deposit',mission:m.id,crate:'ordinary-crate',terminal:route.to}),/assigned crate/);
 assert.throws(()=>f.command({op:'transport-deposit',mission:m.id,crate:c.id,terminal:route.from}),/destination/);
});
test('destination deposit consumes the exact crate and pays once, including replay after reload',()=>{
 const f=fixture();f.accept();f.order();f.load();const mission=f.state.accounts.alice.transport.active,before=f.state.accounts.alice.credits;
 const done=f.command({op:'transport-deposit',mission:mission.id,crate:mission.crate,terminal:route.to});assert.equal(f.state.accounts.alice.credits,before+route.reward);assert.equal(f.state.accounts.alice.transport.active,null);assert.equal(f.state.accounts.alice.transport.completed,1);assert.equal(f.state.ships['alice:nomad'].crates.length,0);
 const loaded=JSON.parse(JSON.stringify(f.state));assert.equal(validCommerce(loaded),true);const retry=commerceCommand(loaded,'alice',done.command,ctx);assert.equal(retry.replayed,true);assert.deepEqual(retry.state,loaded);
 assert.throws(()=>f.command({...done.command,commandId:'fresh-deposit',revision:f.state.revision}),/not yours/);
});
test('invalid or orphaned mission seals and missing/duplicate crates reject the whole save',()=>{
 const f=fixture();f.accept();f.order();const good=f.state,m=good.accounts.alice.transport.active;
 const changes=[s=>{delete s.loose[m.crate];},s=>{s.loose[m.crate].transport.owner='bob';},s=>{delete s.loose[m.crate].transport;},s=>{s.loose[m.crate].sbu=2;},s=>{s.accounts.alice.transport.active=null;},s=>{s.accounts.alice.transport.version=99;},s=>{s.accounts.alice.transport.active.phase='accepted';},s=>{s.ships['alice:nomad'].crates.push(placeCrate('nomad',[],transportCargo(s.loose[m.crate])));},s=>{s.loose[m.crate].holder='bob';}];
 for(const change of changes){const state=structuredClone(good);change(state);assert.equal(validCommerce(state),false);assert.throws(()=>commerceCommand(state,'alice',{commandId:'invalid',revision:state.revision,op:'transport-abandon',mission:m.id},ctx),/invalid/);}
});
test('abandon recalls only the owner’s mission crate and grants no credits',()=>{
 for(const stage of ['accepted','loose','held','grid','carried']){
  const f=fixture();f.accept();f.accept('bob');f.order('bob');const bob=structuredClone(f.state.accounts.bob),other=f.state.accounts.bob.transport.active.crate;
  if(stage!=='accepted')f.order();if(stage==='held')f.command({op:'tractor-grab',crate:f.state.accounts.alice.transport.active.crate});if(['grid','carried'].includes(stage))f.load();if(stage==='carried')f.command({op:'take',crate:f.state.accounts.alice.transport.active.crate});
  f.command({op:'transport-abandon',mission:f.state.accounts.alice.transport.active.id});assert.equal(f.state.accounts.alice.transport.active,null);assert.equal(f.state.accounts.alice.credits,1500);assert.ok(f.state.loose[other]);assert.deepEqual(f.state.accounts.bob,bob);assert.equal(validCommerce(f.state),true);
 }
});
test('freight below another crate cannot be removed by delivery or abandonment',()=>{
 const f=fixture();f.accept();f.order();f.load();const mission=f.state.accounts.alice.transport.active;
 // Fill the remaining lower cell, then place a supported crate above freight.
 for(const id of ['plain-1','plain-2']){const h=f.state.ships['alice:nomad'];h.crates.push(placeCrate(h.hull,h.crates,{id,sbu:1,resource:'basalt'}));}assert.equal(validCommerce(f.state),true);
 for(const op of ['transport-deposit','transport-abandon'])assert.throws(()=>f.command({op,mission:mission.id,crate:mission.crate,terminal:route.to}),/above/);
});
test('solo failed writes grant neither crate nor credits; reload retains the single issued crate',()=>{
 const values=new Map();let fail=false;const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(fail)throw Error('full');values.set(k,v);}};
 let store=new MiningStore(storage),local=new LocalTrading(store),serial=0;
 const command=fields=>local.command({ship:'local-player:nomad',commandId:`local-${++serial}`,revision:local.state.revision,...fields},ctx);
 command({op:'transport-accept',route:route.id});const m=local.state.accounts['local-player'].transport.active,before=structuredClone(local.state);fail=true;
 assert.throws(()=>command({op:'transport-order',mission:m.id,terminal:route.from}),/./);assert.deepEqual(local.state,before);fail=false;store=new MiningStore(storage);local=new LocalTrading(store);
 command({op:'transport-order',mission:m.id,terminal:route.from});const reload=new LocalTrading(new MiningStore(storage));assert.equal(reload.error,'');assert.equal(Object.keys(reload.state.loose).length,1);assert.equal(reload.state.accounts['local-player'].transport.active.phase,'issued');
});

test('shared transport drive plans the real interplanetary segment and rejects forged targets, cargo, gear and reach state',async()=>{
 const {planTransportDrive}=await import('../src/transport/travel.js'),{createSettlementLayouts}=await import('../src/settlements/layout.js'),{Vector3,Quaternion,Matrix4}=await import('three'),{navigationEndpoint}=await import('../src/navigation-targets.js'),{sampleTravel}=await import('../src/travel-model.js');
 const sites=createSettlementLayouts(),targets=sites.map(s=>({id:s.id,name:s.name,body:s.body,category:'trade',surface:true,center:new Vector3(...s.pad.position).applyQuaternion(new Quaternion(...s.claim.quaternion)).add(new Vector3(...s.claim.origin)).toArray(),radius:0}));
 const f=fixture();f.accept();f.order();f.load();const from=targets.find(t=>t.id===route.from),to=targets.find(t=>t.id===route.to),position=navigationEndpoint(new Vector3(),from),direction=new Vector3(...to.center).sub(position).normalize();
 const nav={shipId:'nomad',mode:'flight',powered:true,travel:null,autoland:false,stationLift:false,carryingCargo:false,gearLimited:false,altitude:20000,flightEnvironment:{atmosphereFraction:0},position,orientation:new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(new Vector3(),direction,new Vector3(0,1,0)))};
 const provider={beacons:()=>targets},planned=planTransportDrive(f.state,'alice',to.id,nav,provider);assert.equal(planned.ok,true,planned.reason);const start=position.clone();const halfway=sampleTravel(planned.plan,planned.plan.duration/2);assert.ok(halfway.position.distanceTo(start)>1000000);assert.ok(halfway.speed>1000);assert.ok(sampleTravel(planned.plan,planned.plan.duration).position.distanceTo(navigationEndpoint(position,to))<.001);assert.deepEqual(nav.position,start);
 for(const [id,change] of [[to.id,{mode:'walk'}],[to.id,{gearLimited:true}],[to.id,{carryingCargo:true}],[to.id,{shipId:'atlas'}],[to.id,{powered:false}],[to.id,{altitude:1000,flightEnvironment:{atmosphereFraction:.4}}],[to.id,{orientation:new Quaternion()}],['settlement-miasma',{}]])assert.equal(planTransportDrive(f.state,'alice',id,{...nav,...change},provider).ok,false);
 assert.equal(planTransportDrive(f.state,'bob',to.id,nav,provider).ok,false);
});
