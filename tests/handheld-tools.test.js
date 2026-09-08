import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {AvatarGLB} from '../blender/avatar-glb.mjs';
import {ITEMS} from '../src/equipment.js';
import {shareHandheldTextures,hasAuthoredHandheldFinish,clearHandheldTextureCache} from '../src/equipment-materials.js';
import {loadAsset,avatarFixture} from './avatar-fixture.js';
const manifest=JSON.parse(readFileSync(new URL('../assets/handheld-tools/manifest.json',import.meta.url)));
test('shipped handhelds retain actual export budgets, UVs, normals, contact AO, PBR and muzzle anchors',async()=>{
  for(const [name,entry] of Object.entries(manifest)){
    const path=new URL(`../public/models/props/${name}.glb`,import.meta.url),glb=new AvatarGLB(path);
    assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),entry.sha256);
    assert.ok(readFileSync(path).length<=1e6);
    let tris=0;
    for(const mesh of glb.json.meshes)for(const p of mesh.primitives){
      tris+=glb.rows(p.indices).length/3;
      for(const key of ['POSITION','NORMAL','TEXCOORD_0','COLOR_0']){
        assert.ok(p.attributes[key]!==undefined,`${name} ${key}`);
        assert.ok(glb.rows(p.attributes[key]).flat().every(Number.isFinite));
      }
      for(const n of glb.rows(p.attributes.NORMAL))assert.ok(Math.abs(Math.hypot(...n)-1)<.001);
      for(const uv of glb.rows(p.attributes.TEXCOORD_0))assert.ok(uv.every(x=>x>=0&&x<=1));
    }
    assert.equal(tris,entry.triangles);assert.ok(tris<=10000);
    const finish=glb.json.materials.find(m=>m.extras?.handheldFinish===1);
    assert.ok(finish.pbrMetallicRoughness.baseColorTexture&&finish.pbrMetallicRoughness.metallicRoughnessTexture&&finish.normalTexture);
    for(const [kind,slot] of [['normal',finish.normalTexture],['basecolor',finish.pbrMetallicRoughness.baseColorTexture],['orm',finish.pbrMetallicRoughness.metallicRoughnessTexture]]){
      const index=glb.json.textures[slot.index].extensions.EXT_texture_webp.source;
      assert.equal(glb.json.images[index].name,entry.maps?.[kind]?.name??`HandheldAtlas-v1-${kind}`);
      assert.deepEqual(glb.image(index),readFileSync(new URL(`../${entry.maps?.[kind]?.path??`assets/handheld-tools/textures/${kind}.webp`}`,import.meta.url)),`${name} ${kind} uses its actual authored data`);
    }
    assert.equal(glb.json.images.length,3);
    for(const im of glb.json.images)assert.equal(im.mimeType,'image/webp');
    const {scene}=await loadAsset(ITEMS[name].file);scene.updateMatrixWorld(true);
    const muzzle=scene.getObjectByName('muzzle').getWorldPosition(new THREE.Vector3());
    assert.ok(muzzle.distanceTo(new THREE.Vector3(...ITEMS[name].muzzle))<1e-6);
    const bounds=new THREE.Box3().setFromObject(scene);
    for(let i=0;i<3;i++)assert.ok(Math.abs(bounds.min.getComponent(i)-entry.bounds.min[i])<.0001);
    if(name==='rifle-laser')assert.ok(bounds.max.x<.222,'stock stays clear of the fitted shoulder');
  }
});
test('authored finishes share three maps without discarding vertex AO or altering fallback materials',()=>{
  clearHandheldTextureCache();const roots=[];
  for(let i=0;i<2;i++){
    const material=new THREE.MeshStandardMaterial();material.userData.handheldFinish=1;
    for(const key of ['map','normalMap','roughnessMap']){const t=new THREE.Texture();t.name=`HandheldAtlas-v1-${key}`;material[key]=t;}
    material.metalnessMap=material.roughnessMap;
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(),material);
    mesh.geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(72).fill(.8),3));
    shareHandheldTextures(mesh);roots.push(mesh);
  }
  for(const slot of ['map','normalMap','roughnessMap','metalnessMap'])assert.equal(roots[0].material[slot],roots[1].material[slot]);
  assert.equal(roots[0].material.vertexColors,true);assert.ok(hasAuthoredHandheldFinish(roots[0]));
  const fallback=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());
  shareHandheldTextures(fallback);assert.equal(hasAuthoredHandheldFinish(fallback),false);assert.equal(fallback.material.map,null);
});
test('tractor follows the calibrated cutter grip and cannot emit mining or weapon damage',async()=>{
  const {character,equipment}=await avatarFixture();
  const positions=[];
  for(const item of ['mining-laser-tool','tractor-beam-tool']){
    equipment.equip(item);await equipment._ensure(item);
    character.update(.016,{aiming:'tool'});equipment.aimHeld(new THREE.Vector3(0,0,-1));
    equipment.update(.016,{firing:false});
    positions.push(equipment.muzzleWorldPosition().clone());
  }
  assert.ok(positions[0].distanceTo(positions[1])<.012,'unchanged grip and bore calibration');
  equipment.update(1,{firing:true,authorizeFire:()=>{throw Error('tractor attempted weapon fire');}});
  assert.equal(equipment.beaming,false);assert.equal(ITEMS['tractor-beam-tool'].shot,null);
  equipment.dispose();character.dispose();
});
