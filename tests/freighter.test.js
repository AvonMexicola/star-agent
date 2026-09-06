import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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

test('all three lifts carry riders continuously, stop exactly at landings and gate launch',()=>{
  for(const index of [0,1,2]){
    const systems=new FreighterSystems(),lift=systems.lifts[index];
    const rider=point(...[lift.control[0],lift.y+1.75,lift.control[1]]);
    assert.equal(systems.secured,true);assert.equal(systems.toggle(lift.id,rider),true);assert.equal(systems.secured,false);
    assert.equal(systems.toggle(lift.id,rider),false);
    const destination=lift.target;
    for(let i=0;i<700;i++){
      const carry=systems.update(1/60,rider);assert.ok(Math.abs(carry)<=lift.speed/60+1e-10);
      rider.y+=carry;assert.ok(Math.abs(rider.y-1.75-lift.y)<1e-8);
      assert.equal(systems.floorAt(rider),lift.y);
    }
    assert.equal(lift.y,destination);
    assert.equal(systems.toggle(lift.id,rider),true);
    for(let i=0;i<700;i++)rider.y+=systems.update(1/60,rider);
    assert.equal(systems.secured,true);
  }
});

test('empty shafts and moving platforms block swept walking; ground boarding has no height teleport',()=>{
  const systems=new FreighterSystems();
  const before=point(0,5.75,-1),overShaft=point(0,5.75,5);
  assert.deepEqual(systems.constrain(before,overShaft),overShaft);
  systems.toggle('main');for(let i=0;i<400;i++)systems.update(.025);
  assert.deepEqual(systems.constrain(before,overShaft),before);
  assert.equal(systems.floorAt(overShaft),null);
  const ground=point(0,1.75,11),aboard=point(0,1.75,9);
  assert.deepEqual(systems.constrain(ground,aboard),aboard);assert.equal(systems.floorAt(aboard),0);
  assert.equal(systems.toggle('main',point(3.9,1.75,5)),false);
  assert.equal(systems.toggle('main',aboard),true);
  assert.deepEqual(systems.constrain(aboard,ground),aboard);
  assert.deepEqual(systems.constrain(point(0,5.75,-7.5),point(5,5.75,-7.5)),point(0,5.75,-7.5));
});

test('larger storage preserves manifest and backpack across capacity changes and reload',()=>{
  const save=storage(),inventory=new ShipInventory(save,2400);
  const total=inventory.mass('ship')+inventory.mass('pack');
  assert.equal(inventory.transfer('repair','ship').ok,true);
  inventory.capacity.ship=120;
  assert.equal(inventory.transfer('repair','pack').ok,true);
  assert.equal(new ShipInventory(save,2400).mass('ship')+new ShipInventory(save).mass('pack'),total);
});

test('original Blender freighter fits its collision envelope and retains all animated nodes',async()=>{
  const bytes=await readFile(new URL('../public/models/atlas.glb',import.meta.url));
  const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const bounds=new THREE.Box3().setFromObject(scene),envelope=FREIGHTER_LAYOUT.flightBounds;
  for(let axis=0;axis<3;axis++){
    assert.ok(bounds.min.getComponent(axis)>=envelope.min[axis]-.03,`min axis ${axis}: ${bounds.min.toArray()}`);
    assert.ok(bounds.max.getComponent(axis)<=envelope.max[axis]+.03,`max axis ${axis}: ${bounds.max.toArray()}`);
  }
  for(const name of ['MainLift','PortLift','StarboardLift','CargoLid'])assert.ok(scene.getObjectByName(name),name);
  assert.ok(Math.abs(scene.getObjectByName('MainLift').position.y-4)<.001);
  const ray=new THREE.Raycaster(point(0,8,5),point(0,-1,0));
  scene.updateMatrixWorld(true);const hits=ray.intersectObject(scene,true);
  assert.ok(hits.length);assert.ok(hits[0].point.y<4.1,'belly shaft contains only its moving platform, no hull slab');
  const bridgeRay=new THREE.Raycaster(point(0,5.75,-10.5),point(0,-1,0));
  assert.ok(bridgeRay.intersectObject(scene,true)[0].point.y<4.8,'bridge has a human-scale chair and floor');
  for(const x of [-4.8,4.8]){
    const ceiling=new THREE.Raycaster(point(x,8.9,-7),point(0,1,0)).intersectObject(scene,true);
    assert.ok(ceiling.length && ceiling[0].point.y>9,'upper landing retains headroom beneath the roof');
  }
});
