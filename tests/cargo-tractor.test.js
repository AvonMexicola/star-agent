import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { emptyCommerce,ensureAccount,commerceCommand,validCommerce } from '../src/trading/model.js';
import { placeCrate } from '../src/cargo/grid.js';
import { tractorContext } from '../src/cargo/tractor-context.js';
import { tractorClear,tractorStep,tractorSlot,detachedPose,aimedCrate,constrainLooseCargo,tractorSpeed } from '../src/cargo/tractor-physics.js';
import { FreighterSystems } from '../src/freighter-layout.js';
const pose={position:new T.Vector3(),quaternion:new T.Quaternion()};
const aim=(a,b)=>new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,-1),b.clone().sub(a).normalize());
function rig(hull='nomad',sbu=2){
  let state=emptyCommerce(),clock=1000,serial=0;ensureAccount(state,'alice');ensureAccount(state,'bob');
  const id=`alice:${hull}`,ship=state.ships[id];ship.crates.push(placeCrate(hull,[],{id:'freight',sbu,resource:'basalt'}));
  const ships=()=>[{...state.ships[id],pose,open:true,speed:0,systems:hull==='atlas'?new FreighterSystems():null}];
  const c=detachedPose(ships()[0],ship.crates[0]),nav={mode:'walk',shipSpeed:0,position:new T.Vector3(hull==='nomad'?0:-3.5,hull==='nomad'?2.75:5.75,2.7)};
  nav.orientation=aim(nav.position,new T.Vector3(...c.position));
  const context={now:()=>clock,loot:()=>true,tractor:tractorContext({nav,ships,loose:()=>Object.values(state.loose??{})})};
  return {nav,ships,context,get state(){return state;},time(ms=200){clock+=ms;},run(owner,fields){const result=commerceCommand(state,owner,{commandId:`tractor-${++serial}`,revision:state.revision,ship:id,...fields},context);state=result.state;return result;}};
}
test('2SBU physically leaves its grid, lease blocks another pilot, release persists and stow preserves ID',()=>{
  const r=rig();r.run('alice',{op:'tractor-grab',crate:'freight'});assert.equal(r.state.ships['alice:nomad'].crates.length,0);assert.equal(r.state.loose.freight.sbu,2);assert.equal(r.state.accounts.alice.carried,null);assert.equal(validCommerce(r.state),true);
  assert.throws(()=>r.run('bob',{op:'tractor-grab',crate:'freight'}),/Another pilot/);
  r.run('alice',{op:'tractor-release',crate:'freight'});const saved=structuredClone(r.state);assert.equal(saved.loose.freight.holder,null);
  r.run('alice',{op:'tractor-grab',crate:'freight'});r.run('alice',{op:'tractor-stow',crate:'freight'});assert.equal(r.state.ships['alice:nomad'].crates[0].id,'freight');assert.equal(Object.keys(r.state.loose).length,0);
});
test('expired/disconnected lease retains physical freight and can be reclaimed exactly once',()=>{
  const r=rig();r.run('alice',{op:'tractor-grab',crate:'freight'});r.time(1600);
  assert.throws(()=>r.run('alice',{op:'tractor-move',crate:'freight',distance:4}),/expired/);
  r.run('bob',{op:'tractor-grab',crate:'freight'});assert.throws(()=>r.run('alice',{op:'tractor-release',crate:'freight'}),/No tractor lock/);assert.equal(r.state.loose.freight.holder,'bob');assert.equal(validCommerce(r.state),true);
});
test('theft, empty hands, aim and support rules still apply to a powered tractor',()=>{
  const r=rig();r.context.loot=()=>false;assert.throws(()=>r.run('bob',{op:'tractor-grab',crate:'freight'}),/Board/);
  r.nav.orientation.set(0,0,0,1);assert.throws(()=>r.run('alice',{op:'tractor-grab',crate:'freight'}),/Aim/);
  r.nav.orientation=aim(r.nav.position,new T.Vector3(...detachedPose(r.ships()[0],r.state.ships['alice:nomad'].crates[0]).position));
  r.state.accounts.alice.carried={id:'hand',sbu:1,resource:'ice'};assert.throws(()=>r.run('alice',{op:'tractor-grab',crate:'freight'}),/hand-carried/);r.state.accounts.alice.carried=null;
  r.state.ships['alice:nomad'].crates.push({...r.state.ships['alice:nomad'].crates[0],id:'above',cell:[0,1,0]});assert.throws(()=>r.run('alice',{op:'tractor-grab',crate:'freight'}),/above/);
});
test('64SBU moves continuously at its lower speed and cannot secure from across the hold',()=>{
  const r=rig('atlas',64);r.nav.position.set(0,5.75,2.5);r.nav.orientation=aim(r.nav.position,new T.Vector3(...detachedPose(r.ships()[0],r.state.ships['alice:atlas'].crates[0]).position));r.run('alice',{op:'tractor-grab',crate:'freight'});let last=new T.Vector3(...r.state.loose.freight.position);
  const goal=new T.Vector3(-2,5.225,2.5);r.nav.orientation=aim(r.nav.position,goal);const distance=r.nav.position.distanceTo(goal);
  for(let i=0;i<25;i++){r.time();r.run('alice',{op:'tractor-move',crate:'freight',distance});const next=new T.Vector3(...r.state.loose.freight.position);assert.ok(last.distanceTo(next)<=.200001);last=next;}
  assert.ok(last.distanceTo(goal)<.01);assert.throws(()=>r.run('alice',{op:'tractor-stow',crate:'freight'}),/Guide/);assert.ok(tractorSpeed(64)<tractorSpeed(2));
});
test('crate-volume sweeps block the roof, closed hatch, other cargo and large-crate tunnelling',()=>{
  const ship={id:'s',hull:'nomad',pose,crates:[],open:false},c={id:'moving',sbu:2,quaternion:[0,0,0,1]};
  assert.equal(tractorClear(new T.Vector3(0,1.5,2.7),new T.Vector3(0,1.5,6),c,[ship]),false);
  ship.open=true;assert.equal(tractorClear(new T.Vector3(0,1.5,2.7),new T.Vector3(0,1.5,6),c,[ship]),true);
  assert.equal(tractorClear(new T.Vector3(0,2.5,2.7),new T.Vector3(0,3.1,2.7),c,[ship]),false);
  ship.crates=[placeCrate('nomad',[],{id:'blocker',sbu:2})];assert.equal(tractorClear(new T.Vector3(0,1.3,2.7),new T.Vector3(1.3,1.3,2.7),c,[ship]),false);
  assert.equal(tractorClear(new T.Vector3(0,2,2.7),new T.Vector3(0,2,6),{...c,sbu:64},[ship]),false);
});
test('beam cannot lock through a closed hull and keeps metre precision far from origin',()=>{
  const r=rig(),ships=r.ships();ships[0].open=false;const eye=new T.Vector3(0,2.75,6),c=ships[0].crates[0],centre=new T.Vector3(...detachedPose(ships[0],c).position);
  assert.equal(aimedCrate(eye,aim(eye,centre),ships),null);ships[0].open=true;assert.equal(aimedCrate(eye,aim(eye,centre),ships)?.id,'freight');
  const offset=new T.Vector3(25e9,0,0),world={...ships[0],pose:{...pose,position:offset}},target=aimedCrate(r.nav.position.clone().add(offset),r.nav.orientation,[world]);assert.equal(target?.id,'freight');assert.ok(target.distance<4);
});
test('detached cargo is solid for walking and EVA; invalid or duplicated save entries reject',()=>{
  const r=rig();r.run('alice',{op:'tractor-grab',crate:'freight'});const c=r.state.loose.freight;
  const a=new T.Vector3(0,2.75,2.7),b=new T.Vector3(1.2,2.75,2.7);assert.deepEqual(constrainLooseCargo(a,b,[c]).toArray(),a.toArray());
  assert.equal(constrainLooseCargo(new T.Vector3(0,1.3,2.7),new T.Vector3(1.2,1.3,2.7),[c],{eva:true}).x,0);
  r.state.ships['alice:nomad'].crates.push(placeCrate('nomad',[],{id:c.id,sbu:2,resource:'basalt'}));assert.equal(validCommerce(r.state),false);r.state.ships['alice:nomad'].crates=[];c.position[0]=Infinity;assert.equal(validCommerce(r.state),false);
});
