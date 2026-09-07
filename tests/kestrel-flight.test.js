import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Navigation} from '../src/navigation.js';
import {KESTREL_LAYOUT,KestrelAccess,constrainKestrelStep,constrainKestrelEVA} from '../src/kestrel-access.js';
import {Fleet,FLEET_KEY,SHIPS} from '../src/fleet.js';
import {testFlightStorage} from '../src/test-flight.js';
import {MiningStore} from '../src/mining/store.js';
import {ShipInventory} from '../src/ship-inventory.js';
import {bindStationLedger} from '../src/inventory/station-ledger.js';
import {constrainStationSweep} from '../src/station-collision.js';

function fixture(t){
  const oldDocument=globalThis.document,oldWindow=globalThis.window;
  globalThis.document={addEventListener(){},querySelector:()=>null,body:{classList:{toggle(){}}}};
  globalThis.window={addEventListener(){}};
  t.after(()=>{globalThis.document=oldDocument;globalThis.window=oldWindow;});
  const nav=new Navigation({addEventListener(){}},()=>{});
  nav.shipId='kestrel';nav.layout=KESTREL_LAYOUT;nav.kestrelAccess=new KestrelAccess();
  nav.shipPosition=new THREE.Vector3(1e9,1e9,1e9);nav.shipOrientation.identity();nav.orientation.identity();
  nav.position.copy(nav.fromShipLocal(new THREE.Vector3(...KESTREL_LAYOUT.seatEye)));
  nav.mode='landed';nav.dockedAtStation=true;nav.gearDeployed=true;nav.gearProgress=1;nav.insideShip=true;
  const floor=nav.shipPosition.y;
  nav.station={ready:false,up:new THREE.Vector3(0,1,0),deckPoint:point=>new THREE.Vector3(point.x,floor+1.75,point.z),openDoors(){}};
  return nav;
}
function finish(nav,hz=60){
  let steps=0,maxStep=0;
  while(nav.kestrelAccess.busy&&steps++<hz*40){
    const previous=nav.position.clone();nav.update(1/hz);
    maxStep=Math.max(maxStep,previous.distanceTo(nav.position));
  }
  assert.ok(!nav.kestrelAccess.busy,'access sequence completed');
  assert.ok(maxStep<=.9/hz+5e-7,`continuous physical motion ${maxStep}`);
}
for(const hz of [20,60,120])test(`ladder boarding is continuous at ${hz} Hz and retains double precision`,t=>{
  const n=fixture(t);n.embark();assert.equal(n.kestrelAccess.phase,'opening');
  n.landOrLaunch();assert.equal(n.mode,'landed');assert.equal(n.gearProgress,1);
  finish(n,hz);assert.equal(n.mode,'walk');assert.equal(n.insideShip,false);
  assert.ok(n.toShipLocal().distanceTo(new THREE.Vector3(...KESTREL_LAYOUT.entryEye))<3e-7);
  assert.equal(n.kestrelAccess.canopy,1);assert.equal(n.kestrelAccess.ladder,1);
  n.embark();finish(n,hz);assert.equal(n.mode,'landed');assert.equal(n.kestrelAccess.secured,true);
  assert.ok(n.toShipLocal().distanceTo(new THREE.Vector3(...KESTREL_LAYOUT.seatEye))<3e-7);
  n.landOrLaunch();assert.equal(n.mode,'flight');assert.equal(n.stationLift,true);
});
test('remote, airborne and paused interactions never move the pilot to a ladder or cabin',t=>{
  const n=fixture(t);n.mode='flight';const initial=n.position.clone();n.embark();assert.equal(n.mode,'flight');assert.equal(n.cabinFlight,false);assert.ok(n.position.equals(initial));
  n.mode='walk';n.position.x-=20;const outside=n.position.clone();n.embark();assert.equal(n.kestrelAccess.busy,false);assert.ok(n.position.equals(outside));
  n.mode='landed';n.position.copy(initial);n.embark();n.enabled=false;n.update(2);assert.equal(n.kestrelAccess.canopy,0);assert.ok(n.position.equals(initial));
});
test('the gear interlock requires the canopy and ladder to be fully secured',t=>{
  const n=fixture(t);n.kestrelAccess.canopy=.2;n.mode='flight';assert.equal(n.toggleGear(),false);assert.equal(n.gearDeployed,true);
  n.kestrelAccess.reset();assert.equal(n.toggleGear(),true);
});
test('the real fighter collision envelopes can lift off their contact plane',()=>{
  const deck=new THREE.Box3(new THREE.Vector3(-30,-.2,-40),new THREE.Vector3(30,0,40));
  const start=new THREE.Vector3(...KESTREL_LAYOUT.seatEye),end=start.clone().add(new THREE.Vector3(0,.075,0));
  for(const part of KESTREL_LAYOUT.flightParts){
    const min=new THREE.Vector3(...part.min).sub(start),max=new THREE.Vector3(...part.max).sub(start);
    const hit=constrainStationSweep({bounds:deck,boxes:[deck]},[],start,end,min,max);
    assert.equal(hit.hit,false,`false floor penetration in ${part.id}`);assert.ok(hit.point.equals(end));
  }
});
test('exterior movement is swept against the fighter, without a Nomad rear door',()=>{
  const a=new THREE.Vector3(-10,1.75,3),b=new THREE.Vector3(10,1.75,3);
  assert.ok(constrainKestrelStep(a,b).equals(a));
  const rear=new THREE.Vector3(0,1.75,9),clear=rear.clone().add(new THREE.Vector3(2,0,0));
  assert.ok(constrainKestrelStep(rear,clear).equals(clear));
  const above=new THREE.Vector3(0,8,1);assert.ok(constrainKestrelEVA(above,new THREE.Vector3(0,-2,1)).equals(above));
});
test('a pilot outside a closed ladder moves clear before any section deploys',t=>{
  const n=fixture(t);n.mode='walk';n.insideShip=false;n.position.copy(n.fromShipLocal(new THREE.Vector3(...KESTREL_LAYOUT.entryEye)));
  n.embark();assert.equal(n.kestrelAccess.phase,'staging');
  for(let i=0;i<30;i++){n.update(1/60);assert.equal(n.kestrelAccess.ladder,0);}
  assert.ok(n.toShipLocal().x<-2.8);finish(n);assert.equal(n.mode,'landed');assert.equal(n.kestrelAccess.secured,true);
});
test('Kestrel is selectable and saved independently of the Atlas milestone',()=>{
  const storage=testFlightStorage(),fleet=new Fleet(storage);assert.equal(fleet.allows('kestrel'),true);assert.equal(fleet.allows('atlas'),false);assert.equal(SHIPS.kestrel.capacity,0);
  fleet.active='kestrel';fleet.record('selection');assert.equal(new Fleet(storage).active,'kestrel');
  storage.setItem(FLEET_KEY,JSON.stringify({version:1,active:'unknown'}));assert.equal(new Fleet(storage).active,'nomad');
});
test('practice cargo stays in its own storage; an empty fighter cannot receive supplies or minerals',()=>{
  const regular=testFlightStorage(),practice=testFlightStorage();regular.setItem('sentinel','regular save');
  const inventory=new ShipInventory(practice),store=new MiningStore(practice);store.bindManifest(inventory);bindStationLedger(inventory,store);
  const before=inventory.mass('ship')+inventory.mass('station');assert.equal(inventory.transferAll('ship','station').remaining,0);
  inventory.capacity.ship=0;assert.equal(inventory.mass('ship'),0);assert.equal(inventory.mass('station'),before);
  assert.deepEqual(store.limits('ship'),{resources:0,supplies:0});assert.equal(store.validContainers(store.state),true);
  assert.equal(regular.getItem('sentinel'),'regular save');assert.equal(regular.getItem(FLEET_KEY),null);
});
