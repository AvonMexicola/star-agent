import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {installLandingGear,createUtilityLights} from '../src/ship-utilities.js';
import {SHIP_LAYOUT} from '../src/boarding.js';
for(const id of ['nomad','atlas'])test(`${id} authored gear retracts within the existing hull envelope and returns to the landing plane`,async()=>{
  const data=await readFile(new URL(`../public/models/${id}.glb`,import.meta.url));
  const {scene:model}=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
  const ship=new THREE.Group();ship.add(model);ship.readyPromise=Promise.resolve(model);installLandingGear(ship);await ship.readyPromise;
  ship.updateGear(0,true);assert.equal(ship.userData.gearAssemblies,4);
  const roots=[];model.traverse(n=>{if(!n.isMesh&&n.name.startsWith('LandingGear_'))roots.push(n);});
  const down=roots.map(n=>new THREE.Box3().setFromObject(n));for(const b of down)assert.ok(Math.abs(b.min.y)<.002);
  for(let i=0;i<30;i++)ship.updateGear(.1,false);assert.equal(ship.userData.gearProgress,0);
  roots.forEach((n,i)=>{const box=new THREE.Box3().setFromObject(n);assert.ok(box.min.y>down[i].min.y+.9);assert.ok(Math.abs(box.min.x-down[i].min.x)<.002);assert.ok(box.max.y<=down[i].max.y+.01);});
  for(let i=0;i<30;i++)ship.updateGear(.1,true);assert.equal(ship.userData.gearProgress,1);
  roots.forEach((n,i)=>assert.ok(new THREE.Box3().setFromObject(n).min.distanceTo(down[i].min)<.002));
});
test('utility lights rebase correctly and ship lamps never follow an unaccompanied walker',()=>{
  const scene=new THREE.Scene(),lights=createUtilityLights(scene),origin=new THREE.Vector3(1e9,2e9,3e9);
  const nav={mode:'flight',position:origin.clone(),orientation:new THREE.Quaternion(),layout:SHIP_LAYOUT,powered:true,shipLightsOn:true,flashlightOn:true};
  lights.update(nav,origin);assert.equal(lights.state.ship,true);assert.equal(lights.state.suit,false);
  const ship=scene.getObjectByName('Landing floodlight');assert.ok(ship.position.length()<20);assert.ok(ship.target.position.y<ship.position.y&&ship.target.position.z<ship.position.z);
  nav.mode='walk';lights.update(nav,origin);assert.equal(lights.state.ship,false);assert.equal(lights.state.suit,true);
  nav.shipPosition=origin.clone().add(new THREE.Vector3(20,0,0));nav.shipOrientation=new THREE.Quaternion();lights.update(nav,origin);assert.equal(lights.state.ship,true);assert.ok(ship.position.x>19);
  nav.powered=false;lights.update(nav,origin);assert.equal(lights.state.ship,false);assert.equal(lights.state.suit,true);lights.dispose();
});
