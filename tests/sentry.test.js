import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSentrySimulation} from '../src/sentry/simulation.js';
import {SENTRY_LAYOUT as L} from '../src/sentry/layout.js';
import {sentryBodyDistance} from '../src/sentry/occlusion.js';
import {roverFitsPlatform} from '../src/rover-physics.js';
import {readGLBGeometry} from './helpers/gltf-geometry.js';
import {stat,readFile} from 'node:fs/promises';
import {faunaWeaponDamage} from '../src/fauna/weapon-rules.js';
import {createSentryEnvironment} from '../src/sentry/environment.js';
import {applyAuthoritativePeer,MultiplayerClient} from '../src/multiplayer/client.js';
import {createSentryInputSuspension} from '../src/sentry/input-suspension.js';

const v=p=>new THREE.Vector3(...p),up=v([0,1,0]);
for(const occupied of [false,true])test(`a held modal with Sentry ${occupied?'occupied':'inactive'} keeps the actual client at its normal input rate`,()=>{
  const sent=[],client=new MultiplayerClient({url:'ws://test/ws'});
  client.state.connected=true;client.socket={readyState:1,send:value=>sent.push(JSON.parse(value))};
  client.nav={enabled:false,focused:true,mode:'walk',roverOccupied:occupied,insideShip:occupied,keys:new Set(['KeyW'])};
  client.keyFire=client.pointerFire=true;
  let stopped=0;
  const gate=createSentryInputSuspension(()=>{stopped++;client.suspendInput();});
  gate.suspend();assert.equal(sent.length,1);assert.equal(sent[0].input.fire,false);assert.equal(sent[0].input.forward,0);
  // A 240 Hz client calls both vehicle step and render update while a dialog is
  // held. The real MultiplayerClient still runs its normal 20 Hz send clock.
  for(let frame=0;frame<240*5;frame++){gate.suspend();gate.suspend();client.update(1/240);}
  assert.equal(stopped,1);assert.ok(sent.length>=99&&sent.length<=102,`unexpected five-second message count ${sent.length}`);
  assert.ok(sent.every(m=>m.type==='input'&&!m.input.fire&&m.input.forward===0&&!m.input.vehicleReady),'synthetic neutral cannot arm a Sentry authority epoch');
  gate.resume();client.nav.enabled=true;client.keyFire=true;client.update(.05);
  assert.equal(sent.at(-1).input.fire,true,'resumed ordinary input clock remains live');
  const count=sent.length;gate.suspend();gate.suspend();
  assert.equal(stopped,2);assert.equal(sent.length,count+1,'a new focus or modal boundary stops immediately once');
  assert.equal(sent.at(-1).input.fire,false);assert.equal(client.keyFire,false);
});
function fixture(){
  const players=new Map(),inputs=new Map(),shots=[];let carriers=[];
  const support=p=>({point:p.clone().setY(0),normal:up.clone(),source:'terrain'});
  const rover=createSentrySimulation({id:'sentry:test',ownerId:'pilot',position:v([0,0,0]),quaternion:new THREE.Quaternion(),sampleSupport:support,referenceUp:()=>up,getCarriers:()=>carriers,getPlayer:id=>players.get(id),getInput:id=>inputs.get(id),onFire:(poses,by,sequence)=>shots.push({poses,by,sequence})});
  function player(id,role){const p={id,health:100,sequence:0,nav:{mode:'walk',roverOccupied:false,position:rover.ground(role),orientation:new THREE.Quaternion(),velocity:new THREE.Vector3(),angularVelocity:new THREE.Vector3(),keys:new Set(),gamepad:{suspend(){}}}};players.set(id,p);send(id,{});return p;}
  function send(id,patch){const p=players.get(id);p.sequence++;inputs.set(id,{forward:0,strafe:0,yaw:0,pitch:0,mouseYaw:0,mousePitch:0,brake:false,fire:false,enabled:true,sequence:p.sequence,...patch});}
  function tick(seconds){for(let i=0;i<Math.ceil(seconds*60);i++)rover.tick(1/60);}
  function board(id,role){const p=player(id,role);rover.request(id,role);tick(10);assert.equal(rover.seats[role].phase,'seated');send(id,{});tick(.1);return p;}
  return {players,inputs,rover,shots,player,send,tick,board,setCarriers:value=>carriers=value};
}
test('both seats require physical reach and finish their door/step route before control',()=>{
  const f=fixture(),p=f.player('pilot','pilot'),a=p.nav.position.clone();
  assert.throws(()=>f.rover.request('pilot','gunner'),/Approach/);
  f.rover.request('pilot','pilot');f.send('pilot',{fire:true,forward:1});f.tick(.5);
  assert.equal(f.rover.seats.pilot.phase,'opening');assert.equal(p.nav.position.distanceTo(a),0);assert.equal(f.shots.length,0);assert.equal(f.rover.physics.state.distance,0);
  f.tick(9.5);assert.equal(f.rover.seats.pilot.phase,'seated');assert.ok(p.nav.position.distanceTo(f.rover.world(L.seats.pilot.eye))<1e-8);
  assert.equal(f.shots.length,0);assert.equal(f.rover.physics.state.distance,0);
  f.send('pilot',{});f.tick(.1);f.send('pilot',{fire:true,forward:1});f.tick(.3);assert.ok(f.shots.length>0);assert.ok(f.rover.physics.state.distance>0);
});
test('gunner reservation removes pilot fire immediately, with a fresh neutral packet required for fallback',()=>{
  const f=fixture(),pilot=f.board('pilot','pilot');f.send('pilot',{fire:true});f.tick(.3);const before=f.shots.length;
  f.player('gunner','gunner');f.rover.request('gunner','gunner');f.tick(10);
  assert.equal(f.shots.length,before);assert.equal(f.rover.state.controllerId,'gunner');
  f.send('gunner',{});f.tick(.1);f.send('gunner',{fire:true,yaw:.7});f.tick(.5);
  assert.equal(f.shots.at(-1).by,'gunner');assert.ok(f.rover.state.yaw>.3);
  assert.ok(pilot.nav.orientation.angleTo(f.rover.physics.state.quaternion)<1e-8,'pilot view stays on driving heading');
  const gunnerShots=f.shots.length;f.rover.release('gunner');f.players.delete('gunner');f.tick(.2);
  assert.equal(f.rover.state.controllerId,'pilot');assert.equal(f.shots.length,gunnerShots,'held pilot RT cannot inherit gunner authority');
  // Fabricated neutral at the same sequence cannot satisfy a new authority epoch.
  f.inputs.set('pilot',{...f.inputs.get('pilot'),fire:false});f.tick(2);assert.equal(f.rover.state.armed,false);
  f.send('pilot',{});f.tick(.1);f.send('pilot',{fire:true});f.tick(.3);assert.equal(f.shots.at(-1).by,'pilot');
});
test('focus/modal/transport input interruption stops driving and requires neutral before fire resumes',()=>{
  const f=fixture();f.board('p','pilot');f.send('p',{fire:true,forward:1});f.tick(.3);const n=f.shots.length;
  f.send('p',{enabled:false});f.tick(.3);assert.equal(f.rover.state.armed,false);assert.equal(f.rover.controls.brake,1);
  f.send('p',{fire:true,forward:1});f.tick(.4);assert.equal(f.shots.length,n);assert.equal(f.rover.controls.throttle,0);
  f.send('p',{});f.tick(.1);f.send('p',{fire:true});f.tick(.3);assert.ok(f.shots.length>n);
});
test('a gunner cannot drive, and a moving pilot cannot leave through a pressure door',()=>{
  const f=fixture();f.board('p','pilot');f.board('g','gunner');f.send('g',{forward:1,strafe:1});f.tick(.5);assert.equal(f.rover.physics.state.distance,0);
  f.send('p',{});f.tick(.1);f.send('p',{forward:1});f.tick(1);assert.ok(f.rover.physics.state.speed>1);assert.throws(()=>f.rover.exit('p'),/Brake/);
  f.send('p',{brake:true});f.tick(1);f.rover.exit('p');f.tick(10);assert.equal(f.rover.seats.pilot.id,null);assert.equal(f.players.get('p').nav.roverOccupied,false);
  assert.ok(f.players.get('p').nav.position.distanceTo(f.rover.ground('pilot'))<.004);
});
test('depleted laser reserve cannot repeat until trigger releases; no target or inventory input exists',()=>{
  const f=fixture();f.board('p','pilot');f.send('p',{fire:true,damage:Infinity,target:'invented'});f.tick(28);assert.equal(f.rover.state.depleted,true);
  const shots=f.shots.length;f.tick(2);assert.equal(f.shots.length,shots);f.send('p',{});f.tick(2);f.send('p',{fire:true});f.tick(.5);assert.ok(f.shots.length>shots);
  for(const shot of f.shots)for(const p of shot.poses){assert.ok(p.start.toArray().every(Number.isFinite));assert.ok(Math.abs(p.direction.length()-1)<1e-9);}
});

test('mounted fauna damage requires an actual seated rover; handheld and multiplayer cabin guards remain',()=>{
  const nav={enabled:true,mode:'walk',insideShip:true,sentrySeat:{phase:'seated'}},hit={kind:'fauna'};
  assert.equal(faunaWeaponDamage(nav,hit,'rover-laser'),18);
  assert.equal(faunaWeaponDamage(nav,hit,'rifle-laser'),0);assert.equal(faunaWeaponDamage(nav,hit,'sidearm-pistol'),0);
  for(const phase of ['opening','traversing','closing',null])assert.equal(faunaWeaponDamage({...nav,sentrySeat:{phase}},hit,'rover-laser'),0);
  assert.equal(faunaWeaponDamage({...nav,insideShip:false,sentrySeat:null},hit,'rover-laser'),0);
  assert.equal(faunaWeaponDamage(nav,hit,'rover-laser',true),0);assert.equal(faunaWeaponDamage({...nav,enabled:false},hit,'rover-laser'),0);
});

test('peer rovers and unseated walkers stop the complete moving envelope, while its own crew is excluded',()=>{
  const rover={id:'other',position:[0,0,0],quaternion:[0,0,0,1],wheels:[]},walker={mode:'walk',position:v([8,1.75,0]),sentrySeat:null};
  const environment=createSentryEnvironment({getRovers:()=>[rover],getWalkers:()=>[walker]});
  assert.equal(environment.peersClear(v([0,0,0]),new THREE.Quaternion(),'mine'),false);
  assert.equal(environment.peersClear(v([8,0,0]),new THREE.Quaternion(),'mine'),false);
  walker.roverOccupied=true;walker.sentrySeat={id:'mine'};assert.equal(environment.peersClear(v([8,0,0]),new THREE.Quaternion(),'mine'),true);
  assert.equal(environment.peersClear(v([0,0,0]),new THREE.Quaternion(),'other'),true);
});

test('local reconciliation hydrates the real seat feet and chassis heading for the existing Character and clears them on exit',()=>{
  const nav={mode:'walk',position:v([0,0,0]),orientation:new THREE.Quaternion(),multiplayer:{connected:true}},seat={id:'r',role:'gunner',phase:'seated'},feet=[25e9,1234,5678],body=[0,.3,0,Math.sqrt(.91)];
  applyAuthoritativePeer(nav,{mode:'walk',sentrySeat:seat,sentryFeet:feet,bodyOrientation:body,position:[25e9,1235,5678],orientation:[0,0,0,1]});
  assert.deepEqual(nav.sentryFeet,feet);assert.deepEqual(nav.sentryBodyOrientation,body);assert.equal(nav.roverOccupied,true);assert.notEqual(nav.sentryFeet,feet);
  applyAuthoritativePeer(nav,{mode:'walk',sentrySeat:null,position:[25e9,1235,5682],orientation:[0,0,0,1]});
  assert.equal(nav.sentryFeet,null);assert.equal(nav.sentryBodyOrientation,null);assert.equal(nav.roverOccupied,false);
});

const assetURL=new URL('../public/models/burrow-sentry.glb',import.meta.url),asset=await readGLBGeometry(assetURL),scene=asset.scene;scene.updateMatrixWorld(true);
test('the exported Sentry is within its aggregate vehicle budget and retains normal Burrow unchanged',async()=>{
  let triangles=0;scene.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});assert.ok(triangles<=30000,triangles);assert.ok((await stat(assetURL)).size<=4_000_000);
  const box=new THREE.Box3().setFromObject(scene,true);for(let i=0;i<3;i++){assert.ok(box.min.getComponent(i)>=L.bounds.min[i]-.003);assert.ok(box.max.getComponent(i)<=L.bounds.max[i]+.003);}
  for(const name of ['GunnerDoor','SentryYaw','SentryPitch','SentrySight','SentryMuzzle_Port','SentryMuzzle_Starboard'])assert.ok(scene.getObjectByName(name));
  assert.equal(scene.getObjectByName('Cutter_Port'),undefined);
  assert.equal((await readFile(new URL('../assets/mining-rover/manifest.json',import.meta.url),'utf8')).includes('Sentry'),false);
  assert.equal(roverFitsPlatform(v([0,4,2]),new THREE.Quaternion(),{minX:-4,maxX:4,minZ:-4,maxZ:8,ceiling:9.2},{layout:L}),true);
});
test('actual muzzle transforms match shared firing rays across yaw/pitch, and barrels have clear apertures',()=>{
  const f=fixture(),yaw=scene.getObjectByName('SentryYaw'),pitch=scene.getObjectByName('SentryPitch');
  for(const y of [0,.7,-1.2,Math.PI])for(const p of [L.turret.pitchMin,0,L.turret.pitchMax]){
    f.rover.state.yaw=y;f.rover.state.pitch=p;yaw.rotation.y=y;pitch.rotation.x=p;scene.updateMatrixWorld(true);
    const poses=f.rover.muzzlePoses();for(let i=0;i<2;i++){
      const node=scene.getObjectByName(i?'SentryMuzzle_Starboard':'SentryMuzzle_Port'),point=node.getWorldPosition(new THREE.Vector3());
      assert.ok(point.distanceTo(poses[i].start)<.002,`socket ${i} ${y}/${p}: ${point.toArray()} / ${poses[i].start.toArray()}`);
      const direction=v([0,0,-1]).applyQuaternion(node.getWorldQuaternion(new THREE.Quaternion()));assert.ok(direction.distanceTo(poses[i].direction)<.00001);
      const ray=new THREE.Raycaster(point,direction,0,.03);assert.equal(ray.intersectObject(scene,true).length,0,'actual lens opening clear');
    }
  }
  yaw.rotation.y=pitch.rotation.x=0;scene.updateMatrixWorld(true);
});
test('depression towards the cabin is stopped by the pressure shell, and the forward view stays clear',()=>{
  const f=fixture();f.rover.state.pitch=L.turret.pitchMin;
  assert.ok(f.rover.muzzlePoses().some(p=>sentryBodyDistance(p.start,p.direction,f.rover.physics.state.position,f.rover.physics.state.quaternion)<5));
  for(let i=0;i<20;i++){
    const y=1.50+i*.04,target=v([0,y,-1.66+(y-1.36)*.49/.965]),eye=v(L.seats.pilot.eye),ray=new THREE.Raycaster(eye,target.clone().sub(eye).normalize(),0,eye.distanceTo(target)+.065);
    const hits=ray.intersectObject(scene,true);assert.equal(hits.filter(h=>!h.object.material.transparent).length,0);
  }
});

test('physical entry eye clearance for both doors and the unobstructed gunner display',()=>{
  scene.getObjectByName('CabinDoor').rotation.y=1.65;scene.getObjectByName('GunnerDoor').rotation.y=-1.6;scene.updateMatrixWorld(true);
  const triangles=[],p=new THREE.Vector3(),q=new THREE.Vector3();
  scene.traverse(o=>{if(!o.isMesh)return;const g=o.geometry,index=g.index,count=index?.count??g.attributes.position.count;for(let i=0;i<count;i+=3){const points=[0,1,2].map(k=>p.fromBufferAttribute(g.attributes.position,index?index.getX(i+k):i+k).clone().applyMatrix4(o.matrixWorld));triangles.push({triangle:new THREE.Triangle(...points),bounds:new THREE.Box3().setFromPoints(points),name:o.name});}});
  try{
    for(const [role,seat]of Object.entries(L.seats)){
      const route=[seat.ground,...seat.route].map(v);
      for(let segment=0;segment<route.length-1;segment++)for(let i=0;i<=24;i++){
        p.copy(route[segment]).lerp(route[segment+1],i/24);
        for(const t of triangles){if(t.bounds.distanceToPoint(p)>=.12)continue;t.triangle.closestPointToPoint(p,q);assert.ok(p.distanceTo(q)>=.12,`${role} route ${segment}/${i}: ${p.toArray()} clips ${t.name} at ${q.toArray()}`);}
      }
    }
    const anchor=scene.getObjectByName('GunnerDisplay'),material=new THREE.MeshBasicMaterial(),face=new THREE.Mesh(new THREE.PlaneGeometry(.70,.36),material);face.position.z=.023;anchor.add(face);scene.updateMatrixWorld(true);
    for(const x of [-.32,0,.32])for(const y of [-.16,0,.16]){const target=v([x,y,0]).applyMatrix4(face.matrixWorld),eye=v(L.seats.gunner.eye),ray=new THREE.Raycaster(eye,target.clone().sub(eye).normalize(),0,eye.distanceTo(target)+.001);assert.equal(ray.intersectObject(scene,true).find(h=>!h.object.material.transparent)?.object,face);}
    face.removeFromParent();face.geometry.dispose();material.dispose();
  }finally{scene.getObjectByName('CabinDoor').rotation.y=scene.getObjectByName('GunnerDoor').rotation.y=0;scene.updateMatrixWorld(true);}
});


test('garage relocation retains damaged hull, charge and turret aim and never moves an occupant',()=>{
  const f=fixture(),r=f.rover;
  Object.assign(r.state,{health:73,charge:.31,yaw:.4,pitch:.12,shots:19});
  r.relocate({position:v([20,0,5]),quaternion:new THREE.Quaternion()});
  assert.deepEqual(r.physics.state.position.toArray(),[20,0,5]);
  for(const [key,value] of Object.entries({health:73,charge:.31,yaw:.4,pitch:.12,shots:19}))assert.equal(r.state[key],value);
  f.board('pilot','pilot');const before=f.players.get('pilot').nav.position.toArray();
  assert.throws(()=>r.relocate({position:v([0,0,0]),quaternion:new THREE.Quaternion()}),/Park/);
  assert.deepEqual(f.players.get('pilot').nav.position.toArray(),before);
});
