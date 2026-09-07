import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {STATION_HUB_BOUNDS,stationHubAt,isHandsFree,elevatorLocation,createHubFireGate} from '../src/station-hub-policy.js';
import {stationPhysicsAt} from '../src/station-physics.js';
import {MiningStore} from '../src/mining/store.js';
import {Loadout} from '../src/inventory/loadout.js';

function stationAt(origin){
  const quaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(.41,-.72,.26));
  const inverse=quaternion.clone().invert();
  const hub={ready:true,interiorBox:new THREE.Box3(new THREE.Vector3(...STATION_HUB_BOUNDS.min),new THREE.Vector3(...STATION_HUB_BOUNDS.max)),lift:{floor:-8,z:14.3},
    toLocal:(p,t=new THREE.Vector3())=>t.copy(p).sub(origin).applyQuaternion(inverse),toWorld:(p,t=new THREE.Vector3())=>t.copy(p).applyQuaternion(quaternion).add(origin)};
  return {ready:true,hub,pods:[],location:'hangar',up:new THREE.Vector3(0,1,0).applyQuaternion(quaternion)};
}

test('physical hub frame is independent of selected berth at planetary and stellar origins',()=>{
  for(const origin of [new THREE.Vector3(1.2e6,-.7e6,4.8e5),new THREE.Vector3(25e9,-10e9,7e9)]){
    const station=stationAt(origin),position=station.hub.toWorld(new THREE.Vector3(8,-6.25,-4));
    const grid=stationPhysicsAt(station,position);
    assert.equal(grid.id,'station:hub');assert.ok(grid.local.distanceTo(new THREE.Vector3(8,-6.25,-4))<1e-5);
    assert.equal(isHandsFree({station,position}),true);
    for(const local of [[23,-6,0],[0,2,0],[0,-9,0],[0,-6,20],[0,0,29000]]){
      assert.equal(stationHubAt(station,station.hub.toWorld(new THREE.Vector3(...local))),null,'security sphere does not invent a hub floor or selection lock');
    }
    station.ready=false;assert.equal(stationHubAt(station,position),null);
  }
});

test('passenger entry uses physical cabin height, width and door plane',()=>{
  const station=stationAt(new THREE.Vector3(2e6,3e5,7e5)),frame=station.hub;
  const point=(x,y,z)=>frame.toWorld(new THREE.Vector3(x,y,z));
  assert.equal(elevatorLocation(frame,point(0,-6.25,15.95)).cabin,true);
  assert.equal(elevatorLocation(frame,point(0,-6.25,12.3)).door,true);
  assert.equal(elevatorLocation(frame,point(0,-6.25,14.3)).threshold,true);
  assert.equal(elevatorLocation(frame,point(1.8,-6.25,15.95)).cabin,false);
  assert.equal(elevatorLocation(frame,point(0,-4.5,15.95)).cabin,false,'jumping is not settled passenger entry');
  assert.equal(elevatorLocation(frame,point(0,-4.5,15.95)).occupiesCabin,true,'jumping body still occupies a destination cabin');
  assert.equal(elevatorLocation(frame,point(0,-4.5,14.3)).threshold,true,'jumping body still prevents closing leaves');
  assert.equal(isHandsFree({station:{ready:false},stationHubTransit:{phase:'closing'}}),true);
});

test('a held trigger and a timeout reset cannot rearm until a fresh false input after exit',()=>{
  const gate=createHubFireGate();assert.equal(gate.update(false,true,1),true);
  assert.equal(gate.update(true,true,2),false);
  assert.equal(gate.update(true,false,3),false,'neutral inside is not neutral after exit');
  assert.equal(gate.update(false,false,3),false,'same restricted packet does not rearm');
  assert.equal(gate.update(false,true,4),false);
  assert.equal(gate.update(false,false,4),false,'timeout-cleared held packet is not fresh');
  assert.equal(gate.update(false,true,5),false);
  assert.equal(gate.update(false,false,6),true);
  assert.equal(gate.update(false,true,7),true);
});

test('central selection gate blocks numeric, cycle, toggle and inventory equip without touching cargo',()=>{
  const data=new Map(),disk={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  const store=new MiningStore(disk);let allowed=true;const gear=new Loadout(store,{canSelect:()=>allowed});
  assert.equal(gear.select('weapon1').ok,true);const before=structuredClone(store.state);
  allowed=false;
  for(const operation of [()=>gear.select('weapon1'),()=>gear.select('weapon2'),()=>gear.select('tool'),()=>gear.cycle(),()=>gear.toggleTool(),()=>gear.assign('weapon1','rifle-laser')]){
    const result=operation();assert.equal(result.ok,false);assert.match(result.message,/Community hub/);
  }
  assert.equal(gear.item,null);assert.equal(gear.spendRound('rifle-laser'),false);assert.deepEqual(store.state,before);
  assert.equal(gear.select(null).ok,true);allowed=true;assert.equal(gear.item,null,'exit leaves gear stowed');
  assert.equal(gear.select('weapon2').ok,true);assert.equal(gear.spendRound('sidearm-pistol'),true);
});

test('failed stow persistence cannot expose or fire a restricted held item',()=>{
  const store=new MiningStore({getItem:()=>null,setItem(){throw Error('quota');}}),gear=new Loadout(store,{canSelect:()=>false});
  const before=structuredClone(store.state);
  assert.equal(gear.select(null).ok,false);assert.deepEqual(store.state,before);
  assert.equal(gear.item,null);assert.equal(gear.spendRound('rifle-laser'),false);
});
