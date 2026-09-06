import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createStationShopGraphics, loadStationShopGraphics } from '../src/station-shop-graphics.js';

async function asset(){
  const b=await readFile(new URL('../public/models/station-concourse.glb',import.meta.url));
  return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;
}

test('headless fallback shares bounded native resources and adds exactly three non-colliding draws',async()=>{
  const a=await loadStationShopGraphics(),b=await loadStationShopGraphics();
  assert.equal(a,b,'resources are allocated once for the station');
  assert.deepEqual(a.status,{artwork:'fallback',carpet:'fallback'});
  const root=await asset(),group=createStationShopGraphics(root,a);
  assert.equal(group.children.length,3);
  assert.equal(group.name,'Shop retail graphics');
  assert.equal(group.userData.printPlacements.length,22,'six posters, two banners, four A5, six shelf labels, two care notes and two wall brands');
  for(const mesh of group.children){
    assert.match(mesh.name,/^(Sign_|Detail_)/);
    assert.equal(mesh.castShadow,false);
    assert.ok(mesh.material.isMeshStandardMaterial);
    assert.equal(mesh.material.emissive.getHex(),0,'all retail graphics are scene lit');
    assert.equal(mesh.material.userData.stationFinished,true);
    for(const map of [mesh.material.map,mesh.material.bumpMap,mesh.material.roughnessMap].filter(Boolean)){
      assert.ok(map.image.width<=1024&&map.image.height<=1024);
    }
  }
  const carpet=group.getObjectByName('Detail_ShopCarpet');
  carpet.geometry.computeBoundingBox();
  assert.ok(Math.abs(carpet.geometry.boundingBox.min.y+7.986)<1e-6);
  assert.ok(Math.abs(carpet.geometry.boundingBox.max.y+7.986)<1e-6);
  assert.notEqual(carpet.material.map,carpet.material.bumpMap,'wear image never supplies geometric bump');
  assert.ok(carpet.geometry.attributes.color,'both brands share one carpet draw via vertex colour');
});

test('actual A5 covers preserve tilted anchor normals and exact paper dimensions even below a moved parent',async()=>{
  const root=await asset(),parent=new THREE.Group();
  parent.position.set(128,42,-380);parent.rotation.set(.12,.32,-.14);parent.add(root);
  const group=createStationShopGraphics(root,await loadStationShopGraphics());parent.add(group);parent.updateMatrixWorld(true);
  const prints=group.getObjectByName('Sign_Shop_paper');
  for(const brand of ['Watchkeep','Kestrel'])for(let i=0;i<2;i++){
    const name=brand+'Brochure'+i,anchor=root.getObjectByName(name);assert.ok(anchor,name);
    const centre=anchor.getWorldPosition(new THREE.Vector3());
    const normal=new THREE.Vector3(0,0,1).transformDirection(anchor.matrixWorld);
    const ray=new THREE.Raycaster(centre.clone().addScaledVector(normal,.05),normal.clone().negate(),0,.1);
    const hit=ray.intersectObject(prints)[0];assert.ok(hit,`${name} print covers the actual anchor`);
    assert.ok(hit.point.distanceTo(centre)<1e-5,`${name} print sits exactly on its anchor`);
    const actualNormal=hit.face.normal.clone().transformDirection(prints.matrixWorld);
    assert.ok(actualNormal.dot(normal)>.99999,'A5 normal includes the authored 18-degree tilt');
    for(const x of [-.073,.073])for(const y of [-.104,.104]){
      const corner=new THREE.Vector3(x,y,0).applyMatrix4(anchor.matrixWorld);
      ray.set(corner.clone().addScaledVector(normal,.05),normal.clone().negate());
      assert.ok(ray.intersectObject(prints).some(h=>h.point.distanceTo(corner)<1e-5),'print reaches all four A5 cover corners');
    }
  }
});

test('authored poster and cloth anchors retain their physical backings without print occlusion',async()=>{
  const root=await asset(),graphics=createStationShopGraphics(root,await loadStationShopGraphics());
  const scene=new THREE.Group();scene.add(root,graphics);scene.updateMatrixWorld(true);
  const mesh=graphics.getObjectByName('Sign_Shop_paper');
  for(const placement of graphics.userData.printPlacements.filter(p=>/Poster|Banner/.test(p.name))){
    const centre=new THREE.Vector3(...placement.position);
    const normal=/PosterEnd/.test(placement.name)?new THREE.Vector3(0,0,1):new THREE.Vector3(placement.name.startsWith('Watchkeep')?1:-1,0,0);
    const ray=new THREE.Raycaster(centre.clone().addScaledVector(normal,.08),normal.clone().negate(),0,.15);
    const print=ray.intersectObject(mesh)[0],backing=ray.intersectObject(root,true)[0];
    assert.ok(print,placement.name+' has a print at its centre');
    assert.ok(backing,placement.name+' retains a solid authored substrate');
    assert.ok(print.distance<backing.distance,placement.name+' is ahead of its backing and frame');
  }
});
