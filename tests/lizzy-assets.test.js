import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import * as THREE from 'three';import {loadAsset} from './avatar-fixture.js';
test('Lizzy budget, canonical rig and comfortable idle survive the actual GLB export',async()=>{
 const report=JSON.parse(readFileSync(new URL('../assets/characters/lizzy/build.json',import.meta.url)));assert.ok(report.bytes<2000000&&report.triangles<=20000);
 const g=await loadAsset('/models/guides/lizzy.glb'),mixer=new THREE.AnimationMixer(g.scene);assert.deepEqual(g.animations.map(c=>c.name).sort(),['idle','run','walk','wave']);assert.ok(g.scene.getObjectByName('Neck'));assert.ok(g.scene.getObjectByName('Spine2'));
 for(const clip of g.animations){mixer.stopAllAction();const a=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;a.play();
  for(let i=0;i<=8;i++){mixer.setTime(clip.duration*i/8);g.scene.updateMatrixWorld(true);const box=new THREE.Box3(),v=new THREE.Vector3();g.scene.traverse(o=>{if(o.isSkinnedMesh)for(let j=0;j<o.geometry.attributes.position.count;j+=3){o.getVertexPosition(j,v);box.expandByPoint(v.applyMatrix4(o.matrixWorld));}});assert.ok(box.min.y>-.15&&box.max.y<2.1&&box.max.x-box.min.x<1.8,`${clip.name}: plausible posed body envelope`);
   if(clip.name==='idle'){const hips=g.scene.getObjectByName('Hips').getWorldPosition(new THREE.Vector3());for(const side of ['Left','Right']){const hand=g.scene.getObjectByName(side+'Hand').getWorldPosition(new THREE.Vector3());assert.ok(hand.y<hips.y+.12,'relaxed hands stay below the waist');assert.ok(Math.abs(hand.x-hips.x)<.35,'arms stay beside the torso');}}
  }
 }
});
