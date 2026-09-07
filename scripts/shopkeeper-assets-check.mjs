// CPU check of the exact runtime mesh/skin/animation buffers in the game loader.
// Texture references alone are omitted because Node cannot decode browser images;
// game-browser QA remains responsible for real materials and rendering.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {STATION_SHOPKEEPERS,createShopkeeperAnimator} from '../src/station-shopkeeper.js';
globalThis.ProgressEvent??=class ProgressEvent{constructor(type,data){this.type=type;Object.assign(this,data);}};
const selected=process.argv.slice(2);
for(const id of selected)assert.ok(Object.hasOwn(STATION_SHOPKEEPERS,id),`Unknown shop ${id}`);
const receipt={kind:'Three.js actual skin and animation CPU evaluation; textures excluded',actors:{}};
for(const [id,definition] of Object.entries(STATION_SHOPKEEPERS)){
  if(selected.length&&!selected.includes(id))continue;
  const path=`public${definition.url}`,raw=readFileSync(path),manifest=JSON.parse(readFileSync(path.replace('.glb','-manifest.json')));
  const hash=createHash('sha256').update(raw).digest('hex');
  assert.equal(hash,manifest.asset.sha256);assert.ok(raw.length<=2_000_000,'character byte budget');
  const jsonLength=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jsonLength).toString()),binOffset=20+jsonLength+8;
  assert.deepEqual(doc.animations.map(c=>c.name).sort(),[...definition.idles].sort());
  const triangles=doc.meshes.reduce((sum,m)=>sum+m.primitives.reduce((s,p)=>s+doc.accessors[p.indices].count/3,0),0);
  assert.ok(triangles<=20_000);assert.equal(triangles,manifest.triangles);
  // The original buffers, accessor layouts, nodes, inverse binds and tracks remain exact.
  doc.buffers[0].uri=`data:application/octet-stream;base64,${raw.subarray(binOffset,binOffset+doc.buffers[0].byteLength).toString('base64')}`;
  delete doc.images;delete doc.textures;delete doc.samplers;delete doc.extensionsRequired;doc.materials=[{}];
  const asset=await new Promise((resolve,reject)=>new GLTFLoader().parse(JSON.stringify(doc),'',resolve,reject));
  const animator=createShopkeeperAnimator(asset.scene,asset.animations,definition.idles),bounds=new THREE.Box3(),phase=new THREE.Box3();
  const duration=asset.animations.reduce((s,c)=>s+c.duration,0)+1;
  let minGround=Infinity,maxGround=-Infinity,samples=0;
  for(let t=0;t<duration;t+=1/30){
    animator.update(1/30);asset.scene.updateMatrixWorld(true);phase.makeEmpty();
    asset.scene.traverse(node=>{if(node.isSkinnedMesh){node.skeleton.update();node.computeBoundingBox();phase.union(node.boundingBox.clone().applyMatrix4(node.matrixWorld));}});
    assert.ok(!phase.isEmpty(),'actual skinned vertices available');bounds.union(phase);samples++;
    minGround=Math.min(minGround,phase.min.y);maxGround=Math.max(maxGround,phase.min.y);
  }
  assert.ok(minGround>-.025&&maxGround<.025,`blended sole grounding ${minGround}..${maxGround}`);
  const matrix=new THREE.Matrix4().compose(new THREE.Vector3().fromArray(definition.placement.position),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),definition.placement.yaw),new THREE.Vector3(1,1,1));
  const hubBounds=bounds.clone().applyMatrix4(matrix),counterEdge=id==='weapons'?-12.47:12.47;
  const clearance=id==='weapons'?counterEdge-hubBounds.max.x:hubBounds.min.x-counterEdge;
  assert.ok(clearance>.1,`full animated body must clear counter: ${clearance}`);assert.ok(hubBounds.max.y< -4.36,'shop ceiling clearance');
  receipt.actors[id]={path,sha256:hash,bytes:raw.length,triangles,samples,seconds:duration,transitions:animator.state.transitions,minGround,maxGround,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},counterClearance:clearance};
  animator.dispose();
  // Pose diagnostics are measured relative to the torso, not a leaning world's Y.
  // Gestures can legitimately exceed resting angles; review these against images.
  const mixer=new THREE.AnimationMixer(asset.scene),poseSamples=[];
  const at=name=>asset.scene.getObjectByName(name).getWorldPosition(new THREE.Vector3());
  for(const clip of asset.animations){
    for(const fraction of [0,.25,.5,.75]){
      mixer.stopAllAction();mixer.clipAction(clip).play();mixer.setTime(clip.duration*fraction);asset.scene.updateMatrixWorld(true);
      const centre=at('neck'),up=centre.clone().sub(at('Hips')).normalize();
      const across=at('RightArm').sub(at('LeftArm')).normalize();
      const forward=new THREE.Vector3().crossVectors(across,up).normalize();if(forward.z>0)forward.negate();
      const arms={};
      for(const side of ['Left','Right']){
        const shoulder=at(`${side}Arm`),elbow=at(`${side}ForeArm`),hand=at(`${side}Hand`);
        const outward=shoulder.clone().sub(centre).addScaledVector(up,-shoulder.clone().sub(centre).dot(up)).normalize();
        const upper=elbow.clone().sub(shoulder).normalize(),lower=hand.clone().sub(elbow).normalize();
        arms[side.toLowerCase()]={outwardDegrees:THREE.MathUtils.radToDeg(Math.atan2(upper.dot(outward),-upper.dot(up))),forwardDegrees:THREE.MathUtils.radToDeg(Math.atan2(upper.dot(forward),-upper.dot(up))),elbowBendDegrees:THREE.MathUtils.radToDeg(upper.angleTo(lower)),handFromShoulder:hand.sub(shoulder).toArray()};
      }
      if(fraction===0)for(const [side,arm] of Object.entries(arms)){
        assert.ok(arm.forwardDegrees>=-10,`${id}/${clip.name}/${side}: resting upper arm pulled backward ${arm.forwardDegrees} degrees`);
        assert.ok(arm.outwardDegrees<=25,`${id}/${clip.name}/${side}: resting upper arm held outward ${arm.outwardDegrees} degrees`);
      }
      poseSamples.push({clip:clip.name,fraction,arms});
    }
  }
  mixer.stopAllAction();mixer.uncacheRoot(asset.scene);receipt.actors[id].poseSamples=poseSamples;
  const {poseSamples:_,...summary}=receipt.actors[id];console.log(id,JSON.stringify(summary));
}
if(process.env.SHOPKEEPER_ASSET_RECEIPT)writeFileSync(process.env.SHOPKEEPER_ASSET_RECEIPT,JSON.stringify(receipt,null,2)+'\n');
