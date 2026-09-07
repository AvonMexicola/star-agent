import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {prepareShipWeaponKit,attachShipWeapons,equipShipWeapons,armedShipLayout} from '../src/ship-weapons.js';
import {SHIP_WEAPON_PROFILES,shipWeaponProfile} from '../src/ship-weapon-profiles.js';
import {SHIP_LAYOUT} from '../src/boarding.js';
import {KESTREL_LAYOUT} from '../src/kestrel-access.js';
import {FREIGHTER_LAYOUT} from '../src/freighter-layout.js';

globalThis.ProgressEvent??=class{constructor(type,init={}){this.type=type;Object.assign(this,init);}};
async function asset(path){
  const bytes=fs.readFileSync(new URL('../'+path,import.meta.url)),length=bytes.readUInt32LE(12);
  const json=JSON.parse(bytes.subarray(20,20+length)),geometry=structuredClone(json);
  geometry.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+length).toString('base64');
  for(const material of geometry.materials??[]){
    for(const key of ['normalTexture','occlusionTexture','emissiveTexture'])delete material[key];
    delete material.pbrMetallicRoughness?.baseColorTexture;delete material.pbrMetallicRoughness?.metallicRoughnessTexture;
  }
  return {bytes,json,gltf:await new GLTFLoader().parseAsync(JSON.stringify(geometry),'')};
}
const gun=await asset('public/models/ship-weapons.glb'),kit=prepareShipWeaponKit(gun.gltf);
const hulls=Object.fromEntries(await Promise.all(Object.entries({nomad:'public/models/nomad.glb',kestrel:'assets/kestrel/kestrel.glb',atlas:'public/models/atlas.glb','atlas-mark-ii':'public/models/atlas-mark-ii/atlas-mark-ii.glb'}).map(async([id,path])=>[id,await asset(path)])));
const close=(a,b,t=.0001)=>assert.ok(a.distanceTo(b)<t,a.toArray()+' differs from '+b.toArray());

test('nine shipped variants have open forward bores, keyed dimensions, real PBR maps and bounded cost',()=>{
  const manifest=JSON.parse(fs.readFileSync(new URL('../assets/ship-weapons/manifest.json',import.meta.url)));
  assert.equal(gun.bytes.length,manifest.bytes);assert.equal(crypto.createHash('sha256').update(gun.bytes).digest('hex'),manifest.sha256);
  assert.equal(kit.variants.size,9);assert.equal(gun.json.images.length,3);assert.ok(gun.bytes.length<3_000_000);
  for(const image of gun.json.images)assert.equal(image.mimeType,'image/webp');
  const surface=gun.json.materials.find(m=>m.name.includes('baked PBR'));
  assert.ok(surface.pbrMetallicRoughness.baseColorTexture);assert.ok(surface.pbrMetallicRoughness.metallicRoughnessTexture);assert.ok(surface.normalTexture);
  for(const spec of manifest.variants){
    const root=kit.variants.get(spec.id),muzzle=root.getObjectByName(spec.muzzle),meshes=[];root.updateWorldMatrix(true,true);
    root.traverse(n=>{if(n.isMesh)meshes.push(n);});assert.equal(meshes.length,2);assert.ok(spec.triangles<=4000);
    const p=muzzle.getWorldPosition(new THREE.Vector3());close(p,new THREE.Vector3(...spec.muzzlePosition));
    // A ray fired from inside the open bore reaches the muzzle without a cap.
    const ray=new THREE.Raycaster(p.clone().add(new THREE.Vector3(0,0,.05)),new THREE.Vector3(0,0,-1),0,.08);
    assert.equal(ray.intersectObjects(meshes).length,0,spec.id+' bore is capped');
    for(const mesh of meshes)assert.ok(mesh.geometry.attributes.uv);
  }
});

test('bigger variants have greater damage and sustained output, with one family identity',()=>{
  assert.equal(Object.keys(SHIP_WEAPON_PROFILES).length,9);
  for(const type of ['pulse','laser','void']){
    const p=[1,2,3].map(size=>shipWeaponProfile(type,size));
    assert.ok(p[0].damage<p[1].damage&&p[1].damage<p[2].damage);
    assert.ok(p[0].damage/p[0].interval<p[1].damage/p[1].interval);
    assert.ok(p[1].damage/p[1].interval<p[2].damage/p[2].interval);
    assert.ok(p[0].power<p[1].power&&p[1].power<p[2].power);
    assert.ok(p[0].range<p[1].range&&p[1].range<p[2].range);
    assert.equal(p[0].kind,p[2].kind);
  }
  assert.throws(()=>shipWeaponProfile('pulse',4),RangeError);
});

for(const [id,size,count] of [['nomad',1,2],['kestrel',2,4],['atlas',3,3],['atlas-mark-ii',3,3]])test(id+' fits exact-size guns and derives double-precision firing from the named muzzle',()=>{
  const ship=hulls[id].gltf.scene.clone(true),arm=attachShipWeapons(ship,id,kit);
  assert.equal(arm.state.mounts.length,count);assert.equal(arm.size,size);
  const origin=new THREE.Vector3(25_000_000_000,-8_100_000_000,100000);
  ship.position.set(11.375,-24.5,88.25);ship.quaternion.setFromEuler(new THREE.Euler(.25,-.7,.13));
  for(const type of ['pulse','laser','void']){
    arm.select(type);assert.ok(arm.state.mounts.every(m=>m.installedWeapon===type+'-s'+size));
    for(let i=0;i<count;i++){
      const local=arm.muzzle(i,{local:true}),pose=arm.muzzle(i,{origin});
      close(pose.position,local.position.clone().applyQuaternion(ship.quaternion).add(ship.position).add(origin),.00001);
      close(pose.direction,local.direction.clone().applyQuaternion(ship.quaternion));
      const mount=ship.getObjectByName(pose.mount),muzzle=mount.getObjectByName('Muzzle_'+type+'-s'+size);
      close(pose.position,muzzle.getWorldPosition(new THREE.Vector3()).add(origin));
      arm.fired(pose);const flash=muzzle.getObjectByName('Barrel flash');assert.ok(flash.visible);
      close(flash.getWorldPosition(new THREE.Vector3()),muzzle.getWorldPosition(new THREE.Vector3()));
      assert.equal(arm.state.lastShot.mount,pose.mount);
      arm.update(.2);assert.equal(flash.visible,false);
      if(id==='atlas-mark-ii'&&pose.mount==='Mount_S3_Aft')close(local.direction,new THREE.Vector3(0,0,1));
      else close(local.direction,new THREE.Vector3(0,0,-1));
    }
  }
  arm.dispose();
});

test('physical flight envelopes include protruding guns and preserve cabin geometry',()=>{
  for(const [id,layout] of [['nomad',SHIP_LAYOUT],['kestrel',KESTREL_LAYOUT],['atlas',FREIGHTER_LAYOUT]]){
    const arm=attachShipWeapons(hulls[id].gltf.scene.clone(true),id,kit),armed=armedShipLayout(layout,arm);
    assert.equal(armed.seatEye,layout.seatEye);assert.equal(armed.floorY,layout.floorY);
    const box=new THREE.Box3(new THREE.Vector3(...armed.flightBounds.min),new THREE.Vector3(...armed.flightBounds.max));
    for(const part of arm.flightParts){assert.ok(box.containsPoint(new THREE.Vector3(...part.min)));assert.ok(box.containsPoint(new THREE.Vector3(...part.max)));}
    if(id==='kestrel')assert.ok(armed.flightBounds.min[2]<layout.flightBounds.min[2]-.8);
    if(id==='atlas')assert.ok(armed.flightBounds.max[1]>10.5);
    arm.dispose();
  }
});

test('a failed optional gun load preserves the ready hull and cannot fire invisible weapons',async()=>{
  const ship=new THREE.Group();ship.readyPromise=Promise.resolve(ship);
  const previous=console.warn;console.warn=()=>{};
  try{equipShipWeapons(ship,'nomad',{kitPromise:Promise.reject(new Error('texture download failed'))});assert.equal(await ship.readyPromise,ship);}
  finally{console.warn=previous;}
  assert.equal(ship.armament.status,'unavailable');assert.equal(ship.armament.nextMuzzle,undefined);assert.equal(ship.armament.state.mounts.length,0);
});

test('new barrels block walking and EVA without creating cabin floors',async()=>{
  const {constrainShipAttachments}=await import('../src/ship-attachment-collision.js');
  const arm=attachShipWeapons(hulls.kestrel.gltf.scene.clone(true),'kestrel',kit);
  const nose=arm.flightParts.find(p=>p.name.includes('HP_Nose'));
  const z=(nose.min[2]+nose.max[2])*.5,a=new THREE.Vector3(-2,1.75,z),b=new THREE.Vector3(2,1.75,z);
  assert.deepEqual(constrainShipAttachments(a,b,arm.flightParts),a);
  const top=new THREE.Vector3(0,4,z),bottom=new THREE.Vector3(0,.2,z);
  assert.deepEqual(constrainShipAttachments(top,bottom,arm.flightParts,{eva:true}),top);
  const entry=new THREE.Vector3(-3,1.75,-1.75),ladder=new THREE.Vector3(-2.45,1.75,-1.75);
  assert.deepEqual(constrainShipAttachments(entry,ladder,arm.flightParts),ladder);
  arm.dispose();
});
