import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readGLBGeometry } from './helpers/gltf-geometry.js';
import { Fleet, FLEET_KEY } from '../src/fleet.js';
import { FreighterSystems, FREIGHTER_LAYOUT } from '../src/freighter-layout.js';
import { ShipInventory } from '../src/ship-inventory.js';
const point=(x,y,z)=>new THREE.Vector3(x,y,z);
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};};

test('Atlas requires a surface landing then a station return, survives reload and validates saves',()=>{
  const save=storage(),fleet=new Fleet(save);
  assert.equal(fleet.allows('nomad'),true);assert.equal(fleet.allows('atlas'),false);
  assert.equal(fleet.record('dock'),false);assert.equal(fleet.record('surface'),false);
  const resumed=new Fleet(save);assert.equal(resumed.surfaceVisited,true);assert.equal(resumed.allows('atlas'),false);
  assert.equal(resumed.record('dock'),true);assert.equal(resumed.record('dock'),false);
  resumed.active='atlas';resumed.record('selection');assert.equal(new Fleet(save).active,'atlas');
  save.setItem(FLEET_KEY,JSON.stringify({version:1,unlocked:true,surfaceVisited:'true',active:'atlas'}));
  assert.equal(new Fleet(save).allows('atlas'),false);assert.equal(new Fleet(save).active,'nomad');
  const volatile=new Fleet({getItem(){throw Error();},setItem(){throw Error();}});
  volatile.record('surface');assert.equal(volatile.record('dock'),true);assert.equal(volatile.saved,false);
});

test('real crew lift carries riders continuously and loading ramps gate launch',()=>{
  const systems=new FreighterSystems(),lift=systems.elevator,rider=point(5.5,4.35,-4);
  assert.equal(systems.secured,true);assert.deepEqual(systems.lifts.map(l=>l.id),['crew']);
  assert.equal(systems.toggle('crew',rider),true);assert.equal(systems.secured,false);
  for(let i=0;i<440;i++){
    const carry=systems.update(1/60,rider);assert.ok(Math.abs(carry)<=lift.speed/60+1e-10);
    rider.y+=carry;assert.ok(Math.abs(rider.y-1.75-lift.y)<1e-8);assert.equal(systems.floorAt(rider),lift.y);
  }
  assert.equal(lift.y,lift.high);assert.equal(systems.secured,true);
  systems.toggleRamp('aft');assert.equal(systems.secured,false);
  assert.equal(systems.toggle('main'),false,'retired belly elevator cannot be operated');
});

test('closed ramps and empty crew shafts block swept movement',()=>{
  const systems=new FreighterSystems();
  const aboard=point(0,4.35,23),outside=point(0,4.35,25);
  assert.deepEqual(systems.constrain(aboard,outside),aboard);
  systems.toggleRamp('aft');for(let i=0;i<400;i++)systems.update(.025);
  assert.deepEqual(systems.constrain(aboard,outside),outside);
  assert.equal(systems.toggle('crew',point(4.15,4.35,-4)),false,'straddling a real platform edge cannot move it');
  systems.toggle('crew',point(5.5,4.35,-4));for(let i=0;i<400;i++)systems.update(.025);
  assert.equal(systems.floorAt(point(5.5,4.35,-4)),null);
  assert.deepEqual(systems.constrain(point(3.5,4.35,-4),point(5.5,4.35,-4)),point(3.5,4.35,-4));
});

test('larger storage preserves manifest and backpack across capacity changes and reload',()=>{
  const save=storage(),inventory=new ShipInventory(save,2400);
  const total=inventory.mass('ship')+inventory.mass('pack');
  assert.equal(inventory.transfer('repair','ship').ok,true);
  inventory.capacity.ship=120;
  assert.equal(inventory.transfer('repair','pack').ok,true);
  assert.equal(new ShipInventory(save,2400).mass('ship')+new ShipInventory(save).mass('pack'),total);
});

test('playable Blender Atlas fits its full-scale envelope and retains authored mechanisms',async()=>{
  const {scene}=await readGLBGeometry(new URL('../public/models/atlas-mark-ii/atlas-mark-ii.glb',import.meta.url));
  const bounds=new THREE.Box3().setFromObject(scene),envelope=FREIGHTER_LAYOUT.flightBounds;
  for(let axis=0;axis<3;axis++){
    assert.ok(bounds.min.getComponent(axis)>=envelope.min[axis]-.03,`min axis ${axis}: ${bounds.min.toArray()}`);
    assert.ok(bounds.max.getComponent(axis)<=envelope.max[axis]+.03,`max axis ${axis}: ${bounds.max.toArray()}`);
  }
  for(const name of ['RampFront','RampAft','CrewElevator','LiftGateLower','LiftGateUpper'])assert.ok(scene.getObjectByName(name),name);
  for(const name of ['MainLift','PortLift','StarboardLift','CargoLid'])assert.equal(scene.getObjectByName(name),undefined,name);
  new FreighterSystems().bind(scene);scene.updateMatrixWorld(true);
  const cargo=new THREE.Raycaster(point(0,4.35,5),point(0,-1,0)).intersectObject(scene,true);
  assert.ok(cargo.length);assert.ok(Math.abs(cargo[0].point.y-2.6)<.06,'cargo deck agrees with walking floor');
  const upper=new THREE.Raycaster(point(0,11.25,-19),point(0,-1,0)).intersectObject(scene,true);
  assert.ok(upper.length&&Math.abs(upper[0].point.y-9.5)<.06,'upper deck agrees with walking floor');
});
