import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readGLBGeometry} from './helpers/gltf-geometry.js';
import {StationDefense} from '../src/station-security.js';
import {selectDefensePose} from '../src/station-security-policy.js';
import {StationComplex} from '../src/station-complex.js';

const assetPromise=readGLBGeometry(new URL('../public/models/station-defense.glb',import.meta.url));
async function fixture(t){
  const station={centre:new THREE.Vector3(25_000_000_000,1_900_000,0),baseQuaternion:new THREE.Quaternion().setFromEuler(new THREE.Euler(.2,.4,-.3)),readyPromise:Promise.resolve()};
  const scene=new THREE.Scene(),defense=new StationDefense(scene,station,{gltf:await assetPromise});await defense.readyPromise;t.after(()=>defense.dispose());
  return {station,scene,defense,policy:{center:station.centre,orientation:station.baseQuaternion}};
}
test('actual GLB muzzle transforms agree with server shots, recoil, late-join poses and render origin',async t=>{
  const {station,defense,policy}=await fixture(t);let id=0;
  for(const barrel of [0,1])for(const offset of [[665,30,-10],[-4000,1500,1000],[10000,-5000,-17000]]){
    const target=station.centre.clone().add(new THREE.Vector3(...offset).applyQuaternion(station.baseQuaternion));
    const pose=selectDefensePose(policy,target,barrel),event={id:String(++id),stationId:'aeon-orbital',mountId:pose.mountId,barrel,yaw:pose.yaw,pitch:pose.pitch,origin:pose.origin.toArray(),direction:pose.direction.toArray(),target:target.toArray()};
    assert.equal(defense.strike(event),true);assert.equal(defense.strike(event),false);
    const rig=defense.rigs.find(r=>r.mount.id===pose.mountId),shot=new THREE.Vector3(...defense.lastStrike.origin);
    assert.ok(shot.distanceTo(pose.origin)<1e-5);
    assert.ok(defense.muzzle(rig,barrel).distanceTo(shot.clone().addScaledVector(pose.direction,-.6))<1e-5);
    const origin=target.clone().add(new THREE.Vector3(80,9,30));defense.update(0,origin);
    const beam=defense.beams.at(-1);assert.ok(beam.mesh.position.clone().add(origin).distanceTo(shot)<1e-5);
    defense.setState([{mountId:rig.mount.id,yaw:pose.yaw,pitch:pose.pitch,recoil:[0,0]}]);
    assert.ok(defense.muzzle(rig,barrel).distanceTo(shot)<1e-5);
  }
  assert.equal(defense.strikes,6);defense.update(.25,station.centre);assert.equal(defense.beams.length,0);
});

test('articulated collision stays on actual rendered triangles across a large world rebase',async t=>{
  const {station,scene,defense}=await fixture(t),rig=defense.rigs[0];
  defense.setState([{mountId:rig.mount.id,yaw:1.1,pitch:.65,recoil:[.35,.1]}]);
  const part=rig.parts.find(p=>p.mesh.name.includes('Recoil_Port'));
  assert.ok(part,'export has a separately articulated port barrel');
  const positions=part.mesh.geometry.attributes.position,index=part.mesh.geometry.index;
  // A real exported triangle supplies a surface point and normal. Collision is
  // measured independently of the renderer's matrixWorld/rebased coordinates.
  const triangle=[0,1,2].map(i=>new THREE.Vector3().fromBufferAttribute(positions,index?index.getX(i):i));
  const center=triangle[0].clone().add(triangle[1]).add(triangle[2]).divideScalar(3);
  const normal=triangle[1].clone().sub(triangle[0]).cross(triangle[2].clone().sub(triangle[0])).normalize();
  const matrix=part.matrix.clone(),toWorld=p=>p.applyMatrix4(matrix).applyQuaternion(station.baseQuaternion).add(station.centre);
  const a=toWorld(center.clone().addScaledVector(normal,.12)),b=toWorld(center.clone().addScaledVector(normal,-.12));
  const extent=new THREE.Vector3().setScalar(.001),hit=defense.sweep(a,b,extent.clone().negate(),extent);
  assert.equal(hit.hit,true);
  for(const origin of [station.centre.clone(),station.centre.clone().add(new THREE.Vector3(19000,-7000,22000))]){
    defense.update(0,origin);scene.updateMatrixWorld(true);
    const rendered=triangle[0].clone().applyMatrix4(part.mesh.matrixWorld).add(origin);
    assert.ok(rendered.distanceTo(toWorld(triangle[0].clone()))<1e-5);
    const moved=defense.sweep(a,b,extent.clone().negate(),extent);assert.equal(moved.hit,true);assert.ok(moved.point.distanceTo(hit.point)<1e-8);
  }
});

test('disconnect clears old strike IDs, poses and pending effects before a restarted server joins',async t=>{
  const {station,defense,policy}=await fixture(t);
  const target=station.centre.clone().add(new THREE.Vector3(1000,500,-1000));
  const pose=selectDefensePose(policy,target,0),event={id:'aeon-orbital:1',stationId:'aeon-orbital',mountId:pose.mountId,barrel:0,yaw:pose.yaw,pitch:pose.pitch,origin:pose.origin.toArray(),direction:pose.direction.toArray(),target:target.toArray()};
  assert.equal(defense.strike(event),true);assert.equal(defense.beams.length,1);
  StationComplex.prototype.setMultiplayerState.call({...station,pods:[],_defenseState:[]},null);
  assert.equal(defense.seen.size,0);assert.equal(defense.beams.length,0);assert.equal(defense.strikes,0);
  assert.ok(defense.snapshot.every(p=>p.yaw===0&&p.pitch===0&&p.recoil.every(n=>n===0)));
  assert.equal(defense.strike(event),true,'new session may reuse the old room sequence');
});

test('empty or nonfinite asset bodies never publish a ready defense rig',async()=>{
  const station=()=>({centre:new THREE.Vector3(),baseQuaternion:new THREE.Quaternion(),readyPromise:Promise.resolve()});
  const empty=new THREE.Group(),yaw=new THREE.Group(),pitch=new THREE.Group();yaw.name='Bastion_Yaw';pitch.name='Bastion_Pitch';pitch.position.set(0,9,0);empty.add(yaw);yaw.add(pitch);
  for(const [side,x] of [['Port',-4.2],['Starboard',4.2]]){
    const muzzle=new THREE.Object3D();muzzle.name=`Bastion_Muzzle_${side}`;muzzle.position.set(x,0,-29);pitch.add(muzzle);
    const recoil=new THREE.Group();recoil.name=`Bastion_Recoil_${side}`;pitch.add(recoil);
  }
  const a=new StationDefense(new THREE.Scene(),station(),{gltf:{scene:empty}});
  await assert.rejects(a.readyPromise,/empty/);assert.equal(a.ready,false);assert.equal(a.rigs.length,0);a.dispose();
  const malformed=empty.clone(true),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,NaN,1],3));malformed.add(new THREE.Mesh(geometry));
  const b=new StationDefense(new THREE.Scene(),station(),{gltf:{scene:malformed}});
  await assert.rejects(b.readyPromise,/nonfinite/);assert.equal(b.ready,false);assert.equal(b.rigs.length,0);b.dispose();geometry.dispose();
});

test('disposing an in-flight asset load cannot repopulate the station or replay queued shots',async()=>{
  let loaded;const asset=new Promise(resolve=>{loaded=resolve;});
  const station={centre:new THREE.Vector3(),baseQuaternion:new THREE.Quaternion(),readyPromise:Promise.resolve()},scene=new THREE.Scene();
  const defense=new StationDefense(scene,station,{gltf:asset});defense.dispose();loaded(await assetPromise);await defense.readyPromise;
  assert.equal(defense.ready,false);assert.equal(defense.rigs.length,0);assert.equal(scene.children.length,0);assert.equal(station.defense,null);
  assert.equal(defense.strike({stationId:'aeon-orbital',id:'late',origin:[0,0,0],direction:[0,0,-1],target:[0,0,-100]}),false);assert.equal(defense.pendingEvents.length,0);
});
