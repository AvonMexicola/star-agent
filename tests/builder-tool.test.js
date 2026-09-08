import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {AvatarGLB} from '../blender/avatar-glb.mjs';
import {ITEMS, RIGS, resolveSocket} from '../src/equipment.js';
import {BuilderHandheld} from '../src/build/handheld.js';
import {loadAsset, avatarFixture} from './avatar-fixture.js';

test('actual builder export has a clear projector, seated screen, calibrated grip and finite compact PBR geometry',async()=>{
  const path=new URL('../public/models/props/builder-tool.glb',import.meta.url),bytes=readFileSync(path),glb=new AvatarGLB(path);
  const manifest=JSON.parse(readFileSync(new URL('../assets/builder-tool/manifest.json',import.meta.url)));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);
  assert.ok(bytes.length<1e6);let triangles=0,draws=0;
  for(const mesh of glb.json.meshes)for(const primitive of mesh.primitives){
    triangles+=glb.rows(primitive.indices).length/3;draws++;
    for(const key of ['POSITION','NORMAL','TEXCOORD_0','COLOR_0']){
      assert.notEqual(primitive.attributes[key],undefined,key);
      assert.ok(glb.rows(primitive.attributes[key]).flat().every(Number.isFinite),key);
    }
  }
  assert.equal(triangles,manifest.triangles);assert.ok(triangles<10000);assert.ok(draws<=4);
  const finish=glb.json.materials.find(m=>m.extras?.handheldFinish===1);
  assert.ok(finish?.normalTexture&&finish.pbrMetallicRoughness.baseColorTexture&&finish.pbrMetallicRoughness.metallicRoughnessTexture);
  for(const image of glb.json.images)assert.equal(image.mimeType,'image/webp');
  const {scene}=await loadAsset(ITEMS['builder-tool'].file);scene.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(scene),size=bounds.getSize(new THREE.Vector3());
  assert.ok(size.x<.30&&size.y<.24&&size.z<.12,'compact one-hand envelope');
  const muzzle=scene.getObjectByName('muzzle').getWorldPosition(new THREE.Vector3());
  assert.ok(muzzle.distanceTo(new THREE.Vector3(...ITEMS['builder-tool'].muzzle))<1e-6);
  for(const y of [-.004,0,.004])for(const z of [-.008,0,.008]){
    const ray=new THREE.Raycaster(muzzle.clone().add(new THREE.Vector3(0,y,z)),new THREE.Vector3(-1,0,0),0,.1);
    assert.equal(ray.intersectObject(scene,true).length,0,'projection aperture is physically open');
  }
  const screen=scene.getObjectByName('screen'),normal=new THREE.Vector3(0,0,1).transformDirection(screen.matrixWorld);
  for(const x of [-.037,0,.037])for(const y of [-.02,0,.02]){
    const point=screen.localToWorld(new THREE.Vector3(x,y,0));
    const hits=new THREE.Raycaster(point,normal.clone().negate(),0,.005).intersectObject(scene,true);
    assert.ok(hits.length,'all screen samples have real backing within 5 mm');
    assert.equal(new THREE.Raycaster(point,normal,0,.03).intersectObject(scene,true).length,0,'clear display face');
  }
  const sockets=JSON.parse(readFileSync(new URL('../public/models/props/equipment-sockets.json',import.meta.url)));
  for(const rig of RIGS)assert.ok(resolveSocket(sockets,rig,'builder-tool').calibrated,rig);
});

test('actual rig holds the compact builder and its trigger cannot grant shots or mining',async()=>{
  const {character,equipment}=await avatarFixture();
  try{
    await equipment.equip('builder-tool');
    character.update(.016,{aiming:'pistol'});equipment.aimHeld(new THREE.Vector3(0,0,-1));
    equipment.update(.016,{firing:true,authorizeFire:()=>{throw Error('builder attempted ammunition debit');}});
    assert.equal(equipment.leftHandTargetLocal,null);
    assert.equal(equipment.beaming,false);assert.equal(equipment.firingInput(),false);
    assert.ok(equipment.muzzleWorldPosition().toArray().every(Number.isFinite));
    assert.ok(equipment.muzzleWorldDirection().dot(new THREE.Vector3(0,0,-1))>.98);
    await equipment.equip('sidearm-pistol');
    assert.equal(equipment.itemObject('builder-tool').parent,null,'contextual model detaches when previous tool returns');
  }finally{equipment.dispose();character.dispose();}
});

test('confirmation projection rebases real endpoints and does not replay across hidden contexts',()=>{
  const scene=new THREE.Scene(),tool=new BuilderHandheld(scene);
  // The actual screen contract is checked above and in the browser; no DOM is needed for VFX arithmetic.
  tool.screen=new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshBasicMaterial());
  const world=new THREE.Vector3(1592750,26000000,-9200000),origin=world.clone().add(new THREE.Vector3(2,3,4));
  const equipment={equipped:'builder-tool',holstered:false,muzzleWorldPosition:out=>out.copy(world)};
  const build={active:true,pieceId:'foundation',preview:{valid:true,pieceId:'foundation'},lastToolAction:{position:world.clone().add(new THREE.Vector3(4,-1,-6)).toArray()}};
  tool.update(.016,{build,equipment,origin,visible:true});assert.equal(tool.state.projection,true);
  scene.updateMatrixWorld(true);
  const start=tool.beam.localToWorld(new THREE.Vector3(0,0,0)).add(origin);
  const end=tool.beam.localToWorld(new THREE.Vector3(0,0,1)).add(origin);
  assert.ok(start.distanceTo(world)<1e-6);assert.ok(end.distanceTo(new THREE.Vector3(...build.lastToolAction.position))<1e-6);
  tool.update(.016,{build,equipment,origin,visible:false});assert.equal(tool.state.projection,false);
  tool.update(.016,{build,equipment,origin,visible:true});assert.equal(tool.state.projection,false);
  const disposed=[];tool.geometry.addEventListener('dispose',()=>disposed.push('geometry'));tool.material.addEventListener('dispose',()=>disposed.push('material'));
  tool.dispose();assert.equal(scene.children.length,0);assert.deepEqual(disposed,['geometry','material']);
});
