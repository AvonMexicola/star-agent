import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {emptyCommerce,ensureAccount,commerceCommand,validCommerce} from '../src/trading/model.js';
import {RECOVERY_JOBS,recoveryPose,recoveryEncounter,RECOVERY_CRATE_CENTRES} from '../src/recovery/catalog.js';
import {transportCargo,cargoVisibleTo} from '../src/transport/catalog.js';
import {disabledAtlasSystems,wreckParts,wreckRaycast} from '../src/recovery/geometry.js';
import {placeCrate,validGrid} from '../src/cargo/grid.js';
import {tractorClear} from '../src/cargo/tractor-physics.js';
import {createSettlementLayouts} from '../src/settlements/layout.js';
import {BODIES} from '../src/celestial.js';
import {LocalTrading} from '../src/trading/local.js';
import {MiningStore} from '../src/mining/store.js';
const position=[7000000.125,9000000.25,4000000.5],quaternion=[0,0,0,1];
function fixture(){let state=emptyCommerce(),serial=0,defeated=false;ensureAccount(state,'alice');ensureAccount(state,'bob');
 const ctx={now:()=>1000,terminal:()=>true,docked:()=>true,crate:()=>true,loot:()=>true,grid:()=>true,recovery:{available:()=>true,canAccept:()=>true,pose:()=>({position:[...position],quaternion:[...quaternion]}),atWreck:()=>true,defeated:()=>defeated,canHandle:id=>Object.values(state.accounts).some(a=>a.recovery?.active?.id===id&&a.recovery.active.cleared)},tractor:{grab:()=>true,stow:(c,s)=>placeCrate(s.hull,s.crates,transportCargo(c))}};
 return {ctx,get state(){return state;},set state(s){state=s;},set defeated(x){defeated=x;},mission(owner='alice'){return state.accounts[owner].recovery.active;},command(fields,context=ctx,owner='alice'){const command={commandId:`case-${++serial}`,revision:state.revision,ship:`${owner}:nomad`,...fields};const result=commerceCommand(state,owner,command,context);state=result.state;return {...result,command};},accept(job='silent-atlas',owner='alice'){return this.command({op:'recovery-accept',job},ctx,owner);},arrive(owner='alice'){return this.command({op:'recovery-arrive',mission:this.mission(owner).id},ctx,owner);},load(id,owner='alice'){this.command({op:'tractor-grab',crate:id},ctx,owner);this.command({op:'tractor-stow',crate:id},ctx,owner);},deposit(){return this.command({op:'recovery-deposit',mission:this.mission().id,terminal:'settlement-aeon'});}};
}
test('three fixed deep-space contracts have true cargo capacity and increasing threats/rewards',()=>{
 const site=createSettlementLayouts().find(s=>s.id==='settlement-aeon');assert.deepEqual(RECOVERY_JOBS.map(j=>j.guards.length),[0,2,3]);
 for(const j of RECOVERY_JOBS){const p=recoveryPose(j,site);for(const b of BODIES.filter(b=>!b.star))assert.ok(new Vector3(...p.position).distanceTo(new Vector3(...b.center))-b.radius>1000000);assert.ok(j.crates*j.sbu<=6);assert.equal(j.sbu,2);const contract=recoveryEncounter(j,{id:'recovery-17'});assert.equal(contract.id,'recovery-17');assert.equal(contract.total,j.guards.length);}
});
test('accepting creates a personal contract, no cargo, no movement, stock or credits',()=>{
 const f=fixture(),before=structuredClone(f.state),poseInput=[...position];f.accept();assert.equal(f.mission().phase,'accepted');assert.deepEqual(f.mission().crates,[]);assert.equal(Object.keys(f.state.loose??{}).length,0);assert.deepEqual(f.state.ships,before.ships);assert.deepEqual(f.state.markets,before.markets);assert.equal(f.state.accounts.alice.credits,1500);assert.deepEqual(position,poseInput);assert.throws(()=>f.accept(),/current recovery/);
 const denied=fixture();assert.throws(()=>denied.command({op:'recovery-accept',job:'silent-atlas'},{...denied.ctx,recovery:undefined}),/solo/);assert.deepEqual(denied.state,before);
});
test('arrival is derived from actual wreck proximity, issues only once and rejects another owner',()=>{
 const f=fixture();f.accept();const m=f.mission(),before=structuredClone(f.state);
 assert.throws(()=>f.command({op:'recovery-arrive',mission:m.id},{...f.ctx,recovery:{...f.ctx.recovery,atWreck:()=>false}}),/Fly to/);
 assert.throws(()=>f.command({op:'recovery-arrive',mission:m.id},f.ctx,'bob'),/not yours/);assert.deepEqual(f.state,before);
 const issued=f.arrive();assert.equal(f.mission().crates.length,1);assert.equal(f.mission().loot.length,1);assert.equal(Object.keys(f.state.loose).length,2);assert.equal(f.state.ships['alice:nomad'].crates.length,0);
 assert.equal(commerceCommand(f.state,'alice',issued.command,f.ctx).replayed,true);assert.throws(()=>f.arrive(),/already/);assert.equal(validCommerce(f.state),true);
});
test('guarded cargo is visible inside the wreck but cannot be tractored until the actual sortie clears',()=>{
 const f=fixture();f.accept('raider-claim');f.arrive();const m=f.mission(),before=structuredClone(f.state);assert.equal(m.cleared,false);
 for(const id of [...m.crates,...m.loot])assert.throws(()=>f.command({op:'tractor-grab',crate:id}),/defending flight/);assert.throws(()=>f.command({op:'recovery-clear',mission:m.id}),/not cleared/);assert.deepEqual(f.state,before);
 f.defeated=true;f.command({op:'recovery-clear',mission:m.id});assert.equal(f.mission().cleared,true);f.load(m.crates[0]);assert.equal(f.state.ships['alice:nomad'].crates.length,1);
});
test('two owners have unique sealed crates; foreign tractor locks and substitution fail',()=>{
 const f=fixture();f.accept();f.accept('silent-atlas','bob');f.arrive();f.arrive('bob');const a=f.mission(),b=f.mission('bob');assert.notEqual(a.id,b.id);assert.equal(new Set([...a.crates,...a.loot,...b.crates,...b.loot]).size,4);
 const c=f.state.loose[a.crates[0]];assert.equal(cargoVisibleTo(c,'alice'),true);assert.equal(cargoVisibleTo(c,'bob'),false);assert.throws(()=>f.command({op:'tractor-grab',crate:c.id},f.ctx,'bob'),/another pilot/);
 const before=structuredClone(f.state);assert.throws(()=>f.command({op:'recovery-deposit',mission:a.id,terminal:'settlement-aeon'}),/every original/);assert.deepEqual(f.state,before);
});
test('only the specified original container is required; payment and leftover cleanup are atomic after reload',()=>{
 const f=fixture();f.accept('broken-convoy');f.arrive();f.defeated=true;f.command({op:'recovery-clear',mission:f.mission().id});const m=structuredClone(f.mission());for(const id of m.crates)f.load(id);
 const crates=f.state.ships['alice:nomad'].crates;assert.equal(validGrid('nomad',crates),true);assert.equal(crates.length,1);assert.equal(Object.keys(f.state.loose).length,2);assert.deepEqual(crates.map(c=>c.recovery),[{id:m.id,owner:'alice'}]);
 assert.throws(()=>f.command({op:'take',crate:m.crates[0]}),/above|Only a 1 SBU/);assert.throws(()=>f.command({op:'sell',crate:m.crates[0],resource:'conductor',sbu:2,terminal:'station:1'}),/Sealed/);
 const done=f.deposit();assert.equal(f.state.accounts.alice.credits,3900);assert.equal(f.state.accounts.alice.recovery.completed,1);assert.equal(f.state.accounts.alice.recovery.active,null);assert.equal(f.state.ships['alice:nomad'].crates.length,0);
 const loaded=JSON.parse(JSON.stringify(f.state));assert.equal(validCommerce(loaded),true);assert.deepEqual(commerceCommand(loaded,'alice',done.command,f.ctx).state,loaded);assert.throws(()=>f.command({...done.command,commandId:'again',revision:f.state.revision}),/not yours/);
});
test('remote, wrong-site, wrong-ship and incomplete-manifest deposits preserve all state',()=>{
 const f=fixture();f.accept();f.arrive();for(const id of f.mission().crates)f.load(id);const m=f.mission(),before=structuredClone(f.state),command={op:'recovery-deposit',mission:m.id,terminal:'settlement-aeon'};
 for(const [fields,ctx] of [[{...command,terminal:'settlement-pyre'},f.ctx],[command,{...f.ctx,terminal:()=>false}],[command,{...f.ctx,docked:()=>false}],[{...command,ship:'bob:nomad'},f.ctx],[{...command,ship:'alice:atlas'},f.ctx]]){assert.throws(()=>f.command(fields,ctx));assert.deepEqual(f.state,before);}
});
test('cargo stacked above the mission container must be unloaded before recall or deposit',()=>{
 const f=fixture();f.accept();f.arrive();for(const id of f.mission().crates)f.load(id);const ship=f.state.ships['alice:nomad'];ship.crates.push(placeCrate('nomad',ship.crates,{id:'ordinary',sbu:2,resource:'ice'}));assert.equal(validCommerce(f.state),true);const before=structuredClone(f.state);
 assert.throws(()=>f.deposit(),/stacked above/);assert.throws(()=>f.command({op:'recovery-abandon',mission:f.mission().id}),/stacked above/);assert.deepEqual(f.state,before);
 ship.crates.pop();f.command({op:'recovery-abandon',mission:f.mission().id});assert.equal(f.state.accounts.alice.credits,1500);assert.equal(f.state.ships['alice:nomad'].crates.length,0);
});
test('abandoning recalls only that mission across unissued, loose, held and mixed grid custody',()=>{
 for(const phase of ['accepted','loose','held','grid']){const f=fixture();f.accept();f.accept('silent-atlas','bob');f.arrive('bob');const other=structuredClone(f.state.accounts.bob),ids=[...f.mission('bob').crates,...f.mission('bob').loot];if(phase!=='accepted')f.arrive();if(phase==='held')f.command({op:'tractor-grab',crate:f.mission().crates[0]});if(phase==='grid')f.load(f.mission().crates[0]);f.command({op:'recovery-abandon',mission:f.mission().id});assert.deepEqual(f.state.accounts.bob,other);assert.ok(ids.every(id=>f.state.loose[id]));assert.equal(f.state.accounts.alice.credits,1500);assert.equal(validCommerce(f.state),true);}
});
test('missing, duplicated, foreign, altered and orphaned recovery cargo never grants replacement crates',()=>{
 const f=fixture();f.accept();f.arrive();const good=f.state,m=f.mission(),id=m.crates[0];
 for(const alter of [s=>delete s.loose[id],s=>delete s.loose[id].recovery,s=>s.loose[id].recovery.owner='bob',s=>s.loose[id].recovery.optional=true,s=>s.loose[id].holder='bob',s=>s.loose[id].sbu=1,s=>s.loose[id].resource='ice',s=>s.accounts.alice.recovery.active=null,s=>s.accounts.alice.recovery.active.crates.push(id),s=>s.accounts.alice.recovery.version=2,s=>s.accounts.alice.recovery.active.quaternion=[0,0,0,0],s=>s.ships['alice:nomad'].crates.push(placeCrate('nomad',[],transportCargo(s.loose[id])))]){const s=structuredClone(good);alter(s);assert.equal(validCommerce(s),false);assert.throws(()=>commerceCommand(s,'alice',{commandId:'invalid',revision:s.revision,op:'recovery-arrive',mission:m.id},f.ctx),/invalid/);}
});
test('failed local saves grant no crates; reloading preserves exact issued cargo and clearance',()=>{
 const values=new Map();let fail=false;const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(fail)throw Error('disk full');values.set(k,v);}};let store=new MiningStore(storage),local=new LocalTrading(store),serial=0;const f=fixture();
 const command=fields=>local.command({commandId:`save-${++serial}`,revision:local.state.revision,ship:'local-player:nomad',...fields},f.ctx);
 command({op:'recovery-accept',job:'silent-atlas'});const m=local.state.accounts['local-player'].recovery.active,before=structuredClone(local.state);fail=true;assert.throws(()=>command({op:'recovery-arrive',mission:m.id}));assert.deepEqual(local.state,before);fail=false;store=new MiningStore(storage);local=new LocalTrading(store);command({op:'recovery-arrive',mission:m.id});const saved=structuredClone(local.state);local=new LocalTrading(new MiningStore(storage));assert.deepEqual(local.state,saved);assert.throws(()=>command({op:'recovery-arrive',mission:m.id}),/already/);
});
test('open Atlas ramps admit real crates while walls and whole ship envelopes block penetration in deep-space doubles',()=>{
 const systems=disabledAtlasSystems(),parts=wreckParts(systems),pose={position:new Vector3(...position),quaternion:new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.4)},world=p=>new Vector3(...p).applyQuaternion(pose.quaternion).add(pose.position);
 assert.ok(systems.snapshot.ramps.every(r=>r.progress===1&&r.tipAngle===0));const ship={hull:'atlas',crates:[],pose,systems,open:true};
 for(const centre of RECOVERY_CRATE_CENTRES){const c={id:'probe',sbu:2,position:world(centre).toArray(),quaternion:pose.quaternion.toArray()};assert.equal(tractorClear(world(centre),world([centre[0],centre[1],35]),c,[ship]),true);assert.equal(tractorClear(world(centre),world([10,centre[1],centre[2]]),c,[ship]),false);}
 assert.equal(wreckRaycast(world([0,4,40]),new Vector3(0,0,-1).applyQuaternion(pose.quaternion),20,pose,parts),null);
 const wall=wreckRaycast(world([0,4,20]),new Vector3(1,0,0).applyQuaternion(pose.quaternion),20,pose,parts);assert.ok(wall&&wall.distance>0&&wall.distance<8);
 const flight=wreckRaycast(world([0,4,60]),new Vector3(0,0,-1).applyQuaternion(pose.quaternion),50,pose,parts,{min:[-6,-3,-6],max:[6,3,6],orientation:pose.quaternion});assert.ok(flight&&flight.distance<30);
});


test('grid capacity is advisory: a full ship can accept without creating or repacking cargo',()=>{
 const f=fixture(),ship=f.state.ships['alice:nomad'];
 for(let i=0;i<3;i++)ship.crates.push(placeCrate('nomad',ship.crates,{id:`full-${i}`,sbu:2,resource:'ice'}));
 const before=structuredClone(ship.crates);const accepted=f.accept();
 assert.match(accepted.message,/Required grid: 2 SBU/);assert.match(accepted.message,/0.6 × 0.6 × 1.2 m/);
 assert.deepEqual(f.state.ships[ship.id].crates,before);assert.equal(Object.keys(f.state.loose??{}).length,0);assert.equal(f.mission().phase,'accepted');
});
test('bonus loot cannot replace the specific objective; secured loot survives delivery and can be sold',()=>{
 const f=fixture();f.accept();f.arrive();const m=structuredClone(f.mission());
 f.load(m.loot[0]);const before=structuredClone(f.state);
 assert.throws(()=>f.deposit(),/every original/);assert.deepEqual(f.state,before);
 f.load(m.crates[0]);f.state=JSON.parse(JSON.stringify(f.state));assert.equal(validCommerce(f.state),true);
 f.deposit();const kept=f.state.ships['alice:nomad'].crates;assert.equal(kept.length,1);assert.equal(kept[0].id,m.loot[0]);assert.equal(kept[0].recovery,undefined);assert.equal(Object.keys(f.state.loose).length,0);
 const credits=f.state.accounts.alice.credits;f.command({op:'sell',crate:kept[0].id,resource:'copper',sbu:2,terminal:'station:1'});assert.ok(f.state.accounts.alice.credits>credits);assert.equal(f.state.ships['alice:nomad'].crates.length,0);
});
test('optional loot can be sold before completion without voiding or respawning the mission',()=>{
 const f=fixture();f.accept();f.arrive();const m=structuredClone(f.mission());f.load(m.loot[0]);
 f.command({op:'sell',crate:m.loot[0],resource:'copper',sbu:2,terminal:'station:1'});assert.equal(validCommerce(f.state),true);assert.throws(()=>f.arrive(),/already/);
 assert.deepEqual(f.mission().crates,m.crates);f.load(m.crates[0]);f.deposit();assert.equal(f.state.accounts.alice.recovery.completed,1);
});
test('abandonment retains secured bonus loot, recalls unsecured cargo and does not pay a mission reward',()=>{
 const f=fixture();f.accept('broken-convoy');f.arrive();f.defeated=true;f.command({op:'recovery-clear',mission:f.mission().id});const m=structuredClone(f.mission());f.load(m.loot[0]);
 f.command({op:'tractor-grab',crate:m.loot[1]});f.command({op:'recovery-abandon',mission:m.id});
 assert.equal(f.state.accounts.alice.credits,1500);assert.equal(Object.keys(f.state.loose).length,0);assert.equal(f.state.ships['alice:nomad'].crates.length,1);assert.equal(f.state.ships['alice:nomad'].crates[0].id,m.loot[0]);assert.equal(f.state.ships['alice:nomad'].crates[0].recovery,undefined);assert.equal(validCommerce(f.state),true);
});
test('optional cargo remains owner-private and cannot be relabelled as the mission container',()=>{
 const f=fixture();f.accept();f.accept('silent-atlas','bob');f.arrive();f.arrive('bob');const m=f.mission(),id=m.loot[0],good=f.state;
 assert.equal(cargoVisibleTo(good.loose[id],'bob'),false);assert.throws(()=>f.command({op:'tractor-grab',crate:id},f.ctx,'bob'),/another pilot/);
 for(const alter of [s=>delete s.loose[id].recovery.optional,s=>s.loose[id].recovery.optional=false,s=>s.loose[id].recovery.owner='bob',s=>s.loose[id].resource='conductor',s=>s.accounts.alice.recovery.active.loot=[m.crates[0]],s=>s.loose[id].recovery.extra=true]){const s=structuredClone(good);alter(s);assert.equal(validCommerce(s),false);}
});
test('earlier accepted development manifests keep their original required containers on reload',()=>{
 const f=fixture();f.accept('broken-convoy');delete f.mission().loot;assert.equal(validCommerce(f.state),true);f.state=JSON.parse(JSON.stringify(f.state));f.arrive();assert.equal(f.mission().crates.length,3);assert.equal(f.mission().loot,undefined);
 f.defeated=true;f.command({op:'recovery-clear',mission:f.mission().id});for(const id of f.mission().crates)f.load(id);f.deposit();assert.equal(f.state.ships['alice:nomad'].crates.length,0);assert.equal(f.state.accounts.alice.credits,3900);
});
