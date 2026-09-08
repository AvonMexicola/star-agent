import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {DoorMotion,buildOpacity,nightFactor,nearestServiceLights,MAX_SERVICE_LIGHTS} from '../src/build/motion.js';
import {BuildSystem} from '../src/build/system.js';
import {MiningStore} from '../src/mining/store.js';
import {SELENE,bodySurfacePoint} from '../src/celestial.js';
import {MOON_LANDING_DIRECTION} from '../src/moon-world.js';
const v=a=>new THREE.Vector3(...a);
function fixture(open=false){
 const origin=bodySurfacePoint(v(MOON_LANDING_DIRECTION),SELENE),normal=origin.clone().sub(v(SELENE.center)).normalize();
 const nav={position:origin.clone(),normal,sunDirection:normal.clone(),orientation:new THREE.Quaternion(),mode:'walk',altitude:0,insideShip:false,enabled:true,focused:true,keys:new Set(),gamepad:{suspend(){}},layout:{eyeHeight:1.75}};
 const store=new MiningStore(null),build=new BuildSystem({scene:new THREE.Scene(),nav,store,render:false}),claim=build.newClaim(origin);
 claim.pieces=[{id:'door',type:'doorway',position:[0,.3,0],rotation:0,doorOpen:open},{id:'core',type:'mainframe',position:[40,0,0],rotation:0,doorOpen:false}];store.state.build={version:1,nextId:5,claims:[claim]};nav.position.copy(build.toWorld(v([3,2.05,2]),claim));build.sync();
 const model=new THREE.Group();for(const name of ['DoorLeafLeft','DoorLeafRight']){const leaf=new THREE.Object3D();leaf.name=name;model.add(leaf);}build.models.set('door',{ready:true,group:model});
 return {nav,build,claim,piece:claim.pieces[0],model,world:a=>build.toWorld(v(a),claim),origin};
}
test('door easing starts at saved endpoint and reverses continuously without saving fractions',()=>{
 const motion=new DoorMotion();assert.equal(motion.fraction('loaded',true),1);assert.equal(motion.update('loaded',true,.1),1);
 motion.ensure('new',false);assert.equal(motion.update('new',true,.125),.15625);assert.equal(motion.update('new',true,.125),.5);
 const before=motion.fraction('new');assert.equal(motion.update('new',false,0),before);assert.equal(motion.update('new',false,.5),0);
});
test('visual leaves, walker capsule and rays use the same live fraction',()=>{
 const f=fixture();f.piece.doorOpen=true;f.build.update(.1,f.origin);const fraction=f.build.doorFraction(f.piece);assert.equal(fraction,.10400000000000002);
 assert.ok(Math.abs(f.model.getObjectByName('DoorLeafRight').position.x-fraction*.8)<1e-12);
 const start=f.world([.3,1.4,2]),dir=v([0,0,-1]).applyQuaternion(new THREE.Quaternion(...f.claim.quaternion));assert.ok(f.build.raycast(start,dir,4));
 assert.ok(f.build.constrainWalker(f.world([0,2.05,1]),f.world([0,2.05,-1])).point.distanceTo(f.world([0,2.05,-1]))>.1);
 f.build.update(.15,f.origin);assert.equal(f.build.doorFraction(f.piece),.5);assert.equal(f.build.raycast(start,dir,4),null);
 assert.ok(f.build.constrainWalker(f.world([0,2.05,1]),f.world([0,2.05,-1])).point.distanceTo(f.world([0,2.05,-1]))<1e-7);
 assert.equal(f.piece.doorOpen,true);assert.equal(Object.hasOwn(f.piece,'fraction'),false);f.build.dispose();
});
test('closing pauses its swept leaves for an entrant and resumes after they leave',()=>{
 const f=fixture(true);f.piece.doorOpen=false;f.build.update(.1,f.origin);const before=f.build.doorFraction(f.piece);assert.ok(before<1&&before>0);
 f.nav.position.copy(f.world([0,2.05,0]));f.build.update(.5,f.origin);assert.equal(f.build.doorFraction(f.piece),before);assert.equal(f.build.visualDiagnostics.doors[0].blocked,true);assert.equal(f.piece.doorOpen,false);
 f.nav.position.copy(f.world([0,2.05,2]));f.build.update(.5,f.origin);assert.equal(f.build.doorFraction(f.piece),0);assert.equal(f.build.visualDiagnostics.doors[0].blocked,false);f.build.dispose();
});
test('claim fade is smooth before culling; service spill is bounded and available in daylight',()=>{
 assert.equal(buildOpacity(500),1);assert.equal(buildOpacity(550),.5);assert.equal(buildOpacity(600),0);assert.ok(buildOpacity(599.9)<.00001);assert.equal(nightFactor(1),0);assert.equal(nightFactor(-1),1);
 const selected=nearestServiceLights(Array.from({length:20},(_,i)=>({id:String(i),distance:40-i*2})));assert.equal(selected.length,MAX_SERVICE_LIGHTS);assert.deepEqual(selected.map(s=>s.distance),[2,4,6,8]);
 const f=fixture();f.build.active=true;f.build.update(.01,f.origin);assert.equal(f.build.workLight.visible,false);assert.equal(f.build.serviceLights.filter(l=>l.visible&&l.intensity>0).length,1);
 f.nav.sunDirection.negate();f.build.update(.01,f.origin);assert.equal(f.build.workLight.visible,true);f.nav.focused=false;f.build.update(.01,f.origin);assert.equal(f.build.workLight.visible,false);
 f.build.active=false;f.nav.position.copy(f.world([550,0,0]));f.build.update(.01,f.origin);assert.ok(Math.abs(f.build.visualDiagnostics.claims[0].opacity-.5)<1e-6);assert.equal(f.build.groups.get(f.claim.id).visible,true);f.nav.position.copy(f.world([601,0,0]));f.build.update(.01,f.origin);assert.equal(f.build.groups.get(f.claim.id).visible,false);f.build.dispose();
});
test('async authored ghosts never show collider placeholders or retain stale/disposed requests',async()=>{
 const f=fixture(),requests=[],disposed=[];f.build.render=true;f.build.active=true;f.build.ghostFactory=()=>new Promise(resolve=>requests.push(resolve));f.build.ghostDisposer=model=>disposed.push(model);
 const preview=id=>{f.build.pieceId=id;f.build.preview={position:f.origin.toArray(),claim:f.claim,piece:{type:id,rotation:0},valid:true};f.build.updateGhost();};
 preview('foundation');assert.equal(f.build.ghost.children.length,0);preview('wall');const old=new THREE.Group(),current=new THREE.Group();requests[1](current);await Promise.resolve();assert.equal(f.build.ghostModel,current);requests[0](old);await Promise.resolve();assert.deepEqual(disposed,[old]);
 preview('stairs');assert.ok(disposed.includes(current));f.build.dispose();const late=new THREE.Group();requests[2](late);await Promise.resolve();assert.ok(disposed.includes(late));assert.equal(f.build.ghost.children.length,0);
});
