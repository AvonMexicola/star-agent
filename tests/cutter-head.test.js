import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {loadAsset,avatarFixture} from './avatar-fixture.js';
import {ITEMS} from '../src/equipment.js';
import {updateCutterHead} from '../src/mining/cutter-head.js';

test('actual cutter cartridge turns about the beam axis with continuous clearance from body and optical shaft',async()=>{
  const {scene}=await loadAsset(ITEMS['mining-laser-tool'].file),rotor=scene.getObjectByName('CutterRotor');
  assert.ok(rotor);scene.updateMatrixWorld(true);
  assert.ok(rotor.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(-.52,.14,0))<1e-6);
  assert.equal(rotor.userData.mount,'K17-M30');
  const mount=scene.getObjectByName('HeadMount');
  assert.ok(mount.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(-.44,.14,0))<1e-6);
  const body=[],moving=[];
  scene.traverse(o=>{if(o.isMesh){let parent=o,spins=false;while(parent){if(parent===rotor)spins=true;parent=parent.parent;}(spins?moving:body).push(o);}});
  assert.ok(moving.length>=2&&body.length>=2,'material batches stay within fixed/moving assemblies');
  const fixed=body.map(o=>o.matrixWorld.clone()),base=rotor.quaternion.clone();
  let minimumRadius=Infinity,rearX=-Infinity;
  for(let sample=0;sample<24;sample++){
    rotor.quaternion.copy(base).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),sample*Math.PI/12));
    scene.updateMatrixWorld(true);
    for(const mesh of moving){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){
      const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);
      minimumRadius=Math.min(minimumRadius,Math.hypot(v.y-.14,v.z));rearX=Math.max(rearX,v.x);
    }}
    for(const [i,o] of body.entries())assert.ok(o.matrixWorld.equals(fixed[i]),'fixed body is unaffected');
    const muzzle=scene.getObjectByName('muzzle').getWorldPosition(new THREE.Vector3());
    assert.ok(muzzle.distanceTo(new THREE.Vector3(...ITEMS['mining-laser-tool'].muzzle))<1e-6);
    for(const y of [-.006,0,.006])for(const z of [-.006,0,.006]){
      assert.equal(new THREE.Raycaster(muzzle.clone().add(new THREE.Vector3(0,y,z)),new THREE.Vector3(-1,0,0),0,.08).intersectObject(scene,true).length,0,'central emitter unobstructed at every rotor phase');
    }
  }
  assert.ok(minimumRadius>.030,'at least 3 mm radial clearance around 27 mm fixed shaft');
  assert.ok(rearX<-.444,'at least 8 mm axial clearance before bearing front at -436 mm');
  for(const mesh of body){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){
    const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);
    if(v.x<-.444)assert.ok(Math.hypot(v.y-.14,v.z)<.0271,'only fixed optical shaft/lens extends into cartridge envelope');
  }}
});

test('rotor animation preserves its authored transform, ramps, coasts and isolates cloned players',async()=>{
  const {scene}=await loadAsset(ITEMS['mining-laser-tool'].file),other=scene.clone(true);
  const second=other.getObjectByName('CutterRotor').quaternion.clone();
  let state;
  for(let i=0;i<45;i++)state=updateCutterHead(scene,1/60,true);
  assert.equal(state.speed,8);assert.ok(state.angle>2);
  assert.ok(other.getObjectByName('CutterRotor').quaternion.equals(second));
  state=updateCutterHead(scene,1/60,false);assert.ok(state.speed>0&&state.speed<8);
  for(let i=0;i<60;i++)state=updateCutterHead(scene,1/60,false);
  assert.equal(state.speed,0);const stopped=state.angle;
  assert.equal(updateCutterHead(scene,NaN,true).angle,stopped);
  assert.equal(updateCutterHead(scene,1,false,false).speed,0);
  assert.equal(updateCutterHead(new THREE.Group(),1,true),null);
});

test('equipped cutter spins only with the real heat-gated beam and stops when holstered',async()=>{
  const {character,equipment}=await avatarFixture();
  try{
    await equipment.equip('mining-laser-tool');character.update(.016,{aiming:'tool'});equipment.aimHeld(new THREE.Vector3(0,0,-1));equipment.update(.016,{firing:false});
    const muzzle=equipment.muzzleWorldPosition().clone();
    for(let i=0;i<30;i++)equipment.update(1/60,{firing:true});
    assert.ok(equipment.beaming);assert.equal(equipment.cutterHead.speed,8);
    assert.ok(equipment.muzzleWorldPosition().distanceTo(muzzle)<1e-8);
    for(let i=0;i<150;i++)equipment.update(1/60,{firing:true});
    assert.equal(equipment.beaming,false,'existing thermal lockout');
    assert.ok(equipment.cutterHead.speed<8);
    equipment.holster(true);equipment.update(.016,{firing:true});assert.equal(equipment.cutterHead.speed,0);
    const record=JSON.parse(readFileSync(new URL('../assets/field-cutter/manifest.json',import.meta.url)));
    assert.equal(record.tiers,'Mk1 implemented; common K17-M30 mount retained for future heads');
  }finally{equipment.dispose();character.dispose();}
});
